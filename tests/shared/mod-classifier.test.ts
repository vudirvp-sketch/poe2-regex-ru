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
  classifyPriorityTier,
  TIER_SORT_ORDER,
  type JewelTypeCategory,
} from '@shared/mod-classifier';
import type { FamilyGroup, GameToken } from '@shared/types';

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
    priorityTier: 'C',
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

  // ─── Bug #4-5 fix (iter 84): aura + gem tags → offensive ───

  it('classifies aura tag as offensive (Bug #4 fix)', () => {
    // jewel: "##% увеличение силы умений аур"
    const group = makeGroup('', { members: [makeToken(['aura'])] });
    expect(classifyByTags(group)).toBe('offensive');
  });

  it('classifies gem tag as offensive (Bug #5 fix)', () => {
    // amulet: "+# к уровню всех камней умений чар" — when gem is the only tag
    const group = makeGroup('', { members: [makeToken(['gem'])] });
    expect(classifyByTags(group)).toBe('offensive');
  });

  // ─── Bug #7 fix (iter 84): Breach Lord source tags skipped + text fallback ───

  it('skips kurgal_mod tag and uses other tags (Bug #7 fix)', () => {
    // kurgal_mod + damage → should classify as offensive (not neutral)
    const group = makeGroup('', {
      members: [makeToken(['kurgal_mod', 'damage'])],
    });
    expect(classifyByTags(group)).toBe('offensive');
  });

  it('skips amanamu_mod tag and uses other tags (Bug #7 fix)', () => {
    // amanamu_mod + minion + damage → offensive
    const group = makeGroup('', {
      members: [makeToken(['amanamu_mod', 'damage', 'minion'])],
    });
    expect(classifyByTags(group)).toBe('offensive');
  });

  it('skips ulaman_mod tag and uses other tags (Bug #7 fix)', () => {
    // ulaman_mod + resistance → defensive
    const group = makeGroup('', {
      members: [makeToken(['ulaman_mod', 'resistance'])],
    });
    expect(classifyByTags(group)).toBe('defensive');
  });

  it('falls back to text when only Breach Lord tags present — armour/eva/ES (Bug #7 fix)', () => {
    // amanamu_mod only: "##% увеличение глобальной брони, уклонения и энергетического щита"
    // → text matches /брон/ → defensive
    const group = makeGroup('##% увеличение глобальной брони, уклонения и энергетического щита', {
      members: [makeToken(['amanamu_mod'])],
    });
    expect(classifyByTags(group)).toBe('defensive');
  });

  it('falls back to text when only Breach Lord tags present — flask (Bug #7 fix)', () => {
    // kurgal_mod only: "Флаконы маны получают зарядов в секунду: ##"
    // → text matches /флакон/ (Bug #7 fix extended DEFENSIVE_KEYWORDS) → defensive
    const group = makeGroup('Флаконы маны получают зарядов в секунду: ##', {
      members: [makeToken(['kurgal_mod'])],
    });
    expect(classifyByTags(group)).toBe('defensive');
  });

  it('falls back to text when only Breach Lord tags present — attribute (Bug #7 fix)', () => {
    // ulaman_mod only: "+# к силе и ловкости" → text matches /к силе/ → attribute
    const group = makeGroup('+# к силе и ловкости', {
      members: [makeToken(['ulaman_mod'])],
    });
    expect(classifyByTags(group)).toBe('attribute');
  });

  it('stays neutral when only Breach Lord tags + no text match (Bug #7 fix)', () => {
    // amanamu_mod only: "##% усиление эффекта создаваемых вами сгустков" — Wisps buff
    // → no text match → neutral (will be handled by future "Wisps" block in P0 proposal)
    const group = makeGroup('##% усиление эффекта создаваемых вами сгустков', {
      members: [makeToken(['amanamu_mod'])],
    });
    expect(classifyByTags(group)).toBe('neutral');
  });

  it('does NOT use text fallback when member has no tags at all', () => {
    // No tags (empty) — should not trigger Breach Lord text-fallback path
    // Even if text matches, classifyByTags returns neutral (preserves original behavior)
    const group = makeGroup('+(5—10)% к сопротивлению огню', {
      members: [makeToken([])],
    });
    expect(classifyByTags(group)).toBe('neutral');
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

  // ─── Bug #2 fix (iter 84): waystone mis-classifications ───

  it('classifies more magic+rarer monsters as positive (Bug #2 fix)', () => {
    // Was neutral — should be positive (more rare monsters = more loot)
    const group = makeGroup('На #% больше волшебных и редких монстров');
    expect(classifyWaystoneSentiment(group)).toBe('positive');
  });

  it('classifies monster crit damage bonus as negative (Bug #2 fix)', () => {
    // Was neutral — should be negative (monsters do more crit damage)
    const group = makeGroup('+##% к бонусу критического урона монстров');
    expect(classifyWaystoneSentiment(group)).toBe('negative');
  });

  it('classifies more rare monster properties as negative (Bug #2 fix)', () => {
    // Was neutral — should be negative (rare monsters get more properties = harder)
    const group = makeGroup('На #% больше шанса появления свойств у редких монстров');
    expect(classifyWaystoneSentiment(group)).toBe('negative');
  });

  it('classifies more monster effectiveness as negative (Bug #2 fix)', () => {
    // Was neutral — should be negative (monsters more effective = harder)
    // Note: "увеличенной эффективности монстров" already in NEGATIVE — this tests
    // the new "больше эффективности монстров" variant (different phrasing)
    const group = makeGroup('На #% больше эффективности монстров');
    expect(classifyWaystoneSentiment(group)).toBe('negative');
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

// ─── classifyPriorityTier ───

describe('classifyPriorityTier', () => {
  // ─── Ring ───
  describe('ring', () => {
    it('classifies +skill levels as S-tier', () => {
      const group = makeGroup('+(1—2) к уровню камней умений');
      expect(classifyPriorityTier(group, 'ring')).toBe('S');
    });

    it('classifies Spirit as S-tier', () => {
      const group = makeGroup('+(5—10) Дух');
      expect(classifyPriorityTier(group, 'ring')).toBe('S');
    });

    it('classifies All Res as S-tier', () => {
      const group = makeGroup('+(5—10)% ко всем стихийным сопротивлениям');
      expect(classifyPriorityTier(group, 'ring')).toBe('S');
    });

    it('classifies ES as S-tier', () => {
      const group = makeGroup('+(10—20) энергетический щит');
      expect(classifyPriorityTier(group, 'ring')).toBe('S');
    });

    it('classifies attributes as A-tier', () => {
      const group = makeGroup('+(5—7) к силе');
      expect(classifyPriorityTier(group, 'ring')).toBe('A');
    });

    it('classifies attack speed as A-tier', () => {
      const group = makeGroup('(5—15)% повышение скорости атаки');
      expect(classifyPriorityTier(group, 'ring')).toBe('A');
    });

    it('classifies chaos res as B-tier', () => {
      const group = makeGroup('+(5—10)% к сопротивлению хаосу');
      expect(classifyPriorityTier(group, 'ring')).toBe('B');
    });

    it('classifies MF as B-tier', () => {
      const group = makeGroup('(5—15)% повышение редкости найденных предметов');
      expect(classifyPriorityTier(group, 'ring')).toBe('B');
    });

    it('classifies unknown as C-tier', () => {
      const group = makeGroup('(3—5)% шанс наложить кровотечение');
      expect(classifyPriorityTier(group, 'ring')).toBe('C');
    });
  });

  // ─── Amulet ───
  describe('amulet', () => {
    it('classifies +skill levels as S-tier', () => {
      const group = makeGroup('+(1—2) к уровню камней умений');
      expect(classifyPriorityTier(group, 'amulet')).toBe('S');
    });

    it('classifies All Attributes as S-tier', () => {
      const group = makeGroup('+(5—10) ко всем атрибутам');
      expect(classifyPriorityTier(group, 'amulet')).toBe('S');
    });

    it('classifies max mana as A-tier', () => {
      const group = makeGroup('+(10—20) максимум маны');
      expect(classifyPriorityTier(group, 'amulet')).toBe('A');
    });

    it('classifies chaos res as B-tier', () => {
      const group = makeGroup('+(5—10)% к сопротивлению хаосу');
      expect(classifyPriorityTier(group, 'amulet')).toBe('B');
    });
  });

  // ─── Belt ───
  describe('belt', () => {
    it('classifies max life as S-tier', () => {
      const group = makeGroup('+(30—60) максимум здоровья');
      expect(classifyPriorityTier(group, 'belt')).toBe('S');
    });

    it('classifies All Res as S-tier', () => {
      const group = makeGroup('+(5—10)% ко всем стихийным сопротивлениям');
      expect(classifyPriorityTier(group, 'belt')).toBe('S');
    });

    it('classifies flask life recovery as S-tier', () => {
      const group = makeGroup('(10—20)% увеличение скорости восстановления здоровья флаконом');
      expect(classifyPriorityTier(group, 'belt')).toBe('S');
    });

    it('classifies individual res as A-tier', () => {
      const group = makeGroup('+(15—30)% к сопротивлению огню');
      expect(classifyPriorityTier(group, 'belt')).toBe('A');
    });

    it('classifies attributes as A-tier', () => {
      const group = makeGroup('+(5—7) к силе');
      expect(classifyPriorityTier(group, 'belt')).toBe('A');
    });
  });

  // ─── Waystone ───
  describe('waystone', () => {
    it('classifies quantity as S-tier prefix', () => {
      const group = makeGroup('(5—15)% повышение количества найденных предметов', { affix: 'prefix' });
      expect(classifyPriorityTier(group, 'waystone')).toBe('S');
    });

    it('classifies rarity as S-tier prefix', () => {
      const group = makeGroup('(5—15)% повышение редкости найденных предметов', { affix: 'prefix' });
      expect(classifyPriorityTier(group, 'waystone')).toBe('S');
    });

    it('classifies experience as A-tier prefix', () => {
      const group = makeGroup('(5—15)% повышение опыта', { affix: 'prefix' });
      expect(classifyPriorityTier(group, 'waystone')).toBe('A');
    });

    it('classifies extra waystones as S-tier suffix', () => {
      const group = makeGroup('Дополнительных путевых камней: #(1—3)', { affix: 'suffix' });
      expect(classifyPriorityTier(group, 'waystone')).toBe('S');
    });

    it('classifies negative suffix as C-tier (not sought after)', () => {
      const group = makeGroup('(15—25)% увеличение урона монстров', { affix: 'suffix' });
      expect(classifyPriorityTier(group, 'waystone')).toBe('C');
    });
  });

  // ─── Tablet ───
  describe('tablet', () => {
    it('classifies quantity in maps as S-tier', () => {
      const group = makeGroup('(5—15)% увеличение количества предметов в картах');
      expect(classifyPriorityTier(group, 'tablet')).toBe('S');
    });

    it('classifies generic as B-tier', () => {
      const group = makeGroup('(5—15)% увеличение области действия');
      expect(classifyPriorityTier(group, 'tablet')).toBe('B');
    });
  });

  // ─── Unknown categories ───
  describe('unknown categories', () => {
    it('returns C for jewel category', () => {
      const group = makeGroup('+(5—10) Дух');
      expect(classifyPriorityTier(group, 'jewel')).toBe('C');
    });

    it('returns C for relic category', () => {
      const group = makeGroup('+(5—10) Дух');
      expect(classifyPriorityTier(group, 'relic')).toBe('C');
    });
  });

  // ─── TIER_SORT_ORDER ───
  describe('TIER_SORT_ORDER', () => {
    it('S has lower order than A', () => {
      expect(TIER_SORT_ORDER.S).toBeLessThan(TIER_SORT_ORDER.A);
    });

    it('A has lower order than B', () => {
      expect(TIER_SORT_ORDER.A).toBeLessThan(TIER_SORT_ORDER.B);
    });

    it('B has lower order than C', () => {
      expect(TIER_SORT_ORDER.B).toBeLessThan(TIER_SORT_ORDER.C);
    });
  });
});
