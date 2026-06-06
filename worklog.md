# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 31 — 2026-06-06)

**Build:** `pnpm build` passes, `npx vitest run --root .` passes (213/213 tests)

**Key Changes This Session:**

1. **`\d` → `[0-9]`** in `src/core/number-regex.ts` — Safer PoE2 regex output. All 213 tests updated.
2. **jewel-desecrated added to STRICT_CATEGORIES** in `scripts/etl/compute-regex.ts` — MIN_REGEX_LEN_STRICT raised from 5 to 10. Short regexes like "молнии" (6), "холоду" (6), "Бездны" (6) will get longer, more specific alternatives after ETL re-run.
3. **Regex analysis script** `scripts/analyze-regexes.ts` — Finds 440 short regexes (<10 chars), 4002 cross-category conflicts, 1 within-category ambiguity. Report saved to `регис/analysis-report.md`.
4. **IN_GAME_TESTS.md rewritten** — Now hypothesis-based tests (Groups A-F) instead of random "does this word match" tests.
5. **Documentation cleaned** — AGENT_NAVIGATION.md v28, worklog.md trimmed, новый_план.md updated.

**NOT YET DONE (needs ETL re-run):** The `public/generated/jewel-desecrated.json` still has old short regexes. After `pnpm etl` (needs network), they'll be regenerated with MIN=10 constraint.

---

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
4. **FilterStoreApi type mismatch:** VendorPage must wrap Zustand store in FilterStoreApi adapter
5. **Number boundary:** `[4-9].` matches `6%` in PoE2 — known limitation, use prefix anchoring
6. **hasMultiPlaceholder missing in tests:** Always include `hasMultiPlaceholder: false` in test helpers

## Build & Run Commands

```bash
pnpm install                     # Install dependencies
pnpm build                       # Production build
npx vitest run --root .          # Run all tests (213)
pnpm etl                         # Run ETL pipeline (needs network or .etl-cache/)
npx tsx scripts/analyze-regexes.ts  # Analyze regex quality
pnpm dev                         # Development server
```
