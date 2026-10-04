// /api/admin/* — the team's order desk. Every route requires an admin session (ADMIN_EMAILS).
import { loadOverrides } from '../lib/business';
import type { Config } from '@netlify/functions';
import { json, fail, body, str, HttpError, siteUrl, env, sameOrigin } from '../lib/http';
import { cardEnabled, squareCheck } from '../lib/square';
import { listGiftCards, giftCardPaid, sellGiftCardHere } from '../lib/giftcards';
import { listCosts, saveCost, margins } from '../lib/costs';
import { today } from '../lib/today';
import { getVisibility, setVisibility, LIVE_DOMAIN } from '../lib/visibility';
import { listSubscriptions } from '../lib/subscriptions';
import { monthlyReport, sendMonthlyReport } from '../lib/report';
import { smsEnabled } from '../lib/sms';
import { teamList, drivers, cashToHandIn, invite, cashReceived, setMember, assign, confirmNew, payRates, savePayRates } from '../lib/delivery';
import { shiftsFrom, saveShift, deleteShift, assignShift, unassign, fixTimes, hours, hoursCsv } from '../lib/team';
import { listLots, addLot, usedUp, recall, supplies, saveSupply, lotsOn, lotsForLines } from '../lib/production';
import { saveLetter, listLetters, testLetter, sendLetter } from '../lib/letters';
import { checklists, saveChecklists, checklistLog, announce, announcements, deleteAnnouncement, backup, activity, logActivity } from '../lib/ops';
import { businessDetails, saveBusiness } from '../lib/business';
import { readContent, saveContent, type FileId } from '../lib/content';
import { requireTeam } from '../lib/auth';
import { sql, one } from '../lib/db';
import { getSettings, WINDOWS, calgaryNow, addDays } from '../lib/slots';
import { items, setStatus, setPayment, event, STATUSES, moveOrder, editOrder } from '../lib/orders';
import { readable } from '../lib/ask';
import { liveCatalog, saveProduct, getSeasons, saveSeasons } from '../lib/catalog';
import { savePromo, normCode } from '../lib/promos';
import { refundOrder, refundsFor } from '../lib/refunds';
import { createSamples, removeSamples } from '../lib/samples';
import { askStatus } from '../lib/ask-fallback';
import { askEnabled } from '../lib/ask';
import { weekSheet, weekStart } from '../lib/week';
import { sendBackInStock, waitingByProduct } from '../lib/alerts';
import { listStats, cupStats } from '../lib/list';
import { numbers } from '../lib/visits';
import { PRODUCTS, FAMILIES, fileCents } from '../../src/data/products';
import { send, ticketReply } from '../lib/email';

const day = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);
// The Netlify settings the owners still have to add, shown in Admin → Settings (see docs/settings-checklist.md).
const SETTINGS = [
  { group: 'Basics', name: 'ADMIN_EMAILS', secret: false, what: 'Owners: can do everything in the desk.', where: 'Owner emails, separated by commas.' },
  { group: 'Basics', name: 'PREVIEW_PASSWORD', secret: true, what: 'The code on the "Coming soon" screen.', where: 'Any code you choose.' },
  { group: 'Emails', name: 'RESEND_API_KEY', secret: true, what: 'Sends every email (orders, codes, reminders).', where: 'resend.com → API Keys.' },
  { group: 'Emails', name: 'EMAIL_FROM', secret: false, what: 'Who emails come from.', where: 'e.g. Hikaya <hello@hikayacoffee.ca> (domain verified in Resend).' },
  { group: 'Emails', name: 'EMAIL_REPLY_TO', secret: false, what: '(Or set it in Settings → Business details.) Where customer replies go.', where: 'e.g. hello@hikayacoffee.ca' },
  { group: 'Payments', name: 'ETRANSFER_EMAIL', secret: false, what: '(Or set it in Settings → Business details.) Where customers send Interac e-Transfers.', where: "Your bank's e-Transfer email." },
  { group: 'Payments', name: 'SQUARE_ACCESS_TOKEN', secret: true, what: 'Card payments and card refunds.', where: 'developer.squareup.com → your app → Credentials → Production → Access token.' },
  { group: 'Payments', name: 'SQUARE_LOCATION_ID', secret: false, what: 'Which Square location takes the money.', where: 'Same app → Locations.' },
  { group: 'Payments', name: 'SQUARE_ENV', secret: false, what: 'Live or test payments.', where: 'Type production (sandbox while testing).' },
  { group: 'Payments', name: 'SQUARE_WEBHOOK_SIGNATURE_KEY', secret: true, what: 'Marks card orders paid by themselves.', where: 'Same app → Webhooks → add the URL shown above for payment.updated → Signature key.' },
  { group: 'Text messages', name: 'TWILIO_ACCOUNT_SID', secret: false, what: 'Text-message reminders the evening before (for customers who tick the box).', where: 'twilio.com → Console → Account Info → Account SID.' },
  { group: 'Text messages', name: 'TWILIO_AUTH_TOKEN', secret: true, what: 'Lets the site send texts.', where: 'Same page → Auth Token.' },
  { group: 'Text messages', name: 'TWILIO_FROM', secret: false, what: 'The number texts come from.', where: 'Twilio → Phone Numbers → buy a Canadian (403/587) number, e.g. +15875550100.' },
  { group: 'Assistant', name: 'ANTHROPIC_API_KEY', secret: true, what: 'Turns on Ask Hikaya.', where: 'console.anthropic.com → API Keys.' },
  { group: 'Deliveries', name: 'GOOGLE_MAPS_API_KEY', secret: true, what: 'Shortest route for each driver, planned km and driving time; km counted by the app.', where: 'console.cloud.google.com → new project → enable "Routes API" → Credentials → API key (restrict it to Routes API). Free monthly allowance covers a small shop.' },
  { group: 'Deliveries', name: 'SHOP_ADDRESS', secret: false, what: '(Or set it in Settings → Business details.) Where routes start and end (the pickup address).', where: 'e.g. 123 Example St SW, Calgary, AB T2P 1J9' },
  { group: 'Extras', name: 'STAFF_EMAILS', secret: false, what: 'Helpers: orders, Inbox, sheets, Driver. No money or settings.', where: 'Helper emails, separated by commas.' },
  { group: 'Extras', name: 'GOOGLE_REVIEW_URL', secret: false, what: '(Or set it in Settings → Business details.) One "How was it?" email after a completed order.', where: 'Google Business Profile → Ask for reviews → copy link.' },
  { group: 'Extras', name: 'GITHUB_CONTENT_TOKEN', secret: true, what: 'Turns on saving in the Words tab.', where: 'GitHub → Settings → Developer settings → Fine-grained token, only Hikaya-test, Contents: read and write.' },
  { group: 'Launch day only', name: 'SITE_URL', secret: false, what: 'The address used in emails and links.', where: 'https://hikayacoffee.ca' },
  { group: 'Launch day only', name: 'SITE_PUBLIC', secret: false, what: 'Opens the site to everyone. Leave empty until launch.', where: 'Type true on launch day.' },
];

const summary = (o: any) => ({
  ref: o.ref, name: o.name, email: o.email, phone: o.phone, method: o.method, street: o.street, postal: o.postal,
  day: day(o.slot_date), window: o.slot_window, payment: o.payment, paymentStatus: o.payment_status, status: o.status,
  total: o.total_cents, paid: o.paid_cents ?? 0, lang: o.lang, notes: o.notes, created: o.created_at, items: o.items ?? null,
  discount: o.discount_cents ?? 0, promo: o.promo_code ?? null, refunded: o.refunded_cents ?? 0, sample: Boolean(o.is_sample),
  gift: o.gift ? { to: o.gift_to, phone: o.gift_phone, message: o.gift_message } : null,
  driver: o.driver_email ?? null, collected: o.collected_method ? { method: o.collected_method, cents: o.collected_cents, by: o.collected_by } : null,
});

// Every change made from the desk is written to the activity log (who, what, when).
export default async (req: Request) => {
  const bodyText = req.method === 'POST' ? await req.clone().text().catch(() => '') : '';
  const res = await handle(req);
  if (req.method === 'POST' && res.status < 400) {
    const s = await requireTeam(req).catch(() => null);
    if (s) await logActivity(s.email, req.method, new URL(req.url).pathname.replace('/api/admin/', ''), bodyText).catch(e => console.error('activity', e));
  }
  return res;
};

async function handle(req: Request) {
  try {
    await loadOverrides();
    if (req.method !== 'GET') sameOrigin(req); // also checked by body(); this covers actions without one
    const admin = await requireTeam(req);
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/api\/admin\/?/, '').split('/').filter(Boolean);
    // Helpers can read everything and run orders; money, catalog, settings and exports are owners only.
    if (admin.role !== 'admin') {
      const write = req.method !== 'GET';
      const ownersOnly = parts[0] === 'export.csv' || parts[0] === 'list.csv' || parts[0] === 'samples' || parts[0] === 'seasons' || parts[0] === 'promos' || parts[0] === 'report' || (parts[0] === 'team' && write) || parts[0] === 'recall.csv' || parts[0] === 'hours.csv' || parts[0] === 'letters' || parts[0] === 'business' || parts[0] === 'visibility' || parts[0] === 'costs' || parts[0] === 'margins' || parts[0] === 'backup.json' || parts[0] === 'activity' || (parts[0] === 'checklists' && write)
        // Gift card codes work at checkout like money, so helpers can't list them either.
        || parts[0] === 'giftcards'
        || (write && ['products', 'settings', 'ask', 'connections', 'content', 'report', 'pay'].includes(parts[0])) || (parts[0] === 'orders' && parts[2] === 'refund');
      if (ownersOnly) throw new HttpError(403, 'owners-only', 'Only the owners can do this.');
    }
    const q = (k: string, max = 40) => str(url.searchParams.get(k), max);

    // GET /api/admin/orders — filterable list
    if (parts[0] === 'orders' && parts.length === 1 && req.method === 'GET') {
      const sample = q('sample');
      const status = q('status'), method = q('method'), from = q('from', 10) || '1900-01-01', to = q('to', 10) || '2999-12-31', term = `%${q('q', 80).toLowerCase()}%`;
      const rows = await sql`SELECT o.*, COALESCE(json_agg(json_build_object('name', i.name_en, 'option', i.option_en, 'qty', i.qty) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
        FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
        WHERE (${status} = '' OR o.status = ${status}) AND (${method} = '' OR o.method = ${method})
          AND o.slot_date BETWEEN ${from} AND ${to}
          AND (${sample} = '' OR (${sample} = 'hide' AND NOT o.is_sample) OR (${sample} = 'only' AND o.is_sample))
          AND (${term} = '%%' OR LOWER(o.ref || ' ' || o.name || ' ' || o.email || ' ' || o.phone || ' ' || COALESCE(o.postal, '')) LIKE ${term})
        GROUP BY o.id ORDER BY o.slot_date, o.slot_window, o.created_at LIMIT 500`;
      // The totals follow the sample filter: all orders, real orders only, or sample orders only.
      const counts = await sql`SELECT status, COUNT(*)::int AS n FROM orders
        WHERE (${sample} = '' OR (${sample} = 'hide' AND NOT is_sample) OR (${sample} = 'only' AND is_sample)) GROUP BY status`;
      // Money still to come in: paid at pickup (normal), or e-Transfer/card not received yet (to chase).
      const owed = await sql`SELECT payment, COUNT(*)::int AS n, COALESCE(SUM(GREATEST(total_cents - paid_cents, 0)), 0)::int AS cents FROM orders WHERE payment_status = 'unpaid' AND status <> 'cancelled'
        AND (${sample} = '' OR (${sample} = 'hide' AND NOT is_sample) OR (${sample} = 'only' AND is_sample)) GROUP BY payment`;
      const sum = (rows: any[]) => ({ n: rows.reduce((a, r) => a + r.n, 0), cents: rows.reduce((a, r) => a + r.cents, 0) });
      const atPickup = sum(owed.filter(r => r.payment === 'at-pickup')), waiting = sum(owed.filter(r => r.payment !== 'at-pickup'));
      return json({ orders: rows.map(r => summary({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items })), counts: Object.fromEntries(counts.map(c => [c.status, c.n])), atPickup, waiting });
    }

    // GET /api/admin/orders/:ref — full order with history
    if (parts[0] === 'orders' && parts[1] && req.method === 'GET') {
      const o = await one`SELECT * FROM orders WHERE ref = ${parts[1]}`;
      if (!o) throw new HttpError(404, 'not-found');
      const events = await sql`SELECT e.kind, e.detail, COALESCE(m.name, e.actor) AS actor, e.created_at FROM order_events e LEFT JOIN team_members m ON m.email = e.actor AND m.shared
        WHERE e.order_id = ${o.id} ORDER BY e.created_at DESC`;
      const emails = await sql`SELECT to_email, subject, status, created_at FROM email_log WHERE order_id = ${o.id} ORDER BY created_at DESC`;
      const cust = await one`SELECT id, team_note FROM customers WHERE email = ${o.email}`;
      const paid = o.payment_status === 'paid' || o.payment_status === 'partly-refunded';
      // Gift card and store-credit codes are spendable, so helpers only see that one was used.
      const owner = admin.role === 'admin';
      const hide = (t: string) => owner ? t : t.replace(/\b(GIFT|CREDIT)-[A-Z0-9]+/g, '$1-…');
      const refunds = (await refundsFor(o.id)).map(r => owner ? r : { ...r, credit_code: r.credit_code ? hide(r.credit_code) : null });
      return json({ customer: cust ? { id: cust.id, note: cust.team_note } : null, order: { ...summary(o), giftCard: o.gift_card_cents ?? 0, giftCardCode: o.gift_card_code ? hide(o.gift_card_code) : null, regular: Boolean(o.subscription_id), sms: Boolean(o.sms_ok), subtotal: o.subtotal_cents, delivery: o.delivery_cents, items: await items(o.id), refundable: paid ? Math.max((o.paid_cents ?? 0) - o.refunded_cents, 0) : 0, paidByCard: Boolean(o.square_payment_id) }, events: events.map(e => ({ ...e, detail: e.detail ? hide(e.detail) : e.detail })), emails, refunds });
    }

    // POST /api/admin/orders/:ref/move — another day or time; force skips the deadline and capacity checks
    if (parts[0] === 'orders' && parts[1] && parts[2] === 'move' && req.method === 'POST') {
      const b = await body(req);
      const o = await moveOrder(parts[1], str(b.day, 10), str(b.window, 20), admin.email, req, { force: b.force === true });
      return json({ ok: true, day: day(o.slot_date), window: o.slot_window });
    }

    // POST /api/admin/orders/:ref/items — change what is in the order
    if (parts[0] === 'orders' && parts[1] && parts[2] === 'items' && req.method === 'POST') {
      const b = await body(req);
      const r = await editOrder(parts[1], b.lines, admin.email, req, b.notify !== false);
      return json({ ok: true, total: r.order.total_cents, balance: r.balance });
    }

    // POST /api/admin/orders/:ref/refund
    if (parts[0] === 'orders' && parts[1] && parts[2] === 'refund' && req.method === 'POST') {
      return json(await refundOrder(parts[1], await body(req), admin.email, req));
    }
    // POST /api/admin/orders/:ref — change status / payment / add a note / mark as sample
    if (parts[0] === 'orders' && parts[1] && req.method === 'POST') {
      const b = await body(req);
      let o: any = null;
      if (typeof b.sample === 'boolean' && admin.role === 'admin') {
        o = await one`UPDATE orders SET is_sample = ${b.sample} WHERE ref = ${parts[1]} RETURNING *`;
        if (!o) throw new HttpError(404, 'not-found');
        await event(o.id, 'note', b.sample ? 'Marked as a sample order' : 'Marked as a real order', admin.email);
      }
      if (b.status) o = await setStatus(parts[1], str(b.status, 30), admin.email, req, b.notify !== false);
      if (b.paymentStatus) o = await setPayment(parts[1], str(b.paymentStatus, 20), admin.email);
      if (b.note) {
        o = o ?? await one`SELECT * FROM orders WHERE ref = ${parts[1]}`;
        if (!o) throw new HttpError(404, 'not-found');
        await event(o.id, 'note', str(b.note, 1000), admin.email);
      }
      if (!o) throw new HttpError(400, 'nothing');
      return json({ ok: true });
    }

    // GET /api/admin/day?date= — the day sheet: pickups by window, deliveries by area, what to pack
    if (parts[0] === 'day' && req.method === 'GET') {
      const date = q('date', 10) || calgaryNow().date;
      const rows = await sql`SELECT * FROM orders WHERE slot_date = ${date} AND status <> 'cancelled' ORDER BY slot_window, postal, created_at`;
      const pack = await sql`SELECT i.name_en, COALESCE(i.option_en, '') AS option, SUM(i.qty)::int AS qty FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE o.slot_date = ${date} AND o.status <> 'cancelled' GROUP BY 1, 2 ORDER BY 1, 2`;
      const notes = new Map((await sql`SELECT email, team_note FROM customers WHERE team_note IS NOT NULL AND email IN (SELECT email FROM orders WHERE slot_date = ${date})`).map(c => [c.email, c.team_note]));
      const lotsDay = await lotsOn(date);
      const withItems = await Promise.all(rows.map(async r => ({ ...summary({ ...r, items: await items(r.id) }), lots: lotsForLines(lotsDay, (await items(r.id)).map(i => ({ product_id: i.product_id, option: i.option }))), customerNote: notes.get(r.email) ?? null, giftCard: r.gift_card_cents ?? 0, subtotal: r.subtotal_cents, delivery: r.delivery_cents })));
      return json({
        date,
        pickups: WINDOWS.map(w => ({ window: w, orders: withItems.filter(o => o.method === 'pickup' && o.window === w) })),
        deliveries: withItems.filter(o => o.method === 'delivery').sort((a, b) => String(a.postal).localeCompare(String(b.postal))),
        pack,
      });
    }

    // Settings: capacity per window, the open/paused switch, the order-by deadline and closed days
    if (parts[0] === 'settings') {
      if (req.method === 'POST') {
        const b = await body(req);
        const cur = await getSettings();
        const capacity = { pickup: clamp(b.capacity?.pickup, cur.capacity.pickup), delivery: clamp(b.capacity?.delivery, cur.capacity.delivery) };
        const ordering = {
          ...cur.ordering,
          open: typeof b.open === 'boolean' ? b.open : cur.ordering.open,
          autoConfirm: typeof b.autoConfirm === 'boolean' ? b.autoConfirm : Boolean(cur.ordering.autoConfirm),
          cutoffMode: b.cutoffMode === 'weekly' || b.cutoffMode === 'day-before' ? b.cutoffMode : cur.ordering.cutoffMode,
          cutoffWeekday: Number.isInteger(b.cutoffWeekday) && b.cutoffWeekday >= 0 && b.cutoffWeekday <= 6 ? b.cutoffWeekday : cur.ordering.cutoffWeekday,
          cutoffHour: Number.isInteger(b.cutoffHour) && b.cutoffHour >= 0 && b.cutoffHour <= 23 ? b.cutoffHour : cur.ordering.cutoffHour,
          firstDay: typeof b.firstDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.firstDay) ? b.firstDay : cur.ordering.firstDay,
          closedDates: Array.isArray(b.closedDates) ? [...new Set(b.closedDates.filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(0, 100) : cur.ordering.closedDates,
        };
        await sql`INSERT INTO settings (key, value) VALUES ('capacity', ${JSON.stringify(capacity)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
        await sql`INSERT INTO settings (key, value) VALUES ('ordering', ${JSON.stringify(ordering)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
        if (b.caps && typeof b.caps === 'object') {
          const n = (v: unknown) => (v === null || v === '' || v === undefined ? null : Math.max(0, Math.min(10000, Math.round(Number(v)) || 0)) || null);
          const caps = { dailyOrders: n(b.caps.dailyOrders), giftBoxesPerDay: n(b.caps.giftBoxesPerDay), stopsPerDriver: n(b.caps.stopsPerDriver), deliveryFromShifts: b.caps.deliveryFromShifts === true };
          await sql`INSERT INTO settings (key, value) VALUES ('caps', ${JSON.stringify(caps)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
        }
      }
      return json(await getSettings());
    }

    // GET /api/admin/week?from=&sample= — the weekly roast and pack sheet
    if (parts[0] === 'week' && req.method === 'GET') {
      const sample = q('sample') as '' | 'hide' | 'only';
      return json(await weekSheet(/^\d{4}-\d{2}-\d{2}$/.test(q('from', 10)) ? q('from', 10) : weekStart(), ['', 'hide', 'only'].includes(sample) ? sample : 'hide'));
    }

    // ---------- connections: email, card payments, assistant ----------
    if (parts[0] === 'connections' && req.method === 'GET') {
      const last = await one`SELECT to_email, subject, status, error, created_at FROM email_log ORDER BY id DESC LIMIT 1`;
      const failed = await one`SELECT COUNT(*)::int AS n FROM email_log WHERE status = 'failed' AND created_at > NOW() - INTERVAL '7 days'`;
      return json({
        email: { key: Boolean(env('RESEND_API_KEY')), from: env('EMAIL_FROM') || 'Hikaya <orders@hikayacoffee.ca>', replyTo: env('EMAIL_REPLY_TO') || null, last, failedThisWeek: failed?.n ?? 0, team: env('ADMIN_EMAILS') },
        square: { enabled: cardEnabled(), env: env('SQUARE_ENV') || 'sandbox', webhook: Boolean(env('SQUARE_WEBHOOK_SIGNATURE_KEY')), webhookUrl: `${siteUrl(req)}/api/square/webhook` },
        ask: { enabled: askEnabled() },
        sms: { enabled: smsEnabled() },
        etransfer: env('ETRANSFER_EMAIL') || null,
        // Which Netlify settings exist. Only yes/no: values never leave the server.
        checklist: admin.role === 'admin' ? SETTINGS.map(x => ({ ...x, set: Boolean(env(x.name)) })) : [],
        business: { pickupAddress: env('PICKUP_ADDRESS') || null },
      });
    }
    if (parts[0] === 'connections' && parts[1] === 'test-email' && req.method === 'POST') {
      const status = await send({ to: admin.login, subject: 'Hikaya test email · رسالة تجريبية', text: 'If you can read this, order emails are working.\n\nإن وصلتك هذه الرسالة فرسائل الطلبات تعمل.', html: '<p>If you can read this, order emails are working.</p><p dir="rtl">إن وصلتك هذه الرسالة فرسائل الطلبات تعمل.</p>', kind: 'test' });
      const row = await one`SELECT error FROM email_log ORDER BY id DESC LIMIT 1`;
      return json({ status, to: admin.login, error: row?.error ?? null });
    }
    if (parts[0] === 'connections' && parts[1] === 'test-square' && req.method === 'POST') {
      return json(await squareCheck());
    }

    // ---------- products: prices, shown on the site, sold out, stock ----------
    if (parts[0] === 'products' && !parts[1] && req.method === 'GET') {
      const [live, waiting] = await Promise.all([liveCatalog(), waitingByProduct()]);
      return json({ seasons: await getSeasons(), products: PRODUCTS.map(p => ({
        id: p.id, name: p.name, kind: p.kind, family: FAMILIES[p.fam].name.en + (p.kind === 'coffee' ? ' · base bag' : p.kind === 'pack' ? ' · pack' : p.kind === 'kit' ? (p.discovery ? ' · discovery pack' : ' · style: bag + packs') : ''), defaultPrice: fileCents(p), ...live[p.id], waiting: waiting[p.id] ?? 0,
      })) });
    }
    if (parts[0] === 'products' && parts[1] && req.method === 'POST') {
      const b = await body(req);
      const cents = (v: unknown) => (v === null || v === '' ? null : Math.round(Number(v)));
      await saveProduct(parts[1], {
        ...(b.price_cents !== undefined ? { price_cents: cents(b.price_cents) } : {}),
        ...(typeof b.visible === 'boolean' ? { visible: b.visible } : {}),
        ...(typeof b.available === 'boolean' ? { available: b.available } : {}),
        ...(b.stock !== undefined ? { stock: b.stock === null || b.stock === '' ? null : Math.round(Number(b.stock)) } : {}),
        ...(b.daily_cap !== undefined ? { daily_cap: b.daily_cap === null || b.daily_cap === '' ? null : Math.round(Number(b.daily_cap)) } : {}),
      }, admin.email);
      return json({ ok: true, told: await sendBackInStock(req) });
    }
    if (parts[0] === 'seasons' && req.method === 'POST') {
      const v = await saveSeasons(await body(req));
      return json({ ...v, told: await sendBackInStock(req) });
    }

    // ---------- words: recipes and product text (saved to GitHub, the site rebuilds) ----------
    if (parts[0] === 'content' && parts[1] && req.method === 'GET') return json(await readContent(parts[1] as FileId));
    if (parts[0] === 'content' && parts[1] && req.method === 'POST') {
      const b = await body(req, 200_000);
      return json(await saveContent(parts[1] as FileId, b.data, str(b.sha, 64), admin.email));
    }

    // ---------- drivers: the team, assignments, cash ----------
    if (parts[0] === 'team' && !parts[1] && req.method === 'GET') return json({ team: await teamList(), drivers: await drivers(), cash: await cashToHandIn() });
    if (parts[0] === 'team' && !parts[1] && req.method === 'POST') return json(await invite(await body(req), admin.email, siteUrl(req), admin.login));
    if (parts[0] === 'team' && parts[1] === 'cash' && req.method === 'POST') return json(await cashReceived(str((await body(req)).driver, 254), admin.email));
    if (parts[0] === 'team' && parts[1] && parts[2] === 'resend' && req.method === 'POST') {
      // Pass the stored flags too: invite() saves what it is given, so leaving them out would
      // switch off "Also drives" and "Volunteer".
      const m = await one`SELECT email, role, name, volunteer, drives, shared, login_email FROM team_members WHERE id = ${Number(parts[1]) || 0}`;
      if (!m) throw new HttpError(404, 'not-found');
      // Someone on the shared login keeps that login (not the login of whoever presses resend).
      return json(await invite(m, admin.email, siteUrl(req), m.shared ? m.login_email : admin.email));
    }
    if (parts[0] === 'team' && parts[1] && req.method === 'POST') return json(await setMember(Number(parts[1]) || 0, await body(req)));
    if (parts[0] === 'pay' && req.method === 'GET') return json(await payRates());
    if (parts[0] === 'pay' && req.method === 'POST') return json(await savePayRates(await body(req)));
    if (parts[0] === 'assign' && req.method === 'POST') {
      const b = await body(req);
      return json(await assign(Array.isArray(b.refs) ? b.refs.map((r: unknown) => str(r, 12)) : [], str(b.driver, 254).toLowerCase(), admin.email));
    }
    if (parts[0] === 'confirm-new' && req.method === 'POST') return json(await confirmNew(admin.email, req));

    // ---------- shifts and hours ----------
    if (parts[0] === 'shifts' && !parts[1] && req.method === 'GET') return json({ shifts: await shiftsFrom(/^\d{4}-\d{2}-\d{2}$/.test(q('from', 10)) ? q('from', 10) : calgaryNow().date, 120) });
    if (parts[0] === 'shifts' && !parts[1] && req.method === 'POST') return json(await saveShift(await body(req), admin.email));
    if (parts[0] === 'shifts' && parts[1] && req.method === 'POST') {
      const id = Number(parts[1]) || 0, b = await body(req);
      if (parts[2] === 'delete') return json(await deleteShift(id));
      if (parts[2] === 'assign') return json(await assignShift(id, str(b.email, 254).toLowerCase(), admin.email));
      if (parts[2] === 'unassign') return json(await unassign(id, str(b.email, 254).toLowerCase()));
      if (parts[2] === 'times') return json(await fixTimes(id, str(b.email, 254).toLowerCase(), b));
    }
    if ((parts[0] === 'hours' || parts[0] === 'hours.csv') && req.method === 'GET') {
      const today = calgaryNow().date;
      const h = await hours(/^\d{4}-\d{2}-\d{2}$/.test(q('from', 10)) ? q('from', 10) : today.slice(0, 8) + '01', /^\d{4}-\d{2}-\d{2}$/.test(q('to', 10)) ? q('to', 10) : today, q('email', 254) || undefined);
      if (parts[0] === 'hours') return json(h);
      return new Response(hoursCsv(h), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="hikaya-hours-${h.from}-to-${h.to}.csv"`, 'cache-control': 'no-store' } });
    }

    // ---------- production: lots, recall, supplies ----------
    if (parts[0] === 'lots' && !parts[1] && req.method === 'GET') return json({ lots: await listLots() });
    if (parts[0] === 'lots' && !parts[1] && req.method === 'POST') return json(await addLot(await body(req), admin.email));
    if (parts[0] === 'lots' && parts[1] && parts[2] === 'used' && req.method === 'POST') return json(await usedUp(parts[1], (await body(req)).on));
    if ((parts[0] === 'recall' || parts[0] === 'recall.csv') && req.method === 'GET') {
      const r = await recall(q('code', 40));
      if (parts[0] === 'recall') return json(r);
      const cell = (v: unknown) => { const x = String(v ?? ''); return /^[=+\-@]/.test(x) ? `'${x}` : /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
      return new Response(['order,name,email,phone,day,method,status', ...r.orders.map(o => [o.ref, o.name, o.email, o.phone, o.day, o.method, o.status].map(cell).join(','))].join('\n'),
        { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="hikaya-recall-${r.lot.code}.csv"`, 'cache-control': 'no-store' } });
    }
    if (parts[0] === 'supplies' && req.method === 'GET') return json({ supplies: await supplies(/^\d{4}-\d{2}-\d{2}$/.test(q('from', 10)) ? q('from', 10) : weekStart()) });
    if (parts[0] === 'supplies' && parts[1] && req.method === 'POST') return json(await saveSupply(parts[1], await body(req), admin.email));

    // ---------- customers ----------
    if (parts[0] === 'customers' && !parts[1] && req.method === 'GET') {
      const term = `%${q('q', 80).toLowerCase()}%`;
      const rows = await sql`SELECT c.id, c.email, c.name, c.phone, c.team_note, c.created_at,
          COUNT(o.id) FILTER (WHERE o.status <> 'cancelled')::int AS orders,
          COALESCE(SUM(o.total_cents + o.gift_card_cents - GREATEST(o.refunded_cents - GREATEST(o.paid_cents - o.total_cents, 0), 0)) FILTER (WHERE o.status <> 'cancelled'), 0)::int AS spent,
          MAX(o.slot_date)::text AS last_day,
          (SELECT COUNT(*)::int FROM subscriptions s WHERE s.email = c.email AND s.status = 'active') AS regular,
          EXISTS (SELECT 1 FROM subscribers l WHERE l.email = c.email AND l.confirmed_at IS NOT NULL AND l.unsubscribed_at IS NULL) AS on_list
        FROM customers c LEFT JOIN orders o ON o.email = c.email AND NOT o.is_sample
        WHERE c.email NOT LIKE '%.sample@example.com' AND (${term} = '%%' OR lower(c.email) LIKE ${term} OR lower(c.name) LIKE ${term} OR c.phone LIKE ${term})
        GROUP BY c.id ORDER BY MAX(o.created_at) DESC NULLS LAST, c.id DESC LIMIT 300`;
      return json({ customers: rows });
    }
    if (parts[0] === 'customers' && parts[1] && req.method === 'GET') {
      const c = await one`SELECT id, email, name, phone, lang, team_note, team_note_by, team_note_at, created_at FROM customers WHERE id = ${Number(parts[1]) || 0}`;
      if (!c) throw new HttpError(404, 'not-found');
      const ords = await sql`SELECT ref, slot_date, slot_window, method, status, payment_status, total_cents, gift_card_cents, is_sample FROM orders WHERE email = ${c.email} ORDER BY created_at DESC LIMIT 100`;
      const subs = await sql`SELECT every_weeks, next_date::text AS next, status FROM subscriptions WHERE email = ${c.email} AND status <> 'stopped'`;
      const tickets = await sql`SELECT id, kind, status, created_at FROM tickets WHERE email = ${c.email} ORDER BY created_at DESC LIMIT 20`;
      return json({ customer: c, orders: ords.map(o => ({ ref: o.ref, day: day(o.slot_date), window: o.slot_window, method: o.method, status: o.status, paymentStatus: o.payment_status, total: o.total_cents + o.gift_card_cents, sample: o.is_sample })), subscriptions: subs, tickets });
    }
    if (parts[0] === 'customers' && parts[1] && req.method === 'POST') {
      const b = await body(req);
      const c = await one`UPDATE customers SET team_note = ${str(b.note, 2000) || null}, team_note_by = ${admin.email}, team_note_at = NOW() WHERE id = ${Number(parts[1]) || 0} RETURNING id`;
      if (!c) throw new HttpError(404, 'not-found');
      return json({ ok: true });
    }

    // ---------- gift cards ----------
    if (parts[0] === 'giftcards' && !parts[1] && req.method === 'GET') return json({ giftcards: await listGiftCards() });
    if (parts[0] === 'giftcards' && parts[1] && parts[2] === 'paid' && req.method === 'POST') {
      const g = await giftCardPaid(parts[1], req);
      return json({ ok: true, sentTo: g.to_email || g.buyer_email, emailStatus: g.emailStatus });
    }
    if (parts[0] === 'giftcards' && parts[1] === 'sell' && req.method === 'POST') return json(await sellGiftCardHere(await body(req), admin.as?.name ?? admin.email, req));

    // ---------- costs and margins (owners) ----------
    if (parts[0] === 'costs' && req.method === 'GET') return json({ costs: await listCosts() });
    if (parts[0] === 'costs' && parts[1] && req.method === 'POST') { await saveCost(parts[1], (await body(req)).cost_cents, admin.email); return json({ ok: true }); }
    if (parts[0] === 'margins' && req.method === 'GET') return json(await margins(q('from', 10), q('to', 10)));

    // ---------- regular orders ----------
    if (parts[0] === 'subscriptions' && req.method === 'GET') return json({ subscriptions: await listSubscriptions() });

    // ---------- monthly report: preview, or send it now ----------
    if (parts[0] === 'report' && req.method === 'GET') {
      const r = await monthlyReport(q('month', 7) && /^\d{4}-\d{2}$/.test(q('month', 7)) ? `${q('month', 7)}-01` : calgaryNow().date);
      return json({ month: r.month, name: r.name, html: r.html });
    }
    if (parts[0] === 'report' && req.method === 'POST') return json({ sent: await sendMonthlyReport(calgaryNow().date, true) });

    // ---------- business details (owners) ----------
    if (parts[0] === 'business' && req.method === 'GET') return json(await businessDetails());
    if (parts[0] === 'business' && req.method === 'POST') return json(await saveBusiness(await body(req)));

    // ---------- food safety, announcements, backup, activity ----------
    if (parts[0] === 'checklists' && req.method === 'GET') {
      const today = calgaryNow().date;
      return json({ checklists: await checklists(), log: await checklistLog(/^\d{4}-\d{2}-\d{2}$/.test(q('from', 10)) ? q('from', 10) : addDays(today, -30), /^\d{4}-\d{2}-\d{2}$/.test(q('to', 10)) ? q('to', 10) : today) });
    }
    if (parts[0] === 'checklists' && req.method === 'POST') return json(await saveChecklists((await body(req)).checklists));
    if (parts[0] === 'announce' && req.method === 'GET') return json({ announcements: await announcements(30) });
    if (parts[0] === 'announce' && !parts[1] && req.method === 'POST') { const b = await body(req); return json(await announce(b.body, b.email === true, admin.email, req)); }
    if (parts[0] === 'announce' && parts[1] && parts[2] === 'delete' && req.method === 'POST') return json(await deleteAnnouncement(Number(parts[1]) || 0));
    if (parts[0] === 'backup.json' && req.method === 'GET') {
      return new Response(JSON.stringify(await backup()), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="hikaya-backup-${calgaryNow().date}.json"`, 'cache-control': 'no-store' } });
    }
    if (parts[0] === 'activity' && req.method === 'GET') return json({ activity: await activity(300) });

    // ---------- letters to the mailing list ----------
    if (parts[0] === 'letters' && !parts[1] && req.method === 'GET') return json({ letters: await listLetters() });
    if (parts[0] === 'letters' && req.method === 'POST') {
      const b = await body(req, 60_000);
      if (!parts[1]) return json(await saveLetter(null, b, admin.email));
      const id = Number(parts[1]) || 0;
      if (parts[2] === 'test') return json(await testLetter(id, admin.login, req));
      if (parts[2] === 'send') return json(await sendLetter(id, req));
      return json(await saveLetter(id, b, admin.email));
    }

    // ---------- mailing list ----------
    if (parts[0] === 'list' && req.method === 'GET') return json({ ...(await listStats()), cups: await cupStats() });
    if (parts[0] === 'list.csv' && req.method === 'GET') {
      const rows = await sql`SELECT email, lang, source, consent_at, confirmed_at, consent_text FROM subscribers WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL ORDER BY confirmed_at`;
      const cell = (v: unknown) => { const t = v instanceof Date ? v.toISOString() : String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const out = ['email,language,source,consented_at,confirmed_at,consent_wording', ...rows.map(r => [r.email, r.lang, r.source, r.consent_at, r.confirmed_at, r.consent_text].map(cell).join(','))].join('\n');
      return new Response(out, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="hikaya-mailing-list.csv"', 'cache-control': 'no-store' } });
    }

    // ---------- numbers: visits and sales ----------
    if (parts[0] === 'numbers' && req.method === 'GET') return json(await numbers(30));
    if (parts[0] === 'today' && req.method === 'GET') return json(await today(admin.role));
    if (parts[0] === 'visibility' && req.method === 'GET') return json({ ...(await getVisibility()), domain: LIVE_DOMAIN, forcedOpen: env('SITE_PUBLIC').toLowerCase() === 'true' });
    if (parts[0] === 'visibility' && req.method === 'POST') return json(await setVisibility(await body(req), admin.as?.name ?? admin.email, req));
    // ---------- quick search (header): orders, customers, messages ----------
    if (parts[0] === 'search' && req.method === 'GET') {
      const raw = q('q', 80).toLowerCase();
      if (raw.length < 2) return json({ orders: [], customers: [], tickets: [] });
      const term = `%${raw}%`, digits = raw.replace(/\D/g, ''), dterm = digits.length >= 3 ? `%${digits}%` : '-';
      const [orders, customers, tickets] = await Promise.all([
        sql`SELECT ref, name, status, method, slot_date::text AS day, total_cents FROM orders
          WHERE LOWER(ref || ' ' || name || ' ' || email || ' ' || COALESCE(postal, '')) LIKE ${term} OR regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${dterm}
          ORDER BY created_at DESC LIMIT 8`,
        sql`SELECT id, name, email, phone FROM customers WHERE email NOT LIKE '%.sample@example.com'
          AND (LOWER(email) LIKE ${term} OR LOWER(COALESCE(name, '')) LIKE ${term} OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE ${dterm}) ORDER BY id DESC LIMIT 5`,
        sql`SELECT ref, name, email, status, kind FROM tickets WHERE LOWER(ref || ' ' || COALESCE(name, '') || ' ' || email) LIKE ${term} ORDER BY created_at DESC LIMIT 4`,
      ]);
      return json({ orders, customers, tickets });
    }

    // ---------- promo codes ----------
    if (parts[0] === 'promos' && !parts[1] && req.method === 'GET') {
      return json({ promos: await sql`SELECT p.*, (SELECT COALESCE(SUM(discount_cents), 0)::int FROM orders o WHERE o.promo_code = p.code AND o.status <> 'cancelled') AS given_cents
        FROM promo_codes p ORDER BY p.active DESC, p.created_at DESC LIMIT 300` });
    }
    if (parts[0] === 'promos' && !parts[1] && req.method === 'POST') return json({ code: await savePromo(await body(req), admin.email) });
    if (parts[0] === 'promos' && parts[1] && req.method === 'POST') {
      const b = await body(req);
      await sql`UPDATE promo_codes SET active = ${b.active === true} WHERE code = ${normCode(parts[1])}`;
      return json({ ok: true });
    }

    // ---------- sample orders ----------
    if (parts[0] === 'samples' && req.method === 'POST') {
      const b = await body(req);
      if (b.action === 'remove') return json(await removeSamples());
      return json(await createSamples(admin.email));
    }

    // ---------- Ask Hikaya: status and team answers ----------
    if (parts[0] === 'ask' && !parts[1] && req.method === 'GET') {
      const stats = await one`SELECT COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days')::int AS week,
          COUNT(*) FILTER (WHERE rating = 'down')::int AS unhelpful, COUNT(*) FILTER (WHERE rating = 'up')::int AS helpful,
          COUNT(*) FILTER (WHERE handed_off)::int AS handed FROM chats WHERE turns > 0`;
      const notes = await sql`SELECT id, question, answer, active, created_by, updated_at FROM ask_notes ORDER BY active DESC, updated_at DESC`;
      return json({ enabled: askEnabled(), status: await askStatus(), stats, notes });
    }
    if (parts[0] === 'ask' && parts[1] === 'notes' && req.method === 'POST') {
      const b = await body(req);
      const question = str(b.question, 500), answer = str(b.answer, 2000);
      const id = Number(parts[2]) || 0;
      if (b.delete && id) { await sql`DELETE FROM ask_notes WHERE id = ${id}`; return json({ ok: true }); }
      if (id && typeof b.active === 'boolean' && !question) { await sql`UPDATE ask_notes SET active = ${b.active}, updated_at = NOW() WHERE id = ${id}`; return json({ ok: true }); }
      if (!question || !answer) throw new HttpError(400, 'required', 'Write the question and the answer.');
      if (id) await sql`UPDATE ask_notes SET question = ${question}, answer = ${answer}, updated_at = NOW() WHERE id = ${id}`;
      else await sql`INSERT INTO ask_notes (question, answer, from_chat, created_by) VALUES (${question}, ${answer}, ${Number(b.fromChat) || null}, ${admin.email})`;
      return json({ ok: true });
    }

    // CSV export for the accountant or a spreadsheet
    if (parts[0] === 'export.csv' && req.method === 'GET') {
      const from = q('from', 10) || '1900-01-01', to = q('to', 10) || '2999-12-31';
      const rows = await sql`SELECT o.ref, o.created_at, o.slot_date, o.slot_window, o.method, o.status, o.payment, o.payment_status, o.name, o.email, o.phone, o.street, o.postal,
          o.subtotal_cents, o.delivery_cents, o.discount_cents, o.promo_code, o.total_cents, o.refunded_cents, o.paid_cents, STRING_AGG(i.qty || ' x ' || i.name_en || COALESCE(' (' || i.option_en || ')', ''), '; ' ORDER BY i.id) AS items
        FROM orders o LEFT JOIN order_items i ON i.order_id = o.id WHERE o.slot_date BETWEEN ${from} AND ${to} AND NOT o.is_sample GROUP BY o.id ORDER BY o.slot_date, o.slot_window`;
      const head = ['ref', 'placed', 'day', 'window', 'method', 'status', 'payment', 'paid', 'name', 'email', 'phone', 'street', 'postal', 'subtotal', 'delivery', 'discount', 'promo', 'total', 'refunded', 'items', 'paid_in'];
      // Customer text that starts like a formula (=, +, -, @) is prefixed so Excel shows it as text.
      const cell = (v: unknown) => { let s = v instanceof Date ? v.toISOString() : String(v ?? ''); if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = rows.map(r => [r.ref, r.created_at, day(r.slot_date), r.slot_window, r.method, r.status, r.payment, r.payment_status, r.name, r.email, r.phone, r.street, r.postal,
        (r.subtotal_cents / 100).toFixed(2), (r.delivery_cents / 100).toFixed(2), (r.discount_cents / 100).toFixed(2), r.promo_code, (r.total_cents / 100).toFixed(2), (r.refunded_cents / 100).toFixed(2), r.items, (r.paid_cents / 100).toFixed(2)].map(cell).join(','));
      return new Response([head.join(','), ...lines].join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="hikaya-orders-${from}-${to}.csv"`, 'cache-control': 'no-store' } });
    }

    // ---------- Inbox: help requests and Ask Hikaya conversations ----------
    if (parts[0] === 'tickets' && parts.length === 1 && req.method === 'GET') {
      const status = q('status');
      const rows = await sql`SELECT t.id, t.ref, t.kind, t.status, t.source, t.lang, t.name, t.email, t.order_ref, t.summary, t.created_at, t.updated_at,
          (SELECT COUNT(*)::int FROM ticket_photos p WHERE p.ticket_id = t.id) AS photos
        FROM tickets t WHERE (${status} = '' OR t.status = ${status}) ORDER BY (t.status = 'resolved'), t.created_at DESC LIMIT 300`;
      const counts = await sql`SELECT status, COUNT(*)::int AS n FROM tickets GROUP BY status`;
      return json({ tickets: rows, counts: Object.fromEntries(counts.map(c => [c.status, c.n])) });
    }
    if (parts[0] === 'tickets' && parts[1] && req.method === 'GET') {
      const t = await one`SELECT * FROM tickets WHERE ref = ${parts[1]}`;
      if (!t) throw new HttpError(404, 'not-found');
      const notes = await sql`SELECT kind, body, actor, created_at FROM ticket_notes WHERE ticket_id = ${t.id} ORDER BY created_at`;
      const photos = await sql`SELECT id FROM ticket_photos WHERE ticket_id = ${t.id} ORDER BY id`;
      const chat = t.chat_id ? await one`SELECT messages FROM chats WHERE id = ${t.chat_id}` : null;
      const order = t.order_ref ? await one`SELECT ref, status, method, slot_date, slot_window, total_cents, email FROM orders WHERE ref = ${t.order_ref}` : null;
      const { upload_token_hash, ...pub } = t;
      return json({ ticket: pub, notes, photos: photos.map(p => p.id), transcript: chat ? readable(typeof chat.messages === 'string' ? JSON.parse(chat.messages) : chat.messages) : null,
        order: order ? { ...order, day: day(order.slot_date), emailMatches: order.email === t.email } : null });
    }
    if (parts[0] === 'tickets' && parts[1] && req.method === 'POST') {
      const b = await body(req);
      const t = await one`SELECT * FROM tickets WHERE ref = ${parts[1]}`;
      if (!t) throw new HttpError(404, 'not-found');
      if (b.reply) {
        const msg = str(b.reply, 5000);
        const status = await send(ticketReply(t as any, msg, siteUrl(req)));
        await sql`INSERT INTO ticket_notes (ticket_id, kind, body, actor) VALUES (${t.id}, 'reply', ${msg + (status === 'sent' ? '' : `\n[email ${status}]`)}, ${admin.email})`;
        if (t.status === 'open') await sql`UPDATE tickets SET status = 'waiting' WHERE id = ${t.id}`;
      }
      if (b.note) await sql`INSERT INTO ticket_notes (ticket_id, kind, body, actor) VALUES (${t.id}, 'note', ${str(b.note, 2000)}, ${admin.email})`;
      if (b.status && ['open', 'waiting', 'resolved'].includes(b.status)) {
        const resolution = ['refund', 'replacement', 'credit', 'answered', 'none'].includes(b.resolution) ? b.resolution : t.resolution;
        await sql`UPDATE tickets SET status = ${b.status}, resolution = ${resolution}, resolved_at = ${b.status === 'resolved' ? new Date() : null} WHERE id = ${t.id}`;
        await sql`INSERT INTO ticket_notes (ticket_id, kind, body, actor) VALUES (${t.id}, 'status', ${b.status + (resolution ? ' · ' + resolution : '')}, ${admin.email})`;
      }
      await sql`UPDATE tickets SET updated_at = NOW() WHERE id = ${t.id}`;
      return json({ ok: true });
    }
    if (parts[0] === 'photos' && parts[1] && req.method === 'GET') {
      const p = await one`SELECT mime, data FROM ticket_photos WHERE id = ${Number(parts[1]) || 0}`;
      if (!p) throw new HttpError(404, 'not-found');
      return new Response(p.data, { headers: { 'content-type': p.mime, 'cache-control': 'private, max-age=3600' } });
    }
    // Recent conversations, so the team can read what people ask and how the assistant answered.
    if (parts[0] === 'chats' && parts.length === 1 && req.method === 'GET') {
      const rows = await sql`SELECT id, lang, email, turns, handed_off, rating, created_at, updated_at, messages->0->>'content' AS first
        FROM chats WHERE turns > 0 ORDER BY updated_at DESC LIMIT 200`;
      return json({ chats: rows });
    }
    if (parts[0] === 'chats' && parts[1] && req.method === 'GET') {
      const c = await one`SELECT id, lang, email, turns, handed_off, rating, created_at, messages FROM chats WHERE id = ${Number(parts[1]) || 0}`;
      if (!c) throw new HttpError(404, 'not-found');
      const tickets = await sql`SELECT ref, kind, status FROM tickets WHERE chat_id = ${c.id}`;
      return json({ chat: { ...c, messages: undefined }, transcript: readable(typeof c.messages === 'string' ? JSON.parse(c.messages) : c.messages), tickets });
    }

    if (parts[0] === 'statuses') return json({ statuses: STATUSES, windows: WINDOWS });
    throw new HttpError(404, 'not-found');
  } catch (e) { return fail(e); }
};

const clamp = (v: unknown, fallback: number) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 200 ? n : fallback; };

export const config: Config = { path: ['/api/admin/*'] };
