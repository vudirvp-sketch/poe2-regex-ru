/**
 * CategoryControlPanel — Shared top control panel for category pages.
 *
 * Contains:
 * - RegexOutput with health bar (sticky)
 * - Mode toggle (Хочу / Не хочу)
 * - Range filter (≥ min, ≤ max) — conditional
 * - Round10 toggle — conditional
 * - Slot for category-specific controls (waystone state, tablet types, etc.)
 *
 * This component is placed ABOVE the ModList in the page layout,
 * so the regex output and controls are always visible.
 */
import React from 'react';
import { RegexOutput } from './RegexOutput';
import type { FilterStoreApi } from '@ui/hooks/useCategoryPage';
import { t } from '@shared/i18n';

interface CategoryControlPanelProps {
  regex: string;
  isOverflow: boolean;
  filterStore: FilterStoreApi;
  excludeMode: boolean;
  setExcludeMode: (v: boolean) => void;
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
}

export const CategoryControlPanel: React.FC<CategoryControlPanelProps> = ({
  regex,
  isOverflow,
  filterStore,
  excludeMode,
  setExcludeMode,
  hasRangedTokens,
  minValue,
  setMinValue,
  maxValue,
  setMaxValue,
  rangedSuffixes,
  round10Enabled,
  setRound10Enabled,
  extraControls,
}) => {
  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 -mt-1 pt-1 pb-3"
      style={{ background: 'var(--poe-bg, #0a0a0f)' }}
      role="toolbar"
      aria-label="Панель управления фильтрами"
    >
      {/* Regex output */}
      <RegexOutput regex={regex} isOverflow={isOverflow} filterStore={filterStore} />

      {/* Controls row */}
      <div className="flex flex-wrap gap-2 items-center mt-2">
        {/* Mode toggle */}
        <div className="flex gap-1" role="radiogroup" aria-label="Режим фильтра">
          <button
            onClick={() => setExcludeMode(false)}
            role="radio"
            aria-checked={!excludeMode}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              !excludeMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Хочу
          </button>
          <button
            onClick={() => setExcludeMode(true)}
            role="radio"
            aria-checked={excludeMode}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              excludeMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Не хочу
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
                onChange={(e) => setMinValue(e.target.value === '' ? null : parseInt(e.target.value, 10) || null)}
                placeholder="Мин"
                aria-label="Минимальное значение"
                className="w-16 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-500">&le;</span>
              <input
                type="number"
                min={0}
                value={maxValue ?? ''}
                onChange={(e) => setMaxValue(e.target.value === '' ? null : parseInt(e.target.value, 10) || null)}
                placeholder="Макс"
                aria-label="Максимальное значение"
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
                суффиксы: {rangedSuffixes.slice(0, 3).join(', ')}{rangedSuffixes.length > 3 ? '...' : ''}
              </span>
            )}
          </>
        )}

        {/* Round10 toggle */}
        {hasRangedTokens && (
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

        {/* Category-specific controls slot */}
        {extraControls}
      </div>
    </div>
  );
};
