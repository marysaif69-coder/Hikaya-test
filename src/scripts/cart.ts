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

const money = (n: number, lang: 'en' | 'ar') => (lang === 'ar' ? `${n} $` : `$${n}`);

/** Slide-in cart: opens on add, shows progress to free delivery. */
function paintDrawer() {
  const { lang, items } = catalog();
  const lines = read();
  const { sub } = totals(lines);
  const list = document.getElementById('drLines');
  if (!list) return;
  list.innerHTML = '';
  if (!lines.length) {
    const li = document.createElement('li'); li.className = 'dr-empty';
    li.textContent = lang === 'ar' ? 'السلة فارغة.' : 'Your cart is empty.';
    list.append(li);
  }
  lines.forEach((l, i) => {
    const d = describe(l, lang);
    const li = document.createElement('li');
    li.innerHTML = `<span class="th"></span><div><div class="nm"></div><div class="op"></div><div class="q"><button type="button" data-d="-1" aria-label="${lang === 'ar' ? 'أنقص' : 'Less'}">−</button><span class="tnum">${l.qty}</span><button type="button" data-d="1" aria-label="${lang === 'ar' ? 'زد' : 'More'}">+</button></div></div><span class="lp tnum">${money(d.price * l.qty, lang)}</span>`;
    const img = items[l.id]?.img;
    (li.querySelector('.th') as HTMLElement).style.backgroundImage = `url(${img ?? '/brand/logo.svg'})`;
    if (!img) (li.querySelector('.th') as HTMLElement).style.backgroundSize = '70%';
    li.querySelector('.nm')!.textContent = d.name;
    li.querySelector('.op')!.textContent = d.opt;
    li.querySelectorAll<HTMLButtonElement>('[data-d]').forEach(b => b.addEventListener('click', () => { setQty(i, l.qty + Number(b.dataset.d)); paintDrawer(); }));
    list.append(li);
  });
  document.getElementById('drSub')!.textContent = money(sub, lang);
  const left = Math.max(0, 80 - sub);
  document.getElementById('drFree')!.textContent = left === 0
    ? (lang === 'ar' ? 'التوصيل داخل كالغاري مجاني لهذا الطلب.' : 'Free Calgary delivery on this order.')
    : (lang === 'ar' ? `أضف ${left} $ ليصبح التوصيل مجاناً.` : `Add $${left} for free Calgary delivery.`);
  (document.getElementById('drBar') as HTMLElement).style.width = `${Math.min(100, (sub / 80) * 100)}%`;
}

let lastFocus: HTMLElement | null = null;
export function openDrawer() {
  const dr = document.getElementById('drawer'), sc = document.getElementById('scrim');
  if (!dr || !sc) return;
  paintDrawer();
  lastFocus = document.activeElement as HTMLElement;
  sc.hidden = false; dr.removeAttribute('inert'); dr.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => { sc.classList.add('on'); dr.classList.add('on'); });
  (document.getElementById('drClose') as HTMLElement).focus({ preventScroll: true });
}
export function closeDrawer() {
  const dr = document.getElementById('drawer'), sc = document.getElementById('scrim');
  if (!dr || !sc || !dr.classList.contains('on')) return;
  dr.classList.remove('on'); sc.classList.remove('on');
  dr.setAttribute('aria-hidden', 'true'); dr.setAttribute('inert', '');
  setTimeout(() => { sc.hidden = true; }, 300);
  lastFocus?.focus({ preventScroll: true });
}

export function initCart() {
  paintCount();
  document.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-add]');
    if (!btn) return;
    const ids = btn.dataset.add!.split(',');
    const opts = (btn.dataset.opt ?? '').split(',');
    const formOpt = btn.form ? new FormData(btn.form).get('opt') : null;
    const qty = btn.form ? Number(new FormData(btn.form).get('qty') || 1) : 1;
    ids.forEach((id, i) => add(id, (i === 0 && formOpt ? String(formOpt) : opts[i]) || '', qty));
    openDrawer();
  });
  document.getElementById('drClose')?.addEventListener('click', closeDrawer);
  document.getElementById('scrim')?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
}
