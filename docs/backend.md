# Hikaya orders: how the back end works

Everything runs on Netlify: the website, the server code (Netlify Functions in `netlify/functions/`) and the database (Netlify Database, Postgres, created automatically on deploy from `netlify/database/migrations/`).

## What customers can do
- Order as a guest with just an email, or log in with an emailed 6-digit code (no passwords). For team logins (owners, helpers, drivers, packers) a code works only in the browser that asked for it (the `hk_login` cookie), so strangers' wrong guesses can't lock the team out; customers can type it on any device; 5 codes an hour per email and address, 15 per email in all.
- See every order placed with their email (guest orders included) at `/en/account/` or `/ar/account/`: status, pickup/delivery day and window, items, payment.
- Cancel an order themselves while it is still "Received" and unpaid.
- Ask Hikaya (the chat button on every page): questions about coffee, dates, brewing, pickup and delivery; look up an order with its number and email; check a postal code or open days; add things to the cart; report a damaged, wrong, missing or late item with a photo; ask for a person.
- Help form at `/en/help/` and `/ar/help/`: the same requests without the chat, with up to 4 photos.

## What the team can do — `/admin/`
- Log in with a team email (listed in `ADMIN_EMAILS`, or added as an owner in Admin → Settings → Business details).
- **Business details** (Admin → Settings, owners only): pickup address and hours, phone, e-Transfer email, reply-to, Google review link, shop start address for routes, GST number and extra owner emails. Saved in `settings.business`; they override the Netlify variables of the same name (`netlify/lib/business.ts`, `loadOverrides()` at the start of each function). The address replaces "[address]" on the site and appears in emails, labels and Ask Hikaya. Owners listed in Netlify can't be removed from the desk.
- Orders: search and filter, open an order, move it Received → Confirmed → Ready / Out for delivery → Completed (or Cancel), mark Paid / Unpaid / Refunded, add team notes, see history and every email sent.
- Day sheet: what to pack, pickups by time window, deliveries sorted by postal area with map links. Printable.
- Settings: pause new orders; places per time window.
- Export CSV for any date range.
- Inbox: every help request (from the form or from Ask Hikaya) with photos, the linked order, and the whole chat. Reply by email from the desk, add notes, mark Waiting or Resolved with the outcome (replacement, refund, credit, answered). Damaged, wrong, missing and late are marked urgent, and each request is also emailed to the team.
- Conversations: every Ask Hikaya chat, with "helpful?" answers, to see what people ask and where answers fall short.

## Emails sent automatically (in the customer's language)
Order received (with the gift details and any discount) · confirmed · ready for pickup · out for delivery · completed · cancelled · reminder the evening before (at the order-by hour, 8 pm Calgary by default) · login codes · new-order alert to the team · help request received (to the customer) · help request alert (to the team) · replies written in the Inbox · back in stock ("email me when it's back") · mailing list confirmation · Google review request (when `GOOGLE_REVIEW_URL` is set) · "Running low?" (switched off until the owners decide, `REFILLS_ON` in `reminders.mts`: about three weeks after a completed coffee order, 21–24 days after its day; confirmed mailing-list customers only; not for gifts, regular orders, or if they have ordered since; at most one every 60 days; once per order, stamped `refill_sent_at`; kind `refill-reminder`; has an unsubscribe link).
All sent through Resend from the site itself; no n8n or Zapier needed. Admin → Settings → Connections shows the last email and has "Send me a test email".

## Gift cards, regular orders, texts, monthly report
- **Gift cards** (`/en/gift-card/`): $25–100; card (Square) or e-Transfer. Once paid (Square webhook, or Admin → Shop → Promotions → "Money received") the code is emailed to the recipient. At checkout the "Gift card" box pays what it can; the balance stays; a cancelled order puts it back. Tables: `gift_cards`; orders carry `gift_card_code` / `gift_card_cents`.
- **Regular orders** (checkout → "The same again every 2/4 weeks"): stored in `subscriptions`. The daily job (`netlify/functions/reminders.mts`) turns each into a normal order 8 days before its day, at that day's prices, with the usual emails; if something is sold out the customer is emailed and the next one stays. Customers skip / pause / resume / stop in My account; the desk lists them under the Week sheet.
- **Text reminders**: checkout tick; sent by the same daily job through Twilio when its three settings exist.
- **Order again**: My account puts a past order's items back in the cart.
- **Ask Hikaya voice**: the browser's own speech-to-text fills the box (Chrome, Safari, Edge); no audio is sent to us.
- **Who can see the website** (Admin → Settings, owners; `netlify/lib/visibility.ts`, read by the gate through `/api/site-state`, cached 20 s): the real website (hikayacoffee.ca) hidden or open, locked behind typing the domain, owners emailed on change; the preview address needs the team code or is open to anyone with the link (always noindex). If the switch can't be read, everything stays hidden. `SITE_PUBLIC=true` still opens the real website.
- **Coming soon + waitlist** (`netlify/edge-functions/preview-gate.ts`): while the site is hidden, the Coming soon page shows the official lockup and an email sign-up (mailing list, source `soon`, consent text from `netlify/lib/consent.ts`, confirm by email), plus an optional "Which cup is yours?" answer (gulf, yemen, shami, qishr, unsure) saved in `subscribers.cup`. In phase 0 (Something is brewing) there is no sign-up. Only `POST /api/list`, `/api/list/confirm` and `/api/list/unsubscribe` pass the gate; their thank-you redirects land back on the Coming soon page with a message. The preview code sits under "Team".
- **Logo files** (`public/brand/`): `logo.svg` (the mark), `lockup.svg` (mark + حكاية | HIKAYA), `wordmark.svg` and `wordmark-ar.svg` (the lettering, Arabic-only for narrow phones), all from logo pack v0.8.1 in Drive (02 Logo), in screen colours.
- **Decisions** (Admin → Settings → Decisions, owners; `src/data/decisions.ts`, answers in `settings.decisions`): the questions only Maryam and Shadi can answer, each saved with who and when. Read the answer before changing anything a decision covers.
- **IT · Release checks** (Admin → Settings, owners; `src/data/release-checks.ts`, ticks in `settings.release_checks`): what to check on the preview after each release, ticked with who and when. Add a release at the top with every push.
- **Today** (Admin → Orders → Today, the desk's first screen; `netlify/lib/today.ts`): today's counts and a to-do list, most urgent first, each with a button to the tab that fixes it. Money totals for owners only.
- **Phone notifications** (Web Push, `netlify/lib/push.ts`, service worker `public/admin/driver/sw.js`): each person turns them on per phone in the team app (Me). Drivers get one when stops are assigned to them; everyone gets team messages and their shift reminder; owners get each new order. iPhone needs the app on the Home Screen (iOS 16.4+). The key pair is made once and kept in `push_keys` (not in the backup) unless `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are set. A failed push never stops the action; phones that are gone are removed.
- **Costs and margins** (Admin → Numbers, owners): cost of one per product (`product_settings.cost_cents`); sales, cost and what is left for any range of days (by pickup/delivery day; discounts and refunds off the total). `netlify/lib/costs.ts`.
- **Gift cards in person** (Admin → Shop → Promotions → Sell one here, owners): $5–$500, cash, card on the reader or e-Transfer; paid at once, emailed if there is an address, printable card. `sellGiftCardHere` in `netlify/lib/giftcards.ts`.
- **Monthly report**: emailed to ADMIN_EMAILS on the 1st (Calgary); preview or send in Admin → Numbers.
- **Plan tab**: what's built, what's left before launch, the rehearsal steps and ideas for later.

## Drivers and the delivery app
- **Add a driver**: Admin → Team → email (+ name). They get an email with the link (`/admin/driver/`) and the steps; "Email the link again", WhatsApp and Copy link are on their row. Drivers are stored in `team_members` (helpers can be added the same way); owners stay in `ADMIN_EMAILS`.
- **Onboarding** (first login, email code): name, phone, car, and agreeing to the driver guide (`src/content/driver-guide.json`, editable in Words). Their details then show in the Drivers tab as "Ready" and the owners get an email.
- **Delivery app**: installable from the browser (iPhone Safari → Share → Add to Home Screen; Android Chrome → Install app). Drivers see only their own stops; Start route sets them "out for delivery" (customers emailed) and opens Google Maps with the stops in order; a photo is required at every door; if money is due they record cash or card; Delivered completes the order (thank-you email). Couldn't deliver emails the owners.
- **Routes**: Start route plans the shortest driving order for the driver's stops, time window by time window, from the shop (`SHOP_ADDRESS`) or the driver's location, using Google's Routes API (`GOOGLE_MAPS_API_KEY`). Without the key, stops go by time window and postal area. A "Next stop" card opens Google Maps navigation to the next stop; it moves on after each Delivered. "End route" closes it. Stored in `routes` (stops in order, legs, planned km and minutes).
- **Mileage**: from the app by default (the planned legs to each stop delivered or attempted, plus the drive back once the route ends). If the driver types odometer readings at start and end, those win. The driver's **Report** (in the app) shows deliveries, km, time on the road, cash and card collected, cash still to hand in and estimated pay, with a mileage-log CSV (date, times, km, source, purpose).
- **Pay rates** (optional, owners): per delivery, per km and per hour in Admin → Team; reports estimate pay from them. Driver reports for any dates, with each driver's mileage CSV, are in the same tab.
- **Owners**: assign deliveries per day (one by one or "give all unassigned"), see cash to hand in per driver and mark it received, see deliveries per driver (7 days / month) for pay, turn a driver off (logs them out).
- **Confirming**: "Confirm all new orders" in Orders, or Settings → "Confirm new orders automatically".
- **Customers** tab: every customer with orders, spending, regular orders, list membership and a team note (shown to the driver and on slips). Customers can change their order's day themselves in My orders until that day's deadline; the team can move any order.
- **Day sheet → Packing slips & gift cards**: one printable slip per order, plus a card page with the gift message.
- **Evening email** to owners and helpers with tomorrow's run sheet; **low-stock** email to owners when a limited product reaches 3.

## The team: roles, shifts, hours, papers
- **Roles** (Admin → Team): drivers, packers and helpers, each can be marked volunteer. Owners stay in `ADMIN_EMAILS`. Drivers and packers use the team app (`/admin/driver/`, installable); helpers use the desk.
- **Team app tabs**: Shifts (sign up, leave up to 24 h before, check in/out on the day), Pack (packers and helpers: the day's orders with items, lots, gift messages; "Packed" makes a pickup order ready and emails the customer), Deliver (drivers), Me (details, papers, hours, report, guide).
- **Shifts**: owners or helpers post them (repeat weekly if wanted) and can put people on; reminders go out the evening before, and owners get an email if tomorrow has empty spots. Hours come from check-in/out (fixable in the desk) with a CSV, volunteer hours included.
- **Papers**: driver's licence and car insurance (drivers, required at onboarding) and food handler certificate, with expiry dates. One reminder 30 days before expiry and again if expired; drivers with expired papers can't be given deliveries, sign up for driving shifts or start a route.

## Limits (Settings → Limits; Products → "Per day")
- Orders per day, gift boxes per day (packing time), and per-product daily limits are checked at checkout and when an order is moved.
- "Delivery places follow the drivers on shift": each delivery window gets drivers on a driving shift overlapping it × stops per driver (never more than the window's own limit); no driver, no deliveries in that window.

## Production and supplies (Admin → Team → Production)
- **Lots**: one per batch (coffee or date variety), code like `NAJDI-270201-1`, made and best-before dates, quantity, supplier. The lot in use is the newest made on or before the day and not used up; packing slips and the packing list show each order's lots (including coffee and dates inside gift boxes).
- **Recall lookup**: a lot code → every order from the day it was made until it was marked used up, with contacts and a CSV.
- **Supplies**: packaging on hand vs what the week's orders need, with a "warn at" level; add your own lines (spices, bags).

## Shared login, editing orders, letters, labels, food safety
- **Shared team login**: people added with "Uses our shared login" log in with that email (e.g. hello@), pick their name, and confirm with a code sent to their own email (`as_tokens`). The device then acts as them: work is credited to them and their reminders go to their own email. Drivers keep their own logins. "Switch person" in the desk and the team app.
- **Change items** (order panel, before packing): repriced at today's prices, stock and daily limits checked, promo and gift card kept; a paid order that grows shows the balance due; card orders get a new payment page; the customer gets "Your order was updated".
- **"You're next"**: when a route starts and after each delivered or missed stop, the next customer in driving order gets an email (and a text if they asked).
- **Letters** (Promotions, owners): English and Arabic; test copy to yourself; sent through Resend's batch endpoint to confirmed subscribers in their language with a one-click unsubscribe header (the POST is answered, also while the site is hidden). Each letter ends with the mailing address (Business details → Mailing address, else the pickup address) and can't be sent without one. Who each letter reached is kept in `letter_sends`; a letter that partly failed shows "Partly sent" with "Send to the ones that failed".
- **Labels** (Production): per lot, English/French common name and ingredients (from the product data), net quantity, best before in the bilingual year-month-day format, lot code, storage line and the company line. Check the wording with the CFIA.
- **Food safety log**: checklists (editable; lines ending in "(°C)" ask for a temperature) signed in the team app's Shifts tab; the log is in Production.
- **Team messages** (Team tab): shown at the top of the team app, optionally emailed to everyone.
- **Backup** (Settings): every table as one JSON file, without sessions and login codes; photos listed without their image bytes.
- **Activity log** (Settings): every change made through the desk (who, what, when, the details sent).

## The desk at a glance
- **Orders, Inbox, Day sheet** as before. **Week sheet**: coffee to roast and grind (kg, pouches, how many go in gift boxes), dates to portion, boxes, sleeves and cups for Thursday–Wednesday; printable.
- **Driver** (`/admin/driver/`, made for a phone): the day's deliveries in postal-code order, Map and Call buttons, gift recipient and card message, "Collect $X" when paying on delivery, On my way / Delivered (emails the customer) / Couldn't deliver (note for the team).
- **Products**: also shows how many people wait for a sold-out product; switching it back on emails them.
- **Promotions**: mailing list numbers, the count of "Which cup is yours?" answers, and a CSV of confirmed subscribers with when and what they agreed to (CASL).
- **Numbers**: page visits per day and page, sites that sent visitors, sales per week and best sellers. Counted without cookies (one number per page per day).
- **Words**: product names and descriptions and the brew recipes in English and Arabic. Saving writes `src/content/*.json` on GitHub and Netlify rebuilds (about 2 minutes).
- **Settings → Connections**: Emails, Square, e-Transfer and Ask Hikaya at a glance, with "Send me a test email" and "Test Square".

## Settings to add in Netlify (Project configuration → Environment variables)
| Name | What |
|---|---|
| `ADMIN_EMAILS` | Owners: can do everything. Comma-separated, e.g. `maryam@hikayacoffee.ca,shadi@hikayacoffee.ca` |
| `STAFF_EMAILS` | Optional. Helpers: orders, Inbox, day and week sheets, the driver page. Not refunds, prices, promo codes, settings, words or exports. |
| `GOOGLE_REVIEW_URL` | Optional. Your Google review link (Google Business Profile → Ask for reviews). When set, completed orders get one "How was it?" email 3–10 days later. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Optional. Text-message reminders the evening before, for customers who tick the box at checkout. About 1–2¢ a text. |
| `GITHUB_CONTENT_TOKEN` | Optional. Turns on saving in Admin → Shop → Words. A fine-grained GitHub token for the Hikaya-test repository only, with "Contents: read and write". Secret. |
| `RESEND_API_KEY` | From resend.com (free tier: 3,000 emails/month). Until set, emails are logged but not sent. |
| `EMAIL_FROM` | e.g. `Hikaya <orders@hikayacoffee.ca>` (domain must be verified in Resend) |
| `EMAIL_REPLY_TO` | Where customer replies go, e.g. `hello@hikayacoffee.ca` |
| `ETRANSFER_EMAIL` | The Interac e-Transfer address shown to customers |
| `SITE_URL` | `https://hikayacoffee.ca` once the domain points here |
| `ANTHROPIC_API_KEY` | From console.anthropic.com. Turns on Ask Hikaya. Until set, the chat button points people to the help form. |
| `ASK_MODEL` | Optional. The Claude model for Ask Hikaya; default `claude-opus-5-5`. |
| `PREVIEW_PASSWORD` | The code testers type on the "Coming soon" screen to get in (checked by `netlify/functions/preview-login.mts`: 10 tries per address per 15 minutes). |
| `SITE_PUBLIC` | Leave unset while the site is private: everyone sees "Coming soon" and search engines are kept out. Set to `true` (and redeploy) to open the site at launch. |
| `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENV`, `SQUARE_WEBHOOK_SIGNATURE_KEY` | Optional: turns on card payment through Square. Webhook URL: `<SITE_URL>/api/square/webhook`, event `payment.updated`. |

## Private preview and going live
- Until `SITE_PUBLIC` is `true`, an edge function (`netlify/edge-functions/preview-gate.ts`) sits in front of every page and API call. Entering the code keeps a person in for 30 days; changing the code signs everyone out. Square's webhook stays reachable.
- Going live: in Netlify move the domain hikayacoffee.ca from the old project to this one (Domain management), set `SITE_PUBLIC` to `true`, set `SITE_URL` to `https://hikayacoffee.ca`, and trigger a deploy.

## Ask Hikaya: how it knows things, and how to improve it
- What it may say lives in `knowledge/handbook.md` (policies, delivery, Ramadan, storage, health rules, voice). The product list, prices, ingredients and brewing steps are added automatically from `src/data/products.ts` and `src/data/brew.ts`, so it never drifts from the shop.
- It answers only from those. Anything else, and every damaged, wrong, missing or late item, order change, large order or request for a person, becomes an Inbox request; it never promises a refund or replacement itself.
- `knowledge/test-questions.json` holds the questions customers will ask, each with what a good answer must and must not do. `npm run ask:eval` (needs `ANTHROPIC_API_KEY` in your shell, or in a Claude Code cloud environment an API credential for `api.anthropic.com` with header `x-api-key`) asks the real assistant every one, grades the answers, and writes `knowledge/eval-report.md`. About $1 per full run.
- The loop: read Customers → Ask Hikaya chats weekly → add real questions to the test file → fix the handbook where answers were wrong → run the test → publish.

## Testing locally
- `npm test` runs 59 API checks against an in-memory Postgres (orders, accounts, admin, help requests, photos, Inbox, and the assistant's tools with a stand-in model).
- `npm run dev:full` serves the site with the real API at http://localhost:8888 (emails go to `/tmp/hikaya-outbox.json`). Add `ASK_FAKE=1` to try the chat without an API key.
