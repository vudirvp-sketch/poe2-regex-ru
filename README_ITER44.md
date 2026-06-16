# PoE2 Regex RU — Iter 44 Archive (FP-fix: 3 bugs in shared `src/core/`)

## What's inside

Этот архив содержит **только изменённые файлы** для слияния с локальной директорией.
Сохранена структура папок для прямого merge.

## Changed files (15 total)

### Code (3 files)
- `src/core/core-optimizations.ts` — surgical `removeConflictingExcludes` (Bug 1 fix): добавлены `findConflictingExcludeValues` + `removeExcludeValues`, переписана `removeConflictingExcludes` для удаления только конфликтующих literals
- `src/core/optimization-strategies.ts` — strict-subset skip в `applyOptimizationTable` (Bug 2 fix): skip opt-entries с top-level `|` когда `matchedIds.size < entry.ids.length`
- `src/core/compiler.ts` — AND-in-OR transform в `normalizeAst` (Bug 3 fix): AND(LITERAL, EXCLUDE) внутри OR → single LITERAL с per-block lookahead `X(?!.*A)(?!.*B)...`

### Tests (1 file)
- `tests/core/optimizer.test.ts` — 12 новых unit-тестов: 4 surgical removeConflictingExcludes, 3 strict-subset skip, 4 compiler AND-in-OR transform, 1 end-to-end regression

### Documentation (4 files)
- `STATUS.md` → iter 44, 3 fixes описаны, Known Issues обновлены
- `AGENT_NAVIGATION.md` → v30, §5 iter 44 added, Pitfall 11/12/14/20/21 updated, §12 Principle 8 updated
- `docs/ARCHITECTURE.md` → iter 44 row added в §3 Path D history
- `worklog.md` → Task ID 44 + сжатые summary 42-43

### Generated data (10 files) — только timestamp обновлён
- `public/generated/*.json` (все 10 категорий) — `version` поле обновлено при ETL run, данные те же

## How to apply

### Option 1: Merge with local working copy
```bash
# Из корня локального репозитория poe2-regex-ru:
unzip iter44.zip -d /tmp/iter44
cp -r /tmp/iter44/* ./   # скопирует все 15 файлов с сохранением структуры
```

### Option 2: Git apply (если предпочтительнее)
Используй git-команды ниже для commit + push.

## What was done (iter 44)

### User-reported bug

Пользователь выбрал 4 аффикса на самоцветах (OR mode):
1. `(2—4)% повышение скорости атаки` (jewel.mod_am4lla — с 10 regexExclude values)
2. `(2—4)% повышение скорости атаки копьями` (jewel.mod_26n6rw)
3. `(1—2)% повышение скорости передвижения` (jewel.mod_sbryhz)
4. `(3—5)% повышение скорости перезарядки умений` (jewel.mod_kcvuf)

Сгенерированный регекс вызывал FP: совпадали «повышение скорости атаки луками», «...самострелами», «накопления шкалы заморозки боевыми посохами», «перезарядки самострела», «перезарядки боевых кличей».

### Root cause: 3 compaund bugs

1. **Bug 1 — `removeConflictingExcludes` слишком агрессивный** (`src/core/core-optimizations.ts`): Если внутри `EXCLUDE(OR(...))` хотя бы ОДИН литерал конфликтовал с sibling — функция удаляла ВЕСЬ `EXCLUDE` целиком, теряя все остальные exclude-паттерны.
2. **Bug 2 — `applyOptimizationTable` не делал subset** (`src/core/optimization-strategies.ts`): При strict subset (2 из 4 IDs) применялся ПОЛНЫЙ regex opt-entry — с альтернативами для невыбранных IDs → FP.
3. **Bug 3 — Compiler порождал nested quotes когда AND внутри OR** (`src/core/compiler.ts`): `AND(LITERAL, EXCLUDE)` компилировалось в `"X" "!A|B"` с внутренними кавычками. PoE2 strip-ит их → exclude-паттерны (`!A`, `B`, `C`) становились отдельными позитивными альтернативами → FP.

### Fixes

- **Fix Bug 1**: Surgical — удалять только конфликтующие literals из OR внутри EXCLUDE
- **Fix Bug 2**: Skip opt-entry при strict subset (для regex с top-level `|`)
- **Fix Bug 3**: Transform `AND(LITERAL, EXCLUDE(LITERAL|OR(LITERAL,...)))` внутри OR → single LITERAL с per-block lookahead `X(?!.*A)(?!.*B)...`

### Verification

- 12 новых unit-тестов (+0 regressions): все 1106 тестов проходят (1094 + 12 новых)
- Воспроизведённый test (user bug scenario): TP=4, FP=0, FN=0, TN=6 (раньше TP=4, FP=5, FN=0, TN=1)
- TypeScript компилируется без ошибок
- ETL regenerирован: FN=0 для всех 10 категорий, метрики не изменились

### Resulting regex (user's case)

```
"повышение скорости атаки(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми)|перезарядки умений|передвижения|атаки копьями"
```
Length: 192 chars (under 250 PoE2 limit). Single quoted group, no nested quotes, per-block lookaheads for all 9 excludes, opt-entry subset skipped.

## Stop point — что сделано, на чём остановились

**Сделано:**
- ✅ Анализ проблемы (text report в чат, без PDF/DOCX)
- ✅ Воспроизведение бага в unit-тесте
- ✅ 3 bug fixes реализованы (Bug 1 surgical, Bug 2 skip subset, Bug 3 per-block lookahead)
- ✅ 12 новых unit-тестов (включая end-to-end regression для user scenario)
- ✅ Все 1106 тестов проходят, TypeScript компилируется
- ✅ ETL regenerирован (FN=0 без изменений метрик)
- ✅ Документация обновлена чисто (4 файла)

**Не сделано (намеренно — опциональные, не блокирующие):**
- **In-game verify** per-block `(?!…)` semantic в OR-context — нужен живой тест пользователя (фикс Bug 3 использует semantic change от item-wide `!` к per-block `(?!…)`)
- **Pitfall 11 extended**: AND с regexPrefixContext + LITERAL + EXCLUDE всё ещё порождает nested quotes (rare case, не user-reported bug)
- **D3 regexExclude усечённые основы** (iter 43 pre-analysis) — отдельная задача, не связана с iter 44

**Возможные следующие шаги (опциональные, не блокирующие):**
1. In-game verify — прислать пользователю емкий тест для подтверждения per-block semantic
2. Pitfall 11 extended — добавить transform для AND с context + LITERAL + EXCLUDE
3. D3 — regexExclude усечённые основы (iter 43 pre-analysis готов)
4. Char-limit auto-split — для 2 over-limit entries в jewel
