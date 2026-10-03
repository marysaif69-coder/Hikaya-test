// Day-to-day operations: food-safety checklists signed in the team app, announcements to the team,
// a full data backup for the owners, and the desk's activity log.
import { sql, one } from './db';
import { HttpError, env, siteUrl } from './http';
import { send } from './email';
import { calgaryNow } from './slots';

// ---------- checklists ----------
export type Checklist = { key: string; name: string; items: string[] };
/** Starting checklists. A draft: the owners adjust them in Production → Food safety. A line ending
 * in "(°C)" asks for a number. */
export const DEFAULT_CHECKLISTS: Checklist[] = [
  { key: 'before-packing', name: 'Before packing', items: ['Nobody working is sick', 'Hands washed, hair tied back or covered, clean apron', 'Work surfaces and scale cleaned and sanitized', 'Grinder clean and dry', 'Fridge temperature (°C)'] },
  { key: 'after-packing', name: 'After packing', items: ['Open coffee and dates sealed and labelled with their lot', 'Work surfaces cleaned', 'Waste and recycling out', 'Equipment cleaned and put away'] },
  { key: 'delivery', name: 'Before deliveries', items: ['Delivery bags clean', 'Boxes upright and away from the heater or sun', 'Every bag checked against the stop list'] },
];
const day = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);

export async function checklists(): Promise<Checklist[]> {
  const r = await one`SELECT value FROM settings WHERE key = 'checklists'`;
  const v = r?.value ? (typeof r.value === 'string' ? JSON.parse(r.value) : r.value) : null;
  return Array.isArray(v) && v.length ? v : DEFAULT_CHECKLISTS;
}
export async function saveChecklists(list: unknown) {
  if (!Array.isArray(list) || !list.length || list.length > 12) throw new HttpError(400, 'invalid', 'Keep between 1 and 12 checklists.');
  const out: Checklist[] = list.map((c: any, i: number) => {
    const name = String(c?.name ?? '').trim().slice(0, 60);
    const items = (Array.isArray(c?.items) ? c.items : []).map((x: unknown) => String(x).trim().slice(0, 140)).filter(Boolean).slice(0, 30);
    if (!name || !items.length) throw new HttpError(400, 'invalid', 'Each checklist needs a name and at least one line.');
    return { key: String(c?.key ?? '').trim().slice(0, 40) || `list-${i + 1}`, name, items };
  });
  await sql`INSERT INTO settings (key, value) VALUES ('checklists', ${JSON.stringify(out)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return { ok: true };
}
export async function signChecklist(by: string, b: any) {
  const lists = await checklists();
  const c = lists.find(x => x.key === b?.key);
  if (!c) throw new HttpError(404, 'not-found');
  const given = Array.isArray(b?.answers) ? b.answers : [];
  const answers = c.items.map((item, i) => {
    const a = given[i] ?? {};
    const value = /\(°C\)\s*$/.test(item) ? (a.value === '' || a.value === null || a.value === undefined ? null : Number(a.value)) : null;
    if (value !== null && !Number.isFinite(value)) throw new HttpError(400, 'number', `Check the number for "${item}".`);
    return { item, done: a.done === true, value };
  });
  if (answers.some(a => /\(°C\)\s*$/.test(a.item) && a.value === null)) throw new HttpError(400, 'number', 'Type the temperature.');
  await sql`INSERT INTO checklist_logs (day, checklist, answers, note, done_by) VALUES (${calgaryNow().date}, ${c.key}, ${JSON.stringify(answers)}::jsonb, ${String(b?.note ?? '').slice(0, 500) || null}, ${by})`;
  return { ok: true, allDone: answers.every(a => a.done) };
}
export async function checklistLog(from: string, to: string) {
  const rows = await sql`SELECT l.*, COALESCE(m.name, l.done_by) AS who FROM checklist_logs l LEFT JOIN team_members m ON m.email = l.done_by WHERE l.day BETWEEN ${from} AND ${to} ORDER BY l.day DESC, l.created_at DESC`;
  return rows.map(r => ({ id: r.id, day: day(r.day), checklist: r.checklist, answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers, note: r.note, by: r.who, at: r.created_at }));
}
export const todayLogs = async () => (await checklistLog(calgaryNow().date, calgaryNow().date));

// ---------- announcements ----------
export async function announce(body: string, emailAll: boolean, by: string, req?: Request) {
  const text = String(body ?? '').trim().slice(0, 2000);
  if (!text) throw new HttpError(400, 'invalid', 'Write the message.');
  const r = await one`INSERT INTO announcements (body, emailed, created_by) VALUES (${text}, ${emailAll}, ${by}) RETURNING id`;
  let emailed = 0;
  if (emailAll) {
    const people = await sql`SELECT email FROM team_members WHERE status <> 'off'`;
    const to = [...new Set([...people.map(p => p.email as string), ...env('ADMIN_EMAILS').split(','), ...env('STAFF_EMAILS').split(',')].map(e => e.trim().toLowerCase()).filter(Boolean))];
    const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    for (const t of to) { await send({ to: t, subject: 'Hikaya team: a message from the owners', text: `${text}\n\nTeam app: ${siteUrl(req)}/admin/driver/`, html: `<div style="font:15px/1.5 Arial,sans-serif">${esc(text).replace(/\n/g, '<br>')}<br><br><a href="${siteUrl(req)}/admin/driver/">Open the team app</a></div>`, kind: 'team-announcement' }); emailed++; }
  }
  return { id: r!.id, emailed };
}
export const announcements = (limit = 10) => sql`SELECT a.id, a.body, a.created_at, COALESCE(m.name, a.created_by) AS who FROM announcements a LEFT JOIN team_members m ON m.email = a.created_by ORDER BY a.created_at DESC LIMIT ${limit}`;
export const deleteAnnouncement = (id: number) => sql`DELETE FROM announcements WHERE id = ${id}`.then(() => ({ ok: true }));

// ---------- backup ----------
const SKIP = new Set(['sessions', 'auth_codes', 'as_tokens', 'rate_hits']);
const BINARY: Record<string, string> = { ticket_photos: 'id, ticket_id, mime, created_at', delivery_photos: 'id, order_id, mime, taken_by, created_at' };
const raw = (q: string) => sql(Object.assign([q], { raw: [q] }) as unknown as TemplateStringsArray);
/** Every table as JSON (no login codes or sessions; photos listed without the image bytes). */
export async function backup() {
  const tables = (await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`).map(r => r.table_name as string);
  const out: Record<string, unknown[]> = {};
  for (const t of tables) {
    if (SKIP.has(t) || !/^[a-z_][a-z0-9_]*$/.test(t)) continue;
    out[t] = await raw(`SELECT ${BINARY[t] ?? '*'} FROM "${t}"`);
  }
  return { made: new Date().toISOString(), tables: out };
}

// ---------- activity log ----------
const HIDE = /"(code|token|password|data)"\s*:\s*"[^"]*"/g;
export async function logActivity(actor: string, method: string, path: string, bodyText: string) {
  const detail = bodyText ? bodyText.replace(HIDE, '"$1":"…"').slice(0, 400) : null;
  await sql`INSERT INTO activity (actor, action, detail) VALUES (${actor}, ${`${method} ${path}`.slice(0, 200)}, ${detail})`;
}
export const activity = (limit = 200) => sql`SELECT a.id, COALESCE(m.name, a.actor) AS actor, a.action, a.detail, a.created_at FROM activity a LEFT JOIN team_members m ON m.email = a.actor AND m.shared ORDER BY a.created_at DESC LIMIT ${limit}`;
