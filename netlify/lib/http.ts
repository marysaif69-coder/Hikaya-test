// Small helpers shared by every API function.

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export const fail = (e: unknown) => {
  if (e instanceof HttpError) return json({ error: e.code, message: e.message, fields: (e as any).fields }, e.status);
  console.error(e);
  return json({ error: 'server', message: 'Something went wrong on our side.' }, 500);
};

/** JSON body, size-limited, from a same-origin request (blocks cross-site form posts). */
export async function body<T = any>(req: Request): Promise<T> {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(req.url).host) throw new HttpError(403, 'origin');
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) throw new HttpError(415, 'json');
  const text = await req.text();
  if (text.length > 20_000) throw new HttpError(413, 'too-large');
  try { return JSON.parse(text) as T; } catch { throw new HttpError(400, 'bad-json'); }
}

export const cookie = (req: Request, name: string) => {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

export const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
export const env = (k: string) => (globalThis as any).Netlify?.env?.get(k) ?? process.env[k] ?? '';
export const siteUrl = (req?: Request) => env('SITE_URL') || env('URL') || (req ? new URL(req.url).origin : 'https://hikayacoffee.ca');
