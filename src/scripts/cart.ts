// A small client cart kept in localStorage. Pre-orders only: the checkout form sends it to Netlify Forms.

export type Line = { id: string; opt: string; qty: number };
type Item = { n: { en: string; ar: string }; price: number; kind: string; img: string | null; opts: Record<string, { en: string; ar: string }> | null };
type Catalog = { lang: 'en' | 'ar'; cart: string; added: string; add: string; items: Record<string, Item> };

const KEY = 'hikaya-cart-v1';

export const catalog = (): Catalog => JSON.parse(document.getElementById('catalog')!.textContent || '{}');

export function read(): Line[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function write(lines: Line[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* private mode: cart lives for this page only */ }
  document.dispatchEvent(new CustomEvent('cart:change', { detail: lines }));
  paintCount();
}
export function add(id: string, opt = '', qty = 1) {
  const lines = read();
  const hit = lines.find(l => l.id === id && l.opt === opt);
  if (hit) hit.qty = Math.min(20, hit.qty + qty); else lines.push({ id, opt, qty });
  write(lines);
}
export function setQty(i: number, qty: number) {
  const lines = read();
  if (!lines[i]) return;
  if (qty <= 0) lines.splice(i, 1); else lines[i].qty = Math.min(20, qty);
  write(lines);
}
export const clear = () => write([]);

export function totals(lines = read(), delivery = false) {
  const cat = catalog().items;
  const sub = lines.reduce((s, l) => s + (cat[l.id]?.price ?? 0) * l.qty, 0);
  const fee = delivery && sub > 0 && sub < 80 ? 9 : 0;
  return { sub, fee, total: sub + fee, count: lines.reduce((s, l) => s + l.qty, 0) };
}

export function describe(l: Line, lang: 'en' | 'ar') {
  const it = catalog().items[l.id];
  if (!it) return { name: l.id, opt: '', price: 0 };
  return { name: it.n[lang], opt: l.opt && it.opts?.[l.opt] ? it.opts[l.opt][lang] : '', price: it.price };
}

function paintCount() {
  const n = document.getElementById('cartN');
  if (!n) return;
  n.textContent = String(totals().count);
  const b = document.getElementById('cartBtn');
  b?.classList.remove('bump'); void b?.offsetWidth; b?.classList.add('bump');
}

export function initCart() {
  paintCount();
  const { added } = catalog();
  document.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-add]');
    if (!btn) return;
    const ids = btn.dataset.add!.split(',');
    const opts = (btn.dataset.opt ?? '').split(',');
    const formOpt = btn.form ? new FormData(btn.form).get('opt') : null;
    const qty = btn.form ? Number(new FormData(btn.form).get('qty') || 1) : 1;
    ids.forEach((id, i) => add(id, (i === 0 && formOpt ? String(formOpt) : opts[i]) || '', qty));
    const label = btn.querySelector('span');
    const prev = label?.textContent;
    btn.classList.add('done');
    if (label) label.textContent = added;
    setTimeout(() => { btn.classList.remove('done'); if (label && prev) label.textContent = prev; }, 1600);
  });
}
