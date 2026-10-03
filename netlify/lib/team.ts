// The internal team: shifts people sign up for (or are given), check-in and check-out for hours
// (paid or volunteer), each person's papers with expiry dates, and reminders for both.
import { sql, one, type Row } from './db';
import { HttpError, env, siteUrl } from './http';
import { send } from './email';
import { pushTo } from './push';
import { addDays, calgaryNow } from './slots';
import type { Session } from './auth';

export const KINDS = ['packing', 'driving', 'counter', 'other'] as const;
export const KIND_LABEL: Record<string, string> = { packing: 'Packing', driving: 'Driving', counter: 'Pickup counter', other: 'Other' };
const day = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);
const hhmm = (v: unknown) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : null;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Who may take a kind of shift: drivers drive; packers and helpers pack or run the counter. */
export function canTake(role: string, kind: string) {
  if (role === 'admin' || role === 'staff') return true;
  if (kind === 'driving') return role === 'driver';
  return role === 'packer' || kind === 'other';
}

export async function saveShift(b: any, by: string) {
  const d = String(b?.day ?? ''), starts = hhmm(b?.starts), ends = hhmm(b?.ends), kind = (KINDS as readonly string[]).includes(b?.kind) ? b.kind : null;
  const spots = Math.max(1, Math.min(20, Math.round(Number(b?.spots) || 1)));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !starts || !ends || ends <= starts || !kind) throw new HttpError(400, 'invalid', 'Choose a day, a start and end time, and what the shift is for.');
  const repeat = Math.max(0, Math.min(12, Math.round(Number(b?.repeatWeeks) || 0)));
  const made: number[] = [];
  for (let w = 0; w <= repeat; w++) {
    const r = await one`INSERT INTO shifts (day, starts, ends, kind, spots, note, created_by) VALUES (${addDays(d, w * 7)}, ${starts}, ${ends}, ${kind}, ${spots}, ${String(b?.note ?? '').slice(0, 300) || null}, ${by}) RETURNING id`;
    made.push(r!.id);
  }
  return { made: made.length };
}
export async function deleteShift(id: number) {
  const people = await sql`SELECT p.email, s.day, s.starts, s.ends, s.kind FROM shift_people p JOIN shifts s ON s.id = p.shift_id WHERE p.shift_id = ${id}`;
  await sql`DELETE FROM shifts WHERE id = ${id}`;
  for (const p of people) await send({ to: p.email, subject: `Shift cancelled: ${KIND_LABEL[p.kind]} ${day(p.day)} ${p.starts}`, text: `The ${KIND_LABEL[p.kind].toLowerCase()} shift on ${day(p.day)}, ${p.starts}–${p.ends} was cancelled by the owners. Thank you.`, html: `<p style="font:15px Arial,sans-serif">The ${esc(KIND_LABEL[p.kind].toLowerCase())} shift on ${day(p.day)}, ${p.starts}–${p.ends} was cancelled by the owners. Thank you.</p>`, kind: 'team-shift-cancelled' });
  return { ok: true };
}

/** Shifts from a day for some weeks, with who is on each. */
export async function shiftsFrom(from: string, days = 21) {
  const rows = await sql`SELECT s.*, COALESCE(json_agg(json_build_object('email', p.email, 'how', p.how, 'in', p.checked_in_at, 'out', p.checked_out_at, 'name', m.name)) FILTER (WHERE p.email IS NOT NULL), '[]') AS people
    FROM shifts s LEFT JOIN shift_people p ON p.shift_id = s.id LEFT JOIN team_members m ON m.email = p.email
    WHERE s.day BETWEEN ${from} AND ${addDays(from, days)} GROUP BY s.id ORDER BY s.day, s.starts, s.kind`;
  return rows.map(r => ({ id: r.id, day: day(r.day), starts: r.starts, ends: r.ends, kind: r.kind, label: KIND_LABEL[r.kind], spots: r.spots, note: r.note,
    people: (typeof r.people === 'string' ? JSON.parse(r.people) : r.people) as { email: string; how: string; in: string | null; out: string | null; name: string | null }[] }));
}

export async function signUp(s: Session, id: number) {
  const sh = await one`SELECT * FROM shifts WHERE id = ${id}`;
  if (!sh) throw new HttpError(404, 'not-found');
  if (day(sh.day) < calgaryNow().date) throw new HttpError(400, 'past', 'That shift has passed.');
  if (!canTake(s.role, sh.kind)) throw new HttpError(403, 'role', sh.kind === 'driving' ? 'Driving shifts are for drivers.' : 'This shift is for packers and helpers.');
  if (sh.kind === 'driving') await assertPapers(s.email, day(sh.day));
  const n = await one`SELECT COUNT(*)::int AS n FROM shift_people WHERE shift_id = ${id}`;
  if ((n?.n ?? 0) >= sh.spots) throw new HttpError(409, 'full', 'That shift is full.');
  await sql`INSERT INTO shift_people (shift_id, email) VALUES (${id}, ${s.email}) ON CONFLICT DO NOTHING`;
  return { ok: true };
}
/** Leaving a shift: up to 24 hours before it starts; after that, ask the owners. */
export async function leave(s: Session, id: number) {
  const sh = await one`SELECT * FROM shifts WHERE id = ${id}`;
  if (!sh) throw new HttpError(404, 'not-found');
  // Hours until the shift, in Calgary time (date and hour are enough for a 24-hour rule).
  const now = calgaryNow(), [h] = String(sh.starts).split(':').map(Number);
  const daysAhead = (Date.parse(day(sh.day)) - Date.parse(now.date)) / 864e5;
  if (daysAhead * 24 + h - now.hour < 24) throw new HttpError(409, 'too-late', 'It is less than 24 hours to the shift. Message the owners instead.');
  await sql`DELETE FROM shift_people WHERE shift_id = ${id} AND email = ${s.email} AND checked_in_at IS NULL`;
  return { ok: true };
}
export async function assignShift(id: number, email: string, by: string) {
  const sh = await one`SELECT * FROM shifts WHERE id = ${id}`;
  if (!sh) throw new HttpError(404, 'not-found');
  const m = await one`SELECT role, drives FROM team_members WHERE email = ${email} AND status <> 'off'`;
  const isOwner = env('ADMIN_EMAILS').split(',').map((e: string) => e.trim().toLowerCase()).includes(email);
  if (!m && !isOwner) throw new HttpError(400, 'who', 'That person is not on the team.');
  if (sh.kind === 'driving' && m && m.role !== 'driver' && !m.drives) throw new HttpError(400, 'role', 'Driving shifts are for drivers (or people marked "also drives").');
  if (sh.kind === 'driving' && m) await assertPapers(email, day(sh.day));
  await sql`INSERT INTO shift_people (shift_id, email, how) VALUES (${id}, ${email}, 'assigned') ON CONFLICT (shift_id, email) DO UPDATE SET how = 'assigned'`;
  await send({ to: email, subject: `You're on: ${KIND_LABEL[sh.kind]} ${day(sh.day)} ${sh.starts}–${sh.ends}`, text: `The owners put you on a ${KIND_LABEL[sh.kind].toLowerCase()} shift: ${day(sh.day)}, ${sh.starts}–${sh.ends}.${sh.note ? `\n${sh.note}` : ''}\n\nSee it in the team app: ${siteUrl()}/admin/driver/`, html: `<p style="font:15px Arial,sans-serif">The owners put you on a ${esc(KIND_LABEL[sh.kind].toLowerCase())} shift: <b>${day(sh.day)}, ${sh.starts}–${sh.ends}</b>.${sh.note ? `<br>${esc(sh.note)}` : ''}<br><br><a href="${siteUrl()}/admin/driver/">Open the team app</a></p>`, kind: 'team-shift-assigned' });
  return { ok: true };
}
export const unassign = (id: number, email: string) => sql`DELETE FROM shift_people WHERE shift_id = ${id} AND email = ${email}`.then(() => ({ ok: true }));

/** Check in and out on the day of the shift (from 1 hour before it starts). */
export async function clock(s: Session, id: number, what: 'in' | 'out') {
  const r = await one`SELECT p.*, s.day, s.starts FROM shift_people p JOIN shifts s ON s.id = p.shift_id WHERE p.shift_id = ${id} AND p.email = ${s.email}`;
  if (!r) throw new HttpError(404, 'not-found', 'You are not on that shift.');
  if (day(r.day) !== calgaryNow().date) throw new HttpError(400, 'not-today', 'You can check in on the day of the shift.');
  if (what === 'in') {
    if (r.checked_in_at) return { ok: true };
    await sql`UPDATE shift_people SET checked_in_at = NOW() WHERE shift_id = ${id} AND email = ${s.email}`;
  } else {
    if (!r.checked_in_at) throw new HttpError(400, 'not-in', 'Check in first.');
    await sql`UPDATE shift_people SET checked_out_at = NOW() WHERE shift_id = ${id} AND email = ${s.email}`;
  }
  return { ok: true };
}

/** Hours per person between two days (from check-in/out). The team can correct times in the desk. */
export async function hours(from: string, to: string, email?: string) {
  const rows = await sql`SELECT p.email, m.name, m.role, m.volunteer, s.day, s.kind, s.starts, s.ends, p.checked_in_at, p.checked_out_at
    FROM shift_people p JOIN shifts s ON s.id = p.shift_id LEFT JOIN team_members m ON m.email = p.email
    WHERE s.day BETWEEN ${from} AND ${to} AND (${email ?? ''} = '' OR p.email = ${email ?? ''}) ORDER BY s.day, s.starts`;
  const mins = (r: Row) => (r.checked_in_at && r.checked_out_at ? Math.max(0, Math.round((new Date(r.checked_out_at).getTime() - new Date(r.checked_in_at).getTime()) / 60000)) : 0);
  const people = new Map<string, { email: string; name: string | null; role: string | null; volunteer: boolean; shifts: number; minutes: number; missing: number }>();
  for (const r of rows) {
    const p = people.get(r.email) ?? { email: r.email, name: r.name, role: r.role, volunteer: Boolean(r.volunteer), shifts: 0, minutes: 0, missing: 0 };
    p.shifts++; p.minutes += mins(r); if (day(r.day) < calgaryNow().date && !r.checked_out_at) p.missing++;
    people.set(r.email, p);
  }
  return { from, to, people: [...people.values()], shifts: rows.map(r => ({ email: r.email, day: day(r.day), kind: r.kind, planned: `${r.starts}–${r.ends}`, in: r.checked_in_at, out: r.checked_out_at, minutes: mins(r) })) };
}
export async function fixTimes(id: number, email: string, b: any) {
  const t = (v: unknown) => (typeof v === 'string' && v ? new Date(v) : null);
  const i = t(b?.in), o = t(b?.out);
  if ((i && isNaN(i.getTime())) || (o && isNaN(o.getTime())) || (i && o && o < i)) throw new HttpError(400, 'invalid', 'Check the times.');
  await sql`UPDATE shift_people SET checked_in_at = ${i}, checked_out_at = ${o} WHERE shift_id = ${id} AND email = ${email}`;
  return { ok: true };
}
export function hoursCsv(h: Awaited<ReturnType<typeof hours>>) {
  const t = (v: unknown) => (v ? new Date(v as string).toLocaleString('en-CA', { timeZone: 'America/Edmonton', hour12: false }) : '');
  const cell = (v: unknown) => { const x = String(v ?? ''); return /^[=+\-@]/.test(x) ? `'${x}` : /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  return ['date,email,shift,planned,checked_in,checked_out,hours', ...h.shifts.map(s => [s.day, s.email, s.kind, s.planned, t(s.in), t(s.out), (s.minutes / 60).toFixed(2)].map(cell).join(','))].join('\n');
}

// ---------- papers ----------
const DOCS = [
  { key: 'licence_expires', label: "driver's licence", forDrivers: true },
  { key: 'insurance_expires', label: 'car insurance', forDrivers: true },
  { key: 'food_cert_expires', label: 'food handler certificate', forDrivers: false },
] as const;

/** Drivers need a licence and insurance that are valid on the day. */
export async function assertPapers(email: string, onDay: string) {
  const m = await one`SELECT role, drives, licence_expires, insurance_expires FROM team_members WHERE email = ${email}`;
  if (!m || (m.role !== 'driver' && !m.drives)) return;
  for (const k of ['licence_expires', 'insurance_expires'] as const) {
    const v = m[k] ? day(m[k]) : null;
    if (!v) throw new HttpError(400, 'papers', `Add the ${k === 'licence_expires' ? "driver's licence" : 'car insurance'} expiry date in the team app (My details) first.`);
    if (v < onDay) throw new HttpError(400, 'papers', `The ${k === 'licence_expires' ? "driver's licence" : 'car insurance'} has expired (${v}). Update it in the team app.`);
  }
}

export async function saveProfile(s: Session, b: any) {
  const d = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const m = await one`UPDATE team_members SET phone = COALESCE(${String(b?.phone ?? '').trim().slice(0, 40) || null}, phone), vehicle = ${String(b?.vehicle ?? '').trim().slice(0, 120) || null},
      licence_expires = ${d(b?.licence_expires)}, insurance_expires = ${d(b?.insurance_expires)}, food_cert_expires = ${d(b?.food_cert_expires)}, docs_reminded = '{}'
    WHERE email = ${s.email} RETURNING *`;
  if (!m) throw new HttpError(404, 'not-found', 'You are not on the team list.');
  return { ok: true };
}

/** Daily: papers expiring within 30 days (or expired) → one email to the person and the owners. */
export async function paperReminders(today = calgaryNow().date) {
  const rows = await sql`SELECT * FROM team_members WHERE status <> 'off'`;
  let sentN = 0;
  for (const m of rows) {
    const reminded = (typeof m.docs_reminded === 'string' ? JSON.parse(m.docs_reminded) : m.docs_reminded) ?? {};
    for (const doc of DOCS) {
      if (doc.forDrivers && m.role !== 'driver' && !m.drives) continue;
      const v = m[doc.key] ? day(m[doc.key]) : null;
      if (!v || v > addDays(today, 30) || reminded[doc.key] === v) continue;
      const expired = v < today;
      const text = `${m.name ?? m.email}: the ${doc.label} ${expired ? 'expired on' : 'expires on'} ${v}.${doc.forDrivers ? ' Deliveries can only be given to drivers whose papers are valid.' : ''} Update the date in the team app (My details) once renewed.`;
      for (const to of [m.email, ...env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean)])
        await send({ to, subject: `${expired ? 'Expired' : 'Expiring soon'}: ${doc.label} (${m.name ?? m.email})`, text, html: `<p style="font:15px Arial,sans-serif">${esc(text)}</p>`, kind: 'team-papers' });
      reminded[doc.key] = v; sentN++;
    }
    await sql`UPDATE team_members SET docs_reminded = ${JSON.stringify(reminded)}::jsonb WHERE id = ${m.id}`;
  }
  return sentN;
}

/** Daily: the evening before, remind everyone on tomorrow's shifts; tell owners about empty spots. */
export async function shiftReminders(today = calgaryNow().date) {
  const tomorrow = addDays(today, 1);
  const people = await sql`SELECT p.shift_id, p.email, s.* FROM shift_people p JOIN shifts s ON s.id = p.shift_id WHERE s.day = ${tomorrow} AND p.reminded_at IS NULL`;
  for (const p of people) {
    await send({ to: p.email, subject: `Tomorrow: ${KIND_LABEL[p.kind]} ${p.starts}–${p.ends}`, text: `A reminder of your ${KIND_LABEL[p.kind].toLowerCase()} shift tomorrow, ${p.starts}–${p.ends}.${p.note ? `\n${p.note}` : ''}\nCheck in from the team app when you arrive: ${siteUrl()}/admin/driver/`, html: `<p style="font:15px Arial,sans-serif">A reminder of your ${esc(KIND_LABEL[p.kind].toLowerCase())} shift tomorrow, <b>${p.starts}–${p.ends}</b>.${p.note ? `<br>${esc(p.note)}` : ''}<br>Check in from the <a href="${siteUrl()}/admin/driver/">team app</a> when you arrive.</p>`, kind: 'team-shift-reminder' });
    await pushTo([p.email], { title: `Tomorrow: ${KIND_LABEL[p.kind]} ${p.starts}–${p.ends}`, body: p.note || 'Check in from the team app when you arrive.', tag: `shift-${p.shift_id}` });
    await sql`UPDATE shift_people SET reminded_at = NOW() WHERE shift_id = ${p.shift_id} AND email = ${p.email}`;
  }
  const gaps = await sql`SELECT s.kind, s.starts, s.ends, s.spots, COUNT(p.email)::int AS n FROM shifts s LEFT JOIN shift_people p ON p.shift_id = s.id WHERE s.day = ${tomorrow} GROUP BY s.id HAVING COUNT(p.email) < s.spots`;
  if (gaps.length) {
    const text = `Tomorrow (${tomorrow}) still needs people:\n${gaps.map(g => `- ${KIND_LABEL[g.kind]} ${g.starts}–${g.ends}: ${g.n} of ${g.spots}`).join('\n')}\n\nAssign someone in Admin → Team.`;
    for (const to of env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean))
      await send({ to, subject: `Tomorrow needs people: ${gaps.length} shift${gaps.length === 1 ? '' : 's'} not full`, text, html: `<pre style="font:15px Arial,sans-serif">${esc(text)}</pre>`, kind: 'team-shift-gaps' });
  }
  return { reminded: people.length, gaps: gaps.length };
}

/** Drivers on driving shifts that overlap a delivery window, per day (for delivery capacity). */
export async function driversOnShift(from: string, to: string) {
  const rows = await sql`SELECT s.day::text AS day, s.starts, s.ends, COUNT(p.email)::int AS n FROM shifts s JOIN shift_people p ON p.shift_id = s.id
    WHERE s.kind = 'driving' AND s.day BETWEEN ${from} AND ${to} GROUP BY s.id`;
  return (date: string, window: string) => {
    const [ws, we] = window.split('–');
    return rows.filter(r => r.day === date && r.starts < we && r.ends > ws).reduce((n, r) => n + r.n, 0);
  };
}
