# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 107

---

## Текущее состояние

**iter 107: UX-полировка P4 — tier-colored left border для всех 4 tier'ов в tier-first режиме.**

iter 106 добавил UI-тумблер «Сортировка: По алфавиту / По приоритету», но визуально в tier-first режиме пользователь видел только S-tier (amber-soft border) и «всё остальное» (affix color). iter 107 закрывает этот UX-долг: в tier-first режиме каждый tier получает distinct colored border — S=amber-soft (brightest), A=amber, B=amber-dim (bronze), C=gray. В alpha режиме поведение не изменилось (S→amber-soft always-on, A/B/C→affix color). Чисто UI/CSS изменение — 0 риска для данных/логики/ETL/JSON/схемы.

**Что сделано:**

- `src/index.css` — добавлен новый цвет-токен `--bl-amber-dim: #b45309` (amber-700, бронза) + соответствующий `--color-bl-amber-dim` mapping в `@theme` блоке. Иерархия зеркалит `priorityFilter` кнопки (Pitfall 28): S=amber-soft (brightest), A=amber (medium), B=amber-dim (deeper bronze), C=gray (neutral low-priority).
- `src/ui/components/FilterChip.tsx` — добавлен опциональный prop `sortMode?: SortMode` (default `'alpha'` — backward compat). Import `SortMode` из `@shared/types`. Логика `effectiveBorderClass` refactor'нута: в `'tier-first'` режиме — distinct tier color для каждого tier (suppressed affix color, т.к. affix info уже виден через column header / origin-section структуру); в `'alpha'` режиме — pre-iter-107 поведение (S→amber-soft always-on, A/B/C→affix color).
- `src/ui/components/ModList.tsx` — `ModSubGroupSection` += опциональный prop `sortMode` (пробрасывается в `<FilterChip>`); `AffixColumn` += опциональный prop `sortMode` (пробрасывается в `<ModSubGroupSection>`); все 6 `<AffixColumn>` call sites и все 4 inline `<FilterChip>` call sites пробрасывают `sortMode={sortMode}` из `ModList` props.
- `src/ui/components/VirtualizedModList.tsx` — `VirtualRowContent` += опциональный prop `sortMode` (пробрасывается в `<FilterChip>`); `VirtualizedColumnProps` += опциональное поле `sortMode`; `VirtualizedColumn` destructuring += `sortMode`; `columnProps` object += `sortMode` field (auto-threading во все 3 `<VirtualizedColumn>` call sites); оба `<VirtualRowContent>` call sites (two-column и single-column modes) пробрасывают `sortMode={sortMode}`.
- `tests/ui/FilterChip.test.tsx` — +11 новых тестов в новом `describe('tier-aware left border (iter 107)')` блоке: alpha mode (4 теста — S/A/B/C behavior), omitted sortMode backward compat (1 тест), tier-first mode (4 теста — S/A/B/C distinct colors), visual hierarchy regression (4 distinct classes + affix color suppression across all 3 affix types).

**Метрики:** 1533/1533 tests (было 1522, +11). TSC 0 errors. ESLint 0 problems. ETL не запускался — `public/generated/*.json` не тронуты. Никаких изменений в ETL, runtime functional-classifier, схеме, JSON.

### Архитектура functionalCategory (без изменений vs iter 102)

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`): `classifyModFunctionalBlock(tags, rawText)` — 22-шаговый классификатор. `buildFunctionalCategoryMap()` строит modId→category из ModCalc страниц.
2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`): re-classify после патча rawText на русский.
3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`): Strategy 0 — majority voting по `functionalCategory` с токенов. Fallback `return 'other';`. iter 101: Zod-схема пропускает поле. iter 102: e2e-тесты `tests/integration/runtime-classification.test.ts` закрывают весь production path.

### Inline sanity (iter 107 sortMode threading)

`sortMode` prop опционален во всех точках threading (`FilterChip`, `ModSubGroupSection`, `AffixColumn`, `VirtualRowContent`, `VirtualizedColumnProps`). Default `'alpha'` — backward compat со всеми существующими callers/tests. Новый `'tier-first'` режим opt-in через UI (iter 106 toggle) — покрыт 11 новыми тестами (alpha 4 + tier-first 4 + backward compat 1 + visual hierarchy 2).

### Runtime-метрики (без изменений vs iter 105)

| Категория | mode | Family-groups | sub-groups | non-other blocks | non-other FG | other FG |
|-----------|------|---------------|------------|------------------|--------------|----------|
| jewel (merged, 3 files) | jewel-functional | 210 | 39 | 37 | 192 | 18 |
| amulet | affix-functional | 105 | 29 | 27 | 98 | 7 |
| ring | affix-functional | 94 | 26 | 24 | 91 | 3 |
| belt | affix-functional | 85 | 23 | 21 | 81 | 4 |
| relic | relic-semantic | 25 | N/A | N/A | N/A | N/A |
| waystone (merged, 2 files) | affix-sentiment-subblocks (iter 104) | 73 | 9 sub-blocks | N/A | N/A | N/A |
| tablet | tablet-type-subblocks (iter 105) | 82 | 19 sub-blocks | N/A | N/A | N/A |

- **Strategy 0 coverage (ETL):** 477/477 (100%).
- **Cross-validation:** 477/477 match (0 расхождений).
- **Тесты:** 1533/1533 (+11 vs iter 106). TSC: 0 errors. ESLint: **0 errors + 0 warnings**.
- **ETL:** 11 fresh, 0 stale.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.

---

## Открытые долги

- **Wisps/Conversion блоки**: 0 family-keys в текущих данных. Зарезервированы для future-compat.
- **sortKey?**: опционально добавить `sortKey?: number` в `FamilyGroup` + ETL заполнение на основе functionalCategory + popularity research. Third sort mode (alpha / tier-first / popularity). Требует ETL-расширения — отдельная задача.
- **Waystone neutral-generic (6 groups)**: 5 desecrated Breach-adjacent mods + 1 multi-line continuation. Можно расширить POSITIVE_KEYWORDS. Low-priority — не блокирует UX.
- **Tablet Разломы vs Бездна**: 2 mods используют «Разлом» вместо «Бездна». Можно расширить BREACH_KEYWORDS, но это изменило бы type distribution. Low-priority — текущая sub-block classification в generic корректна.

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
