# Worklog

> Только последняя итерация подробно. Старые — одной строкой. Полная история — в git.

---

Task ID: 140
Agent: main
Task: UI iter 140 — 4 UI bug fixes по feedback пользователя (KI#21, KI#22, KI#24, KI#25) + KI#23 documented as monitoring. Пользователь после iter 139 сообщил о 4 новых UX-проблемах: (1) дублируются иконки в легенде (★ ★ — в избранное); (2) старый блок «Выбрано: N аффикс(ов)» с truncated token list дублирует новый SelectedBasket; (3) при скролле в некоторых вкладках «двоятся»/дрожат названия категорий и аффиксы; (4) полностью пропал блок «избранное» (хотя кнопки ★ на chips остались); (5) непонятный show-selected-only toggle. Все 5 задокументированы как KI#21-25 ПЕРЕД фиксом (per project rule). Главные ограничения: лучше недоделать, чем сломать; если найден новый баг — сначала документируй в STATUS.md.

Work Log:
- 1: Репозиторий клонирован (https://github.com/vudirvp-sketch/poe2-regex-ru.git). Baseline проверки: vitest 2165/2165 (50 test files), tsc 0, eslint 0 — состояние iter 139 подтверждено.
- 2: VLM-анализ скриншота пользователя (`/home/z/my-project/upload/Снимок экрана 2026-06-27 055742.jpg`) через z-ai vision CLI. Скриншот показывает IDEAL placement: page header with icon + title + mod count + «★ Избранные аффиксы 3» на правой стороне; ниже search bar + filter chips + sort/filter buttons row.
- 3: Прочитан `STATUS.md` (iter 139 state). Identified 5 конкретных bug reports в user message.
- 4: Прочитан `AGENT_NAVIGATION.md` Pitfall 49 (iter 139 patterns: CSS overflow fix, reverting feature, sticky pitfall, removing slot prop, document-before-fix rule). Понятен паттерн: при revert'е feature оставлять props в API как no-op для backward compat.
- 5: Прочитаны ключевые компоненты: `IconLegend.tsx` (renders `<span class="icon-legend__icon">{icon}</span>` + `<span>{t(textKey)}</span>`), `StatusPanel.tsx` (renders main summary panel + badges + alerts), `SelectedBasket.tsx` (renders «Выбрано: N афф.» + chips at top of right aside), `CategoryLayout.tsx` (3-col grid с aside + legend slots), `CategoryControlPanel.tsx` (show-selected-only radio без tooltip).
- 6: Прочитан `src/shared/i18n.ts` — confirmed `legend.star: '★ — в избранное'` (icon prefix ВНУТРИ i18n строки). IconLegend компонент ALSO renders icon separately → double icon. ROOT CAUSE identified.
- 7: Прочитан `src/ui/pages/belt/BeltPage.tsx` — confirmed `StatusPanel wantTokens excludeTokens allActiveTokens` props (legacy summary) + `SelectedBasket` (new basket). Оба рендерятся в правой колонке: SelectedBasket вверху, StatusPanel ниже RegexOutput. DUPLICATE visualization confirmed.
- 8: Прочитан `src/ui/components/VirtualizedModList.tsx` — confirmed `useVirtualizer` + `measureElement` + ROW_ESTIMATES (subgroup=60px). ROOT CAUSE scroll jitter: estimate ≠ actual size → ResizeObserver fires → totalSize shifts → rows jump. Per project rule, deferred to iter 141+.
- 9: **STATUS.md updated FIRST** (per project rule) — добавлены 5 новых Known Issues KI#21-25 с описанием + fix plan. Только ПОСЛЕ этого начаты фиксы.
- 10: **KI#21 fix** — `src/shared/i18n.ts`: `legend.star: '★ — в избранное'` → `'в избранное'`; `legend.exclude: '✗ — исключить аффикс (не хочу)'` → `'исключить аффикс (не хочу)'`; `legend.info: 'ⓘ — наведите для подсказки'` → `'наведите для подсказки'`. Comment block добавлен explaining the duplication root cause. Tests updated: `tests/ui/IconLegend.test.tsx` — text assertions обновлены + NEW test «renders each icon EXACTLY ONCE» (counts ★/✗/ⓘ occurrences in DOM, asserts each === 1).
- 11: **KI#22 fix** — `src/ui/components/StatusPanel.tsx` полностью переписан. Main summary panel («Выбрано: N аффикс(ов)» + «Включить: ...» truncated token list) REMOVED. Component renders ТОЛЬКО `badges` + `alerts`. Props `wantTokens`/`excludeTokens`/`allActiveTokens` остаются в interface для backward compat (destructured as `_wantTokens`/`_excludeTokens`/`_allActiveTokens`, ignored at render time). Returns `null` when no badges AND no alerts. 7 category pages не трогались (props продолжают пробрасываться — backward compat).
- 12: NEW `tests/ui/StatusPanel.test.tsx` — 6 tests: (a) returns null when no badges/alerts (even with wantTokens); (b) renders badges row; (c) renders alerts; (d) renders both; (e) backward compat: legacy props accepted but ignored; (f) explicit empty arrays → null.
- 13: **KI#24 fix** — NEW `src/ui/components/FavoritesIndicator.tsx`. Compact `★ N` badge for page headers. Returns `null` when `pinnedIds.size === 0`. `role="status"` + `aria-label` with count. ★ glyph `aria-hidden`. Added to all 7 category pages: `BeltPage`, `RingPage`, `AmuletPage`, `JewelPage`, `WaystonePage`, `TabletPage`, `RelicPage`. Header pattern: `<div className="flex items-center gap-2"><span>{count} аффиксов</span><FavoritesIndicator pinnedIds={pinnedIds} /></div>`.
- 14: NEW `tests/ui/FavoritesIndicator.test.tsx` — 5 tests: (a) empty returns null; (b) renders ★ + label + count; (c) aria-label includes count; (d) count updates on prop change; (e) shrink-to-empty returns null again.
- 15: **KI#25 fix** — `src/ui/components/CategoryControlPanel.tsx`: added `title={t('filter.show_mode_hint')}` + `aria-label={t('filter.show_mode_hint')}` на outer wrapper div show-selected-only radio toggle. NEW i18n key `filter.show_mode_hint` = «Показывать все аффиксы или только выбранные, исключённые и избранные».
- 16: tsc -b — 0 errors.
- 17: eslint — initially 3 warnings (Unused eslint-disable directives в StatusPanel). Fixed: removed `eslint-disable-next-line @typescript-eslint/no-unused-vars` lines (TS understands `_` prefix convention without disable directive). Final eslint: 0 problems 0 warnings.
- 18: Full vitest run — 2177/2177 (52 test files). Был 2165 → +12 net (5 new FavoritesIndicator + 6 new StatusPanel + 1 new IconLegend no-duplication test). tsc 0, eslint 0.
- 19: Documentation updated:
    - `STATUS.md` — rewritten чисто для iter 140: iter 139 сжат в 1 строку в Closed KI; iter 140 deliverables подробно (4 KI fixes + 1 monitoring); KI#23 (scroll jitter) added as Known Issue #13 with root cause + 3 possible solutions; Next iteration (iter 141) priorities: UX verification + KI#23 virtualization fix.
    - `worklog.md` — this entry. iter 139 сжат в 1 строку в «Предыдущие итерации».
    - `AGENT_NAVIGATION.md` — header updated (iter 139 → iter 140), Pitfall 50 NEW (iter 140 — 4 UI bug fixes KI#21-25: i18n icon prefix footgun, removing redundant panel pattern, compact indicator pattern, role="status" for live count badges, native title attribute tooltip, monitoring Known Issue as valid outcome).
    - `docs/UI_REFACTOR_PLAN.md` — Phase Status table updated (iter 140 KI#21-25 added).

Stage Summary:
- **iter 140: 4 UI bug fixes (KI#21, 22, 24, 25) + KI#23 monitoring — завершено.**
- KI#21: Duplicate icons in IconLegend → FIXED (removed icon prefix from i18n strings; IconLegend renders icon separately as styled span).
- KI#22: Redundant «Выбрано» block → FIXED (StatusPanel rewritten to render ONLY badges + alerts; summary panel removed; legacy props kept as `_`-prefixed for backward compat).
- KI#23: Scroll jitter в virtualized lists → MONITORING (root cause: TanStack Virtual measureElement + ResizeObserver estimate/actual size mismatch; deferred to iter 141+ per project rule «лучше недоделать, чем сломать»).
- KI#24: Favorites block пропал → FIXED (NEW FavoritesIndicator component: compact `★ N` badge in page header; added to all 7 category pages).
- KI#25: Show-selected-only toggle непонятен → FIXED (added `title` + `aria-label` tooltip via native HTML attribute; NEW i18n key `filter.show_mode_hint`).
- Tests: vitest 2165→2177 (+12 net), tsc 0, eslint 0. NEW `tests/ui/FavoritesIndicator.test.tsx` (5 tests). NEW `tests/ui/StatusPanel.test.tsx` (6 tests). UPDATED `tests/ui/IconLegend.test.tsx` (+1 no-duplication test).
- All 5 KI added to STATUS.md BEFORE fixes (per project rule «Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий»).
- Backward compat preserved: StatusPanel legacy props kept (ignored at render); `LeftPanelFavorites` component file stays; `favorites` slot in CategoryLayout stays (optional, no-op when passed).
- UX verification user task (iter 140 deliverables) остаётся открытой — KI#21/22/24/25 fixes требуют in-browser verification пользователем.
- Next agent (iter 141): UX verification feedback от user (если придёт), либо KI#23 virtualization fix (требует careful testing — static heights OR improved estimateSize OR CSS Grid virtualization), либо другое optional enhancement из §13.6. Если найден новый баг — сначала документируй в STATUS.md как Known Issue, потом фиксий. KI#9 + KI#23 — monitoring.

---

## Предыдущие итерации (кратко)

- **iter 139**: UI iter 139 — 5 UI bug fixes (KI#16-20) по feedback пользователя. Right aside overflow, prefix/suffix 50/50, chip truncation reverted, non-sticky search, LeftPanelFavorites removed. 2163→2165 tests.
- **iter 138**: UI Refactor iter 138 — `--strong` modifier wiring на `.affix-header-*` в tier-first mode (optional enhancement, CSS готов с iter 137). Wiring в ModList.tsx + VirtualizedModList.tsx. 5 new tests. 2158→2163 tests.
- **iter 137**: UI Refactor Phase 4 + Phase 4.5 — stronger bg tints + compact chip density + portal Tooltip + IconLegend. 2124→2158 tests.
- **iter 136**: UI Refactor Phase 5 — favorites in left panel (LeftPanelFavorites) + ⭐ pin slot on FilterChip + click-to-scroll + favorite-pulse CSS. 2099→2124 tests.
- **iter 135**: UI Refactor Phase 3 — show-selected-only toggle + SelectedBasket panel (cap=20) + collapsible right aside. 2079→2099 tests.
- **iter 134**: UI Refactor Phase 2.5 — «+N ещё» per-sub-group chip expander. Selected/excluded/pinned chips ВСЕГДА видимы в truncated состоянии. `CHIP_PREVIEW_COUNT = 3`. 2070→2079 tests. **iter 139: REVERTED** (KI#18).
- **iter 133**: UI Refactor Phase 2 — collapsible affix groups (top-level + sub-group) + sticky search + expand/collapse-all кнопки. 2034→2070 tests. **iter 139: sticky search reverted** (KI#19).
- **iter 132**: UI Refactor Phase 1 — FilterState foundation (5 полей + 13 actions + URL sync). 1988→2034 tests.
- **iter 131**: incorporate user feedback (4 corrections) в UI Refactor Plan — Search→Favorites→Filters order, 20%/60%/20% + collapsible right panel, basket cap 20, top-expanded/sub-collapsed default. Без реализации. 1988/1988 tests.
- **iter 130**: review плана UI-рефакторинга против пользовательской визуализации (без реализации). VLM-анализ mockup через z-ai vision → создан `docs/UI_VISUALIZATION_AUDIT.md`. `docs/UI_REFACTOR_PLAN.md` обновлён: +§13 Visualization Audit, +Phase 2.5, +Phase 4.5, Phase 5 RESTRUCTURED. 1988/1988 tests, tsc 0, eslint 0.
- **iter 129**: cleanup dead BTS-related regex patterns + KI#7/KI#8 VERIFIED + UI Refactor Plan. 1992→1988 tests.
