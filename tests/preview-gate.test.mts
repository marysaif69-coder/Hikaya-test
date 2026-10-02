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
assert.equal((await run('/__preview', { method: 'POST', body: new URLSearchParams({ code: '' }) })).status, 401); ok('without a passcode nobody can get in');
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
const good = await post('dates-2027');
assert.equal(good.status, 303); assert.equal(good.headers.get('location'), '/en/shop/');
const cookie = good.headers.get('set-cookie')!.split(';')[0];
assert.ok(good.headers.get('set-cookie')!.includes('HttpOnly')); ok('right code sets a 30-day cookie and returns to the page');
const inside = await run('/en/', { headers: { cookie } });
assert.equal(await inside.text(), '<h1>shop</h1>'); assert.match(inside.headers.get('x-robots-tag')!, /noindex/); ok('with the cookie the site works, still noindex');
assert.equal((await post('dates-2027', '//evil.example')).headers.get('location'), '/'); ok('cannot redirect to another site');

process.env.PREVIEW_PASSWORD = 'new-code';
assert.notEqual(await (await run('/en/', { headers: { cookie } })).text(), '<h1>shop</h1>'); ok('changing the passcode signs everyone out');
console.log(`\n${pass} checks passed`);
