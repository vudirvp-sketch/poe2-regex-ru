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
    expect(result).toBe('"([4-9].|\\d..).*m q"');
  });

  it('compiles AND of RANGE and LITERAL', () => {
    const result = compile(and(range(40, undefined, 'm q'), literal('corr')), { round10: true });
    expect(result).toBe('"([4-9].|\\d..).*m q" "corr"');
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
    expect(result).toBe('"огн|хол" "!проклят" "([4-9].|\\d..).*путев"');
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
    expect(result).toBe('"([4-9].|\\d..).*m q" "([0-9]|[1-7].|80).*m q"');
  });

  it('compiles RANGE with both min and max (1-digit)', () => {
    // range(3, 7) → AND(≥3, ≤7) → two AND-joined quoted groups (no suffix)
    const result = compile(range(3, 7), { round10: false });
    expect(result).toBe('"([3-9]|\\d..?)" "([0-7])"');
  });

  it('compiles RANGE with both min and max inside AND', () => {
    // AND(literal('огн'), range(40, 80, 'm q')) → three AND-joined quoted groups
    const result = compile(
      and(literal('огн'), range(40, 80, 'm q')),
      { round10: true }
    );
    expect(result).toBe('"огн" "([4-9].|\\d..).*m q" "([0-9]|[1-7].|80).*m q"');
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
});
