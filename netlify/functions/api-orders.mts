// Customer-facing order API: place an order (guest or logged in), see slots, view orders.
import { loadOverrides, publicBusiness } from '../lib/business';
import type { Config } from '@netlify/functions';
import { json, fail, body, str, siteUrl, HttpError } from '../lib/http';
import { session } from '../lib/auth';
import { sql, one } from '../lib/db';
import { availability } from '../lib/slots';
import { createOrder, finishOrder, moveOrder, publicOrder, findForGuest, notify, event, releaseOrder } from '../lib/orders';
import { startSubscription, mySubscriptions, changeSubscription } from '../lib/subscriptions';
import { buyGiftCard, giftCardBalance } from '../lib/giftcards';
import { liveCatalog, getSeasons } from '../lib/catalog';
import { checkPromo } from '../lib/promos';
import { priceCart } from '../lib/pricing';
import { limit, ipKey } from '../lib/rate';
import { addAlert } from '../lib/alerts';
import { subscribe, confirm, unsubscribe } from '../lib/list';
import { countView } from '../lib/visits';
import { cardEnabled } from '../lib/square';
import { DELIVERY_CENTS, FREE_DELIVERY_FROM } from '../lib/pricing';

export default async (req: Request) => {
  try {
    await loadOverrides();
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/api/config' && req.method === 'GET') {
      return json({ card: cardEnabled(), deliveryCents: DELIVERY_CENTS, freeDeliveryFrom: FREE_DELIVERY_FROM });
    }
    // Live prices and sold-out switches; the static pages patch their prices from this.
    if (path === '/api/catalog' && req.method === 'GET') {
      const [live, seasons] = await Promise.all([liveCatalog(), getSeasons()]);
      return json({ business: await publicBusiness(), seasons, products: Object.fromEntries(Object.entries(live).map(([id, l]) => [id, { price: l.price_cents == null ? null : l.price_cents / 100, shown: l.shown, available: l.available && l.stock !== 0, left: l.stock !== null && l.stock <= 10 ? l.stock : null }])) },
        200, { 'cache-control': 'no-store' });
    }
    // Check a promo code against the basket before ordering.
    if (path === '/api/promo' && req.method === 'POST') {
      await limit(`promo:${ipKey(req)}`, 30, 60);
      const b = await body(req);
      const lines = priceCart(b.lines, await liveCatalog());
      const sub = lines.reduce((n, l) => n + l.unit_cents * l.qty, 0);
      const p = await checkPromo(b.code, sub, str(b.email, 254));
      return json({ code: p.code, discount: p.discount_cents, freeDelivery: p.free_delivery, label: p.label });
    }
    // "Email me when it's back"
    if (path === '/api/notify-me' && req.method === 'POST') {
      await limit(`alert:${ipKey(req)}`, 20, 60);
      const b = await body(req);
      await addAlert(str(b.product, 40), str(b.email, 254), b.lang === 'ar' ? 'ar' : 'en');
      return json({ ok: true });
    }
    // Mailing list: sign up (needs the consent tick), confirm from the email, leave in one click.
    if (path === '/api/list' && req.method === 'POST') {
      await limit(`list:${ipKey(req)}`, 10, 60);
      const b = await body(req);
      if (b.consent !== true) throw Object.assign(new HttpError(400, 'consent', 'Tick the box to agree to receive our emails.'), { fields: { consent: 'required' } });
      return json(await subscribe(str(b.email, 254), b.lang === 'ar' ? 'ar' : 'en', b.source === 'soon' ? 'soon' : 'footer', req));
    }
    if (path === '/api/list/confirm' && req.method === 'GET') {
      try { const lang = await confirm(str(url.searchParams.get('t'), 64)); return Response.redirect(`${siteUrl(req)}/${lang}/thanks/?list=1`, 303); }
      catch { return Response.redirect(`${siteUrl(req)}/en/thanks/?listexpired=1`, 303); }
    }
    if (path === '/api/list/unsubscribe' && req.method === 'GET') {
      const lang = await unsubscribe(str(url.searchParams.get('t'), 64));
      return Response.redirect(`${siteUrl(req)}/${lang}/thanks/?unsub=1`, 303);
    }
    // Cookie-free page counts.
    if (path === '/api/hit' && req.method === 'POST') {
      const b = await body(req, 2000);
      await countView(str(b.path, 200), str(b.ref, 300), url.hostname);
      return new Response(null, { status: 204 });
    }
    if (path === '/api/slots' && req.method === 'GET') {
      return json(await availability());
    }
    if (path === '/api/orders' && req.method === 'POST') {
      const s = await session(req);
      if (!s || s.role === 'customer') await limit(`order:${ipKey(req)}`, 8, 60, 'Too many orders from here in a short time. Please wait, or write to us with the help form.');
      const input = await body(req);
      const made = await createOrder(input, s, cardEnabled());
      const { order, guestToken } = made;
      const every = [2, 4].includes(Number(input.repeat)) ? Number(input.repeat) : 0;
      const payUrl = await finishOrder(made, req, every ? { every_weeks: every } : {});
      if (every && !order.is_sample) await startSubscription(order, input, every, req).catch(e => console.error('subscription', e));
      if (input.newsletter === true) await subscribe(order.email, order.lang, 'checkout', req).catch(e => console.error('newsletter', e));
      return json({ ref: order.ref, token: guestToken, payUrl }, 201);
    }
    // Gift cards: buy one, or check a code's balance at checkout.
    if (path === '/api/giftcard' && req.method === 'POST') {
      await limit(`giftcard:${ipKey(req)}`, 10, 60);
      return json(await buyGiftCard(await body(req), req), 201);
    }
    if (path === '/api/giftcard/check' && req.method === 'POST') {
      await limit(`gccheck:${ipKey(req)}`, 20, 60, 'Too many tries. Please wait a little.');
      return json(await giftCardBalance((await body(req)).code));
    }
    // Regular orders: the customer's own, and skip / pause / resume / stop.
    if (path === '/api/my/subscriptions' && req.method === 'GET') {
      const s = await session(req);
      if (!s) throw new HttpError(401, 'login');
      return json({ subscriptions: await mySubscriptions(s.email) });
    }
    if (path === '/api/my/subscriptions' && req.method === 'POST') {
      const s = await session(req);
      if (!s) throw new HttpError(401, 'login');
      const b = await body(req);
      return json(await changeSubscription(s.email, Number(b.id), str(b.action, 10), req));
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
    // Logged-in customers: the details from their last order, to fill in the checkout form.
    if (path === '/api/my/details' && req.method === 'GET') {
      const s = await session(req);
      if (!s) throw new HttpError(401, 'login');
      const o = await one`SELECT name, phone, method, street, postal FROM orders WHERE email = ${s.email} AND NOT is_sample ORDER BY created_at DESC LIMIT 1`;
      const c = await one`SELECT name, phone FROM customers WHERE email = ${s.email}`;
      return json({ name: o?.name ?? c?.name ?? '', phone: o?.phone ?? c?.phone ?? '', street: o?.street ?? '', postal: o?.postal ?? '' });
    }
    // Change the day or time of one's own order, while that day is still open for orders.
    if (path === '/api/my/orders/move' && req.method === 'POST') {
      const s = await session(req);
      if (!s) throw new HttpError(401, 'login');
      const b = await body(req);
      const o = await moveOrder(str(b.ref, 12), str(b.day, 10), str(b.window, 20), s.email, req, { email: s.email });
      return json({ order: await publicOrder(o) });
    }
    if (path === '/api/my/orders/cancel' && req.method === 'POST') {
      const s = await session(req);
      if (!s) throw new HttpError(401, 'login');
      const b = await body(req);
      const o = await one`UPDATE orders SET status = 'cancelled', updated_at = NOW()
        WHERE ref = ${str(b.ref, 12)} AND email = ${s.email} AND status = 'received' AND payment_status = 'unpaid' RETURNING *`;
      if (!o) throw new HttpError(409, 'cannot-cancel', 'This order can no longer be cancelled online. Reply to your confirmation email.');
      await releaseOrder(o);
      await event(o.id, 'status', 'cancelled', s.email);
      await notify('cancelled', o, req);
      return json({ ok: true });
    }
    throw new HttpError(404, 'not-found');
  } catch (e) { return fail(e); }
};

export const config: Config = { path: ['/api/config', '/api/catalog', '/api/promo', '/api/notify-me', '/api/list', '/api/list/confirm', '/api/list/unsubscribe', '/api/hit', '/api/giftcard', '/api/giftcard/check', '/api/my/subscriptions', '/api/slots', '/api/orders', '/api/orders/view', '/api/my/orders', '/api/my/orders/cancel', '/api/my/orders/move', '/api/my/details'] };
