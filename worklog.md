# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 50 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (471/471 tests)
**Oracle:** ETL not re-run yet. Expected: ~20-25 cross-family FP (down from 62 after Oracle fix + expanded excludes).

**Key Changes This Session:**

1. **Oracle validation fix** — `validateGeneratedRegexesItem()` in `run-etl.ts` now compiles regexPrefixContext as AND(context, regex) when present, matching how the UI compiles regexes. Previously, Oracle only checked the raw regex field, ignoring regexPrefixContext and regexExclude that were set by `repairCrossFamilyFP()`. This caused inflated FP counts (62 instead of the real ~20-25).

2. **repairCrossFamilyFP() exclude limit raised 3→5** — The old limit of 3 excludes was too restrictive for tokens like `amulet.corrupted_5_corrupted` (which had excludes [Приспеш, чар, ближнего] but still had FP from снарядов). With limit 5, "снарядов" and other markers can be added.

3. **CONFLICT_MARKERS expanded** — Added 5 new markers: самострелами, кинжалами, посохами, копьями, для. These cover weapon-specific attack speed/crit variants and spell-specific variants that cause cross-family FP in jewel and amulet categories.

4. **In-game tests Group M** — Added 5 tests for `|` inside `()` and number range with `|` to `docs/IN_GAME_TESTS.md`. Tests M1-M5 cover: basic OR-range, two-digit ranges, small ranges, free OR, and combined negation.

5. **TS build fix** — Added `regexPrefixContext: ''` default to `makeRegexResult()` in `tests/etl/compute-optimizations.test.ts`. Added type annotations for arrow function params in `run-etl.ts` two-words computation.

**Files changed this session:**
- `scripts/run-etl.ts` — Oracle validation fix + CONFLICT_MARKERS expansion + exclude limit 5→ + TS type annotations
- `tests/etl/compute-optimizations.test.ts` — regexPrefixContext default
- `docs/IN_GAME_TESTS.md` — Group M tests
- `AGENT_NAVIGATION.md` — Updated known issues, version 50.0
- `OPTIMIZER_PLAN.md` — Updated to v1.9 with Session 50 status
- `новый_план.md` — Updated to v13.0 with Session 50 context
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Re-run ETL to verify Oracle fix and actual FP counts
- ⬜ In-game tests Group M — verify `|` inside `()` and number ranges
- ⬜ Optimizer expansion — truncated forms in compute-optimizations.ts
- ⬜ Remaining ~20-25 FP analysis after ETL re-run

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
