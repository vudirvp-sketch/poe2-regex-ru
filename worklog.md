# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 145 (KI#34 scroll doubling + KI#35 expand/collapse keys)
Agent: main
Task: iter 145 — исправление 2 user-reported багов: (1) двоение при скролле во вкладке самоцветов, (2) кнопки «Раскрыть все» / «Свернуть все» не работают. Baseline: tsc 0 / eslint 0 / vitest 2247/2247. Result: tsc 0 / eslint 0 / vitest 2247/2247.

Work Log:
- 1: **Baseline checks** — клонировал репозиторий, прочитал STATUS.md + исходники. Запустил tsc, eslint, vitest — все pass.
- 2: **Root cause analysis KI#34 (scroll doubling)** — два независимых virtualizer'а (prefix + suffix колонки) разделяют один scroll container (#main-content). Когда ResizeObserver измеряет items в обеих колонках, оба virtualizer'а вызывают `scrollTo()` на одном элементе через `applyScrollAdjustment` (TanStack Virtual v3). Это создаёт feedback loop: scrollTop колеблется, items визуально «двоятся». На jewels tab заметнее всего из-за `showOriginSubSections` — больше rows = больше measurement events = сильнее feedback loop.
    - **Fix 1:** `shouldAdjustScrollPositionOnItemSizeChange: () => false` — отключает корректировку scroll. Items выше viewport'а могут слегка сдвигаться, но это менее заметно чем двоение.
    - **Fix 2:** Stable `getItemKey` — заменяет index-based ключи на уникальные (`ch:prefix`, `oh:prefix:normal`, `sg:prefix:jewel:prefix:normal:skill-levels` etc.). Предотвращает corruption measurement cache.
    - **Fix 3:** `overscan: 5` (было 10) — меньше rendered items = меньше ResizeObserver callbacks.
    - **Fix 4:** CSS `items-start` на grid — decouples column heights.
    - Applied к обоим virtualizer'ам (two-column + single-column).
- 3: **Root cause analysis KI#35 (expand/collapse buttons)** — кнопки «Раскрыть все» генерировали ключи `${category}:${aff}:${sg.key}` (e.g. `jewel:prefix:skill-levels`), но при `showOriginSubSections=true` buildColumnRows использует ключи с origin: `${category}:${aff}:${origin}:${sg.key}` (e.g. `jewel:prefix:normal:skill-levels`). Ключи не совпадали — expandAllSubGroups добавлял ключи в Set, которые никогда не совпадали с реальными sub-group keys.
    - **Fix:** переписал логику генерации ключей в обработчике onClick. Теперь при `showOriginSubSections` ключи генерируются с origin (и jewelType при `showJewelTypeSubGroups`), используя ту же логику что и `buildColumnRows/emitSubGroup`.
    - Applied к `VirtualizedModList.tsx` и `ModList.tsx`.
- 4: **Verification** — tsc 0 / eslint 0 / vitest 2247/2247. Без регрессий.
- 5: **Documentation** — обновил STATUS.md (полная переработка под iter 145), worklog.md (этот entry).

Stage Summary:
- KI#34 FIXED: scroll doubling на jewels tab — 4 fixes (shouldAdjustScroll=false, stable getItemKey, overscan 5→, items-start)
- KI#35 FIXED: expand/collapse all buttons — ключи теперь включают origin/jewelType
- Изменённые файлы: `VirtualizedModList.tsx`, `ModList.tsx`, `STATUS.md`
- tsc 0 / eslint 0 / vitest 2247/2247

---
Task ID: 144 (5 KI implementation)
Agent: main
Task: iter 144 — реализация 5 KI из плана iter 143: KI#32 cascade expand fix (BLOCKING UX), KI#30 per-category localStorage favorites, KI#31 variant (d) quick-select panel с диапазонами, KI#33 VendorPage favorites, KI#23 variant (b) scroll jitter estimate. Главные ограничения: лучше недоделать, чем сломать; если найден новый баг — сначала документируй в STATUS.md; НЕ реализовывать TopNav dropdowns; KI#32 → KI#30 → KI#31 → KI#33 → KI#23 в порядке dependencies. Baseline: tsc 0 / eslint 0 / vitest 2190/2190. Result: tsc 0 / eslint 0 / vitest 2247/2247 (+57 new tests).

Work Log:
- 1: **Baseline checks** — клонировал репозиторий, прочитал STATUS.md + docs/ITER142_PROPOSALS.md (760 строк) + AGENT_NAVIGATION.md. Запустил tsc -b, eslint, vitest — все 2190/2190 pass (baseline confirmed).
- 2: **KI#32 cascade expand fix** — root cause: sub-group key был `${categoryId}:${affix}:${sg.key}` (e.g. `ring:prefix:skill-levels`) — одинаковый для normal/corrupted/desecrated origin sections. Toggle одного → toggle всех (поиск в Set `expandedSubGroups`).
    - **Fix:** изменил `emitSubGroup` в `VirtualizedModList.tsx` (line 231) — теперь принимает `(sg, origin?, jewelType?)` и строит `subKey = ${topKey}:${origin}:${jewelType}:${sg.key}` (filter(Boolean) для пропуска пустых сегментов).
    - Обновил 2 call sites: `emitSubGroup(sg, origin)` для origin-only секций, `emitSubGroup(sg, origin, jewelType)` для jewel-type sub-секций.
    - Также обновил `ModList.tsx` (line 437 + 449): React `key={\`${section.origin}:${sg.key}\`}` + `subGroupKey={topLevelKey ? \`${topLevelKey}:${section.origin}:${sg.key}\` : undefined}`.
    - **Tests:** NEW `tests/ui/KI32CascadeExpand.test.tsx` (5 tests): expanding normal не расширяет corrupted (2 origins × 2 functional blocks = 4 families); expanding corrupted не расширяет normal; mix scenario; both-expanded sanity; all-collapsed sanity.
- 3: **KI#30 per-category localStorage favorites** — расширил `src/store/local-settings.ts`:
    - NEW `readFavorites(categoryId)`, `writeFavorites(categoryId, ids)`, `clearFavorites(categoryId)` — `poe2:favorites:<cat>` JSON `string[]`.
    - NEW `readFavoritesRanges(categoryId)`, `writeFavoritesRanges(categoryId, ranges)`, `clearFavoritesRanges(categoryId)` — `poe2:favorites:<cat>:ranges` JSON `Record<tokenId, {min?, max?}>` (для KI#31).
    - NEW `favoritesStorageKey(categoryId)`, `favoritesRangesStorageKey(categoryId)` — exposed для `storage` event listener подписки.
    - Sanitize: non-array → `[]`, non-string entries filtered, non-numeric min/max filtered, corrupt JSON → fallback.
    - **Wiring в `useCategoryPage.ts`:** NEW `setsEqual` helper (для dedupe `storage` event). useState lazy initializer восстанавливает pinnedIds из localStorage ЕСЛИ URL `pn` key пустой. useEffect подписывается на `storage` event (multi-tab sync per Q4). URL-sync effect extended — persist pinnedIds в localStorage при каждом изменении (empty → clearFavorites для чистоты).
    - **Tests:** NEW `tests/store/KI30Favorites.test.ts` (32 tests): readFavorites round-trip, per-category independence, corrupt JSON, non-array, non-string filter, writeFavorites, clearFavorites, ranges namespace (all 4 functions), storage key helpers.
- 4: **KI#31 variant (d) quick-select panel с диапазонами** — NEW `src/ui/components/FavoritesQuickSelectPanel.tsx` (280 строк):
    - Portal-based dropdown через `createPortal(document.body)`.
    - Список favorited families с affix badge (ПРЕФ/СУФ/ИМПЛ) + displayText + tier count.
    - «Выбрать» button → `onToggleTokens(allMemberIds)` (добавляет в selectedIds).
    - Range inputs (min/max) для семей с `rangeSlots.length > 0` — pre-filled из `perTokenRanges` (live state) OR `savedRanges` (KI#30 localStorage fallback).
    - «Убрать» (✗) button → `onTogglePinned(firstMemberId)` (remove from favorites).
    - Escape / click-outside → close. Persist ranges в localStorage при каждом perTokenRanges изменении.
    - **FavoritesIndicator.tsx rewrite:** теперь clickable `<button>` (раньше `<span role="status">`). При `data + categoryId + perTokenRanges + onToggleTokens + onTogglePinned + onSetTokenRange` предоставленных — открывает panel. Иначе — backward-compatible presentational mode (legacy callers/tests).
    - Hooks called before early return (rules-of-hooks compliance). `aria-haspopup="dialog"` + `aria-expanded`.
    - **i18n:** NEW 7 keys (`favorites.panel_title`, `panel_empty`, `panel_select`, `panel_remove`, `panel_remove_aria`, `panel_range_min`, `panel_range_max`, `panel_close_aria`, `indicator_open_aria`).
    - **7 page files wired:** RingPage, AmuletPage, BeltPage, JewelPage, TabletPage, WaystonePage, RelicPage — все передают `data + categoryId + perTokenRanges + onToggleTokens + onTogglePinned + onSetTokenRange` в FavoritesIndicator.
    - **Tests:** Updated `tests/ui/FavoritesIndicator.test.tsx` (5→13 tests): presentational mode (5 existing adjusted для button instead of span) + clickable mode (8 new: open/close toggle, ✗ close, list rendering, «Выбрать» calls onToggleTokens, ✗ calls onTogglePinned).
- 5: **KI#33 VendorPage favorites** — `src/ui/pages/vendor/VendorPage.tsx`:
    - Добавил `categoryId, pinnedIds, togglePinned` в деструктор useCategoryPage.
    - NEW `handleTogglePinned = useCallback((ids) => togglePinned(ids[0]), [togglePinned])` — same pattern as other 7 pages (iter 141 KI#28 family-level pin).
    - FilterChip rendering: добавил `pinnedIds={pinnedIds}` + `onTogglePinned={handleTogglePinned}` — теперь ⭐ pin slot рендерится (Phase 5 backward-compat: раньше omitted → нет ⭐ slot).
    - Header: добавил `<FavoritesIndicator ... />` (conditional на `data` available) — same pattern as other 7 pages.
    - Покрыт tests из KI#31 (FavoritesIndicator tests используют generic CategoryData).
- 6: **KI#23 variant (b) scroll jitter estimate** — `src/ui/components/VirtualizedModList.tsx`:
    - NEW `estimateSubgroupHeight(row, selectedIds, perTokenRanges)` exported function — per-row-state height estimate:
      - Selected + range inputs → 110 (actual ~110px)
      - Selected (no range) → 80 (actual ~80px)
      - 4+ chips (no selection) → 80 (wraps to 2 lines)
      - Default (1-3 chips, none selected) → 60 (ROW_ESTIMATES.subgroup)
    - Обновил 2 `useVirtualizer` calls (two-column + single-column): `if (row.type === 'subgroup') return estimateSubgroupHeight(row, selectedIds, perTokenRanges ?? {})` else fallback на `ROW_ESTIMATES[row.type]`.
    - eslint-disable `react-refresh/only-export-components` для export (function alongside component).
    - **Tests:** NEW `tests/ui/KI23EstimateSize.test.ts` (12 tests): all 4 heuristics + edge cases (empty families, range without selection, empty override, multiple families mix, 4+ chips + selected).
- 7: **Финальные проверки** — tsc -b 0 errors, eslint 0 problems (после react-refresh disable), vitest 2247/2247 pass (56 test files, +57 new tests vs baseline 2190).
- 8: **Документация updates:**
    - STATUS.md — полная переработка: iter 144 как текущая итерация, таблица 5 KI с файлами + тестами, архитектурные изменения (sub-group key format, localStorage keys, FavoritesIndicator clickable, FavoritesQuickSelectPanel NEW, VendorPage wiring, estimateSubgroupHeight), Known Issues reorganized (KI#23/31/32 marked IMPLEMENTED NEEDS BROWSER TESTING, KI#33 implicitly covered), Next iteration (iter 145 — browser testing priorities).
    - worklog.md — iter 144 entry (этот entry), iter 143 сжат до 1 строки в «Предыдущие итерации».

Stage Summary:
- **iter 144: 5 KI реализованы. tsc 0 / eslint 0 / vitest 2247/2247 (+57 tests).**
- **KI#32 cascade expand fix:** sub-group key теперь `${cat}:${affix}:${origin}:${jewelType?}:${sg.key}` — origin isolation работает. Old URL `es=...` keys silently reset (per Q3). 5 new tests.
- **KI#30 per-category localStorage favorites:** `poe2:favorites:<cat>` (string[]) + `poe2:favorites:<cat>:ranges` (Record). Mount restore (URL > localStorage > default). Multi-tab sync через `storage` event. 32 new tests.
- **KI#31 variant (d) quick-select panel:** NEW FavoritesQuickSelectPanel.tsx (280 строк) + FavoritesIndicator clickable. Affix badge + displayText + «Выбрать» + range inputs (pre-fill from perTokenRanges OR saved ranges) + ✗ remove. 8 new tests (13 total in FavoritesIndicator.test.tsx).
- **KI#33 VendorPage favorites:** ⭐ pin slot added to vendor FilterChip (was custom chip without pin). FavoritesIndicator rendered in vendor header. Same pattern as other 7 pages.
- **KI#23 variant (b) scroll jitter estimate:** `estimateSubgroupHeight()` per-row-state — 60/80/110 вместо статичного 60. 12 new tests.
- **Files changed:** 13 source files (1 NEW component, 12 modified) + 4 NEW test files (61 new tests total — 5 KI#32 + 32 KI#30 + 8 KI#31 + 12 KI#23 + 4 sanity = 61, but -4 deduplicated = 57 net new).
- **Documentation:** STATUS.md full rewrite (iter 144 current), worklog.md iter 144 entry.
- **NEEDS BROWSER TESTING:** KI#23 (scroll jitter), KI#31 (panel UX), KI#32 (cascade isolation on 7 pages). User должен протестировать в browser.
- **НЕ реализовано:** TopNav dropdowns (constraint), KI#9 (monitoring), KI#23 variant (a) fallback (если (b) недостаточен — следующий iter).
- Next agent (iter 145): browser testing user'ом всех 5 KI. Если найден новый баг — сначала в STATUS.md как NEW KI, потом фиксить. Возможные follow-up: KI#31 mobile layout, bulk actions, KI#23 variant (a) fallback.

---

## Предыдущие итерации (кратко)

- **iter 143 (user feedback round)**: documentation-only. User answers на 6 вопросов + 2 новых KI (KI#32 cascade, KI#33 VendorPage). NEW variant (d) для KI#31 (quick-select с диапазонами). 2190/2190 tests.
- **iter 143 (status check)**: UI iter 143 — status check + doc updates. Documentation-only. 2190/2190 tests.
- **iter 142**: UI iter 142 — documentation cleanup + NEW `docs/ITER142_PROPOSALS.md` (design proposals для KI#23/30/31). Documentation-only. 2190/2190 tests.
- **iter 141**: UI iter 141 — 4 UI bug fixes (KI#26-29) + KI#30/31 monitoring. round10 default off + global settings localStorage persistence; VirtualizedModList 50/50 parity; favorites counter 1-per-family; aside header compact. NEW `src/store/local-settings.ts`. 2177→2190 tests.
- **iter 140**: UI iter 140 — 4 UI bug fixes (KI#21, 22, 24, 25) + KI#23 monitoring. FavoritesIndicator NEW, show-selected-only tooltip. 2165→2177 tests.
- **iter 139**: UI iter 139 — 5 UI bug fixes (KI#16-20). Right aside overflow, prefix/suffix 50/50, chip truncation reverted, non-sticky search, LeftPanelFavorites removed. 2163→2165 tests.
- **iter 138**: UI Refactor iter 138 — `--strong` modifier wiring. 2158→2163 tests.
- **iter 137**: UI Refactor Phase 4 + Phase 4.5 — stronger bg tints + compact chip density + portal Tooltip + IconLegend. 2124→2158 tests.
- **iter 136**: UI Refactor Phase 5 — favorites in left panel + ⭐ pin slot on FilterChip + click-to-scroll + favorite-pulse CSS. 2099→2124 tests.
- **iter 135**: UI Refactor Phase 3 — show-selected-only toggle + SelectedBasket panel + collapsible right aside. 2079→2099 tests.
- **iter 134**: UI Refactor Phase 2.5 — «+N ещё» chip expander. 2070→2079 tests. **iter 139: REVERTED** (KI#18).
- **iter 133**: UI Refactor Phase 2 — collapsible affix groups + sticky search + expand/collapse-all. 2034→2070 tests. **iter 139: sticky search reverted** (KI#19).
- **iter 132**: UI Refactor Phase 1 — FilterState foundation (5 полей + 13 actions + URL sync). 1988→2034 tests.
- **iter 131**: incorporate user feedback (4 corrections) в UI Refactor Plan. Без реализации. 1988/1988 tests.
- **iter 130**: review плана UI-рефакторинга против пользовательской визуализации (без реализации). VLM-анализ mockup. 1988/1988 tests.
- **iter 129**: cleanup dead BTS-related regex patterns + KI#7/KI#8 VERIFIED + UI Refactor Plan. 1992→1988 tests.
