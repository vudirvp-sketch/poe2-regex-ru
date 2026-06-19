# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 100

---

## Текущее состояние

**iter 100: cleanup устаревших iter*-скриптов (продолжение iter 97).** Удалено 16 исторических `verify-iter*-*.ts` / `simulate-iter-*-impact.ts` / `analyze-iter-*-other-bucket.ts` скриптов + 1 stale tracker (`DELETED-FILES-iter92.txt`). Все они — одноразовые audit/simulation-скрипты для конкретных итераций (iter 49–95), верифицировали изменения, которые давно в продакшене и покрыты unit-тестами в `tests/`. После iter 96 (удалил runtime regex fallback) и iter 91 (ETL 100% coverage) они стали мёртвым кодом.

ESLint: **17 problems → 2 problems** (15 errors → 0 errors, осталось 2 warnings в `VirtualizedModList.tsx` от TanStack Virtual — library-level, не относятся к нашему коду).

### iter 100: что изменилось

- **Удалено 17 файлов:**
  - 8 verify-скриптов: `verify-iter49.ts`, `verify-iter89-deployment.ts`, `verify-iter90-cross-validation.ts`, `verify-iter90-etl-functional-category.ts`, `verify-iter91-discrepancies.ts`, `verify-iter91-strategy0.ts`, `verify-iter92-fixes.ts`, `verify-iter94-fixes.ts`, `verify-iter95-stability.ts`
  - 5 simulate-скриптов: `simulate-iter86-impact.ts`, `simulate-iter87-impact.ts`, `simulate-iter88-impact.ts`, `simulate-iter89-impact.ts`, `simulate-iter94-impact.ts`
  - 2 analyze-скрипта: `analyze-iter88-other-bucket.ts`, `analyze-iter89-other-bucket.ts`
  - 1 stale tracker: `DELETED-FILES-iter92.txt` (iter 97 commit message упоминал удаление, но файл остался на диске — теперь реально удалён)
- **Сохранено:** `scripts/verify-iter99-alpha-sort.ts` (текущий audit-скрипт), все `scripts/etl/*.ts`, все non-iter-specific scripts (`prerender.ts`, `analyze-regexes.ts`, `run-etl.ts` и т.д.).
- **Никаких изменений** в `src/`, `tests/`, `public/generated/*.json`, ETL pipeline.

### Метрики (без изменений vs iter 94-99)

| Категория | Токенов | Family-groups | functionalCategory | other-bucket | ailments | damage-type |
|-----------|---------|---------------|--------------------|--------------|----------|-------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) | 29 | 24 |
| amulet | 428 | 105 | 100% | 6.7% (7/105) | 1 | 6 |
| ring | 369 | 94 | 100% | 3.2% (3/94) | 4 | 18 |
| belt | 298 | 85 | 100% | 4.7% (4/85) | 3 | 7 |
| relic | 80 | 25 | N/A (text-only) | N/A | — | — |

- **Strategy 0 coverage:** 477/477 (100%) — ring/amulet/belt/jewel
- **Cross-validation:** 477/477 match (0 расхождений)
- **Тесты:** 1411/1411 passing (без изменений vs iter 99). TSC: 0 errors. ESLint: **2 warnings** (VirtualizedModList TanStack, library-level).
- **ETL:** 11 fresh, 0 stale, 0 missing. Никаких изменений в `public/generated/*.json`.

### Архитектура functionalCategory (без изменений vs iter 96)

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`): `classifyModFunctionalBlock(tags, rawText)` — 22-шаговый классификатор. `buildFunctionalCategoryMap()` строит modId→category из ModCalc страниц.
2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`): re-classify functionalCategory после патча rawText на русский.
3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`): Strategy 0 — majority voting по `functionalCategory` с токенов (ETL данные). Fallback `return 'other';`.

### История sort-логики (найдено при расследовании iter 100)

Пользователь заметил, что «ранее была группировка и сортировка, но на какой-то итерации видимо была удалена». Расследование показало:

- **iter e010349 (v7.0 Family Pooling):** `groupTokensByFamily()` изначально сортировал **purely alphabetically** — `affix → familyKey.localeCompare('ru')`. Чистый алфавитный поток.
- **Session 70 (commit `06cea49`):** добавлен **tier-first sort** — `affix → tier (S→A→B→C) → alpha`. Это изменило UX: внутри функционального блока S-tier моды шли сначала, потом A-tier, фрагментируя алфавитный поток.
- **iter 96 (commit `c54a3da`):** удалил 22-шаговый regex fallback из `classifyFunctionalBlock()`. **Grouping не затронут** — `FUNCTIONAL_BLOCK_LABELS` + `FUNCTIONAL_BLOCK_ORDER` сохранены, `classifyGroups()` работает как прежде. Просто runtime классификация теперь использует ETL `functionalCategory` вместо regex patterns (100% coverage с iter 91).
- **iter 97 (commit `4067def`):** удалил 16 исторических audit-скриптов. **Grouping/sort-логика не затронута.**
- **iter 99:** восстановил alphabetical flow **внутри блоков** через `sortGroupsAlphabetically()` wrapper. Tier-first sort в `groupTokensByFamily()` сохранён для обратной совместимости, но `classifyGroups()` переписывает within-block order поверх него.

**Вывод:** «Удаления группировки» не было — была замена pure-alpha на tier-first в Session 70, что iter 99 исправил. iter 96/97 удаляли мёртвый код (regex fallback + audit-скрипты), не grouping-логику.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.
3. **VirtualizedModList.tsx TanStack warnings (2)** — `react-hooks/incompatible-library` warnings от `useVirtualizer()`. Library-level, не наш код. Можно подавить через `// eslint-disable-next-line` или дождаться апстрим-фикса.

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
