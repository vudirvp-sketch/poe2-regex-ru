# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 73 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (576/576 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Build fix — ModSubGroup.borderLClass** — Added `borderLClass` field to `ModSubGroup` interface and populated it in all `classifyGroups()` branches. This was the TS2551 error blocking the GitHub Actions deploy (`Property 'borderLClass' does not exist on type 'ModSubGroup'`).
2. **Bug fix — First origin section hidden** — Removed `idx > 0 &&` guard that was hiding the Level 2 badge for the first origin section (Обычные). Now all origin sections display their badge header.
3. **Origin color scheme update** — Changed origin colors per new design spec:
   - Очернённые: green → purple
   - Осквернённые: red → orange
   - Сущность: amber → yellow
   - Разлом: purple → cyan

**Files changed this session:**
- `src/shared/mod-classifier.ts` — Added `borderLClass` to `ModSubGroup`; populated in all classifyGroups branches; updated `ORIGIN_SECTION_LABELS` colors
- `src/ui/components/ModList.tsx` — Fixed first origin section hidden by removing `idx > 0 &&` guard
- `docs/ARCHITECTURE.md` — Updated origin color table
- `AGENT_NAVIGATION.md` — Updated origin color mapping description
- `worklog.md` — Updated

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of priority tier filter — NEEDS HUMAN
- ⬜ Validate priority tier classifications against live trade data
- ⬜ Mobile-specific testing — NEEDS REAL DEVICE
- ⬜ Visual testing — Verify 3-level badge rendering across all category tabs (especially new origin colors)

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
20. **ModSubGroup.borderLClass is required:** All `classifyGroups()` branches must populate `borderLClass`. Level 2 (origin) uses `ORIGIN_SECTION_LABELS[origin].borderLClass`; Level 3 (semantic/sentiment/tablet/jewel-type) uses `''`.

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
