# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 757 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- **Iterative optimizer интегрирован в ETL pipeline** (Step 10): автоматический запуск после генерации JSON
- **Oracle validation после каждой итерации**: изменения с cross-family FP/FN автоматически откатываются
- **Suffix shortening стратегия**: синхронизирована с MIN_REGEX_LEN_DEFAULT=5 (вместо старого 3)
- **Short-regex context**: для токенов с regex < MIN_REGEX_LEN (напр. "огня" = 4 chars) автоматически добавляется regexPrefixContext
- **250-char budget awareness**: `estimateMultiModLength()` и `wouldExceedBudget()` для оценки бюджета
- Block model B1-B2 VERIFIED: `.*` НЕ пересекает границы аффикс-блоков
- Waystone/Tablet implicit reversed regex VERIFIED в игре
- Colon anchor VERIFIED в игре
- ETL pipeline: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash

---

## Positive + Negative моды в одном регексе

PoE2 поддерживает `!` (NOT) внутри поисковой строки — это позволяет комбинировать
«хочу» и «точно не хочу» моды в одном регексе:

```
"хочу1|хочу2" !"нехочу1|нехочу2"
```

**Пример:** плитка ≥8 зарядов + находимые путевые камни, но БЕЗ % получаемого золота:
```
"зарядов.*8|9|1[0-9]" "путевых камн" !"золот"
```

**Как это работает в UI:**
1. Выберите моды которые ХОТИТЕ (обычный выбор)
2. Включите режим Exclude (переключатель в Control Panel)
3. Выберите моды которые НЕ ХОТИТЕ
4. Итог: `"want1|want2" !"dontwant1|dontwant2"`

**Техническая реализация:**
- AND + EXCLUDE в AST: `AND(OR(want1, want2), EXCLUDE(OR(dontwant1, dontwant2)))`
- `!` negation — item-wide (проверяет ВСЕ блоки предмета)
- `!` должно быть ВНУТРИ кавычек при комбинации с `|`: `"!A|B"` работает, `!"A|B"` НЕТ

---

## 250-char бюджет при 6+ модах

При выборе 6+ мод суммарная длина регекса может превысить 250 символов (лимит PoE2).
Механизмы оптимизации:

| Уровень | Метод | Экономия |
|---------|-------|----------|
| ETL | Optimizer suffix shortening | 2-10 chars/мод |
| ETL | DP factorization (OR-группы) | 5-30 chars/группа |
| Runtime | Family deduplication | 10-50 chars/семья |
| Runtime | Yofication ([её] вместо е\|ё) | 2-5 chars/позиция |

Функции для оценки бюджета:
- `estimateMultiModLength(regexes, hasRange, contexts, excludes)` — оценка длины
- `wouldExceedBudget(currentLen, newModRegex, ...)` — проверка перед добавлением

---

## Известные ограничения

Нет активных.

---

## ETL Commands

| Команда | Описание |
|---------|----------|
| `pnpm etl` | ETL pipeline + итеративный оптимизатор (Step 10) |
| `pnpm etl:fresh` | Очистка кеша + полный re-fetch + оптимизатор |
| `pnpm etl:check-stale` | Проверка устаревания кеша |
| `pnpm etl:no-optimize` | ETL без оптимизатора (Step 10 пропускается) |
| `pnpm optimize` | Отдельный запуск оптимизатора |
| `pnpm optimize:dry` | Dry-run оптимизатора (без записи) |
| `pnpm optimize:no-oracle` | Оптимизатор без Oracle-валидации |

---

## ETL Pipeline Steps

| Step | Описание |
|------|----------|
| 1 | Fetch HTML from poe2db.tw |
| 2 | Parse + normalize mods |
| 3 | Compute regex substrings |
| 4 | Compute optimizations (DP + dialect) |
| 5 | Generate JSON files |
| 6 | Build jewel type map |
| 7 | Apply i18n overrides + repair cross-family FP |
| 8 | Flat-text Oracle validation (`--validate`) |
| 9 | Block-based Oracle validation (`--validate-item`) |
| **10** | **Iterative optimizer + Oracle validation** |

---

## ETL Results

| Категория | Токенов | Cross-family FP |
|-----------|---------|-----------------|
| amulet | 428 | 0 |
| belt | 298 | 0 |
| jewel | 193 | 0 |
| jewel-corrupted | 10 | 0 |
| jewel-desecrated | 47 | 0 |
| relic | 58 | 0 |
| ring | 369 | 0 |
| tablet | 84 | 0 |
| waystone | 156 | 0 |
| waystone-desecrated | 32 | 0 |
| **Итого** | **1675** | **0** |
