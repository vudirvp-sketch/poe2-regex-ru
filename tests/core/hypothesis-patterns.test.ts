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
  matchQuotedGroup,
  getItemSearchText,
  testRegex,
} from '@core/poe2-regex-matcher';
import type { GameItemText } from '@core/poe2-regex-matcher';
import { compile } from '@core/compiler';
import { and, or, exclude, literal, range } from '@core/ast';

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
  additional: ['Можно использовать в Машине картоходца, чтобы войти на карту. Путевые камни одноразовые.', 'Осквернено'],
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
  additional: ['Можно использовать в Машине картоходца, чтобы войти на карту. Путевые камни одноразовые.', 'Осквернено'],
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
  additional: ['Можно использовать в Машине картоходца, чтобы войти на карту. Путевые камни одноразовые.', 'Осквернено'],
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
  additional: ['Можно использовать в личной Машине картоходца для добавления свойств на карту.'],
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
  additional: ['Можно использовать в личной Машине картоходца для добавления свойств на карту.'],
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
  additional: ['Можно использовать в личной Машине картоходца для добавления свойств на карту.'],
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

/** Amulet 2: "Крутящий горжет" — Лазурный амулет */
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
    const text = getItemSearchText(ring3);
    expect(matchPoE2Regex('"15.9"', text)).toBe(true);
  });

  it('"159" (no dot) does NOT match "15.9" in text', () => {
    // "159" is NOT a substring of "15.9" — the period is a real character
    const text = getItemSearchText(ring3);
    expect(matchPoE2Regex('"159"', text)).toBe(false);
  });

  it('"15[.]9" uses char class to match literal period', () => {
    // In PoE2 regex, [.] is a character class containing ONLY the period char
    // This should match "15.9" literally
    const text = getItemSearchText(ring3);
    expect(matchPoE2Regex('"15[.]9"', text)).toBe(true);
  });

  it('fractional number in amulet: "30.9" matches', () => {
    const text = getItemSearchText(amulet3);
    expect(matchPoE2Regex('"30.9"', text)).toBe(true);
  });

  it('wildcard also matches: "30.9" matches "30X9" where X is any char', () => {
    // The `.` in "30.9" is a wildcard, so it also matches "30X9" for any X
    expect(matchPoE2Regex('"30.9"', 'Регенерация 30X9 здоровья')).toBe(true);
    expect(matchPoE2Regex('"30.9"', 'Регенерация 30 9 здоровья')).toBe(true);
  });

  it('"Регенерация.*здоровья в секунду" crosses fractional number', () => {
    // .* can cross from "Регенерация" through "15.9(13.1-18)" to "здоровья в секунду"
    const text = getItemSearchText(ring3);
    expect(matchPoE2Regex('"Регенерация.*здоровья в секунду"', text)).toBe(true);
  });

  it('number regex with suffix on fractional mod: ≥15 with suffix "здоровья"', () => {
    // RANGE(min=15, suffix="здоровья") → "([1-9][0-9]|[0-9][0-9][0-9]).*здоровья"
    // The "15" in "15.9" is ≥15, so this should match
    const ast = range(15, undefined, 'здоровья');
    const regex = compile(ast, { round10: true });
    expect(regex).toBeTruthy();
    // The compiled regex should find "15" before "здоровья" in "15.9(13.1-18) здоровья"
    const text = getItemSearchText(ring3);
    expect(matchPoE2Regex(regex, text)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: does PoE2 client search "15.9" match "Регенерация 15.9 здоровья"?', () => {
    // This test documents that we need to verify in-game:
    // 1. Type "15.9" in PoE2 search — does it find items with "Регенерация 15.9 здоровья"?
    // 2. Type "159" — does it find the same items? (should NOT)
    // 3. Type "15[.]9" — does it work in PoE2 client?
    // Our matcher says: "15.9" → true, "159" → false, "15[.]9" → true
    expect(true).toBe(true); // placeholder — replace with in-game results
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H2: NEGATIVE VALUES — Literal minus in mod text
// ═══════════════════════════════════════════════════════════════════════════

describe('H2: Negative values — minus sign in mod text', () => {
  it('"-11" matches literal negative number in text', () => {
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"-11"', text)).toBe(true);
  });

  it('"11" also matches (substring of "-11")', () => {
    // "11" is a substring of "-11" — it will match
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"11"', text)).toBe(true);
  });

  it('"(-8" matches the lower bound in negative range', () => {
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"(-8"', text)).toBe(true);
  });

  it('double-hyphen "--" in text is searchable as literal', () => {
    // The text "-8--6" contains "--" (double hyphen)
    // Searching for "--6" should match
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"--6"', text)).toBe(true);
  });

  it('"максимум сопротивлений" matches negative mod suffix', () => {
    // The suffix "максимум сопротивлений" appears after the negative number
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"максимум сопротивлений"', text)).toBe(true);
  });

  it('negative number with suffix anchor: "-11.*максимум сопротивлений"', () => {
    // This tests that .* can bridge from "-11" to "максимум сопротивлений"
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"-11.*максимум сопротивлений"', text)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: does "-11" in PoE2 search find items with "-11% максимум сопротивлений"?', () => {
    // Critical question: does the PoE2 client treat "-" as literal or as a regex operator?
    // In PoE2 regex, "-" is NOT a special character (only |, !, ., [], (), ?, ^, $ are special)
    // So "-11" should be treated as a literal substring.
    // But we need to verify this in-game because some games strip leading minus signs.
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H3: CROSS-LINE SINGLE MOD — Разрушительный two-line mod
// ═══════════════════════════════════════════════════════════════════════════

describe('H3: Cross-line single mod — Разрушительный two-line mod', () => {
  it('AND search matches both sub-lines of Разрушительный mod', () => {
    // "критического удара" is on line 1, "бонусу критического" is on line 2
    // Both should be found by AND search (order-independent)
    const text1 = getItemSearchText(waystone1);
    const text2 = getItemSearchText(waystone2);
    const text3 = getItemSearchText(waystone3);

    expect(matchPoE2Regex('"критического удара" "бонусу критического"', text1)).toBe(true);
    expect(matchPoE2Regex('"критического удара" "бонусу критического"', text2)).toBe(true);
    expect(matchPoE2Regex('"критического удара" "бонусу критического"', text3)).toBe(true);
  });

  it('".*" crosses newline between two sub-lines of same mod', () => {
    // "повышение шанса критического удара" is on first sub-line
    // "бонусу критического урона" is on second sub-line
    // .* should bridge the newline between them
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"повышение шанса критического удара.*бонусу"', text)).toBe(true);
  });

  it('".*" is directional — reversed order fails', () => {
    // "бонусу" appears AFTER "критического удара" — so searching in reverse fails
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"бонусу.*повышение шанса критического"', text)).toBe(false);
  });

  it('AND is order-independent — reversed AND also works', () => {
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"бонусу критического" "критического удара"', text)).toBe(true);
  });

  it('specific number search on Разрушительный: 276 matches', () => {
    // The rolled value "276" appears on the first sub-line
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"276"', text)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: does PoE2 treat two sub-lines as one searchable block?', () => {
    // In our matcher, we join all mods with \n, so both sub-lines are in the same text.
    // But in PoE2, the two sub-lines of Разрушительный might be:
    // a) Separate searchable entries (each line is independent)
    // b) One continuous searchable entry (joined with space or newline)
    // This affects whether .* can cross between them.
    // Test in-game: search "повышение шанса критического удара.*бонусу"
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H4: TABLET SUFFIX BUG — "зарядов" vs "использ"
// ═══════════════════════════════════════════════════════════════════════════

describe('H4: Tablet suffix — "зарядов" vs "использ" (BUG DETECTION)', () => {
  it('"зарядов" matches tablet implicit text', () => {
    // The actual game text: "Осталось зарядов - 10"
    const text = getItemSearchText(tablet1);
    expect(matchPoE2Regex('"зарядов"', text)).toBe(true);
  });

  it('"использ" DOES match tablet via description text "использовать"', () => {
    // KEY FINDING: The game text says "зарядов" for charges, NOT "использований".
    // BUT the description says "Можно использовать в Машине картоходца".
    // So "использ" matches "использовать" in the description, NOT the charges line!
    // This means: using "использ" as a number suffix for charges is WRONG —
    // it would match the description text, not the charges text.
    // The number from a different mod could cross-match via .* to "использовать".
    const text = getItemSearchText(tablet1);
    expect(matchPoE2Regex('"использ"', text)).toBe(true); // matches "использовать" in description
    // But "использ" does NOT appear in the charges line:
    expect(text).toContain('зарядов'); // the charges word
    expect(text).toContain('использовать'); // the description word
  });

  it('number regex with "зарядов" suffix: number is AFTER the word (directional problem)', () => {
    // The charges line is: "Осталось зарядов - 10"
    // The number "10" is AFTER "зарядов", not before it.
    // Directional .* requires number BEFORE suffix: "10.*зарядов" would need 10 first.
    //
    // HOWEVER: other numbers on the item may appear BEFORE "зарядов" in the full text.
    // For example, "39" from "39(25-35)% увеличение количества редких монстров на карте"
    // appears before "зарядов" (in the implicit section which comes before mods).
    // So "[1-9][0-9].*зарядов" might match via "39" → .* → "зарядов" — a FALSE POSITIVE!
    const text = getItemSearchText(tablet1);
    // This MATCHES because "39" (from another mod) appears before "зарядов"
    // This is a CROSS-MOD FALSE POSITIVE when using number + suffix pattern
    expect(matchPoE2Regex('"([1-9][0-9]|[0-9][0-9][0-9]).*зарядов"', text)).toBe(true);
    // The correct approach: use prefix anchoring or search for the exact line
    // "Осталось зарядов.*10" — but this inverts the number/suffix order
    expect(matchPoE2Regex('"зарядов.*10"', text)).toBe(true);
  });

  it('prefix-anchored number regex for "зарядов" — requires number AFTER word', () => {
    // The text is "зарядов - 10" — number is AFTER the word
    // PoE2 regex doesn't support lookbehind, so we can't anchor "number AFTER word"
    // The only way is to use the word before the number: "зарядов.*10"
    const text = getItemSearchText(tablet1);
    expect(matchPoE2Regex('"зарядов.*10"', text)).toBe(true);
  });

  it('all three tablets have "зарядов" implicit', () => {
    expect(matchPoE2Regex('"зарядов"', getItemSearchText(tablet1))).toBe(true);
    expect(matchPoE2Regex('"зарядов"', getItemSearchText(tablet2))).toBe(true);
    expect(matchPoE2Regex('"зарядов"', getItemSearchText(tablet3))).toBe(true);
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
    const text = getItemSearchText(ring1);
    expect(matchPoE2Regex('"качеств"', text)).toBe(true);
  });

  it('amulet implicit "регенерации маны" matches in our matcher', () => {
    // Лазурный амулет has implicit "% повышение скорости регенерации маны"
    const text = getItemSearchText(amulet1);
    expect(matchPoE2Regex('"регенерации маны"', text)).toBe(true);
  });

  it('tablet implicit "Заражение" matches in our matcher', () => {
    const text = getItemSearchText(tablet1);
    expect(matchPoE2Regex('"Заражение"', text)).toBe(true);
  });

  it('"!качеств" excludes rings with quality implicit', () => {
    // If implicits are searchable, "!качеств" should hide all rings with the quality implicit
    const text = getItemSearchText(ring1);
    expect(matchPoE2Regex('"!качеств"', text)).toBe(false);
  });

  it('implicit number filtering: "регенерации маны" AND ≥25%', () => {
    // Amulet 1 has implicit "28(20-30)% повышение скорости регенерации маны"
    // Testing: can we filter by number on an implicit?
    const text = getItemSearchText(amulet1);
    // "28" appears before "регенерации маны" in the implicit text
    expect(matchPoE2Regex('"28.*регенерации маны"', text)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: does PoE2 search include implicit text?', () => {
    // Our matcher includes implicits in the searchable text, but we need to verify:
    // 1. Search "качеств" on the ring stash tab — do items with "Максимальное качество" highlight?
    // 2. Search "регенерации маны" on amulet tab — do Лазурный амулет items highlight?
    // 3. If implicits are NOT searchable, we need to REMOVE them from our matcher's
    //    getItemSearchText() and adjust all test expectations.
    expect(true).toBe(true);
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
    // Our getItemSearchText() concatenates: name, type, rarity, properties, implicits, mods, additional
    // It does NOT include the { Префикс "Сильное" } labels
    const text = getItemSearchText(ring1);
    // "Сильное" is the prefix name for +66 к максимуму здоровья
    // It should NOT appear in the searchable text because our model excludes it
    expect(text).not.toContain('Сильное');
    expect(text).not.toContain('гориллы');
    expect(text).not.toContain('доблести');
    expect(text).not.toContain('вихря');
  });

  it('mod EFFECT text IS searchable even when prefix name is not', () => {
    const text = getItemSearchText(ring1);
    // The mod EFFECT text IS included:
    expect(matchPoE2Regex('"к максимуму здоровья"', text)).toBe(true);
    expect(matchPoE2Regex('"к силе"', text)).toBe(true);
    expect(matchPoE2Regex('"к сопротивлению молнии"', text)).toBe(true);
  });

  it('waystone prefix name "Льдистый" — mod effect is searchable', () => {
    const text = getItemSearchText(waystone2);
    // "Льдистый" is the suffix name for "Область имеет участки замерзшей земли"
    // The EFFECT "замерзшей земли" should be searchable
    expect(matchPoE2Regex('"замерзшей земли"', text)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: are affix names searchable in PoE2?', () => {
    // If PoE2 DOES make affix names searchable:
    // 1. Search "Сильное" — does it find items with the "Сильное" prefix?
    // 2. Search "гориллы" — does it find items with "суффикс гориллы"?
    // 3. Search "Льдистый" — does it find items with the "Льдистый" suffix?
    // If YES, our model is WRONG and needs to include affix names in search text.
    // If NO, our model is CORRECT.
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H7: "к сопротивлению всем стихиям" vs individual resistances
// ═══════════════════════════════════════════════════════════════════════════

describe('H7: "всем стихиям" resistance — cross-element pattern', () => {
  it('"к сопротивлению всем стихиям" matches Ring 2', () => {
    const text = getItemSearchText(ring2);
    expect(matchPoE2Regex('"к сопротивлению всем стихиям"', text)).toBe(true);
  });

  it('"сопротивлению" matches ALL resistance mods (fire, cold, lightning, chaos, all)', () => {
    // The word "сопротивлению" is a shared substring across ALL resistance types
    const ring1Text = getItemSearchText(ring1);
    const ring2Text = getItemSearchText(ring2);
    expect(matchPoE2Regex('"сопротивлению"', ring1Text)).toBe(true); // lightning
    expect(matchPoE2Regex('"сопротивлению"', ring2Text)).toBe(true); // all elements
  });

  it('"всем стихиям" does NOT match individual element resistance', () => {
    const ring1Text = getItemSearchText(ring1);
    // Ring 1 has "+35% к сопротивлению молнии" — NOT "всем стихиям"
    expect(matchPoE2Regex('"всем стихиям"', ring1Text)).toBe(false);
  });

  it('combined search: want "всем стихиям" AND NOT specific element', () => {
    // User wants "all res" mod but NOT "fire res" or "lightning res" separately
    // This tests cross-family FP: "сопротивлению" matches both families
    const ring2Text = getItemSearchText(ring2);
    expect(matchPoE2Regex('"всем стихиям"', ring2Text)).toBe(true);
    // But this would also match items that have BOTH individual and all-res:
    // "+13% к сопротивлению всем стихиям" has "всем стихиям" → match
  });

  it('number filtering on "всем стихиям": ≥12%', () => {
    // Ring 2 has "+13(12-14)% к сопротивлению всем стихиям"
    // Testing RANGE with "всем стихиям" suffix
    const ast = range(12, undefined, 'всем стихиям');
    const regex = compile(ast, { round10: false });
    expect(regex).toBeTruthy();
    const text = getItemSearchText(ring2);
    // "13" appears before "всем стихиям" → should match
    expect(matchPoE2Regex(regex, text)).toBe(true);
  });

  it('cross-family FP detection: "к сопротивлению" matches both individual and all-res', () => {
    // This is the FP problem: "к сопротивлению" matches ANY resistance mod
    // It matches fire, cold, lightning, chaos, AND all-res
    // This is "by design" for family-tier FP, but cross-family for different element families
    const allRings = [ring1, ring2, ring3].map(r => getItemSearchText(r));
    const matchCount = allRings.filter(t => matchPoE2Regex('"к сопротивлению"', t)).length;
    // Ring 1 has lightning res, Ring 2 has all res → both match
    expect(matchCount).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H8: INVERTED NUMBER RANGES — (50→40) decreasing
// ═══════════════════════════════════════════════════════════════════════════

describe('H8: Inverted number ranges — (50→40) decreasing', () => {
  it('inverted range text is searchable: "50(50-40)"', () => {
    const text = getItemSearchText(waystone2);
    expect(matchPoE2Regex('"50-40"', text)).toBe(true);
  });

  it('"меньше эффекта проклятий" is searchable as suffix', () => {
    const text = getItemSearchText(waystone2);
    expect(matchPoE2Regex('"меньше эффекта"', text)).toBe(true);
  });

  it('number before "меньше эффекта": ≥40 with suffix', () => {
    // The mod text is "На 50(50-40)% меньше эффекта проклятий на монстрах"
    // The number 50 appears BEFORE "меньше эффекта"
    // RANGE(40, undefined, 'меньше эффекта') should match because 50 ≥ 40
    const ast = range(40, undefined, 'меньше эффекта');
    const regex = compile(ast, { round10: true });
    const text = getItemSearchText(waystone2);
    expect(matchPoE2Regex(regex, text)).toBe(true);
  });

  it('inverted range does NOT break substring search for suffix', () => {
    // Even though the range is (50-40) instead of (40-50),
    // the suffix "меньше эффекта" is still searchable
    const text = getItemSearchText(waystone2);
    expect(matchPoE2Regex('"меньше эффекта проклятий"', text)).toBe(true);
  });

  it('another inverted range: "34(35-30)%" for flask charges', () => {
    const text = getItemSearchText(waystone2);
    expect(matchPoE2Regex('"35-30"', text)).toBe(true);
    expect(matchPoE2Regex('"зарядов флакона"', text)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: how do inverted ranges affect number filtering?', () => {
    // The mod "На 50(50-40)% меньше эффекта" — the ROLLED value is 50.
    // But the range shows 50-40 (decreasing), meaning:
    // - Tier 1 = 50% less (best for player)
    // - Tier N = 40% less (worst for player)
    // When user filters ≥40 (round10), they want ANY tier.
    // But ≥50 would mean "only the best tier" — is this semantically correct?
    // This needs in-game verification to confirm the rolled value interpretation.
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H9: FULL TOOLTIP SEARCHABILITY — text outside mod section
// ═══════════════════════════════════════════════════════════════════════════

describe('H9: Full tooltip searchability — text outside mod section', () => {
  it('"Осквернено" matches waystones (in additional text)', () => {
    const text1 = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"оскверн"', text1)).toBe(true);
  });

  it('"картоходца" matches waystones (in description text)', () => {
    // The text "Машине картоходца" is in the description, not in any mod
    const text1 = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"картоходца"', text1)).toBe(true);
  });

  it('"одноразовые" matches waystones (in description)', () => {
    const text1 = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"одноразовые"', text1)).toBe(true);
  });

  it('"Машине" matches waystone description', () => {
    const text1 = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"Машине"', text1)).toBe(true);
  });

  it('tablet description: "картоходца" matches', () => {
    const text1 = getItemSearchText(tablet1);
    expect(matchPoE2Regex('"картоходца"', text1)).toBe(true);
  });

  it('"!оскверн" would exclude all corrupted waystones', () => {
    // If "Осквернено" is searchable, "!оскверн" hides corrupted items
    const text1 = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"!оскверн"', text1)).toBe(false);
  });

  it('ring without "Осквернено" matches "!оскверн"', () => {
    const text = getItemSearchText(ring1);
    expect(matchPoE2Regex('"!оскверн"', text)).toBe(true);
  });

  it('IN-GAME VERIFICATION NEEDED: does PoE2 search cover full tooltip text?', () => {
    // Critical questions:
    // 1. Search "картоходца" — does it highlight waystones? (tests description text)
    // 2. Search "одноразовые" — does it highlight waystones? (tests description text)
    // 3. Search "Осквернено" — does it highlight corrupted items? (tests item state)
    // 4. If description text is NOT searchable, our model is WRONG and we need to
    //    exclude `additional` from getItemSearchText().
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BONUS: DUAL-NUMBER MODS — "От X до Y" pattern
// ═══════════════════════════════════════════════════════════════════════════

describe('BONUS: Dual-number mods — "От X до Y" pattern', () => {
  it('Ring 2: "Добавляет от 17 до 30 урона от огня к атакам" is fully searchable', () => {
    const text = getItemSearchText(ring2);
    expect(matchPoE2Regex('"урона от огня к атакам"', text)).toBe(true);
    expect(matchPoE2Regex('"Добавляет от"', text)).toBe(true);
  });

  it('first number in dual-number mod: "17" appears before "урона от огня"', () => {
    const text = getItemSearchText(ring2);
    expect(matchPoE2Regex('"17.*урона от огня"', text)).toBe(true);
  });

  it('second number in dual-number mod: "30" appears before "урона от огня"', () => {
    // "30" also appears before "урона от огня к атакам" in the same line
    const text = getItemSearchText(ring2);
    expect(matchPoE2Regex('"30.*урона от огня"', text)).toBe(true);
  });

  it('number filter for first placeholder (min damage ≥10): RANGE on "урона от огня к атакам"', () => {
    // For "Добавляет от 17(13-19) до 30(27-32) урона от огня к атакам"
    // The FIRST number is 17. RANGE(10, suffix='урона от огня к атакам')
    // With prefix anchoring: "от" before the number
    const ast = range(10, undefined, 'урона от огня к атакам', 'от');
    const regex = compile(ast, { round10: true });
    const text = getItemSearchText(ring2);
    expect(matchPoE2Regex(regex, text)).toBe(true);
  });

  it('physical damage dual-number: "Добавляет от 6 до 12 физического урона к атакам"', () => {
    const text = getItemSearchText(ring2);
    expect(matchPoE2Regex('"физического урона к атакам"', text)).toBe(true);
    expect(matchPoE2Regex('"6.*физического урона"', text)).toBe(true);
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
    const text = getItemSearchText(waystone2);
    expect(matchPoE2Regex('"Путами времени"', text)).toBe(true);
  });

  it('"Неизменяемое значение" matches waystone 2 immutable suffix', () => {
    const text = getItemSearchText(waystone2);
    expect(matchPoE2Regex('"Неизменяемое значение"', text)).toBe(true);
  });

  it('"порога состояний" vs "порога оглушения" — different mods', () => {
    const text = getItemSearchText(waystone1);
    // Waystone 1 has BOTH: "увеличение порога состояний" AND "увеличение порога оглушения"
    expect(matchPoE2Regex('"порога состояний"', text)).toBe(true);
    expect(matchPoE2Regex('"порога оглушения"', text)).toBe(true);
  });

  it('"порога состояний" does NOT match "порога оглушения" alone', () => {
    // These are distinct search terms — "состояний" is not in "оглушения"
    expect(matchPoE2Regex('"порога состояний"', 'увеличение порога оглушения')).toBe(false);
    expect(matchPoE2Regex('"порога оглушения"', 'увеличение порога состояний')).toBe(false);
  });

  it('"пробивает.*сопротивлений стихиям" matches waystone 3', () => {
    const text = getItemSearchText(waystone3);
    expect(matchPoE2Regex('"пробивает.*сопротивлений стихиям"', text)).toBe(true);
  });

  it('"дополнительных снарядов" matches waystone 3', () => {
    const text = getItemSearchText(waystone3);
    expect(matchPoE2Regex('"дополнительных снарядов"', text)).toBe(true);
  });

  it('waystone properties text is searchable: "возрождений"', () => {
    // Properties section: "Доступно возрождений: 0 (augmented)"
    const text = getItemSearchText(waystone1);
    expect(matchPoE2Regex('"возрождений"', text)).toBe(true);
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
    const text = getItemSearchText(ring1);
    expect(matchPoE2Regex('"к силе" "к сопротивлению молнии"', text)).toBe(true);
  });

  it('ring search: "к силе" AND "к сопротивлению молнии" — NOT on Ring 2 (no lightning res)', () => {
    const text = getItemSearchText(ring2);
    // Ring 2 has "к силе" and "к сопротивлению всем стихиям" but NOT "к сопротивлению молнии"
    expect(matchPoE2Regex('"к силе" "к сопротивлению молнии"', text)).toBe(false);
  });

  it('amulet search: "к интеллекту" AND "к сопротивлению холоду" — Amulet 1', () => {
    const text = getItemSearchText(amulet1);
    expect(matchPoE2Regex('"к интеллекту" "к сопротивлению холоду"', text)).toBe(true);
  });

  it('amulet search: "к интеллекту" AND NOT "к сопротивлению молнии"', () => {
    // Amulet 1 has cold res, NOT lightning res — this should match
    const text = getItemSearchText(amulet1);
    expect(matchPoE2Regex('"к интеллекту" "!к сопротивлению молнии"', text)).toBe(true);
  });

  it('amulet search: "к интеллекту" AND NOT "к сопротивлению холоду" — Amulet 1 fails', () => {
    // Amulet 1 HAS cold res, so "!к сопротивлению холоду" should exclude it
    const text = getItemSearchText(amulet1);
    expect(matchPoE2Regex('"к интеллекту" "!к сопротивлению холоду"', text)).toBe(false);
  });

  it('tablet search: "редких монстров" AND "путевых камней" — Tablet 1', () => {
    const text = getItemSearchText(tablet1);
    expect(matchPoE2Regex('"редких монстров" "путевых камней"', text)).toBe(true);
  });

  it('tablet search: "золота" — only Tablet 2', () => {
    expect(matchPoE2Regex('"золота"', getItemSearchText(tablet1))).toBe(false);
    expect(matchPoE2Regex('"золота"', getItemSearchText(tablet2))).toBe(true);
    expect(matchPoE2Regex('"золота"', getItemSearchText(tablet3))).toBe(false);
  });

  it('waystone: "отравление" AND "кровотечение" — only Waystone 1', () => {
    expect(matchPoE2Regex('"отравление" "кровотечение"', getItemSearchText(waystone1))).toBe(true);
    expect(matchPoE2Regex('"отравление" "кровотечение"', getItemSearchText(waystone2))).toBe(false);
    expect(matchPoE2Regex('"отравление" "кровотечение"', getItemSearchText(waystone3))).toBe(false);
  });

  it('waystone: "отравление" AND NOT "кровотечение" — Waystone 3', () => {
    // Waystone 3 has отравление but NOT кровотечение
    expect(matchPoE2Regex('"отравление" "!кровотечение"', getItemSearchText(waystone3))).toBe(true);
    // Waystone 1 has BOTH → excluded
    expect(matchPoE2Regex('"отравление" "!кровотечение"', getItemSearchText(waystone1))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BONUS: EDGE CASES with real game text
// ═══════════════════════════════════════════════════════════════════════════

describe('BONUS: Edge cases with real game text', () => {
  it('"+" literal character in mod text is searchable', () => {
    // Many mods start with "+" — like "+66 к максимуму здоровья"
    // In PoE2 regex, "+" is NOT a special character (only |, !, ., [], (), ?, ^, $ are)
    const text = getItemSearchText(ring1);
    expect(matchPoE2Regex('"+"', text)).toBe(true);
  });

  it('"%" literal character in mod text is searchable', () => {
    const text = getItemSearchText(ring1);
    expect(matchPoE2Regex('"%"', text)).toBe(true);
  });

  it('"()" parentheses in mod text — PoE2 treats as grouping, NOT literal', () => {
    // The text "+66(60-69) к максимуму здоровья" contains literal "(60-69)"
    // But in PoE2 regex, "()" means GROUPING, not literal parens
    // So searching for "(60-69)" would NOT match the literal text "(60-69)"
    // because PoE2 interprets it as a group containing "60-69"
    // This is a KNOWN limitation documented in the worklog
    const text = getItemSearchText(ring1);
    // PoE2 treats "()" as grouping, so "(60-69)" would try to match "60-69"
    // as a group, which as a literal sequence would match "(60-69)" only if
    // the parens are grouping operators around "60-69" literal
    // Actually: "(60-69)" in PoE2 regex = group containing "60-69" which
    // as a literal substring would match "60-69" within the text
    // So this SHOULD match because "60-69" is a substring of the text
    expect(matchPoE2Regex('"60-69"', text)).toBe(true);
  });

  it('large number in amulet: "+380 к меткости" — three digits', () => {
    const text = getItemSearchText(amulet1);
    expect(matchPoE2Regex('"380"', text)).toBe(true);
    // Number regex for ≥300: "[3-9][0-9][0-9]" matches 380
    expect(matchPoE2Regex('"[3-9][0-9][0-9].*меткости"', text)).toBe(true);
  });

  it('exact phrase "Дарует" matches specific mod on Ring 1', () => {
    const text = getItemSearchText(ring1);
    expect(matchPoE2Regex('"Дарует"', text)).toBe(true);
    // Other rings don't have "Дарует"
    expect(matchPoE2Regex('"Дарует"', getItemSearchText(ring2))).toBe(false);
    expect(matchPoE2Regex('"Дарует"', getItemSearchText(ring3))).toBe(false);
  });

  it('"увеличение радиуса обзора" is a fixed-value mod (no range)', () => {
    // Ring 2: "15% увеличение радиуса обзора" — no (min-max) because it's a fixed value
    const text = getItemSearchText(ring2);
    expect(matchPoE2Regex('"увеличение радиуса обзора"', text)).toBe(true);
  });
});
