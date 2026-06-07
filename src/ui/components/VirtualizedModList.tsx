/**
 * VirtualizedModList — Virtualized version of ModList for large categories.
 *
 * Uses @tanstack/react-virtual to render only visible sub-groups,
 * significantly reducing DOM nodes for categories with 200+ tokens
 * (belt: 298, ring: 366, amulet: 427, jewel: 235).
 *
 * Strategy: flatten the hierarchical structure (column → origin section →
 * jewel-type sub-group → sub-group) into a flat list of "virtual rows".
 * Each row is either:
 * - A column header (ПРЕФИКС / СУФФИКС)
 * - An origin section header (··· Осквернённые ···)
 * - A jewel type sub-header (── Рубин ── / ── Сапфир ──)
 * - A sub-group with its header and flex-wrap chips
 *
 * The virtualizer uses the <main> scroll container (id="main-content"),
 * so the page scrolls naturally without nested scroll containers.
 */
import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GameToken, AffixType, ModOrigin, FamilyGroup } from '@shared/types';
import { groupTokensByFamily, splitGroupByOrigin, countUniqueFamilyKeys } from '@shared/family-grouper';
import { classifyGroups, classifyJewelType, type ModGroupMode, type ModSubGroup, type JewelTypeCategory, JEWEL_TYPE_LABELS } from '@shared/mod-classifier';
import { ORIGIN_SECTION_LABELS } from '@shared/mod-classifier';
import { FilterChip } from './FilterChip';
import { t } from '@shared/i18n';
import type { TokenRangeOverride } from '@store/filter-store';

interface VirtualizedModListProps {
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
  groupMode?: ModGroupMode;
  showOriginSubSections?: boolean;
  /** Show jewel type sub-headers (Рубин/Изумруд/Сапфир/Общие) inside origin sections */
  showJewelTypeSubGroups?: boolean;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  /** Set of token IDs whose individual regex was collapsed by the optimizer */
  collapsedTokenIds?: Set<string>;
}

/** A flat virtual row for the virtualizer */
type VirtualRow =
  | { type: 'column-header'; affix: AffixType; count: number }
  | { type: 'origin-header'; origin: ModOrigin; label: string; colorClass: string; count: number }
  | { type: 'jewel-type-header'; jewelType: JewelTypeCategory; label: string; colorClass: string; count: number }
  | { type: 'subgroup'; subGroup: ModSubGroup; affix: AffixType };

const ORIGIN_ORDER: ModOrigin[] = ['normal', 'desecrated', 'corrupted', 'essence', 'breachborn'];

/** Order for jewel type sub-headers within origin sections */
const JEWEL_TYPE_ORDER: JewelTypeCategory[] = ['ruby', 'emerald', 'sapphire', 'shared'];

/** Estimated heights for virtualizer (will be dynamically measured) */
const ROW_ESTIMATES: Record<VirtualRow['type'], number> = {
  'column-header': 36,
  'origin-header': 28,
  'jewel-type-header': 26,
  'subgroup': 100, // varies by chip count; estimated high to reduce jump
};

/**
 * Find the nearest scrollable ancestor element.
 * Walks up the DOM tree from the given element, checking computed overflow.
 */
function findScrollableParent(el: HTMLElement | null): HTMLElement | null {
  let current = el;
  while (current) {
    // Check for <main id="main-content"> first — known scroll container
    if (current.id === 'main-content') return current;
    const style = getComputedStyle(current);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export const VirtualizedModList: React.FC<VirtualizedModListProps> = ({
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
  perTokenRanges,
  onSetTokenRange,
  onClearTokenRange,
  collapsedTokenIds,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve the scroll element after mount
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setScrollElement(findScrollableParent(containerRef.current));
  }, []);

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

  // Group and classify
  const familyGroups = useMemo(
    () => groupTokensByFamily(filteredTokens),
    [filteredTokens]
  );

  const prefixGroups = useMemo(
    () => familyGroups.filter((g) => g.affix === 'prefix'),
    [familyGroups]
  );
  const suffixGroups = useMemo(
    () => familyGroups.filter((g) => g.affix === 'suffix'),
    [familyGroups]
  );

  const prefixSubGroups = useMemo(
    () => classifyGroups(prefixGroups, groupMode),
    [prefixGroups, groupMode]
  );
  const suffixSubGroups = useMemo(
    () => classifyGroups(suffixGroups, groupMode),
    [suffixGroups, groupMode]
  );

  // Build flat row list
  const virtualRows = useMemo(() => {
    const rows: VirtualRow[] = [];

    const addColumn = (affix: AffixType, groups: FamilyGroup[], subGroups: ModSubGroup[]) => {
      if (groups.length === 0) return;

      // Column header
      rows.push({ type: 'column-header', affix, count: groups.length });

      if (showOriginSubSections) {
        // Group by origin first
        const byOrigin = new Map<ModOrigin, FamilyGroup[]>();
        for (const group of groups) {
          const splits = splitGroupByOrigin(group);
          for (const { origin, group: splitGroup } of splits) {
            const list = byOrigin.get(origin) || [];
            list.push(splitGroup);
            byOrigin.set(origin, list);
          }
        }

        for (const origin of ORIGIN_ORDER) {
          const originGroups = byOrigin.get(origin);
          if (!originGroups || originGroups.length === 0) continue;

          const labelConfig = ORIGIN_SECTION_LABELS[origin];
          const originSubGroups = classifyGroups(originGroups, groupMode);
          const sectionCount = originSubGroups.reduce((s, sg) => s + sg.groups.length, 0);

          // Origin section header (skip for normal-only — already implied by column header)
          if (origin !== 'normal' || byOrigin.size > 1) {
            rows.push({
              type: 'origin-header',
              origin,
              label: labelConfig?.label ?? t('origin.' + origin),
              colorClass: labelConfig?.colorClass ?? 'text-gray-400',
              count: sectionCount,
            });
          }

          // Jewel type sub-groups within origin section
          if (showJewelTypeSubGroups) {
            // Classify origin groups by jewel type
            const byJewelType = new Map<JewelTypeCategory, FamilyGroup[]>();
            for (const group of originGroups) {
              const jewelType = classifyJewelType(group);
              const list = byJewelType.get(jewelType) || [];
              list.push(group);
              byJewelType.set(jewelType, list);
            }

            for (const jewelType of JEWEL_TYPE_ORDER) {
              const jtGroups = byJewelType.get(jewelType);
              if (!jtGroups || jtGroups.length === 0) continue;

              const labelConfig = JEWEL_TYPE_LABELS[jewelType];

              // Jewel type sub-header
              rows.push({
                type: 'jewel-type-header',
                jewelType,
                label: labelConfig.label,
                colorClass: labelConfig.colorClass,
                count: jtGroups.length,
              });

              // Sub-groups within this jewel type
              const jtSubGroups = classifyGroups(jtGroups, groupMode);
              for (const sg of jtSubGroups) {
                rows.push({ type: 'subgroup', subGroup: sg, affix });
              }
            }
          } else {
            // No jewel type sub-headers: just sub-groups within origin
            for (const sg of originSubGroups) {
              rows.push({ type: 'subgroup', subGroup: sg, affix });
            }
          }
        }
      } else {
        // No origin sub-sections: just sub-groups
        for (const sg of subGroups) {
          rows.push({ type: 'subgroup', subGroup: sg, affix });
        }
      }
    };

    addColumn('prefix', prefixGroups, prefixSubGroups);
    addColumn('suffix', suffixGroups, suffixSubGroups);

    return rows;
  }, [prefixGroups, suffixGroups, prefixSubGroups, suffixSubGroups, showOriginSubSections, showJewelTypeSubGroups, groupMode]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (!row) return 40;
      return ROW_ESTIMATES[row.type];
    },
    overscan: 8,
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
    <div className="virtualized-mod-list flex flex-col gap-3" role="group" aria-label={t('search.placeholder')} ref={containerRef}>
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
        {t('filter.stats').replace('{shown}', String(familyGroups.length)).replace('{total}', String(tokens.length))}
      </div>

      {/* Virtualized list */}
      {virtualRows.length > 0 ? (
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

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {row.type === 'column-header' && (
                  <div className={`text-xs font-bold uppercase tracking-wider mb-2 mt-2 ${
                    row.affix === 'prefix' ? 'text-blue-400 border-l-2 border-blue-800/50 pl-3' : 'text-orange-400 border-l-2 border-orange-800/50 pl-3'
                  }`}>
                    {t('affix.' + row.affix)} ({row.count})
                  </div>
                )}

                {row.type === 'origin-header' && (
                  <div className={`text-[9px] font-semibold uppercase tracking-wider mb-1 mt-2 ${row.colorClass} opacity-80`}>
                    ··· {row.label} ({row.count}) ···
                  </div>
                )}

                {row.type === 'jewel-type-header' && (
                  <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 mt-1.5 ${row.colorClass}`}>
                    ── {row.label} ({row.count}) ──
                  </div>
                )}

                {row.type === 'subgroup' && (
                  <div className="mb-2">
                    {row.subGroup.label && (
                      <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${row.subGroup.colorClass}`}>
                        ── {row.subGroup.label} ({row.subGroup.groups.length}) ──
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {row.subGroup.groups.map((group) => (
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
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          {t('filter.no_results')}
        </div>
      )}
    </div>
  );
};
