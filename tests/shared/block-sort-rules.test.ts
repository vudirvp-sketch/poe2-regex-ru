/**
 * Block Sort Rules Tests — validates per-block canonical within-block ordering.
 *
 * iter 112: introduces systematic within-block ordering for 4 functional blocks
 * (resistances, attributes, minions, ailments). These tests verify:
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

  it('iter 112 scope: only 4 blocks have rules (resistances/attributes/minions/ailments)', () => {
    const blocksWithRules = Object.keys(BLOCK_SORT_RULES).sort();
    expect(blocksWithRules).toEqual(['ailments', 'attributes', 'minions', 'resistances']);
  });
});
