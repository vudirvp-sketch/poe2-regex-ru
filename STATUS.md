# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тесты:** ✅ 954/954 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 23 — Full pipeline audit + ETL truncation fix

### Сделано в итерации 23

**1. Полный аудит пайплайна на аналогичные баги**

Аудит всех стадий (runtime + ETL) на паттерн «слепая замена подстроки, ломающая contiguous substring matching»:
- ✅ `truncateSuffix()` (runtime Phase 3) — исправлено в iter 22, `endsWith()` работает корректно
- ✅ `tryWordTruncation()` (ETL Strategy 1e) — безопасен, валидирует через `matchQuotedGroup()`
- ✅ `computeOptimizations()` Phase A1 — безопасен, валидирует через `matchQuotedGroup()`
- ✅ `dp-factorizer.ts` — диалектные оптимизации `[её]`, `[юя]`, `(ь|)` безопасны
- ✅ `computeExcludePatterns()` — `.includes()` используется правильно (проверка вхождения подстроки)
- ✅ `iterative-optimizer.ts` — `trySuffixShortening()` валидирует через `matchQuotedGroup()`
- ⚠️ **Найден latent bug:** `generateTruncatedSuffixes()` генерировал mid-phrase truncation candidates через cartesian product — отфильтровывались валидацией, но нарушали документированное поведение и тратили ресурсы

**2. Фикс: generateTruncatedSuffixes() — только LAST word truncation**

Замена cartesian product на last-word-only truncation:
- Phase 1: только последнее слово суффикса усекается
- Phase 2: после удаления leading words — только последнее слово оставшейся фразы усекается
- Удалён мёртвый код `cartesianProduct()`
- Добавлены 7 новых тестов для `generateTruncatedSuffixes`

**Почему безопасно:** truncation НЕ-last слова в фразе создаёт разрыв (gap), ломающий contiguous substring matching PoE2. Например: `"к сопротивлен огню"` ≠ substring of `"к сопротивлению огню"` — "ению" между "сопротивлен" и " огню" создаёт разрыв.

---

## Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак. Без FP от чисел без знака.
2. **`!` item-wide** — если `!молнии|хаосу` находит «молнии» в ЛЮБОМ блоке — весь предмет исключается.
3. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min только.
4. **`.*` does NOT cross block boundaries** — Cross-block → AND (`"X" "Y"`).
5. **Substring search** — PoE2 regex = contiguous substring match. Word truncation works ONLY at END of suffix/phrase. Mid-phrase truncation breaks matching.

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
