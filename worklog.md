# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 97
Agent: main
Task: Аудиторская чистка тестов и исторических скриптов. Проанализировать все тесты на актуальность и полезность. Удалить устаревшие `simulate-iter*`/`verify-iter*`/`analyze-iter*` скрипты (они mirror-копии regex path, удалённого из runtime в iter 96). Исправить `tests/etl/sanitize-js-object-literal.test.ts` (дублировал реализацию функции вместо импорта). Актуализировать документацию.

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Установлены зависимости через corepack wrapper `pnpm` v11.8.0. Baseline: 1363/1363 tests passing, TSC 0 errors.
- 2: Анализ всех 35 тестовых файлов (15713 строк) — выводы:
  - Все 35 файлов содержат осмысленные тесты; нет `it.skip`/`it.todo`/`xit`; нет `TODO`/`FIXME`/`HACK` в коде тестов.
  - `tests/core/*` (22 файла): matcher, compiler, optimizer, oracle, factorizers, limits, number-regex, phase-9b/9c anchor tests, in-game iterations (15, 36-gems), hypothesis-patterns, tablet-patterns, waystone-anchor-tests, colon-anchor-verification, tablet-non-percent-fp, tablet-in-game, vendor-patterns — все актуальны. Тесты на real game data с in-game verification comments — критичны для dialect-fidelity.
  - `tests/shared/*` (2 файла): mod-classifier (2136 строк, 280+ тестов на Strategy 0 path после iter 96), family-grouper — оба актуальны.
  - `tests/ui/*` (5 файлов): RegexOutput, FilterChip, PageStateWrapper, vendor-regex-equivalence, buildAstFromSelections — все актуальны.
  - `tests/etl/*` (8 файлов): parse-type-b-page, etl-schemas, compute-optimizations, sanitize-js-object-literal, compute-regex, normalize, path-d-transform, cross-validation — `sanitize-js-object-literal` был проблемным (дублировал реализацию функции вместо импорта), остальные актуальны.
- 3: Анализ исторических `scripts/simulate-iter*`/`verify-iter*`/`analyze-iter*` (16 файлов, 2774 строки):
  - `simulate-iter86/87/88/89/94-impact.ts` (5 файлов, 1358 строк) — mirror-копии regex-паттернов для симуляции impact прошлых итераций. Паттерны удалены из runtime в iter 96, симуляции неактуальны.
  - `analyze-iter88/89-other-bucket.ts` (2 файла, 323 строки) — snapshot-дампы `other` bucket на момент iter 88/89. Давно устарели.
  - `verify-iter49.ts` (148 строк) — верификация Pitfall 11 fix (multi-LITERAL AND+EXCLUDE inside OR). Логика уже покрыта в `tests/core/compiler.test.ts` и `tests/ui/buildAstFromSelections.test.ts`.
  - `verify-iter89-deployment.ts`, `verify-iter90-cross-validation.ts`, `verify-iter90-etl-functional-category.ts`, `verify-iter91-discrepancies.ts`, `verify-iter91-strategy0.ts`, `verify-iter92-fixes.ts`, `verify-iter94-fixes.ts`, `verify-iter95-stability.ts` (8 файлов, 945 строк) — cross-validation снапшоты прошлых итераций. Дублируют друг друга и `tests/etl/cross-validation.test.ts`. Audit-trail сохранён в git.
  - Все 16 скриптов запущены — все ещё работают, но дают историческую информацию без новой ценности.
- 4: Реализация:
  - `tests/etl/sanitize-js-object-literal.test.ts`: удалена inline-копия функции, добавлен `import { sanitizeJsObjectLiteral } from '@etl/parse-modifiers-calc';`.
  - `scripts/etl/parse-modifiers-calc.ts`: `sanitizeJsObjectLiteral()` теперь `export function`.
  - `src/shared/mod-classifier.ts`: обновлён комментарий к weapon fallback — удалена ссылка на удалённый `simulate-iter87-impact.ts`.
  - `scripts/etl/classify-functional-category.ts`: обновлён комментарий к AILMENTS_PATTERN — удалена ссылка на удалённый `simulate-iter94-impact.ts`.
  - Удалены 16 файлов: `scripts/simulate-iter86-impact.ts`, `scripts/simulate-iter87-impact.ts`, `scripts/simulate-iter88-impact.ts`, `scripts/simulate-iter89-impact.ts`, `scripts/simulate-iter94-impact.ts`, `scripts/analyze-iter88-other-bucket.ts`, `scripts/analyze-iter89-other-bucket.ts`, `scripts/verify-iter49.ts`, `scripts/verify-iter89-deployment.ts`, `scripts/verify-iter90-cross-validation.ts`, `scripts/verify-iter90-etl-functional-category.ts`, `scripts/verify-iter91-discrepancies.ts`, `scripts/verify-iter91-strategy0.ts`, `scripts/verify-iter92-fixes.ts`, `scripts/verify-iter94-fixes.ts`, `scripts/verify-iter95-stability.ts`.
  - Удалён `DELETED-FILES-iter92.txt` — stale tracker от iter 92 (содержал только имена 3 файлов, удалённых в iter 92; git уже хранит их историю).
- 5: Верификация:
  - `npx tsc -b` → 0 errors.
  - `pnpm test` → 1363/1363 passing (35 test files).
  - `pnpm etl:check-stale` → 11 fresh, 0 stale, 0 missing.
  - `npx eslint src/shared/mod-classifier.ts scripts/etl/parse-modifiers-calc.ts scripts/etl/classify-functional-category.ts tests/etl/sanitize-js-object-literal.test.ts` → 0 errors.
  - Никаких изменений в `public/generated/*.json` (ETL не запускался, JSON не пересоздавались).
- 6: Документация актуализирована:
  - `STATUS.md` — iter 97 как текущая итерация; removed упоминания удалённых скриптов.
  - `worklog.md` — iter 96 сжат до одной строки, iter 97 добавлен подробно.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 97; removed упоминания удалённых скриптов из секции 1 ("Where Things Are").
  - `docs/AFFIXES_GROUPING_ANALYSIS.md` — removed упоминания удалённых скриптов; сжаты устаревшие секции про iter 88/89/94 simulation reports.

Stage Summary:
- **iter 97 COMPLETE.** Аудиторская чистка тестов и исторических скриптов. 16 файлов удалено (2774 строки). `sanitizeJsObjectLiteral()` теперь экспортирована и тестируется напрямую. 1363/1363 тестов зелёные, TSC 0 errors, ETL stable.
- **Изменённые файлы:**
  - `tests/etl/sanitize-js-object-literal.test.ts` — import реальной функции вместо дублирования.
  - `scripts/etl/parse-modifiers-calc.ts` — `sanitizeJsObjectLiteral()` теперь `export`.
  - `src/shared/mod-classifier.ts` — обновлён комментарий (removed stale script reference).
  - `scripts/etl/classify-functional-category.ts` — обновлён комментарий (removed stale script reference).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md`, `docs/AFFIXES_GROUPING_ANALYSIS.md` — актуализированы.
- **Удалённые файлы (16):**
  - 5× `scripts/simulate-iter*-impact.ts` (1358 строк)
  - 2× `scripts/analyze-iter*-other-bucket.ts` (323 строки)
  - 9× `scripts/verify-iter*.ts` (1093 строки)
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors.
- **Точка остановки:** iter 97 done. В iter 98+ можно:
  1. P1-P3 задачи (sortKey / waystone-tablet sub-blocks / relic-semantic / tier-aware).
  2. Дальнейшая чистка documentation/code (если всплывёт).

---

## Предыдущие итерации (кратко)

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
