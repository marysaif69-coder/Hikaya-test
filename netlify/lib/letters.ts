// Letters to the mailing list (about three a year), written and sent from the desk. Only
// confirmed subscribers who haven't left get them, each in their language, with a one-click
// unsubscribe link (Canada's anti-spam law).
import { sql, one } from './db';
import { HttpError, siteUrl } from './http';
import { send, sendBatch, letterEmail } from './email';

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

export async function sendLetter(id: number, req?: Request) {
  // Claim it first so a double click can't send it twice.
  const l = await one`UPDATE letters SET status = 'sending' WHERE id = ${id} AND status = 'draft' RETURNING *`;
  if (!l) throw new HttpError(409, 'sent', 'This letter was already sent.');
  const site = siteUrl(req);
  const people = await sql`SELECT email, lang, unsub_token FROM subscribers WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`;
  const mails = people.map(p => { const lang = p.lang === 'ar' ? 'ar' : 'en'; return letterEmail(p.email, lang, l[`subject_${lang}`], l[`body_${lang}`], `${site}/api/list/unsubscribe?t=${p.unsub_token}`, site); });
  const n = await sendBatch(mails);
  await sql`UPDATE letters SET status = 'sent', sent_at = NOW(), sent_count = ${n} WHERE id = ${id}`;
  return { sent: n, of: people.length };
}
