// /api/admin/* — the team's order desk. Every route requires an admin session (ADMIN_EMAILS).
import type { Config } from '@netlify/functions';
import { json, fail, body, str, HttpError, siteUrl, env } from '../lib/http';
import { cardEnabled, squareCheck } from '../lib/square';
import { readContent, saveContent, type FileId } from '../lib/content';
import { requireTeam } from '../lib/auth';
import { sql, one } from '../lib/db';
import { getSettings, WINDOWS, calgaryNow } from '../lib/slots';
import { items, setStatus, setPayment, event, STATUSES } from '../lib/orders';
import { readable } from '../lib/ask';
import { liveCatalog, saveProduct, getSeasons, saveSeasons } from '../lib/catalog';
import { savePromo, normCode } from '../lib/promos';
import { refundOrder, refundsFor } from '../lib/refunds';
import { createSamples, removeSamples } from '../lib/samples';
import { askStatus } from '../lib/ask-fallback';
import { askEnabled } from '../lib/ask';
import { weekSheet, weekStart } from '../lib/week';
import { sendBackInStock, waitingByProduct } from '../lib/alerts';
import { listStats } from '../lib/list';
import { numbers } from '../lib/visits';
import { PRODUCTS, FAMILIES } from '../../src/data/products';
import { send, ticketReply } from '../lib/email';

const day = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);
const summary = (o: any) => ({
  ref: o.ref, name: o.name, email: o.email, phone: o.phone, method: o.method, street: o.street, postal: o.postal,
  day: day(o.slot_date), window: o.slot_window, payment: o.payment, paymentStatus: o.payment_status, status: o.status,
  total: o.total_cents, lang: o.lang, notes: o.notes, created: o.created_at, items: o.items ?? null,
  discount: o.discount_cents ?? 0, promo: o.promo_code ?? null, refunded: o.refunded_cents ?? 0, sample: Boolean(o.is_sample),
  gift: o.gift ? { to: o.gift_to, phone: o.gift_phone, message: o.gift_message } : null,
});

export default async (req: Request) => {
  try {
    const admin = await requireTeam(req);
    const url = new URL(req.url);
    const parts = url.pathname.replace(/^\/api\/admin\/?/, '').split('/').filter(Boolean);
    // Helpers can read everything and run orders; money, catalog, settings and exports are owners only.
    if (admin.role !== 'admin') {
      const write = req.method !== 'GET';
      const ownersOnly = parts[0] === 'export.csv' || parts[0] === 'list.csv' || parts[0] === 'samples' || parts[0] === 'seasons' || parts[0] === 'promos'
        || (write && ['products', 'settings', 'ask', 'connections', 'content'].includes(parts[0])) || (parts[0] === 'orders' && parts[2] === 'refund');
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
      const owed = await sql`SELECT payment, COUNT(*)::int AS n, COALESCE(SUM(total_cents), 0)::int AS cents FROM orders WHERE payment_status = 'unpaid' AND status <> 'cancelled'
        AND (${sample} = '' OR (${sample} = 'hide' AND NOT is_sample) OR (${sample} = 'only' AND is_sample)) GROUP BY payment`;
      const sum = (rows: any[]) => ({ n: rows.reduce((a, r) => a + r.n, 0), cents: rows.reduce((a, r) => a + r.cents, 0) });
      const atPickup = sum(owed.filter(r => r.payment === 'at-pickup')), waiting = sum(owed.filter(r => r.payment !== 'at-pickup'));
      return json({ orders: rows.map(r => summary({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items })), counts: Object.fromEntries(counts.map(c => [c.status, c.n])), atPickup, waiting });
    }

    // GET /api/admin/orders/:ref — full order with history
    if (parts[0] === 'orders' && parts[1] && req.method === 'GET') {
      const o = await one`SELECT * FROM orders WHERE ref = ${parts[1]}`;
      if (!o) throw new HttpError(404, 'not-found');
      const events = await sql`SELECT kind, detail, actor, created_at FROM order_events WHERE order_id = ${o.id} ORDER BY created_at DESC`;
      const emails = await sql`SELECT to_email, subject, status, created_at FROM email_log WHERE order_id = ${o.id} ORDER BY created_at DESC`;
      return json({ order: { ...summary(o), subtotal: o.subtotal_cents, delivery: o.delivery_cents, items: await items(o.id), refundable: o.total_cents - o.refunded_cents, paidByCard: Boolean(o.square_payment_id) }, events, emails, refunds: await refundsFor(o.id) });
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
      const withItems = await Promise.all(rows.map(async r => summary({ ...r, items: await items(r.id) })));
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
          cutoffMode: b.cutoffMode === 'weekly' || b.cutoffMode === 'day-before' ? b.cutoffMode : cur.ordering.cutoffMode,
          cutoffWeekday: Number.isInteger(b.cutoffWeekday) && b.cutoffWeekday >= 0 && b.cutoffWeekday <= 6 ? b.cutoffWeekday : cur.ordering.cutoffWeekday,
          cutoffHour: Number.isInteger(b.cutoffHour) && b.cutoffHour >= 0 && b.cutoffHour <= 23 ? b.cutoffHour : cur.ordering.cutoffHour,
          firstDay: typeof b.firstDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.firstDay) ? b.firstDay : cur.ordering.firstDay,
          closedDates: Array.isArray(b.closedDates) ? [...new Set(b.closedDates.filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(0, 100) : cur.ordering.closedDates,
        };
        await sql`INSERT INTO settings (key, value) VALUES ('capacity', ${JSON.stringify(capacity)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
        await sql`INSERT INTO settings (key, value) VALUES ('ordering', ${JSON.stringify(ordering)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
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
        etransfer: env('ETRANSFER_EMAIL') || null,
      });
    }
    if (parts[0] === 'connections' && parts[1] === 'test-email' && req.method === 'POST') {
      const status = await send({ to: admin.email, subject: 'Hikaya test email · رسالة تجريبية', text: 'If you can read this, order emails are working.\n\nإن وصلتك هذه الرسالة فرسائل الطلبات تعمل.', html: '<p>If you can read this, order emails are working.</p><p dir="rtl">إن وصلتك هذه الرسالة فرسائل الطلبات تعمل.</p>', kind: 'test' });
      const row = await one`SELECT error FROM email_log ORDER BY id DESC LIMIT 1`;
      return json({ status, to: admin.email, error: row?.error ?? null });
    }
    if (parts[0] === 'connections' && parts[1] === 'test-square' && req.method === 'POST') {
      return json(await squareCheck());
    }

    // ---------- products: prices, shown on the site, sold out, stock ----------
    if (parts[0] === 'products' && !parts[1] && req.method === 'GET') {
      const [live, waiting] = await Promise.all([liveCatalog(), waitingByProduct()]);
      return json({ seasons: await getSeasons(), products: PRODUCTS.map(p => ({
        id: p.id, name: p.name, kind: p.kind, family: FAMILIES[p.fam].name.en, defaultPrice: p.price * 100, ...live[p.id], waiting: waiting[p.id] ?? 0,
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

    // ---------- mailing list ----------
    if (parts[0] === 'list' && req.method === 'GET') return json(await listStats());
    if (parts[0] === 'list.csv' && req.method === 'GET') {
      const rows = await sql`SELECT email, lang, source, consent_at, confirmed_at, consent_text FROM subscribers WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL ORDER BY confirmed_at`;
      const cell = (v: unknown) => { const t = v instanceof Date ? v.toISOString() : String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const out = ['email,language,source,consented_at,confirmed_at,consent_wording', ...rows.map(r => [r.email, r.lang, r.source, r.consent_at, r.confirmed_at, r.consent_text].map(cell).join(','))].join('\n');
      return new Response(out, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="hikaya-mailing-list.csv"', 'cache-control': 'no-store' } });
    }

    // ---------- numbers: visits and sales ----------
    if (parts[0] === 'numbers' && req.method === 'GET') return json(await numbers(30));

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
          o.subtotal_cents, o.delivery_cents, o.discount_cents, o.promo_code, o.total_cents, o.refunded_cents, STRING_AGG(i.qty || ' x ' || i.name_en || COALESCE(' (' || i.option_en || ')', ''), '; ' ORDER BY i.id) AS items
        FROM orders o LEFT JOIN order_items i ON i.order_id = o.id WHERE o.slot_date BETWEEN ${from} AND ${to} AND NOT o.is_sample GROUP BY o.id ORDER BY o.slot_date, o.slot_window`;
      const head = ['ref', 'placed', 'day', 'window', 'method', 'status', 'payment', 'paid', 'name', 'email', 'phone', 'street', 'postal', 'subtotal', 'delivery', 'discount', 'promo', 'total', 'refunded', 'items'];
      // Customer text that starts like a formula (=, +, -, @) is prefixed so Excel shows it as text.
      const cell = (v: unknown) => { let s = v instanceof Date ? v.toISOString() : String(v ?? ''); if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = rows.map(r => [r.ref, r.created_at, day(r.slot_date), r.slot_window, r.method, r.status, r.payment, r.payment_status, r.name, r.email, r.phone, r.street, r.postal,
        (r.subtotal_cents / 100).toFixed(2), (r.delivery_cents / 100).toFixed(2), (r.discount_cents / 100).toFixed(2), r.promo_code, (r.total_cents / 100).toFixed(2), (r.refunded_cents / 100).toFixed(2), r.items].map(cell).join(','));
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
