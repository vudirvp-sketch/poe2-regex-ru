# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 49 — 2026-06-07)

**Build:** `npx tsc --noEmit` passes, `npx vitest run --root .` passes (471/471 tests)
**Oracle:** ETL not re-run yet (needs network). Expected: ~39 cross-family FP (down from 62 after regexPrefixContext fixes).

**Key Changes This Session (Phase 9 — AND-composed regex via regexPrefixContext):**

1. **`regexPrefixContext` field on GameToken** — New optional field `regexPrefixContext?: Record<Locale, string>` stores a short substring from the template prefix that appears in ALL target-family tokens but NOT in any conflict tokens. UI compiles `AND(LITERAL(context), LITERAL(regex))` → `"context" "suffix"`. Both must appear on the item (AND across blocks), eliminating FP.

2. **`RegexResult.regexPrefixContext`** — Added to the compute-regex.ts result type. Currently always empty string (computed in post-ETL repair step, not during initial regex computation).

3. **`repairCrossFamilyFP()` Step 3** — After suffix lengthening (Step 1) and exclude patterns (Step 2), a new Step 3 tries to find a `regexPrefixContext` for tokens with uncovered FP. Algorithm:
   - Collect all same-family rawTexts
   - Try words from template prefix (right to left, shortest first)
   - Check: word appears in ALL family texts but NOT in any uncovered conflict
   - Try 2-word combinations if single words fail
   - Brute-force common substring as last resort
   - If context covers all conflicts, clear excludes (context alone is sufficient)

4. **UI compilation in `useCategoryPage.ts`** — Three code paths updated:
   - Non-ranged tokens: `AND(LITERAL(context), LITERAL(regex))` before exclude wrapping
   - Ranged tokens with min/max: `AND(LITERAL(context), RANGE(...))` before exclude wrapping
   - Ranged tokens without min/max: same as non-ranged tokens

5. **`generate-dictionary.ts`** — Writes `regexPrefixContext` to JSON only if non-empty (save space).

**Expected FP reduction:**
- Ring minion damage (8 FP): regexPrefixContext="имеют" → `"имеют" "увеличение урона"` (fixes FP from fire/cold/lightning/chaos damage)
- Ring minion elemental res (4 FP): regexPrefixContext="имеют" → `"имеют" "стихия"` (fixes FP from non-minion "к сопротивлению всем стихиям")
- Jewel-desecrated composites (15 FP): regexPrefixContext="Приспеш" → `"Приспеш" "увеличение урона"` (fixes FP from non-minion composites)
- Total expected: −23 to −27 cross-family FP

**Files changed this session:**
- `src/shared/types.ts` — Added `regexPrefixContext` field
- `scripts/etl/compute-regex.ts` — Added `regexPrefixContext` to RegexResult + all returns
- `scripts/etl/generate-dictionary.ts` — Write regexPrefixContext to JSON
- `scripts/run-etl.ts` — Step 3 in repairCrossFamilyFP()
- `src/ui/hooks/useCategoryPage.ts` — AND(LITERAL(context), LITERAL/RANGE) compilation
- `docs/DATA_CONTRACTS.md` — Updated GameToken schema
- `docs/ARCHITECTURE.md` — Version bump
- `docs/ETL_GUIDE.md` — Added Section 7b
- `AGENT_NAVIGATION.md` — Updated known issues, strategy table, regexPrefixContext docs
- `OPTIMIZER_PLAN.md` — Updated to v1.8 with Session 49 status

**NOT YET DONE (next iteration):**
- ⬜ Re-run ETL to verify regexPrefixContext population and actual FP counts
- ⬜ Amulet 19 FP — detailed token analysis + i18n-overrides
- ⬜ Jewel 11 FP — longer suffixes or regexPrefixContext
- ⬜ Re-test `|` inside `()` with correct `"!X"` syntax in-game
- ⬜ Number range with `|` — verify in PoE2
- ⬜ Optimizer expansion — truncated forms in compute-optimizations.ts
- ⬜ Verify build (`pnpm build`) after ETL re-run

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`##` from template in regex:** Template placeholders MUST NOT appear in final regexes.
3. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
4. **Description text not indexed:** Tooltip text is NOT searchable — verified in-game.
5. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block.
6. **Waystone implicits are NOT affixes:** Base item properties, not from the mod system.
7. **`()` in regex = PoE2 grouping:** `containsPoE2Grouping()` filters at generation time.
8. **Negate syntax `"!X"` only:** `!"X"` does NOT work — `!` must be inside quotes.
9. **Word truncation = trailing substring only:** Mid-word extraction does NOT work.
10. **i18n overrides cause cross-family FP:** `repairCrossFamilyFP()` + `regexPrefixContext` fix this.
11. **regexExclude format must be locale-object:** Always `{ru: [...]}` not plain array.
12. **regexPrefixContext format must be locale-object:** Always `{ru: "..."}` not plain string.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (471)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
