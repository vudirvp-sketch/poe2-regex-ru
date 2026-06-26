# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 135
Agent: main
Task: UI Refactor Phase 3 implementation — show-selected-only mode + SelectedBasket panel. Wire `showSelectedOnly` (уже в store с Phase 1, iter 132) в UI через toggle в `CategoryControlPanel.tsx` + filter logic в `ModList.tsx` + `VirtualizedModList.tsx`. Создать новый `SelectedBasket.tsx` компонент в правой панели (cap=20 chips per §13.7 #3). Restructure `CategoryLayout.tsx` right `<aside>` (basket → regex → status → profile) с 3-column 20%/60%/20% + collapsible right panel per §13.7 #2. План — `docs/UI_REFACTOR_PLAN.md` §4 Phase 3.

Work Log:
- 1: Репозиторий клонирован. Установлен pnpm 11.5.2 (через `corepack` + fallback на `npm install -g pnpm@11.5.2 --prefix=/home/z/.local` из-за EACCES на corepack symlink). Baseline проверки: vitest 2079/2079 (45 test files), tsc 0 errors, eslint 0 problems — состояние чистое, как в iter 134.
- 2: Прочитан `STATUS.md` (180 строк) — confirmed iter 134 done, Phase 2.5 chip expander готов. Identified next-step: Phase 3 (selected-only + basket).
- 3: Прочитан `docs/UI_REFACTOR_PLAN.md` §4 Phase 3 (строки 308-372) + §13.6 (recommendation для iter 135) + §13.7 (4 user-feedback corrections) + §12 Phase Status table. Ключевые требования: `SELECTED_BASKET_CAP = 20` constant (iter 131 #3 raised 12→20), `SelectedBasket.tsx` (NEW) — renders `selectedIds` as chips (re-use `FilterChip` в read-only mode, no per-token ranges, click-to-deselect, ✗ to exclude), affix-type badges («ИМПЛИСИТ/ПРЕФИКС/СУФФИКС» — iter 130 #4) prefixed to each basket chip, max-height 30vh with internal scroll (iter 131 #2), 3-column layout 20%/60%/20% + collapsible right panel (iter 131 #2), wire `showSelectedOnly` to filter `familyGroups` в ModList/VirtualizedModList.
- 4: Прочитан `src/store/filter-store.ts` (513 строк) — confirmed `showSelectedOnly: boolean` field + `setShowSelectedOnly(value)` action + URL serialization (`so` compact key, omitted when default false) уже готовы с Phase 1 (iter 132).
- 5: Прочитан `src/ui/hooks/useCategoryPage.ts` (741 строк) — identified Phase 2.5 wiring pattern (2 fields + 2 useStore subscriptions + URL-sync deps array + return object) как template для Phase 3 wiring (same 2 fields).
- 6: Прочитан `src/ui/components/ModList.tsx` (1024 строк) + `src/ui/components/VirtualizedModList.tsx` (1071 строк) — identified `priorityFilteredGroups` useMemo как target для замены на `visibleGroups` (priority filter + show-selected-only filter chained). Identified `implicitGroups/prefixGroups/suffixGroups` (filter by affix) + stats line как consumers для обновления.
- 7: Прочитан `src/ui/components/CategoryControlPanel.tsx` (373 строк) — identified pattern для toggle radio group (radiogroup role + onKeyDown arrow-key navigation + aria-checked). Identified `priorityFilter` + `sortMode` toggles как existing template.
- 8: Прочитан `src/ui/components/FilterChip.tsx` (491 строк) — confirmed `displayText`, `affix`, `members` fields доступны на FamilyGroup для basket chip rendering.
- 9: Прочитан `src/ui/components/StatusPanel.tsx` (110 строк) — confirmed current right-aside status layout, не тронут (basket = NEW component above RegexOutput, status panel unchanged).
- 10: `src/shared/constants.ts` +`SELECTED_BASKET_CAP = 20` constant с подробным JSDoc (iter 131 §13.7 #3 — user wants 20-25, quote «У вас легко собираются regex на 15–30 модов»).
- 11: `src/shared/i18n.ts` +16 keys (Phase 3 section): `filter.show_all`, `filter.show_selected` ({n}), `filter.show_mode_label`, `basket.title` ({n}), `basket.title_suffix`, `basket.empty`, `basket.clear`, `basket.clear_aria`, `basket.more` ({n}), `basket.more_aria` ({n}), `basket.collapse`, `basket.collapse_aria`, `basket.unselect_aria`, `basket.badge_implicit` («ИМПЛ»), `basket.badge_prefix` («ПРЕФ»), `basket.badge_suffix` («СУФ»), `basket.collapse_panel`, `basket.expand_panel`.
- 12: `src/ui/hooks/useCategoryPage.ts` расширено (3 edits):
    - `CategoryPageState` interface: +2 поля (`showSelectedOnly`, `setShowSelectedOnly`).
    - Main hook: +2 `useStore(state => state.X)` selector subscriptions.
    - URL-sync `useEffect` deps array: +`showSelectedOnly` (so toggle triggers URL re-sync).
    - Main hook return object: +2 fields.
- 13: `src/ui/components/SelectedBasket.tsx` (NEW, ~220 строк) — created. Renders one chip per selected family group (NOT per token). Each chip = colored affix badge (ПРЕФ/СУФ/ИМПЛ) + displayText + ✗ icon. Click chip → onToggleTokens(memberIds) deselects. Cap = SELECTED_BASKET_CAP (20). When count > cap → first 20 visible + «+N ещё» expander; click reveals all + «свернуть» button. Empty state → «Выберите аффиксы» placeholder. Max-height 30vh with internal scroll. «Очистить все» link calls onClearSelections. Accessible: role="button" + tabIndex=0 + Enter/Space keydown + aria-label «{displayText} — Снять выделение».
- 14: `src/ui/components/CategoryControlPanel.tsx` расширено (2 edits):
    - `CategoryControlPanelProps` interface: +3 optional props (`showSelectedOnly`, `onSetShowSelectedOnly`, `selectedCount`).
    - JSX: +radio group toggle «Все / Выбранные ({n})» placed after sortMode toggle. «Выбранные» button disabled when selectedCount===0. Arrow-key navigation wired via existing `handleRadioKeyDown` helper. Backward compat: when `onSetShowSelectedOnly` not provided → toggle not rendered.
- 15: `src/ui/layout/CategoryLayout.tsx` расширено (полный rewrite header + 4 edits):
    - `CategoryLayoutProps` interface: +1 optional prop (`basket?: React.ReactNode`).
    - Local state: `rightPanelCollapsed` boolean useState (NOT persisted to URL — transient view-mode toggle).
    - Grid template: `lg:grid-cols-[1fr_320px]` (was `lg:grid-cols-[1fr_380px]`) — 320px ≈ 20% of 1600px viewport per iter 131 §13.7 #2. When collapsed: `lg:grid-cols-[1fr_48px]` (just chevron + badge).
    - Aside header: rendered when `basket` provided — contains ⚙ icon (collapsed) + chevron toggle button (aria-expanded, aria-label, title).
    - Aside body: `{!rightPanelCollapsed && <>{basket}{regexOutput}{status}{sidebar}</>}` — collapses to header-only.
    - Mobile section: basket always visible (above status) — no collapse toggle on mobile.
- 16: `src/ui/components/ModList.tsx` расширено (3 edits):
    - `ModListProps` interface: +1 optional prop (`showSelectedOnly?: boolean`).
    - Main component destructure: +`showSelectedOnly = false`.
    - New `visibleGroups` useMemo: when `showSelectedOnly=true` → filter `priorityFilteredGroups` to only those with at least one selected/excluded/pinned member. When false → pass through unchanged (pre-Phase-3 behaviour).
    - `implicitGroups/prefixGroups/suffixGroups` useMemos: replaced `priorityFilteredGroups` → `visibleGroups`.
    - Stats line + mod groups area + origin mode path: replaced `priorityFilteredGroups.length` → `visibleGroups.length`.
- 17: `src/ui/components/VirtualizedModList.tsx` расширено (3 edits): same wiring как ModList — `+1 optional prop`, `visibleGroups` useMemo with IDENTICAL filter logic (kept in sync deliberately), implicitGroups/prefixGroups/suffixGroups + stats line use `visibleGroups`.
- 18: 7 page files обновлены (BeltPage, RingPage, AmuletPage, JewelPage, WaystonePage, TabletPage, RelicPage) через Python-скрипт `/home/z/my-project/scripts/iter135_patch_pages.py` (idempotent, re-runnable). Каждый page:
    - +1 import: `import { SelectedBasket } from '@ui/components/SelectedBasket';`
    - +2 destructured fields из `useCategoryPage()` (`showSelectedOnly`, `setShowSelectedOnly`).
    - +3 props to `<CategoryControlPanel>` (`showSelectedOnly={showSelectedOnly}`, `onSetShowSelectedOnly={setShowSelectedOnly}`, `selectedCount={selectedIds.size}`).
    - +1 prop to `<CategoryLayout>` (`basket={<SelectedBasket tokens={data.tokens} selectedIds={selectedIds} onToggleTokens={toggleTokens} onClearSelections={clearSelections} category={categoryId} />}`).
    - +1 prop to `<VirtualizedModList>` / `<ModList>` (`showSelectedOnly={showSelectedOnly}`).
    VendorPage не тронут (custom FilterChip rendering — no ModList, no CategoryControlPanel).
- 19: 20 новых тестов:
    - `tests/ui/SelectedBasket.test.tsx` (NEW, ~360 строк, 12 tests): empty state placeholder, renders one chip per selected family (not per token), affix-type badges (ПРЕФ/СУФ/ИМПЛ), «Очистить все» button calls onClearSelections, click chip calls onToggleTokens with member IDs, Enter key triggers onToggleTokens, cap=20 renders all when count ≤ cap, truncates to cap + «+N ещё» when count > cap, click «+N ещё» reveals all + «свернуть», click «свернуть» re-truncates, category prop optional.
    - `tests/ui/ModList.test.tsx` +6 tests (Phase 3 describe block): default state all chips render, showSelectedOnly=true only selected families render, excluded tokens stay visible, pinned tokens stay visible (Phase 5 forward-compat), no selections → no chips, stats line shows filtered count.
    - `tests/ui/VirtualizedModList.test.tsx` +2 tests (Phase 3 describe block): mounts with showSelectedOnly=true (jsdom renders 0 virtualized rows but stats line is always rendered → asserts on stats count), backward compat without prop.
- 20: Документация актуализирована: STATUS.md (переписан под iter 135, iter 134 сжат в 1 строку в "Предыдущие итерации"), worklog.md (этот раздел, iter 134 сжат в 1 строку), AGENT_NAVIGATION.md (Pitfall 45 NEW), docs/UI_REFACTOR_PLAN.md §12 (Phase 3 → ✅ DONE) + §13.6 (recommendation → Phase 5 next OR Phase 4/4.5 warmup), README.md (если нужно).

Stage Summary:
- **iter 135 COMPLETE.** Phase 3 UI Refactor implementation готова — show-selected-only toggle + SelectedBasket panel. Toggle «Все / Выбранные (N)» в CategoryControlPanel. SelectedBasket renders selected chips с affix-type badges (ПРЕФ/СУФ/ИМПЛ), cap=20 (iter 131 §13.7 #3), click-to-deselect, max-height 30vh scroll, «+N ещё» expander. Right aside collapsible via chevron toggle (iter 131 §13.7 #2). URL persistence via `so` compact key (уже в store с iter 132).
- **Изменённые файлы (13):**
  - `src/shared/constants.ts` — +`SELECTED_BASKET_CAP = 20` constant.
  - `src/shared/i18n.ts` — +16 keys (filter.show_all/show_selected/show_mode_label, basket.* family, basket.badge_implicit/prefix/suffix, basket.collapse_panel/expand_panel).
  - `src/ui/hooks/useCategoryPage.ts` — +2 CategoryPageState fields, +2 useStore subscriptions, +1 deps in URL-sync effect, +2 return fields.
  - `src/ui/components/SelectedBasket.tsx` (NEW, ~220 строк) — renders selected chips with affix-type badges, cap=20, click-to-deselect, empty state, clear-all button, max-height 30vh scroll.
  - `src/ui/components/CategoryControlPanel.tsx` — +3 optional props (`showSelectedOnly`, `onSetShowSelectedOnly`, `selectedCount`). Toggle radio group «Все / Выбранные (N)» с arrow-key navigation + disabled state when selectedCount===0.
  - `src/ui/layout/CategoryLayout.tsx` — +1 optional prop (`basket`). Right-aside restructure (basket → regex → status → profile). 3-column grid 1fr/320px (20%/20% per iter 131 §13.7 #2). Collapsible right panel via chevron toggle (local state, NOT persisted to URL).
  - `src/ui/components/ModList.tsx` — +1 optional prop (`showSelectedOnly`). New `visibleGroups` useMemo chains priority filter + show-selected-only filter. `implicitGroups/prefixGroups/suffixGroups` + stats line use `visibleGroups`.
  - `src/ui/components/VirtualizedModList.tsx` — +1 optional prop. Same `visibleGroups` useMemo (kept in sync с ModList).
  - `src/ui/pages/belt/BeltPage.tsx` — +1 import, +2 destructure, +3 CategoryControlPanel props, +1 CategoryLayout basket prop, +1 VirtualizedModList prop.
  - `src/ui/pages/ring/RingPage.tsx` — same.
  - `src/ui/pages/amulet/AmuletPage.tsx` — same.
  - `src/ui/pages/jewel/JewelPage.tsx` — same.
  - `src/ui/pages/waystone/WaystonePage.tsx` — same.
  - `src/ui/pages/tablet/TabletPage.tsx` — same.
  - `src/ui/pages/relic/RelicPage.tsx` — same.
  - `tests/ui/SelectedBasket.test.tsx` (NEW, ~360 строк, 12 tests).
  - `tests/ui/ModList.test.tsx` — +6 tests (Phase 3 describe block).
  - `tests/ui/VirtualizedModList.test.tsx` — +2 tests (Phase 3 describe block).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`, `docs/UI_REFACTOR_PLAN.md` — docs updated.
- **Тесты/типы/lint:** ✅ vitest 2079→2099 (+20 tests: 12 SelectedBasket + 6 ModList + 2 VirtualizedModList), tsc 0 errors, eslint 0 problems.
- **Backward compat:** все 4 new props optional (`showSelectedOnly` на ModList/VirtualizedModList; `showSelectedOnly`/`onSetShowSelectedOnly`/`selectedCount` на CategoryControlPanel; `basket` на CategoryLayout) — legacy callers без wiring рендерят как раньше (all chips visible, no toggle, no basket, no collapse chevron).
- **UX features:**
  - Toggle «Все / Выбранные (N)» в controls row. «Выбранные» button disabled when selectedCount===0 (visual cue + cursor-not-allowed).
  - SelectedBasket panel above RegexOutput: «Выбрано: N афф.» header + «Очистить все» link. Each chip = colored badge (ПРЕФ=blue, СУФ=orange, ИМПЛ=amber) + displayText + ✗ cue. Click chip → deselect that family. Cap=20 → «+N ещё» expander.
  - Right-aside collapse chevron in header: click → aside shrinks to 48px badge bar (just chevron + ⚙ icon). Click again → expand back. Local state (NOT persisted).
  - URL persistence: `showSelectedOnly` → `so=1` compact key (already in store since iter 132).
- **KI статус:** без изменений — KI#9 monitoring. Phase 3 UX changes documented в STATUS.md Known Issues #7 (show-selected-only filter) + #8 (basket cap + collapsible panel).
- **НЕ сделано (перенос в iter 136+):**
  1. **Phase 4** (colors + compact + tooltips) — independent of Phase 1, can land any iter.
  2. **Phase 4.5** («Обозначения» icon legend) — independent of Phase 1, can land any iter.
  3. **Phase 5** (favorites in left panel) — потребляет `pinnedIds` (уже в store + props уже проброшен в ModList/VirtualizedModList в iter 134).
  4. **In-game / in-browser UX verification пользователем Phase 2 + Phase 2.5 + Phase 3** — перенос с iter 133+134+135.
  5. **KI#9 (MULTI_RANGE slot N>0)** — monitoring, не фиксировано.
  6. **Persist `rightPanelCollapsed` to URL** — currently local state. If user feedback says they want it persisted across refreshes, add `rpc` (rightPanelCollapsed) boolean field to filter-store (Phase 1 field).
- **Точка остановки:** iter 135 done. Phase 3 UI готов. В iter 136:
  1. Читать `docs/UI_REFACTOR_PLAN.md` §12 (Phase 1+2+2.5+3 ✅ DONE) + §13.6 (recommendation → Phase 5 next OR Phase 4/4.5 warmup).
  2. Читать `AGENT_NAVIGATION.md` Pitfall 42 (Phase 1) + Pitfall 43 (Phase 2) + Pitfall 44 (Phase 2.5) + Pitfall 45 (Phase 3 — show-selected-only filter + SelectedBasket cap logic + collapsible right panel).
  3. Стартовать с Phase 5 (favorites) — wires `pinnedIds` (уже в store + props уже проброшен). Add `LeftPanelFavorites.tsx` in LEFT panel (below search, above filters per §13.7 #1). Wire `togglePinned(id)` / `clearPinned()` actions to favorite buttons on each FilterChip + clear-all button in favorites section header.
  4. ИЛИ Phase 4 / 4.5 — independent work, no Phase 1 dependencies. Good warmup for new agent.
  5. Не реализовывать TopNav dropdowns — visualization keeps flat nav.
  6. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.
- **Подсказка следующему агенту:** iter 135 закрыл UI-часть Phase 3. Toggle «Все / Выбранные (N)» в CategoryControlPanel фильтрует familyGroups в ModList/VirtualizedModList до только selected/excluded/pinned (последние 2 stay visible so user can un-exclude or re-select). SelectedBasket panel в правой части показывает выбранные chips с affix-type badges (ПРЕФ/СУФ/ИМПЛ), cap=20 (iter 131 §13.7 #3), click-to-deselect, «+N ещё» expander. Right aside collapsible via chevron в header (local state). URL persistence через `so=1` compact key (уже в store с iter 132). All new props optional — backward compat preserved. Phase 5 (favorites) потребляет `pinnedIds` (уже в store + props уже проброшен в ModList/VirtualizedModList в iter 134 — Pitfall 44). Phase 5 wiring: create `src/ui/components/LeftPanelFavorites.tsx` (below search, above filters per §13.7 #1); wire `togglePinned(id)` + `clearPinned()` actions. Phase 4 + 4.5 — independent, no Phase 1 deps.

---

## Предыдущие итерации (кратко)

- **iter 134**: UI Refactor Phase 2.5 — «+N ещё» per-sub-group chip expander. Selected/excluded/pinned chips ВСЕГДА видимы в truncated состоянии. `CHIP_PREVIEW_COUNT = 3`. 2070→2079 tests.
- **iter 133**: UI Refactor Phase 2 — collapsible affix groups (top-level + sub-group) + sticky search + expand/collapse-all кнопки. 2034→2070 tests.
- **iter 132**: UI Refactor Phase 1 — FilterState foundation (5 полей + 13 actions + URL sync). 1988→2034 tests.
- **iter 131**: incorporate user feedback (4 corrections) в UI Refactor Plan — Search→Favorites→Filters order, 20%/60%/20% + collapsible right panel, basket cap 20, top-expanded/sub-collapsed default. Без реализации. 1988/1988 tests.
- **iter 130**: review плана UI-рефакторинга против пользовательской визуализации (без реализации). VLM-анализ mockup через z-ai vision → создан `docs/UI_VISUALIZATION_AUDIT.md`. `docs/UI_REFACTOR_PLAN.md` обновлён: +§13 Visualization Audit, +Phase 2.5, +Phase 4.5, Phase 5 RESTRUCTURED. 1988/1988 tests, tsc 0, eslint 0.
- **iter 129**: cleanup dead BTS-related regex patterns + KI#7/KI#8 VERIFIED + UI Refactor Plan. 1992→1988 tests.
- **iter 128**: фикс KI#13 — пропущен implicit `Редкость монстров` + BTS-статы в waystone. 1992/1992 tests.
- **iter 127**: аудит KI#10-pattern + фикс KI#12 (tier-hardcoded regex). KI#11 ОПРОВЕРГНУТА. 1958/1958 tests.
- **iter 126**: фикс KI#10 — ambiguous suffix FP. 1939/1939 tests.
- **iter 125**: фикс in-game FP `(A|B|C) after .* bridge` через `distributeAlternation()` (Path D). 1915/1915 tests.
- **iter 124-122**: cleanup stale DELETIONS files + atmosphere webp (KI#8).
- **iter 121-120**: ре-фикс HomePage hero (KI#7) + фикс scroll jump-to-top в VirtualizedModList (KI#6).
- **iter 119-112**: block-sort rules (damage/defence/resources/weapon/flasks/skill/area/crit/buff/meta/rage/runes/penetration) + «Истощения Бездны» regex-баг фикс + sortKey infrastructure.
- **iter 111-108**: UI-аудит v2 fixes (KI#3/#4/#5, приоритеты 1/2/3) + nested quotes OR-regex fix.
- **iter 107-105**: P4 tier-colored border + tier-aware sort + waystone/tablet sub-blocks.
- **iter 104-101**: waystone sub-blocks + Known Issue #5 fix + TanStack ESLint suppress + e2e regression tests + P0-фикс Critical Bug (`GameTokenSchema` без `functionalCategory`).
- **iter 99-98**: alphabetical within-block sort + relic-semantic mode (7 Sanctum-категорий).
- **iter 96**: удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
