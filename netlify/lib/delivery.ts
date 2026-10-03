// The delivery app's rules: owners assign deliveries to drivers; a driver starts their route
// (customers get "on its way"), takes a photo at every door, records money collected, and marks
// each stop delivered (customer gets the thank-you email). Owners see cash to hand in.
import { sql, one, type Row } from './db';
import { HttpError, env } from './http';
import { setStatus, setPayment, event, items } from './orders';
import { send } from './email';
import { calgaryNow } from './slots';
import { dollars } from './pricing';
import GUIDE from '../../src/content/driver-guide.json';
import type { Session } from './auth';
import { assertPapers } from './team';
import { planRoute, navLinks, mapsEnabled, shopAddress, type Origin } from './routing';

export const guideText = () => [GUIDE.guide.title.en, ...GUIDE.guide.points.map((p, i) => `${i + 1}. ${p.t.en}`)].join('\n');
const day = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);

export async function member(email: string) {
  return one`SELECT id, email, role, name, phone, vehicle, status, agreed_at, volunteer, drives, licence_expires::text, insurance_expires::text, food_cert_expires::text FROM team_members WHERE email = ${email}`;
}

/** First login of an invited driver: their details and agreeing to the guide. */
export async function onboard(s: Session, b: any) {
  const name = String(b?.name ?? '').trim().slice(0, 120), phone = String(b?.phone ?? '').trim().slice(0, 40), vehicle = String(b?.vehicle ?? '').trim().slice(0, 120);
  const fields: Record<string, string> = {};
  if (!name) fields.name = 'required';
  if (phone.replace(/\D/g, '').length < 10) fields.phone = 'phone';
  if (b?.agree !== true) fields.agree = 'required';
  if (Object.keys(fields).length) throw Object.assign(new HttpError(400, 'invalid', 'Fill in your name and phone, and tick that you have read the guide.'), { fields });
  const d = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const cur = await one`SELECT role, drives FROM team_members WHERE email = ${s.email}`;
  if ((cur?.role === 'driver' || cur?.drives) && (!d(b?.licence_expires) || !d(b?.insurance_expires))) throw Object.assign(new HttpError(400, 'invalid', "Add when your driver's licence and car insurance expire."), { fields: { licence_expires: 'required' } });
  const m = await one`UPDATE team_members SET name = ${name}, phone = ${phone}, vehicle = ${vehicle || null}, status = 'active', agreed_text = ${guideText()}, agreed_at = NOW(),
      licence_expires = ${d(b?.licence_expires)}, insurance_expires = ${d(b?.insurance_expires)}, food_cert_expires = ${d(b?.food_cert_expires)}
    WHERE email = ${s.email} AND status <> 'off' RETURNING *`;
  if (!m) throw new HttpError(404, 'not-found', 'You are not on the team list.');
  for (const to of env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean))
    await send({ to, subject: `${name} has joined as a ${m.role}`, text: `${name} (${s.email}, ${phone}${vehicle ? `, ${vehicle}` : ''}) finished onboarding and agreed to the driver guide.`, html: `<p style="font:15px Arial,sans-serif">${name.replace(/[<>&]/g, '')} (${s.email}) finished onboarding and agreed to the driver guide.</p>`, kind: 'team-onboarded' });
  return m;
}

const stopShape = async (o: Row) => ({
  ref: o.ref, seq: o.route_seq ?? null, status: o.status, window: o.slot_window, day: day(o.slot_date), name: o.name, phone: o.phone, street: o.street, postal: o.postal, notes: o.notes,
  gift: o.gift ? { to: o.gift_to, phone: o.gift_phone, message: o.gift_message } : null, driver: o.driver_email,
  collect: o.payment_status === 'unpaid' && o.payment === 'at-pickup' ? o.total_cents : 0,
  unpaid: o.payment_status === 'unpaid' && o.payment !== 'at-pickup', collected: o.collected_method ? { method: o.collected_method, cents: o.collected_cents } : null,
  photos: (await sql`SELECT id FROM delivery_photos WHERE order_id = ${o.id} ORDER BY id`).map(p => p.id), customerNote: o.team_note ?? null,
  items: (await items(o.id)).map(i => ({ qty: i.qty, name: i.name_en, option: i.option_en })),
});

/** A driver's stops for a day: their own; owners and helpers see everyone's (or "mine"). */
export async function stops(s: Session, date: string, mine: boolean) {
  const onlyMine = s.role === 'driver' || mine;
  const rows = await sql`SELECT o.*, c.team_note FROM orders o LEFT JOIN customers c ON c.email = o.email
    WHERE o.slot_date = ${date} AND o.method = 'delivery' AND o.status <> 'cancelled' AND (${!onlyMine} OR o.driver_email = ${s.email})
    ORDER BY o.route_seq NULLS LAST, o.slot_window, o.postal, o.id`;
  return Promise.all(rows.map(stopShape));
}

async function myStop(s: Session, ref: string) {
  const o = await one`SELECT * FROM orders WHERE ref = ${ref} AND method = 'delivery'`;
  if (!o || (s.role === 'driver' && o.driver_email !== s.email)) throw new HttpError(404, 'not-found', 'That stop is not on your list.');
  return o;
}

const addressOf = (o: Row) => `${o.street}, ${o.postal}, Calgary, AB`;
const openRoute = (email: string, date: string) => one`SELECT * FROM routes WHERE driver_email = ${email} AND day = ${date} AND ended_at IS NULL ORDER BY id DESC LIMIT 1`;

/** Start route: plans the shortest order for my stops still to do, records the start odometer,
 * and marks them "out for delivery" (each customer gets the "on its way" email). */
export async function startRoute(s: Session, date: string, req?: Request, b: any = {}) {
  await assertPapers(s.email, date);
  if (await openRoute(s.email, date)) throw new HttpError(409, 'route-open', 'Your route is already going. End it first, or keep going.');
  // The odometer is optional: without it the app counts the km from the planned route.
  const odoRaw = b?.startOdometer === null || b?.startOdometer === undefined || b?.startOdometer === '' ? null : Math.round(Number(b.startOdometer));
  if (odoRaw !== null && (!Number.isFinite(odoRaw) || odoRaw < 0 || odoRaw > 3_000_000)) throw Object.assign(new HttpError(400, 'odometer', 'Check the odometer reading, or leave it empty.'), { fields: { startOdometer: 'odometer' } });
  const odo = odoRaw;
  const rows = await sql`SELECT * FROM orders WHERE slot_date = ${date} AND method = 'delivery' AND driver_email = ${s.email} AND status IN ('received', 'confirmed', 'ready', 'out-for-delivery') ORDER BY slot_window, postal`;
  if (!rows.length) throw new HttpError(400, 'no-stops', 'You have no stops left for this day.');
  const here: Origin | null = Number.isFinite(Number(b?.lat)) && Number.isFinite(Number(b?.lng)) && b?.lat !== null && b?.lng !== null ? { lat: Number(b.lat), lng: Number(b.lng), label: 'My location' } : null;
  const origin = b?.from === 'here' && here ? here : shopAddress() ? { address: shopAddress(), label: 'Shop' } : here;
  const plan = await planRoute(rows.map(o => ({ ref: o.ref, address: addressOf(o), window: o.slot_window, postal: o.postal ?? '' })), origin);
  const route = await one`INSERT INTO routes (driver_email, day, start_odometer, planned_meters, planned_seconds, stops, legs, return_meters, start_label)
    VALUES (${s.email}, ${date}, ${odo}, ${plan.meters}, ${plan.seconds}, ${JSON.stringify(plan.order)}::jsonb, ${JSON.stringify(plan.legs)}::jsonb, ${plan.returnMeters}, ${origin?.label ?? null}) RETURNING id`;
  for (const [i, ref] of plan.order.entries()) await sql`UPDATE orders SET route_seq = ${i + 1} WHERE ref = ${ref}`;
  let started = 0;
  for (const o of rows) {
    if (o.status === 'out-for-delivery') continue;
    await setStatus(o.ref, 'out-for-delivery', s.email, req, true);
    await sql`UPDATE orders SET out_at = NOW() WHERE ref = ${o.ref}`;
    started++;
  }
  const byRef = new Map(rows.map(o => [o.ref, o]));
  return { started, routeId: route!.id, optimized: plan.optimized, km: plan.meters === null ? null : Math.round(plan.meters / 100) / 10, minutes: plan.seconds === null ? null : Math.round(plan.seconds / 60),
    links: navLinks(plan.order.map(r => addressOf(byRef.get(r)!))) };
}

export async function endRoute(s: Session, date: string, b: any = {}) {
  const r = await openRoute(s.email, date);
  if (!r) throw new HttpError(404, 'no-route', 'There is no route going for this day.');
  const odo = b?.endOdometer === null || b?.endOdometer === undefined || b?.endOdometer === '' ? null : Math.round(Number(b.endOdometer));
  if (odo !== null && r.start_odometer !== null) {
    if (!Number.isFinite(odo) || odo < r.start_odometer) throw Object.assign(new HttpError(400, 'odometer', `The end reading must be at least the start (${r.start_odometer} km).`), { fields: { endOdometer: 'odometer' } });
    if (odo - r.start_odometer > 1500) throw new HttpError(400, 'odometer', 'That is more than 1,500 km in one route. Check the reading.');
  }
  await sql`UPDATE routes SET ended_at = NOW(), end_odometer = ${r.start_odometer !== null ? odo : null}, note = ${String(b?.note ?? '').slice(0, 500) || null} WHERE id = ${r.id}`;
  const done = await one`SELECT * FROM routes WHERE id = ${r.id}`;
  return { km: await routeKm(done!) };
}

/** Km for a route: the odometer when both readings exist, otherwise the app's count from the
 * planned legs to each stop actually delivered (plus the way back once the route has ended). */
export async function routeKm(r: Row) {
  if (r.start_odometer !== null && r.end_odometer !== null) return r.end_odometer - r.start_odometer;
  const legs: { ref: string; meters: number | null }[] = typeof r.legs === 'string' ? JSON.parse(r.legs) : (r.legs ?? []);
  if (!legs.length || legs.every(l => l.meters === null)) return null;
  const refs = legs.map(l => l.ref);
  const done = new Set((await sql`SELECT ref FROM orders WHERE ref = ANY(${refs}) AND (status = 'completed' OR EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = orders.id AND e.detail LIKE 'Couldn''t deliver%'))`).map(x => x.ref));
  const m = legs.filter(l => done.has(l.ref)).reduce((n, l) => n + (l.meters ?? 0), 0) + (r.ended_at ? r.return_meters ?? 0 : 0);
  return Math.round(m / 100) / 10;
}

export async function currentRoute(s: Session, date: string) {
  const r = await openRoute(s.email, date) ?? await one`SELECT * FROM routes WHERE driver_email = ${s.email} AND day = ${date} ORDER BY id DESC LIMIT 1`;
  if (!r) return null;
  const order: string[] = typeof r.stops === 'string' ? JSON.parse(r.stops) : r.stops;
  const rows = order.length ? await sql`SELECT ref, street, postal, status FROM orders WHERE ref = ANY(${order})` : [];
  const left = order.map(ref => rows.find(x => x.ref === ref)).filter(x => x && x.status !== 'completed') as Row[];
  const next = left[0] ?? null;
  return { id: r.id, open: !r.ended_at, kmSoFar: await routeKm(r), next: next ? { ref: next.ref, address: addressOf(next), url: `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(addressOf(next))}` } : null, startOdometer: r.start_odometer, endOdometer: r.end_odometer, km: r.planned_meters === null ? null : Math.round(r.planned_meters / 100) / 10,
    minutes: r.planned_seconds === null ? null : Math.round(r.planned_seconds / 60), startedAt: r.started_at, endedAt: r.ended_at, links: navLinks(left.map(addressOf)) };
}

// ---------- pay rates and reports ----------
export type PayRates = { perDelivery: number; perKm: number; perHour: number }; // cents
export async function payRates(): Promise<PayRates> {
  const r = await one`SELECT value FROM settings WHERE key = 'driver_pay'`;
  const v = (r?.value ?? {}) as Partial<PayRates>;
  return { perDelivery: Number(v.perDelivery) || 0, perKm: Number(v.perKm) || 0, perHour: Number(v.perHour) || 0 };
}
export async function savePayRates(b: any) {
  const c = (v: unknown) => Math.max(0, Math.min(100000, Math.round(Number(v) || 0)));
  const v = { perDelivery: c(b?.perDelivery), perKm: c(b?.perKm), perHour: c(b?.perHour) };
  await sql`INSERT INTO settings (key, value) VALUES ('driver_pay', ${JSON.stringify(v)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return v;
}

/** A driver's report: per day deliveries, km (odometer, and planned), hours, money, estimated pay. */
export async function driverReport(email: string, from: string, to: string) {
  const rates = await payRates();
  const routes = await sql`SELECT day::text AS day, started_at, ended_at, start_odometer, end_odometer, planned_meters, legs, return_meters, jsonb_array_length(stops)::int AS stops, start_label, note
    FROM routes WHERE driver_email = ${email} AND day BETWEEN ${from} AND ${to} ORDER BY day, started_at`;
  const dels = await sql`SELECT slot_date::text AS day, COUNT(*)::int AS n FROM orders WHERE delivered_by = ${email} AND slot_date BETWEEN ${from} AND ${to} GROUP BY 1`;
  const cash = await sql`SELECT slot_date::text AS day, COALESCE(SUM(collected_cents) FILTER (WHERE collected_method = 'cash'), 0)::int AS cash,
      COALESCE(SUM(collected_cents) FILTER (WHERE collected_method = 'card'), 0)::int AS card,
      COALESCE(SUM(collected_cents) FILTER (WHERE collected_method = 'cash' AND cash_handed_in_at IS NULL), 0)::int AS cash_open
    FROM orders WHERE collected_by = ${email} AND slot_date BETWEEN ${from} AND ${to} GROUP BY 1`;
  const days = [...new Set([...routes.map(r => r.day), ...dels.map(d => d.day), ...cash.map(c => c.day)])].sort();
  for (const r of routes) r.km = await routeKm(r);
  const rows = days.map(d => {
    const rs = routes.filter(r => r.day === d);
    const km = Math.round(rs.reduce((n, r) => n + (r.km ?? 0), 0) * 10) / 10;
    const plannedKm = Math.round(rs.reduce((n, r) => n + (r.planned_meters ?? 0), 0) / 100) / 10;
    const minutes = rs.reduce((n, r) => n + (r.ended_at ? Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000) : 0), 0);
    const deliveries = dels.find(x => x.day === d)?.n ?? 0;
    const c = cash.find(x => x.day === d);
    const pay = deliveries * rates.perDelivery + Math.round(km * rates.perKm) + Math.round(minutes / 60 * rates.perHour);
    return { day: d, routes: rs.length, deliveries, km, plannedKm, minutes, cash: c?.cash ?? 0, card: c?.card ?? 0, cashOpen: c?.cash_open ?? 0, pay, open: rs.some(r => !r.ended_at) };
  });
  const sum = (k: 'deliveries' | 'km' | 'minutes' | 'cash' | 'card' | 'cashOpen' | 'pay') => Math.round(rows.reduce((n, r) => n + r[k], 0) * 10) / 10;
  return { from, to, rates, days: rows, routes,
    total: { deliveries: sum('deliveries'), km: sum('km'), plannedKm: Math.round(rows.reduce((n, r) => n + r.plannedKm, 0) * 10) / 10, minutes: sum('minutes'), cash: sum('cash'), card: sum('card'), cashOpen: sum('cashOpen'), pay: sum('pay') } };
}

/** The mileage log as CSV (date, times, odometer, km, purpose), the kind the CRA asks to keep. */
export function mileageCsv(email: string, report: Awaited<ReturnType<typeof driverReport>>) {
  const t = (v: unknown) => (v ? new Date(v as string).toLocaleTimeString('en-CA', { timeZone: 'America/Edmonton', hour: '2-digit', minute: '2-digit', hour12: false }) : '');
  const cell = (v: unknown) => { const x = String(v ?? ''); return /^[=+\-@]/.test(x) ? `'${x}` : /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const head = ['date', 'driver', 'start', 'end', 'start_odometer_km', 'end_odometer_km', 'km_driven', 'km_source', 'planned_km', 'stops', 'started_from', 'purpose', 'note'];
  const lines = report.routes.map((r: any) => [r.day, email, t(r.started_at), t(r.ended_at), r.start_odometer, r.end_odometer, r.km ?? '', r.end_odometer !== null && r.start_odometer !== null ? 'odometer' : r.km !== null ? 'app (planned route)' : '',
    r.planned_meters ? (r.planned_meters / 1000).toFixed(1) : '', r.stops, r.start_label ?? '', 'Hikaya deliveries', r.note ?? ''].map(cell).join(','));
  return [head.join(','), ...lines].join('\n');
}

export const routing = () => ({ planner: mapsEnabled(), shop: Boolean(shopAddress()) });

export async function addDeliveryPhoto(s: Session, ref: string, mime: string, bytes: Uint8Array) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new HttpError(415, 'image', 'Send a JPEG, PNG or WebP photo.');
  if (!bytes.length || bytes.length > 1_500_000) throw new HttpError(413, 'too-large', 'That photo is too large.');
  const o = await myStop(s, ref);
  const n = await one`SELECT COUNT(*)::int AS n FROM delivery_photos WHERE order_id = ${o.id}`;
  if ((n?.n ?? 0) >= 4) throw new HttpError(409, 'enough', 'This stop already has 4 photos.');
  const p = await one`INSERT INTO delivery_photos (order_id, mime, data, taken_by) VALUES (${o.id}, ${mime}, ${bytes}, ${s.email}) RETURNING id`;
  await event(o.id, 'photo', 'Delivery photo', s.email);
  return { id: p!.id as number };
}

/** Delivered: needs a photo; if money was due at the door, how it was paid. */
export async function delivered(s: Session, ref: string, collected: unknown, req?: Request) {
  const o = await myStop(s, ref);
  if (o.status === 'completed') return { ok: true };
  const photo = await one`SELECT id FROM delivery_photos WHERE order_id = ${o.id} LIMIT 1`;
  if (!photo) throw new HttpError(400, 'photo', 'Take a photo of the order at the door first.');
  const due = o.payment_status === 'unpaid' && o.payment === 'at-pickup';
  if (due && collected !== 'cash' && collected !== 'card') throw new HttpError(400, 'collect', `Collect ${dollars(o.total_cents)} and choose cash or card.`);
  if (due) {
    await sql`UPDATE orders SET collected_method = ${collected as string}, collected_cents = ${o.total_cents}, collected_by = ${s.email} WHERE id = ${o.id}`;
    await setPayment(ref, 'paid', s.email);
    await event(o.id, 'payment', `Collected ${dollars(o.total_cents)} by ${collected} at the door`, s.email);
  }
  await setStatus(ref, 'completed', s.email, req, true);
  await sql`UPDATE orders SET delivered_at = NOW(), delivered_by = ${s.email} WHERE id = ${o.id}`;
  return { ok: true };
}

export async function missed(s: Session, ref: string, why: string) {
  const o = await myStop(s, ref);
  const text = why.trim().slice(0, 500) || 'No reason given';
  await event(o.id, 'note', `Couldn't deliver: ${text}`, s.email);
  for (const to of env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean))
    await send({ to, subject: `Couldn't deliver ${o.ref} (${o.name})`, text: `${s.email}: ${text}\n\n${o.street}, ${o.postal} · ${o.phone}`, html: `<p style="font:15px Arial,sans-serif">${s.email}: ${text.replace(/[<>&]/g, '')}<br>${String(o.street).replace(/[<>&]/g, '')}, ${o.postal}</p>`, kind: 'team-missed-delivery', orderId: o.id });
  return { ok: true };
}

// ---------- owners: the drivers, assignments and cash ----------
export async function teamList() {
  const people = await sql`SELECT m.*, (SELECT COUNT(*)::int FROM orders o WHERE o.delivered_by = m.email AND o.delivered_at > NOW() - INTERVAL '7 days') AS week,
      (SELECT COUNT(*)::int FROM orders o WHERE o.delivered_by = m.email AND o.delivered_at > date_trunc('month', NOW())) AS month,
      (SELECT COALESCE(SUM(collected_cents), 0)::int FROM orders o WHERE o.collected_by = m.email AND o.collected_method = 'cash' AND o.cash_handed_in_at IS NULL) AS cash
    FROM team_members m ORDER BY m.status = 'off', m.created_at`;
  const d = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);
  return people.map(p => ({ id: p.id, email: p.email, shared: Boolean(p.shared), login: p.login_email ?? null, role: p.role, name: p.name, phone: p.phone, vehicle: p.vehicle, status: p.status, agreedAt: p.agreed_at, week: p.week, month: p.month, cash: p.cash,
    volunteer: Boolean(p.volunteer), drives: Boolean(p.drives), licence: d(p.licence_expires), insurance: d(p.insurance_expires), foodCert: d(p.food_cert_expires) }));
}

export async function invite(b: any, by: string, siteUrl: string, byLogin = by) {
  // Someone who works under the shared login: they log in with it and pick their name; a code to
  // their own email confirms it is them (and their reminders go there).
  if (b?.shared === true) {
    const name = String(b?.name ?? '').trim().slice(0, 120);
    const own = String(b?.email ?? '').trim().toLowerCase();
    if (!name) throw new HttpError(400, 'invalid', 'Give their name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(own)) throw new HttpError(400, 'invalid', 'Add their own email: the code to confirm it is them goes there.');
    if (own === byLogin) throw new HttpError(400, 'invalid', 'Use their own email, not the shared one.');
    const role = ['helper', 'packer', 'driver'].includes(b?.role) ? b.role : 'helper';
    await sql`INSERT INTO team_members (email, role, name, invited_by, volunteer, drives, shared, login_email, status)
      VALUES (${own}, ${role}, ${name}, ${by}, ${b?.volunteer === true}, ${role !== 'driver' && b?.drives === true}, TRUE, ${byLogin}, 'active')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, drives = EXCLUDED.drives, volunteer = EXCLUDED.volunteer, shared = TRUE, login_email = EXCLUDED.login_email, status = 'active'`;
    await send({ to: own, subject: 'You’re on the Hikaya team', text: `Hi ${name}, you've been added to the Hikaya team. Log in at ${siteUrl}/admin/ with ${byLogin}, pick your name, and type the code we send to this email. That's how your work is credited to you.`, html: `<p style="font:15px Arial,sans-serif">Hi ${name.replace(/[<>&]/g, '')}, you've been added to the Hikaya team. Log in at <a href="${siteUrl}/admin/">${siteUrl}/admin/</a> with ${byLogin}, pick your name, and type the code we send to this email. That's how your work is credited to you.</p>`, kind: 'team-invite' });
    return { ok: true, shared: true };
  }
  const email = String(b?.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'invalid', 'Check the email.');
  const role = ['helper', 'packer', 'driver'].includes(b?.role) ? b.role : 'driver';
  const volunteer = b?.volunteer === true, drives = role !== 'driver' && b?.drives === true;
  await sql`INSERT INTO team_members (email, role, name, invited_by, volunteer, drives) VALUES (${email}, ${role}, ${String(b?.name ?? '').trim().slice(0, 120) || null}, ${by}, ${volunteer}, ${drives})
    ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, volunteer = EXCLUDED.volunteer, drives = EXCLUDED.drives, status = CASE WHEN team_members.status = 'off' THEN 'invited' ELSE team_members.status END`;
  const link = role === 'helper' && !drives ? `${siteUrl}/admin/` : `${siteUrl}/admin/driver/`;
  const text = role !== 'helper' || drives
    ? `You've been added to the Hikaya team as a ${role}${drives ? ' who also drives' : ''}${volunteer ? ' (volunteer)' : ''}.\n\n1. Open ${link} on your phone.\n2. Log in with this email (${email}); we email you a 6-digit code. No password.\n3. Fill in your details and read the team guide.\n4. Add it to your home screen: iPhone (Safari) Share → Add to Home Screen; Android (Chrome) menu → Install app.\n\nYour shifts${role === 'driver' || drives ? ' and delivery stops' : ' and the packing list'} appear there.${role === 'helper' ? ` The order desk is at ${siteUrl}/admin/.` : ''}`
    : `You've been added to the Hikaya team.\n\nOpen ${link} and log in with this email (${email}); we email you a 6-digit code. No password.`;
  await send({ to: email, subject: role === 'driver' ? 'You’re a Hikaya driver: set up the team app' : role === 'packer' ? 'You’re on the Hikaya team: set up the team app' : 'You’re on the Hikaya team', text, html: `<div style="font:15px/1.55 Arial,sans-serif">${text.replace(/[<>&]/g, '').replace(/\n/g, '<br>').replace(link, `<a href="${link}">${link}</a>`)}</div>`, kind: 'team-invite' });
  return { ok: true };
}

export async function setMember(id: number, b: any) {
  const status = ['active', 'off', 'invited'].includes(b?.status) ? b.status : null;
  const role = ['driver', 'helper', 'packer'].includes(b?.role) ? b.role : null;
  const vol = typeof b?.volunteer === 'boolean' ? b.volunteer : null, drv = typeof b?.drives === 'boolean' ? b.drives : null;
  const m = await one`UPDATE team_members SET status = COALESCE(${status}, status), role = COALESCE(${role}, role), volunteer = COALESCE(${vol}, volunteer), drives = COALESCE(${drv}, drives) WHERE id = ${id} RETURNING id`;
  if (!m) throw new HttpError(404, 'not-found');
  if (status === 'off') { const e = await one`SELECT email FROM team_members WHERE id = ${id}`; await sql`DELETE FROM sessions WHERE email = ${e!.email}`; }
  return { ok: true };
}

/** Everyone who can drive: drivers added in the desk, plus owners and helpers. */
export async function drivers() {
  const m = await sql`SELECT email, name FROM team_members WHERE (role = 'driver' OR drives) AND status <> 'off' ORDER BY name NULLS LAST, email`;
  const others = [...env('ADMIN_EMAILS').split(','), ...env('STAFF_EMAILS').split(',')].map((e: string) => e.trim().toLowerCase()).filter(Boolean);
  return [...m.map(x => ({ email: x.email, name: x.name || x.email })), ...others.filter(e => !m.some(x => x.email === e)).map(e => ({ email: e, name: e }))];
}

export async function assign(refs: string[], driver: string, by: string) {
  const ok = !driver || (await drivers()).some(d => d.email === driver);
  if (!ok) throw new HttpError(400, 'driver', 'That person is not a driver.');
  let n = 0;
  for (const ref of refs.slice(0, 200)) {
    if (driver) { const od = await one`SELECT slot_date FROM orders WHERE ref = ${ref}`; if (od) await assertPapers(driver, (od.slot_date instanceof Date ? od.slot_date.toISOString() : String(od.slot_date)).slice(0, 10)); }
    const o = await one`UPDATE orders SET driver_email = ${driver || null} WHERE ref = ${ref} AND method = 'delivery' AND status <> 'completed' RETURNING id`;
    if (o) { n++; await event(o.id, 'driver', driver ? `Assigned to ${driver}` : 'Driver removed', by); }
  }
  return { assigned: n };
}

export async function cashToHandIn() {
  return sql`SELECT collected_by AS driver, COUNT(*)::int AS orders, SUM(collected_cents)::int AS cents, array_agg(ref ORDER BY ref) AS refs
    FROM orders WHERE collected_method = 'cash' AND cash_handed_in_at IS NULL GROUP BY collected_by`;
}
export async function cashReceived(driver: string, by: string) {
  const rows = await sql`UPDATE orders SET cash_handed_in_at = NOW() WHERE collected_by = ${driver} AND collected_method = 'cash' AND cash_handed_in_at IS NULL RETURNING id, collected_cents`;
  for (const r of rows) await event(r.id, 'payment', `Cash handed in by ${driver}`, by);
  return { orders: rows.length, cents: rows.reduce((n, r) => n + r.collected_cents, 0) };
}

/** Confirm every new order at once (each customer gets the confirmation email). */
export async function confirmNew(by: string, req?: Request) {
  const rows = await sql`SELECT ref FROM orders WHERE status = 'received' AND NOT is_sample AND slot_date >= ${calgaryNow().date} ORDER BY slot_date`;
  for (const r of rows) await setStatus(r.ref, 'confirmed', by, req, true);
  return { confirmed: rows.length };
}


// ---------- packing (packers, helpers, owners) ----------
export async function packList(date: string) {
  const { lotsOn, lotsForLines } = await import('./production');
  const lots = await lotsOn(date);
  const rows = await sql`SELECT o.*, c.team_note FROM orders o LEFT JOIN customers c ON c.email = o.email WHERE o.slot_date = ${date} AND o.status <> 'cancelled' ORDER BY o.method DESC, o.slot_window, o.postal, o.id`;
  return Promise.all(rows.map(async o => {
    const its = await items(o.id);
    return { ref: o.ref, method: o.method, window: o.slot_window, name: o.gift ? o.gift_to : o.name, gift: o.gift ? { from: o.name, message: o.gift_message } : null, status: o.status,
      packed: o.packed_at ? { at: o.packed_at, by: o.packed_by } : null, notes: o.notes, customerNote: o.team_note ?? null, sample: Boolean(o.is_sample),
      items: its.map(i => ({ qty: i.qty, name: i.name_en, option: i.option_en })), lots: lotsForLines(lots, its.map(i => ({ product_id: i.product_id, option: i.option }))) };
  }));
}
/** Packed: pickup orders become "ready" (the customer gets the ready email); deliveries wait for the driver. */
export async function markPacked(s: Session, ref: string, req?: Request) {
  const o = await one`UPDATE orders SET packed_at = NOW(), packed_by = ${s.email} WHERE ref = ${ref} AND status IN ('received', 'confirmed', 'ready') RETURNING *`;
  if (!o) throw new HttpError(409, 'cannot-pack', 'This order is not waiting to be packed.');
  await event(o.id, 'packed', null, s.email);
  if (o.method === 'pickup' && o.status !== 'ready') await setStatus(ref, 'ready', s.email, req, true);
  return { ok: true };
}
