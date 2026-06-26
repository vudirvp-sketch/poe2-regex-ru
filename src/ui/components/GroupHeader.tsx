/**
 * GroupHeader — Shared collapsible header for affix group levels.
 *
 * Phase 2 (iter 133) of UI Refactor. Used by `ModList` and `VirtualizedModList`
 * to render the Level 1 (affix column: ИМПЛИСИТЫ/ПРЕФИКСЫ/СУФФИКСЫ) and
 * Level 3 (semantic sub-group: ДОБЫЧА/УСИЛЕНИЯ/...) headers with a chevron
 * toggle that drives collapse state in the filter store.
 *
 * Key format contract (see `docs/UI_REFACTOR_PLAN.md` §4 Phase 2):
 *   - Top-level key:    `${categoryId}:${affix}`                     (e.g. `belt:prefix`)
 *   - Sub-group key:    `${categoryId}:${affix}:${subBlockKey}`      (e.g. `belt:prefix:positive-loot`)
 *
 * Asymmetric default state (iter 131 §13.7 correction #4):
 *   - Top-level groups default EXPANDED (in `collapsedGroups` = collapsed)
 *   - Sub-groups default COLLAPSED (in `expandedSubGroups` = expanded)
 *
 * This component is intentionally presentational — it knows nothing about
 * the store. The parent decides the `isCollapsed` boolean and the `onToggle`
 * callback based on which set the key belongs to. This keeps the component
 * reusable across both group levels and testable in isolation.
 *
 * Accessibility:
 *   - Renders as a `<button>` with `aria-expanded` and `aria-controls`.
 *   - Chevron is a CSS-rotated `▶` glyph (no inline SVG, no extra deps).
 *   - Count badge is a separate `<span>` so screen readers announce it as
 *     part of the button label.
 */
import React from 'react';
import { t } from '@shared/i18n';

export interface GroupHeaderProps {
  /** Human-readable label (e.g. "ПРЕФИКСЫ", "ДОБЫЧА"). Already uppercased
   *  by caller when appropriate — GroupHeader does not transform it. */
  label: string;
  /** Count of items (chips or sub-groups) inside this group. Rendered in
   *  parentheses after the label. */
  count: number;
  /** Whether the group's body is currently COLLAPSED. When true, the chevron
   *  points right (▶) and `aria-expanded=false`. When false, chevron is
   *  rotated 90deg (▼) and `aria-expanded=true`. */
  isCollapsed: boolean;
  /** Click handler — toggles collapse state in the store. */
  onToggle: () => void;
  /** Optional id for the body element this header controls. When provided,
   *  rendered as `aria-controls={controlsId}` for AT compatibility.
   *  The body element itself must use the same id. */
  controlsId?: string;
  /** Tailwind class string for the outer container. Caller composes the
   *  affix-specific styling here (e.g. 'affix-header-prefix text-accent-blue'
   *  for top-level prefix, or 'text-[12px] font-semibold uppercase tracking-wider'
   *  for a sub-group). */
  className?: string;
  /** Optional icon node rendered before the label (e.g. origin section icons). */
  icon?: React.ReactNode;
  /** Visual variant — drives the chevron size and padding.
   *  - 'top': Level 1 affix column header (larger, bolder)
   *  - 'sub': Level 3 semantic sub-group header (smaller, subtler)
   *  - 'origin': Level 2 origin section header (medium, with icon)
   *  Defaults to 'top'. */
  variant?: 'top' | 'sub' | 'origin';
}

/** Variant → Tailwind class map for the chevron + count layout. */
const VARIANT_CLASSES: Record<NonNullable<GroupHeaderProps['variant']>, string> = {
  top: 'text-base font-bold uppercase tracking-wider gap-1.5',
  sub: 'text-[12px] font-semibold uppercase tracking-wider gap-1 ml-4 mb-1 px-2.5 py-0.5 rounded',
  origin: 'text-[14px] font-bold uppercase tracking-wider gap-1.5 ml-2 mt-4 mb-2 px-3 py-1.5 rounded-sm border-l-2',
};

/**
 * Render a collapsible group header. The button's accessible name is
 * `${label} (${count})` — the chevron is `aria-hidden` so screen readers
 * don't announce "right-pointing triangle".
 */
export const GroupHeader: React.FC<GroupHeaderProps> = ({
  label,
  count,
  isCollapsed,
  onToggle,
  controlsId,
  className = '',
  icon = null,
  variant = 'top',
}) => {
  const variantClass = VARIANT_CLASSES[variant];
  const expandLabel = isCollapsed
    ? t('group.expand_btn_label')
    : t('group.collapse_btn_label');

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      aria-controls={controlsId}
      aria-label={`${expandLabel}: ${label} (${count})`}
      className={`group-header-btn ${variantClass} ${className} flex items-center w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber`}
    >
      {/* Chevron — aria-hidden because it's purely decorative; the button's
          aria-label already conveys the expand/collapse action in words. */}
      <span
        className="group-header-chevron select-none shrink-0"
        aria-hidden="true"
        style={{
          fontSize: variant === 'top' ? '0.85em' : '0.95em',
          width: '1em',
          textAlign: 'center',
          marginRight: '4px',
        }}
      >
        ▶
      </span>
      {icon}
      <span className="flex-1">
        {label} ({count})
      </span>
    </button>
  );
};

GroupHeader.displayName = 'GroupHeader';
