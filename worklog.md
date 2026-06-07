# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 60 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (495/495 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**

**Key Changes This Session:**

1. **P0 FIX: Regex collapses when numeric value is set** — When user selects multiple mods and sets a numeric range (global min/max or per-token), ranged tokens with different suffixes were creating separate RANGE nodes ANDed together. This required the item to have ALL mods simultaneously — wrong for typical use case (user wants ANY mod with value ≥N).
   - Root cause: `buildAstFromSelections()` grouped ranged tokens by (suffix, prefix, min, max) — each suffix got its own RANGE node ANDed in.
   - Fix: Changed grouping key to (prefix, min, max, exact, slotIndex) — tokens with same numeric range but different suffixes now share one RANGE with OR-joined suffixes.
   - Example: `RANGE(10, undefined, "огню|холоду")` → `"([1-9][0-9]|[0-9][0-9][0-9]).*(огню|холоду)"` instead of `"([1-9][0-9]|[0-9][0-9][0-9]).*огню" "([1-9][0-9]|[0-9][0-9][0-9]).*холоду"`
   - Compiler updated: OR-suffixes wrapped in `()` to scope `|` correctly: `".*(огню|холоду)"` not `".*огню|холоду"`.
   - Files: `src/ui/hooks/useCategoryPage.ts`, `src/core/compiler.ts`, `tests/core/compiler.test.ts`

2. **P1 FIX: Selection count shows token count instead of group count** — "Выбрано: 20 мод(ов)" when user selected 6 FamilyGroup chips. Each chip represents multiple tokens (different tier ranges), but the counter showed individual token count.
   - Fix: Added `countUniqueFamilyKeys()` in `family-grouper.ts`, used in all page summaries and "Очистить" button in ModList/VirtualizedModList.
   - Files: `src/shared/family-grouper.ts`, all page components, `ModList.tsx`, `VirtualizedModList.tsx`

3. **Waystone 404 investigated** — NOT an app bug. The 404 is from SPA routing on GitHub Pages (browser requests `/waystone` route, GitHub serves 404.html which redirects to index.html). JSON data loads correctly.

**Files changed this session:**
- `src/ui/hooks/useCategoryPage.ts` — OR-suffix grouping for ranged tokens
- `src/core/compiler.ts` — OR-suffix wrapping in `()`
- `src/shared/family-grouper.ts` — Added `countUniqueFamilyKeys()`
- `src/ui/components/ModList.tsx` — Use `countUniqueFamilyKeys` for clear button
- `src/ui/components/VirtualizedModList.tsx` — Use `countUniqueFamilyKeys` for clear button
- `src/ui/pages/amulet/AmuletPage.tsx` — Use `countUniqueFamilyKeys` for summary
- `src/ui/pages/belt/BeltPage.tsx` — Use `countUniqueFamilyKeys` for summary
- `src/ui/pages/ring/RingPage.tsx` — Use `countUniqueFamilyKeys` for summary
- `src/ui/pages/relic/RelicPage.tsx` — Use `countUniqueFamilyKeys` for summary
- `src/ui/pages/waystone/WaystonePage.tsx` — Use `countUniqueFamilyKeys` for summary
- `src/ui/pages/jewel/JewelPage.tsx` — Use `countUniqueFamilyKeys` for summary
- `src/ui/pages/tablet/TabletPage.tsx` — Use `countUniqueFamilyKeys` for summary
- `tests/core/compiler.test.ts` — 8 new OR-suffix RANGE tests
- `worklog.md` — This update
- `AGENT_NAVIGATION.md` — Updated

**NOT YET DONE (next iteration):**
- ⬜ P2: Visual indicator when optimizer collapses selections (regex doesn't change on click — confusing but correct behavior)
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers)
- ⬜ Jewel classification accuracy improvement (heuristic fallback ~84%)
- ⬜ Edge case audit: what if ranged tokens with same (min,max) have different regexExclude/regexPrefixContext? Currently only context is added if all tokens share the same one; excludes are unioned. This may produce overly broad regex in rare cases.

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
15. **OR-suffix RANGE must wrap `|` in `()`:** Compiler wraps suffixes containing `|` in `()` to scope the alternation. Without this, `".*огню|холоду"` parses as `".*огню"` OR `"холоду"` — wrong!

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (495)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
