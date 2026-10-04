// Square tells us when a card payment completes; we mark the order paid.
// In Square's Developer Dashboard, subscribe this URL to payment.updated.
import { loadOverrides } from '../lib/business';
import type { Config } from '@netlify/functions';
import { json, siteUrl } from '../lib/http';
import { one, sql } from '../lib/db';
import { verifyWebhook } from '../lib/square';
import { setPayment, event } from '../lib/orders';
import { pushOwners } from '../lib/push';
import { giftCardPaid } from '../lib/giftcards';

export default async (req: Request) => {
    await loadOverrides();
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const raw = await req.text();
  const notificationUrl = `${siteUrl(req)}/api/square/webhook`;
  if (!verifyWebhook(raw, req.headers.get('x-square-hmacsha256-signature'), notificationUrl)) return json({ error: 'signature' }, 401);
  const evt = JSON.parse(raw);
  const payment = evt?.data?.object?.payment;
  if (evt?.type === 'payment.updated' && payment?.status === 'COMPLETED' && payment.order_id) {
    // Look the order up through every checkout made for it, so a payment on an older link counts.
    const o = await one`SELECT o.id, o.ref, o.status, o.payment_status, o.total_cents, o.paid_cents FROM orders o
      WHERE o.square_order_id = ${payment.order_id} OR o.id = (SELECT order_id FROM order_square_orders WHERE square_order_id = ${payment.order_id}) LIMIT 1`;
    if (o) {
      // Each payment is kept (a balance paid after a change is a second one), so refunds can reach both.
      const amount = Number(payment.amount_money?.amount ?? payment.total_money?.amount) || Math.max(o.total_cents - o.paid_cents, 0);
      const fresh = await one`INSERT INTO order_payments (order_id, square_payment_id, amount_cents) VALUES (${o.id}, ${payment.id}, ${amount}) ON CONFLICT (square_payment_id) DO NOTHING RETURNING id`;
      // Count what this payment brought in; the order is paid once that reaches its total (a payment
      // on an older link, made before a change, may not cover all of it).
      const u = fresh ? await one`UPDATE orders SET square_payment_id = ${payment.id}, paid_cents = paid_cents + ${amount} WHERE id = ${o.id} RETURNING paid_cents, total_cents` : null;
      if (u && o.payment_status === 'unpaid') {
        if (u.paid_cents >= u.total_cents) await setPayment(o.ref, 'paid', 'square');
        else await event(o.id, 'payment', `Card payment of $${(amount / 100).toFixed(2)}; $${((u.total_cents - u.paid_cents) / 100).toFixed(2)} still to pay`, 'square');
      }
      // The money came in for an order that was already cancelled: record it so it can be refunded,
      // and tell the owners. They decide; nothing is refunded automatically.
      if (fresh && o.status === 'cancelled') {
        await event(o.id, 'payment', 'Paid after it was cancelled: refund it', 'square');
        await pushOwners({ title: `Paid after cancelling: ${o.ref}`, body: 'Refund it in the desk.', url: `/admin/?order=${o.ref}`, tag: `order-${o.ref}` });
      }
    }
    if (!o) {
      const g = await one`SELECT ref FROM gift_cards WHERE square_order_id = ${payment.order_id}`;
      if (g) await giftCardPaid(g.ref, req, payment.id);
    }
  }
  return json({ ok: true });
};

export const config: Config = { path: '/api/square/webhook' };
