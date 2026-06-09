import { describe, it, expect } from 'vitest';
import { generateNumberRegex, generateEnumeratedRangeRegex } from '@core/number-regex';

/**
 * Tests for generateNumberRegex() — the "at least N" pattern generator.
 *
 * CRITICAL: All patterns now use [0-9] instead of `.` for digit matching.
 * In PoE2 regex, `.` matches ANY character (letters, spaces, hyphens, %),
 * NOT just digits. Using [0-9] is CORRECT but produces longer patterns.
 *
 * Examples of the fix:
 *   OLD (WRONG): `[4-9].`     — matches "4-", "4a", "4 " etc.
 *   NEW (RIGHT): `[4-9][0-9]` — matches only "40"-"99"
 */
describe('generateNumberRegex', () => {
  describe('1-digit numbers (no round10)', () => {
    it('1 → ([1-9]|[0-9][0-9][0-9]?)', () => {
      expect(generateNumberRegex('1', false)).toBe('([1-9]|[0-9][0-9][0-9]?)');
    });
    it('5 → ([5-9]|[0-9][0-9][0-9]?)', () => {
      expect(generateNumberRegex('5', false)).toBe('([5-9]|[0-9][0-9][0-9]?)');
    });
    it('9 → ([9]|[0-9][0-9][0-9]?)', () => {
      expect(generateNumberRegex('9', false)).toBe('([9]|[0-9][0-9][0-9]?)');
    });
  });

  describe('2-digit numbers', () => {
    it('10 → ([1-9][0-9]|[0-9][0-9][0-9])', () => {
      expect(generateNumberRegex('10', false)).toBe('([1-9][0-9]|[0-9][0-9][0-9])');
    });
    it('10 with round10 → ([1-9][0-9]|[0-9][0-9][0-9])', () => {
      expect(generateNumberRegex('10', true)).toBe('([1-9][0-9]|[0-9][0-9][0-9])');
    });
    it('50 → ([5-9][0-9]|[0-9][0-9][0-9])', () => {
      expect(generateNumberRegex('50', false)).toBe('([5-9][0-9]|[0-9][0-9][0-9])');
    });
    it('55 with round10 → ([5-9][0-9]|[0-9][0-9][0-9])', () => {
      expect(generateNumberRegex('55', true)).toBe('([5-9][0-9]|[0-9][0-9][0-9])');
    });
    it('90 → (9[0-9]|[0-9][0-9][0-9])', () => {
      expect(generateNumberRegex('90', false)).toBe('(9[0-9]|[0-9][0-9][0-9])');
    });
    it('95 → (9[5-9]|[0-9][0-9][0-9])', () => {
      expect(generateNumberRegex('95', false)).toBe('(9[5-9]|[0-9][0-9][0-9])');
    });
    it('99 → (99|[0-9][0-9][0-9])', () => {
      expect(generateNumberRegex('99', false)).toBe('(99|[0-9][0-9][0-9])');
    });
  });

  describe('3-digit numbers', () => {
    it('100 → ([1-9][0-9][0-9])', () => {
      expect(generateNumberRegex('100', false)).toBe('([1-9][0-9][0-9])');
    });
    it('150 → (1[5-9][0-9]|[2-9][0-9][0-9])', () => {
      expect(generateNumberRegex('150', false)).toBe('(1[5-9][0-9]|[2-9][0-9][0-9])');
    });
    it('200 → [2-9][0-9][0-9]', () => {
      expect(generateNumberRegex('200', false)).toBe('[2-9][0-9][0-9]');
    });
  });

  describe('edge cases', () => {
    it('0 → empty string', () => {
      expect(generateNumberRegex('0', false)).toBe('');
    });
    it('non-numeric → empty string', () => {
      expect(generateNumberRegex('abc', false)).toBe('');
    });
    it('5 with round10 → [0-9] (any digit = ≥0)', () => {
      // round10 with single digit: floor(5/10)*10 = 0, but the original
      // returns '.' for this case. Now we return [0-9] which is correct.
      expect(generateNumberRegex('5', true)).toBe('[0-9]');
    });
  });

  // ─── Phase 9-10: Enumerated range regex tests (with decade grouping) ───

  describe('generateEnumeratedRangeRegex', () => {
    it('narrow range [27, 30] → compact decade grouping (2[7-9]|30)', () => {
      // Phase 10: decade grouping produces compact character-class patterns
      // instead of flat enumeration (27|28|29|30)
      expect(generateEnumeratedRangeRegex(27, 30)).toBe('(2[7-9]|30)');
    });

    it('single value [5, 5] → "5" (no parens)', () => {
      expect(generateEnumeratedRangeRegex(5, 5)).toBe('5');
    });

    it('two values [9, 10] → (9|10)', () => {
      // Two values: simple alternation is shorter than character class grouping
      expect(generateEnumeratedRangeRegex(9, 10)).toBe('(9|10)');
    });

    it('cross-digit boundary [98, 102] → compact (9[8-9]|10[0-2])', () => {
      // Phase 10: cross-digit-boundary splits at 100 and groups each part
      expect(generateEnumeratedRangeRegex(98, 102)).toBe('(9[8-9]|10[0-2])');
    });

    it('range at MAX_ENUMERATE_RANGE boundary → succeeds with compact form', () => {
      // Exactly 50 values → should work with decade grouping
      const result = generateEnumeratedRangeRegex(1, 50);
      expect(result).not.toBeNull();
      // Phase 10: compact format uses character classes, not flat enumeration
      expect(result).toContain('[1-9]');
      expect(result).toContain('50');
    });

    it('range exceeding MAX_ENUMERATE_RANGE → returns null', () => {
      // 51 values > 50 → null (fallback to AND)
      expect(generateEnumeratedRangeRegex(1, 51)).toBeNull();
    });

    it('invalid range (min > max) → returns null', () => {
      expect(generateEnumeratedRangeRegex(30, 27)).toBeNull();
    });

    it('large range clearly over limit → returns null', () => {
      expect(generateEnumeratedRangeRegex(10, 200)).toBeNull();
    });

    // ─── Phase 10: Decade grouping tests ───

    it('full decade [30, 39] → 3[0-9]', () => {
      expect(generateEnumeratedRangeRegex(30, 39)).toBe('3[0-9]');
    });

    it('two full decades [30, 49] → (3[0-9]|4[0-9])', () => {
      expect(generateEnumeratedRangeRegex(30, 49)).toBe('(3[0-9]|4[0-9])');
    });

    it('medium range [40, 80] → compact decade grouping', () => {
      // Phase 10: (4[0-9]|5[0-9]|6[0-9]|7[0-9]|80) instead of 41 flat values
      const result = generateEnumeratedRangeRegex(40, 80);
      expect(result).not.toBeNull();
      expect(result).toContain('4[0-9]');
      expect(result).toContain('80');  // Single value at decade boundary, not 8[0]
      // Compact form is much shorter than flat enumeration
      expect(result!.length).toBeLessThan(50);
    });

    it('partial decade at start [27, 49] → (2[7-9]|3[0-9]|4[0-9])', () => {
      expect(generateEnumeratedRangeRegex(27, 49)).toBe('(2[7-9]|3[0-9]|4[0-9])');
    });

    it('partial decade at end [30, 52] → (3[0-9]|4[0-9]|5[0-2])', () => {
      expect(generateEnumeratedRangeRegex(30, 52)).toBe('(3[0-9]|4[0-9]|5[0-2])');
    });

    it('single-digit range [3, 7] → [3-7]', () => {
      expect(generateEnumeratedRangeRegex(3, 7)).toBe('[3-7]');
    });

    it('full single-digit range [0, 9] → [0-9]', () => {
      expect(generateEnumeratedRangeRegex(0, 9)).toBe('[0-9]');
    });

    it('three-digit range [100, 149] → compact grouping (within MAX_ENUMERATE_RANGE)', () => {
      // 50 values = exactly MAX_ENUMERATE_RANGE
      const result = generateEnumeratedRangeRegex(100, 149);
      expect(result).not.toBeNull();
      expect(result).toContain('10[0-9]');
      expect(result).toContain('14[0-9]');
    });
  });
});
