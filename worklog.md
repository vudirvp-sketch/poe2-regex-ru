# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 30 — 2026-06-06)

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

### Session 30 — JewelType Fix + UI Improvements

**Goal:** Fix P0 jewelType "shared" bug and improve UI layout.

**Changes:**

- **FIXED `scripts/run-etl.ts`** — `buildJewelTypeMap()` now matches Type A jewel mods by normalized rawTextTemplate against ModCalc data (not just by modCode which is absent from Type A HTML tables). Added `normalizeRawTextForMatching()` helper and `normalizedTextToModCode` lookup map. After re-running ETL, jewel tokens will get proper `jewelType` (ruby/emerald/sapphire/shared) instead of all "shared".
- **FIXED `src/ui/layout/Sidebar.tsx`** — Logo block: changed from `text-center` + `mx-auto` to `text-left`, increased logo from 40x40 to 52x52. Nav icons: increased from 24x24 to 32x32.
- **FIXED `src/ui/pages/home/HomePage.tsx`** — Category card icons: increased from 48x48 to 56x56, added fixed-height container (`height: 56`) with flexbox centering to normalize visual alignment for icons with different padding.
- **Updated `AGENT_NAVIGATION.md`** — v27.0, reflects jewelType fix done, updated known issues.
- **Updated `worklog.md`** — this entry.

**NOTE:** ETL pipeline has NOT been re-run yet (needs network access to poe2db.tw). The `public/generated/jewel*.json` files still have `jewelType: "shared"` for all tokens. After pushing, re-run ETL to populate proper jewel types.

---

## Known Issues (Remaining)

| Priority | Issue | Status |
|----------|-------|--------|
| HIGH | Push fixes to GitHub (TS fixes not in main) | `git push` needed |
| HIGH | In-game regex verification (tests 1-22) | Manual testing |
| HIGH | Re-run ETL after jewelType fix | `pnpm etl` needed |
| MEDIUM | Number boundary false positives: `[4-9].` matches `6%` | PoE2 limitation, use prefix anchoring |
| MEDIUM | Desecrated dual-stat regex quality (short regexes) | `compute-regex.ts` Strategy 1c works but min length may need raising |
| MEDIUM | HomePage hardcoded mod counts | Stale after data updates |
| MEDIUM | Icon proportions (relic/vendor/belt PNG padding) | Source images need re-cropping |
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
- **Classifier:** `src/shared/mod-classifier.ts` — semantic, sentiment, tablet-type, jewel-type (ETL lookup + weighted scoring fallback)
- **Regex Engine:** `src/core/` — AST, compiler, optimizer, number-regex
- **Store:** `src/store/` — Zustand filter store, profile store, URL sync

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json` and `run-etl.ts` `applyI18nOverrides()`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
4. **FilterStoreApi type mismatch:** VendorPage must wrap Zustand store in FilterStoreApi adapter (not pass .getState())
5. **Number boundary:** `[4-9].` matches `6%` in PoE2 — known limitation, use prefix anchoring to mitigate
6. **hasMultiPlaceholder missing in tests:** Always include `hasMultiPlaceholder: false` in test helpers
