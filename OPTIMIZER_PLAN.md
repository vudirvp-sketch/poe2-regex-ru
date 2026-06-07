# PoE2 Regex RU — План реализации

> **Версия:** 2.0 | **Дата:** 2026-06-07
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (Session 51)

### Выполнено
- ✅ **Фаза 0-9:** Regex Oracle, number-regex fix, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext
- ✅ **Session 50:** Oracle validation compiles regexPrefixContext; repairCrossFamilyFP() limit 5; CONFLICT_MARKERS expanded
- ✅ **Session 51 (ETL re-run результаты):** 3 cross-family FP из 1573 токенов (было 62)

### Результаты ETL re-run (P0 завершён)
| Категория | Токенов | Cross-family FP | Family-tier FP |
|-----------|---------|-----------------|----------------|
| amulet | 427 | 0 | — |
| belt | 298 | 0 | — |
| jewel | 193 | 1 | — |
| jewel-corrupted | 10 | 0 | — |
| jewel-desecrated | 32 | 0 | — |
| relic | 58 | 0 | — |
| ring | 366 | 0 | — |
| tablet | 75 | 2 | — |
| waystone | 97 | 0 | — |
| waystone-desecrated | 17 | 0 | — |
| **Итого** | **1573** | **3** | **1094** |

### 3 оставшихся cross-family FP
1. **jewel.mod_am4lla** — `"повышение скорости атаки" !"Приспеш" !"топорами" !"луками" !"самострелами" !"кинжалами"` → совпадает с боевыми посохами, копьями, мечами. Лимит excludes=5 исчерпан. **Fix:** лимит поднят до 8, добавлены маркеры мечами/луками/топорами/без.
2. **tablet.mod_od9m77** — `увеличение количества находимых` совпадает с mod_ld06px. Тексты являются подстрокой друг друга, нет уникальной подстроки для различения. **Принято как известное ограничение** (по сути family-tier FP — оба мода относятся к одному эффекту).
3. **tablet.mod_ld06px** — `увеличение количества находимых на карте путевых камней` совпадает с mod_od9m77. Аналогично — нет уникальной подстроки. **Принято как известное ограничение.**

### Ключевые изменения Session 51
1. **repairCrossFamilyFP() exclude лимит 5→8** — Позволяет покрыть все типы оружия (топорами, луками, самострелами, кинжалами, посохами, копьями, мечами) + маркер Приспеш + без оружия.
2. **CONFLICT_MARKERS расширен** — Добавлены: мечами, луками, топорами, без (безоружные атаки).
3. **OptimizationEntry расширена** — Добавлены опциональные поля `regexPrefixContext` и `regexExclude` в тип `OptimizationEntry` (`src/shared/types.ts`).
4. **patchOptimizationEntries()** — Новый ETL шаг 7c: патчит оптимизационные записи regexPrefixContext/regexExclude из токенов, которые они покрывают. Выполняется после `repairCrossFamilyFP()`.
5. **tablet FP задокументированы** — mod_od9m77 и mod_ld06px имеют взаимные cross-family FP из-за идентичности текстов (нет уникальной подстроки). Это по сути family-tier FP с разными familyKey.

---

## Следующие шаги (P1 → P2)

### P1: In-game тесты Group M (требует ручного тестирования)
1. `|` внутри `()` — проверить `"([5-9]|[1-9].)"` в PoE2
2. Number range с `|` — `([4-9][0-9]|[0-9][0-9][0-9])`
3. Combined negate: `"!снарядов|чар"`

### P1: Runtime optimizer + regexPrefixContext
Сейчас оптимизационные записи содержат `regexPrefixContext` и `regexExclude` (ETL-side done), но runtime optimizer (`src/core/optimizer.ts`) не использует их. Нужно:
1. В `applyOptimizationTable()` — когда оптимизационная запись имеет `regexPrefixContext`, создавать AND(LITERAL(context), LITERAL(regex)) вместо просто LITERAL(regex)
2. Когда запись имеет `regexExclude` — создавать AND(LITERAL(regex), EXCLUDE(OR(...excludes)))
3. Оба: AND(LITERAL(context), LITERAL(regex), EXCLUDE(OR(...excludes)))

### P1: Truncated forms в compute-optimizations.ts
Сейчас Phase A использует полный template suffix как shared regex. Можно попробовать усечение слов (Strategy 1e) для более коротких оптимизационных записей. Требует проверки уникальности усечённых форм.

### P1: ETL re-run (после Session 51 изменений)
Запустить `pnpm etl -- --validate-item` чтобы подтвердить что:
- jewel.mod_am4lla FP устранён (exclude лимит поднят до 8)
- patchOptimizationEntries() корректно патчит записи
- Общий cross-family FP снизился с 3 до 1-2 (tablet FP останутся)

### P2: UI/UX
1. List virtualization — belt (298), ring (366), amulet (427)
2. HomePage hardcoded counts
3. Multi-line mod handling
