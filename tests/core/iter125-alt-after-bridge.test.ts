import { describe, it, expect } from 'vitest';
import { compile } from '@core/compiler';
import { range } from '@core/ast';
import { matchPoE2RegexItem } from '@core/poe2-regex-matcher';
import type { ASTNode } from '@shared/types';
import type { GameItemText } from '@core/poe2-regex-matcher';

/**
 * iter 125 — Regression tests for the `(A|B|C) after .* bridge` bug.
 *
 * ROOT CAUSE:
 * PoE2 in-game regex engine ignores `(A|B|C)` content when `()` appears AFTER
 * a `.*` bridge + literal prefix — it matches the prefix broadly, causing FP.
 * The simulator (poe2-regex-matcher) parses `(A|B|C)` correctly, so the bug
 * was invisible in unit tests. User reported FP in-game (iter 125):
 *
 *   Generated regex:  "едкость.*\+(2[5-9]|[3-9][0-9]|\d{3,})"
 *   In-game behavior: matched +15% (because `(2[5-9]|...)` was silently ignored,
 *                     leaving the broad `едкость.*\+` prefix to match any "+N")
 *
 * FIX:
 * `distributeAlternation()` in compiler.ts converts `prefix(A|B|C)suffix` to
 * `prefixAsuffix|prefixBsuffix|prefixCsuffix` (Path D — top-level |, verified
 * in-game up to 9 alternatives). Also extended `anchorEnd` detection in
 * category-ast-utils.ts to anchor reversed implicits ending in `##%` to `%`.
 *
 * The user's exact scenario:
 *   - "И" (AND) mode
 *   - Implicit 1: "Редкость предметов: +##%" with min=25 (round10 default)
 *   - Implicit 2: "Эффективность монстров: +##%" with min=25 (round10 default)
 *
 * After fix the generated regex is:
 *   "едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%"
 *     "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"
 * (note: round10 rounds 25 down to 20, so ≥20 = `[2-9][0-9]|\d{3,}`)
 */

// ─── Helper: construct AST like category-ast-utils does for implicits ───

function buildImplicitRangeNode(
  min: number | undefined,
  max: number | undefined,
  suffix: string,
  signPrefix: '+' | '-' | undefined = '+',
  anchorEnd: string | undefined = '%',
): ASTNode {
  // Matches what category-ast-utils builds for reversed implicits ending in ##%
  // reversed=true, anchorStart=false (reversed), colonAnchor=undefined, threshold=undefined
  return range(min, max, suffix, undefined, undefined, false, anchorEnd, true, undefined, undefined, signPrefix);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: User's exact scenario — "Редкость предметов" + "Эффективность монстров"
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 125 — user scenario: Редкость + Эффективность implicits (AND, min=25)', () => {
  const rarityNode = buildImplicitRangeNode(25, undefined, 'едкость');
  const effectivenessNode = buildImplicitRangeNode(25, undefined, 'ивность');
  const ast: ASTNode = { type: 'AND', children: [rarityNode, effectivenessNode] };
  const regex = compile(ast, { round10: true });

  it('regex no longer contains (A|B|C) after .* bridge', () => {
    // The bug: `едкость.*\+(2[5-9]|...)` — PoE2 ignores (...) after .*
    // The fix: `едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%` — top-level | (Path D)
    expect(regex).not.toMatch(/едкость\.\*\\\+\(/); // no `(` after `.*\+`
    expect(regex).not.toMatch(/ивность\.\*\\\+\(/); // no `(` after `.*\+`
    expect(regex).toContain('|'); // top-level | (Path D)
    expect(regex).toContain('%'); // % anchor for FP prevention
  });

  it('regex is within 250-char PoE2 limit', () => {
    expect(regex.length).toBeLessThanOrEqual(250);
  });

  it('does NOT match the user-reported FP case (+15% and +11%)', () => {
    // BEFORE fix: matched (because PoE2 ignored the (A|B|C) content)
    // AFTER fix: does not match (top-level | enforces the numeric constraint)
    const item: GameItemText = {
      implicits: ['Редкость предметов: +15%', 'Эффективность монстров: +11%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('does NOT match +5% and +9% (well below threshold)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +5%', 'Эффективность монстров: +9%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('matches +25% and +25% (min boundary, round10 rounds 25 to 20)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +25%', 'Эффективность монстров: +25%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('matches +50% and +50% (mid values)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +50%', 'Эффективность монстров: +50%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('matches +150% and +100% (high values, 3-digit)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +150%', 'Эффективность монстров: +100%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('does NOT match range notation +(15-25)% — % anchor prevents FP', () => {
    // Without % anchor: `(15-25)` contains `25` which would match `2[5-9]`
    // With % anchor: `25` is followed by `)`, not `%` → no match
    const item: GameItemText = {
      implicits: ['Редкость предметов: +(15-25)%', 'Эффективность монстров: +30%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('AND-logic enforces BOTH implicits must match', () => {
    // Only rarity matches, effectiveness is below threshold → no match
    const item: GameItemText = {
      implicits: ['Редкость предметов: +50%', 'Эффективность монстров: +5%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: distributeAlternation behavior — unit-level checks via compile()
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 125 — distributeAlternation: (A|B|C) → A|B|C (Path D)', () => {
  it('distributes reversed ≥min with % endAnchor', () => {
    // Редкость предметов: +##% with min=18 → ≥18 (round10=false → ≥18)
    // generateNumberRegex('18', false) = '(1[8-9]|[2-9][0-9]|\\d{3,})'
    // distributeAlternation('Редкость предметов.*\\+', '(1[8-9]|[2-9][0-9]|\\d{3,})', '%')
    //   → 'Редкость предметов.*\\+1[8-9]%|Редкость предметов.*\\+[2-9][0-9]%|Редкость предметов.*\\+\\d{3,}%'
    const result = compile(
      range(18, undefined, 'Редкость предметов', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    expect(result).toBe(
      '"Редкость предметов.*\\+1[8-9]%|Редкость предметов.*\\+[2-9][0-9]%|Редкость предметов.*\\+\\d{3,}%"',
    );
  });

  it('distributes reversed ≥min without endAnchor (no %)', () => {
    // For implicits ending in `##` (not `##%`), no % anchor.
    // E.g., "Здоровье: +##" (hypothetical) — but we just test the distribution.
    const result = compile(
      range(25, undefined, 'едкость', undefined, undefined, false, undefined, true, undefined, undefined, '+'),
      { round10: false },
    );
    // generateNumberRegex('25', false) = '(2[5-9]|[3-9][0-9]|\\d{3,})'
    expect(result).toBe('"едкость.*\\+2[5-9]|едкость.*\\+[3-9][0-9]|едкость.*\\+\\d{3,}"');
  });

  it('distributes reversed ≥min with signPrefix=- (negative sign)', () => {
    // "-##% к максимум сопротивлений" reversed: suffix.*-(≥min)%
    const result = compile(
      range(11, undefined, 'максимум сопротивлений', undefined, undefined, false, '%', true, undefined, undefined, '-'),
      { round10: false },
    );
    // generateNumberRegex('11', false) = '(1[1-9]|[2-9][0-9]|\\d{3,})'
    expect(result).toBe(
      '"максимум сопротивлений.*-1[1-9]%|максимум сопротивлений.*-[2-9][0-9]%|максимум сопротивлений.*-\\d{3,}%"',
    );
  });

  it('distributes reversed ≤max with % endAnchor', () => {
    // ≤50 (reversed): suffix.*([0-9]|[1-4][0-9]|50)%
    const result = compile(
      range(undefined, 50, 'едкость', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    // generateMaxNumberRegex('50', false) = '([0-9]|[1-4][0-9]|50)'
    expect(result).toBe(
      '"едкость.*\\+[0-9]%|едкость.*\\+[1-4][0-9]%|едкость.*\\+50%"',
    );
  });

  it('distributes reversed enumerated range with % endAnchor', () => {
    // RANGE(27, 30, reversed=true, endAnchor='%') → enumerated (2[7-9]|30)
    // distribute → 'suffix.*2[7-9]%|suffix.*30%'
    const result = compile(
      range(27, 30, 'едкость', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    expect(result).toBe('"едкость.*\\+2[7-9]%|едкость.*\\+30%"');
  });

  it('does NOT distribute when numRegex has no outer parens (e.g., \\d{3,} for ≥100)', () => {
    // generateNumberRegex('100', false) = '\\d{3,}' (no parens) → no distribution
    const result = compile(
      range(100, undefined, 'едкость', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    expect(result).toBe('"едкость.*\\+\\d{3,}%"');
  });

  it('does NOT distribute when numRegex is a single char class (e.g., [5-9] for ≥5)', () => {
    // generateNumberRegex('5', false) = '([5-9]|\\d{2,})' → distributes
    // (single char class is wrapped in parens with | \d{2,})
    const result = compile(
      range(5, undefined, 'едкость', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    // generateNumberRegex('5', false) = '([5-9]|\\d{2,})' → distributes to 2 alts
    expect(result).toBe('"едкость.*\\+[5-9]%|едкость.*\\+\\d{2,}%"');
  });

  it('does NOT distribute non-reversed RANGE (numRegex at start of quoted group, verified in-game)', () => {
    // Non-reversed: `(A|B|C)%.*suffix` — `()` at start of quoted group, ✅ in-game
    // No distribution needed (and would break the verified-in-game pattern).
    const result = compile(
      range(34, undefined, 'отравление', undefined, undefined, false, '%', false, undefined, undefined, undefined),
      { round10: false },
    );
    // No signPrefix, not reversed → `(3[4-9]|[4-9][0-9]|\\d{3,})%.*отравление`
    expect(result).toBe('"(3[4-9]|[4-9][0-9]|\\d{3,})%.*отравление"');
  });

  it('does NOT distribute non-reversed RANGE with prefix (numRegex after literal+space, ✅ in-game)', () => {
    // "Монстры с N% отравление" → "Монстры с (3[4-9]|...)%.*отравление"
    // This is the iter 15 verified pattern — works in-game.
    const result = compile(
      range(34, undefined, 'отравление', 'Монстры с', undefined, false, '%', false, undefined, undefined, undefined),
      { round10: false },
    );
    expect(result).toBe('"Монстры с (3[4-9]|[4-9][0-9]|\\d{3,})%.*отравление"');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Edge cases for distributeAlternation
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 125 — distributeAlternation edge cases', () => {
  it('preserves % anchor in each distributed alternative', () => {
    const result = compile(
      range(18, undefined, 'Редкость', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    // Every alternative ends with %
    const withoutQuotes = result.slice(1, -1);
    const alternatives = withoutQuotes.split('|');
    expect(alternatives.length).toBe(3);
    for (const alt of alternatives) {
      expect(alt.endsWith('%')).toBe(true);
    }
  });

  it('handles colonAnchor reversed case (no %, but : separator)', () => {
    // Reversed with colonAnchor: suffix.*: (≥min)
    // distributeAlternation('suffix.*: ', '(A|B|C)', '') → 'suffix.*: A|suffix.*: B|...'
    // For non-implicit reversed ranges with `: ##` at end (e.g., "свойств: 1(1-2)").
    const result = compile(
      range(3, undefined, 'свойств', undefined, undefined, false, undefined, true, true, undefined, undefined),
      { round10: false },
    );
    // generateNumberRegex('3', false) = '([3-9]|\\d{2,})'
    // colonAnchor → ': ' between .* and numRegex
    // distribute → 'свойств.*: [3-9]|свойств.*: \\d{2,}'
    expect(result).toBe('"свойств.*: [3-9]|свойств.*: \\d{2,}"');
  });

  it('handles wide ranges (≥1000 — threeDigitMin returns \\d{3,})', () => {
    // generateNumberRegex('1000', false) → threeDigitMin(1000)
    // 1000 has d0='1', d1='0', d2='0' → matches D0===1 branch → '\\d{3,}'
    // (no parens → no distribution)
    const result = compile(
      range(1000, undefined, 'едкость', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    expect(result).toBe('"едкость.*\\+\\d{3,}%"');
  });

  it('handles multi-digit ranges (e.g., ≥150 → 1[5-9][0-9]|[2-9][0-9][0-9]|d{4,})', () => {
    const result = compile(
      range(150, undefined, 'едкость', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    // generateNumberRegex('150', false) = '(1[5-9][0-9]|[2-9][0-9][0-9]|\\d{4,})'
    // distribute → 3 alternatives, each with % suffix
    expect(result).toBe(
      '"едкость.*\\+1[5-9][0-9]%|едкость.*\\+[2-9][0-9][0-9]%|едкость.*\\+\\d{4,}%"',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: Compile output snapshot tests (regression baseline)
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 125 — compile output snapshots', () => {
  it('Редкость +25% (round10=false) → distributed ≥25 with %', () => {
    const result = compile(
      range(25, undefined, 'едкость', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    expect(result).toBe('"едкость.*\\+2[5-9]%|едкость.*\\+[3-9][0-9]%|едкость.*\\+\\d{3,}%"');
  });

  it('Эффективность +25% (round10=true) → distributed ≥20 with %', () => {
    // round10=true: 25 → floor(25/10)*10 = 20 → ≥20 → '([2-9][0-9]|\\d{3,})'
    const result = compile(
      range(25, undefined, 'ивность', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: true },
    );
    expect(result).toBe('"ивность.*\\+[2-9][0-9]%|ивность.*\\+\\d{3,}%"');
  });

  it('AND-joined Редкость + Эффективность (both min=25, round10=true)', () => {
    const rarityNode = range(25, undefined, 'едкость', undefined, undefined, false, '%', true, undefined, undefined, '+');
    const effNode = range(25, undefined, 'ивность', undefined, undefined, false, '%', true, undefined, undefined, '+');
    const ast: ASTNode = { type: 'AND', children: [rarityNode, effNode] };
    const result = compile(ast, { round10: true });
    expect(result).toBe(
      '"едкость.*\\+[2-9][0-9]%|едкость.*\\+\\d{3,}%" "ивность.*\\+[2-9][0-9]%|ивность.*\\+\\d{3,}%"',
    );
    // Length check — must be within 250-char PoE2 limit
    expect(result.length).toBeLessThanOrEqual(250);
  });
});
