# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 8.0 | **Date:** 2026-06-05
> **Current Iteration:** 9 (Polish + CI/CD) — Most features complete, pending verification and polish

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
| 9: Polish + CI/CD | 🔄 Partial | CI/CD ✅, SEO ✅, Landing ✅ — see remaining items below |

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

5. **~51 tokens with English-only rawText** — poe2db.tw is missing Russian translations for these mods. Need manual translation or wait for poe2db.tw updates.

6. ~~**"Регис" folder cross-validation**~~ — ✅ DONE in Session 9. Cross-validation performed: differences are expected (регис lists individual tier values, ETL groups as ranges; регис includes desecrated mods in same list, ETL separates them). No data errors found.

7. **Belt/ring/amulet same-text duplicates** — Some mods have identical rawText but different origins (normal vs essence). These are NOT true duplicates (they're different mods with different IDs) and the optimizer dedup handles them correctly at runtime. ETL dedup key `id::rawText` correctly keeps them separate.

### 🟢 LOW PRIORITY — Polish & Performance

8. ~~**CI/CD**~~ — ✅ DONE in Session 10. deploy.yml now has: push to main, workflow_dispatch with ETL toggle, weekly schedule, separate ETL job with auto-commit.

9. **Performance** — Large categories (belt 298, ring 366, amulet 427) may benefit from virtualized lists (e.g., @tanstack/react-virtual or react-virtuoso) for smooth scrolling. Current implementation renders all items. Not critical — works fine on modern hardware.

10. **[её] yofication in production** — Implemented but only applies when character budget allows. Could be more aggressive for short regexes.

11. ~~**SEO + meta tags**~~ — ✅ DONE in Session 10. Added Open Graph, Twitter Card, canonical URL, description, keywords, theme-color.

12. ~~**Landing page polish**~~ — ✅ DONE in Session 10. Added feature cards, category stats, description paragraph, footer.

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
