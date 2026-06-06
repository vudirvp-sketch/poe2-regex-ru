/**
 * TabletPage — Category page for Tablets (Башни Предтеч).
 *
 * Layout v2: Control panel sticky at top with tablet-specific controls
 * (type filter, rarity filter, uses remaining), mod list full width below
 * with two-column prefix/suffix layout and tablet-type sub-grouping
 * (Ритуал/Бездна/Делириум/Ваал/Экспедиция/Общие).
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
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { PageStateWrapper } from '@ui/components/PageStateWrapper';
import { t } from '@shared/i18n';
import { literal, or, range } from '@core/ast';
import type { ASTNode } from '@shared/types';

const TABLET_TYPES = [
  { id: 'breach', label: 'Бездна', regex: 'бездн', color: 'text-purple-400' },
  { id: 'delirium', label: 'Делириум', regex: 'делир', color: 'text-blue-400' },
  { id: 'ritual', label: 'Ритуал', regex: 'ритуал', color: 'text-red-400' },
  { id: 'vaal', label: 'Ваал', regex: 'ваал', color: 'text-orange-400' },
  { id: 'expedition', label: 'Экспедиция', regex: 'экспедици', color: 'text-green-400' },
] as const;

const RARITY_OPTIONS = [
  { id: 'normal', label: 'Обычный', regex: 'обычн', color: 'text-white' },
  { id: 'magic', label: 'Волшебный', regex: 'волшебн', color: 'text-blue-300' },
  { id: 'rare', label: 'Редкий', regex: 'редк', color: 'text-yellow-300' },
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
    regex, isRegexOverflow,
    excludeMode, setExcludeMode,
    round10Enabled, setRound10Enabled,
    minValue, setMinValue,
    maxValue, setMaxValue,
    selectedIds, searchText, affixFilter, originFilter,
    toggleTokens, setSearchText, setAffixFilter, setOriginFilter, clearSelections,
    categoryId, filterStore, restoreFilterState,
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
        const selectedTokens = data.tokens.filter(tok => selectedIds.has(tok.id));
        const hasRangedTokens = selectedTokens.some(tok => tok.ranges.length > 0);
        const rangedSuffixes = [...new Set(
          selectedTokens.filter(tok => tok.ranges.length > 0).map(tok => tok.regex.ru)
        )];

        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
                <img src={`${import.meta.env.BASE_URL}icons/tablet.png`} alt="" width={24} height={24} className="object-contain" />
                {t('tablet.title')}
              </h2>
              <span className="text-xs text-gray-500">{data.tokens.length} {t('mods_word')}</span>
            </div>

            <CategoryControlPanel
              regex={regex}
              isOverflow={isRegexOverflow}
              filterStore={filterStore}
              excludeMode={excludeMode}
              setExcludeMode={setExcludeMode}
              hasRangedTokens={hasRangedTokens}
              minValue={minValue}
              setMinValue={setMinValue}
              maxValue={maxValue}
              setMaxValue={setMaxValue}
              rangedSuffixes={rangedSuffixes}
              round10Enabled={round10Enabled}
              setRound10Enabled={setRound10Enabled}
              extraControls={
                <div className="flex flex-wrap items-center gap-2 ml-2 pl-2 border-l border-gray-700">
                  {/* Tablet type buttons */}
                  <span className="text-[10px] text-gray-500">{t('tablet.type_label')}</span>
                  {TABLET_TYPES.map(typeDef => (
                    <button key={typeDef.id}
                      onClick={() => toggleType(typeDef.id)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                        selectedTypes.has(typeDef.id)
                          ? 'bg-gray-700 border-gray-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      <span className={selectedTypes.has(typeDef.id) ? typeDef.color : ''}>
                        {typeDef.label}
                      </span>
                    </button>
                  ))}

                  {/* Rarity buttons */}
                  <span className="text-[10px] text-gray-500 ml-1">{t('tablet.rarity_label')}</span>
                  {RARITY_OPTIONS.map(rarityDef => (
                    <button key={rarityDef.id}
                      onClick={() => toggleRarity(rarityDef.id)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                        selectedRarities.has(rarityDef.id)
                          ? 'bg-gray-700 border-gray-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      <span className={selectedRarities.has(rarityDef.id) ? rarityDef.color : ''}>
                        {rarityDef.label}
                      </span>
                    </button>
                  ))}

                  {/* Uses remaining */}
                  <span className="text-[10px] text-gray-500 ml-1">{t('tablet.uses_label')}</span>
                  <input type="number" min={1} max={30} value={usesMin ?? ''}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); setUsesMin(e.target.value === '' ? null : isNaN(v) ? null : v); }}
                    placeholder="≥N"
                    className="w-14 px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              }
            />

            <ModList
              tokens={data.tokens}
              selectedIds={selectedIds}
              searchText={searchText}
              affixFilter={affixFilter}
              originFilter={originFilter}
              onToggleTokens={toggleTokens}
              onSearchChange={setSearchText}
              onAffixFilterChange={setAffixFilter}
              onOriginFilterChange={setOriginFilter}
              onClearSelections={clearSelections}
              groupMode="tablet-type"
            />

            <div className="flex flex-col gap-3">
              <ProfilePanel
                category={categoryId}
                currentFilterData={filterStore.serialize()}
                onRestore={restoreFilterState}
              />

              {(selectedTokens.length > 0 || selectedTypes.size > 0 || selectedRarities.size > 0 || usesMin !== null) && (
                <div className="bg-gray-900 border border-gray-700 rounded p-3">
                  <div className="text-xs text-gray-400 mb-1">
                    {t('summary.selected')}: {selectedTokens.length} {t('mods_word')}
                    {selectedTypes.size > 0 && ` ${t('tablet.summary_types')} ${[...selectedTypes].map(id => TABLET_TYPES.find(tp => tp.id === id)?.label).filter(Boolean).join(', ')}`}
                    {selectedRarities.size > 0 && ` ${t('tablet.summary_rarity')} ${[...selectedRarities].map(id => RARITY_OPTIONS.find(r => r.id === id)?.label).filter(Boolean).join(', ')}`}
                    {usesMin !== null && ` ${t('tablet.summary_uses').replace('{n}', String(usesMin))}`}
                  </div>
                  {selectedTokens.length > 0 && (
                    <div className="text-[10px] text-gray-600">
                      {excludeMode ? t('summary.exclude') : t('summary.include')}: {selectedTokens.map(tok => tok.rawText.ru.slice(0, 30)).join(', ')}
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
