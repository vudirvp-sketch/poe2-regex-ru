# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Тесты:** ✅ 963/963 | **Build:** ✅ | **TypeScript:** ✅

---

## Текущая итерация: 24 — MULTI_RANGE: Dual-number mod regex fix

### Проблема

Двойные моды ("Добавляет от X до Y физического урона к атакам") при фильтрации по обоим слотам (1е ≥ 6, 2е ≥ 12) генерировали два отдельных quoted group, AND-объединённых:
```
"Добавляет от ([6-9]|\d{2,}).*урона к атакам" "до (1[2-9]|[2-9][0-9]|\d{3,}).*урона к атакам"
```

Проблемы:
1. AND двух групп может матчить разные блоки (каждая группа ищет независимо)
2. Regex длиннее (две группы вместо одной)
3. Некоторые токены имели битые суффиксы из ETL (содержали `)` и `—` из range notation, например "4—20) физического урона к атакам")

### Решение

**MULTI_RANGE AST-нода** — компилируется в ОДНУ quoted group:
```
"Добавляет от ([6-9]|\d{2,}).*до (1[2-9]|[2-9][0-9]|\d{3,}).*урона к атакам"
```

Преимущества:
- Оба числа обязаны матчится в ОДНОМ блоке (не бывает cross-block matching)
- Regex короче (одна группа vs две)
- Нет риска, что каждая группа сматчит разную линию мода

**Runtime-починка битых суффиксов**: при обнаружении `)` или `—` в суффиксе multi-placeholder токена, суффикс извлекается из `rawTextTemplate` вместо `token.regex`.

### Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `src/shared/types.ts` | Добавлен тип `MULTI_RANGE` в `ASTNode` |
| `src/core/ast.ts` | Добавлен builder `multiRange()` |
| `src/core/compiler.ts` | `normalizeAst()` + `compileInner()` поддерживают `MULTI_RANGE` |
| `src/ui/hooks/useCategoryPage.ts` | `buildAstFromSelections()` создаёт MULTI_RANGE для dual-slot фильтров + починка битых суффиксов |
| `tests/core/compiler.test.ts` | 9 новых тестов для MULTI_RANGE компиляции |

### Ключевые верифицированные факты

1. **`^\+` и `^-`** — якорят к началу блока + матчат знак. Без FP от чисел без знака.
2. **`!` item-wide** — если `!молнии|хаосу` находит «молнии» в ЛЮБОМ блоке — весь предмет исключается.
3. **Threshold mode** — RANGE(min,max) с `threshold=true` → ≥min только.
4. **`.*` does NOT cross block boundaries** — Cross-block → AND (`"X" "Y"`).
5. **Substring search** — PoE2 regex = contiguous substring match. Word truncation works ONLY at END of suffix/phrase.
6. **MULTI_RANGE** — dual-number mods с 2+ фильтрованными слотами → одна quoted group. Оба числа в одном блоке.

---

## Известные проблемы

| # | Issue | Status | Impact |
|---|-------|--------|--------|
| 1 | Type A parser не извлекает modCode для jewels → `jewelType` всегда "shared" | Open | Low |
| 2 | Enumerated ranges могут давать FP на range notation числа | Mitigated by `^`/`%` anchors + threshold | Edge case |
| 3 | ETL suffix extraction bug: некоторые dual-number токены получают суффикс с `)` из range notation | Mitigated by runtime repair | Medium — нужен фикс ETL в следующей итерации |

---

## Контакты

Баг-репорты и предложения → **Discord: woonderdad**
