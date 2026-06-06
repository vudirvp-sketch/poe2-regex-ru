# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 41 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (452/452 tests)
**Oracle:** FP=3715, FN=0 in generated JSON files. Most FP are family-tier FP (by design). Phase 8 Oracle now categorizes FP.

**Key Changes This Session (Phase 8 — Cross-family FP Reduction):**

1. **jewel-corrupted → STRICT_CATEGORIES_MIN_LEN** — Added `'jewel-corrupted': 7` to `STRICT_CATEGORIES_MIN_LEN` in `compute-regex.ts`. Avg regex len was 7.4, short regexes like "может" (5), "ельзя" (5), "нитет" (5) will be forced to be longer after ETL re-run.

2. **validateRegexItem() — Block-based Oracle** — New function in `regex-oracle.ts` that uses `matchPoE2RegexItem()` for accurate in-game behavior simulation. Each mod/implicit/property is a separate block, `.*` does NOT cross block boundaries. Supports `GameItemText[]` for target/exclude/allItems.

3. **FP Categorization (Phase 8)** — Extended `OracleResult` with:
   - `familyTierFP: string[]` — FP from same familyKey (by design, not a bug)
   - `crossFamilyFP: string[]` — FP from different familyKey (real bugs)
   - `valid = true` when NO cross-family FP and no FN (family-tier FP are acceptable)
   - Both `validateRegex()` and `validateRegexItem()` support FP categorization via optional `familyKeyMap` / `familyKeyById` parameters

4. **batchValidateItem()** — New batch validation function using block-based matching. Reports `crossFamilyFPCount` and `familyTierFPOnlyCount` in the report.

5. **Tests** — 15 new Oracle tests covering FP categorization, block-based validation, and batch item validation. Total: 452 tests (up from 437).

**NOT YET DONE:**
- ⬜ Re-run ETL (`pnpm etl`) to regenerate JSON with simplified prefix + jewel-corrupted STRICT
- ⬜ Remove deprecated `getItemSearchText()` — ~90 calls in tests. Replace with `getItemSearchBlocks() + matchPoE2RegexItem()`. This is a large refactoring — better in a separate iteration.
- ⬜ After ETL re-run: verify jewel-corrupted regexes are longer and don't contain `()` patterns
- ⬜ After ETL re-run: check if waystone implicits (level, pack size, quantity, rarity, etc.) appear in data — they are NOT affixes, they are base item properties
- ⬜ H4 note: waystone implicit properties (Уровень путевого камня, размер групп, количество предметов, etc.) are NOT in ETL data — they're base item properties handled by UI, not by the mod system

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
