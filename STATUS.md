# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 761 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- **Per-mod want/exclude toggle** — каждый FilterChip имеет кнопку ✗/✓ для переключения в режим «не хочу»
- **Budget-aware UI feedback** — amber-предупреждение при 6+ модах и >180 chars, health bar
- **In-game verification: want + exclude pattern** — `"want" "!dontwant"` подтверждён (2026-06-10)
- **Colon anchor** — для non-% reversed модов с `: ##` шаблоном (верифицировано в игре)
- ETL pipeline: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash
- Block model B1-B2 VERIFIED: `.*` НЕ пересекает границы аффикс-блоков

---

## Per-mod want/exclude toggle

- Каждый FilterChip имеет кнопку ✗/✓ для переключения мода в режим «не хочу»
- `selectedIds` и `excludedIds` — взаимоисключающие множества
- AST: `AND(want_nodes, EXCLUDE(OR(exclude_nodes)))`
- Компилируется в `"want1|want2" "!dontwant1|dontwant2"` — `!` внутри кавычек
- URL-сериализация: ключ `e` содержит массив excludedIds
- Визуальные стили: excluded = красный фон + красная левая граница

---

## In-game verified patterns

| Паттерн | Формат | Результат |
|---------|--------|-----------|
| Want + AND | `"A" "B"` | ✅ Предметы с A и B |
| Want + OR | `"A\|B"` | ✅ Предметы с A или B |
| Want + Exclude | `"A" "!B"` | ✅ Предметы с A, но без B |
| Exclude (wrong) | `"A" !"B"` | ❌ Ничего не подсвечивает |
| Exclude OR | `"A" "!B\|C"` | ✅ Предметы с A, но без B и C |

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
