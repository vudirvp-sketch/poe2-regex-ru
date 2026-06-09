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
- ✅ **ETL pipeline автоматизация**: `normalize.ts` + `run-etl.ts` автоматически фильтруют implicit-set бонусы и генерируют implicit токены. Скрипт `restructure-implicits.ts` больше не нужен при будущих ETL-запусках.
- ✅ **Waystone implicit ranges**: диапазоны установлены 0-250 (не подтверждены в игре, используются свободные).

---

## Активные проблемы

### P3: Block model ретест B1-B2 (MEDIUM)

`"35%.*к сопротивлению молнии"` матчит кольцо с +35% cold + +41% lightning (разные аффиксы). Нужен ретест в игре:

| # | Regex | Цель | Статус |
|---|-------|------|--------|
| B1 | `"35%.*к сопротивлению холоду"` | `.*` в пределах одного блока? | ⬜ Требуется проверка в игре |
| B2 | `"+66.*к силе"` | `.*` через prefix→suffix? | ⬜ Требуется проверка в игре |

---

## Известные ограничения

1. **+## non-% mods range notation FP** — `+##` без `%` — ни `^`, ни `%` anchoring
2. **Waystone implicit ranges не подтверждены** — используются 0-250, точные диапазоны требуют проверки в игре

---

## Следующие шаги

1. Проверить waystone implicit regex в игре (reversed regex)
2. Проверить tablet implicit regex в игре
3. Block model ретест B1-B2 в игре

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
