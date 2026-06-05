import { describe, it, expect } from 'vitest';
import { groupTokensByFamily } from '@shared/family-grouper';
import type { GameToken } from '@shared/types';

/** Helper to create a minimal GameToken for testing */
function makeToken(overrides: Partial<GameToken> & { id: string; affix: GameToken['affix'] }): GameToken {
  return {
    category: 'test',
    origin: 'normal',
    rawText: { ru: overrides.rawText?.ru ?? overrides.id },
    rawTextTemplate: { ru: overrides.rawTextTemplate?.ru ?? overrides.id },
    regex: { ru: overrides.regex?.ru ?? 'test' },
    familyKey: { ru: overrides.familyKey?.ru ?? overrides.id },
    genderForms: { ru: {} },
    tags: [],
    ranges: [],
    values: [],
    hasYofication: false,
    yoficationPositions: [],
    level: 1,
    ...overrides,
  };
}

describe('groupTokensByFamily', () => {
  it('groups tokens with the same familyKey + affix into one FamilyGroup', () => {
    const tokens = [
      makeToken({
        id: 'str1',
        affix: 'suffix',
        rawText: { ru: '+(5—8) к силе' },
        rawTextTemplate: { ru: '+## к силе' },
        familyKey: { ru: '+# к силе' },
        regex: { ru: 'к силе' },
        ranges: [[5, 8]],
      }),
      makeToken({
        id: 'str2',
        affix: 'suffix',
        rawText: { ru: '+(9—12) к силе' },
        rawTextTemplate: { ru: '+## к силе' },
        familyKey: { ru: '+# к силе' },
        regex: { ru: 'к силе' },
        ranges: [[9, 12]],
      }),
      makeToken({
        id: 'str3',
        affix: 'suffix',
        rawText: { ru: '+(13—16) к силе' },
        rawTextTemplate: { ru: '+## к силе' },
        familyKey: { ru: '+# к силе' },
        regex: { ru: 'к силе' },
        ranges: [[13, 16]],
      }),
    ];

    const groups = groupTokensByFamily(tokens);

    expect(groups).toHaveLength(1);
    expect(groups[0].familyKey).toBe('+# к силе');
    expect(groups[0].affix).toBe('suffix');
    expect(groups[0].members).toHaveLength(3);
    expect(groups[0].globalMin).toBe(5);
    expect(groups[0].globalMax).toBe(16);
    expect(groups[0].displayText).toBe('+(5—16) к силе');
    expect(groups[0].hasMultiPlaceholder).toBe(false);
  });

  it('separates groups by affix type even with same familyKey', () => {
    const tokens = [
      makeToken({
        id: 'rarity_prefix',
        affix: 'prefix',
        rawText: { ru: '#% повышение редкости' },
        rawTextTemplate: { ru: '##% повышение редкости' },
        familyKey: { ru: '#% повышение редкости' },
        regex: { ru: 'повышение редкости' },
        ranges: [[10, 20]],
      }),
      makeToken({
        id: 'rarity_suffix',
        affix: 'suffix',
        rawText: { ru: '#% повышение редкости' },
        rawTextTemplate: { ru: '##% повышение редкости' },
        familyKey: { ru: '#% повышение редкости' },
        regex: { ru: 'повышение редкости' },
        ranges: [[5, 15]],
      }),
    ];

    const groups = groupTokensByFamily(tokens);

    expect(groups).toHaveLength(2);
    const prefixGroup = groups.find((g) => g.affix === 'prefix');
    const suffixGroup = groups.find((g) => g.affix === 'suffix');
    expect(prefixGroup).toBeDefined();
    expect(suffixGroup).toBeDefined();
    expect(prefixGroup!.members).toHaveLength(1);
    expect(suffixGroup!.members).toHaveLength(1);
  });

  it('handles tokens with no ranges or values (non-numeric)', () => {
    const tokens = [
      makeToken({
        id: 'mark1',
        affix: 'prefix',
        rawText: { ru: 'Знак повелителя Бездны' },
        rawTextTemplate: { ru: 'Знак повелителя Бездны' },
        familyKey: { ru: 'Знак повелителя Бездны' },
        regex: { ru: 'повелителя Бездны' },
      }),
    ];

    const groups = groupTokensByFamily(tokens);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayText).toBe('Знак повелителя Бездны');
    expect(groups[0].globalMin).toBe(0);
    expect(groups[0].globalMax).toBe(0);
  });

  it('handles single-value tokens (# placeholder with values)', () => {
    const tokens = [
      makeToken({
        id: 'skill1',
        affix: 'prefix',
        rawText: { ru: '+1 к уровню всех камней умений чар' },
        rawTextTemplate: { ru: '+# к уровню всех камней умений чар' },
        familyKey: { ru: '+# к уровню всех камней умений чар' },
        regex: { ru: 'камней умений чар' },
        values: [1],
      }),
      makeToken({
        id: 'skill2',
        affix: 'prefix',
        rawText: { ru: '+2 к уровню всех камней умений чар' },
        rawTextTemplate: { ru: '+# к уровню всех камней умений чар' },
        familyKey: { ru: '+# к уровню всех камней умений чар' },
        regex: { ru: 'камней умений чар' },
        values: [2],
      }),
    ];

    const groups = groupTokensByFamily(tokens);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayText).toBe('+(1—2) к уровню всех камней умений чар');
    expect(groups[0].globalMin).toBe(1);
    expect(groups[0].globalMax).toBe(2);
  });

  it('handles multi-placeholder tokens (## ## with two ranges)', () => {
    const tokens = [
      makeToken({
        id: 'thorns1',
        affix: 'prefix',
        rawText: { ru: 'От (1—2) до (3—4) физического урона шипами' },
        rawTextTemplate: { ru: 'От ## до ## физического урона шипами' },
        familyKey: { ru: 'От # до # физического урона шипами' },
        regex: { ru: 'физического урона шипами' },
        ranges: [[1, 2], [3, 4]],
      }),
      makeToken({
        id: 'thorns2',
        affix: 'prefix',
        rawText: { ru: 'От (5—7) до (7—10) физического урона шипами' },
        rawTextTemplate: { ru: 'От ## до ## физического урона шипами' },
        familyKey: { ru: 'От # до # физического урона шипами' },
        regex: { ru: 'физического урона шипами' },
        ranges: [[5, 7], [7, 10]],
      }),
    ];

    const groups = groupTokensByFamily(tokens);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayText).toBe('От (1—7) до (3—10) физического урона шипами');
    expect(groups[0].hasMultiPlaceholder).toBe(true);
    expect(groups[0].rangeSlots).toEqual([[1, 7], [3, 10]]);
  });

  it('handles mixed template patterns (# and ## in the same family)', () => {
    const tokens = [
      makeToken({
        id: 'lightning1',
        affix: 'prefix',
        rawText: { ru: 'Добавляет от 1 до (4—6) урона от молнии к атакам' },
        rawTextTemplate: { ru: 'Добавляет от # до ## урона от молнии к атакам' },
        familyKey: { ru: 'Добавляет от # до # урона от молнии к атакам' },
        regex: { ru: 'урона от молнии к атакам' },
        ranges: [[4, 6]],
        values: [1],
      }),
      makeToken({
        id: 'lightning2',
        affix: 'prefix',
        rawText: { ru: 'Добавляет от (1—2) до (33—40) урона от молнии к атакам' },
        rawTextTemplate: { ru: 'Добавляет от ## до ## урона от молнии к атакам' },
        familyKey: { ru: 'Добавляет от # до # урона от молнии к атакам' },
        regex: { ru: 'урона от молнии к атакам' },
        ranges: [[1, 2], [33, 40]],
      }),
    ];

    const groups = groupTokensByFamily(tokens);

    expect(groups).toHaveLength(1);
    // Slot 1: min=1 (from both), max=2 (from lightning2)
    // Slot 2: min=4 (from lightning1), max=40 (from lightning2)
    expect(groups[0].displayText).toBe('Добавляет от (1—2) до (4—40) урона от молнии к атакам');
    expect(groups[0].hasMultiPlaceholder).toBe(true);
  });

  it('sorts groups: prefixes before suffixes, then by familyKey', () => {
    const tokens = [
      makeToken({
        id: 'b_suffix',
        affix: 'suffix',
        familyKey: { ru: 'B мод' },
        rawTextTemplate: { ru: 'B мод' },
        rawText: { ru: 'B мод' },
        regex: { ru: 'B' },
      }),
      makeToken({
        id: 'a_prefix',
        affix: 'prefix',
        familyKey: { ru: 'A мод' },
        rawTextTemplate: { ru: 'A мод' },
        rawText: { ru: 'A мод' },
        regex: { ru: 'A' },
      }),
      makeToken({
        id: 'b_prefix',
        affix: 'prefix',
        familyKey: { ru: 'B мод' },
        rawTextTemplate: { ru: 'B мод' },
        rawText: { ru: 'B мод' },
        regex: { ru: 'B' },
      }),
    ];

    const groups = groupTokensByFamily(tokens);

    expect(groups).toHaveLength(3);
    expect(groups[0].affix).toBe('prefix');
    expect(groups[0].familyKey).toBe('A мод');
    expect(groups[1].affix).toBe('prefix');
    expect(groups[1].familyKey).toBe('B мод');
    expect(groups[2].affix).toBe('suffix');
    expect(groups[2].familyKey).toBe('B мод');
  });

  it('returns empty array for empty input', () => {
    const groups = groupTokensByFamily([]);
    expect(groups).toHaveLength(0);
  });

  it('handles single-member groups (no visual change needed)', () => {
    const tokens = [
      makeToken({
        id: 'unique1',
        affix: 'suffix',
        rawText: { ru: '+(5—8) к ловкости' },
        rawTextTemplate: { ru: '+## к ловкости' },
        familyKey: { ru: '+# к ловкости' },
        regex: { ru: 'к ловкости' },
        ranges: [[5, 8]],
      }),
    ];

    const groups = groupTokensByFamily(tokens);

    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(1);
    expect(groups[0].displayText).toBe('+(5—8) к ловкости');
  });

  it('handles corrupted origin tokens in the same family', () => {
    const tokens = [
      makeToken({
        id: 'str_normal',
        affix: 'suffix',
        origin: 'normal',
        rawText: { ru: '+(5—8) к силе' },
        rawTextTemplate: { ru: '+## к силе' },
        familyKey: { ru: '+# к силе' },
        regex: { ru: 'к силе' },
        ranges: [[5, 8]],
      }),
      makeToken({
        id: 'str_corrupted',
        affix: 'suffix',
        origin: 'corrupted',
        rawText: { ru: '+(10—15) к силе' },
        rawTextTemplate: { ru: '+## к силе' },
        familyKey: { ru: '+# к силе' },
        regex: { ru: 'к силе' },
        ranges: [[10, 15]],
      }),
    ];

    // Without origin filter: both are in the same group
    const groups = groupTokensByFamily(tokens);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    expect(groups[0].globalMin).toBe(5);
    expect(groups[0].globalMax).toBe(15);
  });

  it('computes correct rangeSlots for multi-placeholder', () => {
    const tokens = [
      makeToken({
        id: 'phys1',
        affix: 'prefix',
        rawText: { ru: 'Добавляет от (2—3) до (4—6) физического урона к атакам' },
        rawTextTemplate: { ru: 'Добавляет от ## до ## физического урона к атакам' },
        familyKey: { ru: 'Добавляет от # до # физического урона к атакам' },
        regex: { ru: 'физического урона к атакам' },
        ranges: [[2, 3], [4, 6]],
      }),
      makeToken({
        id: 'phys2',
        affix: 'prefix',
        rawText: { ru: 'Добавляет от (5—7) до (9—13) физического урона к атакам' },
        rawTextTemplate: { ru: 'Добавляет от ## до ## физического урона к атакам' },
        familyKey: { ru: 'Добавляет от # до # физического урона к атакам' },
        regex: { ru: 'физического урона к атакам' },
        ranges: [[5, 7], [9, 13]],
      }),
    ];

    const groups = groupTokensByFamily(tokens);

    expect(groups).toHaveLength(1);
    expect(groups[0].rangeSlots).toEqual([[2, 7], [4, 13]]);
    expect(groups[0].displayText).toBe('Добавляет от (2—7) до (4—13) физического урона к атакам');
  });
});
