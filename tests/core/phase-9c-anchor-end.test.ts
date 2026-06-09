/**
 * Phase 9c: Suffix Anchoring (anchorEnd) — Range notation FP prevention for +##% mods.
 *
 * KEY FINDING: For +##%-prefix mods (accessories like rings, amulets, belts),
 * the ^ anchor cannot be used because the block starts with '+', not a digit.
 * However, '%' after the number can serve as a suffix anchor:
 *
 * In text like "+26(27-50)% к сопротивлению огню":
 *   - Actual roll "26" is preceded by "+" and followed by "(" — NOT "%"
 *   - Range notation number "27" from "(27-50)" is followed by "-", not "%"
 *   - The "%" appears only after the closing ")" of range notation
 *
 * Pattern "(2[7-9]|30)%.*suffix":
 *   - Matches "27% к сопротивлению огню" (true positive: 27% roll)
 *   - Does NOT match "27" from "(27-50)" because "27" is followed by "-", not "%"
 *   - ⚠️ FN risk: If the actual roll has range notation like "27(22-27)%",
 *     the "27" is followed by "(", not "%" — suffix anchoring misses this!
 *
 * DECISION: anchorEnd='%' is used ONLY for +##% mods (accessories) where
 * anchorStart=false. For ##% mods (tablets/waystones), anchorStart=true
 * with ^ is sufficient and doesn't have FN risk.
 */
import { describe, it, expect } from 'vitest';
import { matchPoE2RegexItem } from '@core/poe2-regex-matcher';
import { compile } from '@core/compiler';
import { range } from '@core/ast';

describe('Phase 9c: anchorEnd (%) suffix anchoring prevents range notation FP', () => {
  // Accessory items with "+##% к сопротивлению" mod (simulated in-game data)
  const ring27 = {
    mods: ['+27% к сопротивлению огню'],
  };
  const ring30 = {
    mods: ['+30% к сопротивлению огню'],
  };
  // FP item: actual roll is 26 but range notation contains 27
  const ring26Range = {
    mods: ['+26(27-50)% к сопротивлению огню'],
  };
  // FN risk item: actual roll 27 has range notation — "27(" not "27%"
  const ring27Range = {
    mods: ['+27(22-27)% к сопротивлению огню'],
  };

  it('WITHOUT anchorEnd: enumeration FP on range notation — +26% item matches', () => {
    // Without %, (2[7-9]|30) matches "27" from "(27-50)" — FP
    const regex = '"(2[7-9]|30).*к сопротивлению огню"';
    expect(matchPoE2RegexItem(regex, ring27)).toBe(true);    // correct: 27% in range
    expect(matchPoE2RegexItem(regex, ring30)).toBe(true);    // correct: 30% in range
    expect(matchPoE2RegexItem(regex, ring26Range)).toBe(true); // FP: "27" from range notation
  });

  it('WITH anchorEnd %: enumeration no longer has FP from range notation', () => {
    // With %, (2[7-9]|30)% requires "%" immediately after number
    // "27" from "(27-50)" is followed by "-" → no match (FP prevented)
    const regex = '"(2[7-9]|30)%.*к сопротивлению огню"';
    expect(matchPoE2RegexItem(regex, ring27)).toBe(true);     // correct: 27% matches
    expect(matchPoE2RegexItem(regex, ring30)).toBe(true);     // correct: 30% matches
    expect(matchPoE2RegexItem(regex, ring26Range)).toBe(false); // FP prevented: "27" not followed by %
  });

  it('anchorEnd %: FN risk — item with range notation on actual roll is missed', () => {
    // When actual roll has range notation: "+27(22-27)%..." → "27" followed by "(" not "%"
    // The pattern "(2[7-9]|30)%" requires "%" after "27" → FN!
    const regex = '"(2[7-9]|30)%.*к сопротивлению огню"';
    expect(matchPoE2RegexItem(regex, ring27Range)).toBe(false); // FN: actual 27% but range notation breaks it
  });

  it('compiler: RANGE with anchorEnd="%" produces % after number pattern (enumerated)', () => {
    const result = compile(range(27, 30, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
    expect(result).toBe('"(2[7-9]|30)%.*к сопротивлению огню"');
  });

  it('compiler: RANGE with anchorEnd="%" produces % after number pattern (≥min)', () => {
    const result = compile(range(27, undefined, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
    expect(result).toBe('"(2[7-9]|[3-9][0-9]|[0-9][0-9][0-9])%.*к сопротивлению огню"');
  });

  it('compiler: RANGE with anchorEnd="%" produces % after number pattern (≤max)', () => {
    const result = compile(range(undefined, 30, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
    expect(result).toBe('"([0-9]|[1-2][0-9]|30)%.*к сопротивлению огню"');
  });

  it('compiler: RANGE without anchorEnd produces no % (backward compatible)', () => {
    const result = compile(range(27, 30, 'к сопротивлению огню'), { round10: false });
    expect(result).toBe('"(2[7-9]|30).*к сопротивлению огню"');
    expect(result).not.toContain('%');
  });

  it('compiler: RANGE with both anchorStart and anchorEnd produces ^ and %', () => {
    // Both anchors combined: ^number%.*suffix
    // This is the strongest protection but has FN risk on range notation items
    const result = compile(range(27, 30, 'откладывания наград', undefined, undefined, true, '%'), { round10: false });
    expect(result).toBe('"^(2[7-9]|30)%.*откладывания наград"');
  });

  it('compiler: anchorEnd preserved in AND fallback for wide ranges', () => {
    // Wide range >50 values: AND(RANGE(min), RANGE(max)) with anchorEnd
    const result = compile(range(10, 200, 'суффикс', undefined, undefined, false, '%'), { round10: false });
    const groups = result.split('" "');
    expect(groups.length).toBe(2);
    // Both groups should have % after number pattern
    expect(groups[0]).toContain('%');
    expect(groups[1]).toContain('%');
  });

  it('compiler: anchorEnd with prefix does NOT add % after prefix', () => {
    // Dual-number mods: prefix already anchors, % goes after number
    const result = compile(range(25, 30, 'количество дани', 'даруют увеличенное на', undefined, false, '%'), { round10: false });
    expect(result).toBe('"даруют увеличенное на (2[5-9]|30)%.*количество дани"');
  });

  // ─── Tablet-specific tests (anchorStart=true, anchorEnd=undefined) ───

  it('tablet mods use ^ anchor only (no anchorEnd) — ^ is sufficient', () => {
    // For ##% mods on tablets: anchorStart=true, anchorEnd=undefined
    // ^ already prevents FP, and % anchoring has FN risk on range notation items
    const result = compile(range(27, 30, 'откладывания наград', undefined, undefined, true), { round10: false });
    expect(result).toBe('"^(2[7-9]|30).*откладывания наград"');
    expect(result).not.toContain('%');
  });

  // ─── Combination: ^ and % together for maximum protection ───

  it('combination: ^ + % on tablet item without range notation — correct match', () => {
    // Tablet mod: "27% уменьшение... откладывания наград" — starts with "27%"
    // "^(2[7-9]|30)%.*suffix" matches because 27 is at position 0 AND followed by %
    const item = {
      mods: ['27% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
    };
    const regex = '"^(2[7-9]|30)%.*откладывания наград"';
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('combination: ^ + % on tablet item with range notation — still correct', () => {
    // Tablet mod: "26(27-50)% уменьшение... откладывания наград" — starts with "26("
    // "^(2[7-9]|30)%.*suffix" does NOT match: position 0 is "26", and "26%" ≠ (2[7-9]|30)%
    const item = {
      mods: ['26(27-50)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
    };
    const regex = '"^(2[7-9]|30)%.*откладывания наград"';
    expect(matchPoE2RegexItem(regex, item)).toBe(false); // Correctly rejected
  });
});
