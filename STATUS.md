# PoE2 Regex RU — Статус проекта

> **Репозиторий:** https://github.com/vudirvp-sketch/poe2-regex-ru
> **Онлайн:** https://vudirvp-sketch.github.io/poe2-regex-ru/
> **Текущая итерация:** 90 (OP-1 Phase 2 — ETL-tagged functionalCategory для jewel/jewellery)

---

## iter 90 — ETL-tagged functionalCategory

Реализована ETL-tagged классификация `functionalCategory` по образцу `jewelType` (iter 90 P1 task). Каждый токен jewel/amulet/ring/belt получает поле `functionalCategory` во время ETL, что даёт ~100% точность классификации без хрупких regex'ов в runtime.

### Что сделано

**Новое поле `functionalCategory` на GameToken:**
- Добавлено `functionalCategory?: string` в `GameToken` (types.ts)
- Заполняется при ETL через `buildFunctionalCategoryMap()` (аналог `buildJewelTypeMap`)
- Runtime `classifyFunctionalBlock()` проверяет `functionalCategory` первым (Strategy 0), fallback — regex-паттерны

**Новый модуль ETL: `scripts/etl/classify-functional-category.ts`:**
- `classifyModFunctionalBlock(tags, rawText)` — standalone классификатор для одного мода
- `buildFunctionalCategoryMap(allJewelMods, allJewelleryMods)` — строит modId→functionalCategory
- Паттерны — точные копии из mod-classifier.ts (100% match на cross-validation)
- Стратегия: ModCalc tags → text patterns → fallback классификация

**Интеграция в `scripts/run-etl.ts`:**
- Добавлен импорт `buildFunctionalCategoryMap`
- Собираются `allJewelleryMods` (amulet/ring/belt) наряду с `allJewelMods`
- `buildFunctionalCategoryMap()` вызывается после `buildJewelTypeMap()`
- JSON-файлы jewel/amulet/ring/belt патчатся `functionalCategory`

**Обновлён `classifyFunctionalBlock()` в mod-classifier.ts:**
- Strategy 0: Lookup из ETL данных (если `functionalCategory` есть на токенах)
- Использует majority voting по всем членам FamilyGroup
- Валидирует категорию против `FUNCTIONAL_BLOCK_ORDER`
- Fallback на regex-паттерны если ETL данные отсутствуют

**Обновлён `scripts/etl/generate-dictionary.ts`:**
- `assembleGameToken()` принимает `functionalCategory?: string`
- `assembleCategoryData()` принимает `functionalCategoryMap?: Record<string, string>`

**Верификация:**
- Cross-validation: 0 расхождений между ETL classifier и runtime classifier по всем 477 family-groups (jewel/amulet/ring/belt)
- other-bucket: jewel 8.3% (16/193), amulet 6.7% (7/105), ring 3.2% (3/94), belt 4.7% (4/85) — без изменений (ETL точно повторяет regex)
- Тесты: 1363/1363 passing. TSC: 0 errors. Lint: 0 errors.

### Файлы, изменённые в iter 90

- `src/shared/types.ts` — +4 строки: `functionalCategory?: string` на GameToken
- `src/shared/mod-classifier.ts` — +27 строк: Strategy 0 lookup в `classifyFunctionalBlock()`
- `scripts/etl/classify-functional-category.ts` — новый модуль (~265 строк)
- `scripts/etl/generate-dictionary.ts` — +4 строки: functionalCategory в assembleGameToken/assembleCategoryData
- `scripts/run-etl.ts` — +30 строк: import buildFunctionalCategoryMap, allJewelleryMods, functionalCategoryMap, patch jewellery JSON files
- `scripts/verify-iter90-etl-functional-category.ts` — скрипт верификации
- `scripts/verify-iter90-cross-validation.ts` — скрипт cross-validation
- `STATUS.md` — актуализация под iter 90

### Что НЕ сделано (намеренно, ждёт iter 91+)

- **Запуск полного ETL** для генерации `functionalCategory` в `public/generated/*.json` — требует `pnpm etl` с доступом к poe2db.tw (3 ModCalc страницы). Текущие JSON файлы пока не содержат `functionalCategory` — это нормально, runtime fallback на regex паттерны работает.
- **3 оставшихся блока** (wisps, conversion, penetration) — не реализованы. В jewel.json `other` = 0 family-keys с этими паттернами.
- **P1–P3** (sortKey + groupingMode toggle, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression, приоритет тегов, визуальная сепарация) — не начаты.

### План iter 91

1. Запустить полный ETL (`pnpm etl --fresh`) для генерации `functionalCategory` в JSON файлах.
2. Верифицировать `functionalCategory` в сгенерированных JSON через cross-validation.
3. Если `functionalCategory` работает корректно — можно постепенно заменить regex-паттерны в `classifyFunctionalBlock()` на чистый ETL lookup (убрать Strategy 1-20).
4. Опционально: реализовать оставшиеся блоки (wisps/conversion/penetration).

---

## Known Issues

Открытых Known Issues нет.

## Открытые долги

- **OP-1** (iter 82-90): перегруппировка аффиксов. iter 82 — анализ. iter 83 — верификация. iter 84 — 3 P0-фикса. iter 85 — инфраструктура 24 функциональных блоков (7 активны). iter 86 — +7 блоков (14 активны) + production switch для ring/amulet/belt (other-bucket 9.9%). iter 87 — weapon sub-blocks для jewel (6 подблоков для 24 family-key) + production switch для jewel (other-bucket 21.8%). iter 88 — +2 блока (ailments + area-duration, 17 активны) + UX-фикс «Магический поиск»→«Рарити» (jewel other-bucket 14.0%). iter 89 — +3 блока (rage-charges + meta-skills + buff-skills, 20 активны) (jewel other-bucket 8.3%, бонусные улучшения для amulet/ring/belt). iter 90 — ETL-tagged functionalCategory (P1 task): `functionalCategory` поле на GameToken, `buildFunctionalCategoryMap()` в ETL, Strategy 0 lookup в `classifyFunctionalBlock()`, 100% match с regex на cross-validation.

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
