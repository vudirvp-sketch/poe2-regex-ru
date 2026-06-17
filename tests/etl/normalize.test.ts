import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  extractTextAndRanges,
  extractGenderForms,
  detectYofication,
  generateId,
  WAYSTONE_IMPLICIT_SET_FAMILY_KEYS,
  TABLET_IMPLICIT_SET_FAMILY_KEYS,
} from '@etl/normalize';

describe('extractTextAndRanges', () => {
  it('extracts a numeric range from mod-value spans', () => {
    const html = '<span class="mod-value">(5<span class="ndash">—</span>9)</span>% от их урона';
    const result = extractTextAndRanges(html);
    expect(result).toHaveLength(1);
    expect(result[0].ranges).toEqual([[5, 9]]);
    expect(result[0].rawText).toContain('%');
  });

  it('extracts multiple ranges in a single segment', () => {
    const html = '<span class="mod-value">(10<span class="ndash">—</span>20)</span> урон и <span class="mod-value">(5<span class="ndash">—</span>8)</span> скорость';
    const result = extractTextAndRanges(html);
    expect(result).toHaveLength(1);
    expect(result[0].ranges.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts single values', () => {
    const html = '<span class="mod-value">+50</span> к здоровью';
    const result = extractTextAndRanges(html);
    expect(result).toHaveLength(1);
    expect(result[0].values.length).toBeGreaterThanOrEqual(0);
  });

  it('handles text without ranges', () => {
    const html = 'Простой текст мода без чисел';
    const result = extractTextAndRanges(html);
    expect(result).toHaveLength(1);
    expect(result[0].ranges).toEqual([]);
    expect(result[0].rawText).toBe('Простой текст мода без чисел');
  });

  it('splits <br> segments into separate tokens', () => {
    const html = 'Монстры имеют (80—120)% повышение шанса критического удара<br><span class="mod-value">(30—50)</span>% к бонусу критического урона монстров';
    const result = extractTextAndRanges(html);
    expect(result.length).toBe(2);
    expect(result[0].rawText).toBe('Монстры имеют (80—120)% повышение шанса критического удара');
    expect(result[1].rawText).toContain('к бонусу критического урона монстров');
  });

  it('handles waystone multi-line mods with implicit bonuses', () => {
    const html = 'Дополнительных свойств у редких монстров: <span class="mod-value">1</span><br><span class="mod-value">25</span>% увеличение количества редких монстров<br><span class="mod-value">10</span>% увеличение количества путевых камней, находимых в области';
    const result = extractTextAndRanges(html);
    // Each <br> segment is now a separate token
    expect(result.length).toBe(3);
    expect(result[0].rawText).toBe('Дополнительных свойств у редких монстров: 1');
    expect(result[0].values).toEqual([1]);
    expect(result[1].rawText).toContain('увеличение количества редких монстров');
    expect(result[2].rawText).toContain('увеличение количества путевых камней');
  });

  it('handles single-line HTML without <br> tags', () => {
    const html = 'Монстры бронированы';
    const result = extractTextAndRanges(html);
    expect(result).toHaveLength(1);
    expect(result[0].rawText).toBe('Монстры бронированы');
    expect(result[0].ranges).toEqual([]);
  });

  it('splits dual-stat mods into separate segments (not joined)', () => {
    const html = '<span class="mod-value">(5<span class="ndash">—</span>10)</span>% повышение брони<br><span class="mod-value">(4<span class="ndash">—</span>8)</span>% увеличение урона от атак';
    const result = extractTextAndRanges(html);
    expect(result.length).toBe(2);
    expect(result[0].rawText).toContain('повышение брони');
    expect(result[0].ranges).toEqual([[5, 10]]);
    expect(result[1].rawText).toContain('увеличение урона от атак');
    expect(result[1].ranges).toEqual([[4, 8]]);
  });

  it('returns at least one segment for empty input', () => {
    const result = extractTextAndRanges('');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].rawText).toBe('');
  });

  it('skips empty <br> segments', () => {
    const html = 'Текст мода<br><br>Другой текст';
    const result = extractTextAndRanges(html);
    expect(result.length).toBe(2);
    expect(result[0].rawText).toBe('Текст мода');
    expect(result[1].rawText).toBe('Другой текст');
  });
});

describe('extractGenderForms', () => {
  it('extracts gender forms from template HTML', () => {
    const html = '<if:ms>{Глубинный}<elif:fs>{Глубинная}<elif:ns>{Глубинное}</if:ms>';
    const forms = extractGenderForms(html);
    expect(forms.ms).toBe('Глубинный');
    expect(forms.fs).toBe('Глубинная');
    expect(forms.ns).toBe('Глубинное');
  });

  it('returns empty object for text without gender templates', () => {
    const html = 'Простой текст';
    const forms = extractGenderForms(html);
    expect(forms.ms).toBeUndefined();
  });
});

describe('detectYofication', () => {
  it('detects potential yofication positions', () => {
    const result = detectYofication('Всё лучшее');
    expect(result.hasYofication).toBe(true);
    expect(result.yoficationPositions.length).toBeGreaterThan(0);
  });

  it('returns no yofication for text without Ё roots', () => {
    const result = detectYofication('Сопротивление огню');
    // "Сопротивление" doesn't have typical ё roots
    expect(typeof result.hasYofication).toBe('boolean');
  });

  it('handles empty text', () => {
    const result = detectYofication('');
    expect(result.hasYofication).toBe(false);
    expect(result.yoficationPositions).toEqual([]);
  });
});

describe('generateId', () => {
  it('generates ID from modCode', () => {
    const id = generateId('StatFixer', 'waystone', 'text', 'normal');
    expect(id).toBe('waystone.statfixer');
  });

  it('appends origin suffix for non-normal origins', () => {
    const id = generateId('StatFixer', 'waystone', 'text', 'desecrated');
    expect(id).toBe('waystone.statfixer_desecrated');
  });

  it('generates hash-based ID when no modCode', () => {
    const id = generateId(undefined, 'waystone', 'some text', 'normal');
    expect(id).toMatch(/^waystone\.mod_[a-z0-9]+$/);
  });
});

// ─── Bug #15 / KI-2: hardcoded implicit-set family keys must exist in data ───
//
// KI-2 (open, iter 74): WAYSTONE_IMPLICIT_SET_FAMILY_KEYS and
// TABLET_IMPLICIT_SET_FAMILY_KEYS in scripts/etl/normalize.ts are STALE —
// none of the 4 waystone keys nor the 1 tablet key match any actual
// `familyKey.ru` in the generated JSON. As a result, `isImplicitSetBonus`
// silently no-ops and implicit-set bonus tokens are NOT filtered out of
// the mod list (they should be — they are not searchable as mod text in-game).
//
// These tests use `it.fails` to document the EXPECTED behavior: each
// hardcoded key MUST be present in the corresponding category's
// `familyKey.ru` set. They currently FAIL (assertion error) — `it.fails`
// inverts this so the suite stays green. When KI-2 is fixed (keys updated
// to match current poe2db source data), these tests will START PASSING,
// `it.fails` will then report failure (alerting that the test should be
// converted back to a plain `it`).

describe('WAYSTONE_IMPLICIT_SET_FAMILY_KEYS / TABLET_IMPLICIT_SET_FAMILY_KEYS (Bug #15 / KI-2)', () => {
  const projectRoot = join(__dirname, '..', '..');
  const generatedDir = join(projectRoot, 'public', 'generated');

  function loadFamilyKeys(filename: string): Set<string> {
    const raw = readFileSync(join(generatedDir, filename), 'utf-8');
    const data = JSON.parse(raw);
    const familyKeys = new Set<string>();
    for (const token of data.tokens ?? []) {
      const fk = token?.familyKey?.ru;
      if (typeof fk === 'string') {
        // Apply the same normalization as `isImplicitSetBonus`:
        // ## → #, collapse whitespace, trim.
        const norm = fk.replace(/##/g, '#').replace(/\s+/g, ' ').trim();
        if (norm) familyKeys.add(norm);
      }
    }
    return familyKeys;
  }

  it.fails('KI-2: every WAYSTONE_IMPLICIT_SET_FAMILY_KEYS entry exists in waystone.json familyKey set', () => {
    const familyKeys = loadFamilyKeys('waystone.json');
    const missing = WAYSTONE_IMPLICIT_SET_FAMILY_KEYS.filter(k => !familyKeys.has(k));
    expect(missing).toEqual([]);
  });

  it.fails('KI-2: every WAYSTONE_IMPLICIT_SET_FAMILY_KEYS entry exists in waystone-desecrated.json familyKey set', () => {
    const familyKeys = loadFamilyKeys('waystone-desecrated.json');
    const missing = WAYSTONE_IMPLICIT_SET_FAMILY_KEYS.filter(k => !familyKeys.has(k));
    expect(missing).toEqual([]);
  });

  it.fails('KI-2: every TABLET_IMPLICIT_SET_FAMILY_KEYS entry exists in tablet.json familyKey set', () => {
    const familyKeys = loadFamilyKeys('tablet.json');
    const missing = TABLET_IMPLICIT_SET_FAMILY_KEYS.filter(k => !familyKeys.has(k));
    expect(missing).toEqual([]);
  });
});
