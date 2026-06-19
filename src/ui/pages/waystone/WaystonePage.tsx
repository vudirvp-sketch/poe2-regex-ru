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
import { useState, useMemo, useEffect, useRef } from 'react';
import { useCategoryPage, useFilterStore } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { CategoryLayout } from '@ui/layout/CategoryLayout';
import { StatusPanel } from '@ui/components/StatusPanel';
import { MobileRegexBar } from '@ui/components/MobileRegexBar';
import { t } from '@shared/i18n';
import { literal, exclude } from '@core/ast';
import type { ASTNode } from '@shared/types';

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
    priorityFilter, setPriorityFilter,
    thresholdEnabled, setThresholdEnabled,
  } = useCategoryPage({
    categoryId: 'waystone',
    extraAstNodes,
    mergeCategories: ['waystone-desecrated'],
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
                  <img src={`${import.meta.env.BASE_URL}icons/waystone.png`} alt="" width={24} height={24} className="object-contain" />
                  {t('waystone.title')}
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
                extraControls={
                  <div className="flex items-center gap-3 ml-2 pl-2 border-l border-edge-panel">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={corrupted}
                        onChange={(e) => { setCorrupted(e.target.checked); if (e.target.checked) setUncorrupted(false); }}
                        className="w-3.5 h-3.5 rounded bg-raised border-edge text-accent-purple" />
                      <span className="text-[12px] text-soft">{t('waystone.corrupted_label')}</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={uncorrupted}
                        onChange={(e) => { setUncorrupted(e.target.checked); if (e.target.checked) setCorrupted(false); }}
                        className="w-3.5 h-3.5 rounded bg-raised border-edge text-accent-emerald" />
                      <span className="text-[12px] text-soft">{t('waystone.uncorrupted_label')}</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={delirious}
                        onChange={(e) => setDelirious(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-raised border-edge text-accent-blue" />
                      <span className="text-[12px] text-soft">{t('waystone.delirious_label')}</span>
                    </label>
                  </div>
                }
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
              groupMode="affix-sentiment-subblocks"
              category="waystone"
              priorityFilter={priorityFilter}
            />
          </CategoryLayout>
        );
      }}
    </PageStateWrapper>
  );
}
