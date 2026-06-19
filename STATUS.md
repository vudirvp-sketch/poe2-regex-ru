# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 99

---

## Текущее состояние

**iter 99: alphabetical within-block sort (readability pass).** Внутри каждого функционального блока / sentiment-категории / tablet-type / relic-категории / origin-секции / jewel-type / affix-only группы теперь отсортированы по `familyKey` (Russian locale), с `priorityTier` как tiebreaker. Раньше sort был tier-first (S→A→B→C, потом alpha) — это фрагментировало алфавитный поток внутри блока: в «Атрибутах» все S-tier моды шли сначала, потом A-tier, и т.д. Теперь игрок видит чистый алфавитный поток Сила → Ловкость → Интеллект внутри блока, а tier остаётся цветным бейджем.

Реализация: `sortGroupsAlphabetically()` helper + `withAlphabeticalGroups()` wrapper в `classifyGroups()`. Сортировка применяется единообразно ко всем 9 режимам (affix-only / affix-semantic / affix-functional / jewel-functional / affix-sentiment / tablet-type / relic-semantic / origin / jewel-type). Никаких изменений в `public/generated/*.json` — сортировка чисто runtime, не ETL. `groupTokensByFamily()` первоначальный sort (affix → tier → alpha) сохранён для обратной совместимости, но `classifyGroups()` переписывает within-block order поверх него.

### Метрики (без изменений vs iter 94-98)

| Категория | Токенов | Family-groups | functionalCategory | other-bucket | ailments | damage-type |
|-----------|---------|---------------|--------------------|--------------|----------|-------------|
| jewel | 193 | 193 | 100% | 8.3% (16/193) | 29 | 24 |
| amulet | 428 | 105 | 100% | 6.7% (7/105) | 1 | 6 |
| ring | 369 | 94 | 100% | 3.2% (3/94) | 4 | 18 |
| belt | 298 | 85 | 100% | 4.7% (4/85) | 3 | 7 |
| relic | 80 | 25 | N/A (text-only) | N/A | — | — |

- **Strategy 0 coverage:** 477/477 (100%) — ring/amulet/belt/jewel
- **Cross-validation:** 477/477 match (0 расхождений)
- **Тесты:** 1411/1411 passing (1392 + 19 новых iter 99). TSC: 0 errors. ESLint: 0 новых ошибок (17 предсуществующих в verify-iter90-* и VirtualizedModList warnings).
- **ETL:** 11 fresh, 0 stale, 0 missing. Никаких изменений в `public/generated/*.json`.

### Архитектура functionalCategory (без изменений vs iter 96)

1. **ETL pipeline** (`scripts/etl/classify-functional-category.ts`): `classifyModFunctionalBlock(tags, rawText)` — 22-шаговый классификатор. `buildFunctionalCategoryMap()` строит modId→category из ModCalc страниц.
2. **i18n overrides** (`scripts/run-etl.ts` `applyI18nOverrides()`): re-classify functionalCategory после патча rawText на русский.
3. **Runtime** (`src/shared/mod-classifier.ts` `classifyFunctionalBlock()`): Strategy 0 — majority voting по `functionalCategory` с токенов (ETL данные). Fallback `return 'other';`.

### iter 99: что изменилось

- **`src/shared/mod-classifier.ts`** — добавлены `sortGroupsAlphabetically(groups)` (экспортируемая, для unit-тестов) и `withAlphabeticalGroups(result)` (приватная wrapper). `sortGroupsAlphabetically` сортирует по `familyKey` (с strip `::origin` suffix для origin-split групп), Russian locale, с `priorityTier` как tiebreaker. Возвращает новый массив (не мутирует input, сохраняет FamilyGroup references). `withAlphabeticalGroups` применяется ко всем 10 return-точкам `classifyGroups()` (9 режимов + fallback).
- **`tests/shared/mod-classifier.test.ts`** — добавлено 19 unit-тестов в двух `describe`-блоках: 10 на `sortGroupsAlphabetically` (new array / preserve refs / empty input / single element / Russian alpha / familyKey vs displayText / tier as tiebreaker not primary / ::origin strip / mixed scripts) + 9 на интеграцию с `classifyGroups` (affix-functional / relic-semantic / tablet-type / affix-sentiment / affix-only / jewel-functional / preserve refs / render order preserved / tier не фрагментирует alpha).
- **`scripts/verify-iter99-alpha-sort.ts`** — audit-скрипт: печатает within-block order для amulet/ring/belt, prefix+suffix. Подтверждает, что на production данных alphabetical flow работает (например, в «Атрибутах» amulet suffix: интеллекту → ловкость → силе → всем характеристикам (S-tier «всем» в конце, не в начале)).
- **Документация актуализирована:** `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`.

### Пример: amulet suffix «Атрибуты» (10 groups, iter 99)

```
[C] #% увеличение силы, ловкости или интеллекта
[C] #% уменьшение требований к характеристикам у снаряжения и камней умений
[C] +# к интеллекту
[C] +# к ловкости
[C] +# к ловкости и интеллекту
[C] +# к силе
[C] +# к силе и интеллекту
[C] +# к силе и ловкости
[C] +# к силе, ловкости или интеллекту
[S] +# ко всем характеристикам
```

До iter 99 S-tier «+# ко всем характеристикам» шёл бы первым, фрагментируя алфавитный поток. Теперь — в конце, по алфавиту.

---

## Known Issues

1. **2 opt-table entries > 250 chars** в jewel.json — не помещаются в один PoE2 regex.
2. **j05iep stays crit** — `jewel.mod_j05iep` «сила наносящих урон состояний при крит» имеет tags `[damage, critical, ailment]` и остаётся в `crit` (CRIT шаг 14 выигрывает у AILMENTS шаг 15 в ETL classifier). Intentional — critical tag семантически важнее.

---

## Открытые долги

- **Wisps/Conversion блоки**: 0 family-keys в текущих данных. Зарезервированы для future-compat.
- **P1-P4 (iter 99 прогресс)**:
  - ✅ **alphabetical within-block sort** (iter 99 DONE) — все 9 режимов получают alphabetical order в sub-group'ах.
  - ⏳ **sortKey?**: опционально добавить `sortKey?: number` в `FamilyGroup` + ETL заполняет на основе functionalCategory + popularity research. iter 99 решил UX-задачу без sortKey (alphabetical + tier tiebreaker достаточно), но sortKey остаётся как future-compat для более сложных схем сортировки.
  - ⏳ **waystone/tablet sub-blocks**: sub-группировка внутри sentiment (positive/negative/neutral) по gameplay mechanic — для waystone: loot/danger/splinters; для tablet: ritual/breach/delirium уже есть как type, нужен второй уровень внутри type.
  - ⏳ **tier-aware сортировка (toggle)**: S+/S/All приоритеты внутри блоков (vs текущий priorityFilter, который только фильтрует, не сортирует). iter 99 сделал tier вторичным, но UI-тумблер «режим сортировки» (alpha vs tier-first) не добавлен — оставлен на future iter.
  - ⏳ **UI-тумблер «режим сортировки»**: опционально добавить переключатель alpha / tier-first в `CategoryControlPanel`.

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
