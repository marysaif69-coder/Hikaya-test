// The desk's first screen: what needs doing today, in one place. Every line says what it is and
// which tab fixes it. Money totals are for owners only.
import { sql, one } from './db';
import { addDays, calgaryNow } from './slots';
import { cashToHandIn } from './delivery';
import { checklists, todayLogs } from './ops';
import { PRODUCTS } from '../../src/data/products';
import { dollars } from './pricing';
import { KIND_LABEL } from './team';
import { listStats } from './list';

export type Todo = { level: 'now' | 'soon' | 'fyi'; text: string; tab: string; ref?: string };

export async function today(role: string, date = calgaryNow().date) {
  const tomorrow = addDays(date, 1), soon = addDays(date, 30);
  const todo: Todo[] = [];
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  const day = await sql`SELECT method, status, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE packed_at IS NULL AND status IN ('received', 'confirmed'))::int AS unpacked
    FROM orders WHERE slot_date = ${date} AND NOT is_sample AND status <> 'cancelled' GROUP BY method, status`;
  const sum = (f: (r: any) => boolean, k = 'n') => day.filter(f).reduce((n, r) => n + r[k], 0);
  const counts = {
    orders: sum(() => true), pickups: sum(r => r.method === 'pickup'), deliveries: sum(r => r.method === 'delivery'),
    toPack: sum(() => true, 'unpacked'), out: sum(r => r.status === 'out-for-delivery'), done: sum(r => r.status === 'completed'),
  };

  const fresh = (await one`SELECT COUNT(*)::int AS n FROM orders WHERE status = 'received' AND NOT is_sample AND status <> 'cancelled'`)!.n;
  if (fresh) todo.push({ level: 'now', text: `${plural(fresh, 'new order')} to confirm`, tab: 'orders' });
  if (counts.toPack) todo.push({ level: 'now', text: `${plural(counts.toPack, 'order')} for today still to pack`, tab: 'day' });

  const unassigned = await sql`SELECT slot_date::text AS day, COUNT(*)::int AS n FROM orders WHERE method = 'delivery' AND driver_email IS NULL AND status NOT IN ('completed', 'cancelled') AND NOT is_sample AND slot_date IN (${date}, ${tomorrow}) GROUP BY 1`;
  for (const u of unassigned) todo.push({ level: u.day === date ? 'now' : 'soon', text: `${plural(u.n, 'delivery', 'deliveries')} ${u.day === date ? 'today' : 'tomorrow'} with no driver`, tab: 'day' });

  // e-Transfers not in: orders due by tomorrow, and orders already handed over (money owed).
  const owed = await sql`SELECT ref, status, slot_date::text AS day, total_cents FROM orders WHERE payment = 'e-transfer' AND payment_status = 'unpaid' AND total_cents > 0 AND NOT is_sample AND status <> 'cancelled'
    AND (slot_date BETWEEN ${addDays(date, -14)} AND ${tomorrow} OR (status = 'completed' AND slot_date >= ${addDays(date, -60)})) ORDER BY slot_date`;
  const handed = owed.filter(o => o.status === 'completed'), due = owed.filter(o => o.status !== 'completed');
  const refs = (l: any[]) => `${l.map(o => o.ref).slice(0, 6).join(', ')}${l.length > 6 ? ` and ${l.length - 6} more` : ''}`;
  if (handed.length) todo.push({ level: 'now', text: `Handed over but e-Transfer not in: ${refs(handed)} (${dollars(handed.reduce((n, o) => n + o.total_cents, 0))} owed)`, tab: 'orders' });
  if (due.length) todo.push({ level: 'now', text: `e-Transfer not in yet for ${refs(due)} (due by tomorrow)`, tab: 'orders' });

  const gc = (await one`SELECT COUNT(*)::int AS n FROM gift_cards WHERE paid_at IS NULL AND cancelled_at IS NULL AND payment = 'e-transfer' AND created_at > NOW() - INTERVAL '30 days'`)!.n;
  if (gc) todo.push({ level: 'soon', text: `${plural(gc, 'gift card')} waiting for an e-Transfer`, tab: 'promos' });

  const inbox = (await one`SELECT COUNT(*)::int AS n FROM tickets WHERE status = 'open'`)!.n;
  if (inbox) todo.push({ level: 'now', text: `${plural(inbox, 'customer message')} to answer`, tab: 'inbox' });

  const cash = await cashToHandIn();
  for (const c of cash) todo.push({ level: 'soon', text: `${dollars(c.cents)} cash to collect from ${c.driver} (${plural(c.orders, 'order')})`, tab: 'drivers' });

  const low = await sql`SELECT product_id, stock FROM product_settings WHERE stock IS NOT NULL AND stock <= 5 AND visible ORDER BY stock`;
  if (low.length) todo.push({ level: 'soon', text: `Low stock: ${low.map(l => `${PRODUCTS.find(p => p.id === l.product_id)?.name.en ?? l.product_id} (${l.stock})`).join(', ')}`, tab: 'products' });

  const gaps = await sql`SELECT s.day::text AS day, s.kind, s.starts, s.ends, s.spots, COUNT(p.email)::int AS n FROM shifts s LEFT JOIN shift_people p ON p.shift_id = s.id
    WHERE s.day IN (${date}, ${tomorrow}) GROUP BY s.id HAVING COUNT(p.email) < s.spots ORDER BY s.day, s.starts`;
  for (const g of gaps) todo.push({ level: g.day === date ? 'now' : 'soon', text: `${g.day === date ? 'Today' : 'Tomorrow'} ${g.starts}–${g.ends} ${(KIND_LABEL[g.kind] ?? g.kind).toLowerCase()} shift needs ${g.spots - g.n} more`, tab: 'drivers' });

  const papers = await sql`SELECT COALESCE(name, email) AS who, licence_expires::text AS l, insurance_expires::text AS i, food_cert_expires::text AS f FROM team_members
    WHERE status <> 'off' AND (licence_expires < ${soon} OR insurance_expires < ${soon} OR food_cert_expires < ${soon})`;
  for (const p of papers) {
    const list = [['licence', p.l], ['car insurance', p.i], ['food handler certificate', p.f]].filter(([, d]) => d && d < soon);
    const expired = list.some(([, d]) => d! < date);
    todo.push({ level: expired ? 'now' : 'fyi', text: `${p.who}: ${list.map(([k, d]) => `${k} ${d! < date ? 'expired' : 'expires'} ${d}`).join(', ')}`, tab: 'drivers' });
  }

  if (counts.orders) {
    const signed = new Set((await todayLogs()).map((l: any) => l.checklist));
    const missing = (await checklists()).filter(c => !signed.has(c.key)).map(c => c.name);
    if (missing.length) todo.push({ level: 'fyi', text: `Food-safety checklists not signed yet today: ${missing.join(', ')}`, tab: 'production' });
  }

  const order = { now: 0, soon: 1, fyi: 2 };
  todo.sort((a, b) => order[a.level] - order[b.level]);

  let money: { today: number; week: number; orders: number } | null = null;
  if (role === 'admin') {
    const m = (await one`SELECT COALESCE(SUM(total_cents - refunded_cents) FILTER (WHERE (created_at AT TIME ZONE 'America/Edmonton')::date = ${date}), 0)::int AS today,
      COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Edmonton')::date = ${date})::int AS orders,
      COALESCE(SUM(total_cents - refunded_cents), 0)::int AS week
      FROM orders WHERE NOT is_sample AND status <> 'cancelled' AND created_at > NOW() - INTERVAL '7 days'`)!;
    money = { today: m.today, week: m.week, orders: m.orders };
  }
  const l = (await listStats())!;
  const list = { confirmed: l.confirmed as number, waiting: l.waiting as number, thisWeek: l.this_week as number, fromSoon: l.from_soon as number };
  return { date, counts, todo, money, list };
}
