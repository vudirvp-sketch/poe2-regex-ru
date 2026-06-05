/**
 * ModList — A filterable, selectable list of mods for a category.
 *
 * Displays mods grouped by affix type (prefix/suffix) with
 * search filtering and origin filtering.
 */
import React, { useMemo, useCallback } from 'react';
import type { GameToken, AffixType, ModOrigin } from '@shared/types';
import { FilterChip } from './FilterChip';
import { ORIGIN_LABELS, AFFIX_LABELS } from '@shared/constants';

interface ModListProps {
  tokens: GameToken[];
  selectedIds: Set<string>;
  searchText: string;
  affixFilter: AffixType | null;
  originFilter: ModOrigin | null;
  onToggleToken: (id: string) => void;
  onSearchChange: (text: string) => void;
  onAffixFilterChange: (filter: AffixType | null) => void;
  onOriginFilterChange: (filter: ModOrigin | null) => void;
  onClearSelections: () => void;
}

export const ModList: React.FC<ModListProps> = ({
  tokens,
  selectedIds,
  searchText,
  affixFilter,
  originFilter,
  onToggleToken,
  onSearchChange,
  onAffixFilterChange,
  onOriginFilterChange,
  onClearSelections,
}) => {
  // Get unique origins from tokens
  const availableOrigins = useMemo(() => {
    const origins = new Set<ModOrigin>();
    for (const token of tokens) {
      origins.add(token.origin);
    }
    return Array.from(origins).sort();
  }, [tokens]);

  // Filter tokens
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

  // Group by affix type
  const prefixTokens = useMemo(
    () => filteredTokens.filter((t) => t.affix === 'prefix'),
    [filteredTokens]
  );
  const suffixTokens = useMemo(
    () => filteredTokens.filter((t) => t.affix === 'suffix'),
    [filteredTokens]
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

  return (
    <div className="mod-list">
      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск модов..."
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {/* Affix filter */}
        <select
          value={affixFilter || 'all'}
          onChange={(e) => handleAffixFilter(e.target.value)}
          className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">Все типы</option>
          <option value="prefix">{AFFIX_LABELS.prefix}</option>
          <option value="suffix">{AFFIX_LABELS.suffix}</option>
        </select>

        {/* Origin filter */}
        {availableOrigins.length > 1 && (
          <select
            value={originFilter || 'all'}
            onChange={(e) => handleOriginFilter(e.target.value)}
            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">Все источники</option>
            {availableOrigins.map((origin) => (
              <option key={origin} value={origin}>
                {ORIGIN_LABELS[origin] || origin}
              </option>
            ))}
          </select>
        )}

        {/* Clear selections */}
        {selectedIds.size > 0 && (
          <button
            onClick={onClearSelections}
            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-600"
          >
            Очистить ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="text-xs text-gray-500 mb-2">
        Показано {filteredTokens.length} из {tokens.length} модов
      </div>

      {/* Prefix group */}
      {prefixTokens.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider">
            {AFFIX_LABELS.prefix} ({prefixTokens.length})
          </h4>
          <div className="grid grid-cols-1 gap-1">
            {prefixTokens.map((token) => (
              <FilterChip
                key={token.id}
                token={token}
                isSelected={selectedIds.has(token.id)}
                onToggle={onToggleToken}
              />
            ))}
          </div>
        </div>
      )}

      {/* Suffix group */}
      {suffixTokens.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-orange-400 mb-2 uppercase tracking-wider">
            {AFFIX_LABELS.suffix} ({suffixTokens.length})
          </h4>
          <div className="grid grid-cols-1 gap-1">
            {suffixTokens.map((token) => (
              <FilterChip
                key={token.id}
                token={token}
                isSelected={selectedIds.has(token.id)}
                onToggle={onToggleToken}
              />
            ))}
          </div>
        </div>
      )}

      {filteredTokens.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          Моды не найдены
        </div>
      )}
    </div>
  );
};
