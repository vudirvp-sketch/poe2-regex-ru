# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 62 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (495/495 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**

**Key Changes This Session:**

1. **VendorChip: removed duplicate VendorProperty interface** — Was declaring a local `VendorProperty` interface identical to the one in `@data/vendor-properties.ts`. Now imports from the canonical source. Prevents future drift.

2. **VendorChip: fixed ARIA violation** — `<input type="number">` was a child of `role="switch"` div, which violates WAI-ARIA (interactive element inside another interactive role). Restructured: outer div is visual container, inner `<div role="switch">` holds just the label, `<input>` is a sibling. Updated misleading comment that claimed this was already done.

3. **VendorChip: added negative number validation** — `parseInt` result now checked for `v < 0`, consistent with FilterChip. Previously could store negative values.

4. **RegexOutput: clamped aria-valuenow to MAX_CHARS** — When regex overflows 250 chars, `aria-valuenow` exceeded `aria-valuemax`, violating ARIA spec. Now uses `Math.min(charCount, MAX_CHARS)`.

5. **PageStateWrapper: added ARIA roles** — Loading state gets `role="status"` + `aria-live="polite"`, error state gets `role="alert"`, no-data state gets `role="status"`.

6. **ProfilePanel: added delete confirmation** — Clicking ✕ enters confirm state (shows ✓), clicking ✓ confirms delete. Clicking elsewhere (onBlur on container) cancels. Also added `aria-label` on rename (✎) and delete (✕/✓) buttons with profile name context. Added Escape key to cancel rename.

7. **CategoryControlPanel: added arrow key navigation for radio groups** — Mode toggle (Хочу/Не хочу) and logic toggle (AND/OR) now respond to ArrowLeft/ArrowUp (previous) and ArrowRight/ArrowDown (next), wrapping around. Per ARIA radiogroup spec.

8. **VirtualizedModList: removed unused jewelTypeFilter prop** — Was declared and destructured (`_jewelTypeFilter`) but never used. Filtering happens at the page level (JewelPage's `filterTokensByJewelType`). Removed from interface and destructuring. Updated JewelPage to not pass it.

**Files changed this session:**
- `src/ui/components/VendorChip.tsx` — Remove duplicate interface, ARIA fix, negative validation
- `src/ui/components/RegexOutput.tsx` — aria-valuenow clamp
- `src/ui/components/PageStateWrapper.tsx` — ARIA roles
- `src/ui/components/ProfilePanel.tsx` — Delete confirmation, aria-labels
- `src/ui/components/CategoryControlPanel.tsx` — Arrow key navigation
- `src/ui/components/VirtualizedModList.tsx` — Remove unused jewelTypeFilter prop
- `src/ui/pages/jewel/JewelPage.tsx` — Remove jewelTypeFilter prop pass-through
- `AGENT_NAVIGATION.md` — Updated to v62.0
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ FilterChip ARIA restructuring — range inputs are children of `role="switch"` div, same issue as VendorChip had. Needs careful layout work.
- ⬜ FilterChip min-w-[45%] — too aggressive for wider screens, consider reducing
- ⬜ Jewel classification accuracy improvement (heuristic fallback ~84%)
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers)

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
16. **VendorProperty interface is ONLY in `@data/vendor-properties`:** Never create local duplicates — import from canonical source.
17. **ARIA: interactive elements must not be children of role="switch":** Inputs and buttons inside a switch role violate WAI-ARIA. Use sibling pattern (see VendorChip).

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
