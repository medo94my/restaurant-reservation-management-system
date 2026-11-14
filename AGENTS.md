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

## Operator preferences & working protocol (learned 2026-11-14)

Hard rules live in `RULES.md` (checklist form). This section carries the why and the context behind them.

### Git & commits
- All work goes on `codex-review-fixes` (the Vercel deploy branch). Small atomic conventional commits (`fix:`/`refactor:`/`test:`/`docs:`/`chore:`), verified before each commit, pushed immediately after; give the operator a terse progress summary after each landed change.
- Stage ONLY files you touched (`git add <paths>`); never `git add -A`.
- Never commit `.codex/` or test/probe artifacts. Test DB probes use `test-`-prefixed ids (e.g. `test-claim-race-probe`) and must be cleaned up in `afterAll`.

### Protected data & naming
- Real accounts `ahmed` (hostess) and `john` (manager) exist — never touch their sessions, rows, or data.
- `RESTAURANT_ID` (lib/restaurant-config.ts) is the tenant key: use it for every `restaurantId` column and credential-salt input. `RESTAURANT_MANAGER_USER_ID` is the Better Auth bootstrap user and belongs only in `userId` columns.

### Code & design
- Read PRODUCT.md/DESIGN.md before UI work (see Design Context above). Use existing tokens (e.g. `--service-green #72bd8d`, `--terracotta-salmon #e07d72`) — never invent hex values.
- Shared styled-jsx lives in marker-class components (see `components/manager/table-collapse-styles.tsx`) instead of duplicating rules across components.
- No nested interactive elements: real `<button>` elements with wrapper divs + sibling tool containers (the unit-card pattern) — nesting once caused a hydration bug.
- Durability UX: chain optimistic updates onto the saveQueue with an immediate PUT and a retry hook (`deleteCustomerDurable`/`markConfigDirty` pattern) — never lose a user's save to a transient error.

### Product rules
- Same-table same-day booking within 90 minutes of an active one is a double-booking → 409 "That table already has a booking around that time." (lib/service-slots.ts + the advisory-lock transaction in app/api/service-data/route.ts).
- Seat action is allowed when a unit is `prep` OR `available`; claim failure (unit held by another seating) keeps the booking (it joins the run sheet); a `blocked` unit is a hard 409.

### UX preferences
- The floor-plan canvas must NOT hijack page scrolling — cursor-over-canvas wheel events scroll the page.
- Keep generous vertical breathing room around key sections (e.g. Quick actions); account controls belong in the topbar, not a separate bar (in progress).

### Tooling & workflow
- Typecheck: `node node_modules/typescript/bin/tsc --noEmit`. Tests: `pnpm test` (vitest, `test/**/*.test.ts`, loads `.env.local`). The pg SSL 'prefer' warning in tests is informational, not a failure.
- Dev server: `nohup node node_modules/next/dist/bin/next dev -p 3003 > /tmp/murex-dev.log 2>&1 &`.
- Recon with exact line numbers first; design the exact edits; apply; verify (tsc + tests); commit scoped; push; summarize tersely.
- Fix ALL flagged issues, not a subset. Parallelize independent task batches with subagents when the operator asks.
- For performance mysteries: diagnosis-first — measure and gather evidence before changing code.
