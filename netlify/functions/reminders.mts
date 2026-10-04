// Once a day, at the hour orders for tomorrow close (the order-by hour set in the desk, Calgary
// time): the monthly report on the 1st (or the next two days if it didn't go), tomorrow's run sheet
// to the team, shift reminders, reminders for tomorrow's orders (email, and a text for those who
// asked), regular orders coming up, papers about to expire, then review requests. Each step runs on
// its own, so one failing doesn't stop the rest. The function itself runs every hour and only does
// the work at that hour, once per date.
import type { Config } from '@netlify/functions';
import { loadOverrides } from '../lib/business';
import { sql, one } from '../lib/db';
import { calgaryNow, addDays, getSettings } from '../lib/slots';
import { notify, event } from '../lib/orders';
import { send, reviewEmail, refillEmail } from '../lib/email';
import { PRODUCTS } from '../../src/data/products';
import { env, siteUrl } from '../lib/http';
import { sendSms, smsEnabled, reminderText } from '../lib/sms';
import { runSubscriptions } from '../lib/subscriptions';
import { sendMonthlyReport } from '../lib/report';
import { tomorrowEmail } from '../lib/tomorrow';
import { shiftReminders, paperReminders } from '../lib/team';

/** Runs one step; if it throws, logs it and carries on with the next. */
async function step<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch (e) { console.error(`daily: ${name} failed`, e); return fallback; }
}
// An email counts as done once it went out, or when email isn't set up at all (skipped);
// a failed one is tried again on the next run.
const done = (status: string | undefined) => status === 'sent' || status === 'skipped';

export async function daily(today = calgaryNow().date) {
  await loadOverrides(true);
  const tomorrow = addDays(today, 1);
  // The date-critical steps first.
  const report = await step('monthly report', () => sendMonthlyReport(today), null);
  const team = await step('run sheet', () => tomorrowEmail(tomorrow), 0);
  const shifts = await step('shift reminders', () => shiftReminders(today), { reminded: 0, gaps: 0 } as Awaited<ReturnType<typeof shiftReminders>>);
  const reminders = await step('order reminders', async () => {
    const rows = await sql`SELECT * FROM orders WHERE slot_date = ${tomorrow} AND status IN ('received', 'confirmed') AND reminded_at IS NULL AND NOT is_sample`;
    for (const o of rows) if (done(await notify('reminder', o))) await sql`UPDATE orders SET reminded_at = NOW() WHERE id = ${o.id}`;
    return rows.length;
  }, 0);
  const texts = await step('text reminders', async () => {
    let n = 0;
    if (!smsEnabled()) return n;
    const sms = await sql`SELECT * FROM orders WHERE slot_date = ${tomorrow} AND status IN ('received', 'confirmed', 'ready') AND sms_ok AND sms_reminded_at IS NULL AND NOT is_sample`;
    for (const o of sms) {
      const status = await sendSms(o.phone, reminderText(o as any));
      await sql`UPDATE orders SET sms_reminded_at = NOW() WHERE id = ${o.id}`;
      await event(o.id, 'sms', `reminder: ${status}`, 'system');
      if (status === 'sent') n++;
    }
    return n;
  }, 0);
  const regular = await step('regular orders', () => runSubscriptions(undefined, today), 0 as Awaited<ReturnType<typeof runSubscriptions>>);
  const papers = await step('paper reminders', () => paperReminders(today), 0 as Awaited<ReturnType<typeof paperReminders>>);
  // A few days after a completed order, ask for a Google review (only once GOOGLE_REVIEW_URL is set).
  // A failed email is tried again the next day, within the same 7-day window.
  const reviews = await step('review requests', async () => {
    const reviewUrl = env('GOOGLE_REVIEW_URL');
    if (!reviewUrl) return 0;
    const due = await sql`SELECT * FROM orders WHERE status = 'completed' AND NOT is_sample AND review_asked_at IS NULL
      AND slot_date BETWEEN ${addDays(today, -10)} AND ${addDays(today, -3)} ORDER BY id LIMIT 40`;
    let n = 0;
    for (const o of due) if (done(await send(reviewEmail({ ...o, slot_date: String(o.slot_date) } as any, reviewUrl, siteUrl())))) { await sql`UPDATE orders SET review_asked_at = NOW() WHERE id = ${o.id}`; n++; }
    return n;
  }, 0);
  const refills = REFILLS_ON ? await step('refill emails', () => sendRefills(today), 0) : 0;
  const out = { reminders, texts, reviews, refills, regular, team, shifts, papers, report };
  console.log('daily', tomorrow, out);
  return out;
}

/** Every hour: runs daily() at the hour orders for tomorrow close (Calgary time), once per date.
 * Orders placed up to that hour are then on the run sheet and get their reminder. */
export async function hourly(now = new Date()) {
  const c = calgaryNow(now);
  const s = await getSettings();
  if (c.hour !== s.ordering.cutoffHour) return null;
  // Once per date, even if the owners move the order-by hour during the day.
  const first = await one`INSERT INTO settings (key, value) VALUES ('daily-ran', ${JSON.stringify(c.date)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value WHERE settings.value IS DISTINCT FROM EXCLUDED.value RETURNING key`;
  if (!first) return null;
  return daily(c.date);
}

// The "Running low?" email is switched off until the owners decide how people agree to it: the
// mailing list promises about three emails a year (see docs/coffee-tbd.md). sendRefills() is ready.
export const REFILLS_ON = false;

/** About three weeks after a completed order with coffee in it: one "running low?" email, only to
 * customers on the mailing list, never for a gift (the bag went to someone else), never to someone
 * with an active regular order, nothing ordered since, and at most one every 60 days per address. */
export async function sendRefills(today: string) {
  const due = await sql`SELECT o.*, s.unsub_token FROM orders o JOIN subscribers s ON s.email = o.email AND s.confirmed_at IS NOT NULL AND s.unsubscribed_at IS NULL
    WHERE o.status = 'completed' AND NOT o.is_sample AND NOT o.gift AND o.refill_sent_at IS NULL AND o.subscription_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM orders n WHERE n.email = o.email AND n.id > o.id AND n.status <> 'cancelled')
      AND NOT EXISTS (SELECT 1 FROM subscriptions r WHERE r.email = o.email AND r.status = 'active')
      AND NOT EXISTS (SELECT 1 FROM email_log l WHERE l.to_email = o.email AND l.kind = 'refill-reminder' AND l.status <> 'failed' AND l.created_at > NOW() - INTERVAL '60 days')
      AND o.slot_date BETWEEN ${addDays(today, -24)} AND ${addDays(today, -21)} ORDER BY o.id LIMIT 40`;
  let refills = 0;
  const seen = new Set<string>();
  for (const o of due) {
    await sql`UPDATE orders SET refill_sent_at = NOW() WHERE id = ${o.id}`;
    if (seen.has(o.email)) continue;
    const items = await sql`SELECT product_id FROM order_items WHERE order_id = ${o.id}`;
    const coffees = items.map(i => PRODUCTS.find(p => p.id === i.product_id)).filter(p => p && p.kind !== 'box')
      .map(p => ({ en: p!.name.en, ar: p!.name.ar, pack: p!.kind === 'kit' || p!.kind === 'pack' }));
    if (!coffees.length) continue;
    seen.add(o.email);
    await send(refillEmail({ ...o, slot_date: String(o.slot_date) } as any, coffees, siteUrl(), `${siteUrl()}/api/list/unsubscribe?t=${o.unsub_token}`));
    refills++;
  }
  return refills;
}

export default async () => { await hourly(); };

export const config: Config = { schedule: '0 * * * *' };
