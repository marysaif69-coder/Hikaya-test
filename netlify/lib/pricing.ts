// Prices come from the same product file the website uses. The browser only sends ids,
// options and quantities; every amount is recalculated here.
import { PRODUCTS, GRINDS, GIFT_COFFEES, dateChoices, boxOptionLabel, takesSleeve, fileCents, type Sleeve } from '../../src/data/products';
import { HttpError } from './http';
import type { Live, Seasons } from './catalog';
import type { Applied } from './promos';

export type CartLine = { id: string; opt?: string; qty: number; sleeve?: string };
export type PricedLine = { product_id: string; name_en: string; name_ar: string; option: string | null; option_en: string | null; option_ar: string | null; qty: number; unit_cents: number; sleeve: Sleeve | null };

export const DELIVERY_CENTS = 900;
export const FREE_DELIVERY_FROM = 8000;

const SLEEVE_IDS: Sleeve[] = ['regular', 'ramadan', 'eid'];

/** Prices a basket. With `live` (from liveCatalog) the team's prices and sold-out switches apply.
 * `seasons`: which seasonal sleeves can be chosen now (a Ramadan or Eid sleeve only in its season). */
export function priceCart(lines: unknown, live?: Record<string, Live>, seasons?: Partial<Seasons>): PricedLine[] {
  if (!Array.isArray(lines) || lines.length === 0) throw new HttpError(400, 'empty-cart', 'Your cart is empty.');
  if (lines.length > 30) throw new HttpError(400, 'cart-too-big');
  return lines.map((raw: any) => {
    const p = PRODUCTS.find(x => x.id === raw?.id);
    if (!p) throw new HttpError(400, 'unknown-product', `Unknown product: ${String(raw?.id).slice(0, 40)}`);
    // The seasonal copies are retired: a season is now a sleeve on the gift boxes.
    if (p.kind === 'box' && p.retired) throw Object.assign(new HttpError(409, 'retired', `${p.name.en} is no longer sold on its own. Choose a gift box and its Ramadan or Eid sleeve.`), { extra: { name: p.name.ar } });
    if (live && !live[p.id]?.shown) throw Object.assign(new HttpError(409, 'not-offered', `${p.name.en} is not available at the moment.`), { extra: { name: p.name.ar } });
    if (live && !live[p.id]?.available) throw Object.assign(new HttpError(409, 'sold-out', `${p.name.en} is sold out for now.`), { extra: { name: p.name.ar } });
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new HttpError(400, 'bad-qty');
    let option: string | null = null, label: { en: string; ar: string } | null = null;
    if (p.kind === 'coffee' && p.grinds.length) {
      option = p.grinds.includes(raw.opt) ? raw.opt : p.grinds[0];
      label = GRINDS[option as keyof typeof GRINDS];
    } else if (p.kind === 'box' && p.picks) {
      // Two choices in one string: "najdi|mixed" (a style and the Reserve kind) or "najdi|hadrami".
      const parts = typeof raw.opt === 'string' ? raw.opt.split('|') : [];
      if (parts.length !== p.picks.length) throw new HttpError(400, p.picks.includes('reserve') ? 'choose-date' : 'choose-coffee', 'Choose what goes in the box.');
      p.picks.forEach((kind, i) => {
        const part = parts[i];
        if (kind === 'coffee') {
          // A style for sale now (not hidden, not sold out).
          if (!GIFT_COFFEES.includes(part)) throw new HttpError(400, 'choose-coffee', 'Choose the coffee for the box.');
          if (live && !(live[part]?.shown && live[part]?.available)) throw Object.assign(new HttpError(409, 'sold-out', `${PRODUCTS.find(x => x.id === part)!.name.en} is sold out for now.`), { extra: { name: PRODUCTS.find(x => x.id === part)!.name.ar } });
        } else if (!dateChoices(p).includes(part)) throw new HttpError(400, 'choose-date', 'Choose a date variety for the box.');
      });
      option = parts.join('|');
      label = { en: boxOptionLabel(p, option, 'en'), ar: boxOptionLabel(p, option, 'ar') };
    } else if (p.kind === 'box' && (p.fillings || p.chooseDate)) {
      // Only what this box offers (Everyday or Reserve varieties, the fillings on sale, Mixed where
      // it divides evenly), not every date we have ever had.
      if (typeof raw.opt !== 'string' || !dateChoices(p).includes(raw.opt)) {
        if (p.fillings) throw new HttpError(400, 'choose-filling', raw.opt === 'mixed' ? 'Mixed is not offered for this box yet. Choose one filling.' : 'Choose a filling for the box.');
        throw new HttpError(400, 'choose-date', 'Choose a date variety for the box.');
      }
      option = raw.opt;
      label = { en: boxOptionLabel(p, option, 'en'), ar: boxOptionLabel(p, option, 'ar') };
    } else if (p.kind === 'kit') {
      // A style or discovery pack takes the grind of its base bag.
      const base = PRODUCTS.find(x => x.id === p.base);
      if (base?.kind === 'coffee' && base.grinds.length) { option = base.grinds.includes(raw.opt) ? raw.opt : base.grinds[0]; label = GRINDS[option as keyof typeof GRINDS]; }
    }
    // Until the owners set a price in the desk, an item can't be ordered (never a $0 line).
    const unit = live ? live[p.id]?.price_cents ?? null : fileCents(p);
    if (unit == null) throw Object.assign(new HttpError(409, 'no-price', `${p.name.en} is not open for orders yet.`), { extra: { name: p.name.ar } });
    // Gift boxes: the sleeve, from the allowed list; Ramadan or Eid only while that season is on.
    let sleeve: Sleeve | null = null;
    if (p.kind === 'box' && takesSleeve(p)) {
      const want = SLEEVE_IDS.includes(raw.sleeve) ? (raw.sleeve as Sleeve) : 'regular';
      sleeve = want !== 'regular' && seasons && !seasons[want] ? 'regular' : want;
    }
    return { product_id: p.id, name_en: p.name.en, name_ar: p.name.ar, option, option_en: label?.en ?? null, option_ar: label?.ar ?? null, qty, unit_cents: unit, sleeve };
  });
}

export function totals(lines: PricedLine[], method: 'pickup' | 'delivery', promo?: Applied | null) {
  const subtotal = lines.reduce((s, l) => s + l.unit_cents * l.qty, 0);
  const delivery = method === 'delivery' && subtotal < FREE_DELIVERY_FROM && !promo?.free_delivery ? DELIVERY_CENTS : 0;
  const discount = Math.min(promo?.discount_cents ?? 0, subtotal);
  return { subtotal_cents: subtotal, delivery_cents: delivery, discount_cents: discount, total_cents: subtotal - discount + delivery };
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
