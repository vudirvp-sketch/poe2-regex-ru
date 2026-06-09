# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 81 — 2026-06-09)

**Build:** `pnpm build` passes, `npx vitest run` passes (663/663 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Per-chip range propagation fix** — `buildAstFromSelections` now propagates `perTokenRanges` from the first ranged member of a family group to ALL other members sharing the same `familyKey`. Previously, only `firstRangedMember.id` got the range override, causing other tokens in the same family to become orphaned LITERAL nodes, producing duplicate quoted groups like `"(1[5-9]|2[0-4]).*области путевых камней" "области путевых камней"`.
2. **anchorEnd detection expanded** — Changed `numberFollowedByPercent` regex from `/^[\+]?##%/` to `/##?%/`. Now detects `#%` (values-only tokens like "На #% больше...") AND `##%` (ranged tokens) anywhere in the template, not just at the start. Enables `%` suffix anchoring for waystone mods where the number is not at position 0 but IS followed by `%`.
3. **FilterChip overflow fix (v2)** — Removed `overflow: hidden` from chip containers (which clipped chips). Added `chip-with-range` CSS class with `flex-basis: 100%` to force selected chips with range inputs onto their own line, preventing overlap with adjacent chips.

**Files changed this session:**
- `src/ui/hooks/useCategoryPage.ts` — Per-chip range propagation + anchorEnd detection fix
- `src/ui/components/FilterChip.tsx` — Added `chip-with-range` class when range inputs visible
- `src/index.css` — Removed `overflow: hidden`, added `chip-with-range` full-width rule
- `docs/ARCHITECTURE.md` — v42: bug fix log + anchorEnd documentation update
- `AGENT_NAVIGATION.md` — v83: anchorEnd detection updated, TODO updated
- `новый_план.md` — v22: Session 81 entry
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing — verify all tabs, per-chip range produces single RANGE node, `%` suffix anchor works in-game for waystone "На #% больше..." mods
- ⬜ Priority tier filter testing — S/A/S+A toggle on ring/amulet/belt/waystone/tablet
- ⬜ In-game testing — verify `"(1[5-9]|2[0-4])%.*области путевых камней"` matches waystone items
- ⬜ +## non-% mods range notation FP — no current solution, may accept as known limitation

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`##` from template in regex:** Template placeholders MUST NOT appear in final regexes.
3. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
4. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block.
5. **`()` in regex = PoE2 grouping:** `containsPoE2Grouping()` filters at generation time.
6. **Negate syntax `"!X"` only:** `!"X"` does NOT work — `!` must be inside quotes.
7. **Word truncation = trailing substring only:** Mid-word extraction does NOT work.
8. **`^` anchor is reliable for mod block start:** Verified Phase 9b. Only use when number is at position 0 (rawTextTemplate starts with `##`). NOT for mods with `prefix` or `+`-prefixed templates.
9. **`%` suffix anchor prevents FP for +##% mods:** Verified Phase 9c. Use when anchorStart=false and template has `##%`. ⚠️ FN risk on items where actual roll has range notation.
10. **regexExclude format must be locale-object:** Always `{ru: [...]}` not plain array.
11. **regexPrefixContext format must be locale-object:** Always `{ru: "..."}` not plain string.
12. **OR-suffix RANGE must wrap `|` in `()`:** Without this, `".*огню|холоду"` parses wrong.
13. **VendorProperty interface is ONLY in `@data/vendor-properties`:** Never create local duplicates.
14. **ARIA: interactive elements must not be children of role="switch":** Use sibling pattern.
15. **ProfilePanel: confirm button must use onMouseDown, not onClick:** onClick fires AFTER onBlur.
16. **All number inputs must have step={1}:** PoE2 mod values are always integers.
17. **Russian е/ё dialect in classifier patterns:** Always use `[её]` in regex patterns for words that can be spelled with ё.
18. **CategoryControlPanel priorityFilter/setPriorityFilter are optional:** Pages without priority tiers must NOT pass these props.
19. **Level headers MUST be `block`, never `inline-block`:** Prevents header concatenation on same line.
20. **anchorEnd NOT used for ##% mods (tablets/waystones):** `^` is sufficient and doesn't have FN risk. `%` has FN risk on items with range notation on actual roll. Exception: `%` IS used for `#%` mods where number is NOT at position 0 (e.g., "На #% больше...") because `^` can't be used and `%` prevents FP from range notation.
21. **Values-only tokens MUST be treated as ranged:** Tokens with `values[]` but `ranges: []` (single-# template like "На #% больше...") need numeric filtering. Check `token.ranges.length > 0 || token.values.length > 0`.
22. **Per-chip range MUST propagate to all family members:** `buildAstFromSelections` propagates `perTokenRanges` from first ranged member to all others with same `familyKey`. Without this, only one token gets the range override, others become orphaned LITERALs producing duplicate quoted groups.

## Build & Run Commands

```bash
pnpm install --dir /home/z/my-project/poe2-regex-ru  # Install dependencies
pnpm build                       # Production build
npx vitest run --root /home/z/my-project/poe2-regex-ru  # Run all tests (663)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
