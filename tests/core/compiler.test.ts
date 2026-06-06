import { describe, it, expect } from 'vitest';
import { compile } from '@core/compiler';
import { and, or, exclude, literal, range } from '@core/ast';

describe('compile', () => {
  it('compiles a LITERAL', () => {
    expect(compile(literal('цепя'))).toBe('"цепя"');
  });

  it('compiles OR of literals', () => {
    expect(compile(or(literal('огн'), literal('хол')))).toBe('"огн|хол"');
  });

  it('compiles AND of literals', () => {
    expect(compile(and(literal('corr'), literal('m q')))).toBe('"corr" "m q"');
  });

  it('compiles EXCLUDE of literal', () => {
    expect(compile(exclude(literal('проклят')))).toBe('"!проклят"');
  });

  it('compiles EXCLUDE of OR', () => {
    expect(compile(exclude(or(literal('проклят'), literal('сопротивлен'))))).toBe('"!проклят|сопротивлен"');
  });

  it('compiles RANGE with suffix (round10=true)', () => {
    const result = compile(range(40, undefined, 'm q'), { round10: true });
    expect(result).toBe('"([4-9].|[0-9]..).*m q"');
  });

  it('compiles AND of RANGE and LITERAL', () => {
    const result = compile(and(range(40, undefined, 'm q'), literal('corr')), { round10: true });
    expect(result).toBe('"([4-9].|[0-9]..).*m q" "corr"');
  });

  it('compiles complex: AND(OR, EXCLUDE, RANGE)', () => {
    const result = compile(
      and(
        or(literal('огн'), literal('хол')),
        exclude(literal('проклят')),
        range(40, undefined, 'путев')
      ),
      { round10: true }
    );
    expect(result).toBe('"огн|хол" "!проклят" "([4-9].|[0-9]..).*путев"');
  });

  it('returns empty string for empty AND', () => {
    expect(compile(and())).toBe('');
  });

  it('returns empty string for empty OR', () => {
    expect(compile(or())).toBe('');
  });

  it('returns empty string for RANGE with no min/max', () => {
    expect(compile(range())).toBe('');
  });

  // ─── Min+Max RANGE tests ───

  it('compiles RANGE with both min and max (2-digit)', () => {
    // range(40, 80, 'm q') → AND(≥40.*m q, ≤80.*m q) → two AND-joined quoted groups
    const result = compile(range(40, 80, 'm q'), { round10: true });
    expect(result).toBe('"([4-9].|[0-9]..).*m q" "([0-9]|[1-7].|80).*m q"');
  });

  it('compiles RANGE with both min and max (1-digit)', () => {
    // range(3, 7) → AND(≥3, ≤7) → two AND-joined quoted groups (no suffix)
    const result = compile(range(3, 7), { round10: false });
    expect(result).toBe('"([3-9]|[0-9]..?)" "([0-7])"');
  });

  it('compiles RANGE with both min and max inside AND', () => {
    // AND(literal('огн'), range(40, 80, 'm q')) → three AND-joined quoted groups
    const result = compile(
      and(literal('огн'), range(40, 80, 'm q')),
      { round10: true }
    );
    expect(result).toBe('"огн" "([4-9].|[0-9]..).*m q" "([0-9]|[1-7].|80).*m q"');
  });

  it('compiles RANGE with max-only', () => {
    // range(undefined, 50, 'm q') → only ≤50.*m q
    const result = compile(range(undefined, 50, 'm q'), { round10: true });
    expect(result).toBe('"([0-9]|[1-4].|50).*m q"');
  });

  it('compiles RANGE with both min and max (3-digit)', () => {
    // range(100, 200, 'жизн') → AND(≥100.*жизн, ≤200.*жизн)
    const result = compile(range(100, 200, 'жизн'), { round10: false });
    expect(result).toBe('"([1-9]..).*жизн" "([0-9]|[1-9].|[1-1]..|200).*жизн"');
  });

  // ─── Prefix tests (Iteration 20: anchor number to correct mod line) ───

  it('compiles RANGE with prefix and suffix', () => {
    // "Боссы карт даруют на ##% больше опыта" → prefix="даруют на", suffix="больше опыта"
    // range(60, undefined, 'больше опыта', 'даруют на') → "даруют на ([6-9].|\d..).*больше опыта"
    const result = compile(range(60, undefined, 'больше опыта', 'даруют на'), { round10: false });
    expect(result).toBe('"даруют на ([6-9].|[0-9]..).*больше опыта"');
  });

  it('compiles RANGE with prefix, suffix, and round10', () => {
    // With round10, 60 → round10 → 60 (no change), but 25 → round10 → 20
    // prefix="увеличенное на", suffix="количество монстров"
    const result = compile(range(25, undefined, 'количество монстров', 'увеличенное на'), { round10: true });
    expect(result).toBe('"увеличенное на ([2-9].|[0-9]..).*количество монстров"');
  });

  it('compiles RANGE with prefix and both min+max', () => {
    // range(25, 30, 'количество дани', 'даруют увеличенное на')
    // → AND(≥25.*количество дани, ≤30.*количество дани) with prefix on both
    // Note: without round10, ≥25 → (2[5-9]|[3-9].|\d..), ≤30 → ([0-9]|[1-2].|30)
    const result = compile(range(25, 30, 'количество дани', 'даруют увеличенное на'), { round10: false });
    expect(result).toBe('"даруют увеличенное на (2[5-9]|[3-9].|[0-9]..).*количество дани" "даруют увеличенное на ([0-9]|[1-2].|30).*количество дани"');
  });

  it('compiles RANGE without prefix (original behavior)', () => {
    // No prefix → same as before: "numRegex.*suffix"
    const result = compile(range(40, undefined, 'm q'), { round10: true });
    expect(result).toBe('"([4-9].|[0-9]..).*m q"');
  });

  it('compiles RANGE with prefix but no suffix', () => {
    // Prefix with no suffix: "prefix numRegex"
    const result = compile(range(50, undefined, undefined, 'даруют на'), { round10: true });
    expect(result).toBe('"даруют на ([5-9].|[0-9]..)"');
  });

  // ─── Exact (per-token) tests (Iteration 20: no round10 for per-token ranges) ───

  it('compiles RANGE with exact=true (no round10)', () => {
    // exact=true → no round10 even when global round10=true
    // 25 without round10 → (2[5-9]|[3-9].|\d..) instead of ([2-9].|\d..)
    const result = compile(range(25, undefined, 'количество монстров', undefined, true), { round10: true });
    expect(result).toBe('"(2[5-9]|[3-9].|[0-9]..).*количество монстров"');
  });

  it('compiles RANGE with exact=false (uses global round10)', () => {
    // exact=false → use global round10 (default behavior)
    const result = compile(range(25, undefined, 'количество монстров', undefined, false), { round10: true });
    expect(result).toBe('"([2-9].|[0-9]..).*количество монстров"');
  });

  it('compiles RANGE with exact=true and prefix', () => {
    // Per-token range ≥25 with prefix → precise regex + anchor
    const result = compile(range(25, undefined, 'количество дани', 'даруют увеличенное на', true), { round10: true });
    expect(result).toBe('"даруют увеличенное на (2[5-9]|[3-9].|[0-9]..).*количество дани"');
  });

  it('compiles RANGE with exact=undefined (default, uses global round10)', () => {
    // exact=undefined → same as not providing it (backward compatible)
    const result = compile(range(25, undefined, 'количество монстров'), { round10: true });
    expect(result).toBe('"([2-9].|[0-9]..).*количество монстров"');
  });
});
