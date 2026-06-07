# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 58 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (487/487 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**

**Key Changes This Session:**

1. **FilterChip `firstRangedMember` crash fixed** — `TypeError: Cannot read properties of undefined (reading 'id')` in onChange handlers:
   - Root cause: `firstRangedMember` searched for `m.ranges.length > 0`, but `hasRanges` checks `group.rangeSlots.length > 0` which includes both `ranges` (##) and `values` (#). For value-only groups (corrupted implicits like "+1 к уровню всех камней умений"), `firstRangedMember` was `undefined` → crash on `.id` access.
   - Fix: Changed `firstRangedMember` to `m.ranges.length > 0 || m.values.length > 0` + replaced `firstRangedMember!.id` with null-guarded `firstRangedMember.id`.
   - Affected 27 groups across amulet/belt/ring/jewel (VirtualizedModList) and 17+ in waystone/tablet (ModList).

**Files changed this session:**
- `src/ui/components/FilterChip.tsx` — Fixed `firstRangedMember` lookup + null guards
- `AGENT_NAVIGATION.md` — v58.0, updated browser testing note
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges on value-only groups, dual-slot ranges, jewel type sub-headers)
- ⬜ Jewel classification accuracy improvement (heuristic fallback ~84%)

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
14. **Multi-line sub-lines may share text with standalone mods:** h4ipty splits can create cross-family FP with mods that have the same suffix but a `#%` prefix. Use `—` exclude/context to disambiguate.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (487)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
