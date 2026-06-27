# PoE2 Regex RU — Agent Navigation

> **Entry document.** Read this first. Current state: **iter 143 (user feedback received — готовимся к iter 144 реализации)** — UI Refactor все 7 фаз DONE (iter 132-137) + iter 138 `--strong` + iter 139 KI#16-20 (FIXED+VERIFIED iter 140) + iter 140 KI#21-25 (FIXED) + iter 141 KI#26-29 (FIXED, pending browser verification) + KI#30/31 monitoring + iter 142 documentation cleanup + design proposals + iter 143 status check + user feedback round. **Активные Known Issues (5 KI готовы к iter 144):** KI#23 (scroll jitter — variant b approved), KI#30 (cross-tab favorites persistence — variant a approved с realtime sync «если стабильно»), KI#31 (favorites как quick-select — NEW variant d approved, scroll-to-mod отвергнут), KI#32 (NEW — cascade expand одинаковых sub-групп, blocking UX, fix первым), KI#33 (NEW — VendorPage favorites gap, после KI#31). **iter 144 priorities:** (1) KI#32 cascade fix (~30-50 строк); (2) KI#30 per-category localStorage + realtime sync (~40 строк); (3) KI#31 variant d quick-select panel с диапазонами (~150-200 строк NEW component); (4) KI#33 VendorPage favorites (~40-50 строк); (5) KI#23 scroll jitter variant b (~20 строк). **Базовые проверки:** vitest 2190/2190, tsc 0, eslint 0. Актуальный статус — в `STATUS.md`, история — в `worklog.md`, полный план UI-рефакторинга — в `docs/UI_REFACTOR_PLAN.md`, design proposals + user answers — в `docs/ITER142_PROPOSALS.md` (§0 answers + §8 KI#32 + §9 KI#33), эталон визуализации — в `docs/UI_VISUALIZATION_AUDIT.md`, полный план сортировки — в `docs/AFFIX_ORDERING_PLAN.md`, полный UI-аудит — в `docs/UI_AUDIT.md` (§10 TopNav dropdowns SUPERSEDED — visualization keeps flat nav).

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
| `src/ui/components/StatusPanel.tsx` | Badges + alerts panel for category pages (iter 140 KI#22 rewrite). Props: `badges` (ReactNode[]) + `alerts` (ReactNode[]) — main summary panel REMOVED (was redundant with SelectedBasket). Backward compat: `wantTokens`/`excludeTokens`/`allActiveTokens` props still in interface but ignored (destructured as `_wantTokens` etc). | Renders null when no badges AND no alerts. Used by 8 category pages. |
| `src/ui/components/FavoritesIndicator.tsx` | **iter 140 (KI#24) NEW**. Compact `★ N` badge for category page headers. Returns `null` when `pinnedIds` is empty. Restores favorites visibility without restoring noisy chip list (which was removed in iter 139 KI#20). Used by 7 category pages. | `role="status"` + `aria-label` with count. ★ glyph aria-hidden. |
| `src/ui/layout/nav-items.ts` | Shared `navItems` array (9 entries: home + 8 categories). Single source of truth — consumed by `TopNav.tsx`. | Single source — do not duplicate the nav list anywhere else. |
| `src/ui/layout/CategoryLayout.tsx` | 2-col desktop / 1-col mobile shell for category pages. Slots: `header`, `controls`, `regexOutput`, `status?`, `sidebar?`, `mobileBar?`, `children`. When `mobileBar` is provided, aside is `hidden lg:flex` and `status`+`sidebar` render in a separate mobile-only section above the sticky bar. | Adopted by ALL 8 category pages. `status` slot uses `<StatusPanel>`. |
| `src/ui/components/MobileRegexBar.tsx` | Mobile-only sticky bottom bar. Props: `regexOutput` (ReactNode), `alerts` (ReactNode[]). `lg:hidden`. | Used by all 8 category pages. Desktop unaffected. `.mobile-regex-bar*` CSS rules MUST live inside `@media (max-width: 1023px)` — see Pitfall 26. |
| `src/ui/layout/Layout.tsx` | Root application shell. Structure: `<TopNav>` + `<main>` (scrollable). Sets `data-theme="dark"` on `<html>` once on mount (dark-only theme). | Was 3-piece (Sidebar + Header + MobileNavTabs) before iter 64. |
| `public/` | Static assets: robots.txt, sitemap.xml, 404.html, IndexNow key, Google/Yandex/Bing verification, favicon, og-banner | Served as-is by GitHub Pages |
| `public/atmosphere/` | PoE2-themed texture + hero decoration assets. **iter 65**: `bg.webp` (body bg texture), `bg-2x.webp` (`.poe-divider--ornate` border texture), `title-bg-4x.webp` + `early-access-button-underlay.webp` (visual reference only — `.poe-panel-header` / `.btn-cta` are pure CSS reinterpretations). **iter 67**: added `early-access-banner.webp`. **iter 69**: 4 hero decoration WebPs (`hero-bas-relief`, `hero-horned-warrior`, `hero-monster-red`, `hero-demon-blue`) — PNG → WebP q85 via one-off script. **iter 70**: `bg-forest.webp` + `bg-forest-mobile.webp` deleted. **iter 71**: `early-access-banner.webp` (`.poe-divider--banner` class on HomePage) + `hero-demon-blue.webp` (SeoBlock right-edge decoration, visible only when `<details>` open, opacity 0.10, lg+ only) + `news-bg-center.webp` (mobile-only `<lg` hero backdrop). **iter 120**: 3 side ghosts replaced with full-body portraits — `hero-shaman.webp` (left) + `hero-iva.webp` (right), 4 backdrop images (`hero-bas-relief`, `hero-horned-warrior`, `hero-monster-red`, `news-bg-center`) removed from JSX (kept on disk). **iter 121**: side ghosts moved OUT of hero block to root of HomePage JSX (anchored to `<main>` edges). **iter 122**: 4 stale webp deleted from disk (`hero-bas-relief`, `hero-horned-warrior`, `hero-monster-red`, `news-bg-center`) + `seo-atmosphere.webp` added (faf.png 1672×941 → WebP q85, 1600×900, 146 KB — wide landscape backdrop for SeoBlock, `.home-seo-atmosphere` class, opacity 0.18, `mix-blend-screen`, fade bottom 40%, lg+ only). All atmosphere assets now actively referenced from JSX or CSS — `title-bg-4x.webp` and `early-access-button-underlay.webp` are kept as visual reference for the pure-CSS reinterpretations (mentioned in CSS comments only). |
| `scripts/` | ETL pipeline (`scripts/etl/`) + prerender (`prerender.ts`/`prerender-full.ts`) + analysis (`analyze-regexes.ts`/`analyze-fn.ts`/`restructure-implicits.ts`) + current-iter audit (`verify-iter99-alpha-sort.ts`). iter 100 удалил 16 исторических verify/simulate/analyze-iter* скриптов (iter 49–95, все покрыты unit-тестами). iter 122 удалил dead one-off `optimize_hero_images.py` (iter 69 PNG→WebP конвертер, ссылался на отсутствующие `.png` исходники). | `pnpm etl` / `tsx scripts/prerender.ts` / `tsx scripts/prerender-full.ts`. **Не добавлять новые verify-iter*-*.ts** — покрыть через `tests/` (vitest) или inline sanity в `worklog.md`. |
| `tests/` | Vitest — core/, shared/, etl/, ui/, **integration/** (iter 102: e2e regression tests for runtime-classification pipeline) | `pnpm test` |
| `docs/` | Architecture, ETL guide, data contracts, in-game tests, SEO plan, **UI-аудит v2 + UI Refactor Plan + UI Visualization Audit (iter 130)** | Update on structural changes |
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

20. **`CategoryControlPanel` — split-only (iter 52-54):** Component renders ONLY the controls row (no `<RegexOutput>`, no sticky wrapper). Page passes `<RegexOutput>` separately to `<CategoryLayout>`'s `regexOutput` slot. All 8 category pages use this pattern. **Range warnings pattern (iter 61):** never show a warning badge that fires on every normal use of a feature — that's noise. Either make it conditional (specific threshold like `⚠ ≥40`), or push it into a tooltip (`title` attribute).

21. **Level 1 visual frames (iter 55):** Two families of decorative frames in `index.css` — affix headers (`.affix-header-{prefix,suffix,implicit}`: blue/orange/amber) + `RegexOutput` (`.regex-output`: gold `--poe-gold` + glow). Do NOT re-add inline `style={{ background: ... }}` on `RegexOutput` — `.regex-output` CSS owns the background.

22. **Navigation as "modes" — unified `TopNav` (iter 56 → iter 64):** 3-piece chrome (Sidebar + Header + MobileNavTabs) consolidated into single horizontal `TopNav.tsx`. Deleted files: `Sidebar.tsx`, `MobileNavTabs.tsx`, `Header.tsx`. Do NOT re-add them. Active state via `.nav-mode-active` CSS class with `::after` pseudo-element (`border-bottom: 3px` gold accent overlapping TopNav's bottom border — NO padding compensation needed). i18n key: `sidebar.feedback` → `nav.feedback`. CSS block in `index.css`: `/* ─── TopNav (iter 64, UI Phase 10) ─── */`.

23. **HomePage compaction + `<details>` blocks (iter 57 + iter 62):** HomePage has TWO `<details>` blocks (Features + SeoBlock), both collapsed by default. SEO preservation: `<details>` content stays in DOM (Google indexes even when closed). Do NOT add `hidden` or conditional rendering. Custom `▸` marker in `::before` (suppress default `<summary>` triangle via `list-style: none` + `::-webkit-details-marker { display: none }`).

24. **StatusPanel — unified status component (iter 58, rewritten iter 140 KI#22):** All 8 category pages use `<StatusPanel>` for `status` slot. Component accepts `badges` (ReactNode[]) + `alerts` (ReactNode[]) — main summary panel REMOVED (was redundant with SelectedBasket). `wantTokens`/`excludeTokens`/`allActiveTokens` props kept in interface but ignored (backward compat, destructured as `_wantTokens`). Renders null when no badges AND no alerts.

25. **MobileRegexBar — mobile sticky bottom bar (iter 59):** On mobile (< lg), `RegexOutput` moves from right-column aside into sticky-bottom bar (`MobileRegexBar.tsx`). StatusPanel `alerts` follow it. Desktop unchanged. **Double-render tradeoff:** `RegexOutput` mounted in BOTH desktop aside AND mobile bar; `autoCopy` persisted to localStorage keeps both in sync. VendorPage passes `hasRangedTokens={false}` — global min/max are no-ops; per-chip range inputs are primary UX.

26. **CSS specificity vs Tailwind responsive utilities (iter 60):** When a custom CSS rule targets a class ALSO used as a Tailwind responsive utility (e.g. `.my-class { display: flex }` + JSX `className="my-class lg:hidden"`) — tie at specificity (0,1,0) → source-order wins (Tailwind first, custom CSS after). At ≥lg, custom `display: flex` was overriding Tailwind's `display: none`. **Fix:** wrap ALL custom CSS rules for mobile-only elements inside `@media (max-width: 1023px)`. Do NOT use `!important` — it makes future overrides harder.

27. **ModList Level-3 badge auto-suppression (iter 62, Phase 8c):** When a scope (affix column OR origin section OR jewel-type-filtered list) contains ONLY ONE sub-group, the Level-3 semantic badge is redundant. `ModSubGroupSection` accepts `hideLabel?: boolean`; callers compute as `subGroups.length === 1`. Do NOT suppress Level-2 origin headers or Level-1 affix headers. **General rule:** any UI label that has zero informational value in its current scope = noise. Auto-suppress (derive from data, not manual flag).

28. **Palette consistency — NEVER use raw cold Tailwind colors (iter 63):** Project uses warm dark-fantasy palette in `:root` of `src/index.css` (`#0D0B09` / `#15110E` / `#3A2C22` / `#C89A4A` gold). Tailwind's default `indigo-*`, `gray-600/500`, `blue-500`, `purple-500`, `green-500` are COLD and clash visually. Use semantic palette tokens instead:
    | Forbidden (cold)              | Use (warm palette token)         |
    |------------------------------|----------------------------------|
    | `bg-indigo-600`              | `bg-amber-600` (active primary)  |
    | `bg-gray-600` / `bg-gray-500`| `bg-raised` or `bg-amber-700` |
    | `hover:bg-gray-600/500`      | `hover:bg-chip-hover` |
    | `focus:border-blue-500`      | `focus:border-accent-amber` (brand gold focus ring) |
    | `border-gray-500` (active)   | `border-accent-amber` |
    | `text-blue-500` (checkbox tick) | `text-accent-amber` (brand)  |
    | `text-purple-500` (corrupted tick) | `text-accent-purple` |
    | `text-green-500` (uncorrupted tick) | `text-accent-emerald` |
    | `text-amber-500` (threshold tick) | `text-accent-amber` |
    **Priority tier color hierarchy (preserved):** "Все" = neutral (`bg-raised`), "S+A" = deeper amber (`bg-amber-700`), "S" = brighter amber (`bg-amber-500`). **Checkbox tick colors carry semantics:** corrupted=purple, uncorrupted=emerald, delirious=blue, round10/threshold/auto-copy=amber. **Label size convention:** interactive buttons = `text-[13px]`; inline labels = `text-[12px]`.

29. **Atmospheric CSS primitives (iter 65 + iter 71) — four reusable classes in `index.css`.** `.poe-panel-header` (gold filigree rim via `box-shadow: inset`, NOT `border` — don't switch to real border, it'll shift layout). `.poe-divider` (1px fading horizontal line, NO vertical margin by default — parent's `gap-*` provides spacing). `.poe-divider--ornate` (8px variant with `bg-2x.webp` texture, `mask-image` critical). `.poe-divider--banner` (24px variant with `early-access-banner.webp`, opacity 0.35, HomePage only). `.btn-cta` + success/error/disabled variants — reserved for primary Copy buttons in `RegexOutput.tsx`, do NOT apply to non-CTA buttons (use warm palette tokens per Pitfall 28). Body background: `atmosphere/bg.webp` + warm dim gradient + radial vignette. Hero decorations: `hero-shaman.webp` (left) + `hero-iva.webp` (right) — full-body portraits, anchored to `<main>` viewport edges, opacity 0.20, xl+ only. SeoBlock backdrop: `seo-atmosphere.webp` (opacity 0→0.18 on `<details>[open]`, lg+ only).

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

40. **Dead patterns после ETL-фильтрации (iter 129 cleanup).** После iter 128 KI#13 (BTS-фильтр через `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS`) — 6 regex patterns в `src/shared/mod-classifier.ts` стали dead (матчили ТОЛЬКО BTS-токены, удалённые из данных). iter 129 cleanup их удалил: `больше.*волшебн.*редк.*монстр` (POSITIVE_KEYWORDS), `шанса появления свойств.*редк.*монстр` + `больше.*эффективн.*монстр` (NEGATIVE_KEYWORDS), `количеств.*редк.*монстр` + `количеств.*волшебн.*монстр` + `больше.*волшебн.*редк.*монстр` (POSITIVE_LOOT_PATTERNS), `шанса появления свойств.*редк.*монстр` (NEGATIVE_MONSTER_MODIFIERS_PATTERNS — kept `Дополнительных свойств у редких монстр` который REAL), `волшебн.*монстр|редк.*монстр` (WAYSTONE_A_PREFIX — kept `опыт|волшебн.*сундук|редк.*сундук`). 4 соответствующих теста удалены в `tests/shared/mod-classifier.test.ts` (1 модифицирован — 2-я assertion удалена). 1992→1988 tests. **General lesson:** После ETL-фильтрации токенов (BTS или иных) — ВСЕГДА проверять, не стали ли regex patterns в `mod-classifier.ts` dead. Если pattern матчит только удалённые токены — удалить pattern + соответствующий тест. Defensive coding ("in case ETL changes") — НЕ оправдан: (1) ETL-фильтр explicit и документирован; (2) regression tests (`tests/core/iter128-ki13-monster-rarity.test.ts` Section 7) ловят возврат BTS-токенов; (3) dead patterns просто confuse future readers. **Process:** после каждой ETL-фильтрации итерации — запускать `grep -nE 'PATTERN' src/shared/mod-classifier.ts` для каждого удалённого family-key и проверять, какие patterns больше ничего не матчат в `public/generated/*.json`.

41. **UI Refactor Phases 1-5 + iter 138 (`--strong`) - ВСЕ 7 ФАЗ DONE (iter 130-138).** Все 7 фаз UI Refactor выполнены в iter 132-137 + iter 138 `--strong` modifier wiring. Подробное описание каждой фазы - в `docs/UI_REFACTOR_PLAN.md` §12 (Phase Status table). Ключевые архитектурные паттерны:
    - **Phase 1 (iter 132):** `src/store/filter-store.ts` - +5 FilterState fields (`collapsedGroups`, `expandedSubGroups`, `showSelectedOnly`, `pinnedIds`, `chipExpandState`) + 13 FilterActions + URL-сериализация (5 compact keys: `c`/`es`/`so`/`pn`/`ce`, omit-when-default) + backward-compat (old URLs -> defaults). Asymmetric default per iter 131 §13.7 #4: top-level EXPANDED, sub-groups COLLAPSED.
    - **Phase 2 (iter 133, sticky search REVERTED iter 139 KI#19):** `ModList.tsx` + `VirtualizedModList.tsx` + NEW `GroupHeader.tsx` (shared, `variant='top'|'sub'|'origin'`) + 7 page files + `useCategoryPage.ts` + `i18n.ts` + `index.css`. Chevron via `.group-header-chevron` CSS (rotate 0->90deg when `[aria-expanded=true]`). "Развернуть все"/"Свернуть все" buttons (desktop only). Edge: sub-groups WITHOUT labels -> chips always render (no UI to toggle).
    - **Phase 2.5 (iter 134, REVERTED iter 139 KI#18):** "+N ещё" per-sub-group chip expander. `CHIP_PREVIEW_COUNT = 3`. Selected/excluded/pinned chips ALWAYS visible. REVERTED в iter 139 - все chips снова visible.
    - **Phase 3 (iter 135, aside header simplified iter 141 KI#29):** `showSelectedOnly` toggle + `SelectedBasket.tsx` (NEW, ~220 строк) + collapsible right `<aside>`. Cap = `SELECTED_BASKET_CAP = 20` (per iter 131 §13.7 #3). Affix badges ПРЕФ=blue/СУФ=orange/ИМПЛ=amber. CategoryLayout `basket` slot (optional, no aside header when omitted). `rightPanelCollapsed` - LOCAL state (NOT persisted to URL).
    - **Phase 4 + 4.5 (iter 137):** Stronger bg tints on `.affix-header-*` + compact chip density + NEW `Tooltip.tsx` (portal-based) + NEW `IconLegend.tsx` (★/✗/ⓘ). Critical bug fixed: DO NOT call `.focus()` on element that already has focus (fires synthetic focus event, re-triggers onFocus). SIBLING pattern: when adding interactive element to component with existing interactive element, render as SIBLING (button + button don't nest).
    - **Phase 5 (iter 136, LeftPanelFavorites removed iter 139 KI#20, restored as compact indicator iter 140 KI#24, counter fixed iter 141 KI#28):** `pinnedIds` Set + ⭐ pin slot on FilterChip + click-to-scroll via `data-family-key` + `scrollIntoView` + 2s `.favorite-pulse` CSS animation. `data-family-key` attribute enables cross-component DOM lookup - REQUIRES `instanceof HTMLElement` check + graceful degradation when chip virtualized out of DOM. Signature adapter pattern: `useCallback((ids) => ids.forEach(id => togglePinned(id)), [togglePinned])` (changed в iter 141 KI#28 на `if (ids.length > 0) togglePinned(ids[0])` - 1 toggle per family). ⭐ button is SIBLING of `role="switch"` div (valid ARIA tree); `stopPropagation` defensively prevents click bubbling. iter 140 KI#24: LeftPanelFavorites replaced by compact `FavoritesIndicator` (★ N badge in page header, returns null when empty). iter 141 KI#28: counter `pinnedIds.size` теперь = number of favorited families (was N per tier).
    - **iter 138 `--strong` modifier:** CSS rules для `.affix-header-{prefix,suffix,implicit}--strong` (deeper bg alpha 0.22/0.10 + brighter border-left alpha 0.85). Wiring: caller passes `${affixBase} ${affixBase}--strong` when `sortMode='tier-first'`. `.replace(/\s+/g, ' ').trim()` нормализует whitespace. Pattern can be reused for Tooltip if requested.

42. **Skip - merged into Pitfall 41.** (Phase 1 details теперь в Pitfall 41 + `docs/UI_REFACTOR_PLAN.md` §12.)

43. **Skip - merged into Pitfall 41.** (Phase 2 details теперь в Pitfall 41 + `docs/UI_REFACTOR_PLAN.md` §12.)

44. **Skip - merged into Pitfall 41.** (Phase 2.5 REVERTED в iter 139 KI#18 - chip truncation logic удалена.)

45. **Skip - merged into Pitfall 41.** (Phase 3 details теперь в Pitfall 41 + `docs/UI_REFACTOR_PLAN.md` §12.)

46. **Skip - merged into Pitfall 41.** (Phase 5 details теперь в Pitfall 41 + `docs/UI_REFACTOR_PLAN.md` §12.)

47. **Skip - merged into Pitfall 41.** (Phase 4 + 4.5 details теперь в Pitfall 41 + `docs/UI_REFACTOR_PLAN.md` §12.)

48. **UI Refactor iter 138 — `--strong` modifier wiring на `.affix-header-*` в tier-first mode.** iter 137 добавил CSS rules для `.affix-header-{prefix,suffix,implicit}--strong` (deeper bg alpha 0.22/0.10 + brighter border-left alpha 0.85) но wiring в caller был deferred. iter 138 реализовал wiring: при `sortMode='tier-first'` top-level affix column headers получают дополнительный CSS-класс `${affixBase}--strong`. **ModList.tsx** (`AffixColumn`) — `affixHeaderClass` extended:
    ```ts
    const affixBase = isImplicit ? 'affix-header-implicit' : isPrefix ? 'affix-header-prefix' : 'affix-header-suffix';
    const affixHeaderClass = sortMode === 'tier-first' ? `${affixBase} ${affixBase}--strong` : affixBase;
    ```
    `sortMode` prop уже был wired в `AffixColumn` (с iter 107 для FilterChip tier-aware border) — wiring свёлся к композиции className, no new props needed. **VirtualizedModList.tsx** (`VirtualRowContent`) — `headerClass` restructured:
    ```ts
    const affixBase = isImplicit ? 'affix-header-implicit' : row.affix === 'prefix' ? 'affix-header-prefix' : 'affix-header-suffix';
    const strongClass = sortMode === 'tier-first' ? `${affixBase}--strong` : '';
    const accentClass = isImplicit ? 'text-accent-amber' : row.affix === 'prefix' ? 'text-accent-blue' : 'text-accent-orange';
    const headerClass = `${affixBase} ${strongClass} ${accentClass}`.replace(/\s+/g, ' ').trim();
    ```
    `.replace(/\s+/g, ' ').trim()` нормализует whitespace когда `strongClass` пустой (иначе double-space между affixBase и accentClass). `sortMode` prop уже был wired в `VirtualRowContent` (с iter 107). **Tests:** +5 (3 ModList + 2 VirtualizedModList). ModList tests assert на `prefixHeader.className` через `screen.getByRole('button', { name: /Префикс/ })` (aria-label формируется как `${expandLabel}: ${label} (${count})` per GroupHeader — label comes from `t('affix.prefix')` = «Префикс», НЕ «ПРЕФИКСЫ»). VirtualizedModList tests — smoke only (TanStack Virtual renders 0 rows in jsdom без scroll dimensions; functional `--strong` application покрыто ModList tests). vitest 2158→2163, tsc 0, eslint 0. **General lesson:** (a) `--strong` modifier pattern (CSS ready → wiring deferred → wiring later) — clean separation between CSS и JSX changes; same pattern can be reused для других conditional visual modes (e.g. tooltip `--strong` variant если user запросит); (b) при composе className из multiple conditional fragments — ВСЕГДА используй `.replace(/\s+/g, ' ').trim()` или аналог для normalisation whitespace, иначе пустые conditional fragments оставляют double-spaces; (c) `sortMode` prop уже был wired в `AffixColumn` и `VirtualRowContent` с iter 107 для FilterChip tier-aware border — reuse existing prop flow вместо добавления новых props; (d) TanStack Virtual в jsdom рендерит 0 rows (нет scroll dimensions) — для testing UI changes внутри virtualized rows либо используй non-virtualized ModList variant (который рендерит actual rows), либо ограничься smoke-тестами (mount-without-crash); (e) aria-label GroupHeader = `${expandLabel}: ${label} (${count})` — label приходит из `t('affix.{affix}')` = «Префикс» / «Суффикс» (НЕ uppercased «ПРЕФИКСЫ» / «СУФФИКСЫ» — uppercase через CSS `text-transform: uppercase` применённый к variant='top' Tailwind classes); при тестах через `getByRole('button', { name: /.../ })` match по substring «Префикс» / «Суффикс» (case-sensitive).

49. **UI iter 139 - 5 UI bug fixes (KI#16-20, все FIXED + VERIFIED iter 140).** iter 139 react на user feedback с 5 UX-багами: (KI#16) right `<aside>` overflow fix (`category-aside` CSS class `min-width: 0; overflow-x: hidden`); (KI#17) ModList grid `md:grid-cols-[2fr_3fr]` (40/60) -> `md:grid-cols-2` (50/50) - parity fix applied ТОЛЬКО к ModList, VirtualizedModList parity в iter 141 KI#27; (KI#18) Phase 2.5 chip truncation REVERTED - все chips снова visible; (KI#19) `.sticky-search-bar` CSS `position: sticky` -> `position: relative` (sticky был visually noisy); (KI#20) `LeftPanelFavorites` removed из 7 category pages (restored as compact indicator iter 140 KI#24). +2 net tests (2163->2165).

50. **UI iter 140 - 4 UI bug fixes (KI#21, 22, 24, 25, все FIXED) + KI#23 monitoring.** iter 140 react на user feedback с 4 UX-багами: (KI#21) duplicate icons in IconLegend - i18n строки содержали prefix-icon + component рендерил icon отдельно = double icon, fix: i18n strings должны содержать ONLY text; (KI#22) redundant "Выбрано" block removed - StatusPanel rewrite (badges+alerts only, main summary panel REMOVED как redundant с SelectedBasket, props kept for backward compat destructured as `_wantTokens`); (KI#24) favorites restored as compact `FavoritesIndicator` (★ N badge в page header, returns null when empty, `role="status"` + aria-label с count); (KI#25) show-selected-only tooltip clarification via native `title` attribute (NOT portal Tooltip - native `title` OK для simple hints). (KI#23 - MONITORING) scroll jitter в virtualized lists - TanStack Virtual's `measureElement` + `ResizeObserver` dynamic measurement causes totalSize changes -> paddingTop/paddingBottom shifted -> visible rows jump. Not fixed - requires careful testing. **Lessons:** (a) i18n string with icon prefix + component rendering icon separately = double icon - audit all i18n keys with emoji/symbols; (b) removing redundant panel = keep props in interface, ignore at render (destructured with `_` prefix); (c) compact indicator pattern for "X removed, user wants it back" - `null` when empty, badge when non-empty (minimal noise, maximum visibility); (d) `role="status"` for live count badges; (e) native `title` attribute is OK for simple clarifications - don't reach for portal Tooltip when `title` suffices; (f) monitoring a Known Issue is a valid outcome - per rule "лучше недоделать, чем сломать".

51. **UI iter 141 — 4 UI bug fixes (KI#26, 27, 28, 29) + 2 KI documented (KI#30, 31).** iter 141 react на user feedback с 4 новыми UX-проблемами после iter 140 + 2 более крупных запроса (cross-tab favorites persistence, favorites как quick-select). Все 6 задокументированы как KI#26-31 ПЕРЕД фиксом. **Fixes:**
    - **KI#26** — round10 default off + global settings cross-tab persistence. `defaultRound10` было `true` → `false` (per user explicit request). NEW `src/store/local-settings.ts` — thin localStorage wrapper (`readLocalSetting<T>(key, fallback)`, `writeLocalSetting<T>(key, value)`, `clearLocalSetting(key)`) with JSON serialize + try/catch silent fallback for SSR/privacy mode/quota-exceeded. В `useCategoryPage.ts` 7 useState-backed global settings (`searchLogic`, `round10Enabled`, `minValue`, `maxValue`, `priorityFilter`, `thresholdEnabled`, `sortMode`) теперь читаются из localStorage если URL не задал значение, и пишутся в localStorage при каждом изменении. Precedence: URL (shareable link) > localStorage (cross-tab persistence) > default. `restoreFilterState` (ProfilePanel) также fallback на localStorage перед hard-coded default — prevents profile-load from blowing away cross-tab preferences.
    - **KI#27** — VirtualizedModList prefix/suffix 50/50 alignment. iter 139 KI#17 фикс (`md:grid-cols-2`) был применён ТОЛЬКО к `ModList.tsx` (relic/tablet/waystone), но НЕ к `VirtualizedModList.tsx` (belt/ring/amulet/jewel) — там осталось `md:grid-cols-[2fr_3fr]` (40/60 split). Fix: одна строка в VirtualizedModList.tsx заменена на `md:grid-cols-2`. **Lesson: при fixed-bug-in-one-place, audit ALL similar components.** ModList и VirtualizedModList rendering logic дублирован — fix в одном не автоматически применяется в другом.
    - **KI#28** — Favorites counter — 1 per family, not N per tier. Раньше `handleTogglePinned(ids)` в каждой странице вызывал `togglePinned(id)` для КАЖДОГО member ID семьи (5 tier-ов → 5 IDs → счётчик показывал 5). Fix: `handleTogglePinned` упрощён — `if (ids.length > 0) togglePinned(ids[0])`. `pinnedIds.size` теперь = число favorited семей, что соответствует mental model пользователя «1 клик = 1 избранное». `FilterChip.isPinned` check (`memberIds.some(id => pinnedIds.has(id))`) продолжает работать — first member is in pinnedIds. **Lesson: counter semantic should match user's mental model.** Если user думает «1 клик = 1 favorite», counter должен показывать 1, не N. Family-level toggle + individual-ID counter = mismatch.
    - **KI#29** — Aside collapse header упрощён. Раньше это была полная панель (`bg-panel border border-edge-panel rounded p-2`) с пустым `<span>` title placeholder + chevron кнопкой. User: «этот элемент слишком 'большой'». Fix: удалён panel-wrapper + пустой span, оставлена compact flex-row с маленькой кнопкой `p-1 text-[13px] leading-none`. Визуально легче, функция (collapse/expand) сохранена. **Lesson: empty placeholder elements are visual noise.** Если `<span>` пустой и служит только для alignment — это sign того, что layout можно упростить.
    - **KI#30 — MONITORING (not fixed).** Cross-tab persistence favorites (pinnedIds). `pinnedIds` хранятся в per-category Zustand store, который уничтожается при unmount. URL hash shared между вкладками и перезаписывается при переходе. Решения: (a) per-category localStorage keys (`poe2:favorites:belt`, ...); (b) global Zustand store с category-keyed map (вне React tree); (c) IndexedDB. iter 141 уже добавил `local-settings.ts` infrastructure — расширение до per-category favorites требует design decision (format, expiry, migration). Отложено на iter 142+.
    - **KI#31 — MONITORING (not fixed).** Favorites как quick-select feature. Пользователь ожидает: клик на ★ в избранном → аффикс выбирается (added to selectedIds) ИЛИ scroll-to-mod срабатывает. Текущая реализация: ★ только визуальный маркер + фильтр show-selected-only. Feature gap, не bug. Решения: (a) click на ★ в FavoritesIndicator → диалог/панель со списком favorited семей + быстрый select; (b) click на ★ в FilterChip → toggle AND scroll-to-mod (если не в viewport); (c) отдельный «Favorites» tab/drawer. Требует UX design + user feedback. Отложено на iter 142+.
    **Tests:** +13 net (2177→2190). NEW `tests/store/local-settings.test.ts` (8 tests). NEW `tests/ui/CategoryLayout.test.tsx` KI#29 describe block (4 tests). NEW `tests/ui/VirtualizedModList.test.tsx` KI#27 describe block (1 test). vitest 2177→2190, tsc 0, eslint 0. **General lesson:** (a) **localStorage for cross-tab persistence of user-level settings**. URL hash is per-page and gets overwritten on each mount; localStorage is stable across the entire origin. Use URL for shareable links, localStorage for personal cross-tab preferences. Precedence: URL > localStorage > default; (b) **Audit ALL similar components when fixing a bug in one**. ModList and VirtualizedModList have duplicated rendering logic — a fix in one is NOT automatically applied to the other. Always grep for similar patterns after a fix; (c) **Counter semantic should match user's mental model**. If user thinks «1 click = 1 favorite», counter shows 1, not N. Family-level toggle + individual-ID counter = mismatch. Either change the toggle (1 ID per family) OR change the counter (count families); (d) **Empty placeholder elements are visual noise**. If `<span>` is empty and serves only for alignment, the layout can be simplified. Remove the placeholder, adjust the layout (e.g. `justify-end` instead of `justify-between`); (e) **Monitoring a feature request is a valid outcome**. KI#30 (cross-tab favorites) and KI#31 (quick-select) are NOT bugs — they're feature gaps. Per project rule «лучше недоделать, чем сломать» — documenting as Known Issue + deferring to next iter (with design decision needed) is the right call. **Перед стартой iter 142:** прочитать `docs/UI_REFACTOR_PLAN.md` §12 + §13.7 (UX verification feedback + KI#23/30/31 fixes + remaining optional enhancements). Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий. KI#9 + KI#23 + KI#30 + KI#31 — monitoring, не фиксировано.




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
| `docs/UI_AUDIT.md` | UI-аудит v2 (2026-06-21) — исходные рекомендации для UI-рефакторинга. Read-only reference. |
| `docs/UI_REFACTOR_PLAN.md` | iter 129 — детальный план UI-рефакторинга на 5 фаз (5 итераций). Update при выполнении каждой фазы (отметить "Phase N — DONE"). |
| `worklog.md` | Every iteration — append new Task ID section |

---

## 14. Open Proposals

### OP-1 (iter 82-84, CLOSED iter 119) — Перегруппировка аффиксов

**Status: CLOSED.** Полный анализ — в `docs/AFFIXES_GROUPING_ANALYSIS.md`.

3-корзинная схема (`offensive/defensive/attribute/neutral` для jewellery/jewel, `positive/negative/neutral` для waystone) отправляла 14-39% модов в «Прочие»/«Нейтральные». Решение: 24 функциональных блока для jewellery + 6 weapon sub-blocks для jewel + sub-blocks внутри waystone sentiment и tablet type.

**Закрыто в iter 99-119:** alphabetical within-block sort (iter 99), Zod schema fix (iter 101), e2e regression tests (iter 102), waystone sub-blocks (iter 104), tablet sub-blocks (iter 105), tier-aware sort toggle `SortMode = 'alpha' | 'tier-first'` (iter 106), tier-colored borders (iter 107), `sortKey` infrastructure + `BLOCK_SORT_RULES` 18 блоков 312 family-keys 100% coverage (iter 112), все priority-блоки закрыты (iter 119).

**Ключевые файлы (актуальное состояние):**
- `src/shared/mod-classifier.ts` — `classifyGroups()` + 11 режимов, `sortGroupsByMode()`. 6 блоков без правил → fallback alphabetical (low-priority/empty).
- `src/shared/family-grouper.ts` — `groupTokensByFamily` + `buildFamilyGroup()` (вычисляет `sortKey`).
- `src/shared/block-sort-rules.ts` — `BLOCK_SORT_RULES` + `computeSortKey(block, familyKey)`.
- `src/shared/types.ts` — `FamilyGroup.sortKey?: string`, `ModGroupMode`, `SortMode`.
- `src/ui/components/FilterChip.tsx` + `ModList.tsx` + `VirtualizedModList.tsx` — `sortMode?: SortMode` prop threaded через 13 call sites. tier-first mode: 4-way tier color dispatch (S=amber-soft / A=amber / B=amber-dim bronze / C=gray).
- `src/ui/components/CategoryControlPanel.tsx` — radio-group «Сортировка: По алфавиту / По приоритету» на 6 страницах с priority classification.
- `src/store/url-sync.ts` + `src/ui/hooks/useCategoryPage.ts` — URL-persistent `extraState.sortMode`.
- `src/shared/i18n.ts` — `sort.label` / `sort.alpha` / `sort.tier_first`.
- `src/index.css` — `--bl-amber-dim: #b45309` (amber-700, bronze) для B-tier border.

**Опциональные расширения (если user запросит):** (a) third sort mode `popularity` через `sortKey?: number` в `FamilyGroup` + ETL заполнение — требует ETL-расширения; (b) waystone neutral-generic (6 groups) — расширить POSITIVE_KEYWORDS для 5 desecrated Breach-adjacent mods; (c) tablet Разломы vs Бездна — расширить BREACH_KEYWORDS для 2 mods (low-priority, текущая sub-block classification корректна).
