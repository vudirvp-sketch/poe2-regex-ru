/**
 * RingPage — Category page for Rings.
 *
 * Layout v4 (iter 59): Uses <CategoryLayout> with mobileBar slot —
 * 2-column desktop (controls + ModList on left, sticky RegexOutput + status +
 * ProfilePanel on right), 1-column mobile (status + sidebar below ModList,
 * RegexOutput in sticky bottom-bar via <MobileRegexBar>).
 *
 * iter 86: `affix-functional` groupMode is now enabled — 14 active functional
 * blocks (Spirit / Skill levels / Attributes / Resources / Runes barrier /
 * Resistances / Defence stats / Offence speed / Crit / Damage type / Minions /
 * Flasks / MF / Breach). Simulation shows other-bucket = 9.6% for rings
 * (target <30%). See STATUS.md → OP-1.
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
import { countUniqueFamilyKeys } from '@shared/family-grouper';
// iter 139 (KI#20): favorites now via FavoritesIndicator badge (page header),
// not a separate left-panel chip list (was noise per user feedback).
// Component file kept for backward compat.
// iter 140 (KI#24): FavoritesIndicator added — compact `★ N` badge in the
// page header (next to mod count).
import { FavoritesIndicator } from '@ui/components/FavoritesIndicator';
import { IconLegend } from '@ui/components/IconLegend';
import { MobileRegexBar } from '@ui/components/MobileRegexBar';
import { t } from '@shared/i18n';

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
    // iter 159: MIXED-mode 3-state chip (want / opt / exclude)
    optionalIds, toggleOptional,
  } = useCategoryPage({ categoryId: 'ring' });

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

  // iter 159: Family-level optional toggle for MIXED mode.
  // Same family-level pattern as handleTogglePinned - the store's
  // toggleOptional takes ids[], so we pass the whole array (it handles
  // bulk toggle internally). No first-id-only restriction like pinned
  // because optionalIds is meant to track individual OPT picks per family.
  const handleToggleOptional = useCallback((ids: string[]) => {
    toggleOptional(ids);
  }, [toggleOptional]);

  return (
    <PageStateWrapper loading={loading} error={error} data={data}>
      {(data) => {
        // iter 161: include optionalIds in active set (MIXED mode)
        const allActiveTokens = data.tokens.filter(tok => selectedIds.has(tok.id) || excludedIds.has(tok.id) || optionalIds.has(tok.id));
        const wantTokens = data.tokens.filter(tok => selectedIds.has(tok.id));
        const excludeTokens = data.tokens.filter(tok => excludedIds.has(tok.id));
        const optionalTokens = data.tokens.filter(tok => optionalIds.has(tok.id));
        // iter 181 (KI#55): pinned tokens (favorites) — needed by the
        // show-selected-only toggle in CategoryControlPanel. The toggle's
        // filter logic keeps family groups with at least one selected OR
        // excluded OR pinned member, so the counter must include pinned
        // family groups to accurately reflect what the user will see.
        const pinnedTokens = data.tokens.filter(tok => pinnedIds.has(tok.id));
        // iter 161: counters show family-group (affix) count, not token count.
        // A 12-tier affix chip = 1 family group, displayed as "1 выбрано" (was "12").
        const wantGroupCount = countUniqueFamilyKeys(wantTokens);
        const excludeGroupCount = countUniqueFamilyKeys(excludeTokens);
        const optionalGroupCount = countUniqueFamilyKeys(optionalTokens);
        const pinnedGroupCount = countUniqueFamilyKeys(pinnedTokens);
        const activeGroupCount = countUniqueFamilyKeys(allActiveTokens);
        const hasRangedTokens = allActiveTokens.some(tok => tok.ranges.length > 0);
        const rangedSuffixes = [...new Set(
          allActiveTokens.filter(tok => tok.ranges.length > 0).map(tok => tok.regex.ru)
        )];

        return (
          <CategoryLayout
            header={
              <div className="flex items-center justify-between gap-2">
                <h2 className="poe-panel-header--inline text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
                  <img src={`${import.meta.env.BASE_URL}icons/ring.png`} alt="" width={24} height={24} className="object-contain" />
                  {t('ring.title')}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dim">{data.tokens.length} {t('mods_word')}</span>
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
                excludedCount={excludeGroupCount}
                activeTokenCount={activeGroupCount}
                optionalCount={optionalGroupCount}
                // Phase 3 (iter 135): show-selected-only toggle
                showSelectedOnly={showSelectedOnly}
                onSetShowSelectedOnly={setShowSelectedOnly}
                selectedCount={wantGroupCount}
                // iter 181 (KI#55): pinned family-group count — feeds the
                // toggle's enable condition + visible counter alongside
                // selected/excluded/optional. Without this, the toggle stays
                // disabled even when the user has favorites (⭐) pinned.
                pinnedCount={pinnedGroupCount}
              />
            }
            basket={
              <SelectedBasket
                tokens={data.tokens}
                selectedIds={selectedIds}
                excludedIds={excludedIds}
                optionalIds={optionalIds}
                onToggleTokens={toggleTokens}
                onToggleExclude={toggleExclude}
                onToggleOptional={handleToggleOptional}
                onClearSelections={clearSelections}
                category={categoryId}
                mixedMode={searchLogic === 'mixed'}
              />
            }
            // iter 167 (A3 Variant C): basket-has-content flag drives the
            // visual connector between SelectedBasket and RegexOutput.
            basketHasContent={
              selectedIds.size > 0 ||
              (excludedIds?.size ?? 0) > 0 ||
              (optionalIds?.size ?? 0) > 0
            }
            regexOutput={
              <RegexOutput
                regex={regex}
                isOverflow={isRegexOverflow}
                regexParts={regexParts}
                filterStore={filterStore}
                activeTokenCount={activeGroupCount}
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
            legend={<IconLegend showMixedHint={searchLogic === 'mixed'} />}
            mobileBar={
              <MobileRegexBar
                regexOutput={
                  <RegexOutput
                    regex={regex}
                    isOverflow={isRegexOverflow}
                    regexParts={regexParts}
                    filterStore={filterStore}
                    activeTokenCount={activeGroupCount}
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
              category="ring"
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
              optionalIds={optionalIds}
              onToggleOptional={handleToggleOptional}
              mixedMode={searchLogic === 'mixed'}
            />
          </CategoryLayout>
        );
      }}
    </PageStateWrapper>
  );
}
