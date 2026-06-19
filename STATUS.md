# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 97

---

## Текущее состояние

**iter 97: аудиторская чистка тестов и исторических скриптов.** Удалены 16 исторических `simulate-iter*`/`verify-iter*`/`analyze-iter*` скриптов (2774 строки) — они содержали mirror-копии regex-паттернов, удалённых из runtime в iter 96, и не могли дать новой информации. Тест на `sanitizeJsObjectLiteral()` исправлен: функция теперь экспортирована из `scripts/etl/parse-modifiers-calc.ts` и импортируется в тест напрямую (раньше тест дублировал реализацию и не проверял production-код). Все 1363 теста зелёные, TSC 0 errors, ESLint 0 errors в изменённых файлах.

### Метрики (без изменений vs iter 94/95/96)

| Категория | Токенов | Family-groups | functionalCategory | other-bucket | ailments | damage-type |
|-----------|---------|---------------|--------------------|--------------|----------|-------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) | 29 | 24 |
| amulet | 428 | 105 | 100% | 6.7% (7/105) | 1 | 6 |
| ring | 369 | 94 | 100% | 3.2% (3/94) | 4 | 18 |
| belt | 298 | 85 | 100% | 4.7% (4/85) | 3 | 7 |

- **Strategy 0 coverage:** 477/477 (100%)
- **Cross-validation:** 477/477 match (0 расхождений)
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors.

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
   - Waystone/tablet/relic не используют `classifyFunctionalBlock()`.

### iter 97: что изменилось

- **Удалено 16 исторических скриптов** (2774 строки):
  - `simulate-iter86/87/88/89/94-impact.ts` (5 файлов) — mirror-копии regex-паттернов для симуляции impact прошлых итераций. Паттерны удалены из runtime в iter 96, симуляции стали неактуальны.
  - `analyze-iter88/89-other-bucket.ts` (2 файла) — snapshot-дампы `other` bucket на момент iter 88/89. Уже устарели.
  - `verify-iter49.ts` — верификация Pitfall 11 fix (multi-LITERAL AND+EXCLUDE inside OR). Логика уже покрыта в `tests/core/compiler.test.ts` и `tests/ui/buildAstFromSelections.test.ts`.
  - `verify-iter89-deployment.ts`, `verify-iter90-cross-validation.ts`, `verify-iter90-etl-functional-category.ts`, `verify-iter91-discrepancies.ts`, `verify-iter91-strategy0.ts`, `verify-iter92-fixes.ts`, `verify-iter94-fixes.ts`, `verify-iter95-stability.ts` (8 файлов) — cross-validation снапшоты прошлых итераций. Дублируют друг друга и `tests/etl/cross-validation.test.ts`. Audit-trail сохранён в git.
- **`tests/etl/sanitize-js-object-literal.test.ts`** — теперь импортирует `sanitizeJsObjectLiteral` напрямую из `@etl/parse-modifiers-calc` (раньше дублировал реализацию внутри теста, что означало, что тест не проверял production-код).
- **`scripts/etl/parse-modifiers-calc.ts`** — `sanitizeJsObjectLiteral()` теперь `export function` (раньше была module-private).
- **`src/shared/mod-classifier.ts`** — обновлён комментарий к weapon fallback: удалена ссылка на удалённый `simulate-iter87-impact.ts`.
- **`scripts/etl/classify-functional-category.ts`** — обновлён комментарий к AILMENTS_PATTERN: удалена ссылка на удалённый `simulate-iter94-impact.ts`.
- **Документация актуализирована:** `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`, `docs/AFFIXES_GROUPING_ANALYSIS.md` — удалены упоминания удалённых скриптов.
- **Удалён `DELETED-FILES-iter92.txt`** — stale tracker от iter 92 (содержал только имена 3 файлов, удалённых в iter 92; git уже хранит их историю).

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
