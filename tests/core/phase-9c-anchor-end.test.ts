/**
 * Phase 9c: Suffix Anchoring (anchorEnd) — RE-ENABLED after dual-indexing verification.
 *
 * ORIGINAL FINDING (Phase 9c): For +##%-prefix mods (accessories),
 * '%' after the number can prevent range notation FP. Pattern:
 *   "(2[7-9]|30)%.*suffix" — prevents FP because numbers in range
 *   notation (e.g. 27 from (27-50)) are NOT followed by %.
 *
 * INTERIM DISABLE (Phase 9c REVISED): % anchor was disabled because
 * in-game testing appeared to show FN on range notation items.
 * Assumption was: PoE2 indexes ONLY detailed text like "+27(22-27)%".
 *
 * RE-ENABLED (Tablet Battery + Accessory Retest, 2026-06-10):
 * PoE2 DUAL-INDEXES both simplified AND detailed text:
 *   Simplified: "+27% к сопротивлению огню" (matches "%" anchor)
 *   Detailed:   "+27(22-27)% к сопротивлению огню" (doesn't match "%" anchor)
 * Both are searchable. The simplified display makes "%" anchor work.
 *
 * Verified results:
 *   "39%.*suffix" → exact match (tablets) ✅
 *   "35%.*к сопротивлению молнии" → matches ring R1 ✅
 *   "34%.*к сопротивлению молнии" → matches amulet A3 ✅
 *   "39.*suffix" → FP from range notation secondary numbers ❌
 *   "(30|39).*suffix" → 6 items (3 FP from "(30-40)%") ❌
 *   "(30%|39%).*suffix" → 3 items (correct) ✅
 */
import { describe, it, expect } from 'vitest';
import { matchPoE2RegexItem } from '@core/poe2-regex-matcher';
import { compile } from '@core/compiler';
import { range } from '@core/ast';

describe('Phase 9c RE-ENABLED: anchorEnd (%) works with dual-indexing', () => {
  // Items WITHOUT range notation (simplified display)
  const ring27Simple = { mods: ['+27% к сопротивлению огню'] };
  const ring30Simple = { mods: ['+30% к сопротивлению огню'] };

  // Items WITH range notation (detailed display — also indexed by PoE2)
  const ring27Range = { mods: ['+27(22-27)% к сопротивлению огню'] };
  const ring30Range = { mods: ['+30(26-30)% к сопротивлению огню'] };

  // FP item: actual roll is 26 but range notation contains 27
  const ring26FP = { mods: ['+26(27-50)% к сопротивлению огню'] };

  // ─── WITH % anchor (RE-ENABLED) ───

  it('WITH anchorEnd %: matches simplified display items', () => {
    const regex = '"(2[7-9]|30)%.*к сопротивлению огню"';
    expect(matchPoE2RegexItem(regex, ring27Simple)).toBe(true);
    expect(matchPoE2RegexItem(regex, ring30Simple)).toBe(true);
  });

  it('WITH anchorEnd %: does NOT match range notation detailed display', () => {
    const regex = '"(2[7-9]|30)%.*к сопротивлению огню"';
    // In PoE2, simplified display IS indexed → matches via simplified.
    // Our test harness only has the detailed string → FN in test (but not in game).
    // This test documents the test harness limitation.
    expect(matchPoE2RegexItem(regex, ring27Range)).toBe(false);
    expect(matchPoE2RegexItem(regex, ring30Range)).toBe(false);
  });

  it('WITH anchorEnd %: prevents FP from range notation secondary numbers', () => {
    const regex = '"(2[7-9]|30)%.*к сопротивлению огню"';
    // "27" in "(27-50)" is NOT followed by "%" → correctly rejected
    expect(matchPoE2RegexItem(regex, ring26FP)).toBe(false);
  });

  // ─── WITHOUT % anchor (shows FP risk) ───

  it('WITHOUT anchorEnd: enumeration matches both plain and range notation items', () => {
    const regex = '"(2[7-9]|30).*к сопротивлению огню"';
    expect(matchPoE2RegexItem(regex, ring27Simple)).toBe(true);
    expect(matchPoE2RegexItem(regex, ring30Simple)).toBe(true);
    expect(matchPoE2RegexItem(regex, ring27Range)).toBe(true);
    expect(matchPoE2RegexItem(regex, ring30Range)).toBe(true);
  });

  it('WITHOUT anchorEnd: known FP from range notation', () => {
    const regex = '"(2[7-9]|30).*к сопротивлению огню"';
    // FP: "27" from "(27-50)" matches
    expect(matchPoE2RegexItem(regex, ring26FP)).toBe(true);
  });

  // ─── Compiler: anchorEnd parameter ───

  it('compiler: RANGE without anchorEnd produces no %', () => {
    const result = compile(range(27, 30, 'к сопротивлению огню'), { round10: false });
    expect(result).toBe('"(2[7-9]|30).*к сопротивлению огню"');
    expect(result).not.toContain('%');
  });

  it('compiler: RANGE with anchorEnd="%" inserts % after number pattern', () => {
    const result = compile(range(27, 30, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
    expect(result).toBe('"(2[7-9]|30)%.*к сопротивлению огню"');
  });

  // ─── Tablet-specific: ^ anchor (no FN issue) ───

  it('tablet mods use ^ anchor only (no anchorEnd) — ^ is sufficient', () => {
    const result = compile(range(27, 30, 'откладывания наград', undefined, undefined, true), { round10: false });
    expect(result).toBe('"^(2[7-9]|30).*откладывания наград"');
    expect(result).not.toContain('%');
  });

  it('^ anchor on tablet item without range notation — correct match', () => {
    const item = {
      mods: ['27% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
    };
    const regex = '"^(2[7-9]|30).*откладывания наград"';
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('^ anchor on tablet item with range notation — correctly rejected', () => {
    const item = {
      mods: ['26(27-50)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
    };
    const regex = '"^(2[7-9]|30).*откладывания наград"';
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });
});
