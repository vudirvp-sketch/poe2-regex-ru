# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 28.0 | **Date:** 2026-06-06

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Business logic. Pure TS, no React. | **Tests mandatory.** No DOM/React/Zustand imports. |
| `src/strategies/` | Locale-specific logic. Currently only RU. | Can import from `src/shared/` and `src/core/`. |
| `src/ui/` | React components. | Each file < 250 lines. Import from `@core`, `@shared`, `@data`, `@store`. |
| `src/store/` | Zustand stores. | One store per domain. Import from `@shared`. |
| `src/data/` | JSON loading. | Proxies `fetch()` -> typed objects. Import from `@shared`. |
| `src/shared/` | Types, constants, i18n, classifier. | **No imports from other src/ directories.** |
| `scripts/etl/` | ETL pipeline. | Run via `pnpm etl`. Output to `public/generated/`. |
| `scripts/analyze-regexes.ts` | Regex quality analysis. | Run via `npx tsx scripts/analyze-regexes.ts`. |
| `public/generated/` | Read-only artifacts. | **NEVER edit manually.** Created only by ETL. |
| `tests/` | Test files. | Mirror `src/` structure. 213 tests. |
| `регис/` | Manual Russian mod lists + analysis reports. | Reference data for cross-validation. |

## 2. Build Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server
pnpm build           # Production build
npx vitest run --root . # Run tests (213 tests, Vitest)
pnpm etl             # Run ETL pipeline (requires network)
npx tsx scripts/analyze-regexes.ts  # Analyze regex quality
```

## 3. Agent Workflow

1. Read `docs/ARCHITECTURE.md` and `docs/DATA_CONTRACTS.md`
2. Read `worklog.md` to understand what's already done
3. Execute the current iteration's tasks
4. Write tests for new code
5. Run `npx vitest run --root .` and `pnpm build` — both must pass
6. Update `worklog.md` with what was done
7. **NEVER** touch `public/generated/` manually

## 4. Pre-Commit Checklist

- [ ] `pnpm build` passes without errors
- [ ] `npx vitest run --root .` passes (213 tests)
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

### HIGH

1. **Push fixes to GitHub** — Local TS fixes not pushed to main → CI broken
2. **In-game regex verification** — See `docs/IN_GAME_TESTS.md` (rewritten with hypothesis-based tests)
3. **Re-run ETL** — jewel-desecrated now in STRICT_CATEGORIES with MIN=10, need `pnpm etl` to regenerate JSON

### MEDIUM

4. **Cross-category regex conflicts** — 4002 conflicts found (see `регис/analysis-report.md`). Most are benign (amulet/ring/belt share mod types) but short regexes like "молнии" (6 chars) are problematic
5. **jewel-corrupted avg regex length = 7.4** — Consider adding to STRICT_CATEGORIES
6. **Icon proportions** — relic/vendor/belt PNGs have more transparent padding than others
7. **Per-token dual-number RANGE filtering** — Second placeholder overrides not supported
8. **HomePage hardcoded mod counts** — Category cards show stale counts

### LOW

9. **Jewel classification accuracy** — ETL lookup works for normal jewels; heuristic fallback (~84%) for desecrated/corrupted
10. **List virtualization** — belt (298), ring (366), amulet (427) tokens

## 7. Data Stats

| Category | Tokens | Optimizations | Avg Regex Len | Short (<10) | Conflicts |
|----------|--------|---------------|---------------|-------------|-----------|
| waystone | 96 | 52 | 12.4 | 52 | 52 |
| waystone-desecrated | 16 | 4 | 9.7 | 12 | 14 |
| tablet | 75 | 363 | 19.1 | 23 | 8 |
| jewel | 193 | 1,466 | 15.7 | 49 | 72 |
| jewel-desecrated | 21 | 3 | 19.7 | 7 | 16 |
| jewel-corrupted | 10 | 0 | 7.4 | 8 | 8 |
| relic | 58 | 28 | 18.3 | 20 | 16 |
| belt | 298 | 231 | 17.6 | 54 | 236 |
| ring | 366 | 458 | 14.7 | 94 | 293 |
| amulet | 427 | 389 | 15.1 | 121 | 395 |
| **Total** | **1,560** | | | **440** | |
