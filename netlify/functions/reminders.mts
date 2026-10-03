// Every evening (00:00 UTC, which is late afternoon or early evening in Calgary): reminders for
// tomorrow's orders (email, and a text for those who asked), review requests, regular orders
// coming up, tomorrow's run sheet to the team, and on the 1st the monthly report to the owners.
import type { Config } from '@netlify/functions';
import { sql } from '../lib/db';
import { calgaryNow, addDays } from '../lib/slots';
import { notify, event } from '../lib/orders';
import { send, reviewEmail } from '../lib/email';
import { env, siteUrl } from '../lib/http';
import { sendSms, smsEnabled, reminderText } from '../lib/sms';
import { runSubscriptions } from '../lib/subscriptions';
import { sendMonthlyReport } from '../lib/report';
import { tomorrowEmail } from '../lib/tomorrow';
import { shiftReminders, paperReminders } from '../lib/team';

export async function daily(today = calgaryNow().date) {
  const tomorrow = addDays(today, 1);
  const rows = await sql`SELECT * FROM orders WHERE slot_date = ${tomorrow} AND status IN ('received', 'confirmed') AND reminded_at IS NULL AND NOT is_sample`;
  for (const o of rows) {
    await notify('reminder', o);
    await sql`UPDATE orders SET reminded_at = NOW() WHERE id = ${o.id}`;
  }
  let texts = 0;
  if (smsEnabled()) {
    const sms = await sql`SELECT * FROM orders WHERE slot_date = ${tomorrow} AND status IN ('received', 'confirmed', 'ready') AND sms_ok AND sms_reminded_at IS NULL AND NOT is_sample`;
    for (const o of sms) {
      const status = await sendSms(o.phone, reminderText(o as any));
      await sql`UPDATE orders SET sms_reminded_at = NOW() WHERE id = ${o.id}`;
      await event(o.id, 'sms', `reminder: ${status}`, 'system');
      if (status === 'sent') texts++;
    }
  }

  // A few days after a completed order, ask for a Google review (only once GOOGLE_REVIEW_URL is set).
  let reviews = 0;
  const reviewUrl = env('GOOGLE_REVIEW_URL');
  if (reviewUrl) {
    const done = await sql`SELECT * FROM orders WHERE status = 'completed' AND NOT is_sample AND review_asked_at IS NULL
      AND slot_date BETWEEN ${addDays(today, -10)} AND ${addDays(today, -3)} LIMIT 200`;
    for (const o of done) {
      await send(reviewEmail({ ...o, slot_date: String(o.slot_date) } as any, reviewUrl, siteUrl()));
      await sql`UPDATE orders SET review_asked_at = NOW() WHERE id = ${o.id}`;
    }
    reviews = done.length;
  }
  const regular = await runSubscriptions(undefined, today);
  const team = await tomorrowEmail(tomorrow);
  const shifts = await shiftReminders(today);
  const papers = await paperReminders(today);
  const report = await sendMonthlyReport(today);
  const out = { reminders: rows.length, texts, reviews, regular, team, shifts, papers, report };
  console.log('daily', tomorrow, out);
  return out;
}

export default async () => { await daily(); };

export const config: Config = { schedule: '0 0 * * *' };
