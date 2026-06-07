# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 53 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (480/480 tests)
**Oracle:** ETL re-run done. Result: 2 cross-family FP out of 1573 tokens (jewel.mod_am4lla FIXED).

**Key Changes This Session:**

1. **jewel.mod_am4lla FP eliminated** — Raised exclude limit from 8→10 in `repairCrossFamilyFP()`. Now "без" (unarmed) and "для" (spell-specific) markers are included, covering all attack-speed cross-family FP.

2. **Phase A1: Word truncation in optimization entries** — `computeOptimizations()` now applies Strategy 1e word truncation to Phase A family-based optimization entries. For each entry without context/excludes, tries truncated suffix variants and picks the shortest that is unique within the category and matches all family tokens via PoE2 engine. Saved **541 chars** across all categories.

3. **Exported `generateTruncatedSuffixes` and `containsPoE2Grouping`** from `compute-regex.ts` for reuse in `compute-optimizations.ts`.

4. **Updated test for Phase A1** — Test now validates truncation correctness (shorter regex, matches all family tokens, no cross-family FP) instead of exact string match. Added new test for FP prevention during truncation.

5. **HomePage counts verified** — Already uses dynamic loading via `loadCategoryData`/`loadMergedCategoryData`. No hardcoded counts. Removed from known issues.

**Files changed this session:**
- `scripts/run-etl.ts` — exclude limit 8→10 in repairCrossFamilyFP()
- `scripts/etl/compute-regex.ts` — exported `generateTruncatedSuffixes`, `containsPoE2Grouping`
- `scripts/etl/compute-optimizations.ts` — Phase A1 word truncation + imports
- `tests/etl/compute-optimizations.test.ts` — updated + new test for truncation FP prevention
- `public/generated/*.json` — regenerated with ETL re-run (Phase A1 savings)
- `AGENT_NAVIGATION.md` — v53.0
- `OPTIMIZER_PLAN.md` — v4.0
- `worklog.md` — this update

**NOT YET DONE (next iteration):**
- ⬜ In-game tests Group M — verify `|` inside `()` and number ranges
- ⬜ List virtualization for large categories (belt/ring/amulet)
- ⬜ Multi-line mod handling

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
13. **Phase A1 truncation only for entries without context/excludes:** Truncating entries with FP would break the context/exclude patching logic.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (480)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
