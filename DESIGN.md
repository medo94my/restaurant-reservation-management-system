---
name: Saffron & Cedar
description: Dark, warm operations console for a Levantine restaurant — gold ink on charcoal paper.
colors:
  saffron-gold: "#d7b46a"
  saffron-gold-hover: "#c6a06a"
  saffron-gold-bright: "#dfbd88"
  saffron-gold-soft: "#d0ae68"
  on-saffron: "#241b08"
  deep-charcoal: "#111312"
  rail-charcoal: "#111713"
  slate-panel: "#171a18"
  raised-surface: "#202421"
  chip-surface: "#242a25"
  active-surface: "#31372f"
  moss-border: "#343a34"
  moss-outline: "#414840"
  bone-cream: "#eee9df"
  warm-white: "#f1ede4"
  sage-muted: "#9ba198"
  sage-deep: "#969d94"
  service-green: "#72bd8d"
  terracotta-salmon: "#e07d72"
typography:
  title:
    fontFamily: "'Playfair Display', Georgia, serif"
    fontSize: "30px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  section-heading:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  card-title:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.55
  label:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.16em"
  login-display:
    fontFamily: "'Playfair Display', Georgia, serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.1
  brand-serif:
    fontFamily: "Georgia, serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: "8px"
  md: "11px"
  lg: "14px"
  xl: "17px"
  pill: "999px"
spacing:
  xs: "7px"
  sm: "11px"
  md: "17px"
  lg: "20px"
  xl: "23px"
components:
  button-primary:
    backgroundColor: "{colors.raised-surface}"
    textColor: "{colors.bone-cream}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "46px"
  button-gold:
    backgroundColor: "{colors.saffron-gold}"
    textColor: "{colors.on-saffron}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "46px"
  card-manager:
    backgroundColor: "{colors.slate-panel}"
    textColor: "{colors.bone-cream}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input-field:
    backgroundColor: "#151916"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.sm}"
    height: "37px"
  chip-filter:
    backgroundColor: "{colors.chip-surface}"
    textColor: "#c7ccc3"
    rounded: "9px"
    height: "43px"
  tab-active:
    backgroundColor: "{colors.active-surface}"
    textColor: "{colors.saffron-gold-soft}"
---

# Design System: Saffron & Cedar

## 1. Overview

**Creative North Star: "The Brass Ledger"**

A brass-bound ledger book from a fine Levantine restaurant: dark paper, cream ink, and gold used only for the entries that matter. Saffron & Cedar's interface is that ledger made operational — charcoal surfaces layered like stacked paper, warm sage-gray supporting text, and a single saffron-gold accent that behaves like gold ink: rare, deliberate, and always marking something worth finding.

Depth comes from tonal layering, not from shadows. Each surface level is one step warmer and lighter than the last (`#111312` → `#171a18` → `#202421` → `#31372f`), separated by 1px moss-green borders. Nothing floats until it's genuinely above the page (modals), and nothing glows except a live service indicator. The system is dense and desktop-first, tuned for a manager reading fast in a back office — 13px body, 700-weight labels, generous contrast throughout.

The system explicitly rejects fine-dining theatrics: no gold flooding, no ornate serif flourishes, no decorative gradients (per PRODUCT.md). Restraint *is* the brand.

**Key Characteristics:**
- One accent (saffron gold), ≤10% of any screen, always functional
- Tonal layering on a warm dark base; 1px moss borders do the separating
- DM Sans carries data at 12–13px; serif (Playfair/Georgia) only for brand voice
- Small radii (8–14px) — crisp paper edges, not pill-shaped softness
- Hover = a small lift (`translateY`), never a drop shadow
- Material Symbols Outlined as the only icon system

## 2. Colors: The Saffron & Moss Palette

A warm dark ledger: charcoal-green surfaces with cream ink, sage-gray margins, and saffron gold reserved for entries that matter.

### Primary
- **Saffron Gold** (#d7b46a): The one accent. Primary buttons, active tabs and nav, KPI highlights, icon tiles, links back to home. Often carried as `var(--restaurant-primary)` so manager branding can override it. Companion tones: **Gold Hover** (#c6a06a) for hover/focus borders, **Gold Bright** (#dfbd88) for icons on dark, **Gold Soft** (#d0ae68) for tracked label text.
- **On-Saffron** (#241b08): Near-black warm brown for text sitting on gold. Never white-on-gold.

### Secondary (status only)
- **Service Green** (#72bd8d): "Live/open" state — the live-service dot (with a matching `0 0 12px` glow), available units, positive counts. Variants: #9dd3a8, #a8d0ad on tinted grounds.
- **Terracotta Salmon** (#e07d72): Errors and alerts, with lighter #ffb7aa for text on dark. Never used decoratively.

### Neutral
- **Deep Charcoal** (#111312): Body background. The darkest paper.
- **Rail Charcoal** (#111713): Sidebar/manager-shell background — one step distinct from the page.
- **Slate Panel** (#171a18): Standard panel and card background.
- **Raised Surface** (#202421): Buttons, inputs' container, secondary chips.
- **Chip Surface** (#242a25): Filter chips; sits between panel and active.
- **Active Surface** (#31372f): Selected tab / active list item background.
- **Moss Border** (#343a34): The default 1px border on cards and panels.
- **Moss Outline** (#414840): Input borders and heavier separators.
- **Bone Cream** (#eee9df): Primary text. Variants #e8e5dc, #f1ede4 for fields and headings.
- **Sage Muted** (#9ba198): Secondary text, captions, inactive items. #969d94/#9eaa9d are the same family.

### Named Rules
**The Gilded Entry Rule.** Saffron gold appears only on things the manager must find or act on: the primary button, the active tab, the highlighted number, the back link. If gold is on more than ~10% of a screen, something is gilded that shouldn't be. Its rarity is the point.

## 3. Typography

**Display Font:** Playfair Display — loaded via `next/font/google` (weights 500–700, `display: swap`, self-hosted), exposed as `--font-playfair`; fallback Georgia, serif
**Body Font:** DM Sans — loaded via `next/font/google` (weights 400–700, `display: swap`, self-hosted), exposed as `--font-dm-sans`; fallback system sans-serif. `body` in `globals.css` defaults to it via `--md-ref-typeface-plain`.
**Brand Serif:** Georgia (system; sidebar wordmark + account monograms)
**Icons:** Material Symbols Outlined (variable opsz/wght/FILL/GRAD)

**Character:** A serif headline over a quiet sans body — the restaurant's voice says the title, then gets out of the way so numbers and names can be read fast. Weights are assertive (500–700) to survive the dark ground.

### Hierarchy
- **Title** (Playfair Display, 500, 30px, -0.025em tracking): Page titles in the console page head. The only place the serif speaks large.
- **Login Display** (Playfair Display, 500, clamp 42–72px): The login and setup screens' single hero line.
- **Section Heading** (DM Sans, 700, 20px): In-section headers and card group titles.
- **Card Title** (DM Sans, 700, 16px): Card labels.
- **Body** (DM Sans, 500, 13px): Default reading size — run sheets, descriptions, table content.
- **Small / Field** (DM Sans, 500, 12px): Inputs, dense table cells, helper text.
- **Label** (DM Sans, 700, 10px, 0.16em tracking, uppercase): Eyebrows and category markers, usually gold.
- **Brand Serif** (Georgia, 600, 15px): Sidebar wordmark only.

**Implementation status:** Both fonts are loaded in `app/layout.tsx` via `next/font/google`, attached to `<html>` as CSS variables (`--font-playfair`, `--font-dm-sans`). Font sizes ship in `rem` (16px root): body 13px→0.8125rem, small 12px→0.75rem, label 10px→0.625rem, title 30px→1.875rem, section/panel headings unified at 20px→1.25rem, login display `clamp(2.625rem,6vw,4.5rem)`. Sizes intentionally kept in px: Material Symbols icon rules, the `.checkbox` glyph, branding-editor preview miniatures, and the print stylesheet. Numeric data (`.stat-value`, `.res-time`, `.visit-count`) uses `font-variant-numeric: tabular-nums` so times and counts align vertically.

## 4. Elevation

Flat by design. Depth is tonal: surfaces step lighter and warmer as they rise (`#111312` body → `#171a18` card → `#202421` button → `#31372f` active), and 1px moss borders (`#343a34`, `#414840`) do the separating. Resting components carry no shadow.

### Shadow Vocabulary
- **Modal veil** (`0 24px 90px #0009` / `0 28px 80px rgba(0,0,0,.35)`): Only for true overlays — dialogs floating above the page.
- **Focus ring** (`var(--focus-ring)` at `0 0 0 2px` on inputs, `0 0 0 3px` on form fields): Gold-tinted ring for keyboard focus, tokenized once in `globals.css` (`--focus-ring: color-mix(in srgb, color-mix(in srgb, var(--restaurant-primary, #d7b46a) 97%, black) 16%, transparent)`). Always paired with a border shift to `color-mix(in srgb, var(--restaurant-primary, #d7b46a) 97%, black)`; inputs set `outline:none` so the ring is the single indicator. A global `:focus-visible` baseline (2px gold outline + 2px offset) covers every control without its own rule.
- **Live glow** (`0 0 12px #72bd8d88`): Exclusively the live-service dot. A green candle, not a design motif.
- **Inset hairline** (`inset 0 0 0 1px #45483a`): Reinforces selected-tab edges without a shadow.

### Named Rules
**The Lift, Don't Drop Rule.** Hover never adds a shadow. Affordance is signaled by a border-color shift to gold and a 1–2px `translateY` lift. Shadows are reserved for things that are actually floating.

**The One Veil Rule.** Overlays stack exactly one layer deep: the modal backdrop sits at `z-index: var(--z-backdrop)` (tokenized as 20 in `globals.css`). Nothing else in the product competes for a z-index.

**The Full-Bleed Console Rule.** Manager pages fill the viewport: `.manager-shell-content` is fluid (`width:100%`, no centered max-width cap). Content claims the space between the sidebar rail and the `clamp(16px,3vw,36px)` gutters; internal grids (columns, `auto-fill` tracks) do the adapting per breakpoint. Never re-introduce a centered page cap.

**The Side Drawer Rule.** Collection pages are tables, not forms. When creation needs a real form (staff accounts, passcode reset), the surface lives in a right drawer (`min(440px,100%)`, slides in 28px, shares the modal veil + backdrop at `var(--z-backdrop)`), opened by the page's primary action. Escape and backdrop click close it; the table carries only inline controls (role select, status pill) plus per-row secondary actions. Two-field creations may stay an inline row pinned above the table instead of a drawer (the guest book's "Add guest").

**The Settings Consolidation Rule.** All shared workspace configuration lives on `/manager/settings` behind pill tabs — Branding, Visit tiers, Occasion tags — with a debounced auto-save and a status pill (Synced / Saving… / All changes saved / Save failed). Collection pages assign and record data but never define shared config: the guests page assigns occasion tags and reads tiers; it does not edit them. If a new configurable knob appears, it gets a tab in Settings, not a panel on an operations page.

**The Guest Ledger Rule.** The guest book is a read-only customer registry — every booking registers its guest automatically, and the table (Guest, Lifetime visits, Tier, Tags, Note, Actions) never accepts inline edits. A toolbar above it filters by search (name or phone), visit tier, and occasion tag. All editing happens in the 460px right profile drawer (create/edit modes; tags are assigned inside). Tier pills are derived, never editable, from the visit tiers in Settings. Deleting a profile opens a confirmation dialog that requires the acting manager's own passcode (`POST /api/staff/verify-passcode`, sharing the sign-in throttle buckets). On ≤860px rows collapse to labeled stacked rows (`td::before` reading `data-label`), matching the staff table.

**The Printed Run Sheet Rule.** The `.run-sheet` section is a sibling of `<main class="app-shell">`, not a child — print hides `.app-shell` and the manager sidebar (`display:none !important`), then reveals the run sheet. Placeholders keep the sage voice `#92998f` at full opacity (global `::placeholder` rule); the UA's dimmed default is overridden.

## 5. Components

Refined and restrained: every control is a crisp-edged instrument — flat, bordered, and quiet until interacted with.

### Buttons
- **Shape:** radius 11px, min-height 46px (`0 16px` padding), 13px/600 label, inline-flex with centered content and 9px icon gap.
- **Surface variant (default):** bg `#202421`, text `#e8e5dc`, border `1px #41473f`. Hover: bg `#2a302b`, border `#77765e`. Uses `text-decoration:none` when rendered as a link.
- **Gold variant (`.primary`):** bg `var(--restaurant-primary, #d7b46a)`, text `var(--restaurant-background, #231d0f)`, border same as bg. Hover: `filter: brightness(1.08)`.
- **Small variant:** min-height 38px, `0 12px` padding, 12px font — toolbar and card-meta actions.

### Tabs
- **Shape:** radius 9px, `10px 17px` padding, inline-flex with 7px icon gap (icons are centered with text — never baseline-hung).
- **Rest:** transparent, text `#9ba198`. **Active:** bg `#31372f`, text `#e7c77f`, inset hairline `#45483a`.
- Used inside a bordered pill strip (`.tabs`: bg `#171a18`, border `#343a34`, radius 12px, 4px padding, 4px gap).

### Cards / Containers
- **Corner Style:** 14px (manager cards), 17px (modals).
- **Background:** `#171a18` on the `#111312` page; modals `#1d221e`.
- **Border:** `1px #343a34` (modals `#4b5148`).
- **Internal Padding:** 20px (cards), 23px (modals).
- **Hover:** border → `#c6a06a`, bg → `#1b211d`, `translateY(-2px)`. Focus-visible mirrors hover (no `outline:none` without the visual replacement).
- **Signature detail — the Gold Tile:** a 44×44px icon chip (radius 11px, bg `#d7b46a14`, border `#8d764866`, gold icon) opens most cards. It keeps icons perfectly centered regardless of adjacent text.

### Inputs / Fields
- **Style:** height 37px, radius 8px, `0 9px` padding, bg `#151916`, border `1px #414840`, text `#f1ede4`, 12px font. Full-width within their field.
- **Focus:** border → `#d0ad64` + gold ring `0 0 0 2px #d0ad6428`.
- **Error / Disabled:** error text uses `#e07d72`; disabled fields mute to sage tones.

### Chips
- **Style:** height 43px, `0 14px` padding, radius 9px, bg `#242a25`, border `#464d45`, text `#c7ccc3`, 700 weight. Filter/action toggles (party size, table type).
- **State:** selected chips shift to the active surface + gold text, mirroring tabs.

### Navigation
- **Sidebar (ManagerShell):** 68px collapsed rail / 250px expanded; bg `#111713`; Material Symbols icons with labels when open; active item gets bg `#30392f` + gold icon/text (`#dfbd88`) and `aria-current="page"`. Collapse toggle at the rail head; brand wordmark in Georgia 600 15px with a tracked 10px sage sub-label. Account/logout lives inside the sidebar.
- **Top of page:** page head with tracked gold eyebrow (or a "Manager home" back link), Playfair title, sage subtitle; live-service dot (green, glowing) with unit count on the right.

## 6. Do's and Don'ts

### Do:
- **Do** keep saffron gold (#d7b46a) rare and purposeful — the Gilded Entry Rule: primary actions, active states, highlights only.
- **Do** build depth with tonal layering (`#111312` → `#171a18` → `#202421` → `#31372f`) and 1px moss borders; never with resting shadows.
- **Do** signal hover with a border shift toward gold (#c6a06a/#c6a06a-family) plus a 1–2px `translateY` lift.
- **Do** center icons with flexbox (`inline-flex; align-items:center; gap`) and give icons a fixed tile when they lead a card — the Gold Tile pattern.
- **Do** pair focus rings with border-color changes: `border-color:#d0ad64; box-shadow:0 0 0 2px #d0ad6428`.
- **Do** use `var(--restaurant-primary)` (fallback #d7b46a) for anything that must follow the manager's branding settings.
- **Do** keep body copy at 13px/500 DM Sans on dark, secondary text at sage `#9ba198` — and verify 4.5:1 contrast when text sits on tinted chips.
- **Do** load the fonts you name: import Playfair Display and DM Sans via `next/font` so titles and body stop rendering in system fallbacks.

### Don't:
- **Don't** reach for fine-dining theatrics — "gold everywhere, ornate serif flourishes, decorative gradients" (PRODUCT.md anti-reference). Restraint is the point; the palette already carries the identity.
- **Don't** add side-stripe borders (a `border-left` > 1px accent on cards, callouts, or alerts). Full borders or background tints only.
- **Don't** use gradient text (`background-clip: text`), glassmorphism, or backdrop-blur decoration.
- **Don't** drop shadows on resting components — shadow is for modals, focus rings, and the live dot only (The Lift, Don't Drop Rule).
- **Don't** build the hero-metric template (giant number + gradient accent + stat row) — KPI numbers are plain 700-weight cream, highlighted with gold only where attention belongs.
- **Don't** let icons sit on the text baseline: never rely on `&nbsp;` spacing or `line-height:1` spans without a flex gap.
- **Don't** use white text on gold buttons — on-saffron is the warm near-black #241b08.
- **Don't** invent new surface colors for one-off states; step through the existing charcoal/slate ramp first.
