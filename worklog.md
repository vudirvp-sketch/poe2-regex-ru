# PoE2 Regex Architect — Worklog

> Append-only. Never overwrite. Each agent session adds its entries at the bottom.

---

## Session 1 — 2026-06-05

**Agent:** Super Z (main agent)
**Task:** Implement Iterations 0-2 from план.md, start Iteration 3

### Iteration 0: Verification & Preparation
- [x] 0.2 Created `docs/` directory with canonical documentation:
  - `docs/ARCHITECTURE.md` — Architecture, invariants, layer boundaries
  - `docs/DATA_CONTRACTS.md` — Types, JSON formats, internal IDs
  - `docs/ETL_GUIDE.md` — ETL pipeline specification
  - `docs/AGENT_NAVIGATION.md` — Navigation, build commands, workflow
- [x] 0.5 Created `worklog.md` (this file)
- Note: 0.1 (GitHub repo), 0.3, 0.4 (manual in-game verification) are user tasks

### Iteration 1: Infrastructure + Bootstrap
- [x] 1.1 Created Vite project with react-ts template
- [x] 1.2 Installed dependencies (react-router-dom, zustand, lz-string, tailwindcss, vitest, cheerio, tsx)
- [x] 1.3 Configured tsconfig.json with strict mode + path aliases
- [x] 1.4 Configured vite.config.ts with aliases + GitHub Pages base
- [x] 1.5 Created canonical directory structure
- [x] 1.6 Set up routing (HomePage, Waystone, Tablet, Relic, Vendor, Belt, Ring, Amulet)
- [x] 1.7 Sidebar navigation
- [x] 1.8 Dark theme (default)
- [x] 1.9 GitHub Actions deploy.yml
- [x] 1.11 Added pnpm etl script

### Iteration 2: Core Engine (Domain Layer)
- [x] 2.1 src/shared/types.ts — All types
- [x] 2.2 src/shared/constants.ts — MAX_CHARS, CATEGORY_IDS
- [x] 2.3 src/shared/i18n.ts — Translation function (RU strings)
- [x] 2.4 src/core/number-regex.ts — Ported from poe2.re
- [x] 2.5 src/core/limits.ts — Character counting
- [x] 2.6 src/core/ast.ts — AST types + builder functions
- [x] 2.7 src/core/compiler.ts — AST -> regex string
- [x] 2.8 src/core/optimizer.ts — Optimization table usage
- [x] 2.9 src/strategies/locale.ts — Yofication converter, gender form selector
- [x] 2.10 Tests:
  - number-regex.test.ts
  - compiler.test.ts
  - limits.test.ts
  - optimizer.test.ts

### Iteration 3: ETL Pipeline (Partial — Core Scripts)
- [x] 3.1 scripts/etl/fetch-poe2db.ts — HTTP fetch with retry + 24h caching
- [x] 3.2 scripts/etl/parse-tables.ts — Type A page parser (Waystones/Tablets/Jewels)
- [x] scripts/etl/parse-modifiers-calc.ts — Type B page parser (Belts/Rings/Amulets/Relics)
- [x] 3.3 scripts/etl/normalize.ts — Clean + structure raw data
  - Range extraction, value extraction
  - Gender inflection HTML parser
  - Yofication detection
  - Internal ID generation
- [x] 3.4 scripts/etl/compute-regex.ts — Minimal unique substring algorithm
  - Pre-compute exclusion substring sets
  - Greedy shortest-unique search
  - End-of-word preference
  - [её] variant checking
- [x] 3.5 scripts/etl/compute-optimizations.ts — Optimization table
  - Prefix-grouped combinatorial search
  - Longest common substring per group
  - Savings calculation
- [x] 3.6 scripts/etl/generate-dictionary.ts — JSON output assembler
- [x] 3.7 scripts/run-etl.ts — CLI orchestrator (all 8 categories)
- [x] 3.8 ETL Tests:
  - compute-regex.test.ts (5 tests)
  - compute-optimizations.test.ts (3 tests)
  - normalize.test.ts (9 tests)
- [ ] 3.9 Run ETL, commit first JSONs — ✅ DONE (see Session 2)
- [ ] 3.10 Manual in-game verification — user task

**Build verification:** `pnpm build` passes, `pnpm test` passes (55/55 tests)

### Stopping Point (Session 1)
Completed Iterations 0-3 (code). Next steps:
- **Iteration 3 remaining:** Run ETL to generate real JSON files from poe2db.tw, verify output
- **Iteration 4:** Data Loader + UI Skeleton (filter-store, profile-store, url-sync, shared UI components)
- **Iteration 5:** Core -> UI Integration (Waystone + Tablet pages fully working)
- **Iterations 6-9:** Relic/Jewels, Vendor, Belts/Rings/Amulets, Polish + CI/CD

---

## Session 2 — 2026-06-05

**Agent:** Super Z (main agent)
**Task:** Complete Iteration 3 (run ETL on real data + fix parsers), start Iteration 4

### Iteration 3 Completion: ETL Pipeline on Real Data

**3.9 — Run ETL + Parser Fixes for Real poe2db.tw HTML**

Major discoveries about real poe2db.tw HTML structure:
1. Tables use class `filters`, NOT `tablesorter`
2. Table rows don't have `role="row"` attribute
3. Affix text is in Russian: `Префикс`/`Суффикс`/`Осквернено`
4. Gender templates use UPPERCASE keys: `<if:MS>`, not `<if:ms>`
5. CSS.escape() is not available in Node.js — replaced with custom cssEscapeId()
6. Type B pages (Belts/Rings/Amulets) store mod data as JSON in `new ModsView({...})` script tag, NOT in static HTML
7. Relics have a `#RelicMods` tab with a static HTML table (5 columns)
8. Both Urn and Seal relics share the same mod pool — need deduplication

**Files modified:**

- [x] `scripts/etl/parse-tables.ts` — Complete rewrite
  - Custom `cssEscapeId()` function replacing `CSS.escape()`
  - Selector changed from `table.tablesorter` to `table.filters`
  - Removed `tr[role="row"]` requirement
  - Dynamic column layout detection from `<thead>` headers
  - Russian affix text handling (`Префикс`/`Суффикс`/`Осквернено`)
  - Tag extraction from `data-tag` attributes
  - Mod code extraction from `data-hover` URLs
  - Origin detection from Pre/Suf cell content

- [x] `scripts/etl/parse-modifiers-calc.ts` — Complete rewrite
  - Extract JSON from `new ModsView({...})` script tag
  - Parse all mod categories: normal, corrupted, desecrated, breach_tree, breach_minion, breach_caster, essence, perfect_essence
  - Map `ModGenerationTypeID`: "1" → prefix, "2" → suffix, "5" → suffix (origin=corrupted)
  - Extract tags from `mod_no` HTML using `data-tag` regex
  - Extract mod codes from `hover` URL or `Code` field
  - Group mods by `ModFamilyList` for tier grouping

- [x] `scripts/etl/normalize.ts` — Updated
  - Gender template extraction supports UPPERCASE keys (`<if:MS>`)
  - ID generation includes origin suffix for non-normal origins (e.g., `belt.fireresist4_desecrated`)
  - Hash-based fallback IDs include origin for uniqueness
  - Better rawText cleaning (removes `<span class="secondary">` before text extraction)

- [x] `scripts/etl/compute-regex.ts` — Updated
  - Minimum regex length set to 3 characters (1-2 char regexes too generic)
  - Skip purely numeric candidates
  - Gender form fallback also uses MIN_REGEX_LEN

- [x] `scripts/etl/compute-optimizations.ts` — Rewritten
  - DP-based longest common substring (O(n*m) per pair) instead of enumerating all substrings
  - Rolling array for space efficiency
  - Max group size limited to 20 tokens, max combo size 3
  - Minimum shared substring length 3

- [x] `scripts/run-etl.ts` — Updated
  - Added `relic` type for parsing `#RelicMods` HTML tables
  - Added deduplication for relics (Urn + Seal share same mods)
  - Added filtering for empty/invalid mods
  - Added separate categories for jewel normal/desecrated/corrupted
  - Fixed type imports

**ETL Results:**

| Category | Tokens | Optimizations |
|----------|--------|---------------|
| waystone | 106 | 556 |
| waystone-desecrated | 18 | 1 |
| tablet | 78 | 261 |
| jewel | 193 | 906 |
| jewel-desecrated | 32 | 45 |
| jewel-corrupted | 10 | 0 |
| relic | 56 | 44 |
| belt | 298 | 1,774 |
| ring | 366 | 2,295 |
| amulet | 427 | 2,782 |
| **Total** | **1,584** | **8,664** |

**Known issues in data:**
- ~51 tokens have English-only rawText (poe2db.tw missing Russian translations)
- Some tokens have regex = full rawText (no shorter unique substring exists)
- Waystone/tablet/relic have no tags (poe2db.tw doesn't provide data-tag for these)

### Iteration 4: Data Loader + UI Skeleton (Partial)

- [x] `src/shared/constants.ts` — Updated
  - Added jewel-desecrated, jewel-corrupted to CATEGORY_IDS
  - Added CATEGORY_LABELS (Russian display names for categories)
  - Added ORIGIN_LABELS (Russian display names for origins)
  - Added AFFIX_LABELS (Russian display names for affix types)

- [x] `src/store/filter-store.ts` — New
  - Zustand store for mod filter state
  - selectedIds, searchText, affixFilter, originFilter
  - serialize/deserialize for URL sync
  - Factory function `createFilterStore()` per category

- [x] `src/store/profile-store.ts` — New
  - Zustand store for saved search profiles
  - Persisted to localStorage
  - CRUD operations + category-based filtering

- [x] `src/store/url-sync.ts` — New
  - lz-string compression for URL hash
  - syncToUrl / syncFromUrl functions
  - getShareableUrl for clipboard sharing

- [x] `src/ui/components/RegexOutput.tsx` — New
  - Displays generated regex with character count
  - Copy-to-clipboard button
  - Overflow warning (red) when exceeding 250 chars
  - Near-limit warning (yellow) when > 80% of limit

- [x] `src/ui/components/FilterChip.tsx` — New
  - Toggleable chip for selecting/deselecting a mod
  - Shows truncated Russian text
  - Color-coded by affix type (blue=prefix, orange=suffix)
  - Tooltip with full text and regex

- [x] `src/ui/components/ModList.tsx` — New
  - Filterable, selectable list of mods
  - Search text filter
  - Affix type filter (prefix/suffix/all)
  - Origin filter (when multiple origins exist)
  - Grouped display by affix type
  - Clear selections button

- [x] `src/data/loader.ts` — Unchanged (already compatible)

**Build verification:** `pnpm build` passes, `pnpm test` passes (55/55 tests)

### Stopping Point (Session 2)
Completed Iteration 3 fully + Iteration 4 (stores + components). Next steps:
- **Iteration 4 remaining:** Wire up category pages to use filter store + components
- **Iteration 5:** Core → UI Integration (Waystone + Tablet pages fully working)
- **Iterations 6-9:** Relic/Jewels, Vendor, Belts/Rings/Amulets, Polish + CI/CD
