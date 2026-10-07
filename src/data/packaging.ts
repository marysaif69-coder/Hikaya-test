// Packaging quantities for the China order (desk → Numbers → Packaging). Every count is
// units of each product × pieces per unit, plus a waste allowance, rounded up to the order step.
// The same formula is in the packaging pack (calc.js) that filled the China brief v4.

// Labels per roll: 2-inch core (Ø50.8), outside Ø100, label + liner about 0.14 mm, 3 mm gap.
// Roll length = π (50² − 25.4²) / 0.14 ≈ 41.6 m.
const ROLL_MM = Math.PI * (50 * 50 - 25.4 * 25.4) / 0.14, GAP = 3;
export const perRoll = (h: number) => Math.floor(ROLL_MM / (h + GAP));

export type PackInput = {
  coffee_kg: number; yemeni_kg: number; qishr_packs: number; dates_250_kg: number; dates_500_kg: number; dates_1kg_kg: number;
  b1_boxes: number; b5_boxes: number; spice_packs: number; small_packs: number;
  seasonal_share: number; bagged_orders: number; medium_share: number; totes: number;
  waste_labels: number; waste_pouches: number;
};

/** The brief's placeholder quantities, until the kilo forecast is set. */
export const PACK_DEFAULTS: PackInput = {
  coffee_kg: 250, yemeni_kg: 100, qishr_packs: 0, dates_250_kg: 125, dates_500_kg: 300, dates_1kg_kg: 400,
  b1_boxes: 300, b5_boxes: 600, spice_packs: 300, small_packs: 300,
  seasonal_share: 100, bagged_orders: 1200, medium_share: 25, totes: 100, waste_labels: 8, waste_pouches: 5,
};

export const PACK_FIELDS: [keyof PackInput, string, string][] = [
  ['coffee_kg', 'Coffee', '250 g coffee, kg'], ['yemeni_kg', 'Coffee', 'Yemeni 100 g, kg'], ['qishr_packs', 'Coffee', 'Qishr 100 g (in the 250 g pouch), count'],
  ['spice_packs', 'Coffee', 'Spice packs 25 g, count'], ['small_packs', 'Coffee', 'Saffron and small packs, count'],
  ['dates_250_kg', 'Dates', 'In 250 g bags, kg'], ['dates_500_kg', 'Dates', 'In 500 g bags, kg'], ['dates_1kg_kg', 'Dates', 'In 1 kg bags, kg'],
  ['b1_boxes', 'Dates', 'Gift boxes B1'], ['b5_boxes', 'Dates', 'Small boxes B5'],
  ['bagged_orders', 'Orders and waste', 'Orders that get a paper bag'], ['medium_share', 'Orders and waste', 'Of those, medium bag %'],
  ['seasonal_share', 'Orders and waste', 'Boxes with a season sticker %'], ['totes', 'Orders and waste', 'Totes'],
  ['waste_labels', 'Orders and waste', 'Label waste %'], ['waste_pouches', 'Orders and waste', 'Pouch waste %'],
];

const ROLLS: Record<string, [string, number]> = {
  E1: ['80 × 80 coffee front', 80], E1b: ['100 × 100 coffee back, spice packs, dates front', 100], E2: ['Ø76 box seal', 76],
  E3: ['100 × 90 dates back, box bottom', 90], E4: ['Ø50 Ramadan / Eid', 50], E5: ['100 × 40 box side (name, origin, ingredients)', 40],
  E6: ['60 × 66 saffron and small packs, front and back', 66],
  E7: ['Ø30 Yemeni region seal', 30], E8: ['60 × 34 Yemeni lot card', 34], E9: ['82 × 66 Yemeni Nutrition Facts', 66],
};
const B1_MIX = { D24: 50, C12: 33, C2: 17 };   // % of gift boxes by insert
const WASTE = { boxes: 3, bags: 5, cups: 5 };
const MOQ_POUCH = 500;

export type PackRow = { group: string; code: string; name: string; need: number; why: string; order: number; rolls?: number; perRoll?: number };

export function packCounts(i: PackInput) {
  const up = (n: number, step: number) => Math.ceil(n / step) * step;
  const w = (n: number, pct: number) => Math.ceil(n * (1 + pct / 100));
  const u = {
    A1: Math.ceil(i.coffee_kg / 0.25) + Math.ceil(i.qishr_packs), A3: Math.ceil(i.yemeni_kg / 0.1),
    dates: Math.ceil(i.dates_250_kg / 0.25) + Math.ceil(i.dates_500_kg / 0.5) + Math.ceil(i.dates_1kg_kg),
    B1: i.b1_boxes, B5: i.b5_boxes, spice: i.spice_packs, small: i.small_packs,
  };
  const b1 = (k: keyof typeof B1_MIX) => Math.round(u.B1 * B1_MIX[k] / 100);
  const cups = b1('D24') * 24 + b1('C12') * 12 + u.B5 * 6;
  const pouch = (n: number) => Math.max(MOQ_POUCH, up(w(n, i.waste_pouches), 100));
  const small = Math.ceil(i.bagged_orders * (1 - i.medium_share / 100));
  const medium = Math.max(Math.ceil(i.bagged_orders * i.medium_share / 100), u.B1);
  const lab = (code: string, n: number, why: string): PackRow => {
    const order = up(w(n, i.waste_labels), 100), pr = perRoll(ROLLS[code][1]);   // ordered in hundreds
    return { group: 'Label rolls (blank, from China)', code, name: ROLLS[code][0], need: n, why, order, rolls: Math.ceil(order / pr), perRoll: pr };
  };
  const rows: PackRow[] = [
    { group: 'Pouches', code: 'A1', name: '250 g coffee pouch', need: u.A1, why: 'coffee kg ÷ 0.25, plus qishr packs', order: pouch(u.A1) },
    { group: 'Pouches', code: 'A3', name: '100 g Yemeni pouch', need: u.A3, why: 'Yemeni kg ÷ 0.1', order: pouch(u.A3) },
    { group: 'Pouches', code: 'A4', name: '25 g spice-pack sachet', need: u.spice, why: 'one per pack', order: pouch(u.spice) },
    { group: 'Pouches', code: 'A5', name: 'Saffron and small-pack pouch', need: u.small, why: 'one per pack', order: pouch(u.small) },
    { group: 'Boxes', code: 'B1', name: 'Gift box 320 × 240', need: u.B1, why: 'boxes', order: up(w(u.B1, WASTE.boxes), 10) },
    { group: 'Boxes', code: 'B2', name: 'B1 inserts D24 · C12 · C2', need: u.B1, why: `${b1('D24')} · ${b1('C12')} · ${b1('C2')}`, order: up(w(u.B1, WASTE.boxes), 10) },
    { group: 'Boxes', code: 'B5', name: 'Small date box 205 × 135', need: u.B5, why: 'boxes', order: up(w(u.B5, WASTE.boxes), 10) },
    { group: 'Boxes', code: 'B4-B1', name: 'Sleeve B1 50 × 665 (vertical)', need: u.B1, why: 'one per gift box', order: up(w(u.B1, WASTE.boxes), 10) },
    { group: 'Boxes', code: 'B4-B5', name: 'Sleeve B5 50 × 525 (horizontal)', need: u.B5, why: 'one per small box', order: up(w(u.B5, WASTE.boxes), 10) },
    { group: 'Boxes', code: 'B3', name: 'Paper cups', need: cups, why: 'D24 × 24 + C12 × 12 + B5 × 6', order: up(w(cups, WASTE.cups), 500) },
    { group: 'Bags', code: 'C-S', name: 'Small paper bag', need: small, why: `${i.bagged_orders} bagged orders × ${100 - i.medium_share}%`, order: up(w(small, WASTE.bags), 50) },
    { group: 'Bags', code: 'C-M', name: 'Medium paper bag', need: medium, why: `${i.medium_share}% of orders, at least one per gift box`, order: up(w(medium, WASTE.bags), 50) },
    { group: 'Bags', code: 'H', name: 'Cloth tote (sold)', need: i.totes, why: 'your number', order: up(i.totes, 50) },
    { group: 'Bags', code: 'T', name: 'Yemeni gift tag + cord', need: u.A3, why: 'one per Yemeni pouch', order: up(w(u.A3, i.waste_labels), 100) },
    lab('E1', u.A1, 'one per 250 g pouch (coffee and qishr)'),
    lab('E1b', u.A1 + u.spice + u.dates, '250 g backs + spice packs + dates fronts'),
    lab('E2', u.B1 + u.B5, 'one per gift box'),
    lab('E3', u.dates + u.B1 + u.B5 + b1('C12'), 'dates backs + box bottoms (+1 on Coffee & Dates boxes)'),
    lab('E4', Math.ceil((u.B1 + u.B5) * i.seasonal_share / 100), `${i.seasonal_share}% of gift boxes`),
    lab('E5', u.B1 + u.B5, 'one per gift box, on a side'),
    lab('E6', u.small * 2, 'front and back of each small pack'),
    lab('E7', u.A3, 'one per Yemeni pouch'), lab('E8', u.A3, 'one per Yemeni pouch'), lab('E9', u.A3, 'one per Yemeni pouch'),
  ];
  return { units: u, rows, labels: rows.filter(r => r.rolls).reduce((s, r) => s + r.order, 0) };
}
