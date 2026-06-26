/**
 * SelectedBasket — Phase 3 (iter 135).
 *
 * Renders the user's selected family groups as compact read-only chips in the
 * right aside of category pages (above RegexOutput, below the page header).
 * Each chip is prefixed with a colored affix-type badge so the user can scan
 * which affix slots their selection fills (iter 130 visualization gap #4).
 *
 * Behaviour:
 * - Empty state (`selectedIds` empty) → «Выберите аффиксы» placeholder shown.
 * - Cap = `SELECTED_BASKET_CAP` (20, iter 131 §13.7 #3). When the user has
 *   more selections than the cap, only the first 20 chips render with a
 *   «+N ещё» expander at the bottom. Clicking the expander reveals all.
 * - Click on a basket chip → calls `onToggleTokens(memberIds)` to deselect.
 * - «Очистить все» link in the header → calls `onClearSelections()`.
 * - Max-height 30vh with internal scroll so the basket never pushes RegexOutput
 *   off-screen on smaller laptop viewports.
 *
 * Layout: simple flex-wrap of chips. Each chip = colored affix badge + text +
 * ✗ icon (visual cue for click-to-deselect). No range inputs — basket is a
 * READ-ONLY summary, the user edits ranges on the corresponding FilterChip
 * inside the ModList / VirtualizedModList.
 *
 * iter 130 visualization audit (§13.2 #4): affix-type badges are required.
 * iter 131 §13.7 #2: max-height 30vh + scroll.
 * iter 131 §13.7 #3: cap raised from 12 → 20.
 */
import React, { useMemo, useState, useCallback } from 'react';
import type { FamilyGroup, AffixType, GameToken } from '@shared/types';
import { groupTokensByFamily } from '@shared/family-grouper';
import { t } from '@shared/i18n';
import { SELECTED_BASKET_CAP } from '@shared/constants';

interface SelectedBasketProps {
  /** All tokens for the current category. Used to look up selected tokens
   *  + group them into families (one chip per family, not per token). */
  tokens: GameToken[];
  /** Selected ("want") token IDs. Used to filter `tokens` down to selected
   *  ones before family grouping. */
  selectedIds: Set<string>;
  /** Toggle a family group's selection (called when user clicks a basket chip).
   *  Pass the member IDs of that family group — same signature as
   *  `FilterChip`'s `onToggleTokens`. */
  onToggleTokens: (ids: string[]) => void;
  /** Clear all selections (called when user clicks «Очистить все»). */
  onClearSelections: () => void;
  /** Category ID for priority tier classification (e.g. 'belt', 'ring').
   *  Forwarded to `groupTokensByFamily` so the chip's `priorityTier` field
   *  is computed correctly. Optional — when omitted, defaults to 'C' tier. */
  category?: string;
}

/** Affix-type badge styling map. iter 130 visualization: implicit=amber,
 *  prefix=blue, suffix=red — matches the `.affix-header-*` border colors. */
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

export const SelectedBasket: React.FC<SelectedBasketProps> = ({
  tokens,
  selectedIds,
  onToggleTokens,
  onClearSelections,
  category,
}) => {
  // Local state for the «+N ещё» expander. Resets to false whenever the
  // selection shrinks below the cap (defensive — `hiddenCount` becomes 0 so
  // the button wouldn't render anyway, but this keeps state clean).
  const [expanded, setExpanded] = useState(false);

  // Group selected tokens by family — same logic as ModList/VirtualizedModList.
  // One basket chip per family group, NOT per token.
  const familyGroups: FamilyGroup[] = useMemo(() => {
    if (selectedIds.size === 0) return [];
    const selectedTokens = tokens.filter(t => selectedIds.has(t.id));
    if (selectedTokens.length === 0) return [];
    return groupTokensByFamily(selectedTokens, category);
  }, [tokens, selectedIds, category]);

  const totalCount = familyGroups.length;

  // Slice to cap when not expanded. When `expanded` is true OR count ≤ cap,
  // show all.
  const visibleGroups = useMemo(() => {
    if (expanded || totalCount <= SELECTED_BASKET_CAP) {
      return familyGroups;
    }
    return familyGroups.slice(0, SELECTED_BASKET_CAP);
  }, [familyGroups, expanded, totalCount]);

  const hiddenCount = Math.max(0, totalCount - SELECTED_BASKET_CAP);
  const showMoreButton = !expanded && hiddenCount > 0;
  const showCollapseButton = expanded && totalCount > SELECTED_BASKET_CAP;

  // Defensive: if selection shrinks below cap while expanded, reset.
  // (Without this, `expanded` stays true but the «свернуть» button disappears
  // because the condition above is false. The state is then stale — it would
  // re-trigger expand on the next selection above cap. Better to reset.)
  const handleToggleExpand = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  // ─── Empty state ───
  if (totalCount === 0) {
    return (
      <div
        className="bg-panel border border-edge-panel rounded p-3"
        role="region"
        aria-label={t('basket.title').replace('{n}', '0')}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[13px] font-semibold text-bright">
            {t('basket.title').replace('{n}', '0')} {t('basket.title_suffix')}
          </span>
        </div>
        <div className="text-[12px] text-dim italic">
          {t('basket.empty')}
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-panel border border-edge-panel rounded p-3 flex flex-col gap-2"
      role="region"
      aria-label={`${t('basket.title').replace('{n}', String(totalCount))} ${t('basket.title_suffix')}`}
    >
      {/* Header: «Выбрано: N афф.» + «Очистить все» */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-bright">
          {t('basket.title').replace('{n}', String(totalCount))} {t('basket.title_suffix')}
        </span>
        <button
          type="button"
          onClick={onClearSelections}
          className="text-[12px] text-accent-red hover:text-bright hover:underline transition-colors"
          aria-label={t('basket.clear_aria')}
        >
          {t('basket.clear')}
        </button>
      </div>

      {/* Chip list — max-height 30vh with internal scroll per iter 131 §13.7 #2. */}
      <div
        className="flex flex-wrap gap-1.5 overflow-y-auto"
        style={{ maxHeight: '30vh' }}
      >
        {visibleGroups.map(group => {
          const badge = AFFIX_BADGE[group.affix];
          const memberIds = group.members.map(m => m.id);
          return (
            <div
              key={group.familyKey}
              role="button"
              tabIndex={0}
              onClick={() => onToggleTokens(memberIds)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleTokens(memberIds);
                }
              }}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] bg-chip border border-edge hover:bg-chip-hover transition-colors cursor-pointer"
              aria-label={`${group.displayText} — ${t('basket.unselect_aria')}`}
              title={`${group.displayText} — ${t('basket.unselect_aria')}`}
            >
              {/* Affix-type badge (iter 130 visualization gap #4). */}
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${badge.className}`}
                aria-hidden="true"
              >
                {t(badge.label)}
              </span>
              {/* Chip text — same as FilterChip.displayText. */}
              <span className="text-bright">{group.displayText}</span>
              {/* Click-to-deselect visual cue. */}
              <span
                className="text-muted text-[12px] font-bold shrink-0"
                aria-hidden="true"
              >
                ✗
              </span>
            </div>
          );
        })}

        {/* «+N ещё» expander (when selection > cap AND not expanded). */}
        {showMoreButton && (
          <button
            type="button"
            onClick={handleToggleExpand}
            className="inline-flex items-center px-2.5 py-1 text-[12px] text-soft bg-raised border border-edge rounded hover:bg-chip-hover transition-colors"
            aria-label={t('basket.more_aria').replace('{n}', String(hiddenCount))}
          >
            {t('basket.more').replace('{n}', String(hiddenCount))}
          </button>
        )}

        {/* «свернуть» button (when expanded AND count > cap). */}
        {showCollapseButton && (
          <button
            type="button"
            onClick={handleToggleExpand}
            className="inline-flex items-center px-2.5 py-1 text-[12px] text-soft bg-raised border border-edge rounded hover:bg-chip-hover transition-colors"
            aria-label={t('basket.collapse_aria')}
          >
            {t('basket.collapse')}
          </button>
        )}
      </div>
    </div>
  );
};
