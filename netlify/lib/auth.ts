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
/** Owners and helpers from Netlify settings; drivers and helpers the owners added in the desk. */
export async function roleFor(email: string): Promise<Role> {
  if (isAdminEmail(email)) return 'admin';
  if (isStaffEmail(email)) return 'staff';
  const m = await one`SELECT role FROM team_members WHERE email = ${email.toLowerCase()} AND status <> 'off'`;
  return m ? (m.role === 'helper' ? 'staff' : m.role === 'packer' ? 'packer' : 'driver') : 'customer';
}

/** The browser asking for a login code: a random cookie, so a code only works where it was asked for. */
export const LOGIN_COOKIE = 'hk_login';
export const loginCookie = (t: string) => `${LOGIN_COOKIE}=${t}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`;

/** `requester` is the hash of the hk_login cookie (null for shared-login codes, which need a team session). */
export async function issueCode(email: string, requester: string | null = null) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  // Insert first, then count: requests sent at the same moment all see each other's rows, so a
  // burst can't get past the limit the way a count-then-insert could. The per-browser limit is in
  // api-auth; this email-wide ceiling only stops anyone flooding an inbox.
  const row = await one`INSERT INTO auth_codes (email, code_hash, expires_at, requester_hash) VALUES (${email}, ${hash(code)}, NOW() + INTERVAL '10 minutes', ${requester}) RETURNING id`;
  const recent = await one`SELECT COUNT(*)::int AS n FROM auth_codes WHERE email = ${email} AND created_at > NOW() - INTERVAL '1 hour'`;
  if ((recent?.n ?? 0) > 15) {
    // Refused requests are removed, so they don't count against the next hour.
    await sql`DELETE FROM auth_codes WHERE id = ${row!.id}`;
    throw new HttpError(429, 'too-many', 'Too many codes requested. Try again in an hour.');
  }
  return code;
}

/** Checks and uses up a login code (no session). With `requester`, only that browser's codes count,
 *  so someone else's wrong guesses never use up the owner's code. */
export async function checkCode(email: string, code: string, requester?: string) {
  const mine = requester === undefined;
  // Take one of the five tries in the same statement that checks there is one left, so guesses
  // sent in parallel can't all be compared before the count goes up.
  const row = await one`UPDATE auth_codes SET attempts = attempts + 1
    WHERE id = (SELECT id FROM auth_codes WHERE email = ${email} AND used = FALSE AND expires_at > NOW()
        AND (${mine} OR requester_hash = ${requester ?? ''}) ORDER BY created_at DESC LIMIT 1)
      AND attempts < 5
    RETURNING id, code_hash`;
  if (!row) {
    const live = await one`SELECT 1 AS x FROM auth_codes WHERE email = ${email} AND used = FALSE AND expires_at > NOW()
      AND (${mine} OR requester_hash = ${requester ?? ''}) LIMIT 1`;
    if (live) throw new HttpError(429, 'too-many', 'Too many tries. Ask for a new code.');
    throw new HttpError(400, 'expired', 'That code has expired. Ask for a new one.');
  }
  const ok = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(hash(code)), Buffer.from(row.code_hash));
  if (!ok) throw new HttpError(400, 'wrong-code', 'That code is not right.');
  // One code, one login: if two right answers race, only the first uses it up.
  const used = await one`UPDATE auth_codes SET used = TRUE WHERE id = ${row.id} AND used = FALSE RETURNING id`;
  if (!used) throw new HttpError(400, 'expired', 'That code has expired. Ask for a new one.');
}

export async function verifyCode(email: string, code: string, requester: string) {
  await checkCode(email, code, requester);
  const t = token();
  const role = await roleFor(email);
  await sql`INSERT INTO sessions (token_hash, email, role, expires_at) VALUES (${hash(t)}, ${email}, ${role}, NOW() + make_interval(days => ${DAYS}))`;
  await sql`INSERT INTO customers (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`;
  return { token: t, role };
}

export const sessionCookie = (t: string) => `${COOKIE}=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`;
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export type Role = 'customer' | 'driver' | 'packer' | 'staff' | 'admin';
/** `email` is who is acting: the login, or the person picked under a shared team login (their
 * internal handle). `login` is the email actually logged in. */
export type Session = { email: string; role: Role; login: string; as?: { id: number; name: string } };
const AS_COOKIE = 'hk_as';
export const asCookie = (t: string | null) => t ? `${AS_COOKIE}=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}` : `${AS_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
/** People who work under this login and pick their name after logging in. */
export const sharedPeople = (login: string) => sql`SELECT id, name, role, drives FROM team_members WHERE shared AND login_email = ${login} AND status <> 'off' ORDER BY name`;

export async function session(req: Request): Promise<Session | null> {
  const t = cookie(req, COOKIE);
  if (!t) return null;
  const row = await one`SELECT email, role FROM sessions WHERE token_hash = ${hash(t)} AND expires_at > NOW()`;
  if (!row) return null;
  // Team rights follow ADMIN_EMAILS and STAFF_EMAILS at all times, so removing someone takes effect immediately.
  const role = await roleFor(row.email);
  const asT = cookie(req, AS_COOKIE);
  if (asT && role !== 'customer') {
    const m = await one`SELECT m.id, m.email, m.name FROM as_tokens a JOIN team_members m ON m.id = a.member_id
      WHERE a.token_hash = ${hash(asT)} AND a.expires_at > NOW() AND a.login = ${row.email} AND m.shared AND m.login_email = ${row.email} AND m.status <> 'off'`;
    if (m) return { email: m.email, role, login: row.email, as: { id: m.id, name: m.name ?? 'Team' } };
  }
  return { email: row.email, role, login: row.email };
}

export async function requireAdmin(req: Request) {
  const s = await requireTeam(req);
  if (s.role !== 'admin') throw new HttpError(403, 'admin-only', 'Only the owners can do this.');
  return s;
}

/** Anyone running orders: owners (ADMIN_EMAILS) or helpers (STAFF_EMAILS or added in the desk). Not drivers. */
export async function requireTeam(req: Request) {
  const s = await session(req);
  if (!s) throw new HttpError(401, 'login');
  if (s.role === 'customer' || s.role === 'driver' || s.role === 'packer') throw new HttpError(403, 'admin-only');
  return s;
}

/** Anyone on the team, including drivers and packers (who only reach the team app). */
export async function requireCrew(req: Request) {
  const s = await session(req);
  if (!s) throw new HttpError(401, 'login');
  if (s.role === 'customer') throw new HttpError(403, 'admin-only');
  return s;
}

export async function endSession(req: Request) {
  const t = cookie(req, COOKIE);
  if (t) await sql`DELETE FROM sessions WHERE token_hash = ${hash(t)}`;
}

/** After picking a name under a shared login: the code that proves it is them. */
export async function startAs(login: string, id: number) {
  const m = await one`SELECT id, email, name FROM team_members WHERE id = ${id} AND shared AND login_email = ${login} AND status <> 'off'`;
  if (!m) throw new HttpError(404, 'not-found', 'That person is not on this login.');
  return { member: m, code: await issueCode(m.email) };
}
export async function finishAs(login: string, id: number, code: string) {
  const m = await one`SELECT id, email FROM team_members WHERE id = ${id} AND shared AND login_email = ${login} AND status <> 'off'`;
  if (!m) throw new HttpError(404, 'not-found', 'That person is not on this login.');
  await checkCode(m.email, code);
  const t = token();
  await sql`INSERT INTO as_tokens (token_hash, member_id, login, expires_at) VALUES (${hash(t)}, ${m.id}, ${login}, NOW() + make_interval(days => ${DAYS}))`;
  return t;
}
export async function endAs(req: Request) {
  const t = cookie(req, AS_COOKIE);
  if (t) await sql`DELETE FROM as_tokens WHERE token_hash = ${hash(t)}`;
}
