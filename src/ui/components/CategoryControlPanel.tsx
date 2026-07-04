/**
 * CategoryControlPanel — Shared controls row for category pages.
 *
 * Renders ONLY the controls row (no RegexOutput, no sticky wrapper).
 * Used by all 8 category pages via <CategoryLayout>'s `controls` slot.
 * <RegexOutput> lives separately in <CategoryLayout>'s `regexOutput` slot
 * (right column, sticky via <aside>).
 *
 * Contains:
 * - Search logic toggle (Все И / Любой ИЛИ) — prominent amber buttons,
 *   always visible (used constantly per user scenario).
 * - Range filter (≥ min, ≤ max) — conditional on hasRangedTokens
 * - Round10 toggle — conditional on hasRangedTokens (or showRound10)
 * - Within-block sort mode — compact <select> (iter 148: was 2-button radiogroup)
 * - Show-selected-only toggle — compact <select> (iter 148: was 2-button radiogroup)
 * - Slot for category-specific controls (waystone state, tablet types, etc.)
 * - Optional clear button slot
 *
 * iter 148 (toolbar refactor): sort/show-mode toggles collapsed from
 * radiogroups into <select>s to reduce visual noise. The И/ИЛИ toggle
 * stays as prominent buttons because it changes query semantics (constant
 * usage). See docs/ITER148_TOOLBAR_REFACTOR.md for full rationale.
 *
 * iter 149: Priority tier filter (`<select aria-label="Приоритет">`) removed
 * entirely — the feature was rarely used and added visual clutter. All
 * `priorityFilter`, `setPriorityFilter`, `showPriorityFilter` props and
 * `PriorityFilter` type gone. URL `p` key silently ignored for old links.
 *
 * History: iter 52 introduced a non-breaking `hideRegexOutput` prop with two
 * modes (legacy embedded RegexOutput + sticky wrapper, and split controls-only).
 * iter 53 migrated all 8 pages to split mode. iter 54 removed the legacy
 * branch and unused props (regex, isOverflow, regexParts, filterStore,
 * hideRegexOutput) since they were never consumed in split mode.
 */
import React from 'react';
import type { SearchLogic, SortMode } from '@shared/types';
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
  /**
   * Within-block sort mode (iter 106 P4). Optional — only shown when
   * `showSortMode` is true AND the page passes `setSortMode`.
   *  - 'alpha'      : familyKey primary, priorityTier tiebreaker (iter 99 default)
   *  - 'tier-first' : priorityTier (S→A→B→C) primary, familyKey tiebreaker
   */
  sortMode?: SortMode;
  /** Set within-block sort mode. Optional — paired with `sortMode` + `showSortMode`. */
  setSortMode?: (v: SortMode) => void;
  /** Whether to show the sort mode toggle. Only shown for categories that have
   *  priority classification. */
  showSortMode?: boolean;
  /** Slot for category-specific controls (waystone state, tablet types, etc.) */
  extraControls?: React.ReactNode;
  /**
   * Explicitly show round10 toggle regardless of hasRangedTokens.
   * Used by VendorPage which has numeric inputs but no ranged mod tokens.
   */
  showRound10?: boolean;
  /** Slot for a clear/reset button (used by VendorPage) */
  clearButton?: React.ReactNode;
  /** Count of excluded ("don't want") mods for summary.
   *  iter 161: now counts family GROUPS (affixes), not individual tokens —
   *  a 12-tier affix chip = 1 family group, displayed as "1 исключить". */
  excludedCount?: number;
  /** Number of active (selected + excluded) tokens — for budget-aware warnings.
   *  iter 161: now counts family GROUPS, not tokens. */
  activeTokenCount?: number;
  /** iter 161: Count of optional ("opt") family groups in MIXED mode.
   *  When > 0 and searchLogic==='mixed', renders an amber counter next to
   *  the active/excluded counters: «N опц.». Visual cue that the user has
   *  marked some affixes as optional (shift+click). */
  optionalCount?: number;

  // ─── Phase 3 (iter 135): show-selected-only toggle ─────────────────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 3 for full spec.
  // When true, ModList/VirtualizedModList filter familyGroups to only those
  // with selected/excluded/pinned members. iter 148 (toolbar refactor):
  // toggle is a compact <select> («Все» / «Выбранные (N)») placed next to
  // the sortMode select. Was a 2-button radiogroup before iter 148.

  /** Current value of `showSelectedOnly` from filter-store.
   *  Optional — when omitted, the toggle is NOT rendered (backward compat). */
  showSelectedOnly?: boolean;
  /** Set show-selected-only mode. Optional — when omitted, toggle not rendered. */
  onSetShowSelectedOnly?: (v: boolean) => void;
  /** Count of selected tokens — for the «Выбранные (N)» option label.
   *  When 0, the «Выбранные» option is disabled. */
  selectedCount?: number;
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
  sortMode = 'alpha',
  setSortMode,
  showSortMode,
  excludedCount = 0,
  activeTokenCount = 0,
  // iter 161: optional count for MIXED mode (family groups, not tokens)
  optionalCount = 0,
  // Phase 3 (iter 135): show-selected-only toggle
  showSelectedOnly = false,
  onSetShowSelectedOnly,
  selectedCount = 0,
}) => {
  const showRound10Toggle = showRound10 ?? hasRangedTokens;

  // Logic toggle options for arrow key navigation.
  // iter 159: added 'mixed' for combined AND+OR mode (MIXED_OR pattern).
  // Arrow keys cycle AND → OR → MIXED → AND (wraps). The 3rd button gets
  // a distinct amber-soft active style so the user can tell at a glance
  // that MIXED mode is on (chip behavior changes: shift+click = opt).
  const logicOptions = [
    { value: 'and' as SearchLogic, action: () => setSearchLogic('and') },
    { value: 'or' as SearchLogic, action: () => setSearchLogic('or') },
    { value: 'mixed' as SearchLogic, action: () => setSearchLogic('mixed') },
  ];

  // iter 148 (toolbar refactor): sortMode moved from a radiogroup to a compact
  // <select>. The previous sortOptions array + handleRadioKeyDown wiring are
  // no longer needed — <select> has native arrow-key navigation per ARIA spec.
  // Fallback no-op when setter is not provided (backward compat).
  const onSetSortMode = setSortMode ?? (() => {});

  return (
    <div role="toolbar" aria-label={t('control.panel')}>
      <div className="flex flex-wrap gap-2.5 items-center">
        {/* Search logic toggle: AND/OR/MIXED.
            iter 159: added MIXED button (combined AND+OR pattern).
            AND/OR keep the existing amber-600 active style; MIXED gets
            amber-soft (amber-400) so the user can tell at a glance that
            chip behavior has changed (shift+click = opt, right-click = exclude). */}
        <div className="flex gap-1" role="radiogroup" aria-label={t('logic.label')}
          onKeyDown={(e) => handleRadioKeyDown(e, logicOptions, searchLogic)}
        >
          <button
            onClick={() => setSearchLogic('and')}
            role="radio"
            aria-checked={searchLogic === 'and'}
            className={`px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors ${
              searchLogic === 'and' ? 'bg-amber-600 text-bright' : 'bg-surface text-muted hover:bg-chip-hover'
            }`}
          >
            {t('logic.and')}
          </button>
          <button
            onClick={() => setSearchLogic('or')}
            role="radio"
            aria-checked={searchLogic === 'or'}
            className={`px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors ${
              searchLogic === 'or' ? 'bg-amber-600 text-bright' : 'bg-surface text-muted hover:bg-chip-hover'
            }`}
          >
            {t('logic.or')}
          </button>
          <button
            onClick={() => setSearchLogic('mixed')}
            role="radio"
            aria-checked={searchLogic === 'mixed'}
            title={t('logic.mixed_tooltip')}
            className={`px-2.5 py-1.5 rounded text-[13px] font-medium transition-colors ${
              searchLogic === 'mixed' ? 'bg-accent-amber-soft text-bright' : 'bg-surface text-muted hover:bg-chip-hover'
            }`}
          >
            {t('logic.mixed')}
          </button>
        </div>

        {/* Active tokens counter (overflow counter).
            iter 161: counts family groups (affixes), not raw tokens.
            A 12-tier affix chip = 1 family group → displays as «1 выбрано». */}
        {activeTokenCount > 0 && (
          <span className="text-[12px] text-muted font-medium">
            {activeTokenCount} {t('selected')}
          </span>
        )}

        {/* iter 161: Optional counter (MIXED mode only).
            Shows the number of family groups marked as OPT (shift+click).
            Visual cue that the user has opted-in some affixes as "at least 1
            of these". Hidden when 0 OR when not in MIXED mode. */}
        {searchLogic === 'mixed' && optionalCount > 0 && (
          <span className="text-[12px] text-accent-amber-warn font-medium" title={t('logic.mixed_tooltip')}>
            {optionalCount} {t('summary.optional').toLowerCase()}
          </span>
        )}

        {/* Exclude summary indicator.
            iter 161: counts family groups, not tokens. */}
        {excludedCount > 0 && (
          <span className="text-[12px] text-accent-red font-medium">
            {excludedCount} {t('summary.exclude').toLowerCase()}
          </span>
        )}

        {/* iter 161: MIXED-mode onboarding hint.
            When user enables MIXED mode but hasn't marked any OPT yet,
            show a compact inline hint explaining shift+click. Disappears
            as soon as the user shift+clicks at least one affix (optionalCount > 0).
            Only shown when there's at least 1 active selection (otherwise the
            hint is noise on an empty page). */}
        {searchLogic === 'mixed' && optionalCount === 0 && activeTokenCount > 0 && (
          <span className="text-[11px] text-dim italic" title={t('logic.mixed_tooltip')}>
            {t('logic.mixed_hint')}
          </span>
        )}

        {/* Range filter — iter 61 (Phase 8 polish): removed always-on `⚠ Диапазон`
            visible badge (was firing on every range use = pure noise). The FP
            warning is now in the title of the range container — hover to see.
            Visible badges kept ONLY for specific/actionable warnings: `⚠ ≥40`
            (PoE2 boundary at 40) and `⚠ Округл.` (round10 + >50 range AND fallback). */}
        {hasRangedTokens && (
          <>
            <div
              className="flex items-center gap-1 text-[13px]"
              title={(minValue !== null || maxValue !== null) ? t('range.notation_fp_warning') : undefined}
            >
              <span className="text-dim">&ge;</span>
              <input
                type="number"
                step="1"
                min={0}
                value={minValue ?? ''}
                onChange={(e) => { const v = parseInt(e.target.value, 10); setMinValue(e.target.value === '' || isNaN(v) || v < 0 ? null : v); }}
                placeholder={t('range.min')}
                aria-label={t('range.min_aria')}
                className="w-16 px-1.5 py-1 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
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
                className="w-16 px-1.5 py-1 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
              />
            </div>
            {/* iter 70: text-dim → text-muted for better contrast */}
            {minValue !== null && maxValue !== null && (
              <span className="text-[12px] text-muted">
                {minValue} &le; N &le; {maxValue}
              </span>
            )}
            {minValue !== null && maxValue === null && (
              <span className="text-[12px] text-muted">N &ge; {minValue}</span>
            )}
            {maxValue !== null && minValue === null && (
              <span className="text-[12px] text-muted">N &le; {maxValue}</span>
            )}
            {rangedSuffixes.length > 0 && (minValue !== null || maxValue !== null) && (
              <span className="text-[12px] text-dim">
                {t('suffixes.label')}: {rangedSuffixes.slice(0, 3).join(', ')}{rangedSuffixes.length > 3 ? '...' : ''}
              </span>
            )}
            {/* Number boundary warning for ≥40 — PoE2 regex limitation (specific, actionable) */}
            {minValue !== null && minValue >= 40 && (
              <span className="text-[12px] text-accent-amber-warn" title={t('range.boundary_warning')}>
                ⚠ ≥40
              </span>
            )}
            {/* Round10 + AND fallback warning: range >50 values uses AND fallback,
                where round10 expands each side independently (specific, actionable) */}
            {round10Enabled && minValue !== null && maxValue !== null && (maxValue - minValue + 1) > MAX_ENUMERATE_RANGE && (
              <span className="text-[12px] text-accent-amber-warn" title={t('range.round10_and_warning')}>
                ⚠ Округл.
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
              className="w-3.5 h-3.5 rounded bg-raised border-edge text-accent-amber"
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
              className="w-3.5 h-3.5 rounded bg-raised border-edge text-accent-amber"
            />
            <span className="text-[12px] text-muted" title={t('threshold.tooltip')}>{t('threshold.label')}</span>
          </label>
        )}

        {/* Clear button slot */}
        {clearButton}

        {/* iter 106 (P4): within-block sort mode (alpha vs tier-first).
            iter 148 (toolbar refactor): replaced 2-button radiogroup with
            compact <select>. */}
        {showSortMode && setSortMode && (
          <select
            value={sortMode}
            onChange={(e) => onSetSortMode(e.target.value as SortMode)}
            aria-label={t('sort.label_short')}
            className="px-2.5 py-1.5 bg-surface border border-edge rounded text-[13px] text-bright focus:outline-none focus:border-accent-amber cursor-pointer"
          >
            <option value="alpha">{t('sort.alpha')}</option>
            <option value="tier-first">{t('sort.tier_first')}</option>
          </select>
        )}

        {/* Phase 3 (iter 135): show-selected-only toggle.
            iter 148 (toolbar refactor): replaced 2-button radiogroup with
            compact <select>. Old long label «Режим отображения аффиксов»
            replaced with short aria-label «Показывать» (filter.show_mode_label_short)
            — the user is already in the affix list, no need to re-state
            context. Selected count surfaced via the option label itself.
            Backward compat: when onSetShowSelectedOnly is NOT provided
            (e.g. VendorPage uses custom FilterChip), the select is NOT rendered.
            iter 140 (KI#25): `title` tooltip preserved on the wrapper to
            explain what the toggle does when the user hovers. */}
        {onSetShowSelectedOnly && (
          <select
            value={showSelectedOnly ? 'selected' : 'all'}
            onChange={(e) => onSetShowSelectedOnly(e.target.value === 'selected')}
            disabled={selectedCount === 0}
            aria-label={t('filter.show_mode_label_short')}
            title={t('filter.show_mode_hint')}
            className={`px-2.5 py-1.5 bg-surface border border-edge rounded text-[13px] text-bright focus:outline-none focus:border-accent-amber cursor-pointer ${
              selectedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <option value="all">{t('filter.show_all')}</option>
            <option value="selected">
              {t('filter.show_selected').replace('{n}', String(selectedCount))}
            </option>
          </select>
        )}

        {/* Category-specific controls slot */}
        {extraControls}
      </div>
    </div>
  );
};
