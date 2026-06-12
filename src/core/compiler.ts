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
 *   Only set when rawTextTemplate starts with ## or [+-]## (number at position 0).
 * - RANGE + anchorEnd: inserts a string (typically '%') after the number pattern,
 *   before .*suffix. Verified in-game (Phase 9c): suffix anchoring prevents FP
 *   because numbers in range notation (e.g. 27 from (27-50)) are NOT followed by %.
 *   ⚠️ FN risk: items where actual roll has range notation (e.g. 27(22-27)%)
 *   have '(' after the roll, not '%' — suffix anchoring would miss these.
 *   Used ONLY when anchorStart=false (for +##% mods where ^ cannot be used).
 * - RANGE + signPrefix: adds \+ or - before the number pattern (Phase 12).
 *   '+' → \+ (literal + must be escaped in PoE2 regex dialect).
 *   '-' → - (literal - is not special, no escaping needed).
 *   Provides implicit anchoring: range notation numbers never have +/- before them,
 *   so signPrefix prevents FP from secondary numbers like 27 in (27-50).
 *   When combined with anchorStart, order is: ^ + sign + numRegex (e.g. ^\+(2[7-9]|30)).
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
        // Threshold mode: compile RANGE(min, max) as ≥min only (single quoted group)
        // This is an approximation that overmatches (drops max constraint) but
        // produces shorter regex with no FP from range notation.
        // Verified in-game: threshold patterns have NO FP from range notation.
        if (node.threshold) {
          // Convert to ≥min only (drop max, keep threshold=false to avoid recursion)
          return { type: 'RANGE', min: node.min, max: undefined, suffix: node.suffix, prefix: node.prefix, exact: node.exact, anchorStart: node.anchorStart, anchorEnd: node.anchorEnd, reversed: node.reversed, colonAnchor: node.colonAnchor, signPrefix: node.signPrefix };
        }
        const range = node.max - node.min + 1;
        if (range <= MAX_ENUMERATE_RANGE) {
          // Narrow range: keep as RANGE(min, max) for enumeration in compileInner
          return node;
        }
        // Wide range: expand to AND(min, max) fallback
        return {
          type: 'AND',
          children: [
            { type: 'RANGE', min: node.min, max: undefined, suffix: node.suffix, prefix: node.prefix, exact: node.exact, anchorStart: node.anchorStart, anchorEnd: node.anchorEnd, reversed: node.reversed, colonAnchor: node.colonAnchor, signPrefix: node.signPrefix },
            { type: 'RANGE', min: undefined, max: node.max, suffix: node.suffix, prefix: node.prefix, exact: node.exact, anchorStart: node.anchorStart, anchorEnd: node.anchorEnd, reversed: node.reversed, colonAnchor: node.colonAnchor, signPrefix: node.signPrefix },
          ],
        };
      }
      return node;
    }
    case 'MULTI_RANGE': {
      // Handle threshold mode for MULTI_RANGE: drop max in each slot
      if (node.threshold) {
        const thresholdedSlots = node.slots.map(slot => ({
          ...slot,
          max: undefined, // Drop max — threshold mode: ≥min only
        }));
        return { ...node, slots: thresholdedSlots };
      }
      // For each slot with both min and max:
      // - Narrow range (≤ MAX_ENUMERATE_RANGE): keep as-is for enumeration
      // - Wide range: drop max (threshold-like approximation within single group)
      //   We can't expand into AND like RANGE because MULTI_RANGE must stay as one group.
      const adjustedSlots = node.slots.map(slot => {
        if (slot.min !== undefined && slot.max !== undefined) {
          const range = slot.max - slot.min + 1;
          if (range > MAX_ENUMERATE_RANGE) {
            // Wide range within a single group: approximate as ≥min
            return { ...slot, max: undefined };
          }
        }
        return slot;
      });
      return { ...node, slots: adjustedSlots };
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
      // colonAnchor: ': ' between .* and number pattern for reversed ranges.
      // Prevents FP from range notation in non-% mods like "монстров: 1(1-2)".
      // The ': ' anchors the number to appear right after the colon-space delimiter,
      // which is where the rolled value sits — not in range notation like "(1-2)".
      const colonPrefix = (ast.reversed && ast.colonAnchor) ? ': ' : '';
      // signPrefix: \+ or - before the number pattern (Phase 12)
      // For '+' → \+ (literal + must be escaped in PoE2 regex)
      // For '-' → - (literal - is not a special char, no escaping needed)
      // Provides implicit anchoring: range notation numbers never have +/- before them,
      // so signPrefix prevents FP from secondary numbers like 27 in (27-50).
      const sign = ast.signPrefix === '+' ? '\\+' : ast.signPrefix === '-' ? '-' : '';

      // Both min and max → enumerated range (single quoted group)
      if (isEnumerated) {
        const numRegex = generateEnumeratedRangeRegex(ast.min!, ast.max!);
        if (!numRegex) return ''; // Should not happen after normalizeAst check
        if (compiledSuffix) {
          if (ast.reversed) return `${compiledSuffix}.*${colonPrefix}${sign}${numRegex}${endAnchor}`;
          if (ast.prefix) return `${ast.prefix} ${sign}${numRegex}${endAnchor}.*${compiledSuffix}`;
          return `${anchor}${sign}${numRegex}${endAnchor}.*${compiledSuffix}`;
        }
        if (ast.prefix) return `${ast.prefix} ${sign}${numRegex}${endAnchor}`;
        return `${anchor}${sign}${numRegex}${endAnchor}`;
      }

      // ≥ min: generate regex matching numbers ≥ min
      if (ast.min !== undefined) {
        const minStr = ast.min.toString();
        const numRegex = generateNumberRegex(minStr, useRound10);
        if (!numRegex) return '';
        if (compiledSuffix) {
          if (ast.reversed) return `${compiledSuffix}.*${colonPrefix}${sign}${numRegex}${endAnchor}`;
          if (ast.prefix) return `${ast.prefix} ${sign}${numRegex}${endAnchor}.*${compiledSuffix}`;
          return `${anchor}${sign}${numRegex}${endAnchor}.*${compiledSuffix}`;
        }
        if (ast.prefix) return `${ast.prefix} ${sign}${numRegex}${endAnchor}`;
        return `${anchor}${sign}${numRegex}${endAnchor}`;
      }

      // ≤ max: generate regex matching numbers ≤ max
      if (ast.max !== undefined) {
        const maxStr = ast.max.toString();
        const numRegex = generateMaxNumberRegex(maxStr, useRound10);
        if (!numRegex) return '';
        if (compiledSuffix) {
          if (ast.reversed) return `${compiledSuffix}.*${colonPrefix}${sign}${numRegex}${endAnchor}`;
          if (ast.prefix) return `${ast.prefix} ${sign}${numRegex}${endAnchor}.*${compiledSuffix}`;
          return `${anchor}${sign}${numRegex}${endAnchor}.*${compiledSuffix}`;
        }
        if (ast.prefix) return `${ast.prefix} ${sign}${numRegex}${endAnchor}`;
        return `${anchor}${sign}${numRegex}${endAnchor}`;
      }

      return '';
    }
    case 'MULTI_RANGE': {
      // MULTI_RANGE compiles to a SINGLE quoted group with all number patterns.
      // Format: "prefix0 numRegex0.*prefix1 numRegex1.*...suffix"
      //
      // This is the correct approach for dual-number mods (e.g., "От X до Y урона")
      // because both numbers must match in the SAME block — unlike AND-ing two
      // separate quoted groups which can match different blocks.
      //
      // Each slot is compiled independently:
      // - Both min and max (narrow range): enumerated range regex
      // - Only min: ≥min regex (generateNumberRegex)
      // - Only max: ≤max regex (generateMaxNumberRegex)

      const parts: string[] = [];

      for (const slot of ast.slots) {
        if (slot.min === undefined && slot.max === undefined) continue;

        // Determine round10 for this slot
        const isEnumerated = slot.min !== undefined && slot.max !== undefined;
        const useRound10 = isEnumerated ? false : (ast.exact === true ? false : round10);

        let numRegex: string;
        if (isEnumerated) {
          const enumResult = generateEnumeratedRangeRegex(slot.min!, slot.max!);
          if (!enumResult) continue;
          numRegex = enumResult;
        } else if (slot.min !== undefined) {
          const result = generateNumberRegex(slot.min.toString(), useRound10);
          if (!result) continue;
          numRegex = result;
        } else {
          // slot.max !== undefined
          const result = generateMaxNumberRegex(slot.max!.toString(), useRound10);
          if (!result) continue;
          numRegex = result;
        }

        // Add prefix + number pattern
        // For slot 0: "prefix0 numRegex0"
        // For slot N>0: ".* prefixN numRegexN" (bridge from previous number)
        if (slot.prefix) {
          if (parts.length === 0) {
            parts.push(`${slot.prefix} ${numRegex}`);
          } else {
            parts.push(`${slot.prefix} ${numRegex}`);
          }
        } else {
          parts.push(numRegex);
        }
      }

      if (parts.length === 0) return '';

      // Compile the suffix
      const compiledSuffix = ast.suffix
        ? (ast.suffix.includes('|') ? `(${ast.suffix})` : ast.suffix)
        : '';

      // Combine: "part0.*part1.*...suffix"
      // Between consecutive parts, use .* to bridge across any intermediate text
      // (including range notation like "(6—10)" that might appear between numbers)
      let result = parts[0];
      for (let i = 1; i < parts.length; i++) {
        result += `.*${parts[i]}`;
      }
      if (compiledSuffix) {
        result += `.*${compiledSuffix}`;
      }

      return result;
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
