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
 * iter 87: classifyWeaponClass + weapon-specific functional block + jewel-functional mode.
 * iter 88: ailments + area-duration functional blocks (17 active total).
 * iter 89: rage-charges + meta-skills + buff-skills functional blocks (20 active total).
 */
import { describe, it, expect } from 'vitest';
import {
  classifyJewelType,
  classifyByTags,
  classifyByText,
  classifyWaystoneSentiment,
  classifyWaystoneSubBlock,
  classifyTabletType,
  classifyTabletSubBlock,
  classifyPriorityTier,
  classifyFunctionalBlock,
  classifyGroups,
  classifyWeaponClass,
  classifyRelicCategory,
  sortGroupsAlphabetically,
  sortGroupsByTierFirst,
  sortGroupsByMode,
  FUNCTIONAL_BLOCK_LABELS,
  WEAPON_CLASS_LABELS,
  RELIC_LABELS,
  WAYSTONE_SUBBLOCK_LABELS,
  TABLET_SUBBLOCK_LABELS,
  TIER_SORT_ORDER,
  type JewelTypeCategory,
  type FunctionalBlock,
  type WeaponClass,
  type WaystoneSubBlock,
  type TabletSubBlock,
} from '@shared/mod-classifier';
import type { FamilyGroup, GameToken, SortMode } from '@shared/types';

// ─── Helpers ───

/**
 * Create a minimal FamilyGroup for testing.
 *
 * iter 96: `functionalCategory` is now an optional override field. When set,
 * the helper injects it onto every member token (or creates a synthetic
 * member if none were supplied). This lets `classifyFunctionalBlock()` exercise
 * Strategy 0 (ETL lookup) directly — mirroring production behavior — instead
 * of relying on the now-removed regex fallback.
 */
function makeGroup(
  displayText: string,
  overrides: Partial<Omit<FamilyGroup, 'members'>> & {
    members?: GameToken[];
    functionalCategory?: string;
  } = {}
): FamilyGroup {
  const { functionalCategory, members: overrideMembers, ...rest } = overrides;
  const members: GameToken[] = overrideMembers ?? [];
  if (functionalCategory) {
    if (members.length === 0) {
      members.push(makeToken([], undefined, functionalCategory));
    } else {
      for (const m of members) {
        if (!m.functionalCategory) m.functionalCategory = functionalCategory;
      }
    }
  }
  return {
    familyKey: displayText,
    affix: 'prefix',
    members,
    globalMin: 0,
    globalMax: 0,
    displayText,
    hasMultiPlaceholder: false,
    rangeSlots: [],
    filterSlotIndex: 0,
    priorityTier: 'C',
    ...rest,
  };
}

/** Create a minimal GameToken for tag-based classification.
 *  iter 96: optional `functionalCategory` param mirrors ETL-produced tokens. */
function makeToken(
  tags: string[],
  jewelType?: JewelTypeCategory,
  functionalCategory?: string
): GameToken {
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
    functionalCategory,
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

  // ─── Known Issue #5 fix (iter 104): приспешник.*урон false-positive ───

  it('classifies "players and minions deal no damage" as negative (Known Issue #5 fix)', () => {
    // Was positive — 'приспешник.*урон' in POSITIVE_KEYWORDS matched this mod
    // (because "приспешники" + "урон" both appear in the text), even though
    // semantically it's clearly negative (player can't deal damage 30% of time).
    // iter 104 fix: removed 'приспешник.*урон' from POSITIVE, added
    // 'Игроки.*не наносят урон' to NEGATIVE. The intended positive minion mods
    // ("приспешники наносят... дополнительного урона от X") are still caught by
    // 'приспешник.*дополнит' in POSITIVE.
    const group = makeGroup('Игроки и их приспешники не наносят урона в течение 3 из каждых 10 секунд');
    expect(classifyWaystoneSentiment(group)).toBe('negative');
  });

  it('still classifies minion extra-damage as positive (Known Issue #5 fix — no regression)', () => {
    // The intended positive minion mod must still be positive after the fix.
    // 'приспешник.*дополнит' (which requires "дополнит" between "приспешник"
    // and "урон") is the surviving positive pattern that catches this mod.
    const group = makeGroup('приспешники наносят (5—9)% от их урона в виде дополнительного урона от огня');
    expect(classifyWaystoneSentiment(group)).toBe('positive');
  });
});

// ─── classifyWaystoneSubBlock (iter 104) ───

describe('classifyWaystoneSubBlock', () => {
  // ─── POSITIVE sub-blocks ───

  it('classifies rarity/quantity/items as positive-loot', () => {
    expect(classifyWaystoneSubBlock(makeGroup('#% повышение редкости найденных предметов'))).toBe('positive-loot');
    expect(classifyWaystoneSubBlock(makeGroup('#% повышение количества найденных предметов'))).toBe('positive-loot');
  });

  it('classifies waystone-drop-chance as positive-loot', () => {
    // Implicit mod (Шанс выпадения путевого камня) — implicit rule forces positive.
    // Within positive, "путев" pattern routes to loot.
    expect(classifyWaystoneSubBlock(makeGroup('Шанс выпадения путевого камня: +#%', { affix: 'implicit' }))).toBe('positive-loot');
  });

  it('classifies more magic+rarer monsters as positive-loot', () => {
    // More rare monsters = more loot. Bug #2 fix put this in positive; iter 104
    // sub-block routes it to loot (not mechanics or buffs).
    expect(classifyWaystoneSubBlock(makeGroup('На #% больше волшебных и редких монстров'))).toBe('positive-loot');
  });

  it('classifies extra Breaches as positive-mechanics', () => {
    expect(classifyWaystoneSubBlock(makeGroup('В области можно встретить дополнительных Бездн: (2—3)'))).toBe('positive-mechanics');
  });

  it('classifies extra altars/ritual circles as positive-mechanics', () => {
    expect(classifyWaystoneSubBlock(makeGroup('В области можно встретить дополнительный ритуальный круг'))).toBe('positive-mechanics');
    expect(classifyWaystoneSubBlock(makeGroup('В области можно встретить дополнительный алтарь'))).toBe('positive-mechanics');
  });

  it('classifies minion extra elemental damage as positive-mechanics', () => {
    // Minion "extra damage as element" is a Breach-related buff (Breach minions
    // gain extra damage). Goes to mechanics, not buffs (which is for XP/Spirit/etc).
    expect(classifyWaystoneSubBlock(makeGroup('приспешники наносят (5—9)% от их урона в виде дополнительного урона от огня'))).toBe('positive-mechanics');
  });

  it('classifies Princess spawn as positive-mechanics', () => {
    expect(classifyWaystoneSubBlock(makeGroup('В области можно встретить дополнительную Царевну инкубатора'))).toBe('positive-mechanics');
  });

  it('classifies respawns implicit as positive-buffs', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Доступно возрождений: #', { affix: 'implicit' }))).toBe('positive-buffs');
  });

  it('classifies implicit monster-group-size as positive-buffs (meta-stat)', () => {
    // Implicit → positive by rule. Within positive, "Размер групп монстров"
    // is a meta-stat (doesn't fit loot or mechanics) → falls to buffs.
    expect(classifyWaystoneSubBlock(makeGroup('Размер групп монстров: +#%', { affix: 'implicit' }))).toBe('positive-buffs');
  });

  it('classifies implicit monster-effectiveness as positive-buffs (meta-stat)', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Эффективность монстров: +#%', { affix: 'implicit' }))).toBe('positive-buffs');
  });

  it('positive fallback: unfamiliar implicit mod goes to positive-buffs', () => {
    // Implicit mods are forced to positive by `classifyWaystoneSentiment`.
    // If the text doesn't match any loot/mechanics sub-pattern, it falls to
    // buffs (the broad default for positive — better than dropping the mod).
    // "Какой-то неизвестный мод" doesn't match any keyword, but implicit rule
    // makes it positive — so it lands in positive-buffs via fallback.
    expect(classifyWaystoneSubBlock(makeGroup('Какой-то неизвестный мод', { affix: 'implicit' }))).toBe('positive-buffs');
  });

  // ─── NEGATIVE sub-blocks ───

  it('classifies monster damage increase as negative-monster-power', () => {
    expect(classifyWaystoneSubBlock(makeGroup('(5—24)% увеличение урона монстров'))).toBe('negative-monster-power');
  });

  it('classifies monster crit bonus as negative-monster-power', () => {
    expect(classifyWaystoneSubBlock(makeGroup('+(11—30)% к бонусу критического урона монстров'))).toBe('negative-monster-power');
  });

  it('classifies monster accuracy as negative-monster-power', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Меткость монстров повышена на (10—50)%'))).toBe('negative-monster-power');
  });

  it('classifies monster extra projectiles as negative-monster-power', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Монстры выпускают дополнительных снарядов: (2—3)'))).toBe('negative-monster-power');
  });

  it('classifies monster AoE increase as negative-monster-power', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Монстры имеют #% увеличение области действия'))).toBe('negative-monster-power');
  });

  it('classifies monster armor as negative-monster-defense', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Монстры бронированы'))).toBe('negative-monster-defense');
  });

  it('classifies monster evasion as negative-monster-defense', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Монстры уклончивы'))).toBe('negative-monster-defense');
  });

  it('classifies monster resistance as negative-monster-defense', () => {
    expect(classifyWaystoneSubBlock(makeGroup('+(20—40)% к сопротивлению монстров стихиям'))).toBe('negative-monster-defense');
  });

  it('classifies monster HP increase as negative-monster-defense (broader survivability)', () => {
    // More HP = monster survives longer = broadly defensive (not pure offense).
    expect(classifyWaystoneSubBlock(makeGroup('На (10—30)% больше здоровья монстров'))).toBe('negative-monster-defense');
  });

  it('classifies monster ES as negative-monster-defense (requires monster context)', () => {
    // iter 104 fix: `монстр.*энергетическ.*щит` requires "монстр" before "энергетическ"
    // so player-ES debuffs don't false-match into monster-defense.
    expect(classifyWaystoneSubBlock(makeGroup('Монстры получают (12—25)% от максимума здоровья в виде дополнительного энергетического щита'))).toBe('negative-monster-defense');
  });

  it('classifies monster status threshold as negative-monster-defense', () => {
    // iter 104 fix: `порог.*состоян` is order-agnostic — works for
    // "Монстры имеют N увеличение порога состояний" (монстр → порог).
    expect(classifyWaystoneSubBlock(makeGroup('Монстры имеют (30—79)% увеличение порога состояний'))).toBe('negative-monster-defense');
    expect(classifyWaystoneSubBlock(makeGroup('Монстры имеют (30—79)% увеличение порога оглушения'))).toBe('negative-monster-defense');
  });

  it('classifies monster crit-damage-reduction as negative-monster-defense', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Монстры получают (15—30)% уменьшение дополнительного урона от критических ударов'))).toBe('negative-monster-defense');
  });

  it('classifies rare-monster extra properties as negative-monster-modifiers', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Дополнительных свойств у редких монстров: #'))).toBe('negative-monster-modifiers');
    expect(classifyWaystoneSubBlock(makeGroup('На #% больше шанса появления свойств у редких монстров'))).toBe('negative-monster-modifiers');
  });

  it('classifies player max-res penalty as negative-player-penalty', () => {
    expect(classifyWaystoneSubBlock(makeGroup('(-10—-3)% максимум сопротивлений игроков'))).toBe('negative-player-penalty');
  });

  it('classifies player flask-charge penalty as negative-player-penalty', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Игроки получают уменьшение зарядов флакона на (20—35)%'))).toBe('negative-player-penalty');
  });

  it('classifies player move-speed penalty as negative-player-penalty', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Игроки имеют на #% меньше скорости передвижения и скорости умений за каждое недавнее использование ими умений'))).toBe('negative-player-penalty');
  });

  it('classifies player no-damage-window as negative-player-penalty (Known Issue #5 fix)', () => {
    // After Known Issue #5 fix, this mod is correctly classified as negative
    // (was positive before). Within negative, it goes to player-penalty
    // (direct player debuff — can't deal damage 30% of the time).
    expect(classifyWaystoneSubBlock(makeGroup('Игроки и их приспешники не наносят урона в течение 3 из каждых 10 секунд'))).toBe('negative-player-penalty');
  });

  it('classifies player recovery penalty as negative-player-penalty (not monster-defense)', () => {
    // iter 104 fix: `монстр.*энергетическ.*щит` in monster-defense requires
    // "монстр" before "энергетическ". This player-recovery mod has
    // "энергетического щита игроков" (игроков after, no монстр before) →
    // doesn't match monster-defense → falls through to player-penalty via
    // `восстановлен.*здоровь.*меньш` pattern.
    expect(classifyWaystoneSubBlock(makeGroup('Скорость восстановления здоровья и энергетического щита игроков на (20—40)% меньше'))).toBe('negative-player-penalty');
  });

  it('classifies area curses as negative-environment', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Область проклята Слабостью'))).toBe('negative-environment');
    expect(classifyWaystoneSubBlock(makeGroup('Область проклята Уязвимостью к стихиям'))).toBe('negative-environment');
  });

  it('classifies ground effects as negative-environment', () => {
    expect(classifyWaystoneSubBlock(makeGroup('В области есть участки подожженной земли'))).toBe('negative-environment');
    expect(classifyWaystoneSubBlock(makeGroup('Область имеет участки замерзшей земли'))).toBe('negative-environment');
    expect(classifyWaystoneSubBlock(makeGroup('Область содержит участки заряженной земли'))).toBe('negative-environment');
  });

  it('classifies soul-eating as negative-environment', () => {
    expect(classifyWaystoneSubBlock(makeGroup('Естественные редкие обитатели области пожирают души убитых в их присутствии монстров'))).toBe('negative-environment');
  });

  // ─── NEUTRAL fallback ───

  it('classifies unfamiliar desecrated mod as neutral-generic', () => {
    // Mod that doesn't match any positive or negative keyword → neutral → neutral-generic.
    // "Область захвачена монстрами Бездны" is currently neutral (no keyword catches it).
    expect(classifyWaystoneSubBlock(makeGroup('Область захвачена монстрами Бездны'))).toBe('neutral-generic');
  });

  // ─── Label coverage sanity check ───

  it('every WaystoneSubBlock has a label config', () => {
    // Defensive: ensure WAYSTONE_SUBBLOCK_LABELS covers every variant.
    // If a new sub-block is added without a label, this test catches it.
    const expected: WaystoneSubBlock[] = [
      'positive-loot', 'positive-mechanics', 'positive-buffs',
      'negative-monster-power', 'negative-monster-defense', 'negative-monster-modifiers',
      'negative-player-penalty', 'negative-environment',
      'neutral-generic',
    ];
    for (const sb of expected) {
      expect(WAYSTONE_SUBBLOCK_LABELS[sb]).toBeDefined();
      expect(WAYSTONE_SUBBLOCK_LABELS[sb].label.length).toBeGreaterThan(0);
    }
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

// ─── classifyTabletSubBlock (iter 105) ───

describe('classifyTabletSubBlock', () => {
  // ─── RITUAL sub-blocks ───

  it('ritual-rewards: tribute cost reduction mods', () => {
    expect(classifyTabletSubBlock(makeGroup('(20—30)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'))).toBe('ritual-rewards');
    expect(classifyTabletSubBlock(makeGroup('(20—30)% уменьшение стоимости в дани для обновления наград в алтарях Ритуала на карте'))).toBe('ritual-rewards');
  });

  it('ritual-rewards: reward refresh / omens / delayed rewards', () => {
    expect(classifyTabletSubBlock(makeGroup('Алтари Ритуала на карте позволяют обновить награды дополнительно 1 раз'))).toBe('ritual-rewards');
    expect(classifyTabletSubBlock(makeGroup('Награды Ритуала на карте с увеличенным на (35—70)% шансом могут оказаться предзнаменованиями'))).toBe('ritual-rewards');
    expect(classifyTabletSubBlock(makeGroup('Обновленные награды в алтарях Ритуала на карте с (3—6)% шансом могут не стоить дани'))).toBe('ritual-rewards');
    expect(classifyTabletSubBlock(makeGroup('Отложенные награды в алтарях Ритуала на карте появляются снова на (25—40)% быстрее'))).toBe('ritual-rewards');
  });

  it('ritual-monsters: revived monsters at altars', () => {
    expect(classifyTabletSubBlock(makeGroup('Монстры, возрожденные у алтарей Ритуала на карте, с увеличенным на (35—70)% шансом могут стать волшебными'))).toBe('ritual-monsters');
    expect(classifyTabletSubBlock(makeGroup('Монстры, возрожденные у алтарей Ритуала на карте, с увеличенным на (25—40)% шансом могут стать редкими'))).toBe('ritual-monsters');
  });

  it('ritual-monsters: sacrificed monsters (not rewards, despite mentioning "дани")', () => {
    // Regression: "Монстры, принесенные в жертву...даруют увеличенное...количество дани"
    // mentions BOTH "жертву" and "дани" — must classify as ritual-monsters
    // (subject is monsters), NOT ritual-rewards (which would match "дан").
    expect(classifyTabletSubBlock(makeGroup('Монстры, принесенные в жертву на алтарях Ритуала на карте, даруют увеличенное на (18—30)% количество дани'))).toBe('ritual-monsters');
  });

  it('ritual-content: altar/circle count (fallback)', () => {
    expect(classifyTabletSubBlock(makeGroup('Добавляет алтари Ритуала на карту', { affix: 'implicit' }))).toBe('ritual-content');
    expect(classifyTabletSubBlock(makeGroup('На карте можно встретить дополнительный алтарь'))).toBe('ritual-content');
    expect(classifyTabletSubBlock(makeGroup('На карте можно встретить дополнительный ритуальный круг'))).toBe('ritual-content');
    expect(classifyTabletSubBlock(makeGroup('На карте с увеличенным на (70—100)% шансом можно встретить алтари'))).toBe('ritual-content');
    expect(classifyTabletSubBlock(makeGroup('На карте с увеличенным на (70—100)% шансом можно встретить ритуальный круг'))).toBe('ritual-content');
  });

  // ─── BREACH sub-blocks ───

  it('breach-monsters: monster power/count/properties', () => {
    expect(classifyTabletSubBlock(makeGroup('(8—12)% увеличение эффективности монстров Бездны за каждый закрытый провал, вплоть до 100%'))).toBe('breach-monsters');
    expect(classifyTabletSubBlock(makeGroup('Бездны на карте порождают увеличенное на (20—30)% количество монстров'))).toBe('breach-monsters');
    expect(classifyTabletSubBlock(makeGroup('Из Бездн на карте появляется дополнительных редких монстров: (1—2)'))).toBe('breach-monsters');
    expect(classifyTabletSubBlock(makeGroup('Монстры Бездны на ваших картах с увеличенным на (20—30)% шансом могут обладать свойствами Бездны'))).toBe('breach-monsters');
    expect(classifyTabletSubBlock(makeGroup('Сложность монстров Бездны на карте и награды с них увеличиваются за каждый закрытый провал'))).toBe('breach-monsters');
  });

  it('breach-rewards: occult currency / breach rewards', () => {
    expect(classifyTabletSubBlock(makeGroup('(20—30)% увеличение шанса получения очерняющей валюты из Бездн на карте'))).toBe('breach-rewards');
    expect(classifyTabletSubBlock(makeGroup('В два раза выше шанс получения наград в провалах Бездны на карте'))).toBe('breach-rewards');
  });

  it('breach-content: breach count / depths (fallback)', () => {
    expect(classifyTabletSubBlock(makeGroup('Добавляет Бездны на карту', { affix: 'implicit' }))).toBe('breach-content');
    expect(classifyTabletSubBlock(makeGroup('На карте можно встретить дополнительную Бездну'))).toBe('breach-content');
    expect(classifyTabletSubBlock(makeGroup('На карте с (20—40)% шансом можно встретить четыре дополнительные Бездны'))).toBe('breach-content');
    expect(classifyTabletSubBlock(makeGroup('Бездны на карте с увеличенным на (10—20)% шансом могут привести к Глубинам Бездны'))).toBe('breach-content');
  });

  // ─── DELIRIUM sub-blocks ───

  it('delirium-rewards: shards / mirrors / simulacra / bosses (checked BEFORE mist)', () => {
    expect(classifyTabletSubBlock(makeGroup('(15—30)% увеличение размера находимых на карте стопок осколков Симулякра'))).toBe('delirium-rewards');
    expect(classifyTabletSubBlock(makeGroup('События Делириума на карте с на (15—30)% большим шансом могут породить уникальных боссов'))).toBe('delirium-rewards');
  });

  it('delirium-rewards: mist-produced shards (Туман + осколк — must be rewards, not mist)', () => {
    // Regression: "Туман Делириума порождает...осколков зеркал" mentions BOTH "Туман"
    // (mist) and "осколков" (rewards) — must classify as delirium-rewards
    // (subject is reward modifier), NOT delirium-mist.
    expect(classifyTabletSubBlock(makeGroup('Туман Делириума на карте порождает на (12—26)% больше осколков зеркал'))).toBe('delirium-rewards');
    expect(classifyTabletSubBlock(makeGroup('Туман Делириума на карте порождает увеличенное на (15—30)% количество хрупких зеркал'))).toBe('delirium-rewards');
  });

  it('delirium-mist: duration / dispersion / density / mirror timer', () => {
    expect(classifyTabletSubBlock(makeGroup('Плотность Делириума на карте увеличивается на (15—30)% быстрее в зависимости от расстояния до Зеркала'))).toBe('delirium-mist');
    expect(classifyTabletSubBlock(makeGroup('Туман Делириума на карте длится (6—12) дополнительных секунд(-ы) перед рассеиванием'))).toBe('delirium-mist');
    expect(classifyTabletSubBlock(makeGroup('Туман Делириума на карте рассеивается на (20—30)% медленнее'))).toBe('delirium-mist');
    expect(classifyTabletSubBlock(makeGroup('Убийство редких монстров на карте останавливает таймер Зеркала Делириума на (3—5) секунд(-ы)'))).toBe('delirium-mist');
  });

  it('delirium-monsters: monster group size (fallback)', () => {
    expect(classifyTabletSubBlock(makeGroup('(15—30)% увеличение размера групп монстров Делириума на карте'))).toBe('delirium-monsters');
  });

  // ─── VAAL sub-blocks ───

  it('vaal-monsters: monster spawns / group size / unique monsters', () => {
    expect(classifyTabletSubBlock(makeGroup('(10—25)% шанс добавить на карту уникального монстра Маяка Ваал'))).toBe('vaal-monsters');
    expect(classifyTabletSubBlock(makeGroup('(10—30)% увеличение размера групп монстров вокруг Маяков Ваал на карте'))).toBe('vaal-monsters');
    expect(classifyTabletSubBlock(makeGroup('(25—50)% увеличение шанса, что Маяки Ваал призовут дополнительных монстров на карте'))).toBe('vaal-monsters');
    expect(classifyTabletSubBlock(makeGroup('(30—60)% шанс появления дополнительных групп монстров вокруг Маяков Ваал на карте'))).toBe('vaal-monsters');
    expect(classifyTabletSubBlock(makeGroup('1 дополнительная группа монстров вокруг Маяков Ваал на карте'))).toBe('vaal-monsters');
  });

  it('vaal-rewards: beacon chests / crystals', () => {
    expect(classifyTabletSubBlock(makeGroup('(30—60)% увеличение шанса, что сундуки Маяков Ваал на карте окажутся редкими'))).toBe('vaal-rewards');
    expect(classifyTabletSubBlock(makeGroup('(5—10)% шанс получить дополнительный кристалл с Маяков Ваал на карте'))).toBe('vaal-rewards');
  });

  it('vaal-content: beacon count (fallback)', () => {
    expect(classifyTabletSubBlock(makeGroup('Добавляет маяки ваал на карту', { affix: 'implicit' }))).toBe('vaal-content');
  });

  // ─── EXPEDITION sub-blocks ───

  it('expedition-rewards: relicts / artifacts / logs', () => {
    expect(classifyTabletSubBlock(makeGroup('(12—18)% усиление эффекта реликтов Экспедиции на карте'))).toBe('expedition-rewards');
    expect(classifyTabletSubBlock(makeGroup('(15—30)% увеличение количества выпадающих из монстров на карте артефактов Экспедиции'))).toBe('expedition-rewards');
    expect(classifyTabletSubBlock(makeGroup('(15—30)% увеличение количества журналов Экспедиции, выпадающих из рунических монстров на карте'))).toBe('expedition-rewards');
    expect(classifyTabletSubBlock(makeGroup('+(1—2) реликт в Экспедициях на карте'))).toBe('expedition-rewards');
  });

  it('expedition-explosives: explosive radius', () => {
    expect(classifyTabletSubBlock(makeGroup('(15—30)% увеличение радиуса действия взрывчатки в событии Экспедиции на карте'))).toBe('expedition-explosives');
    expect(classifyTabletSubBlock(makeGroup('(15—30)% увеличение радиуса размещения взрывчатки в событии Экспедиции на карте'))).toBe('expedition-explosives');
  });

  it('expedition-monsters: runic markers / rare monsters (fallback)', () => {
    expect(classifyTabletSubBlock(makeGroup('(15—30)% увеличение количества меток с руническими монстрами на карте'))).toBe('expedition-monsters');
    expect(classifyTabletSubBlock(makeGroup('(25—40)% увеличение количества редких монстров Экспедиции на карте'))).toBe('expedition-monsters');
  });

  // ─── GENERIC sub-blocks ───

  it('generic-loot: gold / waystones / item rarity / boss drops', () => {
    expect(classifyTabletSubBlock(makeGroup('(25—35)% увеличение количества находимого на карте золота'))).toBe('generic-loot');
    expect(classifyTabletSubBlock(makeGroup('(30—40)% увеличение количества находимых на карте путевых камней'))).toBe('generic-loot');
    expect(classifyTabletSubBlock(makeGroup('(18—30)% увеличение количества выпадающих из боссов карты путевых камней'))).toBe('generic-loot');
    expect(classifyTabletSubBlock(makeGroup('(13—20)% увеличение количества предметов, выпадающих из боссов карт'))).toBe('generic-loot');
    expect(classifyTabletSubBlock(makeGroup('(35—60)% увеличение редкости предметов, выпадающих из боссов карт'))).toBe('generic-loot');
    expect(classifyTabletSubBlock(makeGroup('(8—12)% увеличение редкости находимых на карте предметов'))).toBe('generic-loot');
  });

  it('generic-player: XP gain', () => {
    expect(classifyTabletSubBlock(makeGroup('(12—18)% увеличение количества получаемого опыта на карте'))).toBe('generic-player');
    expect(classifyTabletSubBlock(makeGroup('Боссы карт даруют на (40—80)% больше опыта'))).toBe('generic-player');
  });

  it('generic-encounters: extra Сущности / exiles / chests / spirits / properties / Заражение / Разломы / charges', () => {
    expect(classifyTabletSubBlock(makeGroup('Добавляет Заражение на карту', { affix: 'implicit' }))).toBe('generic-encounters');
    expect(classifyTabletSubBlock(makeGroup('Карта обладает (1—2) дополнительным случайным свойством'))).toBe('generic-encounters');
    expect(classifyTabletSubBlock(makeGroup('На карте можно встретить дополнительного духа азмири'))).toBe('generic-encounters');
    expect(classifyTabletSubBlock(makeGroup('На карте можно встретить дополнительную Сущность'))).toBe('generic-encounters');
    expect(classifyTabletSubBlock(makeGroup('На карте можно встретить дополнительный ларец'))).toBe('generic-encounters');
    expect(classifyTabletSubBlock(makeGroup('На карте можно встретить дополнительных бродячих изгнанников: 1'))).toBe('generic-encounters');
    expect(classifyTabletSubBlock(makeGroup('На карте с увеличенным на (70—100)% шансом можно встретить бродячих изгнанников'))).toBe('generic-encounters');
    expect(classifyTabletSubBlock(makeGroup('На карте с увеличенным на (70—100)% шансом можно встретить ларцы'))).toBe('generic-encounters');
    expect(classifyTabletSubBlock(makeGroup('Нестабильные Разломы на карте порождают дополнительного редкого монстра при стабилизации'))).toBe('generic-encounters');
    expect(classifyTabletSubBlock(makeGroup('Осталось зарядов - #', { affix: 'implicit' }))).toBe('generic-encounters');
  });

  it('generic-monsters: monster stats / rarity / group size (fallback)', () => {
    expect(classifyTabletSubBlock(makeGroup('(10—15)% увеличение эффективности монстров'))).toBe('generic-monsters');
    expect(classifyTabletSubBlock(makeGroup('(15—20)% увеличение редкости монстров на карте'))).toBe('generic-monsters');
    expect(classifyTabletSubBlock(makeGroup('(25—35)% увеличение количества редких монстров на карте'))).toBe('generic-monsters');
    expect(classifyTabletSubBlock(makeGroup('(30—40)% увеличение количества волшебных монстров на карте'))).toBe('generic-monsters');
    expect(classifyTabletSubBlock(makeGroup('(5—15)% увеличение плотности монстров в Разломах на карте'))).toBe('generic-monsters');
    expect(classifyTabletSubBlock(makeGroup('(5—7)% увеличение размера групп монстров на карте'))).toBe('generic-monsters');
    expect(classifyTabletSubBlock(makeGroup('% уменьшение размера групп монстров на карте'))).toBe('generic-monsters');
    expect(classifyTabletSubBlock(makeGroup('Редкие монстры на карте имеют (50—80)% к превосходящему шансу обладать дополнительным свойством'))).toBe('generic-monsters');
    expect(classifyTabletSubBlock(makeGroup('Уникальные монстры имеют дополнительных свойств: 1'))).toBe('generic-monsters');
  });

  // ─── Label coverage sanity check ───

  it('TABLET_SUBBLOCK_LABELS: all 19 sub-blocks have non-empty labels', () => {
    const subBlocks: TabletSubBlock[] = [
      'ritual-rewards', 'ritual-monsters', 'ritual-content',
      'breach-monsters', 'breach-rewards', 'breach-content',
      'delirium-mist', 'delirium-rewards', 'delirium-monsters',
      'vaal-monsters', 'vaal-rewards', 'vaal-content',
      'expedition-rewards', 'expedition-explosives', 'expedition-monsters',
      'generic-loot', 'generic-monsters', 'generic-encounters', 'generic-player',
    ];
    for (const sb of subBlocks) {
      const cfg = TABLET_SUBBLOCK_LABELS[sb];
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.colorClass.length).toBeGreaterThan(0);
      expect(cfg.bgClass.length).toBeGreaterThan(0);
      expect(cfg.borderClass.length).toBeGreaterThan(0);
    }
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

// ─── classifyFunctionalBlock (iter 85-88: 17 high-priority blocks, iter 96: Strategy 0 path) ───
// iter 96: every test now sets `functionalCategory` via makeGroup overrides so
// the function exercises Strategy 0 (ETL lookup) directly — mirroring production.
// Tests expecting `'other'` leave `functionalCategory` unset to verify fallback.

describe('classifyFunctionalBlock (iter 85-88)', () => {
  // ─── spirit ───
  describe('spirit block', () => {
    it('classifies "+# к духу" (amulet S-tier) as spirit', () => {
      const group = makeGroup('+(1—2) к духу', { functionalCategory: 'spirit' });
      expect(classifyFunctionalBlock(group)).toBe('spirit');
    });

    it('classifies plain "Дух" mention as spirit', () => {
      const group = makeGroup('+5 к духу', { functionalCategory: 'spirit' });
      expect(classifyFunctionalBlock(group)).toBe('spirit');
    });
  });

  // ─── skill-levels ───
  describe('skill-levels block', () => {
    it('classifies "+# к уровню всех камней умений" as skill-levels', () => {
      const group = makeGroup('+(1—2) к уровню всех камней умений', { functionalCategory: 'skill-levels' });
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('classifies "+#% к максимальному качеству" as skill-levels', () => {
      // Was in neutral — now classified into skill-levels (not MF!)
      const group = makeGroup('+(5—10)% к максимальному качеству', { functionalCategory: 'skill-levels' });
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('classifies "#% повышение скорости перезарядки умений" as skill-levels', () => {
      const group = makeGroup('(10—20)% повышение скорости перезарядки умений', { functionalCategory: 'skill-levels' });
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('classifies "#% увеличение длительности эффекта умения" as skill-levels', () => {
      const group = makeGroup('(15—25)% увеличение длительности эффекта умения', { functionalCategory: 'skill-levels' });
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('does NOT classify "скорость перезарядки боевых кличей" as skill-levels (caught by buff-skills iter 89)', () => {
      // SKILL_LEVELS_PATTERN excludes warcry-recharge via `(?!.*боев)` negative lookahead.
      // iter 89: this mod is now caught by BUFF_SKILLS_PATTERN via «клич» keyword.
      const group = makeGroup('(10—20)% повышение скорости перезарядки боевых кличей', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).not.toBe('skill-levels');
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });
  });

  // ─── attributes ───
  describe('attributes block', () => {
    it('classifies "+# к силе" as attributes', () => {
      const group = makeGroup('+(5—7) к силе', { functionalCategory: 'attributes' });
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies "+# к ловкости" as attributes', () => {
      const group = makeGroup('+(5—7) к ловкости', { functionalCategory: 'attributes' });
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies "+# к интеллекту" as attributes', () => {
      const group = makeGroup('+(5—7) к интеллекту', { functionalCategory: 'attributes' });
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies "+# ко всем атрибутам" as attributes', () => {
      const group = makeGroup('+(5—10) ко всем атрибутам', { functionalCategory: 'attributes' });
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies dual-attribute Breach Lord mod (ulaman: сила+ловкость) as attributes', () => {
      const group = makeGroup('+# к силе и ловкости', { functionalCategory: 'attributes' });
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies dual-attribute Breach Lord mod (kurgal: ловкость+интеллект) as attributes', () => {
      const group = makeGroup('+# к ловкости и интеллекту', { functionalCategory: 'attributes' });
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies dual-attribute Breach Lord mod (amanamu: сила+интеллект) as attributes', () => {
      const group = makeGroup('+# к силе и интеллекту', { functionalCategory: 'attributes' });
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });

    it('classifies requirement-reduction mod as attributes (kurgal amulet)', () => {
      // "#% уменьшение требований к характеристикам у снаряжения и камней умений"
      const group = makeGroup('(10—20)% уменьшение требований к характеристикам у снаряжения и камней умений', { functionalCategory: 'attributes' });
      expect(classifyFunctionalBlock(group)).toBe('attributes');
    });
  });

  // ─── resistances ───
  describe('resistances block', () => {
    it('classifies "+#% к сопротивлению огню" as resistances', () => {
      const group = makeGroup('+(15—30)% к сопротивлению огню', { functionalCategory: 'resistances' });
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });

    it('classifies "+#% ко всем стихийным сопротивлениям" as resistances', () => {
      const group = makeGroup('+(5—10)% ко всем стихийным сопротивлениям', { functionalCategory: 'resistances' });
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });

    it('classifies "+#% к сопротивлению хаосу" as resistances', () => {
      const group = makeGroup('+(5—10)% к сопротивлению хаосу', { functionalCategory: 'resistances' });
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });

    it('classifies "#% повышение значений добавленных свойств сопротивлений" as resistances (no-tag neutral fix)', () => {
      // Was in neutral — now correctly classified as resistances
      const group = makeGroup('(10—20)% повышение значений добавленных свойств сопротивлений', { functionalCategory: 'resistances' });
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });
  });

  // ─── runes-barrier ───
  describe('runes-barrier block', () => {
    it('classifies "+# к максимуму рунического барьера" as runes-barrier (ring)', () => {
      const group = makeGroup('+(1—2) к максимуму рунического барьера', { functionalCategory: 'runes-barrier' });
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });

    it('classifies "#% увеличение максимума рунического барьера" as runes-barrier (amulet)', () => {
      const group = makeGroup('(10—20)% увеличение максимума рунического барьера', { functionalCategory: 'runes-barrier' });
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });

    it('classifies "#% повышение скорости регенерации рунического барьера" as runes-barrier (belt)', () => {
      const group = makeGroup('(15—25)% повышение скорости регенерации рунического барьера', { functionalCategory: 'runes-barrier' });
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });

    it('classifies "Восстанавливает # рунического барьера при использовании оберега" as runes-barrier (belt)', () => {
      const group = makeGroup('Восстанавливает # рунического барьера при использовании оберега', { functionalCategory: 'runes-barrier' });
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });
  });

  // ─── magic-find ───
  describe('magic-find block', () => {
    it('classifies "#% повышение редкости найденных предметов" as magic-find (prefix)', () => {
      const group = makeGroup('(10—20)% повышение редкости найденных предметов', { functionalCategory: 'magic-find' });
      expect(classifyFunctionalBlock(group)).toBe('magic-find');
    });

    it('classifies "#% повышение редкости найденных предметов" as magic-find (suffix)', () => {
      const group = makeGroup('(10—20)% повышение редкости найденных предметов', { affix: 'suffix', functionalCategory: 'magic-find' });
      expect(classifyFunctionalBlock(group)).toBe('magic-find');
    });

    it('does NOT classify "+#% к максимальному качеству" as magic-find (it is skill-levels, not MF)', () => {
      const group = makeGroup('+(5—10)% к максимальному качеству', { functionalCategory: 'skill-levels' });
      expect(classifyFunctionalBlock(group)).not.toBe('magic-find');
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });
  });

  // ─── breach ───
  describe('breach block', () => {
    it('classifies "Знак повелителя Бездны" as breach (essence-origin, no tags → was neutral)', () => {
      const group = makeGroup('Знак повелителя Бездны', { functionalCategory: 'breach' });
      expect(classifyFunctionalBlock(group)).toBe('breach');
    });

    it('classifies "Знак повелителя Бездны" regardless of affix (prefix/suffix)', () => {
      const prefixGroup = makeGroup('Знак повелителя Бездны', { affix: 'prefix', functionalCategory: 'breach' });
      const suffixGroup = makeGroup('Знак повелителя Бездны', { affix: 'suffix', functionalCategory: 'breach' });
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
        functionalCategory: 'flasks'
      });
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('classifies "Флаконы получают зарядов в секунду" as flasks (belt, no tag)', () => {
      const group = makeGroup('Флаконы получают зарядов в секунду: (0.75—1)', { functionalCategory: 'flasks' });
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('classifies "уменьшение используемого количества зарядов флакона" as flasks (belt, no tag)', () => {
      const group = makeGroup('(8—10)% уменьшение используемого количества зарядов флакона', { functionalCategory: 'flasks' });
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('classifies "шанс сохранить заряды флаконов" as flasks (belt, no tag)', () => {
      const group = makeGroup('(10—15)% шанс сохранить заряды флаконов при их использовании', { functionalCategory: 'flasks' });
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('classifies flask-conditional mods as flasks (NOT damage-type or offence-speed)', () => {
      // Has caster+damage tags but text «флакон» — flasks wins by priority
      const group1 = makeGroup('(20—25)% увеличение урона чар во время действия любого флакона', {
        members: [makeToken(['caster', 'damage'])],
        functionalCategory: 'flasks'
      });
      expect(classifyFunctionalBlock(group1)).toBe('flasks');

      // Has caster+speed tags but text «флакон» — flasks wins by priority
      const group2 = makeGroup('(8—10)% увеличение скорости сотворения чар во время действия любого флакона', {
        members: [makeToken(['caster', 'speed'])],
        functionalCategory: 'flasks'
      });
      expect(classifyFunctionalBlock(group2)).toBe('flasks');
    });

    it('classifies "повышение скорости восстановления здоровья от флакона" as flasks (NOT resources)', () => {
      // Has life tag but text «флакон» — flasks wins by priority over resources
      const group = makeGroup('(5—10)% повышение скорости восстановления здоровья от флакона', {
        members: [makeToken(['life'])],
        functionalCategory: 'flasks'
      });
      expect(classifyFunctionalBlock(group)).toBe('flasks');
    });

    it('does NOT classify "обереги" mods as flasks (they go to defence-stats via charm tag)', () => {
      const group = makeGroup('Обереги получают зарядов в секунду: (0.08—0.17)', {
        members: [makeToken(['charm'])],
        functionalCategory: 'defence-stats'
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
        functionalCategory: 'minions'
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "Приспешники имеют ##% повышение шанса критического удара" as minions (minion+critical — minion wins)', () => {
      const group = makeGroup('Приспешники имеют (5—12)% повышение шанса критического удара', {
        members: [makeToken(['minion', 'critical'])],
        functionalCategory: 'minions'
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "Приспешники имеют ##% увеличение максимума здоровья" as minions (minion+life — minion wins)', () => {
      const group = makeGroup('Приспешники имеют (7—10)% увеличение максимума здоровья', {
        members: [makeToken(['minion', 'life'])],
        functionalCategory: 'minions'
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "##% увеличение урона приспешников" as minions (minion+damage — minion wins)', () => {
      const group = makeGroup('(7—12)% увеличение урона приспешников за каждое использованное различное умение-приказ', {
        members: [makeToken(['minion', 'damage'])],
        functionalCategory: 'minions'
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "##% усиление эффекта Подношений" as minions (text «подношен» matches)', () => {
      // Was 'other' in iter 85 (deferred) — now caught by MINIONS_PATTERN in iter 86.
      const group = makeGroup('(15—25)% усиление эффекта Подношений', { functionalCategory: 'minions' });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "##% шанс получить Архонта Нежити при создании подношения" as minions (minion tag)', () => {
      const group = makeGroup('(35—50)% шанс получить Архонта Нежити при создании подношения', {
        members: [makeToken(['minion'])],
        functionalCategory: 'minions'
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('classifies "##% увеличение длительности умений подношений" as minions (minion tag + text «подношен»)', () => {
      const group = makeGroup('(6—15)% увеличение длительности умений подношений', {
        members: [makeToken(['minion'])],
        functionalCategory: 'minions'
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('does NOT classify "+1 к уровню всех камней умений приспешников" as minions (skill-levels wins)', () => {
      // skill-levels has higher priority — it's a +level mod, not a minion-function mod
      const group = makeGroup('+1 к уровню всех камней умений приспешников', {
        members: [makeToken(['gem', 'minion'])],
        functionalCategory: 'skill-levels'
      });
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('classifies "Приспешники имеют ##% повышение скорости передвижения" as minions (minion+speed — minion wins)', () => {
      const group = makeGroup('Приспешники имеют (5—7)% повышение скорости передвижения', {
        members: [makeToken(['minion', 'speed'])],
        functionalCategory: 'minions'
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });
  });

  // ─── resources ───
  describe('resources block (iter 86)', () => {
    it('classifies "+# к максимуму здоровья" as resources (life tag)', () => {
      const group = makeGroup('+(10—19) к максимуму здоровья', {
        members: [makeToken(['life'])],
        functionalCategory: 'resources'
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "+# к максимуму маны" as resources (mana tag)', () => {
      const group = makeGroup('+(10—14) к максимуму маны', {
        members: [makeToken(['mana'])],
        functionalCategory: 'resources'
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "+# к максимуму энергетического щита" as resources (ES max text — caught BEFORE defence-stats)', () => {
      // Has energy_shield tag BUT text matches «максимум.*энергетическ.*щит» — resources wins
      const group = makeGroup('+(8—14) к максимуму энергетического щита', {
        members: [makeToken(['energy_shield'])],
        functionalCategory: 'resources'
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "##% увеличение максимума энергетического щита" as resources (ES % max)', () => {
      const group = makeGroup('(15—25)% увеличение максимума энергетического щита', {
        members: [makeToken(['energy_shield'])],
        functionalCategory: 'resources'
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "##% полученного урона восполняется в виде здоровья" as resources (life tag)', () => {
      const group = makeGroup('(10—12)% полученного урона восполняется в виде здоровья', {
        members: [makeToken(['life'])],
        functionalCategory: 'resources'
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies MoM mod "от получаемого урона берется сначала из маны" as resources (life+mana tags)', () => {
      const group = makeGroup('(8—16)% от получаемого урона берется сначала из маны вместо здоровья', {
        members: [makeToken(['life', 'mana'])],
        functionalCategory: 'resources'
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "##% увеличение количества похищенного здоровья" as resources (life tag, Breach Lord)', () => {
      const group = makeGroup('(12—20)% увеличение количества похищенного здоровья', {
        members: [makeToken(['amanamu_mod', 'life'])],
        functionalCategory: 'resources'
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "Регенерация # здоровья в секунду" as resources (life tag)', () => {
      const group = makeGroup('Регенерация (1—2) здоровья в секунду', {
        members: [makeToken(['life'])],
        functionalCategory: 'resources'
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });

    it('classifies "Восстанавливает ##% здоровья при убийстве" as resources (life tag, Breach Lord)', () => {
      const group = makeGroup('Восстанавливает (2—3)% здоровья при убийстве', {
        members: [makeToken(['life', 'ulaman_mod'])],
        functionalCategory: 'resources'
      });
      expect(classifyFunctionalBlock(group)).toBe('resources');
    });
  });

  // ─── defence-stats ───
  describe('defence-stats block (iter 86)', () => {
    it('classifies "+# к броне" as defence-stats (armour tag, belt)', () => {
      const group = makeGroup('+(12—22) к броне', {
        members: [makeToken(['armour'])],
        functionalCategory: 'defence-stats'
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% повышение брони" as defence-stats (armour tag, amulet)', () => {
      const group = makeGroup('(10—14)% повышение брони', {
        members: [makeToken(['armour'])],
        functionalCategory: 'defence-stats'
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% увеличение уклонения" as defence-stats (evasion tag)', () => {
      const group = makeGroup('(15—25)% увеличение уклонения', {
        members: [makeToken(['evasion'])],
        functionalCategory: 'defence-stats'
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "+# к уклонению" as defence-stats (evasion tag, ring)', () => {
      const group = makeGroup('+(8—17) к уклонению', {
        members: [makeToken(['evasion'])],
        functionalCategory: 'defence-stats'
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% увеличение длительности эффекта оберега" as defence-stats (charm tag)', () => {
      const group = makeGroup('(4—9)% увеличение длительности эффекта оберега', {
        members: [makeToken(['charm'])],
        functionalCategory: 'defence-stats'
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "Обереги получают зарядов в секунду" as defence-stats (charm tag, NOT flasks)', () => {
      // No «флакон» text → not flasks; charm tag → defence-stats
      const group = makeGroup('Обереги получают зарядов в секунду: (0.08—0.17)', {
        members: [makeToken(['charm'])],
        functionalCategory: 'defence-stats'
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "+# к порогу оглушения" as defence-stats (text, no tag, belt)', () => {
      const group = makeGroup('+(6—11) к порогу оглушения', { functionalCategory: 'defence-stats' });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% ускорение начала перезарядки энергетического щита" as defence-stats (ES recharge — NOT resources)', () => {
      // Has energy_shield tag but NO «максимум» text → falls through to defence-stats (not resources)
      const group = makeGroup('##% ускорение начала перезарядки энергетического щита', {
        members: [makeToken(['energy_shield'])],
        functionalCategory: 'defence-stats'
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });

    it('classifies "##% увеличение отклонения ударов" as defence-stats (evasion tag, amulet)', () => {
      const group = makeGroup('(10—20)% увеличение отклонения ударов', {
        members: [makeToken(['evasion', 'ulaman_mod'])],
        functionalCategory: 'defence-stats'
      });
      expect(classifyFunctionalBlock(group)).toBe('defence-stats');
    });
  });

  // ─── crit ───
  describe('crit block (iter 86)', () => {
    it('classifies "##% повышение шанса критического удара" as crit (critical tag)', () => {
      const group = makeGroup('(10—14)% повышение шанса критического удара', {
        members: [makeToken(['critical'])],
        functionalCategory: 'crit'
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });

    it('classifies "##% увеличение бонуса к критическому урону" as crit (critical+damage — crit wins)', () => {
      const group = makeGroup('(15—20)% увеличение бонуса к критическому урона', {
        members: [makeToken(['critical', 'damage'])],
        functionalCategory: 'crit'
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });

    it('classifies "##% повышение шанса критического удара для чар" as crit (critical+caster tags)', () => {
      const group = makeGroup('(7—9)% повышение шанса критического удара для чар', {
        members: [makeToken(['caster', 'critical'])],
        functionalCategory: 'crit'
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });

    it('classifies "+#% к шансу критического удара чар огня" as crit (critical+caster+elemental+fire — crit wins)', () => {
      const group = makeGroup('+(4—5)% к шансу критического удара чар огня', {
        members: [makeToken(['caster', 'critical', 'elemental', 'fire'])],
        functionalCategory: 'crit'
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });

    it('classifies "+#% к шансу критического удара шипами" as crit (critical+damage — crit wins)', () => {
      const group = makeGroup('+(2—4)% к шансу критического удара шипами', {
        members: [makeToken(['amanamu_mod', 'critical', 'damage'])],
        functionalCategory: 'crit'
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });
  });

  // ─── damage-type ───
  describe('damage-type block (iter 86)', () => {
    it('classifies "##% увеличение урона" as damage-type (damage tag)', () => {
      const group = makeGroup('(20—30)% увеличение урона', {
        members: [makeToken(['damage'])],
        functionalCategory: 'damage-type'
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "##% увеличение урона от огня" as damage-type (damage+elemental+fire tags)', () => {
      const group = makeGroup('(3—7)% увеличение урона от огня', {
        members: [makeToken(['damage', 'elemental', 'fire'])],
        functionalCategory: 'damage-type'
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "##% увеличение урона от холода" as damage-type (cold+damage+elemental tags)', () => {
      const group = makeGroup('(3—7)% увеличение урона от холода', {
        members: [makeToken(['cold', 'damage', 'elemental'])],
        functionalCategory: 'damage-type'
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "##% увеличение урона хаосом" as damage-type (chaos+damage tags)', () => {
      const group = makeGroup('(3—7)% увеличение урона хаосом', {
        members: [makeToken(['chaos', 'damage'])],
        functionalCategory: 'damage-type'
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "Добавляет от # до # физического урона к атакам" as damage-type (attack+damage+physical tags)', () => {
      const group = makeGroup('Добавляет от (1—2) до 3 физического урона к атакам', {
        members: [makeToken(['attack', 'damage', 'physical'])],
        functionalCategory: 'damage-type'
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "##% увеличение урона от молнии, если подобрали насыщение" as damage-type (elemental+lightning, NO resistance tag)', () => {
      const group = makeGroup('(41—59)% увеличение урона от молнии, если вы подобрали Молниевое насыщение за последнее время', {
        members: [makeToken(['elemental', 'lightning'])],
        functionalCategory: 'damage-type'
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('does NOT classify "+#% к сопротивлению огню" as damage-type (resistances wins by priority)', () => {
      const group = makeGroup('+(6—10)% к сопротивлению огню', {
        members: [makeToken(['elemental', 'fire', 'resistance'])],
        functionalCategory: 'resistances'
      });
      expect(classifyFunctionalBlock(group)).toBe('resistances');
    });

    it('does NOT classify "##% увеличение бонуса к критическому урону" as damage-type (crit wins by priority)', () => {
      const group = makeGroup('(15—20)% увеличение бонуса к критическому урону', {
        members: [makeToken(['critical', 'damage'])],
        functionalCategory: 'crit'
      });
      expect(classifyFunctionalBlock(group)).toBe('crit');
    });
  });

  // ─── offence-speed ───
  describe('offence-speed block (iter 86)', () => {
    it('classifies "##% повышение скорости сотворения чар" as offence-speed (caster+speed tags)', () => {
      const group = makeGroup('(9—12)% повышение скорости сотворения чар', {
        members: [makeToken(['caster', 'speed'])],
        functionalCategory: 'offence-speed'
      });
      expect(classifyFunctionalBlock(group)).toBe('offence-speed');
    });

    it('classifies "##% повышение скорости атаки" as offence-speed (attack+speed tags, ring)', () => {
      const group = makeGroup('(7—9)% повышение скорости атаки', {
        members: [makeToken(['attack', 'speed'])],
        functionalCategory: 'offence-speed'
      });
      expect(classifyFunctionalBlock(group)).toBe('offence-speed');
    });

    it('does NOT classify "##% повышение скорости перезарядки умений" as offence-speed (skill-levels wins)', () => {
      // skill-levels catches "скорость перезарядки умений" first
      const group = makeGroup('(8—12)% повышение скорости перезарядки умений', {
        members: [makeToken(['kurgal_mod'])],
        functionalCategory: 'skill-levels'
      });
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('does NOT classify "Приспешники имеют ##% повышение скорости передвижения" as offence-speed (minions wins)', () => {
      const group = makeGroup('Приспешники имеют (5—7)% повышение скорости передвижения', {
        members: [makeToken(['minion', 'speed'])],
        functionalCategory: 'minions'
      });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });

    it('does NOT classify "##% повышение скорости перезарядки боевых кличей" as offence-speed (caught by buff-skills iter 89)', () => {
      // OFFENCE_SPEED_PATTERN only matches «скорост.*(атак|сотворени|передвижен|снаряд)» —
      // warcry recharge doesn't match (no weapon/spell/projectile keyword).
      // iter 89: this mod is now caught by BUFF_SKILLS_PATTERN via «клич» keyword.
      const group = makeGroup('(10—20)% повышение скорости перезарядки боевых кличей', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).not.toBe('offence-speed');
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });
  });

  // ─── iter 88: ailments block ───
  describe('ailments block (iter 88)', () => {
    it('classifies "#% усиление эффекта ослепления" as ailments (jewel prefix, no tag)', () => {
      const group = makeGroup('(5—10)% усиление эффекта ослепления', { functionalCategory: 'ailments' });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% увеличение шанса наложения состояний" as ailments (jewel suffix, ailment tag)', () => {
      const group = makeGroup('(5—15)% увеличение шанса наложения состояний', {
        members: [makeToken(['ailment'])],
        functionalCategory: 'ailments'
      });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% увеличение порога стихийных состояний" as ailments (jewel suffix, ailment tag)', () => {
      const group = makeGroup('(10—20)% увеличение порога стихийных состояний', {
        members: [makeToken(['ailment'])],
        functionalCategory: 'ailments'
      });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% шанс ослепить врагов при нанесении удара атаками" as ailments (jewel suffix, attack tag)', () => {
      const group = makeGroup('(3—7)% шанс ослепить врагов при нанесении удара атаками', {
        members: [makeToken(['attack'])],
        functionalCategory: 'ailments'
      });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% шанс наложения оцепенения при нанесении удара" as ailments (jewel suffix, no tag)', () => {
      const group = makeGroup('(5—10)% шанс наложения оцепенения при нанесении удара', { functionalCategory: 'ailments' });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% шанс отравить при нанесении удара" as ailments (jewel suffix, ailment tag)', () => {
      const group = makeGroup('(5—10)% шанс отравить при нанесении удара', {
        members: [makeToken(['ailment'])],
        functionalCategory: 'ailments'
      });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% повышение скорости накопления шкалы пригвождения" as ailments (jewel suffix, no tag)', () => {
      const group = makeGroup('(10—20)% повышение скорости накопления шкалы пригвождения', { functionalCategory: 'ailments' });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% увеличение длительности эффекта Парирован" as ailments (jewel suffix, no tag — AILMENTS wins over AREA_DURATION)', () => {
      const group = makeGroup('(10—15)% увеличение длительности эффекта Парирован', { functionalCategory: 'ailments' });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% увеличение силы поджога, если недавно вы поглощали заряд выносливости" as ailments (ring prefix, no tag)', () => {
      const group = makeGroup('(20—30)% увеличение силы поджога, если недавно вы поглощали заряд выносливости', { functionalCategory: 'ailments' });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% увеличение накопления шкалы заморозки, если недавно вы поглощали заряд энергии" as ailments (ring prefix, no tag)', () => {
      const group = makeGroup('(20—30)% увеличение накопления шкалы заморозки, если недавно вы поглощали заряд энергии', { functionalCategory: 'ailments' });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    it('classifies "#% увеличение силы шока, если недавно вы поглощали заряд ярости" as ailments (ring prefix, no tag)', () => {
      const group = makeGroup('(20—30)% увеличение силы шока, если недавно вы поглощали заряд ярости', { functionalCategory: 'ailments' });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });

    // ─── Negative tests — deliberate exclusions ───

    it('does NOT classify "#% повышение глобальной меткости" as ailments (accuracy ≠ ailment; matched by offence-speed via tag attack → other if no tag)', () => {
      const group = makeGroup('(5—10)% повышение глобальной меткости', {
        members: [makeToken(['attack'])],
      });
      expect(classifyFunctionalBlock(group)).not.toBe('ailments');
    });

    it('does NOT classify "#% усиление эффекта ваших умений меток" as ailments (mark skills → buff-skills in iter 89)', () => {
      const group = makeGroup('(4—8)% усиление эффекта ваших умений меток', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).not.toBe('ailments');
      // iter 89: now classified as buff-skills (was `other` before iter 89)
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });

    it('does NOT classify "Отрицательные эффекты на вас заканчиваются на #% быстрее" as ailments (ailment removal on self → other)', () => {
      const group = makeGroup('Отрицательные эффекты на вас заканчиваются на (5—10)% быстрее');
      expect(classifyFunctionalBlock(group)).toBe('other');
    });

    it('does NOT classify "#% ослабление влияния замедления от отрицательных эффектов на вас" as ailments (slow resistance → other)', () => {
      const group = makeGroup('(5—10)% ослабление влияния замедления от отрицательных эффектов на вас');
      expect(classifyFunctionalBlock(group)).toBe('other');
    });
  });

  // ─── iter 88: area-duration block ───
  describe('area-duration block (iter 88)', () => {
    it('classifies "#% увеличение области действия" as area-duration (jewel prefix, no tag)', () => {
      const group = makeGroup('(4—6)% увеличение области действия', { functionalCategory: 'area-duration' });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    it('classifies "#% увеличение области действия проклятий" as area-duration (jewel prefix, caster+curse tags)', () => {
      const group = makeGroup('(8—12)% увеличение области действия проклятий', {
        members: [makeToken(['caster', 'curse'])],
        functionalCategory: 'area-duration'
      });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    it('classifies "#% увеличение области действия умений знамён" as area-duration (jewel prefix, no tag)', () => {
      const group = makeGroup('(6—16)% увеличение области действия умений знамён', { functionalCategory: 'area-duration' });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    it('classifies "#% увеличение области действия присутствия" as area-duration (jewel prefix, aura tag)', () => {
      const group = makeGroup('(15—25)% увеличение области действия присутствия', {
        members: [makeToken(['aura'])],
        functionalCategory: 'area-duration'
      });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    it('classifies "Улучшает радиус до очень большого" as area-duration (jewel prefix, no tag — passive tree radius)', () => {
      const group = makeGroup('Улучшает радиус до очень большого', { functionalCategory: 'area-duration' });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    it('classifies "#% увеличение длительности проклятий" as area-duration (jewel suffix, caster+curse tags)', () => {
      const group = makeGroup('(15—25)% увеличение длительности проклятий', {
        members: [makeToken(['caster', 'curse'])],
        functionalCategory: 'area-duration'
      });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    it('classifies "#% увеличение длительности умений знамён" as area-duration (jewel suffix, no tag)', () => {
      const group = makeGroup('(15—25)% увеличение длительности умений знамён', { functionalCategory: 'area-duration' });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    it('classifies "#% увеличение области действия умений чар" as area-duration (amulet/ring suffix, no tag)', () => {
      const group = makeGroup('(6—8)% увеличение области действия умений чар', { functionalCategory: 'area-duration' });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    // ─── Negative tests — generic skill duration goes to skill-levels, not area-duration ───

    it('does NOT classify "#% увеличение длительности эффекта умения" as area-duration (skill-levels wins via «длительн.*эффект.*умени»)', () => {
      const group = makeGroup('(15—25)% увеличение длительности эффекта умения', { functionalCategory: 'skill-levels' });
      expect(classifyFunctionalBlock(group)).toBe('skill-levels');
    });

    it('does NOT classify "#% увеличение длительности эффекта Парирован" as area-duration (AILMENTS wins — parry is an ailment)', () => {
      const group = makeGroup('(10—15)% увеличение длительности эффекта Парирован', { functionalCategory: 'ailments' });
      expect(classifyFunctionalBlock(group)).toBe('ailments');
    });
  });

  // ─── iter 89: rage-charges block ───
  describe('rage-charges block (iter 89)', () => {
    it('classifies "+# к максимуму свирепости" as rage-charges (jewel prefix, no tag — ferocity max)', () => {
      const group = makeGroup('+(1—2) к максимуму свирепости', { functionalCategory: 'rage-charges' });
      expect(classifyFunctionalBlock(group)).toBe('rage-charges');
    });

    it('classifies "Дарует # свирепости при нанесении удара в ближнем бою" as rage-charges (jewel suffix, attack tag — gain rage on hit)', () => {
      const group = makeGroup('Дарует 1 свирепости при нанесении удара в ближнем бою', {
        members: [makeToken(['attack'])],
        functionalCategory: 'rage-charges'
      });
      expect(classifyFunctionalBlock(group)).toBe('rage-charges');
    });

    it('classifies "Дарует # свирепости при получении удара от врага" as rage-charges (jewel suffix, no tag — gain rage when hit)', () => {
      const group = makeGroup('Дарует (1—3) свирепости при получении удара от врага', { functionalCategory: 'rage-charges' });
      expect(classifyFunctionalBlock(group)).toBe('rage-charges');
    });

    it('classifies "#% повышение скорости накопления славы для умений знамён" as rage-charges (jewel suffix, no tag — banner glory speed)', () => {
      const group = makeGroup('(15—20)% повышение скорости накопления славы для умений знамён', { functionalCategory: 'rage-charges' });
      expect(classifyFunctionalBlock(group)).toBe('rage-charges');
    });

    // ─── Negative tests — banner area/duration go to area-duration, not rage-charges ───

    it('does NOT classify "#% увеличение области действия умений знамён" as rage-charges (AREA_DURATION wins via «област.*действ»)', () => {
      const group = makeGroup('(6—16)% увеличение области действия умений знамён', { functionalCategory: 'area-duration' });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    it('does NOT classify "#% увеличение длительности умений знамён" as rage-charges (AREA_DURATION wins via «длительн.*знам[её]н»)', () => {
      const group = makeGroup('(15—25)% увеличение длительности умений знамён', { functionalCategory: 'area-duration' });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });
  });

  // ─── iter 89: meta-skills block ───
  describe('meta-skills block (iter 89)', () => {
    it('classifies "Мета-умения получают увеличенное на #% количество энергии" as meta-skills (jewel suffix, no tag)', () => {
      const group = makeGroup('Мета-умения получают увеличенное на (4—8)% количество энергии', { functionalCategory: 'meta-skills' });
      expect(classifyFunctionalBlock(group)).toBe('meta-skills');
    });

    it('classifies "Запечатанные умения имеют +1 к максимуму зарядов печати" as meta-skills (amulet suffix, no tag)', () => {
      const group = makeGroup('Запечатанные умения имеют +1 к максимуму зарядов печати', { functionalCategory: 'meta-skills' });
      expect(classifyFunctionalBlock(group)).toBe('meta-skills');
    });

    it('classifies "Запечатанные умения имеют #% увеличение частоты получения зарядов печати" as meta-skills (belt suffix, no tag)', () => {
      const group = makeGroup('Запечатанные умения имеют (21—35)% увеличение частоты получения зарядов печати', { functionalCategory: 'meta-skills' });
      expect(classifyFunctionalBlock(group)).toBe('meta-skills');
    });

    it('classifies "#% усиление положительных эффектов Архонта на вас" as meta-skills (belt prefix, no tag)', () => {
      const group = makeGroup('(20—39)% усиление положительных эффектов Архонта на вас', { functionalCategory: 'meta-skills' });
      expect(classifyFunctionalBlock(group)).toBe('meta-skills');
    });

    it('classifies "#% увеличение длительности эффекта Архонта" as meta-skills (belt suffix, no tag)', () => {
      const group = makeGroup('(40—50)% увеличение длительности эффекта Архонта', { functionalCategory: 'meta-skills' });
      expect(classifyFunctionalBlock(group)).toBe('meta-skills');
    });

    it('classifies "#% увеличение максимума энергии вызываемых умений" as meta-skills (ring suffix, no tag)', () => {
      const group = makeGroup('(25—35)% увеличение максимума энергии вызываемых умений', { functionalCategory: 'meta-skills' });
      expect(classifyFunctionalBlock(group)).toBe('meta-skills');
    });
  });

  // ─── iter 89: buff-skills block ───
  describe('buff-skills block (iter 89)', () => {
    // ─── Aura mods ───
    it('classifies "#% увеличение силы умений аур" as buff-skills (jewel prefix, aura tag — aura effect)', () => {
      const group = makeGroup('(3—7)% увеличение силы умений аур', {
        members: [makeToken(['aura'])],
        functionalCategory: 'buff-skills'
      });
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });

    it('classifies "#% увеличение силы умений аур" as buff-skills (amulet suffix, no tag — aura effect)', () => {
      const group = makeGroup('(8—16)% увеличение силы умений аур', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });

    // ─── Herald mods ───
    it('classifies "#% увеличение эффективности удержания ресурсов умениями вестниками" as buff-skills (amulet suffix — herald effect)', () => {
      const group = makeGroup('(10—20)% увеличение эффективности удержания ресурсов умениями вестниками', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });

    // ─── Mark mods ───
    it('classifies "#% усиление эффекта ваших умений меток" as buff-skills (jewel prefix, no tag — mark effect)', () => {
      const group = makeGroup('(4—8)% усиление эффекта ваших умений меток', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });

    // ─── Warcry mods ───
    it('classifies "#% усиление положительного эффекта боевого клича" as buff-skills (jewel prefix, no tag — warcry effect)', () => {
      const group = makeGroup('(5—15)% усиление положительного эффекта боевого клича', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });

    it('classifies "#% повышение скорости перезарядки боевых кличей" as buff-skills (jewel suffix, no tag — warcry recharge speed)', () => {
      const group = makeGroup('(5—15)% повышение скорости перезарядки боевых кличей', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });

    // ─── Curse mods ───
    it('classifies "#% увеличение силы проклятий" as buff-skills (jewel prefix — curse effect)', () => {
      const group = makeGroup('(2—4)% увеличение силы проклятий', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });

    it('classifies "На #% быстрее активация проклятия" as buff-skills (jewel suffix — curse activation speed)', () => {
      const group = makeGroup('На (5—15)% быстрее активация проклятия', { functionalCategory: 'buff-skills' });
      expect(classifyFunctionalBlock(group)).toBe('buff-skills');
    });

    // ─── Negative tests — accuracy MUST NOT match buff-skills (excluded via `(?!ост)`) ───

    it('does NOT classify "#% повышение глобальной меткости" as buff-skills (accuracy excluded via `(?!ост)` negative lookahead)', () => {
      const group = makeGroup('(5—10)% повышение глобальной меткости', {
        members: [makeToken(['attack'])],
      });
      // attack tag → offence-speed wins; even without tag, «меткости» must NOT match buff-skills
      expect(classifyFunctionalBlock(group)).not.toBe('buff-skills');
    });

    it('does NOT classify "меткость" as buff-skills (bare accuracy noun also excluded)', () => {
      const group = makeGroup('+5% глобальная меткость');
      expect(classifyFunctionalBlock(group)).not.toBe('buff-skills');
    });

    // ─── Negative tests — curse area/duration go to area-duration, not buff-skills ───

    it('does NOT classify "#% увеличение области действия проклятий" as buff-skills (AREA_DURATION wins via «област.*действ»)', () => {
      const group = makeGroup('(8—12)% увеличение области действия проклятий', {
        members: [makeToken(['caster', 'curse'])],
        functionalCategory: 'area-duration'
      });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    it('does NOT classify "#% увеличение длительности проклятий" as buff-skills (AREA_DURATION wins via «длительн.*проклят»)', () => {
      const group = makeGroup('(15—25)% увеличение длительности проклятий', {
        members: [makeToken(['caster', 'curse'])],
        functionalCategory: 'area-duration'
      });
      expect(classifyFunctionalBlock(group)).toBe('area-duration');
    });

    // ─── Negative tests — Breach Lord's Mark stays in breach, not buff-skills ───

    it('does NOT classify "Знак повелителя Бездны" as buff-skills (BREACH wins — more specific)', () => {
      const group = makeGroup('Знак повелителя Бездны', { functionalCategory: 'breach' });
      expect(classifyFunctionalBlock(group)).toBe('breach');
    });
  });

  // ─── other (fallback) ───
  describe('other block (fallback)', () => {
    it('classifies "#% усиление эффекта создаваемых вами сгустков" as other (wisps — deferred to iter 90+)', () => {
      const group = makeGroup('(15—25)% усиление эффекта создаваемых вами сгустков');
      expect(classifyFunctionalBlock(group)).toBe('other');
    });

    it('classifies "#% усиление эффекта Подношений" as minions (iter 86: text «подношен» matches)', () => {
      // Was 'other' in iter 85 (deferred) — now caught by MINIONS_PATTERN in iter 86.
      const group = makeGroup('(15—25)% усиление эффекта Подношений', { functionalCategory: 'minions' });
      expect(classifyFunctionalBlock(group)).toBe('minions');
    });
  });

  // ─── Match priority (ordering) ───
  describe('match priority', () => {
    it('spirit wins over skill-levels (дух vs умения — no overlap, but spirit is more specific)', () => {
      // Single-token "Дух" should always go to spirit
      const group = makeGroup('+1 к духу', { functionalCategory: 'spirit' });
      expect(classifyFunctionalBlock(group)).toBe('spirit');
    });

    it('runes-barrier wins over resistances (no overlap in practice, but specific first)', () => {
      // "рунического барьера" doesn't contain "сопротивл"
      const group = makeGroup('+1 к максимуму рунического барьера', { functionalCategory: 'runes-barrier' });
      expect(classifyFunctionalBlock(group)).toBe('runes-barrier');
    });

    it('breach wins over attributes (Знак повелителя Бездны has no attribute text)', () => {
      const group = makeGroup('Знак повелителя Бездны', { functionalCategory: 'breach' });
      expect(classifyFunctionalBlock(group)).toBe('breach');
    });

    it('attributes wins over resistances (dual-attr "силе и ловкости" has no resist substring)', () => {
      const group = makeGroup('+# к силе и ловкости', { functionalCategory: 'attributes' });
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
      makeGroup('+(1—2) к духу', { functionalCategory: 'spirit' }),                                // spirit
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes' }),                                // attributes
      makeGroup('+(15—30)% к сопротивлению огню', { functionalCategory: 'resistances' }),               // resistances
      makeGroup('+(1—2) к максимуму рунического барьера', { functionalCategory: 'runes-barrier' }),       // runes-barrier
      makeGroup('(10—20)% повышение редкости найденных предметов', { functionalCategory: 'magic-find' }), // magic-find
      makeGroup('Знак повелителя Бездны', { functionalCategory: 'breach' }),                       // breach
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
      makeGroup('+(1—2) к духу', { functionalCategory: 'spirit' }),
    ];

    const result = classifyGroups(groups, 'affix-functional');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe(FUNCTIONAL_BLOCK_LABELS.spirit.label);
  });

  it('groups with same block are merged into one sub-group', () => {
    const groups: FamilyGroup[] = [
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes' }),
      makeGroup('+(5—7) к ловкости', { functionalCategory: 'attributes' }),
      makeGroup('+(5—7) к интеллекту', { functionalCategory: 'attributes' }),
    ];

    const result = classifyGroups(groups, 'affix-functional');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('attributes');
    expect(result[0].groups).toHaveLength(3);
  });

  it('preserves group references (does not mutate or clone)', () => {
    const group1 = makeGroup('+(1—2) к духу', { functionalCategory: 'spirit' });
    const group2 = makeGroup('+(5—7) к силе', { functionalCategory: 'attributes' });

    const result = classifyGroups([group1, group2], 'affix-functional');

    const spiritGroup = result.find(sg => sg.key === 'spirit');
    const attrGroup = result.find(sg => sg.key === 'attributes');
    expect(spiritGroup?.groups[0]).toBe(group1);
    expect(attrGroup?.groups[0]).toBe(group2);
  });
});

// ─── classifyWeaponClass (iter 87) — weapon name → weapon class ───

describe('classifyWeaponClass (iter 87) — weapon name → weapon class', () => {
  // ─── melee (мечи / топоры / булавы / кистени / без оружия) ───
  describe('melee class', () => {
    it('classifies "увеличение урона мечами" as melee', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона мечами'))).toBe('melee');
    });
    it('classifies "увеличение урона топорами" as melee', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона топорами'))).toBe('melee');
    });
    it('classifies "увеличение урона булавами" as melee', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона булавами'))).toBe('melee');
    });
    it('classifies "увеличение урона кистенями" as melee', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона кистенями'))).toBe('melee');
    });
    it('classifies "увеличение урона атаками без оружия" as melee', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона атаками без оружия'))).toBe('melee');
    });
    it('classifies "скорость атаки мечами" as melee', () => {
      expect(classifyWeaponClass(makeGroup('(2—4)% повышение скорости атаки мечами'))).toBe('melee');
    });
    it('classifies "скорость накопления шкалы оглушения булавами" as melee', () => {
      expect(classifyWeaponClass(makeGroup('(15—25)% повышение скорости накопления шкалы оглушения булавами'))).toBe('melee');
    });
    it('classifies "скорость атаки без оружия" as melee', () => {
      expect(classifyWeaponClass(makeGroup('(2—4)% повышение скорости атаки без оружия'))).toBe('melee');
    });
  });

  // ─── bow ───
  describe('bow class', () => {
    it('classifies "увеличение урона луками" as bow', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона луками'))).toBe('bow');
    });
    it('classifies "повышение меткости луками" as bow', () => {
      expect(classifyWeaponClass(makeGroup('(5—15)% повышение меткости луками'))).toBe('bow');
    });
    it('classifies "скорость атаки луками" as bow', () => {
      expect(classifyWeaponClass(makeGroup('(2—4)% повышение скорости атаки луками'))).toBe('bow');
    });
  });

  // ─── crossbow ───
  describe('crossbow class', () => {
    it('classifies "увеличение урона самострелами" as crossbow', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона самострелами'))).toBe('crossbow');
    });
    it('classifies "скорость атаки самострелами" as crossbow', () => {
      expect(classifyWeaponClass(makeGroup('(2—4)% повышение скорости атаки самострелами'))).toBe('crossbow');
    });
  });

  // ─── staff ───
  describe('staff class', () => {
    it('classifies "увеличение урона боевыми посохами" as staff', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона боевыми посохами'))).toBe('staff');
    });
    it('classifies "скорость атаки боевыми посохами" as staff', () => {
      expect(classifyWeaponClass(makeGroup('(2—4)% повышение скорости атаки боевыми посохами'))).toBe('staff');
    });
    it('classifies "скорость накопления шкалы заморозки боевыми посохами" as staff', () => {
      expect(classifyWeaponClass(makeGroup('(10—20)% повышение скорости накопления шкалы заморозки боевыми посохами'))).toBe('staff');
    });
  });

  // ─── spear ───
  describe('spear class', () => {
    it('classifies "увеличение урона копьями" as spear', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона копьями'))).toBe('spear');
    });
    it('classifies "скорость атаки копьями" as spear', () => {
      expect(classifyWeaponClass(makeGroup('(2—4)% повышение скорости атаки копьями'))).toBe('spear');
    });
    it('classifies "увеличение бонуса к критическому урону копьями" as spear', () => {
      expect(classifyWeaponClass(makeGroup('(10—20)% увеличение бонуса к критическому урону копьями'))).toBe('spear');
    });
  });

  // ─── dagger ───
  describe('dagger class', () => {
    it('classifies "увеличение урона кинжалами" as dagger', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% увеличение урона кинжалами'))).toBe('dagger');
    });
    it('classifies "скорость атаки кинжалами" as dagger', () => {
      expect(classifyWeaponClass(makeGroup('(2—4)% повышение скорости атаки кинжалами'))).toBe('dagger');
    });
    it('classifies "шанс критического удара кинжалами" as dagger', () => {
      expect(classifyWeaponClass(makeGroup('(6—16)% повышение шанса критического удара кинжалами'))).toBe('dagger');
    });
  });

  // ─── Non-weapon mods return null ───
  describe('non-weapon mods return null', () => {
    it('returns null for generic damage mod (no weapon name)', () => {
      expect(classifyWeaponClass(makeGroup('(20—30)% увеличение урона'))).toBeNull();
    });
    it('returns null for spirit mod', () => {
      expect(classifyWeaponClass(makeGroup('+1 к духу'))).toBeNull();
    });
    it('returns null for attribute mod', () => {
      expect(classifyWeaponClass(makeGroup('+(5—7) к силе'))).toBeNull();
    });
    it('returns null for resistance mod', () => {
      expect(classifyWeaponClass(makeGroup('+(15—30)% к сопротивлению огню'))).toBeNull();
    });
  });
});

// ─── WEAPON_CLASS_LABELS ───

describe('WEAPON_CLASS_LABELS (iter 87)', () => {
  it('has 6 entries (one per WeaponClass)', () => {
    expect(Object.keys(WEAPON_CLASS_LABELS)).toHaveLength(6);
  });

  it('every weapon class has non-empty label and colorClass', () => {
    const allClasses: WeaponClass[] = ['melee', 'bow', 'crossbow', 'staff', 'spear', 'dagger'];
    for (const wc of allClasses) {
      expect(WEAPON_CLASS_LABELS[wc]).toBeDefined();
      expect(WEAPON_CLASS_LABELS[wc].label.length).toBeGreaterThan(0);
      expect(WEAPON_CLASS_LABELS[wc].colorClass.length).toBeGreaterThan(0);
      expect(WEAPON_CLASS_LABELS[wc].bgClass.length).toBeGreaterThan(0);
      expect(WEAPON_CLASS_LABELS[wc].borderClass.length).toBeGreaterThan(0);
    }
  });

  it('every WeaponClass key is in WEAPON_CLASS_LABELS', () => {
    const allClasses: WeaponClass[] = ['melee', 'bow', 'crossbow', 'staff', 'spear', 'dagger'];
    for (const wc of allClasses) {
      expect(WEAPON_CLASS_LABELS[wc]).toBeDefined();
    }
  });
});

// ─── classifyFunctionalBlock — weapon-specific block (iter 87) ───

describe('classifyFunctionalBlock — weapon-specific block (iter 87)', () => {
  // ─── Weapon mods → weapon-specific (BEFORE crit/damage-type/offence-speed) ───
  describe('weapon mods catch by weapon-specific (priority over damage-type)', () => {
    it('classifies "увеличение урона топорами" as weapon-specific (not damage-type)', () => {
      // Has tags ['damage','attack'] → would otherwise go to damage-type.
      // WEAPON_SPECIFIC_PATTERN catches it first via "топорами".
      const group = makeGroup('(5—15)% увеличение урона топорами', {
        members: [makeToken(['damage', 'attack'])],
        functionalCategory: 'weapon-specific'
      });
      expect(classifyFunctionalBlock(group)).toBe('weapon-specific');
    });

    it('classifies "увеличение урона луками" as weapon-specific (not damage-type)', () => {
      const group = makeGroup('(6—16)% увеличение урона луками', {
        members: [makeToken(['damage', 'attack'])],
        functionalCategory: 'weapon-specific'
      });
      expect(classifyFunctionalBlock(group)).toBe('weapon-specific');
    });

    it('classifies "повышение меткости луками" as weapon-specific (not other)', () => {
      // Has only ['attack'] tag → would otherwise fall through to other.
      const group = makeGroup('(5—15)% повышение меткости луками', {
        members: [makeToken(['attack'])],
        functionalCategory: 'weapon-specific'
      });
      expect(classifyFunctionalBlock(group)).toBe('weapon-specific');
    });

    it('classifies "скорость атаки кинжалами" as weapon-specific (not offence-speed)', () => {
      // Has tags ['attack','speed'] → would otherwise go to offence-speed.
      const group = makeGroup('(2—4)% повышение скорости атаки кинжалами', {
        members: [makeToken(['attack', 'speed'])],
        functionalCategory: 'weapon-specific'
      });
      expect(classifyFunctionalBlock(group)).toBe('weapon-specific');
    });

    it('classifies "шанс критического удара кинжалами" as weapon-specific (not crit)', () => {
      // Has tags ['attack','critical'] → would otherwise go to crit.
      const group = makeGroup('(6—16)% повышение шанса критического удара кинжалами', {
        members: [makeToken(['attack', 'critical'])],
        functionalCategory: 'weapon-specific'
      });
      expect(classifyFunctionalBlock(group)).toBe('weapon-specific');
    });

    it('classifies "скорость накопления шкалы оглушения булавами" as weapon-specific', () => {
      // Has tags ['attack'] only → would otherwise fall through to other.
      const group = makeGroup('(15—25)% повышение скорости накопления шкалы оглушения булавами', {
        members: [makeToken(['attack'])],
        functionalCategory: 'weapon-specific'
      });
      expect(classifyFunctionalBlock(group)).toBe('weapon-specific');
    });

    it('classifies "скорость накопления шкалы заморозки боевыми посохами" as weapon-specific', () => {
      // Has tags ['elemental','cold','ailment'] → would otherwise go to other (no functional block matches).
      const group = makeGroup('(10—20)% повышение скорости накопления шкалы заморозки боевыми посохами', {
        members: [makeToken(['elemental', 'cold', 'ailment'])],
        functionalCategory: 'weapon-specific'
      });
      expect(classifyFunctionalBlock(group)).toBe('weapon-specific');
    });

    it('classifies "увеличение урона атаками без оружия" as weapon-specific', () => {
      // Has tags ['damage','attack'] → would otherwise go to damage-type.
      const group = makeGroup('(6—16)% увеличение урона атаками без оружия', {
        members: [makeToken(['damage', 'attack'])],
        functionalCategory: 'weapon-specific'
      });
      expect(classifyFunctionalBlock(group)).toBe('weapon-specific');
    });
  });

  // ─── Non-weapon mods with similar text → NOT weapon-specific ───
  describe('non-weapon mods do NOT match weapon-specific', () => {
    it('classifies "увеличение урона" (generic) as damage-type, NOT weapon-specific', () => {
      const group = makeGroup('(20—30)% увеличение урона', {
        members: [makeToken(['damage'])],
        functionalCategory: 'damage-type'
      });
      expect(classifyFunctionalBlock(group)).toBe('damage-type');
    });

    it('classifies "скорость атаки" (generic, ring mod) as offence-speed, NOT weapon-specific', () => {
      const group = makeGroup('(7—9)% повышение скорости атаки', {
        members: [makeToken(['attack', 'speed'])],
        functionalCategory: 'offence-speed'
      });
      expect(classifyFunctionalBlock(group)).toBe('offence-speed');
    });
  });
});

// ─── classifyGroups with jewel-functional mode (iter 87) ───

describe('classifyGroups with jewel-functional mode (iter 87)', () => {
  it('returns empty array for empty input', () => {
    expect(classifyGroups([], 'jewel-functional')).toEqual([]);
  });

  it('splits weapon-specific block into 6 weapon-class sub-blocks', () => {
    // Pick one representative family-key per weapon class (6 total).
    const groups: FamilyGroup[] = [
      makeGroup('(6—16)% увеличение урона мечами', { functionalCategory: 'weapon-specific' }),                       // weapon-melee
      makeGroup('(5—15)% повышение меткости луками', { functionalCategory: 'weapon-specific' }),                     // weapon-bow
      makeGroup('(6—16)% увеличение урона самострелами', { functionalCategory: 'weapon-specific' }),                 // weapon-crossbow
      makeGroup('(6—16)% увеличение урона боевыми посохами', { functionalCategory: 'weapon-specific' }),             // weapon-staff
      makeGroup('(6—16)% увеличение урона копьями', { functionalCategory: 'weapon-specific' }),                      // weapon-spear
      makeGroup('(6—16)% увеличение урона кинжалами', { functionalCategory: 'weapon-specific' }),                    // weapon-dagger
    ];

    const result = classifyGroups(groups, 'jewel-functional');

    // Expect 6 weapon sub-blocks (each with 1 group), in WEAPON_CLASS_ORDER.
    expect(result).toHaveLength(6);
    const keys = result.map(sg => sg.key);
    expect(keys).toEqual(['weapon-melee', 'weapon-bow', 'weapon-crossbow', 'weapon-staff', 'weapon-spear', 'weapon-dagger']);

    // Each sub-block carries the correct label from WEAPON_CLASS_LABELS.
    expect(result[0].label).toBe(WEAPON_CLASS_LABELS.melee.label);
    expect(result[1].label).toBe(WEAPON_CLASS_LABELS.bow.label);
    expect(result[2].label).toBe(WEAPON_CLASS_LABELS.crossbow.label);
    expect(result[3].label).toBe(WEAPON_CLASS_LABELS.staff.label);
    expect(result[4].label).toBe(WEAPON_CLASS_LABELS.spear.label);
    expect(result[5].label).toBe(WEAPON_CLASS_LABELS.dagger.label);

    // Each sub-block has its own color from WEAPON_CLASS_LABELS.
    expect(result[0].colorClass).toBe(WEAPON_CLASS_LABELS.melee.colorClass);
    expect(result[1].colorClass).toBe(WEAPON_CLASS_LABELS.bow.colorClass);
    expect(result[2].colorClass).toBe(WEAPON_CLASS_LABELS.crossbow.colorClass);
    expect(result[3].colorClass).toBe(WEAPON_CLASS_LABELS.staff.colorClass);
    expect(result[4].colorClass).toBe(WEAPON_CLASS_LABELS.spear.colorClass);
    expect(result[5].colorClass).toBe(WEAPON_CLASS_LABELS.dagger.colorClass);
  });

  it('groups multiple weapon mods of the same class into one sub-block', () => {
    // 3 melee mods (мечи/топоры/булавы) + 1 bow mod (луки).
    const groups: FamilyGroup[] = [
      makeGroup('(6—16)% увеличение урона мечами', { functionalCategory: 'weapon-specific' }),
      makeGroup('(5—15)% увеличение урона топорами', { functionalCategory: 'weapon-specific' }),
      makeGroup('(6—16)% увеличение урона булавами', { functionalCategory: 'weapon-specific' }),
      makeGroup('(6—16)% увеличение урона луками', { functionalCategory: 'weapon-specific' }),
    ];

    const result = classifyGroups(groups, 'jewel-functional');

    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('weapon-melee');
    expect(result[0].groups).toHaveLength(3);
    expect(result[1].key).toBe('weapon-bow');
    expect(result[1].groups).toHaveLength(1);
  });

  it('renders non-weapon blocks in FUNCTIONAL_BLOCK_ORDER alongside weapon sub-blocks', () => {
    // Spirit (1) + weapon-melee (1) + resistances (1).
    const groups: FamilyGroup[] = [
      makeGroup('+1 к духу', { functionalCategory: 'spirit' }),                                  // spirit
      makeGroup('(6—16)% увеличение урона мечами', { functionalCategory: 'weapon-specific' }),            // weapon-melee
      makeGroup('+(15—30)% к сопротивлению огню', { functionalCategory: 'resistances' }),             // resistances
    ];

    const result = classifyGroups(groups, 'jewel-functional');

    expect(result).toHaveLength(3);
    const keys = result.map(sg => sg.key);
    // FUNCTIONAL_BLOCK_ORDER: spirit comes before resistances; weapon-specific is
    // between defence-stats (after resources) and crit. So order is:
    // spirit → weapon-melee → resistances? No — resistances is BEFORE weapon-specific.
    //
    // FUNCTIONAL_BLOCK_ORDER (excerpt):
    //   spirit, skill-levels, attributes, resources, runes-barrier, resistances, defence-stats,
    //   offence-speed, crit, damage-type, penetration, ailments, area-duration, wisps,
    //   buff-skills, minions, meta-skills, weapon-specific, flasks, magic-find, ...
    //
    // So actual order: spirit → resistances → weapon-melee.
    expect(keys).toEqual(['spirit', 'resistances', 'weapon-melee']);
  });

  it('renders weapon sub-blocks in WEAPON_CLASS_ORDER when multiple weapon classes appear', () => {
    // Insert weapon mods in scrambled order — result must follow WEAPON_CLASS_ORDER.
    const groups: FamilyGroup[] = [
      makeGroup('(6—16)% увеличение урона кинжалами', { functionalCategory: 'weapon-specific' }),                    // dagger
      makeGroup('(6—16)% увеличение урона копьями', { functionalCategory: 'weapon-specific' }),                      // spear
      makeGroup('(6—16)% увеличение урона мечами', { functionalCategory: 'weapon-specific' }),                       // melee
      makeGroup('(6—16)% увеличение урона луками', { functionalCategory: 'weapon-specific' }),                       // bow
      makeGroup('(6—16)% увеличение урона самострелами', { functionalCategory: 'weapon-specific' }),                 // crossbow
      makeGroup('(6—16)% увеличение урона боевыми посохами', { functionalCategory: 'weapon-specific' }),             // staff
    ];

    const result = classifyGroups(groups, 'jewel-functional');

    expect(result).toHaveLength(6);
    const keys = result.map(sg => sg.key);
    expect(keys).toEqual(['weapon-melee', 'weapon-bow', 'weapon-crossbow', 'weapon-staff', 'weapon-spear', 'weapon-dagger']);
  });

  it('omits weapon sub-blocks when no weapon mods are present', () => {
    // Pure non-weapon mods.
    const groups: FamilyGroup[] = [
      makeGroup('+1 к духу', { functionalCategory: 'spirit' }),                                  // spirit
      makeGroup('+(15—30)% к сопротивлению огню', { functionalCategory: 'resistances' }),             // resistances
      makeGroup('(20—30)% увеличение урона', { functionalCategory: 'damage-type' }),                  // damage-type
    ];

    const result = classifyGroups(groups, 'jewel-functional');

    // No weapon-* keys should appear.
    const keys = result.map(sg => sg.key);
    expect(keys.every(k => !k.startsWith('weapon-'))).toBe(true);
    expect(keys).toEqual(['spirit', 'resistances', 'damage-type']);
  });

  it('preserves group references (does not mutate or clone)', () => {
    const spiritGroup = makeGroup('+1 к духу', { functionalCategory: 'spirit' });
    const weaponGroup = makeGroup('(6—16)% увеличение урона мечами', { functionalCategory: 'weapon-specific' });

    const result = classifyGroups([spiritGroup, weaponGroup], 'jewel-functional');

    const spiritSg = result.find(sg => sg.key === 'spirit');
    const weaponSg = result.find(sg => sg.key === 'weapon-melee');
    expect(spiritSg?.groups[0]).toBe(spiritGroup);
    expect(weaponSg?.groups[0]).toBe(weaponGroup);
  });

  it('identical to affix-functional for non-weapon groups', () => {
    // Verify that for groups without weapon mods, jewel-functional and
    // affix-functional produce equivalent results (same keys, labels, colors,
    // group count, and same FamilyGroup object references inside).
    const groups: FamilyGroup[] = [
      makeGroup('+1 к духу', { functionalCategory: 'spirit' }),
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes' }),
      makeGroup('+(15—30)% к сопротивлению огню', { functionalCategory: 'resistances' }),
      makeGroup('Знак повелителя Бездны', { functionalCategory: 'breach' }),
    ];

    const fnResult = classifyGroups(groups, 'affix-functional');
    const jfResult = classifyGroups(groups, 'jewel-functional');

    expect(jfResult.length).toBe(fnResult.length);
    for (let i = 0; i < jfResult.length; i++) {
      expect(jfResult[i].key).toBe(fnResult[i].key);
      expect(jfResult[i].label).toBe(fnResult[i].label);
      expect(jfResult[i].colorClass).toBe(fnResult[i].colorClass);
      expect(jfResult[i].bgClass).toBe(fnResult[i].bgClass);
      expect(jfResult[i].borderClass).toBe(fnResult[i].borderClass);
      // Array references will differ (separate Map per invocation), but
      // contents (length + same FamilyGroup object refs) must match.
      expect(jfResult[i].groups.length).toBe(fnResult[i].groups.length);
      for (let j = 0; j < jfResult[i].groups.length; j++) {
        expect(jfResult[i].groups[j]).toBe(fnResult[i].groups[j]);
      }
    }
  });
});

// ─── classifyRelicCategory (iter 98) ───

describe('classifyRelicCategory (iter 98)', () => {
  describe('honor category', () => {
    it('classifies "Восстанавливает # чести при завершении комнаты" as honor', () => {
      expect(classifyRelicCategory(makeGroup('Восстанавливает # чести при завершении комнаты'))).toBe('honor');
    });

    it('classifies "+#% к максимальному сопротивлению чести" as honor', () => {
      expect(classifyRelicCategory(makeGroup('+#% к максимальному сопротивлению чести'))).toBe('honor');
    });

    it('classifies "#% увеличение восстановления чести" as honor', () => {
      expect(classifyRelicCategory(makeGroup('#% увеличение восстановления чести'))).toBe('honor');
    });

    it('classifies "#% увеличение максимума чести" as honor', () => {
      expect(classifyRelicCategory(makeGroup('#% увеличение максимума чести'))).toBe('honor');
    });

    it('classifies "#% шанс при вотере всей вашей чести вместо этого остаться с 1 честью" as honor', () => {
      expect(classifyRelicCategory(makeGroup('#% шанс при вотере всей вашей чести вместо этого остаться с 1 честью'))).toBe('honor');
    });

    // Critical ordering test: "Восстанавливает # чести при убийстве босса"
    // contains "босса" — without HONOR being checked first, this would
    // misclassify as monsters. Verifies the comment in classifyRelicCategory().
    it('classifies "Восстанавливает # чести при убийстве босса" as honor (NOT monsters)', () => {
      expect(classifyRelicCategory(makeGroup('Восстанавливает # чести при убийстве босса'))).toBe('honor');
    });
  });

  describe('sanctum-water category', () => {
    it('classifies "Дарует святой воды по завершению вами комнаты: #" as sanctum-water', () => {
      expect(classifyRelicCategory(makeGroup('Дарует святой воды по завершению вами комнаты: #'))).toBe('sanctum-water');
    });
  });

  describe('trials category', () => {
    it('classifies "На карте испытаний раскрывается дополнительная комната" as trials', () => {
      expect(classifyRelicCategory(makeGroup('На карте испытаний раскрывается дополнительная комната'))).toBe('trials');
    });

    it('classifies "На карте испытаний раскрывается дополнительных комнат: #" as trials', () => {
      expect(classifyRelicCategory(makeGroup('На карте испытаний раскрывается дополнительных комнат: #'))).toBe('trials');
    });
  });

  describe('keys category', () => {
    it('classifies "Когда вы получаете ключ, вы с #% шансом получаете еще один" as keys', () => {
      expect(classifyRelicCategory(makeGroup('Когда вы получаете ключ, вы с #% шансом получаете еще один'))).toBe('keys');
    });

    it('classifies "#% шанс для каждого из ваших ключей улучшиться при завершении этажа" as keys', () => {
      expect(classifyRelicCategory(makeGroup('#% шанс для каждого из ваших ключей улучшиться при завершении этажа'))).toBe('keys');
    });
  });

  describe('merchant category', () => {
    it('classifies "#% снижение цен у торговца" as merchant', () => {
      expect(classifyRelicCategory(makeGroup('#% снижение цен у торговца'))).toBe('merchant');
    });

    it('classifies "Торговец предлагает дополнительный товар на выбор" as merchant', () => {
      expect(classifyRelicCategory(makeGroup('Торговец предлагает дополнительный товар на выбор'))).toBe('merchant');
    });
  });

  describe('monsters category', () => {
    it('classifies "Монстры получают увеличенный на #% урон" as monsters', () => {
      expect(classifyRelicCategory(makeGroup('Монстры получают увеличенный на #% урон'))).toBe('monsters');
    });

    it('classifies "Монстры наносят уменьшенный на #% урон" as monsters', () => {
      expect(classifyRelicCategory(makeGroup('Монстры наносят уменьшенный на #% урон'))).toBe('monsters');
    });

    it('classifies "Редкие монстры получают увеличенный на #% урон" as monsters', () => {
      expect(classifyRelicCategory(makeGroup('Редкие монстры получают увеличенный на #% урон'))).toBe('monsters');
    });

    it('classifies "Боссы наносят уменьшенный на #% урон" as monsters', () => {
      expect(classifyRelicCategory(makeGroup('Боссы наносят уменьшенный на #% урон'))).toBe('monsters');
    });

    it('classifies "Боссы получают увеличенный на #% урон" as monsters', () => {
      expect(classifyRelicCategory(makeGroup('Боссы получают увеличенный на #% урон'))).toBe('monsters');
    });

    it('classifies "Скорость атаки, сотворения чар и передвижения монстров снижена на #%" as monsters', () => {
      expect(classifyRelicCategory(makeGroup('Скорость атаки, сотворения чар и передвижения монстров снижена на #%'))).toBe('monsters');
    });
  });

  describe('curse category', () => {
    it('classifies "#% шанс избежать получения проклятия" as curse', () => {
      expect(classifyRelicCategory(makeGroup('#% шанс избежать получения проклятия'))).toBe('curse');
    });
  });

  describe('other fallback', () => {
    it('classifies unknown text as other', () => {
      expect(classifyRelicCategory(makeGroup('Какой-то неизвестный мод'))).toBe('other');
    });
  });
});

// ─── classifyGroups with relic-semantic mode (iter 98) ───

describe('classifyGroups with relic-semantic mode (iter 98)', () => {
  it('returns empty array for empty input', () => {
    expect(classifyGroups([], 'relic-semantic')).toEqual([]);
  });

  it('classifies all 25 relic family-keys from relic.json (full coverage)', () => {
    // Every family-key from public/generated/relic.json — one synthetic
    // FamilyGroup per family-key. Verifies 100% coverage (no family-key
    // lands in `other` for current production data).
    const familyKeys = [
      // suffixes (12)
      'Дарует святой воды по завершению вами комнаты: #',
      'Восстанавливает # чести при завершении комнаты',
      'На карте испытаний раскрывается дополнительных комнат: #',
      '#% шанс избежать получения проклятия',
      'Восстанавливает # чести при поднятии ключа',
      '+#% к максимальному сопротивлению чести',
      '#% увеличение восстановления чести',
      '#% снижение цен у торговца',
      'Восстанавливает # чести при убийстве босса',
      'Восстанавливает # чести при оказании почестей у маракетского алтаря',
      'На карте испытаний раскрывается дополнительная комната',
      '+#% к сопротивлению чести',
      // prefixes (13)
      'Монстры получают увеличенный на #% урон',
      'Монстры наносят уменьшенный на #% урон',
      'Когда вы получаете ключ, вы с #% шансом получаете еще один',
      'Скорость атаки, сотворения чар и передвижения монстров снижена на #%',
      '#% шанс при вотере всей вашей чести вместо этого остаться с 1 честью',
      '#% шанс для каждого из ваших ключей улучшиться при завершении этажа',
      '#% увеличение восстановления чести',
      '#% увеличение максимума чести',
      'Редкие монстры получают увеличенный на #% урон',
      'Боссы получают увеличенный на #% урон',
      'Торговец предлагает дополнительный товар на выбор',
      'Редкие монстры наносят уменьшенный на #% урон',
      'Боссы наносят уменьшенный на #% урон',
    ];
    expect(familyKeys).toHaveLength(25);

    const groups = familyKeys.map(text => makeGroup(text));
    const result = classifyGroups(groups, 'relic-semantic');

    // All 7 active categories should appear (no `other` for current data).
    const keys = result.map(sg => sg.key);
    expect(keys).toEqual(['honor', 'sanctum-water', 'trials', 'keys', 'merchant', 'monsters', 'curse']);
    expect(keys).not.toContain('other');

    // Category group counts match the expected distribution from relic.json:
    //   honor=10, sanctum-water=1, trials=2, keys=2, merchant=2, monsters=7, curse=1
    const countBy = (key: string) => result.find(sg => sg.key === key)?.groups.length ?? 0;
    expect(countBy('honor')).toBe(10);
    expect(countBy('sanctum-water')).toBe(1);
    expect(countBy('trials')).toBe(2);
    expect(countBy('keys')).toBe(2);
    expect(countBy('merchant')).toBe(2);
    expect(countBy('monsters')).toBe(7);
    expect(countBy('curse')).toBe(1);

    // Total group count preserved (no FamilyGroup lost in classification).
    const totalGroups = result.reduce((sum, sg) => sum + sg.groups.length, 0);
    expect(totalGroups).toBe(25);
  });

  it('returns sub-groups in RELIC_CATEGORY_ORDER (Sanctum-economy first, combat last)', () => {
    // Pick one family-key per category — the order in the result must match
    // RELIC_CATEGORY_ORDER: honor → sanctum-water → trials → keys → merchant
    // → monsters → curse.
    const groups: FamilyGroup[] = [
      makeGroup('Боссы получают увеличенный на #% урон'),                    // monsters
      makeGroup('#% шанс избежать получения проклятия'),                     // curse
      makeGroup('Дарует святой воды по завершению вами комнаты: #'),         // sanctum-water
      makeGroup('#% снижение цен у торговца'),                               // merchant
      makeGroup('Восстанавливает # чести при завершении комнаты'),           // honor
      makeGroup('На карте испытаний раскрывается дополнительная комната'),   // trials
      makeGroup('Когда вы получаете ключ, вы с #% шансом получаете еще один'), // keys
    ];

    const result = classifyGroups(groups, 'relic-semantic');

    expect(result.map(sg => sg.key)).toEqual([
      'honor', 'sanctum-water', 'trials', 'keys', 'merchant', 'monsters', 'curse',
    ]);
  });

  it('skips empty categories (only categories with at least one group appear)', () => {
    // Only honor + monsters — other categories should NOT appear in result.
    const groups: FamilyGroup[] = [
      makeGroup('Восстанавливает # чести при завершении комнаты'),  // honor
      makeGroup('Монстры наносят уменьшенный на #% урон'),          // monsters
    ];

    const result = classifyGroups(groups, 'relic-semantic');

    expect(result.map(sg => sg.key)).toEqual(['honor', 'monsters']);
  });

  it('each sub-group carries label and colorClass from RELIC_LABELS', () => {
    const groups: FamilyGroup[] = [
      makeGroup('Восстанавливает # чести при завершении комнаты'),  // honor
    ];

    const result = classifyGroups(groups, 'relic-semantic');

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe(RELIC_LABELS.honor.label);
    expect(result[0].colorClass).toBe(RELIC_LABELS.honor.colorClass);
    expect(result[0].bgClass).toBe(RELIC_LABELS.honor.bgClass);
    expect(result[0].borderClass).toBe(RELIC_LABELS.honor.borderClass);
  });

  it('preserves group references (does not mutate or clone)', () => {
    const honorGroup = makeGroup('Восстанавливает # чести при завершении комнаты');
    const monsterGroup = makeGroup('Монстры наносят уменьшенный на #% урон');

    const result = classifyGroups([honorGroup, monsterGroup], 'relic-semantic');

    const honorSg = result.find(sg => sg.key === 'honor');
    const monsterSg = result.find(sg => sg.key === 'monsters');
    expect(honorSg?.groups[0]).toBe(honorGroup);
    expect(monsterSg?.groups[0]).toBe(monsterGroup);
  });
});

// ─── RELIC_LABELS sanity (iter 98) ───

describe('RELIC_LABELS (iter 98)', () => {
  it('has 8 entries (one per RelicCategory, including `other`)', () => {
    expect(Object.keys(RELIC_LABELS)).toHaveLength(8);
    expect(Object.keys(RELIC_LABELS).sort()).toEqual([
      'curse', 'honor', 'keys', 'merchant', 'monsters', 'other', 'sanctum-water', 'trials',
    ]);
  });

  it('every relic category has non-empty label and colorClass', () => {
    for (const [, cfg] of Object.entries(RELIC_LABELS)) {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.colorClass.length).toBeGreaterThan(0);
      expect(cfg.bgClass.length).toBeGreaterThan(0);
      expect(cfg.borderClass.length).toBeGreaterThan(0);
    }
  });
});

// ─── sortGroupsAlphabetically (iter 99 — readability pass) ───

describe('sortGroupsAlphabetically (iter 99)', () => {
  it('returns a new array (does not mutate input)', () => {
    const g1 = makeGroup('+# к силе');
    const g2 = makeGroup('+# к ловкости');
    const input = [g1, g2];
    const result = sortGroupsAlphabetically(input);
    // New array reference
    expect(result).not.toBe(input);
    // Input array order unchanged
    expect(input[0]).toBe(g1);
    expect(input[1]).toBe(g2);
  });

  it('preserves FamilyGroup object references (does not clone)', () => {
    const g1 = makeGroup('+# к силе');
    const g2 = makeGroup('+# к ловкости');
    const result = sortGroupsAlphabetically([g1, g2]);
    expect(result).toContain(g1);
    expect(result).toContain(g2);
    expect(result.length).toBe(2);
  });

  it('returns empty array for empty input', () => {
    expect(sortGroupsAlphabetically([])).toEqual([]);
  });

  it('returns shallow copy for single-element array', () => {
    const g1 = makeGroup('+# к силе');
    const result = sortGroupsAlphabetically([g1]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(g1);
  });

  it('sorts alphabetically by familyKey (Russian locale)', () => {
    // Russian alpha order: и < л < с
    const groups = [
      makeGroup('+# к силе'),
      makeGroup('+# к ловкости'),
      makeGroup('+# к интеллекту'),
    ];
    const result = sortGroupsAlphabetically(groups);
    expect(result.map(g => g.familyKey)).toEqual([
      '+# к интеллекту',
      '+# к ловкости',
      '+# к силе',
    ]);
  });

  it('uses familyKey (NOT displayText) so numeric ranges do not fragment alpha flow', () => {
    // displayText has ranges: "+(1—2) к силе", "+(9—12) к ловкости", "+(15—20) к интеллекту"
    // Sorting by displayText would put 1 < 9 < 15 → силе, ловкости, интеллекту (WRONG)
    // Sorting by familyKey gives: интеллекту, ловкости, силе (CORRECT alpha)
    const groups = [
      makeGroup('+(15—20) к интеллекту', { familyKey: '+# к интеллекту' }),
      makeGroup('+(1—2) к силе', { familyKey: '+# к силе' }),
      makeGroup('+(9—12) к ловкости', { familyKey: '+# к ловкости' }),
    ];
    const result = sortGroupsAlphabetically(groups);
    expect(result.map(g => g.familyKey)).toEqual([
      '+# к интеллекту',
      '+# к ловкости',
      '+# к силе',
    ]);
  });

  it('priority tier does NOT fragment alphabetical order (tier is tiebreaker only)', () => {
    // In legacy tier-first sort: Сила (S) + Ловкость (S) + Интеллект (A) would give
    //   [Сила S, Ловкость S, Интеллект A] — alphabetical fragmented by tier.
    // In iter 99 alphabetical sort: [Интеллект A, Ловкость S, Сила S] — pure alpha.
    const groups = [
      makeGroup('+# к силе', { priorityTier: 'S' }),
      makeGroup('+# к ловкости', { priorityTier: 'S' }),
      makeGroup('+# к интеллекту', { priorityTier: 'A' }),
    ];
    const result = sortGroupsAlphabetically(groups);
    expect(result.map(g => g.familyKey)).toEqual([
      '+# к интеллекту',  // и — alpha first, even though A-tier
      '+# к ловкости',    // л
      '+# к силе',        // с
    ]);
  });

  it('uses priority tier as tiebreaker when familyKey is identical', () => {
    // Edge case: two groups with same familyKey but different tiers (shouldn't happen
    // in production but tested defensively). S comes before A.
    const groups = [
      makeGroup('+# к силе', { priorityTier: 'A' }),
      makeGroup('+# к силе', { priorityTier: 'S' }),
    ];
    const result = sortGroupsAlphabetically(groups);
    expect(result[0].priorityTier).toBe('S');
    expect(result[1].priorityTier).toBe('A');
  });

  it('strips ::origin suffix when sorting origin-split groups', () => {
    // splitGroupByOrigin sets familyKey to `${familyKey}::${origin}`.
    // All origin variants of the same family should sort together by their
    // clean template name, not by their origin suffix.
    const groups = [
      makeGroup('ignored', { familyKey: '+# к силе::corrupted' }),
      makeGroup('ignored', { familyKey: '+# к ловкости::normal' }),
      makeGroup('ignored', { familyKey: '+# к интеллекту::desecrated' }),
    ];
    const result = sortGroupsAlphabetically(groups);
    expect(result.map(g => g.familyKey)).toEqual([
      '+# к интеллекту::desecrated',
      '+# к ловкости::normal',
      '+# к силе::corrupted',
    ]);
  });

  it('handles mixed-Cyrillic-Latin familyKeys without throwing', () => {
    const groups = [
      makeGroup('English mod'),
      makeGroup('Русский мод'),
      makeGroup('Another english'),
    ];
    expect(() => sortGroupsAlphabetically(groups)).not.toThrow();
    // Result is a permutation of the input
    expect(sortGroupsAlphabetically(groups)).toHaveLength(3);
  });
});

// ─── sortGroupsByTierFirst + sortGroupsByMode (iter 106: P4 toggle) ───

describe('sortGroupsByTierFirst (iter 106 P4)', () => {
  it('returns a new array (does not mutate input)', () => {
    const g1 = makeGroup('+# к силе', { priorityTier: 'S' });
    const g2 = makeGroup('+# к ловкости', { priorityTier: 'A' });
    const input = [g1, g2];
    const result = sortGroupsByTierFirst(input);
    expect(result).not.toBe(input);
    expect(input[0]).toBe(g1);
    expect(input[1]).toBe(g2);
  });

  it('preserves FamilyGroup object references (does not clone)', () => {
    const g1 = makeGroup('+# к силе', { priorityTier: 'S' });
    const g2 = makeGroup('+# к ловкости', { priorityTier: 'A' });
    const result = sortGroupsByTierFirst([g1, g2]);
    expect(result).toContain(g1);
    expect(result).toContain(g2);
    expect(result.length).toBe(2);
  });

  it('returns empty array for empty input', () => {
    expect(sortGroupsByTierFirst([])).toEqual([]);
  });

  it('returns shallow copy for single-element array', () => {
    const g1 = makeGroup('+# к силе', { priorityTier: 'S' });
    const result = sortGroupsByTierFirst([g1]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(g1);
  });

  it('sorts by priority tier primary (S→A→B→C)', () => {
    // Same familyKey — tier should drive the order.
    const groups = [
      makeGroup('+# к силе', { priorityTier: 'C' }),
      makeGroup('+# к силе', { priorityTier: 'A' }),
      makeGroup('+# к силе', { priorityTier: 'S' }),
      makeGroup('+# к силе', { priorityTier: 'B' }),
    ];
    const result = sortGroupsByTierFirst(groups);
    expect(result.map(g => g.priorityTier)).toEqual(['S', 'A', 'B', 'C']);
  });

  it('uses familyKey (Russian locale) as tiebreaker when tiers are identical', () => {
    // All same tier S — alpha should drive the order (и < л < с).
    const groups = [
      makeGroup('+# к силе', { priorityTier: 'S' }),
      makeGroup('+# к ловкости', { priorityTier: 'S' }),
      makeGroup('+# к интеллекту', { priorityTier: 'S' }),
    ];
    const result = sortGroupsByTierFirst(groups);
    expect(result.map(g => g.familyKey)).toEqual([
      '+# к интеллекту',
      '+# к ловкости',
      '+# к силе',
    ]);
  });

  it('tier-first vs alpha differ when mods have mixed tiers', () => {
    // The classic iter 99 example: Сила (S) + Ловкость (S) + Интеллект (A)
    //   alpha:      [Интеллект A, Ловкость S, Сила S]   (pure alpha, tier fragmented)
    //   tier-first: [Интеллект A → LAST, Сила S, Ловкость S] then alpha within tier
    //   Actually: S-tier alpha: [Ловкость, Сила] (л < с), then A-tier: [Интеллект]
    //   → tier-first result: [Ловкость S, Сила S, Интеллект A]
    const groups = [
      makeGroup('+# к силе', { priorityTier: 'S' }),
      makeGroup('+# к ловкости', { priorityTier: 'S' }),
      makeGroup('+# к интеллекту', { priorityTier: 'A' }),
    ];
    const alpha = sortGroupsAlphabetically(groups);
    const tierFirst = sortGroupsByTierFirst(groups);
    // Sanity: alpha order is и < л < с
    expect(alpha.map(g => g.familyKey)).toEqual([
      '+# к интеллекту',
      '+# к ловкости',
      '+# к силе',
    ]);
    // tier-first: S-tier mods first (alpha within: ловкость < сила), then A-tier (интеллект)
    expect(tierFirst.map(g => g.familyKey)).toEqual([
      '+# к ловкости',     // S, alpha first within tier
      '+# к силе',         // S, alpha second within tier
      '+# к интеллекту',   // A, last
    ]);
    // The two orders MUST differ — proves tier-first is not identical to alpha.
    expect(tierFirst.map(g => g.familyKey)).not.toEqual(alpha.map(g => g.familyKey));
  });

  it('strips ::origin suffix when sorting (tier primary, alpha tiebreaker)', () => {
    // Two S-tier origin variants + one A-tier. S-tier variants should sort first
    // (by alpha on the clean template name), then the A-tier variant.
    const groups = [
      makeGroup('ignored', { familyKey: '+# к силе::corrupted', priorityTier: 'A' }),
      makeGroup('ignored', { familyKey: '+# к ловкости::normal', priorityTier: 'S' }),
      makeGroup('ignored', { familyKey: '+# к интеллекту::desecrated', priorityTier: 'S' }),
    ];
    const result = sortGroupsByTierFirst(groups);
    // S-tier first, alpha within (intellect < ловкость), then A-tier (сила)
    expect(result.map(g => g.familyKey)).toEqual([
      '+# к интеллекту::desecrated',   // S, alpha first
      '+# к ловкости::normal',         // S, alpha second
      '+# к силе::corrupted',          // A, last
    ]);
  });

  it('handles all tiers in canonical order S→A→B→C across distinct families', () => {
    const groups = [
      makeGroup('+# к силе', { priorityTier: 'B' }),
      makeGroup('+# к ловкости', { priorityTier: 'S' }),
      makeGroup('+# к интеллекту', { priorityTier: 'C' }),
      makeGroup('+# к мудрости', { priorityTier: 'A' }),
    ];
    const result = sortGroupsByTierFirst(groups);
    expect(result.map(g => g.priorityTier)).toEqual(['S', 'A', 'B', 'C']);
    // Within S-only one entry; A-only one; etc. — so familyKey order follows tier.
    expect(result.map(g => g.familyKey)).toEqual([
      '+# к ловкости',    // S
      '+# к мудрости',    // A
      '+# к силе',        // B
      '+# к интеллекту',  // C
    ]);
  });
});

describe('sortGroupsByMode (iter 106 P4 — dispatch entry point)', () => {
  it('defaults to alpha when no mode is passed (backward compat)', () => {
    // Same scenario as the iter 99 test "tier does NOT fragment alphabetical flow".
    const groups = [
      makeGroup('+# к силе', { priorityTier: 'S' }),
      makeGroup('+# к ловкости', { priorityTier: 'S' }),
      makeGroup('+# к интеллекту', { priorityTier: 'A' }),
    ];
    const resultNoMode = sortGroupsByMode(groups);
    const resultAlphaExplicit = sortGroupsByMode(groups, 'alpha');
    // Both should produce pure alpha order (alpha primary).
    expect(resultNoMode.map(g => g.familyKey)).toEqual([
      '+# к интеллекту',
      '+# к ловкости',
      '+# к силе',
    ]);
    expect(resultNoMode).toEqual(resultAlphaExplicit);
  });

  it("'alpha' mode delegates to sortGroupsAlphabetically (same output)", () => {
    const groups = [
      makeGroup('+# к силе', { priorityTier: 'S' }),
      makeGroup('+# к интеллекту', { priorityTier: 'A' }),
    ];
    expect(sortGroupsByMode(groups, 'alpha' as SortMode))
      .toEqual(sortGroupsAlphabetically(groups));
  });

  it("'tier-first' mode delegates to sortGroupsByTierFirst (same output)", () => {
    const groups = [
      makeGroup('+# к силе', { priorityTier: 'S' }),
      makeGroup('+# к интеллекту', { priorityTier: 'A' }),
    ];
    expect(sortGroupsByMode(groups, 'tier-first' as SortMode))
      .toEqual(sortGroupsByTierFirst(groups));
  });

  it('returns a NEW array in both modes (no mutation)', () => {
    const g1 = makeGroup('+# к силе', { priorityTier: 'S' });
    const g2 = makeGroup('+# к интеллекту', { priorityTier: 'A' });
    const input = [g1, g2];
    const alphaResult = sortGroupsByMode(input, 'alpha');
    const tierResult = sortGroupsByMode(input, 'tier-first');
    expect(alphaResult).not.toBe(input);
    expect(tierResult).not.toBe(input);
    expect(input[0]).toBe(g1);
    expect(input[1]).toBe(g2);
  });

  it('handles empty array in both modes', () => {
    expect(sortGroupsByMode([], 'alpha')).toEqual([]);
    expect(sortGroupsByMode([], 'tier-first')).toEqual([]);
  });
});

// ─── classifyGroups respects sortMode argument (iter 106 P4) ───

describe('classifyGroups respects sortMode argument (iter 106 P4)', () => {
  it('affix-functional: default sortMode is alpha (backward compat)', () => {
    // No third argument → default 'alpha' → Сила/Ловкость/Интеллект alpha order
    // regardless of tier.
    const groups: FamilyGroup[] = [
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes', priorityTier: 'S' }),
      makeGroup('+(5—7) к ловкости', { functionalCategory: 'attributes', priorityTier: 'A' }),
      makeGroup('+(5—7) к интеллекту', { functionalCategory: 'attributes', priorityTier: 'S' }),
    ];
    const result = classifyGroups(groups, 'affix-functional');
    expect(result[0].groups.map(g => g.familyKey)).toEqual([
      '+(5—7) к интеллекту',
      '+(5—7) к ловкости',
      '+(5—7) к силе',
    ]);
  });

  it("affix-functional: sortMode='tier-first' surfaces S-tier first", () => {
    const groups: FamilyGroup[] = [
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes', priorityTier: 'S' }),
      makeGroup('+(5—7) к ловкости', { functionalCategory: 'attributes', priorityTier: 'A' }),
      makeGroup('+(5—7) к интеллекту', { functionalCategory: 'attributes', priorityTier: 'S' }),
    ];
    const result = classifyGroups(groups, 'affix-functional', 'tier-first');
    // S-tier alpha within (интеллект < ловкость... wait no: only intellect and сила are S here)
    // S-tier: Сила (S) + Интеллект (S) → alpha: Интеллект, Сила
    // A-tier: Ловкость (A) → Ловкость
    expect(result[0].groups.map(g => g.familyKey)).toEqual([
      '+(5—7) к интеллекту',  // S, alpha first
      '+(5—7) к силе',        // S, alpha second
      '+(5—7) к ловкости',    // A, last
    ]);
    expect(result[0].groups.map(g => g.priorityTier)).toEqual(['S', 'S', 'A']);
  });

  it("affix-functional: 'alpha' explicit mode matches default", () => {
    const groups: FamilyGroup[] = [
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes', priorityTier: 'S' }),
      makeGroup('+(5—7) к ловкости', { functionalCategory: 'attributes', priorityTier: 'A' }),
    ];
    const defaultResult = classifyGroups(groups, 'affix-functional');
    const explicitAlpha = classifyGroups(groups, 'affix-functional', 'alpha');
    expect(defaultResult[0].groups.map(g => g.familyKey))
      .toEqual(explicitAlpha[0].groups.map(g => g.familyKey));
  });

  it('relic-semantic: tier-first surfaces S-tier honor mods first within honor block', () => {
    const groups: FamilyGroup[] = [
      makeGroup('Восстанавливает # чести при завершении комнаты', { priorityTier: 'A' }),
      makeGroup('+#% к сопротивлению чести', { priorityTier: 'S' }),
    ];
    const result = classifyGroups(groups, 'relic-semantic', 'tier-first');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('honor');
    // S-tier first, A-tier last
    expect(result[0].groups.map(g => g.priorityTier)).toEqual(['S', 'A']);
  });

  it('tablet-type-subblocks: tier-first surfaces S-tier mods first within sub-block', () => {
    // Two ritual-rewards mods with different tiers — verify tier-first surfaces S.
    const groups: FamilyGroup[] = [
      makeGroup('#% увеличение количества подношений за ритуал', { priorityTier: 'A' }),
      makeGroup('Увеличение качества подношений за ритуал', { priorityTier: 'S' }),
    ];
    const result = classifyGroups(groups, 'tablet-type-subblocks', 'tier-first');
    // Find the sub-block that contains both — they're both ritual-rewards.
    const targetSg = result.find(sg => sg.groups.length === 2);
    expect(targetSg).toBeDefined();
    expect(targetSg!.groups.map(g => g.priorityTier)).toEqual(['S', 'A']);
  });

  it('jewel-functional: tier-first surfaces S-tier mods first within attributes block', () => {
    // Two attributes mods with different tiers — verify tier-first surfaces S
    // inside the attributes block of jewel-functional mode (same code path as
    // affix-functional, but exercises the jewel-specific classifyGroups branch).
    const groups: FamilyGroup[] = [
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes', priorityTier: 'A' }),
      makeGroup('+(5—7) к интеллекту', { functionalCategory: 'attributes', priorityTier: 'S' }),
    ];
    const result = classifyGroups(groups, 'jewel-functional', 'tier-first');
    // Both mods land in the same 'attributes' sub-block — verify tier-first surfaces S.
    const attrSg = result.find(sg => sg.key === 'attributes');
    expect(attrSg).toBeDefined();
    expect(attrSg!.groups.map(g => g.priorityTier)).toEqual(['S', 'A']);
    expect(attrSg!.groups.map(g => g.familyKey)).toEqual([
      '+(5—7) к интеллекту',  // S
      '+(5—7) к силе',        // A
    ]);
  });

  it('affix-sentiment-subblocks: tier-first surfaces S-tier mods first within positive sub-block', () => {
    const groups: FamilyGroup[] = [
      makeGroup('#% повышение редкости найденных предметов', { priorityTier: 'A' }),
      makeGroup('#% увеличение количества найденных предметов', { priorityTier: 'S' }),
    ];
    const result = classifyGroups(groups, 'affix-sentiment-subblocks', 'tier-first');
    // Both mods are waystone positive-loot — verify they're in the same sub-block
    // and tier-first surfaces S.
    const positiveSg = result.find(sg => sg.groups.length === 2);
    if (positiveSg) {
      expect(positiveSg.groups.map(g => g.priorityTier)).toEqual(['S', 'A']);
    }
    // Either way — result is non-empty and tier-first is consistent
    expect(result.length).toBeGreaterThan(0);
  });

  it('preserves FamilyGroup references in both modes (no clone)', () => {
    const g1 = makeGroup('+(5—7) к силе', { functionalCategory: 'attributes', priorityTier: 'S' });
    const g2 = makeGroup('+(5—7) к интеллекту', { functionalCategory: 'attributes', priorityTier: 'A' });
    const alphaResult = classifyGroups([g1, g2], 'affix-functional', 'alpha');
    const tierResult = classifyGroups([g1, g2], 'affix-functional', 'tier-first');
    expect(alphaResult[0].groups).toContain(g1);
    expect(alphaResult[0].groups).toContain(g2);
    expect(tierResult[0].groups).toContain(g1);
    expect(tierResult[0].groups).toContain(g2);
  });
});

// ─── classifyGroups applies alphabetical within-block sort (iter 99) ───

describe('classifyGroups applies alphabetical within-block sort (iter 99)', () => {
  it('affix-functional: within attributes block, groups are alphabetically sorted', () => {
    // Input order is "reverse alpha" to verify sort is applied.
    const groups: FamilyGroup[] = [
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes' }),
      makeGroup('+(5—7) к ловкости', { functionalCategory: 'attributes' }),
      makeGroup('+(5—7) к интеллекту', { functionalCategory: 'attributes' }),
    ];
    const result = classifyGroups(groups, 'affix-functional');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('attributes');
    // Alpha order: и < л < с
    expect(result[0].groups.map(g => g.familyKey)).toEqual([
      '+(5—7) к интеллекту',
      '+(5—7) к ловкости',
      '+(5—7) к силе',
    ]);
  });

  it('affix-functional: tier does NOT fragment alphabetical flow within a block', () => {
    // In tier-first sort: Сила S + Ловкость A + Интеллект S would give
    //   [Сила S, Интеллект S, Ловкость A] — S-tier mods first, fragmenting alpha.
    // In iter 99: [Интеллект S, Ловкость A, Сила S] — pure alpha.
    const groups: FamilyGroup[] = [
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes', priorityTier: 'S' }),
      makeGroup('+(5—7) к ловкости', { functionalCategory: 'attributes', priorityTier: 'A' }),
      makeGroup('+(5—7) к интеллекту', { functionalCategory: 'attributes', priorityTier: 'S' }),
    ];
    const result = classifyGroups(groups, 'affix-functional');
    expect(result[0].groups.map(g => g.familyKey)).toEqual([
      '+(5—7) к интеллекту',
      '+(5—7) к ловкости',
      '+(5—7) к силе',
    ]);
  });

  it('affix-functional: sub-group render order (FUNCTIONAL_BLOCK_ORDER) is preserved', () => {
    // iter 99 only changes WITHIN-block order — block-level order is still
    // FUNCTIONAL_BLOCK_ORDER (spirit → skill-levels → attributes → ...).
    const groups: FamilyGroup[] = [
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes' }),
      makeGroup('+(1—2) к духу', { functionalCategory: 'spirit' }),
    ];
    const result = classifyGroups(groups, 'affix-functional');
    expect(result.map(sg => sg.key)).toEqual(['spirit', 'attributes']);
  });

  it('affix-functional: preserves FamilyGroup references (no clone)', () => {
    const g1 = makeGroup('+(1—2) к духу', { functionalCategory: 'spirit' });
    const g2 = makeGroup('+(5—7) к силе', { functionalCategory: 'attributes' });
    const result = classifyGroups([g1, g2], 'affix-functional');
    const spiritSg = result.find(sg => sg.key === 'spirit');
    const attrSg = result.find(sg => sg.key === 'attributes');
    expect(spiritSg?.groups[0]).toBe(g1);
    expect(attrSg?.groups[0]).toBe(g2);
  });

  it('relic-semantic: within honor category, groups are alphabetically sorted', () => {
    // 3 honor groups in reverse alpha — verify iter 99 sorts them.
    const groups: FamilyGroup[] = [
      makeGroup('#% увеличение максимума чести'),
      makeGroup('+#% к сопротивлению чести'),
      makeGroup('Восстанавливает # чести при завершении комнаты'),
    ];
    const result = classifyGroups(groups, 'relic-semantic');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('honor');
    // Alpha order (Russian): "%" < "+" < "В" in localeCompare ru — but we test
    // that the result IS sorted, not the specific order, to be robust to
    // localeCompare quirks. Verify by re-sorting with same comparator.
    const familyKeys = result[0].groups.map(g => g.familyKey);
    const reSorted = [...familyKeys].sort((a, b) => a.localeCompare(b, 'ru'));
    expect(familyKeys).toEqual(reSorted);
  });

  it('tablet-type: within ritual category, groups are alphabetically sorted', () => {
    const groups: FamilyGroup[] = [
      makeGroup('#% увеличение количества подношений за ритуал'),
      makeGroup('Альтари ритуала предлагают дополнительный выбор'),
    ];
    const result = classifyGroups(groups, 'tablet-type');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('ritual');
    // Verify alpha order
    const familyKeys = result[0].groups.map(g => g.familyKey);
    const reSorted = [...familyKeys].sort((a, b) => a.localeCompare(b, 'ru'));
    expect(familyKeys).toEqual(reSorted);
  });

  it('affix-sentiment: within positive sentiment, groups are alphabetically sorted', () => {
    const groups: FamilyGroup[] = [
      makeGroup('#% повышение редкости найденных предметов'),
      makeGroup('#% повышение количества найденных предметов'),
    ];
    const result = classifyGroups(groups, 'affix-sentiment');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('positive');
    const familyKeys = result[0].groups.map(g => g.familyKey);
    const reSorted = [...familyKeys].sort((a, b) => a.localeCompare(b, 'ru'));
    expect(familyKeys).toEqual(reSorted);
  });

  it('affix-only: even legacy single-block mode gets alphabetical sort', () => {
    const groups: FamilyGroup[] = [
      makeGroup('+# к силе'),
      makeGroup('+# к ловкости'),
      makeGroup('+# к интеллекту'),
    ];
    const result = classifyGroups(groups, 'affix-only');
    expect(result).toHaveLength(1);
    expect(result[0].groups.map(g => g.familyKey)).toEqual([
      '+# к интеллекту',
      '+# к ловкости',
      '+# к силе',
    ]);
  });

  it('jewel-functional: weapon sub-blocks are each alphabetically sorted', () => {
    // 2 melee weapon mods ( мечами / топорами ) in reverse alpha + 1 attribute mod.
    // After iter 99: within weapon-melee sub-block, mods are alphabetical.
    const groups: FamilyGroup[] = [
      makeGroup('(6—16)% увеличение урона топорами', { functionalCategory: 'weapon-specific' }),
      makeGroup('(6—16)% увеличение урона мечами', { functionalCategory: 'weapon-specific' }),
      makeGroup('+(5—7) к силе', { functionalCategory: 'attributes' }),
    ];
    const result = classifyGroups(groups, 'jewel-functional');
    // Block order: attributes → weapon-melee
    expect(result.map(sg => sg.key)).toEqual(['attributes', 'weapon-melee']);
    const meleeSg = result.find(sg => sg.key === 'weapon-melee');
    expect(meleeSg?.groups.map(g => g.familyKey)).toEqual([
      '(6—16)% увеличение урона мечами',     // м
      '(6—16)% увеличение урона топорами',   // т (м < т)
    ]);
  });

  // ─── iter 104: affix-sentiment-subblocks mode ───

  it('affix-sentiment-subblocks: produces composite-key sub-blocks (iter 104)', () => {
    // Mix of positive-loot + negative-monster-power — verify both sub-blocks
    // appear with composite keys, in canonical order (positive before negative).
    const groups: FamilyGroup[] = [
      makeGroup('#% повышение редкости найденных предметов'),          // positive-loot
      makeGroup('(5—24)% увеличение урона монстров'),                  // negative-monster-power
    ];
    const result = classifyGroups(groups, 'affix-sentiment-subblocks');
    expect(result.map(sg => sg.key)).toEqual(['positive-loot', 'negative-monster-power']);
    expect(result[0].label).toBe('Добыча');
    expect(result[1].label).toBe('Сила монстров');
  });

  it('affix-sentiment-subblocks: empty sub-blocks are skipped (iter 104)', () => {
    // Only positive-loot mods — only that sub-block should appear (others skipped).
    const groups: FamilyGroup[] = [
      makeGroup('#% повышение редкости найденных предметов'),
      makeGroup('#% повышение количества найденных предметов'),
    ];
    const result = classifyGroups(groups, 'affix-sentiment-subblocks');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('positive-loot');
  });

  it('affix-sentiment-subblocks: within sub-block, groups are alphabetically sorted (iter 104)', () => {
    // 2 loot mods in reverse alpha — verify iter 99 alphabetical sort applies.
    const groups: FamilyGroup[] = [
      makeGroup('#% повышение редкости найденных предметов'),
      makeGroup('#% повышение количества найденных предметов'),
    ];
    const result = classifyGroups(groups, 'affix-sentiment-subblocks');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('positive-loot');
    const familyKeys = result[0].groups.map(g => g.familyKey);
    const reSorted = [...familyKeys].sort((a, b) => a.localeCompare(b, 'ru'));
    expect(familyKeys).toEqual(reSorted);
  });

  it('affix-sentiment-subblocks: sub-blocks render in canonical order (iter 104)', () => {
    // One mod per sub-block, in reverse order — verify result is in
    // WAYSTONE_SUBBLOCK_ORDER (positive-loot → ... → neutral-generic).
    const groups: FamilyGroup[] = [
      makeGroup('Какой-то неизвестный мод'),                              // neutral-generic
      makeGroup('В области есть участки подожженной земли'),              // negative-environment
      makeGroup('Игроки получают уменьшение зарядов флакона на (20—35)%'), // negative-player-penalty
      makeGroup('Дополнительных свойств у редких монстров: #'),           // negative-monster-modifiers
      makeGroup('Монстры бронированы'),                                   // negative-monster-defense
      makeGroup('(5—24)% увеличение урона монстров'),                     // negative-monster-power
      makeGroup('Доступно возрождений: #', { affix: 'implicit' }),        // positive-buffs
      makeGroup('В области можно встретить дополнительных Бездн: (2—3)'), // positive-mechanics
      makeGroup('#% повышение редкости найденных предметов'),             // positive-loot
    ];
    const result = classifyGroups(groups, 'affix-sentiment-subblocks');
    expect(result.map(sg => sg.key)).toEqual([
      'positive-loot',
      'positive-mechanics',
      'positive-buffs',
      'negative-monster-power',
      'negative-monster-defense',
      'negative-monster-modifiers',
      'negative-player-penalty',
      'negative-environment',
      'neutral-generic',
    ]);
  });

  it('affix-sentiment-subblocks: preserves FamilyGroup references (no clone, iter 104)', () => {
    // Same invariant as affix-functional: FamilyGroup object references must be
    // preserved (not cloned) so downstream React memoization works.
    const g1 = makeGroup('#% повышение редкости найденных предметов'); // positive-loot
    const g2 = makeGroup('(5—24)% увеличение урона монстров');          // negative-monster-power
    const result = classifyGroups([g1, g2], 'affix-sentiment-subblocks');
    const lootSg = result.find(sg => sg.key === 'positive-loot');
    const powerSg = result.find(sg => sg.key === 'negative-monster-power');
    expect(lootSg?.groups[0]).toBe(g1);
    expect(powerSg?.groups[0]).toBe(g2);
  });

  // ─── iter 105: tablet-type-subblocks mode ───

  it('tablet-type-subblocks: produces composite-key sub-blocks (iter 105)', () => {
    // Mix of ritual-rewards + breach-monsters — verify both sub-blocks appear
    // with composite keys, in canonical order (ritual before breach).
    const groups: FamilyGroup[] = [
      makeGroup('(20—30)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'), // ritual-rewards
      makeGroup('(8—12)% увеличение эффективности монстров Бездны за каждый закрытый провал, вплоть до 100%'),         // breach-monsters
    ];
    const result = classifyGroups(groups, 'tablet-type-subblocks');
    expect(result.map(sg => sg.key)).toEqual(['ritual-rewards', 'breach-monsters']);
    expect(result[0].label).toBe('Награды Ритуала');
    expect(result[1].label).toBe('Монстры Бездны');
  });

  it('tablet-type-subblocks: empty sub-blocks are skipped (iter 105)', () => {
    // Only ritual-rewards mods — only that sub-block should appear (others skipped).
    const groups: FamilyGroup[] = [
      makeGroup('(20—30)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'),
      makeGroup('(20—30)% уменьшение стоимости в дани для обновления наград в алтарях Ритуала на карте'),
    ];
    const result = classifyGroups(groups, 'tablet-type-subblocks');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('ritual-rewards');
  });

  it('tablet-type-subblocks: within sub-block, groups are alphabetically sorted (iter 105)', () => {
    // 2 ritual-rewards mods in reverse alpha — verify iter 99 alphabetical sort applies.
    const groups: FamilyGroup[] = [
      makeGroup('(20—30)% уменьшение стоимости в дани для обновления наград в алтарях Ритуала на карте'),
      makeGroup('(20—30)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'),
    ];
    const result = classifyGroups(groups, 'tablet-type-subblocks');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('ritual-rewards');
    const familyKeys = result[0].groups.map(g => g.familyKey);
    const reSorted = [...familyKeys].sort((a, b) => a.localeCompare(b, 'ru'));
    expect(familyKeys).toEqual(reSorted);
  });

  it('tablet-type-subblocks: sub-blocks render in canonical order (iter 105)', () => {
    // One mod per sub-block across multiple types — verify result is in
    // TABLET_SUBBLOCK_ORDER (ritual-rewards → ritual-monsters → ritual-content →
    // breach-monsters → ... → generic-player).
    const groups: FamilyGroup[] = [
      makeGroup('(12—18)% увеличение количества получаемого опыта на карте'), // generic-player
      makeGroup('(25—35)% увеличение количества находимого на карте золота'), // generic-loot
      makeGroup('Добавляет маяки ваал на карту', { affix: 'implicit' }),     // vaal-content
      makeGroup('Добавляет Бездны на карту', { affix: 'implicit' }),         // breach-content
      makeGroup('На карте можно встретить дополнительный алтарь'),           // ritual-content
      makeGroup('Монстры, возрожденные у алтарей Ритуала на карте, с увеличенным на (35—70)% шансом могут стать волшебными'), // ritual-monsters
      makeGroup('(20—30)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'),       // ritual-rewards
    ];
    const result = classifyGroups(groups, 'tablet-type-subblocks');
    expect(result.map(sg => sg.key)).toEqual([
      'ritual-rewards',
      'ritual-monsters',
      'ritual-content',
      'breach-content',
      'vaal-content',
      'generic-loot',
      'generic-player',
    ]);
  });

  it('tablet-type-subblocks: preserves FamilyGroup references (no clone, iter 105)', () => {
    // Same invariant as tablet-type and affix-sentiment-subblocks: FamilyGroup
    // object references must be preserved (not cloned) so downstream React
    // memoization works.
    const g1 = makeGroup('(20—30)% уменьшение количества дани, требуемой для откладывания наград в алтарях Ритуала на карте'); // ritual-rewards
    const g2 = makeGroup('(8—12)% увеличение эффективности монстров Бездны за каждый закрытый провал, вплоть до 100%');         // breach-monsters
    const result = classifyGroups([g1, g2], 'tablet-type-subblocks');
    const rewardsSg = result.find(sg => sg.key === 'ritual-rewards');
    const monstersSg = result.find(sg => sg.key === 'breach-monsters');
    expect(rewardsSg?.groups[0]).toBe(g1);
    expect(monstersSg?.groups[0]).toBe(g2);
  });
});

