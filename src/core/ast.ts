import type { ASTNode, MixedOrOptions } from '@shared/types';

// Builder functions
export function and(...children: ASTNode[]): ASTNode {
  return { type: 'AND', children };
}

export function or(...children: ASTNode[]): ASTNode {
  return { type: 'OR', children };
}

/**
 * Build a MIXED_OR node (iter 158).
 *
 * MIXED_OR is an OR-group inside an AND-context — the verified combined-mode
 * pattern: `"MUST1" "MUST2" "OPT1|OPT2|OPT3"`. Compiles identically to OR
 * (children share a single quoted group separated by `|`), but supports
 * `MixedOrOptions` for KI#45/KI#46 mitigations.
 *
 * @param children - OPT alternatives (LITERAL or RANGE nodes)
 * @param options - KI#45 mitigation: anchorFirstAltOnly strips `^` from
 *                 non-first alternatives (default false).
 */
export function mixedOr(children: ASTNode[], options?: MixedOrOptions): ASTNode {
  if (options) {
    return { type: 'MIXED_OR', children, options };
  }
  return { type: 'MIXED_OR', children };
}

export function exclude(child: ASTNode): ASTNode {
  return { type: 'EXCLUDE', child };
}

export function literal(value: string, tokenId?: string): ASTNode {
  return { type: 'LITERAL', value, tokenId };
}

export function range(min?: number, max?: number, suffix?: string, prefix?: string, exact?: boolean, anchorStart?: boolean, anchorEnd?: string, reversed?: boolean, colonAnchor?: boolean, threshold?: boolean, signPrefix?: '+' | '-'): ASTNode {
  return { type: 'RANGE', min, max, suffix, prefix, exact, anchorStart, anchorEnd, reversed, colonAnchor, threshold, signPrefix };
}

/**
 * Create a MULTI_RANGE AST node for dual-number mods where BOTH slots have filters.
 * Compiles to a SINGLE quoted group with all number patterns combined:
 *   "prefix0 numRegex0.*prefix1 numRegex1.*...suffix"
 *
 * This is more reliable than AND-ing two separate RANGE nodes because:
 * 1. Both numbers must match in the SAME block (no cross-block matching)
 * 2. The regex is shorter (one group vs two)
 * 3. No risk of each quoted group matching a different mod line
 *
 * @param slots - Array of slot definitions, one per placeholder, in order.
 *                Each slot has min/max (at least one required) and a prefix
 *                (text before this placeholder, e.g. "Добавляет от" or "до").
 * @param suffix - Text after the LAST placeholder (e.g. "урона к атакам")
 * @param exact - Whether to disable round10 (per-token precision)
 * @param threshold - When true with both min+max, drop max (≥min only)
 */
export function multiRange(
  slots: Array<{ min?: number; max?: number; prefix: string }>,
  suffix: string,
  exact?: boolean,
  threshold?: boolean
): ASTNode {
  return { type: 'MULTI_RANGE', slots, suffix, exact, threshold };
}

// Utility: collect all token IDs from AST
export function collectTokenIds(node: ASTNode): string[] {
  const ids: string[] = [];
  function walk(n: ASTNode) {
    switch (n.type) {
      case 'AND':
      case 'OR':
      case 'MIXED_OR':
        n.children.forEach(walk);
        break;
      case 'EXCLUDE':
        walk(n.child);
        break;
      case 'LITERAL':
        if (n.tokenId) ids.push(n.tokenId);
        break;
      case 'RANGE':
        break;
    }
  }
  walk(node);
  return ids;
}

// Utility: flatten AND children (unwrap nested ANDs)
export function flattenAnd(node: ASTNode): ASTNode[] {
  if (node.type === 'AND') {
    return node.children.flatMap(flattenAnd);
  }
  return [node];
}
