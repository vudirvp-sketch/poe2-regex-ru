/**
 * VendorPage — Vendor regex filter for the Russian game client.
 *
 * Layout v3 (iteration 7): Uses useCategoryPage with customData
 * from buildVendorCategoryData(). Renders FilterChip instead of VendorChip.
 * Groups chips by vendor property group (from tags: group:${group}).
 *
 * This eliminates the useVendorPage hook and VendorChip component,
 * unifying vendor page state management with all other category pages.
 *
 * The hardcoded Russian regex strings in VENDOR_PROPERTIES are OK —
 * vendor properties are NOT mod-based and don't come from ETL data.
 * The plan's invariant I4 targets mod strings from ETL, not vendor labels.
 */
import { useMemo } from 'react';
import { useCategoryPage } from '@ui/hooks/useCategoryPage';
import { buildVendorCategoryData } from '@data/vendor-adapter';
import { FilterChip } from '@ui/components/FilterChip';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { groupTokensByFamily } from '@shared/family-grouper';
import { t } from '@shared/i18n';
import type { FamilyGroup } from '@shared/types';

// ─── Group order for consistent display ───

const GROUP_ORDER = [
  'Свойства предмета',
  'Скорость',
  'Скорость передвижения',
  'Сопротивления',
  'Модификаторы',
  'Умения',
  'Характеристики',
  'Уровень',
  'Редкость предмета',
  'Класс — Украшения',
  'Класс — Оружие 1H',
  'Класс — Оружие 2H',
  'Класс — Экипировка',
  'Класс — Оффхэнд',
];

// ─── Group color config for visual differentiation ───
// Derived from the group tag on each token (tags: [group:${groupName}])

const GROUP_COLORS: Record<string, { header: string; border: string }> = {
  'Свойства предмета':    { header: 'text-muted',          border: 'border-l-bl-gray' },
  'Скорость':             { header: 'text-accent-yellow',   border: 'border-l-bl-yellow' },
  'Скорость передвижения':{ header: 'text-accent-yellow',   border: 'border-l-bl-yellow' },
  'Сопротивления':        { header: 'text-accent-blue',     border: 'border-l-bl-blue' },
  'Модификаторы':         { header: 'text-accent-red',      border: 'border-l-bl-red' },
  'Умения':               { header: 'text-accent-purple',   border: 'border-l-bl-purple' },
  'Характеристики':       { header: 'text-accent-teal',     border: 'border-l-bl-green' },
  'Уровень':              { header: 'text-accent-cyan',     border: 'border-l-bl-cyan' },
  'Редкость предмета':    { header: 'text-accent-orange',   border: 'border-l-bl-orange' },
  'Класс — Украшения':    { header: 'text-accent-amber',    border: 'border-l-bl-amber' },
  'Класс — Оружие 1H':   { header: 'text-accent-red',      border: 'border-l-bl-red' },
  'Класс — Оружие 2H':   { header: 'text-accent-red',      border: 'border-l-bl-red' },
  'Класс — Экипировка':  { header: 'text-accent-sky',      border: 'border-l-bl-sky' },
  'Класс — Оффхэнд':     { header: 'text-accent-teal',     border: 'border-l-bl-teal' },
};

/** Extract the group name from a FamilyGroup's member tokens' tags */
function getGroupName(group: FamilyGroup): string {
  const tag = group.members[0]?.tags?.find(t => t.startsWith('group:'));
  return tag ? tag.slice(6) : 'Другое';
}

/** Group FamilyGroups by their group tag, preserving GROUP_ORDER */
function groupFamiliesByGroup(families: FamilyGroup[]): Map<string, FamilyGroup[]> {
  const groups = new Map<string, FamilyGroup[]>();
  for (const family of families) {
    const groupName = getGroupName(family);
    const list = groups.get(groupName) || [];
    list.push(family);
    groups.set(groupName, list);
  }
  // Sort groups by GROUP_ORDER
  const sorted = new Map<string, FamilyGroup[]>();
  for (const groupName of GROUP_ORDER) {
    const list = groups.get(groupName);
    if (list) sorted.set(groupName, list);
  }
  // Add any groups not in GROUP_ORDER
  for (const [groupName, list] of groups) {
    if (!sorted.has(groupName)) sorted.set(groupName, list);
  }
  return sorted;
}

export function VendorPage() {
  const vendorData = useMemo(() => buildVendorCategoryData(), []);
  const state = useCategoryPage({ categoryId: 'vendor', customData: vendorData });

  const {
    data,
    regex, isRegexOverflow,
    selectedIds, excludedIds, toggleExclude,
    round10Enabled, setRound10Enabled,
    searchLogic, setSearchLogic,
    toggleTokens, clearSelections,
    perTokenRanges, setTokenRange, clearTokenRange,
    collapsedTokenIds, filterStore,
  } = state;

  // Group tokens into FamilyGroups, then sub-group by vendor property group
  // Post-process: for numeric vendor chips, override displayText to avoid
  // duplicate range display (inline range + range badge). Use the raw label
  // (e.g., "Ур. предмета ≥N") instead of the generated text with inline range
  // (e.g., "Ур. предмета ≥(0—1000)").
  // When a min value is set via perTokenRange, replace "≥N" with "≥{value}"
  // in displayText so the chip reflects the actual threshold.
  const groupedFamilies = useMemo(() => {
    if (!data) return new Map<string, FamilyGroup[]>();
    const families = groupTokensByFamily(data.tokens, 'vendor').map(family => {
      if (family.rangeSlots.length > 0 && family.members[0]) {
        const baseText = family.members[0].rawText.ru;
        const memberId = family.members[0].id;
        const rangeOverride = perTokenRanges[memberId];
        const minValue = rangeOverride?.min;
        // Replace ≥N with the actual min value if set
        const displayText = minValue !== undefined && minValue > 0
          ? baseText.replace('≥N', `≥${minValue}`)
          : baseText;
        return {
          ...family,
          displayText,
        };
      }
      return family;
    });
    return groupFamiliesByGroup(families);
  }, [data, perTokenRanges]);

  // Count active tokens
  const allActiveTokens = data?.tokens.filter(tok => selectedIds.has(tok.id) || excludedIds.has(tok.id)) ?? [];
  const excludeCount = data?.tokens.filter(tok => excludedIds.has(tok.id)).length ?? 0;
  const hasRangedTokens = allActiveTokens.some(tok => tok.ranges.length > 0);

  // Ranged suffixes for CategoryControlPanel
  const rangedSuffixes = [...new Set(
    allActiveTokens.filter(tok => tok.ranges.length > 0).map(tok => tok.regex.ru)
  )];

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
          <img src={`${import.meta.env.BASE_URL}icons/vendor.png`} alt="" width={24} height={24} className="object-contain" />
          {t('vendor.title')}
        </h2>
        <span className="text-xs text-dim">
          {selectedIds.size} {t('selected')}
        </span>
      </div>

      {/* Shared control panel: regex output + mode toggle + round10 + clear */}
      <CategoryControlPanel
        regex={regex}
        isOverflow={isRegexOverflow}
        filterStore={filterStore}
        hasRangedTokens={hasRangedTokens}
        minValue={null}
        setMinValue={() => {}}
        maxValue={null}
        setMaxValue={() => {}}
        rangedSuffixes={rangedSuffixes}
        round10Enabled={round10Enabled}
        setRound10Enabled={setRound10Enabled}
        searchLogic={searchLogic}
        setSearchLogic={setSearchLogic}
        showRound10={hasRangedTokens}
        excludedCount={excludeCount}
        activeTokenCount={allActiveTokens.length}
        clearButton={
          selectedIds.size > 0 ? (
            <button
              onClick={clearSelections}
              className="px-2 py-1 bg-raised border border-edge rounded text-xs text-soft hover:bg-gray-600 transition-colors"
            >
              {t('filter.clear')} ({selectedIds.size})
            </button>
          ) : undefined
        }
      />

      {/* Chip-based property groups */}
      <div className="flex flex-col gap-3">
        {Array.from(groupedFamilies.entries()).map(([groupName, families]) => {
          const colors = GROUP_COLORS[groupName] ?? { header: 'text-muted', border: 'border-l-bl-gray' };
          return (
            <div key={groupName}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${colors.header}`}>
                ── {groupName} ({families.length}) ──
              </div>
              <div className="flex flex-wrap gap-1.5">
                {families.map(family => (
                  <FilterChip
                    key={family.familyKey}
                    group={family}
                    selectedIds={selectedIds}
                    excludedIds={excludedIds}
                    onToggleTokens={toggleTokens}
                    onToggleExclude={toggleExclude}
                    perTokenRanges={perTokenRanges}
                    onSetTokenRange={setTokenRange}
                    onClearTokenRange={clearTokenRange}
                    collapsedTokenIds={collapsedTokenIds}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification note */}
      <div className="bg-section-yellow border border-aborder-yellow rounded p-3 text-xs text-accent-yellow-dim" role="alert">
        <strong>{t('vendor.verification')}</strong>
      </div>
    </div>
  );
}
