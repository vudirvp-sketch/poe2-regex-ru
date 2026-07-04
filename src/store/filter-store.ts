/**
 * Filter Store — Zustand store for mod filter state.
 *
 * Manages which mods are selected, filter text, and origin/affix filters
 * for the current category page.
 */
import { create } from 'zustand';
import type { AffixType, ModOrigin } from '@shared/types';

/** Per-slot numeric range override */
export interface SlotRangeOverride {
  min?: number;
  max?: number;
}

/** Per-token numeric range override */
export interface TokenRangeOverride {
  min?: number;
  max?: number;
  /** For multi-placeholder mods (e.g., "От ## до ## урона"), which slot to filter by.
   *  0 = first placeholder (min damage), 1 = second placeholder (max damage).
   *  Defaults to 0 if not specified.
   *  Used in single-slot mode (1е/2е toggle). For dual-slot mode, use slotOverrides. */
  filterSlotIndex?: number;
  /** Per-slot overrides for multi-placeholder mods.
   *  When set, enables simultaneous filtering of multiple placeholders:
   *  both slot 0 AND slot 1 get their own RANGE nodes ANDed together.
   *  Takes priority over top-level min/max for the respective slot.
   *  When slotOverrides is set, filterSlotIndex is ignored. */
  slotOverrides?: Record<number, SlotRangeOverride>;
}

/** A single filter state for a category */
export interface FilterState {
  /** Set of selected token IDs ("want" mods).
   *  In MIXED mode these are MUST tokens (each becomes its own quoted group,
   *  AND across blocks). */
  selectedIds: Set<string>;
  /** Set of excluded token IDs ("don't want" mods).
   *  Mutually exclusive with selectedIds — a token can be either wanted or excluded, not both. */
  excludedIds: Set<string>;
  /** iter 159: Set of optional token IDs ("opt" mods).
   *  Only meaningful in MIXED search-logic mode. In 'and' / 'or' modes this
   *  set is ignored (no MUST/OPT split — all selections behave as before).
   *  Mutually exclusive with selectedIds AND excludedIds (3-state chip:
   *  want / opt / exclude). Toggling a chip cycles through these states.
   *  Serialized to URL hash under key `opt` (avoid clashing with `o` =
   *  originFilter). */
  optionalIds: Set<string>;
  /** Text search filter */
  searchText: string;
  /** Affix type filter (null = all) */
  affixFilter: AffixType | null;
  /** Origin filter (null = all) */
  originFilter: ModOrigin | null;
  /** Extra state for category-specific filters (e.g., waystone toggles, tablet types) */
  extraState: Record<string, unknown>;
  /** Per-token numeric range overrides. Key = token ID, value = {min?, max?}.
   *  When set, takes priority over global minValue/maxValue for that token.
   *  Stored in extraState for URL sync. */
  perTokenRanges: Record<string, TokenRangeOverride>;

  // ─── Phase 1 fields (iter 132, UI Refactor) ─────────────────────────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 1 for full spec.

  /** Top-level group keys currently COLLAPSED.
   *  Format: `${categoryId}:${affix}` (e.g. `waystone:prefix`).
   *  Default empty = ALL top-level groups EXPANDED (per iter 131 §13.7 correction #4).
   *  In set = collapsed. Out of set = expanded. */
  collapsedGroups: Set<string>;

  /** Sub-group keys currently EXPANDED.
   *  Format: `${categoryId}:${affix}:${subBlockKey}` (e.g. `waystone:prefix:positive-loot`).
   *  Default empty = ALL sub-groups COLLAPSED (per iter 131 §13.7 correction #4).
   *  In set = expanded. Out of set = collapsed.
   *  Asymmetric default: top-level groups default EXPANDED while sub-groups default
   *  COLLAPSED — gives a cleaner first screen per user feedback. */
  expandedSubGroups: Set<string>;

  /** When true, hide non-selected chips in the mod list.
   *  Pinned/excluded tokens stay visible. Default false. */
  showSelectedOnly: boolean;

  /** Favorited token IDs (Phase 5 favorites feature).
   *  Rendered in the LEFT panel BELOW search, ABOVE filters (per iter 131 §13.7
   *  correction #1 — final order Search → Favorites → Filters). Default empty. */
  pinnedIds: Set<string>;

  /** Sub-group keys whose chips are fully expanded (Phase 2.5 «+N ещё» feature).
   *  Format: `${categoryId}:${affix}:${subBlockKey}`. When NOT in the set,
   *  chips are truncated to CHIP_PREVIEW_COUNT (default 3) with a «+N ещё» button.
   *  When IN the set, all chips render. Default empty = all sub-groups truncated. */
  chipExpandState: Set<string>;
}

/** Actions for the filter store */
export interface FilterActions {
  /** Toggle a token's selection ("want"). Removes from excludedIds and
   *  optionalIds if present (3-state mutual exclusion). */
  toggleToken: (id: string) => void;
  /** Toggle multiple tokens at once (for FamilyGroup batch toggle). Removes
   *  from excludedIds and optionalIds if present (3-state mutual exclusion). */
  toggleTokens: (ids: string[]) => void;
  /** Toggle a token's exclude state ("don't want"). Removes from selectedIds
   *  and optionalIds if present (3-state mutual exclusion). */
  toggleExclude: (ids: string[]) => void;
  /** iter 159: Toggle a token's optional state ("opt"). Removes from
   *  selectedIds and excludedIds if present (3-state mutual exclusion).
   *  Only meaningful in MIXED mode — in 'and'/'or' modes the UI typically
   *  doesn't expose this toggle, but the store accepts it regardless. */
  toggleOptional: (ids: string[]) => void;
  /** Set multiple tokens as selected */
  setSelectedIds: (ids: Set<string>) => void;
  /** Clear all selections (want + opt + exclude) */
  clearSelections: () => void;
  /** Set search text */
  setSearchText: (text: string) => void;
  /** Set affix filter */
  setAffixFilter: (filter: AffixType | null) => void;
  /** Set origin filter */
  setOriginFilter: (filter: ModOrigin | null) => void;
  /** Set extra state value for category-specific filters */
  setExtraState: (key: string, value: unknown) => void;
  /** Get extra state value */
  getExtraState: (key: string) => unknown;
  /** Set per-token numeric range override */
  setTokenRange: (tokenId: string, range: TokenRangeOverride) => void;
  /** Clear per-token numeric range override */
  clearTokenRange: (tokenId: string) => void;
  /** Reset all filters */
  resetFilters: () => void;
  /** Get the current state as a serializable object (for URL sync) */
  serialize: () => Record<string, unknown>;
  /** Restore state from a serialized object */
  deserialize: (data: Record<string, unknown>) => void;

  // ─── Phase 1 actions (iter 132, UI Refactor) ───────────────────────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 1 for full spec.

  /** Toggle a top-level group's collapsed state.
   *  Key format: `${categoryId}:${affix}`. */
  toggleGroupCollapsed: (key: string) => void;
  /** Set a top-level group's collapsed state explicitly. */
  setGroupCollapsed: (key: string, collapsed: boolean) => void;
  /** Expand ALL top-level groups (empty `collapsedGroups`).
   *  Default state — top-level groups default EXPANDED per iter 131 §13.7 correction #4. */
  expandAllGroups: () => void;
  /** Collapse ALL top-level groups by populating `collapsedGroups` with all keys.
   *  Caller must pass the full list of known top-level keys. */
  collapseAllGroups: (keys: string[]) => void;

  /** Toggle a sub-group's expanded state.
   *  Key format: `${categoryId}:${affix}:${subBlockKey}`.
   *  Sub-groups default COLLAPSED (out of set); toggling adds to `expandedSubGroups`. */
  toggleSubGroupExpanded: (key: string) => void;
  /** Set a sub-group's expanded state explicitly. */
  setSubGroupExpanded: (key: string, expanded: boolean) => void;
  /** Expand ALL sub-groups by populating `expandedSubGroups` with all keys. */
  expandAllSubGroups: (keys: string[]) => void;
  /** Collapse ALL sub-groups (empty `expandedSubGroups`). */
  collapseAllSubGroups: () => void;

  /** Toggle show-selected-only mode. */
  setShowSelectedOnly: (value: boolean) => void;

  /** Toggle a token's pinned (favorite) state. */
  togglePinned: (id: string) => void;
  /** Clear all pinned (favorite) tokens. */
  clearPinned: () => void;

  /** Toggle a sub-group's chip-expanded state (Phase 2.5 «+N ещё» feature).
   *  Key format: `${categoryId}:${affix}:${subBlockKey}`. */
  toggleChipExpand: (key: string) => void;
  /** Set a sub-group's chip-expanded state explicitly. */
  setChipExpand: (key: string, expanded: boolean) => void;
  /** Expand ALL sub-groups' chips (populate `chipExpandState` with all keys). */
  expandAllChips: (keys: string[]) => void;
  /** Collapse ALL sub-groups' chips (empty `chipExpandState`). */
  collapseAllChips: () => void;
}

export type FilterStore = FilterState & FilterActions;

/**
 * Create a filter store for a specific category.
 * Each category page gets its own independent store instance.
 */
export function createFilterStore() {
  return create<FilterStore>((set, get) => ({
    selectedIds: new Set<string>(),
    excludedIds: new Set<string>(),
    optionalIds: new Set<string>(),
    searchText: '',
    affixFilter: null,
    originFilter: null,
    extraState: {},
    perTokenRanges: {},

    // Phase 1 fields (iter 132) — defaults per iter 131 §13.7 correction #4
    collapsedGroups: new Set<string>(),    // empty = all top-level EXPANDED
    expandedSubGroups: new Set<string>(),  // empty = all sub-groups COLLAPSED
    showSelectedOnly: false,
    pinnedIds: new Set<string>(),
    chipExpandState: new Set<string>(),

    toggleToken: (id: string) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        const newExcluded = new Set(state.excludedIds);
        const newOptional = new Set(state.optionalIds);
        const wasSelected = newSet.has(id);
        if (wasSelected) {
          newSet.delete(id);
          // Clean up perTokenRanges for deselected token to avoid ghost values
          if (id in state.perTokenRanges) {
            const { [id]: _, ...rest } = state.perTokenRanges;
            return { selectedIds: newSet, excludedIds: newExcluded, optionalIds: newOptional, perTokenRanges: rest };
          }
        } else {
          newSet.add(id);
          // Remove from excludedIds AND optionalIds — 3-state mutual exclusion
          newExcluded.delete(id);
          newOptional.delete(id);
        }
        return { selectedIds: newSet, excludedIds: newExcluded, optionalIds: newOptional };
      }),

    toggleTokens: (ids: string[]) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        const newExcluded = new Set(state.excludedIds);
        const newOptional = new Set(state.optionalIds);
        // If ALL ids are selected → deselect all; otherwise → select all
        const allSelected = ids.every((id) => newSet.has(id));
        let newRanges = state.perTokenRanges;
        if (allSelected) {
          for (const id of ids) {
            newSet.delete(id);
          }
          // Clean up perTokenRanges for deselected tokens to avoid ghost values
          const rangesToDelete = new Set(ids);
          const hasRangesToDelete = Object.keys(state.perTokenRanges).some(k => rangesToDelete.has(k));
          if (hasRangesToDelete) {
            newRanges = { ...state.perTokenRanges };
            for (const id of ids) {
              delete newRanges[id];
            }
          }
        } else {
          for (const id of ids) {
            newSet.add(id);
            // Remove from excludedIds AND optionalIds — 3-state mutual exclusion
            newExcluded.delete(id);
            newOptional.delete(id);
          }
        }
        return { selectedIds: newSet, excludedIds: newExcluded, optionalIds: newOptional, perTokenRanges: newRanges };
      }),

    toggleExclude: (ids: string[]) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        const newExcluded = new Set(state.excludedIds);
        const newOptional = new Set(state.optionalIds);
        // If ALL ids are excluded → un-exclude all; otherwise → exclude all
        const allExcluded = ids.every((id) => newExcluded.has(id));
        if (allExcluded) {
          for (const id of ids) {
            newExcluded.delete(id);
          }
        } else {
          for (const id of ids) {
            newExcluded.add(id);
            // Remove from selectedIds AND optionalIds — 3-state mutual exclusion
            newSet.delete(id);
            newOptional.delete(id);
          }
        }
        return { selectedIds: newSet, excludedIds: newExcluded, optionalIds: newOptional };
      }),

    toggleOptional: (ids: string[]) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        const newExcluded = new Set(state.excludedIds);
        const newOptional = new Set(state.optionalIds);
        // If ALL ids are optional → un-optional all; otherwise → set all as optional
        const allOptional = ids.every((id) => newOptional.has(id));
        if (allOptional) {
          for (const id of ids) {
            newOptional.delete(id);
          }
        } else {
          for (const id of ids) {
            newOptional.add(id);
            // Remove from selectedIds AND excludedIds — 3-state mutual exclusion
            newSet.delete(id);
            newExcluded.delete(id);
          }
        }
        return { selectedIds: newSet, excludedIds: newExcluded, optionalIds: newOptional };
      }),

    setSelectedIds: (ids: Set<string>) =>
      set({ selectedIds: ids }),

    clearSelections: () =>
      set({ selectedIds: new Set<string>(), excludedIds: new Set<string>(), optionalIds: new Set<string>(), perTokenRanges: {} }),

    setSearchText: (text: string) =>
      set({ searchText: text }),

    setAffixFilter: (filter: AffixType | null) =>
      set({ affixFilter: filter }),

    setOriginFilter: (filter: ModOrigin | null) =>
      set({ originFilter: filter }),

    setExtraState: (key: string, value: unknown) =>
      set((state) => ({ extraState: { ...state.extraState, [key]: value } })),

    getExtraState: (key: string) => get().extraState[key],

    setTokenRange: (tokenId: string, range: TokenRangeOverride) =>
      set((state) => ({
        perTokenRanges: { ...state.perTokenRanges, [tokenId]: range },
      })),

    clearTokenRange: (tokenId: string) =>
      set((state) => {
        const { [tokenId]: _, ...rest } = state.perTokenRanges;
        return { perTokenRanges: rest };
      }),

    resetFilters: () =>
      set({
        selectedIds: new Set<string>(),
        excludedIds: new Set<string>(),
        optionalIds: new Set<string>(),
        searchText: '',
        affixFilter: null,
        originFilter: null,
        extraState: {},
        perTokenRanges: {},
        // Phase 1 (iter 132): reset new fields to defaults too
        collapsedGroups: new Set<string>(),
        expandedSubGroups: new Set<string>(),
        showSelectedOnly: false,
        pinnedIds: new Set<string>(),
        chipExpandState: new Set<string>(),
      }),

    // ─── Phase 1 actions (iter 132) ─────────────────────────────────────────
    toggleGroupCollapsed: (key: string) =>
      set((state) => {
        const newSet = new Set(state.collapsedGroups);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        return { collapsedGroups: newSet };
      }),
    setGroupCollapsed: (key: string, collapsed: boolean) =>
      set((state) => {
        const newSet = new Set(state.collapsedGroups);
        if (collapsed) newSet.add(key);
        else newSet.delete(key);
        return { collapsedGroups: newSet };
      }),
    expandAllGroups: () =>
      set({ collapsedGroups: new Set<string>() }),
    collapseAllGroups: (keys: string[]) =>
      set({ collapsedGroups: new Set<string>(keys) }),

    toggleSubGroupExpanded: (key: string) =>
      set((state) => {
        const newSet = new Set(state.expandedSubGroups);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        return { expandedSubGroups: newSet };
      }),
    setSubGroupExpanded: (key: string, expanded: boolean) =>
      set((state) => {
        const newSet = new Set(state.expandedSubGroups);
        if (expanded) newSet.add(key);
        else newSet.delete(key);
        return { expandedSubGroups: newSet };
      }),
    expandAllSubGroups: (keys: string[]) =>
      set({ expandedSubGroups: new Set<string>(keys) }),
    collapseAllSubGroups: () =>
      set({ expandedSubGroups: new Set<string>() }),

    setShowSelectedOnly: (value: boolean) =>
      set({ showSelectedOnly: value }),

    togglePinned: (id: string) =>
      set((state) => {
        const newSet = new Set(state.pinnedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return { pinnedIds: newSet };
      }),
    clearPinned: () =>
      set({ pinnedIds: new Set<string>() }),

    toggleChipExpand: (key: string) =>
      set((state) => {
        const newSet = new Set(state.chipExpandState);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        return { chipExpandState: newSet };
      }),
    setChipExpand: (key: string, expanded: boolean) =>
      set((state) => {
        const newSet = new Set(state.chipExpandState);
        if (expanded) newSet.add(key);
        else newSet.delete(key);
        return { chipExpandState: newSet };
      }),
    expandAllChips: (keys: string[]) =>
      set({ chipExpandState: new Set<string>(keys) }),
    collapseAllChips: () =>
      set({ chipExpandState: new Set<string>() }),

    serialize: () => {
      const state = get();
      const result: Record<string, unknown> = {
        s: Array.from(state.selectedIds),
        e: state.excludedIds.size > 0 ? Array.from(state.excludedIds) : undefined,
        // iter 159: optionalIds (MIXED-mode OPT tokens). Serialized under `opt`
        // (avoid clashing with existing `o` = originFilter).
        opt: state.optionalIds.size > 0 ? Array.from(state.optionalIds) : undefined,
        t: state.searchText || undefined,
        a: state.affixFilter || undefined,
        o: state.originFilter || undefined,
      };
      // Include extraState only if non-empty (for URL sharing)
      if (Object.keys(state.extraState).length > 0) {
        result.x = state.extraState;
      }
      // Include perTokenRanges only if non-empty
      if (Object.keys(state.perTokenRanges).length > 0) {
        // Compact serialization:
        // Without slotOverrides: [tokenId, min, max, filterSlotIndex]
        // With slotOverrides:    [tokenId, min, max, filterSlotIndex, [slotIdx, sMin, sMax], ...]
        result.r = Object.entries(state.perTokenRanges)
          .filter(([, v]) =>
            v.min !== undefined || v.max !== undefined ||
            (v.slotOverrides && Object.values(v.slotOverrides).some(s => s.min !== undefined || s.max !== undefined))
          )
          .map(([k, v]) => {
            const base: (string | number | null)[] = [k, v.min ?? null, v.max ?? null, v.filterSlotIndex ?? null];
            if (v.slotOverrides) {
              for (const [slotIdx, slotOverride] of Object.entries(v.slotOverrides)) {
                if (slotOverride.min !== undefined || slotOverride.max !== undefined) {
                  base.push(Number(slotIdx), slotOverride.min ?? null, slotOverride.max ?? null);
                }
              }
            }
            return base;
          });
      }
      // Phase 1 fields (iter 132) — omit keys when empty/default for URL compactness
      if (state.collapsedGroups.size > 0) {
        result.c = Array.from(state.collapsedGroups);
      }
      if (state.expandedSubGroups.size > 0) {
        result.es = Array.from(state.expandedSubGroups);
      }
      if (state.showSelectedOnly) {
        result.so = 1;
      }
      if (state.pinnedIds.size > 0) {
        result.pn = Array.from(state.pinnedIds);
      }
      if (state.chipExpandState.size > 0) {
        result.ce = Array.from(state.chipExpandState);
      }
      return result;
    },

    deserialize: (data: Record<string, unknown>) => {
      const selectedIds = new Set<string>(
        Array.isArray(data.s) ? data.s as string[] : []
      );
      const excludedIds = new Set<string>(
        Array.isArray(data.e) ? data.e as string[] : []
      );
      // iter 159: optionalIds (MIXED-mode OPT tokens). Backward-compat:
      // missing `opt` key → empty set (pre-iter-159 URLs).
      // Defensive: filter out any IDs that ended up duplicated across sets
      // (could happen if a buggy old URL had the same ID in `s` and `opt`).
      // Precedence: selectedIds > excludedIds > optionalIds (matches the
      // 3-state chip's last-write-wins semantics).
      const optionalIds = new Set<string>(
        Array.isArray(data.opt) ? (data.opt as string[]).filter((k): k is string => typeof k === 'string') : []
      );
      // Strip any ID from optionalIds that's already in selectedIds or excludedIds
      // (defensive — preserves the 3-state invariant even on malformed URLs).
      for (const id of selectedIds) optionalIds.delete(id);
      for (const id of excludedIds) optionalIds.delete(id);
      // Deserialize perTokenRanges from compact array format
      const perTokenRanges: Record<string, TokenRangeOverride> = {};
      if (Array.isArray(data.r)) {
        for (const entry of data.r as (string | number | null)[][]) {
          const tokenId = entry[0] as string;
          const override: TokenRangeOverride = {};
          const min = entry[1] as number | null;
          const max = entry[2] as number | null;
          const filterSlotIndex = entry[3] as number | null;
          if (min !== null && min !== undefined) override.min = min;
          if (max !== null && max !== undefined) override.max = max;
          if (filterSlotIndex !== null && filterSlotIndex !== undefined) override.filterSlotIndex = filterSlotIndex;
          // Parse slot overrides (triplets: slotIdx, sMin, sMax starting at index 4)
          if (entry.length > 4) {
            const slotOverrides: Record<number, SlotRangeOverride> = {};
            for (let i = 4; i + 2 < entry.length; i += 3) {
              const slotIdx = entry[i] as number;
              const sMin = entry[i + 1] as number | null;
              const sMax = entry[i + 2] as number | null;
              if (sMin !== null && sMin !== undefined || sMax !== null && sMax !== undefined) {
                slotOverrides[slotIdx] = {
                  min: sMin ?? undefined,
                  max: sMax ?? undefined,
                };
              }
            }
            if (Object.keys(slotOverrides).length > 0) {
              override.slotOverrides = slotOverrides;
            }
          }
          if (override.min !== undefined || override.max !== undefined || override.slotOverrides) {
            perTokenRanges[tokenId] = override;
          }
        }
      }
      // Phase 1 fields (iter 132) — backward-compat: missing keys → defaults
      const collapsedGroups = new Set<string>(
        Array.isArray(data.c) ? (data.c as string[]).filter((k): k is string => typeof k === 'string') : []
      );
      const expandedSubGroups = new Set<string>(
        Array.isArray(data.es) ? (data.es as string[]).filter((k): k is string => typeof k === 'string') : []
      );
      const showSelectedOnly = data.so === 1 || data.so === true;
      const pinnedIds = new Set<string>(
        Array.isArray(data.pn) ? (data.pn as string[]).filter((k): k is string => typeof k === 'string') : []
      );
      const chipExpandState = new Set<string>(
        Array.isArray(data.ce) ? (data.ce as string[]).filter((k): k is string => typeof k === 'string') : []
      );
      set({
        selectedIds,
        excludedIds,
        optionalIds,
        searchText: (data.t as string) || '',
        affixFilter: (data.a as AffixType) || null,
        originFilter: (data.o as ModOrigin) || null,
        extraState: (data.x as Record<string, unknown>) || {},
        perTokenRanges,
        collapsedGroups,
        expandedSubGroups,
        showSelectedOnly,
        pinnedIds,
        chipExpandState,
      });
    },
  }));
}
