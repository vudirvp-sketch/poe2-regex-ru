/**
 * RingPage — Category page for Rings.
 *
 * Layout v2: Control panel (regex + controls) sticky at top,
 * mod list full width below with two-column prefix/suffix layout
 * and semantic sub-grouping (offensive/defensive/attribute/neutral).
 */
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { ModList } from '@ui/components/ModList';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { ProfilePanel } from '@ui/components/ProfilePanel';
import { t } from '@shared/i18n';

export function RingPage() {
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
  } = useCategoryPage({ categoryId: 'ring' });

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
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
          <img src={`${import.meta.env.BASE_URL}icons/ring.png`} alt="" width={24} height={24} className="object-contain" />
          {t('ring.title')}
        </h2>
        <span className="text-xs text-gray-500">{data.tokens.length} модов</span>
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
        groupMode="affix-semantic"
        showOriginSubSections
      />

      <div className="flex flex-col gap-3">
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
  );
}
