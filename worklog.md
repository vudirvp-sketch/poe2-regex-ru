# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 105
Agent: main
Task: P2 second half — tablet sub-blocks (gameplay mechanic sub-grouping within type). Минимальный риск: новый режим `tablet-type-subblocks` + 19 sub-blocks + 28 новых тестов. Никаких изменений в `public/generated/*.json`, ETL, runtime functional-classifier, схеме, WaystonePage.

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 104 — waystone sub-blocks + Known Issue #5 fix, 1472/1472), worklog.md (iter 104 подробно), AGENT_NAVIGATION.md (entry iter 104 + Roadmap + Pitfall #34). Подтверждение baseline: `npx vitest run` → 1472/1472; `npx tsc -b` → 0 errors; `npx eslint .` → 0 problems. Выбор scope: только tablet sub-blocks (P2 second half). P4 (tier-aware sort toggle) — отложен в iter 106+ (отдельный UI-work в CategoryControlPanel).
- 2: Анализ tablet type distribution на реальных данных. Запуск sanity script (`scripts/sanity/analyze-tablet-type.ts`, временный) на `tablet.json` (82 family-groups): ritual 14, breach 11, delirium 9, vaal 8, expedition 8, generic 32. Дизайн second-level scheme: 3 sub-blocks per type (4 для generic, т.к. 32 groups слишком много для 3). Total: 19 sub-blocks. Схема:
  - RITUAL (14 → 3 sub-blocks): rewards (6 — награды/дань/предзнаменования), monsters (3 — возрожденные/принесенные в жертву), content (5 — алтари и круги)
  - BREACH (11 → 3): monsters (5 — эффективность/порождение/сложность монстров Бездны), rewards (2 — очерняющая валюта/награды провалов), content (4 — количество Бездн + Глубины Бездны)
  - DELIRIUM (9 → 3): mist (4 — Туман/Плотность/таймер), rewards (4 — осколки/Симулякр/боссы/зеркала), monsters (1 — размер групп монстров Делириума)
  - VAAL (8 → 3): monsters (5 — спавны/группы/уникальные монстры Маяков), rewards (2 — сундуки/кристаллы), content (1 — Маяки implicit)
  - EXPEDITION (8 → 3): rewards (4 — реликт/артефакт/журнал/+реликт), explosives (2 — радиус взрывчатки), monsters (2 — рунические метки/редкие монстры Экспедиции)
  - GENERIC (32 → 4): loot (6 — золото/путевые камни/редкость/предметы), monsters (9 — эффективность/редкость/количество/плотность/размер групп/доп. свойства), encounters (15 — доп. Сущности/изгнанники/дух/сундуки/Заражение/свойство/Разломы/заряды), player (2 — опыт)
- 3: Implementation в `src/shared/mod-classifier.ts`:
  - `TabletSubBlock` type (19 variants: 3+3+3+3+3+4).
  - `TABLET_SUBBLOCK_LABELS` — display config (color/bg/border per sub-block; color matches parent type — red/violet/blue/amber/emerald/muted).
  - `TABLET_SUBBLOCK_ORDER` — canonical render order (ritual → breach → delirium → vaal → expedition → generic; within each type by gameplay significance).
  - 16 sub-block pattern regexes (по 2 на type, кроме generic где 3 — остальные sub-blocks через fallback).
  - `classifyTabletSubBlock(group)` function — two-phase: 1) `classifyTabletType()` determines type, 2) sub-block patterns within type. Each type has fallback sub-block (ritual→content, breach→content, delirium→monsters, vaal→content, expedition→monsters, generic→monsters).
  - `'tablet-type-subblocks'` mode added to `ModGroupMode` union type.
  - Implementation в `classifyGroups()` для нового режима — mirror архитектуры `affix-sentiment-subblocks` (iter 104) и `tablet-type` (Map → order filter → map to ModSubGroup), just with finer-grained keys.
- 4: Switch TabletPage на новый режим: `src/ui/pages/tablet/TabletPage.tsx` — `groupMode="tablet-type"` → `groupMode="tablet-type-subblocks"`. Старый режим `tablet-type` сохранён как legacy (как `affix-sentiment` сохранён после `affix-sentiment-subblocks`) — backward compat с тестами / external callers.
- 5: Sanity-run `classifyTabletSubBlock` на real data. Расширенный sanity script (`scripts/sanity/analyze-tablet-subblocks.ts`) верифицирует actual-vs-expected distribution для всех 19 sub-blocks. Результат: **0 mismatches**, все 82 family-groups классифицированы. Distribution полностью совпала с дизайном.
- 6: Pattern design notes (валидированы sanity-прогоном):
  - (a) RITUAL — monsters BEFORE rewards. Regression: «Монстры, принесенные в жертву...даруют увеличенное...количество дани» имеет ОБА «жертв» (monsters) и «дан» (rewards). Семантически это monster-механика (subject = принесенные монстры), не reward-механика. Pattern priority: `RITUAL_MONSTERS_PATTERNS` (`возрожден|принесен.*жертв`) → `RITUAL_REWARDS_PATTERNS` (`дан|наград|предзнаменов`) → fallback `ritual-content`. +1 regression test.
  - (b) DELIRIUM — rewards BEFORE mist. Regression: «Туман Делириума порождает...осколков зеркал» имеет ОБА «Туман» (mist) и «осколков» (rewards). Семантически это reward-модификатор (mist производит больше осколков), не mist-механика. Pattern priority: `DELIRIUM_REWARDS_PATTERNS` (`осколк|хрупк.*зеркал|Симулякр|боссов`) → `DELIRIUM_MIST_PATTERNS` (`Туман|Плотность|таймер`) → fallback `delirium-monsters`. +1 regression test.
  - (c) GENERIC — encounters BEFORE monsters. Regression: «Нестабильные Разломы...порождают дополнительного редкого монстра» имеет «монстр» (monsters), но семантически это encounter-спавн (extra content), не monster-stat. Pattern priority: `GENERIC_LOOT_PATTERNS` (`золот|путев|предмет`) → `GENERIC_PLAYER_PATTERNS` (`опыт`) → `GENERIC_ENCOUNTERS_PATTERNS` (specific phrases: `На карте можно встретить|шансом можно встретить|Добавляет Заражение|Нестабильные Разломы|случайным свойством|Осталось зарядов`) → fallback `generic-monsters`. Encounters pattern намеренно использует specific phrases (не bare «на карте» или «Разломах»), чтобы не false-match на monster density mods.
- 7: Tests в `tests/shared/mod-classifier.test.ts` (+28 новых, total 397 в файле):
  - `classifyTabletSubBlock` suite (новый, 23 tests): coverage для всех 19 sub-blocks + 2 regression tests для pattern priority (ritual-monsters перед ritual-rewards, delirium-rewards перед delirium-mist) + 1 label-coverage sanity check.
  - `classifyGroups` suite: +5 tests для `tablet-type-subblocks` mode (composite-key sub-blocks, empty-skip, alphabetical within sub-block, canonical order, FamilyGroup reference preservation).
- 8: Cleanup. Удалены временные sanity scripts в `scripts/sanity/` (per iter 100 rule: «Не добавляй новые verify-iter*-*.ts скрипты — покрывай проверки через tests/ или inline sanity в worklog.md»). Distribution вынесена в STATUS.md как inline sanity table.
- 9: Верификация: `npx vitest run` → **1500/1500** (было 1472, +28). `npx tsc -b` → 0 errors. `npx eslint .` → 0 problems. ETL не запускался — `public/generated/*.json` не тронуты (verified via `git status`).
- 10: Документация:
  - `STATUS.md` — iter 105 как текущая; «Что сделано» + «Метрики» (1500/1500); Known Issues без изменений (только #1 и #2 остаются, оба intentional); «Открытые долги» обновлены — P2 tablet closed, P4 + sortKey + waystone neutral-generic остаются; added «Tablet Разломы vs Бездна» как новый low-priority долг (2 mods используют «Разлом» вместо «Бездна» — классифицируются как generic, но sub-block classification корректна); added inline sanity table (sub-block distribution на real data); runtime-метрики таблица обновлена (tablet row: 82 groups / 19 sub-blocks).
  - `worklog.md` — iter 104 сжат до одной строки, iter 105 добавлен подробно.
  - `AGENT_NAVIGATION.md` — entry paragraph bumped до iter 105 (tablet sub-blocks); Roadmap iter 105 done + обновлён optional-список (P2 полностью closed, P4 next).

Stage Summary:
- **iter 105 COMPLETE.** Tablet sub-blocks (P2 second half) реализованы: новый режим `tablet-type-subblocks` с 19 sub-blocks (3+3+3+3+3+4), TabletPage переключён на новый режим. P2 (sub-blocks для waystone и tablet) полностью закрыта.
- **Изменённые файлы (4):**
  - `src/shared/mod-classifier.ts` — +225 строк (TabletSubBlock type + TABLET_SUBBLOCK_LABELS + TABLET_SUBBLOCK_ORDER + 16 sub-block patterns + classifyTabletSubBlock function + tablet-type-subblocks mode в classifyGroups + tablet-type-subblocks в ModGroupMode union).
  - `src/ui/pages/tablet/TabletPage.tsx` — 1 строка (groupMode change).
  - `tests/shared/mod-classifier.test.ts` — +28 новых тестов (23 classifyTabletSubBlock unit + 5 tablet-type-subblocks mode). Включает 2 regression tests для pattern priority + 1 label-coverage sanity check.
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — документация актуализирована.
- **Тесты:** 1500/1500 (+28 vs iter 104). TSC: 0 errors. ESLint: **0 errors + 0 warnings**. ETL: 11 fresh, 0 stale. Никаких изменений в `public/generated/*.json`, ETL, runtime functional-classifier, схеме, WaystonePage.
- **Real-data distribution (inline sanity):** 82/82 tablet family-groups классифицированы — ritual-rewards 6, ritual-monsters 3, ritual-content 5, breach-monsters 5, breach-rewards 2, breach-content 4, delirium-mist 4, delirium-rewards 4, delirium-monsters 1, vaal-monsters 5, vaal-rewards 2, vaal-content 1, expedition-rewards 4, expedition-explosives 2, expedition-monsters 2, generic-loot 6, generic-monsters 9, generic-encounters 15, generic-player 2.
- **Точка остановки:** iter 105 done. P2 (sub-blocks) полностью закрыта. В iter 106+ можно:
  1. **P4 — tier-aware sort toggle**: UI-тумблер «режим сортировки» (alpha vs tier-first) в `CategoryControlPanel`. iter 99 сделал tier вторичным, но toggle не добавлен.
  2. **Опционально: `sortKey?: number`** в `FamilyGroup` + ETL заполнение для «по популярности внутри категории».
  3. **Опционально: waystone neutral-generic (6 groups)**: 5 desecrated Breach-adjacent mods можно расширить POSITIVE_KEYWORDS, чтобы их поймать. Low-priority.
  4. **Опционально: Tablet Разломы vs Бездна**: 2 mods используют «Разлом» вместо «Бездна» и классифицируются как generic. Можно расширить BREACH_KEYWORDS, чтобы их поймать — но это изменило бы type distribution. Low-priority — текущая sub-block classification корректна.
- **Подсказка следующему агенту:** iter 105 = tablet sub-blocks (P2 second half), runtime functional-classifier / ETL / JSON / схема / WaystonePage не тронуты. Baseline: 1500/1500 tests, TSC 0, ESLint **0 problems**. Перед стартом iter 106 прочитай STATUS.md (актуальный статус + Known Issues — только #1 и #2 остаются, оба intentional), worklog.md (iter 105 подробно + предыдущие одной строкой), AGENT_NAVIGATION.md (entry paragraph iter 105, Roadmap iter 105 done). Не создавай новые verify-iter*-*.ts скрипты — покрывай проверки через tests/ (vitest) или inline sanity в worklog.md (правило iter 100).

---

## Предыдущие итерации (кратко)

- **iter 104**: P2 first half — waystone sub-blocks + Known Issue #5 fix. Новый режим `affix-sentiment-subblocks` с 9 sub-blocks. 1472/1472 tests.
- **iter 103**: подавление 2 TanStack library-level ESLint warnings — Known Issue #3 закрыт. 1431/1431 tests.
- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline — 17 тестов в `tests/integration/runtime-classification.test.ts`. 1431/1431 tests.
- **iter 101**: P0-фикс Critical Bug — `GameTokenSchema` без `functionalCategory` → Zod strips → runtime classifier падал в `other`. +3 регрессионных теста. 1414/1414 tests.
- **iter 99**: alphabetical within-block sort. `sortGroupsAlphabetically()` + `withAlphabeticalGroups()` wrapper для всех 9 режимов. +19 unit-тестов. 1411/1411 tests.
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
