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
  /** iter 161: when true, appends a 4th row explaining shift+click = OPT
   *  for MIXED-mode. Pages pass `searchLogic === 'mixed'` so the hint
   *  appears only when MIXED is active. Default false (backward compat). */
  showMixedHint?: boolean;
}

/** Default legend content per UI_REFACTOR_PLAN.md §4 Phase 4.5. */
const DEFAULT_ITEMS: IconLegendItem[] = [
  { icon: '★', textKey: 'legend.star' },
  { icon: '✗', textKey: 'legend.exclude' },
  { icon: 'ⓘ', textKey: 'legend.info' },
];

/** iter 161: extra row appended when MIXED mode is active. */
const MIXED_HINT_ITEM: IconLegendItem = {
  // ⇄ (left-right arrow) — visual metaphor for "either this OR that".
  icon: '⇄',
  textKey: 'legend.opt_shift_click',
};

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
export const IconLegend: React.FC<IconLegendProps> = ({ items, showMixedHint = false }) => {
  // iter 161: when `items` is explicitly provided (tests), use it as-is.
  // Otherwise, build from DEFAULT_ITEMS + optional MIXED hint row.
  const effectiveItems = items ?? (showMixedHint ? [...DEFAULT_ITEMS, MIXED_HINT_ITEM] : DEFAULT_ITEMS);
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
        {effectiveItems.map((item, idx) => (
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
