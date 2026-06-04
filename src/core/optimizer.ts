import type { ASTNode, OptimizationEntry, Locale } from '@shared/types';
import { collectTokenIds } from './ast';

/**
 * Optimize an AST by replacing groups of LITERAL nodes with shorter
 * shared substrings from the optimization table.
 */
export function optimize(
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
    // Recurse into children
    if ('children' in node) {
      node.children.forEach((child) => findLiteralsInOr(child));
    }
    if (node.type === 'EXCLUDE') {
      findLiteralsInOr(node.child);
    }
  }

  findLiteralsInOr(ast);

  if (tokenIdToNode.size === 0) return ast;

  // 2. For each combination of selected token IDs, check optimizationTable
  const tokenIds = Array.from(tokenIdToNode.keys());
  const appliedOptimizations: Map<string, OptimizationEntry> = new Map();

  // Try all subsets of size 2..5 from selected tokens
  for (let size = 2; size <= Math.min(5, tokenIds.length); size++) {
    for (const combo of combinations(tokenIds, size)) {
      const key = combo.join(':');
      const entry = optimizationTable[key];
      if (entry) {
        // Compute savings: sum of individual regex lengths - shared regex length
        const individualLength = combo.reduce((sum, id) => {
          const info = tokenIdToNode.get(id);
          return sum + (info?.node.type === 'LITERAL' ? info.node.value.length : 0);
        }, 0);
        const sharedLength = entry.regex[locale]?.length ?? entry.weight;

        if (sharedLength < individualLength) {
          // Only keep the best optimization (most savings)
          const existingKey = appliedOptimizations.values().next().value;
          if (!existingKey || sharedLength < (existingKey as OptimizationEntry).weight) {
            appliedOptimizations.clear();
            appliedOptimizations.set(key, entry);
          }
        }
      }
    }
  }

  // 3. If an optimization was found, replace the OR group with optimized literal
  if (appliedOptimizations.size === 0) return ast;

  let result = ast;
  for (const [key, entry] of appliedOptimizations) {
    const optimizedRegex = entry.regex[locale] ?? '';
    if (!optimizedRegex) continue;

    // Find the OR node containing these tokens and replace the subset
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
        // All children are covered by optimization — replace entire OR with single LITERAL
        return { type: 'LITERAL', value: optimizedRegex, tokenId: `opt:${key}` };
      }

      if (optimized.length > 0) {
        // Some children covered — add optimized literal + remaining
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
