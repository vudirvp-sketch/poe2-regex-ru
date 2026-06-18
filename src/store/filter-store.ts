/**
 * Filter Store — Zustand store for mod filter state.
 *
 * Manages which mods are selected, filter text, and origin/affix filters
 * for the current category page.
 */
import { create } from 'zustand';
import type { AffixType, ModOrigin, PriorityFilter } from '@shared/types';

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
  /** Set of selected token IDs ("want" mods) */
  selectedIds: Set<string>;
  /** Set of excluded token IDs ("don't want" mods).
   *  Mutually exclusive with selectedIds — a token can be either wanted or excluded, not both. */
  excludedIds: Set<string>;
  /** Text search filter */
  searchText: string;
  /** Affix type filter (null = all) */
  affixFilter: AffixType | null;
  /** Origin filter (null = all) */
  originFilter: ModOrigin | null;
  /** Priority tier filter: 'all' = show all, 'S+A' = show S and A only, 'S' = show S only */
  priorityFilter: PriorityFilter;
  /** Extra state for category-specific filters (e.g., waystone toggles, tablet types) */
  extraState: Record<string, unknown>;
  /** Per-token numeric range overrides. Key = token ID, value = {min?, max?}.
   *  When set, takes priority over global minValue/maxValue for that token.
   *  Stored in extraState for URL sync. */
  perTokenRanges: Record<string, TokenRangeOverride>;
}

/** Actions for the filter store */
export interface FilterActions {
  /** Toggle a token's selection ("want"). Removes from excludedIds if present. */
  toggleToken: (id: string) => void;
  /** Toggle multiple tokens at once (for FamilyGroup batch toggle). Removes from excludedIds if present. */
  toggleTokens: (ids: string[]) => void;
  /** Toggle a token's exclude state ("don't want"). Removes from selectedIds if present. */
  toggleExclude: (ids: string[]) => void;
  /** Set multiple tokens as selected */
  setSelectedIds: (ids: Set<string>) => void;
  /** Clear all selections (both want and exclude) */
  clearSelections: () => void;
  /** Set search text */
  setSearchText: (text: string) => void;
  /** Set affix filter */
  setAffixFilter: (filter: AffixType | null) => void;
  /** Set origin filter */
  setOriginFilter: (filter: ModOrigin | null) => void;
  /** Set priority tier filter */
  setPriorityFilter: (filter: PriorityFilter) => void;
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
    searchText: '',
    affixFilter: null,
    originFilter: null,
    priorityFilter: 'all' as PriorityFilter,
    extraState: {},
    perTokenRanges: {},

    toggleToken: (id: string) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        const newExcluded = new Set(state.excludedIds);
        const wasSelected = newSet.has(id);
        if (wasSelected) {
          newSet.delete(id);
          // Clean up perTokenRanges for deselected token to avoid ghost values
          if (id in state.perTokenRanges) {
            const { [id]: _, ...rest } = state.perTokenRanges;
            return { selectedIds: newSet, excludedIds: newExcluded, perTokenRanges: rest };
          }
        } else {
          newSet.add(id);
          // Remove from excludedIds — mutually exclusive
          newExcluded.delete(id);
        }
        return { selectedIds: newSet, excludedIds: newExcluded };
      }),

    toggleTokens: (ids: string[]) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        const newExcluded = new Set(state.excludedIds);
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
            // Remove from excludedIds — mutually exclusive
            newExcluded.delete(id);
          }
        }
        return { selectedIds: newSet, excludedIds: newExcluded, perTokenRanges: newRanges };
      }),

    toggleExclude: (ids: string[]) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        const newExcluded = new Set(state.excludedIds);
        // If ALL ids are excluded → un-exclude all; otherwise → exclude all
        const allExcluded = ids.every((id) => newExcluded.has(id));
        if (allExcluded) {
          for (const id of ids) {
            newExcluded.delete(id);
          }
        } else {
          for (const id of ids) {
            newExcluded.add(id);
            // Remove from selectedIds — mutually exclusive
            newSet.delete(id);
          }
        }
        return { selectedIds: newSet, excludedIds: newExcluded };
      }),

    setSelectedIds: (ids: Set<string>) =>
      set({ selectedIds: ids }),

    clearSelections: () =>
      set({ selectedIds: new Set<string>(), excludedIds: new Set<string>(), perTokenRanges: {} }),

    setSearchText: (text: string) =>
      set({ searchText: text }),

    setAffixFilter: (filter: AffixType | null) =>
      set({ affixFilter: filter }),

    setOriginFilter: (filter: ModOrigin | null) =>
      set({ originFilter: filter }),

    setPriorityFilter: (filter: PriorityFilter) =>
      set({ priorityFilter: filter }),

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
        searchText: '',
        affixFilter: null,
        originFilter: null,
        priorityFilter: 'all' as PriorityFilter,
        extraState: {},
        perTokenRanges: {},
      }),

    serialize: () => {
      const state = get();
      const result: Record<string, unknown> = {
        s: Array.from(state.selectedIds),
        e: state.excludedIds.size > 0 ? Array.from(state.excludedIds) : undefined,
        t: state.searchText || undefined,
        a: state.affixFilter || undefined,
        o: state.originFilter || undefined,
        p: state.priorityFilter !== 'all' ? state.priorityFilter : undefined,
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
      return result;
    },

    deserialize: (data: Record<string, unknown>) => {
      const selectedIds = new Set<string>(
        Array.isArray(data.s) ? data.s as string[] : []
      );
      const excludedIds = new Set<string>(
        Array.isArray(data.e) ? data.e as string[] : []
      );
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
      set({
        selectedIds,
        excludedIds,
        searchText: (data.t as string) || '',
        affixFilter: (data.a as AffixType) || null,
        originFilter: (data.o as ModOrigin) || null,
        priorityFilter: (data.p as PriorityFilter) || 'all',
        extraState: (data.x as Record<string, unknown>) || {},
        perTokenRanges,
      });
    },
  }));
}
