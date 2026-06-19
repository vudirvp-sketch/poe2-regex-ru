# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 96
Agent: main
Task: Убрать regex-паттерны из `classifyFunctionalBlock()` runtime. Предварительно отрефакторить 280 unit-тестов в `tests/shared/mod-classifier.test.ts` на `functionalCategory` (Strategy 0 path). Устаревшая задача hideLabel auto-suppression — убрать из списка (уже done в iter 62).

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git` (shallow). Установлены зависимости через `pnpm install` (corepack wrapper в `/home/z/my-project/bin/pnpm.sh`). Baseline: 1363/1363 tests passing, TSC 0 errors.
- 2: Анализ проблемы — 280 unit-тестов используют `makeGroup()` без `functionalCategory`, что триггерит regex path. Для удаления regex нужно:
  (a) обновить хелперы `makeGroup`/`makeToken` чтобы принимать `functionalCategory`;
  (b) в каждом тесте с ожидаемым non-`'other'` результатом — добавить `functionalCategory` override;
  (c) тесты с ожидаемым `'other'` — оставить без `functionalCategory` (fallback возвращает `'other'` напрямую);
  (d) удалить 22-шаговый regex path из `classifyFunctionalBlock()` + неиспользуемые pattern constants.
- 3: Реализация — `tests/shared/mod-classifier.test.ts`:
  - `makeGroup()` обновлён: принимает `functionalCategory` в overrides. Когда установлен — инжектится во все члены (или создаёт synthetic member если `members: []`).
  - `makeToken()` обновлён: 3-й опциональный параметр `functionalCategory`.
  - Написан Python-скрипт `/home/z/my-project/scripts/refactor_tests_iter96.py` для автоматического обновления тестов:
    - Парсит каждое `it(...)` тело, находит ожидаемый блок из `expect(classifyFunctionalBlock(...)).toBe('X')`.
    - Пропускает тесты с `classifyJewelType`/`classifyByTags`/etc (X не FunctionalBlock).
    - Добавляет `functionalCategory: 'X'` в `makeGroup()` вызовы (обрабатывает single-arg, single-line multi-arg, multi-line multi-arg).
    - 140 тестов модифицированы скриптом.
  - 10 `classifyGroups` тестов обновлены вручную (скрипт не покрывал их, т.к. assertions на `classifyGroups`, не на `classifyFunctionalBlock`).
  - Все 280 тестов зелёные.
- 4: Реализация — `src/shared/mod-classifier.ts`:
  - Удален 22-шаговый regex fallback (steps 1-21) + `allTags` collection + DEPRECATION NOTICE из `classifyFunctionalBlock()`.
  - Функция стала тонкой Strategy 0 обёрткой: majority voting по `functionalCategory` с членов → fallback `return 'other';`.
  - Удалены 21 неиспользуемых pattern constants (SPIRIT_PATTERN, ..., BUFF_SKILLS_PATTERN) — TSC нашёл unused-var errors после удаления regex path. Pattern constants НЕ экспортировались и НЕ импортировались внешними скриптами (scripts имеют собственные mirror-копии).
  - JSDoc `classifyFunctionalBlock()` обновлён — отражает iter 96 архитектуру.
  - BREACH_LORD_TAGS constant оставлен — используется в `classifyByTags()`.
  - FUNCTIONAL_BLOCK_LABELS + FUNCTIONAL_BLOCK_ORDER сохранены — используются Strategy 0.
- 5: Верификация:
  - `npx tsc -b` → 0 errors.
  - `pnpm test` → 1363/1363 passing.
  - `npx tsx scripts/verify-iter95-stability.ts` → cross-validation 477/477 match, Strategy 0 coverage 477/477, other-bucket metrics match iter 94.
  - `pnpm etl` → JSON-файлы не имеют content-изменений (только timestamp в `version` поле — восстановлены через `git checkout public/generated/`).
- 6: Документация актуализирована:
  - `STATUS.md` — iter 96 как текущая итерация, обновлены Architectура и changelog секции. Открытые долги: regex removal убран (done), hideLabel убран (done iter 62), оставлены P1-P3 (sortKey / waystone-tablet sub-blocks / relic-semantic / tier-aware).
  - `worklog.md` — iter 95 сжат до одной строки в "Предыдущие итерации", iter 96 добавлен подробно.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 96, актуализированы ссылки на классификатор.
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — `hideLabel auto-suppression` помечен как **done iter 62** (был "не начато"); `Приоритет тегов вместо first-match` помечен как устаревший (iter 96: теги больше не используются runtime).

Stage Summary:
- **iter 96 COMPLETE.** Regex-паттерны удалены из runtime `classifyFunctionalBlock()`. Функция теперь тонкая Strategy 0 обёртка. 280 тестов отрефакторены на `functionalCategory`. Все 1363 тестов зелёные, cross-validation 477/477 match, ETL-метрики без изменений.
- **Изменённые файлы:**
  - `src/shared/mod-classifier.ts` — удалён 22-шаговый regex fallback + 21 pattern constants + DEPRECATION NOTICE. JSDoc обновлён.
  - `tests/shared/mod-classifier.test.ts` — `makeGroup`/`makeToken` хелперы обновлены; 140+ тестов обновлены скриптом; 10 `classifyGroups` тестов обновлены вручную.
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — актуализированы для iter 96.
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — hideLabel отмечен как done iter 62; tag-priority помечен устаревшим.
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors.
- **Точка остановки:** iter 96 done. В iter 97+ можно:
  1. P1-P3 задачи (sortKey / waystone-tablet sub-blocks / relic-semantic / tier-aware).
  2. Дополнительная чистка documentation/code (если всплывёт).

---

## Предыдущие итерации (кратко)

- **iter 95**: Документационная чистка + deprecation-маркер для regex-паттернов в classifyFunctionalBlock(). Никаких функциональных изменений. 1363/1363 tests.
- **iter 94**: AILMENTS tag-priority refactor — AILMENTS_PATTERN перемещён ПЕРЕД DAMAGE_TYPE + добавлен `ailment` tag check. 26 модов реклассифицированы damage-type → ailments. 1363/1363 tests.
- **iter 93**: penetration block activated (3 family-keys moved resistances → penetration). AILMENTS/MINIONS patterns expanded defensively. 1363/1363 tests.
- **iter 92**: 2 ETL root-cause fixes (multi-segment per-segment + i18n-override reclassify). 11 iter 91 discrepancies resolved (466 → 477 match). Other-bucket: amulet 7.6%→6.7%, belt 5.9%→4.7%. 1363/1363 tests.
- **iter 91**: ETL --fresh run, functionalCategory 100% в продакшене, 11 расхождений ETL vs regex документированы. 1363/1363 tests.
- **iter 89**: ailments + area-duration blocks (16th + 17th active). jewel other-bucket 21.8% → 14.0%. UX-фикс «Магический поиск» → «Рарити». 1340/1340 tests.
- **iter 87**: Weapon sub-blocks для jewel (6 weapon-class sub-blocks для 24 family-key) + production switch для jewel (`jewel-functional` mode). Other-bucket 21.8%. 1315/1315 tests.
- **iter 86**: +7 функциональных блоков (14 активны). Production switch для ring/amulet/belt. Other-bucket 9.9%. 1268/1268 tests.
- **iter 85**: Инфраструктура 24 функциональных блоков (7 активны). 1216/1216 tests.
- **iter 84**: 3 P0-фикса (Breach Lord skip + text fallback / waystone keywords / aura+gem tags). 1172/1172 tests.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
