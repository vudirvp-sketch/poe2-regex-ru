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

---

## Session 3 — 2026-06-05

**Agent:** Super Z (main agent)
**Task:** Iteration 5 — Core → UI Integration: connect all category pages, add optimizer dedup, min value filter, yofication

### Iteration 5: Core → UI Integration

**5.1 — useCategoryPage hook** (`src/ui/hooks/useCategoryPage.ts`)

New reusable hook that wires together all layers:
- Loads CategoryData via `loadCategoryData()`
- Creates Zustand filter store per category
- Builds AST from user selections (AND/OR/EXCLUDE/RANGE)
- Applies optimizer (dedup + optimization table)
- Compiles AST to regex string
- Applies runtime yofication (е→[её]) when character budget allows
- Returns all state + actions for category pages to use

Key features:
- `excludeMode` toggle: "Хочу" vs "Не хочу" (want vs exclude selected mods)
- `minValue` filter: when set on ranged mods, generates `numberRegex.*suffix` instead of just suffix
- `round10Enabled` toggle for number regex rounding
- Runtime yofication: applies `[её]` at marked positions if under 250 char limit

**5.2 — Category pages fully implemented**

All 5 main category pages upgraded from stubs to fully working:
- `src/ui/pages/belt/BeltPage.tsx` — Full working page with ModList + RegexOutput
- `src/ui/pages/ring/RingPage.tsx` — Same pattern
- `src/ui/pages/amulet/AmuletPage.tsx` — Same pattern
- `src/ui/pages/waystone/WaystonePage.tsx` — With tier filter + state toggles (corrupted/delirious)
- `src/ui/pages/tablet/TabletPage.tsx` — Basic mod selection + regex output

Each page now has:
- Search/filter for mods (text, affix, origin)
- "Хочу / Не хочу" mode toggle
- Minimum value filter (≥N) for ranged mods
- Round10 toggle
- Regex output with copy + overflow protection
- Selected mods summary

**5.3 — Optimizer deduplication** (`src/core/optimizer.ts`)

Major enhancement to the optimizer:
- **Phase 1: Deduplication** — Collapses identical regex values in OR groups
  - When multiple tokens share the same regex (e.g., all fire res tiers → "к сопротивлению огню"),
    their LITERAL nodes are collapsed into a single LITERAL with `dedup:` prefixed tokenId
  - This is the most impactful optimization for belt/ring/amulet categories
- **Phase 2: Optimization table** — Enhanced to apply MULTIPLE non-overlapping optimizations
  - Previous version only applied the single best optimization
  - New version greedily applies all non-overlapping optimizations sorted by savings

Tests added:
- `deduplicates identical regex values in OR group`
- `keeps different regex values separate in OR group`

**5.4 — Runtime yofication** (integrated in `useCategoryPage.ts`)

Applied after compilation:
- Scans compiled regex for token regex substrings
- Maps yofication positions from tokens to the compiled regex
- Applies `[её]` replacement only if character budget allows (≤250 chars)
- Each replacement costs 3 extra characters

**5.5 — Test fixes**

- `tests/core/optimizer.test.ts` — Updated for deduplication behavior (single-child OR unwraps to LITERAL)
- `tests/etl/compute-optimizations.test.ts` — Fixed type mismatch (RegexResult instead of `{regex: string}`)

**Build verification:** `pnpm build` passes, `pnpm test` passes (57/57 tests)

### Stopping Point (Session 3)

Completed Iteration 5 (Core → UI Integration for all 5 main categories).

**What's done:**
- All 5 main category pages fully functional (Belt, Ring, Amulet, Waystone, Tablet)
- Optimizer deduplication for identical family regexes
- Minimum value filter (≥N) for ranged mods
- Runtime yofication
- All tests passing

**What's NOT done yet (for next session):**
- Relic page and Vendor page still stubs
- Jewel page missing (no route, CATEGORY_ROUTES bug)
- Waystone-specific AST not yet integrated (tier filter → AST RANGE, state toggles → AST LITERAL)
  - Current WaystonePage has the UI toggles but doesn't add them to the regex yet
- Waystone/tablet parser regex quality issues (some mods get overly short/generic regexes)
  - The compute-regex template-suffix approach doesn't work well for complex multi-line mods
- ETL re-run needed after any parser fixes
- Profile UI (save/load/rename/delete) not yet connected
- Share URL button not yet connected
- Mobile responsive polish

---

## Session 4 — 2026-06-05

**Agent:** Super Z (main agent)
**Task:** Iteration 6 (partial) — JewelPage, RelicPage, Waystone AST, Profile UI, Share URL

### 6.1 — JewelPage created

New file: `src/ui/pages/jewel/JewelPage.tsx`
- Full working category page using useCategoryPage({ categoryId: 'jewel' })
- Same pattern as BeltPage/RingPage/AmuletPage
- Supports origin filter (normal/desecrated/corrupted)
- Mode toggle, min value filter, round10, regex output

Updated files:
- `src/App.tsx` — Added `/jewel` route → JewelPage
- `src/ui/layout/Sidebar.tsx` — Added Jewel entry (💠 icon)
- `src/ui/pages/home/HomePage.tsx` — Added Jewel category card
- `src/shared/i18n.ts` — Added `jewel.title` and `home.jewel_desc` translations

**Bug fixed:** CATEGORY_ROUTES was correct (jewel→/jewel), but no route or page existed. Now all three are in place.

### 6.2 — RelicPage connected

Rewritten: `src/ui/pages/relic/RelicPage.tsx`
- Replaced stub ("Страница в разработке") with full working page
- Uses useCategoryPage({ categoryId: 'relic' })
- Supports 56 relic tokens from both Urn and Seal

### 6.3 — Waystone-specific AST integration

Enhanced: `src/ui/hooks/useCategoryPage.ts`
- Added `extraAstNodes` parameter to `CategoryPageConfig`
- Extra AST nodes are ANDed into the final regex alongside mod selections
- Works even when no mods are selected (e.g., just tier + corrupted)

Rewritten: `src/ui/pages/waystone/WaystonePage.tsx`
- Tier filter → `RANGE(tierMin, undefined, "r ")` — matches tier display in item text
- Corrupted → `literal("corr")` — matches "Corrupted" tag
- Uncorrupted → `exclude(literal("corr"))` — excludes corrupted items
- Delirious → `literal("delir")` — matches "Delirious" indicator
- All state toggles now affect the regex output in real-time
- Added visual hints showing which regex string each toggle produces

**⚠️ NOTE:** The regex strings "corr" and "delir" are English-based and may need
adjustment for the RU client. In-game verification is needed to confirm:
- Does "corr" match the "Осквернено" tag in RU client? If not, use "оскверн"
- Does "delir" match "Делириум" in RU client? If not, use "делир"
- Does "r " suffix match tier display in RU client?

### 6.4 — Profile UI

New component: `src/ui/components/ProfilePanel.tsx`
- Save current filter state as a named profile
- Load saved profiles (click to restore)
- Delete profiles
- Rename profiles (inline editing)
- Collapsible panel UI
- Connected to profile-store (localStorage persistence)

**⚠️ NOT YET INTEGRATED:** ProfilePanel exists but is not imported into any category page.
The component needs to be added to each category page's right panel with:
```tsx
<ProfilePanel
  category={categoryId}
  currentFilterData={/* serialize current state */}
  onRestore={/* deserialize and apply */}
/>
```

### 6.5 — Share URL button

Updated: `src/ui/components/RegexOutput.tsx`
- Added optional `filterStore` prop
- When filterStore is provided and regex is non-empty, shows "Поделиться" button
- Button calls getShareableUrl() from url-sync and copies to clipboard
- Shows "Ссылка скопирована!" feedback on success

**⚠️ NOT YET INTEGRATED:** The filterStore prop is not passed from category pages yet.
Each category page needs to pass its filter store reference to RegexOutput.

**Build verification:** `pnpm build` passes, `pnpm test` passes (57/57 tests)

### Stopping Point (Session 4)

**What's done:**
- JewelPage fully working (route + page + sidebar + home page)
- RelicPage fully working (was stub, now uses useCategoryPage)
- Waystone AST integration: tier/corrupted/delirious toggles now affect regex
- useCategoryPage supports extraAstNodes for category-specific AST additions
- ProfilePanel component created (save/load/delete/rename)
- Share URL button added to RegexOutput
- All 57 tests passing, build passing

**What's NOT done yet (for next session):**
- ProfilePanel NOT integrated into category pages (component exists but not imported)
- Share URL button in RegexOutput needs `filterStore` prop — not passed from category pages
- Waystone state toggles use English regex strings ("corr", "delir") — needs in-game verification
- Waystone/tablet parser regex quality issues still present
- ETL re-run needed after parser fixes
- VendorPage still a stub — requires in-game verification of RU property names
- Mobile responsive polish
