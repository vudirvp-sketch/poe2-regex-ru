# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 104
Agent: main
Task: P2 first half — waystone sub-blocks (gameplay mechanic sub-grouping within sentiment) + фикс Known Issue #5 (`приспешник.*урон` false-positive в `POSITIVE_KEYWORDS`). Минимальный риск: новый режим `affix-sentiment-subblocks` + 9 sub-blocks + 41 новых тестов. Никаких изменений в `public/generated/*.json`, ETL, runtime functional-classifier, схеме.

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 103 — lint-cleanup, ESLint 0/0), worklog.md (iter 103 подробно), AGENT_NAVIGATION.md (entry iter 103 + Roadmap + Pitfall #34). Подтверждение baseline: `npx vitest run` → 1431/1431; `npx tsc -b` → 0 errors; `npx eslint .` → 0 problems. Выбор scope: только waystone sub-blocks (P2 first half), tablet sub-blocks (P2 second half) — отложен в iter 105 (отдельный анализ needed для second-level внутри type).
- 2: Анализ waystone sentiment на реальных данных. Запуск sanity script (`scripts/sanity/sim-waystone-sentiment.ts`, временный — удалён после фикса) на мёрдже `waystone.json` + `waystone-desecrated.json` (73 family-groups): positive 25, negative 42, neutral 6. При анализе обнаружен баг: «Игроки и их приспешники не наносят урона в течение 3 из каждых 10 секунд» классифицирован как positive (через `приспешник.*урон` в `POSITIVE_KEYWORDS`) — это явный negative (player can't damage 30% of time). Документирован как Known Issue #5 в STATUS.md.
- 3: Fix Known Issue #5 (1 строка в `POSITIVE_KEYWORDS` + 1 альтернатива в `NEGATIVE_KEYWORDS`). Удалён `приспешник.*урон` из POSITIVE (ловил оба: intended positive minion-extra-damage mods AND false-positive «Игроки и их приспешники не наносят урона»). Added `Игроки.*не наносят урон` в NEGATIVE. Intended positive minion mods (`приспешники наносят... дополнительного урона от X`) всё ещё ловятся через `приспешник.*дополнит` (требует «дополнит» между «приспешник» и «урон»). +2 regression tests в `classifyWaystoneSentiment` suite. После fix: positive 25 → 24, negative 42 → 43, neutral 6 → 6.
- 4: Design sub-block scheme для waystone (9 sub-blocks). POSITIVE: `positive-loot` (items/currency/waystones/gold/chests/exiles/essences), `positive-mechanics` (extra in-map encounters: Breaches, altars, ritual circles, Princess, Breach-minion damage buffs), `positive-buffs` (XP/Spirit/wisps/quality/respawns/implicit meta-stats). NEGATIVE: `negative-monster-power` (damage/crit/effectiveness/accuracy/projectiles/status-application/AoE), `negative-monster-defense` (armor/evasion/ES/HP/res/status-threshold/crit-damage-reduction/curse-resist), `negative-monster-modifiers` (rare-monster extra properties), `negative-player-penalty` (flask/move-speed/cast-recharge/max-res/recovery/forced-death/no-damage), `negative-environment` (curses/ground-effects/soul-eating). NEUTRAL: `neutral-generic`. Архитектурно — flat `ModSubGroup[]` с composite-ключами (color коммуницирует sentiment, label коммуницирует mechanic) — existing ModList rendering не тронут.
- 5: Implementation в `src/shared/mod-classifier.ts`:
  - `WaystoneSubBlock` type (9 variants: 3 positive + 5 negative + 1 neutral).
  - `WAYSTONE_SUBBLOCK_LABELS` — display config (color/bg/border per sub-block; color matches sentiment).
  - `WAYSTONE_SUBBLOCK_ORDER` — canonical render order (positive → negative → neutral).
  - 7 sub-block pattern regexes (POSITIVE_LOOT/MECHANICS/BUFFS + NEGATIVE_MONSTER_POWER/DEFENSE/MODIFIERS/PLAYER_PENALTY/ENVIRONMENT).
  - `classifyWaystoneSubBlock(group)` function — two-phase: 1) `classifyWaystoneSentiment()` determines sentiment, 2) sub-block patterns within sentiment. Each sentiment has fallback sub-block (positive → buffs, negative → environment, neutral → neutral-generic).
  - `'affix-sentiment-subblocks'` mode added to `ModGroupMode` union type.
  - Implementation в `classifyGroups()` для нового режима — mirror архитектуры `affix-sentiment` (Map → order filter → map to ModSubGroup), just with finer-grained keys.
- 6: Switch WaystonePage на новый режим: `src/ui/pages/waystone/WaystonePage.tsx` — `groupMode="affix-sentiment"` → `groupMode="affix-sentiment-subblocks"`. Старый режим `affix-sentiment` сохранён как legacy (как `affix-semantic` сохранён после `affix-functional`) — backward compat с тестами / external callers.
- 7: Sanity-run `classifyWaystoneSubBlock` на real data. Обнаружены 2 issues с patterns:
  - (a) `энергетическ.*щит` в NEGATIVE_MONSTER_DEFENSE_PATTERNS был слишком broad — ловил player-ES дебафф «Скорость восстановления здоровья и энергетического щита игроков ... меньше» (должен идти в player-penalty). Fix: `монстр.*энергетическ.*щит` (требует «монстр» перед «энергетическ»).
  - (b) `порог.*состоян.*монстр` в NEGATIVE_MONSTER_DEFENSE_PATTERNS требовал «монстр» ПОСЛЕ «порог» — но текст «Монстры имеют N увеличение порога состояний» имеет «монстр» ДО «порог». Fix: `порог.*состоян|порог.*оглушен` (order-agnostic, работает в negative context где все such mods — monster-related).
  - (c) `дополнит.*ларец` был в POSITIVE_KEYWORDS, но отсутствовал в POSITIVE_LOOT_PATTERNS — «дополнительный ларец» (chest) падал бы в positive-buffs fallback вместо loot. Fix: добавлен `дополнит.*ларец` в POSITIVE_LOOT_PATTERNS.
- 8: После pattern fixes — финальная distribution на real data (73 family-groups, все классифицированы, ни один не потерян): positive-loot 8, positive-mechanics 13, positive-buffs 3, negative-monster-power 16, negative-monster-defense 9, negative-monster-modifiers 3, negative-player-penalty 7, negative-environment 8, neutral-generic 6.
- 9: Tests в `tests/shared/mod-classifier.test.ts` (+41 новых, total 369 в файле):
  - `classifyWaystoneSentiment` suite: +2 Known Issue #5 regression tests (verify «players deal no damage» теперь negative; verify intended minion-extra-damage mods всё ещё positive).
  - `classifyWaystoneSubBlock` suite (новый, 28 tests): coverage для всех 9 sub-blocks + fallback test + label-coverage sanity check.
  - `classifyGroups` suite: +5 tests для `affix-sentiment-subblocks` mode (composite-key sub-blocks, empty-skip, alphabetical within sub-block, canonical order, FamilyGroup reference preservation).
- 10: Cleanup. Удалены временные sanity scripts в `scripts/sanity/` (per iter 100 rule: «Не добавляй новые verify-iter*-*.ts скрипты — покрывай проверки через tests/ или inline sanity в worklog.md»). Distribution вынесена в STATUS.md как inline sanity table.
- 11: Верификация: `npx vitest run` → **1472/1472** (было 1431, +41). `npx tsc -b` → 0 errors. `npx eslint .` → 0 problems. ETL не запускался — `public/generated/*.json` не тронуты (verified via `git status`).
- 12: Документация:
  - `STATUS.md` — iter 104 как текущая; «Что сделано» + «Метрики» (1472/1472); Known Issue #5 помечен ✅ FIXED iter 104 с описанием фикса; «Открытые долги» обновлены — P2 waystone closed, P2 tablet остаётся; added inline sanity table (sub-block distribution на real data); runtime-метрики таблица обновлена (waystone row: 73 groups / 9 sub-blocks).
  - `worklog.md` — iter 103 сжат до одной строки, iter 104 добавлен подробно.
  - `AGENT_NAVIGATION.md` — entry paragraph bumped до iter 104 (waystone sub-blocks + Known Issue #5 closed); Roadmap iter 104 done + обновлён optional-список (P2 waystone closed, P2 tablet next).

Stage Summary:
- **iter 104 COMPLETE.** Waystone sub-blocks (P2 first half) реализованы: новый режим `affix-sentiment-subblocks` с 9 sub-blocks (3 positive + 5 negative + 1 neutral), WaystonePage переключён на новый режим. Known Issue #5 закрыт (`приспешник.*урон` false-positive).
- **Изменённые файлы (4):**
  - `src/shared/mod-classifier.ts` — +160 строк (WaystoneSubBlock type + WAYSTONE_SUBBLOCK_LABELS + WAYSTONE_SUBBLOCK_ORDER + 7 sub-block patterns + classifyWaystoneSubBlock function + affix-sentiment-subblocks mode в classifyGroups + Known Issue #5 fix в POSITIVE/NEGATIVE_KEYWORDS + sub-block pattern fixes: `монстр.*энергетическ.*щит`, order-agnostic `порог.*состоян|порог.*оглушен`, `дополнит.*ларец` в POSITIVE_LOOT_PATTERNS).
  - `src/ui/pages/waystone/WaystonePage.tsx` — 1 строка (groupMode change).
  - `tests/shared/mod-classifier.test.ts` — +41 новых тестов (2 Known Issue #5 regression + 28 classifyWaystoneSubBlock unit + 5 affix-sentiment-subblocks mode + 6 прочих).
  - `STATUS.md`, `worklog.md`, `AGENT_NAVIGATION.md` — документация актуализирована.
- **Тесты:** 1472/1472 (+41 vs iter 103). TSC: 0 errors. ESLint: **0 errors + 0 warnings**. ETL: 11 fresh, 0 stale. Никаких изменений в `public/generated/*.json`, ETL, runtime functional-classifier, схеме.
- **Real-data distribution (inline sanity):** 73/73 waystone family-groups классифицированы: positive-loot 8, positive-mechanics 13, positive-buffs 3, negative-monster-power 16, negative-monster-defense 9, negative-monster-modifiers 3, negative-player-penalty 7, negative-environment 8, neutral-generic 6.
- **Точка остановки:** iter 104 done. В iter 105+ можно:
  1. **P2 — tablet sub-blocks (second half)**: sub-группировка внутри type (ritual/breach/delirium/vaal/expedition/generic) по second-level gameplay mechanic. iter 104 закрыл только waystone half. Нужен анализ, какой second-level имеет смысл (например, rewards/difficulty/quantity внутри ritual; monster-density/loot/bosses внутри breach).
  2. **P4 — tier-aware sort toggle**: UI-тумблер «режим сортировки» (alpha vs tier-first) в `CategoryControlPanel`. iter 99 сделал tier вторичным, но toggle не добавлен.
  3. **Опционально: `sortKey?: number`** в `FamilyGroup` + ETL заполнение для «по популярности внутри категории».
  4. **Опционально: waystone neutral-generic (6 groups)**: 5 desecrated Breach-adjacent mods можно расширить POSITIVE_KEYWORDS, чтобы их поймать (большинство семантически positive — extra Breach content / player soul-steal benefit). Low-priority.
- **Подсказка следующему агенту:** iter 104 = waystone sub-blocks + Known Issue #5 fix, runtime functional-classifier / ETL / JSON / схема / tablet page не тронуты. Baseline: 1472/1472 tests, TSC 0, ESLint **0 problems**. Перед стартом iter 105 прочитай STATUS.md (актуальный статус + Known Issues — теперь только #1 и #2 остаются, оба intentional), worklog.md (iter 104 подробно + предыдущие одной строкой), AGENT_NAVIGATION.md (entry paragraph iter 104, Roadmap iter 104 done). Не создавай новые verify-iter*-*.ts скрипты — покрывай проверки через tests/ (vitest) или inline sanity в worklog.md (правило iter 100).

---

## Предыдущие итерации (кратко)

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
