/**
 * RelicPage — Category page for Relics (Урны + Печати).
 *
 * Layout v4 (iter 59): Uses <CategoryLayout> with mobileBar slot —
 * 2-column desktop (controls + ModList on left, sticky RegexOutput + status +
 * ProfilePanel on right), 1-column mobile (status + sidebar below ModList,
 * RegexOutput in sticky bottom-bar via <MobileRegexBar>).
 *
 * iter 98: Mod list uses `relic-semantic` grouping mode — 25 family-keys are
 * sub-grouped into 7 Sanctum gameplay categories (Честь / Святая вода /
 * Испытания / Ключи / Торговец / Монстры / Проклятия) within each prefix/suffix
 * column. Replaces the previous flat `affix-only` mode (single basket for all
 * 25 groups). See src/shared/mod-classifier.ts → classifyRelicCategory().
 */
import { useCallback } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { CategoryLayout } from '@ui/layout/CategoryLayout';
import { StatusPanel } from '@ui/components/StatusPanel';
import { SelectedBasket } from '@ui/components/SelectedBasket';
// iter 139 (KI#20): LeftPanelFavorites import removed — favorites panel
// no longer rendered in the LEFT column per user feedback. SelectedBasket on
// the RIGHT already shows selected affixes; a separate pinned panel was noise.
// Component file kept for backward compat.
// iter 140 (KI#24): FavoritesIndicator added — compact `★ N` badge in the
// page header (next to mod count).
import { FavoritesIndicator } from '@ui/components/FavoritesIndicator';
import { IconLegend } from '@ui/components/IconLegend';
import { MobileRegexBar } from '@ui/components/MobileRegexBar';
import { t } from '@shared/i18n';

export function RelicPage() {
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
    collapsedGroups, expandedSubGroups,
    toggleGroupCollapsed, toggleSubGroupExpanded,
    expandAllGroups, collapseAllGroups,
    expandAllSubGroups, collapseAllSubGroups,
    chipExpandState, toggleChipExpand,
    // Phase 3 (iter 135): show-selected-only toggle
    showSelectedOnly, setShowSelectedOnly,
    // Phase 5 (iter 136): favorites (pinned) state + actions
    pinnedIds, togglePinned,
  } = useCategoryPage({ categoryId: 'relic' });

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
              <div className="flex items-center justify-between gap-2">
                <h2 className="poe-panel-header--inline text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
                  <img src={`${import.meta.env.BASE_URL}icons/relic.png`} alt="" width={24} height={24} className="object-contain" />
                  {t('relic.title')}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dim">{data.tokens.length} {t('mods_word')}</span>
                  <FavoritesIndicator pinnedIds={pinnedIds} />
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
                excludedCount={excludeTokens.length}
                activeTokenCount={allActiveTokens.length}
                // Phase 3 (iter 135): show-selected-only toggle
                showSelectedOnly={showSelectedOnly}
                onSetShowSelectedOnly={setShowSelectedOnly}
                selectedCount={selectedIds.size}
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
              />
            }
          >
            <ModList
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
              groupMode="relic-semantic"
              showOriginSubSections
              category="relic"
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
