# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 39 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (437/437 tests)
**Oracle:** FP=3715, FN=0 in generated JSON files. Most FP are family-tier FP (by design).

**Key Changes This Session (Phase 7 In-Game Verification):**

1. **CRITICAL: `.*` does NOT cross mod/implicit/property boundaries** — verified in-game.
   - Tests 2.1, 2.4, 3.1, 7.3, 9.3 all negative — `.*` restricted to single block
   - AND (`"X" "Y"`) DOES cross blocks — tests 2.3, 3.3 positive

2. **Block-based matching model implemented** — `matchPoE2RegexItem()` in poe2-regex-matcher.ts
   - Each mod, implicit, property, name, type, state text = separate searchable block
   - `getItemSearchBlocks()` returns array of blocks
   - `matchPoE2RegexItem()` checks each quoted group against each block independently
   - Negation `!X` is item-wide (excludes if X found in ANY block)

3. **Description/tooltip text is NOT indexed** — verified in-game (tests 1.6, 7.2, 12.2)
   - Added `description` field to `GameItemText` interface
   - Moved description text from `additional` to `description` in test items
   - `getItemSearchBlocks()` and `getItemSearchText()` exclude `description`

4. **`?` (optional) does NOT work** — verified in-game (test 13.1)

5. **`(` is literal when unmatched** — verified in-game (test 10.3)

6. **437 tests pass** — 28 new block-based tests + updated hypothesis expectations

**NOT YET DONE:**
- ⬜ Simplify prefix anchoring (less critical now that cross-mod FP doesn't exist)
- ⬜ Re-run ETL with updated matcher model
- ⬜ Fix tablet "использ" suffix in generated data (replace with "зарядов")
- ⬜ Phase 8: Cross-family FP reduction using block-based model

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`()` in regex = PoE2 grouping:** Regexes MUST NOT contain literal `(...)` — PoE2 interprets as grouping. Unmatched `(` may be literal.
3. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes.
4. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
5. **Description text not indexed:** Tooltip text like "Можно использовать в Машине картоходца" is NOT searchable — verified in-game.
6. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block. Use AND for cross-block search.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (437)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL with Oracle validation
pnpm analyze-fn                  # Analyze FN cases per category
pnpm optimize                    # Run iterative optimizer on generated JSON
pnpm optimize:dry                # Dry-run optimizer with verbose output
pnpm dev                         # Development server
```
