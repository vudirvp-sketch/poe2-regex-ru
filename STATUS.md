# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 98

---

## Текущее состояние

**iter 98: relic-semantic grouping mode.** На странице реликвий добавлена семантическая подгруппировка: 25 family-keys (12 suffix + 13 prefix), которые раньше лежали в одной корзине (`affix-only`), теперь разбиты на 7 Sanctum-категорий: Честь / Святая вода / Испытания / Ключи / Торговец / Монстры / Проклятия. Классификатор (`classifyRelicCategory()`) — text-only, использует устойчивые подстроки (`чест`, `святой воды`, `испытан`, `ключ`, `торгов`, `монстр|босс`, `проклят`); порядок проверок критичен (honor → monsters, чтобы «Восстанавливает # чести при убийстве босса» не ушло в monsters). 100% покрытие 25 family-keys, 0 в `other`. Добавлено 29 unit-тестов (1392/1392 passing). TSC 0 errors, ESLint 0 errors. Никаких изменений в `public/generated/*.json`.

### Метрики (без изменений vs iter 94-97)

| Категория | Токенов | Family-groups | functionalCategory | other-bucket | ailments | damage-type |
|-----------|---------|---------------|--------------------|--------------|----------|-------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) | 29 | 24 |
| amulet | 428 | 105 | 100% | 6.7% (7/105) | 1 | 6 |
| ring | 369 | 94 | 100% | 3.2% (3/94) | 4 | 18 |
| belt | 298 | 85 | 100% | 4.7% (4/85) | 3 | 7 |
| relic | 80 | 25 | N/A (text-only) | N/A | — | — |

- **Strategy 0 coverage:** 477/477 (100%) — ring/amulet/belt/jewel
- **Cross-validation:** 477/477 match (0 расхождений)
- **Тесты:** 1392/1392 passing. TSC: 0 errors. ESLint: 0 errors.

### Архитектура functionalCategory (без изменений vs iter 96)

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`):
   - `classifyModFunctionalBlock(tags, rawText)` — standalone 22-шаговый классификатор (используется при ETL-сборке).
   - `buildFunctionalCategoryMap()` — строит modId→category из ModCalc страниц.
   - Jewellery (amulet/ring/belt): прямая классификация по tags+rawText.

2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`):
   - re-classify functionalCategory после патча rawText на русский.

3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`):
   - **Strategy 0 (единственный путь):** majority voting по `functionalCategory` с токенов (ETL данные).
   - **Fallback:** `return 'other';` для групп без ETL-тега (waystone/tablet/relic не используют эту функцию; в продакшене все 477 family-groups имеют ETL-тег).
   - Waystone/tablet/relic не используют `classifyFunctionalBlock()`. **relic теперь использует `classifyRelicCategory()` (iter 98).**

### iter 98: что изменилось

- **`src/shared/mod-classifier.ts`** — добавлен `RelicCategory` type (8 значений: honor / sanctum-water / trials / keys / merchant / monsters / curse / other), `RELIC_LABELS` (display config), 7 keyword-паттернов, `classifyRelicCategory()` функция, `'relic-semantic'` mode в `ModGroupMode` type + handling в `classifyGroups()`. Порядок паттернов: honor → sanctum-water → trials → keys → merchant → curse → monsters → other (honor первым, чтобы «чести при убийстве босса» не ушло в monsters).
- **`src/ui/pages/relic/RelicPage.tsx`** — `groupMode` изменён с `'affix-only'` на `'relic-semantic'`. Заголовок файла обновлён.
- **`tests/shared/mod-classifier.test.ts`** — добавлено 29 unit-тестов: 15 на `classifyRelicCategory()` (по 1-6 на каждую категорию + проверка order для «чести при убийстве босса»), 6 на `classifyGroups(mode='relic-semantic')` (пустой ввод / full coverage 25 family-keys / render order / skip empty / labels / group refs), 2 sanity-теста на `RELIC_LABELS`.
- **Документация актуализирована:** `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`.

### Распределение 25 family-keys relic.json по 7 категориям

| Категория | Group count | Примеры |
|-----------|-------------|---------|
| honor | 10 | `Восстанавливает # чести при завершении комнаты`, `+#% к сопротивлению чести`, `#% увеличение максимума чести` |
| monsters | 7 | `Монстры получают увеличенный на #% урон`, `Боссы наносят уменьшенный на #% урон`, `Скорость ... монстров снижена на #%` |
| trials | 2 | `На карте испытаний раскрывается дополнительная комната`, `...дополнительных комнат: #` |
| keys | 2 | `Когда вы получаете ключ, вы с #% шансом получаете еще один`, `#% шанс для каждого из ваших ключей улучшиться...` |
| merchant | 2 | `#% снижение цен у торговца`, `Торговец предлагает дополнительный товар на выбор` |
| sanctum-water | 1 | `Дарует святой воды по завершению вами комнаты: #` |
| curse | 1 | `#% шанс избежать получения проклятия` |
| other | 0 | (fallback, 0 family-keys в текущих данных) |

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.

---

## Открытые долги

- **Wisps/Conversion блоки**: 0 family-keys в текущих данных. Зарезервированы для future-compat — если появятся моды с этими характеристиками, блоки активируются автоматически через Strategy 0.
- **P1-P3 (частично начаты в iter 98)**:
  - ✅ **relic-semantic** (iter 98 DONE) — 7 категорий, 100% покрытие.
  - ⏳ **sortKey** (сортировка внутри функциональных блоков) — не начато.
  - ⏳ **waystone/tablet sub-blocks** (sub-группировка внутри sentiment/type) — не начато.
  - ⏳ **tier-aware сортировка** (S+/S/All приоритеты внутри блоков) — не начато.

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
