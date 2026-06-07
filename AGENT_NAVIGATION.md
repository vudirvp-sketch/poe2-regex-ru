# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 37.0 | **Date:** 2026-06-07

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
| `scripts/etl/` | ETL pipeline + iterative optimizer. | Run via `pnpm etl`. Output to `public/generated/`. |
| `scripts/analyze-regexes.ts` | Regex quality analysis. | Run via `npx tsx scripts/analyze-regexes.ts`. |
| `scripts/analyze-fn.ts` | FN/FP analysis per category. | Run via `pnpm analyze-fn`. |
| `scripts/etl/iterative-optimizer.ts` | Iterative regex optimizer (Phase 5). | Run via `pnpm optimize` or `pnpm optimize:dry`. |
| `public/generated/` | Read-only artifacts. | **NEVER edit manually.** Created only by ETL. |
| `tests/` | Test files. | Mirror `src/` structure. 452 tests. |
| `регис/` | Manual Russian mod lists + analysis reports. | Reference data for cross-validation. |

## 2. Build Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server
pnpm build           # Production build
npx vitest run --root . # Run tests (452 tests, Vitest)
pnpm etl             # Run ETL pipeline (requires network)
pnpm etl -- --validate       # Run ETL + flat-text Oracle validation
pnpm etl -- --validate-item  # Run ETL + block-based Oracle validation (accurate in-game sim)
pnpm analyze-fn      # Analyze FN/FP per category
pnpm optimize        # Run iterative optimizer on generated JSON
pnpm optimize:dry    # Dry-run optimizer with verbose output
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
- [ ] `npx vitest run --root .` passes (452 tests)
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

1. **In-game regex verification** — See `docs/IN_GAME_TESTS.md` groups G-L

### MEDIUM

2. **`к силе` cross-family FP** — Simple regex `к силе` matches composite mods like `+(9—15) к силе и интеллекту`. Affects amulet (95), belt (11), ring (49). Needs longer regex generation.
3. **jewel-desecrated 16 cross-family FP** — Many short regexes match across families. Needs investigation.
4. **Per-token dual-number RANGE filtering** — Second placeholder overrides not supported
5. **HomePage hardcoded mod counts** — Category cards show stale counts

### LOW

6. **Jewel classification accuracy** — ETL lookup for normal jewels; heuristic fallback (~84%) for desecrated/corrupted
7. **List virtualization** — belt (298), ring (366), amulet (427) tokens
8. **Number regex length increase** — `[0-9]` is 5 chars vs `.` (1 char). Some RANGE regexes may exceed 250 limit after ETL re-run

## 7. Data Stats (Block-based Oracle, Session 43)

| Category | Tokens | Valid | Cross-FP | Family-FP | FN |
|----------|--------|-------|----------|-----------|----|
| waystone | 97 | 93 | 1 | 76 | 3 |
| waystone-desecrated | 17 | 16 | 1 | 2 | 0 |
| tablet | 75 | 70 | 5 | 0 | 0 |
| jewel | 193 | 178 | 15 | 0 | 0 |
| jewel-desecrated | 32 | 16 | 16 | 0 | 0 |
| jewel-corrupted | 10 | 9 | 1 | 0 | 0 |
| relic | 58 | 58 | 0 | 0 | 0 |
| belt | 298 | 287 | 11 | 239 | 0 |
| ring | 366 | 317 | 49 | 267 | 0 |
| amulet | 427 | 332 | 95 | 283 | 0 |
| **Total** | **1,573** | **1,376** | **194** | **924** | **3** |

Note: Family-tier FP (924) are "by design" — same mod family, different tiers sharing one regex. Cross-family FP (194) are real bugs needing regex fixes.

## 8. Oracle API (Phase 8)

Two validation modes in `src/core/regex-oracle.ts`:

| Function | Matching | Use case |
|----------|----------|----------|
| `validateRegex()` | Flat-text (`matchQuotedGroup`) | ETL single-mod validation |
| `validateRegexItem()` | Block-based (`matchPoE2RegexItem`) | In-game behavior simulation |
| `batchValidate()` | Flat-text, batch | ETL --validate |
| `batchValidateItem()` | Block-based, batch | ETL --validate-item (Session 43) |

FP categorization (all functions):
- `OracleResult.familyTierFP` — FP from same familyKey (by design)
- `OracleResult.crossFamilyFP` — FP from different familyKey (real bugs)
- `valid = true` when NO cross-family FP and no FN
