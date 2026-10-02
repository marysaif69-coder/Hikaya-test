// Every evening (00:00 UTC = 5 pm Calgary in winter, 6 pm in summer) email tomorrow's customers a reminder.
import type { Config } from '@netlify/functions';
import { sql } from '../lib/db';
import { calgaryNow, addDays } from '../lib/slots';
import { notify } from '../lib/orders';

export default async () => {
  const tomorrow = addDays(calgaryNow().date, 1);
  const rows = await sql`SELECT * FROM orders WHERE slot_date = ${tomorrow} AND status IN ('received', 'confirmed') AND reminded_at IS NULL AND NOT is_sample`;
  for (const o of rows) {
    await notify('reminder', o);
    await sql`UPDATE orders SET reminded_at = NOW() WHERE id = ${o.id}`;
  }
  console.log(`reminders: ${rows.length} for ${tomorrow}`);
};

export const config: Config = { schedule: '0 0 * * *' };
