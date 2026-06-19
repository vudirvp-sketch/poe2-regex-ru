# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 92
Agent: main
Task: Исправить баг jewel.mod_764thg ("сила умений аур") — классифицирован как area-duration вместо buff-skills. Корневая причина: multi-segment ModCalc tiers + i18n-override не пересчитывают functionalCategory. Применить principle "лучше недоделать, чем сломать".

Work Log:
- 1: Клон репо `https://github.com/vudirvp-sketch/poe2-regex-ru.git`. Установлены зависимости через `npm install -g pnpm@11.5.2 && pnpm install`. Прочитаны: `STATUS.md` (iter 91 state), `worklog.md`, `scripts/etl/classify-functional-category.ts`, `src/shared/mod-classifier.ts` (classifyFunctionalBlock), `scripts/run-etl.ts` (applyI18nOverrides).
- 2: Investigated `jewel.mod_764thg` ("сила умений аур", funcCat=area-duration). Token tags=["aura"], text="(3—7)% увеличение силы умений аур". ETL classifier on token's tags+text returns 'buff-skills' (matches BUFF_SKILLS_PATTERN "аур"). So token's funcCat was wrong.
- 3: Traced ETL flow: token has no modCode (no Mods/ link in Type A jewel row). ETL matches by normalized text lookup. The text "##% увеличение силы умений аур" was in normalizedTextToCategory with value 'area-duration' (WRONG).
- 4: Found root cause #1 — multi-segment tier misclassification:
  - ModCalc page Ruby/Emerald/Sapphire has tier "AbyssModJewelPrefixAuraSkillEffectPresenceAreaOfEffect" (desecrated) with 2 segments:
    - Segment 1: "(8—15)% увеличение области действия присутствия" → 'area-duration' (matches "област.*действ")
    - Segment 2: "(2—4)% увеличение силы умений аур" → 'buff-skills' (matches "аур")
  - Old code: classified first segment with tier.tags+text, then assigned FIRST segment's category to ALL segments in normalizedTextToCategory. So segment 2 got 'area-duration' (BUG).
  - Also: tier.tags is union of all segments' tags (e.g., SpellDamageEvasion tier has tags=[evasion,damage,caster] but segments are different domains). Using tier.tags for any single segment causes false positives on tag-based checks (e.g., DEFENCE_STATS for spell-damage segment via "evasion" tag).
- 5: Found root cause #2 — i18n-override stale functionalCategory:
  - `applyI18nOverrides()` in run-etl.ts patches rawText/rawTextTemplate to Russian after ETL classified English text. functionalCategory was NOT recomputed.
  - Affects: amulet/belt "Запечатанные умения" (was 'other', should be 'meta-skills'), flask-conditional mods (was 'damage-type'/'offence-speed', should be 'flasks').
- 6: Documented root causes in STATUS.md as Known Issues (per "Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксись").
- 7: Implemented Fix #1 in `scripts/etl/classify-functional-category.ts`:
  - Two-pass approach: collect all tiers from all pages, split into singleSegmentTiers and multiSegmentTiers.
  - Pass 2a: process single-segment tiers first with tier.tags+text (tier.tags is domain-specific for single-segment mods, safe to use). Sets modCodeToCategory AND normalizedTextToCategory.
  - Pass 2b: process multi-segment tiers with text-only classification per segment (skip tier.tags which is union of all segments). Skip modCodeToCategory (forces text lookup per segment). Don't overwrite single-segment entries (has() check).
  - Rationale: single-segment tier.tags is domain-specific (e.g., JewelCompanionDamage has tags=["damage","minion"] for a companion-damage mod); multi-segment tier.tags is the union (e.g., AbyssModJewelPrefixSpellDamageEvasion has tags=[evasion,damage,caster] but segments are different domains).
- 8: Implemented Fix #2 in `scripts/run-etl.ts` `applyI18nOverrides()`:
  - After patching rawText to Russian, recompute functionalCategory using `classifyModFunctionalBlock(token.tags, override.rawText)`.
  - Only reclassify jewel/jewellery tokens (waystone/tablet/relic don't use functionalCategory — guarded by `token.functionalCategory !== undefined`).
- 9: Ran `pnpm etl` — successfully regenerated all JSON files. 0 ETL errors.
- 10: Ran `npx tsx scripts/verify-iter91-discrepancies.ts` — **0 discrepancies** (was 11). All 11 iter 91 cross-validation issues resolved.
- 11: Verified specific tokens:
  - jewel.mod_764thg (aura strength): area-duration → buff-skills ✓
  - jewel.mod_ppjbmq (spell damage): defence-stats → damage-type ✓
  - jewel.mod_wditcf (warcry buff): damage-type → buff-skills ✓
  - jewel.mod_5rcjkz/hpfzjc/ss8pp2 (penetration): inconsistent → all 'resistances' ✓
  - jewel.mod_v23dqm (compagnon damage): damage-type → minions ✓ (single-segment tier.tags wins)
  - amulet.genesistreeadditionalmaximumseals_breachborn (Запечатанные): other → meta-skills ✓
  - amulet.spelldamageduringmanaflaskeffect1_breachborn (flask-conditional): damage-type → flasks ✓
  - belt.genesistreebeltsealgainfrequency_breachborn (Запечатанные): other → meta-skills ✓
- 12: Other-bucket metrics improved:
  - jewel: 8.3% (16/193) — unchanged
  - amulet: 7.6% (8/105) → 6.7% (7/105) ✓
  - ring: 3.2% (3/94) — unchanged
  - belt: 5.9% (5/85) → 4.7% (4/85) ✓
- 13: Ran `pnpm test` — **1363/1363 passing** (no regressions).
- 14: Ran `npx tsc -b` — 0 errors.
- 15: Ran `npx eslint scripts/etl/classify-functional-category.ts scripts/run-etl.ts` — 0 errors. (Pre-existing 15 errors in `verify-iter90-*.ts` and 2 warnings in `VirtualizedModList.tsx` are NOT touched by iter 92.)
- 16: Wrote `scripts/verify-iter92-fixes.ts` — verifies both token-level checks (10 specific bugs) and cross-validation (0 discrepancies across 477 family-groups). All checks pass.
- 17: Updated STATUS.md — iter 92 metrics, removed resolved Known Issues, added 2 new Known Issues (penetration block still open, AILMENTS/MINIONS patterns incomplete).
- 18: Updated worklog.md — iter 92 detailed section, iter 91 compressed to one line.

Stage Summary:
- **iter 92 COMPLETE.** 2 ETL root-cause fixes (multi-segment per-segment classification + i18n-override reclassification). All 11 iter 91 discrepancies resolved (466 → 477 match). Other-bucket improved: amulet 7.6%→6.7%, belt 5.9%→4.7%. jewel/ring unchanged.
- **Изменённые файлы (5):**
  - `scripts/etl/classify-functional-category.ts` — two-pass classify (single-segment first with tags, multi-segment text-only per segment, skip modCodeToCategory for multi-segment).
  - `scripts/run-etl.ts` — applyI18nOverrides() now reclassifies functionalCategory after rawText patch.
  - `scripts/verify-iter92-fixes.ts` — new verification script (token checks + cross-validation).
  - `public/generated/*.json` (10 files) — regenerated by ETL with corrected functionalCategory values.
  - `STATUS.md` + `worklog.md` — updated for iter 92.
- **Тесты:** 1363/1363 passing. Lint: 0 errors in changed files (15 pre-existing errors in untouched verify-iter90-*.ts). TSC: 0 errors.
- **Точка остановки:** iter 92 done. В iter 93+: (1) активировать `penetration` блок (3 family-keys в jewel сейчас в `resistances`); (2) расширить AILMENTS_PATTERN ("состояний") и MINIONS_PATTERN ("компаньон"); (3) убрать regex-паттерны из classifyFunctionalBlock() — оставить только Strategy 0 + 'other' fallback; (4) P1-P3: sortKey, waystone/tablet sub-blocks, relic-semantic mode.

---

Task ID: 93
Agent: main
Task: Активировать `penetration` блок (3 family-keys в jewel сейчас в `resistances`). Расширить AILMENTS_PATTERN ("состояний") и MINIONS_PATTERN ("компаньон"). Применить principle "лучше недоделать, чем сломать".

Work Log:
- 1: Клон репо. Установлены зависимости через `pnpm install`. Прочитаны: `STATUS.md` (iter 92 state), `worklog.md` (iter 92 detail), `scripts/etl/classify-functional-category.ts`, `src/shared/mod-classifier.ts` (classifyFunctionalBlock, FUNCTIONAL_BLOCK_ORDER, patterns).
- 2: Проверил baseline: `npx tsx scripts/verify-iter92-fixes.ts` → ✅ PASS (10 tokens + 0 cross-validation discrepancies). `pnpm test` → 1363/1363 passing. TSC: 0 errors.
- 3: Исследовал данные: 3 penetration-мода (jewel.mod_5rcjkz/hpfzjc/ss8pp2) — "Урон пробивает (5—10)% сопротивления <element>", tags `[damage, elemental, cold/fire/lightning]`, currently `resistances` (matched via RESISTANCES_PATTERN, no `resistance` tag). Companion-моды (jewel.mod_v23dqm/dstpng) — already `minions` via `minion` tag. Ailments-мод "накладываемых вами состояний" (jewel.mod_l1y0fl) — `damage-type` via `damage` tag (tag-priority wins before AILMENTS_PATTERN).
- 4: Implemented PENETRATION_PATTERN в `scripts/etl/classify-functional-category.ts`:
  - Pattern: `/пробива.*сопротивлен/i` — specifically catches "пробивает ... сопротивления" (NOT regular "к сопротивлению X" mods).
  - Placed BEFORE resistances check (step 9 in classifier, was step 9 = resistances).
  - Renumbered subsequent checks (10-22).
- 5: Implemented PENETRATION_PATTERN в `src/shared/mod-classifier.ts`:
  - Same pattern + placement (BEFORE resistances).
  - Updated priority-order comment block + per-step comments.
  - Updated FunctionalBlock type comment + FUNCTIONAL_BLOCK_ORDER comment (iter 93 note).
- 6: Expanded MINIONS_PATTERN в обоих файлах: `/(?:приспешник|подношен|компаньон)/i` (was `/(?:приспешник|подношен)/i`). Defensive — companion mods already classified via `minion` tag; pattern expansion future-proofs against no-tag companion mods.
- 7: Expanded AILMENTS_PATTERN в обоих файлах: added `накладыва.*состоян` alternative (catches «накладываемых вами состояний»). Defensive — current mod with this text has `damage` tag and stays in `damage-type` (tag-priority wins).
- 8: Ran `pnpm etl` — 0 ETL errors. All 10 JSON files regenerated. ETL metrics unchanged (FN=0, FP=9463, 2 opt-table entries > 250 chars).
- 9: Verified iter 93 results:
  - jewel.mod_5rcjkz: resistances → penetration ✓
  - jewel.mod_hpfzjc: resistances → penetration ✓
  - jewel.mod_ss8pp2: resistances → penetration ✓
  - jewel.mod_v23dqm/dstpng (companions): still minions ✓ (no regression)
  - jewel.mod_l1y0fl (накладываемых состояний): still damage-type ✓ (no regression — expected, tag-priority wins)
- 10: Updated `scripts/verify-iter92-fixes.ts`:
  - Changed 3 penetration token expectations from `resistances` to `penetration` (iter 93 supersedes iter 92 "consistency as resistances" goal).
  - Updated descriptions + main banner message ("iter 92 + iter 93 verification").
- 11: Ran `npx tsx scripts/verify-iter92-fixes.ts` — ✅ PASS (10 tokens + 0 cross-validation discrepancies).
- 12: Ran `pnpm test` — **1363/1363 passing** (no regressions).
- 13: Ran `npx tsc -b` — 0 errors. Ran `npx eslint` on 3 changed files — 0 errors.
- 14: Metrics confirmed unchanged:
  - jewel: 16 other (8.3%, unchanged), +3 penetration (NEW block)
  - amulet: 7 other (6.7%, unchanged)
  - ring: 3 other (3.2%, unchanged)
  - belt: 4 other (4.7%, unchanged)
- 15: Updated STATUS.md — iter 93 metrics table (with penetration column), iter 93 changelog, removed resolved Known Issue (penetration block now active), updated open debts.
- 16: Updated AGENT_NAVIGATION.md header — "Current state: iter 93".
- 17: Updated worklog.md — iter 93 detailed section, iter 92 compressed to one line.

Stage Summary:
- **iter 93 COMPLETE.** `penetration` block activated (3 family-keys moved resistances → penetration in jewel). AILMENTS_PATTERN и MINIONS_PATTERN расширены defensively (без смены классификации текущих модов). Cross-validation: 0 расхождений (477/477 match). Other-bucket метрики unchanged.
- **Изменённые файлы (4 source + 10 JSON + 3 docs):**
  - `scripts/etl/classify-functional-category.ts` — PENETRATION_PATTERN + reordered checks (penetration before resistances); MINIONS_PATTERN + AILMENTS_PATTERN expanded.
  - `src/shared/mod-classifier.ts` — PENETRATION_PATTERN + reordered checks; MINIONS_PATTERN + AILMENTS_PATTERN expanded; updated comments.
  - `scripts/verify-iter92-fixes.ts` — updated 3 penetration expectations to `penetration` (iter 93 supersedes iter 92 consistency goal).
  - `public/generated/*.json` (10 files) — regenerated by ETL with new functionalCategory for 3 jewel penetration tokens.
  - `STATUS.md` + `worklog.md` + `AGENT_NAVIGATION.md` — updated for iter 93.
- **Тесты:** 1363/1363 passing. TSC: 0 errors. ESLint: 0 errors в изменённых файлах.
- **Точка остановки:** iter 93 done. В iter 94+: (1) ailment tag-priority refactor — переместить AILMENTS_PATTERN перед DAMAGE_TYPE чтобы `ailment` tag выигрывал у `damage` tag (реклассифицирует jewel.mod_l1y0fl «накладываемых вами состояний» из damage-type в ailments); (2) убрать regex-паттерны из classifyFunctionalBlock() — оставить только Strategy 0 + 'other' fallback; (3) P1-P3: sortKey, waystone/tablet sub-blocks, relic-semantic mode, tier-aware сортировка, hideLabel auto-suppression.

---

## Предыдущие итерации (кратко)

- **iter 92**: 2 ETL root-cause fixes (multi-segment per-segment + i18n-override reclassify). 11 iter 91 discrepancies resolved (466 → 477 match). Other-bucket: amulet 7.6%→6.7%, belt 5.9%→4.7%. 1363/1363 tests.
- **iter 91**: ETL --fresh run, functionalCategory 100% в продакшене, 11 расхождений ETL vs regex документированы. 1363/1363 tests.
- **iter 89**: ailments + area-duration blocks (16th + 17th active). jewel other-bucket 21.8% → 14.0%. UX-фикс «Магический поиск» → «Рарити». 1340/1340 tests.
- **iter 87**: Weapon sub-blocks для jewel (6 weapon-class sub-blocks для 24 family-key) + production switch для jewel (`jewel-functional` mode). Other-bucket 21.8%. 1315/1315 tests.
- **iter 86**: +7 функциональных блоков (14 активны). Production switch для ring/amulet/belt. Other-bucket 9.9%. 1268/1268 tests.
- **iter 85**: Инфраструктура 24 функциональных блоков (7 активны). 1216/1216 tests.
- **iter 84**: 3 P0-фикса (Breach Lord skip + text fallback / waystone keywords / aura+gem tags). 1172/1172 tests.
- **iter 46-50**: `(?!…)` lookahead; `regexPrefixContext`; runtime split >250 chars.
