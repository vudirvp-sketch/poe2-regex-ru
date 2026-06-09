# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 77 — 2026-06-09)

**Build:** `pnpm build` passes, `npx vitest run` passes (576/576 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Phase 9a: Range notation FP confirmed in-game** — Both flat `(27|28|29|30)` and compact `(2[7-9]|30)` enumeration highlight 26% and 22% items. Numbers in range notation (e.g., "27" from "(27-50)") match enumerated values. Enumeration is NOT a complete solution for range notation FP.
2. **UI warning: round10 + AND fallback** — Added ⚠ Округл. indicator in CategoryControlPanel when round10=true AND range > MAX_ENUMERATE_RANGE (50 values). Tooltip explains that rounding expands the range in AND fallback mode.
3. **UI warning: range notation FP** — Added ⚠ Диапазон indicator in CategoryControlPanel when any range filter is active. Tooltip explains that numbers in item range notation can cause false positives.
4. **Documentation** — Updated ARCHITECTURE.md (v38), IN_GAME_TESTS.md (Phase 9a), новый_план.md (v18), worklog.md.

**Files changed this session:**
- `src/ui/components/CategoryControlPanel.tsx` — Added range warnings (round10+AND fallback, range notation FP), imported MAX_ENUMERATE_RANGE
- `src/shared/i18n.ts` — Added i18n keys for range warnings
- `docs/ARCHITECTURE.md` — v38: updated enumeration section with Phase 9a findings, updated prefix anchoring section
- `docs/IN_GAME_TESTS.md` — Added Phase 9a test results (compact enumeration FP confirmed)
- `новый_план.md` — v18: updated status, P2 done, P3 updated with `^` anchor verification
- `worklog.md` — Updated
- `AGENT_NAVIGATION.md` — Updated

**NOT YET DONE (next iteration):**
- ⬜ In-game verification of `^` anchor for range notation FP prevention
- ⬜ Browser functional testing — verify all tabs, range warnings, visual hierarchy
- ⬜ Mobile testing on real device — verify touch targets, scroll behavior
- ⬜ Priority tier filter testing — S/A/S+A toggle on ring/amulet/belt/waystone/tablet
- ⬜ Suffix anchoring investigation — does `"(2[7-9]|30)%.*suffix"` prevent FP?

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`##` from template in regex:** Template placeholders MUST NOT appear in final regexes.
3. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
4. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block.
5. **`()` in regex = PoE2 grouping:** `containsPoE2Grouping()` filters at generation time.
6. **Negate syntax `"!X"` only:** `!"X"` does NOT work — `!` must be inside quotes.
7. **Word truncation = trailing substring only:** Mid-word extraction does NOT work.
8. **Range notation FP (Phase 9a):** Enumeration doesn't fully prevent FP when range notation contains matching numbers. `^` anchor might help — needs in-game verification.
9. **regexExclude format must be locale-object:** Always `{ru: [...]}` not plain array.
10. **regexPrefixContext format must be locale-object:** Always `{ru: "..."}` not plain string.
11. **OR-suffix RANGE must wrap `|` in `()`:** Without this, `".*огню|холоду"` parses wrong.
12. **VendorProperty interface is ONLY in `@data/vendor-properties`:** Never create local duplicates.
13. **ARIA: interactive elements must not be children of role="switch":** Use sibling pattern.
14. **ProfilePanel: confirm button must use onMouseDown, not onClick:** onClick fires AFTER onBlur.
15. **All number inputs must have step={1}:** PoE2 mod values are always integers.
16. **Russian е/ё dialect in classifier patterns:** Always use `[её]` in regex patterns for words that can be spelled with ё.
17. **CategoryControlPanel priorityFilter/setPriorityFilter are optional:** Pages without priority tiers must NOT pass these props.
18. **Level headers MUST be `block`, never `inline-block`:** Prevents header concatenation on same line.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (576)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
