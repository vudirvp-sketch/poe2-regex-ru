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
 * Phase 4 (iter 137): Added optional `infoTooltip` prop. When provided
 * (string or ReactNode), an `ⓘ` glyph renders AFTER the label + count, using
 * the new Tooltip component (portal-based). Used on top-level affix column
 * headers (ПРЕФИКСЫ/СУФФИКСЫ/ИМПЛИСЕТ) to give beginners a one-sentence
 * explanation of what each affix type means. When omitted, no ⓘ renders
 * (backward compat — pre-Phase-4 behaviour).
 *
 * iter 150 (KI#41): ⓘ glyph positioned ABSOLUTELY at the right edge of the
 * toggle button's box (overlaid on the right padding area) instead of being
 * a flex sibling that shrinks the toggle button. Eliminates the visual
 * "shift" reported by the user — the toggle button keeps its full width
 * whether or not the ⓘ is shown. The toggle button gets `pr-7` when ⓘ is
 * present so the label text doesn't overlap with the glyph.
 *
 * Accessibility:
 *   - Renders as a `<button>` with `aria-expanded` and `aria-controls`.
 *   - Chevron is a CSS-rotated `▶` glyph (no inline SVG, no extra deps).
 *   - Count badge is a separate `<span>` so screen readers announce it as
 *     part of the button label.
 *   - ⓘ info icon is a SIBLING of the toggle button (NOT a child — nested
 *     <button> is invalid HTML) — clicking it must NOT toggle collapse.
 *     The Tooltip component handles `stopPropagation` on its own trigger.
 */
import React from 'react';
import { t } from '@shared/i18n';
import { Tooltip } from './Tooltip';

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
  /** Phase 4 (iter 137): Optional tooltip content rendered as an `ⓘ` glyph
   *  AFTER the label + count. When provided, the Tooltip component wraps
   *  the glyph and shows the content on hover/focus. Used on top-level affix
   *  column headers to explain what each affix type means. When omitted,
   *  no ⓘ renders (backward compat — pre-Phase-4 behaviour). */
  infoTooltip?: React.ReactNode;
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
  infoTooltip,
  variant = 'top',
}) => {
  const variantClass = VARIANT_CLASSES[variant];
  const expandLabel = isCollapsed
    ? t('group.expand_btn_label')
    : t('group.collapse_btn_label');

  // iter 150 (KI#41): when infoTooltip is present, the ⓘ glyph is positioned
  // ABSOLUTELY at the right edge of the toggle button's box (overlaid on top
  // of the right padding) instead of being a flex sibling that shrinks the
  // toggle button. This eliminates the visual "shift" the user reported —
  // the toggle button keeps its full width whether or not the ⓘ is shown.
  // The toggle button gets `pr-7` (28px right padding) when infoTooltip is
  // present so the label text doesn't overlap with the ⓘ glyph.
  const hasInfo = infoTooltip != null;

  return (
    <div className={`relative flex items-center w-full ${hasInfo ? '' : 'gap-1'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-controls={controlsId}
        aria-label={`${expandLabel}: ${label} (${count})`}
        className={`group-header-btn ${variantClass} ${className} flex-1 flex items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber ${hasInfo ? 'pr-7' : ''}`}
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
      {/* Phase 4 (iter 137): Optional ⓘ info icon — SIBLING of the toggle
          button (NOT a child — nested <button> is invalid HTML) so clicking
          it does NOT toggle collapse. The Tooltip component handles
          stopPropagation on its own trigger to prevent the click from also
          bubbling to parent onClick handlers.
          iter 150 (KI#41): positioned ABSOLUTELY at the right edge of the
          outer container (overlays the toggle button's pr-7 padding area)
          so it no longer shifts the toggle button sideways. The outer div
          has `relative` for this absolute positioning to work. */}
      {hasInfo && (
        <Tooltip
          content={infoTooltip}
          ariaLabel={t('tooltip.info_aria')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
        />
      )}
    </div>
  );
};

GroupHeader.displayName = 'GroupHeader';
