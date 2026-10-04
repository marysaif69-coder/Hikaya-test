// What the preview gate needs to know: is the real website open, is the preview open. Public and
// harmless; the gate lets this one path through.
import type { Config } from '@netlify/functions';
import { getVisibility } from '../lib/visibility';
import { loadOverrides } from '../lib/business';
import { env } from '../lib/http';

export default async () => {
  // Always a valid answer (the gate and the team bar read it): if anything fails, the safe state.
  let out = { live: 'brewing', preview: 'code', forcedOpen: false };
  try {
    await loadOverrides().catch(() => {});
    const v = await getVisibility().catch(() => ({ live: 'brewing', preview: 'code' }));
    // forcedOpen: SITE_PUBLIC=true in Netlify opened the real website, whatever the switch says.
    out = { live: v.live, preview: v.preview, forcedOpen: String(env('SITE_PUBLIC') ?? '').toLowerCase() === 'true' };
  } catch (e) { console.error('site-state', e); }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
export const config: Config = { path: '/api/site-state' };
