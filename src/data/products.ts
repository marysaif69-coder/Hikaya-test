// Single source of truth for both sites. Prices are drafts (CAD) until launch.

export type Lang = 'en' | 'ar';
export type L = { en: string; ar: string };

export type Family = 'palm' | 'mountain' | 'house' | 'husk' | 'dates' | 'ramadan' | 'eid';
export type Spice = 'saffron' | 'cardamom' | 'ginger' | 'husk' | 'sesame' | 'cinnamon';
export type DateId = 'sukkari' | 'khalas' | 'khudri' | 'ajwa' | 'medjool';

export interface Coffee {
  kind: 'coffee';
  id: string;
  fam: 'palm' | 'mountain' | 'house' | 'husk';
  name: L;
  price: number;
  size: string;
  roast: number; // 1–4, as printed on the bag
  spices: Spice[];
  grinds: ('dallah' | 'fine' | 'whole')[];
  notes: L;
  story: L;
  ingredients: [string, string]; // EN, FR — as printed on the label
  taste: L;
  /** Flat front/back artwork from the packaging mockups, when one exists. */
  art?: { front: string; back: string };
  /** Bunn speaks first; Tamr answers with the date that goes with this cup. */
  bunn: L;
  date: DateId;
  why: L;
}

export interface Box {
  kind: 'box';
  id: string;
  fam: 'dates' | 'ramadan' | 'eid';
  name: L;
  price: number;
  size: L;
  img: string;
  insert: 'everyday' | 'D24' | 'C12' | 'C2';
  sleeve: 'regular' | 'ramadan' | 'eid';
  notes: L;
  contents: L;
  chooseDate?: boolean;
  preorder: true;
}

export type Product = Coffee | Box;

export const FAMILIES: Record<Family, { name: L; line: L }> = {
  palm: { name: { en: 'Pot & Palm', ar: 'الدلّة والنخلة' }, line: { en: 'Gulf qahwa: light, golden, poured from the dallah.', ar: 'قهوة الخليج: فاتحة وذهبية، تُصبّ من الدلّة.' } },
  mountain: { name: { en: 'The Mountain', ar: 'الجبل' }, line: { en: 'Yemeni coffees from the terraces, each town its own way.', ar: 'قهوة اليمن من المدرجات، لكل مدينة طريقتها.' } },
  house: { name: { en: 'The House', ar: 'البيت' }, line: { en: 'Levantine coffee, fine and dark, boiled in the pot.', ar: 'القهوة الشامية، ناعمة وغامقة، تُغلى في الركوة.' } },
  husk: { name: { en: 'The Husk', ar: 'القشر' }, line: { en: 'Qishr: the coffee cherry before the bean.', ar: 'القشر: ثمرة البن قبل الحبّة.' } },
  dates: { name: { en: 'Dates & boxes', ar: 'التمر والصناديق' }, line: { en: 'Chosen by variety, region and harvest.', ar: 'نختاره بالصنف والمنطقة والموسم.' } },
  ramadan: { name: { en: 'Ramadan', ar: 'رمضان' }, line: { en: 'For the table at sunset.', ar: 'لمائدة الغروب.' } },
  eid: { name: { en: 'Eid edition', ar: 'إصدار العيد' }, line: { en: 'For the visits, not for wrapping paper.', ar: 'للزيارات، لا لورق الهدايا.' } },
};

export const SPICES: Record<Spice, { c: string; name: L }> = {
  saffron: { c: '#A93B28', name: { en: 'Saffron', ar: 'زعفران' } },
  cardamom: { c: '#5E7A2E', name: { en: 'Cardamom', ar: 'هيل' } }, // the one green: the cardamom dot
  ginger: { c: '#CF9C0C', name: { en: 'Ginger', ar: 'زنجبيل' } },
  husk: { c: '#8E2F1F', name: { en: 'Husk', ar: 'قشر' } },
  sesame: { c: '#D9C08A', name: { en: 'Sesame', ar: 'سمسم' } },
  cinnamon: { c: '#7A3E1D', name: { en: 'Cinnamon', ar: 'قرفة' } },
};

export const GRINDS: Record<'dallah' | 'fine' | 'whole', L> = {
  dallah: { en: 'Ground for the dallah', ar: 'مطحون للدلّة' },
  fine: { en: 'Fine, for the pot', ar: 'ناعم للركوة' },
  whole: { en: 'Whole bean', ar: 'حبوب كاملة' },
};

export const DATES: Record<DateId, { name: L; region: L; c: string; sweet: number; notes: L }> = {
  sukkari: { name: { en: 'Sukkari', ar: 'سكري' }, region: { en: 'Qassim', ar: 'القصيم' }, c: '#C98A3A', sweet: 95, notes: { en: 'Very sweet, soft to crisp, caramel.', ar: 'حلو جداً، طري إلى مقرمش، كراميل.' } },
  khalas: { name: { en: 'Khalas', ar: 'خلاص' }, region: { en: 'Al-Ahsa', ar: 'الأحساء' }, c: '#8E4A22', sweet: 80, notes: { en: 'Toffee and caramel, soft and moist.', ar: 'توفي وكراميل، طري ورطب.' } },
  medjool: { name: { en: 'Medjool', ar: 'مجهول' }, region: { en: 'Jordan Valley', ar: 'وادي الأردن' }, c: '#6E3420', sweet: 85, notes: { en: 'Large and fleshy, honey-caramel.', ar: 'كبيرة ولحمية، عسل وكراميل.' } },
  khudri: { name: { en: 'Khudri', ar: 'خضري' }, region: { en: 'Arabia', ar: 'الجزيرة العربية' }, c: '#5B2E17', sweet: 55, notes: { en: 'Firmer and darker, less sweet.', ar: 'أصلب وأغمق، أقل حلاوة.' } },
  ajwa: { name: { en: 'Ajwa', ar: 'عجوة' }, region: { en: 'Madinah', ar: 'المدينة' }, c: '#2B1710', sweet: 50, notes: { en: 'Small and near-black, gentle fruit.', ar: 'صغيرة شبه سوداء، فاكهية رقيقة.' } },
};

const C = (c: Omit<Coffee, 'kind' | 'size'> & { size?: string }): Coffee => ({ kind: 'coffee', size: '250 g', ...c });

export const COFFEES: Coffee[] = [
  C({ id: 'najdi', taste: { en: 'Golden · cardamom · saffron', ar: 'ذهبية · هيل · زعفران' }, art: { front: '/media/bags/najdi-front.jpg', back: '/media/bags/najdi-back.jpg' },  fam: 'palm', name: { en: 'Najdi', ar: 'نجدية' }, price: 24, roast: 1, spices: ['saffron', 'cardamom'], grinds: ['dallah', 'whole'],
    notes: { en: 'Golden and light. Cardamom leads, with a touch of saffron.', ar: 'ذهبية وخفيفة، الهيل أولاً ولمسة زعفران.' },
    story: { en: "Najd's way: roasted light, poured from the dallah into a small cup, always with a date.", ar: 'على طريقة نجد: تحميص فاتح، تُصبّ من الدلّة في فنجان صغير، ومعها تمرة دائماً.' },
    ingredients: ['Coffee, saffron, cardamom.', 'Café, safran, cardamome.'],
    bunn: { en: 'Light, with cardamom and saffron.', ar: 'فاتحة، فيها هيل وزعفران.' }, date: 'khalas',
    why: { en: 'Toffee-soft Khalas rounds the saffron.', ar: 'خلاص الطرية تُليّن الزعفران.' } }),
  C({ id: 'khaleeji', taste: { en: 'Floral · saffron · bright', ar: 'زهرية · زعفران · مشرقة' },  fam: 'palm', name: { en: 'Khaleeji', ar: 'خليجية' }, price: 24, roast: 1, spices: ['saffron', 'cardamom'], grinds: ['dallah', 'whole'],
    notes: { en: 'Heavy on saffron, floral and golden.', ar: 'زعفران وافر، زهرية وذهبية.' },
    story: { en: "The coast's qahwa: the same light roast, more saffron, a brighter, floral cup.", ar: 'قهوة الساحل: التحميص الفاتح نفسه، بزعفران أكثر وفنجان أزهى.' },
    ingredients: ['Coffee, saffron, cardamom.', 'Café, safran, cardamome.'],
    bunn: { en: 'More saffron than my brother.', ar: 'زعفراني أكثر من أخي.' }, date: 'sukkari',
    why: { en: 'Sukkari’s caramel against a floral cup.', ar: 'كراميل السكري مع فنجان زهري.' } }),
  C({ id: 'shamaliyya', taste: { en: 'Toasty · cardamom · round', ar: 'محمّصة · هيل · مستديرة' },  fam: 'palm', name: { en: 'Shamaliyya', ar: 'شمالية' }, price: 24, roast: 2, spices: ['cardamom'], grinds: ['dallah', 'whole'],
    notes: { en: 'Northern style, a shade darker, cardamom only.', ar: 'على طريقة الشمال، أغمق قليلاً، بالهيل فقط.' },
    story: { en: 'From the north of Arabia: a touch more roast and nothing but cardamom.', ar: 'من شمال الجزيرة: تحميص أعمق قليلاً ولا شيء غير الهيل.' },
    ingredients: ['Coffee, cardamom.', 'Café, cardamome.'],
    bunn: { en: 'From the north. Cardamom, nothing else.', ar: 'من الشمال، هيل ولا غيره.' }, date: 'khudri',
    why: { en: 'Firm Khudri for a deeper cup.', ar: 'خضري متماسك لفنجان أعمق.' } }),
  C({ id: 'radaey', taste: { en: 'Fruity · ginger · warm', ar: 'فاكهية · زنجبيل · دافئة' },  fam: 'mountain', name: { en: "Rada'ey", ar: 'رداعي' }, price: 26, roast: 1, spices: ['ginger', 'cardamom'], grinds: ['dallah', 'whole'],
    notes: { en: 'A lighter roast with ginger and cardamom.', ar: 'تحميص فاتح مع الزنجبيل والهيل.' },
    story: { en: "From Rada'a in Yemen: bright coffee, warm ginger, made in the pot.", ar: 'من رداع في اليمن: قهوة مشرقة وزنجبيل دافئ، تُصنع في الإبريق.' },
    ingredients: ['Coffee, ginger, cardamom.', 'Café, gingembre, cardamome.'],
    bunn: { en: "Rada'a ginger, for the cold.", ar: 'زنجبيل رداع، للبرد.' }, date: 'medjool',
    why: { en: 'Big, honeyed Medjool meets the ginger.', ar: 'مجهول العسلية تلاقي الزنجبيل.' } }),
  C({ id: 'jubani', taste: { en: 'Dried cherry · ginger · round', ar: 'كرز مجفف · زنجبيل · مستديرة' },  fam: 'mountain', name: { en: 'Jubani', ar: 'جُبَني' }, price: 26, roast: 2, spices: ['husk', 'cardamom', 'ginger'], grinds: ['dallah', 'whole'],
    notes: { en: 'Coffee, coffee husk, cardamom and ginger.', ar: 'بُن وقشر وهيل وزنجبيل.' },
    story: { en: 'The bean and its own husk in one pot, the way Juban makes it.', ar: 'الحبّة وقشرها في إبريق واحد، على طريقة جُبَن.' },
    ingredients: ['Coffee, cardamom, ginger, coffee husk.', 'Café, cardamome, gingembre, cascara.'],
    bunn: { en: 'Me, and my own husk.', ar: 'أنا، ومعي قشري.' }, date: 'sukkari',
    why: { en: 'Sukkari answers the dried-cherry note.', ar: 'السكري يجاوب طعم الكرز المجفف.' } }),
  C({ id: 'sanaani', taste: { en: 'Cocoa · dark fruit · full', ar: 'كاكاو · فاكهة داكنة · ممتلئة' },  fam: 'mountain', name: { en: "Sana'ani", ar: 'صنعاني' }, price: 26, roast: 3, spices: ['cardamom'], grinds: ['dallah', 'whole'],
    notes: { en: 'A deeper roast, boiled with cardamom until it rises.', ar: 'تحميص أعمق، يُغلى مع الهيل حتى يفور.' },
    story: { en: "Sana'a's coffee: brought up to a rise three times, strong and full.", ar: 'قهوة صنعاء: تفور ثلاث مرات، قوية وممتلئة.' },
    ingredients: ['Coffee, cardamom.', 'Café, cardamome.'],
    bunn: { en: 'I rise three times.', ar: 'أفور ثلاث مرات.' }, date: 'ajwa',
    why: { en: 'Dark Ajwa holds up to a dark cup.', ar: 'العجوة الداكنة تصمد أمام فنجان داكن.' } }),
  C({ id: 'baydani', taste: { en: 'Nutty · sesame · warm spice', ar: 'مكسرات · سمسم · بهار دافئ' }, art: { front: '/media/bags/baydani-front.jpg', back: '/media/bags/baydani-back.jpg' },  fam: 'mountain', name: { en: 'Baydani', ar: 'بيضاني' }, price: 26, roast: 3, spices: ['sesame', 'ginger', 'cinnamon'], grinds: ['dallah', 'whole'],
    notes: { en: 'Coffee roasted with sesame, with ginger and cinnamon.', ar: 'بُن محمّص مع السمسم، مع الزنجبيل والقرفة.' },
    story: { en: "Al-Bayda's way: sesame goes into the roaster with the beans.", ar: 'على طريقة البيضاء: يدخل السمسم المحمصة مع الحبوب.' },
    ingredients: ['Coffee, sesame, ginger, cinnamon. Contains: sesame.', 'Café, sésame, gingembre, cannelle. Contient : sésame.'],
    bunn: { en: 'They roasted me with sesame.', ar: 'حمّصوني مع السمسم.' }, date: 'khalas',
    why: { en: 'Khalas toffee with toasted sesame.', ar: 'توفي خلاص مع السمسم المحمّص.' } }),
  C({ id: 'lev-cardamom', taste: { en: 'Thick · bittersweet · cardamom', ar: 'كثيفة · مُرّة حلوة · هيل' },  fam: 'house', name: { en: 'Levantine, cardamom', ar: 'شامية بالهيل' }, price: 22, roast: 4, spices: ['cardamom'], grinds: ['fine', 'whole'],
    notes: { en: 'Our family’s dark roast, ground to powder, with cardamom.', ar: 'تحميص عائلتنا الغامق، مطحون ناعماً، بالهيل.' },
    story: { en: 'The Shami pot: fine, dark coffee boiled slowly, cardamom the way Syrian homes make it.', ar: 'الركوة الشامية: قهوة ناعمة غامقة تُغلى على مهل، بالهيل كما في البيوت الشامية.' },
    ingredients: ['Coffee, cardamom.', 'Café, cardamome.'],
    bunn: { en: 'Fine, for the pot.', ar: 'ناعمة، للركوة.' }, date: 'medjool',
    why: { en: 'A soft Medjool after a thick cup.', ar: 'مجهولة طرية بعد فنجان كثيف.' } }),
  C({ id: 'lev-plain', taste: { en: 'Thick · bittersweet · plain', ar: 'كثيفة · مُرّة حلوة · سادة' }, art: { front: '/media/bags/lev-plain-front.jpg', back: '/media/bags/lev-plain-back.jpg' },  fam: 'house', name: { en: 'Levantine, plain', ar: 'شامية سادة' }, price: 20, roast: 4, spices: [], grinds: ['fine', 'whole'],
    notes: { en: 'The same dark roast, nothing added.', ar: 'التحميص الغامق نفسه، بلا إضافات.' },
    story: { en: 'For those who take their coffee plain and their sweetness from the date.', ar: 'لمن يشرب قهوته سادة ويأخذ حلاوته من التمرة.' },
    ingredients: ['Coffee.', 'Café.'],
    bunn: { en: "I'm bitter today.", ar: 'أنا مُرّ اليوم.' }, date: 'medjool',
    why: { en: 'Then take two dates.', ar: 'خذ تمرتين إذن.' } }),
  C({ id: 'qishr', taste: { en: 'Cherry · honey · light', ar: 'كرز · عسل · خفيفة' },  fam: 'husk', name: { en: 'Qishr', ar: 'قشر' }, price: 16, size: '100 g', roast: 0, spices: ['husk'], grinds: ['whole'],
    notes: { en: 'Dried coffee cherry husks. Brew hot with ginger, or cold over ice.', ar: 'قشر ثمرة البن المجفف. ساخناً مع الزنجبيل أو بارداً على الثلج.' },
    story: { en: "Yemen's oldest coffee drink, older than the roasted bean. Light on caffeine.", ar: 'أقدم مشروبات البن في اليمن، أقدم من الحبّة المحمّصة. قليل الكافيين.' },
    ingredients: ['Coffee cherry husk.', 'Cascara.'],
    bunn: { en: 'I was a husk before the bean.', ar: 'كنتُ قشراً قبل البُن.' }, date: 'sukkari',
    why: { en: 'Cherry and caramel, hot or cold.', ar: 'كرز وكراميل، ساخناً أو بارداً.' } }),
];

export const BOXES: Box[] = [
  { kind: 'box', id: 'date-box', fam: 'dates', name: { en: 'The Everyday Date Box', ar: 'علبة التمر اليومية' }, price: 34, size: { en: '500 g', ar: '٥٠٠ غ' }, img: '/media/img/giftbox.jpg',
    insert: 'everyday', sleeve: 'regular', chooseDate: true,
    notes: { en: 'One variety, chosen by you. For the house, not for wrapping.', ar: 'صنف واحد تختاره. للبيت، لا للتغليف.' },
    contents: { en: '500 g of one date variety in a clear tray.', ar: '٥٠٠ غ من صنف واحد في علبة شفافة.' }, preorder: true },
  { kind: 'box', id: 'four-palms', fam: 'dates', name: { en: 'Four Palms', ar: 'أربع نخلات' }, price: 44, size: { en: '24 dates', ar: '٢٤ تمرة' }, img: '/media/img/ramadan-date.jpg',
    insert: 'D24', sleeve: 'regular',
    notes: { en: 'Sukkari, Khalas, Khudri and Ajwa, six of each, side by side.', ar: 'سكري وخلاص وخضري وعجوة، ست من كل صنف، جنباً إلى جنب.' },
    contents: { en: 'Gift box, 24 dates in paper cups, four varieties.', ar: 'صندوق هدية، ٢٤ تمرة في أكواب ورقية، أربعة أصناف.' }, preorder: true },
  { kind: 'box', id: 'iftar-pair', fam: 'ramadan', name: { en: 'The Iftar Pair', ar: 'زوج الإفطار' }, price: 54, size: { en: '250 g + 12 dates', ar: '٢٥٠ غ + ١٢ تمرة' }, img: '/media/img/iftar-pair.jpg',
    insert: 'C12', sleeve: 'ramadan',
    notes: { en: 'One coffee and twelve dates, for the first cup after sunset.', ar: 'قهوة واثنتا عشرة تمرة، لأول فنجان بعد الغروب.' },
    contents: { en: 'Gift box with Najdi coffee and 12 Khalas dates.', ar: 'صندوق هدية فيه قهوة نجدية و١٢ تمرة خلاص.' }, preorder: true },
  { kind: 'box', id: 'ramadan-box', fam: 'ramadan', name: { en: 'Ramadan Date Box', ar: 'صندوق تمر رمضان' }, price: 34, size: { en: '500 g', ar: '٥٠٠ غ' }, img: '/media/img/giftbox.jpg',
    insert: 'everyday', sleeve: 'ramadan', chooseDate: true,
    notes: { en: 'The everyday box in its Ramadan sleeve.', ar: 'العلبة اليومية بحزام رمضان.' },
    contents: { en: '500 g of one variety, Ramadan sleeve.', ar: '٥٠٠ غ من صنف واحد، بحزام رمضان.' }, preorder: true },
  { kind: 'box', id: 'eid-coffee-dates', fam: 'eid', name: { en: 'Eid Coffee & Dates', ar: 'قهوة وتمر العيد' }, price: 56, size: { en: '250 g + 12 dates', ar: '٢٥٠ غ + ١٢ تمرة' }, img: '/media/img/eid-coffee-dates.jpg',
    insert: 'C12', sleeve: 'eid',
    notes: { en: 'For the first house you visit. The elders, always.', ar: 'لأول بيت تزورونه. الكبار دائماً.' },
    contents: { en: 'Gold Eid band, Najdi coffee and 12 dates.', ar: 'حزام العيد الذهبي، قهوة نجدية و١٢ تمرة.' }, preorder: true },
  { kind: 'box', id: 'eid-dates', fam: 'eid', name: { en: 'Eid Dates', ar: 'تمر العيد' }, price: 58, size: { en: '24 dates', ar: '٢٤ تمرة' }, img: '/media/img/eid-dates.jpg',
    insert: 'D24', sleeve: 'eid',
    notes: { en: 'Four varieties for the table that fills all day.', ar: 'أربعة أصناف لمائدة تمتلئ طوال اليوم.' },
    contents: { en: 'Gold Eid band, 24 dates, four varieties.', ar: 'حزام العيد الذهبي، ٢٤ تمرة، أربعة أصناف.' }, preorder: true },
  { kind: 'box', id: 'eid-duo', fam: 'eid', name: { en: 'Eid Coffee Duo', ar: 'ثنائي قهوة العيد' }, price: 46, size: { en: '2 × 250 g', ar: '٢ × ٢٥٠ غ' }, img: '/media/img/eid-coffee.jpg',
    insert: 'C2', sleeve: 'eid',
    notes: { en: 'Najdi and Khaleeji, for the house that pours all day.', ar: 'نجدية وخليجية، للبيت الذي يصبّ طوال اليوم.' },
    contents: { en: 'Gold Eid band, two coffees.', ar: 'حزام العيد الذهبي، قهوتان.' }, preorder: true },
];

export const PRODUCTS: Product[] = [...COFFEES, ...BOXES];
export const byId = (id: string) => PRODUCTS.find(p => p.id === id);

export const money = (n: number, lang: Lang) => (lang === 'ar' ? `${n} $` : `$${n}`);
