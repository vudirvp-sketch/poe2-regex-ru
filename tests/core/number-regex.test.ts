import { describe, it, expect } from 'vitest';
import { generateNumberRegex, generateEnumeratedRangeRegex, MAX_ENUMERATE_RANGE } from '@core/number-regex';

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

  // ─── Phase 9: Enumerated range regex tests ───

  describe('generateEnumeratedRangeRegex', () => {
    it('narrow range [27, 30] → (27|28|29|30)', () => {
      expect(generateEnumeratedRangeRegex(27, 30)).toBe('(27|28|29|30)');
    });

    it('single value [5, 5] → "5" (no parens)', () => {
      expect(generateEnumeratedRangeRegex(5, 5)).toBe('5');
    });

    it('two values [9, 10] → (9|10)', () => {
      expect(generateEnumeratedRangeRegex(9, 10)).toBe('(9|10)');
    });

    it('cross-digit boundary [98, 102] → (98|99|100|101|102)', () => {
      expect(generateEnumeratedRangeRegex(98, 102)).toBe('(98|99|100|101|102)');
    });

    it('range at MAX_ENUMERATE_RANGE boundary → succeeds', () => {
      // Exactly 50 values → should work
      const result = generateEnumeratedRangeRegex(1, 50);
      expect(result).not.toBeNull();
      expect(result).toContain('1|2|');
      expect(result).toContain('|50');
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
  });
});
