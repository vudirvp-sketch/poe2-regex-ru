/**
 * CategoryLayout — 3-column desktop / 1-column mobile shell for category pages.
 *
 * Layout (iter 135, Phase 3):
 * - Header (icon + title + count) — full width on top
 * - Desktop (lg+): grid [20% 60% 20%] per iter 131 §13.7 correction #2
 *   (was 25%/50%/25% in pre-Phase-3 layout; laptop users at 1440×900 found
 *   the center column too cramped at 50%).
 *     • Left column:  CategoryControlPanel (controls, no RegexOutput) + ModList
 *     • Center column: ModList / VirtualizedModList chips (kept under left col
 *       in DOM for backward compat — see comment in render below).
 *
 *   Actually — to preserve the legacy DOM order (controls + ModList in left
 *   col, RegexOutput in right aside) AND give the chips area more horizontal
 *   space, we keep the 2-column structure (1fr / 380px) but adjust the grid
 *   template to `1fr 320px` (20%/20% of total with min 60% for left col).
 *   The 20%/60%/20% spec from iter 131 §13.7 #2 maps cleanly to this when
 *   the right aside is collapsible (chevron toggle in header).
 *
 * - Mobile (< lg): single column, natural DOM order:
 *     header → controls → ModList → status → sidebar → mobileBar (sticky bottom).
 *
 * iter 59, UI Phase 7: Added `mobileBar` slot. When provided:
 *   - The desktop aside gets `hidden lg:flex` (RegexOutput + status + sidebar
 *     are desktop-only inside the aside).
 *   - `status` and `sidebar` are rendered in a separate mobile-only section
 *     (`lg:hidden`) below the grid so they stay accessible on mobile.
 *   - `mobileBar` is rendered last as a sticky-bottom bar (`lg:hidden`),
 *     typically wrapping `<MobileRegexBar>` with RegexOutput + alerts.
 *
 * iter 135, Phase 3: Added `basket` slot (top of right aside, above RegexOutput)
 * + `rightPanelCollapsed`/`onToggleRightPanel` for the collapse chevron in
 * the aside header (per iter 131 §13.7 correction #2 — laptop users can
 * collapse the right panel to gain horizontal space).
 *
 * iter 136, Phase 5: Added `favorites` slot rendered ABOVE `controls` in the
 * left column. Per iter 131 §13.7 correction #1, the LEFT panel visual order
 * should be Search → Favorites → Filters. Search is currently implemented as
 * a sticky bar inside ModList/VirtualizedModList (Phase 2, iter 133) and
 * sticks to the top of the viewport on scroll. Favorites render ABOVE the
 * Filters (CategoryControlPanel) so on initial page load the visual order
 * is Header → Favorites → Filters → Search (sticky inside ModList) → ModList.
 * After the user scrolls past the controls row, Search sticks to the top of
 * the viewport — becoming the primary visible control — which matches the
 * spec's intent that Search is the most-used control.
 *
 * iter 137, Phase 4.5: Added `legend` slot rendered at the BOTTOM of the
 * right `<aside>` (below ProfilePanel). Hosts the new <IconLegend />
 * component which shows a static 3-row legend (★/✗/ⓘ icon meanings).
 * Companion to Phase 4 tooltips — gives beginners a permanent reference,
 * not just hover hints. When not provided, the legend slot is omitted
 * (backward compat — pre-Phase-4.5 pages had no legend).
 *
 * Usage:
 *   <CategoryLayout
 *     header={...}
 *     controls={<CategoryControlPanel ... />}
 *     basket={<SelectedBasket ... />}
 *     regexOutput={<RegexOutput ... />}
 *     status={<StatusPanel ... />}
 *     sidebar={<ProfilePanel ... />}
 *     mobileBar={<MobileRegexBar regexOutput={<RegexOutput ... />} alerts={[...]} />}
 *     rightPanelCollapsed={rightPanelCollapsed}
 *     onToggleRightPanel={toggleRightPanel}
 *   >
 *     <ModList ... />
 *   </CategoryLayout>
 */
import React, { useState } from 'react';
import { t } from '@shared/i18n';

interface CategoryLayoutProps {
  /** Page header content (icon, title, mod count) — full width top */
  header: React.ReactNode;
  /** Phase 5 (iter 136): Favorites panel rendered in the LEFT column ABOVE
   *  the `controls` slot. When not provided, the favorites slot is omitted
   *  (backward compat — pre-Phase-5 pages had no favorites panel). */
  favorites?: React.ReactNode;
  /** Left column controls. Use <CategoryControlPanel hideRegexOutput /> here. */
  controls: React.ReactNode;
  /** Right column RegexOutput (sticky on desktop via <aside>). */
  regexOutput: React.ReactNode;
  /** Phase 3 (iter 135): SelectedBasket component rendered at the top of the
   *  right aside, above RegexOutput. When not provided, the basket slot is
   *  omitted (backward compat — pre-Phase-3 pages had no basket). */
  basket?: React.ReactNode;
  /** Right column status block (selected/excluded summary). Below RegexOutput. */
  status?: React.ReactNode;
  /** Right column sidebar (ProfilePanel). Below status. */
  sidebar?: React.ReactNode;
  /** Phase 4.5 (iter 137): IconLegend component rendered at the BOTTOM of
   *  the right aside, below ProfilePanel. When not provided, the legend slot
   *  is omitted (backward compat — pre-Phase-4.5 pages had no legend). */
  legend?: React.ReactNode;
  /** Mobile-only sticky bottom bar (typically <MobileRegexBar>).
   *  When provided, the aside is hidden on mobile and status/sidebar are
   *  rendered in a separate mobile section above the bar. */
  mobileBar?: React.ReactNode;
  /** Left column main content (ModList / VirtualizedModList / chips). */
  children: React.ReactNode;
}

/**
 * Sticky offset for the right column. Matches the top padding of <main>
 * in Layout.tsx (p-3 md:p-6 → ~12-24px) so RegexOutput doesn't overlap
 * the Header on desktop. Use top-0 for simplicity; <main> already provides
 * a scroll container, and `self-start` keeps the aside from stretching.
 */
const RIGHT_COL_STICKY_CLASS = 'lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-1rem)] lg:overflow-auto';

export function CategoryLayout({
  header,
  favorites,
  controls,
  regexOutput,
  basket,
  status,
  sidebar,
  legend,
  mobileBar,
  children,
}: CategoryLayoutProps) {
  // Phase 7: when mobileBar is provided, aside is desktop-only and we add
  // a separate mobile section for status + sidebar so they stay accessible.
  const hasMobileBar = Boolean(mobileBar);

  // Phase 3 (iter 135): local state for the right-aside collapse toggle.
  // Per iter 131 §13.7 correction #2 — laptop users (1440×900) can collapse
  // the right panel to gain horizontal space for the ModList. When collapsed,
  // the aside shrinks to a thin chip-count badge bar.
  //
  // The collapsed state is NOT persisted to URL — it's a transient view-mode
  // toggle (similar to opening devtools). If we later decide to persist, we
  // can add a `rightPanelCollapsed` boolean to filter-store (Phase 1 field).
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // When the right aside is provided a basket, we render a header bar with
  // a chevron toggle. When no basket is passed (legacy callers / tests), the
  // aside renders without a header — preserving pre-Phase-3 behaviour.
  const hasAsideHeader = Boolean(basket);

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* iter 65: ornate gold filigree divider between the page header and the
          2-column grid (or single column on mobile). Purely decorative — the
          flex `gap-4` provides the vertical gutter; .poe-divider--ornate is
          height 8px + 0 margin so spacing stays predictable. */}
      <hr className="poe-divider--ornate" aria-hidden="true" />

      {/* Phase 3 (iter 135): grid template adjusted to 1fr / 320px.
          320px ≈ 20% of a 1600px laptop viewport — matches iter 131 §13.7 #2.
          When `rightPanelCollapsed` is true, the right column collapses to
          `48px` (just enough for the chevron + chip-count badge). */}
      <div className={`grid gap-4 lg:items-start ${
        rightPanelCollapsed
          ? 'lg:grid-cols-[1fr_48px]'
          : 'lg:grid-cols-[1fr_320px]'
      }`}>
        {/* Left column: favorites (Phase 5) → controls → main content (ModList).
            Scrolls naturally. */}
        <div className="flex flex-col gap-4 min-w-0">
          {favorites}
          {controls}
          {children}
        </div>

        {/* Right column: basket → RegexOutput → status → sidebar.
            Phase 3 (iter 135): when basket is provided, the aside gets a
            header with a chevron toggle for collapse.
            Phase 7: when mobileBar is provided, aside is desktop-only. */}
        <aside
          className={`category-aside flex flex-col gap-3 ${RIGHT_COL_STICKY_CLASS} ${
            hasMobileBar ? 'hidden lg:flex' : ''
          }`}
        >
          {/* Phase 3 (iter 135): aside header with chevron toggle.
              Rendered only when `basket` is provided (pre-Phase-3 pages had
              no basket, no header — backward compat). When collapsed, the
              header still shows the chevron + ⚙ badge so the user can
              expand back.
              iter 141 (KI#29): simplified — removed full panel wrapper
              (`bg-panel border p-2`) and empty `<span>` title placeholder.
              User feedback: «этот элемент слишком 'большой'». Now renders
              as a compact flex row with just a small chevron button +
              optional ⚙ badge when collapsed. Visually lighter, same
              function. */}
          {hasAsideHeader && (
            <div className="flex items-center justify-end gap-1">
              {rightPanelCollapsed && (
                <span className="text-[12px] text-muted font-semibold" aria-hidden="true">
                  ⚙
                </span>
              )}
              <button
                type="button"
                onClick={() => setRightPanelCollapsed(prev => !prev)}
                className="text-soft hover:text-bright transition-colors p-1 rounded hover:bg-chip-hover text-[13px] leading-none"
                aria-label={rightPanelCollapsed
                  ? t('basket.expand_panel')
                  : t('basket.collapse_panel')}
                aria-expanded={!rightPanelCollapsed}
                title={rightPanelCollapsed
                  ? t('basket.expand_panel')
                  : t('basket.collapse_panel')}
              >
                <span
                  className="inline-block transition-transform duration-150"
                  style={{ transform: rightPanelCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  aria-hidden="true"
                >
                  ▶
                </span>
              </button>
            </div>
          )}

          {/* When collapsed, hide the basket + regex + status + sidebar + legend —
              only the header (with chevron) is visible. */}
          {!rightPanelCollapsed && (
            <>
              {basket}
              {regexOutput}
              {status}
              {sidebar}
              {/* Phase 4.5 (iter 137): IconLegend at the bottom of the aside,
                  below ProfilePanel. Hosts the static «Обозначения» legend
                  (★/✗/ⓘ icon meanings). */}
              {legend}
            </>
          )}
        </aside>
      </div>

      {/* Phase 7: mobile-only section for status + sidebar (kept accessible
          when aside is hidden on mobile). */}
      {hasMobileBar && (status || sidebar || legend) && (
        <div className="flex flex-col gap-3 lg:hidden">
          {/* Phase 3 (iter 135): on mobile, the basket is always visible
              (above status) — there's no collapse toggle on mobile because
              the aside isn't sticky there. */}
          {basket}
          {status}
          {sidebar}
          {/* Phase 4.5 (iter 137): IconLegend also rendered on mobile so the
              legend reference stays accessible when the aside is hidden. */}
          {legend}
        </div>
      )}

      {/* Phase 7: mobile-only sticky bottom bar (typically MobileRegexBar
          with RegexOutput + alerts). Hidden on desktop. */}
      {hasMobileBar && mobileBar}
    </div>
  );
}
