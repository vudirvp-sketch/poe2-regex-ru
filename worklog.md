# Worklog

---
Task ID: 44
Agent: main
Task: Fix user-reported FP in jewel selection. User selected 4 affixes in OR mode — generator produced regex with FP (matched «повышение скорости атаки луками», «...самострелами», «накопления шкалы заморозки боевыми посохами», «перезарядки самострела», «перезарядки боевых кличей»). Analyze, plan, implement minimal fixes, update docs.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: STATUS.md (iter 43 pre-analysis), worklog Task IDs 42-43, AGENT_NAVIGATION.md v29, docs/IN_GAME_TESTS.md, docs/ARCHITECTURE.md §3
- 2: Проанализированы 4 выбранных пользователем токена в `public/generated/jewel.json`:
  - jewel.mod_am4lla (повышение скорости атаки, 10 regexExclude values)
  - jewel.mod_26n6rw (атаки копьями, no excludes)
  - jewel.mod_sbryhz (передвижения, no excludes)
  - jewel.mod_kcvuf (перезарядки умений, no excludes)
- 3: Найден opt-entry `jewel.mod_atixoo:jewel.mod_kcvuf:jewel.mod_sbryhz:jewel.mod_vr3sas` (4 IDs, regex с top-level `|`) — пользователь выбрал только 2 из 4 IDs
- 4: Воспроизведён баг в unit-тесте `tests/_debug/repro-user-bug.test.ts` (временный, удалён после фиксов): TP=4, FP=5, FN=0 — баг подтверждён
- 5: Идентифицированы 3 compaund-бага:
  - Bug 1: `removeConflictingExcludes` удаляет ВЕСЬ EXCLUDE если хотя бы один литерал конфликтует (должен удалять только конфликтующие)
  - Bug 2: `applyOptimizationTable` применяет полный regex opt-entry при strict subset (должен скипать)
  - Bug 3: `compiler.ts` порождает nested quotes когда AND внутри OR (PoE2 strip-ит inner quotes → exclude-паттерны становятся позитивными альтернативами)
- 6: Реализован **Fix Bug 1** в `src/core/core-optimizations.ts`:
  - Добавлены `findConflictingExcludeValues` (возвращает LIST конфликтующих значений) и `removeExcludeValues` (surgical removal из EXCLUDE's OR)
  - `removeConflictingExcludes` переписана: собирает конфликтующие values, удаляет только их, сохраняет остальные
  - Если OR становится пустым → удаляет EXCLUDE; если остаётся 1 literal → unwraps OR to LITERAL
- 7: Реализован **Fix Bug 2** в `src/core/optimization-strategies.ts`:
  - В `applyOptimizationTable` добавлена проверка: если `matchedIds.size < entry.ids.length` И regex имеет top-level `|` (через `hasTopLevelAlternation`) — skip opt-entry
  - Для family-based entries (без `|` в regex) — поведение не меняется (Phase 1 dedup даёт тот же single-LITERAL)
- 8: Реализован **Fix Bug 3** в `src/core/compiler.ts`:
  - В `normalizeAst` добавлен transform для case `OR → AND(LITERAL, EXCLUDE(LITERAL|OR(LITERAL,...)))`:
    - Заменяет AND на single LITERAL со значением `X(?!.*A)(?!.*B)(?!.*C)...` (per-block lookahead)
    - Только для AND с exactly 1 LITERAL + 1 EXCLUDE (консервативно)
    - Multi-LITERAL AND (с regexPrefixContext) — не трансформируется (rare case, Pitfall 11 updated)
- 9: Добавлены 12 новых unit-тестов в `tests/core/optimizer.test.ts`:
  - 4 теста для surgical `removeConflictingExcludes` (keep all, remove 1 of N, remove all, unwrap OR to LITERAL)
  - 3 теста для strict-subset skip opt-entry (skip on subset, apply on exact match, allow subset for no-`|` entries)
  - 4 теста для compiler AND-in-OR transform (multi-literal exclude, single-literal exclude, top-level AND unchanged, multi-LITERAL AND unchanged)
  - 1 end-to-end regression тест для user-reported jewel scenario (full AST + opt-table, verify all 3 fixes work together)
- 10: Все 1106 тестов проходят (1094 + 12 новых, +0 regressions)
- 11: TypeScript компилируется (`tsc -b`) — 0 ошибок
- 12: ETL regenerирован (`npx tsx scripts/run-etl.ts`) — без изменений метрик (FN=0 для всех 10 категорий), только timestamp updated
- 13: Воспроизведённый test удалён (`tests/_debug/` очищен)
- 14: Обновлена документация (чисто, без мусора):
  - STATUS.md → iter 44, 3 fixes описаны, Known Issues обновлены (Bug 1+3 closed, Bug 2 closed, Pitfall 11 partially fixed)
  - AGENT_NAVIGATION.md → v30, §5 iter 44 added, Pitfall 11/12/14/20/21 updated, §12 Principle 8 updated, iter 44 summary block added
  - docs/ARCHITECTURE.md → iter 44 row added в §3 Path D history
  - worklog.md → Task ID 44 (этот), Task IDs 42-43 сжаты в Stage Summary

Stage Summary:
- **3 FP-бага исправлены** в shared `src/core/` — все категории выигрывают (jewel, amulet, ring, belt, waystone, tablet, relic)
- **TP=4, FP=0, FN=0, TN=6** в reproduction test (раньше TP=4, FP=5, FN=0, TN=1)
- **Все 1106 тестов проходят** (1094 + 12 новых), TypeScript компилируется
- **ETL unchanged** — FN=0 для всех категорий, только timestamp updated
- **Files MODIFIED**:
  - `src/core/core-optimizations.ts` (+90 строк: surgical removeConflictingExcludes + helpers)
  - `src/core/optimization-strategies.ts` (+15 строк: strict-subset skip)
  - `src/core/compiler.ts` (+50 строк: AND-in-OR transform в normalizeAst)
  - `tests/core/optimizer.test.ts` (+270 строк: 12 новых тестов)
  - DOCS: STATUS.md, AGENT_NAVIGATION.md, docs/ARCHITECTURE.md, worklog.md
  - REGENERATED: all 10 `public/generated/*.json` (только timestamp)
- **Точка остановки:** iter 44 FP-fixes COMPLETE. Возможные следующие шаги (опциональные, не блокирующие):
  1. **In-game verify** per-block `(?!…)` semantic в OR-context (фикс Bug 3 использует semantic change — нужен живой тест)
  2. **Pitfall 11 extended**: AND с regexPrefixContext + LITERAL + EXCLUDE всё ещё порождает nested quotes (rare case, не user-bug)
  3. **D3 regexExclude усечённые основы** (iter 43 pre-analysis) — отдельная задача, не связана с iter 44
  4. **Char-limit auto-split** для 2 over-limit jewel entries

---
Task ID: 43
Agent: main
Task: D3 pre-analysis — анализ паттернов аффиксов и правил усечения основ для regexExclude. Без изменения кода.

Stage Summary:
- **D3 pre-analysis COMPLETE** — 95 опасных пар, 5 типов опасностей, 8 паттернов аффиксов, план реализации
- **Код НЕ изменён** — только анализ и документация
- **Точка остановки:** D3 pre-analysis DONE. iter 44 closed связанный FP через compiler/optimizer fixes — D3 теперь опционален.

---
Task ID: 42
Agent: main
Task: ETL char-limit diagnostic (D7) — `findOverLimitEntries()` + Phase D1 + final summary, diagnostic-only policy.

Stage Summary:
- **Реализован ETL char-limit diagnostic** — entries НЕ удаляются, только логируются
- **Все 1094 тестов проходят**, ETL verified end-to-end (2 over-limit entries в jewel: 317, 260 chars)

---

## Older iterations (41 and before)

Iterations 15-41 covered: legacy in-game tests (Tests 15-17 BROKEN), hypothesis pattern verification, FP prevention anchors (5 levels), 9 pattern types, truncated word tails, Path D (D1-D7: in-game test → ETL → runtime → production-verify → char-limit diagnostic). Results consolidated in `docs/IN_GAME_TESTS.md` reference tables. See git history for detailed work logs of these iterations.
