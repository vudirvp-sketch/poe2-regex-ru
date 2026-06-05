/**
 * TabletPage — Full working category page for Tablets (Башни Предтеч).
 *
 * Tablet-specific features (parity with poe2.re):
 * - Type filter: Бездна / Делириум / Ритуал / Ваал
 *   NOTE: Экспедиция temporarily removed — no expedition tablets in game yet.
 *   Each type adds a LITERAL matching the tablet type name in Russian.
 * - Rarity filter: Обычный / Волшебный / Редкий
 *   NOTE: All three rarities exist in game. Редкий was missing — now added.
 * - Uses remaining: numeric input → RANGE node with suffix matching uses text
 *   Max uses can exceed 18 (e.g., temple tablets with 19+ charges observed).
 *
 * ⚠️ VERIFICATION NEEDED: The regex strings for tablet types ("бездн", "делир", etc.)
 * are based on the Russian game client translations of tablet type names.
 * These need in-game verification. If any string doesn't match, adjust accordingly.
 *
 * Tablet type names in RU client (estimated):
 * - Башня Бездны Предтеч → "бездн"
 * - Башня Делириума Предтеч → "делир"
 * - Башня Ритуала Предтеч → "ритуал"
 * - Башня Ваал Предтеч → "ваал"
 *
 * Rarity display in RU client:
 * - Обычный → "обычн"
 * - Волшебный → "волшебн"
 * - Редкий → "редк"
 *
 * Uses remaining display (estimated):
 * - "Осталось использований: N" → suffix "использ" (matches "использований")
 *   ⚠️ This needs in-game verification. Alternative suffixes: "исполь", "остал"
 */
import { useState, useMemo } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { t } from '@shared/i18n';
import { literal, or, range } from '@core/ast';
import type { ASTNode } from '@shared/types';

/** Tablet type definitions: label → regex substring
 *  NOTE: Экспедиция removed — no expedition tablets in game yet.
 */
const TABLET_TYPES = [
  { id: 'breach', label: 'Бездна', regex: 'бездн', color: 'text-purple-400' },
  { id: 'delirium', label: 'Делириум', regex: 'делир', color: 'text-blue-400' },
  { id: 'ritual', label: 'Ритуал', regex: 'ритуал', color: 'text-red-400' },
  { id: 'vaal', label: 'Ваал', regex: 'ваал', color: 'text-orange-400' },
] as const;

/** Rarity options — all three rarities exist in game */
const RARITY_OPTIONS = [
  { id: 'normal', label: 'Обычный', regex: 'обычн', color: 'text-white' },
  { id: 'magic', label: 'Волшебный', regex: 'волшебн', color: 'text-blue-300' },
  { id: 'rare', label: 'Редкий', regex: 'редк', color: 'text-yellow-300' },
] as const;

export function TabletPage() {
  // Tablet-specific state
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(new Set());
  const [usesMin, setUsesMin] = useState<number | null>(null);

  // Build tablet-specific extra AST nodes from toggles
  const extraAstNodes = useMemo<ASTNode[]>(() => {
    const nodes: ASTNode[] = [];

    // Type filter: if any types selected, OR them together
    // (A tablet can only be one type, so selecting multiple means "any of these")
    if (selectedTypes.size > 0) {
      const typeLiterals: ASTNode[] = [];
      for (const typeId of selectedTypes) {
        const typeDef = TABLET_TYPES.find(t => t.id === typeId);
        if (typeDef) {
          typeLiterals.push(literal(typeDef.regex));
        }
      }
      if (typeLiterals.length === 1) {
        nodes.push(typeLiterals[0]);
      } else if (typeLiterals.length > 1) {
        nodes.push(or(...typeLiterals));
      }
    }

    // Rarity filter: if any rarities selected, OR them together
    if (selectedRarities.size > 0) {
      const rarityLiterals: ASTNode[] = [];
      for (const rarityId of selectedRarities) {
        const rarityDef = RARITY_OPTIONS.find(r => r.id === rarityId);
        if (rarityDef) {
          rarityLiterals.push(literal(rarityDef.regex));
        }
      }
      if (rarityLiterals.length === 1) {
        nodes.push(rarityLiterals[0]);
      } else if (rarityLiterals.length > 1) {
        nodes.push(or(...rarityLiterals));
      }
    }

    // Uses remaining: if min set, generate RANGE node
    // ⚠️ Suffix "использ" is estimated — needs in-game verification
    // "использ" matches "использований" in "Осталось использований: N"
    // Alternative suffixes: "исполь", "остал", or exact format may differ
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
    selectedIds, searchText, affixFilter, originFilter,
    toggleToken, setSearchText, setAffixFilter, setOriginFilter, clearSelections,
    categoryId, filterStore, restoreFilterState,
  } = useCategoryPage({ categoryId: 'tablet', extraAstNodes });

  // Toggle helpers
  const toggleType = (typeId: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  };

  const toggleRarity = (rarityId: string) => {
    setSelectedRarities(prev => {
      const next = new Set(prev);
      if (next.has(rarityId)) next.delete(rarityId);
      else next.add(rarityId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2" />
          <p className="text-sm">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-300 text-sm">
          Ошибка загрузки: {error}
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-4 text-gray-500">Нет данных</div>;

  const selectedTokens = data.tokens.filter(tok => selectedIds.has(tok.id));
  const hasRangedTokens = selectedTokens.some(tok => tok.ranges.length > 0);
  const rangedSuffixes = [...new Set(
    selectedTokens.filter(tok => tok.ranges.length > 0).map(tok => tok.regex.ru)
  )];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: 'var(--poe-gold)' }}>
          {t('tablet.title')}
        </h2>
        <span className="text-xs text-gray-500">{data.tokens.length} модов</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div>
          <ModList
            tokens={data.tokens} selectedIds={selectedIds} searchText={searchText}
            affixFilter={affixFilter} originFilter={originFilter}
            onToggleToken={toggleToken} onSearchChange={setSearchText}
            onAffixFilterChange={setAffixFilter} onOriginFilterChange={setOriginFilter}
            onClearSelections={clearSelections}
          />
        </div>

        <div className="flex flex-col gap-3">
          {/* Type filter */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">{t('tablet.type')}</div>
            <div className="flex flex-wrap gap-1.5">
              {TABLET_TYPES.map(typeDef => (
                <button key={typeDef.id}
                  onClick={() => toggleType(typeDef.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                    selectedTypes.has(typeDef.id)
                      ? 'bg-gray-700 border-gray-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400'
                  }`}
                >
                  <span className={selectedTypes.has(typeDef.id) ? typeDef.color : ''}>
                    {typeDef.label}
                  </span>
                  {selectedTypes.has(typeDef.id) && (
                    <span className="text-gray-500 ml-1">({typeDef.regex})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Rarity filter */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">{t('tablet.rarity')}</div>
            <div className="flex gap-1.5">
              {RARITY_OPTIONS.map(rarityDef => (
                <button key={rarityDef.id}
                  onClick={() => toggleRarity(rarityDef.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                    selectedRarities.has(rarityDef.id)
                      ? 'bg-gray-700 border-gray-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400'
                  }`}
                >
                  <span className={selectedRarities.has(rarityDef.id) ? rarityDef.color : ''}>
                    {rarityDef.label}
                  </span>
                  {selectedRarities.has(rarityDef.id) && (
                    <span className="text-gray-500 ml-1">({rarityDef.regex})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Uses remaining */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">{t('tablet.uses')}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Мин. ≥</span>
              <input type="number" min={1} max={30} value={usesMin ?? ''}
                onChange={(e) => setUsesMin(e.target.value === '' ? null : parseInt(e.target.value, 10) || null)}
                placeholder="Нет"
                className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              {usesMin !== null && (
                <span className="text-xs text-gray-500">использ</span>
              )}
            </div>
            {usesMin !== null && (
              <div className="text-[10px] text-yellow-700 mt-1">
                {'⚠ Суффикс "использ" требует проверки в игре. Max >18 возможен (напр. храмовые плитки на 19+ зарядов)'}
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Режим выбора модов</div>
            <div className="flex gap-2">
              <button onClick={() => setExcludeMode(false)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${!excludeMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                Хочу
              </button>
              <button onClick={() => setExcludeMode(true)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${excludeMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                Не хочу
              </button>
            </div>
          </div>

          {/* Min value filter */}
          {hasRangedTokens && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-xs text-gray-400 mb-2">Мин. значение (≥N)</div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} value={minValue ?? ''}
                  onChange={(e) => setMinValue(e.target.value === '' ? null : parseInt(e.target.value, 10) || null)}
                  placeholder="Нет"
                  className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-gray-500">
                  {minValue !== null ? `Число ≥${minValue} + суффикс` : 'Только суффикс'}
                </span>
              </div>
              {rangedSuffixes.length > 0 && minValue !== null && (
                <div className="text-[10px] text-gray-600 mt-1">Суффиксы: {rangedSuffixes.join(', ')}</div>
              )}
            </div>
          )}

          {/* Round10 */}
          {hasRangedTokens && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={round10Enabled} onChange={(e) => setRound10Enabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500" />
                <span className="text-xs text-gray-300">{t('round10')}</span>
              </label>
            </div>
          )}

          <RegexOutput regex={regex} isOverflow={isRegexOverflow} filterStore={filterStore} />

          <ProfilePanel
            category={categoryId}
            currentFilterData={filterStore.serialize()}
            onRestore={restoreFilterState}
          />

          {(selectedTokens.length > 0 || selectedTypes.size > 0 || selectedRarities.size > 0 || usesMin !== null) && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">
                Выбрано: {selectedTokens.length} мод(ов)
                {selectedTypes.size > 0 && ` + типы: ${[...selectedTypes].map(id => TABLET_TYPES.find(t => t.id === id)?.label).filter(Boolean).join(', ')}`}
                {selectedRarities.size > 0 && ` + редкость: ${[...selectedRarities].map(id => RARITY_OPTIONS.find(r => r.id === id)?.label).filter(Boolean).join(', ')}`}
                {usesMin !== null && ` + ≥${usesMin} использ.`}
              </div>
              {selectedTokens.length > 0 && (
                <div className="text-[10px] text-gray-600">
                  {excludeMode ? 'Исключить' : 'Включить'}: {selectedTokens.map(tok => tok.rawText.ru.slice(0, 30)).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
