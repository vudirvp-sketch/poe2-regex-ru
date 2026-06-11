/**
 * WaystonePage — Category page for Waystones.
 *
 * Layout v2: Control panel sticky at top with waystone-specific controls,
 * mod list full width below with two-column prefix/suffix layout
 * and sentiment sub-grouping (positive/negative/neutral).
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
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { t } from '@shared/i18n';
import { countUniqueFamilyKeys } from '@shared/family-grouper';
import { literal, exclude } from '@core/ast';
import type { ASTNode } from '@shared/types';

export function WaystonePage() {
  const [corrupted, setCorrupted] = useState(false);
  const [uncorrupted, setUncorrupted] = useState(false);
  const [delirious, setDelirious] = useState(false);

  const extraAstNodes = useMemo<ASTNode[]>(() => {
    const nodes: ASTNode[] = [];
    if (corrupted) nodes.push(literal('оскверн'));
    if (uncorrupted) nodes.push(exclude(literal('оскверн')));
    if (delirious) nodes.push(literal('делир'));
    return nodes;
  }, [corrupted, uncorrupted, delirious]);

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
  } = useCategoryPage({ categoryId: 'waystone', extraAstNodes, mergeCategories: ['waystone-desecrated'] });

  const syncReadyRef = useRef(false);

  useEffect(() => {
    const extra = filterStore.getExtraState('corrupted');
    if (typeof extra === 'boolean') setCorrupted(extra);
    const extraU = filterStore.getExtraState('uncorrupted');
    if (typeof extraU === 'boolean') setUncorrupted(extraU);
    const extraD = filterStore.getExtraState('delirious');
    if (typeof extraD === 'boolean') setDelirious(extraD);
    syncReadyRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncReadyRef.current) return;
    filterStore.setExtraState('corrupted', corrupted);
    filterStore.setExtraState('uncorrupted', uncorrupted);
    filterStore.setExtraState('delirious', delirious);
  }, [corrupted, uncorrupted, delirious, filterStore]);

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
                <img src={`${import.meta.env.BASE_URL}icons/waystone.png`} alt="" width={24} height={24} className="object-contain" />
                {t('waystone.title')}
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
              extraControls={
                <div className="flex items-center gap-3 ml-2 pl-2 border-l border-edge-panel">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={corrupted}
                      onChange={(e) => { setCorrupted(e.target.checked); if (e.target.checked) setUncorrupted(false); }}
                      className="w-3.5 h-3.5 rounded bg-raised border-edge text-purple-500" />
                    <span className="text-[10px] text-soft">{t('waystone.corrupted_label')}</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={uncorrupted}
                      onChange={(e) => { setUncorrupted(e.target.checked); if (e.target.checked) setCorrupted(false); }}
                      className="w-3.5 h-3.5 rounded bg-raised border-edge text-green-500" />
                    <span className="text-[10px] text-soft">{t('waystone.uncorrupted_label')}</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={delirious}
                      onChange={(e) => setDelirious(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-raised border-edge text-blue-500" />
                    <span className="text-[10px] text-soft">{t('waystone.delirious_label')}</span>
                  </label>
                </div>
              }
            />

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
              groupMode="affix-sentiment"
              category="waystone"
              priorityFilter={priorityFilter}
            />

            <div className="flex flex-col gap-3">
              <ProfilePanel
                category={categoryId}
                currentFilterData={filterStore.serialize()}
                onRestore={restoreFilterState}
              />

              {(allActiveTokens.length > 0 || corrupted || uncorrupted || delirious) && (
                <div className="bg-panel border border-edge-panel rounded p-3">
                  <div className="text-xs text-muted mb-1">
                    {t('summary.selected')}: {countUniqueFamilyKeys(wantTokens)} {t('mods_word')}
                    {excludeTokens.length > 0 && (
                      <span className="text-accent-red"> | {t('summary.exclude')}: {countUniqueFamilyKeys(excludeTokens)} {t('mods_word')}</span>
                    )}
                    {corrupted && ` ${t('waystone.summary_corrupted')}`}
                    {uncorrupted && ` ${t('waystone.summary_uncorrupted')}`}
                    {delirious && ` ${t('waystone.summary_delirious')}`}
                  </div>
                  {wantTokens.length > 0 && (
                    <div className="text-[10px] text-faint">
                      {t('summary.include')}: {wantTokens.map(tok => tok.rawText.ru.slice(0, 30)).join(', ')}
                    </div>
                  )}
                  {excludeTokens.length > 0 && (
                    <div className="text-[10px] text-accent-red-dim">
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
