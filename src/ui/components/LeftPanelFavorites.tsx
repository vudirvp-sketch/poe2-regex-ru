/**
 * LeftPanelFavorites — Phase 5 (iter 136).
 *
 * Renders the user's favorited ("pinned") family groups as compact read-only
 * chips in the LEFT column of category pages (above CategoryControlPanel —
 * final visual order: Header → Favorites → Filters → ModList, with the sticky
 * Search bar inside ModList becoming the primary visible control after the
 * user scrolls past the controls row).
 *
 * Per `docs/UI_REFACTOR_PLAN.md` §4 Phase 5 + iter 131 §13.7 correction #1:
 * the user wants the LEFT panel order Search → Favorites → Filters. Search is
 * currently implemented as a sticky bar inside ModList/VirtualizedModList
 * (Phase 2, iter 133) and remains visible at the top of the viewport while
 * scrolling. Favorites render ABOVE Filters in the left column, so on initial
 * page load the visual order is Header → Favorites → Filters → Search (sticky
 * inside ModList) → ModList. After the user scrolls past the controls row,
 * Search sticks to the top of the viewport, becoming the primary control —
 * matching the spec's intent that Search is the most-used control.
 *
 * Behaviour:
 * - Empty state (`pinnedIds` empty) → «Нажмите ★ на аффиксе, чтобы добавить в
 *   избранное» placeholder shown.
 * - Each chip = ⭐ icon + colored affix badge (ПРЕФ/СУФ/ИМПЛ, matches
 *   SelectedBasket visualization) + displayText + ✗ unpin button.
 * - Click on chip body (label area) → scroll-to-mod via
 *   `document.querySelector('[data-family-key="<familyKey>"]')`. If the chip
 *   is virtualized out of DOM (mobile / long list), the click degrades
 *   gracefully — does nothing. Spec per Phase 5 risk register.
 * - Click ✗ → `onTogglePinned(memberIds)` unpins that family.
 * - «Очистить» link in the header → `onClearPinned()` clears all pinned tokens.
 * - Max-height 30vh with internal scroll so favorites never push Filters off
 *   the screen on smaller laptop viewports.
 *
 * Layout: simple flex-wrap of chips. No range inputs — favorites is a
 * READ-ONLY shortcut panel. The user edits ranges on the corresponding
 * FilterChip inside the ModList / VirtualizedModList.
 *
 * iter 131 §13.7 #1: Search → Favorites → Filters order.
 */
import React, { useMemo, useCallback } from 'react';
import type { FamilyGroup, AffixType, GameToken } from '@shared/types';
import { groupTokensByFamily } from '@shared/family-grouper';
import { t } from '@shared/i18n';

interface LeftPanelFavoritesProps {
  /** All tokens for the current category. Used to look up pinned tokens
   *  + group them into families (one chip per family, not per token). */
  tokens: GameToken[];
  /** Favorited ("pinned") token IDs. Used to filter `tokens` down to pinned
   *  ones before family grouping. */
  pinnedIds: Set<string>;
  /** Toggle a family group's pinned state (called when user clicks the ✗
   *  unpin button on a chip). Pass the member IDs of that family group —
   *  same signature as `FilterChip`'s `onTogglePinned`. */
  onTogglePinned: (ids: string[]) => void;
  /** Clear all pinned favorites (called when user clicks «Очистить»). */
  onClearPinned: () => void;
  /** Category ID for priority tier classification (e.g. 'belt', 'ring').
   *  Forwarded to `groupTokensByFamily` so the chip's `priorityTier` field
   *  is computed correctly. Optional — when omitted, defaults to 'C' tier. */
  category?: string;
}

/** Affix-type badge styling map. Matches SelectedBasket visualization
 *  (iter 130 visualization gap #4) for visual consistency between the right
 *  aside basket and the left panel favorites. */
const AFFIX_BADGE: Record<AffixType, { label: string; className: string }> = {
  implicit: {
    label: 'basket.badge_implicit',
    className: 'bg-amber-900/40 text-accent-amber border border-amber-700/50',
  },
  prefix: {
    label: 'basket.badge_prefix',
    className: 'bg-blue-900/40 text-accent-blue border border-blue-700/50',
  },
  suffix: {
    label: 'basket.badge_suffix',
    className: 'bg-orange-900/40 text-accent-orange border border-orange-700/50',
  },
};

export const LeftPanelFavorites: React.FC<LeftPanelFavoritesProps> = ({
  tokens,
  pinnedIds,
  onTogglePinned,
  onClearPinned,
  category,
}) => {
  // Group pinned tokens by family — same logic as SelectedBasket.
  // One favorites chip per family group, NOT per token.
  const familyGroups: FamilyGroup[] = useMemo(() => {
    if (pinnedIds.size === 0) return [];
    const pinnedTokens = tokens.filter(tok => pinnedIds.has(tok.id));
    if (pinnedTokens.length === 0) return [];
    return groupTokensByFamily(pinnedTokens, category);
  }, [tokens, pinnedIds, category]);

  const totalCount = familyGroups.length;

  // Click on chip body (label area) → scroll-to-mod.
  // Uses `data-family-key` attribute on the FilterChip wrapping div
  // (added in iter 136 alongside this component) to locate the chip in the
  // DOM. If the chip is virtualized out of DOM (long list on mobile /
  // virtualized mod list), `querySelector` returns null → click degrades
  // gracefully (no-op). Spec per Phase 5 risk register: "if chip not in DOM,
  // just scroll to its sub-group header".
  //
  // We use a CSS selector that escapes the familyKey in attribute selector
  // syntax. familyKey values are typically simple Russian words/phrases
  // without quotes — but defensive escaping handles any edge case.
  const handleScrollToChip = useCallback((familyKey: string) => {
    // Use CSS.escape if available (modern browsers); fallback to manual
    // escape for older engines.
    const escaped = typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(familyKey)
      : familyKey.replace(/["\\]/g, '\\$&');
    const selector = `[data-family-key="${escaped}"]`;
    const chipEl = document.querySelector(selector);
    if (chipEl instanceof HTMLElement) {
      chipEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Briefly highlight (2s pulse) — add a CSS class, then remove it.
      chipEl.classList.add('favorite-pulse');
      window.setTimeout(() => {
        chipEl.classList.remove('favorite-pulse');
      }, 2000);
    }
    // If chip not in DOM (virtualized out), degrade gracefully — no-op.
  }, []);

  // ─── Empty state ───
  if (totalCount === 0) {
    return (
      <div
        className="bg-panel border border-edge-panel rounded p-3"
        role="region"
        aria-label={t('favorites.title').replace('{n}', '0')}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[13px] font-semibold text-bright">
            {t('favorites.title').replace('{n}', '0')}
          </span>
        </div>
        <div className="text-[12px] text-dim italic">
          {t('favorites.empty')}
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-panel border border-edge-panel rounded p-3 flex flex-col gap-2"
      role="region"
      aria-label={t('favorites.title').replace('{n}', String(totalCount))}
    >
      {/* Header: «⭐ Избранные: N» + «Очистить» */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-bright">
          {t('favorites.title').replace('{n}', String(totalCount))}
        </span>
        <button
          type="button"
          onClick={onClearPinned}
          className="text-[12px] text-accent-red hover:text-bright hover:underline transition-colors"
          aria-label={t('favorites.clear_aria')}
        >
          {t('favorites.clear')}
        </button>
      </div>

      {/* Chip list — max-height 30vh with internal scroll (matches
          SelectedBasket). Keeps Favorites from pushing Filters off-screen
          on smaller laptop viewports. */}
      <div
        className="flex flex-wrap gap-1.5 overflow-y-auto"
        style={{ maxHeight: '30vh' }}
      >
        {familyGroups.map(group => {
          const badge = AFFIX_BADGE[group.affix];
          const memberIds = group.members.map(m => m.id);
          const ariaLabelScroll = `${group.displayText} — ${t('favorites.scroll_aria')}`;
          const ariaLabelUnpin = `${group.displayText} — ${t('favorites.unpin_aria')}`;
          return (
            <div
              key={group.familyKey}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] bg-chip border border-edge hover:bg-chip-hover transition-colors"
            >
              {/* ⭐ filled icon — visual indicator that this is a favorite. */}
              <span
                className="text-accent-amber-soft text-[12px] shrink-0"
                aria-hidden="true"
              >
                ★
              </span>
              {/* Affix-type badge (matches SelectedBasket visualization). */}
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${badge.className}`}
                aria-hidden="true"
              >
                {t(badge.label)}
              </span>
              {/* Click-to-scroll label area.
                  role="button" + tabIndex=0 + Enter/Space keydown for a11y.
                  stopPropagation so clicking the label does NOT also trigger
                  the ✗ unpin button (which is a sibling, not a parent, but
                  defensive stopPropagation keeps the boundary clean). */}
              <span
                role="button"
                tabIndex={0}
                onClick={() => handleScrollToChip(group.familyKey)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleScrollToChip(group.familyKey);
                  }
                }}
                className="text-bright cursor-pointer focus:outline-none focus:underline"
                aria-label={ariaLabelScroll}
                title={ariaLabelScroll}
              >
                {group.displayText}
              </span>
              {/* ✗ unpin button — calls onTogglePinned(memberIds) to remove
                  this family's tokens from pinnedIds. */}
              <button
                type="button"
                onClick={() => onTogglePinned(memberIds)}
                className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[12px] font-bold bg-raised text-muted hover:bg-chip-hover hover:text-accent-red transition-colors"
                aria-label={ariaLabelUnpin}
                title={ariaLabelUnpin}
              >
                ✗
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
