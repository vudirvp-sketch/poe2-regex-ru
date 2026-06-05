# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 6.0 | **Date:** 2026-06-05
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
pnpm etl             # Run ETL pipeline
pnpm lint            # Lint code
```

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
| 2: Core Engine | ✅ Complete | All core logic + 59 tests |
| 3: ETL Pipeline | ✅ Complete | 1,584 tokens, 4,888 optimizations across 10 categories |
| 4: Data Loader + UI Skeleton | ✅ Complete | Stores + components + page wiring |
| 5: Core -> UI Integration | ✅ Complete | All 5 main pages working + optimizer dedup + yofication |
| 6: Relic + Jewels + Waystone AST | ✅ Complete | All pages + RU regex strings + ProfilePanel + Share URL |
| 7: Vendor | ✅ Complete | 50+ Russian property regexes (need in-game verification) |
| 8: Belts/Rings/Amulets | ✅ Complete | Already working since Iter 5 |
| 9: Polish + CI/CD | 🔄 Partial | Mobile responsive done, CI/CD not tested, see remaining items |

## 7. Known Issues & Remaining Work

### 🔴 HIGH PRIORITY — Requires In-Game Verification

1. **VendorPage regex strings** — 50+ Russian regex strings ("качеств", "гнёзд", "огню", "физическ", etc.) need in-game testing. The page has a warning banner about this. Some strings may not match actual in-game text.

2. **TabletPage type/rarity/uses regex strings** — New filters added in Session 8:
   - Type filter: "бездн", "делир", "экспед", "ритуал", "ваал"
   - Rarity filter: "обычн", "волшебн"
   - Uses remaining: suffix "исполь"
   - All need in-game verification. The page shows warnings for unverified strings.

3. **WaystonePage regex strings** — "оскверн" (Corrupted) ✅ VERIFIED, "делир" (Delirious) ✅ VERIFIED by user. No other strings need verification.

### 🟡 MEDIUM PRIORITY — Data Quality

4. **Waystone earth effect duplicates** — Tokens 72-83 have 4 copies each of "подожженной земли", "замерзшей земли", "заряженной земли". The optimizer's dedup phase collapses identical regex values, so functionally this works. But raw data has 4 duplicates per effect — could be cleaned in ETL or differentiated by tier.

5. **~51 tokens with English-only rawText** — poe2db.tw is missing Russian translations for these mods. Need manual translation or wait for poe2db.tw updates.

6. **"Регис" folder cross-validation** — The manual Russian mod lists in папка "регис" could be used to cross-validate ETL output. Not yet implemented.

### 🟢 LOW PRIORITY — Polish & Performance

7. **CI/CD** — deploy.yml exists but hasn't been tested with actual GitHub Pages deployment.

8. **Performance** — Large categories (belt 298, ring 366, amulet 427) may benefit from virtualized lists for smooth scrolling. Current implementation renders all items.

9. **[её] yofication in production** — Implemented but only applies when character budget allows. Could be more aggressive for short regexes.

10. **SEO + meta tags** — Not implemented.

11. **Landing page polish** — Home page exists but is basic.

## 8. Tablet Type Regex Reference

Tablet types in the Russian game client and their estimated regex substrings:

| Tablet Type | Russian Name (estimated) | Regex | Verified |
|-------------|--------------------------|-------|----------|
| Breach | Башня Бездны Предтеч | `бездн` | ❌ Needs verification |
| Delirium | Башня Делириума Предтеч | `делир` | ❌ Needs verification |
| Expedition | Башня Экспедиции Предтеч | `экспед` | ❌ Needs verification |
| Ritual | Башня Ритуала Предтеч | `ритуал` | ❌ Needs verification |
| Vaal | Башня Ваал Предтеч | `ваал` | ❌ Needs verification |

Rarity:
| Rarity | Russian Name (estimated) | Regex | Verified |
|--------|--------------------------|-------|----------|
| Normal | Обычный | `обычн` | ❌ Needs verification |
| Magic | Волшебный | `волшебн` | ❌ Needs verification |

Uses remaining:
| Property | Display Text (estimated) | Regex Suffix | Verified |
|----------|-------------------------|--------------|----------|
| Uses | Осталось использований: N | `исполь` | ❌ Needs verification |
