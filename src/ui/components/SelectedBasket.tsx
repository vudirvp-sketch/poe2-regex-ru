/**
 * SelectedBasket — Phase 3 (iter 135).
 *
 * Renders the user's selected family groups as compact read-only chips in the
 * right aside of category pages (above RegexOutput, below the page header).
 * Each chip is prefixed with a colored affix-type badge so the user can scan
 * which affix slots their selection fills (iter 130 visualization gap #4).
 *
 * iter 161: EXTENDED to render THREE sections (was one — want only):
 *   1. «Выбрано: N афф.»  — selectedIds (want / MUST). Existing behaviour.
 *   2. «Опционально (≥1 из группы):» — optionalIds (OPT). Only rendered when
 *      `mixedMode` is true AND there's at least one OPT family. Amber dashed
 *      chip border (matches FilterChip's OPT state).
 *   3. «Исключено:» — excludedIds. Always rendered when non-empty (even
 *      outside MIXED mode). Red badge background + red ✗ icon.
 *
 * Behaviour:
 * - Empty state (ALL three sets empty) → «Выберите аффиксы» placeholder shown.
 * - Cap = `SELECTED_BASKET_CAP` (20) PER SECTION. When a section has more
 *   chips than the cap, only the first 20 render with a «+N ещё» expander.
 * - Click on a basket chip → calls the matching toggle callback:
 *     want chip    → onToggleTokens(memberIds)
 *     opt chip     → onToggleOptional(memberIds)
 *     exclude chip → onToggleExclude(memberIds)
 * - «Очистить все» link → onClearSelections() (clears all 3 sets via store).
 * - Max-height 30vh with internal scroll per section.
 *
 * Layout: vertical stack of 3 sections (want / opt / exclude). Each section
 * is a flex-wrap of chips. Each chip = colored affix badge + text + state
 * icon (✗ for want/exclude, ⇄ for opt).
 *
 * Backward compat: `excludedIds`, `optionalIds`, `onToggleExclude`,
 * `onToggleOptional`, `mixedMode` are all OPTIONAL. When omitted, the
 * component behaves as before iter 161 (renders only the want section).
 *
 * iter 130 visualization audit (§13.2 #4): affix-type badges are required.
 * iter 131 §13.7 #2: max-height 30vh + scroll.
 * iter 131 §13.7 #3: cap raised from 12 → 20.
 * iter 161: 3-section layout (want + opt + exclude).
 */
import React, { useMemo, useState, useCallback } from 'react';
import type { FamilyGroup, AffixType, GameToken } from '@shared/types';
import { groupTokensByFamily } from '@shared/family-grouper';
import { t } from '@shared/i18n';
import { SELECTED_BASKET_CAP } from '@shared/constants';

/** Which state a chip represents in the basket. */
type BasketChipState = 'want' | 'opt' | 'exclude';

interface SelectedBasketProps {
  /** All tokens for the current category. Used to look up selected tokens
   *  + group them into families (one chip per family, not per token). */
  tokens: GameToken[];
  /** Selected ("want") token IDs. Used to filter `tokens` down to selected
   *  ones before family grouping. */
  selectedIds: Set<string>;
  /** iter 161: Excluded ("don't want") token IDs. When non-empty, renders
   *  a separate red «Исключено:» section below the want section. */
  excludedIds?: Set<string>;
  /** iter 161: Optional ("opt") token IDs (MIXED mode). When non-empty AND
   *  `mixedMode` is true, renders an amber «Опционально:» section between
   *  want and exclude. */
  optionalIds?: Set<string>;
  /** Toggle a family group's selection (called when user clicks a want chip).
   *  Pass the member IDs of that family group — same signature as
   *  `FilterChip`'s `onToggleTokens`. */
  onToggleTokens: (ids: string[]) => void;
  /** iter 161: Toggle a family group's exclude state (called when user
   *  clicks an exclude chip). Backward compat: when omitted, exclude chips
   *  are still rendered (read-only) but clicks do nothing. */
  onToggleExclude?: (ids: string[]) => void;
  /** iter 161: Toggle a family group's optional state (called when user
   *  clicks an opt chip). Backward compat: when omitted, opt chips are
   *  still rendered (read-only) but clicks do nothing. */
  onToggleOptional?: (ids: string[]) => void;
  /** Clear all selections (called when user clicks «Очистить все»). */
  onClearSelections: () => void;
  /** Category ID for priority tier classification (e.g. 'belt', 'ring').
   *  Forwarded to `groupTokensByFamily` so the chip's `priorityTier` field
   *  is computed correctly. Optional — when omitted, defaults to 'C' tier. */
  category?: string;
  /** iter 161: When true, enables the OPT section. Pages pass
   *  `searchLogic === 'mixed'`. Default false (backward compat). */
  mixedMode?: boolean;
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

/** State-specific styling for basket chips.
 *  - want: standard chip bg + ✗ icon (click to deselect)
 *  - opt: amber-tinted bg + amber dashed border + ⇄ icon (matches FilterChip)
 *  - exclude: red-tinted bg + ✗ icon (click to un-exclude) */
function chipClassForState(state: BasketChipState): string {
  switch (state) {
    case 'opt':
      return 'bg-amber-900/20 border border-amber-600/50 border-dashed chip-opt';
    case 'exclude':
      return 'bg-indicator-red/30 border border-red-700/50';
    case 'want':
    default:
      return 'bg-chip border border-edge';
  }
}

function iconForState(state: BasketChipState): string {
  switch (state) {
    case 'opt':
      return '⇄';
    case 'exclude':
      return '✗';
    case 'want':
    default:
      return '✗';
  }
}

function ariaKeyForState(state: BasketChipState): string {
  switch (state) {
    case 'opt':
      return 'basket.unoptional_aria';
    case 'exclude':
      return 'basket.unexclude_aria';
    case 'want':
    default:
      return 'basket.unselect_aria';
  }
}

export const SelectedBasket: React.FC<SelectedBasketProps> = ({
  tokens,
  selectedIds,
  excludedIds,
  optionalIds,
  onToggleTokens,
  onToggleExclude,
  onToggleOptional,
  onClearSelections,
  category,
  mixedMode = false,
}) => {
  // Local state for the «+N ещё» expander. One per section so each can
  // expand independently. Resets to false whenever the section shrinks
  // below the cap (defensive — `hiddenCount` becomes 0 so the button
  // wouldn't render anyway, but this keeps state clean).
  const [wantExpanded, setWantExpanded] = useState(false);
  const [optExpanded, setOptExpanded] = useState(false);
  const [excludeExpanded, setExcludeExpanded] = useState(false);

  // ─── Compute family groups for each of the 3 sets ───
  // One basket chip per family group, NOT per token.
  const wantGroups: FamilyGroup[] = useMemo(() => {
    if (selectedIds.size === 0) return [];
    const selectedTokens = tokens.filter(t => selectedIds.has(t.id));
    if (selectedTokens.length === 0) return [];
    return groupTokensByFamily(selectedTokens, category);
  }, [tokens, selectedIds, category]);

  const optGroups: FamilyGroup[] = useMemo(() => {
    // Only render OPT section when mixedMode is true. Defensive: even if
    // optionalIds has stale entries from a previous MIXED session, we hide
    // them when the user is in AND/OR mode (matches FilterChip behaviour).
    if (!mixedMode) return [];
    const ids = optionalIds ?? new Set<string>();
    if (ids.size === 0) return [];
    const optTokens = tokens.filter(t => ids.has(t.id));
    if (optTokens.length === 0) return [];
    return groupTokensByFamily(optTokens, category);
  }, [tokens, optionalIds, category, mixedMode]);

  const excludeGroups: FamilyGroup[] = useMemo(() => {
    const ids = excludedIds ?? new Set<string>();
    if (ids.size === 0) return [];
    const exclTokens = tokens.filter(t => ids.has(t.id));
    if (exclTokens.length === 0) return [];
    return groupTokensByFamily(exclTokens, category);
  }, [tokens, excludedIds, category]);

  const wantCount = wantGroups.length;
  const optCount = optGroups.length;
  const excludeCount = excludeGroups.length;
  const totalCount = wantCount + optCount + excludeCount;

  // ─── Helpers for slicing per-section to cap ───
  const sliceGroups = (
    groups: FamilyGroup[],
    expanded: boolean,
  ): { visible: FamilyGroup[]; hiddenCount: number; showMore: boolean; showCollapse: boolean } => {
    const total = groups.length;
    if (expanded || total <= SELECTED_BASKET_CAP) {
      return { visible: groups, hiddenCount: 0, showMore: false, showCollapse: expanded && total > SELECTED_BASKET_CAP };
    }
    return {
      visible: groups.slice(0, SELECTED_BASKET_CAP),
      hiddenCount: Math.max(0, total - SELECTED_BASKET_CAP),
      showMore: true,
      showCollapse: false,
    };
  };

  const wantSlice = useMemo(() => sliceGroups(wantGroups, wantExpanded), [wantGroups, wantExpanded]);
  const optSlice = useMemo(() => sliceGroups(optGroups, optExpanded), [optGroups, optExpanded]);
  const excludeSlice = useMemo(() => sliceGroups(excludeGroups, excludeExpanded), [excludeGroups, excludeExpanded]);

  const handleToggleExpand = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(prev => !prev);
  }, []);

  // ─── Empty state: all 3 sets empty ───
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

  // ─── Render a single section (want / opt / exclude) ───
  const renderSection = (
    groups: FamilyGroup[],
    slice: { visible: FamilyGroup[]; hiddenCount: number; showMore: boolean; showCollapse: boolean },
    state: BasketChipState,
    headerLabel: string,
    setExpanded: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    if (groups.length === 0) return null;
    const toggleHandler = state === 'opt' ? onToggleOptional : state === 'exclude' ? onToggleExclude : onToggleTokens;
    return (
      <div className="flex flex-col gap-1.5">
        {/* Section header — small italic label. Want section uses the
            existing «Выбрано: N афф.» format; opt/exclude use shorter labels. */}
        <span className="text-[11px] text-dim italic font-medium">
          {headerLabel}
        </span>
        <div
          className="flex flex-wrap gap-1.5 overflow-y-auto"
          style={{ maxHeight: '30vh' }}
        >
          {slice.visible.map(group => {
            const badge = AFFIX_BADGE[group.affix];
            const memberIds = group.members.map(m => m.id);
            const ariaKey = ariaKeyForState(state);
            return (
              <div
                key={`${state}-${group.familyKey}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleHandler?.(memberIds)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleHandler?.(memberIds);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] ${chipClassForState(state)} hover:opacity-80 transition-opacity cursor-pointer`}
                aria-label={`${group.displayText} — ${t(ariaKey)}`}
                title={`${group.displayText} — ${t(ariaKey)}`}
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
                {/* State icon — visual cue for click action. */}
                <span
                  className={`text-[12px] font-bold shrink-0 ${
                    state === 'opt' ? 'text-accent-amber-warn' : state === 'exclude' ? 'text-accent-red' : 'text-muted'
                  }`}
                  aria-hidden="true"
                >
                  {iconForState(state)}
                </span>
              </div>
            );
          })}

          {/* «+N ещё» expander */}
          {slice.showMore && (
            <button
              type="button"
              onClick={() => handleToggleExpand(setExpanded)}
              className="inline-flex items-center px-2.5 py-1 text-[12px] text-soft bg-raised border border-edge rounded hover:bg-chip-hover transition-colors"
              aria-label={t('basket.more_aria').replace('{n}', String(slice.hiddenCount))}
            >
              {t('basket.more').replace('{n}', String(slice.hiddenCount))}
            </button>
          )}

          {/* «свернуть» button */}
          {slice.showCollapse && (
            <button
              type="button"
              onClick={() => handleToggleExpand(setExpanded)}
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

  return (
    <div
      className="bg-panel border border-edge-panel rounded p-3 flex flex-col gap-2.5"
      role="region"
      aria-label={`${t('basket.title').replace('{n}', String(totalCount))} ${t('basket.title_suffix')}`}
    >
      {/* Header: total count summary + «Очистить все».
          iter 161: shows total across all 3 sections. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-bright">
          {t('basket.title').replace('{n}', String(totalCount))} {t('basket.title_suffix')}
          {/* Inline breakdown: «(N хч + M опц + K искл)» — only when there
              are non-want sections. Helps the user see the split at a glance. */}
          {(optCount > 0 || excludeCount > 0) && (
            <span className="text-[11px] text-dim font-normal ml-1">
              ({wantCount}+{optCount > 0 ? `${optCount}⇄` : ''}{excludeCount > 0 ? `${excludeCount}✗` : ''})
            </span>
          )}
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

      {/* Want section — always rendered when non-empty.
          iter 161: no separate header for want section — the basket header
          above («Выбрано: N афф.») already shows the want count when no
          opt/exclude chips exist. Adding a duplicate header here broke
          tests that use getByText(/Выбрано: N/). */}
      {renderSection(
        wantGroups,
        wantSlice,
        'want',
        '',
        setWantExpanded,
      )}

      {/* OPT section — only when mixedMode AND optCount > 0. */}
      {renderSection(
        optGroups,
        optSlice,
        'opt',
        t('basket.optional_header'),
        setOptExpanded,
      )}

      {/* Exclude section — always rendered when non-empty (even outside MIXED). */}
      {renderSection(
        excludeGroups,
        excludeSlice,
        'exclude',
        t('basket.excluded_header'),
        setExcludeExpanded,
      )}
    </div>
  );
};
