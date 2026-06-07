# PoE2 Regex RU — План доработок

> **Версия:** 4.0 | **Дата:** 2026-06-07
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (Session 53)

### Выполнено
- ✅ **Фаза 0-9:** Regex Oracle, number-regex fix, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext
- ✅ **Session 50-51:** Oracle validation, repairCrossFamilyFP(), patchOptimizationEntries()
- ✅ **Session 52:** Runtime optimizer использует regexPrefixContext/regexExclude из OptimizationEntry
- ✅ **Session 53:** ETL re-run подтверждён — jewel.mod_am4lla FP устранён (exclude limit 8→10)
- ✅ **Session 53:** Phase A1 word truncation в compute-optimizations.ts — экономия ~541 символов
- ✅ **Session 53:** HomePage counts — уже динамические (не hardcoded)

### Результаты ETL (Session 53)
| Категория | Токенов | Cross-family FP | Phase A1 savings |
|-----------|---------|-----------------|------------------|
| amulet | 427 | 0 | 113 chars |
| belt | 298 | 0 | 106 chars |
| jewel | 193 | 0 | 0 |
| jewel-corrupted | 10 | 0 | 0 |
| jewel-desecrated | 32 | 0 | 0 |
| relic | 58 | 0 | 86 chars |
| ring | 366 | 0 | 105 chars |
| tablet | 75 | 2 | 0 |
| waystone | 97 | 0 | 128 chars |
| waystone-desecrated | 17 | 0 | 3 chars |
| **Итого** | **1573** | **2** | **541 chars** |

### 2 оставшихся cross-family FP (принято)
1. **tablet.mod_od9m77** — нет уникальной подстроки
2. **tablet.mod_ld06px** — нет уникальной подстроки

---

## Следующие шаги (P1 → P2)

### P1: In-game тесты Group M (требует ручного тестирования)
1. `|` внутри `()` — проверить `"([5-9]|[1-9].)"` в PoE2
2. Number range с `|` — `([4-9][0-9]|[0-9][0-9][0-9])`
3. Combined negate: `"!снарядов|чар"`

### P2: UI/UX
1. List virtualization — belt (298), ring (366), amulet (427)
2. Multi-line mod handling
