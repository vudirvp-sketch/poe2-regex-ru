/**
 * ModList — A filterable, selectable list of mods for a category.
 *
 * Displays mods grouped by affix type (prefix/suffix) with
 * search filtering and origin filtering.
 *
 * Uses Family Pooling: tokens with the same familyKey + affix are grouped
 * into a single chip showing the combined range (e.g., "+(5—33) к силе"
 * instead of 9 separate chips for each tier).
 *
 * Uses @tanstack/react-virtual for virtualized rendering of large
 * token lists, rendering only visible items in the DOM for smooth scrolling.
 */
import React, { useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GameToken, AffixType, ModOrigin, FamilyGroup } from '@shared/types';
import { groupTokensByFamily } from '@shared/family-grouper';
import { FilterChip } from './FilterChip';
import { ORIGIN_LABELS, AFFIX_LABELS } from '@shared/constants';

/** Estimated row height: ~40px for simple chips, ~56px with ranges */
const ESTIMATED_ROW_HEIGHT = 44;
/** Group header height */
const GROUP_HEADER_HEIGHT = 32;

interface ModListProps {
  tokens: GameToken[];
  selectedIds: Set<string>;
  searchText: string;
  affixFilter: AffixType | null;
  originFilter: ModOrigin | null;
  onToggleToken: (id: string) => void;
  onToggleTokens: (ids: string[]) => void;
  onSearchChange: (text: string) => void;
  onAffixFilterChange: (filter: AffixType | null) => void;
  onOriginFilterChange: (filter: ModOrigin | null) => void;
  onClearSelections: () => void;
}

/** A virtual row — either a group header or a family group item */
type VirtualRow =
  | { type: 'header'; affix: AffixType; count: number }
  | { type: 'family'; group: FamilyGroup };

export const ModList: React.FC<ModListProps> = ({
  tokens,
  selectedIds,
  searchText,
  affixFilter,
  originFilter,
  onToggleToken: _onToggleToken,
  onToggleTokens,
  onSearchChange,
  onAffixFilterChange,
  onOriginFilterChange,
  onClearSelections,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Build flat virtual rows: headers + family groups interleaved
  const virtualRows = useMemo(() => {
    const rows: VirtualRow[] = [];

    if (prefixGroups.length > 0) {
      rows.push({ type: 'header', affix: 'prefix', count: prefixGroups.length });
      for (const group of prefixGroups) {
        rows.push({ type: 'family', group });
      }
    }

    if (suffixGroups.length > 0) {
      rows.push({ type: 'header', affix: 'suffix', count: suffixGroups.length });
      for (const group of suffixGroups) {
        rows.push({ type: 'family', group });
      }
    }

    return rows;
  }, [prefixGroups, suffixGroups]);

  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (!row) return ESTIMATED_ROW_HEIGHT;
      return row.type === 'header' ? GROUP_HEADER_HEIGHT : ESTIMATED_ROW_HEIGHT;
    },
    overscan: 10,
  });

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
    <div className="mod-list flex flex-col">
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
        Показано {familyGroups.length} семейств из {tokens.length} модов
      </div>

      {/* Virtualized list area */}
      {virtualRows.length > 0 ? (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 280px)', minHeight: 200 }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const row = virtualRows[virtualItem.index];
              if (!row) return null;

              if (row.type === 'header') {
                const isPrefix = row.affix === 'prefix';
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <h4 className={`text-xs font-semibold mb-2 uppercase tracking-wider ${
                      isPrefix ? 'text-blue-400' : 'text-orange-400'
                    }`}>
                      {AFFIX_LABELS[row.affix]} ({row.count})
                    </h4>
                  </div>
                );
              }

              // Family group row
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <FilterChip
                    group={row.group}
                    selectedIds={selectedIds}
                    onToggleTokens={onToggleTokens}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          Моды не найдены
        </div>
      )}
    </div>
  );
};
