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
- [ ] 3.9 Run ETL, commit first JSONs — NOT YET (needs real poe2db.tw data)
- [ ] 3.10 Manual in-game verification — user task

**Build verification:** `pnpm build` passes, `pnpm test` passes (55/55 tests)

### Stopping Point
Completed Iterations 0-3 (code). Next steps:
- **Iteration 3 remaining:** Run ETL to generate real JSON files from poe2db.tw, verify output
- **Iteration 4:** Data Loader + UI Skeleton (filter-store, profile-store, url-sync, shared UI components)
- **Iteration 5:** Core -> UI Integration (Waystone + Tablet pages fully working)
- **Iterations 6-9:** Relic/Jewels, Vendor, Belts/Rings/Amulets, Polish + CI/CD
