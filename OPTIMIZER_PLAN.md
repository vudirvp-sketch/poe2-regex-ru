# PoE2 Regex RU — План реализации

> **Версия:** 1.8 | **Дата:** 2026-06-07
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (Session 49)

### Выполнено
- ✅ **Фаза 0-6:** Regex Oracle, number-regex fix, Trie/DP factorization, dialect optimizations, iterative optimizer
- ✅ **Фаза 7 (частично):** 86 hypothesis-driven тестов на реальных предметах
- ✅ **Фаза 8 (частично):** Mixed-conflict excludes, `!(A|B)` format, word truncation, post-i18n-override FP repair
- ✅ **Фаза 9 (Session 49):** AND-composed regex support via `regexPrefixContext` field — ETL + UI + documentation

### Ключевые изменения Session 49
1. **`regexPrefixContext` field** — Новое поле в GameToken, RegexResult, generate-dictionary. Хранит короткую подстроку из префикса шаблона, которая есть ТОЛЬКО в целевом семействе.
2. **`repairCrossFamilyFP()` Step 3** — После excludes ищет regexPrefixContext: слово из префикса шаблона, которое есть во ВСЕХ токенах целевого семейства, но НЕТ в конфликтах.
3. **UI compilation** — `useCategoryPage.ts` компилирует `AND(LITERAL(context), LITERAL(regex))` → `"context" "suffix"` для токенов с regexPrefixContext.
4. **Ожидаемый эффект:** −23 cross-family FP (8 ring minion damage + 15 jewel-desecrated + 4 ring elemental res = 27, но некоторые уже были покрыты excludes).

### Оставшиеся cross-family FP (~39)
| Категория | FP | Причина | Решение |
|-----------|-----|---------|---------|
| amulet | 19 | minion res, minion damage vs flask, corrupted gems | i18n-overrides с explicit regex + regexPrefixContext |
| jewel | 11 | короткие суффиксы ("быстрее", "увеличение урона") | Длинные суффиксы или regexPrefixContext |
| tablet | 3 | "быстрее", generic prefixes | i18n overrides с explicit regex |
| ring | ~0 | (fixed by regexPrefixContext) | — |
| jewel-desecrated | ~0 | (fixed by regexPrefixContext) | — |

---

## Следующие шаги (P1 → P2)

### P1: Amulet 19 FP
Детальный анализ конкретных токенов в amulet.json. Большинство — minion/flask/gem конфликты. Подход: regexPrefixContext + i18n-overrides с explicit regex.

### P1: Jewel 11 FP
Короткие суффиксы — длинять или добавить regexPrefixContext.

### P1: In-game тесты
1. `|` внутри `()` — проверить `"([5-9]|[1-9].)"` в PoE2
2. Number range с `|` — `([6-9][0-9]|[0-9][0-9][0-9])`

### P1: Optimizer expansion
Truncated forms в compute-optimizations.ts — учитывать regexPrefixContext при объединении.

### P2: UI/UX
1. List virtualization — belt (298), ring (366), amulet (427)
2. HomePage hardcoded counts
3. Multi-line mod handling
