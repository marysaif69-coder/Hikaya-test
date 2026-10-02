// Rate limits so a script can't fill every time slot with fake orders, guess promo codes, or
// flood the team with requests. Keys use a hashed IP address, never the address itself.
import { createHash } from 'node:crypto';
import { sql, one } from './db';
import { HttpError, env } from './http';

export const ipKey = (req: Request) =>
  createHash('sha256').update((req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local').trim() + (env('IP_SALT') || 'hikaya')).digest('hex').slice(0, 32);

/** Allows `max` attempts per `minutes` for this key, then refuses with a 429. */
export async function limit(key: string, max: number, minutes: number, message = 'Too many tries. Please wait a little and try again.') {
  const r = await one`SELECT COUNT(*)::int AS n FROM rate_hits WHERE key = ${key} AND at > NOW() - make_interval(mins => ${minutes})`;
  if ((r?.n ?? 0) >= max) throw new HttpError(429, 'too-many', message);
  await sql`INSERT INTO rate_hits (key) VALUES (${key})`;
  if (Math.random() < 0.02) await sql`DELETE FROM rate_hits WHERE at < NOW() - INTERVAL '2 days'`;
}
