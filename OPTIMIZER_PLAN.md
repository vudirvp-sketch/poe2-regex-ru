# PoE2 Regex RU — План реализации итеративного оптимизатора регексов

> **Версия:** 1.3 | **Дата:** 2026-06-07
> **Назначение:** Этот файл — инструкция для языковой модели / агента. Агент получает этот файл + ссылку на репозиторий и реализует шаги последовательно, останавливаясь на контрольных точках.
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (итерация 35)

### Выполнено
- ✅ **Фаза 0: Regex Oracle** — `src/core/regex-oracle.ts` + 25 тестов
- ✅ **Фаза 1: Исправление number-regex.ts** — `.` → `[0-9]` (30 тестов обновлено)
- ✅ **Фаза 2: Trie-факторизация** — `src/core/trie-factorizer.ts` + 40 тестов
- ✅ **Фаза 3: DP на Trie** — `src/core/dp-factorizer.ts` + 40 тестов
- ✅ **Фаза 4: Диалектные оптимизации + интеграция в ETL** — `applyDialectOptimizations()` + `batchDPFactorize()` интегрированы в `compute-optimizations.ts` и `run-etl.ts`
- ✅ **Фаза 6: Интеграция Trie/DP в ETL** — `batchDPFactorize()` заменяет cross-family LCS, `applyDialectOptimizations()` применяется ко всем optimization entries
- ✅ **Исправление FN багов** — 73 → 4 FN (95% сокращение). Добавлены: `regexMatchesRawText()`, `substringSearchAvoidingParens()`, broadSuffix fallback, template exclusion в substring search

### Не начато
- ⬜ Фаза 5: Итеративный цикл оптимизации
- ⬜ Фаза 7: Игровые тесты
- ⬜ Фаза 8: Финальная полировка
- ⬜ Оставшиеся 4 FN в waystone (strict category — уникальные подстроки содержат `(num—num)`)

---

## 0. Контекст и терминология

### 0.1 Что делает проект сейчас

Проект генерирует регулярные выражения для поиска модификаторов предметов в Path of Exile 2 (PoE2). Пайплайн:

```
fetch-poe2db.ts → normalize.ts → compute-regex.ts → compute-optimizations.ts → optimizer.ts → compiler.ts → "регекс строка"
```

- **compute-regex.ts** — для каждого токена вычисляет минимальный уникальный подстроку. Стратегии: template-family suffix (1), extended suffix (1b), last segment (1b-alt), full template suffix (1c), substring search (2), avoiding-parens (2-alt), broad suffix (last resort).
- **compute-optimizations.ts** — три фазы: family-based grouping (A), DP factorization через `batchDPFactorize()` (B), диалектные оптимизации через `applyDialectOptimizations()` (C).
- **optimizer.ts (runtime)** — дедуплицирует одинаковые регексы, применяет таблицу оптимизаций.
- **regex-oracle.ts** — валидирует регекс против набора целевых и исключаемых текстов.
- **dp-factorizer.ts** — DP на Trie + диалектные оптимизации (`[её]`, `[юя]`, `ь?`).

### 0.2 Диалект PoE2 regex — проверенные в игре факты

| Фича | Поведение | Влияние на оптимизатор |
|------|-----------|----------------------|
| `.` | Матчит ЛЮБОЙ символ | Использовать с осторожностью |
| `[0-9]` | Матчит только цифру | Используется в числовых паттернах |
| `()` | ГРУППИРОВКА (не литерал!) | Регексы не должны содержать `(...)` — PoE2 интерпретирует как группу |
| `[]` | Класс символов | `[её]`, `[юя]` для диалекта |
| `?` | Опциональность | Для опциональных окончаний |
| `#` | Литерал `#` | НЕ использовать `##` из шаблона в регексе! |
| Лимит | **250 символов** | Оптимизатор следит за лимитом |

### 0.3 Ключевые исправления в итерации 35

1. **`regexMatchesRawText()`** — проверка регекса через PoE2 движок (`matchQuotedGroup`). Ловит `(...)` группировку и `##` из шаблонов.
2. **`substringSearchAvoidingParens()`** — поиск уникальных подстрок без `(` и `)`.
3. **Broad suffix fallback** — если все стратегии не дают регекс проходящий `regexMatchesRawText`, используется суффикс шаблона (даже если не уникален).
4. **Template exclusion** — в substring search fallback шаблон (содержащий `##`) исключён из поиска.
5. **DP factorization в compute-optimizations** — `batchDPFactorize()` для cross-family оптимизаций.

---

## 1-4. Фазы 0-4 ✅ ВЫПОЛНЕНЫ

## 5. Фаза 5 ⬜ НЕ НАЧАТА

## 6. Фаза 6 ✅ ВЫПОЛНЕНА

### Результат
- `compute-optimizations.ts` обновлён:
  - Phase A: Family-based grouping (без изменений)
  - Phase B: `batchDPFactorize()` заменяет cross-family LCS
  - Phase C: `applyDialectOptimizations()` применяется ко всем entries
- `run-etl.ts` обновлён: Step 3b — диалектные оптимизации к individual regexes
- `tests/etl/compute-optimizations.test.ts` — 8 тестов (было 3)

---

## Приложение B: Файловая структура

```
src/core/
  trie-factorizer.ts     — Trie + факторизация (Фаза 2) ✅
  dp-factorizer.ts       — DP на Trie + диалект (Фазы 3+4) ✅
  regex-oracle.ts        — Валидатор (Фаза 0) ✅
  number-regex.ts        — ИСПРАВЛЕННЫЙ (Фаза 1) ✅
  poe2-regex-matcher.ts  — PoE2 regex движок (без изменений)
  optimizer.ts           — runtime оптимизатор (без изменений)
  compiler.ts            — компилятор AST (без изменений)

scripts/etl/
  compute-regex.ts       — ОБНОВЛЁН: regexMatchesRawText, substringSearchAvoidingParens, broadSuffix
  compute-optimizations.ts — ОБНОВЛЁН: batchDPFactorize + applyDialectOptimizations
  generate-dictionary.ts — без изменений
  normalize.ts           — без изменений
  fetch-poe2db.ts        — без изменений
  i18n-overrides.json    — без изменений

scripts/
  run-etl.ts             — ОБНОВЛЁН: Step 3b диалектные оптимизации

tests/
  etl/compute-optimizations.test.ts — ОБНОВЛЁН: 8 тестов (было 3)
  остальные без изменений
```

---

## Приложение C: Критерии остановки

Агент ДОЛЖЕН остановиться после каждой контрольной точки (✋).

### Формат запроса для продолжения

```
Продолжи работу над проектом poe2-regex-ru. Репозиторий: https://github.com/vudirvp-sketch/poe2-regex-ru
План: [содержимое этого файла]
Текущая фаза: 5 (итеративный цикл оптимизации) / 7 (игровые тесты)
Что сделано: Фазы 0-4, 6 выполнены. FN: 73→4. 323 теста проходят.
Команды: cd poe2-regex-ru && pnpm install && pnpm build && npx vitest run --root .
```
