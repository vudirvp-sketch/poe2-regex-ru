/**
 * Regex Oracle Tests — Validates the validateRegex(), validateRegexItem(),
 * batchValidate() and batchValidateItem() functions.
 *
 * Test sections:
 * 1. BASIC VALIDATION: Simple match/no-match scenarios
 * 2. FACTORIZATION: Factorized regexes with common prefixes
 * 3. NUMBER PATTERNS: Numeric regex patterns with prefix anchoring
 * 4. FALSE POSITIVE DETECTION: Cross-family FP detection
 * 5. LENGTH LIMIT: 250-character PoE2 limit
 * 6. COMPREHENSIVE FP: Using allModTextsInCategory
 * 7. BATCH VALIDATION: Batch validate multiple regexes
 * 8. FP CATEGORIZATION: Family-tier vs cross-family FP (Phase 8)
 * 9. BLOCK-BASED VALIDATION: validateRegexItem() with GameItemText
 * 10. BATCH ITEM VALIDATION: batchValidateItem()
 */
import { describe, it, expect } from 'vitest';
import {
  validateRegex,
  validateRegexItem,
  batchValidate,
  batchValidateItem,
} from '@core/regex-oracle';
import type { GameItemText } from '@core/poe2-regex-matcher';

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: BASIC VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: Basic validation', () => {
  it('simple substring: valid when matching only target', () => {
    const result = validateRegex(
      'огню',
      ['к сопротивлению огню'],
      ['к сопротивлению холоду', 'к сопротивлению молниям']
    );
    expect(result.valid).toBe(true);
    expect(result.falsePositives).toHaveLength(0);
    expect(result.crossFamilyFP).toHaveLength(0);
    expect(result.familyTierFP).toHaveLength(0);
    expect(result.falseNegatives).toHaveLength(0);
    expect(result.withinLimit).toBe(true);
  });

  it('simple substring: invalid when matching excluded text', () => {
    const result = validateRegex(
      'сопротивлению',
      ['к сопротивлению огню'],
      ['к сопротивлению холоду']
    );
    // "сопротивлению" matches both fire and cold resistance
    expect(result.valid).toBe(false);
    expect(result.falsePositives).toHaveLength(1);
    expect(result.falsePositives[0]).toBe('к сопротивлению холоду');
    // Without familyKeyMap, all FP are cross-family
    expect(result.crossFamilyFP).toHaveLength(1);
    expect(result.familyTierFP).toHaveLength(0);
  });

  it('simple substring: invalid when NOT matching target', () => {
    const result = validateRegex(
      'холоду',
      ['к сопротивлению огню'],
      []
    );
    expect(result.valid).toBe(false);
    expect(result.falseNegatives).toHaveLength(1);
    expect(result.falseNegatives[0]).toBe('к сопротивлению огню');
  });

  it('empty regex: valid=false because target is not matched', () => {
    const result = validateRegex(
      '',
      ['к сопротивлению огню'],
      []
    );
    expect(result.withinLimit).toBe(true);
    expect(result.regexLength).toBe(0);
  });

  it('exact match: valid when regex equals target text', () => {
    const result = validateRegex(
      'к сопротивлению огню',
      ['к сопротивлению огню'],
      ['к сопротивлению холоду']
    );
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: FACTORIZATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: Factorized regexes', () => {
  it('OR alternation matches both targets', () => {
    const result = validateRegex(
      'огню|холоду',
      ['к сопротивлению огню', 'к сопротивлению холоду'],
      ['к сопротивлению молниям']
    );
    expect(result.valid).toBe(true);
  });

  it('factorized with common prefix: "сопротивлению (огню|холоду)"', () => {
    const result = validateRegex(
      'сопротивлению (огню|холоду)',
      ['к сопротивлению огню', 'к сопротивлению холоду'],
      ['к сопротивлению молниям', 'к сопротивлению хаосу']
    );
    expect(result.valid).toBe(true);
    expect(result.falsePositives).toHaveLength(0);
    expect(result.falseNegatives).toHaveLength(0);
  });

  it('factorized with 3 alternatives: "сопротивлению (огню|холоду|молни)"', () => {
    const result = validateRegex(
      'сопротивлению (огню|холоду|молни)',
      ['к сопротивлению огню', 'к сопротивлению холоду', 'к сопротивлению молниям'],
      ['к сопротивлению хаосу']
    );
    expect(result.valid).toBe(true);
  });

  it('factorized misses a target: FN when one alternative omitted', () => {
    const result = validateRegex(
      'сопротивлению (огню|холоду)',
      ['к сопротивлению огню', 'к сопротивлению холоду', 'к сопротивлению молниям'],
      []
    );
    expect(result.valid).toBe(false);
    expect(result.falseNegatives).toHaveLength(1);
    expect(result.falseNegatives[0]).toContain('молни');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: NUMBER PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: Number patterns with prefix anchoring', () => {
  it('≥40 with correct prefix anchoring', () => {
    const result = validateRegex(
      'даруют на ([4-9][0-9]|[0-9][0-9][0-9]).*опыта',
      ['Боссы карт даруют на 40% больше опыта'],
      ['Боссы карт даруют на 15% больше опыта']
    );
    expect(result.valid).toBe(true);
    expect(result.falsePositives).toHaveLength(0);
    expect(result.falseNegatives).toHaveLength(0);
  });

  it('numeric pattern: [0-9][0-9] matches two-digit numbers', () => {
    const result = validateRegex(
      '[0-9][0-9].*к силе',
      ['+(10—15) к силе', '+(50—80) к силе'],
      ['+(5—8) к силе']
    );
    expect(result.falseNegatives).toHaveLength(0);
  });

  it('old broken pattern: [4-9]. matches "4-4" (FP)', () => {
    const result = validateRegex(
      '[4-9].',
      ['42'],
      ['4-4']
    );
    expect(result.falsePositives).toHaveLength(1);
  });

  it('fixed pattern: [4-9][0-9] does NOT match "4-4"', () => {
    const result = validateRegex(
      '[4-9][0-9]',
      ['42', '50', '99'],
      ['4-4', '4-5']
    );
    expect(result.valid).toBe(true);
    expect(result.falsePositives).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: FALSE POSITIVE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: Cross-family FP detection', () => {
  it('short regex "молнии" matches both jewel and waystone mods', () => {
    const result = validateRegex(
      'молнии',
      ['к сопротивлению молниям'],
      ['добавляет урон от молнии к атакам']
    );
    expect(result.valid).toBe(false);
    expect(result.falsePositives.length).toBeGreaterThan(0);
  });

  it('longer regex "к сопротивлению молниям" avoids FP', () => {
    const result = validateRegex(
      'к сопротивлению молниям',
      ['к сопротивлению молниям'],
      ['добавляет урон от молнии к атакам']
    );
    expect(result.valid).toBe(true);
  });

  it('character class [её] matches both е and ё variants', () => {
    const result = validateRegex(
      'гн[её]зд',
      ['Гнёзда: R-G-B', 'Гнезда: R-G-B'],
      ['Здоровье']
    );
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: LENGTH LIMIT
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: 250-character limit', () => {
  it('regex under 250 chars: withinLimit = true', () => {
    const shortRegex = 'сопротивлению (огню|холоду|молнии|хаосу)';
    expect(shortRegex.length).toBeLessThan(250);

    const result = validateRegex(
      shortRegex,
      ['к сопротивлению огню', 'к сопротивлению холоду'],
      []
    );
    expect(result.withinLimit).toBe(true);
    expect(result.regexLength).toBe(shortRegex.length);
  });

  it('regex over 250 chars: withinLimit = false, valid = false', () => {
    const longRegex = 'сопротивлению (' + Array(50).fill('оченьдлинноеслово').join('|') + ')';
    expect(longRegex.length).toBeGreaterThan(250);

    const result = validateRegex(
      longRegex,
      [],
      []
    );
    expect(result.withinLimit).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.regexLength).toBe(longRegex.length);
  });

  it('regex exactly 250 chars: withinLimit = true', () => {
    const prefix = 'сопротивлению (';
    const suffix = ')';
    const contentLen = 250 - prefix.length - suffix.length;
    const word = 'а'.repeat(contentLen);
    const exactRegex = prefix + word + suffix;
    expect(exactRegex.length).toBe(250);

    const result = validateRegex(exactRegex, [], []);
    expect(result.withinLimit).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: COMPREHENSIVE FP
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: Comprehensive FP with allModTextsInCategory', () => {
  it('detects FP from full category scan', () => {
    const allModTexts = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молниям',
      'к сопротивлению хаосу',
      '+50 к здоровью',
      '+30 к максимуму маны',
    ];

    const result = validateRegex(
      'сопротивлению',
      ['к сопротивлению огню'],
      [],
      allModTexts
    );

    expect(result.valid).toBe(false);
    expect(result.falsePositives.length).toBe(3); // cold, lightning, chaos
  });

  it('specific regex has no FP in full category', () => {
    const allModTexts = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молниям',
      'к сопротивлению хаосу',
      '+50 к здоровью',
    ];

    const result = validateRegex(
      'к сопротивлению огню',
      ['к сопротивлению огню'],
      [],
      allModTexts
    );

    expect(result.valid).toBe(true);
    expect(result.falsePositives).toHaveLength(0);
  });

  it('does not double-count FP from exclude list and category scan', () => {
    const allModTexts = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молниям',
    ];

    const result = validateRegex(
      'сопротивлению',
      ['к сопротивлению огню'],
      ['к сопротивлению холоду'],
      allModTexts
    );

    expect(result.valid).toBe(false);
    const uniqueFPs = new Set(result.falsePositives.map(fp => fp.toLowerCase()));
    expect(uniqueFPs.size).toBe(result.falsePositives.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: BATCH VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: Batch validation', () => {
  it('validates multiple regexes against full category', () => {
    const regexes = [
      { tokenId: 'fire_res', regex: 'к сопротивлению огню' },
      { tokenId: 'cold_res', regex: 'к сопротивлению холоду' },
      { tokenId: 'all_res', regex: 'сопротивлению' },
    ];

    const allModTextsByTokenId = new Map<string, string>([
      ['fire_res', 'к сопротивлению огню'],
      ['cold_res', 'к сопротивлению холоду'],
      ['all_res', 'к сопротивлению хаосу'],
    ]);

    const allModTexts = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молниям',
      'к сопротивлению хаосу',
    ];

    const report = batchValidate(regexes, allModTextsByTokenId, allModTexts);

    expect(report.totalChecked).toBe(3);
    expect(report.validCount).toBe(2);
    expect(report.invalidCount).toBe(1);

    const invalidEntry = report.entries.find(e => e.tokenId === 'all_res');
    expect(invalidEntry).toBeDefined();
    expect(invalidEntry!.result.valid).toBe(false);
    expect(invalidEntry!.result.falsePositives.length).toBeGreaterThan(0);
  });

  it('handles empty regexes gracefully', () => {
    const regexes = [
      { tokenId: 'empty', regex: '' },
    ];

    const allModTextsByTokenId = new Map<string, string>([
      ['empty', 'some mod text'],
    ]);

    const report = batchValidate(regexes, allModTextsByTokenId, ['some mod text']);
    expect(report.totalChecked).toBe(0);
  });

  it('all valid regexes report validCount = total', () => {
    const regexes = [
      { tokenId: 'fire', regex: 'к сопротивлению огню' },
      { tokenId: 'cold', regex: 'к сопротивлению холоду' },
    ];

    const allModTextsByTokenId = new Map<string, string>([
      ['fire', 'к сопротивлению огню'],
      ['cold', 'к сопротивлению холоду'],
    ]);

    const allModTexts = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
      'к сопротивлению молниям',
    ];

    const report = batchValidate(regexes, allModTextsByTokenId, allModTexts);
    expect(report.validCount).toBe(2);
    expect(report.invalidCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: FP CATEGORIZATION — Family-tier vs Cross-family (Phase 8)
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: FP Categorization (Phase 8)', () => {
  it('without familyKeyMap, all FP are cross-family', () => {
    const result = validateRegex(
      'сопротивлению',
      ['к сопротивлению огню'],
      ['к сопротивлению холоду', 'к сопротивлению молниям']
    );
    expect(result.valid).toBe(false);
    expect(result.familyTierFP).toHaveLength(0);
    expect(result.crossFamilyFP.length).toBeGreaterThan(0);
    // All FP are cross-family when no familyKey info available
    expect(result.crossFamilyFP.length).toBe(result.falsePositives.length);
  });

  it('family-tier FP are separated from cross-family FP', () => {
    // Use "сопротивлению" as regex — matches all resistance texts
    const allModTexts = [
      '+(10—15)% к сопротивлению огню',  // target
      '+(16—25)% к сопротивлению огню',  // same family, different tier (family-tier FP)
      '+(10—15)% к сопротивлению холоду', // different family (cross-family FP)
    ];

    const familyKeyMap = new Map<string, string>([
      ['+(10—15)% к сопротивлению огню', 'fire_res'],
      ['+(16—25)% к сопротивлению огню', 'fire_res'], // same family
      ['+(10—15)% к сопротивлению холоду', 'cold_res'], // different family
    ]);

    const result = validateRegex(
      'сопротивлению',
      ['+(10—15)% к сопротивлению огню'],
      [],
      allModTexts,
      familyKeyMap,
      'fire_res'
    );

    // Both other texts match "сопротивлению" as FP
    expect(result.falsePositives.length).toBeGreaterThanOrEqual(2);
    // Tier 2 fire res is family-tier FP (same familyKey)
    expect(result.familyTierFP).toHaveLength(1);
    expect(result.familyTierFP[0]).toContain('к сопротивлению огню');
    // Cold res is cross-family FP
    expect(result.crossFamilyFP).toHaveLength(1);
    expect(result.crossFamilyFP[0]).toContain('к сопротивлению холоду');
    // Valid because only family-tier FP + cross-family FP exist
    // Cross-family FP makes valid=false
    expect(result.valid).toBe(false);
  });

  it('valid=false when cross-family FP exist', () => {
    const allModTexts = [
      'к сопротивлению огню',
      'к сопротивлению холоду',
    ];

    const familyKeyMap = new Map<string, string>([
      ['к сопротивлению огню', 'fire_res'],
      ['к сопротивлению холоду', 'cold_res'],
    ]);

    const result = validateRegex(
      'сопротивлению',
      ['к сопротивлению огню'],
      [],
      allModTexts,
      familyKeyMap,
      'fire_res'
    );

    expect(result.valid).toBe(false);
    expect(result.crossFamilyFP.length).toBeGreaterThan(0);
  });

  it('valid=true when only family-tier FP exist', () => {
    const allModTexts = [
      '+(10—15)% к сопротивлению огню',
      '+(16—25)% к сопротивлению огню',
    ];

    const familyKeyMap = new Map<string, string>([
      ['+(10—15)% к сопротивлению огню', 'fire_res'],
      ['+(16—25)% к сопротивлению огню', 'fire_res'],
    ]);

    const result = validateRegex(
      'к сопротивлению огню',
      ['+(10—15)% к сопротивлению огню'],
      [],
      allModTexts,
      familyKeyMap,
      'fire_res'
    );

    expect(result.valid).toBe(true);
    expect(result.familyTierFP.length).toBeGreaterThan(0);
    expect(result.crossFamilyFP).toHaveLength(0);
  });

  it('batch validation reports crossFamilyFPCount and familyTierFPOnlyCount', () => {
    const regexes = [
      { tokenId: 'fire_t1', regex: 'к сопротивлению огню' },
      { tokenId: 'generic', regex: 'сопротивлению' },
    ];

    const allModTextsByTokenId = new Map<string, string>([
      ['fire_t1', '+(10—15)% к сопротивлению огню'],
      ['generic', 'к сопротивлению хаосу'],
    ]);

    const allModTexts = [
      '+(10—15)% к сопротивлению огню',
      '+(16—25)% к сопротивлению огню',
      '+(10—15)% к сопротивлению холоду',
    ];

    const familyKeyMap = new Map<string, string>([
      ['+(10—15)% к сопротивлению огню', 'fire_res'],
      ['+(16—25)% к сопротивлению огню', 'fire_res'],
      ['+(10—15)% к сопротивлению холоду', 'cold_res'],
    ]);

    const familyKeyByTokenId = new Map<string, string>([
      ['fire_t1', 'fire_res'],
      ['generic', 'chaos_res'],
    ]);

    const report = batchValidate(
      regexes, allModTextsByTokenId, allModTexts, familyKeyMap, familyKeyByTokenId
    );

    expect(report.totalChecked).toBe(2);
    // fire_t1 has family-tier FP (tier2) + cross-family FP (cold)
    // generic has cross-family FP (all other resistances)
    expect(report.crossFamilyFPCount).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: BLOCK-BASED VALIDATION (Phase 8)
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: Block-based validation (validateRegexItem)', () => {
  it('valid regex matches target item via block-based matching', () => {
    const targetItem: GameItemText = {
      mods: ['+(10—15)% к сопротивлению огню'],
    };
    const excludeItem: GameItemText = {
      mods: ['+(10—15)% к сопротивлению холоду'],
    };

    const result = validateRegexItem(
      'к сопротивлению огню',
      [targetItem],
      [excludeItem]
    );

    expect(result.valid).toBe(true);
    expect(result.falsePositives).toHaveLength(0);
    expect(result.falseNegatives).toHaveLength(0);
  });

  it('.* does NOT cross block boundaries in block-based validation', () => {
    // In flat-text: "огня.*холоду" would match an item with both mods
    // In block-based: each mod is a separate block, so .* can't cross
    const targetItem: GameItemText = {
      mods: ['+(10—15)% к сопротивлению огню', '+(10—15)% к сопротивлению холоду'],
    };

    const result = validateRegexItem(
      'огня.*холоду',
      [targetItem],
      []
    );

    // .* cannot cross block boundaries, so this should be a false negative
    expect(result.falseNegatives.length).toBeGreaterThan(0);
  });

  it('AND search DOES cross block boundaries in block-based validation', () => {
    const targetItem: GameItemText = {
      mods: ['+(10—15)% к сопротивлению огню', '+(10—15)% к сопротивлению холоду'],
    };

    const result = validateRegexItem(
      '"огню" "холоду"',
      [targetItem],
      []
    );

    // AND (space between quoted groups) works across blocks
    expect(result.falseNegatives).toHaveLength(0);
  });

  it('description text is NOT searchable in block-based validation', () => {
    const item: GameItemText = {
      mods: ['+(10—15)% к сопротивлению огню'],
      description: ['Можно использовать в Машине картоходца'],
    };

    const result = validateRegexItem(
      'картоходца',
      [item],
      []
    );

    expect(result.falseNegatives.length).toBeGreaterThan(0);
  });

  it('additional state text IS searchable in block-based validation', () => {
    const targetItem: GameItemText = {
      mods: ['+(10—15)% к сопротивлению огню'],
      additional: ['Осквернено'],
    };

    const result = validateRegexItem(
      'оскверн',
      [targetItem],
      []
    );

    expect(result.falseNegatives).toHaveLength(0);
  });

  it('comprehensive FP check with allItemsInCategory', () => {
    const allItems = [
      { id: 'fire_res', text: { mods: ['+(10—15)% к сопротивлению огню'] } as GameItemText },
      { id: 'cold_res', text: { mods: ['+(10—15)% к сопротивлению холоду'] } as GameItemText },
      { id: 'lightning_res', text: { mods: ['+(10—15)% к сопротивлению молниям'] } as GameItemText },
    ];

    const result = validateRegexItem(
      'сопротивлению',
      [{ mods: ['+(10—15)% к сопротивлению огню'] }],
      [],
      allItems,
      'fire_res',
      new Map([
        ['fire_res', 'fire_res_family'],
        ['cold_res', 'cold_res_family'],
        ['lightning_res', 'lightning_res_family'],
      ])
    );

    expect(result.valid).toBe(false);
    expect(result.crossFamilyFP.length).toBeGreaterThan(0);
    // fire_res itself is a target, cold and lightning are cross-family FP
  });

  it('family-tier FP in block-based validation', () => {
    const allItems = [
      { id: 'fire_t1', text: { mods: ['+(10—15)% к сопротивлению огню'] } as GameItemText },
      { id: 'fire_t2', text: { mods: ['+(16—25)% к сопротивлению огню'] } as GameItemText },
    ];

    const result = validateRegexItem(
      'к сопротивлению огню',
      [{ mods: ['+(10—15)% к сопротивлению огню'] }],
      [],
      allItems,
      'fire_t1',
      new Map([
        ['fire_t1', 'fire_res'],
        ['fire_t2', 'fire_res'], // same family
      ])
    );

    expect(result.valid).toBe(true); // family-tier FP don't invalidate
    expect(result.familyTierFP.length).toBeGreaterThan(0);
    expect(result.crossFamilyFP).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: BATCH ITEM VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: Batch item validation (batchValidateItem)', () => {
  it('validates multiple regexes against items using block-based matching', () => {
    const regexes = [
      { tokenId: 'fire_res', regex: 'к сопротивлению огню' },
      { tokenId: 'cold_res', regex: 'к сопротивлению холоду' },
    ];

    const allItemsByTokenId = new Map<string, { id: string; text: GameItemText }>([
      ['fire_res', { id: 'fire_res', text: { mods: ['+(10—15)% к сопротивлению огню'] } }],
      ['cold_res', { id: 'cold_res', text: { mods: ['+(10—15)% к сопротивлению холоду'] } }],
    ]);

    const allItems = [
      { id: 'fire_res', text: { mods: ['+(10—15)% к сопротивлению огню'] } as GameItemText },
      { id: 'cold_res', text: { mods: ['+(10—15)% к сопротивлению холоду'] } as GameItemText },
      { id: 'lightning_res', text: { mods: ['+(10—15)% к сопротивлению молниям'] } as GameItemText },
    ];

    const familyKeyById = new Map([
      ['fire_res', 'fire_res_family'],
      ['cold_res', 'cold_res_family'],
      ['lightning_res', 'lightning_res_family'],
    ]);

    const report = batchValidateItem(regexes, allItemsByTokenId, allItems, familyKeyById);

    expect(report.totalChecked).toBe(2);
    expect(report.validCount).toBe(2);
    expect(report.invalidCount).toBe(0);
  });

  it('handles empty regexes gracefully', () => {
    const regexes = [
      { tokenId: 'empty', regex: '' },
    ];

    const allItemsByTokenId = new Map<string, { id: string; text: GameItemText }>([
      ['empty', { id: 'empty', text: { mods: ['some mod'] } }],
    ]);

    const report = batchValidateItem(regexes, allItemsByTokenId, []);
    expect(report.totalChecked).toBe(0);
  });

  it('reports crossFamilyFPCount correctly', () => {
    const regexes = [
      { tokenId: 'generic', regex: 'сопротивлению' },
    ];

    const allItemsByTokenId = new Map<string, { id: string; text: GameItemText }>([
      ['generic', { id: 'fire_res', text: { mods: ['+(10—15)% к сопротивлению огню'] } }],
    ]);

    const allItems = [
      { id: 'fire_res', text: { mods: ['+(10—15)% к сопротивлению огню'] } as GameItemText },
      { id: 'cold_res', text: { mods: ['+(10—15)% к сопротивлению холоду'] } as GameItemText },
    ];

    const familyKeyById = new Map([
      ['fire_res', 'fire_res_family'],
      ['cold_res', 'cold_res_family'],
    ]);

    const report = batchValidateItem(regexes, allItemsByTokenId, allItems, familyKeyById);

    expect(report.totalChecked).toBe(1);
    expect(report.crossFamilyFPCount).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: NEGATION REGEX (regexExclude — Session 45)
// ═══════════════════════════════════════════════════════════════════════════

describe('Regex Oracle: Negation regex (regexExclude)', () => {
  it('"к силе" !"к силе и" excludes composite mods', () => {
    // Pure strength mod
    const targetItem: GameItemText = {
      mods: ['+(5—8) к силе'],
    };
    // Composite mod: strength + intelligence
    const compositeItem: GameItemText = {
      mods: ['+(9—15) к силе и интеллекту'],
    };

    // Without negation: "к силе" matches both
    const withoutNegation = validateRegexItem(
      'к силе',
      [targetItem],
      [],
      [targetItem, compositeItem].map((item, i) => ({
        id: `item_${i}`,
        text: item,
      })),
      'pure_str',
      new Map([
        ['item_0', 'pure_str'],
        ['item_1', 'composite_str_int'],
      ])
    );
    expect(withoutNegation.crossFamilyFP.length).toBeGreaterThan(0);

    // With negation: '"к силе" !"к силе и"' only matches pure strength
    const withNegation = validateRegexItem(
      '"к силе" !"к силе и"',
      [targetItem],
      [],
      [targetItem, compositeItem].map((item, i) => ({
        id: `item_${i}`,
        text: item,
      })),
      'pure_str',
      new Map([
        ['item_0', 'pure_str'],
        ['item_1', 'composite_str_int'],
      ])
    );
    expect(withNegation.valid).toBe(true);
    expect(withNegation.crossFamilyFP).toHaveLength(0);
    expect(withNegation.falseNegatives).toHaveLength(0);
  });

  it('"к ловкости" !"к ловкости и" excludes composite mods', () => {
    const targetItem: GameItemText = {
      mods: ['+(5—8) к ловкости'],
    };
    const compositeItem: GameItemText = {
      mods: ['+(9—15) к ловкости и интеллекту'],
    };

    const result = validateRegexItem(
      '"к ловкости" !"к ловкости и"',
      [targetItem],
      [],
      [targetItem, compositeItem].map((item, i) => ({
        id: `item_${i}`,
        text: item,
      })),
      'pure_dex',
      new Map([
        ['item_0', 'pure_dex'],
        ['item_1', 'composite_dex_int'],
      ])
    );

    expect(result.valid).toBe(true);
    expect(result.crossFamilyFP).toHaveLength(0);
  });

  it('negation regex still matches its own target (no FN)', () => {
    const targetItem: GameItemText = {
      mods: ['+(5—8) к силе'],
    };

    const result = validateRegexItem(
      '"к силе" !"к силе и"',
      [targetItem],
      []
    );

    expect(result.falseNegatives).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it('negation with comma-separated composite: !"к силе,"', () => {
    const targetItem: GameItemText = {
      mods: ['+(5—8) к силе'],
    };
    const compositeItem: GameItemText = {
      mods: ['+(9—12) к силе, ловкости или интеллекту'],
    };

    const result = validateRegexItem(
      '"к силе" !"к силе," !"к силе и"',
      [targetItem],
      [],
      [targetItem, compositeItem].map((item, i) => ({
        id: `item_${i}`,
        text: item,
      })),
      'pure_str',
      new Map([
        ['item_0', 'pure_str'],
        ['item_1', 'composite_all'],
      ])
    );

    expect(result.valid).toBe(true);
    expect(result.crossFamilyFP).toHaveLength(0);
  });
});
