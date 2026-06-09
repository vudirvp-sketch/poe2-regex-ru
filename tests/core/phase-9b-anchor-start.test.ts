/**
 * Phase 9b: ^ Anchor — Range notation FP prevention tests.
 *
 * KEY FINDING: ^ anchor works in PoE2 and anchors to the START of a mod block.
 * Verified in-game: "^(2[7-9]|30).*откладывания наград" highlights only 27% and 30%
 * items, NOT 26% and 22% items that have range notation "(27-50)" or "(22-50)".
 *
 * When anchorStart=true on a RANGE node, the compiler adds ^ before the number
 * pattern. This prevents matching secondary numbers inside range notation like
 * "(27-50)" because the number is NOT at position 0 of the mod block.
 *
 * The actual roll value always starts at position 0 of the block:
 *   "26(27-50)% шанс..." → position 0 is "26", NOT "27"
 *   "27% шанс..." → position 0 is "27" → matches ^(2[7-9])
 */
import { describe, it, expect } from 'vitest';
import { matchPoE2RegexItem } from '@core/poe2-regex-matcher';
import { compile } from '@core/compiler';
import { range } from '@core/ast';

describe('Phase 9b: ^ anchor prevents range notation FP', () => {
  // Tablet items with "откладывания наград" mod (real in-game data)
  const item30 = {
    mods: ['30% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
  };
  const item27 = {
    mods: ['27% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
  };
  // FP items: actual roll is NOT in [27,30] but range notation contains matching number
  const item26 = {
    mods: ['26(27-50)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
  };
  const item22 = {
    mods: ['22(22-50)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
  };

  it('WITHOUT ^: enumeration FP on range notation — 26% and 22% items match', () => {
    // Phase 9a confirmed: (2[7-9]|30).*suffix matches items with range notation
    // because "27" from "(27-50)" matches the pattern
    const regex = '"(2[7-9]|30).*откладывания наград"';
    expect(matchPoE2RegexItem(regex, item27)).toBe(true);   // correct: 27% is in [27,30]
    expect(matchPoE2RegexItem(regex, item30)).toBe(true);   // correct: 30% is in [27,30]
    expect(matchPoE2RegexItem(regex, item26)).toBe(true);   // FP: "27" in "(27-50)" matches
    expect(matchPoE2RegexItem(regex, item22)).toBe(false);  // no matching number in "(22-50)"
  });

  it('WITH ^: enumeration no longer has FP — only 27% and 30% match', () => {
    // Phase 9b: ^ anchors to position 0 of the mod block.
    // "26(27-50)%..." starts with "26" → ^(2[7-9]|30) doesn't match
    // "27%..." starts with "27" → ^(2[7-9]) matches
    const regex = '"^(2[7-9]|30).*откладывания наград"';
    expect(matchPoE2RegexItem(regex, item27)).toBe(true);   // correct: 27% starts block
    expect(matchPoE2RegexItem(regex, item30)).toBe(true);   // correct: 30% starts block
    expect(matchPoE2RegexItem(regex, item26)).toBe(false);   // FP prevented: "26" at pos 0
    expect(matchPoE2RegexItem(regex, item22)).toBe(false);   // correct: "22" doesn't match
  });

  it('compiler: RANGE with anchorStart=true produces ^ prefix', () => {
    const result = compile(range(27, 30, 'откладывания наград', undefined, undefined, true), { round10: false });
    expect(result).toBe('"^(2[7-9]|30).*откладывания наград"');
  });

  it('compiler: RANGE without anchorStart produces no ^ (backward compatible)', () => {
    const result = compile(range(27, 30, 'откладывания наград'), { round10: false });
    expect(result).toBe('"(2[7-9]|30).*откладывания наград"');
    expect(result).not.toContain('^');
  });

  it('compiler: RANGE with prefix does NOT add ^ (prefix anchors instead)', () => {
    // Dual-number mods have prefix ("От") which anchors within the block
    const result = compile(range(25, 30, 'количество дани', 'даруют увеличенное на', undefined, true), { round10: false });
    expect(result).toBe('"даруют увеличенное на (2[5-9]|30).*количество дани"');
    expect(result).not.toContain('^');
  });

  it('^ anchor on ≥min: prevents FP from range notation', () => {
    // ≥27 with anchorStart → ^(2[7-9]|[3-9][0-9]|[0-9][0-9][0-9]).*suffix
    // This prevents "27" from "(27-50)" matching because it's not at position 0
    const regex = '"^(2[7-9]|[3-9][0-9]|[0-9][0-9][0-9]).*откладывания наград"';
    expect(matchPoE2RegexItem(regex, item27)).toBe(true);   // 27% starts block
    expect(matchPoE2RegexItem(regex, item30)).toBe(true);   // 30% starts block
    expect(matchPoE2RegexItem(regex, item26)).toBe(false);   // FP prevented
  });

  it('^ anchor on ≤max: prevents FP from range notation', () => {
    // ≤30 with anchorStart → ^([0-9]|[1-2][0-9]|30).*suffix
    const regex = '"^([0-9]|[1-2][0-9]|30).*откладывания наград"';
    // 26% starts with "26" which matches 1[0-9] → but we also need "откладывания наград"
    expect(matchPoE2RegexItem(regex, item27)).toBe(true);   // 27% starts block, 27 ≤ 30
    expect(matchPoE2RegexItem(regex, item30)).toBe(true);   // 30% starts block, 30 ≤ 30
    expect(matchPoE2RegexItem(regex, item26)).toBe(true);   // 26% starts with "26" which matches [1-2][0-9] — NOT FP (26 ≤ 30)
  });

  it('AND fallback with ^: both groups get ^ anchor', () => {
    // Wide range >50 values: AND(RANGE(min), RANGE(max)) with anchorStart
    // Both children should have ^
    const result = compile(range(10, 200, 'суффикс', undefined, undefined, true), { round10: false });
    const groups = result.split('" "');
    expect(groups.length).toBe(2);
    // Both groups should start with ^ after the opening quote
    expect(groups[0]).toContain('^');
    expect(groups[1]).toContain('^');
  });
});
