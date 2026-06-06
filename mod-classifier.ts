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
  [/сил[ауе].*поджог/i, 3],           // ignite strength — Ruby specific
  [/длительн.*поджог/i, 2],           // ignite duration — Ruby+Sapphire, lower weight
  [/поджог/i, 1],                      // generic ignite mention

  // Bleed (unique to Ruby)
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
  [/(?:боев.*крич|усилен.*положительн.*эффект.*боев.*крич|скорост.*перезарядк.*боев.*крич|скорость.*перезарядк.*боев.*крич|скорост.*применен.*боев.*крич|скорость.*применен.*боев.*крич|урон.*боев.*крич)/i, 3],
  [/боев.*крич/i, 2],

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
  [/порог.*оглушен/i, 1],   // shared with Emerald (parry stun threshold)
  [/оглушен/i, 1],          // very generic

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

  // Armour break (Ruby specific)
  [/урон.*по.*враг.*разрушен.*брон/i, 3],

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

  // Stun threshold at parry (Emerald specific — but "оглушен" triggers Ruby)
  [/порог.*оглушен.*парир/i, 3],

  // Mana from flasks (Emerald — but "ман" triggers Sapphire)
  [/восстановлен.*ман.*флакон|количеств.*похищен.*ман/i, 3],

  // Vulnerability / Expose (Emerald+Ruby combo mod)
  [/Накладывает восприимчивость|Изнуряет/i, 2],

  // Damage if recently hit in melee then projectiles (Emerald)
  [/урон.*снарядами.*если.*ближн.*бо/i, 2],
  [/урон.*ближн.*бо.*если.*снаряд/i, 2],

  // Mana from flasks (Emerald)
  [/восстановлен.*ман.*флакон/i, 2],
];

/** Keyword → weight pairs for Sapphire jewel mods (cold, curses, energy shield, spells, mana, offerings, minions, chaos) */
const SAPPHIRE_SCORES: [RegExp, number][] = [
  // Cold (unique to Sapphire)
  [/(?:холод|урон.*холод|пробива.*сопротивлен.*холод)/i, 3],
  [/сопротивлен.*холод/i, 1],
  [/максимальн.*сопротивлен.*холод/i, 2],

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
  [/приспешник.*скорост.*атак.*сотворени/i, 2],
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

  // Generic crit (Sapphire)
  [/повышен.*шанс.*критического удара/i, 2],
  [/увеличен.*бонус.*крит.*урон(?!.*атак)/i, 2],

  // Corpse consumption (Sapphire)
  [/поглотил.*труп|поглотить.*труп/i, 2],

  // Spell cast speed for marks (Sapphire shares with Emerald)
  [/скорост.*сотворени.*чар.*метк|метк.*скорост.*сотворени/i, 1],

  // Minion resist all (Sapphire)
  [/приспешник.*сопротивлен.*стих/i, 2],

  // Area of effect for presence (Sapphire — shared with Ruby)
  [/област.*действ.*присутстви/i, 1],

  // Stun threshold from energy shield (Sapphire)
  [/порог.*оглушен.*максимум.*энергетическ/i, 3],
  [/порог.*состоян.*максимум.*энергетическ/i, 3],
];

// ─── Static jewel type lookup (poe2db-verified) ───

/**
 * Static lookup table mapping familyKey.ru → JewelTypeCategory.
 *
 * Cross-validated against poe2db.tw Modifier Calculator pages for
 * Ruby, Emerald, and Sapphire jewels. This provides definitive classification
 * for all known mods, avoiding heuristic misclassifications.
 *
 * Source: https://poe2db.tw/ru/Ruby#ModifiersCalc
 *        https://poe2db.tw/ru/Emerald#ModifiersCalc
 *        https://poe2db.tw/ru/Sapphire#ModifiersCalc
 */
const JEWEL_TYPE_LOOKUP: Record<string, JewelTypeCategory> = {
  // Ruby — fire, bleed, armour, maces, block, rage, thorns, totems, warcries, banners, melee, physical, stun
  '#% повышение брони': 'ruby',
  '#% повышение скорости атаки без оружия': 'ruby',
  '#% повышение скорости атаки топорами': 'ruby',
  '#% повышение скорости накопления славы для умений знамён': 'ruby',
  '#% повышение скорости накопления шкалы оглушения': 'ruby',
  '#% повышение скорости накопления шкалы оглушения булавами': 'ruby',
  '#% повышение скорости перезарядки боевых кличей': 'ruby',
  '#% повышение скорости применения боевых кличей': 'ruby',
  '#% повышение скорости регенерации здоровья': 'ruby',
  '#% повышение скорости установки тотемов': 'ruby',
  '#% увеличение брони, уклонения и энергетического щита от щита в руках': 'ruby',
  '#% увеличение глобального физического урона': 'ruby',
  '#% увеличение дистанции отбрасывания': 'ruby',
  '#% увеличение длительности кровотечения': 'ruby',
  '#% увеличение длительности разрушения брони': 'ruby',
  '#% увеличение длительности умений знамён': 'ruby',
  '#% увеличение здоровья тотема': 'ruby',
  '#% увеличение количества похищенного здоровья': 'ruby',
  '#% увеличение количества разрушаемой брони': 'ruby',
  '#% увеличение порога оглушения': 'ruby',
  '#% увеличение силы накладываемого вами кровотечения': 'ruby',
  '#% увеличение силы умений аур': 'ruby',
  '#% увеличение урона атаками без оружия': 'ruby',
  '#% увеличение урона боевыми кличами': 'ruby',
  '#% увеличение урона в ближнем бою': 'ruby',
  '#% увеличение урона кистенями': 'ruby',
  '#% увеличение урона от огня': 'ruby',
  '#% увеличение урона по врагам с полностью разрушенной бронёй': 'ruby',
  '#% увеличение урона топорами': 'ruby',
  '#% увеличение урона тотемов': 'ruby',
  '#% увеличение урона шипами': 'ruby',
  '#% увеличение шанса блока': 'ruby',
  '#% увеличение шанса критического удара кистенями': 'ruby',
  '#% увеличение шанса наложения кровотечения': 'ruby',
  '#% усиление положительного эффекта боевого клича': 'ruby',
  '#% стоимости умений в мане берется из здоровья': 'ruby',
  '+# к максимуму свирепости': 'ruby',
  '+#% к максимальному сопротивлению огню': 'ruby',
  'Дарует # свирепости при нанесении удара в ближнем бою': 'ruby',
  'Дарует # свирепости при получении удара от врага': 'ruby',
  'Приспешники имеют #% дополнительного уменьшения получаемого физического урона': 'ruby',
  'Приспешники имеют #% увеличение максимума здоровья': 'ruby',
  'Приспешники имеют #% увеличение области действия': 'ruby',
  'Удары атаками с #% шансом могут наложить Разрез': 'ruby',
  'Улучшенные атаки наносят увеличенный на #% урон': 'ruby',
  'Урон пробивает #% сопротивления огню': 'ruby',
  '#% шанс наложить кровотечение при нанесении удара': 'ruby',
  '#% увеличение области действия умений знамён': 'ruby',

  // Emerald — lightning, shock, accuracy, attack speed, projectiles, bows, crossbows, staves, spears, daggers, parry, sentinel, companions, flasks, blind, herald, poison, pin, marks, movement, quiver, evasion, attack crit
  '#% ослабление влияния замедления от отрицательных эффектов на вас': 'emerald',
  '#% повышение глобальной меткости': 'emerald',
  '#% повышение меткости луками': 'emerald',
  '#% повышение меткости приспешников': 'emerald',
  '#% повышение скорости атаки': 'emerald',
  '#% повышение скорости атаки боевыми посохами': 'emerald',
  '#% повышение скорости атаки кинжалами': 'emerald',
  '#% повышение скорости атаки копьями': 'emerald',
  '#% повышение скорости атаки луками': 'emerald',
  '#% повышение скорости атаки самострелами': 'emerald',
  '#% повышение скорости атаки мечами': 'emerald',
  '#% повышение скорости броска ловушки': 'emerald',
  '#% повышение скорости накопления шкалы пригвождения': 'emerald',
  '#% повышение скорости передвижения': 'emerald',
  '#% повышение скорости перезарядки самострела': 'emerald',
  '#% повышение скорости перезарядки умений': 'emerald',
  '#% повышение скорости снарядов': 'emerald',
  '#% увеличение бонуса к критическому урону копьями': 'emerald',
  '#% увеличение бонусов, полученных от надетого колчана': 'emerald',
  '#% увеличение восстановления здоровья от флаконов': 'emerald',
  '#% увеличение восстановления маны от флаконов': 'emerald',
  '#% увеличение длительности поджога, шока и охлаждения на врагах': 'emerald',
  '#% увеличение длительности эффекта оберега': 'emerald',
  '#% увеличение длительности эффекта Парирован': 'emerald',
  '#% увеличение длительности эффекта флакона': 'emerald',
  '#% увеличение длительности яда': 'emerald',
  '#% увеличение количества получаемых зарядов оберегов': 'emerald',
  '#% увеличение количества получаемых зарядов флакона': 'emerald',
  '#% увеличение количества получаемых зарядов флакона здоровья': 'emerald',
  '#% увеличение количества получаемых зарядов флакона маны': 'emerald',
  '#% увеличение количества похищенной маны': 'emerald',
  '#% увеличение максимума здоровья компаньонов': 'emerald',
  '#% увеличение порога оглушения если недавно вы не были оглушены': 'emerald',
  '#% увеличение порога оглушения при парировании': 'emerald',
  '#% увеличение порога стихийных состояний': 'emerald',
  '#% увеличение силы накладываемого вами отравления': 'emerald',
  '#% увеличение уклонения': 'emerald',
  '#% увеличение урона боевыми посохами': 'emerald',
  '#% увеличение урона в ближнем бою, если за последние восемь секунд вы наносили удар снарядами атак': 'emerald',
  '#% увеличение урона кинжалами': 'emerald',
  '#% увеличение урона копьями': 'emerald',
  '#% увеличение урона луками': 'emerald',
  '#% увеличение урона мечами': 'emerald',
  '#% увеличение урона от ловушек': 'emerald',
  '#% увеличение урона от молнии': 'emerald',
  '#% увеличение урона от ударов по редким и уникальным врагам': 'emerald',
  '#% увеличение урона помехами': 'emerald',
  '#% увеличение урона самострелами': 'emerald',
  '#% увеличение урона снарядами, если за последние восемь секунд вы наносили удар в ближнем бою': 'emerald',
  '#% увеличение урона снарядов': 'emerald',
  '#% увеличение шанса отравить': 'emerald',
  '#% усиление эффекта ослепления': 'emerald',
  '#% шанс наложения оцепенения при нанесении удара': 'emerald',
  '#% шанс ослепить врагов при нанесении удара атаками': 'emerald',
  '#% шанс отравить при нанесении удара': 'emerald',
  '#% шанс пронзить врага': 'emerald',
  '+#% к максимальному сопротивлению молнии': 'emerald',
  'Компаньоны наносят увеличенный на #% урон': 'emerald',
  'Снаряды имеют #% шанс выпустить дополнительный снаряд при разветвлении': 'emerald',
  'Снаряды с #% шансом могут ударить по цепи при столкновении с окружающей средой': 'emerald',
  'Умения Вестников наносят увеличенный на #% урон': 'emerald',
  'Умения метки имеют #% повышение скорости сотворения чар': 'emerald',
  'Урон пробивает #% сопротивления молнии': 'emerald',
  '#% увеличение шанса критического удара кинжалами': 'emerald',

  // Sapphire — cold, chill, freeze, curses, energy shield, spells, mana, offerings, minion spell, meta, chaos, depletion, breach
  '#% от получаемого урона берется сначала из маны вместо здоровья': 'sapphire',
  '#% повышение скорости перезарядки энергетического щита': 'sapphire',
  '#% повышение скорости регенерации маны': 'sapphire',
  '#% повышение скорости сотворения чар': 'sapphire',
  '#% повышение скорости накопления шкалы заморозки': 'sapphire',
  '#% повышение шанса критического удара для чар': 'sapphire',
  '#% увеличение бонуса к критическому урону от чар': 'sapphire',
  '#% увеличение бонуса к критическому урону приспешников': 'sapphire',
  '#% увеличение длительности охлаждения на врагах': 'sapphire',
  '#% увеличение длительности проклятий': 'sapphire',
  '#% увеличение длительности умений подношений': 'sapphire',
  '#% увеличение максимума здоровья подношений': 'sapphire',
  '#% увеличение максимума энергетического щита': 'sapphire',
  '#% увеличение области действия проклятий': 'sapphire',
  '#% увеличение порога заморозки': 'sapphire',
  '#% увеличение силы истощения': 'sapphire',
  '#% увеличение силы проклятий': 'sapphire',
  '#% увеличение урона от холода': 'sapphire',
  '#% увеличение урона от чар': 'sapphire',
  '#% увеличение урона хаосом': 'sapphire',
  '#% увеличение урона, если вы недавно поглотили труп': 'sapphire',
  '#% увеличение энергетического щита от фокуса в руках': 'sapphire',
  '#% ускорение начала перезарядки энергетического щита': 'sapphire',
  '+#% к максимальному сопротивлению хаосу': 'sapphire',
  '+#% к максимальному сопротивлению холоду': 'sapphire',
  'Восстанавливает #% здоровья при убийстве': 'sapphire',
  'Восстанавливает #% маны при убийстве': 'sapphire',
  'Дарует дополнительный порог оглушения в размере #% от максимума энергетического щита': 'sapphire',
  'Дарует дополнительный порог состояний в размере #% от максимума энергетического щита': 'sapphire',
  'Мета-умения получают увеличенное на #% количество энергии': 'sapphire',
  'На #% быстрее активация проклятия': 'sapphire',
  'Приспешники воскрешаются на #% быстрее': 'sapphire',
  'Приспешники имеют #% повышение скорости атаки и сотворения чар': 'sapphire',
  'Приспешники имеют #% повышение шанса критического удара': 'sapphire',
  'Приспешники имеют #% увеличение урона': 'sapphire',
  'Приспешники имеют +#% к сопротивлению всем стихиям': 'sapphire',
  'Приспешники имеют +#% к сопротивлению хаосу': 'sapphire',
  'Срабатывающие чары наносят увеличенный на #% урон от чар': 'sapphire',
  'Урон пробивает #% сопротивления холоду': 'sapphire',
  '#% увеличение силы накладываемого вамиИстощения Бездны': 'sapphire',

  // Shared — mods that appear on 2+ jewel types
  '#% повышение интеллекта': 'shared',
  '#% повышение ловкости': 'shared',
  '#% повышение силы': 'shared',
  '#% повышение скорости накопления шкалы заморозки боевыми посохами': 'shared',
  '#% повышение скорости смены оружия': 'shared',
  '#% повышение скорости умений будучи превращенным': 'shared',
  '#% повышение шанса критического удара': 'shared',
  '#% повышение шанса критического удара атаками': 'shared',
  '#% полученного урона восполняется в виде здоровья': 'shared',
  '#% увеличение бонуса к критическому урону': 'shared',
  '#% увеличение длительности наносящих урон состояний на врагах': 'shared',
  '#% увеличение длительности эффекта умения': 'shared',
  '#% увеличение длительности шока': 'shared',
  '#% увеличение области действия': 'shared',
  '#% увеличение области действия присутствия': 'shared',
  '#% увеличение силы Горючести': 'shared',
  '#% увеличение силы накладываемого вами шока': 'shared',
  '#% увеличение силы накладываемых вами состояний': 'shared',
  '#% увеличение силы наносящих урон состояний, накладываемых вашими критическими ударами': 'shared',
  '#% увеличение силы поджога': 'shared',
  '#% увеличение урона будучи превращенным': 'shared',
  '#% увеличение урона булавами': 'shared',
  '#% увеличение урона от атак': 'shared',
  '#% увеличение урона от стихий': 'shared',
  '#% увеличение урона Парирования': 'shared',
  '#% увеличение урона умениями растений': 'shared',
  '#% увеличение шанса наложения состояний': 'shared',
  '#% увеличение шанса наложения шока': 'shared',
  '#% усиление эффекта ваших умений меток': 'shared',
  '#% усиление эффекта восприимчивости': 'shared',
  '#% усиление эффекта свойств-префиксов': 'shared',
  '#% усиление эффекта свойств-суффиксов': 'shared',
  '#% шанс получить Нестабильность при убийстве': 'shared',
  '+# допустимых свойств-префиксов': 'shared',
  '+# допустимых свойств-суффиксов': 'shared',
  '+# к интеллекту': 'shared',
  '+# к ловкости': 'shared',
  '+# к силе': 'shared',
  '+#% к бонусу критического урона для урона атаками': 'shared',
  '+#% к сопротивлению молнии': 'shared',
  '+#% к сопротивлению огню': 'shared',
  '+#% к сопротивлению хаосу': 'shared',
  '+#% к сопротивлению холоду': 'shared',
  'Значимые пассивные умения в радиусе также дают: +#% к сопротивлению молнии': 'shared',
  'Значимые пассивные умения в радиусе также дают: +#% к сопротивлению огню': 'shared',
  'Значимые пассивные умения в радиусе также дают: +#% к сопротивлению хаосу': 'shared',
  'Значимые пассивные умения в радиусе также дают: +#% к сопротивлению холоду': 'shared',
  'Изнуряет врагов при нанесении удара, пока у вас размещены изумруд и сапфир': 'shared',
  'Иммунитет к увечьям': 'shared',
  'Накладывает восприимчивость к стихиям при нанесении удара, пока у вас размещены рубин и изумруд': 'shared',
  'Наносящие урон состояния наносят урон на #% быстрее': 'shared',
  'Не может быть ослеплён': 'shared',
  'Ослепляет врагов при нанесении удара, пока у вас размещены рубин и сапфир': 'shared',
  'Отрицательные эффекты на вас заканчиваются на #% быстрее': 'shared',
  'Улучшает радиус до очень большого': 'shared',
  'Умения меток имеют #% увеличение длительности эффекта умения': 'shared',
  'На вас нельзя наложить эффект Оскверненной крови': 'shared',
  'Вы не можете получить эффект Скованности': 'shared',
};

/**
 * Classify a FamilyGroup into jewel type category.
 *
 * Strategy:
 * 1. Static lookup (preferred) — uses poe2db-verified familyKey → type mapping
 * 2. Weighted keyword scoring (fallback) — for mods not in the lookup table
 *
 * The static lookup provides 100% accuracy for all known mods from poe2db.tw.
 * The fallback scoring handles any future mods or edge cases not yet in the lookup.
 */
export function classifyJewelType(group: FamilyGroup): JewelTypeCategory {
  // Step 1: Check static lookup by familyKey
  const lookupResult = JEWEL_TYPE_LOOKUP[group.familyKey];
  if (lookupResult) return lookupResult;

  // Step 2: Fallback to weighted keyword scoring
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
  | 'jewel-type';       // by jewel type: ruby/emerald/sapphire/shared within origin sections

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
    // Used within origin sections for visual sub-grouping instead of hiding mods
    const classified = new Map<JewelTypeCategory, FamilyGroup[]>();
    const jewelTypeOrder: JewelTypeCategory[] = ['ruby', 'emerald', 'sapphire', 'shared'];

    for (const group of groups) {
      const category = classifyJewelType(group);
      const list = classified.get(category) || [];
      list.push(group);
      classified.set(category, list);
    }

    return jewelTypeOrder
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
