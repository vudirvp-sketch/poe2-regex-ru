# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 68 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (543/543 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **ETL pipeline audit** — Ran `pnpm etl`, verified all 10 categories generate correctly. Oracle validation: 1823/1823 valid, 0 cross-family FP. Flat-text validation: 0 FN, 1359 FP (all family-tier). Block-based: 0 FN, 1309 FP (all family-tier).

2. **Cross-validation tests verified** — 543/543 tests pass on real generated data. Token counts match expected ranges.

3. **i18n-overrides relevance** — All 56 override keys verified against generated JSON. All 42 category-specific tokens found in their respective JSON files.

4. **filterTokensByJewelType(::origin) — NO BUG** — The `::origin` suffix only exists on `FamilyGroup.familyKey` (added by `splitGroupByOrigin` for React key uniqueness). `filterTokensByJewelType` uses `groupTokensByFamily` which does NOT add `::origin`. Hidden selected tokens in regex is by design with UI warning + "Снять скрытые" button.

5. **dp-factorizer/trie-factorizer — NOT dead code** — Used by ETL scripts: `compute-optimizations.ts` imports `batchDPFactorize`, `iterative-optimizer.ts` imports `batchDPFactorize, applyDialectOptimizations`, `run-etl.ts` imports `applyDialectOptimizations`. They are ETL-only (not imported by runtime `compiler.ts` or `optimizer.ts`), but essential for the build pipeline.

6. **constants.ts deleted** — Had zero imports across the entire codebase. Contained `CATEGORY_IDS`, `CATEGORY_ROUTES`, `CATEGORY_LABELS`, `CategoryId` type that were never used.

7. **iterative-optimizer dry-run verified** — 0 FN, 749 FP-reduction changes in iteration 1. Correctly applies strategies: FN-repair, dialect optimization, FP-reduce, suffix-shorten. Converges properly.

8. **buildAstFromSelections regexPrefixContext/regexExclude — CORRECT** — Context only applied when ALL tokens in a range group share the SAME context. Exclude union across merged tokens is correct by design (over-excluding safer than FP in PoE2).

9. **Unused imports in mod-classifier.test.ts** — Removed `classifyGroups` and `AffixType` that broke `pnpm build` (TS6133/TS6196).

**Files changed this session:**
- `src/shared/constants.ts` — DELETED (dead code)
- `tests/shared/mod-classifier.test.ts` — Removed unused imports
- `AGENT_NAVIGATION.md` — v68.0: added Session 68 RESOLVED items, updated test counts 540→543, removed "constants" from shared dir description
- `новый_план.md` — v11.0: added Session 68 to Выполнено, added P3 section
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers) — NEEDS HUMAN
- ⬜ Mobile-specific testing (touch targets, scroll behavior) — NEEDS REAL DEVICE

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
13. **Phase A1 truncation only for entries without context/excludes:** Truncating entries with FP would break patching logic.
14. **Multi-line sub-lines may share text with standalone mods:** Use `—` exclude/context to disambiguate.
15. **OR-suffix RANGE must wrap `|` in `()`:** Without this, `".*огню|холоду"` parses wrong.
16. **VendorProperty interface is ONLY in `@data/vendor-properties`:** Never create local duplicates.
17. **ARIA: interactive elements must not be children of role="switch":** Use sibling pattern.
18. **ProfilePanel: confirm button must use onMouseDown, not onClick:** onClick fires AFTER onBlur.
19. **All number inputs must have step={1}:** PoE2 mod values are always integers; fractional input produces invalid regex.
20. **Russian е/ё dialect in classifier patterns:** Always use `[её]` in regex patterns for words that can be spelled with ё (e.g., `знам[её]н`, `вс[её]`).
21. **dp-factorizer/trie-factorizer are ETL-only:** Not imported by runtime code (compiler/optimizer), but essential for ETL scripts. Do NOT delete as "dead code".

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (543)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
