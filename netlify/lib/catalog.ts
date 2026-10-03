// Live prices, sold-out switches and stock. The product file holds the defaults; the team's
// changes from the admin desk are stored in product_settings and win over the file.
import { env } from './http';
import { sql, one } from './db';
import { HttpError } from './http';
import { PRODUCTS } from '../../src/data/products';

export type Season = 'ramadan' | 'eid';
export type Seasons = Record<Season, boolean>;
/** shown = on the site; available = can be ordered (false shows "sold out"). */
export type Live = { price_cents: number; visible: boolean; available: boolean; stock: number | null; season: Season | null; shown: boolean; changed: boolean };

export const seasonOf = (id: string): Season | null => {
  const fam = PRODUCTS.find(p => p.id === id)?.fam;
  return fam === 'ramadan' || fam === 'eid' ? fam : null;
};

export async function getSeasons(): Promise<Seasons> {
  const r = await one`SELECT value FROM settings WHERE key = 'seasons'`;
  const v = r ? (typeof r.value === 'string' ? JSON.parse(r.value) : r.value) : {};
  return { ramadan: v.ramadan !== false, eid: v.eid !== false };
}
export async function saveSeasons(next: Partial<Seasons>) {
  const cur = await getSeasons();
  const v = { ramadan: typeof next.ramadan === 'boolean' ? next.ramadan : cur.ramadan, eid: typeof next.eid === 'boolean' ? next.eid : cur.eid };
  await sql`INSERT INTO settings (key, value) VALUES ('seasons', ${JSON.stringify(v)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return v;
}

export async function liveCatalog(): Promise<Record<string, Live>> {
  const [rows, seasons] = await Promise.all([sql`SELECT product_id, price_cents, visible, available, stock, daily_cap FROM product_settings`, getSeasons()]);
  const by = new Map(rows.map(r => [r.product_id, r]));
  return Object.fromEntries(PRODUCTS.map(p => {
    const r = by.get(p.id);
    const season = seasonOf(p.id);
    const visible = r ? r.visible : true;
    const shown = visible && (!season || seasons[season]);
    return [p.id, { price_cents: r?.price_cents ?? p.price * 100, visible, available: (r ? r.available : true) && shown, stock: r?.stock ?? null, dailyCap: r?.daily_cap ?? null, season, shown, changed: Boolean(r) }];
  }));
}

/** Takes stock for an order; all or nothing. Returns what was taken so it can be given back. */
/** When a limited product drops to this many or fewer, the owners get one email. */
export const LOW_STOCK = 3;
async function lowStockAlert(id: string, left: number) {
  const { send } = await import('./email');
  const name = PRODUCTS.find(p => p.id === id)?.name.en ?? id;
  const text = left === 0 ? `${name} just sold out on the site. Customers can ask to be emailed when it's back.\n\nChange the stock in Admin → Products.` : `Only ${left} left of ${name} on the site.\n\nChange the stock in Admin → Products.`;
  for (const to of env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean))
    await send({ to, subject: left === 0 ? `Sold out: ${name}` : `Running low: ${name} (${left} left)`, text, html: `<p style="font:15px Arial,sans-serif">${text.replace(/\n/g, '<br>')}</p>`, kind: 'team-low-stock' });
}

export async function takeStock(lines: { product_id: string; qty: number }[]) {
  const want = new Map<string, number>();
  for (const l of lines) want.set(l.product_id, (want.get(l.product_id) ?? 0) + l.qty);
  const taken: [string, number][] = [];
  for (const [id, qty] of want) {
    const r = await one`UPDATE product_settings SET stock = stock - ${qty} WHERE product_id = ${id} AND stock IS NOT NULL AND stock >= ${qty} RETURNING stock`;
    if (r) { taken.push([id, qty]); if (r.stock <= LOW_STOCK && r.stock + qty > LOW_STOCK) await lowStockAlert(id, r.stock); continue; }
    const cur = await one`SELECT stock FROM product_settings WHERE product_id = ${id} AND stock IS NOT NULL`;
    if (!cur) continue; // no limit on this product
    await giveStock(taken);
    const name = PRODUCTS.find(p => p.id === id)?.name.en ?? id;
    throw new HttpError(409, 'stock', cur.stock > 0 ? `Only ${cur.stock} left of ${name}. Lower the quantity.` : `${name} just sold out.`);
  }
  return taken;
}

export async function giveStock(taken: [string, number][]) {
  for (const [id, qty] of taken) await sql`UPDATE product_settings SET stock = stock + ${qty} WHERE product_id = ${id} AND stock IS NOT NULL`;
}

/** Puts a cancelled order's items back into stock. */
export async function restock(orderId: number) {
  const its = await sql`SELECT product_id, SUM(qty)::int AS qty FROM order_items WHERE order_id = ${orderId} GROUP BY product_id`;
  await giveStock(its.map(i => [i.product_id, i.qty] as [string, number]));
}

export async function saveProduct(id: string, change: { price_cents?: number | null; visible?: boolean; available?: boolean; stock?: number | null; daily_cap?: number | null }, actor: string) {
  if (!PRODUCTS.some(p => p.id === id)) throw new HttpError(404, 'not-found');
  const cur = await one`SELECT price_cents, visible, available, stock, daily_cap FROM product_settings WHERE product_id = ${id}`;
  const next = {
    price_cents: change.price_cents === undefined ? cur?.price_cents ?? null : change.price_cents,
    visible: change.visible ?? cur?.visible ?? true,
    available: change.available ?? cur?.available ?? true,
    stock: change.stock === undefined ? cur?.stock ?? null : change.stock,
    daily_cap: change.daily_cap === undefined ? cur?.daily_cap ?? null : change.daily_cap,
  };
  if (next.price_cents !== null && (!Number.isInteger(next.price_cents) || next.price_cents < 0 || next.price_cents > 100000)) throw new HttpError(400, 'price', 'Price must be between $0 and $1,000.');
  if (next.daily_cap !== null && (!Number.isInteger(next.daily_cap) || next.daily_cap < 1 || next.daily_cap > 100000)) throw new HttpError(400, 'cap', 'A daily limit must be a whole number of 1 or more.');
  if (next.stock !== null && (!Number.isInteger(next.stock) || next.stock < 0 || next.stock > 100000)) throw new HttpError(400, 'stock', 'Stock must be a whole number.');
  await sql`INSERT INTO product_settings (product_id, price_cents, visible, available, stock, daily_cap, updated_by, updated_at)
    VALUES (${id}, ${next.price_cents}, ${next.visible}, ${next.available}, ${next.stock}, ${next.daily_cap}, ${actor}, NOW())
    ON CONFLICT (product_id) DO UPDATE SET price_cents = EXCLUDED.price_cents, visible = EXCLUDED.visible, available = EXCLUDED.available, stock = EXCLUDED.stock, daily_cap = EXCLUDED.daily_cap, updated_by = EXCLUDED.updated_by, updated_at = NOW()`;
}

/** Daily limits for one day: a product's own daily cap, and the gift boxes the team can pack in a
 * day. `exceptOrder` leaves out an order being moved. */
export async function assertDayLimits(date: string, lines: { product_id: string; qty: number }[], giftBoxesPerDay: number | null, exceptOrder = 0) {
  const caps = await sql`SELECT product_id, daily_cap FROM product_settings WHERE daily_cap IS NOT NULL`;
  const want = new Map<string, number>(); for (const l of lines) want.set(l.product_id, (want.get(l.product_id) ?? 0) + l.qty);
  const taken = async (ids: string[]) => ids.length ? (await one`SELECT COALESCE(SUM(i.qty), 0)::int AS n FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE o.slot_date = ${date} AND o.status <> 'cancelled' AND NOT o.is_sample AND o.id <> ${exceptOrder} AND i.product_id = ANY(${ids})`)!.n as number : 0;
  for (const c of caps) {
    const n = want.get(c.product_id); if (!n) continue;
    const left = c.daily_cap - await taken([c.product_id]);
    const name = PRODUCTS.find(p => p.id === c.product_id)?.name.en ?? c.product_id;
    if (n > left) throw new HttpError(409, 'day-limit', left > 0 ? `Only ${left} more ${name} can be made for that day. Lower the quantity or choose another day.` : `${name} is fully booked for that day. Choose another day.`);
  }
  if (giftBoxesPerDay) {
    const boxIds = PRODUCTS.filter(p => p.kind === 'box' && p.insert !== 'everyday').map(p => p.id);
    const n = lines.filter(l => boxIds.includes(l.product_id)).reduce((a, l) => a + l.qty, 0);
    if (n) {
      const left = giftBoxesPerDay - await taken(boxIds);
      if (n > left) throw new HttpError(409, 'day-limit', left > 0 ? `We can pack ${left} more gift box${left === 1 ? '' : 'es'} for that day. Lower the quantity or choose another day.` : 'Gift boxes are fully booked for that day. Choose another day.');
    }
  }
}
