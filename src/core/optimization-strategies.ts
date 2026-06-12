/**
 * Optimization strategies: Phase 2 (optimization table) + Phase 3 (suffix truncation) + data.
 *
 * This module contains the strategy implementations for AST optimization:
 * - Truncation safe/blacklist data and helpers
 * - Optimization table application (replace groups of LITERALs with shared regex)
 * - Suffix truncation (walk AST and shorten verified-safe suffixes)
 *
 * Module structure (since iteration 19):
 *   optimizer.ts                — Entry point: optimize() + collectCollapsedTokenIds + re-exports
 *   core-optimizations.ts       — Phase 1 deduplication + shared utilities
 *   optimization-strategies.ts  — Phase 2 optimization table + Phase 3 suffix truncation + data
 */

import type { ASTNode, OptimizationEntry, Locale } from '@shared/types';
import { and, or, exclude, literal } from './ast';
import { expandTokenId } from './core-optimizations';

// ─── Truncation Data ─────────────────────────────────────────────────

/**
 * Safe list: truncated word tails that are verified in-game as FP-free.
 * Key = full suffix/word, Value = safe truncated prefix.
 * These truncations produce shorter regex while maintaining uniqueness.
 *
 * Blacklist: truncated tails that cause false positives.
 * These substrings match unintended indexed text (e.g., item rarity label).
 */
export const TRUNCATED_TAILS_SAFE: Record<string, string> = {
  'эффективность': 'эффективн',
  'эффективность монстров': 'эффективн',
  'бездна': 'бездн',
  'бездны': 'бездн',
  'путевого': 'путев',
  'путевые': 'путев',
  'путевом': 'путев',
  'глубина': 'глубин',
  'глубины': 'глубин',
  // Iteration 14 additions — candidates for in-game verification
  'приспешников': 'приспешник',
  'приспешника': 'приспешник',
  'оглушения': 'оглушен',
  'флакона': 'флакон',
  'хаосу': 'хаос',
  'монстров': 'монстр',
};

export const TRUNCATED_TAILS_BLACKLIST: Set<string> = new Set([
  'редкост',  // FP on item rarity label "редкий"
  'редк',     // Also unsafe — matches "редкий"
  'провал',   // Untested, low value
]);

/**
 * Truncate a suffix string to its shortest safe prefix.
 * Returns the truncated string if it's in the safe list and not in the blacklist,
 * otherwise returns the original string.
 *
 * The truncation only applies to complete words/suffixes that have been verified
 * in-game as not causing false positives. Partial or untested truncations are
 * rejected to prevent FP.
 *
 * IMPORTANT: Substring replacement is restricted to END-OF-SUFFIX only.
 * PoE2 search uses contiguous substring matching — truncating a word that is
 * followed by more text breaks the match because the omitted characters create
 * a gap. For example, "монстров на карте" must NOT be truncated to
 * "монстр на карте" because "монстр на карте" is NOT a contiguous substring
 * of "монстров на карте" (the suffix "ов" sits between "монстр" and " на карте"").
 * But "количества редких монстров" CAN be truncated to "количества редких монстр"
 * because "монстр" is at the end and is a valid prefix of "монстров" in the text.
 */
export function truncateSuffix(suffix: string): string {
  // Check exact match first (e.g., "эффективность монстров" → "эффективн")
  if (TRUNCATED_TAILS_SAFE[suffix]) {
    const truncated = TRUNCATED_TAILS_SAFE[suffix];
    if (!TRUNCATED_TAILS_BLACKLIST.has(truncated)) {
      return truncated;
    }
  }

  // Check if any safe entry appears at the END of the suffix.
  // Only end-of-suffix truncation preserves the contiguous substring property
  // required by PoE2 search. Mid-phrase truncation breaks matching because
  // the removed characters create a gap between the truncated word and
  // subsequent text.
  // Sort by length descending so longer matches take priority
  // (e.g., "эффективность монстров" before "эффективность").
  const sortedEntries = Object.entries(TRUNCATED_TAILS_SAFE)
    .sort(([a], [b]) => b.length - a.length);

  for (const [full, truncated] of sortedEntries) {
    if (suffix.endsWith(full) && !TRUNCATED_TAILS_BLACKLIST.has(truncated)) {
      // Replace only at the end of the suffix
      return suffix.slice(0, -full.length) + truncated;
    }
  }

  return suffix;
}

/**
 * Check if a truncated string is safe (not in blacklist and in safe list).
 */
export function isTruncationSafe(truncated: string): boolean {
  if (TRUNCATED_TAILS_BLACKLIST.has(truncated)) return false;
  return Object.values(TRUNCATED_TAILS_SAFE).includes(truncated);
}

// ─── Phase 2: Optimization Table ─────────────────────────────────────

/**
 * Information about a token found in the AST for optimization purposes.
 * Supports both plain LITERAL nodes and AND-wrapped LITERALs (which
 * occur when tokens have regexPrefixContext/regexExclude applied by
 * buildAstFromSelections).
 */
interface TokenNodeInfo {
  /** The node to be replaced — either a LITERAL or an AND wrapper */
  node: ASTNode;
  /** The OR parent containing this node */
  parent: ASTNode;
  /** Index in parent's children array */
  index: number;
  /** Approximate compiled regex length of this node (for savings calculation) */
  approxLength: number;
}

/**
 * Compute the approximate compiled regex length of an AST node.
 * Used for optimization savings calculation. This is a rough estimate
 * since exact length requires full compilation.
 */
function approxCompiledLength(node: ASTNode): number {
  switch (node.type) {
    case 'LITERAL':
      return node.value.length + 2; // "value"
    case 'AND': {
      // "child1" "child2" — each child quoted, separated by spaces
      return node.children.reduce((sum, c) => sum + approxCompiledLength(c), 0)
        + Math.max(0, node.children.length - 1); // spaces between quoted groups
    }
    case 'OR': {
      // child1|child2 — each child, separated by |
      return node.children.reduce((sum, c) => sum + approxCompiledLength(c), 0)
        + Math.max(0, node.children.length - 1); // | separators
    }
    case 'EXCLUDE': {
      // "!child" — 1 for ! + child length
      return 1 + approxCompiledLength(node.child);
    }
    case 'RANGE':
      return 20; // rough estimate for number regex
    default:
      return 0;
  }
}

/**
 * Build the optimized replacement node for an optimization entry.
 *
 * When the optimization entry has regexPrefixContext, creates:
 *   AND(LITERAL(context), LITERAL(regex))
 * When it has regexExclude, adds:
 *   AND(..., EXCLUDE(OR(exclude1, exclude2, ...)))
 * Both combined:
 *   AND(LITERAL(context), LITERAL(regex), EXCLUDE(OR(exclude1, exclude2, ...)))
 *
 * Without context/excludes, returns a plain LITERAL(regex) as before.
 */
function buildOptimizedNode(
  optimizedRegex: string,
  optKey: string,
  entry: OptimizationEntry,
  locale: Locale
): ASTNode {
  const regexLiteral: ASTNode = { type: 'LITERAL', value: optimizedRegex, tokenId: `opt:${optKey}` };

  // Check for context and excludes
  const context = entry.regexPrefixContext?.[locale];
  const excludes = entry.regexExclude?.[locale];

  if (!context && (!excludes || excludes.length === 0)) {
    // No context or excludes — plain LITERAL as before
    return regexLiteral;
  }

  const andChildren: ASTNode[] = [];

  // Add context LITERAL first (AND(LITERAL(context), LITERAL(regex)))
  if (context) {
    andChildren.push(literal(context));
  }

  // Add the regex LITERAL
  andChildren.push(regexLiteral);

  // Add EXCLUDE node if needed (AND(..., EXCLUDE(OR(exclude1, exclude2, ...))))
  if (excludes && excludes.length > 0) {
    if (excludes.length === 1) {
      andChildren.push(exclude(literal(excludes[0])));
    } else {
      andChildren.push(exclude(or(...excludes.map(pattern => literal(pattern)))));
    }
  }

  return and(...andChildren);
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
 *
 * Supports AND-wrapped LITERALs (tokens with regexPrefixContext/regexExclude):
 * The optimizer can find LITERAL tokenIds inside AND wrappers and replace
 * the entire AND wrapper with the optimization entry's shared regex + context/excludes.
 */
export function applyOptimizationTable(
  ast: ASTNode,
  optimizationTable: Record<string, OptimizationEntry>,
  locale: Locale = 'ru'
): ASTNode {
  // 1. Collect all LITERAL token IDs that appear in OR groups
  // Supports both plain LITERAL children and AND-wrapped LITERALs
  const tokenIdToNode = new Map<string, TokenNodeInfo>();

  function findLiteralsInOr(node: ASTNode): void {
    if (node.type === 'OR') {
      node.children.forEach((child, i) => {
        if (child.type === 'LITERAL' && child.tokenId) {
          // Plain LITERAL in OR group
          const bareIds = expandTokenId(child.tokenId);
          for (const bareId of bareIds) {
            tokenIdToNode.set(bareId, {
              node: child,
              parent: node,
              index: i,
              approxLength: child.value.length,
            });
          }
        } else if (child.type === 'AND') {
          // AND-wrapped LITERAL — look for LITERAL with tokenId inside
            // Find inner LITERALs with tokenId inside AND wrapper
          for (const grandchild of child.children) {
            if (grandchild.type === 'LITERAL' && grandchild.tokenId) {
              const bareIds = expandTokenId(grandchild.tokenId);
              for (const bareId of bareIds) {
                tokenIdToNode.set(bareId, {
                  node: child,       // The AND wrapper is what we'll replace
                  parent: node,
                  index: i,
                  approxLength: approxCompiledLength(child),
                });
              }
            }
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

    // Compute the length of the optimized replacement node
    const optNode = buildOptimizedNode(sharedRegex, 'temp', entry, locale);
    const optimizedLength = approxCompiledLength(optNode);

    let individualLength = 0;
    for (const id of matchedIds) {
      const info = tokenIdToNode.get(id);
      if (info) {
        individualLength += info.approxLength;
      }
    }

    // The shared regex replaces all matched individual regexes,
    // but we need to account for the | separators between them
    const separatorsSaved = matchedIds.size - 1; // | separators no longer needed
    const totalIndividualWithSeparators = individualLength + separatorsSaved;

    const savings = totalIndividualWithSeparators - optimizedLength;

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
    result = replaceWithOptimized(result, optKey, matchedIds, optimizedRegex, entry, locale);
  }

  return result;
}

/**
 * Check if a node (plain LITERAL or AND-wrapped) contains a tokenId
 * that matches any ID in the optimization set.
 */
function nodeMatchesOptimizationSet(node: ASTNode, ids: Set<string>): boolean {
  if (node.type === 'LITERAL' && node.tokenId) {
    const bareIds = expandTokenId(node.tokenId);
    return bareIds.some(id => ids.has(id));
  }
  if (node.type === 'AND') {
    // Check inner LITERALs
    for (const child of node.children) {
      if (child.type === 'LITERAL') {
        const tokenId = child.tokenId;
        if (tokenId) {
          const bareIds = expandTokenId(tokenId);
          if (bareIds.some(id => ids.has(id))) return true;
        }
      }
    }
  }
  return false;
}

function replaceWithOptimized(
  ast: ASTNode,
  key: string,
  ids: Set<string>,
  optimizedRegex: string,
  entry: OptimizationEntry,
  locale: Locale
): ASTNode {
  switch (ast.type) {
    case 'OR': {
      const optimized: ASTNode[] = [];
      const remaining: ASTNode[] = [];

      for (const child of ast.children) {
        if (nodeMatchesOptimizationSet(child, ids)) {
          optimized.push(child);
        } else {
          remaining.push(child);
        }
      }

      // Build the replacement node with context/excludes from the entry
      const replacementNode = buildOptimizedNode(optimizedRegex, key, entry, locale);

      if (optimized.length > 0 && optimized.length === ast.children.length) {
        return replacementNode;
      }

      if (optimized.length > 0) {
        return {
          type: 'OR',
          children: [
            replacementNode,
            ...remaining,
          ],
        };
      }

      return ast;
    }
    case 'AND': {
      return {
        ...ast,
        children: ast.children.map(c => replaceWithOptimized(c, key, ids, optimizedRegex, entry, locale)),
      };
    }
    case 'EXCLUDE': {
      return {
        ...ast,
        child: replaceWithOptimized(ast.child, key, ids, optimizedRegex, entry, locale),
      };
    }
    default:
      return ast;
  }
}

// ─── Phase 3: Suffix Truncation ──────────────────────────────────────

/**
 * Truncate suffixes in the AST using verified safe list.
 *
 * Walks the AST and truncates suffix strings in RANGE nodes and value strings
 * in LITERAL nodes according to the TRUNCATED_TAILS_SAFE map.
 * Blacklisted truncations (e.g., "редкост" which FP-matches item rarity label)
 * are never applied.
 *
 * This produces shorter regex output while maintaining correctness for verified
 * truncations. The truncation is conservative — only explicitly listed words
 * are truncated, and the blacklist prevents known-FP truncations.
 */
export function truncateSuffixes(node: ASTNode, _locale: Locale): ASTNode {
  switch (node.type) {
    case 'AND':
      return { ...node, children: node.children.map(c => truncateSuffixes(c, _locale)) };
    case 'OR':
      return { ...node, children: node.children.map(c => truncateSuffixes(c, _locale)) };
    case 'EXCLUDE':
      return { ...node, child: truncateSuffixes(node.child, _locale) };
    case 'LITERAL': {
      const truncated = truncateSuffix(node.value);
      if (truncated !== node.value) {
        return { ...node, value: truncated };
      }
      return node;
    }
    case 'RANGE': {
      if (node.suffix) {
        const truncated = truncateSuffix(node.suffix);
        if (truncated !== node.suffix) {
          return { ...node, suffix: truncated };
        }
      }
      return node;
    }
    case 'MULTI_RANGE': {
      if (node.suffix) {
        const truncated = truncateSuffix(node.suffix);
        if (truncated !== node.suffix) {
          return { ...node, suffix: truncated };
        }
      }
      return node;
    }
    default:
      return node;
  }
}
