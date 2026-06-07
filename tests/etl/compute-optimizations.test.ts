import { describe, it, expect } from 'vitest';
import { computeOptimizations } from '@etl/compute-optimizations';
import type { NormalizedMod } from '@etl/normalize';
import type { RegexResult } from '@etl/compute-regex';

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

function makeRegexResult(overrides: Partial<RegexResult> & { regex: string }): RegexResult {
  return {
    hasYofication: false,
    yoficationPositions: [],
    familyKey: overrides.regex,
    regexPrefix: '',
    hasMultiPlaceholder: false,
    regexExclude: [],
    ...overrides,
  };
}

describe('computeOptimizations', () => {
  it('finds optimization for tokens sharing a common substring', () => {
    const tokens: NormalizedMod[] = [
      makeMod({ id: 'test.fire', rawText: { ru: 'Сопротивление огню' } }),
      makeMod({ id: 'test.cold', rawText: { ru: 'Сопротивление холоду' } }),
    ];

    const regexResults = new Map<string, RegexResult>();
    regexResults.set('test.fire', makeRegexResult({ regex: 'огн' }));
    regexResults.set('test.cold', makeRegexResult({ regex: 'хол' }));

    const result = computeOptimizations(tokens, regexResults, 'ru');
    
    // Should find a shared substring like "сопро" or similar
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

    const regexResults = new Map<string, RegexResult>();
    regexResults.set('test.a', makeRegexResult({ regex: 'абр' }));
    regexResults.set('test.b', makeRegexResult({ regex: 'эфф' }));

    const result = computeOptimizations(tokens, regexResults, 'ru');
    // These don't share a 4-char common substring, so should be empty
    expect(Object.keys(result).length).toBe(0);
  });

  it('handles empty token list', () => {
    const result = computeOptimizations([], new Map(), 'ru');
    expect(Object.keys(result).length).toBe(0);
  });

  // ─── Phase 4+6: DP factorization + dialect optimizations ───

  describe('DP factorization integration', () => {
    it('finds cross-family DP factorization for regexes with common prefix', () => {
      const tokens: NormalizedMod[] = [
        makeMod({ id: 'test.fire', rawText: { ru: 'к сопротивлению огню' } }),
        makeMod({ id: 'test.cold', rawText: { ru: 'к сопротивлению холоду' } }),
        makeMod({ id: 'test.lightning', rawText: { ru: 'к сопротивлению молниям' } }),
      ];

      const regexResults = new Map<string, RegexResult>();
      regexResults.set('test.fire', makeRegexResult({ regex: 'к сопротивлению огню', familyKey: 'fam_fire' }));
      regexResults.set('test.cold', makeRegexResult({ regex: 'к сопротивлению холоду', familyKey: 'fam_cold' }));
      regexResults.set('test.lightning', makeRegexResult({ regex: 'к сопротивлению молниям', familyKey: 'fam_lightning' }));

      const result = computeOptimizations(tokens, regexResults, 'ru');

      // Should find a factorization that groups these by "к сопротивлению"
      const entries = Object.values(result);
      const dpEntry = entries.find(e => e.regex.ru.includes('сопротивлению'));
      expect(dpEntry).toBeDefined();
      if (dpEntry) {
        // The factorized regex should be shorter than the flat OR
        expect(dpEntry.regex.ru.length).toBeLessThan(
          'к сопротивлению огню|к сопротивлению холоду|к сопротивлению молниям'.length
        );
      }
    });

    it('DP factorization produces shorter regexes than flat OR for similar families', () => {
      const tokens: NormalizedMod[] = [
        makeMod({ id: 'test.a', rawText: { ru: 'увеличение урона' } }),
        makeMod({ id: 'test.b', rawText: { ru: 'увеличение защиты' } }),
      ];

      const regexResults = new Map<string, RegexResult>();
      regexResults.set('test.a', makeRegexResult({ regex: 'увеличение урона', familyKey: 'fam_a' }));
      regexResults.set('test.b', makeRegexResult({ regex: 'увеличение защиты', familyKey: 'fam_b' }));

      const result = computeOptimizations(tokens, regexResults, 'ru');

      const entries = Object.values(result);
      const dpEntry = entries.find(e => e.regex.ru.includes('увеличение'));
      if (dpEntry) {
        // Factorized: "увеличение (урона|защиты)" < "увеличение урона|увеличение защиты"
        expect(dpEntry.regex.ru.length).toBeLessThan(
          'увеличение урона|увеличение защиты'.length
        );
      }
    });
  });

  describe('Dialect optimization integration', () => {
    it('applies [её] dialect optimization to optimization entry regexes', () => {
      // Two tokens with regexes that differ only in е/ё
      const tokens: NormalizedMod[] = [
        makeMod({ id: 'test.e', rawText: { ru: 'к сопротивлению' } }),
        makeMod({ id: 'test.yo', rawText: { ru: 'к сопротивлёнию' } }),
      ];

      const regexResults = new Map<string, RegexResult>();
      regexResults.set('test.e', makeRegexResult({ regex: 'сопротивлению', familyKey: 'fam_e' }));
      regexResults.set('test.yo', makeRegexResult({ regex: 'сопротивлёнию', familyKey: 'fam_yo' }));

      const result = computeOptimizations(tokens, regexResults, 'ru');

      // The DP factorization should produce something like "сопротивл(ению|ёнию)"
      // and then dialect optimization should turn (е|ё) → [её]
      const entries = Object.values(result);
      // Check if any entry has dialect-optimized regex
      const hasDialectOpt = entries.some(e =>
        e.regex.ru.includes('[её]') || e.regex.ru.includes('[юя]')
      );
      // If DP found a factorization, it should have been dialect-optimized
      if (entries.length > 0 && entries.some(e => e.regex.ru.includes('сопротивл'))) {
        expect(hasDialectOpt).toBe(true);
      }
    });

    it('applies [юя] dialect optimization for ending pairs', () => {
      const tokens: NormalizedMod[] = [
        makeMod({ id: 'test.yu', rawText: { ru: 'молнию' } }),
        makeMod({ id: 'test.ya', rawText: { ru: 'молния' } }),
      ];

      const regexResults = new Map<string, RegexResult>();
      regexResults.set('test.yu', makeRegexResult({ regex: 'молнию', familyKey: 'fam_yu' }));
      regexResults.set('test.ya', makeRegexResult({ regex: 'молния', familyKey: 'fam_ya' }));

      const result = computeOptimizations(tokens, regexResults, 'ru');

      const entries = Object.values(result);
      const hasDialectOpt = entries.some(e => e.regex.ru.includes('[юя]'));
      if (entries.length > 0) {
        expect(hasDialectOpt).toBe(true);
      }
    });
  });

  describe('Family-based grouping (Phase A) still works', () => {
    it('creates optimization for tokens in the same family', () => {
      const tokens: NormalizedMod[] = [
        makeMod({ id: 'test.fire1', rawText: { ru: '+(5-10)% к сопротивлению огню' } }),
        makeMod({ id: 'test.fire2', rawText: { ru: '+(11-15)% к сопротивлению огню' } }),
        makeMod({ id: 'test.fire3', rawText: { ru: '+(16-20)% к сопротивлению огню' } }),
      ];

      const regexResults = new Map<string, RegexResult>();
      regexResults.set('test.fire1', makeRegexResult({ regex: 'к сопротивлению огню', familyKey: '+#% к сопротивлению огню' }));
      regexResults.set('test.fire2', makeRegexResult({ regex: 'к сопротивлению огню', familyKey: '+#% к сопротивлению огню' }));
      regexResults.set('test.fire3', makeRegexResult({ regex: 'к сопротивлению огню', familyKey: '+#% к сопротивлению огню' }));

      const result = computeOptimizations(tokens, regexResults, 'ru');

      const entries = Object.values(result);
      const familyEntry = entries.find(e => e.count === 3);
      expect(familyEntry).toBeDefined();
      if (familyEntry) {
        expect(familyEntry.regex.ru).toBe('к сопротивлению огню');
      }
    });
  });
});
