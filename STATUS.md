# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/

---

## Текущая итерация: 44 — FP-fix: 3 bug fixes (compiler + optimizer)

### Резюме

По отчёту пользователя о FP в самоцветах найдено и исправлено **3 компаундных бага** в shared-коде (`src/core/`). Все 1106 тестов проходят (1094 + 12 новых). ETL регенерирован без изменений метрик (FN=0). Фиксы применяются глобально ко всем категориям.

### Ключевые фиксы iter 44

| # | Bug | Файл | Суть |
|---|-----|------|------|
| 1 | `removeConflictingExcludes` слишком агрессивный | `src/core/core-optimizations.ts` | Surgical: удалять только конфликтующие литералы из OR внутри EXCLUDE, не весь EXCLUDE |
| 2 | `applyOptimizationTable` не делает subset | `src/core/optimization-strategies.ts` | Skip opt-entry при strict subset (matchedIds < entry.ids.length) — для regex с top-level `\|` |
| 3 | Compiler порождает nested quotes когда AND внутри OR | `src/core/compiler.ts` | Transform AND(LITERAL, EXCLUDE) в OR → single LITERAL с per-block lookahead `(?!.*X)` |

### Что это решает

Пользователь выбрал 4 аффикса на самоцветах (OR mode): «повышение скорости атаки» + «атаки копьями» + «передвижения» + «перезарядки умений». Генератор выдал регекс с FP: совпадали «атаки луками», «атаки самострелами», «накопления шкалы заморозки боевыми посохами», «перезарядки самострела», «перезарядки боевых кличей».

После фиксов регекс:
```
"повышение скорости атаки(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми)|перезарядки умений|передвижения|атаки копьями"
```
TP=4, FP=0, FN=0, TN=6 (verif. в unit-тесте `iter 44 regression`).

### Детерминированная стратегия регексов (8 принципов)

| # | Принцип | Описание |
|---|---------|----------|
| 1 | **One Mod = One Quoted Group** | Каждый выбранный мод → одна quoted group |
| 2 | **Multi-Mod = AND Across Blocks** | N модов → N quoted groups через пробел (same-block AND confirmed iter 41) |
| 3 | **`\|` Scope — TOP LEVEL** | `\|` работает только на верхнем уровне одного quoted group |
| 4 | **`.*` Bridging Within Single Block** | `"prefix.*suffix"` мостит число и слова в одном блоке |
| 5 | **Suffix Uniqueness** | Кратчайший suffix, уникальный для мода в категории (≥3 значимых символов на слово) |
| 6 | **Shared Suffix → Number Enumeration** | `"(1[0-5])%.*suffix"` |
| 7 | **Cross-Block FP Risk** | `"X" "Y"` может-match разные блоки → использовать `.*` bridge |
| 8 | **Same-Family OR → Path D** | `"prefix.*A\|prefix.*B\|prefix.*C"` — production-verified (iter 41). Constraint: ≤250 chars |

### Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | iter 38-41 |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| `\|` многословный внутри `()` | ❌ | nothing matches |
| Пробел = AND (same-block + cross-block) | ✅ | iter 41 |
| `.*` внутри одного блока | ✅ | |
| `(?!…)` per-block | ✅ | iter 44: используется в AND-in-OR для замены item-wide `!` |
| `!` item-wide | ✅ | iter 44: только для top-level AND (не внутри OR) |
| `^` start-of-block anchor | ✅ | |
| Number enumeration | ✅ | |
| Regex char limit ≈ 250 chars | ⚠️ | diagnostic iter 42 |

### Path D — финальный статус

| Шаг | Статус |
|-----|--------|
| D1 In-game test | ✅ iter 39 |
| D2 ETL + Phase D | ✅ iter 40 |
| D3 regexExclude усечённые основы | ⏳ pre-analysis iter 43, не блокирует (iter 44 closed связанный FP) |
| D4 Runtime совместимость | ✅ iter 40 |
| D5 Production verification | ✅ iter 41 |
| D6 Все категории | ✅ iter 41 |
| D7 Char-limit diagnostic | ✅ iter 42 |

### Известные проблемы

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 1 | **AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE** — compiler всё ещё порождает nested quotes для этого расширенного shape | LOW | OPEN (Pitfall 11) — редкий случай, не пользовательский bug |
| 2 | **Симулятор `(?!…)`** — не моделирует per-block semantics | LOW | OPEN |
| 3 | **PoE2 regex char limit ≈ 250 chars** — 2 over-limit entries в jewel | MEDIUM | DIAGNOSTIC iter 42 |
| 4 | **In-game verify iter 44 fixes** — per-block `(?!…)` semantic в OR-context требует живого теста | MEDIUM | PENDING — нужен in-game тест пользователя |

### SEO-статус: ✅ полный набор реализован

---
Контакты: Discord **woonderdad**
