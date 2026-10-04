# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro, static output, deployed directly to Netlify (no Figma step). One shared product data file feeds every page and both languages. Checkout is a pre-order flow submitted through Netlify Forms; payment is at pickup or by Interac e-Transfer. Structure checkout so a card processor (Shopify or Square) can replace the submit step at launch without redesign.

## Users

Both audiences, weighted equally:

- **Arab families in Calgary** who already know qahwa and dates. They buy for Ramadan, Eid, hosting and visiting. They read Arabic first and expect it set properly.
- **Curious Calgarians** new to Arabic coffee. They need the story, a guide to the coffees and dates, and an easy first purchase, in English.

## Product Purpose

Hikaya (حكاية, "a story") is a new coffee and dates brand in Calgary, Canada (Hikaya Coffee Ltd.). The website sells Gulf, Yemeni and Shami coffees, qishr and dates for pickup and local delivery in Calgary. The coffee model: a base bag (coffee and its everyday spice) plus sealed packs that make it the way each home takes it (Najdi, Qassimi, Hijazi, Hadrami, Rada'i, Baydani), packs on their own as refills, and tasting boxes for newcomers. See docs/coffee-tbd.md for what is still open.

Two sites share one brand: hikayacoffee.ca (the story) and the shop (hikaya-shop-preview on Netlify). Both are in scope.

## Positioning

Coffee and dates belong to the same table: Gulf qahwa is poured with a date, other coffees simply sit well beside one. The brand is a conversation between Bunn (the coffee) and Tamr (the date); the logo is their two speech bubbles meeting at a khalal-gold seed. No other Calgary roaster pairs coffee and date as one product and one voice.

## Operating Context

- Stages, in order: A1 set up the business (now) · A2 online from January 2027 · A3 grow · the café only after A3. The café menu ("Coffee Road") is future, not a current offer.
- Fulfilment: free pickup at [address], Calgary (address not set yet; always write "[address], Calgary"), Thursday to Sunday from 22 Jan 2027; own delivery in Calgary $9, free over $80; Calgary postal codes start T1, T2 or T3. Ramadan orders arrive before sunset; Eid orders before Eid morning. No shipping outside Calgary yet.
- Packaging system: one printed 250 g pouch for every coffee, with front and back stickers printed in Calgary; one gift box (inserts D24 dates only, C12 coffee + 12 dates, C2 two coffees); one 500 g everyday date box; occasion changes only by sleeve (regular khalal gold, Ramadan, Eid). Pouch QR code points to hikayacoffee.ca/brew, so that page must exist.
- GST shown as 0% (basic groceries) is unconfirmed; flag it as pending an accountant.

## Capabilities and Constraints

- Languages: Arabic and English only on the website, with true RTL for Arabic and Arabic first in paired lines. Packaging labels are English and French (Canadian law); ingredient labels on product pages show EN/FR.
- Products: base bags Gulf coffee (cardamom), Yemeni qahwa (cardamom only), Jubani (with qishr), Qishr (husk with ginger), Shami with cardamom, Shami sada; packs: saffron (soaked and added to the serving dallah at the end, never boiled), Qassim blend (spices only; the customer adds evaporated milk), Hijazi blend, Hadrami, Rada'i, Baydani (ginger in the Yemeni packs; how the Rada'i and Baydani packs are used is decided at the tasting); styles = bag + packs at one price; tasting boxes تذوّق النكهة الخليجية / اليمنية (one small pack per pot). Coffee is brewed in a small pot and served from the dallah. Prices for the coffee bags, styles, packs and tasting boxes are not set yet (the site says "price coming"). Boxes (the only way the site sells dates), with draft prices from `BOXES` in `src/data/products.ts` to check against the coffee prices (docs/coffee-tbd.md): year-round The Everyday Date Box $34, Four Palms $44, The Guest Box $54, The Coffee Duo (Najdi + Yemeni qahwa) $46; Ramadan The Iftar Pair $54, Ramadan Date Box $34; Eid Eid Coffee & Dates $56, Eid Dates $58, Eid Coffee Duo $46. Prices are not set yet (the site says "price coming"). Khaleeji, Shamaliyya and Sana'ani are discontinued.
- Dates: Sukkari, Khalas, Medjool, Ajwa, Khudri.
- Open: final prices; grams per pot and per pack; Hadrami and Hijazi pack contents; pickup address and hours; GST treatment.

## Brand Commitments

- Brand book v0.8 and logo pack v0.8.1 only. Colours: Paper #F5EFE3, Bunn #33211A, Tamr #A93B28, Khalal #CF9C0C. No green or grey except the cardamom dot. Colours come from the real fruit, drink or spice.
- Logo: do not rotate, flip, stretch, recolour, or swap the bubbles; Bunn is always high right. Clear space = seed width. Under 32 px use the small logo, under 20 px the tiny logo.
- Fonts: El Messiri for the voices of Bunn and Tamr; Noto Nastaliq Urdu for guests only; IBM Plex Sans and IBM Plex Sans Arabic for body text.
- Voice: Bunn (coffee: the traveller, bitter, quick, proud) speaks first; Tamr (date: the host, sweet, patient, teasing) answers. Lines always come in pairs, Arabic first, 8 words or fewer, tell don't sell (no "best", no "premium", no "!"), and leave the story open (وللحكاية بقية).
- Culture: no "chai"; avoid accidental ties to another culture. People are Calgary people (winter coats, knitwear). Coffee goes to adults; children get a date. Gulf qahwa is a third of a cup, clear and golden, no foam; foam only for Shami coffee. Najdi has no cinnamon.

- Instagram: @hikaya.yyc (https://www.instagram.com/hikaya.yyc/), confirmed by the user.

## Evidence on Hand

- Logo pack v0.8.1, colours, patterns (cream conversation, seed), packaging brief v2 and drawings: Google Drive (Hikaya folders).
- Films (9:16 and 4:5): seed-to-story, Calgary slip, Ramadan iftar (20 s and 6 s), Eid visit, Along the counter (file four-families), cold qishr, the brew as sound, Bunn & Tamr chat ep. 1, neon winter test: Google Drive "02 Films".
- Product and scene images from the website v3 artifact (bags, gift boxes, Eid and Ramadan scenes).
- No real customer testimonials, reviews, press or sales numbers exist. Guest-wall lines are samples and must be labelled as such until real ones arrive.

## Product Principles

1. A date is always offered, never imposed: Gulf qahwa comes with one by custom; for other coffees it is a suggestion.
2. The conversation leads; selling follows.
3. Arabic is a first language here, never a translation layer.
4. Show only what exists now; the café waits its turn.
5. Honest drafts: unconfirmed prices, address and tax are marked, not hidden.

## Accessibility & Inclusion

Bilingual with full RTL support. Respect reduced motion. Text contrast to WCAG AA on Paper.
