/**
 * Tests for DP Factorizer — Phase 3
 *
 * Covers: DP factorization, prefix/suffix/combined strategies,
 * nested factorization, PoE2 dialect optimizations, edge cases,
 * comparison with greedy approach (Phase 2).
 */
import { describe, it, expect } from 'vitest';
import {
  dpFactorize,
  applyDialectOptimizations,
  batchDPFactorize,
  estimateDPCost,
} from '@core/dp-factorizer';

// ─── Basic DP Factorization ───

describe('dpFactorize', () => {
  it('handles empty input', () => {
    const result = dpFactorize([]);
    expect(result.regex).toBe('');
    expect(result.cost).toBe(0);
  });

  it('handles single word', () => {
    const result = dpFactorize(['single']);
    expect(result.regex).toBe('single');
    expect(result.cost).toBe(6);
  });

  it('handles duplicate words', () => {
    const result = dpFactorize(['test', 'test']);
    expect(result.regex).toBe('test');
    expect(result.cost).toBe(4);
  });

  it('returns flat OR when no factorization possible', () => {
    const result = dpFactorize(['abc', 'xyz']);
    expect(result.regex).toBe('abc|xyz');
    expect(result.cost).toBe(7);
  });

  it('factorizes two words with common prefix', () => {
    const result = dpFactorize(['abcde', 'abcxy']);
    expect(result.regex).toContain('abc');
    expect(result.cost).toBeLessThan('abcde|abcxy'.length);
  });

  it('factorizes two words with common suffix', () => {
    const result = dpFactorize(['deabc', 'xyabc']);
    expect(result.regex).toContain('abc');
    expect(result.cost).toBeLessThan('deabc|xyabc'.length);
  });

  it('factorizes resistance mods with common prefix', () => {
    const words = ['сопротивлению огню', 'сопротивлению холоду', 'сопротивлению молнии'];
    const result = dpFactorize(words);

    expect(result.cost).toBeLessThan(words.join('|').length);
    expect(result.regex).toContain('сопротивлению');
    expect(result.regex).toContain('(');
    expect(result.regex).toContain(')');
    expect(result.regex).toContain('|');
  });

  it('respects maxLength constraint', () => {
    const words = ['abcdefghij', 'abcdefghix'];
    const result = dpFactorize(words, 15);
    expect(result.cost).toBeLessThanOrEqual(15);
  });
});

// ─── Prefix Factorization ───

describe('dpFactorize — prefix strategy', () => {
  it('factorizes PoE2-style resistance mods', () => {
    const words = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
    ];
    const result = dpFactorize(words);
    expect(result.cost).toBeLessThan(words.join('|').length);
    expect(result.regex).toContain('к сопротивлению');
    expect(result.regex).toContain('(');
  });

  it('factorizes attribute mods', () => {
    const words = ['к силе', 'к ловкости', 'к интеллекту'];
    const result = dpFactorize(words);
    // Even if savings are small, should produce valid regex
    expect(result.regex.length).toBeGreaterThan(0);
    expect(result.cost).toBeLessThanOrEqual(words.join('|').length);
  });

  it('factorizes four resistance types', () => {
    const words = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
      'к сопротивлению хаосу',
    ];
    const result = dpFactorize(words);
    expect(result.regex).toContain('сопротивлению');
    expect(result.regex).toContain('хаосу');
    expect(result.cost).toBeLessThan(words.join('|').length);
  });

  it('handles nested prefix factorization', () => {
    // Three levels of common prefix
    const words = [
      'префикс середина суффикс',
      'префикс середина конец',
      'префикс другой конец',
    ];
    const result = dpFactorize(words);
    expect(result.cost).toBeLessThan(words.join('|').length);
    expect(result.regex).toContain('префикс');
  });
});

// ─── Suffix Factorization ───

describe('dpFactorize — suffix strategy', () => {
  it('factorizes words with common suffix', () => {
    const words = ['огню сопротивлению', 'холоду сопротивлению'];
    const result = dpFactorize(words);
    expect(result.cost).toBeLessThan(words.join('|').length);
    expect(result.regex).toContain('сопротивлению');
  });

  it('factorizes words sharing a verb ending', () => {
    const words = ['увеличение урона', 'повышение урона'];
    const result = dpFactorize(words);
    expect(result.regex).toContain('урона');
  });
});

// ─── Combined Factorization ───

describe('dpFactorize — combined strategy', () => {
  it('extracts both prefix and suffix', () => {
    const words = [
      'префикс середина1 суффикс',
      'префикс середина2 суффикс',
      'префикс середина3 суффикс',
    ];
    const result = dpFactorize(words);
    expect(result.cost).toBeLessThan(words.join('|').length);
    expect(result.regex).toContain('префикс');
    expect(result.regex).toContain('суффикс');
  });

  it('handles empty middle parts (prefix + suffix only)', () => {
    const words = ['префикс суффикс', 'префикс middle суффикс'];
    const result = dpFactorize(words);
    expect(result.cost).toBeLessThan(words.join('|').length);
  });
});

// ─── PoE2 Dialect Optimizations ───

describe('applyDialectOptimizations', () => {
  it('replaces е|ё with [её]', () => {
    const result = applyDialectOptimizations('тест|тёст');
    expect(result).toContain('[её]');
    expect(result).not.toContain('е|ё');
  });

  it('replaces ё|е with [её]', () => {
    const result = applyDialectOptimizations('тёст|тест');
    expect(result).toContain('[её]');
  });

  it('replaces ю|я with [юя]', () => {
    const result = applyDialectOptimizations('молнию|молния');
    expect(result).toContain('[юя]');
  });

  it('replaces а|я with [ая]', () => {
    const result = applyDialectOptimizations('сила|силя');
    expect(result).toContain('[ая]');
  });

  it('does not modify regex without dialect patterns', () => {
    const regex = 'сопротивлению (огню|холоду)';
    const result = applyDialectOptimizations(regex);
    expect(result).toBe(regex);
  });

  it('handles multiple dialect optimizations in one regex', () => {
    const result = applyDialectOptimizations('тесте|тёсте');
    expect(result).toContain('[её]');
  });

  it('preserves character class syntax already present', () => {
    const regex = '[0-9] тест';
    const result = applyDialectOptimizations(regex);
    expect(result).toContain('[0-9]');
  });
});

// ─── Batch DP Factorization ───

describe('batchDPFactorize', () => {
  it('factorizes multiple groups in a category', () => {
    const allRegexes = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
      'к силе',
      'к ловкости',
      'к интеллекту',
    ];
    const results = batchDPFactorize(allRegexes);
    expect(results.length).toBeGreaterThan(0);

    const hasSavings = results.some(r => r.savings > 0);
    expect(hasSavings).toBe(true);
  });

  it('returns empty for no factorizable groups', () => {
    const results = batchDPFactorize(['abc', 'xyz', '123']);
    expect(results.length).toBe(0);
  });

  it('handles empty input', () => {
    expect(batchDPFactorize([])).toEqual([]);
  });

  it('sorts results by savings descending', () => {
    const allRegexes = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
      'к силе',
      'к ловкости',
    ];
    const results = batchDPFactorize(allRegexes);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].savings).toBeLessThanOrEqual(results[i - 1].savings);
    }
  });

  it('computes savings percent correctly', () => {
    const allRegexes = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
    ];
    const results = batchDPFactorize(allRegexes);
    for (const entry of results) {
      if (entry.savings > 0) {
        expect(entry.savingsPercent).toBeGreaterThan(0);
        expect(entry.savingsPercent).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ─── Cost Estimation ───

describe('estimateDPCost', () => {
  it('estimates cost for empty input', () => {
    expect(estimateDPCost([])).toBe(0);
  });

  it('estimates cost for single word', () => {
    expect(estimateDPCost(['test'])).toBe(4);
  });

  it('estimates lower cost for factorizable words', () => {
    const words = ['сопротивлению огню', 'сопротивлению холоду', 'сопротивлению молнии'];
    const estimated = estimateDPCost(words);
    const flatLen = words.join('|').length;
    expect(estimated).toBeLessThan(flatLen);
  });

  it('estimates flat OR cost for non-factorizable words', () => {
    const words = ['abc', 'xyz'];
    const estimated = estimateDPCost(words);
    expect(estimated).toBe(words.join('|').length);
  });
});

// ─── PoE2 Integration Scenarios ───

describe('PoE2 integration scenarios', () => {
  it('DP factorizes fire/cold/lightning resistance correctly', () => {
    const words = [
      'сопротивлению огню',
      'сопротивлению холоду',
      'сопротивлению молнии',
    ];
    const result = dpFactorize(words);

    // Flat: 64 chars
    const flatLen = words.join('|').length;
    const savingsPercent = Math.round(((flatLen - result.cost) / flatLen) * 100);
    expect(result.cost).toBeLessThan(flatLen);
    expect(savingsPercent).toBeGreaterThan(30);
    expect(result.regex).toContain('огню');
    expect(result.regex).toContain('холоду');
    expect(result.regex).toContain('молнии');
  });

  it('DP factorizes four resistance types', () => {
    const words = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
      'к сопротивлению хаосу',
    ];
    const result = dpFactorize(words);
    expect(result.regex).toContain('сопротивлению');
    expect(result.regex).toContain('хаосу');
    expect(result.cost).toBeLessThan(words.join('|').length);
  });

  it('does not exceed 250 char limit', () => {
    const words = Array.from({ length: 20 }, (_, i) =>
      `очень длинный общий префикс для модификатора вариант${i + 1}`
    );
    const result = dpFactorize(words, 250);
    expect(result.cost).toBeLessThanOrEqual(250);
  });

  it('DP result is at least as good as flat OR', () => {
    // DP should never produce a longer regex than flat OR
    const words = ['abc', 'def', 'ghi'];
    const result = dpFactorize(words);
    expect(result.cost).toBeLessThanOrEqual(words.join('|').length);
  });

  it('handles words with spaces correctly', () => {
    const words = [
      'увеличение урона от атак',
      'увеличение урона от молнии',
      'увеличение урона от холода',
    ];
    const result = dpFactorize(words);
    expect(result.cost).toBeLessThan(words.join('|').length);
    expect(result.regex).toContain('увеличение урона');
  });

  it('DP with dialect optimization produces shorter regex', () => {
    // Words that differ only by е/ё
    const words = ['все', 'всё'];
    const dpResult = dpFactorize(words);
    const optimized = applyDialectOptimizations(dpResult.regex);

    // After ёфикация: "все|всё" → "вс[её]" or "вс(е|ё)" → "вс[её]"
    // Either way, the optimized version should use [её]
    expect(optimized).toContain('[её]');
    expect(optimized.length).toBeLessThanOrEqual(dpResult.regex.length);
  });
});

// ─── Comparison with Phase 2 (Greedy) ───

describe('DP vs greedy comparison', () => {
  it('DP result is never worse than flat OR', () => {
    const testCases = [
      ['abc', 'def'],
      ['префикс один', 'префикс два', 'префикс три'],
      ['к сопротивлению огню', 'к сопротивлению холоду'],
      ['x1', 'x2', 'x3', 'x4', 'x5'],
    ];

    for (const words of testCases) {
      const result = dpFactorize(words);
      expect(result.cost).toBeLessThanOrEqual(words.join('|').length);
    }
  });

  it('DP finds combined factorization when beneficial', () => {
    // Words with common prefix AND suffix — DP should find the sandwich
    const words = [
      'к урону огню',
      'к урону холоду',
    ];
    const result = dpFactorize(words);
    expect(result.cost).toBeLessThan(words.join('|').length);
  });
});
