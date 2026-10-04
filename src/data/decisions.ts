// Questions only the owners can answer, shown in the desk under Settings → Decisions. Maryam and
// Shadi write their answer there; it is saved with who and when, and the next session reads it
// (Admin → Settings → Decisions, or GET /api/admin/decisions) before changing the site.
// Keep each id unchanged once published: the answers are saved against it. Add new ones at the top.
export type Decision = { id: string; topic: string; question: string; context: string; options?: string[]; asked: string };

export const DECISIONS: Decision[] = [
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
    id: 'mailing-address', topic: 'Mailing list', asked: '2026-10-04',
    question: 'Which mailing address goes at the bottom of our letters?',
    context: 'The law needs one in every marketing email. A PO box is fine. Enter it in Settings → Business details → “Mailing address for letters”; letters can’t be sent until there is one.',
  },
  {
    id: 'running-low-email', topic: 'Emails', asked: '2026-10-04',
    question: 'The “Running low?” email (about three weeks after a coffee order): its own tick at checkout, or count it in “about three emails a year”?',
    context: 'It is built but switched off until you decide.',
    options: ['Its own tick at checkout', 'Widen “about three emails a year” everywhere', 'Leave it off'],
  },
];
