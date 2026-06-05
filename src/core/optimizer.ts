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
      return `R:${min}:${suffix}`;
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
 * Apply optimization table entries to the AST.
 *
 * Enhanced version: applies MULTIPLE non-overlapping optimizations
 * (not just the single best one).
 */
function applyOptimizationTable(
  ast: ASTNode,
  optimizationTable: Record<string, OptimizationEntry>,
  locale: Locale = 'ru'
): ASTNode {
  // 1. Collect all LITERAL token IDs that appear in OR groups
  const tokenIdToNode = new Map<string, { node: ASTNode; parent: ASTNode; index: number }>();

  function findLiteralsInOr(node: ASTNode): void {
    if (node.type === 'OR') {
      node.children.forEach((child, i) => {
        if (child.type === 'LITERAL' && child.tokenId) {
          tokenIdToNode.set(child.tokenId, { node: child, parent: node, index: i });
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

  // 2. Collect all viable optimizations, sorted by savings (most savings first)
  const tokenIds = Array.from(tokenIdToNode.keys());
  const candidateOptimizations: { key: string; entry: OptimizationEntry; savings: number }[] = [];

  for (let size = 2; size <= Math.min(5, tokenIds.length); size++) {
    for (const combo of combinations(tokenIds, size)) {
      const key = combo.join(':');
      const entry = optimizationTable[key];
      if (entry) {
        const individualLength = combo.reduce((sum, id) => {
          const info = tokenIdToNode.get(id);
          return sum + (info?.node.type === 'LITERAL' ? info.node.value.length : 0);
        }, 0);
        const sharedLength = entry.regex[locale]?.length ?? entry.weight;

        if (sharedLength < individualLength) {
          const savings = individualLength - sharedLength;
          candidateOptimizations.push({ key, entry, savings });
        }
      }
    }
  }

  if (candidateOptimizations.length === 0) return ast;

  // Sort by savings descending
  candidateOptimizations.sort((a, b) => b.savings - a.savings);

  // Apply optimizations greedily, skipping overlapping token IDs
  const usedTokenIds = new Set<string>();
  const appliedOptimizations: { key: string; entry: OptimizationEntry }[] = [];

  for (const opt of candidateOptimizations) {
    // Check if this optimization's token IDs overlap with already-applied ones
    const hasOverlap = opt.entry.ids.some(id => usedTokenIds.has(id));
    if (hasOverlap) continue;

    // Apply this optimization
    appliedOptimizations.push({ key: opt.key, entry: opt.entry });
    opt.entry.ids.forEach(id => usedTokenIds.add(id));
  }

  if (appliedOptimizations.length === 0) return ast;

  // 3. Apply optimizations to the AST
  let result = ast;
  for (const { key, entry } of appliedOptimizations) {
    const optimizedRegex = entry.regex[locale] ?? '';
    if (!optimizedRegex) continue;
    result = replaceWithOptimized(result, key, entry.ids, optimizedRegex);
  }

  return result;
}

function replaceWithOptimized(
  ast: ASTNode,
  key: string,
  ids: string[],
  optimizedRegex: string
): ASTNode {
  const idSet = new Set(ids);

  switch (ast.type) {
    case 'OR': {
      const optimized: ASTNode[] = [];
      const remaining: ASTNode[] = [];

      for (const child of ast.children) {
        if (child.type === 'LITERAL' && child.tokenId && idSet.has(child.tokenId)) {
          optimized.push(child);
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

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  if (size === 1) return arr.map(x => [x]);

  const result: T[][] = [];
  for (let i = 0; i <= arr.length - size; i++) {
    const rest = combinations(arr.slice(i + 1), size - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}

// Re-export collectTokenIds for convenience
export { collectTokenIds };
