// The pages are built once; prices, sold-out switches, hidden products and the Ramadan/Eid
// seasons change from the admin desk. This applies the live values on every page: the last
// known values straight away (from this browser), then fresh ones from /api/catalog.
type LiveProduct = { price: number; shown: boolean; available: boolean; left: number | null };
type Live = { seasons: { ramadan: boolean; eid: boolean }; products: Record<string, LiveProduct> };

const KEY = 'hikaya-live-v1';
const lang = () => (document.documentElement.lang === 'ar' ? 'ar' : 'en');
const money = (n: number) => { const v = Number.isInteger(n) ? String(n) : n.toFixed(2); return lang() === 'ar' ? `${v} $` : `$${v}`; };

let current: Live | null = null;
/** For scripts that show prices they build themselves (the box builder). */
(window as any).hikayaPrice = (id: string) => current?.products[id] ? money(current.products[id].price) : undefined;

function apply(live: Live) {
  current = live;
  const P = live.products;
  // Seasons: whole pages, nav links, banners and sections.
  for (const s of ['ramadan', 'eid'] as const) {
    const on = live.seasons[s];
    document.querySelectorAll<HTMLElement>(`[data-season="${s}"]`).forEach(el => { el.hidden = !on; });
    document.querySelectorAll<HTMLElement>(`[data-season-off="${s}"]`).forEach(el => { el.hidden = on; });
  }
  // Prices (a comma list shows the sum, e.g. a coffee plus a date box).
  document.querySelectorAll<HTMLElement>('[data-price-for]').forEach(el => {
    const ids = el.dataset.priceFor!.split(',');
    if (ids.every(id => P[id])) el.textContent = money(ids.reduce((n, id) => n + P[id].price, 0));
  });
  // Product cards: hidden products disappear, sold-out ones say so.
  document.querySelectorAll<HTMLElement>('[data-product]').forEach(el => {
    const p = P[el.dataset.product!];
    if (!p) return;
    el.hidden = !p.shown;
    el.classList.toggle('is-sold-out', p.shown && !p.available);
  });
  document.querySelectorAll<HTMLElement>('[data-group]').forEach(g => {
    if (g.hidden) return;
    const cards = [...g.querySelectorAll<HTMLElement>('[data-product]')];
    if (cards.length && cards.every(c => c.hidden)) g.hidden = true;
  });
  // Add buttons: off when any product they add can't be ordered.
  document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(b => {
    const ids = b.dataset.add!.split(',');
    const off = ids.some(id => P[id] && (!P[id].shown || !P[id].available));
    b.disabled = off;
    let tag = b.parentElement?.querySelector<HTMLElement>('.sold-out-tag');
    if (off && !tag) { tag = document.createElement('span'); tag.className = 'sold-out-tag'; b.after(tag); }
    if (tag) { tag.hidden = !off; tag.textContent = ids.some(id => P[id] && !P[id].shown) ? (lang() === 'ar' ? 'غير متوفر الآن' : 'Not available now') : (lang() === 'ar' ? 'نفد' : 'Sold out'); }
  });
  // The cart reads prices from the page's catalog; keep it in step.
  const cat = document.getElementById('catalog');
  if (cat) {
    try {
      const c = JSON.parse(cat.textContent || '{}');
      for (const [id, p] of Object.entries(P)) if (c.items?.[id]) c.items[id].price = p.price;
      cat.textContent = JSON.stringify(c);
      document.dispatchEvent(new CustomEvent('catalog:live'));
    } catch { /* leave the built-in prices */ }
  }
}

export async function applyLive() {
  try { const cached = localStorage.getItem(KEY); if (cached) apply(JSON.parse(cached)); } catch { /* private mode */ }
  try {
    const r = await fetch('/api/catalog');
    if (!r.ok) return;
    const live: Live = await r.json();
    apply(live);
    try { localStorage.setItem(KEY, JSON.stringify(live)); } catch { /* private mode */ }
  } catch { /* offline: keep what the page shows */ }
}
