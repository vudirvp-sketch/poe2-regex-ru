/**
 * JewelPage — Category page for Jewels.
 *
 * Layout v4: Virtualized two-column mod list (Prefix | Suffix)
 * with semantic sub-grouping, matching BeltPage/RingPage/AmuletPage layout.
 * Uses VirtualizedModList for smooth rendering of 250+ tokens.
 *
 * Loads and merges three JSON files:
 * - jewel.json (193 normal tokens)
 * - jewel-desecrated.json (47 desecrated tokens, including multi-line splits)
 * - jewel-corrupted.json (10 corrupted tokens)
 *
 * Jewel type filter: Ruby/Emerald/Sapphire/All buttons filter tokens by
 * jewel-type heuristics (weighted scoring classification via classifyJewelType).
 * "All" shows the complete list; specific types show only mods that match
 * that jewel type plus shared mods.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { VirtualizedModList } from '@ui/components/VirtualizedModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { t } from '@shared/i18n';
import { countUniqueFamilyKeys, groupTokensByFamily } from '@shared/family-grouper';
import { classifyJewelType, type JewelTypeCategory, JEWEL_TYPE_LABELS } from '@shared/mod-classifier';
import type { GameToken } from '@shared/types';

/** Jewel type filter options for the control panel */
const JEWEL_TYPE_OPTIONS: { id: JewelTypeCategory | 'all'; labelKey: string; colorClass: string }[] = [
  { id: 'all', labelKey: 'jewel.type_all', colorClass: 'text-gray-300' },
  { id: 'ruby', labelKey: 'jewel.type_ruby', colorClass: JEWEL_TYPE_LABELS.ruby.colorClass },
  { id: 'emerald', labelKey: 'jewel.type_emerald', colorClass: JEWEL_TYPE_LABELS.emerald.colorClass },
  { id: 'sapphire', labelKey: 'jewel.type_sapphire', colorClass: JEWEL_TYPE_LABELS.sapphire.colorClass },
];

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
  const [jewelTypeFilter, setJewelTypeFilter] = useState<JewelTypeCategory | 'all'>('all');

  const {
    data, loading, error,
    regex, isRegexOverflow,
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
    priorityFilter, setPriorityFilter,
  } = useCategoryPage({
    categoryId: 'jewel',
    mergeCategories: ['jewel-desecrated', 'jewel-corrupted'],
  });

  const syncReadyRef = useRef(false);

  useEffect(() => {
    const extra = filterStore.getExtraState('jewelTypeFilter');
    if (extra && typeof extra === 'string') setJewelTypeFilter(extra as JewelTypeCategory | 'all');
    syncReadyRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncReadyRef.current) return;
    filterStore.setExtraState('jewelTypeFilter', jewelTypeFilter);
  }, [jewelTypeFilter, filterStore]);

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
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
                <img src={`${import.meta.env.BASE_URL}icons/jewel.png`} alt="" width={24} height={24} className="object-contain" />
                {t('jewel.title')}
              </h2>
              <span className="text-xs text-gray-500">{filteredTokens.length}/{data.tokens.length} {t('mods_word')}</span>
            </div>

            <CategoryControlPanel
              regex={regex}
              isOverflow={isRegexOverflow}
              filterStore={filterStore}
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
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              showPriorityFilter
              excludedCount={excludeTokens.length}
              activeTokenCount={allActiveTokens.length}
              extraControls={
                <div className="flex flex-wrap items-center gap-2 ml-2 pl-2 border-l border-gray-700">
                  <span className="text-[10px] text-gray-500">{t('jewel.type_label')}</span>
                  {JEWEL_TYPE_OPTIONS.map(opt => (
                    <button key={opt.id}
                      onClick={() => setJewelTypeFilter(opt.id)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                        jewelTypeFilter === opt.id
                          ? 'bg-gray-700 border-gray-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
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

            {/* Hidden active mods warning */}
            {hiddenActiveCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-300" role="alert">
                <span>{t('jewel.hidden_mods').replace('{n}', String(hiddenActiveCount))}</span>
                <button
                  onClick={deselectHidden}
                  className="px-2 py-0.5 bg-amber-800/50 border border-amber-600/50 rounded text-[10px] text-amber-200 hover:bg-amber-700/50 transition-colors"
                >
                  {t('jewel.deselect_hidden')}
                </button>
              </div>
            )}

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
              groupMode="affix-semantic"
              showOriginSubSections
              category="jewel"
              priorityFilter={priorityFilter}
            />

            <div className="flex flex-col gap-3">
              <ProfilePanel
                category={categoryId}
                currentFilterData={filterStore.serialize()}
                onRestore={restoreFilterState}
              />

              {allActiveTokens.length > 0 && (
                <div className="bg-gray-900 border border-gray-700 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">{t('summary.selected')}: {countUniqueFamilyKeys(wantTokens)} {t('mods_word')}</div>
                  {excludeTokens.length > 0 && (
                    <div className="text-xs text-red-400 mb-1">{t('summary.exclude')}: {countUniqueFamilyKeys(excludeTokens)} {t('mods_word')}</div>
                  )}
                  <div className="text-[10px] text-gray-600">
                    {t('summary.include')}: {wantTokens.map(tok => tok.rawText.ru.slice(0, 30)).join(', ')}
                  </div>
                  {excludeTokens.length > 0 && (
                    <div className="text-[10px] text-red-500/60">
                      {t('summary.exclude')}: {excludeTokens.map(tok => tok.rawText.ru.slice(0, 30)).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }}
    </PageStateWrapper>
  );
}
