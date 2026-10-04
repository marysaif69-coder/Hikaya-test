// /api/auth/* and /api/me — email-code login for customers and the team.
import { loadOverrides } from '../lib/business';
import type { Config } from '@netlify/functions';
import { json, fail, body, str, isEmail, siteUrl, HttpError, cookie } from '../lib/http';
import { limit, ipKey } from '../lib/rate';
import { issueCode, verifyCode, hash, token, LOGIN_COOKIE, loginCookie, session, sessionCookie, clearCookie, endSession, sharedPeople, asCookie, startAs, finishAs, endAs } from '../lib/auth';
import { send, codeEmail } from '../lib/email';

export default async (req: Request) => {
  try {
    await loadOverrides();
    const path = new URL(req.url).pathname;
    if (path === '/api/me' && req.method === 'GET') {
      const s = await session(req);
      const people = s && s.role !== 'customer' ? await sharedPeople(s.login) : [];
      return json({ user: s, people: people.map(p => ({ id: p.id, name: p.name, drives: p.drives })) });
    }
    // A shared team login: pick who is working on this device. A code goes to that person's own
    // email; entering it proves it is them. id 0 = nobody (clears it).
    if (path === '/api/auth/as' && req.method === 'POST') {
      const s = await session(req);
      if (!s || s.role === 'customer') throw new HttpError(401, 'login');
      const id = Number((await body(req)).id) || 0;
      if (!id) { await endAs(req); return json({ ok: true }, 200, { 'set-cookie': asCookie(null) }); }
      await limit(`as:${ipKey(req)}`, 20, 60);
      const { member, code } = await startAs(s.login, id);
      const mail = codeEmail(member.email, code, 'en', siteUrl(req));
      await send({ ...mail, subject: `Your Hikaya team code: ${code}`, text: `${member.name ?? ''}, someone picked your name on ${s.login}. If it was you, type this code: ${code}\n\nIf not, tell the owners.`, kind: 'team-as-code' });
      const [u, d] = member.email.split('@');
      return json({ sent: true, to: `${u.slice(0, 2)}…@${d}` });
    }
    if (path === '/api/auth/as/verify' && req.method === 'POST') {
      const s = await session(req);
      if (!s || s.role === 'customer') throw new HttpError(401, 'login');
      const b = await body(req);
      await limit(`verify:${ipKey(req)}`, 20, 10);
      const t = await finishAs(s.login, Number(b.id) || 0, str(b.code, 6));
      return json({ ok: true }, 200, { 'set-cookie': asCookie(t) });
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method');
    if (path === '/api/auth/request') {
      const b = await body(req);
      const email = str(b.email, 254).toLowerCase();
      if (!isEmail(email)) throw new HttpError(400, 'email', 'Check the email address.');
      await limit(`login:${ipKey(req)}`, 20, 60);
      await limit(`code:${email}:${ipKey(req)}`, 5, 60, 'Too many codes requested. Try again in an hour.');
      // The code works only in this browser (the hk_login cookie), so strangers can't use it up.
      const browser = cookie(req, LOGIN_COOKIE) || token(18);
      const code = await issueCode(email, hash(browser));
      await send(codeEmail(email, code, b.lang === 'ar' ? 'ar' : 'en', siteUrl(req)));
      return json({ ok: true }, 200, { 'set-cookie': loginCookie(browser) });
    }
    if (path === '/api/auth/verify') {
      const b = await body(req);
      const email = str(b.email, 254).toLowerCase();
      await limit(`verify:${ipKey(req)}`, 20, 10);
      const browser = cookie(req, LOGIN_COOKIE);
      const { token: t, role } = await verifyCode(email, str(b.code, 6), browser ? hash(browser) : '');
      return json({ user: { email, role } }, 200, { 'set-cookie': sessionCookie(t) });
    }
    if (path === '/api/auth/logout') {
      await endAs(req);
      await endSession(req);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: [['content-type', 'application/json'], ['set-cookie', clearCookie()], ['set-cookie', asCookie(null)]] });
    }
    throw new HttpError(404, 'not-found');
  } catch (e) { return fail(e); }
};

export const config: Config = { path: ['/api/auth/*', '/api/me'] };
