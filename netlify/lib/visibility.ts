// Who can see the website, set by the owners in Settings. Two addresses, two switches:
// - the real website (hikayacoffee.ca): brewing ("Something is brewing", the default), hidden
//   (Coming soon + waitlist) or open to everyone.
//   Locked: changing it needs the domain typed to confirm, and every owner is emailed.
// - the preview address (*.netlify.app): team code needed, or open to anyone with the link
//   (still hidden from search engines).
// The preview gate (edge function) reads this through /api/site-state. SITE_PUBLIC=true in Netlify
// still opens the real website whatever this says.
import { sql, one } from './db';
import { HttpError, env, siteUrl } from './http';
import { send } from './email';

export type Live = 'brewing' | 'hidden' | 'open';
export type Visibility = { live: Live; preview: 'code' | 'open'; changedBy?: string; changedAt?: string };
const LIVE: Live[] = ['brewing', 'hidden', 'open'];
export const LIVE_DOMAIN = 'hikayacoffee.ca';

export async function getVisibility(): Promise<Visibility> {
  const r = await one`SELECT value FROM settings WHERE key = 'visibility'`.catch(() => null);
  const v = r?.value ? (typeof r.value === 'string' ? JSON.parse(r.value) : r.value) : {};
  return { live: LIVE.includes(v.live) ? v.live : 'brewing', preview: v.preview === 'open' ? 'open' : 'code', changedBy: v.changedBy, changedAt: v.changedAt };
}

export async function setVisibility(b: any, by: string, req?: Request) {
  const cur = await getVisibility();
  const next = { ...cur };
  if (b?.preview !== undefined) {
    if (!['code', 'open'].includes(b.preview)) throw new HttpError(400, 'invalid', 'Choose code or open.');
    next.preview = b.preview;
  }
  let liveChanged = false;
  if (b?.live !== undefined) {
    if (!LIVE.includes(b.live)) throw new HttpError(400, 'invalid', 'Choose brewing, coming soon or open.');
    if (String(b.confirm ?? '').trim().toLowerCase() !== LIVE_DOMAIN) throw new HttpError(400, 'locked', `To change the real website, type ${LIVE_DOMAIN} to confirm.`);
    liveChanged = b.live !== cur.live;
    next.live = b.live;
  }
  next.changedBy = by; next.changedAt = new Date().toISOString();
  await sql`INSERT INTO settings (key, value) VALUES ('visibility', ${JSON.stringify(next)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  if (liveChanged) {
    const what = next.live === 'open' ? 'is now OPEN to everyone' : next.live === 'hidden' ? 'now shows the Coming soon page with the waitlist' : 'now shows the Something is brewing page';
    const text = `${LIVE_DOMAIN} ${what}.\nChanged by ${by} at ${new Date().toLocaleString('en-CA', { timeZone: 'America/Edmonton' })} (Calgary).\n\nIf this was a mistake: Admin → Settings → Who can see the website.\n${siteUrl(req)}/admin/`;
    for (const to of env('ADMIN_EMAILS').split(',').map(e => e.trim()).filter(Boolean))
      await send({ to, subject: `Hikaya website ${next.live === 'open' ? 'opened to everyone' : next.live === 'hidden' ? 'now on Coming soon' : 'now on Something is brewing'}`, text, html: `<p style="font:15px/1.5 Arial,sans-serif">${text.replace(/\n/g, '<br>')}</p>`, kind: 'site-visibility' });
  }
  return { ...next, forcedOpen: env('SITE_PUBLIC').toLowerCase() === 'true' };
}
