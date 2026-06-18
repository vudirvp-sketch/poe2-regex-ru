# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 79
Agent: main
Task: iter 79 — Bug #8 Phase 2: split `useCategoryPage` на 3 sub-hooks (`useFilterStore`/`useCategoryData`/`useRegexBuilder`) + fix 3 setState-in-effect errors в WaystonePage/JewelPage/TabletPage. Все 1157 тестов зелёные. `tsc -b` чистый. Lint: 5 → 2 problems (3 setState-in-effect errors fixed; 2 unfixable library warnings: TanStack Virtual `useVirtualizer`).

Work Log:
- 1: Клон репо `git clone https://github.com/vudirvp-sketch/poe2-regex-ru.git`. `pnpm install`. Baseline: `tsc -b` чистый, `vitest run` — 1157 passed, `eslint .` — 5 problems (3 errors + 2 warnings). Совпадает с iter 78 worklog.
- 2: Изучен контекст — STATUS.md, AGENT_NAVIGATION.md (Pitfall 33 — circular dependency problem). 3 lint errors: WaystonePage:66 (`setCorrupted`), JewelPage:99 (`setJewelTypeFilter`), TabletPage:101 (`setSelectedTypes`). Все 3 — `useEffect(() => { setX(filterStore.getExtraState(...)) }, [])` pattern.
- 3: Анализ circular dependency:
  - `useCategoryPage({ extraAstNodes, ... })` creates filterStore internally + URL-restores.
  - Page local state (`corrupted`, etc.) хочет lazy-init из filterStore extraState через `useState(() => ...)`.
  - Но `extraAstNodes` зависит от local state → `useCategoryPage` нужно вызывать AFTER `extraAstNodes` → local state needs filterStore → filterStore is inside `useCategoryPage` → circular.
  - **Fix:** extract filterStore creation в отдельный `useFilterStore(categoryId)` hook. Page вызывает его FIRST, потом local `useState` lazy-init, потом `useCategoryPage({ filterStore: useStore, ... })`.
- 4: Реализован split в `src/ui/hooks/useCategoryPage.ts` (486 → 638 строк):
  - **`useFilterStore(categoryId): FilterStoreHook`** — `useMemo(() => createFilterStore(), [categoryId])` (eslint-disable for exhaustive-deps, как в iter 78) + `useState(() => syncFromUrl(useStore.getState()))` для one-shot URL restore. Returns Zustand hook.
  - **`useCategoryData({ categoryId, mergeCategories, customData })`** — `useState` для data/loading/error + `useEffect` для async load. `customData` branch early-returns без setState (iter 78 fix preserved).
  - **`useRegexBuilder({ data, selectedIds, excludedIds, extraAstNodes, searchLogic, minValue, maxValue, round10Enabled, locale, perTokenRanges, thresholdEnabled })`** — pure `useMemo` для selectedTokens + `useMemo` для regex/overflow/parts/collapsedIds. Logic unchanged (просто extracted).
  - **`useCategoryPage(config)`** теперь compose-хук: calls `useFilterStore(categoryId)` (always — Rules of Hooks), `useCategoryData(...)`, 6 inline `useState` (lazy-init from extraState — `if (urlRestored)` guard removed т.к. extraState пустой когда URL пустой = эквивалентно), inline URL-sync `useEffect` (tightly coupled к 6 useState values — extract не оправдан), `useRegexBuilder(...)`. Accepts optional `config.filterStore: FilterStoreHook` — when provided, uses it instead of internal store.
  - **Backward compat:** re-exports `buildAstFromSelections` + `pushLiteralsWithFamilyLogic` + `applyRuntimeYofication` from `./category-ast-utils` preserved (tests `tests/ui/buildAstFromSelections.test.ts` + `tests/ui/vendor-regex-equivalence.test.ts` импортируют из `@ui/hooks/useCategoryPage`).
  - **`FilterStoreHook` type alias** exported: `ReturnType<typeof createFilterStore>` — Zustand hook with `.getState()` / `.subscribe()` + callable as hook.
- 5: Updated `WaystonePage.tsx` (215 → 231 строк):
  - Before: `useState(false)` → `useCategoryPage({ extraAstNodes })` → `useEffect(() => setCorrupted(filterStore.getExtraState('corrupted')))` (LINT ERROR).
  - After: `useFilterStore('waystone')` → `useState(() => useStore.getState().getExtraState('corrupted') ?? false)` (×3 для corrupted/uncorrupted/delirious) → `extraAstNodes = useMemo(...)` → `useCategoryPage({ filterStore: useStore, extraAstNodes, ... })` → write-back `useEffect` без setState (только `useStore.getState().setExtraState(...)`). `syncReadyRef` preserved для skip-first-render pattern.
- 6: Updated `JewelPage.tsx` (296 → 304 строк) — аналогично Waystone, lazy-init `jewelTypeFilter` из extraState.
- 7: Updated `TabletPage.tsx` (290 → 302 строк) — аналогично, lazy-init `selectedTypes` (Set<string>), `selectedRarities` (Set<string>), `usesMin` (number|null) из extraState.
- 8: Verification:
  - `npx tsc -b --force` — чистый.
  - `pnpm test` — 1157/1157 passed (без изменений от baseline).
  - `pnpm lint` — **2 problems (0 errors + 2 warnings)** (down from 5):
    - 2 warnings `react-hooks/incompatible-library` (VirtualizedModList.tsx:307, 593) — `useVirtualizer()` returns non-memoizable functions; cannot fix without changing the library.
  - `pnpm build` — успешно, 9 prerendered HTML files generated.
- 9: Документация:
  - `STATUS.md` — iter → 79. Bug #8 (Phase 2) removed из "Открытые долги" (resolved). Lint cleanup — updated: "2 problems (2 library warnings unfixable). iter 79 closed все 3 setState-in-effect errors."
  - `AGENT_NAVIGATION.md` — iter 79 entry в header. Pitfall 33 updated: "iter 78 Phase 1 + iter 79 Phase 2 — RESOLVED" с подробным описанием split + circular dependency fix. iter 78 сжат до 1 строки. "Where Things Are" — `useCategoryPage.ts` row updated с описанием split.
  - `worklog.md` — iter 79 запись (этот блок), iter 78 сжат до 1 строки.

Stage Summary:
- **iter 79 COMPLETE (Phase 2 of Bug #8).** `useCategoryPage` split на 3 sub-hooks (`useFilterStore`/`useCategoryData`/`useRegexBuilder`). 3 setState-in-effect errors fixed в WaystonePage/JewelPage/TabletPage через `useFilterStore`-BEFORE-`useState` pattern. Behavior preserved: URL-restored values теперь применяются на FIRST render (раньше: на втором render после useEffect — был flash of default state — теперь лучше).
- **Изменённые файлы (6):**
  - `src/ui/hooks/useCategoryPage.ts` (486 → 638 строк) — 3 new sub-hooks + main compose-hook + `FilterStoreHook` type + `config.filterStore` optional param
  - `src/ui/pages/waystone/WaystonePage.tsx` (215 → 231 строк) — `useFilterStore` + lazy-init pattern
  - `src/ui/pages/jewel/JewelPage.tsx` (296 → 304 строк) — `useFilterStore` + lazy-init pattern
  - `src/ui/pages/tablet/TabletPage.tsx` (290 → 302 строк) — `useFilterStore` + lazy-init pattern
  - `STATUS.md` + `AGENT_NAVIGATION.md` + `worklog.md` (docs)
- **Метрики:** 1157/1157 passed (без изменений). `tsc -b` чистый. Lint: 2 problems (0 errors + 2 warnings, down from 5). Build OK.
- **Не сделано (намеренно):**
  - Bug #13 (`iterative-optimizer.ts:470` skip `.*[0-9][1-9]`) — deferred: не 1-line fix, требует ETL rerun + analysis.
  - Bug #16 (`IMPLICIT_RANGE_UNRESTRICTED = [0, 350]` magic number) — низкий приоритет.
  - Bug #17 (negated char class from/to -1 хак) — низкий приоритет.
  - `useUrlSync` extract — не сделан (URL sync effect tightly coupled к 6 useState values в `useCategoryPage`, extract не оправдан).
- **Точка остановки:** iter 79 done. Bug #8 Phase 2 complete (split на 3 sub-hooks + 3 setState-in-effect fixes). Bug #8 полностью закрыт (Phase 1 + Phase 2). Следующая итерация: Bug #13 (требует ETL rerun) или Bug #16/#17 (низкий приоритет).

---

## Предыдущие итерации (кратко)

- **iter 78**: Bug #8 Phase 1 — pure AST helpers extracted в `src/ui/hooks/category-ast-utils.ts` (890 строк); `useCategoryPage.ts` 1325 → 486 строк. 2 lint fixes (1 setState-in-effect + 1 exhaustive-deps). 1157/1157 зелёных.
- **iter 77**: Lint cleanup 44→7 problems (37 fixed in 14 files). useCategoryPage.ts:793 regex escape fix. Все 1157/1157 зелёных.
- **iter 76**: KI-3 resolved (poe2db.tw OLD forms stable >1 year) + KI-2 data-level (ETL rerun с original OLD-form keys: waystone 302→156, tablet 86→84). 1157/1157 зелёных.
- **iter 75**: KI-2 code-fixed (NEW-form hardcoded keys, 3 `it.fails` → `it`). KI-3 обнаружен. ETL rerun заблокирован.
- **iter 74**: Lint cleanup тестов (11 ошибок в 5 файлах) + Bug #15 → KI-2 документирован.
- **iter 73**: Закрыт KI-1 (`?` tokenizer mismatch) через detector + warn + Oracle reject + ETL reject.
- **iter 72**: Дедупликация ETL-утилит, удаление dead code.
- **iter 71** (Phase 16): Интеграция 3 leftover atmospheric WebP.
- **iter 70** (Phase 15): Visual review lg+/xl+; filter contrast fix; `bg-forest.webp` deleted.
- **iter 65-69** (Phase 11-14): Атмосферная стилизация PoE2 + HomePage hero decorations.
- **iter 64** (Phase 10): Sidebar + Header + MobileNavTabs → TopNav.
- **iter ≤63**: MobileRegexBar; StatusPanel; HomePage compaction; CSS tokens + CategoryLayout + RegexOutput.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
