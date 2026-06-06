# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 23 — 2026-06-06)

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

### Session 23 Changes — Deploy Fix + Jewel Classification v2 + PageStateWrapper

**CRITICAL — Deploy fix (VendorPage FilterStoreApi type mismatch):**
- `filterStore.getState()` was incorrectly typed as `FilterStoreApi` in CategoryControlPanel
- Fix: wrapped Zustand store in `FilterStoreApi` adapter (same pattern as useCategoryPage.ts)
- Build now passes TypeScript strict checks

**MAJOR — Jewel type classification v2 (weighted scoring):**
- Replaced simple regex OR-groups with weighted keyword scoring (`RUBY_SCORES`, `EMERALD_SCORES`, `SAPPHIRE_SCORES`)
- Cross-validated against poe2db.tw Modifier Calculator (Ruby/Emerald/Sapphire pages)
- Accuracy improved from ~62% → ~84%
- Added missing keywords: Вестник, Разрез, отравлен, колчан, пригвожден, метк, уклонен, etc.
- Reduced weight for ambiguous keywords (поджог, шок, ман) that appear in multiple jewel types
- Classification threshold: best score ≥ 2 with margin ≥ 2, or best ≥ 3 with margin ≥ 1

**FEATURE — PageStateWrapper component:**
- New `src/ui/components/PageStateWrapper.tsx` — generic render-prop component
- Extracts loading/error/no-data pattern from 5 category pages
- Refactored: BeltPage, RingPage, AmuletPage, RelicPage, WaystonePage, JewelPage

---

## Known Issues (Remaining)

| Priority | Issue | Status |
|----------|-------|--------|
| INFO | 1 i18n override token has regex <5 chars (amulet fire spell crit breachborn) | Acceptable |
| INFO | Waystone tier filter removed (confirmed not searchable in RU client) | By design |
| INFO | 51 tokens use i18n overrides (poe2db.tw lacks Russian text) | Handled by i18n-overrides.json |
| LOW | VendorPage GROUP_ORDER + GROUP_COLORS labels are hardcoded Russian | By design (vendor-specific) |
| MED | Jewel classification ~84% — some edge cases misclassified | Needs static lookup |
| MED | TabletPage not using PageStateWrapper yet | Next iteration |
| LOW | Jewel type sub-grouping (groupMode="jewel-type") | Next iteration |

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
- **Classifier:** `src/shared/mod-classifier.ts` — semantic, sentiment, tablet-type, jewel-type (weighted scoring)
- **Regex Engine:** `src/core/` — AST, compiler, optimizer, number-regex
- **Store:** `src/store/` — Zustand filter store, profile store, URL sync

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json` and `run-etl.ts` `applyI18nOverrides()`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
4. **FilterStoreApi type mismatch:** VendorPage must wrap Zustand store in FilterStoreApi adapter (not pass .getState())
