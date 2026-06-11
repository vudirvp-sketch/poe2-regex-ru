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
