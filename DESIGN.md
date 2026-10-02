---
name: Hikaya
description: Coffee and dates in Calgary; the website is the package, opened.
colors:
  paper: "#F5EFE3"
  paper-2: "#EDE3D0"
  sheet: "#FBF8F1"
  line: "#DFD1BA"
  bunn: "#33211A"
  bunn-2: "#4A3127"
  ink-2: "#66503F"
  tamr: "#A93B28"
  tamr-2: "#8E2F1F"
  tamr-ink: "#FFF6EE"
  khalal: "#CF9C0C"
  khalal-2: "#E7C866"
  cardamom: "#5E7A2E"
typography:
  voice:
    fontFamily: "'El Messiri', 'IBM Plex Sans Arabic', Georgia, serif"
    fontSize: "clamp(32px, 4.2vw, 58px)"
    fontWeight: 600
    lineHeight: 1.3
  display:
    fontFamily: "'El Messiri', 'IBM Plex Sans Arabic', Georgia, serif"
    fontSize: "clamp(44px, 7vw, 96px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'El Messiri', 'IBM Plex Sans Arabic', Georgia, serif"
    fontSize: "clamp(34px, 4.6vw, 60px)"
    fontWeight: 700
    lineHeight: 1.12
  title:
    fontFamily: "'El Messiri', 'IBM Plex Sans Arabic', Georgia, serif"
    fontSize: "clamp(26px, 3vw, 38px)"
    fontWeight: 700
    lineHeight: 1.12
  title-s:
    fontFamily: "'El Messiri', 'IBM Plex Sans Arabic', Georgia, serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.12
  lead:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif"
    fontSize: "clamp(18px, 1.5vw, 21px)"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  body-ar:
    fontFamily: "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.6
  guest:
    fontFamily: "'Noto Nastaliq Urdu', 'IBM Plex Sans Arabic', serif"
    fontSize: "clamp(20px, 2vw, 25px)"
    fontWeight: 500
    lineHeight: 2.1
rounded:
  tail: "5px"
  tail-lg: "8px"
  field: "14px"
  option: "18px"
  bubble: "26px"
  panel: "36px"
  panel-lg: "44px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4.5vw, 56px)"
  max: "1280px"
  stack: "18px"
  section: "clamp(64px, 9vw, 128px)"
  section-tight: "clamp(40px, 6vw, 80px)"
components:
  button-primary:
    backgroundColor: "{colors.bunn}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "15px 22px 16px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.bunn-2}"
  button-tamr:
    backgroundColor: "{colors.tamr}"
    textColor: "{colors.tamr-ink}"
    rounded: "{rounded.pill}"
    padding: "15px 22px 16px"
    height: "50px"
  button-tamr-hover:
    backgroundColor: "{colors.tamr-2}"
  button-line:
    textColor: "{colors.bunn}"
    rounded: "{rounded.pill}"
    padding: "15px 22px 16px"
  bubble-bunn:
    backgroundColor: "{colors.bunn}"
    textColor: "{colors.paper}"
    typography: "{typography.voice}"
    rounded: "{rounded.bubble}"
  bubble-tamr:
    backgroundColor: "{colors.tamr}"
    textColor: "{colors.tamr-ink}"
    typography: "{typography.voice}"
    rounded: "{rounded.bubble}"
  bubble-guest:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.bunn}"
    typography: "{typography.guest}"
    rounded: "{rounded.bubble}"
  sleeve-regular:
    backgroundColor: "{colors.khalal}"
    textColor: "{colors.bunn}"
    height: "40px"
  sleeve-ramadan:
    backgroundColor: "{colors.tamr}"
    textColor: "{colors.tamr-ink}"
    height: "40px"
  input-field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.bunn}"
    rounded: "{rounded.field}"
    padding: "13px 15px"
  chip:
    textColor: "{colors.bunn}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  nav-link-current:
    backgroundColor: "{colors.bunn}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "9px 13px"
  card-sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.panel}"
    padding: "26px"
---

# Design System: Hikaya

## Overview

**Creative North Star: "The Package, Opened"**

The site wears Hikaya's real packaging instead of a coffee-roaster template. The ground is warm paper (Paper), sections are wrapped in solid colour the way the sleeve wraps the gift box, coffees are shown as the actual 250 g pouch with its 80 × 80 front sticker drawn in code, and every container is a speech bubble, because the brand is a conversation between Bunn (coffee) and Tamr (date). Arabic comes first in every pair and is set as a first language, not a translation.

Density is relaxed and editorial: wide section padding, a 1280px measure, one idea per band. Colour comes from the fruit, the drink and the spice: Bunn brown carries weight, Tamr red answers, Khalal gold marks the season and small accents, and the only green is the cardamom dot. Photography is reserved for the real boxes, dates and Calgary scenes; drawn things (pouches, dates on the box builder, the bubble print) are flat printed illustration, never imitation photographs.

Motion is a conversation tempo: Bunn's bubble arrives, Tamr answers a beat later; pouches stand up into place; sections rise softly on scroll. All of it is disabled under reduced motion.

**Key Characteristics:**
- Speech-bubble containers: large radius with one tightened tail corner.
- Bunn's bubble sits right and speaks first; Tamr's sits left and answers, in both languages.
- Full-width season sleeve above the header (Khalal regular, Tamr for Ramadan, Khalal for Eid).
- Patterned paper (the cream-conversation bubble print) as a packaging ground, never behind the logo or running text.
- Code-drawn pouches with the front sticker: bubble icon with spice dots, Arabic name in El Messiri, English in tracked caps, roast bar.
- Pill buttons that carry the same tail corner as the bubbles.

## Colors

A packaging palette from brand book v0.8: paper and three fruit/drink colours, with tonal partners only where states need them.

### Primary
- **Bunn Roast Brown** (bunn): the voice of coffee. Text colour on paper, primary buttons, Bunn's bubble, the current nav item, the cart button, the drenched pairing band, selected options. **Bunn Lifted** (bunn-2) is its hover.

### Secondary
- **Tamr Date Red** (tamr): the voice of the date. Tamr's bubble, the Ramadan/pre-order button, the Ramadan sleeve, Arabic product names beside English ones, the iftar time, focus outlines, the text caret. **Tamr Deep** (tamr-2) is its hover and error text. **Tamr Cream** (tamr-ink) is the only text colour set on Tamr.

### Tertiary
- **Khalal Seed Gold** (khalal): the seed in the logo. The regular and Eid sleeve band, the cart count, text selection, the focus halo on fields (35% mix), the "added" button state, list bullets. **Khalal Light** (khalal-2) is gold text on the Bunn band only.

### Neutral
- **Paper** (paper): the page ground and the raised card on top of photographs.
- **Paper Fold** (paper-2): patterned-paper base, alternating section bands (shop families, guest wall), hover fill on nav and language links.
- **Sheet** (sheet): the brightest surface; fields, summaries, guest bubbles, selected options.
- **Line** (line): 1px rules, 1.5px field and option strokes.
- **Bunn Ink Soft** (ink-2): secondary text, captions, hints, the wordmark's Latin line.
- **Cardamom** (cardamom): only as the cardamom spice dot on stickers and product pages.

### Named Rules
**The Fruit, Drink, Spice Rule.** Every colour names something real. No grey, no green except the cardamom dot, no colour added for decoration.

**The Tamr Answers Rule.** Tamr red is the reply, not the shout: one Tamr action per view beside a Bunn action, Tamr bubbles after Bunn bubbles, Tamr names after English names.

**The Sleeve Holds the Season Rule.** The occasion is carried only by the sleeve colour (Khalal regular and Eid, Tamr Ramadan), never by re-theming the page.

## Typography

**Display Font:** El Messiri (with IBM Plex Sans Arabic, Georgia, serif); self-hosted at 500, 600, 700
**Body Font:** IBM Plex Sans (with IBM Plex Sans Arabic, system-ui); Arabic pages switch to IBM Plex Sans Arabic at 18px
**Guest Font:** Noto Nastaliq Urdu, 500, for guest lines only

**Character:** El Messiri is the voice of Bunn and Tamr, rounded and calligraphic in both scripts; Plex is the plain, honest label text from the back of the bag. Nastaliq belongs to guests, so a reader always knows who is speaking.

### Hierarchy
- **Voice** (600, clamp(32px, 4.2vw, 58px) at hero scale, 1.3): Bunn and Tamr bubbles. Smaller steps: 40px max (pairing panel), 25px max (inline pairs), 18px. The English translation sits under the Arabic in Plex 400 at 0.62em (min 14px), 82% opacity.
- **Display** (700, clamp(44px, 7vw, 96px), 1.12, -0.01em): page openers on Story and Eid.
- **Headline** (700, clamp(34px, 4.6vw, 60px), 1.12): section heads.
- **Title** (700, clamp(26px, 3vw, 38px)) and **Title S** (700, 23px): sub-heads, family names, product names (25px on cards).
- **Lead** (400, clamp(18px, 1.5vw, 21px), Bunn Ink Soft, max 54ch; Arabic one step larger).
- **Body** (400, 17px/1.6; Arabic 18px), measure 62ch.
- **Label** (600, 13px, sentence case, Bunn Ink Soft): small field and meter labels.

### Named Rules
**The Who Is Speaking Rule.** El Messiri is for the brand's voices and headings, Nastaliq is for guests, Plex is for everything that informs. Never swap them.

**The Arabic First Rule.** In every paired line Arabic sets first and larger; English follows smaller, under it, on English pages only.

## Layout

A single centred column of 1280px with a fluid gutter (clamp(16px, 4.5vw, 56px)). Pages are a stack of full-width bands, each one region: paper sections, a Bunn-drenched band (the pairing picker), Paper Fold bands, a full-bleed photograph with a paper card on it. Section padding is clamp(64px, 9vw, 128px) (tight: clamp(40px, 6vw, 80px)); stacks breathe at 18px.

The home hero is a two-column split (1.12fr / 0.88fr): the conversation at display scale with the h1, lead and the Bunn/Tamr button pair beneath; the pack panel (patterned paper, box photo, standing pouch) beside it. Section heads use a two-column split: headline on one side, lead aligned to its baseline on the other. Collapses to one column at 900px (hero, box builder, guest wall) and 800px (heads). The shelf is four pouches standing on a 3px Bunn shelf line, two-up under 760px. Films are a horizontal snap reel of 9:16 posters.

Header: sticky, 72px (64px under 520px), translucent paper with blur. Nav collapses to a menu button at 1020px. The season sleeve (min 40px) sits above the header, like the band across the lid.

**RTL:** the page mirrors with logical properties (inset-inline, margin-inline, padding-inline), except the conversation: Bunn's bubble stays on the right and Tamr's on the left in both languages, because the logo never flips. Bubbles therefore use physical sides (margin-left/right, bottom-right/left radius) on purpose. The lockup is always LTR.

## Elevation & Depth

Mostly flat paper and tonal bands. Depth appears only where a physical object sits on a surface: pouches and boxes cast warm Bunn-tinted drop shadows, and a paper card laid over a photograph lifts with a long, soft shadow. No shadows on buttons, fields or ordinary cards; strokes are inset box-shadows of 1.5px, not elevation.

### Shadow Vocabulary
- **Object on paper** (`filter: drop-shadow(0 22px 22px rgba(51, 33, 26, .28))`): standing pouch, box lid; the pairing pouch on Bunn uses `drop-shadow(0 28px 30px rgba(0, 0, 0, .35))`.
- **Card over photo** (`box-shadow: 0 30px 60px -30px rgba(0, 0, 0, .5)`): Ramadan and Eid paper cards on photography.
- **Guest note** (`box-shadow: 0 14px 30px -22px rgba(51, 33, 26, .6)`): guest bubbles on the wall.

### Named Rules
**The Real Objects Cast Shadows Rule.** Only things that exist as objects (bags, boxes, a card laid on a window) get a shadow. Interface chrome stays flat.

## Shapes

One shape: the speech bubble. Every container is a generously rounded rectangle (bubbles 26px, cards 32 to 36px, hero and product panels 40 to 48px) with exactly one corner tightened to a tail (5 to 8px). Buttons, chips and nav are full pills; the primary button, cart button and selected chips and options also take a 5 to 6px tail.

Tail side follows the speaker. Bunn-coloured or selected surfaces take the bottom-right tail (Bunn's corner); Tamr-coloured surfaces, the hero pack panel, product imagery panels and cards over photographs take the bottom-left tail (Tamr's corner). Tail sides are physical and do not mirror in Arabic.

Small geometry repeats the sticker: 16 × 7px roast-bar cells (2px radius), 10px spice dots, round number badges.

### Named Rules
**The One Tail Rule.** Every container is a bubble with one tail corner. No square corners, no uniform-radius cards, no second container shape.

## Components

### Buttons
Tactile pills that speak in the brand's two voices.
- **Shape:** full pill (999px), min-height 50px, padding 15px 22px 16px, 600 at 16px.
- **Primary (Bunn):** Bunn fill, Paper text, bottom-right tail (6px). Hover Bunn Lifted.
- **Tamr:** Tamr fill, Tamr Cream text, bottom-left tail (6px). Hover Tamr Deep. Used for pre-order and "add the pair".
- **Line:** transparent with a 1.5px Bunn inset stroke; fills Bunn on hover.
- **States:** press scales to 0.97 (180ms, house ease); focus is a 2.5px Tamr outline at 3px offset; disabled is 45% opacity.
- **Add to cart (card):** smaller Bunn pill (10px 15px, 14.5px) with a drawn plus; turns Khalal with Bunn text when added.

### Chips
- **Style:** pills with a 1.5px inset Line stroke (on Bunn: 35% paper stroke), 500 weight.
- **State:** hover strengthens the stroke to Bunn (or Paper); selected fills Bunn (or Paper on the Bunn band) and takes the bottom-right tail.

### Cards / Containers
- **Corner Style:** 32 to 44px with one 5 to 8px tail (see Shapes).
- **Background:** Sheet for summaries and options; Paper for cards on Paper Fold or photographs; Bunn and Tamr for character cards (Bunn tail right, Tamr tail left).
- **Shadow Strategy:** none, except cards over photographs (see Elevation).
- **Border:** none, or a 1.5px inset Line stroke on Sheet.
- **Internal Padding:** 26px, or clamp(22px, 3.4vw, 44px) on large cards.

### Inputs / Fields
- **Style:** Sheet fill, 1.5px Line border, 14px radius, 13px 15px padding; label 600 at 15px above, hint 14px Bunn Ink Soft. Email in the footer is a pill.
- **Focus:** border turns Bunn plus a 4px Khalal halo (35% mix); caret is Tamr.
- **Error:** Tamr border, Tamr Deep 14px message.
- **Option cards (radio):** 18px radius, inset Line stroke; checked becomes Sheet with a 2px Bunn stroke and the bottom-right tail.

### Navigation
- **Style:** sticky translucent paper bar with a 1px Line rule; lockup (logo + حكاية in El Messiri 700 and HIKAYA in tracked Plex caps) at the inline start.
- **Links:** 500 at 15.5px pills; hover Paper Fold; current page filled Bunn.
- **Actions:** language switch (the other language's name, in its own script), the Bunn cart pill with a Khalal count that bumps on add.
- **Mobile:** under 1020px a pill-outlined menu button drops a full-width paper panel with 19px links.

### Speech Bubble (signature)
The conversation pair: Bunn's bubble (Bunn fill, Paper text, tail bottom-right, pushed to the right) then Tamr's (Tamr fill, Tamr Cream text, tail bottom-left, pushed to the left), 10 to 18px apart. Arabic first, English under it on English pages. On the Bunn band Bunn's bubble inverts to Paper fill. Guests use a Sheet bubble in Nastaliq with a soft shadow, always labelled as sample lines until real ones arrive.

### Season Sleeve (signature)
A full-width solid band above the header, min 40px, centred 14.5px 500 line: Khalal with Bunn text (regular, Eid), Tamr with Tamr Cream text (Ramadan).

### Patterned Paper (signature)
Paper Fold ground tiled with the cream-conversation bubble print (`/brand/pattern.svg`, 240px tile): small Tamr, Khalal and Bunn bubbles with three paper dots. Used behind pouches in product tiles, the hero pack panel and a standalone print band between hero and pairing. Never behind the logo or text blocks.

### Pouch and Front Sticker (signature)
A code-drawn 250 g pouch: cream bag with the bubble print, crimped seal, valve upper right, the logo and حكاية on clear paper, and the front sticker: a band in the family colour, a paper bubble icon with up to three spice-colour dots, the Arabic name (El Messiri 700), the English name in tracked caps, a one-line description, a five-cell roast bar and the size. It stands with a drop shadow, rises on load, and lifts and tilts slightly (-6px, -1.2deg) on card hover.

### Motion
House ease `cubic-bezier(.16, 1, .3, 1)`. Hero: Bunn bubble fades and rises (0.7s), Tamr answers 0.55s later; pouch stands up (0.9s, from 26px and -3deg). Pairing: switching coffee replays Tamr's answer after a pause. Scroll: sections rise 14px from a 4px blur (0.7s). Under `prefers-reduced-motion` all animation and transition is removed.

## Do's and Don'ts

### Do:
- **Do** put Bunn's bubble first and on the right, Tamr's second and on the left, on Arabic and English pages alike.
- **Do** give every container one tail corner (5 to 8px) on a 26 to 48px radius.
- **Do** carry the occasion only in the sleeve: Khalal (regular, Eid) or Tamr (Ramadan).
- **Do** show coffees as the drawn pouch and sticker; show boxes and dates as real photographs.
- **Do** pair a Bunn primary button with a Tamr button when two actions sit together.
- **Do** keep text to WCAG AA on Paper: Bunn for text, Bunn Ink Soft for secondary text.
- **Do** use logical properties for layout so Arabic mirrors, except the conversation and the lockup.

### Don't:
- **Don't** flip, rotate, recolour or swap the bubbles of the logo, or mirror the conversation in RTL.
- **Don't** place the bubble print behind the logo or behind running text.
- **Don't** use grey, or green other than the cardamom dot.
- **Don't** use El Messiri for body copy or Nastaliq for anything but guest lines.
- **Don't** add shadows to buttons, fields or ordinary cards.
- **Don't** draw dates as imitation photographs; drawn dates are flat printed illustration.
- **Don't** add decorative section numbers or small labels above headings.
