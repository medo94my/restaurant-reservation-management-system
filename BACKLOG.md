# Code Review Backlog

Confirmed issues from the feature-by-feature code review against `HEAD` (`b339e7b`) + working-tree changes.

**Status:** 40 / 40 completed & verified (`npx tsc --noEmit -p .`: 0 errors, `pnpm test`: 143/143 passing).

**Complexity & Model Assignment Legend:**
- `[complexity: high]` — Cross-cutting security, auth/session architecture, concurrency/transactions, or complex state-sync/geometry → **`claude-opus-5-5-high`** | **`gemini-4-argon-high`** | *(Note: `gemini-3-pro` is not in the active `swarm` model list; `gemini-4-hydrogen-xhigh` or `gemini-pro-orchestrator-g1-pro` are available alternatives)*
- `[complexity: medium]` — Multi-file validation, schema/API persistence wiring, or non-trivial UI state fixes → **`claude-sonnet-5-5-medium`** | **`inherit`** (`Gemini 4 Hydrogen (Medium)`)
- `[complexity: low]` — Localized UI/copy/sorting/validation fixes → **`claude-sonnet-5-5-low`** | **`inherit`** (`Gemini 4 Hydrogen (Medium)`)

---

## Feature 1: Database Schema, Initialization & Workspace Config Store

- [x] **[F1-1] `[complexity: medium]` Unauthenticated `GET /api/restaurant-config` PII leak** (`app/api/restaurant-config/route.ts:10-16`)
  - When `staffSession` is `null`, `GET` defaults `role` to `'host'` instead of returning `401`. While `loadConfig('host')` omits `customers`, it still returns `floorItems` containing live `guest` names, `note`s, `pax`, `time`, and `bill` amounts.
  - Also passes `getStaffSession()` without `request.headers`, which can break in edge/non-ambient contexts.
- [x] **[F1-2] `[complexity: high]` Silent DB write failure in `DrizzleConfigStorageAdapter.put`** (`lib/workspace-config-store.ts:43-56`)
  - Catches PostgreSQL errors during `db.insert(...).onConflictDoUpdate(...)`, logs a warning, and returns `void`. `saveConfig()` and `PUT /api/restaurant-config` return `200 { ok: true }` even when DB persistence fails, leaving state only in volatile memory.
- [x] **[F1-3] `[complexity: medium]` `staff_members` missing from DDL & `user.role` enum conflict** (`lib/db-init.ts`, `lib/schema.ts:75-83,115`)
  - `lib/db-init.ts` creates `staff_role` enum (`'host'`, `'server'`, `'manager'`, `'admin'`) but omits `CREATE TABLE IF NOT EXISTS staff_members`.
  - `user.role` defaults to `'hostess'` as raw `text` in `lib/schema.ts` and `lib/db-init.ts`, conflicting with `staff_role` (`'host'`), `GLOSSARY.md`, and `loadConfig` typing (`'manager' | 'host'`).
- [x] **[F1-4] `[complexity: low]` Incomplete `isRestaurantConfig` validation & ordering** (`lib/workspace-config-store.ts:140-161,244`)
  - Omits type/bounds validation for optional `FloorItemBase` fields `pax`, `time`, and `bill`.
  - `validateConfig()` runs deep recursive traversal and `Set` allocations across up to 5,000 customers *before* checking the `500_000`-byte payload size limit.
- [x] **[F1-5] `[complexity: high]` Dual auth schema split & `GLOSSARY.md` / smell cleanup** (`lib/schema.ts`, `lib/restaurant-config.ts`, `lib/workspace-config-store.ts`, `GLOSSARY.md`)
  - `TABLE_SHAPES`/`COUCH_SHAPES`/`TABLE_STATUSES` deduplicated into `lib/restaurant-config.ts`.
  - Linked `staffMembers` to Better Auth `user(id)` via `authUserId` (`auth_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL`); updated `GLOSSARY.md` Couch shapes to include `loveseat`, `sofa`, `l-sectional`, `banquette`.

---

## Feature 2: Authentication, Sessions & Staff Management

- [x] **[F2-1] `[complexity: high]` `cookieCache` (7d) bypasses session revocation** (`lib/auth/auth.ts:43-46`, `app/api/staff/[id]/route.ts:111,138`)
  - Better Auth `cookieCache: { enabled: true, maxAge: 7 * 24 * 3600 }` validates signed client cookies without hitting the DB. Deleting `session` rows on staff deactivation or passcode reset does not revoke active cookie sessions until cache expiry.
- [x] **[F2-2] `[complexity: low]` Hardcoded fallback secrets** (`lib/auth/auth.ts:26-28`, `lib/staff-service.ts:368-374`)
  - Both `auth.secret` (`'dev-super-secret-key-for-restaurant-staff-auth-min-32-chars'`) and `getStaffSessionSecret()` (`'saffron-cedar-dining-room-staff-secret-2026'`) fall back to static strings when env vars are unset.
- [x] **[F2-3] `[complexity: low]` Fail-open session creation hook** (`lib/auth/auth.ts:87-90`)
  - `databaseHooks.session.create.before` catches non-`APIError` DB errors and only logs `console.warn`, allowing deactivated accounts to sign in if DB lookup fails.
- [x] **[F2-4] `[complexity: medium]` Passcode length mismatch** (`app/api/staff/route.ts:53,78` vs `lib/auth/auth.ts:32-34`)
  - `POST /api/staff` and the UI allow passcodes `>= 4` chars, but Better Auth `emailAndPassword` defaults to `minPasswordLength: 8`, rejecting 4–7 char passcodes on `signUpEmail` (while `PUT /api/staff/[id]` hashes directly, bypassing the limit).
- [x] **[F2-5] `[complexity: high]` `DrizzleStaffStorageAdapter` discards `pinSalt` on save** (`lib/staff-service.ts:199-202,232-234,260-280`, `lib/schema.ts:75`)
  - `staffMembers` lacks a `salt` column. `saveStaff` drops the generated random salt, and reads fabricate a deterministic SHA-256 salt (`sha256(id + '-staff-salt')`), breaking `verifyPinHash` after restart/cache miss.
- [x] **[F2-6] `[complexity: low]` Unconditional demo credentials in UI** (`app/(auth)/login/page.tsx:250-277`, `components/modals/pin-pad-modal.tsx:38,166-167`)
  - Hardcoded demo credentials (`MGR-01`/`manager123`, `HOST-01`/`hostess123`, PINs `1111`, `123456`) are rendered unconditionally in production UI.
- [x] **[F2-7] `[complexity: high]` Inflexible `trustedOrigins` & competing auth mechanisms** (`lib/auth/auth.ts:19-25`, `lib/staff-service.ts`)
  - Replaced hardcoded `localhost` `trustedOrigins` with env-driven `resolveTrustedOrigins(env)`; bridged `staff-service.ts` secrets/sessions with Better Auth and synced `staff_members.auth_user_id` deactivation/session revocation with `user`/`session`.

---

## Feature 3: Onboarding & Demo Reset Flow

- [x] **[F3-1] `[complexity: high]` Unauthenticated & incomplete `POST /api/onboarding/reset-demo`** (`app/api/onboarding/reset-demo/route.ts:11-20`, `lib/onboarding/onboarding-service.ts:122-140`)
  - Only checks `NODE_ENV === 'production'`; lacks auth/manager role enforcement.
  - Deletes only `workspaces` and `restaurantOperations`, leaving `user`, `account`, `session`, `restaurantBranding`, and `floorLayouts`. On next status check, `getOnboardingStatus()` sees the leftover manager in `user` and re-inserts `'default'` completed workspace.
- [x] **[F3-2] `[complexity: high]` In-flight session hijacking & data leak in `POST /api/onboarding/init`** (`lib/onboarding/onboarding-service.ts:214-249`, `app/api/onboarding/init/route.ts:11-19`)
  - Unauthenticated callers can overwrite `onboardingSessionToken` on the latest incomplete draft workspace and receive populated `draftData` (manager name, staff ID, restaurant info) plus the raw `token`.
- [x] **[F3-3] `[complexity: medium]` DB mutation inside `GET /api/onboarding/status`** (`lib/onboarding/onboarding-service.ts:121-145`)
  - `getOnboardingStatus()` executes `db.insert(workspaces)...onConflictDoUpdate` during a `GET` request.
- [x] **[F3-4] `[complexity: medium]` Broken auto-login on resumed sessions (Steps 3–5)** (`app/(auth)/onboarding/page.tsx:401-421`, `app/api/onboarding/complete/route.ts:58-76`)
  - Resuming at Steps 3–5 leaves client `passcode` state as `''`, sending `passcodeConfirmation: ''` and failing `authClient.signIn.username` auto-login before redirecting to `/manager`.
- [x] **[F3-5] `[complexity: low]` Missing `stepNumber` bounds guard in `saveOnboardingStep`** (`lib/onboarding/onboarding-service.ts:322,353-504`)
  - Direct callers passing `stepNumber` outside `1..4` bypass step validation yet still advance `onboardingStep`.

---

## Feature 4: Branding, Theming & App Shell

- [x] **[F4-1] `[complexity: medium]` Unvalidated logo/SVG & style token inputs** (`app/api/branding/logo/route.ts:13-28`, `app/api/branding/route.ts:70-79`, `components/manager/manager-branding-view.tsx:58-74`)
  - Accepts any `logoData`/`logoUrl` string without MIME, URI scheme (`javascript:`, `data:text/html`), payload size, or SVG sanitization checks (stored XSS risk). Color hexes and `fontFamily` are also unvalidated.
- [x] **[F4-2] `[complexity: medium]` `GET /api/branding` returns unpublished drafts live** (`app/api/branding/route.ts:26-36`, `components/shared/branding-context.tsx:56-64`)
  - Returns the `'default'` row regardless of `isPublished`, so saving a draft (`isPublished: false`) immediately updates live interfaces.
- [x] **[F4-3] `[complexity: medium]` Hardcoded MUI theme & unloaded fonts** (`lib/theme.ts:6-86`, `app/layout.tsx`, `components/manager/manager-branding-view.tsx:31-37`)
  - `lib/theme.ts` hardcodes `#d7b46a`, `#111312`, `'DM Sans'`, and `'Playfair Display'` instead of CSS variables, so dynamic branding does not style MUI components.
  - `app/layout.tsx` only loads `Roboto` via `next/font/google`; selectable fonts (`Cinzel`, `Inter`, `Plus Jakarta Sans`, `Merriweather`) are never loaded.
- [x] **[F4-4] `[complexity: low]` Silent 0-row updates, FOUC, duplicate ARIA & layout shift** (`app/api/branding/logo/route.ts:20-27`, `app/api/branding/route.ts:125-132`, `app/layout.tsx:49`, `components/responsive-drawer.tsx:52-64`)
  - `PUT`/`POST`/`DELETE` return `success: true` even when 0 rows match `'default'`.
  - Client-side branding fetch causes FOUC; `ResponsiveDrawer` sets `role="dialog"` + `aria-modal="true"` on both `<Drawer>` and `slotProps.paper`, and `useMediaQuery({ noSsr: true })` causes a post-hydration mobile anchor swap (`right` vs `bottom`).
  - `app/dining-room.css` is not imported in `layout.tsx` or `globals.css`.

---

## Feature 5: Floor Layout Engine & Editable Floor Plan

- [x] **[F5-1] `[complexity: medium]` Manager floor plan omits `editable` & risks data loss** (`app/(manager)/manager/floor-plan/page.tsx:155-158`)
  - `<EditableFloorPlan items={filteredUnits} onChange={updateFloorUnits} />` omits `editable` (defaults to `false`, leaving the canvas read-only).
  - If `editable` were enabled, passing `filteredUnits` to `onChange={updateFloorUnits}` would overwrite `units` in `useDiningStore`, deleting archived units and other unit kinds whenever a filter chip is active.
- [x] **[F5-2] `[complexity: high]` Seat geometry mismatch (`computeSeatLayout` vs `RealisticTable`)** (`lib/floor-layout.ts:66`, `components/editable-floor-plan.tsx:116`)
  - `computeSeatLayout` uses static `TABLE_DIMENSIONS`, while `RealisticTable` uses `getDynamicTableDimensions(tableType, capacity)`, causing chairs and plates to render inside larger tabletops (e.g., 8+ seat round tables).
- [x] **[F5-3] `[complexity: low]` `addItem` viewport-center offset bug** (`components/editable-floor-plan.tsx:641-649,668`)
  - Passes `wrap.clientWidth / 2, wrap.clientHeight / 2` to `screenToWorld`, which expects viewport `clientX/Y` and subtracts `rect.left/top`—misplacing new units by `(-rect.left/zoom, -rect.top/zoom)`.
- [x] **[F5-4] `[complexity: medium]` Pan cursor ref, stale effect, passive wheel & missing bounds/soft-delete** (`components/editable-floor-plan.tsx:778,912-924,1274`)
  - `isPanning.current` mutation doesn't trigger re-render so cursor never updates to `'grabbing'`.
  - Auto-fit `useEffect` depends only on `[editable, items.length]`, using stale spatial bounds when items move without count changes.
  - React `onWheel` `e.preventDefault()` fails on passive listeners.
  - Inspector "Remove" hard-deletes (`items.filter`) instead of soft-deleting (`archived: true`), and drag skips `clampUnitPosition`.

---

## Feature 6: Customer CRM, Phone Normalization & Guest Tags

- [x] **[F6-1] `[complexity: medium]` Unauthenticated PII exposure/mutation & missing data masking** (`app/api/customers/route.ts`, `app/api/customers/[id]/route.ts`)
  - Zero auth or role checks on `GET/POST/PATCH`, violating `GLOSSARY.md` role-based data masking and exposing guest names, phones, notes, and spend to anonymous callers.
- [x] **[F6-2] `[complexity: high]` Silent DB error swallowing & full-table scan** (`lib/customer-service.ts:409-676`)
  - `DrizzleCustomerStorageAdapter` catches DB errors and falls back to seeded `InMemoryCustomerStorageAdapter`, masking outages; `searchCustomers` loads all `customers` rows into memory for JS filtering.
- [x] **[F6-3] `[complexity: medium]` `occasionTags` dropped in Drizzle persistence** (`lib/customer-service.ts:375-396`, `lib/schema.ts`)
  - `customers` table lacks an `occasion_tags` column; `dbRowToCustomer` and Drizzle `createCustomer`/`updateCustomer` omit `occasionTags`.
- [x] **[F6-4] `[complexity: high]` Non-atomic `recordVisitAndSpend`** (`lib/customer-service.ts:646-667`)
  - Performs read-then-write without a transaction or `FOR UPDATE`/atomic SQL increment, risking lost visit/spend updates on concurrent closeouts.
- [x] **[F6-5] `[complexity: low]` Phone search mismatch & duplicated `normalizePhone`** (`components/guest-tags-manager.tsx:54`, `lib/phone.ts:10-15`, `lib/customer-service.ts:100-103`)
  - `guest-tags-manager.tsx` searches `customer.phone` without normalizing the search query; `normalizePhone` is duplicated across `lib/phone.ts`, `lib/customer-service.ts`, and `guest-tags-manager.tsx`.

---

## Feature 7: Reservations & Run Sheet

- [x] **[F7-1] `[complexity: medium]` Missing auth on reservation endpoints** (`app/api/reservations/route.ts`, `app/api/reservations/[id]/route.ts`)
  - `GET`, `POST`, and `PATCH` lack `getStaffSession` checks, exposing guest PII and allowing unauthenticated booking/seating/check-closeout mutations.
- [x] **[F7-2] `[complexity: high]` Double-booking & seating race conditions** (`lib/reservation-service.ts:506-619`, `app/api/reservations/route.ts:97`)
  - `createReservation` and `seatParty` perform non-atomic check-then-write without DB transactions or row locks (`FOR UPDATE`).
  - `POST /api/reservations` does not forward `{ strictOverlap: strictConflict === true }` to `createReservation`.
- [x] **[F7-3] `[complexity: high]` Silent DB data loss & split-brain fallback** (`lib/reservation-service.ts:228-402`)
  - `DrizzleReservationStorageAdapter` swallows DB errors, mutates `this.fallback` before DB queries, and omits `billAmount`, `seatedAt`, `completedAt`, `cancelledAt`, `cancelReason`, and `warning` from DB persistence/mapping.
- [x] **[F7-4] `[complexity: high]` UI disconnect & seating clashes** (`components/hostess/hostess-reservations-view.tsx:107,184-212,519`, `app/(manager)/manager/reservations/page.tsx`)
  - `handleSeatReservationDirect` overwrites `assignedUnit` without checking if already `seated`, and matches seated state by `guest === b.name`.
  - Both reservations pages read/mutate local `useDiningStore` instead of `/api/reservations`.

---

## Feature 8: Live Dining Service, Realtime SSE & Hostess Floor Operations

- [x] **[F8-1] `[complexity: medium]` Unauthenticated SSE stream & heartbeat DoS** (`app/api/live-floor/stream/route.ts:6-25`)
  - `GET /api/live-floor/stream` lacks `getStaffSession()`, exposing live floor/guest events publicly; `?heartbeat=` accepts `>= 10` ms (100 timers/sec per client).
- [x] **[F8-2] `[complexity: high]` SSE-to-PUT feedback loop & dropped/desynced state** (`components/hostess/hostess-view.tsx:135-176`)
  - `floor:unit_updated` calls `updateUnit(...)`, triggering `scheduleSync()` (`PUT /api/restaurant-config`) on every incoming SSE event (causing write storms and 401s for `host` role), and drops `payload.bill`.
  - `reservation:created` only adds a UI alert without updating `bookings` in `useDiningStore`.
- [x] **[F8-3] `[complexity: high]` Check Closeout overwrites shift revenue & omits CRM spend** (`lib/dining-service.ts:397`, `lib/dining-store.ts:86-98,469-480`)
  - `completeSeating` overwrites `unit.bill = bill` instead of accumulating shift revenue across multiple table turns (violates `GLOSSARY.md` *Check Closeout*), and omits updating guest cumulative CRM spend.
- [x] **[F8-4] `[complexity: high]` Broken edit, walk-in & merge persistence** (`components/hostess/hostess-view.tsx:276,338-350,379-388`)
  - `handleSaveBooking` always `POST`s `/api/reservations` even when `editingBookingId` is set, hardcodes `customerId: '11111111-0000-4000-a000-000000000001'` (also in `handleQuickSeatWalkIn`), and swallows errors.
  - `handleConfirmMerge` creates a default 2-seat unit instead of summing `combinedCapacity`, removes merged units, and leaves assigned bookings orphaned.
- [x] **[F8-5] `[complexity: medium]` Module-level store globals, stale modal snapshot & ID collisions** (`lib/dining-store.ts:130-135,263`, `components/hostess/hostess-view.tsx:93,254`, `components/modals/quick-table-modal.tsx:44`)
  - `activeSyncAdapter`, `debounceTimer`, `syncQueue`, and `revision` live at module scope outside `createDiningStore()`.
  - `selected` stores a `Unit` snapshot instead of `unitId`, so `QuickTableModal` misses live SSE updates; `id: Date.now()` risks same-millisecond booking ID collisions.

---

## Feature 9: Manager Console & Settings

- [x] **[F9-1] `[complexity: medium]` Non-functional Settings form** (`app/(manager)/manager/settings/page.tsx:50-110`)
  - All 6 `<TextField>` inputs (Lunch/Dinner Service Start/End, Turn Time) are uncontrolled `defaultValue` fields with no state, `onChange`, save action, or API/store persistence.
- [x] **[F9-2] `[complexity: low]` Broken 12-hour time sort** (`app/(manager)/manager/page.tsx:47`)
  - `a.time.localeCompare(b.time)` sorts 12-hour display strings lexicographically, placing `"01:00 PM"` before `"09:00 AM"`.
- [x] **[F9-3] `[complexity: low]` `GLOSSARY.md` terminology violation (`tables` vs `units`)** (`app/(manager)/manager/page.tsx:149,152`)
  - Displays `{seatedCount} tables` and `{availableCount} tables` instead of `units`.
- [x] **[F9-4] `[complexity: low]` Hardcoded `Manager` role label** (`components/manager/manager-nav-sidebar.tsx:200,376`)
  - Displays `· Manager` and a static `"MANAGER"` chip even when `currentStaff.role` is `'admin'`.
