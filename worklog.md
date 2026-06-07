# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 43 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (452/452 tests)
**Oracle:** Block-based: 1376/1573 valid, 194 cross-family FP, 924 family-tier FP

**Key Changes This Session (--validate-item):**

1. **Added `--validate-item` flag to `run-etl.ts`** — New `validateGeneratedRegexesItem()` function that uses `batchValidateItem()` from `regex-oracle.ts` for block-based Oracle validation. Unlike `--validate` (flat-text), this accurately simulates in-game behavior where `.*` does NOT cross block boundaries.

2. **Import added:** `batchValidateItem` from `regex-oracle.ts` + `GameItemText` type from `poe2-regex-matcher.ts`.

3. **Block-based validation results** (first run):
   - relic: 58/58 valid ✅
   - waystone: 93/97 (1 cross-family FP, 3 FN from `()` in regex)
   - waystone-desecrated: 16/17 (1 cross-family FP)
   - tablet: 70/75 (5 cross-family FP)
   - jewel: 178/193 (15 cross-family FP — many `()` bugs)
   - jewel-desecrated: 16/32 (16 cross-family FP)
   - jewel-corrupted: 9/10 (1 cross-family FP — `—6) к с` bug confirmed)
   - belt: 287/298 (11 cross-family FP)
   - ring: 317/366 (49 cross-family FP)
   - amulet: 332/427 (95 cross-family FP)

**NOT YET DONE:**
- ⬜ Fix `()` in regexes — ETL compute-regex generates `—6) к с` etc. PoE2 interprets `)` as groupClose, truncating the regex
- ⬜ Fix `к силе` cross-family FP — matches composite mods `+(9—15) к силе и интеллекту` etc.
- ⬜ jewel-desecrated 16 cross-family FP — needs investigation
- ⬜ Add tests for `validateGeneratedRegexesItem()`

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`()` in regex = PoE2 grouping:** Regexes MUST NOT contain literal `(...)` — PoE2 interprets as grouping. Unmatched `(` may be literal.
3. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes.
4. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
5. **Description text not indexed:** Tooltip text like "Можно использовать в Машине картоходца" is NOT searchable — verified in-game.
6. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block. Use AND for cross-block search.
7. **Waystone implicits are NOT affixes:** Properties like "Уровень путевого камня", "размер групп", "количество предметов" are base item properties, not from the mod system. Not in ETL data. Verified.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (452)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item      # Run ETL + block-based Oracle validation (accurate in-game sim)
pnpm analyze-fn                  # Analyze FN cases per category
pnpm optimize                    # Run iterative optimizer on generated JSON
pnpm optimize:dry                # Dry-run optimizer with verbose output
pnpm dev                         # Development server
```
