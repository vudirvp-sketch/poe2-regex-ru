/**
 * TabletPage — Category page for Tablets (Башни Предтеч).
 *
 * Layout v4 (iter 59): Uses <CategoryLayout> with mobileBar slot —
 * 2-column desktop (controls + ModList on left, sticky RegexOutput + status +
 * ProfilePanel on right), 1-column mobile (status + sidebar below ModList,
 * RegexOutput in sticky bottom-bar via <MobileRegexBar>).
 *
 * Tablet-specific features:
 * - Type filter: Бездна / Делириум / Ритуал / Ваал (as extra AST nodes)
 * - Rarity filter: Обычный / Волшебный / Редкий
 * - Uses remaining: numeric input → RANGE node
 *
 * Grouping: groupMode="tablet-type" classifies mods by their content type
 * (Ritual, Breach, Delirium, Vaal, Expedition, or Generic) within each
 * prefix/suffix column, using text-based heuristics.
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
import { literal, or, range } from '@core/ast';
import type { ASTNode } from '@shared/types';

const TABLET_TYPES = [
  { id: 'breach', label: 'Бездна', regex: 'бездн', color: 'text-accent-purple' },
  { id: 'delirium', label: 'Делириум', regex: 'делир', color: 'text-accent-blue' },
  { id: 'ritual', label: 'Ритуал', regex: 'ритуал', color: 'text-accent-red' },
  { id: 'vaal', label: 'Ваал', regex: 'ваал', color: 'text-accent-orange' },
  { id: 'expedition', label: 'Экспедиция', regex: 'экспедици', color: 'text-accent-teal' },
] as const;

/** Note about expedition tablets — currently not in game, kept for future content */
const EXPEDITION_NOTE = 'Экспедиционные плитки временно отсутствуют в игре (лига Руны Альдура). Кнопка оставлена для будущего контента.';

const RARITY_OPTIONS = [
  { id: 'normal', label: 'Обычный', regex: 'обычн', color: 'text-bright' },
  { id: 'magic', label: 'Волшебный', regex: 'волшебн', color: 'text-accent-blue' },
  { id: 'rare', label: 'Редкий', regex: 'редк', color: 'text-accent-yellow' },
] as const;

export function TabletPage() {
  // iter 79 (Bug #8 Phase 2): call useFilterStore BEFORE local useState so we
  // can lazy-init selectedTypes/selectedRarities/usesMin from the URL-restored
  // extraState. Eliminates the previous `react-hooks/set-state-in-effect` lint error.
  const useStore = useFilterStore('tablet');

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => {
    const v = useStore.getState().getExtraState('selectedTypes');
    return Array.isArray(v) ? new Set(v as string[]) : new Set();
  });
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(() => {
    const v = useStore.getState().getExtraState('selectedRarities');
    return Array.isArray(v) ? new Set(v as string[]) : new Set();
  });
  const [usesMin, setUsesMin] = useState<number | null>(() => {
    const v = useStore.getState().getExtraState('usesMin');
    return typeof v === 'number' ? v : null;
  });

  const extraAstNodes = useMemo<ASTNode[]>(() => {
    const nodes: ASTNode[] = [];
    if (selectedTypes.size > 0) {
      const typeLiterals: ASTNode[] = [];
      for (const typeId of selectedTypes) {
        const typeDef = TABLET_TYPES.find(tp => tp.id === typeId);
        if (typeDef) typeLiterals.push(literal(typeDef.regex));
      }
      if (typeLiterals.length === 1) nodes.push(typeLiterals[0]);
      else if (typeLiterals.length > 1) nodes.push(or(...typeLiterals));
    }
    if (selectedRarities.size > 0) {
      const rarityLiterals: ASTNode[] = [];
      for (const rarityId of selectedRarities) {
        const rarityDef = RARITY_OPTIONS.find(r => r.id === rarityId);
        if (rarityDef) rarityLiterals.push(literal(rarityDef.regex));
      }
      if (rarityLiterals.length === 1) nodes.push(rarityLiterals[0]);
      else if (rarityLiterals.length > 1) nodes.push(or(...rarityLiterals));
    }
    if (usesMin !== null && usesMin > 0) {
      nodes.push(range(usesMin, undefined, 'использ'));
    }
    return nodes;
  }, [selectedTypes, selectedRarities, usesMin]);

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
    pinnedIds, togglePinned,
  } = useCategoryPage({
    categoryId: 'tablet',
    extraAstNodes,
    filterStore: useStore,
  });

  // One-way write-back: local state → filterStore extraState (for URL sync + profile persistence).
  // No setState here — just Zustand `set()` calls — so no `set-state-in-effect` lint error.
  const syncReadyRef = useRef(false);

  useEffect(() => {
    if (!syncReadyRef.current) {
      syncReadyRef.current = true;
      return;
    }
    useStore.getState().setExtraState('selectedTypes', [...selectedTypes]);
    useStore.getState().setExtraState('selectedRarities', [...selectedRarities]);
    useStore.getState().setExtraState('usesMin', usesMin);
  }, [selectedTypes, selectedRarities, usesMin, useStore]);

  const toggleType = (typeId: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId); else next.add(typeId);
      return next;
    });
  };

  const toggleRarity = (rarityId: string) => {
    setSelectedRarities(prev => {
      const next = new Set(prev);
      if (next.has(rarityId)) next.delete(rarityId); else next.add(rarityId);
      return next;
    });
  };

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
                  <img src={`${import.meta.env.BASE_URL}icons/tablet.png`} alt="" width={24} height={24} className="object-contain" />
                  {t('tablet.title')}
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
                extraControls={
                  <div className="flex flex-wrap items-center gap-2 ml-2 pl-2 border-l border-edge-panel">
                    {/* Tablet type buttons */}
                    <span className="text-[12px] text-dim">{t('tablet.type_label')}</span>
                    {TABLET_TYPES.map(typeDef => (
                      <button key={typeDef.id}
                        onClick={() => toggleType(typeDef.id)}
                        title={typeDef.id === 'expedition' ? EXPEDITION_NOTE : undefined}
                        className={`px-1.5 py-0.5 rounded text-[12px] font-medium transition-colors border ${
                          selectedTypes.has(typeDef.id)
                            ? 'bg-raised border-accent-amber text-bright'
                            : 'bg-surface border-edge-panel text-dim hover:border-edge'
                        } ${typeDef.id === 'expedition' ? 'opacity-60' : ''}`}
                      >
                        <span className={selectedTypes.has(typeDef.id) ? typeDef.color : ''}>
                          {typeDef.label}
                        </span>
                      </button>
                    ))}

                    {/* Rarity buttons */}
                    <span className="text-[12px] text-dim ml-1">{t('tablet.rarity_label')}</span>
                    {RARITY_OPTIONS.map(rarityDef => (
                      <button key={rarityDef.id}
                        onClick={() => toggleRarity(rarityDef.id)}
                        className={`px-1.5 py-0.5 rounded text-[12px] font-medium transition-colors border ${
                          selectedRarities.has(rarityDef.id)
                            ? 'bg-raised border-accent-amber text-bright'
                            : 'bg-surface border-edge-panel text-dim hover:border-edge'
                        }`}
                      >
                        <span className={selectedRarities.has(rarityDef.id) ? rarityDef.color : ''}>
                          {rarityDef.label}
                        </span>
                      </button>
                    ))}

                    {/* Uses remaining */}
                    <span className="text-[12px] text-dim ml-1">{t('tablet.uses_label')}</span>
                    <input type="number" step="1" min={1} max={30} value={usesMin ?? ''}
                      onChange={(e) => { const v = parseInt(e.target.value, 10); setUsesMin(e.target.value === '' ? null : isNaN(v) ? null : v); }}
                      placeholder="≥N"
                      className="w-14 px-1.5 py-0.5 bg-surface border border-edge rounded text-xs text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
                    />
                  </div>
                }
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
              <StatusPanel
                wantTokens={wantTokens}
                excludeTokens={excludeTokens}
                allActiveTokens={allActiveTokens}
                badges={[
                  ...(selectedTypes.size > 0 ? [`${t('tablet.summary_types')} ${[...selectedTypes].map(id => TABLET_TYPES.find(tp => tp.id === id)?.label).filter(Boolean).join(', ')}`] : []),
                  ...(selectedRarities.size > 0 ? [`${t('tablet.summary_rarity')} ${[...selectedRarities].map(id => RARITY_OPTIONS.find(r => r.id === id)?.label).filter(Boolean).join(', ')}`] : []),
                  ...(usesMin !== null ? [t('tablet.summary_uses').replace('{n}', String(usesMin))] : []),
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
              groupMode="tablet-type-subblocks"
              category="tablet"
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
