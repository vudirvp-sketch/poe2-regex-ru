# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 26.0 | **Date:** 2026-06-06
> **Current Iteration:** 23 (ETL Re-run + Dual-Number UI + Number Boundary Warning) — COMPLETE.
> **Status:** 213 tests pass, build passes locally. GitHub Actions needs push.

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Business logic. Pure TS, no React. | **Tests mandatory.** No DOM/React/Zustand imports. |
| `src/strategies/` | Locale-specific logic. Currently only RU. | Can import from `src/shared/` and `src/core/`. |
| `src/ui/` | React components. | Each file < 250 lines. Import from `@core`, `@shared`, `@data`, `@store`. |
| `src/store/` | Zustand stores. | One store per domain. Import from `@shared`. |
| `src/data/` | JSON loading. | Proxies `fetch()` -> typed objects. Import from `@shared`. |
| `src/shared/` | Types, constants, i18n, classifier. | **No imports from other src/ directories.** Lowest layer. |
| `scripts/etl/` | ETL pipeline. | Run via `pnpm etl`. Output to `public/generated/`. |
| `scripts/etl/i18n-overrides.json` | Manual Russian translations + typo fixes. | 57 overrides. Applied automatically after ETL. |
| `public/generated/` | Read-only artifacts. | **NEVER edit manually.** Created only by ETL. |
| `tests/` | Test files. | Mirror `src/` structure. 213 tests. |
| `регис/` | Manual Russian mod lists. | Reference data for cross-validation. |

## 2. Build Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server
pnpm build           # Production build
pnpm test            # Run tests (213 tests, Vitest)
pnpm etl             # Run ETL pipeline (requires network)
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

## 6. Known Issues & Remaining Work

### 🔴 HIGH — Next Iteration

1. **Push fixes to GitHub** — Local TS fixes not pushed to main → CI broken
2. **In-game regex verification** — Test EACH regex separately (AND vs OR!). See `docs/IN_GAME_TESTS.md` tests 1-22
3. **`\d` in-game verification** — If `\d` doesn't work in PoE2, replace with `[0-9]` in `number-regex.ts` (currently uses `\d`, was verified once)
4. **jewelType — all "shared"** — Type A parser (jewels) doesn't extract modCode → `buildJewelTypeMap()` can't match. All 193 jewel tokens get `jewelType: "shared"`. Fix: extract modCode from Type A HTML tables or match by rawText

### 🟡 MEDIUM

5. **Desecrated regex quality** — Dual-stat mods get regex from fallback (e.g. `"и, (4—8)% увеличение урона т"`)
6. **Full Очернённые audit** — Verify origin classification across ALL categories
7. **HomePage hardcoded mod counts** — Category cards show stale counts after data updates
8. **Per-token dual-number RANGE filtering** — Second placeholder overrides not supported

### 🟢 LOW

9. **Jewel classification accuracy** — ~84% with weighted scoring; could be improved with static lookup table
10. **List virtualization** — belt (298), ring (366), amulet (427) tokens
11. **TabletPage PageStateWrapper** — Still has inline loading/error/no-data pattern

## 7. Data Stats

| Category | Tokens | Optimizations |
|----------|--------|---------------|
| waystone | 96 | 52 |
| waystone-desecrated | 16 | 4 |
| tablet | 75 | 363 |
| jewel | 193 | 1,466 |
| jewel-desecrated | 21 | 3 |
| jewel-corrupted | 10 | 0 |
| relic | 58 | 28 |
| belt | 298 | 231 |
| ring | 366 | 458 |
| amulet | 427 | 389 |
| **Total** | **1,560** | |
