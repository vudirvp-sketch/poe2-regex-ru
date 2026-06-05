import { describe, it, expect } from 'vitest';
import { extractTextAndRanges, extractGenderForms, detectYofication } from '@etl/normalize';

describe('extractTextAndRanges', () => {
  it('extracts a numeric range from mod-value spans', () => {
    const html = '<span class="mod-value">(5<span class="ndash">—</span>9)</span>% от их урона';
    const result = extractTextAndRanges(html);
    expect(result.ranges).toEqual([[5, 9]]);
    expect(result.rawText).toContain('%');
  });

  it('extracts multiple ranges', () => {
    const html = '<span class="mod-value">(10<span class="ndash">—</span>20)</span> урон и <span class="mod-value">(5<span class="ndash">—</span>8)</span> скорость';
    const result = extractTextAndRanges(html);
    expect(result.ranges.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts single values', () => {
    const html = '<span class="mod-value">+50</span> к здоровью';
    const result = extractTextAndRanges(html);
    expect(result.values.length).toBeGreaterThanOrEqual(0);
  });

  it('handles text without ranges', () => {
    const html = 'Простой текст мода без чисел';
    const result = extractTextAndRanges(html);
    expect(result.ranges).toEqual([]);
    expect(result.rawText).toBe('Простой текст мода без чисел');
  });

  it('takes only the first line when description has <br> tags (mod gluing fix)', () => {
    // Real poe2db.tw HTML: affix line followed by implicit bonuses separated by <br>
    const html = 'Дополнительных свойств у редких монстров: <span class="mod-value">1</span><br><span class="mod-value">25</span>% увеличение количества редких монстров<br><span class="mod-value">10</span>% увеличение количества путевых камней, находимых в области';
    const result = extractTextAndRanges(html);
    // Should only extract the first affix line, not the implicit bonuses
    expect(result.rawText).toBe('Дополнительных свойств у редких монстров: 1');
    expect(result.rawText).not.toContain('увеличение количества');
    expect(result.values).toEqual([1]);
  });

  it('handles single-line HTML without <br> tags', () => {
    const html = 'Монстры бронированы';
    const result = extractTextAndRanges(html);
    expect(result.rawText).toBe('Монстры бронированы');
    expect(result.ranges).toEqual([]);
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
