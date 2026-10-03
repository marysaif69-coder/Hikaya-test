// Every evening (00:00 UTC, which is late afternoon or early evening in Calgary) email tomorrow's customers a reminder.
import type { Config } from '@netlify/functions';
import { sql } from '../lib/db';
import { calgaryNow, addDays } from '../lib/slots';
import { notify } from '../lib/orders';
import { send, reviewEmail } from '../lib/email';
import { env, siteUrl } from '../lib/http';

export default async () => {
  const tomorrow = addDays(calgaryNow().date, 1);
  const rows = await sql`SELECT * FROM orders WHERE slot_date = ${tomorrow} AND status IN ('received', 'confirmed') AND reminded_at IS NULL AND NOT is_sample`;
  for (const o of rows) {
    await notify('reminder', o);
    await sql`UPDATE orders SET reminded_at = NOW() WHERE id = ${o.id}`;
  }
  console.log(`reminders: ${rows.length} for ${tomorrow}`);

  // A few days after a completed order, ask for a Google review (only once GOOGLE_REVIEW_URL is set).
  const reviewUrl = env('GOOGLE_REVIEW_URL');
  if (reviewUrl) {
    const done = await sql`SELECT * FROM orders WHERE status = 'completed' AND NOT is_sample AND review_asked_at IS NULL
      AND slot_date BETWEEN ${addDays(calgaryNow().date, -10)} AND ${addDays(calgaryNow().date, -3)} LIMIT 200`;
    for (const o of done) {
      await send(reviewEmail({ ...o, slot_date: String(o.slot_date) } as any, reviewUrl, siteUrl()));
      await sql`UPDATE orders SET review_asked_at = NOW() WHERE id = ${o.id}`;
    }
    console.log(`review requests: ${done.length}`);
  }
};

export const config: Config = { schedule: '0 0 * * *' };
