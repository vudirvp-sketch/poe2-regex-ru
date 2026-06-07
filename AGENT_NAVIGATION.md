# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 59.0 | **Date:** 2026-06-08

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Business logic. Pure TS, no React. | **Tests mandatory.** No DOM/React/Zustand imports. |
| `src/strategies/` | Locale-specific logic. Currently only RU. | Can import from `src/shared/` and `src/core/`. |
| `src/ui/` | React components. | Each file < 300 lines. Import from `@core`, `@shared`, `@data`, `@store`. |
| `src/store/` | Zustand stores. | One store per domain. Import from `@shared`. |
| `src/data/` | JSON loading. | Proxies `fetch()` -> typed objects. Import from `@shared`. |
| `src/shared/` | Types, constants, i18n, classifier. | **No imports from other src/ directories.** |
| `scripts/etl/` | ETL pipeline + iterative optimizer. | Run via `pnpm etl`. Output to `public/generated/`. |
| `scripts/analyze-fn.ts` | FN/FP analysis per category. | Run via `pnpm analyze-fn`. |
| `scripts/etl/iterative-optimizer.ts` | Iterative regex optimizer (Phase 5). | Run via `pnpm optimize` or `pnpm optimize:dry`. |
| `public/generated/` | Read-only artifacts. | **NEVER edit manually.** Created only by ETL. |
| `tests/` | Test files. | Mirror `src/` structure. 487 tests. |
| `регис/` | Manual Russian mod lists + analysis reports. | Reference data for cross-validation. |

## 2. Build Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server
pnpm build           # Production build
npx vitest run --root . # Run tests (487 tests, Vitest)
pnpm etl             # Run ETL pipeline (requires network or .etl-cache/)
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
- [ ] `npx vitest run --root .` passes (487 tests)
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

*(none currently)*

### MEDIUM

1. **Jewel classification accuracy** — ETL lookup for normal jewels; heuristic fallback (~84%) for desecrated/corrupted.
2. **Number regex length** — `[0-9]` is 5 chars vs `.` (1 char). Some RANGE regexes may exceed 250 limit.

### LOW

1. **Browser functional testing** — VirtualizedModList needs manual testing: scroll, search, chip clicks, per-token ranges (value-only groups), dual-slot ranges, jewel type sub-headers.

## 7. Bug Fixes (Session 59)

| Fix | File | Description |
|-----|------|-------------|
| clearSelections clears perTokenRanges | `filter-store.ts` | `clearSelections()` now also resets `perTokenRanges: {}` — prevents ghost range values after clearing |
| toggleToken/toggleTokens cleanup | `filter-store.ts` | When deselecting tokens, their `perTokenRanges` entries are now removed — prevents stale range overrides on re-selection |
| Auto URL sync | `useCategoryPage.ts` | Filter state auto-syncs to URL hash on every change (via `syncToUrl`), so users can copy URL from address bar |
| ProfilePanel restore | `useCategoryPage.ts` | `restoreFilterState()` now syncs React state (excludeMode, searchLogic, round10, min/max) from restored store values — fixes stale UI controls after loading a profile |
| VendorPage searchLogic | `VendorPage.tsx` | AST building now respects `searchLogic` — OR mode puts all items in one OR group, AND mode (default) keeps separate groups |
| URL sync imports | `useCategoryPage.ts` | Merged extraState sync + URL sync into single effect to guarantee correct serialization order |

## 8. Regex Strategy Pipeline

The `computeMinimalUniqueSubstring()` function in `scripts/etl/compute-regex.ts` tries strategies in order:

| Strategy | Name | Description |
|----------|------|-------------|
| 1 | Template-family suffix | Text after last `##` in template |
| 1b | Suffix lengthening | Include text between `##` and suffix |
| 1c | Full second stat | Dual-stat template suffix join |
| 1d | Negation | Suffix + short exclude patterns |
| 1e | Word Truncation | Truncate words + optional negate |
| 1f | AND-composed Context | regexPrefixContext + regex |
| 2 | Substring fallback | Brute-force unique substring search |

## 9. Optimization Pipeline

`computeOptimizations()` in `scripts/etl/compute-optimizations.ts`:

| Phase | Name | Description |
|-------|------|-------------|
| A | Family-based grouping | Tokens sharing a familyKey get one shared regex |
| A1 | Word truncation | Try Strategy 1e truncation on Phase A shared regexes |
| B | DP factorization | Cross-family groups factorized via `batchDPFactorize()` |
| C | Dialect optimization | `[её]`, `[юя]`, `ь?` applied to all regexes |

## 10. Oracle API

Two validation modes in `src/core/regex-oracle.ts`:

| Function | Matching | Use case |
|----------|----------|----------|
| `validateRegex()` | Flat-text (`matchQuotedGroup`) | ETL single-mod validation |
| `validateRegexItem()` | Block-based (`matchPoE2RegexItem`) | In-game behavior simulation |
| `batchValidate()` | Flat-text, batch | ETL --validate |
| `batchValidateItem()` | Block-based, batch | ETL --validate-item |

FP categorization: `familyTierFP` = same familyKey (by design), `crossFamilyFP` = different familyKey (real bugs).

## 11. Dual-Slot Range Filtering

`TokenRangeOverride` supports `slotOverrides` for simultaneous filtering of both placeholders in dual-number mods.

- `slotOverrides: Record<number, SlotRangeOverride>` — per-slot min/max overrides
- When `slotOverrides` is set, `filterSlotIndex`/`min`/`max` are ignored
- AST builder generates separate RANGE nodes for each active slot, ANDed together
- FilterChip shows two rows of inputs (1е/2е) for multi-placeholder mods
- Serialization format: `[tokenId, min, max, filterSlotIndex, slotIdx, sMin, sMax, ...]`

## 12. regexExclude & regexPrefixContext

Two mechanisms for cross-family FP prevention. Excludes preferred for short markers; context preferred when suffix appears in both target and conflicts. Can combine both.
