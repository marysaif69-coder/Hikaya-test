// Single source of truth for both sites. Prices are drafts (CAD) until launch.
import TEXT from '../content/products.json';

export type Lang = 'en' | 'ar';
export type L = { en: string; ar: string };

export type Family = 'palm' | 'mountain' | 'house' | 'husk' | 'origin' | 'dates' | 'ramadan' | 'eid';
/** The three coffee lines on the shop: Gulf (palm), Yemeni (mountain, with Jubani and qishr) and Shami (house). */
export type CoffeeLine = 'gulf' | 'yemen' | 'shami';
export type Spice = 'saffron' | 'cardamom' | 'ginger' | 'husk' | 'sesame' | 'cinnamon';
export type DateId = 'sukkari' | 'khalas' | 'khudri' | 'ajwa' | 'medjool' | 'mufattal';
/** What a stuffed date is filled or dipped with (the customer chooses one per box). */
export type FillingId = 'pistachio' | 'pistachio-dipped' | 'biscuit' | 'cashew' | 'caramel-almond';
export type Grind = 'dallah' | 'fine' | 'powder' | 'beans';
export type Allergen = 'milk' | 'sesame' | 'nuts' | 'grain' | 'pistachio' | 'cashew' | 'gluten' | 'soy';

/** A base bag: the coffee itself, with only the spice that belongs in every cup of that line. */
export interface Coffee {
  kind: 'coffee';
  id: string;
  fam: 'palm' | 'mountain' | 'house' | 'husk' | 'origin';
  line: CoffeeLine;
  /** Not on the site until the owners show it in Admin → Shop → Products (the Yemeni beans). */
  startHidden?: true;
  /** Yemeni beans: our own cupping score (SCA, out of 100); unset until the lot is cupped. */
  score?: number;
  name: L;
  /** null = the owners have not set a price yet: the site shows "price coming" and it can't be ordered. */
  price: number | null;
  /** The bag's weight, in each language (Arabic pages show ٢٥٠ غ). */
  size: L;
  roast: number; // 1–4, as printed on the bag; 0 = not roasted (qishr) or not decided
  spices: Spice[];
  /** Every coffee is sold ground; the grind is set with the roaster. Qishr is whole husk. */
  grinds: Grind[];
  notes: L;
  story: L;
  ingredients: [string, string]; // EN, FR — as printed on the label
  taste: L;
  /** Shown as a small label on the shop card, e.g. the one most customers choose. */
  popular?: boolean;
  /** Flat front/back artwork from the packaging mockups, when one exists. */
  art?: { front: string; back: string };
  /** Bunn speaks first; Tamr answers with the date that goes with this cup. */
  bunn: L;
  /** The date that goes with it. Not set until the tasting: then no pairing shows anywhere. */
  date?: DateId;
  why: L;
}

/** A sealed pack (sachet) that turns a base bag into a family style. Sold inside kits and on its own as a refill. */
export interface Pack {
  kind: 'pack';
  id: string;
  fam: 'palm' | 'mountain';
  line: CoffeeLine;
  /** The base bag this pack is made for. */
  for: string;
  name: L;
  price: number | null;
  size: L;
  notes: L;
  contents: L;
  ingredients: [string, string];
  allergens: Allergen[];
  /** Still to be confirmed with the recipe, e.g. "may contain barley". */
  maybe?: L;
  c: string;
}

/** A family style (base bag + its packs, one price) or a discovery pack (base bag + small packs to try). */
export interface Kit {
  kind: 'kit';
  id: string;
  fam: 'palm' | 'mountain';
  line: CoffeeLine;
  base: string;
  parts: { id: string; mini?: boolean }[];
  discovery?: boolean;
  /** One short line on where the style comes from, for the shop card. */
  origin?: L;
  name: L;
  price: number | null;
  notes: L;
  story: L;
  taste: L;
  bunn: L;
  /** Not set until the tasting (see Coffee.date). */
  date?: DateId;
  why: L;
}

export interface Box {
  kind: 'box';
  id: string;
  fam: 'dates' | 'ramadan' | 'eid';
  name: L;
  price: number | null;
  size: L;
  img: string;
  insert: 'everyday' | 'D24' | 'C12' | 'C2';
  sleeve: 'regular' | 'ramadan' | 'eid';
  notes: L;
  contents: L;
  chooseDate?: boolean;
  preorder: true;
  /** Everyday dates sold by weight: grams in the pack. */
  grams?: number;
  /** Reserve and stuffed boxes: dates in the box. */
  count?: number;
  /** The varieties the customer can choose from (chooseDate boxes). */
  varieties?: DateId[];
  /** Stuffed boxes: the fillings the customer can choose from (one per box). */
  fillings?: FillingId[];
  allergens?: Allergen[];
  tier?: 'everyday' | 'reserve' | 'stuffed' | 'gift';
  /** Offers "Mixed · مشكّل": the dates (or fillings) split evenly across the kinds on offer. */
  mixed?: boolean;
  /** Boxes with two choices in one option string, e.g. "najdi|mixed" (Coffee & Dates) or "najdi|hadrami" (Two Coffees). */
  picks?: ('coffee' | 'reserve')[];
  /** No longer sold (a season now changes the sleeve, not the product). Kept so old orders, lots and labels still read. */
  retired?: true;
  /** What goes inside, for the weekly roast and pack sheet: 250 g base bags, sealed packs, dates by variety (pieces). */
  packs?: { coffee?: Record<string, number>; sachets?: Record<string, number>; dates?: Partial<Record<DateId, number>> };
}

export type Product = Coffee | Pack | Kit | Box;
export type Sleeve = 'regular' | 'ramadan' | 'eid';

export const FAMILIES: Record<Family, { name: L; line: L }> = {
  palm: { name: { en: 'Gulf', ar: 'الخليج' }, line: { en: 'Pale and golden, poured from the dallah. One bag, taken your way.', ar: 'شقراء وذهبية، تُصبّ من الدلّة. كيس واحد، تشربه بطريقتك.' } },
  mountain: { name: { en: 'Yemen', ar: 'اليمن' }, line: { en: 'Yemeni-style coffee from Ethiopian beans, with cardamom. The ginger and each town’s additions come in the packs.', ar: 'قهوة على الطريقة اليمنية من حبوب إثيوبية، بالهيل. والزنجبيل وإضافة كل بلدة في الظروف.' } },
  house: { name: { en: 'Shami', ar: 'الشام' }, line: { en: 'Shami coffee, ground to powder and boiled in the rakwa.', ar: 'القهوة الشامية، مطحونة كالبودرة وتُغلى في الركوة.' } },
  origin: { name: { en: 'Yemeni beans', ar: 'بن اليمن' }, line: { en: 'From the mountain terraces of Yemen, where the story of coffee began.', ar: 'من مدرجات جبال اليمن، حيث بدأت حكاية القهوة.' } },
  husk: { name: { en: 'Qishr', ar: 'القشر' }, line: { en: 'Qishr – dried coffee cherry husk, with ginger.', ar: 'القشر – قشر ثمرة البن المجفف، مع الزنجبيل.' } },
  dates: { name: { en: 'Dates', ar: 'التمر' }, line: { en: 'Everyday dates by weight; Reserve and stuffed in boxes.', ar: 'تمر كل يوم بالوزن، والنخبة والمحشي في علب.' } },
  ramadan: { name: { en: 'Ramadan', ar: 'رمضان' }, line: { en: 'For the table at sunset.', ar: 'لمائدة الغروب.' } },
  eid: { name: { en: 'Eid edition', ar: 'إصدار العيد' }, line: { en: 'For the visits, not for wrapping paper.', ar: 'للزيارات، لا لورق الهدايا.' } },
};

export const LINES: Record<CoffeeLine, { name: L; line: L; fam: 'palm' | 'mountain' | 'house' }> = {
  gulf: { fam: 'palm', name: { en: 'Gulf coffee', ar: 'القهوة الخليجية' }, line: FAMILIES.palm.line },
  yemen: { fam: 'mountain', name: { en: 'Yemeni coffee', ar: 'القهوة اليمنية' }, line: FAMILIES.mountain.line },
  shami: { fam: 'house', name: { en: 'Shami coffee', ar: 'القهوة الشامية' }, line: FAMILIES.house.line },
};

export const SPICES: Record<Spice, { c: string; name: L }> = {
  saffron: { c: '#A93B28', name: { en: 'Saffron', ar: 'زعفران' } },
  cardamom: { c: '#5E7A2E', name: { en: 'Cardamom', ar: 'هيل' } }, // the one green: the cardamom dot
  ginger: { c: '#CF9C0C', name: { en: 'Ginger', ar: 'زنجبيل' } },
  husk: { c: '#8E2F1F', name: { en: 'Qishr', ar: 'قشر' } },
  sesame: { c: '#D9C08A', name: { en: 'Sesame', ar: 'سمسم' } },
  cinnamon: { c: '#7A3E1D', name: { en: 'Cinnamon', ar: 'قرفة' } },
};

export const GRINDS: Record<Grind, L> = {
  dallah: { en: 'Coarse, for Gulf coffee', ar: 'طحنة خشنة للقهوة الخليجية' }, // id kept: saved carts and orders use it
  fine: { en: 'Fine, for the pot', ar: 'طحنة ناعمة للإبريق' },
  powder: { en: 'Powder-fine, for the rakwa', ar: 'ناعمة كالبودرة للركوة' },
  beans: { en: 'Whole roasted beans', ar: 'حبوب محمّصة كاملة' },
};

/** Allergens live only in the sealed packs. The coffee bags hold coffee and spices, nothing else. */
export const ALLERGENS: Record<Allergen, L> = {
  milk: { en: 'Milk', ar: 'حليب' },
  sesame: { en: 'Sesame', ar: 'سمسم' },
  nuts: { en: 'Tree nuts (almonds)', ar: 'مكسرات (لوز)' },
  grain: { en: 'Grain (sorghum)', ar: 'حبوب (ذرة رفيعة)' },
  pistachio: { en: 'Tree nuts (pistachio)', ar: 'مكسرات (فستق)' },
  cashew: { en: 'Tree nuts (cashew)', ar: 'مكسرات (كاجو)' },
  gluten: { en: 'Wheat (gluten)', ar: 'قمح (غلوتين)' },
  soy: { en: 'Soy', ar: 'صويا' },
};

export const DATES: Record<DateId, { name: L; region: L; c: string; sweet: number; notes: L }> = {
  sukkari: { name: { en: 'Sukkari Qassimi', ar: 'سكري قصيمي' }, region: { en: 'Qassim', ar: 'القصيم' }, c: '#C98A3A', sweet: 95, notes: { en: 'Very sweet, soft to crisp, caramel.', ar: 'حلو جداً، طري إلى مقرمش، كراميل.' } },
  khalas: { name: { en: 'Khalas', ar: 'خلاص' }, region: { en: 'Al-Ahsa', ar: 'الأحساء' }, c: '#8E4A22', sweet: 80, notes: { en: 'Toffee and caramel, soft and moist.', ar: 'توفي وكراميل، طري ورطب.' } },
  medjool: { name: { en: 'Medjool', ar: 'مجدول' }, region: { en: '[TBD: the supplier’s origin]', ar: '[يُحدد لاحقاً: منشأ المورّد]' }, c: '#6E3420', sweet: 85, notes: { en: 'Large and fleshy, honey-caramel.', ar: 'كبيرة ولحمية، عسل وكراميل.' } },
  khudri: { name: { en: 'Khudri', ar: 'خضري' }, region: { en: 'Arabia', ar: 'الجزيرة العربية' }, c: '#5B2E17', sweet: 55, notes: { en: 'Firmer and darker, less sweet.', ar: 'أصلب وأغمق، أقل حلاوة.' } },
  ajwa: { name: { en: 'Ajwa', ar: 'عجوة' }, region: { en: 'Madinah', ar: 'المدينة' }, c: '#2B1710', sweet: 50, notes: { en: 'Small and near-black, gentle fruit.', ar: 'صغيرة شبه سوداء، فاكهية رقيقة.' } },
  mufattal: { name: { en: 'Royal Sukkari Mufattal', ar: 'سكري ملكي مفتّل' }, region: { en: 'Qassim', ar: 'القصيم' }, c: '#B57A34', sweet: 95, notes: { en: '[TBD]', ar: '[يُحدد لاحقاً]' } },
};
// Khudri stays in DATES so old orders, regular orders and lots still read, but no product offers it.

/** The three date tiers. Varieties may change with what arrives: change them here. */
export const EVERYDAY: DateId[] = ['khalas', 'sukkari'];
export const RESERVE: DateId[] = ['mufattal', 'ajwa', 'medjool'];
/** The varieties a box lets the customer choose, and the one picked first. */
export const varietiesOf = (b: Box) => b.varieties ?? [];
export const defaultVariety = (b: Box) => varietiesOf(b)[0] ?? '';

/** Stuffed-date fillings. `hold`: not sold until the owners decide (caramel with almonds: milk). */
export const FILLINGS: Record<FillingId, { name: L; allergens: Allergen[]; maybe?: L; hold?: boolean }> = {
  pistachio: { name: { en: 'Pistachio stuffed', ar: 'محشي بالفستق' }, allergens: ['pistachio'] },
  'pistachio-dipped': { name: { en: 'Dipped in pistachio', ar: 'مغطّى بالفستق' }, allergens: ['pistachio'], maybe: { en: '[TBD: the coating; milk and soy if chocolate]', ar: '[يُحدد لاحقاً: الغلاف؛ حليب وصويا إن كان شوكولاتة]' } },
  // Brand name "Lotus" waits for the owners (Settings → Decisions); until then the plain name.
  biscuit: { name: { en: 'Biscuit cream', ar: 'كريمة البسكويت' }, allergens: ['gluten', 'soy'], maybe: { en: '[TBD: from the jar’s label]', ar: '[يُحدد لاحقاً: من ملصق العلبة]' } },
  cashew: { name: { en: 'Cashew stuffed', ar: 'محشي بالكاجو' }, allergens: ['cashew'] },
  'caramel-almond': { name: { en: 'Caramel with almonds', ar: 'كراميل باللوز' }, allergens: ['nuts', 'milk'], hold: true },
};
export const FILLINGS_ON_SALE = (Object.keys(FILLINGS) as FillingId[]).filter(f => !FILLINGS[f].hold);
/** What the customer chooses for a box: a filling (stuffed) or a variety (chooseDate); empty when nothing. */
export const boxOptions = (b: Box): string[] => b.fillings ?? (b.chooseDate ? varietiesOf(b) : []);
// (Mixed and the two-choice boxes: see dateChoices and boxOptionLabel below BOXES.)

const C = (c: Omit<Coffee, 'kind' | 'size' | 'price'> & { size?: L; price?: number | null }): Coffee => ({ kind: 'coffee', size: { en: '250 g', ar: '٢٥٠ غ' }, price: null, ...c });

// Prices are not set yet ([TBD]): the owners set each one in Admin → Shop → Products, and until then
// the site says "price coming" and the item can't be ordered. Roast levels are the working plan until
// the cupping (about 20 October) and the blind tasting (3–10 November).
export const COFFEES: Coffee[] = [
  C({ id: 'gulf', line: 'gulf', fam: 'palm', name: { en: 'Gulf coffee', ar: 'قهوة خليجية' }, roast: 1, spices: ['cardamom'], grinds: ['dallah'],
    taste: { en: 'Golden · cardamom · light', ar: 'ذهبية · هيل · خفيفة' },
    notes: { en: 'Blonde roast, coarse ground, cardamom already mixed in. Drink it as it is, or add the packs that make it the way you take it at home.', ar: 'تحميص أشقر، طحنة خشنة، والهيل مخلوط فيها. اشربها كما هي، أو أضف الظروف التي تجعلها كما تشربها في بيتك.' },
    story: { en: 'The pale qahwa of Arabia, poured from the dallah into a small cup. This one bag is the start of every Gulf style we make; the packs do the rest.', ar: 'قهوة الجزيرة الشقراء، تُصبّ من الدلّة في فنجان صغير. هذا الكيس بداية كل طريقة خليجية نصنعها، والظروف تكمل الباقي.' },
    ingredients: ['Coffee, cardamom.', 'Café, cardamome.'],
    bunn: { en: 'Cardamom only. Add what you like.', ar: 'هيل فقط، وأضف ما تحبه.' },
    why: { en: 'Toffee-soft Khalas with a pale cup.', ar: 'خلاص الطرية مع فنجان أشقر.' } }),
  C({ id: 'yemeni', line: 'yemen', fam: 'mountain', name: { en: 'Yemeni qahwa', ar: 'قهوة يمنية' }, roast: 2, spices: ['cardamom'], grinds: ['fine'],
    taste: { en: 'Soft · fruity · cardamom', ar: 'ناعمة · فاكهية · هيل' },
    notes: { en: 'Yemeni-style, from Ethiopian beans. Medium-light roast, fine ground, with cardamom mixed in. The ginger comes in the packs.', ar: 'على الطريقة اليمنية، من حبوب إثيوبية. تحميص متوسط فاتح، طحنة ناعمة، والهيل مخلوط فيها. والزنجبيل يأتي في الظروف.' },
    story: { en: 'Coffee the way Yemeni homes make it, in the pot. On its own it is a clean cardamom cup. With a pack, ginger and all, it becomes Hadrami, Rada’i or Baydani.', ar: 'القهوة كما تصنعها البيوت اليمنية، في الإبريق. وحدها فنجان صافٍ بالهيل، ومع ظرف، بزنجبيله وكل ما فيه، تصير حضرمية أو رداعية أو بيضانية.' },
    ingredients: ['Coffee, cardamom.', 'Café, cardamome.'],
    bunn: { en: 'Cardamom in me. The ginger waits in the pack.', ar: 'فيّ الهيل، والزنجبيل ينتظر في الظرف.' },
    why: { en: 'Honeyed Medjool with a cardamom cup.', ar: 'المجدول العسلي مع فنجان الهيل.' } }),
  C({ id: 'jubani', line: 'yemen', fam: 'mountain', name: { en: 'Jubani', ar: 'جُبَني' }, roast: 2, spices: ['husk'], grinds: ['fine'],
    taste: { en: 'Dried fruit · soft · sweet', ar: 'فاكهة مجففة · ناعمة · حلوة' },
    notes: { en: 'Yemeni-style coffee with qishr, its own dried husk, ground together in one bag. [TBD: with ginger or plain]', ar: 'قهوة على الطريقة اليمنية مع القشر، قشرها المجفف، مطحونان معاً في كيس واحد. [يُحدد لاحقاً: بالزنجبيل أو سادة]' },
    story: { en: 'The bean and its husk in one pot, the way Juban makes it.', ar: 'الحبّة وقشرها في إبريق واحد، على طريقة جُبَن.' },
    ingredients: ['Coffee, coffee cherry husk. [TBD: ginger]', 'Café, écorces de cerise de café. [TBD : gingembre]'],
    bunn: { en: 'Me, and my own husk.', ar: 'أنا، ومعي قشري.' },
    why: { en: 'Sukkari answers the dried-fruit note.', ar: 'السكري يجاوب طعم الفاكهة المجففة.' } }),
  C({ id: 'qishr', line: 'yemen', fam: 'husk', name: { en: 'Qishr', ar: 'قشر' }, roast: 0, spices: ['husk', 'ginger'], grinds: [],
    taste: { en: 'Cherry · ginger · light', ar: 'كرز · زنجبيل · خفيفة' },
    notes: { en: 'Qishr – dried coffee cherry husk, with ginger. Brewed in the pot like tea, light on caffeine. [TBD: roasted or raw husk]', ar: 'القشر – قشر ثمرة البن المجفف، مع الزنجبيل. يُغلى في الإبريق مثل الشاي، قليل الكافيين. [يُحدد لاحقاً: قشر محمّص أو نيء]' },
    story: { en: "Yemen's oldest coffee drink, older than the roasted bean.", ar: 'أقدم مشروبات البن في اليمن، أقدم من الحبّة المحمّصة.' },
    ingredients: ['Coffee cherry husk, ginger.', 'Écorces de cerise de café, gingembre.'],
    bunn: { en: 'I was a husk before the bean.', ar: 'كنتُ قشراً قبل البُن.' },
    why: { en: 'Cherry and caramel.', ar: 'كرز وكراميل.' } }),
  C({ id: 'shami', popular: true, line: 'shami', fam: 'house', name: { en: 'Shami coffee with cardamom', ar: 'شامية بالهيل' }, roast: 3, spices: ['cardamom'], grinds: ['powder'],
    taste: { en: 'Thick · bittersweet · cardamom', ar: 'كثيفة · مُرّة حلوة · هيل' },
    notes: { en: 'Brazilian beans, medium roast, ground to powder, with cardamom. The everyday Shami cup.', ar: 'حبوب برازيلية، تحميص متوسط، مطحونة كالبودرة، بالهيل. فنجان الشامية لكل يوم.' },
    story: { en: 'The Shami rakwa: powder-fine coffee boiled slowly, with cardamom, the way homes in the Levant make it.', ar: 'الركوة الشامية: قهوة ناعمة كالبودرة تُغلى على مهل، بالهيل، كما في بيوت الشام.' },
    ingredients: ['Coffee, cardamom.', 'Café, cardamome.'],
    bunn: { en: 'Fine, for the rakwa.', ar: 'ناعمة، للركوة.' },
    why: { en: 'A soft Medjool after a thick cup.', ar: 'مجدول طري بعد فنجان كثيف.' } }),
  C({ id: 'shami-sada', line: 'shami', fam: 'house', name: { en: 'Shami sada', ar: 'شامية سادة' }, roast: 3, spices: [], grinds: ['powder'],
    taste: { en: 'Thick · chocolatey · plain', ar: 'كثيفة · شوكولاتية · سادة' },
    notes: { en: 'The same Shami coffee, nothing added.', ar: 'القهوة الشامية نفسها، بلا إضافات.' },
    story: { en: 'For those who take their coffee plain and their sweetness from the date.', ar: 'لمن يشرب قهوته سادة ويأخذ حلاوته من التمرة.' },
    ingredients: ['Coffee.', 'Café.'],
    bunn: { en: "I'm bitter today.", ar: 'أنا مُرّ اليوم.' },
    why: { en: 'Then take two dates.', ar: 'خذ تمرتين إذن.' } }),
];

const P = (p: Omit<Pack, 'kind' | 'price' | 'size'> & { price?: number | null }): Pack => ({ kind: 'pack', price: null, size: { en: 'One pack mixes into one 250 g bag [TBD: grams]', ar: 'ظرف واحد يُخلط في كيس ٢٥٠ غ [يُحدد لاحقاً: الوزن]' }, ...p });

export const PACKS: Pack[] = [
  P({ id: 'pack-saffron', line: 'gulf', fam: 'palm', for: 'gulf', c: '#A93B28', name: { en: 'Saffron packet', ar: 'ظرف زعفران' },
    notes: { en: 'What makes Gulf coffee Najdi. Keep it sealed until you make a pot: soak a little in hot water, put it in the serving dallah and pour the coffee over it. Never boiled.', ar: 'هو ما يجعل القهوة الخليجية نجدية. أبقِه مختوماً حتى تحضّر الإبريق: انقع قليلاً منه في ماء ساخن، وضعه في دلّة التقديم وصبّ القهوة فوقه. لا يُغلى أبداً.' },
    contents: { en: 'Saffron, sealed.', ar: 'زعفران، مختوم.' }, ingredients: ['Saffron.', 'Safran.'], allergens: [] }),
  P({ id: 'pack-qassim', line: 'gulf', fam: 'palm', for: 'gulf', c: '#C98A3A', name: { en: 'Qassim blend pack', ar: 'خلطة قصيمية' },
    notes: { en: 'The Qassimi spice blend for Gulf coffee. Pour it into the bag and shake; the saffron goes in the serving dallah at the end, and you add evaporated milk when you make each pot.', ar: 'خلطة البهار القصيمية للقهوة الخليجية. اسكبها في الكيس ورجّه؛ والزعفران يوضع في دلّة التقديم في النهاية، وتضيف الحليب المبخّر عند تحضير كل إبريق.' },
    contents: { en: 'Qassimi spices. No milk: you add evaporated milk. [TBD: full list]', ar: 'بهارات قصيمية. بلا حليب: تضيف الحليب المبخّر بنفسك. [يُحدد لاحقاً: القائمة الكاملة]' },
    ingredients: ['Spices. [TBD: full list] May contain barley [TBD].', 'Épices. [TBD : liste complète] Peut contenir de l’orge [TBD].'], allergens: [],
    maybe: { en: 'May contain barley [TBD]', ar: 'قد تحتوي على الشعير [يُحدد لاحقاً]' } }),
  P({ id: 'pack-hijazi', line: 'gulf', fam: 'palm', for: 'gulf', c: '#5E7A2E', name: { en: 'Hijazi blend pack', ar: 'خلطة حجازية' },
    notes: { en: 'The Hijazi blend for Gulf coffee. Pour it into the bag and shake; the saffron goes in the serving dallah at the end.', ar: 'الخلطة الحجازية للقهوة الخليجية. اسكبها في الكيس ورجّه؛ والزعفران يوضع في دلّة التقديم في النهاية.' },
    contents: { en: 'Hijazi spices. [TBD: full list, with or without mastic]', ar: 'بهارات حجازية. [يُحدد لاحقاً: القائمة الكاملة، مع المستكة أو بدونها]' },
    ingredients: ['Spices. [TBD: full list]', 'Épices. [TBD : liste complète]'], allergens: [],
    maybe: { en: 'Allergens confirmed with the final recipe [TBD]', ar: 'مسببات الحساسية تُؤكد مع الوصفة النهائية [يُحدد لاحقاً]' } }),
  P({ id: 'pack-hadrami', line: 'yemen', fam: 'mountain', for: 'yemeni', c: '#8E4A22', name: { en: 'Hadrami pack', ar: 'خلطة حضرمية' },
    notes: { en: 'Ginger and the Hadrami additions, for Yemeni qahwa the way Hadramawt makes it.', ar: 'الزنجبيل وإضافات حضرموت، للقهوة اليمنية كما تصنعها حضرموت.' },
    contents: { en: 'Ginger. [TBD: the rest]', ar: 'زنجبيل. [يُحدد لاحقاً: الباقي]' },
    ingredients: ['Ginger. [TBD: the rest]', 'Gingembre. [TBD : le reste]'], allergens: [],
    maybe: { en: 'Allergens confirmed with the final recipe [TBD]', ar: 'مسببات الحساسية تُؤكد مع الوصفة النهائية [يُحدد لاحقاً]' } }),
  P({ id: 'pack-radai', line: 'yemen', fam: 'mountain', for: 'yemeni', c: '#D9C08A', name: { en: 'Rada’i pack', ar: 'خلطة رداعية' },
    notes: { en: 'Ginger, roasted sesame and almonds, for Yemeni qahwa the way Rada’a makes it.', ar: 'زنجبيل وسمسم محمّص ولوز، للقهوة اليمنية على طريقة رداع.' },
    contents: { en: 'Ginger, roasted sesame, almonds.', ar: 'زنجبيل، سمسم محمّص، لوز.' },
    ingredients: ['Ginger, roasted sesame, almonds. Contains: sesame, almonds.', 'Gingembre, sésame grillé, amandes. Contient : sésame, amandes.'], allergens: ['sesame', 'nuts'] }),
  P({ id: 'pack-baydani', line: 'yemen', fam: 'mountain', for: 'yemeni', c: '#7A3E1D', name: { en: 'Baydani pack', ar: 'خلطة بيضانية' },
    notes: { en: 'Ginger and roasted sorghum, for Yemeni qahwa the way Al-Bayda makes it: toasty and lightly sweet.', ar: 'زنجبيل وذرة رفيعة محمّصة، للقهوة اليمنية على طريقة البيضاء: محمّصة وحلوة قليلاً.' },
    contents: { en: 'Ginger, roasted sorghum. [TBD: the richer version]', ar: 'زنجبيل، ذرة رفيعة محمّصة. [يُحدد لاحقاً: النسخة الأغنى]' },
    ingredients: ['Ginger, roasted sorghum. [TBD]', 'Gingembre, sorgho grillé. [TBD]'], allergens: ['grain'],
    maybe: { en: 'The richer version may add more [TBD]', ar: 'النسخة الأغنى قد تضيف مكونات أخرى [يُحدد لاحقاً]' } }),
];

const K = (k: Omit<Kit, 'kind' | 'price'> & { price?: number | null }): Kit => ({ kind: 'kit', price: null, ...k });

export const KITS: Kit[] = [
  K({ id: 'najdi', origin: { en: 'Najd’s way: pale and fragrant with saffron', ar: 'على طريقة نجد: شقراء عطرة بالزعفران' }, line: 'gulf', fam: 'palm', base: 'gulf', parts: [{ id: 'pack-saffron' }], name: { en: 'Najdi', ar: 'نجدية' },
    taste: { en: 'Golden · cardamom · saffron', ar: 'ذهبية · هيل · زعفران' },
    notes: { en: 'Gulf coffee and its saffron packet. Cardamom and saffron, golden and light.', ar: 'قهوة خليجية مع ظرف الزعفران. هيل وزعفران، ذهبية وخفيفة.' },
    story: { en: "Najd's way: roasted pale, poured from the dallah into a small cup, always with a date. The saffron is what makes it Najdi, so it is always in the box.", ar: 'على طريقة نجد: تحميص أشقر، تُصبّ من الدلّة في فنجان صغير، ومعها تمرة دائماً. الزعفران هو ما يجعلها نجدية، لذلك هو في العلبة دائماً.' },
    bunn: { en: 'Cardamom and saffron.', ar: 'هيل وزعفران.' }, why: { en: 'Toffee-soft Khalas rounds the saffron.', ar: 'خلاص الطرية تُليّن الزعفران.' } }),
  K({ id: 'qassimi', origin: { en: 'The Qassim way: velvety with evaporated milk, warm with spice', ar: 'على طريقة القصيم: قوام مخملي بالحليب المبخّر، ودفء البهار' }, line: 'gulf', fam: 'palm', base: 'gulf', parts: [{ id: 'pack-qassim' }, { id: 'pack-saffron' }], name: { en: 'Qassimi', ar: 'قصيمية' },
    taste: { en: 'Velvety · warm spice · saffron', ar: 'مخملية · بهار دافئ · زعفران' },
    notes: { en: 'Gulf coffee with the Qassim spice blend and the saffron packet. Add evaporated milk as you make it (we tell you how much).', ar: 'قهوة خليجية مع خلطة البهار القصيمية وظرف الزعفران. وتضيف الحليب المبخّر عند التحضير (ونخبرك بالمقدار).' },
    story: { en: 'The Qassim way: the same pale coffee with warm spice, and evaporated milk added at home for a velvety cup.', ar: 'على طريقة القصيم: القهوة الشقراء نفسها بدفء البهار، ويُضاف الحليب المبخّر في البيت لقوام مخملي.' },
    bunn: { en: 'Add the evaporated milk. I’ll do the rest.', ar: 'أضف الحليب المبخّر، وأنا أكمل الباقي.' }, why: { en: 'Sukkari, from Qassim too.', ar: 'السكري، من القصيم أيضاً.' } }),
  K({ id: 'hijazi', origin: { en: 'The Hijaz way: fragrant and aromatic', ar: 'على طريقة الحجاز: عطرة وزكية' }, line: 'gulf', fam: 'palm', base: 'gulf', parts: [{ id: 'pack-hijazi' }, { id: 'pack-saffron' }], name: { en: 'Hijazi', ar: 'حجازية' },
    taste: { en: 'Fragrant · aromatic spice · saffron', ar: 'عطرة · بهار زكي · زعفران' },
    notes: { en: 'Gulf coffee with the Hijazi blend pack and the saffron packet.', ar: 'قهوة خليجية مع الخلطة الحجازية وظرف الزعفران.' },
    story: { en: 'The Hijaz way: the same pale coffee, more fragrant in the cup.', ar: 'على طريقة الحجاز: القهوة الشقراء نفسها، أعطر في الفنجان.' },
    bunn: { en: 'From the west of Arabia.', ar: 'من غرب الجزيرة.' }, why: { en: 'Ajwa, from Madinah.', ar: 'العجوة، من المدينة.' } }),
  K({ id: 'hadrami', origin: { en: 'The Hadramawt way: warm with ginger', ar: 'على طريقة حضرموت: دافئة بالزنجبيل' }, line: 'yemen', fam: 'mountain', base: 'yemeni', parts: [{ id: 'pack-hadrami' }], name: { en: 'Hadrami', ar: 'حضرمية' },
    taste: { en: 'Warm · ginger · spice', ar: 'دافئة · زنجبيل · بهار' },
    notes: { en: 'Yemeni qahwa with the Hadrami pack: ginger and the Hadrami additions.', ar: 'قهوة يمنية مع الخلطة الحضرمية: الزنجبيل وإضافات حضرموت.' },
    story: { en: 'The Hadramawt way, made in the pot.', ar: 'على طريقة حضرموت، تُصنع في الإبريق.' },
    bunn: { en: 'From Hadramawt.', ar: 'من حضرموت.' }, why: { en: 'Soft Khalas for a warm cup.', ar: 'خلاص الطرية لفنجان دافئ.' } }),
  K({ id: 'radai', origin: { en: 'From Rada’a: nutty and toasty, warm with ginger', ar: 'من رداع: بطعم المكسرات المحمّصة ودفء الزنجبيل' }, line: 'yemen', fam: 'mountain', base: 'yemeni', parts: [{ id: 'pack-radai' }], name: { en: 'Rada’i', ar: 'رداعية' },
    taste: { en: 'Nutty · toasted sesame · ginger', ar: 'مكسرات · سمسم محمّص · زنجبيل' },
    notes: { en: 'Yemeni qahwa with the Rada’i pack: ginger, roasted sesame and almonds.', ar: 'قهوة يمنية مع الخلطة الرداعية: زنجبيل وسمسم محمّص ولوز.' },
    story: { en: 'From Rada’a: sesame and almonds in the pot with the coffee.', ar: 'من رداع: السمسم واللوز في الإبريق مع القهوة.' },
    bunn: { en: 'Sesame and almonds, for the cold.', ar: 'سمسم ولوز، للبرد.' }, why: { en: 'Big, honeyed Medjool with the almonds.', ar: 'المجدول العسلي مع اللوز.' } }),
  K({ id: 'baydani', origin: { en: 'From Al-Bayda: toasty and lightly sweet, warm with ginger', ar: 'من البيضاء: محمّصة وحلوة قليلاً، بدفء الزنجبيل' }, line: 'yemen', fam: 'mountain', base: 'yemeni', parts: [{ id: 'pack-baydani' }], name: { en: 'Baydani', ar: 'بيضانية' },
    taste: { en: 'Toasty · lightly sweet · ginger', ar: 'محمّصة · حلوة قليلاً · زنجبيل' },
    notes: { en: 'Yemeni qahwa with the Baydani pack: ginger and roasted sorghum, toasty and lightly sweet.', ar: 'قهوة يمنية مع الخلطة البيضانية: زنجبيل وذرة رفيعة محمّصة، محمّصة وحلوة قليلاً.' },
    story: { en: "Al-Bayda's way: toasty and lightly sweet, warm with ginger.", ar: 'على طريقة البيضاء: محمّصة وحلوة قليلاً، بدفء الزنجبيل.' },
    bunn: { en: 'Al-Bayda’s warmth in my cup.', ar: 'دفء البيضاء في فنجاني.' }, why: { en: 'Khalas toffee with a toasty cup.', ar: 'توفي خلاص مع فنجان محمّص.' } }),
  K({ id: 'taste-gulf', discovery: true, line: 'gulf', fam: 'palm', base: 'gulf', parts: [{ id: 'pack-qassim', mini: true }, { id: 'pack-hijazi', mini: true }, { id: 'pack-saffron' }], name: { en: 'Taste the Gulf', ar: 'تذوّق النكهة الخليجية' },
    taste: { en: 'Najdi · Qassimi · Hijazi', ar: 'نجدية · قصيمية · حجازية' },
    notes: { en: 'One 250 g bag of Gulf coffee, a small Qassim pack, a small Hijazi pack and the saffron packet. Try each style, then choose yours.', ar: 'كيس قهوة خليجية ٢٥٠ غ، وظرف قصيمي صغير، وظرف حجازي صغير، وظرف الزعفران. جرّب كل طريقة، ثم اختر طريقتك.' },
    story: { en: 'For the first time, or for the friend who asks which one is yours.', ar: 'للمرة الأولى، أو للصديق الذي يسأل: أيّها قهوتك؟' },
    bunn: { en: 'Three Gulf cups from one bag.', ar: 'ثلاث قهوات خليجية من كيس واحد.' }, why: { en: 'Khalas goes with all three.', ar: 'خلاص تناسب الثلاث.' } }),
  K({ id: 'taste-yemen', discovery: true, line: 'yemen', fam: 'mountain', base: 'yemeni', parts: [{ id: 'pack-hadrami', mini: true }, { id: 'pack-radai', mini: true }, { id: 'pack-baydani', mini: true }], name: { en: 'Taste Yemen', ar: 'تذوّق النكهة اليمنية' },
    taste: { en: 'Hadrami · Rada’i · Baydani', ar: 'حضرمية · رداعية · بيضانية' },
    notes: { en: 'One 250 g bag of Yemeni qahwa with a small Hadrami, Rada’i and Baydani pack. Try each style, then choose yours.', ar: 'كيس قهوة يمنية ٢٥٠ غ مع ظرف صغير حضرمي ورداعي وبيضاني. جرّب كل طريقة، ثم اختر طريقتك.' },
    story: { en: 'Three towns, one pot at a time.', ar: 'ثلاث بلدات، إبريق بعد إبريق.' },
    bunn: { en: 'Three towns in one box.', ar: 'ثلاث بلدات في علبة واحدة.' }, why: { en: 'Medjool sits well with all three.', ar: 'المجدول يناسب الثلاث.' } }),
];

// Yemeni beans: coffee grown in Yemen (our other Yemeni coffee is Yemeni-style, from Ethiopian
// beans), 250 g like every coffee, in the black and gold pouch with a gift tag. Not decided yet: shown for now so the owners can look at them; they
// hide them in Admin → Shop → Products (or set `startHidden: true` here so new sites start hidden).
// The lots and regions are placeholders until the supplier confirms them.
// Sold as whole roasted beans only (graded and roasted by us, not ground). The region lines are
// general facts about each district; the lot's farm, altitude, process and score come from the
// supplier and our cupping.
const Y = (id: string, name: L, region: L, bunn: L): Coffee => ({
  kind: 'coffee', id, fam: 'origin', line: 'yemen', name, price: null,
  size: { en: '250 g', ar: '٢٥٠ غ' }, roast: 0, spices: [], grinds: ['beans'],
  notes: { en: `${region.en} Whole roasted beans, 250 g in the black and gold pouch. [TBD: the lot, from the supplier]`, ar: `${region.ar} حبوب محمّصة كاملة، ٢٥٠ غ في الكيس الأسود والذهبي. [يُحدد لاحقاً: الدفعة، من المورّد]` },
  story: { en: 'Yemeni coffee is traditionally dried whole in its fruit under the mountain sun, and often tastes of dried fruit, dates and dark chocolate. A small lot, cupped and scored by us, roasted in Calgary; grind it just before you brew, for pour-over, and drink it on its own: no cardamom, no spice.', ar: 'يُجفَّف البن اليمني عادةً بثمرته تحت شمس الجبال، وكثيراً ما يحمل طعم الفاكهة المجففة والتمر والشوكولاتة الداكنة. دفعة صغيرة نتذوقها ونقيّمها ونحمّصها في كالغاري؛ اطحنها قبل التحضير مباشرة، بالتقطير، واشربها وحدها: بلا هيل ولا بهار.' },
  ingredients: ['Coffee (Yemen).', 'Café (Yémen).'],
  taste: { en: '[TBD: after the cupping]', ar: '[يُحدد لاحقاً: بعد التذوق]' },
  bunn, why: { en: '', ar: '' },
});
export const SPECIALTY: Coffee[] = [
  Y('yemen-haraz', { en: 'Haraz', ar: 'حراز' }, { en: 'From the Haraz mountains west of Sana’a, where coffee grows on stone terraces up to about 2,500 m.', ar: 'من جبال حراز غرب صنعاء، حيث يُزرع البن على مدرجات حجرية تبلغ نحو ٢٥٠٠ م.' }, { en: 'Where I learned my ways.', ar: 'هنا تعلّمت طرقي.' }),
  Y('yemen-matari', { en: 'Bani Matar', ar: 'بني مطر' }, { en: 'From Bani Matar, south-west of Sana’a, among Yemen’s highest coffee districts: “Matari” coffee takes its name from here.', ar: 'من بني مطر جنوب غرب صنعاء، من أعلى مناطق البن في اليمن، ومنها جاء اسم البن «المطري».' }, { en: 'They named a coffee after us.', ar: 'سمّوا قهوةً باسمنا.' }),
  Y('yemen-yafai', { en: 'Yafa’i', ar: 'يافعي' }, { en: 'From Yafa’ in the south of Yemen, where Yafa’i coffee takes its name.', ar: 'من يافع في جنوب اليمن، ومنها اسم البن اليافعي.' }, { en: 'High, slow and patient.', ar: 'عالٍ وبطيء وصبور.' }),
];

export const BOXES: Box[] = [
  // Everyday dates, sold by weight. One id per size: each size has its own price, and the server prices by id.
  ...([250, 500, 1000] as const).map((g): Box => {
    const ar = g === 1000 ? '١ كغ' : g === 500 ? '٥٠٠ غ' : '٢٥٠ غ';
    const en = g === 1000 ? '1 kg' : `${g} g`;
    return { kind: 'box', id: g === 500 ? 'date-box' : g === 1000 ? 'dates-1kg' : 'dates-250', fam: 'dates', tier: 'everyday',
      name: { en: `Everyday dates, ${en}`, ar: `تمر كل يوم ${ar}` }, price: null, size: { en, ar }, img: '/media/img/giftbox.webp',
      insert: 'everyday', sleeve: 'regular', chooseDate: true, grams: g, varieties: EVERYDAY,
      notes: { en: 'Good dates at an everyday price: Khalas or Sukkari Qassimi.', ar: 'تمر طيّب بسعر كل يوم: خلاص أو سكري قصيمي.' },
      contents: { en: `${en} of one variety in a clear bag.`, ar: `${ar} من صنف واحد في كيس شفاف.` }, preorder: true };
  }),
  // Reserve: one variety per box (a mixed box waits for the owners, Settings → Decisions).
  ...([12, 24] as const).map((n): Box => ({ kind: 'box', id: `reserve-${n}`, fam: 'dates', tier: 'reserve',
    name: { en: `Reserve box, ${n} dates`, ar: `علبة النخبة، ${n === 12 ? '١٢' : '٢٤'} تمرة` }, price: null,
    size: { en: `${n} dates`, ar: `${n === 12 ? '١٢' : '٢٤'} تمرة` }, img: '/media/img/ramadan-date.webp',
    insert: n === 12 ? 'C12' : 'D24', sleeve: 'regular', chooseDate: true, count: n, varieties: RESERVE, mixed: true,
    notes: { en: 'Royal Sukkari Mufattal, Ajwa or Medjool. Larger, hand-picked, each date in its own cup [TBD: confirm with the supplier]. The ones we recommend.', ar: 'سكري ملكي مفتّل أو عجوة أو مجدول. أكبر حجماً، منتقاة باليد، كل تمرة في كوبها [TBD: confirm with the supplier]. وهي ما ننصح به.' },
    contents: { en: `Gift box, ${n} dates of one variety in paper cups.`, ar: `صندوق هدية، ${n === 12 ? '١٢' : '٢٤'} تمرة من صنف واحد في أكواب ورقية.` }, preorder: true })),
  // Stuffed: one filling per box; each date sealed on its own. Allergens follow the filling (FILLINGS).
  ...([12, 24] as const).map((n): Box => ({ kind: 'box', id: `stuffed-${n}`, fam: 'dates', tier: 'stuffed',
    name: { en: `Stuffed dates, ${n}`, ar: `تمر محشي، ${n === 12 ? '١٢' : '٢٤'} تمرة` }, price: null,
    size: { en: `${n} dates`, ar: `${n === 12 ? '١٢' : '٢٤'} تمرة` }, img: '/media/img/eid-dates.webp',
    insert: n === 12 ? 'C12' : 'D24', sleeve: 'regular', count: n, fillings: FILLINGS_ON_SALE, mixed: true,
    notes: { en: 'Each date sealed on its own, with its allergen label.', ar: 'كل تمرة مغلّفة وحدها، مع ملصق مسببات الحساسية.' },
    contents: { en: `Gift box, ${n} stuffed dates, one filling, each sealed.`, ar: `صندوق هدية، ${n === 12 ? '١٢' : '٢٤'} تمرة محشية بحشوة واحدة، كل تمرة مغلّفة.` }, preorder: true })),
  { kind: 'box', id: 'four-palms', tier: 'gift', fam: 'dates', name: { en: 'Four Palms', ar: 'أربع نخلات' }, price: 44, size: { en: '24 dates', ar: '٢٤ تمرة' }, img: '/media/img/ramadan-date.webp',
    insert: 'D24', sleeve: 'regular', packs: { dates: { sukkari: 6, khalas: 6, ajwa: 6 } },
    notes: { en: 'Sukkari, Khalas, Khudri and Ajwa, six of each, side by side.', ar: 'سكري وخلاص وخضري وعجوة، ست من كل صنف، جنباً إلى جنب.' },
    contents: { en: 'Gift box, 24 dates in paper cups, four varieties.', ar: 'صندوق هدية، ٢٤ تمرة في أكواب ورقية، أربعة أصناف.' }, preorder: true },
  // Year-round gift boxes in the regular red band (Tamr, packaging brief B4): they stay when Ramadan and Eid are switched off.
  // Coffee & Dates (id kept for order history): one coffee style + 12 Reserve dates, both chosen.
  // `packs` is what boxes held before the choices (old orders without an option).
  { kind: 'box', id: 'guest-box', tier: 'gift', fam: 'dates', name: { en: 'Coffee & Dates', ar: 'قهوة وتمر' }, price: null, picks: ['coffee', 'reserve'], count: 12, varieties: RESERVE, mixed: true, size: { en: '250 g + 12 dates', ar: '٢٥٠ غ + ١٢ تمرة' }, img: '/media/img/giftbox.webp',
    insert: 'C12', sleeve: 'regular', packs: { coffee: { gulf: 1 }, sachets: { 'pack-saffron': 1 }, dates: { khalas: 12 } },
    notes: { en: 'One coffee and twelve dates in the red band, for any visit, any time of year.', ar: 'قهوة واثنتا عشرة تمرة بالحزام الأحمر، لأي زيارة في أي وقت من السنة.' },
    contents: { en: 'Gift box with Najdi coffee (Gulf coffee and its saffron packet) and 12 Khalas dates.', ar: 'صندوق هدية فيه قهوة نجدية (قهوة خليجية وظرف زعفرانها) و١٢ تمرة خلاص.' }, preorder: true },
  // Two Coffees (id kept): two styles, both chosen.
  { kind: 'box', id: 'coffee-duo', tier: 'gift', fam: 'dates', name: { en: 'Two Coffees', ar: 'قهوتان' }, price: null, picks: ['coffee', 'coffee'], size: { en: '2 × 250 g', ar: '٢ × ٢٥٠ غ' }, img: '/media/img/giftbox.webp',
    insert: 'C2', sleeve: 'regular', packs: { coffee: { gulf: 1, yemeni: 1 }, sachets: { 'pack-saffron': 1 } },
    notes: { en: 'Najdi and Yemeni qahwa side by side, for the house that pours all year.', ar: 'نجدية ويمنية جنباً إلى جنب، للبيت الذي يصبّ طوال السنة.' },
    contents: { en: 'Gift box, red band, two coffees: Najdi (Gulf coffee with its saffron packet) and Yemeni qahwa.', ar: 'صندوق هدية بالحزام الأحمر، قهوتان: نجدية (قهوة خليجية مع ظرف الزعفران) ويمنية.' }, preorder: true },
  // Retired: the seasonal copies. Ramadan and Eid are now a sleeve on the gift boxes above.
  { kind: 'box', id: 'iftar-pair', retired: true, tier: 'gift', fam: 'ramadan', name: { en: 'The Iftar Pair', ar: 'ثنائي الإفطار' }, price: 54, size: { en: '250 g + 12 dates', ar: '٢٥٠ غ + ١٢ تمرة' }, img: '/media/img/iftar-pair.webp',
    insert: 'C12', sleeve: 'ramadan', packs: { coffee: { gulf: 1 }, sachets: { 'pack-saffron': 1 }, dates: { khalas: 12 } },
    notes: { en: 'One coffee and twelve dates, for the first cup after sunset.', ar: 'قهوة واثنتا عشرة تمرة، لأول فنجان بعد الغروب.' },
    contents: { en: 'Gift box with Najdi coffee (Gulf coffee and its saffron packet) and 12 Khalas dates.', ar: 'صندوق هدية فيه قهوة نجدية (قهوة خليجية وظرف زعفرانها) و١٢ تمرة خلاص.' }, preorder: true },
  { kind: 'box', id: 'ramadan-box', retired: true, tier: 'everyday', fam: 'ramadan', name: { en: 'Ramadan Date Box', ar: 'صندوق تمر رمضان' }, price: 34, size: { en: '500 g', ar: '٥٠٠ غ' }, img: '/media/img/giftbox.webp',
    insert: 'everyday', sleeve: 'ramadan', chooseDate: true, grams: 500, varieties: EVERYDAY,
    notes: { en: 'The everyday box in its Ramadan sleeve.', ar: 'العلبة اليومية بحزام رمضان.' },
    contents: { en: '500 g of one variety, Ramadan sleeve.', ar: '٥٠٠ غ من صنف واحد، بحزام رمضان.' }, preorder: true },
  { kind: 'box', id: 'eid-coffee-dates', retired: true, tier: 'gift', fam: 'eid', name: { en: 'Eid Coffee & Dates', ar: 'قهوة وتمر العيد' }, price: 56, size: { en: '250 g + 12 dates', ar: '٢٥٠ غ + ١٢ تمرة' }, img: '/media/img/eid-coffee-dates.webp',
    insert: 'C12', sleeve: 'eid', packs: { coffee: { gulf: 1 }, sachets: { 'pack-saffron': 1 }, dates: { khalas: 12 } },
    notes: { en: 'For the first house you visit. The elders, always.', ar: 'لأول بيت تزورونه. الكبار دائماً.' },
    contents: { en: 'Gold Eid band, Najdi coffee and 12 dates.', ar: 'حزام العيد الذهبي، قهوة نجدية و١٢ تمرة.' }, preorder: true },
  { kind: 'box', id: 'eid-dates', retired: true, tier: 'gift', fam: 'eid', name: { en: 'Eid Dates', ar: 'تمر العيد' }, price: 58, size: { en: '24 dates', ar: '٢٤ تمرة' }, img: '/media/img/eid-dates.webp',
    insert: 'D24', sleeve: 'eid', packs: { dates: { sukkari: 6, khalas: 6, ajwa: 6 } },
    notes: { en: 'Four varieties for the table that fills all day.', ar: 'أربعة أصناف لمائدة تمتلئ طوال اليوم.' },
    contents: { en: 'Gold Eid band, 24 dates, four varieties.', ar: 'حزام العيد الذهبي، ٢٤ تمرة، أربعة أصناف.' }, preorder: true },
  { kind: 'box', id: 'eid-duo', retired: true, tier: 'gift', fam: 'eid', name: { en: 'Eid Coffee Duo', ar: 'ثنائي قهوة العيد' }, price: 46, size: { en: '2 × 250 g', ar: '٢ × ٢٥٠ غ' }, img: '/media/img/eid-coffee.webp',
    insert: 'C2', sleeve: 'eid', packs: { coffee: { gulf: 1, yemeni: 1 }, sachets: { 'pack-saffron': 1 } },
    notes: { en: 'Najdi and Yemeni qahwa, for the house that pours all day.', ar: 'نجدية ويمنية، للبيت الذي يصبّ طوال اليوم.' },
    contents: { en: 'Gold Eid band, two coffees.', ar: 'حزام العيد الذهبي، قهوتان.' }, preorder: true },
];

export const PRODUCTS: Product[] = [...COFFEES, ...SPECIALTY, ...KITS, ...PACKS, ...BOXES];
// Names, descriptions and the other words are edited in the desk (Admin → Shop → Words), which saves them
// to src/content/products.json. That file wins over the text written above.
for (const p of PRODUCTS) Object.assign(p, (TEXT as Record<string, Partial<Record<string, L>>>)[p.id] ?? {});
export const byId = (id: string) => PRODUCTS.find(p => p.id === id);
/** Dates sold by weight (Everyday sizes, the Ramadan box). */
export const BY_WEIGHT = BOXES.filter(b => b.grams);
/** Everything on sale (retired boxes stay in PRODUCTS only so old orders still read). */
export const ON_SALE = PRODUCTS.filter(p => !(p.kind === 'box' && p.retired));

// ---------- gift boxes: choices, Mixed and sleeves ----------
// Every gift box has the same Tamr red band (50 mm; packaging brief B4). A season adds our own Ø50
// occasion sticker on the lid (label E4). In the data and on order lines the choice is still called `sleeve`.
export const SLEEVES: Record<Sleeve, L> = {
  regular: { en: 'Any day', ar: 'كل يوم' },
  ramadan: { en: 'Ramadan sticker', ar: 'ملصق رمضان' },
  eid: { en: 'Eid sticker', ar: 'ملصق العيد' },
};
/** A box takes the occasion choice when it is a gift box (inserts C2, C12, D24). */
export const takesSleeve = (b: Box) => b.insert !== 'everyday' && !b.retired;
export const MIXED: L = { en: 'Mixed', ar: 'مشكّل' };
/** The coffees a gift box can hold: the family styles, then the bags on their own (not qishr). */
export const GIFT_COFFEES: string[] = [...KITS.filter(k => !k.discovery).map(k => k.id), ...COFFEES.filter(c => c.id !== 'qishr').map(c => c.id)];
/** One 250 g bag of a style: its base bag and its full-size packs. */
export function styleParts(id: string): { coffee: Record<string, number>; sachets: Record<string, number> } {
  const k = KITS.find(x => x.id === id);
  if (k) return { coffee: { [k.base]: 1 }, sachets: Object.fromEntries(k.parts.filter(x => !x.mini).map(x => [x.id, 1])) };
  return { coffee: { [id]: 1 }, sachets: {} };
}
/** Mixed split evenly; null when the count doesn't divide (the owners choose the counts first). */
export function mixSplit<K extends string>(kinds: K[], count: number): Partial<Record<K, number>> | null {
  if (!kinds.length || !count || count % kinds.length) return null;
  return Object.fromEntries(kinds.map(k => [k, count / kinds.length])) as Partial<Record<K, number>>;
}
/** The kinds a box's Mixed splits across: its fillings (stuffed) or its varieties. */
const mixKinds = (b: Box): string[] => b.fillings ?? varietiesOf(b);
/** Does this box offer Mixed right now (its count divides evenly across the kinds)? */
export const mixedOk = (b: Box) => Boolean(b.mixed && mixSplit(mixKinds(b), b.count ?? 0));
/** The choices for a box's (second, for Coffee & Dates) date pick, with Mixed when it divides. */
export const dateChoices = (b: Box): string[] => [...(b.fillings ?? varietiesOf(b)), ...(mixedOk(b) ? ['mixed'] : [])];
/** The first option a box starts with (cards, the cart's suggestions). */
export const defaultBoxOpt = (b: Box) => b.picks ? b.picks.map((k, i) => (k === 'coffee' ? (i === 0 ? 'najdi' : 'yemeni') : 'mixed')).join('|') : (dateChoices(b)[0] ?? '');
const optLabel = (b: Box, part: string, kind: 'coffee' | 'reserve' | 'date', lang: Lang) =>
  kind === 'coffee' ? PRODUCTS.find(p => p.id === part)?.name[lang] ?? part
  : part === 'mixed' ? (kind === 'reserve' ? (lang === 'ar' ? 'نخبة مشكّلة' : 'Mixed Reserve') : MIXED[lang])
  : b.fillings ? FILLINGS[part as FillingId]?.name[lang] ?? part : DATES[part as DateId]?.name[lang] ?? part;
/** Readable option, e.g. "Najdi · Mixed Reserve" or "Pistachio stuffed". */
export const boxOptionLabel = (b: Box, opt: string, lang: Lang) => b.picks
  ? opt.split('|').map((x, i) => optLabel(b, x, b.picks![i] === 'coffee' ? 'coffee' : 'reserve', lang)).join(' · ')
  : optLabel(b, opt, 'date', lang);

export type BoxContents = { coffee: Record<string, number>; sachets: Record<string, number>; dates: Partial<Record<DateId, number>>; stuffed: Partial<Record<FillingId, number>> };
/** What one box holds for an option: bags and packs, dates and stuffed dates in pieces (Mixed
 * split per kind). Dates sold by weight are not pieces; the week sheet reads their grams. */
export function boxContents(b: Box, opt: string | null): BoxContents {
  const out: BoxContents = { coffee: {}, sachets: {}, dates: {}, stuffed: {} };
  const add = (m: Record<string, number>, from: Record<string, number | undefined>, times = 1) => { for (const [k, n] of Object.entries(from)) m[k] = (m[k] ?? 0) + (n ?? 0) * times; };
  const datesFor = (part: string, count: number, kinds: string[]) => (part === 'mixed' ? mixSplit(kinds, count) ?? {} : { [part]: count });
  if (b.picks && opt) {
    opt.split('|').forEach((part, i) => {
      if (b.picks![i] === 'coffee') { const s = styleParts(part); add(out.coffee, s.coffee); add(out.sachets, s.sachets); }
      else add(out.dates, datesFor(part, b.count ?? 12, varietiesOf(b)));
    });
    return out;
  }
  // Fixed contents (and what the two-choice boxes held before their choices).
  add(out.coffee, b.packs?.coffee ?? {}); add(out.sachets, b.packs?.sachets ?? {}); add(out.dates, b.packs?.dates ?? {});
  if (!opt || b.grams) return out;
  if (b.fillings) add(out.stuffed, datesFor(opt, b.count ?? 0, b.fillings));
  else if (b.chooseDate && b.count) add(out.dates, datesFor(opt, b.count, varietiesOf(b)));
  return out;
}
/** A box's allergens: its own, or the chosen filling's for stuffed boxes. */
export const boxAllergens = (b: Box, filling?: string) => [...new Set([...(b.allergens ?? []), ...(filling && FILLINGS[filling as FillingId] ? FILLINGS[filling as FillingId].allergens : [])])];
/** The readable name of a box option: a date variety or a filling. */
export const optionName = (b: Box, opt: string, lang: Lang) => boxOptionLabel(b, opt, lang);

export const money = (n: number, lang: Lang) => (lang === 'ar' ? `${n} $` : `$${n}`);
/** A price, or "price coming" while the owners have not set it. */
export const priceText = (n: number | null | undefined, lang: Lang) => (n == null ? (lang === 'ar' ? 'السعر قريباً' : 'Price coming') : money(n, lang));
/** Price in cents from the file (null when not set yet). */
export const fileCents = (p: Product) => (p.price == null ? null : Math.round(p.price * 100));

export const baseOf = (k: Kit) => COFFEES.find(c => c.id === k.base)!;
export const packOf = (id: string) => PACKS.find(p => p.id === id);
/** Family styles for a base bag (discovery packs not included). */
export const stylesFor = (baseId: string) => KITS.filter(k => k.base === baseId && !k.discovery);
/** Everything that can trigger an allergen in a kit: only its packs. */
export const kitAllergens = (k: Kit) => [...new Set(k.parts.flatMap(x => packOf(x.id)?.allergens ?? []))];
/** The allergen line for a pack or a style: what it contains, "to be confirmed", or no known allergens. */
export function allergyNote(x: Pack | Kit, lang: Lang) {
  const packs = x.kind === 'pack' ? [x] : x.parts.map(y => packOf(y.id)!).filter(Boolean);
  const list = [...new Set(packs.flatMap(k => k.allergens))];
  const tbd = packs.some(k => k.maybe);
  const ar = lang === 'ar';
  if (list.length) return { none: false, text: (ar ? 'يحتوي على: ' : 'Contains: ') + list.map(a => ALLERGENS[a][lang]).join(ar ? '، ' : ', ') + (tbd ? (ar ? ' (والباقي يُؤكد)' : ' (more to confirm)') : '') };
  if (tbd) return { none: false, text: ar ? 'مسببات الحساسية تُؤكد مع الوصفة النهائية' : 'Allergens confirmed with the final recipe' };
  return { none: true, text: ar ? 'بلا مسببات حساسية معروفة' : 'No known allergens' };
}

/** "Gulf coffee 250 g + saffron packet" */
export const kitInside = (k: Kit, lang: Lang) => [`${baseOf(k).name[lang]} ${baseOf(k).size[lang]}`, ...k.parts.map(x => (x.mini ? (lang === 'ar' ? 'ظرف صغير: ' : 'small ') : '') + (packOf(x.id)?.name[lang] ?? x.id))].join(' + ');
