# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 114
Agent: main
Task: iter 114 — расширение систематической сортировки аффиксов внутри блоков на `defence-stats` (28 family-keys — защитный блок, второй по видимости после damage-type).

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 113 — damage-type 47 family-keys, 5 блоков правил), docs/AFFIX_ORDERING_PLAN.md (полный план + §5.2 предложение для defence-stats: 32 family-keys с 8 buckets), worklog.md (iter 113 подробно), src/shared/block-sort-rules.ts (5 блоков, 152 family-keys), scripts/audit_block_sort_coverage.py (5 блоков), tests/shared/block-sort-rules.test.ts (1654 тестов). Полное понимание задачи iter 114.
- 2: Извлечение всех family-keys для `defence-stats` из 6 JSON-файлов (amulet/ring/belt/jewel/jewel-desecrated/jewel-corrupted) через helper Python-скрипт `scripts/extract_defence_stats_keys.py`. **Важная находка: фактически 28 family-keys, а не 32 как указано в плане §5.2** — план завышал количество. Также проверил relic/tablet/waystone JSON — defence-stats там отсутствует (только в jewellery).
- 3: Проектирование canonical order для `defence-stats` (8 buckets: Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони). 28 family-keys распределены по buckets. Design principles:
   - Most-specific-first: triple-stat правила (shield, global) идут ПЕРЕД single-stat правилами, потому что triple-stat family-keys содержат "брони"/"уклонения"/"энергетического щита", которые матчили бы более простые single-stat паттерны.
   - Conditional правила (порог оглушения) идут перед bare `%`-правилом (которое end-anchored через `$`).
   - Flat-правила (`к броне$`, `к уклонению$`, `к порогу оглушения$`) используют `$` end-anchor для уникальности.
   - Stem "оберег" покрывает все падежи: оберега (genitive sg), оберегов (genitive pl), обереги (nominative pl).
   - Pattern `уменьшение силы замедления.*если недавно вы использовали оберег` использует `.*` bridge из-за длины family-key с запятыми.
   - Ward-synergy damage mod ("увеличение урона, пока у вас активен оберег") идёт последним в ward bucket — это offensive buff gated на defensive mechanic.
- 4: Реализация правил в `src/shared/block-sort-rules.ts`:
   - Добавлен `'defence-stats': [...]` block (28 правил).
   - Comment block с описанием canonical order + design notes.
   - 2 triple-stat правила ПЕРВЫМИ (shield, global).
   - 3 Броня правила (flat, %, from-body).
   - 3 Уклонение правила (flat, %, from-body).
   - 4 ES правила (from-body, from-focus, recharge-speed, recharge-start).
   - 1 Блок правило.
   - 4 Порог оглушения правила (2 conditional, %, flat).
   - 1 Отклонение правило.
   - 7 Обереги правил (duration, charges-gained, charges-used-reduction, conditional-slow, free-use, regen, ward-active-damage).
   - 3 Разрушение брони правила (duration, quantity, damage-vs-broken).
   - Обновлён header комментарий: упоминание iter 114.
- 5: Зеркалирование правил в `scripts/audit_block_sort_coverage.py` (Python regex, идентичные patterns). Обновление main() — добавить `'defence-stats'` в список проверяемых блоков, заменить "All 5 blocks" → "All 6 blocks". Обновлён docstring.
- 6: Первый запуск audit script — ✅ All 6 blocks fully covered (resistances 18, attributes 13, minions 34, ailments 40, damage-type 47, defence-stats 28 = 180 family-keys, 100% coverage). **Никаких uncovered family-keys** — все 28 правил сматчились корректно с первого раза благодаря тщательному дизайну most-specific-first ordering.
- 7: Тесты (`tests/shared/block-sort-rules.test.ts`, +33 теста в новой SECTION 5c + 1 E2E в SECTION 7):
   - 28 case-tests для всех family-keys defence-stats (по одному на каждое правило).
   - 4 relationship/canonical order tests: full bucket order (Броня→Уклонение→ES→Блок→Порог→Отклонение→Обереги→Разрушение), triple-stat-vs-single-stat, conditional-vs-bare-porog, flat-vs-percent.
   - 1 E2E test в SECTION 7: 4 buckets order Броня → Уклонение → Блок → Обереги (через groupTokensByFamily → classifyGroups → sortGroupsAlphabetically).
   - Обновлён structural test в SECTION 8: "iter 114 scope: 6 blocks have rules" (изменён с 5 на 6).
   - Обновлён header комментарий файла: упоминание iter 114.
- 8: Верификация — все три проверки зелёные:
   - `npx tsc -b` → **0 errors**
   - `npx vitest run` → **1687/1687 tests passed** (37 test files, +33 новых теста vs iter 113 baseline 1654)
   - `npx eslint .` → **0 problems** (exit code 0)
- 9: Документация:
   - `STATUS.md` — полный rewrite: iter 114 как текущее состояние. defence-stats canonical order + design notes + 6 блоков правил (180 family-keys, 100% coverage). Known Issues обновлены: #4 (14 блоков без правил — было 15, план iter 115+ с resources/weapon-specific/flasks как приоритеты).
   - `docs/AFFIX_ORDERING_PLAN.md` — обновлён: §4.1 (6 блоков с правилами, 180 family-keys), §4.2 (14 блоков без правил), §5.2 (defence-stats — РЕАЛИЗОВАН с фактическим canonical order), §6 (тесты — 180 case-tests), §7 (ключевые файлы — 6 блоков), §8 (точка остановки iter 114 → iter 115).
   - `worklog.md` — iter 114 подробно, iter 113 сжат до одной строки в «Предыдущие итерации».

Stage Summary:
- **iter 114 COMPLETE.** defence-stats block rules внедрены (28 family-keys, 100% coverage). Canonical order: Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони (8 buckets).
- **Изменённые файлы (5 в репозитории):**
  - `src/shared/block-sort-rules.ts` — +85 строк: добавлен `'defence-stats': [...]` block с 28 правилами + comment block.
  - `scripts/audit_block_sort_coverage.py` — +40 строк: добавлен `'defence-stats'` block (зеркало TS правил) + `'defence-stats'` в список проверяемых блоков + "All 6 blocks" в сообщение.
  - `tests/shared/block-sort-rules.test.ts` — +110 строк: SECTION 5c (28 case-tests + 4 relationship tests), 1 E2E test в SECTION 7, обновлён structural test в SECTION 8 (6 блоков).
  - `STATUS.md`, `docs/AFFIX_ORDERING_PLAN.md`, `worklog.md` — обновлены.
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1687/1687 (+33 vs iter 113 baseline 1654), eslint 0 problems.
- **Audit script:** ✅ 6/6 blocks fully covered (resistances 18 + attributes 13 + minions 34 + ailments 40 + damage-type 47 + defence-stats 28 = 180 family-keys).
- **Known Issues (итог):**
  - #1 (jewel.json opt-table > 250 chars) — runtime split handles.
  - #2 (j05iep crit) — intentional.
  - #3 (APCA Lc<75 для small text — iter 111 accepted tradeoff).
  - #4 (UPDATED iter 114): 14 functional blocks БЕЗ правил сортировки → fallback к alphabetical. План iter 115+ в docs/AFFIX_ORDERING_PLAN.md §4.2 (приоритеты: resources/weapon-specific/flasks).
  - #5 (бывший regex-баг — closed iter 112).
- **Точка остановки:** iter 114 done. В iter 115 можно:
  1. **Добавить правила для priority-блоков** (см. docs/AFFIX_ORDERING_PLAN.md §4.2 + §5.5): `resources` (33), `weapon-specific` (24, jewel-only), `flasks` (18).
  2. **Визуальная верификация пользователем** (перенос из iter 111) — UI в браузере: контрасты, читаемость 12px, новый affix ordering в resistances/attributes/minions/ailments + damage-type + **NEW iter 114: defence-stats**.
  3. Опционально (iter 111 leftover): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
- **Подсказка следующему агенту:** iter 114 = defence-stats block rules (28 family-keys, 100% coverage). Перед стартом iter 115 прочитай STATUS.md (актуальный статус + Known Issues #4), docs/AFFIX_ORDERING_PLAN.md (полный план + канонические порядки для 14 оставшихся блоков), worklog.md (этот раздел iter 114). Audit script: `python3 scripts/audit_block_sort_coverage.py` — показывает coverage правил для 6 активных блоков. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 113**: damage-type block rules (47 family-keys, 100% coverage). Canonical order: физический → огонь → холод → молния → хаос → стихийный → generic/by-source → conditional → by-target → special. 1654/1654 tests.
- **iter 112**: фикс regex-бага «Истощения Бездны» (data patch + ETL algorithm filter + 2 regression tests) + внедрение sortKey infrastructure (FamilyGroup.sortKey + computeSortKey + 4 блока правил: resistances/attributes/minions/ailments, 105 family-keys, 100% coverage). 1602/1602 tests.
- **iter 111**: KI#3/#4/#5 из аудита v2 (CSS/JSX правки для placeholder consolidation, dim/faint consolidation, partial font-medium fix). 1543/1543 tests.
- **iter 110**: Приоритет 2.7–2.9 + 3.10–3.13 UI-аудита v2 (5 правок CSS/JSX + APCA-валидация). Все 13 пунктов аудита v2 закрыты. 1543/1543 tests.
- **iter 109**: Приоритет 1 UI-аудита v2 (5 правок CSS/JSX) + Noto Sans self-hosted woff2 400/500/600. 1543/1543 tests.
- **iter 108**: фикс вложенных кавычек в OR-регексах для токенов с `regexPrefixContext` без `regexExclude` — `normalizeAst` в `src/core/compiler.ts` расширен. 1543/1543 tests, +10 regression tests.
- **iter 107**: UX-полировка P4 — tier-colored left border для 4 tier'ов в tier-first режиме.
- **iter 106**: P4 — tier-aware sort toggle (alpha vs tier-first).
- **iter 105**: P2 second half — tablet sub-blocks (19 sub-blocks).
- **iter 104**: P2 first half — waystone sub-blocks + Known Issue #5 fix (9 sub-blocks).
- **iter 103**: подавление 2 TanStack library-level ESLint warnings.
- **iter 102**: e2e-регрессионные тесты для runtime-classification pipeline.
- **iter 101**: P0-фикс Critical Bug — `GameTokenSchema` без `functionalCategory` → Zod strips → runtime classifier падал в `other`.
- **iter 99**: alphabetical within-block sort.
- **iter 98**: relic-semantic mode (7 Sanctum-категорий для 25 family-keys).
- **iter 96**: удалены 22-шаговый regex fallback + 21 pattern constants из `classifyFunctionalBlock()`.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.

