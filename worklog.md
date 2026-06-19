# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 99
Agent: main
Task: Реализовать UX-задачу iter 99 — alphabetical within-block sort. Цель пользователя: «однотипные модификаторы должны быть в одном месте и идти один за другим как бы по алфавиту». Не менять `public/generated/*.json`, не сломать существующие тесты.

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Активирован pnpm 11.5.2 через corepack shim. Baseline: 1392/1392 tests passing, TSC 0 errors (state после iter 98).
- 2: Изучение контекста: прочитаны STATUS.md, worklog.md, AGENT_NAVIGATION.md, src/shared/mod-classifier.ts (1710 строк — целиком), src/shared/family-grouper.ts (316 строк), src/shared/types.ts, tests/shared/family-grouper.test.ts, tests/shared/mod-classifier.test.ts (2392 строк), src/ui/components/ModList.tsx + VirtualizedModList.tsx + CategoryControlPanel.tsx (по grep). Выявлена корневая проблема: `groupTokensByFamily()` сортирует по affix → **tier (S→A→B→C)** → alpha. После `classifyGroups()` этот within-block order сохраняется (Map сохраняет insertion order), фрагментируя алфавитный поток внутри функционального блока.
- 3: Анализ UX-решений:
  - Опция A: изменить sort в `groupTokensByFamily` на affix → alpha (drop tier). Минус: ломает тест "sorts by priority tier within same affix" (line 373) и меняет поведение ВСЕХ потребителей.
  - Опция B (выбрана): добавить `sortGroupsAlphabetically()` helper + применять в `classifyGroups()` ко всем режимам. Минус: на первый взгляд дублирует sort. Плюсы: (1) не ломает `groupTokensByFamily`-тесты, (2) explicitly применяет alphabetical flow в точке partitioning, (3) работает для origin-split групп (strip `::origin` suffix), (4) все 9 режимов получают единообразное поведение.
- 4: Анализ sort key: `familyKey` vs `displayText`. `displayText` содержит substituted ranges (напр. "+(5—7) к силе") — сортировка по нему interleaves families по numeric range, не по имени. `familyKey` — template ("+# к силе"), даёт чистый alphabetical. Решение: sort by `familyKey` (с strip `::origin`), Russian locale, `priorityTier` как tiebreaker (defensive — два одинаковых familyKey в одном sub-group не должно быть, но если есть, S перед A).
- 5: Реализация в `src/shared/mod-classifier.ts` (новый код: ~75 строк, после `TIER_SORT_ORDER`):
  - `sortGroupsAlphabetically(groups: FamilyGroup[]): FamilyGroup[]` — экспортируемая. Если `groups.length <= 1` — shallow copy без вызова comparator. Иначе `[...groups].sort(...)` с компаратором: strip `::origin`, `localeCompare('ru')`, tiebreaker `TIER_SORT_ORDER diff`. Возвращает NEW array (не мутирует input), сохраняет FamilyGroup references (тест "preserves group references" полагается на это).
  - `withAlphabeticalGroups<T extends ModSubGroup>(result: T[]): T[]` — приватная wrapper. Мутирует `sg.groups` каждого sub-group, указывая на новый sorted array. Применяется ко всем 10 return-точкам `classifyGroups()` (9 режимов + fallback).
- 6: MultiEdit на 10 return-точек в `classifyGroups()`: каждый `return X` → `return withAlphabeticalGroups(X)`. Включая `affix-only`, `relic-semantic`, `affix-semantic`, `affix-functional`, `jewel-functional` (через локальную `result` переменную), `affix-sentiment`, `tablet-type`, `origin`, `jewel-type`, fallback.
- 7: Tests в `tests/shared/mod-classifier.test.ts` (новые ~265 строк, +19 unit-тестов в 2 describe-блоках):
  - `describe('sortGroupsAlphabetically (iter 99)')` — 10 тестов: new array / preserve refs / empty input / single element / Russian alpha (и<л<с) / familyKey vs displayText (numeric ranges не фрагментируют) / tier как tiebreaker не primary / ::origin strip / mixed Cyrillic+Latin scripts.
  - `describe('classifyGroups applies alphabetical within-block sort (iter 99)')` — 9 тестов: affix-functional alpha + tier не фрагментирует + render order preserved + preserve refs; relic-semantic (honor) alpha; tablet-type (ritual) alpha; affix-sentiment (positive) alpha; affix-only alpha; jewel-functional weapon sub-block alpha.
- 8: Bug-fix iteration во время тестирования:
  - Bug: Опечатка в строке 2603 — `expect(result[0].key).toBe('ritual';` (missing closing paren). TSC поймал. Fixed → `expect(result[0].key).toBe('ritual');`.
- 9: Sanity-check на production данных (`scripts/verify-iter99-alpha-sort.ts`, ~50 строк): печатает within-block order для amulet/ring/belt, prefix+suffix. Подтверждает: в «Атрибутах» amulet suffix 10 groups идут alphabetically — `+# к интеллекту` → `+# к ловкости` → `+# к ловкости и интеллекту` → `+# к силе` → `+# к силе и интеллекту` → `+# к силе и ловкости` → `+# к силе, ловкости или интеллекту` → `+# ко всем характеристикам` (S-tier «всем» в КОНЦЕ, не в начале). В «Сопротивлениях» B-tier хаос-моды interleaved с C-tier по алфавиту, не фрагментируя поток.
- 10: Верификация:
  - `pnpm exec tsc -b` → 0 errors.
  - `pnpm test` → 1411/1411 passing (35 test files). +19 tests vs iter 98 (1392 → 1411).
  - `pnpm exec eslint src/shared/mod-classifier.ts tests/shared/mod-classifier.test.ts` → 0 errors.
  - `pnpm lint` → 17 problems (15 errors + 2 warnings) — все предсуществующие (verify-iter90-* unused imports + VirtualizedModList TanStack warnings). 0 новых.
  - `pnpm etl:check-stale` → 11 fresh, 0 stale, 0 missing. Никаких изменений в `public/generated/*.json`.
- 11: Документация актуализирована:
  - `STATUS.md` — iter 99 как текущая; добавлен пример amulet suffix «Атрибуты» (10 groups, alphabetical); P1 alphabetical отмечен как ✅ DONE, sortKey/UI-toggle оставлены как ⏳ future-compat.
  - `worklog.md` — iter 98 сжат до одной строки, iter 99 добавлен подробно.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 99; добавлено упоминание `sortGroupsAlphabetically()` + `withAlphabeticalGroups()` в секции классификаторов.

Stage Summary:
- **iter 99 COMPLETE.** Alphabetical within-block sort добавлен. Во всех 9 режимах `classifyGroups()` (affix-only / affix-semantic / affix-functional / jewel-functional / affix-sentiment / tablet-type / relic-semantic / origin / jewel-type) группы внутри sub-group теперь отсортированы по `familyKey` (Russian locale), с `priorityTier` как tiebreaker. Tier остаётся цветным бейджем, но больше не фрагментирует алфавитный поток.
- **Изменённые файлы (5):**
  - `src/shared/mod-classifier.ts` — +75 строк (sortGroupsAlphabetically + withAlphabeticalGroups + 10 return-точек обёрнуты).
  - `tests/shared/mod-classifier.test.ts` — +19 unit-тестов (+265 строк).
  - `scripts/verify-iter99-alpha-sort.ts` — новый audit-скрипт (~50 строк).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — актуализированы.
- **Тесты:** 1411/1411 passing (35 test files). TSC: 0 errors. ESLint: 0 новых errors. ETL: 11 fresh, 0 stale.
- **Точка остановки:** iter 99 done. В iter 100+ можно:
  1. P2 — waystone/tablet sub-blocks: sub-группировка внутри sentiment (positive/negative/neutral) по gameplay mechanic — для waystone: loot/danger/splinters; для tablet: ritual/breach/delirium уже есть как type, нужен второй уровень внутри type.
  2. P4 — tier-aware сортировка (toggle): S+/S/All приоритеты внутри блоков (vs текущий priorityFilter, который только фильтрует, не сортирует). iter 99 сделал tier вторичным, но UI-тумблер «режим сортировки» (alpha vs tier-first) не добавлен.
  3. Опционально: `sortKey?: number` в `FamilyGroup` + ETL заполняет на основе functionalCategory + popularity research — для более сложных схем сортировки (не только alpha/tier). iter 99 решил UX-задачу без sortKey, но он остаётся как future-compat.

---

## Предыдущие итерации (кратко)

- **iter 98**: relic-semantic mode (7 Sanctum-категорий для 25 family-keys). 1392/1392 tests.
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
