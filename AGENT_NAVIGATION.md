# PoE2 Regex RU — Agent Navigation Guide

> **Version:** 6.0 | **Date:** 2026-06-12

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Regex engine — AST, compiler, optimizer, number-regex, trie/dp factorizer, oracle, matcher, limits | **ZERO npm dependencies** — pure TypeScript only |
| `src/shared/` | Types, i18n, mod-classifier, family-grouper, constants | Imported by core + UI; types in `types.ts` ONLY |
| `src/strategies/` | Locale strategy (Russian dialect: ёфикация, ю/я) | Imported by core |
| `src/store/` | Zustand stores — filter-store, profile-store, url-sync | Import from `@shared`, `@core` |
| `src/data/` | Runtime JSON loader + vendor properties | Fetches `public/generated/*.json` |
| `src/ui/` | React components — pages, layout, hooks | Import from `@store`, `@shared`, `@data`, `@core` |
| `public/generated/` | ETL output — per-category JSON | **NEVER edit manually** — use `pnpm etl` |
| `scripts/` | ETL pipeline + analysis utilities | `pnpm etl` to run |
| `tests/` | Vitest — core/, shared/, etl/, ui/ | `pnpm test` |
| `docs/` | Architecture, ETL guide, data contracts, in-game tests | Update on structural changes |

## 2. Path Aliases

| Alias | Resolves to |
|-------|-------------|
| `@core` | `./src/core` |
| `@ui` | `./src/ui` |
| `@store` | `./src/store` |
| `@data` | `./src/data` |
| `@shared` | `./src/shared` |
| `@strategies` | `./src/strategies` |
| `@etl` | `./scripts/etl` |

## 3. Build & Run

```bash
pnpm install              # Install dependencies
pnpm dev                  # Vite dev server
pnpm build                # tsc + vite build
pnpm test                 # Vitest
pnpm etl                  # Full ETL with optimizer
pnpm etl:fresh            # Clear cache + re-fetch
pnpm optimize             # Standalone iterative optimizer
```

## 4. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
```

- Core has **ZERO** npm dependencies
- UI never imports from `scripts/`
- Types live in `src/shared/types.ts` ONLY
- Vendor properties in `src/data/vendor-properties.ts` ONLY

## 5. PoE2 Regex Dialect

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

## 6. FP Prevention (4 levels)

| Level | Method | When |
|-------|--------|------|
| 1 | `^` anchorStart | Template starts with `##` or `[+-]##` |
| 2 | `\+` / `-` signPrefix | Template has `+##` or `-##` |
| 3 | `%` anchorEnd | `##%` AND anchorStart=false AND no signPrefix |
| 4 | Enumeration | Range ≤ 50 values |

**Truncation safe list:** эффективн, бездн, путев, глубин, приспешник, оглушен, флакон, хаос, монстр

**Blacklist:** редкост (FP «редкий»), редк, провал

## 7. Frequent Pitfalls

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

## 8. Documentation Map

| File | When to Update |
|------|----------------|
| `AGENT_NAVIGATION.md` | Every iteration |
| `STATUS.md` | On status changes |
| `docs/ARCHITECTURE.md` | On structural changes |
| `docs/ETL_GUIDE.md` | On ETL changes |
| `docs/DATA_CONTRACTS.md` | On type changes |
| `docs/IN_GAME_TESTS.md` | On new in-game tests |
