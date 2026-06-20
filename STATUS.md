# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 108

---

## Текущее состояние

**iter 108 + post-fix audit: вложенные кавычки в OR-регексах устранены во всех категориях.**

### Симптом (исходный баг)

При выборе в OR-режиме токенов с `regexPrefixContext` компилятор генерил регекс с **вложенными кавычками** внутри внешней OR-группы: `"...\|"провал," "вплоть"\|..."`. PoE2-парсер по правилу B0 (zero matches between quoted groups) такие регексы не подсвечивает ничего.

### Root cause

`normalizeAst` в `src/core/compiler.ts` transform-ил AND-in-OR только для случая с EXCLUDE (iter 49). Случай **без** EXCLUDE (`AND(LITERAL_ctx, LITERAL_regex)`) не покрывался. opt-table Path D маскировал баг для full-family selection, но при partial subset opt-table skip-уется и регекс оставался сломанным.

### Фикс

`normalizeAst` расширен — добавлена ветка для `AND(LITERAL..., LITERAL...)` без EXCLUDE внутри OR. LITERALs мержатся через `.*` bridge в один `LITERAL("A.*B.*...")`. Семантически **более корректно**: same-block AND вместо cross-block AND — именно так и задумывался `regexPrefixContext`.

### Scope фикса (глобальный, не только Бездна)

| Категория | Всего токенов | С regexPrefixContext | iter 108 scope (без exclude) | iter 49 scope (с exclude) |
|-----------|---------------|----------------------|------------------------------|---------------------------|
| amulet | 428 | 19 | 13 | 6 |
| jewel | 193 | 8 | 2 | 6 |
| ring | 369 | 14 | 6 | 8 |
| tablet | 84 | 2 | 2 | 0 |
| relic | 80 | 5 | 5 | 0 |
| jewel-desecrated | 47 | 1 | 1 | 0 |
| **Итого** | **1201** | **49** | **29** | **20** |

Категории `belt`, `jewel-corrupted`, `waystone`, `waystone-desecrated` не имели токенов с `regexPrefixContext` и не были затронуты багом.

### Post-fix аудит (exhaustive)

Аудит-скрипт `/home/z/my-project/scripts/audit-corrected.ts` тестирует 4 сценария на каждой категории:

| Тест | Сценарий | Что проверяет |
|------|----------|---------------|
| T1 | Single-token в OR (минимальный case для iter 108 transform) | Базовая корректность fixed-компилятора |
| T2 | All-tokens в OR (worst-case) | Полная OR-компиляция всей категории |
| T3 | opt-table pre-compiled regexes | ETL-генерированные регексы |
| T4 | Family-AND (top-level AND mode) | Cross-family AND с family-OR внутри |

**Результаты аудита:**

| Метрика | Значение |
|---------|----------|
| Категорий просканировано | 10 |
| Всего токенов | 1697 |
| opt-table entries | 543 |
| **T1 single-token OR: критических нарушений** | **0** |
| **B0 (`"X"\|"Y"` top-level)** | **0** |
| **NESTED (вложенные кавычки)** | **0** |
| **EMPTY_REGEX** | **0** |
| LIMIT (>250 chars, runtime-split handled) | 20 (inherent, не баг) |

**Вывод:** iter 108 фикс **глобально эффективен**. Аналогичных проблем в других категориях нет. LIMIT-overflow обрабатывается runtime-сplit-логикой (iter 50, `splitOverLimitRegex` в `src/core/limits.ts`).

**Метрики тестов:** 1543/1543 (vitest). TSC 0 errors. ESLint 0 problems. JSON не тронуты.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex. Runtime split handles at UI level.
2. **j05iep stays crit** — `jewel.mod_j05iep` имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional.

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Token с regexPrefixContext без regexExclude в OR | `ctx.*Z` (same-block AND) | ✅ iter 108 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |

---

Контакты: Discord **woonderdad**
