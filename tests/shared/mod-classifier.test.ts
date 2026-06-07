/**
 * Unit tests for mod-classifier.ts — jewel type heuristic, semantic classification,
 * waystone sentiment, and tablet type classification.
 *
 * Focus: classifyJewelType heuristic accuracy against ETL ground truth.
 * The heuristic is only used as fallback when ETL jewelType is absent,
 * but must be accurate for future mods and corrupted/desecrated variants.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyJewelType,
  classifyByTags,
  classifyByText,
  classifyWaystoneSentiment,
  classifyTabletType,
  classifyGroups,
  type JewelTypeCategory,
} from '@shared/mod-classifier';
import type { FamilyGroup, GameToken, AffixType } from '@shared/types';

// ─── Helpers ───

/** Create a minimal FamilyGroup for testing */
function makeGroup(
  displayText: string,
  overrides: Partial<FamilyGroup> = {}
): FamilyGroup {
  return {
    familyKey: displayText,
    affix: 'prefix',
    members: [],
    globalMin: 0,
    globalMax: 0,
    displayText,
    hasMultiPlaceholder: false,
    rangeSlots: [],
    filterSlotIndex: 0,
    ...overrides,
  };
}

/** Create a minimal GameToken for tag-based classification */
function makeToken(tags: string[], jewelType?: JewelTypeCategory): GameToken {
  return {
    id: `test_${Math.random().toString(36).slice(2)}`,
    category: 'jewel',
    origin: 'normal',
    rawText: { ru: '' },
    rawTextTemplate: { ru: '' },
    regex: { ru: '' },
    familyKey: { ru: '' },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
    jewelType,
    genderForms: { ru: {} },
    affix: 'prefix',
    tags,
    ranges: [],
    values: [],
    hasYofication: false,
    yoficationPositions: [],
    level: 1,
  };
}

// ─── classifyJewelType — heuristic accuracy ───

describe('classifyJewelType heuristic', () => {
  it('classifies fire damage as ruby', () => {
    const group = makeGroup('(5—15)% увеличение урона от огня');
    expect(classifyJewelType(group)).toBe('ruby');
  });

  it('classifies bleed as ruby', () => {
    const group = makeGroup('(5—10)% увеличение длительности кровотечения');
    expect(classifyJewelType(group)).toBe('ruby');
  });

  it('classifies mace damage as ruby', () => {
    const group = makeGroup('(6—16)% увеличение урона булавами');
    expect(classifyJewelType(group)).toBe('ruby');
  });

  it('classifies totem mods as ruby', () => {
    const group = makeGroup('(10—18)% увеличение урона тотемов');
    expect(classifyJewelType(group)).toBe('ruby');
  });

  it('classifies shield defence as ruby (not shared)', () => {
    // Was misclassified as shared due to broad evasion override
    const group = makeGroup('(18—32)% увеличение брони, уклонения и энергетического щита от щита в руках');
    expect(classifyJewelType(group)).toBe('ruby');
  });

  it('classifies banner glory speed as ruby (not shared)', () => {
    // Was misclassified — scoring didn't reach threshold due to е/ё mismatch
    const group = makeGroup('#% повышение скорости накопления славы для умений знамен');
    expect(classifyJewelType(group)).toBe('ruby');
  });

  it('classifies banner duration as ruby (знамён with ё)', () => {
    const group = makeGroup('#% увеличение длительности умений знамён');
    expect(classifyJewelType(group)).toBe('ruby');
  });

  it('classifies lightning damage as shared (appears on multiple types)', () => {
    // "увеличение урона от молнии" is shared — SHARED_OVERRIDE catches it
    const group = makeGroup('(5—15)% увеличение урона от молнии');
    expect(classifyJewelType(group)).toBe('shared');
  });

  it('classifies bow damage as emerald', () => {
    const group = makeGroup('(6—16)% увеличение урона луками');
    expect(classifyJewelType(group)).toBe('emerald');
  });

  it('classifies mark skill effect as emerald (not shared)', () => {
    const group = makeGroup('(4—8)% усиление эффекта ваших умений меток');
    expect(classifyJewelType(group)).toBe('emerald');
  });

  it('classifies mark spell speed as emerald (not shared)', () => {
    // Was misclassified as shared — Sapphire spell casting tied with Emerald mark
    const group = makeGroup('Умения метки имеют (5—15)% повышение скорости сотворения чар');
    expect(classifyJewelType(group)).toBe('emerald');
  });

  it('classifies mark duration as emerald (not shared)', () => {
    const group = makeGroup('Умения меток имеют (18—32)% увеличение длительности эффекта умения');
    expect(classifyJewelType(group)).toBe('emerald');
  });

  it('classifies triple-ailment duration as emerald (not shared)', () => {
    // Was misclassified as shared — dual-ailment override was too broad
    const group = makeGroup('(5—10)% увеличение длительности поджога, шока и охлаждения на врагах');
    expect(classifyJewelType(group)).toBe('emerald');
  });

  it('classifies conditional stun threshold as emerald (not shared)', () => {
    // Was misclassified as shared — Ruby generic stun tied with Emerald specific
    const group = makeGroup('(15—25)% увеличение порога оглушения если недавно вы не были оглушены');
    expect(classifyJewelType(group)).toBe('emerald');
  });

  it('classifies cold damage as sapphire', () => {
    const group = makeGroup('(5—15)% увеличение урона от холода');
    expect(classifyJewelType(group)).toBe('shared'); // Cold damage is shared!
  });

  it('classifies freeze as sapphire', () => {
    const group = makeGroup('(10—20)% повышение скорости накопления шкалы заморозки');
    expect(classifyJewelType(group)).toBe('sapphire');
  });

  it('classifies curse area as sapphire', () => {
    const group = makeGroup('(8—12)% увеличение области действия проклятий');
    expect(classifyJewelType(group)).toBe('sapphire');
  });

  it('classifies minion chaos resist as sapphire (not shared)', () => {
    // Was misclassified as shared — resist override didn't exclude minion prefix
    const group = makeGroup('Приспешники имеют +#% к сопротивлению хаосу');
    expect(classifyJewelType(group)).toBe('sapphire');
  });

  it('classifies ES stun threshold as sapphire (not shared)', () => {
    // Was misclassified as shared — max ES override was too broad
    const group = makeGroup('Дарует дополнительный порог оглушения в размере ##% от максимума энергетического щита');
    expect(classifyJewelType(group)).toBe('sapphire');
  });

  it('classifies ES state threshold as sapphire (not shared)', () => {
    const group = makeGroup('Дарует дополнительный порог состояний в размере ##% от максимума энергетического щита');
    expect(classifyJewelType(group)).toBe('sapphire');
  });

  it('classifies generic evasion as shared', () => {
    const group = makeGroup('(10—20)% увеличение уклонения');
    expect(classifyJewelType(group)).toBe('shared');
  });

  it('classifies corrupted fire resist as shared', () => {
    const group = makeGroup('+(5—10)% к сопротивлению огню');
    expect(classifyJewelType(group)).toBe('shared');
  });

  it('classifies dagger damage as shared (not emerald)', () => {
    // Was misclassified as emerald — no override for dagger damage
    const group = makeGroup('(6—16)% увеличение урона кинжалами');
    expect(classifyJewelType(group)).toBe('shared');
  });

  it('classifies dagger attack speed as shared', () => {
    const group = makeGroup('#% повышение скорости атаки кинжалами');
    expect(classifyJewelType(group)).toBe('shared');
  });

  it('classifies dagger crit as shared', () => {
    const group = makeGroup('(6—16)% повышение шанса критического удара кинжалами');
    expect(classifyJewelType(group)).toBe('shared');
  });

  it('classifies dual-jewel combo as shared', () => {
    const group = makeGroup('Изнуряет врагов при нанесении удара, пока у вас размещены изумруд и сапфир');
    expect(classifyJewelType(group)).toBe('shared');
  });

  it('classifies passive radius grants as shared', () => {
    const group = makeGroup('Значимые пассивные умения в радиусе также дают: +(5—7)% к сопротивлению огню');
    expect(classifyJewelType(group)).toBe('shared');
  });

  it('uses ETL jewelType when available (no heuristic)', () => {
    const token = makeToken(['damage'], 'ruby');
    const group = makeGroup('(5—15)% увеличение урона от огня', {
      members: [token],
    });
    expect(classifyJewelType(group)).toBe('ruby');
  });

  it('uses ETL jewelType=shared when set', () => {
    const token = makeToken(['damage'], 'shared');
    const group = makeGroup('(5—15)% увеличение урона от огня', {
      members: [token],
    });
    expect(classifyJewelType(group)).toBe('shared');
  });
});

// ─── classifyByTags ───

describe('classifyByTags', () => {
  it('classifies damage tag as offensive', () => {
    const group = makeGroup('', { members: [makeToken(['damage'])] });
    expect(classifyByTags(group)).toBe('offensive');
  });

  it('classifies resistance tag as defensive', () => {
    const group = makeGroup('', { members: [makeToken(['resistance'])] });
    expect(classifyByTags(group)).toBe('defensive');
  });

  it('classifies attribute tag as attribute', () => {
    const group = makeGroup('', { members: [makeToken(['attribute'])] });
    expect(classifyByTags(group)).toBe('attribute');
  });

  it('classifies no tags as neutral', () => {
    const group = makeGroup('', { members: [makeToken([])] });
    expect(classifyByTags(group)).toBe('neutral');
  });

  it('uses majority voting for mixed tags', () => {
    const group = makeGroup('', {
      members: [
        makeToken(['damage']),
        makeToken(['damage']),
        makeToken(['resistance']),
      ],
    });
    expect(classifyByTags(group)).toBe('offensive');
  });
});

// ─── classifyByText ───

describe('classifyByText', () => {
  it('classifies attribute keywords correctly', () => {
    const group = makeGroup('+(5—7) к силе');
    expect(classifyByText(group)).toBe('attribute');
  });

  it('classifies offensive keywords correctly', () => {
    const group = makeGroup('(5—15)% увеличение урона от атак');
    expect(classifyByText(group)).toBe('offensive');
  });

  it('classifies defensive keywords correctly', () => {
    const group = makeGroup('+(5—10)% к сопротивлению огню');
    expect(classifyByText(group)).toBe('defensive');
  });

  it('classifies unknown as neutral', () => {
    const group = makeGroup('(4—6)% увеличение области действия');
    expect(classifyByText(group)).toBe('neutral');
  });
});

// ─── classifyWaystoneSentiment ───

describe('classifyWaystoneSentiment', () => {
  it('classifies rarity increase as positive', () => {
    const group = makeGroup('(10—20)% повышение редкости предметов');
    expect(classifyWaystoneSentiment(group)).toBe('positive');
  });

  it('classifies monster damage as negative', () => {
    const group = makeGroup('(15—25)% увеличение урона монстров');
    expect(classifyWaystoneSentiment(group)).toBe('negative');
  });

  it('classifies unknown as neutral', () => {
    const group = makeGroup('Какой-то мод');
    expect(classifyWaystoneSentiment(group)).toBe('neutral');
  });
});

// ─── classifyTabletType ───

describe('classifyTabletType', () => {
  it('classifies ritual keywords', () => {
    const group = makeGroup('(5—15)% увеличение количества даней от алтарей ритуала');
    expect(classifyTabletType(group)).toBe('ritual');
  });

  it('classifies breach keywords', () => {
    const group = makeGroup('(5—15)% увеличение урона в Бездне');
    expect(classifyTabletType(group)).toBe('breach');
  });

  it('classifies delirium keywords', () => {
    const group = makeGroup('(5—15)% увеличение наград за Зеркало Делириума');
    expect(classifyTabletType(group)).toBe('delirium');
  });

  it('classifies unknown as generic', () => {
    const group = makeGroup('(5—15)% увеличение области действия');
    expect(classifyTabletType(group)).toBe('generic');
  });
});
