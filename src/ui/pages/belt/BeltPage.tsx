/**
 * BeltPage — Category page for Belts.
 *
 * Layout v4 (iter 59): Uses <CategoryLayout> with mobileBar slot —
 * 2-column desktop (controls + ModList on left, sticky RegexOutput + status +
 * ProfilePanel on right), 1-column mobile (status + sidebar below ModList,
 * RegexOutput in sticky bottom-bar via <MobileRegexBar>).
 *
 * iter 86: `affix-functional` groupMode is now enabled — 14 active functional
 * blocks. Simulation shows other-bucket = 8.2% for belts (target <30%).
 * Flasks block catches belt-primary flask mods (text «флакон»).
 * See STATUS.md → OP-1.
 */
import { useCallback } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { VirtualizedModList } from '@ui/components/VirtualizedModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { CategoryLayout } from '@ui/layout/CategoryLayout';
import { StatusPanel } from '@ui/components/StatusPanel';
import { SelectedBasket } from '@ui/components/SelectedBasket';
import { LeftPanelFavorites } from '@ui/components/LeftPanelFavorites';
import { MobileRegexBar } from '@ui/components/MobileRegexBar';
import { t } from '@shared/i18n';

export function BeltPage() {
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
    sortMode, setSortMode,
    collapsedGroups, expandedSubGroups,
    toggleGroupCollapsed, toggleSubGroupExpanded,
    expandAllGroups, collapseAllGroups,
    expandAllSubGroups, collapseAllSubGroups,
    chipExpandState, toggleChipExpand,
    // Phase 3 (iter 135): show-selected-only toggle
    showSelectedOnly, setShowSelectedOnly,
    // Phase 5 (iter 136): favorites (pinned) state + actions
    pinnedIds, togglePinned, clearPinned,
  } = useCategoryPage({ categoryId: 'belt' });

  // Phase 5 (iter 136): Family-level batched pinned toggle.
  // FilterChip's onTogglePinned expects (ids: string[]) => void,
  // but the store's togglePinned takes a single id. This wrapper
  // calls togglePinned(id) for each member ID — since togglePinned
  // is idempotent (toggle), this works correctly for both pin and
  // unpin actions on a family group.
  //
  // Stable reference via useCallback so React.memo on FilterChip
  // doesn't re-render on every page render.
  const handleTogglePinned = useCallback((ids: string[]) => {
    ids.forEach(id => togglePinned(id));
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
              <div className="flex items-center justify-between">
                <h2 className="poe-panel-header--inline text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
                  <img src={`${import.meta.env.BASE_URL}icons/belt.png`} alt="" width={24} height={24} className="object-contain" />
                  {t('belt.title')}
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
                sortMode={sortMode}
                setSortMode={setSortMode}
                showSortMode
                excludedCount={excludeTokens.length}
                activeTokenCount={allActiveTokens.length}
                // Phase 3 (iter 135): show-selected-only toggle
                showSelectedOnly={showSelectedOnly}
                onSetShowSelectedOnly={setShowSelectedOnly}
                selectedCount={selectedIds.size}
              />
            }
            favorites={
              <LeftPanelFavorites
                tokens={data.tokens}
                pinnedIds={pinnedIds}
                onTogglePinned={handleTogglePinned}
                onClearPinned={clearPinned}
                category={categoryId}
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
              <StatusPanel wantTokens={wantTokens} excludeTokens={excludeTokens} allActiveTokens={allActiveTokens} />
            }
            sidebar={
              <ProfilePanel
                category={categoryId}
                currentFilterData={filterStore.serialize()}
                onRestore={restoreFilterState}
              />
            }
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
              groupMode="affix-functional"
              showOriginSubSections
              category="belt"
              priorityFilter={priorityFilter}
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
