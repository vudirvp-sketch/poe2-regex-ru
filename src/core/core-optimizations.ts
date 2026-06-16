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
 * Find which literal values inside an EXCLUDE node conflict with sibling
 * literal values. A conflict occurs when the exclude value is a substring
 * of a sibling literal value, meaning the exclude would block matching
 * items that the user explicitly wants.
 *
 * iter 44 — surgical: returns the LIST of conflicting exclude values,
 * instead of a single boolean. Callers can then remove ONLY those
 * literals from the EXCLUDE's child (preserving the rest), instead of
 * dropping the entire EXCLUDE node.
 */
function findConflictingExcludeValues(excludeNode: ASTNode, literalValues: string[]): string[] {
  if (excludeNode.type !== 'EXCLUDE') return [];

  const excludeValues = collectLiteralValues(excludeNode.child);
  const conflicting: string[] = [];

  for (const excludeVal of excludeValues) {
    for (const literalVal of literalValues) {
      if (literalVal.includes(excludeVal)) {
        conflicting.push(excludeVal);
        break; // No need to check more literals for this exclude value
      }
    }
  }
  return conflicting;
}

/**
 * Remove specific literal values from inside an EXCLUDE's child node.
 *
 * Handles two shapes:
 *   EXCLUDE(LITERAL(X))        → if X is in valuesToRemove, returns null
 *                                  (caller should drop the EXCLUDE)
 *   EXCLUDE(OR(LITERAL, ...))  → returns EXCLUDE with conflicting literals
 *                                  removed from the OR; if OR becomes empty,
 *                                  returns null (caller should drop the EXCLUDE)
 *
 * Returns the modified EXCLUDE node, or null if the EXCLUDE should be removed
 * entirely (all of its values were conflicting).
 */
function removeExcludeValues(excludeNode: ASTNode, valuesToRemove: Set<string>): ASTNode | null {
  if (excludeNode.type !== 'EXCLUDE') return excludeNode;

  const child = excludeNode.child;

  // Case 1: EXCLUDE(LITERAL(X))
  if (child.type === 'LITERAL') {
    if (valuesToRemove.has(child.value)) {
      return null; // Drop the EXCLUDE entirely
    }
    return excludeNode; // Keep as-is
  }

  // Case 2: EXCLUDE(OR(LITERAL, LITERAL, ...))
  if (child.type === 'OR') {
    const remaining = child.children.filter(
      c => !(c.type === 'LITERAL' && valuesToRemove.has(c.value))
    );

    if (remaining.length === 0) {
      return null; // All values were conflicting — drop EXCLUDE
    }
    if (remaining.length === 1) {
      // Unwrap OR to single LITERAL
      return { ...excludeNode, child: remaining[0] };
    }
    return { ...excludeNode, child: { ...child, children: remaining } };
  }

  // Other shapes (e.g., EXCLUDE of complex nested OR/AND) — leave untouched
  return excludeNode;
}

/**
 * Remove CONFLICTING literal values from EXCLUDE nodes inside AND wrappers
 * in OR groups. Surgical (iter 44): only the conflicting literals are
 * removed from EXCLUDE's child OR; non-conflicting exclude patterns are
 * preserved.
 *
 * This is a safety net for cases where:
 * 1. buildAstFromSelections correctly suppressed conflicting excludes, but
 * 2. The optimizer Phase 2 re-added them from optimization table entries
 *
 * Example AST before fix (single-literal case — fully removed):
 *   OR(
 *     AND(LITERAL("к ловкости"), EXCLUDE(LITERAL(" интел"))),
 *     LITERAL("к интеллекту")
 *   )
 * " интел" is a substring of "к интеллекту" → conflict → entire EXCLUDE removed.
 * After: OR(LITERAL("к ловкости"), LITERAL("к интеллекту"))
 *
 * Example AST before fix (multi-literal case — surgical, iter 44):
 *   OR(
 *     AND(LITERAL("X"), EXCLUDE(OR(LITERAL("A"), LITERAL("B"), LITERAL("C")))),
 *     LITERAL("YA")
 *   )
 * "A" is substring of "YA" → conflict. "B" and "C" are NOT substrings of any sibling.
 * After (surgical): OR(AND(LITERAL("X"), EXCLUDE(OR(LITERAL("B"), LITERAL("C")))), LITERAL("YA"))
 *
 * Previously the entire EXCLUDE was dropped, causing False Positives
 * (items matching B or C would now match the regex).
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

      // Now check each AND child for conflicting EXCLUDE values (surgical removal)
      const newChildren: ASTNode[] = [];
      for (const child of processedChildren) {
        if (child.type === 'AND') {
          // Collect all conflicting exclude values across all EXCLUDE children of this AND
          const valuesToRemove = new Set<string>();
          for (const grandchild of child.children) {
            if (grandchild.type === 'EXCLUDE') {
              const conflicting = findConflictingExcludeValues(grandchild, allLiteralValues);
              for (const v of conflicting) valuesToRemove.add(v);
            }
          }

          if (valuesToRemove.size === 0) {
            // No conflicts — keep AND as-is
            newChildren.push(child);
            continue;
          }

          // Apply surgical removal to each EXCLUDE child
          const filteredChildren: ASTNode[] = [];
          for (const grandchild of child.children) {
            if (grandchild.type === 'EXCLUDE') {
              const cleaned = removeExcludeValues(grandchild, valuesToRemove);
              if (cleaned !== null) {
                filteredChildren.push(cleaned);
              }
              // If cleaned === null, the EXCLUDE had only conflicting values — drop it
            } else {
              filteredChildren.push(grandchild);
            }
          }

          if (filteredChildren.length === 0) {
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
