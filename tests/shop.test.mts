// Shop management: live prices, hidden products, seasons, stock, promo codes, refunds, sample
// orders, the order-by deadline, and Ask Hikaya's team answers and backup answers.
// Run: npx tsx tests/shop.test.mts
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { setSql } from '../netlify/lib/db';

process.env.ADMIN_EMAILS = 'maryam@hikayacoffee.ca';
process.env.RESEND_API_KEY = 'test-key';
process.env.SITE_URL = 'https://hikaya.test';

const pg = new PGlite();
for (const dir of fs.readdirSync('netlify/database/migrations').sort()) await pg.exec(fs.readFileSync(`netlify/database/migrations/${dir}/migration.sql`, 'utf8'));
setSql(((s: TemplateStringsArray, ...v: unknown[]) => pg.sql(s, ...v).then(r => r.rows)) as any);
const sent: any[] = [];
globalThis.fetch = (async (url: string, init: any) => {
  if (String(url).includes('resend')) { sent.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); }
  throw new Error('unexpected fetch ' + url);
}) as any;

const auth = (await import('../netlify/functions/api-auth.mts')).default;
const orders = (await import('../netlify/functions/api-orders.mts')).default;
const admin = (await import('../netlify/functions/api-admin.mts')).default;
const help = (await import('../netlify/functions/api-help.mts')).default;
const H = 'https://hikaya.test';
let ipN = 0; // each request from a different address, so the rate limits don't trip
const call = async (fn: any, path: string, opts: { body?: any; cookie?: string } = {}) => {
  const res: Response = await fn(new Request(H + path, { method: opts.body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin: H, 'x-nf-client-connection-ip': `10.0.0.${++ipN % 250}`, ...(opts.cookie ? { cookie: opts.cookie } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined }));
  const text = await res.text(); let data: any; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
};
const login = async (email: string) => {
  await call(auth, '/api/auth/request', { body: { email, lang: 'en' } });
  const code = sent.at(-1).text.match(/\b\d{6}\b/)[0];
  const res: Response = await auth(new Request(H + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json', origin: H }, body: JSON.stringify({ email, code }) }));
  return res.headers.get('set-cookie')!.split(';')[0];
};
let pass = 0; const ok = (m: string) => { pass++; console.log('  ✓', m); };
const adm = await login('maryam@hikayacoffee.ca');
let n = 0;
const order = (extra: any = {}) => call(orders, '/api/orders', { body: { lang: 'en', name: 'Test Person', phone: '403-555-0100', email: `t${++n}@example.com`, method: 'pickup', day: '2027-01-22', window: '11:00–14:00', payment: 'e-transfer', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }], ...extra } });

// ---------- order-by deadline ----------
const { bookable, cutoffFor } = await import('../netlify/lib/slots');
const weekly = { open: true, firstDay: '2027-01-01', cutoffHour: 20, cutoffMode: 'weekly' as const, cutoffWeekday: 2, closedDates: ['2027-01-24'] };
assert.deepEqual(cutoffFor('2027-01-23', weekly), { date: '2027-01-19', hour: 20 }); ok('weekly: Saturday 23 Jan closes Tuesday 19 Jan, 8 pm');
const at = (iso: string) => new Date(iso); // Calgary is UTC−7 in January
assert.equal(bookable('2027-01-21', weekly, at('2027-01-20T02:00:00Z')), true); ok('Tuesday 7 pm: this Thursday is still open');
assert.equal(bookable('2027-01-21', weekly, at('2027-01-20T04:00:00Z')), false);
assert.equal(bookable('2027-01-28', weekly, at('2027-01-20T04:00:00Z')), true); ok('Tuesday 9 pm: this week has closed, next week is open');
assert.equal(bookable('2027-01-24', weekly, at('2027-01-10T12:00:00Z')), false); ok('closed days cannot be booked');
const dayBefore = { ...weekly, cutoffMode: 'day-before' as const, closedDates: [] };
assert.equal(bookable('2027-01-22', dayBefore, at('2027-01-22T02:00:00Z')), true);
assert.equal(bookable('2027-01-22', dayBefore, at('2027-01-22T04:00:00Z')), false); ok('evening-before mode: closes 8 pm the day before');
await call(admin, '/api/admin/settings', { cookie: adm, body: { cutoffMode: 'weekly', cutoffWeekday: 2, cutoffHour: 20 } });
const sl = await call(orders, '/api/slots');
assert.equal(sl.data.cutoffMode, 'weekly'); assert.equal(sl.data.next.from, '2027-01-22'); assert.equal(sl.data.next.to, '2027-01-24'); ok(`slots say: order by ${sl.data.next.orderBy.date} ${sl.data.next.orderBy.hour}:00 for ${sl.data.next.from} to ${sl.data.next.to}`);
await call(admin, '/api/admin/settings', { cookie: adm, body: { cutoffMode: 'day-before' } });

// ---------- prices, hidden products, seasons, stock ----------
await call(admin, '/api/admin/products/najdi', { cookie: adm, body: { price_cents: 2600 } });
assert.equal((await call(orders, '/api/catalog')).data.products.najdi.price, 26); ok('price change shows in the live catalog');
const o1 = await order();
assert.equal(o1.status, 201, JSON.stringify(o1.data));
assert.equal((await pg.query(`SELECT total_cents FROM orders WHERE ref = $1`, [o1.data.ref])).rows[0].total_cents, 2600); ok('orders are charged the new price');
await call(admin, '/api/admin/products/khaleeji', { cookie: adm, body: { visible: false } });
assert.equal((await order({ lines: [{ id: 'khaleeji', qty: 1 }] })).data.error, 'not-offered'); ok('a hidden product cannot be ordered');
await call(admin, '/api/admin/seasons', { cookie: adm, body: { ramadan: false } });
const cat = (await call(orders, '/api/catalog')).data;
assert.equal(cat.seasons.ramadan, false); assert.equal(cat.products['iftar-pair'].shown, false); assert.equal(cat.products['eid-duo'].shown, true); ok('Ramadan off hides the Ramadan boxes only');
assert.equal((await order({ lines: [{ id: 'iftar-pair', qty: 1 }] })).data.error, 'not-offered'); ok('Ramadan boxes cannot be ordered while the season is off');
await call(admin, '/api/admin/seasons', { cookie: adm, body: { ramadan: true } });
await call(admin, '/api/admin/products/sanaani', { cookie: adm, body: { available: false } });
assert.equal((await order({ lines: [{ id: 'sanaani', qty: 1 }] })).data.error, 'sold-out'); ok('sold out stops orders');
await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { stock: 2 } });
assert.equal((await order({ lines: [{ id: 'qishr', qty: 2 }] })).status, 201);
const tooMany = await order({ lines: [{ id: 'qishr', qty: 1 }] });
assert.equal(tooMany.data.error, 'stock'); ok(`stock counts down: "${tooMany.data.message}"`);
const q = (await pg.query(`SELECT ref FROM orders o JOIN order_items i ON i.order_id = o.id WHERE i.product_id = 'qishr'`)).rows[0] as any;
await call(admin, `/api/admin/orders/${q.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } });
assert.equal((await pg.query(`SELECT stock FROM product_settings WHERE product_id = 'qishr'`)).rows[0].stock, 2); ok('cancelling gives the stock back');

// ---------- promo codes ----------
await call(admin, '/api/admin/promos', { cookie: adm, body: { code: 'eid10', kind: 'percent', value: 10, min_subtotal_cents: 3000, max_uses: 1 } });
assert.equal((await call(orders, '/api/promo', { body: { code: 'EID10', lines: [{ id: 'najdi', qty: 1 }] } })).data.error, 'promo'); ok('minimum order enforced');
const chk = await call(orders, '/api/promo', { body: { code: ' eid10 ', lines: [{ id: 'najdi', qty: 2 }] } });
assert.equal(chk.data.discount, 520); ok('10% off $52 = $5.20, code is case-insensitive');
const p1 = await order({ promo: 'EID10', lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] });
const row = (await pg.query(`SELECT discount_cents, total_cents, promo_code FROM orders WHERE ref = $1`, [p1.data.ref])).rows[0] as any;
assert.deepEqual([row.discount_cents, row.total_cents, row.promo_code], [520, 4680, 'EID10']); ok('order saved with the discount');
assert.equal((await order({ promo: 'EID10', lines: [{ id: 'najdi', qty: 2 }] })).data.error, 'promo'); ok('a one-use code cannot be used twice');
await call(admin, `/api/admin/orders/${p1.data.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } });
assert.equal((await order({ promo: 'EID10', lines: [{ id: 'najdi', qty: 2 }] })).status, 201); ok('cancelling an order gives the code use back');
await call(admin, '/api/admin/promos', { cookie: adm, body: { code: 'FREEDEL', kind: 'free-delivery', once_per_email: true } });
const fd = await order({ promo: 'FREEDEL', method: 'delivery', street: '1 Main St', postal: 'T2P1J9', email: 'same@example.com' });
assert.equal((await pg.query(`SELECT delivery_cents FROM orders WHERE ref = $1`, [fd.data.ref])).rows[0].delivery_cents, 0); ok('free-delivery code');
assert.equal((await order({ promo: 'FREEDEL', email: 'same@example.com' })).data.error, 'promo'); ok('once per customer email');
await call(admin, '/api/admin/promos', { cookie: adm, body: { code: 'OLD', kind: 'amount', value: 500, ends_on: '2020-01-01' } });
assert.match((await call(orders, '/api/promo', { body: { code: 'OLD', lines: [{ id: 'najdi', qty: 1 }] } })).data.message, /expired/); ok('expired codes refused');
await call(admin, '/api/admin/promos/FREEDEL', { cookie: adm, body: { active: false } });
assert.equal((await call(orders, '/api/promo', { body: { code: 'FREEDEL', lines: [{ id: 'najdi', qty: 1 }] } })).status, 400); ok('a turned-off code stops working');

// ---------- refunds ----------
const r0 = await order({ lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] }); // $52
const before = sent.length;
const part = await call(admin, `/api/admin/orders/${r0.data.ref}/refund`, { cookie: adm, body: { amount_cents: 2000, method: 'e-transfer', reason: 'pouch torn' } });
assert.equal(part.status, 200, JSON.stringify(part.data));
let od = (await call(admin, `/api/admin/orders/${r0.data.ref}`, { cookie: adm })).data;
assert.equal(od.order.paymentStatus, 'partly-refunded'); assert.equal(od.order.refundable, 3200); assert.equal(sent.at(-1).subject, `A refund for order ${r0.data.ref}`); assert.equal(sent.length, before + 1); ok('partial refund recorded, customer emailed');
assert.equal((await call(admin, `/api/admin/orders/${r0.data.ref}/refund`, { cookie: adm, body: { amount_cents: 5000, method: 'cash' } })).status, 400); ok('cannot refund more than is left');
assert.equal((await call(admin, `/api/admin/orders/${r0.data.ref}/refund`, { cookie: adm, body: { amount_cents: 100, method: 'card' } })).data.error, 'square-off'); ok('card refunds need Square connected');
const cr = await call(admin, `/api/admin/orders/${r0.data.ref}/refund`, { cookie: adm, body: { amount_cents: 3200, method: 'store-credit' } });
assert.match(cr.data.creditCode, /^CREDIT-[A-Z2-9]{6}$/);
od = (await call(admin, `/api/admin/orders/${r0.data.ref}`, { cookie: adm })).data;
assert.equal(od.order.paymentStatus, 'refunded'); assert.equal(od.refunds.length, 2); ok(`store credit issued as a one-time code ${cr.data.creditCode}`);
const useCredit = await order({ promo: cr.data.creditCode, lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] });
assert.equal((await pg.query(`SELECT total_cents FROM orders WHERE ref = $1`, [useCredit.data.ref])).rows[0].total_cents, 2000); ok('the credit code takes $32 off the next order');

// ---------- CSV safety ----------
const evil = await order({ name: '=HYPERLINK("http://x","click")' });
const csvText = String((await call(admin, '/api/admin/export.csv?from=1900-01-01&to=2999-01-01', { cookie: adm })).data);
assert.ok(csvText.includes(`"'=HYPERLINK(""http://x"",""click"")"`)); ok('formula-looking names are made safe in the CSV');
await call(admin, `/api/admin/orders/${evil.data.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } });

// ---------- sample orders ----------
const mailsBefore = sent.length;
const mk = await call(admin, '/api/admin/samples', { cookie: adm, body: { action: 'create' } });
assert.ok(mk.data.made >= 20, JSON.stringify(mk.data));
const weeks = (await pg.query(`SELECT COUNT(DISTINCT date_trunc('week', slot_date))::int AS w, COUNT(*)::int AS n FROM orders WHERE is_sample`)).rows[0] as any;
assert.equal(weeks.w, 5); assert.equal(sent.length, mailsBefore); ok(`${mk.data.made} sample orders over 5 weeks, no emails sent`);
const onlySamples = await call(admin, '/api/admin/orders?sample=only', { cookie: adm });
assert.equal(onlySamples.data.orders.length, weeks.n); assert.ok(onlySamples.data.orders.every((o: any) => o.sample)); ok('filter: sample orders only');
assert.ok(!(await call(admin, '/api/admin/export.csv?from=1900-01-01&to=2999-01-01', { cookie: adm })).data.includes('.sample@example.com')); ok('samples left out of the CSV');
const rm = await call(admin, '/api/admin/samples', { cookie: adm, body: { action: 'remove' } });
assert.equal(rm.data.removed, weeks.n);
assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM orders WHERE is_sample`)).rows[0].n, 0);
assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM customers WHERE email LIKE '%.sample@example.com'`)).rows[0].n, 0); ok('one click removes every sample order and sample customer');
const real = await order();
await call(admin, `/api/admin/orders/${real.data.ref}`, { cookie: adm, body: { sample: true } });
assert.equal((await call(admin, '/api/admin/orders?sample=only', { cookie: adm })).data.orders.length, 1); ok('a real test order can be marked as sample');
await call(admin, '/api/admin/samples', { cookie: adm, body: { action: 'remove' } });

// ---------- Ask Hikaya: team answers, backup answers, alerts ----------
const ask = await import('../netlify/lib/ask');
process.env.ANTHROPIC_API_KEY = 'test';
await call(admin, '/api/admin/ask/notes/', { cookie: adm, body: { question: 'Do you deliver to Airdrie?', answer: 'Not yet, Calgary only.' } });
let seen: any = null;
ask.setCreate(async (p: any) => { seen = p; return { id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Not yet, Calgary only.' }], usage: {} } as any; });
await call(help, '/api/ask', { body: { text: 'Airdrie delivery?', lang: 'en' } });
const ctx = seen.system[1].text;
assert.ok(ctx.includes('Do you deliver to Airdrie?') && ctx.includes('Not yet, Calgary only.')); ok('team answers reach the assistant straight away');
assert.ok(ctx.includes('Not offered right now') && ctx.includes('Khaleeji')); assert.ok(ctx.includes('Sold out right now: Sana')); assert.ok(ctx.includes('Najdi $26')); ok('assistant knows hidden, sold-out and re-priced products');
assert.ok(seen.system[0].cache_control && !seen.system[1].cache_control); ok('handbook stays cached; live details sent fresh');
const credit = Object.assign(new Error('Your credit balance is too low to access the Anthropic API.'), { status: 400 });
ask.setCreate(async () => { throw credit; });
const mails = sent.length;
const down = await call(help, '/api/ask', { body: { text: 'وصلني صندوق التمر مكسور', lang: 'ar' } });
assert.match(down.data.reply, /استراحة/); assert.match(down.data.reply, /\/ar\/help\//); assert.match(down.data.reply, /٤٨ ساعة/); ok('out of credit: a useful backup answer, in Arabic');
assert.equal(sent.length, mails + 1); assert.match(sent.at(-1).subject, /backup answers \(credits\)/); ok('the team is emailed once');
await call(help, '/api/ask', { body: { text: 'delivery?', lang: 'en' } });
assert.equal(sent.length, mails + 1); ok('no second email within six hours');
let st = (await call(admin, '/api/admin/ask', { cookie: adm })).data;
assert.equal(st.status.ok, false); assert.equal(st.status.reason, 'credits'); ok('admin desk shows it is on backup answers');
ask.setCreate(async () => ({ id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Back.' }], usage: {} } as any));
await call(help, '/api/ask', { body: { text: 'hi', lang: 'en' } });
st = (await call(admin, '/api/admin/ask', { cookie: adm })).data;
assert.equal(st.status.ok, true); assert.equal(st.notes.length, 1); ok('recovers by itself when the model answers again');

// ---------- rate limits ----------
const rl = await import('../netlify/lib/rate');
let blocked = false;
for (let i = 0; i < 40 && !blocked; i++) { try { await rl.limit('order:test-ip', 8, 60); } catch (e: any) { blocked = e.status === 429; } }
assert.ok(blocked); ok('a script placing many orders from one place is stopped after 8 an hour');

console.log(`\n${pass} checks passed`);
