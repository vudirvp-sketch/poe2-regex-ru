# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 98
Agent: main
Task: Реализовать P3-задачу relic-semantic mode — заменить flat `affix-only` режим на странице реликвий на семантическую подгруппировку (25 family-keys → 7 Sanctum-категорий). Не трогать существующие режимы, не менять `public/generated/*.json`.

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Активирован pnpm 11.5.2 через corepack shim (`/usr/lib/node_modules/corepack/shims/pnpm`). Baseline: 1363/1363 tests passing, TSC 0 errors (state после iter 97).
- 2: Изучение контекста: прочитаны STATUS.md, worklog.md, AGENT_NAVIGATION.md, src/shared/mod-classifier.ts (1545 строк), src/shared/family-grouper.ts, src/shared/types.ts, src/ui/components/ModList.tsx, src/ui/components/CategoryControlPanel.tsx, src/ui/pages/relic/RelicPage.tsx, src/ui/pages/waystone/WaystonePage.tsx, src/ui/pages/tablet/TabletPage.tsx, tests/shared/mod-classifier.test.ts (2136 строк). Стратегия P1-P3 проанализирована: выбран relic-semantic как наиболее self-contained + наибольший UX-impact (25 groups в одной корзине = явно плохой UX).
- 3: Анализ relic.json: `python3` script извлёк 25 family-keys (12 suffix + 13 prefix). Распределение по семантическим категориям спроектировано вручную: honor=10, monsters=7, trials=2, keys=2, merchant=2, sanctum-water=1, curse=1, other=0. Изначально miscount как 9 honor — позже исправлен на 10 (7 suffix + 3 prefix, не 6+3).
- 4: Реализация в `src/shared/mod-classifier.ts` (новый код: ~130 строк):
  - `RelicCategory` type: 8 значений (`honor` / `sanctum-water` / `trials` / `keys` / `merchant` / `monsters` / `curse` / `other`).
  - `RELIC_LABELS` — display config (label + colorClass + bgClass + borderClass + borderLClass),配色 reuses existing Tailwind classes.
  - `RELIC_CATEGORY_ORDER` — render order: Sanctum-economy (honor/water/trials/keys/merchant) → combat (monsters/curse) → other.
  - 7 keyword-паттернов: `RELIC_HONOR_KEYWORDS = /чест/i`, `RELIC_SANCTUM_WATER_KEYWORDS = /святой воды/i`, `RELIC_TRIALS_KEYWORDS = /испытан/i`, `RELIC_KEYS_KEYWORDS = /ключ/i`, `RELIC_MERCHANT_KEYWORDS = /торгов/i`, `RELIC_CURSE_KEYWORDS = /проклят/i`, `RELIC_MONSTER_KEYWORDS = /(?:монстр|босс)/i`.
  - `classifyRelicCategory(group)` — function, проверяет patterns в порядке honor → sanctum-water → trials → keys → merchant → curse → monsters → other. Honor первым, чтобы «Восстанавливает # чести при убийстве босса» не ушло в monsters (текст содержит «босса»).
  - `'relic-semantic'` добавлен в `ModGroupMode` type.
  - Handling в `classifyGroups(mode='relic-semantic')`: Map<category, FamilyGroup[]>, emit в `RELIC_CATEGORY_ORDER`, skip empty categories. Architecture mirrors `affix-sentiment` и `tablet-type`.
- 5: `src/ui/pages/relic/RelicPage.tsx` — `groupMode` изменён с `'affix-only'` на `'relic-semantic'`. Заголовок файла обновлён с описанием iter 98.
- 6: Tests в `tests/shared/mod-classifier.test.ts` (новые ~255 строк, +29 unit-тестов):
  - `describe('classifyRelicCategory (iter 98)')` — 15 тестов на individual family-keys: 6 honor (включая критический order-test «чести при убийстве босса» → honor, не monsters), 1 sanctum-water, 2 trials, 2 keys, 2 merchant, 6 monsters, 1 curse, 1 other fallback.
  - `describe('classifyGroups with relic-semantic mode (iter 98)')` — 6 тестов: empty input / full coverage всех 25 family-keys из relic.json с проверкой распределения (10/1/2/2/2/7/1) / render order / skip empty categories / labels + colors из RELIC_LABELS / preserves group references.
  - `describe('RELIC_LABELS (iter 98)')` — 2 sanity-теста: 8 entries, every entry has non-empty fields.
- 7: Bug-fix iteration во время тестирования:
  - Bug 1: `RELIC_MERCHANT_KEYWORDS = /торговец/i` — НЕ matching «торговца» (different inflection, suffix is «ца» not «ец»). First fix `/торговц/i` был тоже неверным («торговец» не содержит «торговц»). Final fix: `/торгов/i` — shared stem для всех inflections. 3 теста упало → 0 после fix.
  - Bug 2: Miscount honor groups (написал 9 в комментарии и ожидании теста, фактически 10). Исправлено в комментарии функции и в ожидании теста.
- 8: Верификация:
  - `pnpm exec tsc -b` → 0 errors.
  - `pnpm test` → 1392/1392 passing (35 test files). +29 tests vs iter 97 (1363 → 1392).
  - `pnpm exec eslint src/shared/mod-classifier.ts src/ui/pages/relic/RelicPage.tsx tests/shared/mod-classifier.test.ts` → 0 errors. (один `no-unused-vars` на `key` в `Object.entries(RELIC_LABELS)` исправлен → `[, cfg]`).
  - `pnpm etl:check-stale` → 11 fresh, 0 stale, 0 missing. Никаких изменений в `public/generated/*.json`.
- 9: Документация актуализирована:
  - `STATUS.md` — iter 98 как текущая; добавлена метрика relic (80 tokens, 25 family-groups); таблица распределения 25 family-keys по 7 категориям; P3 relic-semantic отмечен как ✅ DONE, остальные P1-P3 — ⏳.
  - `worklog.md` — iter 97 сжат до одной строки, iter 98 добавлен подробно.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 98; добавлено упоминание relic-semantic mode в секции классификаторов.

Stage Summary:
- **iter 98 COMPLETE.** Relic-semantic grouping mode добавлен. 25 family-keys разбиты на 7 Sanctum-категорий (10 honor + 7 monsters + 2 trials + 2 keys + 2 merchant + 1 sanctum-water + 1 curse + 0 other). 100% покрытие production data.
- **Изменённые файлы (4):**
  - `src/shared/mod-classifier.ts` — +130 строк (RelicCategory type + RELIC_LABELS + 7 patterns + classifyRelicCategory() + 'relic-semantic' mode в classifyGroups()).
  - `src/ui/pages/relic/RelicPage.tsx` — groupMode `'affix-only'` → `'relic-semantic'` + обновлённый header.
  - `tests/shared/mod-classifier.test.ts` — +29 unit-тестов (+255 строк).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — актуализированы.
- **Тесты:** 1392/1392 passing (35 test files). TSC: 0 errors. ESLint: 0 errors. ETL: 11 fresh, 0 stale.
- **Точка остановки:** iter 98 done. В iter 99+ можно:
  1. P1 — sortKey (сортировка внутри функциональных блоков): FamilyGroup.sortKey + groupingMode toggle в UI. Подготовка: ETL должен заполнять sortKey на основе functionalCategory + popularity research.
  2. P2 — waystone/tablet sub-blocks: sub-группировка внутри sentiment (positive/negative/neutral) по gameplay mechanic (loot/danger/splinters для waystone; ritual/breach/delirium уже есть для tablet — нужен второй уровень внутри type).
  3. P4 — tier-aware сортировка: S+/S/All приоритеты внутри блоков (vs текущий priorityFilter, который только фильтрует, не сортирует).

---

## Предыдущие итерации (кратко)

- **iter 97**: Аудиторская чистка тестов и исторических скриптов. 16 файлов удалено (2774 строки). `sanitizeJsObjectLiteral()` теперь экспортирована. 1363/1363 tests.
- **iter 96**: Удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()` (теперь тонкая Strategy 0 обёртка). 280 unit-тестов отрефакторены на `functionalCategory`. 1363/1363 tests.
- **iter 95**: Документационная чистка + deprecation-маркер для regex-паттернов в classifyFunctionalBlock(). 1363/1363 tests.
- **iter 94**: AILMENTS tag-priority refactor — AILMENTS_PATTERN перемещён ПЕРЕД DAMAGE_TYPE + добавлен `ailment` tag check. 26 модов реклассифицированы damage-type → ailments. 1363/1363 tests.
- **iter 93**: penetration block activated (3 family-keys moved resistances → penetration). AILMENTS/MINIONS patterns expanded defensively. 1363/1363 tests.
- **iter 92**: 2 ETL root-cause fixes (multi-segment per-segment + i18n-override reclassify). 11 iter 91 discrepancies resolved (466 → 477 match). 1363/1363 tests.
- **iter 91**: ETL --fresh run, functionalCategory 100% в продакшене, 11 расхождений ETL vs regex документированы. 1363/1363 tests.
- **iter 89**: ailments + area-duration blocks (16th + 17th active). jewel other-bucket 21.8% → 14.0%. UX-фикс «Магический поиск» → «Рарити». 1340/1340 tests.
- **iter 87**: Weapon sub-blocks для jewel (6 weapon-class sub-blocks для 24 family-key) + production switch для jewel (`jewel-functional` mode). Other-bucket 21.8%. 1315/1315 tests.
- **iter 86**: +7 функциональных блоков (14 активны). Production switch для ring/amulet/belt. Other-bucket 9.9%. 1268/1268 tests.
- **iter 85**: Инфраструктура 24 функциональных блоков (7 активны). 1216/1216 tests.
- **iter 84**: 3 P0-фикса (Breach Lord skip + text fallback / waystone keywords / aura+gem tags). 1172/1172 tests.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
