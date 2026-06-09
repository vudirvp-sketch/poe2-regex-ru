# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 80 — 2026-06-09)

**Build:** `pnpm build` passes, `npx vitest run` passes (663/663 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Values-only tokens now support numeric filtering** — `buildAstFromSelections` now checks `token.ranges.length > 0 || token.values.length > 0`. Waystone mods like "На #% больше находимых в области путевых камней" (which have `values: [15]` but `ranges: []`) now produce proper RANGE AST nodes with numeric filters instead of plain LITERAL suffixes.
2. **FilterChip overflow fix** — Added `maxWidth: '100%'`, `overflowWrap: 'break-word'` to chip container; `min-w-0 overflow-hidden` to switch element; CSS rules in `index.css` for overflow prevention in chip containers.
3. **"PoE2 Regex" duplication removed** — `home.title` changed to "Генератор поисковых строк", `home.subtitle` to "Для Path of Exile 2 — русский клиент". Sidebar subtitle dimmed. "PoE2 Regex" now appears only once (sidebar logo).
4. **Tab icons normalized** — Sidebar icons constrained to 28×28px with `maxHeight`/`maxWidth`, home card icons to 44×44px. Fixes relic (45×89) sticking out and belt (94×39)/vendor (93×77) appearing too small.

**Files changed this session:**
- `src/ui/hooks/useCategoryPage.ts` — Values-only token detection fix
- `src/ui/components/FilterChip.tsx` — Overflow prevention (maxWidth, overflowWrap, min-w-0)
- `src/ui/layout/Sidebar.tsx` — Icon size constraints (28×28), subtitle dimming
- `src/ui/pages/home/HomePage.tsx` — Icon size constraints (44×44), container height
- `src/shared/i18n.ts` — home.title, home.subtitle updated
- `src/index.css` — FilterChip overflow prevention rules
- `docs/ARCHITECTURE.md` — v41 bug fix log
- `AGENT_NAVIGATION.md` — v82: icon sizing updated, i18n conventions updated, TODO updated
- `новый_план.md` — v21: Session 80 entry
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing — verify all tabs, range warnings, visual hierarchy, waystone values-only numeric regex
- ⬜ Priority tier filter testing — S/A/S+A toggle on ring/amulet/belt/waystone/tablet
- ⬜ +## non-% mods range notation FP — no current solution, may accept as known limitation
- ⬜ Icon pre-normalization — square canvas for consistent pixel-perfect display

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
20. **anchorEnd NOT used for ##% mods (tablets/waystones):** `^` is sufficient and doesn't have FN risk. `%` has FN risk on items with range notation on actual roll.
21. **Values-only tokens MUST be treated as ranged:** Tokens with `values[]` but `ranges: []` (single-# template like "На #% больше...") need numeric filtering. Check `token.ranges.length > 0 || token.values.length > 0`.

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
