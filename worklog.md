# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 36 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (323/323 tests)
**Oracle:** FP=7963, FN=73 in **stale** generated JSON files. Code fixes should reduce FN to ~0-4 after ETL re-run.

**Key Changes This Session:**

1. **Фаза 5: Итеративный оптимизатор** — `scripts/etl/iterative-optimizer.ts`:
   - Strategy 1: FN-repair (broadSuffix, substring search)
   - Strategy 2: Dialect optimization (`[её]`, `[юя]`, `ь?`)
   - Strategy 3: FP-reduce (lengthen regex to reduce false positives)
   - Strategy 4: Suffix-shorten (shorten regex when 0 FP)
   - Table re-optimization via `batchDPFactorize()`
   - Flags: `--max-iterations N`, `--dry-run`, `--verbose`

2. **Waystone FN fix** — `STRICT_CATEGORIES_MIN_LEN` replaces `STRICT_CATEGORIES`:
   - waystone: 10 → 7 (allows paren-free regexes ≥7 chars)
   - waystone-desecrated: 10 → 7
   - tablet: 10 (unchanged)
   - jewel-desecrated: 10 (unchanged)

3. **TypeScript fixes:**
   - `compute-optimizations.ts`: unused `longestCommonSubstring` marked with `@ts-expect-error`
   - `run-etl.ts`: unused `id` in destructuring → `[, rr]`
   - `iterative-optimizer.ts`: new file, compiles clean

4. **New scripts in package.json:**
   - `pnpm analyze-fn` — FN/FP analysis
   - `pnpm optimize` — run iterative optimizer
   - `pnpm optimize:dry` — dry-run with verbose output

5. **New file:** `scripts/analyze-fn.ts` — analyzes FN/FP per category using PoE2 matcher

**NOT YET DONE:**
- ⬜ ETL re-run to regenerate JSON files with code fixes (`pnpm etl -- --validate`)
- ⬜ Run iterative optimizer on fresh data (`pnpm optimize`)
- ⬜ Фаза 7: Игровые тесты
- ⬜ Фаза 8: Финальная полировка

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`()` in regex = PoE2 grouping:** Regexes MUST NOT contain literal `(...)` — PoE2 interprets as grouping, not literal parens. Use `regexMatchesRawText()` to verify.
3. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes — `##` doesn't exist in rawText. Use template exclusion in substring search.
4. **Number regex `.` bug:** FIXED — `.` was matching any char, now `[0-9]`
5. **hasMultiPlaceholder missing in tests:** Always include `hasMultiPlaceholder: false` in test helpers
6. **Dual-stat FN:** For multi-placeholder mods, joined template suffix may not appear in rawText because numbers interrupt segments. Use `regexMatchesRawText()` to verify.
7. **MIN_REGEX_LEN_STRICT vs parens:** Waystone mods with `(num—num)` patterns can't have regexes ≥10 chars without parens. Lowered to 7 for waystone categories.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (323)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL with Oracle validation
pnpm analyze-fn                  # Analyze FN cases per category
pnpm optimize                    # Run iterative optimizer on generated JSON
pnpm optimize:dry                # Dry-run optimizer with verbose output
pnpm dev                         # Development server
```
