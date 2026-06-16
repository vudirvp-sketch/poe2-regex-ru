# Worklog

---
Task ID: 46
Agent: main
Task: In-game verify `^`-anchor in OR-context (Tests A/B/C) и внедрить фикс `^(?!…).*Z` если A+B PASS. Обновить 4 iter 44 tests + добавить 2 NEW backward-exclude tests (minion-блок data). Документация: чисто, без мусора.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: worklog Task 45 (FP analysis с proposed fix), STATUS.md iter 45, docs/IN_GAME_TESTS.md iter 45 FINDING + test plan A/B/C, AGENT_NAVIGATION.md v31 (§9, §11 Pitfall 12/16/22, §12), src/core/compiler.ts normalizeAst (целевая строка), tests/core/optimizer.test.ts (iter 44 tests + regression lines).
- 2: Пользователь прислал РЕЗУЛЬТАТЫ in-game тестов:
  - **Тест A PASS** (`"^(?!.*Приспеш).*повышение скорости атаки"`): minions НЕ подсвечены, только non-minion блоки.
  - **Тест B PASS** (`"^(?!.*Приспеш).*повышение скорости атаки|перезарядки умений"`): результат идентичен A → `^` работает в OR-context (применяется только к первой альтернативе, НЕ leaks ко второй).
  - **Тест C подтверждает root cause** (`"повышение скорости атаки(?!.*Приспеш)|перезарядки умений"`): minion-блоки подсвечены (forward-only lookahead не видит «Приспеш» ДО суффикса).
- 3: Решение: A+B PASS → внедрять фикс `^(?!…).*Z`. Альтернатива (ETL-level detection tokens) НЕ нужна.
- 4: Применён фикс в `src/core/compiler.ts` normalizeAst (AND-in-OR transform):
  - **БЫЛО:** `const mergedValue = `${literalChild.value}${lookaheads}`;` → produced `Z(?!.*A)(?!.*B)` (forward-only)
  - **СТАЛО:** `const mergedValue = `^${lookaheads}.*${literalChild.value}`;` → produces `^(?!.*A)(?!.*B).*Z` (bidirectional)
  - Обновлён docstring блока.
- 5: Обновлены 4 iter 44 tests в `tests/core/optimizer.test.ts` (describe block "compile: AND-in-OR with EXCLUDE → anchored lookahead"):
  - Test 1 (OR + EXCLUDE(OR)): добавлены структурные assertions для `^`-prefix, `.*X`-bridge, `|Q`-no-leak.
  - Test 2 (OR + EXCLUDE(LITERAL)): assertion `X(?!.*A)` → `^(?!.*A).*X` (exact match).
  - Test 3 (top-level AND): без изменений (item-wide `!A|B|C` формат unchanged).
  - Test 4 (multi-LITERAL AND): без изменений (no transform для этого shape).
- 6: Добавлены 2 NEW backward-exclude tests (minion-блок data):
  - Test A: top-level AND с exclude «Приспеш» — компилируется как `"повышение скорости атаки" "!Приспеш"` (no transform для top-level AND, lock boundary).
  - Test B: OR(AND(LITERAL, EXCLUDE(LITERAL)), LITERAL) с minion data — компилируется exactly в `^(?!.*Приспеш).*повышение скорости атаки|перезарядки умений` (lock iter 46 format).
- 7: End-to-end regression test обновлён: добавлены 3 новых assertions (starts with `^`, no `|^` leak, `.*повышение скорости атаки` bridge). Существующие assertions (9 lookaheads, 4 positive literals, length ≤250) остались — все проходят.
- 8: Верификация:
  - `npx vitest run tests/core/optimizer.test.ts` → **72 passed** (70 baseline + 2 NEW iter 46).
  - `npx vitest run` (full suite) → **1108 passed** (1106 baseline + 2 NEW).
  - `npx tsc -b` → **0 errors**.
  - Inline verify script: user scenario компилируется exactly в `"^(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми).*повышение скорости атаки|перезарядки умений|передвижения|атаки копьями"` — 195 chars ≤250, starts with `^`, no `|^` leak.

Stage Summary:
- **iter 46 FIX IMPLEMENTED + IN-GAME VERIFIED:** `compiler.ts` normalizeAst — `Z(?!…)` → `^(?!…).*Z` (bidirectional exclude). One-line change.
- **In-game verify (Tests A+B PASS, C confirms root cause):** `^` works in OR-context (applies only to first alt, no leak). `(?!…)` forward-only semantic confirmed via Test C FP.
- **Tests:** 1108 passed (+2 NEW backward-exclude regression tests for minion-блок data). TypeScript clean.
- **Production regex для user scenario:** `"^(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми).*повышение скорости атаки|перезарядки умений|передвижения|атаки копьями"` (195 chars).
- **Files MODIFIED (5 source/docs + 1 deleted):**
  - `src/core/compiler.ts` — one-line fix + docstring update.
  - `tests/core/optimizer.test.ts` — 4 iter 44 tests updated + 2 NEW iter 46 tests added.
  - `worklog.md` — Task ID 46.
  - `STATUS.md` — iter 46 section.
  - `AGENT_NAVIGATION.md` — v32.
  - `docs/IN_GAME_TESTS.md` — iter 46 VERIFICATION block.
  - `docs/ARCHITECTURE.md` — §3 Path D history iter 46 note + dialect table updated.
- **Known Issues (после iter 46):**
  - ✅ #1 CLOSED — `(?!…)` forward-only FP FIXED via `^(?!…).*Z`.
  - ⚠️ #2 OPEN — Simulator `(?!…)` gap remains (регрессионные тесты structural, не semantic). iter 47 todo.
  - ✅ #3 CLOSED — `^` в OR-context verified in-game (Tests A+B PASS).
  - ⚠️ #4 OPEN — AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE — nested quotes (rare case).
  - ⚠️ #5 OPEN — 2 over-limit entries в jewel (ETL diagnostic only).
- **Точка остановки:** iter 46 COMPLETE. Code + tests + docs updated.
- **For new chat:** читать `AGENT_NAVIGATION.md` (entry), `STATUS.md` (current state + Known Issues), `worklog.md` (Task ID 46 для деталей фикса).

---
Task ID: 47 (CURRENT)
Agent: main
Task: Анализ репозитория + актуализация/чистка документации под LLM/agent consumption. Никаких правок кода — только docs cleanup.

Work Log:
- 1: Клонирован репозиторий, прочитаны все ключевые docs (AGENT_NAVIGATION v32, STATUS iter 46, worklog Task 46, docs/IN_GAME_TESTS, docs/ARCHITECTURE, docs/DATA_CONTRACTS, docs/ETL_GUIDE, docs/SEO_PLAN, README, README_ITER46, DELETIONS.txt). Также осмотрены: src/core/ (compiler.ts normalizeAst — фикс iter 46 на месте), регис/ (user test data — leave as-is).
- 2: Идентифицирован мусор:
  - `README_ITER46.md` — iteration-specific archive (заменён worklog + STATUS).
  - `DELETIONS.txt` — однострочная заметка, не нужна.
  - Дублирование dialect rules между AGENT_NAVIGATION §9 и ARCHITECTURE §3.
  - Длинные iter-by-iter narratives в AGENT_NAVIGATION §5/§9/§11/§12.
  - Старые iter blocks (37-45) в IN_GAME_TESTS.md.
  - Iter 45 section в STATUS.md (уже закрыт).
- 3: Удалены файлы: `README_ITER46.md`, `DELETIONS.txt`.
- 4: Перезаписан `AGENT_NAVIGATION.md` — компактная reference-структура без iter-history clutter: §1 Where things are, §2 Path aliases, §3 Dependency rules, §4 Build & Run, §5 Core optimizer (compact), §6 Dialect (current state only), §7 FP Prevention, §8 Frequent Pitfalls (key bugs only), §9 Strategy (8 principles), §10 Pre-rendering, §11 SEO assets, §12 i18n, §13 Doc map. ~155 lines (was 235).
- 5: Перезаписан `STATUS.md` — iter 46 fix + Known Issues + optimal strategies + Path D status. ~85 lines (was 124).
- 6: Compact `worklog.md` — Task 46 detailed (preserve), Task 45+ → one-line summaries.
- 7: Compact `docs/IN_GAME_TESTS.md` — keep iter 46 VERIFICATION + dialect table + FP Prevention Anchors + 9 Pattern Types + Truncated Word Tails; fold iter 37-41 history into one-line summary at bottom.
- 8: Compact `docs/ARCHITECTURE.md` — remove iter-history notes, dedupe dialect rules with AGENT_NAVIGATION (keep architecture-specific info: layer diagram, data flow, FP prevention levels, compiler rules, optimization pipeline, iterative optimizer, positive+negative mods, 250-char budget, number regex).
- 9: Light cleanup of `docs/ETL_GUIDE.md` and `docs/DATA_CONTRACTS.md` — remove iter mentions where they're informational only.
- 10: Упаковать результат в архив, загрузить на tmpfiles.org, прислать git-команды + точку остановки.

Stage Summary:
- **Документация актуализирована под LLM/agent consumption.** Никаких правок кода — только docs cleanup.
- **Удалены:** `README_ITER46.md` (iteration-specific archive), `DELETIONS.txt` (single-line note).
- **Перезаписаны/компактно:**
  - `AGENT_NAVIGATION.md` — 235 → 191 lines (–19%). Reference-style, current-state only, no iter-history clutter.
  - `STATUS.md` — 124 → 84 lines (–32%). Only current iter 46 fix + Known Issues + optimal strategies.
  - `worklog.md` — Task 46 detailed preserved, Task 45+ folded into one-line summaries. Task 47 entry added (this).
  - `docs/IN_GAME_TESTS.md` — 257 → 147 lines (–43%). Keep iter 46 verification + dialect table + FP Prevention Anchors + 9 Pattern Types + Truncated Word Tails. Old iter 37-41 blocks folded into one-line summary.
  - `docs/ARCHITECTURE.md` — 553 → 394 lines (–29%). Removed iter-history notes, dedupe dialect rules with AGENT_NAVIGATION.
  - `docs/ETL_GUIDE.md` — minor cleanup (removed iter numbers where informational only).
- **Total docs reduction:** 1961 → 1568 lines (–20%).
- **Verification:** `pnpm test` → 1108 passed. `pnpm exec tsc -b` → 0 errors. No source code touched.
- **Files MODIFIED (6 docs) + DELETED (2):** See Work Log step 4-9 above.
- **Точка остановки:** iter 47 (docs cleanup) COMPLETE. Готов к следующей итерации: фиксы Known Issues #2, #4, #5.
- **For new chat:** читать `AGENT_NAVIGATION.md` (entry, ~191 lines), `STATUS.md` (current state + Known Issues, ~84 lines), `worklog.md` (Task 47 для деталей cleanup + Task 46 для деталей последнего code-фикса).

---
## Older iterations (45 and before)

- **iter 45**: ROOT CAUSE analysis — `(?!…)` lookahead forward-only в PoE2, simulator gap. Код НЕ менялся — только документация. Proposed fix `^(?!…).*Z` → implemented in iter 46.
- **iter 44**: 3 FP-бага исправлены в shared `src/core/` — surgical removeConflictingExcludes + strict-subset skip + AND-in-OR transform (`X(?!…)` forward-only, refined in iter 46).
- **iter 43**: D3 pre-analysis — 95 опасных пар, 5 типов опасностей, 8 паттернов. Код не изменён.
- **iter 42**: ETL char-limit diagnostic — `findOverLimitEntries()`.
- **iter 41**: D5 production-verified — 5/5 in-game tests PASS (jewel, amulet, ring, waystone, tablet).
- **iter 15-40**: covered legacy in-game tests, hypothesis pattern verification, FP prevention anchors, Path D D1-D7. See git history for details.
