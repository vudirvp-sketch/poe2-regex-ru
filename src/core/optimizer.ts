import type { ASTNode, OptimizationEntry, Locale } from '@shared/types';
import { collectTokenIds } from './ast';
import { and, or, exclude, literal } from './ast';

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
 *
 * Phase 2 now supports OptimizationEntry.regexPrefixContext and
 * OptimizationEntry.regexExclude fields. When an entry has these fields,
 * the optimizer creates AND(LITERAL(context), LITERAL(regex)) and/or
 * AND(LITERAL(regex), EXCLUDE(OR(...excludes))) nodes instead of plain
 * LITERAL(regex), ensuring FP prevention is preserved after optimization.
 */
/**
 * Safe list: truncated word tails that are verified in-game as FP-free.
 * Key = full suffix/word, Value = safe truncated prefix.
 * These truncations produce shorter regex while maintaining uniqueness.
 *
 * Blacklist: truncated tails that cause false positives.
 * These substrings match unintended indexed text (e.g., item rarity label).
 */
const TRUNCATED_TAILS_SAFE: Record<string, string> = {
  'эффективность': 'эффективн',
  'эффективность монстров': 'эффективн',
  'бездна': 'бездн',
  'бездны': 'бездн',
  'путевого': 'путев',
  'путевые': 'путев',
  'путевом': 'путев',
  'глубина': 'глубин',
  'глубины': 'глубин',
};

const TRUNCATED_TAILS_BLACKLIST: Set<string> = new Set([
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
 */
export function truncateSuffix(suffix: string): string {
  // Check exact match first (e.g., "эффективность монстров" → "эффективн")
  if (TRUNCATED_TAILS_SAFE[suffix]) {
    const truncated = TRUNCATED_TAILS_SAFE[suffix];
    if (!TRUNCATED_TAILS_BLACKLIST.has(truncated)) {
      return truncated;
    }
  }

  // Check if any safe entry is a substring of the input.
  // Sort by length descending so longer matches take priority
  // (e.g., "эффективность монстров" before "эффективность").
  const sortedEntries = Object.entries(TRUNCATED_TAILS_SAFE)
    .sort(([a], [b]) => b.length - a.length);

  for (const [full, truncated] of sortedEntries) {
    if (suffix.includes(full) && !TRUNCATED_TAILS_BLACKLIST.has(truncated)) {
      // Replace the full word with its truncated version
      return suffix.replace(full, truncated);
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
 * Deduplicate identical regex values in OR groups.
 *
 * When all tokens in a mod family share the same regex (e.g., all fire resistance
 * tiers have regex "к сопротивлению огню"), their LITERAL nodes in an OR group
 * are identical. We collapse them into a single LITERAL, saving characters.
 *
 * Also handles AND-wrapped LITERALs (tokens with regexPrefixContext/regexExclude):
 * AND(LITERAL("имеют"), LITERAL("увеличение урона", id1)) and
 * AND(LITERAL("имеют"), LITERAL("увеличение урона", id2))
 * produce the same compiled regex, so they are deduplicated too.
 *
 * Example:
 *   OR(LITERAL("к сопротивлению огню", id1),
 *      LITERAL("к сопротивлению огню", id2),
 *      LITERAL("к сопротивлению огню", id3))
 *   → LITERAL("к сопротивлению огню", "dedup:id1:id2:id3")
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

        // Collect token IDs from LITERAL nodes (direct or inside AND wrappers)
        collectTokenIdsFromNode(child, group.tokenIds);
      }

      // Rebuild OR group: one node per unique value
      const newChildren: ASTNode[] = [];
      for (const [, group] of valueMap) {
        if (group.children.length === 1) {
          newChildren.push(group.children[0]);
        } else {
          // Multiple children with the same value — collapse to single node
          const firstChild = group.children[0];
          const dedupTokenId = group.tokenIds.length > 0
            ? `dedup:${group.tokenIds.join(':')}`
            : undefined;

          if (firstChild.type === 'LITERAL') {
            newChildren.push({
              type: 'LITERAL',
              value: firstChild.value,
              tokenId: dedupTokenId,
            });
          } else {
            // AND-wrapped or other node types with same value key —
            // keep first only, but update tokenId on the inner LITERAL
            newChildren.push(updateDedupTokenId(firstChild, dedupTokenId));
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
 * Collect token IDs from a node. Looks inside AND wrappers to find
 * LITERAL children with tokenIds.
 */
function collectTokenIdsFromNode(node: ASTNode, ids: string[]): void {
  if (node.type === 'LITERAL' && node.tokenId) {
    ids.push(...expandTokenId(node.tokenId));
  } else if (node.type === 'AND') {
    for (const child of node.children) {
      collectTokenIdsFromNode(child, ids);
    }
  }
}

/**
 * Update the dedup tokenId on the first LITERAL with a tokenId found
 * within a node (typically an AND wrapper). This is used during
 * deduplication of AND-wrapped LITERALs.
 */
function updateDedupTokenId(node: ASTNode, dedupTokenId: string | undefined): ASTNode {
  if (!dedupTokenId) return node;

  if (node.type === 'AND') {
    return {
      ...node,
      children: node.children.map(child => {
        // Update the first LITERAL that has a tokenId
        if (child.type === 'LITERAL' && child.tokenId) {
          return { ...child, tokenId: dedupTokenId };
        }
        return child;
      }),
    };
  }

  return node;
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
      const sign = node.signPrefix ?? '';
      return `R:${min}:${suffix}:${prefix}:${exact}:${sign}`;
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
function applyOptimizationTable(
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

// Re-export collectTokenIds for convenience
export { collectTokenIds };

/**
 * Phase 3: Truncate suffixes in the AST using verified safe list.
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
function truncateSuffixes(node: ASTNode, _locale: Locale): ASTNode {
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
    default:
      return node;
  }
}
