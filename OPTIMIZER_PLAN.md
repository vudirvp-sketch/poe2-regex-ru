# PoE2 Regex RU — План реализации

> **Версия:** 1.7 | **Дата:** 2026-06-07
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (Session 48)

### Выполнено
- ✅ **Фаза 0-6:** Regex Oracle, number-regex fix, Trie/DP factorization, dialect optimizations, iterative optimizer
- ✅ **Фаза 7 (частично):** 86 hypothesis-driven тестов на реальных предметах
- ✅ **Фаза 8 (частично):** Mixed-conflict excludes, `!(A|B)` format, word truncation, post-i18n-override FP repair
- ✅ **ETL re-run (Session 48):** FN=0, cross-family FP=62 (was 77), family-tier FP=1062, valid=1511/1573

### Ключевые изменения Session 48
1. **`repairCrossFamilyFP()` в run-etl.ts** — Новый ETL шаг после i18n overrides: удлиняет regex до полного суффикса шаблона, добавляет недостающие exclude-маркеры, итерирует до сходимости. Исправил 15 cross-family FP (77→62).
2. **Корневая причина FP после i18n overrides** — i18n заменяет rawText ПОСЛЕ compute-regex, делая ранее уникальные regex не-уникальными. Пример: "скорости сотворения чар" был уникален против английского flask-effect rawText, но после override появился русский "увеличение скорости сотворения чар во время действия любого флакона" с FP.

### Оставшиеся cross-family FP (62)
| Категория | FP | Причина | Решение |
|-----------|-----|---------|---------|
| amulet | 19 | minion res, minion damage vs flask, corrupted gems | Исключить через AND-regex или i18n overrides |
| ring | 14 | minion damage (8), elemental res (4), other (2) | AND-composed regex `"имеют" "увеличение урона"` |
| jewel-desecrated | 15 | composite dual-stat mods делят второй стат | AND-composed regex `"повышение брони" "увеличение урона"` |
| jewel | 11 | короткие суффиксы ("быстрее", "увеличение урона") | Длинные суффиксы или больше excludes |
| tablet | 3 | "быстрее", generic prefixes | i18n overrides с explicit regex |

---

## Следующие шаги (P0 → P2)

### P0: AND-composed regex support
Для ring minion damage и jewel-desecrated composite mods нужен механизм:
- Новое поле `regexPrefixContext` в JSON схеме
- UI: `AND(LITERAL(prefixContext), LITERAL(regex))` компилируется в `"context" "suffix"`
- ETL: `repairCrossFamilyFP()` заполняет `regexPrefixContext` когда exclude не помогает
- Ожидаемый эффект: −23 cross-family FP (8 ring + 15 jewel-desecrated)

### P1: Остальные FP фиксы
1. Ring minion elemental res (4 FP) — изменить regex с "стихия" на "к сопротивлению всем стихиям" или добавить "сопротивлению" как префикс
2. Amulet оставшиеся 19 FP — детальный анализ конкретных токенов
3. Jewel 11 FP — longer suffixes или additional excludes
4. In-game тесты — `|` внутри `()`, number range с `|`
5. Optimizer expansion — truncated forms в compute-optimizations.ts

### P2: UI/UX
1. List virtualization — belt (298), ring (366), amulet (427)
2. HomePage hardcoded counts
3. Multi-line mod handling

---

## Приложение: Формат запроса для продолжения

```
Продолжи работу над проектом poe2-regex-ru. Репозиторий: https://github.com/vudirvp-sketch/poe2-regex-ru
План: OPTIMIZER_PLAN.md (версия 1.7)
Текущая фаза: 8 (cross-family FP reduction)
Что сделано: Фазы 0-8 частично. 471 тест, FN=0, cross-family FP=62 (was 77).
Ключевое: repairCrossFamilyFP() ETL step добавлен. Root cause FP после i18n overrides найден.
Следующий шаг: AND-composed regex support для ring minion damage и jewel-desecrated composites.
```
