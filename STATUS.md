# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тесты:** ✅ 678+ core / 978+ total | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 27 — FP cross-validation + RANGE dedup fix

### Изменения

| # | Файл | Изменение |
|---|------|-----------|
| 1 | `src/core/core-optimizations.ts` | **getValueKey для RANGE**: добавлены `max`, `anchorStart`, `anchorEnd`, `reversed`, `colonAnchor`, `threshold` — предотвращает некорректную дедупликацию RANGE-узлов с одинаковым min/suffix но разными параметрами |
| 2 | `tests/core/optimizer.test.ts` | 8 новых тестов для getValueKey: разные max, reversed, anchorStart, anchorEnd, threshold; интеграционный тест на отсутствие неверной дедупликации |
| 3 | `public/generated/ring.json` | Добавлен `regexPrefixContext: "имеют"` для 7 minion breachborn-токенов (повышение шанса критического удара, повышение скорости перезарядки) + добавлен `' от'` в regexExclude для minion damage |
| 4 | `public/generated/amulet.json` | Добавлен `regexPrefixContext: "имеют"` для 15 minion breachborn-токенов (увеличение урона, повышение скорости перезарядки, увеличение области действия) |
| 5 | `public/generated/jewel.json` | Добавлен `regexPrefixContext: "имеют"` для 3 minion-токенов (увеличение максимума здоровья, к сопротивлению хаосу) |

### Результат cross-validation FP

Все cross-family FP теперь полностью покрыты excludes + regexPrefixContext:

| Категория | Токенов с FP | FP покрыто |
|-----------|-------------|-----------|
| ring | 12 regex-групп | ✅ 100% |
| belt | 2 regex-группы | ✅ 100% |
| amulet | 15 regex-групп | ✅ 100% |

### Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак
2. **`!` item-wide** — `!молнии|хаосу` исключает предмет целиком
3. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min
4. **`.*` does NOT cross block boundaries** — cross-block → AND
5. **Substring search** — truncation only at END of suffix
6. **MULTI_RANGE** — dual-number → одна quoted group
7. **`()` = grouping** — literal parens → битый regex
8. **regexExclude suppression** — excludes подавляются при конфликте с другими выбранными токенами
9. **regexPrefixContext** — AND-контекст "имеют" для minion-модов устраняет FP без exclude-паттернов
10. **getValueKey RANGE** — полный набор полей предотвращает неверную дедупликацию

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
