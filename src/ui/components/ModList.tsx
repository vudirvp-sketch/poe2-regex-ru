/**
 * ModList — A two-column filterable mod list with semantic grouping.
 *
 * Redesigned layout (v3):
 * - Two columns: Prefix (left) | Suffix (right) with flex-wrap chips
 * - When showOriginSubSections is enabled, each affix column groups by
 *   origin FIRST (Обычные, Очернённые, Осквернённые, etc.), then within
 *   each origin section groups by semantic category. This avoids duplicate
 *   origin headers that appeared in v2.
 * - When showOriginSubSections is false, groups purely by semantic category.
 * - No virtual scroll: simple rendering for <300 family groups
 * - Search and filter controls at the top
 * - Full-width layout (takes entire available width)
 */
import React, { useMemo, useCallback } from 'react';
import type { GameToken, AffixType, ModOrigin, FamilyGroup, PriorityFilter, SortMode } from '@shared/types';
import { groupTokensByFamily, splitGroupByOrigin, countUniqueFamilyKeys } from '@shared/family-grouper';
import { classifyGroups, classifyJewelType, type ModGroupMode, type ModSubGroup, type JewelTypeCategory } from '@shared/mod-classifier';
import { ORIGIN_SECTION_LABELS } from '@shared/mod-classifier';
import { FilterChip } from './FilterChip';
import { GroupHeader } from './GroupHeader';
import { t } from '@shared/i18n';
// iter 139 (KI#18): CHIP_PREVIEW_COUNT import removed — Phase 2.5 chip
// truncation was reverted. The constant stays in `@shared/constants` for
// backward compat (no breaking change to the public API) but is no longer
// consumed by this component.
import type { TokenRangeOverride } from '@store/filter-store';

interface ModListProps {
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
  /** Grouping mode for sub-categorization within affix columns */
  groupMode?: ModGroupMode;
  /** When true, group by origin first, then by semantic category within
   *  each origin section. This avoids duplicate "Осквернённые" headers. */
  showOriginSubSections?: boolean;
  /** When true, within each origin section in origin mode, further sub-group
   *  by jewel type (Рубин/Изумруд/Сапфир/Общие). Used by JewelPage. */
  showJewelTypeSubGroups?: boolean;
  /** Active jewel type filter — when set, only show sub-headers for this type + shared.
   *  When 'all', show all sub-headers. */
  jewelTypeFilter?: JewelTypeCategory | 'all';
  /** Per-token numeric range overrides */
  perTokenRanges?: Record<string, TokenRangeOverride>;
  /** Set per-token numeric range override */
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  /** Clear per-token numeric range override */
  onClearTokenRange?: (tokenId: string) => void;
  /** Set of token IDs whose individual regex was collapsed by the optimizer */
  collapsedTokenIds?: Set<string>;
  /** Item category for priority tier classification (e.g., 'ring', 'belt') */
  category?: string;
  /** Priority tier filter: 'all' = show all, 'S+A' = S and A only, 'S' = S only */
  priorityFilter?: PriorityFilter;
  /**
   * Within-block sort mode (iter 106 P4). Defaults to 'alpha' (iter 99 behaviour).
   *  - 'alpha'      : familyKey primary, priorityTier tiebreaker.
   *  - 'tier-first' : priorityTier (S→A→B→C) primary, familyKey tiebreaker.
   * Passed through to `classifyGroups()` via `withSortedGroups()`.
   */
  sortMode?: SortMode;

  // ─── Phase 2 (iter 133): collapsible affix groups + sticky search ─────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 2 for full spec.
  // When `collapsedGroups` / `expandedSubGroups` are NOT provided (e.g. tests,
  // legacy callers), collapse UI is suppressed and groups render as before
  // (all expanded). This keeps the component backward-compatible.

  /** Top-level group keys currently COLLAPSED. Format: `${categoryId}:${affix}`.
   *  When provided, the matching `AffixColumn` header gets a chevron toggle
   *  and its sub-groups are hidden while collapsed. */
  collapsedGroups?: Set<string>;
  /** Sub-group keys currently EXPANDED. Format: `${categoryId}:${affix}:${subBlockKey}`.
   *  When provided, the matching `ModSubGroupSection` header gets a chevron
   *  toggle and its chips are hidden while NOT in the set (collapsed = default). */
  expandedSubGroups?: Set<string>;
  /** Toggle a top-level group's collapsed state. */
  onToggleGroupCollapsed?: (key: string) => void;
  /** Toggle a sub-group's expanded state. */
  onToggleSubGroupExpanded?: (key: string) => void;
  /** Expand all top-level groups — wired to the "Expand all" button. */
  onExpandAllGroups?: () => void;
  /** Collapse all top-level groups — wired to the "Collapse all" button. */
  onCollapseAllGroups?: (keys: string[]) => void;
  /** Expand all sub-groups — wired to the "Expand all" button (sub-level). */
  onExpandAllSubGroups?: (keys: string[]) => void;
  /** Collapse all sub-groups — wired to the "Collapse all" button (sub-level). */
  onCollapseAllSubGroups?: () => void;

  // ─── Phase 2.5 (iter 134): per-sub-group «+N ещё» chip expander ────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 2.5 for full spec.
  // When `chipExpandState` / `onToggleChipExpand` are NOT provided (e.g. tests,
  // legacy callers), all chips render unconditionally inside an expanded
  // sub-group (pre-Phase-2.5 behaviour). Backward-compatible.

  /** Sub-group keys whose chips are fully expanded (Phase 2.5).
   *  Format: `${categoryId}:${affix}:${subBlockKey}`. Default empty = all
   *  sub-groups truncated to `CHIP_PREVIEW_COUNT` chips + «+N ещё» button. */
  chipExpandState?: Set<string>;
  /** Toggle a sub-group's chip-expanded state. Key format:
   *  `${categoryId}:${affix}:${subBlockKey}`. */
  onToggleChipExpand?: (key: string) => void;
  /** Phase 5 favorites — pinned token IDs. Pinned chips ALWAYS visible even
   *  when truncated (forward-compatible; not yet wired by `useCategoryPage`
   *  until Phase 5 lands). */
  pinnedIds?: Set<string>;
  /** Phase 5 (iter 136): Toggle pinned state for a family group.
   *  When provided alongside `pinnedIds`, the FilterChip ⭐ icon button
   *  renders and toggles the whole family's pinned state via
   *  `onTogglePinned(memberIds)`. Backward compat: when omitted, the ⭐
   *  icon is NOT rendered (pre-Phase-5 behaviour). */
  onTogglePinned?: (ids: string[]) => void;


  // ─── Phase 3 (iter 135): show-selected-only mode ───────────────────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 3 for full spec.
  // When true, familyGroups are filtered to only those with at least one
  // selected/excluded/pinned member. Pinned/excluded tokens stay visible so
  // the user can un-exclude or re-select a favorited mod (per spec §4 Phase 3).

  /** When true, hide non-selected chips in the mod list.
   *  Pinned/excluded tokens stay visible. Default false. */
  showSelectedOnly?: boolean;
}

/** Origin section within an affix column */
interface OriginSection {
  origin: ModOrigin;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  borderLClass: string;
  iconPath?: string;
  subGroups: ModSubGroup[];
}

const ORIGIN_ORDER: ModOrigin[] = ['normal', 'desecrated', 'corrupted', 'essence', 'breachborn'];
const JEWEL_TYPE_ORDER: JewelTypeCategory[] = ['ruby', 'emerald', 'sapphire', 'shared'];

/**
 * Split family groups by origin, then classify each origin's groups by semantic category.
 * Returns origin sections, each containing classified sub-groups.
 *
 * iter 106 (P4): `sortMode` forwarded to `classifyGroups()` so the UI toggle
 * propagates through origin-split sub-sections as well.
 */
function splitByOriginThenSemantic(
  groups: FamilyGroup[],
  mode: ModGroupMode,
  sortMode: SortMode = 'alpha',
): OriginSection[] {
  // Step 1: Split all groups by origin
  const byOrigin = new Map<ModOrigin, FamilyGroup[]>();

  for (const group of groups) {
    const splits = splitGroupByOrigin(group);
    for (const { origin, group: splitGroup } of splits) {
      const list = byOrigin.get(origin) || [];
      list.push(splitGroup);
      byOrigin.set(origin, list);
    }
  }

  // Step 2: Classify each origin's groups
  const result: OriginSection[] = [];
  for (const origin of ORIGIN_ORDER) {
    const originGroups = byOrigin.get(origin);
    if (!originGroups || originGroups.length === 0) continue;

    const labelConfig = ORIGIN_SECTION_LABELS[origin];
    const subGroups = classifyGroups(originGroups, mode, sortMode);

    result.push({
      origin,
      label: labelConfig?.label ?? t('origin.' + origin),
      colorClass: labelConfig?.colorClass ?? 'text-muted',
      bgClass: labelConfig?.bgClass ?? '',
      borderClass: labelConfig?.borderClass ?? '',
      borderLClass: labelConfig?.borderLClass ?? '',
      iconPath: labelConfig?.iconPath,
      subGroups,
    });
  }

  return result;
}

/** Render a sub-group with its Level 3 badge header and flex-wrap chips.
 *  iter 62 (Phase 8c): when `hideLabel` is true, the Level 3 badge is suppressed.
 *  Caller sets this when the surrounding affix column / origin section contains
 *  only ONE sub-group — the badge is then pure noise (it repeats context the
 *  parent header already gives).
 *  iter 107: `sortMode` forwarded to FilterChip for tier-aware left border.
 *  iter 133 (Phase 2): when `subGroupKey` + `onToggleSubGroupExpanded` +
 *  `expandedSubGroups` are provided, the header becomes a clickable GroupHeader
 *  with chevron. When the sub-group is COLLAPSED (not in `expandedSubGroups`),
 *  chips are NOT rendered — only the header. Asymmetric default per iter 131 §13.7 #4.
 *  iter 134 (Phase 2.5): when `subGroupKey` + `chipExpandState` +
 *  `onToggleChipExpand` are provided AND the sub-group is expanded, chips are
 *  sliced to `CHIP_PREVIEW_COUNT` (plus any important chips past the preview
 *  window — selected/excluded/pinned members) + «+N ещё» button. When the key
 *  IS in `chipExpandState`, all chips render + «свернуть» button. When wiring
 *  is absent (legacy callers), all chips render unconditionally (pre-Phase-2.5). */
const ModSubGroupSection: React.FC<{
  subGroup: ModSubGroup;
  selectedIds: Set<string>;
  excludedIds?: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  onToggleExclude?: (ids: string[]) => void;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  collapsedTokenIds?: Set<string>;
  /** Suppress the Level 3 badge — set when the surrounding scope has only one sub-group. */
  hideLabel?: boolean;
  /** iter 107: forwarded to FilterChip for tier-aware left border. */
  sortMode?: SortMode;
  /** iter 133 (Phase 2): composite key `${categoryId}:${affix}:${subBlockKey}`. */
  subGroupKey?: string;
  /** iter 133 (Phase 2): set of EXPANDED sub-group keys. When `subGroupKey`
   *  is NOT in this set, chips are hidden (sub-groups default collapsed). */
  expandedSubGroups?: Set<string>;
  /** iter 133 (Phase 2): toggle the sub-group's expanded state. */
  onToggleSubGroupExpanded?: (key: string) => void;
  /** iter 134 (Phase 2.5): set of sub-group keys whose chips are FULLY expanded
   *  (overrides default `CHIP_PREVIEW_COUNT` truncation). */
  chipExpandState?: Set<string>;
  /** iter 134 (Phase 2.5): toggle the sub-group's chip-expanded state. */
  onToggleChipExpand?: (key: string) => void;
  /** iter 134 (Phase 2.5): pinned token IDs — pinned chips ALWAYS visible even
   *  when truncated. Forward-compatible with Phase 5 favorites (store field
   *  already exists; UI wiring lands in Phase 5). */
  pinnedIds?: Set<string>;
  /** Phase 5 (iter 136): forwarded to FilterChip ⭐ icon button. */
  onTogglePinned?: (ids: string[]) => void;
}> = React.memo(({ subGroup, selectedIds, excludedIds, onToggleTokens, onToggleExclude, perTokenRanges, onSetTokenRange, onClearTokenRange, collapsedTokenIds, hideLabel, sortMode, subGroupKey, expandedSubGroups, onToggleSubGroupExpanded, pinnedIds, onTogglePinned }) => {
  // iter 139 (KI#18): `chipExpandState` / `onToggleChipExpand` props REMOVED
  // from the destructure list (they remain in the FC interface above for
  // backward compat with callers that still pass them, but the component no
  // longer reads them — Phase 2.5 truncation was reverted per user feedback).
  // Phase 2 (iter 133): if collapse wiring is present, derive isCollapsed.
  // When `expandedSubGroups` is undefined (legacy callers), we treat the
  // sub-group as expanded (preserve pre-Phase-2 behaviour).
  const collapseWired = !!(subGroupKey && expandedSubGroups && onToggleSubGroupExpanded);
  const isExpanded = !collapseWired || expandedSubGroups!.has(subGroupKey!);
  const showHeader = subGroup.label && !hideLabel;
  const showChips = isExpanded || !showHeader;

  // iter 139 (KI#18): REVERTED Phase 2.5 chip truncation.
  // Phase 2.5 (iter 134) added per-sub-group chip truncation to CHIP_PREVIEW_COUNT
  // (3) + «+N ещё» / «свернуть» buttons. User explicitly rejected this UX:
  // «не хочу эти лишние кнопки ещё, зачем дополнительная вложенность и лишние
  // клики?». Truncation logic, important-chip rescue, and expand/collapse
  // buttons are all removed. `chipExpandState` / `onToggleChipExpand` props
  // remain in the API for backward compat (callers can still pass them) but
  // are now NO-OP — all chips in a sub-group always render when the sub-group
  // is expanded. The `isChipImportant` callback is also removed since nothing
  // uses it anymore.
  //
  // `CHIP_PREVIEW_COUNT` constant stays in `@shared/constants` for backward
  // compat (no breaking change to the public API), but is no longer consumed
  // by this component.
  const visibleChips: FamilyGroup[] = subGroup.groups;

  return (
    <div className="mb-2">
      {showHeader && (
        collapseWired ? (
          <GroupHeader
            label={subGroup.label}
            count={subGroup.groups.length}
            isCollapsed={!isExpanded}
            onToggle={() => onToggleSubGroupExpanded!(subGroupKey!)}
            variant="sub"
            className={`${subGroup.bgClass} border ${subGroup.borderClass} ${subGroup.colorClass}`}
          />
        ) : (
          <div className={`block ml-4 mb-1 text-[12px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded ${subGroup.bgClass} border ${subGroup.borderClass} ${subGroup.colorClass}`}>
            {subGroup.label} ({subGroup.groups.length})
          </div>
        )
      )}
      {showChips && (
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
            />
          ))}
          {/* iter 139 (KI#18): «+N ещё» / «свернуть» buttons REMOVED.
              Phase 2.5 (iter 134) added these to truncate chip preview to 3
              + expand-on-demand. User explicitly rejected the UX. All chips
              in an expanded sub-group now render unconditionally. */}
        </div>
      )}
    </div>
  );
});

/** A single affix column (prefix or suffix) */
const AffixColumn: React.FC<{
  affix: AffixType;
  subGroups: ModSubGroup[];
  originSections: OriginSection[];
  selectedIds: Set<string>;
  excludedIds?: Set<string>;
  onToggleTokens: (ids: string[]) => void;
  onToggleExclude?: (ids: string[]) => void;
  showOriginSubSections: boolean;
  perTokenRanges?: Record<string, TokenRangeOverride>;
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
  onClearTokenRange?: (tokenId: string) => void;
  collapsedTokenIds?: Set<string>;
  /** iter 107: forwarded to FilterChip via ModSubGroupSection for tier-aware border. */
  sortMode?: SortMode;
  /** iter 133 (Phase 2): categoryId for composing collapse keys. */
  categoryId?: string;
  /** iter 133 (Phase 2): top-level collapsed set. */
  collapsedGroups?: Set<string>;
  /** iter 133 (Phase 2): sub-level expanded set. */
  expandedSubGroups?: Set<string>;
  /** iter 133 (Phase 2): toggle top-level collapse. */
  onToggleGroupCollapsed?: (key: string) => void;
  /** iter 133 (Phase 2): toggle sub-group expand. */
  onToggleSubGroupExpanded?: (key: string) => void;
  /** iter 134 (Phase 2.5): chip-expanded set (forwarded to ModSubGroupSection). */
  chipExpandState?: Set<string>;
  /** iter 134 (Phase 2.5): toggle chip-expanded (forwarded to ModSubGroupSection). */
  onToggleChipExpand?: (key: string) => void;
  /** iter 134 (Phase 2.5): pinned token IDs (forwarded to ModSubGroupSection). */
  pinnedIds?: Set<string>;
  /** Phase 5 (iter 136): forwarded to ModSubGroupSection → FilterChip. */
  onTogglePinned?: (ids: string[]) => void;
}> = React.memo(({ affix, subGroups, originSections, selectedIds, excludedIds, onToggleTokens, onToggleExclude, showOriginSubSections, perTokenRanges, onSetTokenRange, onClearTokenRange, collapsedTokenIds, sortMode, categoryId, collapsedGroups, expandedSubGroups, onToggleGroupCollapsed, onToggleSubGroupExpanded, chipExpandState, onToggleChipExpand, pinnedIds, onTogglePinned }) => {
  const totalCount = showOriginSubSections
    ? originSections.reduce((sum, os) => sum + os.subGroups.reduce((s, sg) => s + sg.groups.length, 0), 0)
    : subGroups.reduce((sum, sg) => sum + sg.groups.length, 0);

  if (totalCount === 0) return null;

  const isPrefix = affix === 'prefix';
  const isImplicit = affix === 'implicit';
  const headerColor = isImplicit ? 'text-accent-amber' : isPrefix ? 'text-accent-blue' : 'text-accent-orange';
  const borderColor = isImplicit ? 'border-cborder-amber' : isPrefix ? 'border-cborder-blue' : 'border-cborder-orange';

  // Phase 2 (iter 133): collapse wiring for top-level group.
  // When `categoryId` + `collapsedGroups` + `onToggleGroupCollapsed` are all
  // provided, the header becomes a GroupHeader with chevron. When the group
  // is COLLAPSED (in `collapsedGroups`), sub-groups are NOT rendered.
  const topLevelKey = categoryId ? `${categoryId}:${affix}` : undefined;
  const topCollapseWired = !!(topLevelKey && collapsedGroups && onToggleGroupCollapsed);
  const isTopCollapsed = topCollapseWired ? collapsedGroups!.has(topLevelKey!) : false;
  // Phase 4 (iter 137): `--strong` modifier (CSS ready from iter 137) — applied
  // via caller when sortMode='tier-first' per docs/UI_REFACTOR_PLAN.md §13.6
  // optional enhancement. Deeper bg + brighter border-left so the tier-first
  // mode reads as more emphatic without breaking the existing layout. iter 138
  // wires the modifier so the affix column headers visually reinforce the
  // sort-mode the user has chosen. When sortMode='alpha' (default), no
  // modifier is added — preserves pre-iter-138 behaviour (backward compat).
  const affixBase = isImplicit ? 'affix-header-implicit' : isPrefix ? 'affix-header-prefix' : 'affix-header-suffix';
  const affixHeaderClass = sortMode === 'tier-first' ? `${affixBase} ${affixBase}--strong` : affixBase;
  const affixLabel = isImplicit ? 'ИМПЛИСЕТ' : t('affix.' + affix);

  return (
    <div className={`flex flex-col min-w-0 ${totalCount > 0 ? `border-l-2 pl-3 ${borderColor}` : ''}`}>
      {topCollapseWired ? (
        <GroupHeader
          label={affixLabel}
          count={totalCount}
          isCollapsed={isTopCollapsed}
          onToggle={() => onToggleGroupCollapsed!(topLevelKey!)}
          variant="top"
          className={`${headerColor} ${affixHeaderClass}`}
          // Phase 4 (iter 137): show ⓘ tooltip on top-level affix column
          // headers explaining what each affix type means. Helps beginners.
          infoTooltip={
            affix === 'prefix' ? t('tooltip.prefix_explanation')
              : affix === 'suffix' ? t('tooltip.suffix_explanation')
              : t('tooltip.implicit_explanation')
          }
        />
      ) : (
        <h4 className={`text-base font-bold uppercase tracking-wider mb-2 ${headerColor} ${affixHeaderClass}`}>
          {affixLabel} ({totalCount})
        </h4>
      )}

      {!isTopCollapsed && (
        showOriginSubSections ? (
          /* Group by origin first, then by semantic category within each origin */
          originSections.map((section, idx) => {
            const sectionCount = section.subGroups.reduce((s, sg) => s + sg.groups.length, 0);
            /* iter 62 (Phase 8c): when an origin section contains only ONE
               semantic sub-group, the Level 3 badge just repeats the origin
               header above it — suppress it. */
            const hideSubLabel = section.subGroups.length === 1;
            return (
              <div key={section.origin} className={idx > 0 ? 'mt-3' : ''}>
                <div className={`block ml-2 ${idx > 0 ? 'mt-4' : 'mt-1'} mb-2 text-[14px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border-l-2 ${section.bgClass} ${section.borderClass} ${section.borderLClass} ${section.colorClass} flex items-center gap-1.5`}>
                  {section.iconPath && (
                    <img
                      src={`${import.meta.env.BASE_URL}${section.iconPath}`}
                      alt=""
                      width={17}
                      height={17}
                      className="shrink-0 object-contain"
                    />
                  )}
                  <span>{section.label} ({sectionCount})</span>
                </div>
                {section.subGroups.map((sg) => (
                  <ModSubGroupSection
                    key={`${section.origin}:${sg.key}`}
                    subGroup={sg}
                    selectedIds={selectedIds}
                    excludedIds={excludedIds}
                    onToggleTokens={onToggleTokens}
                    onToggleExclude={onToggleExclude}
                    perTokenRanges={perTokenRanges}
                    onSetTokenRange={onSetTokenRange}
                    onClearTokenRange={onClearTokenRange}
                    collapsedTokenIds={collapsedTokenIds}
                    hideLabel={hideSubLabel}
                    sortMode={sortMode}
                    // iter 144 (KI#32 — cascade expand fix): include origin in
                    // sub-group key so toggling expand in «Обычные» no longer
                    // also expands «Осквернённые» / «Очернённые» / «Разлома»
                    // sub-groups with the same `sg.key` (e.g. `skill-levels`).
                    subGroupKey={topLevelKey ? `${topLevelKey}:${section.origin}:${sg.key}` : undefined}
                    expandedSubGroups={expandedSubGroups}
                    onToggleSubGroupExpanded={onToggleSubGroupExpanded}
                    chipExpandState={chipExpandState}
                    onToggleChipExpand={onToggleChipExpand}
                    pinnedIds={pinnedIds}
                    onTogglePinned={onTogglePinned}
                  />
                ))}
              </div>
            );
          })
        ) : (
          /* Group purely by semantic category.
             iter 62 (Phase 8c): if the affix column has only ONE semantic
             sub-group, the Level 3 badge is redundant under the affix header. */
          (() => {
            const hideSubLabel = subGroups.length === 1;
            return subGroups.map((sg) => (
              <ModSubGroupSection
                key={sg.key}
                subGroup={sg}
                selectedIds={selectedIds}
                excludedIds={excludedIds}
                onToggleTokens={onToggleTokens}
                onToggleExclude={onToggleExclude}
                perTokenRanges={perTokenRanges}
                onSetTokenRange={onSetTokenRange}
                onClearTokenRange={onClearTokenRange}
                collapsedTokenIds={collapsedTokenIds}
                hideLabel={hideSubLabel}
                sortMode={sortMode}
                subGroupKey={topLevelKey ? `${topLevelKey}:${sg.key}` : undefined}
                expandedSubGroups={expandedSubGroups}
                onToggleSubGroupExpanded={onToggleSubGroupExpanded}
                chipExpandState={chipExpandState}
                onToggleChipExpand={onToggleChipExpand}
                pinnedIds={pinnedIds}
                onTogglePinned={onTogglePinned}
              />
            ));
          })()
        )
      )}
    </div>
  );
});

export const ModList: React.FC<ModListProps> = ({
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
  jewelTypeFilter = 'all',
  perTokenRanges,
  onSetTokenRange,
  onClearTokenRange,
  collapsedTokenIds,
  category,
  priorityFilter = 'all',
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
  // Phase 3 (iter 135): show-selected-only mode
  showSelectedOnly = false,
}) => {
  const availableOrigins = useMemo(() => {
    const origins = new Set<ModOrigin>();
    for (const token of tokens) {
      origins.add(token.origin);
    }
    return Array.from(origins).sort();
  }, [tokens]);

  // Filter tokens (BEFORE grouping)
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

  // Group filtered tokens by family (with category for priority tier)
  const familyGroups = useMemo(
    () => groupTokensByFamily(filteredTokens, category),
    [filteredTokens, category]
  );

  // Filter by priority tier
  const priorityFilteredGroups = useMemo(() => {
    if (priorityFilter === 'all') return familyGroups;
    return familyGroups.filter(g => {
      if (priorityFilter === 'S') return g.priorityTier === 'S';
      if (priorityFilter === 'S+A') return g.priorityTier === 'S' || g.priorityTier === 'A';
      return true;
    });
  }, [familyGroups, priorityFilter]);

  // Phase 3 (iter 135): show-selected-only filter.
  // When `showSelectedOnly` is true, only show family groups with at least one
  // selected/excluded/pinned member. Pinned/excluded tokens stay visible so
  // the user can un-exclude or re-select a favorited mod (per spec §4 Phase 3).
  // When false (default), all familyGroups pass through unchanged (pre-Phase-3).
  const visibleGroups = useMemo(() => {
    if (!showSelectedOnly) return priorityFilteredGroups;
    const effectiveExcluded = excludedIds ?? new Set<string>();
    const effectivePinned = pinnedIds ?? new Set<string>();
    return priorityFilteredGroups.filter(g => {
      for (const m of g.members) {
        if (selectedIds.has(m.id)) return true;
        if (effectiveExcluded.has(m.id)) return true;
        if (effectivePinned.has(m.id)) return true;
      }
      return false;
    });
  }, [priorityFilteredGroups, showSelectedOnly, selectedIds, excludedIds, pinnedIds]);

  // Separate groups by affix type (after priority + show-selected-only filter).
  // Phase 3 (iter 135): use `visibleGroups` instead of `priorityFilteredGroups`
  // so showSelectedOnly toggle hides non-selected chips.
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

  // Classify groups into sub-groups based on mode (iter 106 P4: sortMode-aware)
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

  // When showOriginSubSections, also compute origin-then-semantic groupings
  // (iter 106 P4: sortMode forwarded so origin-split sub-sections respect the toggle)
  const implicitOriginSections = useMemo(
    () => showOriginSubSections ? splitByOriginThenSemantic(implicitGroups, groupMode, sortMode) : [],
    [implicitGroups, groupMode, sortMode, showOriginSubSections]
  );
  const prefixOriginSections = useMemo(
    () => showOriginSubSections ? splitByOriginThenSemantic(prefixGroups, groupMode, sortMode) : [],
    [prefixGroups, groupMode, sortMode, showOriginSubSections]
  );
  const suffixOriginSections = useMemo(
    () => showOriginSubSections ? splitByOriginThenSemantic(suffixGroups, groupMode, sortMode) : [],
    [suffixGroups, groupMode, sortMode, showOriginSubSections]
  );

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

  // Determine if we need two columns or one (prefix/suffix only, implicit always full width)
  const hasBothAffixes = prefixGroups.length > 0 && suffixGroups.length > 0;
  const hasImplicit = implicitGroups.length > 0;
  const isOriginMode = groupMode === 'origin';

  /** Render jewel type sub-groups within an affix column of an origin section.
   *  iter 62 (Phase 8c): when only ONE jewel-type sub-group survives the
   *  filter (e.g. user picked "Рубин" and there's only Ruby + no shared),
   *  the Level 3 badge is suppressed — the column header + origin header
   *  already tell the user which type they're looking at. */
  const renderJewelTypeSubGroups = (groups: FamilyGroup[]) => {
    const jewelSubGroups = classifyGroups(groups, 'jewel-type', sortMode)
      .filter(sg => {
        // When a specific type is selected, only show that type + shared
        if (jewelTypeFilter !== 'all') {
          return sg.key === jewelTypeFilter || sg.key === 'shared';
        }
        return true;
      });
    const hideLabel = jewelSubGroups.length === 1;
    return jewelSubGroups
      .map(sg => (
        <div key={sg.key} className="mb-1.5">
          {!hideLabel && (
            <div className={`block ml-4 mb-1.5 text-[12px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded ${sg.bgClass} border ${sg.borderClass} ${sg.colorClass}`}>
              {sg.label} ({sg.groups.length})
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {sg.groups.map(group => (
              <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} excludedIds={excludedIds} onToggleTokens={onToggleTokens} onToggleExclude={onToggleExclude} perTokenRanges={perTokenRanges} onSetTokenRange={onSetTokenRange} onClearTokenRange={onClearTokenRange} collapsedTokenIds={collapsedTokenIds} sortMode={sortMode} pinnedIds={pinnedIds} onTogglePinned={onTogglePinned} />
            ))}
          </div>
        </div>
      ));
  };

  return (
    <div className="mod-list flex flex-col gap-3" role="group" aria-label={t('search.placeholder')}>
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
                    for (const sg of subs) {
                      allSubKeys.push(`${topKey}:${sg.key}`);
                    }
                  } else {
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

      {/* Mod groups area */}
      {visibleGroups.length > 0 ? (
        <>
          {/* Implicit section: always full width, above prefix/suffix */}
          {hasImplicit && affixFilter !== 'prefix' && affixFilter !== 'suffix' && (
            <AffixColumn
              affix="implicit"
              subGroups={implicitSubGroups}
              originSections={implicitOriginSections}
              selectedIds={selectedIds}
              excludedIds={excludedIds}
              onToggleTokens={onToggleTokens}
              onToggleExclude={onToggleExclude}
              showOriginSubSections={showOriginSubSections}
              perTokenRanges={perTokenRanges}
              onSetTokenRange={onSetTokenRange}
              onClearTokenRange={onClearTokenRange}
              collapsedTokenIds={collapsedTokenIds}
              sortMode={sortMode}
              categoryId={category}
              collapsedGroups={collapsedGroups}
              expandedSubGroups={expandedSubGroups}
              onToggleGroupCollapsed={onToggleGroupCollapsed}
              onToggleSubGroupExpanded={onToggleSubGroupExpanded}
              chipExpandState={chipExpandState}
              onToggleChipExpand={onToggleChipExpand}
              pinnedIds={pinnedIds}
              onTogglePinned={onTogglePinned}
            />
          )}
          {/* Also show implicit when affixFilter is 'implicit' */}
          {affixFilter === 'implicit' && hasImplicit && (
            <AffixColumn
              affix="implicit"
              subGroups={implicitSubGroups}
              originSections={implicitOriginSections}
              selectedIds={selectedIds}
              excludedIds={excludedIds}
              onToggleTokens={onToggleTokens}
              onToggleExclude={onToggleExclude}
              showOriginSubSections={showOriginSubSections}
              perTokenRanges={perTokenRanges}
              onSetTokenRange={onSetTokenRange}
              onClearTokenRange={onClearTokenRange}
              collapsedTokenIds={collapsedTokenIds}
              sortMode={sortMode}
              categoryId={category}
              collapsedGroups={collapsedGroups}
              expandedSubGroups={expandedSubGroups}
              onToggleGroupCollapsed={onToggleGroupCollapsed}
              onToggleSubGroupExpanded={onToggleSubGroupExpanded}
              chipExpandState={chipExpandState}
              onToggleChipExpand={onToggleChipExpand}
              pinnedIds={pinnedIds}
              onTogglePinned={onTogglePinned}
            />
          )}

        {isOriginMode ? (
          /* Origin mode: single column, sub-grouped by origin */
          <div className="flex flex-col gap-2">
            {classifyGroups(visibleGroups.filter(g => g.affix !== 'implicit'), 'origin', sortMode).map((sg) => (
              <div key={sg.key}>
                <div className={`block ml-2 mb-2 text-[14px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border-l-2 ${sg.bgClass} ${sg.borderClass} ${sg.borderLClass} ${sg.colorClass} flex items-center gap-1.5`}>
                  {(() => {
                    const originKey = sg.key as ModOrigin;
                    const labelConfig = ORIGIN_SECTION_LABELS[originKey];
                    return labelConfig?.iconPath ? (
                      <img
                        src={`${import.meta.env.BASE_URL}${labelConfig.iconPath}`}
                        alt=""
                        width={17}
                        height={17}
                        className="shrink-0 object-contain"
                      />
                    ) : null;
                  })()}
                  <span>{sg.label} ({sg.groups.length})</span>
                </div>
                {/* Within each origin, further split by affix */}
                {(() => {
                  const originPrefix = sg.groups.filter(g => g.affix === 'prefix');
                  const originSuffix = sg.groups.filter(g => g.affix === 'suffix');
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-2">
                      {originPrefix.length > 0 && (
                        <div className="border-l-2 border-cborder-blue pl-3">
                          <h5 className="text-[13px] font-semibold text-accent-blue uppercase mb-1 affix-header-prefix">{t('affix.prefix')} ({originPrefix.length})</h5>
                          {showJewelTypeSubGroups
                            ? renderJewelTypeSubGroups(originPrefix)
                            : <div className="flex flex-wrap gap-1.5">
                                {originPrefix.map(group => (
                                  <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} excludedIds={excludedIds} onToggleTokens={onToggleTokens} onToggleExclude={onToggleExclude} perTokenRanges={perTokenRanges} onSetTokenRange={onSetTokenRange} onClearTokenRange={onClearTokenRange} collapsedTokenIds={collapsedTokenIds} sortMode={sortMode} pinnedIds={pinnedIds} onTogglePinned={onTogglePinned} />
                                ))}
                              </div>
                          }
                        </div>
                      )}
                      {originSuffix.length > 0 && (
                        <div className="border-l-2 border-cborder-orange pl-3">
                          <h5 className="text-[13px] font-semibold text-accent-orange uppercase mb-1 affix-header-suffix">{t('affix.suffix')} ({originSuffix.length})</h5>
                          {showJewelTypeSubGroups
                            ? renderJewelTypeSubGroups(originSuffix)
                            : <div className="flex flex-wrap gap-1.5">
                                {originSuffix.map(group => (
                                  <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} excludedIds={excludedIds} onToggleTokens={onToggleTokens} onToggleExclude={onToggleExclude} perTokenRanges={perTokenRanges} onSetTokenRange={onSetTokenRange} onClearTokenRange={onClearTokenRange} collapsedTokenIds={collapsedTokenIds} sortMode={sortMode} pinnedIds={pinnedIds} onTogglePinned={onTogglePinned} />
                                ))}
                              </div>
                          }
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : hasBothAffixes ? (
          /* Two-column layout: Prefix | Suffix
             iter 139 (KI#17): was `md:grid-cols-[2fr_3fr]` (40/60) — user
             reported suffix column barely fills 60% while prefix column was
             cramped. Equal 50/50 split is what the reference mockup uses and
             what the user expects («колонки суффиксов и префиксов разные по
             размеру, почему?»). */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AffixColumn
              affix="prefix"
              subGroups={prefixSubGroups}
              originSections={prefixOriginSections}
              selectedIds={selectedIds}
              excludedIds={excludedIds}
              onToggleTokens={onToggleTokens}
              onToggleExclude={onToggleExclude}
              showOriginSubSections={showOriginSubSections}
              perTokenRanges={perTokenRanges}
              onSetTokenRange={onSetTokenRange}
              onClearTokenRange={onClearTokenRange}
              collapsedTokenIds={collapsedTokenIds}
              sortMode={sortMode}
              categoryId={category}
              collapsedGroups={collapsedGroups}
              expandedSubGroups={expandedSubGroups}
              onToggleGroupCollapsed={onToggleGroupCollapsed}
              onToggleSubGroupExpanded={onToggleSubGroupExpanded}
              chipExpandState={chipExpandState}
              onToggleChipExpand={onToggleChipExpand}
              pinnedIds={pinnedIds}
              onTogglePinned={onTogglePinned}
            />
            <AffixColumn
              affix="suffix"
              subGroups={suffixSubGroups}
              originSections={suffixOriginSections}
              selectedIds={selectedIds}
              excludedIds={excludedIds}
              onToggleTokens={onToggleTokens}
              onToggleExclude={onToggleExclude}
              showOriginSubSections={showOriginSubSections}
              perTokenRanges={perTokenRanges}
              onSetTokenRange={onSetTokenRange}
              onClearTokenRange={onClearTokenRange}
              collapsedTokenIds={collapsedTokenIds}
              sortMode={sortMode}
              categoryId={category}
              collapsedGroups={collapsedGroups}
              expandedSubGroups={expandedSubGroups}
              onToggleGroupCollapsed={onToggleGroupCollapsed}
              onToggleSubGroupExpanded={onToggleSubGroupExpanded}
              chipExpandState={chipExpandState}
              onToggleChipExpand={onToggleChipExpand}
              pinnedIds={pinnedIds}
              onTogglePinned={onTogglePinned}
            />
          </div>
        ) : (
          /* Single column (only one affix type after filtering) */
          <div className="flex flex-col gap-2">
            {prefixGroups.length > 0 && (
              <AffixColumn
                affix="prefix"
                subGroups={prefixSubGroups}
                originSections={prefixOriginSections}
                selectedIds={selectedIds}
                excludedIds={excludedIds}
                onToggleTokens={onToggleTokens}
                onToggleExclude={onToggleExclude}
                showOriginSubSections={showOriginSubSections}
                perTokenRanges={perTokenRanges}
                onSetTokenRange={onSetTokenRange}
                onClearTokenRange={onClearTokenRange}
                collapsedTokenIds={collapsedTokenIds}
                sortMode={sortMode}
                categoryId={category}
                collapsedGroups={collapsedGroups}
                expandedSubGroups={expandedSubGroups}
                onToggleGroupCollapsed={onToggleGroupCollapsed}
                onToggleSubGroupExpanded={onToggleSubGroupExpanded}
                chipExpandState={chipExpandState}
                onToggleChipExpand={onToggleChipExpand}
                pinnedIds={pinnedIds}
                onTogglePinned={onTogglePinned}
              />
            )}
            {suffixGroups.length > 0 && (
              <AffixColumn
                affix="suffix"
                subGroups={suffixSubGroups}
                originSections={suffixOriginSections}
                selectedIds={selectedIds}
                excludedIds={excludedIds}
                onToggleTokens={onToggleTokens}
                onToggleExclude={onToggleExclude}
                showOriginSubSections={showOriginSubSections}
                perTokenRanges={perTokenRanges}
                onSetTokenRange={onSetTokenRange}
                onClearTokenRange={onClearTokenRange}
                collapsedTokenIds={collapsedTokenIds}
                sortMode={sortMode}
                categoryId={category}
                collapsedGroups={collapsedGroups}
                expandedSubGroups={expandedSubGroups}
                onToggleGroupCollapsed={onToggleGroupCollapsed}
                onToggleSubGroupExpanded={onToggleSubGroupExpanded}
                chipExpandState={chipExpandState}
                onToggleChipExpand={onToggleChipExpand}
                pinnedIds={pinnedIds}
                onTogglePinned={onTogglePinned}
              />
            )}
          </div>
        )}
        </>
      ) : (
        <div className="text-center text-dim py-8">
          {t('filter.no_results')}
        </div>
      )}
    </div>
  );
};
