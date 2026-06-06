# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 29 — 2026-06-06)

**Build:** `npx vite build` passes, `npx vitest run` passes (213/213 tests)

**ETL Results:**

| Category | Tokens | Optimizations |
|----------|--------|---------------|
| waystone | 96 | 52 |
| waystone-desecrated | 16 | 4 |
| tablet | 75 | 363 |
| jewel | 193 | 1,466 |
| jewel-desecrated | 21 | 3 |
| jewel-corrupted | 10 | 0 |
| relic | 58 | 28 |
| belt | 298 | 231 |
| ring | 366 | 458 |
| amulet | 427 | 389 |
| **Total** | **1,560** | |

---

### Session 29 — Documentation Cleanup

**Goal:** Remove bloat from documentation files for LLM/agent consumption.

- **Deleted** `docs/AGENT_NAVIGATION.md` (outdated duplicate, v24 vs root v25)
- **Deleted** `docs/CHANGELOG-23.md` (redundant — data in git history + worklog)
- **Rewrote** `AGENT_NAVIGATION.md` (root) — v26.0, concise, current to iteration 23, removed iteration history
- **Rewrote** `docs/ARCHITECTURE.md` — v26.0, removed 12 sections of iteration-by-iteration history (§10-21+), kept only current architecture. ~700 lines → ~180 lines
- **Updated** `docs/DATA_CONTRACTS.md` — v4.0, added missing fields: `SearchLogic`, `JewelType`, `familyKey`, `regexPrefix`, `hasMultiPlaceholder`, `filterSlotIndex`, `prefix`/`exact` on RANGE
- **Trimmed** `docs/ETL_GUIDE.md` — v6.0, condensed i18n override table from ~50 lines of individual tokens to summary, added prefix extraction and suffix lengthening docs
- **Updated** `новый_план.md` — v4.0, current status
- **Updated** `worklog.md` — this entry

---

## Known Issues (Remaining)

| Priority | Issue | Status |
|----------|-------|--------|
| HIGH | Push fixes to GitHub (TS fixes not in main) | `git push` needed |
| HIGH | In-game regex verification (tests 1-22) | Manual testing |
| HIGH | jewelType all "shared" (Type A parser missing modCode) | `parse-tables.ts` fix needed |
| MEDIUM | Number boundary false positives: `[4-9].` matches `6%` | PoE2 limitation, use prefix anchoring |
| MEDIUM | Desecrated dual-stat regex quality | `compute-regex.ts` Strategy 1c |
| MEDIUM | HomePage hardcoded mod counts | Stale after data updates |
| INFO | 57 i18n overrides applied | `i18n-overrides.json` |
| LOW | VendorPage GROUP_ORDER hardcoded Russian | By design |
| LOW | TabletPage inline loading/error | Needs PageStateWrapper |

---

## Build & Run Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Production build
pnpm test             # Run all tests (213)
pnpm etl              # Run ETL pipeline (needs network or .etl-cache/)
pnpm dev              # Development server
```

## Key Architecture

- **ETL:** `scripts/run-etl.ts` → fetch → parse → normalize → compute-regex → compute-optimizations → generate JSON → i18n overrides
- **Data:** `public/generated/*.json` (10 files)
- **UI Pages:** `src/ui/pages/{category}/` — each uses `useCategoryPage()` hook (except VendorPage)
- **Components:** `src/ui/components/` — ModList, FilterChip, RegexOutput, CategoryControlPanel, ProfilePanel, VendorChip, PageStateWrapper
- **i18n:** `src/shared/i18n.ts` — t() function with 150+ keys
- **Classifier:** `src/shared/mod-classifier.ts` — semantic, sentiment, tablet-type, jewel-type (static lookup + weighted scoring fallback)
- **Regex Engine:** `src/core/` — AST, compiler, optimizer, number-regex
- **Store:** `src/store/` — Zustand filter store, profile store, URL sync

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json` and `run-etl.ts` `applyI18nOverrides()`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
4. **FilterStoreApi type mismatch:** VendorPage must wrap Zustand store in FilterStoreApi adapter (not pass .getState())
5. **Number boundary:** `[4-9].` matches `6%` in PoE2 — known limitation, use prefix anchoring to mitigate
6. **hasMultiPlaceholder missing in tests:** Always include `hasMultiPlaceholder: false` in test helpers
