/**
 * Filter Store — Zustand store for mod filter state.
 *
 * Manages which mods are selected, filter text, and origin/affix filters
 * for the current category page.
 */
import { create } from 'zustand';
import type { AffixType, ModOrigin } from '@shared/types';

/** Per-token numeric range override */
export interface TokenRangeOverride {
  min?: number;
  max?: number;
  /** For multi-placeholder mods (e.g., "От ## до ## урона"), which slot to filter by.
   *  0 = first placeholder (min damage), 1 = second placeholder (max damage).
   *  Defaults to 0 if not specified. */
  filterSlotIndex?: number;
}

/** A single filter state for a category */
export interface FilterState {
  /** Set of selected token IDs */
  selectedIds: Set<string>;
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
}

/** Actions for the filter store */
export interface FilterActions {
  /** Toggle a token's selection */
  toggleToken: (id: string) => void;
  /** Toggle multiple tokens at once (for FamilyGroup batch toggle) */
  toggleTokens: (ids: string[]) => void;
  /** Set multiple tokens as selected */
  setSelectedIds: (ids: Set<string>) => void;
  /** Clear all selections */
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
}

export type FilterStore = FilterState & FilterActions;

/**
 * Create a filter store for a specific category.
 * Each category page gets its own independent store instance.
 */
export function createFilterStore() {
  return create<FilterStore>((set, get) => ({
    selectedIds: new Set<string>(),
    searchText: '',
    affixFilter: null,
    originFilter: null,
    extraState: {},
    perTokenRanges: {},

    toggleToken: (id: string) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return { selectedIds: newSet };
      }),

    toggleTokens: (ids: string[]) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        // If ALL ids are selected → deselect all; otherwise → select all
        const allSelected = ids.every((id) => newSet.has(id));
        if (allSelected) {
          for (const id of ids) {
            newSet.delete(id);
          }
        } else {
          for (const id of ids) {
            newSet.add(id);
          }
        }
        return { selectedIds: newSet };
      }),

    setSelectedIds: (ids: Set<string>) =>
      set({ selectedIds: ids }),

    clearSelections: () =>
      set({ selectedIds: new Set<string>() }),

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
        searchText: '',
        affixFilter: null,
        originFilter: null,
        extraState: {},
        perTokenRanges: {},
      }),

    serialize: () => {
      const state = get();
      const result: Record<string, unknown> = {
        s: Array.from(state.selectedIds),
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
        // Convert to array format for compact serialization: [[tokenId, min, max], ...]
        result.r = Object.entries(state.perTokenRanges)
          .filter(([, v]) => v.min !== undefined || v.max !== undefined)
          .map(([k, v]) => [k, v.min ?? null, v.max ?? null, v.filterSlotIndex ?? null]);
      }
      return result;
    },

    deserialize: (data: Record<string, unknown>) => {
      const selectedIds = new Set<string>(
        Array.isArray(data.s) ? data.s as string[] : []
      );
      // Deserialize perTokenRanges from array format
      let perTokenRanges: Record<string, TokenRangeOverride> = {};
      if (Array.isArray(data.r)) {
        for (const entry of data.r as [string, number | null, number | null, number | null][]) {
          const [tokenId, min, max, filterSlotIndex] = entry;
          const override: TokenRangeOverride = {};
          if (min !== null && min !== undefined) override.min = min;
          if (max !== null && max !== undefined) override.max = max;
          if (filterSlotIndex !== null && filterSlotIndex !== undefined) override.filterSlotIndex = filterSlotIndex;
          if (override.min !== undefined || override.max !== undefined) {
            perTokenRanges[tokenId] = override;
          }
        }
      }
      set({
        selectedIds,
        searchText: (data.t as string) || '',
        affixFilter: (data.a as AffixType) || null,
        originFilter: (data.o as ModOrigin) || null,
        extraState: (data.x as Record<string, unknown>) || {},
        perTokenRanges,
      });
    },
  }));
}
