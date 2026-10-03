// The delivery app (/admin/driver/): for drivers, owners and helpers. Drivers only see and
// change their own stops; they never reach the order desk.
import type { Config } from '@netlify/functions';
import { json, fail, body, str, HttpError, sameOrigin } from '../lib/http';
import { requireCrew } from '../lib/auth';
import { one } from '../lib/db';
import { calgaryNow } from '../lib/slots';
import { shiftsFrom, signUp, leave, clock, hours, saveProfile, canTake } from '../lib/team';
import { member, onboard, packList, markPacked, stops, startRoute, endRoute, currentRoute, addDeliveryPhoto, delivered, missed, driverReport, mileageCsv, routing } from '../lib/delivery';
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
      return json({ email: s.email, role: s.role, member: m, needsOnboarding: (s.role === 'driver' || s.role === 'packer' || Boolean(m?.drives)) && !m?.agreed_at, guide: GUIDE.guide, routing: routing() });
    }
    if (path === 'onboard' && req.method === 'POST') return json({ member: await onboard(s, await body(req)) });
    // Until onboarding is done a driver sees nothing else.
    if ((s.role === 'driver' || s.role === 'packer') && !(await member(s.email))?.agreed_at) throw new HttpError(403, 'onboarding', 'Finish setting up first.');
    if (path === 'profile' && req.method === 'POST') return json(await saveProfile(s, await body(req)));

    // ---------- shifts ----------
    if (path === 'shifts' && req.method === 'GET') {
      const f = url.searchParams.get('from') ?? '';
      const list = await shiftsFrom(/^\d{4}-\d{2}-\d{2}$/.test(f) && f >= calgaryNow().date ? f : calgaryNow().date, 120);
      return json({ shifts: list.map(x => ({ ...x, mine: x.people.some(p => p.email === s.email), me: x.people.find(p => p.email === s.email) ?? null, canTake: canTake(s.role, x.kind),
        people: x.people.map(p => ({ name: p.name || p.email.split('@')[0] })) })) });
    }
    const sm = /^shifts\/(\d+)\/(signup|leave|in|out)$/.exec(path);
    if (sm && req.method === 'POST') {
      const id = Number(sm[1]);
      return json(sm[2] === 'signup' ? await signUp(s, id) : sm[2] === 'leave' ? await leave(s, id) : await clock(s, id, sm[2] as 'in' | 'out'));
    }
    if (path === 'hours' && req.method === 'GET') {
      const today = calgaryNow().date;
      return json(await hours(/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('from') ?? '') ? url.searchParams.get('from')! : today.slice(0, 8) + '01', /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('to') ?? '') ? url.searchParams.get('to')! : today, s.email));
    }

    // ---------- packing ----------
    if (path === 'pack' || path === 'packed') {
      if (s.role === 'driver') throw new HttpError(403, 'role', 'Packing is for packers and the team.');
      if (path === 'pack' && req.method === 'GET') return json({ date, orders: await packList(date) });
      if (path === 'packed' && req.method === 'POST') return json(await markPacked(s, str((await body(req)).ref, 12), req));
    }
    if (s.role === 'packer' && ['stops', 'start', 'end', 'route', 'photo', 'delivered', 'missed'].some(x => path === x || path.startsWith('photo/'))) throw new HttpError(403, 'role', 'Deliveries are for drivers.');

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
