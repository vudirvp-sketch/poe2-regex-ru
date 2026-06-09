# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 78 — 2026-06-09)

**Build:** `pnpm build` passes, `npx vitest run` passes (640/640 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Phase 9b: `^` anchor verified in-game** — `"^(2[7-9]|30).*откладывания наград"` highlights only 27% and 30% items. `^` reliably anchors to start of mod block. Range notation FP eliminated for tablet/waystone mods.
2. **`anchorStart` flag on RANGE AST node** — New optional `anchorStart?: boolean` field. Set when `rawTextTemplate` starts with `##` (number at position 0 of mod block). Compiler adds `^` before number pattern when `anchorStart=true` and no `prefix` is set.
3. **Compiler: `^` generation** — Three compilation paths updated: enumerated range, ≥min, ≤max. AND fallback preserves `anchorStart` on both children. Prefix presence suppresses `^`.
4. **AST builder: `numberAtStart` detection** — `useCategoryPage.ts` checks `/^##/` on `rawTextTemplate[locale]` for tokens in each range group.
5. **14 new tests** — Compiler (6), matcher (8) in `phase-9b-anchor-start.test.ts`. Total: 640 tests.

**Files changed this session:**
- `src/shared/types.ts` — Added `anchorStart?: boolean` to RANGE AST node
- `src/core/ast.ts` — Updated `range()` builder with `anchorStart` parameter
- `src/core/compiler.ts` — `^` generation for enumerated, ≥min, ≤max ranges; `anchorStart` propagation in normalizeAst
- `src/ui/hooks/useCategoryPage.ts` — `numberAtStart` detection from `rawTextTemplate`
- `tests/core/compiler.test.ts` — 6 new anchorStart tests
- `tests/core/phase-9b-anchor-start.test.ts` — 8 new matcher tests (new file)
- `docs/ARCHITECTURE.md` — v39: §5 updated (^ reliable), §7 updated (anchorStart), bug fix log
- `docs/IN_GAME_TESTS.md` — Phase 9b results added
- `новый_план.md` — v19: P3 done, P4 suffix anchoring
- `worklog.md` — This update
- `AGENT_NAVIGATION.md` — Updated

**NOT YET DONE (next iteration):**
- ⬜ Suffix anchoring investigation — test `"(2[7-9]|30)%.*suffix"` in-game (P4)
- ⬜ Browser functional testing — verify all tabs, range warnings, visual hierarchy
- ⬜ Priority tier filter testing — S/A/S+A toggle on ring/amulet/belt/waystone/tablet
- ⬐ Accessory range notation FP — `+`-prefix mods may still have FP (harder to fix without suffix anchoring)

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
npx vitest run --root .          # Run all tests (640)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
