// Gift cards: bought on /en/gift-card/, paid by card (Square) or e-Transfer. Once paid, the code
// is emailed to the person receiving it. The code works at checkout like money: it pays part or
// all of an order, and what is left stays on the card. A cancelled order puts the money back.
import { sql, one, type Row, isUniqueViolation } from './db';
import { HttpError, str, isEmail, siteUrl } from './http';
import { randomCode } from './promos';
import { send, giftCardEmail, giftCardReceipt } from './email';
import { cardEnabled, amountLink } from './square';
import { dollars } from './pricing';

export const AMOUNTS = [2500, 5000, 7500, 10000];
export const normGift = (v: unknown) => str(v, 32).toUpperCase().replace(/[^A-Z0-9-]/g, '');

const mail = (g: Row) => ({ ...g, lang: g.lang === 'ar' ? 'ar' : 'en' }) as any;

export async function buyGiftCard(b: any, req: Request) {
  const lang = b?.lang === 'ar' ? 'ar' : 'en';
  const amount = Math.round(Number(b?.amount_cents));
  const buyer_name = str(b?.buyer_name, 120), buyer_email = str(b?.buyer_email, 254).toLowerCase();
  const to_name = str(b?.to_name, 120), to_email = str(b?.to_email, 254).toLowerCase() || null, message = str(b?.message, 300) || null;
  const payment = b?.payment === 'card' ? 'card' : 'e-transfer';
  const fields: Record<string, string> = {};
  if (!AMOUNTS.includes(amount)) fields.amount = 'amount';
  if (!buyer_name) fields.buyer_name = 'required';
  if (!isEmail(buyer_email)) fields.buyer_email = 'email';
  if (!to_name) fields.to_name = 'required';
  if (to_email && !isEmail(to_email)) fields.to_email = 'email';
  if (payment === 'card' && !cardEnabled()) fields.payment = 'card-off';
  if (Object.keys(fields).length) throw Object.assign(new HttpError(400, 'invalid', 'Check the highlighted fields.'), { fields });
  let g: Row | null = null;
  for (let i = 0; i < 5 && !g; i++) {
    try {
      g = await one`INSERT INTO gift_cards (ref, code, amount_cents, balance_cents, buyer_name, buyer_email, to_name, to_email, message, lang, payment)
        VALUES (${randomCode('GC')}, ${randomCode('GIFT')}, ${amount}, ${amount}, ${buyer_name}, ${buyer_email}, ${to_name}, ${to_email}, ${message}, ${lang}, ${payment}) RETURNING *`;
    } catch (e: any) { if (!isUniqueViolation(e)) throw e; }
  }
  if (!g) throw new HttpError(500, 'ref');
  let payUrl: string | null = null;
  if (payment === 'card') {
    const link = await amountLink(g.ref, `Hikaya gift card ${dollars(amount)}`, amount, buyer_email, `${siteUrl(req)}/${lang}/thanks/?giftcard=${g.ref}`);
    await sql`UPDATE gift_cards SET square_order_id = ${link.orderId}, square_link_url = ${link.url} WHERE id = ${g.id}`;
    payUrl = link.url; g.square_link_url = link.url;
  }
  await send(giftCardReceipt(mail(g), false, siteUrl(req)));
  return { ref: g.ref as string, payUrl };
}

/** Marks a gift card paid and emails the code. From the Square webhook or the desk. The card counts
 * as sent only once the code email went out; calling it again retries the email until then. The
 * buyer's "it's on its way" receipt goes with the first code email that goes out. */
export async function giftCardPaid(ref: string, req?: Request, paymentId: string | null = null) {
  const g = await one`UPDATE gift_cards SET paid_at = COALESCE(paid_at, NOW()), square_payment_id = COALESCE(${paymentId}, square_payment_id) WHERE ref = ${ref} AND cancelled_at IS NULL RETURNING *`;
  if (!g) throw new HttpError(404, 'not-found');
  let emailStatus = 'sent';
  if (!g.sent_at) {
    emailStatus = await send(giftCardEmail(mail(g), siteUrl(req)));
    if (emailStatus === 'sent') {
      await sql`UPDATE gift_cards SET sent_at = NOW() WHERE id = ${g.id}`;
      await send(giftCardReceipt(mail(g), true, siteUrl(req)));
    }
  }
  return { ...g, emailStatus };
}

/** A gift card sold in person (market, pop-up, at the door): paid on the spot by cash, card on the
 * Square reader or e-Transfer. Any amount from $5 to $500. The code is emailed when there is an
 * address, and the desk shows it to print or write on a card either way. */
export async function sellGiftCardHere(b: any, by: string, req?: Request) {
  const amount = Math.round(Number(b?.amount_cents));
  const lang = b?.lang === 'ar' ? 'ar' : 'en';
  const payment = ({ cash: 'cash', card: 'card-here', 'card-here': 'card-here', 'e-transfer': 'e-transfer' } as Record<string, string>)[String(b?.payment)];
  const to_name = str(b?.to_name, 120) || (lang === 'ar' ? 'صاحب البطاقة' : 'Card holder');
  const buyer_name = str(b?.buyer_name, 120) || (lang === 'ar' ? 'شراء مباشر' : 'In person');
  const buyer_email = str(b?.buyer_email, 254).toLowerCase(), to_email = str(b?.to_email, 254).toLowerCase() || null;
  const message = str(b?.message, 300) || null;
  const fields: Record<string, string> = {};
  if (!Number.isInteger(amount) || amount < 500 || amount > 50000) fields.amount = 'amount';
  if (!payment) fields.payment = 'payment';
  if (buyer_email && !isEmail(buyer_email)) fields.buyer_email = 'email';
  if (to_email && !isEmail(to_email)) fields.to_email = 'email';
  if (to_email && !str(b?.buyer_name, 120)) fields.buyer_name = 'required';
  if (Object.keys(fields).length) throw Object.assign(new HttpError(400, 'invalid', 'Amount from $5 to $500, how it was paid, and emails that look right. When it is emailed to someone else, add who it is from.'), { fields });
  let g: Row | null = null;
  for (let i = 0; i < 5 && !g; i++) {
    try {
      g = await one`INSERT INTO gift_cards (ref, code, amount_cents, balance_cents, buyer_name, buyer_email, to_name, to_email, message, lang, payment, paid_at, sold_by)
        VALUES (${randomCode('GC')}, ${randomCode('GIFT')}, ${amount}, ${amount}, ${buyer_name}, ${buyer_email}, ${to_name}, ${to_email}, ${message}, ${lang}, ${payment}, NOW(), ${by}) RETURNING *`;
    } catch (e: any) { if (!isUniqueViolation(e)) throw e; }
  }
  if (!g) throw new HttpError(500, 'ref');
  const sentTo = g.to_email || g.buyer_email || null;
  let emailStatus: string | null = null;
  if (sentTo) {
    emailStatus = await send(giftCardEmail(mail(g), siteUrl(req)));
    if (emailStatus === 'sent') await sql`UPDATE gift_cards SET sent_at = NOW() WHERE id = ${g.id}`;
  }
  return { ref: g.ref as string, code: g.code as string, amount_cents: amount, to_name, message, sentTo, emailStatus };
}

/** Balance check at checkout. Never says whether an unpaid card exists. */
export async function giftCardBalance(raw: unknown) {
  const code = normGift(raw);
  const g = code ? await one`SELECT code, balance_cents FROM gift_cards WHERE code = ${code} AND paid_at IS NOT NULL AND cancelled_at IS NULL` : null;
  if (!g) throw new HttpError(400, 'giftcard', 'That gift card code is not valid.');
  if (g.balance_cents <= 0) throw new HttpError(400, 'giftcard', 'That gift card has been used up.');
  return { code: g.code as string, balance: g.balance_cents as number };
}

/** Takes up to `want` cents from the card. The update only succeeds if the balance still covers
 * it, so two orders at once can never spend the same money twice. Returns the cents taken. */
export async function takeFromGiftCard(code: string, want: number) {
  for (let i = 0; i < 3; i++) {
    const { balance } = await giftCardBalance(code);
    const take = Math.min(balance, want);
    if (take <= 0) return 0;
    const r = await one`UPDATE gift_cards SET balance_cents = balance_cents - ${take} WHERE code = ${code} AND balance_cents >= ${take} AND paid_at IS NOT NULL AND cancelled_at IS NULL RETURNING id`;
    if (r) return take;
  }
  throw new HttpError(409, 'giftcard', 'That gift card was just used. Try again.');
}
export async function giveBackToGiftCard(code: string | null, cents: number) {
  if (code && cents > 0) await sql`UPDATE gift_cards SET balance_cents = LEAST(amount_cents, balance_cents + ${cents}) WHERE code = ${code}`;
}

export const listGiftCards = () => sql`SELECT ref, code, amount_cents, balance_cents, buyer_name, buyer_email, to_name, to_email, payment, paid_at, sent_at, cancelled_at, sold_by, created_at
  FROM gift_cards ORDER BY created_at DESC LIMIT 200`;
