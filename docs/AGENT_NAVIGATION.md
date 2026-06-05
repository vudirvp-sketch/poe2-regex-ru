# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 5.0 | **Date:** 2026-06-05
> **Current Iteration:** 6 (Relic + Jewels + Waystone AST + Profile/Share UI)

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
| 0: Verification & Preparation | ✅ Complete | Docs created, in-game verification done |
| 1: Infrastructure + Bootstrap | ✅ Complete | Vite + routing + sidebar |
| 2: Core Engine | ✅ Complete | All core logic + 57 tests |
| 3: ETL Pipeline | ✅ Complete | 1,584 tokens, 8,664 optimizations across 10 categories |
| 4: Data Loader + UI Skeleton | ✅ Complete | Stores + components + page wiring |
| 5: Core -> UI Integration | ✅ Complete | All 5 main pages working + optimizer dedup + yofication |
| 6: Relic + Jewels + Waystone AST | 🔄 Partial | See below for remaining items |
| 7: Vendor | ❌ Not started | Requires in-game verification of RU property names |
| 8: Belts/Rings/Amulets | ✅ Complete (was Iter 5) | Already working in Iter 5 |
| 9: Polish + CI/CD | ❌ Not started | |

### Iteration 6 Details (Partial — Session 4)

**Done:**
- ✅ JewelPage created + route added + sidebar entry added
- ✅ RelicPage connected via useCategoryPage (was stub)
- ✅ Waystone AST integration: tier → RANGE, corrupted → literal("corr"), uncorrupted → exclude(literal("corr")), delirious → literal("delir")
- ✅ useCategoryPage hook now supports `extraAstNodes` parameter for category-specific AST additions
- ✅ ProfilePanel component created (save/load/delete/rename profiles)
- ✅ Share URL button added to RegexOutput (uses getShareableUrl from url-sync)
- ✅ All 57 tests passing, build passing

**NOT Done (for next session):**
- ❌ ProfilePanel NOT yet integrated into category pages (component exists but not imported)
- ❌ Share URL button in RegexOutput needs `filterStore` prop — NOT yet passed from category pages
- ❌ Waystone state toggles use English regex strings ("corr", "delir") — needs in-game verification in RU client to confirm they work or replace with Russian equivalents
- ❌ Waystone/tablet parser regex quality issues — mods still get overly short/generic regexes
- ❌ ETL re-run needed after parser fixes
- ❌ VendorPage still a stub — requires in-game verification of RU property names
- ❌ Mobile responsive polish
