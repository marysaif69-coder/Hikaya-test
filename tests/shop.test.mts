// Shop management: live prices, hidden products, seasons, stock, promo codes, refunds, sample
// orders, the order-by deadline, and Ask Hikaya's team answers and backup answers.
// Run: npx tsx tests/shop.test.mts
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { setSql } from '../netlify/lib/db';

process.env.ADMIN_EMAILS = 'maryam@hikayacoffee.ca';
process.env.STAFF_EMAILS = 'helper@hikayacoffee.ca';
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
const driverApi = (await import('../netlify/functions/api-driver.mts')).default;
// Coffee prices are set by the owners in the desk; stand-ins for the tests.
const { PRODUCTS: ALL } = await import('../src/data/products');
for (const p of ALL) if (p.price == null) await pg.query('INSERT INTO product_settings (product_id, price_cents, updated_by) VALUES ($1, $2, $3)', [p.id, p.kind === 'pack' ? 500 : p.fam === 'mountain' ? 2600 : 2400, 'test']);
const H = 'https://hikaya.test';
let ipN = 0; // each request from a different address, so the rate limits don't trip
const { setClock } = await import('../netlify/lib/slots');
const call = async (fn: any, path: string, opts: { body?: any; cookie?: string } = {}) => {
  // A route can only start on its own day: the 2027 route tests run "on" that day (noon in Calgary).
  const startDay = path.match(/^\/api\/driver\/start\?date=(\d{4}-\d{2}-\d{2})/)?.[1];
  if (startDay) setClock(() => new Date(`${startDay}T18:00:00Z`));
  const res: Response = await fn(new Request(H + path, { method: opts.body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin: H, 'x-nf-client-connection-ip': `10.0.0.${++ipN % 250}`, ...(opts.cookie ? { cookie: opts.cookie } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined }));
  if (startDay) setClock(null);
  const text = await res.text(); let data: any; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
};
const login = async (email: string) => {
  const rq: Response = await auth(new Request(H + '/api/auth/request', { method: 'POST', headers: { 'content-type': 'application/json', origin: H, 'x-nf-client-connection-ip': `10.1.0.${++ipN % 250}` }, body: JSON.stringify({ email, lang: 'en' }) }));
  const lc = rq.headers.get('set-cookie')!.split(';')[0];
  const code = sent.at(-1).text.match(/\b\d{6}\b/)[0];
  const res: Response = await auth(new Request(H + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json', origin: H, cookie: lc }, body: JSON.stringify({ email, code }) }));
  return res.headers.get('set-cookie')!.split(';')[0];
};
let pass = 0; const ok = (m: string) => { pass++; console.log('  ✓', m); };
const adm = await login('maryam@hikayacoffee.ca');
let n = 0;
const order = (extra: any = {}) => call(orders, '/api/orders', { body: { lang: 'en', name: 'Test Person', phone: '403-555-0100', email: `t${++n}@example.com`, method: 'pickup', day: '2027-01-22', window: '11:00–14:00', payment: 'e-transfer', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }], ...extra } });

// ---------- order-by deadline ----------
const { bookable, cutoffFor, calgaryNow } = await import('../netlify/lib/slots');
// The instant when it is `hour` o'clock in Calgary on `date`, whatever Calgary's UTC offset is
// in the machine's time-zone data (Alberta's rules may change).
const atCalgary = (date: string, hour: number) => {
  for (let off = 4; off <= 9; off++) {
    const t = new Date(Date.parse(`${date}T${String(hour).padStart(2, '0')}:30:00Z`) + off * 3600_000);
    const c = calgaryNow(t); if (c.date === date && c.hour === hour) return t;
  }
  throw new Error('no such Calgary time');
};
const weekly = { open: true, firstDay: '2027-01-01', cutoffHour: 20, cutoffMode: 'weekly' as const, cutoffWeekday: 2, closedDates: ['2027-01-24'] };
assert.deepEqual(cutoffFor('2027-01-23', weekly), { date: '2027-01-19', hour: 20 }); ok('weekly: Saturday 23 Jan closes Tuesday 19 Jan, 8 pm');
assert.equal(bookable('2027-01-21', weekly, atCalgary('2027-01-19', 19)), true); ok('Tuesday 7 pm: this Thursday is still open');
assert.equal(bookable('2027-01-21', weekly, atCalgary('2027-01-19', 21)), false);
assert.equal(bookable('2027-01-28', weekly, atCalgary('2027-01-19', 21)), true); ok('Tuesday 9 pm: this week has closed, next week is open');
assert.equal(bookable('2027-01-24', weekly, atCalgary('2027-01-10', 12)), false); ok('closed days cannot be booked');
const dayBefore = { ...weekly, cutoffMode: 'day-before' as const, closedDates: [] };
assert.equal(bookable('2027-01-22', dayBefore, atCalgary('2027-01-21', 19)), true);
assert.equal(bookable('2027-01-22', dayBefore, atCalgary('2027-01-21', 21)), false); ok('evening-before mode: closes 8 pm the day before');
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
await call(admin, '/api/admin/products/hijazi', { cookie: adm, body: { visible: false } });
assert.equal((await order({ lines: [{ id: 'hijazi', qty: 1 }] })).data.error, 'not-offered'); ok('a hidden product cannot be ordered');
await call(admin, '/api/admin/seasons', { cookie: adm, body: { ramadan: false } });
const cat = (await call(orders, '/api/catalog')).data;
assert.equal(cat.seasons.ramadan, false); assert.equal(cat.products['iftar-pair'].shown, false); assert.equal(cat.products['eid-duo'].shown, true); ok('Ramadan off hides the Ramadan boxes only');
assert.equal((await order({ lines: [{ id: 'iftar-pair', qty: 1 }] })).data.error, 'not-offered'); ok('Ramadan boxes cannot be ordered while the season is off');
await call(admin, '/api/admin/seasons', { cookie: adm, body: { ramadan: true } });
await call(admin, '/api/admin/products/jubani', { cookie: adm, body: { available: false } });
assert.equal((await order({ lines: [{ id: 'jubani', qty: 1 }] })).data.error, 'sold-out'); ok('sold out stops orders');
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
const unpaidRefund = await call(admin, `/api/admin/orders/${r0.data.ref}/refund`, { cookie: adm, body: { amount_cents: 500, method: 'cash' } });
assert.equal(unpaidRefund.data.error, 'not-paid'); assert.equal((await call(admin, `/api/admin/orders/${r0.data.ref}`, { cookie: adm })).data.order.refundable, 0); ok('an unpaid order cannot be refunded (the money would never be collected)');
await call(admin, `/api/admin/orders/${r0.data.ref}`, { cookie: adm, body: { paymentStatus: 'paid' } });
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
const realOnly = (await call(admin, '/api/admin/orders?sample=hide', { cookie: adm })).data;
const realCount = (await pg.query(`SELECT COUNT(*)::int AS n FROM orders WHERE NOT is_sample`)).rows[0] as any;
assert.equal(Object.values(realOnly.counts as Record<string, number>).reduce((a, b) => a + b, 0), realCount.n); ok('totals at the top follow the filter');
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
assert.ok(ctx.includes('Not offered right now') && ctx.includes('Hijazi')); assert.ok(ctx.includes('Sold out right now: Jubani')); assert.ok(ctx.includes('Najdi $26')); ok('assistant knows hidden, sold-out and re-priced products');
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
ask.setCreate(async () => { throw credit; });
const mails2 = sent.length;
await call(help, '/api/ask', { body: { text: 'hello', lang: 'en' } });
assert.equal(sent.length, mails2); ok('a recovery does not reset the six-hour alert gap');
ask.setCreate(async () => ({ id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Back.' }], usage: {} } as any));
await call(help, '/api/ask', { body: { text: 'hi', lang: 'en' } });
let step = 0;
ask.setCreate(async () => {
  if (step++ === 0) return { id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_x', name: 'check_postal_code', input: { postal_code: 'T2P' } }], usage: {} } as any;
  throw credit;
});
await call(help, '/api/ask', { body: { text: 'Do you deliver to T2P?', lang: 'en' } });
st = (await call(admin, '/api/admin/ask', { cookie: adm })).data;
assert.equal(st.status.ok, false); ok('a turn that fails after its first answer still shows as down');
ask.setCreate(async () => ({ id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Back.' }], usage: {} } as any));
await call(help, '/api/ask', { body: { text: 'hi', lang: 'en' } });

// Backup answers: every suggestion chip gets a real answer, and a missing delivery goes to the help form.
const { offlineAnswer } = await import('../netlify/lib/ask-fallback');
const generic = (l: 'en' | 'ar') => offlineAnswer('zzz', l);
const chipsSrc = fs.readFileSync('src/components/AskHikaya.astro', 'utf8').match(/chips: ar \? (\[.*?\]) : (\[.*?\]),/)!;
for (const [i, l] of [[1, 'ar'], [2, 'en']] as const) for (const chip of JSON.parse(chipsSrc[i].replace(/'/g, '"')) as string[])
  assert.notEqual(offlineAnswer(chip, l), generic(l), chip);
for (const [q, l] of [['My delivery did not arrive', 'en'], ['My order is late', 'en'], ['لم يصل التوصيل', 'ar']] as const) {
  const a = offlineAnswer(q, l); assert.match(a, /\/help\//, q); assert.doesNotMatch(a, /\$9|٩ \$/, q);
}
assert.doesNotMatch(offlineAnswer('Is it too late to order chocolate?', 'en'), /did not arrive/); ok('backup answers: every chip answered; a missing delivery goes to the help form');

// ---------- weekly roast and pack sheet ----------
const { weekStart } = await import('../netlify/lib/week');
assert.equal(weekStart('2027-01-22'), '2027-01-21'); assert.equal(weekStart('2027-01-19'), '2027-01-21'); assert.equal(weekStart('2027-01-24'), '2027-01-21'); ok('a service week runs Thursday to Wednesday');
const sheet = async () => (await call(admin, '/api/admin/week?from=2027-01-21', { cookie: adm })).data;
// Najdi is Gulf coffee plus its saffron packet: the sheet counts Gulf pouches and saffron packs.
const najdiPouches = (s: any) => s.coffee.filter((r: any) => r.id === 'gulf').reduce((a: number, r: any) => a + r.pouches, 0);
const saffronPacks = (s: any) => s.packs.filter((r: any) => r.id === 'pack-saffron').reduce((a: number, r: any) => a + r.full, 0);
const w0 = await sheet();
assert.equal((await order({ lines: [{ id: 'guest-box', qty: 1 }, { id: 'najdi', opt: 'dallah', qty: 2 }] })).status, 201);
const w1 = await sheet();
assert.equal(najdiPouches(w1) - najdiPouches(w0), 3); assert.equal(saffronPacks(w1) - saffronPacks(w0), 3); assert.equal(w1.packaging.giftBoxes.C12 - w0.packaging.giftBoxes.C12, 1);
const packRow = (s: any, id: string) => s.packs.find((r: any) => r.id === id) ?? { full: 0, mini: 0 };
assert.equal((await order({ day: '2027-01-23', lines: [{ id: 'taste-gulf', qty: 1 }, { id: 'pack-radai', qty: 2 }] })).status, 201);
const w2 = await sheet();
assert.equal(najdiPouches(w2) - najdiPouches(w1), 1); assert.equal(packRow(w2, 'pack-qassim').mini - packRow(w1, 'pack-qassim').mini, 1);
assert.equal(saffronPacks(w2) - saffronPacks(w1), 1); assert.equal(packRow(w2, 'pack-radai').full - packRow(w1, 'pack-radai').full, 2);
ok('styles and discovery packs count their bag and packs (small ones apart); a pack on its own counts as a pack');
const kitLine = (await order({ day: '2027-01-24', lines: [{ id: 'radai', opt: 'powder', qty: 1 }] })).data.ref;
assert.equal((await pg.query('SELECT i.option FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.ref = $1', [kitLine])).rows[0].option, 'fine'); ok('a style takes the grind of its bag');
assert.equal((w1.dates.find((d: any) => d.id === 'khalas')?.pieces ?? 0) - (w0.dates.find((d: any) => d.id === 'khalas')?.pieces ?? 0), 12);
assert.equal(w1.packaging.sleeves.regular - w0.packaging.sleeves.regular, 1); ok('week sheet counts coffee inside gift boxes, dates to portion, boxes and sleeves');

// ---------- gift orders ----------
assert.equal((await order({ gift: true })).status, 400); ok('a gift needs the name of the person receiving it');
const mailsG = sent.length;
const g = await order({ gift: true, gift_to: 'Aunt Huda', gift_phone: '403-555-0199', gift_message: 'Eid Mubarak!', method: 'delivery', street: '1 Main St', postal: 'T2P1J9' });
assert.equal(g.status, 201);
const gMails = sent.slice(mailsG);
assert.ok(gMails.some(m => m.html?.includes('Aunt Huda') && m.html.includes('Eid Mubarak!'))); assert.ok(gMails.some(m => /GIFT for Aunt Huda/.test(m.text))); ok('gift shows in the customer email and the team alert');
const gd = (await call(admin, `/api/admin/day?date=2027-01-22`, { cookie: adm })).data;
assert.equal(gd.deliveries.find((o: any) => o.ref === g.data.ref).gift.phone, '403-555-0199'); ok('the driver sees who receives it and their phone');

// ---------- back-in-stock alerts ----------
await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { available: false } });
assert.equal((await call(orders, '/api/notify-me', { body: { product: 'qishr', email: 'not-an-email', lang: 'en' } })).status, 400);
assert.equal((await call(orders, '/api/notify-me', { body: { product: 'qishr', email: 'Wait@Example.com', lang: 'ar' } })).status, 200);
await call(orders, '/api/notify-me', { body: { product: 'qishr', email: 'wait@example.com', lang: 'ar' } });
assert.equal((await call(admin, '/api/admin/products', { cookie: adm })).data.products.find((p: any) => p.id === 'qishr').waiting, 1); ok('one waiting entry per email, shown in Products');
const mailsA = sent.length;
const back = await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { available: true, stock: null } });
assert.equal(back.data.told, 1); assert.equal(sent.length, mailsA + 1); assert.deepEqual(sent.at(-1).to, ['wait@example.com']); assert.match(sent.at(-1).html, /\/ar\/shop\/qishr\//); ok('back on sale emails the waiting list once, in their language');
assert.equal((await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { available: true } })).data.told, 0); ok('nobody is emailed twice');
const qishrPrice = (await call(admin, '/api/admin/products', { cookie: adm })).data.products.find((p: any) => p.id === 'qishr').price_cents;
await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { price_cents: null, available: false } });
await call(orders, '/api/notify-me', { body: { product: 'qishr', email: 'noprice@example.com', lang: 'en' } });
assert.equal((await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { available: true } })).data.told, 0);
assert.equal((await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { price_cents: 1200 } })).data.told, 1); ok('no "it\'s back" email until the product has a price');
await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { price_cents: qishrPrice } });
await call(admin, '/api/admin/seasons', { cookie: adm, body: { ramadan: false } });
await call(orders, '/api/notify-me', { body: { product: 'iftar-pair', email: 'ramadan@example.com', lang: 'en' } });
assert.equal((await call(admin, '/api/admin/seasons', { cookie: adm, body: { ramadan: true } })).data.told, 1); ok('switching Ramadan on tells people waiting for Ramadan boxes');

// ---------- mailing list (CASL) ----------
const noTick = await call(orders, '/api/list', { body: { email: 'news@example.com', lang: 'en' } });
assert.equal(noTick.status, 400); assert.equal(noTick.data.error, 'consent'); ok('no sign-up without ticking the consent box');
assert.equal((await call(orders, '/api/list', { body: { email: 'news@example.com', lang: 'en', consent: true } })).status, 200);
const confirmUrl = new URL(sent.at(-1).html.match(/https:\/\/hikaya\.test\/api\/list\/confirm\?t=[\w-]+/)[0]);
assert.equal((await call(admin, '/api/admin/list', { cookie: adm })).data.waiting, 1); ok('sign-up waits for the email confirmation');
const conf: Response = await orders(new Request(confirmUrl.href));
assert.equal(conf.status, 303); assert.match(conf.headers.get('location')!, /\/en\/thanks\/\?list=1/);
assert.equal((await orders(new Request(confirmUrl.href))).headers.get('location')!.includes('listexpired'), true);
const csvList = String((await call(admin, '/api/admin/list.csv', { cookie: adm })).data);
assert.ok(csvList.includes('news@example.com') && csvList.includes('unsubscribe at any time')); ok('confirmed; the CSV keeps when and what they agreed to');
const unsubT = (await pg.query(`SELECT unsub_token FROM subscribers WHERE email = 'news@example.com'`)).rows[0] as any;
await orders(new Request(`${H}/api/list/unsubscribe?t=${unsubT.unsub_token}`));
const ls = (await call(admin, '/api/admin/list', { cookie: adm })).data;
assert.equal(ls.confirmed, 0); assert.equal(ls.left, 1); ok('one click unsubscribes');
await call(orders, '/api/list', { body: { email: 'oneclick@example.com', lang: 'en', consent: true } });
const ocT = (await pg.query(`SELECT unsub_token FROM subscribers WHERE email = 'oneclick@example.com'`)).rows[0] as any;
const oc: Response = await orders(new Request(`${H}/api/list/unsubscribe?t=${ocT.unsub_token}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://mail.google.com' }, body: 'List-Unsubscribe=One-Click' }));
assert.equal(oc.status, 200); assert.ok(((await pg.query(`SELECT unsubscribed_at FROM subscribers WHERE email = 'oneclick@example.com'`)).rows[0] as any).unsubscribed_at); ok('one-click unsubscribe from the mail app (a POST from another site) works');
await order({ newsletter: true, email: 'buyer-news@example.com' });
assert.ok(sent.some(m => m.to?.includes('buyer-news@example.com') && /confirm/i.test(m.subject))); ok('the checkout tick sends the same confirmation email');

// ---------- visit numbers ----------
assert.equal((await call(orders, '/api/hit', { body: { path: '/en/shop/?x=1', ref: 'https://www.instagram.com/hikaya' } })).status, 204);
await call(orders, '/api/hit', { body: { path: '/admin/', ref: '' } });
const nums = (await call(admin, '/api/admin/numbers', { cookie: adm })).data;
assert.equal(nums.pages.find((p: any) => p.path === '/en/shop/').views, 1); assert.ok(!nums.pages.some((p: any) => p.path === '/admin/'));
assert.equal(nums.refs[0].ref, 'instagram.com'); ok('page counts without cookies; admin pages not counted; where visitors came from');

// ---------- connections ----------
const con = (await call(admin, '/api/admin/connections', { cookie: adm })).data;
assert.equal(con.email.key, true);
assert.equal(con.checklist.find((x: any) => x.name === 'RESEND_API_KEY').set, true); assert.equal(con.checklist.find((x: any) => x.name === 'GOOGLE_REVIEW_URL').set, false);
assert.ok(!JSON.stringify(con).includes('test-key')); ok('settings checklist says which are added, never their values'); assert.equal(con.square.enabled, false); assert.match(con.square.webhookUrl, /\/api\/square\/webhook$/);
const te = await call(admin, '/api/admin/connections/test-email', { cookie: adm, body: {} });
assert.deepEqual(sent.at(-1).to, ['maryam@hikayacoffee.ca']); assert.match(sent.at(-1).subject, /test email/); assert.equal(te.data.to, 'maryam@hikayacoffee.ca'); ok('Settings shows the connections and sends a test email');

// ---------- team roles ----------
const helper = await login('helper@hikayacoffee.ca');
const hOrders = await call(admin, '/api/admin/orders', { cookie: helper });
assert.equal(hOrders.status, 200);
assert.equal((await call(admin, `/api/admin/orders/${g.data.ref}`, { cookie: helper, body: { status: 'out-for-delivery', notify: false } })).status, 200);
assert.equal((await call(admin, '/api/admin/week', { cookie: helper })).status, 200); assert.equal((await call(admin, '/api/admin/connections', { cookie: helper })).data.checklist.length, 0); ok('a helper can run orders, deliveries and the week sheet');
for (const [path, body] of [[`/api/admin/orders/${g.data.ref}/refund`, { amount_cents: 100, method: 'cash' }], ['/api/admin/products/najdi', { price_cents: 100 }], ['/api/admin/seasons', { eid: false }], ['/api/admin/promos', { code: 'FREE', kind: 'percent', value: 100 }], ['/api/admin/settings', { open: false }]] as const)
  assert.equal((await call(admin, path, { cookie: helper, body })).status, 403, path);
for (const path of ['/api/admin/export.csv', '/api/admin/list.csv']) assert.equal((await call(admin, path, { cookie: helper })).status, 403, path);
assert.equal((await call(admin, `/api/admin/orders/${g.data.ref}`, { cookie: helper, body: { sample: true } })).status, 400); ok('a helper cannot refund, change prices, seasons, promo codes, settings or export');
assert.equal((await call(admin, '/api/admin/orders', { cookie: await login('someone@example.com') })).status, 403); ok('customers stay out of the desk');

// ---------- words: recipes and product text ----------
const noTok = (await call(admin, '/api/admin/content/recipes', { cookie: adm })).data;
assert.equal(noTok.canSave, false); assert.ok(noTok.data.palm.steps.length); ok('Words shows the built text when GitHub is not connected');
assert.equal((await call(admin, '/api/admin/content/toString', { cookie: adm })).status, 404);
process.env.GITHUB_CONTENT_TOKEN = 'test-token';
let ghFile = fs.readFileSync('src/content/recipes.json', 'utf8'); let ghSha = 'sha1'; const puts: any[] = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any = {}) => {
  if (String(url).startsWith('https://api.github.com/')) {
    assert.equal(init.headers.authorization, 'Bearer test-token');
    if (init.method === 'PUT') { const b = JSON.parse(init.body); if (b.sha !== ghSha) return new Response('{}', { status: 409 }); puts.push(b); ghFile = Buffer.from(b.content, 'base64').toString('utf8'); ghSha = 'sha2'; return new Response(JSON.stringify({ content: { sha: ghSha } }), { status: 200 }); }
    return new Response(JSON.stringify({ content: Buffer.from(ghFile).toString('base64'), sha: ghSha }), { status: 200 });
  }
  return prevFetch(url, init);
}) as any;
const rc = (await call(admin, '/api/admin/content/recipes', { cookie: adm })).data;
assert.equal(rc.canSave, true); assert.equal(rc.sha, 'sha1');
const edited = JSON.parse(JSON.stringify(rc.data));
edited.palm.serve.en = 'Pour a third of the cup.'; edited.palm.steps[2].secs = 540; edited.palm.extra = 'sneaky'; edited.sneaky = { a: 1 };
assert.equal((await call(admin, '/api/admin/content/recipes', { cookie: helper, body: { data: edited, sha: 'sha1' } })).status, 403);
const sv = await call(admin, '/api/admin/content/recipes', { cookie: adm, body: { data: edited, sha: 'sha1' } });
assert.equal(sv.data.saved, true); const savedJson = JSON.parse(ghFile);
assert.equal(savedJson.palm.serve.en, 'Pour a third of the cup.'); assert.equal(savedJson.palm.steps[2].secs, 540); assert.equal(savedJson.palm.extra, undefined); assert.equal(savedJson.sneaky, undefined);
assert.match(puts[0].message, /by maryam@hikayacoffee.ca/); assert.equal(puts[0].branch, 'claude/frontend-design-skills-setup-2e6lwc'); ok('saving writes only the existing words to GitHub, with who changed it');
assert.equal((await call(admin, '/api/admin/content/recipes', { cookie: adm, body: { data: edited, sha: 'sha1' } })).status, 409); ok('two people saving at once: the second is asked to reload');
edited.palm.serve.ar = '  '; assert.equal((await call(admin, '/api/admin/content/recipes', { cookie: adm, body: { data: edited, sha: 'sha2' } })).status, 400);
edited.palm.serve.ar = 'x'; edited.palm.steps.pop(); assert.equal((await call(admin, '/api/admin/content/recipes', { cookie: adm, body: { data: edited, sha: 'sha2' } })).status, 400); ok('empty text and missing steps are refused');
globalThis.fetch = prevFetch; delete process.env.GITHUB_CONTENT_TOKEN;

// ---------- gift cards ----------
const gcBad = await call(orders, '/api/giftcard', { body: { amount_cents: 1234, buyer_name: 'Sara', buyer_email: 'sara@example.com', to_name: 'Huda' } });
assert.equal(gcBad.status, 400); assert.ok(gcBad.data.fields.amount); ok('gift cards only in the set amounts');
const mailsGc = sent.length;
const gc = await call(orders, '/api/giftcard', { body: { amount_cents: 5000, buyer_name: 'Sara', buyer_email: 'sara@example.com', to_name: 'Huda', to_email: 'huda@example.com', message: 'Ramadan Kareem', payment: 'e-transfer', lang: 'en' } });
assert.equal(gc.status, 201); assert.match(gc.data.ref, /^GC-/);
assert.equal(sent.length, mailsGc + 1); assert.match(sent.at(-1).subject, /gift card order/); assert.ok(!/GIFT-/.test(sent.at(-1).html)); ok('buying by e-Transfer: the buyer gets payment details, no code yet');
const gcCode = (await pg.query(`SELECT code FROM gift_cards WHERE ref = $1`, [gc.data.ref])).rows[0].code as string;
assert.equal((await call(orders, '/api/giftcard/check', { body: { code: gcCode } })).status, 400); ok('an unpaid gift card does not work');
assert.equal((await call(admin, `/api/admin/giftcards/${gc.data.ref}/paid`, { cookie: helper, body: {} })).status, 403);
const gp = await call(admin, `/api/admin/giftcards/${gc.data.ref}/paid`, { cookie: adm, body: {} });
assert.equal(gp.data.sentTo, 'huda@example.com');
const toHuda = sent.find(m => m.to?.includes('huda@example.com') && m.html.includes(gcCode));
assert.ok(toHuda && toHuda.html.includes('Ramadan Kareem')); assert.ok(sent.some(m => m.to?.includes('sara@example.com') && /on its way/.test(m.subject)));
const n1 = sent.length; await call(admin, `/api/admin/giftcards/${gc.data.ref}/paid`, { cookie: adm, body: {} }); assert.equal(sent.length, n1); ok('marked paid: the code goes to the recipient with the message, once');
assert.equal((await call(orders, '/api/giftcard/check', { body: { code: gcCode.toLowerCase() } })).data.balance, 5000); ok('balance check');
const gcO1 = await order({ giftcard: gcCode, lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
const r1 = (await pg.query(`SELECT total_cents, gift_card_cents, payment_status FROM orders WHERE ref = $1`, [gcO1.data.ref])).rows[0] as any;
assert.equal(r1.total_cents, 0); assert.equal(r1.payment_status, 'paid'); assert.equal((await call(orders, '/api/giftcard/check', { body: { code: gcCode } })).data.balance, 5000 - r1.gift_card_cents);
assert.match(sent.find(m => m.subject?.includes(gcO1.data.ref) && m.to?.[0]?.startsWith('t'))!.html, /Paid in full with your gift card/); ok('a small order is paid in full by the card; the rest stays on it');
const left = 5000 - r1.gift_card_cents;
const gcO2 = await order({ giftcard: gcCode, lines: [{ id: 'najdi', opt: 'dallah', qty: 3 }] });
const r2 = (await pg.query(`SELECT total_cents, subtotal_cents, gift_card_cents, payment_status FROM orders WHERE ref = $1`, [gcO2.data.ref])).rows[0] as any;
assert.equal(r2.gift_card_cents, left); assert.equal(r2.total_cents, r2.subtotal_cents - left); assert.equal(r2.payment_status, 'unpaid');
assert.equal((await call(orders, '/api/giftcard/check', { body: { code: gcCode } })).status, 400); ok('a bigger order uses what is left and the customer pays the rest');
await call(admin, `/api/admin/orders/${gcO2.data.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } });
assert.equal((await call(orders, '/api/giftcard/check', { body: { code: gcCode } })).data.balance, left); ok('cancelling puts the money back on the card');
assert.equal((await order({ giftcard: 'GIFT-NOPE99' })).data.error, 'giftcard'); ok('a wrong code is refused');

// ---------- text-message reminders and the daily job ----------
const { e164 } = await import('../netlify/lib/sms');
assert.equal(e164('403 555 0100'), '+14035550100'); assert.equal(e164('1-587-555-0100'), '+15875550100'); assert.equal(e164('12'), null); ok('phone numbers made ready for texting');
process.env.TWILIO_ACCOUNT_SID = 'AC1'; process.env.TWILIO_AUTH_TOKEN = 'tok'; process.env.TWILIO_FROM = '+15875550000';
const texts: any[] = []; const f0 = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any) => { if (String(url).includes('api.twilio.com')) { texts.push(Object.fromEntries(new URLSearchParams(init.body))); return new Response('{}', { status: 201 }); } return f0(url, init); }) as any;
const smsO = await order({ sms: true, day: '2027-01-29', lang: 'ar' });
await order({ day: '2027-01-29' });
const { daily } = await import('../netlify/functions/reminders.mts');
const d1 = await daily('2027-01-28');
assert.equal(texts.length, 1); assert.equal(texts[0].To, '+14035550100'); assert.ok(texts[0].Body.includes(smsO.data.ref) && /تذكير/.test(texts[0].Body)); ok('only customers who ticked the box get a text, in their language');
await daily('2027-01-28'); assert.equal(texts.length, 1); ok('one text per order');
globalThis.fetch = f0; delete process.env.TWILIO_ACCOUNT_SID;

// ---------- regular orders ----------
const subO = await order({ repeat: 2, email: 'regular@example.com', day: '2027-01-22', lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] });
assert.equal(subO.status, 201);
const sub = (await pg.query(`SELECT * FROM subscriptions WHERE email = 'regular@example.com'`)).rows[0] as any;
assert.equal(String(sub.next_date instanceof Date ? sub.next_date.toISOString() : sub.next_date).slice(0, 10), '2027-02-05'); assert.equal(sub.every_weeks, 2);
assert.ok(sent.some(m => m.to?.includes('regular@example.com') && /regular order is set/.test(m.subject))); ok('"repeat every 2 weeks" sets up the next one two weeks later');
await daily('2027-01-25');
assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM orders WHERE subscription_id = $1`, [sub.id])).rows[0].n, 1); ok('nothing is placed more than a week ahead');
await daily('2027-01-29');
const placedRows = (await pg.query(`SELECT ref, slot_date::text AS d, total_cents FROM orders WHERE subscription_id = $1 ORDER BY id`, [sub.id])).rows as any[];
assert.equal(placedRows.length, 2); assert.equal(placedRows[1].d, '2027-02-05');
assert.ok(sent.some(m => m.subject?.includes(placedRows[1].ref) && /your regular order, every 2 weeks/.test(m.html))); ok('a week before, it becomes a real order with the usual emails');
await daily('2027-01-30'); assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM orders WHERE subscription_id = $1`, [sub.id])).rows[0].n, 2); ok('and only once');
const regCookie = await login('regular@example.com');
const mine = (await call(orders, '/api/my/subscriptions', { cookie: regCookie })).data.subscriptions;
assert.equal(mine.length, 1); assert.equal(mine[0].next, '2027-02-19'); assert.equal(mine[0].lines[0].name.en, 'Najdi');
assert.equal((await call(orders, '/api/my/subscriptions', { cookie: regCookie, body: { id: sub.id, action: 'skip' } })).data.next, '2027-03-05'); ok('the customer sees it and can skip one');
assert.equal((await call(orders, '/api/my/subscriptions', { cookie: adm, body: { id: sub.id, action: 'stop' } })).status, 404); ok('nobody else can change it');
assert.equal((await call(orders, '/api/my/subscriptions', { cookie: regCookie, body: { id: sub.id, action: 'pause' } })).data.status, 'paused');
await daily('2027-02-27'); assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM orders WHERE subscription_id = $1`, [sub.id])).rows[0].n, 2); ok('paused: nothing is placed');
await call(orders, '/api/my/subscriptions', { cookie: regCookie, body: { id: sub.id, action: 'stop' } });
assert.equal((await call(orders, '/api/my/subscriptions', { cookie: regCookie })).data.subscriptions.length, 0); ok('stopped');
await call(admin, '/api/admin/products/jubani', { cookie: adm, body: { available: false } });
await order({ repeat: 4, email: 'gone@example.com', day: '2027-01-22', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
await pg.query(`UPDATE subscriptions SET lines = '[{"id":"jubani","opt":"dallah","qty":1}]'::jsonb WHERE email = 'gone@example.com'`);
await daily('2027-02-12');
assert.ok(sent.some(m => m.to?.includes('gone@example.com') && /couldn't place/i.test(m.subject))); ok('if something is sold out, the customer is told and the next one stays');

// ---------- monthly report ----------
const rep = (await call(admin, '/api/admin/report?month=2026-11', { cookie: adm })).data;
assert.equal(rep.month, '2026-10'); assert.match(rep.html, /Sales \(after refunds\)/); ok('report preview for last month');
const before2 = sent.length;
await daily('2027-03-01'); assert.ok(sent.slice(before2).some(m => /month in numbers \(February 2027\)/.test(m.subject))); 
const before3 = sent.length; await daily('2027-03-01'); assert.ok(!sent.slice(before3).some(m => /month in numbers/.test(m.subject))); ok('on the 1st the owners get last month in numbers, once');
assert.equal((await call(admin, '/api/admin/report', { cookie: helper })).status, 403); ok('helpers do not see the money report');

// ---------- wave 2: details, moving orders, customers, low stock, tomorrow email ----------
const mover = await login('mover@example.com');
assert.equal((await call(orders, '/api/my/details', { cookie: mover })).data.name, ''); 
const mv = await order({ email: 'mover@example.com', name: 'Mona Mover', phone: '403-555-0111', method: 'delivery', street: '9 Elm St', postal: 'T3A0A1', day: '2027-01-22' });
const det = (await call(orders, '/api/my/details', { cookie: mover })).data;
assert.equal(det.name, 'Mona Mover'); assert.equal(det.street, '9 Elm St'); assert.equal(det.postal, 'T3A 0A1'); ok('logged-in customers get their last details filled in at checkout');
assert.equal((await call(orders, '/api/my/details')).status, 401);
const mvMails = sent.length;
const moved = await call(orders, '/api/my/orders/move', { cookie: mover, body: { ref: mv.data.ref, day: '2027-01-23', window: '14:00–17:00' } });
assert.equal(moved.status, 200); assert.equal(moved.data.order.day, '2027-01-23');
assert.ok(sent.slice(mvMails).some(m => /New day for order/.test(m.subject) && m.to.includes('mover@example.com'))); ok('a customer moves their own order to another day; they get an email');
assert.equal((await call(orders, '/api/my/orders/move', { cookie: regCookie, body: { ref: mv.data.ref, day: '2027-01-24', window: '11:00–14:00' } })).status, 404); ok('nobody else can move it');
assert.equal((await call(orders, '/api/my/orders/move', { cookie: mover, body: { ref: mv.data.ref, day: '2027-01-26', window: '11:00–14:00' } })).data.error, 'bad-day'); ok('only Thursday to Sunday');
await call(admin, `/api/admin/orders/${mv.data.ref}`, { cookie: adm, body: { status: 'ready', notify: false } });
assert.equal((await call(orders, '/api/my/orders/move', { cookie: mover, body: { ref: mv.data.ref, day: '2027-01-24', window: '11:00–14:00' } })).data.error, 'cannot-move'); ok('not once it is being prepared');
await call(admin, `/api/admin/orders/${mv.data.ref}`, { cookie: adm, body: { status: 'confirmed', notify: false } });
const forced = await call(admin, `/api/admin/orders/${mv.data.ref}/move`, { cookie: helper, body: { day: '2027-01-28', window: '17:00–20:00', force: true } });
assert.equal(forced.data.day, '2027-01-28'); ok('the team can move any order (even past the deadline)');

const cl = (await call(admin, '/api/admin/customers?q=mover', { cookie: helper })).data.customers;
assert.equal(cl.length, 1); assert.equal(cl[0].orders, 1); assert.ok(cl[0].spent > 0);
assert.ok(!(await call(admin, '/api/admin/customers', { cookie: adm })).data.customers.some((c: any) => c.email.endsWith('.sample@example.com'))); ok('customer list with orders and spending, searchable');
await call(admin, `/api/admin/customers/${cl[0].id}`, { cookie: helper, body: { note: 'Side door, ring twice' } });
const cd = (await call(admin, `/api/admin/customers/${cl[0].id}`, { cookie: adm })).data;
assert.equal(cd.customer.team_note, 'Side door, ring twice'); assert.equal(cd.orders[0].ref, mv.data.ref);
assert.equal((await call(admin, `/api/admin/orders/${mv.data.ref}`, { cookie: adm })).data.customer.note, 'Side door, ring twice');
assert.equal((await call(admin, '/api/admin/day?date=2027-01-28', { cookie: adm })).data.deliveries.find((o: any) => o.ref === mv.data.ref).customerNote, 'Side door, ring twice'); ok('team note on a customer shows on their orders and the driver page');

await call(admin, '/api/admin/products/radai', { cookie: adm, body: { stock: 5, available: true } });
const lowBefore = sent.length;
await order({ lines: [{ id: 'radai', opt: 'dallah', qty: 1 }] });
assert.ok(!sent.slice(lowBefore).some(m => /Running low/.test(m.subject)));
await order({ lines: [{ id: 'radai', opt: 'dallah', qty: 1 }] });
const lowMail = sent.slice(lowBefore).filter(m => /Running low/.test(m.subject));
assert.equal(lowMail.length, 1); assert.match(lowMail[0].subject, /3 left/);
await order({ lines: [{ id: 'radai', opt: 'dallah', qty: 1 }] });
assert.equal(sent.slice(lowBefore).filter(m => /Running low/.test(m.subject)).length, 1); ok('owners get one "running low" email when stock reaches 3');

const tBefore = sent.length;
await daily('2027-01-27');
const tm = sent.slice(tBefore).filter(m => /^Tomorrow: \d+ pickup/.test(m.subject));
assert.ok(tm.length >= 2); assert.ok(tm.some(m => m.to.includes('helper@hikayacoffee.ca')));
assert.ok(tm[0].html.includes('Side door, ring twice') && tm[0].html.includes('To pack')); ok("the team gets tomorrow's run sheet the evening before");
const tEmpty = sent.length; await daily('2027-02-02'); assert.ok(!sent.slice(tEmpty).some(m => /^Tomorrow: \d+ pickup/.test(m.subject))); ok('no email on a day without orders');

// ---------- drivers and the delivery app ----------
const invMails = sent.length;
assert.equal((await call(admin, '/api/admin/team', { cookie: helper, body: { email: 'dan@example.com', role: 'driver' } })).status, 403);
await call(admin, '/api/admin/team', { cookie: adm, body: { email: 'Dan@Example.com', name: 'Dan', role: 'driver' } });
const inv = sent.slice(invMails).find(m => m.to.includes('dan@example.com'));
assert.ok(inv && /\/admin\/driver\//.test(inv.text) && /Add to Home Screen/.test(inv.text)); ok('owners add a driver by email; the driver gets the link and the steps');
const dan = await login('dan@example.com');
assert.equal((await call(auth, '/api/me', { cookie: dan })).data.user.role, 'driver');
assert.equal((await call(admin, '/api/admin/orders', { cookie: dan })).status, 403); ok('a driver logs in with the email code and cannot open the order desk');
const dme = (await call(driverApi, '/api/driver/me', { cookie: dan })).data;
assert.equal(dme.needsOnboarding, true); assert.ok(dme.guide.points.length >= 5);
assert.equal((await call(driverApi, '/api/driver/stops', { cookie: dan })).data.error, 'onboarding');
assert.equal((await call(driverApi, '/api/driver/onboard', { cookie: dan, body: { name: 'Dan', phone: '403 555 0123' } })).status, 400);
const obMails = sent.length;
assert.equal((await call(driverApi, '/api/driver/onboard', { cookie: dan, body: { name: 'Dan Driver', phone: '403 555 0123', vehicle: 'Grey Corolla', agree: true, licence_expires: '2028-06-01', insurance_expires: '2028-06-01' } })).status, 200);
assert.ok(sent.slice(obMails).some(m => /has joined as a driver/.test(m.subject))); ok('onboarding: details and agreeing to the guide; the owners are told');

const dl1 = await order({ method: 'delivery', street: '1 Main St', postal: 'T2P1J9', day: '2027-01-30', payment: 'at-pickup', email: 'door1@example.com' });
const dl2 = await order({ method: 'delivery', street: '2 Main St', postal: 'T2P1J8', day: '2027-01-30', payment: 'e-transfer', email: 'door2@example.com' });
const dl3 = await order({ method: 'delivery', street: '3 Main St', postal: 'T3A0A1', day: '2027-01-30', email: 'door3@example.com' });
const t = (await call(admin, '/api/admin/team', { cookie: adm })).data;
assert.ok(t.drivers.some((d: any) => d.email === 'dan@example.com'));
assert.equal((await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [dl1.data.ref], driver: 'stranger@example.com' } })).status, 400);
assert.equal((await call(admin, '/api/admin/assign', { cookie: helper, body: { refs: [dl1.data.ref, dl2.data.ref], driver: 'dan@example.com' } })).data.assigned, 2); ok('owners or helpers assign deliveries to a driver');
const ds = (await call(driverApi, '/api/driver/stops?date=2027-01-30', { cookie: dan })).data.stops;
assert.deepEqual(ds.map((x: any) => x.ref).sort(), [dl1.data.ref, dl2.data.ref].sort()); ok('the driver sees only their own stops');
assert.equal((await call(driverApi, '/api/driver/delivered', { cookie: dan, body: { ref: dl3.data.ref } })).status, 404); ok("and can't touch anyone else's");
const stMails = sent.length;
assert.equal((await call(driverApi, '/api/driver/start?date=2027-01-30', { cookie: dan, body: {} })).data.started, 2);
assert.equal(sent.slice(stMails).filter(m => /is on its way/.test(m.subject)).length, 2); ok('Start route: both customers get "on its way" without the owners touching anything');
assert.equal((await call(driverApi, '/api/driver/delivered', { cookie: dan, body: { ref: dl1.data.ref, collected: 'cash' } })).data.error, 'photo'); ok('Delivered needs a photo first');
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const up: Response = await driverApi(new Request(`${H}/api/driver/photo?ref=${dl1.data.ref}`, { method: 'POST', headers: { 'content-type': 'image/jpeg', origin: H, cookie: dan }, body: jpeg }));
assert.equal(up.status, 201); const photoId = (await up.json()).id;
const pic: Response = await driverApi(new Request(`${H}/api/driver/photo/${photoId}`, { headers: { cookie: adm } }));
assert.equal(pic.headers.get('content-type'), 'image/jpeg');
assert.equal((await call(driverApi, '/api/driver/delivered', { cookie: dan, body: { ref: dl1.data.ref } })).data.error, 'collect'); ok('money due at the door: the driver must record cash or card');
const dvMails = sent.length;
assert.equal((await call(driverApi, '/api/driver/delivered', { cookie: dan, body: { ref: dl1.data.ref, collected: 'cash' } })).status, 200);
const r1d = (await pg.query(`SELECT status, payment_status, collected_method, delivered_by FROM orders WHERE ref = $1`, [dl1.data.ref])).rows[0] as any;
assert.equal(r1d.status, 'completed'); assert.equal(r1d.payment_status, 'paid'); assert.equal(r1d.collected_method, 'cash'); assert.equal(r1d.delivered_by, 'dan@example.com');
assert.ok(sent.slice(dvMails).some(m => /Thank you for order/.test(m.subject))); ok('Delivered: paid, completed, thank-you email sent');
const missMails = sent.length;
await call(driverApi, '/api/driver/missed', { cookie: dan, body: { ref: dl2.data.ref, why: 'Nobody home' } });
assert.ok(sent.slice(missMails).some(m => /Couldn't deliver/.test(m.subject))); ok("Couldn't deliver: the owners get an email right away");
const t2 = (await call(admin, '/api/admin/team', { cookie: adm })).data;
assert.equal(t2.cash[0].driver, 'dan@example.com'); assert.equal(t2.team.find((m: any) => m.email === 'dan@example.com').week, 1);
const handed = (await call(admin, '/api/admin/team/cash', { cookie: adm, body: { driver: 'dan@example.com' } })).data;
assert.equal(handed.orders, 1); assert.equal((await call(admin, '/api/admin/team', { cookie: adm })).data.cash.length, 0); ok('cash per driver to hand in, and deliveries counted per driver');
await call(admin, `/api/admin/team/${t2.team.find((m: any) => m.email === 'dan@example.com').id}`, { cookie: adm, body: { status: 'off' } });
assert.equal((await call(driverApi, '/api/driver/me', { cookie: dan })).status, 401); ok('turning a driver off logs them out');

// ---------- routes, mileage and reports ----------
await call(admin, '/api/admin/team', { cookie: adm, body: { email: 'eve@example.com', name: 'Eve', role: 'driver' } });
const eve = await login('eve@example.com');
await call(driverApi, '/api/driver/onboard', { cookie: eve, body: { name: 'Eve Driver', phone: '403 555 0124', agree: true, licence_expires: '2028-06-01', insurance_expires: '2028-06-01' } });
const ev1 = await order({ method: 'delivery', street: '10 A St', postal: 'T2P1J9', day: '2027-02-04', window: '11:00–14:00', email: 'e1@example.com' });
const ev2 = await order({ method: 'delivery', street: '20 B St', postal: 'T3A0A1', day: '2027-02-04', window: '11:00–14:00', email: 'e2@example.com', payment: 'at-pickup' });
const ev3 = await order({ method: 'delivery', street: '30 C St', postal: 'T2N0A1', day: '2027-02-04', window: '17:00–20:00', email: 'e3@example.com' });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [ev1.data.ref, ev2.data.ref, ev3.data.ref], driver: 'eve@example.com' } });
process.env.GOOGLE_MAPS_API_KEY = 'maps-test'; process.env.SHOP_ADDRESS = '1 Shop Rd, Calgary, AB';
const planCalls: any[] = []; const f1 = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any) => {
  if (String(url).startsWith('https://routes.googleapis.com/')) {
    const b = JSON.parse(init.body); planCalls.push(b);
    const n = b.intermediates.length, idx = [...Array(n).keys()].reverse(); // the planner says: reverse order is shortest
    return new Response(JSON.stringify({ routes: [{ optimizedIntermediateWaypointIndex: idx, legs: Array.from({ length: n + 1 }, () => ({ distanceMeters: 4000, duration: '600s' })) }] }), { status: 200 });
  }
  return f1(url, init);
}) as any;
assert.equal((await call(driverApi, '/api/driver/start?date=2027-02-04', { cookie: eve, body: { startOdometer: 'abc' } })).data.error, 'odometer');
const stEve = (await call(driverApi, '/api/driver/start?date=2027-02-04', { cookie: eve, body: { from: 'shop' } })).data;
assert.equal(stEve.started, 3); assert.equal(stEve.optimized, true);
assert.equal(planCalls.length, 2); assert.equal(planCalls[0].origin.address, '1 Shop Rd, Calgary, AB'); assert.equal(planCalls[0].optimizeWaypointOrder, true);
assert.equal(planCalls[1].origin.address, '10 A St, T2P 1J9, Calgary, AB'); ok('auto route: shortest order per time window, each window starting where the last ended');
assert.equal(planCalls[1].destination.address, '1 Shop Rd, Calgary, AB'); ok('the last window is planned to end at the shop, so the drive back is really to the shop');
assert.equal(stEve.km, 16); assert.equal(stEve.minutes, 40);
const evStops = (await call(driverApi, '/api/driver/stops?date=2027-02-04', { cookie: eve })).data.stops;
assert.deepEqual(evStops.map((x: any) => x.ref), [ev2.data.ref, ev1.data.ref, ev3.data.ref]); assert.equal(evStops[0].seq, 1); ok('stops shown in driving order, numbered');
const { publicOrder: pubO } = await import('../netlify/lib/orders');
const ahead = async (ref: string) => (await pubO((await pg.query(`SELECT * FROM orders WHERE ref = $1`, [ref])).rows[0])).stopsBefore;
assert.equal(await ahead(ev2.data.ref), 0); assert.equal(await ahead(ev3.data.ref), 2); assert.equal(await ahead(ev1.data.ref), 1); ok('customers see how many stops are before theirs');
let rt = (await call(driverApi, '/api/driver/route?date=2027-02-04', { cookie: eve })).data.route;
assert.equal(rt.next.ref, ev2.data.ref); assert.match(rt.next.url, /google\.com\/maps\/dir\/.*destination=20%20B%20St/); assert.equal(rt.kmSoFar, 0); ok('"Navigate to next stop" opens Google Maps to the next stop');
assert.equal((await call(driverApi, '/api/driver/start?date=2027-02-04', { cookie: eve, body: {} })).data.error, 'route-open');
const photo = async (ref: string) => driverApi(new Request(`${H}/api/driver/photo?ref=${ref}`, { method: 'POST', headers: { 'content-type': 'image/jpeg', origin: H, cookie: eve }, body: jpeg }));
await photo(ev2.data.ref); await call(driverApi, '/api/driver/delivered', { cookie: eve, body: { ref: ev2.data.ref, collected: 'card' } });
assert.equal(await ahead(ev3.data.ref), 1); assert.equal(await ahead(ev2.data.ref), null); ok('the count goes down as stops are delivered');
rt = (await call(driverApi, '/api/driver/route?date=2027-02-04', { cookie: eve })).data.route;
assert.equal(rt.next.ref, ev1.data.ref); assert.equal(rt.kmSoFar, 4); ok('after Delivered, the next stop moves on and the km count goes up');
await photo(ev1.data.ref); await call(driverApi, '/api/driver/delivered', { cookie: eve, body: { ref: ev1.data.ref } });
await call(driverApi, '/api/driver/missed', { cookie: eve, body: { ref: ev3.data.ref, why: 'Gate locked' } });
const endEve = (await call(driverApi, '/api/driver/end?date=2027-02-04', { cookie: eve, body: {} })).data;
assert.equal(endEve.km, 16); ok('mileage from the app: the legs driven plus the way back, no odometer needed');
const repEve = (await call(driverApi, '/api/driver/report?from=2027-02-01&to=2027-02-28', { cookie: eve })).data;
assert.equal(repEve.total.deliveries, 2); assert.equal(repEve.total.km, 16); assert.equal(repEve.total.card, (await pg.query(`SELECT total_cents FROM orders WHERE ref = $1`, [ev2.data.ref])).rows[0].total_cents); assert.ok(repEve.total.minutes >= 0);
assert.equal((await call(driverApi, `/api/driver/report?driver=dan@example.com&from=2027-01-01&to=2027-02-28`, { cookie: eve })).data.driver, 'eve@example.com'); ok("a driver's own report: deliveries, km, time, cash and card; they can't see anyone else's");
await call(admin, '/api/admin/pay', { cookie: adm, body: { perDelivery: 500, perKm: 50, perHour: 0 } });
assert.equal((await call(admin, '/api/admin/pay', { cookie: helper, body: { perDelivery: 9999 } })).status, 403);
const repPay = (await call(driverApi, '/api/driver/report?driver=eve@example.com&from=2027-02-01&to=2027-02-28', { cookie: adm })).data;
assert.equal(repPay.total.pay, 2 * 500 + 16 * 50); ok('owners set pay rates; the report estimates pay');
const csvRes: Response = await driverApi(new Request(`${H}/api/driver/report.csv?from=2027-02-01&to=2027-02-28`, { headers: { cookie: eve } }));
const csvMiles = await csvRes.text();
assert.match(csvMiles.split('\n')[0], /date,driver,start,end,start_odometer_km,end_odometer_km,km_driven,km_source/); assert.match(csvMiles, /2027-02-04,eve@example.com,.*,16,app \(planned route\)/); ok('mileage log CSV for taxes');
// odometer wins when given
const ev4 = await order({ method: 'delivery', street: '40 D St', postal: 'T2P1J9', day: '2027-02-05', email: 'e4@example.com' });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [ev4.data.ref], driver: 'eve@example.com' } });
await call(driverApi, '/api/driver/start?date=2027-02-05', { cookie: eve, body: { startOdometer: 84200 } });
assert.equal((await call(driverApi, '/api/driver/end?date=2027-02-05', { cookie: eve, body: { endOdometer: 84100 } })).data.error, 'odometer');
assert.equal((await call(driverApi, '/api/driver/end?date=2027-02-05', { cookie: eve, body: { endOdometer: 84231 } })).data.km, 31); ok('with odometer readings, the odometer km are used');
// Two routes on one day: a stop left over from the first and delivered in the second counts once, in the second.
const x1 = await order({ method: 'delivery', street: '70 G St', postal: 'T2P1J9', day: '2027-02-11', email: 'x1@example.com' });
const x2 = await order({ method: 'delivery', street: '80 H St', postal: 'T3A0A1', day: '2027-02-11', email: 'x2@example.com' });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [x1.data.ref, x2.data.ref], driver: 'eve@example.com' } });
await call(driverApi, '/api/driver/start?date=2027-02-11', { cookie: eve, body: {} });
await photo(x1.data.ref); await call(driverApi, '/api/driver/delivered', { cookie: eve, body: { ref: x1.data.ref } });
const r1km = (await call(driverApi, '/api/driver/end?date=2027-02-11', { cookie: eve, body: {} })).data.km;
await call(driverApi, '/api/driver/start?date=2027-02-11', { cookie: eve, body: {} });
await photo(x2.data.ref); await call(driverApi, '/api/driver/delivered', { cookie: eve, body: { ref: x2.data.ref } });
const r2km = (await call(driverApi, '/api/driver/end?date=2027-02-11', { cookie: eve, body: {} })).data.km;
const twoRoutes = (await call(driverApi, '/api/driver/report?from=2027-02-11&to=2027-02-11', { cookie: eve })).data;
assert.equal(r1km, 8); assert.equal(r2km, 8); assert.deepEqual(twoRoutes.routes.map((x: any) => x.km), [8, 8]); assert.equal(twoRoutes.total.km, 16); ok('a second route the same day: no leg is counted in both routes');
delete process.env.GOOGLE_MAPS_API_KEY; delete process.env.SHOP_ADDRESS; globalThis.fetch = f1;
const ev5 = await order({ method: 'delivery', street: '50 E St', postal: 'T3A0A1', day: '2027-02-06', email: 'e5@example.com' });
const ev6 = await order({ method: 'delivery', street: '60 F St', postal: 'T2P1J9', day: '2027-02-06', email: 'e6@example.com' });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [ev5.data.ref, ev6.data.ref], driver: 'eve@example.com' } });
const noMaps = (await call(driverApi, '/api/driver/start?date=2027-02-06', { cookie: eve, body: {} })).data;
assert.equal(noMaps.optimized, false); assert.equal(noMaps.km, null);
assert.deepEqual((await call(driverApi, '/api/driver/stops?date=2027-02-06', { cookie: eve })).data.stops.map((x: any) => x.ref), [ev6.data.ref, ev5.data.ref]); ok('without the Maps key: stops by time window and area, still works');
// A route starts only on its own day (raw request, no test clock: today is not 7 Feb 2027).
const ev7 = await order({ method: 'delivery', street: '70 G St', postal: 'T2P1J9', day: '2027-02-07', email: 'e7@example.com', payment: 'at-pickup' });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [ev7.data.ref], driver: 'eve@example.com' } });
const early = sent.length;
const notToday: Response = await driverApi(new Request(`${H}/api/driver/start?date=2027-02-07`, { method: 'POST', headers: { 'content-type': 'application/json', origin: H, cookie: eve }, body: '{}' }));
assert.equal(notToday.status, 409); assert.equal((await notToday.json()).error, 'not-today');
assert.ok(!sent.slice(early).some(m => m.subject?.includes(ev7.data.ref))); ok('a route for another day cannot be started (no "on its way" emails a day early)');
// A stop cancelled while the driver's screen was out of date can't be delivered or reported missed.
await photo(ev7.data.ref);
await call(admin, `/api/admin/orders/${ev7.data.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } });
const delC = await call(driverApi, '/api/driver/delivered', { cookie: eve, body: { ref: ev7.data.ref, collected: 'cash' } });
assert.equal(delC.status, 409); assert.equal(delC.data.error, 'cancelled');
const ev7Row = (await pg.query(`SELECT status, payment_status, collected_method FROM orders WHERE ref = $1`, [ev7.data.ref])).rows[0] as any;
assert.equal(ev7Row.status, 'cancelled'); assert.equal(ev7Row.payment_status, 'unpaid'); assert.equal(ev7Row.collected_method, null);
assert.equal((await call(driverApi, '/api/driver/missed', { cookie: eve, body: { ref: ev7.data.ref, why: 'x' } })).data.error, 'cancelled'); ok('a cancelled stop: Delivered and Missed are refused, no cash recorded');

// ---------- the team: packers, volunteers, papers, shifts, hours ----------
await call(admin, '/api/admin/team', { cookie: adm, body: { email: 'pat@example.com', name: 'Pat', role: 'packer', volunteer: true } });
const pat = await login('pat@example.com');
assert.equal((await call(auth, '/api/me', { cookie: pat })).data.user.role, 'packer');
assert.equal((await call(admin, '/api/admin/orders', { cookie: pat })).status, 403);
assert.equal((await call(driverApi, '/api/driver/me', { cookie: pat })).data.needsOnboarding, true);
await call(driverApi, '/api/driver/onboard', { cookie: pat, body: { name: 'Pat Packer', phone: '403 555 0130', agree: true, food_cert_expires: '2026-10-20' } });
assert.equal((await call(driverApi, '/api/driver/stops', { cookie: pat })).status, 403); ok('a volunteer packer onboards and gets the team app, not deliveries or the desk');
assert.equal((await call(driverApi, '/api/driver/report?driver=eve@example.com', { cookie: pat })).data.driver, 'pat@example.com'); ok("a packer cannot read a driver's pay report");
// The owners decided (4 Oct 2026): a packer can also drive. Then papers are needed, and only their own stops show.
await call(admin, '/api/admin/team', { cookie: adm, body: { email: 'pia@example.com', name: 'Pia', role: 'packer', drives: true } });
const pia = await login('pia@example.com');
assert.equal((await call(driverApi, '/api/driver/onboard', { cookie: pia, body: { name: 'Pia Packer', phone: '403 555 0131', agree: true } })).data.fields?.licence_expires, 'required');
assert.equal((await call(driverApi, '/api/driver/onboard', { cookie: pia, body: { name: 'Pia Packer', phone: '403 555 0131', agree: true, licence_expires: '2029-01-01', insurance_expires: '2029-01-01' } })).status, 200);
assert.ok((await call(admin, '/api/admin/team', { cookie: adm })).data.drivers.some((d: any) => d.email === 'pia@example.com'));
const pd1 = await order({ method: 'delivery', street: '5 Pia St', postal: 'T2P1J9', day: '2027-02-14', email: 'pd1@example.com' });
const pd2 = await order({ method: 'delivery', street: '6 Eve St', postal: 'T2P1J9', day: '2027-02-14', email: 'pd2@example.com' });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [pd1.data.ref], driver: 'pia@example.com' } });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [pd2.data.ref], driver: 'eve@example.com' } });
assert.deepEqual((await call(driverApi, '/api/driver/stops?date=2027-02-14', { cookie: pia })).data.stops.map((x: any) => x.ref), [pd1.data.ref]);
assert.equal((await call(driverApi, '/api/driver/start?date=2027-02-14', { cookie: pia, body: {} })).data.started, 1);
assert.equal((await call(driverApi, '/api/driver/delivered', { cookie: pia, body: { ref: pd2.data.ref } })).status, 404);
assert.equal((await call(driverApi, '/api/driver/pack?date=2027-02-14', { cookie: pia })).status, 200);
assert.equal((await call(driverApi, '/api/driver/stops?date=2027-02-14', { cookie: pat })).status, 403); ok('a packer who also drives: papers at sign-up, only their own stops, and still packs; other packers do not deliver');
const pk1 = await order({ day: '2027-02-11', email: 'pk1@example.com' });
const packList = (await call(driverApi, '/api/driver/pack?date=2027-02-11', { cookie: pat })).data.orders;
assert.ok(packList.some((o: any) => o.ref === pk1.data.ref));
assert.equal((await call(driverApi, '/api/driver/pack?date=2027-02-11', { cookie: eve })).status, 403);
const pkMails = sent.length;
await call(driverApi, '/api/driver/packed', { cookie: pat, body: { ref: pk1.data.ref } });
assert.equal((await pg.query(`SELECT status, packed_by FROM orders WHERE ref = $1`, [pk1.data.ref])).rows[0].packed_by, 'pat@example.com');
assert.ok(sent.slice(pkMails).some(m => m.subject === `Order ${pk1.data.ref} is ready for pickup`)); ok('packing list; "packed" makes a pickup order ready and emails the customer');

// shifts
assert.equal((await call(admin, '/api/admin/shifts', { cookie: adm, body: { day: '2027-02-11', starts: '12:00', ends: '09:00', kind: 'packing' } })).status, 400);
await call(admin, '/api/admin/shifts', { cookie: adm, body: { day: '2027-02-11', starts: '09:00', ends: '12:00', kind: 'packing', spots: 1, repeatWeeks: 1 } });
await call(admin, '/api/admin/shifts', { cookie: helper, body: { day: '2027-02-11', starts: '13:00', ends: '20:00', kind: 'driving', spots: 2 } });
const sh = (await call(admin, '/api/admin/shifts?from=2027-02-11', { cookie: adm })).data.shifts;
assert.equal(sh.length, 3); ok('owners and helpers post shifts, repeating weekly if they want');
const packShift = sh.find((x: any) => x.kind === 'packing' && x.day === '2027-02-11'), driveShift = sh.find((x: any) => x.kind === 'driving');
assert.equal((await call(driverApi, `/api/driver/shifts/${driveShift.id}/signup`, { cookie: pat, body: {} })).status, 403);
assert.equal((await call(driverApi, `/api/driver/shifts/${packShift.id}/signup`, { cookie: pat, body: {} })).status, 200);
assert.equal((await call(driverApi, `/api/driver/shifts/${packShift.id}/signup`, { cookie: helper, body: {} })).data.error, 'full'); ok('people sign up for shifts that fit their role; full shifts are closed');
assert.equal((await call(driverApi, `/api/driver/shifts/${driveShift.id}/signup`, { cookie: eve, body: {} })).status, 200);
const myShifts = (await call(driverApi, '/api/driver/shifts?from=2027-02-08', { cookie: pat })).data.shifts;
assert.equal(myShifts.find((x: any) => x.id === packShift.id).mine, true);
// papers: an expired licence stops driving
await pg.query(`UPDATE team_members SET licence_expires = '2027-01-01' WHERE email = 'eve@example.com'`);
assert.equal((await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [pk1.data.ref], driver: 'eve@example.com' } })).data.error, 'papers');
const papMails = sent.length;
await daily('2026-10-05');
assert.ok(sent.slice(papMails).some(m => /Expiring soon: food handler certificate \(Pat Packer\)/.test(m.subject)));
const papMails2 = sent.length; await daily('2026-10-06'); assert.ok(!sent.slice(papMails2).some(m => /Expir/.test(m.subject)));
const papMails3 = sent.length; await daily('2027-01-03');
assert.ok(sent.slice(papMails3).some(m => /Expired: driver's licence \(Eve Driver\)/.test(m.subject))); ok('papers: expired licence blocks deliveries; one reminder before things expire');
assert.ok(sent.slice(papMails3).some(m => /Expired: food handler certificate \(Pat Packer\)/.test(m.subject))); ok('after "expiring soon", an "expired" reminder still comes once the date passes');
const papMails4 = sent.length; await daily('2027-01-04'); assert.ok(!sent.slice(papMails4).some(m => /Pat Packer/.test(m.subject))); ok('and only once');
await pg.query(`UPDATE team_members SET licence_expires = '2028-06-01' WHERE email = 'eve@example.com'`);
// reminders and gaps the evening before
const shMails = sent.length;
await daily('2027-02-10');
const shSubj = sent.slice(shMails);
assert.ok(shSubj.some(m => m.to.includes('pat@example.com') && /Tomorrow: Packing 09:00–12:00/.test(m.subject)));
assert.ok(shSubj.some(m => /Tomorrow needs people/.test(m.subject) && /Driving 13:00–20:00: 1 of 2/.test(m.text))); ok('shift reminders the evening before; owners told about empty spots');
// assigning by the owners
await call(admin, `/api/admin/shifts/${driveShift.id}/assign`, { cookie: adm, body: { email: 'dan@example.com' } }).catch(() => null);
// hours: check in and out on the day (the team can correct times)
assert.equal((await call(driverApi, `/api/driver/shifts/${packShift.id}/in`, { cookie: pat, body: {} })).data.error, 'not-today');
// On the day (09:00–12:00 Calgary, UTC−7): not before 08:00; one check-out only.
setClock(() => new Date('2027-02-11T14:30:00Z'));
assert.equal((await call(driverApi, `/api/driver/shifts/${packShift.id}/in`, { cookie: pat, body: {} })).data.error, 'too-early');
setClock(() => new Date('2027-02-11T16:05:00Z')); await call(driverApi, `/api/driver/shifts/${packShift.id}/in`, { cookie: pat, body: {} });
setClock(() => new Date('2027-02-11T19:00:00Z')); await call(driverApi, `/api/driver/shifts/${packShift.id}/out`, { cookie: pat, body: {} });
const outAt = ((await pg.query(`SELECT checked_out_at FROM shift_people WHERE shift_id = $1 AND email = 'pat@example.com'`, [packShift.id])).rows[0] as any).checked_out_at;
setClock(() => new Date('2027-02-11T23:00:00Z')); await call(driverApi, `/api/driver/shifts/${packShift.id}/out`, { cookie: pat, body: {} });
setClock(null);
assert.equal(String(((await pg.query(`SELECT checked_out_at FROM shift_people WHERE shift_id = $1 AND email = 'pat@example.com'`, [packShift.id])).rows[0] as any).checked_out_at), String(outAt)); ok('shifts: no check-in more than an hour early; a second check-out does not add hours');
await call(admin, `/api/admin/shifts/${packShift.id}/times`, { cookie: adm, body: { email: 'pat@example.com', in: '2027-02-11T16:00:00Z', out: '2027-02-11T19:30:00Z' } });
const hrs = (await call(admin, '/api/admin/hours?from=2027-02-01&to=2027-02-28', { cookie: adm })).data;
const patH = hrs.people.find((p: any) => p.email === 'pat@example.com');
assert.equal(patH.minutes, 210); assert.equal(patH.volunteer, true);
const hcsv = String((await call(admin, '/api/admin/hours.csv?from=2027-02-01&to=2027-02-28', { cookie: adm })).data);
assert.match(hcsv, /2027-02-11,pat@example.com,packing,09:00–12:00,.*,3\.50/);
assert.equal((await call(driverApi, '/api/driver/hours?from=2027-02-01&to=2027-02-28', { cookie: pat })).data.people[0].minutes, 210); ok('hours from check-in/out (volunteer hours too), CSV for the owners, and each person sees their own');

// ---------- capacity caps ----------
await call(admin, '/api/admin/settings', { cookie: adm, body: { caps: { dailyOrders: 3, giftBoxesPerDay: 1, stopsPerDriver: 2, deliveryFromShifts: true } } });
const capDay = '2027-02-12';
const slotsCap = (await call(orders, '/api/slots')).data.days.find((d: any) => d.date === capDay);
assert.equal(slotsCap.windows[0].delivery, 0); ok('no driver on shift: no delivery places that day');
await call(admin, '/api/admin/shifts', { cookie: adm, body: { day: capDay, starts: '11:00', ends: '14:00', kind: 'driving', spots: 1 } });
const capShift = (await call(admin, `/api/admin/shifts?from=${capDay}`, { cookie: adm })).data.shifts.find((x: any) => x.day === capDay);
await call(driverApi, `/api/driver/shifts/${capShift.id}/signup`, { cookie: eve, body: {} });
const slotsCap2 = (await call(orders, '/api/slots')).data.days.find((d: any) => d.date === capDay);
assert.equal(slotsCap2.windows[0].delivery, 2); assert.equal(slotsCap2.windows[1].delivery, 0); ok('one driver on the 11–2 shift: 2 delivery places in that window only');
assert.equal((await order({ day: capDay, lines: [{ id: 'guest-box', qty: 2 }] })).data.error, 'day-limit');
assert.equal((await order({ day: capDay, lines: [{ id: 'guest-box', qty: 1 }] })).status, 201);
assert.equal((await order({ day: capDay, lines: [{ id: 'coffee-duo', qty: 1 }] })).data.error, 'day-limit'); ok('gift boxes per day (packing time) are limited');
await call(admin, '/api/admin/products/najdi', { cookie: adm, body: { daily_cap: 1 } });
assert.equal((await order({ day: capDay, lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] })).data.error, 'day-limit');
assert.equal((await order({ day: capDay, lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] })).status, 201); ok('a product can have its own daily limit');
await call(admin, '/api/admin/products/najdi', { cookie: adm, body: { daily_cap: null } });
assert.equal((await order({ day: capDay, lines: [{ id: 'radai', opt: 'dallah', qty: 1 }] })).status, 201);
assert.equal((await order({ day: capDay })).data.error, 'slot-full'); ok('orders per day are limited');
await call(admin, '/api/admin/settings', { cookie: adm, body: { caps: { dailyOrders: null, giftBoxesPerDay: null, stopsPerDriver: null, deliveryFromShifts: false } } });

// ---------- lots, recall, supplies ----------
assert.equal((await call(admin, '/api/admin/lots', { cookie: adm, body: { item_kind: 'coffee', item_id: 'nope' } })).status, 400);
const lot1 = (await call(admin, '/api/admin/lots', { cookie: adm, body: { item_kind: 'coffee', item_id: 'gulf', made_on: '2027-02-01', best_before: '2027-08-01', quantity: '10 kg' } })).data.code;
const lot2 = (await call(admin, '/api/admin/lots', { cookie: helper, body: { item_kind: 'dates', item_id: 'khalas', made_on: '2027-02-01' } })).data.code;
assert.equal(lot1, 'GULF-270201-1'); assert.equal(lot2, 'KHALAS-270201-1'); ok('production lots get a code (product, date, number)');
const lo1 = await order({ day: '2027-02-13', lines: [{ id: 'guest-box', qty: 1 }], email: 'lot1@example.com' });
const lo2 = await order({ day: '2027-02-13', lines: [{ id: 'jubani', opt: 'dallah', qty: 1 }], email: 'lot2@example.com' }).catch(() => null);
const dayLots = (await call(admin, '/api/admin/day?date=2027-02-13', { cookie: adm })).data;
const lotOrder = dayLots.pickups.flatMap((w: any) => w.orders).find((o: any) => o.ref === lo1.data.ref);
assert.deepEqual(lotOrder.lots.sort(), [lot2, lot1].sort()); ok('packing slips show the lots in each order (coffee inside gift boxes too)');
const rcl = (await call(admin, `/api/admin/recall?code=${lot1}`, { cookie: adm })).data;
assert.ok(rcl.orders.some((o: any) => o.ref === lo1.data.ref)); assert.ok(!rcl.orders.some((o: any) => o.email === 'lot2@example.com'));
assert.match(String((await call(admin, `/api/admin/recall.csv?code=${lot1}`, { cookie: adm })).data), /lot1@example.com/); ok('recall: every order that may have had the lot, with contacts, as a CSV');
await call(admin, `/api/admin/lots/${lot1}/used`, { cookie: adm, body: { on: '2027-02-05' } });
assert.ok(!(await call(admin, `/api/admin/recall?code=${lot1}`, { cookie: adm })).data.orders.some((o: any) => o.ref === lo1.data.ref)); ok('a lot used up stops counting after that day');
await call(admin, '/api/admin/supplies/boxC12', { cookie: adm, body: { onHand: 0, lowAt: 5 } });
const sup = (await call(admin, '/api/admin/supplies?from=2027-02-11', { cookie: adm })).data.supplies.find((x: any) => x.key === 'boxC12');
assert.ok(sup.needThisWeek >= 1); assert.equal(sup.short, sup.needThisWeek); assert.equal(sup.low, true);
assert.equal((await call(admin, '/api/admin/supplies/boxC12', { cookie: adm, body: { onHand: -3 } })).status, 400); ok("supplies on hand against the week's needs, with low warnings");

// ---------- owners and managers who also drive ----------
await call(admin, '/api/admin/team', { cookie: adm, body: { email: 'maryam@hikayacoffee.ca', name: 'Maryam', role: 'helper', drives: true } });
await call(admin, '/api/admin/team', { cookie: adm, body: { email: 'ahmed@example.com', name: 'Ahmed', role: 'helper', drives: true } });
const ahmed = await login('ahmed@example.com');
assert.equal((await call(auth, '/api/me', { cookie: ahmed })).data.user.role, 'staff');
assert.equal((await call(auth, '/api/me', { cookie: adm })).data.user.role, 'admin'); ok('a manager who drives keeps the desk; an owner who drives stays an owner');
const dl = (await call(admin, '/api/admin/team', { cookie: adm })).data.drivers.map((d: any) => d.email);
assert.ok(dl.includes('ahmed@example.com') && dl.includes('maryam@hikayacoffee.ca'));
const ao = await order({ method: 'delivery', street: '7 Ahmed Way', postal: 'T2P1J9', day: '2027-02-18', email: 'ao@example.com' });
assert.equal((await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [ao.data.ref], driver: 'ahmed@example.com' } })).data.error, 'papers');
assert.equal((await call(driverApi, '/api/driver/me', { cookie: ahmed })).data.needsOnboarding, true);
await call(driverApi, '/api/driver/onboard', { cookie: ahmed, body: { name: 'Ahmed', phone: '403 555 0140', agree: true, licence_expires: '2029-01-01', insurance_expires: '2028-01-01' } });
assert.equal((await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [ao.data.ref], driver: 'ahmed@example.com' } })).data.assigned, 1);
assert.equal((await call(driverApi, '/api/driver/stops?date=2027-02-18&mine=1', { cookie: ahmed })).data.stops[0].ref, ao.data.ref); ok('"also drives": they get deliveries once their licence and insurance are in');

// ---------- shared team login: pick who is working ----------
await call(admin, '/api/admin/team', { cookie: adm, body: { shared: true, name: 'Shadi', email: 'shadi@example.com', role: 'helper' } });
await call(admin, '/api/admin/team', { cookie: adm, body: { shared: true, name: 'Maryam S', email: 'maryam.s@example.com', role: 'helper', drives: true } });
assert.equal((await call(admin, '/api/admin/team', { cookie: adm, body: { shared: true, name: 'Nobody' } })).status, 400);
const meShared = (await call(auth, '/api/me', { cookie: adm })).data;
assert.deepEqual(meShared.people.map((p: any) => p.name).sort(), ['Maryam S', 'Shadi']); ok('people on the shared login are listed after logging in');
const maryamS = meShared.people.find((p: any) => p.name === 'Maryam S');
const asStart = await call(auth, '/api/auth/as', { cookie: adm, body: { id: maryamS.id } });
assert.equal(asStart.data.sent, true); assert.match(asStart.data.to, /^ma…@example\.com$/);
const asCode = sent.at(-1); assert.deepEqual(asCode.to, ['maryam.s@example.com']); const theCode = asCode.text.match(/\b\d{6}\b/)[0];
const wrong: Response = await auth(new Request(`${H}/api/auth/as/verify`, { method: 'POST', headers: { 'content-type': 'application/json', origin: H, cookie: adm }, body: JSON.stringify({ id: maryamS.id, code: '000000' }) }));
assert.equal(wrong.status, 400); assert.equal(wrong.headers.get('set-cookie'), null); ok('picking a name sends a code to that person\'s own email; a wrong code gets nothing');
const asRes: Response = await auth(new Request(`${H}/api/auth/as/verify`, { method: 'POST', headers: { 'content-type': 'application/json', origin: H, cookie: adm }, body: JSON.stringify({ id: maryamS.id, code: theCode }) }));
const asCk = asRes.headers.get('set-cookie')!.split(';')[0];
const admAs = `${adm}; ${asCk}`;
const meAs = (await call(auth, '/api/me', { cookie: admAs })).data.user;
assert.equal(meAs.as.name, 'Maryam S'); assert.equal(meAs.role, 'staff'); assert.equal(meAs.login, 'maryam@hikayacoffee.ca'); ok('"Who\'s working?": confirmed with the code, the person acts with their own role (a helper is a helper)');
assert.equal((await call(admin, '/api/admin/giftcards', { cookie: admAs })).status, 403); assert.equal((await call(admin, '/api/admin/giftcards', { cookie: adm })).status, 200);
const adminsWas = process.env.ADMIN_EMAILS; process.env.ADMIN_EMAILS = `${adminsWas},maryam.s@example.com`;
assert.equal((await call(auth, '/api/me', { cookie: admAs })).data.user.role, 'admin'); process.env.ADMIN_EMAILS = adminsWas; ok('a helper picked on the owners\' login gets no owner rights (gift cards, refunds, settings)');
assert.equal((await call(auth, '/api/me', { cookie: `${adm}; hk_as=forged-token` })).data.user.as, undefined); ok('a made-up token does nothing');
const bad = await call(auth, '/api/auth/as', { cookie: ahmed, body: { id: maryamS.id } });
assert.equal(bad.status, 404); ok("nobody can pick a person from another login");
const handle = meAs.email;
assert.equal(handle, 'maryam.s@example.com');
await call(driverApi, '/api/driver/onboard', { cookie: admAs, body: { name: 'Maryam S', phone: '403 555 0150', agree: true, licence_expires: '2029-01-01', insurance_expires: '2029-01-01' } });
const so = await order({ method: 'delivery', street: '8 Shared St', postal: 'T2P1J9', day: '2027-02-19', email: 'so@example.com' });
assert.equal((await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [so.data.ref], driver: handle } })).data.assigned, 1);
assert.equal((await call(driverApi, '/api/driver/stops?date=2027-02-19&mine=1', { cookie: admAs })).data.stops[0].ref, so.data.ref);
assert.equal((await call(driverApi, '/api/driver/stops?date=2027-02-19&mine=1', { cookie: adm })).data.stops.length, 0); ok('deliveries go to the picked person, not to everyone on the login');
await call(admin, '/api/admin/shifts', { cookie: adm, body: { day: '2027-02-19', starts: '13:00', ends: '17:00', kind: 'driving', spots: 1 } });
const shShared = (await call(admin, '/api/admin/shifts?from=2027-02-19', { cookie: adm })).data.shifts.find((x: any) => x.day === '2027-02-19');
await call(driverApi, `/api/driver/shifts/${shShared.id}/signup`, { cookie: admAs, body: {} });
const shM = sent.length; await daily('2027-02-18');
const forMaryam = sent.slice(shM).find(m => /^Tomorrow: Driving/.test(m.subject) && m.to.includes('maryam.s@example.com'));
assert.ok(forMaryam); ok('their reminders go to their own email');
const actor = (await pg.query(`SELECT actor FROM order_events e JOIN orders o ON o.id = e.order_id WHERE o.ref = $1 AND kind = 'driver'`, [so.data.ref])).rows[0] as any;
assert.equal(actor.actor, 'maryam@hikayacoffee.ca');
await call(admin, `/api/admin/orders/${so.data.ref}`, { cookie: admAs, body: { note: 'Called ahead' } });
const evs = (await call(admin, `/api/admin/orders/${so.data.ref}`, { cookie: adm })).data.events;
assert.ok(evs.some((e: any) => e.actor === 'Maryam S' && e.detail === 'Called ahead')); ok('what they do in the desk is credited to their name');

// ---------- editing an order ----------
const ed = await order({ email: 'edit@example.com', day: '2027-02-25', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
const edMails = sent.length;
const edR = await call(admin, `/api/admin/orders/${ed.data.ref}/items`, { cookie: helper, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }, { id: 'radai', opt: 'dallah', qty: 1 }] } });
assert.equal(edR.status, 200);
const edRow = (await pg.query(`SELECT subtotal_cents, total_cents FROM orders WHERE ref = $1`, [ed.data.ref])).rows[0] as any;
const edItems = (await pg.query(`SELECT product_id, qty FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.ref = $1 ORDER BY product_id`, [ed.data.ref])).rows as any[];
assert.equal(edItems.length, 2); assert.equal(edRow.subtotal_cents, 2 * 2600 + 2600);
assert.ok(sent.slice(edMails).some(m => m.subject === `Order ${ed.data.ref} was updated`)); ok('the team changes what is in an order; new total, and the customer is emailed');
assert.equal((await call(admin, `/api/admin/orders/${ed.data.ref}/items`, { cookie: adm, body: { lines: [] } })).status, 400);
await call(admin, `/api/admin/orders/${ed.data.ref}`, { cookie: adm, body: { paymentStatus: 'paid' } });
const edUp = (await call(admin, `/api/admin/orders/${ed.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 3 }, { id: 'radai', opt: 'dallah', qty: 1 }] } })).data;
assert.equal(edUp.balance, 2600); assert.equal((await pg.query(`SELECT payment_status FROM orders WHERE ref = $1`, [ed.data.ref])).rows[0].payment_status, 'unpaid'); ok('a paid order made bigger shows what is still to pay');
await call(admin, `/api/admin/orders/${ed.data.ref}`, { cookie: adm, body: { status: 'ready', notify: false } });
assert.equal((await call(admin, `/api/admin/orders/${ed.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] } })).data.error, 'cannot-edit'); ok('not once it is packed');
// A product whose price was cleared: a line already in the order keeps its price; it can't be added
// to a real order; a sample order takes the $20 stand-in so the team can rehearse.
const hadramiPrice = (await call(admin, '/api/admin/products', { cookie: adm })).data.products.find((p: any) => p.id === 'hadrami').price_cents;
const np1 = await order({ day: '2027-02-25', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }, { id: 'hadrami', opt: 'dallah', qty: 1 }] });
const np2 = await order({ day: '2027-02-25' });
await call(admin, '/api/admin/products/hadrami', { cookie: adm, body: { price_cents: null } });
const items = (path: string, lines: any[]) => call(admin, `/api/admin/orders/${path}/items`, { cookie: adm, body: { lines, notify: false } });
assert.equal((await items(np1.data.ref, [{ id: 'najdi', opt: 'dallah', qty: 2 }, { id: 'hadrami', opt: 'dallah', qty: 1 }])).status, 200);
assert.equal(((await pg.query(`SELECT unit_cents FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.ref = $1 AND product_id = 'hadrami'`, [np1.data.ref])).rows[0] as any).unit_cents, hadramiPrice);
assert.equal((await items(np2.data.ref, [{ id: 'najdi', opt: 'dallah', qty: 1 }, { id: 'hadrami', opt: 'dallah', qty: 1 }])).data.error, 'no-price');
await call(admin, `/api/admin/orders/${np2.data.ref}`, { cookie: adm, body: { sample: true } });
assert.equal((await items(np2.data.ref, [{ id: 'najdi', opt: 'dallah', qty: 1 }, { id: 'hadrami', opt: 'dallah', qty: 1 }])).status, 200);
assert.equal(((await pg.query(`SELECT unit_cents FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.ref = $1 AND product_id = 'hadrami'`, [np2.data.ref])).rows[0] as any).unit_cents, 2000);
await call(admin, '/api/admin/products/hadrami', { cookie: adm, body: { price_cents: hadramiPrice } });
ok('editing an order: a line without a price today keeps its price; sample orders use the $20 stand-in');

// ---------- "you're next" ----------
await pg.query(`UPDATE team_members SET status = 'active' WHERE email = 'dan@example.com'`);
const dan2 = await login('dan@example.com');
const nx1 = await order({ method: 'delivery', street: '1 Next St', postal: 'T2P1J9', day: '2027-02-26', email: 'next1@example.com' });
const nx2 = await order({ method: 'delivery', street: '2 Next St', postal: 'T2P1J8', day: '2027-02-26', email: 'next2@example.com', sms: true });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [nx1.data.ref, nx2.data.ref], driver: 'dan@example.com' } });
process.env.TWILIO_ACCOUNT_SID = 'AC1'; process.env.TWILIO_AUTH_TOKEN = 'tok'; process.env.TWILIO_FROM = '+15875550000';
const nxTexts: any[] = []; const fN = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any) => { if (String(url).includes('api.twilio.com')) { nxTexts.push(Object.fromEntries(new URLSearchParams(init.body))); return new Response('{}', { status: 201 }); } return fN(url, init); }) as any;
const nxM = sent.length;
await call(driverApi, '/api/driver/start?date=2027-02-26', { cookie: dan2, body: {} });
const firstNext = sent.slice(nxM).filter(m => /^You're next/.test(m.subject));
assert.equal(firstNext.length, 1); assert.ok(firstNext[0].to.includes('next2@example.com') || firstNext[0].to.includes('next1@example.com'));
const firstRef = firstNext[0].subject.match(/HK-\w+/)[0], secondRef = firstRef === nx1.data.ref ? nx2.data.ref : nx1.data.ref;
await driverApi(new Request(`${H}/api/driver/photo?ref=${firstRef}`, { method: 'POST', headers: { 'content-type': 'image/jpeg', origin: H, cookie: dan2 }, body: jpeg }));
await call(driverApi, '/api/driver/delivered', { cookie: dan2, body: { ref: firstRef } });
const secondNext = sent.slice(nxM).filter(m => /^You're next/.test(m.subject));
assert.equal(secondNext.length, 2); assert.ok(secondNext[1].subject.includes(secondRef));
assert.equal(nxTexts.filter(t => /you're next/i.test(t.Body)).length, 1); ok('"you\'re next": each customer is told when the driver is on the way to them (and texted if they asked)');
globalThis.fetch = fN; delete process.env.TWILIO_ACCOUNT_SID;

// ---------- letters to the mailing list ----------
await call(orders, '/api/list', { body: { email: 'reader@example.com', lang: 'ar', consent: true } });
const rdLink = new URL(sent.at(-1).html.match(/https:\/\/hikaya\.test\/api\/list\/confirm\?t=[\w-]+/)[0]); await orders(new Request(rdLink.href));
assert.equal((await call(admin, '/api/admin/letters', { cookie: adm, body: { subject_en: 'Ramadan', body_en: 'Hi' } })).status, 400);
const lt = (await call(admin, '/api/admin/letters', { cookie: adm, body: { subject_en: 'Ramadan pre-orders are open', subject_ar: 'الطلب المسبق لرمضان مفتوح', body_en: 'Order by **Tuesday**.\n\nhttps://hikayacoffee.ca/en/ramadan/', body_ar: 'اطلبوا قبل **الثلاثاء**.' } })).data;
assert.equal((await call(admin, `/api/admin/letters/${lt.id}/send`, { cookie: helper, body: {} })).status, 403);
const ltM = sent.length;
await call(admin, `/api/admin/letters/${lt.id}/test`, { cookie: adm, body: {} });
assert.equal(sent.slice(ltM).filter(m => /^\[Test\]/.test(m.subject)).length, 2); ok('letters: written in English and Arabic, with a test copy first');
const noAddr = await call(admin, `/api/admin/letters/${lt.id}/send`, { cookie: adm, body: {} });
assert.equal(noAddr.status, 400); assert.equal(noAddr.data.error, 'address'); ok('a letter cannot go out without a mailing address');
await call(admin, '/api/admin/business', { cookie: adm, body: { MAILING_ADDRESS: 'PO Box 123, Calgary, AB T2P 2M5' } });
// 120 more readers, so the letter goes out in two batches of up to 100; the second batch fails.
for (let i = 0; i < 120; i++) await pg.query(`INSERT INTO subscribers (email, lang, source, consent_text, unsub_token, confirmed_at) VALUES ($1, 'en', 'footer', 'x', $2, NOW())`, [`bulk${i}@example.com`, `bulk-token-${i}`]);
const batches: any[] = []; const fL = globalThis.fetch; let failNext = 1;
globalThis.fetch = (async (url: string, init: any) => {
  if (String(url).includes('/emails/batch')) { const b = JSON.parse(init.body); if (batches.length === failNext) { failNext = -1; return new Response('boom', { status: 500 }); } batches.push(b); return new Response('[]', { status: 200 }); }
  return fL(url, init);
}) as any;
const ltSend = (await call(admin, `/api/admin/letters/${lt.id}/send`, { cookie: adm, body: {} })).data;
const firstReached = batches.flat().length;
assert.equal(ltSend.status, 'partial'); assert.equal(ltSend.sent, firstReached); assert.ok(ltSend.of > firstReached);
assert.equal(((await pg.query('SELECT status FROM letters WHERE id = $1', [lt.id])).rows[0] as any).status, 'partial'); ok('a letter that partly failed is marked partly sent, not sent');
const again = (await call(admin, `/api/admin/letters/${lt.id}/send`, { cookie: adm, body: {} })).data;
globalThis.fetch = fL;
const secondTo = batches.slice(1).flat().map((m: any) => m.to[0]);
assert.equal(again.status, 'sent'); assert.equal(again.of, ltSend.of - firstReached); assert.equal(secondTo.length, again.of);
assert.ok(!secondTo.some((e: string) => batches[0].some((m: any) => m.to[0] === e))); ok('"Send to the ones that failed" reaches only the people who missed it');
const toReader = batches.flat().find((m: any) => m.to[0] === 'reader@example.com');
assert.equal(toReader.subject, 'الطلب المسبق لرمضان مفتوح'); assert.match(toReader.html, /<b>الثلاثاء<\/b>/); assert.match(toReader.headers['List-Unsubscribe'], /unsubscribe\?t=/);
assert.ok(toReader.html.includes('PO Box 123, Calgary, AB T2P 2M5') && toReader.text.includes('PO Box 123, Calgary, AB T2P 2M5') && toReader.text.includes('حكاية')); ok('every letter carries the mailing address');
assert.ok(!batches.flat().some((m: any) => m.to[0] === 'news@example.com')); ok('sent only to confirmed subscribers, each in their language, with one-click unsubscribe');
await pg.query(`DELETE FROM subscribers WHERE email LIKE 'bulk%@example.com'`);
assert.equal((await call(admin, `/api/admin/letters/${lt.id}/send`, { cookie: adm, body: {} })).data.error, 'sent'); ok('a letter can only be sent once');
await call(admin, '/api/admin/business', { cookie: adm, body: { MAILING_ADDRESS: '' } });

// ---------- food safety checklists, announcements, backup, activity ----------
const ckl = (await call(driverApi, '/api/driver/checklists', { cookie: pat })).data;
const beforeList = ckl.checklists.find((c: any) => c.key === 'before-packing');
assert.ok(beforeList.items.some((i: string) => /\(°C\)$/.test(i)));
assert.equal((await call(driverApi, '/api/driver/checklists', { cookie: pat, body: { key: 'before-packing', answers: beforeList.items.map(() => ({ done: true })) } })).data.error, 'number');
await call(driverApi, '/api/driver/checklists', { cookie: pat, body: { key: 'before-packing', answers: beforeList.items.map((i: string) => ({ done: true, value: /°C/.test(i) ? 3.5 : undefined })) } });
const clog = (await call(admin, '/api/admin/checklists', { cookie: adm })).data.log;
assert.equal(clog[0].by, 'Pat Packer'); assert.equal(clog[0].answers.find((a: any) => a.value !== null).value, 3.5); ok('food-safety checklists signed in the team app, with temperatures, kept as a log');
await call(admin, '/api/admin/checklists', { cookie: adm, body: { checklists: [{ key: 'open', name: 'Opening', items: ['Hands washed'] }] } });
assert.equal((await call(driverApi, '/api/driver/checklists', { cookie: pat })).data.checklists[0].name, 'Opening'); ok('owners edit the checklists');
const anM = sent.length;
await call(admin, '/api/admin/announce', { cookie: adm, body: { body: 'Eid week: everyone in at 8.', email: true } });
assert.ok(sent.slice(anM).some(m => m.to.includes('pat@example.com') && /message from the owners/.test(m.subject)));
assert.equal((await call(driverApi, '/api/driver/announcements', { cookie: pat })).data.announcements[0].body, 'Eid week: everyone in at 8.'); ok('announcements: in the team app and by email');
assert.equal((await call(admin, '/api/admin/backup.json', { cookie: helper })).status, 403);
const bk: Response = await admin(new Request(`${H}/api/admin/backup.json`, { headers: { cookie: adm } }));
const bkj = await bk.json();
assert.ok(bkj.tables.orders.length > 10 && bkj.tables.customers.length > 5); assert.equal(bkj.tables.sessions, undefined); assert.equal(bkj.tables.auth_codes, undefined);
assert.ok(bkj.tables.delivery_photos.every((r: any) => !('data' in r))); ok('backup: every table as one download, without login codes or sessions');
const act = (await call(admin, '/api/admin/activity', { cookie: adm })).data.activity;
assert.ok(act.some((a: any) => a.action === 'POST announce' && /Eid week/.test(a.detail))); assert.ok(act.some((a: any) => a.action.startsWith('POST products/'))); assert.equal((await call(admin, '/api/admin/activity', { cookie: helper })).status, 403); ok('activity log: who changed what in the desk');

// ---------- business details from the desk ----------
assert.equal((await call(admin, '/api/admin/business', { cookie: helper, body: { PICKUP_ADDRESS: 'x' } })).status, 403);
assert.equal((await call(admin, '/api/admin/business', { cookie: adm, body: { ETRANSFER_EMAIL: 'not-an-email' } })).status, 400);
await call(admin, '/api/admin/business', { cookie: adm, body: { PICKUP_ADDRESS: '12 Test Ave SW, Calgary, AB T2P 1J9', PICKUP_HOURS: 'Thu–Sun 11:00–20:00', ETRANSFER_EMAIL: 'Pay@HikayaCoffee.ca', OWNER_EMAILS: 'shadi.owner@example.com' } });
const biz = (await call(orders, '/api/catalog')).data.business;
assert.equal(biz.address, '12 Test Ave SW, Calgary, AB T2P 1J9'); ok('owners set the pickup address and other details in the desk; the site gets them');
const bzM = sent.length;
const bzO = await order({ payment: 'e-transfer', email: 'biz@example.com', day: '2027-03-05' }); if (bzO.status !== 201) console.log('bzO', bzO.data);
const bzMail = sent.slice(bzM).find(m => m.to.includes('biz@example.com'));
assert.match(bzMail.html, /Pickup at 12 Test Ave SW, Calgary, AB T2P 1J9 · Thu–Sun 11:00–20:00/); assert.match(bzMail.html, /pay@hikayacoffee\.ca/); ok('emails use the address, hours and e-Transfer email from the desk');
const shadiOwner = await login('shadi.owner@example.com');
assert.equal((await call(auth, '/api/me', { cookie: shadiOwner })).data.user.role, 'admin'); ok('an owner added in the desk is an owner');
let seenCtx: any = null; ask.setCreate(async (p: any) => { seenCtx = p; return { id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }], usage: {} } as any; });
await call(help, '/api/ask', { body: { text: 'Where do I pick up?', lang: 'en' } });
assert.ok(seenCtx.system[1].text.includes('12 Test Ave SW')); ok('Ask Hikaya knows the address once it is set');
await call(admin, '/api/admin/business', { cookie: adm, body: { PICKUP_ADDRESS: '', PICKUP_HOURS: '', ETRANSFER_EMAIL: '', OWNER_EMAILS: '' } });
assert.equal((await call(auth, '/api/me', { cookie: shadiOwner })).data.user.role, 'customer'); ok('removing an owner takes effect at once');

// ---------- costs and margins ----------
assert.equal((await call(admin, '/api/admin/costs/najdi', { cookie: helper, body: { cost_cents: 900 } })).status, 403);
assert.equal((await call(admin, '/api/admin/margins?from=2027-03-01&to=2027-03-31', { cookie: helper })).status, 403);
assert.equal((await call(admin, '/api/admin/costs/najdi', { cookie: adm, body: { cost_cents: -5 } })).status, 400);
const catBefore = JSON.stringify((await call(orders, '/api/catalog')).data.products);
await call(admin, '/api/admin/costs/najdi', { cookie: adm, body: { cost_cents: 900 } });
const costs = (await call(admin, '/api/admin/costs', { cookie: adm })).data.costs;
assert.equal(costs.find((c: any) => c.id === 'najdi').cost_cents, 900); assert.equal(costs.find((c: any) => c.id === 'hijazi').cost_cents, null);
await call(admin, '/api/admin/costs/radai', { cookie: adm, body: { cost_cents: 500 } }); await call(admin, '/api/admin/costs/radai', { cookie: adm, body: { cost_cents: null } });
assert.equal(JSON.stringify((await call(orders, '/api/catalog')).data.products), catBefore); ok('owners enter what each product costs; the shop is not changed by it');
const mgO = await order({ day: '2027-03-12', lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }, { id: 'qassimi', opt: 'dallah', qty: 1 }] }); if (mgO.status !== 201) console.log('mgO', mgO.data);
const mg = (await call(admin, '/api/admin/margins?from=2027-03-12&to=2027-03-12', { cookie: adm })).data;
const mgN = mg.rows.find((r: any) => r.product_id === 'najdi');
assert.equal(mgN.qty, 2); assert.equal(mgN.cost, 1800); assert.equal(mgN.margin, mgN.sales - 1800);
assert.deepEqual(mg.missing, ['Qassimi']); assert.equal(mg.totals.cost, 1800);
assert.equal(mg.totals.left, mg.totals.sales - mg.totals.discounts - mg.totals.refunds - 1800); ok('margins per product and in total for a range of days; products without a cost are flagged');
assert.equal((await call(admin, '/api/admin/margins?from=2027-03-12&to=2027-03-01', { cookie: adm })).status, 400);

// ---------- gift cards sold in person ----------
assert.equal((await call(admin, '/api/admin/giftcards/sell', { cookie: helper, body: { amount_cents: 4000, payment: 'cash' } })).status, 403);
assert.equal((await call(admin, '/api/admin/giftcards/sell', { cookie: adm, body: { amount_cents: 200, payment: 'cash' } })).status, 400);
assert.equal((await call(admin, '/api/admin/giftcards/sell', { cookie: adm, body: { amount_cents: 4000, payment: 'bitcoin' } })).status, 400);
assert.equal((await call(admin, '/api/admin/giftcards/sell', { cookie: adm, body: { amount_cents: 4000, payment: 'cash', to_email: 'friend@example.com' } })).status, 400);
const gsM = sent.length;
const gs1 = (await call(admin, '/api/admin/giftcards/sell', { cookie: adm, body: { amount_cents: 4000, payment: 'cash' } })).data;
assert.ok(gs1.code && gs1.sentTo === null); assert.equal(sent.length, gsM);
assert.equal((await call(orders, '/api/giftcard/check', { body: { code: gs1.code } })).data.balance, 4000); ok('a gift card sold for cash at a market works at once; no email needed, the code is shown to print');
const gs2 = (await call(admin, '/api/admin/giftcards/sell', { cookie: adm, body: { amount_cents: 3500, payment: 'card-here', to_name: 'Noura', to_email: 'noura@example.com', buyer_name: 'Sami', message: 'Eid mubarak', lang: 'ar' } })).data;
const gsMail = sent.slice(gsM).find(m => m.to.includes('noura@example.com'));
assert.ok(gsMail && gsMail.html.includes(gs2.code) && gsMail.html.includes('Sami')); assert.equal(gs2.sentTo, 'noura@example.com');
const gsRow = (await call(admin, '/api/admin/giftcards', { cookie: adm })).data.giftcards.find((g: any) => g.ref === gs2.ref);
assert.equal(gsRow.payment, 'card-here'); assert.ok(gsRow.sold_by && gsRow.paid_at && gsRow.sent_at); ok('a gift card sold in person by card is emailed to the person it is for, and the desk shows who sold it');

// ---------- phone notifications ----------
const push = await import('../netlify/lib/push');
const pushed: { endpoint: string; msg: any }[] = []; const gone = new Set<string>();
push.setPushSender(async (sub, payload) => { if (gone.has(sub.endpoint)) throw Object.assign(new Error('gone'), { statusCode: 410 }); pushed.push({ endpoint: sub.endpoint, msg: JSON.parse(payload) }); return {}; });
const vk1 = (await call(driverApi, '/api/driver/push', { cookie: dan2 })).data;
assert.ok(vk1.publicKey.length > 60); assert.equal(vk1.devices, 0);
assert.equal((await call(driverApi, '/api/driver/push', { cookie: adm })).data.publicKey, vk1.publicKey); ok('the site makes its notification key once and keeps it');
assert.equal((await call(driverApi, '/api/driver/push/subscribe', { cookie: dan2, body: { endpoint: 'http://bad', keys: {} } })).status, 400);
for (const bad of ['https://169.254.169.254/latest', 'https://localhost/x', 'https://fcm.googleapis.com.evil.example/x', 'https://fcm.googleapis.com:8443/x'])
  assert.equal((await call(driverApi, '/api/driver/push/subscribe', { cookie: dan2, body: { endpoint: bad, keys: { p256dh: 'BPx', auth: 'au' } } })).status, 400);
ok('only the real push services are accepted as a phone address');
assert.equal((await driverApi(new Request(`${H}/api/driver/push/test`, { method: 'POST', headers: { origin: 'https://evil.example', cookie: dan2 } }))).status, 403);
assert.equal((await admin(new Request(`${H}/api/admin/giftcards/GC-NOPE/paid`, { method: 'POST', headers: { origin: 'https://evil.example', cookie: adm } }))).status, 403); ok('posts from another site are refused, even without a body');
const psub = (ep: string) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${ep}`, keys: { p256dh: 'BPx' + ep, auth: 'au' + ep } });
await call(driverApi, '/api/driver/push/subscribe', { cookie: dan2, body: psub('dan-phone') });
await call(driverApi, '/api/driver/push/subscribe', { cookie: adm, body: psub('maryam-phone') });
assert.equal((await call(driverApi, '/api/driver/push', { cookie: dan2 })).data.devices, 1);
assert.equal((await call(driverApi, '/api/driver/push/test', { cookie: dan2, body: {} })).data.sent, 1);
assert.equal(pushed.at(-1)!.endpoint, 'https://fcm.googleapis.com/fcm/send/dan-phone'); ok('a driver turns notifications on and gets a test');
pushed.length = 0;
const pu1 = await order({ method: 'delivery', street: '9 Push St', postal: 'T2P1J9', day: '2027-03-19', email: 'push1@example.com' });
const pu2 = await order({ method: 'delivery', street: '8 Push St', postal: 'T2P1J8', day: '2027-03-19', email: 'push2@example.com' });
const ownerPush = pushed.filter(x => x.endpoint.endsWith('maryam-phone'));
assert.equal(ownerPush.length, 2); assert.match(ownerPush[0].msg.title, new RegExp(`New order ${pu1.data.ref}`)); assert.equal(ownerPush[0].msg.url, `/admin/?order=${pu1.data.ref}`);
assert.ok(!pushed.some(x => x.endpoint.endsWith('dan-phone'))); ok('owners get a notification for each new order; drivers do not');
pushed.length = 0;
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [pu1.data.ref, pu2.data.ref], driver: 'dan@example.com' } });
assert.equal(pushed.length, 1); assert.equal(pushed[0].msg.title, '2 new delivery stops'); assert.match(pushed[0].msg.body, /2027-03-19/); ok('a driver gets one notification when stops are assigned to them');
pushed.length = 0;
const an = (await call(admin, '/api/admin/announce', { cookie: adm, body: { body: 'Roastery closed Monday.' } })).data;
assert.equal(an.pushed, 2); assert.ok(pushed.every(x => x.msg.body === 'Roastery closed Monday.')); ok('team messages go to every phone with notifications on');
gone.add('https://fcm.googleapis.com/fcm/send/dan-phone');
await call(driverApi, '/api/driver/push/test', { cookie: dan2, body: {} });
assert.equal((await call(driverApi, '/api/driver/push', { cookie: dan2 })).data.devices, 0); ok('a phone that is gone is forgotten');
const bk2 = await (await admin(new Request(`${H}/api/admin/backup.json`, { headers: { cookie: adm } }))).json();
assert.ok(bk2.tables.push_subs && !bk2.tables.push_keys); ok('the notification key is not in the backup');
await call(driverApi, '/api/driver/push/unsubscribe', { cookie: adm, body: { endpoint: 'https://fcm.googleapis.com/fcm/send/maryam-phone' } });
// Someone turned off gets no more team notifications, and their phones are forgotten.
await call(admin, '/api/admin/team', { cookie: adm, body: { email: 'zed@example.com', name: 'Zed', role: 'driver' } });
const zed = await login('zed@example.com');
await call(driverApi, '/api/driver/onboard', { cookie: zed, body: { name: 'Zed Driver', phone: '403 555 0177', agree: true, licence_expires: '2029-01-01', insurance_expires: '2029-01-01' } });
assert.equal((await call(driverApi, '/api/driver/push/subscribe', { cookie: zed, body: psub('zed-phone') })).status, 200);
const zedId = (await call(admin, '/api/admin/team', { cookie: adm })).data.team.find((m: any) => m.email === 'zed@example.com').id;
await call(admin, `/api/admin/team/${zedId}`, { cookie: adm, body: { status: 'off' } });
pushed.length = 0;
await call(admin, '/api/admin/announce', { cookie: adm, body: { body: 'Staff meeting Friday.' } });
assert.ok(!pushed.some(x => x.endpoint.endsWith('zed-phone'))); assert.equal((await pg.query(`SELECT 1 FROM push_subs WHERE email = 'zed@example.com'`)).rows.length, 0); ok('someone turned off gets no team notifications, and their phones are forgotten');

// ---------- today page ----------
const tdA = await order({ day: '2027-03-26', payment: 'e-transfer', email: 'today1@example.com' });
const tdB = await order({ day: '2027-03-26', method: 'delivery', street: '5 Today St', postal: 'T2P1J9', payment: 'at-pickup', email: 'today2@example.com' });
const { today: todayFn } = await import('../netlify/lib/today');
const td = await todayFn('admin', '2027-03-26');
assert.equal(td.counts.orders, 2); assert.equal(td.counts.pickups, 1); assert.equal(td.counts.deliveries, 1); assert.equal(td.counts.toPack, 2);
const tdText = td.todo.map(t => t.text).join('\n');
assert.match(tdText, /new orders? to confirm/); assert.match(tdText, /2 orders for today still to pack/); assert.match(tdText, /1 delivery today with no driver/);
assert.match(tdText, /e-Transfer not in yet for/); assert.ok(!tdText.includes(tdB.data.ref)); assert.ok(td.money);
assert.equal(td.todo[0].level, 'now'); ok('Today lists what needs doing first: new orders, packing, deliveries with no driver, e-Transfers not in');
const tdH = (await call(admin, '/api/admin/today', { cookie: helper })).data;
assert.equal(tdH.money, null); assert.ok(Array.isArray(tdH.todo)); ok('helpers see Today without the money');
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [tdB.data.ref], driver: 'dan@example.com' } });
await pg.query(`UPDATE orders SET status = 'completed' WHERE ref = $1`, [tdA.data.ref]);
const tdOwed = (await todayFn('admin', '2027-03-26')).todo.map(t => t.text).join('\n');
assert.match(tdOwed, new RegExp(`Handed over but e-Transfer not in: .*${tdA.data.ref}`)); ok('an order handed over without its e-Transfer stays on Today as money owed');
assert.ok(!(await todayFn('admin', '2027-03-26')).todo.some(t => /no driver/.test(t.text))); ok('assigning a driver clears that line');

// ---------- quick search ----------
const sr1 = (await call(admin, `/api/admin/search?q=${tdA.data.ref.toLowerCase()}`, { cookie: helper })).data;
assert.equal(sr1.orders[0].ref, tdA.data.ref); ok('quick search finds an order by its number, for helpers too');
const sr2 = (await call(admin, `/api/admin/search?q=${encodeURIComponent('(403) 555-0100')}`, { cookie: adm })).data;
assert.ok(sr2.orders.length > 0); ok('quick search matches a phone number however it is typed');
const sr3 = (await call(admin, '/api/admin/search?q=today2', { cookie: adm })).data;
assert.ok(sr3.orders.some((o: any) => o.ref === tdB.data.ref)); assert.equal((await call(admin, '/api/admin/search?q=a', { cookie: adm })).data.orders.length, 0);
assert.equal((await call(admin, '/api/admin/search?q=x', { cookie: dan2 })).status, 403); ok('search by email; one letter is not searched; drivers cannot search');

// ---------- waitlist from the Coming soon page ----------
const wlMails = sent.length;
assert.equal((await call(orders, '/api/list', { body: { email: 'Waiting@Example.com', lang: 'ar', consent: true, source: 'soon', cup: 'yemen' } })).status, 200);
const wlRow = (await pg.query(`SELECT source, lang, consent_text FROM subscribers WHERE email = 'waiting@example.com'`)).rows[0] as any;
assert.equal(wlRow.source, 'soon'); assert.equal(wlRow.lang, 'ar'); assert.match(wlRow.consent_text, /ثلاث رسائل/);
const wlConfirm = sent.slice(wlMails).find(m => m.to.includes('waiting@example.com'));
const wlT = wlConfirm.text.match(/list\/confirm\?t=([A-Za-z0-9_-]+)/)[1];
await call(orders, `/api/list/confirm?t=${wlT}`);
const tdList = (await todayFn('admin', '2027-03-26')).list;
assert.ok(tdList.confirmed >= 1 && tdList.fromSoon === 1 && tdList.thisWeek >= 1); ok('waitlist sign-ups are kept with where they came from and their Arabic consent; Today counts them');
assert.equal((await call(admin, '/api/admin/list', { cookie: adm })).data.cups.yemen, 1);
assert.deepEqual((await call(orders, '/api/list', { body: { email: 'waiting@example.com', lang: 'en', consent: true, source: 'soon', cup: 'shami' } })).data, { already: true });
assert.equal(((await pg.query(`SELECT cup FROM subscribers WHERE email = 'waiting@example.com'`)).rows[0] as any).cup, 'yemen');
assert.equal((await call(admin, '/api/admin/list', { cookie: adm })).data.cups.yemen, 1); ok('nobody can change a confirmed subscriber\'s cup answer without their link');
await call(orders, '/api/list', { body: { email: 'odd@example.com', lang: 'en', consent: true, source: 'soon', cup: 'nonsense' } });
assert.equal((await pg.query(`SELECT cup FROM subscribers WHERE email = 'odd@example.com'`)).rows[0].cup, null); ok('Which cup is yours? is kept with the sign-up and counted in the desk; anything else is ignored');

// ---------- owners' decisions ----------
assert.equal((await call(admin, '/api/admin/decisions', { cookie: helper })).status, 403);
const decs0 = (await call(admin, '/api/admin/decisions', { cookie: adm })).data.decisions;
assert.ok(decs0.some((d: any) => d.id === 'radai-baydani-use' && d.answer === null));
await call(admin, '/api/admin/decisions', { cookie: adm, body: { id: 'delivery-edges', choice: 'Neither', answer: 'Maybe next year.' } });
await call(admin, '/api/admin/decisions', { cookie: adm, body: { id: 'delivery-edges', choice: 'Not an option' } });
const dAns = (await call(admin, '/api/admin/decisions', { cookie: adm })).data.decisions.find((d: any) => d.id === 'delivery-edges').answer;
assert.equal(dAns, null); // an unknown option and no text reopens it
await call(admin, '/api/admin/decisions', { cookie: adm, body: { id: 'delivery-edges', choice: 'Neither', answer: 'Maybe next year.' } });
const dAns2 = (await call(admin, '/api/admin/decisions', { cookie: adm })).data.decisions.find((d: any) => d.id === 'delivery-edges').answer;
assert.equal(dAns2.choice, 'Neither'); assert.equal(dAns2.answer, 'Maybe next year.'); assert.ok(dAns2.by && dAns2.at);
assert.equal((await call(admin, '/api/admin/decisions', { cookie: adm, body: { id: 'made-up', answer: 'x' } })).status, 404); ok('owners answer the open decisions in the desk, saved with who and when; helpers cannot');
const { DECISIONS } = await import('../src/data/decisions');
assert.equal(new Set(DECISIONS.map(d => d.id)).size, DECISIONS.length); ok('every decision has its own id');

// ---------- IT: release checks ----------
assert.equal((await call(admin, '/api/admin/release-checks', { cookie: helper })).status, 403);
await call(admin, '/api/admin/release-checks', { cookie: adm, body: { id: '1b-2:letter-test', done: true } });
await call(admin, '/api/admin/release-checks', { cookie: adm, body: { id: '1b-2:consent-words', done: true } });
await call(admin, '/api/admin/release-checks', { cookie: adm, body: { id: '1b-2:consent-words', done: false } });
const relTicks = (await call(admin, '/api/admin/release-checks', { cookie: adm })).data.ticks;
assert.ok(relTicks['1b-2:letter-test']?.by && relTicks['1b-2:letter-test'].at); assert.equal(relTicks['1b-2:consent-words'], undefined);
assert.equal((await call(admin, '/api/admin/release-checks', { cookie: adm, body: { id: '<x>', done: true } })).status, 400); ok('release checks: owners tick and untick, with who and when; helpers cannot');
const { RELEASES } = await import('../src/data/release-checks');
const relIds = RELEASES.flatMap(r => r.checks.map(c => `${r.id}:${c.id}`));
assert.equal(new Set(relIds).size, relIds.length); assert.ok(relIds.every(i => /^[\w.-]+:[\w.-]+$/.test(i))); ok('every release check has its own id');

// ---------- who can see the website ----------
const siteStateFn = (await import('../netlify/functions/site-state.mts')).default;
assert.deepEqual(await (await siteStateFn()).json(), { live: 'brewing', preview: 'code', forcedOpen: false });
process.env.SITE_PUBLIC = 'true'; assert.equal((await (await siteStateFn()).json()).forcedOpen, true); delete process.env.SITE_PUBLIC; ok('site-state says when SITE_PUBLIC opened the website, so the team bar hides for customers'); ok('the real website starts on Something is brewing, the preview with the team code');
assert.equal((await call(admin, '/api/admin/visibility', { cookie: helper, body: { preview: 'open' } })).status, 403);
assert.equal((await call(admin, '/api/admin/visibility', { cookie: adm, body: { preview: 'open' } })).status, 200);
assert.equal((await (await siteStateFn()).json()).preview, 'open'); ok('owners open the preview to anyone with the link in one click; helpers cannot');
const vM = sent.length;
const lk = await call(admin, '/api/admin/visibility', { cookie: adm, body: { live: 'open' } });
assert.equal(lk.status, 400); assert.equal(lk.data.error, 'locked');
assert.equal((await call(admin, '/api/admin/visibility', { cookie: adm, body: { live: 'open', confirm: 'hikaya' } })).data.error, 'locked');
assert.equal((await (await siteStateFn()).json()).live, 'brewing'); ok('the real website is locked: it does not open without typing the domain');
assert.equal((await call(admin, '/api/admin/visibility', { cookie: adm, body: { live: 'open', confirm: ' HikayaCoffee.ca ' } })).status, 200);
assert.equal((await (await siteStateFn()).json()).live, 'open');
assert.ok(sent.slice(vM).some(m => /website opened to everyone/.test(m.subject))); ok('typing the domain opens it, and the owners are emailed');
await call(admin, '/api/admin/visibility', { cookie: adm, body: { live: 'hidden', confirm: 'hikayacoffee.ca' } });
await call(admin, '/api/admin/visibility', { cookie: adm, body: { preview: 'code' } });
const vis = (await call(admin, '/api/admin/visibility', { cookie: adm })).data;
assert.equal((await call(admin, '/api/admin/visibility', { cookie: adm, body: { live: 'soon', confirm: 'hikayacoffee.ca' } })).status, 400);
await call(admin, '/api/admin/visibility', { cookie: adm, body: { live: 'brewing', confirm: 'hikayacoffee.ca' } });
assert.equal((await call(admin, '/api/admin/visibility', { cookie: adm })).data.live, 'brewing');
assert.equal(vis.live, 'hidden'); assert.equal(vis.domain, 'hikayacoffee.ca'); assert.ok(vis.changedBy); ok('hiding it again also needs the domain; the desk shows who changed it last');

// ---------- confirming orders ----------
const newO = await order({ day: '2027-01-31' });
const cMails = sent.length;
const cn = (await call(admin, '/api/admin/confirm-new', { cookie: helper, body: {} })).data;
assert.ok(cn.confirmed >= 1); assert.equal((await pg.query(`SELECT status FROM orders WHERE ref = $1`, [newO.data.ref])).rows[0].status, 'confirmed');
assert.ok(sent.slice(cMails).some(m => m.subject === `Order ${newO.data.ref} is confirmed`)); ok('"Confirm all new orders" confirms and emails each customer');
await call(admin, '/api/admin/settings', { cookie: adm, body: { autoConfirm: true } });
const autoMails = sent.length;
const auto = await order({ day: '2027-01-31' });
assert.equal((await pg.query(`SELECT status FROM orders WHERE ref = $1`, [auto.data.ref])).rows[0].status, 'confirmed');
const autoSubj = sent.slice(autoMails).map(m => m.subject);
assert.ok(autoSubj.includes(`Order ${auto.data.ref} is confirmed`) && !autoSubj.includes(`We have your order ${auto.data.ref}`)); ok('automatic confirmation: confirmed at once, one confirmation email');
await call(admin, '/api/admin/settings', { cookie: adm, body: { autoConfirm: false } });

// ---------- rate limits ----------
const rl = await import('../netlify/lib/rate');
let blocked = false;
for (let i = 0; i < 40 && !blocked; i++) { try { await rl.limit('order:test-ip', 8, 60); } catch (e: any) { blocked = e.status === 429; } }
assert.ok(blocked); ok('a script placing many orders from one place is stopped after 8 an hour');

// ---------- refill reminder, about three weeks after a coffee order ----------
const { sendRefills, REFILLS_ON } = await import('../netlify/functions/reminders.mts');
const rfo = await order({ email: 'refill@example.com', day: '2027-04-08', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
assert.equal(rfo.status, 201, JSON.stringify(rfo.data));
await pg.query(`UPDATE orders SET status = 'completed' WHERE ref = $1`, [rfo.data.ref]);
await pg.query(`INSERT INTO subscribers (email, lang, source, consent_text, confirmed_at, unsub_token) VALUES ('refill@example.com', 'en', 'checkout', 'yes', NOW(), 'u-refill')`);
const rfOff = sent.length; await daily('2027-04-29');
assert.equal(REFILLS_ON, false); assert.ok(!sent.slice(rfOff).some(m => /Running low/.test(m.subject))); ok('the "Running low?" email stays off until the owners decide how people agree to it');
await pg.query(`UPDATE orders SET refill_sent_at = NULL WHERE ref = $1`, [rfo.data.ref]);
await pg.query(`UPDATE subscribers SET confirmed_at = NULL WHERE email = 'refill@example.com'`);
const rfBefore = sent.length;
await sendRefills('2027-04-29');
assert.ok(!sent.slice(rfBefore).some(m => m.to === 'refill@example.com' || m.to?.includes?.('refill@example.com')));
await pg.query(`UPDATE subscribers SET confirmed_at = NOW() WHERE email = 'refill@example.com'`);
await pg.query(`UPDATE orders SET refill_sent_at = NULL WHERE ref = $1`, [rfo.data.ref]);
await sendRefills('2027-04-29');
const rfMail = sent.slice(rfBefore).find(m => /Running low/.test(m.subject));
assert.ok(rfMail); assert.match(rfMail.html, /Najdi/); assert.match(rfMail.html, /account/); assert.match(rfMail.html, /a bag running low already has its pack/); assert.doesNotMatch(rfMail.html, /Still have a bag/);
const rfCount = sent.length; await sendRefills('2027-04-30'); assert.ok(!sent.slice(rfCount).some(m => /Running low/.test(m.subject)));
ok('about three weeks after a coffee order, one "Running low?" email, only to people on the mailing list, never twice');
assert.match(rfMail.html, /\/api\/list\/unsubscribe\?t=u-refill/); assert.match(rfMail.text, /\/api\/list\/unsubscribe\?t=u-refill/);
assert.equal(rfMail.headers['List-Unsubscribe'], '<https://hikaya.test/api/list/unsubscribe?t=u-refill>'); assert.equal(rfMail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
assert.match(rfMail.html, /Hikaya Coffee Ltd\. · \[TBD\] · hikayacoffee\.ca/); ok('it has an unsubscribe link, one-click unsubscribe headers, and who it is from');
// A second coffee order four weeks later: no second email within 60 days.
const rfo2 = await order({ email: 'refill@example.com', day: '2027-05-06', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
await pg.query(`UPDATE orders SET status = 'completed' WHERE ref = $1`, [rfo2.data.ref]);
const rfCap = sent.length; await sendRefills('2027-05-27');
assert.ok(!sent.slice(rfCap).some(m => /Running low/.test(m.subject))); ok('at most one "Running low?" email every 60 days');
// Gift orders, and customers with an active regular order, are left out.
for (const [email, tok] of [['rfgift@example.com', 'u-rfgift'], ['rfreg@example.com', 'u-rfreg']]) await pg.query(`INSERT INTO subscribers (email, lang, source, consent_text, confirmed_at, unsub_token) VALUES ($1, 'en', 'checkout', 'yes', NOW(), $2)`, [email, tok]);
const rfg = await order({ email: 'rfgift@example.com', day: '2027-04-08', gift: true, gift_to: 'Aunt Huda', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
const rfr = await order({ email: 'rfreg@example.com', day: '2027-04-08', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
await pg.query(`UPDATE orders SET status = 'completed' WHERE ref = ANY($1)`, [[rfg.data.ref, rfr.data.ref]]);
await pg.query(`INSERT INTO subscriptions (email, name, phone, method, slot_window, payment, lines, every_weeks, next_date) VALUES ('rfreg@example.com', 'R', '4035550100', 'pickup', '11:00–14:00', 'e-transfer', '[]', 4, '2027-05-06')`);
const rfLeft = sent.length; await sendRefills('2027-04-29');
assert.ok(!sent.slice(rfLeft).some(m => /Running low/.test(m.subject))); ok('no "Running low?" for a gift, or for someone whose regular order is coming');
// One-click unsubscribe (POST) works, and stops the email.
const unsubPost: Response = await orders(new Request(`${H}/api/list/unsubscribe?t=u-refill`, { method: 'POST', body: 'List-Unsubscribe=One-Click' }));
assert.equal(unsubPost.status, 200);
assert.ok((await pg.query(`SELECT unsubscribed_at FROM subscribers WHERE email = 'refill@example.com'`)).rows[0].unsubscribed_at);
await pg.query(`UPDATE orders SET refill_sent_at = NULL WHERE email = 'refill@example.com'`); await pg.query(`DELETE FROM email_log WHERE kind = 'refill-reminder'`);
const rfUn = sent.length; await sendRefills('2027-04-29');
assert.ok(!sent.slice(rfUn).some(m => /Running low/.test(m.subject))); ok('one-click unsubscribe from the mail app works, and nothing more is sent');

// ---------- what was actually paid (paid_cents) ----------
const pc = (ref: string) => pg.query(`SELECT total_cents, paid_cents, payment_status, refunded_cents FROM orders WHERE ref = $1`, [ref]).then(r => r.rows[0] as any);
// Paid $26, grown to $52: only $26 is owed, and the email says so.
const pg1 = await order({ email: 'paidgrow@example.com', day: '2027-03-04', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
await call(admin, `/api/admin/orders/${pg1.data.ref}`, { cookie: adm, body: { paymentStatus: 'paid' } });
assert.equal((await pc(pg1.data.ref)).paid_cents, 2600);
const pgM = sent.length;
const pgUp = (await call(admin, `/api/admin/orders/${pg1.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] } })).data;
assert.equal(pgUp.balance, 2600); assert.deepEqual([(await pc(pg1.data.ref)).paid_cents, (await pc(pg1.data.ref)).payment_status], [2600, 'unpaid']);
const pgMail = sent.slice(pgM).find(m => m.subject === `Order ${pg1.data.ref} was updated`);
assert.match(pgMail.html, /Send \$26 by Interac/); assert.doesNotMatch(pgMail.html, /Send \$52/); ok('a paid order made bigger owes only the difference, and the email asks for that');
const pgUp2 = (await call(admin, `/api/admin/orders/${pg1.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 3 }] } })).data;
assert.equal(pgUp2.balance, 5200); ok('a second change is measured against what was paid, not lost');
await call(admin, `/api/admin/orders/${pg1.data.ref}`, { cookie: adm, body: { paymentStatus: 'paid' } });
assert.equal((await pc(pg1.data.ref)).paid_cents, 7800); ok('"Money received" records the whole total as paid');
// Paid $52, cut to $26: $26 to refund, and the refund goes through.
const ps1 = await order({ email: 'paidshrink@example.com', day: '2027-03-04', lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] });
await call(admin, `/api/admin/orders/${ps1.data.ref}`, { cookie: adm, body: { paymentStatus: 'paid' } });
const psDown = (await call(admin, `/api/admin/orders/${ps1.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] } })).data;
assert.equal(psDown.balance, -2600);
assert.equal((await call(admin, `/api/admin/orders/${ps1.data.ref}`, { cookie: adm })).data.order.refundable, 5200); // all that came in can still go back; $26 of it is the difference
const psRef = await call(admin, `/api/admin/orders/${ps1.data.ref}/refund`, { cookie: adm, body: { amount_cents: 2600, method: 'e-transfer' } });
assert.equal(psRef.status, 200, JSON.stringify(psRef.data));
assert.equal((await pc(ps1.data.ref)).payment_status, 'paid');
const psCust = (await call(admin, '/api/admin/customers?q=paidshrink', { cookie: adm })).data.customers[0];
assert.equal(psCust.spent, 2600);
assert.equal((await call(admin, `/api/admin/orders/${ps1.data.ref}/refund`, { cookie: adm, body: { amount_cents: 2601, method: 'cash' } })).data.error, 'amount');
ok('a paid order made smaller: the difference can be refunded, the order stays paid, and sales count what was kept');
// Card: a paid order that grows gets a Square link for the balance only.
process.env.SQUARE_ACCESS_TOKEN = 'sq-test'; process.env.SQUARE_LOCATION_ID = 'L1';
const sqBodies: any[] = []; const fS = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any) => {
  if (String(url).includes('/v2/online-checkout/payment-links')) { const b = JSON.parse(init.body); sqBodies.push(b); return new Response(JSON.stringify({ payment_link: { url: `https://square.test/${sqBodies.length}`, order_id: `SQO-${sqBodies.length}` } }), { status: 200 }); }
  return fS(url, init);
}) as any;
const cd1 = await order({ email: 'cardgrow@example.com', day: '2027-03-05', payment: 'card', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
assert.equal(cd1.status, 201, JSON.stringify(cd1.data));
await call(admin, `/api/admin/orders/${cd1.data.ref}`, { cookie: adm, body: { paymentStatus: 'paid' } });
const sqN = sqBodies.length;
await call(admin, `/api/admin/orders/${cd1.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] } });
const balBody = sqBodies[sqN];
assert.equal(balBody.order.line_items.length, 1); assert.equal(balBody.order.line_items[0].base_price_money.amount, 2600);
const cdPub = (await call(orders, `/api/my/orders`, { cookie: await login('cardgrow@example.com') })).data.orders?.find((x: any) => x.ref === cd1.data.ref);
assert.equal(cdPub.paid, 2600); assert.equal(cdPub.payUrl, 'https://square.test/2');
ok('a paid card order that grows gets a Square link for the balance only, not every line again');
globalThis.fetch = fS; delete process.env.SQUARE_ACCESS_TOKEN; delete process.env.SQUARE_LOCATION_ID;
// Pay at the door: paid ahead $26, grown to $52: the driver collects $26.
const dd1 = await order({ email: 'doorgrow@example.com', method: 'delivery', street: '9 Door St', postal: 'T2P1J9', day: '2027-03-05', payment: 'at-pickup', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
await call(admin, `/api/admin/orders/${dd1.data.ref}`, { cookie: adm, body: { paymentStatus: 'paid' } });
await call(admin, `/api/admin/orders/${dd1.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] } });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [dd1.data.ref], driver: 'dan@example.com' } });
const ddStop = (await call(driverApi, '/api/driver/stops?date=2027-03-05', { cookie: dan2 })).data.stops.find((x: any) => x.ref === dd1.data.ref);
assert.equal(ddStop.collect, 2600);
await driverApi(new Request(`${H}/api/driver/photo?ref=${dd1.data.ref}`, { method: 'POST', headers: { 'content-type': 'image/jpeg', origin: H, cookie: dan2 }, body: jpeg }));
assert.equal((await call(driverApi, '/api/driver/delivered', { cookie: dan2, body: { ref: dd1.data.ref, collected: 'cash' } })).status, 200);
const ddRow = (await pg.query(`SELECT collected_cents, paid_cents, total_cents FROM orders WHERE ref = $1`, [dd1.data.ref])).rows[0] as any;
assert.deepEqual([ddRow.collected_cents, ddRow.paid_cents], [2600, ddRow.total_cents]); ok('pay at the door after a change: the driver collects and records only what is still owed');

// ---------- cancelled is final; no paying for a cancelled order ----------
const newCard = async (cents: number) => {
  const g = await call(orders, '/api/giftcard', { body: { amount_cents: cents, buyer_name: 'Rana', buyer_email: 'rana@example.com', to_name: 'Lina', payment: 'e-transfer', lang: 'en' } });
  await call(admin, `/api/admin/giftcards/${g.data.ref}/paid`, { cookie: adm, body: {} });
  return (await pg.query(`SELECT code FROM gift_cards WHERE ref = $1`, [g.data.ref])).rows[0].code as string;
};
const bal = async (code: string) => (await pg.query(`SELECT balance_cents FROM gift_cards WHERE code = $1`, [code])).rows[0].balance_cents as number;
const cg = await newCard(5000);
const cgO = await order({ email: 'cancelgc@example.com', day: '2027-03-11', giftcard: cg, lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
await call(admin, `/api/admin/orders/${cgO.data.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } });
assert.equal(await bal(cg), 5000);
const reopen = await call(admin, `/api/admin/orders/${cgO.data.ref}`, { cookie: adm, body: { status: 'confirmed', notify: false } });
assert.deepEqual([reopen.status, reopen.data.error], [409, 'cancelled']); assert.equal(await bal(cg), 5000);
assert.equal((await pg.query(`SELECT status FROM orders WHERE ref = $1`, [cgO.data.ref])).rows[0].status, 'cancelled'); ok('a cancelled order cannot be reopened (its gift card money was already given back)');
const cg2 = await newCard(5000);
const cgO2 = await order({ email: 'cancelgc2@example.com', day: '2027-03-11', giftcard: cg2, lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
const afterTake = await bal(cg2);
await Promise.all([1, 2].map(() => call(admin, `/api/admin/orders/${cgO2.data.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } })));
assert.equal(await bal(cg2) - afterTake, 2600); ok('two cancels at the same moment give the gift card money back once');
// A cancelled card order: no "Pay now"; a late payment is recorded and the owners are told.
process.env.SQUARE_ACCESS_TOKEN = 'sq-test'; process.env.SQUARE_LOCATION_ID = 'L1'; process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = 'whk';
const sqB2: any[] = []; const fS2 = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any) => {
  if (String(url).includes('/v2/online-checkout/payment-links')) { sqB2.push(JSON.parse(init.body)); return new Response(JSON.stringify({ payment_link: { url: `https://square.test/c${sqB2.length}`, order_id: `SQC-${sqB2.length}` } }), { status: 200 }); }
  return fS2(url, init);
}) as any;
const webhook = (await import('../netlify/functions/square-webhook.mts')).default;
const { createHmac } = await import('node:crypto');
const sendHook = (orderId: string, paymentId: string, cents: number) => {
  const raw = JSON.stringify({ type: 'payment.updated', data: { object: { payment: { id: paymentId, order_id: orderId, status: 'COMPLETED', amount_money: { amount: cents, currency: 'CAD' } } } } });
  const sig = createHmac('sha256', 'whk').update(`${H}/api/square/webhook` + raw).digest('base64');
  return webhook(new Request(`${H}/api/square/webhook`, { method: 'POST', headers: { 'x-square-hmacsha256-signature': sig }, body: raw }));
};
const ccEmail = 'cardcancel@example.com';
const cc = await order({ email: ccEmail, day: '2027-03-12', payment: 'card', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
const ccSq = (await pg.query(`SELECT square_order_id FROM orders WHERE ref = $1`, [cc.data.ref])).rows[0].square_order_id;
await call(admin, `/api/admin/orders/${cc.data.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } });
const ccPub = (await call(orders, '/api/my/orders', { cookie: await login(ccEmail) })).data.orders.find((x: any) => x.ref === cc.data.ref);
assert.equal(ccPub.payUrl, null); ok('a cancelled card order shows no "Pay now"');
assert.equal((await sendHook(ccSq, 'PAY-LATE', 2600)).status, 200);
const ccRow = (await pg.query(`SELECT status, payment_status FROM orders WHERE ref = $1`, [cc.data.ref])).rows[0] as any;
assert.deepEqual([ccRow.status, ccRow.payment_status], ['cancelled', 'paid']);
assert.ok((await pg.query(`SELECT 1 FROM order_events e JOIN orders o ON o.id = e.order_id WHERE o.ref = $1 AND e.detail LIKE 'Paid after it was cancelled%'`, [cc.data.ref])).rows.length);
assert.equal((await call(admin, `/api/admin/orders/${cc.data.ref}`, { cookie: adm })).data.order.refundable, 2600); ok('paid after cancelling: the order stays cancelled, is marked for a refund, and the owners are told');
// A payment on the link from before a change still finds its order.
const ol = await order({ email: 'oldlink@example.com', day: '2027-03-12', payment: 'card', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
const olFirst = (await pg.query(`SELECT square_order_id FROM orders WHERE ref = $1`, [ol.data.ref])).rows[0].square_order_id;
assert.equal((await call(admin, `/api/admin/orders/${ol.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] } })).status, 200);
await sendHook(olFirst, 'PAY-OLD', 2600);
const olRow = await pc(ol.data.ref);
assert.deepEqual([olRow.paid_cents, olRow.payment_status], [2600, 'unpaid']); ok('a payment on the older link still counts, and the rest is still owed');
globalThis.fetch = fS2; delete process.env.SQUARE_ACCESS_TOKEN; delete process.env.SQUARE_LOCATION_ID; delete process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

// ---------- a code with a minimum, after the team changes the order ----------
await call(admin, '/api/admin/promos', { cookie: adm, body: { code: 'MIN70', kind: 'amount', value: 2000, min_subtotal_cents: 7000 } });
const pm = await order({ email: 'promomin@example.com', day: '2027-03-18', promo: 'MIN70', lines: [{ id: 'najdi', opt: 'dallah', qty: 3 }] });
assert.equal(pm.status, 201, JSON.stringify(pm.data));
const pmRow = async () => (await pg.query(`SELECT subtotal_cents, discount_cents, total_cents, (SELECT SUM(qty) FROM order_items i WHERE i.order_id = o.id)::int AS qty FROM orders o WHERE ref = $1`, [pm.data.ref])).rows[0] as any;
const pmBefore = await pmRow();
const pmDown = await call(admin, `/api/admin/orders/${pm.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] } });
assert.deepEqual([pmDown.status, pmDown.data.error], [409, 'promo-min']); assert.deepEqual(await pmRow(), pmBefore); ok('a change that drops an order below its code\'s minimum is refused, and nothing changes');
assert.equal((await call(admin, `/api/admin/orders/${pm.data.ref}/items`, { cookie: adm, body: { lines: [{ id: 'najdi', opt: 'dallah', qty: 4 }] } })).status, 200);
assert.equal((await pmRow()).discount_cents, 2000); ok('a change that stays above the minimum keeps the discount');

// ---------- the daily job: when it runs, retries, one step failing ----------
const { hourly } = await import('../netlify/functions/reminders.mts');
await call(admin, '/api/admin/settings', { cookie: adm, body: { cutoffMode: 'day-before', cutoffHour: 20 } });
assert.equal(await hourly(atCalgary('2027-06-03', 19)), null);
assert.ok(await hourly(atCalgary('2027-06-03', 20)));
assert.equal(await hourly(atCalgary('2027-06-03', 20)), null); ok('the daily job runs at the order-by hour (Calgary time), once per date');
const { send: sendMail } = await import('../netlify/lib/email');
let rCalls = 0; const fR = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any) => { if (String(url).includes('resend')) { rCalls++; if (rCalls === 1) return new Response('slow down', { status: 429, headers: { 'retry-after': '0' } }); } return fR(url, init); }) as any;
assert.equal(await sendMail({ to: 'retry@example.com', subject: 'Retry test', html: '<p>x</p>', text: 'x', kind: 'test' }), 'sent'); assert.equal(rCalls, 2);
globalThis.fetch = fR; ok('an email refused with "too many requests" is tried again');
process.env.GOOGLE_REVIEW_URL = 'https://g.page/r/test';
const rv = await order({ email: 'review-retry@example.com', day: '2027-06-10' });
await pg.query(`UPDATE orders SET status = 'completed', review_asked_at = NULL WHERE ref = $1`, [rv.data.ref]);
await pg.query(`UPDATE orders SET review_asked_at = NOW() WHERE ref <> $1 AND review_asked_at IS NULL`, [rv.data.ref]);
const fRv = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any) => { if (String(url).includes('resend') && JSON.parse(init.body).to[0] === 'review-retry@example.com') return new Response('down', { status: 500, headers: { 'retry-after': '0' } }); return fRv(url, init); }) as any;
await daily('2027-06-14');
assert.equal((await pg.query(`SELECT review_asked_at FROM orders WHERE ref = $1`, [rv.data.ref])).rows[0].review_asked_at, null);
globalThis.fetch = fRv;
const rvM = sent.length; await daily('2027-06-15');
assert.ok(sent.slice(rvM).some(m => m.to[0] === 'review-retry@example.com' && m.subject === 'How was it?'));
assert.ok((await pg.query(`SELECT review_asked_at FROM orders WHERE ref = $1`, [rv.data.ref])).rows[0].review_asked_at); ok('a review request that failed is sent on the next run, not marked done');
delete process.env.GOOGLE_REVIEW_URL;
const fRp = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any) => { if (String(url).includes('resend') && /month in numbers/.test(JSON.parse(init.body).subject)) return new Response('down', { status: 500, headers: { 'retry-after': '0' } }); return fRp(url, init); }) as any;
await daily('2027-05-01');
globalThis.fetch = fRp;
const rpM = sent.length; await daily('2027-05-02'); await daily('2027-05-03');
assert.equal(sent.slice(rpM).filter(m => /month in numbers \(April 2027\)/.test(m.subject)).length, 1); ok('if the monthly report fails on the 1st, it goes out on the 2nd, once');

// ---------- a bag's stock and limits reach the styles and boxes it is in ----------
const stockOf = async (id: string) => (await pg.query(`SELECT stock FROM product_settings WHERE product_id = $1`, [id])).rows[0]?.stock;
await call(admin, '/api/admin/products/gulf', { cookie: adm, body: { stock: 3 } });
const sk = await order({ email: 'stock-kit@example.com', day: '2027-06-17', lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }] });
assert.equal(sk.status, 201, JSON.stringify(sk.data)); assert.equal(await stockOf('gulf'), 1);
await call(admin, `/api/admin/orders/${sk.data.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } });
assert.equal(await stockOf('gulf'), 3); ok('Najdi orders count down the Gulf bag, and a cancel gives it back');
await call(admin, '/api/admin/products/gulf', { cookie: adm, body: { stock: null, available: false } });
assert.equal((await order({ email: 'stock-box@example.com', day: '2027-06-17', lines: [{ id: 'guest-box', opt: 'khalas', qty: 1 }] })).data.error, 'sold-out');
assert.equal((await call(orders, '/api/catalog')).data.products.najdi.available, false); ok('Gulf coffee sold out: Najdi and the Guest Box show sold out too');
await call(admin, '/api/admin/products/gulf', { cookie: adm, body: { available: true } });
await call(admin, '/api/admin/products/pack-qassim', { cookie: adm, body: { stock: 1 } });
assert.equal((await order({ email: 'stock-taste@example.com', day: '2027-06-17', lines: [{ id: 'taste-gulf', opt: 'dallah', qty: 1 }] })).status, 201);
assert.equal(await stockOf('pack-qassim'), 1); ok('a small tasting pack is its own item: it does not use up a full Qassim pack');
await call(admin, '/api/admin/products/pack-qassim', { cookie: adm, body: { stock: null } });
await call(admin, '/api/admin/products/gulf', { cookie: adm, body: { daily_cap: 1 } });
assert.equal((await order({ email: 'cap-kit1@example.com', day: '2027-06-18', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] })).status, 201);
assert.equal((await order({ email: 'cap-kit2@example.com', day: '2027-06-18', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] })).data.error, 'day-limit'); ok("the Gulf bag's daily limit counts the Najdi orders that day");
await call(admin, '/api/admin/products/gulf', { cookie: adm, body: { daily_cap: null } });

// ---------- reused ids lose the old bags' saved price ----------
const nPrice = (await pg.query(`SELECT price_cents FROM product_settings WHERE product_id = 'najdi'`)).rows[0].price_cents;
await pg.query(`UPDATE product_settings SET price_cents = 2400, stock = 9, updated_at = '2026-10-01' WHERE product_id = 'najdi'`);
await pg.query(`UPDATE product_settings SET price_cents = 3100, updated_at = '2026-10-05' WHERE product_id = 'baydani'`);
await pg.exec(fs.readFileSync('netlify/database/migrations/017_reset-reused-ids/migration.sql', 'utf8'));
const reCat = (await call(orders, '/api/catalog')).data.products;
assert.equal(reCat.najdi.price, null); assert.equal(reCat.baydani.price, 31);
assert.equal((await order({ email: 'reused@example.com', day: '2027-06-24', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] })).data.error, 'no-price');
ok('Najdi no longer carries the old bag\'s price from before the restructure; a price set since is kept');
await pg.query(`UPDATE product_settings SET price_cents = $1, updated_at = NOW() WHERE product_id = 'najdi'`, [nPrice]);

// ---------- a gift card code email that fails ----------
const gf = await call(orders, '/api/giftcard', { body: { amount_cents: 5000, buyer_name: 'Noor', buyer_email: 'noor@example.com', to_name: 'Amal', to_email: 'amal@example.com', payment: 'e-transfer', lang: 'en' } });
const fG = globalThis.fetch;
globalThis.fetch = (async (url: string, init: any) => { if (String(url).includes('resend') && JSON.parse(init.body).to[0] === 'amal@example.com') return new Response('down', { status: 500, headers: { 'retry-after': '0' } }); return fG(url, init); }) as any;
const gfPaid = (await call(admin, `/api/admin/giftcards/${gf.data.ref}/paid`, { cookie: adm, body: {} })).data;
assert.equal(gfPaid.emailStatus, 'failed'); assert.equal((await pg.query(`SELECT sent_at FROM gift_cards WHERE ref = $1`, [gf.data.ref])).rows[0].sent_at, null);
globalThis.fetch = fG;
const gfM = sent.length;
assert.equal((await call(admin, `/api/admin/giftcards/${gf.data.ref}/paid`, { cookie: adm, body: {} })).data.emailStatus, 'sent');
assert.equal(sent.slice(gfM).filter(m => m.to[0] === 'amal@example.com').length, 1); assert.equal(sent.slice(gfM).filter(m => m.to[0] === 'noor@example.com').length, 1);
assert.ok((await pg.query(`SELECT sent_at FROM gift_cards WHERE ref = $1`, [gf.data.ref])).rows[0].sent_at); ok('a gift card email that failed is not marked sent, and can be emailed again (once)');

// ---------- moving orders ----------
const mvD = await order({ email: 'move-driver@example.com', method: 'delivery', street: '5 Move St', postal: 'T2P1J9', day: '2027-07-01' });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [mvD.data.ref], driver: 'dan@example.com' } });
await call(admin, `/api/admin/orders/${mvD.data.ref}/move`, { cookie: adm, body: { day: '2027-07-01', window: '14:00–17:00', force: true } });
assert.equal((await pg.query(`SELECT driver_email FROM orders WHERE ref = $1`, [mvD.data.ref])).rows[0].driver_email, 'dan@example.com'); ok('another time on the same day keeps the driver');
await call(admin, `/api/admin/orders/${mvD.data.ref}/move`, { cookie: adm, body: { day: '2027-07-02', window: '14:00–17:00', force: true } });
assert.equal((await pg.query(`SELECT driver_email FROM orders WHERE ref = $1`, [mvD.data.ref])).rows[0].driver_email, null); ok('a delivery moved to another day comes off the driver\'s list');
// A full day: the customer can still change the time on that same day.
const fullDay = '2027-07-08';
const fd1 = await order({ email: 'fullday@example.com', day: fullDay, window: '11:00–14:00' });
await order({ email: 'fullday2@example.com', day: fullDay, window: '11:00–14:00' });
const fdN = (await pg.query(`SELECT COUNT(*)::int AS n FROM orders WHERE slot_date = $1 AND status <> 'cancelled' AND NOT is_sample`, [fullDay])).rows[0].n;
await call(admin, '/api/admin/settings', { cookie: adm, body: { caps: { dailyOrders: fdN } } });
const fdCookie = await login('fullday@example.com');
assert.equal((await call(orders, '/api/my/orders/move', { cookie: fdCookie, body: { ref: fd1.data.ref, day: fullDay, window: '17:00–20:00' } })).status, 200);
const other = await order({ email: 'fullday3@example.com', day: '2027-07-09' });
const otherCookie = await login('fullday3@example.com');
assert.equal((await call(orders, '/api/my/orders/move', { cookie: otherCookie, body: { ref: other.data.ref, day: fullDay, window: '14:00–17:00' } })).data.error, 'slot-full');
ok('on a full day, a customer can change the time of their own order, but nobody else can move in');
await call(admin, '/api/admin/settings', { cookie: adm, body: { caps: { dailyOrders: null } } });
// A day the owners closed after it was booked: the customer can still move off it.
const clO = await order({ email: 'closedday@example.com', day: '2027-07-15' });
const clSet = (await call(admin, '/api/admin/settings', { cookie: adm })).data.ordering.closedDates;
await call(admin, '/api/admin/settings', { cookie: adm, body: { closedDates: [...clSet, '2027-07-15'] } });
assert.equal((await call(orders, '/api/my/orders/move', { cookie: await login('closedday@example.com'), body: { ref: clO.data.ref, day: '2027-07-16', window: '11:00–14:00' } })).status, 200);
await call(admin, '/api/admin/settings', { cookie: adm, body: { closedDates: clSet } }); ok('a day closed after booking: the customer can still move the order to an open day');

// ---------- the monthly report counts months in Calgary time ----------
const tz = await order({ email: 'lastevening@example.com', day: '2027-07-22' });
await pg.query(`UPDATE orders SET created_at = '2027-02-01T03:00:00Z' WHERE ref = $1`, [tz.data.ref]); // 31 Jan, 8 pm in Calgary
const { monthlyReport } = await import('../netlify/lib/report');
assert.equal((await monthlyReport('2027-02-01')).numbers.orders, 1); assert.equal((await monthlyReport('2027-03-01')).numbers.orders, 0);
ok('an order on the last evening of January (Calgary time) counts in January');

// ---------- regular orders with the weekly deadline on Sunday ----------
await call(admin, '/api/admin/settings', { cookie: adm, body: { cutoffMode: 'weekly', cutoffWeekday: 0, cutoffHour: 17 } });
await pg.query(`INSERT INTO subscriptions (email, name, phone, method, slot_window, payment, lines, every_weeks, next_date) VALUES ('sunday-reg@example.com', 'S', '4035550100', 'pickup', '11:00–14:00', 'e-transfer', $1, 2, '2027-08-01')`, [JSON.stringify([{ id: 'najdi', opt: 'dallah', qty: 1 }])]);
const sunM = sent.length; await daily('2027-07-24');
assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM orders WHERE email = 'sunday-reg@example.com' AND slot_date = '2027-08-01'`)).rows[0].n, 1);
assert.ok(!sent.slice(sunM).some(m => /couldn't place/i.test(m.subject))); ok('a Sunday regular order is placed the evening before a Sunday deadline, eight days ahead');
assert.equal((await call(admin, '/api/admin/settings', { cookie: adm, body: { cutoffWeekday: 5 } })).data.ordering.cutoffWeekday, 0); ok('the weekly deadline can only be Sunday to Wednesday');
await call(admin, '/api/admin/settings', { cookie: adm, body: { cutoffMode: 'day-before', cutoffWeekday: 2, cutoffHour: 20 } });

// ---------- orders arriving at the same moment don't overbook ----------
const capBefore = (await call(admin, '/api/admin/settings', { cookie: adm })).data.capacity;
await call(admin, '/api/admin/settings', { cookie: adm, body: { capacity: { pickup: 1, delivery: capBefore.delivery } } });
await call(admin, '/api/admin/promos', { cookie: adm, body: { code: 'RUSH', kind: 'amount', value: 100, max_uses: 10 } });
await call(admin, '/api/admin/products/hadrami', { cookie: adm, body: { stock: 10 } });
const rush = await Promise.all([1, 2, 3].map(i => order({ email: `rush${i}@example.com`, day: '2027-07-29', window: '14:00–17:00', promo: 'RUSH', lines: [{ id: 'hadrami', opt: 'dallah', qty: 1 }] })));
assert.deepEqual(rush.map(r => r.status).sort(), [201, 409, 409]); assert.ok(rush.filter(r => r.status === 409).every(r => r.data.error === 'slot-full'));
assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM orders WHERE slot_date = '2027-07-29' AND slot_window = '14:00–17:00'`)).rows[0].n, 1);
assert.equal((await pg.query(`SELECT uses FROM promo_codes WHERE code = 'RUSH'`)).rows[0].uses, 1); assert.equal(await stockOf('hadrami'), 9);
ok('three orders for the last place at once: one gets it, the others are refused and their stock and code use go back');
await call(admin, '/api/admin/settings', { cookie: adm, body: { capacity: capBefore } });
await call(admin, '/api/admin/products/hadrami', { cookie: adm, body: { stock: null, daily_cap: 1 } });
const rush2 = await Promise.all([1, 2].map(i => order({ email: `rushcap${i}@example.com`, day: '2027-07-30', lines: [{ id: 'hadrami', opt: 'dallah', qty: 1 }] })));
assert.deepEqual(rush2.map(r => r.status).sort(), [201, 409]); ok('the same for a product\'s daily limit');
await call(admin, '/api/admin/products/hadrami', { cookie: adm, body: { daily_cap: null } });

// ---------- helpers added in the desk get the run sheet ----------
await call(admin, '/api/admin/team', { cookie: adm, body: { email: 'deskhelper@example.com', role: 'helper', name: 'Desk Helper' } });
const { tomorrowEmail } = await import('../netlify/lib/tomorrow');
await order({ email: 'runsheet@example.com', day: '2027-08-05' });
const rsM = sent.length; await tomorrowEmail('2027-08-05');
assert.ok(sent.slice(rsM).some(m => m.to[0] === 'deskhelper@example.com' && /^Tomorrow: /.test(m.subject))); ok('helpers added in Admin → Team get the evening run sheet');

// ---------- checklist keys and supplies with Arabic names ----------
const ckSave = (lists: any[]) => call(admin, '/api/admin/checklists', { cookie: adm, body: { checklists: lists } });
const L = (name: string, key?: string) => ({ ...(key ? { key } : {}), name, items: ['Check'] });
await ckSave([L('A'), L('B'), L('C'), L('D')]);
const ck1 = (await call(admin, '/api/admin/checklists', { cookie: adm })).data.checklists;
await ckSave([...ck1.slice(1), L('E')]);
const ck2 = (await call(admin, '/api/admin/checklists', { cookie: adm })).data.checklists;
assert.equal(new Set(ck2.map((c: any) => c.key)).size, ck2.length);
assert.equal((await ckSave([L('X', 'same'), L('Y', 'same')])).status, 400); ok('every checklist keeps its own key, even after one is removed');
await call(admin, '/api/admin/supplies/new', { cookie: adm, body: { name: 'أكياس صغيرة', unit: 'pcs', onHand: 10 } });
await call(admin, '/api/admin/supplies/new', { cookie: adm, body: { name: 'علب الهدايا', unit: 'pcs', onHand: 5 } });
const supAr = (await call(admin, '/api/admin/supplies', { cookie: adm })).data.supplies;
assert.ok(supAr.some((x: any) => x.name === 'أكياس صغيرة') && supAr.some((x: any) => x.name === 'علب الهدايا')); ok('supplies named in Arabic are all saved');

// ---------- a real rehearsal order ticked "sample" ----------
await call(admin, '/api/admin/products/hijazi', { cookie: adm, body: { visible: true, stock: 5 } });
const reh = await order({ email: 'rehearsal@example.com', day: '2027-08-12', lines: [{ id: 'hijazi', opt: 'dallah', qty: 2 }] });
assert.equal(reh.status, 201, JSON.stringify(reh.data)); assert.equal(await stockOf('hijazi'), 3);
await call(admin, `/api/admin/orders/${reh.data.ref}`, { cookie: adm, body: { paymentStatus: 'paid' } });
await call(admin, `/api/admin/orders/${reh.data.ref}/refund`, { cookie: adm, body: { amount_cents: 100, method: 'store-credit', notify: false } });
await call(admin, `/api/admin/orders/${reh.data.ref}`, { cookie: adm, body: { sample: true } });
assert.equal(await stockOf('hijazi'), 5); ok('ticking a real order "sample" gives its stock back');
await call(admin, '/api/admin/samples', { cookie: adm, body: { action: 'remove' } });
assert.equal(await stockOf('hijazi'), 5);
assert.equal((await pg.query(`SELECT COUNT(*)::int AS n FROM refunds r JOIN orders o ON o.id = r.order_id WHERE o.ref = $1`, [reh.data.ref])).rows[0].n, 1); ok('"Remove all sample orders" keeps a real rehearsal order and its refunds');
await call(admin, `/api/admin/orders/${reh.data.ref}`, { cookie: adm, body: { status: 'cancelled', notify: false } });
assert.equal(await stockOf('hijazi'), 5); ok('cancelling it afterwards doesn\'t give the stock back twice');
const reh2 = await order({ email: 'rehearsal2@example.com', day: '2027-08-12', lines: [{ id: 'hijazi', opt: 'dallah', qty: 1 }] });
await call(admin, `/api/admin/orders/${reh2.data.ref}`, { cookie: adm, body: { sample: true } });
assert.equal(await stockOf('hijazi'), 5);
await call(admin, `/api/admin/orders/${reh2.data.ref}`, { cookie: adm, body: { sample: false } });
assert.equal(await stockOf('hijazi'), 4); ok('unticking "sample" takes the stock again');
await call(admin, '/api/admin/products/hijazi', { cookie: adm, body: { stock: null } });

// ---------- Arabic error messages on the Arabic pages ----------
const { errorText } = await import('../src/scripts/errors');
await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { stock: 1 } });
const arStock = (await order({ email: 'ar-err@example.com', lang: 'ar', day: '2027-08-19', lines: [{ id: 'qishr', qty: 3 }] })).data;
assert.equal(arStock.error, 'stock'); assert.equal(arStock.extra.left, 1); assert.match(errorText(arStock, true), /^بقي 1 فقط من .+\. قلّل الكمية\.$/);
assert.equal(errorText({ error: 'slot-full', message: 'That time is full. Please choose another.' }, true), 'لا مكان في هذا الموعد. اختر وقتاً أو يوماً آخر.');
assert.equal(errorText({ error: 'slot-full', message: 'That time is full. Please choose another.' }, false), 'That time is full. Please choose another.');
ok('slot, deadline and stock errors read in Arabic on the Arabic pages');
await call(admin, '/api/admin/products/qishr', { cookie: adm, body: { stock: null } });

console.log(`\n${pass} checks passed`);
