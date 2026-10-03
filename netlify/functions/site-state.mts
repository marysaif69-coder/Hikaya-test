// What the preview gate needs to know: is the real website open, is the preview open. Public and
// harmless; the gate lets this one path through.
import type { Config } from '@netlify/functions';
import { getVisibility } from '../lib/visibility';
import { loadOverrides } from '../lib/business';

export default async () => {
  await loadOverrides().catch(() => {});
  const v = await getVisibility().catch(() => ({ live: 'hidden', preview: 'code' }));
  return new Response(JSON.stringify({ live: v.live, preview: v.preview }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
export const config: Config = { path: '/api/site-state' };
