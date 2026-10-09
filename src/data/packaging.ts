// Packaging quantities for the China order (desk → Numbers → Packaging). Every count is
// units of each product × pieces per unit, plus a waste allowance, rounded up to the order step.
// The same formula is in the packaging pack (calc.js) that filled the China brief v5.

// Labels per roll: 2-inch core (Ø50.8), outside Ø100, label + liner about 0.14 mm, 3 mm gap.
// Roll length = π (50² − 25.4²) / 0.14 ≈ 41.6 m.
const ROLL_MM = Math.PI * (50 * 50 - 25.4 * 25.4) / 0.14, GAP = 3;
export const perRoll = (h: number) => Math.floor(ROLL_MM / (h + GAP));

export type PackInput = {
  coffee_kg: number; yemeni_kg: number; qishr_packs: number; dates_250_kg: number; dates_500_kg: number; dates_1kg_kg: number;
  b1_boxes: number; b5_boxes: number; spice_packs: number; small_packs: number; style_boxes: number; stuffed_dates: number;
  seasonal_share: number; bagged_orders: number; medium_share: number; totes: number;
  waste_labels: number; waste_pouches: number;
};

/** The owners' answers for the first China order (9 Oct, brief v16): about six months of selling. Coffee bags are
 *  1,000 or 2,000 depending on the quote (planned at 2,000: 500 kg); Yemeni pouches 500; gift boxes 500 (60% of 24,
 *  40% of 12) and small boxes 1,000; everyday dates 1,000 packs of each size; 1,000 spice sachets and 500 small
 *  pouches (one coffee style per sachet); 3,000 bagged orders; 300 totes; a season sticker on every box. */
export const PACK_DEFAULTS: PackInput = {
  coffee_kg: 500, yemeni_kg: 50, qishr_packs: 0, dates_250_kg: 250, dates_500_kg: 500, dates_1kg_kg: 1000,
  b1_boxes: 500, b5_boxes: 1000, spice_packs: 1000, small_packs: 500, style_boxes: 1000, stuffed_dates: 0,
  seasonal_share: 100, bagged_orders: 3000, medium_share: 25, totes: 300, waste_labels: 8, waste_pouches: 5,
};

export const PACK_FIELDS: [keyof PackInput, string, string][] = [
  ['coffee_kg', 'Coffee', '250 g coffee, kg'], ['yemeni_kg', 'Coffee', 'Yemeni beans 100 g, kg'], ['qishr_packs', 'Coffee', 'Qishr pouches (the 250 g pouch; weight set by your fill test), count'],
  ['spice_packs', 'Coffee', 'Spice packs (blends), count'], ['small_packs', 'Coffee', 'Saffron and small packs, count'],
  ['dates_250_kg', 'Dates', 'In 250 g packs (the small tray), kg'], ['dates_500_kg', 'Dates', 'In 500 g packs, kg'], ['dates_1kg_kg', 'Dates', 'In 1 kg packs, kg'],
  ['style_boxes', 'Coffee', 'Coffee styles and tasting sets (bag + packs, one Hikaya sticker each), count'],
  ['b1_boxes', 'Dates', 'Gift boxes B1'], ['b5_boxes', 'Dates', 'Small boxes B5'], ['stuffed_dates', 'Dates', 'Stuffed dates, each wrapped (count of dates)'],
  ['bagged_orders', 'Orders and waste', 'Orders that get a paper bag'], ['medium_share', 'Orders and waste', 'Of those, medium bag %'],
  ['seasonal_share', 'Orders and waste', 'Boxes with a season sticker %'], ['totes', 'Orders and waste', 'Totes'],
  ['waste_labels', 'Orders and waste', 'Label waste %'], ['waste_pouches', 'Orders and waste', 'Pouch waste %'],
];

const ROLLS: Record<string, [string, number]> = {
  E1: ['80 × 80 coffee front', 80], E1b: ['100 × 100 coffee back, spice packs', 100], E2: ['Ø76 box seal', 76],
  E12: ['100 × 150 everyday dates, 500 g and 1 kg trays, on the top, 150 wide: everything on one label (packed in Saudi Arabia, so the country name is 6.4 mm tall, beside our name)', 150],
  E12s: ['80 × 120 smallest everyday dates tray (250 g), on its top, 120 wide: everything on one label (country name 3.2 mm)', 120],
  E3: ['100 × 90 box bottom (Nutrition Facts, lot): B1 beside the band, B5 over it', 90], E4: ['Ø50 Ramadan / Eid', 50], E14: ['100 × 20 box side, B1 and B5, below the 16 mm lid (what is inside, ingredients, origin; a stuffed-date box takes two: English, French)', 20],
  E6: ['60 × 66 saffron and small packs, front and back', 66],
  E7: ['Ø30 Yemeni region seal', 30], E8: ['60 × 34 Yemeni lot card', 34], E9: ['82 × 66 Yemeni Nutrition Facts', 66],
  E11: ['40 × 25 label on each stuffed date (filling, allergens)', 25],
  E13: ['Ø50 round Hikaya sticker, removable glue: folded over the top, it holds a coffee style together (same shape as E4)', 50],
};
const B1_MIX = { D24: 60, D12: 40 };   // % of gift boxes by grid (pack v12: dates only; the coffee sets go in the paper bag; D30 until Thirty Nights is decided: 0)
// Pack v14: the grids come as loose strips by type, put together by us. One long type (cells along) with one short type
// (cells across) makes a grid: D24 = 3 × B1-L6 + 5 × B1-S4, D12 = 2 × B1-L4 + 3 × B1-S3, B5 (a) = 1 × B5-L3 + 2 × B5-S2.
const STRIPS: Record<string, string> = {
  'B1-L6': 'B1 long strip, 6 cells (D24)', 'B1-S4': 'B1 short strip, 4 cells (D24)', 'B1-L4': 'B1 long strip, 4 cells (D12)',
  'B1-S3': 'B1 short strip, 3 cells (D12)', 'B5-L3': 'B5 long strip, 3 cells (B5 a)', 'B5-S2': 'B5 short strip, 2 cells (B5 a)',
};
const WASTE = { boxes: 3, bags: 5, cups: 5 };
const MOQ_POUCH = 500;

export type PackRow = { group: string; code: string; name: string; need: number; why: string; order: number; rolls?: number; perRoll?: number };

export function packCounts(i: PackInput) {
  const up = (n: number, step: number) => Math.ceil(n / step) * step;
  const w = (n: number, pct: number) => Math.ceil(n * (1 + pct / 100));
  const u = {
    A1: Math.ceil(i.coffee_kg / 0.25) + Math.ceil(i.qishr_packs), A3: Math.ceil(i.yemeni_kg / 0.1),
    dates: Math.ceil(i.dates_250_kg / 0.25) + Math.ceil(i.dates_500_kg / 0.5) + Math.ceil(i.dates_1kg_kg),
    d250: Math.ceil(i.dates_250_kg / 0.25), dBig: Math.ceil(i.dates_500_kg / 0.5) + Math.ceil(i.dates_1kg_kg),
    B1: i.b1_boxes, B5: i.b5_boxes, spice: i.spice_packs, small: i.small_packs,
  };
  const b1 = (k: keyof typeof B1_MIX) => Math.round(u.B1 * B1_MIX[k] / 100);
  const cups = b1('D24') * 24 + b1('D12') * 12 + u.B5 * 6;
  const pouch = (n: number) => Math.max(MOQ_POUCH, up(w(n, i.waste_pouches), 100));
  const small = Math.ceil(i.bagged_orders * (1 - i.medium_share / 100));
  const medium = Math.max(Math.ceil(i.bagged_orders * i.medium_share / 100), u.B1);
  const strip = (code: string, n: number, why: string): PackRow =>   // bundles of 50 by type
    ({ group: 'Boxes', code, name: STRIPS[code], need: n, why, order: up(w(n, WASTE.boxes), 50) });
  const lab = (code: string, n: number, why: string): PackRow => {
    const order = up(w(n, i.waste_labels), 100), pr = perRoll(ROLLS[code][1]);   // ordered in hundreds
    return { group: 'Label rolls (blank, from China)', code, name: ROLLS[code][0], need: n, why, order, rolls: Math.ceil(order / pr), perRoll: pr };
  };
  const rows: PackRow[] = [
    { group: 'Pouches', code: 'A1', name: '250 g coffee pouch', need: u.A1, why: 'coffee kg ÷ 0.25, plus qishr pouches', order: pouch(u.A1) },
    { group: 'Pouches', code: 'A3', name: '100 g Yemeni pouch (black and gold)', need: u.A3, why: 'Yemeni kg ÷ 0.1', order: pouch(u.A3) },
    { group: 'Pouches', code: 'A4', name: 'Spice-pack sachet', need: u.spice, why: 'one per pack', order: pouch(u.spice) },
    { group: 'Pouches', code: 'A5', name: 'Saffron and small-pack pouch', need: u.small, why: 'one per pack', order: pouch(u.small) },
    { group: 'Boxes', code: 'B1', name: 'Gift box 320 × 240 × 40', need: u.B1, why: 'boxes', order: up(w(u.B1, WASTE.boxes), 10) },
    strip('B1-L6', b1('D24') * 3, `${b1('D24')} D24 grids × 3`), strip('B1-S4', b1('D24') * 5, `${b1('D24')} D24 grids × 5`),
    strip('B1-L4', b1('D12') * 2, `${b1('D12')} D12 grids × 2`), strip('B1-S3', b1('D12') * 3, `${b1('D12')} D12 grids × 3`),
    { group: 'Boxes', code: 'B5', name: 'Small date box 205 × 135 × 40 (its strips below)', need: u.B5, why: 'boxes', order: up(w(u.B5, WASTE.boxes), 10) },
    strip('B5-L3', u.B5, `${u.B5} B5 (a) grids × 1`), strip('B5-S2', u.B5 * 2, `${u.B5} B5 (a) grids × 2`),
    { group: 'Boxes', code: 'B4-B1', name: 'Sleeve B1 50 × 605 (vertical)', need: u.B1, why: 'one per gift box', order: up(w(u.B1, WASTE.boxes), 10) },
    { group: 'Boxes', code: 'B4-B5', name: 'Sleeve B5 50 × 515 (horizontal)', need: u.B5, why: 'one per small box', order: up(w(u.B5, WASTE.boxes), 10) },
    { group: 'Boxes', code: 'B3', name: 'Paper cups', need: cups, why: 'D24 × 24 + D12 × 12 + B5 × 6', order: up(w(cups, WASTE.cups), 500) },
    // the clear cover over the dates lies on the grid, under the lid: one size per box
    { group: 'Boxes', code: 'Cover', name: 'Clear cover, B1 size (about 305 × 225)', need: u.B1, why: 'one per gift box', order: up(w(u.B1, WASTE.boxes), 10) },
    { group: 'Boxes', code: 'Cover', name: 'Clear cover, B5 size (about 191 × 121)', need: u.B5, why: 'one per small box', order: up(w(u.B5, WASTE.boxes), 10) },
    { group: 'Boxes', code: 'S1', name: 'Single-date wrapper (stuffed dates)', need: i.stuffed_dates, why: 'one per stuffed date', order: i.stuffed_dates ? up(w(i.stuffed_dates, WASTE.cups), 100) : 0 },
    { group: 'Bags', code: 'C-S', name: 'Small paper bag', need: small, why: `${i.bagged_orders} bagged orders × ${100 - i.medium_share}%`, order: up(w(small, WASTE.bags), 50) },
    { group: 'Bags', code: 'C-M', name: 'Medium paper bag', need: medium, why: `${i.medium_share}% of orders, at least one per gift box`, order: up(w(medium, WASTE.bags), 50) },
    { group: 'Bags', code: 'H', name: 'Cloth tote (sold)', need: i.totes, why: 'your number', order: up(i.totes, 50) },
    { group: 'Bags', code: 'T', name: 'Yemeni gift tag + cord', need: u.A3, why: 'one per Yemeni pouch', order: up(w(u.A3, i.waste_labels), 100) },
    // the three A6 cards, printed in China: one of each in every bagged order (owners, 9 Oct)
    { group: 'Cards', code: 'D', name: 'Thank-you card', need: i.bagged_orders, why: 'one per bagged order', order: up(i.bagged_orders, 100) },
    { group: 'Cards', code: 'D', name: 'Date guide card', need: i.bagged_orders, why: 'one per bagged order', order: up(i.bagged_orders, 100) },
    { group: 'Cards', code: 'D', name: 'Coffee guide card', need: i.bagged_orders, why: 'one per bagged order', order: up(i.bagged_orders, 100) },
    lab('E1', u.A1, 'one per 250 g pouch (coffee and qishr)'),
    lab('E1b', u.A1 + u.spice, '250 g backs + spice packs'),
    lab('E12', u.dBig, 'one per 500 g or 1 kg dates pack, with everything on it'),
    lab('E12s', u.d250, 'one per 250 g dates tray, on its top, with everything on it'),
    lab('E2', u.B1 + u.B5, 'one per gift box'),
    lab('E3', u.B1 + u.B5, 'box bottoms'),
    lab('E4', Math.ceil((u.B1 + u.B5) * i.seasonal_share / 100), `${i.seasonal_share}% of gift boxes`),
    lab('E14', u.B1 + u.B5 + Math.ceil(i.stuffed_dates / 12), 'one per box side (B1 and B5); a stuffed-date box takes two (English, French)'),
    lab('E6', u.small * 2, 'front and back of each small pack'),
    lab('E7', u.A3, 'one per Yemeni pouch'), lab('E8', u.A3, 'one per Yemeni pouch'), lab('E9', u.A3, 'one per Yemeni pouch'),
    ...(i.stuffed_dates ? [lab('E11', i.stuffed_dates, 'one per stuffed date, on its wrapper')] : []),
    ...(i.style_boxes ? [lab('E13', i.style_boxes, 'one per coffee style or tasting set: holds the bag and its packs together')] : []),
  ];
  return { units: u, rows, labels: rows.filter(r => r.rolls).reduce((s, r) => s + r.order, 0) };
}
