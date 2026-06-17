# iter 72 — Patch Archive

**Дата:** 2026-06-18
**Итерация:** 72
**Базовый commit:** 23c6844 (iter 71)

## Содержание патча

5 файлов, зеркало структуры репозитория — для слияния с локальной директорией:

```
STATUS.md
AGENT_NAVIGATION.md
worklog.md
scripts/etl/compute-optimizations.ts
scripts/etl/iterative-optimizer.ts
```

## Что сделано

### Реальные фиксы (3)

1. **Bug #10 — Дедуплицирован `normalizeTemplate`**
   - Удалён из `scripts/etl/compute-optimizations.ts:30-35` (17 строк)
   - Импортирован из `scripts/etl/compute-regex-core.ts:43-48` (canonical source)

2. **Bug #11 — Дедуплицирован `extractTemplateSuffix`**
   - Удалён из `scripts/etl/iterative-optimizer.ts:446-458` (16 строк)
   - Импортирован из `scripts/etl/compute-regex-core.ts:61-89` (canonical source)

3. **Bug #12 — Удалён dead code `longestCommonSubstring`**
   - Удалён из `scripts/etl/compute-optimizations.ts:301-337` (32 строки + `@ts-expect-error`)

### Документация

4. **`STATUS.md` — полная переработка**
   - Удалены устаревшие таблицы (UI Redesign phases, Atmospheric Assets table)
   - Добавлен Known Issue **KI-1** (`?` tokenizer mismatch) с описанием, mitigation, планом фикса
   - Файл стал ~50 строк вместо ~80

5. **`worklog.md` — iter 72 + сжатие**
   - Добавлен Task ID 72 section (подробно)
   - Старые итерации сжаты до 1-строчного списка

6. **`AGENT_NAVIGATION.md` — header iter 72 + Pitfall 30**
   - Header обновлён: убраны избыточные детали атмосферных ассетов (всё уже в Pitfall 29)
   - Добавлен Pitfall 30 (`?` tokenizer mismatch — Oracle FP risk)

## Верификация

- `npx tsc -b` — **OK** (0 ошибок)
- `pnpm test` — **1144/1144 тестов зелёные** (baseline сохранён)
- `npx eslint` на изменённых файлах — 3 pre-existing ошибки в `iterative-optimizer.ts` (POE2_REGEX_LIMIT, ESTIMATED_MOD_OVERHEAD, itemBlocks — unused vars), **НЕ** вызваны моими правками (проверено через `git stash`)

## Анализ кодовой базы — что верифицировано

### Подтверждённые баги (исправлены в этой итерации)
- Bug #10, Bug #11, Bug #12 — см. выше

### Подтверждённые баги (документированы, фикс отложен)
- **Bug #1 (`?` tokenizer mismatch)** — Known Issue KI-1. Фикс требует решения: ломать тесты или добавлять runtime warning в matcher.

### Анализ ошибался (багов нет)
- **Bug #5** (limits.ts escape в `[...]`): код корректно обрабатывает escape внутри char class
- **Bug #6** (path-d-transform.ts escape edge case): на практике regex не заканчивается на `\`
- **Bug #9** (`hasYofication/yoficationPositions` dead data flow): поля ИСПОЛЬЗУЮТСЯ в `useCategoryPage.ts:950, 976` в `applyRuntimeYofication`

### Архитектурный долг (не тронут, низкий приоритет)
- Bug #8 — `useCategoryPage.ts` 1325 строк (требует большого рефакторинга)
- Bug #13 — `iterative-optimizer` skip ranged regexes
- Bug #15-20 — мелкие упущения

## Git-команды для обновления репозитория

```bash
# В локальной копии репозитория (после слияния файлов из архива):

git add STATUS.md AGENT_NAVIGATION.md worklog.md \
        scripts/etl/compute-optimizations.ts \
        scripts/etl/iterative-optimizer.ts

git commit -m "iter 72: dedup ETL utils, remove dead code, document KI-1 (? tokenizer mismatch)

- Bug #10: remove duplicate normalizeTemplate from compute-optimizations.ts,
  import from compute-regex-core.ts (canonical source)
- Bug #11: remove duplicate extractTemplateSuffix from iterative-optimizer.ts,
  import from compute-regex-core.ts (canonical source)
- Bug #12: remove dead code longestCommonSubstring (32 lines + @ts-expect-error)
  from compute-optimizations.ts
- Document Bug #1 (? tokenizer mismatch) as Known Issue KI-1 in STATUS.md
- AGENT_NAVIGATION.md: add Pitfall 30 (? tokenizer = Oracle FP risk)
- worklog.md: iter 72 section, compress older iterations

Verified: tsc -b clean, 1144/1144 tests green, no new lint errors."

git push origin main
```

## Точка остановки для продолжения в новом чате

**Сделано:**
- 3 safe-фикса (дедупликация 2 ETL-утилит + удаление dead code)
- Bug #1 задокументирован как Known Issue KI-1
- Документация актуализирована и почищена (STATUS.md стал ~50 строк вместо ~80)
- Все 1144 теста зелёные, tsc -b чистый

**Открытая работа (для следующей итерации):**
- **KI-1 `?` tokenizer mismatch** — нужен design decision:
  - **(a)** Ломать существующие тесты в `tests/core/poe2-regex-matcher.test.ts:169-183, 932-940` и делать `?` (вне `(?!`) fatal-error в tokenizer
  - **(b)** Добавить runtime-warning в `matchQuotedGroup`/`matchPoE2Regex` при обнаружении `?` вне `(?!` контекста, переработать тесты на `expect(warn).toHaveBeenCalled()` вместо `expect(matched).toBe(true)`
  - Рекомендация: вариант (b) — менее инвазивный, сохраняет semantic тестов
- Архитектурный долг (Bug #8, #13, #15-20) — не тронут, низкий приоритет
- Pre-existing lint-ошибки в `iterative-optimizer.ts:111, 114, 193` — вне scope этой итерации
