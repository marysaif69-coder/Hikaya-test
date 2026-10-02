// /api/admin/* — the team's order desk. Every route requires an admin session (ADMIN_EMAILS).
import type { Config } from '@netlify/functions';
import { json, fail, body, str, HttpError, siteUrl } from '../lib/http';
import { requireAdmin } from '../lib/auth';
import { sql, one } from '../lib/db';
import { getSettings, WINDOWS, calgaryNow } from '../lib/slots';
import { items, setStatus, setPayment, event, STATUSES } from '../lib/orders';
import { readable } from '../lib/ask';
import { send, ticketReply } from '../lib/email';

const day = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);
const summary = (o: any) => ({
  ref: o.ref, name: o.name, email: o.email, phone: o.phone, method: o.method, street: o.street, postal: o.postal,
  day: day(o.slot_date), window: o.slot_window, payment: o.payment, paymentStatus: o.payment_status, status: o.status,
  total: o.total_cents, lang: o.lang, notes: o.notes, created: o.created_at, items: o.items ?? null,
});

export default async (req: Request) => {
  try {
    const admin = await requireAdmin(req);
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/api\/admin\/?/, '').split('/').filter(Boolean);
    const q = (k: string, max = 40) => str(url.searchParams.get(k), max);

    // GET /api/admin/orders — filterable list
    if (parts[0] === 'orders' && parts.length === 1 && req.method === 'GET') {
      const status = q('status'), method = q('method'), from = q('from', 10) || '1900-01-01', to = q('to', 10) || '2999-12-31', term = `%${q('q', 80).toLowerCase()}%`;
      const rows = await sql`SELECT o.*, COALESCE(json_agg(json_build_object('name', i.name_en, 'option', i.option_en, 'qty', i.qty) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
        FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
        WHERE (${status} = '' OR o.status = ${status}) AND (${method} = '' OR o.method = ${method})
          AND o.slot_date BETWEEN ${from} AND ${to}
          AND (${term} = '%%' OR LOWER(o.ref || ' ' || o.name || ' ' || o.email || ' ' || o.phone || ' ' || COALESCE(o.postal, '')) LIKE ${term})
        GROUP BY o.id ORDER BY o.slot_date, o.slot_window, o.created_at LIMIT 500`;
      const counts = await sql`SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status`;
      const unpaid = await one`SELECT COUNT(*)::int AS n, COALESCE(SUM(total_cents), 0)::int AS cents FROM orders WHERE payment_status = 'unpaid' AND status <> 'cancelled'`;
      return json({ orders: rows.map(r => summary({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items })), counts: Object.fromEntries(counts.map(c => [c.status, c.n])), unpaid });
    }

    // GET /api/admin/orders/:ref — full order with history
    if (parts[0] === 'orders' && parts[1] && req.method === 'GET') {
      const o = await one`SELECT * FROM orders WHERE ref = ${parts[1]}`;
      if (!o) throw new HttpError(404, 'not-found');
      const events = await sql`SELECT kind, detail, actor, created_at FROM order_events WHERE order_id = ${o.id} ORDER BY created_at DESC`;
      const emails = await sql`SELECT to_email, subject, status, created_at FROM email_log WHERE order_id = ${o.id} ORDER BY created_at DESC`;
      return json({ order: { ...summary(o), subtotal: o.subtotal_cents, delivery: o.delivery_cents, items: await items(o.id) }, events, emails });
    }

    // POST /api/admin/orders/:ref — change status / payment / add a note
    if (parts[0] === 'orders' && parts[1] && req.method === 'POST') {
      const b = await body(req);
      let o: any = null;
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
      const withItems = await Promise.all(rows.map(async r => summary({ ...r, items: await items(r.id) })));
      return json({
        date,
        pickups: WINDOWS.map(w => ({ window: w, orders: withItems.filter(o => o.method === 'pickup' && o.window === w) })),
        deliveries: withItems.filter(o => o.method === 'delivery').sort((a, b) => String(a.postal).localeCompare(String(b.postal))),
        pack,
      });
    }

    // Settings: capacity per window and the open/paused switch
    if (parts[0] === 'settings') {
      if (req.method === 'POST') {
        const b = await body(req);
        const cur = await getSettings();
        const capacity = { pickup: clamp(b.capacity?.pickup, cur.capacity.pickup), delivery: clamp(b.capacity?.delivery, cur.capacity.delivery) };
        const ordering = { ...cur.ordering, open: typeof b.open === 'boolean' ? b.open : cur.ordering.open };
        await sql`INSERT INTO settings (key, value) VALUES ('capacity', ${JSON.stringify(capacity)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
        await sql`INSERT INTO settings (key, value) VALUES ('ordering', ${JSON.stringify(ordering)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      }
      return json(await getSettings());
    }

    // CSV export for the accountant or a spreadsheet
    if (parts[0] === 'export.csv' && req.method === 'GET') {
      const from = q('from', 10) || '1900-01-01', to = q('to', 10) || '2999-12-31';
      const rows = await sql`SELECT o.ref, o.created_at, o.slot_date, o.slot_window, o.method, o.status, o.payment, o.payment_status, o.name, o.email, o.phone, o.street, o.postal,
          o.subtotal_cents, o.delivery_cents, o.total_cents, STRING_AGG(i.qty || ' x ' || i.name_en || COALESCE(' (' || i.option_en || ')', ''), '; ' ORDER BY i.id) AS items
        FROM orders o LEFT JOIN order_items i ON i.order_id = o.id WHERE o.slot_date BETWEEN ${from} AND ${to} GROUP BY o.id ORDER BY o.slot_date, o.slot_window`;
      const head = ['ref', 'placed', 'day', 'window', 'method', 'status', 'payment', 'paid', 'name', 'email', 'phone', 'street', 'postal', 'subtotal', 'delivery', 'total', 'items'];
      const cell = (v: unknown) => { const s = v instanceof Date ? v.toISOString() : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = rows.map(r => [r.ref, r.created_at, day(r.slot_date), r.slot_window, r.method, r.status, r.payment, r.payment_status, r.name, r.email, r.phone, r.street, r.postal,
        (r.subtotal_cents / 100).toFixed(2), (r.delivery_cents / 100).toFixed(2), (r.total_cents / 100).toFixed(2), r.items].map(cell).join(','));
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
