# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 94
Agent: main
Task: Ailment tag-priority refactor — переместить AILMENTS_PATTERN проверку ПЕРЕД DAMAGE_TYPE в classifyFunctionalBlock(), чтобы ailment tag выигрывал у damage tag. Применить principle "лучше недоделать, чем сломать".

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Установлены зависимости через `pnpm install`. Прочитаны: `STATUS.md` (iter 93 state), `worklog.md` (iter 93 detail), `scripts/etl/classify-functional-category.ts`, `src/shared/mod-classifier.ts` (classifyFunctionalBlock, FUNCTIONAL_BLOCK_ORDER, patterns), `scripts/simulate-iter89-impact.ts` (template for iter 94 simulation).
- 2: Проверил baseline: `npx tsx scripts/verify-iter92-fixes.ts` → ✅ PASS (10 tokens + 0 cross-validation discrepancies). `pnpm test` → 1363/1363 passing. TSC: 0 errors.
- 3: Исследовал target-моды в jewel.json:
  - jewel.mod_l1y0fl: «(5—15)% увеличение силы накладываемых вами состояний», tags=[damage, ailment], funcCat=damage-type (damage tag wins at step 15, AILMENTS at step 17 misses)
  - jewel.mod_j05iep: «(10—20)% увеличение силы наносящих урон состояний, накладываемых вашими критическими ударами», tags=[damage, critical, ailment], funcCat=crit (critical tag wins at step 14)
  - jewel.mod_40sol4: «Наносящие урон состояния наносят урон на (3—7)% быстрее», tags=[damage, ailment], funcCat=damage-type (damage tag wins at step 15; text does NOT match AILMENTS_PATTERN)
- 4: Спроектировал refactor:
  - MOVED: AILMENTS_PATTERN check с шага 17 (после OFFENCE_SPEED) на шаг 15 (после CRIT, перед DAMAGE_TYPE)
  - ADDED: `ailment` tag check на шаге 15: `if (allTags.has('ailment') || AILMENTS_PATTERN.test(text)) return 'ailments';`
  - Ожидаемые результаты:
    - jewel.mod_l1y0fl → ailments (matches both `ailment` tag AND AILMENTS_PATTERN text `накладыва.*состоян`)
    - jewel.mod_40sol4 → ailments (matches `ailment` tag only — text doesn't match)
    - jewel.mod_j05iep → stays crit (CRIT шаг 14 выигрывает у AILMENTS шаг 15)
- 5: Создал `scripts/simulate-iter94-impact.ts` (mirror simulate-iter89-impact.ts):
  - Определил classifyFunctionalBlock_iter93 (current production) и classifyFunctionalBlock_iter94 (proposed refactor).
  - Для каждого family-group в jewel/amulet/ring/belt: сравнил before/after.
  - Дополнительно: собрал все ailment-tagged + ailment-pattern-matching группы (41 total) для FP-проверки.
  - Логика FP-проверки: ailment-группа должна классифицироваться в `ailments` ИЛИ в higher-priority bucket (crit/weapon-specific/resources/defence-stats/minions/...). Если в `damage-type` или `other` — REAL FP.
- 6: Ran simulation → ✅ 0 FPs:
  - 26 reclassifications: ALL `damage-type → ailments` (jewel: 21, amulet: 1, ring: 1, belt: 3)
  - 4 ailment-tagged groups stayed in higher-priority buckets (expected):
    - jewel.mod_j05iep → crit (critical tag wins)
    - jewel.mod_nuzdb5 → weapon-specific (weapon name wins)
    - jewel.mod_cgpq5s → resources (ES max wins)
    - jewel.mod_knitv6 → defence-stats (stun threshold wins)
  - 37 ailment groups → ailments (correct), 4 → higher-priority (correct), 0 → unexpected (REAL FP)
- 7: Implemented refactor в `scripts/etl/classify-functional-category.ts`:
  - AILMENTS_PATTERN check moved с шага 17 на шаг 15 (после CRIT, перед DAMAGE_TYPE).
  - Добавлен `ailment` tag check: `if (functionalTags.has('ailment') || AILMENTS_PATTERN.test(rawText)) return 'ailments';`
  - Renumbered comments (CRIT=14, AILMENTS=15, DAMAGE_TYPE=16, OFFENCE_SPEED=17, AREA_DURATION=18, RAGE_CHARGES=19, META_SKILLS=20, BUFF_SKILLS=21, OTHER=22).
  - Updated inline comments с iter 94 rationale + simulation reference.
- 8: Implemented refactor в `src/shared/mod-classifier.ts`:
  - Same changes (mirror ETL classifier).
  - Updated AILMENTS_PATTERN docstring (position section) — описан iter 88-94 history.
  - Updated classifyFunctionalBlock() docstring (match priority + tag priority logic) — добавлены iter 94 notes (critical tag beats ailment tag; ailment tag beats damage tag).
- 9: Ran `pnpm etl` — 0 ETL errors. All 10 JSON files regenerated. ETL metrics unchanged (FN=0, FP=9463, 2 opt-table entries > 250 chars).
- 10: Verified iter 94 target tokens в JSON:
  - jewel.mod_l1y0fl: damage-type → ailments ✓
  - jewel.mod_40sol4: damage-type → ailments ✓
  - jewel.mod_j05iep: stays crit ✓ (no regression — critical tag wins)
- 11: Создал `scripts/verify-iter94-fixes.ts`:
  - 3 token-level checks (l1y0fl/40sol4 → ailments, j05iep → crit)
  - Cross-validation across 477 family-groups (0 discrepancies expected)
  - Ran → ✅ PASS (3 tokens + 0 cross-validation discrepancies).
- 12: Ran `npx tsx scripts/verify-iter92-fixes.ts` — ✅ PASS (iter 92+93 verification still green, no regressions).
- 13: Ran `pnpm test` — **1363/1363 passing** (no regressions).
- 14: Ran `npx tsc -b` — 0 errors.
- 15: Ran `npx eslint` on 4 changed files — 1 error initially (`ok` unused in simulate-iter94-impact.ts). Fixed by removing unused variable. Re-ran → 0 errors.
- 16: Metrics iter 94 (vs iter 93):
  - jewel: 193 groups, other=16 (8.3%, unchanged), ailments 8→29, damage-type 45→24
  - amulet: 105 groups, other=7 (6.7%, unchanged), ailments 0→1, damage-type 7→6
  - ring: 94 groups, other=3 (3.2%, unchanged), ailments 3→4, damage-type 19→18
  - belt: 85 groups, other=4 (4.7%, unchanged), ailments 0→3, damage-type 10→7
  - other-bucket без изменений (refactor перемещает моды между damage-type и ailments, не влияет на other).
- 17: Updated STATUS.md — iter 94 metrics table (with ailments/damage-type before/after columns), iter 94 changelog, updated Known Issues (j05iep stays crit now documented as intentional).
- 18: Updated AGENT_NAVIGATION.md header — "Current state: iter 94".
- 19: Updated worklog.md — iter 94 detailed section, iter 93 compressed to one line.

Stage Summary:
- **iter 94 COMPLETE.** AILMENTS tag-priority refactor: AILMENTS_PATTERN moved BEFORE DAMAGE_TYPE + added `ailment` tag check. 26 модов реклассифицированы `damage-type → ailments` (jewel: 21, amulet: 1, ring: 1, belt: 3). 4 ailment-tagged группы остались в higher-priority buckets (expected). Cross-validation: 0 расхождений (477/477 match). Other-bucket метрики unchanged.
- **Изменённые файлы (4 source + 10 JSON + 3 docs):**
  - `scripts/etl/classify-functional-category.ts` — AILMENTS moved BEFORE DAMAGE_TYPE + `ailment` tag check; renumbered comments.
  - `src/shared/mod-classifier.ts` — same mirror changes; updated AILMENTS_PATTERN docstring + classifyFunctionalBlock() docstring (match priority + tag priority logic).
  - `scripts/simulate-iter94-impact.ts` — new simulation script (iter93 vs iter94 classifier, FP-check на ailment-tagged groups).
  - `scripts/verify-iter94-fixes.ts` — new verification script (3 target tokens + cross-validation).
  - `public/generated/*.json` (10 files) — regenerated by ETL with new functionalCategory for 26 mods (damage-type → ailments).
  - `STATUS.md` + `worklog.md` + `AGENT_NAVIGATION.md` — updated for iter 94.
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors в изменённых файлах.
- **Точка остановки:** iter 94 done. В iter 95+: (1) убрать regex-паттерны из classifyFunctionalBlock() — оставить только Strategy 0 + 'other' fallback (regex больше не нужен для продакшена, но полезен для отладки); (2) P1-P3: sortKey, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression.

---

## Предыдущие итерации (кратко)

- **iter 93**: penetration block activated (3 family-keys moved resistances → penetration). AILMENTS/MINIONS patterns expanded defensively. 1363/1363 tests.
- **iter 92**: 2 ETL root-cause fixes (multi-segment per-segment + i18n-override reclassify). 11 iter 91 discrepancies resolved (466 → 477 match). Other-bucket: amulet 7.6%→6.7%, belt 5.9%→4.7%. 1363/1363 tests.
- **iter 91**: ETL --fresh run, functionalCategory 100% в продакшене, 11 расхождений ETL vs regex документированы. 1363/1363 tests.
- **iter 89**: ailments + area-duration blocks (16th + 17th active). jewel other-bucket 21.8% → 14.0%. UX-фикс «Магический поиск» → «Рарити». 1340/1340 tests.
- **iter 87**: Weapon sub-blocks для jewel (6 weapon-class sub-blocks для 24 family-key) + production switch для jewel (`jewel-functional` mode). Other-bucket 21.8%. 1315/1315 tests.
- **iter 86**: +7 функциональных блоков (14 активны). Production switch для ring/amulet/belt. Other-bucket 9.9%. 1268/1268 tests.
- **iter 85**: Инфраструктура 24 функциональных блоков (7 активны). 1216/1216 tests.
- **iter 84**: 3 P0-фикса (Breach Lord skip + text fallback / waystone keywords / aura+gem tags). 1172/1172 tests.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
