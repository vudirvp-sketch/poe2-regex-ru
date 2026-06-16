/**
 * CategoryControlPanel — Shared controls row for category pages.
 *
 * Renders ONLY the controls row (no RegexOutput, no sticky wrapper).
 * Used by all 8 category pages via <CategoryLayout>'s `controls` slot.
 * <RegexOutput> lives separately in <CategoryLayout>'s `regexOutput` slot
 * (right column, sticky via <aside>).
 *
 * Contains:
 * - Mode toggle (Хочу / Не хочу)
 * - Range filter (≥ min, ≤ max) — conditional on hasRangedTokens
 * - Round10 toggle — conditional on hasRangedTokens (or showRound10)
 * - Slot for category-specific controls (waystone state, tablet types, etc.)
 * - Optional clear button slot
 *
 * History: iter 52 introduced a non-breaking `hideRegexOutput` prop with two
 * modes (legacy embedded RegexOutput + sticky wrapper, and split controls-only).
 * iter 53 migrated all 8 pages to split mode. iter 54 removed the legacy
 * branch and unused props (regex, isOverflow, regexParts, filterStore,
 * hideRegexOutput) since they were never consumed in split mode.
 */
import React from 'react';
import type { SearchLogic, PriorityFilter } from '@shared/types';
import { MAX_ENUMERATE_RANGE } from '@core/number-regex';
import { t } from '@shared/i18n';

interface CategoryControlPanelProps {
  searchLogic: SearchLogic;
  setSearchLogic: (v: SearchLogic) => void;
  hasRangedTokens: boolean;
  minValue: number | null;
  setMinValue: (v: number | null) => void;
  maxValue: number | null;
  setMaxValue: (v: number | null) => void;
  rangedSuffixes: string[];
  round10Enabled: boolean;
  setRound10Enabled: (v: boolean) => void;
  /** Threshold mode: RANGE(min,max) compiles as ≥min only */
  thresholdEnabled: boolean;
  /** Set threshold mode */
  setThresholdEnabled: (v: boolean) => void;
  /** Priority tier filter state. Optional — not needed for jewel/relic/vendor pages. */
  priorityFilter?: PriorityFilter;
  /** Set priority tier filter. Optional — not needed for jewel/relic/vendor pages. */
  setPriorityFilter?: (v: PriorityFilter) => void;
  /** Whether to show priority tier filter toggle. Only shown for categories
   *   that have priority classification (ring, amulet, belt, waystone, tablet). */
  showPriorityFilter?: boolean;
  /** Slot for category-specific controls (waystone state, tablet types, etc.) */
  extraControls?: React.ReactNode;
  /**
   * Explicitly show round10 toggle regardless of hasRangedTokens.
   * Used by VendorPage which has numeric inputs but no ranged mod tokens.
   */
  showRound10?: boolean;
  /** Slot for a clear/reset button (used by VendorPage) */
  clearButton?: React.ReactNode;
  /** Count of excluded ("don't want") mods for summary */
  excludedCount?: number;
  /** Number of active (selected + excluded) tokens — for budget-aware warnings.
   *  Used for the active-tokens counter in the controls row. */
  activeTokenCount?: number;
}

/**
 * Arrow key handler for radio groups per ARIA spec.
 * Left/Up = previous, Right/Down = next. Wraps around.
 */
function handleRadioKeyDown(
  e: React.KeyboardEvent,
  options: { value: boolean | string; action: () => void }[],
  currentValue: boolean | string,
) {
  const currentIndex = options.findIndex(o => o.value === currentValue);
  if (currentIndex === -1) return;

  let nextIndex: number;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % options.length;
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + options.length) % options.length;
  } else {
    return;
  }

  e.preventDefault();
  options[nextIndex].action();
}

export const CategoryControlPanel: React.FC<CategoryControlPanelProps> = ({
  searchLogic,
  setSearchLogic,
  hasRangedTokens,
  minValue,
  setMinValue,
  maxValue,
  setMaxValue,
  rangedSuffixes,
  round10Enabled,
  setRound10Enabled,
  thresholdEnabled,
  setThresholdEnabled,
  extraControls,
  showRound10,
  clearButton,
  priorityFilter = 'all',
  setPriorityFilter,
  showPriorityFilter,
  excludedCount = 0,
  activeTokenCount = 0,
}) => {
  const showRound10Toggle = showRound10 ?? hasRangedTokens;

  // Logic toggle options for arrow key navigation
  const logicOptions = [
    { value: 'and' as SearchLogic, action: () => setSearchLogic('and') },
    { value: 'or' as SearchLogic, action: () => setSearchLogic('or') },
  ];

  // Priority filter options for arrow key navigation
  const onSetPriorityFilter = setPriorityFilter ?? (() => {});
  const priorityOptions = [
    { value: 'all' as PriorityFilter, action: () => onSetPriorityFilter('all') },
    { value: 'S+A' as PriorityFilter, action: () => onSetPriorityFilter('S+A') },
    { value: 'S' as PriorityFilter, action: () => onSetPriorityFilter('S') },
  ];

  return (
    <div role="toolbar" aria-label={t('control.panel')}>
      <div className="flex flex-wrap gap-2.5 items-center">
        {/* Search logic toggle: AND/OR */}
        <div className="flex gap-1" role="radiogroup" aria-label={t('logic.label')}
          onKeyDown={(e) => handleRadioKeyDown(e, logicOptions, searchLogic)}
        >
          <button
            onClick={() => setSearchLogic('and')}
            role="radio"
            aria-checked={searchLogic === 'and'}
            className={`px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors ${
              searchLogic === 'and' ? 'bg-indigo-600 text-bright' : 'bg-raised text-muted hover:bg-gray-600'
            }`}
          >
            {t('logic.and')}
          </button>
          <button
            onClick={() => setSearchLogic('or')}
            role="radio"
            aria-checked={searchLogic === 'or'}
            className={`px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors ${
              searchLogic === 'or' ? 'bg-indigo-600 text-bright' : 'bg-raised text-muted hover:bg-gray-600'
            }`}
          >
            {t('logic.or')}
          </button>
        </div>

        {/* Active tokens counter (overflow counter) */}
        {activeTokenCount > 0 && (
          <span className="text-[12px] text-muted font-medium">
            {activeTokenCount} {t('selected')}
          </span>
        )}

        {/* Exclude summary indicator */}
        {excludedCount > 0 && (
          <span className="text-[12px] text-accent-red font-medium">
            {excludedCount} {t('summary.exclude').toLowerCase()}
          </span>
        )}

        {/* Range filter */}
        {hasRangedTokens && (
          <>
            <div className="flex items-center gap-1 text-[13px]">
              <span className="text-dim">&ge;</span>
              <input
                type="number"
                step="1"
                min={0}
                value={minValue ?? ''}
                onChange={(e) => { const v = parseInt(e.target.value, 10); setMinValue(e.target.value === '' || isNaN(v) || v < 0 ? null : v); }}
                placeholder={t('range.min')}
                aria-label={t('range.min_aria')}
                className="w-16 px-1.5 py-1 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-blue-500"
              />
              <span className="text-dim">&le;</span>
              <input
                type="number"
                step="1"
                min={0}
                value={maxValue ?? ''}
                onChange={(e) => { const v = parseInt(e.target.value, 10); setMaxValue(e.target.value === '' || isNaN(v) || v < 0 ? null : v); }}
                placeholder={t('range.max')}
                aria-label={t('range.max_aria')}
                className="w-16 px-1.5 py-1 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-blue-500"
              />
            </div>
            {minValue !== null && maxValue !== null && (
              <span className="text-[12px] text-dim">
                {minValue} &le; N &le; {maxValue}
              </span>
            )}
            {minValue !== null && maxValue === null && (
              <span className="text-[12px] text-dim">N &ge; {minValue}</span>
            )}
            {maxValue !== null && minValue === null && (
              <span className="text-[12px] text-dim">N &le; {maxValue}</span>
            )}
            {rangedSuffixes.length > 0 && (minValue !== null || maxValue !== null) && (
              <span className="text-[12px] text-faint">
                {t('suffixes.label')}: {rangedSuffixes.slice(0, 3).join(', ')}{rangedSuffixes.length > 3 ? '...' : ''}
              </span>
            )}
            {/* Number boundary warning for ≥40 — PoE2 regex limitation */}
            {minValue !== null && minValue >= 40 && (
              <span className="text-[12px] text-accent-amber-warn" title={t('range.boundary_warning')}>
                ⚠ ≥40
              </span>
            )}
            {/* Round10 + AND fallback warning: range >50 values uses AND fallback,
                where round10 expands each side independently */}
            {round10Enabled && minValue !== null && maxValue !== null && (maxValue - minValue + 1) > MAX_ENUMERATE_RANGE && (
              <span className="text-[12px] text-accent-amber-warn" title={t('range.round10_and_warning')}>
                ⚠ Округл.
              </span>
            )}
            {/* Range notation FP warning: numbers in item range notation (e.g., 27 from «27-50»)
                can match the enumeration pattern, causing false positives in-game.
                Show when any range filter is active. */}
            {(minValue !== null || maxValue !== null) && (
              <span className="text-[12px] text-accent-amber-dimmer" title={t('range.notation_fp_warning')}>
                ⚠ Диапазон
              </span>
            )}
          </>
        )}

        {/* Round10 toggle */}
        {showRound10Toggle && (
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={round10Enabled}
              onChange={(e) => setRound10Enabled(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-raised border-edge text-blue-500"
            />
            <span className="text-[12px] text-muted">{t('round10')}</span>
          </label>
        )}

        {/* Threshold mode toggle */}
        {hasRangedTokens && minValue !== null && maxValue !== null && (
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={thresholdEnabled}
              onChange={(e) => setThresholdEnabled(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-raised border-edge text-amber-500"
            />
            <span className="text-[12px] text-muted" title={t('threshold.tooltip')}>{t('threshold.label')}</span>
          </label>
        )}

        {/* Clear button slot */}
        {clearButton}

        {/* Priority tier filter */}
        {showPriorityFilter && (
          <div className="flex items-center gap-1">
            <span className="text-[12px] text-dim">{t('priority.label')}</span>
            <div className="flex gap-0.5" role="radiogroup" aria-label={t('priority.label')}
              onKeyDown={(e) => handleRadioKeyDown(e, priorityOptions, priorityFilter)}
            >
              <button
                onClick={() => onSetPriorityFilter('all')}
                role="radio"
                aria-checked={priorityFilter === 'all'}
                className={`px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors ${
                  priorityFilter === 'all' ? 'bg-gray-600 text-bright' : 'bg-raised text-muted hover:bg-gray-600'
                }`}
              >
                {t('priority.all')}
              </button>
              <button
                onClick={() => onSetPriorityFilter('S+A')}
                role="radio"
                aria-checked={priorityFilter === 'S+A'}
                className={`px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors ${
                  priorityFilter === 'S+A' ? 'bg-amber-600 text-bright' : 'bg-raised text-muted hover:bg-gray-600'
                }`}
              >
                {t('priority.sa')}
              </button>
              <button
                onClick={() => onSetPriorityFilter('S')}
                role="radio"
                aria-checked={priorityFilter === 'S'}
                className={`px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors ${
                  priorityFilter === 'S' ? 'bg-amber-500 text-bright' : 'bg-raised text-muted hover:bg-gray-600'
                }`}
              >
                {t('priority.s_only')}
              </button>
            </div>
          </div>
        )}

        {/* Category-specific controls slot */}
        {extraControls}
      </div>
    </div>
  );
};
