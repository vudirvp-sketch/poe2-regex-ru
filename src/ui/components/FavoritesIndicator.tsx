/**
 * FavoritesIndicator — iter 140 (KI#24).
 *
 * Compact `★ N` badge for category page headers. Restores favorites
 * visibility that was lost in iter 139 (KI#20) when LeftPanelFavorites was
 * removed from the left column (the vertical chip list was too noisy).
 *
 * User asked: «полностью пропал блок 'избранное', так было задумано?».
 * Decision iter 140: bring back favorites as a COMPACT indicator in the
 * page header (next to mod count) — NOT as a full chip list. This gives
 * visibility (user sees how many affixes are pinned) without cluttering
 * the left column.
 *
 * Layout: small inline badge — ★ icon + label + count. Hidden when
 * `pinnedIds.size === 0` (no favorites → no badge → no noise). When > 0,
 * renders as a small amber-tinted badge with the gold star icon.
 *
 * Behaviour:
 * - Empty state (`pinnedIds.size === 0`) → returns `null` (renders nothing).
 * - Non-empty → renders `★ Избранные аффиксы: N` badge with aria-label.
 *
 * Click behaviour: NONE (pure presentational indicator). The user manages
 * favorites via the ⭐ button on FilterChip (Phase 5, iter 136) and via
 * show-selected-only toggle in CategoryControlPanel. This component is a
 * VISIBILITY indicator only, not an interactive control.
 *
 * Accessibility:
 * - `aria-label` includes the count for screen readers.
 * - `★` glyph is `aria-hidden` (decorative) — the label conveys the meaning.
 * - `role="status"` so screen readers announce changes when the count updates.
 *
 * Reference: per user screenshot (iter 140 brief), the ideal placement is
 * in the page header — next to the mod count, on the right side. The header
 * pattern becomes:
 *   [icon] Category Title    N аффиксов  ★ Избранные: M
 */
import React from 'react';
import { t } from '@shared/i18n';

interface FavoritesIndicatorProps {
  /** Favorited ("pinned") token IDs from filter-store. When the set is empty,
   *  the component returns `null` (no badge shown). */
  pinnedIds: Set<string>;
}

/**
 * Render the compact favorites indicator. Returns `null` when `pinnedIds`
 * is empty — no favorites → no badge → no noise.
 *
 * Usage (in any category page header):
 *   <FavoritesIndicator pinnedIds={pinnedIds} />
 */
export const FavoritesIndicator: React.FC<FavoritesIndicatorProps> = ({ pinnedIds }) => {
  const count = pinnedIds.size;

  // Empty state — render nothing. Don't take up header space when user has
  // no favorites yet. The ⭐ button on FilterChip is still visible, so the
  // user can add favorites; once they do, this badge appears.
  if (count === 0) return null;

  const label = t('favorites.indicator_label').replace('{n}', String(count));

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium bg-amber-900/30 border border-amber-700/40 text-accent-amber-soft"
    >
      <span aria-hidden="true" className="text-accent-amber-soft">★</span>
      <span>{label}</span>
    </span>
  );
};

FavoritesIndicator.displayName = 'FavoritesIndicator';
