# Worklog

---
Task ID: 1
Agent: Main
Task: ETL pipeline automation, waystone ranges, documentation cleanup

Work Log:
- Cloned repo https://github.com/vudirvp-sketch/poe2-regex-ru
- Analyzed codebase: ETL pipeline (run-etl.ts, normalize.ts), regex matcher, compiler, types, docs
- Added implicit-set bonus detection and filtering to normalize.ts
- Updated run-etl.ts: Added Step 2b after normalization
- Updated restructure-implicits.ts: Changed waystone implicit ranges to unrestricted [0, 250]
- Updated waystone.json and waystone-desecrated.json
- Updated documentation: STATUS.md, ETL_GUIDE.md, ARCHITECTURE.md, IN_GAME_TESTS.md

Stage Summary:
- ETL pipeline now automatically handles implicit-set bonuses
- Waystone implicit ranges set to 0-250
- Block model B1-B2: documented as requiring in-game test

---
Task ID: 2
Agent: Main
Task: Apply in-game test results — B1-B2 block model verification, waystone/tablet implicit regex verification, range update

Work Log:
- Analyzed in-game test results provided by user:
  - B1-B2: `.*` does NOT cross affix block boundaries — `"35%.*к сопротивлению молнии"` matches only +35% lightning ring, NOT +35% cold + +41% lightning ring
  - Waystone implicit reversed regex: `"Шанс выпадения путевого камня.*85%"` works ✅
  - Tablet implicit regex: `"Осталось зарядов.*3"` works ✅, `"алтари Ритуала"` works ✅
  - Waystone implicit ranges: increase from [0, 250] to [0, 350]
- Updated normalize.ts: IMPLICIT_RANGE_UNRESTRICTED changed from [0, 250] to [0, 350]
- Updated restructure-implicits.ts: All 4 waystone implicit token ranges changed from [[0, 250]] to [[0, 350]]
- Updated waystone.json: 4 implicit token ranges changed from [[0, 250]] to [[0, 350]]
- Updated waystone-desecrated.json: 4 implicit token ranges changed from [[0, 250]] to [[0, 350]]
- Updated STATUS.md: Removed P3 active problem (B1-B2 resolved), removed "Следующие шаги" section (all done), updated waystone ranges to [0, 350], added B1-B2 and implicit regex verification as completed
- Updated IN_GAME_TESTS.md: Rewrote Block Model section with verified results, added Waystone Implicit Regex and Tablet Implicit Regex verified sections, removed stale Active Test Battery section, cleaned up Waystone section
- Updated ETL_GUIDE.md: Range config updated from [0, 250] to [0, 350] with in-game verification note
- Updated ARCHITECTURE.md: Updated "NOT supported" to note B1-B2 verified for `.*` across blocks
- Updated AGENT_NAVIGATION.md: Removed stale TODO items (waystone #% mods in-game test, PoE2 regex dialect retest)
- Ran all 693 tests — all pass

Stage Summary:
- Block model B1-B2 VERIFIED: `.*` does NOT cross block boundaries (confirmed in-game)
- Waystone implicit reversed regex VERIFIED in-game
- Tablet implicit regex VERIFIED in-game
- Waystone implicit ranges updated to [0, 350]
- Documentation cleaned and all in-game test results documented
- All 693 tests pass

---
Task ID: 3
Agent: Main
Task: Fix broken GitHub Actions deployment (run #124, exit code 2)

Work Log:
- Analyzed failed CI run: `tsc -b` fails with TS6133 on 2 unused variables in test file
- Root cause: `tsconfig.app.json` included `["src", "tests", "scripts"]` — production build type-checked test files
- Fix: Changed `tsconfig.app.json` include to `["src"]` only — tests run via vitest, scripts via tsx
- Removed `@etl/*` path from tsconfig.app.json (not used by src/)
- Removed unused `belt27Simple` and `amulet25Simple` from waystone-anchor-tests.test.ts
- Verified: `pnpm build` succeeds, all 693 tests pass
- Updated docs: STATUS.md (cleaned), AGENT_NAVIGATION.md (test count, tsconfig invariant)

Stage Summary:
- Deploy fix: tsconfig.app.json include restricted to `["src"]` — architectural fix, not a workaround
- Build passes, 693 tests pass
- Documentation updated and cleaned

---
Task ID: 4
Agent: Main
Task: ETL refresh when poe2db updates, icon normalization, documentation cleanup

Work Log:
- Cloned repo and verified baseline: 693 tests pass, build succeeds
- Added ETL refresh capabilities to fetch-poe2db.ts:
  - `clearCache()` — deletes all cached HTML files
  - `getCacheInfo(url)` — returns CacheEntryInfo (age, size, hash, stale)
  - `hashContent(content)` — SHA-256 16-char prefix for change detection
  - Exported CACHE_TTL_MS constant (24h)
- Added CLI flags to run-etl.ts:
  - `--fresh` — clears cache before fetching (force re-download)
  - `--check-stale` — reports cache staleness per URL, exits with code 1 if any stale
  - `checkStale()` function — collects all source URLs, checks cache status, reports generated JSON sourceHash
- Added `sourceHash` field to CategoryData type (src/shared/types.ts)
- Updated generate-dictionary.ts: assembleCategoryData now accepts and stores sourceHash
- Updated run-etl.ts: computes sourceHash from all cached HTML files, passes to assembleCategoryData
- Added npm scripts: `etl:fresh`, `etl:check-stale`
- Normalized all icons in public/icons/ to 128x128 square canvases with transparent padding (Python PIL)
  - Previously: varying aspect ratios (belt 94x39, relic 45x89, etc.)
  - Now: uniform 128x128 with centered content and transparent padding
- Updated documentation:
  - STATUS.md: Added ETL refresh section, icon normalization mention
  - AGENT_NAVIGATION.md: Added §9 (ETL Refresh), §10 (Icon Normalization), cleaned TODO
  - ETL_GUIDE.md: Added §2 (ETL Refresh & Change Detection), renumbered sections
  - DATA_CONTRACTS.md: Added sourceHash to CategoryData
  - ARCHITECTURE.md: Version bump
- Verified: 693 tests pass, build succeeds

Stage Summary:
- ETL refresh: --fresh (clear cache), --check-stale (detect changes), sourceHash in generated JSON
- Icon normalization: all 13 icons → 128x128 square canvas with transparent padding
- Documentation cleaned and updated
- All 693 tests pass, build succeeds
