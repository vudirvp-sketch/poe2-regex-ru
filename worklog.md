# PoE2 Regex RU — Worklog

> Current state only. Historical details are in git history.

---

## Current State (Session 69 — 2026-06-08)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (543/543 tests)
**Oracle:** 1823/1823 valid, **0 cross-family FP**, 1309 family-tier FP (by design)
**Jewel heuristic:** 100% accuracy (193/193) vs ETL ground truth

**Key Changes This Session:**

1. **Affix popularity research** — Conducted web research across Maxroll, Mobalytics, poe2db, Reddit, U4GM, MTMMO, AOEAH. Created hierarchy of popular affixes (Tier S/A/B/C) for: Waystones, Tablets, Rings, Amulets, Belts.

2. **New file: `регис/Иерархия популярности аффиксов.md`** — Structured reference document with priority tiers for each item category. Key findings:
   - Waystones: Quantity > Rarity > Pack Size (prefixes = good, suffixes = dangerous but needed for stone sustain)
   - Tablets: Quantity of Items = most valuable mod; Ritual extra reroll = most expensive suffix in game
   - Rings/Amulets: +Level Skills = #1 priority, Spirit, All Res, ES
   - Belts: Max Life 150+ = absolute #1, All Res, Flask Life Recovery

3. **Documentation updated** — AGENT_NAVIGATION.md v69, новый_план.md v12, worklog.md.

4. **Next iteration plan** — P0: Integrate priority tiers into UI (priorityTier field, sorting, visual badges, filter by tier).

**Files changed this session:**
- `регис/Иерархия популярности аффиксов.md` — NEW: affix popularity research
- `AGENT_NAVIGATION.md` — v69: added affix hierarchy reference, updated TODO section
- `новый_план.md` — v12: added Session 69, added P0 integration task
- `worklog.md` — This update

**NOT YET DONE (next iteration):**
- ⬜ Integrate affix priority tiers into UI (priorityTier field on GameToken, default sort by tier, visual badges on FilterChip, filter by tier in CategoryControlPanel)
- ⬜ Browser functional testing of VirtualizedModList — NEEDS HUMAN
- ⬜ Mobile-specific testing — NEEDS REAL DEVICE

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
20. **Russian е/ё dialect in classifier patterns:** Always use `[её]` in regex patterns for words that can be spelled with ё.
21. **dp-factorizer/trie-factorizer are ETL-only:** Not imported by runtime code, but essential for ETL scripts. Do NOT delete.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (543)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
