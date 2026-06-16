# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 46 — `^(?!…).*Z` bidirectional exclude (in-game verified)

---

## Последний фикс (iter 46)

**Проблема:** iter 44 fix `X(?!.*A)(?!.*B)` был forward-only — FP, когда exclude-значение `A` предшествовало суффиксу `X` в том же блоке (миньон-аффикс «Приспешники имеют … повышение скорости атаки»).

**Фикс (1 строка в `src/core/compiler.ts` `normalizeAst`):**
```diff
- const mergedValue = `${literalChild.value}${lookaheads}`;
+ const mergedValue = `^${lookaheads}.*${literalChild.value}`;
```
Теперь produces `^(?!.*A)(?!.*B).*X` — `^`-anchor + `.*` bridge = bidirectional exclude. In-game verified (Tests A+B PASS, Test C подтверждает root cause). Works in OR-context (`^` применяется только к первой альтернативе, не leaks).

**Production regex для пользовательского кейса** (jewel.mod_am4lla + 3 sibling literals): `"^(?!.*Приспеш)(?!.*топорами)(?!.*луками)(?!.*самострелами)(?!.*кинжалами)(?!.*посохами)(?!.*мечами)(?!.*без)(?!.*боевыми).*повышение скорости атаки|перезарядки умений|передвижения|атаки копьями"` (195 chars ≤250 ✅).

**Tests:** 1108 passing (+2 NEW backward-exclude regression tests для minion-блок data). TypeScript clean.

## In-game verification (iter 46)

| Тест | Regex | Результат | Вывод |
|------|-------|-----------|-------|
| **A** (single-quoted baseline) | `"^(?!.*Приспеш).*повышение скорости атаки"` | ✅ PASS | `^`-anchor работает в single-quoted context |
| **B** (OR-context, ключевой) | `"^(?!.*Приспеш).*повышение скорости атаки\|перезарядки умений"` | ✅ PASS | `^` работает в OR-context, применяется только к первой альтернативе, НЕ leaks ко второй |
| **C** (control — старый формат iter 44) | `"повышение скорости атаки(?!.*Приспеш)\|перезарядки умений"` | ❌ FP (expected) | Подтверждает root cause: forward-only `(?!…)` не видит excludes ДО суффикса |

## Известные проблемы (Known Issues)

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| ~~1~~ | ~~`(?!…)` forward-only FP~~ | ~~HIGH~~ | ✅ **CLOSED iter 46** — fix `^(?!…).*Z` IMPLEMENTED + in-game verified |
| 2 | **Симулятор не моделирует `(?!…)`** — `poe2-regex-matcher.ts` не токенизирует lookahead → regression tests structural, не semantic | MEDIUM | OPEN — iter 47 todo |
| ~~3~~ | ~~`^` в OR-context не верифицирован in-game~~ | ~~MEDIUM~~ | ✅ **CLOSED iter 46** — Test B PASS |
| 4 | **AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE** — compiler порождает nested quotes для этого расширенного shape (rare case, AGENT_NAVIGATION §8 Pitfall 11) | LOW | OPEN |
| 5 | **PoE2 regex char limit ≈ 250 chars** — 2 over-limit entries в jewel (317, 260 chars) | MEDIUM | DIAGNOSTIC only — entries kept for subset selection |

## Оптимальные стратегии (итог)

| Сценарий | Стратегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 IMPLEMENTED (bidirectional) |
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
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` (iter 46) |
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
