<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design Context

- **PRODUCT.md** (project root): strategic design context — register (`product`), users (manager on desktop is primary; hostess at the door), brand personality ("warm, grounded, precise"), anti-references (no fine-dining theatrics), design principles, and accessibility bar (WCAG 2.1 AA). Read it before any UI work.
- **DESIGN.md** (project root): the visual system — saffron-gold-on-charcoal palette, DM Sans + Playfair Display typography, flat/tonal-layered elevation, and component specs. Machine-readable frontmatter; components in `.impeccable/design.json`.
- Quick rule: saffron gold `#d7b46a` is a rare accent (active/primary/highlight only); depth comes from tonal surfaces + 1px borders, never resting shadows; hover lifts don't drop shadows.
- **Any new UI work (components, pages, redesigns, polish) must use the `impeccable` skill** — load it before writing UI code. Collection-page tables follow the staff roster card in `components/manager/staff-management.tsx` (card spec, button scale, row collapse) as the reference implementation.
