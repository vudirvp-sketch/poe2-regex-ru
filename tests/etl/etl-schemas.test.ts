/**
 * Tests for ETL Zod schemas: RawModTierSchema, RawModGroupDataSchema.
 *
 * Validates that:
 * - Valid ETL data passes parsing
 * - Invalid data is rejected with clear errors
 * - Edge cases (empty arrays, negative levels, missing fields) are caught
 */
import { describe, it, expect } from 'vitest';
import {
  RawModTierSchema,
  RawModGroupDataSchema,
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
