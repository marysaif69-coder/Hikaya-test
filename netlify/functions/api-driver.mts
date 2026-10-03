// The delivery app (/admin/driver/): for drivers, owners and helpers. Drivers only see and
// change their own stops; they never reach the order desk.
import type { Config } from '@netlify/functions';
import { json, fail, body, str, HttpError, sameOrigin } from '../lib/http';
import { requireCrew } from '../lib/auth';
import { one } from '../lib/db';
import { calgaryNow } from '../lib/slots';
import { member, onboard, stops, startRoute, endRoute, currentRoute, addDeliveryPhoto, delivered, missed, driverReport, mileageCsv, routing } from '../lib/delivery';
import { addDays } from '../lib/slots';
import GUIDE from '../../src/content/driver-guide.json';

export default async (req: Request) => {
  try {
    const s = await requireCrew(req);
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/driver\/?/, '');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') ?? '') ? url.searchParams.get('date')! : calgaryNow().date;

    if (path === 'me' && req.method === 'GET') {
      const m = await member(s.email);
      return json({ email: s.email, role: s.role, member: m, needsOnboarding: s.role === 'driver' && !m?.agreed_at, guide: GUIDE.guide, routing: routing() });
    }
    if (path === 'onboard' && req.method === 'POST') return json({ member: await onboard(s, await body(req)) });
    // Until onboarding is done a driver sees nothing else.
    if (s.role === 'driver' && !(await member(s.email))?.agreed_at) throw new HttpError(403, 'onboarding', 'Finish setting up first.');

    if (path === 'stops' && req.method === 'GET') return json({ date, stops: await stops(s, date, url.searchParams.get('mine') === '1') });
    if (path === 'start' && req.method === 'POST') return json(await startRoute(s, date, req, await body(req)));
    if (path === 'end' && req.method === 'POST') return json(await endRoute(s, date, await body(req)));
    if (path === 'route' && req.method === 'GET') return json({ route: await currentRoute(s, date) });
    // Reports: a driver sees their own; owners and helpers can pass ?driver=
    if ((path === 'report' || path === 'report.csv') && req.method === 'GET') {
      const who = s.role === 'driver' ? s.email : str(url.searchParams.get('driver'), 254).toLowerCase() || s.email;
      const iso = (k: string, d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get(k) ?? '') ? url.searchParams.get(k)! : d);
      const today = calgaryNow().date;
      const r = await driverReport(who, iso('from', today.slice(0, 8) + '01'), iso('to', addDays(today, 0)));
      if (path === 'report') return json({ driver: who, ...r });
      return new Response(mileageCsv(who, r), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="hikaya-mileage-${r.from}-to-${r.to}.csv"`, 'cache-control': 'no-store' } });
    }
    if (path === 'photo' && req.method === 'POST') {
      sameOrigin(req);
      if (Number(req.headers.get('content-length') ?? 0) > 1_500_000) throw new HttpError(413, 'too-large', 'That photo is too large.');
      return json(await addDeliveryPhoto(s, str(url.searchParams.get('ref'), 12), (req.headers.get('content-type') ?? '').split(';')[0], new Uint8Array(await req.arrayBuffer())), 201);
    }
    if (path.startsWith('photo/') && req.method === 'GET') {
      const p = await one`SELECT p.mime, p.data, o.driver_email FROM delivery_photos p JOIN orders o ON o.id = p.order_id WHERE p.id = ${Number(path.slice(6)) || 0}`;
      if (!p || (s.role === 'driver' && p.driver_email !== s.email)) throw new HttpError(404, 'not-found');
      return new Response(p.data, { headers: { 'content-type': p.mime, 'cache-control': 'private, max-age=3600' } });
    }
    if (path === 'delivered' && req.method === 'POST') { const b = await body(req); return json(await delivered(s, str(b.ref, 12), b.collected, req)); }
    if (path === 'missed' && req.method === 'POST') { const b = await body(req); return json(await missed(s, str(b.ref, 12), str(b.why, 500))); }
    throw new HttpError(404, 'not-found');
  } catch (e) { return fail(e); }
};

export const config: Config = { path: ['/api/driver/*'] };
