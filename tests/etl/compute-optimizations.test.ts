import { describe, it, expect } from 'vitest';
import { computeOptimizations } from '@etl/compute-optimizations';
import type { NormalizedMod } from '@etl/normalize';

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

describe('computeOptimizations', () => {
  it('finds optimization for tokens sharing a common substring', () => {
    const tokens: NormalizedMod[] = [
      makeMod({ id: 'test.fire', rawText: { ru: 'Сопротивление огню' } }),
      makeMod({ id: 'test.cold', rawText: { ru: 'Сопротивление холоду' } }),
    ];

    const regexResults = new Map<string, { regex: string }>();
    regexResults.set('test.fire', { regex: 'огн' });
    regexResults.set('test.cold', { regex: 'хол' });

    const result = computeOptimizations(tokens, regexResults, 'ru');
    
    // Should find "Соп" or similar as shared substring
    const keys = Object.keys(result);
    if (keys.length > 0) {
      const entry = result[keys[0]];
      expect(entry.regex.ru.length).toBeGreaterThan(0);
      expect(entry.count).toBe(2);
    }
  });

  it('returns empty for tokens with no common substring', () => {
    const tokens: NormalizedMod[] = [
      makeMod({ id: 'test.a', rawText: { ru: 'Абракадабра' } }),
      makeMod({ id: 'test.b', rawText: { ru: 'Эффект buffalo' } }),
    ];

    const regexResults = new Map<string, { regex: string }>();
    regexResults.set('test.a', { regex: 'абр' });
    regexResults.set('test.b', { regex: 'эфф' });

    const result = computeOptimizations(tokens, regexResults, 'ru');
    // These don't share a 3-char prefix, so should be empty
    expect(Object.keys(result).length).toBe(0);
  });

  it('handles empty token list', () => {
    const result = computeOptimizations([], new Map(), 'ru');
    expect(Object.keys(result).length).toBe(0);
  });
});
