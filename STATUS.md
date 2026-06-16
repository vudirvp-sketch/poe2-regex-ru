# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 49 — Pitfall 11 fix (multi-LITERAL AND-in-OR + EXCLUDE)

---

## Последний фикс (iter 49)

**Проблема (Known Issue #4 / Pitfall 11):** Compiler transform в `src/core/compiler.ts` `normalizeAst` покрывал только `AND(LITERAL, EXCLUDE)` с РОВНО ОДНИМ LITERAL + одним EXCLUDE. Когда токен имеет ОБА `regexPrefixContext` И `regexExclude` (6 cases в amulet, 6 в jewel, 8 в ring — minion mods), `buildLiteralNode` порождает `AND(LITERAL_ctx, LITERAL_regex, EXCLUDE(...))` (3 child). В OR-context это компилировалось в nested quotes (`"ctx" "regex" "!A|B"|other`), которые PoE2 не парсит.

**Фикс (1 surgical изменение в `src/core/compiler.ts` `normalizeAst` case 'OR'):**
- Заменена проверка `child.children.length !== 2` на более гибкую: ≥1 LITERAL + ровно 1 EXCLUDE + все остальные child — LITERAL/EXCLUDE (без RANGE/AND/MULTI_RANGE).
- LITERALs мерджатся через `.*` bridges: `^(?!.*A).*ctx.*regex` (same-block semantic — корректно для minion mods, где prefix context "имеют" и suffix "повышение..." в одном mod block).
- tokenId preservation: берётся первый LITERAL с tokenId (regex LITERAL; context LITERAL обычно без tokenId).

**Tests:** 1132 passing (+14 NEW: 4 structural в `tests/core/optimizer.test.ts` + 10 semantic в `tests/core/poe2-regex-matcher.test.ts` Section 12). TypeScript clean. Lint clean (no new errors — actually −1: убран `any` cast через proper type guards).

## In-game verification (iter 46 — production form `^(?!…).*Z`)

iter 49 использует ту же production form `^(?!…).*Z`, что была верифицирована in-game в iter 46 (Test A single-quoted PASS + Test B OR-context PASS + Test C confirms old FP). iter 49 расширяет transform на multi-LITERAL case — semantic tests на симуляторе покрывают new case. In-game verification iter 49 не требуется (та же form, только с `.*` bridge между LITERALs — `.*` bridge уже был верифицирован как same-block работа в Path D iter 38+).

## Известные проблемы (Known Issues)

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| ~~1~~ | ~~`(?!…)` forward-only FP~~ | ~~HIGH~~ | ✅ **CLOSED iter 46** — fix `^(?!…).*Z` IMPLEMENTED + in-game verified |
| ~~2~~ | ~~Симулятор не моделирует `(?!…)`~~ | ~~MEDIUM~~ | ✅ **CLOSED iter 48** — explicit `lookaheadNeg` tokenizer + semantic regression tests |
| ~~3~~ | ~~`^` в OR-context не верифицирован in-game~~ | ~~MEDIUM~~ | ✅ **CLOSED iter 46** — Test B PASS |
| ~~4~~ | ~~AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE — nested quotes~~ | ~~LOW~~ | ✅ **CLOSED iter 49** — multi-LITERAL transform + semantic tests |
| 5 | **PoE2 regex char limit ≈ 250 chars** — 2 over-limit entries в jewel (317, 260 chars) | MEDIUM | OPEN — diagnostic-only, entries kept for subset selection. Next iter: ETL split-logic OR runtime UI split |

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 IMPLEMENTED + iter 48 simulator-modeled |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` (item-wide `!`) | ✅ без изменений |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ production-verified |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ без изменений |
| **Token с regexPrefixContext + regexExclude в OR mode** | `^(?!.*X).*ctx.*Z` | ✅ **iter 49 IMPLEMENTED** |

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| `\|` многословный внутри `()` | ❌ | nothing matches |
| Пробел = AND (same-block + cross-block) | ✅ | |
| `.*` внутри одного блока | ✅ | |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` (iter 46) + simulator-modeled (iter 48) + multi-LITERAL (iter 49) |
| `!` item-wide | ✅ | для top-level AND (не внутри OR) |
| `^` start-of-block anchor (single-quoted + OR-context) | ✅ | |
| Number enumeration | ✅ | |
| Regex char limit ≈ 250 chars | ⚠️ | diagnostic-only — Known Issue #5 OPEN |

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
