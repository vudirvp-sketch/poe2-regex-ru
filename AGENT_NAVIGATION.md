# PoE2 Regex RU — Agent Navigation Guide

> **Version:** 27.0 | **Date:** 2026-06-16

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

## 2. i18n Keys for Home Page

| Key | Text | Used In |
|-----|------|---------|
| `home.nav_label` | Главная | Sidebar nav link for `/` |
| `home.header_title` | PoE2 Regex | Header `<h2>` for route `/` |
| `home.title` | Генератор regex для PoE2 | Hero `<h1>` on HomePage |
| `home.subtitle` | Выбирайте аффиксы — получайте готовую строку для вставки в игру | Hero subtitle on HomePage |
| `home.description_full` | Генератор поисковых строк… | Hero description paragraph |

**Design principle:** Each UI zone (sidebar, header, hero) has its own i18n key — no text duplication across zones.

## 3. SEO Assets (public/)

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

**index.html** содержит: мета-теги SEO, Open Graph, Twitter Card, canonical URL, JSON-LD, `google-site-verification`, `yandex-verification`, `msvalidate.01` (Bing).

## 4. Pre-rendering (Two Levels)

### Level 1: Shell prerender (`scripts/prerender.ts`)
- Генерирует 9 route-specific HTML файлов с уникальными мета-тегами + `<noscript>` fallback
- Чистая строковая манипуляция — не нужен браузер
- Запускается автоматически после `vite build` (часть `pnpm build`)

### Level 2: Full prerender (`scripts/prerender-full.ts`)
- Playwright + headless Chromium рендерит React-контент в `<div id="root">`
- Краулеры без JS видят полные списки аффиксов, числа, навигацию
- Graceful: если Playwright не установлен — выходит с warning, используется Level 1

**CI build flow:**
```
tsc -b → vite build → prerender.ts (shell) → prerender-full.ts (Playwright) → deploy + IndexNow
```

**Local build flow:**
```
tsc -b → vite build → prerender.ts (shell only)
```

## 5. Core Optimizer Module Structure

`optimizer.ts` runs 4 phases:

| File | Purpose | Key exports |
|------|---------|-------------|
| `optimizer.ts` | Entry point — `optimize()`, `collectCollapsedTokenIds()`, re-exports | `optimize`, `collectCollapsedTokenIds`, `truncateSuffix`, `isTruncationSafe`, `collectTokenIds` |
| `core-optimizations.ts` | Phase 1 deduplication + Phase 4 conflicting exclude removal + shared utilities | `deduplicateOrGroups`, `removeConflictingExcludes`, `expandTokenId`, `getValueKey`, `collectTokenIdsFromNode` |
| `optimization-strategies.ts` | Phase 2 optimization table + Phase 3 suffix truncation + data | `applyOptimizationTable`, `truncateSuffixes`, `truncateSuffix`, `isTruncationSafe`, `TRUNCATED_TAILS_SAFE`, `TRUNCATED_TAILS_BLACKLIST` |

**✅ RESOLVED (iter 40):** Optimization table (Phase 2) was broken for ~90% of entries because `|` inside `()` with multi-word alternatives doesn't work in PoE2 (Tests 15-17). Path D strategy (`"prefix.*A|prefix.*B|prefix.*C"` — top-level `|` in ONE quoted group with `.*` bridges) is now IMPLEMENTED in ETL (`scripts/etl/path-d-transform.ts` + Phase D in `compute-optimizations.ts` + `reoptimizeTable` in `iterative-optimizer.ts`) and runtime (`applyOptimizationTable` applies Path D entries even with negative savings). 303/481 opt-table entries converted to Path D format, 0 broken `()` entries remain. See STATUS.md for D5 (in-game verification) plan.

## 6. Path Aliases

| Alias | Resolves to |
|-------|-------------|
| `@core` | `./src/core` |
| `@ui` | `./src/ui` |
| `@store` | `./src/store` |
| `@data` | `./src/data` |
| `@shared` | `./src/shared` |
| `@strategies` | `./src/strategies` |
| `@etl` | `./scripts/etl` |

## 7. Build & Run

```bash
pnpm install              # Install dependencies
pnpm dev                  # Vite dev server
pnpm build                # tsc + vite build + shell prerender (no Playwright)
pnpm build:full           # tsc + vite build + shell prerender + Playwright prerender
pnpm prerender:full       # Run Playwright prerender only (needs dist/)
pnpm test                 # Vitest (all tests)
pnpm etl                  # Full ETL with optimizer
```

## 8. Dependency Rules

```
shared <- core <- strategies <- store <- data <- ui
```

- Core has **ZERO** npm dependencies
- UI never imports from `scripts/`
- Types live in `src/shared/types.ts` ONLY

## 9. PoE2 Regex Dialect

| Syntax | Meaning | Verified |
|--------|---------|----------|
| `substring` | Simple substring match | ✅ |
| `\|` (top-level in ONE quoted group) | OR — single-word OR multi-word with `.*` bridges | ✅ iter 38 (2 alt) + iter 39 (3+4 alt + AND, D1) |
| `\|` (BETWEEN two quoted groups) | OR — BROKEN, zero matches | ❌ B0 confirmed iter 38 |
| `!` | NOT (must be INSIDE quotes with `\|`) | ✅ |
| `""` | Phrase grouping + AND separator | ✅ |
| `.*` | Within single block only | ✅ |
| `[]` | Character class | ✅ |
| `^` | Start-of-block anchor | ✅ |
| `()` with single-word `\|` inside | Grouping — works alone | ✅ |
| `()` with multi-word `\|` inside | Grouping — BROKEN | ❌ Test 15 |
| `"prefix (A\|B)"` (non-`.*` prefix + `()` + `\|`) | BROKEN — matches only prefix broadly | ❌ Test 16 |
| `\d` | Digit shorthand | ✅ |
| `{N,}` | Quantifier "N or more" | ✅ |
| `(?!…)` | Negative lookahead — per-block | ✅ |

**CRITICAL limitations:**

1. **`|` between TWO quoted groups (`"X"|"Y"`) is BROKEN** — iter 38 confirmed zero matches in-game. Path A (decompose opt-table to `"X"|"Y"`) is impossible.
2. **`|` inside `()` with multi-word alternatives is BROKEN** (Tests 15-17):
   - `(скорости атаки|передвижения)` → nothing (Test 15)
   - `"повышение (брони|скорости)"` → matches only "повышение" broadly (Test 16)
   - `"повышение (брони|скорости атаки|шанса критического удара)"` → too much junk (Test 17)
3. **Optimization table is broken** for ~90% of entries that use `"prefix (A|B|C)"` pattern.

**What DOES work (Path D — iter 38):**
- `|` between single words at top level of one quoted group: `"Бездн|Делир"`, `"огня|холоду"`
- `|` between multi-word alternatives with `.*` bridges: `"увеличение урона.*луками|увеличение урона.*посохами"` (D7-3 verified)
- `.*` within single block: `"скорости.*копьями"` bridges "скорости атаки копьями"
- `(?!…)` per-block: `скорости(?!.*луками)` excludes weapon-specific blocks
- AND across blocks: `"X" "Y"` — order-independent, cross-block

**NOT supported:** `?`, `$` (unreliable), `.*` across blocks, non-greedy, backreferences.

## 10. FP Prevention (5 levels)

| Level | Method | When |
|-------|--------|------|
| 1 | `^` anchorStart | Template starts with `##` or `[+-]##` |
| 2 | `\+` / `-` signPrefix | Template has `+##` or `-##` |
| 3 | `%` anchorEnd | `##%` AND anchorStart=false AND no signPrefix |
| 4 | Enumeration | Range ≤ 50 values |
| 5 | `regexPrefixContext` | AND-контекст для minion-модов |

## 11. Frequent Pitfalls

1. `!` INSIDE quotes with `|` — NOT before quotes
2. `.*` does NOT cross blocks — use AND
3. `$` unreliable — never use
4. `?` NOT supported — use `\d{2,}`
5. Core = dependency-free — no npm imports
6. Word truncation = END of suffix only, min 3 significant chars
7. `()` in regex = PoE2 grouping, NOT literal parens
8. `getValueKey` for RANGE must include ALL distinguishing fields
9. **Home page i18n:** Each zone (sidebar, header, hero) uses a separate key
10. **`|` scope (iter 38):** `|` works at TOP LEVEL of ONE quoted group (with or without `.*` in alternatives). It does NOT work: (a) between two quoted groups (`"X"|"Y"` — B0 confirmed broken iter 38, zero matches), (b) inside `()` with multi-word alternatives (`"(A B|C D)"` — Test 15), (c) after non-`.*` prefix inside quotes (`"prefix (A|B)"` — Test 16).
11. **AND-in-OR nested quotes:** When AND(LITERAL, EXCLUDE) is inside OR, compiler wraps in `"..."` creating nested quotes. PoE2 can't parse this. With Path D (single quoted group with top-level `|`), this issue becomes irrelevant for opt-table — but still relevant for manual OR+EXCLUDE combinations.
12. **`(?!…)` works per-block** — unlike `!` which is item-wide. Chain: `(?!.*A)(?!.*B)` works.
13. **regexExclude word forms:** Must use truncated stems. `самострелами` ≠ `самострела`. Use `самострел` to catch both.
14. **Optimization table (Phase 2) — RESOLVED iter 40:** `"prefix (A|B|C)"` pattern was broken in PoE2 (Tests 15-17). Path D (`"prefix.*A|prefix.*B|prefix.*C"` — single quoted group, top-level `|`, `.*` bridges) is now implemented in ETL (`path-d-transform.ts` + Phase D in `compute-optimizations.ts` + `reoptimizeTable` in `iterative-optimizer.ts`) and runtime (`applyOptimizationTable` applies Path D entries even with negative savings). 303/481 opt-table entries converted, 0 broken remain. Next: D5 — in-game verification on 4 gems + extended set.
15. **Cross-block FP risk (iter 37):** `"X" "Y"` (AND across blocks) can match items where X and Y appear in DIFFERENT mod blocks. Use `.*` bridge in ONE quoted group (`"X.*Y"`) to force same-block match.
16. **Simulator `(?!…)` divergence (iter 37):** Simulator parses `(?!X)` as item-wide negation (X must not appear ANYWHERE in block), while the game uses position-specific lookahead. For most use cases (Y at block start, X after Y) they agree; edge cases (X before Y) diverge.
17. **Simulator `"X"|"Y"` divergence (RESOLVED iter 38):** Simulator parses `"X"|"Y"` as `"X"` AND `(|Y)` = `"X"` only. Game gives ZERO matches. Both are broken — neither gives OR semantics. Use Path D instead: `"X.*A|X.*B"` (single quoted group).

## 12. Deterministic Regex Strategy (8 Principles) — UNIFIED for ALL categories

> Added iter 37, updated iter 38 (Path D). See `docs/ARCHITECTURE.md` §3.1 for full details. Verified on 4 real gems (60 tests).

When writing regexes for ANY category (gems, rings, amulets, belts, waystones, tablets, relics):

1. **ONE MOD = ONE QUOTED GROUP** — each mod produces one `"..."` group with suffix + `.*` bridge + number pattern
2. **MULTI-MOD = AND ACROSS BLOCKS** — N mods → N quoted groups separated by spaces: `"mod1" "mod2"`
3. **`|` SCOPE — TOP LEVEL of one quoted group** — `|` works at top level of ONE quoted group (with or without `.*` in alternatives). It does NOT work between quoted groups or inside `()` with multi-word alternatives.
4. **`.*` BRIDGING WITHIN SINGLE BLOCK** — `"prefix.*suffix"` bridges number and middle words in one block
5. **SUFFIX UNIQUENESS** — find shortest suffix unique to the mod in the category (≥3 chars/word, end-only truncation)
6. **SHARED SUFFIX → DIFFERENTIATE BY NUMBER** — `"(1[0-5])%.*suffix"` for family regex, or exact number for specific roll
7. **CROSS-BLOCK FP RISK** — `"X" "Y"` may match different blocks → FP. Use `"X.*Y"` to force same-block match
8. **SAME-FAMILY OR → Path D (iter 38-39)** — `"prefix.*A|prefix.*B|prefix.*C"` (single quoted group, top-level `|`, `.*` bridges). ✅ 2 alt (D7-3, iter 38); ✅ 3+4 alt + AND-combination (D1, iter 39).

**NEVER use:** `"prefix (A|B|C)"`, `"(A B|C D)"`, `"X"|"Y"` — all confirmed BROKEN in-game (Tests 15-17, B0).

## 13. Documentation Map

| File | When to Update |
|------|----------------|
| `AGENT_NAVIGATION.md` | Every iteration |
| `STATUS.md` | On status changes |
| `docs/ARCHITECTURE.md` | On structural changes |
| `docs/ETL_GUIDE.md` | On ETL changes |
| `docs/DATA_CONTRACTS.md` | On type changes |
| `docs/IN_GAME_TESTS.md` | On new in-game test results |
