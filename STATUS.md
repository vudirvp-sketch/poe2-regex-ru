# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тесты:** ✅ 830/830 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 17 — фикс деплоя + план рефакторинга

### Деплой: исправлено

Деплой падал из-за 2 тестов с устаревшими ожиданиями:
1. `buildAstFromSelections.test.ts` — #% token теперь корректно получает middle-number prefix «На» (раньше тест ожидал отсутствие префикса)
2. `vendor-regex-equivalence.test.ts` — «хаосу» корректно truncируется оптимизатором до «хаос» (в TRUNCATED_TAILS_SAFE)

### Паттерны и алгоритмы

**Компилятор (compiler.ts):** 4 стратегии компиляции — enumerated, threshold, AND-fallback, sign-prefix. 9 верифицированных типов паттернов. Работает стабильно, рефакторинг не требуется.

**Оптимизатор (optimizer.ts, 782 строк):** Монофайл с 6+ ответственностями (dedup, opt-table, truncation, context, excludes, collapsed IDs). Требует разбиения на модули, но переписывать логику не нужно.

**ETL (compute-regex.ts, 1421 строк):** Самый хрупкий участок. Содержит 8-10 ответственностей в одном файле. HTML-парсинг зависит от структуры poe2db.tw — любое изменение HTML ломает парсинг молча.

**UI (useCategoryPage.ts, 1113 строк):** God hook — загрузка данных, состояние, AST-построение, компиляция, диапазоны. Два параллельных ModList. FilterChip перегружен.

---

## План рефакторинга (приоритет)

| # | Область | Приоритет | Суть | Срок |
|---|---------|-----------|------|------|
| 1 | ETL pipeline | **Высокий** | Разбить compute-regex.ts на 5-6 модулей; schema-валидация HTML; убрать new Function() | 4-6 нед. |
| 2 | UI layer | **Высокий** | Расщепить useCategoryPage на 4-5 хуков; объединить ModList; вынести RangeInputPanel из FilterChip | 3-4 нед. |
| 3 | Core engine | **Средний** | Разбить optimizer.ts на 3-4 модуля; декомпозировать RANGE god-type | 2-3 нед. |
| 4 | Data layer | **Средний** | Zod-схемы для CategoryData; упростить Record<Locale, string>; split mod-classifier.ts | 2-3 нед. |
| 5 | Tests | Низкий | React component tests; расширить ETL coverage | 1-2 нед. |

**Стоит ли переписывать генератор регекса?** Нет — текущий алгоритм работает корректно, все 9 типов паттернов верифицированы в игре. Нужен рефакторинг структуры (разбиение монолитов), а не переписывание логики.

**Стоит ли переписывать оптимизатор?** Нет — итеративный оптимизатор с Oracle-валидацией работает. Нужна реструктуризация (модули вместо монолита), но алгоритм менять не нужно.

**UI и интерфейс сайта?** Рефакторинг — да, переписывание — нет. Архитектура React+Zustand+Vite адекватна. Проблема в god-hook и дублировании компонентов, а не в выборе технологий.

---

## Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак. Без FP от чисел без знака.
2. **`\+` в reversed-паттернах** — `"Редкость предметов.*\+N%"` работает корректно.
3. **`!` item-wide** — если `!молнии|хаосу` находит «молнии» в ЛЮБОМ блоке — весь предмет исключается.
4. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min только. ✅ T2 verified.
5. **Middle-number prefix** — `getPrefixForSlot` извлекает текст перед ## для типов 3/9. ✅
6. **`.*` does NOT cross block boundaries** — ✅ T3 confirmed. Cross-block → AND (`"X" "Y"`).
7. **Substring search** — PoE2 regex = substring match. Truncated words work if the prefix is unique within game context.

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
