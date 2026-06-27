/**
 * useCategoryPage — Reusable hook for category pages.
 *
 * Wires together: loadCategoryData → createFilterStore → ModList + RegexOutput
 * → build AST from selections → optimize → compile → display regex.
 *
 * Each category page (Belt, Ring, Amulet, Waystone, Tablet, etc.) uses this hook
 * to avoid duplicating the data loading, AST building, and regex compilation logic.
 *
 * Supports extra AST nodes (e.g., Waystone tier/corrupted/delirious)
 * that are ANDed into the final regex.
 *
 * ─── iter 78 (Bug #8 Phase 1) ───
 * Pure AST helpers (getEffectiveRange, buildAstFromSelections, pushLiteralsWithFamilyLogic,
 * applyRuntimeYofication, etc.) extracted to ./category-ast-utils.ts.
 * Re-exported here for backward compatibility with existing tests.
 *
 * ─── iter 79 (Bug #8 Phase 2) ───
 * Split into 3 composable sub-hooks: `useFilterStore`, `useCategoryData`, `useRegexBuilder`.
 * `useCategoryPage` now composes them + keeps URL sync inline (tightly coupled to 6 useState
 * values). `useCategoryPage` accepts an optional `config.filterStore` so pages that need
 * to lazy-init local state from extraState (Waystone/Jewel/Tablet) can call `useFilterStore`
 * BEFORE their local `useState` — eliminates `react-hooks/set-state-in-effect` lint errors.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { loadCategoryData, loadMergedCategoryData } from '@data/loader';
import { createFilterStore, type FilterState, type FilterActions, type TokenRangeOverride } from '@store/filter-store';
import { syncFromUrl, syncToUrl } from '@store/url-sync';
// iter 141 (KI#26): localStorage-backed persistence for global user settings
// (round10Enabled, searchLogic, minValue, maxValue,
// thresholdEnabled, sortMode). Survives cross-tab navigation — URL hash is
// per-page and gets overwritten on each mount, so we need a stable store.
import { readLocalSetting, writeLocalSetting } from '@store/local-settings';
// iter 144 (KI#30): per-category favorites persistence (pinnedIds) —
// `poe2:favorites:<categoryId>` stores JSON-serialized `string[]` so favorites
// survive cross-tab navigation. iter 144 (KI#31 variant d): per-favorite
// range overrides stored under `poe2:favorites:<categoryId>:ranges`.
import {
  readFavorites,
  writeFavorites,
  clearFavorites,
  favoritesStorageKey,
} from '@store/local-settings';
import type { CategoryData, ASTNode, Locale, AffixType, ModOrigin, SearchLogic, SortMode } from '@shared/types';
import { and } from '@core/ast';
import { compile, type CompileOptions } from '@core/compiler';
import { optimize, collectCollapsedTokenIds } from '@core/optimizer';
import { isOverflow, splitOverLimitRegex } from '@core/limits';

// Re-export pure helpers (extracted iter 78, Bug #8 Phase 1).
// Tests import buildAstFromSelections + pushLiteralsWithFamilyLogic from this module.
export {
  buildAstFromSelections,
  pushLiteralsWithFamilyLogic,
  applyRuntimeYofication,
} from './category-ast-utils';

// Import for internal use.
import { buildAstFromSelections, applyRuntimeYofication } from './category-ast-utils';

// ─────────────────────────────────────────────────────────────────────────────
// iter 144 (KI#30): helpers for cross-tab favorites persistence.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reference-equality check for two `Set<string>` instances.
 *
 * Used by the `storage` event listener (KI#30 realtime multi-tab sync) to
 * skip spurious store updates when the new value matches the current value.
 * Without this guard, every `storage` event would call `useStore.setState`
 * with a fresh `Set` instance, triggering a re-render of every component
 * subscribed to `pinnedIds` — even when nothing actually changed.
 *
 * Returns `true` when both sets contain the same string IDs (order-independent).
 */
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** The Zustand hook returned by `createFilterStore`. Callable as a hook
 *  (`useStore(selector)`) and has `.getState()` / `.subscribe()` methods. */
export type FilterStoreHook = ReturnType<typeof createFilterStore>;

/** Configuration for a category page */
export interface CategoryPageConfig {
  /** Category ID matching the JSON filename (e.g., "belt", "ring") */
  categoryId: string;
  /** Locale for regex compilation */
  locale?: Locale;
  /** Whether to use round10 for number regex (default: false — iter 141 KI#26).
   *  Was `true` before iter 141; user feedback: most users want exact ranges,
   *  not rounded-to-10. The user's choice persists across tabs via localStorage. */
  round10?: boolean;
  /** Extra AST nodes to AND into the final regex (e.g., tier, state toggles) */
  extraAstNodes?: ASTNode[];
  /**
   * Additional category IDs to load and merge with the primary categoryId.
   * Used for multi-origin pages (e.g., jewel loads jewel-desecrated + jewel-corrupted).
   * All token arrays are concatenated; optimization tables are merged.
   */
  mergeCategories?: string[];
  /**
   * Pre-loaded CategoryData — skip async loading and use this directly.
   * Used for pages with hardcoded data (e.g., VendorPage via vendor-adapter).
   * When provided, the loading state is immediately `false` and `data` is set.
   */
  customData?: CategoryData;
  /**
   * Pre-created filter store hook (from `useFilterStore`). When provided,
   * `useCategoryPage` uses it instead of its internal one. Used by pages that
   * need to read extraState BEFORE calling `useCategoryPage` (e.g., WaystonePage's
   * corrupted/uncorrupted/delirious toggles — lazy-init from filterStore eliminates
   * `react-hooks/set-state-in-effect` lint errors).
   *
   * iter 79 (Bug #8 Phase 2): added to break the circular dependency between
   * `extraAstNodes` (depends on local state) and `useCategoryPage` (creates filterStore).
   */
  filterStore?: FilterStoreHook;
}

/** Filter store API exposed by useCategoryPage.
 *  Wraps Zustand's StoreApi with convenience methods so page components
 *  can call filterStore.serialize() / getExtraState / setExtraState
 *  directly without .getState() boilerplate.
 */
export interface FilterStoreApi {
  getState: () => FilterState & FilterActions;
  subscribe: (listener: (state: FilterState & FilterActions, prevState: FilterState & FilterActions) => void) => () => void;
  /** Serialize current filter state (for URL sharing & profile persistence) */
  serialize: () => Record<string, unknown>;
  /** Get an extraState value by key */
  getExtraState: (key: string) => unknown;
  /** Set an extraState value by key */
  setExtraState: (key: string, value: unknown) => void;
}

/** Return type of useCategoryPage */
export interface CategoryPageState {
  /** Loaded category data (null while loading) */
  data: CategoryData | null;
  /** Loading state */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Computed regex string */
  regex: string;
  /** Whether the regex overflows the 250 char limit */
  isRegexOverflow: boolean;
  /** Split regex parts when the compiled regex exceeds 250 chars.
   *  Each part is a valid regex that can be pasted separately in PoE2.
   *  Undefined when the regex is within limit or cannot be split. */
  regexParts: string[] | undefined;
  /** Selected ("want") token IDs */
  selectedIds: Set<string>;
  /** Excluded (\"don't want\") token IDs — per-mod exclude */
  excludedIds: Set<string>;
  /** Toggle a family group to excluded state */
  toggleExclude: (ids: string[]) => void;
  /** Search logic: 'and' = all conditions, 'or' = any condition */
  searchLogic: SearchLogic;
  /** Set search logic */
  setSearchLogic: (v: SearchLogic) => void;
  /** Round10 toggle */
  round10Enabled: boolean;
  /** Set round10 toggle */
  setRound10Enabled: (v: boolean) => void;
  /** Minimum value for ranged mods (null = no minimum, just use suffix) */
  minValue: number | null;
  /** Set minimum value for ranged mods */
  setMinValue: (v: number | null) => void;
  /** Maximum value for ranged mods (null = no maximum) */
  maxValue: number | null;
  /** Set maximum value for ranged mods */
  setMaxValue: (v: number | null) => void;
  /** Threshold mode: when enabled with both min+max, compiles RANGE(min,max) as ≥min only.
   *  Produces shorter regex with no FP from range notation, but drops max constraint. */
  thresholdEnabled: boolean;
  /** Set threshold mode */
  setThresholdEnabled: (v: boolean) => void;
  /** Per-token numeric range overrides */
  perTokenRanges: Record<string, TokenRangeOverride>;
  /** Set per-token numeric range override */
  setTokenRange: (tokenId: string, range: TokenRangeOverride) => void;
  /** Clear per-token numeric range override */
  clearTokenRange: (tokenId: string) => void;
  /** Search text filter */
  searchText: string;
  /** Affix type filter */
  affixFilter: AffixType | null;
  /** Origin filter */
  originFilter: ModOrigin | null;
  /**
   * Within-block sort mode (iter 106 P4).
   *  - 'alpha'      : familyKey primary, priorityTier tiebreaker (iter 99 default)
   *  - 'tier-first' : priorityTier (S→A→B→C) primary, familyKey tiebreaker (legacy)
   * Persisted in filter-store.extraState → URL hash.
   */
  sortMode: SortMode;
  /** Set within-block sort mode */
  setSortMode: (v: SortMode) => void;
  /** Toggle a token's selection */
  toggleToken: (id: string) => void;
  /** Toggle multiple tokens at once (for FamilyGroup batch toggle) */
  toggleTokens: (ids: string[]) => void;
  /** Set search text */
  setSearchText: (text: string) => void;
  /** Set affix filter */
  setAffixFilter: (filter: AffixType | null) => void;
  /** Set origin filter */
  setOriginFilter: (filter: ModOrigin | null) => void;
  /** Clear all selections */
  clearSelections: () => void;
  /** Category ID for this page */
  categoryId: string;
  /** Filter store API (stable reference with serialize/getExtraState/setExtraState) */
  filterStore: FilterStoreApi;
  /** Restore filter state from a serialized object (e.g., loaded profile) */
  restoreFilterState: (data: Record<string, unknown>) => void;
  /** Set of token IDs whose individual regex was collapsed by the optimizer.
   *  Used to show a visual indicator on chips so the user understands why
   *  clicking the chip doesn't change the regex output. */
  collapsedTokenIds: Set<string>;

  // ─── Phase 2 fields (iter 133, UI Refactor) ───────────────────────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 2 for full spec.
  // All wired to filter-store (Phase 1, iter 132) — UI consumes them in
  // ModList / VirtualizedModList via GroupHeader + row filtering.

  /** Top-level group keys currently COLLAPSED (Phase 2).
   *  Format: `${categoryId}:${affix}`. Default empty = all top-level EXPANDED. */
  collapsedGroups: Set<string>;
  /** Sub-group keys currently EXPANDED (Phase 2).
   *  Format: `${categoryId}:${affix}:${subBlockKey}`.
   *  Default empty = all sub-groups COLLAPSED (asymmetric default per iter 131 §13.7 #4). */
  expandedSubGroups: Set<string>;
  /** Toggle a top-level group's collapsed state. Key: `${categoryId}:${affix}`. */
  toggleGroupCollapsed: (key: string) => void;
  /** Toggle a sub-group's expanded state. Key: `${categoryId}:${affix}:${subBlockKey}`. */
  toggleSubGroupExpanded: (key: string) => void;
  /** Expand ALL top-level groups (empty `collapsedGroups`). */
  expandAllGroups: () => void;
  /** Collapse ALL top-level groups by populating `collapsedGroups` with all keys. */
  collapseAllGroups: (keys: string[]) => void;
  /** Expand ALL sub-groups by populating `expandedSubGroups` with all keys. */
  expandAllSubGroups: (keys: string[]) => void;
  /** Collapse ALL sub-groups (empty `expandedSubGroups`). */
  collapseAllSubGroups: () => void;

  // ─── Phase 2.5 fields (iter 134, UI Refactor) ─────────────────────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 2.5 for full spec.
  // Wires `chipExpandState` from filter-store (Phase 1, iter 132) into the UI
  // so ModList / VirtualizedModList can render «+N ещё» truncation per sub-group.

  /** Sub-group keys whose chips are fully expanded (Phase 2.5 «+N ещё»).
   *  Format: `${categoryId}:${affix}:${subBlockKey}`. Default empty = all
   *  sub-groups show truncated preview (first `CHIP_PREVIEW_COUNT` chips +
   *  important chips past the preview window). */
  chipExpandState: Set<string>;
  /** Toggle a sub-group's chip-expanded state. Key: `${categoryId}:${affix}:${subBlockKey}`. */
  toggleChipExpand: (key: string) => void;

  // ─── Phase 3 fields (iter 135, UI Refactor) ───────────────────────────────
  // See docs/UI_REFACTOR_PLAN.md §4 Phase 3 for full spec.
  // Wires `showSelectedOnly` from filter-store (Phase 1, iter 132) into the UI
  // so ModList / VirtualizedModList can hide non-selected chips + the
  // SelectedBasket panel can render in the right aside.

  /** When true, ModList/VirtualizedModList filter familyGroups to only those
   *  with at least one selected/excluded/pinned member. Default false. */
  showSelectedOnly: boolean;
  /** Toggle show-selected-only mode. Wired to filter-store.setShowSelectedOnly. */
  setShowSelectedOnly: (v: boolean) => void;

  // ─── Phase 5 fields (iter 136, UI Refactor) ───────────────────────────────
  // Wires `pinnedIds` from filter-store (Phase 1, iter 132) into the UI so
  // FavoritesIndicator renders a compact ★ N badge in the page header
  // AND FilterChip ⭐ icon button can toggle pinned state per family.

  /** Favorited token IDs (Phase 5). Renders via FavoritesIndicator (★ N badge). */
  pinnedIds: Set<string>;
  /** Toggle a token's pinned (favorite) state. Pass a single token ID — for
   *  family-level toggle, the page calls this once for the first member ID
   *  (see KI#28 family-level pin convention). */
  togglePinned: (id: string) => void;
  /** Clear all pinned (favorite) tokens. */
  clearPinned: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-hook 1: useFilterStore — create Zustand store + URL restore.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useFilterStore — create a Zustand filter store for a category page, and
 * restore its state from the URL hash once on first render.
 *
 * Pages that need to lazy-init local state from `extraState` (e.g., Waystone's
 * corrupted/uncorrupted/delirious toggles) should call this hook BEFORE their
 * local `useState`, then pass the returned `useStore` to `useCategoryPage`
 * via `config.filterStore`. This breaks the circular dependency described in
 * AGENT_NAVIGATION.md Pitfall 33.
 *
 * `categoryId` is intentionally in the dep array so each category page gets its
 * OWN filter store (selections/state must not leak across categories when the
 * user navigates between them via client-side routing). The factory closure
 * does not reference categoryId directly, so eslint's exhaustive-deps rule
 * considers it "unnecessary" — but the cache invalidation is the whole point.
 */
export function useFilterStore(categoryId: string): FilterStoreHook {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const useStore = useMemo(() => createFilterStore(), [categoryId]);

  // Restore from URL on first render (synchronous, before any effects).
  // syncFromUrl populates the filter store with data from the URL hash,
  // so all useState initializers (both here in useCategoryPage and in the
  // page component for local state) can read the correct values.
  useState(() => {
    syncFromUrl(useStore.getState());
    return true;
  });

  return useStore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-hook 2: useCategoryData — async data loading.
// ─────────────────────────────────────────────────────────────────────────────

/** Arguments for useCategoryData */
export interface UseCategoryDataArgs {
  categoryId: string;
  mergeCategories?: string[];
  /** Pre-loaded CategoryData — skip async loading. */
  customData?: CategoryData;
}

/** Return type for useCategoryData */
export interface UseCategoryDataResult {
  data: CategoryData | null;
  loading: boolean;
  error: string | null;
}

/**
 * useCategoryData — load CategoryData from JSON (or use provided customData).
 *
 * For the `customData` case (e.g., VendorPage with hardcoded data), `useState`
 * initializers set `data` and `loading` correctly, so the effect early-returns
 * without calling setState — avoids `react-hooks/set-state-in-effect`.
 */
export function useCategoryData(args: UseCategoryDataArgs): UseCategoryDataResult {
  const { categoryId, mergeCategories, customData: providedData } = args;

  const [data, setData] = useState<CategoryData | null>(providedData ?? null);
  const [loading, setLoading] = useState(!providedData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (providedData) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        let categoryData: CategoryData;
        if (mergeCategories && mergeCategories.length > 0) {
          categoryData = await loadMergedCategoryData([categoryId, ...mergeCategories]);
        } else {
          categoryData = await loadCategoryData(categoryId);
        }
        if (!cancelled) {
          setData(categoryData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [categoryId, mergeCategories, providedData]);

  return { data, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-hook 3: useRegexBuilder — AST + optimize + compile.
// ─────────────────────────────────────────────────────────────────────────────

/** Arguments for useRegexBuilder */
export interface UseRegexBuilderArgs {
  data: CategoryData | null;
  selectedIds: Set<string>;
  excludedIds: Set<string>;
  extraAstNodes: ASTNode[];
  searchLogic: SearchLogic;
  minValue: number | null;
  maxValue: number | null;
  round10Enabled: boolean;
  locale: Locale;
  perTokenRanges: Record<string, TokenRangeOverride>;
  thresholdEnabled: boolean;
}

/** Return type for useRegexBuilder */
export interface UseRegexBuilderResult {
  regex: string;
  isRegexOverflow: boolean;
  regexParts: string[] | undefined;
  collapsedTokenIds: Set<string>;
}

/**
 * useRegexBuilder — build AST from selections + extraAstNodes, optimize,
 * compile, apply yofication, split over-limit. Pure computation, no side effects.
 */
export function useRegexBuilder(args: UseRegexBuilderArgs): UseRegexBuilderResult {
  const {
    data, selectedIds, excludedIds, extraAstNodes,
    searchLogic, minValue, maxValue, round10Enabled,
    locale, perTokenRanges, thresholdEnabled,
  } = args;

  // Build selected tokens list (includes both want + exclude tokens)
  const selectedTokens = useMemo(() => {
    if (!data) return [];
    return data.tokens.filter(t => selectedIds.has(t.id) || excludedIds.has(t.id));
  }, [data, selectedIds, excludedIds]);

  // Build AST, optimize, compile
  return useMemo(() => {
    // If no mod selections AND no extra nodes → empty regex
    const hasModSelections = data && selectedTokens.length > 0;
    const hasExtraNodes = extraAstNodes.length > 0;

    if (!hasModSelections && !hasExtraNodes) {
      return { regex: '', isRegexOverflow: false, regexParts: undefined, collapsedTokenIds: new Set<string>() };
    }

    const andChildren: ASTNode[] = [];

    // 1. Build AST from mod selections (if any)
    if (hasModSelections) {
      const modAst = buildAstFromSelections(
        selectedTokens,
        excludedIds,
        minValue,
        maxValue,
        round10Enabled,
        locale,
        perTokenRanges,
        searchLogic,
        thresholdEnabled
      );
      if (modAst) {
        andChildren.push(modAst);
      }
    }

    // 2. Add extra AST nodes (e.g., waystone tier/state)
    for (const node of extraAstNodes) {
      andChildren.push(node);
    }

    if (andChildren.length === 0) {
      return { regex: '', isRegexOverflow: false, regexParts: undefined, collapsedTokenIds: new Set<string>() };
    }

    // Combine all children with AND
    const ast = andChildren.length === 1 ? andChildren[0] : and(...andChildren);

    // 3. Optimize AST using optimization table
    const optimizedAst = optimize(ast, data?.optimizationTable ?? {}, locale);

    // 4. Compile AST to regex string
    const compileOptions: CompileOptions = {
      locale,
      round10: round10Enabled,
    };
    let compiledRegex = compile(optimizedAst, compileOptions);

    // 5. Apply runtime yofication if character budget allows
    if (selectedTokens.length > 0) {
      compiledRegex = applyRuntimeYofication(compiledRegex, selectedTokens, locale);
    }

    // 6. If over limit, try to split into multiple regex parts (iter 50 — Known Issue #5)
    const overflow = isOverflow(compiledRegex);
    let regexParts: string[] | undefined;
    if (overflow) {
      regexParts = splitOverLimitRegex(compiledRegex);
      // If split produced only 1 part (no top-level |), it's an unavoidable overflow
      if (regexParts.length <= 1) {
        regexParts = undefined;
      }
    }

    return {
      regex: compiledRegex,
      isRegexOverflow: overflow,
      regexParts,
      collapsedTokenIds: optimizedAst ? collectCollapsedTokenIds(optimizedAst, data?.optimizationTable ?? {}) : new Set<string>(),
    };
  }, [data, selectedTokens, excludedIds, searchLogic, minValue, maxValue, round10Enabled, locale, extraAstNodes, perTokenRanges, thresholdEnabled]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main hook: useCategoryPage — composes the 3 sub-hooks + URL sync.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useCategoryPage — Main hook for category pages.
 *
 * Subscribes to filter store state using Zustand's subscribe/reselect pattern.
 * Supports extraAstNodes for category-specific AST additions (e.g., waystone tier/state).
 *
 * iter 79 (Bug #8 Phase 2): now composes `useFilterStore` + `useCategoryData`
 * + `useRegexBuilder`. Accepts optional `config.filterStore` so pages with
 * extraAstNodes-from-local-state (Waystone/Jewel/Tablet) can break the circular
 * dependency by calling `useFilterStore` BEFORE their local `useState`.
 */
export function useCategoryPage(config: CategoryPageConfig): CategoryPageState {
  const {
    categoryId,
    locale = 'ru',
    // iter 141 (KI#26): default `round10` flipped from `true` to `false` per
    // user request — most users want exact ranges, not rounded-to-10. Users
    // who want round10 can toggle it on; their choice persists across tabs
    // via localStorage (see useState initializer below).
    round10: defaultRound10 = false,
    extraAstNodes = [],
    mergeCategories,
    customData: providedData,
  } = config;

  // Filter store: use provided one, or create internally.
  // useFilterStore always runs (Rules of Hooks). When config.filterStore is provided,
  // internalStore is created but unused — its syncFromUrl call is a no-op on a discarded
  // store. The cost is one extra createFilterStore() per mount, negligible.
  const internalStore = useFilterStore(categoryId);
  const useStore = config.filterStore ?? internalStore;

  // Data loading (extracted to useCategoryData in iter 79).
  const { data, loading, error } = useCategoryData({
    categoryId,
    mergeCategories,
    customData: providedData,
  });

  // Initialize React state from the filter store.
  // After iter 79, useFilterStore always does URL restore before this point,
  // so we can unconditionally read from extraState. When the URL had no data,
  // extraState is empty and we fall back to defaults — equivalent to the previous
  // `if (urlRestored) { ... } return default;` pattern.
  //
  // iter 141 (KI#26): for the 6 global user-level settings (searchLogic,
  // round10Enabled, minValue, maxValue, thresholdEnabled, sortMode), we now
  // ALSO check localStorage as a fallback when neither URL nor explicit
  // default applies. Precedence: URL (shareable link) > localStorage
  // (personal cross-tab persistence) > default. The localStorage write happens
  // in the URL-sync effect below — same effect, one extra line per setting.
  const [searchLogic, setSearchLogic] = useState<SearchLogic>(() => {
    const val = useStore.getState().getExtraState('searchLogic');
    if (val === 'and' || val === 'or') return val;
    // iter 141 (KI#26): fall back to localStorage for cross-tab persistence.
    return readLocalSetting<SearchLogic>('searchLogic', 'and');
  });
  const [round10Enabled, setRound10Enabled] = useState(() => {
    const val = useStore.getState().getExtraState('round10Enabled');
    if (typeof val === 'boolean') return val;
    return readLocalSetting<boolean>('round10Enabled', defaultRound10);
  });
  const [minValue, setMinValue] = useState<number | null>(() => {
    const val = useStore.getState().getExtraState('minValue');
    if (typeof val === 'number') return val;
    return readLocalSetting<number | null>('minValue', null);
  });
  const [maxValue, setMaxValue] = useState<number | null>(() => {
    const val = useStore.getState().getExtraState('maxValue');
    if (typeof val === 'number') return val;
    return readLocalSetting<number | null>('maxValue', null);
  });
  // iter 106 (P4): sortMode toggle (alpha vs tier-first). Persisted via extraState → URL hash.
  // iter 141 (KI#26): also persisted to localStorage for cross-tab consistency.
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const val = useStore.getState().getExtraState('sortMode');
    if (val === 'alpha' || val === 'tier-first') return val;
    return readLocalSetting<SortMode>('sortMode', 'alpha');
  });
  const [thresholdEnabled, setThresholdEnabled] = useState(() => {
    const val = useStore.getState().getExtraState('thresholdEnabled');
    if (typeof val === 'boolean') return val;
    return readLocalSetting<boolean>('thresholdEnabled', false);
  });

  // Ref to skip the first sync-to-store render cycle, preventing
  // overwrite of URL-restored extraState values before page-level
  // restore effects have a chance to read them.
  const syncReadyRef = useRef(false);

  const selectedIds = useStore(state => state.selectedIds);
  const excludedIds = useStore(state => state.excludedIds);
  const searchText = useStore(state => state.searchText);
  const affixFilter = useStore(state => state.affixFilter);
  const originFilter = useStore(state => state.originFilter);
  const toggleToken = useStore(state => state.toggleToken);
  const toggleTokens = useStore(state => state.toggleTokens);
  const toggleExclude = useStore(state => state.toggleExclude);
  const setSearchText = useStore(state => state.setSearchText);
  const setAffixFilter = useStore(state => state.setAffixFilter);
  const setOriginFilter = useStore(state => state.setOriginFilter);
  const clearSelections = useStore(state => state.clearSelections);
  const perTokenRanges = useStore(state => state.perTokenRanges);
  const setTokenRange = useStore(state => state.setTokenRange);
  const clearTokenRange = useStore(state => state.clearTokenRange);

  // Phase 2 (iter 133): collapse state subscriptions.
  // These sets are immutable references from the store — Zustand returns a new
  // Set instance only when an action mutates the field, so React's reference
  // equality check correctly triggers re-renders only on actual change.
  const collapsedGroups = useStore(state => state.collapsedGroups);
  const expandedSubGroups = useStore(state => state.expandedSubGroups);
  const toggleGroupCollapsed = useStore(state => state.toggleGroupCollapsed);
  const toggleSubGroupExpanded = useStore(state => state.toggleSubGroupExpanded);
  const expandAllGroups = useStore(state => state.expandAllGroups);
  const collapseAllGroups = useStore(state => state.collapseAllGroups);
  const expandAllSubGroups = useStore(state => state.expandAllSubGroups);
  const collapseAllSubGroups = useStore(state => state.collapseAllSubGroups);

  // Phase 2.5 (iter 134): per-sub-group chip expand state subscription.
  // Same immutability contract as the other collapse fields above — Zustand
  // returns a new Set instance only on actual mutation.
  const chipExpandState = useStore(state => state.chipExpandState);
  const toggleChipExpand = useStore(state => state.toggleChipExpand);

  // Phase 3 (iter 135): show-selected-only mode subscription.
  // Wires `showSelectedOnly` boolean from filter-store (Phase 1) into the UI.
  // Toggle in CategoryControlPanel flips this → ModList/VirtualizedModList
  // filter familyGroups to only those with selected/excluded/pinned members.
  const showSelectedOnly = useStore(state => state.showSelectedOnly);
  const setShowSelectedOnly = useStore(state => state.setShowSelectedOnly);

  // Phase 5 (iter 136): pinned (favorites) state subscription.
  // Wires `pinnedIds` Set<string> from filter-store (Phase 1, iter 132) into
  // the UI. FavoritesIndicator renders a compact ★ N badge in the page header.
  // FilterChip ⭐ icon button toggles pinned state for a family via
  // `togglePinned(id)` (called per member ID). `clearPinned()` clears all.
  //
  // iter 144 (KI#30): on first mount, after URL restore, if `pinnedIds` is
  // empty (URL had no `pn` key OR KI#32 cascade-fix invalidated old keys),
  // restore from per-category localStorage `poe2:favorites:<categoryId>`.
  // User approved silent reset (Q3) — old `pn` URLs that no longer match
  // are simply dropped, no migration.
  const pinnedIds = useStore(state => state.pinnedIds);
  const togglePinned = useStore(state => state.togglePinned);
  const clearPinned = useStore(state => state.clearPinned);

  // iter 144 (KI#30): one-shot restore of pinnedIds from per-category
  // localStorage on mount. Uses useState lazy initializer so it runs BEFORE
  // the URL-sync effect's first invocation (syncReadyRef guard). When the
  // URL had pinnedIds (shareable link), those win — we don't overwrite.
  // When the URL had none, we restore from localStorage so the user's
  // favorites survive navigation/reload.
  useState(() => {
    const current = useStore.getState().pinnedIds;
    if (current.size > 0) return true; // URL already provided pinnedIds.
    const stored = readFavorites(categoryId);
    if (stored.length === 0) return true; // nothing stored — keep empty.
    // Restore: bulk-set pinnedIds via store.setState (togglePinned would
    // fire N times, one per ID — wasteful and re-triggers URL sync N times).
    // Direct set is fine here because we're inside useState initializer
    // (before any effects run, so no risk of clobbering URL restore).
    const merged = new Set(stored);
    useStore.setState({ pinnedIds: merged });
    return true;
  });

  // iter 144 (KI#30): realtime multi-tab sync via `storage` event.
  // User approved (Q4) "if stable and doesn't complicate code". The listener
  // re-reads favorites from localStorage when ANOTHER tab writes to the same
  // `poe2:favorites:<categoryId>` key. We guard against self-writes (same
  // tab doesn't fire `storage` events for its own setItem calls — this is
  // browser-native behavior, no extra check needed). Effect re-subscribes
  // whenever categoryId changes (navigation between category pages).
  useEffect(() => {
    const storageKey = 'poe2:' + favoritesStorageKey(categoryId);
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      // Re-read favorites and reconcile with current store state.
      const stored = readFavorites(categoryId);
      const storedSet = new Set(stored);
      const current = useStore.getState().pinnedIds;
      // Skip if no change (avoids spurious re-renders).
      if (setsEqual(current, storedSet)) return;
      useStore.setState({ pinnedIds: storedSet });
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [categoryId, useStore]);

  // iter 144 (KI#30): persist pinnedIds to per-category localStorage
  // whenever they change (toggle/clear). Runs as a side-effect of the
  // existing URL-sync effect (below) — that effect already re-runs on
  // pinnedIds change (added in Phase 5). We piggy-back the localStorage
  // write here so we don't need a separate effect with the same dep.
  // Empty pinnedIds → clearFavorites (removes the key entirely, keeping
  // localStorage clean — matches writeLocalSetting's omit-when-default
  // pattern for URL serialization).
  // NOTE: this runs INSIDE the URL-sync effect below (after syncReadyRef
  // guard), so the initial mount restore (above) doesn't trigger a write.

  // Sync searchLogic/minValue/round10Enabled to filter store's extraState
  // AND auto-sync filter state to URL hash.
  // Skips the first render to avoid overwriting URL-restored values.
  //
  // iter 81 (Bug "useUrlSync extract" closed as won't-fix): this URL-sync effect
  // stays inline in useCategoryPage. It's tightly coupled to the 5 useState values
  // above (searchLogic, round10Enabled, minValue, maxValue, thresholdEnabled)
  // + 7 store-side values. Extracting to a separate `useUrlSync` hook would
  // require passing all 12 values as args — awkward, the lint rule wouldn't be
  // simpler, and the coupling wouldn't actually decrease. Decision documented
  // in STATUS.md (debt list cleared iter 81).
  //
  // iter 106 (P4): sortMode added to the same sync block.
  useEffect(() => {
    if (!syncReadyRef.current) {
      syncReadyRef.current = true;
      return;
    }
    // 1. Sync React state → store extraState (so they're included in serialization)
    useStore.getState().setExtraState('searchLogic', searchLogic);
    useStore.getState().setExtraState('round10Enabled', round10Enabled);
    useStore.getState().setExtraState('minValue', minValue);
    useStore.getState().setExtraState('maxValue', maxValue);
    useStore.getState().setExtraState('thresholdEnabled', thresholdEnabled);
    useStore.getState().setExtraState('sortMode', sortMode);
    // iter 141 (KI#26): also persist these 6 global settings to localStorage
    // so they survive cross-tab navigation. URL hash gets overwritten on each
    // page mount (fresh store defaults), but localStorage is stable across
    // the entire origin. Per-category state (selectedIds, pinnedIds, etc.)
    // stays URL-only — those SHOULD reset when switching categories.
    writeLocalSetting('searchLogic', searchLogic);
    writeLocalSetting('round10Enabled', round10Enabled);
    writeLocalSetting('minValue', minValue);
    writeLocalSetting('maxValue', maxValue);
    writeLocalSetting('thresholdEnabled', thresholdEnabled);
    writeLocalSetting('sortMode', sortMode);
    // iter 144 (KI#30): persist pinnedIds to per-category localStorage so
    // favorites survive cross-tab navigation. URL `pn` key gets overwritten
    // on each page mount (fresh store defaults), but `poe2:favorites:<cat>`
    // is stable across the entire origin. Empty pinnedIds → clearFavorites
    // (keeps localStorage clean — matches writeLocalSetting's omit-when-default
    // pattern for URL serialization).
    if (pinnedIds.size > 0) {
      writeFavorites(categoryId, Array.from(pinnedIds));
    } else {
      clearFavorites(categoryId);
    }
    // 2. Auto-sync store state to URL hash
    syncToUrl(useStore.getState());
  }, [selectedIds, excludedIds, searchText, affixFilter, originFilter, perTokenRanges,
      searchLogic, round10Enabled, minValue, maxValue, thresholdEnabled, sortMode, useStore,
      // Phase 2 (iter 133): collapse state also triggers URL re-sync so that
      // toggle persistence propagates to the URL hash immediately.
      collapsedGroups, expandedSubGroups,
      // Phase 2.5 (iter 134): chip expand state also persists in URL — add to
      // deps so toggle triggers re-sync.
      chipExpandState,
      // Phase 3 (iter 135): showSelectedOnly toggle also persists in URL —
      // add to deps so toggle triggers re-sync.
      showSelectedOnly,
      // Phase 5 (iter 136): pinnedIds (favorites) also persists in URL via
      // `pn` compact key — add to deps so pin/unpin triggers re-sync.
      // iter 144 (KI#30): also persists to localStorage inside the effect
      // body — same dep triggers both URL + localStorage writes.
      pinnedIds,
      // iter 144 (KI#30): categoryId in deps so localStorage writes go to
      // the right key when navigation changes the page. (useStore already
      // changes per categoryId via useFilterStore's useMemo, but pinnedIds
      // writes need to know WHICH categoryId to write to.)
      categoryId]);

  // Regex building (extracted to useRegexBuilder in iter 79).
  const { regex, isRegexOverflow, regexParts, collapsedTokenIds } = useRegexBuilder({
    data,
    selectedIds,
    excludedIds,
    extraAstNodes,
    searchLogic,
    minValue,
    maxValue,
    round10Enabled,
    locale,
    perTokenRanges,
    thresholdEnabled,
  });

  /** Restore filter state from a serialized object (used by ProfilePanel) */
  const restoreFilterState = (data: Record<string, unknown>) => {
    useStore.getState().deserialize(data);

    // Sync React state from the restored store values.
    // excludedIds is stored in the Zustand store directly (not extraState),
    // so it's automatically restored via deserialize().
    const restored = useStore.getState();

    // iter 141 (KI#26): when the restored data doesn't contain a setting,
    // fall back to localStorage (cross-tab persistence) before the hard-coded
    // default. This ensures that loading a profile doesn't blow away the
    // user's cross-tab preferences for fields the profile didn't specify.
    const restoredLogic = restored.getExtraState('searchLogic');
    if (restoredLogic === 'and' || restoredLogic === 'or') setSearchLogic(restoredLogic);
    else setSearchLogic(readLocalSetting<SearchLogic>('searchLogic', 'and'));

    const restoredRound10 = restored.getExtraState('round10Enabled');
    if (typeof restoredRound10 === 'boolean') setRound10Enabled(restoredRound10);
    else setRound10Enabled(readLocalSetting<boolean>('round10Enabled', defaultRound10));

    const restoredMin = restored.getExtraState('minValue');
    if (typeof restoredMin === 'number') setMinValue(restoredMin);
    else setMinValue(readLocalSetting<number | null>('minValue', null));

    const restoredMax = restored.getExtraState('maxValue');
    if (typeof restoredMax === 'number') setMaxValue(restoredMax);
    else setMaxValue(readLocalSetting<number | null>('maxValue', null));

    // iter 106 (P4): restore sortMode from extraState (defaults to 'alpha' on bad value).
    // iter 141 (KI#26): fall back to localStorage before hard-coded default.
    const restoredSortMode = restored.getExtraState('sortMode');
    if (restoredSortMode === 'alpha' || restoredSortMode === 'tier-first') setSortMode(restoredSortMode);
    else setSortMode(readLocalSetting<SortMode>('sortMode', 'alpha'));

    const restoredThreshold = restored.getExtraState('thresholdEnabled');
    if (typeof restoredThreshold === 'boolean') setThresholdEnabled(restoredThreshold);
    else setThresholdEnabled(readLocalSetting<boolean>('thresholdEnabled', false));
  };

  // Create a stable FilterStoreApi wrapper that delegates convenience methods
  // to the Zustand store, so page components can call filterStore.serialize()
  // without .getState() boilerplate.
  const filterStore = useMemo<FilterStoreApi>(() => ({
    getState: useStore.getState,
    subscribe: useStore.subscribe,
    serialize: () => useStore.getState().serialize(),
    getExtraState: (key: string) => useStore.getState().getExtraState(key),
    setExtraState: (key: string, value: unknown) => useStore.getState().setExtraState(key, value),
  }), [useStore]);

  return {
    data,
    loading,
    error,
    regex,
    isRegexOverflow,
    regexParts,
    selectedIds,
    excludedIds,
    toggleExclude,
    searchLogic,
    setSearchLogic,
    round10Enabled,
    setRound10Enabled,
    minValue,
    setMinValue,
    maxValue,
    setMaxValue,
    thresholdEnabled,
    setThresholdEnabled,
    sortMode,
    setSortMode,
    perTokenRanges,
    setTokenRange,
    clearTokenRange,
    searchText,
    affixFilter,
    originFilter,
    toggleToken,
    toggleTokens,
    setSearchText,
    setAffixFilter,
    setOriginFilter,
    clearSelections,
    categoryId,
    filterStore,
    restoreFilterState,
    collapsedTokenIds,
    // Phase 2 (iter 133): collapse state + actions for ModList/VirtualizedModList
    collapsedGroups,
    expandedSubGroups,
    toggleGroupCollapsed,
    toggleSubGroupExpanded,
    expandAllGroups,
    collapseAllGroups,
    expandAllSubGroups,
    collapseAllSubGroups,
    // Phase 2.5 (iter 134): chip expand state + action for ModList/VirtualizedModList
    chipExpandState,
    toggleChipExpand,
    // Phase 3 (iter 135): show-selected-only toggle for ModList/VirtualizedModList
    // + CategoryControlPanel «Все / Выбранные» radio group.
    showSelectedOnly,
    setShowSelectedOnly,
    // Phase 5 (iter 136): pinned (favorites) for FavoritesIndicator badge +
    // FilterChip ⭐ icon button toggle.
    pinnedIds,
    togglePinned,
    clearPinned,
  };
}
