import { describe, it, expect } from 'vitest';
import { generateMaxNumberRegex } from '@core/number-regex';

/**
 * Focused tests for generateMaxNumberRegex() — the "at most N" counterpart
 * to generateNumberRegex(). Each test validates a distinct pattern class
 * rather than exhaustive digit combinations.
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

    it('max=50 → "([0-9]|[1-4].|50)" matches 0-50', () => {
      expect(generateMaxNumberRegex('50', false)).toBe('([0-9]|[1-4].|50)');
    });

    it('max=99 → "([0-9]|[1-8].|9[0-9])" matches 0-99', () => {
      // D0=9, d1=9, d2=9: twoDigitMax generates precise 90-99 range
      expect(generateMaxNumberRegex('99', false)).toBe('([0-9]|[1-8].|9[0-9])');
    });

    it('max=30 → "([0-9]|[1-2].|30)" matches 0-30', () => {
      // D0=3, d1='0': round number pattern
      expect(generateMaxNumberRegex('30', false)).toBe('([0-9]|[1-2].|30)');
    });

    it('max=25 → "([0-9]|1.|2[0-5])" matches 0-25', () => {
      expect(generateMaxNumberRegex('25', false)).toBe('([0-9]|1.|2[0-5])');
    });
  });

  describe('three-digit max', () => {
    it('max=100 → "([0-9]|[1-9].|100)" matches 0-100', () => {
      expect(generateMaxNumberRegex('100', false)).toBe('([0-9]|[1-9].|100)');
    });

    it('max=200 → "([0-9]|[1-9].|[1-1]..|200)" matches 0-200', () => {
      expect(generateMaxNumberRegex('200', false)).toBe('([0-9]|[1-9].|[1-1]..|200)');
    });
  });

  describe('round10', () => {
    it('max=55 with round10 → rounds up to 60', () => {
      // round10: ceil(55/10)*10 = 60
      const result = generateMaxNumberRegex('55', true);
      // 60 → twoDigitMax(60) → d1='0', D0=6 → "([0-9]|[1-5].|60)"
      expect(result).toBe('([0-9]|[1-5].|60)');
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
      // This is consistent with generateNumberRegex behavior on negative input
      expect(generateMaxNumberRegex('-5', false)).toBe('([0-5])');
    });
  });
});
