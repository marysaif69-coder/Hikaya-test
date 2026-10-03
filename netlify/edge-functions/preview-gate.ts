// Private preview, hidden by default. The owners decide who sees the website in Admin → Settings →
// "Who can see the website": the real website (hikayacoffee.ca) is hidden or open (locked: they type
// the domain to change it), the preview address needs the team code or is open to anyone with the
// link (never indexed). SITE_PUBLIC=true in Netlify also opens the real website. While hidden, every
// page and API call shows a "Coming soon" screen first, search engines are told not to index
// anything, and robots.txt blocks crawlers. The screen collects waitlist emails (the mailing list, with CASL
// consent and an email to confirm); only the sign-up, confirm and unsubscribe links get through.
// With PREVIEW_PASSWORD set, a "Team" box lets testers in; without it nobody gets in.
import { CONSENT } from '../lib/consent.ts';
import { BREWING_HTML } from '../lib/brewing-page.ts';

const COOKIE = 'hk_preview';
const DAYS = 30;

const env = (k: string): string => {
  const g = globalThis as any;
  try { const v = g.Netlify?.env?.get(k); if (v) return String(v); } catch { /* not on Netlify */ }
  try { const v = g.Deno?.env?.get(k); if (v) return String(v); } catch { /* no permission */ }
  return g.process?.env?.[k] ?? '';
};
// Codes are compared without surrounding spaces and without caring about capitals, so a stray
// space or a capital letter in Netlify or on a phone keyboard doesn't lock people out.
const norm = (v: string) => v.normalize('NFKC').trim().toLowerCase();

async function digest(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
const readCookie = (req: Request) => req.headers.get('cookie')?.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))?.[1] ?? '';
// Only send people back to a path on this site.
const safeNext = (v: unknown) => (typeof v === 'string' && /^\/(?!\/)[^\s]*$/.test(v) ? v : '/');

const NOINDEX = 'noindex, nofollow, noarchive';

// The owners' switch in Settings ("Who can see the website"), read from the site and kept for
// 20 seconds. If it cannot be read, the real website shows Something is brewing.
type State = { live: 'brewing' | 'hidden' | 'open'; preview: 'code' | 'open' };
let cached: { at: number; state: State } | null = null;
async function siteState(url: URL): Promise<State> {
  if (cached && Date.now() - cached.at < 20_000) return cached.state;
  let state: State = { live: 'brewing', preview: 'code' };
  try {
    const r = await fetch(new URL('/api/site-state', url.origin), { headers: { 'x-from-gate': '1' } });
    if (r.ok) { const d = await r.json(); state = { live: d.live === 'open' ? 'open' : d.live === 'hidden' ? 'hidden' : 'brewing', preview: d.preview === 'open' ? 'open' : 'code' }; }
  } catch { /* stay hidden */ }
  cached = { at: Date.now(), state };
  return state;
}
/** For tests. */
export const resetGateCache = () => { cached = null; };
// The real website: hikayacoffee.ca (and www), or SITE_URL when it is not a netlify.app address.
const isLive = (host: string) => {
  const h = host.toLowerCase().replace(/^www\./, '');
  let site = '';
  try { site = new URL(env('SITE_URL')).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* not set */ }
  return h === 'hikayacoffee.ca' || (Boolean(site) && !site.endsWith('.netlify.app') && h === site);
};

export default async (req: Request, context: { next: () => Promise<Response> }) => {
  const url = new URL(req.url);
  const live = isLive(url.hostname);
  if (live && env('SITE_PUBLIC').toLowerCase() === 'true') return context.next();
  const state = await siteState(url);
  if (live && state.live === 'open') return context.next();
  if (!live && (state.preview === 'open' || env('SITE_PUBLIC').toLowerCase() === 'true')) {
    // Open preview: anyone with the link, never in search engines.
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': NOINDEX } });
    const view = phaseView(url); if (view) return view;
    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set('x-robots-tag', NOINDEX);
    return out;
  }
  const password = norm(env('PREVIEW_PASSWORD'));

  // The cookie holds a hash of the passcode, so changing the passcode signs everyone out.
  const token = password ? await digest(`hikaya-preview:${password}`) : 'closed';

  if (url.pathname === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': NOINDEX } });
  }

  if (url.pathname === '/__preview' && req.method === 'POST') {
    const form = await req.formData().catch(() => null);
    const given = norm(String(form?.get('code') ?? ''));
    const next = safeNext(form?.get('next'));
    if (password && sameText(await digest(`hikaya-preview:${given}`), token)) {
      return new Response(null, { status: 303, headers: {
        location: next,
        'set-cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`,
        'cache-control': 'no-store',
      } });
    }
    await new Promise(r => setTimeout(r, 600)); // slow down guessing
    return gate(next, password ? 'wrong' : 'unset');
  }

  if (password && sameText(readCookie(req), token)) {
    const view = phaseView(url); if (view) return view;
    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set('x-robots-tag', NOINDEX);
    return out;
  }

  // The waitlist: joining, the confirm link from the email, and leaving the list.
  const listCall = (url.pathname === '/api/list' && req.method === 'POST') || (['/api/list/confirm', '/api/list/unsubscribe'].includes(url.pathname) && req.method === 'GET');
  if (listCall) {
    const res = await context.next();
    const loc = res.headers.get('location');
    // Their redirect goes to a thanks page that is still hidden: show the message here instead.
    if (loc && res.status >= 300 && res.status < 400) {
      const q = new URL(loc, url).searchParams;
      return new Response(null, { status: 303, headers: { location: `/?${q.has('unsub') ? 'unsub=1' : q.has('listexpired') ? 'listexpired=1' : 'list=1'}`, 'cache-control': 'no-store', 'x-robots-tag': NOINDEX } });
    }
    const out = new Response(res.body, res);
    out.headers.set('x-robots-tag', NOINDEX);
    return out;
  }

  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'preview', message: 'This site is in private preview.' }), { status: 401, headers: { 'content-type': 'application/json', 'x-robots-tag': NOINDEX, 'cache-control': 'no-store' } });
  }
  const note = url.searchParams.has('list') ? 'list' : url.searchParams.has('listexpired') ? 'expired' : url.searchParams.has('unsub') ? 'unsub' : '';
  // Team way in on the real website: /team shows the code box.
  if (url.pathname === '/team') return gate('/', 'ask', '', true);
  // Phase 0 on the real website: "Something is brewing" on every page.
  if (live && state.live === 'brewing' && !note) {
    return new Response(BREWING_HTML, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': NOINDEX } });
  }
  return gate(note ? '/' : url.pathname + url.search, 'ask', note);
};

// Team only: see a phase exactly as customers would (?phase=brewing or ?phase=soon), with a thin
// strip on top saying so. Nothing about the real website changes.
const TEAM_STRIP = (what: string) => `<style>body{padding-top:44px!important}</style><div style="position:fixed;top:0;left:0;right:0;z-index:99;background:#CF9C0C;color:#160E0A;font:600 13px/1.4 'IBM Plex Sans',system-ui,sans-serif;text-align:center;padding:6px 12px;direction:ltr">TEAM VIEW · ${what} as customers see it · nothing has changed on the real website · <a href="/en/" style="color:#160E0A">back to the site</a> · <a href="/admin/" style="color:#160E0A">Desk</a></div>`;
function phaseView(url: URL): Response | null {
  const p = url.searchParams.get('phase');
  if (p === 'brewing') return new Response(BREWING_HTML.replace('<body>', '<body>' + TEAM_STRIP('Phase 0, Something is brewing,')), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': NOINDEX } });
  if (p === 'soon') return gate('/', 'ask', '', false, TEAM_STRIP('Phase 1, Coming soon + waitlist,'));
  return null;
}

const NOTES: Record<string, [string, string]> = {
  list: ['تمّ، أنت في القائمة. نكتب لك حين يفتح الطلب المسبق.', 'Done, you are on the list. We will write when pre-orders open.'],
  expired: ['انتهت صلاحية هذا الرابط أو استُخدم من قبل. سجّل مرة أخرى بالأسفل.', 'That link has expired or was already used. Sign up again below.'],
  unsub: ['ألغينا اشتراكك، ولن نراسلك بعد الآن.', 'You are off the list. We will not email you again.'],
};

function gate(next: string, state: 'ask' | 'wrong' | 'unset', note = '', team = false, strip = '') {
  const wrong = state !== 'ask' || team;
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${NOINDEX}">
<title>حكاية · Hikaya</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  @font-face { font-family: 'El Messiri'; font-weight: 700; font-display: swap; src: url('/fonts/ElMessiri-700-arabic.woff2') format('woff2'); unicode-range: U+0600-06FF, U+FE70-FEFF; }
  @font-face { font-family: 'El Messiri'; font-weight: 700; font-display: swap; src: url('/fonts/ElMessiri-700-latin.woff2') format('woff2'); unicode-range: U+0000-00FF; }
  @font-face { font-family: 'IBM Plex Sans Arabic'; font-weight: 400; font-display: swap; src: url('/fonts/IBMPlexSansArabic-400-arabic.woff2') format('woff2'); }
  @font-face { font-family: 'IBM Plex Sans'; font-weight: 400; font-display: swap; src: url('/fonts/IBMPlexSans-400-latin.woff2') format('woff2'); }
  @font-face { font-family: 'IBM Plex Sans'; font-weight: 600; font-display: swap; src: url('/fonts/IBMPlexSans-600-latin.woff2') format('woff2'); }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body { min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; background: #F2EBE1 url('/brand/pattern.svg'); background-size: 186px 168px; color: #33211A; font: 400 17px/1.55 'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif; }
  main { width: min(420px, 100%); background: #FBF8F1; border-radius: 32px; border-bottom-left-radius: 8px; padding: 34px 28px 28px; display: grid; gap: 18px; justify-items: center; text-align: center; box-shadow: 0 30px 60px -30px rgba(51,33,26,.45), inset 0 0 0 1px #DFD1BA; }
  .lockup { display: grid; justify-items: center; gap: 6px; direction: ltr; }
  .lockup img { width: min(300px, 100%); height: auto; }
  .lockup b { font: 700 34px/1 'El Messiri', serif; }
  .lockup small { font: 600 10px/1 'IBM Plex Sans', sans-serif; letter-spacing: .44em; padding-left: .44em; color: #66503F; }
  .say { font: 700 22px/1.35 'El Messiri', serif; margin: 0; }
  .say span { display: block; font: 400 15px/1.4 'IBM Plex Sans', sans-serif; color: #66503F; margin-top: 4px; direction: ltr; }
  form { width: 100%; display: grid; gap: 10px; }
  label { font-size: 14px; color: #66503F; }
  input { width: 100%; font: inherit; font-size: 18px; text-align: center; letter-spacing: .08em; padding: 13px 16px; border-radius: 16px; border: 1.5px solid #DFD1BA; background: #fff; color: #33211A; direction: ltr; }
  input:focus { outline: none; border-color: #33211A; box-shadow: 0 0 0 4px rgba(207,156,12,.35); }
  button { font: 600 16px/1.2 'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif; border: 0; border-radius: 999px; border-bottom-right-radius: 6px; padding: 15px 22px; background: #33211A; color: #F5EFE3; cursor: pointer; }
  button:hover { background: #4A3127; }
  .err { color: #8E2F1F; font-weight: 600; font-size: 15px; margin: 0; }
  .foot { font-size: 13px; color: #66503F; margin: 0; }
  .lead { margin: 0; color: #33211A; font-size: 16px; }
  .lead span { display: block; direction: ltr; color: #66503F; font-size: 15px; margin-top: 2px; }
  .wl { text-align: start; }
  .langs { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; border: 0; padding: 0; margin: 0; }
  .langs label { display: inline-flex; gap: 6px; align-items: center; border: 1.5px solid #DFD1BA; border-radius: 999px; padding: 7px 14px; background: #fff; cursor: pointer; font-size: 15px; color: #33211A; }
  .langs input { width: auto; accent-color: #33211A; }
  .consent { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: start; font-size: 13px; line-height: 1.45; color: #66503F; text-align: start; }
  .consent input { width: 20px; height: 20px; margin: 2px 0 0; accent-color: #33211A; padding: 0; }
  .consent span span { display: block; direction: ltr; margin-top: 4px; }
  .msg { margin: 0; font-weight: 600; font-size: 15px; color: #33211A; background: #F4E6BF; border-radius: 14px; padding: 10px 14px; }
  .msg span { display: block; direction: ltr; font-weight: 400; margin-top: 2px; }
  .msg[hidden] { display: none; }
  details { width: 100%; font-size: 14px; color: #66503F; }
  details summary { cursor: pointer; list-style: none; text-decoration: underline; }
  details summary::-webkit-details-marker { display: none; }
  details form { margin-top: 10px; }
  .wl input[type=email] { letter-spacing: 0; }
  .foot a { color: #A93B28; font-weight: 600; }
</style>
</head>
<body>${strip}
<main>
  <div class="lockup"><img src="/brand/lockup.svg" alt="حكاية · Hikaya" width="300" height="55"></div>
  <p class="say">قريباً في كالغاري.<span>Coming soon to Calgary.</span></p>
  ${note ? `<p class="msg" role="status">${NOTES[note][0]}<span>${NOTES[note][1]}</span></p>` : ''}
  <p class="lead">قهوة وتمر للمائدة. اترك بريدك ونخبرك حين يفتح الطلب المسبق.<span>Coffee and dates for the table. Leave your email and we will tell you when pre-orders open.</span></p>
  <form class="wl" id="wl" novalidate>
    <label for="wl-e">بريدك الإلكتروني · Your email</label>
    <input id="wl-e" name="email" type="email" inputmode="email" autocomplete="email" required>
    <fieldset class="langs"><legend class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">Language of the emails</legend>
      <label><input type="radio" name="lang" value="ar" checked> بالعربية</label><label><input type="radio" name="lang" value="en"> In English</label></fieldset>
    <label class="consent"><input type="checkbox" name="consent" required><span>${CONSENT.ar}<span>${CONSENT.en}</span></span></label>
    <button type="submit">أخبروني · Tell me</button>
    <p class="msg" id="wl-msg" role="status" hidden></p>
  </form>
  <details${wrong ? ' open' : ''}><summary>للفريق · Team</summary>
  <form method="post" action="/__preview">
    <label for="code">رمز المعاينة · Preview code</label>
    <input id="code" name="code" type="password" autocomplete="current-password" required${wrong ? ' autofocus' : ''}>
    <input type="hidden" name="next" value="${esc(next)}">
    ${state === 'wrong' ? '<p class="err" role="alert">الرمز غير صحيح · That code is not right.</p>' : ''}
    ${state === 'unset' ? '<p class="err" role="alert">The site has no preview code yet. In Netlify, add PREVIEW_PASSWORD (scopes: All, or include Functions), then redeploy.</p>' : ''}
    <button type="submit">ادخل · Enter</button>
  </form>
  </details>
  <p class="foot">وللحكاية بقية · <a href="https://www.instagram.com/hikaya.yyc/" rel="noopener" dir="ltr">@hikaya.yyc</a></p>
</main>
<script>
  (function () {
    var f = document.getElementById('wl'), m = document.getElementById('wl-msg');
    if (!/^ar/i.test(navigator.language || '')) { var en = f.querySelector('input[value=en]'); if (en) en.checked = true; }
    var say = function (ar, en) { m.innerHTML = ''; m.append(ar); var s = document.createElement('span'); s.textContent = en; m.append(s); m.hidden = false; };
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = f.email.value.trim(), lang = (f.querySelector('input[name=lang]:checked') || {}).value || 'ar';
      if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return say('اكتب بريداً صحيحاً.', 'Type a valid email.');
      if (!f.consent.checked) return say('ضع علامة في المربع لنستطيع مراسلتك.', 'Tick the box so we can write to you.');
      var b = f.querySelector('button'); b.disabled = true;
      fetch('/api/list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email, lang: lang, consent: true, source: 'soon' }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (!x.ok) return say('لم ينجح ذلك. حاول مرة أخرى بعد قليل.', (x.d && x.d.message) || 'That did not work. Try again in a moment.');
          if (x.d.already) return say('أنت في القائمة من قبل.', 'You are already on the list.');
          f.reset(); say('بقيت خطوة: افتح بريدك واضغط على رابط التأكيد.', 'One more step: open your email and press the confirm link.');
        })
        .catch(function () { say('لم ينجح ذلك. حاول مرة أخرى بعد قليل.', 'That did not work. Try again in a moment.'); })
        .finally(function () { b.disabled = false; });
    });
  })();
</script>
</body>
</html>`;
  return new Response(html, { status: state !== 'ask' ? 401 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': NOINDEX, 'cache-control': 'no-store' } });
}

// Everything except what the passcode page itself needs, and Square's payment webhook.
export const config = {
  path: '/*',
  excludedPath: ['/brand/*', '/fonts/*', '/favicon.svg', '/api/square/webhook', '/api/site-state'],
};
