// The weekly roast and pack sheet: everything to roast, grind, portion and box for one week of
// orders (Thursday to Wednesday by default, so a whole Thursday–Sunday service week is one sheet).
import { sql } from './db';
import { addDays, calgaryNow, weekday } from './slots';
import { PRODUCTS, DATES, GRINDS, FILLINGS, boxContents, boxOptionLabel, type DateId, type FillingId, type Sleeve } from '../../src/data/products';

type PackRow = { id: string; name: string; full: number; mini: number; inKits: number };

const grams = (size: string) => Number(/(\d+)\s*g/.exec(size)?.[1] ?? 250);

/** The Thursday that starts the service week containing (or following) this day. */
export function weekStart(date = calgaryNow().date) {
  const wd = weekday(date);
  return wd === 4 ? date : wd >= 1 && wd <= 3 ? addDays(date, 4 - wd) : addDays(date, -((wd - 4 + 7) % 7));
}

type CoffeeRow = { id: string; name: string; grind: string; pouches: number; grams: number; inBoxes: number };

export async function weekSheet(from: string, sample: '' | 'hide' | 'only' = 'hide') {
  const to = addDays(from, 6);
  const rows = await sql`SELECT o.slot_date::text AS day, o.method, o.ref, i.product_id, i.option, i.qty, i.sleeve
    FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE o.slot_date BETWEEN ${from} AND ${to} AND o.status <> 'cancelled'
      AND (${sample} = '' OR (${sample} = 'hide' AND NOT o.is_sample) OR (${sample} = 'only' AND o.is_sample))`;

  const coffee = new Map<string, CoffeeRow>();
  const addCoffee = (id: string, grind: string | null, n: number, fromBox: boolean) => {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p || p.kind !== 'coffee') return;
    const g = grind ?? p.grinds[0] ?? 'whole';
    const key = `${id}|${g}`;
    const row = coffee.get(key) ?? { id, name: p.name.en, grind: g === 'whole' ? 'Whole husk' : GRINDS[g as keyof typeof GRINDS]?.en ?? g, pouches: 0, grams: 0, inBoxes: 0 };
    row.pouches += n; row.grams += n * grams(p.size.en); if (fromBox) row.inBoxes += n; // in gift boxes, styles and discovery packs
    coffee.set(key, row);
  };
  // Sealed packs to fill: full size (one bag's worth) and the small ones in the discovery packs.
  const packs = new Map<string, PackRow>();
  const addPack = (id: string, n: number, mini: boolean, inKit: boolean) => {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p || p.kind !== 'pack') return;
    const row = packs.get(id) ?? { id, name: p.name.en, full: 0, mini: 0, inKits: 0 };
    if (mini) row.mini += n; else row.full += n;
    if (inKit) row.inKits += n;
    packs.set(id, row);
  };
  const datePieces: Partial<Record<DateId, number>> = {};
  const dateGrams: Partial<Record<DateId, number>> = {};
  const stuffed: Partial<Record<FillingId, number>> = {};
  const datePacks = { g250: 0, g500: 0, g1000: 0 };
  const boxes = { D24: 0, C12: 0, C2: 0, everyday: 0 };
  const sleeves = { regular: 0 };
  const stickers = { ramadan: 0, eid: 0 };
  const products = new Map<string, { name: string; option: string; qty: number }>();
  const days = new Map<string, { day: string; pickup: Set<string>; delivery: Set<string> }>();

  for (const r of rows) {
    const p = PRODUCTS.find(x => x.id === r.product_id);
    if (!p) continue;
    const d = days.get(r.day) ?? { day: r.day, pickup: new Set(), delivery: new Set() };
    d[r.method === 'delivery' ? 'delivery' : 'pickup'].add(r.ref); days.set(r.day, d);
    const optName = !r.option ? '' : p.kind === 'coffee' || p.kind === 'kit' ? GRINDS[r.option as keyof typeof GRINDS]?.en ?? r.option : p.kind === 'box' ? boxOptionLabel(p, r.option, 'en') : r.option;
    const pk = `${p.id}|${r.option ?? ''}`;
    const pr = products.get(pk) ?? { name: p.name.en, option: optName, qty: 0 }; pr.qty += r.qty; products.set(pk, pr);
    if (p.kind === 'coffee') { addCoffee(p.id, r.option, r.qty, false); continue; }
    if (p.kind === 'pack') { addPack(p.id, r.qty, false, false); continue; }
    if (p.kind === 'kit') {
      addCoffee(p.base, r.option, r.qty, true);
      for (const x of p.parts) addPack(x.id, r.qty, Boolean(x.mini), true);
      continue;
    }
    boxes[p.insert] += r.qty;
    // Every gift box has the gold sleeve; Ramadan and Eid add our Ø50 sticker (from the order line,
    // else the box's own: the retired seasonal boxes).
    if (p.insert !== 'everyday') {
      sleeves.regular += r.qty;
      const occ = (['regular', 'ramadan', 'eid'].includes(r.sleeve) ? r.sleeve : p.sleeve) as Sleeve;
      if (occ !== 'regular') stickers[occ] += r.qty;
    }
    // Bags, packs and dates in pieces (Mixed split per kind; each chosen coffee is a 250 g bag of that style).
    const c = boxContents(p, r.option);
    for (const [cid, n] of Object.entries(c.coffee)) addCoffee(cid, null, n * r.qty, true);
    for (const [sid, n] of Object.entries(c.sachets)) addPack(sid, n * r.qty, false, true);
    for (const [did, n] of Object.entries(c.dates)) datePieces[did as DateId] = (datePieces[did as DateId] ?? 0) + (n ?? 0) * r.qty;
    for (const [fid, n] of Object.entries(c.stuffed)) stuffed[fid as FillingId] = (stuffed[fid as FillingId] ?? 0) + (n ?? 0) * r.qty;
    // By weight: grams of the chosen variety.
    if (p.grams && r.option) dateGrams[r.option as DateId] = (dateGrams[r.option as DateId] ?? 0) + p.grams * r.qty;
    if (p.grams === 250) datePacks.g250 += r.qty; else if (p.grams === 500) datePacks.g500 += r.qty; else if (p.grams === 1000) datePacks.g1000 += r.qty;
  }

  const coffeeRows = [...coffee.values()].sort((a, b) => b.grams - a.grams);
  const dateRows = (Object.keys(DATES) as DateId[]).map(id => ({ id, name: DATES[id].name.en, pieces: datePieces[id] ?? 0, grams: dateGrams[id] ?? 0 })).filter(r => r.pieces || r.grams);
  return {
    from, to,
    orders: new Set(rows.map(r => r.ref)).size,
    days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).map(d => ({ day: d.day, pickup: d.pickup.size, delivery: d.delivery.size })),
    coffee: coffeeRows,
    packs: [...packs.values()].sort((a, b) => b.full + b.mini - a.full - a.mini),
    coffeeTotalKg: Math.round(coffeeRows.reduce((n, r) => n + r.grams, 0) / 100) / 10,
    dates: dateRows,
    stuffed: (Object.keys(stuffed) as FillingId[]).map(id => ({ id, name: FILLINGS[id].name.en, pieces: stuffed[id] ?? 0 })).filter(r => r.pieces),
    packaging: {
      pouches250: coffeeRows.filter(r => r.grams / Math.max(1, r.pouches) === 250).reduce((n, r) => n + r.pouches, 0),
      pouches100: coffeeRows.filter(r => r.grams / Math.max(1, r.pouches) === 100).reduce((n, r) => n + r.pouches, 0),
      giftBoxes: { D24: boxes.D24, C12: boxes.C12, C2: boxes.C2 },
      everydayTrays: boxes.everyday,
      datePacks,
      sleeves,
      stickers,
      paperCups: boxes.D24 * 24 + boxes.C12 * 12,
    },
    products: [...products.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
