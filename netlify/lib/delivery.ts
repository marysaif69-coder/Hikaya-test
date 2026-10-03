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

export const guideText = () => [GUIDE.guide.title.en, ...GUIDE.guide.points.map((p, i) => `${i + 1}. ${p.t.en}`)].join('\n');
const day = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);

export async function member(email: string) {
  return one`SELECT id, email, role, name, phone, vehicle, status, agreed_at FROM team_members WHERE email = ${email}`;
}

/** First login of an invited driver: their details and agreeing to the guide. */
export async function onboard(s: Session, b: any) {
  const name = String(b?.name ?? '').trim().slice(0, 120), phone = String(b?.phone ?? '').trim().slice(0, 40), vehicle = String(b?.vehicle ?? '').trim().slice(0, 120);
  const fields: Record<string, string> = {};
  if (!name) fields.name = 'required';
  if (phone.replace(/\D/g, '').length < 10) fields.phone = 'phone';
  if (b?.agree !== true) fields.agree = 'required';
  if (Object.keys(fields).length) throw Object.assign(new HttpError(400, 'invalid', 'Fill in your name and phone, and tick that you have read the guide.'), { fields });
  const m = await one`UPDATE team_members SET name = ${name}, phone = ${phone}, vehicle = ${vehicle || null}, status = 'active', agreed_text = ${guideText()}, agreed_at = NOW()
    WHERE email = ${s.email} AND status <> 'off' RETURNING *`;
  if (!m) throw new HttpError(404, 'not-found', 'You are not on the team list.');
  for (const to of env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean))
    await send({ to, subject: `${name} has joined as a ${m.role}`, text: `${name} (${s.email}, ${phone}${vehicle ? `, ${vehicle}` : ''}) finished onboarding and agreed to the driver guide.`, html: `<p style="font:15px Arial,sans-serif">${name.replace(/[<>&]/g, '')} (${s.email}) finished onboarding and agreed to the driver guide.</p>`, kind: 'team-onboarded' });
  return m;
}

const stopShape = async (o: Row) => ({
  ref: o.ref, status: o.status, window: o.slot_window, day: day(o.slot_date), name: o.name, phone: o.phone, street: o.street, postal: o.postal, notes: o.notes,
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
    ORDER BY o.slot_window, o.postal, o.id`;
  return Promise.all(rows.map(stopShape));
}

async function myStop(s: Session, ref: string) {
  const o = await one`SELECT * FROM orders WHERE ref = ${ref} AND method = 'delivery'`;
  if (!o || (s.role === 'driver' && o.driver_email !== s.email)) throw new HttpError(404, 'not-found', 'That stop is not on your list.');
  return o;
}

/** Start route: every stop of mine for the day that hasn't left yet goes "out for delivery" (email). */
export async function startRoute(s: Session, date: string, req?: Request) {
  const rows = await sql`SELECT ref FROM orders WHERE slot_date = ${date} AND method = 'delivery' AND driver_email = ${s.email} AND status IN ('received', 'confirmed', 'ready') ORDER BY slot_window, postal`;
  for (const r of rows) {
    await setStatus(r.ref, 'out-for-delivery', s.email, req, true);
    await sql`UPDATE orders SET out_at = NOW() WHERE ref = ${r.ref}`;
  }
  return rows.length;
}

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
  return people.map(p => ({ id: p.id, email: p.email, role: p.role, name: p.name, phone: p.phone, vehicle: p.vehicle, status: p.status, agreedAt: p.agreed_at, week: p.week, month: p.month, cash: p.cash }));
}

export async function invite(b: any, by: string, siteUrl: string) {
  const email = String(b?.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'invalid', 'Check the email.');
  const role = b?.role === 'helper' ? 'helper' : 'driver';
  await sql`INSERT INTO team_members (email, role, name, invited_by) VALUES (${email}, ${role}, ${String(b?.name ?? '').trim().slice(0, 120) || null}, ${by})
    ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = CASE WHEN team_members.status = 'off' THEN 'invited' ELSE team_members.status END`;
  const link = role === 'driver' ? `${siteUrl}/admin/driver/` : `${siteUrl}/admin/`;
  const text = role === 'driver'
    ? `You've been added as a driver for Hikaya.\n\n1. Open ${link} on your phone.\n2. Log in with this email (${email}); we email you a 6-digit code. No password.\n3. Fill in your details and read the driver guide.\n4. Add it to your home screen: iPhone (Safari) Share → Add to Home Screen; Android (Chrome) menu → Install app.\n\nYour stops appear there on delivery days.`
    : `You've been added to the Hikaya team.\n\nOpen ${link} and log in with this email (${email}); we email you a 6-digit code. No password.`;
  await send({ to: email, subject: role === 'driver' ? 'You’re a Hikaya driver: set up the delivery app' : 'You’re on the Hikaya team', text, html: `<div style="font:15px/1.55 Arial,sans-serif">${text.replace(/[<>&]/g, '').replace(/\n/g, '<br>').replace(link, `<a href="${link}">${link}</a>`)}</div>`, kind: 'team-invite' });
  return { ok: true };
}

export async function setMember(id: number, b: any) {
  const status = ['active', 'off', 'invited'].includes(b?.status) ? b.status : null;
  const role = ['driver', 'helper'].includes(b?.role) ? b.role : null;
  const m = await one`UPDATE team_members SET status = COALESCE(${status}, status), role = COALESCE(${role}, role) WHERE id = ${id} RETURNING id`;
  if (!m) throw new HttpError(404, 'not-found');
  if (status === 'off') { const e = await one`SELECT email FROM team_members WHERE id = ${id}`; await sql`DELETE FROM sessions WHERE email = ${e!.email}`; }
  return { ok: true };
}

/** Everyone who can drive: drivers added in the desk, plus owners and helpers. */
export async function drivers() {
  const m = await sql`SELECT email, name FROM team_members WHERE role = 'driver' AND status <> 'off' ORDER BY name NULLS LAST, email`;
  const others = [...env('ADMIN_EMAILS').split(','), ...env('STAFF_EMAILS').split(',')].map((e: string) => e.trim().toLowerCase()).filter(Boolean);
  return [...m.map(x => ({ email: x.email, name: x.name || x.email })), ...others.filter(e => !m.some(x => x.email === e)).map(e => ({ email: e, name: e }))];
}

export async function assign(refs: string[], driver: string, by: string) {
  const ok = !driver || (await drivers()).some(d => d.email === driver);
  if (!ok) throw new HttpError(400, 'driver', 'That person is not a driver.');
  let n = 0;
  for (const ref of refs.slice(0, 200)) {
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

