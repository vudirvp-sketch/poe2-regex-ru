# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 27 — 2026-06-06)

**Build:** `pnpm build` passes, `pnpm test` passes (204/204 tests)

**ETL Results (latest run):**

| Category | Tokens | Optimizations | Short regex (<5) |
|----------|--------|---------------|-------------------|
| waystone | 96 | 52 | 0 |
| waystone-desecrated | 16 | 4 | 0 |
| tablet | 75 | 363 | 0 |
| jewel | 193 | 1,466 | 0 |
| jewel-desecrated | 21 | 3 | 0 |
| jewel-corrupted | 10 | 0 | 0 |
| relic | 58 | 28 | 0 |
| belt | 298 | 231 | 0 |
| ring | 366 | 458 | 0 |
| amulet | 427 | 389 | 1 (i18n override) |
| **Total** | **1,560** | | |

---

### Session 27 Changes — Per-Mod Numeric Filter Implementation + Scoring Cleanup

**FEATURE — Per-mod numeric filter (Iteration 19):**
- `filter-store.ts`: Added `perTokenRanges: Record<string, TokenRangeOverride>` to FilterState
  - New actions: `setTokenRange(tokenId, range)`, `clearTokenRange(tokenId)`
  - Serialization: `r` key in URL → `[[tokenId, min, max], ...]` compact array format
  - Reset clears perTokenRanges
- `useCategoryPage.ts`: `buildAstFromSelections` now accepts `perTokenRanges` parameter
  - Each ranged token resolves effective range: per-token override > global fallback
  - Tokens with different effective ranges get separate RANGE nodes → separate quoted groups in regex
  - New return values: `perTokenRanges`, `setTokenRange`, `clearTokenRange`
- `FilterChip.tsx`: Shows ≥/≤ number inputs when group is selected AND has ranged tokens
  - Inputs set per-token overrides via first ranged member's ID
  - Click on inputs doesn't toggle chip selection (stopPropagation)
- `ModList.tsx`: Passes `perTokenRanges`, `onSetTokenRange`, `onClearTokenRange` to all FilterChip instances
- All 7 page components: Updated to destructure and pass new props to ModList

**SCORING — Cross-array conflict cleanup (3 rules removed):**
- `RUBY /присутстви/` (w=1) — appeared in both Ruby and Sapphire → removed
- `SAPPHIRE /област.*действ.*присутстви/` (w=1) — too generic, Ruby also has presence area → removed
- `RUBY /сил.*Горючест/` (w=1) — both Ruby and Sapphire have combustibility → removed
- Zero classification accuracy loss (all were w=1 with cross-array conflicts)

**DOCS — Updated:**
- AGENT_NAVIGATION.md: Version 23.0→24.0, §9 updated from "Current vs Desired" → "Implemented", §10 updated with resolved conflicts
- docs/AGENT_NAVIGATION.md: synced

---

## Known Issues (Remaining)

| Priority | Issue | Status |
|----------|-------|--------|
| INFO | 1 i18n override token has regex <5 chars (amulet fire spell crit breachborn) | Acceptable |
| INFO | 51 tokens use i18n overrides (poe2db.tw lacks Russian text) | Handled by i18n-overrides.json |
| LOW | VendorPage GROUP_ORDER + GROUP_COLORS labels are hardcoded Russian | By design (vendor-specific) |
| LOW | Remaining pages that might still use inline loading/error: none left | All refactored |

---

## Build & Run Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Production build
pnpm test             # Run all tests (204)
pnpm etl              # Run ETL pipeline (needs network or .etl-cache/)
pnpm dev              # Development server
```

## Key Architecture

- **ETL:** `scripts/run-etl.ts` → fetch → parse → normalize → compute-regex → compute-optimizations → generate JSON
- **Data:** `public/generated/*.json` (10 files)
- **UI Pages:** `src/ui/pages/{category}/` — each uses `useCategoryPage()` hook (except VendorPage)
- **Components:** `src/ui/components/` — ModList, FilterChip, RegexOutput, CategoryControlPanel, ProfilePanel, VendorChip, PageStateWrapper
- **i18n:** `src/shared/i18n.ts` — t() function with 130+ keys
- **Classifier:** `src/shared/mod-classifier.ts` — semantic, sentiment, tablet-type, jewel-type (static lookup + weighted scoring fallback)
- **Regex Engine:** `src/core/` — AST, compiler, optimizer, number-regex
- **Store:** `src/store/` — Zustand filter store, profile store, URL sync

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json` and `run-etl.ts` `applyI18nOverrides()`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
4. **FilterStoreApi type mismatch:** VendorPage must wrap Zustand store in FilterStoreApi adapter (not pass .getState())
