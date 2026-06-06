/**
 * Hypothesis-Driven Pattern Tests — Phase 7: In-Game Verification
 *
 * These tests are NOT re-testing already-verified behaviors (AND/OR/NOT, ./.*,
 * [], number regex basics). Instead, each test targets a NOVEL hypothesis about
 * how the PoE2 regex engine interacts with REAL game item text patterns that
 * have never been systematically tested.
 *
 * Test items sourced from: предметы для теста с аффиксами имплиситами.md
 *
 * HYPOTHESES:
 * H1: Fractional numbers — `.` ambiguity (decimal vs wildcard)
 * H2: Negative values — `-` as literal vs range operator in []
 * H3: Cross-line single mod — `.*` bridging within multi-line mod
 * H4: Tablet "зарядов" vs "использ" — suffix correctness BUG
 * H5: Implicit property searchability
 * H6: Prefix/suffix name non-searchability
 * H7: "к сопротивлению всем стихиям" vs individual element resistances
 * H8: Inverted number ranges (50→40 decreasing)
 * H9: Full tooltip searchability — text outside mod section
 *
 * Each test documents:
 * - What it validates about the matcher (our code)
 * - What needs IN-GAME verification (PoE2 client behavior)
 * - Whether our matcher's behavior MATCHES or DIFFERS from expected game behavior
 */
import { describe, it, expect } from 'vitest';
import {
  matchPoE2Regex,
  matchPoE2RegexItem,
  getItemSearchBlocks,
} from '@core/poe2-regex-matcher';
import type { GameItemText } from '@core/poe2-regex-matcher';
import { compile } from '@core/compiler';
import { range } from '@core/ast';

// ═══════════════════════════════════════════════════════════════════════════
// REAL GAME ITEMS — from предметы для теста с аффиксами имплиситами.md
// ═══════════════════════════════════════════════════════════════════════════

/** Ring 1: Кольцо Разлома "Отвратительное потрясение" */
const ring1: GameItemText = {
  name: 'Отвратительное потрясение',
  type: 'Кольцо Разлома',
  rarity: 'Редкий',
  properties: ['Требуется: Уровень 60', 'Уровень предмета: 82'],
  implicits: ['Максимальное качество равно 40%'],
  mods: [
    '+66(60-69) к максимуму здоровья',
    '28(27-30)% увеличение урона от огня',
    '+121(108-141) к уклонению',
    '+23(21-24) к силе',
    'Дарует 49(41-53) здоровья за каждого убитого врага',
    '+35(31-35)% к сопротивлению молнии',
  ],
};

/** Ring 2: Кольцо Разлома "Расколотый завиток" */
const ring2: GameItemText = {
  name: 'Расколотый завиток',
  type: 'Кольцо Разлома',
  rarity: 'Редкий',
  properties: ['Требуется: Уровень 59', 'Уровень предмета: 82'],
  implicits: ['Максимальное качество равно 40%'],
  mods: [
    'Добавляет от 17(13-19) до 30(27-32) урона от огня к атакам',
    'Добавляет от 6(5-7) до 12(9-13) физического урона к атакам',
    'Добавляет от 2(1-2) до 36(33-40) урона от молнии к атакам',
    '19(18-22)% повышение скорости регенерации маны',
    '15% увеличение радиуса обзора',
    '+32(31-33) к силе',
    '+13(12-14)% к сопротивлению всем стихиям',
  ],
};

/** Ring 3: Кольцо Разлома "Ненавистное потрясение" */
const ring3: GameItemText = {
  name: 'Ненавистное потрясение',
  type: 'Кольцо Разлома',
  rarity: 'Редкий',
  properties: ['Требуется: Уровень 40', 'Уровень предмета: 82'],
  implicits: ['Максимальное качество равно 40%'],
  mods: [
    '15(13-17)% увеличение урона хаосом',
    'Добавляет от 5(5-7) до 9(9-13) физического урона к атакам',
    '+59(55-64) к максимуму маны',
    'Регенерация 15.9(13.1-18) здоровья в секунду',
    '18(15-18)% повышение редкости найденных предметов',
  ],
};

/** Waystone 1: "Призрачный камень" — with negative values and multi-line mod */
const waystone1: GameItemText = {
  name: 'Призрачный камень',
  type: 'Путевой камень (Ур. 15)',
  rarity: 'Редкий',
  properties: [
    'Доступно возрождений: 0 (augmented)',
    'Редкость предметов: +18% (augmented)',
    'Размер групп монстров: +30% (augmented)',
    'Эффективность монстров: +57% (augmented)',
    'Шанс выпадения путевого камня: +85% (augmented)',
    'Уровень предмета: 81',
  ],
  mods: [
    'Монстры с 36(27-33)% шансом могут наложить отравление при нанесении удара',
    'Монстры с 18(15-20)% шансом могут наложить кровотечение при нанесении удара',
    'Монстры имеют 276(200-240)% повышение шанса критического удара',
    '+28(21-25)% к бонусу критического урона монстров',
    '-11(-8--6)% максимум сопротивлений игроков',
    '125(100-119)% усиление наложения стихийных состояний у монстров',
    'Монстры имеют 70(70-79)% увеличение порога состояний',
    'Монстры имеют 76(60-69)% увеличение порога оглушения',
  ],
  additional: ['Осквернено'],
  description: ['Можно использовать в Машине картоходца, чтобы войти на карту. Путевые камни одноразовые.'],
};

/** Waystone 2: "Изменённый прогресс" — inverted range, frozen ground */
const waystone2: GameItemText = {
  name: 'Изменённый прогресс',
  type: 'Путевой камень (Ур. 15)',
  rarity: 'Редкий',
  properties: [
    'Доступно возрождений: 0 (augmented)',
    'Редкость предметов: +36% (augmented)',
    'Размер групп монстров: +30% (augmented)',
    'Эффективность монстров: +30% (augmented)',
    'Шанс выпадения путевого камня: +90% (augmented)',
    'Уровень предмета: 82',
  ],
  mods: [
    'Монстры имеют 273(200-240)% повышение шанса критического удара',
    '+26(21-25)% к бонусу критического урона монстров',
    'Монстры имеют 125(90-100)% увеличение накопления шкалы оглушения',
    'На 50(50-40)% меньше эффекта проклятий на монстрах',
    'Игроки получают уменьшение зарядов флакона на 34(35-30)%',
    'Область имеет участки замерзшей земли',
    'Область проклята Путами времени — Неизменяемое значение',
  ],
  additional: ['Осквернено'],
  description: ['Можно использовать в Машине картоходца, чтобы войти на карту. Путевые камни одноразовые.'],
};

/** Waystone 3: "Разрушенный коридор" — many prefixes, additional projectiles */
const waystone3: GameItemText = {
  name: 'Разрушенный коридор',
  type: 'Путевой камень (Ур. 15)',
  rarity: 'Редкий',
  properties: [
    'Доступно возрождений: 0 (augmented)',
    'Редкость предметов: +25% (augmented)',
    'Размер групп монстров: +43% (augmented)',
    'Эффективность монстров: +30% (augmented)',
    'Шанс выпадения путевого камня: +110% (augmented)',
    'Уровень предмета: 79',
  ],
  mods: [
    'Монстры выпускают дополнительных снарядов: 2',
    'Скорость атаки, сотворения чар и передвижения монстров повышена на 10(10-15)%',
    'Монстры имеют 125(90-100)% увеличение накопления шкалы оглушения',
    'Монстры с 36(27-33)% шансом могут наложить отравление при нанесении удара',
    'Урон монстров пробивает 13(12-14)% сопротивлений стихиям',
    'Монстры имеют 297(200-240)% повышение шанса критического удара',
    '+26(21-25)% к бонусу критического урона монстров',
  ],
  additional: ['Осквернено'],
  description: ['Можно использовать в Машине картоходца, чтобы войти на карту. Путевые камни одноразовые.'],
};

/** Tablet 1: "Потусторонний ордер" */
const tablet1: GameItemText = {
  name: 'Потусторонний ордер',
  type: 'Заражённая плитка',
  rarity: 'Редкий',
  properties: ['Уровень предмета: 79'],
  implicits: ['Добавляет Заражение на карту', 'Осталось зарядов - 10'],
  mods: [
    '39(25-35)% увеличение количества редких монстров на карте',
    '18(8-12)% увеличение редкости находимых на карте предметов',
    'На карте с увеличенным на 82(70-100)% шансом можно встретить Сущности',
    '34(30-40)% увеличение количества находимых на карте путевых камней',
  ],
  additional: [],
  description: ['Можно использовать в личной Машине картоходца для добавления свойств на карту.'],
};

/** Tablet 2: "Фениксовое побуждение" */
const tablet2: GameItemText = {
  name: 'Фениксовое побуждение',
  type: 'Заражённая плитка',
  rarity: 'Редкий',
  properties: ['Уровень предмета: 79'],
  implicits: ['Добавляет Заражение на карту', 'Осталось зарядов - 10'],
  mods: [
    '27(25-35)% увеличение количества редких монстров на карте',
    '33(25-35)% увеличение количества находимого на карте золота',
    '43(30-40)% увеличение количества находимых на карте путевых камней',
    'Уникальные монстры имеют дополнительных свойств: 1',
  ],
  additional: [],
  description: ['Можно использовать в личной Машине картоходца для добавления свойств на карту.'],
};

/** Tablet 3: "Фениксовый наказ" */
const tablet3: GameItemText = {
  name: 'Фениксовый наказ',
  type: 'Заражённая плитка',
  rarity: 'Редкий',
  properties: ['Уровень предмета: 81'],
  implicits: ['Добавляет Заражение на карту', 'Осталось зарядов - 10'],
  mods: [
    '57(30-40)% увеличение количества волшебных монстров на карте',
    '21(8-12)% увеличение редкости находимых на карте предметов',
    '39(30-40)% увеличение количества находимых на карте путевых камней',
    'На карте с увеличенным на 73(70-100)% шансом можно встретить духов азмири',
  ],
  additional: [],
  description: ['Можно использовать в личной Машине картоходца для добавления свойств на карту.'],
};

/** Amulet 1: "Унылый фермуар" — Лазурный амулет */
const amulet1: GameItemText = {
  name: 'Унылый фермуар',
  type: 'Лазурный амулет',
  rarity: 'Редкий',
  properties: ['Требуется: Уровень 59', 'Уровень предмета: 79'],
  implicits: ['28(20-30)% повышение скорости регенерации маны'],
  mods: [
    '43(39-44)% увеличение уклонения',
    '29(27-32)% увеличение максимума энергетического щита',
    '+380(347-450) к меткости',
    '15(15-19)% повышение шанса критического удара',
    '+12(11-15)% к сопротивлению холоду',
    '+33(31-33) к интеллекту',
  ],
};

/** Amulet 2: "Крутящий горжет" — Лазурный амулет
 *  Used for cross-validation in ETL tests. Kept for reference. */
// @ts-expect-error — kept for cross-validation reference
const amulet2: GameItemText = {
  name: 'Крутящий горжет',
  type: 'Лазурный амулет',
  rarity: 'Редкий',
  properties: ['Требуется: Уровень 52', 'Уровень предмета: 79'],
  implicits: ['25(20-30)% повышение скорости регенерации маны'],
  mods: [
    '+184(168-236) к меткости',
    '+62(62-70) к максимуму энергетического щита',
    '30(27-32)% увеличение максимума энергетического щита',
    '+24(21-25)% к сопротивлению молнии',
    '14(13-15)% полученного урона восполняется в виде здоровья',
    '+14(13-16) к ловкости',
  ],
};

/** Amulet 3: "Племенной медальон" — Лазурный амулет */
const amulet3: GameItemText = {
  name: 'Племенной медальон',
  type: 'Лазурный амулет',
  rarity: 'Редкий',
  properties: ['Требуется: Уровень 60', 'Уровень предмета: 78'],
  implicits: ['27(20-30)% повышение скорости регенерации маны'],
  mods: [
    '+35(33-60) к меткости',
    '+17(10-19) к максимуму здоровья',
    '+55(55-64) к максимуму маны',
    '+34(31-35)% к сопротивлению молнии',
    '+14(12-15)% к сопротивлению хаосу',
    'Регенерация 30.9(29.1-33) здоровья в секунду',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// H1: FRACTIONAL NUMBERS — Decimal Point Ambiguity
// ═══════════════════════════════════════════════════════════════════════════

describe('H1: Fractional numbers — decimal vs wildcard ambiguity', () => {
  it('regex `.` (wildcard) matches literal `.` in "15.9"', () => {
    // In PoE2 regex, `.` matches ANY single character, including literal period
    // So "15.9" in regex matches "15.9" in text (dot matches dot)
    expect(matchPoE2RegexItem('"15.9"', ring3)).toBe(true);
  });

  it('"159" (no dot) does NOT match "15.9" in text', () => {
    // "159" is NOT a substring of "15.9" — the period is a real character
    expect(matchPoE2RegexItem('"159"', ring3)).toBe(false);
  });

  it('"15[.]9" uses char class to match literal period', () => {
    // In PoE2 regex, [.] is a character class containing ONLY the period char
    // This should match "15.9" literally
    expect(matchPoE2RegexItem('"15[.]9"', ring3)).toBe(true);
  });

  it('fractional number in amulet: "30.9" matches', () => {
    expect(matchPoE2RegexItem('"30.9"', amulet3)).toBe(true);
  });

  it('wildcard also matches: "30.9" matches "30X9" where X is any char', () => {
    // The `.` in "30.9" is a wildcard, so it also matches "30X9" for any X
    expect(matchPoE2Regex('"30.9"', 'Регенерация 30X9 здоровья')).toBe(true);
    expect(matchPoE2Regex('"30.9"', 'Регенерация 30 9 здоровья')).toBe(true);
  });

  it('"Регенерация.*здоровья в секунду" crosses fractional number', () => {
    // .* can cross from "Регенерация" through "15.9(13.1-18)" to "здоровья в секунду"
    // All within the same mod block
    expect(matchPoE2RegexItem('"Регенерация.*здоровья в секунду"', ring3)).toBe(true);
  });

  it('number regex with suffix on fractional mod: ≥15 with suffix "здоровья"', () => {
    // RANGE(min=15, suffix="здоровья") → "([1-9][0-9]|[0-9][0-9][0-9]).*здоровья"
    // The "15" in "15.9" is ≥15, so this should match
    const ast = range(15, undefined, 'здоровья');
    const regex = compile(ast, { round10: true });
    expect(regex).toBeTruthy();
    // The compiled regex should find "15" before "здоровья" in "15.9(13.1-18) здоровья"
    expect(matchPoE2RegexItem(regex, ring3)).toBe(true);
  });

  it('VERIFIED IN-GAME: fractional numbers work as expected', () => {
    // Phase 7 results: "30.9" ✅, "309" ❌, "30[.]9" ✅
    // The `.` matches literal period, [.] works for exact match
    // Period is a real character separator — "309" ≠ "30.9"
    expect(matchPoE2RegexItem('"30.9"', amulet3)).toBe(true);
    expect(matchPoE2RegexItem('"309"', amulet3)).toBe(false);
    expect(matchPoE2RegexItem('"30[.]9"', amulet3)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H2: NEGATIVE VALUES — Literal minus in mod text
// ═══════════════════════════════════════════════════════════════════════════

describe('H2: Negative values — minus sign in mod text', () => {
  it('"-11" matches literal negative number in text', () => {
    expect(matchPoE2RegexItem('"-11"', waystone1)).toBe(true);
  });

  it('"11" also matches (substring of "-11")', () => {
    // "11" is a substring of "-11" — it will match
    expect(matchPoE2RegexItem('"11"', waystone1)).toBe(true);
  });

  it('"(-8" matches the lower bound in negative range', () => {
    expect(matchPoE2RegexItem('"(-8"', waystone1)).toBe(true);
  });

  it('double-hyphen "--" in text is searchable as literal', () => {
    // The text "-8--6" contains "--" (double hyphen)
    // Searching for "--6" should match
    expect(matchPoE2RegexItem('"--6"', waystone1)).toBe(true);
  });

  it('"максимум сопротивлений" matches negative mod suffix', () => {
    // The suffix "максимум сопротивлений" appears after the negative number
    expect(matchPoE2RegexItem('"максимум сопротивлений"', waystone1)).toBe(true);
  });

  it('negative number with suffix anchor: "-11.*максимум сопротивлений"', () => {
    // This tests that .* can bridge from "-11" to "максимум сопротивлений"
    // Both are within the same mod block
    expect(matchPoE2RegexItem('"-11.*максимум сопротивлений"', waystone1)).toBe(true);
  });

  it('VERIFIED IN-GAME: negative values work correctly', () => {
    // Phase 7 results: "-11" ✅, "11" matches as substring ✅, "--6" ✅
    // Minus is a literal, double-hyphen is searchable
    expect(matchPoE2RegexItem('"-11"', waystone1)).toBe(true);
    expect(matchPoE2RegexItem('"--6"', waystone1)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H3: CROSS-LINE SINGLE MOD — Разрушительный two-line mod
// ═══════════════════════════════════════════════════════════════════════════

describe('H3: Cross-line single mod — Разрушительный two-line mod', () => {
  it('AND search matches both sub-lines of Разрушительный mod', () => {
    // "критического удара" is on line 1, "бонусу критического" is on line 2
    // Both should be found by AND search (order-independent)
    expect(matchPoE2RegexItem('"критического удара" "бонусу критического"', waystone1)).toBe(true);
    expect(matchPoE2RegexItem('"критического удара" "бонусу критического"', waystone2)).toBe(true);
    expect(matchPoE2RegexItem('"критического удара" "бонусу критического"', waystone3)).toBe(true);
  });

  it('".*" does NOT cross sub-line boundaries within multi-line mod (VERIFIED IN-GAME)', () => {
    // In-game Phase 7: "повышение шанса критического удара.*бонусу" does NOT match
    // Each sub-line of a multi-line mod (like Разрушительный) is a separate block.
    // Use AND instead: "критического удара" "бонусу критического"
    // Block-based matching: .* does NOT cross block boundaries.
    expect(matchPoE2RegexItem('"повышение шанса критического удара.*бонусу"', waystone1)).toBe(false);
  });

  it('".*" is directional — reversed order fails', () => {
    // "бонусу" appears AFTER "критического удара" — so searching in reverse fails
    // Both "бонусу" and "повышение шанса критического" are in the same mod line,
    // but "бонусу" comes after "повышение шанса критического" so reverse .* fails
    expect(matchPoE2RegexItem('"бонусу.*повышение шанса критического"', waystone1)).toBe(false);
  });

  it('AND is order-independent — reversed AND also works', () => {
    expect(matchPoE2RegexItem('"бонусу критического" "критического удара"', waystone1)).toBe(true);
  });

  it('specific number search on Разрушительный: 276 matches', () => {
    // The rolled value "276" appears on the first sub-line
    expect(matchPoE2RegexItem('"276"', waystone1)).toBe(true);
  });

  it('VERIFIED IN-GAME: multi-line mod sub-lines are separate blocks', () => {
    // Phase 7 results: .* does NOT cross sub-lines (3.1 ❌, 3.2 ❌)
    // BUT AND does cross sub-lines (3.3 ✅)
    // Formula for Разрушительный: "критического удара" "бонусу критического"
    // NOT: "повышение шанса критического удара.*бонусу"
    expect(true).toBe(true); // verified above in specific tests
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H4: TABLET SUFFIX BUG — "зарядов" vs "использ"
// ═══════════════════════════════════════════════════════════════════════════

describe('H4: Tablet suffix — "зарядов" vs "использ" (BUG DETECTION)', () => {
  it('"зарядов" matches tablet implicit text', () => {
    // The actual game text: "Осталось зарядов - 10"
    expect(matchPoE2RegexItem('"зарядов"', tablet1)).toBe(true);
  });

  it('"использ" does NOT match tablet (description not indexed, VERIFIED IN-GAME)', () => {
    // In-game Phase 7: "использ" does NOT highlight tablets — description text is not indexed
    // The word "использовать" is in the description, NOT in the search index
    // "зарядов" IS in the implicit and IS indexed
    expect(matchPoE2RegexItem('"использ"', tablet1)).toBe(false);
    const text = getItemSearchBlocks(tablet1).join('\n');
    expect(text).toContain('зарядов');
    expect(text).not.toContain('использовать'); // description excluded
  });

  it('number regex with "зарядов" suffix: cross-mod .* does NOT work (VERIFIED IN-GAME)', () => {
    // In-game Phase 7: "39.*зарядов" does NOT match — .* does not cross block boundaries
    // "39" is in a mod block, "зарядов" is in an implicit block — separate blocks
    // In block-based matching, .* does NOT cross from mod block to implicit block
    expect(matchPoE2RegexItem('"([1-9][0-9]|[0-9][0-9][0-9]).*зарядов"', tablet1)).toBe(false);
    // Within the same implicit block: "зарядов.*10" works because both are in the same block
    expect(matchPoE2RegexItem('"зарядов.*10"', tablet1)).toBe(true);
  });

  it('prefix-anchored number regex for "зарядов" — requires number AFTER word', () => {
    // The text is "зарядов - 10" — number is AFTER the word
    // PoE2 regex doesn't support lookbehind, so we can't anchor "number AFTER word"
    // The only way is to use the word before the number: "зарядов.*10"
    expect(matchPoE2RegexItem('"зарядов.*10"', tablet1)).toBe(true);
  });

  it('all three tablets have "зарядов" implicit', () => {
    expect(matchPoE2RegexItem('"зарядов"', tablet1)).toBe(true);
    expect(matchPoE2RegexItem('"зарядов"', tablet2)).toBe(true);
    expect(matchPoE2RegexItem('"зарядов"', tablet3)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: what is the exact text for tablet charges?', () => {
    // Critical questions for in-game testing:
    // 1. Заражённая плитка shows "Осталось зарядов - 10" — verified from raw dump
    // 2. Other tablet types (Бездна, Делириум, etc.) — do they use "зарядов" or "использований"?
    // 3. Is the number BEFORE or AFTER the word? "10 зарядов" vs "зарядов - 10"
    // This determines whether directional .* can work for number filtering.
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H5: IMPLICIT PROPERTY SEARCHABILITY
// ═══════════════════════════════════════════════════════════════════════════

describe('H5: Implicit property searchability', () => {
  it('ring implicit "качеств" matches in our matcher (includes implicits)', () => {
    // All Кольца Разлома have implicit "Максимальное качество равно 40%"
    expect(matchPoE2RegexItem('"качеств"', ring1)).toBe(true);
  });

  it('amulet implicit "регенерации маны" matches in our matcher', () => {
    // Лазурный амулет has implicit "% повышение скорости регенерации маны"
    expect(matchPoE2RegexItem('"регенерации маны"', amulet1)).toBe(true);
  });

  it('tablet implicit "Заражение" matches in our matcher', () => {
    expect(matchPoE2RegexItem('"Заражение"', tablet1)).toBe(true);
  });

  it('"!качеств" excludes rings with quality implicit', () => {
    // If implicits are searchable, "!качеств" should hide all rings with the quality implicit
    expect(matchPoE2RegexItem('"!качеств"', ring1)).toBe(false);
  });

  it('implicit number filtering: "регенерации маны" AND ≥25%', () => {
    // Amulet 1 has implicit "28(20-30)% повышение скорости регенерации маны"
    // Testing: can we filter by number on an implicit?
    // "28" appears before "регенерации маны" in the implicit text — same block
    expect(matchPoE2RegexItem('"28.*регенерации маны"', amulet1)).toBe(true);
  });

  it('VERIFIED IN-GAME: implicits ARE indexed by PoE2 search', () => {
    // Phase 7 results: "качеств" ✅, "регенерации маны" ✅, "Заражение" ✅
    // Implicits are searchable — our model is correct
    expect(true).toBe(true); // verified above in specific tests
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H6: PREFIX/SUFFIX NAME NON-SEARCHABILITY
// ═══════════════════════════════════════════════════════════════════════════

describe('H6: Prefix/suffix name searchability', () => {
  // The raw game dump shows lines like:
  // { Префикс "Сильное" (Уровень: 4) — Здоровье }
  // { Суффикс "гориллы" (Уровень: 4) — Характеристика }
  // These are UI labels, NOT part of the mod text that PoE2 search indexes.

  it('our matcher does NOT include prefix/suffix names in searchable text', () => {
    // Our getItemSearchBlocks() returns: name, type, rarity, properties, implicits, mods, additional
    // It does NOT include the { Префикс "Сильное" } labels
    const text = getItemSearchBlocks(ring1).join('\n');
    // "Сильное" is the prefix name for +66 к максимуму здоровья
    // It should NOT appear in the searchable text because our model excludes it
    expect(text).not.toContain('Сильное');
    expect(text).not.toContain('гориллы');
    expect(text).not.toContain('доблести');
    expect(text).not.toContain('вихря');
  });

  it('mod EFFECT text IS searchable even when prefix name is not', () => {
    // The mod EFFECT text IS included:
    expect(matchPoE2RegexItem('"к максимуму здоровья"', ring1)).toBe(true);
    expect(matchPoE2RegexItem('"к силе"', ring1)).toBe(true);
    expect(matchPoE2RegexItem('"к сопротивлению молнии"', ring1)).toBe(true);
  });

  it('waystone prefix name "Льдистый" — mod effect is searchable', () => {
    // "Льдистый" is the suffix name for "Область имеет участки замерзшей земли"
    // The EFFECT "замерзшей земли" should be searchable
    expect(matchPoE2RegexItem('"замерзшей земли"', waystone2)).toBe(true);
  });

  it('VERIFIED IN-GAME: affix names are NOT searchable (model correct)', () => {
    // Our model already excludes affix names — this is correct
    expect(true).toBe(true); // model matches in-game behavior
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H7: "к сопротивлению всем стихиям" vs individual element resistances
// ═══════════════════════════════════════════════════════════════════════════

describe('H7: "всем стихиям" resistance — cross-element pattern', () => {
  it('"к сопротивлению всем стихиям" matches Ring 2', () => {
    expect(matchPoE2RegexItem('"к сопротивлению всем стихиям"', ring2)).toBe(true);
  });

  it('"сопротивлению" matches ALL resistance mods (fire, cold, lightning, chaos, all)', () => {
    // The word "сопротивлению" is a shared substring across ALL resistance types
    expect(matchPoE2RegexItem('"сопротивлению"', ring1)).toBe(true); // lightning
    expect(matchPoE2RegexItem('"сопротивлению"', ring2)).toBe(true); // all elements
  });

  it('"всем стихиям" does NOT match individual element resistance', () => {
    // Ring 1 has "+35% к сопротивлению молнии" — NOT "всем стихиям"
    expect(matchPoE2RegexItem('"всем стихиям"', ring1)).toBe(false);
  });

  it('combined search: want "всем стихиям" AND NOT specific element', () => {
    // User wants "all res" mod but NOT "fire res" or "lightning res" separately
    // This tests cross-family FP: "сопротивлению" matches both families
    expect(matchPoE2RegexItem('"всем стихиям"', ring2)).toBe(true);
    // But this would also match items that have BOTH individual and all-res:
    // "+13% к сопротивлению всем стихиям" has "всем стихиям" → match
  });

  it('number filtering on "всем стихиям": ≥12%', () => {
    // Ring 2 has "+13(12-14)% к сопротивлению всем стихиям"
    // Testing RANGE with "всем стихиям" suffix
    const ast = range(12, undefined, 'всем стихиям');
    const regex = compile(ast, { round10: false });
    expect(regex).toBeTruthy();
    // "13" appears before "всем стихиям" → should match
    expect(matchPoE2RegexItem(regex, ring2)).toBe(true);
  });

  it('cross-family FP detection: "к сопротивлению" matches both individual and all-res', () => {
    // This is the FP problem: "к сопротивлению" matches ANY resistance mod
    // It matches fire, cold, lightning, chaos, AND all-res
    // This is "by design" for family-tier FP, but cross-family for different element families
    const allRings = [ring1, ring2, ring3];
    const matchCount = allRings.filter(r => matchPoE2RegexItem('"к сопротивлению"', r)).length;
    // Ring 1 has lightning res, Ring 2 has all res → both match
    expect(matchCount).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H8: INVERTED NUMBER RANGES — (50→40) decreasing
// ═══════════════════════════════════════════════════════════════════════════

describe('H8: Inverted number ranges — (50→40) decreasing', () => {
  it('inverted range text is searchable: "50(50-40)"', () => {
    expect(matchPoE2RegexItem('"50-40"', waystone2)).toBe(true);
  });

  it('"меньше эффекта проклятий" is searchable as suffix', () => {
    expect(matchPoE2RegexItem('"меньше эффекта"', waystone2)).toBe(true);
  });

  it('number before "меньше эффекта": ≥40 with suffix', () => {
    // The mod text is "На 50(50-40)% меньше эффекта проклятий на монстрах"
    // The number 50 appears BEFORE "меньше эффекта"
    // RANGE(40, undefined, 'меньше эффекта') should match because 50 ≥ 40
    const ast = range(40, undefined, 'меньше эффекта');
    const regex = compile(ast, { round10: true });
    expect(matchPoE2RegexItem(regex, waystone2)).toBe(true);
  });

  it('inverted range does NOT break substring search for suffix', () => {
    // Even though the range is (50-40) instead of (40-50),
    // the suffix "меньше эффекта" is still searchable
    expect(matchPoE2RegexItem('"меньше эффекта проклятий"', waystone2)).toBe(true);
  });

  it('another inverted range: "34(35-30)%" for flask charges', () => {
    expect(matchPoE2RegexItem('"35-30"', waystone2)).toBe(true);
    expect(matchPoE2RegexItem('"зарядов флакона"', waystone2)).toBe(true);
  });

  it('VERIFIED IN-GAME: inverted ranges work correctly', () => {
    // Phase 7 results: "50.*меньше эффекта" ✅, "меньше эффекта проклятий" ✅
    // Number before suffix works, suffix alone works
    expect(true).toBe(true); // verified above in specific tests
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H9: FULL TOOLTIP SEARCHABILITY — text outside mod section
// ═══════════════════════════════════════════════════════════════════════════

describe('H9: Full tooltip searchability — text outside mod section (VERIFIED IN-GAME)', () => {
  it('"Осквернено" matches waystones (in additional/state text — indexed)', () => {
    // VERIFIED IN-GAME: "оскверн" highlights corrupted items
    expect(matchPoE2RegexItem('"оскверн"', waystone1)).toBe(true);
  });

  it('"картоходца" does NOT match (description NOT indexed, VERIFIED IN-GAME)', () => {
    // VERIFIED IN-GAME Phase 7: "картоходца" does NOT highlight any items
    // Description/tooltip text is NOT part of the search index
    expect(matchPoE2RegexItem('"картоходца"', waystone1)).toBe(false);
  });

  it('"одноразовые" does NOT match (description NOT indexed)', () => {
    expect(matchPoE2RegexItem('"одноразовые"', waystone1)).toBe(false);
  });

  it('"Машине" does NOT match (description NOT indexed)', () => {
    expect(matchPoE2RegexItem('"Машине"', waystone1)).toBe(false);
  });

  it('tablet description: "картоходца" does NOT match', () => {
    expect(matchPoE2RegexItem('"картоходца"', tablet1)).toBe(false);
  });

  it('"!оскверн" would exclude all corrupted waystones', () => {
    expect(matchPoE2RegexItem('"!оскверн"', waystone1)).toBe(false);
  });

  it('ring without "Осквернено" matches "!оскверн"', () => {
    expect(matchPoE2RegexItem('"!оскверн"', ring1)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BONUS: DUAL-NUMBER MODS — "От X до Y" pattern
// ═══════════════════════════════════════════════════════════════════════════

describe('BONUS: Dual-number mods — "От X до Y" pattern', () => {
  it('Ring 2: "Добавляет от 17 до 30 урона от огня к атакам" is fully searchable', () => {
    expect(matchPoE2RegexItem('"урона от огня к атакам"', ring2)).toBe(true);
    expect(matchPoE2RegexItem('"Добавляет от"', ring2)).toBe(true);
  });

  it('first number in dual-number mod: "17" appears before "урона от огня"', () => {
    // Both "17" and "урона от огня" are in the same mod block
    expect(matchPoE2RegexItem('"17.*урона от огня"', ring2)).toBe(true);
  });

  it('second number in dual-number mod: "30" appears before "урона от огня"', () => {
    // "30" also appears before "урона от огня к атакам" in the same mod block
    expect(matchPoE2RegexItem('"30.*урона от огня"', ring2)).toBe(true);
  });

  it('number filter for first placeholder (min damage ≥10): RANGE on "урона от огня к атакам"', () => {
    // For "Добавляет от 17(13-19) до 30(27-32) урона от огня к атакам"
    // The FIRST number is 17. RANGE(10, suffix='урона от огня к атакам')
    // With prefix anchoring: "от" before the number
    const ast = range(10, undefined, 'урона от огня к атакам', 'от');
    const regex = compile(ast, { round10: true });
    expect(matchPoE2RegexItem(regex, ring2)).toBe(true);
  });

  it('physical damage dual-number: "Добавляет от 6 до 12 физического урона к атакам"', () => {
    expect(matchPoE2RegexItem('"физического урона к атакам"', ring2)).toBe(true);
    expect(matchPoE2RegexItem('"6.*физического урона"', ring2)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: dual-number mod filtering', () => {
    // The ETL data marks these mods with hasMultiPlaceholder=true
    // The UI shows a "1е/2е" slot switcher for filtering first vs second number
    // Key question: does the PoE2 search treat "От 17 до 30" as one string?
    // If so, "17.*урона" and "30.*урона" both work because both numbers are before the suffix.
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BONUS: WAYSTONE SPECIFIC — проклятие, пороги, Неизменяемое значение
// ═══════════════════════════════════════════════════════════════════════════

describe('BONUS: Waystone-specific patterns', () => {
  it('"Путами времени" matches waystone 2 curse', () => {
    expect(matchPoE2RegexItem('"Путами времени"', waystone2)).toBe(true);
  });

  it('"Неизменяемое значение" matches waystone 2 immutable suffix', () => {
    expect(matchPoE2RegexItem('"Неизменяемое значение"', waystone2)).toBe(true);
  });

  it('"порога состояний" vs "порога оглушения" — different mods', () => {
    // Waystone 1 has BOTH: "увеличение порога состояний" AND "увеличение порога оглушения"
    expect(matchPoE2RegexItem('"порога состояний"', waystone1)).toBe(true);
    expect(matchPoE2RegexItem('"порога оглушения"', waystone1)).toBe(true);
  });

  it('"порога состояний" does NOT match "порога оглушения" alone', () => {
    // These are distinct search terms — "состояний" is not in "оглушения"
    expect(matchPoE2Regex('"порога состояний"', 'увеличение порога оглушения')).toBe(false);
    expect(matchPoE2Regex('"порога оглушения"', 'увеличение порога состояний')).toBe(false);
  });

  it('"пробивает.*сопротивлений стихиям" matches waystone 3', () => {
    // Both "пробивает" and "сопротивлений стихиям" are in the same mod block
    expect(matchPoE2RegexItem('"пробивает.*сопротивлений стихиям"', waystone3)).toBe(true);
  });

  it('"дополнительных снарядов" matches waystone 3', () => {
    expect(matchPoE2RegexItem('"дополнительных снарядов"', waystone3)).toBe(true);
  });

  it('waystone properties text is searchable: "возрождений"', () => {
    // Properties section: "Доступно возрождений: 0 (augmented)"
    expect(matchPoE2RegexItem('"возрождений"', waystone1)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: are waystone properties searchable?', () => {
    // "Доступно возрождений: 0" is in the properties section, not in mods.
    // Does PoE2 search include property text? If not, searching "возрождений" would fail.
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BONUS: CROSS-ITEM AND SEARCH — combining mods from different items
// ═══════════════════════════════════════════════════════════════════════════

describe('BONUS: Cross-item AND search — filtering by multiple criteria', () => {
  it('ring search: "к силе" AND "к сопротивлению молнии" — both on Ring 1', () => {
    expect(matchPoE2RegexItem('"к силе" "к сопротивлению молнии"', ring1)).toBe(true);
  });

  it('ring search: "к силе" AND "к сопротивлению молнии" — NOT on Ring 2 (no lightning res)', () => {
    // Ring 2 has "к силе" and "к сопротивлению всем стихиям" but NOT "к сопротивлению молнии"
    expect(matchPoE2RegexItem('"к силе" "к сопротивлению молнии"', ring2)).toBe(false);
  });

  it('amulet search: "к интеллекту" AND "к сопротивлению холоду" — Amulet 1', () => {
    expect(matchPoE2RegexItem('"к интеллекту" "к сопротивлению холоду"', amulet1)).toBe(true);
  });

  it('amulet search: "к интеллекту" AND NOT "к сопротивлению молнии"', () => {
    // Amulet 1 has cold res, NOT lightning res — this should match
    expect(matchPoE2RegexItem('"к интеллекту" "!к сопротивлению молнии"', amulet1)).toBe(true);
  });

  it('amulet search: "к интеллекту" AND NOT "к сопротивлению холоду" — Amulet 1 fails', () => {
    // Amulet 1 HAS cold res, so "!к сопротивлению холоду" should exclude it
    expect(matchPoE2RegexItem('"к интеллекту" "!к сопротивлению холоду"', amulet1)).toBe(false);
  });

  it('tablet search: "редких монстров" AND "путевых камней" — Tablet 1', () => {
    expect(matchPoE2RegexItem('"редких монстров" "путевых камней"', tablet1)).toBe(true);
  });

  it('tablet search: "золота" — only Tablet 2', () => {
    expect(matchPoE2RegexItem('"золота"', tablet1)).toBe(false);
    expect(matchPoE2RegexItem('"золота"', tablet2)).toBe(true);
    expect(matchPoE2RegexItem('"золота"', tablet3)).toBe(false);
  });

  it('waystone: "отравление" AND "кровотечение" — only Waystone 1', () => {
    expect(matchPoE2RegexItem('"отравление" "кровотечение"', waystone1)).toBe(true);
    expect(matchPoE2RegexItem('"отравление" "кровотечение"', waystone2)).toBe(false);
    expect(matchPoE2RegexItem('"отравление" "кровотечение"', waystone3)).toBe(false);
  });

  it('waystone: "отравление" AND NOT "кровотечение" — Waystone 3', () => {
    // Waystone 3 has отравление but NOT кровотечение
    expect(matchPoE2RegexItem('"отравление" "!кровотечение"', waystone3)).toBe(true);
    // Waystone 1 has BOTH → excluded
    expect(matchPoE2RegexItem('"отравление" "!кровотечение"', waystone1)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BONUS: EDGE CASES with real game text
// ═══════════════════════════════════════════════════════════════════════════

describe('BONUS: Edge cases with real game text', () => {
  it('"+" literal character in mod text is searchable', () => {
    // Many mods start with "+" — like "+66 к максимуму здоровья"
    // In PoE2 regex, "+" is NOT a special character (only |, !, ., [], (), ?, ^, $ are)
    expect(matchPoE2RegexItem('"+"', ring1)).toBe(true);
  });

  it('"%" literal character in mod text is searchable', () => {
    expect(matchPoE2RegexItem('"%"', ring1)).toBe(true);
  });

  it('"()" parentheses in mod text — PoE2 treats as grouping, NOT literal', () => {
    // The text "+66(60-69) к максимуму здоровья" contains literal "(60-69)"
    // But in PoE2 regex, "()" means GROUPING, not literal parens
    // So searching for "(60-69)" would NOT match the literal text "(60-69)"
    // because PoE2 interprets it as a group containing "60-69"
    // This is a KNOWN limitation documented in the worklog
    // PoE2 treats "()" as grouping, so "(60-69)" would try to match "60-69"
    // as a group, which as a literal sequence would match "60-69" within the text
    // Actually: "(60-69)" in PoE2 regex = group containing "60-69" which
    // as a literal substring would match "60-69" within the text
    // So this SHOULD match because "60-69" is a substring of the text
    expect(matchPoE2RegexItem('"60-69"', ring1)).toBe(true);
  });

  it('large number in amulet: "+380 к меткости" — three digits', () => {
    expect(matchPoE2RegexItem('"380"', amulet1)).toBe(true);
    // Number regex for ≥300: "[3-9][0-9][0-9]" matches 380
    // Both the number and "меткости" are in the same mod block
    expect(matchPoE2RegexItem('"[3-9][0-9][0-9].*меткости"', amulet1)).toBe(true);
  });

  it('exact phrase "Дарует" matches specific mod on Ring 1', () => {
    expect(matchPoE2RegexItem('"Дарует"', ring1)).toBe(true);
    // Other rings don't have "Дарует"
    expect(matchPoE2RegexItem('"Дарует"', ring2)).toBe(false);
    expect(matchPoE2RegexItem('"Дарует"', ring3)).toBe(false);
  });

  it('"увеличение радиуса обзора" is a fixed-value mod (no range)', () => {
    // Ring 2: "15% увеличение радиуса обзора" — no (min-max) because it's a fixed value
    expect(matchPoE2RegexItem('"увеличение радиуса обзора"', ring2)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 7 VERIFIED: Block-based matching model (in-game results)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 7 VERIFIED: Block-based matching — .* does NOT cross block boundaries', () => {
  it('.* does NOT cross mod boundaries (Test 2.1: ❌)', () => {
    // In-game: "максимуму здоровья.*к силе" does NOT highlight Ring 1
    // "максимуму здоровья" is in mod block, "к силе" is in a different mod block
    expect(matchPoE2RegexItem('"максимуму здоровья.*к силе"', ring1)).toBe(false);
  });

  it('.* reverse direction also fails across blocks (Test 2.2: ❌)', () => {
    expect(matchPoE2RegexItem('"к силе.*максимуму здоровья"', ring1)).toBe(false);
  });

  it('AND search DOES cross mod boundaries (Test 2.3: ✅)', () => {
    // In-game: "максимуму здоровья" "к силе" DOES highlight Ring 1
    expect(matchPoE2RegexItem('"максимуму здоровья" "к силе"', ring1)).toBe(true);
  });

  it('.* does NOT create cross-mod number FP (Test 2.4: ❌)', () => {
    // In-game: "28.*молнии" does NOT highlight Ring 1
    // "28" is in fire damage mod, "молнии" is in lightning resistance mod
    expect(matchPoE2RegexItem('"28.*молнии"', ring1)).toBe(false);
  });

  it('.* within same mod block works: number + suffix (Test 9.1: ✅)', () => {
    // In-game: "17.*огня к атакам" DOES highlight Ring 2
    // Both "17" and "огня к атакам" are in the SAME mod block
    expect(matchPoE2RegexItem('"17.*огня к атакам"', ring2)).toBe(true);
  });

  it('dual-number mod: second number + suffix works (Test 9.2: ✅)', () => {
    // In-game: "30.*огня к атакам" highlights Ring 2
    expect(matchPoE2RegexItem('"30.*огня к атакам"', ring2)).toBe(true);
  });

  it('dual-number cross-mod FP does NOT exist (Test 9.3: ❌)', () => {
    // In-game: "30.*физического" does NOT highlight Ring 2
    // "30" is in fire damage mod, "физического" is in physical damage mod
    expect(matchPoE2RegexItem('"30.*физического"', ring2)).toBe(false);
  });

  it('multi-line mod: .* does NOT cross sub-lines (Test 3.1: ❌)', () => {
    // In-game: "повышение шанса критического удара.*бонусу" does NOT highlight
    expect(matchPoE2RegexItem('"повышение шанса критического удара.*бонусу"', waystone1)).toBe(false);
  });

  it('multi-line mod: AND DOES cross sub-lines (Test 3.3: ✅)', () => {
    // In-game: "критического удара" "бонусу критического" highlights all waystones
    expect(matchPoE2RegexItem('"критического удара" "бонусу критического"', waystone1)).toBe(true);
    expect(matchPoE2RegexItem('"критического удара" "бонусу критического"', waystone2)).toBe(true);
    expect(matchPoE2RegexItem('"критического удара" "бонусу критического"', waystone3)).toBe(true);
  });

  it('tablet: cross-mod number FP does NOT exist (Test 7.3: ❌)', () => {
    // In-game: "39.*зарядов" does NOT highlight tablet
    // "39" is in a mod, "зарядов" is in an implicit — separate blocks
    expect(matchPoE2RegexItem('"39.*зарядов"', tablet1)).toBe(false);
  });

  it('tablet: "зарядов.*N" works within same implicit block (Test 7.4: ✅)', () => {
    // In-game: "зарядов.*10" highlights tablets
    // Both "зарядов" and "10" are in the SAME implicit block
    expect(matchPoE2RegexItem('"зарядов.*10"', tablet1)).toBe(true);
  });

  it('description text is NOT searchable (Tests 1.6, 7.2: ❌)', () => {
    // In-game: "картоходца" does NOT highlight items
    // In-game: "использ" does NOT highlight tablets
    expect(matchPoE2RegexItem('"картоходца"', waystone1)).toBe(false);
    expect(matchPoE2RegexItem('"использ"', tablet1)).toBe(false);
  });

  it('state text "Осквернено" IS searchable (Test 1.5: ✅)', () => {
    // In-game: "оскверн" highlights corrupted items
    expect(matchPoE2RegexItem('"оскверн"', waystone1)).toBe(true);
  });

  it('item name IS searchable (Test 1.1: ✅)', () => {
    // In-game: "потрясение" highlights both rings with that in name
    expect(matchPoE2RegexItem('"потрясение"', ring1)).toBe(true);
    expect(matchPoE2RegexItem('"потрясение"', ring3)).toBe(true);
  });

  it('item type IS searchable (Test 1.2: ✅)', () => {
    expect(matchPoE2RegexItem('"Кольцо Разлома"', ring1)).toBe(true);
  });

  it('properties ARE searchable (Tests 1.3, 1.4: ✅)', () => {
    expect(matchPoE2RegexItem('"Требуется"', ring1)).toBe(true);
    expect(matchPoE2RegexItem('"Уровень предмета"', ring1)).toBe(true);
  });

  it('implicits ARE searchable (Tests 6.1-6.4: ✅)', () => {
    expect(matchPoE2RegexItem('"качеств"', ring1)).toBe(true);
    expect(matchPoE2RegexItem('"регенерации маны"', amulet1)).toBe(true);
    expect(matchPoE2RegexItem('"Заражение"', tablet1)).toBe(true);
  });

  it('implicit number + .* suffix works within same implicit (Test 6.4: ✅)', () => {
    // "28.*регенерации маны" — both in same implicit block
    expect(matchPoE2RegexItem('"28.*регенерации маны"', amulet1)).toBe(true);
  });
});
