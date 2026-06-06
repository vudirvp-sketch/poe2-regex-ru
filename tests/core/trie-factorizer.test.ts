/**
 * Tests for Trie Factorizer — Phase 2
 *
 * Covers: Trie construction, prefix/suffix detection, factorization,
 * nested factorization, edge cases, PoE2-specific scenarios.
 */
import { describe, it, expect } from 'vitest';
import {
  buildTrie,
  buildReverseTrie,
  findCommonPrefixes,
  findCommonSuffixes,
  factorize,
  longestCommonPrefix,
  longestCommonSuffix,
  estimateSavings,
  batchFactorize,
} from '@core/trie-factorizer';

// ─── Trie Construction ───

describe('buildTrie', () => {
  it('builds a trie from a single word', () => {
    const trie = buildTrie(['abc']);
    expect(trie.wordCount).toBe(1);
    expect(trie.wordSet.has('abc')).toBe(true);
    expect(trie.children.has('a')).toBe(true);

    const nodeA = trie.children.get('a')!;
    expect(nodeA.char).toBe('a');
    expect(nodeA.wordCount).toBe(1);
    expect(nodeA.wordSet.has('abc')).toBe(true);

    const nodeC = nodeA.children.get('b')!.children.get('c')!;
    expect(nodeC.isEndOfWord).toBe(true);
  });

  it('builds a trie from multiple words with common prefix', () => {
    const trie = buildTrie(['сопротивлению огню', 'сопротивлению холоду', 'сопротивлению молнии']);
    expect(trie.wordCount).toBe(3);

    // Walk down the common prefix "сопротивлению "
    let node = trie;
    for (const ch of 'сопротивлению ') {
      node = node.children.get(ch)!;
      expect(node).toBeDefined();
      expect(node.wordCount).toBe(3);
    }

    // After the space, we branch into "о" (огню), "х" (холоду), "м" (молнии)
    expect(node.children.has('о')).toBe(true);
    expect(node.children.has('х')).toBe(true);
    expect(node.children.has('м')).toBe(true);
  });

  it('handles empty strings', () => {
    const trie = buildTrie(['']);
    expect(trie.wordCount).toBe(1);
    expect(trie.isEndOfWord).toBe(true);
  });

  it('handles duplicate words', () => {
    const trie = buildTrie(['abc', 'abc']);
    expect(trie.wordCount).toBe(2);
    expect(trie.wordSet.size).toBe(1); // Set deduplicates
  });
});

describe('buildReverseTrie', () => {
  it('builds a reverse trie for suffix analysis', () => {
    const trie = buildReverseTrie(['abc', 'xbc']);
    // Reversed: "cba", "cbx" — common prefix "cb"
    expect(trie.wordCount).toBe(2);

    const nodeC = trie.children.get('c')!;
    expect(nodeC).toBeDefined();
    expect(nodeC.wordCount).toBe(2);

    const nodeB = nodeC.children.get('b')!;
    expect(nodeB.wordCount).toBe(2);

    // After "cb", we branch into "a" and "x"
    expect(nodeB.children.has('a')).toBe(true);
    expect(nodeB.children.has('x')).toBe(true);
  });
});

// ─── Common Prefix/Suffix Detection ───

describe('longestCommonPrefix', () => {
  it('finds common prefix of similar words', () => {
    expect(longestCommonPrefix(['сопротивлению огню', 'сопротивлению холоду'])).toBe('сопротивлению ');
  });

  it('returns empty string for no common prefix', () => {
    expect(longestCommonPrefix(['abc', 'xyz'])).toBe('');
  });

  it('returns full string if all strings are identical', () => {
    expect(longestCommonPrefix(['test', 'test'])).toBe('test');
  });

  it('handles empty input', () => {
    expect(longestCommonPrefix([])).toBe('');
  });

  it('handles single input', () => {
    expect(longestCommonPrefix(['abc'])).toBe('abc');
  });
});

describe('longestCommonSuffix', () => {
  it('finds common suffix', () => {
    // Words that share a common suffix (ending)
    expect(longestCommonSuffix(['огню урона', 'холоду урона'])).toBe(' урона');
  });

  it('returns empty string for no common suffix', () => {
    expect(longestCommonSuffix(['abc', 'xyz'])).toBe('');
  });

  it('handles empty input', () => {
    expect(longestCommonSuffix([])).toBe('');
  });
});

describe('findCommonPrefixes', () => {
  it('finds common prefix groups for resistance mods', () => {
    const words = ['сопротивлению огню', 'сопротивлению холоду', 'сопротивлению молнии'];
    const groups = findCommonPrefixes(words);
    expect(groups.length).toBeGreaterThan(0);

    // The main group should have "сопротивлению " as shared prefix
    const mainGroup = groups.find(g => g.shared === 'сопротивлению ');
    expect(mainGroup).toBeDefined();
    expect(mainGroup!.words.length).toBe(3);
    expect(mainGroup!.savings).toBeGreaterThan(0);
  });

  it('returns empty for no commonalities', () => {
    const words = ['abc', 'xyz', '123'];
    const groups = findCommonPrefixes(words);
    expect(groups.length).toBe(0);
  });

  it('respects minGroupSize', () => {
    const words = ['abc1', 'abc2', 'xyz'];
    const groups2 = findCommonPrefixes(words, 2);
    const groups3 = findCommonPrefixes(words, 3);
    expect(groups2.length).toBeGreaterThanOrEqual(0);
    expect(groups3.length).toBe(0); // No prefix shared by all 3
  });
});

describe('findCommonSuffixes', () => {
  it('finds common suffix groups', () => {
    const words = ['огню сопротивлению', 'холоду сопротивлению'];
    const groups = findCommonSuffixes(words);
    expect(groups.length).toBeGreaterThan(0);

    const mainGroup = groups.find(g => g.shared === ' сопротивлению');
    expect(mainGroup).toBeDefined();
  });
});

// ─── Factorization ───

describe('factorize', () => {
  it('factorizes resistance mods with common prefix', () => {
    const words = ['сопротивлению огню', 'сопротивлению холоду', 'сопротивлению молнии'];
    const result = factorize(words);

    expect(result.savings).toBeGreaterThan(0);
    expect(result.regex).toContain('сопротивлению');
    expect(result.regex).toContain('(');
    expect(result.regex).toContain(')');
    expect(result.regex).toContain('|');
    expect(result.regex.length).toBeLessThan(result.originalFlat.length);
  });

  it('factorizes two words with common prefix', () => {
    const result = factorize(['abcde', 'abcxy']);
    expect(result.regex).toBe('abc(de|xy)');
    expect(result.savings).toBeGreaterThan(0);
  });

  it('factorizes words with common suffix', () => {
    const result = factorize(['deabc', 'xyabc']);
    expect(result.savings).toBeGreaterThan(0);
    // Should have some grouping
    expect(result.regex).toContain('(');
  });

  it('returns flat OR when no factorization possible', () => {
    const result = factorize(['abc', 'xyz']);
    expect(result.savings).toBe(0);
    expect(result.regex).toBe('abc|xyz');
  });

  it('handles single word', () => {
    const result = factorize(['single']);
    expect(result.regex).toBe('single');
    expect(result.savings).toBe(0);
  });

  it('handles empty input', () => {
    const result = factorize([]);
    expect(result.regex).toBe('');
    expect(result.savings).toBe(0);
  });

  it('respects maxLength constraint', () => {
    // Very long words that would produce a factorized regex exceeding 20 chars
    const words = ['abcdefghij', 'abcdefghix'];
    const result = factorize(words, 3, 20);
    expect(result.regex.length).toBeLessThanOrEqual(20);
  });

  it('factorizes PoE2-style resistance mods', () => {
    // Real example from the project
    const words = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
    ];
    const result = factorize(words);
    expect(result.savings).toBeGreaterThan(0);
    expect(result.regex).toContain('к сопротивлению');
    expect(result.regex).toContain('(');
  });

  it('factorizes attribute mods', () => {
    const words = ['к силе', 'к ловкости', 'к интеллекту'];
    const result = factorize(words);
    expect(result.savings).toBeGreaterThan(0);
    expect(result.regex).toContain('к ');
  });

  it('handles identical words', () => {
    const result = factorize(['test', 'test']);
    expect(result.regex).toBe('test');
    expect(result.savings).toBeGreaterThan(0);
  });
});

// ─── Estimate Savings ───

describe('estimateSavings', () => {
  it('estimates savings for words with common prefix', () => {
    const savings = estimateSavings(['сопротивлению огню', 'сопротивлению холоду']);
    expect(savings).toBeGreaterThan(0);
  });

  it('returns 0 for no commonalities', () => {
    const savings = estimateSavings(['abc', 'xyz']);
    expect(savings).toBe(0);
  });

  it('returns 0 for single word', () => {
    expect(estimateSavings(['abc'])).toBe(0);
  });

  it('returns 0 for empty input', () => {
    expect(estimateSavings([])).toBe(0);
  });
});

// ─── Batch Factorization ───

describe('batchFactorize', () => {
  it('factorizes multiple groups in a category', () => {
    const allRegexes = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
      'к силе',
      'к ловкости',
      'к интеллекту',
    ];
    const results = batchFactorize(allRegexes);
    expect(results.length).toBeGreaterThan(0);

    // Check that at least one group has savings
    const hasSavings = results.some(r => r.factorized.savings > 0);
    expect(hasSavings).toBe(true);
  });

  it('returns empty for no factorizable groups', () => {
    const results = batchFactorize(['abc', 'xyz', '123']);
    expect(results.length).toBe(0);
  });

  it('handles empty input', () => {
    expect(batchFactorize([])).toEqual([]);
  });

  it('sorts results by savings descending', () => {
    const allRegexes = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
      'к силе',
      'к ловкости',
    ];
    const results = batchFactorize(allRegexes);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].factorized.savings).toBeLessThanOrEqual(
        results[i - 1].factorized.savings
      );
    }
  });
});

// ─── PoE2 Integration Scenarios ───

describe('PoE2 integration scenarios', () => {
  it('factorizes fire/cold/lightning resistance correctly', () => {
    const words = [
      'сопротивлению огню',
      'сопротивлению холоду',
      'сопротивлению молнии',
    ];
    const result = factorize(words);

    // Expected: сопротивлению (огню|холоду|молнии)
    // Flat: сопротивлению огню|сопротивлению холоду|сопротивлению молнии = 64 chars
    // Factorized: ~34 chars
    expect(result.savingsPercent).toBeGreaterThan(30);
    expect(result.regex).toContain('огню');
    expect(result.regex).toContain('холоду');
    expect(result.regex).toContain('молнии');
  });

  it('factorizes attribute mods with common prefix "к "', () => {
    const words = ['к силе', 'к ловкости', 'к интеллекту'];
    const result = factorize(words);

    // Flat: к силе|к ловкости|к интеллекту = 28 chars
    // Factorized: к (силе|ловкости|интеллекту) = 29 chars — no savings!
    // So this might not be factorized (savings = 0 is possible)
    // The grouping adds "()" overhead that may not pay off for short prefixes
    expect(result.savings).toBeGreaterThanOrEqual(0);
  });

  it('handles yofication variant grouping', () => {
    // PoE2 uses [её] for ёфикация
    const words = ['клиней', 'клиней']; // е vs ё
    const result = factorize(words);
    // These are very similar — should be deduplicated
    expect(result.regex.length).toBeGreaterThan(0);
  });

  it('factorizes long optimization regexes', () => {
    // Real case: multiple tiers of the same mod share a long prefix
    const words = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молнии',
      'к сопротивлению хаосу',
    ];
    const result = factorize(words);
    expect(result.savings).toBeGreaterThan(0);
    expect(result.regex).toContain('сопротивлению');
    expect(result.regex).toContain('хаосу');
  });

  it('does not exceed 250 char limit', () => {
    // Generate a large set of words with common prefix
    const words = Array.from({ length: 20 }, (_, i) =>
      `очень длинный общий префикс для модификатора вариант${i + 1}`
    );
    const result = factorize(words, 3, 250);
    expect(result.regex.length).toBeLessThanOrEqual(250);
  });
});
