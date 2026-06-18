/**
 * category-ast-utils — Pure helpers for building AST from filter selections.
 *
 * Extracted from useCategoryPage.ts (iter 78, Bug #8 Phase 1) to reduce the
 * hook file size and isolate the AST construction logic from React state.
 *
 * All functions in this file are PURE (no React, no side effects) and can be
 * unit-tested in isolation. They are re-exported from useCategoryPage.ts for
 * backward compatibility with existing tests and imports.
 *
 * Key exports:
 *   - buildAstFromSelections: Main entry — converts selected tokens + filter
 *     state into an ASTNode tree (handles ranged/non-ranged, want/exclude,
 *     AND/OR family logic, multi-slot range groups, suppressed excludes).
 *   - pushLiteralsWithFamilyLogic: Family-grouping helper for literal nodes.
 *   - applyRuntimeYofication: Post-compile yofication with char budget check.
 */
import type { GameToken, ASTNode, Locale, SearchLogic } from '@shared/types';
import type { TokenRangeOverride, SlotRangeOverride } from '@store/filter-store';
import { and, or, exclude, literal, range, multiRange } from '@core/ast';
import { applyYofication } from '@strategies/locale';

// ─── Effective range computation ───

/**
 * Get effective min/max for a token: per-token override > global fallback.
 * For multi-placeholder tokens (hasMultiPlaceholder), uses filterSlotIndex
 * from the per-token override to select the correct range slot.
 *
 * When slotOverrides is set, returns the override for each slot independently.
 * Callers should check hasSlotOverrides first and use getEffectiveRangePerSlot instead.
 */
export function getEffectiveRange(
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
export function getEffectiveRangePerSlot(
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

// ─── Prefix extraction ───

/**
 * Get the regex prefix for a specific placeholder slot in a multi-placeholder token.
 *
 * For slot 0: returns the existing token.regexPrefix (text before first ##).
 * When regexPrefix is empty and the template has text before ## (middle-number
 * patterns, types 3/9), extracts a runtime prefix from rawTextTemplate.
 *
 * For slot N>0: extracts the text between placeholder N-1 and N from rawTextTemplate,
 *   trimmed to the last 2-3 words.
 *
 * Middle-number support: "Монстры с ##% шансом..." → prefix="Монстры с"
 * This anchors the number within the block, reducing range notation FP.
 *
 * Example: "От ## до ## урона от молнии"
 *   slot 0 → "От" (text before first ##)
 *   slot 1 → "до" (text between first and second ##)
 *
 * Example: "##% повышение брони, ##% увеличение урона от атак"
 *   slot 0 → "" (nothing before first ##)
 *   slot 1 → "повышение брони" (text between first and second ##)
 */
export function getPrefixForSlot(
  token: GameToken,
  locale: Locale,
  filterSlotIndex: number
): string {
  // Slot 0: use the precomputed prefix first
  if (filterSlotIndex === 0) {
    const precomputed = token.regexPrefix[locale] ?? '';
    if (precomputed) return precomputed;

    // Middle-number pattern (types 3 and 9): if regexPrefix is empty but the
    // template has text BEFORE the first ##, extract it as a runtime prefix.
    // This provides additional anchoring for range notation FP prevention:
    // "prefix N.*suffix" is more specific than "N.*suffix".
    // E.g. "Монстры с ##% шансом..." → prefix="Монстры с"
    const template = token.rawTextTemplate[locale];
    if (!template) return '';

    // If template starts with ## or [+-]##, number is at position 0 → no prefix
    if (/^[+-]?#+/.test(template)) return '';

    // Find the first ## or # placeholder
    const firstHashIdx = template.indexOf('#');
    if (firstHashIdx <= 0) return '';

    // Extract text before the first placeholder
    let prefix = template.substring(0, firstHashIdx).trim();

    // Remove trailing non-letter characters (like '+', '(', etc.)
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
 * Detect the sign prefix (+/-) before the number placeholder in a token's template.
 *
 * Scans the rawTextTemplate for the first ## placeholder and checks if it's
 * immediately preceded by '+' or '-'. Returns:
 * - '+' if template has +## (e.g. "+##% к сопротивлению молнии")
 * - '-' if template has -## (e.g. "-##% максимум сопротивлений")
 * - undefined if no sign before ## (e.g. "##% увеличение урона")
 *
 * The sign is detected from the character immediately before the first ##.
 * This handles all positions: start (+##%), middle ("текст: +##%"), end ("текст +##").
 */
export function getSignPrefix(token: GameToken, locale: Locale): '+' | '-' | undefined {
  const template = token.rawTextTemplate[locale];
  if (!template) return undefined;

  // Find the first ## placeholder and check the character before it
  const match = template.match(/([+-])#+/);
  if (!match) return undefined;

  return match[1] === '+' ? '+' : '-';
}

// ─── Literal node construction ───

/**
 * Build a literal AST node for a token, wrapping with context/exclude as needed.
 * Shared by non-ranged and orphaned ranged token handling.
 * @param isExcluded - Whether this token is in the per-mod "exclude" set
 * @param suppressedExcludes - Exclude patterns to suppress because they conflict
 *   with other selected tokens (e.g., " интел" should be suppressed when
 *   "к интеллекту" is also selected). These patterns are removed from the
 *   regexExclude list to prevent the EXCLUDE node from blocking items that
 *   the user explicitly wants.
 */
export function buildLiteralNode(
  token: GameToken,
  locale: Locale,
  isExcluded: boolean,
  suppressedExcludes?: Set<string>
): ASTNode {
  const baseLiteral = literal(token.regex[locale], token.id);

  // If this token is excluded by user, no need for FP-prevention wrapping
  if (isExcluded) return baseLiteral;

  // If this token has a prefix context, wrap in AND with context LITERAL:
  // AND(LITERAL(context), LITERAL(regex)) compiles to "context" "regex"
  const prefixContext = token.regexPrefixContext?.[locale];
  const contextNode = prefixContext
    ? and(literal(prefixContext), baseLiteral)
    : baseLiteral;

  // If this token has exclusion patterns, wrap in AND with EXCLUDE nodes
  // Filter out suppressed excludes that conflict with other selected tokens
  const excludes = token.regexExclude?.[locale];
  const filteredExcludes = excludes?.filter(e => !suppressedExcludes?.has(e)) ?? [];
  if (filteredExcludes.length > 0) {
    if (filteredExcludes.length === 1) {
      return and(contextNode, exclude(literal(filteredExcludes[0])));
    } else {
      const excludeOrNode = exclude(or(...filteredExcludes.map(pattern => literal(pattern))));
      return and(contextNode, excludeOrNode);
    }
  }
  return contextNode;
}

/**
 * Push literal nodes into andChildren/orChildren respecting AND/OR family logic.
 *
 * - isExcluded: all nodes go into EXCLUDE(OR(...))
 * - OR mode: all nodes go into orChildren (single OR group)
 * - AND mode: group by familyKey, OR within family, AND across families.
 *   Same-family tokens (different tiers) → OR (any tier matches).
 *   Different-family tokens → AND (all selected mods must be present).
 *
 * @param tokens - Tokens corresponding 1:1 to nodes (for familyKey lookup)
 * @param nodes  - AST nodes corresponding 1:1 to tokens
 * @param isExcluded - Whether these tokens are in the "exclude" set
 */
export function pushLiteralsWithFamilyLogic(
  tokens: GameToken[],
  nodes: ASTNode[],
  locale: Locale,
  searchLogic: SearchLogic,
  isExcluded: boolean,
  andChildren: ASTNode[],
  orChildren: ASTNode[]
): void {
  if (nodes.length === 0) return;

  if (isExcluded) {
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

/**
 * Compute exclude patterns that should be suppressed because they conflict
 * with other selected "want" tokens.
 *
 * When a token has regexExclude patterns (e.g., "к ловкости" excludes " интел"
 * to prevent matching items with "к интеллекту"), those excludes become wrong
 * if the user also selected the conflicting token. In OR mode, the exclude
 * would block items the user explicitly wants. In AND mode, the exclude would
 * prevent matching items that have both attributes.
 *
 * This function checks each exclude pattern against the rawText and regex
 * of all other selected want tokens. If a pattern is a substring of any
 * other token's text, it is added to the suppressed set.
 */
export function computeSuppressedExcludes(
  wantTokens: GameToken[],
  locale: Locale
): Set<string> {
  const suppressed = new Set<string>();

  for (let i = 0; i < wantTokens.length; i++) {
    const excludes = wantTokens[i].regexExclude?.[locale];
    if (!excludes || excludes.length === 0) continue;

    for (const pattern of excludes) {
      // Check if this exclude pattern matches any OTHER want token's text
      for (let j = 0; j < wantTokens.length; j++) {
        if (i === j) continue;
        const otherRegex = wantTokens[j].regex[locale] ?? '';
        const otherRawText = wantTokens[j].rawText[locale] ?? '';
        if (otherRegex.includes(pattern) || otherRawText.includes(pattern)) {
          suppressed.add(pattern);
          break; // No need to check more tokens for this pattern
        }
      }
    }
  }

  return suppressed;
}

// ─── Main AST builder ───

/**
 * Build an AST from the user's filter selections.
 *
 * Logic:
 * - Tokens in selectedIds but NOT in excludedIds → "want" mods (LITERAL/OR/AND groups)
 * - Tokens in excludedIds → EXCLUDE(OR group) (unwanted mods)
 * - Ranged tokens with min/max set → RANGE(min, max, suffix)
 *   (compiler normalizes RANGE(min,max) into AND(RANGE(min), RANGE(undefined,max)))
 * - AND mode: group by familyKey, OR within family, AND across families.
 *   Same-family tokens (different tiers) → OR (any tier matches).
 *   Different-family tokens → AND (all selected mods must be present).
 * - OR mode: all tokens go into one OR group (any mod matches).
 * - All combined with AND
 */
export function buildAstFromSelections(
  selectedTokens: GameToken[],
  excludedIds: Set<string>,
  minValue: number | null,
  maxValue: number | null,
  _round10: boolean,
  locale: Locale,
  perTokenRanges: Record<string, TokenRangeOverride>,
  searchLogic: SearchLogic = 'and',
  thresholdEnabled: boolean = false
): ASTNode | null {
  if (selectedTokens.length === 0) return null;

  // Compute suppressed excludes: patterns that conflict with other selected want tokens.
  // This prevents exclude patterns from blocking items the user explicitly wants.
  const allWantTokens = selectedTokens.filter(t => !excludedIds.has(t.id));
  const suppressedExcludes = computeSuppressedExcludes(allWantTokens, locale);

  // Separate tokens into: ranged (have numeric ranges/values) and non-ranged
  // Also separate by exclude status (per-mod want/exclude)
  const rangedTokens: GameToken[] = [];
  const nonRangedTokens: GameToken[] = [];

  for (const token of selectedTokens) {
    if ((token.ranges.length > 0 || token.values.length > 0) && token.regex[locale]) {
      rangedTokens.push(token);
    } else {
      nonRangedTokens.push(token);
    }
  }

  const andChildren: ASTNode[] = [];
  const orChildren: ASTNode[] = []; // For OR logic: all items go into one OR group
  const excludedRangeChildren: ASTNode[] = []; // For excluded ranged tokens: wrapped in EXCLUDE(OR) at the end

  // Handle non-ranged tokens — split by exclude status
  if (nonRangedTokens.length > 0) {
    const wantTokens = nonRangedTokens.filter(t => !excludedIds.has(t.id));
    const exclTokens = nonRangedTokens.filter(t => excludedIds.has(t.id));

    if (wantTokens.length > 0) {
      const literals = wantTokens.map(t => buildLiteralNode(t, locale, false, suppressedExcludes));
      pushLiteralsWithFamilyLogic(wantTokens, literals, locale, searchLogic, false, andChildren, orChildren);
    }
    if (exclTokens.length > 0) {
      const literals = exclTokens.map(t => buildLiteralNode(t, locale, true));
      pushLiteralsWithFamilyLogic(exclTokens, literals, locale, searchLogic, true, andChildren, orChildren);
    }
  }

  // Handle ranged tokens with per-token or global numeric ranges
  if (rangedTokens.length > 0) {
    // Propagate perTokenRanges across family groups:
    // FilterChip stores range overrides only on the first ranged member of a family
    // group. Other members with the same familyKey need the same override to avoid
    // becoming orphaned LITERAL nodes (which produce duplicate quoted groups).
    const propagatedRanges: Record<string, TokenRangeOverride> = { ...perTokenRanges };
    const familyGroups = new Map<string, GameToken[]>();
    for (const token of rangedTokens) {
      const family = token.familyKey[locale];
      if (!familyGroups.has(family)) familyGroups.set(family, []);
      familyGroups.get(family)!.push(token);
    }
    for (const [, members] of familyGroups) {
      const overrideMember = members.find(t => perTokenRanges[t.id]);
      if (overrideMember) {
        const override = perTokenRanges[overrideMember.id];
        for (const member of members) {
          if (!propagatedRanges[member.id]) {
            propagatedRanges[member.id] = override;
          }
        }
      }
    }

    // Determine if ANY token has an effective min/max (including slot overrides)
    const tokensWithSlots = rangedTokens.map(token => ({
      token,
      slots: getEffectiveRangePerSlot(token, minValue, maxValue, propagatedRanges),
    }));

    const anyHasRange = tokensWithSlots.some(
      ({ slots }) => slots.some(s => (s.min !== null && s.min > 0) || (s.max !== null && s.max > 0))
    );

    if (anyHasRange) {
      // Track which tokens are handled by range groups (have effective min/max)
      const handledTokenIds = new Set<string>();

      // Group ranged tokens by (prefix, min, max, exact, slotIndex, isExcluded) — NOT by suffix.
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
        isExcluded: boolean;
        signPrefix: '+' | '-' | undefined;
      }>();
      // ═══════════════════════════════════════════════════
      // MULTI_RANGE: Dual-number mods with 2+ filtered slots
      // ═══════════════════════════════════════════════════
      // For dual-number mods (e.g., "Добавляет от X до Y физического урона к атакам"),
      // when the user sets filters on BOTH slots, we create a single MULTI_RANGE node
      // that compiles to ONE quoted group: "Добавляет от ([6-9]|\d{2,}).*до (1[2-9]|\d{3,}).*урона к атакам"
      //
      // This is more reliable than AND-ing two separate quoted groups because:
      // 1. Both numbers must match in the SAME block (no cross-block matching)
      // 2. The regex is shorter (one group vs two)
      // 3. No risk of each quoted group matching a different mod line
      //
      // We also fix broken suffixes from ETL: some multi-placeholder tokens have
      // suffixes containing range notation like "4—20) физического урона к атакам".
      // We detect and repair these by extracting the suffix from the template instead.
      const multiRangeTokens = new Set<string>(); // token IDs handled by MULTI_RANGE

      // Group multi-slot tokens by (suffix, slot0_data, slot1_data, exact, isExcluded)
      // This allows merging tokens with the same combined pattern
      const multiRangeGroups = new Map<string, {
        suffix: string;
        slots: Array<{ min?: number; max?: number; prefix: string }>;
        exact: boolean;
        isExcluded: boolean;
        tokens: GameToken[];
      }>();

      for (const { token, slots } of tokensWithSlots) {
        if (!token.hasMultiPlaceholder) continue;
        if (slots.length < 2) continue; // Need 2+ slots for MULTI_RANGE

        const isExcluded = excludedIds.has(token.id);
        const isPerToken = !!propagatedRanges[token.id];

        // Repair broken suffix: if suffix contains ')' or '—', it's from ETL bug
        // Extract clean suffix from the template instead
        let suffix = token.regex[locale];
        if (suffix.includes(')') || suffix.includes('—')) {
          const template = token.rawTextTemplate[locale];
          const parts = template.split(/#+/);
          const lastPart = parts[parts.length - 1].replace(/^[^a-zA-Zа-яА-ЯёЁ]*/, '').trim();
          if (lastPart && !lastPart.includes(')') && !lastPart.includes('—')) {
            suffix = lastPart;
          }
        }

        // Build slot data for MULTI_RANGE
        const multiSlots: Array<{ min?: number; max?: number; prefix: string }> = [];
        for (const slot of slots) {
          const hasMin = slot.min !== null && slot.min > 0;
          const hasMax = slot.max !== null && slot.max > 0;
          if (!hasMin && !hasMax) continue;

          const prefix = getPrefixForSlot(token, locale, slot.slotIndex);
          multiSlots.push({
            min: hasMin ? slot.min! : undefined,
            max: hasMax ? slot.max! : undefined,
            prefix,
          });
        }

        if (multiSlots.length < 2) continue; // Still need 2+ effective slots

        // Group key: combine suffix + slot data for merging
        const slotKey = multiSlots.map(s => `${s.prefix}::${s.min ?? ''}::${s.max ?? ''}`).join('||');
        const groupKey = `${suffix}::${slotKey}::${isPerToken}::${isExcluded ? 'excl' : 'want'}`;

        const existing = multiRangeGroups.get(groupKey);
        if (existing) {
          existing.tokens.push(token);
        } else {
          multiRangeGroups.set(groupKey, {
            suffix,
            slots: multiSlots,
            exact: isPerToken,
            isExcluded,
            tokens: [token],
          });
        }

        multiRangeTokens.add(token.id);
      }

      // Create MULTI_RANGE nodes
      for (const [, group] of multiRangeGroups) {
        const mrNode = multiRange(group.slots, group.suffix, group.exact || undefined, thresholdEnabled || undefined);

        // Wrap with prefix context and exclude nodes (same as RANGE)
        let nodeWithExcludes: ASTNode = mrNode;
        if (!group.isExcluded) {
          const contexts = [...new Set(
            group.tokens.map(t => t.regexPrefixContext?.[locale] ?? '').filter(c => c.length > 0)
          )];
          if (contexts.length === 1) {
            nodeWithExcludes = and(literal(contexts[0]), nodeWithExcludes);
          }

          const allExcludes: string[] = [];
          for (const token of group.tokens) {
            const excludes = token.regexExclude?.[locale];
            if (excludes) {
              for (const pattern of excludes) {
                if (!allExcludes.includes(pattern) && !suppressedExcludes.has(pattern)) {
                  allExcludes.push(pattern);
                }
              }
            }
          }
          if (allExcludes.length > 0) {
            if (allExcludes.length === 1) {
              nodeWithExcludes = and(mrNode, exclude(literal(allExcludes[0])));
            } else {
              const excludeOrNode = exclude(or(...allExcludes.map(pattern => literal(pattern))));
              nodeWithExcludes = and(mrNode, excludeOrNode);
            }
          }
        }

        if (group.isExcluded) {
          excludedRangeChildren.push(nodeWithExcludes);
        } else if (searchLogic === 'or') {
          orChildren.push(nodeWithExcludes);
        } else {
          andChildren.push(nodeWithExcludes);
        }
      }

      // ═══════════════════════════════════════════════════
      // RANGE: Single-slot and single-placeholder tokens
      // ═══════════════════════════════════════════════════
      // For tokens with only ONE filtered slot (including multi-placeholder tokens
      // where only one slot has a filter), use the existing RANGE node approach.

      for (const { token, slots } of tokensWithSlots) {
        // Skip tokens already handled by MULTI_RANGE
        if (multiRangeTokens.has(token.id)) {
          handledTokenIds.add(token.id);
          continue;
        }

        const suffix = token.regex[locale];
        const isPerToken = !!propagatedRanges[token.id];
        const isExcluded = excludedIds.has(token.id);

        let tokenHasEffectiveSlot = false;
        for (const slot of slots) {
          const hasMin = slot.min !== null && slot.min > 0;
          const hasMax = slot.max !== null && slot.max > 0;
          if (!hasMin && !hasMax) continue;

          tokenHasEffectiveSlot = true;
          const prefix = getPrefixForSlot(token, locale, slot.slotIndex);

          // Detect sign prefix from rawTextTemplate: +## or -## before the number
          const signPrefix = getSignPrefix(token, locale);

          // Group by (prefix, min, max, exact, slotIndex, isExcluded, signPrefix) — NOT by suffix
          const groupKey = `${prefix}::${hasMin ? slot.min : ''}::${hasMax ? slot.max : ''}::${isPerToken}::slot${slot.slotIndex}::${isExcluded ? 'excl' : 'want'}::sign${signPrefix ?? ''}`;

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
              isExcluded,
              signPrefix,
            });
          }
        }
        if (tokenHasEffectiveSlot) {
          handledTokenIds.add(token.id);
        }
      }

      // For each unique (prefix, min, max, exact, isExcluded) group, create a RANGE node
      // with OR-joined suffixes if multiple unique suffixes exist
      for (const [, group] of rangeGroups) {
        // Join multiple suffixes with | — compiler will wrap in () when needed
        const suffixStr = group.suffixes.length > 1
          ? group.suffixes.join('|')
          : group.suffixes[0];

        // Determine anchorStart: true when rawTextTemplate starts with ## or [+-]##
        // With signPrefix, the number is still at position 0 — just with a sign before it
        const numberAtStart = group.tokens.some(t => {
          const template = t.rawTextTemplate[locale];
          return template && /^[+-]?##/.test(template);
        });

        const numberFollowedByPercent = group.tokens.some(t => {
          const template = t.rawTextTemplate[locale];
          return template && /^[+]?##%/.test(template);
        });
        const anchorEndValue = (!numberAtStart && numberFollowedByPercent) ? '%' : undefined;

        const isImplicit = group.tokens.some(t => t.affix === 'implicit');

        const numberAtEnd = !numberAtStart && group.tokens.some(t => {
          const template = t.rawTextTemplate[locale];
          return template && /##\s*$/.test(template);
        });
        const isReversed = isImplicit || numberAtEnd;

        const colonAnchor = !isImplicit && isReversed && !anchorEndValue && group.tokens.some(t => {
          const template = t.rawTextTemplate[locale];
          return template && /:\s*##\s*$/.test(template);
        });

        const rangeNode = range(group.min, group.max, suffixStr, group.prefix || undefined, group.exact || undefined, isReversed ? false : (numberAtStart || undefined), anchorEndValue, isReversed || undefined, colonAnchor || undefined, thresholdEnabled || undefined, group.signPrefix);

        // Wrap RANGE with prefix context and exclude nodes
        let nodeWithExcludes: ASTNode = rangeNode;
        if (!group.isExcluded) {
          // Add prefix context if available (only when all tokens share the same context)
          const contexts = [...new Set(
            group.tokens.map(t => t.regexPrefixContext?.[locale] ?? '').filter(c => c.length > 0)
          )];
          if (contexts.length === 1) {
            nodeWithExcludes = and(literal(contexts[0]), nodeWithExcludes);
          }

          // Collect unique exclude patterns from all tokens in this range group
          // Filter out suppressed excludes that conflict with other selected tokens
          const allExcludes: string[] = [];
          for (const token of group.tokens) {
            const excludes = token.regexExclude?.[locale];
            if (excludes) {
              for (const pattern of excludes) {
                if (!allExcludes.includes(pattern) && !suppressedExcludes.has(pattern)) {
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
        // When isExcluded: nodeWithExcludes stays as raw rangeNode.
        // It will be collected into orChildren and wrapped in EXCLUDE(OR) at the end.

        if (group.isExcluded) {
          excludedRangeChildren.push(nodeWithExcludes);
        } else if (searchLogic === 'or') {
          orChildren.push(nodeWithExcludes);
        } else {
          andChildren.push(nodeWithExcludes);
        }
      }

      // Handle orphaned ranged tokens (have ranges but no effective min/max).
      // These tokens are not covered by any range group — treat as LITERAL suffix.
      const orphanedTokens = rangedTokens.filter(t => !handledTokenIds.has(t.id));
      if (orphanedTokens.length > 0) {
        const wantOrphans = orphanedTokens.filter(t => !excludedIds.has(t.id));
        const exclOrphans = orphanedTokens.filter(t => excludedIds.has(t.id));

        if (wantOrphans.length > 0) {
          const uniqueSuffixOrphans = [...new Map(wantOrphans.map(t => [t.regex[locale], t])).values()];
          const orphanLiterals = uniqueSuffixOrphans.map(t => buildLiteralNode(t, locale, false, suppressedExcludes));
          pushLiteralsWithFamilyLogic(uniqueSuffixOrphans, orphanLiterals, locale, searchLogic, false, andChildren, orChildren);
        }
        if (exclOrphans.length > 0) {
          const uniqueSuffixOrphans = [...new Map(exclOrphans.map(t => [t.regex[locale], t])).values()];
          const orphanLiterals = uniqueSuffixOrphans.map(t => buildLiteralNode(t, locale, true));
          pushLiteralsWithFamilyLogic(uniqueSuffixOrphans, orphanLiterals, locale, searchLogic, true, andChildren, orChildren);
        }
      }
    } else {
      // No effective min/max: just use the family suffix regex as LITERAL
      const wantRanged = rangedTokens.filter(t => !excludedIds.has(t.id));
      const exclRanged = rangedTokens.filter(t => excludedIds.has(t.id));

      if (wantRanged.length > 0) {
        const uniqueSuffixTokens = [...new Map(wantRanged.map(t => [t.regex[locale], t])).values()];
        const literals = uniqueSuffixTokens.map(t => buildLiteralNode(t, locale, false, suppressedExcludes));
        pushLiteralsWithFamilyLogic(uniqueSuffixTokens, literals, locale, searchLogic, false, andChildren, orChildren);
      }
      if (exclRanged.length > 0) {
        const uniqueSuffixTokens = [...new Map(exclRanged.map(t => [t.regex[locale], t])).values()];
        const literals = uniqueSuffixTokens.map(t => buildLiteralNode(t, locale, true));
        pushLiteralsWithFamilyLogic(uniqueSuffixTokens, literals, locale, searchLogic, true, andChildren, orChildren);
      }
    }
  }

  // Combine orChildren into andChildren
  if (orChildren.length > 0) {
    if (searchLogic === 'or') {
      // OR mode: all selected mods go into a single OR group
      if (orChildren.length === 1) {
        andChildren.push(orChildren[0]);
      } else {
        andChildren.push(or(...orChildren));
      }
    } else {
      // AND mode: orChildren should have been pushed to andChildren individually,
      // but if any ended up here, handle them
      for (const child of orChildren) {
        andChildren.push(child);
      }
    }
  }

  // Wrap excluded ranged tokens in EXCLUDE(OR(...))
  if (excludedRangeChildren.length > 0) {
    const excludedOrNode = excludedRangeChildren.length === 1
      ? excludedRangeChildren[0]
      : or(...excludedRangeChildren);
    andChildren.push(exclude(excludedOrNode));
  }

  if (andChildren.length === 0) return null;
  if (andChildren.length === 1) return andChildren[0];
  return and(...andChildren);
}

// ─── Runtime yofication ───

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
export function applyRuntimeYofication(
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
