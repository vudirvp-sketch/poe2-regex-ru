/**
 * VirtualizedModList — Virtualized two-column mod list for large categories.
 *
 * Uses @tanstack/react-virtual to render only visible sub-groups,
 * significantly reducing DOM nodes for categories with 200+ tokens
 * (belt: 298, ring: 366, amulet: 427, jewel: 235).
 *
 * Layout v5: Two-column layout (Prefix | Suffix) with independent
 * virtualizers per column. Both virtualizers share the same scroll
 * container (<main id="main-content">), so scrolling is natural.
 *
 * When both prefix and suffix exist and no affix filter is applied,
 * columns render side by side in a CSS grid (2fr | 3fr).
 * When an affix filter narrows to one type, or only one affix type
 * exists, a single full-width column is used.
 *
 * Each column's virtualizer uses normal flow positioning (padding-top/
 * padding-bottom spacers). Dynamic row measurement is handled by the
 * `measureElement` ref + ResizeObserver (TanStack Virtual built-in);
 * no manual `virtualizer.measure()` calls are made (iter 120 — see
 * STATUS.md Known Issue #6 for the root-cause analysis of the previous
 * jump-to-top / jitter bugs that manual measure() caused).
 */
import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GameToken, AffixType, ModOrigin, FamilyGroup, PriorityFilter, SortMode } from '@shared/types';
import { groupTokensByFamily, splitGroupByOrigin, countUniqueFamilyKeys } from '@shared/family-grouper';
import { classifyGroups, classifyJewelType, type ModGroupMode, type ModSubGroup, type JewelTypeCategory, JEWEL_TYPE_LABELS } from '@shared/mod-classifier';
import { ORIGIN_SECTION_LABELS } from '@shared/mod-classifier';
import { FilterChip } from './FilterChip';
import { t } from '@shared/i18n';
import type { TokenRangeOverride } from '@store/filter-store';

interface VirtualizedModListProps {
  tokens: GameToken[];
  selectedIds: Set<string>;
  /** Set of excluded ("don't want") token IDs */
  excludedIds?: Set<string>;
  searchText: string;
  affixFilter: AffixType | null;
  originFilter: ModOrigin | null;
  onToggleTokens: (ids: string[]) => void;
  /** Toggle a family group to excluded state */
  onToggleExclude?: (ids: string[]) => void;
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
  /** Item category for priority tier classification (e.g., 'ring', 'belt') */
  category?: string;
  /** Priority tier filter */
  priorityFilter?: PriorityFilter;
  /**
   * Within-block sort mode (iter 106 P4). Defaults to 'alpha' (iter 99 behaviour).
   *  - 'alpha'      : familyKey primary, priorityTier tiebreaker.
   *  - 'tier-first' : priorityTier (S→A→B→C) primary, familyKey tiebreaker.
   * Forwarded to `classifyGroups()` via `buildColumnRows()` → `withSortedGroups()`.
   */
  sortMode?: SortMode;
}

/** A flat virtual row for the virtualizer */
type VirtualRow =
  | { type: 'column-header'; affix: AffixType; count: number }
  | { type: 'origin-header'; origin: ModOrigin; label: string; colorClass: string; bgClass: string; borderClass: string; borderLClass: string; count: number; iconPath?: string }
  | { type: 'jewel-type-header'; jewelType: JewelTypeCategory; label: string; colorClass: string; bgClass: string; borderClass: string; count: number }
  | { type: 'subgroup'; subGroup: ModSubGroup; affix: AffixType };

const ORIGIN_ORDER: ModOrigin[] = ['normal', 'desecrated', 'corrupted', 'essence', 'breachborn'];

/** Order for jewel type sub-headers within origin sections */
const JEWEL_TYPE_ORDER: JewelTypeCategory[] = ['ruby', 'emerald', 'sapphire', 'shared'];

/** Estimated heights for virtualizer (will be dynamically measured).
 *  iter 120: subgroup lowered from 120 → 60 (closer to actual average for
 *  typical 1–3 chip subgroups without range inputs). High estimates caused
 *  jitter during scroll because totalSize shrank when ResizeObserver fired
 *  with actual sizes much smaller than the estimate. */
const ROW_ESTIMATES: Record<VirtualRow['type'], number> = {
  'column-header': 44,
  'origin-header': 36,
  'jewel-type-header': 30,
  'subgroup': 60, // typical 1–3 chips: ~40–80px; selected with range: ~100–120px
};

/**
 * Find the nearest scrollable ancestor element.
 * Walks up the DOM tree from the given element, checking computed overflow.
 */
function findScrollableParent(el: HTMLElement | null): HTMLElement | null {
  let current = el;
  while (current) {
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

/**
 * Build flat row list for a single affix column.
 *
 * iter 106 (P4): `sortMode` forwarded to every `classifyGroups()` call so the
 * UI toggle propagates through origin-split sub-sections and jewel-type
 * sub-sections as well.
 */
function buildColumnRows(
  affix: AffixType,
  groups: FamilyGroup[],
  subGroups: ModSubGroup[],
  groupMode: ModGroupMode,
  showOriginSubSections: boolean,
  showJewelTypeSubGroups: boolean,
  sortMode: SortMode = 'alpha',
): VirtualRow[] {
  const rows: VirtualRow[] = [];
  if (groups.length === 0) return rows;

  // Column header
  rows.push({ type: 'column-header', affix, count: groups.length });

  if (showOriginSubSections) {
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
      const originSubGroups = classifyGroups(originGroups, groupMode, sortMode);
      const sectionCount = originSubGroups.reduce((s, sg) => s + sg.groups.length, 0);

      // Origin section header (skip for normal-only — already implied by column header)
      if (origin !== 'normal' || byOrigin.size > 1) {
        rows.push({
          type: 'origin-header',
          origin,
          label: labelConfig?.label ?? t('origin.' + origin),
          colorClass: labelConfig?.colorClass ?? 'text-muted',
          bgClass: labelConfig?.bgClass ?? '',
          borderClass: labelConfig?.borderClass ?? '',
          borderLClass: labelConfig?.borderLClass ?? '',
          count: sectionCount,
          iconPath: labelConfig?.iconPath,
        });
      }

      if (showJewelTypeSubGroups) {
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

          const jtLabelConfig = JEWEL_TYPE_LABELS[jewelType];
          rows.push({
            type: 'jewel-type-header',
            jewelType,
            label: jtLabelConfig.label,
            colorClass: jtLabelConfig.colorClass,
            bgClass: jtLabelConfig.bgClass,
            borderClass: jtLabelConfig.borderClass,
            count: jtGroups.length,
          });

          const jtSubGroups = classifyGroups(jtGroups, groupMode, sortMode);
          for (const sg of jtSubGroups) {
            rows.push({ type: 'subgroup', subGroup: sg, affix });
          }
        }
      } else {
        for (const sg of originSubGroups) {
          rows.push({ type: 'subgroup', subGroup: sg, affix });
        }
      }
    }
  } else {
    for (const sg of subGroups) {
      rows.push({ type: 'subgroup', subGroup: sg, affix });
    }
  }

  return rows;
}

/**
 * Render a single virtual row's content (without positioning wrapper).
 * iter 107: `sortMode` forwarded to FilterChip for tier-aware left border.
 */
const VirtualRowContent: React.FC<{
  row: VirtualRow;
  selectedIds: Set<string>;
  excludedIds?: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  onToggleExclude?: (ids: string[]) => void;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  collapsedTokenIds?: Set<string>;
  /** iter 107: forwarded to FilterChip for tier-aware left border. */
  sortMode?: SortMode;
}> = React.memo(({ row, selectedIds, excludedIds, onToggleTokens, onToggleExclude, perTokenRanges, onSetTokenRange, onClearTokenRange, collapsedTokenIds, sortMode }) => {
  if (row.type === 'column-header') {
    const isImplicit = row.affix === 'implicit';
    const headerClass = isImplicit
      ? 'affix-header-implicit text-accent-amber'
      : row.affix === 'prefix'
        ? 'affix-header-prefix text-accent-blue'
        : 'affix-header-suffix text-accent-orange';
    return (
      <div className={`text-base font-bold uppercase tracking-wider ${headerClass}`}>
        {isImplicit ? 'ИМПЛИСЕТ' : t('affix.' + row.affix)} ({row.count})
      </div>
    );
  }

  if (row.type === 'origin-header') {
    return (
      <div className={`block ml-2 mt-4 mb-2 text-[14px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border-l-2 ${row.bgClass} ${row.borderClass} ${row.borderLClass} ${row.colorClass} flex items-center gap-1.5`}>
        {row.iconPath && (
          <img
            src={`${import.meta.env.BASE_URL}${row.iconPath}`}
            alt=""
            width={17}
            height={17}
            className="shrink-0 object-contain"
          />
        )}
        <span>{row.label} ({row.count})</span>
      </div>
    );
  }

  if (row.type === 'jewel-type-header') {
    return (
      <div className={`block ml-4 mb-1.5 text-[12px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded ${row.bgClass} border ${row.borderClass} ${row.colorClass}`}>
        {row.label} ({row.count})
      </div>
    );
  }

  // subgroup
  return (
    <div className="mb-2">
      {row.subGroup.label && (
        <div className={`block ml-4 mb-1 text-[12px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded ${row.subGroup.bgClass} border ${row.subGroup.borderClass} ${row.subGroup.colorClass}`}>
          {row.subGroup.label} ({row.subGroup.groups.length})
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {row.subGroup.groups.map((group) => (
          <FilterChip
            key={group.familyKey}
            group={group}
            selectedIds={selectedIds}
            excludedIds={excludedIds}
            onToggleTokens={onToggleTokens}
            onToggleExclude={onToggleExclude}
            perTokenRanges={perTokenRanges}
            onSetTokenRange={onSetTokenRange}
            onClearTokenRange={onClearTokenRange}
            collapsedTokenIds={collapsedTokenIds}
            sortMode={sortMode}
          />
        ))}
      </div>
    </div>
  );
});

VirtualRowContent.displayName = 'VirtualRowContent';

/** Props shared by VirtualizedColumn */
interface VirtualizedColumnProps {
  rows: VirtualRow[];
  scrollElement: HTMLElement | null;
  selectedIds: Set<string>;
  excludedIds?: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  onToggleExclude?: (ids: string[]) => void;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  collapsedTokenIds?: Set<string>;
  /** Border color class for left border (affix-specific) */
  borderClass: string;
  /** iter 107: forwarded to FilterChip via VirtualRowContent for tier-aware border. */
  sortMode?: SortMode;
}

/** A single virtualized column (prefix or suffix) */
const VirtualizedColumn: React.FC<VirtualizedColumnProps> = ({
  rows,
  scrollElement,
  selectedIds,
  excludedIds,
  onToggleTokens,
  onToggleExclude,
  perTokenRanges,
  onSetTokenRange,
  onClearTokenRange,
  collapsedTokenIds,
  borderClass,
  sortMode,
}) => {
  // TanStack Virtual's useVirtualizer returns non-memoizable functions
  // (getVirtualItems, scrollToIndex, etc.) which React Compiler cannot safely
  // memoize. This is a known library-level limitation, not our code — see
  // STATUS.md Known Issue #3 (closed iter 103).
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      const row = rows[index];
      if (!row) return 40;
      return ROW_ESTIMATES[row.type];
    },
    overscan: 10,
  });

  // iter 120: removed the entire useLayoutEffect block that called
  // virtualizer.measure() + restore() on every selection/range change.
  // That code was the cause of the "jump to top" bug on the jewel page and
  // jitter during scroll on several tabs. `measure()` invalidated the ENTIRE
  // measurement cache, so all rows reverted to estimate sizes (120px for
  // subgroup vs actual 40–80px) → paddingTop/paddingBottom drifted → visible
  // items shifted → scroll position effectively jumped.
  //
  // The correct behaviour is now achieved by relying on `measureElement` ref
  // + ResizeObserver for dynamic row measurement (TanStack Virtual built-in).
  // The browser itself preserves `scrollTop` when content above the viewport
  // doesn't change — no manual restore needed.
  //
  // See STATUS.md Known Issue #6 for full root-cause analysis.

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  let paddingTop = 0;
  let paddingBottom = 0;

  if (virtualItems.length > 0) {
    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];
    paddingTop = firstItem.start;
    paddingBottom = totalSize - lastItem.end;
  }

  if (rows.length === 0) return null;

  return (
    <div className={`flex flex-col min-w-0 border-l-2 pl-3 ${borderClass}`}>
      <div style={{ width: '100%' }}>
        {paddingTop > 0 && (
          <div style={{ height: paddingTop }} aria-hidden="true" />
        )}

        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index];
          if (!row) return null;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
            >
              <VirtualRowContent
                row={row}
                selectedIds={selectedIds}
                excludedIds={excludedIds}
                onToggleTokens={onToggleTokens}
                onToggleExclude={onToggleExclude}
                perTokenRanges={perTokenRanges}
                onSetTokenRange={onSetTokenRange}
                onClearTokenRange={onClearTokenRange}
                collapsedTokenIds={collapsedTokenIds}
                sortMode={sortMode}
              />
            </div>
          );
        })}

        {paddingBottom > 0 && (
          <div style={{ height: paddingBottom }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

export const VirtualizedModList: React.FC<VirtualizedModListProps> = ({
  tokens,
  selectedIds,
  excludedIds,
  searchText,
  affixFilter,
  originFilter,
  onToggleTokens,
  onToggleExclude,
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
  category,
  priorityFilter = 'all',
  sortMode = 'alpha',
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

  // Group and classify (with category for priority tier)
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

  const implicitGroups = useMemo(
    () => priorityFilteredGroups.filter((g) => g.affix === 'implicit'),
    [priorityFilteredGroups]
  );
  const prefixGroups = useMemo(
    () => priorityFilteredGroups.filter((g) => g.affix === 'prefix'),
    [priorityFilteredGroups]
  );
  const suffixGroups = useMemo(
    () => priorityFilteredGroups.filter((g) => g.affix === 'suffix'),
    [priorityFilteredGroups]
  );

  const implicitSubGroups = useMemo(
    () => classifyGroups(implicitGroups, groupMode, sortMode),
    [implicitGroups, groupMode, sortMode]
  );
  const prefixSubGroups = useMemo(
    () => classifyGroups(prefixGroups, groupMode, sortMode),
    [prefixGroups, groupMode, sortMode]
  );
  const suffixSubGroups = useMemo(
    () => classifyGroups(suffixGroups, groupMode, sortMode),
    [suffixGroups, groupMode, sortMode]
  );

  // Build separate row lists for each column
  // iter 106 (P4): sortMode forwarded so the UI toggle propagates to all sub-groups.
  const implicitRows = useMemo(
    () => buildColumnRows('implicit', implicitGroups, implicitSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode),
    [implicitGroups, implicitSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode]
  );
  const prefixRows = useMemo(
    () => buildColumnRows('prefix', prefixGroups, prefixSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode),
    [prefixGroups, prefixSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode]
  );
  const suffixRows = useMemo(
    () => buildColumnRows('suffix', suffixGroups, suffixSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode),
    [suffixGroups, suffixSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode]
  );

  const hasImplicit = implicitGroups.length > 0;
  // Determine layout: two columns when both affixes exist and no affix filter
  const hasBothAffixes = prefixRows.length > 0 && suffixRows.length > 0 && !affixFilter;

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

  // For single-column mode (affix filter applied or only one affix type),
  // merge all row lists and use a single virtualizer
  const mergedRows = useMemo(() => {
    if (hasBothAffixes) return []; // not used in two-column mode
    // When affixFilter is null (all types shown), include implicit at the top
    if (!affixFilter && hasImplicit) {
      return [...implicitRows, ...prefixRows, ...suffixRows];
    }
    return [...prefixRows, ...suffixRows];
  }, [hasBothAffixes, implicitRows, prefixRows, suffixRows, affixFilter, hasImplicit]);

  // Single-column virtualizer for when affix filter is applied
  // (Same TanStack library limitation as above — see STATUS.md Known Issue #3.)
  // eslint-disable-next-line react-hooks/incompatible-library
  const singleVirtualizer = useVirtualizer({
    count: mergedRows.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      const row = mergedRows[index];
      if (!row) return 40;
      return ROW_ESTIMATES[row.type];
    },
    overscan: 10,
  });

  // iter 120: removed the single-column useLayoutEffect block (same as
  // two-column) — see STATUS.md Known Issue #6 for root cause.
  // `measureElement` ref + ResizeObserver handle dynamic measurement; browser
  // preserves scrollTop when content above viewport is unchanged.

  const singleVirtualItems = singleVirtualizer.getVirtualItems();
  const singleTotalSize = singleVirtualizer.getTotalSize();

  let singlePaddingTop = 0;
  let singlePaddingBottom = 0;
  if (singleVirtualItems.length > 0) {
    const firstItem = singleVirtualItems[0];
    const lastItem = singleVirtualItems[singleVirtualItems.length - 1];
    singlePaddingTop = firstItem.start;
    singlePaddingBottom = singleTotalSize - lastItem.end;
  }

  const columnProps = {
    scrollElement,
    selectedIds,
    excludedIds,
    onToggleTokens,
    onToggleExclude,
    perTokenRanges,
    onSetTokenRange,
    onClearTokenRange,
    collapsedTokenIds,
    // iter 107: forwarded to FilterChip via VirtualRowContent for tier-aware border.
    sortMode,
  };

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
          className="flex-1 min-w-[180px] px-3 py-2 bg-surface border border-edge rounded text-[15px] text-bright placeholder-ghost focus:outline-none focus:border-accent-amber"
        />

        <select
          value={affixFilter || 'all'}
          onChange={(e) => handleAffixFilter(e.target.value)}
          aria-label={t('filter.all_types')}
          className="px-2.5 py-1.5 bg-surface border border-edge rounded text-[13px] text-bright focus:outline-none focus:border-accent-amber"
        >
          <option value="all">{t('filter.all_types')}</option>
          <option value="prefix">{t('affix.prefix')}</option>
          <option value="suffix">{t('affix.suffix')}</option>
          {hasImplicit && <option value="implicit">{t('affix.implicit')}</option>}
        </select>

        {availableOrigins.length > 1 && (
          <select
            value={originFilter || 'all'}
            onChange={(e) => handleOriginFilter(e.target.value)}
            aria-label={t('filter.all_origins')}
            className="px-2.5 py-1.5 bg-surface border border-edge rounded text-[13px] text-bright focus:outline-none focus:border-accent-amber"
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
            className="px-2.5 py-1.5 bg-raised border border-edge rounded text-[13px] text-soft hover:bg-chip-hover transition-colors"
          >
            {t('filter.clear')} ({countUniqueFamilyKeys(tokens.filter(t => selectedIds.has(t.id)))})
          </button>
        )}
      </div>

      {/* Stats — iter 70: text-dim → text-muted for better contrast */}
      <div className="text-[13px] text-muted">
        {t('filter.stats').replace('{shown}', String(priorityFilteredGroups.length)).replace('{total}', String(tokens.length))}
      </div>

      {/* Implicit section: always full width, above prefix/suffix */}
      {hasImplicit && affixFilter !== 'prefix' && affixFilter !== 'suffix' && implicitRows.length > 0 && (
        <VirtualizedColumn
          rows={implicitRows}
          borderClass="border-cborder-amber"
          {...columnProps}
        />
      )}

      {/* Two-column layout (Prefix | Suffix) */}
      {hasBothAffixes ? (
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-4">
          <VirtualizedColumn
            rows={prefixRows}
            borderClass="border-cborder-blue"
            {...columnProps}
          />
          <VirtualizedColumn
            rows={suffixRows}
            borderClass="border-cborder-orange"
            {...columnProps}
          />
        </div>
      ) : mergedRows.length > 0 ? (
        /* Single-column layout (affix filter applied or only one type) */
        <div style={{ width: '100%' }}>
          {singlePaddingTop > 0 && (
            <div style={{ height: singlePaddingTop }} aria-hidden="true" />
          )}

          {singleVirtualItems.map((virtualItem) => {
            const row = mergedRows[virtualItem.index];
            if (!row) return null;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={singleVirtualizer.measureElement}
              >
                <VirtualRowContent
                  row={row}
                  selectedIds={selectedIds}
                  excludedIds={excludedIds}
                  onToggleTokens={onToggleTokens}
                  onToggleExclude={onToggleExclude}
                  perTokenRanges={perTokenRanges}
                  onSetTokenRange={onSetTokenRange}
                  onClearTokenRange={onClearTokenRange}
                  collapsedTokenIds={collapsedTokenIds}
                  sortMode={sortMode}
                />
              </div>
            );
          })}

          {singlePaddingBottom > 0 && (
            <div style={{ height: singlePaddingBottom }} aria-hidden="true" />
          )}
        </div>
      ) : (
        <div className="text-center text-dim py-8">
          {t('filter.no_results')}
        </div>
      )}
    </div>
  );
};
