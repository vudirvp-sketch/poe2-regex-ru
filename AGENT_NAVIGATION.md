# PoE2 Regex RU — Agent Navigation Guide

> **Version:** 8.0 | **Date:** 2026-06-12

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Regex engine — AST, compiler, optimizer (3 modules), number-regex, trie/dp factorizer, oracle, matcher, limits | **ZERO npm dependencies** — pure TypeScript only |
| `src/shared/` | Types, i18n, mod-classifier, family-grouper, constants | Imported by core + UI; types in `types.ts` ONLY |
| `src/strategies/` | Locale strategy (Russian dialect: ёфикация, ю/я) | Imported by core |
| `src/store/` | Zustand stores — filter-store, profile-store, url-sync | Import from `@shared`, `@core` |
| `src/data/` | Runtime JSON loader + vendor properties | Fetches `public/generated/*.json` |
| `src/ui/` | React components — pages, layout, hooks | Import from `@store`, `@shared`, `@data`, `@core` |
| `public/generated/` | ETL output — per-category JSON | **NEVER edit manually** — use `pnpm etl` |
| `scripts/` | ETL pipeline + analysis utilities | `pnpm etl` to run |
| `tests/` | Vitest — core/, shared/, etl/, ui/ | `pnpm test` |
| `docs/` | Architecture, ETL guide, data contracts, in-game tests | Update on structural changes |

## 2. Core Optimizer Module Structure

Since iteration 19, `optimizer.ts` is split into 3 modules:

| File | Purpose | Key exports |
|------|---------|-------------|
| `optimizer.ts` | Entry point — `optimize()`, `collectCollapsedTokenIds()`, re-exports | `optimize`, `collectCollapsedTokenIds`, `truncateSuffix`, `isTruncationSafe`, `collectTokenIds` |
| `core-optimizations.ts` | Phase 1 deduplication + shared utilities | `deduplicateOrGroups`, `expandTokenId`, `getValueKey`, `collectTokenIdsFromNode` |
| `optimization-strategies.ts` | Phase 2 optimization table + Phase 3 suffix truncation + data | `applyOptimizationTable`, `truncateSuffixes`, `truncateSuffix`, `isTruncationSafe`, `TRUNCATED_TAILS_SAFE`, `TRUNCATED_TAILS_BLACKLIST` |

**Import rules:**
- External consumers (`useCategoryPage.ts`, test files) import from `optimizer.ts` — it re-exports public API
- Internal imports go directly to `core-optimizations.ts` or `optimization-strategies.ts`
- No circular deps: `optimizer → strategies → core`

## 3. ETL Module Structure (compute-regex)

Since iteration 18, `compute-regex.ts` is split into 3 modules:

| File | Purpose | Key exports |
|------|---------|-------------|
| `compute-regex.ts` | Entry point — types + main algorithm | `RegexResult`, `computeMinimalUniqueSubstring`, `computeAllRegexes` |
| `compute-regex-core.ts` | Template extraction, uniqueness, PoE2 validation | `normalizeTemplate`, `extractTemplateSuffix`, `isSuffixUniqueInCategory`, `containsPoE2Grouping`, `regexMatchesRawText`, `MIN_REGEX_LEN_DEFAULT`, `STRICT_CATEGORIES_MIN_LEN` |
| `compute-regex-strategies.ts` | Strategy implementations | `substringSearchFallback`, `tryWordTruncation`, `computeExcludePatterns`, `generateTruncatedSuffixes`, `checkYofication`, `isExcludeValid` |

**Import rules:**
- External consumers (`compute-optimizations.ts`, test files) import from `compute-regex.ts` — it re-exports public API
- Internal imports go directly to `compute-regex-core.ts` or `compute-regex-strategies.ts`
- No circular deps: `compute-regex → strategies → core`

## 4. Path Aliases

| Alias | Resolves to |
|-------|-------------|
| `@core` | `./src/core` |
| `@ui` | `./src/ui` |
| `@store` | `./src/store` |
| `@data` | `./src/data` |
| `@shared` | `./src/shared` |
| `@strategies` | `./src/strategies` |
| `@etl` | `./scripts/etl` |

## 5. Build & Run

```bash
pnpm install              # Install dependencies
pnpm dev                  # Vite dev server
pnpm build                # tsc + vite build
pnpm test                 # Vitest
pnpm etl                  # Full ETL with optimizer
pnpm etl:fresh            # Clear cache + re-fetch
pnpm optimize             # Standalone iterative optimizer
```

## 6. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
```

- Core has **ZERO** npm dependencies
- UI never imports from `scripts/`
- Types live in `src/shared/types.ts` ONLY
- Vendor properties in `src/data/vendor-properties.ts` ONLY

## 7. PoE2 Regex Dialect

| Syntax | Meaning | Verified |
|--------|---------|----------|
| `substring` | Simple substring match | ✅ |
| `\|` | OR | ✅ |
| `!` | NOT (must be INSIDE quotes with `\|`) | ✅ |
| `""` | Phrase grouping + AND separator | ✅ |
| `.*` | Within single block only (directional) | ✅ |
| `[]` | Character class | ✅ |
| `^` | Start-of-block anchor | ✅ |
| `()` | Grouping | ✅ |
| `\d` | Digit shorthand | ✅ |
| `{N,}` | Quantifier "N or more" | ✅ |

**NOT supported:** `?`, `$`, `.*` across blocks, negative lookahead, non-greedy, backreferences.

**Critical rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries — use AND for cross-block
3. `!X` is item-wide — excludes entire item if X in ANY block
4. Substring search — truncated words work if prefix is unique

## 8. FP Prevention (4 levels)

| Level | Method | When |
|-------|--------|------|
| 1 | `^` anchorStart | Template starts with `##` or `[+-]##` |
| 2 | `\+` / `-` signPrefix | Template has `+##` or `-##` |
| 3 | `%` anchorEnd | `##%` AND anchorStart=false AND no signPrefix |
| 4 | Enumeration | Range ≤ 50 values |

**Truncation safe list:** эффективн, бездн, путев, глубин, приспешник, оглушен, флакон, хаос, монстр

**Blacklist:** редкост (FP «редкий»), редк, провал

## 9. Frequent Pitfalls

1. `!` INSIDE quotes with `|` — NOT before quotes
2. `.*` does NOT cross blocks — use AND (`"X" "Y"`)
3. `$` unreliable — never use
4. `?` NOT supported — use `\d{2,}` instead of `[0-9][0-9]?`
5. Implicit-set bonuses NOT searchable — filtered in ETL
6. Core = dependency-free — no npm imports
7. Generated JSON = read-only
8. `reversed=true` for implicit tokens → `"suffix.*(number)%"`
9. Word truncation = END only, min 3 significant chars
10. Item rarity label IS indexed — never use «редкост»

## 10. Documentation Map

| File | When to Update |
|------|----------------|
| `AGENT_NAVIGATION.md` | Every iteration |
| `STATUS.md` | On status changes |
| `docs/ARCHITECTURE.md` | On structural changes |
| `docs/ETL_GUIDE.md` | On ETL changes |
| `docs/DATA_CONTRACTS.md` | On type changes |
| `docs/IN_GAME_TESTS.md` | On new in-game tests |
