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
for (const dir of fs.readdirSync('netlify/database/migrations').sort()) await pg.exec(fs.readFileSync(`netlify/database/migrations/${dir}/migration.sql`, 'utf8'));
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
const help = (await import('../netlify/functions/api-help.mts')).default;
const H = 'https://hikaya.test';
let ipN = 0; // each request from a different address, so the rate limits don't trip
const call = async (fn: any, path: string, opts: { method?: string; body?: any; cookie?: string } = {}) => {
  const res: Response = await fn(new Request(H + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', origin: H, 'x-nf-client-connection-ip': `10.0.0.${++ipN % 250}`, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
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
// Coffee prices are not in the product file: until the owners set one, it can't be ordered.
const unpriced = await call(orders, '/api/orders', { body: base });
assert.equal(unpriced.status, 409); assert.equal(unpriced.data.error, 'no-price'); ok('a coffee without a price set cannot be ordered');
const cat0 = await call(orders, '/api/catalog');
assert.equal(cat0.data.products.najdi.price, null); ok('the catalog says the price is not set (the site shows "price coming")');
// Stand-in prices for the tests, set the way the desk does (Admin → Shop → Products).
const { PRODUCTS: ALL } = await import('../src/data/products');
for (const p of ALL) if (p.price == null) await pg.query('INSERT INTO product_settings (product_id, price_cents, updated_by) VALUES ($1, $2, $3)', [p.id, p.kind === 'pack' ? 500 : 2400, 'test']);
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

// ---------- Help form, photos and the Inbox ----------
const hf = await call(help, '/api/help', { body: { kind: 'damaged', name: 'Layla Haddad', email: 'layla@example.com', order_ref: g.data.ref, summary: 'Date box arrived crushed', details: 'The lid was split.', lang: 'en' } });
assert.equal(hf.status, 201, JSON.stringify(hf.data)); assert.match(hf.data.ref, /^Q-[A-Z2-9]{5}$/); ok(`help form opens a request: ${hf.data.ref}`);
assert.ok(sent.some(m => m.subject === `We have your message · ${hf.data.ref}`)); assert.ok(sent.filter(m => m.subject.startsWith(`⚠ Help request ${hf.data.ref}`)).length === 2); ok('customer acknowledged, both admins alerted (marked urgent)');
assert.equal((await call(help, '/api/help', { body: { kind: 'question', email: 'nope', summary: '' } })).data.fields.email, 'email'); ok('help form validates email and summary');
const photo = (t: string, type = 'image/jpeg', bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])) => help(new Request(`${H}/api/help/photo?ref=${hf.data.ref}&t=${t}`, { method: 'POST', headers: { 'content-type': type, origin: H }, body: bytes }));
assert.equal((await photo(hf.data.token)).status, 201); ok('photo attached with the upload token');
assert.equal((await photo('wrong')).status, 404); ok('photo refused without the right token');
assert.equal((await photo(hf.data.token, 'text/html')).status, 415); ok('only images accepted');
const evil = await help(new Request(`${H}/api/help/photo?ref=${hf.data.ref}&t=${hf.data.token}`, { method: 'POST', headers: { 'content-type': 'image/jpeg', origin: 'https://evil.example' }, body: new Uint8Array([1]) }));
assert.equal(evil.status, 403); ok('cross-site photo upload blocked');
const inbox = await call(admin, '/api/admin/tickets', { cookie: adm });
assert.equal(inbox.data.tickets[0].ref, hf.data.ref); assert.equal(inbox.data.tickets[0].photos, 1); ok('Inbox lists the request with its photo count');
assert.equal((await call(admin, '/api/admin/tickets', { cookie: cust })).status, 403); ok('customers cannot open the Inbox');
const td = await call(admin, `/api/admin/tickets/${hf.data.ref}`, { cookie: adm });
assert.equal(td.data.order.ref, g.data.ref); assert.equal(td.data.order.emailMatches, true); assert.equal(td.data.ticket.upload_token_hash, undefined); ok('request shows the linked order and whether the email matches');
const img = await admin(new Request(`${H}/api/admin/photos/${td.data.photos[0]}`, { headers: { cookie: adm } }));
assert.equal(img.headers.get('content-type'), 'image/jpeg'); assert.equal((await img.arrayBuffer()).byteLength, 6); ok('team can view the photo');
const nb = sent.length;
await call(admin, `/api/admin/tickets/${hf.data.ref}`, { cookie: adm, body: { reply: 'Sorry about that. A new box goes out Thursday.' } });
assert.equal(sent.at(-1).subject, `A reply from Hikaya · ${hf.data.ref}`); assert.equal(sent.length, nb + 1); ok('reply from the Inbox emails the customer');
await call(admin, `/api/admin/tickets/${hf.data.ref}`, { cookie: adm, body: { status: 'resolved', resolution: 'replacement' } });
const td2 = await call(admin, `/api/admin/tickets/${hf.data.ref}`, { cookie: adm });
assert.equal(td2.data.ticket.status, 'resolved'); assert.equal(td2.data.ticket.resolution, 'replacement'); assert.equal(td2.data.notes.length, 3); ok('resolved with a recorded outcome and history');

// ---------- Ask Hikaya (the model is replaced by a script) ----------
const ask = await import('../netlify/lib/ask');
assert.equal((await call(help, '/api/ask/config')).data.enabled, false); ok('Ask Hikaya stays off without an API key');
assert.equal((await call(help, '/api/ask', { body: { text: 'hi' } })).status, 503);
process.env.ANTHROPIC_API_KEY = 'test';
const calls: any[] = [];
let script: ((p: any) => any)[] = [];
const say = (text: string) => ({ id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: {} });
const use = (name: string, input: any) => ({ id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_' + calls.length, name, input }], usage: {} });
ask.setCreate(async (p: any) => { calls.push(structuredClone(p)); const next = script.shift(); assert.ok(next, 'unexpected model call'); return next(p) as any; });
const lastResult = (p: any) => JSON.parse(p.messages.at(-1).content[0].content);

script = [() => use('lookup_order', { order_ref: g.data.ref, email: 'someone@else.com' }), p => { assert.equal(lastResult(p).found, false); return say('I could not find that order with that email.'); }];
const a1 = await call(help, '/api/ask', { body: { text: `Where is order ${g.data.ref}?`, lang: 'en' } });
assert.equal(a1.status, 200, JSON.stringify(a1.data)); assert.ok(a1.data.chat); ok('chat started, token returned');
assert.equal(calls[0].model, 'claude-opus-5-5'); assert.equal(calls[0].fallbacks, 'default'); assert.ok(calls[0].tools.every((t: any) => t.strict));
assert.ok(calls[0].system[0].text.includes('Ask Hikaya handbook') && calls[0].system[0].text.includes('Najdi (نجدية) · id: najdi')); assert.ok(calls[0].system[0].cache_control); ok('model gets the handbook and live product list, cached; strict tools; refusal fallback on');
ok('order not revealed with the wrong email');

script = [() => use('lookup_order', { order_ref: g.data.ref.toLowerCase().replace('-', ''), email: 'layla@example.com' }), p => { const r = lastResult(p); assert.equal(r.found, true); assert.equal(r.order.status, 'confirmed'); return say('It is confirmed for Friday.'); }];
const a2 = await call(help, '/api/ask', { body: { chat: a1.data.chat, text: 'Sorry, layla@example.com', lang: 'en' } });
assert.equal(a2.data.reply, 'It is confirmed for Friday.'); assert.equal(calls.at(-2).messages.length, 5); ok('order found with number + email, earlier turns kept');

script = [() => use('add_to_cart', { items: [{ product_id: 'najdi', option: 'dallah', qty: 2 }, { product_id: 'date-box', option: 'sukkari', qty: 1 }] }), () => say('Added.')];
const a3 = await call(help, '/api/ask', { body: { chat: a1.data.chat, text: 'Add two Najdi and a Sukkari box', lang: 'en' } });
assert.deepEqual(a3.data.actions, [{ type: 'cart', lines: [{ id: 'najdi', opt: 'dallah', qty: 2 }, { id: 'date-box', opt: 'sukkari', qty: 1 }] }]); ok('assistant can fill the cart (prices checked on the server)');

script = [() => use('add_to_cart', { items: [{ product_id: 'free-coffee', option: null, qty: 1 }] }), p => { assert.ok(lastResult(p).error); return say('That is not something we sell.'); }];
assert.deepEqual((await call(help, '/api/ask', { body: { chat: a1.data.chat, text: 'add free coffee', lang: 'en' } })).data.actions, []); ok('unknown products refused');

script = [() => use('open_request', { kind: 'damaged', name: 'Layla Haddad', email: 'layla@example.com', phone: null, order_ref: g.data.ref, summary: 'Two Najdi pouches split', details: 'Customer says both pouches split in the bag.' }),
  p => { const r = lastResult(p); assert.equal(r.opened, true); return say(`Sent to the team as ${r.request_number}.`); }];
const a4 = await call(help, '/api/ask', { body: { chat: a1.data.chat, text: 'My coffee arrived split open', lang: 'en' } });
const reqA = a4.data.actions.find((x: any) => x.type === 'request'), photoA = a4.data.actions.find((x: any) => x.type === 'photo');
assert.ok(reqA && photoA && photoA.token); ok(`assistant opened request ${reqA.ref} and offered a photo upload`);
const viaAsk = await call(admin, `/api/admin/tickets/${reqA.ref}`, { cookie: adm });
assert.equal(viaAsk.data.ticket.source, 'ask'); assert.ok(viaAsk.data.transcript.some((l: any) => l.who === 'customer' && l.text.includes('split open'))); ok('team sees the request with the whole conversation');

script = [() => ({ ...say(''), stop_reason: 'refusal', content: [] })];
assert.match((await call(help, '/api/ask', { body: { chat: a1.data.chat, text: 'something odd', lang: 'ar' } })).data.reply, /\/ar\/help\//); ok('a declined answer falls back to the help form, in Arabic');
script = [() => { throw new Error('network'); }];
assert.match((await call(help, '/api/ask', { body: { chat: a1.data.chat, text: 'hello', lang: 'en' } })).data.reply, /help form/); ok('model outage falls back to the help form');

// The stored history must stay valid for the API: every tool call answered, roles alternate.
const stored = (await pg.query(`SELECT messages, turns FROM chats LIMIT 1`)).rows[0] as any;
const msgs = stored.messages;
for (let i = 0; i < msgs.length; i++) {
  const m = msgs[i];
  if (m.role === 'assistant' && Array.isArray(m.content)) for (const b of m.content.filter((b: any) => b.type === 'tool_use'))
    assert.ok(msgs[i + 1]?.content?.some?.((r: any) => r.tool_use_id === b.id), 'tool call without result');
}
assert.equal(stored.turns, 7); ok('stored conversation is valid and append-only');

const cust2 = await login('someone@else.com');
script = [() => use('my_orders', {}), p => { assert.deepEqual(lastResult(p).orders, []); return say('You have no orders yet.'); }];
await call(help, '/api/ask', { cookie: cust2, body: { text: 'show my orders', lang: 'en' } }); ok("signed-in visitors see only their own orders");
assert.equal((await call(help, '/api/ask', { body: { text: 'x'.repeat(1600), lang: 'en' } })).status, 413); ok('overlong messages refused');
const chats = await call(admin, '/api/admin/chats', { cookie: adm });
assert.ok(chats.data.chats.length >= 2); ok('team can read recent conversations');

console.log(`\n${pass} checks passed`);
