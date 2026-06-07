# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 66 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (495/495 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**

**Key Changes This Session:**

1. **Jewel classification heuristic improved (P1 — DONE)** — Heuristic fallback accuracy improved from ~76% to ~96% vs ETL ground truth. Added `SHARED_OVERRIDE_PATTERNS` array (33 patterns) that classify cross-type mods as 'shared' before scoring. Refined RUBY/EMERALD/SAPPHIRE scoring weights: removed ambiguous patterns, added type-specific patterns (mark skills to Emerald, ES threshold to Sapphire, banner glory speed to Ruby, minion health back to Ruby). Fixed `мет[о]?к` pattern to match genitive plural "меток".

2. **FilterChip min-w-[30%] removed (P2 — DONE)** — Removed the minimum width constraint from FilterChip's outer div for better flex-wrap behavior. Chips now size to their content naturally.

3. **Number regex [0-9] → . confirmed NOT VIABLE (P3 — CLOSED)** — Investigated replacing `[0-9]` with `.` in generated regex patterns for character savings. Confirmed that `.` in PoE2 regex dialect matches ANY character (not just digits), as documented in `src/core/number-regex.ts` and verified in-game. Using `.` would cause false positives (e.g., "4-" or "4a" matching). This optimization is impossible.

4. **FilterChip ARIA restructuring confirmed already done** — Code review shows inputs are already siblings of `role="switch"` div (not children), matching the VendorChip sibling pattern. Was completed in a previous session.

5. **Documentation updated** — AGENT_NAVIGATION.md v66.0, новый_план.md v9.0, worklog updated.

**Files changed this session:**
- `src/shared/mod-classifier.ts` — Added SHARED_OVERRIDE_PATTERNS, refined scoring weights, fixed меток pattern
- `src/ui/components/FilterChip.tsx` — Removed min-w-[30%]
- `AGENT_NAVIGATION.md` — v66.0: updated Known Issues, moved resolved items
- `новый_план.md` — v9.0: updated status to Session 66
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers) — NEEDS HUMAN
- ⬜ Jewel classification heuristic remaining edge cases (9 mismatches, ~96% accuracy)
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
