// Customer-facing order API: place an order (guest or logged in), see slots, view orders.
import type { Config } from '@netlify/functions';
import { json, fail, body, str, siteUrl, HttpError } from '../lib/http';
import { session } from '../lib/auth';
import { sql, one } from '../lib/db';
import { availability } from '../lib/slots';
import { createOrder, publicOrder, findForGuest, notify, notifyTeam, event } from '../lib/orders';
import { cardEnabled, paymentLink } from '../lib/square';
import { DELIVERY_CENTS, FREE_DELIVERY_FROM } from '../lib/pricing';

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/api/config' && req.method === 'GET') {
      return json({ card: cardEnabled(), deliveryCents: DELIVERY_CENTS, freeDeliveryFrom: FREE_DELIVERY_FROM });
    }
    if (path === '/api/slots' && req.method === 'GET') {
      return json(await availability());
    }
    if (path === '/api/orders' && req.method === 'POST') {
      const s = await session(req);
      const input = await body(req);
      const { order, lines, guestToken } = await createOrder(input, s, cardEnabled());
      let payUrl: string | null = null;
      if (order.payment === 'card') {
        try {
          const link = await paymentLink(order, lines, `${siteUrl(req)}/${order.lang}/thanks/?order=${order.ref}&t=${guestToken}`);
          payUrl = link.url;
          await sql`UPDATE orders SET square_order_id = ${link.orderId}, square_link_url = ${link.url} WHERE id = ${order.id}`;
        } catch (e) {
          console.error(e);
          await event(order.id, 'payment-link-failed', String(e).slice(0, 300), 'system');
        }
      }
      await notify('received', order, req, guestToken);
      await notifyTeam(order, req);
      return json({ ref: order.ref, token: guestToken, payUrl }, 201);
    }
    // A guest opening the link from their email.
    if (path === '/api/orders/view' && req.method === 'GET') {
      const o = await findForGuest(str(url.searchParams.get('ref'), 12), str(url.searchParams.get('t'), 64));
      return json({ order: await publicOrder(o) });
    }
    // A logged-in customer's own orders (any order placed with their email, guest or not).
    if (path === '/api/my/orders' && req.method === 'GET') {
      const s = await session(req);
      if (!s) throw new HttpError(401, 'login');
      const rows = await sql`SELECT * FROM orders WHERE email = ${s.email} ORDER BY created_at DESC LIMIT 100`;
      return json({ orders: await Promise.all(rows.map(publicOrder)) });
    }
    if (path === '/api/my/orders/cancel' && req.method === 'POST') {
      const s = await session(req);
      if (!s) throw new HttpError(401, 'login');
      const b = await body(req);
      const o = await one`UPDATE orders SET status = 'cancelled', updated_at = NOW()
        WHERE ref = ${str(b.ref, 12)} AND email = ${s.email} AND status = 'received' AND payment_status = 'unpaid' RETURNING *`;
      if (!o) throw new HttpError(409, 'cannot-cancel', 'This order can no longer be cancelled online. Reply to your confirmation email.');
      await event(o.id, 'status', 'cancelled', s.email);
      await notify('cancelled', o, req);
      return json({ ok: true });
    }
    throw new HttpError(404, 'not-found');
  } catch (e) { return fail(e); }
};

export const config: Config = { path: ['/api/config', '/api/slots', '/api/orders', '/api/orders/view', '/api/my/orders', '/api/my/orders/cancel'] };
