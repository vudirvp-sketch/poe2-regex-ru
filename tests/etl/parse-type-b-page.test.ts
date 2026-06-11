/**
 * ETL coverage expansion: parseTypeBPage tests.
 *
 * Tests the Type B page parser (ModifiersCalc) with realistic HTML input,
 * verifying correct extraction of mod groups, tiers, origins, and tags.
 */
import { describe, it, expect } from 'vitest';
import { parseTypeBPage, getModCategoryStats } from '@etl/parse-modifiers-calc';

/** Build a minimal ModsView HTML page for testing */
function buildModsViewHtml(data: Record<string, unknown>): string {
  return `
    <html><body>
    <script>
    new ModsView(${JSON.stringify(data)});
    </script>
    </body></html>
  `;
}

const baseMod = {
  Name: 'Тестовый мод',
  Level: '45',
  ModGenerationTypeID: '2',
  ModFamilyList: ['TestFamily'],
  DropChance: 100,
  str: '<span class="mod-value">(20—30)</span>% к сопротивлению огню',
  fossil_no: [],
  adds_no: [],
  spawn_no: [],
  mod_no: [],
  mod_fossil_item: [],
  hover: '?s=Data%5CMods%2FTestMod1',
};

const baseModWithTags = {
  ...baseMod,
  mod_no: ['<span class="badge bg-primary craftingfire" data-tag="fire">Огонь</span>'],
};

describe('parseTypeBPage', () => {
  it('extracts normal mods from ModsView JSON', () => {
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [baseMod],
    });

    const result = parseTypeBPage(html);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].origin).toBe('normal');
    expect(result[0].tiers.length).toBe(1);
    expect(result[0].tiers[0].affix).toBe('suffix'); // ModGenerationTypeID "2" = suffix
  });

  it('extracts prefix affix from ModGenerationTypeID "1"', () => {
    const prefixMod = { ...baseMod, ModGenerationTypeID: '1' };
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [prefixMod],
    });

    const result = parseTypeBPage(html);
    expect(result[0].tiers[0].affix).toBe('prefix');
  });

  it('extracts corrupted mods with origin="corrupted"', () => {
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      corrupted: [{ ...baseMod, type: 'Corrupted' }],
    });

    const result = parseTypeBPage(html);
    expect(result.some(g => g.origin === 'corrupted')).toBe(true);
  });

  it('extracts desecrated mods with origin="desecrated"', () => {
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      desecrated: [{ ...baseMod, type: 'Desecrated' }],
    });

    const result = parseTypeBPage(html);
    expect(result.some(g => g.origin === 'desecrated')).toBe(true);
  });

  it('extracts essence mods with origin="essence"', () => {
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      essence: [{ ...baseMod, type: 'essence', Code: 'EssenceMod1' }],
    });

    const result = parseTypeBPage(html);
    expect(result.some(g => g.origin === 'essence')).toBe(true);
  });

  it('extracts breach mods with origin="breachborn"', () => {
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      breach_tree: [{ ...baseMod }],
    });

    const result = parseTypeBPage(html);
    expect(result.some(g => g.origin === 'breachborn')).toBe(true);
  });

  it('groups mods by ModFamilyList', () => {
    const mod1 = { ...baseMod, ModFamilyList: ['FireRes'] };
    const mod2 = { ...baseMod, ModFamilyList: ['FireRes'], Level: '60' };
    const mod3 = { ...baseMod, ModFamilyList: ['ColdRes'] };

    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [mod1, mod2, mod3],
    });

    const result = parseTypeBPage(html);
    // Two families: FireRes (2 tiers) and ColdRes (1 tier)
    expect(result.length).toBe(2);
    const fireGroup = result.find(g => g.genGroup === 'FireRes');
    expect(fireGroup).toBeDefined();
    expect(fireGroup!.tiers.length).toBe(2);
  });

  it('computes maxLevel from tiers', () => {
    const mod1 = { ...baseMod, Level: '30' };
    const mod2 = { ...baseMod, Level: '60', ModFamilyList: ['SameFamily'] };
    const mod3 = { ...baseMod, Level: '45', ModFamilyList: ['SameFamily'] };

    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [mod1, mod2, mod3],
    });

    const result = parseTypeBPage(html);
    const group = result.find(g => g.genGroup === 'SameFamily');
    expect(group).toBeDefined();
    expect(group!.maxLevel).toBe(60);
  });

  it('extracts tags from mod_no HTML', () => {
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [baseModWithTags],
    });

    const result = parseTypeBPage(html);
    expect(result[0].tags).toContain('fire');
  });

  it('extracts modCode from Code field for essence mods', () => {
    const essenceMod = { ...baseMod, Code: 'EssenceFire1' };
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      essence: [essenceMod],
    });

    const result = parseTypeBPage(html);
    const essGroup = result.find(g => g.origin === 'essence');
    expect(essGroup).toBeDefined();
    expect(essGroup!.tiers[0].modCode).toBe('EssenceFire1');
  });

  it('returns empty array when no ModsView found', () => {
    const html = '<html><body><p>No script here</p></body></html>';
    const result = parseTypeBPage(html);
    expect(result).toEqual([]);
  });

  it('handles empty mod categories gracefully', () => {
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [],
      corrupted: [],
    });

    const result = parseTypeBPage(html);
    expect(result).toEqual([]);
  });

  it('uses unknown group key when ModFamilyList is empty', () => {
    const noFamilyMod = { ...baseMod, ModFamilyList: [] };
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [noFamilyMod],
    });

    const result = parseTypeBPage(html);
    expect(result.length).toBe(1);
    expect(result[0].genGroup).toMatch(/^unknown_/);
  });

  it('skips mods with empty description', () => {
    const emptyMod = { ...baseMod, str: '' };
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [emptyMod],
    });

    const result = parseTypeBPage(html);
    expect(result).toEqual([]);
  });
});

describe('getModCategoryStats', () => {
  it('returns stats for categories with mods', () => {
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [baseMod, { ...baseMod, Level: '60' }],
      corrupted: [baseMod],
    });

    const stats = getModCategoryStats(html);
    expect(stats.normal).toBe(2);
    expect(stats.corrupted).toBe(1);
  });

  it('returns empty object when no ModsView found', () => {
    const html = '<html><body></body></html>';
    const stats = getModCategoryStats(html);
    expect(stats).toEqual({});
  });

  it('does not include empty categories', () => {
    const html = buildModsViewHtml({
      gen: { '1': 'Префикс', '2': 'Суффикс' },
      normal: [baseMod],
      corrupted: [],
    });

    const stats = getModCategoryStats(html);
    expect(stats.normal).toBe(1);
    expect(stats).not.toHaveProperty('corrupted');
  });
});
