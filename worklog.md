# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 35 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (323/323 tests)
**Oracle:** FP=1119, FN=4 (was FN=73 at start of session)

**Key Changes This Session:**

1. **Фаза 4+6: Интеграция DP/диалект в ETL** — `compute-optimizations.ts` v3:
   - Phase A: Family-based grouping (unchanged)
   - Phase B: `batchDPFactorize()` replaces cross-family LCS algorithm
   - Phase C: `applyDialectOptimizations()` applied to all optimization entries
   - `run-etl.ts` Step 3b: `applyDialectOptimizations()` on individual regexes

2. **FN Bug Fixes (73 → 4):**
   - `regexMatchesRawText()` — validates regex via PoE2 engine (`matchQuotedGroup`), catches `()` grouping and `##` template artifacts
   - `substringSearchAvoidingParens()` — finds unique substrings avoiding `(...)` which PoE2 treats as grouping
   - Broad suffix fallback — uses template suffix even if not unique (broad match that WORKS > specific match that DOESN'T)
   - Template exclusion — `getAllTexts` template excluded from substring search fallback (prevents `##` in regexes)
   - 5 new tests in `compute-optimizations.test.ts` (3 → 8)

**NOT YET DONE:**
- Фаза 5: Итеративный цикл оптимизации
- Фаза 7: Игровые тесты
- 4 remaining waystone FN (strict category — all unique substrings contain `(num—num)`)

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`()` in regex = PoE2 grouping:** Regexes MUST NOT contain literal `(...)` — PoE2 interprets as grouping, not literal parens. Use `regexMatchesRawText()` to verify.
3. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes — `##` doesn't exist in rawText. Use template exclusion in substring search.
4. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
5. **Number regex `.` bug:** FIXED — `.` was matching any char, now `[0-9]`
6. **hasMultiPlaceholder missing in tests:** Always include `hasMultiPlaceholder: false` in test helpers
7. **Dual-stat FN:** For multi-placeholder mods, joined template suffix may not appear in rawText because numbers interrupt segments. Use `regexMatchesRawText()` to verify.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (323)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL with Oracle validation
npx tsx scripts/analyze-fn.ts    # Analyze FN cases per category
pnpm dev                         # Development server
```
