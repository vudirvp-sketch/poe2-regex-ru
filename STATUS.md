# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 104

---

## Текущее состояние

**iter 104: P2 first half — waystone sub-blocks (gameplay mechanic sub-grouping within sentiment) + Known Issue #5 fix.**

В рамках итерации добавлен новый режим `affix-sentiment-subblocks` для WaystonePage: внутри каждого sentiment (positive/negative/neutral) семейные группы дополнительно подклассифицируются по gameplay mechanic. Production WaystonePage переключён со старого `affix-sentiment` (3 корзины) на новый режим (9 sub-blocks). Параллельно закрыт Known Issue #5 — false-positive в `POSITIVE_KEYWORDS` (`приспешник.*урон` ловил негативный мод «Игроки и их приспешники не наносят урона»).

**9 waystone sub-blocks:**
- POSITIVE: `positive-loot` (Добыча), `positive-mechanics` (Механики), `positive-buffs` (Усиления)
- NEGATIVE: `negative-monster-power` (Сила монстров), `negative-monster-defense` (Защита монстров), `negative-monster-modifiers` (Свойства монстров), `negative-player-penalty` (Штрафы игроку), `negative-environment` (Опасности)
- NEUTRAL: `neutral-generic` (Прочие)

Цвет бейджа продолжает коммуницировать sentiment (teal для positive, red для negative, muted для neutral), лейбл коммуницирует gameplay mechanic. Архитектурно — flat `ModSubGroup[]` с composite-ключами (`positive-loot`, `negative-monster-power`, …), без nested-структур — существующий рендеринг ModList не тронут.

**Что сделано:**
- `src/shared/mod-classifier.ts` — `WaystoneSubBlock` type (9 variants) + `WAYSTONE_SUBBLOCK_LABELS` + `WAYSTONE_SUBBLOCK_ORDER` + 7 sub-block pattern regexes + `classifyWaystoneSubBlock()` function. Новый режим `affix-sentiment-subblocks` в `ModGroupMode` + реализация в `classifyGroups()` (Mirror архитектуры `affix-sentiment`: Map → order filter → map to ModSubGroup). Старый режим `affix-sentiment` сохранён как legacy для backward compat.
- Known Issue #5 fix: удалён `приспешник.*урон` из `POSITIVE_KEYWORDS` (ловил «Игроки и их приспешники не наносят урона...» как positive — это negative). Добавлен `Игроки.*не наносят урон` в `NEGATIVE_KEYWORDS`. Intended positive minion mods (`приспешники наносят... дополнительного урона от X`) всё ещё ловятся через `приспешник.*дополнит`. 1 family-group переехал positive → negative.
- Sub-block pattern fixes during testing: `монстр.*энергетическ.*щит` (требует «монстр» перед «энергетическ» — чтобы player-ES дебаффы не падали в monster-defense), `порог.*состоян|порог.*оглушен` (order-agnostic — текст «Монстры имеют N увеличение порога состояний» имеет «монстр» ДО «порог»), `дополнит.*ларец` добавлен в `POSITIVE_LOOT_PATTERNS` (был в POSITIVE_KEYWORDS, но отсутствовал в sub-block pattern).
- `src/ui/pages/waystone/WaystonePage.tsx` — `groupMode="affix-sentiment"` → `groupMode="affix-sentiment-subblocks"`.
- `tests/shared/mod-classifier.test.ts` — +41 новых тестов: 2 Known Issue #5 regression tests + 28 classifyWaystoneSubBlock unit tests + 5 affix-sentiment-subblocks mode tests + 6 прочих.

**Метрики:** 1472/1472 tests (было 1431, +41). TSC 0 errors. ESLint 0 problems. ETL 11 fresh, 0 stale. Никаких изменений в `public/generated/*.json`, ETL, runtime functional-classifier, схеме.

### Inline sanity (iter 104 waystone sub-block distribution on real data)

Запуск `classifyWaystoneSubBlock` на мёрдже `waystone.json` + `waystone-desecrated.json` (73 family-groups):

| Sub-block | Label | Count |
|-----------|-------|-------|
| positive-loot | Добыча | 8 |
| positive-mechanics | Механики | 13 |
| positive-buffs | Усиления | 3 |
| negative-monster-power | Сила монстров | 16 |
| negative-monster-defense | Защита монстров | 9 |
| negative-monster-modifiers | Свойства монстров | 3 |
| negative-player-penalty | Штрафы игроку | 7 |
| negative-environment | Опасности | 8 |
| neutral-generic | Прочие | 6 |
| **Total** | | **73** |

Sentiment distribution (после Known Issue #5 fix): positive 24 (было 25), negative 43 (было 42), neutral 6 (без изменений). Все 73 family-groups классифицированы — ни один не «потерян».

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

- **Strategy 0 coverage (ETL):** 477/477 (100%).
- **Cross-validation:** 477/477 match (0 расхождений).
- **Тесты:** 1472/1472. TSC: 0 errors. ESLint: **0 errors + 0 warnings**.
- **ETL:** 11 fresh, 0 stale.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.
3. ~~**VirtualizedModList.tsx TanStack warnings (2)** — `react-hooks/incompatible-library` warnings от `useVirtualizer()`.~~ **✅ FIXED iter 103**.
4. ~~**Zod schema strips `functionalCategory`**~~ **✅ FIXED iter 101** + **iter 102: +17 e2e-регрессионных тестов**.
5. ~~**`приспешник.*урон` false-positive в POSITIVE_KEYWORDS** — паттерн ловил BOTH intended positive minion-extra-damage mods AND negative «Игроки и их приспешники не наносят урона в течение 3 из каждых 10 секунд» (потому что в тексте есть и «приспешник», и «урон»). 1 family-group mis-classified positive → should be negative.~~ **✅ FIXED iter 104** — `приспешник.*урон` удалён из POSITIVE_KEYWORDS, `Игроки.*не наносят урон` добавлен в NEGATIVE_KEYWORDS. Intended positive minion mods всё ещё ловятся через `приспешник.*дополнит` (требует «дополнит» между «приспешник» и «урон»). +2 regression tests.

---

## Открытые долги

- **Wisps/Conversion блоки**: 0 family-keys в текущих данных. Зарезервированы для future-compat.
- **P2 — tablet sub-blocks (second half)**: sub-группировка внутри type (ritual/breach/delirium/vaal/expedition/generic) по second-level gameplay mechanic. iter 104 закрыл только waystone half. Tablet уже имеет 6 type-категорий — нужен анализ, какой second-level имеет смысл (например, rewards/difficulty/quantity внутри ritual; monster-density/loot/bosses внутри breach).
- **P4 — tier-aware сортировка (UI-toggle)**: S+/S/All приоритеты внутри блоков (vs текущий priorityFilter, который только фильтрует, не сортирует). iter 99 сделал tier вторичным, но UI-тумблер «режим сортировки» (alpha vs tier-first) не добавлен.
- **sortKey?**: опционально добавить `sortKey?: number` в `FamilyGroup` + ETL заполняет на основе functionalCategory + popularity research.
- **Waystone neutral-generic (6 groups)**: 5 desecrated Breach-adjacent mods («Провалы Бездны... могут породить волшебных монстров», «Область захвачена монстрами Бездны», «Игроки крадут поглощаемые души...», etc.) + 1 multi-line continuation («после убийства редкого или уникального монстра»). Можно расширить POSITIVE_KEYWORDS, чтобы их поймать (большинство семантически positive — extra Breach content / player soul-steal benefit). Low-priority — не блокирует UX.

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
