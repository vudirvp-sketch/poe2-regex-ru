/**
 * Unit tests for mod-classifier.ts — jewel type heuristic, semantic classification,
 * waystone sentiment, tablet type classification, and functional blocks (iter 85).
 *
 * Focus: classifyJewelType heuristic accuracy against ETL ground truth.
 * The heuristic is only used as fallback when ETL jewelType is absent,
 * but must be accurate for future mods and corrupted/desecrated variants.
 *
 * iter 85: classifyFunctionalBlock tests for the 7 high-priority blocks
 * (spirit/skill-levels/attributes/resistances/runes-barrier/magic-find/breach).
 */
import { describe, it, expect } from 'vitest';
import {
  classifyJewelType,
  classifyByTags,
  classifyByText,
  classifyWaystoneSentiment,
  classifyTabletType,
  classifyPriorityTier,
  classifyFunctionalBlock,
  classifyGroups,
  FUNCTIONAL_BLOCK_LABELS,
  TIER_SORT_ORDER,
  type JewelTypeCategory,
  type FunctionalBlock,
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

// ─── classifyFunctionalBlock (iter 86: 14 high-priority blocks) ───

describe('classifyFunctionalBlock (iter 86)', () => {
  // ─── spirit ───
  describe('spirit block', () => {
    it('classifies "+# к духу" (amulet S-tier) as spirit', () => {
      const group = makeGroup('+(1—2) к духу');
      expect(classifyFunctionalBlock(group)).toBe('spirit');
    });

    it('classifies plain "Дух" mention as spirit', () => {
      const group = makeGroup('+5 к духу');
      expect(classifyFunctionalBlock(group)).toBe('spirit');
    });
  });

  // ─── skill-levels ───
  describe('skill-levels block', () => {
    it('classifies "+# к уровню всех камней умений" as skill-levels', () => {
      const group = makeGroup('+(1—2) к уровню всех камней умений');
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('classifies "+#% к максимальному качеству" as skill-levels', () => {
      // Was in neutral — now classified into skill-levels (not MF!)
      const group = makeGroup('+(5—10)% к максимальному качеству');
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('classifies "#% повышение скорости перезарядки умений" as skill-levels', () => {
      const group = makeGroup('(10—20)% повышение скорости перезарядки умений');
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('classifies "#% увеличение длительности эффекта умения" as skill-levels', () => {
      const group = makeGroup('(15—25)% увеличение длительности эффекта умения');
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('does NOT classify "скорость перезарядки боевых кличей" as skill-levels (deferred to buff-skills iter 87+)', () => {
      // This mod is warcry-related → should fall through to 'other' for now
      const group = makeGroup('(10—20)% повышение скорости перезарядки боевых кличей');
      expect(classifyFunctionalBlock(group)).toBe('other');
    });
  });

  // ─── attributes ───
  describe('attributes block', () => {
    it('classifies "+# к силе" as attributes', () => {
      const group = makeGroup('+(5—7) к силе');
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies "+# к ловкости" as attributes', () => {
      const group = makeGroup('+(5—7) к ловкости');
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies "+# к интеллекту" as attributes', () => {
      const group = makeGroup('+(5—7) к интеллекту');
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies "+# ко всем атрибутам" as attributes', () => {
      const group = makeGroup('+(5—10) ко всем атрибутам');
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies dual-attribute Breach Lord mod (ulaman: сила+ловкость) as attributes', () => {
      const group = makeGroup('+# к силе и ловкости');
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies dual-attribute Breach Lord mod (kurgal: ловкость+интеллект) as attributes', () => {
      const group = makeGroup('+# к ловкости и интеллекту');
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies dual-attribute Breach Lord mod (amanamu: сила+интеллект) as attributes', () => {
      const group = makeGroup('+# к силе и интеллекту');
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies requirement-reduction mod as attributes (kurgal amulet)', () => {
      // "#% уменьшение требований к характеристикам у снаряжения и камней умений"
      const group = makeGroup('(10—20)% уменьшение требований к характеристикам у снаряжения и камней умений');
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });
  });

  // ─── resistances ───
  describe('resistances block', () => {
    it('classifies "+#% к сопротивлению огню" as resistances', () => {
      const group = makeGroup('+(15—30)% к сопротивлению огню');
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });

    it('classifies "+#% ко всем стихийным сопротивлениям" as resistances', () => {
      const group = makeGroup('+(5—10)% ко всем стихийным сопротивлениям');
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });

    it('classifies "+#% к сопротивлению хаосу" as resistances', () => {
      const group = makeGroup('+(5—10)% к сопротивлению хаосу');
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });

    it('classifies "#% повышение значений добавленных свойств сопротивлений" as resistances (no-tag neutral fix)', () => {
      // Was in neutral — now correctly classified as resistances
      const group = makeGroup('(10—20)% повышение значений добавленных свойств сопротивлений');
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });
  });

  // ─── runes-barrier ───
  describe('runes-barrier block', () => {
    it('classifies "+# к максимуму рунического барьера" as runes-barrier (ring)', () => {
      const group = makeGroup('+(1—2) к максимуму рунического барьера');
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });

    it('classifies "#% увеличение максимума рунического барьера" as runes-barrier (amulet)', () => {
      const group = makeGroup('(10—20)% увеличение максимума рунического барьера');
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });

    it('classifies "#% повышение скорости регенерации рунического барьера" as runes-barrier (belt)', () => {
      const group = makeGroup('(15—25)% повышение скорости регенерации рунического барьера');
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });

    it('classifies "Восстанавливает # рунического барьера при использовании оберега" as runes-barrier (belt)', () => {
      const group = makeGroup('Восстанавливает # рунического барьера при использовании оберега');
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });
  });

  // ─── magic-find ───
  describe('magic-find block', () => {
    it('classifies "#% повышение редкости найденных предметов" as magic-find (prefix)', () => {
      const group = makeGroup('(10—20)% повышение редкости найденных предметов');
      expect(classifyFunctionalBlock(group)).toBe('magic-find');
    });

    it('classifies "#% повышение редкости найденных предметов" as magic-find (suffix)', () => {
      const group = makeGroup('(10—20)% повышение редкости найденных предметов', { affix: 'suffix' });
      expect(classifyFunctionalBlock(group)).toBe('magic-find');
    });

    it('does NOT classify "+#% к максимальному качеству" as magic-find (it is skill-levels, not MF)', () => {
      const group = makeGroup('+(5—10)% к максимальному качеству');
      expect(classifyFunctionalBlock(group)).not.toBe('magic-find');
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });
  });

  // ─── breach ───
  describe('breach block', () => {
    it('classifies "Знак повелителя Бездны" as breach (essence-origin, no tags → was neutral)', () => {
      const group = makeGroup('Знак повелителя Бездны');
      expect(classifyFunctionalBlock(group)).toBe('breach');
    });

    it('classifies "Знак повелителя Бездны" regardless of affix (prefix/suffix)', () => {
      const prefixGroup = makeGroup('Знак повелителя Бездны', { affix: 'prefix' });
      const suffixGroup = makeGroup('Знак повелителя Бездны', { affix: 'suffix' });
      expect(classifyFunctionalBlock(prefixGroup)).toBe('breach');
      expect(classifyFunctionalBlock(suffixGroup)).toBe('breach');
    });
  });

  // ─── iter 86: 7 new blocks ───

  // ─── flasks ───
  describe('flasks block (iter 86)', () => {
    it('classifies "Флаконы здоровья получают зарядов в секунду" as flasks (amulet, charm tag)', () => {
      const group = makeGroup('Флаконы здоровья получают зарядов в секунду: (0.08—0.17)', {
        members: [makeToken(['charm'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('classifies "Флаконы получают зарядов в секунду" as flasks (belt, no tag)', () => {
      const group = makeGroup('Флаконы получают зарядов в секунду: (0.75—1)');
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('classifies "уменьшение используемого количества зарядов флакона" as flasks (belt, no tag)', () => {
      const group = makeGroup('(8—10)% уменьшение используемого количества зарядов флакона');
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('classifies "шанс сохранить заряды флаконов" as flasks (belt, no tag)', () => {
      const group = makeGroup('(10—15)% шанс сохранить заряды флаконов при их использовании');
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('classifies flask-conditional mods as flasks (NOT damage-type or offence-speed)', () => {
      // Has caster+damage tags but text «флакон» — flasks wins by priority
      const group1 = makeGroup('(20—25)% увеличение урона чар во время действия любого флакона', {
        members: [makeToken(['caster', 'damage'])],
      });
      expect(classifyFunctionalBlock(group1)).toBe('flasks');

      // Has caster+speed tags but text «флакон» — flasks wins by priority
      const group2 = makeGroup('(8—10)% увеличение скорости сотворения чар во время действия любого флакона', {
        members: [makeToken(['caster', 'speed'])],
      });
      expect(classifyFunctionalBlock(group2)).toBe('flasks');
    });

    it('classifies "повышение скорости восстановления здоровья от флакона" as flasks (NOT resources)', () => {
      // Has life tag but text «флакон» — flasks wins by priority over resources
      const group = makeGroup('(5—10)% повышение скорости восстановления здоровья от флакона', {
        members: [makeToken(['life'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('does NOT classify "обереги" mods as flasks (they go to defence-stats via charm tag)', () => {
      const group = makeGroup('Обереги получают зарядов в секунду: (0.08—0.17)', {
        members: [makeToken(['charm'])],
      });
      expect(classifyFunctionalBlock(group)).not.toBe('flasks');
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });
  });

  // ─── minions ───
  describe('minions block (iter 86)', () => {
    it('classifies "Приспешники имеют +#% к сопротивлению всем стихиям" as minions (minion+resist tags — minion wins)', () => {
      const group = makeGroup('Приспешники имеют +(7—9)% к сопротивлению всем стихиям', {
        members: [makeToken(['minion', 'resistance', 'elemental'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "Приспешники имеют ##% повышение шанса критического удара" as minions (minion+critical — minion wins)', () => {
      const group = makeGroup('Приспешники имеют (5—12)% повышение шанса критического удара', {
        members: [makeToken(['minion', 'critical'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "Приспешники имеют ##% увеличение максимума здоровья" as minions (minion+life — minion wins)', () => {
      const group = makeGroup('Приспешники имеют (7—10)% увеличение максимума здоровья', {
        members: [makeToken(['minion', 'life'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "##% увеличение урона приспешников" as minions (minion+damage — minion wins)', () => {
      const group = makeGroup('(7—12)% увеличение урона приспешников за каждое использованное различное умение-приказ', {
        members: [makeToken(['minion', 'damage'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "##% усиление эффекта Подношений" as minions (text «подношен» matches)', () => {
      // Was 'other' in iter 85 (deferred) — now caught by MINIONS_PATTERN in iter 86.
      const group = makeGroup('(15—25)% усиление эффекта Подношений');
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "##% шанс получить Архонта Нежити при создании подношения" as minions (minion tag)', () => {
      const group = makeGroup('(35—50)% шанс получить Архонта Нежити при создании подношения', {
        members: [makeToken(['minion'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "##% увеличение длительности умений подношений" as minions (minion tag + text «подношен»)', () => {
      const group = makeGroup('(6—15)% увеличение длительности умений подношений', {
        members: [makeToken(['minion'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('does NOT classify "+1 к уровню всех камней умений приспешников" as minions (skill-levels wins)', () => {
      // skill-levels has higher priority — it's a +level mod, not a minion-function mod
      const group = makeGroup('+1 к уровню всех камней умений приспешников', {
        members: [makeToken(['gem', 'minion'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('classifies "Приспешники имеют ##% повышение скорости передвижения" as minions (minion+speed — minion wins)', () => {
      const group = makeGroup('Приспешники имеют (5—7)% повышение скорости передвижения', {
        members: [makeToken(['minion', 'speed'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });
  });

  // ─── resources ───
  describe('resources block (iter 86)', () => {
    it('classifies "+# к максимуму здоровья" as resources (life tag)', () => {
      const group = makeGroup('+(10—19) к максимуму здоровья', {
        members: [makeToken(['life'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "+# к максимуму маны" as resources (mana tag)', () => {
      const group = makeGroup('+(10—14) к максимуму маны', {
        members: [makeToken(['mana'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "+# к максимуму энергетического щита" as resources (ES max text — caught BEFORE defence-stats)', () => {
      // Has energy_shield tag BUT text matches «максимум.*энергетическ.*щит» — resources wins
      const group = makeGroup('+(8—14) к максимуму энергетического щита', {
        members: [makeToken(['energy_shield'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "##% увеличение максимума энергетического щита" as resources (ES % max)', () => {
      const group = makeGroup('(15—25)% увеличение максимума энергетического щита', {
        members: [makeToken(['energy_shield'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "##% полученного урона восполняется в виде здоровья" as resources (life tag)', () => {
      const group = makeGroup('(10—12)% полученного урона восполняется в виде здоровья', {
        members: [makeToken(['life'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies MoM mod "от получаемого урона берется сначала из маны" as resources (life+mana tags)', () => {
      const group = makeGroup('(8—16)% от получаемого урона берется сначала из маны вместо здоровья', {
        members: [makeToken(['life', 'mana'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "##% увеличение количества похищенного здоровья" as resources (life tag, Breach Lord)', () => {
      const group = makeGroup('(12—20)% увеличение количества похищенного здоровья', {
        members: [makeToken(['amanamu_mod', 'life'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "Регенерация # здоровья в секунду" as resources (life tag)', () => {
      const group = makeGroup('Регенерация (1—2) здоровья в секунду', {
        members: [makeToken(['life'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "Восстанавливает ##% здоровья при убийстве" as resources (life tag, Breach Lord)', () => {
      const group = makeGroup('Восстанавливает (2—3)% здоровья при убийстве', {
        members: [makeToken(['life', 'ulaman_mod'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });
  });

  // ─── defence-stats ───
  describe('defence-stats block (iter 86)', () => {
    it('classifies "+# к броне" as defence-stats (armour tag, belt)', () => {
      const group = makeGroup('+(12—22) к броне', {
        members: [makeToken(['armour'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% повышение брони" as defence-stats (armour tag, amulet)', () => {
      const group = makeGroup('(10—14)% повышение брони', {
        members: [makeToken(['armour'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% увеличение уклонения" as defence-stats (evasion tag)', () => {
      const group = makeGroup('(15—25)% увеличение уклонения', {
        members: [makeToken(['evasion'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "+# к уклонению" as defence-stats (evasion tag, ring)', () => {
      const group = makeGroup('+(8—17) к уклонению', {
        members: [makeToken(['evasion'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% увеличение длительности эффекта оберега" as defence-stats (charm tag)', () => {
      const group = makeGroup('(4—9)% увеличение длительности эффекта оберега', {
        members: [makeToken(['charm'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "Обереги получают зарядов в секунду" as defence-stats (charm tag, NOT flasks)', () => {
      // No «флакон» text → not flasks; charm tag → defence-stats
      const group = makeGroup('Обереги получают зарядов в секунду: (0.08—0.17)', {
        members: [makeToken(['charm'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "+# к порогу оглушения" as defence-stats (text, no tag, belt)', () => {
      const group = makeGroup('+(6—11) к порогу оглушения');
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% ускорение начала перезарядки энергетического щита" as defence-stats (ES recharge — NOT resources)', () => {
      // Has energy_shield tag but NO «максимум» text → falls through to defence-stats (not resources)
      const group = makeGroup('##% ускорение начала перезарядки энергетического щита', {
        members: [makeToken(['energy_shield'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% увеличение отклонения ударов" as defence-stats (evasion tag, amulet)', () => {
      const group = makeGroup('(10—20)% увеличение отклонения ударов', {
        members: [makeToken(['evasion', 'ulaman_mod'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });
  });

  // ─── crit ───
  describe('crit block (iter 86)', () => {
    it('classifies "##% повышение шанса критического удара" as crit (critical tag)', () => {
      const group = makeGroup('(10—14)% повышение шанса критического удара', {
        members: [makeToken(['critical'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });

    it('classifies "##% увеличение бонуса к критическому урону" as crit (critical+damage — crit wins)', () => {
      const group = makeGroup('(15—20)% увеличение бонуса к критическому урона', {
        members: [makeToken(['critical', 'damage'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });

    it('classifies "##% повышение шанса критического удара для чар" as crit (critical+caster tags)', () => {
      const group = makeGroup('(7—9)% повышение шанса критического удара для чар', {
        members: [makeToken(['caster', 'critical'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });

    it('classifies "+#% к шансу критического удара чар огня" as crit (critical+caster+elemental+fire — crit wins)', () => {
      const group = makeGroup('+(4—5)% к шансу критического удара чар огня', {
        members: [makeToken(['caster', 'critical', 'elemental', 'fire'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });

    it('classifies "+#% к шансу критического удара шипами" as crit (critical+damage — crit wins)', () => {
      const group = makeGroup('+(2—4)% к шансу критического удара шипами', {
        members: [makeToken(['amanamu_mod', 'critical', 'damage'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });
  });

  // ─── damage-type ───
  describe('damage-type block (iter 86)', () => {
    it('classifies "##% увеличение урона" as damage-type (damage tag)', () => {
      const group = makeGroup('(20—30)% увеличение урона', {
        members: [makeToken(['damage'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "##% увеличение урона от огня" as damage-type (damage+elemental+fire tags)', () => {
      const group = makeGroup('(3—7)% увеличение урона от огня', {
        members: [makeToken(['damage', 'elemental', 'fire'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "##% увеличение урона от холода" as damage-type (cold+damage+elemental tags)', () => {
      const group = makeGroup('(3—7)% увеличение урона от холода', {
        members: [makeToken(['cold', 'damage', 'elemental'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "##% увеличение урона хаосом" as damage-type (chaos+damage tags)', () => {
      const group = makeGroup('(3—7)% увеличение урона хаосом', {
        members: [makeToken(['chaos', 'damage'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "Добавляет от # до # физического урона к атакам" as damage-type (attack+damage+physical tags)', () => {
      const group = makeGroup('Добавляет от (1—2) до 3 физического урона к атакам', {
        members: [makeToken(['attack', 'damage', 'physical'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "##% увеличение урона от молнии, если подобрали насыщение" as damage-type (elemental+lightning, NO resistance tag)', () => {
      const group = makeGroup('(41—59)% увеличение урона от молнии, если вы подобрали Молниевое насыщение за последнее время', {
        members: [makeToken(['elemental', 'lightning'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('does NOT classify "+#% к сопротивлению огню" as damage-type (resistances wins by priority)', () => {
      const group = makeGroup('+(6—10)% к сопротивлению огню', {
        members: [makeToken(['elemental', 'fire', 'resistance'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });

    it('does NOT classify "##% увеличение бонуса к критическому урону" as damage-type (crit wins by priority)', () => {
      const group = makeGroup('(15—20)% увеличение бонуса к критическому урону', {
        members: [makeToken(['critical', 'damage'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });
  });

  // ─── offence-speed ───
  describe('offence-speed block (iter 86)', () => {
    it('classifies "##% повышение скорости сотворения чар" as offence-speed (caster+speed tags)', () => {
      const group = makeGroup('(9—12)% повышение скорости сотворения чар', {
        members: [makeToken(['caster', 'speed'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('offence-speed');
    });

    it('classifies "##% повышение скорости атаки" as offence-speed (attack+speed tags, ring)', () => {
      const group = makeGroup('(7—9)% повышение скорости атаки', {
        members: [makeToken(['attack', 'speed'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('offence-speed');
    });

    it('does NOT classify "##% повышение скорости перезарядки умений" as offence-speed (skill-levels wins)', () => {
      // skill-levels catches "скорость перезарядки умений" first
      const group = makeGroup('(8—12)% повышение скорости перезарядки умений', {
        members: [makeToken(['kurgal_mod'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('does NOT classify "Приспешники имеют ##% повышение скорости передвижения" as offence-speed (minions wins)', () => {
      const group = makeGroup('Приспешники имеют (5—7)% повышение скорости передвижения', {
        members: [makeToken(['minion', 'speed'])],
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('does NOT classify "##% повышение скорости перезарядки боевых кличей" as offence-speed (buff-skills deferred → other)', () => {
      const group = makeGroup('(10—20)% повышение скорости перезарядки боевых кличей');
      expect(classifyFunctionalBlock(group)).toBe('other');
    });
  });

  // ─── other (fallback) ───
  describe('other block (fallback)', () => {
    it('classifies "#% усиление эффекта создаваемых вами сгустков" as other (wisps — deferred to iter 87+)', () => {
      const group = makeGroup('(15—25)% усиление эффекта создаваемых вами сгустков');
      expect(classifyFunctionalBlock(group)).toBe('other');
    });

    it('classifies "#% усиление эффекта Подношений" as minions (iter 86: text «подношен» matches)', () => {
      // Was 'other' in iter 85 (deferred) — now caught by MINIONS_PATTERN in iter 86.
      const group = makeGroup('(15—25)% усиление эффекта Подношений');
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "#% увеличение максимума энергии вызываемых умений" as other (meta-skills — deferred to iter 87+)', () => {
      const group = makeGroup('(10—20)% увеличение максимума энергии вызываемых умений');
      expect(classifyFunctionalBlock(group)).toBe('other');
    });

    it('classifies "#% усиление положительных эффектов Архонта на вас" as other (meta-skills — deferred to iter 87+)', () => {
      const group = makeGroup('(15—25)% усиление положительных эффектов Архонта на вас');
      expect(classifyFunctionalBlock(group)).toBe('other');
    });
  });

  // ─── Match priority (ordering) ───
  describe('match priority', () => {
    it('spirit wins over skill-levels (дух vs умения — no overlap, but spirit is more specific)', () => {
      // Single-token "Дух" should always go to spirit
      const group = makeGroup('+1 к духу');
      expect(classifyFunctionalBlock(group)).toBe('spirit');
    });

    it('runes-barrier wins over resistances (no overlap in practice, but specific first)', () => {
      // "рунического барьера" doesn't contain "сопротивл"
      const group = makeGroup('+1 к максимуму рунического барьера');
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });

    it('breach wins over attributes (Знак повелителя Бездны has no attribute text)', () => {
      const group = makeGroup('Знак повелителя Бездны');
      expect(classifyFunctionalBlock(group)).toBe('breach');
    });

    it('attributes wins over resistances (dual-attr "силе и ловкости" has no resist substring)', () => {
      const group = makeGroup('+# к силе и ловкости');
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });
  });

  // ─── FUNCTIONAL_BLOCK_LABELS ───
  describe('FUNCTIONAL_BLOCK_LABELS', () => {
    it('has 24 entries (one per FunctionalBlock)', () => {
      expect(Object.keys(FUNCTIONAL_BLOCK_LABELS)).toHaveLength(24);
    });

    it('every block has non-empty label and colorClass', () => {
      for (const [, config] of Object.entries(FUNCTIONAL_BLOCK_LABELS)) {
        expect(config.label.length).toBeGreaterThan(0);
        expect(config.colorClass.length).toBeGreaterThan(0);
        expect(config.bgClass.length).toBeGreaterThan(0);
        expect(config.borderClass.length).toBeGreaterThan(0);
      }
    });

    it('every FunctionalBlock key is in FUNCTIONAL_BLOCK_LABELS', () => {
      const allBlocks: FunctionalBlock[] = [
        'spirit', 'skill-levels', 'attributes', 'resources', 'resistances',
        'runes-barrier', 'magic-find', 'defence-stats', 'offence-speed', 'crit',
        'damage-type', 'penetration', 'ailments', 'area-duration', 'wisps',
        'buff-skills', 'minions', 'meta-skills', 'weapon-specific', 'flasks',
        'conversion', 'rage-charges', 'breach', 'other',
      ];
      for (const block of allBlocks) {
        expect(FUNCTIONAL_BLOCK_LABELS[block]).toBeDefined();
      }
    });
  });
});

// ─── classifyGroups with affix-functional mode (iter 86) ───

describe('classifyGroups with affix-functional mode (iter 86)', () => {
  it('returns empty array for empty input', () => {
    expect(classifyGroups([], 'affix-functional')).toEqual([]);
  });

  it('classifies a mixed set into multiple functional blocks', () => {
    const groups: FamilyGroup[] = [
      makeGroup('+(1—2) к духу'),                                // spirit
      makeGroup('+(5—7) к силе'),                                // attributes
      makeGroup('+(15—30)% к сопротивлению огню'),               // resistances
      makeGroup('+(1—2) к максимуму рунического барьера'),       // runes-barrier
      makeGroup('(10—20)% повышение редкости найденных предметов'), // magic-find
      makeGroup('Знак повелителя Бездны'),                       // breach
      makeGroup('#% усиление эффекта создаваемых вами сгустков'), // other (wisps deferred)
    ];

    const result = classifyGroups(groups, 'affix-functional');

    // 7 distinct blocks should appear
    expect(result).toHaveLength(7);

    // Verify labels — and order matches FUNCTIONAL_BLOCK_ORDER
    const labels = result.map(sg => sg.key);
    expect(labels).toContain('spirit');
    expect(labels).toContain('attributes');
    expect(labels).toContain('resistances');
    expect(labels).toContain('runes-barrier');
    expect(labels).toContain('magic-find');
    expect(labels).toContain('breach');
    expect(labels).toContain('other');

    // Verify spirit comes before attributes in the rendering order
    const spiritIdx = labels.indexOf('spirit');
    const attrIdx = labels.indexOf('attributes');
    expect(spiritIdx).toBeLessThan(attrIdx);
  });

  it('each sub-group carries the correct label from FUNCTIONAL_BLOCK_LABELS', () => {
    const groups: FamilyGroup[] = [
      makeGroup('+(1—2) к духу'),
    ];

    const result = classifyGroups(groups, 'affix-functional');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe(FUNCTIONAL_BLOCK_LABELS.spirit.label);
  });

  it('groups with same block are merged into one sub-group', () => {
    const groups: FamilyGroup[] = [
      makeGroup('+(5—7) к силе'),
      makeGroup('+(5—7) к ловкости'),
      makeGroup('+(5—7) к интеллекту'),
    ];

    const result = classifyGroups(groups, 'affix-functional');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('attributes');
    expect(result[0].groups).toHaveLength(3);
  });

  it('preserves group references (does not mutate or clone)', () => {
    const group1 = makeGroup('+(1—2) к духу');
    const group2 = makeGroup('+(5—7) к силе');

    const result = classifyGroups([group1, group2], 'affix-functional');

    const spiritGroup = result.find(sg => sg.key === 'spirit');
    const attrGroup = result.find(sg => sg.key === 'attributes');
    expect(spiritGroup?.groups[0]).toBe(group1);
    expect(attrGroup?.groups[0]).toBe(group2);
  });
});
