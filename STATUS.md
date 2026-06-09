# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 693 (Vitest) | **ETL токенов:** 1672 | **Cross-family FP:** 0

---

## Выполнено

- ✅ Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- ✅ Sessions 50-82: Oracle validation, cross-family FP repair, ETL audit, VirtualizedModList, dual-slot ranges, jewel sub-headers, UI audit, profile panel, Ctrl+Shift+X, anchorStart (^), anchorEnd (%), chip-with-range CSS
- ✅ Tablet Battery 2026-06-10: PoE2 dual-indexing confirmed. `%` anchor РАБОТАЕТ. Regex syntax валидирован.
- ✅ % anchor RE-ENABLED: восстановлен в useCategoryPage.ts. Dual-indexing подтверждён на всех категориях.
- ✅ Waystone root cause FOUND: имплисет-бонусы не searchable. Моды и имплисеты — подтверждены в игре.
- ✅ **Waystone ETL реструктуризация DONE**: убраны 160 implicit-set бонусов из waystone.json, добавлены 5 waystone implicit + 5 tablet implicit + 5 waystone-desecrated implicit токенов с reversed regex.
- ✅ **AffixType 'implicit'**: добавлен в типы, классификатор, family-grouper, UI. Implicit токены отображаются в секции "ИМПЛИСЕТ".
- ✅ **Reversed RANGE**: compiler поддерживает `reversed: true` на RANGE-нодах → `"suffix.*(range)%"` вместо `"(range)%.*suffix"`.

---

## Активные проблемы

### P2: % anchor — РЕШЕНО

RE-ENABLED. Работает на модах и имплисетах.

### P3: Block model ретест (MEDIUM)

`"35%.*к сопротивлению молнии"` матчит кольцо с +35% cold + +41% lightning (разные аффиксы). Нужен ретест B1-B2.

---

## Известные ограничения

1. **+## non-% mods range notation FP** — `+##` без `%` — ни `^`, ни `%` anchoring
2. **Block model может быть неполной** — `.*` может пересекать аффикс-блоки
3. **ETL pipeline не автоматизирован** для implicit-токенов — реструктуризация выполнена скриптом `restructure-implicits.ts`, но будущие ETL-запуски нужно обновить

---

## Следующие шаги

1. Block model ретест B1-B2
2. Обновить ETL pipeline (normalize.ts, run-etl.ts) для автоматического разделения implicit-set бонусов
3. Проверить waystone implicit regex в игре (reversed regex)
4. Проверить tablet implicit regex в игре

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
