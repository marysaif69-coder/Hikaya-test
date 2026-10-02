// Refunds from the admin desk. Card payments go back through Square; e-Transfer and cash refunds
// are recorded here after the team sends the money; store credit becomes a one-time promo code.
import { sql, one } from './db';
import { HttpError, str, siteUrl } from './http';
import { cardEnabled, refundPayment } from './square';
import { randomCode } from './promos';
import { send, refundEmail } from './email';
import { event } from './orders';

export const METHODS = ['card', 'e-transfer', 'cash', 'store-credit'] as const;

export async function refundOrder(ref: string, b: any, actor: string, req?: Request) {
  const o = await one`SELECT * FROM orders WHERE ref = ${ref}`;
  if (!o) throw new HttpError(404, 'not-found');
  const method = (METHODS as readonly string[]).includes(b.method) ? b.method : null;
  if (!method) throw new HttpError(400, 'method', 'Choose how the money goes back.');
  const left = o.total_cents - o.refunded_cents;
  const amount = Math.round(Number(b.amount_cents));
  if (!(amount > 0)) throw new HttpError(400, 'amount', 'Enter an amount.');
  if (amount > left) throw new HttpError(400, 'amount', `At most $${(left / 100).toFixed(2)} can still be refunded.`);
  const reason = str(b.reason, 300) || null;

  let squareId: string | null = null, status = 'done', creditCode: string | null = null;
  if (method === 'card') {
    if (!cardEnabled()) throw new HttpError(409, 'square-off', 'Card payments are not connected. Refund by e-Transfer or cash instead.');
    if (!o.square_payment_id) throw new HttpError(409, 'no-payment', 'This order has no card payment to refund.');
    const r = await refundPayment(o.square_payment_id, amount, reason ?? `Refund for ${o.ref}`, `${o.ref}-${o.refunded_cents}-${amount}`);
    squareId = r.id; status = r.status === 'COMPLETED' ? 'done' : 'pending';
  }
  if (method === 'store-credit') {
    creditCode = randomCode('CREDIT');
    await sql`INSERT INTO promo_codes (code, kind, value, max_uses, active, note, created_by) VALUES (${creditCode}, 'amount', ${amount}, 1, TRUE, ${`Store credit for ${o.ref}`}, ${actor})`;
  }
  await sql`INSERT INTO refunds (order_id, amount_cents, method, reason, status, square_refund_id, credit_code, actor) VALUES (${o.id}, ${amount}, ${method}, ${reason}, ${status}, ${squareId}, ${creditCode}, ${actor})`;
  const total = o.refunded_cents + amount;
  const u = await one`UPDATE orders SET refunded_cents = ${total}, payment_status = ${total >= o.total_cents ? 'refunded' : 'partly-refunded'}, updated_at = NOW() WHERE id = ${o.id} RETURNING *`;
  await event(o.id, 'refund', `$${(amount / 100).toFixed(2)} by ${method}${creditCode ? ` (${creditCode})` : ''}${reason ? ` · ${reason}` : ''}`, actor);
  if (b.notify !== false && !o.is_sample) await send(refundEmail(u as any, amount, method, creditCode, siteUrl(req)));
  return { refunded: total, creditCode, status };
}

export const refundsFor = (orderId: number) => sql`SELECT amount_cents, method, reason, status, credit_code, actor, created_at FROM refunds WHERE order_id = ${orderId} ORDER BY created_at`;
