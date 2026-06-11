/**
 * RingPage — Category page for Rings.
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

export function RingPage() {
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
  } = useCategoryPage({ categoryId: 'ring' });

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
                <img src={`${import.meta.env.BASE_URL}icons/ring.png`} alt="" width={24} height={24} className="object-contain" />
                {t('ring.title')}
              </h2>
              <span className="text-xs text-dim">{data.tokens.length} {t('mods_word')}</span>
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
            />

            <VirtualizedModList
              tokens={data.tokens}
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
              category="ring"
              priorityFilter={priorityFilter}
            />

            <div className="flex flex-col gap-3">
              <ProfilePanel
                category={categoryId}
                currentFilterData={filterStore.serialize()}
                onRestore={restoreFilterState}
              />

              {allActiveTokens.length > 0 && (
                <div className="bg-panel border border-edge-panel rounded p-3">
                  <div className="text-xs text-muted mb-1">{t('summary.selected')}: {countUniqueFamilyKeys(wantTokens)} {t('mods_word')}</div>
                  {excludeTokens.length > 0 && (
                    <div className="text-xs text-accent-red mb-1">{t('summary.exclude')}: {countUniqueFamilyKeys(excludeTokens)} {t('mods_word')}</div>
                  )}
                  <div className="text-[10px] text-faint">
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
