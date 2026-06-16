# Worklog

---
Task ID: 46
Agent: main
Task: In-game verify `^`-anchor in OR-context (Tests A/B/C из iter 45 плана) и внедрить фикс `^(?!…).*Z` если A+B PASS. Обновить 4 iter 44 tests + добавить 2 NEW backward-exclude tests (minion-блок data). Документация: чисто, без мусора.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: worklog Task 45 (FP analysis с proposed fix), STATUS.md iter 45, docs/IN_GAME_TESTS.md iter 45 FINDING + test plan A/B/C, AGENT_NAVIGATION.md v31 (§9, §11 Pitfall 12/16/22, §12), src/core/compiler.ts normalizeAst (line 141 — целевая строка), tests/core/optimizer.test.ts (iter 44 tests lines 808-884 + regression lines 886-968)
- 2: Пользователь прислал РЕЗУЛЬТАТЫ in-game тестов:
  - **Тест A PASS** (`"^(?!.*Приспеш).*повышение скорости атаки"`): minions НЕ подсвечены, только non-minion блоки с «повышение скорости атаки»
  - **Тест B PASS** (`"^(?!.*Приспеш).*повышение скорости атаки|перезарядки умений"`): результат идентичен A → `^` работает в OR-context (применяется только к первой альтернативе, НЕ leaks ко второй)
  - **Тест C подтверждает root cause** (`"повышение скорости атаки(?!.*Приспеш)|перезарядки умений"`): minion-блоки подсвечены (forward-only lookahead не видит «Приспеш» ДО суффикса)
- 3: Решение: A+B PASS → внедрять фикс `^(?!…).*Z`. Альтернатива (ETL-level detection tokens) НЕ нужна.
- 4: Применён фикс в `src/core/compiler.ts` normalizeAst (AND-in-OR transform):
  - **БЫЛО:** `const mergedValue = `${literalChild.value}${lookaheads}`;` → produced `Z(?!.*A)(?!.*B)` (forward-only)
  - **СТАЛО:** `const mergedValue = `^${lookaheads}.*${literalChild.value}`;` → produces `^(?!.*A)(?!.*B).*Z` (bidirectional)
  - Обновлён docstring блока (iter 44 → iter 46 history + in-game verify note)
- 5: Обновлены 4 iter 44 tests в `tests/core/optimizer.test.ts` (describe block "compile: AND-in-OR with EXCLUDE → anchored lookahead (iter 44 → iter 46)"):
  - Test 1 (OR + EXCLUDE(OR)): добавлены структурные assertions для `^`-prefix, `.*X`-bridge, `|Q`-no-leak
  - Test 2 (OR + EXCLUDE(LITERAL)): assertion `X(?!.*A)` → `^(?!.*A).*X` (exact match)
  - Test 3 (top-level AND): без изменений (item-wide `!A|B|C` формат unchanged)
  - Test 4 (multi-LITERAL AND): без изменений (no transform для этого shape)
- 6: Добавлены 2 NEW backward-exclude tests (minion-блок data):
  - Test A: top-level AND с exclude «Приспеш» — компилируется как `"повышение скорости атаки" "!Приспеш"` (no transform для top-level AND, lock boundary)
  - Test B: OR(AND(LITERAL, EXCLUDE(LITERAL)), LITERAL) с minion data — компилируется exactly в `^(?!.*Приспеш).*повышение скорости атаки|перезарядки умений` (lock iter 46 format)
- 7: End-to-end regression test (lines 886-968) обновлён: добавлены 3 новых assertions (starts with `^`, no `|^` leak, `.*повышение скорости атаки` bridge). Существующие assertions (9 lookaheads, 4 positive literals, length ≤250) остались — все проходят с новым форматом.
- 8: Верификация:
  - `npx vitest run tests/core/optimizer.test.ts` → **72 passed** (70 baseline + 2 NEW iter 46 tests)
  - `npx vitest run` (full suite) → **1108 passed** (1106 baseline + 2 NEW)
  - `npx tsc -b` → **0 errors**
  - Inline verify script: user scenario компилируется exactly в `"^(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми).*повышение скорости атаки|перезарядки умений|передвижения|атаки копьями"` — 195 chars ≤250, starts with `^`, no `|^` leak
- 9: Документация обновлена (5 файлов):
  - `worklog.md` → Task ID 46 (этот), Task 45 сжат в Stage Summary
  - `STATUS.md` → iter 46 — fix IMPLEMENTED + verified, optimal-use audit updated, Known Issues (3 closed, 2 remain)
  - `AGENT_NAVIGATION.md` → v32 (§5 iter 46 added, §9 `^` в OR-context ✅ verified, §9 `(?!…)` ⚠️ forward-only с iter 46 fix ссылкой, §11 Pitfall 12 updated — fix IMPLEMENTED, §11 Pitfall 22 updated — `^` now USED, §12 iter 46 note)
  - `docs/IN_GAME_TESTS.md` → iter 46 VERIFICATION block (Test A/B/C results), dialect table updated (`^` в OR ✅, `(?!…)` ⚠️ forward-only с iter 46 fix), syntax rule 10 updated
  - `README_ITER45.md` → **DELETED** (устаревший архивный файл, заменён worklog + STATUS)
- 10: Финальная верификация после всех updates: `npx vitest run` → 1108 passed; `npx tsc -b` → 0 errors

Stage Summary:
- **iter 46 FIX IMPLEMENTED + IN-GAME VERIFIED:** `compiler.ts` normalizeAst — `Z(?!…)` → `^(?!…).*Z` (bidirectional exclude). One-line change.
- **In-game verify (Tests A+B PASS, C confirms root cause):** `^` works in OR-context (applies only to first alt, no leak). `(?!…)` forward-only semantic confirmed via Test C FP.
- **Tests:** 1108 passed (+2 NEW backward-exclude regression tests for minion-блок data). TypeScript clean.
- **Production regex для user scenario:** `"^(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми).*повышение скорости атаки|перезарядки умений|передвижения|атаки копьями"` (195 chars)
- **Files MODIFIED (4 source/docs + 1 deleted):**
  - `src/core/compiler.ts` — one-line fix + docstring update
  - `tests/core/optimizer.test.ts` — 4 iter 44 tests updated + 2 NEW iter 46 tests added
  - `worklog.md` — Task ID 46
  - `STATUS.md` — iter 46 section
  - `AGENT_NAVIGATION.md` — v32
  - `docs/IN_GAME_TESTS.md` — iter 46 VERIFICATION block
  - `README_ITER45.md` — DELETED (stale archive)
- **Known Issues (после iter 46):**
  - ✅ #1 CLOSED — `(?!…)` forward-only FP FIXED via `^(?!…).*Z`
  - ⚠️ #2 OPEN — Simulator `(?!…)` gap remains (регрессионные тесты structural, не semantic). iter 47 todo.
  - ✅ #3 CLOSED — `^` в OR-context verified in-game (Tests A+B PASS)
  - ⚠️ #4 OPEN — AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE — nested quotes (rare case, Pitfall 11)
  - ⚠️ #5 OPEN — 2 over-limit entries в jewel (ETL diagnostic iter 42)
- **Точка остановки:** iter 46 COMPLETE. Code + tests + docs updated. Возможные следующие шаги:
  1. **iter 47 — Simulator extension** (опционально): добавить `(?!…)` tokenization в `poe2-regex-matcher.ts` + semantic regression test против minion-блок data. Закроет Known Issue #2.
  2. **iter 47 — Production ETL rerun** (опционально): если user wants regenerated JSON с новым форматом — `pnpm etl:fresh`. Не обязательно — compiler fix применяется на лету при компиляции AST.
  3. **iter 47 — Pitfall 11 fix** (low priority): AND-in-OR с multi-LITERAL + EXCLUDE — сейчас даёт nested quotes. Rare case.
- **For new chat:** читать worklog.md (Task ID 46), STATUS.md (iter 46), docs/IN_GAME_TESTS.md (iter 46 VERIFICATION section), AGENT_NAVIGATION.md v32 (§9, §11 Pitfall 12/16/22, §12).

---
Task ID: 45
Agent: main
Task: Анализ FP из iter 44 — `(?!…)` lookahead forward-only. Код НЕ менять.

Stage Summary:
- **ROOT CAUSE identified:** `(?!…)` lookahead в PoE2 forward-only, не видит excludes ДО суффикса в блоке → FP с minion affixes остался после iter 44 fix
- **SIMULATOR GAP identified:** `poe2-regex-matcher.ts` не токенизирует `(?!…)` → iter 44 regression test был structural, не semantic
- **PROPOSED FIX для iter 46:** `^(?!…).*Z` вместо `Z(?!…)` — одна строка в `compiler.ts`. Bidirectional exclude semantic.
- **Код НЕ менялся** — только документация (4 файла)

---

## Older iterations (44 and before)

- **iter 44**: 3 FP-бага исправлены в shared `src/core/` — surgical removeConflictingExcludes + strict-subset skip + AND-in-OR transform. ⚠️ iter 45: FP остался — `(?!…)` forward-only. iter 46 CLOSED.
- **iter 43**: D3 pre-analysis — 95 опасных пар, 5 типов опасностей, 8 паттернов. Код не изменён.
- **iter 42**: ETL char-limit diagnostic — `findOverLimitEntries()`. Все 1094 тестов проходят.
- **iter 41**: D5 production-verified — 5/5 in-game tests PASS (jewel, amulet, ring, waystone, tablet).
- **iter 15-40**: covered legacy in-game tests, hypothesis pattern verification, FP prevention anchors, Path D D1-D7. See git history for details.
