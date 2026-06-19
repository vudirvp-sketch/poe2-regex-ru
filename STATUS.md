# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 103

---

## Текущее состояние

**iter 103: подавление 2 TanStack library-level ESLint warnings — закрытие Known Issue #3.**

`useVirtualizer()` из `@tanstack/react-virtual` возвращает non-memoizable функции (`getVirtualItems`, `scrollToIndex`, …), на которые React Compiler (через `eslint-plugin-react-hooks` v7, правило `react-hooks/incompatible-library`) генерирует library-level warning. Не наш код — апстрим-ограничение TanStack Virtual.

**Что сделано:**
- `src/ui/components/VirtualizedModList.tsx` — `// eslint-disable-next-line react-hooks/incompatible-library` над обоими вызовами `useVirtualizer()` (двухколоный virtualizer + single-column virtualizer) + краткий комментарий-обоснование со ссылкой на Known Issue #3.
- Никаких изменений в runtime/ETL/JSON/схеме/тестах.

**Метрики:** ESLint теперь **0 errors + 0 warnings** (раньше 0 + 2). 1431/1431 tests. TSC 0 errors. ETL 11 fresh, 0 stale.

### Архитектура functionalCategory (без изменений vs iter 102)

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`): `classifyModFunctionalBlock(tags, rawText)` — 22-шаговый классификатор. `buildFunctionalCategoryMap()` строит modId→category из ModCalc страниц.
2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`): re-classify после патча rawText на русский.
3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`): Strategy 0 — majority voting по `functionalCategory` с токенов. Fallback `return 'other';`. iter 101: Zod-схема пропускает поле. iter 102: e2e-тесты `tests/integration/runtime-classification.test.ts` закрывают весь production path.

### Runtime-метрики (без изменений vs iter 102)

| Категория | mode | Family-groups | sub-groups | non-other blocks | non-other FG | other FG |
|-----------|------|---------------|------------|------------------|--------------|----------|
| jewel (merged, 3 files) | jewel-functional | 210 | 39 | 37 | 192 | 18 |
| amulet | affix-functional | 105 | 29 | 27 | 98 | 7 |
| ring | affix-functional | 94 | 26 | 24 | 91 | 3 |
| belt | affix-functional | 85 | 23 | 21 | 81 | 4 |
| relic | relic-semantic | 25 | N/A | N/A | N/A | N/A |

- **Strategy 0 coverage (ETL):** 477/477 (100%).
- **Cross-validation:** 477/477 match (0 расхождений).
- **Тесты:** 1431/1431. TSC: 0 errors. ESLint: **0 errors + 0 warnings** (iter 103).
- **ETL:** 11 fresh, 0 stale.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.
3. ~~**VirtualizedModList.tsx TanStack warnings (2)** — `react-hooks/incompatible-library` warnings от `useVirtualizer()`. Library-level, не наш код.~~ **✅ FIXED iter 103** — оба вызова `useVirtualizer()` (lines 312, 600) помечены `// eslint-disable-next-line react-hooks/incompatible-library` с комментарием-обоснованием. ESLint теперь 0 problems.
4. ~~**Zod schema strips `functionalCategory`** — `GameTokenSchema` не содержал поля `functionalCategory`, Zod удалял его при парсинге, runtime classifier падал в `other` для всех токенов.~~ **✅ FIXED iter 101** + **iter 102: +17 e2e-регрессионных тестов** в `tests/integration/runtime-classification.test.ts` закрывают production path.

---

## Открытые долги

- **Wisps/Conversion блоки**: 0 family-keys в текущих данных. Зарезервированы для future-compat.
- **P2 — waystone/tablet sub-blocks**: sub-группировка внутри sentiment (positive/negative/neutral) по gameplay mechanic — для waystone: loot/danger/splinters; для tablet: ritual/breach/delirium уже есть как type, нужен второй уровень внутри type.
- **P4 — tier-aware сортировка (UI-toggle)**: S+/S/All приоритеты внутри блоков (vs текущий priorityFilter, который только фильтрует, не сортирует). iter 99 сделал tier вторичным, но UI-тумблер «режим сортировки» (alpha vs tier-first) не добавлен — может быть полезен для power-users.
- **sortKey?**: опционально добавить `sortKey?: number` в `FamilyGroup` + ETL заполняет на основе functionalCategory + popularity research. iter 99 решил UX-задачу без sortKey, но остаётся как future-compat для схем вроде «по популярности внутри категории».

---

## Подтверждённые ограничения PoE2

| Синтаксис | Работает? | Примечание |
|-----------|-----------|------------|
| `\|` между одиночными словами | ✅ | `"Бездн\|Делир"` |
| `\|` top-level + `.*` мосты (Path D) | ✅ | до 9 альтернатив |
| `\|` между quoted groups | ❌ | zero matches |
| Пробел = AND | ✅ | same-block + cross-block |
| `(?!…)` per-block bidirectional | ✅ | через `^(?!…).*Z` |
| `!` item-wide | ✅ | для top-level AND |
| `^` start-of-block anchor | ✅ | |
| `\d`, `\d{N,}` | ✅ | |
| `?` optional | ❌ | не работает в игре |
| Regex char limit ≈ 250 chars | ✅ | runtime split на 2+ parts |

---

## Оптимальные стратегии (итог)

| Сценарий | Статегия | Статус |
|----------|-----------|--------|
| Token с excludes в OR mode | `^(?!.*X)(?!.*Y).*Z` | ✅ iter 46 |
| Token с excludes в top-level AND | `"Z" "!X\|Y"` | ✅ |
| Same-family OR (Path D) | `"prefix.*A\|prefix.*B\|..."` | ✅ |
| Number-anchored RANGE | `^N.*suffix` (Phase 9b) | ✅ |
| Token с regexPrefixContext + regexExclude в OR | `^(?!.*X).*ctx.*Z` | ✅ iter 49 |
| Over-limit OR (>250 chars) | Runtime split на 2+ regex parts | ✅ iter 50 |

---
Контакты: Discord **woonderdad**
