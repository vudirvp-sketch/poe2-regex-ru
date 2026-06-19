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
import { classifyGroups, type ModGroupMode, type ModSubGroup, type JewelTypeCategory } from '@shared/mod-classifier';
import { ORIGIN_SECTION_LABELS } from '@shared/mod-classifier';
import { FilterChip } from './FilterChip';
import { t } from '@shared/i18n';
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
 *  parent header already gives). */
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
}> = React.memo(({ subGroup, selectedIds, excludedIds, onToggleTokens, onToggleExclude, perTokenRanges, onSetTokenRange, onClearTokenRange, collapsedTokenIds, hideLabel }) => {
  return (
    <div className="mb-2">
      {subGroup.label && !hideLabel && (
        <div className={`block ml-4 mb-1 text-[12px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded ${subGroup.bgClass} border ${subGroup.borderClass} ${subGroup.colorClass}`}>
          {subGroup.label} ({subGroup.groups.length})
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {subGroup.groups.map((group) => (
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
          />
        ))}
      </div>
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
}> = React.memo(({ affix, subGroups, originSections, selectedIds, excludedIds, onToggleTokens, onToggleExclude, showOriginSubSections, perTokenRanges, onSetTokenRange, onClearTokenRange, collapsedTokenIds }) => {
  const totalCount = showOriginSubSections
    ? originSections.reduce((sum, os) => sum + os.subGroups.reduce((s, sg) => s + sg.groups.length, 0), 0)
    : subGroups.reduce((sum, sg) => sum + sg.groups.length, 0);

  if (totalCount === 0) return null;

  const isPrefix = affix === 'prefix';
  const isImplicit = affix === 'implicit';
  const headerColor = isImplicit ? 'text-accent-amber' : isPrefix ? 'text-accent-blue' : 'text-accent-orange';
  const borderColor = isImplicit ? 'border-cborder-amber' : isPrefix ? 'border-cborder-blue' : 'border-cborder-orange';

  return (
    <div className={`flex flex-col min-w-0 ${totalCount > 0 ? `border-l-2 pl-3 ${borderColor}` : ''}`}>
      <h4 className={`text-base font-bold uppercase tracking-wider mb-2 ${headerColor} ${isImplicit ? 'affix-header-implicit' : isPrefix ? 'affix-header-prefix' : 'affix-header-suffix'}`}>
        {isImplicit ? 'ИМПЛИСЕТ' : t('affix.' + affix)} ({totalCount})
      </h4>

      {showOriginSubSections ? (
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
            />
          ));
        })()
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

  // Separate groups by affix type (after priority filter)
  const implicitGroups = useMemo(
    () => priorityFilteredGroups.filter((g) => g.affix === 'implicit'),
    [priorityFilteredGroups]
  );
  const prefixGroups = useMemo(
    () => priorityFilteredGroups.filter((g) => g.affix === 'prefix'),
    [priorityFilteredGroups]
  );
  const suffixGroups = useMemo(
    () => priorityFilteredGroups.filter((g) => g.affix === 'suffix'),
    [priorityFilteredGroups]
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
              <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} excludedIds={excludedIds} onToggleTokens={onToggleTokens} onToggleExclude={onToggleExclude} perTokenRanges={perTokenRanges} onSetTokenRange={onSetTokenRange} onClearTokenRange={onClearTokenRange} collapsedTokenIds={collapsedTokenIds} />
            ))}
          </div>
        </div>
      ));
  };

  return (
    <div className="mod-list flex flex-col gap-3" role="group" aria-label={t('search.placeholder')}>
      {/* Search + Filters row */}
      <div className="flex flex-wrap gap-2 items-center">
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
      </div>

      {/* Stats — iter 70: text-dim → text-muted for better contrast */}
      <div className="text-[13px] text-muted">
        {t('filter.stats').replace('{shown}', String(priorityFilteredGroups.length)).replace('{total}', String(tokens.length))}
      </div>

      {/* Mod groups area */}
      {priorityFilteredGroups.length > 0 ? (
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
            />
          )}

        {isOriginMode ? (
          /* Origin mode: single column, sub-grouped by origin */
          <div className="flex flex-col gap-2">
            {classifyGroups(priorityFilteredGroups.filter(g => g.affix !== 'implicit'), 'origin', sortMode).map((sg) => (
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
                                  <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} excludedIds={excludedIds} onToggleTokens={onToggleTokens} onToggleExclude={onToggleExclude} perTokenRanges={perTokenRanges} onSetTokenRange={onSetTokenRange} onClearTokenRange={onClearTokenRange} collapsedTokenIds={collapsedTokenIds} />
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
                                  <FilterChip key={group.familyKey} group={group} selectedIds={selectedIds} excludedIds={excludedIds} onToggleTokens={onToggleTokens} onToggleExclude={onToggleExclude} perTokenRanges={perTokenRanges} onSetTokenRange={onSetTokenRange} onClearTokenRange={onClearTokenRange} collapsedTokenIds={collapsedTokenIds} />
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
          /* Two-column layout: Prefix | Suffix */
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-4">
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
