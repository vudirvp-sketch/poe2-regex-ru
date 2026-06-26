# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 135
> **UI-документация:** `docs/UI_REFACTOR_PLAN.md` (план, Phase 1+2+2.5+3 DONE) + `docs/UI_VISUALIZATION_AUDIT.md` (эталон iter 130 + iter 131 corrections)

---

## Текущее состояние

**iter 135: UI Refactor Phase 3 — show-selected-only + SelectedBasket panel готовы.**

Phase 3 потребляет `showSelectedOnly` (уже в store с Phase 1, iter 132) и добавляет:
toggle «Все / Выбранные (N)» в `CategoryControlPanel`, новый `SelectedBasket.tsx`
компонент в правой панели (renders one chip per selected family group, NOT per
token — с affix-type badges ПРЕФ/СУФ/ИМПЛ per iter 130 visualization gap #4),
cap = `SELECTED_BASKET_CAP` (20, iter 131 §13.7 #3 raised 12→20), max-height 30vh
+ internal scroll, click-to-deselect, «Очистить все» link, «+N ещё» expander when
count > cap. Right aside restructured: basket → regex → status → profile.
Grid template 1fr/320px (≈20% of 1600px viewport per iter 131 §13.7 #2). Right
aside collapsible via chevron toggle in header (local state, NOT persisted to
URL — transient view-mode toggle).

`ModList.tsx` + `VirtualizedModList.tsx` extended with `showSelectedOnly?`
optional prop. When true, new `visibleGroups` useMemo filters
`priorityFilteredGroups` to only those with at least one selected/excluded/pinned
member. Pinned/excluded tokens stay visible (per spec §4 Phase 3) so the user
can un-exclude or re-select a favorited mod. Stats line + mod groups area use
`visibleGroups.length` so the «shown N» count updates immediately.

**Сделано в iter 135:**

1. **`src/shared/constants.ts`** — `SELECTED_BASKET_CAP = 20` constant с JSDoc
   (iter 131 §13.7 #3 — user wants 20-25, quote «У вас легко собираются regex
   на 15–30 модов»).

2. **`src/shared/i18n.ts`** — +16 keys (Phase 3 section): `filter.show_all`
   («Все»), `filter.show_selected` («Выбранные ({n})»), `filter.show_mode_label`,
   `basket.title` («Выбрано: {n}»), `basket.title_suffix` («афф.»),
   `basket.empty` («Выберите аффиксы»), `basket.clear` («Очистить все»),
   `basket.clear_aria`, `basket.more` («+{n} ещё»), `basket.more_aria`,
   `basket.collapse` («свернуть»), `basket.collapse_aria`, `basket.unselect_aria`
   («Снять выделение»), `basket.badge_implicit` («ИМПЛ»), `basket.badge_prefix`
   («ПРЕФ»), `basket.badge_suffix` («СУФ»), `basket.collapse_panel`,
   `basket.expand_panel`.

3. **`src/ui/hooks/useCategoryPage.ts`** расширено — `CategoryPageState` +2
   fields (`showSelectedOnly`, `setShowSelectedOnly`). +2 `useStore(state =>
   state.X)` subscriptions. URL-sync effect deps array +`showSelectedOnly`
   (so toggle triggers URL re-sync). +2 return fields.

4. **`src/ui/components/SelectedBasket.tsx`** (NEW, ~220 строк) — renders one
   chip per selected family group. Each chip = colored affix badge (ПРЕФ=blue,
   СУФ=orange, ИМПЛ=amber, per iter 130 visualization) + displayText + ✗ cue.
   Click chip → `onToggleTokens(memberIds)` deselects that family. Cap =
   `SELECTED_BASKET_CAP` (20). When count > cap → first 20 visible + «+N ещё»
   expander; click reveals all + «свернуть» button. Empty state → «Выберите
   аффиксы» placeholder. Max-height 30vh with internal scroll. «Очистить все»
   link calls `onClearSelections`. Accessible: `role="button"` + `tabIndex=0` +
   Enter/Space keydown + `aria-label` «{displayText} — Снять выделение».

5. **`src/ui/components/CategoryControlPanel.tsx`** расширено —
   `CategoryControlPanelProps` +3 optional props (`showSelectedOnly`,
   `onSetShowSelectedOnly`, `selectedCount`). Toggle radio group «Все /
   Выбранные ({n})» placed after sortMode toggle. «Выбранные» button disabled
   when `selectedCount === 0`. Arrow-key navigation wired via existing
   `handleRadioKeyDown` helper. Backward compat: when `onSetShowSelectedOnly`
   not provided → toggle not rendered.

6. **`src/ui/layout/CategoryLayout.tsx`** расширено (full rewrite header) —
   `CategoryLayoutProps` +1 optional prop (`basket`). Local state
   `rightPanelCollapsed` (NOT persisted to URL — transient view-mode toggle).
   Grid template: `lg:grid-cols-[1fr_320px]` (was `lg:grid-cols-[1fr_380px]`).
   When collapsed: `lg:grid-cols-[1fr_48px]`. Aside header (rendered when
   `basket` provided) contains ⚙ icon (collapsed) + chevron toggle button with
   `aria-expanded` + `aria-label` + `title`. Aside body collapses to header-only
   when `rightPanelCollapsed === true`. Mobile section: basket always visible
   (above status) — no collapse toggle on mobile.

7. **`src/ui/components/ModList.tsx`** расширено — `ModListProps` +1 optional
   prop (`showSelectedOnly`). Main component destructure `+showSelectedOnly =
   false`. New `visibleGroups` useMemo: when `showSelectedOnly=true` → filter
   `priorityFilteredGroups` to only those with at least one selected/excluded/
   pinned member. When false → pass through unchanged (pre-Phase-3 behaviour).
   `implicitGroups`/`prefixGroups`/`suffixGroups` + stats line + mod groups
   area + origin mode path: all use `visibleGroups` instead of
   `priorityFilteredGroups`.

8. **`src/ui/components/VirtualizedModList.tsx`** расширено — same +1 optional
   prop + `visibleGroups` useMemo with IDENTICAL filter logic (kept in sync с
   ModList). `implicitGroups`/`prefixGroups`/`suffixGroups` + stats line use
   `visibleGroups`.

9. **7 page files** (Belt/Ring/Amulet/Jewel/Waystone/Tablet/Relic) — каждый:
   +1 import (`SelectedBasket`), +2 destructured fields из `useCategoryPage()`
   (`showSelectedOnly`, `setShowSelectedOnly`), +3 props to
   `<CategoryControlPanel>` (`showSelectedOnly`, `onSetShowSelectedOnly`,
   `selectedCount`), +1 prop to `<CategoryLayout>` (`basket={<SelectedBasket
   ... />}`), +1 prop to `<VirtualizedModList>` / `<ModList>`
   (`showSelectedOnly`). VendorPage не тронут (custom FilterChip).

10. **Tests:**
    - `tests/ui/SelectedBasket.test.tsx` (NEW, ~360 строк, 12 tests): empty
      state, renders one chip per selected family (not per token), affix-type
      badges (ПРЕФ/СУФ/ИМПЛ), «Очистить все» calls onClearSelections, click chip
      calls onToggleTokens with member IDs, Enter key triggers onToggleTokens,
      cap=20 renders all when count ≤ cap, truncates to cap + «+N ещё» when
      count > cap, click «+N ещё» reveals all + «свернуть», click «свернуть»
      re-truncates, category prop optional.
    - `tests/ui/ModList.test.tsx` +6 tests (Phase 3 describe block): default
      state all chips render, showSelectedOnly=true only selected families
      render, excluded tokens stay visible, pinned tokens stay visible (Phase 5
      forward-compat), no selections → no chips, stats line shows filtered count.
    - `tests/ui/VirtualizedModList.test.tsx` +2 tests (Phase 3 describe block):
      mounts with showSelectedOnly=true (jsdom renders 0 virtualized rows but
      stats line is always rendered → asserts on stats count), backward compat
      without prop.

### Проверки (iter 135)

- **vitest:** 2099/2099 tests passed (46 test files). Was 2079 in iter 134 →
  **+20 new tests** (12 SelectedBasket + 6 ModList + 2 VirtualizedModList).
- **tsc:** 0 errors.
- **eslint:** 0 problems.
- **Backward compat:** все 4 new props optional — legacy callers (tests, future
  use) без wiring рендерят как раньше (all chips visible, no toggle, no basket,
  no collapse chevron).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в `jewel.json` — runtime split handles at UI level.
2. **APCA Lc<75 для small text с weight 400** (iter 111): WCAG AA PASS, APCA FAIL. Weight 500 на критичных лейблах как компенсация.
3. **6 functional blocks без явных правил сортировки** (iter 119): `other`, `magic-find`, `breach`, `spirit`, `wisps`, `conversion`. Fallback: alphabetical.
4. **KI#9: MULTI_RANGE slot N>0 `(A|B|C) after .* bridge`** (iter 125 — partial fix, MONITORING). Если parts[N>0] в MULTI_RANGE содержит `()` с alternation — паттерн остаётся сломанным in-game. На практике редкий случай. Mitigation: расширить `distributeAlternation` при FP.
5. **Phase 2 UX change: sub-groups default COLLAPSED** (iter 133). In-game/in-browser verification pending (KI#15 below).
6. **Phase 2.5 UX change: chips truncated to first 3 + «+N ещё»** (iter 134). In-game/in-browser verification pending (KI#15).
7. **Phase 3 UX change: show-selected-only filter** (iter 135). When toggle is
   on («Выбранные»), ModList/VirtualizedModList hide family groups without any
   selected/excluded/pinned member. Pinned/excluded tokens stay visible per
   spec §4 Phase 3 so the user can un-exclude or re-select a favorited mod.
   In-game/in-browser verification pending (KI#15).
8. **Phase 3 UX change: SelectedBasket panel + collapsible right aside**
   (iter 135). Right aside shows basket (top) → regex → status → profile.
   Basket cap = 20 (iter 131 §13.7 #3). Right aside collapsible via chevron
   toggle in header (local state — NOT persisted to URL). Mobile: basket always
   visible (no collapse toggle on mobile). In-game/in-browser verification
   pending (KI#15).

### Закрытые KI (краткая справка)

- **KI#7** (iter 121 → VERIFIED iter 129): HomePage hero decorations.
- **KI#8** (iter 122 → VERIFIED iter 129): SeoBlock atmosphere backdrop.
- **KI#10** (iter 126 → VERIFIED iter 127): ambiguous suffix FP для `Редкость предметов`.
- **KI#11** (iter 126 → DISPROVEN iter 127): cross-block `.*` hypothesis.
- **KI#12** (iter 127 → FIXED): tier-hardcoded regex для 7 single-`#` relic tokens.
- **KI#13** (iter 128 → FIXED): пропущен implicit `Редкость монстров` + BTS-статы в waystone-аффиксах.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| `(A\|B\|C)` alone (вся quoted group) | ✅ | in-game verified (iter 15) |
| `prefix (A\|B\|C)%.*suffix` (`()` после literal+space) | ✅ | iter 15 verified |
| `^(A\|B\|C).*suffix` (`()` после `^`) | ✅ | Phase 9b |
| `prefix.*literal(A\|B\|C)` (`()` ПОСЛЕ `.*` bridge) | ❌ | iter 125 — игнорируется in-game. Fix: Path D distribution |
| Ambiguous suffix → multi-implicit FP | ✅ | iter 126 VERIFIED iter 127. Fix: более specific suffix |
| `.*` cross-block/line boundaries | ✅ | iter 127 VERIFIED — `.*` НЕ пересекает lines/blocks |
| Single-`#` template → tier-hardcoded regex (FN) | ✅ | iter 127. Fix: explicit override |
| BTS-статы в waystone-аффиксах (FP clutter) | ✅ | iter 128. Fix: расширить `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` + добавить implicit `Редкость монстров` |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Next iteration (iter 136)

Следующий агент: читай `docs/UI_REFACTOR_PLAN.md` end-to-end, особенно
§12 (Phase Status — Phase 1+2+2.5+3 ✅ DONE), §13 (iter 130 visualization audit)
AND §13.7 (iter 131 user feedback corrections). Затем
`docs/UI_VISUALIZATION_AUDIT.md` — user-approved visual target (note §8
iter 131 corrections).

**Рекомендованный старт:** Phase 5 (favorites in left panel).
Phase 5 потребляет `pinnedIds` (уже wired в store с Phase 1, iter 132, и props
уже проброшены в ModList/VirtualizedModList с iter 134). UI:
create `src/ui/components/LeftPanelFavorites.tsx` (NEW) — renders in the LEFT
panel, BELOW search, ABOVE filters (per §13.7 correction #1 — final order
Search → Favorites → Filters). Each favorite chip = pinned family group chip
with ⭐ icon + click-to-scroll-to-mod-in-list + ✗ to unpin. Header:
«⭐ Избранные: N» + «Очистить» button (calls `clearPinned()`). Wire
`togglePinned(id)` action to favorite buttons on each FilterChip (new ⭐ icon
slot, optional prop).

**Альтернативный старт (warmup):** Phase 4 (colors + compact + tooltips) или
Phase 4.5 («Обозначения» icon legend) — независимы от Phase 1, можно делать в
любой итерации. Phase 4 files: `src/index.css` (stronger color tints),
`src/ui/components/FilterChip.tsx` (compact density 25%), new
`src/ui/components/Tooltip.tsx` (portal-based). Phase 4.5 file: new
`src/ui/components/IconLegend.tsx` (3 rows: ⭐/—/ⓘ icon meanings).

**Главные ограничения для iter 136:**

- НЕ реализовывать TopNav dropdowns — visualization keeps flat nav.
- Phase 5: left panel order Search → Favorites → Filters (§13.7 #1).
  `pinnedIds` поле уже готово (и props уже проброшен в ModList/VirtualizedModList
  в iter 134 — Pitfall 44).
- Phase 4: chip density 25% (px-1.5 py-0.5 text-[12px]); stronger bg tints
  (rgba blue/orange/amber per affix type). Phase 4.5: «Обозначения» legend
  section в right panel (below status, above profile) с 3 icon rows.
- Если найден новый баг — сначала документируй в STATUS.md как Known Issue,
  потом фиксий.

**Подсказка:** для Phase 5 — read `AGENT_NAVIGATION.md` Pitfall 45 (Phase 3
wiring pattern as template for «wired» optional props). Phase 5 wires
`pinnedIds` analogously — but with new `LeftPanelFavorites.tsx` component
instead of right-aside slot. Add ⭐ pin icon slot to `FilterChip.tsx`
(optional `pinnedIds` + `onTogglePinned` props — backward compat preserved).
Modify `src/ui/pages/*/[A-Z]*Page.tsx` (7 pages) to wire `pinnedIds` +
`togglePinned` + `clearPinned` + render `<LeftPanelFavorites>` slot.

**UX verification request for user (iter 135 deliverable):**
Откройте 7 category pages (Belt, Ring, Amulet, Jewel, Waystone, Tablet, Relic)
на десктопе. Проверьте:
1. В controls row появился toggle «Все / Выбранные (N)» (после sortMode).
   «Выбранные» кнопка disabled (полупрозрачная) пока ничего не выбрано.
2. Выберите 2-3 мода. Кликните «Выбранные (N)» — ModList показывает только
   выбранные семейства (другие скрыты). Stats line обновляется: «Показано N
   семейств из M аффиксов».
3. Excluded токены остаются видимыми в «Выбранные» режиме (можно un-exclude).
4. Pinned токены остаются видимыми в «Выбранные» режиме (когда Phase 5
   приземлится — pinned токены будут favorites).
5. Кликните «Все» — ModList снова показывает все семейства.
6. Right aside: над RegexOutput появился SelectedBasket panel. Header
   «Выбрано: N афф.» + «Очистить все» link. Каждый chip = colored badge
   (ПРЕФ=синий, СУФ=оранжевый, ИМПЛ=янтарный) + текст + ✗ cue.
7. Клик по basket chip → снимает выделение с этого семейства.
8. «Очистить все» → очищает все selectedIds.
9. Выберите > 20 модов — basket показывает первые 20 + «+N ещё» expander.
   Клик → раскрывает все + «свернуть» кнопку.
10. Right aside header: chevron toggle. Клик → aside схлопывается до узкой
    полоски (48px) с ⚙ иконкой + chevron. Клик снова → разворачивается.
11. State сохраняется в URL: `so=1` (showSelectedOnly) после refresh.
    Right-aside collapse НЕ persistится (локальное состояние).

Если замечен баг — сначала документируйте в STATUS.md как Known Issue, потом фиксий.

KI#9 — monitoring, не фиксировано. Если найден новый баг — сначала
документируй в этом файле как Known Issue, потом фиксий.

---

Контакты: Discord **woonderdad**
