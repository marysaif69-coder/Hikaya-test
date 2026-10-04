// Ask Hikaya (the chat assistant) and the help form. Both end in the admin Inbox.
import { loadOverrides } from '../lib/business';
import type { Config } from '@netlify/functions';
import { json, fail, body, str, sameOrigin, HttpError, env } from '../lib/http';
import { session, hash } from '../lib/auth';
import { sql } from '../lib/db';
import { askEnabled, openChat, askTurn, MAX_CHARS } from '../lib/ask';
import { createTicket, addPhoto, MAX_PHOTO } from '../lib/tickets';
import { limit, ipKey } from '../lib/rate';

const ipHash = (req: Request) => hash((req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'local') + (env('IP_SALT') || 'hikaya'));

export default async (req: Request) => {
  try {
    await loadOverrides();
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/$/, '');

    if (path === '/api/ask/config' && req.method === 'GET') return json({ enabled: askEnabled() });

    if (path === '/api/ask' && req.method === 'POST') {
      if (!askEnabled()) throw new HttpError(503, 'ask-off', 'Ask Hikaya is not switched on yet. Use the help form.');
      const b = await body(req);
      const lang = b.lang === 'ar' ? 'ar' : 'en';
      const text = str(b.text, MAX_CHARS + 1);
      if (!text) throw new HttpError(400, 'empty');
      if (text.length > MAX_CHARS) throw new HttpError(413, 'too-long', 'That message is long. Please keep it shorter.');
      await limit(`ask:${ipKey(req)}`, 40, 60, 'Too many messages. Try again later, or use the help form.');
      const s = await session(req);
      const { chat, token } = await openChat(str(b.chat, 64) || null, lang, ipHash(req), s);
      const { reply, actions } = await askTurn(chat, text, lang, s, req);
      return json({ chat: token, reply, actions });
    }

    if (path === '/api/ask/rate' && req.method === 'POST') {
      const b = await body(req);
      const rating = b.rating === 'up' ? 'up' : b.rating === 'down' ? 'down' : null;
      await sql`UPDATE chats SET rating = ${rating} WHERE token_hash = ${hash(str(b.chat, 64))}`;
      return json({ ok: true });
    }

    if (path === '/api/help' && req.method === 'POST') {
      await limit(`help:${ipKey(req)}`, 10, 60);
      const b = await body(req);
      const s = await session(req);
      const { ticket, uploadToken } = await createTicket({ ...b, email: s?.email ?? b.email }, 'form', req);
      return json({ ref: ticket.ref, token: uploadToken }, 201);
    }

    // Photos are sent as the raw image body, already resized in the browser.
    if (path === '/api/help/photo' && req.method === 'POST') {
      sameOrigin(req);
      const len = Number(req.headers.get('content-length') ?? 0);
      if (len > MAX_PHOTO) throw new HttpError(413, 'too-large', 'That photo is too large.');
      const bytes = new Uint8Array(await req.arrayBuffer());
      const r = await addPhoto(str(url.searchParams.get('ref'), 12), str(url.searchParams.get('t'), 64), (req.headers.get('content-type') ?? '').split(';')[0], bytes);
      return json(r, 201);
    }
    throw new HttpError(404, 'not-found');
  } catch (e) { return fail(e); }
};

export const config: Config = { path: ['/api/ask', '/api/ask/config', '/api/ask/rate', '/api/help', '/api/help/photo'] };
