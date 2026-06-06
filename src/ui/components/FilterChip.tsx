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
 * - For dual-number mods (hasMultiPlaceholder), the filter applies to the first
 *   placeholder's range (filterSlotIndex), which is typically the minimum damage/value.
 *   An indicator "2x" badge shows the mod has two number slots.
 *
 * Selection states:
 * - Full: all member tokens are selected (highlighted)
 * - Partial: some member tokens are selected (dimmed highlight)
 * - None: no member tokens are selected
 */
import React, { useMemo, useCallback } from 'react';
import type { FamilyGroup } from '@shared/types';
import { t } from '@shared/i18n';
import type { TokenRangeOverride } from '@store/filter-store';

interface FilterChipProps {
  group: FamilyGroup;
  selectedIds: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  /** Per-token numeric range overrides from filter store */
  perTokenRanges?: Record<string, TokenRangeOverride>;
  /** Set per-token numeric range override */
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  /** Clear per-token numeric range override */
  onClearTokenRange?: (tokenId: string) => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  group,
  selectedIds,
  onToggleTokens,
  perTokenRanges,
  onSetTokenRange,
  onClearTokenRange,
}) => {
  const memberIds = useMemo(
    () => group.members.map((m) => m.id),
    [group.members]
  );

  // Determine selection state
  const selectionState = useMemo(() => {
    let selectedCount = 0;
    for (const id of memberIds) {
      if (selectedIds.has(id)) selectedCount++;
    }
    if (selectedCount === memberIds.length) return 'full' as const;
    if (selectedCount > 0) return 'partial' as const;
    return 'none' as const;
  }, [memberIds, selectedIds]);

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
  const affixColor = group.affix === 'prefix' ? 'border-l-blue-500' : 'border-l-orange-500';

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
  const isSelected = selectionState !== 'none';

  // Get the first ranged member's current per-token range (for display in inputs)
  // All members in a family group share the same range slot structure,
  // so we use the first member's override as representative for the group.
  const firstRangedMember = useMemo(() => {
    return group.members.find(m => m.ranges.length > 0);
  }, [group.members]);

  // Get effective per-group range from perTokenRanges
  // Use the first ranged member's override as the group's override
  const groupRange = useMemo<TokenRangeOverride>(() => {
    if (!firstRangedMember || !perTokenRanges) return {};
    return perTokenRanges[firstRangedMember.id] ?? {};
  }, [firstRangedMember, perTokenRanges]);

  // Handle min input change for this group
  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!firstRangedMember || !onSetTokenRange) return;
    const v = parseInt(e.target.value, 10);
    const newRange: TokenRangeOverride = {
      ...groupRange,
      min: e.target.value === '' || isNaN(v) ? undefined : v,
    };
    // If both min and max are undefined, clear the override
    if (newRange.min === undefined && newRange.max === undefined) {
      onClearTokenRange?.(firstRangedMember.id);
    } else {
      onSetTokenRange(firstRangedMember.id, newRange);
    }
  }, [firstRangedMember, onSetTokenRange, onClearTokenRange, groupRange]);

  // Handle max input change for this group
  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!firstRangedMember || !onSetTokenRange) return;
    const v = parseInt(e.target.value, 10);
    const newRange: TokenRangeOverride = {
      ...groupRange,
      max: e.target.value === '' || isNaN(v) ? undefined : v,
    };
    // If both min and max are undefined, clear the override
    if (newRange.min === undefined && newRange.max === undefined) {
      onClearTokenRange?.(firstRangedMember.id);
    } else {
      onSetTokenRange(firstRangedMember.id, newRange);
    }
  }, [firstRangedMember, onSetTokenRange, onClearTokenRange, groupRange]);

  // Prevent click on input from toggling the chip
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Selection styling — compact inline version
  let bgClass: string;
  if (selectionState === 'full') {
    bgClass = `bg-blue-900/40 ${affixColor} text-white`;
  } else if (selectionState === 'partial') {
    bgClass = `bg-blue-900/20 ${affixColor} text-gray-300`;
  } else {
    bgClass = `bg-gray-800/50 ${affixColor} text-gray-300 hover:bg-gray-700/50`;
  }

  // Range display: inline compact format
  // For dual-number mods: show only the filterable slot (first placeholder range)
  const rangeText = useMemo(() => {
    if (group.rangeSlots.length === 0) return null;
    if (!group.hasMultiPlaceholder) {
      return `${group.globalMin}—${group.globalMax}`;
    }
    // Dual-number: show filterable slot range + second slot in parentheses
    const filterSlot = group.rangeSlots[group.filterSlotIndex] ?? group.rangeSlots[0];
    const secondSlot = group.rangeSlots.find((_, i) => i !== group.filterSlotIndex);
    if (secondSlot) {
      return `${filterSlot[0]}—${filterSlot[1]} (до ${secondSlot[0]}—${secondSlot[1]})`;
    }
    return `${filterSlot[0]}—${filterSlot[1]}`;
  }, [group]);

  // ARIA label for screen readers: include full text, selection state, and tier count
  const ariaLabel = useMemo(() => {
    const stateText = selectionState === 'full' ? t('chip.selected') : selectionState === 'partial' ? t('chip.partial') : t('chip.unselected');
    const parts = [displayText, stateText];
    if (tierCount > 1) parts.push(`${tierCount} ${t('chip.levels')}`);
    if (rangeText) parts.push(`${t('chip.range')} ${rangeText}`);
    return parts.join(', ');
  }, [displayText, selectionState, tierCount, rangeText]);

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border-l-2 transition-colors cursor-pointer min-w-[45%] ${bgClass}`}
      onClick={handleClick}
      title={tooltip}
      role="switch"
      aria-label={ariaLabel}
      aria-checked={selectionState === 'full' ? 'true' : selectionState === 'partial' ? 'mixed' : 'false'}
    >
      <span className="leading-tight">{displayText}</span>
      {hasPrefix && isSelected && (
        <span className="text-[9px] text-blue-400/70 shrink-0" title={`Prefix: "${prefix}" — anchors number to this mod line`} aria-hidden="true">
          ⚓
        </span>
      )}
      {group.hasMultiPlaceholder && (
        <span className="text-[9px] text-amber-400/80 shrink-0 font-semibold" title={t('chip.dual_number_tooltip')} aria-label={t('chip.dual_number')}>
          2x
        </span>
      )}
      {tierCount > 1 && (
        <span className="text-[10px] text-gray-500 shrink-0" aria-hidden="true">
          &times;{tierCount}
        </span>
      )}
      {rangeText && !isSelected && (
        <span className="text-[10px] text-gray-500 shrink-0" aria-hidden="true">
          ({rangeText})
        </span>
      )}
      {/* Per-chip numeric range inputs — shown when group is selected and has ranges */}
      {/* For dual-number mods: filter applies to first placeholder (filterSlotIndex) */}
      {hasRanges && isSelected && onSetTokenRange && (
        <div className="flex items-center gap-1 text-xs" onClick={stopPropagation}>
          {group.hasMultiPlaceholder && (
            <span className="text-[9px] text-amber-400/60 shrink-0" title={t('chip.dual_number_filter_note')}>
              {t('chip.dual_number_slot_label')}
            </span>
          )}
          <span className="text-gray-500">&ge;</span>
          <input
            min={0}
            placeholder={t('range.min')}
            aria-label={group.hasMultiPlaceholder ? t('range.min_aria_dual') : t('range.min_aria')}
            className="w-14 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            type="number"
            value={groupRange.min ?? ''}
            onChange={handleMinChange}
          />
          <span className="text-gray-500">&le;</span>
          <input
            min={0}
            placeholder={t('range.max')}
            aria-label={group.hasMultiPlaceholder ? t('range.max_aria_dual') : t('range.max_aria')}
            className="w-14 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            type="number"
            value={groupRange.max ?? ''}
            onChange={handleMaxChange}
          />
        </div>
      )}
    </div>
  );
};
