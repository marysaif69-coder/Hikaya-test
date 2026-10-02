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

const fns: { paths: string[]; handler: any }[] = [];
for (const f of fs.readdirSync('netlify/functions')) {
  const mod = await import(p.resolve('netlify/functions', f));
  const path = mod.config?.path; if (!path) continue;
  fns.push({ paths: Array.isArray(path) ? path : [path], handler: mod.default });
}
const match = (pattern: string, path: string) => pattern.endsWith('/*') ? path.startsWith(pattern.slice(0, -1)) : pattern === path;
const types: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };

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
