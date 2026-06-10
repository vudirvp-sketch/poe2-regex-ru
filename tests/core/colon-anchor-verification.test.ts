/**
 * Colon anchor verification tests (T1, T3, and comprehensive coverage).
 *
 * These tests verify that the colon anchor fix (`suffix.*: (number)`) prevents
 * false positives from range notation in non-% reversed mods.
 *
 * In-game verified:
 * - T1: "появляется.*: ([2-9]|[0-9][0-9][0-9]?)" on Abyss Tile with value 1
 *   → NOTHING highlighted → No FP ✓
 * - T3: "х редких с.*: ([3-9]|[0-9][0-9][0-9]?)" on Ritual Tile with value 2
 *   → NOTHING highlighted → No FP ✓
 *
 * The OLD regex (without colon anchor: `suffix.*(number)`) matched secondary
 * numbers in range notation like "1(1-2)" where "2" matches [2-9].
 * The NEW regex with colon anchor (`suffix.*: (number)`) requires the number
 * to appear right after ": " which is where the rolled value sits.
 */
import { describe, it, expect } from 'vitest';
import { matchPoE2RegexItem, type GameItemText } from '@core/poe2-regex-matcher';
import { compile } from '@core/compiler';
import { range, and, literal } from '@core/ast';

// ─── Real tile items from in-game verification ───

/** Возвышенная Плитка Бездны чемпионов — T1: value 1, range [1,2] */
const abyssTileValue1: GameItemText = {
  name: 'Возвышенная Плитка Бездны чемпионов',
  type: 'Плитка',
  mods: [
    'Из Бездн на карте появляется дополнительных редких монстров: 1',
    '12% увеличение количества получаемого опыта на карте',
  ],
  properties: ['Уровень предмета: 65', 'Добавляет Бездны на карту', 'Осталось зарядов - 10'],
};

/** Another copy with value 2 — should MATCH ≥2 filter */
const abyssTileValue2: GameItemText = {
  name: 'Возвышенная Плитка Бездны чемпионов',
  type: 'Плитка',
  mods: [
    'Из Бездн на карте появляется дополнительных редких монстров: 2',
    '15% увеличение количества получаемого опыта на карте',
  ],
  properties: ['Уровень предмета: 74', 'Добавляет Бездны на карту', 'Осталось зарядов - 10'],
};

/** Simulated item with range notation "1(1-2)" — the FP case from in-game testing */
const abyssTileValue1WithRange: GameItemText = {
  name: 'Возвышенная Плитка Бездны чемпионов',
  type: 'Плитка',
  mods: [
    'Из Бездн на карте появляется дополнительных редких монстров: 1(1-2)',
    '12% увеличение количества получаемого опыта на карте',
  ],
  properties: ['Уровень предмета: 65', 'Добавляет Бездны на карту', 'Осталось зарядов - 10'],
};

/** Тревожный суд — T3: value 2, range [2,3] for "дополнительных редких сундуков" */
const ritualTileValue2: GameItemText = {
  name: 'Тревожный суд',
  type: 'Плитка Ритуала',
  mods: [
    'На карте можно встретить дополнительных редких сундуков: 2',
    '30% увеличение количества находимого на карте золота',
    'На карте можно встретить дополнительный алтарь',
    'Монстры, принесенные в жертву на алтарях Ритуала на карте, даруют увеличенное на 23% количество дани',
  ],
  properties: ['Уровень предмета: 80', 'Добавляет алтари Ритуала на карту', 'Осталось зарядов - 9'],
};

/** Tile with value 3 — should MATCH ≥3 filter */
const ritualTileValue3: GameItemText = {
  name: 'Ритуальная Плитка',
  type: 'Плитка Ритуала',
  mods: [
    'На карте можно встретить дополнительных редких сундуков: 3',
    '25% увеличение количества находимого на карте золота',
  ],
  properties: ['Уровень предмета: 80', 'Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
};

/** Simulated T3 item with range notation "2(2-3)" */
const ritualTileValue2WithRange: GameItemText = {
  name: 'Тревожный суд',
  type: 'Плитка Ритуала',
  mods: [
    'На карте можно встретить дополнительных редких сундуков: 2(2-3)',
    '30% увеличение количества находимого на карте золота',
  ],
  properties: ['Уровень предмета: 80', 'Добавляет алтари Ритуала на карту', 'Осталось зарядов - 9'],
};

/** Непостижимое побуждение — T4: "дополнительных свойств: 1" */
const templeTileValue1: GameItemText = {
  name: 'Непостижимое побуждение',
  type: 'Плитка Храма',
  mods: [
    'Уникальные монстры имеют дополнительных свойств: 1',
    '10% увеличение редкости находимых на карте предметов',
    '1 дополнительная группа монстров вокруг маяков ваал на карте',
    '26% увеличение количества редких монстров на карте',
  ],
  properties: ['Уровень предмета: 80', 'Добавляет маяки ваал на карту', 'Осталось зарядов - 2'],
};

/** Космический мандат — T4: "дополнительных духов азмири: 1" */
const ritualTileAzmeri1: GameItemText = {
  name: 'Космический мандат',
  type: 'Плитка Ритуала',
  mods: [
    '12% увеличение эффективности монстров',
    'На карте можно встретить дополнительный алтарь',
    'Отложенные награды в адтарях Ритуала на карте появляются снова на 28% быстрее',
    'На карте можно встретить дополнительных духов азмири: 1',
  ],
  properties: ['Уровень предмета: 80', 'Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
};

// ─── T1: "дополнительных редких монстров" ≥2 on Abyss Tile ───

describe('T1: Colon anchor verification — "дополнительных редких монстров" ≥2', () => {
  // NEW regex WITH colon anchor (the fix)
  const newRegex = '"появляется.*: ([2-9]|[0-9][0-9][0-9]?)"';
  // OLD regex WITHOUT colon anchor (the FP version)
  const oldRegex = '"появляется.*([2-9]|[0-9][0-9][0-9]?)"';

  it('NEW regex does NOT match tile with value 1 (no FP)', () => {
    expect(matchPoE2RegexItem(newRegex, abyssTileValue1)).toBe(false);
  });

  it('NEW regex does NOT match tile with value 1 and range notation 1(1-2) (no FP)', () => {
    // This was the original FP case: "2" in "(1-2)" matched the old regex
    expect(matchPoE2RegexItem(newRegex, abyssTileValue1WithRange)).toBe(false);
  });

  it('NEW regex DOES match tile with value 2 (correct match)', () => {
    expect(matchPoE2RegexItem(newRegex, abyssTileValue2)).toBe(true);
  });

  it('OLD regex DOES match tile with value 1 and range notation 1(1-2) (FP — the bug)', () => {
    // The old regex without colon anchor matches "2" from "(1-2)" range notation
    expect(matchPoE2RegexItem(oldRegex, abyssTileValue1WithRange)).toBe(true);
  });

  it('OLD regex does NOT match tile with value 1 without range notation', () => {
    // Without range notation, "1" doesn't match [2-9] — both versions agree
    expect(matchPoE2RegexItem(oldRegex, abyssTileValue1)).toBe(false);
  });
});

// ─── T3: "дополнительных редких сундуков" ≥3 on Ritual Tile ───

describe('T3: Colon anchor verification — "дополнительных редких сундуков" ≥3', () => {
  const newRegex = '"х редких с.*: ([3-9]|[0-9][0-9][0-9]?)"';
  const oldRegex = '"х редких с.*([3-9]|[0-9][0-9][0-9]?)"';

  it('NEW regex does NOT match tile with value 2 (no FP)', () => {
    expect(matchPoE2RegexItem(newRegex, ritualTileValue2)).toBe(false);
  });

  it('NEW regex does NOT match tile with value 2 and range notation 2(2-3) (no FP)', () => {
    expect(matchPoE2RegexItem(newRegex, ritualTileValue2WithRange)).toBe(false);
  });

  it('NEW regex DOES match tile with value 3 (correct match)', () => {
    expect(matchPoE2RegexItem(newRegex, ritualTileValue3)).toBe(true);
  });

  it('OLD regex DOES match tile with value 2 and range notation 2(2-3) (FP — the bug)', () => {
    // The old regex matches "3" from "(2-3)" range notation
    expect(matchPoE2RegexItem(oldRegex, ritualTileValue2WithRange)).toBe(true);
  });

  it('OLD regex does NOT match tile with value 2 without range notation', () => {
    expect(matchPoE2RegexItem(oldRegex, ritualTileValue2)).toBe(false);
  });
});

// ─── T2/T4: Other non-% colon-terminated mods (should work with colon anchor) ───

describe('T2/T4: Other non-% mods with colon anchor', () => {
  it('T2: "дополнительных свойств: 1" — ≥2 should NOT match value 1', () => {
    // Template: "Уникальные монстры имеют дополнительных свойств: #"
    // Range: [1] only, so ≥2 would never match value 1
    const regex = '"уникальные.*: ([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, templeTileValue1)).toBe(false);
  });

  it('T4: "дополнительных духов азмири: 1" — ≥2 should NOT match value 1', () => {
    // Template: "На карте можно встретить дополнительных духов азмири: #"
    // Range: [1] only, so ≥2 would never match value 1
    const regex = '"ьных духов.*: ([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, ritualTileAzmeri1)).toBe(false);
  });
});

// ─── Compiler integration: Verify colonAnchor flag produces correct regex ───

describe('Compiler: colonAnchor produces "suffix.*: number" pattern', () => {
  it('RANGE(min=2, suffix="появления", reversed=true, colonAnchor=true) includes ": " before number', () => {
    const ast = range(2, undefined, 'появляется', undefined, undefined, undefined, undefined, true, true);
    // round10=false to preserve exact min value
    const regex = compile(ast, { round10: false });
    expect(regex).toContain('появляется.*: ');
    expect(regex).toContain('[2-9]');
  });

  it('RANGE(min=2, suffix="появляется", reversed=true, colonAnchor=false) does NOT include ": " before number', () => {
    const ast = range(2, undefined, 'появляется', undefined, undefined, undefined, undefined, true, false);
    const regex = compile(ast);
    expect(regex).toContain('появляется.*');
    expect(regex).not.toContain('появляется.*: ');
  });

  it('RANGE(min=3, suffix="х редких с", reversed=true, colonAnchor=true) includes ": " before number', () => {
    const ast = range(3, undefined, 'х редких с', undefined, undefined, undefined, undefined, true, true);
    // round10=false to preserve exact min value
    const regex = compile(ast, { round10: false });
    expect(regex).toContain('х редких с.*: ');
    expect(regex).toContain('[3-9]');
  });

  it('Enumerated range with colonAnchor includes ": " before enumerated numbers', () => {
    // RANGE(2, 3, suffix, reversed, colonAnchor) → enumerated: (2|3) with colon
    const ast = range(2, 3, 'появляется', undefined, undefined, undefined, undefined, true, true);
    const regex = compile(ast);
    expect(regex).toContain('появляется.*: ');
    expect(regex).toContain('2');
    expect(regex).toContain('3');
  });

  it('Non-reversed range does NOT get colon anchor even if colonAnchor=true', () => {
    // colonAnchor only applies to reversed ranges (number at end)
    const ast = range(2, undefined, 'сопротивлен', undefined, undefined, undefined, undefined, false, true);
    const regex = compile(ast);
    expect(regex).not.toContain(': ');
    // Should be "([2-9]...)сопротивлен" or similar (number before suffix)
  });
});
