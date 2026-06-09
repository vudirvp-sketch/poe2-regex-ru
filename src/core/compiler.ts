import type { ASTNode, Locale } from '@shared/types';
import { generateNumberRegex, generateMaxNumberRegex, generateEnumeratedRangeRegex, MAX_ENUMERATE_RANGE } from './number-regex';

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
 * - RANGE + anchorStart: adds ^ before the number pattern to prevent range notation FP.
 *   Verified in-game (Phase 9b): ^ anchors to start of mod block in PoE2 search.
 *   This prevents matching secondary numbers inside range notation like "(27-50)".
 *   Only set when rawTextTemplate starts with ## (number at position 0).
 * - RANGE + anchorEnd: inserts a string (typically '%') after the number pattern,
 *   before .*suffix. Verified in-game (Phase 9c): suffix anchoring prevents FP
 *   because numbers in range notation (e.g. 27 from (27-50)) are NOT followed by %.
 *   ⚠️ FN risk: items where actual roll has range notation (e.g. 27(22-27)%)
 *   have '(' after the roll, not '%' — suffix anchoring would miss these.
 *   Used ONLY when anchorStart=false (for +##% mods where ^ cannot be used).
 * - EXCLUDE prefix ! must be INSIDE the quoted group: "!A" not !"A"
 * - EXCLUDE(OR([...])) compiles to "!A|B|C" — negation of any alternative
 *
 * Min+max RANGE (min ≤ x ≤ max) compilation strategy (Phase 9):
 *
 * 1. ENUMERATION (preferred): For narrow ranges (≤ MAX_ENUMERATE_RANGE values),
 *    RANGE(min, max, suffix) compiles to a SINGLE quoted group with all valid
 *    values enumerated: "(27|28|29|30).*suffix". This is immune to false positives
 *    from secondary numbers in range notation like "26(26-50)%...suffix".
 *    VERIFIED IN-GAME: enumeration works correctly (Phase 9 tests 1-3).
 *
 * 2. AND FALLBACK: For wide ranges (> MAX_ENUMERATE_RANGE), RANGE(min, max)
 *    is expanded into AND(RANGE(min, ∅, suffix), RANGE(∅, max, suffix)),
 *    producing two AND-joined quoted groups: "≥min.*suffix" "≤max.*suffix".
 *    KNOWN LIMITATION: If item text contains range notation with a secondary
 *    number, each quoted group may match a different number, creating false
 *    positives. This is acceptable for wide ranges where the user typically
 *    wants a broad filter.
 *
 * round10 is ALWAYS disabled for enumerated ranges — enumeration is inherently
 * precise, so rounding would only widen the range unnecessarily.
 */

/**
 * Normalize the AST for compilation.
 *
 * For RANGE(min, max) nodes:
 * - Narrow range (≤ MAX_ENUMERATE_RANGE values): keep as-is.
 *   compileInner will use enumeration for precise matching.
 * - Wide range (> MAX_ENUMERATE_RANGE values): expand into
 *   AND(RANGE(min, ∅, suffix), RANGE(∅, max, suffix)).
 *   This falls back to two AND-joined quoted groups with known limitations.
 *
 * Nested AND nodes are flattened so the parent AND directly contains
 * the expanded children (avoiding double-quoting during compilation).
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
        const range = node.max - node.min + 1;
        if (range <= MAX_ENUMERATE_RANGE) {
          // Narrow range: keep as RANGE(min, max) for enumeration in compileInner
          return node;
        }
        // Wide range: expand to AND(min, max) fallback
        return {
          type: 'AND',
          children: [
            { type: 'RANGE', min: node.min, max: undefined, suffix: node.suffix, prefix: node.prefix, exact: node.exact, anchorStart: node.anchorStart, anchorEnd: node.anchorEnd, reversed: node.reversed },
            { type: 'RANGE', min: undefined, max: node.max, suffix: node.suffix, prefix: node.prefix, exact: node.exact, anchorStart: node.anchorStart, anchorEnd: node.anchorEnd, reversed: node.reversed },
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
      //
      // EXCEPTION: For enumerated ranges (both min and max), round10 is ALWAYS
      // disabled. Enumeration is inherently precise — rounding would only widen
      // the range unnecessarily (e.g., RANGE(27,30) with round10 → [20,30]).
      const isEnumerated = ast.min !== undefined && ast.max !== undefined;
      const useRound10 = isEnumerated ? false : (ast.exact === true ? false : round10);

      // Compile the suffix: if it contains '|' (OR of multiple suffixes),
      // wrap in () so the '|' is scoped correctly within the quoted group.
      const compiledSuffix = ast.suffix
        ? (ast.suffix.includes('|') ? `(${ast.suffix})` : ast.suffix)
        : undefined;

      // anchorStart: ^ before number pattern (Phase 9b)
      // Not used for reversed ranges (text comes before number, so ^ doesn't apply)
      const anchor = ast.reversed ? '' : (ast.anchorStart ? '^' : '');
      // anchorEnd: string after number pattern (typically '%').
      // For normal: goes between number and .*suffix.
      // For reversed: goes after number at the end of the pattern.
      const endAnchor = ast.anchorEnd ?? '';

      // Both min and max → enumerated range (single quoted group)
      if (isEnumerated) {
        const numRegex = generateEnumeratedRangeRegex(ast.min!, ast.max!);
        if (!numRegex) return ''; // Should not happen after normalizeAst check
        if (compiledSuffix) {
          if (ast.reversed) return `${compiledSuffix}.*${numRegex}${endAnchor}`;
          if (ast.prefix) return `${ast.prefix} ${numRegex}${endAnchor}.*${compiledSuffix}`;
          return `${anchor}${numRegex}${endAnchor}.*${compiledSuffix}`;
        }
        if (ast.prefix) return `${ast.prefix} ${numRegex}${endAnchor}`;
        return `${anchor}${numRegex}${endAnchor}`;
      }

      // ≥ min: generate regex matching numbers ≥ min
      if (ast.min !== undefined) {
        const minStr = ast.min.toString();
        const numRegex = generateNumberRegex(minStr, useRound10);
        if (!numRegex) return '';
        if (compiledSuffix) {
          if (ast.reversed) return `${compiledSuffix}.*${numRegex}${endAnchor}`;
          if (ast.prefix) return `${ast.prefix} ${numRegex}${endAnchor}.*${compiledSuffix}`;
          return `${anchor}${numRegex}${endAnchor}.*${compiledSuffix}`;
        }
        if (ast.prefix) return `${ast.prefix} ${numRegex}${endAnchor}`;
        return `${anchor}${numRegex}${endAnchor}`;
      }

      // ≤ max: generate regex matching numbers ≤ max
      if (ast.max !== undefined) {
        const maxStr = ast.max.toString();
        const numRegex = generateMaxNumberRegex(maxStr, useRound10);
        if (!numRegex) return '';
        if (compiledSuffix) {
          if (ast.reversed) return `${compiledSuffix}.*${numRegex}${endAnchor}`;
          if (ast.prefix) return `${ast.prefix} ${numRegex}${endAnchor}.*${compiledSuffix}`;
          return `${anchor}${numRegex}${endAnchor}.*${compiledSuffix}`;
        }
        if (ast.prefix) return `${ast.prefix} ${numRegex}${endAnchor}`;
        return `${anchor}${numRegex}${endAnchor}`;
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
