# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 52 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (479/479 tests)
**Oracle:** ETL re-run done (P0 complete). Result: 3 cross-family FP out of 1573 tokens.

**Key Changes This Session:**

1. **Runtime optimizer now uses regexPrefixContext/regexExclude from OptimizationEntry** — `applyOptimizationTable()` creates proper AST structure:
   - With context: `AND(LITERAL(context), LITERAL(regex))`
   - With excludes: `AND(LITERAL(regex), EXCLUDE(OR(...excludes)))`
   - With both: `AND(LITERAL(context), LITERAL(regex), EXCLUDE(OR(...excludes)))`
   - Without either: plain `LITERAL(regex)` (backward compatible)

2. **Optimizer finds AND-wrapped LITERALs** — `findLiteralsInOr()` now discovers LITERAL tokenIds inside AND wrappers (tokens with per-token context/excludes applied by `buildAstFromSelections`). This enables optimization of tokens that already have FP-prevention wrapping.

3. **Dedup handles AND-wrapped nodes** — `deduplicateOrGroups()` now properly collects tokenIds from AND-wrapped LITERALs and creates dedup: prefixed tokenIds on the inner LITERAL.

4. **Savings calculation uses approximate compiled length** — New `approCompiledLength()` function computes estimated compiled regex length for more accurate savings comparison, especially for AND-wrapped nodes.

5. **Removed stale root-level files** — Deleted `JewelPage.tsx`, `ModList.tsx`, `TabletPage.tsx`, `mod-classifier.ts` from project root (outdated copies; actual files are in `src/`).

6. **Fixed TS build error** — `patchOptimizationEntries()` had unused `key` variable in destructuring.

**Files changed this session:**
- `src/core/optimizer.ts` — regexPrefixContext/regexExclude support + AND-wrapped LITERAL handling
- `tests/core/optimizer.test.ts` — 8 new tests for context/excludes optimization (479 total)
- `scripts/run-etl.ts` — Fixed unused variable warning
- `AGENT_NAVIGATION.md` — Updated to v52.0
- `OPTIMIZER_PLAN.md` — Updated to v3.0
- `worklog.md` — This update
- Removed: `JewelPage.tsx`, `ModList.tsx`, `TabletPage.tsx`, `mod-classifier.ts` (root-level stale files)

**NOT YET DONE (next iteration):**
- ⬜ ETL re-run with Session 51 changes to confirm jewel.mod_am4lla fix (expect 1-2 cross-family FP)
- ⬜ In-game tests Group M — verify `|` inside `()` and number ranges
- ⬜ Truncated forms in compute-optimizations.ts Phase A
- ⬜ List virtualization for large categories

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
npx vitest run --root .          # Run all tests (479)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
