/**
 * VendorChip — A compact toggleable chip for selecting/deselecting a vendor property.
 *
 * Visually consistent with FilterChip but simpler (no family grouping, no range slots).
 * Used in the VendorPage's flex-wrap chip layout.
 *
 * Selection states:
 * - Full: property is selected (highlighted)
 * - None: property is not selected
 */
import React from 'react';

interface VendorProperty {
  id: string;
  label: string;
  regex: string;
  group: string;
  hasNumericInput?: boolean;
  numericSuffix?: string;
}

interface VendorChipProps {
  prop: VendorProperty;
  isSelected: boolean;
  numericValue: number | null;
  onToggle: (id: string) => void;
  onNumericChange: (id: string, value: number | null) => void;
}

export const VendorChip: React.FC<VendorChipProps> = ({
  prop,
  isSelected,
  numericValue,
  onToggle,
  onNumericChange,
}) => {
  const handleClick = () => {
    onToggle(prop.id);
  };

  // Color variant based on property group type
  const borderClass = isSelected
    ? 'border-l-blue-500'
    : 'border-l-gray-600';

  const bgClass = isSelected
    ? 'bg-blue-900/40 text-white'
    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border-l-2 transition-colors cursor-pointer ${bgClass} ${borderClass}`}
      onClick={handleClick}
      role="switch"
      aria-checked={isSelected}
      aria-label={`${prop.label}${isSelected ? ', выбрано' : ', не выбрано'}`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
    >
      <span className="leading-tight">{prop.label}</span>
      {prop.hasNumericInput && isSelected && (
        <input
          type="number"
          min={0}
          max={100}
          placeholder="≥N"
          value={numericValue ?? ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onNumericChange(prop.id, e.target.value ? parseInt(e.target.value, 10) : null)}
          aria-label={`Порог для ${prop.label}`}
          className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-[10px] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      )}
    </span>
  );
};
