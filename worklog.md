# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 51 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (471/471 tests)
**Oracle:** ETL re-run done (P0 complete). Result: 3 cross-family FP out of 1573 tokens (was 62).

**Key Changes This Session:**

1. **repairCrossFamilyFP() exclude limit 5→8** — jewel.mod_am4lla needed 7+ excludes for all weapon types. Limit raised to 8 to accommodate: Приспеш + топорами + луками + самострелами + кинжалами + посохами + копьями + мечами.

2. **CONFLICT_MARKERS expanded** — Added: мечами, луками, топорами, без (unarmed "без оружия"). Total markers now: 15.

3. **OptimizationEntry type expanded** — Added optional `regexPrefixContext?: Record<Locale, string>` and `regexExclude?: Record<Locale, string[]>` fields to `OptimizationEntry` in `src/shared/types.ts`.

4. **patchOptimizationEntries() — ETL Step 7c** — New post-processing function that copies regexPrefixContext and regexExclude from tokens to optimization entries after repairCrossFamilyFP(). Runs as Step 7c in the ETL pipeline.

5. **Tablet FP documented as accepted limitation** — tablet.mod_od9m77 and tablet.mod_ld06px have mutual cross-family FP because their rawText is a substring/superset pair with no unique distinguishing substring. These are essentially family-tier FP with different familyKeys.

**Files changed this session:**
- `scripts/run-etl.ts` — exclude limit 5→8, CONFLICT_MARKERS expanded, patchOptimizationEntries() added
- `src/shared/types.ts` — OptimizationEntry: regexPrefixContext + regexExclude fields
- `AGENT_NAVIGATION.md` — Updated to v51.0
- `OPTIMIZER_PLAN.md` — Updated to v2.0 with ETL re-run results
- `docs/ETL_GUIDE.md` — Updated to v8.0 with Step 7c documentation
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Re-run ETL with Session 51 changes to confirm jewel.mod_am4lla fix (expect 1 cross-family FP from tablet)
- ⬜ In-game tests Group M — verify `|` inside `()` and number ranges
- ⬜ Runtime optimizer — use regexPrefixContext/regexExclude from OptimizationEntry (src/core/optimizer.ts)
- ⬜ Truncated forms in compute-optimizations.ts Phase A

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
