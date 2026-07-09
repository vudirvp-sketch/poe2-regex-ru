/**
 * WaystonePage — Category page for Waystones.
 *
 * Layout v4 (iter 59): Uses <CategoryLayout> with mobileBar slot —
 * 2-column desktop (controls + ModList on left, sticky RegexOutput + status +
 * ProfilePanel on right), 1-column mobile (status + sidebar below ModList,
 * RegexOutput in sticky bottom-bar via <MobileRegexBar>).
 *
 * Loads and merges two JSON files:
 * - waystone.json (96 normal tokens)
 * - waystone-desecrated.json (16 desecrated tokens)
 *
 * Waystone-specific features:
 * - Corrupted → literal("оскверн")
 * - Uncorrupted → exclude(literal("оскверн"))
 * - Delirious → literal("делир")
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCategoryPage, useFilterStore } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
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
import { literal, exclude } from '@core/ast';
import type { ASTNode } from '@shared/types';

// iter 152 (KI#42): module-level constant for mergeCategories.
// Previously this was an inline array literal inside WaystonePage's render
// body, which created a NEW array reference on every render.
// useCategoryData's useEffect dep array included `mergeCategories`, so the
// effect re-ran on every keystroke in the search box (searchText change →
// re-render → new array ref → effect re-run → setLoading(true) →
// PageStateWrapper unmounted children including the <input> → blur).
// On waystone the unmount was too brief to fully lose focus, but every
// keystroke still fired a blur+refocus cycle (visible in event logs).
// Hoisting to module level makes the reference stable for the lifetime of
// the module, so useCategoryData's effect runs only once per categoryId.
const WAYSTONE_MERGE_CATEGORIES = ['waystone-desecrated'];

export function WaystonePage() {
  // iter 79 (Bug #8 Phase 2): call useFilterStore BEFORE local useState so we
  // can lazy-init corrupted/uncorrupted/delirious from the URL-restored extraState.
  // This eliminates the previous `react-hooks/set-state-in-effect` lint error
  // caused by reading filterStore inside a useEffect.
  const useStore = useFilterStore('waystone');

  const [corrupted, setCorrupted] = useState<boolean>(() => {
    const v = useStore.getState().getExtraState('corrupted');
    return typeof v === 'boolean' ? v : false;
  });
  const [uncorrupted, setUncorrupted] = useState<boolean>(() => {
    const v = useStore.getState().getExtraState('uncorrupted');
    return typeof v === 'boolean' ? v : false;
  });
  const [delirious, setDelirious] = useState<boolean>(() => {
    const v = useStore.getState().getExtraState('delirious');
    return typeof v === 'boolean' ? v : false;
  });

  const extraAstNodes = useMemo<ASTNode[]>(() => {
    const nodes: ASTNode[] = [];
    if (corrupted) nodes.push(literal('оскверн'));
    if (uncorrupted) nodes.push(exclude(literal('оскверн')));
    if (delirious) nodes.push(literal('делир'));
    return nodes;
  }, [corrupted, uncorrupted, delirious]);

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
  } = useCategoryPage({
    categoryId: 'waystone',
    extraAstNodes,
    // iter 152 (KI#42): use stable module-level constant — see comment above.
    mergeCategories: WAYSTONE_MERGE_CATEGORIES,
    filterStore: useStore,
  });

  // One-way write-back: local state → filterStore extraState (for URL sync + profile persistence).
  // No setState here — just Zustand `set()` calls — so no `set-state-in-effect` lint error.
  // syncReadyRef skips the first render to avoid overwriting URL-restored extraState
  // (matches the existing pattern in useCategoryPage's own URL-sync effect).
  const syncReadyRef = useRef(false);

  useEffect(() => {
    if (!syncReadyRef.current) {
      syncReadyRef.current = true;
      return;
    }
    useStore.getState().setExtraState('corrupted', corrupted);
    useStore.getState().setExtraState('uncorrupted', uncorrupted);
    useStore.getState().setExtraState('delirious', delirious);
  }, [corrupted, uncorrupted, delirious, useStore]);

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
        // show-selected-only toggle. See RingPage.tsx for full rationale.
        const pinnedTokens = data.tokens.filter(tok => pinnedIds.has(tok.id));
        // iter 161: counters show family-group (affix) count, not token count.
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
                  <img src={`${import.meta.env.BASE_URL}icons/waystone.png`} alt="" width={24} height={24} className="object-contain" />
                  {t('waystone.title')}
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
                // iter 181 (KI#55): pinned family-group count — without this
                // the toggle stays disabled when only favorites (⭐) are set.
                pinnedCount={pinnedGroupCount}
                extraControls={
                  // iter 148 (toolbar refactor): map-state filters restyled
                  // from bare checkboxes + text labels to colored chip-toggles
                  // that visually distinguish them as DATA filters (not UI
                  // settings). Each chip keeps the underlying <input
                  // type="checkbox"> for native ARIA + keyboard (Space toggle),
                  // but the wrapper <label> is styled as a chip that
                  // highlights when active.
                  //  - Осквернён  → purple (text-accent-purple)
                  //  - Неосквернён → emerald
                  //  - Делириум   → blue
                  // Осквернён + Неосквернён remain mutually exclusive (toggling
                  // one off inverts the other) — same logic as before iter 148.
                  <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-edge-panel">
                    <label
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-medium cursor-pointer transition-colors border ${
                        corrupted
                          ? 'bg-raised border-accent-purple text-accent-purple'
                          : 'bg-surface border-edge text-muted hover:bg-chip-hover'
                      }`}
                    >
                      <input type="checkbox" checked={corrupted}
                        onChange={(e) => { setCorrupted(e.target.checked); if (e.target.checked) setUncorrupted(false); }}
                        className="sr-only" />
                      {t('waystone.corrupted_label')}
                    </label>
                    <label
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-medium cursor-pointer transition-colors border ${
                        uncorrupted
                          ? 'bg-raised border-accent-emerald text-accent-emerald'
                          : 'bg-surface border-edge text-muted hover:bg-chip-hover'
                      }`}
                    >
                      <input type="checkbox" checked={uncorrupted}
                        onChange={(e) => { setUncorrupted(e.target.checked); if (e.target.checked) setCorrupted(false); }}
                        className="sr-only" />
                      {t('waystone.uncorrupted_label')}
                    </label>
                    <label
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-medium cursor-pointer transition-colors border ${
                        delirious
                          ? 'bg-raised border-accent-blue text-accent-blue'
                          : 'bg-surface border-edge text-muted hover:bg-chip-hover'
                      }`}
                    >
                      <input type="checkbox" checked={delirious}
                        onChange={(e) => setDelirious(e.target.checked)}
                        className="sr-only" />
                      {t('waystone.delirious_label')}
                    </label>
                  </div>
                }
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
              <StatusPanel
                wantTokens={wantTokens}
                excludeTokens={excludeTokens}
                allActiveTokens={allActiveTokens}
                badges={[
                  ...(corrupted ? [t('waystone.summary_corrupted')] : []),
                  ...(uncorrupted ? [t('waystone.summary_uncorrupted')] : []),
                  ...(delirious ? [t('waystone.summary_delirious')] : []),
                ]}
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
              groupMode="affix-sentiment-subblocks"
              category="waystone"
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
