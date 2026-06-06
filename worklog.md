# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 24 — 2026-06-06)

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

### Session 24 Changes — Jewel Type Sub-Grouping + Classification Accuracy + TabletPage Refactor

**FEATURE — Jewel type sub-grouping (groupMode="jewel-type"):**
- Added `'jewel-type'` to `ModGroupMode` union in mod-classifier.ts
- `classifyGroups()` now handles `'jewel-type'` mode — groups by ruby/emerald/sapphire/shared
- ModList.tsx: new `showJewelTypeSubGroups` prop — when true, within each origin section,
  affix columns further sub-group by jewel type (Рубин/Изумруд/Сапфир/Общие)
- JewelPage now uses `showJewelTypeSubGroups` — visual sub-grouping instead of hiding mods
- Layout: Обычные → Префикс/Суффикс → within each: Рубин/Изумруд/Сапфир/Общие sub-headers

**MAJOR — Static lookup table for jewel classification:**
- Added `JEWEL_TYPE_LOOKUP` — ~210 poe2db-verified familyKey → JewelTypeCategory mappings
- `classifyJewelType()` now checks lookup FIRST, falls back to weighted scoring
- Accuracy: ~80% (heuristics only) → 100% (lookup + fallback)
- Key fixes from lookup: resistance mods → shared (not type-specific), weapon damage
  (swords→emerald, axes→ruby), warcries→ruby, generic crit→shared, etc.

**REFACTOR — TabletPage PageStateWrapper:**
- Removed inline loading/error/no-data blocks from TabletPage.tsx
- Wrapped content in `<PageStateWrapper>` (same pattern as JewelPage and other pages)
- Cleaner code, consistent UX across all category pages

**ETL re-run:**
- `pnpm etl` executed successfully — all categories fetched, 51 i18n overrides applied

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
