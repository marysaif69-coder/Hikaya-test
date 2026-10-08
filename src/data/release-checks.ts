// What to check on the preview after each release, shown in the desk under Settings → IT.
// Add a release at the top after every batch is pushed. Keep each check's id unchanged once
// published: the ticks (who checked it, and when) are saved against it.
export type Check = { id: string; text: string; links?: { label: string; href: string }[] };
export type Release = { id: string; title: string; date: string; checks: Check[] };

export const RELEASES: Release[] = [
  {
    id: 'pack-final-14', title: 'Pack v9: the dates label is 100 × 170 (packed in Saudi Arabia), and the clear covers have their sizes', date: '2026-10-08',
    checks: [
      { id: 'pack14-calc', text: 'Desk → Numbers → Packaging: the E12 row reads “100 × 170 everyday dates bag …”, still 1,700 labels with the starting numbers, now 8 rolls. Under Boxes, three new “Cover” rows: D24 and D12 size 160, C12 size 110, B5 size 620.', links: [{ label: 'Desk', href: '/admin' }] },
      { id: 'pack14-decision', text: 'Settings → Decisions: “Origin on the date boxes” ends with the dates bags being packed in Saudi Arabia and their sticker being 100 × 170; “From the everyday dates supplier” asks for each bag’s front size for one 100 × 170 label.', links: [{ label: 'Desk', href: '/admin' }] },
    ],
  },
  {
    id: 'pack-final-13', title: 'The everyday dates label is 100 × 130 (E12): 100 × 100 cannot hold everything at the legal sizes', date: '2026-10-08',
    checks: [
      { id: 'pack13-calc', text: 'Desk → Numbers → Packaging, label rolls: E1b now reads “100 × 100 coffee back, spice packs”, and a new row E12 “100 × 130 everyday dates bag, on the front: everything on one label …”, one per dates bag. With the starting numbers: E1b 1,500 and E12 1,700, about 12,500 labels in all.', links: [{ label: 'Desk', href: '/admin' }] },
      { id: 'pack13-decision', text: 'Settings → Decisions → “Origin on the date boxes”: the explanation ends with the dates bag sticker being 100 × 130 (E12).', links: [{ label: 'Desk', href: '/admin' }] },
    ],
  },
  {
    id: 'legal-1', title: 'Legal answers researched (no lawyer); who sells shows on the website and in every email', date: '2026-10-08',
    checks: [
      { id: 'legal1-footer', text: 'Any page, the bottom line: “© 2026 Hikaya Coffee Ltd. · Calgary, Alberta”. Once Settings → Business details has the pickup address and the phone, it shows the full address and the phone instead (the phone opens a call on a phone).', links: [{ label: 'Home (EN)', href: '/en/' }, { label: 'Desk', href: '/admin/' }] },
      { id: 'legal1-checkout', text: 'Checkout, just above “Send my pre-order”: “Sold by Hikaya Coffee Ltd. · …”, the refund line (food can’t be taken back; damaged or wrong: tell us within 48 hours) and “All our policies”. The same in Arabic.', links: [{ label: 'Checkout (EN)', href: '/en/checkout/' }, { label: 'Checkout (AR)', href: '/ar/checkout/' }] },
      { id: 'legal1-emails', text: 'Place a test order: the confirmation email ends with the refund line and “Our policies”, and its grey footer has “Hikaya Coffee Ltd. · address · phone”.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'legal1-decisions', text: 'Settings → Decisions: the origin on the date boxes, the cloth tote and the website contact now start with “Researched (no lawyer)” and give the answer with the rule it comes from.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'pack-final-12', title: 'China order: customs, delivery and the label printer model', date: '2026-10-07',
    checks: [
      { id: 'pack12-decisions', text: 'Settings → Decisions: three new items. Under China order, “Who brings the China order through Canadian customs” and, in What we need from you, “Where should the China order be delivered”. Under Labels, “Which Epson CW-C4000 do you have”.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'pack-final-11', title: 'The brew page has a guide for the Yemeni beans (the QR code on their pouch lands there too)', date: '2026-10-07',
    checks: [
      { id: 'pack11-brew', text: 'How to brew: a fifth card “Yemeni beans” with a small black and gold pouch opens “Yemeni beans, by pour-over”: five steps with timers 0:30, 0:40 and 2:30, the grams and the water still [TBD] (your recipe goes in Words). The same in Arabic (“بن اليمن، بالتقطير”). The address ending #beans opens it straight away.', links: [{ label: 'Brew (EN)', href: '/en/brew/#beans' }, { label: 'Brew (AR)', href: '/ar/brew/#beans' }] },
      { id: 'pack11-hidden', text: 'If the three Yemeni beans are hidden in Desk → Shop → Products, the Yemeni beans card does not show on How to brew and the page opens on Gulf coffee.', links: [{ label: 'Brew (EN)', href: '/en/brew/' }] },
      { id: 'pack11-words', text: 'Desk → Shop → Words → Recipes (brew guides): “Yemeni beans, by pour-over” is there to edit. Put in the grams after the cupping.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'pack-final-10', title: 'The coffee-style sticker is a regular round Hikaya sticker (no band); box bottom labels clear of the band', date: '2026-10-07',
    checks: [
      { id: 'pack10-calc', text: 'Desk → Numbers → Packaging: type 400 in “Coffee styles and tasting sets”. The E13 row reads “Ø50 round Hikaya sticker, removable glue …” with 500 to order on one roll (not a 40 × 300 strip).', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack10-decision', text: 'Settings → Decisions → “The sticker that holds a style together”: it says a round Ø50 sticker at the top of the back, folding over onto the front above the tear-off line, and no band.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'pack-final-9', title: 'Qishr fills the same pouch (weight from your fill test); the small box gets its own side label', date: '2026-10-07',
    checks: [
      { id: 'pack9-calc', text: 'Desk → Numbers → Packaging with the brief’s numbers: the field reads “Qishr pouches (the 250 g pouch; weight set by your fill test), count”; E5 “gift box B1 side” 400; a new row E14 “100 × 20 small box B5 side” 700; labels in total 12,400.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack9-decisions', text: 'Settings → Decisions → What we need from you: “Qishr: how much fits the bag” is listed.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'pack-final-8', title: 'No box for the coffee styles: our sticker holds the bag and its packs together', date: '2026-10-07',
    checks: [
      { id: 'pack8-words', text: 'Shop → Coffee: the line under the styles says “the bag and its packs together, held with our sticker” (no “one box”), in English and Arabic; the same on the home page step “2 · How you take it”.', links: [{ label: 'Shop (EN)', href: '/en/shop/' }, { label: 'Shop (AR)', href: '/ar/shop/' }, { label: 'Home (AR)', href: '/ar/' }] },
      { id: 'pack8-visit', text: 'Visit → “Why is the saffron separate?”: it always comes with Najdi (no “Najdi box”); Our recipes, the Najdi line, the same in Arabic.', links: [{ label: 'Visit (EN)', href: '/en/visit/' }, { label: 'Our recipes (AR)', href: '/ar/our-recipes/' }] },
      { id: 'pack8-calc', text: 'Desk → Numbers → Packaging: no K1 row. Type 400 in “Coffee styles and tasting sets”: a label row E13 (40 × 300 Hikaya sticker) appears with 500; E1 and E5 do not change.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack8-decision', text: 'Settings → Decisions: “What we need from you” lists the sticker that holds a style together; the box question says you answered no box.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'pack-final-7', title: 'Every coffee is 250 g except the Yemeni beans (100 g); the everyday dates take one label, on the front', date: '2026-10-07',
    checks: [
      { id: 'pack7-qishr', text: 'Qishr page: the size reads 250 g / ٢٥٠ غ (not 100 g).', links: [{ label: 'Qishr (EN)', href: '/en/shop/qishr/' }, { label: 'Qishr (AR)', href: '/ar/shop/qishr/' }] },
      { id: 'pack7-yemen', text: 'Shop → Yemeni beans tab and a Yemeni beans page (if shown): still 100 g in the black and gold pouch (the special beans from Yemen), in English and Arabic; the drawing shows 100 g.', links: [{ label: 'Shop (EN)', href: '/en/shop/' }, { label: 'Shop (AR)', href: '/ar/shop/' }] },
      { id: 'pack7-calc', text: 'Desk → Numbers → Packaging with the brief’s numbers: A3 “100 g Yemeni pouch” 1,100, Yemeni tags 1,100, E7/E8/E9 1,100 each, E3 “box bottom” 1,100 (the dates bags no longer take a back label), labels in total 12,300.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'pack-final-6', title: 'The shop shows the packaging you chose: the red band, the Yemeni pouch with its tag', date: '2026-10-07',
    checks: [
      { id: 'pack6-band', text: 'A gift box page (Coffee & Dates): the drawing shows a red band (not gold) with our round seal on it, and the text says “red band” / “الحزام الأحمر”. Choose the Ramadan sticker: a dark round sticker with a gold crescent appears on the band; Eid: a gold round sticker.', links: [{ label: 'Coffee & Dates (EN)', href: '/en/shop/guest-box/' }, { label: 'Coffee & Dates (AR)', href: '/ar/shop/guest-box/' }] },
      { id: 'pack6-words', text: 'No “gold band” or “الحزام الذهبي” left: Shop → Gift boxes heading line, Two Coffees “What is inside”, the Ramadan and Eid pages, and the box builder.', links: [{ label: 'Shop (EN)', href: '/en/shop/' }, { label: 'Ramadan (AR)', href: '/ar/ramadan/' }, { label: 'Eid (AR)', href: '/ar/eid/' }] },
      { id: 'pack6-pouch', text: 'A Yemeni beans page (if shown): the drawing is the black and gold pouch with the round gold region sticker and the gold tag beside it, not a black box.', links: [{ label: 'Shop (EN)', href: '/en/shop/' }] },
      { id: 'pack6-desk', text: 'Desk → week sheet → Packaging: rows read “250 g pouches (A1)”, “… for qishr, 100 g each”, “Black and gold pouches + tags (A3, Yemeni beans)”, “Everyday dates, clear bag”, “Red bands (B4)”.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack6-ask', text: 'Ask Hikaya: “What colour is the gift box band?” answers red, not gold. (The handbook changed: run the Ask Hikaya eval.)', links: [{ label: 'Ask (EN)', href: '/en/help/?ask=1' }] },
    ],
  },
  {
    id: 'pack-final-5', title: 'Everything the shop sells is now in the packaging: a style box, single-date wrappers', date: '2026-10-07',
    checks: [
      { id: 'pack5-calc', text: 'Desk → Numbers → Packaging: two new fields, “Coffee styles and tasting boxes” and “Stuffed dates, each wrapped”. Type 400 and 3,000: rows K1 (style box), S1 (wrapper) and the E11 label roll appear with orders, and E1 and E5 go up.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack5-decisions', text: 'Settings → Decisions: two new items, “The box for the styles” and “Reserve box of 12”.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack5-bag', text: 'An Everyday dates page: “… of one variety in a clear bag” (not a tray), in English and Arabic.', links: [{ label: 'Everyday dates', href: '/en/shop/date-box/' }] },
    ],
  },
  {
    id: 'pack-final-4', title: 'Qishr in the packaging calculator; one more owner question (origin on the date boxes)', date: '2026-10-07',
    checks: [
      { id: 'pack4-qishr', text: 'Desk → Numbers → Packaging: a new field “Qishr 100 g (in the 250 g pouch), count”. Type 200: the 250 g pouches (A1), the front stickers (E1) and the back stickers (E1b) each go up by about 200. Back to the brief’s numbers puts it at 0.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack4-origin', text: 'Settings → Decisions: a new item “Origin on the date boxes” (a question for the lawyer).', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack4-qishr-fr', text: 'Qishr page → Ingredients in French: “Écorces de cerise de café, gingembre.” (not “Cascara”, which in Canada reads as the laxative herb).', links: [{ label: 'Qishr', href: '/en/shop/qishr/' }] },
    ],
  },
  {
    id: 'pack-final-3', title: 'Final packaging check: calculator matches the China brief, QR addresses tested, six new questions', date: '2026-10-07',
    checks: [
      { id: 'pack3-rolls', text: 'Desk → Numbers → Packaging with the brief’s numbers: label rolls read E1 1,100 · E1b 3,100 · E2 1,000 · E3 2,700 · E6 700 · E7/E8/E9 1,100, and the sleeves show two rows, B1 310 and B5 620.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack3-decisions', text: 'Settings → Decisions: six new items at the top (QR codes while the site is closed, Yemeni pouch only for Yemen-grown coffee, exact company name, stuffed box labels, boxes in the bags, tote label).', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'pack3-beans', text: 'Shop → Yemeni beans tab and a Yemeni beans page: the text says “black and gold pouch”, not “black box”.', links: [{ label: 'Shop (EN)', href: '/en/shop/' }, { label: 'Shop (AR)', href: '/ar/shop/' }] },
    ],
  },
  {
    id: 'pack-calc-2', title: 'Packaging calculator: dates get a front and a back sticker, boxes a side label, small packs two stickers', date: '2026-10-06',
    checks: [
      { id: 'pack-calc-rolls', text: 'Desk → Numbers → Packaging: the label rolls list E1b “250 g backs + spice packs + dates fronts”, E3 “dates backs + box bottoms”, a new E5 box side label, and E6 “front and back of each small pack”.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'ask-qr-1', title: 'hikayacoffee.ca/ask opens Ask Hikaya on the help page (for the QR code on the pouches); a packaging calculator in the desk', date: '2026-10-06',
    checks: [
      { id: 'ask-qr-open', text: 'Open /ask on a phone: it lands on the help page (How can we help) with Ask Hikaya already open, and the address bar shows no “?ask”. An Arabic phone lands on the Arabic page.', links: [{ label: '/ask', href: '/ask' }] },
      { id: 'ask-qr-brew', text: '/brew still opens the brew guides (the other QR code).', links: [{ label: '/brew', href: '/brew' }] },
      { id: 'pack-calc', text: 'Desk → Numbers → Packaging: change the kilos of coffee or dates and the counts of pouches, boxes, bags and label rolls change with them. “Back to the brief’s numbers” resets them.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: 'label-line', text: 'A coffee page → Ingredients: the last line reads “Hikaya Coffee Ltd., Calgary, Alberta, Canada” (no “Made in Calgary”, no [address]).', links: [{ label: 'Shop (EN)', href: '/en/shop/' }] },
      { id: 'dec-new', text: 'Settings → Decisions: three new items (website address and phone, pickup without a location, what we need from the dates supplier).', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'gift-cards-1', title: 'The thank-you card: a name on every order, and the date guide', date: '2026-10-05',
    checks: [
      { id: 'gift-checkout', text: 'Checkout → You: “Name on the thank-you card” fills in with your name as you type it, and can be changed for someone else (up to 25 characters). There is no gift section or note any more.', links: [{ label: 'Checkout (EN)', href: '/en/checkout/' }, { label: 'الدفع (AR)', href: '/ar/checkout/' }] },
      { id: 'gift-slip', text: 'Desk → Day sheet → Packing slips: each slip has “In the box” with the thank-you card and the name to print with the date coder, and the date guide for orders with dates (not for Two Coffees). An order with someone else’s name on the card says “no prices in the bag”.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'eid-film-1', title: 'Eid page: the film plays in the page; Coffee & Dates in the Eid edition', date: '2026-10-05',
    checks: [
      { id: 'eid-film-inline', text: 'Eid page: the film plays by itself in the page (no pop-up), the whole frame shows and it fits the screen without scrolling, on a laptop and a phone. It pauses when you scroll away.', links: [{ label: 'Eid (EN)', href: '/en/eid/' }, { label: 'العيد (AR)', href: '/ar/eid/' }] },
      { id: 'eid-film-sound', text: 'Sound: on a first visit the music may play once (only if the browser allows it, e.g. after clicking a link on the site), then it goes silent and keeps looping. The “Sound on / Mute” button on the film works at any time; later visits start silent.', links: [{ label: 'Eid (EN)', href: '/en/eid/' }] },
      { id: 'eid-guest-box', text: 'The Eid edition list starts with Coffee & Dates (12 dates and a coffee pouch) with the Eid band, then Stuffed 12 and 24.', links: [{ label: 'Eid boxes', href: '/en/eid/#eid-boxes' }] },
    ],
  },
  {
    id: 'address-change-1', title: 'Change the delivery address of an order (customers and the team)', date: '2026-10-05',
    checks: [
      { id: 'addr-customer', text: 'Place a test delivery order, then in My account press “Change address” (غيّر العنوان), type a new street with unit and buzz code and a Calgary postal code, and save. The order shows the new address and an email “New address for order …” arrives.', links: [{ label: 'My account (EN)', href: '/en/account/' }, { label: 'حسابي (AR)', href: '/ar/account/' }] },
      { id: 'addr-limits', text: 'A postal code outside Calgary is refused, and a pickup order has no “Change address” button. After the day’s order deadline the customer is told to reply to the confirmation email.', links: [{ label: 'My account', href: '/en/account/' }] },
      { id: 'addr-desk', text: 'Desk: open the order, “Change delivery address”, save a new one. It works until the order is delivered; the order history shows old → new address, and the driver gets a notice if one is assigned.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: 'design-1', title: 'Design: the Dates tab on a laptop, the dark Yemeni beans band, speech-bubble corners', date: '2026-10-04',
    checks: [
      { id: 'design-tier-art', text: 'On a laptop, Shop → Dates: next to the cards, a drawing of the box for that tier (clear tray, Reserve box, Stuffed box). On a phone it is hidden.', links: [{ label: 'Dates (EN)', href: '/en/shop/#reserve' }] },
      { id: 'design-beans-dark', text: 'Shop → بن اليمن: the page stays light like the other tabs; the three boxes sit on black cards, the slogan and the three facts have gold accents.', links: [{ label: 'Yemeni beans (AR)', href: '/ar/shop/#beans' }] },
      { id: 'design-corners', text: 'The new cards (dates, Reserve and Stuffed, the homepage dates, the Iftar and Eid boxes) have the one small speech-bubble corner like the rest of the site.', links: [{ label: 'Home (AR)', href: '/ar/' }, { label: 'Ramadan (EN)', href: '/en/ramadan/' }] },
    ],
  },
  {
    id: 'site-review-1', title: 'Site review: homepage dates and Yemeni beans, team bar, old names', date: '2026-10-04',
    checks: [
      { id: 'home-dates', text: 'Homepage: “وتمر بجانب الفنجان · And a date beside the cup”, three cards (Everyday, Reserve, Stuffed) that open their tab in the shop.', links: [{ label: 'Home (AR)', href: '/ar/' }, { label: 'Home (EN)', href: '/en/' }] },
      { id: 'home-beans', text: 'Homepage: the black “بن اليمن · من مزارعنا” band with a button to the Yemeni beans; it disappears when you hide the three bean products.', links: [{ label: 'Home (AR)', href: '/ar/' }] },
      { id: 'team-bar', text: 'The team bar at the top of the preview says what customers see (e.g. “Phase 0 · Something is brewing”), never “undefined”.', links: [{ label: 'Home', href: '/en/' }] },
    ],
  },
  {
    id: 'shop-4-tabs', title: 'Shop: four tabs (Coffee, Dates, Gift boxes, Yemeni beans)', date: '2026-10-04',
    checks: [
      { id: 'tabs-4', text: 'Shop: four tabs, القهوة · Coffee, التمر · Dates, علب الهدايا · Gift boxes and بن اليمن · Yemeni beans (shown for now so you can look; hide all three bean products in Admin → Shop → Products and the tab goes away).', links: [{ label: 'Shop (AR)', href: '/ar/shop/' }, { label: 'Shop (EN)', href: '/en/shop/' }] },
      { id: 'tabs-gifts', text: 'Gift boxes tab: Coffee & Dates, Two Coffees, Reserve, Stuffed, Four Palms. “A gift?” on the Dates tab opens it.', links: [{ label: 'Gift boxes (EN)', href: '/en/shop/#gifts' }] },
      { id: 'tabs-beans', text: 'Yemeni beans tab: “بن اليمن”, the slogan “من مزارعنا · From our farms”, “where the story of coffee began”, three facts (cupped and scored, for pour-over, small lots) and three black boxes; each product page shows the cupping score and pour-over recipe as [TBD] for now.', links: [{ label: 'Desk', href: '/admin/' }, { label: 'Haraz page', href: '/en/shop/yemen-haraz/' }] },
    ],
  },
  {
    id: '4-1', title: 'Round 4: Story page and Bunn & Tamr page', date: '2026-10-04',
    checks: [
      { id: '4-1-decisions-groups', text: 'Settings → Decisions: two lists, “What we need from you” (photos, address, prices, labels, words) and “Questions”, each in groups by type (Coffee, Dates, Gift boxes, Ramadan and Eid…) that open and close, with how many are still open.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: '4-1-dates-tabs', text: 'Shop → Dates: tap Everyday, Reserve or Stuffed: only that one shows. Inside, pick a kind (e.g. Mixed): only its card shows, with 12 / 24 (or 250 g / 500 g / 1 kg) and Add.', links: [{ label: 'Dates (EN)', href: '/en/shop/#dates' }, { label: 'Reserve (AR)', href: '/ar/shop/#reserve' }] },
      { id: '4-1-stuffed-art', text: 'Stuffed dates: each filling has its own drawing (opened lengthwise with the filling in the middle; the dipped one coated from one end), and the Stuffed box drawing shows them.', links: [{ label: 'Stuffed (EN)', href: '/en/shop/#stuffed' }, { label: 'Stuffed 12', href: '/en/shop/stuffed-12/' }] },
      { id: '4-1-bt-phone', text: 'Bunn & Tamr on a phone: the English lines are readable under each card (not tiny inside the bubbles).', links: [{ label: 'Bunn & Tamr (EN)', href: '/en/bunn-and-tamr/' }, { label: 'Bunn & Tamr (AR)', href: '/ar/bunn-and-tamr/' }] },
      { id: '4-1-bt-save', text: 'Tap “Save image” on a card and open the picture: 1080 × 1350, the English words spaced normally (“Sukkari”, not “S ukkari”).', links: [{ label: 'Bunn & Tamr (EN)', href: '/en/bunn-and-tamr/' }] },
      { id: '4-1-cards', text: 'Cards no longer name a date for a coffee; card 5 says “Qassimi: add your evaporated milk…”.', links: [{ label: 'Bunn & Tamr (AR)', href: '/ar/bunn-and-tamr/' }] },
      { id: '4-1-story', text: 'Story page: the Arabic page shows القهوة / التمرة under بُن and تمر; the dates show Everyday and Reserve, Arabic names first; the timeline says “Soon” and “When our permits are in” (no months).', links: [{ label: 'Story (AR)', href: '/ar/story/' }, { label: 'Story (EN)', href: '/en/story/' }] },
      { id: '4-1-motion', text: 'Story page with “Reduce motion” on (phone settings): all five logo captions show as a list.', links: [{ label: 'Story (EN)', href: '/en/story/' }] },
      { id: '4-1-preview', text: 'Share the story page link in a chat: the preview text is about Hikaya, not “[address]”.' },
    ],
  },
  {
    id: '3-4', title: 'Round 3 · batch 4: Ramadan and Eid pages, Ask Hikaya, stickers, and choices on the Dates tab', date: '2026-10-04',
    checks: [
      { id: '3-4-dates-cards', text: 'Shop → Dates: Reserve and Stuffed now work like Everyday: a card for each kind (and Mixed) with 12 / 24 and its own Add button.', links: [{ label: '#reserve (AR)', href: '/ar/shop/#reserve' }, { label: '#dates (EN)', href: '/en/shop/#dates' }] },
      { id: '3-4-stickers', text: 'Gift box pages: “Occasion · المناسبة”: Any day, Ramadan sticker or Eid sticker (the gold band stays). No “Ramadan sleeve” anywhere.', links: [{ label: 'Coffee & Dates (AR)', href: '/ar/shop/guest-box/' }] },
      { id: '3-4-art', text: 'Date boxes show a drawing of our real box (the B1 lid with the gold khalal sleeve and seal, open beside what is inside: coffee and 12 dates, two coffees, 12 or 24 dates, stuffed dates sealed one by one), and the Everyday dates a clear tray. They stay until there are photos.', links: [{ label: 'Gift boxes (EN)', href: '/en/shop/#gifts' }] },
      { id: '3-4-ramadan', text: 'Ramadan page: “علبة الإفطار · The Iftar Box” first, then Two Coffees, Reserve and Stuffed with the Ramadan sticker; the top line now says to choose 11–2 or 2–5 for delivery before iftar.', links: [{ label: 'Ramadan (AR)', href: '/ar/ramadan/' }, { label: 'Ramadan (EN)', href: '/en/ramadan/' }] },
      { id: '3-4-eid', text: 'Eid page: “ضيافة العيد · Eid Hosting” (Reserve 24, Mixed, opens with Mixed and the Eid sticker chosen), then “The visit gift” (Two Coffees), then Stuffed; the order-by line for the last day before Eid shows.', links: [{ label: 'Eid (AR)', href: '/ar/eid/' }, { label: 'Eid (EN)', href: '/en/eid/' }] },
      { id: '3-4-hash', text: 'Old shop links /shop/#ramadan and /shop/#eid open the Ramadan and Eid pages.', links: [{ label: '#ramadan', href: '/en/shop/#ramadan' }] },
      { id: '3-4-ask', text: 'Ask Hikaya: “What dates do you have?”, “Do you have a Ramadan box?” (same gift boxes with the Ramadan sticker), “When do I order for Eid?”.' },
      { id: '3-4-decisions', text: 'Settings → Decisions: ten new questions for round 3 (prices, Ramadan deliveries, Thirty Nights, stickers, names, may-contain-nuts and more).', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: '3-3', title: 'Round 3 · batch 3: four gift boxes with Mixed, and the Ramadan and Eid stickers', date: '2026-10-04',
    checks: [
      { id: '3-3-coffee-dates', text: 'Coffee & Dates: choose the coffee (Najdi, Hadrami…) and the Reserve dates (one kind or Mixed, 4 of each); add it: the cart says e.g. “Najdi · Mixed Reserve”.', links: [{ label: 'Coffee & Dates (AR)', href: '/ar/shop/guest-box/' }, { label: 'Coffee & Dates (EN)', href: '/en/shop/guest-box/' }] },
      { id: '3-3-two-coffees', text: 'Two Coffees: two coffee choices, first and second.', links: [{ label: 'Two Coffees (EN)', href: '/en/shop/coffee-duo/' }] },
      { id: '3-3-mixed', text: 'Reserve 24 and Stuffed 12 offer Mixed (8 of each; 3 of each with its allergens).', links: [{ label: 'Reserve 24 (AR)', href: '/ar/shop/reserve-24/' }, { label: 'Stuffed 12 (EN)', href: '/en/shop/stuffed-12/' }] },
      { id: '3-3-sleeves', text: 'Gift boxes have an Occasion choice (المناسبة): Any day, or our Ramadan or Eid sticker on the same gold band. Ramadan and Eid show only while that season is on (Admin → Shop → Products, top). From the Ramadan page, a box opens with the Ramadan sticker picked.', links: [{ label: 'Ramadan (AR)', href: '/ar/ramadan/' }, { label: 'Eid (EN)', href: '/en/eid/' }] },
      { id: '3-3-retired', text: 'The old seasonal boxes are gone from the shop and the Products list (Iftar Pair, Ramadan Date Box, Eid Coffee & Dates, Eid Dates, Eid Coffee Duo). An old link such as /en/shop/iftar-pair/ goes to Coffee & Dates with the Ramadan sticker.', links: [{ label: 'Old Iftar Pair link', href: '/en/shop/iftar-pair/' }] },
      { id: '3-3-desk', text: 'Desk: an order with the Ramadan sticker shows “· Ramadan sticker” on the order and on the packing slip; the week sheet counts gold sleeves for every gift box and “Ramadan stickers (Ø50)” apart.', links: [{ label: 'Desk', href: '/admin/' }] },
      { id: '3-3-prices', text: 'Admin → Shop → Products: Coffee & Dates and Two Coffees now say “no price” (their old draft prices were for fixed contents). Set them when you are ready.', links: [{ label: 'Desk', href: '/admin/' }] },
    ],
  },
  {
    id: '3-2', title: 'Round 3 · batch 2: Shop: Coffee | Dates tabs', date: '2026-10-04',
    checks: [
      { id: '3-2-tabs', text: 'Shop opens on Coffee. Tap “Dates · التمر”: three cards (Everyday, Reserve with “Our pick”, Stuffed), then the sections below.', links: [{ label: 'Shop (AR)', href: '/ar/shop/' }, { label: 'Shop (EN)', href: '/en/shop/' }] },
      { id: '3-2-hash', text: 'A link straight to the dates opens the Dates tab: try /shop/#dates and /shop/#reserve. /shop/#yemen still opens the Yemen coffee.', links: [{ label: '#dates (AR)', href: '/ar/shop/#dates' }, { label: '#reserve (EN)', href: '/en/shop/#reserve' }, { label: '#yemen (EN)', href: '/en/shop/#yemen' }] },
      { id: '3-2-sizes', text: 'Everyday dates: on Khalas and on Sukkari Qassimi, tap 250 g, 500 g, 1 kg: the price and the Add button follow (“Price coming” until you set prices).', links: [{ label: 'Everyday (EN)', href: '/en/shop/#everyday' }] },
      { id: '3-2-gifts', text: '“A gift? Boxes with coffee” goes down to the gift boxes (Guest Box, Coffee Duo, Four Palms); Ramadan and Eid show last, only in their season.', links: [{ label: 'Gifts (AR)', href: '/ar/shop/#gifts' }] },
      { id: '3-2-pages', text: 'Product pages: Reserve 12 shows where each date comes from and “Our pick”; Everyday 1 kg shows “Also in 250 g, 500 g”.', links: [{ label: 'Reserve 12 (AR)', href: '/ar/shop/reserve-12/' }, { label: '1 kg (EN)', href: '/en/shop/dates-1kg/' }] },
      { id: '3-2-cart', text: 'Put only a coffee in the cart: the cart says “Add dates for your coffee” with a link to the dates.', links: [{ label: 'Cart (EN)', href: '/en/cart/' }] },
    ],
  },
  {
    id: '3-1', title: 'Round 3 · batch 1: dates in three tiers (data and server)', date: '2026-10-04',
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
