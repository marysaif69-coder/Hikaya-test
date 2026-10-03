# Where is what (3 October 2026)

## The addresses

| Address | What it is | Who sees what |
|---|---|---|
| **hikayacoffee.ca** | The real website. | Customers see **Phase 0, "Something is brewing"**, on every page. Nobody can change that by accident: it is locked (below). |
| **hikayacoffee.ca/team** | The team's way in on the real address. | Enter the preview code once; then you see the whole site with a bar on top saying it is a team view. |
| **hikaya-v4-preview.netlify.app** | The preview address of the same site. | The team: enter the code under "Team" (or the owners open it to "anyone with the link"). A bar on top always says "PREVIEW · team only". |
| **…/admin/** (on either address) | The desk. | Owners and helpers, log in with the email code. The header says which address you are on and what customers see right now. |
| **…/admin/driver/** | The team app (drivers, packers). | |
| **team.hikayacoffee.ca** | The setup site. A separate Netlify project (hikaya-team). Not part of this website; leave it as it is. | |

Important: the preview address and hikayacoffee.ca are **one website with one desk and one
database**, at two addresses. A product price, an order or a setting changed from either address is
changed for both. Only what the *public* sees on hikayacoffee.ca depends on the switch.

## See each phase without changing anything

Desk → Settings → "Who can see the website" → "Try a phase without changing anything":
**See Phase 0**, **See Phase 1**, **See the open shop**. Or, once you have the code, add `?phase=brewing`
or `?phase=soon` to the address. A yellow "TEAM VIEW" strip shows it is only for you.

## Change what customers see (locked)

Desk → **Settings** → **Who can see the website** → Real website:
1. Press **Unlock to change**.
2. Type `hikayacoffee.ca` in the box.
3. Press **0 · Something is brewing**, **1 · Coming soon + waitlist** or **Open to everyone**, then OK.
4. It locks itself again. Every owner gets an email. The desk header shows the new phase.

Only owners see this. If the switch cannot be read for any reason, customers see Phase 0.

## The preview switch (not locked)

Same card → Preview: **Team code needed** or **Anyone with the link** (to share the preview with the
team without the code). The preview is never shown to Google either way.
