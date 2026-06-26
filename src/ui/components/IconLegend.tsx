/**
 * IconLegend — Phase 4.5 (iter 137).
 *
 * Static 3-row legend rendered at the BOTTOM of the right `<aside>` (below
 * ProfilePanel) on category pages. Companion to Phase 4 tooltips — gives
 * beginners a permanent reference, not just hover hints.
 *
 * Per `docs/UI_REFACTOR_PLAN.md` §4 Phase 4.5 + iter 130 visualization §2:
 *   - Row 1: ★ — в избранное (gold star = add to favorites)
 *   - Row 2: ✗ — исключить аффикс (cross = exclude this affix)
 *   - Row 3: ⓘ — наведите для подсказки (info glyph = hover for tooltip)
 *
 * Pure presentational — no props required for normal usage. Accepts an
 * optional `items` prop for test customization (override icon/text per row).
 *
 * Accessibility:
 *   - Uses semantic <ul> + <li> structure.
 *   - Icons are aria-hidden (decorative) — the text conveys the meaning.
 *   - Section has aria-labelledby pointing to the title.
 */
import React from 'react';
import { t } from '@shared/i18n';

export interface IconLegendItem {
  /** Icon glyph rendered in the icon column (e.g. '★', '✗', 'ⓘ'). */
  icon: string;
  /** i18n key for the description text (e.g. 'legend.star'). */
  textKey: string;
}

interface IconLegendProps {
  /** Optional override for the default 3 rows. Used in tests to verify
   *  rendering of custom items. When omitted, uses the default legend
   *  content per UI_REFACTOR_PLAN.md §4 Phase 4.5. */
  items?: IconLegendItem[];
}

/** Default legend content per UI_REFACTOR_PLAN.md §4 Phase 4.5. */
const DEFAULT_ITEMS: IconLegendItem[] = [
  { icon: '★', textKey: 'legend.star' },
  { icon: '✗', textKey: 'legend.exclude' },
  { icon: 'ⓘ', textKey: 'legend.info' },
];

/**
 * Render the static «Обозначения» legend. Pure presentational — no state,
 * no callbacks, no subscriptions.
 *
 * Usage:
 *   <IconLegend />
 *
 * Custom items (for testing):
 *   <IconLegend items={[{ icon: '?', textKey: 'custom.key' }]} />
 */
export const IconLegend: React.FC<IconLegendProps> = ({ items = DEFAULT_ITEMS }) => {
  const titleId = 'icon-legend-title';
  return (
    <section
      className="icon-legend"
      aria-labelledby={titleId}
    >
      <div id={titleId} className="icon-legend__title">
        {t('legend.title')}
      </div>
      <ul className="flex flex-col gap-0 m-0 p-0 list-none">
        {items.map((item, idx) => (
          <li key={`${item.icon}-${idx}`} className="icon-legend__row">
            <span className="icon-legend__icon" aria-hidden="true">{item.icon}</span>
            <span>{t(item.textKey)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

IconLegend.displayName = 'IconLegend';
