# Worklog

> Только последние 1–2 итерации подробно. Старые — одной строкой. Полная история — в git.

---
Task ID: 78
Agent: main
Task: iter 78 — Bug #8 Phase 1: extract pure helpers from useCategoryPage.ts (1325 → 486 строк) + fix 2 lint issues (setState-in-effect + exhaustive-deps in useCategoryPage). Все 1157 тестов зелёные. `tsc -b` чистый. Lint: 7 → 5 problems (2 fixed: 1 setState-in-effect + 1 exhaustive-deps; 3 setState-in-effect в pages deferred to Phase 2).

Work Log:
- 1: Клон репо `git clone https://github.com/vudirvp-sketch/poe2-regex-ru.git`. `npm install`. Baseline: `tsc -b` чистый, `vitest run` — 1157 passed, `eslint .` — 7 problems (4 errors + 3 warnings). Совпадает с iter 77 worklog.
- 2: Анализ useCategoryPage.ts (1325 строк):
  - Lines 1-145: imports + types (CategoryPageConfig, FilterStoreApi, CategoryPageState) — KEEP в useCategoryPage.ts
  - Lines 148-224: `getEffectiveRange`, `getEffectiveRangePerSlot` — pure, EXTRACT
  - Lines 226-348: `getPrefixForSlot`, `getSignPrefix` — pure, EXTRACT
  - Lines 350-391: `buildLiteralNode` — pure, EXTRACT
  - Lines 393-445: `pushLiteralsWithFamilyLogic` (exported, used в tests) — pure, EXTRACT + re-export
  - Lines 447-486: `computeSuppressedExcludes` — pure, EXTRACT
  - Lines 488-922: `buildAstFromSelections` (exported, used в tests) — pure, EXTRACT + re-export
  - Lines 924-1006: `applyRuntimeYofication` — pure, EXTRACT
  - Lines 1008-1324: `useCategoryPage` hook (~316 строк) — KEEP
- 3: Создан новый файл `src/ui/hooks/category-ast-utils.ts` (890 строк) со всеми pure helpers. Все функции pure (no React, no side effects). Types imports: `GameToken, ASTNode, Locale, SearchLogic` from `@shared/types`; `TokenRangeOverride, SlotRangeOverride` from `@store/filter-store`. AST constructors: `and, or, exclude, literal, range, multiRange` from `@core/ast`. `applyYofication` from `@strategies/locale`.
- 4: Обновлён `src/ui/hooks/useCategoryPage.ts` (1325 → 486 строк):
  - Removed all pure helpers (lines 148-1006).
  - Added re-export: `export { buildAstFromSelections, pushLiteralsWithFamilyLogic, applyRuntimeYofication } from './category-ast-utils';` (backward compat — tests import these from `@ui/hooks/useCategoryPage`).
  - Added internal import: `import { buildAstFromSelections, applyRuntimeYofication } from './category-ast-utils';`.
  - Removed unused imports: `or, exclude, literal, range, multiRange` from `@core/ast` (only `and` still used inside the hook's useMemo for combining children); `GameToken` from `@shared/types` (no longer referenced); `SlotRangeOverride` from `@store/filter-store` (used only in extracted helpers); `applyYofication` from `@strategies/locale` (used only in extracted `applyRuntimeYofication`).
- 5: Bug #8 lint fix #1 — `react-hooks/set-state-in-effect` at useCategoryPage.ts:1100 (был): 
  - Было: `if (providedData) { setData(providedData); setLoading(false); return; }` — redundant: `useState` initializers (lines 1017-1018) уже set `data = providedData ?? null` и `loading = !providedData`. Effect branch только вызывал cascading renders.
  - Стало: `if (providedData) return;` — early-return без setState. useState initializer handles providedData case correctly. Zero behavior change.
- 6: Bug #8 lint fix #2 — `react-hooks/exhaustive-deps` at useCategoryPage.ts:1022 (был):
  - Было: `const useStore = useMemo(() => createFilterStore(), [categoryId]);` — eslint считал `categoryId` "unnecessary" т.к. factory closure его не ссылает.
  - Стало: added `// eslint-disable-next-line react-hooks/exhaustive-deps` с 4-line explanatory comment: categoryId intentionally в dep array для cache invalidation — каждая category page должна иметь свой filter store, selections/state не должны leak между категориями при client-side routing.
- 7: Bug #13 analysis (deferred):
  - Skip condition at iterative-optimizer.ts:470 (was :488 in original bug report): `if (regex.includes('.*') || regex.includes('[0-9]') || regex.includes('[1-9]'))` skips ALL processing of ranged-regexes (FN/FP detection, optimization strategies, Oracle validation).
  - Comment says "Oracle can't validate them alone" — но Oracle (`oracleValidateChange` at line 155) CAN validate these: it does `hasFN(newRegex, rawText)` + `matchPoE2RegexItem` cross-family FP check, both work with number-pattern regexes.
  - Removing the skip WOULD change ETL output (public/generated/*.json) — это не "1-line fix", требует careful analysis: (1) run ETL with skip removed, (2) diff generated JSONs, (3) verify no regressions in 1157 tests, (4) verify in-game. Deferred to separate iteration.
- 8: Verification:
  - `tsc -b` чистый.
  - `vitest run` — 1157/1157 passed (без изменений от baseline).
  - `eslint .` — **5 problems (3 errors + 2 warnings)** (down from 7):
    - 3 errors `react-hooks/set-state-in-effect` (WaystonePage:66, JewelPage:99, TabletPage:101) — page-level extra-state sync from filterStore. Требуют API change: `useCategoryPage` нужно вызывать BEFORE page's local useState (для lazy init from filterStore), но extraAstNodes зависит от local state → circular dependency. Fix = split hook into 4 sub-hooks (Bug #8 Phase 2).
    - 2 warnings `react-hooks/incompatible-library` (VirtualizedModList.tsx:307, 593) — `useVirtualizer()` returns non-memoizable functions; cannot fix without changing the library.
- 9: Документация:
  - `STATUS.md` — iter → 78, "Открытые долги" updated: Bug #8 → "Phase 1 done iter 78, Phase 2 deferred"; Bug #13 → added analysis notes (не 1-line fix, требует ETL rerun + careful analysis); Lint cleanup → 7→5 problems.
  - `AGENT_NAVIGATION.md` — iter 78 entry, Bug #8 Phase 1 description (1325→486, extracted category-ast-utils.ts, 2 lint fixes). iter 77 сжат до 1 строки.
  - `worklog.md` — iter 78 запись (этот блок), iter 77 сжат до 1 строки.

Stage Summary:
- **iter 78 COMPLETE (Phase 1 of Bug #8).** useCategoryPage.ts: 1325 → 486 строк (63% reduction). Pure helpers extracted to `src/ui/hooks/category-ast-utils.ts` (890 строк). 2 lint issues fixed (1 setState-in-effect + 1 exhaustive-deps). Zero behavior change — all 1157 tests green, `tsc -b` clean.
- **Изменённые файлы (4):**
  - `src/ui/hooks/category-ast-utils.ts` (NEW, 890 строк) — pure AST helpers
  - `src/ui/hooks/useCategoryPage.ts` (1325 → 486 строк) — hook only, re-exports from category-ast-utils
  - `STATUS.md` + `AGENT_NAVIGATION.md` + `worklog.md` (docs)
- **Метрики:** 1157/1157 passed (без изменений). `tsc -b` чистый. Lint: 5 problems (3 errors + 2 warnings, down from 7).
- **Не сделано (намеренно, следующая итерация):**
  - Bug #8 Phase 2: split useCategoryPage hook на 4 hooks (`useCategoryData`/`useRegexBuilder`/`useUrlSync`/`useFilterActions`) + fix 3 setState-in-effect в WaystonePage/JewelPage/TabletPage. Требует API change affecting all 8 category pages.
  - Bug #13 (iterative-optimizer.ts:470 skip condition) — deferred: не 1-line fix, требует ETL rerun + analysis.
  - Bug #16 (IMPLICIT_RANGE_UNRESTRICTED magic number) — низкий приоритет.
  - Bug #17 (negated char class from/to -1 хак) — низкий приоритет.
  - Lint cleanup остаток (5 problems): 3 setState-in-effect (tied to Bug #8 Phase 2), 2 library warnings (unfixable).
- **Точка остановки:** iter 78 done. Bug #8 Phase 1 complete (1325→486 lines, 2 lint fixes). Phase 2 (full hook split + 3 page-level setState-in-effect fixes) — для следующей итерации.

---

## Предыдущие итерации (кратко)

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
