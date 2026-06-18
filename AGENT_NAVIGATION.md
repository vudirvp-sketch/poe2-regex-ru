# PoE2 Regex RU — Agent Navigation

> **Entry document.** Read this first. Current state: **iter 82 (analysis-only)**. **Open Proposal OP-1** (iter 82): перегруппировка аффиксов — анализ в `docs/AFFIXES_GROUPING_ANALYSIS.md`, реализация не начата. Все старые Known Issues закрыты (KI-1, KI-2, KI-3) и все старые долги закрыты. Regex-движок: чистый TS, 0 npm-зависимостей. 1158/1158 тестов зелёные. ETL: 1697 токенов, FN=0, FP=9463. Pitfall 22 + 28 + 29 актуальны.

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
| `public/atmosphere/` | PoE2-themed texture + hero decoration assets. **iter 65**: `bg.webp` (body bg texture), `bg-2x.webp` (`.poe-divider--ornate` border texture), `title-bg-4x.webp` + `early-access-button-underlay.webp` (visual reference only — `.poe-panel-header` / `.btn-cta` are pure CSS reinterpretations). **iter 67**: added `early-access-banner.webp` + `news-bg-center.webp`. **iter 69**: 4 hero decoration WebPs (PNG → WebP q85 via `scripts/optimize_hero_images.py`): `hero-bas-relief.webp` (backdrop, lg+, `mix-blend-screen` opacity 0.18), `hero-horned-warrior.webp` (L side ghost, xl+, opacity 0.28), `hero-monster-red.webp` (R side ghost, xl+, opacity 0.28), `hero-demon-blue.webp` (deferred → integrated iter 71). **iter 70**: `bg-forest.webp` + `bg-forest-mobile.webp` deleted (no longer referenced). **iter 71**: 3 leftover WebP интегрированы — `hero-demon-blue.webp` (SeoBlock right-edge decoration, visible only when `<details>` open, opacity 0.10, lg+ only), `early-access-banner.webp` (new `.poe-divider--banner` class on HomePage between Features and SeoBlock), `news-bg-center.webp` (mobile-only `<lg` hero backdrop via `<img>`, opacity 0.14, `mix-blend-screen`, mirrors lg+ bas-relief). All atmosphere assets now referenced from JSX or CSS. |
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
pnpm install              # Install dependencies (or: npm install)
pnpm dev                  # Vite dev server
pnpm build                # tsc -b + vite build + shell prerender (no Playwright)
pnpm build:full           # tsc -b + vite build + shell prerender + Playwright prerender
pnpm prerender:full       # Run Playwright prerender only (needs dist/)
pnpm test                 # Vitest (all tests) — current: 1144 passing
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
    - **iter 71 leftover WebP интеграция:** `hero-demon-blue.webp` (SeoBlock, `<details>[open]` triggered, opacity 0.10, lg+ only), `news-bg-center.webp` (HomePage hero `<lg` backdrop, opacity 0.14, `mix-blend-screen`, mirrors lg+ bas-relief), `early-access-banner.webp` (`.poe-divider--banner`). Все atmosphere assets теперь подключены — «чистых» кандидатов на интеграцию больше нет.

30. **`?` optional — NOT supported in PoE2 in-game.** `src/core/poe2-regex-matcher.ts` парсит `?` (вне `(?!`) для engine-completeness, но PoE2 regex engine его НЕ поддерживает. Defensive guard: `hasUnsupportedOptional(pattern)` detector + `OracleResult.unsupportedSyntax` + `iterative-optimizer.oracleValidateChange` early reject. **Generator (compiler/factorizer) `?` НЕ производит** — при модификации generator-логики НЕ добавлять `?`-паттерны.

31. **Hardcoded implicit-set family keys в `scripts/etl/normalize.ts`** — 4 waystone + 1 tablet. Ключи должны РАВНЯТЬСЯ `familyKey.ru` сгенерированных токенов (т.е. source-verbatim, включая опечатки poe2db — например `%` без `#` для tablet). **Перед ETL rerun ВСЕГДА проверяй:** `curl -s https://poe2db.tw/ru/Waystones | grep -c "находимых в области"` — если >0, poe2db имеет OLD-формы; если 0, NEW-формы. Соответственно обнови хардкод-ключи перед ETL.

32. **`useCategoryPage` hook architecture** — compose-хук из 3 sub-hooks: `useFilterStore(categoryId)` (Zustand store + URL restore), `useCategoryData(...)` (async data loading), `useRegexBuilder(...)` (AST + optimize + compile). Для pages с extraAstNodes-from-local-state (Waystone/Jewel/Tablet): `const useStore = useFilterStore(categoryId);` → `useState(() => useStore.getState().getExtraState(...))` → `useCategoryPage({ filterStore: useStore, ... })` → write-back `useEffect` без `setState`. URL-sync effect tightly coupled к 13 значениям — не вынести в отдельный хук без потери читаемости.

33. **`charClass` token/AST node имеет явное поле `negated: boolean`** (iter 81). Не использовать sentinel `{from: -1, to: -1}` в `ranges` массиве для negated char class — это удалено. PoE2 regex generator НЕ эмитит `[^...]` паттерны — это defensive parsing только для engine completeness.

34. **L4 architecture для affixes (актуально для OP-1):** 4-уровневая иерархия для ring/belt/amulet/jewel/relic — `Affix (L1) → Origin (L2, через showOriginSubSections=true) → Semantic (L3) → chips (L4)`. Для waystone/tablet — 3 уровня (без L2 origin). Режимы L3: `affix-semantic` (jewellery/jewel), `affix-sentiment` (waystone), `tablet-type` (tablet), `affix-only` (relic), `jewel-type` (доп. уровень внутри origin для jewel). Сортировка внутри L3-блока: `affix type → priority tier → alpha`. См. `docs/AFFIXES_GROUPING_ANALYSIS.md` для полного описания проблем и предложений OP-1.

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
| `docs/AFFIXES_GROUPING_ANALYSIS.md` | iter 82 — анализ группировки аффиксов (OP-1). Update только если анализ пересматривается. |
| `worklog.md` | Every iteration — append new Task ID section |

---

## 14. Open Proposals

### OP-1 (iter 82) — Перегруппировка аффиксов

Полный анализ: `docs/AFFIXES_GROUPING_ANALYSIS.md`.

**Суть проблемы:** текущая 3-корзинная схема классификации (`offensive/defensive/attribute/neutral` для jewellery/jewel, `positive/negative/neutral` для waystone, `ritual/breach/delirium/vaal/expedition/generic` для tablet) отправляет **15-38% всех модов** в «Прочие»/«Общие» — включая S-tier моды (Spirit, +skill levels, MF).

**Найденные баги классификации (6):**

1. **S-tier моды в neutral**: `+# к духу`, `+#% к уровню всех камней умений`, `#% повышение редкости найденных предметов`, `+#% к качеству всех умений` — без тегов → neutral, несмотря на S/A/B tier.
2. **Waystone mis-классификации (4 из 7 neutral)**: `+#% к бонусу критического урона монстров` (→ negative), `На #% больше волшебных и редких монстров` (→ positive), `На #% больше шанса появления свойств у редких монстров` (→ negative), `На #% больше эффективности монстров` (→ negative).
3. **Tablet «generic» = 38%** всех модов, включая S-tier (кол-во/редкость/опыт/доп. сущности/изгнанники).
4. **Тег `aura` не входит ни в одну категорию** → 2 токена jewel (сила умений аур) → neutral.
5. **Тег `gem` не используется** → 17 токенов (1 ring + 14 amulet + 2 belt) → neutral.
6. **Breach-themed `Знак повелителя Бездны`** (essence-origin, ring) — без тегов → neutral.

**Архитектурное предложение:** заменить 3-корзинную схему на 22 функциональных блока для jewellery (Дух / Уровень умений / Атрибуты / Здоровье-Мана-ES / Сопротивления / Защита / Скорость / Крит / Урон / Пробитие / Состояния / Область-Длительность / Ауры-Вестники-Метки / Приспешники / Оружие-специфичные / Фласки / MF / Конверсия / Свирепость-Заряды / Бездна / Мета / Прочее) + 6 weapon sub-blocks для jewel + sub-blocks внутри waystone sentiment и tablet type.

**Реализация:** не начата. Ждёт решения по приоритетам (см. P0-P3 в `docs/AFFIXES_GROUPING_ANALYSIS.md` §5).

**Ключевые файлы, которые будут затронуты при реализации:**
- `src/shared/mod-classifier.ts` (1095 строк) — классификаторы.
- `src/shared/family-grouper.ts` (316 строк) — `groupTokensByFamily` + `sortKey`.
- `src/shared/types.ts` — `FamilyGroup` (добавить `sortKey`), `ModGroupMode` (новые режимы).
- `src/ui/components/ModList.tsx` (662 строки) — рендер sub-blocks.
- `src/ui/components/CategoryControlPanel.tsx` — тумблер «режим группировки».
- `src/store/url-sync.ts` — URL-персистентность для `groupingMode`.
- `src/shared/i18n.ts` — новые метки блоков.
- `scripts/etl/normalize.ts` + `generate-dictionary.ts` + `fetch-poe2db.ts` — для ETL-tagged `functionalCategory` (P1).
