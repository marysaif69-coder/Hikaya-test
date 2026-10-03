# Hikaya orders: how the back end works

Everything runs on Netlify: the website, the server code (Netlify Functions in `netlify/functions/`) and the database (Netlify Database, Postgres, created automatically on deploy from `netlify/database/migrations/`).

## What customers can do
- Order as a guest with just an email, or log in with an emailed 6-digit code (no passwords).
- See every order placed with their email (guest orders included) at `/en/account/` or `/ar/account/`: status, pickup/delivery day and window, items, payment.
- Cancel an order themselves while it is still "Received" and unpaid.
- Ask Hikaya (the chat button on every page): questions about coffee, dates, brewing, pickup and delivery; look up an order with its number and email; check a postal code or open days; add things to the cart; report a damaged, wrong, missing or late item with a photo; ask for a person.
- Help form at `/en/help/` and `/ar/help/`: the same requests without the chat, with up to 4 photos.

## What the team can do — `/admin/`
- Log in with a team email (listed in `ADMIN_EMAILS`).
- Orders: search and filter, open an order, move it Received → Confirmed → Ready / Out for delivery → Completed (or Cancel), mark Paid / Unpaid / Refunded, add team notes, see history and every email sent.
- Day sheet: what to pack, pickups by time window, deliveries sorted by postal area with map links. Printable.
- Settings: pause new orders; places per time window.
- Export CSV for any date range.
- Inbox: every help request (from the form or from Ask Hikaya) with photos, the linked order, and the whole chat. Reply by email from the desk, add notes, mark Waiting or Resolved with the outcome (replacement, refund, credit, answered). Damaged, wrong, missing and late are marked urgent, and each request is also emailed to the team.
- Conversations: every Ask Hikaya chat, with "helpful?" answers, to see what people ask and where answers fall short.

## Emails sent automatically (in the customer's language)
Order received (with the gift details and any discount) · confirmed · ready for pickup · out for delivery · completed · cancelled · reminder the evening before (5–6 pm Calgary) · login codes · new-order alert to the team · help request received (to the customer) · help request alert (to the team) · replies written in the Inbox · back in stock ("email me when it's back") · mailing list confirmation · Google review request (when `GOOGLE_REVIEW_URL` is set).
All sent through Resend from the site itself; no n8n or Zapier needed. Admin → Settings → Connections shows the last email and has "Send me a test email".

## Gift cards, regular orders, texts, monthly report
- **Gift cards** (`/en/gift-card/`): $25–100; card (Square) or e-Transfer. Once paid (Square webhook, or Admin → Promotions → "Money received") the code is emailed to the recipient. At checkout the "Gift card" box pays what it can; the balance stays; a cancelled order puts it back. Tables: `gift_cards`; orders carry `gift_card_code` / `gift_card_cents`.
- **Regular orders** (checkout → "The same again every 2/4 weeks"): stored in `subscriptions`. The daily job (`netlify/functions/reminders.mts`) turns each into a normal order 7 days before its day, at that day's prices, with the usual emails; if something is sold out the customer is emailed and the next one stays. Customers skip / pause / resume / stop in My account; the desk lists them under the Week sheet.
- **Text reminders**: checkout tick; sent by the same daily job through Twilio when its three settings exist.
- **Order again**: My account puts a past order's items back in the cart.
- **Ask Hikaya voice**: the browser's own speech-to-text fills the box (Chrome, Safari, Edge); no audio is sent to us.
- **Monthly report**: emailed to ADMIN_EMAILS on the 1st (Calgary); preview or send in Admin → Numbers.
- **Plan tab**: what's built, what's left before launch, the rehearsal steps and ideas for later.

## Drivers and the delivery app
- **Add a driver**: Admin → Drivers → email (+ name). They get an email with the link (`/admin/driver/`) and the steps; "Email the link again", WhatsApp and Copy link are on their row. Drivers are stored in `team_members` (helpers can be added the same way); owners stay in `ADMIN_EMAILS`.
- **Onboarding** (first login, email code): name, phone, car, and agreeing to the driver guide (`src/content/driver-guide.json`, editable in Words). Their details then show in the Drivers tab as "Ready" and the owners get an email.
- **Delivery app**: installable from the browser (iPhone Safari → Share → Add to Home Screen; Android Chrome → Install app). Drivers see only their own stops; Start route sets them "out for delivery" (customers emailed) and opens Google Maps with the stops in order; a photo is required at every door; if money is due they record cash or card; Delivered completes the order (thank-you email). Couldn't deliver emails the owners.
- **Routes**: Start route plans the shortest driving order for the driver's stops, time window by time window, from the shop (`SHOP_ADDRESS`) or the driver's location, using Google's Routes API (`GOOGLE_MAPS_API_KEY`). Without the key, stops go by time window and postal area. A "Next stop" card opens Google Maps navigation to the next stop; it moves on after each Delivered. "End route" closes it. Stored in `routes` (stops in order, legs, planned km and minutes).
- **Mileage**: from the app by default (the planned legs to each stop delivered or attempted, plus the drive back once the route ends). If the driver types odometer readings at start and end, those win. The driver's **Report** (in the app) shows deliveries, km, time on the road, cash and card collected, cash still to hand in and estimated pay, with a mileage-log CSV (date, times, km, source, purpose).
- **Pay rates** (optional, owners): per delivery, per km and per hour in Admin → Drivers; reports estimate pay from them. Driver reports for any dates, with each driver's mileage CSV, are in the same tab.
- **Owners**: assign deliveries per day (one by one or "give all unassigned"), see cash to hand in per driver and mark it received, see deliveries per driver (7 days / month) for pay, turn a driver off (logs them out).
- **Confirming**: "Confirm all new orders" in Orders, or Settings → "Confirm new orders automatically".
- **Customers** tab: every customer with orders, spending, regular orders, list membership and a team note (shown to the driver and on slips). Customers can change their order's day themselves in My orders until that day's deadline; the team can move any order.
- **Day sheet → Packing slips & gift cards**: one printable slip per order, plus a card page with the gift message.
- **Evening email** to owners and helpers with tomorrow's run sheet; **low-stock** email to owners when a limited product reaches 3.

## The desk at a glance
- **Orders, Inbox, Day sheet** as before. **Week sheet**: coffee to roast and grind (kg, pouches, how many go in gift boxes), dates to portion, boxes, sleeves and cups for Thursday–Wednesday; printable.
- **Driver** (`/admin/driver/`, made for a phone): the day's deliveries in postal-code order, Map and Call buttons, gift recipient and card message, "Collect $X" when paying on delivery, On my way / Delivered (emails the customer) / Couldn't deliver (note for the team).
- **Products**: also shows how many people wait for a sold-out product; switching it back on emails them.
- **Promotions**: mailing list numbers and a CSV of confirmed subscribers with when and what they agreed to (CASL).
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
| `GITHUB_CONTENT_TOKEN` | Optional. Turns on saving in Admin → Words. A fine-grained GitHub token for the Hikaya-test repository only, with "Contents: read and write". Secret. |
| `RESEND_API_KEY` | From resend.com (free tier: 3,000 emails/month). Until set, emails are logged but not sent. |
| `EMAIL_FROM` | e.g. `Hikaya <orders@hikayacoffee.ca>` (domain must be verified in Resend) |
| `EMAIL_REPLY_TO` | Where customer replies go, e.g. `hello@hikayacoffee.ca` |
| `ETRANSFER_EMAIL` | The Interac e-Transfer address shown to customers |
| `SITE_URL` | `https://hikayacoffee.ca` once the domain points here |
| `ANTHROPIC_API_KEY` | From console.anthropic.com. Turns on Ask Hikaya. Until set, the chat button points people to the help form. |
| `ASK_MODEL` | Optional. The Claude model for Ask Hikaya; default `claude-opus-5-5`. |
| `PREVIEW_PASSWORD` | The code testers type on the "Coming soon" screen to get in. |
| `SITE_PUBLIC` | Leave unset while the site is private: everyone sees "Coming soon" and search engines are kept out. Set to `true` (and redeploy) to open the site at launch. |
| `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENV`, `SQUARE_WEBHOOK_SIGNATURE_KEY` | Optional: turns on card payment through Square. Webhook URL: `<SITE_URL>/api/square/webhook`, event `payment.updated`. |

## Private preview and going live
- Until `SITE_PUBLIC` is `true`, an edge function (`netlify/edge-functions/preview-gate.ts`) sits in front of every page and API call. Entering the code keeps a person in for 30 days; changing the code signs everyone out. Square's webhook stays reachable.
- Going live: in Netlify move the domain hikayacoffee.ca from the old project to this one (Domain management), set `SITE_PUBLIC` to `true`, set `SITE_URL` to `https://hikayacoffee.ca`, and trigger a deploy.

## Ask Hikaya: how it knows things, and how to improve it
- What it may say lives in `knowledge/handbook.md` (policies, delivery, Ramadan, storage, health rules, voice). The product list, prices, ingredients and brewing steps are added automatically from `src/data/products.ts` and `src/data/brew.ts`, so it never drifts from the shop.
- It answers only from those. Anything else, and every damaged, wrong, missing or late item, order change, large order or request for a person, becomes an Inbox request; it never promises a refund or replacement itself.
- `knowledge/test-questions.json` holds the questions customers will ask, each with what a good answer must and must not do. `npm run ask:eval` (needs `ANTHROPIC_API_KEY` in your shell, or in a Claude Code cloud environment an API credential for `api.anthropic.com` with header `x-api-key`) asks the real assistant every one, grades the answers, and writes `knowledge/eval-report.md`. About $1 per full run.
- The loop: read the Conversations tab weekly → add real questions to the test file → fix the handbook where answers were wrong → run the test → publish.

## Testing locally
- `npm test` runs 59 API checks against an in-memory Postgres (orders, accounts, admin, help requests, photos, Inbox, and the assistant's tools with a stand-in model).
- `npm run dev:full` serves the site with the real API at http://localhost:8888 (emails go to `/tmp/hikaya-outbox.json`). Add `ASK_FAKE=1` to try the chat without an API key.
