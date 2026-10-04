// Help requests ("tickets") from the help form and from Ask Hikaya. Each one emails the team
// and the customer, and appears in the admin Inbox. Customers can attach photos with the
// upload token they get back when the request is opened.
import { randomInt } from 'node:crypto';
import { sql, one, type Row, isUniqueViolation } from './db';
import { HttpError, str, isEmail, siteUrl } from './http';
import { hash, token } from './auth';
import { send, ticketReceived, ticketAlert } from './email';
import { calgaryNow, addDays } from './slots';
import { RAMADAN_START, EID } from '../../src/data/calendar';

export const KINDS = ['damaged', 'wrong-item', 'missing', 'late', 'change-order', 'large-order', 'question', 'other'] as const;
export type Kind = typeof KINDS[number];
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newRef = () => 'Q-' + Array.from({ length: 5 }, () => CHARS[randomInt(CHARS.length)]).join('');

/** True from the first day of Ramadan to two days after Eid, when replies take a little longer. */
export function ramadanNow(now = new Date()) {
  const d = calgaryNow(now).date;
  return d >= RAMADAN_START && d <= addDays(EID, 2);
}

export type TicketInput = { kind: string; name?: string; email: string; phone?: string; order_ref?: string; summary: string; details?: string; lang?: string };

export async function createTicket(input: TicketInput, source: 'form' | 'ask', req?: Request, chatId: number | null = null) {
  const kind = (KINDS as readonly string[]).includes(input.kind) ? input.kind as Kind : 'other';
  const email = str(input.email, 254).toLowerCase();
  const summary = str(input.summary, 300);
  const errors: Record<string, string> = {};
  if (!isEmail(email)) errors.email = 'email';
  if (!summary) errors.summary = 'required';
  if (Object.keys(errors).length) throw Object.assign(new HttpError(400, 'invalid', 'Check the highlighted fields.'), { fields: errors });

  const recent = await one`SELECT COUNT(*)::int AS n FROM tickets WHERE email = ${email} AND created_at > NOW() - INTERVAL '1 hour'`;
  if ((recent?.n ?? 0) >= 5) throw new HttpError(429, 'too-many', 'We already have several messages from you. The team will reply soon.');

  const orderRef = str(input.order_ref, 12).toUpperCase() || null;
  const uploadToken = token(18);
  let t: Row | null = null;
  for (let i = 0; i < 5 && !t; i++) {
    try {
      t = await one`INSERT INTO tickets (ref, kind, source, lang, name, email, phone, order_ref, summary, details, chat_id, upload_token_hash)
        VALUES (${newRef()}, ${kind}, ${source}, ${input.lang === 'ar' ? 'ar' : 'en'}, ${str(input.name, 120) || null}, ${email}, ${str(input.phone, 40) || null},
          ${orderRef}, ${summary}, ${str(input.details, 3000) || null}, ${chatId}, ${hash(uploadToken)}) RETURNING *`;
    } catch (e: any) { if (!isUniqueViolation(e)) throw e; }
  }
  if (!t) throw new HttpError(500, 'ref');
  await send(ticketReceived(t as any, siteUrl(req), ramadanNow()));
  for (const m of ticketAlert(t as any, `${siteUrl(req)}/admin/?ticket=${t.ref}`)) await send(m);
  return { ticket: t, uploadToken };
}

const MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO = 1_500_000;
export const MAX_PHOTOS = 4;

/** Attach a photo to a request the caller opened (proved by the upload token). */
export async function addPhoto(ref: string, uploadToken: string, mime: string, bytes: Uint8Array) {
  if (!MIME.includes(mime)) throw new HttpError(415, 'image', 'Send a JPEG, PNG or WebP photo.');
  if (bytes.length === 0 || bytes.length > MAX_PHOTO) throw new HttpError(413, 'too-large', 'That photo is too large.');
  const t = await one`SELECT id, upload_token_hash FROM tickets WHERE ref = ${ref}`;
  if (!t || !uploadToken || hash(uploadToken) !== t.upload_token_hash) throw new HttpError(404, 'not-found');
  const n = await one`SELECT COUNT(*)::int AS n FROM ticket_photos WHERE ticket_id = ${t.id}`;
  if ((n?.n ?? 0) >= MAX_PHOTOS) throw new HttpError(409, 'enough', 'We have enough photos for this request.');
  await sql`INSERT INTO ticket_photos (ticket_id, mime, data) VALUES (${t.id}, ${mime}, ${bytes})`;
  await sql`INSERT INTO ticket_notes (ticket_id, kind, body, actor) VALUES (${t.id}, 'photo', 'Photo added', 'customer')`;
  await sql`UPDATE tickets SET updated_at = NOW() WHERE id = ${t.id}`;
  return { photos: (n?.n ?? 0) + 1 };
}
