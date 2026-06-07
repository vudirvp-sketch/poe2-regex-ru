# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 70 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (576/576 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Priority tier system integrated into UI** — Full implementation of Variant В (sort + compact filter):
   - `PriorityTier` ('S'|'A'|'B'|'C') and `PriorityFilter` ('all'|'S+A'|'S') types added to `types.ts`
   - `classifyPriorityTier(group, category)` in `mod-classifier.ts` — text-based heuristic per category (ring, amulet, belt, waystone, tablet). Jewel/relic/vendor default to 'C'.
   - `FamilyGroup.priorityTier` field — set during grouping in `family-grouper.ts`
   - Default sort order changed: within each affix, groups sorted by tier (S→A→B→C) then alphabetically
   - FilterChip visual differentiation: S-tier gets amber border-l, C-tier gets opacity-80
   - CategoryControlPanel toggle group: «Приоритет: Все | S+A | S» with amber accent
   - `priorityFilter` added to filter-store with URL persistence (`p` key)
   - ModList + VirtualizedModList: `category` and `priorityFilter` props for priority filtering
   - All 5 category pages (ring, amulet, belt, waystone, tablet) updated with priority filter props

2. **33 new tests** — classifyPriorityTier (30 tests across ring/amulet/belt/waystone/tablet/unknown) + family-grouper priority tier tests (3 tests). Total: 576 tests.

3. **Documentation updated** — AGENT_NAVIGATION.md v70, worklog.md.

**Files changed this session:**
- `src/shared/types.ts` — Added PriorityTier, PriorityFilter types; priorityTier field on FamilyGroup
- `src/shared/mod-classifier.ts` — Added classifyPriorityTier(), TIER_SORT_ORDER, per-category keyword patterns
- `src/shared/family-grouper.ts` — Added category param, priorityTier assignment, tier-based sorting, priorityTier inheritance in splitGroupByOrigin
- `src/shared/i18n.ts` — Added priority filter labels (priority.all, priority.sa, priority.s_only, priority.label)
- `src/store/filter-store.ts` — Added priorityFilter state, setPriorityFilter action, URL serialization
- `src/ui/components/FilterChip.tsx` — S-tier amber border, C-tier opacity-80 dimming
- `src/ui/components/CategoryControlPanel.tsx` — Priority filter toggle group with ARIA radio group
- `src/ui/components/ModList.tsx` — category/priorityFilter props, priority filtering
- `src/ui/components/VirtualizedModList.tsx` — category/priorityFilter props, priority filtering
- `src/ui/hooks/useCategoryPage.ts` — priorityFilter state, URL sync, restore
- `src/ui/pages/ring/RingPage.tsx` — Priority filter props
- `src/ui/pages/amulet/AmuletPage.tsx` — Priority filter props
- `src/ui/pages/belt/BeltPage.tsx` — Priority filter props
- `src/ui/pages/waystone/WaystonePage.tsx` — Priority filter props
- `src/ui/pages/tablet/TabletPage.tsx` — Priority filter props
- `src/ui/pages/jewel/JewelPage.tsx` — Priority filter + category props
- `src/ui/pages/relic/RelicPage.tsx` — Priority filter + category props
- `src/ui/pages/vendor/VendorPage.tsx` — Local priorityFilter state + props
- `tests/shared/mod-classifier.test.ts` — 30 new tests for classifyPriorityTier + TIER_SORT_ORDER
- `tests/shared/family-grouper.test.ts` — 3 new tests for priorityTier assignment and sorting
- `AGENT_NAVIGATION.md` — v70: added Priority Tier System section, updated test count, updated TODO

**Continued (same session, context overflow fix):**
- Fixed TypeScript errors: JewelPage, RelicPage, VendorPage missing priorityFilter/setPriorityFilter props
- JewelPage: added priorityFilter/setPriorityFilter from useCategoryPage + category/priorityFilter on VirtualizedModList
- RelicPage: added priorityFilter/setPriorityFilter from useCategoryPage + category/priorityFilter on ModList
- VendorPage: added local priorityFilter/setPriorityFilter state (vendor doesn't use mod families)

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of priority tier filter — NEEDS HUMAN
- ⬜ Validate priority tier classifications against live trade data
- ⬜ Mobile-specific testing — NEEDS REAL DEVICE

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
20. **Russian е/ё dialect in classifier patterns:** Always use `[её]` in regex patterns for words that can be spelled with ё.
21. **dp-factorizer/trie-factorizer are ETL-only:** Not imported by runtime code, but essential for ETL scripts. Do NOT delete.

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
