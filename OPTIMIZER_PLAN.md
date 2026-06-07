# PoE2 Regex RU — План доработок

> **Версия:** 3.0 | **Дата:** 2026-06-07
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (Session 52)

### Выполнено
- ✅ **Фаза 0-9:** Regex Oracle, number-regex fix, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext
- ✅ **Session 50:** Oracle validation compiles regexPrefixContext; repairCrossFamilyFP() лимит 3→5; CONFLICT_MARKERS expanded
- ✅ **Session 51:** ETL re-run результаты — 3 cross-family FP из 1573 токенов; exclude limit 5→8; patchOptimizationEntries()
- ✅ **Session 52:** Runtime optimizer использует regexPrefixContext/regexExclude из OptimizationEntry; AND-wrapped LITERAL support

### Результаты ETL (Session 51, P0 завершён)
| Категория | Токенов | Cross-family FP |
|-----------|---------|-----------------|
| amulet | 427 | 0 |
| belt | 298 | 0 |
| jewel | 193 | 1 |
| jewel-corrupted | 10 | 0 |
| jewel-desecrated | 32 | 0 |
| relic | 58 | 0 |
| ring | 366 | 0 |
| tablet | 75 | 2 |
| waystone | 97 | 0 |
| waystone-desecrated | 17 | 0 |
| **Итого** | **1573** | **3** |

### 3 оставшихся cross-family FP
1. **jewel.mod_am4lla** — лимит excludes исчерпан. **Fix:** лимит поднят до 8 (Session 51). Нужен ETL re-run.
2. **tablet.mod_od9m77** / **tablet.mod_ld06px** — нет уникальной подстроки. **Принято как известное ограничение.**

---

## Следующие шаги (P1 → P2)

### P1: In-game тесты Group M (требует ручного тестирования)
1. `|` внутри `()` — проверить `"([5-9]|[1-9].)"` в PoE2
2. Number range с `|` — `([4-9][0-9]|[0-9][0-9][0-9])`
3. Combined negate: `"!снарядов|чар"`

### P1: ETL re-run (после Session 51 изменений)
Запустить `pnpm etl -- --validate-item` чтобы подтвердить что:
- jewel.mod_am4lla FP устранён (exclude лимит поднят до 8)
- patchOptimizationEntries() корректно патчит записи
- Общий cross-family FP снизился с 3 до 1-2 (tablet FP останутся)

### P1: Truncated forms в compute-optimizations.ts
Сейчас Phase A использует полный template suffix как shared regex. Можно попробовать усечение слов (Strategy 1e) для более коротких оптимизационных записей. Требует проверки уникальности усечённых форм.

### P2: UI/UX
1. List virtualization — belt (298), ring (366), amulet (427)
2. HomePage hardcoded counts
3. Multi-line mod handling
