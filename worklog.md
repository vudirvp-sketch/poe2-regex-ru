# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 117
Agent: main
Task: iter 117 — расширение систематической сортировки аффиксов внутри блоков на 3 priority-блока: `offence-speed` (12 family-keys), `crit` (9 family-keys), `buff-skills` (7 family-keys).

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 116 — 9 блоков правил, 249 family-keys, 100% coverage), docs/AFFIX_ORDERING_PLAN.md (полный план + §5.3 offence-speed + §5.4 crit + §5.6 buff-skills — предложенные canonical orders для iter 117), worklog.md (iter 116 подробно), src/shared/block-sort-rules.ts (9 блоков, ~770 строк), scripts/audit_block_sort_coverage.py (9 блоков), tests/shared/block-sort-rules.test.ts (1774 тестов). Полное понимание задачи iter 117.
- 2: Извлечение фактических family-keys через helper Python-скрипт `/home/z/my-project/scripts/list_family_keys_iter117.py`. **Подтверждены counts:**
  - `offence-speed`: 12 family-keys ✓ (совпадает с планом §5.3)
  - `crit`: 9 family-keys ✓ (совпадает с планом §5.4)
  - `buff-skills`: 7 family-keys ✓ (совпадает с планом §5.6)
- 3: Decision — выполнить **все 3 блока в iter 117** согласно плану. Итеративная философия: «лучше недоделать, чем сломать», но объём manageable (28 family-keys total, ~90 строк правил) — делаем все 3.
- 4: Проектирование canonical order для `offence-speed`:
  - Combat-relevant speeds first: attack (0) → cast (10) → move (20) → projectile (30) → crossbow-reload (40) → warcry (50) → trap (60) → totem (70) → swap (80) → skill (90).
  - Two subset/conditional variants identified: mark-skill cast speed (order 11, subset of spell cast speed 10), transformed-conditional skill speed (order 91, variant of generic 90).
  - Two substring conflicts handled via first-match-wins (most-specific FIRST):
    1. `скорости сотворения чар` — в generic cast speed И в mark-skill cast speed → mark rule (с `умения метки имеют.*` prefix) listed FIRST.
    2. `скорости умений` — в generic skill speed И в transformed-conditional → transformed rule (с `будучи превращенным` suffix) listed FIRST.
  - End-anchored `$` на bare generic rules — defensive (first-match-wins уже handles).
- 5: Проектирование canonical order для `crit`:
  - Chance first (0-30), then damage (40-50), then synergy (70).
  - Russian morphology disambiguates % vs flat:
    - % increase uses genitive case: `шанса`, `бонуса`.
    - + flat uses dative case (after "к"): `шансу`, `бонусу`.
    - These word forms are distinct — % rules don't match flat family-keys.
  - End-anchored `$` на generic variants — defensive against specific variants (e.g., `бонуса к критическому урону$` matches generic but NOT `...от чар`).
  - Crit-induced ailment strength comes LAST (order 70) — synergy mod, not direct crit stat.
  - Корректировка плана: bucket 50-59 имеет только 1 key (attacks flat), не "атаками/шипами" как план — шипы-variant отсутствует в данных.
- 6: Проектирование canonical order для `buff-skills`:
  - Skill types order: Auras (0) → Heralds (10) → Curses (20-21) → Warcries (40-41) → Marks (50).
  - **Корректировки плана §5.6:**
    - Plan mentioned "Знамёна (длительность)" at order 30 — NO знамёна family-keys в jewellery-scope data. Bucket 30 left empty.
    - Plan mentioned "скорость применения" для warcries — actual data has "скорость перезарядки" (reload speed). Order 41 used for reload.
    - Plan mentioned "скорость сотворения" для marks — actual data has only "усиление эффекта". Mark cast speed is in `offence-speed` block (order 11), not in `buff-skills`. Order 50 used for effect only.
  - Distinctive phrases avoid substring conflicts:
    - `силы умений аур` (auras) vs `силы проклятий` (curses) — both contain "силы" but full phrases distinct.
    - `усиление положительного эффекта боевого клича` (warcries) vs `усиление эффекта.*умений меток` (marks) — different word order.
  - Mark rule uses `.*` bridge: "усиление эффекта ваших умений меток" has "ваших" between "эффекта" and "умений меток".
- 7: Реализация правил в `src/shared/block-sort-rules.ts`:
  - Добавлен `'offence-speed': [...]` block (12 правил, включая 2 most-specific-FIRST для substring-conflict resolution) с comment block перед ним.
  - Добавлен `'crit': [...]` block (9 правил, flat-first затем %-increase) с comment block перед ним.
  - Добавлен `'buff-skills': [...]` block (7 правил, по skill type) с comment block перед ним.
  - Обновлён header комментарий: упоминание iter 117.
- 8: Зеркалирование правил в `scripts/audit_block_sort_coverage.py` (Python regex, идентичные patterns). Обновление main() — добавить `'offence-speed'`, `'crit'`, `'buff-skills'` в список проверяемых блоков, заменить "All 9 blocks" → "All 12 blocks". Обновлён docstring.
- 9: Первый запуск audit script — ✅ All 12 blocks fully covered (277 family-keys total, 100% coverage). **Никаких uncovered family-keys** — все 28 новых правил сматчились корректно с первого раза благодаря morphology-aware patterns (genitive vs dative) и правильному anchoring.
- 10: Тесты (`tests/shared/block-sort-rules.test.ts`, +46 тестов в новых SECTION 5g + 5h + 5i + 3 E2E в SECTION 7 + 1 update в SECTION 8):
  - SECTION 5g (offence-speed): 12 case-tests для всех family-keys + 5 relationship tests (full bucket order 10 speeds, mark-subset-after-generic, transformed-after-generic, first-match-wins check, end-anchored check).
  - SECTION 5h (crit): 9 case-tests для всех family-keys + 5 relationship tests (full bucket order 9 crits, morphology-disambiguation, end-anchored bonus-damage check, end-anchored chance check, ailment-from-crit last).
  - SECTION 5i (buff-skills): 7 case-tests для всех family-keys + 4 relationship tests (full bucket order 5 buckets, curse-strength-before-activation, warcry-effect-before-reload, distinctive-phrase checks для auras-vs-curses и warcry-vs-marks).
  - 3 E2E tests в SECTION 7: offence-speed 4 speeds order, crit 3 crit-chance variants order, buff-skills 3 skill types order.
  - Обновлён structural test в SECTION 8: "iter 117 scope: 12 blocks have rules" (изменён с 9 на 12) + добавлены 'buff-skills', 'crit', 'offence-speed' в ожидаемый список.
  - Обновлён header комментарий файла: упоминание iter 117.
- 11: Верификация — все четыре проверки зелёные:
  - `npx tsc --noEmit` → **0 errors**
  - `npx vitest run` → **1820/1820 tests passed** (37 test files, +46 новых тестов vs iter 116 baseline 1774)
  - `npx eslint src/shared/block-sort-rules.ts tests/shared/block-sort-rules.test.ts` → **0 errors** (1 warning о том, что .py файл не покрыт eslint config — expected для Python)
  - `python3 scripts/audit_block_sort_coverage.py` → **12/12 blocks fully covered** (277 family-keys)
- 12: Документация:
  - `STATUS.md` — полный rewrite: iter 117 как текущее состояние. offence-speed + crit + buff-skills canonical orders + design notes + 12 блоков правил (277 family-keys, 100% coverage). Known Issues #4 updated: 12 блоков без правил (было 15 listed в iter 116 как "11" — несоответствие исправлено: 15 - 3 = 12).
  - `docs/AFFIX_ORDERING_PLAN.md` — обновлён: §4.1 (12 блоков с правилами, 277 family-keys), §4.2 (12 блоков без правил, обновлённые counts + iter 118+ priorities), §5 header (все 8 sections реализованы), §5.3 (offence-speed — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана), §5.4 (crit — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана), §5.6 (buff-skills — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана), §6 (тесты — 277 case-tests, iter 117 scope = 12 блоков), §7 (ключевые файлы — 12 блоков), §8 (точка остановки iter 117 → iter 118 + корректировки плана).
  - `worklog.md` — iter 117 подробно, iter 116 сжат до одной строки в «Предыдущие итерации».

Stage Summary:
- **iter 117 COMPLETE.** offence-speed (12 family-keys, 100% coverage) + crit (9 family-keys, 100% coverage) + buff-skills (7 family-keys, 100% coverage) block rules внедрены. Total 12 блоков правил, 277 family-keys, 100% coverage.
- **Изменённые файлы (5 в репозитории):**
  - `src/shared/block-sort-rules.ts` — +147 строк: добавлен `'offence-speed': [...]` block (12 правил + comment) + `'crit': [...]` block (9 правил + comment) + `'buff-skills': [...]` block (7 правил + comment) + обновлён header.
  - `scripts/audit_block_sort_coverage.py` — +48 строк: добавлены `'offence-speed'` + `'crit'` + `'buff-skills'` blocks (зеркало TS правил) + 3 блока в список проверяемых + "All 12 blocks" в сообщение + обновлён docstring.
  - `tests/shared/block-sort-rules.test.ts` — +227 строк: SECTION 5g (12 case-tests + 5 relationship tests для offence-speed), SECTION 5h (9 case-tests + 5 relationship tests для crit), SECTION 5i (7 case-tests + 4 relationship tests для buff-skills), 3 E2E tests в SECTION 7, обновлён structural test в SECTION 8 (12 блоков).
  - `STATUS.md`, `docs/AFFIX_ORDERING_PLAN.md`, `worklog.md` — обновлены.
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1820/1820 (+46 vs iter 116 baseline 1774), eslint 0 problems.
- **Audit script:** ✅ 12/12 blocks fully covered (resistances 18 + attributes 13 + minions 34 + ailments 40 + damage-type 47 + defence-stats 28 + resources 29 + weapon-specific 24 + flasks 16 + offence-speed 12 + crit 9 + buff-skills 7 = 277 family-keys).
- **Корректировки плана iter 117** (зафиксированы в docs/AFFIX_ORDERING_PLAN.md §5.3 + §5.4 + §5.6):
  - `offence-speed`: 12 family-keys ✓ (совпадает с планом).
  - `offence-speed`: добавлены mark-skill cast speed (order 11) и transformed-conditional skill speed (order 91) — план не упоминал.
  - `crit`: 9 family-keys ✓ (совпадает с планом).
  - `crit`: bucket 50-59 имеет только 1 key (attacks flat) — план говорил "атаками/шипами", шипы-variant отсутствует в данных.
  - `buff-skills`: 7 family-keys ✓ (совпадает с планом).
  - `buff-skills`: **NO знамёна family-keys в jewellery-scope data** — bucket 30 (план §5.6) left empty.
  - `buff-skills`: warcries имеют "скорость перезарядки" (reload), не "скорость применения" (application) как план.
  - `buff-skills`: marks имеют только "усиление эффекта", не "скорость сотворения" как план. Mark cast speed классифицирован в `offence-speed` (order 11).
- **Known Issues (итог):**
  - #1 (jewel.json opt-table > 250 chars) — runtime split handles.
  - #2 (j05iep crit) — intentional.
  - #3 (APCA Lc<75 для small text — iter 111 accepted tradeoff).
  - #4 (UPDATED iter 117): 12 functional blocks БЕЗ правил сортировки → fallback к alphabetical. План iter 118+ в docs/AFFIX_ORDERING_PLAN.md §4.2 (приоритеты: skill-levels/area-duration/meta-skills/rage-charges/runes-barrier/penetration).
  - #5 (бывший regex-баг — closed iter 112).
- **Точка остановки:** iter 117 done. В iter 118 можно:
  1. **Добавить правила для priority-блоков** (см. docs/AFFIX_ORDERING_PLAN.md §4.2): `skill-levels` (10 family-keys), `area-duration` (8), `meta-skills` (6), `rage-charges` (4), `runes-barrier` (4), `penetration` (3). Канонические порядки пока не предложены — потребуется анализ данных.
  2. **Визуальная верификация пользователем** (перенос из iter 111) — UI в браузере: контрасты, читаемость 12px, affix ordering в resistances/attributes/minions/ailments + damage-type + defence-stats + resources + weapon-specific + flasks + **NEW iter 117: offence-speed + crit + buff-skills**.
  3. Опционально (iter 111 leftover): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
- **Подсказка следующему агенту:** iter 117 = offence-speed (12) + crit (9) + buff-skills (7) block rules, 100% coverage each. Перед стартом iter 118 прочитай STATUS.md (актуальный статус + Known Issues #4 — 12 блоков без правил), docs/AFFIX_ORDERING_PLAN.md (полный план, §4.2 — оставшиеся блоки без правил), worklog.md (этот раздел iter 117). Audit script: `python3 scripts/audit_block_sort_coverage.py` — показывает coverage правил для 12 активных блоков. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 116**: weapon-specific (24) + flasks (16) block rules, 100% coverage each. Canonical orders: 10 weapon buckets (Мечи→...→Без оружия), 4 flask buckets (Health→Mana→Any→Buffs). 1774/1774 tests.
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
