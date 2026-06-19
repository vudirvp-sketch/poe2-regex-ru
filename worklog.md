# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 100
Agent: main
Task: Cleanup устаревших iter*-скриптов (продолжение iter 97). Цель: убрать мёртвый код (verify/simulate/analyze-iter* audit-скрипты для итераций 49–95, давно покрытые unit-тестами и стабильные в продакшене), устранить 15 ESLint errors в `scripts/verify-iter90-*.ts`, привести документацию в соответствие с реальным состоянием. Дополнительно: расследовать вопрос пользователя про «удалённую группировку/сортировку» в коммитах c54a3da / 4067def.

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Активирован pnpm 11.5.2 через `npm install -g pnpm --prefix=$HOME/.local`. Baseline после iter 99: 1411/1411 tests passing, TSC 0 errors, ESLint 17 problems (15 errors + 2 warnings), ETL 11 fresh.
- 2: Расследование вопроса пользователя про «удалённую группировку/сортировку» в c54a3da (iter 96) и 4067def (iter 97):
  - `git show c54a3da -- src/shared/mod-classifier.ts` → iter 96 удалил 22-шаговый **regex fallback classifier** (SPIRIT_PATTERN, ATTRIBUTES_PATTERN и т.д.) из `classifyFunctionalBlock()`. Grouping-логика (`FUNCTIONAL_BLOCK_LABELS`, `FUNCTIONAL_BLOCK_ORDER`, `classifyGroups()`) НЕ затронута. Runtime классификация теперь использует ETL `functionalCategory` (100% coverage с iter 91) вместо regex patterns.
  - `git show 4067def --stat` → iter 97 удалил 16 исторических audit-скриптов (simulate/verify/analyze-iter*). Grouping/sort-логика НЕ затронута.
  - Реальный источник «удалённой alpha-сортировки» — **Session 70** (commit `06cea49`): `groupTokensByFamily()` был изменён с `affix → familyKey.localeCompare('ru')` на `affix → tier (S→A→B→C) → alpha`. Tier-first sort фрагментировал алфавитный поток внутри функциональных блоков.
  - iter 99 восстановил alphabetical flow **внутри блоков** через `sortGroupsAlphabetically()` wrapper, не трогая `groupTokensByFamily()` (обратная совместимость). Tier-first sort в `groupTokensByFamily()` сохранён, но `classifyGroups()` переписывает within-block order поверх него.
  - **Вывод:** «удаления группировки» не было. Была замена pure-alpha → tier-first в Session 70 (UX-регрессия), которую iter 99 исправил. iter 96/97 удаляли мёртвый код, не grouping-логику.
- 3: Анализ stale-скриптов в `scripts/`:
  - 8 verify-iter* (iter 49/89/90×2/91×2/92/94/95): одноразовые post-iter verification скрипты. Все итерации стабильно в продакшене, логика покрыта unit-тестами в `tests/shared/mod-classifier.test.ts` и `tests/etl/cross-validation.test.ts`.
  - 5 simulate-iter*-impact (iter 86/87/88/89/94): mirror regex patterns, которые iter 96 удалил из runtime. Скрипты mirror'ят удалённый код → теперь нерелевантны.
  - 2 analyze-iter*-other-bucket (iter 88/89): one-time snapshot dumps `other`-bucket family-keys на конкретных итерациях. Snapshot устарел (other-bucket сжался с 70% до 8.3%).
  - 1 stale tracker: `DELETED-FILES-iter92.txt` — iter 97 commit message упоминал удаление, но файл остался на диске (commit-message bug).
  - Keep: `scripts/verify-iter99-alpha-sort.ts` (текущий iter's audit), all `scripts/etl/*.ts` (production ETL), all non-iter-specific scripts.
- 4: Проверка зависимостей через `rg "verify-iter|simulate-iter|analyze-iter"` — все ссылки self-contained (внутри самих скриптов в JSDoc). Никаких imports из `src/`, `tests/`, `package.json`, конфигов.
- 5: `git rm` 17 файлов: 8 verify-iter* + 5 simulate-iter*-impact + 2 analyze-iter*-other-bucket + DELETED-FILES-iter92.txt + iter90-cross-validation. Список удалений в STATUS.md.
- 6: Верификация:
  - `pnpm exec tsc -b` → 0 errors (без изменений).
  - `pnpm test` → 1411/1411 passing (без изменений vs iter 99).
  - `pnpm lint` → **2 problems (0 errors, 2 warnings)** vs baseline 17 problems (15 errors, 2 warnings). 15 ESLint errors устранены. Остались 2 warnings в `VirtualizedModList.tsx` (TanStack `useVirtualizer()` library-level).
  - `pnpm etl:check-stale` → 11 fresh, 0 stale, 0 missing. Никаких изменений в `public/generated/*.json`.
- 7: Документация актуализирована:
  - `STATUS.md` — iter 100 как текущая; добавлена секция «История sort-логики» с расследованием вопроса пользователя; Known Issue #3 (VirtualizedModList warnings) вынесен из пасcива в явный список; Открытые долги сжаты до 4 пунктов (P2/P4/sortKey/Wisps).
  - `worklog.md` — iter 99 сжат до одной строки в «Предыдущие итерации», iter 100 добавлен подробно.
  - `AGENT_NAVIGATION.md` — `scripts/` секция обновлена: removed reference к iter-specific скриптам, оставлен только canonical список (ETL + prerender + verify-iter99 + analyze-regexes/analyze-fn).

Stage Summary:
- **iter 100 COMPLETE.** Cleanup устаревших iter*-скриптов. Удалено 17 файлов (16 .ts + 1 .txt). ESLint 15 errors → 0 errors (осталось 2 library-level warnings). Тесты/TSC/ETL без изменений. Никаких изменений в `public/generated/*.json` или runtime-коде.
- **Изменённые файлы (20):**
  - 17 deletions: `DELETED-FILES-iter92.txt`, 8× `scripts/verify-iter*-*.ts`, 5× `scripts/simulate-iter-*-impact.ts`, 2× `scripts/analyze-iter-*-other-bucket.ts`.
  - 3 doc updates: `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`.
- **Тесты:** 1411/1411 passing. TSC: 0 errors. ESLint: 2 warnings (library-level). ETL: 11 fresh, 0 stale.
- **Точка остановки:** iter 100 done. В iter 101+ можно:
  1. **P2 — waystone/tablet sub-blocks**: sub-группировка внутри sentiment (positive/negative/neutral) по gameplay mechanic — для waystone: loot/danger/splinters; для tablet: ritual/breach/delirium уже есть как type, нужен второй уровень внутри type.
  2. **P4 — tier-aware sort toggle**: UI-тумблер «режим сортировки» (alpha vs tier-first) в `CategoryControlPanel`. iter 99 сделал tier вторичным, но toggle не добавлен.
  3. **Опционально: sortKey?**: добавить `sortKey?: number` в `FamilyGroup` + ETL заполняет на основе functionalCategory + popularity research — для более сложных схем сортировки.
  4. **Опционально: подавить VirtualizedModList warnings** через `// eslint-disable-next-line react-hooks/incompatible-library` (2 warnings) или дождаться апстрим-фикса TanStack Virtual.

---

## Предыдущие итерации (кратко)

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
