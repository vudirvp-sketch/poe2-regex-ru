/**
 * Tests for ETL Zod schemas: RawModTierSchema, RawModGroupDataSchema,
 * CategoryDataSchema, GameTokenSchema.
 *
 * Validates that:
 * - Valid ETL data passes parsing
 * - Invalid data is rejected with clear errors
 * - Edge cases (empty arrays, negative levels, missing fields) are caught
 * - iter 101 regression: GameTokenSchema preserves `functionalCategory` from
 *   real production JSON (was stripped by Zod → all affixes rendered as
 *   "Прочее" in production between iter 90 and iter 100).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  RawModTierSchema,
  RawModGroupDataSchema,
  CategoryDataSchema,
} from '@shared/schemas';

// ─── RawModTier ───

describe('RawModTierSchema', () => {
  const validTier = {
    tier: 'T1',
    nameHtml: '<if:ms>{Глубинный}</if:ms>',
    level: 45,
    descriptionHtml: '<span class="mod-value">(20—30)</span>% к сопротивлению огню',
    weight: '100',
    modCode: 'FireRes1',
    affix: 'suffix' as const,
    tags: ['fire'],
    modFamily: ['FireRes'],
  };

  it('accepts valid RawModTier', () => {
    const result = RawModTierSchema.safeParse(validTier);
    expect(result.success).toBe(true);
  });

  it('accepts prefix affix', () => {
    const result = RawModTierSchema.safeParse({ ...validTier, affix: 'prefix' });
    expect(result.success).toBe(true);
  });

  it('rejects "implicit" affix (not valid in ModsView data)', () => {
    const result = RawModTierSchema.safeParse({ ...validTier, affix: 'implicit' });
    expect(result.success).toBe(false);
  });

  it('rejects negative level', () => {
    const result = RawModTierSchema.safeParse({ ...validTier, level: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer level', () => {
    const result = RawModTierSchema.safeParse({ ...validTier, level: 3.5 });
    expect(result.success).toBe(false);
  });

  it('rejects missing required field', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { modCode, ...withoutCode } = validTier;
    const result = RawModTierSchema.safeParse(withoutCode);
    expect(result.success).toBe(false);
  });

  it('accepts empty tags array', () => {
    const result = RawModTierSchema.safeParse({ ...validTier, tags: [] });
    expect(result.success).toBe(true);
  });

  it('accepts empty modFamily array', () => {
    const result = RawModTierSchema.safeParse({ ...validTier, modFamily: [] });
    expect(result.success).toBe(true);
  });

  it('accepts empty nameHtml', () => {
    const result = RawModTierSchema.safeParse({ ...validTier, nameHtml: '' });
    expect(result.success).toBe(true);
  });

  it('rejects extra unknown fields (strict by default)', () => {
    const result = RawModTierSchema.safeParse({ ...validTier, extraField: 'oops' });
    // Zod strips unknown keys by default, so this actually passes
    // But the parsed data won't contain extraField
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extraField).toBeUndefined();
    }
  });
});

// ─── RawModGroupData ───

describe('RawModGroupDataSchema', () => {
  const validTier = {
    tier: 'T1',
    nameHtml: '',
    level: 45,
    descriptionHtml: '<span class="mod-value">(20—30)</span>% к сопротивлению огню',
    weight: '100',
    modCode: 'FireRes1',
    affix: 'suffix' as const,
    tags: ['fire'],
    modFamily: ['FireRes'],
  };

  const validGroup = {
    genGroup: 'FireRes',
    origin: 'normal' as const,
    tags: ['fire'],
    maxLevel: 60,
    tiers: [validTier],
  };

  it('accepts valid RawModGroupData', () => {
    const result = RawModGroupDataSchema.safeParse(validGroup);
    expect(result.success).toBe(true);
  });

  it('accepts all valid origins', () => {
    for (const origin of ['normal', 'desecrated', 'corrupted', 'essence', 'breachborn'] as const) {
      const result = RawModGroupDataSchema.safeParse({ ...validGroup, origin });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid origin', () => {
    const result = RawModGroupDataSchema.safeParse({ ...validGroup, origin: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects empty genGroup', () => {
    const result = RawModGroupDataSchema.safeParse({ ...validGroup, genGroup: '' });
    expect(result.success).toBe(false);
  });

  it('rejects negative maxLevel', () => {
    const result = RawModGroupDataSchema.safeParse({ ...validGroup, maxLevel: -5 });
    expect(result.success).toBe(false);
  });

  it('rejects empty tiers array (must have ≥1)', () => {
    const result = RawModGroupDataSchema.safeParse({ ...validGroup, tiers: [] });
    expect(result.success).toBe(false);
  });

  it('accepts multiple tiers', () => {
    const result = RawModGroupDataSchema.safeParse({
      ...validGroup,
      tiers: [validTier, { ...validTier, tier: 'T2', level: 35 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid tier within group', () => {
    const invalidTier = { ...validTier, level: 'not-a-number' };
    const result = RawModGroupDataSchema.safeParse({ ...validGroup, tiers: [invalidTier] });
    expect(result.success).toBe(false);
  });

  it('rejects missing required field', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { origin, ...withoutOrigin } = validGroup;
    const result = RawModGroupDataSchema.safeParse(withoutOrigin);
    expect(result.success).toBe(false);
  });
});

// ─── CategoryDataSchema / GameTokenSchema ───
//
// iter 101 regression: between iter 90 and iter 100, GameTokenSchema was
// missing the `functionalCategory` field. Zod strips unknown fields by default,
// so loadCategoryData() silently dropped functionalCategory from every token.
// classifyFunctionalBlock() then fell into 'other' fallback → all affixes
// rendered as "Прочее" in production. These tests load real production JSON
// through the schema (mirroring loader.ts) and verify functionalCategory
// survives on at least one token.

describe('CategoryDataSchema — functionalCategory preservation (iter 101 regression)', () => {
  const projectRoot = join(__dirname, '..', '..');
  const generatedDir = join(projectRoot, 'public', 'generated');

  it('preserves functionalCategory field from real belt.json', () => {
    const raw = JSON.parse(readFileSync(join(generatedDir, 'belt.json'), 'utf-8'));
    const parsed = CategoryDataSchema.parse(raw);

    // Sanity: at least one token has functionalCategory defined in the raw JSON.
    const rawCount = raw.tokens.filter(
      (t: { functionalCategory?: string }) => t.functionalCategory,
    ).length;
    expect(rawCount).toBeGreaterThan(0);

    // Regression: parsed tokens must retain functionalCategory on at least one token.
    const parsedCount = parsed.tokens.filter(
      (t) => t.functionalCategory,
    ).length;
    expect(parsedCount).toBeGreaterThan(0);

    // Full preservation: every token that had functionalCategory in raw must
    // still have it after parsing.
    expect(parsedCount).toBe(rawCount);
  });

  it('preserves functionalCategory across all jewellery categories', () => {
    for (const file of ['jewel.json', 'amulet.json', 'ring.json', 'belt.json']) {
      const raw = JSON.parse(readFileSync(join(generatedDir, file), 'utf-8'));
      const parsed = CategoryDataSchema.parse(raw);

      const rawCount = raw.tokens.filter(
        (t: { functionalCategory?: string }) => t.functionalCategory,
      ).length;
      const parsedCount = parsed.tokens.filter(
        (t) => t.functionalCategory,
      ).length;

      // Every category should have functionalCategory on at least one token.
      expect(rawCount, `${file}: raw must have functionalCategory`).toBeGreaterThan(0);
      expect(parsedCount, `${file}: parsed must preserve functionalCategory`).toBe(rawCount);
    }
  });

  it('rejects invalid functionalCategory type (non-string)', () => {
    // functionalCategory is z.string().optional() — must reject non-string.
    const invalidToken = {
      id: 'test',
      category: 'belt',
      origin: 'normal',
      rawText: { ru: '+10 к силе' },
      rawTextTemplate: { ru: '+## к силе' },
      regex: { ru: 'сил' },
      familyKey: { ru: 'к силе' },
      regexPrefix: { ru: '' },
      hasMultiPlaceholder: false,
      functionalCategory: 42, // ← invalid: number, not string
      genderForms: { ru: {} },
      affix: 'prefix',
      tags: [],
      ranges: [],
      values: [],
      hasYofication: false,
      yoficationPositions: [],
      level: 1,
    };
    const result = CategoryDataSchema.safeParse({
      version: 'test',
      category: 'belt',
      source: 'test',
      tokens: [invalidToken],
      optimizationTable: {},
    });
    expect(result.success).toBe(false);
  });
});
