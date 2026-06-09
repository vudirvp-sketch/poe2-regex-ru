/**
 * Waystone Regex & % Anchor FN Tests — In-game verification test battery.
 *
 * TWO CRITICAL ISSUES:
 *
 * 1. WAYSTONE: "(1[5-9]|2[0-4]).*области путевых камней" doesn't work in-game.
 *    Neither does the alternative split into separate quoted groups.
 *    Need to isolate which part of the pattern fails.
 *
 * 2. % ANCHOR FN: anchorEnd='%' on +##% accessory mods causes false negatives
 *    because in-game text shows range notation where '%' never immediately
 *    follows the number (e.g., "+27(22-27)%" → "27" followed by "(" not "%").
 *    User confirmed: "все еще ломает! и не только там!"
 *
 * These tests use REALISTIC in-game text with range notation to validate
 * our matcher behavior. The results should be compared with actual in-game
 * testing (see IN_GAME_TESTS.md).
 */
import { describe, it, expect } from 'vitest';
import {
  matchPoE2RegexItem,
  matchPoE2Regex,
} from '@core/poe2-regex-matcher';
import { compile } from '@core/compiler';
import { range } from '@core/ast';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: WAYSTONE NUMBER RANGE — Diagnostic Tests
//
// Tests matching our matcher's behavior. Compare with in-game results.
// If our matcher passes but in-game fails → PoE2 dialect difference.
// If our matcher fails too → our implementation has a bug.
// ═══════════════════════════════════════════════════════════════════════════

describe('Waystone: number range regex diagnostic', () => {
  // Realistic waystone items with "На #% больше находимых в области путевых камней" mod
  // In-game text formats:
  // - Without range notation: "На 15% больше находимых в области путевых камней"
  // - With range notation: "На 15(15—24)% больше находимых в области путевых камней"
  const ws15plain = { mods: ['На 15% больше находимых в области путевых камней'] };
  const ws18plain = { mods: ['На 18% больше находимых в области путевых камней'] };
  const ws20plain = { mods: ['На 20% больше находимых в области путевых камней'] };
  const ws24plain = { mods: ['На 24% больше находимых в области путевых камней'] };
  const ws10plain = { mods: ['На 10% больше находимых в области путевых камней'] };
  const ws15range = { mods: ['На 15(15—24)% больше находимых в области путевых камней'] };
  const ws18range = { mods: ['На 18(15—24)% больше находимых в области путевых камней'] };

  // W1: Simple suffix match
  it('W1: "области путевых камней" matches any waystone with this mod', () => {
    expect(matchPoE2RegexItem('"области путевых камней"', ws15plain)).toBe(true);
    expect(matchPoE2RegexItem('"области путевых камней"', ws15range)).toBe(true);
  });

  // W2: Number literal + suffix
  it('W2: "15.*области путевых камней" matches waystone with value 15', () => {
    expect(matchPoE2RegexItem('"15.*области путевых камней"', ws15plain)).toBe(true);
    expect(matchPoE2RegexItem('"15.*области путевых камней"', ws15range)).toBe(true);
    expect(matchPoE2RegexItem('"15.*области путевых камней"', ws18plain)).toBe(false);
  });

  // W3: Char class + suffix
  it('W3: "1[5-9].*области путевых камней" matches 15-19', () => {
    expect(matchPoE2RegexItem('"1[5-9].*области путевых камней"', ws15plain)).toBe(true);
    expect(matchPoE2RegexItem('"1[5-9].*области путевых камней"', ws18plain)).toBe(true);
    expect(matchPoE2RegexItem('"1[5-9].*области путевых камней"', ws20plain)).toBe(false);
    expect(matchPoE2RegexItem('"1[5-9].*области путевых камней"', ws10plain)).toBe(false);
  });

  // W4: () + 2 literal OR
  it('W4: "(15|16).*области путевых камней" matches 15 or 16', () => {
    expect(matchPoE2RegexItem('"(15|16).*области путевых камней"', ws15plain)).toBe(true);
    expect(matchPoE2RegexItem('"(15|16).*области путевых камней"', ws18plain)).toBe(false);
  });

  // W5: () + char class OR (THE FAILING PATTERN)
  it('W5: "(1[5-9]|2[0-4]).*области путевых камней" matches 15-24', () => {
    expect(matchPoE2RegexItem('"(1[5-9]|2[0-4]).*области путевых камней"', ws15plain)).toBe(true);
    expect(matchPoE2RegexItem('"(1[5-9]|2[0-4]).*области путевых камней"', ws18plain)).toBe(true);
    expect(matchPoE2RegexItem('"(1[5-9]|2[0-4]).*области путевых камней"', ws20plain)).toBe(true);
    expect(matchPoE2RegexItem('"(1[5-9]|2[0-4]).*области путевых камней"', ws24plain)).toBe(true);
    expect(matchPoE2RegexItem('"(1[5-9]|2[0-4]).*области путевых камней"', ws10plain)).toBe(false);
  });

  // W5 with range notation items
  it('W5-range: "(1[5-9]|2[0-4]).*области путевых камней" on range notation items', () => {
    expect(matchPoE2RegexItem('"(1[5-9]|2[0-4]).*области путевых камней"', ws15range)).toBe(true);
    expect(matchPoE2RegexItem('"(1[5-9]|2[0-4]).*области путевых камней"', ws18range)).toBe(true);
  });

  // W6: OR without ()
  it('W6: "1[5-9]|2[0-4].*области путевых камней" — ambiguous binding', () => {
    // In our parser: | binds less tightly than sequence, so this is:
    // (1[5-9]) | (2[0-4].*области путевых камней)
    // This means 1[5-9] matches ANYWHERE (not just before suffix)
    expect(matchPoE2RegexItem('"1[5-9]|2[0-4].*области путевых камней"', ws15plain)).toBe(true);
    expect(matchPoE2RegexItem('"1[5-9]|2[0-4].*области путевых камней"', ws20plain)).toBe(true);
  });

  // W8: Shorter suffix
  it('W8: "(1[5-9]|2[0-4]).*путевых камней" — shorter regex', () => {
    expect(matchPoE2RegexItem('"(1[5-9]|2[0-4]).*путевых камней"', ws15plain)).toBe(true);
    expect(matchPoE2RegexItem('"(1[5-9]|2[0-4]).*путевых камней"', ws20plain)).toBe(true);
  });

  // W10: Single decade char class
  it('W10: "1[5-9].*области путевых камней" — single decade', () => {
    expect(matchPoE2RegexItem('"1[5-9].*области путевых камней"', ws15plain)).toBe(true);
    expect(matchPoE2RegexItem('"1[5-9].*области путевых камней"', ws18plain)).toBe(true);
    expect(matchPoE2RegexItem('"1[5-9].*области путевых камней"', ws20plain)).toBe(false);
  });

  // W11: ^ anchor test (if number is at start of block)
  it('W11: "^(1[5-9]|2[0-4]).*области путевых камней" — requires number at block start', () => {
    // Waystone mod text starts with "На ", not the number → ^ anchor should fail
    expect(matchPoE2RegexItem('"^(1[5-9]|2[0-4]).*области путевых камней"', ws15plain)).toBe(false);
  });

  // W12: Minimal suffix match
  it('W12: "путевых камней" — minimal match', () => {
    expect(matchPoE2RegexItem('"путевых камней"', ws15plain)).toBe(true);
    expect(matchPoE2RegexItem('"путевых камней"', ws15range)).toBe(true);
  });

  // Additional: test with the exact pattern from waystone data
  it('waystone "области путевых камней" with compiler output', () => {
    // RANGE(15, 24, 'области путевых камней') without anchors
    const result = compile(range(15, 24, 'области путевых камней', undefined, undefined, false), { round10: false });
    // Should produce: "(1[5-9]|2[0-4]).*области путевых камней"
    expect(result).toBe('"(1[5-9]|2[0-4]).*области путевых камней"');
    // Verify it matches our test items
    expect(matchPoE2RegexItem(result, ws15plain)).toBe(true);
    expect(matchPoE2RegexItem(result, ws18plain)).toBe(true);
    expect(matchPoE2RegexItem(result, ws20plain)).toBe(true);
    expect(matchPoE2RegexItem(result, ws24plain)).toBe(true);
    expect(matchPoE2RegexItem(result, ws10plain)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: % SUFFIX ANCHOR — FN Tests with Realistic Text
//
// KEY FINDING: In-game text shows range notation for +##% accessory mods.
// Format: "+27(22-27)% к сопротивлению огню" — number followed by "(" not "%".
// This means anchorEnd='%' causes FN on ALL items with range notation.
// ═══════════════════════════════════════════════════════════════════════════

describe('% Anchor FN: realistic in-game text with range notation', () => {
  // Items WITHOUT range notation (simple format)
  const ring27Simple = { mods: ['+27% к сопротивлению огню'] };
  const ring30Simple = { mods: ['+30% к сопротивлению огню'] };

  // Items WITH range notation (how PoE2 displays them in search)
  const ring27Range = { mods: ['+27(22-27)% к сопротивлению огню'] };
  const ring30Range = { mods: ['+30(26-30)% к сопротивлению огню'] };

  // FP item: actual roll is 26 but range notation contains 27
  const ring26FP = { mods: ['+26(27-50)% к сопротивлению огню'] };

  // Belt items
  const belt27Simple = { mods: ['+27% к сопротивлению хаосу'] };
  const belt27Range = { mods: ['+27(22-27)% к сопротивлению хаосу'] };

  // Amulet items
  const amulet25Simple = { mods: ['+25% к сопротивлению холоду'] };
  const amulet25Range = { mods: ['+25(21-25)% к сопротивлению холоду'] };

  describe('WITHOUT % anchor: enumeration matches both plain and range notation', () => {
    const regex = '"(2[7-9]|30).*к сопротивлению огню"';

    it('matches plain items', () => {
      expect(matchPoE2RegexItem(regex, ring27Simple)).toBe(true);
      expect(matchPoE2RegexItem(regex, ring30Simple)).toBe(true);
    });

    it('matches range notation items (true positives)', () => {
      expect(matchPoE2RegexItem(regex, ring27Range)).toBe(true);
      expect(matchPoE2RegexItem(regex, ring30Range)).toBe(true);
    });

    it('has FP on range notation items (26 with 27 in range)', () => {
      // FP: "27" from "(27-50)" matches the pattern
      expect(matchPoE2RegexItem(regex, ring26FP)).toBe(true);
    });
  });

  describe('WITH % anchor: FN on range notation items', () => {
    const regex = '"(2[7-9]|30)%.*к сопротивлению огню"';

    it('matches plain items (without range notation)', () => {
      expect(matchPoE2RegexItem(regex, ring27Simple)).toBe(true);
      expect(matchPoE2RegexItem(regex, ring30Simple)).toBe(true);
    });

    it('FAILS to match range notation items (FN!)', () => {
      // In "+27(22-27)%", "27" is followed by "(" not "%" → FN
      expect(matchPoE2RegexItem(regex, ring27Range)).toBe(false); // FN!
      expect(matchPoE2RegexItem(regex, ring30Range)).toBe(false); // FN!
    });

    it('prevents FP from range notation (as designed)', () => {
      expect(matchPoE2RegexItem(regex, ring26FP)).toBe(false); // Correct rejection
    });
  });

  describe('Cross-category: % anchor affects all +##% accessory mods', () => {
    it('ring +##% with % anchor → FN on range notation', () => {
      const regex = '"(2[7-9]|30)%.*к сопротивлению огню"';
      expect(matchPoE2RegexItem(regex, ring27Range)).toBe(false); // FN
    });

    it('belt +##% with % anchor → FN on range notation', () => {
      const regex = '"(2[7-9]|30)%.*к сопротивлению хаосу"';
      expect(matchPoE2RegexItem(regex, belt27Range)).toBe(false); // FN
    });

    it('amulet +##% with % anchor → FN on range notation', () => {
      const regex = '"(2[1-5]|30)%.*к сопротивлению холоду"';
      // "25(21-25)%" → "25" followed by "(" not "%" → FN
      expect(matchPoE2RegexItem(regex, amulet25Range)).toBe(false); // FN
    });
  });

  describe('Decision: remove % anchor for +##% accessory mods', () => {
    it('compiler WITHOUT anchorEnd: enumeration works for both text formats', () => {
      const result = compile(range(27, 30, 'к сопротивлению огню', undefined, undefined, false), { round10: false });
      expect(result).toBe('"(2[7-9]|30).*к сопротивлению огню"');
      expect(result).not.toContain('%');

      // Matches both plain and range notation
      expect(matchPoE2RegexItem(result, ring27Simple)).toBe(true);
      expect(matchPoE2RegexItem(result, ring30Simple)).toBe(true);
      expect(matchPoE2RegexItem(result, ring27Range)).toBe(true);
      expect(matchPoE2RegexItem(result, ring30Range)).toBe(true);
    });

    it('compiler WITH anchorEnd: FN on range notation (the problem)', () => {
      const result = compile(range(27, 30, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
      expect(result).toBe('"(2[7-9]|30)%.*к сопротивлению огню"');

      // Matches plain but NOT range notation
      expect(matchPoE2RegexItem(result, ring27Simple)).toBe(true);
      expect(matchPoE2RegexItem(result, ring27Range)).toBe(false); // FN!
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: WAYSTONE #% VALUES-ONLY — No % Anchor (correct)
//
// Waystone mods with #% template (single hash) correctly do NOT use % anchor.
// These mods always display range notation in-game, so % would be 100% FN.
// ═══════════════════════════════════════════════════════════════════════════

describe('Waystone #% values-only: enumeration without % anchor', () => {
  const ws15 = { mods: ['На 15(15—24)% больше находимых в области путевых камней'] };
  const ws20 = { mods: ['На 20(15—24)% больше находимых в области путевых камней'] };
  const ws10 = { mods: ['На 10% увеличение количества путевых камней, находимых в области'] };

  it('enumeration without % anchor matches range notation items', () => {
    // RANGE(15, 24, 'области путевых камней') — no anchorEnd
    const regex = '"(1[5-9]|2[0-4]).*области путевых камней"';
    expect(matchPoE2RegexItem(regex, ws15)).toBe(true);
    expect(matchPoE2RegexItem(regex, ws20)).toBe(true);
    expect(matchPoE2RegexItem(regex, ws10)).toBe(false);
  });

  it('% anchor would cause 100% FN for #% mods', () => {
    // If we mistakenly added %: "(1[5-9]|2[0-4])%.*области путевых камней"
    // In "15(15—24)%", "15" is followed by "(" not "%" → FN
    const regexBad = '"(1[5-9]|2[0-4])%.*области путевых камней"';
    expect(matchPoE2RegexItem(regexBad, ws15)).toBe(false); // FN!
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: RANGE NOTATION TEXT FORMAT — Test matrix
//
// Document all known in-game text formats and how they interact
// with number + % anchor patterns.
// ═══════════════════════════════════════════════════════════════════════════

describe('Range notation text format: interaction with % anchor', () => {
  const testCases = [
    {
      desc: 'Plain +##% without range notation',
      text: '+27% к сопротивлению огню',
      pattern: '27%',
      shouldMatch: true,
      note: 'Simple format: number directly followed by %',
    },
    {
      desc: 'Range notation: actual roll + range',
      text: '+27(22-27)% к сопротивлению огню',
      pattern: '27%',
      shouldMatch: false,
      note: 'FN: "27" followed by "(" not "%"',
    },
    {
      desc: 'Range notation: lower roll + upper range',
      text: '+26(27-50)% к сопротивлению огню',
      pattern: '27%',
      shouldMatch: false,
      note: '"27" from range is followed by "-" not "%"',
    },
    {
      desc: 'Range notation: )% appears in text',
      text: '+26(27-50)% к сопротивлению огню',
      pattern: ')%',
      shouldMatch: true,
      note: '")%" appears at end of range notation — could be flexible anchor',
    },
    {
      desc: 'Enumeration without % matches range notation',
      text: '+27(22-27)% к сопротивлению огню',
      pattern: '27.*к сопротивлению',
      shouldMatch: true,
      note: 'Without %: "27" + .* + suffix works',
    },
  ];

  for (const tc of testCases) {
    it(`${tc.desc}: "${tc.pattern}" → ${tc.shouldMatch ? 'match' : 'no match'}`, () => {
      const regex = `"${tc.pattern}"`;
      expect(matchPoE2Regex(regex, tc.text)).toBe(tc.shouldMatch);
    });
  }
});
