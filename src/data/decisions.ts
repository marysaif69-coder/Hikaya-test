// Questions only the owners can answer, shown in the desk under Settings → Decisions. Maryam and
// Shadi write their answer there; it is saved with who and when, and the next session reads it
// (Admin → Settings → Decisions, or GET /api/admin/decisions) before changing the site.
// Keep each id unchanged once published: the answers are saved against it. Add new ones at the top.
// kind 'provide': something the owners need to give us (photos, an address, prices, a label), not a
// question; it is listed under "What we need from you" and ticked "Given".
export type Decision = { id: string; topic: string; question: string; context: string; options?: string[]; asked: string; kind?: 'provide' };

/** The section a decision is listed under in the desk, from the first part of its topic. */
const GROUPS: Record<string, string> = { Ramadan: 'Ramadan and Eid', 'Privacy page': 'Website and emails', 'Story page': 'Website and emails', Emails: 'Website and emails', 'Mailing list': 'Website and emails', 'Delivery area': 'Delivery', Business: 'Website and emails', 'Food safety': 'Permits and food safety' };
export const groupOf = (d: Decision) => { const first = d.topic.split(' · ')[0]; return GROUPS[first] ?? first; };

export const DECISIONS: Decision[] = [
  {
    id: 'divider-strips', topic: 'Dates · Divider strips', asked: '2026-10-08',
    question: 'Try the divider strip samples with your dates, then confirm the strips for the first order (before 13 November).',
    context: 'The dividers are now loose strips by type (pack v14), never put together at the factory: we slot them together when we pack. One long type (cells along the box) with one short type (cells across) makes a grid, so 7 strip types for B1 and 4 for B5 make every layout, and D24 to D30 is one strip type swapped. The first order counts D24 (3 × B1-L6 + 5 × B1-S4) and D12 (2 × B1-L4 + 3 × B1-S3) for the gift boxes, 60 % and 40 %, and B5 (a) (1 × B5-L3 + 2 × B5-S2) for the small boxes: 3,800 strips in 6 types. The factory sends 20 of every type with the samples, cut without a die, so a changed slot or cell count costs nothing.',
    options: ['As counted', 'Other grids or another split (write which)', 'Change the cells after the samples (write how)'],
  },
  {
    id: 'china-customs', topic: 'China order · Customs', asked: '2026-10-07',
    question: 'Who brings the China order through Canadian customs: the factory’s DDP agent, or our own customs broker?',
    context: 'DDP (door to door, duty paid): the factory’s agent is the importer and pays the duty and the 5% GST. It is the simplest, but we cannot claim that GST back, and if the agent declares a lower value the shipment can be held. Our own broker (the factory quotes to Calgary without customs, “DAP”): we need a CRA business number with an import-export (RM) account and the CBSA CARM portal. Since 20 May 2025 goods come out before the duty is paid only if we post our own security (a bond); without one we pay the duty and GST first, then the goods are released. Either way the factory must give an HS code and the true value for each item (the brief asks for both).',
    options: ['DDP: the factory’s agent clears it', 'Our own customs broker', 'Decide when the quotes come in'],
  },
  {
    id: 'china-delivery', kind: 'provide', topic: 'China order · Delivery in Calgary', asked: '2026-10-07',
    question: 'Where should the China order be delivered, and who receives it?',
    context: 'About 40 cartons: about 3.5 m³ and 500 kg in all, and the B1 and B5 boxes are 2.8 m³ of it (they come by sea; the rest can fly if the dates slip, which means two deliveries). The forwarder needs a Calgary address, a name and a phone number (for the shipment only; it is never printed). Keep it dry, off the floor and at room temperature: label rolls and soft-touch pouches do not like cold or damp.',
  },
  {
    id: 'label-printer-model', topic: 'Labels · Printer model', asked: '2026-10-07',
    question: 'Which Epson CW-C4000 do you have, or will you buy: Matte Black (MK) or Gloss Black (BK)?',
    context: 'Every label roll in the brief is white matte BOPP for pigment ink. That needs the Matte Black (MK) model for dark, sharp text and QR codes; the Gloss Black (BK) model is for glossy labels and is not recommended on matte ones. If yours is BK, tell us before the factories quote and we change the label material in the brief.',
    options: ['Matte Black (MK)', 'Gloss Black (BK)', 'Not bought yet: we will buy MK'],
  },
  {
    id: 'qr-codes-while-closed', topic: 'Business · QR codes on the packaging', asked: '2026-10-07',
    question: 'While the website is closed, every printed QR code (brew guides, Ask Hikaya, the thank-you card) opens the “Something is brewing” screen. What should someone who scans one see?',
    context: 'The QR codes print on 1,100 pouches of each kind and the cards. The private-preview gate covers the whole real website, so /brew and /ask show the closed screen, and Ask Hikaya cannot answer, until you open the website. That is fine if the website is open before the first pouch reaches a customer (pouches arrive about 15 January). If samples or gifts go out earlier, the brew guides and Ask Hikaya can be let through the gate on their own. Nothing changes until you choose.',
    options: ['The website will be open before any pouch reaches a customer', 'Let the brew guides and Ask Hikaya through the gate now', 'Ask me again in December'],
  },
  {
    id: 'a3-yemen-grown-only', topic: 'Coffee · Yemeni beans pouch (A3)', asked: '2026-10-07',
    question: 'The A3 pouch prints “بن اليمن · YEMENI COFFEE” and “From Yemen’s farms”. Will it only ever hold coffee grown in Yemen? (Answer by 16 October: China prints it.)',
    context: 'An origin printed on the pouch must be true for everything that goes in it (Food and Drugs Act s. 5: no misleading origin). The Gulf and Yemeni-style coffees made from Ethiopian beans must never go in this pouch; they use the 250 g pouch with our stickers, which say “Ethiopian beans”. If you might ever put other beans in A3, we change the print now to something without a country.',
    options: ['Yes: only coffee grown in Yemen', 'No: take the country off the A3 print'],
  },
  {
    id: 'legal-name-on-print', topic: 'Business · Name printed in China', asked: '2026-10-07',
    question: 'Is “Hikaya Coffee Ltd.” exactly the name on the incorporation papers? (Answer by 16 October.)',
    context: 'It is printed by the factory on the A1 and A3 pouches, so it cannot be changed after printing. The label must show the company’s real name (or a registered trade name).',
    options: ['Yes, exactly', 'No: I will write the exact name here'],
  },
  {
    id: 'coffee-bags-1000-or-2000', topic: 'China order · Coffee bags', asked: '2026-10-09',
    question: 'When the factory quotes come in: 1,000 or 2,000 coffee bags (A1, 250 g)?',
    context: 'You said in the chat (9 Oct): it depends on the price; if 2,000 costs close to 1,000, take 2,000. Brief v16 asks every factory to quote both, and plans 2,000 (2,100 with spares; 1,100 for 1,000). The E1 and E1b labels follow the bag count. Everything else in the first order is set from your answers that day (about six months of selling).',
    options: ['1,000 bags', '2,000 bags'],
  },
  {
    id: 'coffee-style-box', topic: 'Coffee · The box for the styles', asked: '2026-10-07',
    question: 'The shop said “each coffee style comes in one box, the bag and its packs together”, but the China order had no such box. Keep the box? (You answered in the chat on 7 Oct: no box, a Hikaya sticker holds them together; the shop words are changed. Tick “No box” to close this.)',
    context: 'It covers the six styles (Najdi, Qassimi, Hijazi, Hadrami, Rada’i, Baydani) and the two tasting boxes. The China brief now asks for a quote on one style box (K1): one design for every style, the 250 g bag standing with its packs in front, our 80 × 80 sticker names the style and our 100 × 40 sticker lists what is inside. Enter how many you expect in Desk → Numbers → Packaging (Coffee styles and tasting boxes). Without a box, the shop words change to “the bag and its packs together”.',
    options: ['Keep the style box (K1)', 'No box: change the shop words'],
  },
  {
    id: 'qishr-fill', kind: 'provide', topic: 'Coffee · Qishr: how much fits the bag', asked: '2026-10-07',
    question: 'Fill one 250 g coffee pouch with your qishr and weigh it: what net weight do we print on its stickers and on the shop?',
    context: 'You said in the chat (7 Oct): qishr goes in the same pouch as the coffee, you see how much fits, and the weight goes on our stickers, so the pouch does not change. Qishr is lighter and bulkier than ground coffee. Use a sample A1 pouch (or a stock pouch of the same size): fill to about 50 mm below the top edge, so the sides fold flat at the top and the zipper closes, shake it down, and weigh the qishr. Round down to a weight you can fill every time (for example 200 g). Until you answer, the shop and the sticker engine say 250 g.',
  },
  {
    id: 'bundle-sticker', kind: 'provide', topic: 'Coffee · The sticker that holds a style together', asked: '2026-10-07',
    question: 'Design the Hikaya sticker that holds a coffee style together: the 250 g bag, its spice mix and the small saffron pouch.',
    context: 'You said in the chat (7 Oct): no box; one regular Hikaya sticker holds the bag and its packs together and they go in the paper bag. No band: the red band is only for the date boxes. The China brief quotes it as label E13, a round Ø50 sticker (the same shape as the Ramadan and Eid sticker E4) on removable glue, which we print on the Epson; the factory can also quote it printed once you send the design. How it goes on: the spice mix lies on the back of the bag, its top level with the bag top, with the saffron pouch tucked behind it; the sticker goes at the top centre, on the spice mix, and its top 12 mm folds over the bag top onto the front, above the tear-off line. On the bag it touches only the part that tears off. Suggested design: cream with the logo, and a plain Tamr cap on the part that folds to the front. A style sold as one item at one price must list its parts (SFCR s. 239: how many, the common name in English and French, and the weight of each, figures 3.2 mm tall). That goes on the style’s 80 × 80 front sticker on the bag, which has room (three parts use 58 of 80 mm), so E13 stays a plain holding sticker. Enter how many styles you expect in Desk → Numbers → Packaging.',
  },
  {
    id: 'reserve-12-box', topic: 'Dates · Reserve box of 12', asked: '2026-10-07',
    question: 'Twelve Medjool dates do not fit the small box B5. Where does the Reserve box of 12 go?',
    context: 'Medjool is up to about 55 mm long. The small box B5 takes 6 large dates or 12 small or stuffed dates. Royal Sukkari Mufattal and Ajwa may fit twelve; Medjool does not. The China brief also quotes a 12-date grid for the gift box B1 (D12), so either way is quoted. Decide with the date samples.',
    options: ['B5 with 12 for Mufattal and Ajwa; Medjool only in the box of 24', 'Every Reserve box of 12 in B1 with the D12 insert', 'Decide with the samples'],
  },
  {
    id: 'box-origin-label', topic: 'Dates · Origin on the date boxes', asked: '2026-10-07',
    question: 'Researched (no lawyer): on the date boxes, “Product of Saudi Arabia / Produit d’Arabie saoudite” at 1.6 mm, bold, on the lid seal next to our name. All right?',
    context: 'Our boxes are packed by us in Calgary, so the 6.4 mm rule does not apply to them: SFCR s. 274(3) is only for processed fruit imported already packed under a Canadian importer’s own label, and dried dates may not even count as a “processed fruit or vegetable product” (the SFCR definition needs a standard, a grade or a container size for them, and dates have none). What applies is SFCR s. 223: dates grown abroad and packed here, with our name on them, need “Imported by / Importé par” before our name, or the country of origin right next to it, at the usual 1.6 mm minimum. If CFIA treats dates as fresh fruit, ss. 269–270 add only that it be bold and near the weight. The Ø76 seal carries all of it, so neither box needs a lid label for the origin. The everyday dates are different: the supplier packs them in Saudi Arabia (you told us on 8 Oct), so their sticker takes the stricter rule, the country name beside our name: 6.4 mm tall on packs over 283.5 g (E12, 150 × 100 on the top of the 500 g and 1 kg trays) and 3.2 mm on the 250 g tray (E12s, 120 × 80 on its top, which fits the tray in your photo).',
    options: ['Yes: 1.6 mm, bold, on the seal', 'Make it bigger anyway (a lid label)'],
  },
  {
    id: 'stuffed-box-labels', topic: 'Dates · Stuffed date boxes', asked: '2026-10-07',
    question: 'Stuffed date boxes need more on the box than plain dates. Where should it go? (Decide before the label rolls are ordered, on 13 November.)',
    context: 'Fillings with added sugar (biscuit cream, chocolate, caramel) need the “High in sugars” front-of-package symbol (mandatory since January 2026) on the lid, in its upper half, not under the band or a sticker. The box also needs the full ingredient list with a “Contains” line, “Product of Saudi Arabia” next to our name, and a best-before date if they keep 90 days or less. Plain dates need none of this except the origin. The 100 × 40 box side label (E5) is too small for a stuffed list, and on the small box B5 the visible side below the lid is only about 25 mm. Our suggestion: stuffed dates go in the gift box B1 only, with a 100 × 70 lid label beside the band (a new die on the label order) carrying the symbol, ingredients, Contains, origin and our name. The small box B5 has no room on its lid for that label once the band and logo are on, so B5 stays for plain dates.',
    options: ['Stuffed dates in B1 only, with the 100 × 70 lid label', 'Only plain dates in boxes for now', 'Let us talk about it'],
  },
  {
    id: 'boxes-in-bags', topic: 'Delivery · Boxes in the paper bags', asked: '2026-10-07',
    question: 'The gift boxes only fit in the paper bags standing on their side. Is that all right?',
    context: 'B1 (320 × 240 × 40) fits the medium bag (254 × 127 × 330) only on its long edge; B5 (205 × 135 × 40) is too wide to lie flat in either bag (small 203 × 121, medium 254 × 127). Standing up is common for gift boxes, and the grid and the clear cover keep each date in its cell, but if you want them flat the bag sizes would need to change before the bag samples. The coffee sets go in the medium bag too: a box of 12 standing beside its pouch, or two pouches.',
    options: ['Standing up is fine', 'Change the bag sizes so boxes lie flat'],
  },
  {
    id: 'tote-fibre-label', topic: 'Bags · Cloth tote', asked: '2026-10-07',
    question: 'Researched (no lawyer): the cloth tote needs no fibre label, sold or given. Sew one in anyway?',
    context: 'The Textile Labelling and Advertising Regulations exempt “handbags, luggage, carrying cases and brushes” (Schedule II, item 2(b)), and a tote is a carrying bag. So no sewn label and no CA number are needed. If you add a label anyway, it must be true (“100% cotton / 100 % coton”).',
    options: ['No label', 'Sew in a fibre label anyway'],
  },
  {
    id: 'website-address-phone', topic: 'Business · Website contact', asked: '2026-10-06',
    question: 'Which business address and phone number do the website and the order emails show?',
    context: 'Researched (no lawyer). Alberta’s Internet Sales Contract Regulation (s. 4) requires, before the customer orders: our name, our business address (and our mailing address if different), a phone number, and an email if we have one, plus the refund and cancellation policy. Section 5 requires the same in the copy of the order we send within 15 days (our confirmation email). The website now does this by itself once you fill in Settings → Business details: the footer of every page and the line above “Send my pre-order” show our name, address and phone with the refund policy, and every email carries them. The business address is where you run the business: the pickup or kitchen address works; the registered office can be added as the mailing address only if mail goes there. The phone can be a low-cost business line that goes to voicemail. Labels stay as they are: “Hikaya Coffee Ltd., Calgary, Alberta, Canada” only.',
    options: ['Pickup or kitchen address + a business phone line', 'Home address + a business phone line', 'Let us talk about it'],
  },
  {
    id: 'pickup-without-location', topic: 'Delivery area · Pickup', asked: '2026-10-06',
    question: 'The site offers free pickup at “[address]”. With no location yet, keep pickup?',
    context: 'Checkout, the visit page and My account all show pickup Thursday to Sunday at the address set in Settings → Business details.',
    options: ['Keep pickup: we will set a pickup address', 'Delivery only for now (turn pickup off)'],
  },
  // ---------- what we need from you ----------
  {
    id: 'dates-supplier-label-info', kind: 'provide', topic: 'Dates · Supplier', asked: '2026-10-06',
    question: 'From the everyday dates supplier: what our sticker on their packs needs',
    context: 'For each variety and pack size (250 g, 500 g, 1 kg): (1) a lab sheet or nutrition values per 100 g (calories, fat, saturated and trans fat, cholesterol, sodium, carbohydrate, fibre, sugars, protein, potassium, calcium, iron); (2) are the dates only dates, or coated, oiled or with glucose syrup; (3) any allergen cross-contact at their plant; (4) the country where they were grown (they are packed in Saudi Arabia); (5) the net weight on each pack and how much it varies; (6) their lot code on each pack, or we add ours, and the packs sent without their own sticker (ours replaces it, you told us on 8 Oct); (7) each pack’s size: for a tray, the outside length and width and the flat top inside the rim; for a bag, its flat width and height, the zipper and the gusset (or one empty pack of each size, and we measure it). The smallest tray you photographed (8 Oct) is about 145 × 102 outside and 129 × 88 across the top, so the 250 g pack gets E12s, 120 × 80 on its top, with everything on it: that works for a pack of 283.5 g or less, where the country name needs only 3.2 mm. You ordered the small pack as 250 g (8 Oct). The 500 g and 1 kg packs are flat-topped trays too, their size not known yet: they get E12, 150 × 100 on the top, which needs a flat top of about 155 × 105. If a tray is smaller than that, tell us before the label order on 13 November; (8) any sulphites or preservatives (10 ppm or more must be declared), and their shelf life. Our one label on the top carries everything: the name in English and French, the weight, “Product of Saudi Arabia / Produit d’Arabie saoudite” next to our name (6.4 mm tall over 283.5 g, 3.2 mm on the 250 g tray), the ingredients, the Nutrition Facts, best before and the lot.',
    options: ['Given'],
  },
  {
    id: 'green-samples', kind: 'provide', topic: 'Green coffee · Samples', asked: '2026-10-04',
    question: 'Green coffee samples from United Beans (ordered 5 Oct, order #39078)',
    context: 'Ordered with the code sampling (1 lb each): Ethiopia Harrar G3 Natural $9.75 (Gulf and Yemeni-style, main candidate) · Ethiopia Sidamo Hube G1 Natural $11.35 (Gulf and Yemeni-style, the G1 upgrade) · Ethiopia Yirgacheffe Aricha G1 Natural $12.48 (benchmark: does G1 quality survive the spices?) · Brazil Campos Altos $10.79 (Shami sada) · Brazil Peaberry $10.14 (Shami with cardamom) · Colombia Huila Supremo $18.98 (to test a Brazil + Colombia Shami sada blend; the sampling discount did not apply, asked Ibrahim). Brazil Caldas was dropped. The order went to the wrong address: Shadi asked United Beans (contact form and email) to ship it to 513 - 909 5 Avenue SW, Calgary T2P 3G5, buzz 513. The sample cost is credited back on our first bulk order. At the cupping, roast the Ethiopians light and the Brazils and the Colombian medium, as we will sell them. Tick Given when the samples have arrived.',
    options: ['Given'],
  },
  {
    id: 'box-photos', kind: 'provide', topic: 'Photos · Date and gift boxes', asked: '2026-10-04',
    question: 'Photos of the real boxes, when the samples arrive',
    context: 'Until then the site draws each box. Shot list, all 4:5 portrait, same angle, on the cream background: Coffee & Dates (a pouch beside its box of 12 dates, with the paper bag); Two Coffees (two pouches, with the paper bag); Reserve 12 and 24 (one variety, and Mixed); Stuffed 12 (showing the seals and the fillings); Four Palms; the closed box with the red band, then with the Ramadan sticker and with the Eid sticker; the Everyday dates in their clear bag in 250 g, 500 g and 1 kg. Send them to the website session; a box with a photo shows it, the rest keep the drawing.',
    options: ['Given'],
  },
  {
    id: 'pouch-artwork', kind: 'provide', topic: 'Photos · Coffee bags and packs', asked: '2026-10-04',
    question: 'Final artwork or photos of the coffee pouches and the small packs',
    context: 'The site draws placeholder bags and sachets. After the recipes are final (docs/coffee-tbd.md, Packaging).',
    options: ['Given'],
  },
  {
    id: 'business-details', kind: 'provide', topic: 'Business · Pickup', asked: '2026-10-04',
    question: 'The pickup address, opening hours and phone',
    context: 'Enter them in Settings → Business details. Until then the site shows “[address]” and the footer, emails and Ask Hikaya can’t give it.',
    options: ['Given'],
  },
  {
    id: 'coffee-prices', kind: 'provide', topic: 'Coffee · Prices', asked: '2026-10-04',
    question: 'Prices for the coffee: base bags, styles, tasting boxes and packs',
    context: 'Set them in Admin → Shop → Products. Until a price is set the item says “Price coming” and can’t be ordered. List: Gulf coffee, Yemeni qahwa, Jubani, Qishr, Shami with cardamom, Shami sada; Najdi, Qassimi, Hijazi, Hadrami, Rada’i, Baydani; Taste the Gulf, Taste Yemen; the six packs.',
    options: ['Given'],
  },
  {
    id: 'dates-box-prices', kind: 'provide', topic: 'Dates · Prices', asked: '2026-10-04',
    question: 'Prices for the dates and gift boxes',
    context: 'Set them in Admin → Shop → Products: Everyday 250 g, 500 g, 1 kg; Reserve 12 and 24; Stuffed 12 and 24; Coffee & Dates; Two Coffees; Four Palms (draft $44).',
    options: ['Given'],
  },
  {
    id: 'recipe-amounts', kind: 'provide', topic: 'Coffee · Recipes', asked: '2026-10-04',
    question: 'Amounts from the tasting: grams of coffee per pot, grams in each pack, saffron per pot',
    context: 'The brew cards and the tasting boxes say “[TBD] g” until then. Weigh the samples and write them here.',
    options: ['Given'],
  },
  {
    id: 'pack-ingredients', kind: 'provide', topic: 'Coffee · Packs', asked: '2026-10-04',
    question: 'The full ingredient lists of the packs (Qassim, Hijazi with or without mastic, Hadrami, Rada’i, Baydani)',
    context: 'Needed for the labels (English and French) and the allergen lines, which say “to be confirmed” until then.',
    options: ['Given'],
  },
  {
    id: 'taste-notes', kind: 'provide', topic: 'Coffee · Taste notes', asked: '2026-10-04',
    question: 'Taste notes for each coffee and style, after the tasting',
    context: 'Today’s notes are drafts from research. Correct them in Admin → Shop → Words, or write them here.',
    options: ['Given'],
  },
  {
    id: 'pairings', kind: 'provide', topic: 'Coffee · Pairings', asked: '2026-10-04',
    question: 'Which date goes with each coffee, after the tasting',
    context: 'Until then no pairing shows anywhere on the site (product pages, the homepage, Ask Hikaya). Write the pairs here.',
    options: ['Given'],
  },
  {
    id: 'filling-labels', kind: 'provide', topic: 'Dates · Stuffed', asked: '2026-10-04',
    question: 'The labels of the fillings: the biscuit cream jar, the pistachio-dipped coating, and each filling’s ingredients',
    context: 'Their allergen lines say “[TBD]” and the stuffed lot labels say “[TBD: filling ingredients]” until then. A photo of each label is enough.',
    options: ['Given'],
  },
  {
    id: 'date-notes', kind: 'provide', topic: 'Dates · Varieties', asked: '2026-10-04',
    question: 'Taste notes for Royal Sukkari Mufattal, and where the Medjool comes from',
    context: 'The site shows “[TBD]” for both.',
    options: ['Given'],
  },
  {
    id: 'permits', kind: 'provide', topic: 'Food safety · Permits', asked: '2026-10-04',
    question: 'The food permits, the food-safety plan, and a CFIA check of the label wording',
    context: 'The timeline says pre-orders open “when our permits are in”. The label printer (Desk → Production) asks you to check the wording with the CFIA before selling.',
    options: ['Given'],
  },
  {
    id: 'why-note', kind: 'provide', topic: 'Story page · Why Hikaya', asked: '2026-10-04',
    question: 'The “Why Hikaya?” note on the story page, in your own words',
    context: 'Today it is a draft signed “Hikaya”. Write yours here (Arabic and English) and the next session puts it on the page.',
    options: ['Given'],
  },
  {
    id: 'yemen-beans-details', kind: 'provide', topic: 'Yemeni beans · Lots and box', asked: '2026-10-04',
    question: 'If we sell the Yemeni beans: the lots (regions, farms, altitude, process), their cupping scores, taste notes, prices, and the black box design',
    context: 'Prices from a search on 4 Oct 2026 (approximate; check before you set them), per 100 g: Canadian roasters about $23 CAD (Terra, Bani Matar and Haraz); a Bani Matar scored 86 about $23 CAD; a Saudi roaster’s Haraz about $33 CAD; Port of Mokha, scored 96–97, about $39–55 CAD (2021 prices). So roughly $25–45 CAD per 100 g, by the lot and its score. Each card and page shows the score once you write it here. Shown for now: Shop → “بن اليمن · Yemeni beans” tab, three placeholders (Haraz, Bani Matar, Yafa’i) at 100 g, drawn as a black box. Tell us the real lots and send the box artwork or photos.',
    options: ['Given'],
  },
  // ---------- questions ----------
  {
    id: 'green-first-order', topic: 'Green coffee · First order', asked: '2026-10-04',
    question: 'After the cupping (about 20 Oct): which green coffees, and how much, for the first United Beans order?',
    context: 'Rules: Gulf (Najdi, Qassimi, Hijazi) and Yemeni-style coffee use natural (sun-dried) Ethiopian beans only, never washed: light roasts show the process most and washed tastes sour there. Shami is a medium roast with Brazilian beans, where the process matters less. Grade (G1, G2, G3) is defects per 300 g and cup quality, not acidity or picking order. Prices go by total order weight across coffees: 180–239 lb is Tier 3, 240 lb or more is Tier 4. Examples (OTC list, Sep 2026; shipping ≈ $116 by Canpar for 7 boxes): 180 lb, Harrar 90 + Peaberry 90 ≈ $1,508 delivered ($8.38/lb); 180 lb, Harrar 90 + Campos Altos 90 ≈ $1,603 ($8.90/lb); 240 lb, Harrar 120 + Hube 30 + Peaberry 90 ≈ $1,976 ($8.23/lb): the extra 30 lb bag costs only about $180. The price lists expire after 15 days, so ask Ibrahim for a fresh one before ordering, and remind him of the sample credit. Details on the team site: T79 and the United Beans follow-up.',
    options: ['180 lb: one Ethiopian + one Brazil', '240 lb (Tier 4): two Ethiopians + one Brazil', 'Something else (write it below)'],
  },
  {
    id: 'yemen-beans-launch', topic: 'Yemeni beans · Launch', asked: '2026-10-04',
    question: 'Do we sell the Yemeni beans (coffee grown in Yemen, 100 g in the black and gold pouch), and when?',
    context: 'Shown for now so you can look at them (Shop → “بن اليمن · Yemeni beans”, slogan “من مزارعنا”). To hide them, switch the three off in Admin → Shop → Products; the tab goes away by itself. They can’t be ordered until they have a price.',
    options: ['Yes, at launch', 'Later', 'No'],
  },
  {
    id: 'yemen-beans-grind', topic: 'Yemeni beans · Grind', asked: '2026-10-04',
    question: 'Yemeni beans: whole roasted beans only (as now)? And the pour-over recipe?',
    context: 'Shadi (4 Oct): we grade and roast them and sell the roasted beans only, not ground. The product page shows “Grind just before you brew” and the recipe as “[TBD] g coffee to [TBD] ml water” until you give it. How to brew now has a Yemeni beans card (its pouch QR code lands there): five pour-over steps with the grams and water [TBD]. Put your recipe in Desk → Shop → Words → Recipes (brew guides) → “Yemeni beans, by pour-over”, or write it here.',
    options: ['Whole beans only (as now)', 'Also ground'],
  },
  {
    id: 'story-timeline', topic: 'Story page · Timeline', asked: '2026-10-04',
    question: 'The story page timeline no longer gives months. Is this wording right?',
    context: 'It said “December 2026: the waiting list opens” and “Around Christmas: pre-orders open”, but the launch plan depends on the permits. Now: «قريباً: تفتح قائمة الانتظار» / “Soon: the waiting list opens”, and «حين تصل التصاريح: تفتح الطلبات المسبقة لرمضان» / “When our permits are in: Ramadan pre-orders open”. The yellow banner and the Ramadan page still say “around Christmas”: tell us if those should change too.',
    options: ['Approve the new wording', 'Put months back (write them below)', 'Change it (write below)'],
  },
  {
    id: 'ramadan-deliveries', topic: 'Ramadan · Delivery times', asked: '2026-10-04',
    question: 'Ramadan deliveries: end the delivery windows before iftar, or keep 17:00–20:00 and tell customers which windows arrive before iftar?',
    context: 'The Ramadan page promised “Ramadan orders arrive before sunset”, but checkout offers 17:00–20:00 on Ramadan days (sunset is about 5:30–6:30 pm). The page now says: for delivery before iftar, choose 11–2 or 2–5. Ending the windows earlier can be built from the iftar times in the calendar.',
    options: ['Keep the windows, the page tells them (as now)', 'End Ramadan deliveries before iftar'],
  },
  {
    id: 'thirty-nights', topic: 'Ramadan · Idea', asked: '2026-10-04',
    question: '“ثلاثون ليلة · Thirty Nights”: 30 Reserve dates, one for each iftar. Do we make it?',
    context: 'Not built. It needs a 30-date grid: D30, 6 × 5 with small cups, put together from the strip kit (4 × B1-L6 + 5 × B1-S5). The China brief prices every strip type, so it can go in the packaging order (13 November) or be added any time.',
    options: ['Yes, add the D30 insert to the packaging order', 'No', 'Next year'],
  },
  {
    id: 'sticker-quantities', topic: 'Packaging · Stickers', asked: '2026-10-04',
    question: 'How many Ramadan and Eid stickers (Ø50) do we order, and how many red bands (for the 13 November packaging order)?',
    context: 'Every gift box has the same Tamr red band; Ramadan and Eid add our own Ø50 sticker. The week sheet now counts red bands for every gift box and the stickers apart, and Supplies shows them as “Ramadan stickers (Ø50)” and “Eid stickers (Ø50)”.',
  },
  {
    id: 'gift-box-names', topic: 'Gift boxes · Names', asked: '2026-10-04',
    question: 'Names: “Coffee & Dates / قهوة وتمر” or keep “The Guest Box / صندوق الضيف”? “Two Coffees / قهوتان” or keep “The Coffee Duo / ثنائي القهوة”?',
    context: 'The site now uses the plain names. Either can be changed in Admin → Shop → Words.',
    options: ['Plain names (as now)', 'The Guest Box and The Coffee Duo', 'Other (write below)'],
  },
  {
    id: 'two-coffees-choice', topic: 'Gift boxes · Two Coffees', asked: '2026-10-04',
    question: 'Two Coffees: any two coffees, or set pairs?',
    context: 'Built: any two of the family styles and bags (not qishr, not the tasting boxes).',
    options: ['Any two (as now)', 'Set pairs (write which below)'],
  },
  {
    id: 'coffee-dates-styles', topic: 'Gift boxes · Coffee & Dates', asked: '2026-10-04',
    question: 'Coffee & Dates: can any coffee go in, or only the Gulf and Yemeni styles?',
    context: 'Built: any family style or bag (Najdi, Qassimi, Hijazi, Hadrami, Rada’i, Baydani, Gulf, Yemeni, Jubani, Shami, Shami sada), not qishr or the tasting boxes.',
    options: ['Any (as now)', 'Gulf and Yemeni styles only', 'Other (write below)'],
  },
  {
    id: 'may-contain-nuts', topic: 'Dates · Allergens', asked: '2026-10-04',
    question: 'Plain dates are packed in the same kitchen as the nut and stuffed dates: does a “may contain tree nuts” line go on the Everyday and Reserve labels?',
    context: 'Part of the food-safety plan; ask your AHS inspector. Until then labels and the site show no “may contain” line, and Ask Hikaya says it can’t confirm cross-contact yet.',
    options: ['Yes, “may contain tree nuts” on plain dates', 'No (separate packing)', 'Ask AHS first'],
  },
  {
    id: 'supplier-claims', kind: 'provide', topic: 'Dates · Reserve', asked: '2026-10-04',
    question: 'What does the supplier certify for the Reserve dates: “hand-picked”, “larger”, the grade?',
    context: 'The Reserve box text shows these with [TBD: confirm with the supplier] until you confirm them.',
    options: ['Given'],
  },
  {
    id: 'caramel-almond', topic: 'Dates · Stuffed', asked: '2026-10-04',
    question: 'Caramel with almonds: yes or no after your tasting?',
    context: 'On hold (milk and almonds). If yes, it becomes a fifth filling and Mixed needs new counts (see the Stuffed Mixed question).',
    options: ['Yes, sell it', 'No'],
  },
  {
    id: 'dates-prices', topic: 'Dates · Prices', asked: '2026-10-04',
    question: 'Prices for each size and box. Is it the same price for Khalas and Sukkari Qassimi at each size (and for each Reserve variety)?',
    context: 'Built with one price per size or box, whatever the variety: set them in Admin → Shop → Products. If varieties need different prices, each becomes its own product.',
    options: ['Same price per size (as now)', 'Different prices per variety'],
  },
  {
    id: 'coffee-dates-price', topic: 'Gift boxes · Coffee & Dates', asked: '2026-10-04',
    question: 'Does Coffee & Dates have one price whatever coffee is chosen, or does a style (Najdi, Hadrami…) cost more than a plain bag?',
    context: 'Built with one price per box (set it in Admin → Shop → Products), whatever the customer picks. A price per coffee would mean a different price for each style inside the box.',
    options: ['One price for the box', 'The price follows the coffee chosen'],
  },
  {
    id: 'stuffed-mixed-counts', topic: 'Dates · Stuffed Mixed', asked: '2026-10-04',
    question: 'If caramel with almonds goes on sale (five fillings), how many of each go in a Mixed stuffed box of 12 and of 24?',
    context: 'Mixed splits evenly: with four fillings, 3 of each in a 12 and 6 of each in a 24. Five fillings don’t divide 12 or 24, so the site stops offering Mixed until you choose the counts.',
  },
  {
    id: 'lotus-name', topic: 'Dates · Stuffed', asked: '2026-10-04',
    question: 'Do we call the biscuit filling “Lotus cream / كريمة اللوتس” (the brand name) or “Biscuit cream / كريمة البسكويت”?',
    context: 'Lotus is a trademark. Using it says exactly what is inside, but the brand owner may object. Until you answer the site says “Biscuit cream / كريمة البسكويت”. Its allergens (wheat, soy) come from the jar’s label [TBD].',
    options: ['Lotus cream (brand name)', 'Biscuit cream (plain name)'],
  },
  {
    id: 'reserve-mixed', topic: 'Dates · Reserve box', asked: '2026-10-04',
    question: 'Is a Reserve box one variety (the customer picks Mufattal, Ajwa or Medjool), or a mix of the three?',
    context: 'Since round 3 batch 3 the Reserve box offers both: one variety, or Mixed (4 of each in the 12, 8 of each in the 24). Answer only if you want to change that.',
    options: ['One variety, the customer chooses', 'A mix of the three', 'Both (two products)'],
  },
  {
    id: 'four-palms-fourth', topic: 'Dates · Four Palms and Eid Dates', asked: '2026-10-04',
    question: 'Khudri is no longer sold. Which date replaces it in Four Palms and Eid Dates?',
    context: 'Until you answer, both boxes stay on sale and the packing sheet counts 6 Sukkari, 6 Khalas and 6 Ajwa; the box text says the fourth variety is [TBD].',
    options: ['Royal Sukkari Mufattal', 'Medjool', 'Make them three varieties, 8 of each', 'Something else (write it below)'],
  },
  {
    id: 'date-packaging', topic: 'Dates · Packaging', asked: '2026-10-04',
    question: 'Which packaging do we buy for the new dates: 250 g and 1 kg trays (500 g we have), and individual seals for stuffed dates?',
    context: 'Once confirmed, they are added to Supplies (Desk → Production) so the week sheet warns when you are short. Not added until you confirm the sizes.',
  },
  {
    id: 'privacy-wording', topic: 'Privacy page', asked: '2026-10-04',
    question: 'Approve the new privacy wording (Visit → Privacy)?',
    context: 'Today it says “We don’t sell or share them”, but names, emails, addresses and messages do go to the services that run the shop (Netlify hosting, Resend email, Twilio texts, Square card payments, Google Maps routes, Anthropic for Ask Hikaya), some outside Canada; Alberta’s privacy law expects us to say so. Draft, Arabic first: «نحتفظ باسمك وهاتفك وبريدك وعنوانك لتجهيز طلبك وتوصيله، ولمراسلتك إن اشتركت في قائمتنا. لا نبيع معلوماتك. نشاركها فقط مع الخدمات التي تشغّل المتجر: الاستضافة، والبريد، والرسائل النصية، والدفع بالبطاقة، وخرائط مسارات التوصيل، ومساعد «اسأل حكاية»، وبعضها يعالج البيانات خارج كندا. نحتفظ بالمحادثات وطلبات المساعدة ليردّ عليك الفريق. لطلب الاطلاع على معلوماتك أو تصحيحها أو حذفها، استخدم نموذج المساعدة.» / “We keep your name, phone, email and address to prepare and deliver your order, and to write to you if you join our list. We don’t sell your information. We share it only with the services that run the shop: hosting, email, text messages, card payments, maps for delivery routes and the Ask Hikaya assistant; some of them process data outside Canada. We keep chats and help requests so the team can reply. To see, correct or delete your information, use the help form.”',
    options: ['Approve the draft as written', 'Approve with changes (write them below)'],
  },
  {
    id: 'radai-baydani-use', topic: 'Coffee · Rada’i and Baydani', asked: '2026-10-04',
    question: 'How are the Rada’i and Baydani packs used?',
    context: 'Until this is decided the site says “decided at our tasting [TBD]” on both product pages, the brew card and Ask Hikaya. The allergen line stays (“Contains: sesame, almonds” / “sorghum”). Shadi (4 Oct): the Rada’i nuts are for the cup, not the coffee.',
    options: ['Into the bag once, like Hadrami', 'One pack per pot', 'In the cup (the nuts), the mix per pot', 'Something else (write it below)'],
  },
  {
    id: 'radai-nuts-supply', topic: 'Coffee · Rada’i', asked: '2026-10-04',
    question: 'Do we supply the almonds (and sesame), or does the customer add their own, with us supplying only the mix?',
    context: 'If we pack nuts and sesame, our kitchen needs an allergen plan (cross-contact) and the label must say “Contains: almonds, sesame” in English and French. If the customer adds their own nuts, no nuts come into our kitchen. Ask Alberta Health Services (and CFIA if selling outside Alberta).',
    options: ['We supply them, sealed', 'The customer adds their own; we supply the mix', 'Decide after the tasting'],
  },
  {
    id: 'yemeni-styles-at-launch', topic: 'Coffee · Yemeni styles', asked: '2026-10-04',
    question: 'Which Yemeni styles do we launch with?',
    context: 'Shadi (4 Oct): maybe start with Rada’i only. A style can be hidden in Admin → Shop → Products until it is ready.',
    options: ['Hadrami, Rada’i and Baydani', 'Rada’i only (plus plain Yemeni qahwa)', 'Decide after the tasting'],
  },
  {
    id: 'qassimi-milk', topic: 'Coffee · Qassimi', asked: '2026-10-04',
    question: 'How much evaporated milk goes in a Qassimi pot, and when does it go in?',
    context: 'Decided: customers add evaporated milk themselves; we only tell them how much. The site shows [TBD] ml and “when it goes in [TBD]” until this is answered.',
  },
  {
    id: 'delivery-edges', topic: 'Delivery area', asked: '2026-10-04',
    question: 'Do we deliver to Chestermere (T1X) or Springbank (T3Z)?',
    context: 'Delivery is now Calgary’s own postal areas only (T1Y, T2A–T2Z, T3A–T3S). Both of these are refused until you say yes.',
    options: ['Neither', 'Chestermere (T1X)', 'Springbank (T3Z)', 'Both'],
  },
  {
    id: 'mailing-address', kind: 'provide', topic: 'Mailing list', asked: '2026-10-04',
    question: 'Which mailing address goes at the bottom of our letters?',
    context: 'The law needs one in every marketing email. A PO box is fine. Enter it in Settings → Business details → “Mailing address for letters”; letters can’t be sent until there is one.',
    options: ['Given'],
  },
  {
    id: 'running-low-email', topic: 'Emails', asked: '2026-10-04',
    question: 'The “Running low?” email (about three weeks after a coffee order): its own tick at checkout, or count it in “about three emails a year”?',
    context: 'It is built but switched off until you decide.',
    options: ['Its own tick at checkout', 'Widen “about three emails a year” everywhere', 'Leave it off'],
  },
];
