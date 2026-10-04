// The monthly report emailed to the owners on the 1st: last month against the month before.
import { sql, one } from './db';
import { send, monthlyReportEmails } from './email';
import { dollars } from './pricing';
import { addDays } from './slots';
import { env } from './http';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const monthStart = (date: string) => date.slice(0, 7) + '-01';
const prevMonth = (first: string) => monthStart(addDays(first, -1));

async function numbersFor(from: string, to: string) {
  const s: any = await one`SELECT COUNT(*)::int AS orders, COALESCE(SUM(total_cents + gift_card_cents - GREATEST(refunded_cents - GREATEST(paid_cents - total_cents, 0), 0)), 0)::int AS sales, COALESCE(SUM(refunded_cents), 0)::int AS refunds,
      COALESCE(SUM(discount_cents), 0)::int AS discounts, COUNT(*) FILTER (WHERE method = 'delivery')::int AS deliveries, COUNT(DISTINCT email)::int AS customers
    FROM orders WHERE NOT is_sample AND status <> 'cancelled' AND created_at >= ${from}::date AND created_at < ${to}::date`;
  const repeat = await one`SELECT COUNT(*)::int AS n FROM (SELECT email FROM orders WHERE NOT is_sample AND status <> 'cancelled' AND created_at >= ${from}::date AND created_at < ${to}::date
      AND email IN (SELECT email FROM orders WHERE NOT is_sample AND status <> 'cancelled' AND created_at < ${from}::date) GROUP BY email) x`;
  const top = await sql`SELECT i.name_en AS name, SUM(i.qty)::int AS qty FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE NOT o.is_sample AND o.status <> 'cancelled' AND o.created_at >= ${from}::date AND o.created_at < ${to}::date GROUP BY 1 ORDER BY qty DESC LIMIT 5`;
  const gc = await one`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_cents), 0)::int AS cents FROM gift_cards WHERE paid_at >= ${from}::date AND paid_at < ${to}::date`;
  const list = await one`SELECT COUNT(*)::int AS n FROM subscribers WHERE confirmed_at >= ${from}::date AND confirmed_at < ${to}::date AND unsubscribed_at IS NULL`;
  const visits = await one`SELECT COALESCE(SUM(n), 0)::int AS n FROM page_views WHERE day >= ${from}::date AND day < ${to}::date`;
  const regular = await one`SELECT COUNT(*)::int AS n FROM subscriptions WHERE status = 'active'`;
  const ask = await one`SELECT COUNT(*)::int AS n FROM chats WHERE created_at >= ${from}::date AND created_at < ${to}::date`;
  const help = await one`SELECT COUNT(*)::int AS n FROM tickets WHERE created_at >= ${from}::date AND created_at < ${to}::date`;
  return { ...s!, repeat: repeat!.n, top, giftCards: gc!, newSubscribers: list!.n, visits: visits!.n, regular: regular!.n, ask: ask?.n ?? 0, help: help?.n ?? 0 };
}

export async function monthlyReport(today: string) {
  const to = monthStart(today), from = prevMonth(to), before = prevMonth(from);
  const [m, p] = await Promise.all([numbersFor(from, to), numbersFor(before, from)]);
  const name = new Date(from + 'T12:00:00Z').toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const ch = (a: number, b: number) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : '');
  const rows: [string, string, string][] = [
    ['Sales (after refunds)', dollars(m.sales), ch(m.sales, p.sales)], ['Orders', String(m.orders), ch(m.orders, p.orders)],
    ['Average order', m.orders ? dollars(Math.round(m.sales / m.orders)) : '–', ''], ['Customers', String(m.customers), ch(m.customers, p.customers)],
    ['…who had ordered before', String(m.repeat), ''], ['Deliveries', String(m.deliveries), ''], ['Discounts given', dollars(m.discounts), ''], ['Refunds', dollars(m.refunds), ''],
    ['Gift cards sold', `${m.giftCards.n} · ${dollars(m.giftCards.cents)}`, ''], ['Regular orders running', String(m.regular), ''],
    ['New on the mailing list', String(m.newSubscribers), ''], ['Page visits', String(m.visits), ch(m.visits, p.visits)], ['Ask Hikaya chats', String(m.ask), ''], ['Help requests', String(m.help), ''],
  ];
  const html = `<h2 style="margin:0 0 6px">${esc(name)} at Hikaya</h2><p style="color:#66503F;margin:0 0 14px">Sample and cancelled orders left out. Change is against the month before.</p>
<table cellpadding="6" style="border-collapse:collapse;width:100%">${rows.map(r => `<tr style="border-bottom:1px solid #DFD1BA"><td>${esc(r[0])}</td><td style="text-align:right;font-weight:700">${esc(r[1])}</td><td style="text-align:right;color:#66503F">${esc(r[2])}</td></tr>`).join('')}</table>
<h3 style="margin:18px 0 6px">Best sellers</h3><ol>${m.top.map((t: any) => `<li>${esc(t.name)}: ${t.qty}</li>`).join('') || '<li>No orders yet.</li>'}</ol>`;
  const text = `${name} at Hikaya\n\n${rows.map(r => `${r[0]}: ${r[1]} ${r[2]}`).join('\n')}\n\nBest sellers:\n${m.top.map((t: any) => `- ${t.name}: ${t.qty}`).join('\n')}`;
  return { month: from.slice(0, 7), name, html, text, numbers: m };
}

/** On the 1st (Calgary time), once per month; on the 2nd or 3rd if it didn't go out on the 1st. */
export async function sendMonthlyReport(today: string, force = false) {
  if (!force && Number(today.slice(8, 10)) > 3) return null;
  const r = await monthlyReport(today);
  // Claimed before sending, so two runs can't both send it; given up again if nothing went out.
  const fresh = await one`INSERT INTO reports_sent (month) VALUES (${r.month}) ON CONFLICT (month) DO NOTHING RETURNING month`;
  if (!fresh && !force) return null;
  const statuses: string[] = [];
  for (const m of monthlyReportEmails(r.name, r.html, r.text)) statuses.push(await send(m));
  if (fresh && env('RESEND_API_KEY') && !statuses.includes('sent')) { await sql`DELETE FROM reports_sent WHERE month = ${r.month}`; return null; }
  return r.month;
}
