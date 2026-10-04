// A small client cart kept in localStorage. Pre-orders only: the checkout form sends it to Netlify Forms.

export type Line = { id: string; opt: string; qty: number };
type T = { en: string; ar: string };
type Item = { n: T; price: number | null; kind: string; img: string | null; opts: Record<string, T> | null; base?: string; inside?: T; for?: string; bases?: string[] };
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
  // Prices arrive as dollars with cents: round once so sums never show as 15.399999…
  const sub = Math.round(lines.reduce((s, l) => s + (cat[l.id]?.price ?? 0) * l.qty, 0) * 100) / 100;
  // An item whose price is not set yet can't be ordered; the server refuses it too.
  const unpriced = lines.filter(l => cat[l.id] && cat[l.id].price == null).length;
  const fee = delivery && sub > 0 && sub < 80 ? 9 : 0;
  return { sub, fee, total: sub + fee, count: lines.reduce((s, l) => s + l.qty, 0), unpriced };
}

export function describe(l: Line, lang: 'en' | 'ar') {
  const it = catalog().items[l.id];
  if (!it) return { name: l.id, opt: '', price: 0, priced: false };
  const grind = l.opt && it.opts?.[l.opt] ? it.opts[l.opt][lang] : '';
  // A style says what is in it: "Gulf coffee 250 g + Saffron packet".
  const opt = [it.inside?.[lang], grind].filter(Boolean).join(' · ');
  return { name: it.n[lang], opt, price: it.price ?? 0, priced: it.price != null };
}

/** Gentle notes for the cart: a pack with no bag it is made for, or a blend without its saffron. */
export function advice(lines = read(), lang: 'en' | 'ar' = 'en') {
  const cat = catalog().items, ar = lang === 'ar';
  const bases = new Set<string>(), packs = new Set<string>();
  for (const l of lines) {
    const it = cat[l.id]; if (!it) continue;
    if (it.kind === 'coffee') bases.add(l.id);
    if (it.base) { bases.add(it.base); }
    it.bases?.forEach(b => bases.add(b));
    if (it.kind === 'pack') packs.add(l.id);
  }
  // Saffron comes in with Najdi, Qassimi, Hijazi, Taste the Gulf and the gift boxes with Najdi.
  const saffron = lines.some(l => l.id === 'pack-saffron' || l.id === 'najdi' || l.id === 'qassimi' || l.id === 'hijazi' || l.id === 'taste-gulf' || (cat[l.id]?.bases?.includes('gulf') && cat[l.id]?.kind === 'box'));
  const notes: { text: string; add?: string; label?: string }[] = [];
  for (const id of packs) {
    const it = cat[id], base = it.for && cat[it.for];
    if (!base || bases.has(it.for!)) continue;
    notes.push({
      text: ar ? `${it.n.ar} مصنوعة لـ${base.n.ar}. إن كان عندك كيس في البيت فأنت جاهز، وإلا فأضف واحداً.` : `The ${it.n.en} is made for ${base.n.en}. If you have a bag at home you are set; if not, add one.`,
      add: it.for, label: ar ? `أضف ${base.n.ar}` : `Add ${base.n.en}`,
    });
  }
  if ((packs.has('pack-qassim') || packs.has('pack-hijazi')) && !saffron)
    notes.push({ text: ar ? 'القصيمية والحجازية تُصنعان مع ظرف الزعفران أيضاً.' : 'Qassimi and Hijazi are made with the saffron packet too.', add: 'pack-saffron', label: ar ? 'أضف ظرف زعفران' : 'Add a saffron packet' });
  return notes;
}

/** Draws the notes into a list (cart page and drawer). */
export function paintAdvice(list: HTMLElement, lang: 'en' | 'ar', after: () => void) {
  list.querySelectorAll('.cart-note').forEach(n => n.remove());
  for (const n of advice(read(), lang)) {
    const li = document.createElement('li'); li.className = 'cart-note';
    const p = document.createElement('p'); p.textContent = n.text; li.append(p);
    const it = n.add ? catalog().items[n.add] : null;
    // Only offer what can be ordered now (hidden or sold out: no button once live data is in).
    if (n.add && it && it.price != null && (window as any).hikayaOrderable?.(n.add) !== false) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'note-add'; b.textContent = n.label!;
      b.addEventListener('click', () => { add(n.add!, Object.keys(it.opts ?? {})[0] ?? ''); after(); });
      li.append(b);
    }
    list.append(li);
  }
}

function paintCount() {
  const n = document.getElementById('cartN');
  if (!n) return;
  n.textContent = String(totals().count);
  const b = document.getElementById('cartBtn');
  b?.classList.remove('bump'); void b?.offsetWidth; b?.classList.add('bump');
}

const money = (n: number, lang: 'en' | 'ar') => { const v = Number.isInteger(n) ? String(n) : n.toFixed(2); return lang === 'ar' ? `${v} $` : `$${v}`; };

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
    li.innerHTML = `<span class="th"></span><div><div class="nm"></div><div class="op"></div><div class="q"><button type="button" data-d="-1" aria-label="${lang === 'ar' ? 'أنقص' : 'Less'}">−</button><span class="tnum">${l.qty}</span><button type="button" data-d="1" aria-label="${lang === 'ar' ? 'زد' : 'More'}">+</button></div></div><span class="lp tnum">${d.priced ? money(d.price * l.qty, lang) : (lang === 'ar' ? 'السعر قريباً' : 'Price coming')}</span>`;
    const img = items[l.id]?.img;
    (li.querySelector('.th') as HTMLElement).style.backgroundImage = `url(${img ?? '/brand/logo.svg'})`;
    if (!img) (li.querySelector('.th') as HTMLElement).style.backgroundSize = '70%';
    li.querySelector('.nm')!.textContent = d.name;
    li.querySelector('.op')!.textContent = d.opt;
    li.querySelectorAll<HTMLButtonElement>('[data-d]').forEach(b => b.addEventListener('click', () => { setQty(i, l.qty + Number(b.dataset.d)); paintDrawer(); }));
    list.append(li);
  });
  paintAdvice(list, lang, paintDrawer);
  document.getElementById('drSub')!.textContent = money(sub, lang);
  const left = Math.max(0, +(80 - sub).toFixed(2));
  document.getElementById('drFree')!.textContent = left === 0
    ? (lang === 'ar' ? 'التوصيل داخل كالغاري مجاني لهذا الطلب.' : 'Free Calgary delivery on this order.')
    : (lang === 'ar' ? `أضف ${money(left, lang)} ليصبح التوصيل مجاناً.` : `Add ${money(left, lang)} for free Calgary delivery.`);
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
