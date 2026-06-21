# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 112
Agent: main
Task: iter 112 — фикс regex-бага «Истощения Бездны» + внедрение систематической сортировки аффиксов внутри функциональных блоков.

Work Log:
- 1: Клон репо. Чтение STATUS.md (iter 111 — KI#3/#4/#5 закрыты), docs/UI_AUDIT.md, worklog.md (iter 111 подробно), docs/AFFIXES_GROUPING_ANALYSIS.md (архитектура grouping/sorting), src/shared/family-grouper.ts, src/shared/mod-classifier.ts (2324 строки — full classification + sort logic). Полное понимание задач iter 112.
- 2: Анализ бага «Истощения Бездны» (user-reported):
   - Token `jewel-desecrated.mod_3yl2ru` имеет `regex: "Бездны"` + `regexPrefixContext: "(10—20)%"`.
   - AST: `AND(LITERAL("(10—20)%"), LITERAL("Бездны"))` → normalizeAst (iter 108 merge) → `LITERAL("(10—20)%.*Бездны")` → compiled: `"(10—20)%.*Бездны"`.
   - В игре этот regex НЕ матчит ни один предмет, потому что реальные rolled-item-тексты содержат конкретные числа ("15%"), а не literal range template "(10—20)%".
   - Root cause: `tryAddContextForShortRegex()` в `scripts/etl/iterative-optimizer.ts` выбрал "(10—20)%" как context, потому что в jewel-desecrated.json этот literal уникален для mod_3yl2ru. Алгоритм не различает «реальное слово» и «range template».
- 3: Фикс бага (2 правки):
   - **Data patch:** `public/generated/jewel-desecrated.json` — удалил `regexPrefixContext` ключ у `mod_3yl2ru`. Regex `"Бездны"` работает один — он уникален в jewel-desecrated.json.
   - **ETL algorithm fix:** `scripts/etl/iterative-optimizer.ts` `tryAddContextForShortRegex()` — добавлен фильтр `hasMinLetters(s)`: кандидат в context должен содержать ≥3 кириллических/латинских букв. Range templates типа "(10—20)%" (0 букв) или "—" (0 букв) больше не выбираются. Фильтр применён и к single-word, и к 2-word candidate paths.
- 4: Регрессионные тесты (`tests/etl/cross-validation.test.ts`, +2 теста):
   - `no token has range-like regexPrefixContext` — сканирует все 10 JSON-файлов, проверяет что ни один token не имеет context с <3 букв.
   - `jewel-desecrated.mod_3yl2ru (Истощения Бездны) has no range context` — точечная проверка исправленного бага.
- 5: Анализ проблемы сортировки аффиксов внутри блоков (user-reported):
   - User: «аффиксы идут сгруппированно и систематизированно, едиными блоками внутри "категории"» — current alphabetical sort нарушает ментальную модель игрока.
   - Примеры: «Сопротивления» — нужен chaos→lightning→cold→fire; «Приспешники» — здоровье→урон идёт дважды (Companion+Minion перемешаны); «Состояния» — «увеличение силы» и «увеличение шанса» перемешаны.
   - Решение: добавить `sortKey` field в `FamilyGroup` + per-block ordering rules. `sortGroupsAlphabetically` использует sortKey как PRIMARY, familyKey как SECONDARY.
- 6: Реализация инфраструктуры:
   - `src/shared/types.ts`: добавлено опциональное поле `sortKey?: string` в `FamilyGroup`.
   - `src/shared/block-sort-rules.ts` (новый файл, 330 строк): `SortRule` interface + `BLOCK_SORT_RULES: Partial<Record<FunctionalBlock, SortRule[]>>` + `computeSortKey(block, familyKey)`. Format: `"<3-digit order>::<familyKey>"`. Defaults: 999 (no rules) / 900 (rules exist but no match).
   - `src/shared/family-grouper.ts`: импорт `computeSortKey`; `buildFamilyGroup()` вычисляет `group.sortKey = computeSortKey(members[0].functionalCategory, familyKey)`.
   - `src/shared/mod-classifier.ts`: `sortGroupsAlphabetically()` — PRIMARY sort по `sortKey.localeCompare('ru')` когда оба set, SECONDARY по familyKey, TIEBREAKER по tier. `sortGroupsByTierFirst()` НЕ использует sortKey (tier-first mode — сознательный выбор пользователя).
- 7: Правила для 4 functional блоков (105 family-keys, 100% coverage):
   - `resistances` (18 family-keys): chaos→lightning→cold→fire; dual-element; all-elements; max-resist (same element order); meta; passive-tree (jewel).
   - `attributes` (13): Сила→Ловкость→Интеллект→Все→dual→tri-or→% increase→requirement reduction.
   - `minions` (34): Subject (Companion 0-99 → Minion 100-199 → Offering 200-299) × Stat (Health → Damage → Crit → Speed → Area → Resists → Utility).
   - `ailments` (40): Operation (Увеличение силы 0-99 → Увеличение шанса 100-199 → Увеличение длительности 200-299 → Уменьшение длительности 300-399 → Шанс наложения 400-499 → Порог 500-599 → Скорость накопления 600-699 → Прочее 700-799) × State (Истощение Бездны → Истощение → Кровотечение → Отравление → Поджог → Шок → ...).
- 8: Morphology fixes (после первого аудита):
   - Russian падежи: «скорости накопления» (genitive) vs regex «скорость накопления» (nominative) — не матчилось. Fix: stem «скорост».
   - Word order: «критическому урону приспешников» vs regex «приспешников.*критическому урону». Fix: alternation `(приспешников.*X|X приспешников)`.
   - Разрез: family-key «Удары атаками с #% шансом могут наложить Разрез» vs regex «шанс наложения разрез». Fix: alternation `наложить разрез|шансом.*разрез`.
   - Passive-tree FIRST: family-key «Значимые пассивные умения...» заканчивается на «к сопротивлению X», что match single-element rule. Fix: переупорядочил rules — passive-tree идут ПЕРЕД single-element.
- 9: Тесты (`tests/shared/block-sort-rules.test.ts`, 57 тестов в 8 секциях):
   - computeSortKey базовые (999 для unknown, 900 для unmatched).
   - resistances: 18 case-tests + full canonical order test.
   - attributes: 13 case-tests + Сила→Ловкость→Интеллект order test.
   - minions: 5 relationship-tests + user-reported «каша» case test (4 chips: Companion health→damage, Minion health→damage).
   - ailments: 5 relationship-tests + bleed chain order test.
   - sortGroupsAlphabetically integration: 4 теста (both set, both missing, one set, ::origin variants).
   - End-to-end: 3 теста (resistances 4-chip, attributes 3-chip, minions 4-chip user-reported).
   - BLOCK_SORT_RULES structural integrity: 3 теста (case-insensitive, numeric order, iter 112 scope).
- 10: Audit script `scripts/audit_block_sort_coverage.py` — проверяет все 4 блока на 100% coverage family-keys. После morphology fixes: 0 uncovered.
- 11: Верификация — все три проверки зелёные:
   - `npx tsc -b` → **0 errors**
   - `npx vitest run` → **1602/1602 tests passed** (37 test files, +59 новых тестов vs iter 111 baseline 1543)
   - `npx eslint .` → **0 problems**
- 12: Документация:
   - `STATUS.md` — полный rewrite: iter 112 как текущее состояние. Regex-баг фикс + инфраструктура sortKey + 4 блока правил + таблица покрытия. Known Issues: #1-2 (старые), #3 (iter 111 accepted tradeoff), #4 (16 блоков без правил — план iter 113+), #5 (бывший regex-баг — closed iter 112).
   - `docs/AFFIX_ORDERING_PLAN.md` (новый файл) — полный план систематической сортировки: архитектура, принципы дизайна, текущее покрытие, канонические порядки для будущих итераций (damage-type, defence-stats, offence-speed, crit, resources, buff-skills), точка остановки.
   - `worklog.md` — iter 112 подробно, iter 111 сжат до одной строки.

Stage Summary:
- **iter 112 COMPLETE.** Regex-баг «Истощения Бездны» закрыт (data + ETL algorithm + regression tests). Инфраструктура систематической сортировки аффиксов внутри блоков внедрена (sortKey field + computeSortKey + 4 блока правил).
- **Изменённые файлы (8 в репозитории):**
  - `public/generated/jewel-desecrated.json` — iter 112 regex fix: удалён `regexPrefixContext` у `mod_3yl2ru`.
  - `scripts/etl/iterative-optimizer.ts` — iter 112 ETL fix: `tryAddContextForShortRegex` фильтрует range-like candidates (≥3 букв).
  - `src/shared/types.ts` — добавлено `FamilyGroup.sortKey?: string`.
  - `src/shared/family-grouper.ts` — `buildFamilyGroup` вычисляет sortKey.
  - `src/shared/mod-classifier.ts` — `sortGroupsAlphabetically` использует sortKey как PRIMARY.
  - `tests/etl/cross-validation.test.ts` — +2 regression tests для regex-бага.
  - `STATUS.md`, `docs/AFFIX_ORDERING_PLAN.md` (новый), `worklog.md` — обновлены.
- **Новые файлы (вне репозитория, в архиве):**
  - `src/shared/block-sort-rules.ts` (330 строк) — per-block ordering rules + computeSortKey.
  - `tests/shared/block-sort-rules.test.ts` (470 строк) — 57 unit + e2e тестов.
  - `scripts/audit_block_sort_coverage.py` — audit script для rule coverage.
- **Тесты/типы/lint:** ✅ tsc 0 errors, vitest 1602/1602 (+59 vs iter 111), eslint 0 problems.
- **Known Issues (итог):**
  - #1 (jewel.json opt-table > 250 chars) — runtime split handles.
  - #2 (j05iep crit) — intentional.
  - #3 (APCA Lc<75 для small text — iter 111 accepted tradeoff).
  - #4 (NEW iter 112): 16 functional blocks БЕЗ правил сортировки → fallback к alphabetical. План iter 113+ в docs/AFFIX_ORDERING_PLAN.md §4.2.
  - #5 (бывший regex-баг — closed iter 112).
- **Точка остановки:** iter 112 done. В iter 113 можно:
  1. **Добавить правила для priority-блоков** (см. docs/AFFIX_ORDERING_PLAN.md §4.2 + §5): `damage-type` (47), `defence-stats` (32), `resources` (33), `weapon-specific` (24), `flasks` (18).
  2. **Визуальная верификация пользователем** (перенос из iter 111) — UI в браузере: контрасты, читаемость 12px, новый affix ordering в resistances/attributes/minions/ailments.
  3. Опционально (iter 111 leftover): cleanup `--text-faint-val` alias / lift `--text-dim-val` до #8A92A2.
- **Подсказка следующему агенту:** iter 112 = regex-bug fix (Истощения Бездны) + sortKey infrastructure (4 блока правил). Перед стартом iter 113 прочитай STATUS.md (актуальный статус + Known Issues #4), docs/AFFIX_ORDERING_PLAN.md (полный план + канонические порядки для 16 оставшихся блоков), worklog.md (этот раздел). Audit script: `python3 scripts/audit_block_sort_coverage.py`. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись.

---

## Предыдущие итерации (кратко)

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
