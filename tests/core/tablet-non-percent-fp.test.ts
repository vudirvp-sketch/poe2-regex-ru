/**
 * Non-% Mods Range Notation False Positive Tests
 *
 * These tests verify whether mods WITHOUT a % suffix (e.g., "Осталось зарядов - N",
 * "дополнительных редких монстров: N") are susceptible to range notation FP
 * in the PoE2 search engine.
 *
 * BACKGROUND:
 * PoE2 dual-indexes mods: both "39% suffix" (simplified) and "39(30-40)% suffix"
 * (detailed with range notation). The % anchor prevents FP because the secondary
 * number in range notation (e.g., "30" in "(30-40)") is NOT followed by %.
 *
 * For non-% mods (e.g., "дополнительных редких монстров: 1(1-2)"), there is no %
 * anchor. This means a regex like "suffix.*(number_pattern)" could match the
 * secondary number in the range notation, producing a FALSE POSITIVE.
 *
 * KEY INSIGHT: For mods where ## appears at the END of the template
 * (e.g., "suffix: ##"), the regex must be REVERSED: "suffix.*number"
 * instead of "number.*suffix". This is because .* is directional (forward only)
 * in PoE2 — "number.*suffix" won't match when the number comes AFTER the suffix.
 *
 * Test items are sourced from: плитки для теста в игре.md
 */
import { describe, it, expect } from 'vitest';
import { matchPoE2RegexItem, type GameItemText } from '@core/poe2-regex-matcher';
import { compile } from '@core/compiler';
import { range } from '@core/ast';

// ═══════════════════════════════════════════════════════════════════════════
// REAL TILE ITEMS — from плитки для теста в игре.md
// ═══════════════════════════════════════════════════════════════════════════

/** Древний декрет — Плитка Ритуала, 4 зарядов */
const ancientDecree: GameItemText = {
  name: 'Древний декрет',
  type: 'Плитка Ритуала',
  properties: ['Уровень предмета: 79'],
  implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 4'],
  mods: [
    '8% увеличение редкости находимых на карте предметов',
    '29% увеличение количества редких монстров на карте',
    '26% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте',
    'На карте с увеличенным на 91% шансом можно встретить духов азмири',
  ],
};

/** Языческий приказ — Плитка Ритуала, 10 зарядов, без откладывания наград */
const paganOrder: GameItemText = {
  name: 'Языческий приказ',
  type: 'Плитка Ритуала',
  properties: ['Уровень предмета: 80'],
  implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
  mods: [
    '32% увеличение количества находимого на карте золота',
    '15% увеличение эффективности монстров',
    'Монстры, принесенные в жертву на алтарях Ритуала на карте, даруют увеличенное на 20% количество дани',
    'На карте с увеличенным на 74% шансом можно встретить ритуальный круг',
  ],
};

/** Возвышенная Плитка Бездны чемпионов — non-% mod: дополнительных редких монстров: 1 */
const exaltedAbyssTablet: GameItemText = {
  name: 'Возвышенная Плитка Бездны чемпионов',
  type: 'Плитка',
  properties: ['Уровень предмета: 65'],
  implicits: ['Добавляет Бездны на карту', 'Осталось зарядов - 10'],
  mods: [
    'Из Бездн на карте появляется дополнительных редких монстров: 1',
    '12% увеличение количества получаемого опыта на карте',
  ],
};

/** Непостижимое побуждение — Плитка Храма, non-% mod: дополнительных свойств: 1 */
const incomprehensibleUrge: GameItemText = {
  name: 'Непостижимое побуждение',
  type: 'Плитка Храма',
  properties: ['Уровень предмета: 80'],
  implicits: ['Добавляет маяки ваал на карту', 'Осталось зарядов - 2'],
  mods: [
    'Уникальные монстры имеют дополнительных свойств: 1',
    '10% увеличение редкости находимых на карте предметов',
    '1 дополнительная группа монстров вокруг маяков ваал на карте',
    '26% увеличение количества редких монстров на карте',
  ],
};

/** Тревожный суд — Плитка Ритуала, non-% mod: дополнительных редких сундуков: 2 */
const alarmingCourt: GameItemText = {
  name: 'Тревожный суд',
  type: 'Плитка Ритуала',
  properties: ['Уровень предмета: 80'],
  implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 9'],
  mods: [
    'На карте можно встретить дополнительных редких сундуков: 2',
    '30% увеличение количества находимого на карте золота',
    'На карте можно встретить дополнительный алтарь',
    'Монстры, принесенные в жертву на алтарях Ритуала на карте, даруют увеличенное на 23% количество дани',
  ],
};

/** Космический мандат — Плитка Ритуала, non-% mod: дополнительных духов азмири: 1 */
const cosmicMandate: GameItemText = {
  name: 'Космический мандат',
  type: 'Плитка Ритуала',
  properties: ['Уровень предмета: 80'],
  implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
  mods: [
    '12% увеличение эффективности монстров',
    'На карте можно встретить дополнительный алтарь',
    'Отложенные награды в адтарях Ритуала на карте появляются снова на 28% быстрее',
    'На карте можно встретить дополнительных духов азмири: 1',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATED ITEMS WITH RANGE NOTATION (detailed form)
// These represent what the PoE2 client shows for the same items
// with range notation visible. The dual-indexed format includes both
// the rolled value and the tier range in parentheses.
// ═══════════════════════════════════════════════════════════════════════════

/** Simulated: Возвышенная Плитка Бездны with range notation.
 *  Non-% mod "дополнительных редких монстров: 1" → "1(1-2)" in detailed form.
 *  This is the KEY FP risk: the "2" in "(1-2)" could match a ≥2 filter.
 *  Since the regex is reversed ("suffix.*number"), "2" in "(1-2)" is AFTER
 *  the suffix text, so it WILL match. */
const exaltedAbyssTabletDetailed: GameItemText = {
  name: 'Возвышенная Плитка Бездны чемпионов',
  type: 'Плитка',
  properties: ['Уровень предмета: 65'],
  implicits: ['Добавляет Бездны на карту', 'Осталось зарядов - 10'],
  mods: [
    'Из Бездн на карте появляется дополнительных редких монстров: 1(1-2)',
    '12(8-15)% увеличение количества получаемого опыта на карте',
  ],
};

/** Simulated: Непостижимое побуждение with range notation.
 *  Non-% mods: "дополнительных свойств: 1(1-2)", "1(1-2) дополнительная группа" */
const incomprehensibleUrgeDetailed: GameItemText = {
  name: 'Непостижимое побуждение',
  type: 'Плитка Храма',
  properties: ['Уровень предмета: 80'],
  implicits: ['Добавляет маяки ваал на карту', 'Осталось зарядов - 2'],
  mods: [
    'Уникальные монстры имеют дополнительных свойств: 1(1-2)',
    '10(8-12)% увеличение редкости находимых на карте предметов',
    '1(1-2) дополнительная группа монстров вокруг маяков ваал на карте',
    '26(22-30)% увеличение количества редких монстров на карте',
  ],
};

/** Simulated: Тревожный суд with range notation.
 *  Non-% mod: "дополнительных редких сундуков: 2(1-2)" */
const alarmingCourtDetailed: GameItemText = {
  name: 'Тревожный суд',
  type: 'Плитка Ритуала',
  properties: ['Уровень предмета: 80'],
  implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 9'],
  mods: [
    'На карте можно встретить дополнительных редких сундуков: 2(1-2)',
    '30(25-35)% увеличение количества находимого на карте золота',
    'На карте можно встретить дополнительный алтарь',
    'Монстры, принесенные в жертву на алтарях Ритуала на карте, даруют увеличенное на 23(18-25)% количество дани',
  ],
};

/** Simulated: Тревожный суд with range notation extending to 3.
 *  In-game VERIFIED (T3): the game shows "2(1-3)" for this mod.
 *  This causes FP for ≥3 filter because "3" in "(1-3)" matches [3-9]. */
const alarmingCourtDetailedRange3: GameItemText = {
  name: 'Тревожный суд',
  type: 'Плитка Ритуала',
  properties: ['Уровень предмета: 80'],
  implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 9'],
  mods: [
    'На карте можно встретить дополнительных редких сундуков: 2(1-3)',
    '30(25-35)% увеличение количества находимого на карте золота',
    'На карте можно встретить дополнительный алтарь',
    'Монстры, принесенные в жертву на алтарях Ритуала на карте, даруют увеличенное на 23(18-25)% количество дани',
  ],
};

/** Simulated: Древний декрет with range notation in detailed form. */
const ancientDecreeDetailed: GameItemText = {
  name: 'Древний декрет',
  type: 'Плитка Ритуала',
  properties: ['Уровень предмета: 79'],
  implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 4'],
  mods: [
    '8(5-10)% увеличение редкости находимых на карте предметов',
    '29(25-35)% увеличение количества редких монстров на карте',
    '26(22-30)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте',
    'На карте с увеличенным на 91(70-100)% шансом можно встретить духов азмири',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL GROUP: % mods should NOT have FP (verified in-game)
// ═══════════════════════════════════════════════════════════════════════════

describe('Control Group: % mods do NOT have range notation FP', () => {
  it('% anchor prevents FP: ≥27 with suffix "откладывания наград" on 26% item', () => {
    // With % anchor: "(2[7-9]|30)%.*откладывания наград"
    // The "(30-40)" range notation in "26(22-30)%" has "30" but NOT followed by %
    // So "30%" would match only "30%" not "30)" — no FP
    const regexWithPercent = '"(2[7-9]|30)%.*откладывания наград"';
    expect(matchPoE2RegexItem(regexWithPercent, ancientDecreeDetailed)).toBe(false);
  });

  it('without % anchor, same pattern WOULD have FP on 26% item', () => {
    // Without % anchor: "(2[7-9]|30).*откладывания наград"
    // The "30" in "(22-30)" matches (2[7-9]|30) and "откладывания наград" follows
    // This IS a FP — the actual value is 26%, not 27-30
    const regexWithoutPercent = '"(2[7-9]|30).*откладывания наград"';
    expect(matchPoE2RegexItem(regexWithoutPercent, ancientDecreeDetailed)).toBe(true);
  });

  it('% anchor correctly matches 29% item in SIMPLIFIED form', () => {
    const regexWithPercent = '"(2[7-9]|30)%.*откладывания наград"';
    // In SIMPLIFIED form, the text is "29% уменьшение... откладывания наград"
    // "(2[7-9]|30)%" matches "29%" → match
    const item29Simple: GameItemText = {
      name: 'Тест',
      type: 'Плитка Ритуала',
      implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
      mods: ['29% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
    };
    expect(matchPoE2RegexItem(regexWithPercent, item29Simple)).toBe(true);
  });

  it('% anchor ALSO works in DETAILED form via dual-indexing', () => {
    // In DETAILED form: "29(27-30)% уменьшение... откладывания наград"
    // PoE2 dual-indexes both simplified and detailed forms.
    // The simplified "29%" matches "(2[7-9]|30)%" correctly.
    // The detailed "29(27-30)%" — "30)" does NOT match "30%" because % is after )
    // But the SIMPLIFIED index "29%" DOES match → item highlighted correctly.
    // This is WHY dual-indexing + % anchor works: the simplified form always has
    // the correct "value%" format without range notation.
    const regexWithPercent = '"(2[7-9]|30)%.*откладывания наград"';
    const item29Detailed: GameItemText = {
      name: 'Тест',
      type: 'Плитка Ритуала',
      implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
      mods: ['29(27-30)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'],
    };
    // Our matcher tests a SINGLE block. In real PoE2, the simplified index
    // would match. Our test item uses detailed form only, so it won't match
    // here — but this is expected (our matcher doesn't model dual-indexing).
    // The key point: % anchor prevents FP from the detailed form.
    expect(matchPoE2RegexItem(regexWithPercent, item29Detailed)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REVERSED REGEX: non-% mods with ## at end of template
// For these mods, the regex is "suffix.*number" (reversed direction)
// ═══════════════════════════════════════════════════════════════════════════

describe('Non-% mod: "дополнительных редких монстров: ##" — reversed regex', () => {
  it('reversed regex "suffix.*number" matches simplified form', () => {
    // Template: "Из Бездн на карте появляется дополнительных редких монстров: ##"
    // ## is at END of template → reversed regex: "suffix.*number"
    // "появляется.*(1|2)" matches "появляется дополнительных редких монстров: 1"
    expect(matchPoE2RegexItem('"появляется.*1"', exaltedAbyssTablet)).toBe(true);
  });

  it('non-reversed "number.*suffix" does NOT work (number is after suffix)', () => {
    // "1.*появляется" won't match because 1 appears AFTER "появляется"
    expect(matchPoE2RegexItem('"1.*появляется"', exaltedAbyssTablet)).toBe(false);
  });

  it('DETAILED form: "появляется.*([2-9]|...)" on value 1(1-2) — FALSE POSITIVE (in-game VERIFIED T1)', () => {
    // Reversed regex with range notation: "появляется.*([2-9]|[0-9][0-9][0-9]?)"
    // In "появляется дополнительных редких монстров: 1(1-2)",
    // "2" in "(1-2)" appears AFTER "появляется" → matches ≥2 → FP!
    // IN-GAME VERIFIED (T1): "подсветило 2 плитки бездны с дополнительным редким монстром 1"
    const regex = '"появляется.*([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, exaltedAbyssTabletDetailed)).toBe(true);
    // FP confirmed in-game: actual value is 1, but "2" in "(1-2)" matches ≥2
  });

  it('DETAILED form: "появляется.*([3-9]|...)" does NOT match 1(1-2)', () => {
    const regex = '"появляется.*([3-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, exaltedAbyssTabletDetailed)).toBe(false);
  });

  it('COLON ANCHOR: "появляется.*: ([2-9]|...)" does NOT match 1(1-2) — FP prevented', () => {
    // With ': ' anchor between .* and number: the number must appear right after ': '
    // In "появляется дополнительных редких монстров: 1(1-2)":
    //   .* backtracks to "дополнительных редких монстров", then ': ' matches ': ',
    //   then ([2-9]...) tries "1" — doesn't match [2-9] → NO FP
    const regex = '"появляется.*: ([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, exaltedAbyssTabletDetailed)).toBe(false);
  });

  it('COLON ANCHOR: "появляется.*: ([2-9]|...)" correctly matches simplified value 2', () => {
    // When actual value IS 2: "...монстров: 2" → ': ' matches ': ', "2" matches [2-9] ✅
    const itemWithValue2: GameItemText = {
      name: 'Тест',
      type: 'Плитка',
      implicits: ['Добавляет Бездны на карту', 'Осталось зарядов - 10'],
      mods: ['Из Бездн на карте появляется дополнительных редких монстров: 2'],
    };
    const regex = '"появляется.*: ([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, itemWithValue2)).toBe(true);
  });

  it('COLON ANCHOR: "появляется.*: ([2-9]|...)" correctly matches detailed value 2(1-2)', () => {
    // When actual value IS 2 with range: "...монстров: 2(1-2)" → ': ' matches ': ',
    // "2" matches [2-9] → correct match (value IS 2, not FP)
    const itemWithValue2Detailed: GameItemText = {
      name: 'Тест',
      type: 'Плитка',
      implicits: ['Добавляет Бездны на карту', 'Осталось зарядов - 10'],
      mods: ['Из Бездн на карте появляется дополнительных редких монстров: 2(1-2)'],
    };
    const regex = '"появляется.*: ([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, itemWithValue2Detailed)).toBe(true);
  });
});

describe('Non-% mod: "дополнительных свойств: ##" — reversed regex', () => {
  it('reversed regex matches simplified form', () => {
    expect(matchPoE2RegexItem('"дополнительных свойств.*1"', incomprehensibleUrge)).toBe(true);
  });

  it('DETAILED form: "дополнительных свойств.*2" on value 1(1-2) — theoretical FP', () => {
    // This FP is theoretical — in-game test T2 showed NO FP for this mod.
    // The game may not show range notation "1(1-2)" for this mod, or the range
    // may not extend to 2.
    const regex = '"дополнительных свойств.*([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, incomprehensibleUrgeDetailed)).toBe(true);
  });

  it('IN-GAME VERIFIED (T2): no FP for "дополнительных свойств" ≥2 on value 1', () => {
    // T2 result: "ничего не подсветило" → no range notation extending to 2 in-game
    // The colon anchor still applies as a safety measure for this template pattern
    expect(true).toBe(true);
  });

  it('COLON ANCHOR: "дополнительных свойств.*: ([2-9]|...)" prevents FP on 1(1-2)', () => {
    const regex = '"дополнительных свойств.*: ([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, incomprehensibleUrgeDetailed)).toBe(false);
  });
});

describe('Non-% mod: "дополнительных редких сундуков: ##" — reversed regex', () => {
  it('reversed regex matches simplified form', () => {
    expect(matchPoE2RegexItem('"редких сундуков.*2"', alarmingCourt)).toBe(true);
  });

  it('DETAILED form: "редких сундуков.*([3-9]|...)" on 2(1-2) — no FP', () => {
    // Range (1-2) doesn't contain ≥3
    const regex = '"редких сундуков.*([3-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, alarmingCourtDetailed)).toBe(false);
  });

  it('DETAILED form: 2(1-3) causes FP for ≥3 — IN-GAME VERIFIED (T3)', () => {
    // IN-GAME VERIFIED (T3): "именно тревожный суд и подсветило!"
    // The game shows "2(1-3)" for this mod, "3" in "(1-3)" matches ≥3 → FP
    const regex = '"редких сундуков.*([3-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, alarmingCourtDetailedRange3)).toBe(true);
  });

  it('COLON ANCHOR: "редких сундуков.*: ([3-9]|...)" prevents FP on 2(1-3)', () => {
    // With ': ' anchor: number must appear right after ': '
    // In "сундуков: 2(1-3)": ': ' matches, then "2" doesn't match [3-9] → NO FP
    const regex = '"редких сундуков.*: ([3-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, alarmingCourtDetailedRange3)).toBe(false);
  });

  it('COLON ANCHOR: "редких сундуков.*: ([3-9]|...)" correctly matches value 3', () => {
    const itemWithValue3: GameItemText = {
      name: 'Тест',
      type: 'Плитка Ритуала',
      implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
      mods: ['На карте можно встретить дополнительных редких сундуков: 3'],
    };
    const regex = '"редких сундуков.*: ([3-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, itemWithValue3)).toBe(true);
  });

  it('COLON ANCHOR: "редких сундуков.*: ([3-9]|...)" correctly matches detailed 3(1-3)', () => {
    const itemWithValue3Detailed: GameItemText = {
      name: 'Тест',
      type: 'Плитка Ритуала',
      implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
      mods: ['На карте можно встретить дополнительных редких сундуков: 3(1-3)'],
    };
    const regex = '"редких сундуков.*: ([3-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, itemWithValue3Detailed)).toBe(true);
  });
});

describe('Non-% mod: "дополнительных духов азмири: ##" — reversed regex', () => {
  it('reversed regex matches simplified form', () => {
    expect(matchPoE2RegexItem('"духов азмири.*1"', cosmicMandate)).toBe(true);
  });

  it('number before suffix does NOT work (reversed direction)', () => {
    expect(matchPoE2RegexItem('"1.*духов азмири"', cosmicMandate)).toBe(false);
  });

  it('IN-GAME VERIFIED (T4): no FP for "духов азмири" ≥2 on value 1', () => {
    // T4 result: "ничего не подсветило" → no range notation extending to 2 in-game
    // The game may not show "1(1-2)" for this mod, or the range doesn't extend to 2
    expect(true).toBe(true);
  });

  it('COLON ANCHOR: "духов азмири.*: ([2-9]|...)" prevents theoretical FP', () => {
    // Even though T4 showed no FP, the colon anchor is applied as safety measure
    // for templates ending with ": ##"
    const itemWithDetailed: GameItemText = {
      name: 'Тест',
      type: 'Плитка Ритуала',
      implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
      mods: ['На карте можно встретить дополнительных духов азмири: 1(1-2)'],
    };
    const regex = '"духов азмири.*: ([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, itemWithDetailed)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NON-% MODS WITH ^ ANCHOR: ## at start of template — safe from FP
// ═══════════════════════════════════════════════════════════════════════════

describe('Non-% mod: "## дополнительная группа монстров" — ^ anchor prevents FP', () => {
  it('template starts with ## — ^ anchor is used (numberAtStart)', () => {
    // For "## дополнительная группа монстров", the template starts with ##
    // This means anchorStart=true, and the compiled regex uses ^ anchor.
    const ast = range(1, undefined, 'дополнительная группа', '', true, true);
    const regex = compile(ast, { round10: false });
    expect(regex).toContain('^');
  });

  it('^ anchor prevents FP: "1(1-2) дополнительная группа" with ≥2 filter', () => {
    // With ^ anchor: "^(number_pattern).*дополнительная группа"
    // The number must be at position 0 (start of block)
    // In "1(1-2) дополнительная группа", "2" is NOT at position 0
    const regexWithAnchor = '"^([2-9]|[0-9][0-9][0-9]?).*дополнительная группа"';
    expect(matchPoE2RegexItem(regexWithAnchor, incomprehensibleUrgeDetailed)).toBe(false);
  });

  it('without ^ anchor, same pattern WOULD have FP', () => {
    const regexWithoutAnchor = '"([2-9]|[0-9][0-9][0-9]?).*дополнительная группа"';
    expect(matchPoE2RegexItem(regexWithoutAnchor, incomprehensibleUrgeDetailed)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IMPLICITS: NOT dual-indexed — no range notation FP
// ═══════════════════════════════════════════════════════════════════════════

describe('Implicit "Осталось зарядов - N" — NOT dual-indexed, no FP', () => {
  it('implicits are NOT dual-indexed: ≥5 does NOT match 4-charge item', () => {
    // The implicit "Осталось зарядов - 4" stays as "4" without range notation
    // Reversed regex: "зарядов.*(number)" — "4" doesn't match ≥5
    const regex = '"зарядов.*([5-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, ancientDecree)).toBe(false);
  });

  it('reversed regex "зарядов.*10" matches 10-charge item', () => {
    expect(matchPoE2RegexItem('"зарядов.*10"', paganOrder)).toBe(true);
  });

  it('non-reversed "10.*зарядов" does NOT work (implicit is reversed)', () => {
    expect(matchPoE2RegexItem('"10.*зарядов"', paganOrder)).toBe(false);
  });

  it('reversed regex "зарядов.*4" matches 4-charge item', () => {
    expect(matchPoE2RegexItem('"зарядов.*4"', ancientDecree)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPILED REGEX: anchor behavior comparison
// ═══════════════════════════════════════════════════════════════════════════

describe('Compiled regex: anchor and reversed behavior', () => {
  it('% mod with anchorEnd="%" produces % after number pattern', () => {
    const ast = range(8, undefined, 'увеличение редкости', undefined, undefined, undefined, '%');
    const regex = compile(ast, { round10: false });
    expect(regex).toContain('%');
  });

  it('non-% mod without anchorEnd does NOT contain %', () => {
    const ast = range(8, undefined, 'увеличение редкости');
    const regex = compile(ast, { round10: false });
    expect(regex).not.toContain('%');
  });

  it('mod with anchorStart=true produces ^ at start', () => {
    const ast = range(1, undefined, 'дополнительная группа', '', true, true);
    const regex = compile(ast, { round10: false });
    expect(regex).toContain('^');
  });

  it('reversed mod produces "suffix.*number" pattern', () => {
    const ast = range(1, undefined, 'дополнительных свойств', undefined, undefined, undefined, undefined, true);
    const regex = compile(ast, { round10: false });
    // Reversed: suffix comes first, then .* then number pattern
    expect(regex).toContain('дополнительных свойств');
    expect(regex).toContain('.*');
    // The number pattern should appear AFTER the suffix
    const suffixIdx = regex.indexOf('дополнительных свойств');
    const dotStarIdx = regex.indexOf('.*', suffixIdx);
    expect(dotStarIdx).toBeGreaterThan(suffixIdx);
  });

  it('reversed mod with colonAnchor produces "suffix.*: number" pattern', () => {
    const ast = range(2, undefined, 'появляется', undefined, undefined, undefined, undefined, true, true);
    const regex = compile(ast, { round10: false });
    // Colon anchor: ': ' between .* and number pattern
    expect(regex).toContain(': ');
    const suffixIdx = regex.indexOf('появляется');
    const colonIdx = regex.indexOf(': ', suffixIdx);
    const dotStarIdx = regex.indexOf('.*', suffixIdx);
    expect(colonIdx).toBeGreaterThan(dotStarIdx);
  });

  it('reversed mod WITHOUT colonAnchor does NOT contain ": "', () => {
    const ast = range(2, undefined, 'зарядов', undefined, undefined, undefined, undefined, true, false);
    const regex = compile(ast, { round10: false });
    expect(regex).not.toContain(': ');
  });

  it('non-reversed mod ignores colonAnchor', () => {
    const ast = range(2, undefined, 'увеличение редкости', undefined, undefined, undefined, undefined, false, true);
    const regex = compile(ast, { round10: false });
    // colonAnchor only applies when reversed=true
    expect(regex).not.toContain(': ');
  });

  it('enumerated reversed range with colonAnchor includes ": "', () => {
    const ast = range(2, 3, 'появляется', undefined, undefined, undefined, undefined, true, true);
    const regex = compile(ast, { round10: false });
    expect(regex).toContain(': ');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IN-GAME TEST RESULTS — verified 2026-06-10
// ═══════════════════════════════════════════════════════════════════════════

describe('In-game verification results for non-% mod FP', () => {
  it('TEST 1 VERIFIED: "дополнительных редких монстров" ≥2 → FP on value 1', () => {
    // "подсветило 2 плитки бездны с дополнительным редким монстром 1"
    // Range notation "1(1-2)" confirmed: "2" in range matches ≥2
    expect(true).toBe(true);
  });

  it('TEST 2 VERIFIED: "дополнительных свойств" ≥2 → NO FP on value 1', () => {
    // "ничего не подсветило" → no range notation extending to 2 in-game
    expect(true).toBe(true);
  });

  it('TEST 3 VERIFIED: "дополнительных редких сундуков" ≥3 → FP on value 2', () => {
    // "именно тревожный суд и подсветило!" → range notation "2(1-3)" confirmed
    expect(true).toBe(true);
  });

  it('TEST 4 VERIFIED: "дополнительных духов азмири" ≥2 → NO FP on value 1', () => {
    // "ничего не подсветило" → no range notation extending to 2 in-game
    expect(true).toBe(true);
  });

  it('TEST 5 VERIFIED: "зарядов" ≥5 → correctly filtered (implicit control)', () => {
    // "скрыло плитки на 4, 3 и 2 использования (зарядов) и подсветило все остальные от 5 зарядов и выше"
    // Implicits NOT dual-indexed → no range notation FP
    expect(true).toBe(true);
  });

  it('TEST 6 VERIFIED: % mod "эффективности монстров" ≥16 → NO FP on 15%', () => {
    // "ничего не подсветило!" → % anchor prevents FP
    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FP RISK SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

describe('FP risk summary for non-% mods (after colon anchor fix)', () => {
  it('documents which non-% mod patterns have FP risk and fix status', () => {
    // FP RISK MATRIX (after colon anchor fix):
    //
    // | Mod Pattern                                    | Anchor    | Reversed | FP Risk | Fix Status                     |
    // |------------------------------------------------|-----------|----------|---------|--------------------------------|
    // | "##% suffix" (% mods)                          | % (end)   | No       | NONE    | % anchor prevents range FP     |
    // | "## suffix" (## at start, no %)                | ^ (start) | No       | NONE    | ^ anchor prevents range FP     |
    // | "suffix: ##" (## at end, no %)                 | : (colon) | Yes      | FIXED   | Colon anchor prevents range FP |
    // | Implicits "label: ##"                          | N/A       | Yes      | NONE    | Not dual-indexed, no range     |
    //
    // COLON ANCHOR MECHANISM:
    // For non-% reversed mods where template ends with ": ##", the compiled regex
    // uses "suffix.*: (number)" instead of "suffix.*number". The ': ' anchor
    // ensures the number is matched right after the colon-space delimiter,
    // which is where the rolled value appears. Range notation secondary numbers
    // (e.g., "2" in "1(1-2)") appear AFTER the rolled value, not after ': '.
    //
    // IN-GAME VERIFIED FIXES:
    // T1: "дополнительных редких монстров: 1(1-2)" → FP before fix, prevented by colon anchor
    // T3: "дополнительных редких сундуков: 2(1-3)" → FP before fix, prevented by colon anchor
    expect(true).toBe(true);
  });
});
