// Order errors from the server, in the page's language. The server writes its messages in English;
// on the Arabic pages the fixed ones are shown from this list, by their code. Codes not listed here
// keep the server's message.

type Err = { error?: string; message?: string; extra?: { left?: number; name?: string; box?: boolean } };

const AR: Record<string, string> = {
  closed: 'الطلبات متوقفة الآن. حاول مرة أخرى قريباً.',
  'bad-slot': 'اختر يوماً ووقتاً.',
  'bad-day': 'نعمل من الخميس إلى الأحد.',
  'closed-day': 'نحن مغلقون في ذلك اليوم. اختر يوماً آخر.',
  'too-soon': 'أُغلقت الطلبات لذلك اليوم. اختر يوماً لاحقاً.',
  'slot-full': 'لا مكان في هذا الموعد. اختر وقتاً أو يوماً آخر.',
  'cannot-move': 'بدأنا تجهيز هذا الطلب. ردّ على رسالة التأكيد وسنساعدك.',
  'cannot-cancel': 'لم يعد ممكناً إلغاء هذا الطلب من الموقع. ردّ على رسالة التأكيد.',
  same: 'هذا هو اليوم والوقت نفسهما.',
  'too-late': 'فات وقت تغيير هذا الطلب من الموقع. ردّ على رسالة التأكيد وسنساعدك.',
  'not-found': 'لم نجد هذا الطلب.',
  'choose-date': 'اختر نوع التمر للعلبة.',
};

export function errorText(d: Err | null | undefined, ar: boolean, fallback = ''): string {
  if (!ar) return d?.message ?? fallback;
  const code = d?.error ?? '', x = d?.extra ?? {}, name = x.name ?? '';
  if (AR[code]) return AR[code];
  if (code === 'sold-out' && name) return `نفد من المتجر حالياً: ${name}.`;
  if (code === 'not-offered' && name) return `غير متوفر حالياً: ${name}.`;
  if (code === 'no-price' && name) return `لم يُفتح للطلب بعد: ${name}.`;
  if (code === 'stock' && name) return x.left ? `بقي ${x.left} فقط من ${name}. قلّل الكمية.` : `نفد للتو: ${name}.`;
  if (code === 'day-limit') {
    if (x.box) return x.left ? `نستطيع تجهيز ${x.left} من علب الهدايا فقط لذلك اليوم. قلّل الكمية أو اختر يوماً آخر.` : 'اكتمل حجز علب الهدايا لذلك اليوم. اختر يوماً آخر.';
    if (name) return x.left ? `يمكن تجهيز ${x.left} فقط من ${name} لذلك اليوم. قلّل الكمية أو اختر يوماً آخر.` : `اكتمل حجز ${name} لذلك اليوم. اختر يوماً آخر.`;
  }
  return fallback || d?.message || '';
}
