// Words, recipes and product descriptions, edited in the desk (Admin → Shop → Words). The text lives in
// src/content/*.json in the GitHub repository; saving writes the file there, which makes Netlify
// rebuild the site (about two minutes). Needs GITHUB_CONTENT_TOKEN: a fine-grained GitHub token
// for this one repository with "Contents: read and write". The token never leaves the server.
import { HttpError, env } from './http';
import PRODUCTS_TEXT from '../../src/content/products.json';
import RECIPES from '../../src/content/recipes.json';
import DRIVER_GUIDE from '../../src/content/driver-guide.json';

export const FILES = {
  recipes: { path: 'src/content/recipes.json', label: 'Recipes (brew guides)', built: RECIPES as unknown },
  products: { path: 'src/content/products.json', label: 'Product names and descriptions', built: PRODUCTS_TEXT as unknown },
  'driver-guide': { path: 'src/content/driver-guide.json', label: 'Driver guide', built: DRIVER_GUIDE as unknown },
} as const;
export type FileId = keyof typeof FILES;

const repo = () => env('GITHUB_REPO') || 'marysaif69-coder/Hikaya-test';
const branch = () => env('GITHUB_BRANCH') || 'claude/frontend-design-skills-setup-2e6lwc';
export const canSave = () => Boolean(env('GITHUB_CONTENT_TOKEN'));

async function gh(path: string, init: RequestInit = {}) {
  const r = await fetch(`https://api.github.com/repos/${repo()}/contents/${path}`, { ...init, headers: {
    authorization: `Bearer ${env('GITHUB_CONTENT_TOKEN')}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'hikaya-desk', ...(init.body ? { 'content-type': 'application/json' } : {}),
  } });
  const body: any = await r.json().catch(() => ({}));
  if (r.status === 409 || r.status === 422) throw new HttpError(409, 'changed', 'Someone else saved this text a moment ago. Reload and make your change again.');
  if (r.status === 401 || r.status === 403 || r.status === 404) throw new HttpError(502, 'github', 'GitHub refused the save. Check GITHUB_CONTENT_TOKEN in Netlify (it needs Contents: read and write on this repository).');
  if (!r.ok) throw new HttpError(502, 'github', body.message ?? 'GitHub did not answer.');
  return body;
}

/** The newest saved text (from GitHub when connected, otherwise what this deploy was built with). */
export async function readContent(id: FileId) {
  const f = Object.hasOwn(FILES, id) ? FILES[id] : null;
  if (!f) throw new HttpError(404, 'not-found');
  if (!canSave()) return { data: f.built, sha: null, canSave: false, label: f.label };
  const r = await gh(`${f.path}?ref=${encodeURIComponent(branch())}`);
  return { data: JSON.parse(Buffer.from(r.content, 'base64').toString('utf8')), sha: r.sha as string, canSave: true, label: f.label };
}

/** Takes only the text the file already has: same products, same steps, words and step times. */
export function mergeText(orig: unknown, given: unknown, at = ''): unknown {
  if (typeof orig === 'string') {
    if (typeof given !== 'string' || !given.trim()) throw new HttpError(400, 'empty', `This text can't be empty: ${at}`);
    if (given.length > 3000) throw new HttpError(400, 'long', `Too long: ${at}`);
    return given.trim().replace(/\r\n/g, '\n');
  }
  if (typeof orig === 'number') {
    const n = Number(given);
    if (!Number.isFinite(n) || n < 0 || n > 86400) throw new HttpError(400, 'number', `Check the number: ${at}`);
    return Math.round(n);
  }
  if (Array.isArray(orig)) {
    if (!Array.isArray(given) || given.length !== orig.length) throw new HttpError(400, 'shape', `The list changed: ${at}`);
    return orig.map((o, i) => mergeText(o, given[i], `${at}[${i + 1}]`));
  }
  if (orig && typeof orig === 'object') {
    if (!given || typeof given !== 'object') throw new HttpError(400, 'shape', `Missing: ${at}`);
    return Object.fromEntries(Object.entries(orig).map(([k, v]) => [k, mergeText(v, (given as any)[k], at ? `${at}.${k}` : k)]));
  }
  return orig;
}

export async function saveContent(id: FileId, given: unknown, sha: string, actor: string) {
  if (!canSave()) throw new HttpError(400, 'not-connected', 'Saving needs GITHUB_CONTENT_TOKEN in Netlify.');
  const cur = await readContent(id);
  if (cur.sha !== sha) throw new HttpError(409, 'changed', 'Someone else saved this text a moment ago. Reload and make your change again.');
  const data = mergeText(cur.data, given);
  if (JSON.stringify(data) === JSON.stringify(cur.data)) return { saved: false };
  const r = await gh(FILES[id].path, { method: 'PUT', body: JSON.stringify({
    message: `Text edited in the desk: ${FILES[id].label} (by ${actor})`,
    content: Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64'), sha, branch: branch(),
  }) });
  return { saved: true, sha: r.content?.sha as string };
}
