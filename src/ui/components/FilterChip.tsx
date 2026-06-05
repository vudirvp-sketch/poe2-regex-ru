/**
 * FilterChip — A compact toggleable chip for selecting/deselecting a family group of mods.
 *
 * Redesigned for flex-wrap layout: inline-flex, compact single-line display,
 * with range info and tier count as inline badges.
 *
 * Selection states:
 * - Full: all member tokens are selected (highlighted)
 * - Partial: some member tokens are selected (dimmed highlight)
 * - None: no member tokens are selected
 */
import React, { useMemo } from 'react';
import type { FamilyGroup } from '@shared/types';

interface FilterChipProps {
  group: FamilyGroup;
  selectedIds: Set<string>;
  onToggleTokens: (ids: string[]) => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ group, selectedIds, onToggleTokens }) => {
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
  const rangeText = useMemo(() => {
    if (group.rangeSlots.length === 0) return null;
    if (!group.hasMultiPlaceholder) {
      return `${group.globalMin}—${group.globalMax}`;
    }
    return group.rangeSlots.map(([min, max]) => `${min}—${max}`).join(', ');
  }, [group]);

  // ARIA label for screen readers: include full text, selection state, and tier count
  const ariaLabel = useMemo(() => {
    const stateText = selectionState === 'full' ? 'выбрано' : selectionState === 'partial' ? 'частично выбрано' : 'не выбрано';
    const parts = [displayText, stateText];
    if (tierCount > 1) parts.push(`${tierCount} уровней`);
    if (rangeText) parts.push(`диапазон ${rangeText}`);
    return parts.join(', ');
  }, [displayText, selectionState, tierCount, rangeText]);

  return (
    <button
      onClick={handleClick}
      title={tooltip}
      aria-label={ariaLabel}
      aria-pressed={selectionState === 'full'}
      role="switch"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border-l-2 transition-colors cursor-pointer ${bgClass}`}
    >
      <span className="leading-tight">{displayText}</span>
      {tierCount > 1 && (
        <span className="text-[10px] text-gray-500 shrink-0" aria-hidden="true">
          &times;{tierCount}
        </span>
      )}
      {rangeText && (
        <span className="text-[10px] text-gray-500 shrink-0" aria-hidden="true">
          ({rangeText})
        </span>
      )}
    </button>
  );
};
