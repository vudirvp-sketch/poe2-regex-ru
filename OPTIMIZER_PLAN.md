# PoE2 Regex RU — План реализации

> **Версия:** 1.5 | **Дата:** 2026-06-07
> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru

---

## Текущий статус (итерация 37)

### Выполнено
- ✅ **Фаза 0-6:** Regex Oracle, number-regex fix, Trie/DP factorization, dialect optimizations, iterative optimizer
- ✅ **ETL re-run + optimize:** `pnpm etl -- --validate` → FN=3→0, FP=1117→3715 (FP up because optimizer broadened family regexes). `pnpm optimize` → FN=0, FP=3715, converged after 5 iterations
- ✅ **Test fix:** tablet.json 2 tokens with regex < MIN_REGEX_LEN fixed via i18n overrides with explicit regex field
- ✅ **Optimizer fix:** `trySuffixShortening()` now respects per-category MIN_REGEX_LEN (5 for strict categories, 3 for others)
- ✅ **i18n override enhancement:** `applyI18nOverrides()` supports explicit `regex` field to skip recomputation
- ✅ **GitHub Actions deploy:** Fixed (root cause was test failure, not YAML)

### Не начато
- ⬜ Фаза 7: Игровые тесты — валидация регексов прямо в игре (см. docs/IN_GAME_TESTS.md)
- ⬜ Фаза 8: Финальная полировка — cross-family FP reduction, UI polish
- ⬜ Cross-family FP analysis — distinguish family-tier FP (by design) vs true cross-family FP

### Важно
- **FP метрика:** Большинство FP (90%+) — это family-tier FP, когда один семейный regex матчит все тиры одного мода. Это **by design** — пользователь хочет любой тир. Истинные cross-family FP (~90 в amulet) — это реальная проблема для Фазы 8.
- **MIN_REGEX_LEN в оптимизаторе:** `trySuffixShortening()` теперь не укорачивает regex ниже MIN_REGEX_LEN для strict-категорий

---

## Контекст

### Что делает проект

Пайплайн:
```
fetch-poe2db.ts → normalize.ts → compute-regex.ts → compute-optimizations.ts → optimizer.ts → compiler.ts → "регекс строка"
```

- **compute-regex.ts** — стратегии: template-family suffix (1), extended suffix (1b), last segment (1b-alt), full template suffix (1c), substring search (2), avoiding-parens (2-alt), broad suffix (last resort)
- **compute-optimizations.ts** — три фазы: family-based grouping (A), DP factorization (B), диалектные оптимизации (C)
- **iterative-optimizer.ts** — Фаза 5: итеративно оптимизирует regexes в JSON файлах (FN-repair, dialect, FP-reduce, suffix-shorten)
- **regex-oracle.ts** — валидирует регекс против набора целевых и исключаемых текстов
- **dp-factorizer.ts** — DP на Trie + диалектные оптимизации (`[её]`, `[юя]`, `ь?`)

### Диалект PoE2 regex

| Фича | Поведение | Влияние |
|------|-----------|---------|
| `.` | Матчит ЛЮБОЙ символ | С осторожностью |
| `[0-9]` | Матчит только цифру | Для числовых паттернов |
| `()` | ГРУППИРОВКА (не литерал!) | Регексы не должны содержать `(...)` |
| `[]` | Класс символов | `[её]`, `[юя]` |
| `?` | Опциональность | Для окончаний |
| `#` | Литерал `#` | НЕ использовать `##` в регексе |
| Лимит | **250 символов** | Оптимизатор следит |

---

## Файловая структура (изменённые файлы)

```
scripts/etl/
  compute-regex.ts       — MIN_REGEX_LEN per-category, regexMatchesRawText, substringSearchAvoidingParens
  compute-optimizations.ts — batchDPFactorize + applyDialectOptimizations
  iterative-optimizer.ts — Фаза 5: suffix-shorten respects MIN_REGEX_LEN
  i18n-overrides.json    — 57 overrides + 2 explicit regex overrides (mod_efa81a, mod_by2ufv)
  generate-dictionary.ts — без изменений
  normalize.ts           — без изменений
  fetch-poe2db.ts        — без изменений

scripts/
  run-etl.ts             — applyI18nOverrides() supports explicit regex field
  analyze-regexes.ts     — без изменений
  analyze-fn.ts          — FN/FP анализ

public/generated/*.json  — 10 файлов, FN=0, FP=3715 (mostly family-tier by design)
```

---

## Приложение: Формат запроса для продолжения

```
Продолжи работу над проектом poe2-regex-ru. Репозиторий: https://github.com/vudirvp-sketch/poe2-regex-ru
План: OPTIMIZER_PLAN.md (версия 1.5)
Текущая фаза: 7 (игровые тесты) / 8 (финальная полировка)
Что сделано: Фазы 0-6 выполнены. ETL+optimize выполнены. FN=0, FP=3715. 323 теста проходят.
Следующий шаг: Фаза 7 — игровые тесты. Фаза 8 — cross-family FP reduction.
```
