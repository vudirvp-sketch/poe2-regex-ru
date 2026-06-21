# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 118
Agent: main
Task: iter 118 — расширение систематической сортировки аффиксов внутри блоков на 3 priority-блока: `skill-levels` (10 family-keys), `area-duration` (8 family-keys), `meta-skills` (6 family-keys).

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 117 — 12 блоков правил, 277 family-keys, 100% coverage), docs/AFFIX_ORDERING_PLAN.md (полный план + §4.2 — 12 блоков без правил, приоритеты iter 118+), worklog.md (iter 117 подробно), src/shared/block-sort-rules.ts (12 блоков, ~916 строк), scripts/audit_block_sort_coverage.py (12 блоков, ~459 строк), tests/shared/block-sort-rules.test.ts (1820 тестов, 1375 строк). Полное понимание задачи iter 118.
- 2: Извлечение фактических family-keys через helper Python-скрипт `/home/z/my-project/scripts/list_uncovered_blocks.py` (jewellery-scope) + `/home/z/my-project/scripts/verify_family_keys.py` (full-scope). **Подтверждены counts и точный текст family-keys:**
  - `skill-levels`: 10 family-keys ✓
  - `area-duration`: 8 family-keys ✓
  - `meta-skills`: 6 family-keys ✓
  - `rage-charges`: 4 family-keys (отложено на iter 119)
  - `runes-barrier`: 4 family-keys (отложено на iter 119)
  - `penetration`: 3 family-keys (отложено на iter 119)
- 3: Decision — выполнить **только топ-3 priority-блока в iter 118** согласно итеративной философии «лучше недоделать, чем сломать». Объём manageable (24 family-keys total, ~90 строк правил) — сопоставимо с iter 117 (28 family-keys). Остальные 3 блока (11 family-keys) — iter 119.
- 4: Проектирование canonical order для `skill-levels`:
  - Player mental model: Levels FIRST (most-impactful), затем Quality, Duration, Cooldown LAST.
  - Within levels: all-skills FIRST (most universal), then specific subsets (spells → melee → minion → projectile).
  - Two substring conflicts handled via first-match-wins (most-specific FIRST):
    1. `увеличение длительности эффекта умения` — в generic duration И в mark-skill duration → mark rule (с `умения меток имеют.*` prefix) listed FIRST.
    2. `уровню всех камней умений` — в 5 family-keys → generic all-skills rule end-anchored `$`, specific subset rules match their own distinctive phrase.
  - `качеству` в both quality % AND max-quality % — full phrases distinct, no real conflict.
- 5: Проектирование canonical order для `area-duration`:
  - Area FIRST (more universal — affects many skills).
  - Within area: generic FIRST (most universal), then specific subsets (spells → curses → banners → presence).
  - Radius improvement as special mod (order 20) between area-% and duration.
  - Duration SECOND (less universal — only curse/banner duration in data).
  - `увеличение области действия` в 5 family-keys — generic rule end-anchored `$`.
  - `проклятий` и `умений знамён` в BOTH area AND duration variants — no conflict, leading phrase differs (`области действия` vs `длительности`).
- 6: Проектирование canonical order для `meta-skills`:
  - Energy FIRST (most universal — powers all meta-skills).
  - Archon SECOND (buff effect before duration, same pattern as buff-skills).
  - Sealed skills THIRD (max charges before frequency — cap is more fundamental than gain speed).
  - 3 substring conflicts (`энергии`, `Архонта`, `зарядов печати`) — все resolved via distinctive phrases (no first-match-wins needed actually).
- 7: Реализация правил в `src/shared/block-sort-rules.ts`:
  - Добавлен `'skill-levels': [...]` block (10 правил, включая 1 most-specific-FIRST для mark-duration) с comment block перед ним.
  - Добавлен `'area-duration': [...]` block (8 правил, generic end-anchored) с comment block перед ним.
  - Добавлен `'meta-skills': [...]` block (6 правил, по energy/archon/sealed) с comment block перед ним.
  - Обновлён header комментарий: упоминание iter 118.
- 8: Зеркалирование правил в `scripts/audit_block_sort_coverage.py` (Python regex, идентичные patterns). Обновление main() — добавить `'skill-levels'`, `'area-duration'`, `'meta-skills'` в список проверяемых блоков, заменить "All 12 blocks" → "All 15 blocks". Обновлён docstring.
- 9: Первый запуск audit script — ✅ All 15 blocks fully covered (301 family-keys total, 100% coverage). **Никаких uncovered family-keys** — все 24 новых правил сматчились корректно с первого раза благодаря morphology-aware patterns и правильному anchoring.
- 10: Тесты (`tests/shared/block-sort-rules.test.ts`, +42 тестов в новых SECTION 5j + 5k + 5l + 3 E2E в SECTION 7 + 1 update structural в SECTION 8):
  - SECTION 5j (skill-levels): 10 case-tests для всех family-keys + 5 relationship tests (full bucket order Levels→Quality→Duration→Cooldown, all-skills-before-spell-skills, mark-first-match-wins, all-skills-end-anchored, quality-vs-max-quality).
  - SECTION 5k (area-duration): 8 case-tests для всех family-keys + 4 relationship tests (full bucket order Area→Radius→Duration, generic-end-anchored, area-curse-vs-duration-curse, area-banner-vs-duration-banner).
  - SECTION 5l (meta-skills): 6 case-tests для всех family-keys + 6 relationship tests (full bucket order Energy→Archon→Sealed, energy-amount-before-max, archon-effect-before-duration, sealed-max-before-frequency, distinctive-phrase энергии, distinctive-phrase Архонта).
  - 3 E2E tests в SECTION 7: skill-levels 3 stat types order, area-duration 3 buckets order, meta-skills 3 buckets order.
  - Обновлён structural test в SECTION 8: "iter 118 scope: 15 blocks have rules" (изменён с 12 на 15) + добавлены 'area-duration', 'meta-skills', 'skill-levels' в ожидаемый список.
  - Обновлён header комментарий файла: упоминание iter 118.
- 11: Верификация — все четыре проверки зелёные:
  - `pnpm exec tsc --noEmit` → **0 errors**
  - `pnpm exec vitest run` → **1862/1862 tests passed** (37 test files, +42 новых тестов vs iter 117 baseline 1820)
  - `pnpm exec eslint src/shared/block-sort-rules.ts tests/shared/block-sort-rules.test.ts` → **0 errors**
  - `python3 scripts/audit_block_sort_coverage.py` → **15/15 blocks fully covered** (301 family-keys)
- 12: Документация:
  - `STATUS.md` — полный rewrite: iter 118 как текущее состояние. skill-levels + area-duration + meta-skills canonical orders + design notes + 15 блоков правил (301 family-keys, 100% coverage). Known Issues #4 updated: 9 блоков без правил (было 12 в iter 117 — 12 - 3 = 9).
  - `docs/AFFIX_ORDERING_PLAN.md` — обновлён: §4.1 (15 блоков с правилами, 301 family-keys), §4.2 (9 блоков без правил, обновлённые counts + iter 119+ priorities), §5 header (все 11 sections реализованы), §5.9 (skill-levels — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана), §5.10 (area-duration — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана), §5.11 (meta-skills — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана), §6 (тесты — 301 case-tests, iter 118 scope = 15 блоков), §7 (ключевые файлы — 15 блоков), §8 (точка остановки iter 118 → iter 119 + корректировки плана).
  - `worklog.md` — iter 118 подробно, iter 117 сжат до одной строки в «Предыдущие итерации».

Stage Summary:
- **iter 118 COMPLETE.** skill-levels (10 family-keys, 100% coverage) + area-duration (8 family-keys, 100% coverage) + meta-skills (6 family-keys, 100% coverage) block rules внедрены. Total 15 блоков правил, 301 family-keys, 100% coverage.
- **Изменённые файлы (5 в репозитории):**
  - `src/shared/block-sort-rules.ts` — +158 строк: добавлен `'skill-levels': [...]` block (10 правил + comment) + `'area-duration': [...]` block (8 правил + comment) + `'meta-skills': [...]` block (6 правил + comment) + обновлён header.
  - `scripts/audit_block_sort_coverage.py` — +42 строк: добавлены `'skill-levels'` + `'area-duration'` + `'meta-skills'` blocks (зеркало TS правил) + 3 блока в список проверяемых + "All 15 blocks" в сообщение + обновлён docstring.
  - `tests/shared/block-sort-rules.test.ts` — +242 строк: SECTION 5j (10 case-tests + 5 relationship tests для skill-levels), SECTION 5k (8 case-tests + 4 relationship tests для area-duration), SECTION 5l (6 case-tests + 6 relationship tests для meta-skills), 3 E2E tests в SECTION 7, обновлён structural test в SECTION 8 (15 блоков).
  - `STATUS.md`, `docs/AFFIX_ORDERING_PLAN.md`, `worklog.md` — обновлены.
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1862/1862 (+42 vs iter 117 baseline 1820), eslint 0 problems.
- **Audit script:** ✅ 15/15 blocks fully covered (resistances 18 + attributes 13 + minions 34 + ailments 40 + damage-type 47 + defence-stats 28 + resources 29 + weapon-specific 24 + flasks 16 + offence-speed 12 + crit 9 + buff-skills 7 + skill-levels 10 + area-duration 8 + meta-skills 6 = 301 family-keys).
- **Корректировки плана iter 118** (зафиксированы в docs/AFFIX_ORDERING_PLAN.md §5.9 + §5.10 + §5.11):
  - iter 118 — первый план канонических порядков для skill-levels / area-duration / meta-skills (раньше не предлагались).
  - `skill-levels`: 10 family-keys ✓. Levels FIRST (most-impactful). Cooldown LAST (timing-related).
  - `skill-levels`: 2 substring conflicts handled via first-match-wins (mark duration + all-skills level).
  - `area-duration`: 8 family-keys ✓. Area FIRST. Radius improvement as special bucket (order 20).
  - `area-duration`: `проклятий` и `умений знамён` в BOTH area AND duration variants — no conflict, leading phrase differs.
  - `meta-skills`: 6 family-keys ✓. Energy FIRST. Archon before Sealed skills.
  - `meta-skills`: 3 substring conflicts (`энергии`, `Архонта`, `зарядов печати`) — все resolved via distinctive phrases.
- **Known Issues (итог):**
  - #1 (jewel.json opt-table > 250 chars) — runtime split handles.
  - #2 (j05iep crit) — intentional.
  - #3 (APCA Lc<75 для small text — iter 111 accepted tradeoff).
  - #4 (UPDATED iter 118): 9 functional blocks БЕЗ правил сортировки → fallback к alphabetical. План iter 119+ в docs/AFFIX_ORDERING_PLAN.md §4.2 (приоритеты: rage-charges/runes-barrier/penetration — всего 11 family-keys, manageable для одного захода).
  - #5 (бывший regex-баг — closed iter 112).
- **Точка остановки:** iter 118 done. В iter 119 можно:
  1. **Добавить правила для оставшихся 3 priority-блоков** (см. docs/AFFIX_ORDERING_PLAN.md §4.2): `rage-charges` (4 family-keys), `runes-barrier` (4), `penetration` (3). Всего 11 family-keys — небольшой объём, iter 119 может закрыть одним заходом. Канонические порядки пока не предложены — потребуется анализ данных.
  2. **Визуальная верификация пользователем** (перенос из iter 111) — UI в браузере: контрасты, читаемость 12px, affix ordering в resistances/attributes/minions/ailments + damage-type + defence-stats + resources + weapon-specific + flasks + offence-speed + crit + buff-skills + **NEW iter 118: skill-levels + area-duration + meta-skills**.
  3. Опционально (iter 111 leftover): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
- **Подсказка следующему агенту:** iter 118 = skill-levels (10) + area-duration (8) + meta-skills (6) block rules, 100% coverage each. Перед стартом iter 119 прочитай STATUS.md (актуальный статус + Known Issues #4 — 9 блоков без правил), docs/AFFIX_ORDERING_PLAN.md (полный план, §4.2 — оставшиеся блоки без правил), worklog.md (этот раздел iter 118). Audit script: `python3 scripts/audit_block_sort_coverage.py` — показывает coverage правил для 15 активных блоков. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 117**: offence-speed (12) + crit (9) + buff-skills (7) block rules, 100% coverage each. Canonical orders: 12 speed buckets (attack→...→skill), 9 crit buckets (chance%→...→ailment), 7 buff-skill buckets (Ауры→...→Метки). 1820/1820 tests.
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
