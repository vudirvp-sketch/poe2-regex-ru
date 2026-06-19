# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 95
Agent: main
Task: Документационная чистка + deprecation-маркер для regex-паттернов в classifyFunctionalBlock(). Никаких функциональных изменений — применён principle "лучше недоделать, чем сломать". Подготовка к будущему iter 96+ (regex removal или P1-P3 задачи).

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Установлены зависимости через `pnpm install` (использован corepack + local symlink в /home/z/my-project/bin/pnpm — pnpm не был в PATH).
- 2: Прочитан контекст iter 94: `STATUS.md`, `worklog.md`, `src/shared/mod-classifier.ts` (полностью, 2019 строк), `tests/shared/mod-classifier.test.ts` (структура тестов classifyFunctionalBlock), `AGENT_NAVIGATION.md`.
- 3: Baseline проверка: `pnpm test` → 1363/1363 passing. TSC через `tsc -b` не запускался (будет в финальной верификации).
- 4: Анализ вариантов iter 95:
  - "Убрать regex-паттерны" → рискованно (80+ тестов используют `makeGroup()` без `functionalCategory`, что триггерит regex path). Требует предварительного рефакторинга тестов.
  - "Wisps/Conversion деактивация" → безопасно как код-комментарий, но удаление из FUNCTIONAL_BLOCK_ORDER создаст regression risk для будущих ETL-данных.
  - "hideLabel auto-suppression" → уже реализовано в iter 62 (ModList.tsx:206,244,413). Устаревшая запись в списке задач.
  - Остальные P1-P3 (sortKey / waystone-tablet sub-blocks / relic-semantic / tier-aware) → слишком сложны для одной итерации.
- 5: Решение: iter 95 = минимальная безопасная чистка. Добавить deprecation-комментарий к regex-секции + задокументировать Wisps/Conversion как RESERVED-FOR-FUTURE + актуализировать docs.
- 6: Реализация — `src/shared/mod-classifier.ts`:
  - `classifyFunctionalBlock()`: добавлен DEPRECATION NOTICE перед Strategy 0 (описывает, почему regex сохранён: тесты/отладка/future-proofing; план удаления в будущей итерации).
  - `FUNCTIONAL_BLOCK_ORDER` комментарий: добавлен параграф про `wisps`/`conversion` как RESERVED-FOR-FUTURE (0 family-keys в текущих данных, оставлены для forward-compat).
- 7: `pnpm test` → 1363/1363 passing (без регрессий — изменения только в комментариях).
- 8: Документация актуализирована:
  - `STATUS.md` — сжата iter 94 секция до одной таблицы метрик + краткого changelog; iter 95 changelog добавлен; Known Issues + Открытые долги обновлены (regex removal с планом, hideLabel отмечен как already-done).
  - `worklog.md` — iter 94 сжат до одной строки в "Предыдущие итерации"; iter 95 секция добавлена подробно.
  - `AGENT_NAVIGATION.md` — header обновлён до iter 95; устаревшая строка "current: 1216 passing" заменена на 1363; актуализированы ссылки на iter 95 DEPRECATION NOTICE.
- 9: Создан `scripts/verify-iter95-stability.ts` — sanity-check скрипт:
  - Cross-validation ETL vs Runtime (ожидается 0 расхождений по 477 family-groups).
  - Strategy 0 coverage check (ожидается 477/477).
  - Other-bucket metrics check (ожидается без изменений vs iter 94).
- 10: Финальная верификация: `pnpm test` (1363/1363), `npx tsc -b` (0 errors), `npx tsx scripts/verify-iter95-stability.ts` (PASS), `pnpm etl` (JSON-файлы без изменений — iter 95 не меняет ETL-логику).

Stage Summary:
- **iter 95 COMPLETE.** Документационная чистка + deprecation-маркер. Никаких функциональных изменений — все 1363 тестов зелёные, ETL-метрики без изменений, JSON-файлы не модифицированы.
- **Изменённые файлы (1 source + 3 docs + 1 verify-script):**
  - `src/shared/mod-classifier.ts` — DEPRECATION NOTICE в classifyFunctionalBlock() + RESERVED-FOR-FUTURE комментарий для wisps/conversion в FUNCTIONAL_BLOCK_ORDER. Только комментарии.
  - `STATUS.md` — актуализирован для iter 95 (сжатие истории iter 94, обновлённые Known Issues + Открытые долги).
  - `worklog.md` — iter 95 detailed section, iter 94 compressed to one line.
  - `AGENT_NAVIGATION.md` — header iter 95, исправлена устаревшая метрика тестов (1216 → 1363).
  - `scripts/verify-iter95-stability.ts` — новый sanity-check скрипт.
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors.
- **Точка остановки:** iter 95 done. В iter 96+ можно:
  1. Убрать regex-паттерны из classifyFunctionalBlock() — план удаления задокументирован в DEPRECATION NOTICE. Предварительно: рефакторинг 80+ тестов на `functionalCategory`.
  2. P1-P3 задачи (sortKey / waystone-tablet sub-blocks / relic-semantic / tier-aware).
  3. hideLabel auto-suppression уже реализован — задача устарела, можно убрать из списка.

---

## Предыдущие итерации (кратко)

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
