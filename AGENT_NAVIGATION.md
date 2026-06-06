# PoE2 Regex Architect — Agent Navigation Guide

> **Version:** 25.0 | **Date:** 2026-06-06
> **Current Iteration:** Iteration 21 (ETL Re-run + Critical Bug Fixes) — COMPLETE.
> **Summary:** ETL re-run, fractional ranges, suffix lengthening, desecrated dual-stat <br> fix, origin classification fix, FilterChip prefix indicator. 213 tests pass.

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
| `scripts/etl/i18n-overrides.json` | Manual Russian translations + typo fixes. | Applied automatically after ETL. 55 overrides. |
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

## 4. Iteration Status

| Iteration | Status | Summary |
|-----------|--------|---------|
| 0-16 | ✅ Complete | Core engine, ETL, UI, vendor, CI/CD, i18n, jewel filter |
| 17-19 | ✅ Complete | Jewel sub-groups, per-mod numeric filter, scoring cleanup |
| 20 | ✅ Complete | Prefix anchoring (regexPrefix field) |
| **21** | **✅ Complete** | **ETL re-run, fractional ranges, suffix lengthening, desecrated dual-stat <br> fix, origin classification fix, FilterChip prefix indicator** |

## 5. Known Issues & Remaining Work

### 🔴 HIGH — Next Iteration

1. **In-game regex verification** — Test EACH regex separately (AND vs OR confusion!)
2. **`\d` support in PoE2** — If `\d` doesn't work in PoE2 client, replace with `[0-9]` in `number-regex.ts`
3. **Full Очернённые audit** — Verify origin classification across ALL categories
4. **Two-number mods** — "От ## до ## урона" should filter by FIRST number

### 🟡 MEDIUM

5. **Desecrated regex quality** — Dual-stat mods get regex from fallback (e.g. `"и, (4—8)% увеличение урона т"`)
6. **VendorPage regex strings** — 50+ strings need in-game testing
7. **TabletPage regex strings** — Need in-game verification

### 🟢 LOW

8. **Jewel classification accuracy** — ~84% with weighted scoring
9. **List virtualization** — belt (298), ring (366), amulet (427) tokens

## 6. Iteration 21 Changes Summary

| File | Change |
|------|--------|
| `scripts/etl/normalize.ts` | Fractional range support (`parseFloat`), dual-stat mod `<br>` join when multiple segments have `mod-value` with ndash |
| `scripts/etl/compute-regex.ts` | `extractExtendedSuffix()` for suffix lengthening; `extractTemplateSuffix` fixed for multiple `##`; skip extended suffix if it contains `##` |
| `src/shared/mod-classifier.ts` | Origin mode uses `splitGroupByOrigin()` instead of first-non-normal origin |
| `src/ui/components/FilterChip.tsx` | ⚓ prefix indicator when selected and has regexPrefix |
| `src/ui/hooks/useCategoryPage.ts` | TS fix: `prefix: prefix` instead of `prefix || undefined` |
| `scripts/etl/i18n-overrides.json` | Added `вамиИстощения` → `вами Истощения` typo fix (55 overrides total) |
| `tests/etl/compute-optimizations.test.ts` | Added `regexPrefix: ''` to test helper |
| `tests/shared/family-grouper.test.ts` | Added `regexPrefix: { ru: '' }` to test helper |
| `public/generated/*.json` | All 10 category JSONs regenerated via ETL re-run |
