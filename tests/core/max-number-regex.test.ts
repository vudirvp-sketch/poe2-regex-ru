import { describe, it, expect } from 'vitest';
import { generateMaxNumberRegex } from '@core/number-regex';

/**
 * Focused tests for generateMaxNumberRegex() — the "at most N" counterpart
 * to generateNumberRegex().
 *
 * CRITICAL: All patterns now use [0-9] instead of `.` for digit matching.
 * In PoE2 regex, `.` matches ANY character, NOT just digits.
 *
 * Examples of the fix:
 *   OLD (WRONG): `[1-4].`     — matches "1-", "1a", "1 " etc.
 *   NEW (RIGHT): `[1-4][0-9]` — matches only "10"-"49"
 */
describe('generateMaxNumberRegex', () => {
  describe('single digit max (0-9)', () => {
    it('max=5 → "([0-5])" matches 0..5', () => {
      expect(generateMaxNumberRegex('5', false)).toBe('([0-5])');
    });

    it('max=9 → "([0-9])" matches any single digit', () => {
      expect(generateMaxNumberRegex('9', false)).toBe('([0-9])');
    });
  });

  describe('two-digit max', () => {
    it('max=10 → "([0-9]|10)" matches 0-9 and 10', () => {
      expect(generateMaxNumberRegex('10', false)).toBe('([0-9]|10)');
    });

    it('max=15 → "([0-9]|1[0-5])" matches 0-15', () => {
      expect(generateMaxNumberRegex('15', false)).toBe('([0-9]|1[0-5])');
    });

    it('max=50 → "([0-9]|[1-4][0-9]|50)" matches 0-50', () => {
      expect(generateMaxNumberRegex('50', false)).toBe('([0-9]|[1-4][0-9]|50)');
    });

    it('max=99 → "([0-9]|[1-8][0-9]|9[0-9])" matches 0-99', () => {
      expect(generateMaxNumberRegex('99', false)).toBe('([0-9]|[1-8][0-9]|9[0-9])');
    });

    it('max=30 → "([0-9]|[1-2][0-9]|30)" matches 0-30', () => {
      expect(generateMaxNumberRegex('30', false)).toBe('([0-9]|[1-2][0-9]|30)');
    });

    it('max=25 → "([0-9]|1[0-9]|2[0-5])" matches 0-25', () => {
      expect(generateMaxNumberRegex('25', false)).toBe('([0-9]|1[0-9]|2[0-5])');
    });
  });

  describe('three-digit max', () => {
    it('max=100 → "([0-9]|[1-9][0-9]|100)" matches 0-100', () => {
      expect(generateMaxNumberRegex('100', false)).toBe('([0-9]|[1-9][0-9]|100)');
    });

    it('max=200 → "([0-9]|[1-9][0-9]|[1-1][0-9][0-9]|200)" matches 0-200', () => {
      expect(generateMaxNumberRegex('200', false)).toBe('([0-9]|[1-9][0-9]|[1-1][0-9][0-9]|200)');
    });
  });

  describe('round10', () => {
    it('max=55 with round10 → rounds up to 60', () => {
      // round10: ceil(55/10)*10 = 60
      const result = generateMaxNumberRegex('55', true);
      // 60 → twoDigitMax(60) → d1='0', D0=6 → "([0-9]|[1-5][0-9]|60)"
      expect(result).toBe('([0-9]|[1-5][0-9]|60)');
    });
  });

  describe('edge cases', () => {
    it('0 → empty (no numbers ≤ 0 in PoE regex context)', () => {
      expect(generateMaxNumberRegex('0', false)).toBe('');
    });

    it('non-numeric → empty', () => {
      expect(generateMaxNumberRegex('abc', false)).toBe('');
    });

    it('negative extracts digits and generates for absolute value', () => {
      // -5 → match /\d/g extracts '5' → generateMaxNumberRegex for 5
      expect(generateMaxNumberRegex('-5', false)).toBe('([0-5])');
    });
  });
});
