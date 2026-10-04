// Prices come from the same product file the website uses. The browser only sends ids,
// options and quantities; every amount is recalculated here.
import { PRODUCTS, GRINDS, DATES, fileCents } from '../../src/data/products';
import { HttpError } from './http';
import type { Live } from './catalog';
import type { Applied } from './promos';

export type CartLine = { id: string; opt?: string; qty: number };
export type PricedLine = { product_id: string; name_en: string; name_ar: string; option: string | null; option_en: string | null; option_ar: string | null; qty: number; unit_cents: number };

export const DELIVERY_CENTS = 900;
export const FREE_DELIVERY_FROM = 8000;

/** Prices a basket. With `live` (from liveCatalog) the team's prices and sold-out switches apply. */
export function priceCart(lines: unknown, live?: Record<string, Live>): PricedLine[] {
  if (!Array.isArray(lines) || lines.length === 0) throw new HttpError(400, 'empty-cart', 'Your cart is empty.');
  if (lines.length > 30) throw new HttpError(400, 'cart-too-big');
  return lines.map((raw: any) => {
    const p = PRODUCTS.find(x => x.id === raw?.id);
    if (!p) throw new HttpError(400, 'unknown-product', `Unknown product: ${String(raw?.id).slice(0, 40)}`);
    if (live && !live[p.id]?.shown) throw new HttpError(409, 'not-offered', `${p.name.en} is not available at the moment.`);
    if (live && !live[p.id]?.available) throw new HttpError(409, 'sold-out', `${p.name.en} is sold out for now.`);
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new HttpError(400, 'bad-qty');
    let option: string | null = null, label: { en: string; ar: string } | null = null;
    if (p.kind === 'coffee' && p.grinds.length) {
      option = p.grinds.includes(raw.opt) ? raw.opt : p.grinds[0];
      label = GRINDS[option as keyof typeof GRINDS];
    } else if (p.kind === 'box' && p.chooseDate) {
      if (!(raw.opt in DATES)) throw new HttpError(400, 'choose-date', 'Choose a date variety for the box.');
      option = raw.opt;
      label = DATES[raw.opt as keyof typeof DATES].name;
    } else if (p.kind === 'kit') {
      // A style or discovery pack takes the grind of its base bag.
      const base = PRODUCTS.find(x => x.id === p.base);
      if (base?.kind === 'coffee' && base.grinds.length) { option = base.grinds.includes(raw.opt) ? raw.opt : base.grinds[0]; label = GRINDS[option as keyof typeof GRINDS]; }
    }
    // Until the owners set a price in the desk, an item can't be ordered (never a $0 line).
    const unit = live ? live[p.id]?.price_cents ?? null : fileCents(p);
    if (unit == null) throw new HttpError(409, 'no-price', `${p.name.en} is not open for orders yet.`);
    return { product_id: p.id, name_en: p.name.en, name_ar: p.name.ar, option, option_en: label?.en ?? null, option_ar: label?.ar ?? null, qty, unit_cents: unit };
  });
}

export function totals(lines: PricedLine[], method: 'pickup' | 'delivery', promo?: Applied | null) {
  const subtotal = lines.reduce((s, l) => s + l.unit_cents * l.qty, 0);
  const delivery = method === 'delivery' && subtotal < FREE_DELIVERY_FROM && !promo?.free_delivery ? DELIVERY_CENTS : 0;
  const discount = Math.min(promo?.discount_cents ?? 0, subtotal);
  return { subtotal_cents: subtotal, delivery_cents: delivery, discount_cents: discount, total_cents: subtotal - discount + delivery };
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
