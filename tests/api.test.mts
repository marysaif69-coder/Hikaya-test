// End-to-end API test against an in-memory Postgres (PGlite) with the real migration.
// Run: npx tsx tests/api.test.mts
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { setSql } from '../netlify/lib/db';

process.env.ADMIN_EMAILS = 'maryam@hikayacoffee.ca, shadi@hikayacoffee.ca';
process.env.RESEND_API_KEY = 'test-key';
process.env.ETRANSFER_EMAIL = 'pay@hikayacoffee.ca';
process.env.SITE_URL = 'https://hikaya.test';

const pg = new PGlite();
await pg.exec(fs.readFileSync('netlify/database/migrations/001_orders-and-accounts/migration.sql', 'utf8'));
setSql(((s: TemplateStringsArray, ...v: unknown[]) => pg.sql(s, ...v).then(r => r.rows)) as any);

// Capture outgoing email instead of calling Resend.
const sent: any[] = [];
globalThis.fetch = (async (url: string, init: any) => {
  if (String(url).includes('resend')) { sent.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); }
  throw new Error('unexpected fetch ' + url);
}) as any;

const auth = (await import('../netlify/functions/api-auth.mts')).default;
const orders = (await import('../netlify/functions/api-orders.mts')).default;
const admin = (await import('../netlify/functions/api-admin.mts')).default;
const H = 'https://hikaya.test';
const call = async (fn: any, path: string, opts: { method?: string; body?: any; cookie?: string } = {}) => {
  const res: Response = await fn(new Request(H + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', origin: H, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }));
  const text = await res.text();
  let data: any; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, cookie: res.headers.get('set-cookie') };
};
const login = async (email: string) => {
  await call(auth, '/api/auth/request', { body: { email, lang: 'en' } });
  const code = sent.at(-1).text.match(/\b\d{6}\b/)[0];
  const r = await call(auth, '/api/auth/verify', { body: { email, code } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.cookie!.split(';')[0];
};
let pass = 0; const ok = (m: string) => { pass++; console.log('  ✓', m); };

// Slots
const slots = await call(orders, '/api/slots');
assert.equal(slots.status, 200);
const firstDay = slots.data.days[0];
assert.equal(firstDay.date, '2027-01-22'); ok('slots start Fri 22 Jan 2027, Thu–Sun only');
assert.ok(slots.data.days.every((d: any) => [0, 4, 5, 6].includes(new Date(d.date + 'T12:00Z').getUTCDay()))); ok('only service days offered');

// Guest order
const base = { lang: 'en', name: 'Layla Haddad', phone: '403-555-0100', email: 'Layla@Example.com', method: 'pickup', day: '2027-01-22', window: '11:00–14:00', payment: 'e-transfer',
  lines: [{ id: 'najdi', opt: 'dallah', qty: 2, price: 1 }, { id: 'date-box', opt: 'ajwa', qty: 1 }] };
const g = await call(orders, '/api/orders', { body: base });
assert.equal(g.status, 201, JSON.stringify(g.data)); ok(`guest pickup order placed: ${g.data.ref}`);
const view = await call(orders, `/api/orders/view?ref=${g.data.ref}&t=${g.data.token}`);
assert.equal(view.data.order.total, 2 * 2400 + 3400); ok('server recalculated price ($82), client price ignored');
assert.equal(view.data.order.items[1].option_en, 'Ajwa'); ok('date box keeps chosen variety');
assert.equal((await call(orders, `/api/orders/view?ref=${g.data.ref}&t=wrong`)).status, 404); ok('guest link needs the secret token');
const mails = sent.filter(m => m.subject.includes(g.data.ref));
assert.ok(mails.some(m => m.to[0] === 'layla@example.com' && m.subject.startsWith('We have your order'))); ok('customer got "order received" email');
assert.ok(mails.filter(m => m.subject.startsWith('New order')).length === 2); ok('both admins got a new-order alert');
assert.ok(mails.find(m => m.to[0] === 'layla@example.com').text.includes('/en/account/?order=')); ok('email links to the order page');
assert.ok(mails.find(m => m.to[0] === 'layla@example.com').html.includes('pay@hikayacoffee.ca')); ok('e-Transfer instructions included');

// Validation
const bad = await call(orders, '/api/orders', { body: { ...base, method: 'delivery', street: '', postal: 'V6B 1A1' } });
assert.equal(bad.status, 400); assert.equal(bad.data.fields.postal, 'postal'); assert.equal(bad.data.fields.street, 'required'); ok('delivery outside Calgary rejected with field errors');
const del = await call(orders, '/api/orders', { body: { ...base, method: 'delivery', street: '1 Stephen Ave SW', postal: 't2p1j9', lines: [{ id: 'qishr', qty: 1 }] } });
assert.equal(del.status, 201); const dv = await call(orders, `/api/orders/view?ref=${del.data.ref}&t=${del.data.token}`);
assert.equal(dv.data.order.postal, 'T2P 1J9'); assert.equal(dv.data.order.delivery, 900); ok('Calgary delivery: postal normalised, $9 fee under $80');
assert.equal((await call(orders, '/api/orders', { body: { ...base, lines: [{ id: 'hack', qty: 1 }] } })).status, 400); ok('unknown product rejected');
assert.equal((await call(orders, '/api/orders', { body: { ...base, day: '2027-01-25' } })).data.error, 'bad-day'); ok('Monday rejected');
assert.equal((await call(orders, '/api/orders', { body: { ...base, payment: 'card' } })).data.fields.payment, 'card-off'); ok('card refused until Square is connected');

// Customer login sees guest orders
const cust = await login('layla@example.com');
const mine = await call(orders, '/api/my/orders', { cookie: cust });
assert.equal(mine.data.orders.length, 2); ok('logging in with the same email shows earlier guest orders');
assert.equal((await call(admin, '/api/admin/orders', { cookie: cust })).status, 403); ok('customers cannot open admin');
assert.equal((await call(orders, '/api/my/orders')).status, 401); ok('order history needs login');

// Wrong codes are limited
await call(auth, '/api/auth/request', { body: { email: 'x@example.com' } });
for (let i = 0; i < 5; i++) await call(auth, '/api/auth/verify', { body: { email: 'x@example.com', code: '000000' } });
assert.equal((await call(auth, '/api/auth/verify', { body: { email: 'x@example.com', code: sent.at(-1).text.match(/\b\d{6}\b/)[0] } })).status, 429); ok('code locks after 5 wrong tries');
assert.equal((await call(auth, '/api/auth/request', { body: { email: 'x@example.com' }, cookie: '' })).status, 200);
const crossSite = await auth(new Request(H + '/api/auth/request', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{"email":"a@b.co"}' }));
assert.equal(crossSite.status, 403); ok('cross-site posts blocked');

// Admin
const adm = await login('maryam@hikayacoffee.ca');
const list = await call(admin, '/api/admin/orders', { cookie: adm });
assert.equal(list.status, 200); assert.equal(list.data.orders.length, 2); ok('admin sees all orders');
const before = sent.length;
assert.equal((await call(admin, `/api/admin/orders/${g.data.ref}`, { cookie: adm, body: { status: 'confirmed' } })).status, 200);
assert.ok(sent.slice(before).some(m => m.subject === `Order ${g.data.ref} is confirmed`)); ok('status → confirmed emails the customer');
await call(admin, `/api/admin/orders/${g.data.ref}`, { cookie: adm, body: { paymentStatus: 'paid', note: 'e-Transfer received' } });
const detail = await call(admin, `/api/admin/orders/${g.data.ref}`, { cookie: adm });
assert.equal(detail.data.order.paymentStatus, 'paid'); assert.ok(detail.data.events.some((e: any) => e.kind === 'note')); ok('mark paid + note, history recorded');
const dayS = await call(admin, '/api/admin/day?date=2027-01-22', { cookie: adm });
assert.equal(dayS.data.pickups[0].orders.length, 1); assert.equal(dayS.data.deliveries.length, 1);
assert.ok(dayS.data.pack.some((p: any) => p.name_en === 'Najdi' && p.qty === 2)); ok('day sheet: pickups by window, deliveries, packing totals');
const csv = await call(admin, '/api/admin/export.csv', { cookie: adm });
assert.ok(String(csv.data).startsWith('ref,placed,day')); ok('CSV export');

// Capacity
await call(admin, '/api/admin/settings', { cookie: adm, body: { capacity: { pickup: 1, delivery: 8 } } });
assert.equal((await call(orders, '/api/orders', { body: base })).data.error, 'slot-full'); ok('full slot refused');
const s2 = await call(orders, '/api/slots');
assert.equal(s2.data.days[0].windows[0].pickup, 0); ok('slot shows 0 left');
await call(admin, '/api/admin/settings', { cookie: adm, body: { open: false } });
assert.equal((await call(orders, '/api/orders', { body: { ...base, window: '14:00–17:00' } })).data.error, 'closed'); ok('pause switch stops new orders');
await call(admin, '/api/admin/settings', { cookie: adm, body: { open: true, capacity: { pickup: 12, delivery: 8 } } });

// Customer cancel
const cancel = await call(orders, '/api/my/orders/cancel', { cookie: cust, body: { ref: del.data.ref } });
assert.equal(cancel.status, 200); ok('customer can cancel an unpaid, unconfirmed order');
assert.equal((await call(orders, '/api/my/orders/cancel', { cookie: cust, body: { ref: g.data.ref } })).status, 409); ok('confirmed/paid orders cannot be cancelled online');

// Reminder email renders in Arabic
const { notify } = await import('../netlify/lib/orders');
const arOrder = await call(orders, '/api/orders', { body: { ...base, lang: 'ar', email: 'noor@example.com', window: '17:00–20:00' } });
const o = (await pg.query(`SELECT * FROM orders WHERE ref = $1`, [arOrder.data.ref])).rows[0];
await notify('reminder', o);
const rem = sent.at(-1);
assert.ok(rem.subject.startsWith('غداً') && rem.html.includes('dir="rtl"')); ok('Arabic reminder email, right-to-left');

console.log(`\n${pass} checks passed`);
