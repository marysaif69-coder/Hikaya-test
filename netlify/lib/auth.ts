// Passwordless login: a 6-digit code by email, then a 30-day session cookie.
// The team logs in the same way; emails listed in ADMIN_EMAILS get the admin role.
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { sql, one } from './db';
import { HttpError, cookie, env } from './http';

const COOKIE = 'hk_session';
const DAYS = 30;

export const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export const token = (bytes = 24) => randomBytes(bytes).toString('base64url');
export const adminEmails = () => env('ADMIN_EMAILS').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
export const isAdminEmail = (email: string) => adminEmails().includes(email.toLowerCase());
/** Helpers (STAFF_EMAILS) can run orders, the day and week sheets, deliveries and the Inbox, but not
 * refunds, prices, promo codes, settings or exports. */
export const isStaffEmail = (email: string) => env('STAFF_EMAILS').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
const roleFor = (email: string): Role => (isAdminEmail(email) ? 'admin' : isStaffEmail(email) ? 'staff' : 'customer');

export async function issueCode(email: string) {
  const recent = await one`SELECT COUNT(*)::int AS n FROM auth_codes WHERE email = ${email} AND created_at > NOW() - INTERVAL '1 hour'`;
  if ((recent?.n ?? 0) >= 5) throw new HttpError(429, 'too-many', 'Too many codes requested. Try again in an hour.');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await sql`INSERT INTO auth_codes (email, code_hash, expires_at) VALUES (${email}, ${hash(code)}, NOW() + INTERVAL '10 minutes')`;
  return code;
}

export async function verifyCode(email: string, code: string) {
  const row = await one`SELECT id, code_hash, attempts FROM auth_codes WHERE email = ${email} AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`;
  if (!row) throw new HttpError(400, 'expired', 'That code has expired. Ask for a new one.');
  if (row.attempts >= 5) throw new HttpError(429, 'too-many', 'Too many tries. Ask for a new code.');
  const ok = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(hash(code)), Buffer.from(row.code_hash));
  if (!ok) {
    await sql`UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
    throw new HttpError(400, 'wrong-code', 'That code is not right.');
  }
  await sql`UPDATE auth_codes SET used = TRUE WHERE id = ${row.id}`;
  const t = token();
  const role = roleFor(email);
  await sql`INSERT INTO sessions (token_hash, email, role, expires_at) VALUES (${hash(t)}, ${email}, ${role}, NOW() + make_interval(days => ${DAYS}))`;
  await sql`INSERT INTO customers (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`;
  return { token: t, role };
}

export const sessionCookie = (t: string) => `${COOKIE}=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`;
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export type Role = 'customer' | 'staff' | 'admin';
export type Session = { email: string; role: Role };

export async function session(req: Request): Promise<Session | null> {
  const t = cookie(req, COOKIE);
  if (!t) return null;
  const row = await one`SELECT email, role FROM sessions WHERE token_hash = ${hash(t)} AND expires_at > NOW()`;
  if (!row) return null;
  // Team rights follow ADMIN_EMAILS and STAFF_EMAILS at all times, so removing someone takes effect immediately.
  return { email: row.email, role: roleFor(row.email) };
}

export async function requireAdmin(req: Request) {
  const s = await requireTeam(req);
  if (s.role !== 'admin') throw new HttpError(403, 'admin-only', 'Only the owners can do this.');
  return s;
}

/** Anyone on the team: owners (ADMIN_EMAILS) or helpers (STAFF_EMAILS). */
export async function requireTeam(req: Request) {
  const s = await session(req);
  if (!s) throw new HttpError(401, 'login');
  if (s.role === 'customer') throw new HttpError(403, 'admin-only');
  return s;
}

export async function endSession(req: Request) {
  const t = cookie(req, COOKIE);
  if (t) await sql`DELETE FROM sessions WHERE token_hash = ${hash(t)}`;
}
