import { sql, one, type Row } from './db';
import { HttpError, str, isEmail, siteUrl } from './http';
import { hash, token, isAdminEmail, type Session } from './auth';
import { priceCart, totals, dollars, type PricedLine } from './pricing';
import { assertBookable, bookable, getSettings } from './slots';
import { liveCatalog, takeStock, giveStock, restock, assertDayLimits } from './catalog';
import { checkPromo, redeem, unredeem, shape, type Applied } from './promos';
import { send, orderEmail, teamAlert, type OrderMailKind } from './email';
import { pushOwners } from './push';
import { randomInt } from 'node:crypto';
import { paymentLink } from './square';
import { takeFromGiftCard, giveBackToGiftCard, normGift } from './giftcards';

export const STATUSES = ['received', 'confirmed', 'ready', 'out-for-delivery', 'completed', 'cancelled'] as const;
export type Status = typeof STATUSES[number];
const PAYMENTS = ['at-pickup', 'e-transfer', 'card'] as const;
const REF_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newRef = () => 'HK-' + Array.from({ length: 5 }, () => REF_CHARS[randomInt(REF_CHARS.length)]).join('');

/** Calgary postal codes start T1, T2 or T3. Returns "T2P 1J9" or null. */
export const calgaryPostal = (v: string) => {
  const c = v.toUpperCase().replace(/[\s-]+/g, '');
  return /^T[123][A-Z]\d[A-Z]\d$/.test(c) ? `${c.slice(0, 3)} ${c.slice(3)}` : null;
};

export type NewOrder = { lines: PricedLine[]; order: Row; guestToken: string };

export async function createOrder(input: any, s: Session | null, cardEnabled: boolean, opts: { subscriptionId?: number } = {}): Promise<NewOrder> {
  const lang = input?.lang === 'ar' ? 'ar' : 'en';
  const name = str(input?.name, 120), phone = str(input?.phone, 40), notes = str(input?.notes, 1000);
  const email = (s?.email ?? str(input?.email, 254)).toLowerCase();
  const errors: Record<string, string> = {};
  if (!name) errors.name = 'required';
  if (!phone || phone.replace(/\D/g, '').length < 10) errors.phone = 'phone';
  if (!isEmail(email)) errors.email = 'email';
  const method = input?.method === 'delivery' ? 'delivery' : 'pickup';
  let street: string | null = null, postal: string | null = null;
  if (method === 'delivery') {
    street = str(input?.street, 200) || null;
    postal = calgaryPostal(str(input?.postal, 12));
    if (!street) errors.street = 'required';
    if (!postal) errors.postal = 'postal';
  }
  const payment = PAYMENTS.includes(input?.payment) ? input.payment : 'at-pickup';
  const gift = input?.gift === true;
  const giftTo = gift ? str(input?.gift_to, 120) || null : null, giftPhone = gift ? str(input?.gift_phone, 40) || null : null, giftMessage = gift ? str(input?.gift_message, 300) || null : null;
  if (gift && !giftTo) errors.gift_to = 'required';
  if (payment === 'card' && !cardEnabled) errors.payment = 'card-off';
  if (Object.keys(errors).length) throw Object.assign(new HttpError(400, 'invalid', 'Check the highlighted fields.'), { fields: errors });

  const lines = priceCart(input?.lines, await liveCatalog());
  await assertBookable(str(input?.day, 10), str(input?.window, 20), method);
  await assertDayLimits(str(input?.day, 10), lines, (await getSettings()).caps.giftBoxesPerDay);
  const sub = lines.reduce((n, l) => n + l.unit_cents * l.qty, 0);
  let promo: Applied | null = null;
  if (str(input?.promo, 32)) {
    try { promo = await checkPromo(input.promo, sub, email); }
    catch (e) { throw Object.assign(e as HttpError, { fields: { promo: 'promo' } }); }
  }
  const t = totals(lines, method, promo);
  const isSample = input?.sample === true && s?.role === 'admin';

  // Take stock and use the promo code before saving; give both back if saving fails.
  const taken = isSample ? [] : await takeStock(lines);
  try { if (promo) await redeem(promo.code); } catch (e) { await giveStock(taken); throw e; }
  // A gift card pays what it can of the total; the rest is paid the usual way.
  const gcCode = normGift(input?.giftcard) || null;
  let gcCents = 0;
  try { if (gcCode) gcCents = await takeFromGiftCard(gcCode, t.total_cents); }
  catch (e) { await giveStock(taken); await unredeem(promo?.code ?? null); throw Object.assign(e as HttpError, { fields: { giftcard: 'giftcard' } }); }
  const total = t.total_cents - gcCents;
  try {

  const customer = await one`INSERT INTO customers (email, name, phone, lang) VALUES (${email}, ${name}, ${phone}, ${lang})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, lang = EXCLUDED.lang RETURNING id`;
  const guestToken = token(18);
  let order: Row | null = null;
  for (let i = 0; i < 5 && !order; i++) {
    try {
      order = await one`INSERT INTO orders (ref, customer_id, email, name, phone, lang, method, street, postal, slot_date, slot_window, payment,
          subtotal_cents, delivery_cents, discount_cents, total_cents, promo_code, notes, guest_token_hash, is_sample, gift, gift_to, gift_phone, gift_message,
          gift_card_code, gift_card_cents, payment_status, sms_ok, subscription_id)
        VALUES (${newRef()}, ${customer!.id}, ${email}, ${name}, ${phone}, ${lang}, ${method}, ${street}, ${postal}, ${str(input.day, 10)}, ${str(input.window, 20)}, ${payment},
          ${t.subtotal_cents}, ${t.delivery_cents}, ${t.discount_cents}, ${total}, ${promo?.code ?? null}, ${notes || null}, ${hash(guestToken)}, ${isSample}, ${gift}, ${giftTo}, ${giftPhone}, ${giftMessage},
          ${gcCode && gcCents ? gcCode : null}, ${gcCents}, ${total === 0 ? 'paid' : 'unpaid'}, ${input?.sms === true}, ${opts.subscriptionId ?? null})
        RETURNING *`;
    } catch (e: any) { if (!String(e?.message).includes('unique')) throw e; }
  }
  if (!order) throw new HttpError(500, 'ref');
  for (const l of lines) {
    await sql`INSERT INTO order_items (order_id, product_id, name_en, name_ar, option, option_en, option_ar, qty, unit_cents)
      VALUES (${order.id}, ${l.product_id}, ${l.name_en}, ${l.name_ar}, ${l.option}, ${l.option_en}, ${l.option_ar}, ${l.qty}, ${l.unit_cents})`;
  }
  await event(order.id, 'created', `${method} · ${str(input.day, 10)} ${order.slot_window} · ${payment}${promo ? ` · code ${promo.code}` : ''}${gcCents ? ` · gift card ${gcCode} −${(gcCents / 100).toFixed(2)}` : ''}${opts.subscriptionId ? ' · regular order' : ''}`, s?.email ?? (opts.subscriptionId ? 'regular order' : 'guest'));
  return { lines, order, guestToken };
  } catch (e) { await giveStock(taken); await unredeem(promo?.code ?? null); await giveBackToGiftCard(gcCode, gcCents); throw e; }
}

/** After an order is saved: the card payment page (if paying by card), the customer's email and the team alert. */
export async function finishOrder(n: NewOrder, req?: Request, extra: { every_weeks?: number } = {}) {
  const { order, lines, guestToken } = n;
  let payUrl: string | null = null;
  if (order.payment === 'card' && order.total_cents > 0) {
    try {
      const link = await paymentLink(order, lines, `${siteUrl(req)}/${order.lang}/thanks/?order=${order.ref}&t=${guestToken}`);
      payUrl = link.url;
      await sql`UPDATE orders SET square_order_id = ${link.orderId}, square_link_url = ${link.url} WHERE id = ${order.id}`;
      order.square_link_url = link.url;
    } catch (e) {
      console.error(e);
      await event(order.id, 'payment-link-failed', String(e).slice(0, 300), 'system');
    }
  }
  // With "confirm new orders automatically" on, the order is confirmed at once and the
  // customer gets the confirmation email instead of "we have your order".
  if (!order.is_sample && (await getSettings()).ordering.autoConfirm) {
    const c = await one`UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = ${order.id} AND status = 'received' RETURNING *`;
    if (c) { Object.assign(order, c); await event(order.id, 'status', 'confirmed (automatically)', 'system'); }
    await notify('confirmed', { ...order, ...extra }, req, guestToken);
  } else await notify('received', { ...order, ...extra }, req, guestToken);
  await notifyTeam(order, req);
  return payUrl;
}

export async function event(orderId: number, kind: string, detail: string | null, actor: string) {
  await sql`INSERT INTO order_events (order_id, kind, detail, actor) VALUES (${orderId}, ${kind}, ${detail}, ${actor})`;
}

export const items = (orderId: number) => sql`SELECT product_id, name_en, name_ar, option, option_en, option_ar, qty, unit_cents FROM order_items WHERE order_id = ${orderId} ORDER BY id`;

export const viewUrl = (o: Row, req?: Request, guestToken?: string) =>
  guestToken ? `${siteUrl(req)}/${o.lang}/account/?order=${o.ref}&t=${guestToken}` : `${siteUrl(req)}/${o.lang}/account/?order=${o.ref}`;

export async function notify(kind: OrderMailKind, o: Row, req?: Request, guestToken?: string) {
  // Sample orders only email a team address, never a made-up customer.
  if (o.is_sample && !isAdminEmail(o.email)) { await event(o.id, 'email', `${kind}: not sent (sample order)`, 'system'); return; }
  const its = await items(o.id);
  const status = await send(orderEmail(kind, mailShape(o), its as any, viewUrl(o, req, guestToken), siteUrl(req)));
  await event(o.id, 'email', `${kind}: ${status}`, 'system');
}
export async function notifyTeam(o: Row, req?: Request) {
  if (o.is_sample) return;
  const its = await items(o.id);
  for (const m of teamAlert(mailShape(o), its as any, `${siteUrl(req)}/admin/?order=${o.ref}`)) await send(m);
  const d = mailShape(o).slot_date as string;
  await pushOwners({ title: `New order ${o.ref} · ${dollars(o.total_cents)}`, body: `${o.name} · ${o.method === 'delivery' ? 'delivery' : 'pickup'} ${d} ${o.slot_window} · ${its.reduce((n: number, i: any) => n + i.qty, 0)} items`, url: `/admin/?order=${o.ref}`, tag: `order-${o.ref}` });
}
const mailShape = (o: Row) => ({ ...o, slot_date: String(o.slot_date instanceof Date ? o.slot_date.toISOString() : o.slot_date).slice(0, 10) }) as any;

/** Stops still ahead of this one on the driver's route (only while it is out for delivery). */
async function stopsBefore(o: Row) {
  if (o.status !== 'out-for-delivery' || o.route_seq == null || !o.driver_email) return null;
  const r = await one`SELECT COUNT(*)::int AS n FROM orders WHERE driver_email = ${o.driver_email} AND slot_date = ${mailShape(o).slot_date}
    AND status = 'out-for-delivery' AND route_seq IS NOT NULL AND route_seq < ${o.route_seq} AND id <> ${o.id}`;
  return r!.n as number;
}

/** What a customer may see about their order. */
export async function publicOrder(o: Row) {
  return {
    ref: o.ref, status: o.status, paymentStatus: o.payment_status, payment: o.payment, method: o.method,
    day: mailShape(o).slot_date, window: o.slot_window, street: o.street, postal: o.postal, name: o.name,
    subtotal: o.subtotal_cents, delivery: o.delivery_cents, discount: o.discount_cents ?? 0, promo: o.promo_code ?? null, gift: o.gift ? { to: o.gift_to, phone: o.gift_phone, message: o.gift_message } : null, giftCard: o.gift_card_cents ?? 0, regular: Boolean(o.subscription_id), refunded: o.refunded_cents ?? 0, total: o.total_cents, notes: o.notes, payUrl: o.payment_status === 'unpaid' ? o.square_link_url : null,
    created: o.created_at, items: await items(o.id), stopsBefore: await stopsBefore(o),
  };
}

export async function findForGuest(ref: string, t: string) {
  const o = await one`SELECT * FROM orders WHERE ref = ${ref}`;
  if (!o || hash(t) !== o.guest_token_hash) throw new HttpError(404, 'not-found', 'We could not find that order.');
  return o;
}

// ---------- team actions ----------
const MAIL_ON: Partial<Record<Status, OrderMailKind>> = { confirmed: 'confirmed', ready: 'ready', 'out-for-delivery': 'out-for-delivery', completed: 'completed', cancelled: 'cancelled' };

export async function setStatus(ref: string, status: string, actor: string, req?: Request, sendEmail = true) {
  if (!STATUSES.includes(status as Status)) throw new HttpError(400, 'bad-status');
  const before = await one`SELECT status FROM orders WHERE ref = ${ref}`;
  if (!before) throw new HttpError(404, 'not-found');
  const o = await one`UPDATE orders SET status = ${status}, updated_at = NOW() WHERE ref = ${ref} RETURNING *`;
  if (!o) throw new HttpError(404, 'not-found');
  if (status === 'cancelled' && before.status !== 'cancelled') await releaseOrder(o);
  await event(o.id, 'status', status, actor);
  const kind = MAIL_ON[status as Status];
  if (kind && sendEmail) await notify(kind, o, req);
  return o;
}

/** Moves an order to another day or time. Customers can only do it while the current day is still
 * open for orders and the new one has room; the team can override both (force). */
export async function moveOrder(ref: string, day: string, window: string, actor: string, req?: Request, opts: { email?: string; force?: boolean } = {}) {
  const o = await one`SELECT * FROM orders WHERE ref = ${ref}`;
  if (!o || (opts.email && o.email !== opts.email)) throw new HttpError(404, 'not-found', 'We could not find that order.');
  if (!['received', 'confirmed'].includes(o.status)) throw new HttpError(409, 'cannot-move', 'This order is already being prepared. Reply to your confirmation email and we will help.');
  const cur = String(o.slot_date instanceof Date ? o.slot_date.toISOString() : o.slot_date).slice(0, 10);
  if (cur === day && o.slot_window === window) throw new HttpError(400, 'same', 'That is the day and time it already has.');
  if (!opts.force) {
    const s = await getSettings();
    if (!bookable(cur, s.ordering)) throw new HttpError(409, 'too-late', 'It is too late to change this order online. Reply to your confirmation email and we will help.');
    await assertBookable(day, window, o.method);
    await assertDayLimits(day, (await items(o.id)).map(i => ({ product_id: i.product_id, qty: i.qty })), s.caps.giftBoxesPerDay, o.id);
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !window) throw new HttpError(400, 'bad-slot', 'Choose a day and a time.');
  const moved = await one`UPDATE orders SET slot_date = ${day}, slot_window = ${window}, reminded_at = NULL, sms_reminded_at = NULL, updated_at = NOW() WHERE id = ${o.id} RETURNING *`;
  await event(o.id, 'moved', `${cur} ${o.slot_window} → ${day} ${window}`, actor);
  await notify('moved', moved!, req);
  return moved!;
}

/** Changes what is in an order (the team, e.g. after a phone call): priced again at today's prices,
 * stock and daily limits checked, the promo code and gift card kept, and the customer emailed. */
export async function editOrder(ref: string, rawLines: unknown, actor: string, req?: Request, sendEmail = true) {
  const o = await one`SELECT * FROM orders WHERE ref = ${ref}`;
  if (!o) throw new HttpError(404, 'not-found');
  if (!['received', 'confirmed'].includes(o.status)) throw new HttpError(409, 'cannot-edit', 'This order is already being prepared or is finished. Change it only before packing.');
  const live = await liveCatalog();
  // Products already in the order can stay even if they've since been hidden or sold out.
  const before = await items(o.id);
  const keep = new Set(before.map(i => i.product_id));
  const relaxed = Object.fromEntries(Object.entries(live).map(([id, l]) => [id, keep.has(id) ? { ...l, shown: true, available: true } : l]));
  const lines = priceCart(rawLines, relaxed as any);
  const day = String(o.slot_date instanceof Date ? o.slot_date.toISOString() : o.slot_date).slice(0, 10);
  await assertDayLimits(day, lines, (await getSettings()).caps.giftBoxesPerDay, o.id);
  // Stock: give back what the order had, then take the new lines; on failure put it all back.
  if (!o.is_sample) await restock(o.id);
  let taken: [string, number][] = [];
  try { if (!o.is_sample) taken = await takeStock(lines); }
  catch (e) { if (!o.is_sample) await takeStock(before.map(i => ({ product_id: i.product_id, qty: i.qty }))).catch(() => null); throw e; }
  const sub = lines.reduce((n, l) => n + l.unit_cents * l.qty, 0);
  const p = o.promo_code ? await one`SELECT * FROM promo_codes WHERE code = ${o.promo_code}` : null;
  const t = totals(lines, o.method, p ? shape(p, sub) : null);
  // The gift card can only cover up to the new total; anything above goes back on the card.
  const gc = Math.min(o.gift_card_cents ?? 0, t.total_cents);
  if ((o.gift_card_cents ?? 0) > gc) await giveBackToGiftCard(o.gift_card_code, o.gift_card_cents - gc);
  const total = t.total_cents - gc;
  const wasPaid = o.payment_status === 'paid';
  await sql`DELETE FROM order_items WHERE order_id = ${o.id}`;
  for (const l of lines) await sql`INSERT INTO order_items (order_id, product_id, name_en, name_ar, option, option_en, option_ar, qty, unit_cents)
    VALUES (${o.id}, ${l.product_id}, ${l.name_en}, ${l.name_ar}, ${l.option}, ${l.option_en}, ${l.option_ar}, ${l.qty}, ${l.unit_cents})`;
  const balance = wasPaid ? total - o.total_cents : 0;
  const upd = await one`UPDATE orders SET subtotal_cents = ${t.subtotal_cents}, delivery_cents = ${t.delivery_cents}, discount_cents = ${t.discount_cents}, gift_card_cents = ${gc},
      total_cents = ${total}, payment_status = ${wasPaid && balance > 0 ? 'unpaid' : total === 0 ? 'paid' : o.payment_status}, square_link_url = ${o.payment === 'card' && !wasPaid ? null : o.square_link_url}, updated_at = NOW()
    WHERE id = ${o.id} RETURNING *`;
  // Card orders not paid yet get a new payment page for the new amount.
  if (upd && upd.payment === 'card' && upd.payment_status === 'unpaid' && upd.total_cents > 0) {
    try {
      const link = await paymentLink(upd, lines, `${siteUrl(req)}/${upd.lang}/account/?order=${upd.ref}`, `${upd.ref}-${Date.now()}`);
      await sql`UPDATE orders SET square_order_id = ${link.orderId}, square_link_url = ${link.url} WHERE id = ${o.id}`;
      upd.square_link_url = link.url;
    } catch (e) { console.error(e); }
  }
  await event(o.id, 'edited', `${before.map(i => `${i.qty}× ${i.name_en}`).join(', ')} → ${lines.map(l => `${l.qty}× ${l.name_en}`).join(', ')} · total ${dollars(o.total_cents)} → ${dollars(total)}${balance > 0 ? ` · ${dollars(balance)} still to pay` : balance < 0 ? ` · ${dollars(-balance)} to refund (use Refund)` : ''}`, actor);
  if (sendEmail) await notify('updated', upd!, req);
  void taken;
  return { order: upd!, balance };
}

/** A cancelled order gives its stock and promo code use back. */
export async function releaseOrder(o: Row) {
  if (!o.is_sample) await restock(o.id);
  await unredeem(o.promo_code ?? null);
  await giveBackToGiftCard(o.gift_card_code ?? null, o.gift_card_cents ?? 0);
}

export async function setPayment(ref: string, paymentStatus: string, actor: string) {
  if (!['unpaid', 'paid', 'partly-refunded', 'refunded'].includes(paymentStatus)) throw new HttpError(400, 'bad-payment');
  const o = await one`UPDATE orders SET payment_status = ${paymentStatus}, updated_at = NOW() WHERE ref = ${ref} RETURNING *`;
  if (!o) throw new HttpError(404, 'not-found');
  await event(o.id, 'payment', paymentStatus, actor);
  return o;
}
