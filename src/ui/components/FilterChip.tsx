/**
 * FilterChip — A toggleable chip for selecting/deselecting a family group of mods.
 *
 * Displays the group's display text (combined range) and indicates
 * whether it's currently selected. Clicking toggles all members of the group.
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

  // Show the display text, truncated to ~60 chars
  const displayText = useMemo(() => {
    const text = group.displayText;
    if (text.length <= 60) return text;
    return text.slice(0, 57) + '...';
  }, [group.displayText]);

  // Tooltip: show all member raw texts + regex
  const tooltip = useMemo(() => {
    const lines = group.members.map(
      (m) => m.rawText.ru
    );
    lines.push(`Regex: ${group.members[0]?.regex.ru ?? ''}`);
    return lines.join('\n');
  }, [group.members]);

  // Tier count badge (show only for groups with > 1 member)
  const tierCount = group.members.length;

  const affixColor = group.affix === 'prefix' ? 'border-l-blue-500' : 'border-l-orange-500';

  const handleClick = () => {
    onToggleTokens(memberIds);
  };

  // Selection styling
  let bgClass: string;
  if (selectionState === 'full') {
    bgClass = `bg-blue-900/40 ${affixColor} text-white`;
  } else if (selectionState === 'partial') {
    bgClass = `bg-blue-900/20 ${affixColor} text-gray-300`;
  } else {
    bgClass = `bg-gray-800/50 ${affixColor} text-gray-300 hover:bg-gray-700/50`;
  }

  return (
    <button
      onClick={handleClick}
      title={tooltip}
      className={`text-left px-3 py-2 rounded text-xs border-l-2 transition-colors ${bgClass}`}
    >
      <div className="flex items-center gap-1">
        <span className="block leading-tight flex-1">{displayText}</span>
        {tierCount > 1 && (
          <span className="text-[10px] text-gray-500 shrink-0">
            ×{tierCount}
          </span>
        )}
      </div>
      {group.rangeSlots.length > 0 && !group.hasMultiPlaceholder && (
        <span className="text-gray-500 text-[10px]">
          ({group.globalMin}—{group.globalMax})
        </span>
      )}
      {group.hasMultiPlaceholder && (
        <span className="text-gray-500 text-[10px]">
          {group.rangeSlots.map(([min, max]) => `(${min}—${max})`).join(', ')}
        </span>
      )}
    </button>
  );
};
