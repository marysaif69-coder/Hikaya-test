// Errors from the server, in the page's language. The server writes its messages in English (and,
// for a few, an Arabic one as `message_ar`); on the Arabic pages the rest are shown from this list by
// their code. Used by checkout, My account, gift cards, the help form, Ask Hikaya and the footer.

type Err = { error?: string; message?: string; message_ar?: string; extra?: { left?: number; name?: string; box?: boolean } };

const AR: Record<string, string> = {
  // days and times
  closed: 'الطلبات متوقفة الآن. حاول مرة أخرى قريباً.',
  'bad-slot': 'اختر يوماً ووقتاً.',
  'bad-day': 'نعمل من الخميس إلى الأحد.',
  'closed-day': 'نحن مغلقون في ذلك اليوم. اختر يوماً آخر.',
  'too-soon': 'أُغلقت الطلبات لذلك اليوم. اختر يوماً لاحقاً.',
  'slot-full': 'لا مكان في هذا الموعد. اختر وقتاً أو يوماً آخر.',
  // My account
  'cannot-move': 'بدأنا تجهيز هذا الطلب. ردّ على رسالة التأكيد وسنساعدك.',
  'cannot-cancel': 'لم يعد ممكناً إلغاء هذا الطلب من الموقع. ردّ على رسالة التأكيد.',
  same: 'هذا هو اليوم والوقت نفسهما.',
  'too-late': 'فات وقت تغيير هذا الطلب من الموقع. ردّ على رسالة التأكيد وسنساعدك.',
  'not-found': 'لم نجد هذا الطلب.',
  login: 'سجّل الدخول أولاً.',
  // logging in
  email: 'تحقق من البريد الإلكتروني.',
  'wrong-code': 'الرمز غير صحيح.',
  expired: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.',
  'too-many': 'محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.',
  // checkout and gift cards
  invalid: 'تحقق من الحقول المحددة.',
  'empty-cart': 'السلة فارغة.',
  'choose-date': 'اختر نوع التمر للعلبة.',
  'sold-out': 'نفد أحد المنتجات في سلتك.',
  'not-offered': 'أحد المنتجات في سلتك غير متوفر الآن.',
  'no-price': 'أحد المنتجات في سلتك لم يُفتح للطلب بعد.',
  stock: 'لم يبقَ ما يكفي من أحد المنتجات. قلّل الكمية.',
  'day-limit': 'اكتمل الحجز لذلك اليوم. اختر يوماً آخر.',
  'bad-qty': 'تحقق من الكمية.',
  'unknown-product': 'أحد المنتجات لم يعد في المتجر. احذفه من السلة.',
  promo: 'هذا الرمز لا ينطبق على طلبك.',
  giftcard: 'تعذّر استخدام بطاقة الهدية هذه.',
  consent: 'ضع علامة في المربع للموافقة.',
  'card-off': 'الدفع بالبطاقة غير متاح الآن. اختر طريقة أخرى.',
  // Ask Hikaya and the help form
  'long-chat': 'هذه المحادثة طويلة. ابدأ محادثة جديدة، أو استخدم نموذج المساعدة.',
  busy: 'رسالة واحدة في كل مرة من فضلك.',
  'too-long': 'الرسالة طويلة. اختصرها قليلاً.',
  'ask-off': 'المساعد غير مفعّل بعد. استخدم نموذج المساعدة.',
  image: 'أرسل صورة بصيغة JPEG أو PNG أو WebP.',
  'too-large': 'الصورة كبيرة جداً.',
  enough: 'لدينا ما يكفي من الصور لهذا الطلب.',
  server: 'حدث خطأ من جهتنا. حاول مرة أخرى.',
};
// English for the few codes the server sends without a message.
const EN: Record<string, string> = {
  login: 'Please log in first.', 'bad-qty': 'Check the quantity.', 'unknown-product': 'Something in your cart is no longer in the shop. Remove it.',
  empty: 'Write a message first.', origin: 'Please reload the page and try again.', json: 'Please reload the page and try again.',
};

export function errorText(d: Err | null | undefined, ar: boolean, fallback = ''): string {
  const code = d?.error ?? '';
  if (!ar) {
    const m = d?.message;
    return m && m !== code ? m : EN[code] ?? (fallback || 'Something went wrong. Please try again.');
  }
  if (d?.message_ar) return d.message_ar;
  const x = d?.extra ?? {}, name = x.name ?? '';
  if (code === 'sold-out' && name) return `نفد من المتجر حالياً: ${name}.`;
  if (code === 'not-offered' && name) return `غير متوفر حالياً: ${name}.`;
  if (code === 'no-price' && name) return `لم يُفتح للطلب بعد: ${name}.`;
  if (code === 'stock' && name) return x.left ? `بقي ${x.left} فقط من ${name}. قلّل الكمية.` : `نفد للتو: ${name}.`;
  if (code === 'day-limit') {
    if (x.box) return x.left ? `نستطيع تجهيز ${x.left} من علب الهدايا فقط لذلك اليوم. قلّل الكمية أو اختر يوماً آخر.` : 'اكتمل حجز علب الهدايا لذلك اليوم. اختر يوماً آخر.';
    if (name) return x.left ? `يمكن تجهيز ${x.left} فقط من ${name} لذلك اليوم. قلّل الكمية أو اختر يوماً آخر.` : `اكتمل حجز ${name} لذلك اليوم. اختر يوماً آخر.`;
  }
  // On Arabic pages never fall back to the server's English.
  return AR[code] ?? (fallback || 'حدث خطأ. حاول مرة أخرى.');
}
