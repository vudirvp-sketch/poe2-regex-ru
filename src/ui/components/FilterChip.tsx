/**
 * FilterChip — A toggleable chip for selecting/deselecting a mod.
 *
 * Displays the mod's Russian text (truncated) and indicates
 * whether it's currently selected. Clicking toggles selection.
 */
import React, { useMemo } from 'react';
import type { GameToken } from '@shared/types';

interface FilterChipProps {
  token: GameToken;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ token, isSelected, onToggle }) => {
  // Show the rawText, truncated to ~60 chars
  const displayText = useMemo(() => {
    const text = token.rawText.ru;
    if (text.length <= 60) return text;
    return text.slice(0, 57) + '...';
  }, [token.rawText.ru]);

  // Show the regex as a tooltip
  const tooltip = `${token.rawText.ru}\nRegex: ${token.regex.ru}`;

  const affixColor = token.affix === 'prefix' ? 'border-l-blue-500' : 'border-l-orange-500';

  return (
    <button
      onClick={() => onToggle(token.id)}
      title={tooltip}
      className={`text-left px-3 py-2 rounded text-xs border-l-2 transition-colors ${
        isSelected
          ? `bg-blue-900/40 ${affixColor} text-white`
          : `bg-gray-800/50 ${affixColor} text-gray-300 hover:bg-gray-700/50`
      }`}
    >
      <span className="block leading-tight">{displayText}</span>
      {token.ranges.length > 0 && (
        <span className="text-gray-500 text-[10px]">
          {token.ranges.map(([min, max]) => `(${min}—${max})`).join(', ')}
        </span>
      )}
    </button>
  );
};
