# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 48 — `(?!…)` lookahead tokenizer (simulator semantic regression)

---

## Последний фикс (iter 48)

**Проблема (Known Issue #2):** Симулятор `src/core/poe2-regex-matcher.ts` НЕ моделировал `(?!…)` — `?` молча дропался в `parseSequence` (когда items.length===0), `!` становился block-wide negation. Регрессионные тесты для `(?!…)` были STRUCTURAL (compile-string shape), НЕ semantic.

**Фикс (3 surgical изменения в `src/core/poe2-regex-matcher.ts`):**
1. **Tokenizer:** `(?!` детектится как `lookaheadNegOpen` (вместо groupOpen + optional). Stack-based paren tracking: `)` после lookahead → `lookaheadClose`, иначе `groupClose`.
2. **Parser:** новый AST node `{ type: 'lookaheadNeg', inner }` (zero-width assertion).
3. **Matcher:** `case 'lookaheadNeg'` — succeed iff `inner` НЕ матчит с текущей позиции. Для `^(?!.*X)`: anchored at 0, `.*X` matches iff X есть где-то в блоке → lookahead = bidirectional block-wide absence.

**Tests:** 1118 passing (+10 NEW semantic regression tests для minion-block data в `tests/core/poe2-regex-matcher.test.ts` Section 11). TypeScript clean. Lint clean (no new errors — pre-existing 59 unchanged).

## In-game verification (iter 46 — production form `^(?!…).*Z`)

| Тест | Regex | Результат | Вывод |
|------|-------|-----------|-------|
| **A** (single-quoted baseline) | `"^(?!.*Приспеш).*повышение скорости атаки"` | ✅ PASS | `^`-anchor работает в single-quoted context |
| **B** (OR-context, ключевой) | `"^(?!.*Приспеш).*повышение скорости атаки\|перезарядки умений"` | ✅ PASS | `^` работает в OR-context, применяется только к первой альтернативе, НЕ leaks ко второй |
| **C** (control — старый формат iter 44) | `"повышение скорости атаки(?!.*Приспеш)\|перезарядки умений"` | ❌ FP (expected) | Подтверждает root cause: forward-only `(?!…)` не видит excludes ДО суффикса |

iter 48 semantic regression tests (`tests/core/poe2-regex-matcher.test.ts` Section 11) покрывают Tests A+B сценарии на симуляторе + multi-block item-level matching + multiple lookaheads.

## Известные проблемы (Known Issues)

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| ~~1~~ | ~~`(?!…)` forward-only FP~~ | ~~HIGH~~ | ✅ **CLOSED iter 46** — fix `^(?!…).*Z` IMPLEMENTED + in-game verified |
| ~~2~~ | ~~Симулятор не моделирует `(?!…)`~~ | ~~MEDIUM~~ | ✅ **CLOSED iter 48** — explicit `lookaheadNeg` tokenizer + semantic regression tests |
| ~~3~~ | ~~`^` в OR-context не верифицирован in-game~~ | ~~MEDIUM~~ | ✅ **CLOSED iter 46** — Test B PASS |
| 4 | **AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE** — compiler порождает nested quotes для этого расширенного shape (rare case, AGENT_NAVIGATION §8 Pitfall 11) | LOW | OPEN |
| 5 | **PoE2 regex char limit ≈ 250 chars** — 2 over-limit entries в jewel (317, 260 chars) | MEDIUM | DIAGNOSTIC only — entries kept for subset selection |

## Оптимальные стратегии (итог)

| Сценарий | Стратегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 IMPLEMENTED + iter 48 simulator-modeled |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` (item-wide `!`) | ✅ без изменений |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ production-verified |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ без изменений |

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| `\|` многословный внутри `()` | ❌ | nothing matches |
| Пробел = AND (same-block + cross-block) | ✅ | |
| `.*` внутри одного блока | ✅ | |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` (iter 46) + simulator-modeled (iter 48) |
| `!` item-wide | ✅ | для top-level AND (не внутри OR) |
| `^` start-of-block anchor (single-quoted + OR-context) | ✅ | |
| Number enumeration | ✅ | |
| Regex char limit ≈ 250 chars | ⚠️ | diagnostic-only |

## Path D — финальный статус

| Шаг | Статус |
|-----|--------|
| D1 In-game test | ✅ |
| D2 ETL + Phase D | ✅ |
| D3 regexExclude усечённые основы | ⏳ pre-analysis only, не блокирует |
| D4 Runtime совместимость | ✅ |
| D5 Production verification (5 категорий) | ✅ |
| D6 Все категории | ✅ |
| D7 Char-limit diagnostic | ✅ |

## SEO-статус: ✅ полный набор реализован

См. `docs/SEO_PLAN.md` для ручной верификации GSC/Яндекс/Bing.

---
Контакты: Discord **woonderdad**
