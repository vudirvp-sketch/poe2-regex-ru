# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 54 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (480/480 tests)
**Oracle:** Unchanged from Session 53 (2 cross-family FP accepted).

**Key Changes This Session:**

1. **Group M in-game tests VERIFIED** — All 8 tests pass in PoE2 (RU client). Key findings:
   - `|` inside `()` works correctly (M-02 = M-01, M-04 number ranges confirmed)
   - `\d` is supported in PoE2 (M-08, got 2 matches, not 0)
   - `!` + `|` = `!(A|B)` works (M-07, original expected count was wrong — R2 has "молнии" in another mod)
   - Number range patterns like `([3-9][0-9]|[0-9][0-9][0-9])` confirmed (M-04 + M-05 cross-validation)
   - Updated docs: ARCHITECTURE.md removed from "NOT supported", IN_GAME_TESTS.md replaced with verified results

2. **List virtualization for belt/ring/amulet** — New `VirtualizedModList` component using @tanstack/react-virtual (already in package.json). Flattens hierarchical structure into virtual rows (column headers, origin headers, sub-groups). Only visible rows rendered. Belt/Ring/Amulet pages now use VirtualizedModList instead of ModList.

3. **Multi-line mod handling investigation** — Identified root cause in `normalize.ts`:
   - ETL drops second sub-lines for most multi-line mods (e.g., "Разрушительный" loses "+к бонусу критического урона")
   - 4 waystone tokens incorrectly join 4 segments with ", " (akte8u, n81h8i, fzuqda, hzhrha)
   - Fix requires splitting `<br>` segments into separate tokens in normalize.ts
   - Updated normalize.ts comments to reflect correct understanding (each sub-line = separate searchable block)
   - Actual ETL fix deferred to next iteration (significant change requiring ETL re-run + test updates)

**Files changed this session:**
- `docs/IN_GAME_TESTS.md` — Group M replaced with verified in-game results
- `docs/ARCHITECTURE.md` — `|` inside `()` and `\d` confirmed, added "Verified in-game (Group M)" section
- `AGENT_NAVIGATION.md` — v54.0, M-group removed from MEDIUM, multi-line mod issue added
- `src/ui/components/VirtualizedModList.tsx` — NEW: virtualized mod list component
- `src/ui/pages/amulet/AmuletPage.tsx` — switched to VirtualizedModList
- `src/ui/pages/ring/RingPage.tsx` — switched to VirtualizedModList
- `src/ui/pages/belt/BeltPage.tsx` — switched to VirtualizedModList
- `scripts/etl/normalize.ts` — updated comments about multi-line mod handling
- `worklog.md` — this update

**NOT YET DONE (next iteration):**
- ⬜ Multi-line mod ETL fix — split `<br>` segments into separate tokens in normalize.ts
- ⬜ Re-run ETL after multi-line fix, validate all tokens
- ⬜ Verify VirtualizedModList in browser (functional testing)
- ⬜ Consider virtualization for jewel page (224 tokens, merged 3 JSONs)

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
13. **Phase A1 truncation only for entries without context/excludes:** Truncating entries with FP would break the context/exclude patching logic.
14. **Multi-line mods: ETL drops second sub-lines:** normalize.ts takes only first `<br>` segment. Fix requires splitting into separate tokens.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (480)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation
pnpm analyze-fn                  # Analyze FN/FP per category
pnpm optimize                    # Run iterative optimizer
pnpm optimize:dry                # Dry-run optimizer
pnpm dev                         # Development server
```
