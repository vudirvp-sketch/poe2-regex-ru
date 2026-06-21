# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 119
Agent: main
Task: iter 119 — расширение систематической сортировки аффиксов внутри блоков на 3 оставшихся priority-блока: `rage-charges` (4 family-keys), `runes-barrier` (4 family-keys), `penetration` (3 family-keys). Всего 11 family-keys. Это закрывает все priority-блоки — оставшиеся 6 блоков (`other`/`magic-find`/`breach`/`spirit`/`wisps`/`conversion`) не требуют правил (1 или 0 family-keys каждый, либо heterogeneous `other`).

Work Log:
- 1: Контекст загружен из STATUS.md (iter 118 = current state, 15 блоков правил, 301 family-keys, 100% coverage) + docs/AFFIX_ORDERING_PLAN.md (§4.2 — 3 priority-блока без правил: rage-charges/runes-barrier/penetration, всего 11 family-keys) + worklog.md (iter 118 section).
- 2: Извлечены все 11 family-keys для 3 target-блоков через Python-скрипт (использовался `public/generated/{amulet,ring,belt,jewel,jewel-desecrated,jewel-corrupted}.json`):
  - `rage-charges` (4): `+# к максимуму свирепости`, `Дарует # свирепости при нанесении удара в ближнем бою`, `Дарует # свирепости при получении удара от врага`, `#% повышение скорости накопления славы для умений знамён`.
  - `runes-barrier` (4): `+# к максимуму рунического барьера`, `#% увеличение максимума рунического барьера`, `#% повышение скорости регенерации рунического барьера`, `Восстанавливает # рунического барьера при использовании оберега`.
  - `penetration` (3): `Урон пробивает #% сопротивления молнии`, `Урон пробивает #% сопротивления холоду`, `Урон пробивает #% сопротивления огню`.
- 3: Спроектированы канонические порядки для каждого блока:
  - `rage-charges`: Cap FIRST (0) → Active gain (10) → Passive gain (11) → Glory gain speed (20). Cap sets ceiling without which gain is unbounded. Active (player-initiated) before passive (enemy-initiated) — more controllable. Glory (Слава) — different resource for banner skills, separated via order-20 bucket.
  - `runes-barrier`: Flat cap (0) → % cap (1) → Regen speed (10) → Conditional recovery (20). Mirrors `resources` block pattern: flat → % → regen → on-event.
  - `penetration`: Lightning (0) → Cold (1) → Fire (2). Element order mirrors `resistances` block (orders 1-3 there), без chaos (нет в данных). Renumbered 0-2.
- 4: Анализ substring conflicts:
  - `rage-charges`: `свирепости` в 3 family-keys — cap rule end-anchored `$` (matches `максимуму свирепости$`), gain rules match distinctive action phrase (`в ближнем бою` vs `получении удара`). `славы` в 1 family-key — no conflict.
  - `runes-barrier`: `максимуму рунического барьера` в 2 family-keys — flat rule end-anchored `$`, % rule matches distinctive phrase `увеличение максимума`. `оберега` — only in on-ward-use family-key.
  - `penetration`: no substring conflicts — `пробивает.*сопротивления <element>` is fully distinctive per family-key.
- 5: Реализация правил в `src/shared/block-sort-rules.ts`:
  - Добавлен `'rage-charges': [...]` block (4 правила, end-anchored cap rule + distinctive action phrases) с comment block перед ним.
  - Добавлен `'runes-barrier': [...]` block (4 правила, mirrors resources pattern) с comment block перед ним.
  - Добавлен `'penetration': [...]` block (3 правила, element order mirrors resistances) с comment block перед ним.
  - Обновлён header комментарий: упоминание iter 119.
- 6: Зеркалирование правил в `scripts/audit_block_sort_coverage.py` (Python regex, идентичные patterns). Обновление main() — добавить `'rage-charges'`, `'runes-barrier'`, `'penetration'` в список проверяемых блоков, заменить "All 15 blocks" → "All 18 blocks". Обновлён docstring.
- 7: Первый запуск audit script — ✅ All 18 blocks fully covered (312 family-keys total, 100% coverage). **Никаких uncovered family-keys** — все 11 новых правил сматчились корректно с первого раза.
- 8: Тесты (`tests/shared/block-sort-rules.test.ts`, +28 тестов в новых SECTION 5m + 5n + 5o + 3 E2E в SECTION 7 + 1 update structural в SECTION 8):
  - SECTION 5m (rage-charges): 4 case-tests для всех family-keys + 5 relationship tests (full bucket order Cap→Active→Passive→Glory, cap-before-active, active-before-passive, passive-before-glory, cap-end-anchored, distinctive-action-phrase).
  - SECTION 5n (runes-barrier): 4 case-tests для всех family-keys + 5 relationship tests (full bucket order Flat→%→Regen→Recovery, flat-before-%, %-before-regen, regen-before-recovery, flat-end-anchored).
  - SECTION 5o (penetration): 3 case-tests для всех family-keys + 4 relationship tests (full bucket order Lightning→Cold→Fire, lightning-before-cold, cold-before-fire).
  - 3 E2E tests в SECTION 7: rage-charges 4 buckets order, runes-barrier 4 buckets order, penetration 3 buckets order.
  - Обновлён structural test в SECTION 8: "iter 119 scope: 18 blocks have rules" (изменён с 15 на 18) + добавлены 'penetration', 'rage-charges', 'runes-barrier' в ожидаемый список.
- 9: Верификация — все четыре проверки зелёные:
  - `npx tsc --noEmit` → **0 errors**
  - `npx vitest run` → **1890/1890 tests passed** (37 test files, +28 новых тестов vs iter 118 baseline 1862)
  - `npx eslint src/shared/block-sort-rules.ts tests/shared/block-sort-rules.test.ts` → **0 errors**
  - `python3 scripts/audit_block_sort_coverage.py` → **18/18 blocks fully covered** (312 family-keys)
- 10: Документация:
  - `STATUS.md` — полный rewrite: iter 119 как текущее состояние. rage-charges + runes-barrier + penetration canonical orders + design notes + 18 блоков правил (312 family-keys, 100% coverage). Known Issues #4 updated: 6 блоков без правил (было 9 в iter 118 — 9 - 3 = 6). Добавлено "Все priority-блоки закрыты" в Known Issues #4.
  - `docs/AFFIX_ORDERING_PLAN.md` — обновлён: §4.1 (18 блоков с правилами, 312 family-keys), §4.2 (6 блоков без правил, обновлённые counts + статус "priority-блоки закрыты"), §5 header (все 14 sections реализованы), §5.12 (rage-charges — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана), §5.13 (runes-barrier — РЕАЛИЗОВАН), §5.14 (penetration — РЕАЛИЗОВАН), §6 (тесты — 312 case-tests, iter 119 scope = 18 блоков), §7 (ключевые файлы — 18 блоков), §8 (точка остановки iter 119 → iter 120 + корректировки плана).
  - `worklog.md` — iter 119 подробно, iter 118 сжат до одной строки в «Предыдущие итерации».

Stage Summary:
- **iter 119 COMPLETE.** rage-charges (4 family-keys, 100% coverage) + runes-barrier (4 family-keys, 100% coverage) + penetration (3 family-keys, 100% coverage) block rules внедрены. Total 18 блоков правил, 312 family-keys, 100% coverage. **Все priority-блоки закрыты.**
- **Изменённые файлы (5 в репозитории):**
  - `src/shared/block-sort-rules.ts` — +105 строк: добавлен `'rage-charges': [...]` block (4 правила + comment) + `'runes-barrier': [...]` block (4 правила + comment) + `'penetration': [...]` block (3 правила + comment) + обновлён header.
  - `scripts/audit_block_sort_coverage.py` — +30 строк: добавлены `'rage-charges'` + `'runes-barrier'` + `'penetration'` blocks (зеркало TS правил) + 3 блока в список проверяемых + "All 18 blocks" в сообщение + обновлён docstring.
  - `tests/shared/block-sort-rules.test.ts` — +186 строк: SECTION 5m (4 case-tests + 5 relationship tests для rage-charges), SECTION 5n (4 case-tests + 5 relationship tests для runes-barrier), SECTION 5o (3 case-tests + 4 relationship tests для penetration), 3 E2E tests в SECTION 7, обновлён structural test в SECTION 8 (18 блоков).
  - `STATUS.md`, `docs/AFFIX_ORDERING_PLAN.md`, `worklog.md` — обновлены.
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1890/1890 (+28 vs iter 118 baseline 1862), eslint 0 problems.
- **Audit script:** ✅ 18/18 blocks fully covered (resistances 18 + attributes 13 + minions 34 + ailments 40 + damage-type 47 + defence-stats 28 + resources 29 + weapon-specific 24 + flasks 16 + offence-speed 12 + crit 9 + buff-skills 7 + skill-levels 10 + area-duration 8 + meta-skills 6 + rage-charges 4 + runes-barrier 4 + penetration 3 = 312 family-keys).
- **Корректировки плана iter 119** (зафиксированы в docs/AFFIX_ORDERING_PLAN.md §5.12 + §5.13 + §5.14):
  - iter 119 — первый план канонических порядков для rage-charges / runes-barrier / penetration (раньше не предлагались).
  - `rage-charges`: 4 family-keys ✓. Cap FIRST. Active gain (player-initiated) before passive gain (enemy-initiated). Glory (Слава) gain speed LAST — different resource for banner skills.
  - `rage-charges`: `свирепости` в 3 family-keys — cap rule end-anchored, gain rules match distinctive action phrase.
  - `runes-barrier`: 4 family-keys ✓. Mirrors `resources` block pattern: flat → % → regen → on-event.
  - `runes-barrier`: `максимуму рунического барьера` в 2 family-keys — flat rule end-anchored, % rule matches distinctive phrase `увеличение максимума`.
  - `penetration`: 3 family-keys ✓. Element order mirrors `resistances` block (молния → холод → огонь), без chaos (нет в данных).
  - `penetration`: no substring conflicts — `пробивает.*сопротивления <element>` fully distinctive.
- **Known Issues (итог):**
  - #1 (jewel.json opt-table > 250 chars) — runtime split handles.
  - #2 (j05iep crit) — intentional.
  - #3 (APCA Lc<75 для small text — iter 111 accepted tradeoff).
  - #4 (UPDATED iter 119): 6 functional blocks БЕЗ правил сортировки → fallback к alphabetical. **Все priority-блоки закрыты.** Оставшиеся 6 блоков не требуют правил: 4 содержат 0-1 family-key (правила избыточны для одного элемента), `other` heterogeneous и отложен.
  - #5 (бывший regex-баг — closed iter 112).
- **Точка остановки:** iter 119 done. **Систематическая сортировка priority-блоков завершена.** В iter 120 можно:
  1. **Визуальная верификация пользователем** (перенос из iter 111) — UI в браузере: контрасты, читаемость 12px, affix ordering в 18 блоках (resistances/attributes/minions/ailments + damage-type + defence-stats + resources + weapon-specific + flasks + offence-speed + crit + buff-skills + skill-levels + area-duration + meta-skills + **NEW iter 119: rage-charges + runes-barrier + penetration**).
  2. Опционально (iter 111 leftover): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
  3. Опционально: систематизация `other` block (27 family-keys) — LOW priority, heterogeneous.
- **Подсказка следующему агенту:** iter 119 = rage-charges (4) + runes-barrier (4) + penetration (3) block rules, 100% coverage each. **Все priority-блоки закрыты.** Перед стартом iter 120 прочитай STATUS.md (актуальный статус + Known Issues #4 — 6 блоков без правил, все low-priority/empty), docs/AFFIX_ORDERING_PLAN.md (полный план, §4.2 — оставшиеся блоки без правил), worklog.md (этот раздел iter 119). Audit script: `python3 scripts/audit_block_sort_coverage.py` — показывает coverage правил для 18 активных блоков. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

- **iter 118**: skill-levels (10) + area-duration (8) + meta-skills (6) block rules, 100% coverage each. Canonical orders: Levels→Quality→Duration→Cooldown, Area→Radius→Duration, Energy→Archon→Sealed. 1862/1862 tests.
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
