// The Team box on the private-preview screen posts the preview code here (the gate lets POST
// /__preview through). A function, not the edge gate, because the attempt limit needs the database:
// 10 tries per address per 15 minutes, counted before comparing, so parallel guessing can't get round it.
import type { Config } from '@netlify/functions';
import { createHash } from 'node:crypto';
import { env } from '../lib/http';
import { limit, ipKey } from '../lib/rate';

const COOKIE = 'hk_preview';
const DAYS = 30;
// Same rules as the gate: no surrounding spaces, capitals don't matter.
const norm = (v: string) => v.normalize('NFKC').trim().toLowerCase();
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const safeNext = (v: unknown) => (typeof v === 'string' && /^\/(?!\/)[^\s]*$/.test(v) ? v : '/');
const back = (pv: string, next: string) => new Response(null, { status: 303, headers: { location: `/team?pv=${pv}&next=${encodeURIComponent(next)}`, 'cache-control': 'no-store' } });

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response(null, { status: 303, headers: { location: '/team' } });
  const form = await req.formData().catch(() => null);
  const next = safeNext(form?.get('next'));
  const password = norm(env('PREVIEW_PASSWORD'));
  if (!password) return back('unset', next);
  try { await limit(`preview:${ipKey(req)}`, 10, 15); } catch { return back('many', next); }
  // The cookie holds a hash of the code, the same one the gate checks, so changing the code signs everyone out.
  const token = digest(`hikaya-preview:${password}`);
  if (digest(`hikaya-preview:${norm(String(form?.get('code') ?? ''))}`) !== token) return back('wrong', next);
  return new Response(null, { status: 303, headers: {
    location: next,
    'set-cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`,
    'cache-control': 'no-store',
  } });
};

export const config: Config = { path: '/__preview' };
