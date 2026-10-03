// The evening email to the team (owners and helpers): tomorrow's pickups and deliveries, what to
// pack, gifts, and money still to collect. Sent by the daily job only when there are orders.
import { sql } from './db';
import { env, siteUrl } from './http';
import { send } from './email';
import { dollars } from './pricing';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function tomorrowEmail(date: string) {
  const orders = await sql`SELECT o.*, c.team_note FROM orders o LEFT JOIN customers c ON c.email = o.email
    WHERE o.slot_date = ${date} AND o.status <> 'cancelled' AND NOT o.is_sample ORDER BY o.slot_window, o.postal`;
  if (!orders.length) return 0;
  const pack = await sql`SELECT i.name_en, COALESCE(i.option_en, '') AS option, SUM(i.qty)::int AS qty FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE o.slot_date = ${date} AND o.status <> 'cancelled' AND NOT o.is_sample GROUP BY 1, 2 ORDER BY 1, 2`;
  const pick = orders.filter(o => o.method === 'pickup'), del = orders.filter(o => o.method === 'delivery');
  const collect = orders.filter(o => o.payment_status === 'unpaid' && o.payment === 'at-pickup').reduce((n, o) => n + o.total_cents, 0);
  const chase = orders.filter(o => o.payment_status === 'unpaid' && o.payment !== 'at-pickup');
  const gifts = orders.filter(o => o.gift);
  const notes = orders.filter(o => o.team_note || o.notes);
  const nice = new Date(date + 'T12:00:00Z').toLocaleDateString('en-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const windows = [...new Set(pick.map(o => o.slot_window))].map(w => `${w}: ${pick.filter(o => o.slot_window === w).length}`).join(' · ');
  const site = siteUrl();
  const html = `<div style="font:15px/1.55 Arial,sans-serif;color:#33211A;max-width:620px">
<h2 style="margin:0 0 4px">Tomorrow, ${esc(nice)}</h2>
<p style="margin:0 0 14px"><b>${pick.length}</b> pickup${pick.length === 1 ? '' : 's'}${windows ? ` (${esc(windows)})` : ''} · <b>${del.length}</b> deliver${del.length === 1 ? 'y' : 'ies'}${gifts.length ? ` · <b>${gifts.length}</b> gift${gifts.length === 1 ? '' : 's'}` : ''}</p>
${collect ? `<p>To collect at pickup or the door: <b>${dollars(collect)}</b></p>` : ''}
${chase.length ? `<p style="color:#A93B28">Not paid yet (e-Transfer or card): ${chase.map(o => `${esc(o.ref)} ${dollars(o.total_cents)}`).join(', ')}</p>` : ''}
<h3 style="margin:16px 0 6px">To pack</h3><ul>${pack.map(p => `<li>${p.qty} × ${esc(p.name_en)}${p.option ? ` (${esc(p.option)})` : ''}</li>`).join('')}</ul>
${del.length ? `<h3 style="margin:16px 0 6px">Deliveries, by area</h3><ol>${del.map(o => `<li>${esc(o.slot_window)} · ${esc(o.postal)} · ${esc(o.gift ? `${o.gift_to} (gift)` : o.name)}</li>`).join('')}</ol>` : ''}
${gifts.length ? `<h3 style="margin:16px 0 6px">Gift messages</h3><ul>${gifts.map(o => `<li>${esc(o.ref)} for ${esc(o.gift_to)}${o.gift_message ? `: “${esc(o.gift_message)}”` : ' (no message)'}</li>`).join('')}</ul>` : ''}
${notes.length ? `<h3 style="margin:16px 0 6px">Notes</h3><ul>${notes.map(o => `<li>${esc(o.ref)} ${esc(o.name)}: ${esc([o.notes, o.team_note].filter(Boolean).join(' · '))}</li>`).join('')}</ul>` : ''}
<p style="margin-top:18px"><a href="${site}/admin/" style="color:#A93B28">Day sheet and packing slips</a> · <a href="${site}/admin/driver/" style="color:#A93B28">Driver page</a></p></div>`;
  const text = `Tomorrow, ${nice}\n${pick.length} pickups, ${del.length} deliveries\n\nTo pack:\n${pack.map(p => `${p.qty} x ${p.name_en}${p.option ? ` (${p.option})` : ''}`).join('\n')}\n\n${site}/admin/`;
  const team = [...new Set([...env('ADMIN_EMAILS').split(','), ...env('STAFF_EMAILS').split(',')].map((e: string) => e.trim().toLowerCase()).filter(Boolean))];
  for (const to of team) await send({ to, subject: `Tomorrow: ${pick.length} pickup${pick.length === 1 ? '' : 's'}, ${del.length} deliver${del.length === 1 ? 'y' : 'ies'} (${nice})`, html, text, kind: 'team-tomorrow' });
  return orders.length;
}
