import { sql, one, type Row } from './db';
import { HttpError, str, isEmail, siteUrl } from './http';
import { hash, token, isAdminEmail, type Session } from './auth';
import { priceCart, totals, type PricedLine } from './pricing';
import { assertBookable } from './slots';
import { liveCatalog, takeStock, giveStock, restock } from './catalog';
import { checkPromo, redeem, unredeem, type Applied } from './promos';
import { send, orderEmail, teamAlert, type OrderMailKind } from './email';
import { randomInt } from 'node:crypto';

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

export async function createOrder(input: any, s: Session | null, cardEnabled: boolean): Promise<NewOrder> {
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
  try {

  const customer = await one`INSERT INTO customers (email, name, phone, lang) VALUES (${email}, ${name}, ${phone}, ${lang})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, lang = EXCLUDED.lang RETURNING id`;
  const guestToken = token(18);
  let order: Row | null = null;
  for (let i = 0; i < 5 && !order; i++) {
    try {
      order = await one`INSERT INTO orders (ref, customer_id, email, name, phone, lang, method, street, postal, slot_date, slot_window, payment,
          subtotal_cents, delivery_cents, discount_cents, total_cents, promo_code, notes, guest_token_hash, is_sample, gift, gift_to, gift_phone, gift_message)
        VALUES (${newRef()}, ${customer!.id}, ${email}, ${name}, ${phone}, ${lang}, ${method}, ${street}, ${postal}, ${str(input.day, 10)}, ${str(input.window, 20)}, ${payment},
          ${t.subtotal_cents}, ${t.delivery_cents}, ${t.discount_cents}, ${t.total_cents}, ${promo?.code ?? null}, ${notes || null}, ${hash(guestToken)}, ${isSample}, ${gift}, ${giftTo}, ${giftPhone}, ${giftMessage})
        RETURNING *`;
    } catch (e: any) { if (!String(e?.message).includes('unique')) throw e; }
  }
  if (!order) throw new HttpError(500, 'ref');
  for (const l of lines) {
    await sql`INSERT INTO order_items (order_id, product_id, name_en, name_ar, option, option_en, option_ar, qty, unit_cents)
      VALUES (${order.id}, ${l.product_id}, ${l.name_en}, ${l.name_ar}, ${l.option}, ${l.option_en}, ${l.option_ar}, ${l.qty}, ${l.unit_cents})`;
  }
  await event(order.id, 'created', `${method} · ${str(input.day, 10)} ${order.slot_window} · ${payment}${promo ? ` · code ${promo.code}` : ''}`, s?.email ?? 'guest');
  return { lines, order, guestToken };
  } catch (e) { await giveStock(taken); await unredeem(promo?.code ?? null); throw e; }
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
}
const mailShape = (o: Row) => ({ ...o, slot_date: String(o.slot_date instanceof Date ? o.slot_date.toISOString() : o.slot_date).slice(0, 10) }) as any;

/** What a customer may see about their order. */
export async function publicOrder(o: Row) {
  return {
    ref: o.ref, status: o.status, paymentStatus: o.payment_status, payment: o.payment, method: o.method,
    day: mailShape(o).slot_date, window: o.slot_window, street: o.street, postal: o.postal, name: o.name,
    subtotal: o.subtotal_cents, delivery: o.delivery_cents, discount: o.discount_cents ?? 0, promo: o.promo_code ?? null, gift: o.gift ? { to: o.gift_to, phone: o.gift_phone, message: o.gift_message } : null, refunded: o.refunded_cents ?? 0, total: o.total_cents, notes: o.notes, payUrl: o.payment_status === 'unpaid' ? o.square_link_url : null,
    created: o.created_at, items: await items(o.id),
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

/** A cancelled order gives its stock and promo code use back. */
export async function releaseOrder(o: Row) {
  if (!o.is_sample) await restock(o.id);
  await unredeem(o.promo_code ?? null);
}

export async function setPayment(ref: string, paymentStatus: string, actor: string) {
  if (!['unpaid', 'paid', 'partly-refunded', 'refunded'].includes(paymentStatus)) throw new HttpError(400, 'bad-payment');
  const o = await one`UPDATE orders SET payment_status = ${paymentStatus}, updated_at = NOW() WHERE ref = ${ref} RETURNING *`;
  if (!o) throw new HttpError(404, 'not-found');
  await event(o.id, 'payment', paymentStatus, actor);
  return o;
}
