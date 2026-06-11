# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тесты:** ✅ 830/830 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 18 — рефакторинг ETL pipeline

### Сделано в итерации 18

**compute-regex.ts разбит на 3 модуля:**

| Файл | Строк | Ответственность |
|------|-------|-----------------|
| `compute-regex.ts` | ~270 | Точка входа: типы, `computeMinimalUniqueSubstring`, `computeAllRegexes`, реэкспорты |
| `compute-regex-core.ts` | ~260 | Извлечение шаблонов, проверка уникальности, PoE2-валидация, текстовые утилиты |
| `compute-regex-strategies.ts` | ~480 | Стратегии: substring fallback, word truncation, exclude patterns, yofication |

Все 830 тестов проходят, TypeScript чистый, build успешен. Обратная совместимость сохранена — `compute-optimizations.ts` и тесты продолжают импортировать из `@etl/compute-regex`.

**Обоснование рефакторинга для AI-агентов:** Агент, чинящий exclude patterns, загружает ~480 строк вместо 1421. Контекстное окно — главный ресурс; изоляция стратегий снижает риск случайных правок в соседних функциях.

### Паттерны и алгоритмы

**Компилятор (compiler.ts):** 4 стратегии компиляции — enumerated, threshold, AND-fallback, sign-prefix. 9 верифицированных типов паттернов. Стабилен, рефакторинг не требуется.

**Оптимизатор (optimizer.ts, 740 строк):** Монофайл с 6+ ответственностями. Требует разбиения, но переписывать логику не нужно.

**ETL compute-regex (3 модуля, итого ~1010 строк):** Рефакторинг завершён. Модули изолированы по ответственности.

**UI (useCategoryPage.ts, 1113 строк):** God hook. Рефакторинг не приоритет — единый пайплайн данных, разделение создаст больше проблем (проброс пропсов, order of effects).

---

## План рефакторинга (обновлён)

| # | Область | Приоритет | Суть | Статус |
|---|---------|-----------|------|--------|
| 1 | ETL compute-regex | **Высокий** | Разбить на модули | ✅ Done (iter 18) |
| 2 | Core optimizer | **Средний** | Разбить optimizer.ts на 3-4 модуля | Pending |
| 3 | Data layer | **Средний** | Zod-схемы для CategoryData | Pending |
| 4 | Tests | Низкий | React component tests; расширить ETL coverage | Pending |

**UI рефакторинг отложен:** useCategoryPage — связный пайплайн, разделение нецелесообразно для AI-агентов.

---

## Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак. Без FP от чисел без знака.
2. **`\+` в reversed-паттернах** — `"Редкость предметов.*\+N%"` работает корректно.
3. **`!` item-wide** — если `!молнии|хаосу` находит «молнии» в ЛЮБОМ блоке — весь предмет исключается.
4. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min только. ✅
5. **Middle-number prefix** — `getPrefixForSlot` извлекает текст перед ## для типов 3/9. ✅
6. **`.*` does NOT cross block boundaries** — ✅ Cross-block → AND (`"X" "Y"`).
7. **Substring search** — PoE2 regex = substring match. Truncated words work if the prefix is unique.

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
