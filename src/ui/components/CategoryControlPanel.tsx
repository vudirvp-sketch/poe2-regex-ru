/**
 * CategoryControlPanel — Shared top control panel for category pages.
 *
 * Contains:
 * - RegexOutput with health bar (sticky)
 * - Mode toggle (Хочу / Не хочу)
 * - Range filter (≥ min, ≤ max) — conditional on hasRangedTokens
 * - Round10 toggle — conditional on hasRangedTokens (or showRound10)
 * - Slot for category-specific controls (waystone state, tablet types, etc.)
 * - Optional clear button slot
 *
 * This component is placed ABOVE the ModList in the page layout,
 * so the regex output and controls are always visible.
 */
import React from 'react';
import { RegexOutput } from './RegexOutput';
import type { FilterStoreApi } from '@ui/hooks/useCategoryPage';
import type { SearchLogic } from '@shared/types';
import { t } from '@shared/i18n';

interface CategoryControlPanelProps {
  regex: string;
  isOverflow: boolean;
  filterStore: FilterStoreApi;
  excludeMode: boolean;
  setExcludeMode: (v: boolean) => void;
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
  /** Slot for category-specific controls (waystone state, tablet types, etc.) */
  extraControls?: React.ReactNode;
  /**
   * Explicitly show round10 toggle regardless of hasRangedTokens.
   * Used by VendorPage which has numeric inputs but no ranged mod tokens.
   */
  showRound10?: boolean;
  /** Slot for a clear/reset button (used by VendorPage) */
  clearButton?: React.ReactNode;
}

export const CategoryControlPanel: React.FC<CategoryControlPanelProps> = ({
  regex,
  isOverflow,
  filterStore,
  excludeMode,
  setExcludeMode,
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
  extraControls,
  showRound10,
  clearButton,
}) => {
  const showRound10Toggle = showRound10 ?? hasRangedTokens;

  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 -mt-1 pt-1 pb-3"
      style={{ background: 'var(--poe-bg, #0a0a0f)' }}
      role="toolbar"
      aria-label={t('control.panel')}
    >
      {/* Regex output */}
      <RegexOutput regex={regex} isOverflow={isOverflow} filterStore={filterStore} />

      {/* Controls row */}
      <div className="flex flex-wrap gap-2 items-center mt-2">
        {/* Mode toggle */}
        <div className="flex gap-1" role="radiogroup" aria-label={t('mode.want')}>
          <button
            onClick={() => setExcludeMode(false)}
            role="radio"
            aria-checked={!excludeMode}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              !excludeMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {t('mode.want')}
          </button>
          <button
            onClick={() => setExcludeMode(true)}
            role="radio"
            aria-checked={excludeMode}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              excludeMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {t('mode.dont_want')}
          </button>
        </div>

        {/* Search logic toggle: AND/OR */}
        <div className="flex gap-1" role="radiogroup" aria-label={t('logic.label')}>
          <button
            onClick={() => setSearchLogic('and')}
            role="radio"
            aria-checked={searchLogic === 'and'}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              searchLogic === 'and' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {t('logic.and')}
          </button>
          <button
            onClick={() => setSearchLogic('or')}
            role="radio"
            aria-checked={searchLogic === 'or'}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              searchLogic === 'or' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {t('logic.or')}
          </button>
        </div>

        {/* Range filter */}
        {hasRangedTokens && (
          <>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-500">&ge;</span>
              <input
                type="number"
                min={0}
                value={minValue ?? ''}
                onChange={(e) => { const v = parseInt(e.target.value, 10); setMinValue(e.target.value === '' || isNaN(v) || v < 0 ? null : v); }}
                placeholder={t('range.min')}
                aria-label={t('range.min_aria')}
                className="w-16 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-500">&le;</span>
              <input
                type="number"
                min={0}
                value={maxValue ?? ''}
                onChange={(e) => { const v = parseInt(e.target.value, 10); setMaxValue(e.target.value === '' || isNaN(v) || v < 0 ? null : v); }}
                placeholder={t('range.max')}
                aria-label={t('range.max_aria')}
                className="w-16 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            {minValue !== null && maxValue !== null && (
              <span className="text-[10px] text-gray-500">
                {minValue} &le; N &le; {maxValue}
              </span>
            )}
            {minValue !== null && maxValue === null && (
              <span className="text-[10px] text-gray-500">N &ge; {minValue}</span>
            )}
            {maxValue !== null && minValue === null && (
              <span className="text-[10px] text-gray-500">N &le; {maxValue}</span>
            )}
            {rangedSuffixes.length > 0 && (minValue !== null || maxValue !== null) && (
              <span className="text-[10px] text-gray-600">
                {t('suffixes.label')}: {rangedSuffixes.slice(0, 3).join(', ')}{rangedSuffixes.length > 3 ? '...' : ''}
              </span>
            )}
            {/* Number boundary warning for ≥40 — PoE2 regex limitation */}
            {minValue !== null && minValue >= 40 && (
              <span className="text-[10px] text-amber-500/80" title={t('range.boundary_warning')}>
                ⚠ ≥40
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
              className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-blue-500"
            />
            <span className="text-[10px] text-gray-400">{t('round10')}</span>
          </label>
        )}

        {/* Clear button slot */}
        {clearButton}

        {/* Category-specific controls slot */}
        {extraControls}
      </div>
    </div>
  );
};
