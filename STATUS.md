# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/

---

## Текущая итерация: 45 — анализ FP «Приспеш» (forward-only `(?!…)`)

### Резюме

После iter 44 пользователь проверил regex в игре — FP с minion-аффиксом **«Приспешники имеют повышение скорости атаки и сотворения чар»** остался. Анализ показал: фикс iter 44 (per-block `(?!…)` lookahead) — **forward-only**, не видит exclude-паттерны, стоящие **до** суффикса в том же блоке. Симулятор `(?!…)` не моделирует вообще → iter 44 regression test проверял структуру, не семантику.

**Код в этой итерации НЕ менялся** (только docs). Причина: предложенный фикс `^(?!…).*Z` требует in-game verify, что `^` работает внутри `|`-группы (в docs не подтверждено). Принцип «лучше недоделать, чем сломать».

### Корневая причина FP

| Аспект | Описание |
|-------|----------|
| **Симптом** | Regex `повышение скорости атаки(?!.*Приспеш)…` матчит minion-блок «Приспешники имеют … повышение скорости атаки и сотворения чар» |
| **Механика** | Lookahead `(?!.*X)` стоит **после** суффикса → `.*` захватывает только текст **после** позиции → не видит «Приспеш», стоящий **до** суффикса |
| **Ограничение PoE2** | Lookbehind `(?<!…)` НЕ поддерживается (см. §9 AGENT_NAVIGATION.md) |
| **Symptom в симуляторе** | `poe2-regex-matcher.ts` не токенизирует `(?!…)` вообще → regression test iter 44 проверял структуру строки, не поведение |

### Предложенный фикс (для iter 46 — после in-game verify)

**Одна строка в `src/core/compiler.ts`** (normalizeAst, AND-in-OR transform):

```diff
- const mergedValue = `${literalChild.value}${lookaheads}`;
+ const mergedValue = `^${lookaheads}.*${literalChild.value}`;
```

Результат для пользовательского кейса:
```
"^(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми).*повышение скорости атаки|перезарядки умений|передвижения|атаки копьями"
```

| Метрика | iter 44 (текущий) | iter 46 (предложенный) |
|---------|-------------------|------------------------|
| Длина | 192 chars | 195 chars (+3) |
| Forward-excludes (топорами, луками…) | ✅ работает | ✅ работает |
| Backward-excludes (Приспеш до суффикса) | ❌ FP | ✅ работает (`.*` из `^` покрывает весь блок) |
| Nested quotes | нет | нет |
| ≤250 chars | ✅ | ✅ |

**Риск:** требует in-game verify, что `^` работает **внутри `|`-группы** (применяется только к первой альтернативе). В docs `^` верифицирован только для single-quoted `"^28%"` (Phase 9b), не для `"^…|B|C"`.

### Аудит использования in-game verified паттернов

| Паттерн | In-game verified | Используется оптимально? |
|---------|------------------|--------------------------|
| Path D (`prefix.*A\|prefix.*B\|...`) | ✅ iter 41 | ✅ Да |
| `.*` within single block | ✅ iter 37 | ✅ Да |
| `\|` top-level в одной quoted group | ✅ iter 38-41 | ✅ Да |
| `^` start-of-block | ✅ Phase 9b | ⚠️ **Только для RANGE, не для LITERAL с excludes** — главная упущенная возможность |
| `!` item-wide | ✅ iter 14 | ✅ Да (но не в OR-context из-за nested quotes) |
| `(?!…)` per-block | ⚠️ Pitfall 12 (forward-only) | ❌ **Не оптимально** — iter 44 использует без `^`-анкера → forward-only semantic ломается на backward excludes |
| Number enumeration | ✅ Phase 9 | ✅ Да |
| Truncated stems | ✅ iter 37 | ✅ Да |
| Subset-skip opt-entry (iter 44) | n/a (logical) | ✅ Да |

### Известные проблемы

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 1 | **`(?!…)` forward-only** — iter 44 fix пропускает exclude-паттерны, стоящие ДО суффикса в блоке (FP с «Приспеш») | HIGH | OPEN — root cause найден iter 45, фикс предложен (`^(?!…).*Z`), ждет in-game verify |
| 2 | **Симулятор не моделирует `(?!…)`** — `poe2-regex-matcher.ts` не токенизирует lookahead → regression tests проверяют структуру, не семантику | MEDIUM | OPEN — нужен extension tokenizer для `(?!…)` |
| 3 | **`^` в OR-context не верифицирован in-game** — фикс iter 46 требует проверки, что `^` применяется только к первой альтернативе | MEDIUM | PENDING in-game test |
| 4 | **AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE** — compiler порождает nested quotes для этого расширенного shape (rare case, Pitfall 11) | LOW | OPEN |
| 5 | **PoE2 regex char limit ≈ 250 chars** — 2 over-limit entries в jewel | MEDIUM | DIAGNOSTIC iter 42 |

### Оптимальные стратегии (итог)

| Сценарий | Текущая стратегия | Оптимальная стратегия |
|----------|-------------------|----------------------|
| Token с excludes в OR mode | `Z(?!.*X)(?!.*Y)` (iter 44, forward-only → FP) | `^(?!.*X)(?!.*Y).*Z` (iter 46, bidirectional) |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` (item-wide `!`, iter 14) | без изменений — работает корректно |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | без изменений — production-verified iter 41 |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | без изменений — работает корректно |

---

## Предыдущая итерация: 44 — FP-fix: 3 bug fixes (compiler + optimizer)

### Ключевые фиксы iter 44 (PRESERVED, не откатывались)

| # | Bug | Файл | Суть |
|---|-----|------|------|
| 1 | `removeConflictingExcludes` слишком агрессивный | `src/core/core-optimizations.ts` | Surgical: удалять только конфликтующие литералы из OR внутри EXCLUDE |
| 2 | `applyOptimizationTable` не делает subset | `src/core/optimization-strategies.ts` | Skip opt-entry при strict subset для regex с top-level `\|` |
| 3 | Compiler порождает nested quotes когда AND внутри OR | `src/core/compiler.ts` | Transform AND(LITERAL, EXCLUDE) в OR → single LITERAL с per-block lookahead `(?!.*X)` |

**⚠️ Внимание:** Bug 3 fix (iter 44) использует `(?!…)` lookahead, который **forward-only** — см. Known Issue #1 выше. Это не откат фикс iter 44, а refinement для iter 46.

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
| `(?!…)` per-block | ⚠️ | **forward-only** — iter 45 finding. Не видит exclude ДО суффикса в блоке |
| `!` item-wide | ✅ | iter 14; для top-level AND (не внутри OR) |
| `^` start-of-block anchor | ✅ | Phase 9b (single quoted). В OR-context — **не верифицировано**, нужен тест |
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
