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
});
