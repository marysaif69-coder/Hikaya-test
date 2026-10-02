# Hikaya: what a finished shop needs, and what is left

What small food businesses selling pre-orders online actually run on, checked against what the
Hikaya site already does. ✅ built · 🟡 partly / needs you · ⬜ not built yet.
Written 2 October 2026.

## 1. Selling

| | What it is | Status |
|---|---|---|
| ✅ | Shop in Arabic and English, product pages, cart, checkout as guest or with an account | Built |
| ✅ | Pickup and delivery days with limited places per time window | Built |
| ✅ | Order-by deadline: the evening before, or weekly ("order by Tuesday 8 pm for Thursday–Sunday") | Admin → Settings |
| ✅ | Closed days (Eid day, holidays) and the first day orders open | Admin → Settings |
| ✅ | Change prices, hide products, mark sold out, limit stock | Admin → Products |
| ✅ | Ramadan and Eid switch on/off: pages, menu, banner and boxes | Admin → Products (top) |
| ✅ | Promo codes: % off, $ off, free delivery; dates, minimum, uses, once per customer | Admin → Promotions |
| ✅ | Refunds: full or partial, card, e-Transfer, cash or store credit | Admin → order → Refund |
| 🟡 | Card payment online | Built for Square; turns on when you add the Square keys (section 4) |
| ⬜ | Gift cards you can sell | Not built. Store-credit codes already work as a simple version |
| ⬜ | "Tell me when it's back" for sold-out products | Not built; worth adding before Ramadan |
| ⬜ | Subscriptions (a coffee every month) | Not built; only after launch, if customers ask |

## 2. Running the orders

| | What it is | Status |
|---|---|---|
| ✅ | Order desk: search, filter, status steps, paid/unpaid, notes, history, emails sent | Admin → Orders |
| ✅ | Day sheet: what to pack, pickups by window, deliveries sorted by area with map links, printable | Admin → Day sheet |
| ✅ | Sample orders over five weeks to practise on; one click removes them | Admin → Orders |
| ✅ | CSV export for the accountant | Admin → Orders |
| ⬜ | **Weekly roast and pack sheet**: total kg of each coffee to roast and grind, dates to portion, boxes and sleeves to prepare for the coming week | Not built. Highest-value next step for pre-orders: it is what you hand the roaster |
| ⬜ | Driver view on a phone (today's deliveries in order, tap to call, "delivered") | Not built; the day sheet works on a phone meanwhile |
| ⬜ | Team roles (e.g. a helper who can pack and mark ready but not refund) | Not built; everyone on ADMIN_EMAILS can do everything |

## 3. Customers and support

| | What it is | Status |
|---|---|---|
| ✅ | Emails at every step, in the customer's language; reminder the evening before | Built |
| ✅ | Ask Hikaya: answers, order lookup, delivery check, add to cart, damage reports with photos | Built; 37/40 on the first test |
| ✅ | Team answers you write in the desk, used straight away | Admin → Assistant |
| ✅ | Backup answers and an email to you if the AI runs out of credit | Built |
| ✅ | Help form and Inbox with photos, replies by email, outcomes | Built |
| ⬜ | Ask for a Google review a few days after an order is completed | Not built; easy to add once the Google Business Profile exists |
| 🟡 | Mailing list | Collected with Netlify Forms. Needs a CASL consent line and a tool to send from (section 6) |

## 4. Payments: Square or Shopify?

**Recommendation: Square, connected to this site. Not Shopify.**

The site already does what Shopify would sell you: the shop, checkout, accounts, order desk,
emails, promo codes and refunds. Shopify would mean paying monthly to rebuild all of that inside
Shopify's templates, in a weaker Arabic layout, and moving the order desk there.

| | Square (with this site) | Shopify Basic |
|---|---|---|
| Monthly fee | $0 | about $51/month on a yearly plan, $68 monthly |
| Online card payment | 2.8% + 30¢ | 2.9% + 30¢ (with Shopify Payments) |
| In person at pickup | Square Reader: 2.5% credit, Interac debit 0.75% + 7¢ | Needs Shopify POS hardware and plan |
| On a $54 Iftar Pair | $1.81 | $1.87 + the monthly fee |
| Works with what's built | Yes: payment link at checkout, automatic "paid", refunds from the desk | Would replace the site's checkout |

Square also gives you a card reader for pickup that puts in-person and online money in one
account, and it connects to QuickBooks. Keep Interac e-Transfer as an option: it costs you
nothing.

**To switch it on** (about 30 minutes): create a Square account → Developer dashboard → an
application → copy the *production* access token and location ID → in Netlify add
`SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENV=production`, then add the webhook
`<site>/api/square/webhook` for `payment.updated` and put its signature key in
`SQUARE_WEBHOOK_SIGNATURE_KEY`. Redeploy. Test with a $1 product first.

Fees from Square Canada (squareup.com/ca/en/payments/our-fees, checked 2 October 2026) and
published Shopify Canada pricing for 2026. Cards issued outside Canada cost about 1.5% more on Square.

## 5. Things businesses like Hikaya are legally expected to have (confirm with the right office)

These are not website features, but the website depends on them. We are not lawyers or
inspectors; treat this as a checklist to confirm.

- **Food safety:** an Alberta Health Services food handling permit for where coffee is ground and
  dates are portioned, and a food safety course for whoever handles food.
- **Importing dates:** if Hikaya imports the dates itself, the CFIA expects a Safe Food for
  Canadians licence. Buying from a Canadian importer avoids that.
- **Labels:** English and French, ingredients and allergens (Baydani: sesame), net quantity, a
  best-before date and a lot code so a batch can be traced. Whether spiced coffee and dates need a
  Nutrition Facts table depends on exemptions; check with the CFIA.
- **City of Calgary business licence** (home-based or commercial, depending on where you work).
- **GST:** coffee and dates are usually zero-rated basic groceries; gift boxes with non-food items
  can change that. The site says "GST pending" until your accountant confirms.
- **Product liability insurance** before selling.
- **Privacy (PIPEDA):** the site has a privacy line; keep it true (we don't sell data, no
  tracking cookies).
- **Marketing emails (CASL):** only email people who ticked "yes, send me news", always with an
  unsubscribe link.

## 6. After launch

- Google Business Profile with the pickup address and hours (most "near me" searches start there).
- Privacy-friendly visit numbers (Netlify Analytics or Plausible; no cookie banner needed).
- A free uptime check (e.g. UptimeRobot) emailing you if the site goes down.
- A mailing tool for the three yearly letters (Mailchimp, Buttondown or Resend Broadcasts), with
  the CASL consent checkbox added to the footer form.
- Monthly: CSV export to the accountant; read Ask Hikaya's conversations weekly.

## 7. Editing words, recipes and products

- **Prices, what's shown, sold out, stock, seasons, promo codes, deadlines:** in the admin desk,
  live in a minute.
- **Assistant answers:** Admin → Assistant, live immediately.
- **Text, recipes (brew guides), product descriptions, photos, new products:** these live in the
  site's files (`src/data/products.ts`, `src/data/brew.ts`, the pages). Today: tell Claude in a
  session what to change; it edits, tests and deploys in a few minutes.
- **Later, if you want to edit text yourself:** add a content editor (Sveltia CMS or Decap CMS)
  that edits those files through a web form and publishes through GitHub. Worth doing once the
  wording settles, probably after the first Ramadan.

## 8. Security (done 2 October 2026)

- Site hidden behind the "Coming soon" code screen until `SITE_PUBLIC=true`.
- Astro 7: `npm audit` shows 0 known vulnerabilities. Dependabot and a weekly check on GitHub
  watch for new ones; CodeQL scans the code.
- Security headers on every page; admin never cached or indexed.
- Rate limits on orders, promo codes, help requests and login codes.
- Passwordless login with short-lived codes; team rights only for emails in ADMIN_EMAILS.
- Prices always recalculated on the server; card details never touch the site (Square's page).
- Still to do by you: turn on GitHub's secret scanning and push protection (repo Settings →
  Code security), and turn on two-factor login for GitHub, Netlify, Square, Resend and Anthropic.

## 9. Launch day checklist

1. Final prices in Admin → Products; pickup address in the site text (ask Claude).
2. Square keys added, a $1 test order paid and refunded.
3. Domain: in Netlify move hikayacoffee.ca to this project; set `SITE_URL=https://hikayacoffee.ca`.
4. Resend domain verified; place one real order and check every email.
5. Remove sample orders (Admin → Orders).
6. Set `SITE_PUBLIC=true`, redeploy, open the site in a private window.
7. Run the Ask Hikaya eval once more (GitHub → Actions).
