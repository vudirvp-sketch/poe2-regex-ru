# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 67 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (540/540 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Jewel heuristic all 9 mismatches fixed (P2 — DONE)** — Heuristic accuracy improved from ~96% to 100% vs ETL ground truth. Root causes and fixes:

   - **Typo: кинджал→кинжал** — "кинджал" (with д) doesn't match real Russian "кинжал" (dagger). Fixed in all SHARED_OVERRIDE + EMERALD_SCORES patterns.
   - **Shield defence override too broad** — `/увеличен.*уклонен(?!.*брон)/` matched shield defence because "брони" appears BEFORE "уклонения". Added `(?!.*от щит)` to exclude shield defence signature.
   - **Minion resist lookbehind** — `/к сопротивлению (хаос|...)(?!.*приспешник)/` missed "Приспешники" before the resist text. Replaced with `/(?<!приспешник.*)к сопротивлению/` using JS lookbehind.
   - **ES threshold narrowing** — `/максимум.*энергетическ.*щит/` caught "порог от максимума ES" (Sapphire-specific). Narrowed to `/увеличен.*максимум.*энергетическ.*щит/`.
   - **Triple-ailment exclusion** — `/длительн.*(поджог.*шок|...)/` caught "поджог, шок и охлаждение" (Emerald-specific). Added `(?!.*охлажден)` negative lookahead.
   - **Mark spell scoring boost** — Emerald=3, Sapphire=3 tie on mark spell speed. Boosted Emerald mark pattern from w=3 to w=5; added `(?!.*мет)` to Sapphire `скорост.*сотворени.*чар`.
   - **Conditional stun threshold** — Ruby generic "оглушен" tied with Emerald specific. Boosted Emerald conditional pattern from w=3 to w=5.
   - **Banner е/ё dialect** — Patterns used "знамён" (ё) but displayText has "знамен" (е). Changed to `знам[её]н`.
   - **Dagger damage override missing** — Added `/увеличен.*урона.*кинжал/` to SHARED_OVERRIDE.
   - **Shield defence scoring boost** — Increased Ruby shield defence pattern from w=4 to w=5 for better margin.

2. **45 unit tests added for mod-classifier.ts** — New test file `tests/shared/mod-classifier.test.ts` covering:
   - classifyJewelType heuristic (30 tests: all 9 former mismatches + key positive cases)
   - classifyByTags (5 tests)
   - classifyByText (4 tests)
   - classifyWaystoneSentiment (3 tests)
   - classifyTabletType (4 tests)

3. **Documentation updated** — AGENT_NAVIGATION.md v67.0, новый_план.md v10.0, worklog updated.

**Files changed this session:**
- `src/shared/mod-classifier.ts` — Fixed 9 mismatches, added dagger damage override, fixed typo, scoring boosts, dialect handling
- `tests/shared/mod-classifier.test.ts` — NEW: 45 unit tests
- `AGENT_NAVIGATION.md` — v67.0: moved jewel heuristic to RESOLVED, test count 495→540
- `новый_план.md` — v10.0: marked P2 as completed
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Browser functional testing of VirtualizedModList (scroll, search, chip clicks, per-token ranges, dual-slot ranges, jewel type sub-headers) — NEEDS HUMAN
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
20. **Russian е/ё dialect in classifier patterns:** Always use `[её]` in regex patterns for words that can be spelled with ё (e.g., `знам[её]н`, `вс[её]`).

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (540)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
