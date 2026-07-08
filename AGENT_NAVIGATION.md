# PoE2 Regex RU — Agent Navigation

> **Entry document.** Read this first.
> **Текущее состояние:** iter 180 — SEO technical fixes (`<title>` 80→58 chars, удалён `meta keywords`, добавлены FAQ JSON-LD + FAQ-секция в SeoBlock, синонимы, KI#54 fix: `/timeless-jewel` добавлен в `prerender-full.ts` и IndexNow urlList). iter 179 — README rewrite + docs/ cleanup. iter 178 — полировка `/timeless-jewel`. iter 177 (KI#53 fix), iter 176 (категория `/timeless-jewel`), iter 175 (разведка + план) — все DONE ✅.
> **План категории:** `docs/ATLAS_JEWEL_PLAN.md` (решения пользователя зафиксированы).
> **Активные KI:** KI#45 (`^` на 2+ ALT — mitigation в core), KI#46 (250 char limit — auto-mitigation), KI#47 (cross-suppression excludes — low priority), KI#43 (deploy retry — пассивная проверка). **KI#54 — ЗАКРЫТ (iter 180).** **KI#53 — ЗАКРЫТ (iter 177).**
> **Базовые проверки:** `npx tsc -b`, `npx eslint .`, `npx vitest run` (2405 passed | 5 skipped), `npx vite build`. Актуальный статус — в `STATUS.md`, история — в `worklog.md`.

---

## 1. Where Things Are

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `src/core/` | Regex engine — AST, compiler, optimizer (4 phases), number-regex, trie/dp factorizer, oracle, matcher, limits | **ZERO npm dependencies** — pure TypeScript only |
| `src/shared/` | Types, i18n, mod-classifier, family-grouper, constants, Zod schemas | Imported by core + UI |
| `src/strategies/` | Locale strategy (Russian dialect: ёфикация, ю/я) | Imported by core |
| `src/store/` | Zustand stores — filter-store, profile-store, url-sync | Import from `@shared`, `@core` |
| `src/data/` | Runtime JSON loader (Zod-validated) + vendor properties | Fetches + validates `public/generated/*.json`. iter 176: добавлен `atlas-jewel-loader.ts` (отдельная schema `AtlasJewelCategoryData`). |
| `src/ui/` | React components — pages, layout, hooks | Import from `@store`, `@shared`, `@data`, `@core` |
| `src/ui/hooks/category-ast-utils.ts` | Pure AST helpers (`buildAstFromSelections`, `pushLiteralsWithFamilyLogic`, `applyRuntimeYofication`, `getEffectiveRange*`). All PURE (no React). Re-exported from `useCategoryPage.ts` для backward compat с tests. | All PURE |
| `src/ui/hooks/useCategoryPage.ts` | Main hook для category pages. Compose-хук из 3 sub-hooks: `useFilterStore` / `useCategoryData` / `useRegexBuilder`. Accepts optional `config.filterStore: FilterStoreHook` для pages с extraAstNodes-from-local-state (Waystone/Jewel/Tablet). | Backward compat: `useCategoryPage({ categoryId: 'belt' })` still works |
| `src/ui/layout/TopNav.tsx` | Unified horizontal top navigation (iter 64). Single sticky bar: brand (logo + title) \| tabs (scrollable) \| feedback hint (lg+) + GitHub link (lg+, iter 173). iter 173 (KI#51 fix): `.topnav-tabs` обёрнут в `.topnav-tabs-wrap` (relative, `flex:1`, `overflow:hidden`) с `::before`/`::after` fade-градиентами; JS через `useRef`/`useEffect`/`useState` трекает scroll-position и toggles `--can-left`/`--can-right` классы — fades появляются только когда есть куда скроллить в эту сторону. | `role="banner"` on `<header>`, `role="navigation"` on `<nav>`. Active state: `.nav-mode-active` class. GitHub link: `target="_blank" rel="noopener noreferrer"`. |
| `src/ui/components/StatusPanel.tsx` | Badges + alerts panel. iter 140 KI#22 rewrite — main summary panel REMOVED (redundant with SelectedBasket). Props: `badges` (ReactNode[]) + `alerts` (ReactNode[]). Backward compat: `wantTokens`/`excludeTokens`/`allActiveTokens` still in interface but ignored. | Renders null when no badges AND no alerts |
| `src/ui/components/SelectedBasket.tsx` | 3-section basket (want/opt/exclude) above RegexOutput. iter 161. Cap=20 per section. Affix badges ПРЕФ=blue/СУФ=orange/ИМПЛ=amber. | Family-group counters via `countUniqueFamilyKeys` |
| `src/ui/components/RegexOutput.tsx` | Main output. Health bar (green/yellow/red) + overflow + split. iter 164: `.regex-output` (gold border + glow + corner accents) + pulse-on-change animation. iter 167: enhanced empty-state (`.regex-output__empty` dashed border + ↑ arrow + hint). | `prefers-reduced-motion` уважается |
| `src/ui/components/GroupHeader.tsx` | Shared collapsible header. `variant='top'` (L1 affix column) / `'origin'` (L2) / `'sub'` (L3 functional). Chevron via `.group-header-chevron` CSS. | Phase 4: optional `infoTooltip` prop — `ⓘ` glyph as SIBLING (NOT child) of toggle button |
| `src/ui/components/ModList.tsx` + `VirtualizedModList.tsx` | 2-column affix list with L1/L2/L3 hierarchy. L1 collapsed via `collapsedGroups`, L3 via `expandedSubGroups`. L3 default COLLAPSED, L1 default EXPANDED. iter 170 (A4): кнопки «Развернуть/Свернуть все подкатегории» рендерятся условно (collapse-all виден только когда ≥1 L3 expanded; expand-all — только когда ≥1 L3 collapsed). `allSubKeys` computed once via `useMemo`. **iter 174 (KI#52):** при непустом `searchText` вычисляются ЛОКАЛЬНЫЕ `effectiveCollapsedGroups` (= `new Set()`) и `effectiveExpandedSubGroups` (= `new Set(allSubKeys)`) — force-expand всех видимых подкатегорий во время поиска. Store НЕ мутируется → ручное состояние сохраняется при очистке поиска. Кнопки expand/collapse-all скрываются во время поиска. В VirtualizedModList `allSubKeys` moved up до `buildColumnRows` (нужно для effective Sets). | `hideLabel` for L3 when scope has only 1 sub-group (Phase 8c) |
| `src/ui/layout/CategoryLayout.tsx` | 2-col desktop / 1-col mobile shell. Slots: `header`, `controls`, `basket?`, `basketHasContent?` (iter 167 — renders BasketToRegexFlow connector), `regexOutput`, `status?`, `sidebar?`, `mobileBar?`, `children`. | Adopted by ALL 8 category pages |
| `src/ui/components/MobileRegexBar.tsx` | Mobile-only sticky bottom bar. `lg:hidden`. | `.mobile-regex-bar*` CSS rules MUST live inside `@media (max-width: 1023px)` (Pitfall 26) |
| `src/shared/mod-classifier.ts` | 4-level classification: Affix (L1) → Origin (L2) → Semantic (L3) → chip (L4). 11 modes (`affix-semantic`, `affix-functional`, `jewel-functional`, `affix-sentiment-subblocks`, `tablet-type-subblocks`, `relic-semantic`, etc.). `classifyGroups()` + `sortGroupsByMode()` + `ORIGIN_SECTION_LABELS`. | iter 101 CRITICAL: `functionalCategory` field now survives Zod schema (was stripped before) |
| `src/shared/block-sort-rules.ts` | `BLOCK_SORT_RULES` — 18 blocks, 312 family-keys, 100% coverage. `computeSortKey(block, familyKey)`. | iter 112 |
| `src/store/filter-store.ts` | Zustand store. State: `selectedIds`, `excludedIds`, `optionalIds`, `searchText`, `affixFilter`, `originFilter`, `groupMode`, `collapsedGroups`, `expandedSubGroups`, `showSelectedOnly`, `pinnedIds`, `chipExpandState`, `sortMode`, `searchLogic`. URL-сериализация через `url-sync.ts`. | iter 159: `searchLogic: 'and' | 'or' | 'mixed'`, `optionalIds` для MIXED mode |
| `public/` | Static assets: robots.txt, sitemap.xml, 404.html, IndexNow key, Google/Yandex/Bing verification, favicon, og-banner, generated JSONs | Served as-is by GitHub Pages |
| `public/icons/` | Category navigation icons (`waystone.png`, `tablet.png`, `relic.png`, `jewel.png`, `timeless-jewel.png` [iter 178], `vendor.png`, `belt.png`, `ring.png`, `amulet.png`, `logo.png`). All 128×128 RGBA PNG. | Loaded via `import.meta.env.BASE_URL + 'icons/<name>.png'` in TopNav/CategoryLayout. |
| `public/icons/atlas-nodes/` | iter 178: 15 self-hosted `.webp` atlas-node icons (was remote `cdn.poe2db.tw`). ~50 KB total. Referenced from `public/generated/timeless-jewel.json` `iconUrl` field as relative paths `icons/atlas-nodes/X.webp`. | `AtlasNodeList.tsx` prepends `import.meta.env.BASE_URL` for relative paths. Parser `parse-timeless-jewel.ts` auto-downloads new icons via `localizeIconUrl()`. |
| `public/atmosphere/` | PoE2-themed textures: `bg.webp` (body bg), `bg-2x.webp` (divider ornate), hero portraits (`hero-shaman.webp` left, `hero-iva.webp` right), `seo-atmosphere.webp` (SeoBlock backdrop, lg+ only). | All assets actively referenced from JSX or CSS |
| `scripts/` | ETL pipeline (`scripts/etl/`) + prerender (`prerender.ts` / `prerender-full.ts`) + analysis. **НЕ добавлять новые verify-iter*-*.ts** — покрывать через `tests/` (vitest). | `pnpm etl` / `tsx scripts/prerender.ts` / `tsx scripts/prerender-full.ts` |
| `tests/` | Vitest — core/, shared/, etl/, ui/, integration/ | `pnpm test` (2405 passing + 5 KI#53-skipped) |
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
pnpm test                 # Vitest (all tests) — current: 2405 passing + 5 KI#53-skipped
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
15. **TopNav as "modes" (iter 64):** 3-piece chrome (Sidebar + Header + MobileNavTabs) consolidated into single `TopNav.tsx`. Deleted files: `Sidebar.tsx`, `MobileNavTabs.tsx`, `Header.tsx`. Do NOT re-add them. Active state via `.nav-mode-active` CSS class. **iter 173 (KI#51):** `.topnav-tabs` теперь обёрнут в `.topnav-tabs-wrap` (relative, `flex:1`, `overflow:hidden`) с `::before`/`::after` fade-градиентами для scroll affordance. JS трекает scroll-position (`useRef`/`useEffect`/`useState`) и toggles `--can-left`/`--can-right` классы. НЕ возвращать `flex: 1` / `min-width: 0` обратно на `.topnav-tabs` — это сломает wrapper layout. Прямо сейчас `.topnav-tabs` имеет `width: 100%` и скроллится внутри wrap.
16. **StatusPanel iter 140 KI#22 rewrite:** Main summary panel REMOVED (redundant with SelectedBasket). Component accepts `badges` + `alerts` only. `wantTokens`/`excludeTokens`/`allActiveTokens` props kept but ignored.
17. **MobileRegexBar (iter 59):** On mobile (< lg), `RegexOutput` moves to sticky-bottom bar. Desktop unchanged. Double-render tradeoff: `RegexOutput` mounted in BOTH desktop aside AND mobile bar.
18. **ModList L3 auto-suppression (iter 62 Phase 8c):** When a scope has ONLY ONE sub-group, the L3 badge is redundant. `hideLabel?: boolean` prop. Auto-derived from data, not manual flag.
19. **`useCategoryPage` hook architecture:** 3 sub-hooks (`useFilterStore` / `useCategoryData` / `useRegexBuilder`). For pages with extraAstNodes-from-local-state (Waystone/Jewel/Tablet): pass `config.filterStore` + write-back via `useEffect` without `setState`. iter 169 (KI#50): expand/collapse Sets (`expandedSubGroups` / `collapsedGroups` / `chipExpandState`) persist per-category in `poe2:uistate:<categoryId>` localStorage via `readUiState` / `writeUiState` / `clearUiState` / `filterInCategoryKeys` (in `src/store/local-settings.ts`). useState initializer on mount filters cross-category leak from URL (URL hash is shared across categories — amulet's `amulet:prefix:...` keys leak into ring's store but don't match any ring subgroups) and restores from localStorage when no in-category URL keys remain. URL sync effect persists to localStorage on every state change. Same pattern as KI#30 favorites persistence.
20. **4-level hierarchy (актуально для OP-1):** `Affix (L1) → Origin (L2, only when showOriginSubSections=true) → Semantic (L3) → chips (L4)`. iter 164 усилил L2 через `.affix-origin-header`. iter 166 реализовал A2: L3 sub-group рендерится с нейтральными `bg-panel/15 border border-edge/15` + цветным `colorClass` (text-only), а L2 origin сохраняет цветной bg-tint. iter 168 (A1 Вариант B) расширил контраст L1↔L2 corner accents: L1 8×8/0.55, L2 4×4/0.30 (было 6×6/0.4 и 5×5/0.35 — контраст ~12% → ~25%). iter 170 (A4): кнопки «Развернуть/Свернуть все подкатегории» в `ModList.tsx` / `VirtualizedModList.tsx` рендерятся условно — collapse-all виден только когда `expandedSubGroups.size > 0`; expand-all — только когда `expandedSubGroups.size < allSubKeys.length`. `allSubKeys` — `useMemo` (extracted из inline click handler iter 145) с зависимостями от groups/sortMode/showOriginSubSections/showJewelTypeSubGroups/category. L3-режим определяется по наличию `onExpandAllSubGroups` / `onCollapseAllSubGroups` props. Legacy L1-only callers (без sub-group wiring) — кнопки всегда видны, старые generic лейблы. См. `docs/REDESIGN_CONCEPT_v4.md` §9 (зафиксированные решения пользователя).
21. **MIXED mode (iter 158-163):** `searchLogic: 'and' | 'or' | 'mixed'`. 3-state chip (click=want / shift+click=opt / right-click=exclude). `MIXED_OR` AST node + `anchorFirstAltOnly` mitigation (KI#45). `truncateMixedOrLiterals(ast, maxLen=12)` auto-applied when compiled regex > 240 chars (KI#46).
22. **Sort modes (iter 99 + iter 106):** `SortMode = 'alpha' | 'tier-first'`. URL-persistent через `extraState.sortMode`. UI-toggle: `<select>` «Сортировка» в `CategoryControlPanel`. tier-first mode: 4-way tier color dispatch (S=amber-soft / A=amber / B=amber-dim bronze / C=gray). `--bl-amber-dim: #b45309` для B-tier.
23. **Atmospheric CSS primitives:** `.poe-panel-header` (gold filigree rim via `box-shadow: inset`, NOT `border`). `.poe-divider` (1px fading horizontal line, NO vertical margin by default). `.poe-divider--ornate` (8px variant with `bg-2x.webp` texture). `.btn-cta` + success/error/disabled — reserved for primary Copy buttons in `RegexOutput.tsx` only.
24. **CI/CD iter 155 — KI#43:** `actions/deploy-pages` sometimes fails transiently (~6s after Build SUCCESS). Fix: deploy step обёрнут в `Wandalen/wretry.action@v3` (`attempt_limit: 3`, `attempt_delay: 30`). Build SUCCESS + Deploy FAILURE ~6s = transient Pages API error, NOT artifact issue.
25. **Search auto-expand (iter 174 — KI#52):** When `searchText` is non-empty, `ModList.tsx` и `VirtualizedModList.tsx` вычисляют ЛОКАЛЬНЫЕ `effectiveCollapsedGroups` (= `new Set()`) и `effectiveExpandedSubGroups` (= `new Set(allSubKeys)`) — store НЕ мутируется. Эти effective Set'ы передаются во ВСЕ `AffixColumn`/`buildColumnRows` callsites ВМЕСТО raw `collapsedGroups`/`expandedSubGroups`. Кнопки «Развернуть/Свернуть все подкатегории» скрываются во время поиска (`isSearchActive` guard). **ОСТОРОЖНО:** при добавлении нового AffixColumn call site — используй `effectiveCollapsedGroups`/`effectiveExpandedSubGroups`, НЕ raw props. `allSubKeys` в `VirtualizedModList.tsx` вычисляется ДО `buildColumnRows` (moved up iter 174) — не возвращать обратно ниже.
26. **`regexExclude` field (FAQ):** Когда в регексе появляется `"!something"` токен (например `"!100%"`), это **намеренная FP-защита**, не баг. Поле `regexExclude: Record<Locale, string[]>` в `GameToken` (`src/shared/types.ts`) задаётся ETL-пайплайном когда два мода разделяют общую подстроку. AST builder (`category-ast-utils.ts` → `pushLiteralsWithFamilyLogic`) и optimizer (`optimization-strategies.ts`) добавляют EXCLUDE-ноды → компилятор генерирует `"suffix" !"exclude"`. Подробности — в STATUS.md → FAQ.
27. **Atlas regex-семантика ОТЛИЧАЕТСЯ от item-семантики (iter 175 VERIFIED IN-GAME):** На древе атласа **multi-word OR работает** (`"А Б\|В Г"` ✅), но **AND не работает** (`"А" "Б"` = 0 matches ❌) и **NOT не работает** (`"!А\|Б"` подсвечивает ВСЕ ноды ❌). Substring / quoted phrase / `.*` bridge / case-insensitive — всё работает ✅. Единственная рабочая логика для Atlas — **OR** (подсветить любые ноды, содержащие ЛЮБОЕ из перечисленных названий). Это критично для планируемой категории `/timeless-jewel` (`docs/ATLAS_JEWEL_PLAN.md`) — она НЕ может использовать существующий regex-engine (завязан на AND/NOT/ranges). Нужен отдельный упрощённый `buildAtlasRegex()` (iter 176+). См. STATUS.md → «Atlas-семантика».
28. **Atlas Timeless Jewel — ОТДЕЛЬНЫЙ pipeline (iter 176, iter 178 polish):** Категория `/timeless-jewel` НЕ использует `useCategoryPage`, `filter-store`, `compiler.ts`, `optimizer.ts`, `ast.ts` или `ModList`/`VirtualizedModList`. Причины: (1) Atlas-семантика OR-only (см. pitfall #27) — существующий engine заточен под AND/NOT/ranges; (2) `GameToken` schema избыточна (нет ranges/familyKey/affix/genderForms). Используются: `AtlasNodeToken` (новый минимальный тип), `atlas-jewel-loader.ts` (отдельный loader), `atlas-regex-builder.ts` (новый `buildAtlasRegex()` — OR-only + alphabetical sort + dedupe + overflow split), `AtlasNodeList` (новый компонент — плоский список с чекбоксами/иконками/описаниями), `TimelessJewelPage` (новая страница). Переиспользуется только `RegexOutput` (props `filterStore` передаётся как `null` — share-кнопка disabled) и `MobileRegexBar` (iter 178 — sticky-bottom на mobile, regexOutput передаётся как prop, два отдельных RegexOutput instance'а). **iter 178:** (a) иконка навигации `jewel` → `timeless-jewel` (отдельный `public/icons/timeless-jewel.png` 128×128 RGBA — пользовательская, залитая в commit `8143975`); (b) title `Особые самоцветы` → `Вневременные самоцветы`; (c) 15 atlas-node иконок self-hosted в `public/icons/atlas-nodes/` (был remote CDN `cdn.poe2db.tw`), `iconUrl` в `timeless-jewel.json` теперь локальные (`icons/atlas-nodes/X.webp`); (d) `AtlasNodeTokenSchema.iconUrl` принимает и http(s) URL, и относительные пути `icons/...` через `.refine()`; (e) `AtlasNodeList.tsx` резолвит относительные пути через `import.meta.env.BASE_URL`; (f) парсер `parse-timeless-jewel.ts` автоматически скачивает новые иконки в `public/icons/atlas-nodes/` через helper `localizeIconUrl()` (idempotent, fallback на remote URL при 403); (g) `/timeless-jewel` добавлен в `scripts/prerender.ts` (routes + navLinks) и `public/sitemap.xml`. При модификации `/timeless-jewel` — НЕ трогать `/jewel` и наоборот. Парсер данных — отдельный скрипт `scripts/etl/parse-timeless-jewel.ts` (НЕ в `run-etl.ts`).
29. **KI#53 (iter 177, ЗАКРЫТ):** ETL-обновление `2d48349` регрессировало данные двумя путями: (1) 4 tablet-токена (KI#12-pattern, single-# template + ## sibling) получили tier-hardcoded regex — пофикшено 4 override'ами в `scripts/etl/i18n-overrides.json` (см. `tablet.mod_od9m77.f2md77`, `tablet.mod_xhncu6.yctrln`, `tablet.mod_as23xk.63l845`, `tablet.mod_as23xk.ckza9l`); (2) 7 relic-токенов из iter 127 KI#12 fix пропали из `relic.json` (poe2db.tw убрал эти моды) — SECTIONS 1+2 `iter127-ki12-tier-hardcoded-regex.test.ts` обёрнуты в `describe.skipIf(KI53_RELIC_TOKENS_MISSING)` (synchronous check via `relicTokensExistSync()`). SECTION 6 (audit) остаётся активным — это каноническая регрессионная защита. 7 relic overrides в `i18n-overrides.json` сейчас no-ops — можно удалить в будущем iter. **При следующем ETL-обновлении:** 4 tablet override'а автоматически применятся через `applyI18nOverrides()` — повторная регрессия исключена.
30. **KI#54 (iter 180, ЗАКРЫТ):** iter 178 regression — при добавлении `/timeless-jewel` в `scripts/prerender.ts` (shell) и `public/sitemap.xml` забыли добавить тот же route в два других места: (a) `scripts/prerender-full.ts` — массив `routes[]` (Playwright full-prerender), из-за чего `/timeless-jewel` НЕ получал React-контент в `#root` для краулеров; (b) `.github/workflows/deploy.yml` → `indexnow` job → `urlList` — IndexNow НЕ уведомлял Bing/Яндекс о новом URL при деплое. Fix iter 180: добавлен в оба места. **Берегись при добавлении новых routes:** обновлять ОДНОВРЕМЕННО 4 места — `scripts/prerender.ts` (routes[] + navLinks[]), `scripts/prerender-full.ts` (routes[]), `public/sitemap.xml`, `.github/workflows/deploy.yml` (IndexNow urlList).

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

**Level 1 (`scripts/prerender.ts`):** Generates 10 route-specific HTML files (iter 178: +1 for `/timeless-jewel`) with unique meta tags + `<noscript>` fallback. Pure string manipulation. Runs automatically after `vite build`. iter 180: home `<title>` сокращён 80→58 chars, `meta keywords` удалён из `index.html`.

**Level 2 (`scripts/prerender-full.ts`):** Playwright + headless Chromium renders React content into `<div id="root">`. Graceful: if Playwright not installed, falls back to Level 1. **iter 180 — KI#54 fix:** `/timeless-jewel` добавлен в `routes[]` (был missing iter 178 regression).

**CI build flow:** `tsc -b → vite build → prerender.ts (shell) → prerender-full.ts (Playwright) → deploy + IndexNow`
**Local build flow:** `tsc -b → vite build → prerender.ts (shell only)`

**⚠️ При добавлении нового route:** обновлять ОДНОВРЕМЕННО 4 места (см. pitfall #30 — KI#54):
1. `scripts/prerender.ts` (routes[] + navLinks[])
2. `scripts/prerender-full.ts` (routes[])
3. `public/sitemap.xml`
4. `.github/workflows/deploy.yml` (IndexNow urlList)

## 11. SEO Assets (public/)

| File | Purpose |
|------|---------|
| `robots.txt` | Allow /, ссылка на sitemap. **Ограничение:** на project page доступен только по `/poe2-regex-ru/robots.txt`, не в корне хоста — см. `docs/SEO_GROWTH_PLAN.md` |
| `sitemap.xml` | 10 URL с lastmod и priority (iter 178: +`/timeless-jewel`) |
| `404.html` | SPA-редирект + `<meta name="robots" content="noindex, follow">` |
| `7cf0e35e568e2791d08835cdbd1d8a97.txt` | IndexNow API key |
| `googled4deeaff5bba3bb2.html` | GSC верификация |
| `yandex_227088c0d89586c7.html` | Яндекс Вебмастер верификация |
| `og-banner.png` | Open Graph image (1200x630) |
| `favicon.svg` | Favicon |

**iter 180 SEO changes:**
- `index.html`: `<title>` 80→58 chars (keyword forward «Path of Exile 2»), удалён `meta keywords`, обновлён `meta description` (+синонимы «лут-фильтр», «аффиксы и моды»), добавлен `FAQPage` JSON-LD (6 Q&A), обновлён `WebApplication` JSON-LD (9 категорий, `featureList`).
- `src/ui/pages/home/SeoBlock.tsx`: добавлена FAQ-секция (6 вопросов, соответствует FAQPage JSON-LD), синонимы в основном тексте.
- `docs/SEO_PLAN.md` + `docs/SEO_GROWTH_PLAN.md` (новый): технические шаги — DONE; ручные шаги — pending.

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
| `nav.github` | GitHub | TopNav right-side link to repository (lg+, iter 173). |
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
| `docs/SEO_PLAN.md` | On SEO workflow changes. iter 180: технические шаги DONE, ручные — pending. |
| `docs/SEO_GROWTH_PLAN.md` | iter 180 — единый план роста (REPO / MANUAL / DEFERRED buckets). |
| `docs/UI_AUDIT.md` | UI-аудит v2 (iter 110) — reference, read-only |
| `docs/UI_REFACTOR_PLAN.md` | iter 137 — 7 фаз UI-рефакторинга. All DONE. |
| `docs/REDESIGN_CONCEPT_v4.md` | iter 165 — концепт-спецификация редизайна (реализован в iter 166-170). Reference only. |
| `docs/ATLAS_JEWEL_PLAN.md` | iter 175–178 — план + реализация категории `/timeless-jewel`. iter 178 DONE (rename + иконка + MobileRegexBar + SEO + self-host icons). iter 179 DONE (README + docs cleanup). iter 180+ — state-features (URL-sync, profile, SelectedBasket). |
| `worklog.md` | Every iteration — append new Task ID section |

**Удалены в iter 179 cleanup** (DONE/superseded): `ITER142_PROPOSALS.md`, `ITER148_TOOLBAR_REFACTOR.md`, `REDESIGN_CONCEPT_v3.md` (superseded by v4), `AFFIX_ORDERING_PLAN.md`.
