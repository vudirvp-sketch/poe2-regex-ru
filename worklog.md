# Worklog

---
Task ID: 45
Agent: main
Task: Анализ FP из iter 44 — пользователь in-game проверил regex и обнаружил, что «Приспешники имеют повышение скорости атаки и сотворения чар» всё ещё матчится (FP). Проанализировать root cause, предложить оптимальный фикс, обновить документацию. Код НЕ менять (принцип «лучше недоделать, чем сломать») — фикс требует in-game verify перед внедрением.

Work Log:
- 1: Клонирован репозиторий, прочитан контекст: STATUS.md (iter 44), worklog Task 44, AGENT_NAVIGATION.md v30, docs/IN_GAME_TESTS.md, src/core/compiler.ts, src/core/core-optimizations.ts, src/core/optimization-strategies.ts, src/core/poe2-regex-matcher.ts, public/generated/jewel.json (4 user-selected tokens), tests/core/optimizer.test.ts (iter 44 regression lines 888-968)
- 2: Идентифицирован ROOT CAUSE — `(?!…)` lookahead в PoE2 FORWARD-ONLY:
  - Проверяет текст только ВПЕРЁД от текущей позиции (после matched-суффикса)
  - В блоке «Приспешники имеют … повышение скорости атаки и сотворения чар» слово «Приспеш» стоит ДО суффикса
  - Lookahead `повышение скорости атаки(?!.*Приспеш)` проверяет только остаток « и сотворения чар» — там «Приспеш» нет → lookahead проходит → FP
  - Lookbehind `(?<!…)` НЕ поддерживается в PoE2 (см. §9 AGENT_NAVIGATION.md)
- 3: Найден SIMULATOR GAP — `poe2-regex-matcher.ts` НЕ токенизирует `(?!…)` вообще:
  - Grep по файлу: 0 matches для `lookahead`, `negative`, `\(\?!`, `\(\?`
  - Токен `?` обрабатывается как `optional` quantifier
  - `(?!…)` токенизируется как `(` `?` `!` `…` `)` — не работает как lookahead
  - Следствие: iter 44 regression test (lines 888-968 optimizer.test.ts) проверял STRUCTURE строки (contains `(?!.*A)`, no nested quotes, length ≤250), а НЕ SEMANTIC behavior
- 4: Проанализирован пользовательский вопрос про «медвежью услугу»:
  - Iter 44 заменил item-wide `!` (корректный, но порождает nested quotes в OR-context) на per-block `(?!…)` (избегает nested quotes, но forward-only)
  - Это trade-off, который ломается именно на кейсе пользователя (exclude ДО суффикса)
  - Пользователь прав — iter 44 fix неполный
- 5: Предложен ФИКС для iter 46 (НЕ внедрён в этой итерации):
  - Одна строка в `src/core/compiler.ts` normalizeAst AND-in-OR transform:
    - БЫЛО: `const mergedValue = `${literalChild.value}${lookaheads}`;`
    - СТАЛО: `const mergedValue = `^${lookaheads}.*${literalChild.value}`;`
  - Результат: `^(?!.*A)(?!.*B).*Z` вместо `Z(?!.*A)(?!.*B)`
  - `^` анкер ставит курсор в начало блока, `.*` внутри lookahead покрывает ВЕСЬ блок (до и после позиции суффикса) → bidirectional exclude
  - Длина: +3 chars per LITERAL (192 → 195 chars для user case, ≤250 OK)
- 6: Аудит использования in-game verified паттернов:
  - Path D — используется оптимально ✅
  - `.*` — используется оптимально ✅
  - `\|` top-level — используется оптимально ✅
  - `^` — верифицирован Phase 9b, но используется ТОЛЬКО для RANGE, НЕ для LITERAL с excludes ⚠️ — главная упущенная возможность
  - `!` item-wide — используется для top-level AND ✅
  - `(?!…)` — используется в iter 44, но forward-only → FP ❌
  - Number enumeration, truncated stems, subset-skip — используются оптимально ✅
- 7: Решено НЕ менять код в этой итерации:
  - Пользователь явно просил АНАЛИЗ, не фикс: «Пропиши текстом в чат выводы, мысли и прочее»
  - Принцип «лучше недоделать, чем сломать»
  - Фикс `^(?!…).*Z` требует in-game verify, что `^` работает внутри `|`-группы (в docs не подтверждено — Phase 9b verified только single-quoted `"^28%"`)
  - Без verify смена выхода compiler может сломать частично-рабочий iter 44 fix
- 8: Документация обновлена (4 файла):
  - STATUS.md → iter 45 analysis section, root cause, proposed fix, optimal-use audit table, Known Issues updated (5 issues, prioritized)
  - AGENT_NAVIGATION.md → v31, §5 iter 45 added, §9 `(?!…)` помечен как forward-only, §9 `^` в OR-context помечен UNVERIFIED, §11 Pitfall 12 REWRITTEN (forward-only semantic + iter 46 proposed fix), §11 Pitfall 16 EXPANDED (simulator gap), §11 Pitfall 22 ADDED (`^`-anchor underused), §12 iter 45 note added
  - docs/IN_GAME_TESTS.md → iter 45 FINDING block + in-game test plan for iter 46 verification (3 tests: A/B/C), dialect table updated (`(?!…)` ⚠️ forward-only, `^` in OR ⚠️ UNVERIFIED), syntax rule 10 added
  - worklog.md → Task ID 45 (этот), Task 44 сжат в Stage Summary
- 9: Базовая верификация:
  - `pnpm test` → 1106 passed (без изменений, код не трогался)
  - `npx tsc -b` → 0 errors (без изменений)

Stage Summary:
- **ROOT CAUSE identified:** `(?!…)` lookahead в PoE2 forward-only, не видит excludes ДО суффикса в блоке → FP с minion affixes остался
- **SIMULATOR GAP identified:** `poe2-regex-matcher.ts` не токенизирует `(?!…)` → iter 44 regression test был structural, не semantic
- **PROPOSED FIX для iter 46:** `^(?!…).*Z` вместо `Z(?!…)` — одна строка в `compiler.ts`. +3 chars per LITERAL. Bidirectional exclude semantic.
- **Код НЕ менялся** — только документация (4 файла)
- **Files MODIFIED (docs only)**:
  - STATUS.md — iter 45 section, root cause, proposed fix, optimal-use audit, Known Issues
  - AGENT_NAVIGATION.md — v31, §5/§9/§11 (Pitfall 12 rewritten, Pitfall 22 added)/§12 updates
  - docs/IN_GAME_TESTS.md — iter 45 FINDING block + iter 46 in-game test plan
  - worklog.md — Task ID 45 + сжатый Task 44
- **Точка остановки:** iter 45 ANALYSIS COMPLETE. Код не тронут. Возможные следующие шаги:
  1. **iter 46 — In-game verify `^` в OR-context** (по тест-плану в docs/IN_GAME_TESTS.md iter 45 section):
     - Тест A: `"^(?!.*Приспеш).*повышение скорости атаки"` (single-quoted, baseline)
     - Тест B: `"^(?!.*Приспеш).*повышение скорости атаки|перезарядки умений"` (OR-context, ключевой)
     - Тест C: `"повышение скорости атаки(?!.*Приспеш)|перезарядки умений"` (старый формат, должен давать FP — control)
  2. **iter 46 — Внедрить фикс** если Тест A+B PASS:
     - `src/core/compiler.ts` normalizeAst — одна строка
     - `tests/core/optimizer.test.ts` — обновить 4 iter 44 tests (новый формат `^(?!…).*Z`)
     - Добавить 2 NEW tests для backward-exclude case (minion-блок data)
  3. **iter 47 — Simulator extension** (опционально): добавить `(?!…)` tokenization в `poe2-regex-matcher.ts` + semantic regression test
- **For new chat:** читать worklog.md (Task ID 45), STATUS.md (iter 45), docs/IN_GAME_TESTS.md (iter 45 FINDING section с test plan для iter 46).

---
Task ID: 44
Agent: main
Task: Fix user-reported FP in jewel selection. 3 compaund bugs found & fixed in shared `src/core/`.

Stage Summary:
- **3 FP-бага исправлены** в shared `src/core/` — surgical removeConflictingExcludes + strict-subset skip + AND-in-OR transform
- **TP=4, FP=0, FN=0, TN=6** в structural regression test (⚠️ iter 45: симулятор не моделирует `(?!…)` → test был structural, не semantic)
- **Все 1106 тестов проходят**, TypeScript компилируется
- **Files MODIFIED**: src/core/{core-optimizations,optimization-strategies,compiler}.ts, tests/core/optimizer.test.ts, 4 doc files, 10 regenerated JSON
- **iter 45 ADDENDUM:** FP остался в production — `(?!…)` forward-only. См. Task 45.

---

## Older iterations (43 and before)

- **iter 43**: D3 pre-analysis — 95 опасных пар, 5 типов опасностей, 8 паттернов. Код не изменён.
- **iter 42**: ETL char-limit diagnostic — `findOverLimitEntries()`. Все 1094 тестов проходят.
- **iter 41**: D5 production-verified — 5/5 in-game tests PASS (jewel, amulet, ring, waystone, tablet).
- **iter 15-40**: covered legacy in-game tests, hypothesis pattern verification, FP prevention anchors, Path D D1-D7. See git history for details.
