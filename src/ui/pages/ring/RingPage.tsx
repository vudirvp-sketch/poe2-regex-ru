/**
 * RingPage — Category page for Rings.
 *
 * Layout v3 (iter 53): Uses <CategoryLayout> — 2-column desktop (controls +
 * ModList on left, sticky RegexOutput + status + ProfilePanel on right),
 * 1-column mobile (RegexOutput appears below ModList until Phase 7 moves
 * it to a sticky bottom-bar).
 *
 * Mod list uses VirtualizedModList with two-column prefix/suffix layout
 * and semantic sub-grouping (offensive/defensive/attribute/neutral).
 */
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { VirtualizedModList } from '@ui/components/VirtualizedModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { CategoryLayout } from '@ui/layout/CategoryLayout';
import { StatusPanel } from '@ui/components/StatusPanel';

export function RingPage() {
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
    priorityFilter, setPriorityFilter,
    thresholdEnabled, setThresholdEnabled,
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
          <CategoryLayout
            header={
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
                  <img src={`${import.meta.env.BASE_URL}icons/ring.png`} alt="" width={24} height={24} className="object-contain" />
                  {t('ring.title')}
                </h2>
                <span className="text-xs text-dim">{data.tokens.length} {t('mods_word')}</span>
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
                priorityFilter={priorityFilter}
                setPriorityFilter={setPriorityFilter}
                showPriorityFilter
                excludedCount={excludeTokens.length}
                activeTokenCount={allActiveTokens.length}
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
              <StatusPanel wantTokens={wantTokens} excludeTokens={excludeTokens} allActiveTokens={allActiveTokens} />
            }
            sidebar={
              <ProfilePanel
                category={categoryId}
                currentFilterData={filterStore.serialize()}
                onRestore={restoreFilterState}
              />
            }
          >
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
          </CategoryLayout>
        );
      }}
    </PageStateWrapper>
  );
}
