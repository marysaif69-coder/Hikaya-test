// Production and traceability: each batch of coffee or dates gets a lot code and a best-before
// date; packing slips show which lot went into each order; a recall lookup lists the customers who
// got a lot. Supplies (packaging) on hand are compared with what the week needs.
import { sql, one, type Row } from './db';
import { HttpError } from './http';
import { PRODUCTS, DATES, FILLINGS, boxContents, type DateId, type FillingId } from '../../src/data/products';
import { addDays, calgaryNow } from './slots';
import { weekSheet } from './week';
import { randomUUID } from 'node:crypto';

const day = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);
const isoOk = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
// Coffee lots cover the base bags and the sealed packs (kept as item_kind 'coffee'). Date lots are per
// variety; stuffed lots (item_kind 'stuffed') are per filling.
export const itemName = (kind: string, id: string) => kind === 'coffee' ? PRODUCTS.find(p => p.id === id)?.name.en ?? id : kind === 'stuffed' ? `Stuffed dates · ${FILLINGS[id as FillingId]?.name.en ?? id}` : DATES[id as DateId]?.name.en ?? id;
// MUFATT-…, KHALAS-…; a two-word filling takes three letters of each (PISDIP, CARALM).
const lotStem = (id: string) => (id.includes('-') && id in FILLINGS ? id.split('-').map(w => w.slice(0, 3)).join('') : id.replace(/[^a-z]/gi, '').slice(0, 6)).toUpperCase();

export async function addLot(b: any, by: string) {
  const kind = b?.item_kind === 'dates' ? 'dates' : b?.item_kind === 'coffee' ? 'coffee' : b?.item_kind === 'stuffed' ? 'stuffed' : null;
  const id = String(b?.item_id ?? '');
  const valid = kind === 'coffee' ? PRODUCTS.some(p => (p.kind === 'coffee' || p.kind === 'pack') && p.id === id) : kind === 'dates' ? Object.hasOwn(DATES, id) : kind === 'stuffed' ? Object.hasOwn(FILLINGS, id) : false;
  if (!valid) throw new HttpError(400, 'item', 'Choose the coffee or the date variety.');
  const made = isoOk(b?.made_on) ? b.made_on : calgaryNow().date;
  const best = isoOk(b?.best_before) ? b.best_before : null;
  if (best && best <= made) throw new HttpError(400, 'best-before', 'Best before must be after the day it was made.');
  const stem = `${lotStem(id)}-${made.slice(2).replace(/-/g, '')}`;
  const n = await one`SELECT COUNT(*)::int AS n FROM lots WHERE code LIKE ${stem + '-%'}`;
  const code = `${stem}-${(n?.n ?? 0) + 1}`;
  await sql`INSERT INTO lots (code, item_kind, item_id, made_on, best_before, quantity, supplier, note, made_by)
    VALUES (${code}, ${kind}, ${id}, ${made}, ${best}, ${String(b?.quantity ?? '').slice(0, 80) || null}, ${String(b?.supplier ?? '').slice(0, 120) || null}, ${String(b?.note ?? '').slice(0, 300) || null}, ${by})`;
  return { code };
}
export async function usedUp(code: string, on?: string) {
  const r = await one`UPDATE lots SET used_up_on = ${isoOk(on) ? on! : calgaryNow().date} WHERE code = ${code} RETURNING code`;
  if (!r) throw new HttpError(404, 'not-found');
  return { ok: true };
}
export async function listLots() {
  const rows = await sql`SELECT * FROM lots ORDER BY used_up_on IS NOT NULL, made_on DESC, id DESC LIMIT 300`;
  return rows.map(r => ({ code: r.code, kind: r.item_kind, item: r.item_id, name: itemName(r.item_kind, r.item_id), madeOn: day(r.made_on), bestBefore: r.best_before ? day(r.best_before) : null, quantity: r.quantity, supplier: r.supplier, note: r.note, madeBy: r.made_by, usedUpOn: r.used_up_on ? day(r.used_up_on) : null }));
}

/** What goes into an order line, for traceability: coffees, date varieties and stuffed fillings. */
function contents(productId: string, option: string | null): { coffee: string[]; dates: string[]; stuffed: string[] } {
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p) return { coffee: [], dates: [], stuffed: [] };
  if (p.kind === 'coffee' || p.kind === 'pack') return { coffee: [p.id], dates: [], stuffed: [] };
  if (p.kind === 'kit') return { coffee: [p.base, ...p.parts.map(x => x.id)], dates: [], stuffed: [] };
  const c = boxContents(p, option);
  // Dates sold by weight: the chosen variety (not in pieces).
  const dates = [...Object.keys(c.dates), ...(p.grams && option ? [option] : [])];
  return { coffee: [...Object.keys(c.coffee), ...Object.keys(c.sachets)], dates, stuffed: Object.keys(c.stuffed) };
}

/** The lot in use for each coffee and date variety on a day (the newest made on or before it, not used up). */
export async function lotsOn(date: string) {
  const rows = await sql`SELECT DISTINCT ON (item_kind, item_id) code, item_kind, item_id, best_before FROM lots
    WHERE made_on <= ${date} AND (used_up_on IS NULL OR used_up_on >= ${date}) ORDER BY item_kind, item_id, made_on DESC, id DESC`;
  return new Map(rows.map(r => [`${r.item_kind}|${r.item_id}`, { code: r.code as string, bestBefore: r.best_before ? day(r.best_before) : null }]));
}
export function lotsForLines(lots: Awaited<ReturnType<typeof lotsOn>>, lines: { product_id: string; option: string | null }[]) {
  const out = new Set<string>();
  for (const l of lines) {
    const c = contents(l.product_id, l.option);
    for (const id of c.coffee) { const x = lots.get(`coffee|${id}`); if (x) out.add(x.code); }
    for (const id of c.dates) { const x = lots.get(`dates|${id}`); if (x) out.add(x.code); }
    for (const id of c.stuffed) { const x = lots.get(`stuffed|${id}`); if (x) out.add(x.code); }
  }
  return [...out];
}

/** Recall: every order that may have had this lot (from the day it was made to the day it was used up). */
export async function recall(code: string) {
  const lot = await one`SELECT * FROM lots WHERE code = ${code.trim().toUpperCase()}`;
  if (!lot) throw new HttpError(404, 'not-found', 'No lot with that code.');
  const from = day(lot.made_on), to = lot.used_up_on ? day(lot.used_up_on) : '9999-12-31'; // not used up yet: every order from then on
  const rows = await sql`SELECT o.ref, o.name, o.email, o.phone, o.slot_date, o.method, o.status, i.product_id, i.option FROM orders o JOIN order_items i ON i.order_id = o.id
    WHERE o.slot_date BETWEEN ${from} AND ${to} AND o.status <> 'cancelled' AND NOT o.is_sample ORDER BY o.slot_date, o.ref`;
  const hit = new Map<string, Row>();
  for (const r of rows) {
    const c = contents(r.product_id, r.option);
    if ((lot.item_kind === 'coffee' ? c.coffee : lot.item_kind === 'stuffed' ? c.stuffed : c.dates).includes(lot.item_id)) hit.set(r.ref, r);
  }
  return { lot: { code: lot.code, name: itemName(lot.item_kind, lot.item_id), madeOn: from, usedUpOn: lot.used_up_on ? day(lot.used_up_on) : null }, orders: [...hit.values()].map(r => ({ ref: r.ref, name: r.name, email: r.email, phone: r.phone, day: day(r.slot_date), method: r.method, status: r.status })) };
}

// ---------- supplies ----------
const NEED: Record<string, (w: Awaited<ReturnType<typeof weekSheet>>) => number> = {
  pouch250: w => w.packaging.pouches250, pouch100: w => w.packaging.pouches100,
  boxD24: w => w.packaging.giftBoxes.D24, boxC12: w => w.packaging.giftBoxes.C12, boxC2: w => w.packaging.giftBoxes.C2,
  trayEveryday: w => w.packaging.everydayTrays, sleeveRegular: w => w.packaging.sleeves.regular, sleeveRamadan: w => w.packaging.sleeves.ramadan, sleeveEid: w => w.packaging.sleeves.eid,
  paperCups: w => w.packaging.paperCups, bags: w => w.orders,
};
export async function supplies(weekFrom: string) {
  const [rows, w] = await Promise.all([sql`SELECT * FROM supplies ORDER BY name`, weekSheet(weekFrom, 'hide')]);
  return rows.map(r => {
    const need = NEED[r.key]?.(w) ?? null, have = r.on_hand === null ? null : Number(r.on_hand);
    return { key: r.key, name: r.name, unit: r.unit, onHand: have, lowAt: r.low_at === null ? null : Number(r.low_at), needThisWeek: need,
      short: need !== null && have !== null && need > have ? need - have : 0, low: have !== null && r.low_at !== null && have <= Number(r.low_at), updatedBy: r.updated_by, updatedAt: r.updated_at };
  });
}
export async function saveSupply(key: string, b: any, by: string) {
  const n = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : NaN);
  const onHand = n(b?.onHand), lowAt = n(b?.lowAt);
  if (Number.isNaN(onHand) || Number.isNaN(lowAt)) throw new HttpError(400, 'number', 'Use numbers of 0 or more.');
  if (b?.name !== undefined && key === 'new') {
    const name = String(b.name).trim().slice(0, 80);
    if (!name) throw new HttpError(400, 'name', 'Give it a name.');
    // A key that can't clash: an Arabic name has no Latin letters to make one from.
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    const k = `${slug || 's'}-${randomUUID().slice(0, 8)}`;
    const r = await one`INSERT INTO supplies (key, name, unit, on_hand, low_at, updated_by) VALUES (${k}, ${name}, ${String(b.unit ?? 'pcs').slice(0, 12) || 'pcs'}, ${onHand}, ${lowAt}, ${by}) ON CONFLICT (key) DO NOTHING RETURNING key`;
    if (!r) throw new HttpError(409, 'exists', 'That supply is already on the list.');
    return { ok: true };
  }
  const r = await one`UPDATE supplies SET on_hand = ${onHand}, low_at = ${lowAt}, updated_by = ${by}, updated_at = NOW() WHERE key = ${key} RETURNING key`;
  if (!r) throw new HttpError(404, 'not-found');
  return { ok: true };
}
