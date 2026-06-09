/**
 * Phase 9c: Suffix Anchoring (anchorEnd) — REVISED after in-game testing.
 *
 * ORIGINAL FINDING (Phase 9c): For +##%-prefix mods (accessories),
 * '%' after the number can prevent range notation FP. Pattern:
 *   "(2[7-9]|30)%.*suffix" — prevents FP because numbers in range
 *   notation (e.g. 27 from (27-50)) are NOT followed by %.
 *
 * REVISED FINDING (in-game testing): % anchor causes FN (false negatives)
 * on ALL items with range notation because PoE2's search indexes text
 * WITH range notation. In-game text format:
 *   "+27(22-27)% к сопротивлению огню"
 * Here "27" is followed by "(" not "%" → % anchor = 100% FN.
 *
 * DECISION: anchorEnd='%' is DISABLED for +##% accessory mods.
 * Enumeration without % anchor provides FP protection for narrow ranges.
 * The FN from % anchor is worse than the FP it prevents.
 *
 * The compiler still supports anchorEnd as a parameter for potential
 * future use, but the runtime (useCategoryPage.ts) no longer sets it.
 * This file documents the behavior for reference.
 */
import { describe, it, expect } from 'vitest';
import { matchPoE2RegexItem } from '@core/poe2-regex-matcher';
import { compile } from '@core/compiler';
import { range } from '@core/ast';

describe('Phase 9c REVISED: anchorEnd (%) disabled due to FN on range notation', () => {
  // Items WITHOUT range notation (simple format — how Phase 9c originally tested)
  const ring27Simple = { mods: ['+27% к сопротивлению огню'] };
  const ring30Simple = { mods: ['+30% к сопротивлению огню'] };

  // Items WITH range notation (how PoE2 actually displays them in search)
  const ring27Range = { mods: ['+27(22-27)% к сопротивлению огню'] };
  const ring30Range = { mods: ['+30(26-30)% к сопротивлению огню'] };

  // FP item: actual roll is 26 but range notation contains 27
  const ring26FP = { mods: ['+26(27-50)% к сопротивлению огню'] };

  // ─── WITHOUT % anchor (current behavior after fix) ───

  it('WITHOUT anchorEnd: enumeration matches both plain and range notation items', () => {
    const regex = '"(2[7-9]|30).*к сопротивлению огню"';
    expect(matchPoE2RegexItem(regex, ring27Simple)).toBe(true);
    expect(matchPoE2RegexItem(regex, ring30Simple)).toBe(true);
    expect(matchPoE2RegexItem(regex, ring27Range)).toBe(true);
    expect(matchPoE2RegexItem(regex, ring30Range)).toBe(true);
  });

  it('WITHOUT anchorEnd: known FP from range notation (acceptable tradeoff)', () => {
    const regex = '"(2[7-9]|30).*к сопротивлению огню"';
    // FP: "27" from "(27-50)" matches — acceptable because % anchor causes worse FN
    expect(matchPoE2RegexItem(regex, ring26FP)).toBe(true);
  });

  // ─── WITH % anchor (old behavior — causes FN) ───

  it('WITH anchorEnd %: works on plain text but FN on range notation', () => {
    const regex = '"(2[7-9]|30)%.*к сопротивлению огню"';
    // Plain text: works
    expect(matchPoE2RegexItem(regex, ring27Simple)).toBe(true);
    expect(matchPoE2RegexItem(regex, ring30Simple)).toBe(true);
    // Range notation: FN! "27" followed by "(" not "%"
    expect(matchPoE2RegexItem(regex, ring27Range)).toBe(false);
    expect(matchPoE2RegexItem(regex, ring30Range)).toBe(false);
  });

  // ─── Compiler: anchorEnd still supported as parameter but not used by runtime ───

  it('compiler: RANGE without anchorEnd produces no % (current default)', () => {
    const result = compile(range(27, 30, 'к сопротивлению огню'), { round10: false });
    expect(result).toBe('"(2[7-9]|30).*к сопротивлению огню"');
    expect(result).not.toContain('%');
  });

  it('compiler: RANGE with anchorEnd="%" still works (parameter preserved)', () => {
    // The parameter is still supported for potential future use or manual override
    const result = compile(range(27, 30, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
    expect(result).toBe('"(2[7-9]|30)%.*к сопротивлению огню"');
  });

  // ─── Tablet-specific: ^ anchor still used (no FN issue) ───

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
    // "^" at position 0: "26" ≠ (2[7-9]|30) → correctly rejected
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });
});
