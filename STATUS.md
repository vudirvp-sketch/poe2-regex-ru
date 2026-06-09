# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 691 (Vitest) | **ETL токенов:** 1823 | **Cross-family FP:** 0

---

## Выполнено

- ✅ Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- ✅ Sessions 50-82: Oracle validation, cross-family FP repair, ETL audit, VirtualizedModList, dual-slot ranges, jewel sub-headers, UI audit, profile panel, Ctrl+Shift+X, anchorStart (^), anchorEnd (%), chip-with-range CSS
- ✅ Phase 9c REVISED: `anchorEnd='%'` DISABLED for `+##%` accessory mods. In-game testing confirmed: PoE2 indexes text WITH range notation → `%` after number = 100% FN. Enumeration without `%` anchor is the correct approach.

---

## Активные проблемы

### P1: Waystone number range regex не работает в игре (CRITICAL)

`"(1[5-9]|2[0-4]).*области путевых камней"` не работает в PoE2. Оба варианта (с `()` и с отдельными quoted groups) не дают результатов.

**Диагностика:** См. IN_GAME_TESTS.md — тест-батарея W1-W12 для изоляции корня проблемы.

**Возможные причины:**
- PoE2 regex length/complexity limit
- `|` binding issue с `()` + char class + `.*` + длинным suffix
- Waystone mod text format отличается от ожидаемого
- PoE2 не индексирует waystone мод текст так как мы думаем

### P2: `%` suffix anchor FN (RESOLVED — anchor disabled)

**Было:** `anchorEnd='%'` на `+##%` модах аксессуаров вызывал FN (false negatives).
**Причина:** PoE2 индексирует текст С range notation: `+27(22-27)%` — число `27` следует за `(`, не `%`.
**Решение:** `anchorEnd` отключён в runtime. Enumeration без `%` обеспечивает FP-защиту для узких диапазонов.

**Остаточный риск:** FP от range notation secondary numbers (напр. `+26(27-50)%` матчит `(2[7-9]|30)`). Приемлемый компромисс.

---

## Известные ограничения

1. **+## non-% mods range notation FP** — `+##` без `%` (напр. "+## к силе") — ни `^`, ни `%` anchoring. FP возможен.
2. **Waystone #% enumeration FP** — enumeration без `%` anchor может иметь FP от range notation.
3. **VendorPage numeric-only без чекбокса** — свойство с numericInput но без selectedIds может не попасть в regex.

---

## Следующие шаги

- Провести in-game тестирование по тест-батарее W1-W12 из IN_GAME_TESTS.md
- Провести in-game тестирование P1-P8 для % anchor
- На основе результатов — скорректировать waystone regex стратегию
- P5: Priority tier валидация (отложено)
- P6: Мобильное тестирование

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
