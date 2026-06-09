# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 693 (Vitest) | **ETL токенов:** 1675 | **Cross-family FP:** 0

---

## Выполнено

- ✅ Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- ✅ Sessions 50-82: Oracle validation, cross-family FP repair, ETL audit, VirtualizedModList, dual-slot ranges, jewel sub-headers, UI audit, profile panel, Ctrl+Shift+X, anchorStart (^), anchorEnd (%), chip-with-range CSS
- ✅ Tablet Battery 2026-06-10: PoE2 dual-indexing confirmed. `%` anchor РАБОТАЕТ.
- ✅ % anchor RE-ENABLED: восстановлен в useCategoryPage.ts. Dual-indexing подтверждён на всех категориях.
- ✅ Waystone root cause FOUND: имплисет-бонусы не searchable. Моды и имплисеты — подтверждены в игре.
- ✅ Waystone ETL реструктуризация: убраны implicit-set бонусы, добавлены implicit токены с reversed regex.
- ✅ AffixType 'implicit': добавлен в типы, классификатор, family-grouper, UI.
- ✅ Reversed RANGE: compiler поддерживает `reversed: true` → `"suffix.*(range)%"`.
- ✅ ETL pipeline автоматизация: `normalize.ts` + `run-etl.ts` автоматически фильтруют implicit-set бонусы и генерируют implicit токены.
- ✅ **Block model B1-B2 VERIFIED**: `.*` НЕ пересекает границы аффикс-блоков. Подтверждено в игре: `"35%.*к сопротивлению молнии"` → только кольцо с +35% lightning, НЕ кольцо с +35% cold + +41% lightning (разные аффиксы/блоки).
- ✅ **Waystone implicit reversed regex VERIFIED**: `"Шанс выпадения путевого камня.*85%"` работает в игре.
- ✅ **Tablet implicit regex VERIFIED**: `"Осталось зарядов.*3"` и `"алтари Ритуала"` работают в игре.
- ✅ **Waystone implicit ranges**: обновлены до [0, 350] (с запасом для high-tier путевых камней).

---

## Известные ограничения

1. **+## non-% mods range notation FP** — `+##` без `%` — ни `^`, ни `%` anchoring. FP возможен от range notation в описательной строке мода.

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
