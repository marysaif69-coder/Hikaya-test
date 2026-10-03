// The mailing list (three letters a year). Canada's anti-spam law (CASL) wants express consent,
// a record of what was agreed to and when, and an easy way out. People confirm by email first.
import { sql, one } from './db';
import { HttpError, isEmail, siteUrl } from './http';
import { hash, token } from './auth';
import { send, listConfirmEmail } from './email';

import { CONSENT } from './consent';
export { CONSENT };

export async function subscribe(email: string, lang: 'en' | 'ar', source: 'footer' | 'checkout' | 'soon', req?: Request) {
  const e = email.trim().toLowerCase();
  if (!isEmail(e)) throw Object.assign(new HttpError(400, 'invalid', 'Check the email.'), { fields: { email: 'email' } });
  const cur = await one`SELECT confirmed_at, unsubscribed_at FROM subscribers WHERE email = ${e}`;
  if (cur?.confirmed_at && !cur.unsubscribed_at) return { already: true };
  const t = token(18);
  await sql`INSERT INTO subscribers (email, lang, source, consent_text, confirm_token_hash, unsub_token)
    VALUES (${e}, ${lang}, ${source}, ${CONSENT[lang]}, ${hash(t)}, ${token(18)})
    ON CONFLICT (email) DO UPDATE SET lang = EXCLUDED.lang, source = EXCLUDED.source, consent_text = EXCLUDED.consent_text, consent_at = NOW(),
      confirm_token_hash = EXCLUDED.confirm_token_hash, confirmed_at = NULL, unsubscribed_at = NULL`;
  await send(listConfirmEmail(e, lang, `${siteUrl(req)}/api/list/confirm?t=${t}`, siteUrl(req)));
  return { already: false };
}

export async function confirm(t: string) {
  const r = await one`UPDATE subscribers SET confirmed_at = NOW(), confirm_token_hash = NULL WHERE confirm_token_hash = ${hash(t)} RETURNING lang`;
  if (!r) throw new HttpError(404, 'not-found', 'That link has expired or was already used.');
  return r.lang as 'en' | 'ar';
}

export async function unsubscribe(t: string) {
  const r = await one`UPDATE subscribers SET unsubscribed_at = NOW() WHERE unsub_token = ${t} RETURNING lang`;
  return (r?.lang ?? 'en') as 'en' | 'ar';
}

export const listStats = () => one`SELECT COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL)::int AS confirmed,
  COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL AND source = 'soon')::int AS from_soon,
  COUNT(*) FILTER (WHERE confirmed_at > NOW() - INTERVAL '7 days' AND unsubscribed_at IS NULL)::int AS this_week,
  COUNT(*) FILTER (WHERE confirmed_at IS NULL AND unsubscribed_at IS NULL)::int AS waiting, COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS left FROM subscribers`;
