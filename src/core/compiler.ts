import type { ASTNode, Locale } from '@shared/types';
import { generateNumberRegex, generateMaxNumberRegex } from './number-regex';

export interface CompileOptions {
  locale?: Locale;
  round10?: boolean;
}

/**
 * Compile an AST node into a PoE2 regex string.
 *
 * Key rules (verified in-game):
 * - AND children each get their own quoted group. Space between = AND.
 * - OR children share a single quoted group, separated by |.
 * - RANGE + suffix combines with .* inside a single quoted group.
 * - RANGE + prefix: prefix is only used for dual-number mods ("От ## до ## ...")
 *   to anchor the number to the correct position within the same block.
 *   Since .* does NOT cross block boundaries, prefix is not needed for single-number mods.
 * - EXCLUDE prefix ! must be INSIDE the quoted group: "!A" not !"A"
 * - EXCLUDE(OR([...])) compiles to "!A|B|C" — negation of any alternative
 *
 * Min+max RANGE (min ≤ x ≤ max) is handled via AST normalization:
 * RANGE(min, max, suffix) is expanded into AND(RANGE(min, undefined, suffix), RANGE(undefined, max, suffix))
 * before compilation. This produces two AND-joined quoted groups:
 *   "≥min.*suffix" "≤max.*suffix"
 * Both conditions must match on the item, which effectively constrains the
 * matched number to the [min, max] range. There is a theoretical edge case
 * where two different numbers on the same item could satisfy the conditions
 * independently, but this is extremely rare in practice and matches the
 * approach used by poe2.re.
 */

/**
 * Normalize the AST: expand RANGE nodes that have both min and max
 * into AND(RANGE(min, undefined, suffix), RANGE(undefined, max, suffix)).
 * Nested AND nodes are flattened so the parent AND directly contains
 * the expanded children (avoiding double-quoting during compilation).
 *
 * This keeps compileInner simple — each RANGE node it processes has
 * at most one bound (min OR max, never both).
 */
function normalizeAst(node: ASTNode): ASTNode {
  switch (node.type) {
    case 'AND': {
      // Normalize each child, then flatten any resulting AND nodes
      const flatChildren: ASTNode[] = [];
      for (const child of node.children) {
        const normalized = normalizeAst(child);
        if (normalized.type === 'AND') {
          // Splice the inner AND's children into the parent
          flatChildren.push(...normalized.children);
        } else {
          flatChildren.push(normalized);
        }
      }
      return { ...node, children: flatChildren };
    }
    case 'OR':
      return { ...node, children: node.children.map(normalizeAst) };
    case 'EXCLUDE':
      return { ...node, child: normalizeAst(node.child) };
    case 'RANGE': {
      if (node.min !== undefined && node.max !== undefined) {
        // Expand RANGE(min, max, suffix, prefix, exact) →
        // AND(RANGE(min, ∅, suffix, prefix, exact), RANGE(∅, max, suffix, prefix, exact))
        // This AND will be flattened into the parent AND during normalization
        return {
          type: 'AND',
          children: [
            { type: 'RANGE', min: node.min, max: undefined, suffix: node.suffix, prefix: node.prefix, exact: node.exact },
            { type: 'RANGE', min: undefined, max: node.max, suffix: node.suffix, prefix: node.prefix, exact: node.exact },
          ],
        };
      }
      return node;
    }
    default:
      return node;
  }
}

function compileInner(ast: ASTNode, options: CompileOptions): string {
  const { round10 = true } = options;

  switch (ast.type) {
    case 'AND': {
      const compiled = ast.children
        .map(c => compileInner(c, options))
        .filter(s => s.length > 0);
      if (compiled.length === 0) return '';
      if (compiled.length === 1) return `"${compiled[0]}"`;
      return compiled.map(s => `"${s}"`).join(' ');
    }
    case 'OR': {
      const compiled = ast.children
        .map(c => compileInner(c, options))
        .filter(s => s.length > 0);
      if (compiled.length === 0) return '';
      return compiled.join('|');
    }
    case 'EXCLUDE': {
      // CRITICAL: ! must be INSIDE quotes when combined with |
      // Verified in-game: "!проклят|сопротивлен" works, !"проклят|сопротивлен" does NOT
      const inner = compileInner(ast.child, options);
      if (!inner) return '';
      return `!${inner}`;
    }
    case 'LITERAL': {
      return ast.value;
    }
    case 'RANGE': {
      if (ast.min === undefined && ast.max === undefined) return '';

      // Per-RANGE exact flag overrides global round10:
      // - exact=true  → never round (precise regex for per-token ranges)
      // - exact=false → use global round10 (for global ranges)
      // - exact=undefined → use global round10 (default behavior)
      const useRound10 = ast.exact === true ? false : round10;

      // ≥ min: generate regex matching numbers ≥ min
      if (ast.min !== undefined) {
        const minStr = ast.min.toString();
        const numRegex = generateNumberRegex(minStr, useRound10);
        if (!numRegex) return '';
        if (ast.suffix) {
          // With prefix: "prefix numRegex.*suffix" — anchors number within same block (dual-number only)
          if (ast.prefix) return `${ast.prefix} ${numRegex}.*${ast.suffix}`;
          return `${numRegex}.*${ast.suffix}`;
        }
        // No suffix: just prefix + numRegex or numRegex alone
        if (ast.prefix) return `${ast.prefix} ${numRegex}`;
        return numRegex;
      }

      // ≤ max: generate regex matching numbers ≤ max
      if (ast.max !== undefined) {
        const maxStr = ast.max.toString();
        const numRegex = generateMaxNumberRegex(maxStr, useRound10);
        if (!numRegex) return '';
        if (ast.suffix) {
          if (ast.prefix) return `${ast.prefix} ${numRegex}.*${ast.suffix}`;
          return `${numRegex}.*${ast.suffix}`;
        }
        if (ast.prefix) return `${ast.prefix} ${numRegex}`;
        return numRegex;
      }

      return '';
    }
  }
}

export function compile(ast: ASTNode, options: CompileOptions = {}): string {
  // Normalize: expand RANGE(min, max) into AND(RANGE(min), RANGE(undefined, max))
  // and flatten nested ANDs
  const normalized = normalizeAst(ast);
  const inner = compileInner(normalized, options);
  if (!inner) return '';
  // AND already handles quoting each child; other types need outer quotes
  if (normalized.type === 'AND') return inner;
  return `"${inner}"`;
}
