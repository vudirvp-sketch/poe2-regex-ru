# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/

---

## Текущая итерация: 46 — `(?!…)` bidirectional fix IMPLEMENTED + in-game verified

### Резюме

iter 45 предложил фикс `^(?!…).*Z` (вместо forward-only `Z(?!…)`). iter 46 — пользователь in-game проверил 3 теста (A/B/C), Tests A+B PASS, Test C подтверждает root cause. Фикс внедрён: одна строка в `src/core/compiler.ts` normalizeAst. 4 iter 44 tests обновлены под новый формат, 2 NEW backward-exclude tests добавлены (minion-блок data). 1108 тестов проходят, TypeScript чистый.

### In-game verification (iter 46)

| Тест | Regex | Результат | Вывод |
|------|-------|-----------|-------|
| **A** (single-quoted baseline) | `"^(?!.*Приспеш).*повышение скорости атаки"` | ✅ PASS — minions НЕ подсвечены, только non-minion блоки | `^`-anchor работает в single-quoted context |
| **B** (OR-context, ключевой) | `"^(?!.*Приспеш).*повышение скорости атаки\|перезарядки умений"` | ✅ PASS — результат идентичен A | `^` работает в OR-context, применяется только к первой альтернативе, НЕ leaks ко второй |
| **C** (control — старый формат iter 44) | `"повышение скорости атаки(?!.*Приспеш)\|перезарядки умений"` | ❌ FP — minion-блоки подсвечены (как и ожидалось) | Подтверждает root cause: forward-only `(?!…)` не видит excludes ДО суффикса |

**Итог:** A+B PASS → фикс `^(?!…).*Z` внедрён. Альтернатива (ETL-level detection tokens) НЕ нужна.

### Фикс iter 46 (IMPLEMENTED)

**Одна строка в `src/core/compiler.ts`** (normalizeAst, AND-in-OR transform):

```diff
- const mergedValue = `${literalChild.value}${lookaheads}`;
+ const mergedValue = `^${lookaheads}.*${literalChild.value}`;
```

**Production regex для пользовательского кейса** (jewel.mod_am4lla + 3 sibling literals):
```
"^(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми).*повышение скорости атаки|перезарядки умений|передвижения|атаки копьями"
```
Длина: 195 chars ≤ 250 ✅

### Аудит использования in-game verified паттернов (iter 46)

| Паттерн | In-game verified | Используется оптимально? |
|---------|------------------|--------------------------|
| Path D (`prefix.*A\|prefix.*B\|...`) | ✅ iter 41 | ✅ Да |
| `.*` within single block | ✅ iter 37 | ✅ Да |
| `\|` top-level в одной quoted group | ✅ iter 38-41 | ✅ Да |
| `^` start-of-block anchor (single-quoted) | ✅ Phase 9b | ✅ Да (RANGE) |
| `^` start-of-block anchor (OR-context) | ✅ **iter 46 Test B** | ✅ Да (LITERAL + excludes с iter 46 fix) |
| `!` item-wide | ✅ iter 14 | ✅ Да (top-level AND) |
| `(?!…)` per-block forward-only | ⚠️ iter 45 (FP root cause) | ✅ **iter 46 FIX** — `^(?!…).*Z` bidirectional |
| Number enumeration | ✅ Phase 9 | ✅ Да |
| Truncated stems | ✅ iter 37 | ✅ Да |
| Subset-skip opt-entry (iter 44) | n/a (logical) | ✅ Да |

### Известные проблемы

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| ~~1~~ | ~~`(?!…)` forward-only FP~~ | ~~HIGH~~ | ✅ **CLOSED iter 46** — fix `^(?!…).*Z` IMPLEMENTED + in-game verified |
| 2 | **Симулятор не моделирует `(?!…)`** — `poe2-regex-matcher.ts` не токенизирует lookahead → regression tests structural, не semantic | MEDIUM | OPEN — нужен extension tokenizer для `(?!…)` (iter 47 todo) |
| ~~3~~ | ~~`^` в OR-context не верифицирован in-game~~ | ~~MEDIUM~~ | ✅ **CLOSED iter 46** — Test B PASS |
| 4 | **AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE** — compiler порождает nested quotes для этого расширенного shape (rare case, Pitfall 11) | LOW | OPEN |
| 5 | **PoE2 regex char limit ≈ 250 chars** — 2 over-limit entries в jewel | MEDIUM | DIAGNOSTIC iter 42 |

### Оптимальные стратегии (итог)

| Сценарий | Стратегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 IMPLEMENTED (bidirectional) |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` (item-wide `!`, iter 14) | ✅ без изменений |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ production-verified iter 41 |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ без изменений |

---

## Предыдущая итерация: 45 — анализ FP «Приспеш» (forward-only `(?!…)`)

Анализ без правок кода: root cause `(?!…)` forward-only, simulator gap, proposed fix `^(?!…).*Z`. См. worklog Task 45.

### Детерминированная стратегия регексов (8 принципов)

| # | Принцип | Описание |
|---|---------|----------|
| 1 | **One Mod = One Quoted Group** | Каждый выбранный мод → одна quoted group |
| 2 | **Multi-Mod = AND Across Blocks** | N модов → N quoted groups через пробел |
| 3 | **`\|` Scope — TOP LEVEL** | `\|` работает только на верхнем уровне одного quoted group |
| 4 | **`.*` Bridging Within Single Block** | `"prefix.*suffix"` мостит число и слова в одном блоке |
| 5 | **Suffix Uniqueness** | Кратчайший suffix, уникальный для мода в категории |
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
| `(?!…)` per-block forward-only | ⚠️ | **iter 46 FIX**: используй `^(?!…).*Z` (bidirectional) |
| `!` item-wide | ✅ | iter 14; для top-level AND (не внутри OR) |
| `^` start-of-block anchor (single-quoted) | ✅ | Phase 9b |
| `^` start-of-block anchor (OR-context) | ✅ | **iter 46 Test B verified** |
| Number enumeration | ✅ | |
| Regex char limit ≈ 250 chars | ⚠️ | diagnostic iter 42 |

### Path D — финальный статус

| Шаг | Статус |
|-----|--------|
| D1 In-game test | ✅ iter 39 |
| D2 ETL + Phase D | ✅ iter 40 |
| D3 regexExclude усечённые основы | ⏳ pre-analysis iter 43, не блокирует |
| D4 Runtime совместимость | ✅ iter 40 |
| D5 Production verification | ✅ iter 41 |
| D6 Все категории | ✅ iter 41 |
| D7 Char-limit diagnostic | ✅ iter 42 |

### SEO-статус: ✅ полный набор реализован

---
Контакты: Discord **woonderdad**
