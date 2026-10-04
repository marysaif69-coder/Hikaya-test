// Sample orders: made-up orders spread over five weeks (two past, this one, two ahead) so the
// team can try the desk. They are marked SAMPLE, never email anyone, don't use up time slots or
// stock, are left out of the CSV export, and one button removes them all. A real order ticked
// "sample" afterwards (the rehearsal) is left out of the numbers too, but that button keeps it.
import { randomInt } from 'node:crypto';
import { sql, one } from './db';
import { hash, token } from './auth';
import { calgaryNow, addDays, weekday, WINDOWS } from './slots';
import { PRODUCTS, DATES, GRINDS, fileCents } from '../../src/data/products';
import { calgaryPostal, SAMPLE_CENTS } from './orders';

const PEOPLE: [string, 'en' | 'ar'][] = [
  ['Layla Haddad', 'ar'], ['Omar Saleh', 'ar'], ['Noor Al-Amin', 'ar'], ['Yousef Karim', 'ar'], ['Huda Mansour', 'ar'], ['Rania Khatib', 'ar'],
  ['Sami Darwish', 'ar'], ['Mariam Qasim', 'ar'], ['Emily Chen', 'en'], ['Daniel Brooks', 'en'], ['Priya Nair', 'en'], ['Sarah Thompson', 'en'],
  ['Jordan Lee', 'en'], ['Fatima Yusuf', 'en'], ['Lucas Martin', 'en'], ['Aisha Rahman', 'en'],
];
const STREETS = ['14 Sage Hill Dr NW', '220 Mahogany Blvd SE', '88 Cranston Ave SE', '1510 Kensington Rd NW', '45 Evanston Way NW', '732 Tuscany Springs Blvd NW', '19 Auburn Bay Sq SE', '300 Saddletowne Cir NE', '61 Royal Oak Pt NW', '1202 17 Ave SW'];
const POSTALS = ['T3R 0Z6', 'T3M 2G1', 'T3M 1J8', 'T2N 1V9', 'T3P 0L4', 'T3L 3A2', 'T3M 0X1', 'T3J 0N3', 'T3G 5W1', 'T2T 0B5'];
const NOTES = [null, null, null, 'Gift: please add a card saying Eid Mubarak', 'Please call when outside', 'Side door, ring twice', null, 'For my mother, she prefers less sweet dates'];
const pick = <T>(a: T[]) => a[randomInt(a.length)];

export async function createSamples(actor: string) {
  const today = calgaryNow().date;
  const thisThu = addDays(today, -((weekday(today) - 4 + 7) % 7));
  let made = 0;
  for (let w = -2; w <= 2; w++) {
    for (let d = 0; d < 4; d++) {
      const date = addDays(thisThu, w * 7 + d);
      const count = 1 + randomInt(3);
      for (let i = 0; i < count; i++) {
        const [name, lang] = pick(PEOPLE);
        const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.sample@example.com`;
        const method = randomInt(10) < 4 ? 'delivery' : 'pickup';
        const k = randomInt(STREETS.length);
        const lines = Array.from({ length: 1 + randomInt(3) }, () => {
          const p = pick(PRODUCTS);
          const base = p.kind === 'kit' ? PRODUCTS.find(x => x.id === p.base) : p;
          const opt = base?.kind === 'coffee' ? base.grinds[0] ?? null : p.kind === 'box' && p.chooseDate ? pick(Object.keys(DATES)) : null;
          const label = base?.kind === 'coffee' && opt ? GRINDS[opt as keyof typeof GRINDS] : opt ? DATES[opt as keyof typeof DATES].name : null;
          // Prices not set yet: samples use a stand-in so the desk has numbers to show.
          return { id: p.id, en: p.name.en, ar: p.name.ar, opt, label, qty: 1 + (randomInt(4) === 0 ? 1 : 0), cents: fileCents(p) ?? SAMPLE_CENTS };
        });
        const sub = lines.reduce((n, l) => n + l.cents * l.qty, 0);
        const discount = randomInt(8) === 0 ? Math.round(sub * 0.1) : 0;
        const fee = method === 'delivery' && sub < 8000 ? 900 : 0;
        const past = date < today;
        const status = past ? (randomInt(10) === 0 ? 'cancelled' : 'completed') : date === today ? pick(['confirmed', method === 'pickup' ? 'ready' : 'out-for-delivery']) : w === 0 ? 'confirmed' : pick(['received', 'received', 'confirmed']);
        const payment = pick(['e-transfer', 'at-pickup', 'card']);
        // Like real life: card is paid when ordering; e-Transfer usually arrives after we confirm
        // (a few are still outstanding); pay-at-pickup is paid only when collected.
        const paid = status === 'cancelled' ? false
          : payment === 'card' ? true
          : payment === 'e-transfer' ? status === 'completed' || (status !== 'received' && randomInt(4) > 0)
          : status === 'completed';
        const phone = `403-555-01${10 + randomInt(89)}`;
        const c = await one`INSERT INTO customers (email, name, phone, lang) VALUES (${email}, ${name}, ${phone}, ${lang})
          ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
        const o = await one`INSERT INTO orders (ref, customer_id, email, name, phone, lang, method, street, postal, slot_date, slot_window, payment, payment_status, status,
            subtotal_cents, delivery_cents, discount_cents, total_cents, paid_cents, promo_code, notes, guest_token_hash, is_sample, created_as_sample)
          VALUES (${'HK-S' + Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[randomInt(31)]).join('')}, ${c!.id}, ${email}, ${name}, ${phone}, ${lang}, ${method},
            ${method === 'delivery' ? STREETS[k] : null}, ${method === 'delivery' ? calgaryPostal(POSTALS[k]) : null}, ${date}, ${pick([...WINDOWS])}, ${payment},
            ${paid ? 'paid' : 'unpaid'}, ${status}, ${sub}, ${fee}, ${discount}, ${sub - discount + fee}, ${paid ? sub - discount + fee : 0}, ${discount ? 'SAMPLE10' : null}, ${pick(NOTES)}, ${hash(token())}, TRUE, TRUE)
          RETURNING id`;
        for (const l of lines) await sql`INSERT INTO order_items (order_id, product_id, name_en, name_ar, option, option_en, option_ar, qty, unit_cents)
          VALUES (${o!.id}, ${l.id}, ${l.en}, ${l.ar}, ${l.opt}, ${l.label?.en ?? null}, ${l.label?.ar ?? null}, ${l.qty}, ${l.cents})`;
        await sql`INSERT INTO order_events (order_id, kind, detail, actor) VALUES (${o!.id}, 'created', 'Sample order', ${actor})`;
        made++;
      }
    }
  }
  return { made, from: addDays(thisThu, -14), to: addDays(thisThu, 17) };
}

export async function removeSamples() {
  // Only orders made as samples. A real order ticked "sample" later (the rehearsal) stays, with its
  // refunds and history, and is still left out of the numbers.
  const r = await one`WITH d AS (DELETE FROM orders WHERE created_as_sample RETURNING 1) SELECT COUNT(*)::int AS n FROM d`;
  await sql`DELETE FROM customers c WHERE c.email LIKE '%.sample@example.com' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)`;
  return { removed: r?.n ?? 0 };
}
