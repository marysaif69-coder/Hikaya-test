// What to check on the preview after each release, shown in the desk under Settings → IT.
// Add a release at the top after every batch is pushed. Keep each check's id unchanged once
// published: the ticks (who checked it, and when) are saved against it.
export type Check = { id: string; text: string; links?: { label: string; href: string }[] };
export type Release = { id: string; title: string; date: string; checks: Check[] };

export const RELEASES: Release[] = [
  {
    id: '1b-5', title: 'Round 1b · batch 5: desk fixes, packers who drive (end of round 1b)', date: '2026-10-04',
    checks: [
      { id: 'packer-drives', text: 'Team: add a test Packer with “Also drives”. In the team app they fill in licence and insurance, then see the packing list and their own deliveries only.', links: [{ label: 'Desk', href: '/admin/' }, { label: 'Team app', href: '/admin/driver/' }] },
      { id: 'keyboard', text: 'Desk on a laptop: press Tab to an order in All orders and press Enter; the order opens. Press Esc; you are back on the same row.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'fix-times', text: 'Team → shifts: the ⏱ button shows the current check-in and check-out times in the prompts; pressing OK keeps them.' },
      { id: 'places-blank', text: 'Settings → Places per time window: an empty box can’t be saved (type 0 to close).' },
      { id: 'costs-not-set', text: 'Numbers → Costs: products with no price say “Not set”, not $0.' },
      { id: 'round-check', text: 'End of round 1b: log in on the desk and the team app; check Today, an order panel, the Team tab and a driver route.', links: [{ label: 'Desk', href: '/admin/' }, { label: 'Team app', href: '/admin/driver/' }] },
    ],
  },
  {
    id: '1b-4', title: 'Round 1b · batch 4: team app, drivers and shifts (and Something is brewing)', date: '2026-10-04',
    checks: [
      { id: 'brewing', text: 'hikayacoffee.ca on a phone set to English: “Something is brewing.” big and white, شيء ما يغلي. smaller under it. On an Arabic phone it opens in Arabic.', links: [{ label: 'See Phase 0', href: '/?phase=brewing' }] },
      { id: 'start-today', text: 'Team app → Deliveries: pick tomorrow in the day picker. There is no “Start route” card; it only shows on the day itself.', links: [{ label: 'Team app', href: '/admin/driver/' }] },
      { id: 'turned-off', text: 'Turn a test team member off in Team: their phone stops getting team messages.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'check-in', text: 'Shifts: Check in is refused more than an hour before a shift starts; Check out a second time does not change the time.', links: [{ label: 'Team app', href: '/admin/driver/' }] },
    ],
  },
  {
    id: '1b-3', title: 'Round 1b · batch 3: private gate, launch day, logins', date: '2026-10-04',
    checks: [
      { id: 'login-ar', text: 'My account in Arabic: ask for a code, type a wrong one. The error is in Arabic (الرمز غير صحيح.). Then log in with the right code from the same phone: it works.', links: [{ label: 'Account (AR)', href: '/ar/account/' }, { label: 'Account (EN)', href: '/en/account/' }] },
      { id: 'login-other-device', text: 'Customers: ask for a code on your phone, type it on your laptop: it works. Team logins (desk, team app): a code works only on the device that asked for it.' },
      { id: 'preview-code', text: 'In a private window on the preview, type a wrong preview code: “That code is not right”. The right code still lets you in.', links: [{ label: 'Preview', href: '/team' }] },
      { id: 'team-bar', text: 'The dark TEAM VIEW bar still shows on the preview, and says what customers on hikayacoffee.ca see.', links: [{ label: 'Home (EN)', href: '/en/' }] },
      { id: 'sachet-small', text: 'Shop: a small pack drawing reads “صغير · SMALL” (Arabic first).', links: [{ label: 'Shop (AR)', href: '/ar/shop/' }, { label: 'Shop (EN)', href: '/en/shop/' }] },
    ],
  },
  {
    id: '1b-2', title: 'Round 1b · batch 2: emails and the mailing list', date: '2026-10-04',
    checks: [
      { id: 'edit-unpriced', text: 'Open a sample order → Change items. Products with no price yet say “(no price yet: $20 stand-in)”. On a real order they are greyed out. Saving no longer says “Gulf coffee is not open for orders yet”.', links: [{ label: 'All orders', href: '/admin/' }] },
      { id: 'mailing-address', text: 'Settings → Business details has “Mailing address for letters”. Fill it in (a PO box is fine). Without it, “Send to everyone” refuses with a message.', links: [{ label: 'Settings', href: '/admin/' }] },
      { id: 'letter-test', text: 'Shop → Promotions → Letters: “Send me a test”. The bottom of both test emails shows Hikaya Coffee Ltd. (حكاية in Arabic), the mailing address and hikayacoffee.ca.' },
      { id: 'consent-words', text: 'The consent tick in the footer and at checkout reads “Yes, send me Hikaya letters (about three emails a year: …)”, the same as Coming soon, in Arabic and English.', links: [{ label: 'Checkout (AR)', href: '/ar/checkout/' }, { label: 'Checkout (EN)', href: '/en/checkout/' }] },
    ],
  },
  {
    id: '1b-1', title: 'Round 1b · batch 1: Ask Hikaya and help requests', date: '2026-10-04',
    checks: [
      { id: 'postal-lethbridge', text: 'Checkout, delivery, postal code T1J 0A1 (Lethbridge) is refused; T2P 1J9 is accepted with the $9 fee.', links: [{ label: 'Checkout (AR)', href: '/ar/checkout/' }, { label: 'Checkout (EN)', href: '/en/checkout/' }] },
      { id: 'visit-wording', text: 'Visit page, delivery: “Calgary postal codes only, not nearby towns” in both languages.', links: [{ label: 'Visit (AR)', href: '/ar/visit/' }, { label: 'Visit (EN)', href: '/en/visit/' }] },
      { id: 'help-email', text: 'Send the help form to your own email. The “We have your message” email has the request number but not what you typed.', links: [{ label: 'Help (AR)', href: '/ar/help/' }, { label: 'Help (EN)', href: '/en/help/' }] },
      { id: 'ask-chips', text: 'Ask Hikaya: tap each suggestion in Arabic and English; every one gets an answer.' },
      { id: 'ask-eval', text: 'At the end of round 1b: GitHub → Actions → “Ask Hikaya eval” → Run workflow. 37/40 or better.', links: [{ label: 'GitHub Actions', href: 'https://github.com/marysaif69-coder/Hikaya-test/actions' }] },
    ],
  },
  {
    id: '1a', title: 'Round 1a: money and orders', date: '2026-10-04',
    checks: [
      { id: 'paid-edit', text: 'Place a test order, mark it paid, then change its items up and down. The order shows what is still to pay, or what to refund (and no more than that).', links: [{ label: 'All orders', href: '/admin/' }] },
      { id: 'cancel-final', text: 'Cancel an order: it cannot be moved back to Received or Confirmed.' },
      { id: 'account-pay', text: 'My account on a phone: “Pay the rest” (ادفع الباقي) on a part-paid card order, no “Pay now” on a cancelled one, and the Arabic error when changing the day.', links: [{ label: 'Account (AR)', href: '/ar/account/' }, { label: 'Account (EN)', href: '/en/account/' }] },
      { id: 'checkout-full', text: 'Checkout: pick a full time slot; the error is in Arabic on the Arabic page.', links: [{ label: 'Checkout (AR)', href: '/ar/checkout/' }, { label: 'Checkout (EN)', href: '/en/checkout/' }] },
    ],
  },
];
