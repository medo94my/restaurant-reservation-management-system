# Rules — non-negotiable

Context and rationale: see AGENTS.md ("Operator preferences & working protocol"). These are the hard rules.

## Git

1. All work on `codex-review-fixes` (the Vercel deploy branch). No other branch.
2. Small atomic conventional commits (`fix:` / `refactor:` / `test:` / `docs:` / `chore:`), verified before each commit, pushed immediately after.
3. Stage only files you touched: `git add <paths>`. Never `git add -A`.
4. Never commit `.codex/` or test/probe artifacts.
5. Test DB probes use `test-`-prefixed ids (e.g. `test-claim-race-probe`) and must be cleaned up in `afterAll`.
6. Never touch the real accounts `ahmed` (hostess) or `john` (manager) — no sessions, rows, or data.
7. `RESTAURANT_ID` (lib/restaurant-config.ts) is the tenant key for all `restaurantId` columns and credential-salt inputs; `RESTAURANT_MANAGER_USER_ID` (Better Auth bootstrap user) belongs only in `userId` columns.

## Product

8. Same-table same-day booking within 90 minutes of an active one = double-booking → 409 "That table already has a booking around that time." (lib/service-slots.ts + advisory-lock transaction in app/api/service-data/route.ts).
9. Seat action allowed when a unit is `prep` OR `available`; claim failure (unit held by another seating) keeps the booking (joins the run sheet); a `blocked` unit is a hard 409.
10. Never lose a user's save to a transient error: optimistic updates chained on the saveQueue with immediate PUT + retry hook (`deleteCustomerDurable`/`markConfigDirty` pattern).
11. Floor-plan canvas must not hijack page scrolling — wheel over the canvas scrolls the page.
12. Account controls live in the topbar, not a separate bar.

## Code

13. Read PRODUCT.md and DESIGN.md before any UI work; load the `impeccable` skill.
14. Saffron gold `#d7b46a` is a rare accent (active/primary/highlight only); depth = tonal surfaces + 1px borders; no resting shadows; hover lifts don't drop shadows.
15. Use existing tokens (e.g. `--service-green #72bd8d`, `--terracotta-salmon #e07d72`). Never invent hex values.
16. Roster tables follow the staff roster card in `components/manager/staff-management.tsx` (card spec, button scale, row collapse).
17. Shared styled-jsx lives in marker-class components (see `components/manager/table-collapse-styles.tsx`) — never duplicate rules across components.
18. No nested interactive elements: real `<button>`s with wrapper divs + sibling tool containers (unit-card pattern) — caused a hydration bug before.
19. Keep generous vertical breathing room around key sections (e.g. Quick actions).

## Verification

20. Typecheck before every commit: `node node_modules/typescript/bin/tsc --noEmit`.
21. Tests: `pnpm test` (vitest, `test/**/*.test.ts`, loads `.env.local`). The pg SSL 'prefer' warning is informational, not a failure.
22. Dev server: `nohup node node_modules/next/dist/bin/next dev -p 3003 > /tmp/murex-dev.log 2>&1 &`.
23. Recon with exact line numbers first → design exact edits → apply → verify (tsc + tests) → commit scoped → push → terse summary.
24. Fix ALL flagged issues, not a subset.
25. Parallelize independent task batches with subagents when the operator asks.
26. Performance mysteries: diagnosis-first — measure and gather evidence before changing code.
