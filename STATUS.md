# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 761 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- Per-mod want/exclude toggle — каждый FilterChip имеет кнопку ✗/✓ для переключения в режим «не хочу»
- Budget-aware UI feedback — amber-предупреждение при 6+ модах и >180 chars, health bar
- In-game verification: want + exclude pattern — `"want" "!dontwant"` подтверждён
- Colon anchor — для non-% reversed модов с `: ##` шаблоном (верифицировано в игре)
- Real testing of optimizer — `pnpm etl:fresh` выполнен, FP=8224, FN=0, avgLen=18.7
- ETL pipeline: normalize.ts + run-etl.ts, --fresh, --check-stale, sourceHash
- Block model B1-B2 VERIFIED: `.*` НЕ пересекает границы аффикс-блоков
- In-game test plan — 10 групп, 28 тестов, покрывает все regex-паттерны (`регис/плитки для теста в игре.md`)

---

## In-game verified patterns

| Паттерн | Формат | Результат |
|---------|--------|-----------|
| Want + AND | `"A" "B"` | ✅ Предметы с A и B |
| Want + OR | `"A\|B"` | ✅ Предметы с A или B |
| Want + Exclude | `"A" "!B"` | ✅ Предметы с A, но без B |
| Exclude (wrong) | `"A" !"B"` | ❌ Ничего не подсвечивает |
| Exclude OR | `"A" "!B\|C"` | ✅ Предметы с A, но без B и C |
| Colon anchor (non-%) | `"suffix.*: N"` | ✅ Предотвращает FP от range notation |
| ^ anchor | `"^(N).*suffix"` | ✅ Число в начале блока |
| % suffix anchor | `"(N)%.*suffix"` | ✅ % после числа |
| .* forward only | `"A.*B"` forward | ✅ Совпадает только в прямом порядке |
| .* block boundary | `"A.*B"` across blocks | ❌ НЕ пересекает блоки |

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

## ETL Results (pnpm etl:fresh, 2026-06-10)

| Категория | Токенов | FN | FP | avgLen | Optimizations |
|-----------|---------|-----|-----|--------|---------------|
| amulet | 428 | 0 | 2997 | 19.0 | 104 |
| belt | 298 | 0 | 1731 | 18.4 | 74 |
| jewel-corrupted | 10 | 0 | 0 | 12.2 | 1 |
| jewel-desecrated | 47 | 0 | 79 | 14.9 | 21 |
| jewel | 193 | 0 | 83 | 17.5 | 112 |
| relic | 58 | 0 | 182 | 19.8 | 17 |
| ring | 369 | 0 | 2510 | 17.3 | 93 |
| tablet | 84 | 0 | 11 | 21.1 | 30 |
| waystone-desecrated | 32 | 0 | 8 | 17.3 | 9 |
| waystone | 156 | 0 | 623 | 23.2 | 43 |
| **Итого** | **1675** | **0** | **8224** | **18.7** | **504** |

---

## Next Steps

1. **In-game тестирование** — выполнить тесты из `регис/плитки для теста в игре.md` (10 групп, 28 тестов, все предметы в наличии)
2. **Обновить IN_GAME_TESTS.md** — внести результаты тестирования
