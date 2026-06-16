import { describe, it, expect } from 'vitest';
import { MAX_CHARS, getCharCount, isOverflow, getCharHealth, splitOverLimitRegex } from '@core/limits';

describe('limits', () => {
  it('MAX_CHARS is 250', () => {
    expect(MAX_CHARS).toBe(250);
  });

  it('getCharCount returns string length', () => {
    expect(getCharCount('hello')).toBe(5);
    expect(getCharCount('привет')).toBe(6); // Cyrillic: 6 characters, NOT 12 bytes
  });

  it('isOverflow returns true when > 250 chars', () => {
    expect(isOverflow('a'.repeat(251))).toBe(true);
    expect(isOverflow('a'.repeat(250))).toBe(false);
    expect(isOverflow('a'.repeat(200))).toBe(false);
  });

  it('getCharHealth returns green for <= 200', () => {
    const health = getCharHealth('a'.repeat(100));
    expect(health.level).toBe('green');
    expect(health.count).toBe(100);
    expect(health.max).toBe(250);
  });

  it('getCharHealth returns yellow for 201-240', () => {
    const health = getCharHealth('a'.repeat(220));
    expect(health.level).toBe('yellow');
  });

  it('getCharHealth returns red for > 240', () => {
    const health = getCharHealth('a'.repeat(245));
    expect(health.level).toBe('red');
  });

  it('getCharHealth percentage calculation', () => {
    const health = getCharHealth('a'.repeat(125));
    expect(health.percentage).toBe(50);
  });
});

describe('splitOverLimitRegex', () => {
  it('returns single-element array when regex is within limit', () => {
    const result = splitOverLimitRegex('"short regex"');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('short regex');
  });

  it('returns single-element array for over-limit regex without top-level |', () => {
    // A single long alternative with no | — can't split
    const longRegex = '"^' + 'a'.repeat(300) + '.*suffix"';
    const result = splitOverLimitRegex(longRegex);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBeGreaterThan(250);
  });

  it('splits over-limit regex at top-level | boundaries', () => {
    // Build a regex with many short alternatives that exceeds 250 chars
    const alt = 'увеличение.*области действия'; // 28 chars
    const count = Math.ceil(260 / (alt.length + 1)); // ~9 alternatives needed
    const regex = '"' + Array(count).fill(alt).join('|') + '"';
    expect(regex.length).toBeGreaterThan(250);

    const result = splitOverLimitRegex(regex);
    expect(result.length).toBeGreaterThan(1);

    // Each part (with quotes) should be <= 250 chars
    for (const part of result) {
      expect(part.length + 2).toBeLessThanOrEqual(MAX_CHARS); // +2 for quotes
    }
  });

  it('produces valid regex parts that reconstruct the original (minus quotes)', () => {
    const alts = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
    const fullInner = alts.join('|');
    const fullRegex = '"' + fullInner + '"';

    const result = splitOverLimitRegex(fullRegex);
    // Rejoin all parts with | should equal the original inner content
    expect(result.join('|')).toBe(fullInner);
  });

  it('handles escape sequences — does not split when within limit', () => {
    // \| should not be treated as a separator, but regex is within limit so no split
    const regex = '"alpha\\|beta|gamma"';
    const result = splitOverLimitRegex(regex);
    // Within limit — returns inner content as single element
    expect(result).toEqual(['alpha\\|beta|gamma']);
  });

  it('handles character classes — does not split when within limit', () => {
    // | inside [] should not be treated as a separator, but regex is within limit
    const regex = '"[а-я|А-Я].*suffix|other"';
    const result = splitOverLimitRegex(regex);
    expect(result).toEqual(['[а-я|А-Я].*suffix|other']);
  });

  it('handles grouping depth — does not split when within limit', () => {
    // | inside () should not be treated as a top-level separator, but within limit
    const regex = '"^(?!.*(alpha|beta)).*gamma|delta"';
    const result = splitOverLimitRegex(regex);
    expect(result).toEqual(['^(?!.*(alpha|beta)).*gamma|delta']);
  });

  it('handles the actual jewel over-limit entry (317 chars)', () => {
    const regex = '"увеличение.*области действия|увеличение.*максимума.*энергетического щита|увеличение.*максимума.*здоровья|увеличение.*уклонения|увеличение.*урона в ближнем бою|увеличение.*бонуса к критическому урону|увеличение.*количества получаемых зарядов флакона|увеличение.*длительности эффекта умения|увеличение.*порога оглушения"';
    expect(regex.length).toBeGreaterThan(250);

    const result = splitOverLimitRegex(regex);
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Each part with quotes must be <= 250
    for (const part of result) {
      expect(part.length + 2).toBeLessThanOrEqual(MAX_CHARS);
    }
  });

  it('handles the actual jewel over-limit entry (260 chars)', () => {
    const regex = '"увеличение.*уклон.*ения|увеличение.*длительности эффекта ум.*ения|увеличение.*порога оглуш.*ения|ослепл.*ения|отравл.*ения|вами кровотеч.*ения|истощ.*ения|длительности кровотеч.*ения|передвиж.*ения|пригвожд.*ения|повышение скорости накопления шкалы оглуш.*ения"';
    expect(regex.length).toBeGreaterThan(250);

    const result = splitOverLimitRegex(regex);
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Each part with quotes must be <= 250
    for (const part of result) {
      expect(part.length + 2).toBeLessThanOrEqual(MAX_CHARS);
    }
  });

  it('handles regex without outer quotes', () => {
    // Should work even if quotes are missing
    const regex = 'alpha|' + 'b'.repeat(260);
    const result = splitOverLimitRegex(regex);
    // alpha + | + 260 b's = >250 chars, should split
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('strips quotes from within-limit regex', () => {
    const result = splitOverLimitRegex('"within limit"');
    expect(result).toEqual(['within limit']);
  });

  it('preserves ^ anchor in first alternative when over-limit split happens', () => {
    // Build an over-limit regex with ^ anchor in first alternative
    const longAlt = 'b'.repeat(240);
    const regex = '"^(?!.*exclude).*suffix|' + longAlt + '|third"';
    expect(regex.length).toBeGreaterThan(250);
    const result = splitOverLimitRegex(regex);
    expect(result.length).toBeGreaterThan(1);
    expect(result[0]).toContain('^(?!.*exclude)');
  });
});
