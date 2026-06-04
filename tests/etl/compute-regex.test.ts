import { describe, it, expect } from 'vitest';
import { computeMinimalUniqueSubstring, computeAllRegexes } from '@etl/compute-regex';
import type { NormalizedMod } from '@etl/normalize';

// Helper to create a NormalizedMod for testing
function makeMod(overrides: Partial<NormalizedMod> & { id: string; rawText: Record<string, string> }): NormalizedMod {
  return {
    category: 'test',
    origin: 'normal',
    rawTextTemplate: overrides.rawText,
    genderForms: { ru: {} },
    affix: 'suffix',
    tags: [],
    ranges: [],
    values: [],
    hasYofication: false,
    yoficationPositions: [],
    level: 1,
    ...overrides,
  };
}

describe('computeMinimalUniqueSubstring', () => {
  it('finds a unique substring for a token among others', () => {
    const tokens: NormalizedMod[] = [
      makeMod({ id: 'test.fire', rawText: { ru: 'Сопротивление огню' } }),
      makeMod({ id: 'test.cold', rawText: { ru: 'Сопротивление холоду' } }),
      makeMod({ id: 'test.lightning', rawText: { ru: 'Сопротивление молниям' } }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex.length).toBeGreaterThan(0);
    expect(result.regex).toBeTruthy();
  });

  it('twin mods with same prefix get different substrings', () => {
    const tokens: NormalizedMod[] = [
      makeMod({ id: 'test.fire_res', rawText: { ru: 'Сопротивление огню' } }),
      makeMod({ id: 'test.cold_res', rawText: { ru: 'Сопротивление холоду' } }),
    ];

    const result1 = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    const result2 = computeMinimalUniqueSubstring(tokens[1], tokens, 'ru');

    expect(result1.regex).toBeTruthy();
    expect(result2.regex).toBeTruthy();
    // The two substrings should be different
    expect(result1.regex).not.toBe(result2.regex);
  });

  it('returns something for a single token (no competitors)', () => {
    const tokens: NormalizedMod[] = [
      makeMod({ id: 'test.unique', rawText: { ru: 'Уникальный мод' } }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex.length).toBeGreaterThan(0);
  });

  it('handles empty text gracefully', () => {
    const tokens: NormalizedMod[] = [
      makeMod({ id: 'test.empty', rawText: { ru: '' } }),
      makeMod({ id: 'test.other', rawText: { ru: 'Другой мод' } }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    // Should not crash, may return empty
    expect(typeof result.regex).toBe('string');
  });
});

describe('computeAllRegexes', () => {
  it('computes regex for all tokens', () => {
    const tokens: NormalizedMod[] = [
      makeMod({ id: 'test.a', rawText: { ru: 'Мод альфа' } }),
      makeMod({ id: 'test.b', rawText: { ru: 'Мод бета' } }),
      makeMod({ id: 'test.c', rawText: { ru: 'Мод гамма' } }),
    ];

    const results = computeAllRegexes(tokens, 'ru');
    expect(results.size).toBe(3);
    for (const [, result] of results) {
      expect(result.regex.length).toBeGreaterThan(0);
    }
  });
});
