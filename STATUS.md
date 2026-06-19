# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 95

---

## Текущее состояние

**ETL-tagged functionalCategory — полностью в продакшене.** Все 4 категории (jewel/amulet/ring/belt) содержат `functionalCategory` на 100% токенов. Runtime `classifyFunctionalBlock()` использует Strategy 0 (ETL lookup) для всех 477 family-groups.

**iter 95: документационная чистка + deprecation-маркер для regex-паттернов.** Regex-паттерны в `classifyFunctionalBlock()` помечены как DEPRECATED safety-net (Strategy 0 покрывает 100% family-groups в продакшене). Regex сохранён для: (1) unit-тестов, (2) отладки ETL-расхождений, (3) future-proofing на случай новых модов без ETL rerun. Wisps/Conversion блоки задокументированы как RESERVED-FOR-FUTURE (0 family-keys в текущих данных, но оставлены для forward-compat). Никаких функциональных изменений — только комментарии и документация.

### Метрики (после iter 94, без изменений в iter 95)

| Категория | Токенов | Family-groups | functionalCategory | other-bucket | ailments | damage-type |
|-----------|---------|---------------|--------------------|--------------|----------|-------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) | 29 | 24 |
| amulet | 428 | 105 | 100% | 6.7% (7/105) | 1 | 6 |
| ring | 369 | 94 | 100% | 3.2% (3/94) | 4 | 18 |
| belt | 298 | 85 | 100% | 4.7% (4/85) | 3 | 7 |

- **Strategy 0 coverage:** 477/477 (100%)
- **Cross-validation:** 477/477 match (0 расхождений)
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors в изменённых файлах.

### Архитектура functionalCategory

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`):
   - `classifyModFunctionalBlock(tags, rawText)` — standalone классификатор (22 шага)
   - `buildFunctionalCategoryMap()` — строит modId→category из ModCalc страниц
   - iter 92: двухпроходная обработка (single-segment tiers перед multi-segment)
   - iter 93: `PENETRATION_PATTERN` перед resistances
   - iter 94: AILMENTS (tag `ailment` + AILMENTS_PATTERN) перед DAMAGE_TYPE; CRIT (шаг 14) выигрывает у AILMENTS (шаг 15)
   - Jewellery (amulet/ring/belt): прямая классификация по tags+rawText

2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`):
   - iter 92: re-classify functionalCategory после патча rawText на русский

3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`):
   - **Strategy 0:** majority voting по `functionalCategory` с токенов (ETL данные) — production path
   - **Regex fallback (DEPRECATED iter 95):** 21 шаг regex-паттернов — safety-net только
   - iter 95: deprecation-комментарий добавлен перед regex-секцией; план удаления задокументирован
   - Waystone/tablet/relic не используют `classifyFunctionalBlock()`

### iter 95: что изменилось

- `src/shared/mod-classifier.ts`:
  - Добавлен DEPRECATION NOTICE в `classifyFunctionalBlock()` — описывает, почему regex сохранён (тесты/отладка/future-proofing) и план удаления в будущей итерации.
  - Обновлён комментарий `FUNCTIONAL_BLOCK_ORDER` — `wisps`/`conversion` задокументированы как RESERVED-FOR-FUTURE (0 family-keys, но оставлены для forward-compat).
- `STATUS.md` + `worklog.md` + `AGENT_NAVIGATION.md` — актуализированы для iter 95 (сжатие истории iter 94, исправление устаревших метрик).
- `scripts/verify-iter95-stability.ts` — sanity-check скрипт (тесты + cross-validation + ETL-metrics).

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15). Intentional — critical tag семантически важнее. Если в будущем понадобится реклассифицировать — переместить AILMENTS перед CRIT (но это может сломать другие crit-ailment моды).

---

## Открытые долги

- **Убрать regex-паттерны из classifyFunctionalBlock()** — стратегия удаления задокументирована в iter 95 DEPRECATION NOTICE. Требует предварительного рефакторинга тестов (80+ тестов используют `makeGroup()` без `functionalCategory`).
- **Wisps/Conversion блоки**: 0 family-keys в текущих данных. Зарезервированы для future-compat — если появятся моды с этими характеристиками, блоки активируются автоматически через Strategy 0.
- **P1-P3** (не начаты):
  - sortKey (сортировка внутри функциональных блоков)
  - waystone/tablet sub-blocks (sub-группировка внутри sentiment/type)
  - relic-semantic mode (relic сейчас affix-only без подгрупп — 25 groups в одной корзине)
  - tier-aware сортировка (S+/S/All приоритеты)
  - hideLabel auto-suppression — УЖЕ РЕАЛИЗОВАНО в iter 62 (ModList.tsx:206,244,413) — устаревшая запись в списке задач.

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
