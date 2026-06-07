# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 64 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (495/495 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**

**Key Changes This Session:**

1. **ProfilePanel: duplicate name prevention (MEDIUM)** — Added `isDuplicateName` check (case-insensitive) that disables the Save button and shows "Есть такое" when a profile with the same name already exists in the category. New i18n key: `profile.duplicate`.

2. **RegexOutput: Ctrl+Shift+C → Ctrl+Shift+X (LOW)** — The old shortcut conflicted with Chrome/Firefox DevTools. Changed to Ctrl+Shift+X (also handles Russian keyboard layout: X→Ч). Updated i18n key `regex.copy_shortcut`.

3. **ProfilePanel: onBlur race condition fix (HIGH)** — Delete confirm button (✓) now uses `onMouseDown` with `e.preventDefault()` instead of `onClick`. This ensures the confirm handler fires BEFORE the parent's `onBlur={handleDeleteCancel}`, preventing accidental cancellation of the delete confirmation.

4. **VirtualizedModList: re-measure on selection change (MEDIUM)** — Added `useEffect(() => { virtualizer.measure(); }, [selectedIds, perTokenRanges, virtualizer])` to force re-measurement when chip heights change (range inputs appear/disappear). Previously, the virtualizer could show incorrect row heights after toggling a chip.

5. **FilterChip: separate aria labels for dual-number slots (LOW)** — Replaced shared `range.min_aria_dual` / `range.max_aria_dual` with slot-specific keys: `range.min_aria_dual_1`, `range.max_aria_dual_1` (slot 0), `range.min_aria_dual_2`, `range.max_aria_dual_2` (slot 1). Screen readers now correctly announce "первого числа" vs "второго числа".

**Files changed this session:**
- `src/ui/components/ProfilePanel.tsx` — Duplicate name prevention + onBlur fix
- `src/ui/components/RegexOutput.tsx` — Shortcut Ctrl+Shift+C → Ctrl+Shift+X
- `src/ui/components/VirtualizedModList.tsx` — Re-measure effect
- `src/ui/components/FilterChip.tsx` — Separate dual-number aria labels
- `src/shared/i18n.ts` — New keys: `profile.duplicate`, `range.min_aria_dual_1/2`, `range.max_aria_dual_1/2`; updated `regex.copy_shortcut`
- `worklog.md` — This update
- `AGENT_NAVIGATION.md` — Updated to v64.0

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers)
- ⬜ JewelPage: selected tokens hidden by jewelTypeFilter but still in regex — consider adding visual indicator
- ⬜ Additional UI audit for edge cases (tablet rarity regex accuracy, waystone corrupted+delirious interaction)

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
17. **ARIA: interactive elements must not be children of role="switch":** Inputs and buttons inside a switch role violate WAI-ARIA. Use sibling pattern (see VendorChip and FilterChip).
18. **ProfilePanel: confirm button must use onMouseDown, not onClick:** onClick fires AFTER onBlur, causing delete confirmation to be cancelled by the parent's onBlur handler.

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
