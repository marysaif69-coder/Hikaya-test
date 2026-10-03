// Transactional email through Resend (https://resend.com). Without RESEND_API_KEY every email
// is still written to email_log as 'skipped', so the system runs before email is set up.
import { sql } from './db';
import { env } from './http';
import { dollars } from './pricing';

type Lang = 'en' | 'ar';
export type Mail = { to: string; subject: string; html: string; text: string; kind: string; orderId?: number | null; replyTo?: string };

export async function send(m: Mail) {
  const key = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM') || 'Hikaya <orders@hikayacoffee.ca>';
  let status = 'skipped', error: string | null = null;
  if (key) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, reply_to: m.replyTo || env('EMAIL_REPLY_TO') || undefined }),
      });
      status = r.ok ? 'sent' : 'failed';
      if (!r.ok) error = (await r.text()).slice(0, 500);
    } catch (e) { status = 'failed'; error = String(e).slice(0, 500); }
  }
  await sql`INSERT INTO email_log (to_email, subject, kind, order_id, status, error) VALUES (${m.to}, ${m.subject}, ${m.kind}, ${m.orderId ?? null}, ${status}, ${error})`;
  return status;
}

// ---------- layout ----------
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function layout(lang: Lang, title: string, body: string, siteUrl: string) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;background:#F5EFE3;font-family:Arial,'IBM Plex Sans','IBM Plex Sans Arabic',sans-serif;color:#33211A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5EFE3"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBF8F1;border-radius:22px;overflow:hidden">
<tr><td style="background:#CF9C0C;height:8px"></td></tr>
<tr><td style="padding:28px 28px 8px;text-align:center"><img src="${siteUrl}/brand/logo-email.png" width="72" height="60" alt="Hikaya" style="display:inline-block"><div style="font-size:26px;font-weight:700;margin-top:6px">حكاية</div><div style="font-size:10px;letter-spacing:4px;color:#66503F">HIKAYA</div></td></tr>
<tr><td style="padding:12px 28px 28px;font-size:16px;line-height:1.55;text-align:${lang === 'ar' ? 'right' : 'left'}">
<h1 style="font-size:22px;margin:0 0 14px">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:18px 28px;background:#EDE3D0;font-size:13px;color:#66503F;text-align:center">وللحكاية بقية · <a href="${siteUrl}/${lang}/" style="color:#A93B28">hikayacoffee.ca</a> · Instagram @hikaya.yyc</td></tr>
</table></td></tr></table></body></html>`;
}
const btn = (href: string, label: string) => `<p style="margin:22px 0"><a href="${href}" style="background:#33211A;color:#F5EFE3;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;display:inline-block">${esc(label)}</a></p>`;

// ---------- login code ----------
export function codeEmail(to: string, code: string, lang: Lang, siteUrl: string): Mail {
  const t = lang === 'ar'
    ? { s: `رمز الدخول إلى حكاية: ${code}`, h: 'رمز الدخول', p: 'اكتب هذا الرمز في الصفحة المفتوحة. ينتهي بعد ١٠ دقائق. إن لم تطلبه فتجاهل هذه الرسالة.' }
    : { s: `Your Hikaya login code: ${code}`, h: 'Your login code', p: 'Type this code on the page you have open. It expires in 10 minutes. If you did not ask for it, ignore this email.' };
  const body = `<p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:6px 0 14px;direction:ltr;text-align:center">${code}</p><p>${t.p}</p>`;
  return { to, subject: t.s, html: layout(lang, t.h, body, siteUrl), text: `${t.h}: ${code}\n\n${t.p}`, kind: 'login-code' };
}

// ---------- order emails ----------
export type OrderForMail = {
  id: number; ref: string; email: string; name: string; lang: Lang; method: string; street: string | null; postal: string | null;
  slot_date: string; slot_window: string; payment: string; payment_status: string; status: string;
  subtotal_cents: number; delivery_cents: number; total_cents: number; notes?: string | null;
  gift?: boolean; gift_to?: string | null; gift_message?: string | null; discount_cents?: number; promo_code?: string | null;
  gift_card_cents?: number; gift_card_code?: string | null; every_weeks?: number | null;
};
export type ItemForMail = { name_en: string; name_ar: string; option_en: string | null; option_ar: string | null; qty: number; unit_cents: number };

const day = (iso: string, lang: Lang) => new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar-u-nu-arab' : 'en-CA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

const COPY = {
  received: {
    en: (o: OrderForMail) => ({ s: `We have your order ${o.ref}`, h: `Thank you, ${o.name.split(' ')[0]}.`, p: 'Your pre-order is in. We will confirm it by email, usually within a day.' }),
    ar: (o: OrderForMail) => ({ s: `وصلنا طلبك ${o.ref}`, h: `شكراً يا ${o.name.split(' ')[0]}.`, p: 'وصلنا طلبك المسبق، وسنؤكده بالبريد خلال يوم عادةً.' }),
  },
  confirmed: {
    en: (o: OrderForMail) => ({ s: `Order ${o.ref} is confirmed`, h: 'Your order is confirmed.', p: 'Everything is set. Here are your details.' }),
    ar: (o: OrderForMail) => ({ s: `تأكّد طلبك ${o.ref}`, h: 'تأكّد طلبك.', p: 'كل شيء جاهز. هذه تفاصيل طلبك.' }),
  },
  ready: {
    en: (o: OrderForMail) => ({ s: `Order ${o.ref} is ready for pickup`, h: 'Your order is ready.', p: 'Come by during your pickup time. Bring your order number.' }),
    ar: (o: OrderForMail) => ({ s: `طلبك ${o.ref} جاهز للاستلام`, h: 'طلبك جاهز.', p: 'مرّ علينا في موعد الاستلام، ومعك رقم الطلب.' }),
  },
  'out-for-delivery': {
    en: (o: OrderForMail) => ({ s: `Order ${o.ref} is on its way`, h: 'Your order is on its way.', p: 'We are driving it to you now, within your delivery window.' }),
    ar: (o: OrderForMail) => ({ s: `طلبك ${o.ref} في الطريق`, h: 'طلبك في الطريق.', p: 'نحن في الطريق إليك الآن، ضمن موعد التوصيل.' }),
  },
  completed: {
    en: (o: OrderForMail) => ({ s: `Thank you for order ${o.ref}`, h: 'Enjoy it.', p: 'Thank you for choosing Hikaya. The brew guide for every coffee is on our site.' }),
    ar: (o: OrderForMail) => ({ s: `شكراً على طلبك ${o.ref}`, h: 'بالهناء.', p: 'شكراً لاختيارك حكاية. طريقة تحضير كل قهوة على موقعنا.' }),
  },
  cancelled: {
    en: (o: OrderForMail) => ({ s: `Order ${o.ref} was cancelled`, h: 'Your order was cancelled.', p: 'If this is a surprise, reply to this email and we will sort it out.' }),
    ar: (o: OrderForMail) => ({ s: `أُلغي طلبك ${o.ref}`, h: 'أُلغي طلبك.', p: 'إن كان هذا مفاجئاً فردّ على هذه الرسالة وسنحلّ الأمر.' }),
  },
  reminder: {
    en: (o: OrderForMail) => ({ s: `Tomorrow: your Hikaya order ${o.ref}`, h: 'See you tomorrow.', p: o.method === 'pickup' ? 'A reminder of your pickup time tomorrow.' : 'A reminder that we deliver your order tomorrow.' }),
    ar: (o: OrderForMail) => ({ s: `غداً: طلبك من حكاية ${o.ref}`, h: 'نراك غداً.', p: o.method === 'pickup' ? 'تذكير بموعد الاستلام غداً.' : 'تذكير بأننا نوصل طلبك غداً.' }),
  },
} as const;
export type OrderMailKind = keyof typeof COPY;

export function orderEmail(kind: OrderMailKind, o: OrderForMail, items: ItemForMail[], viewUrl: string, siteUrl: string): Mail {
  const L = (o.lang === 'ar' ? 'ar' : 'en') as Lang;
  const c = COPY[kind][L](o);
  const ar = L === 'ar';
  const rows = items.map(i => `<tr><td style="padding:6px 0">${i.qty} × ${esc(ar ? i.name_ar : i.name_en)}${i.option_en ? `<br><span style="color:#66503F;font-size:14px">${esc(ar ? i.option_ar : i.option_en)}</span>` : ''}</td><td style="padding:6px 0;text-align:${ar ? 'left' : 'right'};white-space:nowrap">${dollars(i.unit_cents * i.qty)}</td></tr>`).join('');
  const where = o.method === 'pickup'
    ? (ar ? 'استلام من [العنوان]، كالغاري' : 'Pickup at [address], Calgary')
    : (ar ? `توصيل إلى ${esc(o.street)}، ${esc(o.postal)}` : `Delivery to ${esc(o.street)}, ${esc(o.postal)}`);
  const pay = o.total_cents === 0 ? (ar ? 'دُفع كاملاً ببطاقة الهدية.' : 'Paid in full with your gift card.') : o.payment_status === 'paid' ? (ar ? 'مدفوع. شكراً.' : 'Paid. Thank you.')
    : o.payment === 'e-transfer' ? (ar ? `أرسل ${dollars(o.total_cents)} بتحويل Interac إلى ${esc(env('ETRANSFER_EMAIL') || 'orders@hikayacoffee.ca')}، واكتب رقم الطلب <span style="white-space:nowrap">${o.ref}</span> في الرسالة.` : `Send ${dollars(o.total_cents)} by Interac e-Transfer to ${esc(env('ETRANSFER_EMAIL') || 'orders@hikayacoffee.ca')} with <span style="white-space:nowrap">${o.ref}</span> in the message.`)
    : o.payment === 'card' ? (ar ? 'الدفع بالبطاقة عبر Square.' : 'Card payment through Square.')
    : (ar ? 'الدفع عند الاستلام، بالبطاقة أو نقداً.' : 'Pay at pickup or handover, by card or cash.');
  const showDetails = kind !== 'cancelled';
  const body = `<p>${c.p}</p>${o.every_weeks && kind === 'received' ? `<p>${ar ? `هذا طلبك المنتظم كل ${o.every_weeks === 2 ? 'أسبوعين' : '٤ أسابيع'}. تستطيع تخطّي المرة القادمة أو إيقافه من حسابك.` : `This is your regular order, every ${o.every_weeks} weeks. You can skip the next one or stop it from your account.`}</p>` : ''}
<p style="margin:16px 0 6px;font-size:14px;color:#66503F">${ar ? 'رقم الطلب' : 'Order number'}</p><p style="margin:0;font-size:22px;font-weight:700;color:#A93B28;direction:ltr;${ar ? 'text-align:right' : ''}">${o.ref}</p>
${showDetails ? `${o.gift ? `<p style="margin:16px 0 0;background:#EDE3D0;border-radius:12px;padding:10px 14px">${ar ? 'هدية إلى' : 'A gift for'} <b>${esc(o.gift_to)}</b>${o.gift_message ? `<br><i>“${esc(o.gift_message)}”</i>` : ''}</p>` : ''}
<p style="margin:16px 0 0"><strong>${day(o.slot_date, L)}</strong> · <span style="direction:ltr;unicode-bidi:embed">${esc(o.slot_window)}</span><br>${where}</p>
<table role="presentation" width="100%" style="margin:16px 0;border-top:1px solid #DFD1BA;border-bottom:1px solid #DFD1BA;font-size:15px">${rows}
${o.delivery_cents ? `<tr><td style="padding:6px 0">${ar ? 'التوصيل' : 'Delivery'}</td><td style="text-align:${ar ? 'left' : 'right'}">${dollars(o.delivery_cents)}</td></tr>` : ''}
${o.discount_cents ? `<tr><td style="padding:6px 0">${ar ? 'الخصم' : 'Discount'}${o.promo_code ? ` (${esc(o.promo_code)})` : ''}</td><td style="text-align:${ar ? 'left' : 'right'}">−${dollars(o.discount_cents)}</td></tr>` : ''}
${o.gift_card_cents ? `<tr><td style="padding:6px 0">${ar ? 'بطاقة هدية' : 'Gift card'}</td><td style="text-align:${ar ? 'left' : 'right'}">−${dollars(o.gift_card_cents)}</td></tr>` : ''}
<tr><td style="padding:8px 0;font-weight:700">${ar ? 'الإجمالي' : 'Total'}</td><td style="text-align:${ar ? 'left' : 'right'};font-weight:700">${dollars(o.total_cents)}</td></tr></table>
<p>${pay}</p>` : ''}
${btn(viewUrl, ar ? 'عرض طلبك' : 'View your order')}
${kind === 'completed' ? `<p><a href="${siteUrl}/${L}/brew/" style="color:#A93B28">${ar ? 'طريقة التحضير' : 'How to brew it'}</a></p>` : ''}`;
  const text = `${c.h}\n\n${c.p}\n\n${ar ? 'رقم الطلب' : 'Order'}: ${o.ref}\n${o.slot_date} ${o.slot_window}\n${dollars(o.total_cents)}\n\n${viewUrl}`;
  return { to: o.email, subject: c.s, html: layout(L, c.h, body, siteUrl), text, kind: `order-${kind}`, orderId: o.id };
}

/** New-order alert for the team. */
export function teamAlert(o: OrderForMail, items: ItemForMail[], adminUrl: string): Mail[] {
  const lines = items.map(i => `${i.qty} × ${i.name_en}${i.option_en ? ` (${i.option_en})` : ''}`).join('\n');
  const text = `New order ${o.ref} — ${dollars(o.total_cents)}\n${o.name} · ${o.email}\n${o.method} · ${o.slot_date} ${o.slot_window}${o.method === 'delivery' ? `\n${o.street}, ${o.postal}` : ''}\nPayment: ${o.payment}\n${o.gift ? `GIFT for ${o.gift_to}${o.gift_message ? ` — card: "${o.gift_message}"` : ''}\n` : ''}\n${lines}\n${o.notes ? `\nNote: ${o.notes}\n` : ''}\n${adminUrl}`;
  const html = `<pre style="font:15px/1.5 Arial,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`;
  return env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean)
    .map((to: string) => ({ to, subject: `New order ${o.ref} · ${dollars(o.total_cents)} · ${o.slot_date}`, html, text, kind: 'team-new-order', orderId: o.id }));
}

// ---------- help requests ----------
export type TicketForMail = { ref: string; kind: string; email: string; name: string | null; phone: string | null; lang: Lang; order_ref: string | null; summary: string; details: string | null; source: string };

/** "We have your message" to the customer. */
export function ticketReceived(t: TicketForMail, siteUrl: string, ramadan: boolean): Mail {
  const ar = t.lang === 'ar';
  const when = ar ? (ramadan ? 'خلال يومين' : 'خلال يوم واحد عادةً') : (ramadan ? 'within two days' : 'usually within one day');
  const c = ar
    ? { s: `وصلتنا رسالتك · ${t.ref}`, h: 'وصلتنا رسالتك', p: `رقم طلبك عندنا ${t.ref}. سيقرأه أحد من فريق حكاية ويرد عليك بالبريد ${when}.`, k: 'إن كان في الطلب شيء تالف، احتفظ به وبالتغليف حتى نرد عليك.' }
    : { s: `We have your message · ${t.ref}`, h: 'We have your message', p: `Your request number is ${t.ref}. Someone from the Hikaya team will read it and reply by email, ${when}.`, k: 'If something arrived damaged, please keep it and the packaging until we reply.' };
  const body = `<p>${esc(c.p)}</p><p style="background:#EDE3D0;border-radius:14px;padding:12px 16px">${esc(t.summary)}</p><p>${esc(c.k)}</p>`;
  return { to: t.email, subject: c.s, html: layout(t.lang, c.h, body, siteUrl), text: `${c.h}\n\n${c.p}\n\n${t.summary}\n\n${c.k}`, kind: 'ticket-received', replyTo: env('EMAIL_REPLY_TO') || undefined };
}

/** New request alert for the team; urgent kinds are marked in the subject. */
export function ticketAlert(t: TicketForMail, adminUrl: string): Mail[] {
  const urgent = ['damaged', 'wrong-item', 'missing', 'late'].includes(t.kind);
  const text = `${urgent ? 'URGENT · ' : ''}${t.kind} · ${t.ref} (from ${t.source === 'ask' ? 'Ask Hikaya' : 'the help form'})\n${t.name ?? ''} · ${t.email}${t.phone ? ' · ' + t.phone : ''}${t.order_ref ? `\nOrder: ${t.order_ref}` : ''}\n\n${t.summary}\n${t.details ? `\n${t.details}\n` : ''}\n${adminUrl}`;
  const html = `<pre style="font:15px/1.5 Arial,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`;
  return env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean)
    .map((to: string) => ({ to, subject: `${urgent ? '⚠ ' : ''}Help request ${t.ref} · ${t.kind}${t.order_ref ? ' · ' + t.order_ref : ''}`, html, text, kind: 'team-ticket', replyTo: t.email }));
}

/** The team's reply from the Inbox, sent in the customer's language layout. */
export function ticketReply(t: TicketForMail, message: string, siteUrl: string): Mail {
  const ar = t.lang === 'ar';
  const s = ar ? `رد من حكاية · ${t.ref}` : `A reply from Hikaya · ${t.ref}`;
  const body = message.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return { to: t.email, subject: s, html: layout(t.lang, ar ? 'رد من حكاية' : 'A reply from Hikaya', body, siteUrl), text: message, kind: 'ticket-reply', replyTo: env('EMAIL_REPLY_TO') || undefined };
}

// ---------- refunds ----------
export function refundEmail(o: OrderForMail, amount_cents: number, method: string, creditCode: string | null, siteUrl: string): Mail {
  const L = (o.lang === 'ar' ? 'ar' : 'en') as Lang, ar = L === 'ar';
  const amt = dollars(amount_cents);
  const how = method === 'card' ? (ar ? 'إلى البطاقة التي دفعت بها. يظهر عادةً خلال ٥ إلى ١٠ أيام عمل.' : 'to the card you paid with. It usually shows within 5 to 10 business days.')
    : method === 'e-transfer' ? (ar ? 'بتحويل Interac إلى بريدك.' : 'by Interac e-Transfer to your email.')
    : method === 'cash' ? (ar ? 'نقداً.' : 'in cash.')
    : (ar ? 'رصيداً لطلبك القادم. استخدم هذا الرمز عند الطلب:' : 'as credit for your next order. Use this code at checkout:');
  const s = ar ? `استرداد لطلبك ${o.ref}` : `A refund for order ${o.ref}`;
  const h = ar ? `أعدنا ${amt}` : `We have refunded ${amt}`;
  const body = `<p>${ar ? `أعدنا ${amt} من طلبك` : `We have refunded ${amt} from your order`} <span style="white-space:nowrap;direction:ltr">${o.ref}</span> ${how}</p>
${creditCode ? `<p style="font-size:26px;font-weight:700;letter-spacing:2px;color:#A93B28;direction:ltr;text-align:center">${creditCode}</p>` : ''}
<p>${ar ? 'نأسف لما حدث، وشكراً لصبرك.' : 'We are sorry for the trouble, and thank you for your patience.'}</p>`;
  return { to: o.email, subject: s, html: layout(L, h, body, siteUrl), text: `${h}\n\n${o.ref}\n${creditCode ?? ''}`, kind: 'order-refund', orderId: o.id };
}

// ---------- back in stock, mailing list, reviews ----------
export function backInStockEmail(to: string, lang: Lang, name: { en: string; ar: string }, url: string, siteUrl: string, unsub: string | null): Mail {
  const ar = lang === 'ar';
  const s = ar ? `عاد إلى المتجر: ${name.ar}` : `Back in the shop: ${name.en}`;
  const body = `<p>${ar ? `طلبتَ أن نخبرك حين يعود <b>${esc(name.ar)}</b>. عاد الآن، والكمية محدودة.` : `You asked us to tell you when <b>${esc(name.en)}</b> came back. It's back now, while it lasts.`}</p>${btn(url, ar ? 'اطلبه الآن' : 'Order it now')}
<p style="font-size:13px;color:#66503F">${ar ? 'هذه رسالة واحدة فقط لهذا المنتج.' : 'This is the only email about this product.'}</p>`;
  return { to, subject: s, html: layout(lang, ar ? 'عاد إلى المتجر' : 'It’s back', body, siteUrl), text: `${s}\n\n${url}`, kind: 'back-in-stock' };
}

export function listConfirmEmail(to: string, lang: Lang, confirmUrl: string, siteUrl: string): Mail {
  const ar = lang === 'ar';
  const s = ar ? 'أكّد اشتراكك في رسائل حكاية' : 'Confirm your Hikaya letters';
  const body = `<p>${ar ? 'طلبتَ أن تصلك رسائل حكاية: ثلاث رسائل في السنة. اضغط للتأكيد. إن لم تطلب ذلك فتجاهل هذه الرسالة ولن نرسل شيئاً.' : 'You asked for Hikaya letters: three emails a year. Click to confirm. If this wasn’t you, ignore this email and we won’t write again.'}</p>${btn(confirmUrl, ar ? 'نعم، أرسلوا لي' : 'Yes, write to me')}`;
  return { to, subject: s, html: layout(lang, s, body, siteUrl), text: `${s}\n\n${confirmUrl}`, kind: 'list-confirm' };
}

export function reviewEmail(o: OrderForMail, reviewUrl: string, siteUrl: string): Mail {
  const L = (o.lang === 'ar' ? 'ar' : 'en') as Lang, ar = L === 'ar';
  const s = ar ? 'كيف كانت القهوة والتمر؟' : 'How was it?';
  const body = `<p>${ar ? `نرجو أن طلبك ${o.ref} أعجبك. إن أعجبك، كلمتان على Google تساعدان الناس في كالغاري على إيجادنا.` : `We hope you enjoyed order ${o.ref}. If you did, a few words on Google help people in Calgary find us.`}</p>${btn(reviewUrl, ar ? 'اكتب رأيك' : 'Leave a review')}
<p>${ar ? 'وإن لم يكن كل شيء كما يجب، ردّ على هذه الرسالة وأخبرنا.' : 'And if something wasn’t right, reply to this email and tell us.'}</p>`;
  return { to: o.email, subject: s, html: layout(L, s, body, siteUrl), text: `${s}\n\n${reviewUrl}`, kind: 'review-request', orderId: o.id };
}

// ---------- gift cards ----------
export type GiftCardForMail = { ref: string; code: string; amount_cents: number; balance_cents?: number; buyer_name: string; buyer_email: string; to_name: string; to_email: string | null; message: string | null; lang: Lang; payment: string; square_link_url?: string | null };

/** To the person receiving it (or to the buyer to pass on, when no recipient email was given). */
export function giftCardEmail(g: GiftCardForMail, siteUrl: string): Mail {
  const ar = g.lang === 'ar', L = g.lang;
  const forBuyer = !g.to_email;
  const s = ar ? `بطاقة هدية من حكاية بقيمة ${dollars(g.amount_cents)}` : `A ${dollars(g.amount_cents)} Hikaya gift card`;
  const intro = forBuyer
    ? (ar ? `هذه بطاقة الهدية التي اشتريتها لـ <b>${esc(g.to_name)}</b>. أرسل لهم الرمز أو اطبع هذه الرسالة.` : `Here is the gift card you bought for <b>${esc(g.to_name)}</b>. Pass the code on, or print this email.`)
    : (ar ? `أهداك <b>${esc(g.buyer_name)}</b> بطاقة هدية من حكاية، قهوة وتمر من كالغاري.` : `<b>${esc(g.buyer_name)}</b> sent you a Hikaya gift card: coffee and dates from Calgary.`);
  const body = `<p>${intro}</p>
${g.message ? `<p style="background:#EDE3D0;border-radius:12px;padding:10px 14px"><i>“${esc(g.message)}”</i></p>` : ''}
<p style="margin:18px 0 4px;font-size:14px;color:#66503F;text-align:center">${ar ? 'الرمز' : 'Your code'}</p>
<p style="margin:0;font-size:28px;font-weight:700;letter-spacing:3px;color:#A93B28;direction:ltr;text-align:center">${g.code}</p>
<p style="text-align:center;font-weight:700">${dollars(g.amount_cents)}</p>
<p>${ar ? 'اكتب الرمز في خانة «بطاقة هدية» عند الطلب. ما يتبقى من الرصيد يبقى للمرة القادمة.' : 'Type the code in the "Gift card" box at checkout. Whatever is left stays on the card for next time.'}</p>
${btn(`${siteUrl}/${L}/shop/`, ar ? 'إلى المتجر' : 'To the shop')}`;
  return { to: g.to_email || g.buyer_email, subject: s, html: layout(L, ar ? 'بطاقة هدية' : 'A gift card for you', body, siteUrl), text: `${s}\n\n${g.code}\n\n${siteUrl}/${L}/shop/`, kind: 'gift-card' };
}

/** To the buyer when they order: how to pay, or that it is paid and on its way. */
export function giftCardReceipt(g: GiftCardForMail, paid: boolean, siteUrl: string): Mail {
  const ar = g.lang === 'ar', L = g.lang;
  const s = paid ? (ar ? `أُرسلت بطاقة الهدية ${g.ref}` : `Gift card ${g.ref} is on its way`) : (ar ? `وصلنا طلب بطاقة الهدية ${g.ref}` : `We have your gift card order ${g.ref}`);
  const who = g.to_email ? (ar ? `إلى ${esc(g.to_name)} (${esc(g.to_email)})` : `to ${esc(g.to_name)} (${esc(g.to_email)})`) : (ar ? 'إليك لتعطيه بنفسك' : 'to you, to pass on');
  const pay = paid ? (ar ? `دُفعت، وأرسلنا الرمز ${who}.` : `It's paid, and we have emailed the code ${who}.`)
    : g.payment === 'e-transfer' ? (ar ? `أرسل ${dollars(g.amount_cents)} بتحويل Interac إلى ${esc(env('ETRANSFER_EMAIL') || 'orders@hikayacoffee.ca')} واكتب ${g.ref} في الرسالة. نرسل الرمز ${who} حين يصلنا المبلغ.` : `Send ${dollars(g.amount_cents)} by Interac e-Transfer to ${esc(env('ETRANSFER_EMAIL') || 'orders@hikayacoffee.ca')} with ${g.ref} in the message. We email the code ${who} as soon as it arrives.`)
    : (ar ? `أكمل الدفع بالبطاقة، ونرسل الرمز ${who} فوراً.` : `Finish paying by card and we email the code ${who} straight away.`);
  const body = `<p>${pay}</p>${!paid && g.square_link_url ? btn(g.square_link_url, ar ? 'ادفع الآن' : 'Pay now') : ''}<p style="color:#66503F;font-size:14px">${g.ref} · ${dollars(g.amount_cents)}</p>`;
  return { to: g.buyer_email, subject: s, html: layout(L, ar ? 'بطاقة هدية' : 'Gift card', body, siteUrl), text: `${s}\n\n${pay.replace(/<[^>]+>/g, '')}`, kind: paid ? 'gift-card-sent' : 'gift-card-received' };
}

// ---------- regular orders ----------
export function subscriptionEmail(kind: 'started' | 'skipped' | 'not-placed' | 'stopped', to: string, lang: Lang, d: { every: number; next: string | null; why?: string }, siteUrl: string): Mail {
  const ar = lang === 'ar';
  const next = d.next ? day(d.next, lang) : '';
  const T = {
    started: ar ? { s: 'بدأ طلبك المنتظم', p: `سنجهّز الطلب نفسه كل ${d.every === 2 ? 'أسبوعين' : '٤ أسابيع'}، ونرسل لك تأكيداً قبل كل موعد بأسبوع. المرة القادمة: ${next}.` } : { s: 'Your regular order is set', p: `We'll prepare the same order every ${d.every} weeks and email you a week before each one. Next: ${next}.` },
    skipped: ar ? { s: 'تخطّينا المرة القادمة', p: `لن نجهّز الطلب هذه المرة. الموعد التالي: ${next}.` } : { s: 'We skipped the next one', p: `No order this time. The next one is ${next}.` },
    'not-placed': ar ? { s: 'لم نستطع تجهيز طلبك المنتظم هذه المرة', p: `${esc(d.why ?? '')} الموعد التالي: ${next}. ردّ على هذه الرسالة إن أردت شيئاً آخر.` } : { s: "We couldn't place your regular order this time", p: `${esc(d.why ?? '')} The next one is ${next}. Reply to this email if you'd like something else instead.` },
    stopped: ar ? { s: 'أوقفنا طلبك المنتظم', p: 'لن نجهّز طلبات أخرى. تستطيع البدء من جديد عند أي طلب.' } : { s: 'Your regular order is stopped', p: 'No more orders will be made. You can start again with any order.' },
  }[kind];
  const body = `<p>${T.p}</p>${btn(`${siteUrl}/${lang}/account/`, ar ? 'إدارة طلبك المنتظم' : 'Manage it in your account')}`;
  return { to, subject: T.s, html: layout(lang, T.s, body, siteUrl), text: `${T.s}\n\n${T.p.replace(/<[^>]+>/g, '')}\n\n${siteUrl}/${lang}/account/`, kind: `subscription-${kind}` };
}

// ---------- monthly report (to the owners) ----------
export function monthlyReportEmails(month: string, html: string, text: string): Mail[] {
  return env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean)
    .map((to: string) => ({ to, subject: `Hikaya: your month in numbers (${month})`, html: `<div style="font:15px/1.55 Arial,sans-serif;color:#33211A;max-width:620px">${html}</div>`, text, kind: 'monthly-report' }));
}
