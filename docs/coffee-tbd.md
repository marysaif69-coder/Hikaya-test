# Coffee: what is still to be decided

The shop now works as **bag → your family's way → just the pack**. Everything below is marked
`[TBD]` on the site (or held back) until the owners decide. Najdi's saffron is **not** open: Najdi is
always Gulf coffee with its saffron packet.

## Prices (set in Admin → Shop → Products)
Every coffee item starts with no price. The site says "Price coming", the add buttons are off, and
the server refuses the order until a price is set:
- Base bags: Gulf coffee, Yemeni qahwa, Jubani, Qishr, Shami coffee with cardamom, Shami sada
- Styles (bag + packs, one price): Najdi, Qassimi, Hijazi, Hadrami, Rada'i, Baydani
- Discovery packs: Taste the Gulf, Taste Yemen
- Packs on their own: saffron, Qassim, Hijazi, Hadrami, Rada'i, Baydani
- Gift boxes with coffee (Guest Box, Coffee Duo, Iftar Pair, Eid boxes) kept their earlier draft
  prices; check them against the new coffee prices. The Coffee Duo is now Najdi + Yemeni qahwa
  (Khaleeji is gone).

## Recipes and amounts
- Grams of coffee per pot (all brew cards say `[TBD] g`), and grams in each pack
- Saffron amount per pot, and when the Qassim/Hijazi packs go in
- Hadrami pack contents (copy is written to work either way; allergens shown as "to be confirmed")
- Hijazi blend: with or without mastic (allergens "to be confirmed")
- Qassim pack: full list (spices only, no milk: the customer adds their own milk for Qassimi); may contain barley
- How much milk per pot for Qassimi, and when it goes in
- Taste notes for every coffee and style are drafts from research: confirm or rewrite them after the tastings
- Baydani: the richer version
- Jubani: with ginger or plain
- Qishr: roasted or raw husk; size kept at 100 g

## Beans and roast
- Final beans chosen at the cupping (~20 October) and blind tasting (3–10 November)
- Roast levels are the working plan: Gulf blonde, Yemeni medium-light, Shami medium
- Shami: Brazilian beans [TBD: may include some Ethiopian]

## Names
- Main Yemeni name: "Yemeni qahwa" (Sana'ani removed)

## Packaging (later)
- Base bag and small sealed packs. The site draws placeholder bags and sachets; the old Najdi,
  Baydani and Levantine bag artwork is no longer used. Redesign after the recipes are final.

## Later
- Ready-mixed bags (FAQ only)

## Words for the owners to rewrite
- "Why Hikaya?" note on the story page (/en/story/): a draft, signed "Hikaya", no names. Rewrite it in
  your own words (it is in src/pages/[lang]/story.astro).

## Website decisions waiting on the owners (from the 4 Oct review)
- "Running low?" email (about three weeks after a coffee order): it is built (unsubscribe link,
  one-click unsubscribe, sender address, at most one every 60 days, no gifts or regular-order
  customers) but switched off (`REFILLS_ON` in `netlify/functions/reminders.mts`). Waiting on the
  owners: either a separate tick at checkout for these reminders, or widen "about three emails a
  year" everywhere it appears (consent text, confirmation email, footer, handbook).
- Delivery area edges: the site now delivers only to Calgary's own postal areas (T1Y, T2A–T2Z,
  T3A–T3S; list in `CALGARY_FSAS`, `netlify/lib/orders.ts`). Before this, any T1/T2/T3 code passed,
  including Lethbridge, Medicine Hat, Okotoks and Canmore. Waiting on the owners: should T1X
  (Chestermere) or T3Z (Springbank) be added? Both are refused until then.
- Packers who also drive (round 1b item 16): a Packer added with "Also drives" can't finish
  onboarding, and deliveries given to them are hidden. Waiting on the owners: may a packer drive?
  Recommended: no; someone who packs and drives is added as Helper + Also drives.
