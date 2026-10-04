// When Ask Hikaya cannot reach the model (credits used up, key removed, outage), the chat keeps
// answering the questions that matter most from this list, points everything else to the help
// form, and the team gets one email about it (at most every six hours).
import { one, sql } from './db';
import { env, siteUrl } from './http';
import { send } from './email';

type L = { en: string; ar: string };
type Entry = { keys: RegExp; answer: L };

const ENTRIES: Entry[] = [
  { keys: /damag|broken|crush|spoil|wrong item|missing|leak|torn|تالف|مكسور|خطأ|ناقص|فاسد|منسكب|ممزق/i, answer: {
    en: "I'm sorry. Please send it to the team with the help form at /en/help/ (choose \"Something arrived damaged\" and add a photo of the item and packaging). Report it within 48 hours of pickup or delivery, and keep the item until we reply. The team replies by email, usually within a day.",
    ar: 'نأسف لذلك. أرسل التفاصيل إلى الفريق من نموذج المساعدة في /ar/help/ (اختر "وصل شيء تالفاً" وأضف صورة للمنتج والتغليف). أخبرنا خلال ٤٨ ساعة من الاستلام أو التوصيل، واحتفظ بالمنتج حتى نرد. يرد الفريق بالبريد خلال يوم عادةً.' } },
  // Before the tracking and delivery entries: a late or missing delivery is urgent, not a question about the area.
  { keys: /did ?n[o']?t arrive|didn.t arrive|has ?n[o']?t arrived|never (came|arrived)|not arrived|(delivery|order|driver)\b.{0,20}\blate\b|لم يصل|ما وصل|تأخر|متأخر/i, answer: {
    en: 'Please send it to the team straight away with the help form at /en/help/ (choose "My delivery did not arrive"), and they will look into it first. You can follow your order with the link in your confirmation email.',
    ar: 'أرسل ذلك إلى الفريق فوراً من نموذج المساعدة في /ar/help/ (اختر "لم يصل التوصيل")، وسيتابعونه أولاً. وتتابع طلبك من الرابط في بريد التأكيد.' } },
  { keys: /where is my order|order status|track|my order|cancel|change my order|طلبي|أين الطلب|إلغاء|تغيير/i, answer: {
    en: 'You can follow your order with the link in your confirmation email, or log in at /en/account/ with the email you ordered with. To change or cancel an order, use the help form at /en/help/.',
    ar: 'تتابع طلبك من الرابط في بريد التأكيد، أو بتسجيل الدخول في /ar/account/ بالبريد الذي طلبت به. ولتغيير الطلب أو إلغائه استخدم نموذج المساعدة في /ar/help/.' } },
  { keys: /deliver|postal|shipping|ship|توصيل|توصل|يوصل|نوصل|الرمز البريدي|شحن/i, answer: {
    en: 'We deliver ourselves in Calgary only (Calgary postal codes, not nearby towns). Delivery is $9, free on orders of $80 or more. Pickup is free. We do not ship outside Calgary yet.',
    ar: 'نوصل بأنفسنا داخل كالغاري فقط (الرموز البريدية لكالغاري، لا المدن المجاورة). التوصيل ٩ $، ومجاني للطلبات من ٨٠ $. الاستلام مجاني. لا نشحن خارج كالغاري بعد.' } },
  { keys: /pickup|pick up|hours|open|address|when|استلام|مواعيد|العنوان|متى/i, answer: {
    en: 'Pickup and delivery run Thursday to Sunday, in three windows: 11:00–14:00, 14:00–17:00 and 17:00–20:00. The checkout shows the days still open and the order-by time. The pickup address comes in your confirmation email.',
    ar: 'الاستلام والتوصيل من الخميس إلى الأحد في ثلاث فترات: ١١–٢، ٢–٥، ٥–٨. صفحة الطلب تعرض الأيام المتاحة وآخر موعد للطلب. وعنوان الاستلام يصلك في بريد التأكيد.' } },
  { keys: /refund|return|money back|استرجاع|إرجاع|استرداد/i, answer: {
    en: "Coffee and dates are food, so we can't take them back once they leave us. If something arrives damaged or wrong, tell us within 48 hours with the help form at /en/help/ and we'll replace it or refund you.",
    ar: 'القهوة والتمر طعام، فلا نستطيع استرجاعهما بعد الاستلام. إن وصل شيء تالفاً أو خاطئاً أخبرنا خلال ٤٨ ساعة من نموذج المساعدة في /ar/help/ ونستبدله أو نعيد المبلغ.' } },
  { keys: /brew|make|recipe|dallah|rakweh|تحضير|طريقة|دلة|ركوة/i, answer: {
    en: 'Every coffee has its brewing steps on /en/brew/, with amounts and times.',
    ar: 'طريقة تحضير كل قهوة في /ar/brew/ بالمقادير والأوقات.' } },
  { keys: /ramadan|eid|iftar|رمضان|العيد|إفطار/i, answer: {
    en: 'Ramadan orders arrive before sunset (choose an earlier window to be safe); Eid orders before Eid morning. See /en/ramadan/ and /en/eid/.',
    ar: 'طلبات رمضان تصل قبل الغروب (اختر فترة مبكرة للاطمئنان)، وطلبات العيد قبل صباح العيد. انظر /ar/ramadan/ و /ar/eid/.' } },
  { keys: /price|cost|how much|coffee|dates|shop|buy|سعر|كم|قهوة|تمر|شراء/i, answer: {
    en: 'All our coffees and dates, with prices, are on /en/shop/.',
    ar: 'كل القهوة والتمر بالأسعار في /ar/shop/.' } },
];

const NOTE: L = {
  en: 'Our assistant is taking a short break, so this is a quick answer.',
  ar: 'مساعدنا في استراحة قصيرة، فهذه إجابة سريعة.',
};
const OTHER: L = {
  en: 'For anything else, send your question with the help form at /en/help/ and the team will reply by email.',
  ar: 'ولأي شيء آخر أرسل سؤالك من نموذج المساعدة في /ar/help/ وسيرد عليك الفريق بالبريد.',
};

export function offlineAnswer(text: string, lang: 'en' | 'ar') {
  const hit = ENTRIES.find(e => e.keys.test(text));
  return [NOTE[lang], hit?.answer[lang], OTHER[lang]].filter(Boolean).join('\n\n');
}

export type Down = 'credits' | 'key' | 'rate-limit' | 'bad-request' | 'outage';
export function classify(e: any): Down {
  const status = e?.status ?? e?.response?.status;
  const msg = String(e?.error?.error?.message ?? e?.message ?? '').toLowerCase();
  if (msg.includes('credit') || msg.includes('billing') || status === 402) return 'credits';
  if (status === 401 || status === 403) return 'key';
  if (status === 429) return 'rate-limit';
  if (status === 400) return 'bad-request';
  return 'outage';
}

const WHY: Record<Down, string> = {
  credits: 'The Anthropic account is out of credit. Add credit at console.anthropic.com → Plans & Billing.',
  key: 'The ANTHROPIC_API_KEY in Netlify is missing, wrong or was revoked. Create a new key and update it in Netlify, then redeploy.',
  'rate-limit': 'Too many messages at once for the Anthropic account’s limits. It usually clears by itself; if it keeps happening, raise the limit in the Anthropic console.',
  'bad-request': 'Anthropic refused this one conversation as malformed. The service itself is working; if it keeps happening, tell the website developer.',
  outage: 'Anthropic’s service did not answer. This usually clears by itself within minutes.',
};

export type AskStatus = { ok: boolean; reason?: Down; detail?: string; since?: string; alertedAt?: string; alertedReason?: Down; lastOk?: string };

export async function askStatus(): Promise<AskStatus> {
  const r = await one`SELECT value FROM settings WHERE key = 'ask_status'`;
  return r ? (typeof r.value === 'string' ? JSON.parse(r.value) : r.value) : { ok: true };
}
// Merges into the stored record, so the last alert (alertedAt, alertedReason) survives a recovery.
const save = (v: Partial<AskStatus>) => sql`INSERT INTO settings (key, value) VALUES ('ask_status', ${JSON.stringify(v)}::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value`;

export async function markOk() {
  const cur = await askStatus();
  if (!cur.ok || !cur.lastOk || Date.now() - Date.parse(cur.lastOk) > 3600_000) await save({ ok: true, lastOk: new Date().toISOString() });
}

/** Records the problem and emails the team, at most once every six hours. */
export async function markDown(reason: Down, detail: string, req?: Request) {
  const cur = await askStatus();
  const now = new Date().toISOString();
  await save({ ok: false, reason, detail: detail.slice(0, 300), since: cur.ok ? now : cur.since ?? now });
  // Claim the alert in one statement, so failures at the same moment send one email between them.
  const claimed = await one`UPDATE settings SET value = value || jsonb_build_object('alertedAt', ${now}::text, 'alertedReason', ${reason}::text)
    WHERE key = 'ask_status' AND (value->>'alertedAt' IS NULL OR (value->>'alertedAt')::timestamptz < NOW() - INTERVAL '6 hours'
      OR COALESCE(value->>'alertedReason', value->>'reason') IS DISTINCT FROM ${reason}::text) RETURNING 1`;
  if (!claimed) return;
  const text = `Ask Hikaya can't reach the AI right now, so customers are getting short built-in answers and the help form.\n\nWhy: ${WHY[reason]}\n\nDetail: ${detail.slice(0, 300)}\n\nThe chat recovers by itself once this is fixed. Status: ${siteUrl(req)}/admin/ → Customers → Ask Hikaya answers.`;
  for (const to of env('ADMIN_EMAILS').split(',').map((e: string) => e.trim()).filter(Boolean)) {
    await send({ to, subject: `⚠ Ask Hikaya is on backup answers (${reason})`, text, html: `<pre style="font:15px/1.5 Arial,sans-serif;white-space:pre-wrap">${text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))}</pre>`, kind: 'team-ask-down' });
  }
}
