// Text-message reminders through Twilio, for customers who ticked "Text me a reminder".
// Off until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set in Netlify.
import { env } from './http';

export const smsEnabled = () => Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_FROM'));

/** Canadian numbers to +1XXXXXXXXXX; anything else that already starts with + is kept. */
export function e164(phone: string) {
  const raw = String(phone ?? '').trim(), d = raw.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (raw.startsWith('+') && d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

export async function sendSms(to: string, text: string) {
  const num = e164(to);
  if (!smsEnabled()) return 'skipped';
  if (!num) return 'bad-number';
  const sid = env('TWILIO_ACCOUNT_SID');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${sid}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: num, From: env('TWILIO_FROM'), Body: text }).toString(),
  }).catch(() => null);
  return r?.ok ? 'sent' : 'failed';
}

export function reminderText(o: { ref: string; lang: string; method: string; slot_window: string }) {
  return o.lang === 'ar'
    ? `حكاية: تذكير بطلبك ${o.ref} غداً، ${o.method === 'pickup' ? 'الاستلام' : 'التوصيل'} بين ${o.slot_window}. للمساعدة ردّ على رسالة التأكيد بالبريد.`
    : `Hikaya: reminder, order ${o.ref} is tomorrow, ${o.method === 'pickup' ? 'pickup' : 'delivery'} ${o.slot_window}. Questions? Reply to your confirmation email.`;
}
