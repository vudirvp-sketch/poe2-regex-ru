# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 22 — 2026-06-06)

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

### Session 22 Changes — i18n Labels + Jewel Type Filter + Constants Cleanup

**LOW — TabletPage hardcoded labels → i18n:**
- "Тип:" → `t('tablet.type_label')`, "Редкость:" → `t('tablet.rarity_label')`, "Исп.:" → `t('tablet.uses_label')`
- Summary: "+ типы:" → `t('tablet.summary_types')`, "+ редкость:" → `t('tablet.summary_rarity')`, "+ ≥N использ." → `t('tablet.summary_uses')`

**LOW — WaystonePage checkbox labels → i18n:**
- "Осквернён" → `t('waystone.corrupted_label')`, "Неосквернён" → `t('waystone.uncorrupted_label')`, "Делириум" → `t('waystone.delirious_label')`
- Summary: "+ оскверн." → `t('waystone.summary_corrupted')`, "+ неоскверн." → `t('waystone.summary_uncorrupted')`, "+ делириум" → `t('waystone.summary_delirious')`

**INFO — ORIGIN_LABELS/AFFIX_LABELS removed from constants.ts:**
- Both constants were unused after iteration 15's i18n migration
- Verified: no imports of these constants exist anywhere in the codebase

**FEATURE — JewelPage jewel type filter (Ruby/Emerald/Sapphire/All):**
- Added `classifyJewelType()` in mod-classifier.ts with text-based heuristics
- Ruby: fire, bleed, armour, maces, rage, thorns, totems, warcries, banners, presence
- Emerald: lightning, accuracy, attack speed, projectiles, bows/crossbows/staves/spears, parry, sentinel, flasks
- Sapphire: cold, curses, energy shield, spells, mana, offerings, minions, chaos
- Shared: mods matching multiple types or none (e.g., "урон от атак", attributes)
- 4 filter buttons in extraControls: Все/Рубин/Изумруд/Сапфир
- Filter shows selected type + shared mods; "Все" shows complete list
- Token count in header: "filtered/total мод(ов)"
- Jewel type state synced to filterStore for URL sharing

**New i18n keys added (17 total):**
- `tablet.type_label`, `tablet.rarity_label`, `tablet.uses_label`
- `tablet.summary_types`, `tablet.summary_rarity`, `tablet.summary_uses`
- `waystone.corrupted_label`, `waystone.uncorrupted_label`, `waystone.delirious_label`
- `waystone.summary_corrupted`, `waystone.summary_uncorrupted`, `waystone.summary_delirious`
- `jewel.type_all`, `jewel.type_ruby`, `jewel.type_emerald`, `jewel.type_sapphire`, `jewel.type_label`

---

## Known Issues (Remaining)

| Priority | Issue | Status |
|----------|-------|--------|
| INFO | 1 i18n override token has regex <5 chars (amulet fire spell crit breachborn) | Acceptable |
| INFO | Waystone tier filter removed (confirmed not searchable in RU client) | By design |
| INFO | 51 tokens use i18n overrides (poe2db.tw lacks Russian text) | Handled by i18n-overrides.json |
| LOW | VendorPage GROUP_ORDER + GROUP_COLORS labels are hardcoded Russian | By design (vendor-specific) |
| MED | Jewel type heuristics need verification against game data | Next iteration |

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
- **Components:** `src/ui/components/` — ModList, FilterChip, RegexOutput, CategoryControlPanel, ProfilePanel, VendorChip
- **i18n:** `src/shared/i18n.ts` — t() function with 130+ keys
- **Classifier:** `src/shared/mod-classifier.ts` — semantic, sentiment, tablet-type, jewel-type classification
- **Regex Engine:** `src/core/` — AST, compiler, optimizer, number-regex
- **Store:** `src/store/` — Zustand filter store, profile store, URL sync

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json` and `run-etl.ts` `applyI18nOverrides()`
3. **Regex double-sticky:** Only CategoryControlPanel should have `sticky top-0`
