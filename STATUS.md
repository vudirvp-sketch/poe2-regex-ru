# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тесты:** ✅ 978/978 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 26 — Fix conflicting regexExclude in OR/AND mode

### Проблема

При выборе "+к ловкости" OR "+к интеллекту" на кольцах генерировался сломанный regex:
`"к ловкости" "! интел"|к интеллекту"` — не подсвечивал кольца с обоими атрибутами.

### Root cause

Токен "к ловкости" имеет `regexExclude: [" интел"]` для предотвращения FP (чтобы "к ловкости" не совпадало с предметами, где только "к интеллекту"). Но при выборе обоих модов exclude конфликтует с другим выбранным токеном:
- **OR mode:** exclude блокирует предметы, которые пользователь явно хочет (с интеллекту)
- **AND mode:** exclude блокирует предметы, где есть оба атрибута

### Решение

| Файл | Изменение |
|------|-----------|
| `src/ui/hooks/useCategoryPage.ts` | `computeSuppressedExcludes()`: собирает exclude-паттерны, конфликтующие с другими выбранными токенами |
| `src/ui/hooks/useCategoryPage.ts` | `buildLiteralNode()`: принимает `suppressedExcludes` и фильтрует конфликтующие excludes |
| `src/ui/hooks/useCategoryPage.ts` | `buildAstFromSelections()`: фильтрует excludes во всех ветках (non-ranged, RANGE, MULTI_RANGE, orphaned) |
| `src/core/core-optimizations.ts` | `removeConflictingExcludes()`: Phase 4 оптимизатора — safety net, удаляет EXCLUDE-узлы, конфликтующие с sibling LITERAL в OR-группах |
| `src/core/optimizer.ts` | `optimize()`: добавлен Phase 4 после truncateSuffixes |
| `tests/ui/buildAstFromSelections.test.ts` | 4 новых теста: OR suppression, AND suppression, keep non-conflicting, rawText match |
| `tests/core/optimizer.test.ts` | 5 новых тестов для removeConflictingExcludes |

### Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак. Без FP от чисел без знака.
2. **`!` item-wide** — если `!молнии|хаосу` находит «молнии» в ЛЮБОМ блоке — весь предмет исключается.
3. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min только.
4. **`.*` does NOT cross block boundaries** — Cross-block → AND (`"X" "Y"`).
5. **Substring search** — PoE2 regex = contiguous substring match. Word truncation works ONLY at END of suffix/phrase.
6. **MULTI_RANGE** — dual-number mods с 2+ фильтрованными слотами → одна quoted group. Оба числа в одном блоке.
7. **`()` в regex** — PoE2 интерпретирует `()` как grouping, не как literal parens. Regex с `)` из rawText — битый.
8. **regexExclude suppression** — если exclude-паттерн является подстрокой regex/rawText другого выбранного токена, exclude подавляется. Работает в OR и AND режимах.

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |
| 3 | Кросс-валидация FP выросла с 8224 до 9346 после фикса оптимизатора (битые суффиксы больше не сокращают FP) | Open — нужна проверка в игре | Medium |
| 4 | Дедупликация same-family RANGE — два одинаковых RANGE в OR-группе с одним familyKey не дедуплируются (valueKey не учитывает familyKey) | Open — оптимизация на будущее | Low |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
