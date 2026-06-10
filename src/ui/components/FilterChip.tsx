/**
 * FilterChip — A compact toggleable chip for selecting/deselecting a family group of mods.
 *
 * Redesigned for flex-wrap layout: inline-flex, compact single-line display,
 * with range info and tier count as inline badges.
 *
 * Per-mod numeric filter:
 * - When a ranged group is selected (full or partial), min/max input fields appear
 *   allowing the user to set per-group numeric thresholds.
 * - These override the global minValue/maxValue for this specific group's tokens.
 * - For dual-number mods (hasMultiPlaceholder), TWO rows of min/max inputs appear:
 *   slot 0 (1е) and slot 1 (2е), each filtering its own placeholder independently.
 *   The generated regex ANDs both RANGE nodes together.
 *
 * Selection states:
 * - Full: all member tokens are selected (highlighted)
 * - Partial: some member tokens are selected (dimmed highlight)
 * - None: no member tokens are selected
 *
 * ARIA structure: The numeric <input> elements are SIBLINGS of the role="switch"
 * element, not children. This avoids invalid ARIA tree where an interactive input
 * is nested inside a switch role. The outer div acts as a visual container only.
 * Same pattern as VendorChip.
 */
import React, { useMemo, useCallback } from 'react';
import type { FamilyGroup } from '@shared/types';
import { t } from '@shared/i18n';
import type { TokenRangeOverride, SlotRangeOverride } from '@store/filter-store';

interface FilterChipProps {
  group: FamilyGroup;
  selectedIds: Set<string>;
  /** Set of excluded (\"don't want\") token IDs — per-mod exclude */
  excludedIds?: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  /** Toggle a family group to excluded state */
  onToggleExclude?: (ids: string[]) => void;
  /** Per-token numeric range overrides from filter store */
  perTokenRanges?: Record<string, TokenRangeOverride>;
  /** Set per-token numeric range override */
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  /** Clear per-token numeric range override */
  onClearTokenRange?: (tokenId: string) => void;
  /** Set of token IDs whose individual regex was collapsed by the optimizer.
   *  When any member of this chip's group is in this set, show a visual indicator. */
  collapsedTokenIds?: Set<string>;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  group,
  selectedIds,
  excludedIds,
  onToggleTokens,
  onToggleExclude,
  perTokenRanges,
  onSetTokenRange,
  onClearTokenRange,
  collapsedTokenIds,
}) => {
  const memberIds = useMemo(
    () => group.members.map((m) => m.id),
    [group.members]
  );

  // Determine selection state: want / exclude / none
  const selectionState = useMemo(() => {
    const effectiveExcluded = excludedIds ?? new Set<string>();
    let selectedCount = 0;
    let excludedCount = 0;
    for (const id of memberIds) {
      if (selectedIds.has(id)) selectedCount++;
      if (effectiveExcluded.has(id)) excludedCount++;
    }
    if (selectedCount === memberIds.length) return 'full' as const;
    if (selectedCount > 0) return 'partial' as const;
    if (excludedCount === memberIds.length) return 'excluded' as const;
    if (excludedCount > 0) return 'partial-excluded' as const;
    return 'none' as const;
  }, [memberIds, selectedIds, excludedIds]);

  // Display text: show full text for flex-wrap (no truncation — chip wraps)
  const displayText = group.displayText;

  // Tooltip: show all member raw texts + regex
  const tooltip = useMemo(() => {
    const lines = group.members.map((m) => m.rawText.ru);
    lines.push(`Regex: ${group.members[0]?.regex.ru ?? ''}`);
    return lines.join('\n');
  }, [group.members]);

  // Tier count badge (show only for groups with > 1 member)
  const tierCount = group.members.length;

  // Affix color for left border
  const affixColor = group.affix === 'prefix' ? 'border-l-blue-500' : group.affix === 'implicit' ? 'border-l-amber-500' : 'border-l-orange-500';

  // Priority tier visual differentiation:
  // S-tier: brighter border accent (amber/gold tint)
  // C-tier: dimmer/muted appearance
  // A/B: default
  const tierBorderClass = group.priorityTier === 'S'
    ? 'border-l-amber-400'
    : group.priorityTier === 'A'
      ? affixColor
      : ''; // B and C use default affixColor

  const effectiveBorderClass = tierBorderClass || affixColor;

  const handleClick = () => {
    onToggleTokens(memberIds);
  };

  // Whether this group has ranged tokens (supports per-chip min/max)
  const hasRanges = group.rangeSlots.length > 0;

  // Whether this group has a prefix that will be used for numeric regex anchoring
  const prefix = useMemo(() => {
    const firstMember = group.members[0];
    return firstMember?.regexPrefix?.ru ?? '';
  }, [group.members]);

  const hasPrefix = prefix.length > 0;
  const isSelected = selectionState === 'full' || selectionState === 'partial';
  const isExcluded = selectionState === 'excluded' || selectionState === 'partial-excluded';

  // Check if any member token was collapsed by the optimizer
  const isCollapsed = useMemo(() => {
    if (!collapsedTokenIds || collapsedTokenIds.size === 0) return false;
    return memberIds.some(id => collapsedTokenIds.has(id));
  }, [memberIds, collapsedTokenIds]);

  // Get the first ranged member's current per-token range (for display in inputs)
  // All members in a family group share the same range slot structure,
  // so we use the first member's override as representative for the group.
  // Must match hasRanges condition: rangeSlots is built from both ranges (##) and values (#).
  const firstRangedMember = useMemo(() => {
    return group.members.find(m => m.ranges.length > 0 || m.values.length > 0);
  }, [group.members]);

  // Get effective per-group range from perTokenRanges
  const groupRange = useMemo<TokenRangeOverride>(() => {
    if (!firstRangedMember || !perTokenRanges) return {};
    return perTokenRanges[firstRangedMember.id] ?? {};
  }, [firstRangedMember, perTokenRanges]);

  // Current filterSlotIndex for this group (from perTokenRanges or default 0)
  const currentSlotIndex = groupRange.filterSlotIndex ?? 0;

  // Slot-specific range values for display
  const slot0Range = useMemo<{ min: string; max: string }>(() => {
    if (groupRange.slotOverrides?.[0]) {
      return {
        min: groupRange.slotOverrides[0].min?.toString() ?? '',
        max: groupRange.slotOverrides[0].max?.toString() ?? '',
      };
    }
    // Fallback: if currentSlotIndex === 0, use top-level min/max
    if (currentSlotIndex === 0) {
      return {
        min: groupRange.min?.toString() ?? '',
        max: groupRange.max?.toString() ?? '',
      };
    }
    return { min: '', max: '' };
  }, [groupRange, currentSlotIndex]);

  const slot1Range = useMemo<{ min: string; max: string }>(() => {
    if (groupRange.slotOverrides?.[1]) {
      return {
        min: groupRange.slotOverrides[1].min?.toString() ?? '',
        max: groupRange.slotOverrides[1].max?.toString() ?? '',
      };
    }
    // Fallback: if currentSlotIndex === 1, use top-level min/max
    if (currentSlotIndex === 1) {
      return {
        min: groupRange.min?.toString() ?? '',
        max: groupRange.max?.toString() ?? '',
      };
    }
    return { min: '', max: '' };
  }, [groupRange, currentSlotIndex]);

  // Helper to build a new range with updated slot overrides
  const updateSlotOverride = useCallback((slotIndex: number, slotRange: SlotRangeOverride) => {
    if (!firstRangedMember || !onSetTokenRange) return;
    const newSlotOverrides = { ...groupRange.slotOverrides };
    newSlotOverrides[slotIndex] = slotRange;

    // Clean up empty slot overrides
    const cleanSlotOverrides: Record<number, SlotRangeOverride> = {};
    for (const [idx, sr] of Object.entries(newSlotOverrides)) {
      if (sr.min !== undefined || sr.max !== undefined) {
        cleanSlotOverrides[Number(idx)] = sr;
      }
    }

    const newRange: TokenRangeOverride = {
      ...groupRange,
      slotOverrides: Object.keys(cleanSlotOverrides).length > 0 ? cleanSlotOverrides : undefined,
    };

    // If both slotOverrides and top-level min/max/filterSlotIndex are empty, clear
    const hasTopLevel = newRange.min !== undefined || newRange.max !== undefined;
    const hasSlotLevel = newRange.slotOverrides && Object.keys(newRange.slotOverrides).length > 0;
    if (!hasTopLevel && !hasSlotLevel) {
      onClearTokenRange?.(firstRangedMember.id);
    } else {
      onSetTokenRange(firstRangedMember.id, newRange);
    }
  }, [firstRangedMember, onSetTokenRange, onClearTokenRange, groupRange]);

  // Handle min/max input changes for slot 0
  const handleSlot0MinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    const current = groupRange.slotOverrides?.[0] ?? {};
    updateSlotOverride(0, {
      ...current,
      min: e.target.value === '' || isNaN(v) ? undefined : v,
    });
  }, [groupRange, updateSlotOverride]);

  const handleSlot0MaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    const current = groupRange.slotOverrides?.[0] ?? {};
    updateSlotOverride(0, {
      ...current,
      max: e.target.value === '' || isNaN(v) ? undefined : v,
    });
  }, [groupRange, updateSlotOverride]);

  // Handle min/max input changes for slot 1
  const handleSlot1MinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    const current = groupRange.slotOverrides?.[1] ?? {};
    updateSlotOverride(1, {
      ...current,
      min: e.target.value === '' || isNaN(v) ? undefined : v,
    });
  }, [groupRange, updateSlotOverride]);

  const handleSlot1MaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    const current = groupRange.slotOverrides?.[1] ?? {};
    updateSlotOverride(1, {
      ...current,
      max: e.target.value === '' || isNaN(v) ? undefined : v,
    });
  }, [groupRange, updateSlotOverride]);

  // Prevent click on input from toggling the chip
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Selection styling — compact inline version
  // Priority tier affects visual brightness:
  // - S-tier: slightly brighter background when selected
  // - C-tier: slightly more muted/transparent
  let bgClass: string;
  const tierOpacity = group.priorityTier === 'S' ? '' : group.priorityTier === 'C' ? 'opacity-80' : '';
  if (selectionState === 'full') {
    bgClass = `bg-blue-900/40 ${effectiveBorderClass} text-white ${tierOpacity}`;
  } else if (selectionState === 'partial') {
    bgClass = `bg-blue-900/20 ${effectiveBorderClass} text-gray-300 ${tierOpacity}`;
  } else if (selectionState === 'excluded') {
    bgClass = `bg-red-900/40 border-l-red-500 text-white ${tierOpacity}`;
  } else if (selectionState === 'partial-excluded') {
    bgClass = `bg-red-900/20 border-l-red-500 text-gray-300 ${tierOpacity}`;
  } else {
    bgClass = `bg-gray-800/50 ${effectiveBorderClass} text-gray-300 hover:bg-gray-700/50 ${tierOpacity}`;
  }

  // Range display: inline compact format
  // For dual-number mods: show both slot ranges
  const rangeText = useMemo(() => {
    if (group.rangeSlots.length === 0) return null;
    if (!group.hasMultiPlaceholder) {
      return `${group.globalMin}—${group.globalMax}`;
    }
    // Dual-number: show both slot ranges
    const slot0 = group.rangeSlots[0];
    const slot1 = group.rangeSlots[1];
    if (slot1) {
      return `${slot0[0]}—${slot0[1]} / ${slot1[0]}—${slot1[1]}`;
    }
    return `${slot0[0]}—${slot0[1]}`;
  }, [group]);

  const handleExcludeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExclude?.(memberIds);
  }, [onToggleExclude, memberIds]);

  // ARIA label for screen readers: include full text, selection state, and tier count
  const ariaLabel = useMemo(() => {
    const stateText = selectionState === 'full' ? t('chip.selected') : selectionState === 'partial' ? t('chip.partial') : selectionState === 'excluded' ? t('chip.excluded') : selectionState === 'partial-excluded' ? t('chip.partial_excluded') : t('chip.unselected');
    const parts = [displayText, stateText];
    if (tierCount > 1) parts.push(`${tierCount} ${t('chip.levels')}`);
    if (rangeText) parts.push(`${t('chip.range')} ${rangeText}`);
    return parts.join(', ');
  }, [displayText, selectionState, tierCount, rangeText]);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[13px] border-l-2 transition-[background-color,border-color,color,opacity] duration-150 ease-in-out ${bgClass}${hasRanges && isSelected ? ' chip-with-range' : ''}`}
      style={{ maxWidth: '100%', overflowWrap: 'break-word' }}
      title={tooltip}
    >
      {/* Switch element: just the label + badges, clickable */}
      <div
        onClick={handleClick}
        role="switch"
        aria-checked={selectionState === 'full' ? 'true' : selectionState === 'partial' ? 'mixed' : 'false'}
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        className="flex items-center gap-1 cursor-pointer leading-tight min-w-0 overflow-hidden"
      >
        <span>{displayText}</span>
        {isCollapsed && isSelected && (
          <span className="text-[11px] text-amber-400/70 shrink-0" title={t('chip.optimizer_collapsed')} aria-label={t('chip.optimizer_collapsed')}>
            ⚡
          </span>
        )}
        {hasPrefix && isSelected && (
          <span className="text-[11px] text-blue-400/70 shrink-0" title={`Prefix: "${prefix}" — anchors number to this mod line`} aria-hidden="true">
            ⚓
          </span>
        )}
        {group.hasMultiPlaceholder && (
          <span className="text-[11px] text-amber-400/80 shrink-0 font-semibold" title={t('chip.dual_number_tooltip')} aria-label={t('chip.dual_number')}>
            2x
          </span>
        )}
        {tierCount > 1 && (
          <span className="text-[12px] text-gray-500 shrink-0" aria-hidden="true">
            &times;{tierCount}
          </span>
        )}
        {rangeText && !isSelected && !isExcluded && (
          <span className="text-[12px] text-gray-500 shrink-0" aria-hidden="true">
            ({rangeText})
          </span>
        )}
      </div>
      {/* Per-mod exclude toggle button — small ✗/✓ */}
      {onToggleExclude && (
        <button
          onClick={handleExcludeClick}
          className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold transition-colors ${
            isExcluded
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-red-400'
          }`}
          title={isExcluded ? t('chip.unexclude_tooltip') : t('chip.exclude_tooltip')}
          aria-label={isExcluded ? t('chip.unexclude_aria') : t('chip.exclude_aria')}
        >
          {isExcluded ? '✓' : '✗'}
        </button>
      )}
      {/* Per-chip numeric range inputs — SIBLINGS of switch, not children — valid ARIA tree */}
      {hasRanges && isSelected && onSetTokenRange && !group.hasMultiPlaceholder && (
        <div className="flex items-center gap-1 text-[13px]" onClick={stopPropagation}>
          <span className="text-gray-500">&ge;</span>
          <input
            min={0}
            step={1}
            placeholder={t('range.min')}
            aria-label={t('range.min_aria')}
            className="w-16 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-[13px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            type="number"
            value={groupRange.min ?? ''}
            onChange={(e) => {
              if (!firstRangedMember) return;
              const v = parseInt(e.target.value, 10);
              const val = e.target.value === '' || isNaN(v) || v < 0 ? undefined : v;
              const newRange: TokenRangeOverride = {
                ...groupRange,
                min: val,
              };
              if (newRange.min === undefined && newRange.max === undefined && newRange.filterSlotIndex === undefined) {
                onClearTokenRange?.(firstRangedMember.id);
              } else {
                onSetTokenRange(firstRangedMember.id, newRange);
              }
            }}
          />
          <span className="text-gray-500">&le;</span>
          <input
            min={0}
            step={1}
            placeholder={t('range.max')}
            aria-label={t('range.max_aria')}
            className="w-16 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-[13px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            type="number"
            value={groupRange.max ?? ''}
            onChange={(e) => {
              if (!firstRangedMember) return;
              const v = parseInt(e.target.value, 10);
              const val = e.target.value === '' || isNaN(v) || v < 0 ? undefined : v;
              const newRange: TokenRangeOverride = {
                ...groupRange,
                max: val,
              };
              if (newRange.min === undefined && newRange.max === undefined && newRange.filterSlotIndex === undefined) {
                onClearTokenRange?.(firstRangedMember.id);
              } else {
                onSetTokenRange(firstRangedMember.id, newRange);
              }
            }}
          />
        </div>
      )}
      {/* Dual-number: separate range inputs for each slot — SIBLINGS of switch */}
      {hasRanges && isSelected && onSetTokenRange && group.hasMultiPlaceholder && (
        <div className="flex flex-col gap-0.5 text-[13px]" onClick={stopPropagation}>
          {/* Slot 0 row */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-blue-400/80 font-semibold shrink-0 w-5">1е</span>
            <span className="text-gray-500">&ge;</span>
            <input
              min={0}
              step={1}
              placeholder={t('range.min')}
              aria-label={t('range.min_aria_dual_1')}
              className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-[13px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              type="number"
              value={slot0Range.min}
              onChange={handleSlot0MinChange}
            />
            <span className="text-gray-500">&le;</span>
            <input
              min={0}
              step={1}
              placeholder={t('range.max')}
              aria-label={t('range.max_aria_dual_1')}
              className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-[13px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              type="number"
              value={slot0Range.max}
              onChange={handleSlot0MaxChange}
            />
          </div>
          {/* Slot 1 row */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-orange-400/80 font-semibold shrink-0 w-5">2е</span>
            <span className="text-gray-500">&ge;</span>
            <input
              min={0}
              step={1}
              placeholder={t('range.min')}
              aria-label={t('range.min_aria_dual_2')}
              className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-[13px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              type="number"
              value={slot1Range.min}
              onChange={handleSlot1MinChange}
            />
            <span className="text-gray-500">&le;</span>
            <input
              min={0}
              step={1}
              placeholder={t('range.max')}
              aria-label={t('range.max_aria_dual_2')}
              className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-[13px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              type="number"
              value={slot1Range.max}
              onChange={handleSlot1MaxChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};
