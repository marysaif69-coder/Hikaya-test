import type { Lang, L } from './products';

export const LANGS: Lang[] = ['en', 'ar'];
export const other = (l: Lang): Lang => (l === 'en' ? 'ar' : 'en');
export const dir = (l: Lang) => (l === 'ar' ? 'rtl' : 'ltr');
export const tr = (v: L, l: Lang) => v[l];
export const path = (l: Lang, p = '') => `/${l}/${p}${p && !p.endsWith('/') ? '/' : ''}`;

/** Interface copy. Bunn/Tamr lines live with the products; these are labels. */
export const UI = {
  season: { en: 'Ramadan pre-orders open January 2027 · pickup and our own delivery across Calgary', ar: 'الطلب المسبق لرمضان يفتح في يناير ٢٠٢٧ · استلام وتوصيل داخل كالغاري' },
  nav: {
    shop: { en: 'Shop', ar: 'المتجر' },
    ramadan: { en: 'Ramadan', ar: 'رمضان' },
    eid: { en: 'Eid', ar: 'العيد' },
    brew: { en: 'Brew', ar: 'التحضير' },
    story: { en: 'Our story', ar: 'حكايتنا' },
    visit: { en: 'Pickup & delivery', ar: 'الاستلام والتوصيل' },
  },
  langName: { en: 'عربي', ar: 'English' },
  cart: { en: 'Cart', ar: 'السلة' },
  menu: { en: 'Menu', ar: 'القائمة' },
  close: { en: 'Close', ar: 'إغلاق' },
  add: { en: 'Add to cart', ar: 'أضف إلى السلة' },
  addPair: { en: 'Add the pair', ar: 'أضف الاثنين' },
  added: { en: 'In your cart', ar: 'في سلتك' },
  view: { en: 'See the bag', ar: 'شاهد الكيس' },
  preorder: { en: 'Pre-order', ar: 'طلب مسبق' },
  draftPrice: { en: 'Draft price', ar: 'سعر مبدئي' },
  roast: { en: 'Roast', ar: 'التحميص' },
  grind: { en: 'Grind', ar: 'الطحن' },
  date: { en: 'Date', ar: 'التمر' },
  qty: { en: 'Quantity', ar: 'الكمية' },
  ingredients: { en: 'Label', ar: 'الملصق' },
  howToBrew: { en: 'How to brew it', ar: 'طريقة التحضير' },
  withDate: { en: 'Good with', ar: 'تليق بها' },
  inside: { en: "What's inside", ar: 'ماذا في الداخل' },
  footLine: { en: '[address], Calgary · Coffee from Yemen, the Gulf and the Levant, and dates for the table.', ar: '[العنوان]، كالغاري · قهوة اليمن والخليج والشام، وتمرٌ للمائدة.' },
  open: { en: 'وللحكاية بقية', ar: 'وللحكاية بقية' },
  openEn: { en: 'And the story goes on.', ar: '' },
  email: { en: 'Email', ar: 'البريد الإلكتروني' },
  join: { en: 'Write to me', ar: 'راسلوني' },
  listLine: { en: 'Three emails a year: pre-orders, Ramadan, Eid.', ar: 'ثلاث رسائل في السنة: الطلب المسبق، رمضان، العيد.' },
  skip: { en: 'Skip to content', ar: 'انتقل إلى المحتوى' },
} satisfies Record<string, L | Record<string, L>>;
