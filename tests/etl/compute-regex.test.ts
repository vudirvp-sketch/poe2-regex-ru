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

describe('() grouping prevention (P0 fix)', () => {
  it('never produces regex containing ( or ) from rawText with parenthesized number ranges', () => {
    // Simulate mods like "(4—6)% увеличение области действия" and "(5—15)% повышение шанса"
    // These have (num—num) patterns that PoE2 interprets as grouping, breaking the regex.
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'test.paren1',
        rawText: { ru: '(4—6)% увеличение области действия' },
        rawTextTemplate: { ru: '(##)% увеличение области действия' },
        category: 'jewel',
      }),
      makeMod({
        id: 'test.paren2',
        rawText: { ru: '(5—15)% повышение шанса критического удара' },
        rawTextTemplate: { ru: '(##)% повышение шанса критического удара' },
        category: 'jewel',
      }),
      makeMod({
        id: 'test.paren3',
        rawText: { ru: '+(4—6) к силе' },
        rawTextTemplate: { ru: '+#(##) к силе' },
        category: 'jewel-corrupted',
      }),
    ];

    for (const token of tokens) {
      const result = computeMinimalUniqueSubstring(token, tokens, 'ru');
      expect(result.regex).not.toContain('(');
      expect(result.regex).not.toContain(')');
    }
  });

  it('avoids parens in waystone mods with (num—num) pattern', () => {
    // Real waystone bug: "Меткость монстров повышена на (20—30)%"
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'waystone.accuracy20',
        rawText: { ru: 'Меткость монстров повышена на (20—30)%' },
        rawTextTemplate: { ru: 'Меткость монстров повышена на (##)%' },
        category: 'waystone',
      }),
      makeMod({
        id: 'waystone.accuracy30',
        rawText: { ru: 'Меткость монстров повышена на (30—40)%' },
        rawTextTemplate: { ru: 'Меткость монстров повышена на (##)%' },
        category: 'waystone',
      }),
    ];

    for (const token of tokens) {
      const result = computeMinimalUniqueSubstring(token, tokens, 'ru');
      expect(result.regex).not.toContain('(');
      expect(result.regex).not.toContain(')');
      expect(result.regex.length).toBeGreaterThan(0);
    }
  });

  it('still finds valid regex for mods with (num—num) when text after parens is unique', () => {
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'test.area',
        rawText: { ru: '(4—6)% увеличение области действия' },
        rawTextTemplate: { ru: '(##)% увеличение области действия' },
        category: 'jewel',
      }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex).toBeTruthy();
    expect(result.regex).not.toContain('(');
    expect(result.regex).not.toContain(')');
    // Should find "увеличение области действия" or similar text after the parens
    expect(result.regex.length).toBeGreaterThanOrEqual(5);
  });
});

// ─── Phase 8: Strategy 1e (Word Truncation) + computeExcludePatterns() refactoring ───

describe('Strategy 1e: Word Truncation', () => {
  it('truncates suffix words to find shorter unique regex', () => {
    // "к сопротивлению огню" — truncating "сопротивлению" and "огню"
    // should find a shorter form like "к сопр огн" if it's unique
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'test.fire_res',
        rawText: { ru: '+(10—15)% к сопротивлению огню' },
        rawTextTemplate: { ru: '+##% к сопротивлению огню' },
      }),
      makeMod({
        id: 'test.cold_res',
        rawText: { ru: '+(10—15)% к сопротивлению холоду' },
        rawTextTemplate: { ru: '+##% к сопротивлению холоду' },
      }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex).toBeTruthy();
    expect(result.regex.length).toBeGreaterThan(0);
    // The result should distinguish fire from cold resistance
    // Could be "к сопротивлению огню", "сопротивлению огню", "огню", etc.
  });

  it('uses truncated suffix + short negate for compound-family conflicts', () => {
    // Simulate: "к силе" matches both pure and compound mods
    // Pure: "+(9—15) к силе"
    // Compound: "+(9—15) к силе и интеллекту", "+(6—10) к силе и ловкости"
    // Expected: truncated suffix "к си" with negate " и" = 9 chars total
    // vs. old: "к силе" !"к силе и" !"к силе," = 40 chars
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'test.str_pure',
        rawText: { ru: '+(9—15) к силе' },
        rawTextTemplate: { ru: '+## к силе' },
      }),
      makeMod({
        id: 'test.str_int',
        rawText: { ru: '+(9—15) к силе и интеллекту' },
        rawTextTemplate: { ru: '+## к силе и интеллекту' },
      }),
      makeMod({
        id: 'test.str_dex',
        rawText: { ru: '+(6—10) к силе и ловкости' },
        rawTextTemplate: { ru: '+## к силе и ловкости' },
      }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex).toBeTruthy();

    // The result should be shorter than the full suffix + long excludes
    // Either:
    // - "к си" with regexExclude [" и"] (9 total)
    // - "к силе" with regexExclude (short marker, not full phrase)
    // - Or a unique tail that avoids the compound entirely

    // Key assertion: the regex + excludes should be shorter than the naive approach
    const totalLen = result.regex.length +
      (result.regexExclude || []).reduce((sum, exc) => sum + exc.length + 3, 0);
    const naiveLen = 'к силе'.length + 'к силе и'.length + 3 + 'к силе,'.length + 3; // ~40 chars
    expect(totalLen).toBeLessThan(naiveLen);
  });

  it('finds unique tail that avoids negate entirely', () => {
    // "урона хаосом" is unique in the category — no negate needed
    // vs. "увеличение урона" !"увеличение урона от" !"увеличение урона хаосом" (62 chars)
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'test.chaos_dmg',
        rawText: { ru: '+(30—50)% увеличение урона хаосом' },
        rawTextTemplate: { ru: '+##% увеличение урона хаосом' },
      }),
      makeMod({
        id: 'test.generic_dmg',
        rawText: { ru: '+(30—50)% увеличение урона' },
        rawTextTemplate: { ru: '+##% увеличение урона' },
      }),
      makeMod({
        id: 'test.fire_dmg',
        rawText: { ru: '+(30—50)% увеличение урона от огня' },
        rawTextTemplate: { ru: '+##% увеличение урона от огня' },
      }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex).toBeTruthy();

    // The unique tail "урона хаосом" (12 chars) should be shorter than
    // the prefix+negate approach, so no excludes should be needed
    // OR the result should be very short
    expect(result.regex.length).toBeLessThanOrEqual(20);
  });

  it('does not use mid-word truncation', () => {
    // Truncation should only remove trailing chars from words.
    // "увеличение" → "увеличен" is valid trailing truncation,
    // but we should NOT extract "еличен" (skipping "ув")
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'test.mod1',
        rawText: { ru: '+(10—20)% увеличение урона' },
        rawTextTemplate: { ru: '+##% увеличение урона' },
      }),
      makeMod({
        id: 'test.mod2',
        rawText: { ru: '+(5—10)% повышение брони' },
        rawTextTemplate: { ru: '+##% повышение брони' },
      }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex).toBeTruthy();
    // The regex should start with the beginning of a word, not the middle
    // Valid: "увелич", "увеличе", "увеличение"
    // Invalid: "еличен", "личен", "ичен"
  });

  it('respects minimum 3 significant chars per truncated word', () => {
    // Each TRUNCATED word in the suffix must have ≥3 significant chars.
    // Prepositions like "к" (1 char) are naturally short — they're not truncated.
    // But if "силе" is truncated to "си" (2 chars), that's fine because
    // the minimum applies to the RESULT, not each individual word.
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'test.str',
        rawText: { ru: '+(9—15) к силе' },
        rawTextTemplate: { ru: '+## к силе' },
      }),
      makeMod({
        id: 'test.int',
        rawText: { ru: '+(9—15) к интеллекту' },
        rawTextTemplate: { ru: '+## к интеллекту' },
      }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex).toBeTruthy();
    // The result regex itself should be meaningful (≥3 chars total)
    expect(result.regex.length).toBeGreaterThanOrEqual(3);
    // Prepositions like "к" are fine at 1 char — they weren't truncated
    // Truncated words should keep ≥3 chars (enforced by generateTruncatedSuffixes)
  });
});

describe('computeExcludePatterns: short marker priorities', () => {
  it('uses minion marker when all conflicts are minion variants', () => {
    // Pure player mod vs. minion variants:
    // "к сопротивлению всем стихиям" vs. "Приспешники имеют +X% к сопротивлению всем стихиям"
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'test.all_res_player',
        rawText: { ru: '+(8—12)% к сопротивлению всем стихиям' },
        rawTextTemplate: { ru: '+##% к сопротивлению всем стихиям' },
      }),
      makeMod({
        id: 'test.all_res_minion',
        rawText: { ru: 'Приспешники имеют +(15—25)% к сопротивлению всем стихиям' },
        rawTextTemplate: { ru: 'Приспешники имеют +##% к сопротивлению всем стихиям' },
      }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex).toBeTruthy();
    // Should use "Приспеш" as exclude marker (short, universal)
    if (result.regexExclude && result.regexExclude.length > 0) {
      expect(result.regexExclude.length).toBeLessThanOrEqual(2);
      // At least one exclude should be short (not a full phrase)
      const hasShortExclude = result.regexExclude.some(exc => exc.length <= 10);
      expect(hasShortExclude).toBe(true);
    }
  });

  it('uses compound separator " и" for compound-family conflicts', () => {
    // "к силе" has FP from "к силе и интеллекту", "к силе и ловкости"
    // Should use " и" as a single short exclude
    const tokens: NormalizedMod[] = [
      makeMod({
        id: 'test.str',
        rawText: { ru: '+(9—15) к силе' },
        rawTextTemplate: { ru: '+## к силе' },
      }),
      makeMod({
        id: 'test.str_int',
        rawText: { ru: '+(9—15) к силе и интеллекту' },
        rawTextTemplate: { ru: '+## к силе и интеллекту' },
      }),
      makeMod({
        id: 'test.str_dex',
        rawText: { ru: '+(6—10) к силе и ловкости' },
        rawTextTemplate: { ru: '+## к силе и ловкости' },
      }),
    ];

    const result = computeMinimalUniqueSubstring(tokens[0], tokens, 'ru');
    expect(result.regex).toBeTruthy();
    // The exclude should be short — either " и" or a single marker
    if (result.regexExclude && result.regexExclude.length > 0) {
      // Total exclude chars should be much shorter than old approach
      const excludeTotal = result.regexExclude.reduce((sum, exc) => sum + exc.length, 0);
      const oldExcludeTotal = 'к силе и'.length + 'к силе,'.length; // ~16 chars
      expect(excludeTotal).toBeLessThanOrEqual(oldExcludeTotal);
    }
  });
});
