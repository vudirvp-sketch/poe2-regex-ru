# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 37 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (323/323 tests)
**Oracle:** FP=3715, FN=0 in generated JSON files (after `pnpm optimize`). Most FP are family-tier FP (by design).

**Key Changes This Session:**

1. **Fixed failing test** — `tablet.json` had 2 tokens with regex < MIN_REGEX_LEN=5:
   - `tablet.mod_efa81a`: regex "два" (3 chars) → "в два раза" (10 chars)
   - `tablet.mod_by2ufv`: regex "100%" (4 chars) → "вплоть" (6 chars)

2. **Fixed iterative-optimizer.ts** — `trySuffixShortening()` now respects per-category MIN_REGEX_LEN:
   - waystone/waystone-desecrated/tablet/jewel-desecrated: min 5 chars
   - other categories: min 3 chars (unchanged)
   - Prevents optimizer from shortening regexes below test thresholds

3. **Enhanced i18n-override system** — `applyI18nOverrides()` now supports explicit `regex` field:
   - If override includes `"regex": "..."`, it's applied directly (no recomputation)
   - Added regex overrides for `tablet.mod_efa81a` and `tablet.mod_by2ufv`

4. **GitHub Actions deploy fixed** — root cause was the test failure (not YAML). YAML syntax is valid.

**NOT YET DONE:**
- ⬜ Фаза 7: Игровые тесты — validate regexes in PoE2 client (see docs/IN_GAME_TESTS.md)
- ⬜ Фаза 8: Финальная полировка — further cross-family FP reduction, UI polish
- ⬜ Cross-family FP analysis — 90 true cross-family FP in amulet (not family-tier FP)

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`()` in regex = PoE2 grouping:** Regexes MUST NOT contain literal `(...)` — PoE2 interprets as grouping, not literal parens. Use `regexMatchesRawText()` to verify.
3. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes — `##` doesn't exist in rawText. Use template exclusion in substring search.
4. **Number regex `.` bug:** FIXED — `.` was matching any char, now `[0-9]`
5. **hasMultiPlaceholder missing in tests:** Always include `hasMultiPlaceholder: false` in test helpers
6. **Dual-stat FN:** For multi-placeholder mods, joined template suffix may not appear in rawText because numbers interrupt segments. Use `regexMatchesRawText()` to verify.
7. **MIN_REGEX_LEN_STRICT vs parens:** Waystone mods with `(num—num)` patterns can't have regexes ≥10 chars without parens. Lowered to 7 for waystone categories.
8. **Optimizer suffix-shorten too aggressive:** `trySuffixShortening()` could shorten regexes below MIN_REGEX_LEN. Fixed with per-category minimum enforcement.

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
