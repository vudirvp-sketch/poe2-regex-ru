# PoE2 Regex RU — Iter 42 Archive (ETL char-limit diagnostic)

## What's inside

Этот архив содержит **только изменённые файлы** для слияния с локальной директорией.
Сохранена структура папок для прямого merge.

## Changed files (19 total)

### Code (4 files)
- `scripts/etl/path-d-transform.ts` — добавлены `POE2_REGEX_CHAR_LIMIT = 250` константа + `findOverLimitEntries()` helper
- `scripts/etl/compute-optimizations.ts` — добавлен Phase D1 (char-limit diagnostic после Phase D)
- `scripts/etl/iterative-optimizer.ts` — добавлен final summary diagnostic (после всех iterations + reoptimizeTable)
- `tests/etl/path-d-transform.test.ts` — добавлено 10 unit-тестов для `findOverLimitEntries`

### Documentation (5 files)
- `STATUS.md` → iter 42, ETL char-limit diagnostic, D7 в плане, метрики
- `AGENT_NAVIGATION.md` → v29, §5 обновлён, §9 char-limit row обновлён, Pitfall 14/18 обновлён, §12 Principle 8 обновлён
- `docs/ARCHITECTURE.md` → v60, §3 Path D history iter 42, §3.1 Principle 8 обновлён
- `docs/ETL_GUIDE.md` → v15, §1 pipeline Phases A→A1→B→C→D→D1, новая §12 "Path D + Char-Limit Diagnostic", §13→§14
- `worklog.md` → Task ID 42 + сжатые summary 37-41

### Generated data (10 files) — только timestamp обновлён
- `public/generated/*.json` (все 10 категорий) — `version` поле обновлено при ETL run, данные те же

## How to apply

### Option 1: Merge with local working copy
```bash
# Из корня локального репозитория poe2-regex-ru:
unzip iter42.zip -d /tmp/iter42
cp -r /tmp/iter42/* ./   # скопирует все 19 файлов с сохранением структуры
```

### Option 2: Git apply (если предпочтительнее)
Используй git-команды ниже для commit + push.

## What was done (iter 42)

1. **`findOverLimitEntries()`** — diagnostic helper в `path-d-transform.ts`, возвращает entries > limit, не модифицирует table
2. **Phase D1** в `compute-optimizations.ts` (после Phase D) — логирует WARNING per category
3. **Final summary diagnostic** в `iterative-optimizer.ts` — сканирует финальные таблицы после всех iterations
4. **10 unit-тестов** для `findOverLimitEntries`
5. **Все 1094 теста проходят** (1084 + 10 новых)
6. **ETL verified end-to-end** — Phase D1 warning появляется для jewel (2 entries: 317, 260 chars)

## Policy: diagnostic-only

Записи НЕ удаляются и НЕ модифицируются — только логируются как warnings.
Entries kept in table (useful for subset selection — compiler picks matching subset when fewer ids are selected),
но full entry нельзя использовать как single in-game regex когда ALL ids выбраны.

## Stop point — что сделано, на чём остановились

**Сделано:**
- ✅ ETL char-limit diagnostic (D7) — полностью реализован
- ✅ 10 unit-тестов добавлены
- ✅ Документация обновлена чисто (5 файлов)
- ✅ Все 1094 теста проходят, TypeScript компилируется
- ✅ ETL verified end-to-end

**Не сделано (намеренно — не блокирующие задачи):**
- D3 (regexExclude усечённые основы) — отдельная задача, не связана с Path D
- Char-limit auto-split — если over-limit entries станут проблемой, можно добавить logic для автоматического разбиения (complex, отдельная задача)
- Финальная полировка UI/UX

**Возможные следующие шаги (опциональные, не блокирующие):**
1. D3 — regexExclude с усечёнными основами
2. Char-limit auto-split (если 2 over-limit entries в jewel станут проблемой)
3. Финальная полировка — UI/UX, edge cases
