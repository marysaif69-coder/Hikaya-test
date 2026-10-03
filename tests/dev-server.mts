// Local stand-in for Netlify: serves dist/ and routes /api/* to the real function handlers,
// backed by an in-memory Postgres (PGlite) with the real migration. Emails are captured.
// Run: npx tsx tests/dev-server.mts   (then open http://localhost:8888)
import { PGlite } from '@electric-sql/pglite';
import http from 'node:http';
import fs from 'node:fs';
import p from 'node:path';
import { setSql } from '../netlify/lib/db';

process.env.ADMIN_EMAILS ||= 'maryam@hikayacoffee.ca';
process.env.RESEND_API_KEY ||= 'local';
process.env.SITE_URL ||= 'http://localhost:8888';
const PORT = Number(process.env.PORT || 8888);

const pg = new PGlite();
for (const dir of fs.readdirSync('netlify/database/migrations').sort()) await pg.exec(fs.readFileSync(`netlify/database/migrations/${dir}/migration.sql`, 'utf8'));
setSql(((s: TemplateStringsArray, ...v: unknown[]) => pg.sql(s, ...v).then(r => r.rows)) as any);

export const outbox: any[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).includes('api.resend.com')) { const m = JSON.parse(init.body); outbox.push(m); fs.writeFileSync('/tmp/hikaya-outbox.json', JSON.stringify(outbox, null, 1)); return new Response('{}', { status: 200 }); }
  return realFetch(url, init);
}) as any;

// ASK_FAKE=1: Ask Hikaya answers from a tiny script instead of the real model (for UI testing).
if (process.env.ASK_FAKE) {
  process.env.ANTHROPIC_API_KEY = 'fake';
  const { setCreate } = await import('../netlify/lib/ask');
  const msg = (content: any[], stop = 'end_turn') => ({ id: 'f', type: 'message', role: 'assistant', model: 'fake', stop_reason: stop, content, usage: {} }) as any;
  setCreate(async (params: any) => {
    const last = params.messages.at(-1);
    if (Array.isArray(last.content) && last.content[0]?.type === 'tool_result') {
      const r = JSON.parse(last.content[0].content);
      return msg([{ type: 'text', text: r.request_number ? `I have sent this to the team as ${r.request_number}. They reply by email, usually within one day. You can add a photo of the item and the packaging below.` : 'Done. They are in your cart; choose pickup or delivery and the day at checkout: /en/checkout/' }]);
    }
    const text = String(last.content);
    if (/crush|damag|تالف|broken/i.test(text)) return msg([{ type: 'tool_use', id: 't1', name: 'open_request', input: { kind: 'damaged', name: 'Layla', email: 'layla@example.com', phone: null, order_ref: null, summary: 'Item arrived damaged', details: text } }], 'tool_use');
    if (/add|أضف/i.test(text)) return msg([{ type: 'tool_use', id: 't2', name: 'add_to_cart', input: { items: [{ product_id: 'najdi', option: 'dallah', qty: 2 }] } }], 'tool_use');
    return msg([{ type: 'text', text: /[\u0600-\u06FF]/.test(text) ? 'أهلاً. جرّب النجدية: فاتحة وذهبية، الهيل أولاً ولمسة زعفران. ومعها تمرة خلاص. التفاصيل في /ar/shop/najdi/' : 'Start with Najdi: light and golden, cardamom first with a touch of saffron. Have it with a Khalas date.\n\nMore on /en/shop/najdi/ and how to brew it on /en/brew/.' }]);
  });
}

const fns: { paths: string[]; handler: any }[] = [];
for (const f of fs.readdirSync('netlify/functions')) {
  const mod = await import(p.resolve('netlify/functions', f));
  const path = mod.config?.path; if (!path) continue;
  fns.push({ paths: Array.isArray(path) ? path : [path], handler: mod.default });
}
const match = (pattern: string, path: string) => pattern.endsWith('/*') ? path.startsWith(pattern.slice(0, -1)) : pattern === path;
const types: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);
  const fn = fns.find(f => f.paths.some(pt => match(pt, url.pathname)));
  if (fn) {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
    const r: Response = await fn.handler(new Request(url, { method: req.method, headers: req.headers as any, body: ['GET', 'HEAD'].includes(req.method!) ? undefined : Buffer.concat(chunks) }), {});
    const headers: Record<string, string> = {}; r.headers.forEach((v, k) => { headers[k] = v; });
    // Local http: drop Secure so the browser keeps the cookie.
    if (headers['set-cookie']) headers['set-cookie'] = headers['set-cookie'].replace('; Secure', '');
    res.writeHead(r.status, headers); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let f = p.join('dist', decodeURIComponent(url.pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = p.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': types[p.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));
