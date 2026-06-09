# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 693 (Vitest) | **ETL токенов:** 1823 | **Cross-family FP:** 0

---

## Выполнено

- ✅ Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- ✅ Sessions 50-82: Oracle validation, cross-family FP repair, ETL audit, VirtualizedModList, dual-slot ranges, jewel sub-headers, UI audit, profile panel, Ctrl+Shift+X, anchorStart (^), anchorEnd (%), chip-with-range CSS
- ✅ Tablet Battery 2026-06-10: PoE2 dual-indexing confirmed. `%` anchor РАБОТАЕТ. Regex syntax валидирован.
- ✅ % anchor RE-ENABLED: восстановлен в useCategoryPage.ts. Dual-indexing подтверждён на всех категориях.
- ✅ Waystone root cause FOUND: имплисет-бонусы не searchable. Моды и имплисеты — подтверждены в игре.

---

## Активные проблемы

### P1: Waystone ETL реструктуризация (CRITICAL)

**Корень найден.** Waystone токены содержат несуществующие моды (имплисет-бонусы). Нужно:

1. Убрать из списка модов строки, влияющие на имплисет:
   - `"На #% больше находимых в области путевых камней"` → удалить
   - `"##% увеличение эффективности монстров"` → удалить
   - `"На #% больше редкости находимых в этой области предметов"` → удалить
   - `"На #% больше размера групп монстров"` → удалить

2. Добавить имплисеты как отдельную категорию с REVERSED regex:
   - `"Шанс выпадения путевого камня"` + range → `"Шанс выпадения путевого камня.*(range)%"`
   - `"Редкость предметов"` + range → `"Редкость предметов.*(range)%"`
   - `"Размер групп монстров"` + range → `"Размер групп монстров.*(range)%"`
   - `"Эффективность монстров"` + range → `"Эффективность монстров.*(range)%"`

3. Имплисеты НЕ имеют dual-indexing (нет range notation в поиске), `%` anchor безопасен.

### P2: % anchor — РЕШЕНО

RE-ENABLED. Работает на модах и имплисетах.

### P3: Block model ретест (MEDIUM)

`"35%.*к сопротивлению молнии"` матчит кольцо с +35% cold + +41% lightning (разные аффиксы). Нужен ретест B1-B2.

---

## Известные ограничения

1. **Waystone ETL данные содержат несуществующие моды** — нужна реструктуризация
2. **+## non-% mods range notation FP** — `+##` без `%` — ни `^`, ни `%` anchoring
3. **Block model может быть неполной** — `.*` может пересекать аффикс-блоки

---

## Следующие шаги

1. Реструктурировать waystone ETL (убрать имплисет-бонусы, добавить имплисеты с reversed regex)
2. Обновить waystone.json с корректными модами + имплисетами
3. Block model ретест B1-B2
4. Аналогичная проверка для tablet: есть ли там имплисет-бонусы в модах?

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
| tablet | 82 | 0 |
| waystone | 311 | 0 |
| waystone-desecrated | 27 | 0 |
| **Итого** | **1823** | **0** |
