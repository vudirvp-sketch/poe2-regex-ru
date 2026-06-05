# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 14.0 | **Date:** 2026-06-06
> **Current Iteration:** 9 (Polish + CI/CD) — COMPLETE. See новый_план.md for remaining work.
> **GitHub Pages:** Fixed in Session 17. Replaced pnpm/action-setup with corepack enable. User must set Source to "GitHub Actions" in repo Settings -> Pages.

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Business logic. Pure TS, no React. | **Tests mandatory.** No DOM/React/Zustand imports. |
| `src/strategies/` | Locale-specific logic. Currently only RU. | Can import from `src/shared/` and `src/core/`. |
| `src/ui/` | React components. | Each file < 250 lines. Import from `@core`, `@shared`, `@data`, `@store`. |
| `src/store/` | Zustand stores. | One store per domain. Import from `@shared`. |
| `src/data/` | JSON loading. | Proxies `fetch()` -> typed objects. Import from `@shared`. |
| `src/shared/` | Types, constants, i18n. | **No imports from other src/ directories.** This is the lowest layer. |
| `scripts/etl/` | ETL pipeline. | Run via `pnpm etl`. Output to `public/generated/`. |
| `scripts/etl/i18n-overrides.json` | Manual Russian translations for tokens without Russian text on poe2db.tw. | Applied automatically after ETL. Edit when new overrides needed. |
| `public/generated/` | Read-only artifacts. | **NEVER edit manually.** Created only by ETL. |
| `tests/` | Test files. | Mirror `src/` structure. |
| `docs/` | Documentation. | Read before starting each iteration. |
| `worklog.md` | Agent work log. | Append-only. Never overwrite. |
| `регис/` | Manual Russian mod lists. | Reference data for cross-validation with ETL output. |

## 2. Build Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server
pnpm build           # Production build
pnpm test            # Run tests (Vitest)
pnpm etl             # Run ETL pipeline (requires network)
pnpm lint            # Lint code
```

**Important:** `pnpm etl` requires network access to fetch data from poe2db.tw. If running in CI or a sandboxed environment, skip this step and use the existing JSON files in `public/generated/`.

## 3. Agent Workflow

1. Read `docs/ARCHITECTURE.md` and `docs/DATA_CONTRACTS.md`
2. Read `worklog.md` to understand what's already done
3. Execute the current iteration's tasks
4. Write tests for new code
5. Run `pnpm test` and `pnpm build` — both must pass
6. Update `worklog.md` with what was done
7. **NEVER** touch `public/generated/` manually

## 4. Pre-Commit Checklist

- [ ] `pnpm build` passes without errors
- [ ] `pnpm test` passes
- [ ] No `any` types (except merge functions)
- [ ] No hardcoded mod strings in UI/Engine code
- [ ] New files are in the correct directories
- [ ] `worklog.md` is updated

## 5. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
  ^        ^        ^          ^       ^      ^
  +--------+--------+----------+-------+------+
  (shared can be imported by everyone, nothing imports from ui)
```

- `shared` -> imports nothing from `src/`
- `core` -> imports only from `shared`
- `strategies` -> imports from `shared`, `core`
- `store` -> imports from `shared`, `core`, `strategies`
- `data` -> imports from `shared`
- `ui` -> imports from everyone

## 6. Iteration Status

| Iteration | Status | Notes |
|-----------|--------|-------|
| 0: Verification & Preparation | ✅ Complete | Docs created, in-game regex dialect verified |
| 1: Infrastructure + Bootstrap | ✅ Complete | Vite + routing + sidebar + dark theme + deploy.yml |
| 2: Core Engine | ✅ Complete | All core logic + 76 tests |
| 3: ETL Pipeline | ✅ Complete | 1,584 tokens, 4,888 optimizations across 10 categories |
| 4: Data Loader + UI Skeleton | ✅ Complete | Stores + components + page wiring |
| 5: Core -> UI Integration | ✅ Complete | All 5 main pages working + optimizer dedup + yofication |
| 6: Relic + Jewels + Waystone AST | ✅ Complete | All pages + RU regex strings + ProfilePanel + Share URL |
| 7: Vendor | ✅ Complete | 50+ Russian property regexes (need in-game verification) |
| 8: Belts/Rings/Amulets | ✅ Complete | Already working since Iter 5 |
| 9: Polish + CI/CD | ✅ Complete | 109 tests, deploy.yml fixed, .nojekyll added. See новый_план.md for post-MVP work |

## 7. Known Issues & Remaining Work

### 🔴 HIGH PRIORITY — Requires In-Game Verification

1. **VendorPage regex strings** — 50+ Russian regex strings ("качеств", "гнёзд", "огню", "физическ", etc.) need in-game testing. The page has a warning banner about this. Some strings may not match actual in-game text.

2. **TabletPage type/rarity/uses regex strings** — Filters updated in Session 9:
   - Type filter: "бездн", "делир", "ритуал", "ваал" (Экспедиция removed — no expedition tablets in game)
   - Rarity filter: "обычн", "волшебн", "редк" (Редкий added — rare tablets exist in game)
   - Uses remaining: suffix "использ" (changed from "исполь", max extended to 30)
   - All need in-game verification. The page shows warnings for unverified strings.

3. **WaystonePage regex strings** — "оскверн" (Corrupted) ✅ VERIFIED, "делир" (Delirious) ✅ VERIFIED by user. No other strings need verification.

### 🟡 MEDIUM PRIORITY — Data Quality

4. ~~**Waystone earth effect duplicates**~~ — ✅ FIXED in Session 9. ETL now deduplicates by rawText+id across all categories. Earth effects are no longer duplicated.

5. **~51 tokens with English-only rawText** — ✅ FIXED in Session 17. Created `scripts/etl/i18n-overrides.json` with manual Russian translations for the 3 tokens that poe2db.tw doesn't translate. Override system is integrated into ETL pipeline (`run-etl.ts`). Now 0 English-only tokens remain.

6. ~~**"Регис" folder cross-validation**~~ — ✅ DONE in Session 9. Cross-validation performed: differences are expected (регис lists individual tier values, ETL groups as ranges; регис includes desecrated mods in same list, ETL separates them). No data errors found.

7. **Belt/ring/amulet same-text duplicates** — Some mods have identical rawText but different origins (normal vs essence). These are NOT true duplicates (they're different mods with different IDs) and the optimizer dedup handles them correctly at runtime. ETL dedup key `id::rawText` correctly keeps them separate.

### 🟢 LOW PRIORITY — Polish & Performance

8. ~~**CI/CD**~~ — ✅ DONE in Session 10, updated in Sessions 15 and 17. deploy.yml now uses `corepack enable` instead of `pnpm/action-setup@v4` (which was failing). Node version 22. **Updated in Session 17:** Replaced `pnpm/action-setup@v4` with `corepack enable` (fixes pnpm/action-setup@v4 failure), added explicit `permissions: pages: write, id-token: write` to deploy job.

9. ~~**Character Health Bar**~~ — ✅ DONE in Session 11. RegexOutput now has visual green/yellow/red progress bar instead of poe2.re's invisible gray text. Sticky positioning so output stays visible while scrolling.

10. ~~**VendorPage number regex bugs**~~ — ✅ FIXED in Session 11. Replaced hand-rolled `generateVendorNumberRegex()` with core AST+compiler. Fixed 3 bugs: missing 3-digit alternatives, missing multi-digit alternatives for single-digit thresholds, and over-matching for ≥100 thresholds. Added round10 toggle.

11. **Performance** — Large categories (belt 298, ring 366, amulet 427) may benefit from virtualized lists (e.g., @tanstack/react-virtual or react-virtuoso) for smooth scrolling. Current implementation renders all items. Not critical — works fine on modern hardware.

12. ~~**[её] yofication in production**~~ — ✅ IMPROVED in Session 13. Now uses substring fallback when exact token regex is not found after optimizer Phase 2. Still limited by optimization table entries not tracking yofication positions, but this is acceptable (game treats е/ё as equivalent).

13. ~~**SEO + meta tags**~~ — ✅ DONE in Session 10. Added Open Graph, Twitter Card, canonical URL, description, keywords, theme-color.

14. ~~**Landing page polish**~~ — ✅ DONE in Session 10. Added feature cards, category stats, description paragraph, footer.

15. ~~**URL sharing for category-specific state**~~ — ✅ DONE in Session 13. Waystone (corrupted/uncorrupted/delirious), Tablet (type/rarity/uses), and Vendor (all state) now sync to filter store's `extraState` field, which is serialized into share URLs via `x` key.

16. ~~**RANGE.max compilation**~~ — ✅ DONE in Session 13. Added `generateMaxNumberRegex()` to number-regex.ts and updated compiler.ts to handle max-only RANGE nodes. When both min and max are specified, min takes priority (well-tested path).

17. ~~**VendorPage Share button**~~ — ✅ DONE in Session 13. VendorPage now creates its own filter store, syncs state to it, and passes it to RegexOutput, enabling the "Поделиться" (Share) button.

### 🔵 REMAINING — Future Work

18. ~~**URL restoration on page load**~~ — ✅ DONE in Session 14. `syncFromUrl()` is now called synchronously on first render in `useCategoryPage` (via `useState` initializer) and in `VendorPage`. Restored state includes: `selectedIds`, `searchText`, `affixFilter`, `originFilter`, `extraState` (category-specific toggles), and generic state (`excludeMode`, `minValue`, `round10Enabled`). Race condition between sync/restore effects fixed using `syncReadyRef` pattern.

19. **Full min+max RANGE intersection** — When both min and max are specified on a RANGE node, the current implementation uses only min. Full intersection (min ≤ x ≤ max) would require generating regex that matches numbers in a specific range, which is complex for PoE2 regex dialect.

20. **RANGE.max in-game verification** — The `generateMaxNumberRegex` function is unit-tested (14 tests in `tests/core/max-number-regex.test.ts`, added Session 15) but hasn't been tested with actual in-game searches. The regex patterns use the same PoE2 dialect features (`.`, `[]`, `|`) as the min version.

21. **New test suites (Session 15):** Three new test files added:
    - `tests/core/max-number-regex.test.ts` (14 tests) — focused tests for `generateMaxNumberRegex()` covering 1-digit, 2-digit, 3-digit, round10, and edge cases
    - `tests/core/vendor-patterns.test.ts` (10 tests) — vendor-specific regex compilation patterns (single prop, OR groups, EXCLUDE(OR), mixed AND+OR+EXCLUDE, numeric+property, movement speed, resistances, item classes)
    - `tests/etl/cross-validation.test.ts` (9 tests) — ETL vs регис cross-validation, token count ranges, data integrity checks, MIN_REGEX_LEN enforcement

## 8. Tablet Type Regex Reference

Tablet types in the Russian game client and their estimated regex substrings:

| Tablet Type | Russian Name (estimated) | Regex | Verified |
|-------------|--------------------------|-------|----------|
| Breach | Башня Бездны Предтеч | `бездн` | ❌ Needs verification |
| Delirium | Башня Делириума Предтеч | `делир` | ❌ Needs verification |
| ~~Expedition~~ | ~~Башня Экспедиции Предтеч~~ | ~~`экспед`~~ | ⛔ Removed — no expedition tablets in game yet |
| Ritual | Башня Ритуала Предтеч | `ритуал` | ❌ Needs verification |
| Vaal | Башня Ваал Предтеч | `ваал` | ❌ Needs verification |

Rarity:
| Rarity | Russian Name (estimated) | Regex | Verified |
|--------|--------------------------|-------|----------|
| Normal | Обычный | `обычн` | ❌ Needs verification |
| Magic | Волшебный | `волшебн` | ❌ Needs verification |
| Rare | Редкий | `редк` | ❌ Needs verification (added in Session 9) |

Uses remaining:
| Property | Display Text (estimated) | Regex Suffix | Verified |
|----------|-------------------------|--------------|----------|
| Uses | Осталось использований: N | `использ` | ❌ Needs verification (changed from "исполь") |

Max uses can exceed 18 — temple tablets with 19+ charges observed in-game.

## 9. Cross-Validation Results (Session 9)

Cross-validation between ETL output and папка "регис" manual mod lists:

| Category | ETL Tokens | Регис Mods | In Регис but not ETL | In ETL but not Регис |
|----------|-----------|------------|---------------------|---------------------|
| waystone | 106 | 121 | 37 | 12 |
| tablet | 78 | 50 | 13 | 37 |

**Differences explained:**
- Регис lists individual tier values (10%, 16%, 25%...) while ETL groups as ranges (5-9%, 10-14%...) — this is expected
- Регис includes desecrated mods in same list, ETL separates into waystone-desecrated.json
- Some ETL tokens have negative ranges ("-4--3%") not present in регис format
- No data errors found — the differences are structural, not content errors
