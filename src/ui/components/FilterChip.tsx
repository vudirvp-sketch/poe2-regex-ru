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
 */
import React, { useMemo, useCallback } from 'react';
import type { FamilyGroup, SortMode } from '@shared/types';
import { t } from '@shared/i18n';
import type { TokenRangeOverride, SlotRangeOverride } from '@store/filter-store';

interface FilterChipProps {
  group: FamilyGroup;
  selectedIds: Set<string>;
  /** Set of excluded ("don't want") token IDs — per-mod exclude */
  excludedIds?: Set<string>;
  /** iter 159: Set of optional ("opt") token IDs — only meaningful in MIXED
   *  search-logic mode. When `mixedMode` is true and any member of this
   *  chip's group is in `optionalIds`, the chip renders in the OPT state
   *  (amber dashed border). Backward compat: when omitted OR `mixedMode`
   *  is false, the OPT state is NOT rendered (pre-iter-159 behaviour). */
  optionalIds?: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  /** Toggle a family group to excluded state */
  onToggleExclude?: (ids: string[]) => void;
  /** iter 159: Toggle a family group to optional state. Only called when
   *  `mixedMode` is true and the user shift+clicks (or shift+Enter) the chip.
   *  Backward compat: when omitted OR `mixedMode` is false, shift+click is
   *  a no-op (no OPT toggle). */
  onToggleOptional?: (ids: string[]) => void;
  /** iter 159: When true, enables 3-state chip behaviour (want / opt / exclude).
   *  - click          → want    (onToggleTokens)
   *  - shift+click    → opt     (onToggleOptional)
   *  - right-click    → exclude (onToggleExclude) — preventDefault on contextmenu
   *  - Enter/Space    → want
   *  - shift+Enter    → opt
   *  When false (default), chip behaves as before: click = want, exclude via
   *  the ✗ button. Backward compat for tests + VendorPage + pre-iter-159
   *  callers that don't pass `mixedMode`. */
  mixedMode?: boolean;
  /** Per-token numeric range overrides from filter store */
  perTokenRanges?: Record<string, TokenRangeOverride>;
  /** Set per-token numeric range override */
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  /** Clear per-token numeric range override */
  onClearTokenRange?: (tokenId: string) => void;
  /** Set of token IDs whose individual regex was collapsed by the optimizer.
   *  When any member of this chip's group is in this set, show a visual indicator. */
  collapsedTokenIds?: Set<string>;
  /** Phase 5 (iter 136): Favorited ("pinned") token IDs from filter-store.
   *  When provided alongside `onTogglePinned`, a ⭐ icon button renders to
   *  the LEFT of the chip label. Filled (text-accent-amber-soft) when any
   *  member of this chip's group is in `pinnedIds`; outline (text-muted)
   *  otherwise. Click → `onTogglePinned(memberIds)` (toggles whole family).
   *  Backward compat: when omitted OR `onTogglePinned` omitted, the ⭐ icon
   *  is NOT rendered (pre-Phase-5 behaviour). */
  pinnedIds?: Set<string>;
  /** Phase 5 (iter 136): Toggle pinned state for a family group. When the
   *  user clicks ⭐ on a chip, we toggle ALL member tokens' pinned state at
   *  once (matches `onToggleTokens` / `onToggleExclude` family-level
   *  pattern). Pass the member IDs of this family group. */
  onTogglePinned?: (ids: string[]) => void;
  /**
   * Within-block sort mode (iter 107). Controls whether the chip's left border
   * communicates the priority tier (tier-first mode) or the affix type (alpha mode).
   *  - 'alpha'      (default): S-tier → amber-soft border (existing always-on
   *                  indicator); A/B/C → affix color (blue/orange/amber).
   *  - 'tier-first' : ALL tiers get a distinct tier-colored border — S=amber-soft
   *                  (brightest), A=amber, B=amber-dim (bronze), C=gray. The affix
   *                  color is suppressed because tier scan is the user's primary
   *                  intent in this mode (affix info remains visible via the
   *                  column header / origin-section structure).
   * Backward compat: omitted prop = 'alpha' = pre-iter-107 behaviour. */
  sortMode?: SortMode;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  group,
  selectedIds,
  excludedIds,
  optionalIds,
  onToggleTokens,
  onToggleExclude,
  onToggleOptional,
  mixedMode = false,
  perTokenRanges,
  onSetTokenRange,
  onClearTokenRange,
  collapsedTokenIds,
  pinnedIds,
  onTogglePinned,
  sortMode = 'alpha',
}) => {
  const memberIds = useMemo(
    () => group.members.map((m) => m.id),
    [group.members]
  );

  // Determine selection state: want / opt / exclude / none
  // iter 159: extended to support 'full-optional' / 'partial-optional' states
  // for MIXED-mode 3-state chip. Pre-iter-159 callers (mixedMode=false)
  // never see the optional states because we skip the optionalCount check
  // when mixedMode is false — this preserves 2-state behaviour even if the
  // store has stale optionalIds from a previous MIXED session (e.g. user
  // toggled MIXED → AND without clearing optionalIds first).
  const selectionState = useMemo(() => {
    const effectiveExcluded = excludedIds ?? new Set<string>();
    const effectiveOptional = mixedMode ? (optionalIds ?? new Set<string>()) : new Set<string>();
    let selectedCount = 0;
    let excludedCount = 0;
    let optionalCount = 0;
    for (const id of memberIds) {
      if (selectedIds.has(id)) selectedCount++;
      if (effectiveExcluded.has(id)) excludedCount++;
      if (effectiveOptional.has(id)) optionalCount++;
    }
    // Priority: selected > excluded > optional (matches store's mutual exclusion —
    // a token can only be in ONE of the three sets, so this ordering is purely
    // defensive in case a buggy caller passes overlapping sets).
    if (selectedCount === memberIds.length) return 'full' as const;
    if (selectedCount > 0) return 'partial' as const;
    if (excludedCount === memberIds.length) return 'excluded' as const;
    if (excludedCount > 0) return 'partial-excluded' as const;
    if (optionalCount === memberIds.length) return 'full-optional' as const;
    if (optionalCount > 0) return 'partial-optional' as const;
    return 'none' as const;
  }, [memberIds, selectedIds, excludedIds, optionalIds, mixedMode]);

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
  const affixColor = group.affix === 'prefix' ? 'border-l-bl-blue' : group.affix === 'implicit' ? 'border-l-bl-amber' : 'border-l-bl-orange';

  // iter 107: tier-aware left border. Two policies depending on sortMode:
  //  - 'alpha' (default, pre-iter-107 behaviour): S-tier gets amber-soft
  //    (always-on indicator that an S-tier mod is here); A/B/C keep affixColor.
  //  - 'tier-first': ALL four tiers get a distinct tier color, suppressing the
  //    affix color on the chip border. Hierarchy mirrors the sortMode-aware
  //    tier palette (S=brightest amber, A=medium amber, B=bronze
  //    (amber-dim), C=neutral gray). The affix info remains visible via the
  //    column header / origin-section structure, so swapping the chip-level
  //    border from affix→tier does not lose information.
  const effectiveBorderClass = sortMode === 'tier-first'
    ? (group.priorityTier === 'S' ? 'border-l-bl-amber-soft'
       : group.priorityTier === 'A' ? 'border-l-bl-amber'
       : group.priorityTier === 'B' ? 'border-l-bl-amber-dim'
       : 'border-l-bl-gray')  // 'C' or unknown
    : (group.priorityTier === 'S' ? 'border-l-bl-amber-soft' : affixColor);

  // iter 159: 3-state click handler for MIXED mode.
  //  - shift+click OR ctrl+click → opt (onToggleOptional) — only when mixedMode + onToggleOptional.
  //  - plain click → want (onToggleTokens) — default behaviour.
  // Backward compat: when mixedMode is false, shift+click / ctrl+click are
  // treated as a plain click (no OPT toggle), preserving pre-iter-159
  // behaviour for tests and VendorPage.
  //
  // iter 181 (KI#56): added ctrl+click as alternative to shift+click.
  // Reason: shift+click triggers browser text selection (extends an existing
  // selection or starts a new one), which made the MIXED-mode OPT gesture
  // feel broken — the user clicked, the chip toggled, but the page also got
  // a text selection rectangle. Ctrl+click has no such browser side-effect.
  // Shift+click still works (kept for muscle memory + existing tests) but
  // `handleMouseDown` calls `preventDefault()` when shift is pressed to
  // suppress the text-selection side-effect. The visible ⊕ OPT button
  // (added iter 181) is the recommended path for mobile users (no shift/ctrl
  // available on touch).
  const handleClick = (e: React.MouseEvent) => {
    if (mixedMode && onToggleOptional && (e.shiftKey || e.ctrlKey)) {
      e.stopPropagation();
      onToggleOptional(memberIds);
      return;
    }
    onToggleTokens(memberIds);
  };

  // iter 181 (KI#56): suppress browser text selection when shift is pressed
  // during mousedown on the chip. The browser starts a text selection on
  // shift+mousedown BEFORE the click event fires — so calling preventDefault
  // in onClick is too late. preventDefault on mousedown stops the selection
  // before it starts, while still allowing the click event to fire normally.
  // We deliberately do NOT preventDefault on plain mousedown (would break
  // clicking input fields inside the chip, e.g. range inputs).
  // Ctrl+click doesn't need this — ctrl alone doesn't trigger text selection.
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mixedMode && e.shiftKey && onToggleOptional) {
      e.preventDefault();
    }
  };

  // iter 159: 3-state keyboard handler for MIXED mode.
  //  - shift+Enter / shift+Space / ctrl+Enter / ctrl+Space → opt (onToggleOptional).
  //  - plain Enter / plain Space → want (onToggleTokens).
  // Matches handleClick semantics for keyboard users (WCAG-compliant parity).
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (mixedMode && onToggleOptional && (e.shiftKey || e.ctrlKey)) {
      onToggleOptional(memberIds);
      return;
    }
    onToggleTokens(memberIds);
  };

  // iter 159: right-click → exclude (only in MIXED mode + when onToggleExclude is wired).
  // preventDefault suppresses the browser's context menu so the chip owns the
  // right-click gesture. In non-MIXED mode, right-click falls through to the
  // browser context menu (no behaviour change for pre-iter-159 callers).
  // Mobile: long-press on touch devices fires `contextmenu` — so right-click
  // == long-press == EXCLUDE on mobile.
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!mixedMode || !onToggleExclude) return;
    e.preventDefault();
    e.stopPropagation();
    onToggleExclude(memberIds);
  };

  // iter 181 (KI#56): OPT toggle button click handler.
  // stopPropagation so clicking ⊕ does NOT also trigger the chip's main
  // onClick (which would toggle WANT). The ⊕ is a sibling button, not a
  // child of the role="switch" div — same pattern as the existing ✗ exclude
  // button + ⭐ pin button. Visible only in MIXED mode (when onToggleOptional
  // is wired) as a mobile-friendly alternative to shift/ctrl+click.
  const handleOptClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleOptional?.(memberIds);
  }, [onToggleOptional, memberIds]);


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
  // iter 159: OPT state — only meaningful when mixedMode is true. Used by
  // downstream range-input rendering logic to also show inputs for OPT chips
  // (so the user can adjust thresholds for optional tokens, same as MUST).
  const isOptional = mixedMode && (selectionState === 'full-optional' || selectionState === 'partial-optional');
  // Effective "selected" for range-input rendering: WANT or OPT (both have
  // user-defined numeric constraints). Excluded chips don't show range inputs.
  const isSelectedForRanges = isSelected || isOptional;

  // Check if any member token was collapsed by the optimizer
  const isCollapsed = useMemo(() => {
    if (!collapsedTokenIds || collapsedTokenIds.size === 0) return false;
    return memberIds.some(id => collapsedTokenIds.has(id));
  }, [memberIds, collapsedTokenIds]);

  // Phase 5 (iter 136): is this family group favorited (pinned)?
  // A chip is "pinned" when ANY member token is in pinnedIds. We treat the
  // whole family as pinned/unpinned together — matches the family-level
  // toggle pattern (onToggleTokens / onToggleExclude).
  const isPinned = useMemo(() => {
    if (!pinnedIds || pinnedIds.size === 0) return false;
    return memberIds.some(id => pinnedIds.has(id));
  }, [memberIds, pinnedIds]);

  // Phase 5 (iter 136): ⭐ pin toggle handler.
  // stopPropagation so clicking ⭐ does NOT also trigger the chip's main
  // onClick (which would toggle selection). The ⭐ is a sibling button, not
  // a child of the role="switch" div, so technically clicks don't bubble —
  // but defensive stopPropagation keeps the boundary clean if the DOM
  // structure changes later.
  const handlePinClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePinned?.(memberIds);
  }, [onTogglePinned, memberIds]);

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
  // iter 159: added 'full-optional' / 'partial-optional' states for MIXED-mode
  // 3-state chip. OPT state is visually distinct: amber-tinted bg + amber-dim
  // left border (bronze) so the user can scan MUST vs OPT vs EXCLUDE at a
  // glance. The dashed border style is applied via the `chip-opt` CSS class
  // (defined in src/index.css) — keeps the JSX clean and lets future visual
  // tweaks be CSS-only.
  let bgClass: string;
  const tierOpacity = group.priorityTier === 'S' ? '' : group.priorityTier === 'C' ? 'opacity-80' : '';
  if (selectionState === 'full') {
    bgClass = `bg-chip-active ${effectiveBorderClass} text-bright ${tierOpacity}`;
  } else if (selectionState === 'partial') {
    bgClass = `bg-section-blue ${effectiveBorderClass} text-soft ${tierOpacity}`;
  } else if (selectionState === 'excluded') {
    bgClass = `bg-indicator-red border-l-bl-red text-bright ${tierOpacity}`;
  } else if (selectionState === 'partial-excluded') {
    bgClass = `bg-section-blue border-l-bl-red text-soft ${tierOpacity}`;
  } else if (selectionState === 'full-optional') {
    // OPT (full): amber-tinted bg + amber-dim dashed border + brighter text
    bgClass = `bg-amber-900/30 border-l-bl-amber-dim text-bright chip-opt ${tierOpacity}`;
  } else if (selectionState === 'partial-optional') {
    // OPT (partial): same family, dimmer text
    bgClass = `bg-amber-900/20 border-l-bl-amber-dim text-soft chip-opt ${tierOpacity}`;
  } else {
    bgClass = `bg-chip ${effectiveBorderClass} text-soft hover:bg-chip-hover ${tierOpacity}`;
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
  // iter 159: extended to surface OPT state ('chip.optional' / 'chip.partial_optional').
  const ariaLabel = useMemo(() => {
    const stateText =
      selectionState === 'full' ? t('chip.selected')
      : selectionState === 'partial' ? t('chip.partial')
      : selectionState === 'excluded' ? t('chip.excluded')
      : selectionState === 'partial-excluded' ? t('chip.partial_excluded')
      : selectionState === 'full-optional' ? t('chip.optional')
      : selectionState === 'partial-optional' ? t('chip.partial_optional')
      : t('chip.unselected');
    const parts = [displayText, stateText];
    if (tierCount > 1) parts.push(`${tierCount} ${t('chip.levels')}`);
    if (rangeText) parts.push(`${t('chip.range')} ${rangeText}`);
    return parts.join(', ');
  }, [displayText, selectionState, tierCount, rangeText]);

  return (
    <div
      // Phase 4 (iter 137): compact density — px-2.5 py-1.5 text-[13px] →
      // px-1.5 py-0.5 text-[12px] (~25% reduction in chip height on desktop).
      // The `.filter-chip` CSS class token (defined in src/index.css) provides
      // a min-height floor of 22px on desktop + 32px on mobile (touch target
      // a11y per UI_REFACTOR_PLAN.md §4 Phase 4 risk register mitigation).
      // Inline badges (⚡ ⚓ 2x ×N) shrink from text-[12px] → text-[10px] for
      // proportional visual density.
      // iter 159: in MIXED mode, right-click on this outer div toggles exclude.
      className={`filter-chip inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] border-l-2 transition-[background-color,border-color,color,opacity] duration-150 ease-in-out ${bgClass}${hasRanges && isSelectedForRanges ? ' chip-with-range' : ''}`}
      style={{ maxWidth: '100%', overflowWrap: 'break-word' }}
      title={tooltip}
      data-family-key={group.familyKey}
      onContextMenu={handleContextMenu}
    >
      {/* Phase 5 (iter 136): ⭐ pin/unpin icon button (left of label).
          Rendered only when BOTH `pinnedIds` AND `onTogglePinned` are provided
          — backward compat: legacy callers (tests, future use) without
          wiring render the chip without the ⭐ icon (pre-Phase-5 behaviour).
          Visual: ★ filled (text-accent-amber-soft) when isPinned;
          ★ outline (text-muted) when not pinned.
          SIBLING of the role="switch" div — valid ARIA tree (button + switch
          are both interactive; they don't nest). */}
      {pinnedIds && onTogglePinned && (
        <button
          type="button"
          onClick={handlePinClick}
          className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[13px] transition-colors ${
            isPinned
              ? 'text-accent-amber-soft hover:text-accent-amber'
              : 'text-muted hover:text-accent-amber-soft'
          }`}
          title={isPinned ? t('chip.unpin_tooltip') : t('chip.pin_tooltip')}
          aria-label={isPinned ? t('chip.unpin_aria') : t('chip.pin_aria')}
          aria-pressed={isPinned}
        >
          {isPinned ? '★' : '☆'}
        </button>
      )}
      {/* Switch element: just the label + badges, clickable */}
      <div
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        role="switch"
        aria-checked={selectionState === 'full' ? 'true' : selectionState === 'partial' ? 'mixed' : selectionState === 'excluded' ? 'true' : selectionState === 'partial-excluded' ? 'mixed' : selectionState === 'full-optional' ? 'true' : selectionState === 'partial-optional' ? 'mixed' : 'false'}
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 cursor-pointer leading-tight min-w-0 overflow-hidden"
      >
        <span>{displayText}</span>
        {isCollapsed && isSelected && (
          <span className="text-[10px] text-accent-amber-soft shrink-0" title={t('chip.optimizer_collapsed')} aria-label={t('chip.optimizer_collapsed')}>
            ⚡
          </span>
        )}
        {hasPrefix && isSelected && (
          <span className="text-[10px] text-accent-blue-soft shrink-0" title={`Prefix: "${prefix}" — anchors number to this mod line`} aria-hidden="true">
            ⚓
          </span>
        )}
        {group.hasMultiPlaceholder && (
          <span className="text-[10px] text-accent-amber-mid shrink-0 font-semibold" title={t('chip.dual_number_tooltip')} aria-label={t('chip.dual_number')}>
            2x
          </span>
        )}
        {/* iter 70: text-dim → text-muted for better contrast on range & tier counts */}
        {tierCount > 1 && (
          <span className="text-[10px] text-muted shrink-0" aria-hidden="true">
            &times;{tierCount}
          </span>
        )}
        {rangeText && !isSelected && !isExcluded && (
          <span className="text-[10px] text-muted shrink-0" aria-hidden="true">
            ({rangeText})
          </span>
        )}
      </div>
      {/* iter 181 (KI#56): Per-mod OPT toggle button — ⊕ / ⊖.
          Rendered ONLY in MIXED mode (when `onToggleOptional` is wired) as a
          mobile-friendly alternative to shift+click / ctrl+click. Touch devices
          have no shift/ctrl key, so without this button mobile users would
          have no way to mark an affix as OPT (only EXCLUDE via long-press).
          Visual: ⊕ (circled plus, "add to opt set") when not optional; ⊖
          (circled minus, "remove from opt set") when optional. Amber-tinted
          to match the OPT state's amber dashed border.
          SIBLING of the role="switch" div — valid ARIA tree (button + switch
          are both interactive; they don't nest). Same pattern as ⭐ and ✗. */}
      {mixedMode && onToggleOptional && (
        <button
          type="button"
          onClick={handleOptClick}
          className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[12px] font-bold transition-colors ${
            isOptional
              ? 'bg-amber-700/60 text-bright hover:bg-amber-600/70'
              : 'bg-raised text-muted hover:bg-chip-hover hover:text-accent-amber-soft'
          }`}
          title={isOptional ? t('chip.unopt_tooltip') : t('chip.opt_tooltip')}
          aria-label={isOptional ? t('chip.unopt_aria') : t('chip.opt_aria')}
          aria-pressed={isOptional}
        >
          {isOptional ? '⊖' : '⊕'}
        </button>
      )}
      {/* Per-mod exclude toggle button — small ✗/✓ */}
      {onToggleExclude && (
        <button
          onClick={handleExcludeClick}
          className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[12px] font-bold transition-colors ${
            isExcluded
              ? 'bg-btn-danger text-bright hover:bg-red-500'
              : 'bg-raised text-muted hover:bg-chip-hover hover:text-accent-red'
          }`}
          title={isExcluded ? t('chip.unexclude_tooltip') : t('chip.exclude_tooltip')}
          aria-label={isExcluded ? t('chip.unexclude_aria') : t('chip.exclude_aria')}
        >
          {isExcluded ? '✓' : '✗'}
        </button>
      )}
      {/* Per-chip numeric range inputs — SIBLINGS of switch, not children — valid ARIA tree.
          iter 159: shown for both WANT (isSelected) and OPT (isOptional) chips
          so the user can adjust thresholds for optional tokens too. */}
      {hasRanges && isSelectedForRanges && onSetTokenRange && !group.hasMultiPlaceholder && (
        <div className="flex items-center gap-1 text-[13px]" onClick={stopPropagation}>
          <span className="text-dim">&ge;</span>
          <input
            min={0}
            step={1}
            placeholder={t('range.min')}
            aria-label={t('range.min_aria')}
            className="w-16 px-1.5 py-1 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
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
          <span className="text-dim">&le;</span>
          <input
            min={0}
            step={1}
            placeholder={t('range.max')}
            aria-label={t('range.max_aria')}
            className="w-16 px-1.5 py-1 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
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
      {/* Dual-number: separate range inputs for each slot — SIBLINGS of switch.
          iter 159: shown for both WANT (isSelected) and OPT (isOptional) chips. */}
      {hasRanges && isSelectedForRanges && onSetTokenRange && group.hasMultiPlaceholder && (
        <div className="flex flex-col gap-0.5 text-[13px]" onClick={stopPropagation}>
          {/* Slot 0 row */}
          <div className="flex items-center gap-1">
            <span className="text-[12px] text-accent-blue-mid font-semibold shrink-0 w-5">1е</span>
            <span className="text-dim">&ge;</span>
            <input
              min={0}
              step={1}
              placeholder={t('range.min')}
              aria-label={t('range.min_aria_dual_1')}
              className="w-14 px-1 py-0.5 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
              type="number"
              value={slot0Range.min}
              onChange={handleSlot0MinChange}
            />
            <span className="text-dim">&le;</span>
            <input
              min={0}
              step={1}
              placeholder={t('range.max')}
              aria-label={t('range.max_aria_dual_1')}
              className="w-14 px-1 py-0.5 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
              type="number"
              value={slot0Range.max}
              onChange={handleSlot0MaxChange}
            />
          </div>
          {/* Slot 1 row */}
          <div className="flex items-center gap-1">
            <span className="text-[12px] text-accent-orange-mid font-semibold shrink-0 w-5">2е</span>
            <span className="text-dim">&ge;</span>
            <input
              min={0}
              step={1}
              placeholder={t('range.min')}
              aria-label={t('range.min_aria_dual_2')}
              className="w-14 px-1 py-0.5 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
              type="number"
              value={slot1Range.min}
              onChange={handleSlot1MinChange}
            />
            <span className="text-dim">&le;</span>
            <input
              min={0}
              step={1}
              placeholder={t('range.max')}
              aria-label={t('range.max_aria_dual_2')}
              className="w-14 px-1 py-0.5 bg-surface border border-edge rounded text-[13px] text-bright placeholder-ghost-alt focus:outline-none focus:border-accent-amber"
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
