import type { ASTNode, OptimizationEntry, Locale } from '@shared/types';
import { collectTokenIds } from './ast';

/**
 * Optimize an AST by:
 *
 * 1. Deduplicating identical regex values in OR groups
 *    (when multiple tokens in the same family share the same regex string,
 *     collapse them into a single LITERAL)
 *
 * 2. Replacing groups of LITERAL nodes with shorter shared substrings
 *    from the optimization table (multiple non-overlapping optimizations)
 *
 * IMPORTANT: Phase 2 uses a "subset matching" strategy — it iterates over
 * optimization table entries and checks if the selected token IDs are a
 * subset of the entry's IDs. This is necessary because the optimization
 * table keys contain ALL family members (often 10-14 IDs), while the user
 * typically selects only a subset.
 *
 * The shared regex from the table matches ALL tokens in the family, not
 * just the selected ones. This is acceptable because:
 * - If the user selects 3 fire resistance tiers, using the shared substring
 *   "к сопротивлению огню" will match all fire resistance tiers — which is
 *   usually what the user wants (any fire resistance is acceptable).
 * - This tradeoff (shorter regex vs. slightly more permissive matching) is
 *   the same approach poe2.re intended but never implemented.
 */
export function optimize(
  ast: ASTNode,
  optimizationTable: Record<string, OptimizationEntry>,
  locale: Locale = 'ru'
): ASTNode {
  // Phase 1: Deduplicate identical regex in OR groups
  let result = deduplicateOrGroups(ast, locale);

  // Phase 2: Apply optimization table entries
  result = applyOptimizationTable(result, optimizationTable, locale);

  return result;
}

/**
 * Deduplicate identical regex values in OR groups.
 *
 * When all tokens in a mod family share the same regex (e.g., all fire resistance
 * tiers have regex "к сопротивлению огню"), their LITERAL nodes in an OR group
 * are identical. We collapse them into a single LITERAL, saving characters.
 *
 * Example:
 *   OR(LITERAL("к сопротивлению огню", id1),
 *      LITERAL("к сопротивлению огню", id2),
 *      LITERAL("к сопротивлению огню", id3))
 *   → LITERAL("к сопротивлению огню", "dedup:id1:id2:id3")
 *
 * This is the most common and impactful optimization for belt/ring/amulet categories
 * where the template-family regex algorithm produces identical regex strings for all tiers.
 */
function deduplicateOrGroups(node: ASTNode, locale: Locale): ASTNode {
  switch (node.type) {
    case 'OR': {
      // First, recursively deduplicate children
      const dedupedChildren = node.children.map(c => deduplicateOrGroups(c, locale));

      // Group children by their compiled regex value
      const valueMap = new Map<string, { children: ASTNode[]; tokenIds: string[] }>();

      for (const child of dedupedChildren) {
        // Get the "value key" for this child
        const valueKey = getValueKey(child);
        if (!valueMap.has(valueKey)) {
          valueMap.set(valueKey, { children: [], tokenIds: [] });
        }
        const group = valueMap.get(valueKey)!;
        group.children.push(child);

        if (child.type === 'LITERAL' && child.tokenId) {
          group.tokenIds.push(child.tokenId);
        }
      }

      // Rebuild OR group: one LITERAL per unique value
      const newChildren: ASTNode[] = [];
      for (const [, group] of valueMap) {
        if (group.children.length === 1) {
          newChildren.push(group.children[0]);
        } else {
          // Multiple children with the same value — collapse to single LITERAL
          const firstChild = group.children[0];
          if (firstChild.type === 'LITERAL') {
            const dedupTokenId = group.tokenIds.length > 0
              ? `dedup:${group.tokenIds.join(':')}`
              : undefined;
            newChildren.push({
              type: 'LITERAL',
              value: firstChild.value,
              tokenId: dedupTokenId,
            });
          } else {
            // Non-LITERAL children with same value key (unusual) — keep first only
            newChildren.push(firstChild);
          }
        }
      }

      // If only one child remains, unwrap the OR
      if (newChildren.length === 1) {
        return newChildren[0];
      }

      return { type: 'OR', children: newChildren };
    }

    case 'AND': {
      return {
        ...node,
        children: node.children.map(c => deduplicateOrGroups(c, locale)),
      };
    }

    case 'EXCLUDE': {
      return {
        ...node,
        child: deduplicateOrGroups(node.child, locale),
      };
    }

    default:
      return node;
  }
}

/**
 * Get a "value key" for an AST node for deduplication purposes.
 * Two nodes with the same valueKey produce the same compiled regex.
 */
function getValueKey(node: ASTNode): string {
  switch (node.type) {
    case 'LITERAL':
      return `L:${node.value}`;
    case 'RANGE': {
      const min = node.min?.toString() ?? '';
      const suffix = node.suffix ?? '';
      const prefix = node.prefix ?? '';
      const exact = node.exact?.toString() ?? '';
      return `R:${min}:${suffix}:${prefix}:${exact}`;
    }
    case 'OR':
      return `O:${node.children.map(getValueKey).join('|')}`;
    case 'AND':
      return `A:${node.children.map(getValueKey).join('|')}`;
    case 'EXCLUDE':
      return `E:${getValueKey(node.child)}`;
    default:
      return '';
  }
}

/**
 * Extract all original (bare) token IDs from a tokenId string.
 * Handles both plain IDs ("waystone.temporal_chains") and
 * dedup-prefixed IDs ("dedup:id1:id2:id3").
 */
function expandTokenId(tokenId: string | undefined): string[] {
  if (!tokenId) return [];
  if (tokenId.startsWith('dedup:')) {
    return tokenId.slice(6).split(':');
  }
  if (tokenId.startsWith('opt:')) {
    // Already optimized — skip
    return [];
  }
  return [tokenId];
}

/**
 * Apply optimization table entries to the AST.
 *
 * Strategy: Iterate over optimization table entries and check if the
 * selected token IDs are a SUBSET of the entry's IDs. If so, the shared
 * regex can replace the individual regexes, saving characters.
 *
 * The optimization table keys contain ALL family member IDs (often 10-14),
 * sorted alphabetically. The user typically selects only a subset. We check
 * subset membership rather than exact key matching.
 *
 * Only applies optimizations when the savings are positive (shared regex
 * is shorter than the sum of individual regexes).
 */
function applyOptimizationTable(
  ast: ASTNode,
  optimizationTable: Record<string, OptimizationEntry>,
  locale: Locale = 'ru'
): ASTNode {
  // 1. Collect all LITERAL token IDs that appear in OR groups
  // Map from bare token ID to the LITERAL node info
  const tokenIdToNode = new Map<string, { node: ASTNode; parent: ASTNode; index: number }>();

  function findLiteralsInOr(node: ASTNode): void {
    if (node.type === 'OR') {
      node.children.forEach((child, i) => {
        if (child.type === 'LITERAL' && child.tokenId) {
          // Expand dedup: prefixed IDs into bare IDs
          const bareIds = expandTokenId(child.tokenId);
          for (const bareId of bareIds) {
            tokenIdToNode.set(bareId, { node: child, parent: node, index: i });
          }
        }
      });
    }
    if ('children' in node) {
      node.children.forEach((child) => findLiteralsInOr(child));
    }
    if (node.type === 'EXCLUDE') {
      findLiteralsInOr(node.child);
    }
  }

  findLiteralsInOr(ast);

  if (tokenIdToNode.size === 0) return ast;

  // 2. Iterate over optimization table entries and find applicable ones
  const selectedBareIds = new Set(tokenIdToNode.keys());
  const candidateOptimizations: { entry: OptimizationEntry; savings: number; matchedIds: Set<string> }[] = [];

  for (const entry of Object.values(optimizationTable)) {
    // Check which entry IDs are in our selected set
    const matchedIds = new Set<string>();
    for (const id of entry.ids) {
      if (selectedBareIds.has(id)) {
        matchedIds.add(id);
      }
    }

    // We need at least 2 matched IDs for optimization to make sense
    if (matchedIds.size < 2) continue;

    // Calculate savings: sum of individual regex lengths minus shared regex length
    const sharedRegex = entry.regex[locale] ?? '';
    if (!sharedRegex) continue;

    let individualLength = 0;
    for (const id of matchedIds) {
      const info = tokenIdToNode.get(id);
      if (info?.node.type === 'LITERAL') {
        individualLength += info.node.value.length;
      }
    }

    // The shared regex replaces all matched individual regexes,
    // but we need to account for the | separators between them
    // Individual: "val1|val2|val3" (sum of lengths + (n-1) for | chars)
    // Shared: just the shared regex length
    const separatorsSaved = matchedIds.size - 1; // | separators no longer needed
    const totalIndividualWithSeparators = individualLength + separatorsSaved;
    const sharedLength = sharedRegex.length;

    const savings = totalIndividualWithSeparators - sharedLength;

    if (savings > 0) {
      candidateOptimizations.push({ entry, savings, matchedIds });
    }
  }

  if (candidateOptimizations.length === 0) return ast;

  // Sort by savings descending
  candidateOptimizations.sort((a, b) => b.savings - a.savings);

  // Apply optimizations greedily, skipping overlapping token IDs
  const usedBareIds = new Set<string>();
  const appliedOptimizations: { entry: OptimizationEntry; matchedIds: Set<string> }[] = [];

  for (const opt of candidateOptimizations) {
    // Check if this optimization's matched IDs overlap with already-applied ones
    const hasOverlap = [...opt.matchedIds].some(id => usedBareIds.has(id));
    if (hasOverlap) continue;

    // Apply this optimization
    appliedOptimizations.push({ entry: opt.entry, matchedIds: opt.matchedIds });
    for (const id of opt.matchedIds) {
      usedBareIds.add(id);
    }
  }

  if (appliedOptimizations.length === 0) return ast;

  // 3. Apply optimizations to the AST
  let result = ast;
  for (const { entry, matchedIds } of appliedOptimizations) {
    const optimizedRegex = entry.regex[locale] ?? '';
    if (!optimizedRegex) continue;

    // Build the opt key for tracking (sorted, like table keys)
    const optKey = [...matchedIds].sort().join(':');
    result = replaceWithOptimized(result, optKey, matchedIds, optimizedRegex);
  }

  return result;
}

function replaceWithOptimized(
  ast: ASTNode,
  key: string,
  ids: Set<string>,
  optimizedRegex: string
): ASTNode {
  switch (ast.type) {
    case 'OR': {
      const optimized: ASTNode[] = [];
      const remaining: ASTNode[] = [];

      for (const child of ast.children) {
        if (child.type === 'LITERAL' && child.tokenId) {
          // Check if any of this node's bare IDs are in the optimization set
          const bareIds = expandTokenId(child.tokenId);
          const isMatched = bareIds.some(id => ids.has(id));

          if (isMatched) {
            optimized.push(child);
          } else {
            remaining.push(child);
          }
        } else {
          remaining.push(child);
        }
      }

      if (optimized.length > 0 && optimized.length === ast.children.length) {
        return { type: 'LITERAL', value: optimizedRegex, tokenId: `opt:${key}` };
      }

      if (optimized.length > 0) {
        return {
          type: 'OR',
          children: [
            { type: 'LITERAL', value: optimizedRegex, tokenId: `opt:${key}` },
            ...remaining,
          ],
        };
      }

      return ast;
    }
    case 'AND': {
      return {
        ...ast,
        children: ast.children.map(c => replaceWithOptimized(c, key, ids, optimizedRegex)),
      };
    }
    case 'EXCLUDE': {
      return {
        ...ast,
        child: replaceWithOptimized(ast.child, key, ids, optimizedRegex),
      };
    }
    default:
      return ast;
  }
}

// Re-export collectTokenIds for convenience
export { collectTokenIds };
