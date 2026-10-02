# Hikaya orders: how the back end works

Everything runs on Netlify: the website, the server code (Netlify Functions in `netlify/functions/`) and the database (Netlify Database, Postgres, created automatically on deploy from `netlify/database/migrations/`).

## What customers can do
- Order as a guest with just an email, or log in with an emailed 6-digit code (no passwords).
- See every order placed with their email (guest orders included) at `/en/account/` or `/ar/account/`: status, pickup/delivery day and window, items, payment.
- Cancel an order themselves while it is still "Received" and unpaid.

## What the team can do — `/admin/`
- Log in with a team email (listed in `ADMIN_EMAILS`).
- Orders: search and filter, open an order, move it Received → Confirmed → Ready / Out for delivery → Completed (or Cancel), mark Paid / Unpaid / Refunded, add team notes, see history and every email sent.
- Day sheet: what to pack, pickups by time window, deliveries sorted by postal area with map links. Printable.
- Settings: pause new orders; places per time window.
- Export CSV for any date range.

## Emails sent automatically (in the customer's language)
Order received · confirmed · ready for pickup · out for delivery · completed · cancelled · reminder the evening before (5–6 pm Calgary) · login codes · new-order alert to the team.

## Settings to add in Netlify (Project configuration → Environment variables)
| Name | What |
|---|---|
| `ADMIN_EMAILS` | Team emails, comma-separated, e.g. `maryam@hikayacoffee.ca,shadi@hikayacoffee.ca` |
| `RESEND_API_KEY` | From resend.com (free tier: 3,000 emails/month). Until set, emails are logged but not sent. |
| `EMAIL_FROM` | e.g. `Hikaya <orders@hikayacoffee.ca>` (domain must be verified in Resend) |
| `EMAIL_REPLY_TO` | Where customer replies go, e.g. `hello@hikayacoffee.ca` |
| `ETRANSFER_EMAIL` | The Interac e-Transfer address shown to customers |
| `SITE_URL` | `https://hikayacoffee.ca` once the domain points here |
| `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_ENV`, `SQUARE_WEBHOOK_SIGNATURE_KEY` | Optional: turns on card payment through Square. Webhook URL: `<SITE_URL>/api/square/webhook`, event `payment.updated`. |

## Testing locally
- `npm test` runs 31 API checks against an in-memory Postgres.
- `npm run dev:full` serves the site with the real API at http://localhost:8888 (emails go to `/tmp/hikaya-outbox.json`).
