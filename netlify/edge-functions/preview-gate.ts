// Private preview. While PREVIEW_PASSWORD is set in Netlify, every page and API call asks for
// the passcode first, search engines are told not to index anything, and robots.txt blocks
// crawlers. To open the site to everyone: delete PREVIEW_PASSWORD and redeploy.

const COOKIE = 'hk_preview';
const DAYS = 30;

const env = (k: string): string => (globalThis as any).Netlify?.env?.get(k) ?? (globalThis as any).process?.env?.[k] ?? '';

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

export default async (req: Request, context: { next: () => Promise<Response> }) => {
  const password = env('PREVIEW_PASSWORD');
  if (!password) return context.next();

  const url = new URL(req.url);
  // The cookie holds a hash of the passcode, so changing the passcode signs everyone out.
  const token = await digest(`hikaya-preview:${password}`);

  if (url.pathname === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': NOINDEX } });
  }

  if (url.pathname === '/__preview' && req.method === 'POST') {
    const form = await req.formData().catch(() => null);
    const given = String(form?.get('code') ?? '').trim();
    const next = safeNext(form?.get('next'));
    if (sameText(await digest(`hikaya-preview:${given}`), token)) {
      return new Response(null, { status: 303, headers: {
        location: next,
        'set-cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`,
        'cache-control': 'no-store',
      } });
    }
    await new Promise(r => setTimeout(r, 600)); // slow down guessing
    return gate(next, true);
  }

  if (sameText(readCookie(req), token)) {
    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set('x-robots-tag', NOINDEX);
    return out;
  }

  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'preview', message: 'This site is in private preview.' }), { status: 401, headers: { 'content-type': 'application/json', 'x-robots-tag': NOINDEX, 'cache-control': 'no-store' } });
  }
  return gate(url.pathname + url.search, false);
};

function gate(next: string, wrong: boolean) {
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
  .lockup img { width: 76px; height: auto; }
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
  .foot a { color: #A93B28; font-weight: 600; }
</style>
</head>
<body>
<main>
  <div class="lockup"><img src="/brand/logo.svg" alt="" width="76" height="64"><b>حكاية</b><small>HIKAYA</small></div>
  <p class="say">قريباً في كالغاري.<span>Coming soon to Calgary.</span></p>
  <form method="post" action="/__preview">
    <label for="code">رمز المعاينة · Preview code</label>
    <input id="code" name="code" type="password" autocomplete="current-password" required autofocus>
    <input type="hidden" name="next" value="${esc(next)}">
    ${wrong ? '<p class="err" role="alert">الرمز غير صحيح · That code is not right.</p>' : ''}
    <button type="submit">ادخل · Enter</button>
  </form>
  <p class="foot">وللحكاية بقية · <a href="https://www.instagram.com/hikaya.yyc/" rel="noopener" dir="ltr">@hikaya.yyc</a></p>
</main>
</body>
</html>`;
  return new Response(html, { status: wrong ? 401 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': NOINDEX, 'cache-control': 'no-store' } });
}

// Everything except what the passcode page itself needs, and Square's payment webhook.
export const config = {
  path: '/*',
  excludedPath: ['/brand/*', '/fonts/*', '/favicon.svg', '/api/square/webhook'],
};
