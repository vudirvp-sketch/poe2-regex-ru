# UI Refactor Plan — iter 129+

> **Document purpose:** Engineering plan for the UI improvements proposed in
> `docs/UI_AUDIT.md` (v2, 2026-06-21) + user follow-up audit (iter 128 chat).
> This iteration (iter 129) **does NOT implement** — it only plans. Each phase
> below is sized for ONE iteration of work, with concrete file changes, state
> additions, and test strategy.
>
> **Status:** Draft for review. No code changes yet.
> **Author:** iter 129 planning agent
> **Last updated:** 2026-06-26

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

**Goal:** Add the 3 new `FilterState` fields (`collapsedGroups`,
`showSelectedOnly`, `pinnedIds`) with URL persistence, no UI yet. This unlocks
every other phase.

**Files:**
- `src/store/filter-store.ts` — add 3 fields + actions + serialization.
- `src/shared/types.ts` — extend `FilterState` type.
- `src/store/url-sync.ts` — extend serialize/deserialize (backward-compat).
- `tests/store/filter-store.test.ts` (NEW) — round-trip tests for new fields.

**State additions:**
```ts
interface FilterState {
  // ...existing fields...
  collapsedGroups: Set<string>      // NEW — familyKey OR `${affix}:${groupKey}` identifiers
  showSelectedOnly: boolean         // NEW — hide non-selected chips
  pinnedIds: Set<string>            // NEW — favorited familyKey set
}
```

**URL serialization (backward-compat):**
- Existing format: `s=...&e=...&t=...&a=...&o=...&p=...&x=...&r=...`
- New keys (added only when non-default): `c` (collapsed array), `so=1`
  (show-selected-only flag), `pn` (pinned array). Old URLs without these
  keys deserialize to empty defaults.

**Tests:**
- Round-trip: state → serialize → deserialize → state.
- Backward-compat: URL without new keys → no crash, defaults applied.
- Empty-set serialization doesn't bloat URL (omit key when set is empty).

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
- Affix column level: `${categoryId}:${affix}` (e.g. `waystone:prefix`) —
  toggles whole column.
- Semantic sub-group level: `${categoryId}:${affix}:${subBlockKey}` (e.g.
  `waystone:prefix:positive-loot`) — toggles one sub-block.
- Default state: ALL EXPANDED. (User can collapse to focus, but the default
  is "see everything" — important for first-time users and SEO.)

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
  (bottom, collapsible).
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
- If > 12 chips, show "N more..." expander at bottom (don't render 200
  chips in the basket — perf).
- Mobile: basket collapses into a chip-count summary at the top of
  `MobileRegexBar`. Tap to expand.

**Tests:**
- `tests/ui/SelectedBasket.test.tsx` (NEW) — renders selected chips,
  empty state, click-to-deselect, max-chip expander.
- `tests/ui/CategoryControlPanel.test.tsx` — toggle flips
  `showSelectedOnly`, persists to URL.

**Risk:** SelectedBasket rendering 100+ chips = perf problem. Mitigation:
cap at 12 with "show more" expander. Test with belt.json (largest) +
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

### Phase 5 — Favorites/pinned mods + TopNav dropdowns (optional)

**Goal:** Audit §3 (favorites) + §10 (TopNav restructure). These are
lower-priority — can be deferred or done independently.

**Files (favorites):**
- `src/ui/components/FilterChip.tsx` — add `⭐` toggle button (next to
  exclude `✗`). Persisted to `pinnedIds` set.
- `src/ui/components/ModList.tsx` + `VirtualizedModList.tsx` — when
  `pinnedIds` is non-empty, render a "⭐ Избранные" section at the TOP of
  the list (above all affix columns) showing pinned chips.
- `src/ui/components/SelectedBasket.tsx` — pinned chips get a star prefix.
- `src/shared/i18n.ts` — `favorites.title`, `chip.pin_tooltip`,
  `chip.unpin_tooltip` keys.

**Files (TopNav):**
- `src/ui/layout/TopNav.tsx` — restructure into 3 dropdown groups:
  - "Предметы ▼": Путевые камни, Башни, Реликвии, Самоцветы
  - "Снаряжение ▼": Кольца, Амулеты, Пояса
  - "Инструменты ▼": Торговец
- `src/ui/layout/nav-items.ts` — add `group` field to each item.
- `src/ui/components/DropdownMenu.tsx` (NEW) — accessible dropdown
  (keyboard nav, focus trap, click-outside close).
- `src/index.css` — `.topnav-dropdown`, `.topnav-dropdown-trigger`,
  `.topnav-dropdown-menu` classes.
- `src/shared/i18n.ts` — `nav.group_items`, `nav.group_gear`,
  `nav.group_tools` keys.

**Tests:**
- `tests/ui/FilterChip.test.tsx` — pin toggle works, persists.
- `tests/ui/DropdownMenu.test.tsx` (NEW) — keyboard nav, focus trap,
  click-outside.
- `tests/ui/TopNav.test.tsx` (NEW) — dropdowns open/close, active state
  propagates to parent group.

**Risk:** TopNav restructure breaks the muscle memory of existing users.
Mitigation: dropdowns are additive — clicking the group label could either
navigate to the first item in the group OR expand the dropdown. Recommend
"click label = expand dropdown" (matches the `▼` affordance) + the first
item in each dropdown is the "default" category for that group.

**Definition of Done:** Users can star favorite mods and see them at the
top of the list. TopNav groups 9 categories into 3 dropdowns.

---

## 5. Phase Dependencies

```
Phase 1 (foundation) ──┬──> Phase 2 (collapse + sticky search)
                       │
                       ├──> Phase 3 (selected only + basket)
                       │
                       └──> Phase 5 (favorites + topnav)

Phase 4 (colors + compact + tooltips) — INDEPENDENT, can land any time.
```

- Phase 1 is the foundation. Must land first.
- Phases 2 and 3 can be done in parallel by different agents (different
  files mostly). They both consume Phase 1's `FilterState` fields.
- Phase 4 is visual only — no state changes, can land any time after
  Phase 1 (or even before, but Phase 1 has no UI conflict so order doesn't
  matter).
- Phase 5 (favorites) consumes Phase 1's `pinnedIds`. Phase 5 (TopNav) is
  fully independent.

**Recommended sequence for one agent:** 1 → 2 → 3 → 4 → 5.

**Recommended sequence for parallel agents:** 1 alone → then 2, 3, 4 in
parallel → then 5.

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TanStack Virtual row filtering breaks scroll position | Medium | High | Test with belt.json + collapse-above-viewport scenario. Regression test for iter 120 jump-to-top bug. |
| URL bloat from new state fields | Low | Medium | Omit empty sets from serialization. Cap array lengths. |
| SelectedBasket perf with 100+ chips | High | Medium | Cap at 12 chips with "show more" expander. Virtualize if needed. |
| Compact chips fail WCAG AA touch target | Medium | Low | Keep mobile bump at 32px. Desktop is mouse-driven. Add `aria-label` for screen readers. |
| Existing tests break from CSS class renames | High | Low | Run full vitest suite after each phase. Update snapshots in same commit. |
| Tooltip portal z-index conflicts with sticky elements | Medium | Low | Use `z-50` for tooltip portal (above sticky search `z-20` and TopNav `z-30`). |
| TopNav dropdowns confuse existing users | Medium | Medium | Keep current paths active. Dropdown is additive navigation, not replacement. |
| i18n keys missing for new strings | Low | Low | Add all keys in same commit as the UI that uses them. |

---

## 7. Open Questions (for user / next agent)

1. **Collapse default state:** Should affix groups start collapsed or
   expanded? Current plan: ALL EXPANDED (SEO + first-time user friendly).
   Alternative: collapse all but S-tier by default (power-user friendly).
   **Recommendation:** All expanded, with a "Collapse all" button for power
   users.

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

5. **TopNav dropdown click behavior:** Click label = navigate to first
   item, or click label = expand dropdown?
   - **Recommendation:** Click label = expand dropdown. The `▼` glyph
     signals "click to open". Click an item inside to navigate.

6. **Compact chip density:** 20% reduction (px-2 py-1 text-[12px]) or
   25% (px-1.5 py-0.5 text-[12px])?
   - **Recommendation:** Start with 20% (px-2 py-1). Test with real data.
     If still too dense, go to 25% in a follow-up.

---

## 8. Test Strategy

### Per-phase unit tests
- Phase 1: `tests/store/filter-store.test.ts` (NEW) — round-trip +
  backward-compat.
- Phase 2: `tests/ui/GroupHeader.test.tsx` (NEW) + extend
  `tests/ui/ModList.test.tsx` + `VirtualizedModList.test.tsx`.
- Phase 3: `tests/ui/SelectedBasket.test.tsx` (NEW) + extend
  `tests/ui/CategoryControlPanel.test.tsx`.
- Phase 4: `tests/ui/Tooltip.test.tsx` (NEW) + update
  `tests/ui/FilterChip.test.tsx` snapshots.
- Phase 5: `tests/ui/DropdownMenu.test.tsx` (NEW) +
  `tests/ui/TopNav.test.tsx` (NEW).

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
- Phase 3: Select 5 mods. Toggle "selected only". Verify only those 5
  show. Verify basket shows them.
- Phase 4: Compare side-by-side screenshots before/after on belt.json
  (largest). Count visible chips.
- Phase 5: Pin 3 mods across 2 categories. Verify they persist.

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
| 1 | 4 | 1 | 8-12 | 1 |
| 2 | 7 | 1 | 12-18 | 1 |
| 3 | 6 | 1 | 10-15 | 1 |
| 4 | 5 | 1 | 10-15 | 1 |
| 5 | 6 | 1 | 12-18 | 1 |
| **Total** | **28** | **5** | **52-78** | **5** |

Single-agent sequential: 5 iterations.
Parallel (1 + 3 + 1): 3 iterations wall-clock.

---

## 11. How to Start (for the next agent)

1. Read this document end-to-end.
2. Read `docs/UI_AUDIT.md` for the original audit recommendations.
3. Read `STATUS.md` for current Known Issues (especially KI#9 monitoring).
4. Read `AGENT_NAVIGATION.md` Pitfalls 26-39 (CSS specificity, mobile
   media queries, palette consistency).
5. Pick a phase (recommend Phase 1 first — it unblocks everything).
6. Create a TODO list with the phase's file changes.
7. Implement, test, document, ship.
8. Update this document with a "Phase N — DONE" note + any deviations
   from the plan.

**If you find a new bug during implementation:** document in `STATUS.md`
as Known Issue FIRST, then fix. (Per user's standing instruction.)

---

## 12. Phase Status

| Phase | Status | Iteration | Notes |
|-------|--------|-----------|-------|
| 1 — Foundation | NOT STARTED | — | — |
| 2 — Collapse + Sticky search | NOT STARTED | — | — |
| 3 — Selected only + Basket | NOT STARTED | — | — |
| 4 — Colors + Compact + Tooltips | NOT STARTED | — | — |
| 5 — Favorites + TopNav | NOT STARTED | — | — |

(Update this table as phases land.)
