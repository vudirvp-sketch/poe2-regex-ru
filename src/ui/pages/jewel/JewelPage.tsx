/**
 * JewelPage — Category page for Jewels.
 *
 * Layout v2: Control panel sticky at top, mod list full width below
 * with origin-based grouping (normal/desecrated/corrupted → prefix/suffix within each origin).
 *
 * Loads and merges three JSON files:
 * - jewel.json (193 normal tokens)
 * - jewel-desecrated.json (21 desecrated tokens)
 * - jewel-corrupted.json (10 corrupted tokens)
 *
 * The `groupMode="origin"` in ModList then groups them visually:
 * Обычные → prefix/suffix, Очернённые → prefix/suffix, Осквернённые → prefix/suffix.
 *
 * Jewel type filter: Ruby/Emerald/Sapphire/All buttons filter tokens by
 * jewel-type heuristics (text-based classification via classifyJewelType).
 * "All" shows the complete list; specific types show only mods that match
 * that jewel type plus shared mods.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { t } from '@shared/i18n';
import { classifyJewelType, type JewelTypeCategory, JEWEL_TYPE_LABELS } from '@shared/mod-classifier';
import { groupTokensByFamily } from '@shared/family-grouper';
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
    // Check if any family group this token belongs to matches
    // Use familyKey from token's rawTextTemplate
    const fk = token.familyKey.ru;
    return matchingFamilyKeys.has(fk);
  });
}

export function JewelPage() {
  const [jewelTypeFilter, setJewelTypeFilter] = useState<JewelTypeCategory | 'all'>('all');

  const {
    data, loading, error,
    regex, isRegexOverflow,
    excludeMode, setExcludeMode,
    round10Enabled, setRound10Enabled,
    minValue, setMinValue,
    maxValue, setMaxValue,
    selectedIds, searchText, affixFilter, originFilter,
    toggleTokens, setSearchText, setAffixFilter, setOriginFilter, clearSelections,
    categoryId, filterStore, restoreFilterState,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2" />
          <p className="text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-300 text-sm">
          {t('load_error')} {error}
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-4 text-gray-500">{t('no_data')}</div>;

  const selectedTokens = data.tokens.filter(tok => selectedIds.has(tok.id));
  const hasRangedTokens = selectedTokens.some(tok => tok.ranges.length > 0);
  const rangedSuffixes = [...new Set(
    selectedTokens.filter(tok => tok.ranges.length > 0).map(tok => tok.regex.ru)
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
        excludeMode={excludeMode}
        setExcludeMode={setExcludeMode}
        hasRangedTokens={hasRangedTokens}
        minValue={minValue}
        setMinValue={setMinValue}
        maxValue={maxValue}
        setMaxValue={setMaxValue}
        rangedSuffixes={rangedSuffixes}
        round10Enabled={round10Enabled}
        setRound10Enabled={setRound10Enabled}
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

      <ModList
        tokens={filteredTokens}
        selectedIds={selectedIds}
        searchText={searchText}
        affixFilter={affixFilter}
        originFilter={originFilter}
        onToggleTokens={toggleTokens}
        onSearchChange={setSearchText}
        onAffixFilterChange={setAffixFilter}
        onOriginFilterChange={setOriginFilter}
        onClearSelections={clearSelections}
        groupMode="origin"
      />

      <div className="flex flex-col gap-3">
        <ProfilePanel
          category={categoryId}
          currentFilterData={filterStore.serialize()}
          onRestore={restoreFilterState}
        />

        {selectedTokens.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">{t('summary.selected')}: {selectedTokens.length} {t('mods_word')}</div>
            <div className="text-[10px] text-gray-600">
              {excludeMode ? t('summary.exclude') : t('summary.include')}: {selectedTokens.map(tok => tok.rawText.ru.slice(0, 30)).join(', ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
