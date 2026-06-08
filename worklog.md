# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 72 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (576/576 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Build fix — CategoryControlPanelProps** — Made `priorityFilter` and `setPriorityFilter` optional props (were required but removed from JewelPage/RelicPage/VendorPage in Session 71). Added default `'all'` for `priorityFilter` and `() => {}` fallback for `setPriorityFilter`. This was the root cause of the failing GitHub Actions deploy.

**Files changed this session:**
- `src/ui/components/CategoryControlPanel.tsx` — Made `priorityFilter`/`setPriorityFilter` optional, added defaults and safe callback

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of priority tier filter — NEEDS HUMAN
- ⬜ Validate priority tier classifications against live trade data
- ⬜ Mobile-specific testing — NEEDS REAL DEVICE

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`##` from template in regex:** Template placeholders MUST NOT appear in final regexes.
3. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
4. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block.
5. **`()` in regex = PoE2 grouping:** `containsPoE2Grouping()` filters at generation time.
6. **Negate syntax `"!X"` only:** `!"X"` does NOT work — `!` must be inside quotes.
7. **Word truncation = trailing substring only:** Mid-word extraction does NOT work.
8. **i18n overrides cause cross-family FP:** `repairCrossFamilyFP()` + `regexPrefixContext` fix this.
9. **regexExclude format must be locale-object:** Always `{ru: [...]}` not plain array.
10. **regexPrefixContext format must be locale-object:** Always `{ru: "..."}` not plain string.
11. **Multi-line sub-lines may share text with standalone mods:** Use `—` exclude/context to disambiguate.
12. **OR-suffix RANGE must wrap `|` in `()`:** Without this, `".*огню|холоду"` parses wrong.
13. **VendorProperty interface is ONLY in `@data/vendor-properties`:** Never create local duplicates.
14. **ARIA: interactive elements must not be children of role="switch":** Use sibling pattern.
15. **ProfilePanel: confirm button must use onMouseDown, not onClick:** onClick fires AFTER onBlur.
16. **All number inputs must have step={1}:** PoE2 mod values are always integers; fractional input produces invalid regex.
17. **Russian е/ё dialect in classifier patterns:** Always use `[её]` in regex patterns for words that can be spelled with ё.
18. **dp-factorizer/trie-factorizer are ETL-only:** Not imported by runtime code, but essential for ETL scripts. Do NOT delete.
19. **CategoryControlPanel priorityFilter/setPriorityFilter are optional:** Pages without priority tiers (jewel/relic/vendor) must NOT pass these props. Show toggle only when `showPriorityFilter` is set.

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
