// Single source of truth for both sites. Prices are drafts (CAD) until launch.
import TEXT from '../content/products.json';

export type Lang = 'en' | 'ar';
export type L = { en: string; ar: string };

export type Family = 'palm' | 'mountain' | 'house' | 'husk' | 'dates' | 'ramadan' | 'eid';
/** The three coffee lines on the shop: Gulf (palm), Yemeni (mountain, with Jubani and qishr) and Shami (house). */
export type CoffeeLine = 'gulf' | 'yemen' | 'shami';
export type Spice = 'saffron' | 'cardamom' | 'ginger' | 'husk' | 'sesame' | 'cinnamon';
export type DateId = 'sukkari' | 'khalas' | 'khudri' | 'ajwa' | 'medjool';
export type Grind = 'dallah' | 'fine' | 'powder';
export type Allergen = 'milk' | 'sesame' | 'nuts' | 'grain';

/** A base bag: the coffee itself, with only the spice that belongs in every cup of that line. */
export interface Coffee {
  kind: 'coffee';
  id: string;
  fam: 'palm' | 'mountain' | 'house' | 'husk';
  line: CoffeeLine;
  name: L;
  /** null = the owners have not set a price yet: the site shows "price coming" and it can't be ordered. */
  price: number | null;
  size: string;
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
  date: DateId;
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
  date: DateId;
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
  /** What goes inside, for the weekly roast and pack sheet: 250 g base bags, sealed packs, dates by variety (pieces). */
  packs?: { coffee?: Record<string, number>; sachets?: Record<string, number>; dates?: Partial<Record<DateId, number>> };
}

export type Product = Coffee | Pack | Kit | Box;

export const FAMILIES: Record<Family, { name: L; line: L }> = {
  palm: { name: { en: 'Gulf', ar: 'الخليج' }, line: { en: 'Pale and golden, poured from the dallah. One bag, taken your way.', ar: 'شقراء وذهبية، تُصبّ من الدلّة. كيس واحد، تشربه بطريقتك.' } },
  mountain: { name: { en: 'Yemen', ar: 'اليمن' }, line: { en: 'Yemeni-style coffee from Ethiopian beans, with cardamom. The ginger and each town’s additions come in the packs.', ar: 'قهوة على الطريقة اليمنية من حبوب إثيوبية، بالهيل. والزنجبيل وإضافة كل بلدة في الظروف.' } },
  house: { name: { en: 'Shami', ar: 'الشام' }, line: { en: 'Shami coffee, ground to powder and boiled in the rakwa.', ar: 'القهوة الشامية، مطحونة كالبودرة وتُغلى في الركوة.' } },
  husk: { name: { en: 'Qishr', ar: 'القشر' }, line: { en: 'Qishr – dried coffee cherry husk, with ginger.', ar: 'القشر – قشر ثمرة البن المجفف، مع الزنجبيل.' } },
  dates: { name: { en: 'Dates & boxes', ar: 'التمر والصناديق' }, line: { en: 'Chosen by variety, region and harvest.', ar: 'نختاره بالصنف والمنطقة والموسم.' } },
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
  dallah: { en: 'Coarse, for the dallah', ar: 'طحنة خشنة للدلّة' },
  fine: { en: 'Fine, for the pot', ar: 'طحنة ناعمة للإبريق' },
  powder: { en: 'Powder-fine, for the rakwa', ar: 'ناعمة كالبودرة للركوة' },
};

/** Allergens live only in the sealed packs. The coffee bags hold coffee and spices, nothing else. */
export const ALLERGENS: Record<Allergen, L> = {
  milk: { en: 'Milk', ar: 'حليب' },
  sesame: { en: 'Sesame', ar: 'سمسم' },
  nuts: { en: 'Tree nuts (almonds)', ar: 'مكسرات (لوز)' },
  grain: { en: 'Grain (sorghum)', ar: 'حبوب (ذرة رفيعة)' },
};

export const DATES: Record<DateId, { name: L; region: L; c: string; sweet: number; notes: L }> = {
  sukkari: { name: { en: 'Sukkari', ar: 'سكري' }, region: { en: 'Qassim', ar: 'القصيم' }, c: '#C98A3A', sweet: 95, notes: { en: 'Very sweet, soft to crisp, caramel.', ar: 'حلو جداً، طري إلى مقرمش، كراميل.' } },
  khalas: { name: { en: 'Khalas', ar: 'خلاص' }, region: { en: 'Al-Ahsa', ar: 'الأحساء' }, c: '#8E4A22', sweet: 80, notes: { en: 'Toffee and caramel, soft and moist.', ar: 'توفي وكراميل، طري ورطب.' } },
  medjool: { name: { en: 'Medjool', ar: 'مجدول' }, region: { en: 'Jordan Valley', ar: 'وادي الأردن' }, c: '#6E3420', sweet: 85, notes: { en: 'Large and fleshy, honey-caramel.', ar: 'كبيرة ولحمية، عسل وكراميل.' } },
  khudri: { name: { en: 'Khudri', ar: 'خضري' }, region: { en: 'Arabia', ar: 'الجزيرة العربية' }, c: '#5B2E17', sweet: 55, notes: { en: 'Firmer and darker, less sweet.', ar: 'أصلب وأغمق، أقل حلاوة.' } },
  ajwa: { name: { en: 'Ajwa', ar: 'عجوة' }, region: { en: 'Madinah', ar: 'المدينة' }, c: '#2B1710', sweet: 50, notes: { en: 'Small and near-black, gentle fruit.', ar: 'صغيرة شبه سوداء، فاكهية رقيقة.' } },
};

const C = (c: Omit<Coffee, 'kind' | 'size' | 'price'> & { size?: string; price?: number | null }): Coffee => ({ kind: 'coffee', size: '250 g', price: null, ...c });

// Prices are not set yet ([TBD]): the owners set each one in Admin → Shop → Products, and until then
// the site says "price coming" and the item can't be ordered. Roast levels are the working plan until
// the cupping (about 20 October) and the blind tasting (3–10 November).
export const COFFEES: Coffee[] = [
  C({ id: 'gulf', line: 'gulf', fam: 'palm', name: { en: 'Gulf coffee', ar: 'قهوة خليجية' }, roast: 1, spices: ['cardamom'], grinds: ['dallah'],
    taste: { en: 'Golden · cardamom · light', ar: 'ذهبية · هيل · خفيفة' },
    notes: { en: 'Blonde roast, coarse ground, cardamom already mixed in. Drink it as it is, or add the packs that make it the way you take it at home.', ar: 'تحميص أشقر، طحنة خشنة، والهيل مخلوط فيها. اشربها كما هي، أو أضف الظروف التي تجعلها كما تشربها في بيتك.' },
    story: { en: 'The pale qahwa of Arabia, poured from the dallah into a small cup. This one bag is the start of every Gulf style we make; the packs do the rest.', ar: 'قهوة الجزيرة الشقراء، تُصبّ من الدلّة في فنجان صغير. هذا الكيس بداية كل طريقة خليجية نصنعها، والظروف تكمل الباقي.' },
    ingredients: ['Coffee, cardamom.', 'Café, cardamome.'],
    bunn: { en: 'Cardamom only. Add what you like.', ar: 'هيل فقط، وأضف ما تحبه.' }, date: 'khalas',
    why: { en: 'Toffee-soft Khalas with a pale cup.', ar: 'خلاص الطرية مع فنجان أشقر.' } }),
  C({ id: 'yemeni', line: 'yemen', fam: 'mountain', name: { en: 'Yemeni qahwa', ar: 'قهوة يمنية' }, roast: 2, spices: ['cardamom'], grinds: ['fine'],
    taste: { en: 'Bright · cardamom · round', ar: 'مشرقة · هيل · مستديرة' },
    notes: { en: 'Yemeni-style, from Ethiopian beans. Medium-light roast, fine ground, with cardamom mixed in. The ginger comes in the packs.', ar: 'على الطريقة اليمنية، من حبوب إثيوبية. تحميص متوسط فاتح، طحنة ناعمة، والهيل مخلوط فيها. والزنجبيل يأتي في الظروف.' },
    story: { en: 'Coffee the way Yemeni homes make it, in the pot. On its own it is a clean cardamom cup. With a pack, ginger and all, it becomes Hadrami, Rada’i or Baydani.', ar: 'القهوة كما تصنعها البيوت اليمنية، في الإبريق. وحدها فنجان صافٍ بالهيل، ومع ظرف، بزنجبيله وكل ما فيه، تصير حضرمية أو رداعية أو بيضانية.' },
    ingredients: ['Coffee, cardamom.', 'Café, cardamome.'],
    bunn: { en: 'Cardamom in me. The ginger waits in the pack.', ar: 'فيّ الهيل، والزنجبيل ينتظر في الظرف.' }, date: 'medjool',
    why: { en: 'Honeyed Medjool with a cardamom cup.', ar: 'المجدول العسلي مع فنجان الهيل.' } }),
  C({ id: 'jubani', line: 'yemen', fam: 'mountain', name: { en: 'Jubani', ar: 'جُبَني' }, roast: 2, spices: ['husk'], grinds: ['fine'],
    taste: { en: 'Dried cherry · round', ar: 'كرز مجفف · مستديرة' },
    notes: { en: 'Yemeni-style coffee with qishr, its own dried husk, ground together in one bag. [TBD: with ginger or plain]', ar: 'قهوة على الطريقة اليمنية مع القشر، قشرها المجفف، مطحونان معاً في كيس واحد. [يُحدد لاحقاً: بالزنجبيل أو سادة]' },
    story: { en: 'The bean and its husk in one pot, the way Juban makes it.', ar: 'الحبّة وقشرها في إبريق واحد، على طريقة جُبَن.' },
    ingredients: ['Coffee, coffee cherry husk. [TBD: ginger]', 'Café, cascara. [TBD : gingembre]'],
    bunn: { en: 'Me, and my own husk.', ar: 'أنا، ومعي قشري.' }, date: 'sukkari',
    why: { en: 'Sukkari answers the dried-cherry note.', ar: 'السكري يجاوب طعم الكرز المجفف.' } }),
  C({ id: 'qishr', line: 'yemen', fam: 'husk', name: { en: 'Qishr', ar: 'قشر' }, size: '100 g', roast: 0, spices: ['husk', 'ginger'], grinds: [],
    taste: { en: 'Cherry · ginger · light', ar: 'كرز · زنجبيل · خفيفة' },
    notes: { en: 'Qishr – dried coffee cherry husk, with ginger. Brewed in the pot like tea, light on caffeine. [TBD: roasted or raw husk]', ar: 'القشر – قشر ثمرة البن المجفف، مع الزنجبيل. يُغلى في الإبريق مثل الشاي، قليل الكافيين. [يُحدد لاحقاً: قشر محمّص أو نيء]' },
    story: { en: "Yemen's oldest coffee drink, older than the roasted bean.", ar: 'أقدم مشروبات البن في اليمن، أقدم من الحبّة المحمّصة.' },
    ingredients: ['Coffee cherry husk, ginger.', 'Cascara, gingembre.'],
    bunn: { en: 'I was a husk before the bean.', ar: 'كنتُ قشراً قبل البُن.' }, date: 'sukkari',
    why: { en: 'Cherry and caramel.', ar: 'كرز وكراميل.' } }),
  C({ id: 'shami', popular: true, line: 'shami', fam: 'house', name: { en: 'Shami coffee with cardamom', ar: 'شامية بالهيل' }, roast: 3, spices: ['cardamom'], grinds: ['powder'],
    taste: { en: 'Thick · bittersweet · cardamom', ar: 'كثيفة · مُرّة حلوة · هيل' },
    notes: { en: 'Brazilian beans, medium roast, ground to powder, with cardamom. The everyday Shami cup.', ar: 'حبوب برازيلية، تحميص متوسط، مطحونة كالبودرة، بالهيل. فنجان الشامية لكل يوم.' },
    story: { en: 'The Shami rakwa: powder-fine coffee boiled slowly, with cardamom, the way homes in the Levant make it.', ar: 'الركوة الشامية: قهوة ناعمة كالبودرة تُغلى على مهل، بالهيل، كما في بيوت الشام.' },
    ingredients: ['Coffee, cardamom.', 'Café, cardamome.'],
    bunn: { en: 'Fine, for the rakwa.', ar: 'ناعمة، للركوة.' }, date: 'medjool',
    why: { en: 'A soft Medjool after a thick cup.', ar: 'مجدول طري بعد فنجان كثيف.' } }),
  C({ id: 'shami-sada', line: 'shami', fam: 'house', name: { en: 'Shami sada', ar: 'شامية سادة' }, roast: 3, spices: [], grinds: ['powder'],
    taste: { en: 'Thick · bittersweet · plain', ar: 'كثيفة · مُرّة حلوة · سادة' },
    notes: { en: 'The same Shami coffee, nothing added.', ar: 'القهوة الشامية نفسها، بلا إضافات.' },
    story: { en: 'For those who take their coffee plain and their sweetness from the date.', ar: 'لمن يشرب قهوته سادة ويأخذ حلاوته من التمرة.' },
    ingredients: ['Coffee.', 'Café.'],
    bunn: { en: "I'm bitter today.", ar: 'أنا مُرّ اليوم.' }, date: 'medjool',
    why: { en: 'Then take two dates.', ar: 'خذ تمرتين إذن.' } }),
];

const P = (p: Omit<Pack, 'kind' | 'price' | 'size'> & { price?: number | null }): Pack => ({ kind: 'pack', price: null, size: { en: 'One pack for one 250 g bag [TBD: grams]', ar: 'ظرف واحد لكيس ٢٥٠ غ [يُحدد لاحقاً: الوزن]' }, ...p });

export const PACKS: Pack[] = [
  P({ id: 'pack-saffron', line: 'gulf', fam: 'palm', for: 'gulf', c: '#A93B28', name: { en: 'Saffron packet', ar: 'ظرف زعفران' },
    notes: { en: 'What makes Gulf coffee Najdi. Kept in its own sealed packet so it stays bright until the pot.', ar: 'هو ما يجعل القهوة الخليجية نجدية. في ظرفه المختوم ليبقى زاهياً حتى الدلّة.' },
    contents: { en: 'Saffron, sealed.', ar: 'زعفران، مختوم.' }, ingredients: ['Saffron.', 'Safran.'], allergens: [] }),
  P({ id: 'pack-qassim', line: 'gulf', fam: 'palm', for: 'gulf', c: '#C98A3A', name: { en: 'Qassim blend pack', ar: 'خلطة قصيمية' },
    notes: { en: 'The Qassimi blend for Gulf coffee. Use it with the saffron packet.', ar: 'الخلطة القصيمية للقهوة الخليجية، تُستعمل مع ظرف الزعفران.' },
    contents: { en: 'Spices and milk powder. [TBD: full list]', ar: 'بهارات وحليب مجفف. [يُحدد لاحقاً: القائمة الكاملة]' },
    ingredients: ['Spices, milk powder. Contains: milk. [TBD: full list]', 'Épices, lait en poudre. Contient : lait. [TBD : liste complète]'], allergens: ['milk'],
    maybe: { en: 'May also contain barley [TBD]', ar: 'قد تحتوي على الشعير أيضاً [يُحدد لاحقاً]' } }),
  P({ id: 'pack-hijazi', line: 'gulf', fam: 'palm', for: 'gulf', c: '#5E7A2E', name: { en: 'Hijazi blend pack', ar: 'خلطة حجازية' },
    notes: { en: 'The Hijazi blend for Gulf coffee. Use it with the saffron packet.', ar: 'الخلطة الحجازية للقهوة الخليجية، تُستعمل مع ظرف الزعفران.' },
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
    notes: { en: 'Ginger and sorghum, for Yemeni qahwa the way Al-Bayda makes it.', ar: 'زنجبيل وذرة رفيعة، للقهوة اليمنية على طريقة البيضاء.' },
    contents: { en: 'Ginger, roasted sorghum. [TBD: the richer version]', ar: 'زنجبيل، ذرة رفيعة محمّصة. [يُحدد لاحقاً: النسخة الأغنى]' },
    ingredients: ['Ginger, roasted sorghum. [TBD]', 'Gingembre, sorgho grillé. [TBD]'], allergens: ['grain'],
    maybe: { en: 'The richer version may add more [TBD]', ar: 'النسخة الأغنى قد تضيف مكونات أخرى [يُحدد لاحقاً]' } }),
];

const K = (k: Omit<Kit, 'kind' | 'price'> & { price?: number | null }): Kit => ({ kind: 'kit', price: null, ...k });

export const KITS: Kit[] = [
  K({ id: 'najdi', origin: { en: 'Najd’s way: pale, with saffron', ar: 'على طريقة نجد: شقراء بالزعفران' }, line: 'gulf', fam: 'palm', base: 'gulf', parts: [{ id: 'pack-saffron' }], name: { en: 'Najdi', ar: 'نجدية' },
    taste: { en: 'Golden · cardamom · saffron', ar: 'ذهبية · هيل · زعفران' },
    notes: { en: 'Gulf coffee and its saffron packet. Cardamom and saffron, golden and light.', ar: 'قهوة خليجية مع ظرف الزعفران. هيل وزعفران، ذهبية وخفيفة.' },
    story: { en: "Najd's way: roasted pale, poured from the dallah into a small cup, always with a date. The saffron is what makes it Najdi, so it is always in the box.", ar: 'على طريقة نجد: تحميص أشقر، تُصبّ من الدلّة في فنجان صغير، ومعها تمرة دائماً. الزعفران هو ما يجعلها نجدية، لذلك هو في العلبة دائماً.' },
    bunn: { en: 'Cardamom and saffron.', ar: 'هيل وزعفران.' }, date: 'khalas', why: { en: 'Toffee-soft Khalas rounds the saffron.', ar: 'خلاص الطرية تُليّن الزعفران.' } }),
  K({ id: 'qassimi', origin: { en: 'The Qassim way: richer in the cup', ar: 'على طريقة القصيم: أغنى في الفنجان' }, line: 'gulf', fam: 'palm', base: 'gulf', parts: [{ id: 'pack-qassim' }, { id: 'pack-saffron' }], name: { en: 'Qassimi', ar: 'قصيمية' },
    taste: { en: 'Rich · saffron · warm spice', ar: 'غنية · زعفران · بهار دافئ' },
    notes: { en: 'Gulf coffee with the Qassim blend pack and the saffron packet.', ar: 'قهوة خليجية مع الخلطة القصيمية وظرف الزعفران.' },
    story: { en: 'The Qassim way: the same pale coffee, richer in the cup.', ar: 'على طريقة القصيم: القهوة الشقراء نفسها، أغنى في الفنجان.' },
    bunn: { en: 'Richer than my brothers.', ar: 'أغنى من إخوتي.' }, date: 'sukkari', why: { en: 'Sukkari, from Qassim too.', ar: 'السكري، من القصيم أيضاً.' } }),
  K({ id: 'hijazi', origin: { en: 'The Hijaz way: more fragrant', ar: 'على طريقة الحجاز: أعطر' }, line: 'gulf', fam: 'palm', base: 'gulf', parts: [{ id: 'pack-hijazi' }, { id: 'pack-saffron' }], name: { en: 'Hijazi', ar: 'حجازية' },
    taste: { en: 'Fragrant · saffron · spice', ar: 'عطرة · زعفران · بهار' },
    notes: { en: 'Gulf coffee with the Hijazi blend pack and the saffron packet.', ar: 'قهوة خليجية مع الخلطة الحجازية وظرف الزعفران.' },
    story: { en: 'The Hijaz way: the same pale coffee, more fragrant in the cup.', ar: 'على طريقة الحجاز: القهوة الشقراء نفسها، أعطر في الفنجان.' },
    bunn: { en: 'From the west of Arabia.', ar: 'من غرب الجزيرة.' }, date: 'ajwa', why: { en: 'Ajwa, from Madinah.', ar: 'العجوة، من المدينة.' } }),
  K({ id: 'hadrami', origin: { en: 'The Hadramawt way', ar: 'على طريقة حضرموت' }, line: 'yemen', fam: 'mountain', base: 'yemeni', parts: [{ id: 'pack-hadrami' }], name: { en: 'Hadrami', ar: 'حضرمية' },
    taste: { en: '[TBD]', ar: '[يُحدد لاحقاً]' },
    notes: { en: 'Yemeni qahwa with the Hadrami pack: ginger and the Hadrami additions.', ar: 'قهوة يمنية مع الخلطة الحضرمية: الزنجبيل وإضافات حضرموت.' },
    story: { en: 'The Hadramawt way, made in the pot.', ar: 'على طريقة حضرموت، تُصنع في الإبريق.' },
    bunn: { en: 'From Hadramawt.', ar: 'من حضرموت.' }, date: 'khalas', why: { en: 'Soft Khalas for a warm cup.', ar: 'خلاص الطرية لفنجان دافئ.' } }),
  K({ id: 'radai', origin: { en: 'From Rada’a: sesame and almonds in the pot', ar: 'من رداع: السمسم واللوز في الإبريق' }, line: 'yemen', fam: 'mountain', base: 'yemeni', parts: [{ id: 'pack-radai' }], name: { en: 'Rada’i', ar: 'رداعية' },
    taste: { en: 'Nutty · sesame · warm', ar: 'مكسرات · سمسم · دافئة' },
    notes: { en: 'Yemeni qahwa with the Rada’i pack: ginger, roasted sesame and almonds.', ar: 'قهوة يمنية مع الخلطة الرداعية: زنجبيل وسمسم محمّص ولوز.' },
    story: { en: 'From Rada’a: sesame and almonds in the pot with the coffee.', ar: 'من رداع: السمسم واللوز في الإبريق مع القهوة.' },
    bunn: { en: 'Sesame and almonds, for the cold.', ar: 'سمسم ولوز، للبرد.' }, date: 'medjool', why: { en: 'Big, honeyed Medjool with the almonds.', ar: 'المجدول العسلي مع اللوز.' } }),
  K({ id: 'baydani', origin: { en: 'From Al-Bayda: grain in the pot', ar: 'من البيضاء: الحبوب في الإبريق' }, line: 'yemen', fam: 'mountain', base: 'yemeni', parts: [{ id: 'pack-baydani' }], name: { en: 'Baydani', ar: 'بيضانية' },
    taste: { en: 'Toasty · grain · warm', ar: 'محمّصة · حبوب · دافئة' },
    notes: { en: 'Yemeni qahwa with the Baydani pack: ginger and roasted sorghum.', ar: 'قهوة يمنية مع الخلطة البيضانية: زنجبيل وذرة رفيعة محمّصة.' },
    story: { en: "Al-Bayda's way: grain in the pot with the coffee.", ar: 'على طريقة البيضاء: الحبوب في الإبريق مع القهوة.' },
    bunn: { en: 'They brewed me with sorghum.', ar: 'غلوني مع الذرة.' }, date: 'khalas', why: { en: 'Khalas toffee with a toasty cup.', ar: 'توفي خلاص مع فنجان محمّص.' } }),
  K({ id: 'taste-gulf', discovery: true, line: 'gulf', fam: 'palm', base: 'gulf', parts: [{ id: 'pack-qassim', mini: true }, { id: 'pack-hijazi', mini: true }, { id: 'pack-saffron' }], name: { en: 'Taste the Gulf', ar: 'تذوّق النكهة الخليجية' },
    taste: { en: 'Najdi · Qassimi · Hijazi', ar: 'نجدية · قصيمية · حجازية' },
    notes: { en: 'One 250 g bag of Gulf coffee, a small Qassim pack, a small Hijazi pack and the saffron packet. Try each style, then choose yours.', ar: 'كيس قهوة خليجية ٢٥٠ غ، وظرف قصيمي صغير، وظرف حجازي صغير، وظرف الزعفران. جرّب كل طريقة، ثم اختر طريقتك.' },
    story: { en: 'For the first time, or for the friend who asks which one is yours.', ar: 'للمرة الأولى، أو للصديق الذي يسأل: أيّها قهوتك؟' },
    bunn: { en: 'Three Gulf cups from one bag.', ar: 'ثلاث قهوات خليجية من كيس واحد.' }, date: 'khalas', why: { en: 'Khalas goes with all three.', ar: 'خلاص تناسب الثلاث.' } }),
  K({ id: 'taste-yemen', discovery: true, line: 'yemen', fam: 'mountain', base: 'yemeni', parts: [{ id: 'pack-hadrami', mini: true }, { id: 'pack-radai', mini: true }, { id: 'pack-baydani', mini: true }], name: { en: 'Taste Yemen', ar: 'تذوّق النكهة اليمنية' },
    taste: { en: 'Hadrami · Rada’i · Baydani', ar: 'حضرمية · رداعية · بيضانية' },
    notes: { en: 'One 250 g bag of Yemeni qahwa with a small Hadrami, Rada’i and Baydani pack. Try each style, then choose yours.', ar: 'كيس قهوة يمنية ٢٥٠ غ مع ظرف صغير حضرمي ورداعي وبيضاني. جرّب كل طريقة، ثم اختر طريقتك.' },
    story: { en: 'Three towns, one pot at a time.', ar: 'ثلاث بلدات، إبريق بعد إبريق.' },
    bunn: { en: 'Three towns in one box.', ar: 'ثلاث بلدات في علبة واحدة.' }, date: 'medjool', why: { en: 'Medjool sits well with all three.', ar: 'المجدول يناسب الثلاث.' } }),
];

export const BOXES: Box[] = [
  { kind: 'box', id: 'date-box', fam: 'dates', name: { en: 'The Everyday Date Box', ar: 'علبة التمر اليومية' }, price: 34, size: { en: '500 g', ar: '٥٠٠ غ' }, img: '/media/img/giftbox.webp',
    insert: 'everyday', sleeve: 'regular', chooseDate: true,
    notes: { en: 'One variety, chosen by you. For the house, not for wrapping.', ar: 'صنف واحد تختاره. للبيت، لا للتغليف.' },
    contents: { en: '500 g of one date variety in a clear tray.', ar: '٥٠٠ غ من صنف واحد في علبة شفافة.' }, preorder: true },
  { kind: 'box', id: 'four-palms', fam: 'dates', name: { en: 'Four Palms', ar: 'أربع نخلات' }, price: 44, size: { en: '24 dates', ar: '٢٤ تمرة' }, img: '/media/img/ramadan-date.webp',
    insert: 'D24', sleeve: 'regular', packs: { dates: { sukkari: 6, khalas: 6, khudri: 6, ajwa: 6 } },
    notes: { en: 'Sukkari, Khalas, Khudri and Ajwa, six of each, side by side.', ar: 'سكري وخلاص وخضري وعجوة، ست من كل صنف، جنباً إلى جنب.' },
    contents: { en: 'Gift box, 24 dates in paper cups, four varieties.', ar: 'صندوق هدية، ٢٤ تمرة في أكواب ورقية، أربعة أصناف.' }, preorder: true },
  // Year-round gift boxes in the regular gold sleeve: they stay when Ramadan and Eid are switched off.
  { kind: 'box', id: 'guest-box', fam: 'dates', name: { en: 'The Guest Box', ar: 'صندوق الضيف' }, price: 54, size: { en: '250 g + 12 dates', ar: '٢٥٠ غ + ١٢ تمرة' }, img: '/media/img/giftbox.webp',
    insert: 'C12', sleeve: 'regular', packs: { coffee: { gulf: 1 }, sachets: { 'pack-saffron': 1 }, dates: { khalas: 12 } },
    notes: { en: 'One coffee and twelve dates in the gold sleeve, for any visit, any time of year.', ar: 'قهوة واثنتا عشرة تمرة بالحزام الذهبي، لأي زيارة في أي وقت من السنة.' },
    contents: { en: 'Gift box with Najdi coffee (Gulf coffee and its saffron packet) and 12 Khalas dates.', ar: 'صندوق هدية فيه قهوة نجدية (قهوة خليجية وظرف زعفرانها) و١٢ تمرة خلاص.' }, preorder: true },
  { kind: 'box', id: 'coffee-duo', fam: 'dates', name: { en: 'The Coffee Duo', ar: 'ثنائي القهوة' }, price: 46, size: { en: '2 × 250 g', ar: '٢ × ٢٥٠ غ' }, img: '/media/img/giftbox.webp',
    insert: 'C2', sleeve: 'regular', packs: { coffee: { gulf: 1, yemeni: 1 }, sachets: { 'pack-saffron': 1 } },
    notes: { en: 'Najdi and Yemeni qahwa side by side, for the house that pours all year.', ar: 'نجدية ويمنية جنباً إلى جنب، للبيت الذي يصبّ طوال السنة.' },
    contents: { en: 'Gift box, gold sleeve, two coffees: Najdi (Gulf coffee with its saffron packet) and Yemeni qahwa.', ar: 'صندوق هدية بالحزام الذهبي، قهوتان: نجدية (قهوة خليجية مع ظرف الزعفران) ويمنية.' }, preorder: true },
  { kind: 'box', id: 'iftar-pair', fam: 'ramadan', name: { en: 'The Iftar Pair', ar: 'ثنائي الإفطار' }, price: 54, size: { en: '250 g + 12 dates', ar: '٢٥٠ غ + ١٢ تمرة' }, img: '/media/img/iftar-pair.webp',
    insert: 'C12', sleeve: 'ramadan', packs: { coffee: { gulf: 1 }, sachets: { 'pack-saffron': 1 }, dates: { khalas: 12 } },
    notes: { en: 'One coffee and twelve dates, for the first cup after sunset.', ar: 'قهوة واثنتا عشرة تمرة، لأول فنجان بعد الغروب.' },
    contents: { en: 'Gift box with Najdi coffee (Gulf coffee and its saffron packet) and 12 Khalas dates.', ar: 'صندوق هدية فيه قهوة نجدية (قهوة خليجية وظرف زعفرانها) و١٢ تمرة خلاص.' }, preorder: true },
  { kind: 'box', id: 'ramadan-box', fam: 'ramadan', name: { en: 'Ramadan Date Box', ar: 'صندوق تمر رمضان' }, price: 34, size: { en: '500 g', ar: '٥٠٠ غ' }, img: '/media/img/giftbox.webp',
    insert: 'everyday', sleeve: 'ramadan', chooseDate: true,
    notes: { en: 'The everyday box in its Ramadan sleeve.', ar: 'العلبة اليومية بحزام رمضان.' },
    contents: { en: '500 g of one variety, Ramadan sleeve.', ar: '٥٠٠ غ من صنف واحد، بحزام رمضان.' }, preorder: true },
  { kind: 'box', id: 'eid-coffee-dates', fam: 'eid', name: { en: 'Eid Coffee & Dates', ar: 'قهوة وتمر العيد' }, price: 56, size: { en: '250 g + 12 dates', ar: '٢٥٠ غ + ١٢ تمرة' }, img: '/media/img/eid-coffee-dates.webp',
    insert: 'C12', sleeve: 'eid', packs: { coffee: { gulf: 1 }, sachets: { 'pack-saffron': 1 }, dates: { khalas: 12 } },
    notes: { en: 'For the first house you visit. The elders, always.', ar: 'لأول بيت تزورونه. الكبار دائماً.' },
    contents: { en: 'Gold Eid band, Najdi coffee and 12 dates.', ar: 'حزام العيد الذهبي، قهوة نجدية و١٢ تمرة.' }, preorder: true },
  { kind: 'box', id: 'eid-dates', fam: 'eid', name: { en: 'Eid Dates', ar: 'تمر العيد' }, price: 58, size: { en: '24 dates', ar: '٢٤ تمرة' }, img: '/media/img/eid-dates.webp',
    insert: 'D24', sleeve: 'eid', packs: { dates: { sukkari: 6, khalas: 6, khudri: 6, ajwa: 6 } },
    notes: { en: 'Four varieties for the table that fills all day.', ar: 'أربعة أصناف لمائدة تمتلئ طوال اليوم.' },
    contents: { en: 'Gold Eid band, 24 dates, four varieties.', ar: 'حزام العيد الذهبي، ٢٤ تمرة، أربعة أصناف.' }, preorder: true },
  { kind: 'box', id: 'eid-duo', fam: 'eid', name: { en: 'Eid Coffee Duo', ar: 'ثنائي قهوة العيد' }, price: 46, size: { en: '2 × 250 g', ar: '٢ × ٢٥٠ غ' }, img: '/media/img/eid-coffee.webp',
    insert: 'C2', sleeve: 'eid', packs: { coffee: { gulf: 1, yemeni: 1 }, sachets: { 'pack-saffron': 1 } },
    notes: { en: 'Najdi and Yemeni qahwa, for the house that pours all day.', ar: 'نجدية ويمنية، للبيت الذي يصبّ طوال اليوم.' },
    contents: { en: 'Gold Eid band, two coffees.', ar: 'حزام العيد الذهبي، قهوتان.' }, preorder: true },
];

export const PRODUCTS: Product[] = [...COFFEES, ...KITS, ...PACKS, ...BOXES];
// Names, descriptions and the other words are edited in the desk (Admin → Shop → Words), which saves them
// to src/content/products.json. That file wins over the text written above.
for (const p of PRODUCTS) Object.assign(p, (TEXT as Record<string, Partial<Record<string, L>>>)[p.id] ?? {});
export const byId = (id: string) => PRODUCTS.find(p => p.id === id);

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
export const kitInside = (k: Kit, lang: Lang) => [`${baseOf(k).name[lang]} ${baseOf(k).size}`, ...k.parts.map(x => (x.mini ? (lang === 'ar' ? 'ظرف صغير: ' : 'small ') : '') + (packOf(x.id)?.name[lang] ?? x.id))].join(' + ');
