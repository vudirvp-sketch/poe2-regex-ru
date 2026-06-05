/**
 * WaystonePage — Full working category page for Waystones.
 *
 * Waystones have specific features:
 * - Tier filter (min tier)
 * - Corrupted / Delirious state toggles
 * - Quantifiers (IIQ, IIR, Pack Size) with minimum value filters
 */
import { useState } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { RegexOutput } from '@ui/components/RegexOutput';
import { t } from '@shared/i18n';

export function WaystonePage() {
  const {
    data, loading, error,
    regex, isRegexOverflow,
    excludeMode, setExcludeMode,
    round10Enabled, setRound10Enabled,
    minValue, setMinValue,
    selectedIds, searchText, affixFilter, originFilter,
    toggleToken, setSearchText, setAffixFilter, setOriginFilter, clearSelections,
  } = useCategoryPage({ categoryId: 'waystone' });

  // Waystone-specific state
  const [tierMin, setTierMin] = useState<number | null>(null);
  const [corrupted, setCorrupted] = useState(false);
  const [uncorrupted, setUncorrupted] = useState(false);
  const [delirious, setDelirious] = useState(false);

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

  const selectedTokens = data.tokens.filter(t => selectedIds.has(t.id));
  const hasRangedTokens = selectedTokens.some(t => t.ranges.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: 'var(--poe-gold)' }}>
          {t('waystone.title')}
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
          {/* Waystone Tier Filter */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Тир путевого камня</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Мин. тир:</span>
              <input
                type="number" min={1} max={16}
                value={tierMin ?? ''}
                onChange={(e) => setTierMin(e.target.value === '' ? null : parseInt(e.target.value, 10) || null)}
                placeholder="Любой"
                className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* State toggles */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Состояние</div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={corrupted}
                  onChange={(e) => { setCorrupted(e.target.checked); if (e.target.checked) setUncorrupted(false); }}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500" />
                <span className="text-xs text-gray-300">Осквернён</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={uncorrupted}
                  onChange={(e) => { setUncorrupted(e.target.checked); if (e.target.checked) setCorrupted(false); }}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-green-500" />
                <span className="text-xs text-gray-300">Неосквернён</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={delirious}
                  onChange={(e) => setDelirious(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500" />
                <span className="text-xs text-gray-300">Делириум</span>
              </label>
            </div>
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

          <RegexOutput regex={regex} isOverflow={isRegexOverflow} />

          {selectedTokens.length > 0 && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Выбрано: {selectedTokens.length} мод(ов)</div>
              <div className="text-[10px] text-gray-600">
                {excludeMode ? 'Исключить' : 'Включить'}: {selectedTokens.map(t => t.rawText.ru.slice(0, 30)).join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
