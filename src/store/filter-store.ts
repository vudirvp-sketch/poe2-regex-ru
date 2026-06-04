/**
 * Filter Store — Zustand store for mod filter state.
 *
 * Manages which mods are selected, filter text, and origin/affix filters
 * for the current category page.
 */
import { create } from 'zustand';
import type { AffixType, ModOrigin } from '@shared/types';

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
}

/** Actions for the filter store */
export interface FilterActions {
  /** Toggle a token's selection */
  toggleToken: (id: string) => void;
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

    resetFilters: () =>
      set({
        selectedIds: new Set<string>(),
        searchText: '',
        affixFilter: null,
        originFilter: null,
      }),

    serialize: () => {
      const state = get();
      return {
        s: Array.from(state.selectedIds),
        t: state.searchText || undefined,
        a: state.affixFilter || undefined,
        o: state.originFilter || undefined,
      };
    },

    deserialize: (data: Record<string, unknown>) => {
      const selectedIds = new Set<string>(
        Array.isArray(data.s) ? data.s as string[] : []
      );
      set({
        selectedIds,
        searchText: (data.t as string) || '',
        affixFilter: (data.a as AffixType) || null,
        originFilter: (data.o as ModOrigin) || null,
      });
    },
  }));
}
