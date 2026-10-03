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

// ---------- weekly roast and pack sheet ----------
const { weekStart } = await import('../netlify/lib/week');
assert.equal(weekStart('2027-01-22'), '2027-01-21'); assert.equal(weekStart('2027-01-19'), '2027-01-21'); assert.equal(weekStart('2027-01-24'), '2027-01-21'); ok('a service week runs Thursday to Wednesday');
const sheet = async () => (await call(admin, '/api/admin/week?from=2027-01-21', { cookie: adm })).data;
const najdiPouches = (s: any) => s.coffee.filter((r: any) => r.id === 'najdi').reduce((a: number, r: any) => a + r.pouches, 0);
const w0 = await sheet();
assert.equal((await order({ lines: [{ id: 'guest-box', qty: 1 }, { id: 'najdi', opt: 'dallah', qty: 2 }] })).status, 201);
const w1 = await sheet();
assert.equal(najdiPouches(w1) - najdiPouches(w0), 3); assert.equal(w1.packaging.giftBoxes.C12 - w0.packaging.giftBoxes.C12, 1);
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
edited.palm.serve.en = 'Pour a third of the cup.'; edited.palm.steps[1].secs = 540; edited.palm.extra = 'sneaky'; edited.sneaky = { a: 1 };
assert.equal((await call(admin, '/api/admin/content/recipes', { cookie: helper, body: { data: edited, sha: 'sha1' } })).status, 403);
const sv = await call(admin, '/api/admin/content/recipes', { cookie: adm, body: { data: edited, sha: 'sha1' } });
assert.equal(sv.data.saved, true); const savedJson = JSON.parse(ghFile);
assert.equal(savedJson.palm.serve.en, 'Pour a third of the cup.'); assert.equal(savedJson.palm.steps[1].secs, 540); assert.equal(savedJson.palm.extra, undefined); assert.equal(savedJson.sneaky, undefined);
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
await call(admin, '/api/admin/products/sanaani', { cookie: adm, body: { available: false } });
await order({ repeat: 4, email: 'gone@example.com', day: '2027-01-22', lines: [{ id: 'najdi', opt: 'dallah', qty: 1 }] });
await pg.query(`UPDATE subscriptions SET lines = '[{"id":"sanaani","opt":"dallah","qty":1}]'::jsonb WHERE email = 'gone@example.com'`);
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

await call(admin, '/api/admin/products/radaey', { cookie: adm, body: { stock: 5, available: true } });
const lowBefore = sent.length;
await order({ lines: [{ id: 'radaey', opt: 'dallah', qty: 1 }] });
assert.ok(!sent.slice(lowBefore).some(m => /Running low/.test(m.subject)));
await order({ lines: [{ id: 'radaey', opt: 'dallah', qty: 1 }] });
const lowMail = sent.slice(lowBefore).filter(m => /Running low/.test(m.subject));
assert.equal(lowMail.length, 1); assert.match(lowMail[0].subject, /3 left/);
await order({ lines: [{ id: 'radaey', opt: 'dallah', qty: 1 }] });
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
assert.equal(stEve.km, 16); assert.equal(stEve.minutes, 40);
const evStops = (await call(driverApi, '/api/driver/stops?date=2027-02-04', { cookie: eve })).data.stops;
assert.deepEqual(evStops.map((x: any) => x.ref), [ev2.data.ref, ev1.data.ref, ev3.data.ref]); assert.equal(evStops[0].seq, 1); ok('stops shown in driving order, numbered');
let rt = (await call(driverApi, '/api/driver/route?date=2027-02-04', { cookie: eve })).data.route;
assert.equal(rt.next.ref, ev2.data.ref); assert.match(rt.next.url, /google\.com\/maps\/dir\/.*destination=20%20B%20St/); assert.equal(rt.kmSoFar, 0); ok('"Navigate to next stop" opens Google Maps to the next stop');
assert.equal((await call(driverApi, '/api/driver/start?date=2027-02-04', { cookie: eve, body: {} })).data.error, 'route-open');
const photo = async (ref: string) => driverApi(new Request(`${H}/api/driver/photo?ref=${ref}`, { method: 'POST', headers: { 'content-type': 'image/jpeg', origin: H, cookie: eve }, body: jpeg }));
await photo(ev2.data.ref); await call(driverApi, '/api/driver/delivered', { cookie: eve, body: { ref: ev2.data.ref, collected: 'card' } });
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
delete process.env.GOOGLE_MAPS_API_KEY; delete process.env.SHOP_ADDRESS; globalThis.fetch = f1;
const ev5 = await order({ method: 'delivery', street: '50 E St', postal: 'T3A0A1', day: '2027-02-06', email: 'e5@example.com' });
const ev6 = await order({ method: 'delivery', street: '60 F St', postal: 'T2P1J9', day: '2027-02-06', email: 'e6@example.com' });
await call(admin, '/api/admin/assign', { cookie: adm, body: { refs: [ev5.data.ref, ev6.data.ref], driver: 'eve@example.com' } });
const noMaps = (await call(driverApi, '/api/driver/start?date=2027-02-06', { cookie: eve, body: {} })).data;
assert.equal(noMaps.optimized, false); assert.equal(noMaps.km, null);
assert.deepEqual((await call(driverApi, '/api/driver/stops?date=2027-02-06', { cookie: eve })).data.stops.map((x: any) => x.ref), [ev6.data.ref, ev5.data.ref]); ok('without the Maps key: stops by time window and area, still works');

// ---------- the team: packers, volunteers, papers, shifts, hours ----------
await call(admin, '/api/admin/team', { cookie: adm, body: { email: 'pat@example.com', name: 'Pat', role: 'packer', volunteer: true } });
const pat = await login('pat@example.com');
assert.equal((await call(auth, '/api/me', { cookie: pat })).data.user.role, 'packer');
assert.equal((await call(admin, '/api/admin/orders', { cookie: pat })).status, 403);
assert.equal((await call(driverApi, '/api/driver/me', { cookie: pat })).data.needsOnboarding, true);
await call(driverApi, '/api/driver/onboard', { cookie: pat, body: { name: 'Pat Packer', phone: '403 555 0130', agree: true, food_cert_expires: '2026-10-20' } });
assert.equal((await call(driverApi, '/api/driver/stops', { cookie: pat })).status, 403); ok('a volunteer packer onboards and gets the team app, not deliveries or the desk');
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
assert.equal((await order({ day: capDay, lines: [{ id: 'radaey', opt: 'dallah', qty: 1 }] })).status, 201);
assert.equal((await order({ day: capDay })).data.error, 'slot-full'); ok('orders per day are limited');
await call(admin, '/api/admin/settings', { cookie: adm, body: { caps: { dailyOrders: null, giftBoxesPerDay: null, stopsPerDriver: null, deliveryFromShifts: false } } });

// ---------- lots, recall, supplies ----------
assert.equal((await call(admin, '/api/admin/lots', { cookie: adm, body: { item_kind: 'coffee', item_id: 'nope' } })).status, 400);
const lot1 = (await call(admin, '/api/admin/lots', { cookie: adm, body: { item_kind: 'coffee', item_id: 'najdi', made_on: '2027-02-01', best_before: '2027-08-01', quantity: '10 kg' } })).data.code;
const lot2 = (await call(admin, '/api/admin/lots', { cookie: helper, body: { item_kind: 'dates', item_id: 'khalas', made_on: '2027-02-01' } })).data.code;
assert.equal(lot1, 'NAJDI-270201-1'); assert.equal(lot2, 'KHALAS-270201-1'); ok('production lots get a code (product, date, number)');
const lo1 = await order({ day: '2027-02-13', lines: [{ id: 'guest-box', qty: 1 }], email: 'lot1@example.com' });
const lo2 = await order({ day: '2027-02-13', lines: [{ id: 'sanaani', opt: 'dallah', qty: 1 }], email: 'lot2@example.com' }).catch(() => null);
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

console.log(`\n${pass} checks passed`);
