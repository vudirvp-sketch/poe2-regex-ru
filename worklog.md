# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

## iter 158 (MIXED-mode core layer) — одной строкой

Реализован core layer для MIXED mode: AST extension (`MIXED_OR` нода + `MixedOrOptions`), compiler support (KI#45 `anchorFirstAltOnly` mitigation), builder utility (`buildMixedAstFromSelections` + `truncateMixedOrLiterals` для KI#46), 43 юнит-теста. UI-интеграция отложена на iter 159. Все проверки PASS (2278/2278 tests, tsc 0, eslint 0, vite build PASS).

---

Task ID: 159 (MIXED-mode UI integration)
Agent: main
Task: Реализовать UI-интеграцию MIXED mode: расширить SearchLogic тип, добавить `optionalIds: Set<string>` в filter-store (3-state chip), обновить FilterChip (click=want / shift+click=opt / right-click=exclude), добавить MIXED toggle в CategoryControlPanel, обновить useCategoryPage для MIXED-mode builder + auto-truncation, пробросить props через ModList/VirtualizedModList во все 7 page components. In-game verification отложить на iter 160.

Work Log:
- 1: **План и анализ:**
  - Изучил STATUS.md (iter 158 — core layer готов), `src/shared/types.ts`, `src/store/filter-store.ts`, `src/ui/components/FilterChip.tsx`, `src/ui/components/CategoryControlPanel.tsx`, `src/ui/hooks/useCategoryPage.ts`, `src/ui/hooks/category-ast-utils.ts`, существующие тесты.
  - Решил сделать `mixedMode` prop опциональным (default=false) — backward compat для tests + VendorPage + pre-iter-159 callers.
  - Решил использовать ключ `opt` для URL hash (а не `o`, который уже занят под originFilter).
- 2: **`SearchLogic` extended** (`src/shared/types.ts`):
  - Добавлен `'mixed'` к union `'and' | 'or'` с подробным JSDoc (MUST = selectedIds, OPT = optionalIds, EXCLUDE = excludedIds → `"!BAD" "MUST1" "MUST2" "OPT1|OPT2|OPT3"`).
- 3: **`optionalIds` в filter-store** (`src/store/filter-store.ts`):
  - Новый field `optionalIds: Set<string>` в `FilterState`.
  - Новый action `toggleOptional(ids: string[])` — toggle on/off.
  - 3-state mutual exclusion: `toggleToken`/`toggleTokens`/`toggleExclude`/`toggleOptional` все чистят остальные множества при добавлении.
  - `clearSelections()` + `resetFilters()` сбрасывают `optionalIds`.
  - `serialize()`: ключ `opt` только если non-empty (URL compactness).
  - `deserialize()`: backward-compat (missing `opt` → empty set), defensive strip IDs из optionalIds если они уже в selectedIds/excludedIds (precedence: selected > excluded > optional).
- 4: **FilterChip 3-state** (`src/ui/components/FilterChip.tsx`):
  - Новые props: `optionalIds?: Set<string>`, `onToggleOptional?: (ids[]) => void`, `mixedMode?: boolean` (default false).
  - `selectionState` extended: 'full-optional' / 'partial-optional' (skip когда mixedMode=false — 2-state behaviour preserved even with stale optionalIds).
  - `handleClick(e)`: shift+click → opt (mixedMode + onToggleOptional), иначе want.
  - `handleKeyDown(e)`: shift+Enter / shift+Space → opt (keyboard parity).
  - `handleContextMenu(e)`: right-click → exclude (mixedMode + onToggleExclude), preventDefault suppresses browser menu.
  - `bgClass`: OPT state = `bg-amber-900/30 border-l-bl-amber-dim chip-opt` (amber dashed border, visually distinct from MUST/EXCLUDE).
  - `isSelectedForRanges` = isSelected || isOptional → range inputs render для OPT chips too.
  - ARIA: `aria-checked` extended (true/mixed для full-optional/partial-optional), `aria-label` включает «опционально»/«частично опционально».
- 5: **i18n keys** (`src/shared/i18n.ts`):
  - `logic.mixed` = «Смешанный», `logic.mixed_tooltip` — описание shift+click/right-click UX.
  - `chip.optional` = «опционально», `chip.partial_optional` = «частично опционально».
- 6: **CSS .chip-opt** (`src/index.css`):
  - `border-left-style: dashed !important` + `border-left-width: 2px` — отличает OPT от MUST (solid) и EXCLUDE (solid red).
- 7: **CategoryControlPanel MIXED toggle** (`src/ui/components/CategoryControlPanel.tsx`):
  - Третий radio button «Смешанный» в logicOptions для arrow-key navigation.
  - Active style: `bg-accent-amber-soft` (отличается от amber-600 у AND/OR).
  - `title={t('logic.mixed_tooltip')}` для tooltip.
- 8: **useCategoryPage MIXED mode** (`src/ui/hooks/useCategoryPage.ts`):
  - `UseRegexBuilderArgs`: добавлен `optionalIds: Set<string>`.
  - `useRegexBuilder`: при `searchLogic === 'mixed'` делит selectedTokens на mustTokens (selectedIds) и optTokens (optionalIds), вызывает `buildMixedAstFromSelections` (iter 158) вместо `buildAstFromSelections`.
  - **KI#46 auto-mitigation:** если compiled regex > 240 chars → `truncateMixedOrLiterals(optimizedAst, 12)` + re-optimize + re-compile. Accept truncated version только если он короче.
  - `CategoryPageState`: добавлены `optionalIds`, `toggleOptional`.
  - `useState(searchLogic)`: принимает `'mixed'` из extraState / localStorage.
  - URL-sync deps: `optionalIds` добавлен (toggle → re-sync).
  - `restoreFilterState`: принимает `'mixed'` из restored data.
  - Return object: `optionalIds`, `toggleOptional` экспортированы.
- 9: **Проброс props через ModList + VirtualizedModList:**
  - `ModList`: новый props `optionalIds`, `onToggleOptional`, `mixedMode` в interface + деструктуризация + propagation в `ModSubGroupSection`, `AffixColumn`, и все 4 `<FilterChip>` render sites + все 6 `<AffixColumn>` calls.
  - `VirtualizedModList`: те же props в interface + деструктуризация + propagation в `VirtualRowContent` + `VirtualizedColumn` + `columnProps` spread + single-column `VirtualRowContent` render.
- 10: **Page components (7 штук):**
  - `BeltPage`, `RingPage`, `AmuletPage`, `WaystonePage`, `TabletPage`, `RelicPage`, `JewelPage` — каждый патчен:
    - Деструктуризация `useCategoryPage`: добавлены `optionalIds, toggleOptional`.
    - `handleToggleOptional = useCallback((ids) => toggleOptional(ids), [toggleOptional])` — stable reference для React.memo.
    - `<VirtualizedModList>`/`<ModList>`: `optionalIds={optionalIds} onToggleOptional={handleToggleOptional} mixedMode={searchLogic === 'mixed'}`.
  - VendorPage НЕ затронут — использует custom FilterChip без mixedMode wiring (backward compat).
- 11: **Тесты (28 новых, всего 2306):**
  - `tests/store/filter-store.test.ts`: 18 тестов на optionalIds + 3-state mutual exclusion + serialize round-trip + defensive malformed URLs.
  - `tests/ui/FilterChip.test.tsx`: 10 тестов на 3-state click/shift+click/right-click + ARIA + range inputs для OPT + keyboard parity (shift+Enter) + backward compat (mixedMode=false).
- 12: **Verification:**
  - `pnpm exec tsc --noEmit -p tsconfig.app.json` — 0 errors.
  - `pnpm lint` — 0 errors, 0 warnings (после добавления `selectedIds` в useRegexBuilder useMemo deps).
  - `pnpm exec vite build` — PASS, bundle sizes без изменений (342 KB main, 162 KB MobileRegexBar).
  - `pnpm test` — 2306/2306 PASS (было 2278 + 28 новых).
- 13: **Документация:**
  - `STATUS.md` — переписан чисто: iter 159 как текущее состояние, KI#48 (in-game verification) добавлен, iter 160 plan с конкретными T1–T10.
  - `worklog.md` — эта запись (iter 158 сжат до одной строки).

Stage Summary:
- **MIXED-mode UI integration ГОТОВ.** Все 5 пунктов из плана iter 159 выполнены: SearchLogic extended, optionalIds в filter-store, FilterChip 3-state, CategoryControlPanel MIXED toggle, useRegexBuilder MIXED mode + auto-truncation. Props проброшены во все 7 page components.
- **Изменённые файлы (24):**
  - `src/shared/types.ts` — `SearchLogic` extended с `'mixed'`.
  - `src/store/filter-store.ts` — `optionalIds` field + `toggleOptional` action + 3-state mutual exclusion + serialize/deserialize (URL key `opt`).
  - `src/ui/components/FilterChip.tsx` — 3-state chip (click/shift+click/right-click) + OPT visual state (amber dashed) + ARIA.
  - `src/ui/components/CategoryControlPanel.tsx` — MIXED radio button + tooltip.
  - `src/ui/components/ModList.tsx` — `optionalIds`/`onToggleOptional`/`mixedMode` props propagated.
  - `src/ui/components/VirtualizedModList.tsx` — те же props propagated.
  - `src/ui/hooks/useCategoryPage.ts` — MIXED-mode builder + auto-truncation + `optionalIds`/`toggleOptional` exports.
  - `src/ui/pages/{belt,ring,amulet,waystone,tablet,relic,jewel}/*Page.tsx` — 7 page components патчены.
  - `src/shared/i18n.ts` — `logic.mixed`, `logic.mixed_tooltip`, `chip.optional`, `chip.partial_optional`.
  - `src/index.css` — `.chip-opt` CSS class (dashed amber border).
  - `tests/store/filter-store.test.ts` — 18 новых тестов.
  - `tests/ui/FilterChip.test.tsx` — 10 новых тестов.
  - `STATUS.md`, `worklog.md` — актуализированы.
- **Backward compat:** `mixedMode` prop default=false → VendorPage + pre-iter-159 tests не затронуты. URL `opt` key отсутствует в старых ссылках → deserialize как empty set (no crash).
- **Stopping point:** iter 159 завершён. Next iter 160 — in-game verification MIXED-mode UI (KI#48): 5–10 тестов T1–T10 с реальным UI на разных категориях. UX feedback по визуальной отличимости OPT state (amber dashed) и интуитивности shift+click/right-click.

---
