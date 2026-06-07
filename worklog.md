# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 61 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (495/495 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**

**Key Changes This Session:**

1. **P2 FIX: Visual indicator when optimizer collapses selections** — When the runtime optimizer replaces multiple selected tokens with a shared regex from the optimization table, the user sees no change in the regex output when clicking a chip. Now, a ⚡ indicator appears on chips whose tokens were collapsed by the optimizer, with a tooltip "Оптимизатор: regex этого мода уже включён в общее выражение".
   - Added `collectCollapsedTokenIds()` in `optimizer.ts` — walks optimized AST to find `opt:` prefixed tokenIds and looks up optimizationTable to identify collapsed token IDs.
   - Added `collapsedTokenIds: Set<string>` to `useCategoryPage` return type, computed from optimized AST.
   - Added `collapsedTokenIds` prop to `FilterChip`, `ModList`, `VirtualizedModList`, and all page components.
   - Files: `src/core/optimizer.ts`, `src/ui/hooks/useCategoryPage.ts`, `src/ui/components/FilterChip.tsx`, `src/ui/components/ModList.tsx`, `src/ui/components/VirtualizedModList.tsx`, all page components, `src/shared/i18n.ts`

2. **Edge case: regexExclude при OR-suffix** — Analyzed and documented. When ranged tokens with same (min,max) but different suffixes are merged into a single RANGE with OR-joined suffixes, ALL excludes from all tokens are unioned. This is intentional and correct for PoE2's item-wide negation model. Added detailed comment explaining the tradeoff.
   - Files: `src/ui/hooks/useCategoryPage.ts` (documentation only)

3. **UI Audit — Bug fixes (HIGH severity):**
   - **FilterChip keyboard inaccessibility** — Added `tabIndex={0}` and `onKeyDown` handler to FilterChip's outer div (role="switch"). Keyboard users can now focus and toggle chips.
   - **VendorPage never syncs to URL hash** — Added `syncToUrl()` call in VendorPage's sync effect. State now persists on page refresh.
   - **VendorChip click target mismatch** — Moved `onClick` from inner `<span>` to outer `<div>`. Entire chip area is now clickable.
   - **No 404 fallback route** — Added `<Route path="*">` with `NotFoundPage` component in `App.tsx`.

4. **UI Audit — Bug fixes (MEDIUM severity):**
   - **VendorChip NaN storage** — Changed `parseInt` handling to check `isNaN(v)` before storing, preventing NaN values in numericInputs.
   - **VendorPage clearAll doesn't reset round10/searchLogic** — Added `setRound10(true)` and `setSearchLogic('and')` to `clearAll()`.
   - **url-sync non-null assertion** — Changed `store.deserialize!(data)` to `if (store.deserialize) { store.deserialize(data); }`.
   - **Negative number inputs** — Added `v < 0` check in CategoryControlPanel and FilterChip number inputs, rejecting negative values.

**Files changed this session:**
- `src/core/optimizer.ts` — Added `collectCollapsedTokenIds()`
- `src/ui/hooks/useCategoryPage.ts` — Added `collapsedTokenIds`, regexExclude documentation
- `src/ui/components/FilterChip.tsx` — `collapsedTokenIds` prop, keyboard a11y, negative input validation
- `src/ui/components/ModList.tsx` — `collapsedTokenIds` prop pass-through
- `src/ui/components/VirtualizedModList.tsx` — `collapsedTokenIds` prop pass-through
- `src/ui/components/VendorChip.tsx` — Fixed click target, NaN, keyboard a11y
- `src/ui/components/CategoryControlPanel.tsx` — Negative input validation
- `src/ui/pages/vendor/VendorPage.tsx` — URL sync, clearAll fix
- `src/App.tsx` — 404 fallback route
- `src/store/url-sync.ts` — Non-null assertion fix
- `src/shared/i18n.ts` — Added `chip.optimizer_collapsed` key
- All page components (amulet, belt, ring, relic, waystone, tablet, jewel) — `collapsedTokenIds` prop
- `worklog.md` — This update
- `AGENT_NAVIGATION.md` — To be updated

**NOT YET DONE (next iteration):**
- ⬜ Jewel classification accuracy improvement (heuristic fallback ~84%)
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers)
- ⬜ Remaining UI audit fixes (MEDIUM/LOW severity): ProfilePanel delete confirmation, ARIA labels, PageStateWrapper ARIA roles, radio group arrow key navigation, etc.

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
