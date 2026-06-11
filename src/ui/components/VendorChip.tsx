/**
 * VendorChip — A compact toggleable chip for selecting/deselecting a vendor property.
 *
 * Visually consistent with FilterChip but simpler (no family grouping, no range slots).
 * Used in the VendorPage's flex-wrap chip layout.
 *
 * Selection states:
 * - Full (want): property is selected (highlighted blue)
 * - Excluded: property is excluded (highlighted red)
 * - None: property is not selected
 *
 * ARIA structure: The numeric <input> is a SIBLING of the role="switch" element,
 * not a child. This avoids invalid ARIA tree where an interactive input is nested
 * inside a switch role. The outer div acts as a visual container only.
 */
import React from 'react';
import type { VendorProperty } from '@data/vendor-properties';

interface VendorChipProps {
  prop: VendorProperty;
  isSelected: boolean;
  isExcluded: boolean;
  numericValue: number | null;
  onToggle: (id: string) => void;
  onToggleExclude: (id: string) => void;
  onNumericChange: (id: string, value: number | null) => void;
}

export const VendorChip: React.FC<VendorChipProps> = ({
  prop,
  isSelected,
  isExcluded,
  numericValue,
  onToggle,
  onToggleExclude,
  onNumericChange,
}) => {
  const handleClick = () => {
    onToggle(prop.id);
  };

  const handleExcludeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExclude(prop.id);
  };

  // Color variant based on property group type
  const borderClass = isExcluded
    ? 'border-l-bl-red'
    : isSelected
      ? 'border-l-bl-blue'
      : 'border-l-gray-600';

  const bgClass = isExcluded
    ? 'bg-indicator-red text-bright'
    : isSelected
      ? 'bg-chip-active text-bright'
      : 'bg-chip text-soft hover:bg-chip-hover';

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border-l-2 transition-colors ${bgClass} ${borderClass}`}
    >
      {/* Switch element: just the label, clickable */}
      <div
        onClick={handleClick}
        role="switch"
        aria-checked={isExcluded ? 'true' : isSelected ? 'true' : 'false'}
        aria-label={`${prop.label}${isSelected ? ', выбрано' : isExcluded ? ', исключено' : ', не выбрано'}`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        className="leading-tight cursor-pointer"
      >
        {prop.label}
      </div>
      {/* Exclude toggle: small "×" button to mark as exclude */}
      {(isSelected || isExcluded) && (
        <button
          onClick={handleExcludeClick}
          className={`w-3.5 h-3.5 rounded text-[9px] font-bold leading-none flex items-center justify-center transition-colors ${
            isExcluded
              ? 'bg-red-700/60 text-red-200 hover:bg-red-600/60'
              : 'bg-raised/60 text-muted hover:bg-red-800/40 hover:text-accent-red-soft'
          }`}
          aria-label={isExcluded ? `Убрать исключение: ${prop.label}` : `Исключить: ${prop.label}`}
          title={isExcluded ? 'Убрать исключение' : 'Исключить'}
        >
          ✕
        </button>
      )}
      {/* Numeric input: SIBLING of switch, not child — valid ARIA tree */}
      {prop.hasNumericInput && isSelected && (
        <input
          type="number"
          step={1}
          min={0}
          max={1000}
          placeholder="≥N"
          value={numericValue ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onNumericChange(prop.id, e.target.value === '' || isNaN(v) || v < 0 ? null : v);
          }}
          aria-label={`Порог для ${prop.label}`}
          className="w-14 px-1 py-0.5 bg-surface border border-edge rounded text-[10px] text-bright placeholder-ghost-alt focus:outline-none focus:border-blue-500"
        />
      )}
    </div>
  );
};
