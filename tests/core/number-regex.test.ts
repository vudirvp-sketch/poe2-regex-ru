import { describe, it, expect } from 'vitest';
import { generateNumberRegex } from '@core/number-regex';

describe('generateNumberRegex', () => {
  describe('1-digit numbers (no round10)', () => {
    it('1 -> ([1-9]|[0-9]..?)', () => {
      expect(generateNumberRegex('1', false)).toBe('([1-9]|[0-9]..?)');
    });
    it('5 -> ([5-9]|[0-9]..?)', () => {
      expect(generateNumberRegex('5', false)).toBe('([5-9]|[0-9]..?)');
    });
    it('9 -> ([9]|[0-9]..?)', () => {
      expect(generateNumberRegex('9', false)).toBe('([9]|[0-9]..?)');
    });
  });

  describe('2-digit numbers', () => {
    it('10 -> ([1-9].|[0-9]..)', () => {
      expect(generateNumberRegex('10', false)).toBe('([1-9].|[0-9]..)');
    });
    it('10 with round10 -> ([1-9].|[0-9]..)', () => {
      expect(generateNumberRegex('10', true)).toBe('([1-9].|[0-9]..)');
    });
    it('50 -> ([5-9].|[0-9]..)', () => {
      expect(generateNumberRegex('50', false)).toBe('([5-9].|[0-9]..)');
    });
    it('55 with round10 -> ([5-9].|[0-9]..)', () => {
      expect(generateNumberRegex('55', true)).toBe('([5-9].|[0-9]..)');
    });
    it('90 -> (9[0-9]|[0-9]..)', () => {
      expect(generateNumberRegex('90', false)).toBe('(9[0-9]|[0-9]..)');
    });
    it('95 -> (9[5-9]|[0-9]..)', () => {
      expect(generateNumberRegex('95', false)).toBe('(9[5-9]|[0-9]..)');
    });
    it('99 -> (99|[0-9]..)', () => {
      expect(generateNumberRegex('99', false)).toBe('(99|[0-9]..)');
    });
  });

  describe('3-digit numbers', () => {
    it('100 -> ([1-9]..)', () => {
      expect(generateNumberRegex('100', false)).toBe('([1-9]..)');
    });
    it('150 -> (1[5-9].|[2-9]..)', () => {
      expect(generateNumberRegex('150', false)).toBe('(1[5-9].|[2-9]..)');
    });
    it('200 -> [2-9]..', () => {
      expect(generateNumberRegex('200', false)).toBe('[2-9]..');
    });
  });

  describe('edge cases', () => {
    it('0 -> empty string', () => {
      expect(generateNumberRegex('0', false)).toBe('');
    });
    it('non-numeric -> empty string', () => {
      expect(generateNumberRegex('abc', false)).toBe('');
    });
    it('5 with round10 -> .', () => {
      expect(generateNumberRegex('5', true)).toBe('.');
    });
  });
});
