// What to check on the preview after each release, shown in the desk under Settings → IT.
// Add a release at the top after every batch is pushed. Keep each check's id unchanged once
// published: the ticks (who checked it, and when) are saved against it.
export type Check = { id: string; text: string; links?: { label: string; href: string }[] };
export type Release = { id: string; title: string; date: string; checks: Check[] };

export const RELEASES: Release[] = [
  {
    id: '3-1', title: 'Round 3 · batch 1: dates in three tiers (data and server) · branch dates-and-gifts', date: '2026-10-04',
    checks: [
      { id: '3-1-prices', text: 'Admin → Shop → Products: the new dates (Everyday 250 g, 500 g, 1 kg; Reserve 12 and 24; Stuffed 12 and 24) show “no price”. Set their prices there when you are ready; until then they say “Price coming” and can’t be ordered.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: '3-1-everyday', text: 'Everyday dates 1 kg: the choice is only Khalas or Sukkari Qassimi (سكري قصيمي).', links: [{ label: '1 kg (AR)', href: '/ar/shop/dates-1kg/' }, { label: '1 kg (EN)', href: '/en/shop/dates-1kg/' }] },
      { id: '3-1-reserve', text: 'Reserve box, 12: the choice is Royal Sukkari Mufattal, Ajwa or Medjool (مجدول).', links: [{ label: 'Reserve 12 (AR)', href: '/ar/shop/reserve-12/' }, { label: 'Reserve 12 (EN)', href: '/en/shop/reserve-12/' }] },
      { id: '3-1-stuffed', text: 'Stuffed dates, 12: four fillings with their allergens; caramel with almonds is not offered.', links: [{ label: 'Stuffed 12 (AR)', href: '/ar/shop/stuffed-12/' }, { label: 'Stuffed 12 (EN)', href: '/en/shop/stuffed-12/' }] },
      { id: '3-1-no-pairing', text: 'No date pairing anywhere: Gulf coffee and Najdi pages have no “Good with” date, and the homepage has no “Add the pair” section.', links: [{ label: 'Najdi (EN)', href: '/en/shop/najdi/' }, { label: 'Home (AR)', href: '/ar/' }] },
      { id: '3-1-labels', text: 'Desk → Production: add a lot for “Stuffed · Pistachio stuffed”, then print labels: the label has the Contains / Contient line; Net quantity offers 250 g, 500 g, 1 kg.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: '3-1-decisions', text: 'Settings → Decisions: four new questions (Lotus name, mixed Reserve box, the fourth date in Four Palms and Eid Dates, the new packaging).', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'round-2', title: 'End of round 2: the customer site, on a phone, in Arabic and English', date: '2026-10-04',
    checks: [
      { id: 'shop-tabs', text: 'Shop: open each coffee tab.', links: [{ label: 'Shop (AR)', href: '/ar/shop/' }, { label: 'Shop (EN)', href: '/en/shop/' }] },
      { id: 'gulf-sticky', text: 'Gulf coffee: the sticky bar at the bottom follows the style you pick.', links: [{ label: 'Gulf (AR)', href: '/ar/shop/gulf/' }, { label: 'Gulf (EN)', href: '/en/shop/gulf/' }] },
      { id: 'taste-yemen', text: 'Taste Yemen: the how-to says one small pack per pot.', links: [{ label: 'Taste Yemen (AR)', href: '/ar/shop/taste-yemen/' }, { label: 'Taste Yemen (EN)', href: '/en/shop/taste-yemen/' }] },
      { id: 'brew-find-visit', text: 'Brew guide; Find your coffee (Gulf → Qassimi → Milk); Visit → Allergens.', links: [{ label: 'Brew (AR)', href: '/ar/brew/' }, { label: 'Find (EN)', href: '/en/find/' }, { label: 'Visit (AR)', href: '/ar/visit/' }] },
      { id: 'home', text: 'Homepage: the pairs (allergen line, “Add the pair”) and the Arabic hero (قهوة خليجية ويمنية وشامية).', links: [{ label: 'Home (AR)', href: '/ar/' }, { label: 'Home (EN)', href: '/en/' }] },
      { id: 'ar-promo-error', text: 'Arabic checkout: a wrong promo code shows the Arabic message.', links: [{ label: 'Checkout (AR)', href: '/ar/checkout/' }] },
    ],
  },
  {
    id: '2-7', title: 'Round 2 · batch 7: accessibility and small fixes', date: '2026-10-04',
    checks: [
      { id: 'pair-tag', text: 'Homepage pairs (dark band): “Ordering opens soon” is readable, in gold.', links: [{ label: 'Home (AR)', href: '/ar/' }, { label: 'Home (EN)', href: '/en/' }] },
      { id: 'ramadan-29', text: 'Ramadan page: the iftar table ends on 8 March (29 days), then “Eid: around 9 March”.', links: [{ label: 'Ramadan (AR)', href: '/ar/ramadan/' }, { label: 'Ramadan (EN)', href: '/en/ramadan/' }] },
      { id: '404-switch', text: 'Open a page that doesn’t exist (e.g. /en/nothing/): the “عربي” switch goes to the Arabic home page.', links: [{ label: 'Missing page', href: '/en/nothing-here/' }] },
      { id: 'intro-reduced', text: 'With “Reduce motion” on (phone settings), the homepage opens straight away with no intro, even with ?intro=full.' },
      { id: 'chat-sr', text: 'Ask Hikaya with VoiceOver or TalkBack: each new reply is read once, not the whole conversation again.' },
    ],
  },
  {
    id: '2-6', title: 'Round 2 · batch 6: Ask Hikaya handbook, privacy', date: '2026-10-04',
    checks: [
      { id: 'ask-subscription', text: 'Ask Hikaya “Do you have a coffee subscription?”: it explains regular orders (every 2 or 4 weeks, paid each time), not “no subscriptions”.' },
      { id: 'ask-running-low', text: 'Ask Hikaya “How do I stop the Running low email?”: it points to the unsubscribe link, or offers to send a request.' },
      { id: 'privacy-decision', text: 'Settings → Decisions → “Approve the new privacy wording”: read the draft and answer; the site changes after you approve.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: '2-5', title: 'Round 2 · batch 5: Arabic error messages and My account', date: '2026-10-04',
    checks: [
      { id: 'ar-promo', text: 'Arabic checkout: type a code that doesn’t exist; the message is in Arabic (هذا الرمز غير صحيح.). Try a used-up gift card: Arabic too.', links: [{ label: 'Checkout (AR)', href: '/ar/checkout/' }] },
      { id: 'ar-login', text: 'Arabic My account: a wrong login code shows Arabic, not English.', links: [{ label: 'Account (AR)', href: '/ar/account/' }] },
      { id: 'card-discount', text: 'My account, an order with a promo code: the discount line shows (−$5 (EID)), and the lines add up to the total. A refunded order says “Refunded”, not “Not paid yet”.', links: [{ label: 'Account (EN)', href: '/en/account/' }] },
      { id: 'midnight', text: 'Settings → order-by 00:00: checkout says “12 am”, and the desk explains it closes a whole day earlier.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: '2-4', title: 'Round 2 · batch 4: naming, “from Yemen”, [address], Arabic text', date: '2026-10-04',
    checks: [
      { id: 'footer-line', text: 'Footer on any page: “Gulf, Yemeni-style and Shami coffee, and dates for the table” (no “Coffee from Yemen”).', links: [{ label: 'Home (AR)', href: '/ar/' }, { label: 'Home (EN)', href: '/en/' }] },
      { id: 'link-preview', text: 'Send the shop link in WhatsApp: the preview text does not start with “[address]”.', links: [{ label: 'Shop (EN)', href: '/en/shop/' }] },
      { id: 'arabic-sizes', text: 'Arabic pages: bag sizes read ٢٥٠ غ and ١٠٠ غ (Gulf coffee, Qishr, tasting boxes).', links: [{ label: 'Gulf coffee (AR)', href: '/ar/shop/gulf/' }, { label: 'Qishr (AR)', href: '/ar/shop/qishr/' }] },
      { id: 'saffron-hero', text: 'Arabic homepage: the saffron packet next to the Najdi bag is fully visible, not cut at the edge.', links: [{ label: 'Home (AR)', href: '/ar/' }] },
      { id: 'eid-heading', text: 'English Eid page: عيدكم مبارك first and large, “Eid Mubarak” smaller under it.', links: [{ label: 'Eid (EN)', href: '/en/eid/' }] },
    ],
  },
  {
    id: '2-3', title: 'Round 2 · batch 3: shop page behaviour', date: '2026-10-04',
    checks: [
      { id: 'sticky-style', text: 'On a phone, Gulf coffee page: scroll down; the bar at the bottom names the style that will be added (Najdi) and its price, and changes when you pick another.', links: [{ label: 'Gulf coffee (AR)', href: '/ar/shop/gulf/' }, { label: 'Gulf coffee (EN)', href: '/en/shop/gulf/' }] },
      { id: 'hidden-tabs', text: 'Hide Qishr in Products: the Qishr tab disappears from the shop. Hide a pack: its “pack by itself” links disappear. Show them again after.', links: [{ label: 'Shop (AR)', href: '/ar/shop/' }, { label: 'Shop (EN)', href: '/en/shop/' }] },
      { id: 'shami-dual', text: 'Arabic shop: the Shami card says “خياران”.', links: [{ label: 'Shop (AR)', href: '/ar/shop/' }] },
      { id: 'cart-cents', text: 'Once a price has cents: the cart and the cart drawer show prices like $15.40, not long decimals.', links: [{ label: 'Cart (EN)', href: '/en/cart/' }] },
      { id: 'words-origin', text: 'Admin → Shop → Words → Products: each style has “Where it comes from”, editable.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'decisions', title: 'Decisions page for the owners', date: '2026-10-04',
    checks: [
      { id: 'decisions-tab', text: 'Settings → Decisions: the open questions (Rada’i and Baydani, nuts, Yemeni styles at launch, Qassimi milk, delivery edges, mailing address, Running low email). Answer one and save: it shows who answered and when.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'taste-gulf-milk', text: 'Taste the Gulf: the how-to says you add evaporated milk yourself for the Qassimi pot.', links: [{ label: 'Taste the Gulf (AR)', href: '/ar/shop/taste-gulf/' }, { label: 'Taste the Gulf (EN)', href: '/en/shop/taste-gulf/' }] },
    ],
  },
  {
    id: '2-2', title: 'Round 2 · batch 2: allergen information', date: '2026-10-04',
    checks: [
      { id: 'card-allergy', text: 'Shop: every style and pack card has an allergen line, including “Allergens confirmed with the final recipe” for Qassimi, Hijazi and Hadrami.', links: [{ label: 'Shop (AR)', href: '/ar/shop/' }, { label: 'Shop (EN)', href: '/en/shop/' }] },
      { id: 'pair-allergy', text: 'Homepage, the coffee-and-date pairs: Rada’i shows “Contains: Sesame, Tree nuts (almonds)”, readable on the dark panel.', links: [{ label: 'Home (AR)', href: '/ar/' }, { label: 'Home (EN)', href: '/en/' }] },
      { id: 'find-milk', text: 'Find your coffee: Gulf → Qassimi → Milk shows a warning and suggests plain Gulf coffee.', links: [{ label: 'Find (AR)', href: '/ar/find/' }, { label: 'Find (EN)', href: '/en/find/' }] },
      { id: 'faq-barley', text: 'Visit → Allergens: mentions possible barley in the Qassim blend and that Hadrami and Hijazi are still to confirm.', links: [{ label: 'Visit (AR)', href: '/ar/visit/' }, { label: 'Visit (EN)', href: '/en/visit/' }] },
    ],
  },
  {
    id: '2-1', title: 'Round 2 · batch 1: saffron, packs and tasting boxes', date: '2026-10-04',
    checks: [
      { id: 'dallah-serve', text: 'Brew guide, Gulf coffee: brewed in a small pot, poured into the dallah (or a thermos) to serve; the coarse grind reads “Coarse, for Gulf coffee”.', links: [{ label: 'Brew (AR)', href: '/ar/brew/' }, { label: 'Brew (EN)', href: '/en/brew/' }] },
      { id: 'evaporated-milk', text: 'Qassimi (product page, brew guide, FAQ): customers add evaporated milk, amount [TBD].', links: [{ label: 'Qassimi (AR)', href: '/ar/shop/qassimi/' }, { label: 'Qassimi (EN)', href: '/en/shop/qassimi/' }] },
      { id: 'brew-saffron', text: 'Brew guide, Gulf coffee: the saffron is soaked and put in the serving dallah at the end, never boiled; Qassimi milk says when it goes in is [TBD].', links: [{ label: 'Brew (AR)', href: '/ar/brew/' }, { label: 'Brew (EN)', href: '/en/brew/' }] },
      { id: 'tasting-howto', text: 'Taste the Gulf and Taste Yemen: “one small pack per pot, one style at a time”.', links: [{ label: 'Taste the Gulf (AR)', href: '/ar/shop/taste-gulf/' }, { label: 'Taste Yemen (EN)', href: '/en/shop/taste-yemen/' }] },
      { id: 'najdi-howto', text: 'Najdi, Qassimi, Hijazi: the how-to says the saffron stays sealed and goes in at the end of each pot.', links: [{ label: 'Najdi (AR)', href: '/ar/shop/najdi/' }, { label: 'Qassimi (EN)', href: '/en/shop/qassimi/' }] },
      { id: 'just-the-pack', text: 'Homepage, “Just the pack”: “Have a fresh plain bag? Take its pack on its own.”', links: [{ label: 'Home (AR)', href: '/ar/' }, { label: 'Home (EN)', href: '/en/' }] },
    ],
  },
  {
    id: '1b-6', title: 'Round 1b · batch 6: shared login rights', date: '2026-10-04',
    checks: [
      { id: 'shared-role', text: 'On hello@, pick a person who was added as Helper: Refunds, Settings, Gift cards and Numbers are not there. Pick an owner (their own email is an owner email): everything is there.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
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
