# Worklog

---
Task ID: 42
Agent: main
Task: ETL char-limit diagnostic — добавить diagnostic для opt-table entries >250 chars (PoE2 hard limit, обнаружен в iter 41). Реализовать как diagnostic-only (warning log), не drop/split.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: STATUS.md (iter 41, Path D COMPLETE), worklog Task ID 41 (D5 verified, code unchanged), AGENT_NAVIGATION.md v28, docs/ARCHITECTURE.md v59
- 2: Проанализированы ETL-файлы: `path-d-transform.ts` (307 строк), `compute-optimizations.ts` Phase D (iter 40), `iterative-optimizer.ts` (965 строк, уже имеет `POE2_REGEX_LIMIT = 250` константу, но unused)
- 3: Анализ текущего состояния opt-table — только 2 entries >250 chars (оба в jewel: 317, 260 chars; оба с 11 alts). Code base уже в хорошем состоянии, поэтому constraint = diagnostic-only (не drop, не split). Это безопасно и точно соответствует запросу user.
- 4: Реализация — добавлены в `scripts/etl/path-d-transform.ts`:
  - `POE2_REGEX_CHAR_LIMIT = 250` — каноническая константа (single source of truth)
  - `findOverLimitEntries(table, locale?, limit?)` — generic helper с TypeScript generic, возвращает `{key, regex, length}[]` отсортированный по длине desc, не модифицирует table
  - Обновлён header docstring с упоминанием POE2 CHAR LIMIT
- 5: Phase D1 в `compute-optimizations.ts` (после Phase D Path D transform) — логирует WARNING со списком over-limit entries (length, key preview, regex preview)
- 6: Final summary diagnostic в `iterative-optimizer.ts` — после всех iterations + reoptimizeTable, сканирует финальные таблицы и выводит per-category over-limit entries + общее предупреждение
- 7: Добавлены 10 unit-тестов для `findOverLimitEntries` в `tests/etl/path-d-transform.test.ts` (всего 45 тестов в файле): empty table, all-within-limit, single over-limit, multi-sorting, custom limit, locale parameter, missing/empty regex, boundary check (exactly at limit), real-world Path D output, no-mutation
- 8: Установлены dependencies через `corepack pnpm install --frozen-lockfile` (corepack prepare pnpm@11.5.2 --activate)
- 9: TypeScript компилируется (`tsc -b`) — 0 ошибок
- 10: Тесты проходят — 1094/1094 (1084 + 10 новых), 35 test files
- 11: ETL verified end-to-end (`pnpm etl` с кэшем):
  - Phase D1 warning появляется для jewel категории: "Phase D1: WARNING — 2 opt-table entries exceed 250 chars (PoE2 hard limit):" с length (317, 260), key preview, regex preview
  - Final summary выводит: "⚠  2 opt-table entries exceed PoE2 char limit (250). These entries are kept in the table (useful for subset selection) but cannot be used as a single in-game regex when ALL their ids are selected."
  - 0 entries удалено — JSON output содержит те же данные, только timestamp updated
- 12: Обновлена документация (чисто, без мусора):
  - STATUS.md → iter 42, ETL char-limit diagnostic, D7 добавлен в план реализации, метрики (529 entries, 327 Path D, 2 over-limit), таблица ограничений PoE2 обновлена
  - AGENT_NAVIGATION.md → v29, §5 обновлён (327/529, diagnostic), §9 char-limit row обновлён, Pitfall 14 обновлён, Pitfall 18 обновлён (diagnostic iter 42), §12 Principle 8 обновлён
  - docs/ARCHITECTURE.md → v60, §3 Path D history iter 42 добавлен, §3.1 Principle 8 обновлён (327/529, char-limit diagnostic)
  - docs/ETL_GUIDE.md → v15, §1 pipeline overview обновлён (Phases A→A1→B→C→D→D1), добавлена новая секция §12 "Path D + Char-Limit Diagnostic (Step 4, Phase D + D1)" с детальным описанием, §13→§14 (renumbered)
  - worklog.md → Task ID 42 (этот), Task ID 41 сохранён

Stage Summary:
- **Реализован ETL char-limit diagnostic (D7)** — `findOverLimitEntries()` + Phase D1 в `compute-optimizations.ts` + final summary в `iterative-optimizer.ts`
- **Policy: diagnostic-only** — entries НЕ удаляются и НЕ модифицируются, только логируются. Безопасно, ничего не ломает.
- **Все 1094 тестов проходят** (1084 + 10 новых), TypeScript компилируется
- **ETL verified end-to-end** — Phase D1 warning появляется для jewel (2 entries: 317, 260 chars), final summary корректно показывает общий счётчик
- **Files: MODIFIED** `scripts/etl/path-d-transform.ts` (+58 строк: helper + constant), `scripts/etl/compute-optimizations.ts` (+20 строк: Phase D1), `scripts/etl/iterative-optimizer.ts` (+25 строк: final summary diagnostic), `tests/etl/path-d-transform.test.ts` (+100 строк: 10 unit-тестов); DOCS `STATUS.md`, `AGENT_NAVIGATION.md`, `docs/ARCHITECTURE.md`, `docs/ETL_GUIDE.md`, `worklog.md`; REGENERATED all 10 `public/generated/*.json` (только timestamp изменения, данные те же)
- **Точка остановки:** ETL char-limit diagnostic COMPLETE. Возможные следующие шаги (опциональные, не блокирующие):
  1. **D3** — regexExclude с усечёнными основами (отдельная задача, не связана с Path D)
  2. **Char-limit auto-split** — если over-limit entries становятся проблемой, можно добавить logic для автоматического разбиения на 2+ меньших entries (complex, отдельная задача)
  3. **Финальная полировка** — UI/UX, edge cases

---
Task ID: 41
Agent: main
Task: D5 — In-game верификация Path D на production ETL output. 5 функциональных тестов (D5-1..D5-5) на 16 предметах из тестового файла. Анализ результатов, обновление документации.

Stage Summary:
- **D5 VERIFIED** — Path D production-verified на 5 категориях (jewel, amulet, ring, waystone, tablet), 5/5 in-game тестов PASS
- **Ключевые выводы:** Same-block AND confirmed; Path D работает на 6-9 alts; Cross-category FP — expected behavior; PoE2 regex char limit ≈250 chars (NEW finding для ETL, реализовано в iter 42)
- **Код НЕ изменён** (только документация)
- **Path D = COMPLETE** (D1+D2+D4+D5+D6 all DONE)

---
Task ID: 40
Agent: main
Task: D2+D4 — реализовать Path D в ETL compute-optimizations.ts + iterative-optimizer.ts; проверить runtime совместимость с optimization-strategies.ts

Stage Summary:
- **D2+D4 DONE** — Path D реализован в ETL + runtime
- 303/481 opt-table entries в Path D формате, 0 broken
- Все 1084 тестов проходят
- Files: NEW `scripts/etl/path-d-transform.ts` + `tests/etl/path-d-transform.test.ts`; MODIFIED `compute-optimizations.ts`, `iterative-optimizer.ts`, `optimization-strategies.ts`, `tests/core/optimizer.test.ts`, `tests/etl/compute-optimizations.test.ts`; REGENERATED all 10 `public/generated/*.json`

---
Task ID: 39
Agent: main
Task: D1 — In-game тест Path D на 3+ альтернативах + AND combination

Stage Summary:
- **D1 VERIFIED** — Path D работает на 2/3/4 альтернативах + AND-комбинация
- Код не изменён (только документация)

---
Task ID: 38
Agent: main
Task: Зафиксировать выводы iter 37 — B0 RESOLVED, D7-3 CONFIRMED WORKING, Path D как новая стратегия

Stage Summary:
- **B0 CONFIRMED BROKEN** — `"X"|"Y"` (OR между quoted groups) даёт ZERO matches в игре. Path A невозможен.
- **D7-3 CONFIRMED WORKING** — `"X.*A|X.*B"` (top-level `|` в одном quoted group с `.*`) работает. Game patched со времён iter 15-17.
- **Path D — новая стратегия** для same-family OR

---
Task ID: 37
Agent: main
Task: Тесты 4 самоцветов + детерминированная стратегия регексов (8 принципов, без изменения кода)

Stage Summary:
- Сформулирована детерминированная стратегия — 8 принципов для всех категорий
- 60 unit-тестов для 4 самоцветов, все проходят
- 3 B0-теста PENDING для in-game verification

---

## Older iterations (36 and before)

Iterations 15-36 covered: legacy in-game tests (Tests 15-17 BROKEN behavior), hypothesis pattern verification, FP prevention anchors (5 levels), 9 pattern types, truncated word tails. Results are consolidated in `docs/IN_GAME_TESTS.md` reference tables. See git history for detailed work logs of these iterations.
