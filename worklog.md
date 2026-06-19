# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 102
Agent: main
Task: Закрыть gap iter 101 — добавить e2e-регрессионные тесты для runtime-classification pipeline, чтобы bug-сценарий iter 90-100 (Zod strips `functionalCategory` → все affixes в `other`) детектировался сразу, а не пользователем на production. Требование пользователя: «лучше недоделать, чем сломать» → выбрать самый безопасный пункт из roadmap iter 101 (рекомендованный: «расширить e2e-тестирование — tests/integration/»). Никаких изменений в runtime/ETL/JSON.

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Чтение STATUS.md (iter 101 — P0-фикс Critical Bug #4), worklog.md (iter 101 подробно), AGENT_NAVIGATION.md (структура + Roadmap + Pitfall #34). Подтверждение baseline: `npx vitest run` → 1414/1414 passing; `npx tsc -b` → 0 errors; `npx eslint .` → 0 errors + 2 warnings (TanStack library-level).
- 2: Анализ gap. iter 101 добавил регрессионные тесты только в `tests/etl/etl-schemas.test.ts` (3 теста на field preservation) — они проверяют что `CategoryDataSchema.parse()` сохраняет `functionalCategory`, но НЕ проверяют, что runtime classifier (`groupTokensByFamily` → `classifyGroups`) реально использует это поле для разделения на functional-блоки. `tests/shared/mod-classifier.test.ts` использует synthetic `makeGroup()` fixtures, выставляя `functionalCategory` напрямую — обходит Zod/loader path полностью. Сценарий «schema strips → classifier fails» не покрыт end-to-end.
- 3: Анализ production path:
  - `src/data/loader.ts:24` — `const data = CategoryDataSchema.parse(raw) as CategoryData;` (Zod валидирует).
  - `src/data/loader.ts:45-78` — `loadMergedCategoryData()` — для jewel (3 файла merged).
  - `src/ui/components/ModList.tsx:324` — `groupTokensByFamily(filteredTokens, category)`.
  - `src/ui/components/ModList.tsx:340-345` — split by affix (prefix/suffix/implicit).
  - `src/ui/components/ModList.tsx:358/362` — `classifyGroups(prefixGroups/suffixGroups, groupMode)`.
  - Group modes (по страницам): amulet/ring/belt → `affix-functional`; jewel → `jewel-functional`; waystone → `affix-sentiment`; tablet → `tablet-type`; relic → `relic-semantic`. iter 102 покрывает 4 категории с `functionalCategory` (jewel/amulet/ring/belt) — waystone/tablet/relic вне scope (не используют `functionalCategory`).
- 4: Проверка данных: `python3` inspect `public/generated/{jewel,amulet,ring,belt}.json` — family-groups counts: jewel 193, amulet 105, ring 94, belt 85. merged jewel (3 files) = 210 family-groups. Все токены в 4 категориях имеют `functionalCategory` populated (ETL 100% coverage).
- 5: Создание `tests/integration/runtime-classification.test.ts` (17 тестов):
  - 4 categories × 4 invariants = 16 tests:
    1. `produces multiple functional sub-groups` — `allSubGroups.length > 2` (regression guard: bug → 2 sub-groups с key='other', fix → 23-39 sub-groups).
    2. `classifies family-groups into non-'other' functional blocks` — `nonOtherGroupsCount > 0` AND `≥ totalFamilyGroups / 2` (primary guard: bug → 0, fix → 81-192).
    3. `'other' block does NOT collapse to 100%` — `otherGroupsCount < totalFamilyGroups` (bug → =, fix → <).
    4. `every sub-group has at least one family-group` — defensive: no empty `ModSubGroup` entries.
  - 1 sensitivity test: стрипает `functionalCategory` из raw `belt.json`, парсит через текущую (fixed) схему, проверяет что все family-groups падают в `other` — доказывает, что guards выше реально ловят bug-сценарий iter 90-100.
  - jewel тестит merged-режим (3 файла: jewel + jewel-desecrated + jewel-corrupted), mirroring `loadMergedCategoryData()` в `src/data/loader.ts`.
- 6: Запуск `npx vitest run tests/integration/runtime-classification.test.ts` → 17/17 passing за 13ms.
- 7: Полная verификация: `npx vitest run` → 1431/1431 passing (+17 vs iter 101 baseline). `npx tsc -b` → 0 errors. `npx eslint .` → 0 errors + 2 warnings (TanStack, без изменений).
- 8: Сбор actual-метрик через временный `scripts/_iter102-metrics.ts` (удалён после):
  - jewel (merged): total_FG=210, subGroups=39, nonOther_blocks=37, nonOther_FG=192, other_FG=18.
  - amulet: total_FG=105, subGroups=29, nonOther_blocks=27, nonOther_FG=98, other_FG=7.
  - ring: total_FG=94, subGroups=26, nonOther_blocks=24, nonOther_FG=91, other_FG=3.
  - belt: total_FG=85, subGroups=23, nonOther_blocks=21, nonOther_FG=81, other_FG=4.
  - `other_FG` для amulet/ring/belt точно совпадает с ETL-метриками STATUS.md (7/3/4). jewel merged = 18 (single-file был 16 — добавились desecrated/corrupted origins).
- 9: Документация:
  - `STATUS.md` — iter 102 как текущая; метрики-таблица заменена на новую (с runtime sub-groups/non-other counts); обновлён Known Issue #4 (добавлено «iter 102: +17 e2e-тестов закрывают production path»); архитектура functionalCategory +iter 102 note.
  - `worklog.md` — iter 101 сжат до одной строки, iter 102 добавлен подробно.
  - `AGENT_NAVIGATION.md` — entry paragraph bumped до iter 102; `tests/` секция обновлена (`tests/integration/` добавлено); Pitfall #34 +iter 102 note; Roadmap iter 102 done.

Stage Summary:
- **iter 102 COMPLETE.** e2e-регрессионные тесты для runtime-classification pipeline добавлены. 17 тестов в новом файле `tests/integration/runtime-classification.test.ts` покрывают production path (load JSON → Zod parse → groupTokensByFamily → split-by-affix → classifyGroups) для всех 4 категорий (jewel/amulet/ring/belt). Bug-сценарий iter 90-100 теперь детектится sensitivity-тестом + 4 инвариантами на категорию.
- **Изменённые файлы (4):**
  - `tests/integration/runtime-classification.test.ts` — НОВЫЙ файл, 17 тестов (~190 строк с комментариями).
  - `STATUS.md` — iter 102 как текущая; метрики-таблица с runtime sub-groups/non-other counts; Known Issue #4 +iter 102 note; архитектура +iter 102 note.
  - `worklog.md` — iter 102 подробно, iter 101 одной строкой.
  - `AGENT_NAVIGATION.md` — entry paragraph iter 102; `tests/` секция +integration; Pitfall #34 +iter 102 note; Roadmap iter 102 done.
- **Тесты:** 1414 → 1431 (+17). TSC: 0 errors. ESLint: 0 errors + 2 warnings (TanStack library-level, без изменений). ETL: 11 fresh, 0 stale. Никаких изменений в `public/generated/*.json`, ETL, runtime classifier, схеме.
- **Точка остановки:** iter 102 done. В iter 103+ можно:
  1. **P2 — waystone/tablet sub-blocks**: sub-группировка внутри sentiment (positive/negative/neutral) по gameplay mechanic — для waystone: loot/danger/splinters; для tablet: ritual/breach/delirium уже есть как type, нужен второй уровень внутри type.
  2. **P4 — tier-aware sort toggle**: UI-тумблер «режим сортировки» (alpha vs tier-first) в `CategoryControlPanel`. iter 99 сделал tier вторичным, но toggle не добавлен.
  3. **Опционально: подавить 2 TanStack warnings** в `VirtualizedModList.tsx` через `// eslint-disable-next-line react-hooks/incompatible-library` (довести ESLint до 0 problems).
  4. **Опционально: `sortKey?: number`** в `FamilyGroup` + ETL заполнение для «по популярности внутри категории».
- **Подсказка следующему агенту:** iter 102 = чисто тесты, runtime/ETL/JSON не тронуты. Baseline: 1431/1431 tests, TSC 0, ESLint 0 errors + 2 warnings. Перед стартом iter 103 прочитай STATUS.md (актуальный статус + Known Issues), worklog.md (iter 102 подробно + предыдущие одной строкой), AGENT_NAVIGATION.md (Pitfall #34 обновлён, Roadmap в конце).

---

## Предыдущие итерации (кратко)

- **iter 101**: P0-фикс Critical Bug #4 — `GameTokenSchema` без `functionalCategory` → Zod strips → runtime classifier падал в `other` для всех токенов (с iter 90). Фикс = 1 строка в `src/shared/schemas.ts` + 3 регрессионных теста в `tests/etl/etl-schemas.test.ts`. 1414/1414 tests.
- **iter 99**: alphabetical within-block sort. `sortGroupsAlphabetically()` + `withAlphabeticalGroups()` wrapper для всех 9 режимов `classifyGroups()`. +19 unit-тестов. 1411/1411 tests.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий для 25 family-keys). 1392/1392 tests.
- **iter 97**: Аудиторская чистка тестов и исторических скриптов. 16 файлов удалено. 1363/1363 tests.
- **iter 96**: Удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`. 1363/1363 tests.
- **iter 95**: Документационная чистка + deprecation-маркер для regex-паттернов. 1363/1363 tests.
- **iter 94**: AILMENTS tag-priority refactor. 26 модов реклассифицированы damage-type → ailments. 1363/1363 tests.
- **iter 93**: penetration block activated (3 family-keys moved resistances → penetration). 1363/1363 tests.
- **iter 92**: 2 ETL root-cause fixes. 11 iter 91 discrepancies resolved. 1363/1363 tests.
- **iter 91**: ETL --fresh run, functionalCategory 100% в продакшене. 1363/1363 tests.
- **iter 89**: ailments + area-duration blocks. jewel other-bucket 21.8% → 14.0%. 1340/1340 tests.
- **iter 87**: Weapon sub-blocks для jewel. Other-bucket 21.8%. 1315/1315 tests.
- **iter 86**: +7 функциональных блоков (14 активны). Other-bucket 9.9%. 1268/1268 tests.
- **iter 85**: Инфраструктура 24 функциональных блоков (7 активны). 1216/1216 tests.
- **iter 84**: 3 P0-фикса (Breach Lord skip + text fallback / waystone keywords / aura+gem tags). 1172/1172 tests.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
