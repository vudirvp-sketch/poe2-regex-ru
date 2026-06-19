# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 96

---

## Текущее состояние

**iter 96: regex-паттерны удалены из `classifyFunctionalBlock()`.** Функция теперь — тонкая Strategy 0 обёртка: если у членов группы есть ETL-тег `functionalCategory`, возвращается большинство; иначе — `'other'`. Все 280 unit-тестов в `tests/shared/mod-classifier.test.ts` отрефакторены: каждый тест вызывает `makeGroup()` с `functionalCategory` override, чтобы execise Strategy 0 (как в продакшене). Тесты с ожидаемым `'other'` оставляют `functionalCategory` пустым — fallback срабатывает напрямую. 22-шаговый regex-классификатор сохранён в ETL (`scripts/etl/classify-functional-category.ts`) — он используется при ETL-сборке для заполнения `functionalCategory`, runtime его больше не вызывает.

### Метрики (без изменений vs iter 94/95)

| Категория | Токенов | Family-groups | functionalCategory | other-bucket | ailments | damage-type |
|-----------|---------|---------------|--------------------|--------------|----------|-------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) | 29 | 24 |
| amulet | 428 | 105 | 100% | 6.7% (7/105) | 1 | 6 |
| ring | 369 | 94 | 100% | 3.2% (3/94) | 4 | 18 |
| belt | 298 | 85 | 100% | 4.7% (4/85) | 3 | 7 |

- **Strategy 0 coverage:** 477/477 (100%)
- **Cross-validation:** 477/477 match (0 расхождений)
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors в изменённых файлах.

### Архитектура functionalCategory (iter 96)

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`):
   - `classifyModFunctionalBlock(tags, rawText)` — standalone 22-шаговый классификатор (используется при ETL-сборке).
   - `buildFunctionalCategoryMap()` — строит modId→category из ModCalc страниц.
   - iter 92: двухпроходная обработка (single-segment tiers перед multi-segment).
   - iter 93: `PENETRATION_PATTERN` перед resistances.
   - iter 94: AILMENTS (tag `ailment` + AILMENTS_PATTERN) перед DAMAGE_TYPE; CRIT (шаг 14) выигрывает у AILMENTS (шаг 15).
   - Jewellery (amulet/ring/belt): прямая классификация по tags+rawText.

2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`):
   - iter 92: re-classify functionalCategory после патча rawText на русский.

3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`):
   - **Strategy 0 (единственный путь, iter 96):** majority voting по `functionalCategory` с токенов (ETL данные).
   - **Fallback:** `return 'other';` для групп без ETL-тега (waystone/tablet/relic не используют эту функцию; в продакшене все 477 family-groups имеют ETL-тег).
   - iter 96: regex fallback (steps 1-21) и pattern constants удалены из runtime. Pattern logic сохранена в ETL classifier.
   - Waystone/tablet/relic не используют `classifyFunctionalBlock()`.

### iter 96: что изменилось

- `src/shared/mod-classifier.ts`:
  - Удалены 22-шаговый regex fallback (steps 1-21) + `allTags` коллекция + DEPRECATION NOTICE.
  - Удалены 21 неиспользуемых pattern constants (SPIRIT_PATTERN, SKILL_LEVELS_PATTERN, ATTRIBUTES_PATTERN, RESISTANCES_PATTERN, PENETRATION_PATTERN, RUNES_BARRIER_PATTERN, MAGIC_FIND_PATTERN, BREACH_PATTERN, FLASKS_PATTERN, MINIONS_PATTERN, RESOURCES_PATTERN, DEFENCE_STATS_PATTERN, CRIT_PATTERN, DAMAGE_TYPE_PATTERN, OFFENCE_SPEED_PATTERN, WEAPON_SPECIFIC_PATTERN, AILMENTS_PATTERN, AREA_DURATION_PATTERN, RAGE_CHARGES_PATTERN, META_SKILLS_PATTERN, BUFF_SKILLS_PATTERN).
  - Функция стала тонкой обёрткой над Strategy 0.
  - JSDoc обновлён — отражает iter 96 архитектуру.
- `tests/shared/mod-classifier.test.ts`:
  - `makeGroup()` helper принимает `functionalCategory` override — инжектится во все члены (или создаёт synthetic member).
  - `makeToken()` helper принимает optional `functionalCategory` 3-м параметром.
  - 140+ тестов обновлены: каждый `classifyFunctionalBlock` тест с ожидаемым non-`'other'` результатом теперь устанавливает `functionalCategory`. Тесты с ожидаемым `'other'` оставлены без `functionalCategory`.
  - Все 10 `classifyGroups` тестов обновлены вручную (скрипт не покрывал их, т.к. assertions на `classifyGroups`, не на `classifyFunctionalBlock`).
  - Все 280 тестов зелёные.
- `docs/AFFIXES_GROUPING_ANALYSIS.md`:
  - `hideLabel auto-suppression` помечен как **done iter 62** (устаревшая запись в списке задач).
  - `Приоритет тегов вместо first-match` помечен как устаревший (iter 96: теги больше не используются runtime).
- `STATUS.md` + `worklog.md` + `AGENT_NAVIGATION.md` — актуализированы для iter 96.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.

---

## Открытые долги

- **Wisps/Conversion блоки**: 0 family-keys в текущих данных. Зарезервированы для future-compat — если появятся моды с этими характеристиками, блоки активируются автоматически через Strategy 0.
- **P1-P3** (не начаты):
  - sortKey (сортировка внутри функциональных блоков)
  - waystone/tablet sub-blocks (sub-группировка внутри sentiment/type)
  - relic-semantic mode (relic сейчас affix-only без подгрупп — 25 groups в одной корзине)
  - tier-aware сортировка (S+/S/All приоритеты)

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
