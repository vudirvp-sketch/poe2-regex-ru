# PoE2 Regex RU — Agent Navigation Guide

> **Version:** 24.0 | **Date:** 2026-06-16

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

**⚠️ CRITICAL:** Optimization table (Phase 2) is fundamentally broken for ~90% of entries because `|` with multi-word alternatives doesn't work in PoE2. See STATUS.md iteration 36 for redesign plan.

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
| `\|` | OR — **ONLY between single-word alternatives** | ✅ single-word only |
| `!` | NOT (must be INSIDE quotes with `\|`) | ✅ |
| `""` | Phrase grouping + AND separator | ✅ |
| `.*` | Within single block only | ✅ |
| `[]` | Character class | ✅ |
| `^` | Start-of-block anchor | ✅ |
| `()` | Grouping — **`\|` inside `()` does NOT work with multi-word** | ❌ multi-word |
| `\d` | Digit shorthand | ✅ |
| `{N,}` | Quantifier "N or more" | ✅ |
| `(?!…)` | Negative lookahead — per-block | ✅ |

**CRITICAL limitations (confirmed by Tests 15-17):**

1. **`|` does NOT work with multi-word alternatives in ANY context:**
   - `(скорости атаки|передвижения)` → nothing (Test 15)
   - `"повышение (брони|скорости)"` → matches only "повышение" broadly (Test 16)
   - `"повышение (брони|скорости атаки|шанса критического удара)"` → too much junk (Test 17)
2. **PoE2 tokenizes on spaces** — `|` only ORs adjacent single words within a token
3. **`()` does NOT preserve `|` for multi-word alternatives**
4. **Optimization table is broken** for ~90% of entries that use `|` between multi-word alternatives

**What DOES work:**
- `|` between single words: `"Бездн|Делир"`, `"огня|холоду"`
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
10. **`|` is ONLY for single-word alternation as the WHOLE quoted group** — multi-word `|` is broken everywhere (Tests 9-11, 15-17). No workaround via `()`, `"..."`, or any combination.
11. **AND-in-OR nested quotes:** When AND(LITERAL, EXCLUDE) is inside OR, compiler wraps in `"..."` creating nested quotes. PoE2 can't parse this. Fix pending Path B redesign.
12. **`(?!…)` works per-block** — unlike `!` which is item-wide. Chain: `(?!.*A)(?!.*B)` works.
13. **regexExclude word forms:** Must use truncated stems. `самострелами` ≠ `самострела`. Use `самострел` to catch both.
14. **Optimization table (Phase 2) fundamentally broken** — `|` between multi-word alternatives doesn't work. Redesign required (Path B).
15. **Cross-block FP risk (iter 37):** `"X" "Y"` (AND across blocks) can match items where X and Y appear in DIFFERENT mod blocks. Use `.*` bridge in ONE quoted group (`"X.*Y"`) to force same-block match.
16. **Simulator `(?!…)` divergence (iter 37):** Simulator parses `(?!X)` as item-wide negation (X must not appear ANYWHERE in block), while the game uses position-specific lookahead. For most use cases (Y at block start, X after Y) they agree; edge cases (X before Y) diverge.
17. **Simulator `"X"|"Y"` divergence (iter 37):** Simulator parses `"X"|"Y"` as `"X"` AND `(|Y)` = `"X"` only (because `parseQuotedGroups` splits on spaces outside quotes, not on `|`). Game behavior UNKNOWN — Test B0 pending.

## 12. Deterministic Regex Strategy (8 Principles) — UNIFIED for ALL categories

> Added iter 37. See `docs/ARCHITECTURE.md` §3.1 for full details. Verified on 4 real gems (60 tests).

When writing regexes for ANY category (gems, rings, amulets, belts, waystones, tablets, relics):

1. **ONE MOD = ONE QUOTED GROUP** — each mod produces one `"..."` group with suffix + `.*` bridge + number pattern
2. **MULTI-MOD = AND ACROSS BLOCKS** — N mods → N quoted groups separated by spaces: `"mod1" "mod2"`
3. **NO MULTI-WORD `|`** — `|` only between single words, as the WHOLE quoted group (`"A|B"` ✅)
4. **`.*` BRIDGING WITHIN SINGLE BLOCK** — `"prefix.*suffix"` bridges number and middle words in one block
5. **SUFFIX UNIQUENESS** — find shortest suffix unique to the mod in the category (≥3 chars/word, end-only truncation)
6. **SHARED SUFFIX → DIFFERENTIATE BY NUMBER** — `"(1[0-5])%.*suffix"` for family regex, or exact number for specific roll
7. **CROSS-BLOCK FP RISK** — `"X" "Y"` may match different blocks → FP. Use `"X.*Y"` to force same-block match
8. **SAME-FAMILY OR** — OR between same-family multi-word alternatives is impossible in current dialect. Options: (a) `"X.*A"|"X.*B"` [UNVERIFIED B0], (b) UI redesign with separate AND filters, (c) AND fallback

**NEVER use:** `"prefix (A|B|C)"`, `"(A B|C D)"`, `"A B|C D"` — all confirmed BROKEN in-game (Tests 15-17, 9-11).

## 13. Documentation Map

| File | When to Update |
|------|----------------|
| `AGENT_NAVIGATION.md` | Every iteration |
| `STATUS.md` | On status changes |
| `docs/ARCHITECTURE.md` | On structural changes |
| `docs/ETL_GUIDE.md` | On ETL changes |
| `docs/DATA_CONTRACTS.md` | On type changes |
| `docs/IN_GAME_TESTS.md` | On new in-game test results |
