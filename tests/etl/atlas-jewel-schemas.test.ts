/**
 * Tests for Atlas Timeless Jewel Zod schemas (iter 176).
 *
 * Validates that:
 *   - Valid data parses successfully (smoke test).
 *   - Missing required fields are rejected (description, iconUrl, slug, sourceKey).
 *   - Wrong literal `category` value is rejected.
 *   - Unknown jewel id is rejected (only 'undying-hate' | 'heroic-tragedy').
 *   - Empty jewels array is rejected (must have at least 1).
 *   - Empty nodes array inside a jewel is rejected.
 *   - Non-URL iconUrl is rejected.
 *
 * Loaded JSON shape is verified end-to-end against the real
 * `public/generated/timeless-jewel.json` file produced by the parser script.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AtlasNodeTokenSchema,
  AtlasJewelCategoryDataSchema,
  AtlasJewelIdSchema,
} from '@shared/schemas';

// ─── AtlasJewelIdSchema ───────────────────────────────────────────────

describe('AtlasJewelIdSchema', () => {
  it('accepts the two known jewel ids', () => {
    expect(AtlasJewelIdSchema.safeParse('undying-hate').success).toBe(true);
    expect(AtlasJewelIdSchema.safeParse('heroic-tragedy').success).toBe(true);
  });

  it('rejects unknown ids', () => {
    expect(AtlasJewelIdSchema.safeParse('some-future-jewel').success).toBe(false);
    expect(AtlasJewelIdSchema.safeParse('').success).toBe(false);
  });
});

// ─── AtlasNodeTokenSchema ─────────────────────────────────────────────

describe('AtlasNodeTokenSchema', () => {
  const validNode = {
    id: 'undying-hate.abyss_notable_1',
    jewel: 'undying-hate',
    name: { ru: 'Служитель Тьмы' },
    description: { ru: '20% увеличение количества даров' },
    iconUrl: 'https://cdn.poe2db.tw/image/Art/2DArt/SkillIcons/passives/test.webp',
    slug: 'Disciple_of_Darkness',
    sourceKey: 'abyss_notable_1',
  };

  it('accepts a valid node', () => {
    const r = AtlasNodeTokenSchema.safeParse(validNode);
    expect(r.success).toBe(true);
  });

  it('rejects when description is missing', () => {
    const { description: _omit, ...noDesc } = validNode;
    void _omit;
    expect(AtlasNodeTokenSchema.safeParse(noDesc).success).toBe(false);
  });

  it('rejects when iconUrl is not a URL', () => {
    expect(
      AtlasNodeTokenSchema.safeParse({ ...validNode, iconUrl: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('rejects when slug is empty', () => {
    expect(
      AtlasNodeTokenSchema.safeParse({ ...validNode, slug: '' }).success,
    ).toBe(false);
  });

  it('rejects when sourceKey is empty', () => {
    expect(
      AtlasNodeTokenSchema.safeParse({ ...validNode, sourceKey: '' }).success,
    ).toBe(false);
  });

  it('rejects when jewel is unknown', () => {
    expect(
      AtlasNodeTokenSchema.safeParse({ ...validNode, jewel: 'some-future-jewel' }).success,
    ).toBe(false);
  });
});

// ─── AtlasJewelCategoryDataSchema ─────────────────────────────────────

describe('AtlasJewelCategoryDataSchema', () => {
  const validData = {
    version: '2026-07-07T00:00:00.000Z',
    category: 'timeless-jewel',
    source: 'poe2db.tw',
    jewels: [
      {
        id: 'undying-hate',
        name: { ru: 'Вечная ненависть' },
        nodes: [
          {
            id: 'undying-hate.abyss_notable_1',
            jewel: 'undying-hate',
            name: { ru: 'Служитель Тьмы' },
            description: { ru: '20% увеличение количества даров' },
            iconUrl: 'https://cdn.poe2db.tw/image/Art/2DArt/SkillIcons/passives/test.webp',
            slug: 'Disciple_of_Darkness',
            sourceKey: 'abyss_notable_1',
          },
        ],
      },
    ],
  };

  it('accepts valid data', () => {
    expect(AtlasJewelCategoryDataSchema.safeParse(validData).success).toBe(true);
  });

  it('rejects wrong category literal', () => {
    expect(
      AtlasJewelCategoryDataSchema.safeParse({ ...validData, category: 'jewel' }).success,
    ).toBe(false);
  });

  it('rejects empty jewels array', () => {
    expect(
      AtlasJewelCategoryDataSchema.safeParse({ ...validData, jewels: [] }).success,
    ).toBe(false);
  });

  it('rejects empty nodes array inside a jewel', () => {
    const emptyNodes = {
      ...validData,
      jewels: [{ ...validData.jewels[0], nodes: [] }],
    };
    expect(AtlasJewelCategoryDataSchema.safeParse(emptyNodes).success).toBe(false);
  });
});

// ─── End-to-end: real generated JSON validates ──────────────────────

describe('real public/generated/timeless-jewel.json', () => {
  it('parses successfully against the schema', () => {
    const path = join(process.cwd(), 'public/generated/timeless-jewel.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const r = AtlasJewelCategoryDataSchema.safeParse(raw);
    if (!r.success) {
      console.error(r.error.issues);
    }
    expect(r.success).toBe(true);
  });

  it('contains both jewels with the expected node counts', () => {
    const path = join(process.cwd(), 'public/generated/timeless-jewel.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const data = AtlasJewelCategoryDataSchema.parse(raw);

    const byId = Object.fromEntries(data.jewels.map((j) => [j.id, j.nodes.length]));
    expect(byId['undying-hate']).toBe(35);
    expect(byId['heroic-tragedy']).toBe(40);
  });

  it('has no empty descriptions in any node', () => {
    const path = join(process.cwd(), 'public/generated/timeless-jewel.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const data = AtlasJewelCategoryDataSchema.parse(raw);

    for (const jewel of data.jewels) {
      for (const node of jewel.nodes) {
        expect(node.description.ru.length).toBeGreaterThan(0);
      }
    }
  });
});
