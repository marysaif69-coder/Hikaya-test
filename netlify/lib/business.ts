// Business details the owners manage in the desk instead of in Netlify: pickup address and hours,
// emails customers see, links, and extra owners. Secrets (API keys) stay in Netlify.
import { sql, one } from './db';
import { HttpError, isEmail, netlifyEnv, setOverrides } from './http';

export const EDITABLE = {
  PICKUP_ADDRESS: 'Pickup address (street, Calgary, AB, postal code); the website and emails also show it as our business address',
  PICKUP_HOURS: 'Pickup hours (as customers should read them)',
  BUSINESS_PHONE: 'Phone number for customers (needed before you sell: Alberta’s online sales rules ask for it on the website and in order emails)',
  ETRANSFER_EMAIL: 'Interac e-Transfer email',
  EMAIL_REPLY_TO: 'Where customer replies go',
  GOOGLE_REVIEW_URL: 'Google review link',
  SHOP_ADDRESS: 'Where delivery routes start (if not the pickup address)',
  MAILING_ADDRESS: 'Mailing address for letters (a PO box is fine; the law needs one in every letter)',
  GST_NUMBER: 'GST/HST registration number (once you have one)',
  OWNER_EMAILS: 'More owners (comma-separated emails)',
} as const;
export type BizKey = keyof typeof EDITABLE;

let cache: { at: number; v: Record<string, string> } | null = null;
export async function loadOverrides(force = false) {
  if (!force && cache && Date.now() - cache.at < 30_000) { setOverrides(cache.v); return cache.v; }
  const r = await one`SELECT value FROM settings WHERE key = 'business'`.catch(() => null);
  const v = (r?.value ? (typeof r.value === 'string' ? JSON.parse(r.value) : r.value) : {}) as Record<string, string>;
  cache = { at: Date.now(), v }; setOverrides(v);
  return v;
}

export async function businessDetails() {
  const v = await loadOverrides(true);
  return Object.fromEntries((Object.keys(EDITABLE) as BizKey[]).map(k => [k, { label: EDITABLE[k], value: v[k] ?? '', netlify: k === 'OWNER_EMAILS' ? netlifyEnv('ADMIN_EMAILS') : netlifyEnv(k) }]));
}

export async function saveBusiness(b: any) {
  const cur = await loadOverrides(true);
  const next: Record<string, string> = { ...cur };
  for (const k of Object.keys(EDITABLE) as BizKey[]) {
    if (b?.[k] === undefined) continue;
    const v = String(b[k] ?? '').trim().slice(0, 300);
    if (v && (k === 'ETRANSFER_EMAIL' || k === 'EMAIL_REPLY_TO') && !isEmail(v.toLowerCase())) throw new HttpError(400, 'invalid', `Check the email for "${EDITABLE[k]}".`);
    if (v && k === 'GOOGLE_REVIEW_URL' && !/^https:\/\/[^\s]+$/.test(v)) throw new HttpError(400, 'invalid', 'The review link must start with https://');
    if (k === 'OWNER_EMAILS') {
      const list = v.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      if (list.some(e => !isEmail(e))) throw new HttpError(400, 'invalid', 'Check the owner emails.');
      next[k] = [...new Set(list)].join(',');
      continue;
    }
    next[k] = (k === 'ETRANSFER_EMAIL' || k === 'EMAIL_REPLY_TO') ? v.toLowerCase() : v;
  }
  for (const k of Object.keys(next)) if (!next[k]) delete next[k];
  await sql`INSERT INTO settings (key, value) VALUES ('business', ${JSON.stringify(next)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  await loadOverrides(true);
  return { ok: true };
}

/** What the public site may show (no emails of owners). */
export const publicBusiness = async () => { const v = await loadOverrides(); return { address: v.PICKUP_ADDRESS ?? netlifyEnv('PICKUP_ADDRESS') ?? '', hours: v.PICKUP_HOURS ?? '', phone: v.BUSINESS_PHONE ?? '' }; };
