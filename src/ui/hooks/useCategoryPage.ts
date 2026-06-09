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
import { createFilterStore, type FilterState, type FilterActions, type TokenRangeOverride, type SlotRangeOverride } from '@store/filter-store';
import { syncFromUrl, syncToUrl } from '@store/url-sync';
import type { CategoryData, GameToken, ASTNode, Locale, AffixType, ModOrigin, SearchLogic, PriorityFilter } from '@shared/types';
import { and, or, exclude, literal, range } from '@core/ast';
import { compile, type CompileOptions } from '@core/compiler';
import { optimize, collectCollapsedTokenIds } from '@core/optimizer';
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
  /** Priority tier filter */
  priorityFilter: PriorityFilter;
  /** Set priority tier filter */
  setPriorityFilter: (v: PriorityFilter) => void;
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
}



/**
 * Build an AST from the user's filter selections.
 *
 * Logic:
 * - Selected tokens with excludeMode=false → OR group of LITERALs (wanted mods)
 * - Selected tokens with excludeMode=true → EXCLUDE(OR group) (unwanted mods)
 * - Ranged tokens with min/max set → RANGE(min, max, suffix)
 *   (compiler normalizes RANGE(min,max) into AND(RANGE(min), RANGE(undefined,max)))
 * - AND mode: group by familyKey, OR within family, AND across families.
 *   Same-family tokens (different tiers) → OR (any tier matches).
 *   Different-family tokens → AND (all selected mods must be present).
 * - OR mode: all tokens go into one OR group (any mod matches).
 * - All combined with AND
 */
/**
 * Get effective min/max for a token: per-token override > global fallback.
 * For multi-placeholder tokens (hasMultiPlaceholder), uses filterSlotIndex
 * from the per-token override to select the correct range slot.
 *
 * When slotOverrides is set, returns the override for each slot independently.
 * Callers should check hasSlotOverrides first and use getEffectiveRangePerSlot instead.
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
 * Get effective range for each slot in a multi-placeholder token.
 * Returns an array of { slotIndex, min, max } for each slot that has a range override.
 * Falls back to single-slot mode when slotOverrides is not set.
 */
function getEffectiveRangePerSlot(
  token: GameToken,
  globalMin: number | null,
  globalMax: number | null,
  perTokenRanges: Record<string, TokenRangeOverride>
): Array<{ slotIndex: number; min: number | null; max: number | null }> {
  const override = perTokenRanges[token.id];

  if (!override?.slotOverrides || Object.keys(override.slotOverrides).length === 0) {
    // Fallback to single-slot mode
    const effective = getEffectiveRange(token, globalMin, globalMax, perTokenRanges);
    if (effective.min === null && effective.max === null) return [];
    return [{ slotIndex: effective.filterSlotIndex, min: effective.min, max: effective.max }];
  }

  // Dual-slot mode: return overrides for each slot
  const result: Array<{ slotIndex: number; min: number | null; max: number | null }> = [];
  const slotCount = token.ranges.length;

  for (let i = 0; i < slotCount; i++) {
    const slotOverride: SlotRangeOverride = override.slotOverrides[i] ?? {};
    const slotMin = slotOverride.min ?? (i === (override.filterSlotIndex ?? 0) ? override.min : null) ?? globalMin;
    const slotMax = slotOverride.max ?? (i === (override.filterSlotIndex ?? 0) ? override.max : null) ?? globalMax;
    if (slotMin !== null || slotMax !== null) {
      result.push({ slotIndex: i, min: slotMin, max: slotMax });
    }
  }

  return result;
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

/**
 * Build a literal AST node for a token, wrapping with context/exclude as needed.
 * Shared by non-ranged and orphaned ranged token handling.
 */
function buildLiteralNode(
  token: GameToken,
  locale: Locale,
  excludeMode: boolean
): ASTNode {
  const baseLiteral = literal(token.regex[locale], token.id);

  // If this token has a prefix context, wrap in AND with context LITERAL:
  // AND(LITERAL(context), LITERAL(regex)) compiles to "context" "regex"
  const prefixContext = token.regexPrefixContext?.[locale];
  const contextNode = prefixContext
    ? and(literal(prefixContext), baseLiteral)
    : baseLiteral;

  // If this token has exclusion patterns, wrap in AND with EXCLUDE nodes
  const excludes = token.regexExclude?.[locale];
  if (excludes && excludes.length > 0 && !excludeMode) {
    if (excludes.length === 1) {
      return and(contextNode, exclude(literal(excludes[0])));
    } else {
      const excludeOrNode = exclude(or(...excludes.map(pattern => literal(pattern))));
      return and(contextNode, excludeOrNode);
    }
  }
  return contextNode;
}

/**
 * Push literal nodes into andChildren/orChildren respecting AND/OR family logic.
 *
 * - excludeMode: all nodes go into EXCLUDE(OR(...))
 * - OR mode: all nodes go into orChildren (single OR group)
 * - AND mode: group by familyKey, OR within family, AND across families.
 *   Same-family tokens (different tiers) → OR (any tier matches).
 *   Different-family tokens → AND (all selected mods must be present).
 *
 * @param tokens - Tokens corresponding 1:1 to nodes (for familyKey lookup)
 * @param nodes  - AST nodes corresponding 1:1 to tokens
 */
export function pushLiteralsWithFamilyLogic(
  tokens: GameToken[],
  nodes: ASTNode[],
  locale: Locale,
  searchLogic: SearchLogic,
  excludeMode: boolean,
  andChildren: ASTNode[],
  orChildren: ASTNode[]
): void {
  if (nodes.length === 0) return;

  if (excludeMode) {
    andChildren.push(exclude(or(...nodes)));
    return;
  }

  if (searchLogic === 'or') {
    orChildren.push(...nodes);
    return;
  }

  // AND mode: group by familyKey, OR within family, AND across families
  const familyGroups = new Map<string, ASTNode[]>();
  for (let i = 0; i < nodes.length; i++) {
    const family = tokens[i].familyKey[locale];
    if (!familyGroups.has(family)) {
      familyGroups.set(family, []);
    }
    familyGroups.get(family)!.push(nodes[i]);
  }

  for (const [, familyNodes] of familyGroups) {
    if (familyNodes.length === 1) {
      andChildren.push(familyNodes[0]);
    } else {
      // Same family, different tiers → OR (any tier matches)
      andChildren.push(or(...familyNodes));
    }
  }
}

export function buildAstFromSelections(
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

  // Handle non-ranged tokens
  if (nonRangedTokens.length > 0) {
    const literals = nonRangedTokens.map(t => buildLiteralNode(t, locale, excludeMode));
    pushLiteralsWithFamilyLogic(nonRangedTokens, literals, locale, searchLogic, excludeMode, andChildren, orChildren);
  }

  // Handle ranged tokens with per-token or global numeric ranges
  if (rangedTokens.length > 0) {
    // Determine if ANY token has an effective min/max (including slot overrides)
    const tokensWithSlots = rangedTokens.map(token => ({
      token,
      slots: getEffectiveRangePerSlot(token, minValue, maxValue, perTokenRanges),
    }));

    const anyHasRange = tokensWithSlots.some(
      ({ slots }) => slots.some(s => (s.min !== null && s.min > 0) || (s.max !== null && s.max > 0))
    );

    if (anyHasRange) {
      // Track which tokens are handled by range groups (have effective min/max)
      const handledTokenIds = new Set<string>();

      // Group ranged tokens by (prefix, min, max, exact, slotIndex) — NOT by suffix.
      // This allows merging tokens with different suffixes but the same numeric
      // range into a single RANGE node with OR-joined suffixes.
      const rangeGroups = new Map<string, {
        suffixes: string[];
        prefix: string;
        min: number | undefined;
        max: number | undefined;
        exact: boolean;
        slotIndex: number;
        tokens: GameToken[];
      }>();
      for (const { token, slots } of tokensWithSlots) {
        const suffix = token.regex[locale];
        const isPerToken = !!perTokenRanges[token.id];

        let tokenHasEffectiveSlot = false;
        for (const slot of slots) {
          const hasMin = slot.min !== null && slot.min > 0;
          const hasMax = slot.max !== null && slot.max > 0;
          if (!hasMin && !hasMax) continue;

          tokenHasEffectiveSlot = true;
          const prefix = getPrefixForSlot(token, locale, slot.slotIndex);

          // Group by (prefix, min, max, exact, slotIndex) — NOT by suffix
          const groupKey = `${prefix}::${hasMin ? slot.min : ''}::${hasMax ? slot.max : ''}::${isPerToken}::slot${slot.slotIndex}`;

          const existing = rangeGroups.get(groupKey);
          if (existing) {
            existing.tokens.push(token);
            // Add suffix if not already in the group
            if (!existing.suffixes.includes(suffix)) {
              existing.suffixes.push(suffix);
            }
          } else {
            rangeGroups.set(groupKey, {
              suffixes: [suffix],
              prefix: prefix,
              min: hasMin ? slot.min! : undefined,
              max: hasMax ? slot.max! : undefined,
              exact: isPerToken,
              slotIndex: slot.slotIndex,
              tokens: [token],
            });
          }
        }
        if (tokenHasEffectiveSlot) {
          handledTokenIds.add(token.id);
        }
      }

      // For each unique (prefix, min, max, exact) group, create a RANGE node
      // with OR-joined suffixes if multiple unique suffixes exist
      for (const [, group] of rangeGroups) {
        // Join multiple suffixes with | — compiler will wrap in () when needed
        const suffixStr = group.suffixes.length > 1
          ? group.suffixes.join('|')
          : group.suffixes[0];

        // Determine anchorStart: true when rawTextTemplate starts with ##
        // (number at position 0 of the mod block).
        // This enables ^ anchor in the compiled regex, preventing range notation FP.
        // Verified in-game (Phase 9b): ^ anchors to start of mod block in PoE2.
        const numberAtStart = group.tokens.some(t => {
          const template = t.rawTextTemplate[locale];
          return template && /^##/.test(template);
        });

        // Determine anchorEnd: when rawTextTemplate has ##% (number followed by %),
        // suffix anchoring adds '%' after the number pattern to prevent range notation FP.
        // Verified in-game (Phase 9c): (2[7-9]|30)%.*suffix prevents FP because
        // numbers in range notation (e.g. 27 from (27-50)) are NOT followed by %.
        // Only set when anchorStart=false (for +##% mods where ^ cannot be used),
        // because ^ already prevents FP for ##% mods and anchorEnd has FN risk
        // on items where the actual roll has range notation (e.g. 27(22-27)%).
        const numberFollowedByPercent = group.tokens.some(t => {
          const template = t.rawTextTemplate[locale];
          return template && /^[\+]?##%/.test(template);
        });
        // Use anchorEnd only when anchorStart is false — for +##% accessory mods.
        // For ##% mods (tablets/waystones), anchorStart=true with ^ is sufficient.
        const anchorEndValue = (!numberAtStart && numberFollowedByPercent) ? '%' : undefined;

        const rangeNode = range(group.min, group.max, suffixStr, group.prefix || undefined, group.exact || undefined, numberAtStart || undefined, anchorEndValue);

        // Wrap RANGE with prefix context and exclude nodes
        let nodeWithExcludes: ASTNode = rangeNode;
        if (!excludeMode) {
          // Add prefix context if available (only when all tokens share the same context)
          const contexts = [...new Set(
            group.tokens.map(t => t.regexPrefixContext?.[locale] ?? '').filter(c => c.length > 0)
          )];
          if (contexts.length === 1) {
            nodeWithExcludes = and(literal(contexts[0]), nodeWithExcludes);
          }

          // Collect unique exclude patterns from all tokens in this range group
          const allExcludes: string[] = [];
          for (const token of group.tokens) {
            const excludes = token.regexExclude?.[locale];
            if (excludes) {
              for (const pattern of excludes) {
                if (!allExcludes.includes(pattern)) {
                  allExcludes.push(pattern);
                }
              }
            }
          }
          if (allExcludes.length > 0) {
            if (allExcludes.length === 1) {
              nodeWithExcludes = and(rangeNode, exclude(literal(allExcludes[0])));
            } else {
              const excludeOrNode = exclude(or(...allExcludes.map(pattern => literal(pattern))));
              nodeWithExcludes = and(rangeNode, excludeOrNode);
            }
          }
        }

        if (searchLogic === 'or') {
          orChildren.push(nodeWithExcludes);
        } else {
          andChildren.push(nodeWithExcludes);
        }
      }

      // Handle orphaned ranged tokens (have ranges but no effective min/max).
      // These tokens are not covered by any range group — treat as LITERAL suffix.
      const orphanedTokens = rangedTokens.filter(t => !handledTokenIds.has(t.id));
      if (orphanedTokens.length > 0) {
        const uniqueSuffixOrphans = [...new Map(orphanedTokens.map(t => [t.regex[locale], t])).values()];
        const orphanLiterals = uniqueSuffixOrphans.map(t => buildLiteralNode(t, locale, excludeMode));
        pushLiteralsWithFamilyLogic(uniqueSuffixOrphans, orphanLiterals, locale, searchLogic, excludeMode, andChildren, orChildren);
      }
    } else {
      // No effective min/max: just use the family suffix regex as LITERAL
      const uniqueSuffixTokens = [...new Map(rangedTokens.map(t => [t.regex[locale], t])).values()];
      const literals = uniqueSuffixTokens.map(t => buildLiteralNode(t, locale, excludeMode));
      pushLiteralsWithFamilyLogic(uniqueSuffixTokens, literals, locale, searchLogic, excludeMode, andChildren, orChildren);
    }
  }

  // Combine orChildren into andChildren
  if (searchLogic === 'or' && orChildren.length > 0) {
    // OR mode: all selected mods go into a single OR group
    if (excludeMode) {
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
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(() => {
    if (urlRestored) {
      const val = useStore.getState().getExtraState('priorityFilter');
      if (val === 'all' || val === 'S+A' || val === 'S') return val;
    }
    return 'all';
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
  // AND auto-sync filter state to URL hash.
  // Skips the first render to avoid overwriting URL-restored values.
  useEffect(() => {
    if (!syncReadyRef.current) {
      syncReadyRef.current = true;
      return;
    }
    // 1. Sync React state → store extraState (so they're included in serialization)
    useStore.getState().setExtraState('excludeMode', excludeMode);
    useStore.getState().setExtraState('searchLogic', searchLogic);
    useStore.getState().setExtraState('round10Enabled', round10Enabled);
    useStore.getState().setExtraState('minValue', minValue);
    useStore.getState().setExtraState('maxValue', maxValue);
    useStore.getState().setExtraState('priorityFilter', priorityFilter);
    // 2. Auto-sync store state to URL hash
    syncToUrl(useStore.getState());
  }, [selectedIds, searchText, affixFilter, originFilter, perTokenRanges,
      excludeMode, searchLogic, round10Enabled, minValue, maxValue, priorityFilter, useStore]);

  // Build selected tokens list
  const selectedTokens = useMemo(() => {
    if (!data) return [];
    return data.tokens.filter(t => selectedIds.has(t.id));
  }, [data, selectedIds]);

  // Build AST, optimize, compile
  const { regex, isRegexOverflow, collapsedIds: collapsedTokenIds } = useMemo(() => {
    // If no mod selections AND no extra nodes → empty regex
    const hasModSelections = data && selectedTokens.length > 0;
    const hasExtraNodes = extraAstNodes.length > 0;

    if (!hasModSelections && !hasExtraNodes) {
      return { regex: '', isRegexOverflow: false, collapsedIds: new Set<string>() };
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
      return { regex: '', isRegexOverflow: false, collapsedIds: new Set<string>() };
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
      collapsedIds: optimizedAst ? collectCollapsedTokenIds(optimizedAst, data?.optimizationTable ?? {}) : new Set<string>(),
    };
  }, [data, selectedTokens, excludeMode, searchLogic, minValue, maxValue, round10Enabled, locale, extraAstNodes, perTokenRanges]);

  /** Restore filter state from a serialized object (used by ProfilePanel) */
  const restoreFilterState = (data: Record<string, unknown>) => {
    useStore.getState().deserialize(data);

    // Sync React state from the restored store values.
    // Without this, the UI controls (excludeMode, searchLogic, etc.) would
    // show stale values even though the Zustand store has been updated.
    const restored = useStore.getState();
    const restoredExclude = restored.getExtraState('excludeMode');
    if (typeof restoredExclude === 'boolean') setExcludeMode(restoredExclude);
    else setExcludeMode(false);

    const restoredLogic = restored.getExtraState('searchLogic');
    if (restoredLogic === 'and' || restoredLogic === 'or') setSearchLogic(restoredLogic);
    else setSearchLogic('and');

    const restoredRound10 = restored.getExtraState('round10Enabled');
    if (typeof restoredRound10 === 'boolean') setRound10Enabled(restoredRound10);
    else setRound10Enabled(defaultRound10);

    const restoredMin = restored.getExtraState('minValue');
    if (typeof restoredMin === 'number') setMinValue(restoredMin);
    else setMinValue(null);

    const restoredMax = restored.getExtraState('maxValue');
    if (typeof restoredMax === 'number') setMaxValue(restoredMax);
    else setMaxValue(null);

    const restoredPriority = restored.getExtraState('priorityFilter');
    if (restoredPriority === 'all' || restoredPriority === 'S+A' || restoredPriority === 'S') setPriorityFilter(restoredPriority);
    else setPriorityFilter('all');
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
    priorityFilter,
    setPriorityFilter,
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
    collapsedTokenIds,
  };
}
