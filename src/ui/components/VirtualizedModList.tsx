/**
 * VirtualizedModList — Virtualized two-column mod list for large categories.
 *
 * Uses @tanstack/react-virtual to render only visible sub-groups,
 * significantly reducing DOM nodes for categories with 200+ tokens
 * (belt: 298, ring: 366, amulet: 427, jewel: 235).
 *
 * Layout v5: Two-column layout (Prefix | Suffix) with independent
 * virtualizers per column. Both virtualizers share the same scroll
 * container (<main id="main-content">), so scrolling is natural.
 *
 * When both prefix and suffix exist and no affix filter is applied,
 * columns render side by side in a CSS grid (2fr | 3fr).
 * When an affix filter narrows to one type, or only one affix type
 * exists, a single full-width column is used.
 *
 * Each column's virtualizer uses normal flow positioning (padding-top/
 * padding-bottom spacers). Dynamic row measurement is handled by the
 * `measureElement` ref + ResizeObserver (TanStack Virtual built-in);
 * no manual `virtualizer.measure()` calls are made (iter 120 — see
 * STATUS.md Known Issue #6 for the root-cause analysis of the previous
 * jump-to-top / jitter bugs that manual measure() caused).
 */
import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GameToken, AffixType, ModOrigin, FamilyGroup, SortMode } from '@shared/types';
import { groupTokensByFamily, splitGroupByOrigin, countUniqueFamilyKeys } from '@shared/family-grouper';
import { classifyGroups, classifyJewelType, type ModGroupMode, type ModSubGroup, type JewelTypeCategory, JEWEL_TYPE_LABELS } from '@shared/mod-classifier';
import { ORIGIN_SECTION_LABELS } from '@shared/mod-classifier';
import { FilterChip } from './FilterChip';
import { GroupHeader } from './GroupHeader';
import { t } from '@shared/i18n';
// iter 139 (KI#18): CHIP_PREVIEW_COUNT import removed — Phase 2.5 chip
// truncation was reverted. The constant stays in `@shared/constants` for
// backward compat but is no longer consumed by this component.
import type { TokenRangeOverride } from '@store/filter-store';

interface VirtualizedModListProps {
  tokens: GameToken[];
  selectedIds: Set<string>;
  /** Set of excluded ("don't want") token IDs */
  excludedIds?: Set<string>;
  searchText: string;
  affixFilter: AffixType | null;
  originFilter: ModOrigin | null;
  onToggleTokens: (ids: string[]) => void;
  /** Toggle a family group to excluded state */
  onToggleExclude?: (ids: string[]) => void;
  onSearchChange: (text: string) => void;
  onAffixFilterChange: (filter: AffixType | null) => void;
  onOriginFilterChange: (filter: ModOrigin | null) => void;
  onClearSelections: () => void;
  groupMode?: ModGroupMode;
  showOriginSubSections?: boolean;
  /** Show jewel type sub-headers (Рубин/Изумруд/Сапфир/Общие) inside origin sections */
  showJewelTypeSubGroups?: boolean;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  /** Set of token IDs whose individual regex was collapsed by the optimizer */
  collapsedTokenIds?: Set<string>;
  /** Item category for priority tier classification (e.g., 'ring', 'belt') */
  category?: string;
  /**
   * Within-block sort mode (iter 106 P4). Defaults to 'alpha' (iter 99 behaviour).
   *  - 'alpha'      : familyKey primary, priorityTier tiebreaker.
   *  - 'tier-first' : priorityTier (S→A→B→C) primary, familyKey tiebreaker.
   * Forwarded to `classifyGroups()` via `buildColumnRows()` → `withSortedGroups()`.
   */
  sortMode?: SortMode;

  // ─── Phase 2 (iter 133): collapsible affix groups + sticky search ─────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 2 for full spec.
  // When `collapsedGroups` / `expandedSubGroups` are NOT provided (e.g. tests,
  // legacy callers), collapse UI is suppressed and groups render as before
  // (all expanded). This keeps the component backward-compatible.

  /** Top-level group keys currently COLLAPSED. Format: `${categoryId}:${affix}`. */
  collapsedGroups?: Set<string>;
  /** Sub-group keys currently EXPANDED. Format: `${categoryId}:${affix}:${subBlockKey}`. */
  expandedSubGroups?: Set<string>;
  /** Toggle a top-level group's collapsed state. */
  onToggleGroupCollapsed?: (key: string) => void;
  /** Toggle a sub-group's expanded state. */
  onToggleSubGroupExpanded?: (key: string) => void;
  /** Expand all top-level groups. */
  onExpandAllGroups?: () => void;
  /** Collapse all top-level groups. */
  onCollapseAllGroups?: (keys: string[]) => void;
  /** Expand all sub-groups. */
  onExpandAllSubGroups?: (keys: string[]) => void;
  /** Collapse all sub-groups. */
  onCollapseAllSubGroups?: () => void;

  // ─── Phase 2.5 (iter 134): per-sub-group «+N ещё» chip expander ────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 2.5 for full spec.
  // Same backward-compat pattern as Phase 2 — when absent, all chips render
  // unconditionally inside an expanded sub-group (pre-Phase-2.5 behaviour).

  /** Sub-group keys whose chips are fully expanded (Phase 2.5). */
  chipExpandState?: Set<string>;
  /** Toggle a sub-group's chip-expanded state. */
  onToggleChipExpand?: (key: string) => void;
  /** Phase 5 favorites — pinned token IDs (forward-compatible). */
  pinnedIds?: Set<string>;
  /** Phase 5 (iter 136): forwarded to VirtualizedColumn → FilterChip. */
  onTogglePinned?: (ids: string[]) => void;

  // ─── iter 159: MIXED-mode 3-state chip (want / opt / exclude) ────────────────
  // Forwarded to FilterChip via VirtualRowContent / VirtualizedColumn.
  // When `mixedMode` is true, FilterChip enables shift+click=opt,
  // right-click=exclude. When false (default), chip behaves as before.
  /** Optional ("opt") token IDs — only meaningful in MIXED mode. */
  optionalIds?: Set<string>;
  /** Toggle a family group to optional state (MIXED mode shift+click). */
  onToggleOptional?: (ids: string[]) => void;
  /** When true, enables 3-state chip behaviour (MIXED search-logic mode). */
  mixedMode?: boolean;

  // ─── Phase 3 (iter 135): show-selected-only mode ───────────────────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 3 for full spec.
  // Same backward-compat pattern — when absent, all familyGroups pass through
  // unchanged (pre-Phase-3 behaviour).

  /** When true, hide non-selected chips in the mod list.
   *  Pinned/excluded tokens stay visible. Default false. */
  showSelectedOnly?: boolean;
}

/** A flat virtual row for the virtualizer.
 *
 *  iter 133 (Phase 2): added `topKey` / `subKey` fields on header rows so the
 *  `VirtualRowContent` can render a GroupHeader with the correct collapse key
 *  and toggle callback. Rows are filtered in `buildColumnRows` based on
 *  collapse state: when a top-level group is collapsed, only its `column-header`
 *  row is emitted (origin/subgroup rows skipped). When a sub-group is collapsed
 *  (not in `expandedSubGroups`), only its `subgroup-header` row is emitted
 *  (chips skipped). */
type VirtualRow =
  | { type: 'column-header'; affix: AffixType; count: number; topKey?: string; isCollapsed?: boolean }
  | { type: 'origin-header'; origin: ModOrigin; label: string; colorClass: string; bgClass: string; borderClass: string; borderLClass: string; count: number; iconPath?: string }
  | { type: 'jewel-type-header'; jewelType: JewelTypeCategory; label: string; colorClass: string; bgClass: string; borderClass: string; count: number }
  | { type: 'subgroup'; subGroup: ModSubGroup; affix: AffixType; subKey?: string; isSubExpanded?: boolean }
  | { type: 'subgroup-header'; subGroup: ModSubGroup; affix: AffixType; subKey: string; isSubExpanded: false };

const ORIGIN_ORDER: ModOrigin[] = ['normal', 'desecrated', 'corrupted', 'essence', 'breachborn'];

/** Order for jewel type sub-headers within origin sections */
const JEWEL_TYPE_ORDER: JewelTypeCategory[] = ['ruby', 'emerald', 'sapphire', 'shared'];

/** Estimated heights for virtualizer (will be dynamically measured).
 *  iter 120: subgroup lowered from 120 → 60 (closer to actual average for
 *  typical 1–3 chip subgroups without range inputs). High estimates caused
 *  jitter during scroll because totalSize shrank when ResizeObserver fired
 *  with actual sizes much smaller than the estimate.
 *  iter 133 (Phase 2): added `subgroup-header` row variant (header-only when
 *  collapsed — same height as jewel-type-header since visually similar).
 *  iter 144 (KI#23 variant b): `subgroup` estimate is now per-row-state —
 *  see `estimateSubgroupHeight()` below. The static 60px value is kept as
 *  a fallback when row state can't be determined (legacy callers without
 *  selectedIds/perTokenRanges wiring). */
const ROW_ESTIMATES: Record<VirtualRow['type'], number> = {
  'column-header': 44,
  'origin-header': 36,
  'jewel-type-header': 30,
  'subgroup': 60, // typical 1–3 chips: ~40–80px; selected with range: ~100–120px
  'subgroup-header': 30, // header-only (collapsed sub-group): similar to jewel-type-header
};

/**
 * iter 144 (KI#23 variant b): per-row-state height estimate for `subgroup`
 * rows. Reduces scroll jitter by returning an estimate closer to the actual
 * measured height — TanStack Virtual's ResizeObserver still fires to update
 * the measurement, but the gap between estimate and actual is smaller, so
 * the visible rows don't jump as much when totalSize is recomputed.
 *
 * Heuristics (matching actual chip rendering behaviour in FilterChip):
 *   - Selected + range inputs visible (~110px actual): 110
 *   - Selected (no range inputs visible) (~80px actual): 80
 *   - 4+ chips (wrap to 2 lines) (~80px actual): 80
 *   - Default (1–3 chips, none selected) (~60px actual): 60
 *
 * The "selected" check looks at ANY member of ANY family in the sub-group
 * (matches FilterChip's `selectionState === 'full' || 'partial'` logic).
 * The "range" check looks at perTokenRanges entries for any family's first
 * ranged member (matches FilterChip's range input rendering condition).
 *
 * Note: this is just an ESTIMATE — the actual height is measured by
 * ResizeObserver. A wrong estimate doesn't break rendering, just causes
 * minor jitter until the measurement settles.
 *
 * Exported for unit testing (tests/ui/KI23EstimateSize.test.ts).
 *
 * @param row - The `subgroup` VirtualRow to estimate.
 * @param selectedIds - Currently selected token IDs (from filter-store).
 * @param perTokenRanges - Per-token range overrides (from filter-store).
 * @returns Estimated pixel height for the row.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function estimateSubgroupHeight(
  row: Extract<VirtualRow, { type: 'subgroup' }>,
  selectedIds: Set<string>,
  perTokenRanges: Record<string, TokenRangeOverride>,
): number {
  const families = row.subGroup.groups;
  if (families.length === 0) return ROW_ESTIMATES.subgroup;

  let anySelected = false;
  let anyRange = false;
  let totalMembers = 0;

  for (const family of families) {
    totalMembers += family.members.length;
    // Check selection: any member in selectedIds?
    for (const member of family.members) {
      if (selectedIds.has(member.id)) {
        anySelected = true;
        break;
      }
    }
    // Check range inputs: FilterChip renders range inputs when the family
    // has rangeSlots AND is selected (full or partial). We approximate by
    // checking if perTokenRanges has an entry for any member — that's the
    // condition for showing non-empty range inputs.
    if (!anyRange) {
      for (const member of family.members) {
        if (perTokenRanges[member.id] !== undefined) {
          const override = perTokenRanges[member.id];
          if (override.min !== undefined || override.max !== undefined) {
            anyRange = true;
            break;
          }
        }
      }
    }
    // Early exit if both flags are set — no need to scan remaining families.
    if (anySelected && anyRange) break;
  }

  if (anySelected && anyRange) return 110;
  if (anySelected) return 80;
  if (totalMembers > 3) return 80; // 4+ chips likely wrap to 2 lines
  return ROW_ESTIMATES.subgroup; // 60 — default 1–3 chips, none selected
}

/**
 * Find the nearest scrollable ancestor element.
 * Walks up the DOM tree from the given element, checking computed overflow.
 */
function findScrollableParent(el: HTMLElement | null): HTMLElement | null {
  let current = el;
  while (current) {
    if (current.id === 'main-content') return current;
    const style = getComputedStyle(current);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Build flat row list for a single affix column.
 *
 * iter 106 (P4): `sortMode` forwarded to every `classifyGroups()` call so the
 * UI toggle propagates through origin-split sub-sections and jewel-type
 * sub-sections as well.
 *
 * iter 133 (Phase 2): `topKey` + `collapsedGroups` + `expandedSubGroups`
 * drive row filtering:
 *   - When the top-level group is COLLAPSED (topKey in collapsedGroups), only
 *     the `column-header` row is emitted — origin/subgroup rows are skipped.
 *     The column-header carries `topKey` + `isCollapsed=true` so VirtualRowContent
 *     can render a GroupHeader with chevron.
 *   - When a sub-group is COLLAPSED (subKey NOT in expandedSubGroups), a
 *     `subgroup-header` row is emitted instead of a full `subgroup` row — chips
 *     are NOT rendered. The header carries `subKey` + `isSubExpanded=false`.
 *   - When collapse wiring is absent (legacy callers), all groups render as
 *     expanded (preserves pre-Phase-2 behaviour).
 */
function buildColumnRows(
  affix: AffixType,
  groups: FamilyGroup[],
  subGroups: ModSubGroup[],
  groupMode: ModGroupMode,
  showOriginSubSections: boolean,
  showJewelTypeSubGroups: boolean,
  sortMode: SortMode = 'alpha',
  // Phase 2 (iter 133) — all optional, backward-compatible when absent
  topKey?: string,
  collapsedGroups?: Set<string>,
  expandedSubGroups?: Set<string>,
): VirtualRow[] {
  const rows: VirtualRow[] = [];
  if (groups.length === 0) return rows;

  // Phase 2 (iter 133): if top-level group is collapsed, emit ONLY the
  // column-header row. The chevron in the GroupHeader lets the user expand
  // back. When collapse wiring is absent (legacy), isTopCollapsed stays false.
  const isTopCollapsed = !!(topKey && collapsedGroups && collapsedGroups.has(topKey));

  // Column header — always emitted. When collapse wiring is present, carries
  // `topKey` + `isCollapsed` so VirtualRowContent renders a GroupHeader.
  rows.push({
    type: 'column-header',
    affix,
    count: groups.length,
    topKey,
    isCollapsed: topKey ? isTopCollapsed : undefined,
  });

  // If the top-level group is collapsed, skip all sub-rows.
  if (isTopCollapsed) return rows;

  // Helper: emit a sub-group row, choosing between `subgroup` (expanded) or
  // `subgroup-header` (collapsed, header-only). When collapse wiring is absent,
  // always emits full `subgroup` (legacy behaviour).
  //
  // iter 144 (KI#32 — cascade expand fix): `origin` and `jewelType` are now
  // part of the sub-group key when `showOriginSubSections` (or
  // `showJewelTypeSubGroups`) is active. Previously the sub-group key was
  // `${topKey}:${sg.key}` (e.g., `ring:prefix:skill-levels`) — identical
  // across origin sections (normal/corrupted/desecrated). Toggling one
  // sub-group expanded ALL sub-groups with the same key in every origin
  // section. We now build `${topKey}:${origin}:${jewelType}:${sg.key}` so
  // each (origin, jewel-type, block) tuple gets a unique expand/collapse
  // state. Old URL `es=ring:prefix:skill-levels` keys silently stop matching
  // (per Q3 user feedback: silent reset acceptable — no migration).
  const emitSubGroup = (sg: ModSubGroup, origin?: ModOrigin, jewelType?: JewelTypeCategory) => {
    const contextSegment = [
      origin ?? '',
      jewelType ?? '',
    ].filter(Boolean).join(':');
    const subKey = topKey
      ? (contextSegment ? `${topKey}:${contextSegment}:${sg.key}` : `${topKey}:${sg.key}`)
      : undefined;
    if (subKey && expandedSubGroups) {
      const isExpanded = expandedSubGroups.has(subKey);
      if (isExpanded) {
        rows.push({ type: 'subgroup', subGroup: sg, affix, subKey, isSubExpanded: true });
      } else {
        // Collapsed sub-group: emit header-only row (no chips).
        rows.push({ type: 'subgroup-header', subGroup: sg, affix, subKey, isSubExpanded: false });
      }
    } else {
      // Legacy path (no collapse wiring) — always full row.
      rows.push({ type: 'subgroup', subGroup: sg, affix });
    }
  };

  if (showOriginSubSections) {
    const byOrigin = new Map<ModOrigin, FamilyGroup[]>();
    for (const group of groups) {
      const splits = splitGroupByOrigin(group);
      for (const { origin, group: splitGroup } of splits) {
        const list = byOrigin.get(origin) || [];
        list.push(splitGroup);
        byOrigin.set(origin, list);
      }
    }

    for (const origin of ORIGIN_ORDER) {
      const originGroups = byOrigin.get(origin);
      if (!originGroups || originGroups.length === 0) continue;

      const labelConfig = ORIGIN_SECTION_LABELS[origin];
      const originSubGroups = classifyGroups(originGroups, groupMode, sortMode);
      const sectionCount = originSubGroups.reduce((s, sg) => s + sg.groups.length, 0);

      // Origin section header (skip for normal-only — already implied by column header)
      if (origin !== 'normal' || byOrigin.size > 1) {
        rows.push({
          type: 'origin-header',
          origin,
          label: labelConfig?.label ?? t('origin.' + origin),
          colorClass: labelConfig?.colorClass ?? 'text-muted',
          bgClass: labelConfig?.bgClass ?? '',
          borderClass: labelConfig?.borderClass ?? '',
          borderLClass: labelConfig?.borderLClass ?? '',
          count: sectionCount,
          iconPath: labelConfig?.iconPath,
        });
      }

      if (showJewelTypeSubGroups) {
        const byJewelType = new Map<JewelTypeCategory, FamilyGroup[]>();
        for (const group of originGroups) {
          const jewelType = classifyJewelType(group);
          const list = byJewelType.get(jewelType) || [];
          list.push(group);
          byJewelType.set(jewelType, list);
        }

        for (const jewelType of JEWEL_TYPE_ORDER) {
          const jtGroups = byJewelType.get(jewelType);
          if (!jtGroups || jtGroups.length === 0) continue;

          const jtLabelConfig = JEWEL_TYPE_LABELS[jewelType];
          rows.push({
            type: 'jewel-type-header',
            jewelType,
            label: jtLabelConfig.label,
            colorClass: jtLabelConfig.colorClass,
            bgClass: jtLabelConfig.bgClass,
            borderClass: jtLabelConfig.borderClass,
            count: jtGroups.length,
          });

          const jtSubGroups = classifyGroups(jtGroups, groupMode, sortMode);
          for (const sg of jtSubGroups) {
            // iter 144 (KI#32): pass both origin and jewelType so subKey is unique.
            emitSubGroup(sg, origin, jewelType);
          }
        }
      } else {
        for (const sg of originSubGroups) {
          // iter 144 (KI#32): pass origin so subKey is unique per origin section.
          emitSubGroup(sg, origin);
        }
      }
    }
  } else {
    for (const sg of subGroups) {
      emitSubGroup(sg);
    }
  }

  return rows;
}

/**
 * Render a single virtual row's content (without positioning wrapper).
 * iter 107: `sortMode` forwarded to FilterChip for tier-aware left border.
 * iter 133 (Phase 2): `onToggleGroupCollapsed` + `onToggleSubGroupExpanded`
 * enable chevron clicks on column-header + subgroup-header rows. When the
 * callbacks are absent (legacy callers), headers render as static text —
 * preserving the pre-Phase-2 behaviour.
 * iter 134 (Phase 2.5): `onToggleChipExpand` + `chipExpandState` + `pinnedIds`
 * enable «+N ещё» truncation on `subgroup` rows. Same logic as
 * `ModSubGroupSection` in ModList.tsx — see that component for full comments.
 */
const VirtualRowContent: React.FC<{
  row: VirtualRow;
  selectedIds: Set<string>;
  excludedIds?: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  onToggleExclude?: (ids: string[]) => void;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  collapsedTokenIds?: Set<string>;
  /** iter 107: forwarded to FilterChip for tier-aware left border. */
  sortMode?: SortMode;
  /** iter 133 (Phase 2): toggle a top-level group's collapse state. */
  onToggleGroupCollapsed?: (key: string) => void;
  /** iter 133 (Phase 2): toggle a sub-group's expand state. */
  onToggleSubGroupExpanded?: (key: string) => void;
  /** iter 134 (Phase 2.5): toggle a sub-group's chip-expanded state. */
  onToggleChipExpand?: (key: string) => void;
  /** iter 134 (Phase 2.5): set of sub-group keys whose chips are FULLY expanded. */
  chipExpandState?: Set<string>;
  /** iter 134 (Phase 2.5): pinned token IDs — pinned chips always visible. */
  pinnedIds?: Set<string>;
  /** Phase 5 (iter 136): forwarded to FilterChip ⭐ icon button. */
  onTogglePinned?: (ids: string[]) => void;
  /** iter 159: MIXED-mode 3-state chip props — forwarded to FilterChip. */
  optionalIds?: Set<string>;
  onToggleOptional?: (ids: string[]) => void;
  mixedMode?: boolean;
}> = React.memo(({ row, selectedIds, excludedIds, onToggleTokens, onToggleExclude, perTokenRanges, onSetTokenRange, onClearTokenRange, collapsedTokenIds, sortMode, onToggleGroupCollapsed, onToggleSubGroupExpanded, pinnedIds, onTogglePinned, optionalIds, onToggleOptional, mixedMode }) => {
  // iter 139 (KI#18): `chipExpandState` / `onToggleChipExpand` props REMOVED
  // from the destructure list (they remain in the FC interface above for
  // backward compat with callers that still pass them, but the component no
  // longer reads them — Phase 2.5 truncation was reverted per user feedback).
  if (row.type === 'column-header') {
    const isImplicit = row.affix === 'implicit';
    // Phase 4 (iter 137): `--strong` modifier (CSS ready from iter 137) — applied
    // via caller when sortMode='tier-first' per docs/UI_REFACTOR_PLAN.md §13.6
    // optional enhancement. iter 138 wires the modifier so the affix column
    // headers visually reinforce the sort-mode the user has chosen. When
    // sortMode='alpha' (default) or omitted, no modifier is added — preserves
    // pre-iter-138 behaviour (backward compat).
    const affixBase = isImplicit ? 'affix-header-implicit' : row.affix === 'prefix' ? 'affix-header-prefix' : 'affix-header-suffix';
    const strongClass = sortMode === 'tier-first' ? `${affixBase}--strong` : '';
    const accentClass = isImplicit ? 'text-accent-amber' : row.affix === 'prefix' ? 'text-accent-blue' : 'text-accent-orange';
    const headerClass = `${affixBase} ${strongClass} ${accentClass}`.replace(/\s+/g, ' ').trim();
    const affixLabel = isImplicit ? 'ИМПЛИСЕТ' : t('affix.' + row.affix);

    // Phase 2 (iter 133): render as GroupHeader when collapse wiring is present.
    if (row.topKey && onToggleGroupCollapsed) {
      return (
        <GroupHeader
          label={affixLabel}
          count={row.count}
          isCollapsed={!!row.isCollapsed}
          onToggle={() => onToggleGroupCollapsed(row.topKey!)}
          variant="top"
          className={headerClass}
          // Phase 4 (iter 137): show ⓘ tooltip on top-level affix column
          // headers explaining what each affix type means. Helps beginners.
          infoTooltip={
            row.affix === 'prefix' ? t('tooltip.prefix_explanation')
              : row.affix === 'suffix' ? t('tooltip.suffix_explanation')
              : t('tooltip.implicit_explanation')
          }
        />
      );
    }

    // Legacy path: static text.
    return (
      <div className={`text-base font-bold uppercase tracking-wider ${headerClass}`}>
        {affixLabel} ({row.count})
      </div>
    );
  }

  if (row.type === 'origin-header') {
    return (
      <div className={`block ml-2 mt-4 mb-2 text-[14px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border-l-2 ${row.bgClass} ${row.borderClass} ${row.borderLClass} ${row.colorClass} flex items-center gap-1.5`}>
        {row.iconPath && (
          <img
            src={`${import.meta.env.BASE_URL}${row.iconPath}`}
            alt=""
            width={17}
            height={17}
            className="shrink-0 object-contain"
          />
        )}
        <span>{row.label} ({row.count})</span>
      </div>
    );
  }

  if (row.type === 'jewel-type-header') {
    return (
      <div className={`block ml-4 mb-1.5 text-[12px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded ${row.bgClass} border ${row.borderClass} ${row.colorClass}`}>
        {row.label} ({row.count})
      </div>
    );
  }

  // Phase 2 (iter 133): subgroup-header row — header only, no chips.
  // Renders as a GroupHeader with chevron so the user can expand it.
  if (row.type === 'subgroup-header') {
    if (row.subGroup.label) {
      return (
        <div className="mb-2">
          <GroupHeader
            label={row.subGroup.label}
            count={row.subGroup.groups.length}
            isCollapsed={!row.isSubExpanded}
            onToggle={() => onToggleSubGroupExpanded?.(row.subKey)}
            variant="sub"
            className={`${row.subGroup.bgClass} border ${row.subGroup.borderClass} ${row.subGroup.colorClass}`}
          />
        </div>
      );
    }
    // No label — render as nothing (collapsed sub-group with no header).
    return null;
  }

  // subgroup (expanded) — render header (with collapse toggle when wired) + chips.
  // iter 139 (KI#18): REVERTED Phase 2.5 chip truncation logic. All chips in
  // an expanded sub-group now render unconditionally (no `+N ещё` button,
  // no `свернуть` button). `chipExpandState` / `onToggleChipExpand` props
  // remain in the API for backward compat but are now NO-OP. Mirrors the
  // same revert in ModList.tsx — both rendering paths stay in sync.
  const collapseWired = !!(row.subKey && onToggleSubGroupExpanded);
  const visibleChips: FamilyGroup[] = row.subGroup.groups;

  return (
    <div className="mb-2">
      {row.subGroup.label && (
        collapseWired ? (
          <GroupHeader
            label={row.subGroup.label}
            count={row.subGroup.groups.length}
            isCollapsed={false}
            onToggle={() => onToggleSubGroupExpanded!(row.subKey!)}
            variant="sub"
            className={`${row.subGroup.bgClass} border ${row.subGroup.borderClass} ${row.subGroup.colorClass}`}
          />
        ) : (
          <div className={`block ml-4 mb-1 text-[12px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded ${row.subGroup.bgClass} border ${row.subGroup.borderClass} ${row.subGroup.colorClass}`}>
            {row.subGroup.label} ({row.subGroup.groups.length})
          </div>
        )
      )}
      <div className="flex flex-wrap gap-2">
        {visibleChips.map((group) => (
          <FilterChip
            key={group.familyKey}
            group={group}
            selectedIds={selectedIds}
            excludedIds={excludedIds}
            onToggleTokens={onToggleTokens}
            onToggleExclude={onToggleExclude}
            perTokenRanges={perTokenRanges}
            onSetTokenRange={onSetTokenRange}
            onClearTokenRange={onClearTokenRange}
            collapsedTokenIds={collapsedTokenIds}
            sortMode={sortMode}
            pinnedIds={pinnedIds}
            onTogglePinned={onTogglePinned}
            optionalIds={optionalIds}
            onToggleOptional={onToggleOptional}
            mixedMode={mixedMode}
          />
        ))}
        {/* iter 139 (KI#18): «+N ещё» / «свернуть» buttons REMOVED —
            Phase 2.5 truncation reverted per user feedback. Same as ModList.tsx. */}
      </div>
    </div>
  );
});

VirtualRowContent.displayName = 'VirtualRowContent';

/** Props shared by VirtualizedColumn */
interface VirtualizedColumnProps {
  rows: VirtualRow[];
  scrollElement: HTMLElement | null;
  selectedIds: Set<string>;
  excludedIds?: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  onToggleExclude?: (ids: string[]) => void;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  collapsedTokenIds?: Set<string>;
  /** Border color class for left border (affix-specific) */
  borderClass: string;
  /** iter 107: forwarded to FilterChip via VirtualRowContent for tier-aware border. */
  sortMode?: SortMode;
  /** iter 133 (Phase 2): toggle a top-level group's collapse state. */
  onToggleGroupCollapsed?: (key: string) => void;
  /** iter 133 (Phase 2): toggle a sub-group's expand state. */
  onToggleSubGroupExpanded?: (key: string) => void;
  /** iter 134 (Phase 2.5): toggle a sub-group's chip-expanded state. */
  onToggleChipExpand?: (key: string) => void;
  /** iter 134 (Phase 2.5): set of sub-group keys whose chips are FULLY expanded. */
  chipExpandState?: Set<string>;
  /** iter 134 (Phase 2.5): pinned token IDs — pinned chips always visible. */
  pinnedIds?: Set<string>;
  /** Phase 5 (iter 136): forwarded to VirtualRowContent → FilterChip. */
  onTogglePinned?: (ids: string[]) => void;
  /** iter 159: MIXED-mode 3-state chip props — forwarded to VirtualRowContent. */
  optionalIds?: Set<string>;
  onToggleOptional?: (ids: string[]) => void;
  mixedMode?: boolean;
}

/** A single virtualized column (prefix or suffix) */
const VirtualizedColumn: React.FC<VirtualizedColumnProps> = ({
  rows,
  scrollElement,
  selectedIds,
  excludedIds,
  onToggleTokens,
  onToggleExclude,
  perTokenRanges,
  onSetTokenRange,
  onClearTokenRange,
  collapsedTokenIds,
  borderClass,
  sortMode,
  onToggleGroupCollapsed,
  onToggleSubGroupExpanded,
  onToggleChipExpand,
  chipExpandState,
  pinnedIds,
  onTogglePinned,
  optionalIds,
  onToggleOptional,
  mixedMode,
}) => {
  // TanStack Virtual's useVirtualizer returns non-memoizable functions
  // (getVirtualItems, scrollToIndex, etc.) which React Compiler cannot safely
  // memoize. This is a known library-level limitation, not our code — see
  // STATUS.md Known Issue #3 (closed iter 103).
  // iter 145 (KI#34 scroll doubling fix): stable `getItemKey` prevents
  // React from reusing DOM nodes for different row types (which corrupted
  // the measurement cache).
  // iter 147 (TS fix): `shouldAdjustScrollPositionOnItemSizeChange` was
  // removed — it does NOT exist in @tanstack/react-virtual v3 types and
  // caused 6 TS errors blocking deploy. Two-independent-virtualizers sharing
  // one scroll container: feedback loop is now mitigated by stable keys +
  // CSS `contain: layout style paint` (iter 146 KI#38) on virtual rows.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      const row = rows[index];
      if (!row) return 40;
      if (row.type === 'subgroup') {
        return estimateSubgroupHeight(row, selectedIds, perTokenRanges ?? {});
      }
      return ROW_ESTIMATES[row.type];
    },
    overscan: 5,
    getItemKey: (index) => {
      const row = rows[index];
      if (!row) return String(index);
      switch (row.type) {
        case 'column-header': return `ch:${row.affix}`;
        case 'origin-header': return `oh:${row.origin}`;
        case 'jewel-type-header': return `jh:${row.jewelType}`;
        case 'subgroup': return `sg:${row.affix}:${row.subKey ?? row.subGroup.key}`;
        case 'subgroup-header': return `sh:${row.affix}:${row.subKey}`;
        default: return String(index);
      }
    },
  });

  // iter 120: removed the entire useLayoutEffect block that called
  // virtualizer.measure() + restore() on every selection/range change.
  // That code was the cause of the "jump to top" bug on the jewel page and
  // jitter during scroll on several tabs. `measure()` invalidated the ENTIRE
  // measurement cache, so all rows reverted to estimate sizes (120px for
  // subgroup vs actual 40–80px) → paddingTop/paddingBottom drifted → visible
  // items shifted → scroll position effectively jumped.
  //
  // The correct behaviour is now achieved by relying on `measureElement` ref
  // + ResizeObserver for dynamic row measurement (TanStack Virtual built-in).
  // The browser itself preserves `scrollTop` when content above the viewport
  // doesn't change — no manual restore needed.
  //
  // See STATUS.md Known Issue #6 for full root-cause analysis.

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  let paddingTop = 0;
  let paddingBottom = 0;

  if (virtualItems.length > 0) {
    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];
    paddingTop = firstItem.start;
    paddingBottom = totalSize - lastItem.end;
  }

  if (rows.length === 0) return null;

  return (
    <div className={`flex flex-col min-w-0 border-l-2 pl-3 ${borderClass}`}>
      <div style={{ width: '100%' }}>
        {paddingTop > 0 && (
          <div style={{ height: paddingTop }} aria-hidden="true" />
        )}

        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index];
          if (!row) return null;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
            >
              <VirtualRowContent
                row={row}
                selectedIds={selectedIds}
                excludedIds={excludedIds}
                onToggleTokens={onToggleTokens}
                onToggleExclude={onToggleExclude}
                perTokenRanges={perTokenRanges}
                onSetTokenRange={onSetTokenRange}
                onClearTokenRange={onClearTokenRange}
                collapsedTokenIds={collapsedTokenIds}
                sortMode={sortMode}
                onToggleGroupCollapsed={onToggleGroupCollapsed}
                onToggleSubGroupExpanded={onToggleSubGroupExpanded}
                onToggleChipExpand={onToggleChipExpand}
                chipExpandState={chipExpandState}
                pinnedIds={pinnedIds}
                onTogglePinned={onTogglePinned}
                optionalIds={optionalIds}
                onToggleOptional={onToggleOptional}
                mixedMode={mixedMode}
              />
            </div>
          );
        })}

        {paddingBottom > 0 && (
          <div style={{ height: paddingBottom }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

export const VirtualizedModList: React.FC<VirtualizedModListProps> = ({
  tokens,
  selectedIds,
  excludedIds,
  searchText,
  affixFilter,
  originFilter,
  onToggleTokens,
  onToggleExclude,
  onSearchChange,
  onAffixFilterChange,
  onOriginFilterChange,
  onClearSelections,
  groupMode = 'affix-semantic',
  showOriginSubSections = false,
  showJewelTypeSubGroups = false,
  perTokenRanges,
  onSetTokenRange,
  onClearTokenRange,
  collapsedTokenIds,
  category,
  sortMode = 'alpha',
  // Phase 2 (iter 133): collapse state
  collapsedGroups,
  expandedSubGroups,
  onToggleGroupCollapsed,
  onToggleSubGroupExpanded,
  onExpandAllGroups,
  onCollapseAllGroups,
  onExpandAllSubGroups,
  onCollapseAllSubGroups,
  // Phase 2.5 (iter 134): per-sub-group chip expand state
  chipExpandState,
  onToggleChipExpand,
  pinnedIds,
  onTogglePinned,
  // iter 159: MIXED-mode 3-state chip props (forwarded to VirtualizedColumn).
  optionalIds,
  onToggleOptional,
  mixedMode = false,
  // Phase 3 (iter 135): show-selected-only mode
  showSelectedOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve the scroll element after mount
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setScrollElement(findScrollableParent(containerRef.current));
  }, []);

  // Get unique origins from tokens
  const availableOrigins = useMemo(() => {
    const origins = new Set<ModOrigin>();
    for (const token of tokens) {
      origins.add(token.origin);
    }
    return Array.from(origins).sort();
  }, [tokens]);

  // Filter tokens
  const filteredTokens = useMemo(() => {
    let result = tokens;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (t) =>
          t.rawText.ru.toLowerCase().includes(lower) ||
          t.regex.ru.toLowerCase().includes(lower)
      );
    }
    if (affixFilter) {
      result = result.filter((t) => t.affix === affixFilter);
    }
    if (originFilter) {
      result = result.filter((t) => t.origin === originFilter);
    }
    return result;
  }, [tokens, searchText, affixFilter, originFilter]);

  // Group and classify (with category for priority tier)
  const familyGroups = useMemo(
    () => groupTokensByFamily(filteredTokens, category),
    [filteredTokens, category]
  );

  // Phase 3 (iter 135): show-selected-only filter — same logic as ModList.tsx
  // (kept in sync deliberately). When true, only show family groups with at
  // least one selected/excluded/pinned member. Pinned/excluded tokens stay
  // visible so the user can un-exclude or re-select a favorited mod.
  const visibleGroups = useMemo(() => {
    if (!showSelectedOnly) return familyGroups;
    const effectiveExcluded = excludedIds ?? new Set<string>();
    const effectivePinned = pinnedIds ?? new Set<string>();
    return familyGroups.filter(g => {
      for (const m of g.members) {
        if (selectedIds.has(m.id)) return true;
        if (effectiveExcluded.has(m.id)) return true;
        if (effectivePinned.has(m.id)) return true;
      }
      return false;
    });
  }, [familyGroups, showSelectedOnly, selectedIds, excludedIds, pinnedIds]);

  const implicitGroups = useMemo(
    () => visibleGroups.filter((g) => g.affix === 'implicit'),
    [visibleGroups]
  );
  const prefixGroups = useMemo(
    () => visibleGroups.filter((g) => g.affix === 'prefix'),
    [visibleGroups]
  );
  const suffixGroups = useMemo(
    () => visibleGroups.filter((g) => g.affix === 'suffix'),
    [visibleGroups]
  );

  const implicitSubGroups = useMemo(
    () => classifyGroups(implicitGroups, groupMode, sortMode),
    [implicitGroups, groupMode, sortMode]
  );
  const prefixSubGroups = useMemo(
    () => classifyGroups(prefixGroups, groupMode, sortMode),
    [prefixGroups, groupMode, sortMode]
  );
  const suffixSubGroups = useMemo(
    () => classifyGroups(suffixGroups, groupMode, sortMode),
    [suffixGroups, groupMode, sortMode]
  );

  // Build separate row lists for each column.
  // iter 106 (P4): sortMode forwarded so the UI toggle propagates to all sub-groups.
  // iter 133 (Phase 2): topKey + collapsedGroups + expandedSubGroups forwarded
  // so buildColumnRows can filter rows by collapse state.
  const implicitTopKey = category ? `${category}:implicit` : undefined;
  const prefixTopKey = category ? `${category}:prefix` : undefined;
  const suffixTopKey = category ? `${category}:suffix` : undefined;

  const implicitRows = useMemo(
    () => buildColumnRows('implicit', implicitGroups, implicitSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode, implicitTopKey, collapsedGroups, expandedSubGroups),
    [implicitGroups, implicitSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode, implicitTopKey, collapsedGroups, expandedSubGroups]
  );
  const prefixRows = useMemo(
    () => buildColumnRows('prefix', prefixGroups, prefixSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode, prefixTopKey, collapsedGroups, expandedSubGroups),
    [prefixGroups, prefixSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode, prefixTopKey, collapsedGroups, expandedSubGroups]
  );
  const suffixRows = useMemo(
    () => buildColumnRows('suffix', suffixGroups, suffixSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode, suffixTopKey, collapsedGroups, expandedSubGroups),
    [suffixGroups, suffixSubGroups, groupMode, showOriginSubSections, showJewelTypeSubGroups, sortMode, suffixTopKey, collapsedGroups, expandedSubGroups]
  );

  const hasImplicit = implicitGroups.length > 0;
  // Determine layout: two columns when both affixes exist and no affix filter
  const hasBothAffixes = prefixRows.length > 0 && suffixRows.length > 0 && !affixFilter;

  const handleAffixFilter = useCallback(
    (value: string) => {
      onAffixFilterChange(value === 'all' ? null : (value as AffixType));
    },
    [onAffixFilterChange]
  );

  const handleOriginFilter = useCallback(
    (value: string) => {
      onOriginFilterChange(value === 'all' ? null : (value as ModOrigin));
    },
    [onOriginFilterChange]
  );

  // For single-column mode (affix filter applied or only one affix type),
  // merge all row lists and use a single virtualizer
  const mergedRows = useMemo(() => {
    if (hasBothAffixes) return []; // not used in two-column mode
    // When affixFilter is null (all types shown), include implicit at the top
    if (!affixFilter && hasImplicit) {
      return [...implicitRows, ...prefixRows, ...suffixRows];
    }
    return [...prefixRows, ...suffixRows];
  }, [hasBothAffixes, implicitRows, prefixRows, suffixRows, affixFilter, hasImplicit]);

  // Single-column virtualizer for when affix filter is applied
  // (Same TanStack library limitation as above — see STATUS.md Known Issue #3.)
  // iter 145 (KI#34): stable `getItemKey` (same fix as two-column virtualizer).
  // iter 147 (TS fix): `shouldAdjustScrollPositionOnItemSizeChange` removed
  // (not in @tanstack/react-virtual v3 types — was blocking deploy).
  // eslint-disable-next-line react-hooks/incompatible-library
  const singleVirtualizer = useVirtualizer({
    count: mergedRows.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      const row = mergedRows[index];
      if (!row) return 40;
      if (row.type === 'subgroup') {
        return estimateSubgroupHeight(row, selectedIds, perTokenRanges ?? {});
      }
      return ROW_ESTIMATES[row.type];
    },
    overscan: 5,
    getItemKey: (index) => {
      const row = mergedRows[index];
      if (!row) return String(index);
      switch (row.type) {
        case 'column-header': return `ch:${row.affix}`;
        case 'origin-header': return `oh:${row.origin}`;
        case 'jewel-type-header': return `jh:${row.jewelType}`;
        case 'subgroup': return `sg:${row.affix}:${row.subKey ?? row.subGroup.key}`;
        case 'subgroup-header': return `sh:${row.affix}:${row.subKey}`;
        default: return String(index);
      }
    },
  });

  // iter 120: removed the single-column useLayoutEffect block (same as
  // two-column) — see STATUS.md Known Issue #6 for root cause.
  // `measureElement` ref + ResizeObserver handle dynamic measurement; browser
  // preserves scrollTop when content above viewport is unchanged.

  const singleVirtualItems = singleVirtualizer.getVirtualItems();
  const singleTotalSize = singleVirtualizer.getTotalSize();

  let singlePaddingTop = 0;
  let singlePaddingBottom = 0;
  if (singleVirtualItems.length > 0) {
    const firstItem = singleVirtualItems[0];
    const lastItem = singleVirtualItems[singleVirtualItems.length - 1];
    singlePaddingTop = firstItem.start;
    singlePaddingBottom = singleTotalSize - lastItem.end;
  }

  const columnProps = {
    scrollElement,
    selectedIds,
    excludedIds,
    onToggleTokens,
    onToggleExclude,
    perTokenRanges,
    onSetTokenRange,
    onClearTokenRange,
    collapsedTokenIds,
    // iter 107: forwarded to FilterChip via VirtualRowContent for tier-aware border.
    sortMode,
    // iter 133 (Phase 2): forwarded to VirtualRowContent for chevron clicks.
    onToggleGroupCollapsed,
    onToggleSubGroupExpanded,
    // iter 134 (Phase 2.5): forwarded to VirtualRowContent for chip truncation.
    onToggleChipExpand,
    chipExpandState,
    pinnedIds,
    // iter 150 (KI#40): forwarded to VirtualRowContent → FilterChip ⭐ pin
    // button. Previously missing — columnProps spread did not include this
    // callback, so in two-column layout (default for belt/ring/amulet/jewel
    // when both prefix and suffix are present), FilterChip received
    // pinnedIds without onTogglePinned and silently skipped rendering the
    // ⭐ icon. User-visible symptom: favorites feature "missing" on those
    // 4 category tabs while working on relic/waystone/tablet/vendor.
    onTogglePinned,
    // iter 159: MIXED-mode 3-state chip props — forwarded to VirtualRowContent.
    optionalIds,
    onToggleOptional,
    mixedMode,
  };

  return (
    <div className="virtualized-mod-list flex flex-col gap-3" role="group" aria-label={t('search.placeholder')} ref={containerRef}>
      {/* Phase 2 (iter 133): Search + Filters row — sticky under TopNav.
          The `.sticky-search-bar` class in index.css handles position:sticky +
          bg + backdrop-blur. `top: 52px` (mobile) / `56px` (md+) matches TopNav height. */}
      <div className="sticky-search-bar flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="flex-1 min-w-[180px] px-3 py-2 bg-surface border border-edge rounded text-[15px] text-bright placeholder-ghost focus:outline-none focus:border-accent-amber"
        />

        <select
          value={affixFilter || 'all'}
          onChange={(e) => handleAffixFilter(e.target.value)}
          aria-label={t('filter.all_types')}
          className="px-2.5 py-1.5 bg-surface border border-edge rounded text-[13px] text-bright focus:outline-none focus:border-accent-amber"
        >
          <option value="all">{t('filter.all_types')}</option>
          <option value="prefix">{t('affix.prefix')}</option>
          <option value="suffix">{t('affix.suffix')}</option>
          {hasImplicit && <option value="implicit">{t('affix.implicit')}</option>}
        </select>

        {availableOrigins.length > 1 && (
          <select
            value={originFilter || 'all'}
            onChange={(e) => handleOriginFilter(e.target.value)}
            aria-label={t('filter.all_origins')}
            className="px-2.5 py-1.5 bg-surface border border-edge rounded text-[13px] text-bright focus:outline-none focus:border-accent-amber"
          >
            <option value="all">{t('filter.all_origins')}</option>
            {availableOrigins.map((origin) => (
              <option key={origin} value={origin}>
                {t('origin.' + origin)}
              </option>
            ))}
          </select>
        )}

        {selectedIds.size > 0 && (
          <button
            onClick={onClearSelections}
            className="px-2.5 py-1.5 bg-raised border border-edge rounded text-[13px] text-soft hover:bg-chip-hover transition-colors"
          >
            {t('filter.clear')} ({countUniqueFamilyKeys(tokens.filter(t => selectedIds.has(t.id)))})
          </button>
        )}

        {/* Phase 2 (iter 133): Expand all / Collapse all buttons.
            Desktop-only (`hidden lg:inline-flex`) per spec — on mobile the
            user relies on per-group chevrons. When collapse wiring is not
            provided (legacy callers), buttons are not rendered.
            iter 145 (KI#35): fixed sub-group key generation — keys must
            include origin (and jewelType) when showOriginSubSections is
            active, matching the key format in buildColumnRows/emitSubGroup. */}
        {(onExpandAllGroups || onExpandAllSubGroups) && (
          <button
            type="button"
            onClick={() => {
              if (onExpandAllSubGroups && expandedSubGroups) {
                const allSubKeys: string[] = [];
                const allAffixes: AffixType[] = [];
                if (implicitGroups.length > 0) allAffixes.push('implicit');
                if (prefixGroups.length > 0) allAffixes.push('prefix');
                if (suffixGroups.length > 0) allAffixes.push('suffix');
                for (const aff of allAffixes) {
                  const topKey = category ? `${category}:${aff}` : undefined;
                  const subs = aff === 'implicit' ? implicitSubGroups : aff === 'prefix' ? prefixSubGroups : suffixSubGroups;
                  if (showOriginSubSections && topKey) {
                    // Must match emitSubGroup key format: topKey:origin[:jewelType]:sg.key
                    // Rebuild origin-split groups to enumerate all (origin, sg) pairs.
                    const affGroups = aff === 'implicit' ? implicitGroups : aff === 'prefix' ? prefixGroups : suffixGroups;
                    const byOrigin = new Map<ModOrigin, FamilyGroup[]>();
                    for (const group of affGroups) {
                      const splits = splitGroupByOrigin(group);
                      for (const { origin, group: splitGroup } of splits) {
                        const list = byOrigin.get(origin) || [];
                        list.push(splitGroup);
                        byOrigin.set(origin, list);
                      }
                    }
                    for (const origin of ORIGIN_ORDER) {
                      const originGroups = byOrigin.get(origin);
                      if (!originGroups || originGroups.length === 0) continue;
                      if (showJewelTypeSubGroups) {
                        const byJewelType = new Map<JewelTypeCategory, FamilyGroup[]>();
                        for (const group of originGroups) {
                          const jt = classifyJewelType(group);
                          const list = byJewelType.get(jt) || [];
                          list.push(group);
                          byJewelType.set(jt, list);
                        }
                        for (const jt of JEWEL_TYPE_ORDER) {
                          const jtGroups = byJewelType.get(jt);
                          if (!jtGroups || jtGroups.length === 0) continue;
                          const jtSubs = classifyGroups(jtGroups, groupMode, sortMode);
                          for (const sg of jtSubs) {
                            allSubKeys.push(`${topKey}:${origin}:${jt}:${sg.key}`);
                          }
                        }
                      } else {
                        const originSubs = classifyGroups(originGroups, groupMode, sortMode);
                        for (const sg of originSubs) {
                          allSubKeys.push(`${topKey}:${origin}:${sg.key}`);
                        }
                      }
                    }
                  } else if (topKey) {
                    // No origin sub-sections — keys are topKey:sg.key
                    for (const sg of subs) {
                      allSubKeys.push(`${topKey}:${sg.key}`);
                    }
                  } else {
                    // Legacy path (no category)
                    for (const sg of subs) {
                      allSubKeys.push(sg.key);
                    }
                  }
                }
                onExpandAllSubGroups(allSubKeys);
              } else if (onExpandAllGroups) {
                onExpandAllGroups();
              }
            }}
            className="hidden lg:inline-flex px-2.5 py-1.5 bg-raised border border-edge rounded text-[13px] text-soft hover:bg-chip-hover transition-colors"
            aria-label={t('group.expand_all')}
          >
            {t('group.expand_all')}
          </button>
        )}
        {(onCollapseAllGroups || onCollapseAllSubGroups) && (
          <button
            type="button"
            onClick={() => {
              // Collapse all = empty expandedSubGroups (sub-level) OR populate
              // collapsedGroups with all top-level keys (top-level).
              if (onCollapseAllSubGroups) {
                onCollapseAllSubGroups();
              } else if (onCollapseAllGroups) {
                const allTopKeys: string[] = [];
                if (implicitGroups.length > 0) allTopKeys.push(`${category}:implicit`);
                if (prefixGroups.length > 0) allTopKeys.push(`${category}:prefix`);
                if (suffixGroups.length > 0) allTopKeys.push(`${category}:suffix`);
                onCollapseAllGroups(allTopKeys);
              }
            }}
            className="hidden lg:inline-flex px-2.5 py-1.5 bg-raised border border-edge rounded text-[13px] text-soft hover:bg-chip-hover transition-colors"
            aria-label={t('group.collapse_all')}
          >
            {t('group.collapse_all')}
          </button>
        )}
      </div>

      {/* Stats — iter 70: text-dim → text-muted for better contrast.
          Phase 3 (iter 135): use `visibleGroups` count so showSelectedOnly
          toggle updates the «shown» count immediately. */}
      <div className="text-[13px] text-muted">
        {t('filter.stats').replace('{shown}', String(visibleGroups.length)).replace('{total}', String(tokens.length))}
      </div>

      {/* Implicit section: always full width, above prefix/suffix */}
      {hasImplicit && affixFilter !== 'prefix' && affixFilter !== 'suffix' && implicitRows.length > 0 && (
        <VirtualizedColumn
          rows={implicitRows}
          borderClass="border-cborder-amber"
          {...columnProps}
        />
      )}

      {/* Two-column layout (Prefix | Suffix) — 50/50 split per iter 141 KI#27.
          Was `md:grid-cols-[2fr_3fr]` (40/60) — iter 139 KI#17 fix was applied
          to ModList.tsx but missed here, leaving belt/ring/amulet/jewel with
          visually unbalanced columns (prefix narrower than suffix). Now matches
          ModList.tsx parity: 50/50 via `md:grid-cols-2`. */}
      {hasBothAffixes ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* iter 145 (KI#34): `items-start` decouples column heights so
              measurement updates in one column don't shift the other. */}
          <VirtualizedColumn
            rows={prefixRows}
            borderClass="border-cborder-blue"
            {...columnProps}
          />
          <VirtualizedColumn
            rows={suffixRows}
            borderClass="border-cborder-orange"
            {...columnProps}
          />
        </div>
      ) : mergedRows.length > 0 ? (
        /* Single-column layout (affix filter applied or only one type) */
        <div style={{ width: '100%' }}>
          {singlePaddingTop > 0 && (
            <div style={{ height: singlePaddingTop }} aria-hidden="true" />
          )}

          {singleVirtualItems.map((virtualItem) => {
            const row = mergedRows[virtualItem.index];
            if (!row) return null;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={singleVirtualizer.measureElement}
              >
                <VirtualRowContent
                  row={row}
                  selectedIds={selectedIds}
                  excludedIds={excludedIds}
                  onToggleTokens={onToggleTokens}
                  onToggleExclude={onToggleExclude}
                  perTokenRanges={perTokenRanges}
                  onSetTokenRange={onSetTokenRange}
                  onClearTokenRange={onClearTokenRange}
                  collapsedTokenIds={collapsedTokenIds}
                  sortMode={sortMode}
                  onToggleGroupCollapsed={onToggleGroupCollapsed}
                  onToggleSubGroupExpanded={onToggleSubGroupExpanded}
                  onToggleChipExpand={onToggleChipExpand}
                  chipExpandState={chipExpandState}
                  pinnedIds={pinnedIds}
                onTogglePinned={onTogglePinned}
                optionalIds={optionalIds}
                onToggleOptional={onToggleOptional}
                mixedMode={mixedMode}
                />
              </div>
            );
          })}

          {singlePaddingBottom > 0 && (
            <div style={{ height: singlePaddingBottom }} aria-hidden="true" />
          )}
        </div>
      ) : (
        <div className="text-center text-dim py-8">
          {t('filter.no_results')}
        </div>
      )}
    </div>
  );
};
