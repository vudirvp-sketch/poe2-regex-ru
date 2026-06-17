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
import { useState, useMemo, useEffect, useRef } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { CategoryLayout } from '@ui/layout/CategoryLayout';
import { StatusPanel } from '@ui/components/StatusPanel';
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
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(new Set());
  const [usesMin, setUsesMin] = useState<number | null>(null);

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
  } = useCategoryPage({ categoryId: 'tablet', extraAstNodes });

  const syncReadyRef = useRef(false);

  useEffect(() => {
    const extraTypes = filterStore.getExtraState('selectedTypes');
    if (Array.isArray(extraTypes)) setSelectedTypes(new Set(extraTypes as string[]));
    const extraRarities = filterStore.getExtraState('selectedRarities');
    if (Array.isArray(extraRarities)) setSelectedRarities(new Set(extraRarities as string[]));
    const extraUses = filterStore.getExtraState('usesMin');
    if (typeof extraUses === 'number') setUsesMin(extraUses);
    syncReadyRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncReadyRef.current) return;
    filterStore.setExtraState('selectedTypes', [...selectedTypes]);
    filterStore.setExtraState('selectedRarities', [...selectedRarities]);
    filterStore.setExtraState('usesMin', usesMin);
  }, [selectedTypes, selectedRarities, usesMin, filterStore]);

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
                  <img src={`${import.meta.env.BASE_URL}icons/tablet.png`} alt="" width={24} height={24} className="object-contain" />
                  {t('tablet.title')}
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
                  <div className="flex flex-wrap items-center gap-2 ml-2 pl-2 border-l border-edge-panel">
                    {/* Tablet type buttons */}
                    <span className="text-[10px] text-dim">{t('tablet.type_label')}</span>
                    {TABLET_TYPES.map(typeDef => (
                      <button key={typeDef.id}
                        onClick={() => toggleType(typeDef.id)}
                        title={typeDef.id === 'expedition' ? EXPEDITION_NOTE : undefined}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
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
                    <span className="text-[10px] text-dim ml-1">{t('tablet.rarity_label')}</span>
                    {RARITY_OPTIONS.map(rarityDef => (
                      <button key={rarityDef.id}
                        onClick={() => toggleRarity(rarityDef.id)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
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
                    <span className="text-[10px] text-dim ml-1">{t('tablet.uses_label')}</span>
                    <input type="number" step="1" min={1} max={30} value={usesMin ?? ''}
                      onChange={(e) => { const v = parseInt(e.target.value, 10); setUsesMin(e.target.value === '' ? null : isNaN(v) ? null : v); }}
                      placeholder="≥N"
                      className="w-14 px-1.5 py-0.5 bg-surface border border-edge rounded text-xs text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
                    />
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
              groupMode="tablet-type"
              category="tablet"
              priorityFilter={priorityFilter}
            />
          </CategoryLayout>
        );
      }}
    </PageStateWrapper>
  );
}
