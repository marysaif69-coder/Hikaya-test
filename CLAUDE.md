# Hikaya website: notes for Claude Code sessions

Coffee and dates shop for Calgary (hikayacoffee.ca), Arabic and English. Astro static site on
Netlify, with Netlify Functions (`netlify/functions/`), Netlify Database (Postgres, migrations in
`netlify/database/migrations/`) and one edge function (the private-preview gate).
Read `docs/backend.md` for how everything works, `docs/launch-plan.md` for what is left, and `PRODUCT.md` / `DESIGN.md` for the brand.

## Branch and deploys
- Work on `claude/frontend-design-skills-setup-2e6lwc`. It is the repo's default branch and
  Netlify (project hikaya-v4-preview) deploys every push to it.
- The site stays hidden ("Coming soon") until `SITE_PUBLIC=true` is set in Netlify. Never set or
  suggest setting it unless the owners say they are launching.

## Before every push
- `npm test` (API, shop management and preview-gate checks) and `npm run build` must pass.
- Changes to `knowledge/handbook.md`, the assistant (`netlify/lib/ask*.ts`) or product data
  should be followed by the Ask Hikaya eval: GitHub → Actions → "Ask Hikaya eval" → Run
  workflow (about $1). 37/40 passed on the first run; keep it at least there.
- New database changes go in a new numbered migration folder; never edit one that has deployed.

## Where text lives
- Product names, descriptions, taste lines and the brew recipes are in `src/content/products.json`
  and `src/content/recipes.json`; the owners edit them in Admin → Shop → Words, which commits to this
  branch. Those files override the text in `src/data/products.ts`, so edit the JSON, and pull
  before editing (the owners may have saved changes).

## Rules
- No secrets in code, commits or chat. Keys live in Netlify environment variables (and the
  `ANTHROPIC_API_KEY` repository secret for the eval).
- Every price is recalculated on the server; never trust amounts from the browser.
- SQL only through the `sql` tagged template (parameterised). Escape customer text in the
  admin desk with `esc()`.
- Customer-facing copy: Arabic and English, Arabic first in paired lines, no "best"/"premium",
  no exclamation marks (see PRODUCT.md "Voice").
- The held date changes (`notes/held/`) stay off the site until the owners say "publish the dates".
