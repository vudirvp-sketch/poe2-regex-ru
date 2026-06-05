/**
 * ModList — A two-column filterable mod list with semantic grouping.
 *
 * Redesigned layout (v2):
 * - Two columns: Prefix (left) | Suffix (right) with flex-wrap chips
 * - Semantic sub-groups within each column (offensive/defensive/attribute/neutral,
 *   positive/negative/neutral, or by origin — depending on groupMode)
 * - No virtual scroll: simple rendering for <300 family groups
 * - Search and filter controls at the top
 * - Full-width layout (takes entire available width)
 *
 * The parent page is responsible for placing the regex output and control
 * panel ABOVE this component (in a sticky top bar).
 */
import React, { useMemo, useCallback } from 'react';
import type { GameToken, AffixType, ModOrigin, FamilyGroup } from '@shared/types';
import { groupTokensByFamily } from '@shared/family-grouper';
import { ORIGIN_LABELS, AFFIX_LABELS } from '@shared/constants';
import { classifyGroups, type ModGroupMode, type ModSubGroup } from '@shared/mod-classifier';
import { FilterChip } from './FilterChip';

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
}

/** Render a sub-group with its header and flex-wrap chips */
const ModSubGroupSection: React.FC<{
  subGroup: ModSubGroup;
  selectedIds: Set<string>;
  onToggleTokens: (ids: string[]) => void;
}> = ({ subGroup, selectedIds, onToggleTokens }) => (
  <div className="mb-2">
    {subGroup.label && (
      <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${subGroup.colorClass}`}>
        ── {subGroup.label} ({subGroup.groups.length}) ──
      </div>
    )}
    <div className="flex flex-wrap gap-1.5">
      {subGroup.groups.map((group) => (
        <FilterChip
          key={group.familyKey}
          group={group}
          selectedIds={selectedIds}
          onToggleTokens={onToggleTokens}
        />
      ))}
    </div>
  </div>
);

/** A single affix column (prefix or suffix) */
const AffixColumn: React.FC<{
  affix: AffixType;
  subGroups: ModSubGroup[];
  selectedIds: Set<string>;
  onToggleTokens: (ids: string[]) => void;
}> = ({ affix, subGroups, selectedIds, onToggleTokens }) => {
  const totalCount = subGroups.reduce((sum, sg) => sum + sg.groups.length, 0);
  if (totalCount === 0) return null;

  const isPrefix = affix === 'prefix';
  const headerColor = isPrefix ? 'text-blue-400' : 'text-orange-400';
  const borderColor = isPrefix ? 'border-blue-800/50' : 'border-orange-800/50';

  return (
    <div className={`flex flex-col min-w-0 ${totalCount > 0 ? `border-l-2 pl-3 ${borderColor}` : ''}`}>
      <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${headerColor}`}>
        {AFFIX_LABELS[affix]} ({totalCount})
      </h4>
      {subGroups.map((sg) => (
        <ModSubGroupSection
          key={sg.key}
          subGroup={sg}
          selectedIds={selectedIds}
          onToggleTokens={onToggleTokens}
        />
      ))}
    </div>
  );
};

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
}) => {
  // Get unique origins from tokens
  const availableOrigins = useMemo(() => {
    const origins = new Set<ModOrigin>();
    for (const token of tokens) {
      origins.add(token.origin);
    }
    return Array.from(origins).sort();
  }, [tokens]);

  // Filter tokens (BEFORE grouping, per plan: origin filter applied before grouping)
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

  // Group filtered tokens by family
  const familyGroups = useMemo(
    () => groupTokensByFamily(filteredTokens),
    [filteredTokens]
  );

  // Separate groups by affix type
  const prefixGroups = useMemo(
    () => familyGroups.filter((g) => g.affix === 'prefix'),
    [familyGroups]
  );
  const suffixGroups = useMemo(
    () => familyGroups.filter((g) => g.affix === 'suffix'),
    [familyGroups]
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
  // For 'origin' mode, we don't split by affix — we show all groups by origin
  const isOriginMode = groupMode === 'origin';

  return (
    <div className="mod-list flex flex-col gap-3">
      {/* Search + Filters row */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск модов..."
          className="flex-1 min-w-[180px] px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        <select
          value={affixFilter || 'all'}
          onChange={(e) => handleAffixFilter(e.target.value)}
          className="px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">Все типы</option>
          <option value="prefix">{AFFIX_LABELS.prefix}</option>
          <option value="suffix">{AFFIX_LABELS.suffix}</option>
        </select>

        {availableOrigins.length > 1 && (
          <select
            value={originFilter || 'all'}
            onChange={(e) => handleOriginFilter(e.target.value)}
            className="px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">Все источники</option>
            {availableOrigins.map((origin) => (
              <option key={origin} value={origin}>
                {ORIGIN_LABELS[origin] || origin}
              </option>
            ))}
          </select>
        )}

        {selectedIds.size > 0 && (
          <button
            onClick={onClearSelections}
            className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Очистить ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="text-xs text-gray-500">
        Показано {familyGroups.length} семейств из {tokens.length} модов
      </div>

      {/* Mod groups area */}
      {familyGroups.length > 0 ? (
        isOriginMode ? (
          /* Origin mode: single column, sub-grouped by origin */
          <div className="flex flex-col gap-2">
            {classifyGroups(familyGroups, 'origin').map((sg) => (
              <div key={sg.key}>
                <div className={`text-xs font-bold uppercase tracking-wider mb-1.5 ${sg.colorClass}`}>
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
                          <h5 className="text-[10px] font-semibold text-blue-400 uppercase mb-1">Префикс ({originPrefix.length})</h5>
                          <div className="flex flex-wrap gap-1.5">
                            {originPrefix.map(group => (
                              <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} onToggleTokens={onToggleTokens} />
                            ))}
                          </div>
                        </div>
                      )}
                      {originSuffix.length > 0 && (
                        <div className="border-l-2 border-orange-800/50 pl-3">
                          <h5 className="text-[10px] font-semibold text-orange-400 uppercase mb-1">Суффикс ({originSuffix.length})</h5>
                          <div className="flex flex-wrap gap-1.5">
                            {originSuffix.map(group => (
                              <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} onToggleTokens={onToggleTokens} />
                            ))}
                          </div>
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
              selectedIds={selectedIds}
              onToggleTokens={onToggleTokens}
            />
            <AffixColumn
              affix="suffix"
              subGroups={suffixSubGroups}
              selectedIds={selectedIds}
              onToggleTokens={onToggleTokens}
            />
          </div>
        ) : (
          /* Single column (only one affix type after filtering) */
          <div className="flex flex-col gap-2">
            {prefixGroups.length > 0 && (
              <AffixColumn
                affix="prefix"
                subGroups={prefixSubGroups}
                selectedIds={selectedIds}
                onToggleTokens={onToggleTokens}
              />
            )}
            {suffixGroups.length > 0 && (
              <AffixColumn
                affix="suffix"
                subGroups={suffixSubGroups}
                selectedIds={selectedIds}
                onToggleTokens={onToggleTokens}
              />
            )}
          </div>
        )
      ) : (
        <div className="text-center text-gray-500 py-8">
          Моды не найдены
        </div>
      )}
    </div>
  );
};
