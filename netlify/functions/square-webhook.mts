// Square tells us when a card payment completes; we mark the order paid.
// In Square's Developer Dashboard, subscribe this URL to payment.updated.
import { loadOverrides } from '../lib/business';
import type { Config } from '@netlify/functions';
import { json, siteUrl } from '../lib/http';
import { one, sql } from '../lib/db';
import { verifyWebhook } from '../lib/square';
import { setPayment } from '../lib/orders';
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
    const o = await one`SELECT id, ref, payment_status, total_cents, paid_cents FROM orders WHERE square_order_id = ${payment.order_id}`;
    if (o) {
      // Each payment is kept (a balance paid after a change is a second one), so refunds can reach both.
      const amount = Number(payment.amount_money?.amount ?? payment.total_money?.amount) || Math.max(o.total_cents - o.paid_cents, 0);
      await sql`INSERT INTO order_payments (order_id, square_payment_id, amount_cents) VALUES (${o.id}, ${payment.id}, ${amount}) ON CONFLICT (square_payment_id) DO NOTHING`;
      await sql`UPDATE orders SET square_payment_id = ${payment.id} WHERE id = ${o.id}`;
    }
    if (o && o.payment_status === 'unpaid') await setPayment(o.ref, 'paid', 'square');
    if (!o) {
      const g = await one`SELECT ref FROM gift_cards WHERE square_order_id = ${payment.order_id}`;
      if (g) await giftCardPaid(g.ref, req, payment.id);
    }
  }
  return json({ ok: true });
};

export const config: Config = { path: '/api/square/webhook' };
