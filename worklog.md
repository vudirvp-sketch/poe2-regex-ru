# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 56 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (487/487 tests)
**Oracle:** Unchanged from Session 53 (2 cross-family FP accepted).

**Key Changes This Session:**

1. **Build fix** — Removed unused `idx` parameter from `normalizeTypeA()` and `normalizeTypeB()` in `scripts/etl/normalize.ts`. This was causing TypeScript strict mode errors (`noUnusedParameters`) that broke the production build in CI.

2. **VirtualizedModList scroll fix** — Critical bug: `getScrollElement` was returning `parentElement` of an internal div instead of the actual scroll container (`<main id="main-content">`). The virtualizer could not detect scroll events, making virtualization non-functional. Fixed with `findScrollableParent()` that walks up the DOM tree to find the first scrollable ancestor. Also increased `overscan` from 5→8 and `subgroup` height estimate from 80→100 for smoother scrolling.

3. **Jewel type sub-headers** — Added `showJewelTypeSubGroups` support in VirtualizedModList. When enabled (JewelPage), each origin section now contains jewel type sub-headers (── Рубин ── / ── Изумруд ── / ── Сапфир ── / ── Общие ──) that visually group mods by jewel type within prefix/suffix columns. JewelPage now passes `showJewelTypeSubGroups` and `jewelTypeFilter` props.

4. **Per-token dual-number RANGE filtering** — Extended `TokenRangeOverride` with `slotOverrides` field enabling simultaneous filtering of both placeholders in dual-number mods (e.g., "От ## до ## урона от молнии"). Previously only one slot could be filtered at a time (1е/2е toggle). Now FilterChip shows TWO rows of min/max inputs for dual-number mods, and the AST builder generates separate RANGE nodes for each slot, ANDed together. Backward compatible with old `filterSlotIndex`/`min`/`max` format.

**Files changed this session:**
- `scripts/etl/normalize.ts` — Removed unused `idx` from `.map()` callbacks
- `src/ui/components/VirtualizedModList.tsx` — Scroll fix, jewel type sub-headers, increased overscan
- `src/ui/pages/jewel/JewelPage.tsx` — Added `showJewelTypeSubGroups` + `jewelTypeFilter` props
- `src/ui/components/FilterChip.tsx` — Dual-slot range inputs for multi-placeholder mods
- `src/store/filter-store.ts` — `SlotRangeOverride` type, `slotOverrides` field, serialization/deserialization
- `src/ui/hooks/useCategoryPage.ts` — `getEffectiveRangePerSlot()`, dual-slot RANGE node generation
- `AGENT_NAVIGATION.md` — Updated issues section
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Tablet cross-family FP — mod_od9m77/mod_ld06px + .h4ipty splits (try longer regex or prefixContext)
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, dual-slot ranges)
- ⬜ ETL re-run after multi-line fix (normalize.ts split) — validate all tokens
- ⬜ Re-run ETL to generate fresh JSON with multi-line split tokens

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
14. **Multi-line mods: ETL drops second sub-lines:** normalize.ts takes only first `<br>` segment. Fix requires splitting into separate tokens.
15. **VirtualizedModList scroll element:** Must use actual scrollable ancestor, NOT parentElement. Use `findScrollableParent()`.

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
