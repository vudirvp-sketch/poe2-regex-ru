/**
 * VendorPage — Vendor regex filter for the Russian game client.
 *
 * Layout v2 (iteration 8): Uses shared CategoryControlPanel for sticky
 * regex output + mode toggle + round10. Chip groups below, verification note at bottom.
 *
 * All business logic (state management, URL sync, regex compilation) is
 * in useVendorPage hook — this component is rendering only.
 *
 * The hardcoded Russian regex strings in VENDOR_PROPERTIES are OK —
 * vendor properties are NOT mod-based and don't come from ETL data.
 * The plan's invariant I4 targets mod strings from ETL, not vendor labels.
 */
import { VendorChip } from '@ui/components/VendorChip';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { t } from '@shared/i18n';
import { useVendorPage, GROUP_COLORS } from '@ui/hooks/useVendorPage';

export function VendorPage() {
  const {
    regex, isRegexOverflow,
    selectedIds, excludedIds,
    toggleProperty, toggleExclude, setNumericValue,
    numericInputs,
    round10Enabled, setRound10Enabled,
    searchLogic, setSearchLogic,
    clearAll,
    hasNumericSelected, excludeCount,
    groupedProperties,
    filterStore,
  } = useVendorPage();

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
          <img src={`${import.meta.env.BASE_URL}icons/vendor.png`} alt="" width={24} height={24} className="object-contain" />
          {t('vendor.title')}
        </h2>
        <span className="text-xs text-gray-500">
          {selectedIds.size} {t('selected')}
        </span>
      </div>

      {/* Shared control panel: regex output + mode toggle + round10 + clear */}
      <CategoryControlPanel
        regex={regex}
        isOverflow={isRegexOverflow}
        filterStore={filterStore}
        hasRangedTokens={false}
        minValue={null}
        setMinValue={() => {}}
        maxValue={null}
        setMaxValue={() => {}}
        rangedSuffixes={[]}
        round10Enabled={round10Enabled}
        setRound10Enabled={setRound10Enabled}
        searchLogic={searchLogic}
        setSearchLogic={setSearchLogic}
        showRound10={hasNumericSelected}
        excludedCount={excludeCount}
        activeTokenCount={selectedIds.size}
        clearButton={
          selectedIds.size > 0 ? (
            <button
              onClick={clearAll}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-600 transition-colors"
            >
              {t('filter.clear')} ({selectedIds.size})
            </button>
          ) : undefined
        }
      />

      {/* Chip-based property groups */}
      <div className="flex flex-col gap-3">
        {Array.from(groupedProperties.entries()).map(([groupName, props]) => {
          const colors = GROUP_COLORS[groupName] ?? { header: 'text-gray-400', border: 'border-l-gray-500' };
          return (
            <div key={groupName}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${colors.header}`}>
                ── {groupName} ({props.length}) ──
              </div>
              <div className="flex flex-wrap gap-1.5">
                {props.map(prop => (
                  <VendorChip
                    key={prop.id}
                    prop={prop}
                    isSelected={selectedIds.has(prop.id) && !excludedIds.has(prop.id)}
                    isExcluded={excludedIds.has(prop.id)}
                    numericValue={numericInputs[prop.id] ?? null}
                    onToggle={toggleProperty}
                    onToggleExclude={toggleExclude}
                    onNumericChange={setNumericValue}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification note */}
      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-3 text-xs text-yellow-400/80" role="alert">
        <strong>{t('vendor.verification')}</strong>
      </div>
    </div>
  );
}
