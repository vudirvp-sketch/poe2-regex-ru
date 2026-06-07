/**
 * AmuletPage — Category page for Amulets.
 *
 * Layout v2: Control panel (regex + controls) sticky at top,
 * mod list full width below with two-column prefix/suffix layout
 * and semantic sub-grouping (offensive/defensive/attribute/neutral).
 */
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { VirtualizedModList } from '@ui/components/VirtualizedModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { t } from '@shared/i18n';
import { countUniqueFamilyKeys } from '@shared/family-grouper';

export function AmuletPage() {
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
    perTokenRanges, setTokenRange, clearTokenRange,
    searchLogic, setSearchLogic,
    collapsedTokenIds,
    priorityFilter, setPriorityFilter,
  } = useCategoryPage({ categoryId: 'amulet' });

  return (
    <PageStateWrapper loading={loading} error={error} data={data}>
      {(data) => {
        const selectedTokens = data.tokens.filter(tok => selectedIds.has(tok.id));
        const hasRangedTokens = selectedTokens.some(tok => tok.ranges.length > 0);
        const rangedSuffixes = [...new Set(
          selectedTokens.filter(tok => tok.ranges.length > 0).map(tok => tok.regex.ru)
        )];

        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
                <img src={`${import.meta.env.BASE_URL}icons/amulet.png`} alt="" width={24} height={24} className="object-contain" />
                {t('amulet.title')}
              </h2>
              <span className="text-xs text-gray-500">{data.tokens.length} {t('mods_word')}</span>
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
              searchLogic={searchLogic}
              setSearchLogic={setSearchLogic}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              showPriorityFilter
            />

            <VirtualizedModList
              tokens={data.tokens}
              selectedIds={selectedIds}
              searchText={searchText}
              affixFilter={affixFilter}
              originFilter={originFilter}
              onToggleTokens={toggleTokens}
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
              category="amulet"
              priorityFilter={priorityFilter}
            />

            <div className="flex flex-col gap-3">
              <ProfilePanel
                category={categoryId}
                currentFilterData={filterStore.serialize()}
                onRestore={restoreFilterState}
              />

              {selectedTokens.length > 0 && (
                <div className="bg-gray-900 border border-gray-700 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">{t('summary.selected')}: {countUniqueFamilyKeys(selectedTokens)} {t('mods_word')}</div>
                  <div className="text-[10px] text-gray-600">
                    {excludeMode ? t('summary.exclude') : t('summary.include')}: {selectedTokens.map(tok => tok.rawText.ru.slice(0, 30)).join(', ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }}
    </PageStateWrapper>
  );
}
