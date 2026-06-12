/**
 * Core optimization utilities: deduplication (Phase 1) and shared helpers.
 *
 * This module contains the first optimization phase (deduplicate identical
 * regex values in OR groups) and utility functions shared across all
 * optimization phases (expandTokenId, getValueKey, etc.).
 *
 * Module structure (since iteration 19):
 *   optimizer.ts                — Entry point: optimize() + collectCollapsedTokenIds + re-exports
 *   core-optimizations.ts       — Phase 1 deduplication + shared utilities
 *   optimization-strategies.ts  — Phase 2 optimization table + Phase 3 suffix truncation + data
 */

import type { ASTNode, Locale } from '@shared/types';

// ─── Shared Utilities ────────────────────────────────────────────────

/**
 * Extract all original (bare) token IDs from a tokenId string.
 * Handles both plain IDs ("waystone.temporal_chains") and
 * dedup-prefixed IDs ("dedup:id1:id2:id3").
 */
export function expandTokenId(tokenId: string | undefined): string[] {
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
 * Collect token IDs from a node. Looks inside AND wrappers to find
 * LITERAL children with tokenIds.
 */
export function collectTokenIdsFromNode(node: ASTNode, ids: string[]): void {
  if (node.type === 'LITERAL' && node.tokenId) {
    ids.push(...expandTokenId(node.tokenId));
  } else if (node.type === 'AND') {
    for (const child of node.children) {
      collectTokenIdsFromNode(child, ids);
    }
  }
}

/**
 * Get a "value key" for an AST node for deduplication purposes.
 * Two nodes with the same valueKey produce the same compiled regex.
 */
export function getValueKey(node: ASTNode): string {
  switch (node.type) {
    case 'LITERAL':
      return `L:${node.value}`;
    case 'RANGE': {
      const min = node.min?.toString() ?? '';
      const max = node.max?.toString() ?? '';
      const suffix = node.suffix ?? '';
      const prefix = node.prefix ?? '';
      const exact = node.exact?.toString() ?? '';
      const sign = node.signPrefix ?? '';
      const anchorStart = node.anchorStart ? '^' : '';
      const anchorEnd = node.anchorEnd ?? '';
      const reversed = node.reversed ? 'rv' : '';
      const colonAnchor = node.colonAnchor ? 'ca' : '';
      const threshold = node.threshold ? 'th' : '';
      return `R:${min}:${max}:${suffix}:${prefix}:${exact}:${sign}:${anchorStart}:${anchorEnd}:${reversed}:${colonAnchor}:${threshold}`;
    }
    case 'MULTI_RANGE': {
      // Include all slot data + suffix to distinguish different MULTI_RANGE nodes
      const slots = node.slots.map(s => `${s.min ?? ''}:${s.max ?? ''}:${s.prefix}`).join('|');
      const suffix = node.suffix ?? '';
      const exact = node.exact?.toString() ?? '';
      return `MR:${slots}:${suffix}:${exact}`;
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

// ─── Phase 1: Deduplication ──────────────────────────────────────────

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
export function deduplicateOrGroups(node: ASTNode, locale: Locale): ASTNode {
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

// ─── Phase 4: Remove Conflicting EXCLUDE Nodes ──────────────────────

/**
 * Collect all LITERAL values from an AST subtree.
 * Used to find sibling values that might conflict with EXCLUDE patterns.
 */
function collectLiteralValues(node: ASTNode): string[] {
  const values: string[] = [];
  function walk(n: ASTNode) {
    switch (n.type) {
      case 'LITERAL':
        values.push(n.value);
        break;
      case 'AND':
      case 'OR':
        n.children.forEach(walk);
        break;
      case 'EXCLUDE':
        walk(n.child);
        break;
      default:
        break;
    }
  }
  walk(node);
  return values;
}

/**
 * Check if an EXCLUDE node's pattern conflicts with any LITERAL value.
 * A conflict occurs when the exclude pattern is a substring of a literal value,
 * meaning the exclude would block matching items that the user explicitly wants.
 */
function excludeConflictsWithLiterals(excludeNode: ASTNode, literalValues: string[]): boolean {
  if (excludeNode.type !== 'EXCLUDE') return false;

  // Collect all literal values inside the EXCLUDE node
  const excludeValues = collectLiteralValues(excludeNode.child);

  for (const excludeVal of excludeValues) {
    for (const literalVal of literalValues) {
      if (literalVal.includes(excludeVal)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Remove EXCLUDE nodes from AND wrappers inside OR groups where the exclude
 * pattern conflicts with sibling LITERAL values.
 *
 * This is a safety net for cases where:
 * 1. buildAstFromSelections correctly suppressed conflicting excludes, but
 * 2. The optimizer Phase 2 re-added them from optimization table entries
 *
 * Example AST before fix:
 *   OR(
 *     AND(LITERAL("к ловкости"), EXCLUDE(LITERAL(" интел"))),
 *     LITERAL("к интеллекту")
 *   )
 *
 * The EXCLUDE(" интел") conflicts with LITERAL("к интеллекту") because
 * "к интеллекту" contains " интел". After fix:
 *   OR(
 *     LITERAL("к ловкости"),
 *     LITERAL("к интеллекту")
 *   )
 */
export function removeConflictingExcludes(node: ASTNode): ASTNode {
  switch (node.type) {
    case 'OR': {
      // First, recursively process children
      const processedChildren = node.children.map(c => removeConflictingExcludes(c));

      // Collect ALL literal values from siblings in this OR group
      const allLiteralValues: string[] = [];
      for (const child of processedChildren) {
        // For AND-wrapped nodes, collect literals that are NOT inside EXCLUDE
        // For plain LITERALs, collect their value
        if (child.type === 'LITERAL') {
          allLiteralValues.push(child.value);
        } else if (child.type === 'AND') {
          for (const grandchild of child.children) {
            if (grandchild.type === 'LITERAL') {
              allLiteralValues.push(grandchild.value);
            }
            // Skip EXCLUDE children — their values are negation patterns, not wanted values
          }
        }
        // RANGE and MULTI_RANGE nodes don't have literal values to conflict with
      }

      if (allLiteralValues.length === 0) {
        return { ...node, children: processedChildren };
      }

      // Now check each child for conflicting EXCLUDE nodes
      const newChildren: ASTNode[] = [];
      for (const child of processedChildren) {
        if (child.type === 'AND') {
          // Check if any EXCLUDE child conflicts with sibling LITERAL values
          const filteredChildren: ASTNode[] = [];
          let hasConflict = false;

          for (const grandchild of child.children) {
            if (grandchild.type === 'EXCLUDE' && excludeConflictsWithLiterals(grandchild, allLiteralValues)) {
              hasConflict = true;
              continue; // Remove this conflicting EXCLUDE
            }
            filteredChildren.push(grandchild);
          }

          if (!hasConflict) {
            newChildren.push(child);
          } else if (filteredChildren.length === 0) {
            // All children were removed — skip this node entirely (shouldn't happen)
            continue;
          } else if (filteredChildren.length === 1) {
            // Only one child remains — unwrap the AND
            newChildren.push(filteredChildren[0]);
          } else {
            newChildren.push({ ...child, children: filteredChildren });
          }
        } else {
          newChildren.push(child);
        }
      }

      // If only one child remains, unwrap the OR
      if (newChildren.length === 1) {
        return newChildren[0];
      }

      return { ...node, children: newChildren };
    }

    case 'AND': {
      return {
        ...node,
        children: node.children.map(c => removeConflictingExcludes(c)),
      };
    }

    case 'EXCLUDE': {
      return {
        ...node,
        child: removeConflictingExcludes(node.child),
      };
    }

    default:
      return node;
  }
}
