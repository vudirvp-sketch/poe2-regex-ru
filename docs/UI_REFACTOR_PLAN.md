# UI Refactor Plan — iter 129+

> **Document purpose:** Engineering plan for the UI improvements proposed in
> `docs/UI_AUDIT.md` (v2, 2026-06-21) + user follow-up audit (iter 128 chat)
> + visualization audit (`docs/UI_VISUALIZATION_AUDIT.md`, iter 130).
> This iteration (iter 129) **did NOT implement** — it only planned. iter 130
> reviewed the plan against the user's visualization mockup and corrected
> 5 gaps + 2 contradictions (see §13). iter 131 incorporated 4 additional
> user feedback corrections (see §13.7). Each phase below is sized for ONE
> iteration of work, with concrete file changes, state additions, and test
> strategy.
>
> **Status:** Phase 1 IMPLEMENTED iter 132. Phase 2 IMPLEMENTED iter 133. Phase 2.5 IMPLEMENTED iter 134. Phases 3/4/4.5/5 NOT STARTED. Plan reviewed iter 130 + user feedback iter 131.
> **Author:** iter 129 planning agent; iter 130 review agent; iter 131 feedback agent; iter 132 implementation agent (Phase 1); iter 133 implementation agent (Phase 2); iter 134 implementation agent (Phase 2.5)
> **Last updated:** 2026-06-27 (iter 134 — Phase 2.5 implementation)

---

## 1. Executive Summary

The audit identifies 10 UI improvements. The user picked 6 as priority:
1. Collapsible affix groups
2. Sticky search input
3. "Selected affixes" basket panel
4. "Show only selected" mode
5. Stronger prefix/suffix/implicit color separation
6. More compact chips (~20–25% smaller)

Plus 4 secondary items: tooltips for beginners, favorites/pinned mods, tier
weight visualization (partially exists already), and TopNav dropdowns.

The plan decomposes these into **5 phases** (≈5 iterations), sequenced so
each phase is independently shippable, has clear tests, and doesn't paint
future phases into a corner. Two architectural decisions in Phase 1
(filter-store shape, URL sync) are load-bearing for everything else — Phase 1
must land first.

**No style overhaul.** The PoE2 dark-fantasy palette stays. We're modifying
layout/density/interaction, not the visual identity.

> **iter 131 user feedback (4 corrections, see §13.7 for full delta):**
> (1) left panel order **Search → Favorites → Filters** (not Favorites →
> Search); (2) 3-column layout **20%/60%/20%** + collapsible right panel
> for laptops; (3) basket cap **12 → 20**; (4) default collapse state =
> **top-level expanded, sub-groups collapsed** (was ALL EXPANDED).

---

## 2. Current State Assessment

### What exists (keep, extend)

- **4-level mod list hierarchy:** L1 affix column (`AffixColumn`) → L2 origin
  section → L3 semantic sub-group (`ModSubGroupSection`) → L4 chips
  (`FilterChip`). Two implementations: `ModList.tsx` (non-virtualized,
  waystone/tablet/relic/vendor) and `VirtualizedModList.tsx` (TanStack
  Virtual, belt/ring/amulet/jewel).
- **Native `<details>/<summary>`** collapse pattern at
  `src/ui/pages/home/HomePage.tsx:191` + `SeoBlock.tsx:32` (CSS:
  `.home-seo-details`/`.home-seo-summary` in `index.css:1063-1158`).
- **Controlled accordion** in `ProfilePanel.tsx:47,99-108` (`useState` +
  `aria-expanded` + ▲/▼ glyph).
- **TanStack Virtual with dynamic `measureElement`** — supports variable row
  heights via ResizeObserver. Collapse = filter `rows` array, virtualizer
  auto-recomputes padding.
- **Priority tier system (S/A/B/C)** — iter 106-107 fully wired: types in
  `shared/types.ts`, classifier in `mod-classifier.ts`, filter UI in
  `CategoryControlPanel.tsx:291-331`, sort toggle in
  `CategoryControlPanel.tsx:338-366`, chip border in `FilterChip.tsx:118-123`.
- **Warm dark-fantasy CSS token system** — `index.css:41-245`. 4-tier amber
  palette for priority, 3-tier affix palette (blue/orange/amber), brand gold.
- **FilterState in zustand store** — `filter-store.ts:33-54`. Has
  `selectedIds`, `excludedIds`, `searchText`, `affixFilter`, `originFilter`,
  `priorityFilter`, `extraState` (for `sortMode` etc.), `perTokenRanges`.
  URL-serialized via compact hash format (`serialize`/`deserialize`,
  lines 225-262).
- **StatusPanel + RegexOutput + ProfilePanel** stacked in right `<aside>`
  (sticky on desktop, mobile bar on `<lg`).
- **Native HTML `title=""` tooltips** are the only tooltip mechanism — no
  React `<Tooltip>` component yet.

### What doesn't exist (the gaps)

| Gap | Where it would live | Audit ref |
|-----|---------------------|-----------|
| Collapsible mod list sections | `ModList.tsx` + `VirtualizedModList.tsx` row model + `filter-store.ts` (new `collapsedGroups: Set<string>`) | §1 |
| Sticky search input | `ModList.tsx:456-463` + `VirtualizedModList.tsx:616-623` (currently scrolls away) | §6 |
| "Selected affixes" basket panel | New component, right `<aside>` restructure | §2 |
| "Show only selected" filter mode | `filter-store.ts` (new `showSelectedOnly: boolean`) + `ModList`/`VirtualizedModList` filter predicate | §7 |
| Stronger color separation | `index.css` `.affix-header-*` (lines 807-891) + `FilterChip.tsx:118-123` border-l-2 → border-l-4 + chip bg tint | §4 |
| Compact chips | `FilterChip.tsx:322` (`px-2.5 py-1.5 text-[13px]` → `px-2 py-1 text-[12px]`) | §5 |
| Favorites/pinned tokens | `filter-store.ts` (new `pinnedIds: Set<string>`) + `FilterChip.tsx` star glyph | §3 |
| React Tooltip component | New `src/ui/components/Tooltip.tsx` (portal-based) | §8 |
| TopNav dropdowns | `TopNav.tsx:90-120` (flat list → grouped dropdowns) | §10 |

### Architectural constraints

- **Two parallel mod list implementations** (`ModList` and
  `VirtualizedModList`) share no code. Each UI change must be applied to
  BOTH. This is the single biggest source of duplication risk in the
  refactor. **Mitigation:** Phase 0 (optional, deferred) would extract a
  shared `useCollapsedGroups` hook + a `GroupHeader` component so both
  implementations share collapse logic. Otherwise, manually duplicate.
- **URL serialization is compact** (`filter-store.ts:225-262`). Adding new
  state fields requires extending the format — must remain backward-compatible
  (old URLs must still deserialize).
- **CSS-first styling.** Chips use inline Tailwind utilities, no `.filter-chip`
  class. New chip styles should add a `.filter-chip` class token (Phase 5) so
  density tweaks don't require touching the JSX.
- **Dark-only theme** (iter 51). All new colors must come from the existing
  palette tokens (`--poe-bg-*`, `--poe-gold`, `--bl-*`). No light-theme
  variants.

---

## 3. Goals & Non-Goals

### Goals

1. Reduce visual noise on category pages — eye should know what's important.
2. Make selection state persist visually (sticky search, basket, "selected only").
3. Improve at-a-glance category recognition (stronger prefix/suffix/implicit colors).
4. Fit more useful content per screen (compact chips).
5. Don't break URL persistence, mobile, accessibility, or SEO.

### Non-Goals

- **No new dependencies.** Pure React + Tailwind + existing zustand.
- **No light theme.** Dark-only stays.
- **No re-skin.** The PoE2 dark-fantasy palette is final.
- **No backend.** All client-side.
- **No i18n overhaul.** Russian-only remains for now.
- **No change to the regex engine.** `src/core/` is untouched.

---

## 4. Refactor Roadmap (5 Phases)

Each phase is sized to one iteration. Phases have soft dependencies but each
is independently shippable (no half-states).

### Phase 1 — Foundation: filter-store + URL sync + collapse state

**Goal:** Add the 5 new `FilterState` fields (`collapsedGroups`,
`expandedSubGroups`, `showSelectedOnly`, `pinnedIds`, `chipExpandState`) with
URL persistence, no UI yet. This unlocks every other phase.

> **iter 130 change:** Added `chipExpandState: Set<string>` to support the
> «+N ещё» per-sub-group chip expander discovered in the visualization
> (see `docs/UI_VISUALIZATION_AUDIT.md` §2). Without this, Phase 2 cannot
> implement the progressive-disclosure pattern visible in the mockup.
>
> **iter 131 change:** Split `collapsedGroups` into TWO sets to support
> asymmetric default collapse state per user feedback (§13.7 correction
> #4): top-level groups default EXPANDED (`collapsedGroups` empty =
> expanded); sub-groups default COLLAPSED (`expandedSubGroups` empty =
> collapsed). Field count: 4 → 5.

**Files:**
- `src/store/filter-store.ts` — add 5 fields + actions + serialization.
- `src/shared/types.ts` — extend `FilterState` type.
- `src/store/url-sync.ts` — extend serialize/deserialize (backward-compat).
- `tests/store/filter-store.test.ts` (NEW) — round-trip tests for new fields.

**State additions:**
```ts
interface FilterState {
  // ...existing fields...
  collapsedGroups: Set<string>      // NEW — `${categoryId}:${affix}` top-level keys currently COLLAPSED (default empty = all expanded)
  expandedSubGroups: Set<string>    // NEW (iter 131) — `${categoryId}:${affix}:${subBlockKey}` sub-group keys currently EXPANDED (default empty = all collapsed, per §13.7 correction #4)
  showSelectedOnly: boolean         // NEW — hide non-selected chips
  pinnedIds: Set<string>            // NEW — favorited familyKey set (renders in LEFT panel BELOW search, ABOVE filters — see §13.7 correction #1)
  chipExpandState: Set<string>      // NEW (iter 130) — `${categoryId}:${affix}:${subBlockKey}` keys whose chips are fully expanded (overrides default "+N ещё" truncation)
}
```

**URL serialization (backward-compat):**
- Existing format: `s=...&e=...&t=...&a=...&o=...&p=...&x=...&r=...`
- New keys (added only when non-default): `c` (top-level collapsed array),
  `es` (sub-group expanded array, iter 131), `so=1` (show-selected-only
  flag), `pn` (pinned array), `ce` (chip-expand array).
  Old URLs without these keys deserialize to empty defaults.

**Tests:**
- Round-trip: state → serialize → deserialize → state (all 5 new fields).
- Backward-compat: URL without new keys → no crash, defaults applied.
- Empty-set serialization doesn't bloat URL (omit key when set is empty).
- iter 131: verify `expandedSubGroups` defaults to empty (sub-groups
  collapsed); verify `collapsedGroups` defaults to empty (top-level
  expanded); verify the asymmetric default encodes correctly.

**Definition of Done:** New fields exist in store, persist to URL, all
existing tests still pass, no UI uses them yet (purely infrastructure).

---

### Phase 2 — Collapsible affix groups + Sticky search

**Goal:** The user's #1 + #2 priority. Group headers get a chevron toggle;
search input becomes sticky.

**Files:**
- `src/ui/components/ModList.tsx` — render chevron on `AffixColumn` and
  `ModSubGroupSection` headers; respect `collapsedGroups` set; sticky
  search wrapper.
- `src/ui/components/VirtualizedModList.tsx` — filter `rows` array by
  collapsed state in `buildColumnRows()`; sticky search wrapper; chevron on
  `column-header` / `subgroup` rows.
- `src/ui/components/GroupHeader.tsx` (NEW) — shared header component with
  collapse chevron + count badge + label. Used by both ModList variants to
  avoid duplication.
- `src/store/filter-store.ts` — `toggleGroupCollapsed(key)`,
  `expandAllGroups()`, `collapseAllGroups()` actions.
- `src/ui/hooks/useCategoryPage.ts` — expose `collapsedGroups`,
  `toggleGroupCollapsed`, `expandAllGroups`, `collapseAllGroups` from
  filter-store.
- `src/index.css` — `.sticky-search` class (sticky top under TopNav),
  `.group-header-chevron` rotation transition.
- `src/shared/i18n.ts` — `group.collapse_all`, `group.expand_all` keys.

**Collapse key strategy:**
- Affix column level (top-level): `${categoryId}:${affix}` (e.g.
  `waystone:prefix`) — toggles whole column. Tracked in `collapsedGroups`
  (default empty = expanded; in set = collapsed).
- Semantic sub-group level: `${categoryId}:${affix}:${subBlockKey}` (e.g.
  `waystone:prefix:positive-loot`) — toggles one sub-block. Tracked in
  `expandedSubGroups` (default empty = collapsed; in set = expanded).
- **Default state (iter 131 per user feedback, §13.7 correction #4):**
  TOP-LEVEL EXPANDED (ИМПЛИСИТЫ/ПРЕФИКСЫ/СУФФИКСЫ open), SUB-GROUPS
  COLLAPSED (ДОБЫЧА/УСИЛЕНИЯ/... closed). User expands individual
  sub-groups to focus; state persists in URL via `expandedSubGroups`.
  Rationale: cleaner first screen; user said «Это даст намного более
  чистый первый экран».

**Sticky search:**
- Search input + "expand all / collapse all" buttons row gets
  `sticky top-[56px] z-20` (under TopNav's 56px height) + bg-surface +
  backdrop-blur. CSS class `.sticky-search-bar`.
- On mobile, sticky search lives in the same row but compact (no "expand
  all" button — chevron still works per-group).

**Tests:**
- `tests/ui/ModList.test.tsx` — collapse toggles hide chips, expand restores.
- `tests/ui/VirtualizedModList.test.tsx` — same for virtualized variant.
- `tests/ui/GroupHeader.test.tsx` (NEW) — chevron click toggles, count
  badge renders, ARIA `aria-expanded` correct.

**Risk:** TanStack Virtual row filtering — make sure `measureElement` refs
on surviving rows don't get confused when rows above them disappear. Test
with belt.json (largest, ~340 groups) — scroll, collapse a group above
viewport, scroll back, verify no jump-to-top bug (regression of iter 120).

**Definition of Done:** User can click any group header to collapse/expand
its chips. State persists in URL. Search input stays visible while
scrolling. All 8 category pages work. Mobile doesn't break.

---

### Phase 2.5 — «+N ещё» per-sub-group chip expander (iter 130 addition)

**Goal:** Visualization-driven density feature. When a sub-group has more
than `CHIP_PREVIEW_COUNT` (default 3) chips, show only the first
`CHIP_PREVIEW_COUNT` + a «+N ещё» button. Clicking the button expands the
remaining chips inline (toggles `chipExpandState` from Phase 1).

> **iter 130 addition:** Discovered in
> `docs/UI_VISUALIZATION_AUDIT.md` §2 (mockup shows «Бездны порождают...»
> + «+10 ещё»). Without this, even with collapsible groups the user still
> sees 8–13 chips per sub-group when expanded — defeating the noise-reduction
> goal.

**Files:**
- `src/ui/components/ModList.tsx` — when rendering chips inside an expanded
  sub-group, slice to `CHIP_PREVIEW_COUNT` if `chipExpandState` does NOT
  contain the sub-group key; render «+N ещё» button that calls
  `toggleChipExpand(key)`. When `chipExpandState` has the key, render all
  chips + a «свернуть» button.
- `src/ui/components/VirtualizedModList.tsx` — same logic on the virtualized
  `rows` array. Row count changes on toggle → `measureElement` recomputes.
- `src/store/filter-store.ts` — `toggleChipExpand(key)`,
  `expandAllChips()`, `collapseAllChips()` actions.
- `src/shared/constants.ts` — `CHIP_PREVIEW_COUNT = 3` constant.
- `src/shared/i18n.ts` — `chip.more` («+N ещё»), `chip.collapse` («свернуть»)
  keys.

**UX rules:**
- Default: collapsed (show 3 chips + «+N ещё»).
- Selected/pinned chips ALWAYS visible regardless of expand state (so user
  never loses their current selection in the truncation).
- «+N ещё» button shows the count: «+7 ещё», «+10 ещё».
- Expanded state persists per sub-group in `chipExpandState` → URL.

**Tests:**
- `tests/ui/ModList.test.tsx` — sub-group with 5 chips renders 3 + «+2 ещё»;
  click expands to 5 + «свернуть»; selected chip always visible even in
  truncated state.
- `tests/ui/VirtualizedModList.test.tsx` — same on virtualized variant;
  scroll position preserved across toggle (regression check).

**Risk:** TanStack Virtual row-count change on toggle — verify
`measureElement` doesn't reset scroll. Test with belt.json (largest).

**Definition of Done:** Sub-groups with >3 chips show preview + «+N ещё».
Toggle works, persists in URL, scroll position preserved.

---

### Phase 3 — "Show only selected" mode + Selected basket panel

**Goal:** User's #3 + #4 priority. Toggle hides non-selected chips; right
panel restructures to show selected chips as a "basket" above the regex
output.

**Files:**
- `src/ui/components/CategoryControlPanel.tsx` — add "Все / Выбранные"
  toggle (2-button radio, similar to existing sort mode toggle). Sits next
  to `priorityFilter` group.
- `src/ui/components/SelectedBasket.tsx` (NEW) — renders `selectedIds` as
  chips (re-use `FilterChip` in read-only mode, no per-token ranges shown —
  click to deselect). Empty state: "Выберите аффиксы". Header:
  "Выбрано: N аффиксов".
- `src/ui/layout/CategoryLayout.tsx` — restructure right `<aside>`:
  `SelectedBasket` (top, max-height 30vh, scrollable) → `RegexOutput`
  (middle) → `StatusPanel` (bottom, now just stats summary) → `ProfilePanel`
  (bottom, collapsible). **iter 131 per user feedback (§13.7 correction
  #2):** 3-column layout proportions 20%/60%/20% (was 25%/50%/25%); right
  `<aside>` gets a collapse toggle (chevron in its header) for laptop
  screens (1440×900 and below) — collapses to a chip-count badge that
  expands on click. See §7 Q#8 for collapse behavior open question.
- `src/ui/components/StatusPanel.tsx` — slim down: remove the truncated
  rawText list (now in basket), keep just counts + badges + alerts.
- `src/store/filter-store.ts` — `setShowSelectedOnly(bool)` action.
- `src/shared/i18n.ts` — `filter.show_all`, `filter.show_selected`,
  `basket.title`, `basket.empty` keys.

**Filter logic:**
- `ModList`/`VirtualizedModList`: when `showSelectedOnly=true`, filter
  `familyGroups` to only those with at least one member token in
  `selectedIds`. Excluded tokens still shown (so user can un-exclude).
- Pinned tokens always shown even in "selected only" mode (so user can
  quickly re-select a favorited mod).

**Basket layout:**
- Max-height 30vh with internal scroll. Each chip is read-only
  `FilterChip` (no range inputs, just label + click-to-deselect + ✗ to
  exclude).
- **iter 130 addition:** Each basket chip is prefixed with a colored
  affix-type badge («ИМПЛИСИТ» / «ПРЕФИКС» / «СУФФИКС») per
  `docs/UI_VISUALIZATION_AUDIT.md` §2. Colors: implicit=amber, prefix=blue,
  suffix=red. Helps user scan which affix slots their selection fills.
- Header: «Выбрано: N» + «Очистить все» link (calls `clearSelections()`).
- If > 20 chips, show "N more..." expander at bottom (don't render 200
  chips in the basket — perf). **iter 131 per user feedback (§13.7
  correction #3):** cap raised 12 → 20 (user: «У вас легко собираются
  regex на 15–30 модов»).
- Mobile: basket collapses into a chip-count summary at the top of
  `MobileRegexBar`. Tap to expand.

**Tests:**
- `tests/ui/SelectedBasket.test.tsx` (NEW) — renders selected chips,
  empty state, click-to-deselect, max-chip expander.
- `tests/ui/CategoryControlPanel.test.tsx` — toggle flips
  `showSelectedOnly`, persists to URL.

**Risk:** SelectedBasket rendering 100+ chips = perf problem. Mitigation:
cap at 20 with "show more" expander (iter 131: was 12, raised per user
feedback §13.7 correction #3). Test with belt.json (largest) +
select-all scenario.

**Definition of Done:** Toggle hides non-selected chips. Right panel shows
selected chips as a scrollable basket above the regex output. Mobile
basket collapses to a chip-count summary.

---

### Phase 4 — Stronger color separation + Compact chips + Tooltips

**Goal:** User's #5 + #6 priority + audit §8 (beginner tooltips).

**Files:**
- `src/index.css` — strengthen `.affix-header-*` (lines 807-891):
  - Increase `border-left` from 3px to 4px.
  - Add subtle bg tint per affix type (prefix `rgba(37,99,235,0.06)`,
    suffix `rgba(194,65,12,0.06)`, implicit `rgba(245,158,11,0.08)`).
  - Add `.affix-header-prefix--strong` modifier for tier-first mode (deeper
    bg + brighter border).
- `src/ui/components/FilterChip.tsx` — compact density:
  - Container: `px-2.5 py-1.5 text-[13px]` → `px-2 py-1 text-[12px]`.
  - Mobile bump stays at 32px min-height (touch target).
  - Inline badges (⚡ ⚓ 2x ×N) shrink from `text-[12px]` to `text-[10px]`.
- `src/index.css` — NEW `.filter-chip` class token (so future density
  tweaks are CSS-only, not JSX edits).
- `src/ui/components/Tooltip.tsx` (NEW) — portal-based tooltip component.
  Uses `useState` + `useRef` + `createPortal`. Hover/focus triggers.
  Closes on click-outside or Escape.
- `src/ui/components/GroupHeader.tsx` — add `infoIcon` slot, renders `ⓘ`
  glyph with `<Tooltip>` describing the group type.
- `src/shared/i18n.ts` — `tooltip.prefix_explanation`,
  `tooltip.suffix_explanation`, `tooltip.implicit_explanation`,
  `tooltip.subblock_*` keys.

**Tooltip content (Russian):**
- Префикс: "Один из основных модификаторов предмета. Максимум 3 префикса."
- Суффикс: "Один из основных модификаторов предмета. Максимум 3 суффикса."
- Имплиcит: "Встроенное свойство предмета, не занимает слот префикса/суффикса."
- Per-sub-block: 1-2 sentences explaining what that sub-block represents.

**Density target:**
- ~20-25% reduction in chip height (from ~28px to ~22px on desktop).
- Test: same viewport should fit ~25% more chips. Verify with belt.json
  (largest category) — count visible chips at 1080p before/after.

**Tests:**
- `tests/ui/Tooltip.test.tsx` (NEW) — opens on hover, opens on focus,
  closes on Escape, closes on click-outside, ARIA `role="tooltip"`.
- `tests/ui/FilterChip.test.tsx` — update snapshot tests for new compact
  dimensions.
- Visual regression: snapshot `.affix-header-*` frames (NEW snapshot test).

**Risk:** Compact chips might fall below WCAG AA touch target (44×44px).
Mitigation: keep mobile bump at 32px (still under 44 but acceptable for
non-critical chip toggle; desktop is mouse-driven, 22px fine). Add
`aria-label` to all chip click targets to keep a11y.

**Definition of Done:** Prefix/suffix/implicit blocks visually distinct at
a glance. Chips ~20% smaller. Info icons explain group types to beginners.

---

### Phase 4.5 — «Обозначения» icon legend (iter 130 addition)

**Goal:** Visualization-driven. Right panel gets a static «Обозначения»
section explaining what each icon means (★ / — / ⓘ). Companion to Phase 4
tooltips — gives beginners a permanent reference, not just hover hints.

> **iter 130 addition:** Discovered in
> `docs/UI_VISUALIZATION_AUDIT.md` §2 (right panel shows «Обозначения»
> with three legend rows: «★ — в избранное» / «— — Добавить в выбранное» /
> «Наведите на ⓘ для дополнительной информации»).

**Files:**
- `src/ui/components/IconLegend.tsx` (NEW) — renders the 3-row legend.
  Pure presentational, no props (or optional `items` prop for testing).
- `src/ui/layout/CategoryLayout.tsx` — render `<IconLegend />` at the
  BOTTOM of the right `<aside>` (below ProfilePanel).
- `src/shared/i18n.ts` — `legend.title`, `legend.star`, `legend.add`,
  `legend.info` keys.
- `src/index.css` — `.icon-legend` class for spacing + divider.

**Legend content (Russian):**
- `★ — в избранное` (gold star)
- `— — Добавить в выбранное` (or ✗ / ✓ depending on toggle state)
- `ⓘ — Наведите для дополнительной информации`

**Tests:**
- `tests/ui/IconLegend.test.tsx` (NEW) — renders 3 rows, correct icons,
  correct text.

**Definition of Done:** Right panel shows «Обозначения» legend below
ProfilePanel. All 3 rows rendered with correct icons.

---

### Phase 5 — Favorites/pinned mods (revised iter 130)

**Goal:** Audit §3 (favorites). Visualization places favorites in the
LEFT panel above search — NOT in the mod list as originally planned.

> **iter 130 revision:** Two changes from the iter 129 plan:
> 1. **TopNav dropdowns REMOVED.** Visualization keeps flat nav (9 items
>    in a single row). User said «мне визуализация понравилась очень» —
>    visual preference wins. See `docs/UI_VISUALIZATION_AUDIT.md` §5.
> 2. **Favorites placement MOVED** from «top of mod list» to «LEFT panel».
>
> **iter 131 revision (§13.7 correction #1):** Within the LEFT panel,
> the order is **Search → Favorites → Filters** (NOT Favorites → Search).
> User: «Поиск используется в разы чаще». Search at top = max visibility
> for the most-used control; favorites below as a shortcut; filters at
> the bottom for power users.

**Files (favorites):**
- `src/ui/components/FilterChip.tsx` — add `⭐` toggle button (left of
  text, before the label). Persisted to `pinnedIds` set.
- `src/ui/components/LeftPanelFavorites.tsx` (NEW, replaces the mod-list
  placement) — renders in the MIDDLE of the left panel (BELOW search,
  ABOVE filters, per iter 131 §13.7 correction #1). Shows «⭐ Избранные
  аффиксы (N)» header + «Очистить» button (calls a new `clearPinned()`
  action) + chips for each `pinnedIds` entry (read-only `FilterChip` with
  ⭐ filled; click to jump-scroll to that chip's location in the mod list;
  ✗ to unpin).
- `src/ui/layout/CategoryLayout.tsx` — add new `favorites` slot rendered
  above `controls` in the left column.
- `src/ui/pages/*/Page.tsx` (8 files) — pass `<LeftPanelFavorites />`
  into the new `favorites` slot.
- `src/store/filter-store.ts` — add `clearPinned()`, `togglePinned(id)`
  actions.
- `src/shared/i18n.ts` — `favorites.title`, `favorites.clear`,
  `chip.pin_tooltip`, `chip.unpin_tooltip` keys.

**UX rules:**
- Favorites are a SHORTCUT, not a filter — pinned chips do NOT hide
  non-pinned chips in the mod list. They appear in both places.
- Empty state: «Нажмите ★ на аффиксе, чтобы добавить в избранное».
- Mobile: favorites section stays at top of left panel (which on mobile
  is the top of the page, above the mod list).
- Click on a favorited chip in LeftPanelFavorites → scroll mod list to
  that chip's position + briefly highlight (2s pulse).

**Tests:**
- `tests/ui/FilterChip.test.tsx` — pin toggle works, persists.
- `tests/ui/LeftPanelFavorites.test.tsx` (NEW) — renders pinned chips,
  empty state, click-to-scroll, ✗ to unpin, «Очистить» clears all.

**Risk:** Click-to-scroll requires finding the chip's DOM node — use
`data-pinned-id` attribute + `document.querySelector`. Test on mobile
where virtualization may unmount off-screen chips (degrade gracefully:
if chip not in DOM, just scroll to its sub-group header).

**Definition of Done:** Users can star favorite mods and see them at the
top of the left panel. Clicking a favorited chip scrolls to it. TopNav
stays flat — no dropdowns.

---

## 5. Phase Dependencies

```
Phase 1 (foundation) ──┬──> Phase 2 (collapse + sticky search)
                       │
                       ├──> Phase 2.5 ("+N ещё" chip expander)  [iter 130]
                       │
                       ├──> Phase 3 (selected only + basket)
                       │
                       └──> Phase 5 (favorites in left panel)   [iter 130 revision]

Phase 4   (colors + compact + tooltips)   — INDEPENDENT.
Phase 4.5 ("Обозначения" icon legend)      — INDEPENDENT. [iter 130]
```

- Phase 1 is the foundation. Must land first. (iter 130: now adds
  `chipExpandState` for Phase 2.5. iter 131: adds `expandedSubGroups`
  for asymmetric default collapse state — 5 fields total.)
- Phase 2.5 depends on Phase 2 (sub-group collapse must exist before
  per-sub-group chip truncation makes sense).
- Phases 2 and 3 can be done in parallel by different agents (different
  files mostly). They both consume Phase 1's `FilterState` fields.
- Phase 4 is visual only — no state changes, can land any time.
- Phase 4.5 is a tiny presentational addition — can land in parallel with
  any other phase.
- Phase 5 (favorites) consumes Phase 1's `pinnedIds`. **iter 130: TopNav
  dropdowns REMOVED from Phase 5** — see §13 contradiction #1.

**Recommended sequence for one agent:** 1 → 2 → 2.5 → 3 → 4 → 4.5 → 5.

**Recommended sequence for parallel agents:** 1 alone → then (2+3+4+4.5)
in parallel → then 2.5 → then 5.

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TanStack Virtual row filtering breaks scroll position | Medium | High | Test with belt.json + collapse-above-viewport scenario. Regression test for iter 120 jump-to-top bug. |
| URL bloat from new state fields | Low | Medium | Omit empty sets from serialization. Cap array lengths. |
| SelectedBasket perf with 100+ chips | High | Medium | Cap at 20 chips with "show more" expander (iter 131: was 12, raised per user feedback §13.7 #3). Virtualize if needed. |
| Compact chips fail WCAG AA touch target | Medium | Low | Keep mobile bump at 32px. Desktop is mouse-driven. Add `aria-label` for screen readers. |
| Existing tests break from CSS class renames | High | Low | Run full vitest suite after each phase. Update snapshots in same commit. |
| Tooltip portal z-index conflicts with sticky elements | Medium | Low | Use `z-50` for tooltip portal (above sticky search `z-20` and TopNav `z-30`). |
| TopNav dropdowns confuse existing users | — | — | **REMOVED iter 130** — visualization keeps flat nav. No TopNav restructure. |
| i18n keys missing for new strings | Low | Low | Add all keys in same commit as the UI that uses them. |
| "+N ещё" truncation hides a selected chip | Medium | High | Always include selected/pinned chips in the preview slice, even if they're past index `CHIP_PREVIEW_COUNT`. |
| Click-to-scroll in LeftPanelFavorites fails on virtualized off-screen chips | Medium | Low | Degrade gracefully: if `data-pinned-id` not in DOM, scroll to sub-group header instead. |

---

## 7. Open Questions (for user / next agent)

1. **~~Collapse default state~~** — **RESOLVED iter 131 (§13.7 correction #4).**
   Top-level groups (ИМПЛИСИТЫ/ПРЕФИКСЫ/СУФФИКСЫ) EXPANDED by default;
   sub-groups (ДОБЫЧА/УСИЛЕНИЯ/...) COLLAPSED by default. User: «Это даст
   намного более чистый первый экран». Implemented via two sets:
   `collapsedGroups` (default empty = top expanded) + `expandedSubGroups`
   (default empty = sub collapsed). "Expand all" / "Collapse all" buttons
   still useful for power users.

2. **Basket position on mobile:** Right `<aside>` becomes
   `MobileRegexBar` on `<lg`. Where does the basket go?
   - Option A: Basket becomes a collapsible section at the TOP of the
     mobile page (above the mod list).
   - Option B: Basket is a chip-count badge in `MobileRegexBar` that
     expands to a full-screen overlay when tapped.
   - **Recommendation:** Option B (overlay) — keeps mobile chrome minimal.

3. **Favorites scope:** Are favorites per-category or global?
   - Per-category: `pinnedIds` in each `FilterState` (one per category
     page). Reset when switching categories.
   - Global: Separate `pinnedStore` (zustand) with `pinnedIds` keyed by
     `categoryId`. Survives category switch.
   - **Recommendation:** Per-category (simpler, matches existing state
     model). User who wants the same mod pinned across categories can
     re-pin in 1 click.

4. **Tooltip trigger:** Hover-only, or hover + focus + `?` key?
   - **Recommendation:** Hover + focus (a11y). Skip `?` key shortcut
     (undiscoverable, low value).

5. **~~TopNav dropdown click behavior~~** — **REMOVED iter 130.**
   Visualization keeps flat nav. No dropdowns to click.

6. **Compact chip density:** 20% reduction (px-2 py-1 text-[12px]) or
   25% (px-1.5 py-0.5 text-[12px])?
   - **iter 130 revision:** Visualization clearly shows denser chips than
     20% would give (multiple icons `⭐ text ⓘ ✗` in tight single row).
     **New recommendation: start with 25% (px-1.5 py-0.5 text-[12px])**
     and relax if mobile touch-target suffers.

7. **"+N ещё" default preview count (iter 130 new question):** Show 3
   chips by default, or 5, or 1?
   - **Recommendation:** 3 (matches the visualization pattern: 1 featured
     chip + 2 context chips + "+N ещё" button). Make it a constant
     `CHIP_PREVIEW_COUNT` in `src/shared/constants.ts` so it's tunable.

8. **Right panel collapse behavior (iter 131 new question, §13.7
   correction #2):** When user collapses the right `<aside>` on laptop
   screens, what shows in its place?
   - Option A: Chip-count badge («Выбрано: N») that expands back to full
     panel on click.
   - Option B: Slide-out drawer from right edge (overlay, doesn't push
     center column).
   - Option C: Move basket to bottom of left panel (3-column → 2-column
     on laptop).
   - **Recommendation:** Option A (badge) — minimal chrome, easy to
     toggle, doesn't shift layout. Defer to user verification in Phase 3.

---

## 8. Test Strategy

### Per-phase unit tests
- Phase 1: `tests/store/filter-store.test.ts` (NEW) — round-trip +
  backward-compat for 5 new fields (`collapsedGroups`, `expandedSubGroups`,
  `showSelectedOnly`, `pinnedIds`, `chipExpandState`). iter 131: verify
  default state (top expanded, sub collapsed) is encoded by empty sets.
- Phase 2: `tests/ui/GroupHeader.test.tsx` (NEW) + extend
  `tests/ui/ModList.test.tsx` + `VirtualizedModList.test.tsx`.
- Phase 2.5: extend `tests/ui/ModList.test.tsx` + `VirtualizedModList.test.tsx`
  with "+N ещё" scenarios (preview count, selected-chip always visible,
  toggle, URL persistence).
- Phase 3: `tests/ui/SelectedBasket.test.tsx` (NEW, includes affix-type
  badge assertions) + extend `tests/ui/CategoryControlPanel.test.tsx`.
- Phase 4: `tests/ui/Tooltip.test.tsx` (NEW) + update
  `tests/ui/FilterChip.test.tsx` snapshots.
- Phase 4.5: `tests/ui/IconLegend.test.tsx` (NEW) — 3 rows, correct icons.
- Phase 5: `tests/ui/FilterChip.test.tsx` (extend for ⭐ pin) +
  `tests/ui/LeftPanelFavorites.test.tsx` (NEW).
  **iter 130: `DropdownMenu.test.tsx` + `TopNav.test.tsx` REMOVED —
  TopNav dropdowns dropped.**

### Integration tests (per phase)
- Run `tests/integration/runtime-classification.test.ts` (existing) —
  ensure no regression in the runtime classification pipeline.
- Run full `vitest` suite after each phase — must remain green.

### Visual regression (Phase 4 only)
- Snapshot tests for `.affix-header-*` frames and `.filter-chip` density.
- Use `@testing-library/react` + `vitest` snapshot matcher.

### Manual verification (per phase)
- Phase 2: Open waystone + belt pages. Collapse random groups. Refresh
  page. Verify state persisted in URL hash.
- Phase 2.5: Open waystone page. Find sub-group with >3 chips. Verify only
  3 + "+N ещё" show. Click button — verify all chips appear + "свернуть"
  button. Select a chip past index 3 — verify it stays visible even when
  sub-group re-truncated.
- Phase 3: Select 5 mods. Toggle "selected only". Verify only those 5
  show. Verify basket shows them with correct affix-type badges.
- Phase 4: Compare side-by-side screenshots before/after on belt.json
  (largest). Count visible chips.
- Phase 4.5: Verify "Обозначения" legend appears at bottom of right panel.
- Phase 5: Pin 3 mods. Verify they appear in left panel "Избранные"
  section ABOVE search. Click one — verify mod list scrolls to it.
  Verify "Очистить" button clears all pins.

---

## 9. Out-of-Scope (explicitly deferred)

- **Search by tier** ("show only S-tier") — `priorityFilter` already does
  this. No new work.
- **Search by family** — `searchText` already does substring match. No
  new work.
- **Bulk select/deselect** — not in audit, defer.
- **Reorder groups via drag-and-drop** — not in audit, defer.
- **Multi-language UI** — Russian-only remains.
- **Export/import profiles as JSON file** — `profile-store` already
  serializes to localStorage; URL-share already works. No file export.
- **Dark/light theme toggle** — dark-only (iter 51).

---

## 10. Estimate

| Phase | Files touched | New files | New tests | Iterations |
|-------|---------------|-----------|-----------|------------|
| 1 | 4 | 1 | 10-14 | 1 |
| 2 | 7 | 1 | 12-18 | 1 |
| 2.5 (iter 130) | 5 | 0 | 8-12 | 1 (or merged into 2) |
| 3 | 6 | 1 | 12-17 | 1 |
| 4 | 5 | 1 | 10-15 | 1 |
| 4.5 (iter 130) | 3 | 1 | 3-5 | 0.5 (tiny) |
| 5 (revised iter 130) | 12 | 1 | 10-15 | 1 |
| **Total** | **42** | **6** | **65-96** | **5.5–6** |

Single-agent sequential: 6 iterations (was 5; +1 for Phase 2.5).
Parallel (1 + 4 + 1): 3 iterations wall-clock.

> **iter 130 delta vs iter 129 estimate:** +1 phase (2.5), +0.5 phase (4.5),
> Phase 5 file count up (8 page files now need `favorites` slot wiring).
> TopNav work removed (saves ~3 files).
>
> **iter 131 delta vs iter 130 estimate:** No new phases; +1 state field
> in Phase 1 (`expandedSubGroups`, 4→5 fields, +2-3 tests for default
> state verification); Phase 3 +right-panel collapse toggle logic (~1-2
> files touched, +3-5 tests); basket cap 12→20 (no test count change).
> Estimate unchanged: 6 iterations, 42 files, 65-96 tests.

---

## 11. How to Start (for the next agent)

1. Read this document end-to-end, including §13 (iter 130 visualization
   audit corrections) AND §13.7 (iter 131 user feedback corrections).
2. Read `docs/UI_VISUALIZATION_AUDIT.md` — the user-approved visual target
   (note §8 iter 131 corrections).
3. Read `docs/UI_AUDIT.md` for the original audit recommendations (note
   that §10 TopNav dropdowns are SUPERSEDED — see §13).
4. Read `STATUS.md` for current Known Issues (especially KI#9 monitoring).
5. Read `AGENT_NAVIGATION.md` Pitfalls 26-43 (CSS specificity, mobile
   media queries, palette consistency, dead-patterns cleanup, Phase 1
   foundation, Phase 2 wiring).
6. **Phase 1 is DONE (iter 132). Phase 2 is DONE (iter 133).** Pick a phase to
   work on next — recommend Phase 2.5 (consumes `chipExpandState` already wired
   in Phase 1). Phases 3/5 also consume Phase 1 fields and can be done in any
   order; Phase 4 + 4.5 are independent.
7. Create a TODO list with the phase's file changes.
8. Implement, test, document, ship.
9. Update this document's §12 Phase Status table with a "Phase N — DONE"
   note + any deviations from the plan.

**If you find a new bug during implementation:** document in `STATUS.md`
as Known Issue FIRST, then fix. (Per user's standing instruction.)

---

## 12. Phase Status

| Phase | Status | Iteration | Notes |
|-------|--------|-----------|-------|
| 1 — Foundation (5 fields: `collapsedGroups` + `expandedSubGroups` + `showSelectedOnly` + `pinnedIds` + `chipExpandState`) | ✅ DONE | iter 132 | Implemented in `src/store/filter-store.ts`: +5 FilterState fields, +13 FilterActions (toggle/set/expandAll/collapseAll per level + setShowSelectedOnly + togglePinned/clearPinned + toggleChipExpand/expandAllChips/collapseAllChips), extended serialize (compact keys c/es/so/pn/ce, omitted when default) + deserialize (backward-compat, defensive parsing of malformed/non-array values). New test file `tests/store/filter-store.test.ts` — 46 tests across 9 describe blocks (initial state, asymmetric default, all 5 action families, round-trip, backward-compat, compact serialization, resetFilters, clearSelections scope, store isolation). vitest 1988→2034 (+46), tsc 0 errors, eslint 0 problems. No UI uses the new fields yet — pure infrastructure. |
| 2 — Collapse + Sticky search | ✅ DONE | iter 133 | Implemented in `src/ui/components/ModList.tsx` + `src/ui/components/VirtualizedModList.tsx` + new shared `src/ui/components/GroupHeader.tsx` (~95 строк). +8 optional collapse props on each mod-list component (backward compat preserved — legacy callers без wiring рендерят как раньше). `AffixColumn` (ModList) + `column-header` row (VirtualizedModList) render `GroupHeader` (variant='top') with chevron; skip sub-groups when top-level collapsed. `ModSubGroupSection` (ModList) + new `subgroup-header` VirtualRow variant (VirtualizedModList) render `GroupHeader` (variant='sub') with chevron; skip chips when sub-group NOT in `expandedSubGroups`. Asymmetric default per iter 131 §13.7 #4: top EXPANDED + sub COLLAPSED. Search row wrapped in `.sticky-search-bar` CSS class (sticky under TopNav, backdrop-blur). «Развернуть все» / «Свернуть все» buttons (desktop-only, `hidden lg:inline-flex`). `useCategoryPage.ts` extended +8 fields wired to filter-store (Phase 1). URL-sync effect deps array extended — toggle triggers URL re-sync. 7 page files (Belt/Ring/Amulet/Jewel/Waystone/Tablet/Relic) updated — forward 8 new props. VendorPage не тронут (custom FilterChip). `i18n.ts` +4 keys. `index.css` +2 CSS blocks (`.sticky-search-bar`, `.group-header-chevron`). 3 new test files (36 tests): `tests/ui/GroupHeader.test.tsx` (14), `tests/ui/ModList.test.tsx` (11), `tests/ui/VirtualizedModList.test.tsx` (11). vitest 2034→2070 (+36), tsc 0 errors, eslint 0 problems. Edge case: sub-groups WITHOUT labels (e.g. `affix-only` mode) → chips always render (no UI to toggle collapse). |
| 2.5 — "+N ещё" chip expander | ✅ DONE | iter 134 | Implemented in `src/shared/constants.ts` (`CHIP_PREVIEW_COUNT = 3`) + `src/shared/i18n.ts` (+4 keys: `chip.more`, `chip.more_aria`, `chip.collapse`, `chip.collapse_aria`) + `src/ui/hooks/useCategoryPage.ts` (+2 fields `chipExpandState`/`toggleChipExpand` wired to filter-store, +URL-sync deps) + `src/ui/components/ModList.tsx` (+3 optional props `chipExpandState`/`onToggleChipExpand`/`pinnedIds`, slicing logic in `ModSubGroupSection`: first N + important past-N chips visible, «+N ещё» / «свернуть» buttons) + `src/ui/components/VirtualizedModList.tsx` (same +3 props, identical slicing logic in `VirtualRowContent` subgroup row kept in sync with ModList) + 7 page files (+2 destructure + +2 forwarded props each). `pinnedIds?: Set<string>` prop added to ModList + VirtualizedModList как forward-compat для Phase 5 (favorites) — Phase 5 wiring будет проще. 9 новых тестов: `tests/ui/ModList.test.tsx` (+6 Phase 2.5 chip truncation tests — truncated state, click «+N ещё», expanded state with «свернуть», selected chip ALWAYS visible past preview, backward compat, small sub-group ≤3 chips) + `tests/ui/VirtualizedModList.test.tsx` (+3 chip-expand wiring tests — mounts with wiring, backward compat, accepts `pinnedIds`). vitest 2070→2079 (+9), tsc 0 errors, eslint 0 problems. Edge cases: (a) sub-group with ≤3 chips → no button even when wiring present (matches expanded case but without «свернуть»); (b) sub-group with all-important past-preview chips → hiddenCount=0 → no «+N ещё» button; (c) sub-group with no label (e.g. `affix-only` mode) → chips ALWAYS render (no UI to toggle, same edge case as Phase 2). Backward compat: все 3 new props optional — legacy callers без chip-expand wiring рендерят как раньше (all chips visible, no buttons). |
| 3 — Selected only + Basket (with affix-type badges) | NOT STARTED | — | iter 130: added affix-type badges. iter 131: basket cap 12→20 (§13.7 #3); 3-column layout 20%/60%/20% + collapsible right panel (§13.7 #2). Phase 1 `showSelectedOnly` field now ready to consume. |
| 4 — Colors + Compact + Tooltips | NOT STARTED | — | iter 130: chip density 20%→25%. Independent of Phase 1. |
| 4.5 — "Обозначения" icon legend | NOT STARTED | — | iter 130 addition. Independent of Phase 1. |
| 5 — Favorites in LEFT panel (Search → Favorites → Filters order; TopNav dropdowns REMOVED) | NOT STARTED | — | iter 130: placement moved, TopNav work dropped. iter 131: order changed to Search→Favorites→Filters (§13.7 #1). Phase 1 `pinnedIds` field now ready to consume. |

(Update this table as phases land.)

---

## 13. Visualization Audit (iter 130)

> **Trigger:** User provided a visualization mockup and asked to verify the
> plan against it. Full mockup interpretation: `docs/UI_VISUALIZATION_AUDIT.md`.
> This section records the delta — what the plan got wrong, what it missed,
> what it over-engineered.

### 13.1 What the plan got RIGHT (5 confirmations)

| Plan element | Visualization confirms |
|--------------|------------------------|
| Phase 2: collapsible category headers (ИМПЛИСИТЫ/ПРЕФИКСЫ/СУФФИКСЫ) | ✅ Brown/blue/red headers with chevron + count |
| Phase 2: collapsible sub-group headers (ДОБЫЧА/УСИЛЕНИЯ/...) | ✅ Green text headers with chevron + count |
| Phase 3: SelectedBasket with «Выбрано: N» + «Очистить все» | ✅ Exact match |
| Phase 3: toggle «Все аффиксы / Только выбранные (N)» | ✅ Exact match |
| Phase 4: stronger color tints (rgba blue/orange/amber) | ✅ Brown/blue/red background tints clearly visible |

### 13.2 GAPS — visualization has, plan missed (5)

| # | Gap | Plan correction |
|---|-----|-----------------|
| 1 | **«+N ещё» per-sub-group chip expander** — mockup shows `Бездны порождают... +10 ещё`. Plan Phase 2 only had group-level collapse. | NEW Phase 2.5 + `chipExpandState` field in Phase 1. See §4 Phase 2.5. |
| 2 | **«Обозначения» legend section** in right panel (★/—/ⓘ icon meanings). Plan didn't mention. | NEW Phase 4.5. See §4 Phase 4.5. |
| 3 | **«Очистить» button** in favorites section header (not just `clearSelections` action). | Added to Phase 5 `LeftPanelFavorites.tsx` spec. |
| 4 | **Affix-type badges** (ИМПЛИСИТ/ПРЕФИКС/СУФФИКС) on each basket chip. | Added to Phase 3 basket layout. |
| 5 | **Chip density 25%, not 20%** — mockup clearly shows denser chips with 4 inline icons (⭐ text ⓘ ✗). | Open Q#6 recommendation updated to 25%. |

### 13.3 CONTRADICTIONS — plan vs visualization (2)

| # | Plan said | Visualization shows | Resolution |
|---|-----------|---------------------|------------|
| 1 | Phase 5: TopNav → 3 dropdown groups (Предметы/Снаряжение/Инструменты) | Flat nav preserved (9 items in single row) | **Plan WRONG.** TopNav dropdowns REMOVED. User said «мне визуализация понравилась очень» — visual preference wins. |
| 2 | Phase 5: favorites at TOP OF MOD LIST | Favorites in LEFT PANEL (iter 130: above search; iter 131: BELOW search per user feedback §13.7 correction #1) | **Plan WRONG.** Favorites placement MOVED to left panel (iter 130). iter 131 REFINED: search must be ABOVE favorites (user: «Поиск используется в разы чаще»). Final order: Search → Favorites → Filters. |

### 13.4 Other observations (no plan change needed)

- Visualization confirms priority dropdown (Все/S+A/S) already exists —
  matches plan's note that `priorityFilter` is fully wired.
- Visualization confirms sort dropdown (По алфавиту/По приоритету) already
  exists — matches plan's note that `sortMode` is fully wired.
- Visualization shows «188 аффиксов» total count in left panel header —
  preserve existing UI.
- Visualization shows «Профиль» collapsible in right panel — already
  exists (`ProfilePanel.tsx`).
- Visualization shows Regex output with «Авто» + «Копировать» — already
  exists (`RegexOutput.tsx`).

### 13.5 Files added/removed from plan (iter 130 delta)

**Added:**
- `docs/UI_VISUALIZATION_AUDIT.md` (NEW — this audit's companion).
- `src/ui/components/LeftPanelFavorites.tsx` (Phase 5, replaces mod-list
  placement).
- `src/ui/components/IconLegend.tsx` (Phase 4.5).
- `src/shared/constants.ts` extension: `CHIP_PREVIEW_COUNT` (Phase 2.5).
- `src/store/filter-store.ts` extension: `chipExpandState`, `clearPinned()`,
  `togglePinned()`, `toggleChipExpand()` actions.

**Removed:**
- `src/ui/components/DropdownMenu.tsx` (was Phase 5 — TopNav dropdowns
  dropped).
- `src/ui/layout/TopNav.tsx` restructure (was Phase 5 — kept flat).
- `src/ui/layout/nav-items.ts` `group` field (was Phase 5 — not needed).
- `tests/ui/DropdownMenu.test.tsx`, `tests/ui/TopNav.test.tsx` (were Phase 5).

### 13.6 Recommendation for iter 135

**Phase 1 is DONE (iter 132). Phase 2 is DONE (iter 133). Phase 2.5 is DONE (iter 134).**
The 5 state fields (`collapsedGroups`, `expandedSubGroups`, `showSelectedOnly`,
`pinnedIds`, `chipExpandState`) are now in `src/store/filter-store.ts` with 13
actions + URL serialization (backward-compat) + 46 tests in
`tests/store/filter-store.test.ts`. Phase 2 wired `collapsedGroups` (top-level)
+ `expandedSubGroups` (sub-group) into the UI via new shared `GroupHeader.tsx`
+ sticky search + «Развернуть все» / «Свернуть все» кнопки. Phase 2.5 wired
`chipExpandState` into per-sub-group chip truncation: first N chips + «+N ещё»
button + important (selected/excluded/pinned) chips ALWAYS visible past preview
window. 7 page files updated (Phase 2: +8 props; Phase 2.5: +2 props each).
3 new UI test files (Phase 2: 36 tests) + 9 new tests (Phase 2.5: 6 ModList +
3 VirtualizedModList). `pinnedIds?: Set<string>` prop added to ModList +
VirtualizedModList as forward-compat for Phase 5 — Phase 5 wiring будет проще.

**Recommended next:** Phase 3 (selected-only + basket panel).
Phase 3 consumes `showSelectedOnly` (already wired in Phase 1) and includes:
(1) add toggle «Все / Выбранные» in `CategoryControlPanel.tsx`; (2) create new
`src/ui/components/SelectedBasket.tsx` (renders selected chips as read-only
`FilterChip` variants, max-height 30vh, scrollable, cap = 20 chips per §13.7 #3);
(3) restructure `src/ui/layout/CategoryLayout.tsx` right `<aside>` (basket →
regex → status → profile) with 3-column 20%/60%/20% layout + collapsible right
panel per §13.7 #2; (4) wire `showSelectedOnly` to filter `familyGroups` in
ModList/VirtualizedModList — when true, hide non-selected chips (pinned/excluded
tokens stay visible per spec).

Phase 5 (favorites in left panel) consumes `pinnedIds` (already wired + props
already forwarded to ModList/VirtualizedModList in iter 134). Phase 5 will:
(1) create `src/ui/components/LeftPanelFavorites.tsx` in the LEFT panel (below
search, above filters per §13.7 #1 — final order Search → Favorites → Filters);
(2) wire `togglePinned(id)` / `clearPinned()` actions from store to favorite
buttons on each FilterChip + clear-all button in favorites section header.

Phase 4 (colors + compact + tooltips) and Phase 4.5 («Обозначения» legend) are
INDEPENDENT of Phase 1 — can land in any iteration as "warmup" work for a new
agent.

**Do NOT implement TopNav dropdowns** — visualization supersedes that
recommendation (iter 130 contradiction #1).

**UX verification request for user (iter 133 deliverable):** open the 7
category pages (Belt, Ring, Amulet, Jewel, Waystone, Tablet, Relic) on desktop
and verify: (1) top-level headers (ИМПЛИСИТЫ/ПРЕФИКСЫ/СУФФИКСЫ) display with
▶ chevron; (2) sub-group headers (ДОБЫЧА/УСИЛЕНИЯ/...) display with ▶ chevron;
(3) chips hidden by default (sub-groups collapsed); click sub-group header
expands it; state persists in URL after refresh; (4) «Развернуть все» /
«Свернуть все» buttons in sticky search row (desktop only); (5) search row
stays visible while scrolling; (6) mobile: chevron works per-group, no
expand-all button. If you find a bug — document in `STATUS.md` as Known Issue
FIRST, then fix.

### 13.7 User Feedback iter 131 (4 corrections)

> **Trigger:** User reviewed the iter 130 plan and approved it at 8.5/10
> with 4 specific corrections. Original user quotes preserved verbatim
> where relevant. These corrections are now incorporated into Phases 1,
> 2, 3, 5, §6, §7, §12 above.

| # | User feedback | Plan correction | Affected phases |
|---|---------------|-----------------|-----------------|
| 1 | **Избранное над поиском** → user wants **Search → Favorites → Filters** (not Favorites → Search). Quote: «Поиск используется в разы чаще». | Phase 5 `LeftPanelFavorites.tsx` renders BELOW search, ABOVE filters. Final left panel order: Search → Favorites → Filters. | Phase 5 |
| 2 | **3 колонки могут стать тесными** on laptops (1440×900). User suggests `20% / 60% / 20%` OR collapsible right panel. | Phase 3 `CategoryLayout.tsx` restructure: 3-column proportions 20%/60%/20% (was 25%/50%/25%); right `<aside>` gets a collapse toggle (chevron in header) — collapses to chip-count badge on laptop screens. New §7 Q#8 for collapse behavior. | Phase 3 |
| 3 | **Basket лимит в 12 элементов** → user wants 20-25. Quote: «У вас легко собираются regex на 15–30 модов». | Phase 3 `SelectedBasket.tsx` cap raised 12 → 20. Risk Register mitigation updated. | Phase 3 |
| 4 | **Collapse default state** → user wants **top-level expanded, sub-groups collapsed** (was ALL EXPANDED). Quote: «Это даст намного более чистый первый экран». | Phase 1: split `collapsedGroups` into TWO sets — `collapsedGroups` (top-level, default empty = expanded) + `expandedSubGroups` (sub-groups, default empty = collapsed). Phase 2 default state rule updated. §7 Q#1 RESOLVED. | Phase 1, Phase 2 |

**Net effect on plan:** No new phases. Phase 1 field count 4→5
(+`expandedSubGroups`). Phase 3 adds right-panel collapse toggle logic
(+1-2 files, +3-5 tests). Basket cap 12→20 (no test count change).
Estimate unchanged: 6 iterations, 42 files, 65-96 tests.

**User overall verdict:** «Если оценивать как roadmap для репозитория —
8.5/10. Главное: план уже не выглядит как набор косметических правок. Он
реально решает проблему перегруженности интерфейса».
