// Costs and margins. Owners enter what one unit of each product costs to make (ingredients,
// pouch or box, label); Numbers shows sales, cost and what is left for any range of days.
// Days are the order's pickup or delivery day. Uses today's cost for every sale in the range.
import { sql, one } from './db';
import { HttpError } from './http';
import { PRODUCTS } from '../../src/data/products';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function listCosts() {
  const rows = await sql`SELECT product_id, cost_cents, price_cents FROM product_settings`;
  const by = new Map(rows.map(r => [r.product_id as string, r]));
  return PRODUCTS.map(p => {
    const r = by.get(p.id);
    return { id: p.id, name: p.name.en, price_cents: (r?.price_cents ?? Math.round(p.price * 100)) as number, cost_cents: (r?.cost_cents ?? null) as number | null };
  });
}

export async function saveCost(id: string, cost: unknown, actor: string) {
  if (!PRODUCTS.some(p => p.id === id)) throw new HttpError(404, 'not-found');
  const c = cost === null || cost === '' ? null : Math.round(Number(cost));
  if (c !== null && (!Number.isInteger(c) || c < 0 || c > 100000)) throw new HttpError(400, 'cost', 'Cost must be between $0 and $1,000.');
  await sql`INSERT INTO product_settings (product_id, cost_cents, updated_by, updated_at) VALUES (${id}, ${c}, ${actor}, NOW())
    ON CONFLICT (product_id) DO UPDATE SET cost_cents = EXCLUDED.cost_cents, updated_by = EXCLUDED.updated_by, updated_at = NOW()`;
}

/** Sales, cost and margin per product for orders whose day falls in [from, to]. Leaves out sample
 * and cancelled orders. Discounts and refunds are taken off the total, not per product. */
export async function margins(from: string, to: string) {
  if (!DAY.test(from) || !DAY.test(to) || from > to) throw new HttpError(400, 'dates', 'Choose a start and end day.');
  const lines = await sql`SELECT i.product_id, MIN(i.name_en) AS name, SUM(i.qty)::int AS qty, SUM(i.qty * i.unit_cents)::int AS sales, MIN(s.cost_cents) AS cost_each
    FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN product_settings s ON s.product_id = i.product_id
    WHERE o.slot_date BETWEEN ${from} AND ${to} AND o.status <> 'cancelled' AND NOT o.is_sample
    GROUP BY i.product_id ORDER BY sales DESC`;
  const o = (await one`SELECT COUNT(*)::int AS orders, COALESCE(SUM(discount_cents), 0)::int AS discounts, COALESCE(SUM(refunded_cents), 0)::int AS refunds, COALESCE(SUM(delivery_cents), 0)::int AS delivery
    FROM orders WHERE slot_date BETWEEN ${from} AND ${to} AND status <> 'cancelled' AND NOT is_sample`)!;
  const rows = lines.map(l => {
    const cost = l.cost_each === null ? null : l.cost_each * l.qty;
    return { product_id: l.product_id as string, name: l.name as string, qty: l.qty as number, sales: l.sales as number, cost_each: l.cost_each as number | null, cost, margin: cost === null ? null : l.sales - cost, pct: cost === null || !l.sales ? null : Math.round(((l.sales - cost) / l.sales) * 100) };
  });
  const sales = rows.reduce((n, r) => n + r.sales, 0);
  const cost = rows.reduce((n, r) => n + (r.cost ?? 0), 0);
  const left = sales - o.discounts - o.refunds - cost;
  return {
    from, to, rows,
    totals: { orders: o.orders as number, sales, discounts: o.discounts as number, refunds: o.refunds as number, delivery: o.delivery as number, cost, left, pct: sales ? Math.round((left / sales) * 100) : null },
    missing: rows.filter(r => r.cost_each === null).map(r => r.name),
  };
}
