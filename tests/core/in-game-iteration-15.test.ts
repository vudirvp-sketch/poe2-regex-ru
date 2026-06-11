/**
 * In-Game Test Results — Iteration 15
 *
 * Tests based on REAL in-game items (uploaded by user 2026-06-12).
 * Items: 3 Кольца Разлома, 3 Путевых камня, 3 Заражённые плитки, 3 Лазурных амулета.
 *
 * Test cases:
 * T1. "приспешник" — no item with such mod in test set → PENDING (need item with minion mod)
 * T2. Threshold "отравление" ≥34% — verified in-game ✅
 * T3. .* cross-block bridge — verified in-game: .* does NOT cross block boundaries ✅
 */
import { describe, it, expect } from 'vitest';
import {
  matchPoE2RegexItem,
  matchPoE2Regex,
  type GameItemText,
} from '@core/poe2-regex-matcher';

// ═══════════════════════════════════════════════════════════════════════════
// REAL IN-GAME ITEMS (from uploaded test data)
// ═══════════════════════════════════════════════════════════════════════════

// --- Кольца Разлома ---

const otvratitelnoePotryasenie: GameItemText = {
  name: 'Отвратительное потрясение',
  type: 'Кольцо Разлома',
  properties: [
    'Требуется: Уровень 60',
    'Уровень предмета: 82',
    'Максимальное качество равно 40%',
  ],
  mods: [
    '+66 к максимуму здоровья',
    '28% увеличение урона от огня',
    '+121 к уклонению',
    '+23 к силе',
    'Дарует 49 здоровья за каждого убитого врага',
    '+35% к сопротивлению молнии',
  ],
};

const raskolotyiZavitok: GameItemText = {
  name: 'Расколотый завиток',
  type: 'Кольцо Разлома',
  properties: [
    'Требуется: Уровень 59',
    'Уровень предмета: 82',
    'Максимальное качество равно 40%',
  ],
  implicits: [
    'Добавляет от 17 до 30 урона от огня к атакам',
    'Добавляет от 6 до 12 физического урона к атакам',
    'Добавляет от 2 до 36 урона от молнии к атакам',
  ],
  mods: [
    '19% повышение скорости регенерации маны',
    '15% увеличение радиуса обзора',
    '+32 к силе',
    '+13% к сопротивлению всем стихиям',
  ],
};

const nenavistnoePotryasenie: GameItemText = {
  name: 'Ненавистное потрясение',
  type: 'Кольцо Разлома',
  properties: [
    'Требуется: Уровень 40',
    'Уровень предмета: 82',
    'Максимальное качество равно 40%',
  ],
  mods: [
    '15% увеличение урона хаосом',
    'Добавляет от 5 до 9 физического урона к атакам',
    '+59 к максимуму маны',
    'Регенерация 15.9 здоровья в секунду',
    '18% повышение редкости найденных предметов',
  ],
};

// --- Путевые камни ---

const prizrachnyiKamen: GameItemText = {
  name: 'Призрачный камень',
  type: 'Путевой камень (Ур. 15)',
  properties: [
    'Уровень предмета: 81',
    'Доступно возрождений: 0',
  ],
  mods: [
    'Редкость предметов: +18%',
    'Размер групп монстров: +30%',
    'Эффективность монстров: +57%',
    'Шанс выпадения путевого камня: +85%',
    'Монстры с 36% шансом могут наложить отравление при нанесении удара',
    'Монстры с 18% шансом могут наложить кровотечение при нанесении удара',
    'Монстры имеют 276% повышение шанса критического удара',
    '+28% к бонусу критического урона монстров',
    '-11% максимум сопротивлений игроков',
    '125% усиление наложения стихийных состояний у монстров',
    'Монстры имеют 70% увеличение порога состояний',
    'Монстры имеют 76% увеличение порога оглушения',
  ],
};

const izmenennyiProgress: GameItemText = {
  name: 'Изменённый прогресс',
  type: 'Путевой камень (Ур. 15)',
  properties: [
    'Уровень предмета: 82',
    'Доступно возрождений: 0',
  ],
  mods: [
    'Редкость предметов: +36%',
    'Размер групп монстров: +30%',
    'Эффективность монстров: +30%',
    'Шанс выпадения путевого камня: +90%',
    'Монстры имеют 273% повышение шанса критического удара',
    '+26% к бонусу критического урона монстров',
    'Монстры имеют 125% увеличение накопления шкалы оглушения',
    'На 50% меньше эффекта проклятий на монстрах',
    'Игроки получают уменьшение зарядов флакона на 34%',
    'Область имеет участки замерзшей земли',
    'Область проклята Путами времени — Неизменяемое значение',
  ],
};

const razrushennyiKoridor: GameItemText = {
  name: 'Разрушенный коридор',
  type: 'Путевой камень (Ур. 15)',
  properties: [
    'Уровень предмета: 79',
    'Доступно возрождений: 0',
  ],
  mods: [
    'Редкость предметов: +25%',
    'Размер групп монстров: +43%',
    'Эффективность монстров: +30%',
    'Шанс выпадения путевого камня: +110%',
    'Монстры выпускают дополнительных снарядов: 2',
    'Скорость атаки, сотворения чар и передвижения монстров повышена на 10%',
    'Монстры имеют 125% увеличение накопления шкалы оглушения',
    'Монстры с 36% шансом могут наложить отравление при нанесении удара',
    'Урон монстров пробивает 13% сопротивлений стихиям',
    'Монстры имеют 297% повышение шанса критического удара',
    '+26% к бонусу критического урона монстров',
  ],
};

// --- Заражённые плитки ---

const potustoronniiOrder: GameItemText = {
  name: 'Потусторонний ордер',
  type: 'Заражённая плитка',
  properties: [
    'Уровень предмета: 79',
  ],
  mods: [
    'Добавляет Заражение на карту',
    'Осталось зарядов - 10',
    '39% увеличение количества редких монстров на карте',
    '18% увеличение редкости находимых на карте предметов',
    'На карте с увеличенным на 82% шансом можно встретить Сущности',
    '34% увеличение количества находимых на карте путевых камней',
  ],
};

const feniksovoePobuzhdenie: GameItemText = {
  name: 'Фениксовое побуждение',
  type: 'Заражённая плитка',
  properties: [
    'Уровень предмета: 79',
  ],
  mods: [
    'Добавляет Заражение на карту',
    'Осталось зарядов - 10',
    '27% увеличение количества редких монстров на карте',
    '33% увеличение количества находимого на карте золота',
    '43% увеличение количества находимых на карте путевых камней',
    'Уникальные монстры имеют дополнительных свойств: 1',
  ],
};

const feniksovyiNakaz: GameItemText = {
  name: 'Фениксовый наказ',
  type: 'Заражённая плитка',
  properties: [
    'Уровень предмета: 81',
  ],
  mods: [
    'Добавляет Заражение на карту',
    'Осталось зарядов - 10',
    '57% увеличение количества волшебных монстров на карте',
    '21% увеличение редкости находимых на карте предметов',
    '39% увеличение количества находимых на карте путевых камней',
    'На карте с увеличенным на 73% шансом можно встретить духов азмири',
  ],
};

// --- Амулеты ---

const unyliiFermuar: GameItemText = {
  name: 'Унылый фермуар',
  type: 'Лазурный амулет',
  properties: [
    'Требуется: Уровень 59',
    'Уровень предмета: 79',
  ],
  mods: [
    '28% повышение скорости регенерации маны',
    '43% увеличение уклонения',
    '29% увеличение максимума энергетического щита',
    '+380 к меткости',
    '15% повышение шанса критического удара',
    '+12% к сопротивлению холоду',
    '+33 к интеллекту',
  ],
};

const krutyashchiiGorozhet: GameItemText = {
  name: 'Крутящий горжет',
  type: 'Лазурный амулет',
  properties: [
    'Требуется: Уровень 52',
    'Уровень предмета: 79',
  ],
  mods: [
    '25% повышение скорости регенерации маны',
    '+184 к меткости',
    '+62 к максимуму энергетического щита',
    '30% увеличение максимума энергетического щита',
    '+24% к сопротивлению молнии',
    '14% полученного урона восполняется в виде здоровья',
    '+14 к ловкости',
  ],
};

const plemennoiMedalon: GameItemText = {
  name: 'Племенной медальон',
  type: 'Лазурный амулет',
  properties: [
    'Требуется: Уровень 60',
    'Уровень предмета: 78',
  ],
  mods: [
    '27% повышение скорости регенерации маны',
    '+35 к меткости',
    '+17 к максимуму здоровья',
    '+55 к максимуму маны',
    '+34% к сопротивлению молнии',
    '+14% к сопротивлению хаосу',
    'Регенерация 30.9 здоровья в секунду',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// ALL TEST ITEMS
// ═══════════════════════════════════════════════════════════════════════════

const allItems: GameItemText[] = [
  otvratitelnoePotryasenie,
  raskolotyiZavitok,
  nenavistnoePotryasenie,
  prizrachnyiKamen,
  izmenennyiProgress,
  razrushennyiKoridor,
  potustoronniiOrder,
  feniksovoePobuzhdenie,
  feniksovyiNakaz,
  unyliiFermuar,
  krutyashchiiGorozhet,
  plemennoiMedalon,
];

// ═══════════════════════════════════════════════════════════════════════════
// T1. ПРИСПЕШНИК — PENDING (no test item with minion mod)
// ═══════════════════════════════════════════════════════════════════════════

describe('T1. "приспешник" — minion mod search', () => {
  it('no item in test set has "приспешник" mod — test PENDING', () => {
    // Verify: none of the current test items contain "приспешник"
    const hasMinionMod = allItems.some(item => {
      const blocks = [
        ...(item.mods ?? []),
        ...(item.implicits ?? []),
        ...(item.properties ?? []),
      ];
      return blocks.some(b => b.toLowerCase().includes('приспешник'));
    });
    expect(hasMinionMod).toBe(false);
  });

  it('regex "приспешник" correctly rejects items without the mod', () => {
    // None of our test items should match "приспешник"
    const matched = allItems.filter(item =>
      matchPoE2RegexItem('"приспешник"', item)
    );
    expect(matched).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T2. THRESHOLD — "отравление" ≥34% on waystones
// ═══════════════════════════════════════════════════════════════════════════

describe('T2. Threshold "отравление" ≥34% on waystone suffix', () => {
  // Enumeration regex: "Монстры с (3[4-9]|[4-9][0-9]|\d{3,})%.*отравление"
  // Threshold ≥34: same regex form
  const thresholdRegex = '"Монстры с (3[4-9]|[4-9][0-9]|\\d{3,})%.*отравление"';

  it('Призрачный камень (36% ≥ 34) → MATCH', () => {
    expect(matchPoE2RegexItem(thresholdRegex, prizrachnyiKamen)).toBe(true);
  });

  it('Разрушенный коридор (36% ≥ 34) → MATCH', () => {
    expect(matchPoE2RegexItem(thresholdRegex, razrushennyiKoridor)).toBe(true);
  });

  it('Кровотечение (18% < 34) does NOT match threshold regex for "отравление"', () => {
    // Verify the bleeding mod on Призрачный камень does NOT match our threshold regex
    // The bleeding mod is "Монстры с 18% шансом могут наложить кровотечение..."
    // 18% < 34% so it should not match
    const bleedOnlyText = 'Монстры с 18% шансом могут наложить кровотечение при нанесении удара';
    expect(matchPoE2Regex(thresholdRegex, bleedOnlyText)).toBe(false);
  });

  it('Изменённый прогресс (no отравление mod) → NO MATCH', () => {
    expect(matchPoE2RegexItem(thresholdRegex, izmenennyiProgress)).toBe(false);
  });

  it('exact 34% would match threshold ≥34', () => {
    const item34: GameItemText = {
      name: 'Test Waystone 34%',
      type: 'Путевой камень (Ур. 15)',
      mods: ['Монстры с 34% шансом могут наложить отравление при нанесении удара'],
    };
    expect(matchPoE2RegexItem(thresholdRegex, item34)).toBe(true);
  });

  it('33% does NOT match threshold ≥34', () => {
    const item33: GameItemText = {
      name: 'Test Waystone 33%',
      type: 'Путевой камень (Ур. 15)',
      mods: ['Монстры с 33% шансом могут наложить отравление при нанесении удара'],
    };
    expect(matchPoE2RegexItem(thresholdRegex, item33)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T3. .* CROSS-BLOCK BRIDGE — Расколотый завиток
// ═══════════════════════════════════════════════════════════════════════════

describe('T3. .* does NOT bridge across block boundaries', () => {
  // Расколотый завиток:
  //   implicit: "Добавляет от 17 до 30 урона от огня к атакам"
  //   mod: "+32 к силе"
  //   mod: "+13% к сопротивлению всем стихиям"

  it('"уклонению.*огня" — NO MATCH (different blocks on Расколотый завиток)', () => {
    // Расколотый завиток doesn't have "уклонению" at all
    expect(matchPoE2RegexItem('"уклонению.*огня"', raskolotyiZavitok)).toBe(false);
  });

  it('"огня.*уклонению" — NO MATCH (reversed, different blocks)', () => {
    expect(matchPoE2RegexItem('"огня.*уклонению"', raskolotyiZavitok)).toBe(false);
  });

  it('"огня.*силе" — NO MATCH (огня in implicit block, силе in mod block)', () => {
    // "Добавляет от 17 до 30 урона от огня к атакам" has "огня"
    // "+32 к силе" has "силе"
    // .* cannot bridge between these two blocks
    expect(matchPoE2RegexItem('"огня.*силе"', raskolotyiZavitok)).toBe(false);
  });

  it('"огня.*атакам" — MATCH (within same implicit block)', () => {
    // "Добавляет от 17 до 30 урона от огня к атакам" — "огня" and "атакам" in SAME block
    expect(matchPoE2RegexItem('"огня.*атакам"', raskolotyiZavitok)).toBe(true);
  });

  it('AND across blocks works: "огня" "силе" — MATCH', () => {
    // AND (space-separated quoted groups) crosses blocks:
    // "огня" matches implicit block, "силе" matches mod block
    expect(matchPoE2RegexItem('"огня" "силе"', raskolotyiZavitok)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T3 EXTENDED: .* bridge on Отвратительное потрясение
// ═══════════════════════════════════════════════════════════════════════════

describe('T3 extended: .* does NOT bridge on Отвратительное потрясение', () => {
  // Отвратительное потрясение mods (all in separate blocks):
  //   "+66 к максимуму здоровья"
  //   "28% увеличение урона от огня"
  //   "+121 к уклонению"
  //   "+23 к силе"
  //   ...

  it('"уклонению.*огня" — NO MATCH (different mod blocks)', () => {
    // "+121 к уклонению" and "28% увеличение урона от огня" are separate blocks
    expect(matchPoE2RegexItem('"уклонению.*огня"', otvratitelnoePotryasenie)).toBe(false);
  });

  it('"огня.*уклонению" — NO MATCH (different mod blocks, reversed)', () => {
    expect(matchPoE2RegexItem('"огня.*уклонению"', otvratitelnoePotryasenie)).toBe(false);
  });

  it('"уклонению" "огня" — MATCH (AND crosses blocks)', () => {
    expect(matchPoE2RegexItem('"уклонению" "огня"', otvratitelnoePotryasenie)).toBe(true);
  });

  it('"огня" "уклонению" — MATCH (AND is order-independent)', () => {
    expect(matchPoE2RegexItem('"огня" "уклонению"', otvratitelnoePotryasenie)).toBe(true);
  });
});
