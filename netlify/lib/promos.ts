// Promo codes: a percentage off, an amount off, or free delivery. Store credit for a refund is
// an amount-off code that works once.
import { randomInt } from 'node:crypto';
import { sql, one, type Row } from './db';
import { HttpError, str } from './http';
import { calgaryNow } from './slots';

export const KINDS = ['percent', 'amount', 'free-delivery'] as const;
export const normCode = (v: unknown) => str(v, 32).toUpperCase().replace(/\s+/g, '');
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const randomCode = (prefix: string) => `${prefix}-` + Array.from({ length: 6 }, () => CHARS[randomInt(CHARS.length)]).join('');

export type Applied = { code: string; discount_cents: number; free_delivery: boolean; label: { en: string; ar: string } };

const fail = (en: string, ar: string) => { throw Object.assign(new HttpError(400, 'promo', en), { message_ar: ar }); };

/** Checks a code against a basket. Does not use it up; createOrder does that. */
export async function checkPromo(raw: unknown, subtotal_cents: number, email = ''): Promise<Applied> {
  const code = normCode(raw);
  if (!code) fail('Enter a code.', 'اكتب الرمز.');
  const p = await one`SELECT * FROM promo_codes WHERE code = ${code}`;
  const today = calgaryNow().date;
  if (!p || !p.active) fail('That code is not valid.', 'هذا الرمز غير صحيح.');
  if (p!.starts_on && String(p!.starts_on instanceof Date ? p!.starts_on.toISOString() : p!.starts_on).slice(0, 10) > today) fail('That code is not active yet.', 'هذا الرمز لم يبدأ بعد.');
  if (p!.ends_on && String(p!.ends_on instanceof Date ? p!.ends_on.toISOString() : p!.ends_on).slice(0, 10) < today) fail('That code has expired.', 'انتهت صلاحية هذا الرمز.');
  if (p!.max_uses !== null && p!.uses >= p!.max_uses) fail('That code has been used up.', 'نفد استخدام هذا الرمز.');
  if (subtotal_cents < p!.min_subtotal_cents) fail(`That code needs an order of $${(p!.min_subtotal_cents / 100).toFixed(0)} or more.`, `هذا الرمز لطلب من ${(p!.min_subtotal_cents / 100).toFixed(0)} $ أو أكثر.`);
  if (p!.once_per_email && email) {
    const used = await one`SELECT 1 AS x FROM orders WHERE promo_code = ${code} AND email = ${email.toLowerCase()} AND status <> 'cancelled' LIMIT 1`;
    if (used) fail('You have already used that code.', 'استخدمت هذا الرمز من قبل.');
  }
  return shape(p!, subtotal_cents);
}

export function shape(p: Row, subtotal: number): Applied {
  if (p.kind === 'free-delivery') return { code: p.code, discount_cents: 0, free_delivery: true, label: { en: 'Free delivery', ar: 'توصيل مجاني' } };
  const off = p.kind === 'percent' ? Math.round(subtotal * Math.min(100, p.value) / 100) : Math.min(p.value, subtotal);
  return { code: p.code, discount_cents: off, free_delivery: false, label: p.kind === 'percent' ? { en: `${p.value}% off`, ar: `خصم ${p.value}٪` } : { en: `$${(p.value / 100).toFixed(p.value % 100 ? 2 : 0)} off`, ar: `خصم ${(p.value / 100).toFixed(p.value % 100 ? 2 : 0)} $` } };
}

/** Uses the code once, atomically, so a limited code can't be used beyond its limit. */
export async function redeem(code: string) {
  const r = await one`UPDATE promo_codes SET uses = uses + 1 WHERE code = ${code} AND active AND (max_uses IS NULL OR uses < max_uses) RETURNING code`;
  if (!r) throw new HttpError(409, 'promo', 'That code was just used up.');
}
export async function unredeem(code: string | null) {
  if (code) await sql`UPDATE promo_codes SET uses = GREATEST(0, uses - 1) WHERE code = ${code}`;
}

export async function savePromo(b: any, actor: string) {
  const code = normCode(b.code);
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) throw new HttpError(400, 'code', 'Codes are 3–32 letters, numbers or dashes.');
  const kind = (KINDS as readonly string[]).includes(b.kind) ? b.kind : null;
  if (!kind) throw new HttpError(400, 'kind', 'Choose a type.');
  const value = kind === 'free-delivery' ? 0 : Math.round(Number(b.value));
  if (kind === 'percent' && !(value >= 1 && value <= 100)) throw new HttpError(400, 'value', 'Percent must be 1 to 100.');
  if (kind === 'amount' && !(value >= 1 && value <= 100000)) throw new HttpError(400, 'value', 'Enter an amount.');
  const d = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const n = (v: unknown) => (v === '' || v === null || v === undefined ? null : Math.max(0, Math.round(Number(v)) || 0));
  await sql`INSERT INTO promo_codes (code, kind, value, min_subtotal_cents, starts_on, ends_on, max_uses, once_per_email, active, note, created_by)
    VALUES (${code}, ${kind}, ${value}, ${n(b.min_subtotal_cents) ?? 0}, ${d(b.starts_on)}, ${d(b.ends_on)}, ${n(b.max_uses)}, ${Boolean(b.once_per_email)}, ${b.active !== false}, ${str(b.note, 200) || null}, ${actor})
    ON CONFLICT (code) DO UPDATE SET kind = EXCLUDED.kind, value = EXCLUDED.value, min_subtotal_cents = EXCLUDED.min_subtotal_cents, starts_on = EXCLUDED.starts_on,
      ends_on = EXCLUDED.ends_on, max_uses = EXCLUDED.max_uses, once_per_email = EXCLUDED.once_per_email, active = EXCLUDED.active, note = EXCLUDED.note`;
  return code;
}
