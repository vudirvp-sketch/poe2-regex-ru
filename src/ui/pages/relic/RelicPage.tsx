/**
 * RelicPage — Full working category page for Relics (Urn + Seal combined).
 *
 * Relics have a smaller mod pool (56 tokens). The page follows the
 * same pattern as Belt/Ring/Amulet pages using useCategoryPage hook.
 */
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { RegexOutput } from '@ui/components/RegexOutput';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { t } from '@shared/i18n';

export function RelicPage() {
  const {
    data, loading, error,
    regex, isRegexOverflow,
    excludeMode, setExcludeMode,
    round10Enabled, setRound10Enabled,
    minValue, setMinValue,
    maxValue, setMaxValue,
    selectedIds, searchText, affixFilter, originFilter,
    toggleToken, setSearchText, setAffixFilter, setOriginFilter, clearSelections,
    categoryId, filterStore, restoreFilterState,
  } = useCategoryPage({ categoryId: 'relic' });

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: 'var(--poe-gold)' }}>
          {t('relic.title')}
        </h2>
        <span className="text-xs text-gray-500">{data.tokens.length} модов</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div>
          <ModList
            tokens={data.tokens}
            selectedIds={selectedIds}
            searchText={searchText}
            affixFilter={affixFilter}
            originFilter={originFilter}
            onToggleToken={toggleToken}
            onSearchChange={setSearchText}
            onAffixFilterChange={setAffixFilter}
            onOriginFilterChange={setOriginFilter}
            onClearSelections={clearSelections}
          />
        </div>

        <div className="flex flex-col gap-3">
          {/* Mode toggle: Want / Don't Want */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Режим выбора</div>
            <div className="flex gap-2">
              <button
                onClick={() => setExcludeMode(false)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  !excludeMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                Хочу эти моды
              </button>
              <button
                onClick={() => setExcludeMode(true)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  excludeMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                Не хочу эти моды
              </button>
            </div>
          </div>

          {hasRangedTokens && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-xs text-gray-400 mb-2">Диапазон значений</div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">≥</span>
                <input type="number" min={0} value={minValue ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMinValue(v === '' ? null : parseInt(v, 10) || null);
                  }}
                  placeholder="Мин"
                  className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-gray-500">≤</span>
                <input type="number" min={0} value={maxValue ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMaxValue(v === '' ? null : parseInt(v, 10) || null);
                  }}
                  placeholder="Макс"
                  className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-xs text-gray-500">
                {minValue !== null && maxValue !== null
                  ? `${minValue} ≤ N ≤ ${maxValue} + суффикс`
                  : minValue !== null
                    ? `N ≥ ${minValue} + суффикс`
                    : maxValue !== null
                      ? `N ≤ ${maxValue} + суффикс`
                      : 'Только суффикс (любой тир)'}
              </span>
            </div>
          )}

          {/* Round10 toggle */}
          {hasRangedTokens && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={round10Enabled}
                  onChange={(e) => setRound10Enabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
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

          {selectedTokens.length > 0 && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Выбрано: {selectedTokens.length} мод(ов)</div>
              <div className="text-[10px] text-gray-600">
                {excludeMode ? 'Исключить' : 'Включить'}: {selectedTokens.map(tok => tok.rawText.ru.slice(0, 30)).join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
