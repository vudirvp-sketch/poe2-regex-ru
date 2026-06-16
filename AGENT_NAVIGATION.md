# PoE2 Regex RU — Agent Navigation Guide

> **Version:** 31.0 | **Date:** 2026-06-17

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

**✅ RESOLVED + PRODUCTION-VERIFIED (iter 40-42):** Optimization table (Phase 2) was broken for ~90% of entries because `|` inside `()` with multi-word alternatives doesn't work in PoE2 (Tests 15-17). Path D strategy (`"prefix.*A|prefix.*B|prefix.*C"` — top-level `|` in ONE quoted group with `.*` bridges) is IMPLEMENTED in ETL (`scripts/etl/path-d-transform.ts` + Phase D in `compute-optimizations.ts` + `reoptimizeTable` in `iterative-optimizer.ts`) and runtime (`applyOptimizationTable` applies Path D entries even with negative savings). 327/529 opt-table entries in Path D format, 0 broken `()` entries remain. **iter 41 D5 VERIFIED**: 5/5 in-game tests PASS on production ETL output covering 5 categories (jewel, amulet, ring, waystone, tablet). Same-block AND confirmed. PoE2 regex char limit ≈ 250 chars discovered (iter 41) + diagnostic implemented (iter 42): `findOverLimitEntries()` in `path-d-transform.ts` + Phase D1 in `compute-optimizations.ts` + final summary in `iterative-optimizer.ts`.

**✅ iter 44 FP-FIX (3 bugs in shared `src/core/`):** User reported FP in jewel selection — 3 compaund bugs found & fixed:
1. `removeConflictingExcludes` (core-optimizations.ts) — was removing ENTIRE `EXCLUDE(OR(...))` when ANY literal conflicted; now removes only conflicting literals (surgical).
2. `applyOptimizationTable` (optimization-strategies.ts) — was applying FULL opt-entry regex on strict subset; now SKIPS opt-entries with top-level `|` when `matchedIds.size < entry.ids.length` (FP prevention).
3. Compiler `normalizeAst` (compiler.ts) — was producing nested quotes when AND(LITERAL, EXCLUDE) is inside OR; now transforms to single LITERAL with per-block lookahead `X(?!.*A)(?!.*B)...` (avoids PoE2 nested-quote parsing bug).
All 1106 tests pass (1094 + 12 new). ETL unchanged (FN=0). Fixes apply to ALL categories (shared code).

**⚠️ iter 45 ANALYSIS (FP persists with `(?!…)`):** User in-game tested iter 44 regex — FP with minion affix «Приспешники имеют повышение скорости атаки и сотворения чар» REMAINED. Root cause: `(?!.*X)` lookahead is **forward-only** — checks text AFTER the matched position, doesn't see exclude patterns that appear BEFORE the suffix in the same block. Symptom: `повышение скорости атаки(?!.*Приспеш)` matches «Приспешники имеют … повышение скорости атаки и сотворения чар» because after matching «повышение скорости атаки» the rest « и сотворения чар» has no «Приспеш». **Simulator gap:** `poe2-regex-matcher.ts` does NOT tokenize `(?!…)` at all → iter 44 regression test checked compiled-string STRUCTURE, not SEMANTICS. **Proposed fix for iter 46** (NOT YET IMPLEMENTED — needs in-game verify of `^` inside `|`-group): change compiler to produce `^(?!.*A)(?!.*B).*X` instead of `X(?!.*A)(?!.*B)` — anchors lookahead at block start so `.*` covers whole block (bidirectional exclude). One-line change. +3 chars per LITERAL (still ≤250). Pitfall 12 updated, Pitfall 22 added (simulator gap).

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
| `\|` (top-level in ONE quoted group) | OR — single-word OR multi-word with `.*` bridges | ✅ iter 38 (2 alt) + iter 39 (3+4 alt + AND, D1) + iter 41 (6-9 alts + same-block AND, D5) |
| `\|` (BETWEEN two quoted groups) | OR — BROKEN, zero matches | ❌ B0 confirmed iter 38 |
| AND via space (cross-block AND) | AND across blocks | ✅ iter 37 |
| AND via space (same-block AND) | AND within single block — `"X" "Y"` matches when both in ONE block | ✅ iter 41 D5-2 |
| Regex char limit ≈ 250 chars | Single regex >250 chars rejected by game | ⚠️ iter 41 D5-1v1 (262) and D5-2v1 (327) failed; iter 42 ETL diagnostic implemented (`findOverLimitEntries`) |
| `!` | NOT (must be INSIDE quotes with `\|`) | ✅ |
| `""` | Phrase grouping + AND separator | ✅ |
| `.*` | Within single block only | ✅ |
| `[]` | Character class | ✅ |
| `^` | Start-of-block anchor | ✅ (Phase 9b для single-quoted; в OR-context — НЕ верифицировано, нужен тест iter 46) |
| `()` with single-word `\|` inside | Grouping — works alone | ✅ |
| `()` with multi-word `\|` inside | Grouping — BROKEN | ❌ Test 15 |
| `"prefix (A\|B)"` (non-`.*` prefix + `()` + `\|`) | BROKEN — matches only prefix broadly | ❌ Test 16 |
| `\d` | Digit shorthand | ✅ |
| `{N,}` | Quantifier "N or more" | ✅ |
| `(?!…)` Negative lookahead — per-block | ⚠️ **forward-only** (iter 45 finding) | Смотрит только ВПЕРЁД от текущей позиции. Не видит exclude-паттерны ДО суффикса в блоке. Lookbehind `(?<!…)` НЕ поддерживается. **См. Pitfall 12, 22.** |

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
11. **AND-in-OR nested quotes (PARTIALLY FIXED iter 44):** When AND(LITERAL, EXCLUDE) is inside OR, compiler previously wrapped in `"..."` creating nested quotes — PoE2 strips inner quotes, breaking the regex. **iter 44 FIX:** `normalizeAst` in `compiler.ts` now transforms AND(LITERAL, EXCLUDE(LITERAL|OR(LITERAL,...))) inside OR into a single LITERAL with per-block lookahead `X(?!.*A)(?!.*B)...`. This avoids nested quotes for the common case (token with regexExclude in OR mode). **REMAINING:** AND with multiple LITERALs + EXCLUDE (e.g., regexPrefixContext + LITERAL + EXCLUDE) is NOT yet transformed — still produces nested quotes. Rarer case, documented but not blocking.
12. **`(?!…)` is FORWARD-ONLY (iter 45 finding):** Negative lookahead `(?!.*X)` in PoE2 checks text **AFTER** the current position only. It does NOT see exclude patterns that appear BEFORE the matched substring in the same block. iter 44 fix used `Z(?!.*X)(?!.*Y)` — works for excludes that come AFTER `Z` (e.g., weapon-specific «повышение скорости атаки луками» — exclude «луками» is after suffix), but FAILS for excludes that come BEFORE `Z` (e.g., minion «Приспешники имеют … повышение скорости атаки» — exclude «Приспеш» is before suffix → FP). Lookbehind `(?<!…)` is NOT supported in PoE2. **iter 46 PROPOSED FIX (not yet implemented — needs in-game verify of `^` in OR-context):** change compiler output from `Z(?!.*X)(?!.*Y)` to `^(?!.*X)(?!.*Y).*Z` — anchoring lookahead at block start makes `.*` inside lookahead cover the WHOLE block (both before and after suffix position), giving bidirectional exclude semantic. +3 chars per LITERAL, still ≤250 char limit. One-line change in `compiler.ts` normalizeAst.
13. **regexExclude word forms:** Must use truncated stems. `самострелами` ≠ `самострела`. Use `самострел` to catch both.
14. **Optimization table (Phase 2) — RESOLVED iter 40, PRODUCTION-VERIFIED iter 41, char-limit diagnostic iter 42, strict-subset FP-fix iter 44:** `"prefix (A|B|C)"` pattern was broken in PoE2 (Tests 15-17). Path D (`"prefix.*A|prefix.*B|prefix.*C"` — single quoted group, top-level `|`, `.*` bridges) is implemented in ETL (`path-d-transform.ts` + Phase D in `compute-optimizations.ts` + `reoptimizeTable` in `iterative-optimizer.ts`) and runtime (`applyOptimizationTable` applies Path D entries even with negative savings). 327/529 opt-table entries in Path D format, 0 broken remain. **iter 41 D5:** 5/5 in-game tests PASS on production ETL output. **iter 42:** ETL char-limit diagnostic added. **iter 44:** `applyOptimizationTable` now SKIPS opt-entries with top-level `|` when user's selection is a STRICT SUBSET (`matchedIds.size < entry.ids.length`) — prevents FP from unselected alternatives. Plain shared-substring entries (no `|`) are still applied on subset (Phase 1 dedup handles them safely).
15. **Cross-block FP risk (iter 37):** `"X" "Y"` (AND across blocks) can match items where X and Y appear in DIFFERENT mod blocks. Use `.*` bridge in ONE quoted group (`"X.*Y"`) to force same-block match.
16. **Simulator `(?!…)` divergence (iter 37, EXPANDED iter 45):** Simulator parses `(?!X)` as item-wide negation (X must not appear ANYWHERE in block), while the game uses position-specific lookahead. **iter 45 ADDENDUM:** Simulator does NOT tokenize `(?!…)` at all (`?` is treated as `optional` quantifier) → lookahead is effectively IGNORED in simulator. iter 44 regression test (lines 888-968 of `tests/core/optimizer.test.ts`) checked COMPILED-STRING STRUCTURE (contains `(?!.*A)`, no nested quotes), NOT SEMANTIC behavior (does the regex actually exclude minion-блок?). **iter 46 TODO:** add `(?!…)` tokenization to `poe2-regex-matcher.ts` + semantic regression test against minion-блок data.
17. **Simulator `"X"|"Y"` divergence (RESOLVED iter 38):** Simulator parses `"X"|"Y"` as `"X"` AND `(|Y)` = `"X"` only. Game gives ZERO matches. Both are broken — neither gives OR semantics. Use Path D instead: `"X.*A|X.*B"` (single quoted group).
18. **PoE2 regex char limit ≈ 250 chars (iter 41, diagnostic iter 42):** Single regex string >250 chars is silently rejected by the game (D5-1 v1 with 262 chars and D5-2 v1 with 327 chars both failed). When manually crafting regex or generating opt-table entries, keep total length ≤250 chars. **iter 42:** ETL now logs warnings for over-limit opt-table entries via `findOverLimitEntries()` (in `path-d-transform.ts`) — called from Phase D1 in `compute-optimizations.ts` and from final summary in `iterative-optimizer.ts`. Policy is **diagnostic-only**: entries are kept in the table (useful for subset selection — compiler picks the matching subset when fewer ids are selected), but the full entry cannot be used as a single in-game regex when ALL its ids are selected.
19. **Same-block AND semantics (iter 41):** `"X" "Y"` matches when X and Y are both present in the SAME block (same mod) OR in DIFFERENT blocks (cross-block AND). This was confirmed in D5-2: waystone mod `Монстры имеют 276% повышение шанса критического удара` matches `"имеют" "повышение.*шанса критического удара"` (BOTH in ONE block). This means `regexPrefixContext` AND combination (`"ctx" "Path D regex"`) works correctly — no need to switch to `"ctx.*Path D"` single-quoted-group form.
20. **FP from opt-entry subset (iter 44 FIX):** When user selects a STRICT SUBSET of an opt-entry's IDs, applying the FULL opt regex caused FP — items matching unselected alternatives also matched. **iter 44 FIX:** `applyOptimizationTable` now skips opt-entries with top-level `|` when `matchedIds.size < entry.ids.length`. For family-based entries (no `|` in regex), Phase 1 dedup produces the same single-LITERAL regex anyway — no behavior change.
21. **`removeConflictingExcludes` surgical removal (iter 44 FIX):** Previously, if ANY literal inside `EXCLUDE(OR(...))` conflicted with a sibling LITERAL, the ENTIRE EXCLUDE was dropped — losing all other non-conflicting exclude patterns. This caused FP (e.g., items matching non-conflicting excludes were no longer excluded). **iter 44 FIX:** Only conflicting literals are removed from the EXCLUDE's OR; non-conflicting ones are preserved. The EXCLUDE is dropped entirely only when ALL its literals conflict.
22. **`^`-anchor underused for LITERAL-with-excludes (iter 45 finding):** `^` start-of-block anchor is verified in-game (Phase 9b) but used ONLY for RANGE nodes (number-anchoring). For LITERAL nodes with regexExclude (iter 44 AND-in-OR transform), `^` is NOT used — the compiler produces `Z(?!.*X)` instead of the more robust `^(?!.*X).*Z`. This is the root cause of the iter 45 FP (Pitfall 12). **iter 46 PROPOSED FIX:** add `^` prefix to the merged LITERAL in `compiler.ts` normalizeAst AND-in-OR transform. **Risk:** needs in-game verify that `^` works inside `|`-groups (applies only to first alternative). If it doesn't, alternative is to use `^` + number anchor at ETL level (more invasive, requires ETL regeneration).

## 12. Deterministic Regex Strategy (8 Principles) — UNIFIED for ALL categories

> Added iter 37, updated iter 38-45 (Path D production-verified, char-limit diagnostic, iter 44 FP-fixes, iter 45 forward-only-lookahead finding). See `docs/ARCHITECTURE.md` §3.1 for full details.

When writing regexes for ANY category (gems, rings, amulets, belts, waystones, tablets, relics):

1. **ONE MOD = ONE QUOTED GROUP** — each mod produces one `"..."` group with suffix + `.*` bridge + number pattern
2. **MULTI-MOD = AND ACROSS BLOCKS** — N mods → N quoted groups separated by spaces: `"mod1" "mod2"`. Also works WITHIN single block (same-block AND, iter 41 confirmed).
3. **`|` SCOPE — TOP LEVEL of one quoted group** — `|` works at top level of ONE quoted group (with or without `.*` in alternatives). It does NOT work between quoted groups or inside `()` with multi-word alternatives.
4. **`.*` BRIDGING WITHIN SINGLE BLOCK** — `"prefix.*suffix"` bridges number and middle words in one block
5. **SUFFIX UNIQUENESS** — find shortest suffix unique to the mod in the category (≥3 chars/word, end-only truncation)
6. **SHARED SUFFIX → DIFFERENTIATE BY NUMBER** — `"(1[0-5])%.*suffix"` for family regex, or exact number for specific roll
7. **CROSS-BLOCK FP RISK** — `"X" "Y"` may match different blocks → FP. Use `"X.*Y"` to force same-block match. Note: `"X" "Y"` ALSO matches when X and Y are in the SAME block (iter 41 confirmed).
8. **SAME-FAMILY OR → Path D (iter 38-41, COMPLETE; iter 42 char-limit diagnostic; iter 44 subset-FP-fix)** — `"prefix.*A|prefix.*B|prefix.*C"` (single quoted group, top-level `|`, `.*` bridges). ✅ 2 alt (D7-3, iter 38); ✅ 3+4 alt + AND-combination (D1, iter 39); ✅ ETL (D2+D4, iter 40); ✅ **production-verified 6-9 alts + same-block AND + cross-cat FP (D5, iter 41)**; ✅ char-limit diagnostic (D7, iter 42); ✅ subset-FP-fix (iter 44). **Constraint:** total length ≤250 chars (PoE2 hard limit). ETL logs warnings for over-limit entries; entries are kept for subset selection. **iter 44:** `applyOptimizationTable` skips opt-entries with top-level `|` on strict subset (prevents FP).

**NEVER use:** `"prefix (A|B|C)"`, `"(A B|C D)"`, `"X"|"Y"` — all confirmed BROKEN in-game (Tests 15-17, B0).

**iter 44 FP-fix summary (3 bugs in shared `src/core/`):**
- `removeConflictingExcludes` (core-optimizations.ts) — surgical: removes only conflicting literals, not entire EXCLUDE
- `applyOptimizationTable` (optimization-strategies.ts) — skips opt-entries with `|` on strict subset
- `normalizeAst` in `compiler.ts` — transforms AND(LITERAL, EXCLUDE) inside OR to single LITERAL with per-block lookahead `X(?!.*A)(?!.*B)...`

**⚠️ iter 45 FINDING:** iter 44's `X(?!.*A)(?!.*B)` is **forward-only** — fails when exclude `A` appears BEFORE `X` in same block (e.g., minion affix «Приспешники имеют … повышение скорости атаки»). FP remains in production. **iter 46 proposed fix (NOT YET IMPLEMENTED):** change to `^(?!.*A)(?!.*B).*X` — anchor at block start makes lookahead cover whole block. Needs in-game verify of `^` in `|`-group context.

**Constraints:** Single regex total length ≤250 chars (PoE2 hard limit). ETL `findOverLimitEntries()` in `path-d-transform.ts` detects over-limit entries; Phase D1 in `compute-optimizations.ts` + final summary in `iterative-optimizer.ts` log warnings.

## 13. Documentation Map

| File | When to Update |
|------|----------------|
| `AGENT_NAVIGATION.md` | Every iteration |
| `STATUS.md` | On status changes |
| `docs/ARCHITECTURE.md` | On structural changes |
| `docs/ETL_GUIDE.md` | On ETL changes |
| `docs/DATA_CONTRACTS.md` | On type changes |
| `docs/IN_GAME_TESTS.md` | On new in-game test results |
