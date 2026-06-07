# PoE2 Regex RU — План доработок

> **Версия:** 5.0 | **Дата:** 2026-06-08
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (Session 57)

### Выполнено
- ✅ **Фаза 0-9:** Regex Oracle, number-regex fix, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext
- ✅ **Session 50-51:** Oracle validation, repairCrossFamilyFP(), patchOptimizationEntries()
- ✅ **Session 52:** Runtime optimizer использует regexPrefixContext/regexExclude из OptimizationEntry
- ✅ **Session 53:** ETL re-run — jewel.mod_am4lla FP устранён (exclude limit 8→10)
- ✅ **Session 53:** Phase A1 word truncation — экономия ~541 символов
- ✅ **Session 56:** VirtualizedModList, dual-slot ranges, jewel sub-headers
- ✅ **Session 57:** Все tablet cross-family FP устранены (4→0) через `—` exclude/context

### Результаты ETL (Session 57)
| Категория | Токенов | Cross-family FP |
|-----------|---------|-----------------|
| amulet | 428 | 0 |
| belt | 298 | 0 |
| jewel | 193 | 0 |
| jewel-corrupted | 10 | 0 |
| jewel-desecrated | 47 | 0 |
| relic | 58 | 0 |
| ring | 369 | 0 |
| tablet | 82 | 0 |
| waystone | 311 | 0 |
| waystone-desecrated | 27 | 0 |
| **Итого** | **1823** | **0** |

---

## Следующие шаги (P1 → P2)

### P1: Browser-тестирование
1. VirtualizedModList — скролл, поиск, фильтры, клики по чипам
2. Dual-slot ranges — 1е/2е поля для модов типа "От ## до ## урона"
3. Jewel type sub-headers — на странице самоцветов

### P2: Улучшения
1. Jewel classification accuracy — ETL lookup для обычных самоцветов; heuristic fallback (~84%)
2. Number regex length — `[0-9]` = 5 chars vs `.` = 1 char. Некоторые RANGE regex могут превысить лимит 250
