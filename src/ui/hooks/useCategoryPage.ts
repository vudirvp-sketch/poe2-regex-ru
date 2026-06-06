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
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { loadCategoryData, loadMergedCategoryData } from '@data/loader';
import { createFilterStore, type FilterState, type FilterActions, type TokenRangeOverride } from '@store/filter-store';
import { syncFromUrl } from '@store/url-sync';
import type { CategoryData, GameToken, ASTNode, Locale, AffixType, ModOrigin, SearchLogic } from '@shared/types';
import { and, or, exclude, literal, range } from '@core/ast';
import { compile, type CompileOptions } from '@core/compiler';
import { optimize } from '@core/optimizer';
import { isOverflow } from '@core/limits';
import { applyYofication } from '@strategies/locale';

/** Configuration for a category page */
export interface CategoryPageConfig {
  /** Category ID matching the JSON filename (e.g., "belt", "ring") */
  categoryId: string;
  /** Locale for regex compilation */
  locale?: Locale;
  /** Whether to use round10 for number regex (default: true) */
  round10?: boolean;
  /** Extra AST nodes to AND into the final regex (e.g., tier, state toggles) */
  extraAstNodes?: ASTNode[];
  /**
   * Additional category IDs to load and merge with the primary categoryId.
   * Used for multi-origin pages (e.g., jewel loads jewel-desecrated + jewel-corrupted).
   * All token arrays are concatenated; optimization tables are merged.
   */
  mergeCategories?: string[];
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
  /** Toggle: whether "exclude" mode is active for selected mods */
  excludeMode: boolean;
  /** Set exclude mode */
  setExcludeMode: (v: boolean) => void;
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
  /** Per-token numeric range overrides */
  perTokenRanges: Record<string, TokenRangeOverride>;
  /** Set per-token numeric range override */
  setTokenRange: (tokenId: string, range: TokenRangeOverride) => void;
  /** Clear per-token numeric range override */
  clearTokenRange: (tokenId: string) => void;
  /** Selected token IDs */
  selectedIds: Set<string>;
  /** Search text filter */
  searchText: string;
  /** Affix type filter */
  affixFilter: AffixType | null;
  /** Origin filter */
  originFilter: ModOrigin | null;
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
}



/**
 * Build an AST from the user's filter selections.
 *
 * Logic:
 * - Selected tokens with excludeMode=false → OR group of LITERALs (wanted mods)
 * - Selected tokens with excludeMode=true → EXCLUDE(OR group) (unwanted mods)
 * - Ranged tokens with min/max set → RANGE(min, max, suffix)
 *   (compiler normalizes RANGE(min,max) into AND(RANGE(min), RANGE(undefined,max)))
 * - All combined with AND
 */
/**
 * Get effective min/max for a token: per-token override > global fallback.
 * For multi-placeholder tokens (hasMultiPlaceholder), uses filterSlotIndex
 * from the per-token override to select the correct range slot.
 */
function getEffectiveRange(
  token: GameToken,
  globalMin: number | null,
  globalMax: number | null,
  perTokenRanges: Record<string, TokenRangeOverride>
): { min: number | null; max: number | null; filterSlotIndex: number } {
  const override = perTokenRanges[token.id];
  const filterSlotIndex = override?.filterSlotIndex ?? 0;

  if (override) {
    return {
      min: override.min ?? globalMin,
      max: override.max ?? globalMax,
      filterSlotIndex,
    };
  }
  return { min: globalMin, max: globalMax, filterSlotIndex: 0 };
}

/**
 * Get the regex prefix for a specific placeholder slot in a multi-placeholder token.
 *
 * For slot 0: returns the existing token.regexPrefix (text before first ##).
 * For slot N>0: extracts the text between placeholder N-1 and N from rawTextTemplate,
 *   trimmed to the last 2-3 words (same logic as extractTemplatePrefix in compute-regex.ts).
 *
 * Example: "От ## до ## урона от молнии"
 *   slot 0 → "От" (text before first ##)
 *   slot 1 → "до" (text between first and second ##)
 *
 * Example: "##% повышение брони, ##% увеличение урона от атак"
 *   slot 0 → "" (nothing before first ##)
 *   slot 1 → "повышение брони" (text between first and second ##)
 */
function getPrefixForSlot(
  token: GameToken,
  locale: Locale,
  filterSlotIndex: number
): string {
  // Slot 0: use the precomputed prefix
  if (filterSlotIndex === 0) {
    return token.regexPrefix[locale] ?? '';
  }

  // For non-zero slots, extract from the template at runtime
  if (!token.hasMultiPlaceholder) return token.regexPrefix[locale] ?? '';

  const template = token.rawTextTemplate[locale];
  if (!template) return '';

  // Split template by ## or # sequences to get text segments between placeholders
  const parts = template.split(/#+/);
  // parts[0] = before first #, parts[1] = between 1st and 2nd #, etc.
  // We need parts[filterSlotIndex] = text before the (filterSlotIndex+1)th placeholder
  if (filterSlotIndex >= parts.length) return '';

  let prefix = parts[filterSlotIndex].trim();

  // Remove trailing non-letter characters (commas, spaces, etc.)
  prefix = prefix.replace(/[^a-zA-Zа-яА-ЯёЁ]+$/, '');

  // If the prefix is too short (< 2 chars), it's not useful for anchoring
  if (prefix.length < 2) return '';

  // Take the last 2-3 words for a short prefix
  const words = prefix.split(/\s+/);
  if (words.length > 3) {
    prefix = words.slice(-3).join(' ');
    if (prefix.length > 25) {
      const twoWords = words.slice(-2).join(' ');
      if (twoWords.length >= 2) prefix = twoWords;
    }
  }

  return prefix;
}

function buildAstFromSelections(
  selectedTokens: GameToken[],
  excludeMode: boolean,
  minValue: number | null,
  maxValue: number | null,
  _round10: boolean,
  locale: Locale,
  perTokenRanges: Record<string, TokenRangeOverride>,
  searchLogic: SearchLogic = 'and'
): ASTNode | null {
  if (selectedTokens.length === 0) return null;

  // Separate tokens into: ranged (have numeric ranges) and non-ranged
  const rangedTokens: GameToken[] = [];
  const nonRangedTokens: GameToken[] = [];

  for (const token of selectedTokens) {
    if (token.ranges.length > 0 && token.regex[locale]) {
      rangedTokens.push(token);
    } else {
      nonRangedTokens.push(token);
    }
  }

  const andChildren: ASTNode[] = [];
  const orChildren: ASTNode[] = []; // For OR logic: all items go into one OR group

  // Handle non-ranged tokens: group them into OR
  if (nonRangedTokens.length > 0) {
    const literals = nonRangedTokens.map(t =>
      literal(t.regex[locale], t.id)
    );

    if (excludeMode) {
      andChildren.push(exclude(or(...literals)));
    } else {
      if (searchLogic === 'or') {
        orChildren.push(...literals);
      } else {
        if (literals.length === 1) {
          andChildren.push(literals[0]);
        } else {
          andChildren.push(or(...literals));
        }
      }
    }
  }

  // Handle ranged tokens with per-token or global numeric ranges
  if (rangedTokens.length > 0) {
    // Determine if ANY token has an effective min/max
    const tokensWithRange = rangedTokens.map(token => ({
      token,
      effective: getEffectiveRange(token, minValue, maxValue, perTokenRanges),
    }));

    const anyHasRange = tokensWithRange.some(
      ({ effective }) => (effective.min !== null && effective.min > 0) || (effective.max !== null && effective.max > 0)
    );

    if (anyHasRange) {
      // Group ranged tokens by suffix + prefix + effective range
      // Each unique (suffix, prefix, min, max, isPerToken) combination gets its own RANGE node
      // Per-token range → exact=true (no round10), global range → exact=false (use round10)
      const rangeGroups = new Map<string, {
        suffix: string;
        prefix: string;
        min: number | undefined;
        max: number | undefined;
        exact: boolean;
        tokens: GameToken[];
      }>();
      for (const { token, effective } of tokensWithRange) {
        const suffix = token.regex[locale];
        // Use slot-specific prefix: for filterSlotIndex=0 use precomputed prefix,
        // for filterSlotIndex>0 extract from template at runtime
        const prefix = getPrefixForSlot(token, locale, effective.filterSlotIndex);
        const hasMin = effective.min !== null && effective.min > 0;
        const hasMax = effective.max !== null && effective.max > 0;

        // Per-token range override → exact (no round10); global range → not exact
        const isPerToken = !!perTokenRanges[token.id];

        // Create a group key that includes prefix, filterSlotIndex, and whether it's per-token exact
        // This ensures tokens with different filterSlotIndex or prefixes get separate RANGE nodes
        const groupKey = `${suffix}::${prefix}::${hasMin ? effective.min : ''}::${hasMax ? effective.max : ''}::${isPerToken}::slot${effective.filterSlotIndex}`;

        const existing = rangeGroups.get(groupKey);
        if (existing) {
          existing.tokens.push(token);
        } else {
          rangeGroups.set(groupKey, {
            suffix,
            prefix: prefix,
            min: hasMin ? effective.min! : undefined,
            max: hasMax ? effective.max! : undefined,
            exact: isPerToken,  // per-token range → exact regex (no round10)
            tokens: [token],
          });
        }
      }

      // For each unique (suffix, prefix, min, max, exact) combination, create a RANGE node
      for (const [, group] of rangeGroups) {
        const rangeNode = range(group.min, group.max, group.suffix, group.prefix || undefined, group.exact || undefined);
        if (searchLogic === 'or') {
          // In OR mode, each RANGE node becomes part of the OR alternatives
          // But RANGE nodes can't be OR'd with LITERALs directly in PoE2 regex.
          // Instead, we keep them as AND children but the compiler will handle
          // the difference: OR mode compiles ranges differently.
          // For OR mode with ranges: each range becomes a separate alternative
          // wrapped in its own quoted group, and they're OR'd with the other alternatives.
          orChildren.push(rangeNode);
        } else {
          andChildren.push(rangeNode);
        }
      }
    } else {
      // No effective min/max: just use the family suffix regex as LITERAL
      const uniqueSuffixes = [...new Set(rangedTokens.map(t => t.regex[locale]))];
      const literals = uniqueSuffixes.map(suffix => literal(suffix));

      if (excludeMode) {
        andChildren.push(exclude(or(...literals)));
      } else {
        if (searchLogic === 'or') {
          orChildren.push(...literals);
        } else {
          if (literals.length === 1) {
            andChildren.push(literals[0]);
          } else {
            andChildren.push(or(...literals));
          }
        }
      }
    }
  }

  // Combine children based on search logic
  if (searchLogic === 'or' && orChildren.length > 0) {
    // OR mode: all selected mods go into a single OR group
    // This means the item only needs to match ANY ONE of the selected mods
    // The compiler will produce a single quoted group: "A|B|C|D"
    if (excludeMode) {
      // In exclude mode with OR logic: exclude any of the selected mods
      andChildren.push(exclude(or(...orChildren)));
    } else {
      if (orChildren.length === 1) {
        andChildren.push(orChildren[0]);
      } else {
        andChildren.push(or(...orChildren));
      }
    }
  }

  if (andChildren.length === 0) return null;
  if (andChildren.length === 1) return andChildren[0];
  return and(...andChildren);
}

/**
 * Apply yofication to the compiled regex string.
 * Checks character budget and applies [её] replacements where allowed.
 *
 * IMPORTANT: After optimizer Phase 2, the original token.regex[locale] may not
 * appear verbatim in the compiled regex (e.g., if the optimizer replaced multiple
 * tokens with a shared substring from the optimization table). In that case,
 * yofication silently skips those tokens — this is correct behavior because:
 * 1. The optimization table entries don't track yofication positions
 * 2. The game treats 'е' and 'ё' as equivalent in search, so yofication is
 *    a "nice to have" that improves matching accuracy but is not required
 * 3. Silently skipping is safer than applying yofication at wrong positions
 *
 * To improve robustness, this function tries to find token regexes in the
 * compiled string using both exact match and substring fallback.
 */
function applyRuntimeYofication(
  regex: string,
  tokens: GameToken[],
  locale: Locale
): string {
  // Collect all yofication positions from selected tokens
  // that appear in the regex string
  const allPositions: number[] = [];

  for (const token of tokens) {
    if (!token.hasYofication || token.yoficationPositions.length === 0) continue;

    const tokenRegex = token.regex[locale];
    if (!tokenRegex) continue;

    // Find occurrences of the token regex in the compiled regex
    // Try exact match first, then try progressively shorter substrings
    // (in case the optimizer modified the token regex)
    const candidates = [tokenRegex];
    // If token regex has spaces or special chars, try shorter suffixes
    if (tokenRegex.length > 5) {
      // Try last N chars (most likely to be unique suffix)
      for (let len = Math.min(tokenRegex.length - 1, 8); len >= 4; len--) {
        candidates.push(tokenRegex.slice(-len));
      }
    }

    for (const candidate of candidates) {
      let searchFrom = 0;
      while (true) {
        const idx = regex.indexOf(candidate, searchFrom);
        if (idx === -1) break;

        // Map yofication positions from token regex to compiled regex positions
        // Only apply positions that fall within the matched candidate range
        const offsetInToken = tokenRegex.length - candidate.length;
        for (const pos of token.yoficationPositions) {
          // Adjust position relative to the candidate substring
          const adjustedPos = pos - offsetInToken;
          if (adjustedPos >= 0 && adjustedPos < candidate.length) {
            const mappedPos = idx + adjustedPos;
            // Check that the character at this position is 'е' or 'ё'
            const ch = regex[mappedPos];
            if (ch === 'е' || ch === 'ё' || ch === 'Е' || ch === 'Ё') {
              if (!allPositions.includes(mappedPos)) {
                allPositions.push(mappedPos);
              }
            }
          }
        }

        searchFrom = idx + 1;
      }
    }
  }

  if (allPositions.length === 0) return regex;

  // Sort positions in ascending order
  allPositions.sort((a, b) => a - b);

  // Apply yofication with character budget check
  const MAX_CHARS = 250;
  const canAfford = (extraChars: number) => (regex.length + extraChars) <= MAX_CHARS;

  return applyYofication(regex, allPositions, canAfford);
}

/**
 * useCategoryPage — Main hook for category pages.
 *
 * Subscribes to filter store state using Zustand's subscribe/reselect pattern.
 * Supports extraAstNodes for category-specific AST additions (e.g., waystone tier/state).
 */
export function useCategoryPage(config: CategoryPageConfig): CategoryPageState {
  const { categoryId, locale = 'ru', round10: defaultRound10 = true, extraAstNodes = [], mergeCategories } = config;

  const [data, setData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use Zustand store with inline subscription
  const useStore = useMemo(() => createFilterStore(), [categoryId]);

  // Restore from URL on first render (synchronous, before any effects).
  // syncFromUrl populates the filter store with data from the URL hash,
  // so all useState initializers below can read the correct values.
  const [urlRestored] = useState(() => syncFromUrl(useStore.getState()));

  // Initialize React state from the filter store (which may have URL data).
  // These are generic state values shared by ALL category pages.
  // They are synced to extraState for inclusion in share URLs.
  const [excludeMode, setExcludeMode] = useState(() => {
    if (urlRestored) {
      const val = useStore.getState().getExtraState('excludeMode');
      if (typeof val === 'boolean') return val;
    }
    return false;
  });
  const [searchLogic, setSearchLogic] = useState<SearchLogic>(() => {
    if (urlRestored) {
      const val = useStore.getState().getExtraState('searchLogic');
      if (val === 'and' || val === 'or') return val;
    }
    return 'and';
  });
  const [round10Enabled, setRound10Enabled] = useState(() => {
    if (urlRestored) {
      const val = useStore.getState().getExtraState('round10Enabled');
      if (typeof val === 'boolean') return val;
    }
    return defaultRound10;
  });
  const [minValue, setMinValue] = useState<number | null>(() => {
    if (urlRestored) {
      const val = useStore.getState().getExtraState('minValue');
      if (typeof val === 'number') return val;
    }
    return null;
  });
  const [maxValue, setMaxValue] = useState<number | null>(() => {
    if (urlRestored) {
      const val = useStore.getState().getExtraState('maxValue');
      if (typeof val === 'number') return val;
    }
    return null;
  });

  // Ref to skip the first sync-to-store render cycle, preventing
  // overwrite of URL-restored extraState values before page-level
  // restore effects have a chance to read them.
  const syncReadyRef = useRef(false);

  const selectedIds = useStore(state => state.selectedIds);
  const searchText = useStore(state => state.searchText);
  const affixFilter = useStore(state => state.affixFilter);
  const originFilter = useStore(state => state.originFilter);
  const toggleToken = useStore(state => state.toggleToken);
  const toggleTokens = useStore(state => state.toggleTokens);
  const setSearchText = useStore(state => state.setSearchText);
  const setAffixFilter = useStore(state => state.setAffixFilter);
  const setOriginFilter = useStore(state => state.setOriginFilter);
  const clearSelections = useStore(state => state.clearSelections);
  const perTokenRanges = useStore(state => state.perTokenRanges);
  const setTokenRange = useStore(state => state.setTokenRange);
  const clearTokenRange = useStore(state => state.clearTokenRange);

  // Load category data on mount
  useEffect(() => {
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
  }, [categoryId, mergeCategories]);

  // Sync excludeMode/minValue/round10Enabled to filter store's extraState
  // so they are included in share URLs. Skips the first render to avoid
  // overwriting URL-restored values before page-level restore effects run.
  useEffect(() => {
    if (!syncReadyRef.current) {
      syncReadyRef.current = true;
      return;
    }
    useStore.getState().setExtraState('excludeMode', excludeMode);
    useStore.getState().setExtraState('searchLogic', searchLogic);
    useStore.getState().setExtraState('round10Enabled', round10Enabled);
    useStore.getState().setExtraState('minValue', minValue);
    useStore.getState().setExtraState('maxValue', maxValue);
  }, [excludeMode, searchLogic, round10Enabled, minValue, maxValue, useStore]);

  // Build selected tokens list
  const selectedTokens = useMemo(() => {
    if (!data) return [];
    return data.tokens.filter(t => selectedIds.has(t.id));
  }, [data, selectedIds]);

  // Build AST, optimize, compile
  const { regex, isRegexOverflow } = useMemo(() => {
    // If no mod selections AND no extra nodes → empty regex
    const hasModSelections = data && selectedTokens.length > 0;
    const hasExtraNodes = extraAstNodes.length > 0;

    if (!hasModSelections && !hasExtraNodes) {
      return { regex: '', isRegexOverflow: false };
    }

    const andChildren: ASTNode[] = [];

    // 1. Build AST from mod selections (if any)
    if (hasModSelections) {
      const modAst = buildAstFromSelections(
        selectedTokens,
        excludeMode,
        minValue,
        maxValue,
        round10Enabled,
        locale,
        perTokenRanges,
        searchLogic
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
      return { regex: '', isRegexOverflow: false };
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

    return {
      regex: compiledRegex,
      isRegexOverflow: isOverflow(compiledRegex),
    };
  }, [data, selectedTokens, excludeMode, searchLogic, minValue, maxValue, round10Enabled, locale, extraAstNodes, perTokenRanges]);

  /** Restore filter state from a serialized object (used by ProfilePanel) */
  const restoreFilterState = (data: Record<string, unknown>) => {
    useStore.getState().deserialize(data);
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
    excludeMode,
    setExcludeMode,
    searchLogic,
    setSearchLogic,
    round10Enabled,
    setRound10Enabled,
    minValue,
    setMinValue,
    maxValue,
    setMaxValue,
    perTokenRanges,
    setTokenRange,
    clearTokenRange,
    selectedIds,
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
  };
}
