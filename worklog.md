# PoE2 Regex RU — Worklog

> Append-only but trimmed. Historical details are in git history.

---

## Current State (Session 10 — 2026-06-06)

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

### Session 10 Changes

**HIGH — Full ETL re-run completed:**
- Ran `pnpm etl` with cached poe2db.tw data
- Regex computed via full TypeScript algorithm (compute-regex.ts) with compound families, yofication
- MIN_REGEX_LEN_DEFAULT raised from 3 to 5 (was only strict for waystone/tablet)
- Result: only 1 token has regex <5 chars (i18n override fallback)

**HIGH — Regex quality audit:**
- Fixed problematic regex like "(2.", "(3.", "(9." for belt health regen tokens
- All categories now have 0 short regexes except 1 i18n override token
- ETL deduplication improved: waystone 106→96, waystone-desecrated 18→16, tablet 78→75

**HIGH — ModList origin grouping fix:**
- Problem: "··· Осквернённые ···" appeared multiple times within a single affix column
  (once per semantic sub-group: under "Атакующие", under "Защитные", etc.)
- Fix: When `showOriginSubSections=true`, now groups by origin FIRST, then by semantic
  category within each origin. No more duplicate origin headers.
- New `splitByOriginThenSemantic()` function replaces per-sub-group splitting

**MEDIUM — HomePage dynamic mod counts:**
- Removed all hardcoded counts: '106 модов', '1 584 мода', etc.
- Now dynamically loads JSON files and counts tokens on mount
- Added `loadMergedCategoryData()` support for jewel (3 merged JSONs)

**MEDIUM — i18n: hardcoded Russian strings replaced with t():**
- Added 30+ new translation keys to i18n.ts
- RegexOutput: "Норма/Много/Критично/Копировать/Поделиться/Авто/ПЕРЕПОЛНЕНИЕ/..."
- ModList: "Поиск модов.../Все типы/Все источники/Очистить/Моды не найдены/..."
- CategoryControlPanel: "Хочу/Не хочу"
- VendorPage: "Хочу/Не хочу/Очистить"
- Sidebar: "Русский клиент"
- Header: theme toggle titles

**MEDIUM — Sidebar icon normalization:**
- All 9 icons normalized to 128x128 canvas via PIL
- Non-square icons (relic 80x156, vendor 331x270, belt 212x108) fitted with padding
- Icon display size increased from 20x20 to 24x24

**LOW — RegexOutput double-sticky fix:**
- Removed `sticky top-0 z-10` from RegexOutput component
- Sticky behavior now only on CategoryControlPanel and VendorPage wrapper

**LOW — index.html theme-color fix:**
- Header.tsx now updates `<meta name="theme-color">` on theme change
- Dark: #0f0f1a, Light: #f5f5f0

---

## Known Issues (Remaining)

| Priority | Issue | Status |
|----------|-------|--------|
| MEDIUM | VendorPage duplicates CategoryControlPanel layout (mode toggle, sticky, round10) | Not fixed — needs architectural refactor |
| MEDIUM | Some i18n strings still hardcoded in page components (WaystonePage, JewelPage, etc.) | Partial — key components done |
| LOW | BeltPage "Префикс"/"Суффикс" hardcoded in origin mode | Not fixed |
| INFO | 1 i18n override token has regex <5 chars (amulet fire spell crit breachborn) | Acceptable |
| INFO | Waystone tier filter removed (confirmed not searchable in RU client) | By design |
| INFO | 51 tokens use i18n overrides (poe2db.tw lacks Russian text) | Handled by i18n-overrides.json |

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
- **UI Pages:** `src/ui/pages/{category}/` — each uses `useCategoryPage()` hook
- **Components:** `src/ui/components/` — ModList, FilterChip, RegexOutput, CategoryControlPanel, ProfilePanel
- **i18n:** `src/shared/i18n.ts` — t() function with 90+ keys
- **Regex Engine:** `src/core/` — AST, compiler, optimizer, number-regex
- **Store:** `src/store/` — Zustand filter store, profile store, URL sync

## Frequent Bugs

1. **ETL cache stale:** If poe2db.tw updates, delete `.etl-cache/` and re-run `pnpm etl`
2. **i18n override regex too short:** Check `scripts/etl/i18n-overrides.json` and `run-etl.ts` `applyI18nOverrides()`
3. **Regex double-sticky:** Only CategoryControlPanel and VendorPage wrapper should have `sticky top-0`
