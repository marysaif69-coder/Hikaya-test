// Browser test of the whole order system against tests/dev-server.mts (must be running on :8888).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const B = 'http://localhost:8888', OUT = '.impeccable/review/e2e';
fs.mkdirSync(OUT, { recursive: true });
const outbox = () => JSON.parse(fs.readFileSync('/tmp/hikaya-outbox.json', 'utf8'));
const lastCode = to => outbox().filter(m => m.to[0] === to && /login code|رمز/.test(m.subject)).at(-1).text.match(/\b\d{6}\b/)[0];
const b = await chromium.launch(); const errs = [];
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => sessionStorage.setItem('hikaya-intro', '1'));
const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
const step = m => console.log('  ✓', m);

// 1. shop → cart
await pg.goto(B + '/en/shop/najdi/'); await pg.click('.buy [data-add]'); await pg.waitForTimeout(400); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
await pg.click('.pour-with [data-add]'); await pg.waitForTimeout(300); await pg.keyboard.press('Escape');
step('added Najdi + Khalas date box');
// 2. checkout as guest, Calgary delivery
await pg.goto(B + '/en/checkout/'); await pg.waitForSelector('#f-day option[value="2027-01-22"]', { state: 'attached' });
await pg.fill('#f-name', 'Layla Haddad'); await pg.fill('#f-phone', '403 555 0100'); await pg.fill('#f-email', 'layla@example.com');
await pg.check('input[name=method][value=delivery]', { force: true }); await pg.fill('#f-street', '1 Stephen Ave SW'); await pg.fill('#f-postal', 't2p1j9');
await pg.selectOption('#f-day', '2027-01-22'); await pg.check('input[name=window][value="14:00–17:00"]', { force: true });
await pg.check('input[name=payment][value=e-transfer]', { force: true });
await pg.screenshot({ path: OUT + '/1-checkout.png', fullPage: true });
await Promise.all([pg.waitForURL(/thanks/), pg.click('.submit')]);
const ref = new URL(pg.url()).searchParams.get('order');
step(`order placed as guest: ${ref}`);
await pg.screenshot({ path: OUT + '/2-thanks.png' });
console.log('    cart after order:', await pg.evaluate(() => localStorage.getItem('hikaya-cart-v1')));
const custMail = outbox().find(m => m.to[0] === 'layla@example.com' && m.subject.includes(ref));
fs.writeFileSync(OUT + '/email-received.html', custMail.html);
step('customer email: ' + custMail.subject);
step('team alerts: ' + outbox().filter(m => m.subject.startsWith('New order')).length);
// 3. guest follows the order from the thank-you page
await pg.click('#follow'); await pg.waitForSelector('.ord'); await pg.screenshot({ path: OUT + '/3-guest-order.png', fullPage: true });
step('guest link shows the order without login');
// 4. log in with emailed code
await pg.goto(B + '/en/account/'); await pg.fill('#lg-e', 'layla@example.com'); await pg.click('.lg [type=submit]'); await pg.waitForSelector('#lg-c:visible');
await pg.screenshot({ path: OUT + '/4-code.png' });
await pg.fill('#lg-c', lastCode('layla@example.com')); await pg.waitForSelector('.ord');
await pg.screenshot({ path: OUT + '/5-account.png', fullPage: true });
step('customer logged in, sees ' + await pg.locator('.ord').count() + ' order(s)');

// 5. admin
const actx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const ad = await actx.newPage(); ad.on('pageerror', e => errs.push(e.message));
await ad.goto(B + '/admin/'); await ad.fill('#lg-e', 'maryam@hikayacoffee.ca'); await ad.click('.lg [type=submit]'); await ad.waitForSelector('#lg-c:visible');
await ad.fill('#lg-c', lastCode('maryam@hikayacoffee.ca')); await ad.waitForSelector('#list tbody tr');
await ad.screenshot({ path: OUT + '/6-admin-orders.png' });
step('admin desk lists ' + await ad.locator('#list tbody tr').count() + ' order(s)');
await ad.click(`#list tr[data-ref="${ref}"]`); await ad.waitForSelector('#panel.on'); await ad.waitForTimeout(400);
await ad.screenshot({ path: OUT + '/7-admin-panel.png' });
await ad.click('#pBody [data-status=confirmed]'); await ad.waitForTimeout(500);
await ad.click('#pBody [data-pay=paid]'); await ad.waitForTimeout(500);
const conf = outbox().find(m => m.subject === `Order ${ref} is confirmed`);
step('confirmed → customer emailed: ' + Boolean(conf));
fs.writeFileSync(OUT + '/email-confirmed.html', conf.html);
await ad.keyboard.press('Escape'); await ad.waitForTimeout(300);
await ad.click('#tabs [data-tab=day]'); await ad.fill('#dayPick', '2027-01-22'); await ad.dispatchEvent('#dayPick', 'change'); await ad.waitForTimeout(600);
await ad.screenshot({ path: OUT + '/8-day-sheet.png' });
step('day sheet shows deliveries: ' + await ad.locator('#deliveries li').count());
// 6. customer sees the new status
await pg.reload(); await pg.waitForSelector('.ord'); 
step('customer now sees: ' + await pg.locator('.steps li.now').innerText() + ' · ' + await pg.locator('.pay').innerText());
// 7. Arabic account page
const ar = await ctx.newPage(); await ar.goto(B + '/ar/account/'); await ar.waitForSelector('.ord'); await ar.screenshot({ path: OUT + '/9-account-ar.png', fullPage: true });
step('Arabic account page renders');
console.log('page errors:', errs);
await b.close();
