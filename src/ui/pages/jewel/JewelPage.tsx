/**
 * JewelPage — Category page for Jewels.
 *
 * Layout v4 (iter 59): Uses <CategoryLayout> with mobileBar slot —
 * 2-column desktop (controls + ModList on left, sticky RegexOutput + status +
 * ProfilePanel on right), 1-column mobile (status + sidebar below ModList,
 * RegexOutput + alerts in sticky bottom-bar via <MobileRegexBar>).
 *
 * Loads and merges three JSON files:
 * - jewel.json (193 normal tokens)
 * - jewel-desecrated.json (47 desecrated tokens, including multi-line splits)
 * - jewel-corrupted.json (10 corrupted tokens)
 *
 * Grouping mode (iter 87): `jewel-functional` — same 24-block functional
 * scheme as ring/amulet/belt (`affix-functional`), but the `weapon-specific`
 * block is split into 6 weapon-class sub-blocks (melee / bow / crossbow /
 * staff / spear / dagger). The 24 weapon-specific family-keys in jewel.json
 * are distributed across these 6 sub-blocks based on weapon name. See
 * `classifyWeaponClass()` in `src/shared/mod-classifier.ts` for the mapping.
 *
 * Jewel type filter: Ruby/Emerald/Sapphire/All buttons filter tokens by
 * jewel-type heuristics (weighted scoring classification via classifyJewelType).
 * "All" shows the complete list; specific types show only mods that match
 * that jewel type plus shared mods.
 *
 * Hidden mods warning: when active (selected/excluded) tokens are filtered
 * out by the jewel type filter, an alert with a "Deselect hidden" button
 * appears in StatusPanel (desktop) and inside MobileRegexBar (mobile).
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCategoryPage, useFilterStore } from '@ui/hooks/useCategoryPage';
import { VirtualizedModList } from '@ui/components/VirtualizedModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { CategoryLayout } from '@ui/layout/CategoryLayout';
import { StatusPanel } from '@ui/components/StatusPanel';
import { SelectedBasket } from '@ui/components/SelectedBasket';
// iter 139 (KI#20): favorites now via FavoritesIndicator badge (page header),
// not a separate left-panel chip list (was noise per user feedback).
// Component file kept for backward compat.
// iter 140 (KI#24): FavoritesIndicator added — compact `★ N` badge in the
// page header (next to mod count).
import { FavoritesIndicator } from '@ui/components/FavoritesIndicator';
import { IconLegend } from '@ui/components/IconLegend';
import { MobileRegexBar } from '@ui/components/MobileRegexBar';
import { t } from '@shared/i18n';
import { classifyJewelType, type JewelTypeCategory, JEWEL_TYPE_LABELS } from '@shared/mod-classifier';
import { groupTokensByFamily } from '@shared/family-grouper';
import type { GameToken } from '@shared/types';

/** Jewel type filter options for the control panel */
const JEWEL_TYPE_OPTIONS: { id: JewelTypeCategory | 'all'; labelKey: string; colorClass: string }[] = [
  { id: 'all', labelKey: 'jewel.type_all', colorClass: 'text-soft' },
  { id: 'ruby', labelKey: 'jewel.type_ruby', colorClass: JEWEL_TYPE_LABELS.ruby.colorClass },
  { id: 'emerald', labelKey: 'jewel.type_emerald', colorClass: JEWEL_TYPE_LABELS.emerald.colorClass },
  { id: 'sapphire', labelKey: 'jewel.type_sapphire', colorClass: JEWEL_TYPE_LABELS.sapphire.colorClass },
];

// iter 152 (KI#42): module-level constant for mergeCategories.
// Previously this was an inline array literal inside JewelPage's render body,
// which created a NEW array reference on every render. useCategoryData's
// useEffect dep array included `mergeCategories`, so the effect re-ran on
// every keystroke in the search box (searchText change → re-render → new
// array ref → effect re-run → setLoading(true) → PageStateWrapper unmounted
// children including the <input> → blur → user lost cursor).
// Hoisting to module level makes the reference stable for the lifetime of
// the module, so useCategoryData's effect runs only once per categoryId.
const JEWEL_MERGE_CATEGORIES = ['jewel-desecrated', 'jewel-corrupted'];

/**
 * Filter tokens by jewel type using heuristics.
 * When jewelType is 'all', returns all tokens.
 * When a specific type is selected, returns tokens that are either
 * classified as that type OR as 'shared' (common to all types).
 */
function filterTokensByJewelType(tokens: GameToken[], jewelType: JewelTypeCategory | 'all'): GameToken[] {
  if (jewelType === 'all') return tokens;

  // Group tokens by family to classify, then filter
  const familyGroups = groupTokensByFamily(tokens);
  const matchingFamilyKeys = new Set<string>();

  for (const group of familyGroups) {
    const type = classifyJewelType(group);
    if (type === jewelType || type === 'shared') {
      matchingFamilyKeys.add(group.familyKey);
    }
  }

  return tokens.filter(token => {
    const fk = token.familyKey.ru;
    return matchingFamilyKeys.has(fk);
  });
}

export function JewelPage() {
  // iter 79 (Bug #8 Phase 2): call useFilterStore BEFORE local useState so we
  // can lazy-init jewelTypeFilter from the URL-restored extraState. Eliminates
  // the previous `react-hooks/set-state-in-effect` lint error.
  const useStore = useFilterStore('jewel');

  const [jewelTypeFilter, setJewelTypeFilter] = useState<JewelTypeCategory | 'all'>(() => {
    const v = useStore.getState().getExtraState('jewelTypeFilter');
    if (typeof v === 'string' && v) return v as JewelTypeCategory | 'all';
    return 'all';
  });

  const {
    data, loading, error,
    regex, isRegexOverflow, regexParts,
    selectedIds, excludedIds, toggleExclude,
    round10Enabled, setRound10Enabled,
    minValue, setMinValue,
    maxValue, setMaxValue,
    searchText, affixFilter, originFilter,
    toggleTokens, setSearchText, setAffixFilter, setOriginFilter, clearSelections,
    categoryId, filterStore, restoreFilterState,
    perTokenRanges, setTokenRange, clearTokenRange,
    searchLogic, setSearchLogic,
    collapsedTokenIds,
    thresholdEnabled, setThresholdEnabled,
    sortMode, setSortMode,
    collapsedGroups, expandedSubGroups,
    toggleGroupCollapsed, toggleSubGroupExpanded,
    expandAllGroups, collapseAllGroups,
    expandAllSubGroups, collapseAllSubGroups,
    chipExpandState, toggleChipExpand,
    // Phase 3 (iter 135): show-selected-only toggle
    showSelectedOnly, setShowSelectedOnly,
    // Phase 5 (iter 136): favorites (pinned) state + actions
    pinnedIds, togglePinned,
  } = useCategoryPage({
    categoryId: 'jewel',
    // iter 152 (KI#42): use stable module-level constant — see comment above.
    mergeCategories: JEWEL_MERGE_CATEGORIES,
    filterStore: useStore,
  });

  // One-way write-back: local state → filterStore extraState (for URL sync + profile persistence).
  // No setState here — just Zustand `set()` calls — so no `set-state-in-effect` lint error.
  const syncReadyRef = useRef(false);

  useEffect(() => {
    if (!syncReadyRef.current) {
      syncReadyRef.current = true;
      return;
    }
    useStore.getState().setExtraState('jewelTypeFilter', jewelTypeFilter);
  }, [jewelTypeFilter, useStore]);

  // Filter tokens by jewel type before passing to ModList
  const filteredTokens = useMemo(() => {
    if (!data) return [];
    return filterTokensByJewelType(data.tokens, jewelTypeFilter);
  }, [data, jewelTypeFilter]);

  // Count active tokens (selected or excluded) that are hidden by the current jewel type filter
  const hiddenActiveIds = useMemo(() => {
    if (!data || jewelTypeFilter === 'all') return new Set<string>();
    const filteredIdSet = new Set(filteredTokens.map(t => t.id));
    const hidden: string[] = [];
    for (const id of selectedIds) {
      if (!filteredIdSet.has(id)) hidden.push(id);
    }
    for (const id of excludedIds) {
      if (!filteredIdSet.has(id)) hidden.push(id);
    }
    return new Set(hidden);
  }, [data, jewelTypeFilter, selectedIds, excludedIds, filteredTokens]);

  const hiddenActiveCount = hiddenActiveIds.size;

  // Deselect all tokens that are currently hidden by the jewel type filter
  const deselectHidden = useCallback(() => {
    if (hiddenActiveCount === 0) return;
    const remainingSelected = [...selectedIds].filter(id => !hiddenActiveIds.has(id));
    const remainingExcluded = [...excludedIds].filter(id => !hiddenActiveIds.has(id));
    clearSelections();
    if (remainingSelected.length > 0) {
      toggleTokens(remainingSelected);
    }
    // Re-add excluded tokens that aren't hidden
    if (remainingExcluded.length > 0) {
      toggleExclude(remainingExcluded);
    }
  }, [hiddenActiveCount, hiddenActiveIds, selectedIds, excludedIds, clearSelections, toggleTokens, toggleExclude]);

  // Phase 5 (iter 136): Family-level pinned toggle.
  // FilterChip's onTogglePinned expects (ids: string[]) => void,
  // but the store's togglePinned takes a single id.
  //
  // iter 141 (KI#28): we now toggle ONLY the first member ID per family,
  // NOT all members. This matches user mental model "1 click = 1 favorite"
  // — pinnedIds.size now equals the number of favorited families, not the
  // total count of individual token IDs (which was confusing: pinning a
  // 5-tier family showed counter = 5 instead of 1). FilterChip's isPinned
  // check (`memberIds.some(id => pinnedIds.has(id))`) still works because
  // the first member is in pinnedIds.
  //
  // Stable reference via useCallback so React.memo on FilterChip
  // doesn't re-render on every page render.
  const handleTogglePinned = useCallback((ids: string[]) => {
    if (ids.length > 0) togglePinned(ids[0]);
  }, [togglePinned]);

  return (
    <PageStateWrapper loading={loading} error={error} data={data}>
      {(data) => {
        const allActiveTokens = data.tokens.filter(tok => selectedIds.has(tok.id) || excludedIds.has(tok.id));
        const wantTokens = data.tokens.filter(tok => selectedIds.has(tok.id));
        const excludeTokens = data.tokens.filter(tok => excludedIds.has(tok.id));
        const hasRangedTokens = allActiveTokens.some(tok => tok.ranges.length > 0);
        const rangedSuffixes = [...new Set(
          allActiveTokens.filter(tok => tok.ranges.length > 0).map(tok => tok.regex.ru)
        )];

        return (
          <CategoryLayout
            header={
              <div className="flex items-center justify-between gap-2">
                <h2 className="poe-panel-header--inline text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
                  <img src={`${import.meta.env.BASE_URL}icons/jewel.png`} alt="" width={24} height={24} className="object-contain" />
                  {t('jewel.title')}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dim">{filteredTokens.length}/{data.tokens.length} {t('mods_word')}</span>
                  <FavoritesIndicator
                    pinnedIds={pinnedIds}
                    data={data}
                    categoryId={categoryId}
                    perTokenRanges={perTokenRanges}
                    onToggleTokens={toggleTokens}
                    onTogglePinned={togglePinned}
                    onSetTokenRange={setTokenRange}
                  />
                </div>
              </div>
            }
            controls={
              <CategoryControlPanel
                searchLogic={searchLogic}
                setSearchLogic={setSearchLogic}
                hasRangedTokens={hasRangedTokens}
                minValue={minValue}
                setMinValue={setMinValue}
                maxValue={maxValue}
                setMaxValue={setMaxValue}
                rangedSuffixes={rangedSuffixes}
                round10Enabled={round10Enabled}
                setRound10Enabled={setRound10Enabled}
                thresholdEnabled={thresholdEnabled}
                setThresholdEnabled={setThresholdEnabled}
                sortMode={sortMode}
                setSortMode={setSortMode}
                showSortMode
                excludedCount={excludeTokens.length}
                activeTokenCount={allActiveTokens.length}
                // Phase 3 (iter 135): show-selected-only toggle
                showSelectedOnly={showSelectedOnly}
                onSetShowSelectedOnly={setShowSelectedOnly}
                selectedCount={selectedIds.size}
                extraControls={
                  <div className="flex flex-wrap items-center gap-2 ml-2 pl-2 border-l border-edge-panel">
                    <span className="text-[12px] text-dim">{t('jewel.type_label')}</span>
                    {JEWEL_TYPE_OPTIONS.map(opt => (
                      <button key={opt.id}
                        onClick={() => setJewelTypeFilter(opt.id)}
                        className={`px-1.5 py-0.5 rounded text-[12px] font-medium transition-colors border ${
                          jewelTypeFilter === opt.id
                            ? 'bg-raised border-accent-amber text-bright'
                            : 'bg-surface border-edge-panel text-dim hover:border-edge'
                        }`}
                      >
                        <span className={jewelTypeFilter === opt.id ? opt.colorClass : ''}>
                          {t(opt.labelKey)}
                        </span>
                      </button>
                    ))}
                  </div>
                }
              />
            }
            basket={
              <SelectedBasket
                tokens={data.tokens}
                selectedIds={selectedIds}
                onToggleTokens={toggleTokens}
                onClearSelections={clearSelections}
                category={categoryId}
              />
            }
            regexOutput={
              <RegexOutput
                regex={regex}
                isOverflow={isRegexOverflow}
                regexParts={regexParts}
                filterStore={filterStore}
                activeTokenCount={allActiveTokens.length}
              />
            }
            status={
              <StatusPanel
                wantTokens={wantTokens}
                excludeTokens={excludeTokens}
                allActiveTokens={allActiveTokens}
                alerts={hiddenActiveCount > 0 ? [
                  <div className="flex items-center gap-2 px-3 py-2 bg-section-amber border border-aborder-amber rounded text-xs text-atext-amber" role="alert">
                    <span>{t('jewel.hidden_mods').replace('{n}', String(hiddenActiveCount))}</span>
                    <button
                      onClick={deselectHidden}
                      className="px-2 py-0.5 bg-abg-amber border border-aborder-amber-badge rounded text-[12px] text-atext-amber-light hover:bg-abg-amber-hover transition-colors"
                    >
                      {t('jewel.deselect_hidden')}
                    </button>
                  </div>
                ] : []}
              />
            }
            sidebar={
              <ProfilePanel
                category={categoryId}
                currentFilterData={filterStore.serialize()}
                onRestore={restoreFilterState}
              />
            }
            // Phase 4.5 (iter 137): static «Обозначения» legend at the bottom
            // of the right aside (below ProfilePanel). Companion to Phase 4
            // tooltips — gives beginners a permanent reference.
            legend={<IconLegend />}
            mobileBar={
              <MobileRegexBar
                regexOutput={
                  <RegexOutput
                    regex={regex}
                    isOverflow={isRegexOverflow}
                    regexParts={regexParts}
                    filterStore={filterStore}
                    activeTokenCount={allActiveTokens.length}
                  />
                }
                alerts={hiddenActiveCount > 0 ? [
                  <div className="flex items-center gap-2 px-3 py-2 bg-section-amber border border-aborder-amber rounded text-xs text-atext-amber" role="alert">
                    <span>{t('jewel.hidden_mods').replace('{n}', String(hiddenActiveCount))}</span>
                    <button
                      onClick={deselectHidden}
                      className="px-2 py-0.5 bg-abg-amber border border-aborder-amber-badge rounded text-[12px] text-atext-amber-light hover:bg-abg-amber-hover transition-colors"
                    >
                      {t('jewel.deselect_hidden')}
                    </button>
                  </div>
                ] : []}
              />
            }
          >
            {/* Hidden active mods alert is now rendered via StatusPanel alerts slot */}

            <VirtualizedModList
              tokens={filteredTokens}
              selectedIds={selectedIds}
              excludedIds={excludedIds}
              searchText={searchText}
              affixFilter={affixFilter}
              originFilter={originFilter}
              onToggleTokens={toggleTokens}
              onToggleExclude={toggleExclude}
              onSearchChange={setSearchText}
              onAffixFilterChange={setAffixFilter}
              onOriginFilterChange={setOriginFilter}
              onClearSelections={clearSelections}
              perTokenRanges={perTokenRanges}
              onSetTokenRange={setTokenRange}
              onClearTokenRange={clearTokenRange}
              collapsedTokenIds={collapsedTokenIds}
              groupMode="jewel-functional"
              showOriginSubSections
              category="jewel"
              sortMode={sortMode}
              collapsedGroups={collapsedGroups}
              expandedSubGroups={expandedSubGroups}
              onToggleGroupCollapsed={toggleGroupCollapsed}
              onToggleSubGroupExpanded={toggleSubGroupExpanded}
              onExpandAllGroups={expandAllGroups}
              onCollapseAllGroups={collapseAllGroups}
              onExpandAllSubGroups={expandAllSubGroups}
              onCollapseAllSubGroups={collapseAllSubGroups}
              chipExpandState={chipExpandState}
              onToggleChipExpand={toggleChipExpand}
              showSelectedOnly={showSelectedOnly}
              pinnedIds={pinnedIds}
              onTogglePinned={handleTogglePinned}
            />
          </CategoryLayout>
        );
      }}
    </PageStateWrapper>
  );
}
