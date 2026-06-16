# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 50 — Known Issue #5 runtime split + ETL context bug fix

---

## Последний фикс (iter 50)

**Проблема 1 (ETL Bug):** `patchOptimizationEntries()` в `scripts/run-etl.ts` некорректно добавляла `regexPrefixContext` к opt-table записям, где часть токенов имела контекст, а часть — нет. Условие `contexts.size <= 2 && contexts.has('')` считало это "все токены имеют одинаковый контекст" — но это FN: не-миньонные альтернативы ошибочно требовали "имеют". Пример: 11 "увеличение" токенов (только 2 с regexPrefixContext "имеют") → opt entry получала `regexPrefixContext: "имеют"` → компилятор требовал "имеют" для всех 11 альтернатив.

**Фикс 1:** Усилено условие: `contexts.size === 1` (ВСЕ токены должны иметь ОДИНАКОВЫЙ непустой контекст). Смешанные контексты (непустой + пустой) больше не патчатся.

**Проблема 2 (Known Issue #5):** 2 over-limit записи в jewel (317 и 260 chars) превышают PoE2 лимит 250 chars. Пользователь не мог скопировать и использовать regex.

**Фикс 2:** Runtime split — когда скомпилированный regex >250 chars и содержит top-level `|`, `splitOverLimitRegex()` в `src/core/limits.ts` разбивает его на 2+ части, каждая ≤250 chars. UI показывает каждую часть отдельно с кнопкой копирования и подсказкой.

**Tests:** 1144 passing (+12 NEW: 12 tests для `splitOverLimitRegex()` в `tests/core/limits.test.ts`). TypeScript clean.

## Известные проблемы (Known Issues)

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| ~~1~~ | ~~`(?!…)` forward-only FP~~ | ~~HIGH~~ | ✅ **CLOSED iter 46** |
| ~~2~~ | ~~Симулятор не моделирует `(?!…)`~~ | ~~MEDIUM~~ | ✅ **CLOSED iter 48** |
| ~~3~~ | ~~`^` в OR-context не верифицирован in-game~~ | ~~MEDIUM~~ | ✅ **CLOSED iter 46** |
| ~~4~~ | ~~AND-in-OR с regexPrefixContext + LITERAL + EXCLUDE~~ | ~~LOW~~ | ✅ **CLOSED iter 49** |
| ~~5~~ | ~~PoE2 regex char limit ≈ 250 chars — 2 over-limit entries в jewel~~ | ~~MEDIUM~~ | ✅ **CLOSED iter 50** — runtime split + ETL context bug fix |

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` (item-wide `!`) | ✅ без изменений |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ production-verified |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ без изменений |
| Token с regexPrefixContext + regexExclude в OR mode | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| **Over-limit OR (>250 chars)** | Runtime split на 2+ regex parts | ✅ **iter 50** |

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches (B0) |
| `\|` многословный внутри `()` | ❌ | nothing matches |
| Пробел = AND (same-block + cross-block) | ✅ | |
| `.*` внутри одного блока | ✅ | |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| Number enumeration | ✅ | |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts (iter 50) |

## Path D — финальный статус

| Шаг | Статус |
|-----|--------|
| D1 In-game test | ✅ |
| D2 ETL + Phase D | ✅ |
| D3 regexExclude усечённые основы | ⏳ pre-analysis only |
| D4 Runtime совместимость | ✅ |
| D5 Production verification | ✅ |
| D6 Все категории | ✅ |
| D7 Char-limit diagnostic | ✅ |
| D8 Char-limit runtime split | ✅ iter 50 |

## SEO-статус: ✅ полный набор реализован

См. `docs/SEO_PLAN.md` для ручной верификации GSC/Яндекс/Bing.

---
Контакты: Discord **woonderdad**
