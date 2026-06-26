# PoE2 Regex RU — Agent Navigation

> **Entry document.** Read this first. Current state: **iter 128** — фикс KI#13: пропущен implicit `Редкость монстров: +##%` + BTS-статы в waystone-аффиксах. Пользователь сообщил: в суффиксах/префиксах "каша" — попали "за кулисами"-статы, которые плюсуются к имплиситам и не должны быть searchable. Root cause: (a) `generateWaystoneImplicitTokens()` не включал `Редкость монстров`; (b) `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` содержал только 4 ключа, не покрывая 6 других BTS-паттернов (`На #% больше волшебных и редких монстров`, `На #% больше шанса появления свойств у редких монстров`, `На #% больше эффективности монстров`, `#% увеличение количества редких монстров`, `#% увеличение количества волшебных монстров`, `#% увеличение количества путевых камней, находимых в области`). Фикс: добавлен implicit `Редкость монстров: +##%` с regex `'едкость монстров'` (15 chars, disambiguate от `'едкость предметов'` iter 126), `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` расширен до 10 ключей, patch `waystone.json` (156→110 tokens: -47 BTS, +1 implicit) + `waystone-desecrated.json` (32→28: -5 BTS, +1 implicit), override в `i18n-overrides.json`. +34 теста в `tests/core/iter128-ki13-monster-rarity.test.ts` (7 секций). Patch script: `scripts/apply-ki13-fix.py` (идемпотентный). 1992/1992 tests. KI#10-KI#12 закрыты (iter 126-127). KI#7/KI#8/KI#9 — awaiting user verification/monitoring. Актуальный статус — в `STATUS.md`, история — в `worklog.md`, полный план сортировки — в `docs/AFFIX_ORDERING_PLAN.md`, полный UI-аудит — в `docs/UI_AUDIT.md`.

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
| `src/ui/hooks/category-ast-utils.ts` | Pure AST helpers extracted from `useCategoryPage.ts` (iter 78, Bug #8 Phase 1). Exports: `buildAstFromSelections` (main entry, ~434 строки), `pushLiteralsWithFamilyLogic`, `applyRuntimeYofication`, `getEffectiveRange`/`getEffectiveRangePerSlot`/`getPrefixForSlot`/`getSignPrefix`/`buildLiteralNode`/`computeSuppressedExcludes`. | All PURE (no React, no side effects). Re-exported from `useCategoryPage.ts` для backward compat с tests. |
| `src/ui/hooks/useCategoryPage.ts` | Main hook для category pages. iter 79 (Bug #8 Phase 2): split на 3 sub-hooks (`useFilterStore`/`useCategoryData`/`useRegexBuilder`) — все exported. `useCategoryPage(config)` composes их + keeps URL sync inline. Accepts optional `config.filterStore: FilterStoreHook` для pages с extraAstNodes-from-local-state (Waystone/Jewel/Tablet). 638 строк total (3 sub-hooks with full docstrings + main hook + URL sync + restoreFilterState). | Backward compat: `useCategoryPage({ categoryId: 'belt' })` still works (5 unaffected pages unchanged). Re-exports `buildAstFromSelections` + `pushLiteralsWithFamilyLogic` + `applyRuntimeYofication` from `category-ast-utils` для tests. |
| `src/ui/layout/TopNav.tsx` | Unified horizontal top navigation (iter 64). Single sticky bar at the top: brand (logo + title) \| tabs (scrollable) \| feedback hint (lg+). Replaces the previous `Sidebar` + `Header` + `MobileNavTabs` trio. | `role="banner"` on `<header>`, `role="navigation"` + `aria-label` on inner `<nav>`. Active state: `.nav-mode-active` class with gold `::after` border-b accent (overlaps the TopNav's bottom border). |
| `src/ui/components/StatusPanel.tsx` | Unified status panel for all category pages. Props: `wantTokens`, `excludeTokens`, `allActiveTokens` + optional `badges` (ReactNode[]) + `alerts` (ReactNode[]). | Replaces ~15-20 lines of duplicated inline JSX per page. |
| `src/ui/layout/nav-items.ts` | Shared `navItems` array (9 entries: home + 8 categories). Single source of truth — consumed by `TopNav.tsx`. | Single source — do not duplicate the nav list anywhere else. |
| `src/ui/layout/CategoryLayout.tsx` | 2-col desktop / 1-col mobile shell for category pages. Slots: `header`, `controls`, `regexOutput`, `status?`, `sidebar?`, `mobileBar?`, `children`. When `mobileBar` is provided, aside is `hidden lg:flex` and `status`+`sidebar` render in a separate mobile-only section above the sticky bar. | Adopted by ALL 8 category pages. `status` slot uses `<StatusPanel>`. |
| `src/ui/components/MobileRegexBar.tsx` | Mobile-only sticky bottom bar. Props: `regexOutput` (ReactNode), `alerts` (ReactNode[]). `lg:hidden`. | Used by all 8 category pages. Desktop unaffected. `.mobile-regex-bar*` CSS rules MUST live inside `@media (max-width: 1023px)` — see Pitfall 26. |
| `src/ui/layout/Layout.tsx` | Root application shell. Structure: `<TopNav>` + `<main>` (scrollable). Sets `data-theme="dark"` on `<html>` once on mount (dark-only theme). | Was 3-piece (Sidebar + Header + MobileNavTabs) before iter 64. |
| `public/` | Static assets: robots.txt, sitemap.xml, 404.html, IndexNow key, Google/Yandex/Bing verification, favicon, og-banner | Served as-is by GitHub Pages |
| `public/atmosphere/` | PoE2-themed texture + hero decoration assets. **iter 65**: `bg.webp` (body bg texture), `bg-2x.webp` (`.poe-divider--ornate` border texture), `title-bg-4x.webp` + `early-access-button-underlay.webp` (visual reference only — `.poe-panel-header` / `.btn-cta` are pure CSS reinterpretations). **iter 67**: added `early-access-banner.webp`. **iter 69**: 4 hero decoration WebPs (`hero-bas-relief`, `hero-horned-warrior`, `hero-monster-red`, `hero-demon-blue`) — PNG → WebP q85 via one-off script. **iter 70**: `bg-forest.webp` + `bg-forest-mobile.webp` deleted. **iter 71**: `early-access-banner.webp` (`.poe-divider--banner` class on HomePage) + `hero-demon-blue.webp` (SeoBlock right-edge decoration, visible only when `<details>` open, opacity 0.10, lg+ only) + `news-bg-center.webp` (mobile-only `<lg` hero backdrop). **iter 120**: 3 side ghosts replaced with full-body portraits — `hero-shaman.webp` (left) + `hero-iva.webp` (right), 4 backdrop images (`hero-bas-relief`, `hero-horned-warrior`, `hero-monster-red`, `news-bg-center`) removed from JSX (kept on disk). **iter 121**: side ghosts moved OUT of hero block to root of HomePage JSX (anchored to `<main>` edges). **iter 122**: 4 stale webp deleted from disk (`hero-bas-relief`, `hero-horned-warrior`, `hero-monster-red`, `news-bg-center`) + `seo-atmosphere.webp` added (faf.png 1672×941 → WebP q85, 1600×900, 146 KB — wide landscape backdrop for SeoBlock, `.home-seo-atmosphere` class, opacity 0.18, `mix-blend-screen`, fade bottom 40%, lg+ only). All atmosphere assets now actively referenced from JSX or CSS — `title-bg-4x.webp` and `early-access-button-underlay.webp` are kept as visual reference for the pure-CSS reinterpretations (mentioned in CSS comments only). |
| `scripts/` | ETL pipeline (`scripts/etl/`) + prerender (`prerender.ts`/`prerender-full.ts`) + analysis (`analyze-regexes.ts`/`analyze-fn.ts`/`restructure-implicits.ts`) + current-iter audit (`verify-iter99-alpha-sort.ts`). iter 100 удалил 16 исторических verify/simulate/analyze-iter* скриптов (iter 49–95, все покрыты unit-тестами). iter 122 удалил dead one-off `optimize_hero_images.py` (iter 69 PNG→WebP конвертер, ссылался на отсутствующие `.png` исходники). | `pnpm etl` / `tsx scripts/prerender.ts` / `tsx scripts/prerender-full.ts`. **Не добавлять новые verify-iter*-*.ts** — покрыть через `tests/` (vitest) или inline sanity в `worklog.md`. |
| `tests/` | Vitest — core/, shared/, etl/, ui/, **integration/** (iter 102: e2e regression tests for runtime-classification pipeline) | `pnpm test` |
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
pnpm install              # Install dependencies (or: npm install)
pnpm dev                  # Vite dev server
pnpm build                # tsc -b + vite build + shell prerender (no Playwright)
pnpm build:full           # tsc -b + vite build + shell prerender + Playwright prerender
pnpm prerender:full       # Run Playwright prerender only (needs dist/)
pnpm test                 # Vitest (all tests) — current: 1820 passing
pnpm etl                  # Full ETL with optimizer
pnpm etl:fresh            # ETL without cache (regenerate all)
pnpm etl:check-stale      # Check source HTML staleness
pnpm optimize             # Run iterative optimizer only
pnpm analyze-fn           # FN/FP analysis report
```

**Note:** If `pnpm` is not installed, `npm run <script>` works as a drop-in replacement. The build uses `tsc -b` (build mode with project references) — this is **stricter** than `tsc --noEmit` and catches missing imports that `--noEmit` silently ignores. Always run `pnpm build` (or `npx tsc -b`) to verify, not just `tsc --noEmit`.

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
| `"prefix.*literal(A\|B\|C)"` (`()` ПОСЛЕ `.*` bridge + literal) | **BROKEN in-game** — engine ignores `()` content, matches prefix broadly. iter 125 fix: `distributeAlternation()` in `src/core/compiler.ts` converts to `prefix.*literalA\|prefix.*literalB\|...` (Path D — top-level `\|`, in-game verified). Applied to reversed `RANGE` (implicits like `Редкость предметов: +##%` → `едкость.*\+2[5-9]%\|едкость.*\+[3-9][0-9]%\|...`). | ❌ → ✅ (fixed iter 125) |
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

20. **`CategoryControlPanel` — split-only (iter 52-54):** Component renders ONLY the controls row (no `<RegexOutput>`, no sticky wrapper). Page passes `<RegexOutput>` separately to `<CategoryLayout>`'s `regexOutput` slot (right column, sticky via `<aside>`).
    - **All 8 category pages** use this pattern: `<CategoryLayout>` wraps page; `<CategoryControlPanel>` (no special flags) in `controls` slot; `<RegexOutput>` + status + `<ProfilePanel>` in right-column slots; ModList in `children`.
    - **Kept:** `activeTokenCount` (used for active-tokens counter in controls row), `extraControls` slot (waystone corrupted/delirious, jewel type filter, tablet type/rarity/uses), `clearButton` slot (Vendor).
    - **Range warnings pattern (iter 61, Phase 8 «expensive silence»):** Visible warning badges are kept ONLY for specific/actionable conditions: `⚠ ≥40` (PoE2 boundary at min ≥ 40) and `⚠ Округл.` (round10 + AND fallback when range >50 values). The range notation FP warning was REMOVED as a visible badge (it was always-on whenever any min/max was set = pure noise) — instead it lives in the `title` attribute of the range-input container (hover to see). General rule for future polish: **never show a warning badge that fires on every normal use of a feature** — that's noise. Either make it conditional (specific threshold), or push it into a tooltip.
    - Page-specific notes: VendorPage has NO `<PageStateWrapper>` (sync data) and NO `<ProfilePanel>` (sidebar slot empty). All 8 pages use `<StatusPanel>` in `status` slot. WaystonePage/TabletPage use `badges` prop; JewelPage/VendorPage use `alerts` prop.

21. **Level 1 visual frames (iter 55):** Two families of Level 1 decorative frames exist in `index.css` — both use the same pattern (gradient bg + 1px subtle border + 3px colored border-left + corner accents via `::before`/`::after`):
    - **Affix headers** (`.affix-header-prefix` / `-suffix` / `-implicit`): blue / orange / amber colors. Used by `ModList` to label affix groups.
    - **`RegexOutput`** (`.regex-output`): **gold** (`--poe-gold` = `#C89A4A`, brand accent) + glow `box-shadow`. Marks the primary output element. Padding `12px` desktop, `10px` mobile.
    - **Do NOT** re-add inline `style={{ background: ... }}` on `RegexOutput` root div — `.regex-output` CSS owns the background now (inline style was removed iter 55).

22. **Navigation as "modes" — unified `TopNav` (iter 56 → iter 64):** Iter 64 consolidated the previous 3-piece chrome (`Sidebar` desktop-only vertical + `Header` page-title bar + `MobileNavTabs` mobile-only horizontal) into a single horizontal `TopNav.tsx`. The desktop vertical sidebar is GONE — it was eating ~224px (`w-56`) of horizontal space, which is now available for the affix list (ModList) and the right-column RegexOutput/StatusPanel.
    - **Layout:** `Layout.tsx` is now `flex flex-col h-screen` → `<TopNav>` (sticky top, ~52-56px) + `<main>` (scrollable, takes the rest). Previously was `flex` (row) with `<Sidebar>` + content column. The `data-theme="dark"` side-effect moved from `Header.tsx` to `Layout.tsx` (so it doesn't depend on the nav component existing).
    - **TopNav structure:** brand (logo + title stack, title hidden on `< sm`) → tabs (`flex: 1` + `overflow-x: auto`, scrollable on narrow screens, fits on md+) → feedback hint (`hidden lg:block`). Single row, no drawer, no hamburger.
    - **Active state** uses the same `.nav-mode-active` CSS class as before, but the visual language changed: was `border-left: 3px` (vertical sidebar), now `::after` pseudo-element with `border-bottom: 3px` gold accent that overlaps the TopNav's bottom border (so the active tab visually "anchors" to the bar). Subtle gold-tinted gradient bg + box-shadow glow + brand-gold text are preserved.
    - **Padding compensation removed:** the previous `.nav-mode-link.nav-mode-active` / `.mobile-nav-tab.nav-mode-active` `padding-left: calc(<px> - 3px)` rules are GONE — the `::after` approach doesn't need padding compensation because the accent is a pseudo-element, not a real border that affects layout.
    - **i18n key rename:** `sidebar.feedback` → `nav.feedback` (the `sidebar.*` namespace is gone together with the Sidebar component). The page title for `/` is rendered by `HomePage`'s own hero `<h1>` (`home.title`); category pages render their title in `CategoryLayout`'s `header` slot. (iter 66 cleanup: unused `home.header_title` key removed from `i18n.ts`.)
    - **Deleted files (iter 64):** `src/ui/layout/Sidebar.tsx`, `src/ui/layout/MobileNavTabs.tsx`, `src/ui/layout/Header.tsx`. Do NOT re-add them — they are superseded by `TopNav.tsx`. Do NOT re-add the hamburger / drawer / focus-trap patterns either (those were already removed iter 56).
    - **CSS cleanup:** `.sidebar-atmosphere`, `.header-atmosphere`, `.mobile-nav-tabs`, `.mobile-nav-tabs-scroll`, `.mobile-nav-tab`, `.nav-mode-link.nav-mode-active`, `.mobile-nav-tab.nav-mode-active` rules are all DELETED from `src/index.css`. The `.topnav`, `.topnav-bar`, `.topnav-brand*`, `.topnav-tabs`, `.topnav-tab` rules replace them. If you need to debug nav styling, look at the `/* ─── TopNav (iter 64, UI Phase 10) ─── */` block in `index.css`.

23. **HomePage compaction + `<details>` blocks (iter 57 + iter 62):** HomePage has TWO `<details>` blocks — both collapsed by default, content stays in DOM (Google indexes):
    - **Features section (iter 62, Phase 8b):** The 3-card grid (data / optimize / share) was visually noisy on a page whose hero already lists the same info as stat badges (mods count, categories, 250-char limit, regex optimization). Wrapped in `<details className="home-seo-details">` with summary `home.features_summary`. Inner cards keep their existing styling — same `.home-seo-*` CSS classes as SeoBlock.
    - **SeoBlock (iter 57):** Long-form SEO/FAQ text. `<details className="home-seo-details">` → `<summary className="home-seo-summary">` (gold text + custom `▸` marker that rotates 90° on open) → `<section className="home-seo-content">` with the 4 original SEO sections.
    - **SEO preservation:** `<details>` content stays in the DOM (Google indexes it even when closed). Do NOT add `hidden` or conditional rendering — that would strip SEO content.
    - **Compaction philosophy:** Tighten spacing, NOT content. If you need to add more sections, follow the same density tokens (`p-3`, `gap-3`, `text-[12-13px]`).
    - **Do NOT** re-add the default `<summary>` triangle — `list-style: none` + `::-webkit-details-marker { display: none }` suppress it; the custom `▸` marker is in `::before`.

24. **StatusPanel — unified status component (iter 58):** All 8 category pages use `<StatusPanel>` for the right-column `status` slot. The component accepts `wantTokens`, `excludeTokens`, `allActiveTokens` (mandatory) plus optional `badges` (ReactNode[]) and `alerts` (ReactNode[]).
    - **Standard pages** (Belt, Amulet, Ring, Relic): just `<StatusPanel wantTokens={...} excludeTokens={...} allActiveTokens={...} />`.
    - **Extended pages** pass category-specific data via `badges`: Waystone (corrupted/uncorrupted/delirious strings), Tablet (type/rarity/uses strings).
    - **Alert pages** pass warning blocks via `alerts`: Jewel (amber hidden-mods alert with "Deselect" button), Vendor (yellow verification note).
    - **Do NOT** re-add inline status JSX to any page — always extend StatusPanel via `badges`/`alerts` props.

25. **MobileRegexBar — mobile sticky bottom bar (iter 59):** On mobile (< lg), `RegexOutput` moves from the right-column aside into a sticky-bottom bar (`MobileRegexBar.tsx`). StatusPanel `alerts` follow it into the same bar. Desktop (lg+) is unchanged.
    - **Double-render tradeoff:** `RegexOutput` is mounted in BOTH the desktop aside AND the mobile bar. Each instance has its own transient React state, but `autoCopy` is persisted to localStorage so both stay in sync. Acceptable cost to avoid CSS hacks for single-DOM-node teleportation.
    - **Vendor price-filter (iter 59):** VendorPage passes `hasRangedTokens={false}` to `<CategoryControlPanel>` — the global min/max inputs were no-ops. Per-chip range inputs in `<FilterChip>` are the primary UX for vendor.

26. **CSS specificity vs Tailwind responsive utilities (iter 60, Known Issue #7):** When you write a custom CSS rule in `index.css` that targets a class ALSO used as a Tailwind responsive utility (e.g. `.my-class { display: flex }` + JSX `className="my-class lg:hidden"`), the custom rule has specificity (0,1,0) and the Tailwind `.lg\:hidden { display: none }` ALSO has specificity (0,1,0). Tie → source-order wins. Tailwind utilities are emitted FIRST (from `@import "tailwindcss"` at top of `index.css`); custom CSS comes AFTER. So at ≥lg viewport, the custom `display: flex` was overriding Tailwind's `display: none` — making `lg:hidden` appear broken.
    - **Symptom:** element with `lg:hidden` was visible on desktop.
    - **Fix:** wrap ALL custom CSS rules for mobile-only elements inside `@media (max-width: 1023px)`. Then on desktop, the rule never applies, and `lg:hidden` is uncontested. This is the pattern used for `.mobile-regex-bar*` rules.
    - **General rule:** if a custom CSS class coexists with a Tailwind responsive utility class on the same element AND sets the same property (`display`, `position`, etc.), wrap the custom rule in the inverse media query (`max-width: <bp>-1px`). Do NOT use `!important` — it makes future overrides harder.

27. **ModList Level-3 badge auto-suppression (iter 62, Phase 8c):** When a scope (affix column OR origin section OR jewel-type-filtered list) contains ONLY ONE sub-group, the Level-3 semantic badge is redundant — it just repeats what the parent header (affix name / origin name / jewel type filter) already says. The `ModSubGroupSection` component accepts a `hideLabel?: boolean` prop; callers compute it as `subGroups.length === 1`. Same logic applies to `renderJewelTypeSubGroups` (filtered jewel sub-groups). Do NOT suppress Level-2 origin headers or Level-1 affix headers — they always carry unique info (icon + origin name, affix count).
    - **General rule for future polish:** any UI label that has zero informational value in its current scope = noise. Auto-suppress it (don't make it a manual flag — derive from data).

28. **Palette consistency — NEVER use raw cold Tailwind colors (iter 63):** The project uses a warm dark-fantasy palette defined in `:root` of `src/index.css` (`#0D0B09` / `#15110E` / `#3A2C22` / `#C89A4A` gold). Tailwind's default `indigo-*`, `gray-600/500`, `blue-500`, `purple-500`, `green-500` are COLD and clash visually with the warm tokens. Always use the semantic palette tokens instead:
    | Forbidden (cold)              | Use (warm palette token)         |
    |------------------------------|----------------------------------|
    | `bg-indigo-600`              | `bg-amber-600` (active primary)  |
    | `bg-gray-600` / `bg-gray-500`| `bg-raised` (warm raised) or `bg-amber-700` (deeper accent) |
    | `hover:bg-gray-600/500`      | `hover:bg-chip-hover` (warm token) |
    | `focus:border-blue-500`      | `focus:border-accent-amber` (brand gold focus ring) |
    | `border-gray-500` (active)   | `border-accent-amber` (brand highlight on selected) |
    | `text-blue-500` (checkbox tick) | `text-accent-amber` (brand)  |
    | `text-purple-500` (corrupted tick) | `text-accent-purple` (palette token) |
    | `text-green-500` (uncorrupted tick) | `text-accent-emerald` (palette token) |
    | `text-amber-500` (threshold tick) | `text-accent-amber` (consistent with round10) |
    - **Why:** the palette is exposed via Tailwind v4 `@theme` — every `--color-*` token creates `bg-*` / `text-*` / `border-*` utilities. Use them. Don't introduce raw Tailwind colors that drift from the brand.
    - **Priority tier color hierarchy (preserved):** "Все" = neutral (`bg-raised`), "S+A" = deeper amber (`bg-amber-700`), "S" = brighter amber (`bg-amber-500`). Wider tier = less saturated; narrower/premium tier = brighter.
    - **Checkbox tick colors carry semantics:** corrupted=purple, uncorrupted=emerald, delirious=blue, round10/threshold/auto-copy=amber (brand). Don't unify them all into amber — the per-checkbox distinction is meaningful.
    - **Label size convention in CategoryControlPanel toolbar:** interactive buttons = `text-[13px]`; inline labels (priority, range, checkbox captions) = `text-[12px]`. Do NOT use `text-[10px]` for toolbar labels — it was an outlier on waystone extra-controls (fixed iter 63).

29. **Atmospheric CSS primitives (iter 65 + iter 71) — four reusable classes in `index.css`.** Three are PURE CSS reinterpretations of PoE2 trade-UI asset pack geometry; the source `.webp` files are visual references, not directly referenced by `background-image` (except `bg.webp` for body, `bg-2x.webp` for `.poe-divider--ornate`, `early-access-banner.webp` for `.poe-divider--banner`). The fourth (`.poe-divider--banner`, iter 71) directly uses its WebP source.
    - **`.poe-panel-header`** — gold filigree rim (top + bottom) via `box-shadow: inset` on a dark warm-tinted bg. Two `::before` / `::after` pseudo-elements add 6px gold dot accents at the left/right edges. Used on `<header className="topnav poe-panel-header">`. The rim is `box-shadow`, NOT `border` — so it doesn't change the element's box-model dimensions. Do NOT switch it to a real `border` (it'll shift the layout by 1px and may break `gap-*` math in flex/grid parents).
    - **`.poe-divider`** — thin 1px fading horizontal line (transparent → gold → transparent). NO vertical margin by default — the parent's `gap-*` provides spacing. If used outside a flex/grid context, add Tailwind `my-3` explicitly. The `<hr>` element is fine semantically; we set `border: 0` and `background: linear-gradient(...)`.
    - **`.poe-divider--ornate`** — thicker 8px variant with `bg-2x.webp` texture masked at both ends. Used between major page sections (CategoryLayout header → grid, HomePage hero → cards grid). The `mask-image` is critical — without it the texture reads as a solid bar across the full width (too heavy).
    - **`.poe-divider--banner`** (iter 71) — 24px variant with `early-access-banner.webp` (1919×177) as a wide horizontal section break. NO `mask-image` (the source WebP already has its own alpha — double-clipping looks harsh). Opacity 0.35. Used on HomePage between the Features `<details>` and the SeoBlock `<details>`. Do NOT use as a generic divider — the banner has its own visual identity (early-access themed) and competes with content if overused.
    - **`.btn-cta` + `.btn-cta-success` + `.btn-cta-error` + `.btn-cta:disabled`** — replaces the old `bg-btn-primary` / `bg-btn-success` / `bg-btn-danger` Tailwind utilities on Copy buttons in `RegexOutput.tsx` (both main copy + `PartCopyButton`). Visual: dark metallic base + gold rim + crimson radial glow on hover (from `early-access-button-underlay.webp` inspiration). Success state = emerald-gold rim + green glow. Error state = red rim. Disabled state = warm-raised bg + dim text + no glow (same visual language as old `bg-raised text-dim cursor-not-allowed`).
    - **Do NOT** apply `.btn-cta` to non-CTA buttons (e.g. clear/expand/toolbar toggles in `CategoryControlPanel`). It's reserved for the primary action of the page (Copy regex). Other interactive buttons should keep using the warm palette tokens (`bg-raised`, `bg-chip-hover`, etc.) per Pitfall 28.
    - **Body background swap (iter 65):** `bg-forest.webp` → `atmosphere/bg.webp` + `linear-gradient(rgba(13,11,9,0.78)→rgba(7,5,3,0.92))` warm dim + `radial-gradient(vignette)` darker corners. `bg-forest.webp` / `bg-forest-mobile.webp` deleted in iter 70 (1+ release cycle since iter 65, no longer referenced).
    - **iter 71 leftover WebP интеграция:** `hero-demon-blue.webp` (SeoBlock, `<details>[open]` triggered, opacity 0.10, lg+ only), `news-bg-center.webp` (HomePage hero `<lg` backdrop, opacity 0.14, `mix-blend-screen`, mirrors lg+ bas-relief), `early-access-banner.webp` (`.poe-divider--banner`).
    - **iter 120/121 hero decorations:** `hero-shaman.webp` (left) + `hero-iva.webp` (right) — full-body portrait side ghosts, anchored to `<main>` viewport edges below TopNav, `h-[80vh] max-h-[720px]`, opacity 0.20, `.hero-side-ghost` / `--right` CSS classes with mask-image fades (bottom 25% + inner edge 25%), xl+ only. iter 120 removed 4 backdrop images from JSX (kept on disk), iter 121 fixed head/legs cropping (side ghosts moved OUT of hero block + OUT of max-w-4xl).
    - **iter 122 SeoBlock atmosphere backdrop:** `seo-atmosphere.webp` (faf.png 1672×941 → WebP q85, 1600×900, 146 KB — dark-fantasy арт: воительница + череп/демоническая структура) — wide landscape backdrop in SeoBlock, `.home-seo-atmosphere` class, opacity 0 → 0.18 on `<details>[open]`, `mix-blend-screen`, `mask-image: linear-gradient(to bottom, #000 60%, transparent 100%)` (fade bottom 40%), lg+ only. DOM order in SeoBlock: atmosphere → demon → content — so the right-edge `hero-demon-blue.webp` accent paints ON TOP of the wide backdrop, both below the SEO text content (z-index: 1).
    - **iter 122 cleanup:** 4 stale webp deleted from disk (`hero-bas-relief`, `hero-horned-warrior`, `hero-monster-red`, `news-bg-center` — all removed from JSX in iter 120, kept on disk until iter 122) + dead `scripts/optimize_hero_images.py` (iter 69 one-off, referenced missing source PNGs and outdated path). `title-bg-4x.webp` and `early-access-button-underlay.webp` are kept on disk as visual reference for the pure-CSS reinterpretations (mentioned in CSS comments only, not actively referenced by `url(...)`).

30. **`?` optional — NOT supported in PoE2 in-game.** `src/core/poe2-regex-matcher.ts` парсит `?` (вне `(?!`) для engine-completeness, но PoE2 regex engine его НЕ поддерживает. Defensive guard: `hasUnsupportedOptional(pattern)` detector + `OracleResult.unsupportedSyntax` + `iterative-optimizer.oracleValidateChange` early reject. **Generator (compiler/factorizer) `?` НЕ производит** — при модификации generator-логики НЕ добавлять `?`-паттерны.

31. **Hardcoded implicit-set family keys в `scripts/etl/normalize.ts`** — 4 waystone + 1 tablet. Ключи должны РАВНЯТЬСЯ `familyKey.ru` сгенерированных токенов (т.е. source-verbatim, включая опечатки poe2db — например `%` без `#` для tablet). **Перед ETL rerun ВСЕГДА проверяй:** `curl -s https://poe2db.tw/ru/Waystones | grep -c "находимых в области"` — если >0, poe2db имеет OLD-формы; если 0, NEW-формы. Соответственно обнови хардкод-ключи перед ETL.

32. **`useCategoryPage` hook architecture** — compose-хук из 3 sub-hooks: `useFilterStore(categoryId)` (Zustand store + URL restore), `useCategoryData(...)` (async data loading), `useRegexBuilder(...)` (AST + optimize + compile). Для pages с extraAstNodes-from-local-state (Waystone/Jewel/Tablet): `const useStore = useFilterStore(categoryId);` → `useState(() => useStore.getState().getExtraState(...))` → `useCategoryPage({ filterStore: useStore, ... })` → write-back `useEffect` без `setState`. URL-sync effect tightly coupled к 13 значениям — не вынести в отдельный хук без потери читаемости.

33. **`charClass` token/AST node имеет явное поле `negated: boolean`** (iter 81). Не использовать sentinel `{from: -1, to: -1}` в `ranges` массиве для negated char class — это удалено. PoE2 regex generator НЕ эмитит `[^...]` паттерны — это defensive parsing только для engine completeness.

34. **L4 architecture для affixes (актуально для OP-1):** 4-уровневая иерархия для ring/belt/amulet/jewel/relic — `Affix (L1) → Origin (L2, через showOriginSubSections=true) → Semantic (L3) → chips (L4)`. Для waystone/tablet — 3 уровня (без L2 origin). Режимы L3: `affix-semantic` (legacy, jewellery/jewel), `affix-functional` (ring/amulet/belt — 24 functional blocks, iter 86-89), `jewel-functional` (jewel — +6 weapon-class sub-blocks, iter 87), `affix-sentiment` (waystone — legacy 3-bin, сохранён для backward compat), `affix-sentiment-subblocks` (waystone — iter 104, 9 sub-blocks: 3 positive + 5 negative + 1 neutral; WaystonePage переключён на этот режим), `tablet-type` (tablet — legacy 6-bin, сохранён для backward compat), `tablet-type-subblocks` (tablet — iter 105, 19 sub-blocks: 3 per type + 4 for generic; TabletPage переключён на этот режим), `relic-semantic` (relic — 7 Sanctum-категорий: honor/sanctum-water/trials/keys/merchant/monsters/curse, iter 98), `affix-only` (legacy flat — superseded by relic-semantic), `jewel-type` (доп. уровень внутри origin для jewel). Сортировка внутри L3-блока (iter 99 + iter 106): по умолчанию `familyKey` (Russian locale, primary) → `priorityTier` (S→A→B→C, tiebreaker) — режим `'alpha'`. iter 106 (P4) добавил пользовательский toggle в `CategoryControlPanel` для переключения на `'tier-first'` режим: `priorityTier` primary → `familyKey` alpha tiebreaker (legacy pre-iter-99 поведение, surfaces S-tier mods first). Реализация: `sortGroupsAlphabetically()` (iter 99) + `sortGroupsByTierFirst()` (iter 106) + `sortGroupsByMode()` dispatch entry point + `withSortedGroups(result, sortMode)` wrapper в `classifyGroups()` (переименована из `withAlphabeticalGroups()` iter 106). `classifyGroups()` имеет опциональный 3-й аргумент `sortMode?: SortMode = 'alpha'` — backward compat со всеми существующими tests/callers. URL-persistent через `extraState.sortMode` (lazy-init в `useCategoryPage` useState + sync в URL-sync useEffect + restore в restoreFilterState). UI-toggle: radio-group «Сортировка: По алфавиту / По приоритету» в `CategoryControlPanel` (после `priorityFilter`), 6 страниц (ring/amulet/belt/jewel/waystone/tablet). `SortMode` type определён в `src/shared/types.ts`. **iter 107 (UX-полировка P4):** `FilterChip` получил опциональный `sortMode?: SortMode` prop. В `'tier-first'` режиме chip-border = distinct tier color (S=amber-soft brightest, A=amber medium, B=amber-dim bronze, C=gray neutral — новый CSS-токен `--bl-amber-dim`), affix color suppressed (info остаётся в column header / origin-section). В `'alpha'` режиме chip-border не изменился (S→amber-soft always-on, A/B/C→affix color). `sortMode` пробрасывается через `ModList`/`VirtualizedModList` → `ModSubGroupSection`/`AffixColumn`/`VirtualRowContent`/`VirtualizedColumn` → `FilterChip` (11+2 call sites). Иерархия цветов зеркалит `priorityFilter` кнопки (Pitfall 28: S=amber-500 brighter, S+A=amber-700 deeper). **iter 101 (CRITICAL): `functionalCategory` теперь реально доходит до runtime** — `GameTokenSchema` в `src/shared/schemas.ts` добавлено `functionalCategory: z.string().optional()` (Known Issue #4 fix). До iter 101 Zod strips → `classifyFunctionalBlock()` падал в `other` fallback → ВСЕ affixes отображались как «Прочее» в production с iter 90. **iter 102: e2e-регрессионные тесты в `tests/integration/runtime-classification.test.ts` закрывают production path** — 4 категории × 4 инварианта + 1 sensitivity-test, доказывающий что guards ловят bug-сценарий iter 90-100. Регрессионные тесты: `tests/etl/etl-schemas.test.ts` → `describe('CategoryDataSchema — functionalCategory preservation')` (field preservation) + `tests/integration/runtime-classification.test.ts` (full pipeline). iter 84-107: P0-фиксы + функциональные блоки + relic-semantic + alphabetical sort + Zod-schema fix + e2e regression tests + waystone sub-blocks + tablet sub-blocks + tier-aware sort toggle + tier-colored left border все реализованы. См. `docs/AFFIXES_GROUPING_ANALYSIS.md` для полного OP-1.

35. **`(A|B|C) after .* bridge` — in-game BROKEN, simulator PASSES (iter 125 fix).** PoE2 in-game regex engine игнорирует содержимое `(A|B|C)`, когда `()` стоит ПОСЛЕ `.*` bridge + literal prefix — движок матчит prefix broadly. Симулятор (`src/core/poe2-regex-matcher.ts`) парсит `(A|B|C)` корректно → юнит-тесты пропускают кейс → баг невидим в CI. **User-reported iter 125 FP:** `"едкость.*\+(2[5-9]|[3-9][0-9]|\d{3,})" "ивность.*\+(2[5-9]|[3-9][0-9]|\d{3,})"` подсвечивал `+15%` / `+11%` in-game (значения < 25). **Fix:** `distributeAlternation()` в `src/core/compiler.ts` конвертирует `prefix(A|B|C)suffix` → `prefixAsuffix|prefixBsuffix|prefixCsuffix` (Path D — top-level `|`, in-game verified up to 9 alts). Применяется в 3 местах `compileInner` для reversed `RANGE` (single-placeholder case). Дополнительно: `src/ui/hooks/category-ast-utils.ts` расширил `anchorEnd` определение для reversed implicits с шаблоном `...##%` (заканчивается на `+##%`) — каждый Path-D альтернатив anchored к `%` (FP-протекция от range notation `(15-25)`). **НЕ фиксировано (KI#9):** MULTI_RANGE slot N>0 (`parts[0].*parts[1].*suffix`) — если parts[N>0] содержит `()`, паттерн остаётся сломанным. На практике MULTI_RANGE tokens используют простые char-class numRegexes, `()` встречается редко. Regression tests: `tests/core/iter125-alt-after-bridge.test.ts` (25 тестов: user scenario + distributeAlternation behavior + edge cases + snapshots).

36. **Ambiguous suffix → multi-implicit FP (iter 126 fix).** ETL auto-computes regex как minimal unique substring (`computeMinimalUniqueSubstring` в `scripts/etl/compute-regex.ts`). Для reversed implicits типа `Редкость предметов: +##%` auto-compute возвращает `'едкость'` (7 chars) — слишком общий, матчит ЛЮБОЙ текст с `едкость` substring. Если на item есть несколько implicits с `едкость` (например, `Редкость предметов` + гипотетическая `Редкость монстров`), регекс `едкость.*\+[2-9][0-9]%` матчит ЛЮБОЙ из них → FP. **User-reported iter 126 FP:** iter 125 fixed regex подсвечивал waystone с `Редкость предметов: +11%` — потому что на waystone есть `Эффективность монстров: +25%` (или другая implicit с `+XX%` ≥20), и `едкость.*\+...` матчит её (если в game есть `Редкость монстров` implicit) или `.*` crosses blocks (KI#11 hypothesis). **Fix (iter 126):** Заменить auto-computed regex на explicit override через `scripts/etl/i18n-overrides.json` — `regex: "едкость предметов"` (12 chars, literal space) для `waystone.implicit.item_rarity` + `waystone-desecrated.implicit.item_rarity`. После фикса: `"едкость предметов.*\+[2-9][0-9]%|едкость предметов.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` (107 chars ≤ 250). **Ограничение фикса:** Если FP вызван cross-block `.*` (KI#11), фикс iter 126 НЕ поможет — `.*` между `предметов` и `+XX%` всё ещё может пересечь blocks. Mitigation plan (KI#11): добавить `literalBridge` поле в AST + compiler использует literal text между suffix и numRegex вместо `.*` (напр., `едкость предметов: \+XX%`). Regression tests: `tests/core/iter126-ki10-rarity-disambiguation.test.ts` (24 теста: compile output + disambiguation + JSON data verification + old vs new regex + KI#11 simulator model). **General lesson:** Для reversed implicits с общим suffix (как `едкость`) — всегда проверять, не matчит ли suffix несколько implicit-типов. Если да — добавить явный override в `i18n-overrides.json` с более specific suffix (включая literal space + следующее слово).

37. **`.*` cross-block hypothesis (KI#11, DISPROVEN iter 127).** Phase 7 in-game verification (см. `docs/IN_GAME_TESTS.md`) установила, что `.*` НЕ пересекает block boundaries в PoE2 in-game regex. Симулятор (`src/core/poe2-regex-matcher.ts`) моделирует это поведение (`getItemSearchBlocks` → each implicit/mod is a separate block, `.*` restricted to single block). **Hypothesis была (iter 126):** Возможно, in-game `.*` ДЕЙСТВИТЕЛЬНО пересекает blocks для items с multiple implicits (waystone scenario). Если hypothesis верна, iter 126 KI#10 fix (`едкость предметов`) НЕ уберёт FP. **iter 127 VERIFICATION:** Пользователь подтвердил, что iter 126 fixed regex `"едкость предметов.*\+[2-9][0-9]%|едкость предметов.*\+\d{3,}%" "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` работает корректно in-game → **hypothesis ОПРОВЕРГНУТА**. `.*` НЕ пересекает lines/blocks. Phase 7 verification остаётся в силе. KI#11 закрыта.

38. **Tier-hardcoded regex для single-# relic tokens (KI#12, iter 127 fix).** ETL auto-compute (`computeMinimalUniqueSubstring` в `scripts/etl/compute-regex.ts`) для tokens с single-`#` template (одна digit, не `##` range) падает через все suffix strategies в `substringSearchFallback`. Причина: template suffix `% урон` (6 chars) после trim `урон` (4 chars) < minLen 5. Substring search находит shortest unique substring — часто включает сам digit (e.g., `на 6%` = 5 chars). Это regex **tier-hardcoded** — матчит ONLY tier 1, FN для tiers 2+. Family-level optimization entries в `scripts/etl/compute-optimizations.ts` line 59-60 берут regex от FIRST (alphabetically) token — если first token tier-hardcoded, вся family страдает FN. **iter 127 audit нашёл 7 relic Sanctum tokens** с этим багом: `sanctummonstersreduceddamage1` (`'на 6%'`), `sanctummonsterspeed1/2` (`'на 4%'`, `'а на 5'`), `sanctumrevealextraroomeachfloor2/large2` (`'ат: 2'`, `'ат: 4'`), `sanctumguardsreduceddamage1` (`'ры наносят уменьшенный на 5'`), `sanctumbossreduceddamage1` (`'сы наносят уменьшенный на 5'`). **Fix (iter 127):** Explicit overrides в `scripts/etl/i18n-overrides.json` для всех 7 tokens — каждый использует tier-agnostic regex от `##` siblings (e.g., `'монстры наносят уменьшенный на '` вместо `'на 6%'`). Patch `public/generated/relic.json` (7 token regexes + 4 family-level opt entries + delete 4 broken cross-family entries). Regression tests: `tests/core/iter127-ki12-tier-hardcoded-regex.test.ts` (19 тестов: per-token regex + family opt entries + compile-time AND-logic + FN regression + KI#11 disprove + audit + i18n-overrides verification). Audit script: `scripts/audit-tier-hardcoded-regex.py` (запускается из Section 6 теста как regression protection — failing если ANY token в generated/*.json имеет KI#12-pattern). **General lesson:** Для single-`#` template tokens (single-value tiers), всегда проверять, что regex НЕ содержит digit value из rawText. Если содержит — добавить explicit override в `i18n-overrides.json` с tier-agnostic regex (matching `##` siblings). **Опциональный future fix:** в `compute-regex-core.ts` добавить check: если token с single-`#` template имеет `##` siblings в same familyKey, то использовать sibling's regex (tier-agnostic) вместо auto-compute. Это prevented бы подобные bugs в future ETL runs.

39. **BTS-статы в waystone-аффиксах + missing implicit `Редкость монстров` (KI#13, iter 128 fix).** В PoE2 waystone-мод (один row в poe2db HTML) имеет несколько `<br>`-сегментов: **первый** — main effect (видим игроку как аффикс), **остальные** — "behind the scenes" (BTS) статы, которые плюсуются за кулисами к имплиситам (`Шанс выпадения`, `Редкость предметов`, `Размер групп`, `Эффективность`, `Редкость монстров`) и отображаются в приплюсованном виде в имплисетах. **Пример:** мод `Монстры получают (26—30)% уменьшение дополнительного урона от критических ударов / На 18% больше волшебных и редких монстров / На 18% больше шанса появления свойств у редких монстров / На 10% больше находимых в области путевых камней` — игрок видит только ПЕРВЫЙ сегмент как аффикс; остальные три плюсуются к имплиситам `Редкость монстров`, `Редкость монстров` (нет, эта — без прямого implicit), `Шанс выпадения` соответственно. **Root cause KI#13 (две части):** (a) `generateWaystoneImplicitTokens()` в `scripts/etl/normalize.ts` не включал implicit `Редкость монстров: +##%` — игроки видят эту строку на путевых камнях, но фильтр не мог её искать. (b) `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` (фильтр BTS-токенов) содержал только 4 ключа, не покрывая 6 других BTS-паттернов: `На #% больше волшебных и редких монстров`, `На #% больше шанса появления свойств у редких монстров`, `На #% больше эффективности монстров` (второе wording для `Эффективность`), `#% увеличение количества редких монстров`, `#% увеличение количества волшебных монстров` (только desecrated), `#% увеличение количества путевых камней, находимых в области` (второе wording для `Шанс выпадения`). **Fix (iter 128):** (1) Добавлен implicit `Редкость монстров: +##%` в `generateWaystoneImplicitTokens()` (id=`{category}.implicit.monster_rarity`, range=[0,999]). (2) `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` расширена с 4 до 10 ключей. (3) Patch `public/generated/waystone.json` (156→110 tokens: -47 BTS, +1 implicit) и `waystone-desecrated.json` (32→28: -5 BTS, +1 implicit) через `scripts/apply-ki13-fix.py` (идемпотентный, с верификацией). (4) Override в `i18n-overrides.json`: regex `'едкость монстров'` (15 chars, literal space) — disambiguate от `'едкость предметов'` (iter 126). (5) Регрессионные тесты в `tests/core/iter128-ki13-monster-rarity.test.ts` (34 теста, 7 секций: JSON existence + BTS removal + KEY list + generateWaystoneImplicitTokens + compile/matcher disambiguation + i18n-overrides + audit). **General lesson:** При работе с waystone/tablet JSON-данными ВСЕГДА различать (1) main effect (первый `<br>`-сегмент, видимый аффикс) и (2) BTS-сегменты (`На #% больше …` / `#% увеличение количества …`) — последние нужно фильтровать через `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` и не включать в searchable-аффиксы. При добавлении нового implicit ВСЕГДА проверять, что его regex (a) уникально идентифицирует текст, (b) не конфликтует с regex других implicits (особенно если они share common substrings — `Редкость предметов` vs `Редкость монстров` обе содержат `Редкость`).


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
| `home.nav_label` | Главная | TopNav tab label for `/` (via `navItems`) |
| `home.title` | Генератор regex для PoE2 | Hero `<h1>` on HomePage |
| `home.subtitle` | Выбирайте аффиксы — получайте готовую строку для вставки в игру | Hero subtitle |
| `home.description_full` | Генератор поисковых строк… | Hero description paragraph |
| `home.features_summary` | Возможности генератора… | `<summary>` of Features `<details>` (iter 62) |
| `home.seo_summary` | Подробнее о регексах PoE2… | `<summary>` of SeoBlock `<details>` |
| `nav.feedback` | Баги и идеи → Discord: woonderdad | TopNav right-side hint (lg+). Renamed from `sidebar.feedback` iter 64. |
| `nav.categories` | Категории | TopNav `<nav>` `aria-label`. |

**Design principle:** Each UI zone has its own i18n key — no text duplication across zones. (iter 66: unused `home.header_title` and `app.title` keys removed — neither was consumed by any component.)

## 13. Documentation Map

| File | When to Update |
|------|----------------|
| `AGENT_NAVIGATION.md` | Every iteration (this file) |
| `STATUS.md` | On status changes (current iter + Known Issues + Open Proposals) |
| `docs/ARCHITECTURE.md` | On structural changes |
| `docs/ETL_GUIDE.md` | On ETL pipeline changes |
| `docs/DATA_CONTRACTS.md` | On type changes |
| `docs/IN_GAME_TESTS.md` | On new in-game test results |
| `docs/SEO_PLAN.md` | On SEO workflow changes |
| `docs/AFFIXES_GROUPING_ANALYSIS.md` | iter 82-84 — анализ группировки аффиксов (OP-1) + P0-фиксы. Update только если анализ пересматривается или новая итерация реализации. |
| `worklog.md` | Every iteration — append new Task ID section |

---

## 14. Open Proposals

### OP-1 (iter 82-84) — Перегруппировка аффиксов

Полный анализ: `docs/AFFIXES_GROUPING_ANALYSIS.md`.

**Суть проблемы:** 3-корзинная схема (`offensive/defensive/attribute/neutral` для jewellery/jewel, `positive/negative/neutral` для waystone) отправляла 14-39% модов в «Прочие»/«Нейтральные».

**iter 84 — что уже сделано (3 P0-фикса):**
- **Bug #7 ✅**: Breach Lord-теги (`kurgal_mod`/`amanamu_mod`/`ulaman_mod`) теперь пропускаются в `classifyByTags` + text-fallback для members с только Breach Lord тегами. `DEFENSIVE_KEYWORDS` += `флакон`.
- **Bug #2 ✅**: Waystone 7 mis-классификаций (не 4, как думал iter 83 — все 7 neutral были mis) исправлены расширением POSITIVE/NEGATIVE_KEYWORDS. Waystone neutral: 7 → 0.
- **Bug #4-5 ✅**: `aura` (2 jewel-токена) и `gem` (17 токенов) добавлены в `OFFENSIVE_TAGS`.

**Симуляция:** neutral-корзина 117/560 → 99/560 (-18 групп, -15%).

**iter 84 — что осталось (P0):**
- Внедрить 24 функциональных блока для jewellery (вместо 4 корзин).
- Weapon sub-blocks для jewel (6 подблоков для 24 family-key).

**Архитектурное предложение:** 24 функциональных блока (Дух / Уровень умений / Атрибуты / Здоровье-Мана-ES / Рунический барьер / Сопротивления / Защита / Скорость / Крит / Урон / Пробитие / Состояния / Область-Длительность / Сгустки-Wisps / Ауры-Вестники-Метки-Знаки-Кличи-Знамёна-Обереги / Приспешники-Компаньоны-Подношения / Архонт-Запечатанные-Мета / Оружие-специфичные / Фласки / MF / Конверсия / Свирепость-Заряды / Бездна-Разлом / Прочее) + 6 weapon sub-blocks для jewel + sub-blocks внутри waystone sentiment и tablet type. См. полный анализ в `docs/AFFIXES_GROUPING_ANALYSIS.md`.

**Реализация:** iter 84 — 3 P0-фикса выполнены. Остальные P0-P3 ждут следующей итерации (см. §5 в `docs/AFFIXES_GROUPING_ANALYSIS.md`).

**Ключевые файлы, затронутые в iter 84:**
- `src/shared/mod-classifier.ts` — 3 P0-фикса (BREACH_LORD_TAGS, classifyByTags update, OFFENSIVE_TAGS += aura/gem, DEFENSIVE_KEYWORDS += флакон, POSITIVE/NEGATIVE_KEYWORDS += 4 waystone паттерна).
- `tests/shared/mod-classifier.test.ts` — +14 новых тестов.

**Ключевые файлы для будущих итераций (P4 закрыт в iter 106; UX-полировка P4 закрыта в iter 107; опциональные расширения; iter 112: sortKey infrastructure):**
- `src/shared/mod-classifier.ts` (~2330 строк) — iter 104 закрыл waystone sub-blocks, iter 105 закрыл tablet sub-blocks, iter 106 закрыл P4 (tier-aware sort toggle), iter 107 не трогал (только UI). **iter 112: `sortGroupsAlphabetically()` использует `FamilyGroup.sortKey` как PRIMARY sort.** Остаются low-priority waystone neutral-generic / tablet Разломы-keyword расширения.
- `src/shared/family-grouper.ts` (326 строк) — `groupTokensByFamily` (существующий sort affix → tier → alpha). **iter 112: `buildFamilyGroup()` вычисляет `sortKey` через `computeSortKey()`.**
- `src/shared/block-sort-rules.ts` (~1140 строк, **iter 112 NEW**) — `BLOCK_SORT_RULES: Partial<Record<FunctionalBlock, SortRule[]>>` + `computeSortKey(block, familyKey)`. 18 блоков с правилами (resistances/attributes/minions/ailments/damage-type/defence-stats/resources/weapon-specific/flasks/offence-speed/crit/buff-skills/skill-levels/area-duration/meta-skills/rage-charges/runes-barrier/penetration — 312 family-keys, 100% coverage). **Все priority-блоки закрыты в iter 119.** 6 блоков без правил → fallback к alphabetical (как pre-iter-112) — все low-priority/empty.
- `src/shared/types.ts` — `FamilyGroup.sortKey?: string` (**iter 112 NEW**), `ModGroupMode`, `SortMode` (iter 106: `'alpha' | 'tier-first'`).
- `src/ui/components/FilterChip.tsx` (~475 строк) — iter 107: опциональный `sortMode?: SortMode` prop; `effectiveBorderClass` 2-branch conditional (alpha mode = pre-iter-107 behaviour; tier-first mode = 4-way tier color dispatch suppressing affix color).
- `src/ui/components/ModList.tsx` (~685 строк) — iter 107: `sortMode` prop пробрасывается в `ModSubGroupSection` + `AffixColumn` + 11 inline call sites.
- `src/ui/components/VirtualizedModList.tsx` (~845 строк) — iter 107: `sortMode` prop пробрасывается в `VirtualRowContent` + `VirtualizedColumnProps` + `columnProps` auto-threading + 2 `VirtualRowContent` call sites.
- `src/ui/components/CategoryControlPanel.tsx` — iter 106: тумблер «режим сортировки» (alpha vs tier-first) добавлен как radio-group после `priorityFilter`.
- `src/store/url-sync.ts` — URL-персистентность через `extraState` (iter 106: `sortMode` сериализуется автоматически через существующий `serialize()`/`deserialize()` в `filter-store.ts`).
- `src/ui/hooks/useCategoryPage.ts` — iter 106: `sortMode` + `setSortMode` добавлены в return type, `useState` lazy-init из extraState, URL-sync effect обновлён, `restoreFilterState` восстанавливает sortMode.
- `src/shared/i18n.ts` — iter 106: добавлены `sort.label`, `sort.alpha`, `sort.tier_first`.
- `src/index.css` — iter 107: добавлен `--bl-amber-dim: #b45309` (amber-700, bronze) + `--color-bl-amber-dim` mapping в `@theme` блоке для B-tier border.

**Roadmap:**
- **iter 99 done:** alphabetical within-block sort во всех 9 режимах `classifyGroups()` через `sortGroupsAlphabetically()` + `withAlphabeticalGroups()` wrapper. Tier — визуальный бейдж.
- **iter 100 done:** cleanup 17 устаревших iter*-скриптов. ESLint 0 errors.
- **iter 101 done:** P0-фикс Critical Bug — `GameTokenSchema` добавлено `functionalCategory: z.string().optional()`. Zod больше не strips это поле → runtime classifier работает корректно. +3 регрессионных теста.
- **iter 102 done:** e2e-регрессионные тесты для runtime-classification pipeline — `tests/integration/runtime-classification.test.ts` (17 тестов, ~190 строк). 1431/1431 tests.
- **iter 103 done:** подавление 2 TanStack library-level ESLint warnings — Known Issue #3 закрыт. ESLint 0+0. 1431/1431 tests.
- **iter 104 done:** P2 first half — waystone sub-blocks. Новый режим `affix-sentiment-subblocks` в `ModGroupMode` + `classifyWaystoneSubBlock()` function + 9 sub-blocks (3 positive + 5 negative + 1 neutral). WaystonePage переключён на новый режим (старый `affix-sentiment` сохранён как legacy). Known Issue #5 закрыт: `приспешник.*урон` false-positive в `POSITIVE_KEYWORDS` (ловил negative «Игроки и их приспешники не наносят урона...» как positive) — removed + added `Игроки.*не наносят урон` в `NEGATIVE_KEYWORDS`. +41 новых тестов (2 regression + 28 sub-block unit + 5 mode + 6 прочих). 1472/1472 tests.
- **iter 105 done:** P2 second half — tablet sub-blocks. Новый режим `tablet-type-subblocks` в `ModGroupMode` + `classifyTabletSubBlock()` function + 19 sub-blocks (3 per type + 4 for generic: ritual-rewards/monsters/content, breach-monsters/rewards/content, delirium-mist/rewards/monsters, vaal-monsters/rewards/content, expedition-rewards/explosives/monsters, generic-loot/monsters/encounters/player). TabletPage переключён на новый режим (старый `tablet-type` сохранён как legacy). Two-phase architecture: `classifyTabletType()` → sub-block patterns within type, each type has fallback sub-block. Pattern priority regression tests: ritual-monsters BEFORE ritual-rewards (жертвенные монстры), delirium-rewards BEFORE delirium-mist (Туман+осколки), generic-encounters BEFORE generic-monsters (Нестабильные Разломы). +28 новых тестов (23 sub-block unit + 5 mode). 1500/1500 tests.
- **iter 106 done:** P4 — tier-aware sort toggle. Новый `SortMode = 'alpha' | 'tier-first'` type в `types.ts`, `sortGroupsByTierFirst()` + `sortGroupsByMode()` функции в `mod-classifier.ts`, `withAlphabeticalGroups()` переименована в `withSortedGroups(result, sortMode)` (default `'alpha'` — backward compat со всеми существующими tests). `classifyGroups()` получила опциональный 3-й аргумент `sortMode?: SortMode = 'alpha'`, пробрасывается во все 11 веток режимов. UI-toggle в `CategoryControlPanel` на 6 страницах с priority classification (ring/amulet/belt/jewel/waystone/tablet): radio-group «Сортировка: По алфавиту / По приоритету» после `priorityFilter`. URL-persistent через `extraState.sortMode` (shareable links + profile restore). +22 новых теста в 3 новых describe блоках (`sortGroupsByTierFirst`, `sortGroupsByMode`, `classifyGroups respects sortMode argument`). 1522/1522 tests.
- **iter 107 done:** UX-полировка P4 — tier-colored left border для всех 4 tier'ов в tier-first режиме. Новый опциональный prop `sortMode?: SortMode` в `FilterChip` (default `'alpha'` — backward compat). В `'tier-first'` режиме FilterChip показывает distinct colored border для каждого tier: S=amber-soft (brightest), A=amber, B=amber-dim (bronze — новый CSS-токен `--bl-amber-dim: #b45309`), C=gray. В `'alpha'` режиме поведение не изменилось (S→amber-soft always-on, A/B/C→affix color). `sortMode` пробрасывается через `ModList`/`VirtualizedModList` → `ModSubGroupSection`/`AffixColumn`/`VirtualRowContent`/`VirtualizedColumn` → `FilterChip` (11 call sites в ModList + 2 в VirtualizedModList). +11 новых тестов в `tests/ui/FilterChip.test.tsx` (alpha 4 + backward compat 1 + tier-first 4 + visual hierarchy regression 2). 1533/1533 tests.
- **Опционально (next):** `sortKey?: number` в `FamilyGroup` + ETL заполнение для «по популярности внутри категории» — third sort mode (alpha / tier-first / popularity). Требует ETL-расширения. **Опционально:** waystone neutral-generic (6 groups) — расширить POSITIVE_KEYWORDS для 5 desecrated Breach-adjacent mods. **Опционально:** tablet Разломы vs Бездна — расширить BREACH_KEYWORDS для 2 mods использующих «Разлом» (low-priority, текущая sub-block classification корректна).
- `scripts/etl/classify-functional-category.ts` — ETL-tagged functionalCategory (iter 90). `buildFunctionalCategoryMap()` + `classifyModFunctionalBlock()`.
- `scripts/etl/normalize.ts` + `generate-dictionary.ts` + `fetch-poe2db.ts` — ETL pipeline (functionalCategory patching через generate-dictionary).
