// Letters to the mailing list (about three a year), written and sent from the desk. Only
// confirmed subscribers who haven't left get them, each in their language, with a one-click
// unsubscribe link (Canada's anti-spam law).
import { sql, one } from './db';
import { HttpError, siteUrl } from './http';
import { send, sendBatch, letterEmail, mailingAddress } from './email';

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);

export async function saveLetter(id: number | null, b: any, by: string) {
  const f = { subject_en: clean(b?.subject_en, 150), subject_ar: clean(b?.subject_ar, 150), body_en: clean(b?.body_en, 8000), body_ar: clean(b?.body_ar, 8000) };
  if (!f.subject_en || !f.body_en || !f.subject_ar || !f.body_ar) throw new HttpError(400, 'invalid', 'Write the subject and the letter in English and in Arabic.');
  if (id) {
    const r = await one`UPDATE letters SET subject_en = ${f.subject_en}, subject_ar = ${f.subject_ar}, body_en = ${f.body_en}, body_ar = ${f.body_ar}, updated_at = NOW() WHERE id = ${id} AND status = 'draft' RETURNING id`;
    if (!r) throw new HttpError(409, 'sent', 'This letter was already sent.');
    return { id };
  }
  const r = await one`INSERT INTO letters (subject_en, subject_ar, body_en, body_ar, created_by) VALUES (${f.subject_en}, ${f.subject_ar}, ${f.body_en}, ${f.body_ar}, ${by}) RETURNING id`;
  return { id: r!.id as number };
}

export const listLetters = () => sql`SELECT id, subject_en, subject_ar, body_en, body_ar, status, sent_at, sent_count, created_by, created_at FROM letters ORDER BY created_at DESC LIMIT 50`;

/** A test copy (both languages) to one address, before sending to everyone. */
export async function testLetter(id: number, to: string, req?: Request) {
  const l = await one`SELECT * FROM letters WHERE id = ${id}`;
  if (!l) throw new HttpError(404, 'not-found');
  const site = siteUrl(req);
  for (const lang of ['en', 'ar'] as const) await send(letterEmail(to, lang, `[Test] ${l[`subject_${lang}`]}`, l[`body_${lang}`], `${site}/api/list/unsubscribe?t=test`, site));
  return { to };
}

/** Sends a draft to every confirmed subscriber, or a partly sent letter to the ones it missed. */
export async function sendLetter(id: number, req?: Request) {
  if (!mailingAddress()) throw new HttpError(400, 'address', 'Add a mailing address in Settings → Business details first.');
  // Claim it first so a double click can't send it twice.
  const l = await one`UPDATE letters SET status = 'sending' WHERE id = ${id} AND status IN ('draft', 'partial') RETURNING *`;
  if (!l) throw new HttpError(409, 'sent', 'This letter was already sent.');
  const site = siteUrl(req);
  try {
    const people = await sql`SELECT email, lang, unsub_token FROM subscribers s WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM letter_sends ls WHERE ls.letter_id = ${id} AND ls.email = s.email AND ls.status = 'sent')`;
    const mails = people.map(p => { const lang = p.lang === 'ar' ? 'ar' : 'en'; return letterEmail(p.email, lang, l[`subject_${lang}`], l[`body_${lang}`], `${site}/api/list/unsubscribe?t=${p.unsub_token}`, site); });
    const { sent, outcomes } = await sendBatch(mails);
    for (const o of outcomes) await sql`INSERT INTO letter_sends (letter_id, email, status) VALUES (${id}, ${o.to}, ${o.status})
      ON CONFLICT (letter_id, email) DO UPDATE SET status = EXCLUDED.status, at = NOW()`;
    const reached = await one`SELECT COUNT(*)::int AS n FROM letter_sends WHERE letter_id = ${id} AND status = 'sent'`;
    const status = sent === people.length ? 'sent' : 'partial';
    await sql`UPDATE letters SET status = ${status}, sent_at = NOW(), sent_count = ${reached?.n ?? 0} WHERE id = ${id}`;
    return { sent, of: people.length, status };
  } catch (e) {
    // Never leave it stuck in "sending": back to a draft if nobody got it, otherwise partly sent.
    const done = await one`SELECT COUNT(*)::int AS n FROM letter_sends WHERE letter_id = ${id} AND status = 'sent'`;
    await sql`UPDATE letters SET status = ${(done?.n ?? 0) > 0 ? 'partial' : 'draft'}, sent_count = ${done?.n ?? 0} WHERE id = ${id}`;
    throw e;
  }
}
