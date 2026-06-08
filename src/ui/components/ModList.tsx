/**
 * ModList — A two-column filterable mod list with semantic grouping.
 *
 * Redesigned layout (v3):
 * - Two columns: Prefix (left) | Suffix (right) with flex-wrap chips
 * - When showOriginSubSections is enabled, each affix column groups by
 *   origin FIRST (Обычные, Очернённые, Осквернённые, etc.), then within
 *   each origin section groups by semantic category. This avoids duplicate
 *   origin headers that appeared in v2.
 * - When showOriginSubSections is false, groups purely by semantic category.
 * - No virtual scroll: simple rendering for <300 family groups
 * - Search and filter controls at the top
 * - Full-width layout (takes entire available width)
 */
import React, { useMemo, useCallback } from 'react';
import type { GameToken, AffixType, ModOrigin, FamilyGroup, PriorityFilter } from '@shared/types';
import { groupTokensByFamily, splitGroupByOrigin, countUniqueFamilyKeys } from '@shared/family-grouper';
import { classifyGroups, type ModGroupMode, type ModSubGroup, type JewelTypeCategory } from '@shared/mod-classifier';
import { ORIGIN_SECTION_LABELS } from '@shared/mod-classifier';
import { FilterChip } from './FilterChip';
import { t } from '@shared/i18n';
import type { TokenRangeOverride } from '@store/filter-store';

interface ModListProps {
  tokens: GameToken[];
  selectedIds: Set<string>;
  searchText: string;
  affixFilter: AffixType | null;
  originFilter: ModOrigin | null;
  onToggleTokens: (ids: string[]) => void;
  onSearchChange: (text: string) => void;
  onAffixFilterChange: (filter: AffixType | null) => void;
  onOriginFilterChange: (filter: ModOrigin | null) => void;
  onClearSelections: () => void;
  /** Grouping mode for sub-categorization within affix columns */
  groupMode?: ModGroupMode;
  /** When true, group by origin first, then by semantic category within
   *  each origin section. This avoids duplicate "Осквернённые" headers. */
  showOriginSubSections?: boolean;
  /** When true, within each origin section in origin mode, further sub-group
   *  by jewel type (Рубин/Изумруд/Сапфир/Общие). Used by JewelPage. */
  showJewelTypeSubGroups?: boolean;
  /** Active jewel type filter — when set, only show sub-headers for this type + shared.
   *  When 'all', show all sub-headers. */
  jewelTypeFilter?: JewelTypeCategory | 'all';
  /** Per-token numeric range overrides */
  perTokenRanges?: Record<string, TokenRangeOverride>;
  /** Set per-token numeric range override */
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  /** Clear per-token numeric range override */
  onClearTokenRange?: (tokenId: string) => void;
  /** Set of token IDs whose individual regex was collapsed by the optimizer */
  collapsedTokenIds?: Set<string>;
  /** Item category for priority tier classification (e.g., 'ring', 'belt') */
  category?: string;
  /** Priority tier filter: 'all' = show all, 'S+A' = S and A only, 'S' = S only */
  priorityFilter?: PriorityFilter;
}

/** Origin section within an affix column */
interface OriginSection {
  origin: ModOrigin;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  borderLClass: string;
  subGroups: ModSubGroup[];
}

const ORIGIN_ORDER: ModOrigin[] = ['normal', 'desecrated', 'corrupted', 'essence', 'breachborn'];

/**
 * Split family groups by origin, then classify each origin's groups by semantic category.
 * Returns origin sections, each containing classified sub-groups.
 */
function splitByOriginThenSemantic(
  groups: FamilyGroup[],
  mode: ModGroupMode
): OriginSection[] {
  // Step 1: Split all groups by origin
  const byOrigin = new Map<ModOrigin, FamilyGroup[]>();

  for (const group of groups) {
    const splits = splitGroupByOrigin(group);
    for (const { origin, group: splitGroup } of splits) {
      const list = byOrigin.get(origin) || [];
      list.push(splitGroup);
      byOrigin.set(origin, list);
    }
  }

  // Step 2: Classify each origin's groups
  const result: OriginSection[] = [];
  for (const origin of ORIGIN_ORDER) {
    const originGroups = byOrigin.get(origin);
    if (!originGroups || originGroups.length === 0) continue;

    const labelConfig = ORIGIN_SECTION_LABELS[origin];
    const subGroups = classifyGroups(originGroups, mode);

    result.push({
      origin,
      label: labelConfig?.label ?? t('origin.' + origin),
      colorClass: labelConfig?.colorClass ?? 'text-gray-400',
      bgClass: labelConfig?.bgClass ?? '',
      borderClass: labelConfig?.borderClass ?? '',
      borderLClass: labelConfig?.borderLClass ?? '',
      subGroups,
    });
  }

  return result;
}

/** Render a sub-group with its Level 3 badge header and flex-wrap chips */
const ModSubGroupSection: React.FC<{
  subGroup: ModSubGroup;
  selectedIds: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  collapsedTokenIds?: Set<string>;
}> = React.memo(({ subGroup, selectedIds, onToggleTokens, perTokenRanges, onSetTokenRange, onClearTokenRange, collapsedTokenIds }) => {
  return (
    <div className="mb-2">
      {subGroup.label && (
        <div className={`inline-block ml-4 mb-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-px rounded ${subGroup.bgClass} border ${subGroup.borderClass} ${subGroup.colorClass}`}>
          {subGroup.label} ({subGroup.groups.length})
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {subGroup.groups.map((group) => (
          <FilterChip
            key={group.familyKey}
            group={group}
            selectedIds={selectedIds}
            onToggleTokens={onToggleTokens}
            perTokenRanges={perTokenRanges}
            onSetTokenRange={onSetTokenRange}
            onClearTokenRange={onClearTokenRange}
            collapsedTokenIds={collapsedTokenIds}
          />
        ))}
      </div>
    </div>
  );
});

/** A single affix column (prefix or suffix) */
const AffixColumn: React.FC<{
  affix: AffixType;
  subGroups: ModSubGroup[];
  originSections: OriginSection[];
  selectedIds: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  showOriginSubSections: boolean;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  collapsedTokenIds?: Set<string>;
}> = React.memo(({ affix, subGroups, originSections, selectedIds, onToggleTokens, showOriginSubSections, perTokenRanges, onSetTokenRange, onClearTokenRange, collapsedTokenIds }) => {
  const totalCount = showOriginSubSections
    ? originSections.reduce((sum, os) => sum + os.subGroups.reduce((s, sg) => s + sg.groups.length, 0), 0)
    : subGroups.reduce((sum, sg) => sum + sg.groups.length, 0);

  if (totalCount === 0) return null;

  const isPrefix = affix === 'prefix';
  const headerColor = isPrefix ? 'text-blue-400' : 'text-orange-400';
  const borderColor = isPrefix ? 'border-blue-800/50' : 'border-orange-800/50';

  return (
    <div className={`flex flex-col min-w-0 ${totalCount > 0 ? `border-l-2 pl-3 ${borderColor}` : ''}`}>
      <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${headerColor}`}>
        {t('affix.' + affix)} ({totalCount})
      </h4>

      {showOriginSubSections ? (
        /* Group by origin first, then by semantic category within each origin */
        originSections.map((section, idx) => {
          const sectionCount = section.subGroups.reduce((s, sg) => s + sg.groups.length, 0);
          return (
            <div key={section.origin} className={idx > 0 ? 'mt-3' : ''}>
              {idx > 0 && (
                <div className={`inline-block ml-2 mt-2.5 mb-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-sm border-l-2 ${section.bgClass} ${section.borderClass} ${section.borderLClass} ${section.colorClass}`}>
                  {section.label} ({sectionCount})
                </div>
              )}
              {section.subGroups.map((sg) => (
                <ModSubGroupSection
                  key={sg.key}
                  subGroup={sg}
                  selectedIds={selectedIds}
                  onToggleTokens={onToggleTokens}
                  perTokenRanges={perTokenRanges}
                  onSetTokenRange={onSetTokenRange}
                  onClearTokenRange={onClearTokenRange}
                  collapsedTokenIds={collapsedTokenIds}
                />
              ))}
            </div>
          );
        })
      ) : (
        /* Group purely by semantic category */
        subGroups.map((sg) => (
          <ModSubGroupSection
            key={sg.key}
            subGroup={sg}
            selectedIds={selectedIds}
            onToggleTokens={onToggleTokens}
            perTokenRanges={perTokenRanges}
            onSetTokenRange={onSetTokenRange}
            onClearTokenRange={onClearTokenRange}
            collapsedTokenIds={collapsedTokenIds}
          />
        ))
      )}
    </div>
  );
});

export const ModList: React.FC<ModListProps> = ({
  tokens,
  selectedIds,
  searchText,
  affixFilter,
  originFilter,
  onToggleTokens,
  onSearchChange,
  onAffixFilterChange,
  onOriginFilterChange,
  onClearSelections,
  groupMode = 'affix-semantic',
  showOriginSubSections = false,
  showJewelTypeSubGroups = false,
  jewelTypeFilter = 'all',
  perTokenRanges,
  onSetTokenRange,
  onClearTokenRange,
  collapsedTokenIds,
  category,
  priorityFilter = 'all',
}) => {
  const availableOrigins = useMemo(() => {
    const origins = new Set<ModOrigin>();
    for (const token of tokens) {
      origins.add(token.origin);
    }
    return Array.from(origins).sort();
  }, [tokens]);

  // Filter tokens (BEFORE grouping)
  const filteredTokens = useMemo(() => {
    let result = tokens;

    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (t) =>
          t.rawText.ru.toLowerCase().includes(lower) ||
          t.regex.ru.toLowerCase().includes(lower)
      );
    }

    if (affixFilter) {
      result = result.filter((t) => t.affix === affixFilter);
    }

    if (originFilter) {
      result = result.filter((t) => t.origin === originFilter);
    }

    return result;
  }, [tokens, searchText, affixFilter, originFilter]);

  // Group filtered tokens by family (with category for priority tier)
  const familyGroups = useMemo(
    () => groupTokensByFamily(filteredTokens, category),
    [filteredTokens, category]
  );

  // Filter by priority tier
  const priorityFilteredGroups = useMemo(() => {
    if (priorityFilter === 'all') return familyGroups;
    return familyGroups.filter(g => {
      if (priorityFilter === 'S') return g.priorityTier === 'S';
      if (priorityFilter === 'S+A') return g.priorityTier === 'S' || g.priorityTier === 'A';
      return true;
    });
  }, [familyGroups, priorityFilter]);

  // Separate groups by affix type (after priority filter)
  const prefixGroups = useMemo(
    () => priorityFilteredGroups.filter((g) => g.affix === 'prefix'),
    [priorityFilteredGroups]
  );
  const suffixGroups = useMemo(
    () => priorityFilteredGroups.filter((g) => g.affix === 'suffix'),
    [priorityFilteredGroups]
  );

  // Classify groups into sub-groups based on mode
  const prefixSubGroups = useMemo(
    () => classifyGroups(prefixGroups, groupMode),
    [prefixGroups, groupMode]
  );
  const suffixSubGroups = useMemo(
    () => classifyGroups(suffixGroups, groupMode),
    [suffixGroups, groupMode]
  );

  // When showOriginSubSections, also compute origin-then-semantic groupings
  const prefixOriginSections = useMemo(
    () => showOriginSubSections ? splitByOriginThenSemantic(prefixGroups, groupMode) : [],
    [prefixGroups, groupMode, showOriginSubSections]
  );
  const suffixOriginSections = useMemo(
    () => showOriginSubSections ? splitByOriginThenSemantic(suffixGroups, groupMode) : [],
    [suffixGroups, groupMode, showOriginSubSections]
  );

  const handleAffixFilter = useCallback(
    (value: string) => {
      onAffixFilterChange(value === 'all' ? null : (value as AffixType));
    },
    [onAffixFilterChange]
  );

  const handleOriginFilter = useCallback(
    (value: string) => {
      onOriginFilterChange(value === 'all' ? null : (value as ModOrigin));
    },
    [onOriginFilterChange]
  );

  // Determine if we need two columns or one
  const hasBothAffixes = prefixGroups.length > 0 && suffixGroups.length > 0;
  const isOriginMode = groupMode === 'origin';

  /** Render jewel type sub-groups within an affix column of an origin section */
  const renderJewelTypeSubGroups = (groups: FamilyGroup[]) => {
    const jewelSubGroups = classifyGroups(groups, 'jewel-type');
    return jewelSubGroups
      .filter(sg => {
        // When a specific type is selected, only show that type + shared
        if (jewelTypeFilter !== 'all') {
          return sg.key === jewelTypeFilter || sg.key === 'shared';
        }
        return true;
      })
      .map(sg => (
        <div key={sg.key} className="mb-1.5">
          <div className={`inline-block ml-4 mb-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-px rounded ${sg.bgClass} border ${sg.borderClass} ${sg.colorClass}`}>
            {sg.label} ({sg.groups.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sg.groups.map(group => (
              <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} onToggleTokens={onToggleTokens} perTokenRanges={perTokenRanges} onSetTokenRange={onSetTokenRange} onClearTokenRange={onClearTokenRange} collapsedTokenIds={collapsedTokenIds} />
            ))}
          </div>
        </div>
      ));
  };

  return (
    <div className="mod-list flex flex-col gap-3" role="group" aria-label={t('search.placeholder')}>
      {/* Search + Filters row */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="flex-1 min-w-[180px] px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        <select
          value={affixFilter || 'all'}
          onChange={(e) => handleAffixFilter(e.target.value)}
          aria-label={t('filter.all_types')}
          className="px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">{t('filter.all_types')}</option>
          <option value="prefix">{t('affix.prefix')}</option>
          <option value="suffix">{t('affix.suffix')}</option>
        </select>

        {availableOrigins.length > 1 && (
          <select
            value={originFilter || 'all'}
            onChange={(e) => handleOriginFilter(e.target.value)}
            aria-label={t('filter.all_origins')}
            className="px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">{t('filter.all_origins')}</option>
            {availableOrigins.map((origin) => (
              <option key={origin} value={origin}>
                {t('origin.' + origin)}
              </option>
            ))}
          </select>
        )}

        {selectedIds.size > 0 && (
          <button
            onClick={onClearSelections}
            className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-600 transition-colors"
          >
            {t('filter.clear')} ({countUniqueFamilyKeys(tokens.filter(t => selectedIds.has(t.id)))})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="text-xs text-gray-500">
        {t('filter.stats').replace('{shown}', String(priorityFilteredGroups.length)).replace('{total}', String(tokens.length))}
      </div>

      {/* Mod groups area */}
      {priorityFilteredGroups.length > 0 ? (
        isOriginMode ? (
          /* Origin mode: single column, sub-grouped by origin */
          <div className="flex flex-col gap-2">
            {classifyGroups(priorityFilteredGroups, 'origin').map((sg) => (
              <div key={sg.key}>
                <div className={`inline-block ml-2 mb-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-sm border-l-2 ${sg.bgClass} ${sg.borderClass} ${sg.borderLClass} ${sg.colorClass}`}>
                  {sg.label} ({sg.groups.length})
                </div>
                {/* Within each origin, further split by affix */}
                {(() => {
                  const originPrefix = sg.groups.filter(g => g.affix === 'prefix');
                  const originSuffix = sg.groups.filter(g => g.affix === 'suffix');
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-2">
                      {originPrefix.length > 0 && (
                        <div className="border-l-2 border-blue-800/50 pl-3">
                          <h5 className="text-[10px] font-semibold text-blue-400 uppercase mb-1">{t('affix.prefix')} ({originPrefix.length})</h5>
                          {showJewelTypeSubGroups
                            ? renderJewelTypeSubGroups(originPrefix)
                            : <div className="flex flex-wrap gap-1.5">
                                {originPrefix.map(group => (
                                  <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} onToggleTokens={onToggleTokens} perTokenRanges={perTokenRanges} onSetTokenRange={onSetTokenRange} onClearTokenRange={onClearTokenRange} collapsedTokenIds={collapsedTokenIds} />
                                ))}
                              </div>
                          }
                        </div>
                      )}
                      {originSuffix.length > 0 && (
                        <div className="border-l-2 border-orange-800/50 pl-3">
                          <h5 className="text-[10px] font-semibold text-orange-400 uppercase mb-1">{t('affix.suffix')} ({originSuffix.length})</h5>
                          {showJewelTypeSubGroups
                            ? renderJewelTypeSubGroups(originSuffix)
                            : <div className="flex flex-wrap gap-1.5">
                                {originSuffix.map(group => (
                                  <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} onToggleTokens={onToggleTokens} perTokenRanges={perTokenRanges} onSetTokenRange={onSetTokenRange} onClearTokenRange={onClearTokenRange} collapsedTokenIds={collapsedTokenIds} />
                                ))}
                              </div>
                          }
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : hasBothAffixes ? (
          /* Two-column layout: Prefix | Suffix */
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-4">
            <AffixColumn
              affix="prefix"
              subGroups={prefixSubGroups}
              originSections={prefixOriginSections}
              selectedIds={selectedIds}
              onToggleTokens={onToggleTokens}
              showOriginSubSections={showOriginSubSections}
              perTokenRanges={perTokenRanges}
              onSetTokenRange={onSetTokenRange}
              onClearTokenRange={onClearTokenRange}
              collapsedTokenIds={collapsedTokenIds}
            />
            <AffixColumn
              affix="suffix"
              subGroups={suffixSubGroups}
              originSections={suffixOriginSections}
              selectedIds={selectedIds}
              onToggleTokens={onToggleTokens}
              showOriginSubSections={showOriginSubSections}
              perTokenRanges={perTokenRanges}
              onSetTokenRange={onSetTokenRange}
              onClearTokenRange={onClearTokenRange}
              collapsedTokenIds={collapsedTokenIds}
            />
          </div>
        ) : (
          /* Single column (only one affix type after filtering) */
          <div className="flex flex-col gap-2">
            {prefixGroups.length > 0 && (
              <AffixColumn
                affix="prefix"
                subGroups={prefixSubGroups}
                originSections={prefixOriginSections}
                selectedIds={selectedIds}
                onToggleTokens={onToggleTokens}
                showOriginSubSections={showOriginSubSections}
                perTokenRanges={perTokenRanges}
                onSetTokenRange={onSetTokenRange}
                onClearTokenRange={onClearTokenRange}
                collapsedTokenIds={collapsedTokenIds}
              />
            )}
            {suffixGroups.length > 0 && (
              <AffixColumn
                affix="suffix"
                subGroups={suffixSubGroups}
                originSections={suffixOriginSections}
                selectedIds={selectedIds}
                onToggleTokens={onToggleTokens}
                showOriginSubSections={showOriginSubSections}
                perTokenRanges={perTokenRanges}
                onSetTokenRange={onSetTokenRange}
                onClearTokenRange={onClearTokenRange}
                collapsedTokenIds={collapsedTokenIds}
              />
            )}
          </div>
        )
      ) : (
        <div className="text-center text-gray-500 py-8">
          {t('filter.no_results')}
        </div>
      )}
    </div>
  );
};
