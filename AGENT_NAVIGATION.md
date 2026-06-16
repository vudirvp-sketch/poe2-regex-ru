# PoE2 Regex RU — Agent Navigation

> **Entry document.** Read this first. Current state: iter 48 (`(?!…)` lookahead tokenizer — simulator now models negative lookahead semantically).

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Regex engine — AST, compiler, optimizer (4 phases), number-regex, trie/dp factorizer, oracle, matcher, limits | **ZERO npm dependencies** — pure TypeScript only |
| `src/shared/` | Types, i18n, mod-classifier, family-grouper, constants, **Zod schemas** | Imported by core + UI |
| `src/strategies/` | Locale strategy (Russian dialect: ёфикация, ю/я) | Imported by core |
| `src/store/` | Zustand stores — filter-store, profile-store, url-sync | Import from `@shared`, `@core` |
| `src/data/` | Runtime JSON loader (**Zod-validated**) + vendor properties | Fetches + validates `public/generated/*.json` |
| `src/ui/` | React components — pages, layout, hooks | Import from `@store`, `@shared`, `@data`, `@core` |
| `public/generated/` | ETL output — per-category JSON | **NEVER edit manually** — use `pnpm etl` |
| `public/` | Static assets: robots.txt, sitemap.xml, 404.html, IndexNow key, Google/Yandex/Bing verification, favicon, og-banner | Served as-is by GitHub Pages |
| `scripts/` | ETL pipeline + analysis utilities + prerender scripts | `pnpm etl` / `tsx scripts/prerender.ts` / `tsx scripts/prerender-full.ts` |
| `tests/` | Vitest — core/, shared/, etl/, ui/ | `pnpm test` |
| `docs/` | Architecture, ETL guide, data contracts, in-game tests, SEO plan | Update on structural changes |
| `регис/` | User-provided in-game test data (Russian source mod lists + test items) | Reference only — do not modify |

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

## 3. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
```

- Core = **ZERO** npm dependencies (pure TS).
- UI never imports from `scripts/`.
- Types live in `src/shared/types.ts` ONLY.

## 4. Build & Run

```bash
pnpm install              # Install dependencies
pnpm dev                  # Vite dev server
pnpm build                # tsc + vite build + shell prerender (no Playwright)
pnpm build:full           # tsc + vite build + shell prerender + Playwright prerender
pnpm prerender:full       # Run Playwright prerender only (needs dist/)
pnpm test                 # Vitest (all tests) — current: 1108 passing
pnpm etl                  # Full ETL with optimizer
pnpm etl:fresh            # ETL without cache (regenerate all)
pnpm etl:check-stale      # Check source HTML staleness
pnpm optimize             # Run iterative optimizer only
pnpm analyze-fn           # FN/FP analysis report
```

## 5. Core Optimizer Module Structure

`optimizer.ts` runs 4 phases:

| File | Purpose | Key exports |
|------|---------|-------------|
| `optimizer.ts` | Entry — `optimize()`, `collectCollapsedTokenIds()` | `optimize`, `collectCollapsedTokenIds`, `collectTokenIds` |
| `core-optimizations.ts` | Phase 1 dedup + Phase 4 conflicting-exclude removal | `deduplicateOrGroups`, `removeConflictingExcludes` (surgical — removes only conflicting literals, not entire EXCLUDE), `expandTokenId`, `getValueKey` |
| `optimization-strategies.ts` | Phase 2 opt-table + Phase 3 suffix truncation | `applyOptimizationTable` (skips opt-entries with top-level `\|` on STRICT SUBSET — prevents FP), `truncateSuffix`, `isTruncationSafe`, `TRUNCATED_TAILS_SAFE`, `TRUNCATED_TAILS_BLACKLIST` |

Compiler (`compiler.ts`) `normalizeAst` transform for **AND(LITERAL, EXCLUDE) inside OR**: produces `^(?!.*A)(?!.*B).*X` (bidirectional, in-game verified). Restrictive: only applies when AND has exactly one LITERAL + one EXCLUDE child whose inner is LITERAL or OR(LITERAL,...).

## 6. PoE2 Regex Dialect (VERIFIED IN-GAME)

| Syntax | Meaning | Status |
|--------|---------|--------|
| `substring` | Simple substring match | ✅ |
| `\|` (top-level in ONE quoted group) | OR — single-word OR multi-word with `.*` bridges (Path D) | ✅ |
| `\|` BETWEEN two quoted groups (`"X"\|"Y"`) | OR — **BROKEN**, zero matches | ❌ |
| `\|` inside `()` with multi-word alternatives | Grouping — **BROKEN** | ❌ |
| `"prefix (A\|B)"` (non-`.*` prefix + `()` + `\|`) | **BROKEN** — matches only prefix broadly | ❌ |
| AND via space (`"X" "Y"`) | Cross-block AND AND same-block AND | ✅ |
| `.*` | Within single block only (does NOT cross blocks) | ✅ |
| `.*` bridge | `"prefix.*suffix"` bridges number + middle words | ✅ |
| `^` | Start-of-block anchor (single-quoted ✅; OR-context ✅ — applies only to first alt, no leak) | ✅ |
| `!` | NOT (must be INSIDE quotes with `\|`: `"!A\|B"`) | ✅ |
| `""` | Phrase grouping + AND separator | ✅ |
| `[]` | Character class | ✅ |
| `\d` | Digit shorthand | ✅ |
| `{N,}` | Quantifier "N or more" | ✅ |
| `(?!…)` Negative lookahead — bidirectional via `^(?!…).*Z` | ✅ in-game verified | Forward-only `Z(?!…)` is FP. Lookbehind `(?<!…)` NOT supported. **Simulator models `(?!…)` as `lookaheadNeg` AST node (iter 48 — Known Issue #2 CLOSED).** Semantic regression tests: `tests/core/poe2-regex-matcher.test.ts` Section 11. |
| Regex char limit ≈ 250 chars | Single regex >250 chars silently rejected by game | ⚠️ ETL diagnostic only (`findOverLimitEntries`) |

**NOT supported:** `?` (optional), `$` (unreliable), `.*` across blocks, non-greedy, backreferences.

### What WORKS for multi-word OR (Path D)

`"prefix.*A|prefix.*B|prefix.*C"` — single quoted group, top-level `|`, `.*` bridges. Verified up to 9 alternatives. Total length must be ≤250 chars.

## 7. FP Prevention (5 Levels)

| Level | Method | When |
|-------|--------|------|
| 1 | `^` anchorStart | Template starts with `##` or `[+-]##` |
| 2 | `\+` / `-` signPrefix | Template has `+##` or `-##` |
| 3 | `%` anchorEnd | `##%` AND anchorStart=false AND no signPrefix |
| 4 | Enumeration | Range ≤ 50 values |
| 5 | `regexPrefixContext` | AND-context for minion-модов |

## 8. Frequent Pitfalls (KEY — read before touching compiler/optimizer)

1. **`!` INSIDE quotes with `|`** — NOT before quotes. `"!A|B"` works, `!"A|B"` does NOT.
2. **`.*` does NOT cross blocks** — use AND (`"X" "Y"`).
3. **`$` unreliable** — never use.
4. **`?` NOT supported** — use `\d{2,}` instead.
5. **Core = dependency-free** — no npm imports in `src/core/`.
6. **Word truncation = END of suffix only**, min 3 significant chars. Mid-word truncation breaks contiguous substring property.
7. **`()` in regex = PoE2 grouping**, NOT literal parens.
8. **`getValueKey` for RANGE** must include ALL distinguishing fields.
9. **Home page i18n:** Each zone (sidebar, header, hero) uses a separate key — no text duplication.
10. **`|` scope:** `|` works ONLY at TOP LEVEL of ONE quoted group (with or without `.*` in alternatives). Does NOT work (a) between two quoted groups, (b) inside `()` with multi-word alternatives, (c) after non-`.*` prefix inside quotes.
11. **AND-in-OR with EXCLUDE — PARTIALLY handled:** Compiler transform covers `AND(LITERAL, EXCLUDE(LITERAL|OR(LITERAL,...)))` inside OR → produces `^(?!…).*Z`. **NOT YET handled:** AND with multiple LITERALs + EXCLUDE (e.g., `regexPrefixContext + LITERAL + EXCLUDE`) — produces nested quotes. Rare. Tracked as Known Issue #4 (Pitfall 11).
12. **`(?!…)` bidirectional via `^(?!…).*Z`:** `Z(?!.*X)` is forward-only — fails if exclude `X` PRECEDES `Z` in same block. Fix: anchor with `^` + `.*` bridge so lookahead covers the WHOLE block. Works in OR-context (`^` applies only to first alt, no leak). +3 chars per LITERAL, still ≤250.
13. **regexExclude word forms:** Use truncated stems. `самострелами` ≠ `самострела`. Use `самострел` to catch both.
14. **Opt-table strict-subset skip:** `applyOptimizationTable` SKIPS opt-entries with top-level `|` when user's selection is a STRICT SUBSET (`matchedIds.size < entry.ids.length`). Plain shared-substring entries (no `|`) are still applied on subset (Phase 1 dedup handles them safely).
15. **Cross-block FP risk:** `"X" "Y"` (AND across blocks) can match items where X and Y appear in DIFFERENT mod blocks. Use `.*` bridge in ONE quoted group (`"X.*Y"`) to force same-block match. Note: `"X" "Y"` ALSO matches when X and Y are in the SAME block.
16. **`(?!…)` lookahead tokenized explicitly (iter 48 — Known Issue #2 CLOSED):** Tokenizer detects `(?!` as `lookaheadNegOpen`, parser creates `lookaheadNeg` AST node, matcher handles as zero-width assertion (succeeds iff inner does NOT match at current position). For `^(?!.*X).*Z`: `^`-anchor + `.*` inside lookahead = bidirectional block-wide absence. Semantic regression tests in `tests/core/poe2-regex-matcher.test.ts` Section 11 (minion-block data from регис/Самоцветы моды.md:144 + Амулеты моды.md:57).
17. **PoE2 regex char limit ≈ 250 chars:** Single regex string >250 chars is silently rejected. ETL `findOverLimitEntries()` logs warnings; entries are kept (useful for subset selection — compiler picks matching subset when fewer ids are selected).

## 9. Deterministic Regex Strategy (8 Principles — UNIFIED for ALL categories)

1. **ONE MOD = ONE QUOTED GROUP** — each mod → one `"..."` group with suffix + `.*` bridge + optional number pattern.
2. **MULTI-MOD = AND ACROSS BLOCKS** — N mods → N quoted groups separated by spaces. Also works WITHIN single block (same-block AND).
3. **`|` SCOPE — TOP LEVEL of one quoted group** — does NOT work between quoted groups or inside `()` with multi-word alternatives.
4. **`.*` BRIDGING WITHIN SINGLE BLOCK** — `"prefix.*suffix"` bridges number and middle words.
5. **SUFFIX UNIQUENESS** — shortest suffix unique to the mod in the category (≥3 chars/word, end-only truncation).
6. **SHARED SUFFIX → DIFFERENTIATE BY NUMBER** — `"(1[0-5])%.*suffix"` for family regex, or exact number for specific roll.
7. **CROSS-BLOCK FP RISK** — `"X" "Y"` may match different blocks → FP. Use `"X.*Y"` to force same-block match.
8. **SAME-FAMILY OR → Path D** — `"prefix.*A|prefix.*B|prefix.*C"` (single quoted group, top-level `|`, `.*` bridges). Constraint: total length ≤250 chars. ETL logs warnings for over-limit entries; entries are kept for subset selection.

**NEVER use:** `"prefix (A|B|C)"`, `"(A B|C D)"`, `"X"|"Y"` — all confirmed BROKEN in-game.

## 10. Pre-rendering (Two Levels)

**Level 1 (`scripts/prerender.ts`):** Generates 9 route-specific HTML files with unique meta tags + `<noscript>` fallback. Pure string manipulation. Runs automatically after `vite build`.

**Level 2 (`scripts/prerender-full.ts`):** Playwright + headless Chromium renders React content into `<div id="root">`. Graceful: if Playwright not installed, exits with warning, falls back to Level 1.

**CI build flow:** `tsc -b → vite build → prerender.ts (shell) → prerender-full.ts (Playwright) → deploy + IndexNow`
**Local build flow:** `tsc -b → vite build → prerender.ts (shell only)`

## 11. SEO Assets (public/)

| File | Purpose |
|------|---------|
| `robots.txt` | Allow /, ссылка на sitemap |
| `sitemap.xml` | 9 URL с lastmod и priority |
| `404.html` | SPA-редирект + `<meta name="robots" content="noindex, follow">` |
| `7cf0e35e568e2791d08835cdbd1d8a97.txt` | IndexNow API key |
| `googled4deeaff5bba3bb2.html` | GSC верификация (бэкап, мета-тег основной) |
| `yandex_227088c0d89586c7.html` | Яндекс Вебмастер верификация (бэкап, мета-тег основной) |
| `og-banner.png` | Open Graph image (1200x630) |
| `favicon.svg` | Favicon |

`index.html` contains: SEO meta tags, Open Graph, Twitter Card, canonical URL, JSON-LD, `google-site-verification`, `yandex-verification`, `msvalidate.01` (Bing).

## 12. i18n Keys for Home Page

| Key | Text | Used In |
|-----|------|---------|
| `home.nav_label` | Главная | Sidebar nav link for `/` |
| `home.header_title` | PoE2 Regex | Header `<h2>` for route `/` |
| `home.title` | Генератор regex для PoE2 | Hero `<h1>` on HomePage |
| `home.subtitle` | Выбирайте аффиксы — получайте готовую строку для вставки в игру | Hero subtitle |
| `home.description_full` | Генератор поисковых строк… | Hero description paragraph |

**Design principle:** Each UI zone (sidebar, header, hero) has its own i18n key — no text duplication across zones.

## 13. Documentation Map

| File | When to Update |
|------|----------------|
| `AGENT_NAVIGATION.md` | Every iteration (this file) |
| `STATUS.md` | On status changes (current iter + Known Issues) |
| `docs/ARCHITECTURE.md` | On structural changes |
| `docs/ETL_GUIDE.md` | On ETL pipeline changes |
| `docs/DATA_CONTRACTS.md` | On type changes |
| `docs/IN_GAME_TESTS.md` | On new in-game test results |
| `docs/SEO_PLAN.md` | On SEO workflow changes |
| `worklog.md` | Every iteration — append new Task ID section |
