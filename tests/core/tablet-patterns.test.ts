/**
 * TabletPage regex pattern tests.
 *
 * These tests verify that the AST → regex compilation produces correct
 * in-game search strings for tablet-specific filters:
 *
 * - Type filter: Бездна/Делириум/Ритуал/Ваал → LITERAL regex substrings
 * - Rarity filter: Обычный/Волшебный/Редкий → LITERAL regex substrings
 * - Uses remaining: ≥N → RANGE(min, undefined, 'использ') → number regex + suffix
 *
 * In the Russian PoE2 client:
 * - Tablet names contain the type: "Башня Бездны Предтеч", "Башня Делириума Предтеч"
 * - Rarity tags: "Обычный", "Волшебный", "Редкий"
 * - Uses counter: "Осталось использований: N"
 *
 * The regex dialect uses: | for OR, "" for AND groups, .* for same-mod number+suffix,
 * and ! for NOT. All patterns must be case-insensitive (verified in-game).
 */
import { describe, it, expect } from 'vitest';
import { compile } from '@core/compiler';
import { and, or, exclude, literal, range } from '@core/ast';

// ─── Tablet type regex patterns ───

describe('Tablet type regex patterns', () => {
  it('Бездна (Breach) → "бездн" matches "Башня Бездны Предтеч"', () => {
    // "бездн" is the shortest unique substring of "Бездны" in the tablet name
    const result = compile(literal('бездн'));
    expect(result).toBe('"бездн"');
    // In-game: typing "бездн" in search highlights tablets of Бездна type
  });

  it('Делириум (Delirium) → "делир" matches "Башня Делириума Предтеч"', () => {
    const result = compile(literal('делир'));
    expect(result).toBe('"делир"');
  });

  it('Ритуал (Ritual) → "ритуал" matches "Башня Ритуала Предтеч"', () => {
    const result = compile(literal('ритуал'));
    expect(result).toBe('"ритуал"');
  });

  it('Ваал (Vaal) → "ваал" matches "Башня Ваал Предтеч"', () => {
    const result = compile(literal('ваал'));
    expect(result).toBe('"ваал"');
  });

  it('Multiple types OR together: Бездна OR Делириум', () => {
    // When selecting both Бездна and Делириум, tablet can be either type
    const result = compile(or(literal('бездн'), literal('делир')));
    expect(result).toBe('"бездн|делир"');
    // In-game: matches tablets of either type
  });

  it('All four types OR together', () => {
    const result = compile(or(literal('бездн'), literal('делир'), literal('ритуал'), literal('ваал')));
    expect(result).toBe('"бездн|делир|ритуал|ваал"');
  });
});

// ─── Tablet rarity regex patterns ───

describe('Tablet rarity regex patterns', () => {
  it('Обычный (Normal) → "обычн" matches rarity tag', () => {
    const result = compile(literal('обычн'));
    expect(result).toBe('"обычн"');
  });

  it('Волшебный (Magic) → "волшебн" matches rarity tag', () => {
    const result = compile(literal('волшебн'));
    expect(result).toBe('"волшебн"');
  });

  it('Редкий (Rare) → "редк" matches rarity tag', () => {
    // Редкий rarity was missing in initial implementation — now added
    const result = compile(literal('редк'));
    expect(result).toBe('"редк"');
  });

  it('Обычный OR Волшебный → matches non-rare tablets', () => {
    const result = compile(or(literal('обычн'), literal('волшебн')));
    expect(result).toBe('"обычн|волшебн"');
  });
});

// ─── Tablet uses remaining regex patterns ───

describe('Tablet uses remaining regex patterns', () => {
  it('≥5 uses → RANGE(5, undefined, "использ") compiles to number regex + suffix', () => {
    // "Осталось использований: 5" → need ≥5
    // RANGE node: min=5, suffix="использ"
    // generateNumberRegex(5, false) → ([5-9]|\d{2,}) — matches 5-9 or 10+ (using \d{2,} instead of [0-9][0-9][0-9]? since ? is unsupported)
    const result = compile(range(5, undefined, 'использ'), { round10: false });
    expect(result).toBe('"([5-9]|\\d{2,}).*использ"');
  });

  it('≥10 uses → RANGE(10, undefined, "использ") compiles correctly', () => {
    const result = compile(range(10, undefined, 'использ'), { round10: false });
    // Two-digit: 10 → (1[0-9]|[2-9][0-9]|\d[0-9][0-9]) — matches 10-99 or 100+
    expect(result).toContain('использ"');
    expect(result.length).toBeLessThan(250); // Must fit in 250 char limit
  });

  it('≥19 uses (temple tablets) → RANGE(19, undefined, "использ") compiles', () => {
    // Temple tablets can have 19+ charges — max uses >18 is possible
    const result = compile(range(19, undefined, 'использ'), { round10: false });
    expect(result).toContain('использ"');
    expect(result.length).toBeLessThan(250);
  });
});

// ─── Combined tablet filter patterns ───

describe('Combined tablet filter patterns', () => {
  it('Type + Rarity + Uses: Бездна AND Обычный AND ≥5 uses', () => {
    // Typical use case: find normal rarity Бездна tablets with ≥5 uses remaining
    const result = compile(
      and(
        literal('бездн'),     // type: Бездна
        literal('обычн'),     // rarity: Обычный
        range(5, undefined, 'использ')  // ≥5 uses remaining
      ),
      { round10: false }
    );
    expect(result).toContain('бездн');
    expect(result).toContain('обычн');
    expect(result).toContain('использ');
    // Result format: "бездн" "обычн" "([5-9]|\d[0-9][0-9]).*использ"
    expect(result).toMatch(/"бездн"\s+"обычн"\s+".*использ"/);
  });

  it('Type OR + Rarity: (Бездна|Делириум) AND Редкий', () => {
    // Find rare tablets of either Бездна or Делириум type
    const result = compile(
      and(
        or(literal('бездн'), literal('делир')),
        literal('редк')
      )
    );
    expect(result).toBe('"бездн|делир" "редк"');
  });

  it('Exclude type: NOT Бездна AND NOT Ваал', () => {
    // Find tablets that are NOT Бездна and NOT Ваal
    const result = compile(
      and(
        exclude(or(literal('бездн'), literal('ваал')))
      )
    );
    // EXCLUDE(OR) compiles to "!бездн|ваал" — excludes items matching either
    expect(result).toBe('"!бездн|ваал"');
  });

  it('Type + Uses: Ритуал AND ≥10 uses', () => {
    const result = compile(
      and(
        literal('ритуал'),
        range(10, undefined, 'использ')
      ),
      { round10: false }
    );
    expect(result).toContain('ритуал');
    expect(result).toContain('использ');
  });
});
