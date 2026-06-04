import type { ASTNode, Locale } from '@shared/types';
import { generateNumberRegex } from './number-regex';

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
 * - EXCLUDE prefix ! must be INSIDE the quoted group: "!A" not !"A"
 * - EXCLUDE(OR([...])) compiles to "!A|B|C" — negation of any alternative
 */

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
      const minStr = ast.min?.toString() ?? '0';
      const numRegex = generateNumberRegex(minStr, round10);
      if (!numRegex) return '';
      if (ast.suffix) return `${numRegex}.*${ast.suffix}`;
      return numRegex;
    }
  }
}

export function compile(ast: ASTNode, options: CompileOptions = {}): string {
  const inner = compileInner(ast, options);
  if (!inner) return '';
  // AND already handles quoting each child; other types need outer quotes
  if (ast.type === 'AND') return inner;
  return `"${inner}"`;
}
