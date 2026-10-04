// Cookie-free visit counts: one number per day, page and referring site. Nothing about the
// visitor is stored, so no cookie banner is needed.
import { sql } from './db';
import { calgaryNow } from './slots';

export async function countView(path: string, ref: string, ownHost = '') {
  const p = path.replace(/[?#].*$/, '').slice(0, 120);
  if (!/^\/(en|ar)\//.test(p) && p !== '/') return;
  let host = '';
  try { host = ref ? new URL(ref).hostname.replace(/^www\./, '').slice(0, 80) : ''; } catch { /* not a URL */ }
  if (host === ownHost.replace(/^www\./, '') || host.endsWith('netlify.app') || host.endsWith('hikayacoffee.ca')) host = '';
  await sql`INSERT INTO page_views (day, path, ref, n) VALUES (${calgaryNow().date}, ${p}, ${host}, 1)
    ON CONFLICT (day, path, ref) DO UPDATE SET n = page_views.n + 1`;
}

export async function numbers(days = 30) {
  const byDay = await sql`SELECT day::text AS day, SUM(n)::int AS views FROM page_views WHERE day > CURRENT_DATE - ${days}::int GROUP BY day ORDER BY day`;
  const pages = await sql`SELECT path, SUM(n)::int AS views FROM page_views WHERE day > CURRENT_DATE - ${days}::int GROUP BY path ORDER BY views DESC LIMIT 12`;
  const refs = await sql`SELECT ref, SUM(n)::int AS views FROM page_views WHERE day > CURRENT_DATE - ${days}::int AND ref <> '' GROUP BY ref ORDER BY views DESC LIMIT 10`;
  const weeks = await sql`SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week, COUNT(*)::int AS orders, COALESCE(SUM(total_cents - GREATEST(refunded_cents - GREATEST(paid_cents - total_cents, 0), 0)), 0)::int AS cents
    FROM orders WHERE NOT is_sample AND status <> 'cancelled' AND created_at > NOW() - INTERVAL '12 weeks' GROUP BY 1 ORDER BY 1`;
  const top = await sql`SELECT i.name_en AS name, SUM(i.qty)::int AS qty FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE NOT o.is_sample AND o.status <> 'cancelled' AND o.created_at > NOW() - make_interval(days => ${days}) GROUP BY 1 ORDER BY qty DESC LIMIT 10`;
  return { byDay, pages, refs, weeks, top };
}
