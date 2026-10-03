// Gift cards: bought on /en/gift-card/, paid by card (Square) or e-Transfer. Once paid, the code
// is emailed to the person receiving it. The code works at checkout like money: it pays part or
// all of an order, and what is left stays on the card. A cancelled order puts the money back.
import { sql, one, type Row } from './db';
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
    } catch (e: any) { if (!String(e?.message).includes('unique')) throw e; }
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

/** Marks a gift card paid and emails the code (once). From the Square webhook or the desk. */
export async function giftCardPaid(ref: string, req?: Request, paymentId: string | null = null) {
  const g = await one`UPDATE gift_cards SET paid_at = COALESCE(paid_at, NOW()), square_payment_id = COALESCE(${paymentId}, square_payment_id) WHERE ref = ${ref} AND cancelled_at IS NULL RETURNING *`;
  if (!g) throw new HttpError(404, 'not-found');
  if (!g.sent_at) {
    await send(giftCardEmail(mail(g), siteUrl(req)));
    await send(giftCardReceipt(mail(g), true, siteUrl(req)));
    await sql`UPDATE gift_cards SET sent_at = NOW() WHERE id = ${g.id}`;
  }
  return g;
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

export const listGiftCards = () => sql`SELECT ref, code, amount_cents, balance_cents, buyer_name, buyer_email, to_name, to_email, payment, paid_at, sent_at, cancelled_at, created_at
  FROM gift_cards ORDER BY created_at DESC LIMIT 200`;
