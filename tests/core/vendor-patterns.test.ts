import { describe, it, expect } from 'vitest';
import { compile } from '@core/compiler';
import { and, or, literal, exclude, range } from '@core/ast';

/**
 * Focused tests for VendorPage regex compilation patterns.
 *
 * These tests verify that the core AST + compiler produces correct
 * PoE2 regex strings for the vendor use case, where multiple properties
 * are combined via AND/OR/EXCLUDE groups.
 *
 * Each test covers a distinct pattern class:
 * 1. Single property (simple LITERAL)
 * 2. Multiple wanted properties (OR in one quoted group)
 * 3. Multiple excluded properties (EXCLUDE(OR(...)))
 * 4. Mixed wanted + excluded (AND of OR + EXCLUDE(OR))
 * 5. Numeric threshold with suffix (RANGE)
 * 6. Numeric + property (AND of RANGE + LITERAL)
 * 7. Movement speed threshold pattern (literal with .* suffix)
 */
describe('Vendor regex compilation patterns', () => {
  it('single property: quality → "качеств"', () => {
    expect(compile(literal('качеств'))).toBe('"качеств"');
  });

  it('multiple wanted: fire res OR cold res → "огню|холоду"', () => {
    const ast = or(literal('огню'), literal('холоду'));
    expect(compile(ast)).toBe('"огню|холоду"');
  });

  it('multiple excluded: exclude fire res AND cold res → "!огню|холоду"', () => {
    const ast = exclude(or(literal('огню'), literal('холоду')));
    expect(compile(ast)).toBe('"!огню|холоду"');
  });

  it('mixed: want quality, exclude resistances → "качеств" "!огню|холоду|молни|хаосу"', () => {
    const ast = and(
      literal('качеств'),
      exclude(or(literal('огню'), literal('холоду'), literal('молни'), literal('хаосу')))
    );
    expect(compile(ast)).toBe('"качеств" "!огню|холоду|молни|хаосу"');
  });

  it('numeric: item level ≥50 with suffix → number regex with suffix', () => {
    const ast = range(50, undefined, 'уровень предмета');
    expect(compile(ast, { round10: true })).toBe('"([5-9][0-9]|\\d{3,}).*уровень предмета"');
  });

  it('numeric + property: item level ≥50 AND quality', () => {
    const ast = and(
      range(50, undefined, 'уровень предмета'),
      literal('качеств')
    );
    expect(compile(ast, { round10: true })).toBe('"([5-9][0-9]|\\d{3,}).*уровень предмета" "качеств"');
  });

  it('movement speed 30%: literal with .* pattern', () => {
    // This is a special vendor pattern: "30)%.*передвижени"
    expect(compile(literal('30)%.*передвижени'))).toBe('"30)%.*передвижени"');
  });

  it('all 4 resistances OR together: compact output', () => {
    const ast = or(literal('огню'), literal('холоду'), literal('молни'), literal('хаосу'));
    expect(compile(ast)).toBe('"огню|холоду|молни|хаосу"');
  });

  it('item class OR: amulet|ring|belt', () => {
    const ast = or(literal('амулет'), literal('кольц'), literal('пояс'));
    expect(compile(ast)).toBe('"амулет|кольц|пояс"');
  });

  it('complex: want quality + physical damage, exclude chaos res, item level ≥80', () => {
    const ast = and(
      or(literal('качеств'), literal('физическ')),
      exclude(literal('хаосу')),
      range(80, undefined, 'уровень предмета')
    );
    expect(compile(ast, { round10: true })).toBe('"качеств|физическ" "!хаосу" "([8-9][0-9]|\\d{3,}).*уровень предмета"');
  });
});
