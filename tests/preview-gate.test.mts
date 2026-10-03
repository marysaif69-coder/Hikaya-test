// The private-preview passcode screen (netlify/edge-functions/preview-gate.ts).
// Run: npx tsx tests/preview-gate.test.mts
import assert from 'node:assert/strict';
const gate = (await import('../netlify/edge-functions/preview-gate.ts')).default;
const H = 'https://hikaya.test';
const page = () => new Response('<h1>shop</h1>', { headers: { 'content-type': 'text/html' } });
const run = (path: string, init: RequestInit = {}) => gate(new Request(H + path, init), { next: async () => page() });
let pass = 0; const ok = (m: string) => { pass++; console.log('  ✓', m); };

delete process.env.PREVIEW_PASSWORD; delete process.env.SITE_PUBLIC;
const closed = await run('/en/');
assert.ok((await closed.text()).includes('Coming soon')); ok('hidden by default: no settings means the Coming soon screen');
const unset = await run('/__preview', { method: 'POST', body: new URLSearchParams({ code: 'anything' }) });
assert.equal(unset.status, 401); assert.ok((await unset.text()).includes('no preview code yet')); ok('without a passcode nobody gets in, and the screen says why');
process.env.SITE_PUBLIC = 'true';
assert.equal(await (await run('/en/')).text(), '<h1>shop</h1>'); ok('SITE_PUBLIC=true opens the site');
delete process.env.SITE_PUBLIC;

process.env.PREVIEW_PASSWORD = 'dates-2027';
const g = await run('/en/shop/?x=1');
assert.equal(g.status, 200); const html = await g.text();
assert.ok(html.includes('Preview code') && html.includes('value="/en/shop/?x=1"')); assert.match(g.headers.get('x-robots-tag')!, /noindex/); ok('visitors see the passcode screen, marked noindex');
assert.equal((await run('/api/slots')).status, 401); ok('API is closed without the passcode');
assert.equal(await (await run('/robots.txt')).text(), 'User-agent: *\nDisallow: /\n'); ok('robots.txt blocks all crawlers');

const post = (code: string, next = '/en/shop/') => run('/__preview', { method: 'POST', body: new URLSearchParams({ code, next }) });
const bad = await post('wrong');
assert.equal(bad.status, 401); assert.ok((await bad.text()).includes('not right')); ok('wrong code refused');
assert.equal((await post('  Dates-2027 ')).status, 303); ok('spaces and capitals do not matter');
const good = await post('dates-2027');
assert.equal(good.status, 303); assert.equal(good.headers.get('location'), '/en/shop/');
const cookie = good.headers.get('set-cookie')!.split(';')[0];
assert.ok(good.headers.get('set-cookie')!.includes('HttpOnly')); ok('right code sets a 30-day cookie and returns to the page');
const inside = await run('/en/', { headers: { cookie } });
assert.equal(await inside.text(), '<h1>shop</h1>'); assert.match(inside.headers.get('x-robots-tag')!, /noindex/); ok('with the cookie the site works, still noindex');
assert.equal((await post('dates-2027', '//evil.example')).headers.get('location'), '/'); ok('cannot redirect to another site');

// ---------- the waitlist on the Coming soon screen ----------
const runWith = (path: string, init: RequestInit, res: Response) => gate(new Request(H + path, init), { next: async () => res });
const soon = await (await run('/en/')).text();
assert.ok(soon.includes('id="wl"') && soon.includes('Tell me') && soon.includes('about three emails a year') && soon.includes('نحو ثلاث رسائل')); ok('the Coming soon screen asks for an email, with the consent text in Arabic and English');
assert.ok(/<details><summary>للفريق · Team<\/summary>/.test(soon)); ok('the preview code is tucked under "Team"');
assert.equal(await (await run('/api/list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).text(), '<h1>shop</h1>'); ok('joining the list gets through while the site is hidden');
const conf = await runWith('/api/list/confirm?t=abc', {}, new Response(null, { status: 303, headers: { location: 'https://hikaya.test/ar/thanks/?list=1' } }));
assert.equal(conf.status, 303); assert.equal(conf.headers.get('location'), '/?list=1');
assert.ok((await (await run('/?list=1')).text()).includes('you are on the list')); ok('the confirm link from the email lands on "you are on the list"');
const un = await runWith('/api/list/unsubscribe?t=abc', {}, new Response(null, { status: 303, headers: { location: 'https://hikaya.test/en/thanks/?unsub=1' } }));
assert.equal(un.headers.get('location'), '/?unsub=1'); assert.ok((await (await run('/?unsub=1')).text()).includes('You are off the list')); ok('unsubscribe links work while the site is hidden');
assert.equal((await run('/api/list/confirm', { method: 'POST' })).status, 401); assert.equal((await run('/api/orders', { method: 'POST' })).status, 401); ok('everything else on the API stays closed');
assert.ok(!(await (await run('/?list=1')).text()).includes('<details open>')); assert.ok((await (await post('wrong')).text()).includes('<details open>')); ok('a wrong code opens the Team box again');

process.env.PREVIEW_PASSWORD = 'new-code';
assert.notEqual(await (await run('/en/', { headers: { cookie } })).text(), '<h1>shop</h1>'); ok('changing the passcode signs everyone out');
console.log(`\n${pass} checks passed`);
