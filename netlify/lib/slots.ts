// Pickup and delivery slots: Thursday to Sunday, three windows a day, a capacity per window,
// and an order-by deadline. All times are Calgary time.
//
// Deadline, set in the admin desk:
//   day-before  orders for a day close at the cutoff hour the evening before (default 8 pm)
//   weekly      orders for a Thursday–Sunday week close on one weekday before it, e.g.
//               "order by Tuesday 8 pm to get it this Thursday to Sunday"
import { sql, one } from './db';
import { HttpError } from './http';

export const WINDOWS = ['11:00–14:00', '14:00–17:00', '17:00–20:00'] as const;
export const SERVICE_DAYS = [4, 5, 6, 0]; // Thu, Fri, Sat, Sun
const TZ = 'America/Edmonton';

export type Ordering = { open: boolean; autoConfirm?: boolean; firstDay: string; cutoffHour: number; cutoffMode: 'day-before' | 'weekly'; cutoffWeekday: number; closedDates: string[] };
/** Extra limits (all optional): orders per day, gift boxes per day (packing time), and delivery
 * places taken from the drivers on driving shifts × stops each driver can do per window. */
export type Caps = { dailyOrders: number | null; giftBoxesPerDay: number | null; stopsPerDriver: number | null; deliveryFromShifts: boolean };
export type Settings = { capacity: { pickup: number; delivery: number }; ordering: Ordering; caps: Caps };

export async function getSettings(): Promise<Settings> {
  const rows = await sql`SELECT key, value FROM settings WHERE key IN ('capacity', 'ordering', 'caps')`;
  const m = Object.fromEntries(rows.map(r => [r.key, typeof r.value === 'string' ? JSON.parse(r.value) : r.value]));
  return {
    capacity: { pickup: 12, delivery: 8, ...m.capacity },
    ordering: { open: true, firstDay: '2027-01-22', cutoffHour: 20, cutoffMode: 'day-before', cutoffWeekday: 2, closedDates: [], ...m.ordering },
    caps: { dailyOrders: null, giftBoxesPerDay: null, stopsPerDriver: null, deliveryFromShifts: false, ...m.caps },
  };
}

/** Today's date and hour in Calgary. */
export function calgaryNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
export const weekday = (iso: string) => new Date(iso + 'T12:00:00Z').getUTCDay();

/** When orders for this day close: a Calgary date and hour. */
export function cutoffFor(date: string, o: Ordering) {
  if (o.cutoffMode === 'weekly') {
    const thursday = addDays(date, -((weekday(date) - 4 + 7) % 7));
    const back = (4 - o.cutoffWeekday + 7) % 7 || 7;
    return { date: addDays(thursday, -back), hour: o.cutoffHour };
  }
  return { date: addDays(date, -1), hour: o.cutoffHour };
}

export function bookable(date: string, o: Ordering, now = new Date()) {
  if (date < o.firstDay || !SERVICE_DAYS.includes(weekday(date)) || o.closedDates.includes(date)) return false;
  const c = calgaryNow(now), cut = cutoffFor(date, o);
  return date > c.date && (c.date < cut.date || (c.date === cut.date && c.hour < cut.hour));
}

/** Earliest day that can still be ordered for. */
export function earliestDay(s: Settings, now = new Date()) {
  const start = calgaryNow(now).date > s.ordering.firstDay ? calgaryNow(now).date : addDays(s.ordering.firstDay, -1);
  for (let i = 1; i <= 120; i++) { const d = addDays(start, i); if (bookable(d, s.ordering, now)) return d; }
  return addDays(start, 121);
}

export async function availability(days = 42, now = new Date()) {
  const s = await getSettings();
  const from = earliestDay(s, now);
  const to = addDays(from, days);
  const taken = await sql`SELECT slot_date::text AS d, slot_window AS w, method, COUNT(*)::int AS n FROM orders
    WHERE status <> 'cancelled' AND NOT is_sample AND slot_date BETWEEN ${from} AND ${to} GROUP BY 1, 2, 3`;
  const used = new Map(taken.map(r => [`${r.d}|${r.w}|${r.method}`, r.n]));
  const perDay = new Map<string, number>(); for (const r of taken) perDay.set(r.d, (perDay.get(r.d) ?? 0) + r.n);
  const deliveryCap = await deliveryCapacity(s, from, to);
  const out: { date: string; orderBy: { date: string; hour: number }; windows: { window: string; pickup: number; delivery: number }[] }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!bookable(d, s.ordering, now)) continue;
    const dayLeft = s.caps.dailyOrders ? Math.max(0, s.caps.dailyOrders - (perDay.get(d) ?? 0)) : Infinity;
    out.push({ date: d, orderBy: cutoffFor(d, s.ordering), windows: WINDOWS.map(w => ({
      window: w,
      pickup: Math.min(dayLeft, Math.max(0, s.capacity.pickup - (used.get(`${d}|${w}|pickup`) ?? 0))),
      delivery: Math.min(dayLeft, Math.max(0, deliveryCap(d, w) - (used.get(`${d}|${w}|delivery`) ?? 0))),
    })) });
  }
  // The next deadline and the days it covers, for "order by … to get it …" messages.
  const first = out[0];
  const covers = first ? out.filter(x => x.orderBy.date === first.orderBy.date && x.orderBy.hour === first.orderBy.hour).map(x => x.date) : [];
  const next = first ? { orderBy: first.orderBy, from: covers[0], to: covers[covers.length - 1] } : null;
  return { open: s.ordering.open, from, cutoffMode: s.ordering.cutoffMode, next, days: out };
}

/** `exceptOrder` leaves out an order being moved, so it doesn't count against its own day.
 * `beforeId` counts only orders saved before that one (the check again after saving, so when
 * several orders arrive at once the first ones win). */
export async function assertBookable(date: string, window: string, method: 'pickup' | 'delivery', opts: { exceptOrder?: number; beforeId?: number; now?: Date } = {}) {
  const exceptOrder = opts.exceptOrder ?? 0, beforeId = opts.beforeId ?? 0, now = opts.now ?? new Date();
  const s = await getSettings();
  if (!s.ordering.open) throw new HttpError(409, 'closed', 'Orders are paused for the moment. Please try again soon.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !WINDOWS.includes(window as any)) throw new HttpError(400, 'bad-slot', 'Choose a day and a time.');
  if (!SERVICE_DAYS.includes(weekday(date))) throw new HttpError(400, 'bad-day', 'We are open Thursday to Sunday.');
  if (s.ordering.closedDates.includes(date)) throw new HttpError(409, 'closed-day', 'We are closed that day. Choose another.');
  if (!bookable(date, s.ordering, now)) throw new HttpError(409, 'too-soon', 'Orders for that day have closed. Choose a later day.');
  const row = await one`SELECT COUNT(*)::int AS n FROM orders WHERE status <> 'cancelled' AND NOT is_sample AND slot_date = ${date} AND slot_window = ${window} AND method = ${method}
    AND (${beforeId}::int = 0 OR id < ${beforeId})`;
  const cap = method === 'delivery' ? (await deliveryCapacity(s, date, date))(date, window) : s.capacity.pickup;
  if ((row?.n ?? 0) >= cap) throw new HttpError(409, 'slot-full', method === 'delivery' && cap === 0 ? 'No deliveries at that time. Please choose another time or pickup.' : 'That time is full. Please choose another.');
  if (s.caps.dailyOrders) {
    const d = await one`SELECT COUNT(*)::int AS n FROM orders WHERE status <> 'cancelled' AND NOT is_sample AND slot_date = ${date} AND id <> ${exceptOrder} AND (${beforeId}::int = 0 OR id < ${beforeId})`;
    if ((d?.n ?? 0) >= s.caps.dailyOrders) throw new HttpError(409, 'slot-full', 'That day is full. Please choose another.');
  }
}

/** Delivery places per window: the window limit, or fewer when tied to the drivers on shift. */
async function deliveryCapacity(s: Settings, from: string, to: string) {
  if (!s.caps.deliveryFromShifts || !s.caps.stopsPerDriver) return () => s.capacity.delivery;
  const { driversOnShift } = await import('./team');
  const on = await driversOnShift(from, to);
  return (date: string, window: string) => Math.min(s.capacity.delivery, on(date, window) * (s.caps.stopsPerDriver ?? 0));
}
