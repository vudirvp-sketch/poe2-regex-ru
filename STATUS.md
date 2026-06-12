# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тесты:** ✅ 969/969 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 25 — Fix ETL suffix extraction + optimizer grouping

### Проблема

Итеративный оптимизатор (`iterative-optimizer.ts`) генерировал битые regex с `)` из rawText:
- `belt.normal_33`: `"4—7)% к сопротивлению хаосу"` вместо `"сопротивлению хаосу"`
- 39 битых токенов в ring.json, 27 в belt.json

### Root cause

1. **`tryReduceFP()`** расширяла regex символами из rawText, захватывая `)` из диапазонов типа `(4—7)`, без проверки `containsPoE2Grouping()`
2. **Oracle validation** пропускала битые regex: PoE2 трактует `)` как grouping, обрезает regex → truncated regex всё ещё совпадает с rawText → false-positive pass
3. **`countFP()`** считала same-family FP (желаемые совпадения внутри одной семьи), запуская `tryReduceFP` когда fp > 2, даже при cross-family FP = 0

### Решение

| Файл | Изменение |
|------|-----------|
| `scripts/etl/iterative-optimizer.ts` | `tryReduceFP()`: добавлен `containsPoE2Grouping()` чек + замена `countFP` на `countCrossFamilyFP` |
| `scripts/etl/iterative-optimizer.ts` | `oracleValidateChange()`: добавлен `containsPoE2Grouping()` чек (defense in depth) |
| `scripts/etl/iterative-optimizer.ts` | Strategy 3: порог `fp > 2` заменён на `crossFamilyFP > 2` — same-family FP больше не триггерит fp-reduce |
| `scripts/etl/iterative-optimizer.ts` | `tryFixFN()` Strategy 3: добавлен `containsPoE2Grouping()` фильтр |
| `src/core/core-optimizations.ts` | `getValueKey()`: добавлена поддержка `MULTI_RANGE` — предотвращает некорректную дедупликацию |
| `src/core/optimization-strategies.ts` | `truncateSuffixes()`: добавлена обработка `MULTI_RANGE` (suffix truncation) |
| `tests/ui/buildAstFromSelections.test.ts` | 7 новых интеграционных тестов для MULTI_RANGE с реальными ring.json данными |

### Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак. Без FP от чисел без знака.
2. **`!` item-wide** — если `!молнии|хаосу` находит «молнии» в ЛЮБОМ блоке — весь предмет исключается.
3. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min только.
4. **`.*` does NOT cross block boundaries** — Cross-block → AND (`"X" "Y"`).
5. **Substring search** — PoE2 regex = contiguous substring match. Word truncation works ONLY at END of suffix/phrase.
6. **MULTI_RANGE** — dual-number mods с 2+ фильтрованными слотами → одна quoted group. Оба числа в одном блоке.
7. **`()` в regex** — PoE2 интерпретирует `()` как grouping, не как literal parens. Regex с `)` из rawText — битый.

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
