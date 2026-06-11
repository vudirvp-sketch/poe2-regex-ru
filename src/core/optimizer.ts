/**
 * Optimizer entry point: orchestrates all optimization phases and provides
 * the public API for AST optimization.
 *
 * Optimize an AST by:
 *
 * 1. Deduplicating identical regex values in OR groups
 *    (when multiple tokens in the same family share the same regex string,
 *     collapse them into a single LITERAL)
 *
 * 2. Replacing groups of LITERAL nodes with shorter shared substrings
 *    from the optimization table (multiple non-overlapping optimizations)
 *
 * 3. Truncating suffixes using verified safe list
 *
 * Module structure (since iteration 19):
 *   optimizer.ts                — Entry point: optimize() + collectCollapsedTokenIds + re-exports
 *   core-optimizations.ts       — Phase 1 deduplication + shared utilities
 *   optimization-strategies.ts  — Phase 2 optimization table + Phase 3 suffix truncation + data
 */

import type { ASTNode, OptimizationEntry, Locale } from '@shared/types';
import { deduplicateOrGroups } from './core-optimizations';
import { applyOptimizationTable, truncateSuffixes } from './optimization-strategies';

/**
 * Main optimization entry point.
 * Applies all three optimization phases in order:
 * 1. Deduplicate identical regex in OR groups
 * 2. Apply optimization table entries
 * 3. Truncate suffixes using verified safe list
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

  // Phase 3: Truncate suffixes using verified safe list
  result = truncateSuffixes(result, locale);

  return result;
}

/**
 * Collect token IDs that were collapsed by the optimizer.
 *
 * After optimization, some LITERAL nodes get tokenId="opt:..." indicating
 * they were replaced with a shared regex from the optimization table.
 * Since the opt key contains sorted IDs joined by ':' and IDs themselves
 * contain ':', we cannot reliably extract IDs from the key. Instead,
 * we pass the optimizationTable so we can look up which IDs each
 * optimization entry covers.
 *
 * Also detects dedup: prefixed IDs from Phase 1 deduplication.
 *
 * Used by UI to show a visual indicator on chips whose individual regex
 * was collapsed into a shared optimization entry (so the user understands
 * why clicking the chip doesn't change the regex output).
 */
export function collectCollapsedTokenIds(
  node: ASTNode,
  optimizationTable: Record<string, OptimizationEntry>
): Set<string> {
  const ids = new Set<string>();

  function walk(n: ASTNode) {
    switch (n.type) {
      case 'AND':
      case 'OR':
        n.children.forEach(walk);
        break;
      case 'EXCLUDE':
        walk(n.child);
        break;
      case 'LITERAL':
        if (n.tokenId?.startsWith('opt:')) {
          // The opt: key is the sorted matchedIds joined by ':'
          // Look up the optimization table to find which IDs were collapsed
          // Try matching against table entries by their regex value
          for (const entry of Object.values(optimizationTable)) {
            // Check if this entry's regex matches the literal's value
            if (entry.regex.ru === n.value) {
              for (const id of entry.ids) {
                ids.add(id);
              }
              break;
            }
          }
        }
        if (n.tokenId?.startsWith('dedup:')) {
          // Deduplicated: multiple tokens with same regex collapsed into one.
          // This is Phase 1 dedup — also a form of collapse the user should know about.
          // dedup:id1:id2:id3 — but IDs themselves contain ':', so we can't split.
          // We rely on the fact that dedup tokens are in OR groups with identical
          // compiled regex. The user selected multiple tiers of the same family —
          // this is expected and doesn't need a visual indicator (the chip already
          // shows ×N count). So we skip dedup tokens.
        }
        break;
      case 'RANGE':
        break;
    }
  }
  walk(node);
  return ids;
}

// Re-exports for backward compatibility
export { collectTokenIds } from './ast';
export { truncateSuffix, isTruncationSafe } from './optimization-strategies';
