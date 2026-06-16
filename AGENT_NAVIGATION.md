# PoE2 Regex RU — Agent Navigation

> **Entry document.** Read this first. Current state: iter 53 (UI redesign Фаза 2 COMPLETE — все 8 категорийных страниц мигрированы на `CategoryLayout`).

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
| `src/ui/layout/CategoryLayout.tsx` | 2-col desktop / 1-col mobile shell for category pages (iter 52-53). Slots: `header`, `controls`, `regexOutput`, `status?`, `sidebar?`, `children`. | Adopted by ALL 8 category pages (waystone, ring, amulet, belt, relic, jewel, tablet, vendor). |
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
pnpm test                 # Vitest (all tests) — current: 1144 passing
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
| `core-optimizations.ts` | Phase 1 dedup + Phase 4 conflicting-exclude removal | `deduplicateOrGroups`, `removeConflictingExcludes`, `expandTokenId`, `getValueKey` |
| `optimization-strategies.ts` | Phase 2 opt-table + Phase 3 suffix truncation | `applyOptimizationTable`, `truncateSuffix`, `isTruncationSafe`, `TRUNCATED_TAILS_SAFE`, `TRUNCATED_TAILS_BLACKLIST` |

Compiler (`compiler.ts`) `normalizeAst` transform for **AND(LITERAL..., EXCLUDE) inside OR**: produces `^(?!.*A)(?!.*B).*lit1.*lit2.*...` (bidirectional, in-game verified iter 46; extended to multi-LITERAL iter 49).

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
| `^` | Start-of-block anchor (single-quoted ✅; OR-context ✅) | ✅ |
| `!` | NOT (must be INSIDE quotes with `\|`: `"!A\|B"`) | ✅ |
| `""` | Phrase grouping + AND separator | ✅ |
| `[]` | Character class | ✅ |
| `\d` | Digit shorthand | ✅ |
| `{N,}` | Quantifier "N or more" | ✅ |
| `(?!…)` Negative lookahead — bidirectional via `^(?!…).*Z` | ✅ in-game verified | Forward-only `Z(?!…)` is FP. Lookbehind `(?<!…)` NOT supported. |
| Regex char limit ≈ 250 chars | Single regex >250 chars → **runtime split** (iter 50) | ✅ `splitOverLimitRegex()` |

**NOT supported:** `?` (optional), `$` (unreliable), `.*` across blocks, non-greedy, backreferences.

### What WORKS for multi-word OR (Path D)

`"prefix.*A|prefix.*B|prefix.*C"` — single quoted group, top-level `|`, `.*` bridges. Verified up to 9 alternatives. Total length must be ≤250 chars per part (runtime split if over).

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
6. **Word truncation = END of suffix only**, min 3 significant chars.
7. **`()` in regex = PoE2 grouping**, NOT literal parens.
8. **`getValueKey` for RANGE** must include ALL distinguishing fields.
9. **Home page i18n:** Each zone uses a separate key — no text duplication.
10. **`|` scope:** `|` works ONLY at TOP LEVEL of ONE quoted group. Does NOT work between quoted groups, inside `()`, or after non-`.*` prefix.
11. **AND-in-OR with EXCLUDE — FULLY handled (iter 49):** `AND(LITERAL..., EXCLUDE(...))` inside OR → `^(?!…).*lit1.*lit2.*...` (single quoted group).
12. **`(?!…)` bidirectional via `^(?!…).*Z`:** `Z(?!.*X)` is forward-only. Fix: `^(?!…).*Z`.
13. **regexExclude word forms:** Use truncated stems. `самострелами` ≠ `самострела`.
14. **Opt-table strict-subset skip:** `applyOptimizationTable` SKIPS opt-entries with top-level `|` on STRICT SUBSET.
15. **Cross-block FP risk:** `"X" "Y"` can match different blocks → FP. Use `"X.*Y"` for same-block.
16. **`(?!…)` lookahead tokenized explicitly (iter 48):** `lookaheadNeg` AST node, semantic tests Sections 11+12.
17. **PoE2 regex char limit ≈ 250 chars:** Runtime split via `splitOverLimitRegex()` (iter 50). Over-limit OR groups split at top-level `|` into 2+ parts, each ≤250 chars, displayed separately with individual copy buttons.
18. **ETL `patchOptimizationEntries` mixed-context bug (iter 50):** `regexPrefixContext` must only be added when ALL tokens in the opt entry share the SAME non-empty context. Mixed contexts (some have "имеют", others empty) must NOT be patched — causes FN.
19. **Dark-only theme (iter 51):** Light theme removed from CSS. `Header.tsx` sets `data-theme="dark"` once on mount (no toggle). `theme.light`/`theme.dark` i18n keys removed. CSS tokens are warm dark-fantasy (`#0D0B09` / `#15110E` / `#3A2C22` / `#C89A4A` gold). Do NOT re-add light theme.

20. **`CategoryControlPanel` split-mode (iter 52-53):** Component has optional prop `hideRegexOutput?: boolean` (default `false`).
    - Split mode (`hideRegexOutput=true`): renders ONLY the controls row, NO `<RegexOutput>`, NO sticky wrapper. Page passes `<RegexOutput>` separately to `<CategoryLayout>`'s `regexOutput` slot (right column, sticky via `<aside>`).
    - **All 8 category pages now use split mode** (iter 53 complete).
    - Legacy mode (`hideRegexOutput=false`, default): renders `<RegexOutput>` + controls row inside a `sticky top-0 z-10 control-panel-sticky` wrapper. Currently UNUSED — kept for backward-compat. Can be removed in a future cleanup iteration (also unused props: `regex`, `isOverflow`, `regexParts`, `filterStore`, `activeTokenCount` in split mode).
    - **Migration pattern (complete):** wrap page in `<CategoryLayout>`, set `hideRegexOutput` on `<CategoryControlPanel>`, move `<RegexOutput>` + status block + `<ProfilePanel>` into right-column slots. Keep `extraControls` and `clearButton` slots on `<CategoryControlPanel>` (they don't move).
    - Page-specific notes: VendorPage has NO `<PageStateWrapper>` (sync data) and NO `<ProfilePanel>` (sidebar slot empty). JewelPage's "Hidden mods warning" stays in left column (between controls and ModList). TabletPage's status block is custom (includes type/rarity/uses info).

## 9. Deterministic Regex Strategy (8 Principles — UNIFIED for ALL categories)

1. **ONE MOD = ONE QUOTED GROUP** — each mod → one `"..."` group.
2. **MULTI-MOD = AND ACROSS BLOCKS** — N mods → N quoted groups separated by spaces.
3. **`|` SCOPE — TOP LEVEL of one quoted group** — does NOT work between quoted groups or inside `()`.
4. **`.*` BRIDGING WITHIN SINGLE BLOCK** — `"prefix.*suffix"` bridges number and middle words.
5. **SUFFIX UNIQUENESS** — shortest suffix unique to the mod (≥3 chars, end-only truncation).
6. **SHARED SUFFIX → DIFFERENTIATE BY NUMBER** — `"(1[0-5])%.*suffix"` for family regex.
7. **CROSS-BLOCK FP RISK** — `"X" "Y"` may match different blocks → FP. Use `"X.*Y"`.
8. **SAME-FAMILY OR → Path D** — `"prefix.*A|prefix.*B|prefix.*C"` (single quoted group, top-level `|`, `.*` bridges). Over 250 chars → runtime split (iter 50).

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
| `googled4deeaff5bba3bb2.html` | GSC верификация |
| `yandex_227088c0d89586c7.html` | Яндекс Вебмастер верификация |
| `og-banner.png` | Open Graph image (1200x630) |
| `favicon.svg` | Favicon |

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
