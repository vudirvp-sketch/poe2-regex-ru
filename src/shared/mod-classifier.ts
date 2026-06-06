/**
 * Mod Classifier — Semantic classification of mods for UI grouping.
 *
 * Classifies mod family groups into semantic categories based on:
 * 1. Tags from GameToken.tags[] (preferred, available for jewellery/jewel)
 * 2. Text-based heuristics (fallback for waystone/tablet/relic which have no tags)
 *
 * Used by ModList to create semantic sub-groups within prefix/suffix columns.
 */

import type { FamilyGroup, ModOrigin } from './types';
import { t } from './i18n';

// ─── Semantic category types ───

/** Semantic categories for jewellery (amulet/ring/belt) and jewel */
export type SemanticCategory = 'offensive' | 'defensive' | 'attribute' | 'neutral';

/** Sentiment categories for waystones (positive/negative/neutral map mods) */
export type SentimentCategory = 'positive' | 'negative' | 'neutral';

/** Label + color config for display */
export interface CategoryLabel {
  label: string;
  colorClass: string;
}

// ─── Display config ───

export const SEMANTIC_LABELS: Record<SemanticCategory, CategoryLabel> = {
  offensive: { label: 'Атакующие', colorClass: 'text-red-400' },
  defensive: { label: 'Защитные', colorClass: 'text-blue-400' },
  attribute: { label: 'Характеристики', colorClass: 'text-green-400' },
  neutral:   { label: 'Прочие', colorClass: 'text-gray-400' },
};

export const SENTIMENT_LABELS: Record<SentimentCategory, CategoryLabel> = {
  positive: { label: 'Позитивные', colorClass: 'text-green-400' },
  negative: { label: 'Негативные', colorClass: 'text-red-400' },
  neutral:  { label: 'Нейтральные', colorClass: 'text-gray-400' },
};

export const ORIGIN_SECTION_LABELS: Record<ModOrigin, CategoryLabel> = {
  normal:     { label: 'Обычные', colorClass: 'text-gray-300' },
  desecrated: { label: 'Очернённые', colorClass: 'text-purple-400' },
  corrupted:  { label: 'Осквернённые', colorClass: 'text-orange-400' },
  essence:    { label: 'Сущность', colorClass: 'text-yellow-400' },
  breachborn: { label: 'Разлом', colorClass: 'text-cyan-400' },
};

// ─── Tags-based classification (preferred) ───

/** Tags that indicate an offensive mod */
const OFFENSIVE_TAGS = new Set([
  'damage', 'attack', 'critical', 'speed', 'caster', 'minion',
  'physical', 'chaos', 'ailment', 'elemental', 'cold', 'fire',
  'lightning', 'curse',
]);

/** Tags that indicate a defensive mod */
const DEFENSIVE_TAGS = new Set([
  'resistance', 'life', 'mana', 'armour', 'energy_shield', 'charm',
  'evasion',
]);

/** Tags that indicate an attribute mod */
const ATTRIBUTE_TAGS = new Set([
  'attribute',
]);

/**
 * Classify a FamilyGroup using tags[] from its member tokens.
 * Uses majority voting: if most members have a tag from a category, that's the group's category.
 * Returns 'neutral' if no tags match or tags are empty.
 */
export function classifyByTags(group: FamilyGroup): SemanticCategory {
  const tagCounts: Record<SemanticCategory, number> = {
    offensive: 0,
    defensive: 0,
    attribute: 0,
    neutral: 0,
  };

  for (const member of group.members) {
    let classified = false;
    for (const tag of member.tags) {
      if (OFFENSIVE_TAGS.has(tag)) { tagCounts.offensive++; classified = true; break; }
      if (DEFENSIVE_TAGS.has(tag)) { tagCounts.defensive++; classified = true; break; }
      if (ATTRIBUTE_TAGS.has(tag)) { tagCounts.attribute++; classified = true; break; }
    }
    if (!classified) {
      tagCounts.neutral++;
    }
  }

  // Return the category with the highest count
  let maxCategory: SemanticCategory = 'neutral';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(tagCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxCategory = cat as SemanticCategory;
    }
  }

  return maxCategory;
}

// ─── Text-based classification (fallback) ───

/** Keywords indicating an offensive/beneficial mod */
const OFFENSIVE_KEYWORDS = /(?:урон|атак|крит|скорость атаки|сотворени|приспешник|снаряд|уровень.*умени|физическ|стихийн|огн.*чар|ледян.*чар|молни.*чар)/i;

/** Keywords indicating a defensive mod */
const DEFENSIVE_KEYWORDS = /(?:сопр|здоров|максимум.*ман|брон|уклонен|блок|дух|щит|порог оглуш|максимум.*здрав|энерг.*щит)/i;

/** Keywords indicating an attribute mod */
const ATTRIBUTE_KEYWORDS = /(?:к силе|к ловк|к интелл|силе$|ловкост|интеллект)/i;

/**
 * Classify a FamilyGroup using text-based heuristics.
 * Checks the displayText of the group against keyword patterns.
 */
export function classifyByText(group: FamilyGroup): SemanticCategory {
  const text = group.displayText;

  if (ATTRIBUTE_KEYWORDS.test(text)) return 'attribute';
  if (OFFENSIVE_KEYWORDS.test(text)) return 'offensive';
  if (DEFENSIVE_KEYWORDS.test(text)) return 'defensive';

  return 'neutral';
}

// ─── Waystone sentiment classification ───

/** Keywords indicating a positive (beneficial) waystone mod — player benefits */
const POSITIVE_KEYWORDS = /(?:повышен.*редкост|повышен.*количеств|увеличен.*редкост|увеличен.*количеств|повышен.*опыт|увеличен.*опыт|качество|дополнит.*сгустк|шанс.*сгустк|дополнит.*путев|дополнит.*сундук|больше.*опыт|больше.*золот|больше.*путев|больше.*предмет|дополнит.*дух|дополнит.*Бездн|дополнит.*бездн|дополнит.*ларец|дополнит.*Сущност|дополнит.*изгнан|приспешник.*дополнит|приспешник.*урон|Бездны ведут|дополнит.*ритуальн|дополнит.*алтар|Сложность монстров Бездны.*наград|дополнит.*Царевн|Бездн появляется.*редких)/i;

/** Keywords indicating a negative (detrimental) waystone mod — makes the map harder */
const NEGATIVE_KEYWORDS = /(?:увеличен.*урон.*монстр|повышен.*шанс.*крит.*монстр|скорост.*атак.*сотворени.*монстр|сопротивлен.*монстр|больше.*здоровь.*монстр|Дополнительных свойств у редких монстр|проклят|уменьшен.*заряд.*флакон|меньш.*скорост.*пер|обрекаются|максимум.*сопротивлен.*игрок|меньш.*скорост.*перезарядк|вытягивающ.*ман|замерзш.*земл|заряжен.*земл|монстр.*имел.*повышен|монстр.*имеют.*повышен|увеличен.*эффективн.*монстр|увеличен.*размер.*групп.*монстр|уменьшен.*размер.*групп|Монстры бронирован|Монстры уклончив|Монстры получают.*дополнительного|Монстры с.*шансом.*могут наложить|Монстры имеют.*увеличен.*порог|Монстры разрушают|Меткость монстров|Монстры имеют.*увеличен.*накоплен|усилен.*наложен.*состоян.*монстр|Монстры выпускают.*снаряд|Монстры имеют.*увеличен.*област|подожженн.*земл|Урон монстров пробивает|Монстры получают.*уменьшен.*дополнительн|накладывают.*лиан|Игроки получают уменьшен|восстановлен.*здоровь.*меньш|пожирают душ)/i;

/**
 * Classify a FamilyGroup into sentiment category (for waystones).
 * Positive = beneficial for the player, Negative = makes the map harder.
 */
export function classifyWaystoneSentiment(group: FamilyGroup): SentimentCategory {
  const text = group.displayText;

  if (POSITIVE_KEYWORDS.test(text)) return 'positive';
  if (NEGATIVE_KEYWORDS.test(text)) return 'negative';

  return 'neutral';
}

// ─── Tablet type classification ───

/** Tablet type categories based on which content the mod affects */
export type TabletTypeCategory = 'ritual' | 'breach' | 'delirium' | 'vaal' | 'expedition' | 'generic';

export const TABLET_TYPE_LABELS: Record<TabletTypeCategory, CategoryLabel> = {
  ritual:     { label: 'Ритуал', colorClass: 'text-red-400' },
  breach:     { label: 'Бездна', colorClass: 'text-purple-400' },
  delirium:   { label: 'Делириум', colorClass: 'text-blue-400' },
  vaal:       { label: 'Ваал', colorClass: 'text-orange-400' },
  expedition: { label: 'Экспедиция', colorClass: 'text-green-400' },
  generic:    { label: 'Общие', colorClass: 'text-gray-400' },
};

/** Keywords indicating a Ritual tablet mod */
const RITUAL_KEYWORDS = /(?:ритуал|алтар|дани|жертв)/i;

/** Keywords indicating a Breach tablet mod */
const BREACH_KEYWORDS = /(?:бездн|бездн.|провал|нестабильн.*бездн)/i;

/** Keywords indicating a Delirium tablet mod */
const DELIRIUM_KEYWORDS = /(?:делириум|делириума|делириумом|зеркал|симулякр)/i;

/** Keywords indicating a Vaal tablet mod */
const VAAL_KEYWORDS = /(?:ваал|маяк)/i;

/** Keywords indicating an Expedition tablet mod */
const EXPEDITION_KEYWORDS = /(?:экспедици|руническ|взрывчатк|реликт.*экспедици|артефакт.*экспедици)/i;

/**
 * Classify a FamilyGroup into tablet type category.
 * Based on text heuristics — tablet tokens have no tags.
 */
export function classifyTabletType(group: FamilyGroup): TabletTypeCategory {
  const text = group.displayText;

  // Check specific types first (more specific → less specific order)
  if (EXPEDITION_KEYWORDS.test(text)) return 'expedition';
  if (RITUAL_KEYWORDS.test(text)) return 'ritual';
  if (BREACH_KEYWORDS.test(text)) return 'breach';
  if (DELIRIUM_KEYWORDS.test(text)) return 'delirium';
  if (VAAL_KEYWORDS.test(text)) return 'vaal';

  return 'generic';
}

// ─── Jewel type classification ───

/** Jewel type categories based on which jewel type the mod is associated with */
export type JewelTypeCategory = 'ruby' | 'emerald' | 'sapphire' | 'shared';

export const JEWEL_TYPE_LABELS: Record<JewelTypeCategory, CategoryLabel> = {
  ruby:     { label: 'Рубин', colorClass: 'text-red-400' },
  emerald:  { label: 'Изумруд', colorClass: 'text-green-400' },
  sapphire: { label: 'Сапфир', colorClass: 'text-blue-400' },
  shared:   { label: 'Общие', colorClass: 'text-gray-400' },
};

/**
 * Jewel type classification — weighted keyword scoring.
 *
 * Cross-validated against poe2db.tw Modifier Calculator pages:
 *   https://poe2db.tw/ru/Ruby#ModifiersCalc
 *   https://poe2db.tw/ru/Emerald#ModifiersCalc
 *   https://poe2db.tw/ru/Sapphire#ModifiersCalc
 *
 * Previous approach used simple regex OR-groups which caused many mismatches
 * because keywords like "поджог", "шок", "ман" appear in multiple jewel types.
 * The new approach scores each type independently and picks the highest-scoring
 * type when one dominates, or 'shared' when scores are tied/low.
 */

/** Keyword → weight pairs for Ruby jewel mods (fire, bleed, physical, maces, rage, thorns, totems, warcries, banners, presence, armour, stuns) */
const RUBY_SCORES: [RegExp, number][] = [
  // Fire (unique to Ruby — Sapphire has cold, not fire)
  [/(?:урон.*огн|пробива.*сопротивлен.*огн)/i, 3],
  [/сопротивлен.*огн/i, 1],           // also appears in other types via shared resist mods
  [/максимальн.*сопротивлен.*огн/i, 2],
  [/сил[ауеы].*поджог|увеличен.*силы.*поджог/i, 3],  // ignite strength — Ruby specific
  [/длительн.*поджог/i, 2],           // ignite duration — Ruby+Sapphire, lower weight
  // Bleed (unique to Ruby)  // NOTE: generic /поджог/ w=1 removed — subsumed by [длительн.*поджог] w=2 and [сил.*поджог] w=3
  [/(?:сил[ауе].*кровотеч|длительн.*кровотеч|шанс.*наложить.*кровотеч)/i, 3],
  [/кровотеч/i, 1],

  // Armour (unique to Ruby)
  [/(?:повышен.*брон|разруш.*брон|длительн.*разруш|количеств.*разруш)/i, 3],
  [/брон[ию]/i, 1],
  [/(?:брони.*уклонен.*энерг.*щит.*щит|брон.*уклонен.*энерг.*щит.*щит)/i, 4],

  // Maces (unique to Ruby)
  [/булав[амии]/i, 3],

  // Block (unique to Ruby)
  [/шанс.*блок/i, 3],

  // Rage (unique to Ruby)
  [/(?:свирепост|максимум.*свирепост|Дарует.*свирепост)/i, 3],

  // Thorns (unique to Ruby)
  [/(?:шипам|урон.*шипам)/i, 3],

  // Totems (unique to Ruby)
  [/(?:тотем|здоровь.*тотем|скорост.*установк.*тотем)/i, 3],

  // Warcries (unique to Ruby)
  [/(?:боев.*клич|усилен.*положительн.*эффект.*боев.*клич|скорост.*перезарядк.*боев.*клич|скорость.*перезарядк.*боев.*клич|скорост.*применен.*боев.*клич|скорость.*применен.*боев.*клич|урон.*боев.*клич)/i, 3],
  [/боев.*клич/i, 2],

  // Banners (unique to Ruby)
  [/(?:знамён|област.*действ.*знамён|скорост.*накоплен.*славы.*знамён|скорость.*накоплен.*славы.*знамён|длительн.*знамён)/i, 3],

  // Presence (Ruby+Sapphire — Ruby has area, Sapphire has curse area)
  [/присутстви/i, 1],                  // lowered — appears in both Ruby and Sapphire

  // Aura strength (Ruby specific)
  [/сил.*аур/i, 2],

  // Melee damage (unique to Ruby)
  [/урон.*ближн.*бо/i, 2],

  // Physical damage (unique to Ruby)
  [/глобальн.*физическ.*урон|физическ.*урон/i, 2],

  // Stun (unique to Ruby — but Emerald has parry stun threshold)
  [/(?:скорост.*накоплен.*шкалы.*оглушен|скорость.*накоплен.*шкалы.*оглушен)/i, 3],
  [/оглушен/i, 1],          // generic — covers stun threshold + stun speed + parry stun

  // Leech health (unique to Ruby)
  [/(?:похищен.*здоровь|количеств.*похищен.*здоровь)/i, 2],
  [/скорост.*регенерац.*здоровь/i, 2],

  // Knockback (unique to Ruby)
  [/дистанц.*отбрасыван|отбрасыван/i, 2],

  // Split (Разрез) — Ruby unique
  [/Разрез/i, 3],

  // Ritual (Ruby unique)
  [/Ритуал/i, 3],

  // Upgraded attacks (Ruby unique)
  [/Улучшенн.*атак/i, 3],

  // Health from mana cost (Ruby)
  [/стоимости.*умений.*мане.*берется.*здоровь/i, 3],

  // Minion area/health (Ruby specific — Emerald has companion, Sapphire has spell minions)
  [/приспешник.*област.*действ/i, 2],
  [/приспешник.*максимум.*здоровь/i, 2],   // Ruby has this too

  // Damage while transformed (Ruby)
  [/урон.*будучи.*превращен/i, 1],          // appears in all 3

  // Bleed strength (Ruby specific — not just "кровотеч" but "силы кровотечения")
  [/сил[ауе].*накладываем.*кровотеч|увеличен.*силы.*кровотеч/i, 3],

  // NOTE: armour break removed — subsumed by [разруш.*брон] w=3 above

  // Combustibility (Ruby — but Sapphire also has it)
  [/сил.*Горючест/i, 1],   // low weight since it appears in both Ruby and Sapphire
];

/** Keyword → weight pairs for Emerald jewel mods (lightning, accuracy, attack speed, projectiles, bows/crossbows/staves/spears, parry, sentinel, flasks, poison) */
const EMERALD_SCORES: [RegExp, number][] = [
  // Lightning (unique to Emerald)
  [/(?:урон.*молни|пробива.*сопротивлен.*молни)/i, 3],
  [/сопротивлен.*молни/i, 1],
  [/максимальн.*сопротивлен.*молни/i, 2],

  // Shock (Emerald specific — strength/duration)
  [/сил.*шок/i, 3],
  [/длительн.*шок/i, 2],
  [/шанс.*наложен.*шок/i, 1],

  // Accuracy (unique to Emerald)
  [/(?:меткост|повышен.*глобальн.*меткост|меткост.*лукам)/i, 3],

  // Attack speed (unique to Emerald)
  [/скорост.*атак/i, 2],

  // Projectiles (Emerald specific)
  [/(?:снаряд|скорост.*снаряд|дополнит.*снаряд.*разветвлен|шанс.*выпустить.*дополнит.*снаряд)/i, 2],
  [/пронзить|шанс.*пронзить/i, 2],
  [/цепи.*окруж/i, 2],

  // Bows (unique to Emerald)
  [/лукам/i, 2],

  // Crossbows (unique to Emerald)
  [/(?:самострел|скорост.*перезарядк.*самострел)/i, 3],

  // Staves (unique to Emerald)
  [/боев.*посох/i, 2],

  // Spears (unique to Emerald)
  [/копь[яюей]/i, 2],

  // Daggers (Emerald)
  [/кинджал/i, 2],

  // Parry (unique to Emerald)
  [/(?:Парирован|длительн.*Парирован|урон.*Парирован|порог.*оглушен.*парир)/i, 3],

  // Sentinel (unique to Emerald)
  [/(?:оберег|длительн.*оберег|заряд.*оберег)/i, 3],

  // Companions (unique to Emerald)
  [/(?:компаньон|максимум.*здоровь.*компаньон)/i, 3],

  // Minions (unique to Emerald — companion type)
  [/помехам|урон.*помехам/i, 2],

  // Flasks (unique to Emerald)
  [/(?:флакон|заряд.*флакон|длительн.*флакон|восстановлен.*здоровь.*флакон|восстановлен.*ман.*флакон|заряд.*флакон.*здоровь|заряд.*флакон.*ман|восстановлен.*здоровь.*флакон|восстановлен.*ман.*флакон)/i, 2],

  // Blind (Emerald+Ruby — Emerald has the main blind mods)
  [/(?:ослеплен|усилен.*ослеплен|шанс.*ослепить|Ослепля.*враг)/i, 2],

  // Herald (Emerald specific)
  [/Вестник/i, 3],

  // Poison (Emerald specific)
  [/(?:отравлен|сил.*отравлен|шанс.*отравить|длительн.*яд)/i, 2],

  // Pin (Emerald specific)
  [/пригвожден|скорост.*накоплен.*шкалы.*пригвожден/i, 3],

  // Mark skills (Emerald specific)
  [/метк.*умени|умени.*метк/i, 2],

  // Movement speed (Emerald specific)
  [/скорост.*передвижен/i, 2],

  // Quiver (Emerald specific)
  [/колчан/i, 3],

  // Evasion (Emerald specific)
  [/уклонен/i, 2],

  // Attack crit (Emerald specific)
  [/шанс.*крит.*удар.*атак|крит.*удар.*атак/i, 2],
  [/бонус.*крит.*урон.*атак/i, 2],

  // Skill recharge speed (Emerald)
  [/скорост.*перезарядк.*умени/i, 2],

  // Damage vs rare/unique (Emerald)
  [/урон.*удар.*редк.*уникальн/i, 2],

  // Damage with plants (Emerald)
  [/урон.*умениями.*растен/i, 2],

  // Elemental ailment threshold (Emerald)
  [/порог.*стихийн.*состоян/i, 2],

  // Skill duration for marks (Emerald)
  [/длительн.*эффект.*умени.*метк|увеличен.*длительн.*эффект.*умени.*метк/i, 3],

  // Stun threshold if not stunned (Emerald)
  [/порог.*оглушен.*недавно.*не.*были.*оглушен/i, 3],

  // NOTE: stun threshold at parry removed — already inside Парирован alternation above

  // Mana from flasks (Emerald — but "ман" triggers Sapphire)
  [/восстановлен.*ман.*флакон|количеств.*похищен.*ман/i, 3],

  // Vulnerability / Expose (Emerald+Ruby combo mod)
  [/Накладывает восприимчивость|Изнуряет/i, 2],

  // NOTE: conditional melee↔projectile damage removed — subsumed by снаряд rules above
];

/** Keyword → weight pairs for Sapphire jewel mods (cold, curses, energy shield, spells, mana, offerings, minions, chaos) */
const SAPPHIRE_SCORES: [RegExp, number][] = [
  // Cold (unique to Sapphire)
  [/(?:холод|урон.*холод|пробива.*сопротивлен.*холод)/i, 3],
  // NOTE: generic cold resist removed — subsumed by [холод|урон.*холод|пробива.*сопротивлен.*холод] w=3

  // Chill/Freeze (unique to Sapphire)
  [/(?:охлажден|длительн.*охлажден|заморозк|скорост.*накоплен.*заморозк|порог.*заморозк)/i, 3],

  // Curses (unique to Sapphire)
  [/(?:прокляти|област.*действ.*прокляти|сил.*прокляти|длительн.*прокляти|скорост.*активаци.*прокляти)/i, 3],

  // Energy shield (unique to Sapphire)
  [/(?:энергетическ.*щит|максимум.*энергетическ.*щит|перезарядк.*энергетическ.*щит|ускорен.*начал.*перезарядк.*энергетическ.*щит|энергетическ.*щит.*фокус|дополнит.*порог.*энергетическ.*щит)/i, 3],

  // Spells (unique to Sapphire)
  [/(?:чар[ыуе].*умени|урон.*чар|Срабатывающ.*чар|скорост.*сотворени.*чар)/i, 3],

  // Mana (Sapphire — NOT flask mana which is Emerald)
  [/максимум.*ман|скорост.*регенерац.*ман|ман.*вместо.*здоровь|получаем.*урон.*берет.*ман/i, 2],
  [/похищен.*ман(?!.*флакон)/i, 2],  // mana leech but NOT from flasks

  // Offerings (unique to Sapphire)
  [/(?:подношен|максимум.*здоровь.*подношен|длительн.*подношен)/i, 3],

  // Minion specific (Sapphire — spell-type minions)
  [/приспешник.*дополнит.*уменьшен/i, 2],
  [/приспешник.*сопротивлен.*хаос/i, 3],
  [/приспешник.*сопротивлен.*стихи/i, 3],
  [/приспешник.*шанс.*крит/i, 2],
  [/бонус.*крит.*приспешник|крит.*урон.*приспешник/i, 2],
  [/приспешник.*воскреш/i, 3],
  [/приспешник.*урон/i, 2],
  [/приспешник.*максимум.*здоровь/i, 1],   // shared with Ruby

  // Meta-skills (unique to Sapphire)
  [/Мета-умени/i, 3],

  // Chaos (unique to Sapphire)
  [/(?:хаосом|урон.*хаосом|сопротивлен.*хаос|максимальн.*сопротивлен.*хаос)/i, 2],

  // Depletion (unique to Sapphire)
  [/сил.*Истощен/i, 3],

  // Breach (unique to Sapphire — from desecrated mods)
  [/Бездн/i, 2],

  // Vulnerability effect (Sapphire)
  [/эффект.*восприимчивост/i, 2],

  // Life/mana on kill (Sapphire)
  [/восстанавливает.*здоровь.*убийств/i, 2],
  [/восстанавливает.*ман.*убийств/i, 2],
  [/получен.*урон.*восполня.*здоровь/i, 2],

  // Spell crit (Sapphire specific)
  [/шанс.*крит.*удар.*чар|крит.*удар.*чар/i, 2],
  [/бонус.*крит.*урон.*чар/i, 2],

  // Generic crit (Sapphire — only for mods WITHOUT weapon-specific suffix like "атаками")
  // Narrowed from /повышен.*шанс.*критического удара/ to avoid conflict with Emerald attack-crit
  [/повышен.*шанс.*критического удара(?!.*атак)/i, 2],
  [/увеличен.*бонус.*крит.*урон(?!.*атак)/i, 2],

  // Corpse consumption (Sapphire)
  [/поглотил.*труп|поглотить.*труп/i, 2],

  // Spell cast speed for marks (Sapphire shares with Emerald)
  [/скорост.*сотворени.*чар.*метк|метк.*скорост.*сотворени/i, 1],

  // NOTE: minion resist all removed — exact duplicate of [приспешник.*сопротивлен.*стихи] w=3 above

  // Area of effect for presence (Sapphire — shared with Ruby)
  [/област.*действ.*присутстви/i, 1],

  // NOTE: stun/state threshold from ES removed — subsumed by [дополнит.*порог.*энергетическ.*щит] w=3 above
];

/**
 * Classify a FamilyGroup into jewel type category.
 *
 * Uses weighted keyword scoring: each type's keyword list is tested against
 * the display text, accumulating a score. The type with the highest score
 * wins if it exceeds a minimum threshold and has a clear margin over #2.
 * Otherwise the mod is classified as 'shared'.
 *
 * This approach handles the overlap between jewel type pools better than
 * simple regex OR-groups (e.g., "поджог" appears in Ruby AND Sapphire,
 * "шок" appears in Emerald AND Sapphire, "ман" in Sapphire AND Emerald).
 */
export function classifyJewelType(group: FamilyGroup): JewelTypeCategory {
  const text = group.displayText;

  let rubyScore = 0;
  let emeraldScore = 0;
  let sapphireScore = 0;

  for (const [regex, weight] of RUBY_SCORES) {
    if (regex.test(text)) rubyScore += weight;
  }
  for (const [regex, weight] of EMERALD_SCORES) {
    if (regex.test(text)) emeraldScore += weight;
  }
  for (const [regex, weight] of SAPPHIRE_SCORES) {
    if (regex.test(text)) sapphireScore += weight;
  }

  // Find the best score
  const scores: [JewelTypeCategory, number][] = [
    ['ruby', rubyScore],
    ['emerald', emeraldScore],
    ['sapphire', sapphireScore],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  const [best, bestScore] = scores[0];
  const [, secondScore] = scores[1];

  // Need minimum score of 2 and clear margin (>=2 points ahead of second)
  // to classify as a specific type. Otherwise → shared.
  if (bestScore >= 2 && bestScore - secondScore >= 2) {
    return best;
  }

  // Relaxed threshold: if best >= 3 and margin >= 1, accept
  // This helps mods like warcry/banners that score high but only barely lead
  if (bestScore >= 3 && bestScore - secondScore >= 1) {
    return best;
  }

  // If best score is exactly tied with another → shared
  // If no type scored at all → shared
  return 'shared';
}

// ─── Unified classification ───

/** Grouping mode determines how mods are sub-categorized within affix columns */
export type ModGroupMode =
  | 'affix-semantic'    // prefix/suffix → offensive/defensive/attribute/neutral (amulet, ring, belt)
  | 'affix-sentiment'   // prefix/suffix → positive/negative/neutral (waystone)
  | 'affix-only'        // just prefix/suffix, no sub-groups (relic)
  | 'tablet-type'       // prefix/suffix → ritual/breach/delirium/vaal/expedition/generic (tablet)
  | 'origin'            // by origin: normal/desecrated/corrupted (jewel)
  | 'jewel-type';       // by jewel type: ruby/emerald/sapphire/shared (within jewel origin sections)

/**
 * Sub-group within an affix column.
 * Each sub-group has a label, color, and list of family groups.
 */
export interface ModSubGroup {
  key: string;
  label: string;
  colorClass: string;
  groups: FamilyGroup[];
}

/**
 * Classify family groups into sub-groups based on the grouping mode.
 *
 * @param groups - Family groups for one affix column (all prefix or all suffix)
 * @param mode - The grouping mode
 * @returns Array of sub-groups, each with a label and filtered family groups
 */
export function classifyGroups(
  groups: FamilyGroup[],
  mode: ModGroupMode
): ModSubGroup[] {
  if (mode === 'affix-only') {
    // No sub-grouping — all groups in one "flat" sub-group
    return [{
      key: 'all',
      label: '',
      colorClass: '',
      groups,
    }];
  }

  if (mode === 'affix-semantic') {
    // Check if groups have tags (prefer tags over text)
    const hasTags = groups.some(g => g.members.some(m => m.tags.length > 0));

    const classified = new Map<SemanticCategory, FamilyGroup[]>();
    const order: SemanticCategory[] = ['offensive', 'defensive', 'attribute', 'neutral'];

    for (const group of groups) {
      const category = hasTags ? classifyByTags(group) : classifyByText(group);
      const list = classified.get(category) || [];
      list.push(group);
      classified.set(category, list);
    }

    return order
      .filter(cat => classified.has(cat) && classified.get(cat)!.length > 0)
      .map(cat => ({
        key: cat,
        label: SEMANTIC_LABELS[cat].label,
        colorClass: SEMANTIC_LABELS[cat].colorClass,
        groups: classified.get(cat)!,
      }));
  }

  if (mode === 'affix-sentiment') {
    const classified = new Map<SentimentCategory, FamilyGroup[]>();
    const order: SentimentCategory[] = ['positive', 'negative', 'neutral'];

    for (const group of groups) {
      const category = classifyWaystoneSentiment(group);
      const list = classified.get(category) || [];
      list.push(group);
      classified.set(category, list);
    }

    return order
      .filter(cat => classified.has(cat) && classified.get(cat)!.length > 0)
      .map(cat => ({
        key: cat,
        label: SENTIMENT_LABELS[cat].label,
        colorClass: SENTIMENT_LABELS[cat].colorClass,
        groups: classified.get(cat)!,
      }));
  }

  if (mode === 'tablet-type') {
    const classified = new Map<TabletTypeCategory, FamilyGroup[]>();
    const order: TabletTypeCategory[] = ['ritual', 'breach', 'delirium', 'vaal', 'expedition', 'generic'];

    for (const group of groups) {
      const category = classifyTabletType(group);
      const list = classified.get(category) || [];
      list.push(group);
      classified.set(category, list);
    }

    return order
      .filter(cat => classified.has(cat) && classified.get(cat)!.length > 0)
      .map(cat => ({
        key: cat,
        label: TABLET_TYPE_LABELS[cat].label,
        colorClass: TABLET_TYPE_LABELS[cat].colorClass,
        groups: classified.get(cat)!,
      }));
  }

  if (mode === 'origin') {
    // Group by the dominant origin of the family group's members
    const classified = new Map<ModOrigin, FamilyGroup[]>();
    const originOrder: ModOrigin[] = ['normal', 'desecrated', 'corrupted', 'essence', 'breachborn'];

    for (const group of groups) {
      // Determine the group's origin from its members
      const origins = new Set(group.members.map(m => m.origin));
      // Use the first non-normal origin if any, otherwise 'normal'
      const origin = [...origins].find(o => o !== 'normal') ?? 'normal';
      const list = classified.get(origin) || [];
      list.push(group);
      classified.set(origin, list);
    }

    return originOrder
      .filter(origin => classified.has(origin) && classified.get(origin)!.length > 0)
      .map(origin => ({
        key: origin,
        label: ORIGIN_SECTION_LABELS[origin]?.label ?? t('origin.' + origin),
        colorClass: ORIGIN_SECTION_LABELS[origin]?.colorClass ?? 'text-gray-400',
        groups: classified.get(origin)!,
      }));
  }

  if (mode === 'jewel-type') {
    // Group by jewel type category (ruby/emerald/sapphire/shared)
    const classified = new Map<JewelTypeCategory, FamilyGroup[]>();
    const order: JewelTypeCategory[] = ['ruby', 'emerald', 'sapphire', 'shared'];

    for (const group of groups) {
      const category = classifyJewelType(group);
      const list = classified.get(category) || [];
      list.push(group);
      classified.set(category, list);
    }

    return order
      .filter(cat => classified.has(cat) && classified.get(cat)!.length > 0)
      .map(cat => ({
        key: cat,
        label: JEWEL_TYPE_LABELS[cat].label,
        colorClass: JEWEL_TYPE_LABELS[cat].colorClass,
        groups: classified.get(cat)!,
      }));
  }

  // Fallback
  return [{ key: 'all', label: '', colorClass: '', groups }];
}
