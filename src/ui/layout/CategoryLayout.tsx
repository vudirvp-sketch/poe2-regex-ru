/**
 * CategoryLayout — 2-column desktop / 1-column mobile shell for category pages.
 *
 * Layout:
 * - Header (icon + title + count) — full width on top
 * - Desktop (lg+): grid [1fr 380px]
 *     • Left column:  CategoryControlPanel (controls, no RegexOutput) + ModList
 *     • Right column: RegexOutput + status block + ProfilePanel (sticky)
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
 * When `mobileBar` is NOT provided (backward compat): the aside is visible
 * on all viewports, no mobile-specific sections are rendered.
 *
 * Usage (Phase 7):
 *   <CategoryLayout
 *     header={...}
 *     controls={<CategoryControlPanel ... />}
 *     regexOutput={<RegexOutput ... />}
 *     status={<StatusPanel ... />}
 *     sidebar={<ProfilePanel ... />}
 *     mobileBar={<MobileRegexBar regexOutput={<RegexOutput ... />} alerts={[...]} />}
 *   >
 *     <ModList ... />
 *   </CategoryLayout>
 */
import React from 'react';

interface CategoryLayoutProps {
  /** Page header content (icon, title, mod count) — full width top */
  header: React.ReactNode;
  /** Left column controls. Use <CategoryControlPanel hideRegexOutput /> here. */
  controls: React.ReactNode;
  /** Right column RegexOutput (sticky on desktop via <aside>). */
  regexOutput: React.ReactNode;
  /** Right column status block (selected/excluded summary). Below RegexOutput. */
  status?: React.ReactNode;
  /** Right column sidebar (ProfilePanel). Below status. */
  sidebar?: React.ReactNode;
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
  controls,
  regexOutput,
  status,
  sidebar,
  mobileBar,
  children,
}: CategoryLayoutProps) {
  // Phase 7: when mobileBar is provided, aside is desktop-only and we add
  // a separate mobile section for status + sidebar so they stay accessible.
  const hasMobileBar = Boolean(mobileBar);

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* iter 65: ornate gold filigree divider between the page header and the
          2-column grid (or single column on mobile). Purely decorative — the
          flex `gap-4` provides the vertical gutter; .poe-divider--ornate is
          height 8px + 0 margin so spacing stays predictable. */}
      <hr className="poe-divider--ornate" aria-hidden="true" />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
        {/* Left column: controls + main content (ModList). Scrolls naturally. */}
        <div className="flex flex-col gap-4 min-w-0">
          {controls}
          {children}
        </div>

        {/* Right column: RegexOutput (sticky) + status + sidebar.
            Phase 7: when mobileBar is provided, aside is desktop-only. */}
        <aside
          className={`flex flex-col gap-3 ${RIGHT_COL_STICKY_CLASS} ${
            hasMobileBar ? 'hidden lg:flex' : ''
          }`}
        >
          {regexOutput}
          {status}
          {sidebar}
        </aside>
      </div>

      {/* Phase 7: mobile-only section for status + sidebar (kept accessible
          when aside is hidden on mobile). */}
      {hasMobileBar && (status || sidebar) && (
        <div className="flex flex-col gap-3 lg:hidden">
          {status}
          {sidebar}
        </div>
      )}

      {/* Phase 7: mobile-only sticky bottom bar (typically MobileRegexBar
          with RegexOutput + alerts). Hidden on desktop. */}
      {hasMobileBar && mobileBar}
    </div>
  );
}
