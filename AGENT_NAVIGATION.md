# PoE2 Regex RU — Agent Navigation Guide

> **Version:** 15.0 | **Date:** 2026-06-12

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Regex engine — AST (incl. MULTI_RANGE), compiler, optimizer (4 phases), number-regex, trie/dp factorizer, oracle, matcher, limits | **ZERO npm dependencies** — pure TypeScript only |
| `src/shared/` | Types, i18n, mod-classifier, family-grouper, constants, **Zod schemas** | Imported by core + UI; types in `types.ts`, schemas in `schemas.ts` |
| `src/strategies/` | Locale strategy (Russian dialect: ёфикация, ю/я) | Imported by core |
| `src/store/` | Zustand stores — filter-store, profile-store, url-sync | Import from `@shared`, `@core` |
| `src/data/` | Runtime JSON loader (**Zod-validated**) + vendor properties | Fetches + validates `public/generated/*.json` |
| `src/ui/` | React components — pages, layout, hooks | Import from `@store`, `@shared`, `@data`, `@core` |
| `public/generated/` | ETL output — per-category JSON | **NEVER edit manually** — use `pnpm etl` |
| `scripts/` | ETL pipeline + analysis utilities | `pnpm etl` to run |
| `tests/` | Vitest — core/, shared/, etl/, ui/ | `pnpm test` |
| `docs/` | Architecture, ETL guide, data contracts, in-game tests | Update on structural changes |

## 2. Core Optimizer Module Structure

`optimizer.ts` runs 4 phases:

| File | Purpose | Key exports |
|------|---------|-------------|
| `optimizer.ts` | Entry point — `optimize()`, `collectCollapsedTokenIds()`, re-exports | `optimize`, `collectCollapsedTokenIds`, `truncateSuffix`, `isTruncationSafe`, `collectTokenIds` |
| `core-optimizations.ts` | Phase 1 deduplication + Phase 4 conflicting exclude removal + shared utilities | `deduplicateOrGroups`, `removeConflictingExcludes`, `expandTokenId`, `getValueKey`, `collectTokenIdsFromNode` |
| `optimization-strategies.ts` | Phase 2 optimization table + Phase 3 suffix truncation + data | `applyOptimizationTable`, `truncateSuffixes`, `truncateSuffix`, `isTruncationSafe`, `TRUNCATED_TAILS_SAFE`, `TRUNCATED_TAILS_BLACKLIST` |

**Optimizer phases:**
1. Phase 1: Deduplicate identical regex in OR groups (uses `getValueKey` — now includes all RANGE fields)
2. Phase 2: Apply optimization table entries
3. Phase 3: Truncate suffixes using verified safe list
4. Phase 4: Remove conflicting EXCLUDE nodes (safety net)

**getValueKey for RANGE** (iter 27 fix): includes `min`, `max`, `suffix`, `prefix`, `exact`, `signPrefix`, `anchorStart`, `anchorEnd`, `reversed`, `colonAnchor`, `threshold` — prevents incorrect dedup of RANGE nodes that differ only in max/anchors/reversed.

## 3. ETL Module Structure (compute-regex)

| File | Purpose | Key exports |
|------|---------|-------------|
| `compute-regex.ts` | Entry point — types + main algorithm | `RegexResult`, `computeMinimalUniqueSubstring`, `computeAllRegexes` |
| `compute-regex-core.ts` | Template extraction, uniqueness, PoE2 validation | `normalizeTemplate`, `extractTemplateSuffix`, `isSuffixUniqueInCategory`, `containsPoE2Grouping`, `regexMatchesRawText` |
| `compute-regex-strategies.ts` | Strategy implementations | `substringSearchFallback`, `tryWordTruncation`, `computeExcludePatterns`, `generateTruncatedSuffixes`, `checkYofication`, `isExcludeValid` |

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
pnpm test                 # Vitest (all tests)
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

## 7. PoE2 Regex Dialect

| Syntax | Meaning | Verified |
|--------|---------|----------|
| `substring` | Simple substring match | ✅ |
| `\|` | OR | ✅ |
| `!` | NOT (must be INSIDE quotes with `\|`) | ✅ |
| `""` | Phrase grouping + AND separator | ✅ |
| `.*` | Within single block only | ✅ |
| `[]` | Character class | ✅ |
| `^` | Start-of-block anchor | ✅ |
| `()` | Grouping | ✅ |
| `\d` | Digit shorthand | ✅ |
| `{N,}` | Quantifier "N or more" | ✅ |

**NOT supported:** `?`, `$`, `.*` across blocks, negative lookahead, non-greedy, backreferences.

## 8. FP Prevention (5 levels)

| Level | Method | When |
|-------|--------|------|
| 1 | `^` anchorStart | Template starts with `##` or `[+-]##` |
| 2 | `\+` / `-` signPrefix | Template has `+##` or `-##` |
| 3 | `%` anchorEnd | `##%` AND anchorStart=false AND no signPrefix |
| 4 | Enumeration | Range ≤ 50 values |
| 5 | `regexPrefixContext` | AND-контекст ("имеют" для minion) — suffix + context обязаны быть на предмете |

## 9. Frequent Pitfalls

1. `!` INSIDE quotes with `|` — NOT before quotes
2. `.*` does NOT cross blocks — use AND
3. `$` unreliable — never use
4. `?` NOT supported — use `\d{2,}`
5. Implicit-set bonuses NOT searchable — filtered in ETL
6. Core = dependency-free — no npm imports
7. Word truncation = END of suffix only, min 3 significant chars
8. Item rarity label IS indexed — never use «редкост»
9. MULTI_RANGE for dual-number mods — single quoted group
10. `()` in regex = PoE2 grouping, NOT literal parens
11. Conflicting regexExclude — `computeSuppressedExcludes()` + Phase 4 optimizer
12. `regexPrefixContext="имеют"` — minion mods with shared suffix (e.g., "увеличение урона") need AND-context to distinguish from non-minion versions
13. `getValueKey` for RANGE must include ALL distinguishing fields (max, anchors, reversed, threshold) — otherwise optimizer incorrectly deduplicates nodes that compile to different regex

## 10. Documentation Map

| File | When to Update |
|------|----------------|
| `AGENT_NAVIGATION.md` | Every iteration |
| `STATUS.md` | On status changes |
| `docs/ARCHITECTURE.md` | On structural changes |
| `docs/ETL_GUIDE.md` | On ETL changes |
| `docs/DATA_CONTRACTS.md` | On type changes |
| `docs/IN_GAME_TESTS.md` | On new in-game tests |
