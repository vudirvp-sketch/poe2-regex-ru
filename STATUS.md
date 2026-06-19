# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 106

---

## Текущее состояние

**iter 106: P4 — tier-aware sort toggle (alpha vs tier-first) в CategoryControlPanel.**

В рамках итерации добавлен UI-тумблер «Сортировка: По алфавиту / По приоритету» в `CategoryControlPanel` для всех 6 категорий с priority classification (ring, amulet, belt, jewel, waystone, tablet). iter 99 сделал `priorityTier` вторичным tiebreaker'ом в within-block sort (alpha primary), но toggle не добавил. iter 106 закрывает этот UX-долг: пользователь может переключаться между двумя режимами — alphabetical flow (iter 99 default, для чтения списков) и tier-first (legacy pre-iter-99, для surface best-in-class модов).

**Что сделано:**

- `src/shared/types.ts` — добавлен `SortMode = 'alpha' | 'tier-first'` union-тип.
- `src/shared/mod-classifier.ts` — добавлена `sortGroupsByTierFirst()` функция (tier primary, alpha tiebreaker — legacy pre-iter-99 поведение) + `sortGroupsByMode()` dispatch entry point. `withAlphabeticalGroups()` переименована в `withSortedGroups(result, sortMode)` (default `'alpha'` — backward compat со всеми существующими callers/tests). `classifyGroups()` получила опциональный 3-й аргумент `sortMode?: SortMode = 'alpha'` — пробрасывается во все 11 веток режимов (affix-only / relic-semantic / affix-functional / jewel-functional / affix-sentiment / affix-sentiment-subblocks / tablet-type / tablet-type-subblocks / origin / jewel-type / fallback).
- `src/ui/components/ModList.tsx` + `src/ui/components/VirtualizedModList.tsx` — добавлен опциональный prop `sortMode?: SortMode = 'alpha'`. Пробрасывается во все `classifyGroups()` и `splitByOriginThenSemantic()` / `buildColumnRows()` вызовы (включая origin-split sub-sections и jewel-type sub-sections). Все `useMemo` deps обновлены.
- `src/ui/hooks/useCategoryPage.ts` — добавлены `sortMode: SortMode` + `setSortMode` в return type. `useState` lazy-init из `extraState.sortMode` (URL-restore). URL-sync `useEffect` обновлён: `sortMode` синхронизируется в `extraState` → URL hash вместе с остальными 6 полями. `restoreFilterState()` восстанавливает `sortMode` из профиля.
- `src/ui/components/CategoryControlPanel.tsx` — добавлены опциональные props `sortMode`, `setSortMode`, `showSortMode`. Render: radio-group с 2 кнопками («По алфавиту» / «По приоритету»), размещён сразу после `priorityFilter`. ARIA: `role="radiogroup"`, `aria-label`, arrow-key navigation (как priorityFilter).
- `src/shared/i18n.ts` — добавлены 3 ключа: `sort.label`, `sort.alpha`, `sort.tier_first`.
- 6 category pages (`BeltPage`, `AmuletPage`, `RingPage`, `WaystonePage`, `TabletPage`, `JewelPage`) — destructuring из `useCategoryPage` += `sortMode, setSortMode`; `<CategoryControlPanel>` += `sortMode/setSortMode/showSortMode`; `<VirtualizedModList>` или `<ModList>` += `sortMode`.
- `tests/shared/mod-classifier.test.ts` — +22 новых тестов в 3 новых `describe` блоках:
  - `sortGroupsByTierFirst` (8 тестов): new-array, ref-preservation, empty/single edge cases, tier-primary sort, alpha-tiebreaker, tier-first-vs-alpha difference regression, `::origin` stripping, all-tiers S→A→B→C.
  - `sortGroupsByMode` (5 тестов): default `'alpha'` backward compat, delegation to `sortGroupsAlphabetically`/`sortGroupsByTierFirst`, no-mutation, empty-array.
  - `classifyGroups respects sortMode argument` (9 тестов): default alpha backward compat, `tier-first` surfaces S-tier first в `affix-functional`/`relic-semantic`/`tablet-type-subblocks`/`jewel-functional`/`affix-sentiment-subblocks`, alpha-explicit matches default, ref-preservation в обоих режимах.

**Метрики:** 1522/1522 tests (было 1500, +22). TSC 0 errors. ESLint 0 problems. ETL не запускался — `public/generated/*.json` не тронуты. Никаких изменений в ETL, runtime functional-classifier, схеме, JSON, WaystonePage (только sortMode props добавлены).

### Архитектура functionalCategory (без изменений vs iter 102)

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`): `classifyModFunctionalBlock(tags, rawText)` — 22-шаговый классификатор. `buildFunctionalCategoryMap()` строит modId→category из ModCalc страниц.
2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`): re-classify после патча rawText на русский.
3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`): Strategy 0 — majority voting по `functionalCategory` с токенов. Fallback `return 'other';`. iter 101: Zod-схема пропускает поле. iter 102: e2e-тесты `tests/integration/runtime-classification.test.ts` закрывают весь production path.

### Inline sanity (iter 106 sortMode не меняет alpha default)

Toggle по умолчанию в режиме `'alpha'` — это iter 99 поведение. Все 1500 существующих тестов (до iter 106) продолжают проходить без модификаций, потому что `classifyGroups(groups, mode)` без третьего аргумента использует `sortMode = 'alpha'`. Новый `'tier-first'` режим opt-in через UI — covered 9 новыми тестами на 5 режимов (`affix-functional`, `jewel-functional`, `relic-semantic`, `tablet-type-subblocks`, `affix-sentiment-subblocks`).

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
- **Тесты:** 1522/1522 (+22 vs iter 105). TSC: 0 errors. ESLint: **0 errors + 0 warnings**.
- **ETL:** 11 fresh, 0 stale.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.

---

## Открытые долги

- **Wisps/Conversion блоки**: 0 family-keys в текущих данных. Зарезервированы для future-compat.
- **sortKey?**: опционально добавить `sortKey?: number` в `FamilyGroup` + ETL заполняет на основе functionalCategory + popularity research. (iter 106 закрыл только P4 toggle; popularity-based sort — отдельная задача.)
- **Waystone neutral-generic (6 groups)**: 5 desecrated Breach-adjacent mods («Провалы Бездны... могут породить волшебных монстров», «Область захвачена монстрами Бездны», «Игроки крадут поглощаемые души...», etc.) + 1 multi-line continuation («после убийства редкого или уникального монстра»). Можно расширить POSITIVE_KEYWORDS, чтобы их поймать (большинство семантически positive — extra Breach content / player soul-steal benefit). Low-priority — не блокирует UX.
- **Tablet Разломы vs Бездна**: 2 mods («(5-15)% увеличение плотности монстров в Разломах» и «Нестабильные Разломы...порождают дополнительного редкого монстра») используют «Разлом» вместо «Бездна» и классифицируются как generic (BREACH_KEYWORDS не включает «Разлом»). Можно расширить BREACH_KEYWORDS, чтобы их поймать — но это изменило бы type distribution и потребовало бы регенерации. Отложено — текущая sub-block classification в generic (encounters/monsters) корректна.

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
