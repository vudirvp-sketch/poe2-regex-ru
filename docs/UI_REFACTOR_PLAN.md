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
> **Status:** Phase 1 IMPLEMENTED iter 132. Phase 2 IMPLEMENTED iter 133. Phase 2.5 IMPLEMENTED iter 134. Phase 3 IMPLEMENTED iter 135. Phase 5 IMPLEMENTED iter 136. Phase 4 + 4.5 IMPLEMENTED iter 137. **ВСЕ 7 ФАЗ UI REFACTOR DONE.** Plan reviewed iter 130 + user feedback iter 131.
> **Author:** iter 129 planning agent; iter 130 review agent; iter 131 feedback agent; iter 132 implementation agent (Phase 1); iter 133 implementation agent (Phase 2); iter 134 implementation agent (Phase 2.5); iter 135 implementation agent (Phase 3); iter 136 implementation agent (Phase 5); iter 137 implementation agent (Phase 4 + 4.5)
> **Last updated:** 2026-06-27 (iter 137 — Phase 4 + 4.5 implementation)

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
  `extraState` (for `sortMode` etc.), `perTokenRanges`. (iter 149: `priorityFilter` removed.)
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
  to the sortMode `<select>` (iter 149: was `priorityFilter` group — feature removed).
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

- **Search by tier** ("show only S-tier") — iter 149: `priorityFilter` was
  removed; use `sortMode='tier-first'` to surface S-tier mods at top of each
  block instead of filtering.
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
5. Read `AGENT_NAVIGATION.md` Pitfalls 26-45 (CSS specificity, mobile
   media queries, palette consistency, dead-patterns cleanup, Phase 1
   foundation, Phase 2 wiring, Phase 2.5 chip expander, Phase 3 selected-only
   + basket).
6. **Phase 1 is DONE (iter 132). Phase 2 is DONE (iter 133). Phase 2.5 is DONE
   (iter 134). Phase 3 is DONE (iter 135).** Pick a phase to work on next —
   recommend Phase 5 (consumes `pinnedIds` already wired in Phase 1 + props
   already forwarded to ModList/VirtualizedModList in iter 134). Phases 4 + 4.5
   are independent of Phase 1 — good warmup work for a new agent.
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
| 3 — Selected only + Basket (with affix-type badges) | ✅ DONE | iter 135 | Implemented in `src/shared/constants.ts` (`SELECTED_BASKET_CAP = 20` per iter 131 §13.7 #3) + `src/shared/i18n.ts` (+16 keys: `filter.show_all`/`show_selected`/`show_mode_label`, `basket.*` family — title/empty/clear/more/collapse/unselect_aria, `basket.badge_implicit`/`prefix`/`suffix`, `basket.collapse_panel`/`expand_panel`) + `src/ui/hooks/useCategoryPage.ts` (+2 fields `showSelectedOnly`/`setShowSelectedOnly` wired to filter-store, +URL-sync deps) + NEW `src/ui/components/SelectedBasket.tsx` (~220 строк — renders ONE chip per selected FAMILY via `groupTokensByFamily`, colored affix badges ПРЕФ=blue/СУФ=orange/ИМПЛ=amber per iter 130 visualization gap #4, cap=20 with «+N ещё»/«свернуть» expander, click-to-deselect, empty state, clear-all link, max-height 30vh scroll, `role="button"` + `tabIndex=0` + Enter/Space keydown + aria-label) + `src/ui/components/CategoryControlPanel.tsx` (+3 optional props `showSelectedOnly`/`onSetShowSelectedOnly`/`selectedCount`, toggle radio group «Все / Выбранные ({n})» after sortMode, «Выбранные» button disabled when `selectedCount === 0`, arrow-key navigation via existing `handleRadioKeyDown`) + `src/ui/layout/CategoryLayout.tsx` (full rewrite: +1 optional prop `basket`, local state `rightPanelCollapsed` NOT persisted to URL, grid `1fr_320px` → `1fr_48px` when collapsed per iter 131 §13.7 #2, aside header with ⚙ icon + chevron toggle, aside body collapses to header-only, mobile: basket always visible above status) + `src/ui/components/ModList.tsx` + `src/ui/components/VirtualizedModList.tsx` (+1 optional prop `showSelectedOnly`, new `visibleGroups` useMemo chains priority filter + show-selected-only filter — kept in sync between ModList + VirtualizedModList, `implicitGroups`/`prefixGroups`/`suffixGroups` + stats line use `visibleGroups`) + 7 page files (+1 import SelectedBasket, +2 destructure, +3 CategoryControlPanel props, +1 CategoryLayout basket prop, +1 VirtualizedModList/ModList prop each). VendorPage не тронут. 20 новых тестов: `tests/ui/SelectedBasket.test.tsx` (NEW, 12 tests — empty state, one chip per family not per token, affix badges ПРЕФ/СУФ/ИМПЛ, clear-all calls onClearSelections, click chip calls onToggleTokens with member IDs, Enter key, cap=20 renders all when ≤ cap, truncates + «+N ещё» when > cap, click «+N ещё» reveals all + «свернуть», click «свернуть» re-truncates, category prop optional) + `tests/ui/ModList.test.tsx` (+6 tests — default all chips, showSelectedOnly=true only selected families, excluded stay visible, pinned stay visible Phase 5 forward-compat, no selections → no chips, stats line shows filtered count) + `tests/ui/VirtualizedModList.test.tsx` (+2 tests — mounts with showSelectedOnly=true via stats line count assertion since jsdom renders 0 virtualized rows, backward compat without prop). vitest 2079→2099 (+20), tsc 0 errors, eslint 0 problems. Edge cases: (a) `selectedCount === 0` → «Выбранные» button disabled (visual cue + cursor-not-allowed + onClick early-return — prevents entering empty selected-only mode); (b) basket cap = 20, NOT 12 (raised per user feedback §13.7 #3); (c) collapsible right panel uses LOCAL state (NOT persisted to URL — transient view-mode toggle; if user feedback wants persistence, add `rpc` boolean field to filter-store); (d) basket renders ONE chip per family group (via `groupTokensByFamily`), NOT per token — matches the FilterChip rendering in ModList so the user sees the same chip identities in both places. Backward compat: все 4 new props optional — legacy callers без wiring рендерят как раньше (all chips visible, no toggle, no basket, no collapse chevron). |
| 4 — Colors + Compact + Tooltips | ✅ DONE | iter 137 | Implemented in `src/shared/i18n.ts` (+8 keys: tooltip.prefix/suffix/implicit_explanation, tooltip.info_aria, legend.* — wait, legend.* is Phase 4.5; Phase 4 i18n keys: tooltip.prefix/suffix/implicit_explanation + tooltip.info_aria only, 4 keys) + `src/index.css` (stronger bg tints на `.affix-header-prefix/suffix/implicit` — border-left 3px → 4px, bg alpha 0.08/0.03 → 0.14/0.06, border-color alpha 0.15 → 0.20, border-left-color alpha 0.5 → 0.65; NEW `--strong` modifier (`.affix-header-prefix--strong` и т.д.) — deeper bg (alpha 0.22/0.10) + brighter border-left (alpha 0.85) for tier-first mode — CSS ready, wiring deferred; NEW `.filter-chip` CSS class token — min-height 22px desktop / 32px mobile (touch target a11y), future density tweaks CSS-only) + NEW `src/ui/components/Tooltip.tsx` (~280 строк — portal-based via `createPortal(... document.body)`, hover 350ms + focus no-delay triggers, closes on click-outside (global mousedown) + Escape (LOCAL onKeyDown on trigger button — NOT global keydown listener, see Pitfall 47 for critical bug found+fixed during Tooltip tests), ARIA: role="tooltip" + aria-describedby + aria-expanded, viewport-edge clamping + top/bottom flip, max-width 280px, recomputes position on viewport resize) + `src/ui/components/FilterChip.tsx` (Phase 4.3 compact density: container `px-2.5 py-1.5 text-[13px] gap-1.5` → `px-1.5 py-0.5 text-[12px] gap-1` + `.filter-chip` class token; inline badges (⚡ ⚓ 2x ×N range) `text-[12px]` → `text-[10px]`; mobile touch target floor 32px via CSS media query) + `src/ui/components/GroupHeader.tsx` (Phase 4.4 — +1 optional prop `infoTooltip?: React.ReactNode`; when provided → renders `<Tooltip content={infoTooltip} ariaLabel={t('tooltip.info_aria')} />` как SIBLING кнопки (NOT child — click must NOT toggle collapse); component structure: `<div className="flex items-center gap-1 w-full"><button>...</button>{infoTooltip && <Tooltip .../>}</div>`) + `src/ui/components/ModList.tsx` + `src/ui/components/VirtualizedModList.tsx` (wired `infoTooltip={affix === 'prefix' ? t('tooltip.prefix_explanation') : affix === 'suffix' ? t('tooltip.suffix_explanation') : t('tooltip.implicit_explanation')}` на top-level `<GroupHeader variant="top" />` when top-level collapse wiring is present; legacy static text path не тронут). **Tests:** +24 (16 Tooltip NEW + 4 GroupHeader infoTooltip + 4 FilterChip compact density). vitest 2124→2148, tsc 0, eslint 0. **Critical bug found+fixed during Tooltip tests:** initial Escape implementation used local `onKeyDown` on button + `triggerRef.current?.focus()` после `closeImmediate()` — calling `.focus()` on trigger after closing re-fired `handleFocus` → `openTooltip()` → `setOpen(true)`, re-opening tooltip immediately. Fix: removed `.focus()` call (button already has focus when Escape pressed) + kept local onKeyDown only (no global keydown listener — React 19 + jsdom flushing issues with native listeners). **Backward compat:** все new props optional (`infoTooltip` на GroupHeader) — legacy callers без wiring рендерят как раньше (no ⓘ icon, no .filter-chip class effect beyond min-height). |
| 4.5 — "Обозначения" icon legend | ✅ DONE | iter 137 | Implemented in `src/shared/i18n.ts` (+4 keys: legend.title «Обозначения», legend.star «★ — в избранное», legend.exclude «✗ — исключить аффикс (не хочу)», legend.info «ⓘ — наведите для подсказки») + `src/index.css` (+`.icon-legend` + `__title` + `__row` + `__icon` CSS classes — margin-top 8px + padding 10px 12px + border-top + bg + border-radius; title 11px font-weight 600 uppercase letter-spacing 0.08em; rows flex gap 6px font-size 12px line-height 1.4; icon inline-block width 1.2em text-align center font-weight 700) + NEW `src/ui/components/IconLegend.tsx` (~75 строк — static 3-row legend, pure presentational, optional `items` prop for testing, semantic `<ul>/<li>` structure, icons `aria-hidden` (decorative — text conveys meaning), section `aria-labelledby` pointing to title element) + `src/ui/layout/CategoryLayout.tsx` (+1 optional prop `legend?: React.ReactNode` — rendered at BOTTOM of right `<aside>` below ProfilePanel; also rendered in mobile section when `hasMobileBar`; when omitted → no legend (backward compat)) + 7 page files (Belt/Ring/Amulet/Jewel/Waystone/Tablet/Relic — each: +1 import IconLegend, +1 prop to `<CategoryLayout>` `legend={<IconLegend />}` rendered after `sidebar={...}` block, before `mobileBar={...}`; VendorPage не тронут — no CategoryLayout). **Tests:** +10 (NEW `tests/ui/IconLegend.test.tsx` — renders title, 3 default rows, row 1 ★ icon + text, row 2 ✗ icon + text, row 3 ⓘ icon + text, icons aria-hidden, section aria-labelledby pointing to title, semantic ul/li structure, accepts custom items prop, renders 0 rows when items=[] edge case). vitest 2148→2158, tsc 0, eslint 0. **Backward compat:** `legend` prop optional — legacy callers без wiring рендерят как раньше (no legend panel). |
| 5 — Favorites in LEFT panel (Search → Favorites → Filters order; TopNav dropdowns REMOVED) | ✅ DONE | iter 136 | Implemented in `src/shared/i18n.ts` (+10 keys: `favorites.title`/`empty`/`clear`/`clear_aria`/`unpin_aria`/`scroll_aria`, `chip.pin_tooltip`/`unpin_tooltip`/`pin_aria`/`unpin_aria`) + `src/ui/hooks/useCategoryPage.ts` (+3 fields `pinnedIds`/`togglePinned`/`clearPinned` wired to filter-store Phase 1, +URL-sync deps) + NEW `src/ui/components/LeftPanelFavorites.tsx` (~230 строк — renders ONE chip per favorited FAMILY via `groupTokensByFamily` reused from SelectedBasket, ⭐ filled icon + colored affix badges ПРЕФ=blue/СУФ=orange/ИМПЛ=amber matching SelectedBasket visualization, click chip body → scroll-to-mod via `document.querySelector('[data-family-key="<familyKey>"]')` + `scrollIntoView({behavior:'smooth', block:'center'})` + 2s `.favorite-pulse` gold/amber CSS animation, degrades gracefully when chip virtualized out of DOM, click ✗ → `onTogglePinned(memberIds)` unpins, «Очистить» link → `onClearPinned()`, empty state placeholder, max-height 30vh scroll, `role="button"` + `tabIndex=0` + Enter/Space keydown + aria-label) + `src/ui/components/FilterChip.tsx` (+2 optional props `pinnedIds`/`onTogglePinned`, +`data-family-key={group.familyKey}` attribute on wrapping div, ⭐ icon button left of label — filled `★` (text-accent-amber-soft) when isPinned / outline `☆` (text-muted) when not, `aria-pressed={isPinned}`, `e.stopPropagation()` in handlePinClick prevents selection toggle, sibling of `role="switch"` div — valid ARIA tree) + `src/ui/layout/CategoryLayout.tsx` (+1 optional prop `favorites`, rendered ABOVE `controls` в left column — final spec order Search → Favorites → Filters per iter 131 §13.7 #1; Search is sticky inside ModList from Phase 2, so initial visual order is Header → Favorites → Filters → Search (sticky) → ModList; after scroll Search sticks to top of viewport as primary control) + `src/ui/components/ModList.tsx` + `src/ui/components/VirtualizedModList.tsx` (+1 optional prop `onTogglePinned`, prop chain ModList → AffixColumn → ModSubGroupSection → FilterChip + direct FilterChip usages, `pinnedIds` prop already existed from iter 134 forward-compat — only `onTogglePinned` is new) + `src/index.css` (+`.favorite-pulse` CSS class — 2s ease-out gold/amber animation, runs once via `animation-iteration-count: 1`, matches PoE2 gold tone `rgba(212, 175, 55, 0.x)`) + 7 page files (+2 imports `LeftPanelFavorites` + `useCallback` from react, +3 destructure `pinnedIds`/`togglePinned`/`clearPinned`, +`handleTogglePinned` useCallback wrapper as signature adapter between FilterChip's `(ids: string[]) => void` and store's `(id: string) => void`, +1 CategoryLayout `favorites` prop, +2 VirtualizedModList/ModList props `pinnedIds` + `onTogglePinned`). VendorPage не тронут (custom FilterChip — no ModList). 25 новых тестов: `tests/ui/LeftPanelFavorites.test.tsx` (NEW, 17 tests — empty state, one chip per family not per token, affix badges, ⭐ filled icon, header count, ✗ unpin calls onTogglePinned with member IDs, «Очистить» calls onClearPinned, «Очистить» NOT rendered in empty state, click-to-scroll calls querySelector with data-family-key selector, scrollIntoView called with smooth/center args, favorite-pulse CSS class added then removed after 2s via classList spy on real HTMLElement, degrades gracefully when chip not in DOM (null return), Enter + Space keys trigger scroll, category prop optional, max-height 30vh + overflow-y-auto layout) + `tests/ui/FilterChip.test.tsx` (+8 tests Phase 5 describe block — ⭐ NOT rendered when pinnedIds omitted backward compat, ⭐ NOT rendered when onTogglePinned omitted backward compat, ☆ outline when not pinned, ★ filled when any member pinned, click ⭐ calls onTogglePinned with member IDs, click ⭐ does NOT call onToggleTokens stopPropagation, aria-pressed reflects state, data-family-key attribute on wrapping div). vitest 2099→2124 (+25), tsc 0 errors, eslint 0 problems. Edge cases: (a) when BOTH `pinnedIds` AND `onTogglePinned` not provided → ⭐ NOT rendered (backward compat — pre-Phase-5 callers render plain FilterChip); (b) click-to-scroll degrades gracefully when chip virtualized out of DOM (mobile / long list) — `querySelector` returns null, `instanceof HTMLElement` check fails, no-op; (c) signature adapter pattern: FilterChip's `onTogglePinned: (ids: string[]) => void` vs store's `togglePinned: (id: string) => void` — wrapped with `useCallback((ids) => ids.forEach(id => togglePinned(id)), [togglePinned])` at page level for stable reference (preserves React.memo on FilterChip); (d) ⭐ icon button is SIBLING of `role="switch"` div (NOT child) — valid ARIA tree; `stopPropagation` defensively prevents click from also toggling selection; (e) `pinnedIds?: Set<string>` prop был добавлен в iter 134 как forward-compat (Pitfall 44) — Phase 5 добавляет только `onTogglePinned` prop + wiring, NO rework needed. Backward compat: все new props optional (`pinnedIds` + `onTogglePinned` на FilterChip/ModList/VirtualizedModList; `favorites` на CategoryLayout) — legacy callers без wiring рендерят как раньше (no ⭐ icon, no favorites panel, no data-family-key attribute, no scroll-to-mod). |

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

- Visualization confirms priority dropdown (Все/S+A/S) **was** present (iter 148).
  iter 149 removed it entirely — tier info now surfaces via FilterChip badge +
  `sortMode='tier-first'` only.
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

### 13.6 iter 141 reference (archive)

**ВСЕ 7 ФАЗ UI REFACTOR DONE (iter 132-137) + iter 138 `--strong` + iter 139 KI#16-20 (FIXED+VERIFIED iter 140) + iter 140 KI#21-25 (FIXED) + iter 141 KI#26-29 (FIXED, pending browser verification) + KI#30/31 monitoring + iter 142 documentation cleanup + design proposals.**

**iter 141 deliverables (4 fixes + 2 monitoring):**

- **KI#26 (FIXED):** round10 default off + global settings cross-tab persistence. `defaultRound10` true→false per user explicit request. NEW `src/store/local-settings.ts` (thin localStorage wrapper with JSON serialize + try/catch silent fallback). В `useCategoryPage.ts` 6 useState-backed global settings (`searchLogic`, `round10Enabled`, `minValue`, `maxValue`, `thresholdEnabled`, `sortMode`) теперь читаются из localStorage если URL не задал значение, и пишутся в localStorage при каждом изменении. Precedence: URL > localStorage > default. (iter 149: `priorityFilter` was the 7th — removed entirely.)
- **KI#27 (FIXED):** VirtualizedModList prefix/suffix 50/50 alignment. iter 139 KI#17 fix (`md:grid-cols-2`) был применён ТОЛЬКО к `ModList.tsx`, но НЕ к `VirtualizedModList.tsx` — там осталось `md:grid-cols-[2fr_3fr]` (40/60 split). Fix: одна строка заменена на `md:grid-cols-2`. **Lesson: при fixed-bug-in-one-place, audit ALL similar components.**
- **KI#28 (FIXED):** Favorites counter — 1 per family, not N per tier. `handleTogglePinned` в 7 pages simplified from `ids.forEach(id => togglePinned(id))` to `if (ids.length > 0) togglePinned(ids[0])`. `pinnedIds.size` теперь = число favorited семей.
- **KI#29 (FIXED):** Aside collapse header упрощён. CategoryLayout.tsx aside header rewritten — removed `bg-panel border p-2` panel wrapper + empty `<span>` title placeholder. Новая structure: compact `flex items-center justify-end gap-1` row + small chevron button.
- **KI#30 (MONITORING — not fixed):** Cross-tab persistence favorites (pinnedIds). Design proposal — в `docs/ITER142_PROPOSALS.md` §2. Отложено на iter 143+ (требует user decision).
- **KI#31 (MONITORING — not fixed):** Favorites как quick-select feature. Design proposal — в `docs/ITER142_PROPOSALS.md` §3. Отложено на iter 143+ (требует UX design + user feedback).

**iter 141 changes:** NEW `src/store/local-settings.ts`, `src/ui/hooks/useCategoryPage.ts` (defaultRound10 true→false + 7 useState initializers + URL-sync effect + restoreFilterState), `src/ui/components/VirtualizedModList.tsx` (1-line grid-cols fix), 7 page files (`handleTogglePinned` simplified), `src/ui/layout/CategoryLayout.tsx` (aside header rewrite), NEW `tests/store/local-settings.test.ts` (8 tests), NEW `tests/ui/CategoryLayout.test.tsx` KI#29 describe block (4 tests), NEW `tests/ui/VirtualizedModList.test.tsx` KI#27 describe block (1 test). vitest 2177→2190 (+13 net), tsc 0, eslint 0.

### 13.7 Recommendation for iter 142 (DONE — documentation only) → iter 143 (awaiting user input)

**iter 142 completed as documentation-only iteration** — без кодовых изменений, согласно правилу «лучше недоделать, чем сломать». Все 3 активные KI (KI#23/30/31) требуют либо browser testing (KI#23), либо UX design решения от user (KI#30/31) — реализация без discussion была бы guesswork.

**iter 143 (current): awaiting user input — no code changes.** Все 3 приоритета iter 143 заблокированы user-dependent решениями: (1) UX verification KI#26/27/28/29 требует user browser testing (агент не имеет доступа к браузеру); (2) KI#23/30/31 variant selection требует user decision (6 questions в `docs/ITER142_PROPOSALS.md` §5 ИЛИ явное «approve recommended b/a/b»); (3) implementation BLOCKED by (2). См. `STATUS.md` «Next iteration (iter 143 → iter 144)» для подробностей.

**iter 142 deliverables:**

1. **Documentation cleanup** (4 файла):
   - `STATUS.md` (224→158 строк, -30%) — сжатие «Закрытые KI», актуализация Known Issues, Next iteration → iter 143.
   - `AGENT_NAVIGATION.md` (419→339 строк, -19% lines / -29.5% bytes) — header сжат, Pitfalls 20-29 сжаты в 1-2 строки, Pitfalls 41-47 объединены в один Pitfall 41, Pitfalls 49-50 сжаты, §14 OP-1 сжат.
   - `worklog.md` — iter 141 сжат в 1 строку в «Предыдущие итерации», iter 142 entry добавлен.
   - `docs/UI_REFACTOR_PLAN.md` §13.6 → iter 141 reference (archive), NEW §13.7 = iter 142 reference.
2. **NEW `docs/ITER142_PROPOSALS.md`** (~280 строк) — design proposals для KI#23/30/31 с 3 вариантами каждый, pros/cons, recommendation, тест-план, user questions. Подготовлен для user review.
3. **Baseline проверки подтверждены:** tsc 0 / eslint 0 / vitest 2190/2190 (без изменений — doc cleanup не влияет на тесты).

**Remaining optional enhancements** (если user запросит):
- **KI#23 scroll jitter fix** — see `docs/ITER142_PROPOSALS.md` §1 for 3 variants + recommendation.
- **KI#30 cross-tab favorites persistence** — see `docs/ITER142_PROPOSALS.md` §2 for 3 variants + recommendation.
- **KI#31 favorites как quick-select** — see `docs/ITER142_PROPOSALS.md` §3 for 3 UX variants + recommendation.
- Persist `rightPanelCollapsed` to URL — currently local state. Add `rpc` boolean field to filter-store if user requests.
- VendorPage Phase 5 wiring — VendorPage uses custom FilterChip. To wire favorites for vendor, need to add ⭐ pin slot to vendor FilterChip + render FavoritesIndicator (compact version). Deferred until user requests.
- Phase 5 scroll-to-mod on mobile / virtualized lists — currently degrades gracefully (no-op) when chip is virtualized out of DOM. Could be enhanced to scroll to sub-group header instead. Deferred.
- Tooltip `--strong` styling variant — currently single style. Could add variant for tier-first mode if user requests. (Note: `--strong` modifier pattern was already applied to `.affix-header-*` in iter 138; same pattern can be reused for Tooltip if requested.)
- IconLegend `items` prop — currently hardcoded 3 rows (★/✗/ⓘ). Could be extended to include additional icons (e.g. ⚡ optimizer-collapsed, ⚓ prefix anchor, 2x dual-number) if user requests.

**DONE in iter 141 (removed from optional list):**
- ~~round10 default off + cross-tab persistence global settings~~ → DONE in iter 141 (KI#26). NEW `local-settings.ts` + 7 useState-backed settings now persist via localStorage.
- ~~VirtualizedModList prefix/suffix 50/50~~ → DONE in iter 141 (KI#27). One-line grid-cols fix.
- ~~Favorites counter 1-per-family~~ → DONE in iter 141 (KI#28). `handleTogglePinned` simplified in 7 pages.
- ~~Aside collapse header too big~~ → DONE in iter 141 (KI#29). CategoryLayout aside header rewritten.

**DONE in iter 140 (removed from optional list):**
- ~~Show-selected-only toggle clarification~~ → DONE in iter 140 (KI#25). Native `title` attribute tooltip added.
- ~~Favorites block restored~~ → DONE in iter 140 (KI#24). Compact `FavoritesIndicator` in page header.

**DONE in iter 139 (removed from optional list):**
- ~~`--strong` modifier wiring~~ → DONE in iter 138. See Pitfall 48.
- ~~Right aside overflow~~ → DONE in iter 139 (KI#16).
- ~~Prefix/Suffix 50/50 in ModList~~ → DONE in iter 139 (KI#17). VirtualizedModList parity fixed in iter 141 (KI#27).
- ~~Chip truncation revert~~ → DONE in iter 139 (KI#18).
- ~~Sticky search revert~~ → DONE in iter 139 (KI#19).
- ~~LeftPanelFavorites removed~~ → DONE in iter 139 (KI#20), restored as compact indicator iter 140 (KI#24).

**Do NOT implement TopNav dropdowns** — visualization supersedes that recommendation (iter 130 contradiction #1).

**UX verification request for user (iter 141 deliverable):** open the 7
category pages (Belt, Ring, Amulet, Jewel, Waystone, Tablet, Relic) on desktop
and verify iter 141 changes:

**KI#26 — round10 default off + cross-tab persistence:**
1. Open Belt page. The «Округлять до 10» checkbox should be UNCHECKED by default (was checked before iter 141).
2. Check the «Округлять до 10» checkbox. Regex output should change (numbers rounded to nearest 10).
3. Navigate to Ring page (via TopNav). The «Округлять до 10» checkbox should be CHECKED (persisted from Belt via localStorage).
4. Navigate back to Belt page. The checkbox should still be CHECKED.
5. Close the browser tab and reopen the site. The checkbox should still be CHECKED (localStorage survives sessions).

**KI#27 — VirtualizedModList prefix/suffix 50/50:**
1. Open Belt page (or Ring / Amulet / Jewel — pages with virtualized lists).
2. Look at the two-column layout (Prefix | Suffix). The columns should be EQUAL width (50/50). Before iter 141, prefix was 40% and suffix was 60% (visually unbalanced).
3. Compare with Relic page (uses ModList, was already 50/50 since iter 139) — should look the same proportions.

**KI#28 — Favorites counter 1-per-family:**
1. Open Belt page. Pin an affix family that has multiple tiers (e.g., +(15—40)% к сопротивлению чести — has 5 tiers).
2. Look at the page header. The `★ Избранные аффиксы: N` badge should show N=1 (not N=5 as before iter 141).
3. Pin a second affix family. Counter should show N=2.
4. Unpin the first family (click ⭐ again). Counter should show N=1.

**KI#29 — Aside collapse header compact:**
1. Open any category page with `basket` prop (Belt, Ring, etc.).
2. Look at the top of the right aside (above SelectedBasket). The collapse toggle should be a SMALL chevron button on the right — NOT a full panel with empty title space.
3. Click the chevron — aside should collapse (basket + regex + status + sidebar hidden, only chevron + ⚙ badge visible).
4. Click again — aside should expand back.

**KI#23 — Scroll jitter (monitoring only, not fixed):**
1. Open Belt page (or Ring / Amulet / Jewel — pages with virtualized lists).
2. Scroll the mod list up and down.
3. Note: category names and chips may visibly «jump» / «double» / «jitter» during scroll. This is a known issue (KI#23) — root cause documented in STATUS.md. NOT fixed in iter 141; will be addressed in iter 142+.

**KI#30 — Cross-tab favorites persistence (monitoring only, not fixed):**
1. Open Belt page. Pin 1-2 affixes.
2. Navigate to Ring page. Pin 1 affix.
3. Navigate back to Belt page. The Belt favorites should be GONE (per-category store, not persisted across tabs). This is a known issue (KI#30) — root cause + solutions documented in STATUS.md. NOT fixed in iter 141; will be addressed in iter 142+.

**KI#31 — Favorites as quick-select (monitoring only, not fixed):**
1. Open any category page. Pin 1-2 affixes via ⭐ button.
2. The `★ Избранные аффиксы: N` badge in the header is just a VISUAL indicator — clicking it does NOTHING.
3. The user's expected behavior (click ★ → select affix OR scroll-to-mod) is NOT implemented. This is a feature gap (KI#31), not a bug. Deferred to iter 142+ (requires UX design + user feedback).

Additionally verify all previous phases (Phase 2+2.5+3+4+4.5+5 + iter 138 `--strong` + iter 139 KI#16-20 + iter 140 KI#21-25) — see STATUS.md.

If you find a bug — document in `STATUS.md` as Known Issue FIRST, then fix.

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

---

## 14. MIXED-mode UI Patterns (iter 158–159, verification iter 160)

> **Status:** Phase 1 (core layer) — ✅ DONE iter 158. Phase 2 (UI integration) —
> ✅ DONE iter 159. Phase 3 (in-game verification) — ⏳ iter 160 (KI#48).
> **Source docs:** `регис/результаты AND+OR тестов.md` (iter 157 — core verified),
> `docs/MIXED_MODE_UI_TESTS.md` (iter 160 — UI verification test plan).

### 14.1 Концепция MIXED mode

MIXED mode — третий search-logic mode (помимо `'and'` и `'or'`), который позволяет
пользователю в одном regex выразить **MUST / OPT / EXCLUDE** семантику:

```
"!BAD1|BAD2" "MUST1" "MUST2" "OPT1|OPT2|OPT3"
```

- `!BAD1|BAD2` — item-wide EXCLUDE (если предмет содержит BAD1 ИЛИ BAD2 — скрыть).
- `"MUST1" "MUST2"` — cross-block AND (предмет должен содержать BOTH).
- `"OPT1|OPT2|OPT3"` — OR-группа (предмет должен содержать ХОТЯ БЫ ОДНУ из ALT).
- Все три части комбинируются через top-level AND.

Это решает частую задачу: «хочу предмет с mandatory аффиксами + хотя бы одним из
опциональных, но без вот этих плохих». В `'and'` mode нельзя выразить OR-группу;
в `'or'` mode нельзя выразить cross-block AND. MIXED = AND + OR + EXCLUDE в одном regex.

### 14.2 Реализация (iter 158 core + iter 159 UI)

#### Core layer (iter 158)

| File | Role | Key exports |
|------|------|-------------|
| `src/shared/types.ts` | `SearchLogic` extended с `'mixed'`; `MIXED_OR` AST node type; `MixedOrOptions` (`{ anchorFirstAltOnly?: boolean }`) | Type definitions |
| `src/core/compiler.ts` | MIXED_OR compilation: emits `ALT1\|ALT2\|...` inside ONE quoted group; `anchorFirstAltOnly: true` ставит `^` только на первую ALT (KI#45 mitigation) | `compile()` handles MIXED_OR |
| `src/ui/hooks/category-ast-utils.ts` | `buildMixedAstFromSelections(mustTokens, optTokens, excludedIds, ...)` → `AND(EXCLUDE(...), MUST_children, MIXED_OR(opt_children))`. `truncateMixedOrLiterals(ast, maxLen=12)` — KI#46 mitigation (shortens LITERAL values в MIXED_OR) | Builders |

**Build order в `buildMixedAstFromSelections`:**
1. EXCLUDE tokens → `exclude(or(...))` как ПЕРВЫЙ AND-child (compile to `"!A\|B"`).
2. MUST tokens → делегирование в `buildAstFromSelections(searchLogic='and')` →
   каждый MUST = отдельный quoted group (cross-block AND).
3. OPT tokens → делегирование в `buildAstFromSelections(searchLogic='or')` →
   unwrap OR → re-wrap as `MIXED_OR(children, { anchorFirstAltOnly: true })`.

#### UI layer (iter 159)

| File | Role | Key changes |
|------|------|-------------|
| `src/store/filter-store.ts` | `optionalIds: Set<string>` field + `toggleOptional(ids)` action + 3-state mutual exclusion (token только в одном из selectedIds/excludedIds/optionalIds) + serialize (`opt` URL key) + deserialize (defensive strip duplicates) | +1 state field, +1 action |
| `src/ui/components/FilterChip.tsx` | 3-state chip: click = want, shift+click = opt, right-click = exclude. Новые props: `optionalIds`, `onToggleOptional`, `mixedMode` (default false). `selectionState` extended: 'full-optional' / 'partial-optional'. CSS class `chip-opt` (amber dashed border) | +3 props, +2 selection states |
| `src/ui/components/CategoryControlPanel.tsx` | Третий radio button «Смешанный» (logic.mixed) с `bg-accent-amber-soft` active style + tooltip (logic.mixed_tooltip) | +1 radio option |
| `src/ui/hooks/useCategoryPage.ts` | `useRegexBuilder`: при `searchLogic === 'mixed'` вызывает `buildMixedAstFromSelections`. Auto-truncation при > 240 chars (KI#46 mitigation) | MIXED branch в builder |
| `src/ui/components/{ModList,VirtualizedModList}.tsx` | Проброс `optionalIds` / `onToggleOptional` / `mixedMode` props | +3 props каждый |
| `src/ui/pages/{belt,ring,amulet,waystone,tablet,relic,jewel}/*Page.tsx` | 7 page components: деструктуризация `optionalIds`/`toggleOptional` + `handleToggleOptional` useCallback + `<VirtualizedModList mixedMode={searchLogic === 'mixed'}>` | +5 строк на page |
| `src/shared/i18n.ts` | `logic.mixed`, `logic.mixed_tooltip`, `chip.optional`, `chip.partial_optional` | +4 i18n keys |
| `src/index.css` | `.chip-opt` CSS class: `border-left-style: dashed` + `border-left-width: 2px` (отличает OPT от MUST solid) | +1 CSS rule |

### 14.3 UX паттерны (iter 159)

#### 3-state chip interactions

| Жест | Результат | State | Visual |
|------|-----------|-------|--------|
| Click | want (MUST) | `selectedIds.add(...)` | solid border, `bg-chip-active` |
| Shift+click | opt (OPT) | `optionalIds.add(...)` (mutual exclusion: remove from selected/excluded) | amber dashed border, `bg-amber-900/30`, `.chip-opt` |
| Right-click | exclude (EXCLUDE) | `excludedIds.add(...)` (mutual exclusion: remove from selected/optional) | red solid border, `bg-indicator-red` |
| Enter / Space | want (MUST) | `selectedIds.add(...)` | same as click |
| Shift+Enter / Shift+Space | opt (OPT) | `optionalIds.add(...)` | same as shift+click (keyboard parity) |

**Контекстное меню браузера suppressed** в MIXED mode (`preventDefault` в
`handleContextMenu`). В AND/OR mode right-click работает как обычно (browser menu).

#### Mutual exclusion invariant

Токен может быть только в ОДНОМ из `selectedIds` / `excludedIds` / `optionalIds`.
При `toggleOptional(id)`:
- если id уже в `selectedIds` → удалить оттуда, добавить в `optionalIds`.
- если id уже в `excludedIds` → удалить оттуда, добавить в `optionalIds`.
- если id уже в `optionalIds` → удалить (toggle off).

Это гарантирует, что chip всегда отображается ровно в одном state.

#### URL persistence

URL hash содержит ключи:
- `s` — selected (MUST) IDs array.
- `opt` — optional (OPT) IDs array (omitted when empty).
- `e` — excluded IDs array (omitted when empty).

При `deserialize`: defensive strip — если ID оказался в нескольких множествах
(малформенный URL), precedence `selected > excluded > optional` (последний wins
в обратном порядке: optional теряет ID первым).

#### Mode switching (MIXED ↔ AND ↔ OR)

При переключении logic mode `optionalIds` **НЕ очищается** в store — только
**игнорируется** в FilterChip (когда `mixedMode=false`, `effectiveOptional = new Set()`)
и в `useRegexBuilder` (когда `searchLogic !== 'mixed'`, вызывается обычный
`buildAstFromSelections`).

Это позволяет пользователю переключаться MIXED → AND → MIXED без потери OPT
состояний (T9 проверяет этот сценарий).

### 14.4 KI mitigations

| KI | Описание | Mitigation | Where |
|----|----------|------------|-------|
| **KI#45** | `^`-anchor на 2+ ALT ломает матч | `anchorFirstAltOnly: true` в MIXED_OR — `^` ставится только на первую ALT | `compiler.ts` MIXED_OR case |
| **KI#46** | Regex > 250 chars rejected игрой | `truncateMixedOrLiterals(ast, maxLen=12)` auto-applied при compiled > 240 chars в `useRegexBuilder` | `useCategoryPage.ts` шаг 4b |
| **KI#47** | Cross-suppression excludes в MIXED (MUST и OPT из одной family с regexExclude) | Low priority — rare edge case. `buildMixedAstFromSelections` делегирует MUST/OPT separately, поэтому `computeSuppressedExcludes` не видит cross-conflicts | Не fixed — documented |
| **KI#48** | In-game verification MIXED-mode UI | Tests T1–T10 в `docs/MIXED_MODE_UI_TESTS.md` | ⏳ iter 160 |

### 14.5 Test coverage

| Layer | Tests | File |
|-------|-------|------|
| Core (AST + compiler + builder) | 43 tests | `tests/core/compiler-mixed.test.ts` + `tests/ui/buildMixedAst.test.ts` |
| Store (optionalIds + 3-state + serialize) | 18 tests | `tests/store/filter-store.test.ts` |
| FilterChip (3-state click/shift+click/right-click + ARIA) | 10 tests | `tests/ui/FilterChip.test.tsx` |
| In-game UI verification | T1–T10 (этот план) | `docs/MIXED_MODE_UI_TESTS.md` |

**Всего:** 71 unit-test + 10 in-game tests = 81 test на MIXED mode.

### 14.6 Backward compatibility

- `mixedMode` prop default = `false` → все pre-iter-159 callers (tests, VendorPage,
  legacy code) рендерят chip как раньше (2-state: click = want, ✗ button = exclude).
- URL `opt` key отсутствует в старых ссылках → deserialize как empty set (no crash).
- `SearchLogic` type extended с `'mixed'` — existing code, проверяющий
  `searchLogic === 'and' || searchLogic === 'or'`, не ломается (mixed branch
  добавлен в `useRegexBuilder`, в остальных местах `'mixed'` treated как fallback
  к `'and'` поведению).
- `optionalIds` в store инициализирован как `new Set<string>()` — не влияет на
  существующие `selectedIds`/`excludedIds` logic.

### 14.7 Open questions (для iter 161+)

1. **UX feedback (T1–T10):** достаточно ли визуально distinct OPT state (amber dashed)?
   Или нужен дополнительный icon (⭐ для OPT)? → решается после iter 160 test results.
2. **Onboarding hint:** нужен ли first-time tooltip при переключении в MIXED mode,
   объясняющий shift+click/right-click? → решается после iter 160 UX feedback.
3. **Icon legend update:** добавить ⚡ OPT row в `IconLegend.tsx`? → зависит от
   того, поймут ли users жест shift+click без legend.
4. **KI#47 fix (cross-suppression):** нужно ли сканировать MUST+OPT вместе для
   `computeSuppressedExcludes`? → low priority, редкий edge case.
5. **Multi-OPT groups:** в текущей реализации все OPT токены собираются в ОДНУ
   `MIXED_OR` quoted group. Если user хочет две независимые OR-группы
   (`"OPT1\|OPT2" "OPT3\|OPT4"`), нужен UI для группировки OPT — не реализовано.

---

## §15. iter 161 — User-feedback UX fixes (3 bugs)

iter 161 исправляет 3 UX-бага, обнаруженных пользователем при первичном
тестировании MIXED-mode UI (iter 159/160). Кодовая логика генерации regex
не изменялась — исправления затрагивают только presentation layer.

### 15.1 Bug #1 — SelectedBasket не показывал исключённые аффиксы

**Симптом:** в правой панели `SelectedBasket` отображался блок
«Выбрано: 0 афф.» с placeholder «Выберите аффиксы», но исключённые (excluded)
аффиксы не отображались нигде. Пользователь не видел, что он исключил.

**Фикс:** `src/ui/components/SelectedBasket.tsx` переписан в 3-секционную
компоновку:

| Секция | Условие рендера | Стиль | Иконка | ARIA |
|--------|----------------|-------|--------|------|
| want   | `selectedIds.size > 0` | `bg-chip border-edge` | ✗ | `basket.unselect_aria` |
| opt    | `mixedMode && optionalIds.size > 0` | `bg-amber-900/20 border-dashed` | ⇄ | `basket.unoptional_aria` |
| exclude | `excludedIds.size > 0` | `bg-indicator-red/30 border-red` | ✗ | `basket.unexclude_aria` |

Каждая секция имеет независимый «+N ещё» экспандер (cap=20 per section).
Шапка показывает общий count + inline-разбивку `(N+M⇄K✗)` когда есть
opt/exclude. Все новые props опциональны (backward compat с тестами и
VendorPage, который не использует excludedIds).

**Новые props:**
- `excludedIds?: Set<string>`
- `optionalIds?: Set<string>`
- `onToggleExclude?: (ids: string[]) => void`
- `onToggleOptional?: (ids: string[]) => void`
- `mixedMode?: boolean` (default false)

**Новые i18n ключи:** `basket.excluded_header`, `basket.optional_header`,
`basket.unexclude_aria`, `basket.unoptional_aria`.

### 15.2 Bug #2 — Счётчики показывали кол-во токенов, не аффиксов

**Симптом:** аффикс «+(10—179) к максимуму маны ×12» (12 tier-вариаций) при
клике показывал «12 выбрано» в тулбаре вместо «1 выбрано». Пользователь
выбрал ОДИН аффикс, а не 12 вариаций.

**Причина:** `CategoryControlPanel` использовал `tokens.length` (кол-во
GameToken объектов), а не кол-во family groups (аффиксов). Когда
пользователь кликает chip, `toggleTokens(memberIds)` добавляет ВСЕ member
IDs в `selectedIds` (12 штук для 12-tier семьи).

**Фикс:** во всех 8 page components заменено на `countUniqueFamilyKeys()`
(существующая функция в `src/shared/family-grouper.ts`, line 173):

```ts
// Было:
excludedCount={excludeTokens.length}        // 12
activeTokenCount={allActiveTokens.length}   // 12
selectedCount={selectedIds.size}            // 12

// Стало:
excludedCount={excludeGroupCount}     // 1
activeTokenCount={activeGroupCount}   // 1
selectedCount={wantGroupCount}        // 1
```

Дополнительно: `allActiveTokens` расширен для включения `optionalIds`
(раньше OPT-токены не учитывались в active count для budget warnings).

### 15.3 Bug #3 — MIXED режим не отличался от AND (UX)

**Симптом:** пользователь включал «Смешанный» режим, выбирал аффиксы —
генерировался regex, идентичный AND режиму. Причина: без OPT-аффиксов
`buildMixedAstFromSelections` деградирует в чистый AND (это правильно по
логике — нет OPT → нет OR → AND). Но пользователь не понимал, КАК отметить
аффикс как OPT (shift+click был скрытым жестом, описанным только в tooltip).

**Фикс (UX-only, без изменения логики генерации):**

1. **Inline-подсказка в тулбаре** (`CategoryControlPanel.tsx`):
   Когда `searchLogic === 'mixed' && optionalCount === 0 && activeTokenCount > 0`
   → рендерится italic-текст «Shift+клик по аффиксу — опционально (хотя бы 1
   из группы)». Исчезает, как только пользователь shift+кликнет хотя бы один
   аффикс (`optionalCount > 0`).

2. **OPT counter в тулбаре** (`CategoryControlPanel.tsx`):
   Новый prop `optionalCount`. Когда `searchLogic === 'mixed' && optionalCount > 0`
   → рендерится amber counter «N опц.» рядом с «N выбрано» и «N исключить».
   Визуальный feedback, что OPT-аффиксы есть.

3. **4-я строка в IconLegend** (`IconLegend.tsx`):
   Новый prop `showMixedHint`. Когда true → добавляется 4-я строка с иконкой ⇄
   (метафора «либо это, либо то») и текстом «Shift+клик по чипу — опционально
   (хотя бы 1)». Все 7 страниц передают `showMixedHint={searchLogic === 'mixed'}`.
   Backward compat: custom `items` prop override → `showMixedHint` игнорируется.

4. **Улучшенный tooltip** (`logic.mixed_tooltip`): уже был с iter 159 —
   «Смешанный режим: обязательные аффиксы (И) + опциональные (ИЛИ). Клик по
   чипу — хочу, Shift+клик — опционально, правый клик — исключить.»

**Новые i18n ключи:** `summary.optional` («Опц.»), `logic.mixed_hint`,
`legend.opt_shift_click`.

### 15.4 Test coverage (iter 161)

| File | Было | Стало | Delta |
|------|------|-------|-------|
| `tests/ui/SelectedBasket.test.tsx` | 12 | 18 | +6 (3-section layout) |
| `tests/ui/IconLegend.test.tsx` | 11 | 14 | +3 (showMixedHint) |
| **Total** | 2306 | **2315** | **+9** |

Новые тесты покрывают: exclude section render + click, opt section conditional
render (mixedMode gate), opt click, header total count with breakdown, backward
compat (optional props), IconLegend showMixedHint true/false/override.

### 15.5 Backward compatibility

Все изменения backward-compatible:
- `SelectedBasket`: новые props опциональны, default behavior = pre-iter-161.
- `CategoryControlPanel`: `optionalCount` optional, default 0.
- `IconLegend`: `showMixedHint` optional, default false; custom `items` override.
- `i18n`: новые ключи добавлены, существующие не изменены.
- `countUniqueFamilyKeys()` существовала с iter 135 — не новый код.

Старые тесты (FilterChip, filter-store, buildMixedAst, etc.) проходят без
изменений — 2306 pre-existing + 9 new = 2315 total.

### 15.6 Open questions (для iter 162+)

1. **UX feedback после iter 161:** достаточно ли inline-подсказки, или нужен
   first-time modal/onboarding tour? → решается после in-game прогона T1–T10.
2. **3-section SelectedBasket на mobile:** не проверено на маленьких экранах —
   возможно потребуется collapsible секции или tabbed layout.
3. **OPT counter «N опц.»:** достаточно ли distinct amber color, или нужен
   icon (⇄) рядом с count? → UX feedback.
4. **Inline breakdown `(N+M⇄K✗)` в шапке:** может быть слишком компактным/
   непонятным для новых users. Альтернатива: убрать breakdown, оставить только
   общий count.
5. **IconLegend 4-я строка:** ⇄ может быть непонятен без контекста. Возможно
   заменить на «Shift+клик» как icon.
