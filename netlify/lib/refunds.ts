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
  // Only money that came in can go back. An unpaid order marked "refunded" would drop out of
  // every "still to collect" list, so the money would never be collected.
  if (o.payment_status !== 'paid' && o.payment_status !== 'partly-refunded') throw new HttpError(409, 'not-paid', 'This order has not been paid. Change the items or give a discount instead.');
  const method = (METHODS as readonly string[]).includes(b.method) ? b.method : null;
  if (!method) throw new HttpError(400, 'method', 'Choose how the money goes back.');
  // What can go back is what came in (paid_cents), not what the order is worth now: after the
  // team takes items off a paid order, the difference is refunded here.
  const left = (o.paid_cents ?? 0) - o.refunded_cents;
  const amount = Math.round(Number(b.amount_cents));
  if (!(amount > 0)) throw new HttpError(400, 'amount', 'Enter an amount.');
  if (amount > left) throw new HttpError(400, 'amount', `At most $${(Math.max(left, 0) / 100).toFixed(2)} can still be refunded.`);
  const reason = str(b.reason, 300) || null;

  // Hold the amount first, so two refunds sent at the same moment (a double click, two owners)
  // can't both pass the limit. Given back if the card refund fails.
  const held = await one`UPDATE orders SET refunded_cents = refunded_cents + ${amount}, updated_at = NOW()
    WHERE id = ${o.id} AND refunded_cents + ${amount} <= paid_cents RETURNING refunded_cents`;
  if (!held) throw new HttpError(409, 'amount', 'Another refund was just recorded on this order. Reload it and check what is left.');
  let total = held.refunded_cents as number;

  let squareId: string | null = null, status = 'done', creditCode: string | null = null, refunded = amount, cardError: unknown = null;
  if (method === 'card') {
    // An order can have more than one card payment (the first, then a balance after a change).
    // Take the refund from the newest first, each up to what is left of it.
    const pays = await sql`SELECT id, square_payment_id, amount_cents - refunded_cents AS left FROM order_payments WHERE order_id = ${o.id} AND amount_cents > refunded_cents ORDER BY id DESC`;
    if (!pays.length && o.square_payment_id) pays.push({ id: null, square_payment_id: o.square_payment_id, left: amount });
    const ids: string[] = [];
    let done = 0;
    try {
      if (!cardEnabled()) throw new HttpError(409, 'square-off', 'Card payments are not connected. Refund by e-Transfer or cash instead.');
      if (!pays.length) throw new HttpError(409, 'no-payment', 'This order has no card payment to refund.');
      for (const p of pays) {
        const part = Math.min(p.left, amount - done);
        if (part <= 0) break;
        const r = await refundPayment(p.square_payment_id, part, reason ?? `Refund for ${o.ref}`, `${o.ref}-${p.square_payment_id.slice(-8)}-${o.refunded_cents + done}-${part}`);
        if (p.id) await sql`UPDATE order_payments SET refunded_cents = refunded_cents + ${part} WHERE id = ${p.id}`;
        ids.push(r.id); done += part;
        if (r.status !== 'COMPLETED') status = 'pending';
      }
      if (done < amount) throw new HttpError(409, 'no-payment', `Only $${(done / 100).toFixed(2)} of card payments is left to refund on this order.`);
    } catch (e) {
      // Give back the part of the hold that did not go to the card.
      await sql`UPDATE orders SET refunded_cents = refunded_cents - ${amount - done} WHERE id = ${o.id}`;
      if (!done) throw e;
      cardError = e; refunded = done; total -= amount - done;
    }
    squareId = ids.join(',') || null;
  }
  if (method === 'store-credit') {
    creditCode = randomCode('CREDIT');
    await sql`INSERT INTO promo_codes (code, kind, value, max_uses, active, note, created_by) VALUES (${creditCode}, 'amount', ${amount}, 1, TRUE, ${`Store credit for ${o.ref}`}, ${actor})`;
  }
  await sql`INSERT INTO refunds (order_id, amount_cents, method, reason, status, square_refund_id, credit_code, actor) VALUES (${o.id}, ${refunded}, ${method}, ${reason}, ${status}, ${squareId}, ${creditCode}, ${actor})`;
  // Refunded in full once everything paid has gone back; still "paid" when the refund only
  // returned what was paid above a lowered total (the customer has what they paid for).
  const u = await one`UPDATE orders SET payment_status = CASE WHEN refunded_cents >= paid_cents THEN 'refunded' WHEN refunded_cents > GREATEST(paid_cents - total_cents, 0) THEN 'partly-refunded' ELSE 'paid' END, updated_at = NOW() WHERE id = ${o.id} RETURNING *`;
  await event(o.id, 'refund', `$${(refunded / 100).toFixed(2)} by ${method}${creditCode ? ` (${creditCode})` : ''}${reason ? ` · ${reason}` : ''}`, actor);
  if (b.notify !== false && !o.is_sample) await send(refundEmail(u as any, refunded, method, creditCode, siteUrl(req)));
  if (cardError) throw new HttpError(502, 'card-partly', `Only $${(refunded / 100).toFixed(2)} went back to the card (${String((cardError as any)?.message ?? cardError).slice(0, 120)}). Refund the rest another way.`);
  return { refunded: total, creditCode, status };
}

export const refundsFor = (orderId: number) => sql`SELECT amount_cents, method, reason, status, credit_code, actor, created_at FROM refunds WHERE order_id = ${orderId} ORDER BY created_at`;
