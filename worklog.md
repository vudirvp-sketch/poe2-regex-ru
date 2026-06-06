# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 42 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (452/452 tests)
**Oracle:** FP=3715, FN=0 in generated JSON files. Most FP are family-tier FP (by design). Phase 8 Oracle now categorizes FP.

**Key Changes This Session (getItemSearchText Removal):**

1. **Deleted `getItemSearchText()` from `poe2-regex-matcher.ts`** — The deprecated function that concatenated all blocks into one string (allowing `.*` to cross block boundaries, which does NOT happen in-game) is now removed.

2. **Replaced ~81 test calls** across two test files:
   - `poe2-regex-matcher.test.ts` (Vendor section): 13 calls → `matchPoE2RegexItem(regex, item)` (block-based)
   - `hypothesis-patterns.test.ts` (H1-H9 + BONUS): ~68 calls replaced:
     - Simple substring/AND/negation → `matchPoE2RegexItem(regex, item)` (same behavior, block-accurate)
     - `.*` within same block → `matchPoE2RegexItem(regex, item)` (same result, within-block `.*` works identically)
     - Text content assertions (`toContain`) → `getItemSearchBlocks(item).join('\n')`
     - **H4 cross-block `.*` test**: `matchPoE2Regex('"([1-9][0-9]|...).*зарядов"', text)` was `true` (concatenated text allowed cross-block `.*`) → now `matchPoE2RegexItem(...)` = `false` (correct: `.*` does NOT cross from mod block to implicit block)

3. **Cleaned up unused imports** — Removed `matchQuotedGroup`, `testRegex`, `and`, `or`, `exclude`, `literal` from hypothesis test imports. Fixed `amulet2` unused variable.

**NOT YET DONE:**
- ⬜ Re-run ETL (`pnpm etl`) to regenerate JSON with simplified prefix + jewel-corrupted STRICT
- ⬜ After ETL re-run: verify jewel-corrupted regexes are ≥7 chars and don't contain `()` patterns
- ⬜ After ETL re-run: check if waystone implicits (level, pack size, quantity, rarity, etc.) appear in data — they are NOT affixes, they are base item properties
- ⬜ Integrate `batchValidateItem()` in ETL pipeline — Add `--validate-item` flag in `run-etl.ts`

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`()` in regex = PoE2 grouping:** Regexes MUST NOT contain literal `(...)` — PoE2 interprets as grouping. Unmatched `(` may be literal.
3. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes.
4. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
5. **Description text not indexed:** Tooltip text like "Можно использовать в Машине картоходца" is NOT searchable — verified in-game.
6. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block. Use AND for cross-block search.
7. **Waystone implicits are NOT affixes:** Properties like "Уровень путевого камня", "размер групп", "количество предметов" are base item properties, not from the mod system. Not in ETL data.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (452)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL with Oracle validation
pnpm analyze-fn                  # Analyze FN cases per category
pnpm optimize                    # Run iterative optimizer on generated JSON
pnpm optimize:dry                # Dry-run optimizer with verbose output
pnpm dev                         # Development server
```
