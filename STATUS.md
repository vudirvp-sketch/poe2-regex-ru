# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тестов:** 691 (Vitest) | **ETL токенов:** 1823 | **Cross-family FP:** 0

---

## Выполнено

- ✅ Фазы 0-10: Regex Oracle, number-regex, Trie/DP factorization, dialect optimizations, iterative optimizer, AND-composed regex, word truncation, regexPrefixContext, decade grouping
- ✅ Sessions 50-82: Oracle validation, cross-family FP repair, ETL audit, VirtualizedModList, dual-slot ranges, jewel sub-headers, UI audit, profile panel, Ctrl+Shift+X, anchorStart (^), anchorEnd (%), chip-with-range CSS
- ✅ Tablet Battery 2026-06-10: PoE2 dual-indexing confirmed. `%` anchor WORKS on tablets. Regex syntax validated. Waystone problem isolated as waystone-specific.

---

## Активные проблемы

### P1: Waystone number range regex не работает в игре (CRITICAL)

`"(1[5-9]|2[0-4]).*области путевых камней"` не работает в PoE2.

**Обновление (2026-06-10):** Regex syntax `(3[0-6]%|39%).*suffix` работает на плитках. Проблема НЕ в синтаксисе. Waystone-специфичная причина:
- Waystone mod text может не индексироваться поиском
- Формат waystone модов может отличаться от плиток
- Нужны путевые камни в тайнике для теста W1-W4 (IN_GAME_TESTS.md)

### P2: `%` suffix anchor — CONTRADICTION (NEEDS RETEST)

**Предыдущее:** `%` anchor disabled из-за FN на аксессуарах (`+27(22-27)%` → `27` не следует за `%`).
**Новое (Tablet Battery):** `%` anchor РАБОТАЕТ на плитках: `"39%.*suffix"` ✅, `"12%.*suffix"` ✅.

**Причина:** PoE2 dual-indexing — индексируются оба формата: simplified `39%` И detailed `39(30-40)%`. `%` матчит simplified.

**Противоречие:** Если PoE2 dual-indexing универсален, `%` должен работать и на аксессуарах. Предыдущий FN мог быть ошибкой теста или accessory-специфичным поведением.

**Действие:** Ретест `%` на аксессуарах (A1-A5 в IN_GAME_TESTS.md). Если ✅ → откатить disable.

**% anchor механизм (подтверждён на плитках):**
- `"39%.*suffix"` → matches simplified display ✅
- `"39.*suffix"` → matches simplified + range notation → FP
- `(30|39).*suffix` → 6 tiles (3 FP от `30` в `(30-40)%`)
- `(30%|39%).*suffix` → 3 tiles (correct, `%` фильтрует range FP)

---

## Известные ограничения

1. **Range notation FP без `%` anchor** — `(30|39).*suffix` ловит `30` из `(30-40)%`. Решение: `%` anchor.
2. **+## non-% mods range notation FP** — `+##` без `%` — ни `^`, ни `%` anchoring. FP возможен.
3. **Waystone #% enumeration** — нужна диагностика waystone-специфичного поведения.
4. **VendorPage numeric-only без чекбокса** — свойство с numericInput но без selectedIds.

---

## Следующие шаги

- Ретест `%` anchor на аксессуарях (A1-A5)
- Waystone-специфичные тесты W1-W4 (нужны путевые камни в тайнике)
- Если `%` ✅ на аксессуарях → откатить disable `anchorEnd` в коде
- Если `%` ❌ на аксессуарях → разобраться почему dual-indexing работает на плитках но не на аксессуарах

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
