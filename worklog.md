# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 79 — 2026-06-09)

**Build:** `pnpm build` passes, `npx vitest run` passes (663/663 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Phase 9c: `%` suffix anchor verified in-game** — `"(2[7-9]|30)%.*откладывания наград"` highlights only 27% and 30% items. `%` after number prevents FP from range notation numbers that are NOT followed by `%`.
2. **`anchorEnd` flag on RANGE AST node** — New optional `anchorEnd?: string` field. Set to `'%'` when `rawTextTemplate` matches `/^[\+]?##%/` AND `anchorStart=false`. Compiler inserts `anchorEnd` string between number pattern and `.*suffix`.
3. **Three-level FP prevention strategy** — Level 1: `^` anchor (##% mods), Level 2: `%` suffix anchor (+##% mods), Level 3: enumeration (≤50 values). Documented in ARCHITECTURE.md §7.
4. **23 new tests** — Compiler (7 anchorEnd), matcher (13 in phase-9c-anchor-end.test.ts), integration (3 in buildAstFromSelections.test.ts). Total: 663 tests.

**Files changed this session:**
- `src/shared/types.ts` — Added `anchorEnd?: string` to RANGE AST node
- `src/core/ast.ts` — Updated `range()` builder with `anchorEnd` parameter
- `src/core/compiler.ts` — `anchorEnd` insertion between number pattern and `.*suffix`; propagation in normalizeAst
- `src/ui/hooks/useCategoryPage.ts` — `numberFollowedByPercent` detection, `anchorEndValue` logic
- `tests/core/compiler.test.ts` — 7 new anchorEnd tests
- `tests/core/phase-9c-anchor-end.test.ts` — 13 new matcher tests (new file)
- `tests/ui/buildAstFromSelections.test.ts` — 3 new anchorEnd integration tests
- `docs/ARCHITECTURE.md` — v40: §5 updated (% suffix anchor), §7 updated (three-level strategy), bug fix log
- `docs/IN_GAME_TESTS.md` — Phase 9c results added, 9b-2 updated (verified ✅)
- `новый_план.md` — v20: P4 done, bug profile updated
- `worklog.md` — This update
- `AGENT_NAVIGATION.md` — v81: §22b added, test count updated, TODO updated

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing — verify all tabs, range warnings, visual hierarchy
- ⬜ Priority tier filter testing — S/A/S+A toggle on ring/amulet/belt/waystone/tablet
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
20. **anchorEnd NOT used for ##% mods (tablets/waystones):** `^` is sufficient and doesn't have FN risk. `%` has FN risk on items with range notation on actual roll.

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
