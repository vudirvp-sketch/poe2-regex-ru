# PoE2 Regex RU — Agent Navigation

> **Entry document.** Read this first.
> **Текущее состояние:** iter 169 — фикс KI#50 (потеря expand/collapse состояния при смене вкладок). iter 168 (A1 — усиление контраста L1/L2 corner accents), iter 167 (A3 — placeholder + связь SelectedBasket→RegexOutput) и iter 166 (A2 — разделение палитр L2/L3) также DONE. Все 2359 тестов PASS.
> **Концепт-спецификация:** `docs/REDESIGN_CONCEPT_v4.md` (актуальная) — детальный анализ 7 аспектов + зафиксированные решения пользователя в §9.
> **Активные KI:** KI#45 (`^` на 2+ ALT — mitigation в core), KI#46 (250 char limit — auto-mitigation), KI#47 (cross-suppression excludes — low priority), KI#43 (deploy retry — пассивная проверка). KI#50 (expand state persistence) — FIXED в iter 169.
> **Базовые проверки:** `npx tsc -b`, `npx eslint .`, `npx vitest run` (2359/2359 PASS), `npx vite build`. Актуальный статус — в `STATUS.md`, история — в `worklog.md`.

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Regex engine — AST, compiler, optimizer (4 phases), number-regex, trie/dp factorizer, oracle, matcher, limits | **ZERO npm dependencies** — pure TypeScript only |
| `src/shared/` | Types, i18n, mod-classifier, family-grouper, constants, Zod schemas | Imported by core + UI |
| `src/strategies/` | Locale strategy (Russian dialect: ёфикация, ю/я) | Imported by core |
| `src/store/` | Zustand stores — filter-store, profile-store, url-sync | Import from `@shared`, `@core` |
| `src/data/` | Runtime JSON loader (Zod-validated) + vendor properties | Fetches + validates `public/generated/*.json` |
| `src/ui/` | React components — pages, layout, hooks | Import from `@store`, `@shared`, `@data`, `@core` |
| `src/ui/hooks/category-ast-utils.ts` | Pure AST helpers (`buildAstFromSelections`, `pushLiteralsWithFamilyLogic`, `applyRuntimeYofication`, `getEffectiveRange*`). All PURE (no React). Re-exported from `useCategoryPage.ts` для backward compat с tests. | All PURE |
| `src/ui/hooks/useCategoryPage.ts` | Main hook для category pages. Compose-хук из 3 sub-hooks: `useFilterStore` / `useCategoryData` / `useRegexBuilder`. Accepts optional `config.filterStore: FilterStoreHook` для pages с extraAstNodes-from-local-state (Waystone/Jewel/Tablet). | Backward compat: `useCategoryPage({ categoryId: 'belt' })` still works |
| `src/ui/layout/TopNav.tsx` | Unified horizontal top navigation (iter 64). Single sticky bar: brand (logo + title) \| tabs (scrollable) \| feedback hint (lg+). | `role="banner"` on `<header>`, `role="navigation"` on `<nav>`. Active state: `.nav-mode-active` class. |
| `src/ui/components/StatusPanel.tsx` | Badges + alerts panel. iter 140 KI#22 rewrite — main summary panel REMOVED (redundant with SelectedBasket). Props: `badges` (ReactNode[]) + `alerts` (ReactNode[]). Backward compat: `wantTokens`/`excludeTokens`/`allActiveTokens` still in interface but ignored. | Renders null when no badges AND no alerts |
| `src/ui/components/SelectedBasket.tsx` | 3-section basket (want/opt/exclude) above RegexOutput. iter 161. Cap=20 per section. Affix badges ПРЕФ=blue/СУФ=orange/ИМПЛ=amber. | Family-group counters via `countUniqueFamilyKeys` |
| `src/ui/components/RegexOutput.tsx` | Main output. Health bar (green/yellow/red) + overflow + split. iter 164: `.regex-output` (gold border + glow + corner accents) + pulse-on-change animation. iter 167: enhanced empty-state (`.regex-output__empty` dashed border + ↑ arrow + hint). | `prefers-reduced-motion` уважается |
| `src/ui/components/GroupHeader.tsx` | Shared collapsible header. `variant='top'` (L1 affix column) / `'origin'` (L2) / `'sub'` (L3 functional). Chevron via `.group-header-chevron` CSS. | Phase 4: optional `infoTooltip` prop — `ⓘ` glyph as SIBLING (NOT child) of toggle button |
| `src/ui/components/ModList.tsx` + `VirtualizedModList.tsx` | 2-column affix list with L1/L2/L3 hierarchy. L1 collapsed via `collapsedGroups`, L3 via `expandedSubGroups`. L3 default COLLAPSED, L1 default EXPANDED. | `hideLabel` for L3 when scope has only 1 sub-group (Phase 8c) |
| `src/ui/layout/CategoryLayout.tsx` | 2-col desktop / 1-col mobile shell. Slots: `header`, `controls`, `basket?`, `basketHasContent?` (iter 167 — renders BasketToRegexFlow connector), `regexOutput`, `status?`, `sidebar?`, `mobileBar?`, `children`. | Adopted by ALL 8 category pages |
| `src/ui/components/MobileRegexBar.tsx` | Mobile-only sticky bottom bar. `lg:hidden`. | `.mobile-regex-bar*` CSS rules MUST live inside `@media (max-width: 1023px)` (Pitfall 26) |
| `src/shared/mod-classifier.ts` | 4-level classification: Affix (L1) → Origin (L2) → Semantic (L3) → chip (L4). 11 modes (`affix-semantic`, `affix-functional`, `jewel-functional`, `affix-sentiment-subblocks`, `tablet-type-subblocks`, `relic-semantic`, etc.). `classifyGroups()` + `sortGroupsByMode()` + `ORIGIN_SECTION_LABELS`. | iter 101 CRITICAL: `functionalCategory` field now survives Zod schema (was stripped before) |
| `src/shared/block-sort-rules.ts` | `BLOCK_SORT_RULES` — 18 blocks, 312 family-keys, 100% coverage. `computeSortKey(block, familyKey)`. | iter 112 |
| `src/store/filter-store.ts` | Zustand store. State: `selectedIds`, `excludedIds`, `optionalIds`, `searchText`, `affixFilter`, `originFilter`, `groupMode`, `collapsedGroups`, `expandedSubGroups`, `showSelectedOnly`, `pinnedIds`, `chipExpandState`, `sortMode`, `searchLogic`. URL-сериализация через `url-sync.ts`. | iter 159: `searchLogic: 'and' | 'or' | 'mixed'`, `optionalIds` для MIXED mode |
| `public/` | Static assets: robots.txt, sitemap.xml, 404.html, IndexNow key, Google/Yandex/Bing verification, favicon, og-banner, generated JSONs | Served as-is by GitHub Pages |
| `public/atmosphere/` | PoE2-themed textures: `bg.webp` (body bg), `bg-2x.webp` (divider ornate), hero portraits (`hero-shaman.webp` left, `hero-iva.webp` right), `seo-atmosphere.webp` (SeoBlock backdrop, lg+ only). | All assets actively referenced from JSX or CSS |
| `scripts/` | ETL pipeline (`scripts/etl/`) + prerender (`prerender.ts` / `prerender-full.ts`) + analysis. **НЕ добавлять новые verify-iter*-*.ts** — покрывать через `tests/` (vitest). | `pnpm etl` / `tsx scripts/prerender.ts` / `tsx scripts/prerender-full.ts` |
| `tests/` | Vitest — core/, shared/, etl/, ui/, integration/ | `pnpm test` (2328 passing) |
| `docs/` | Architecture, ETL guide, data contracts, in-game tests, SEO plan, UI audits, redesign concepts | See §13 |
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
pnpm test                 # Vitest (all tests) — current: 2319 passing
pnpm etl                  # Full ETL with optimizer
pnpm etl:fresh            # ETL without cache (regenerate all)
pnpm etl:check-stale      # Check source HTML staleness
pnpm optimize             # Run iterative optimizer only
pnpm analyze-fn           # FN/FP analysis report
```

**Note:** If `pnpm` is not installed, `npm run <script>` works as a drop-in replacement. The build uses `tsc -b` (build mode with project references) — stricter than `tsc --noEmit`. Always run `pnpm build` (or `npx tsc -b`) to verify, not just `tsc --noEmit`.

## 5. Core Optimizer Module Structure

`optimizer.ts` runs 4 phases:

| File | Purpose | Key exports |
|------|---------|-------------|
| `optimizer.ts` | Entry — `optimize()`, `collectCollapsedTokenIds()` | `optimize`, `collectCollapsedTokenIds`, `collectTokenIds` |
| `core-optimizations.ts` | Phase 1 dedup + Phase 4 conflicting-exclude removal | `deduplicateOrGroups`, `removeConflictingExcludes`, `expandTokenId`, `getValueKey` |
| `optimization-strategies.ts` | Phase 2 opt-table + Phase 3 suffix truncation | `applyOptimizationTable`, `truncateSuffix`, `isTruncationSafe` |

Compiler (`compiler.ts`) `normalizeAst` for **AND(LITERAL..., EXCLUDE) inside OR**: produces `^(?!.*A)(?!.*B).*lit1.*lit2.*...` (bidirectional, in-game verified iter 46; extended to multi-LITERAL iter 49).

## 6. PoE2 Regex Dialect (VERIFIED IN-GAME)

| Syntax | Meaning | Status |
|--------|---------|--------|
| `substring` | Simple substring match | ✅ |
| `\|` (top-level in ONE quoted group) | OR — single-word OR multi-word with `.*` bridges (Path D) | ✅ |
| `\|` BETWEEN two quoted groups (`"X"\|"Y"`) | OR — **BROKEN**, zero matches | ❌ |
| `\|` inside `()` with multi-word alternatives | Grouping — **BROKEN** | ❌ |
| `"prefix (A\|B\|C)"` (non-`.*` prefix + `()` + `\|`) | **BROKEN** — matches only prefix broadly | ❌ |
| `"prefix.*literal(A\|B\|C)"` (`()` ПОСЛЕ `.*` bridge + literal) | **BROKEN in-game** — engine ignores `()` content. iter 125 fix: `distributeAlternation()` in `src/core/compiler.ts` converts to Path D. | ❌ → ✅ (fixed iter 125) |
| AND via space (`"X" "Y"`) | Cross-block AND + same-block AND | ✅ |
| `.*` | Within single block only (does NOT cross blocks) | ✅ |
| `.*` bridge | `"prefix.*suffix"` bridges number + middle words | ✅ |
| `^` | Start-of-block anchor (single-quoted ✅; OR-context — только на первой ALT, KI#45) | ⚠️ |
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

## 8. Frequent Pitfalls (KEY — read before touching compiler/optimizer/UI)

1. **`!` INSIDE quotes with `|`** — NOT before quotes. `"!A|B"` works, `!"A|B"` does NOT.
2. **`.*` does NOT cross blocks** — use AND (`"X" "Y"`).
3. **`$` unreliable** — never use.
4. **`?` NOT supported** — use `\d{2,}` instead. Generator never emits `?`.
5. **Core = dependency-free** — no npm imports in `src/core/`.
6. **Word truncation = END of suffix only**, min 3 significant chars.
7. **`()` in regex = PoE2 grouping**, NOT literal parens.
8. **`getValueKey` for RANGE** must include ALL distinguishing fields.
9. **`|` scope:** `|` works ONLY at TOP LEVEL of ONE quoted group. Does NOT work between quoted groups, inside `()`, or after non-`.*` prefix.
10. **Cross-block FP risk:** `"X" "Y"` can match different blocks → FP. Use `"X.*Y"` for same-block.
11. **Dark-only theme (iter 51):** Light theme removed. CSS tokens are warm dark-fantasy (`#0D0B09` / `#15110E` / `#3A2C22` / `#C89A4A` gold). Do NOT re-add light theme.
12. **Palette consistency (iter 63):** NEVER use raw cold Tailwind colors (`indigo-*`, `gray-600/500`, `blue-500`, `purple-500`, `green-500`). Use semantic tokens (`bg-raised`, `bg-chip-hover`, `text-accent-amber`, `text-accent-emerald`, etc.). See `src/index.css` `:root` for full token list.
13. **Level 1 visual frames (iter 55):** `.affix-header-{prefix,suffix,implicit}` (blue/orange/amber) + `.regex-output` (gold) + `.affix-origin-header` (iter 164, gold mini-frame for L2 origin). Do NOT re-add inline `style={{ background: ... }}` — CSS owns the background.
14. **CSS specificity vs Tailwind responsive utilities (iter 60):** When custom CSS targets a class ALSO used as a Tailwind responsive utility — wrap custom CSS rules for mobile-only elements inside `@media (max-width: 1023px)`. Do NOT use `!important`.
15. **TopNav as "modes" (iter 64):** 3-piece chrome (Sidebar + Header + MobileNavTabs) consolidated into single `TopNav.tsx`. Deleted files: `Sidebar.tsx`, `MobileNavTabs.tsx`, `Header.tsx`. Do NOT re-add them. Active state via `.nav-mode-active` CSS class.
16. **StatusPanel iter 140 KI#22 rewrite:** Main summary panel REMOVED (redundant with SelectedBasket). Component accepts `badges` + `alerts` only. `wantTokens`/`excludeTokens`/`allActiveTokens` props kept but ignored.
17. **MobileRegexBar (iter 59):** On mobile (< lg), `RegexOutput` moves to sticky-bottom bar. Desktop unchanged. Double-render tradeoff: `RegexOutput` mounted in BOTH desktop aside AND mobile bar.
18. **ModList L3 auto-suppression (iter 62 Phase 8c):** When a scope has ONLY ONE sub-group, the L3 badge is redundant. `hideLabel?: boolean` prop. Auto-derived from data, not manual flag.
19. **`useCategoryPage` hook architecture:** 3 sub-hooks (`useFilterStore` / `useCategoryData` / `useRegexBuilder`). For pages with extraAstNodes-from-local-state (Waystone/Jewel/Tablet): pass `config.filterStore` + write-back via `useEffect` without `setState`. iter 169 (KI#50): expand/collapse Sets (`expandedSubGroups` / `collapsedGroups` / `chipExpandState`) persist per-category in `poe2:uistate:<categoryId>` localStorage via `readUiState` / `writeUiState` / `clearUiState` / `filterInCategoryKeys` (in `src/store/local-settings.ts`). useState initializer on mount filters cross-category leak from URL (URL hash is shared across categories — amulet's `amulet:prefix:...` keys leak into ring's store but don't match any ring subgroups) and restores from localStorage when no in-category URL keys remain. URL sync effect persists to localStorage on every state change. Same pattern as KI#30 favorites persistence.
20. **4-level hierarchy (актуально для OP-1):** `Affix (L1) → Origin (L2, only when showOriginSubSections=true) → Semantic (L3) → chips (L4)`. iter 164 усилил L2 через `.affix-origin-header`. iter 166 реализовал A2: L3 sub-group рендерится с нейтральными `bg-panel/15 border border-edge/15` + цветным `colorClass` (text-only), а L2 origin сохраняет цветной bg-tint. iter 168 (A1 Вариант B) расширил контраст L1↔L2 corner accents: L1 8×8/0.55, L2 4×4/0.30 (было 6×6/0.4 и 5×5/0.35 — контраст ~12% → ~25%). См. `docs/REDESIGN_CONCEPT_v4.md` §9 (зафиксированные решения пользователя).
21. **MIXED mode (iter 158-163):** `searchLogic: 'and' | 'or' | 'mixed'`. 3-state chip (click=want / shift+click=opt / right-click=exclude). `MIXED_OR` AST node + `anchorFirstAltOnly` mitigation (KI#45). `truncateMixedOrLiterals(ast, maxLen=12)` auto-applied when compiled regex > 240 chars (KI#46).
22. **Sort modes (iter 99 + iter 106):** `SortMode = 'alpha' | 'tier-first'`. URL-persistent через `extraState.sortMode`. UI-toggle: `<select>` «Сортировка» в `CategoryControlPanel`. tier-first mode: 4-way tier color dispatch (S=amber-soft / A=amber / B=amber-dim bronze / C=gray). `--bl-amber-dim: #b45309` для B-tier.
23. **Atmospheric CSS primitives:** `.poe-panel-header` (gold filigree rim via `box-shadow: inset`, NOT `border`). `.poe-divider` (1px fading horizontal line, NO vertical margin by default). `.poe-divider--ornate` (8px variant with `bg-2x.webp` texture). `.btn-cta` + success/error/disabled — reserved for primary Copy buttons in `RegexOutput.tsx` only.
24. **CI/CD iter 155 — KI#43:** `actions/deploy-pages` sometimes fails transiently (~6s after Build SUCCESS). Fix: deploy step обёрнут в `Wandalen/wretry.action@v3` (`attempt_limit: 3`, `attempt_delay: 30`). Build SUCCESS + Deploy FAILURE ~6s = transient Pages API error, NOT artifact issue.

## 9. Deterministic Regex Strategy (8 Principles — UNIFIED for ALL categories)

1. **ONE MOD = ONE QUOTED GROUP** — each mod → one `"..."` group.
2. **MULTI-MOD = AND ACROSS BLOCKS** — N mods → N quoted groups separated by spaces.
3. **`|` SCOPE — TOP LEVEL of one quoted group** — does NOT work between quoted groups or inside `()`.
4. **`.*` BRIDGING WITHIN SINGLE BLOCK** — `"prefix.*suffix"` bridges number and middle words.
5. **SUFFIX UNIQUENESS** — shortest suffix unique to the mod (≥3 chars, end-only truncation).
6. **SHARED SUFFIX → DIFFERENTIATE BY NUMBER** — `"(1[0-5])%.*suffix"` for family regex.
7. **CROSS-BLOCK FP RISK** — `"X" "Y"` may match different blocks → FP. Use `"X.*Y"`.
8. **SAME-FAMILY OR → Path D** — `"prefix.*A|prefix.*B|prefix.*C"`. Over 250 chars → runtime split.

**NEVER use:** `"prefix (A|B|C)"`, `"(A B|C D)"`, `"X"|"Y"` — all confirmed BROKEN in-game.

## 10. Pre-rendering (Two Levels)

**Level 1 (`scripts/prerender.ts`):** Generates 9 route-specific HTML files with unique meta tags + `<noscript>` fallback. Pure string manipulation. Runs automatically after `vite build`.

**Level 2 (`scripts/prerender-full.ts`):** Playwright + headless Chromium renders React content into `<div id="root">`. Graceful: if Playwright not installed, falls back to Level 1.

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
| `home.features_summary` | Возможности генератора… | `<summary>` of Features `<details>` |
| `home.seo_summary` | Подробнее о регексах PoE2… | `<summary>` of SeoBlock `<details>` |
| `nav.feedback` | Баги и идеи → Discord: woonderdad | TopNav right-side hint (lg+). |
| `nav.categories` | Категории | TopNav `<nav>` `aria-label`. |

**Design principle:** Each UI zone has its own i18n key — no text duplication across zones.

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
| `docs/UI_AUDIT.md` | UI-аудит v2 (iter 110) — reference, read-only |
| `docs/UI_REFACTOR_PLAN.md` | iter 137 — 7 фаз UI-рефакторинга. All DONE. |
| `docs/REDESIGN_CONCEPT_v3.md` | iter 164 — реализован (P1/P2/P3). Ревизия в v4 §4. |
| `docs/REDESIGN_CONCEPT_v4.md` | iter 165 — АКТУАЛЬНАЯ концепт-спецификация. Детальный анализ 7 аспектов внешнего UX-аудита с вариантами решений. **Без реализации кода — ждёт согласования с пользователем.** |
| `worklog.md` | Every iteration — append new Task ID section |
