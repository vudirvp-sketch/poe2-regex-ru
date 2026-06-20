# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 108
Agent: main
Task: Фикс вложенных кавычек в OR-регексах для токенов с `regexPrefixContext` без `regexExclude`. Пользователь выбрал 7 аффиксов Бездны на tablet в OR-режиме, получил регекс `"...|\"провал,\" \"вплоть\"|..."` (вложенные кавычки внутри внешнего OR-quote), который не подсвечивает ничего в игре (rule B0 — zero matches between quoted groups). Root cause: `normalizeAst` в `src/core/compiler.ts` transform-ил AND-in-OR только для случая с EXCLUDE (iter 49); случай без EXCLUDE не покрывался.

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 107 — UX P4 tier borders, 1533/1533), AGENT_NAVIGATION.md, docs/IN_GAME_TESTS.md (правила PoE2 regex dialect). Подтверждение baseline: `npx vitest run` → 1533/1533; `npx tsc -b` → 0 errors; `npx eslint .` → 0 problems.
- 2: Воспроизведение бага. Написал `scripts/repro_abyss.ts` — загрузил tablet.json, отфильтровал 7 user-selected токенов (mod_l616q8, mod_3y9nuc, mod_1vman9, mod_m17m7u, mod_by2ufv, mod_7jrajl, mod_7ms10f), построил AST в OR-режиме, скомпилировал. Получил сломанный регекс: `"дополнительные Бездны|валюты из Бездн на карте|свойствами Бездны|ную бездну|"провал," "вплоть"|личиваются|появляется"` (118 chars, внутри внешних кавычек — вложенные `"провал," "вплоть"`).
- 3: Root cause analysis. `buildLiteralNode` в `src/ui/hooks/category-ast-utils.ts` оборачивает токены с `regexPrefixContext` в `AND(LITERAL_ctx, LITERAL_regex)`. В `src/core/compiler.ts` `normalizeAst` OR-case трансформил только AND с EXCLUDE (iter 49: `^(?!…).*ctx.*Z`). AND без EXCLUDE fallback-ил в `compileInner` AND-case → `"ctx" "regex"` (два quoted groups через пробел = cross-block AND). Внутри внешнего OR-quote это давало вложенные кавычки → PoE2 returning zero matches (rule B0 в docs/IN_GAME_TESTS.md). opt-table Path D маскировал баг для full-family selection, но при partial subset (как у пользователя) opt-table skip-уется (iter 44 strict-subset + hasAlternation guard).
- 4: Фикс в `src/core/compiler.ts`. Расширил `normalizeAst` OR-case — добавлена ветка перед iter 49 branch: если AND child имеет 0 EXCLUDE children и все children являются LITERAL (≥2), мержит их через `.*` bridge в один LITERAL. Single-LITERAL AND (defensive case) → unwrap to plain LITERAL. AND с RANGE/MULTI_RANGE/nested-AND children — оставляем untouched (conservative). Обновил JSDoc comment block (добавлен iter 108 section с описанием root cause и semantic improvement: same-block AND вместо cross-block AND — это и было изначальное намерение `regexPrefixContext`).
- 5: Верификация фикса. `scripts/verify_fix.ts` (использует ACTUAL `src/core/compiler.ts`): регекс после фикса — `"дополнительные Бездны|валюты из Бездн на карте|свойствами Бездны|ную бездну|провал,.*вплоть|личиваются|появляется"` (115 chars, NO nested quotes, single quoted group с top-level `|`). Match с expected string ✓.
- 6: Регрессионные тесты. `tests/core/optimizer.test.ts` — +10 новых тестов в `compile: AND-in-OR with EXCLUDE → anchored lookahead` describe блоке (новый section header `iter 108: AND(LITERAL...) WITHOUT EXCLUDE inside OR`):
  1. AND(LITERAL_ctx, LITERAL_regex) inside OR — merges via .* bridge (точный expected string `провал,.*вплоть|Q`).
  2. AND(LITERAL_A, LITERAL_B, LITERAL_C) inside OR — 3-way merge (`ctx1.*ctx2.*X|Q`).
  3. **Full 7-affix Abyss tablet scenario** — no nested quotes (точный expected string с 7 alternatives, locks the compiled form).
  4. preserves tokenId from regex LITERAL.
  5. AND with single LITERAL inside OR — unwraps to plain LITERAL (defensive case).
  6. AND with RANGE child + no EXCLUDE inside OR — still NOT transformed (conservative boundary).
  7. **Top-level AND(LITERAL, LITERAL) NOT inside OR — preserved as cross-block AND** (`"ctx" "regex"` — boundary test, iter 108 only applies inside OR).
  8. OR with mixed children (AND-no-EXCLUDE + plain LITERAL + AND-with-EXCLUDE) — all three transforms coexist (`ctx.*X|Y|^(?!.*A).*Z`).
  9. AND(LITERAL_A, LITERAL_B) inside OR — same-block semantic (compiled form verification; semantic matcher tests в poe2-regex-matcher.test.ts).
  10. **Regression: opt-table skip with partial subset still produces valid regex** — пустой opt-table, AST через `optimize()` pipeline, компилятор всё равно применяет iter 108 transform (независимо от opt-table).
- 7: Верификация. `npx vitest run` → **1543/1543** (было 1533, +10). `npx tsc -b` → 0 errors. `npx eslint .` → 0 problems (после cleanup 2 debug scripts: repro_abyss.ts, test_broken_regex.ts, verify_fix.ts — удалены, не part of fix).
- 8: Документация:
  - `STATUS.md` — полный rewrite: iter 108 как текущее состояние (симптом + root cause + фикс + impact + метрики); Known Issues без изменений (#1, #2); «Оптимальные стратегии» таблица += iter 108 row (`Token с regexPrefixContext без regexExclude в OR | ctx.*Z (same-block AND) | ✅ iter 108`); удалена verbose iter 107 «Что сделано» section (теперь в «Предыдущие итерации» одной строкой).
  - `AGENT_NAVIGATION.md` — entry paragraph bumped до iter 108 (фикс вложенных кавычек, 1543/1543 тестов, +10).
  - `worklog.md` — iter 107 сжат до одной строки, iter 108 добавлен подробно.

Stage Summary:
- **iter 108 COMPLETE.** Фикс вложенных кавычек в OR-регексах для токенов с `regexPrefixContext` без `regexExclude`. `normalizeAst` в `src/core/compiler.ts` расширен: AND(LITERAL..., LITERAL...) без EXCLUDE внутри OR → merge через `.*` bridge в один LITERAL. До фикса: `"ctx" "regex"` (cross-block AND) → внутри внешнего OR-quote давало вложенные кавычки → PoE2 zero matches (B0). После фикса: `ctx.*regex` (same-block AND) → валидный single-quoted OR-регекс. Семантически MORE correct (same-block AND было изначальным намерением `regexPrefixContext`).
- **Изменённые файлы (4):**
  - `src/core/compiler.ts` — +40 строк в `normalizeAst` OR-case (новый iter 108 branch перед iter 49 branch; single-LITERAL AND unwrap; RANGE/MULTI_RANGE bail) + JSDoc update (iter 108 section с semantic explanation).
  - `tests/core/optimizer.test.ts` — +200 строк (+10 регрессионных тестов в новом `iter 108: AND(LITERAL...) WITHOUT EXCLUDE inside OR` section, including full 7-affix Abyss tablet scenario reproduction).
  - `STATUS.md` — полный rewrite (clean, только актуальное; iter 108 как текущее; iter 107 в «Предыдущие итерации»).
  - `AGENT_NAVIGATION.md` — entry paragraph bumped до iter 108.
  - `worklog.md` — iter 108 подробно, iter 107 одной строкой.
- **Тесты:** 1543/1543 (+10 vs iter 107). TSC: 0 errors. ESLint: **0 errors + 0 warnings**. ETL: 11 fresh, 0 stale. `public/generated/*.json` не тронуты.
- **Точка остановки:** iter 108 done. Bug fixed. В iter 109+ можно:
  1. **In-game verification:** пользователь может протестировать регекс `"дополнительные Бездны|валюты из Бездн на карте|свойствами Бездны|ную бездну|провал,.*вплоть|личиваются|появляется"` в игре на своих плитках Бездны — должен подсветить все 7 аффиксов.
  2. **Опционально: ёфикация (yofication)** — `applyRuntimeYofication` не применялась в тестовом регексе, потому что `yoficationPositions` в token JSON относятся к RAW TEXT, а не к REGEX. Это отдельный баг (не критичный — ёфикация nice-to-have, игра treats 'е' и 'ё' как equivalent). Если_fix нужен, ETL должен сохранять positions relative to regex, не rawText.
  3. **Опционально: ETL cleanup** — прогнать `pnpm etl:fresh` чтобы убрать избыточные `regexPrefixContext` для токенов, где они больше не нужны (теперь компилятор handles same-block AND correctly). Но это требует ETL run (~2-5 мин) + regression testing.
  4. **Опционально (low-priority): sortKey/popularity** third sort mode (alpha / tier-first / popularity).
- **Подсказка следующему агенту:** iter 108 = фикс compiler bug (AND-in-OR без EXCLUDE → вложенные кавычки → zero matches в игре). Baseline: 1543/1543 tests, TSC 0, ESLint **0 problems**. Перед стартом iter 109 прочитай STATUS.md (актуальный статус + Known Issues #1/#2), worklog.md (iter 108 подробно), AGENT_NAVIGATION.md (entry iter 108). Если пользователь подтвердит in-game что фикс работает — закрыть Known Issue (если был). Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

## Предыдущие итерации (кратко)

- **iter 107**: UX-полировка P4 — tier-colored left border для всех 4 tier'ов в tier-first режиме. `FilterChip` += optional `sortMode` prop, threading через ModList/VirtualizedModList. 1533/1533 tests.
- **iter 106**: P4 — tier-aware sort toggle (alpha vs tier-first). `SortMode` type + `sortGroupsByTierFirst()` + UI-toggle в `CategoryControlPanel`. 1522/1522 tests.
- **iter 105**: P2 second half — tablet sub-blocks. Новый режим `tablet-type-subblocks` с 19 sub-blocks. 1500/1500 tests.
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
