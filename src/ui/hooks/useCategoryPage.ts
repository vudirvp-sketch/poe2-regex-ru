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
import { useState, useEffect, useMemo } from 'react';
import { loadCategoryData } from '@data/loader';
import { createFilterStore } from '@store/filter-store';
import type { CategoryData, GameToken, ASTNode, Locale, AffixType, ModOrigin } from '@shared/types';
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
  /** Round10 toggle */
  round10Enabled: boolean;
  /** Set round10 toggle */
  setRound10Enabled: (v: boolean) => void;
  /** Minimum value for ranged mods (null = no minimum, just use suffix) */
  minValue: number | null;
  /** Set minimum value for ranged mods */
  setMinValue: (v: number | null) => void;
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
  /** Set search text */
  setSearchText: (text: string) => void;
  /** Set affix filter */
  setAffixFilter: (filter: AffixType | null) => void;
  /** Set origin filter */
  setOriginFilter: (filter: ModOrigin | null) => void;
  /** Clear all selections */
  clearSelections: () => void;
}

/**
 * Build an AST from the user's filter selections.
 *
 * Logic:
 * - Selected tokens with excludeMode=false → OR group of LITERALs (wanted mods)
 * - Selected tokens with excludeMode=true → EXCLUDE(OR group) (unwanted mods)
 * - Ranged tokens with minValue set → RANGE(min, undefined, suffix)
 * - All combined with AND
 */
function buildAstFromSelections(
  selectedTokens: GameToken[],
  excludeMode: boolean,
  minValue: number | null,
  _round10: boolean,
  locale: Locale
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

  // Handle non-ranged tokens: group them into OR
  if (nonRangedTokens.length > 0) {
    const literals = nonRangedTokens.map(t =>
      literal(t.regex[locale], t.id)
    );

    if (excludeMode) {
      andChildren.push(exclude(or(...literals)));
    } else {
      if (literals.length === 1) {
        andChildren.push(literals[0]);
      } else {
        andChildren.push(or(...literals));
      }
    }
  }

  // Handle ranged tokens:
  // If minValue is set, generate numberRegex.*suffix for each
  // Otherwise, just use the family suffix regex
  if (rangedTokens.length > 0) {
    if (minValue !== null && minValue > 0) {
      // Group ranged tokens by their suffix (family)
      const suffixGroups = new Map<string, GameToken[]>();
      for (const token of rangedTokens) {
        const suffix = token.regex[locale];
        const group = suffixGroups.get(suffix) || [];
        group.push(token);
        suffixGroups.set(suffix, group);
      }

      // For each unique suffix, create a RANGE node
      for (const [suffix] of suffixGroups) {
        const rangeNode = range(minValue, undefined, suffix);
        andChildren.push(rangeNode);
      }
    } else {
      // No minimum value: just use the family suffix regex as LITERAL
      const uniqueSuffixes = [...new Set(rangedTokens.map(t => t.regex[locale]))];
      const literals = uniqueSuffixes.map(suffix => literal(suffix));

      if (excludeMode) {
        andChildren.push(exclude(or(...literals)));
      } else {
        if (literals.length === 1) {
          andChildren.push(literals[0]);
        } else {
          andChildren.push(or(...literals));
        }
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
    let searchFrom = 0;
    while (true) {
      const idx = regex.indexOf(tokenRegex, searchFrom);
      if (idx === -1) break;

      // Map yofication positions from token regex to compiled regex positions
      for (const pos of token.yoficationPositions) {
        if (pos < tokenRegex.length) {
          const mappedPos = idx + pos;
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
  const { categoryId, locale = 'ru', round10: defaultRound10 = true, extraAstNodes = [] } = config;

  const [data, setData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excludeMode, setExcludeMode] = useState(false);
  const [round10Enabled, setRound10Enabled] = useState(defaultRound10);
  const [minValue, setMinValue] = useState<number | null>(null);

  // Use Zustand store with inline subscription
  const useStore = useMemo(() => createFilterStore(), [categoryId]);

  const selectedIds = useStore(state => state.selectedIds);
  const searchText = useStore(state => state.searchText);
  const affixFilter = useStore(state => state.affixFilter);
  const originFilter = useStore(state => state.originFilter);
  const toggleToken = useStore(state => state.toggleToken);
  const setSearchText = useStore(state => state.setSearchText);
  const setAffixFilter = useStore(state => state.setAffixFilter);
  const setOriginFilter = useStore(state => state.setOriginFilter);
  const clearSelections = useStore(state => state.clearSelections);

  // Load category data on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const categoryData = await loadCategoryData(categoryId);
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
  }, [categoryId]);

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
        round10Enabled,
        locale
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
  }, [data, selectedTokens, excludeMode, minValue, round10Enabled, locale, extraAstNodes]);

  return {
    data,
    loading,
    error,
    regex,
    isRegexOverflow,
    excludeMode,
    setExcludeMode,
    round10Enabled,
    setRound10Enabled,
    minValue,
    setMinValue,
    selectedIds,
    searchText,
    affixFilter,
    originFilter,
    toggleToken,
    setSearchText,
    setAffixFilter,
    setOriginFilter,
    clearSelections,
  };
}
