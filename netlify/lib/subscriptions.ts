// Regular orders: "the same again every 2 or 4 weeks". Each time, a week before the day, the
// basket becomes a normal order (priced at today's prices, paid the usual way) and the customer
// gets the usual emails. They skip, pause, resume or stop it from their account.
import { sql, one, type Row } from './db';
import { HttpError, siteUrl } from './http';
import { addDays, calgaryNow } from './slots';
import { createOrder, finishOrder, event } from './orders';
import { cardEnabled } from './square';
import { send, subscriptionEmail } from './email';
import { PRODUCTS } from '../../src/data/products';

// Placed 8 days ahead: one evening before the earliest deadline any desk setting allows (a Sunday
// with the weekly deadline on Sunday closes 7 days before), so a regular order never misses it.
const LEAD_DAYS = 8;
const iso = (d: unknown) => String(d instanceof Date ? d.toISOString() : d).slice(0, 10);
const lang = (r: Row) => (r.lang === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
/** The next day on the schedule that is still far enough ahead to order for. */
const nextFrom = (start: string, every: number, after: string) => { let d = start; while (d <= after) d = addDays(d, every * 7); return d; };

export async function startSubscription(order: Row, input: any, every: number, req?: Request) {
  const lines = (Array.isArray(input?.lines) ? input.lines : []).slice(0, 30).map((l: any) => ({ id: String(l?.id ?? '').slice(0, 40), opt: String(l?.opt ?? '').slice(0, 40), qty: Math.max(1, Math.min(20, Math.round(Number(l?.qty)) || 1)), ...(typeof l?.sleeve === 'string' ? { sleeve: l.sleeve.slice(0, 10) } : {}) }));
  const next = addDays(iso(order.slot_date), every * 7);
  const sub = await one`INSERT INTO subscriptions (email, name, phone, lang, method, street, postal, slot_window, payment, lines, every_weeks, next_date, sms_ok, created_from)
    VALUES (${order.email}, ${order.name}, ${order.phone}, ${order.lang}, ${order.method}, ${order.street}, ${order.postal}, ${order.slot_window}, ${order.payment},
      ${JSON.stringify(lines)}::jsonb, ${every}, ${next}, ${Boolean(order.sms_ok)}, ${order.ref}) RETURNING *`;
  await sql`UPDATE orders SET subscription_id = ${sub!.id} WHERE id = ${order.id}`;
  await event(order.id, 'note', `Regular order started: every ${every} weeks, next ${next}`, 'system');
  await send(subscriptionEmail('started', order.email, lang(sub!), { every, next }, siteUrl(req)));
  return sub;
}

/** Daily: turn every regular order due within a week into a real order. */
export async function runSubscriptions(req?: Request, today = calgaryNow().date) {
  const due = await sql`SELECT * FROM subscriptions WHERE status = 'active' AND next_date <= ${addDays(today, LEAD_DAYS)} ORDER BY id LIMIT 200`;
  let placed = 0;
  for (const sub of due) {
    const day = iso(sub.next_date);
    const after = nextFrom(day, sub.every_weeks, addDays(today, LEAD_DAYS));
    const lines = typeof sub.lines === 'string' ? JSON.parse(sub.lines) : sub.lines;
    if (day < addDays(today, 1)) { // missed (e.g. paused and resumed late): just move on
      await sql`UPDATE subscriptions SET next_date = ${after}, updated_at = NOW() WHERE id = ${sub.id}`;
      continue;
    }
    try {
      const made = await createOrder({ lang: sub.lang, name: sub.name, phone: sub.phone, email: sub.email, method: sub.method, street: sub.street, postal: sub.postal,
        day, window: sub.slot_window, payment: sub.payment === 'card' && !cardEnabled() ? 'at-pickup' : sub.payment, lines, sms: sub.sms_ok }, null, cardEnabled(), { subscriptionId: sub.id });
      await finishOrder(made, req, { every_weeks: sub.every_weeks });
      await sql`UPDATE subscriptions SET next_date = ${after}, last_note = ${`Placed ${made.order.ref}`}, updated_at = NOW() WHERE id = ${sub.id}`;
      placed++;
    } catch (e: any) {
      // A date variety or filling we no longer sell (khudri, Medjool in the Everyday box): say so plainly.
      const gone = e?.code === 'choose-date' || e?.code === 'choose-filling';
      const why = e?.code === 'retired'
        ? (lang(sub) === 'ar' ? 'هذه العلبة صارت علبة هدية واحدة مع ملصق رمضان أو العيد. ردّ على هذه الرسالة لنرتّبها معك.' : 'That box is now one gift box with a Ramadan or Eid sticker. Reply to this email and we will set it up with you.')
        : gone
        ? (lang(sub) === 'ar' ? 'صنف التمر في طلبك لم يعد متوفراً. ردّ على هذه الرسالة لنختار معك صنفاً آخر.' : 'The date in it is no longer offered. Reply to this email and we will choose another with you.')
        : lang(sub) === 'ar' ? 'أحد المنتجات غير متوفر أو الموعد ممتلئ.' : (e?.message ?? 'Something in it is not available.');
      await sql`UPDATE subscriptions SET next_date = ${after}, last_note = ${`Not placed for ${day}: ${String(e?.message ?? e).slice(0, 200)}`}, updated_at = NOW() WHERE id = ${sub.id}`;
      await send(subscriptionEmail('not-placed', sub.email, lang(sub), { every: sub.every_weeks, next: after, why }, siteUrl(req)));
    }
  }
  return placed;
}

const shape = (r: Row) => {
  const lines = (typeof r.lines === 'string' ? JSON.parse(r.lines) : r.lines) as { id: string; opt: string; qty: number }[];
  return { id: r.id, every: r.every_weeks, next: iso(r.next_date), status: r.status, method: r.method, window: r.slot_window, payment: r.payment, note: r.last_note,
    lines: lines.map(l => { const p = PRODUCTS.find(x => x.id === l.id); return { ...l, name: p?.name ?? { en: l.id, ar: l.id } }; }) };
};
export const mySubscriptions = async (email: string) => (await sql`SELECT * FROM subscriptions WHERE email = ${email} AND status <> 'stopped' ORDER BY id`).map(shape);

export async function changeSubscription(email: string, id: number, action: string, req?: Request) {
  const sub = await one`SELECT * FROM subscriptions WHERE id = ${id} AND email = ${email} AND status <> 'stopped'`;
  if (!sub) throw new HttpError(404, 'not-found', 'We could not find that regular order.');
  const today = calgaryNow().date, next = iso(sub.next_date);
  let upd: Row | null = null;
  if (action === 'skip') {
    upd = await one`UPDATE subscriptions SET next_date = ${addDays(next, sub.every_weeks * 7)}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
    await send(subscriptionEmail('skipped', email, lang(sub), { every: sub.every_weeks, next: iso(upd!.next_date) }, siteUrl(req)));
  } else if (action === 'pause') upd = await one`UPDATE subscriptions SET status = 'paused', updated_at = NOW() WHERE id = ${id} RETURNING *`;
  else if (action === 'resume') upd = await one`UPDATE subscriptions SET status = 'active', next_date = ${nextFrom(next, sub.every_weeks, addDays(today, LEAD_DAYS))}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
  else if (action === 'stop') {
    upd = await one`UPDATE subscriptions SET status = 'stopped', updated_at = NOW() WHERE id = ${id} RETURNING *`;
    await send(subscriptionEmail('stopped', email, lang(sub), { every: sub.every_weeks, next: null }, siteUrl(req)));
  } else throw new HttpError(400, 'action');
  return shape(upd!);
}

export const listSubscriptions = async () => (await sql`SELECT * FROM subscriptions WHERE status <> 'stopped' ORDER BY next_date`).map(r => ({ ...shape(r), name: r.name, email: r.email }));
