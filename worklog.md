# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 44 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (455/455 tests)
**Oracle:** Block-based: pending re-run after P0 fix. Previous: 1376/1573 valid, 194 cross-family FP, 924 family-tier FP

**Key Changes This Session (P0 fix — `()` in regexes):**

1. **Root cause:** `compute-regex.ts` generated candidate substrings containing `(` or `)`. PoE2 interprets these as grouping, truncating the regex (e.g. `—6) к с` → PoE2 reads `—6`). The `regexMatchesRawText()` validation didn't catch this because the truncated regex still matched the rawText.

2. **Fix: Added `containsPoE2Grouping()` helper** — checks for `(` or `)` in candidate strings. Applied as a pre-filter at ALL generation points:
   - `substringSearchFallback()` — primary source of `()` bugs (line ~652)
   - `findShortestUniqueSuffix()` — word-trimming loop (line ~344)
   - Strategy 1b-alt — added `containsPoE2Grouping()` + `regexMatchesRawText()` check (line ~525)
   - Broad suffix fallback — added `containsPoE2Grouping()` check (line ~588)

3. **Removed `substringSearchAvoidingParens()`** — its logic is now built into `substringSearchFallback()`, making the separate function redundant. Simpler code, same result.

4. **Added 3 new tests** for `()` prevention (total: 455 tests, all pass).

5. **Affected regexes:** 51 across all categories had `()` before fix. After ETL re-run, expect 0.

**NOT YET DONE:**
- ⬜ Run ETL to regenerate `public/generated/*.json` with fixed regexes
- ⬜ Re-run `--validate-item` Oracle to measure improvement
- ⬜ Fix `к силе` cross-family FP — matches composite mods
- ⬜ jewel-desecrated 16 cross-family FP — needs investigation
- ⬜ Add tests for `validateGeneratedRegexesItem()`

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes.
3. **`?` does NOT work in PoE2:** Do NOT use `?` in generated regexes — verified in-game.
4. **Description text not indexed:** Tooltip text like "Можно использовать в Машине картоходца" is NOT searchable — verified in-game.
5. **`.*` does NOT cross block boundaries:** Each mod/implicit/property is a separate block. Use AND for cross-block search.
6. **Waystone implicits are NOT affixes:** Properties like "Уровень путевого камня", "размер групп", "количество предметов" are base item properties, not from the mod system. Not in ETL data. Verified.
7. **`()` in regex = PoE2 grouping (FIXED Session 44):** `containsPoE2Grouping()` now filters `(` and `)` at generation time. No more `—6) к с` bugs.

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
