# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 115
Agent: main
Task: iter 115 — расширение систематической сортировки аффиксов внутри блоков на `resources` (29 family-keys — Health/Mana/ES pools + conversion, приоритетный блок).

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 114 — defence-stats 28 family-keys, 6 блоков правил, 180 family-keys), docs/AFFIX_ORDERING_PLAN.md (полный план + §5.5 предложение для resources: 33 family-keys с 6 buckets), worklog.md (iter 114 подробно), src/shared/block-sort-rules.ts (6 блоков, 180 family-keys), scripts/audit_block_sort_coverage.py (6 блоков), tests/shared/block-sort-rules.test.ts (1687 тестов). Полное понимание задачи iter 115.
- 2: Извлечение всех family-keys для 3 priority-блоков (resources/weapon-specific/flasks) через helper Python-скрипт `scripts/extract_priority_blocks.py`. **Важная находка: фактически counts отличаются от плана iter 112:**
  - `resources`: 29 family-keys (план говорил 33)
  - `weapon-specific`: 24 family-keys ✓ (совпадает)
  - `flasks`: 16 family-keys (план говорил 18)
  - Также проверены `buff-skills` (7 вместо 8), `magic-find` (1 вместо 2), `breach` (1 вместо 2).
  - Эти корректировки отражены в docs/AFFIX_ORDERING_PLAN.md §4.2.
- 3: Decision — выполнить **только `resources`** в iter 115 (iterative philosophy: «лучше недоделать, чем сломать — остальное в следующей итерации»). `weapon-specific` и `flasks` переносятся в iter 116.
- 4: Проектирование canonical order для `resources` (6 buckets: Здоровье → Мана → ES → Конверсия → Тотем → Прочее). 29 family-keys распределены по buckets. Design principles:
  - Health и Mana buckets параллельны по 8 stat-типов (flat max, % max, regen, leech, recovery, on-kill, per-kill). Мана имеет дополнительный cost-efficiency (порядок 18).
  - End-anchor `$` для flat max правил (`+# к максимуму здоровья$`) — предотвращает коллизию с conversion-правилом `Дарует #% максимума маны в виде брони`.
  - ES→threshold conversions (порядки 22, 23) используют `.*` bridge для длинных family-keys.
  - Per-kill и on-kill правила используют `.*` bridge для `#`/`#%` placeholder.
  - Fire-variant recovery (порядок 7) идёт ПОСЛЕ generic recovery (порядок 6) — generic более фундаментален.
  - ES→threshold conversions идут ПОСЛЕ bare ES max (порядки 20, 21) — pool stat перед conversion use.
  - Hexblast skill effect классифицирован в `resources` в данных; помещён в Other bucket (порядок 51).
  - Каждое правило матчит ровно один family-key — first-match-wins не критичен, но для readability more-specific правила listed first.
- 5: Реализация правил в `src/shared/block-sort-rules.ts`:
  - Добавлен `'resources': [...]` block (29 правил) с comment block перед ним.
  - Структура: ES→threshold conversions (2 правила) → Health bucket (10 правил) → Mana bucket (9 правил) → ES bucket (2 правила) → Conversion bucket (3 правила) → Totem bucket (1 правило) → Other bucket (2 правила).
  - Обновлён header комментарий: упоминание iter 115.
- 6: Зеркалирование правил в `scripts/audit_block_sort_coverage.py` (Python regex, идентичные patterns). Обновление main() — добавить `'resources'` в список проверяемых блоков, заменить "All 6 blocks" → "All 7 blocks". Обновлён docstring.
- 7: Первый запуск audit script — ✅ All 7 blocks fully covered (resistances 18 + attributes 13 + minions 34 + ailments 40 + damage-type 47 + defence-stats 28 + resources 29 = 209 family-keys, 100% coverage). **Никаких uncovered family-keys** — все 29 правил сматчились корректно с первого раза благодаря независимости patterns.
- 8: Тесты (`tests/shared/block-sort-rules.test.ts`, +34 теста в новой SECTION 5d + 1 E2E в SECTION 7 + 1 update в SECTION 8):
  - 29 case-tests для всех family-keys resources (по одному на каждое правило).
  - 4 relationship/canonical order tests: full bucket order (Здоровье→Мана→ES→Конверсия→Тотем→Прочее), Health-parallel-to-Mana (flat max health < flat max mana), generic-recovery-before-fire-variant, ES-bare-max-before-ES→threshold-conversions.
  - 1 E2E test в SECTION 7: 4 buckets order Здоровье → Мана → ES → Тотем (через groupTokensByFamily → classifyGroups → sortGroupsAlphabetically).
  - Обновлён structural test в SECTION 8: "iter 115 scope: 7 blocks have rules" (изменён с 6 на 7) + добавлен 'resources' в ожидаемый список.
  - Обновлён header комментарий файла: упоминание iter 115.
- 9: Верификация — все три проверки зелёные:
  - `npx tsc -b` → **0 errors**
  - `npx vitest run --no-file-parallelism` → **1721/1721 tests passed** (37 test files, +34 новых теста vs iter 114 baseline 1687)
  - `npx eslint .` → **0 problems** (exit code 0)
  - `python3 scripts/audit_block_sort_coverage.py` → **7/7 blocks fully covered** (209 family-keys)
- 10: Документация:
  - `STATUS.md` — полный rewrite: iter 115 как текущее состояние. resources canonical order + design notes + 7 блоков правил (209 family-keys, 100% coverage). Known Issues обновлены: #4 (13 блоков без правил — было 14, план iter 116+ с weapon-specific/flasks как приоритеты).
  - `docs/AFFIX_ORDERING_PLAN.md` — обновлён: §4.1 (7 блоков с правилами, 209 family-keys), §4.2 (13 блоков без правил, обновлённые counts + примечание про jewellery-only scope), §5.5 (resources — РЕАЛИЗОВАН с фактическим canonical order + корректировки плана), §5.6 (buff-skills — обновлён count 8→7), §5.7 (новый: weapon-specific canonical order для iter 116), §5.8 (новый: flasks canonical order для iter 116/117), §6 (тесты — 209 case-tests, iter 115 scope = 7 блоков), §7 (ключевые файлы — 7 блоков), §8 (точка остановки iter 115 → iter 116 + корректировки плана).
  - `AGENT_NAVIGATION.md` — header обновлён: iter 115 как текущее состояние.
  - `worklog.md` — iter 115 подробно, iter 114 сжат до одной строки в «Предыдущие итерации».

Stage Summary:
- **iter 115 COMPLETE.** resources block rules внедрены (29 family-keys, 100% coverage). Canonical order: Здоровье → Мана → ES → Конверсия → Тотем → Прочее (6 buckets).
- **Изменённые файлы (5 в репозитории):**
  - `src/shared/block-sort-rules.ts` — +85 строк: добавлен `'resources': [...]` block с 29 правилами + comment block.
  - `scripts/audit_block_sort_coverage.py` — +42 строк: добавлен `'resources'` block (зеркало TS правил) + `'resources'` в список проверяемых блоков + "All 7 blocks" в сообщение + обновлён docstring.
  - `tests/shared/block-sort-rules.test.ts` — +120 строк: SECTION 5d (29 case-tests + 4 relationship tests), 1 E2E test в SECTION 7, обновлён structural test в SECTION 8 (7 блоков).
  - `STATUS.md`, `docs/AFFIX_ORDERING_PLAN.md`, `AGENT_NAVIGATION.md`, `worklog.md` — обновлены.
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1721/1721 (+34 vs iter 114 baseline 1687), eslint 0 problems.
- **Audit script:** ✅ 7/7 blocks fully covered (resistances 18 + attributes 13 + minions 34 + ailments 40 + damage-type 47 + defence-stats 28 + resources 29 = 209 family-keys).
- **Корректировки плана iter 112** (зафиксированы в docs/AFFIX_ORDERING_PLAN.md §8):
  - `resources`: фактически 29 family-keys (план говорил 33).
  - `flasks`: фактически 16 (план говорил 18).
  - `buff-skills`: фактически 7 (план говорил 8).
  - `magic-find`: фактически 1 (план говорил 2).
  - `breach`: фактически 1 (план говорил 2).
- **Known Issues (итог):**
  - #1 (jewel.json opt-table > 250 chars) — runtime split handles.
  - #2 (j05iep crit) — intentional.
  - #3 (APCA Lc<75 для small text — iter 111 accepted tradeoff).
  - #4 (UPDATED iter 115): 13 functional blocks БЕЗ правил сортировки → fallback к alphabetical. План iter 116+ в docs/AFFIX_ORDERING_PLAN.md §4.2 (приоритеты: weapon-specific/flasks).
  - #5 (бывший regex-баг — closed iter 112).
- **Точка остановки:** iter 115 done. В iter 116 можно:
  1. **Добавить правила для priority-блоков** (см. docs/AFFIX_ORDERING_PLAN.md §4.2 + §5.7 + §5.8): `weapon-specific` (24, jewel-only), `flasks` (16, belt+jewel).
  2. **Визуальная верификация пользователем** (перенос из iter 111) — UI в браузере: контрасты, читаемость 12px, affix ordering в resistances/attributes/minions/ailments + damage-type + defence-stats + **NEW iter 115: resources**.
  3. Опционально (iter 111 leftover): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
- **Подсказка следующему агенту:** iter 115 = resources block rules (29 family-keys, 100% coverage). Перед стартом iter 116 прочитай STATUS.md (актуальный статус + Known Issues #4 — 13 блоков без правил), docs/AFFIX_ORDERING_PLAN.md (полный план + канонические порядки §5.7 weapon-specific + §5.8 flasks), worklog.md (этот раздел iter 115). Audit script: `python3 scripts/audit_block_sort_coverage.py` — показывает coverage правил для 7 активных блоков. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий.

---

## Предыдущие итерации (кратко)

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
