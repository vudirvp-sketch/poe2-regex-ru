# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 158 (MIXED-mode core layer)
Agent: main
Task: Реализовать core layer для UI-режима «MIXED» — расширение AST (MIXED_OR нода), compiler support, builder utility (`buildMixedAstFromSelections`), KI#45/KI#46 mitigations, юнит-тесты. UI-интеграцию отложить на iter 159.

Work Log:
- 1: **План и scope decision:**
  - Изучил STATUS.md (iter 157), AGENT_NAVIGATION.md, существующие AST (`src/shared/types.ts`, `src/core/ast.ts`), compiler (`src/core/compiler.ts`), `category-ast-utils.ts`.
  - Решил добавить **новый `MIXED_OR` тип ноды** вместо расширения OR — семантически distinct (combined AND+OR mode с mitigations), не ломает существующие OR тесты.
  - UI-интеграцию (FilterChip 3-state, optionalIds в filter-store, MIXED toggle в CategoryControlPanel) **отложил на iter 159** — рискует сломать 8 category pages. Согласовано с правилом «лучше недоделать, чем сломать».
- 2: **AST extension** (`src/shared/types.ts` + `src/core/ast.ts`):
  - Добавил `MixedOrOptions` interface с `anchorFirstAltOnly?: boolean` (KI#45 mitigation).
  - Добавил `MIXED_OR` к `ASTNode` union.
  - Добавил builder `mixedOr(children, options?)` в `ast.ts`.
  - Обновил `collectTokenIds` — добавил `MIXED_OR` case.
- 3: **Compiler extension** (`src/core/compiler.ts`):
  - `normalizeAst`: добавил `MIXED_OR` case — переиспользует OR normalization (AND-in-OR transforms iter 49/108) через временный OR node, сохраняет `options`.
  - `compileInner`: добавил `MIXED_OR` case — компилирует как OR (children → `|`-joined), post-process: если `anchorFirstAltOnly=true`, strip'ит leading `^` с non-first альтернатив. Покрывает 3 источника `^`: LITERAL value, RANGE anchorStart, iter 49 transform output.
  - `compile()`: MIXED_OR оборачивается в outer quotes (как OR).
- 4: **Builder utility** (`src/ui/hooks/category-ast-utils.ts`):
  - `truncateMixedOrLiterals(ast, maxLen=12)` — KI#46 mitigation. PURE function, walk'ает AST, находит MIXED_OR, truncate'ит LITERAL children values до `maxLen` chars. Сохраняет tokenId и options. Не трогает RANGE/MULTI_RANGE (нельзя безопасно сократить).
  - `buildMixedAstFromSelections(mustTokens, optTokens, excludedIds, ...)` — main entry. Строит `AND([!BAD?, ...musts, MIXED_OR([...opts], {anchorFirstAltOnly: true})])`. Делегирует MUST/OPT в `buildAstFromSelections` (переиспользует reversed-RANGE логику MUST → T9 reversed работает в OPT).
  - Re-export'ы добавлены в `useCategoryPage.ts`.
- 5: **Юнит-тесты** (43 tests total, все PASS):
  - `tests/core/compiler-mixed.test.ts` — 21 test: MIXED_OR compilation, KI#45 mitigation (strip `^` с non-first LITERAL/RANGE/iter-49-transform), T6 multiple MIXED_OR groups, T9 direct + reversed RANGE, EXCLUDE inside MIXED_OR.
  - `tests/ui/buildMixedAst.test.ts` — 22 test: canonical `"MUST1" "MUST2" "OPT1|OPT2"`, T7 `!BAD` pattern, T6 multiple groups, T9 reversed RANGE, exclude filtering, `truncateMixedOrLiterals` (default maxLen, tokenId preservation, PURE, integration с compile).
- 6: **Fix test expectations** (7 initially failing → 0):
  - Compact decade form: `(27|28|29|30)` → `(2[7-9]|30)` per `number-regex.ts`.
  - `distributeAlternation` (iter 125 Path D): reversed RANGE с alternation → top-level `|` distribution: `pробивает.*[6-9]%|pробивает.*1[0-6]%`.
  - `colonAnchor` requires `!isImplicit` — implicit mods не получают `: ` prefix.
  - String length: `сопротивлений` = 13 chars → truncated to 12 = `сопротивлени`.
- 7: **Verification:**
  - `npx vitest run` — 2278/2278 PASS (было 2235 + 43 новых).
  - `npx tsc -b` — 0 errors.
  - `npx eslint .` — 0 errors (после удаления unused `or` import).
  - `npx vite build` — PASS, main bundle 342 KB (без изменений).
- 8: **Документация:**
  - STATUS.md — переписан чисто: iter 158 как текущее состояние, KI#47 задокументирован (cross-suppression edge case), iter 159 plan с конкретными шагами UI-интеграции.
  - worklog.md — эта запись (старая iter 157 удалена по правилу «только последняя итерация подробно»).

Stage Summary:
- **MIXED-mode core layer ГОТОВ.** AST + compiler + builder + 43 tests. Все проверки PASS.
- **Изменённые файлы:**
  - `src/shared/types.ts` — `MixedOrOptions` interface + `MIXED_OR` AST node type.
  - `src/core/ast.ts` — `mixedOr()` builder + `collectTokenIds` update.
  - `src/core/compiler.ts` — `MIXED_OR` case в `normalizeAst` + `compileInner` + `compile()`.
  - `src/ui/hooks/category-ast-utils.ts` — `buildMixedAstFromSelections()` + `truncateMixedOrLiterals()`.
  - `src/ui/hooks/useCategoryPage.ts` — re-export новых функций.
  - `tests/core/compiler-mixed.test.ts` — 21 new test.
  - `tests/ui/buildMixedAst.test.ts` — 22 new test.
  - `STATUS.md` — переписан.
  - `worklog.md` — эта запись.
- **KI#45 mitigation (core):** `anchorFirstAltOnly: true` в MIXED_OR — compiler strip'ит `^` с non-first alt. Builder включает по умолчанию.
- **KI#46 mitigation (core):** `truncateMixedOrLiterals(ast, maxLen=12)` — caller вызывает при overflow > 240.
- **T9 reversed в OPT:** работает через переиспользование reversed-RANGE логики MUST.
- **Stopping point:** iter 158 завершён. Next iter 159 — UI-интеграция (FilterChip 3-state, optionalIds в filter-store, MIXED toggle в CategoryControlPanel, useCategoryPage wiring, in-game verification).

---
