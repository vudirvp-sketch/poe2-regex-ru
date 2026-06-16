# PoE2 Regex RU — Agent Navigation

> **Entry document.** Read this first. Current state: iter 59 (UI Фаза 7 — `MobileRegexBar.tsx` mobile sticky bottom-bar).

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
| `src/ui/layout/CategoryLayout.tsx` | 2-col desktop / 1-col mobile shell for category pages (iter 52-53, updated iter 59). Slots: `header`, `controls`, `regexOutput`, `status?`, `sidebar?`, `mobileBar?`, `children`. When `mobileBar` is provided, aside is `hidden lg:flex` and `status`+`sidebar` render in a separate mobile-only section above the sticky bar. | Adopted by ALL 8 category pages. `status` slot uses `<StatusPanel>`. |
| `src/ui/components/StatusPanel.tsx` | Unified status panel for all category pages (iter 58, Phase 6). Props: `wantTokens`, `excludeTokens`, `allActiveTokens` + optional `badges` (ReactNode[]) + `alerts` (ReactNode[]). | Replaces ~15-20 lines of duplicated inline JSX per page. |
| `src/ui/components/MobileRegexBar.tsx` | Mobile-only sticky bottom bar (iter 59, Phase 7). Props: `regexOutput` (ReactNode), `alerts` (ReactNode[]). `lg:hidden`. Wraps RegexOutput + alerts in `position: sticky; bottom: 0` container. | Used by all 8 category pages. Desktop unaffected — RegexOutput stays in right-column aside. |
| `src/ui/layout/nav-items.ts` | Shared `navItems` array (9 entries: home + 8 categories). Source of truth for both Sidebar (desktop) and MobileNavTabs (mobile). iter 56. | Single source — do not duplicate nav list in either component. |
| `src/ui/layout/Sidebar.tsx` | Desktop-only vertical nav (`hidden md:flex`). iter 56: mobile drawer removed. | Mobile nav lives in `MobileNavTabs.tsx`. |
| `src/ui/layout/MobileNavTabs.tsx` | Mobile-only horizontal scrollable chip tabs (`md:hidden`). Sticky below Header. iter 56. | Replaces previous hamburger drawer. |
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
    - **iter 54 cleanup removed:** legacy branch (sticky wrapper + embedded `<RegexOutput>`), `hideRegexOutput` prop, `regex`/`isOverflow`/`regexParts`/`filterStore` props (all unused in split mode). Dead CSS: `.control-panel-sticky`, `.sticky.top-0` mobile rules.
    - **Kept:** `activeTokenCount` (used for active-tokens counter in controls row), `extraControls` slot (waystone corrupted/delirious, jewel type filter, tablet type/rarity/uses), `clearButton` slot (Vendor).
    - Page-specific notes: VendorPage has NO `<PageStateWrapper>` (sync data) and NO `<ProfilePanel>` (sidebar slot empty). All 8 pages use `<StatusPanel>` in `status` slot (iter 58). WaystonePage/TabletPage use `badges` prop; JewelPage/VendorPage use `alerts` prop.

21. **Level 1 visual frames (iter 55):** Two families of Level 1 decorative frames exist in `index.css` — both use the same pattern (gradient bg + 1px subtle border + 3px colored border-left + corner accents via `::before`/`::after`):
    - **Affix headers** (`.affix-header-prefix` / `-suffix` / `-implicit`): blue / orange / amber colors. Used by `ModList` to label affix groups.
    - **`RegexOutput`** (`.regex-output`): **gold** (`--poe-gold` = `#C89A4A`, brand accent) + glow `box-shadow`. Marks the primary output element. Padding `12px` desktop, `10px` mobile.
    - **Do NOT** re-add inline `style={{ background: ... }}` on `RegexOutput` root div — `.regex-output` CSS owns the background now (inline style was removed iter 55).

22. **Navigation as "modes" (iter 56):** Sidebar is desktop-only (`hidden md:flex`); mobile nav is `<MobileNavTabs>` (horizontal scrollable chip tabs, `md:hidden`, sticky below Header). Both share `navItems` from `src/ui/layout/nav-items.ts` — single source of truth.
    - **Active state** uses `.nav-mode-active` CSS class (gold border-l 3px + box-shadow glow + gold-tinted gradient bg + font-weight 600). Pattern echoes Level-1 frames but is a nav-specific class — do NOT reuse `.regex-output` or `.affix-header-*` for nav.
    - **Padding compensation:** `.nav-mode-link.nav-mode-active` and `.mobile-nav-tab.nav-mode-active` set `padding-left: calc(<tailwind-padding> - 3px)` to keep icons aligned with inactive items (which have no border-l). If you change the Tailwind `px-*` on the NavLink, update the calc in `index.css` too.
    - **No hamburger, no drawer, no focus trap** in `Sidebar.tsx` — all removed iter 56. Do NOT re-add them.

23. **HomePage compaction + SeoBlock in `<details>` (iter 57, UI Phase 5):** The home page was tightened — vertical spacing reduced across all sections (mb-10→mb-6, mt-10→mt-6, mt-12→mt-6, mt-8→mt-6) and the long-form SEO/FAQ text is now wrapped in a native `<details>` element, closed by default. The category hub (8 cards in 2/3/4-col grid) stays as the central element.
    - **SeoBlock structure:** `<details className="home-seo-details">` → `<summary className="home-seo-summary">` (gold text + custom `▸` marker that rotates 90° on open) → `<section className="home-seo-content">` with the 4 original SEO sections. CSS lives in `index.css` under the "Home SEO `<details>`" block.
    - **SEO preservation:** `<details>` content stays in the DOM (Google indexes it even when closed). Do NOT add `hidden` or conditional rendering — that would strip SEO content. The `<details>` element is natively keyboard-accessible (Enter/Space toggles, no JS needed).
    - **Compaction philosophy:** Tighten spacing, NOT content. No text was removed from HomePage — only margins, paddings, font sizes (e.g. stat badges `text-[13px]→[12px]`, Features title `text-xl→text-base`) and icon sizes (category cards `44→40px`) were reduced. If you need to add more sections, follow the same density tokens (`p-3`, `gap-3`, `text-[12-13px]`).
    - **Do NOT** re-add the default `<summary>` triangle — `list-style: none` + `::-webkit-details-marker { display: none }` suppress it; the custom `▸` marker is in `::before`.

24. **StatusPanel — unified status component (iter 58, UI Phase 6):** All 8 category pages now use `<StatusPanel>` for the right-column `status` slot instead of inline JSX. The component accepts `wantTokens`, `excludeTokens`, `allActiveTokens` (mandatory) plus optional `badges` (ReactNode[]) and `alerts` (ReactNode[]).
    - **Standard pages** (Belt, Amulet, Ring, Relic): just `<StatusPanel wantTokens={...} excludeTokens={...} allActiveTokens={...} />`.
    - **Extended pages** pass category-specific data via `badges`: Waystone (corrupted/uncorrupted/delirious strings), Tablet (type/rarity/uses strings).
    - **Alert pages** pass warning blocks via `alerts`: Jewel (amber hidden-mods alert with "Deselect" button), Vendor (yellow verification note).
    - **VendorPage** now has a `status` slot (previously had none — verification note was in left column children).
    - **JewelPage** hidden-mods alert moved from left column `children` to `status` slot `alerts` — renders in right column alongside the summary panel.
    - **Do NOT** re-add inline status JSX to any page — always extend StatusPanel via `badges`/`alerts` props. If a new page needs a status variant, add a new prop to StatusPanel rather than duplicating JSX.

25. **MobileRegexBar — mobile sticky bottom bar (iter 59, UI Phase 7):** On mobile (< lg), `RegexOutput` moves from the right-column aside into a sticky-bottom bar (`MobileRegexBar.tsx`). StatusPanel `alerts` (Jewel hidden-mods warning, Vendor verification note) follow it into the same bar. Desktop (lg+) is unchanged.
    - **CategoryLayout `mobileBar` slot:** When a page passes `mobileBar={<MobileRegexBar .../>}`, the layout (a) hides the right-column aside on mobile via `hidden lg:flex`, (b) renders `status` + `sidebar` in a separate `lg:hidden` section above the bar so they stay accessible, (c) renders the `mobileBar` as the last child in a sticky-bottom container.
    - **Double-render tradeoff:** `RegexOutput` is mounted in BOTH the desktop aside AND the mobile bar. Each instance has its own transient React state (`copied`, `shareCopied`), but `autoCopy` is persisted to localStorage so both stay in sync. The auto-copy effect fires twice on regex change — clipboard write is idempotent so this is harmless. The keyboard shortcut handler (Ctrl+Shift+X) is attached by both instances — both fire on the same keystroke, both write the same content. Acceptable cost to avoid CSS hacks for single-DOM-node teleportation.
    - **Alerts duplication:** For Jewel/Vendor pages, `alerts` array is passed to BOTH `<StatusPanel alerts={...}>` (desktop aside) AND `<MobileRegexBar alerts={...}>` (mobile bar). Only one is visible at a time per viewport.
    - **CSS:** `.mobile-regex-bar` class in `index.css` — `position: sticky; bottom: 0; z-index: 15; backdrop-filter: blur(6px); max-height: 60vh; overflow-y: auto`. Sticks to viewport bottom while scrolling, sits at natural position (end of page) when scrolled to bottom.
    - **Vendor price-filter (iter 59):** VendorPage passes `hasRangedTokens={false}` to `<CategoryControlPanel>` — the global min/max inputs were no-ops (setMinValue/setMaxValue were empty functions). Per-chip range inputs in `<FilterChip>` are the primary UX for vendor ("Ур. предмета ≥N" / "Треб. уровень ≥N" each have their own min input).
    - **HomePage category cards (iter 59):** Verbose descriptions ("Полное покрытие префиксов и суффиксов" etc.) removed from category cards. Cards now show only icon + name + affix count. 8 unused `home.*_desc` i18n keys deleted.
    - **Pre-existing bug closed (iter 59):** `tsc -b` was failing — 4 standard pages (Belt/Amulet/Ring/Relic) were missing `import { t } from '@shared/i18n'` (regression from iter 58 — import was removed as "unused" but `t()` is called in `header`), and JewelPage was missing `import { groupTokensByFamily }`. `tsc --noEmit` was silent but `tsc -b` (build mode with project references) caught it. All imports restored.

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
