# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 113
Agent: main
Task: iter 113 — расширение систематической сортировки аффиксов внутри блоков на `damage-type` (47 family-keys — самый видимый блок).

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 112 — sortKey infrastructure + 4 блока), docs/AFFIX_ORDERING_PLAN.md (полный план с каноническими порядками для 16 оставшихся блоков), worklog.md (iter 112 подробно), src/shared/block-sort-rules.ts (105 family-keys, 4 блока), scripts/audit_block_sort_coverage.py (audit script), tests/shared/block-sort-rules.test.ts (57 тестов). Полное понимание задачи iter 113.
- 2: Извлечение всех 47 family-keys для `damage-type` из 6 JSON-файлов (amulet/ring/belt/jewel/jewel-desecrated/jewel-corrupted) через helper Python-скрипт `scripts/extract_damage_type_keys.py`. Анализ морфологии и word-order variations для каждого family-key.
- 3: Проектирование canonical order для `damage-type` (10 buckets: физический → огонь → холод → молния → хаос → стихийный → generic/by-source → conditional → by-target → special). 47 family-keys распределены по buckets. Design principles:
   - Most-specific-first: conversion/added/saturation-conditional/thorns правила идут ПЕРЕД generic element rules (которые end-anchored через `$`).
   - `^#% увеличение урона$` — exact match для bare generic damage (не match conditional variants типа "#% увеличение урона будучи превращенным").
   - End-anchored `увеличение урона от X$` — match generic element increase, но НЕ match conditional variants ("...при полном энергетическом щите", "...если вы подобрали ...").
   - Stem "анем" для покрытия nominative/accusative ("Анемия"/"Анемию").
- 4: Реализация правил в `src/shared/block-sort-rules.ts`:
   - Добавлен `'damage-type': [...]` block (47 правил, ключ как string literal потому что содержит дефис).
   - Comment block с описанием canonical order + design notes.
   - 9 conversion/added/saturation/thorns правил ПЕРЕД generic element rules.
   - 6 generic element rules (end-anchored).
   - 2 elemental saturation mechanic rules.
   - 6 conditional rules ПЕРЕД by-source generic rules.
   - 14 generic + by-source rules.
   - 1 by-target rule.
   - 4 special mechanic rules.
- 5: Зеркалирование правил в `scripts/audit_block_sort_coverage.py` (Python regex, идентичные patterns). Обновление main() — добавить `'damage-type'` в список проверяемых блоков, заменить сообщение "All 4 blocks" → "All 5 blocks".
- 6: Первый запуск audit script — 1 uncovered family-key: "Накладывает Анемию при нанесении удара" (я использовал nominative "анемия", но family-key использует accusative "Анемию").
   - Fix: заменён pattern `/накладывает анемия/i` на `/накладывает анем/i` (stem "анем" покрывает все падежи). Зеркало в audit script.
- 7: Повторный запуск audit script — ✅ All 5 blocks fully covered (resistances 18, attributes 13, minions 34, ailments 40, damage-type 47 = 152 family-keys, 100% coverage).
- 8: Тесты (`tests/shared/block-sort-rules.test.ts`, +52 теста в новой SECTION 5b + 1 E2E в SECTION 7):
   - 47 case-tests для всех family-keys damage-type (по одному на каждое правило).
   - 4 relationship/canonical order tests: full element order (физ→огонь→холод→молния→хаос→стихийный), generic-vs-conditional, by-source-vs-conditional, conversion-vs-generic.
   - 1 E2E test в SECTION 7: 4 element damage mods order физический → огонь → холод → молния (через groupTokensByFamily → classifyGroups → sortGroupsAlphabetically).
   - Обновлён structural test в SECTION 8: "iter 113 scope: 5 blocks have rules" (изменён с 4 на 5).
   - Обновлён header комментарий файла: упоминание iter 113.
- 9: Промежуточная проверка — tsc поймал syntax error: `damage-type: [` парсится как `damage - type` (вычитание). Fix: ключ как string literal `'damage-type': [`. После fix — tsc 0 errors.
- 10: Верификация — все три проверки зелёные:
   - `npx tsc -b` → **0 errors**
   - `npx vitest run` → **1654/1654 tests passed** (37 test files, +52 новых теста vs iter 112 baseline 1602)
   - `npx eslint .` → **0 problems** (exit code 0)
- 11: Документация:
   - `STATUS.md` — полный rewrite: iter 113 как текущее состояние. damage-type canonical order + design notes + 5 блоков правил (152 family-keys, 100% coverage). Known Issues обновлены: #4 (15 блоков без правил — было 16, план iter 114+ с defence-stats/resources/weapon-specific/flasks как приоритеты).
   - `docs/AFFIX_ORDERING_PLAN.md` — обновлён: §4.1 (5 блоков с правилами), §4.2 (15 блоков без правил), §5.1 (damage-type — РЕАЛИЗОВАН с фактическим canonical order), §6 (тесты — 152 case-tests), §7 (ключевые файлы — 5 блоков), §8 (точка остановки iter 113 → iter 114).
   - `worklog.md` — iter 113 подробно, iter 112 сжат до одной строки в «Предыдущие итерации».

Stage Summary:
- **iter 113 COMPLETE.** damage-type block rules внедрены (47 family-keys, 100% coverage). Canonical order: физический → огонь → холод → молния → хаос → стихийный → generic/by-source → conditional → by-target → special.
- **Изменённые файлы (5 в репозитории):**
  - `src/shared/block-sort-rules.ts` — +75 строк: добавлен `'damage-type': [...]` block с 47 правилами + comment block.
  - `scripts/audit_block_sort_coverage.py` — +60 строк: добавлен `'damage-type'` block (зеркало TS правил) + `'damage-type'` в список проверяемых блоков + "All 5 blocks" в сообщение.
  - `tests/shared/block-sort-rules.test.ts` — +150 строк: SECTION 5b (47 case-tests + 4 relationship tests), 1 E2E test в SECTION 7, обновлён structural test в SECTION 8 (5 блоков).
  - `STATUS.md`, `docs/AFFIX_ORDERING_PLAN.md`, `worklog.md` — обновлены.
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1654/1654 (+52 vs iter 112 baseline 1602), eslint 0 problems.
- **Audit script:** ✅ 5/5 blocks fully covered (resistances 18 + attributes 13 + minions 34 + ailments 40 + damage-type 47 = 152 family-keys).
- **Known Issues (итог):**
  - #1 (jewel.json opt-table > 250 chars) — runtime split handles.
  - #2 (j05iep crit) — intentional.
  - #3 (APCA Lc<75 для small text — iter 111 accepted tradeoff).
  - #4 (UPDATED iter 113): 15 functional blocks БЕЗ правил сортировки → fallback к alphabetical. План iter 114+ в docs/AFFIX_ORDERING_PLAN.md §4.2 (приоритеты: defence-stats/resources/weapon-specific/flasks).
  - #5 (бывший regex-баг — closed iter 112).
- **Точка остановки:** iter 113 done. В iter 114 можно:
  1. **Добавить правила для priority-блоков** (см. docs/AFFIX_ORDERING_PLAN.md §4.2 + §5.2-§5.6): `defence-stats` (32), `resources` (33), `weapon-specific` (24), `flasks` (18).
  2. **Визуальная верификация пользователем** (перенос из iter 111) — UI в браузере: контрасты, читаемость 12px, новый affix ordering в resistances/attributes/minions/ailments + **NEW iter 113: damage-type**.
  3. Опционально (iter 111 leftover): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
- **Подсказка следующему агенту:** iter 113 = damage-type block rules (47 family-keys, 100% coverage). Перед стартом iter 114 прочитай STATUS.md (актуальный статус + Known Issues #4), docs/AFFIX_ORDERING_PLAN.md (полный план + канонические порядки для 15 оставшихся блоков), worklog.md (этот раздел iter 113). Audit script: `python3 scripts/audit_block_sort_coverage.py` — показывает coverage правил для 5 активных блоков. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

## Предыдущие итерации (кратко)

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
