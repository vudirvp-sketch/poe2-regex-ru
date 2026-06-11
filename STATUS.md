# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тесты:** ✅ 830/830 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 20 — Data safety & validation

### Сделано в итерации 20

**1. Zod-схемы для CategoryData (`src/shared/schemas.ts`):**

| Схема | Покрытие |
|-------|----------|
| `CategoryDataSchema` | Валидация JSON на границе ETL→runtime |
| `GameTokenSchema` | Все поля, включая optional (regexExclude, regexPrefixContext, jewelType, tradeStatId) |
| `OptimizationEntrySchema` | ids, regex, weight, count + optional context/exclude |
| `GenderFormsSchema` | 6 форм рода, все optional |
| Enum schemas | Locale, AffixType, ModOrigin, JewelType, PriorityTier, PriorityFilter |

Интеграция: `loader.ts` → `CategoryDataSchema.parse(raw)` при каждой загрузке JSON.
Все 10 файлов в `public/generated/` валидируются без ошибок.

**2. Удалён `new Function()` из `parse-modifiers-calc.ts`:**

Заменён на безопасный `sanitizeJsObjectLiteral()` — строковый санитайзер JS→JSON:
- Удаляет trailing commas перед `}` / `]`
- Котирует некотируемые ключи (`{name: ...}` → `{"name": ...}`)
- Заменяет одинарные кавычки на двойные

Результат: `JSON.parse()` вместо `eval`/`new Function`. Потенциальная дыра безопасности закрыта.

### Паттерны и алгоритмы

**Компилятор (compiler.ts):** 4 стратегии компиляции — enumerated, threshold, AND-fallback, sign-prefix. 9 верифицированных типов паттернов. Стабилен.

**Оптимизатор (3 модуля, ~780 строк):** Рефакторинг завершён (iter 19). `optimizer → strategies → core`.

**ETL compute-regex (3 модуля, ~1010 строк):** Рефакторинг завершён (iter 18).

**UI (useCategoryPage.ts, 1113 строк):** God hook. Рефакторинг отложен — единый пайплайн, разделение создаст больше проблем.

---

## План рефакторинга (обновлён)

| # | Область | Приоритет | Суть | Статус |
|---|---------|-----------|------|--------|
| 1 | ETL compute-regex | **Высокий** | Разбить на модули | ✅ Done (iter 18) |
| 2 | Core optimizer | **Средний** | Разбить optimizer.ts на 3 модуля | ✅ Done (iter 19) |
| 3 | Data layer | **Средний** | Zod-схемы для CategoryData | ✅ Done (iter 20) |
| 4 | Security | **Средний** | Убрать `new Function()` | ✅ Done (iter 20) |
| 5 | Tests | Низкий | React component tests; расширить ETL coverage | Pending |

**UI рефакторинг отложен:** useCategoryPage — связный пайплайн, разделение нецелесообразно.

---

## Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак. Без FP от чисел без знака.
2. **`\+` в reversed-паттернах** — `"Редкость предметов.*\+N%"` работает корректно.
3. **`!` item-wide** — если `!молнии|хаосу` находит «молнии» в ЛЮБОМ блоке — весь предмет исключается.
4. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min только.
5. **`.*` does NOT cross block boundaries** — Cross-block → AND (`"X" "Y"`).
6. **Substring search** — PoE2 regex = substring match. Truncated words work if the prefix is unique.

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
