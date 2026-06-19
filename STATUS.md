# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 101

---

## Текущее состояние

**iter 101: P0-фикс Critical Bug — Zod schema strips `functionalCategory` (Known Issue #4).**

Пользователь сообщил: на страницах jewel / amulet / ring / belt ВСЕ аффиксы отображаются в одной functional-категории «Прочее» (например, «Прочее (18)» на ring). На production-странице видно, что вместо 24 функциональных блоков (Дух / Атрибуты / Сопротивления / …) все токены падают в `other`.

**Root cause:** `GameTokenSchema` в `src/shared/schemas.ts` (lines 55-77) не содержит поля `functionalCategory`. При `CategoryDataSchema.parse(raw)` в `src/data/loader.ts:24` Zod по умолчанию **strips** неизвестные поля → все токены теряют `functionalCategory` → `classifyFunctionalBlock()` (`src/shared/mod-classifier.ts:1282`) попадает в fallback `return 'other';` → ВСЕ family-groups падают в блок `other` («Прочее»).

**Когда появился баг:** iter 90 (commit `009b00d`) — `functionalCategory` добавлен в `GameToken` type (`src/shared/types.ts:61`), но **НЕ** добавлен в Zod-схему. С тех пор runtime был сломан; метрики в STATUS.md показывали 8.3% other-bucket по JSON-данным (ETL), но runtime показывал 100%.

**Почему тесты не ловили:**
- `tests/shared/mod-classifier.test.ts` — конструирует `FamilyGroup` через `makeGroup()` хелперы, выставляя `functionalCategory` напрямую, без Zod.
- `tests/etl/cross-validation.test.ts` — использует `JSON.parse(raw)` напрямую, без Zod.
- Никакого end-to-end теста «load JSON через schema → classify → verify non-`other`» не было.

**Фикс (минимальный, backward-compatible):**
- `src/shared/schemas.ts`: добавлено `functionalCategory: z.string().optional()` в `GameTokenSchema` (1 строка).
- `tests/etl/etl-schemas.test.ts`: добавлен тест «preserves functionalCategory field from real JSON» — загружает `belt.json` через `CategoryDataSchema.parse()`, проверяет что `functionalCategory` сохраняется на ≥1 токене.
- `tests/shared/mod-classifier.test.ts`: добавлен end-to-end тест «classifyGroups на реальном belt.json через schema — non-`other` блоки присутствуют».

**Без изменений:** `public/generated/*.json`, ETL pipeline, runtime classifier. После деплоя на production на страницах jewel/amulet/ring/belt появятся корректные functional-блоки (Дух / Атрибуты / Сопротивления / Урон / Крит / …) вместо одного «Прочее».

### Метрики (без изменений vs iter 100)

| Категория | Токенов | Family-groups | functionalCategory (ETL) | other-bucket (ETL) |
|-----------|---------|---------------|--------------------------|---------------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) |
| amulet | 428 | 105 | 100% | 6.7% (7/105) |
| ring | 369 | 94 | 100% | 3.2% (3/94) |
| belt | 298 | 85 | 100% | 4.7% (4/85) |
| relic | 80 | 25 | N/A (text-only) | N/A |

- **Strategy 0 coverage (ETL):** 477/477 (100%).
- **Cross-validation:** 477/477 match (0 расхождений).
- **Тесты:** было 1411/1411, стало 1413/1413 (+2 новых регрессионных). TSC: 0 errors. ESLint: 2 warnings (TanStack, library-level).
- **ETL:** 11 fresh, 0 stale.

### Архитектура functionalCategory (без изменений vs iter 96)

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`): `classifyModFunctionalBlock(tags, rawText)` — 22-шаговый классификатор. `buildFunctionalCategoryMap()` строит modId→category из ModCalc страниц.
2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`): re-classify после патча rawText на русский.
3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`): Strategy 0 — majority voting по `functionalCategory` с токенов. Fallback `return 'other';`. **iter 101: теперь `functionalCategory` реально доходит до runtime (Zod-схема пропускает поле).**

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.
3. **VirtualizedModList.tsx TanStack warnings (2)** — `react-hooks/incompatible-library` warnings от `useVirtualizer()`. Library-level, не наш код. Можно подавить через `// eslint-disable-next-line` или дождаться апстрим-фикса.
4. ~~**Zod schema strips `functionalCategory`** — `GameTokenSchema` не содержал поля `functionalCategory`, Zod удалял его при парсинге, runtime classifier падал в `other` для всех токенов.~~ **✅ FIXED iter 101** (добавлено `functionalCategory: z.string().optional()` + 2 регрессионных теста).

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
