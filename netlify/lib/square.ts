// Card payments through Square's hosted checkout. Switched on only when SQUARE_ACCESS_TOKEN and
// SQUARE_LOCATION_ID are set; card details never touch this site.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './http';
import type { Row } from './db';
import type { PricedLine } from './pricing';

export const cardEnabled = () => Boolean(env('SQUARE_ACCESS_TOKEN') && env('SQUARE_LOCATION_ID'));
const base = () => (env('SQUARE_ENV') === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com');

export async function paymentLink(o: Row, lines: PricedLine[], redirectUrl: string) {
  const lineItems = lines.map(l => ({
    name: `${l.name_en}${l.option_en ? ` (${l.option_en})` : ''}`, quantity: String(l.qty),
    base_price_money: { amount: l.unit_cents, currency: 'CAD' },
  }));
  if (o.delivery_cents) lineItems.push({ name: 'Calgary delivery', quantity: '1', base_price_money: { amount: o.delivery_cents, currency: 'CAD' } });
  const r = await fetch(`${base()}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env('SQUARE_ACCESS_TOKEN')}`, 'content-type': 'application/json', 'square-version': '2025-01-23' },
    body: JSON.stringify({
      idempotency_key: o.ref,
      order: {
        location_id: env('SQUARE_LOCATION_ID'), reference_id: o.ref, line_items: lineItems,
        ...(o.discount_cents ? { discounts: [{ name: o.promo_code ? `Code ${o.promo_code}` : 'Discount', amount_money: { amount: o.discount_cents, currency: 'CAD' }, scope: 'ORDER' }] } : {}),
      },
      checkout_options: { redirect_url: redirectUrl, ask_for_shipping_address: false },
      pre_populated_data: { buyer_email: o.email },
    }),
  });
  const data: any = await r.json();
  if (!r.ok) throw new Error(`Square: ${JSON.stringify(data.errors ?? data).slice(0, 300)}`);
  return { url: data.payment_link.url as string, orderId: data.payment_link.order_id as string };
}

/** Square signs webhooks with HMAC-SHA256 over notification URL + raw body. */
export function verifyWebhook(rawBody: string, signature: string | null, notificationUrl: string) {
  const key = env('SQUARE_WEBHOOK_SIGNATURE_KEY');
  if (!key || !signature) return false;
  const expected = createHmac('sha256', key).update(notificationUrl + rawBody).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Refunds part or all of a card payment. Square returns the refund as PENDING, then COMPLETED. */
export async function refundPayment(paymentId: string, amount_cents: number, reason: string, key: string) {
  const r = await fetch(`${base()}/v2/refunds`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env('SQUARE_ACCESS_TOKEN')}`, 'content-type': 'application/json', 'square-version': '2025-01-23' },
    body: JSON.stringify({ idempotency_key: key, payment_id: paymentId, amount_money: { amount: amount_cents, currency: 'CAD' }, reason: reason.slice(0, 192) }),
  });
  const data: any = await r.json();
  if (!r.ok) throw new Error(`Square refund: ${JSON.stringify(data.errors ?? data).slice(0, 300)}`);
  return { id: data.refund.id as string, status: data.refund.status as string };
}

/** Checks the token and location from the admin desk: lists the account's locations. */
export async function squareCheck() {
  if (!cardEnabled()) return { ok: false, message: 'Card payments are off: SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are not both set in Netlify.' };
  try {
    const r = await fetch(`${base()}/v2/locations`, { headers: { authorization: `Bearer ${env('SQUARE_ACCESS_TOKEN')}`, 'square-version': '2025-01-23' } });
    const d: any = await r.json();
    if (!r.ok) return { ok: false, message: `Square refused the token: ${d.errors?.[0]?.detail ?? r.status}. Check SQUARE_ACCESS_TOKEN and that SQUARE_ENV matches it (sandbox or production).` };
    const locs = (d.locations ?? []).map((l: any) => ({ id: l.id, name: l.name, currency: l.currency }));
    const match = locs.find((l: any) => l.id === env('SQUARE_LOCATION_ID'));
    return match
      ? { ok: true, message: `Connected to Square (${env('SQUARE_ENV') === 'production' ? 'live payments' : 'sandbox, test payments only'}) at “${match.name}”.`, locations: locs }
      : { ok: false, message: 'The token works, but SQUARE_LOCATION_ID is not one of this account’s locations. Copy the right ID from the list.', locations: locs };
  } catch (e) { return { ok: false, message: `Could not reach Square: ${String(e).slice(0, 200)}` }; }
}
