/**
 * CategoryLayout — 2-column desktop / 1-column mobile shell for category pages.
 *
 * Layout (iter 52, UI redesign Phase 2):
 * - Header (icon + title + count) — full width on top
 * - Desktop (lg+): grid [1fr 380px]
 *     • Left column:  CategoryControlPanel (controls, no RegexOutput) + ModList
 *     • Right column: RegexOutput + status block + ProfilePanel (sticky)
 * - Mobile (< lg): single column, natural DOM order:
 *     header → controls → ModList → regexOutput → status → sidebar.
 *   Phase 7 will move RegexOutput to a sticky bottom-bar on mobile.
 *
 * Non-breaking: pages that don't use CategoryLayout continue to render
 * <CategoryControlPanel> (with embedded RegexOutput, sticky) as before.
 *
 * Usage (pilot — WaystonePage):
 *   <CategoryLayout
 *     header={...}
 *     controls={<CategoryControlPanel hideRegexOutput ... />}
 *     regexOutput={<RegexOutput ... />}
 *     status={<StatusBlock/>}
 *     sidebar={<ProfilePanel ... />}
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
  children,
}: CategoryLayoutProps) {
  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
        {/* Left column: controls + main content (ModList). Scrolls naturally. */}
        <div className="flex flex-col gap-4 min-w-0">
          {controls}
          {children}
        </div>

        {/* Right column: RegexOutput (sticky) + status + sidebar.
            On mobile, appears below left column (Phase 7 will move RegexOutput
            to a sticky bottom-bar). */}
        <aside className={`flex flex-col gap-3 ${RIGHT_COL_STICKY_CLASS}`}>
          {regexOutput}
          {status}
          {sidebar}
        </aside>
      </div>
    </div>
  );
}
