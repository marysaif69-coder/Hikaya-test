# Settings to add: checklist

Where: **Netlify → hikaya-v4-preview → Project configuration → Environment variables → Add a variable**.
After adding or changing any of them: **Deploys → Trigger deploy → Deploy site**.
Mark the ones with 🔒 as **secret** ("Contains secret values"). Never paste these values into a chat.
The same list, with a tick for each one already added, is in **Admin → Settings**.

## Already added (you told me on 2–3 October)

- [x] `ADMIN_EMAILS`: owners, comma-separated (more owners can be added in Admin → Settings → Business details)
- [x] `RESEND_API_KEY` 🔒
- [x] `EMAIL_FROM`: e.g. `Hikaya <hello@hikayacoffee.ca>`
- [x] `EMAIL_REPLY_TO`: `hello@hikayacoffee.ca`
- [x] `PREVIEW_PASSWORD` 🔒: the "Coming soon" code
- [ ] `ANTHROPIC_API_KEY` 🔒: Ask Hikaya. It is a GitHub secret for the eval; check it is also in Netlify (Connections shows "Ask Hikaya: on")

## Add when you're ready

| Variable | What it does | Where to get it |
|---|---|---|
| `ETRANSFER_EMAIL` | The address customers send Interac e-Transfers to (shown at checkout and in emails) | Your bank's e-Transfer email, e.g. `pay@hikayacoffee.ca` |
| `STAFF_EMAILS` | Helpers: orders, Inbox, day/week sheets, Driver page. No refunds, prices, promo codes, settings, Words or exports | Their emails, comma-separated |
| `GOOGLE_REVIEW_URL` | Sends one "How was it?" email 3–10 days after a completed order | Google Business Profile → **Ask for reviews** → copy the link |
| `TWILIO_ACCOUNT_SID` | Text-message reminders (with the two below) | twilio.com → Console → Account Info |
| `TWILIO_AUTH_TOKEN` 🔒 | | Same page → Auth Token |
| `TWILIO_FROM` | The number texts come from | Twilio → Phone Numbers → buy a Canadian 403/587 number |
| `GOOGLE_MAPS_API_KEY` 🔒 | Shortest route for each driver, planned km and time; the app counts km from it | console.cloud.google.com → new project → enable **Routes API** → Credentials → Create API key → restrict it to Routes API. Needs a billing account; the free monthly allowance covers a small shop |
| `SHOP_ADDRESS` | Where routes start and end | The pickup address, e.g. `123 Example St SW, Calgary, AB T2P 1J9` |
| `GITHUB_CONTENT_TOKEN` 🔒 | Turns on **Save** in Admin → Words (product text and recipes) | See "GitHub token" below |

## Square (card payments)

| Variable | Where to get it |
|---|---|
| `SQUARE_ACCESS_TOKEN` 🔒 | developer.squareup.com → your application → **Credentials** → switch to **Production** → Access token |
| `SQUARE_LOCATION_ID` | Same app → **Locations** → the location's ID |
| `SQUARE_ENV` | Type `production` (leave unset or `sandbox` while testing) |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` 🔒 | Same app → **Webhooks → Subscriptions → Add subscription**: URL `https://<your site>/api/square/webhook`, event `payment.updated`, save, then copy its **Signature key** |

The exact webhook URL is shown in Admin → Settings → Connections. Then redeploy. "Card, now" appears
at checkout by itself. Press **Test Square** in Connections, then place a $1 order and refund it from the desk.

## At launch (not before)

| Variable | What |
|---|---|
| `SITE_URL` | `https://hikayacoffee.ca` once the domain points to this project |
| `SITE_PUBLIC` | `true` opens the site to everyone. Only on launch day |

Also at launch: a free uptime monitor at uptimerobot.com (HTTPS, `https://hikayacoffee.ca/api/config`,
every 5 minutes, alerts to hello@hikayacoffee.ca).

## GitHub token for Admin → Words

1. github.com → your picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `Hikaya Words`. Expiration: 1 year (put a reminder in your calendar).
3. Repository access: **Only select repositories → Hikaya-test**.
4. Permissions → Repository permissions → **Contents: Read and write**. Nothing else.
5. Generate, copy, and paste it into Netlify as `GITHUB_CONTENT_TOKEN` (secret). Redeploy.

## Accounts to protect with two-factor login

GitHub, Netlify, Square, Resend, Anthropic, Google. Also turn on GitHub **secret scanning and push
protection** (repository Settings → Code security).
