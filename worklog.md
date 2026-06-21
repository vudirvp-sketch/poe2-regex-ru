# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 116
Agent: main
Task: iter 116 — расширение систематической сортировки аффиксов внутри блоков на `weapon-specific` (24 family-keys, jewel-only) + `flasks` (16 family-keys, belt+jewel).

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 115 — resources 29 family-keys, 7 блоков правил, 209 family-keys), docs/AFFIX_ORDERING_PLAN.md (полный план + §5.7 weapon-specific + §5.8 flasks канонические порядки для iter 116), worklog.md (iter 115 подробно), src/shared/block-sort-rules.ts (7 блоков, 209 family-keys), scripts/audit_block_sort_coverage.py (7 блоков), tests/shared/block-sort-rules.test.ts (1721 тестов). Полное понимание задачи iter 116.
- 2: Извлечение фактических family-keys для weapon-specific и flasks через helper Python-скрипт `scripts/extract_iter116_keys.py`. **Подтверждены counts:**
  - `weapon-specific`: 24 family-keys ✓ (совпадает с планом §5.7)
  - `flasks`: 16 family-keys ✓ (совпадает с iter 115 корректировкой)
  - Все weapon-specific keys — jewel-only (1 file: jewel.json).
  - Flasks keys — в 3 файлах: amulet (12 tokens), belt (40 tokens), jewel (6 tokens).
- 3: Decision — выполнить **оба блока в iter 116** (weapon-specific + flasks) согласно плану. Итеративная философия: «лучше недоделать, чем сломать», но объём manageable (40 family-keys total, ~110 строк правил) — делаем оба.
- 4: Проектирование canonical order для `weapon-specific` (10 weapon buckets × stat-type ones-digit):
  - Мечи (0-9) → Топоры (10-19) → Булавы (20-29) → Боевые посохи (30-39) → Кинжалы (40-49) → Копья (50-59) → Кистени (60-69) → Луки (70-79) → Самострелы (80-89) → Без оружия (90-99).
  - Stat order within weapon: damage → attack-speed → weapon-specific stat (crit/gauge/accuracy).
  - Weapon type order: melee first (swords/axes/maces/warstaves/daggers/spears/flails), then ranged (bows/crossbows), then unarmed.
  - Each Russian weapon name (instrumental case: мечами/топорами/булавами/etc.) is unique — no collision risk.
  - "Без оружия" (unarmed) uses "атаками без оружия" wording (with "атаками") for damage, distinct from other weapons' "<weapon>" pattern.
  - Корректировки плана §5.7: swords без crit, maces имеют stun-gauge (не freeze-gauge), кистени без attack-speed, самострелы без reload — данные отличаются от плана.
- 5: Проектирование canonical order для `flasks` (4 resource buckets × mechanic ones-digit):
  - Health flask (0-9) → Mana flask (10-19) → Any flask (20-29) → Flask buffs (30-39).
  - **Resource-first bucketing** (vs §5.8 plan's mechanic-first bucketing) — каждый resource (Health/Mana/Any) имеет parallel stat-типы (recovery-speed, recovery-amount, charges-gained, regen). План «Passive regen» bucket разрезал бы parallel структуру.
  - End-anchored `$` для `флакона$` (any-flask duration/charges-gained) — предотвращает коллизию с `флакона здоровья` / `флакона маны` variants.
  - Start-anchored `^` для `^Флаконы получают зарядов` (any-flask regen-per-sec) — предотвращает коллизию с `^Флаконы здоровья получают` / `^Флаконы маны получают`.
  - Specific (health/mana) правила listed BEFORE generic (any) — first-match-wins safety + readability.
  - Корректировки плана §5.8: Health flask 5 keys (план говорил 4, добавлен regen-during-effect), Any flask 5 keys (план говорил 4, добавлен regen-per-sec), Mana flask 4 keys (нет regen-during-effect в данных).
- 6: Реализация правил в `src/shared/block-sort-rules.ts`:
  - Добавлен `'weapon-specific': [...]` block (24 правила) с comment block перед ним.
  - Структура: 10 weapon buckets, каждый с damage → attack-speed → weapon-specific stat.
  - Добавлен `'flasks': [...]` block (16 правил) с comment block перед ним.
  - Структура: Health (5 keys) → Mana (4 keys) → Any (5 keys, end/start-anchored) → Buffs (2 keys).
  - Обновлён header комментарий: упоминание iter 116.
- 7: Зеркалирование правил в `scripts/audit_block_sort_coverage.py` (Python regex, идентичные patterns). Обновление main() — добавить `'weapon-specific'` и `'flasks'` в список проверяемых блоков, заменить "All 7 blocks" → "All 9 blocks". Обновлён docstring.
- 8: Первый запуск audit script — ✅ All 9 blocks fully covered (resistances 18 + attributes 13 + minions 34 + ailments 40 + damage-type 47 + defence-stats 28 + resources 29 + weapon-specific 24 + flasks 16 = 249 family-keys, 100% coverage). **Никаких uncovered family-keys** — все 40 новых правил сматчились корректно с первого раза благодаря уникальности weapon names и правильному anchoring для flasks.
- 9: Тесты (`tests/shared/block-sort-rules.test.ts`, +53 теста в новых SECTION 5e + 5f + 2 E2E в SECTION 7 + 1 update в SECTION 8):
  - SECTION 5e (weapon-specific): 24 case-tests для всех family-keys + 4 relationship tests (full bucket order 10 weapons, damage-before-speed для swords+warstaves, speed-before-freeze-gauge для warstaves, unarmed distinct wording).
  - SECTION 5f (flasks): 16 case-tests для всех family-keys + 6 relationship tests (full bucket order 4 buckets, Health-parallel-to-Mana, end-anchored collision check, start-anchored collision check, recovery-speed-before-recovery-amount, any-duration-before-buffs).
  - 2 E2E tests в SECTION 7: weapon-specific 4 weapons order (Мечи→Топоры→Булавы→Без оружия), flasks 3 buckets order (Health→Mana→Any).
  - Обновлён structural test в SECTION 8: "iter 116 scope: 9 blocks have rules" (изменён с 7 на 9) + добавлены 'weapon-specific' и 'flasks' в ожидаемый список.
  - Обновлён header комментарий файла: упоминание iter 116.
  - ВАЖНО: weapon-specific E2E test использует `'affix-functional'` classifier (не `'jewel-functional'`), потому что `jewel-functional` splits weapon-specific в 6 weapon-class sub-blocks — E2E test wants single-block sort verification.
- 10: Верификация — все четыре проверки зелёные:
  - `pnpm exec tsc -b` → **0 errors**
  - `pnpm exec vitest run --no-file-parallelism` → **1774/1774 tests passed** (37 test files, +53 новых теста vs iter 115 baseline 1721)
  - `pnpm exec eslint .` → **0 problems** (exit code 0)
  - `python3 scripts/audit_block_sort_coverage.py` → **9/9 blocks fully covered** (249 family-keys)
- 11: Документация:
  - `STATUS.md` — полный rewrite: iter 116 как текущее состояние. weapon-specific + flasks canonical orders + design notes + 9 блоков правил (249 family-keys, 100% coverage). Known Issues обновлены: #4 (11 блоков без правил — было 13, план iter 117+ с offence-speed/crit/buff-skills как приоритеты).
  - `docs/AFFIX_ORDERING_PLAN.md` — обновлён: §4.1 (9 блоков с правилами, 249 family-keys), §4.2 (11 блоков без правил, обновлённые counts + примечание про jewellery-only scope), §5 header (реализованные и для будущих итераций), §5.7 (weapon-specific — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана), §5.8 (flasks — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана + resource-first vs mechanic-first decision), §6 (тесты — 249 case-tests, iter 116 scope = 9 блоков), §7 (ключевые файлы — 9 блоков), §8 (точка остановки iter 116 → iter 117 + корректировки плана).
  - `AGENT_NAVIGATION.md` — header обновлён: iter 116 как текущее состояние. Test count обновлён: 1774 passing (было 1431 — leftover, вообще-то должен был быть 1721 после iter 115). Block-sort-rules.ts line count + blocks count обновлены: ~770 строк, 9 блоков (249 family-keys).
  - `worklog.md` — iter 116 подробно, iter 115 сжат до одной строки в «Предыдущие итерации».

Stage Summary:
- **iter 116 COMPLETE.** weapon-specific (24 family-keys, 100% coverage) + flasks (16 family-keys, 100% coverage) block rules внедрены. Total 9 блоков правил, 249 family-keys, 100% coverage.
- **Изменённые файлы (5 в репозитории):**
  - `src/shared/block-sort-rules.ts` — +150 строк: добавлен `'weapon-specific': [...]` block (24 правила + comment) + `'flasks': [...]` block (16 правил + comment) + обновлён header.
  - `scripts/audit_block_sort_coverage.py` — +60 строк: добавлены `'weapon-specific'` + `'flasks'` blocks (зеркало TS правил) + 2 блока в список проверяемых + "All 9 blocks" в сообщение + обновлён docstring.
  - `tests/shared/block-sort-rules.test.ts` — +195 строк: SECTION 5e (24 case-tests + 4 relationship tests для weapon-specific), SECTION 5f (16 case-tests + 6 relationship tests для flasks), 2 E2E tests в SECTION 7, обновлён structural test в SECTION 8 (9 блоков).
  - `STATUS.md`, `docs/AFFIX_ORDERING_PLAN.md`, `AGENT_NAVIGATION.md`, `worklog.md` — обновлены.
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1774/1774 (+53 vs iter 115 baseline 1721), eslint 0 problems.
- **Audit script:** ✅ 9/9 blocks fully covered (resistances 18 + attributes 13 + minions 34 + ailments 40 + damage-type 47 + defence-stats 28 + resources 29 + weapon-specific 24 + flasks 16 = 249 family-keys).
- **Корректировки плана iter 116** (зафиксированы в docs/AFFIX_ORDERING_PLAN.md §5.7 + §5.8):
  - `weapon-specific`: 24 family-keys (совпадает с планом).
  - `weapon-specific` sword без crit, maces с stun-gauge (не freeze-gauge), кистени без attack-speed, самострелы без reload — данные отличались от плана.
  - `flasks`: 16 family-keys ✓.
  - `flasks`: **resource-first bucketing** (вместо mechanic-first из плана) — Health/Mana/Any параллельны по stat-типам.
  - `flasks`: Health 5 keys (план 4, добавлен regen-during-effect), Any 5 keys (план 4, добавлен regen-per-sec).
- **Known Issues (итог):**
  - #1 (jewel.json opt-table > 250 chars) — runtime split handles.
  - #2 (j05iep crit) — intentional.
  - #3 (APCA Lc<75 для small text — iter 111 accepted tradeoff).
  - #4 (UPDATED iter 116): 11 functional blocks БЕЗ правил сортировки → fallback к alphabetical. План iter 117+ в docs/AFFIX_ORDERING_PLAN.md §4.2 (приоритеты: offence-speed/crit/buff-skills).
  - #5 (бывший regex-баг — closed iter 112).
- **Точка остановки:** iter 116 done. В iter 117 можно:
  1. **Добавить правила для priority-блоков** (см. docs/AFFIX_ORDERING_PLAN.md §4.2 + §5.3 + §5.4 + §5.6): `offence-speed` (12 family-keys), `crit` (9 family-keys), `buff-skills` (7 family-keys).
  2. **Визуальная верификация пользователем** (перенос из iter 111) — UI в браузере: контрасты, читаемость 12px, affix ordering в resistances/attributes/minions/ailments + damage-type + defence-stats + resources + **NEW iter 116: weapon-specific + flasks**.
  3. Опционально (iter 111 leftover): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
- **Подсказка следующему агенту:** iter 116 = weapon-specific (24) + flasks (16) block rules, 100% coverage each. Перед стартом iter 117 прочитай STATUS.md (актуальный статус + Known Issues #4 — 11 блоков без правил), docs/AFFIX_ORDERING_PLAN.md (полный план + канонические порядки §5.3 offence-speed + §5.4 crit + §5.6 buff-skills), worklog.md (этот раздел iter 116). Audit script: `python3 scripts/audit_block_sort_coverage.py` — показывает coverage правил для 9 активных блоков. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 115**: resources block rules (29 family-keys, 100% coverage). Canonical order: Здоровье → Мана → ES → Конверсия → Тотем → Прочее. 1721/1721 tests.
- **iter 114**: defence-stats block rules (28 family-keys, 100% coverage). Canonical order: Броня → Уклонение → ES → Блок → Порог оглушения → Отклонение → Обереги → Разрушение брони. 1687/1687 tests.
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
