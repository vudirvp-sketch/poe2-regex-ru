# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 105

---

## Текущее состояние

**iter 105: P2 second half — tablet sub-blocks (gameplay mechanic sub-grouping within type).**

В рамках итерации добавлен новый режим `tablet-type-subblocks` для TabletPage: внутри каждого типа (ritual/breach/delirium/vaal/expedition/generic) семейные группы дополнительно подклассифицируются по gameplay mechanic. Production TabletPage переключён со старого `tablet-type` (6 корзин) на новый режим (19 sub-blocks). Архитектурно — mirror iter 104 (waystone sub-blocks): flat `ModSubGroup[]` с composite-ключами, существующий рендеринг ModList не тронут.

**19 tablet sub-blocks:**
- RITUAL (3): `ritual-rewards` (Награды Ритуала), `ritual-monsters` (Монстры Ритуала), `ritual-content` (Алтари и круги)
- BREACH (3): `breach-monsters` (Монстры Бездны), `breach-rewards` (Награды Бездны), `breach-content` (Количество Бездн)
- DELIRIUM (3): `delirium-mist` (Туман), `delirium-rewards` (Награды Делириума), `delirium-monsters` (Монстры Делириума)
- VAAL (3): `vaal-monsters` (Монстры Маяков), `vaal-rewards` (Сундуки и кристаллы), `vaal-content` (Маяки Ваал)
- EXPEDITION (3): `expedition-rewards` (Реликты и артефакты), `expedition-explosives` (Взрывчатка), `expedition-monsters` (Рунические монстры)
- GENERIC (4): `generic-loot` (Добыча), `generic-monsters` (Монстры), `generic-encounters` (Доп. контент), `generic-player` (Бонусы игроку)

Цвет бейджа продолжает коммуницировать родительский тип (red для ritual, violet для breach, blue для delirium, amber для vaal, emerald для expedition, muted для generic), лейбл коммуницирует gameplay mechanic. Архитектурно — flat `ModSubGroup[]` с composite-ключами (`ritual-rewards`, `breach-monsters`, …), без nested-структур — существующий рендеринг ModList не тронут.

**Что сделано:**
- `src/shared/mod-classifier.ts` — `TabletSubBlock` type (19 variants) + `TABLET_SUBBLOCK_LABELS` + `TABLET_SUBBLOCK_ORDER` + 16 sub-block pattern regexes (по 2 на type, кроме generic где 3) + `classifyTabletSubBlock()` function. Новый режим `tablet-type-subblocks` в `ModGroupMode` + реализация в `classifyGroups()` (Mirror архитектуры `affix-sentiment-subblocks` из iter 104 и `tablet-type`: Map → order filter → map to ModSubGroup). Старый режим `tablet-type` сохранён как legacy для backward compat.
- Two-phase architecture: `classifyTabletType()` → type, затем sub-block patterns within type. Каждый type имеет fallback sub-block (`ritual-content` / `breach-content` / `delirium-monsters` / `vaal-content` / `expedition-monsters` / `generic-monsters`) — ни один family-group не «потерян».
- Pattern design notes: (a) RITUAL — monsters BEFORE rewards (жертвенные монстры, дарующие дань, имеют оба ключевых слова — семантически это monster-механика); (b) DELIRIUM — rewards BEFORE mist (Туман + осколки = rewards, т.к. награда — primary subject); (c) GENERIC — encounters BEFORE monsters (Нестабильные Разломы порождают редкого монстра = encounter-спавн, не monster-stat), encounters pattern использует specific phrases (`На карте можно встретить`, `шансом можно встретить`, `Добавляет Заражение`, `Нестабильные Разломы`, `случайным свойством`, `Осталось зарядов`) чтобы не false-match на monster density mods с `на карте` или `Разломах`.
- `src/ui/pages/tablet/TabletPage.tsx` — `groupMode="tablet-type"` → `groupMode="tablet-type-subblocks"`.
- `tests/shared/mod-classifier.test.ts` — +28 новых тестов (23 classifyTabletSubBlock unit tests + 5 tablet-type-subblocks mode tests). Включает 2 regression-теста для pattern priority (ritual-monsters перед ritual-rewards, delirium-rewards перед delirium-mist) + 1 label-coverage sanity check.

**Метрики:** 1500/1500 tests (было 1472, +28). TSC 0 errors. ESLint 0 problems. ETL 11 fresh, 0 stale. Никаких изменений в `public/generated/*.json`, ETL, runtime functional-classifier, схеме, WaystonePage.

### Inline sanity (iter 105 tablet sub-block distribution on real data)

Запуск `classifyTabletSubBlock` на `tablet.json` (82 family-groups):

| Sub-block | Label | Count |
|-----------|-------|-------|
| ritual-rewards | Награды Ритуала | 6 |
| ritual-monsters | Монстры Ритуала | 3 |
| ritual-content | Алтари и круги | 5 |
| breach-monsters | Монстры Бездны | 5 |
| breach-rewards | Награды Бездны | 2 |
| breach-content | Количество Бездн | 4 |
| delirium-mist | Туман | 4 |
| delirium-rewards | Награды Делириума | 4 |
| delirium-monsters | Монстры Делириума | 1 |
| vaal-monsters | Монстры Маяков | 5 |
| vaal-rewards | Сундуки и кристаллы | 2 |
| vaal-content | Маяки Ваал | 1 |
| expedition-rewards | Реликты и артефакты | 4 |
| expedition-explosives | Взрывчатка | 2 |
| expedition-monsters | Рунические монстры | 2 |
| generic-loot | Добыча | 6 |
| generic-monsters | Монстры | 9 |
| generic-encounters | Доп. контент | 15 |
| generic-player | Бонусы игроку | 2 |
| **Total** | | **82** |

Type distribution (без изменений vs iter 104): ritual 14, breach 11, delirium 9, vaal 8, expedition 8, generic 32. Все 82 family-groups классифицированы — ни один не «потерян».

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
| waystone (merged, 2 files) | affix-sentiment-subblocks (iter 104) | 73 | 9 sub-blocks | N/A | N/A | N/A |
| tablet | tablet-type-subblocks (iter 105) | 82 | 19 sub-blocks | N/A | N/A | N/A |

- **Strategy 0 coverage (ETL):** 477/477 (100%).
- **Cross-validation:** 477/477 match (0 расхождений).
- **Тесты:** 1500/1500. TSC: 0 errors. ESLint: **0 errors + 0 warnings**.
- **ETL:** 11 fresh, 0 stale.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.
3. ~~**VirtualizedModList.tsx TanStack warnings (2)**~~ **✅ FIXED iter 103**.
4. ~~**Zod schema strips `functionalCategory`**~~ **✅ FIXED iter 101** + **iter 102: +17 e2e-регрессионных тестов**.
5. ~~**`приспешник.*урон` false-positive в POSITIVE_KEYWORDS**~~ **✅ FIXED iter 104**.

---

## Открытые долги

- **Wisps/Conversion блоки**: 0 family-keys в текущих данных. Зарезервированы для future-compat.
- **P4 — tier-aware сортировка (UI-toggle)**: S+/S/All приоритеты внутри блоков (vs текущий priorityFilter, который только фильтрует, не сортирует). iter 99 сделал tier вторичным, но UI-тумблер «режим сортировки» (alpha vs tier-first) не добавлен.
- **sortKey?**: опционально добавить `sortKey?: number` в `FamilyGroup` + ETL заполняет на основе functionalCategory + popularity research.
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
