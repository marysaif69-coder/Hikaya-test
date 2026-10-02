// /api/auth/* and /api/me — email-code login for customers and the team.
import type { Config } from '@netlify/functions';
import { json, fail, body, str, isEmail, siteUrl, HttpError } from '../lib/http';
import { limit, ipKey } from '../lib/rate';
import { issueCode, verifyCode, session, sessionCookie, clearCookie, endSession } from '../lib/auth';
import { send, codeEmail } from '../lib/email';

export default async (req: Request) => {
  try {
    const path = new URL(req.url).pathname;
    if (path === '/api/me' && req.method === 'GET') {
      const s = await session(req);
      return json({ user: s });
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method');
    if (path === '/api/auth/request') {
      const b = await body(req);
      const email = str(b.email, 254).toLowerCase();
      if (!isEmail(email)) throw new HttpError(400, 'email', 'Check the email address.');
      await limit(`login:${ipKey(req)}`, 20, 60);
      const code = await issueCode(email);
      await send(codeEmail(email, code, b.lang === 'ar' ? 'ar' : 'en', siteUrl(req)));
      return json({ ok: true });
    }
    if (path === '/api/auth/verify') {
      const b = await body(req);
      const email = str(b.email, 254).toLowerCase();
      const { token, role } = await verifyCode(email, str(b.code, 6));
      return json({ user: { email, role } }, 200, { 'set-cookie': sessionCookie(token) });
    }
    if (path === '/api/auth/logout') {
      await endSession(req);
      return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
    }
    throw new HttpError(404, 'not-found');
  } catch (e) { return fail(e); }
};

export const config: Config = { path: ['/api/auth/*', '/api/me'] };
