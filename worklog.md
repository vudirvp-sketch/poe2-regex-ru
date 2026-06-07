# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 63 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (495/495 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**

**Key Changes This Session:**

1. **FilterChip: ARIA restructuring (HIGH)** — Same issue as VendorChip had: `<input type="number">` was a child of `role="switch"` div, violating WAI-ARIA. Restructured: outer div is visual container only (no role), inner `<div role="switch">` holds label + badges, range inputs are siblings of switch. Same pattern as VendorChip.

2. **FilterChip: min-w-[45%] → min-w-[30%] (MEDIUM)** — The 45% minimum width limited chips to 2 per row even on wider screens. Reduced to 30% to allow 3 chips per row when space permits.

3. **Jewel classification: updated heuristic accuracy note** — ETL lookup gives 100% accuracy (all 250 tokens have `jewelType` populated). Heuristic fallback is ~75% vs ETL ground truth, mainly because ETL marks mods appearing on multiple jewel types as `shared`, while the heuristic assigns specific types more aggressively. Added several rule improvements:
   - Banner rule: added `накоплен.*славы.*умени.*знамён` variant
   - Stun threshold: added `/порог.*оглушен/` rule (w=2) for better Ruby coverage
   - Mark skills: expanded rule to include `усилен.*эффект.*умени.*метк|усилен.*эффект.*метк`
   - Critical damage spears: added `/крит.*урон.*копь|бонус.*крит.*копь/` rule for Emerald
   - Conditional melee↔projectile: added rule for Emerald dual-weapon mods

4. **Bug audit: UI logic review** — Reviewed all UI components (VirtualizedModList, ModList, ProfilePanel, CategoryControlPanel, VendorChip, Sidebar, Header). Found no critical bugs. ProfilePanel delete confirmation works correctly (autoFocus on ✓ button prevents onBlur race). FilterChip ARIA was the main fixable issue (done above).

**Files changed this session:**
- `src/ui/components/FilterChip.tsx` — ARIA restructure + min-w change
- `src/shared/mod-classifier.ts` — Heuristic rule improvements + accuracy comment update
- `worklog.md` — This update
- `AGENT_NAVIGATION.md` — Updated to v63.0

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers)
- ⬜ Duplicate profile names allowed — ProfilePanel doesn't prevent identical names
- ⬜ Ctrl+Shift+C shortcut may conflict with browser dev tools

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
