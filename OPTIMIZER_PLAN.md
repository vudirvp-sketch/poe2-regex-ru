# PoE2 Regex RU — План реализации итеративного оптимизатора регексов

> **Версия:** 1.4 | **Дата:** 2026-06-07
> **Назначение:** Этот файл — инструкция для языковой модели / агента. Агент получает этот файл + ссылку на репозиторий и реализует шаги последовательно, останавливаясь на контрольных точках.
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (итерация 36)

### Выполнено
- ✅ **Фаза 0: Regex Oracle** — `src/core/regex-oracle.ts` + 25 тестов
- ✅ **Фаза 1: Исправление number-regex.ts** — `.` → `[0-9]` (30 тестов обновлено)
- ✅ **Фаза 2: Trie-факторизация** — `src/core/trie-factorizer.ts` + 40 тестов
- ✅ **Фаза 3: DP на Trie** — `src/core/dp-factorizer.ts` + 40 тестов
- ✅ **Фаза 4: Диалектные оптимизации + интеграция в ETL** — `applyDialectOptimizations()` + `batchDPFactorize()` интегрированы в `compute-optimizations.ts` и `run-etl.ts`
- ✅ **Фаза 5: Итеративный цикл оптимизации** — `scripts/etl/iterative-optimizer.ts` создан. Стратегии: FN-repair, dialect, FP-reduce, suffix-shorten
- ✅ **Фаза 6: Интеграция Trie/DP в ETL** — `batchDPFactorize()` заменяет cross-family LCS, `applyDialectOptimizations()` применяется ко всем optimization entries
- ✅ **Исправление FN багов** — 73 → 4 FN (95% сокращение). Добавлены: `regexMatchesRawText()`, `substringSearchAvoidingParens()`, broadSuffix fallback, template exclusion в substring search
- ✅ **Waystone FN fix** — `MIN_REGEX_LEN_STRICT` снижен с 10 до 7 для waystone/waystone-desecrated (позволяет находить paren-free подстроки)
- ✅ **TypeScript fixes** — убраны unused vars в `compute-optimizations.ts` и `run-etl.ts`

### Не начато
- ⬜ Фаза 7: Игровые тесты — валидация регексов прямо в игре (см. docs/IN_GAME_TESTS.md)
- ⬜ Фаза 8: Финальная полировка
- ⬜ Перегенерация JSON через ETL — после code-fixes нужно запустить `pnpm etl -- --validate` чтобы обновить public/generated/*.json
- ⬜ Запуск `pnpm optimize` на свежих данных для итеративной оптимизации

### Важно
- **public/generated/*.json — УСТАРЕЛИ!** Файлы не перегенерированы после code-fixes (regexMatchesRawText, substringSearchAvoidingParens, MIN_REGEX_LEN_STRICT=7). Для обновления: `pnpm etl -- --validate`
- FN в устаревших данных: 73 (amulet=27, jewel-desecrated=15, jewel=5, waystone=10, ring=12, relic=2, tablet=1, waystone-desecrated=1)
- После перегенерации ETL + optimize ожидается FN ≈ 0-4

---

## 0. Контекст и терминология

### 0.1 Что делает проект сейчас

Пайплайн:
```
fetch-poe2db.ts → normalize.ts → compute-regex.ts → compute-optimizations.ts → optimizer.ts → compiler.ts → "регекс строка"
```

- **compute-regex.ts** — стратегии: template-family suffix (1), extended suffix (1b), last segment (1b-alt), full template suffix (1c), substring search (2), avoiding-parens (2-alt), broad suffix (last resort)
- **compute-optimizations.ts** — три фазы: family-based grouping (A), DP factorization (B), диалектные оптимизации (C)
- **iterative-optimizer.ts** — Фаза 5: итеративно оптимизирует regexes в JSON файлах
- **regex-oracle.ts** — валидирует регекс против набора целевых и исключаемых текстов
- **dp-factorizer.ts** — DP на Trie + диалектные оптимизации (`[её]`, `[юя]`, `ь?`)

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

---

## 1-6. Фазы 0-6 ✅ ВЫПОЛНЕНЫ

## 5. Фаза 5 ✅ ВЫПОЛНЕНА

### Результат
- `scripts/etl/iterative-optimizer.ts` — итеративный оптимизатор:
  - Strategy 1: FN-repair — исправление FN через broadSuffix, substring search
  - Strategy 2: Dialect — `[её]`, `[юя]`, `ь?` оптимизации
  - Strategy 3: FP-reduce — удлиннение regex для уменьшения FP
  - Strategy 4: Suffix-shorten — укорочение regex при 0 FP
  - Table re-optimization через `batchDPFactorize()`
  - Флаги: `--max-iterations N`, `--dry-run`, `--verbose`
- `scripts/analyze-fn.ts` — анализ FN/FP по категориям
- `package.json` — новые скрипты: `pnpm optimize`, `pnpm optimize:dry`, `pnpm analyze-fn`
- `compute-regex.ts` — `STRICT_CATEGORIES_MIN_LEN`: waystone=7, waystone-desecrated=7, tablet=10, jewel-desecrated=10

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
  compute-regex.ts       — ОБНОВЛЁН: MIN_REGEX_LEN per-category, regexMatchesRawText, substringSearchAvoidingParens, broadSuffix
  compute-optimizations.ts — ОБНОВЛЁН: batchDPFactorize + applyDialectOptimizations, unused longestCommonSubstring помечен
  iterative-optimizer.ts — НОВЫЙ: Фаза 5 — итеративная оптимизация regexes
  generate-dictionary.ts — без изменений
  normalize.ts           — без изменений
  fetch-poe2db.ts        — без изменений
  i18n-overrides.json    — без изменений

scripts/
  run-etl.ts             — ОБНОВЛЁН: unused var fix
  analyze-regexes.ts     — без изменений
  analyze-fn.ts          — НОВЫЙ: FN/FP анализ

tests/
  etl/compute-optimizations.test.ts — 8 тестов
  остальные без изменений
```

---

## Приложение C: Критерии остановки

Агент ДОЛЖЕН остановиться после каждой контрольной точки (✋).

### Формат запроса для продолжения

```
Продолжи работу над проектом poe2-regex-ru. Репозиторий: https://github.com/vudirvp-sketch/poe2-regex-ru
План: OPTIMIZER_PLAN.md (версия 1.4)
Текущая фаза: 7 (игровые тесты) / 8 (финальная полировка)
Что сделано: Фазы 0-6 выполнены. FN: 73→~0-4 (после ETL re-run). 323 теста проходят.
Команды: cd poe2-regex-ru && pnpm install && pnpm build && npx vitest run --root .
Следующий шаг: pnpm etl -- --validate → pnpm optimize → проверить FN/FP
```
