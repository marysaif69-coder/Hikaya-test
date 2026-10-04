// "Email me when it's back": for sold-out products and Ramadan/Eid boxes out of season.
import { sql } from './db';
import { HttpError, isEmail, siteUrl } from './http';
import { PRODUCTS } from '../../src/data/products';
import { liveCatalog } from './catalog';
import { send, backInStockEmail } from './email';

export async function addAlert(productId: string, email: string, lang: 'en' | 'ar') {
  if (!PRODUCTS.some(p => p.id === productId)) throw new HttpError(404, 'not-found');
  const e = email.trim().toLowerCase();
  if (!isEmail(e)) throw Object.assign(new HttpError(400, 'invalid', 'Check the email.'), { fields: { email: 'email' } });
  await sql`INSERT INTO stock_alerts (product_id, email, lang) VALUES (${productId}, ${e}, ${lang})
    ON CONFLICT (product_id, email) DO UPDATE SET notified_at = NULL, lang = EXCLUDED.lang`;
}

/** Emails everyone waiting for a product that can be ordered again. Returns how many were told. */
export async function sendBackInStock(req?: Request) {
  const live = await liveCatalog();
  const ready = Object.entries(live).filter(([, l]) => l.shown && l.available && l.stock !== 0 && l.price_cents != null).map(([id]) => id);
  if (!ready.length) return 0;
  const rows = await sql`SELECT id, product_id, email, lang FROM stock_alerts WHERE notified_at IS NULL AND product_id = ANY(${ready}) LIMIT 500`;
  for (const r of rows) {
    const p = PRODUCTS.find(x => x.id === r.product_id)!;
    await send(backInStockEmail(r.email, r.lang === 'ar' ? 'ar' : 'en', p.name, `${siteUrl(req)}/${r.lang}/shop/${p.id}/`, siteUrl(req), null));
    await sql`UPDATE stock_alerts SET notified_at = NOW() WHERE id = ${r.id}`;
  }
  return rows.length;
}

export const waitingByProduct = async () => Object.fromEntries((await sql`SELECT product_id, COUNT(*)::int AS n FROM stock_alerts WHERE notified_at IS NULL GROUP BY product_id`).map(r => [r.product_id, r.n]));
