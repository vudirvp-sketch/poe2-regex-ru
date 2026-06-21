/**
 * Block Sort Rules Tests — validates per-block canonical within-block ordering.
 *
 * iter 112: introduces systematic within-block ordering for 4 functional blocks
 * (resistances, attributes, minions, ailments).
 * iter 113: adds damage-type block (47 family-keys, most visible category).
 * iter 114: adds defence-stats block (28 family-keys, second-most-visible defensive block).
 * iter 115: adds resources block (29 family-keys — Health/Mana/ES pools + conversion).
 * iter 116: adds weapon-specific (24 family-keys, jewel-only) + flasks (16 family-keys, belt+jewel).
 * iter 117: adds offence-speed (12 family-keys) + crit (9 family-keys) + buff-skills (7 family-keys).
 *
 * These tests verify:
 *  1. computeSortKey() returns expected order for canonical family-keys.
 *  2. sortGroupsAlphabetically() uses sortKey when set (production path).
 *  3. sortGroupsAlphabetically() falls back to familyKey when sortKey missing.
 *  4. End-to-end: groupTokensByFamily() → classifyGroups() → sortGroupsAlphabetically()
 *     produces the user-requested canonical order.
 */
import { describe, it, expect } from 'vitest';
import { computeSortKey, BLOCK_SORT_RULES } from '@shared/block-sort-rules';
import {
  sortGroupsAlphabetically,
  classifyGroups,
} from '@shared/mod-classifier';
import { groupTokensByFamily } from '@shared/family-grouper';
import type { GameToken, FamilyGroup } from '@shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeToken(
  familyKey: string,
  functionalCategory: string,
  affix: 'prefix' | 'suffix' = 'suffix',
): GameToken {
  return {
    id: `test_${familyKey}_${affix}_${Math.random().toString(36).slice(2)}`,
    category: 'amulet',
    origin: 'normal',
    rawText: { ru: familyKey },
    rawTextTemplate: { ru: familyKey },
    regex: { ru: '' },
    familyKey: { ru: familyKey },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
    functionalCategory,
    genderForms: { ru: {} },
    affix,
    tags: [],
    ranges: [],
    values: [],
    hasYofication: false,
    yoficationPositions: [],
    level: 1,
  };
}

function makeGroup(
  familyKey: string,
  sortKey?: string,
  priorityTier: 'S' | 'A' | 'B' | 'C' = 'C',
): FamilyGroup {
  return {
    familyKey,
    affix: 'suffix',
    members: [],
    globalMin: 0,
    globalMax: 0,
    displayText: familyKey,
    hasMultiPlaceholder: false,
    rangeSlots: [],
    filterSlotIndex: 0,
    priorityTier,
    ...(sortKey !== undefined ? { sortKey } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: computeSortKey — per-block canonical ordering
// ═══════════════════════════════════════════════════════════════════════════

describe('computeSortKey (iter 112)', () => {
  it('returns 999:: prefix for blocks with no rules (preserves alpha order)', () => {
    // 'spirit' has no rules in BLOCK_SORT_RULES
    const key = computeSortKey('spirit', '+# к духу');
    expect(key).toMatch(/^999::/);
    expect(key).toContain('+# к духу');
  });

  it('returns 999:: prefix for unknown blocks', () => {
    const key = computeSortKey('nonexistent-block', 'some text');
    expect(key).toMatch(/^999::/);
  });

  it('returns 900:: prefix when block has rules but no rule matches', () => {
    // 'resistances' has rules but a completely-unrelated family-key won't match
    const key = computeSortKey('resistances', 'Совершенно unrelated text');
    expect(key).toMatch(/^900::/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: resistances block — chaos → lightning → cold → fire
// ═══════════════════════════════════════════════════════════════════════════

describe('resistances sortKey (iter 112: chaos → lightning → cold → fire)', () => {
  const cases: Array<{ familyKey: string; expectedOrder: number; comment: string }> = [
    // Single-element regular (0-3)
    { familyKey: '+#% к сопротивлению хаосу', expectedOrder: 0, comment: 'chaos' },
    { familyKey: '+#% к сопротивлению молнии', expectedOrder: 1, comment: 'lightning' },
    { familyKey: '+#% к сопротивлению холоду', expectedOrder: 2, comment: 'cold' },
    { familyKey: '+#% к сопротивлению огню', expectedOrder: 3, comment: 'fire' },
    // Dual-element (4-6)
    { familyKey: '+#% к сопротивлениям молнии и хаосу', expectedOrder: 4, comment: 'lightning+chaos' },
    { familyKey: '+#% к сопротивлениям холоду и хаосу', expectedOrder: 5, comment: 'cold+chaos' },
    { familyKey: '+#% к сопротивлениям огню и хаосу', expectedOrder: 6, comment: 'fire+chaos' },
    // All-elements (7-8)
    { familyKey: '+#% к сопротивлению всем стихиям', expectedOrder: 7, comment: 'all-elements regular' },
    { familyKey: '+#% к максимуму сопротивлений всем стихиям', expectedOrder: 8, comment: 'all-elements max' },
    // Max-resist single (10-13)
    { familyKey: '+#% к максимальному сопротивлению хаосу', expectedOrder: 10, comment: 'chaos max' },
    { familyKey: '+#% к максимальному сопротивлению молнии', expectedOrder: 11, comment: 'lightning max' },
    { familyKey: '+#% к максимальному сопротивлению холоду', expectedOrder: 12, comment: 'cold max' },
    { familyKey: '+#% к максимальному сопротивлению огню', expectedOrder: 13, comment: 'fire max' },
    // Meta-mod (20)
    { familyKey: '#% повышение значений добавленных свойств сопротивлений', expectedOrder: 20, comment: 'meta: added-resist props' },
    // Passive-tree granted (30-33)
    { familyKey: 'Значимые пассивные умения в радиусе также дают: +#% к сопротивлению хаосу', expectedOrder: 30, comment: 'passive chaos' },
    { familyKey: 'Значимые пассивные умения в радиусе также дают: +#% к сопротивлению молнии', expectedOrder: 31, comment: 'passive lightning' },
    { familyKey: 'Значимые пассивные умения в радиусе также дают: +#% к сопротивлению холоду', expectedOrder: 32, comment: 'passive cold' },
    { familyKey: 'Значимые пассивные умения в радиусе также дают: +#% к сопротивлению огню', expectedOrder: 33, comment: 'passive fire' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`resistances: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('resistances', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('resistances: full canonical order (chaos → lightning → cold → fire)', () => {
    const keys = [
      '+#% к сопротивлению огню',
      '+#% к сопротивлению хаосу',
      '+#% к сопротивлению холоду',
      '+#% к сопротивлению молнии',
    ];
    const sortKeys = keys.map(k => computeSortKey('resistances', k)).sort();
    // After sort: chaos(00) < lightning(01) < cold(02) < fire(03)
    expect(sortKeys[0]).toContain('хаосу');
    expect(sortKeys[1]).toContain('молнии');
    expect(sortKeys[2]).toContain('холоду');
    expect(sortKeys[3]).toContain('огню');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: attributes block — Сила → Ловкость → Интеллект → Все → dual → tri-or → reduction
// ═══════════════════════════════════════════════════════════════════════════

describe('attributes sortKey (iter 112: Сила → Ловкость → Интеллект)', () => {
  const cases: Array<{ familyKey: string; expectedOrder: number; comment: string }> = [
    { familyKey: '+# к силе', expectedOrder: 0, comment: 'Сила flat' },
    { familyKey: '+# к ловкости', expectedOrder: 1, comment: 'Ловкость flat' },
    { familyKey: '+# к интеллекту', expectedOrder: 2, comment: 'Интеллект flat' },
    { familyKey: '+# ко всем характеристикам', expectedOrder: 3, comment: 'all attrs flat' },
    { familyKey: '+# к силе и ловкости', expectedOrder: 4, comment: 'Сила+Ловкость' },
    { familyKey: '+# к силе и интеллекту', expectedOrder: 5, comment: 'Сила+Интеллект' },
    { familyKey: '+# к ловкости и интеллекту', expectedOrder: 6, comment: 'Ловкость+Интеллект' },
    { familyKey: '+# к силе, ловкости или интеллекту', expectedOrder: 7, comment: 'tri-or flat' },
    { familyKey: '#% повышение силы', expectedOrder: 10, comment: 'Сила %' },
    { familyKey: '#% повышение ловкости', expectedOrder: 11, comment: 'Ловкость %' },
    { familyKey: '#% повышение интеллекта', expectedOrder: 12, comment: 'Интеллект %' },
    { familyKey: '#% увеличение силы, ловкости или интеллекта', expectedOrder: 13, comment: 'tri-or %' },
    { familyKey: '#% уменьшение требований к характеристикам у снаряжения и камней умений', expectedOrder: 20, comment: 'requirement reduction' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`attributes: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('attributes', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('attributes: flat single-attr order Сила → Ловкость → Интеллект', () => {
    const keys = [
      '+# к интеллекту',  // alpha-first
      '+# к ловкости',
      '+# к силе',
    ];
    const sortKeys = keys.map(k => computeSortKey('attributes', k)).sort();
    expect(sortKeys[0]).toContain('силе');
    expect(sortKeys[1]).toContain('ловкости');
    expect(sortKeys[2]).toContain('интеллекту');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: minions block — subject → stat ordering
// ═══════════════════════════════════════════════════════════════════════════

describe('minions sortKey (iter 112: subject → stat)', () => {
  it('minions: Companion health before Companion damage', () => {
    const health = computeSortKey('minions', '#% увеличение максимума здоровья компаньонов');
    const damage = computeSortKey('minions', 'Компаньоны наносят увеличенный на #% урон');
    expect(health.localeCompare(damage, 'ru')).toBeLessThan(0);
  });

  it('minions: Companion mods (order 0-99) before Minion mods (order 100+)', () => {
    const companion = computeSortKey('minions', 'Компаньоны наносят увеличенный на #% урон');
    const minion = computeSortKey('minions', 'Приспешники имеют #% увеличение максимума здоровья');
    expect(companion.localeCompare(minion, 'ru')).toBeLessThan(0);
  });

  it('minions: Minion health (100) before Minion damage (110)', () => {
    const health = computeSortKey('minions', 'Приспешники имеют #% увеличение максимума здоровья');
    const damage = computeSortKey('minions', 'Приспешники имеют #% увеличение урона');
    expect(health.localeCompare(damage, 'ru')).toBeLessThan(0);
  });

  it('minions: Minion damage (110) before Minion crit (120)', () => {
    const damage = computeSortKey('minions', 'Приспешники имеют #% увеличение урона');
    const crit = computeSortKey('minions', 'Приспешники имеют #% повышение шанса критического удара');
    expect(damage.localeCompare(crit, 'ru')).toBeLessThan(0);
  });

  it('minions: Minion crit (120) before Minion speed (130)', () => {
    const crit = computeSortKey('minions', 'Приспешники имеют #% повышение шанса критического удара');
    const speed = computeSortKey('minions', 'Приспешники имеют #% повышение скорости атаки и сотворения чар');
    expect(crit.localeCompare(speed, 'ru')).toBeLessThan(0);
  });

  it('minions: user-reported "каша" case — all 4 chips ordered correctly', () => {
    // The 4 chips from user's bug report (jewel page):
    // 1. (5—10)% увеличение максимума здоровья компаньонов       → Companion health
    // 2. Компаньоны наносят увеличенный на (5—10)% урон          → Companion damage
    // 3. Приспешники имеют (4—8)% увеличение максимума здоровья  → Minion health
    // 4. Приспешники имеют (4—8)% увеличение урона               → Minion damage
    const keys = [
      '#% увеличение максимума здоровья компаньонов',
      'Компаньоны наносят увеличенный на #% урон',
      'Приспешники имеют #% увеличение максимума здоровья',
      'Приспешники имеют #% увеличение урона',
    ];
    const sortKeys = keys.map(k => computeSortKey('minions', k)).sort();
    // Expected order: companion health → companion damage → minion health → minion damage
    expect(sortKeys[0]).toContain('здоровья компаньонов');
    expect(sortKeys[1]).toContain('Компаньоны наносят');
    expect(sortKeys[2]).toContain('Приспешники имеют #% увеличение максимума здоровья');
    expect(sortKeys[3]).toContain('Приспешники имеют #% увеличение урона');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: ailments block — operation → state ordering
// ═══════════════════════════════════════════════════════════════════════════

describe('ailments sortKey (iter 112: operation → state)', () => {
  it('ailments: "увеличение силы" (0-10) before "увеличение шанса" (100-103)', () => {
    const strength = computeSortKey('ailments', '#% увеличение силы истощения');
    const chance = computeSortKey('ailments', '#% увеличение шанса наложения шока');
    expect(strength.localeCompare(chance, 'ru')).toBeLessThan(0);
  });

  it('ailments: "увеличение шанса" (100s) before "увеличение длительности" (200s)', () => {
    const chance = computeSortKey('ailments', '#% увеличение шанса наложения шока');
    const duration = computeSortKey('ailments', '#% увеличение длительности шока');
    expect(chance.localeCompare(duration, 'ru')).toBeLessThan(0);
  });

  it('ailments: "увеличение длительности" (200s) before "уменьшение длительности" (300s)', () => {
    const increase = computeSortKey('ailments', '#% увеличение длительности шока');
    const decrease = computeSortKey('ailments', '#% уменьшение длительности шока на вас');
    expect(increase.localeCompare(decrease, 'ru')).toBeLessThan(0);
  });

  it('ailments: Abyss-Depletion (Истощения Бездны) first in "увеличение силы" group', () => {
    const abyss = computeSortKey('ailments', '(#)% увеличение силы накладываемого вами Истощения Бездны');
    const regular = computeSortKey('ailments', '#% увеличение силы истощения');
    expect(abyss.localeCompare(regular, 'ru')).toBeLessThan(0);
  });

  it('ailments: bleed chain in strength group: Abyss → regular истощение → кровотечение → отравление → поджог → шок', () => {
    const keys = [
      '#% увеличение силы поджога',
      '#% увеличение силы накладываемого вами шока',
      '#% увеличение силы накладываемого вами Истощения Бездны',
      '#% увеличение силы истощения',
      '#% увеличение силы накладываемого вами кровотечения',
      '#% увеличение силы накладываемого вами отравления',
    ];
    const sortKeys = keys.map(k => computeSortKey('ailments', k)).sort();
    expect(sortKeys[0]).toContain('Истощения Бездны');
    expect(sortKeys[1]).toContain('силы истощения');
    expect(sortKeys[2]).toContain('кровотечения');
    expect(sortKeys[3]).toContain('отравления');
    expect(sortKeys[4]).toContain('силы поджога');
    expect(sortKeys[5]).toContain('шока');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5b: damage-type block — physical → fire → cold → lightning → chaos → elemental → generic/by-source → conditional → by-target → special
// ═══════════════════════════════════════════════════════════════════════════

describe('damage-type sortKey (iter 113: physical → fire → cold → lightning → chaos → elemental → by-source → conditional → by-target → special)', () => {
  const cases: Array<{ familyKey: string; expectedOrder: number; comment: string }> = [
    // Physical (0-9)
    { familyKey: '#% увеличение глобального физического урона', expectedOrder: 0, comment: 'physical: global %' },
    { familyKey: 'Добавляет от # до # физического урона к атакам', expectedOrder: 1, comment: 'physical: added to attacks' },
    { familyKey: 'От # до # физического урона шипами', expectedOrder: 2, comment: 'physical: thorns flat' },
    // Fire (10-19)
    { familyKey: '#% увеличение урона от огня', expectedOrder: 10, comment: 'fire: increase generic' },
    { familyKey: 'Добавляет от # до # урона от огня к атакам', expectedOrder: 11, comment: 'fire: added to attacks' },
    { familyKey: '(#)% увеличение урона от огня, если вы подобрали Огненное насыщение за последние 8 секунд', expectedOrder: 12, comment: 'fire: saturation-conditional' },
    { familyKey: 'Наносит #% урона чарами в виде дополнительного урона от огня', expectedOrder: 13, comment: 'fire: conversion' },
    { familyKey: 'От # до # урона от огня шипами за каждые 100 максимума здоровья', expectedOrder: 14, comment: 'fire: thorns per 100 max HP' },
    // Cold (20-29)
    { familyKey: '#% увеличение урона от холода', expectedOrder: 20, comment: 'cold: increase generic' },
    { familyKey: 'Добавляет от # до # урона от холода к атакам', expectedOrder: 21, comment: 'cold: added to attacks' },
    { familyKey: '(#)% увеличение урона от холода, если вы подобрали Холодное насыщение за последние 8 секунд', expectedOrder: 22, comment: 'cold: saturation-conditional' },
    { familyKey: 'Дарует #% от физического урона в виде дополнительного урона от холода', expectedOrder: 23, comment: 'cold: phys→cold conversion (Дарует)' },
    { familyKey: 'Наносит #% урона чарами в виде дополнительного урона от холода', expectedOrder: 24, comment: 'cold: conversion (Наносит)' },
    // Lightning (30-39)
    { familyKey: '#% увеличение урона от молнии', expectedOrder: 30, comment: 'lightning: increase generic' },
    { familyKey: 'Добавляет от # до # урона от молнии к атакам', expectedOrder: 31, comment: 'lightning: added to attacks' },
    { familyKey: '(#)% увеличение урона от молнии, если вы подобрали Молниевое насыщение за последние 8 секунд', expectedOrder: 32, comment: 'lightning: saturation-conditional' },
    { familyKey: 'Наносит #% урона чар в виде дополнительного урона от молнии', expectedOrder: 33, comment: 'lightning: conversion' },
    // Chaos (40-49)
    { familyKey: '#% увеличение урона хаосом', expectedOrder: 40, comment: 'chaos: increase generic' },
    { familyKey: 'Чары наносят #% от урона в виде дополнительного урона хаосом', expectedOrder: 41, comment: 'chaos: conversion' },
    // Elemental (50-59)
    { familyKey: '#% увеличение урона от стихий', expectedOrder: 50, comment: 'elemental: all-elements increase' },
    { familyKey: '+# к максимальному количеству стихийных насыщений', expectedOrder: 51, comment: 'elemental: max saturation count' },
    { familyKey: 'Умения с #% шансом могут не удалить стихийные насыщения, но все равно считаться поглотившими их, если вы теряли положительный эффект архонта за последние 6 секунд', expectedOrder: 52, comment: 'elemental: saturation preservation mechanic' },
    // Generic + by-source (60-79)
    { familyKey: '#% увеличение урона', expectedOrder: 60, comment: 'generic: damage increase (bare)' },
    { familyKey: '#% увеличение урона от атак', expectedOrder: 61, comment: 'by-source: attacks generic' },
    { familyKey: '#% увеличение урона от чар', expectedOrder: 62, comment: 'by-source: spells generic' },
    { familyKey: '#% увеличение урона снарядов', expectedOrder: 63, comment: 'by-source: projectiles generic' },
    { familyKey: '#% увеличение урона в ближнем бою', expectedOrder: 64, comment: 'by-source: melee generic' },
    { familyKey: '#% увеличение урона тотемов', expectedOrder: 65, comment: 'by-source: totems' },
    { familyKey: '#% увеличение урона боевыми кличами', expectedOrder: 66, comment: 'by-source: warcries' },
    { familyKey: '#% увеличение урона умениями растений', expectedOrder: 67, comment: 'by-source: plants' },
    { familyKey: '#% увеличение урона от ловушек', expectedOrder: 68, comment: 'by-source: traps' },
    { familyKey: '#% увеличение урона помехами', expectedOrder: 69, comment: 'by-source: obstacles' },
    { familyKey: '#% увеличение урона шипами', expectedOrder: 70, comment: 'by-source: thorns generic' },
    { familyKey: 'Улучшенные атаки наносят увеличенный на #% урон', expectedOrder: 71, comment: 'by-source: enhanced attacks' },
    { familyKey: 'Срабатывающие чары наносят увеличенный на #% урон от чар', expectedOrder: 72, comment: 'by-source: triggered spells' },
    { familyKey: 'Умения Вестников наносят увеличенный на #% урон', expectedOrder: 73, comment: 'by-source: heralds' },
    // Conditional (80-89)
    { familyKey: '#% увеличение урона от атак при малом количестве здоровья', expectedOrder: 80, comment: 'conditional: low-HP attacks' },
    { familyKey: '#% увеличение урона от чар при полном энергетическом щите', expectedOrder: 81, comment: 'conditional: full-ES spells' },
    { familyKey: '#% увеличение урона будучи превращенным', expectedOrder: 82, comment: 'conditional: transformed' },
    { familyKey: '#% увеличение урона, если вы недавно поглотили труп', expectedOrder: 83, comment: 'conditional: corpse consumed' },
    { familyKey: '#% увеличение урона в ближнем бою, если за последние восемь секунд вы наносили Удар снарядами атак', expectedOrder: 84, comment: 'conditional: melee if projectile' },
    { familyKey: '#% увеличение урона снарядами, если за последние восемь секунд вы наносили Удар в ближнем бою', expectedOrder: 85, comment: 'conditional: projectile if melee' },
    // By-target (90-99)
    { familyKey: '#% увеличение урона от ударов по редким и уникальным врагам', expectedOrder: 90, comment: 'by-target: rare/unique enemies' },
    // Special (100-109)
    { familyKey: '#% увеличение силы накладываемых чарами Проколов', expectedOrder: 100, comment: 'special: Puncture strength' },
    { familyKey: '(#)% увеличение величины элементальных недугов, накладываемых вашими чарами', expectedOrder: 101, comment: 'special: elemental ailments magnitude' },
    { familyKey: 'Накладывает Анемию при нанесении удара', expectedOrder: 102, comment: 'special: Anemia on hit' },
    { familyKey: 'Позволяет наложить на врагов +# отрицательных эффектов оскверненной крови', expectedOrder: 103, comment: 'special: corrupted blood extra debuffs' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`damage-type: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('damage-type', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('damage-type: full canonical element order физический → огонь → холод → молния → хаос → стихийный', () => {
    const keys = [
      '#% увеличение урона от огня',
      '#% увеличение урона от молнии',
      '#% увеличение урона от холода',
      '#% увеличение урона от стихий',
      '#% увеличение урона хаосом',
      '#% увеличение глобального физического урона',
    ];
    const sortKeys = keys.map(k => computeSortKey('damage-type', k)).sort();
    expect(sortKeys[0]).toContain('глобального физического урона');
    expect(sortKeys[1]).toContain('урона от огня');
    expect(sortKeys[2]).toContain('урона от холода');
    expect(sortKeys[3]).toContain('урона от молнии');
    expect(sortKeys[4]).toContain('урона хаосом');
    expect(sortKeys[5]).toContain('урона от стихий');
  });

  it('damage-type: generic "увеличение урона" (60) BEFORE conditional "увеличение урона будучи превращенным" (82)', () => {
    const generic = computeSortKey('damage-type', '#% увеличение урона');
    const conditional = computeSortKey('damage-type', '#% увеличение урона будучи превращенным');
    expect(generic.localeCompare(conditional, 'ru')).toBeLessThan(0);
  });

  it('damage-type: by-source "увеличение урона от чар" (62) BEFORE conditional "увеличение урона от чар при полном ES" (81)', () => {
    const generic = computeSortKey('damage-type', '#% увеличение урона от чар');
    const conditional = computeSortKey('damage-type', '#% увеличение урона от чар при полном энергетическом щите');
    expect(generic.localeCompare(conditional, 'ru')).toBeLessThan(0);
  });

  it('damage-type: conversion "Наносит ... огня" (13) NOT confused with generic "увеличение урона от огня" (10) — generic first', () => {
    const generic = computeSortKey('damage-type', '#% увеличение урона от огня');
    const conversion = computeSortKey('damage-type', 'Наносит #% урона чарами в виде дополнительного урона от огня');
    expect(generic.localeCompare(conversion, 'ru')).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5c: computeSortKey — defence-stats canonical ordering (iter 114)
// ═══════════════════════════════════════════════════════════════════════════

describe('computeSortKey: defence-stats (iter 114)', () => {
  const cases = [
    // Triple-stat (must be matched before single-stat rules)
    { familyKey: '#% увеличение брони, уклонения и энергетического щита от щита в руках', expectedOrder: 3, comment: 'armour: shield triple-stat' },
    { familyKey: '#% увеличение глобальной брони, уклонения и энергетического щита', expectedOrder: 4, comment: 'armour: global triple-stat' },
    // Броня (0-9)
    { familyKey: '+# к броне', expectedOrder: 0, comment: 'armour: flat' },
    { familyKey: '#% повышение брони', expectedOrder: 1, comment: 'armour: % generic' },
    { familyKey: '#% увеличение брони от надетого нательного доспеха', expectedOrder: 2, comment: 'armour: from body' },
    // Уклонение (10-19)
    { familyKey: '+# к уклонению', expectedOrder: 10, comment: 'evasion: flat' },
    { familyKey: '#% увеличение уклонения', expectedOrder: 11, comment: 'evasion: % generic' },
    { familyKey: '#% увеличение уклонения от вашего нательного доспеха', expectedOrder: 12, comment: 'evasion: from body' },
    // Энергетический щит (20-29)
    { familyKey: '#% увеличение энергетического щита от надетого нательного доспеха', expectedOrder: 20, comment: 'ES: from body' },
    { familyKey: '#% увеличение энергетического щита от фокуса в руках', expectedOrder: 21, comment: 'ES: from focus' },
    { familyKey: '#% повышение скорости перезарядки энергетического щита', expectedOrder: 22, comment: 'ES: recharge speed' },
    { familyKey: '#% ускорение начала перезарядки энергетического щита', expectedOrder: 23, comment: 'ES: recharge start' },
    // Блок (30-39)
    { familyKey: '#% увеличение шанса блока', expectedOrder: 30, comment: 'block: chance' },
    // Порог оглушения (40-49)
    { familyKey: '+# к порогу оглушения', expectedOrder: 40, comment: 'stun threshold: flat' },
    { familyKey: '#% увеличение порога оглушения', expectedOrder: 41, comment: 'stun threshold: % generic' },
    { familyKey: '#% увеличение порога оглушения если недавно вы не были оглушены', expectedOrder: 42, comment: 'stun threshold: conditional (recently)' },
    { familyKey: '#% увеличение порога оглушения при парировании', expectedOrder: 43, comment: 'stun threshold: conditional (parry)' },
    // Отклонение (50-59)
    { familyKey: '#% увеличение отклонения ударов', expectedOrder: 50, comment: 'deflection: %' },
    // Обереги (60-69)
    { familyKey: '#% увеличение длительности эффекта оберега', expectedOrder: 60, comment: 'ward: duration' },
    { familyKey: '#% увеличение количества получаемых зарядов оберегов', expectedOrder: 61, comment: 'ward: charges gained' },
    { familyKey: '#% уменьшение количества используемых зарядов оберегов', expectedOrder: 62, comment: 'ward: charges used reduction' },
    { familyKey: '#% уменьшение силы замедления у отрицательных эффектов на вас, если недавно вы использовали оберег', expectedOrder: 63, comment: 'ward: conditional slow reduction' },
    { familyKey: 'Используемые вами обереги с #% шансом могут не потратить заряды', expectedOrder: 64, comment: 'ward: free use chance' },
    { familyKey: 'Обереги получают зарядов в секунду: #', expectedOrder: 65, comment: 'ward: regen per second' },
    { familyKey: '#% увеличение урона, пока у вас активен оберег', expectedOrder: 66, comment: 'ward: damage while ward active' },
    // Разрушение брони (70-79)
    { familyKey: '#% увеличение длительности разрушения брони', expectedOrder: 70, comment: 'armour break: duration' },
    { familyKey: '#% увеличение количества разрушаемой брони', expectedOrder: 71, comment: 'armour break: quantity' },
    { familyKey: '#% увеличение урона по врагам с полностью разрушенной бронёй', expectedOrder: 72, comment: 'armour break: damage vs broken' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`defence-stats: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('defence-stats', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('defence-stats: full canonical bucket order Броня → Уклонение → ES → Блок → Порог → Отклонение → Обереги → Разрушение', () => {
    // Pick one representative family-key per bucket
    const keys = [
      '+# к броне',                                              // 0  — Броня
      '+# к уклонению',                                          // 10 — Уклонение
      '#% увеличение энергетического щита от фокуса в руках',   // 21 — ES
      '#% увеличение шанса блока',                              // 30 — Блок
      '+# к порогу оглушения',                                   // 40 — Порог
      '#% увеличение отклонения ударов',                        // 50 — Отклонение
      '#% увеличение длительности эффекта оберега',             // 60 — Обереги
      '#% увеличение длительности разрушения брони',            // 70 — Разрушение брони
    ];
    const sortKeys = keys.map(k => computeSortKey('defence-stats', k)).sort();
    expect(sortKeys[0]).toContain('к броне');
    expect(sortKeys[1]).toContain('к уклонению');
    expect(sortKeys[2]).toContain('фокуса в руках');
    expect(sortKeys[3]).toContain('шанса блока');
    expect(sortKeys[4]).toContain('к порогу оглушения');
    expect(sortKeys[5]).toContain('отклонения ударов');
    expect(sortKeys[6]).toContain('длительности эффекта оберега');
    expect(sortKeys[7]).toContain('длительности разрушения брони');
  });

  it('defence-stats: triple-stat "щит в руках" (3) matched BEFORE single-stat "к броне" (0) — both share "брон" stem', () => {
    // Triple-stat family-key contains "брони, уклонения и энергетического щита от щита в руках"
    // — pattern "к броне$" must NOT match it (anchored), but pattern "от щита в руках" must.
    const triple = computeSortKey('defence-stats', '#% увеличение брони, уклонения и энергетического щита от щита в руках');
    const single = computeSortKey('defence-stats', '+# к броне');
    // Triple has order 3, single has order 0 → single sorts first.
    expect(single.localeCompare(triple, 'ru')).toBeLessThan(0);
    // Verify the prefix explicitly.
    expect(triple.startsWith('003::')).toBe(true);
    expect(single.startsWith('000::')).toBe(true);
  });

  it('defence-stats: conditional порог оглушения (42, 43) AFTER bare % (41) — bare is more fundamental', () => {
    const bare = computeSortKey('defence-stats', '#% увеличение порога оглушения');
    const condRecent = computeSortKey('defence-stats', '#% увеличение порога оглушения если недавно вы не были оглушены');
    const condParry = computeSortKey('defence-stats', '#% увеличение порога оглушения при парировании');
    expect(bare.localeCompare(condRecent, 'ru')).toBeLessThan(0);
    expect(bare.localeCompare(condParry, 'ru')).toBeLessThan(0);
  });

  it('defence-stats: flat "+# к броне" (0) BEFORE % "#% повышение брони" (1) — flat is more fundamental', () => {
    const flat = computeSortKey('defence-stats', '+# к броне');
    const percent = computeSortKey('defence-stats', '#% повышение брони');
    expect(flat.localeCompare(percent, 'ru')).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5d: computeSortKey — resources canonical ordering (iter 115)
// ═══════════════════════════════════════════════════════════════════════════

describe('computeSortKey: resources (iter 115)', () => {
  const cases = [
    // Здоровье (0-9) — 10 keys
    { familyKey: '+# к максимуму здоровья', expectedOrder: 0, comment: 'health: flat max' },
    { familyKey: '#% увеличение максимума здоровья', expectedOrder: 1, comment: 'health: % max' },
    { familyKey: 'Регенерация # здоровья в секунду', expectedOrder: 2, comment: 'health: flat regen' },
    { familyKey: '#% повышение скорости регенерации здоровья', expectedOrder: 3, comment: 'health: % regen speed' },
    { familyKey: '#% увеличение количества похищенного здоровья', expectedOrder: 4, comment: 'health: leech generic' },
    { familyKey: '#% физического урона от атак похищается в виде здоровья', expectedOrder: 5, comment: 'health: phys-attack leech' },
    { familyKey: '#% полученного урона восполняется в виде здоровья', expectedOrder: 6, comment: 'health: damage recovery' },
    { familyKey: '#% полученного урона от огня восполняется в виде здоровья', expectedOrder: 7, comment: 'health: fire-damage recovery' },
    { familyKey: 'Восстанавливает #% здоровья при убийстве', expectedOrder: 8, comment: 'health: on-kill %' },
    { familyKey: 'Дарует # здоровья за каждого убитого врага', expectedOrder: 9, comment: 'health: per-kill flat' },
    // Мана (10-19) — 9 keys
    { familyKey: '+# к максимуму маны', expectedOrder: 10, comment: 'mana: flat max' },
    { familyKey: '#% увеличение максимума маны', expectedOrder: 11, comment: 'mana: % max' },
    { familyKey: '#% повышение скорости регенерации маны', expectedOrder: 12, comment: 'mana: % regen speed' },
    { familyKey: '#% увеличение количества похищенной маны', expectedOrder: 13, comment: 'mana: leech generic' },
    { familyKey: '#% полученного урона восполняется в виде маны', expectedOrder: 14, comment: 'mana: damage recovery' },
    { familyKey: '#% физического урона от атак похищается в виде маны', expectedOrder: 15, comment: 'mana: phys-attack leech' },
    { familyKey: 'Восстанавливает #% маны при убийстве', expectedOrder: 16, comment: 'mana: on-kill %' },
    { familyKey: 'Дарует # маны за каждого убитого врага', expectedOrder: 17, comment: 'mana: per-kill flat' },
    { familyKey: '#% увеличение эффективности расхода маны чарами', expectedOrder: 18, comment: 'mana: cost efficiency' },
    // ES (20-29) — 4 keys
    { familyKey: '+# к максимуму энергетического щита', expectedOrder: 20, comment: 'ES: flat max' },
    { familyKey: '#% увеличение максимума энергетического щита', expectedOrder: 21, comment: 'ES: % max' },
    { familyKey: 'Дарует дополнительный порог оглушения в размере #% от максимума энергетического щита', expectedOrder: 22, comment: 'ES: →stun threshold conversion' },
    { familyKey: 'Дарует дополнительный порог состояний в размере #% от максимума энергетического щита', expectedOrder: 23, comment: 'ES: →ailment threshold conversion' },
    // Conversion (30-39) — 3 keys
    { familyKey: '#% от получаемого урона берется сначала из маны вместо здоровья', expectedOrder: 30, comment: 'conversion: MoM (damage→mana)' },
    { familyKey: '#% стоимости умений в мане берется из здоровья', expectedOrder: 31, comment: 'conversion: mana-cost→health' },
    { familyKey: 'Дарует #% максимума маны в виде брони', expectedOrder: 32, comment: 'conversion: mana→armour' },
    // Totem (40-49) — 1 key
    { familyKey: '#% увеличение здоровья тотема', expectedOrder: 40, comment: 'totem: health' },
    // Other (50-59) — 2 keys
    { familyKey: '#% увеличение радиуса обзора', expectedOrder: 50, comment: 'other: vision radius' },
    { familyKey: '#% усиление эффекта Колдовского выброса на вас', expectedOrder: 51, comment: 'other: Hexblast effect' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`resources: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('resources', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('resources: full canonical bucket order Здоровье → Мана → ES → Конверсия → Тотем → Прочее', () => {
    // Pick one representative family-key per bucket
    const keys = [
      '+# к максимуму здоровья',                                              // 0  — Здоровье
      '+# к максимуму маны',                                                  // 10 — Мана
      '+# к максимуму энергетического щита',                                  // 20 — ES
      '#% от получаемого урона берется сначала из маны вместо здоровья',      // 30 — Конверсия
      '#% увеличение здоровья тотема',                                        // 40 — Тотем
      '#% увеличение радиуса обзора',                                         // 50 — Прочее
    ];
    const sortKeys = keys.map(k => computeSortKey('resources', k)).sort();
    expect(sortKeys[0]).toContain('к максимуму здоровья');
    expect(sortKeys[1]).toContain('к максимуму маны');
    expect(sortKeys[2]).toContain('к максимуму энергетического щита');
    expect(sortKeys[3]).toContain('берется сначала из маны');
    expect(sortKeys[4]).toContain('здоровья тотема');
    expect(sortKeys[5]).toContain('радиуса обзора');
  });

  it('resources: Health parallel to Mana — flat max health (0) BEFORE flat max mana (10)', () => {
    // Mental model: Health comes first because it's the life pool.
    const health = computeSortKey('resources', '+# к максимуму здоровья');
    const mana = computeSortKey('resources', '+# к максимуму маны');
    expect(health.localeCompare(mana, 'ru')).toBeLessThan(0);
  });

  it('resources: generic recovery (6) BEFORE fire-variant (7) — generic is more fundamental', () => {
    const generic = computeSortKey('resources', '#% полученного урона восполняется в виде здоровья');
    const fire = computeSortKey('resources', '#% полученного урона от огня восполняется в виде здоровья');
    expect(generic.localeCompare(fire, 'ru')).toBeLessThan(0);
  });

  it('resources: ES bare max (20, 21) BEFORE ES→threshold conversions (22, 23) — pool stat before conversion use', () => {
    const esFlat = computeSortKey('resources', '+# к максимуму энергетического щита');
    const esPercent = computeSortKey('resources', '#% увеличение максимума энергетического щита');
    const esStun = computeSortKey('resources', 'Дарует дополнительный порог оглушения в размере #% от максимума энергетического щита');
    const esAilment = computeSortKey('resources', 'Дарует дополнительный порог состояний в размере #% от максимума энергетического щита');
    expect(esFlat.localeCompare(esStun, 'ru')).toBeLessThan(0);
    expect(esFlat.localeCompare(esAilment, 'ru')).toBeLessThan(0);
    expect(esPercent.localeCompare(esStun, 'ru')).toBeLessThan(0);
    expect(esPercent.localeCompare(esAilment, 'ru')).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5e: computeSortKey — weapon-specific canonical ordering (iter 116)
// ═══════════════════════════════════════════════════════════════════════════

describe('computeSortKey: weapon-specific (iter 116)', () => {
  const cases = [
    // Мечи (Swords) — 0-9
    { familyKey: '#% увеличение урона мечами', expectedOrder: 0, comment: 'swords: damage' },
    { familyKey: '#% повышение скорости атаки мечами', expectedOrder: 1, comment: 'swords: attack-speed' },
    // Топоры (Axes) — 10-19
    { familyKey: '#% увеличение урона топорами', expectedOrder: 10, comment: 'axes: damage' },
    { familyKey: '#% повышение скорости атаки топорами', expectedOrder: 11, comment: 'axes: attack-speed' },
    // Булавы (Maces) — 20-29
    { familyKey: '#% увеличение урона булавами', expectedOrder: 20, comment: 'maces: damage' },
    { familyKey: '#% повышение скорости накопления шкалы оглушения булавами', expectedOrder: 21, comment: 'maces: stun-gauge' },
    // Боевые посохи (Warstaves) — 30-39
    { familyKey: '#% увеличение урона боевыми посохами', expectedOrder: 30, comment: 'warstaves: damage' },
    { familyKey: '#% повышение скорости атаки боевыми посохами', expectedOrder: 31, comment: 'warstaves: attack-speed' },
    { familyKey: '#% повышение скорости накопления шкалы заморозки боевыми посохами', expectedOrder: 32, comment: 'warstaves: freeze-gauge' },
    // Кинжалы (Daggers) — 40-49
    { familyKey: '#% увеличение урона кинжалами', expectedOrder: 40, comment: 'daggers: damage' },
    { familyKey: '#% повышение скорости атаки кинжалами', expectedOrder: 41, comment: 'daggers: attack-speed' },
    { familyKey: '#% повышение шанса критического удара кинжалами', expectedOrder: 42, comment: 'daggers: crit-chance' },
    // Копья (Spears) — 50-59
    { familyKey: '#% увеличение урона копьями', expectedOrder: 50, comment: 'spears: damage' },
    { familyKey: '#% повышение скорости атаки копьями', expectedOrder: 51, comment: 'spears: attack-speed' },
    { familyKey: '#% увеличение бонуса к критическому урону копьями', expectedOrder: 52, comment: 'spears: crit-damage' },
    // Кистени (Flails) — 60-69
    { familyKey: '#% увеличение урона кистенями', expectedOrder: 60, comment: 'flails: damage' },
    { familyKey: '#% увеличение шанса критического удара кистенями', expectedOrder: 61, comment: 'flails: crit-chance' },
    // Луки (Bows) — 70-79
    { familyKey: '#% увеличение урона луками', expectedOrder: 70, comment: 'bows: damage' },
    { familyKey: '#% повышение скорости атаки луками', expectedOrder: 71, comment: 'bows: attack-speed' },
    { familyKey: '#% повышение меткости луками', expectedOrder: 72, comment: 'bows: accuracy' },
    // Самострелы (Crossbows) — 80-89
    { familyKey: '#% увеличение урона самострелами', expectedOrder: 80, comment: 'crossbows: damage' },
    { familyKey: '#% повышение скорости атаки самострелами', expectedOrder: 81, comment: 'crossbows: attack-speed' },
    // Без оружия (Unarmed) — 90-99
    { familyKey: '#% увеличение урона атаками без оружия', expectedOrder: 90, comment: 'unarmed: damage' },
    { familyKey: '#% повышение скорости атаки без оружия', expectedOrder: 91, comment: 'unarmed: attack-speed' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`weapon-specific: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('weapon-specific', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('weapon-specific: full canonical bucket order Мечи → Топоры → Булавы → Боевые посохи → Кинжалы → Копья → Кистени → Луки → Самострелы → Без оружия', () => {
    // Pick one representative family-key per weapon (damage variant for each)
    const keys = [
      '#% увеличение урона мечами',            // 0  — Мечи
      '#% увеличение урона топорами',          // 10 — Топоры
      '#% увеличение урона булавами',          // 20 — Булавы
      '#% увеличение урона боевыми посохами',  // 30 — Боевые посохи
      '#% увеличение урона кинжалами',         // 40 — Кинжалы
      '#% увеличение урона копьями',           // 50 — Копья
      '#% увеличение урона кистенями',         // 60 — Кистени
      '#% увеличение урона луками',            // 70 — Луки
      '#% увеличение урона самострелами',      // 80 — Самострелы
      '#% увеличение урона атаками без оружия', // 90 — Без оружия
    ];
    const sortKeys = keys.map(k => computeSortKey('weapon-specific', k)).sort();
    expect(sortKeys[0]).toContain('мечами');
    expect(sortKeys[1]).toContain('топорами');
    expect(sortKeys[2]).toContain('булавами');
    expect(sortKeys[3]).toContain('боевыми посохами');
    expect(sortKeys[4]).toContain('кинжалами');
    expect(sortKeys[5]).toContain('копьями');
    expect(sortKeys[6]).toContain('кистенями');
    expect(sortKeys[7]).toContain('луками');
    expect(sortKeys[8]).toContain('самострелами');
    expect(sortKeys[9]).toContain('без оружия');
  });

  it('weapon-specific: damage BEFORE attack-speed within same weapon (swords)', () => {
    const damage = computeSortKey('weapon-specific', '#% увеличение урона мечами');
    const speed = computeSortKey('weapon-specific', '#% повышение скорости атаки мечами');
    expect(damage.localeCompare(speed, 'ru')).toBeLessThan(0);
  });

  it('weapon-specific: damage BEFORE attack-speed within same weapon (warstaves)', () => {
    const damage = computeSortKey('weapon-specific', '#% увеличение урона боевыми посохами');
    const speed = computeSortKey('weapon-specific', '#% повышение скорости атаки боевыми посохами');
    expect(damage.localeCompare(speed, 'ru')).toBeLessThan(0);
  });

  it('weapon-specific: attack-speed BEFORE weapon-specific stat (warstaves freeze-gauge)', () => {
    const speed = computeSortKey('weapon-specific', '#% повышение скорости атаки боевыми посохами');
    const freeze = computeSortKey('weapon-specific', '#% повышение скорости накопления шкалы заморозки боевыми посохами');
    expect(speed.localeCompare(freeze, 'ru')).toBeLessThan(0);
  });

  it('weapon-specific: unarmed uses "атаками без оружия" wording (distinct from other weapons)', () => {
    // Verify the unarmed damage pattern doesn't accidentally match other weapon damage keys.
    const unarmedDamage = computeSortKey('weapon-specific', '#% увеличение урона атаками без оружия');
    const swordDamage = computeSortKey('weapon-specific', '#% увеличение урона мечами');
    // Unarmed is order 90, sword is order 0 — sword sorts first.
    expect(swordDamage.localeCompare(unarmedDamage, 'ru')).toBeLessThan(0);
    expect(unarmedDamage.startsWith('090::')).toBe(true);
    expect(swordDamage.startsWith('000::')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5f: computeSortKey — flasks canonical ordering (iter 116)
// ═══════════════════════════════════════════════════════════════════════════

describe('computeSortKey: flasks (iter 116)', () => {
  const cases = [
    // Health flask (0-9) — 5 keys
    { familyKey: '#% повышение скорости восстановления здоровья от флакона', expectedOrder: 0, comment: 'health-flask: recovery-speed' },
    { familyKey: '#% увеличение восстановления здоровья от флаконов', expectedOrder: 1, comment: 'health-flask: recovery-amount' },
    { familyKey: '#% увеличение количества получаемых зарядов флакона здоровья', expectedOrder: 2, comment: 'health-flask: charges-gained' },
    { familyKey: '#% увеличение регенерации здоровья во время действия эффекта любого флакона здоровья', expectedOrder: 3, comment: 'health-flask: regen-during-effect' },
    { familyKey: 'Флаконы здоровья получают зарядов в секунду: #', expectedOrder: 4, comment: 'health-flask: regen-per-sec' },
    // Mana flask (10-19) — 4 keys
    { familyKey: '#% повышение скорости восстановления маны от флакона', expectedOrder: 10, comment: 'mana-flask: recovery-speed' },
    { familyKey: '#% увеличение восстановления маны от флаконов', expectedOrder: 11, comment: 'mana-flask: recovery-amount' },
    { familyKey: '#% увеличение количества получаемых зарядов флакона маны', expectedOrder: 12, comment: 'mana-flask: charges-gained' },
    { familyKey: 'Флаконы маны получают зарядов в секунду: #', expectedOrder: 13, comment: 'mana-flask: regen-per-sec' },
    // Any flask (20-29) — 5 keys
    { familyKey: '#% увеличение длительности эффекта флакона', expectedOrder: 20, comment: 'any-flask: duration' },
    { familyKey: '#% увеличение количества получаемых зарядов флакона', expectedOrder: 21, comment: 'any-flask: charges-gained' },
    { familyKey: '#% уменьшение используемого количества зарядов флакона', expectedOrder: 22, comment: 'any-flask: charges-used-reduction' },
    { familyKey: '#% шанс сохранить заряды флаконов при их использовании', expectedOrder: 23, comment: 'any-flask: keep-charges' },
    { familyKey: 'Флаконы получают зарядов в секунду: #', expectedOrder: 24, comment: 'any-flask: regen-per-sec' },
    // Flask buffs (30-39) — 2 keys
    { familyKey: '(#)% увеличение скорости сотворения чар во время действия любого флакона', expectedOrder: 30, comment: 'buff: cast-speed' },
    { familyKey: '(#)% увеличение урона чар во время действия любого флакона', expectedOrder: 31, comment: 'buff: spell-damage' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`flasks: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('flasks', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('flasks: full canonical bucket order Health → Mana → Any → Buffs', () => {
    // Pick one representative family-key per bucket
    const keys = [
      '#% повышение скорости восстановления здоровья от флакона',                     // 0  — Health
      '#% повышение скорости восстановления маны от флакона',                         // 10 — Mana
      '#% увеличение длительности эффекта флакона',                                   // 20 — Any
      '(#)% увеличение скорости сотворения чар во время действия любого флакона',     // 30 — Buffs
    ];
    const sortKeys = keys.map(k => computeSortKey('flasks', k)).sort();
    expect(sortKeys[0]).toContain('здоровья от флакона');
    expect(sortKeys[1]).toContain('маны от флакона');
    expect(sortKeys[2]).toContain('длительности эффекта флакона');
    expect(sortKeys[3]).toContain('скорости сотворения чар');
  });

  it('flasks: Health parallel to Mana — recovery-speed health (0) BEFORE recovery-speed mana (10)', () => {
    const health = computeSortKey('flasks', '#% повышение скорости восстановления здоровья от флакона');
    const mana = computeSortKey('flasks', '#% повышение скорости восстановления маны от флакона');
    expect(health.localeCompare(mana, 'ru')).toBeLessThan(0);
  });

  it('flasks: end-anchored `флакона$` does NOT match `флакона здоровья` (any-flask vs health-flask charges-gained)', () => {
    // "получаемых зарядов флакона$" should match only "получаемых зарядов флакона" (any)
    // but NOT "получаемых зарядов флакона здоровья" (health-specific).
    const anyFlask = computeSortKey('flasks', '#% увеличение количества получаемых зарядов флакона');
    const healthFlask = computeSortKey('flasks', '#% увеличение количества получаемых зарядов флакона здоровья');
    // Any is order 21, health is order 2 — health sorts first (more specific).
    expect(anyFlask.startsWith('021::')).toBe(true);
    expect(healthFlask.startsWith('002::')).toBe(true);
    expect(healthFlask.localeCompare(anyFlask, 'ru')).toBeLessThan(0);
  });

  it('flasks: start-anchored `^Флаконы получают` does NOT match `Флаконы здоровья получают` (any vs health regen-per-sec)', () => {
    const anyFlask = computeSortKey('flasks', 'Флаконы получают зарядов в секунду: #');
    const healthFlask = computeSortKey('flasks', 'Флаконы здоровья получают зарядов в секунду: #');
    // Any is order 24, health is order 4 — health sorts first (more specific).
    expect(anyFlask.startsWith('024::')).toBe(true);
    expect(healthFlask.startsWith('004::')).toBe(true);
    expect(healthFlask.localeCompare(anyFlask, 'ru')).toBeLessThan(0);
  });

  it('flasks: recovery-speed (0) BEFORE recovery-amount (1) — speed more fundamental than amount', () => {
    const speed = computeSortKey('flasks', '#% повышение скорости восстановления здоровья от флакона');
    const amount = computeSortKey('flasks', '#% увеличение восстановления здоровья от флаконов');
    expect(speed.localeCompare(amount, 'ru')).toBeLessThan(0);
  });

  it('flasks: any-flask duration (20) BEFORE buffs (30) — flask properties before player buffs', () => {
    const duration = computeSortKey('flasks', '#% увеличение длительности эффекта флакона');
    const buff = computeSortKey('flasks', '(#)% увеличение скорости сотворения чар во время действия любого флакона');
    expect(duration.localeCompare(buff, 'ru')).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5g: computeSortKey — offence-speed canonical ordering (iter 117)
// ═══════════════════════════════════════════════════════════════════════════

describe('computeSortKey: offence-speed (iter 117)', () => {
  const cases = [
    // Generic speeds (end-anchored)
    { familyKey: '#% повышение скорости атаки', expectedOrder: 0, comment: 'attack-speed' },
    { familyKey: '#% повышение скорости сотворения чар', expectedOrder: 10, comment: 'cast-speed: generic spells' },
    { familyKey: '#% повышение скорости передвижения', expectedOrder: 20, comment: 'move-speed' },
    { familyKey: '#% повышение скорости снарядов', expectedOrder: 30, comment: 'projectile-speed' },
    { familyKey: '#% повышение скорости перезарядки самострела', expectedOrder: 40, comment: 'crossbow-reload-speed' },
    { familyKey: '#% повышение скорости применения боевых кличей', expectedOrder: 50, comment: 'warcry-application-speed' },
    { familyKey: '#% повышение скорости броска ловушки', expectedOrder: 60, comment: 'trap-throw-speed' },
    { familyKey: '#% повышение скорости установки тотемов', expectedOrder: 70, comment: 'totem-place-speed' },
    { familyKey: '#% повышение скорости смены оружия', expectedOrder: 80, comment: 'weapon-swap-speed' },
    { familyKey: '#% повышение скорости умений', expectedOrder: 90, comment: 'skill-speed: generic' },
    // Subset/conditional variants (most-specific, listed first)
    { familyKey: 'Умения метки имеют #% повышение скорости сотворения чар', expectedOrder: 11, comment: 'cast-speed: mark skills (subset)' },
    { familyKey: '#% повышение скорости умений будучи превращенным', expectedOrder: 91, comment: 'skill-speed: transformed (conditional)' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`offence-speed: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('offence-speed', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('offence-speed: full canonical bucket order attack → cast → move → projectile → crossbow-reload → warcry → trap → totem → swap → skill', () => {
    // Pick one representative family-key per speed type
    const keys = [
      '#% повышение скорости атаки',                     // 0  — attack
      '#% повышение скорости сотворения чар',            // 10 — cast (generic)
      '#% повышение скорости передвижения',              // 20 — move
      '#% повышение скорости снарядов',                  // 30 — projectile
      '#% повышение скорости перезарядки самострела',    // 40 — crossbow reload
      '#% повышение скорости применения боевых кличей',  // 50 — warcry
      '#% повышение скорости броска ловушки',            // 60 — trap
      '#% повышение скорости установки тотемов',         // 70 — totem
      '#% повышение скорости смены оружия',              // 80 — weapon swap
      '#% повышение скорости умений',                    // 90 — skill (generic)
    ];
    const sortKeys = keys.map(k => computeSortKey('offence-speed', k)).sort();
    expect(sortKeys[0]).toContain('скорости атаки');
    expect(sortKeys[1]).toContain('скорости сотворения чар');
    expect(sortKeys[2]).toContain('скорости передвижения');
    expect(sortKeys[3]).toContain('скорости снарядов');
    expect(sortKeys[4]).toContain('скорости перезарядки самострела');
    expect(sortKeys[5]).toContain('скорости применения боевых кличей');
    expect(sortKeys[6]).toContain('скорости броска ловушки');
    expect(sortKeys[7]).toContain('скорости установки тотемов');
    expect(sortKeys[8]).toContain('скорости смены оружия');
    expect(sortKeys[9]).toContain('скорости умений');
  });

  it('offence-speed: mark-skill cast speed (11) comes AFTER generic cast speed (10) — subset', () => {
    const generic = computeSortKey('offence-speed', '#% повышение скорости сотворения чар');
    const mark = computeSortKey('offence-speed', 'Умения метки имеют #% повышение скорости сотворения чар');
    expect(generic.localeCompare(mark, 'ru')).toBeLessThan(0);
    expect(generic.startsWith('010::')).toBe(true);
    expect(mark.startsWith('011::')).toBe(true);
  });

  it('offence-speed: transformed skill speed (91) comes AFTER generic skill speed (90) — conditional variant', () => {
    const generic = computeSortKey('offence-speed', '#% повышение скорости умений');
    const transformed = computeSortKey('offence-speed', '#% повышение скорости умений будучи превращенным');
    expect(generic.localeCompare(transformed, 'ru')).toBeLessThan(0);
    expect(generic.startsWith('090::')).toBe(true);
    expect(transformed.startsWith('091::')).toBe(true);
  });

  it('offence-speed: mark-skill rule does NOT match generic cast speed (first-match-wins)', () => {
    // Generic cast speed family-key does NOT contain "умения метки имеют"
    // → falls through to `скорости сотворения чар$` rule → order 10
    const generic = computeSortKey('offence-speed', '#% повышение скорости сотворения чар');
    expect(generic.startsWith('010::')).toBe(true);
  });

  it('offence-speed: end-anchored `скорости умений$` does NOT match transformed variant', () => {
    // Transformed family-key ends with "превращенным", not "умений"
    // → bare `скорости умений$` rule should not match it.
    // First-match-wins also intercepts via `будучи превращенным` rule.
    const transformed = computeSortKey('offence-speed', '#% повышение скорости умений будучи превращенным');
    const generic = computeSortKey('offence-speed', '#% повышение скорости умений');
    expect(transformed.startsWith('091::')).toBe(true);
    expect(generic.startsWith('090::')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5h: computeSortKey — crit canonical ordering (iter 117)
// ═══════════════════════════════════════════════════════════════════════════

describe('computeSortKey: crit (iter 117)', () => {
  const cases = [
    // % increase — crit chance (end-anchored generics)
    { familyKey: '#% повышение шанса критического удара', expectedOrder: 0, comment: 'crit-chance: generic %' },
    { familyKey: '#% повышение шанса критического удара атаками', expectedOrder: 10, comment: 'crit-chance: attacks %' },
    { familyKey: '#% повышение шанса критического удара для чар', expectedOrder: 20, comment: 'crit-chance: spells %' },
    // Flat — crit chance (dative "шансу", after "к")
    { familyKey: '+#% к шансу критического удара шипами', expectedOrder: 30, comment: 'crit-chance: thorns (flat +)' },
    // % increase — crit damage (end-anchored generic + specific spell variant)
    { familyKey: '#% увеличение бонуса к критическому урону', expectedOrder: 40, comment: 'crit-damage: generic %' },
    { familyKey: '#% увеличение бонуса к критическому урону от чар', expectedOrder: 41, comment: 'crit-damage: spells %' },
    // Flat — crit damage (dative "бонусу", after "к")
    { familyKey: '+#% к бонусу критического урона для урона атаками', expectedOrder: 50, comment: 'crit-damage: attacks (flat +)' },
    // Flat — fire spell crit chance (dative "шансу")
    { familyKey: '+(#)% к шансу критического удара чар огня', expectedOrder: 60, comment: 'crit-chance: fire spells (flat +)' },
    // Crit-induced ailment strength (synergy)
    { familyKey: '#% увеличение силы наносящих урон состояний, накладываемых вашими критическими ударами', expectedOrder: 70, comment: 'crit: ailment strength from crits' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`crit: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('crit', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('crit: full canonical bucket order chance-generic → chance-attacks → chance-spells → chance-thorns → damage-generic → damage-spells → damage-attacks-flat → chance-fire-spells → ailment-from-crit', () => {
    const keys = [
      '#% повышение шанса критического удара',                                                       // 0
      '#% повышение шанса критического удара атаками',                                               // 10
      '#% повышение шанса критического удара для чар',                                               // 20
      '+#% к шансу критического удара шипами',                                                       // 30
      '#% увеличение бонуса к критическому урону',                                                   // 40
      '#% увеличение бонуса к критическому урону от чар',                                            // 41
      '+#% к бонусу критического урона для урона атаками',                                           // 50
      '+(#)% к шансу критического удара чар огня',                                                   // 60
      '#% увеличение силы наносящих урон состояний, накладываемых вашими критическими ударами',      // 70
    ];
    const sortKeys = keys.map(k => computeSortKey('crit', k)).sort();
    expect(sortKeys[0]).toContain('шанса критического удара'); // generic ends here
    expect(sortKeys[1]).toContain('атаками');
    expect(sortKeys[2]).toContain('для чар');
    expect(sortKeys[3]).toContain('шипами');
    expect(sortKeys[4]).toContain('бонуса к критическому урону'); // generic
    expect(sortKeys[5]).toContain('от чар');
    expect(sortKeys[6]).toContain('бонусу критического урона');
    expect(sortKeys[7]).toContain('чар огня');
    expect(sortKeys[8]).toContain('критическими ударами');
  });

  it('crit: Russian morphology disambiguates % (genitive "шанса") from flat (dative "шансу")', () => {
    const percent = computeSortKey('crit', '#% повышение шанса критического удара');
    const flat = computeSortKey('crit', '+#% к шансу критического удара шипами');
    // Both rules are independent — `шанса` won't match `шансу` family-key and vice versa.
    expect(percent.startsWith('000::')).toBe(true);
    expect(flat.startsWith('030::')).toBe(true);
  });

  it('crit: end-anchored `бонуса к критическому урону$` does NOT match spell variant', () => {
    const generic = computeSortKey('crit', '#% увеличение бонуса к критическому урону');
    const spells = computeSortKey('crit', '#% увеличение бонуса к критическому урону от чар');
    // Generic ends with "урону$" — matches. Spells ends with "чар" — doesn't match generic rule.
    expect(generic.startsWith('040::')).toBe(true);
    expect(spells.startsWith('041::')).toBe(true);
    expect(generic.localeCompare(spells, 'ru')).toBeLessThan(0);
  });

  it('crit: end-anchored `шанса критического удара$` does NOT match attacks/spells variants', () => {
    const generic = computeSortKey('crit', '#% повышение шанса критического удара');
    const attacks = computeSortKey('crit', '#% повышение шанса критического удара атаками');
    const spells = computeSortKey('crit', '#% повышение шанса критического удара для чар');
    expect(generic.startsWith('000::')).toBe(true);
    expect(attacks.startsWith('010::')).toBe(true);
    expect(spells.startsWith('020::')).toBe(true);
    expect(generic.localeCompare(attacks, 'ru')).toBeLessThan(0);
    expect(attacks.localeCompare(spells, 'ru')).toBeLessThan(0);
  });

  it('crit: crit-induced ailment strength (70) comes LAST — synergy mod after direct crit stats', () => {
    const directCrit = computeSortKey('crit', '#% повышение шанса критического удара');
    const ailmentFromCrit = computeSortKey('crit', '#% увеличение силы наносящих урон состояний, накладываемых вашими критическими ударами');
    expect(directCrit.localeCompare(ailmentFromCrit, 'ru')).toBeLessThan(0);
    expect(ailmentFromCrit.startsWith('070::')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5i: computeSortKey — buff-skills canonical ordering (iter 117)
// ═══════════════════════════════════════════════════════════════════════════

describe('computeSortKey: buff-skills (iter 117)', () => {
  const cases = [
    // Auras (0-9)
    { familyKey: '#% увеличение силы умений аур', expectedOrder: 0, comment: 'auras: skill strength' },
    // Heralds (10-19)
    { familyKey: '#% увеличение эффективности удержания ресурсов умениями вестниками', expectedOrder: 10, comment: 'heralds: reservation efficiency' },
    // Curses (20-29) — strength + activation speed
    { familyKey: '#% увеличение силы проклятий', expectedOrder: 20, comment: 'curses: strength' },
    { familyKey: 'На #% быстрее активация проклятия', expectedOrder: 21, comment: 'curses: activation speed' },
    // Warcries (40-49) — buff effect + reload speed
    { familyKey: '#% усиление положительного эффекта боевого клича', expectedOrder: 40, comment: 'warcries: buff effect' },
    { familyKey: '#% повышение скорости перезарядки боевых кличей', expectedOrder: 41, comment: 'warcries: reload speed' },
    // Marks (50-59) — effect
    { familyKey: '#% усиление эффекта ваших умений меток', expectedOrder: 50, comment: 'marks: effect' },
  ];

  for (const { familyKey, expectedOrder, comment } of cases) {
    it(`buff-skills: "${comment}" → order ${expectedOrder}`, () => {
      const sortKey = computeSortKey('buff-skills', familyKey);
      const prefix = String(expectedOrder).padStart(3, '0');
      expect(sortKey).toBe(`${prefix}::${familyKey}`);
    });
  }

  it('buff-skills: full canonical bucket order Auras → Heralds → Curses → Warcries → Marks', () => {
    // Pick one representative family-key per bucket (знамёна bucket 30 has no family-keys in data)
    const keys = [
      '#% увеличение силы умений аур',                                                  // 0  — Auras
      '#% увеличение эффективности удержания ресурсов умениями вестниками',             // 10 — Heralds
      '#% увеличение силы проклятий',                                                   // 20 — Curses (strength)
      '#% усиление положительного эффекта боевого клича',                               // 40 — Warcries (buff effect)
      '#% усиление эффекта ваших умений меток',                                         // 50 — Marks (effect)
    ];
    const sortKeys = keys.map(k => computeSortKey('buff-skills', k)).sort();
    expect(sortKeys[0]).toContain('аур');
    expect(sortKeys[1]).toContain('вестниками');
    expect(sortKeys[2]).toContain('проклятий');
    expect(sortKeys[3]).toContain('боевого клича');
    expect(sortKeys[4]).toContain('умений меток');
  });

  it('buff-skills: curse strength (20) BEFORE curse activation speed (21) — strength more fundamental', () => {
    const strength = computeSortKey('buff-skills', '#% увеличение силы проклятий');
    const activation = computeSortKey('buff-skills', 'На #% быстрее активация проклятия');
    expect(strength.localeCompare(activation, 'ru')).toBeLessThan(0);
    expect(strength.startsWith('020::')).toBe(true);
    expect(activation.startsWith('021::')).toBe(true);
  });

  it('buff-skills: warcry buff effect (40) BEFORE warcry reload speed (41) — effect more fundamental', () => {
    const effect = computeSortKey('buff-skills', '#% усиление положительного эффекта боевого клича');
    const reload = computeSortKey('buff-skills', '#% повышение скорости перезарядки боевых кличей');
    expect(effect.localeCompare(reload, 'ru')).toBeLessThan(0);
    expect(effect.startsWith('040::')).toBe(true);
    expect(reload.startsWith('041::')).toBe(true);
  });

  it('buff-skills: distinctive phrase `силы умений аур` does NOT match `силы проклятий` (auras vs curses)', () => {
    // Both contain "силы" but full phrases are distinct — no first-match-wins conflict.
    const auras = computeSortKey('buff-skills', '#% увеличение силы умений аур');
    const curses = computeSortKey('buff-skills', '#% увеличение силы проклятий');
    expect(auras.startsWith('000::')).toBe(true);
    expect(curses.startsWith('020::')).toBe(true);
    expect(auras.localeCompare(curses, 'ru')).toBeLessThan(0);
  });

  it('buff-skills: warcry `усиление положительного эффекта боевого клича` does NOT match mark `усиление эффекта`', () => {
    // Warcry family-key has "усиление положительного эффекта" (with "положительного" between).
    // Mark pattern is `усиление эффекта.*умений меток` — requires "усиление эффекта" (no gap).
    // "усиление положительного эффекта боевого клича" does NOT contain "усиление эффекта".
    const warcry = computeSortKey('buff-skills', '#% усиление положительного эффекта боевого клича');
    const mark = computeSortKey('buff-skills', '#% усиление эффекта ваших умений меток');
    expect(warcry.startsWith('040::')).toBe(true);
    expect(mark.startsWith('050::')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: sortGroupsAlphabetically — uses sortKey when set
// ═══════════════════════════════════════════════════════════════════════════

describe('sortGroupsAlphabetically uses sortKey (iter 112)', () => {
  it('when both groups have sortKey, primary sort is by sortKey', () => {
    // resistances: chaos (order 0) vs fire (order 3) — alphabetical would put fire first
    const g1 = makeGroup('+#% к сопротивлению огню', '003::+#% к сопротивлению огню');
    const g2 = makeGroup('+#% к сопротивлению хаосу', '000::+#% к сопротивлению хаосу');
    const result = sortGroupsAlphabetically([g1, g2]);
    expect(result[0].familyKey).toBe('+#% к сопротивлению хаосу');
    expect(result[1].familyKey).toBe('+#% к сопротивлению огню');
  });

  it('when sortKey missing on both, falls back to familyKey alphabetical (pre-iter-112 behaviour)', () => {
    // No sortKey set — should sort alphabetically by familyKey
    const g1 = makeGroup('+# к силе');
    const g2 = makeGroup('+# к ловкости');
    const g3 = makeGroup('+# к интеллекту');
    const result = sortGroupsAlphabetically([g1, g2, g3]);
    // Russian alpha: и < л < с
    expect(result.map(g => g.familyKey)).toEqual([
      '+# к интеллекту',
      '+# к ловкости',
      '+# к силе',
    ]);
  });

  it('when sortKey set on only one, falls back to familyKey alphabetical', () => {
    // Mixed: production group (with sortKey) vs test group (without)
    // Should sort by familyKey alphabetical — backward compat for tests
    const g1 = makeGroup('+# к силе', '000::+# к силе');
    const g2 = makeGroup('+# к ловкости'); // no sortKey
    const result = sortGroupsAlphabetically([g1, g2]);
    // Russian alpha: л < с → ловкость first
    expect(result.map(g => g.familyKey)).toEqual([
      '+# к ловкости',
      '+# к силе',
    ]);
  });

  it('sortKey is consistent across ::origin variants (origin-split groups)', () => {
    // Production: splitGroupByOrigin sets familyKey to `${familyKey}::${origin}`
    // but sortKey is computed from the CLEAN familyKey (without ::origin).
    // All origin variants should sort together in the canonical position.
    const g1 = makeGroup('+#% к сопротивлению хаосу::normal', '000::+#% к сопротивлению хаосу');
    const g2 = makeGroup('+#% к сопротивлению хаосу::corrupted', '000::+#% к сопротивлению хаосу');
    const g3 = makeGroup('+#% к сопротивлению огню::normal', '003::+#% к сопротивлению огню');
    const result = sortGroupsAlphabetically([g3, g1, g2]);
    // Both хаосу variants come first (alphabetical among themselves: corrupted < normal? — locale-dependent, both acceptable)
    expect(result[0].familyKey).toMatch(/хаосу/);
    expect(result[1].familyKey).toMatch(/хаосу/);
    expect(result[2].familyKey).toMatch(/огню/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: End-to-end — groupTokensByFamily → classifyGroups → sortGroupsAlphabetically
// ═══════════════════════════════════════════════════════════════════════════

describe('End-to-end: canonical within-block ordering (iter 112)', () => {
  it('resistances: 4 single-element resists order chaos → lightning → cold → fire', () => {
    const tokens = [
      makeToken('+#% к сопротивлению огню', 'resistances'),
      makeToken('+#% к сопротивлению хаосу', 'resistances'),
      makeToken('+#% к сопротивлению холоду', 'resistances'),
      makeToken('+#% к сопротивлению молнии', 'resistances'),
    ];
    const groups = groupTokensByFamily(tokens, 'amulet');
    const subGroups = classifyGroups(groups, 'affix-functional', 'alpha');
    // All 4 should land in the 'resistances' sub-group
    const resistancesGroup = subGroups.find(sg => sg.key === 'resistances');
    expect(resistancesGroup).toBeDefined();
    const familyKeys = resistancesGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '+#% к сопротивлению хаосу',
      '+#% к сопротивлению молнии',
      '+#% к сопротивлению холоду',
      '+#% к сопротивлению огню',
    ]);
  });

  it('attributes: 3 flat attributes order Сила → Ловкость → Интеллект', () => {
    const tokens = [
      makeToken('+# к интеллекту', 'attributes'),
      makeToken('+# к силе', 'attributes'),
      makeToken('+# к ловкости', 'attributes'),
    ];
    const groups = groupTokensByFamily(tokens, 'amulet');
    const subGroups = classifyGroups(groups, 'affix-functional', 'alpha');
    const attrGroup = subGroups.find(sg => sg.key === 'attributes');
    expect(attrGroup).toBeDefined();
    const familyKeys = attrGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '+# к силе',
      '+# к ловкости',
      '+# к интеллекту',
    ]);
  });

  it('minions: user-reported "каша" case — 4 chips ordered Companion→Minion, health→damage', () => {
    const tokens = [
      makeToken('#% увеличение максимума здоровья компаньонов', 'minions', 'prefix'),
      makeToken('Компаньоны наносят увеличенный на #% урон', 'minions', 'prefix'),
      makeToken('Приспешники имеют #% увеличение максимума здоровья', 'minions', 'prefix'),
      makeToken('Приспешники имеют #% увеличение урона', 'minions', 'prefix'),
    ];
    const groups = groupTokensByFamily(tokens, 'jewel');
    const subGroups = classifyGroups(groups, 'jewel-functional', 'alpha');
    const minionsGroup = subGroups.find(sg => sg.key === 'minions');
    expect(minionsGroup).toBeDefined();
    const familyKeys = minionsGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '#% увеличение максимума здоровья компаньонов',
      'Компаньоны наносят увеличенный на #% урон',
      'Приспешники имеют #% увеличение максимума здоровья',
      'Приспешники имеют #% увеличение урона',
    ]);
  });

  it('damage-type (iter 113): 4 element damage mods order физический → огонь → холод → молния', () => {
    const tokens = [
      makeToken('#% увеличение урона от молнии', 'damage-type'),
      makeToken('#% увеличение урона от огня', 'damage-type'),
      makeToken('#% увеличение урона от холода', 'damage-type'),
      makeToken('#% увеличение глобального физического урона', 'damage-type'),
    ];
    const groups = groupTokensByFamily(tokens, 'jewel');
    const subGroups = classifyGroups(groups, 'jewel-functional', 'alpha');
    const damageGroup = subGroups.find(sg => sg.key === 'damage-type');
    expect(damageGroup).toBeDefined();
    const familyKeys = damageGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '#% увеличение глобального физического урона',
      '#% увеличение урона от огня',
      '#% увеличение урона от холода',
      '#% увеличение урона от молнии',
    ]);
  });

  it('defence-stats (iter 114): 4 buckets order Броня → Уклонение → Блок → Обереги', () => {
    const tokens = [
      makeToken('#% увеличение длительности эффекта оберега', 'defence-stats'),
      makeToken('#% увеличение шанса блока', 'defence-stats'),
      makeToken('+# к броне', 'defence-stats'),
      makeToken('+# к уклонению', 'defence-stats'),
    ];
    const groups = groupTokensByFamily(tokens, 'belt');
    const subGroups = classifyGroups(groups, 'affix-functional', 'alpha');
    const defenceGroup = subGroups.find(sg => sg.key === 'defence-stats');
    expect(defenceGroup).toBeDefined();
    const familyKeys = defenceGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '+# к броне',
      '+# к уклонению',
      '#% увеличение шанса блока',
      '#% увеличение длительности эффекта оберега',
    ]);
  });

  it('resources (iter 115): 4 buckets order Здоровье → Мана → ES → Тотем', () => {
    const tokens = [
      makeToken('#% увеличение здоровья тотема', 'resources'),
      makeToken('+# к максимуму энергетического щита', 'resources'),
      makeToken('+# к максимуму маны', 'resources'),
      makeToken('+# к максимуму здоровья', 'resources'),
    ];
    const groups = groupTokensByFamily(tokens, 'belt');
    const subGroups = classifyGroups(groups, 'affix-functional', 'alpha');
    const resourcesGroup = subGroups.find(sg => sg.key === 'resources');
    expect(resourcesGroup).toBeDefined();
    const familyKeys = resourcesGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '+# к максимуму здоровья',
      '+# к максимуму маны',
      '+# к максимуму энергетического щита',
      '#% увеличение здоровья тотема',
    ]);
  });

  it('weapon-specific (iter 116): 4 weapons order Мечи → Топоры → Булавы → Без оружия', () => {
    const tokens = [
      makeToken('#% увеличение урона атаками без оружия', 'weapon-specific'),
      makeToken('#% увеличение урона булавами', 'weapon-specific'),
      makeToken('#% увеличение урона топорами', 'weapon-specific'),
      makeToken('#% увеличение урона мечами', 'weapon-specific'),
    ];
    const groups = groupTokensByFamily(tokens, 'jewel');
    // Use 'affix-functional' (not 'jewel-functional') to keep weapon-specific
    // as a single block — 'jewel-functional' splits it into 6 weapon-class sub-blocks.
    const subGroups = classifyGroups(groups, 'affix-functional', 'alpha');
    const weaponGroup = subGroups.find(sg => sg.key === 'weapon-specific');
    expect(weaponGroup).toBeDefined();
    const familyKeys = weaponGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '#% увеличение урона мечами',
      '#% увеличение урона топорами',
      '#% увеличение урона булавами',
      '#% увеличение урона атаками без оружия',
    ]);
  });

  it('flasks (iter 116): 3 buckets order Health → Mana → Any', () => {
    const tokens = [
      makeToken('#% увеличение длительности эффекта флакона', 'flasks'),
      makeToken('#% повышение скорости восстановления маны от флакона', 'flasks'),
      makeToken('#% повышение скорости восстановления здоровья от флакона', 'flasks'),
    ];
    const groups = groupTokensByFamily(tokens, 'belt');
    const subGroups = classifyGroups(groups, 'affix-functional', 'alpha');
    const flasksGroup = subGroups.find(sg => sg.key === 'flasks');
    expect(flasksGroup).toBeDefined();
    const familyKeys = flasksGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '#% повышение скорости восстановления здоровья от флакона',
      '#% повышение скорости восстановления маны от флакона',
      '#% увеличение длительности эффекта флакона',
    ]);
  });

  it('offence-speed (iter 117): 4 speeds order attack → cast → move → projectile', () => {
    const tokens = [
      makeToken('#% повышение скорости снарядов', 'offence-speed'),
      makeToken('#% повышение скорости передвижения', 'offence-speed'),
      makeToken('#% повышение скорости сотворения чар', 'offence-speed'),
      makeToken('#% повышение скорости атаки', 'offence-speed'),
    ];
    const groups = groupTokensByFamily(tokens, 'ring');
    const subGroups = classifyGroups(groups, 'affix-functional', 'alpha');
    const speedGroup = subGroups.find(sg => sg.key === 'offence-speed');
    expect(speedGroup).toBeDefined();
    const familyKeys = speedGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '#% повышение скорости атаки',
      '#% повышение скорости сотворения чар',
      '#% повышение скорости передвижения',
      '#% повышение скорости снарядов',
    ]);
  });

  it('crit (iter 117): 3 crit-chance variants order generic → attacks → spells', () => {
    const tokens = [
      makeToken('#% повышение шанса критического удара для чар', 'crit'),
      makeToken('#% повышение шанса критического удара атаками', 'crit'),
      makeToken('#% повышение шанса критического удара', 'crit'),
    ];
    const groups = groupTokensByFamily(tokens, 'ring');
    const subGroups = classifyGroups(groups, 'affix-functional', 'alpha');
    const critGroup = subGroups.find(sg => sg.key === 'crit');
    expect(critGroup).toBeDefined();
    const familyKeys = critGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '#% повышение шанса критического удара',
      '#% повышение шанса критического удара атаками',
      '#% повышение шанса критического удара для чар',
    ]);
  });

  it('buff-skills (iter 117): 3 skill types order Auras → Curses → Marks', () => {
    const tokens = [
      makeToken('#% усиление эффекта ваших умений меток', 'buff-skills'),
      makeToken('#% увеличение силы проклятий', 'buff-skills'),
      makeToken('#% увеличение силы умений аур', 'buff-skills'),
    ];
    const groups = groupTokensByFamily(tokens, 'ring');
    const subGroups = classifyGroups(groups, 'affix-functional', 'alpha');
    const buffGroup = subGroups.find(sg => sg.key === 'buff-skills');
    expect(buffGroup).toBeDefined();
    const familyKeys = buffGroup!.groups.map(g => g.familyKey);
    expect(familyKeys).toEqual([
      '#% увеличение силы умений аур',
      '#% увеличение силы проклятий',
      '#% усиление эффекта ваших умений меток',
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: BLOCK_SORT_RULES — structural integrity
// ═══════════════════════════════════════════════════════════════════════════

describe('BLOCK_SORT_RULES structural integrity (iter 112)', () => {
  it('all rules use case-insensitive regex', () => {
    for (const [block, rules] of Object.entries(BLOCK_SORT_RULES)) {
      for (const rule of rules!) {
        // Each pattern must have the 'i' flag (case-insensitive)
        expect(rule.pattern.flags, `${block} rule "${rule.comment}" must be case-insensitive`).toContain('i');
      }
    }
  });

  it('all rules have a numeric order', () => {
    for (const [block, rules] of Object.entries(BLOCK_SORT_RULES)) {
      for (const rule of rules!) {
        expect(typeof rule.order, `${block} rule "${rule.comment}" order must be number`).toBe('number');
        expect(rule.order, `${block} rule "${rule.comment}" order must be ≥0`).toBeGreaterThanOrEqual(0);
        expect(rule.order, `${block} rule "${rule.comment}" order must be <1000 (3-digit)`).toBeLessThan(1000);
      }
    }
  });

  it('iter 117 scope: 12 blocks have rules (resistances/attributes/minions/ailments/damage-type/defence-stats/resources/weapon-specific/flasks/offence-speed/crit/buff-skills)', () => {
    const blocksWithRules = Object.keys(BLOCK_SORT_RULES).sort();
    expect(blocksWithRules).toEqual(['ailments', 'attributes', 'buff-skills', 'crit', 'damage-type', 'defence-stats', 'flasks', 'minions', 'offence-speed', 'resistances', 'resources', 'weapon-specific']);
  });
});
