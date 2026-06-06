# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 38 — 2026-06-07)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (409/409 tests)
**Oracle:** FP=3715, FN=0 in generated JSON files. Most FP are family-tier FP (by design).

**Key Changes This Session:**

1. **Phase 7: Hypothesis-driven test suite** — 86 new tests in `tests/core/hypothesis-patterns.test.ts`
   - H1: Fractional numbers (decimal point ambiguity) — ✅ all pass
   - H2: Negative values in mod text — ✅ all pass
   - H3: Cross-line single mod (Разрушительный) — ✅ all pass
   - H4: Tablet "зарядов" vs "использ" — ⚠️ CRITICAL FINDING
   - H5: Implicit property searchability — ✅ all pass (needs in-game verification)
   - H6: Prefix/suffix name non-searchability — ✅ all pass
   - H7: "всем стихиям" vs individual resistances — ✅ all pass
   - H8: Inverted number ranges (50→40) — ✅ all pass
   - H9: Full tooltip searchability — ✅ all pass (needs in-game verification)
   - Bonus: Dual-number mods, cross-item AND search, edge cases

2. **Critical finding (H4):** "использ" as tablet uses suffix matches "использовать" in item DESCRIPTION, not the charges line. Also, the charges number appears AFTER the word "зарядов", creating a directional `.*` problem. Needs in-game verification.

3. **Updated docs/IN_GAME_TESTS.md** — restructured with groups A-L, prioritized by criticality.

**NOT YET DONE:**
- ⬜ In-game verification of all H-group hypotheses (G-L in IN_GAME_TESTS.md)
- ⬜ Fix tablet "зарядов" suffix if confirmed in-game
- ⬜ Фаза 8: Cross-family FP reduction

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **`()` in regex = PoE2 grouping:** Regexes MUST NOT contain literal `(...)` — PoE2 interprets as grouping, not literal parens.
3. **`##` from template in regex:** Template placeholders (`##`) MUST NOT appear in final regexes.
4. **hasMultiPlaceholder missing in tests:** Always include `hasMultiPlaceholder: false` in test helpers
5. **MIN_REGEX_LEN_STRICT vs parens:** Waystone mods with `(num—num)` patterns can't have regexes ≥10 chars without parens.
6. **Optimizer suffix-shorten too aggressive:** Fixed with per-category minimum enforcement.
7. **"использ" matches description, not charges:** Tablet uses suffix "использ" matches "использовать" in description text. Actual charges word is "зарядов". Needs in-game verification.

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (409)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
pnpm etl -- --validate           # Run ETL with Oracle validation
pnpm analyze-fn                  # Analyze FN cases per category
pnpm optimize                    # Run iterative optimizer on generated JSON
pnpm optimize:dry                # Dry-run optimizer with verbose output
pnpm dev                         # Development server
```
