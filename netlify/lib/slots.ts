// Pickup and delivery slots: Thursday to Sunday, three windows a day, a capacity per window,
// and a cutoff the evening before. All times are Calgary time.
import { sql, one } from './db';
import { HttpError } from './http';

export const WINDOWS = ['11:00–14:00', '14:00–17:00', '17:00–20:00'] as const;
export const SERVICE_DAYS = [4, 5, 6, 0]; // Thu, Fri, Sat, Sun
const TZ = 'America/Edmonton';

export type Settings = { capacity: { pickup: number; delivery: number }; ordering: { open: boolean; firstDay: string; cutoffHour: number } };

export async function getSettings(): Promise<Settings> {
  const rows = await sql`SELECT key, value FROM settings`;
  const m = Object.fromEntries(rows.map(r => [r.key, typeof r.value === 'string' ? JSON.parse(r.value) : r.value]));
  return { capacity: { pickup: 12, delivery: 8, ...m.capacity }, ordering: { open: true, firstDay: '2027-01-22', cutoffHour: 20, ...m.ordering } };
}

/** Today's date and hour in Calgary. */
export function calgaryNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
const weekday = (iso: string) => new Date(iso + 'T12:00:00Z').getUTCDay();

/** Earliest bookable day: tomorrow, or the day after once the evening cutoff has passed. */
export function earliestDay(s: Settings, now = new Date()) {
  const c = calgaryNow(now);
  const soonest = addDays(c.date, c.hour >= s.ordering.cutoffHour ? 2 : 1);
  return soonest > s.ordering.firstDay ? soonest : s.ordering.firstDay;
}

export async function availability(days = 42, now = new Date()) {
  const s = await getSettings();
  const from = earliestDay(s, now);
  const to = addDays(from, days);
  const taken = await sql`SELECT slot_date::text AS d, slot_window AS w, method, COUNT(*)::int AS n FROM orders
    WHERE status <> 'cancelled' AND slot_date BETWEEN ${from} AND ${to} GROUP BY 1, 2, 3`;
  const used = new Map(taken.map(r => [`${r.d}|${r.w}|${r.method}`, r.n]));
  const out: { date: string; windows: { window: string; pickup: number; delivery: number }[] }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!SERVICE_DAYS.includes(weekday(d))) continue;
    out.push({ date: d, windows: WINDOWS.map(w => ({
      window: w,
      pickup: Math.max(0, s.capacity.pickup - (used.get(`${d}|${w}|pickup`) ?? 0)),
      delivery: Math.max(0, s.capacity.delivery - (used.get(`${d}|${w}|delivery`) ?? 0)),
    })) });
  }
  return { open: s.ordering.open, from, days: out };
}

export async function assertBookable(date: string, window: string, method: 'pickup' | 'delivery', now = new Date()) {
  const s = await getSettings();
  if (!s.ordering.open) throw new HttpError(409, 'closed', 'Orders are paused for the moment. Please try again soon.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !WINDOWS.includes(window as any)) throw new HttpError(400, 'bad-slot', 'Choose a day and a time.');
  if (date < earliestDay(s, now)) throw new HttpError(409, 'too-soon', 'That day is closed for orders now. Choose a later day.');
  if (!SERVICE_DAYS.includes(weekday(date))) throw new HttpError(400, 'bad-day', 'We are open Thursday to Sunday.');
  const row = await one`SELECT COUNT(*)::int AS n FROM orders WHERE status <> 'cancelled' AND slot_date = ${date} AND slot_window = ${window} AND method = ${method}`;
  if ((row?.n ?? 0) >= s.capacity[method]) throw new HttpError(409, 'slot-full', 'That time is full. Please choose another.');
}
