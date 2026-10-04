// The pages are built once; prices, sold-out switches, hidden products and the Ramadan/Eid
// seasons change from the admin desk. This applies the live values on every page: the last
// known values straight away (from this browser), then fresh ones from /api/catalog.
type LiveProduct = { price: number | null; shown: boolean; available: boolean; left: number | null };
type Live = { seasons: { ramadan: boolean; eid: boolean }; products: Record<string, LiveProduct>; business?: { address: string; hours: string; phone: string } };

const KEY = 'hikaya-live-v1';
const lang = () => (document.documentElement.lang === 'ar' ? 'ar' : 'en');
const money = (n: number) => { const v = Number.isInteger(n) ? String(n) : n.toFixed(2); return lang() === 'ar' ? `${v} $` : `$${v}`; };

let current: Live | null = null;
const priceOr = (n: number | null) => (n == null ? (lang() === 'ar' ? 'السعر قريباً' : 'Price coming') : money(n));
/** For scripts that show prices they build themselves (the box builder). */
/** For the style picker on a product page: can this id be ordered right now? (undefined = not known yet) */
(window as any).hikayaOrderable = (id: string) => { const p = current?.products[id]; return p ? p.shown && p.available && p.price != null : undefined; };
(window as any).hikayaPrice = (id: string) => current?.products[id] ? priceOr(current.products[id].price) : undefined;

// The pickup address the owners set in the desk replaces "[address]" everywhere, including text
// added later (orders in My account).
let address = '';
function fillAddress(root: Node) {
  if (!address) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const swap: Text[] = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (/\[address\]|\[العنوان\]/.test(n.nodeValue ?? '')) swap.push(n as Text);
  for (const t of swap) t.nodeValue = t.nodeValue!.replace(/\[address\],? Calgary(, AB)?/g, address).replace(/\[العنوان\]،? كالغاري/g, address).replace(/\[address\]|\[العنوان\]/g, address);
}
let watching = false;
function apply(live: Live) {
  current = live;
  if (live.business?.address) {
    address = live.business.address;
    fillAddress(document.body);
    document.querySelectorAll<HTMLElement>('[data-biz-pending]').forEach(el => { el.hidden = true; });
    document.querySelectorAll<HTMLElement>('[data-biz-hours]').forEach(el => { if (live.business!.hours) { el.textContent = live.business!.hours; el.hidden = false; } });
    // Search engines: the shop's address and phone in the Store details.
    document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]').forEach(el => {
      try {
        const d = JSON.parse(el.textContent || '');
        if (d['@type'] !== 'Store') return;
        d.address = live.business!.address; if (live.business!.phone) d.telephone = live.business!.phone;
        el.textContent = JSON.stringify(d);
      } catch { /* not ours */ }
    });
    if (!watching) { watching = true; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => fillAddress(n)))).observe(document.body, { childList: true, subtree: true }); }
  }
  const P = live.products;
  // Seasons: whole pages, nav links, banners and sections.
  // data-season="ramadan" or "ramadan eid": shown while any of those seasons is on.
  // data-season-off: the opposite, for text that stands in when the season is off.
  const anyOn = (v: string) => v.split(/\s+/).some(s => live.seasons[s as 'ramadan' | 'eid']);
  document.querySelectorAll<HTMLElement>('[data-season]').forEach(el => { el.hidden = !anyOn(el.dataset.season!); });
  document.querySelectorAll<HTMLElement>('[data-season-off]').forEach(el => { el.hidden = anyOn(el.dataset.seasonOff!); });
  // Prices (a comma list shows the sum, e.g. a coffee plus a date box).
  document.querySelectorAll<HTMLElement>('[data-price-for]').forEach(el => {
    const ids = el.dataset.priceFor!.split(',');
    if (ids.every(id => P[id])) el.textContent = ids.some(id => P[id].price == null) ? priceOr(null) : money(ids.reduce((n, id) => n + P[id].price!, 0));
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
    // Not priced yet: ordering is off and the button says so (the owners set prices in the desk).
    const noPrice = ids.some(id => P[id] && P[id].shown && P[id].price == null);
    const off = noPrice || ids.some(id => P[id] && (!P[id].shown || !P[id].available));
    b.disabled = off;
    let tag = b.parentElement?.querySelector<HTMLElement>('.sold-out-tag');
    if (off && !tag) { tag = document.createElement('span'); tag.className = 'sold-out-tag'; b.after(tag); }
    if (tag) { tag.hidden = !off; tag.dataset.reason = noPrice ? 'noprice' : ''; tag.textContent = noPrice ? (lang() === 'ar' ? 'الطلب يفتح قريباً' : 'Ordering opens soon') : ids.some(id => P[id] && !P[id].shown) ? (lang() === 'ar' ? 'غير متوفر الآن' : 'Not available now') : (lang() === 'ar' ? 'نفد' : 'Sold out'); }
    // On a product page, offer "Email me when it's back".
    const own = ids.length === 1 && document.querySelector('main [data-pdp]')?.getAttribute('data-pdp') === ids[0] && b.closest('main');
    let nf = b.parentElement?.querySelector<HTMLFormElement>('.notify-me');
    if (off && own && !nf && !noPrice) { nf = notifyForm(ids[0]); b.parentElement!.append(nf); }
    if (nf) nf.hidden = !off;
  });
  document.querySelectorAll<HTMLElement>('[data-notify]').forEach(el => { if (!el.firstChild) el.append(notifyForm(el.dataset.notify!)); });
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

function notifyForm(product: string) {
  const ar = lang() === 'ar';
  const f = document.createElement('form'); f.className = 'notify-me'; f.noValidate = true;
  f.innerHTML = `<input type="email" required autocomplete="email" placeholder="${ar ? 'بريدك الإلكتروني' : 'Your email'}" aria-label="${ar ? 'بريدك الإلكتروني' : 'Your email'}" dir="ltr" /><button type="submit">${ar ? 'أخبروني حين يعود' : "Email me when it's back"}</button><p aria-live="polite"></p>`;
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const email = (f.querySelector('input') as HTMLInputElement).value.trim(), out = f.querySelector('p')!;
    try {
      const r = await fetch('/api/notify-me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product, email, lang: ar ? 'ar' : 'en' }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message);
      out.textContent = ar ? 'سنرسل لك رسالة واحدة حين يعود.' : "We'll send you one email when it's back.";
    } catch (x) { out.textContent = (x as Error).message || (ar ? 'تحقق من البريد.' : 'Check the email.'); }
  });
  return f;
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
