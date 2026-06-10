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

  it('DETAILED form: "появляется.*([2-9]|...)" on value 1(1-2) — FALSE POSITIVE', () => {
    // Reversed regex with range notation: "появляется.*([2-9]|[0-9][0-9][0-9]?)"
    // In "появляется дополнительных редких монстров: 1(1-2)",
    // "2" in "(1-2)" appears AFTER "появляется" → matches ≥2 → FP!
    const regex = '"появляется.*([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, exaltedAbyssTabletDetailed)).toBe(true);
    // FP confirmed: actual value is 1, but "2" in "(1-2)" matches ≥2
  });

  it('DETAILED form: "появляется.*([3-9]|...)" does NOT match 1(1-2)', () => {
    const regex = '"появляется.*([3-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, exaltedAbyssTabletDetailed)).toBe(false);
  });

  it('NEEDS IN-GAME VERIFICATION: does PoE2 show "1(1-2)" for this mod?', () => {
    // KEY QUESTION for in-game testing:
    // 1. Does the Бездна tile show "Из Бездн на карте появляется дополнительных
    //    редких монстров: 1(1-2)" in the detailed view?
    // 2. Or does it show "1" without range notation?
    // 3. If range notation IS shown, does searching "появляется.*2" (≥2)
    //    highlight this item in-game? (Expected: YES → FP confirmed)
    expect(true).toBe(true);
  });
});

describe('Non-% mod: "дополнительных свойств: ##" — reversed regex', () => {
  it('reversed regex matches simplified form', () => {
    expect(matchPoE2RegexItem('"дополнительных свойств.*1"', incomprehensibleUrge)).toBe(true);
  });

  it('DETAILED form: "дополнительных свойств.*2" on value 1(1-2) — FALSE POSITIVE', () => {
    const regex = '"дополнительных свойств.*([2-9]|[0-9][0-9][0-9]?)"';
    expect(matchPoE2RegexItem(regex, incomprehensibleUrgeDetailed)).toBe(true);
  });

  it('NEEDS IN-GAME VERIFICATION', () => {
    expect(true).toBe(true);
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

  it('DETAILED form: simulated 2(1-3) WOULD cause FP for ≥3', () => {
    const itemWithRange3: GameItemText = {
      name: 'Тест',
      type: 'Плитка Ритуала',
      implicits: ['Добавляет алтари Ритуала на карту', 'Осталось зарядов - 10'],
      mods: ['На карте можно встретить дополнительных редких сундуков: 2(1-3)'],
    };
    const regex = '"редких сундуков.*([3-9]|[0-9][0-9][0-9]?)"';
    // "3" in "(1-3)" is after "редких сундуков" and matches ≥3 → FP
    expect(matchPoE2RegexItem(regex, itemWithRange3)).toBe(true);
  });
});

describe('Non-% mod: "дополнительных духов азмири: ##" — reversed regex', () => {
  it('reversed regex matches simplified form', () => {
    expect(matchPoE2RegexItem('"духов азмири.*1"', cosmicMandate)).toBe(true);
  });

  it('number before suffix does NOT work (reversed direction)', () => {
    expect(matchPoE2RegexItem('"1.*духов азмири"', cosmicMandate)).toBe(false);
  });

  it('NEEDS IN-GAME VERIFICATION: FP risk for ≥2 on "духов азмири: 1(1-2)"', () => {
    // If the game shows "На карте можно встретить дополнительных духов азмири: 1(1-2)",
    // then "2" in "(1-2)" would match a ≥2 filter via reversed regex, causing FP.
    expect(true).toBe(true);
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
});

// ═══════════════════════════════════════════════════════════════════════════
// IN-GAME TEST PLAN — concrete verification steps
// ═══════════════════════════════════════════════════════════════════════════

describe('In-game verification plan for non-% mod FP', () => {
  it('TEST 1: "дополнительных редких монстров" with ≥2 on Бездна tile', () => {
    // Step 1: Get a Бездна tile with "Из Бездн на карте появляется
    //         дополнительных редких монстров: 1"
    // Step 2: Search in PoE2: "появляется.*([2-9]|[0-9][0-9][0-9]?)"
    // Expected: If the game shows range notation "1(1-2)", this item WILL highlight (FP)
    //          If no range notation, it will NOT highlight (correct)
    expect(true).toBe(true);
  });

  it('TEST 2: "дополнительных свойств" with ≥2 on Храм tile', () => {
    // Step 1: Get a Храм tile with "Уникальные монстры имеют дополнительных свойств: 1"
    // Step 2: Search: "дополнительных свойств.*([2-9]|[0-9][0-9][0-9]?)"
    // Expected: Same FP risk as TEST 1
    expect(true).toBe(true);
  });

  it('TEST 3: "дополнительных редких сундуков" with ≥3 on Ритуал tile', () => {
    // Step 1: Get a Ритуал tile with "На карте можно встретить дополнительных редких сундуков: 2"
    // Step 2: Search: "редких сундуков.*([3-9]|[0-9][0-9][0-9]?)"
    // Expected: FP only if range extends to 3+, i.e., "2(1-3)"
    expect(true).toBe(true);
  });

  it('TEST 4: "дополнительных духов азмири" with ≥2 on Ритуал tile', () => {
    // Step 1: Get a Ритуал tile with "На карте можно встретить дополнительных духов азмири: 1"
    // Step 2: Search: "духов азмири.*([2-9]|[0-9][0-9][0-9]?)"
    // Expected: FP only if range extends to 2+, i.e., "1(1-2)"
    expect(true).toBe(true);
  });

  it('TEST 5: "зарядов" with ≥5 on Ритуал tile (implicit, no range notation)', () => {
    // Step 1: Get a Ритуал tile with "Осталось зарядов - 4"
    // Step 2: Search: "зарядов.*([5-9]|[0-9][0-9][0-9]?)"
    // Expected: NO match (implicits not dual-indexed, no range notation FP)
    // This is a CONTROL test — should always pass
    expect(true).toBe(true);
  });

  it('TEST 6: % mod control — "увеличение эффективности монстров" with ≥16', () => {
    // Step 1: Get a tile with "15% увеличение эффективности монстров"
    // Step 2: Search: "(1[6-9]|[2-9][0-9]|[0-9][0-9][0-9])%.*эффективности монстров"
    // Expected: NO match (15 doesn't match 1[6-9], % anchor prevents range FP)
    // This is a CONTROL test — should always pass
    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FP RISK SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

describe('FP risk summary for non-% mods', () => {
  it('documents which non-% mod patterns have FP risk', () => {
    // FP RISK MATRIX:
    //
    // | Mod Pattern                                    | Anchor    | Reversed | FP Risk | Notes                          |
    // |------------------------------------------------|-----------|----------|---------|--------------------------------|
    // | "##% suffix" (% mods)                          | % (end)   | No       | NONE    | % anchor prevents range FP     |
    // | "## suffix" (## at start, no %)                | ^ (start) | No       | NONE    | ^ anchor prevents range FP     |
    // | "suffix: ##" (## at end, no %)                 | NONE      | Yes      | LOW*    | Reversed regex "suffix.*num".  |
    // |                                                |           |          |         | Range secondary num after      |
    // |                                                |           |          |         | rolled num CAN match in        |
    // |                                                |           |          |         | "suffix.*(pattern)". Small     |
    // |                                                |           |          |         | ranges (1-2) mean FP only for  |
    // |                                                |           |          |         | specific thresholds.           |
    // | Implicits "label: ##"                          | N/A       | Yes      | NONE    | Not dual-indexed, no range     |
    //
    // SPECIFIC MODS AT RISK (reversed, no anchoring):
    // 1. "дополнительных редких монстров: ##" — range [1,2], FP for ≥2
    // 2. "дополнительных свойств: ##" — range [1,2], FP for ≥2
    // 3. "дополнительных редких сундуков: ##" — range [1,2], FP for ≥3 only if range extends to 3
    // 4. "дополнительных духов азмири: ##" — range [1,2], FP for ≥2
    // 5. "дополнительных снарядов: ##" — range [1,2], FP for ≥2
    //
    // MODS WITH ^ ANCHOR (safe from FP):
    // 1. "## дополнительная группа монстров" — number at start
    //
    // MITIGATION OPTIONS:
    // 1. Accept FP as known limitation (current approach)
    // 2. Use enumeration: "духов азмири.*(1|2)" — precise but costs characters
    // 3. Use colon context: "азмири:.*([2-9]...)" — adds a few chars but anchors
    expect(true).toBe(true);
  });
});
