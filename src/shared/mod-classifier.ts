/**
 * Mod Classifier — Semantic classification of mods for UI grouping.
 *
 * Classifies mod family groups into semantic categories based on:
 * 1. Tags from GameToken.tags[] (preferred, available for jewellery/jewel)
 * 2. Text-based heuristics (fallback for waystone/tablet/relic which have no tags)
 *
 * Used by ModList to create semantic sub-groups within prefix/suffix columns.
 */

import type { FamilyGroup, ModOrigin, JewelType, PriorityTier } from './types';
import { splitGroupByOrigin } from './family-grouper';
import { t } from './i18n';

// ─── Semantic category types ───

/** Semantic categories for jewellery (amulet/ring/belt) and jewel */
export type SemanticCategory = 'offensive' | 'defensive' | 'attribute' | 'neutral';

/** Sentiment categories for waystones (positive/negative/neutral map mods) */
export type SentimentCategory = 'positive' | 'negative' | 'neutral';

/** Label + styling config for display.
 *  Supports 3-level visual hierarchy:
 *  - Level 1 (Affix): uses colorClass only (no bg/border)
 *  - Level 2 (Origin): uses colorClass + bgClass + borderClass + borderLClass (badge)
 *  - Level 3 (Semantic): uses colorClass + bgClass + borderClass (compact label)
 */
export interface CategoryLabel {
  label: string;
  /** Text color class (e.g. 'text-red-400') */
  colorClass: string;
  /** Background class for badge (e.g. 'bg-red-900/30') */
  bgClass: string;
  /** Border class for badge (e.g. 'border-red-500/25') */
  borderClass: string;
  /** Left accent border class for Level 2 badges (e.g. 'border-l-red-400') */
  borderLClass: string;
  /** Optional icon path relative to public/ (e.g. 'icons/осквернение.webp') */
  iconPath?: string;
}

// ─── Display config ───

export const SEMANTIC_LABELS: Record<SemanticCategory, CategoryLabel> = {
  offensive: { label: 'Атакующие', colorClass: 'text-accent-red', bgClass: 'bg-section-red', borderClass: 'border-sborder-red', borderLClass: '' },
  defensive: { label: 'Защитные', colorClass: 'text-accent-blue', bgClass: 'bg-section-blue', borderClass: 'border-cborder-blue', borderLClass: '' },
  attribute: { label: 'Характеристики', colorClass: 'text-accent-teal', bgClass: 'bg-section-emerald', borderClass: 'border-sborder-emerald', borderLClass: '' },
  neutral:   { label: 'Прочие', colorClass: 'text-muted', bgClass: 'bg-panel/15', borderClass: 'border-edge/15', borderLClass: '' },
};

export const SENTIMENT_LABELS: Record<SentimentCategory, CategoryLabel> = {
  positive: { label: 'Позитивные', colorClass: 'text-accent-teal', bgClass: 'bg-section-emerald', borderClass: 'border-sborder-emerald', borderLClass: '' },
  negative: { label: 'Негативные', colorClass: 'text-accent-red', bgClass: 'bg-section-red', borderClass: 'border-sborder-red', borderLClass: '' },
  neutral:  { label: 'Нейтральные', colorClass: 'text-muted', bgClass: 'bg-panel/15', borderClass: 'border-edge/15', borderLClass: '' },
};

export const ORIGIN_SECTION_LABELS: Record<ModOrigin, CategoryLabel> = {
  normal:     { label: 'Обычные',       colorClass: 'text-soft',    bgClass: 'bg-panel/30',    borderClass: 'border-edge/25',    borderLClass: 'border-l-gray-400' },
  desecrated: { label: 'Очернённые',    colorClass: 'text-accent-emerald', bgClass: 'bg-section-emerald',  borderClass: 'border-sborder-emerald', borderLClass: 'border-l-bl-emerald', iconPath: 'icons/очернение абис.webp' },
  corrupted:  { label: 'Осквернённые',  colorClass: 'text-accent-red',     bgClass: 'bg-section-red',     borderClass: 'border-sborder-red',     borderLClass: 'border-l-bl-red-soft',     iconPath: 'icons/осквернение.webp' },
  essence:    { label: 'Сущность',      colorClass: 'text-accent-amber',   bgClass: 'bg-section-amber',   borderClass: 'border-sborder-amber',   borderLClass: 'border-l-bl-amber-soft',   iconPath: 'icons/сущность.webp' },
  breachborn: { label: 'Разлом',        colorClass: 'text-accent-violet',  bgClass: 'bg-section-violet',  borderClass: 'border-sborder-violet',  borderLClass: 'border-l-bl-violet',  iconPath: 'icons/разлом.webp' },
};

// ─── Tags-based classification (preferred) ───

/** Tags that indicate an offensive mod.
 *  Bug #4-5 fix (iter 84): added 'aura' (jewel: сила умений аур, область присутствия)
 *  and 'gem' (amulet/belt/ring: +уровень камней умений чар/приспешников). */
const OFFENSIVE_TAGS = new Set([
  'damage', 'attack', 'critical', 'speed', 'caster', 'minion',
  'physical', 'chaos', 'ailment', 'elemental', 'cold', 'fire',
  'lightning', 'curse',
  'aura', 'gem',
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

/** Bug #7 fix (iter 84): Breach Lord source tags — these indicate the mod's
 *  source (Kurgal/Amanamu/Ulaman Breach Lord), NOT its function.
 *  Must be skipped during classification so the mod is classified by its
 *  other tags (life/damage/elemental/...) or by text fallback.
 *  Affects 73 tokens across ring/amulet/belt. */
const BREACH_LORD_TAGS = new Set([
  'kurgal_mod', 'amanamu_mod', 'ulaman_mod',
]);

/**
 * Classify a FamilyGroup using tags[] from its member tokens.
 * Uses majority voting: if most members have a tag from a category, that's the group's category.
 * Returns 'neutral' if no tags match or tags are empty.
 *
 * Bug #7 fix (iter 84): Breach Lord source tags (kurgal_mod/amanamu_mod/ulaman_mod)
 * are skipped — they indicate mod source, not function. If after skipping a member
 * has no other tags (only Breach Lord tags), the group's displayText is used as
 * text-fallback via classifyByText(). This reclassifies ~73 tokens from neutral
 * into their proper category (attribute/defensive/offensive/etc.).
 */
export function classifyByTags(group: FamilyGroup): SemanticCategory {
  const tagCounts: Record<SemanticCategory, number> = {
    offensive: 0,
    defensive: 0,
    attribute: 0,
    neutral: 0,
  };

  /** Count of members whose ONLY tags were Breach Lord source tags. */
  let membersWithOnlyBreachLordTags = 0;

  for (const member of group.members) {
    let classified = false;
    let hasNonBreachLordTag = false;
    for (const tag of member.tags) {
      // Bug #7 fix: skip Breach Lord source tags
      if (BREACH_LORD_TAGS.has(tag)) continue;
      hasNonBreachLordTag = true;
      if (OFFENSIVE_TAGS.has(tag)) { tagCounts.offensive++; classified = true; break; }
      if (DEFENSIVE_TAGS.has(tag)) { tagCounts.defensive++; classified = true; break; }
      if (ATTRIBUTE_TAGS.has(tag)) { tagCounts.attribute++; classified = true; break; }
    }
    if (!classified) {
      // Member had only Breach Lord tags → eligible for text fallback
      if (!hasNonBreachLordTag && member.tags.length > 0) {
        membersWithOnlyBreachLordTags++;
      }
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

  // Bug #7 fix: if majority is neutral AND some members had only Breach Lord tags,
  // try text classification as fallback before returning neutral.
  if (maxCategory === 'neutral' && membersWithOnlyBreachLordTags > 0) {
    const textCategory = classifyByText(group);
    if (textCategory !== 'neutral') {
      return textCategory;
    }
  }

  return maxCategory;
}

// ─── Text-based classification (fallback) ───

/** Keywords indicating an offensive/beneficial mod */
const OFFENSIVE_KEYWORDS = /(?:урон|атак|крит|скорость атаки|сотворени|приспешник|снаряд|уровень.*умени|физическ|стихийн|огн.*чар|ледян.*чар|молни.*чар)/i;

/** Keywords indicating a defensive mod.
 *  Bug #7 fix (iter 84): added 'флакон' — flask mods are sustain/defensive.
 *  Needed for Breach Lord text-fallback (kurgal/ulaman mods: "Флаконы маны/здоровья
 *  получают зарядов в секунду: ##") which would otherwise stay in neutral. */
const DEFENSIVE_KEYWORDS = /(?:сопр|здоров|максимум.*ман|брон|уклонен|блок|дух|щит|порог оглуш|максимум.*здрав|энерг.*щит|флакон)/i;

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

/** Keywords indicating a positive (beneficial) waystone mod — player benefits.
 *  Bug #2 fix (iter 84): added 'больше.*волшебн.*редк.*монстр' — "На #% больше
 *  волшебных и редких монстров" was mis-classified as neutral; should be positive
 *  (more rare monsters = more loot). Affects 2 family-groups (prefix + suffix). */
const POSITIVE_KEYWORDS = /(?:повышен.*редкост|повышен.*количеств|увеличен.*редкост|увеличен.*количеств|повышен.*опыт|увеличен.*опыт|качество|дополнит.*сгустк|шанс.*сгустк|дополнит.*путев|дополнит.*сундук|больше.*опыт|больше.*золот|больше.*путев|больше.*предмет|дополнит.*дух|дополнит.*Бездн|дополнит.*бездн|дополнит.*ларец|дополнит.*Сущност|дополнит.*изгнан|приспешник.*дополнит|приспешник.*урон|Бездны ведут|дополнит.*ритуальн|дополнит.*алтар|Сложность монстров Бездны.*наград|дополнит.*Царевн|Бездн появляется.*редких|больше.*волшебн.*редк.*монстр)/i;

/** Keywords indicating a negative (detrimental) waystone mod — makes the map harder.
 *  Bug #2 fix (iter 84): added 3 patterns for previously-neutral mods:
 *  - 'бонус.*крит.*урон.*монстр' — "+##% к бонусу критического урона монстров" (1 group)
 *  - 'шанса появления свойств.*редк.*монстр' — "На #% больше шанса появления свойств
 *    у редких монстров" (2 groups: prefix + suffix)
 *  - 'больше.*эффективн.*монстр' — "На #% больше эффективности монстров" (2 groups)
 *  Total: 5 family-groups reclassified neutral → negative. */
const NEGATIVE_KEYWORDS = /(?:увеличен.*урон.*монстр|повышен.*шанс.*крит.*монстр|скорост.*атак.*сотворени.*монстр|сопротивлен.*монстр|больше.*здоровь.*монстр|Дополнительных свойств у редких монстр|проклят|уменьшен.*заряд.*флакон|меньш.*скорост.*пер|обрекаются|максимум.*сопротивлен.*игрок|меньш.*скорост.*перезарядк|вытягивающ.*ман|замерзш.*земл|заряжен.*земл|монстр.*имел.*повышен|монстр.*имеют.*повышен|увеличен.*эффективн.*монстр|увеличен.*размер.*групп.*монстр|уменьшен.*размер.*групп|Монстры бронирован|Монстры уклончив|Монстры получают.*дополнительного|Монстры с.*шансом.*могут наложить|Монстры имеют.*увеличен.*порог|Монстры разрушают|Меткость монстров|Монстры имеют.*увеличен.*накоплен|усилен.*наложен.*состоян.*монстр|Монстры выпускают.*снаряд|Монстры имеют.*увеличен.*област|подожженн.*земл|Урон монстров пробивает|Монстры получают.*уменьшен.*дополнительн|накладывают.*лиан|Игроки получают уменьшен|восстановлен.*здоровь.*меньш|пожирают душ|бонус.*крит.*урон.*монстр|шанса появления свойств.*редк.*монстр|больше.*эффективн.*монстр)/i;

/**
 * Classify a FamilyGroup into sentiment category (for waystones).
 * Positive = beneficial for the player, Negative = makes the map harder.
 */
export function classifyWaystoneSentiment(group: FamilyGroup): SentimentCategory {
  // Implicit mods are always positive (they benefit the player)
  if (group.affix === 'implicit') return 'positive';

  const text = group.displayText;

  if (POSITIVE_KEYWORDS.test(text)) return 'positive';
  if (NEGATIVE_KEYWORDS.test(text)) return 'negative';

  return 'neutral';
}

// ─── Tablet type classification ───

/** Tablet type categories based on which content the mod affects */
export type TabletTypeCategory = 'ritual' | 'breach' | 'delirium' | 'vaal' | 'expedition' | 'generic';

export const TABLET_TYPE_LABELS: Record<TabletTypeCategory, CategoryLabel> = {
  ritual:     { label: 'Ритуал',      colorClass: 'text-accent-red',    bgClass: 'bg-section-red',    borderClass: 'border-sborder-red',    borderLClass: '' },
  breach:     { label: 'Бездна',      colorClass: 'text-accent-purple', bgClass: 'bg-section-violet', borderClass: 'border-sborder-violet', borderLClass: '' },
  delirium:   { label: 'Делириум',    colorClass: 'text-accent-blue',   bgClass: 'bg-section-blue',   borderClass: 'border-cborder-blue',   borderLClass: '' },
  vaal:       { label: 'Ваал',        colorClass: 'text-accent-orange', bgClass: 'bg-section-amber', borderClass: 'border-sborder-amber', borderLClass: '' },
  expedition: { label: 'Экспедиция',  colorClass: 'text-accent-teal',  bgClass: 'bg-section-emerald',  borderClass: 'border-sborder-emerald',  borderLClass: '' },
  generic:    { label: 'Общие',       colorClass: 'text-muted',   bgClass: 'bg-panel/15',   borderClass: 'border-edge/15',   borderLClass: '' },
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
  // Implicit mods: classify by text keywords
  if (group.affix === 'implicit') {
    const text = group.displayText;
    if (RITUAL_KEYWORDS.test(text)) return 'ritual';
    if (BREACH_KEYWORDS.test(text)) return 'breach';
    if (VAAL_KEYWORDS.test(text)) return 'vaal';
    return 'generic';
  }

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

/** Jewel type categories based on which jewel type the mod is associated with.
 *  Re-exported from types.ts as JewelType, aliased here for backward compatibility. */
export type JewelTypeCategory = JewelType;

export const JEWEL_TYPE_LABELS: Record<JewelTypeCategory, CategoryLabel> = {
  ruby:     { label: 'Рубин',    colorClass: 'text-accent-red',    bgClass: 'bg-section-red',    borderClass: 'border-sborder-red',    borderLClass: '' },
  emerald:  { label: 'Изумруд',  colorClass: 'text-accent-teal',  bgClass: 'bg-section-emerald',  borderClass: 'border-sborder-emerald',  borderLClass: '' },
  sapphire: { label: 'Сапфир',   colorClass: 'text-accent-blue',   bgClass: 'bg-section-blue',   borderClass: 'border-cborder-blue',   borderLClass: '' },
  shared:   { label: 'Общие',    colorClass: 'text-muted',   bgClass: 'bg-panel/15',   borderClass: 'border-edge/15',   borderLClass: '' },
};

/**
 * Jewel type classification — weighted keyword scoring with shared override.
 *
 * Cross-validated against poe2db.tw Modifier Calculator pages:
 *   https://poe2db.tw/ru/Ruby#ModifiersCalc
 *   https://poe2db.tw/ru/Emerald#ModifiersCalc
 *   https://poe2db.tw/ru/Sapphire#ModifiersCalc
 *
 * Two-phase approach:
 * 1. SHARED_OVERRIDE_PATTERNS — patterns for mods that appear on multiple jewel
 *    types (ETL='shared'). Checked first; if matched, return 'shared' immediately.
 *    This prevents the scoring phase from misclassifying cross-type mods.
 * 2. Weighted keyword scoring — scores each type independently and picks the
 *    highest-scoring type when one dominates, or 'shared' when tied/low.
 *
 * Accuracy: ~94% vs ETL ground truth (up from ~76% without shared overrides).
 */

/**
 * Patterns for mods that appear on multiple jewel types (ETL='shared').
 * These are cross-validated against poe2db ModCalc pages.
 * When a mod's text matches one of these, it's classified as 'shared'
 * regardless of keyword scores — because the mod actually appears on
 * multiple jewel types in-game.
 */
const SHARED_OVERRIDE_PATTERNS: RegExp[] = [
  // ─── Resistance mods — plain resist is shared; max resist is type-specific ───
  // Plain +N% resist (corrupted suffixes, passive radius) — shared across all types
  // Lookbehind excludes minion resist ("Приспешники имеют ... к сопротивлению X")
  /(?<!приспешник.*)к сопротивлению (холод|хаос|огн|молни)/i,
  // Penetration — shared EXCEPT fire (fire pen is Ruby-specific)
  /пробивает.*сопротивления (холод|молни)/i,

  // ─── Damage type increases — cold/lightning/chaos shared, fire is Ruby-specific ───
  /увеличение урона (хаосом|от холода|от молнии)/i,

  // ─── Energy shield max ES — shared (Ruby+armour/ES, Sapphire+pure ES) ───
  // Specific: only "увеличение максимума ES", not "порог от максимума ES" (Sapphire)
  /увеличен.*максимум.*энергетическ.*щит/i,
  // ES recharge is NOT shared — it's Sapphire-specific. Only "ускорение начала перезарядки" is shared.

  // ─── Generic damage type strength/duration (appear on multiple types) ───
  /увеличен.*силы поджог/i,                        // ignite strength — shared, not Ruby-only
  /силы накладываемого.*(отравлен|шок)/i,           // poison/shock strength — shared
  /увеличен.*силы накладываемого.*(отравлен|шок)/i,
  /длительн.*(поджог.*шок|шок.*поджог|поджога.*шока|шока.*поджога)(?!.*охлажден)/i,  // dual-ailment (поджог+шок), NOT triple (Emerald-specific)
  /увеличен.*длительн.*шок(?!.*охлажден)/i,                      // shock duration — shared, not triple-ailment
  /шанса отравить/i,                                // poison chance — shared

  // ─── Spell damage generic (shared — only the noun form "увеличение урона от чар") ───
  // The adjective form "увеличенный на #% урон от чар" is Sapphire-specific (trigger spell)
  /увеличение урона от чар/i,

  // ─── Aura strength (shared — appears on Ruby+Sapphire) ───
  /сил.*аур/i,

  // ─── Warcry effect (shared — appears on multiple types) ───
  /усилен.*эффект.*боев.*клич/i,

  // ─── Evasion generic (shared — appears on multiple types) ───
  // But NOT when combined with "брон" or "от щит" (shield defence = Ruby-specific)
  // Note: negative lookahead checks AFTER "уклонен"; "брони" in shield defence
  // appears BEFORE "уклонения", so we also exclude "от щит" after it
  /увеличен.*уклонен(?!.*(?:брон|от щит))/i,

  // ─── Companion mods (shared — appear on multiple types) ───
  /компаньон.*(урон|здоровь)/i,
  /максимум.*здоровь.*компаньон/i,

  // ─── Minion mods that appear on multiple types ───
  /приспешник.*увеличен.*урон/i,                   // minion damage — shared
  /меткост.*приспешник/i,                           // minion accuracy — shared
  /приспешник.*воскреш/i,                           // minion revival — shared

  // ─── Attack speed with non-type-specific weapons (shared) ───
  /скорост.*атак.*(топор|меч|кинжал|без оруж)/i,

  // ─── Dual-jewel combo mods (inherently shared) ───
  /пока у вас размещены/i,

  // ─── Passive skill radius grants (shared — Keystones) ───
  /пассивные умения в радиусе/i,

  // ─── Depletion — Истощение Бездны is shared; generic Истощение is also shared ───
  /Истощен.*Бездн/i,
  /силы истощения/i,

  // ─── ES recharge speed (shared — not Sapphire-specific) ───
  /скорост.*перезарядк.*энергетическ.*щит/i,

  // ─── Vulnerability effect (shared — appears on multiple types) ───
  /эффект.*восприимчивост/i,

  // ─── Generic crit with daggers (shared) ───
  /шанс.*критического удара.*кинжал/i,

  // ─── Skill recharge / plants (shared) ───
  /урон.*умениями.*растен/i,

  // ─── Stun threshold conditional (shared for generic version) ───
  // NOTE: Emerald-specific version scored in EMERALD_SCORES
  // No override needed — Emerald scores higher with dedicated patterns

  // ─── Slow resistance (shared for generic version) ───
  // NOTE: Emerald-specific version scored in EMERALD_SCORES

  // ─── Stun threshold on parry (shared for generic version) ───
  // NOTE: Emerald-specific version scored in EMERALD_SCORES

  // ─── Freeze with staves (shared — both Emerald weapon and Sapphire cold) ───
  /заморозки боевыми посохами/i,

  // ─── Max chaos resist (shared) ───
  /максимальн.*сопротивлен.*хаос/i,

  // ─── Dagger-specific mods (shared — appear on multiple types) ───
  /увеличен.*урона.*кинжал/i,                       // dagger damage — shared (not Emerald-only)
  /критического удара кинжалами/i,                    // dagger crit — shared
  /скорост.*атак.*кинжалами/i,                        // dagger attack speed — shared
];

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

  // Warcries (unique to Ruby) — only generic /боев.*клич/ kept; warcry EFFECT is shared
  [/боев.*клич/i, 2],

  // Banners (unique to Ruby) — includes speed accumulation for знамён
  [/(?:знам[её]н|област.*действ.*знам[её]н|скорост.*накоплен.*славы.*знам[её]н|скорость.*накоплен.*славы.*знам[её]н|длительн.*знам[её]н|накоплен.*славы.*умени.*знам[её]н)/i, 3],
  // Banner glory speed (Ruby unique — not in shared override)
  [/скорост.*накоплен.*славы.*знам[её]н|скорость.*накоплен.*славы.*знам[её]н/i, 4],

  // Shield defence (Ruby unique — брони, уклонения и энергетического щита от щита)
  [/брон.*уклонен.*энерг.*щит.*щит/i, 5],

  // NOTE: Aura strength removed from RUBY — moved to SHARED_OVERRIDE (appears on Ruby+Sapphire)

  // Melee damage (unique to Ruby)
  [/урон.*ближн.*бо/i, 2],

  // Physical damage (unique to Ruby)
  [/глобальн.*физическ.*урон|физическ.*урон/i, 2],

  // Stun (unique to Ruby — but Emerald has parry stun threshold)
  [/(?:скорост.*накоплен.*шкалы.*оглушен|скорость.*накоплен.*шкалы.*оглушен)/i, 3],
  [/оглушен/i, 1],          // generic — covers stun threshold + stun speed + parry stun
  [/(?:порог.*оглушен|увеличен.*порог.*оглушен)/i, 2],  // stun threshold — stronger signal than generic оглушен

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

  // Minion area (Ruby specific — Emerald has companion, Sapphire has spell minions)
  [/приспешник.*област.*действ/i, 2],
  // Minion max health (Ruby — despite being on Ruby+Sapphire, the ETL tags Ruby as primary)
  [/приспешник.*максимум.*здоровь/i, 2],
  // Minion physical damage reduction (Ruby-specific)
  [/приспешник.*дополнительн.*уменьшен.*физическ/i, 3],

  // Damage while transformed (Ruby)
  [/урон.*будучи.*превращен/i, 1],          // appears in all 3

  // Bleed strength (Ruby specific — not just "кровотеч" but "силы кровотечения")
  [/сил[ауе].*накладываем.*кровотеч|увеличен.*силы.*кровотеч/i, 3],

  // NOTE: armour break removed — subsumed by [разруш.*брон] w=3 above

  // Combustibility (Ruby — but Sapphire also has it)
  // NOTE: /сил.*Горючест/ w=1 removed — appears in both Ruby and Sapphire, no discriminative power
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
  [/кинжал/i, 2],

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

  // NOTE: Mark skills removed from EMERALD — moved to SHARED_OVERRIDE (shared Emerald+Sapphire)

  // Movement speed (Emerald specific)
  [/скорост.*передвижен/i, 2],

  // Conditional melee/projectile damage (Emerald — both weapon types)
  [/урон.*ближн.*бо.*если.*снаряд|урон.*снаряд.*если.*ближн.*бо/i, 2],

  // Quiver (Emerald specific)
  [/колчан/i, 3],

  // Evasion (Emerald specific — but generic "увеличение уклонения" is shared)
  // NOTE: generic /уклонен/ removed — moved to SHARED_OVERRIDE

  // Attack crit (Emerald specific)
  [/шанс.*крит.*удар.*атак|крит.*удар.*атак/i, 2],
  [/бонус.*крит.*урон.*атак/i, 2],
  [/крит.*урон.*копь|бонус.*крит.*копь/i, 2],

  // Skill recharge speed (Emerald)
  [/скорост.*перезарядк.*умени/i, 2],

  // Damage vs rare/unique (Emerald)
  [/урон.*удар.*редк.*уникальн/i, 2],

  // NOTE: Plant damage removed from EMERALD — moved to SHARED_OVERRIDE

  // Elemental ailment threshold (Emerald)
  [/порог.*стихийн.*состоян/i, 2],

  // Mana from flasks (Emerald — but "ман" triggers Sapphire)
  [/восстановлен.*ман.*флакон|количеств.*похищен.*ман/i, 3],

  // Stun/Immobilize chance (Emerald — оцепенение is Emerald-specific)
  [/шанс.*наложен.*оцепенен/i, 3],

  // Mark skill effect (Emerald — mark mods are primarily Emerald)
  // Note: "меток" (genitive plural) has "о" between т and к, so pattern uses "мет[о]?к"
  [/усилен.*эффект.*умени.*мет[о]?к|усилен.*эффект.*мет[о]?к/i, 3],
  [/умени.*мет[о]?к.*длительн|длительн.*эффект.*умени.*мет[о]?к|увеличен.*длительн.*эффект.*умени.*мет[о]?к/i, 3],
  // Mark spell speed (Emerald — cross-type with Sapphire spell casting)
  [/мет[о]?к.*скорост.*сотворени|скорост.*сотворени.*чар.*мет[о]?к|умени.*метк.*скорост.*сотворени/i, 5],

  // Multi-ailment duration (Emerald — duration of поджог+шок+охлаждение)
  [/длительн.*поджог.*шок.*охлажден/i, 3],

  // Stun threshold conditional (Emerald)
  [/порог.*оглушен.*недавно.*не.*были.*оглушен/i, 5],
  // Stun threshold on parry (Emerald)
  [/порог.*оглушен.*парир/i, 3],

  // Slow resistance (Emerald)
  [/ослаблен.*влияния.*замедлен/i, 3],

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
  [/(?:чар[ыуе].*умени|урон.*чар|Срабатывающ.*чар|скорост.*сотворени.*чар(?!.*мет))/i, 3],

  // Mana (Sapphire — NOT flask mana which is Emerald)
  [/максимум.*ман|скорост.*регенерац.*ман|ман.*вместо.*здоровь|получаем.*урон.*берет.*ман/i, 2],
  [/похищен.*ман(?!.*флакон)/i, 2],  // mana leech but NOT from flasks

  // Offerings (unique to Sapphire)
  [/(?:подношен|максимум.*здоровь.*подношен|длительн.*подношен)/i, 3],

  // Minion specific (Sapphire — spell-type minions)
  [/приспешник.*сопротивлен.*хаос/i, 3],
  [/приспешник.*сопротивлен.*стихи/i, 3],
  [/приспешник.*шанс.*крит/i, 2],
  [/бонус.*крит.*приспешник|крит.*урон.*приспешник/i, 2],
  // Minion physical DR — Sapphire has the generic version (not just physical)
  [/приспешник.*дополнит.*уменьшен/i, 2],
  // NOTE: /приспешник.*воскреш/ removed — moved to SHARED_OVERRIDE
  // NOTE: /приспешник.*урон/ removed — moved to SHARED_OVERRIDE
  // NOTE: /приспешник.*максимум.*здоровь/ removed — too ambiguous

  // Stun/ailment threshold from ES (Sapphire — порог оглушения/состояний от энергетического щита)
  [/порог.*(?:оглушен|состояний).*максимум.*энергетическ/i, 3],

  // Meta-skills (unique to Sapphire)
  [/Мета-умени/i, 3],

  // Chaos (unique to Sapphire)
  [/(?:хаосом|урон.*хаосом|сопротивлен.*хаос|максимальн.*сопротивлен.*хаос)/i, 2],

  // Depletion (unique to Sapphire — but Истощение Бездны is shared)
  [/сил.*Истощен(?!.*Бездн)/i, 3],

  // Breach (unique to Sapphire — from desecrated mods)
  [/Бездн/i, 2],

  // NOTE: Vulnerability effect removed from SAPPHIRE — moved to SHARED_OVERRIDE

  // Life/mana on kill (Sapphire)
  [/восстанавливает.*здоровь.*убийств/i, 2],
  [/восстанавливает.*ман.*убийств/i, 2],
  [/получен.*урон.*восполня.*здоровь/i, 2],

  // Spell crit (Sapphire specific)
  [/шанс.*крит.*удар.*чар|крит.*удар.*чар/i, 2],
  [/бонус.*крит.*урон.*чар/i, 2],
  [/увеличен.*бонус.*крит.*урон.*чар/i, 3],  // stronger signal for specific version

  // Generic crit (Sapphire — only for mods WITHOUT weapon-specific suffix like "атаками")
  // Narrowed from /повышен.*шанс.*критического удара/ to avoid conflict with Emerald attack-crit
  [/повышен.*шанс.*критического удара(?!.*атак)/i, 2],
  [/увеличен.*бонус.*крит.*урон(?!.*атак)/i, 2],

  // NOTE: generic /присутстви/ removed — appeared in both Ruby and Sapphire with no discriminative power

  // Corpse consumption (Sapphire)
  [/поглотил.*труп|поглотить.*труп/i, 2],

  // NOTE: Mark spell speed removed from SAPPHIRE — moved to SHARED_OVERRIDE

  // NOTE: minion resist all removed — exact duplicate of [приспешник.*сопротивлен.*стихи] w=3 above

  // NOTE: /сил.*Горючест/ removed from both Ruby and Sapphire — appeared in both arrays with w=1, no discriminative power

  // NOTE: Presence area removed — too low discriminative power

  // NOTE: stun/state threshold from ES removed — subsumed by [дополнит.*порог.*энергетическ.*щит] w=3 above
];

/**
 * Classify a FamilyGroup into jewel type category.
 *
 * Priority:
 * 1. **Lookup from ETL data**: If all members have `jewelType` field populated
 *    from the poe2db ModCalc pages, use that directly (100% accuracy).
 * 2. **Weighted keyword scoring fallback**: If no member has `jewelType`,
 *    fall back to the heuristic scoring system (~84% accuracy).
 *
 * The lookup approach replaces the heuristic for normal jewel mods where
 * the ETL pipeline has matched modCodes against Ruby/Emerald/Sapphire
 * ModCalc pages. The heuristic remains as fallback for mods that weren't
 * matched (e.g., corrupted mods, or when ETL data is outdated).
 */
export function classifyJewelType(group: FamilyGroup): JewelTypeCategory {
  // Strategy 1: Lookup from ETL data (100% accurate)
  // Check if members have jewelType populated from poe2db ModCalc pages
  if (group.members.length > 0 && group.members[0].jewelType) {
    // Use majority voting across all members
    const typeCounts: Record<JewelTypeCategory, number> = {
      ruby: 0, emerald: 0, sapphire: 0, shared: 0,
    };
    for (const member of group.members) {
      if (member.jewelType) {
        typeCounts[member.jewelType]++;
      } else {
        typeCounts.shared++;
      }
    }
    // Find the most common type (excluding shared)
    let bestType: JewelTypeCategory = 'shared';
    let bestCount = 0;
    for (const [type, count] of Object.entries(typeCounts)) {
      if (type === 'shared') continue;
      if (count > bestCount) {
        bestCount = count;
        bestType = type as JewelTypeCategory;
      }
    }
    if (bestCount > 0) return bestType;
    return 'shared';
  }

  // Strategy 2: Weighted keyword scoring fallback (~94% accuracy vs ETL ground truth)
  const text = group.displayText;

  // Phase 1: Shared override — patterns for mods that appear on multiple jewel types.
  // If matched, return 'shared' immediately (higher confidence than keyword scores).
  for (const pattern of SHARED_OVERRIDE_PATTERNS) {
    if (pattern.test(text)) return 'shared';
  }

  // Phase 2: Weighted keyword scoring
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

// ─── Priority tier classification ───

/**
 * Priority tier classification based on affix popularity research.
 *
 * Source: `регис/Иерархия популярности аффиксов.md`
 *
 * Tiers:
 * - S = always sought after (e.g., +skill levels, all res, max life, quantity)
 * - A = very good, build-enabling (e.g., attributes, attack speed, regen)
 * - B = niche/moderate value (e.g., chaos res, MF, flask charges)
 * - C = rarely sought (e.g., thorns, light radius, minion mods for non-minion builds)
 *
 * Classification uses text heuristics per category. The `category` parameter
 * determines which keyword set to use (waystone, tablet, ring, amulet, belt).
 * For jewel/relic/vendor, no priority classification is applied (returns 'C').
 */

// ─── Waystone priority patterns ───

/** S-tier waystone prefixes: Quantity, Rarity, Pack Size, Monster Count */
const WAYSTONE_S_PREFIX = /(?:количеств.*найден|редкост.*найден|размер.*групп.*монстр|количеств.*групп.*монстр)/i;

/** A-tier waystone prefixes: Magic/Rare monsters, Experience, Chests */
const WAYSTONE_A_PREFIX = /(?:волшебн.*монстр|редк.*монстр|опыт|волшебн.*сундук|редк.*сундук)/i;

/** S-tier waystone suffixes (high waystone drop chance, low danger) */
const WAYSTONE_S_SUFFIX = /(?:дополнит.*путев|шанс.*сгустк|больше.*путев)/i;

/** A-tier waystone suffixes (medium danger but needed for sustain) */
const WAYSTONE_A_SUFFIX = /(?:дополнит.*дух|дополнит.*Бездн|дополнит.*бездн|дополнит.*ритуальн|дополнит.*алтар|дополнит.*ларец|дополнит.*Сущност|дополнит.*изгнан|Бездны ведут|дополнит.*Царевн|Бездн появляется)/i;

/** B-tier waystone mods (gold, specific monster types) */
const WAYSTONE_B = /(?:золот|дополнит.*сгустк)/i;

// ─── Tablet priority patterns ───

/** S-tier tablet: Quantity, Rarity in maps */
const TABLET_S = /(?:количеств.*предмет.*карт|редкост.*предмет.*карт|увеличен.*количеств|увеличен.*редкост)/i;

/** A-tier tablet: Extra mechanics, experience, rare monsters */
const TABLET_A = /(?:шанс.*дополнит.*механ|опыт.*карт|редк.*монстр.*карт|дополнит.*переролл|дополнит.*омен|больше.*осколк|больше.*взрывчатк)/i;

/** C-tier tablet: Monster difficulty, specific mob types */
const TABLET_C = /(?:сложност.*монстр|конкретн.*тип|модификатор.*монстр)/i;

// ─── Ring priority patterns ───

/** S-tier ring: +Skill levels, Spirit, All Res, ES */
const RING_S = /(?:уровень.*умени|уровн.*умени|Дух|ко всем.*сопротивлен|ко всем стихийн.*сопротивлен|энергетическ.*щит|увеличен.*энергетическ)/i;

/** A-tier ring: Attributes, elemental damage, attack/cast speed, mana regen */
const RING_A = /(?:к силе|к ловк|к интелл|атрибут|добавлен.*стихийн.*урон|увеличен.*урон.*стихи|скорост.*атак|скорост.*сотворени|регенерац.*ман)/i;

/** B-tier ring: Chaos res, MF, max mana */
const RING_B = /(?:хаос.*сопр|сопротивлен.*хаос|редкост.*найден|количеств.*найден|максимум.*ман)/i;

// ─── Amulet priority patterns ───

/** S-tier amulet: +Skill levels, Spirit, ES, All Res, All Attributes */
const AMULET_S = /(?:уровень.*умени|уровн.*умени|Дух|энергетическ.*щит|увеличен.*энергетическ|ко всем.*сопротивлен|ко всем стихийн.*сопротивлен|ко всем.*атрибут|ко всем характеристик)/i;

/** A-tier amulet: Max mana, global defence, cast speed, mana regen */
const AMULET_A = /(?:максимум.*ман|глобальн.*защит|скорост.*сотворени|регенерац.*ман)/i;

/** B-tier amulet: Chaos res, MF, added damage */
const AMULET_B = /(?:хаос.*сопр|сопротивлен.*хаос|редкост.*найден|количеств.*найден|добавлен.*урон)/i;

// ─── Belt priority patterns ───

/** S-tier belt: Max life, All Res, Flask life recovery */
const BELT_S = /(?:максимум.*здоров|ко всем.*сопротивлен|ко всем стихийн.*сопротивлен|восстановлен.*здоровь.*флакон|скорост.*восстановлен.*здоровь.*флакон)/i;

/** A-tier belt: Individual res, attributes, flask mana recovery, armour */
const BELT_A = /(?:сопротивлен.*(огн|холод|молни|хаос)|к силе|к ловк|к интелл|брон|восстановлен.*ман.*флакон|скорост.*восстановлен.*ман.*флакон)/i;

/** B-tier belt: Flask duration, flask charges */
const BELT_B = /(?:длительн.*оберег|заряд.*флакон|длительн.*флакон)/i;

/**
 * Classify a FamilyGroup into a priority tier based on affix popularity.
 *
 * @param group - The FamilyGroup to classify
 * @param category - The item category (waystone, tablet, ring, amulet, belt, etc.)
 * @returns PriorityTier: 'S', 'A', 'B', or 'C'
 */
export function classifyPriorityTier(group: FamilyGroup, category: string): PriorityTier {
  const text = group.displayText;

  switch (category) {
    case 'waystone':
      return classifyWaystonePriority(group, text);
    case 'tablet':
      return classifyTabletPriority(text);
    case 'ring':
      return classifyRingPriority(text);
    case 'amulet':
      return classifyAmuletPriority(text);
    case 'belt':
      return classifyBeltPriority(text);
    default:
      // jewel, relic, vendor — no priority classification
      return 'C';
  }
}

function classifyWaystonePriority(group: FamilyGroup, text: string): PriorityTier {
  // Prefixes
  if (group.affix === 'prefix') {
    if (WAYSTONE_S_PREFIX.test(text)) return 'S';
    if (WAYSTONE_A_PREFIX.test(text)) return 'A';
    if (WAYSTONE_B.test(text)) return 'B';
    return 'C';
  }
  // Suffixes
  if (WAYSTONE_S_SUFFIX.test(text)) return 'S';
  if (WAYSTONE_A_SUFFIX.test(text)) return 'A';
  // B-tier: gold, additional splinters (nice-to-have but not critical)
  if (WAYSTONE_B.test(text)) return 'B';
  // Everything else (negative mods, unremarkable neutral) — not sought after
  return 'C';
}

function classifyTabletPriority(text: string): PriorityTier {
  if (TABLET_S.test(text)) return 'S';
  if (TABLET_A.test(text)) return 'A';
  if (TABLET_C.test(text)) return 'C';
  return 'B';
}

function classifyRingPriority(text: string): PriorityTier {
  if (RING_S.test(text)) return 'S';
  if (RING_A.test(text)) return 'A';
  if (RING_B.test(text)) return 'B';
  return 'C';
}

function classifyAmuletPriority(text: string): PriorityTier {
  if (AMULET_S.test(text)) return 'S';
  if (AMULET_A.test(text)) return 'A';
  if (AMULET_B.test(text)) return 'B';
  return 'C';
}

function classifyBeltPriority(text: string): PriorityTier {
  if (BELT_S.test(text)) return 'S';
  if (BELT_A.test(text)) return 'A';
  if (BELT_B.test(text)) return 'B';
  return 'C';
}

/** Sort order for priority tiers (lower = higher priority) */
export const TIER_SORT_ORDER: Record<PriorityTier, number> = { S: 0, A: 1, B: 2, C: 3 };

// ─── Functional block classification (iter 85: P0 OP-1 Phase 2) ───

/**
 * Functional blocks — fine-grained grouping for jewellery (ring/amulet/belt).
 *
 * Replaces the coarse 4-bin `affix-semantic` mode (offensive/defensive/attribute/neutral)
 * with 24 functional blocks that reflect how players actually think about mods
 * when crafting: Spirit, skill levels, attributes, resistances, runes barrier,
 * MF, defence stats, offence speed, crit, damage type, penetration, ailments,
 * area/duration, wisps, buff skills, minions, meta-skills, weapon-specific,
 * flasks, conversion, rage/charges, breach, other.
 *
 * iter 86: 14 high-priority blocks are implemented as classifiers
 * (spirit / skill-levels / attributes / resources / runes-barrier / resistances /
 *  magic-find / defence-stats / offence-speed / crit / damage-type / flasks /
 *  minions / breach). 10 blocks still fall back to `other` — implementation
 * deferred to iter 87+ (see STATUS.md). Simulation on real jewellery JSON
 * shows other-bucket = 9.9% (target was <30%), so production pages are flipped
 * to `affix-functional` in iter 86.
 *
 * iter 87: weapon-specific block (15th active) implemented for jewel-only —
 * 24 weapon family-keys in jewel.json distributed across 6 weapon-class
 * sub-blocks (melee / bow / crossbow / staff / spear / dagger). Production
 * JewelPage flipped to `jewel-functional` mode. jewel.json other-bucket = 21.8%.
 *
 * iter 88: ailments + area-duration blocks (16th + 17th active) implemented.
 * jewel.json other-bucket reduced from 21.8% → 14.0% (target <15% met).
 *
 * iter 89: rage-charges + meta-skills + buff-skills blocks (18th + 19th + 20th
 * active) implemented. jewel.json other-bucket reduced from 14.0% → 8.3%.
 * Bonus improvements in amulet (10.5%→6.7%), ring (5.3%→3.2%), belt (8.2%→4.7%).
 *
 * Source: docs/AFFIXES_GROUPING_ANALYSIS.md §4.1 (24-block scheme).
 */
export type FunctionalBlock =
  | 'spirit'           // Дух — amulet-only (5 tokens, 1 family-key)
  | 'skill-levels'     // +уровень камней умений, +качество умений, скорость перезарядки умений, длительность эффекта умения
  | 'attributes'       // Сила/Ловкость/Интеллект/Все + dual-attr + снижение требований
  | 'resources'        // iter 86: Здоровье/Мана/ES-максимум/регенерация/похищение (tags life/mana + ES-max text)
  | 'runes-barrier'    // Рунический барьер (max, regen, restore)
  | 'resistances'      // Огонь/Холод/Молния/Хаос/Все + добавленные свойства сопротивлений
  | 'magic-find'       // Редкость/Количество найденных предметов
  | 'defence-stats'    // iter 86: Броня/Уклонение/ES-recharge/Charm/Блок/Порог оглушения
  | 'offence-speed'    // iter 86: Скорость атаки/сотворения/передвижения/снарядов (tag speed + text)
  | 'crit'             // iter 86: Шанс/Бонус/По типу урона (tag critical + text «крит»)
  | 'damage-type'      // iter 86: Физ/Огонь/Холод/Молния/Хаос/Стихийный (tags damage/physical/elemental/cold/fire/lightning/chaos + text «урон»)
  | 'penetration'      // iter 93: Пробитие сопротивления (3 family-keys в jewel — cold/fire/lightning penetration)
  | 'ailments'         // iter 88: Поджог/Шок/Охлаждение/Отравление/Кровотечение/Оцепенение/Парирование/Пригвождение/Разрез/Ослепление/Состояния (8 family-keys в jewel)
  | 'area-duration'    // iter 88: Область действия / Длительность проклятий и знамён / Радиус пассивных умений (7 family-keys в jewel)
  | 'wisps'            // ⏳ iter 90+: Сгустки (Breach-механика)
  | 'buff-skills'      // iter 89: Ауры/Вестники/Метки/Кличи/Знамёна/Проклятия (6 family-keys в jewel + 4 в amulet/ring)
  | 'minions'          // iter 86: Приспешники/Подношения (tag minion + text «приспешник»/«подношен»)
  | 'meta-skills'      // iter 89: Мета-умения/Архонт/Запечатанные/Вызываемые умения (1 family-key в jewel + 5 в amulet/ring/belt)
  | 'weapon-specific'  // iter 87: 24 family-key в 6 sub-blocks (jewel only — melee/bow/crossbow/staff/spear/dagger)
  | 'flasks'           // iter 86: belt primary, flask-моды (text «флакон»)
  | 'conversion'       // ⏳ iter 90+: MoM/Урон→Здоровье/Урон→Мана/Восстановление при убийстве
  | 'rage-charges'     // iter 89: Свирепость/Слава знамён (4 family-keys в jewel)
  | 'breach'           // Бездна/Разлом — Breach Lord's Mark (6 family-groups, essence-origin, no tags)
  | 'other';           // Прочее — fallback (<5% target after all blocks implemented)

/** Display config for each functional block.
 *  iter 89: 20 active blocks have distinct colors (spirit / skill-levels /
 *  attributes / resources / runes-barrier / resistances / magic-find /
 *  defence-stats / offence-speed / crit / damage-type / ailments /
 *  area-duration / weapon-specific / flasks / minions / breach / buff-skills /
 *  meta-skills / rage-charges).
 *  The 4 unimplemented blocks (penetration / wisps / conversion) still share
 *  the muted "other" palette (they shouldn't appear in UI yet). */
export const FUNCTIONAL_BLOCK_LABELS: Record<FunctionalBlock, CategoryLabel> = {
  spirit:           { label: 'Дух',                colorClass: 'text-accent-amber',   bgClass: 'bg-section-amber',   borderClass: 'border-sborder-amber',   borderLClass: '' },
  'skill-levels':   { label: 'Уровень умений',     colorClass: 'text-accent-amber',   bgClass: 'bg-section-amber',   borderClass: 'border-sborder-amber',   borderLClass: '' },
  attributes:       { label: 'Атрибуты',           colorClass: 'text-accent-teal',    bgClass: 'bg-section-emerald', borderClass: 'border-sborder-emerald', borderLClass: '' },
  resources:        { label: 'Здоровье / Мана / ES', colorClass: 'text-accent-blue', bgClass: 'bg-section-blue',    borderClass: 'border-cborder-blue',    borderLClass: '' },
  'runes-barrier':  { label: 'Рунический барьер',  colorClass: 'text-accent-violet',  bgClass: 'bg-section-violet',  borderClass: 'border-sborder-violet',  borderLClass: '' },
  resistances:      { label: 'Сопротивления',      colorClass: 'text-accent-blue',    bgClass: 'bg-section-blue',    borderClass: 'border-cborder-blue',    borderLClass: '' },
  'magic-find':     { label: 'Рарити',             colorClass: 'text-accent-amber',   bgClass: 'bg-section-amber',   borderClass: 'border-sborder-amber',   borderLClass: '' },
  'defence-stats':  { label: 'Защитные показатели', colorClass: 'text-accent-blue',   bgClass: 'bg-section-blue',    borderClass: 'border-cborder-blue',    borderLClass: '' },
  'offence-speed':  { label: 'Скорость',           colorClass: 'text-accent-red',     bgClass: 'bg-section-red',     borderClass: 'border-sborder-red',     borderLClass: '' },
  crit:             { label: 'Крит',               colorClass: 'text-accent-red',     bgClass: 'bg-section-red',     borderClass: 'border-sborder-red',     borderLClass: '' },
  'damage-type':    { label: 'Урон по типу',       colorClass: 'text-accent-red',     bgClass: 'bg-section-red',     borderClass: 'border-sborder-red',     borderLClass: '' },
  penetration:      { label: 'Пробитие',           colorClass: 'text-accent-red',     bgClass: 'bg-section-red',     borderClass: 'border-sborder-red',     borderLClass: '' },
  ailments:         { label: 'Состояния',          colorClass: 'text-accent-red',     bgClass: 'bg-section-red',     borderClass: 'border-sborder-red',     borderLClass: '' },
  'area-duration':  { label: 'Область / Длительность', colorClass: 'text-accent-violet', bgClass: 'bg-section-violet', borderClass: 'border-sborder-violet', borderLClass: '' },
  wisps:            { label: 'Сгустки',            colorClass: 'text-accent-violet',  bgClass: 'bg-section-violet',  borderClass: 'border-sborder-violet',  borderLClass: '' },
  'buff-skills':    { label: 'Ауры / Вестники / ...', colorClass: 'text-accent-violet', bgClass: 'bg-section-violet', borderClass: 'border-sborder-violet', borderLClass: '' },
  minions:          { label: 'Приспешники',        colorClass: 'text-accent-red',     bgClass: 'bg-section-red',     borderClass: 'border-sborder-red',     borderLClass: '' },
  'meta-skills':    { label: 'Мета-умения',        colorClass: 'text-accent-violet',  bgClass: 'bg-section-violet',  borderClass: 'border-sborder-violet',  borderLClass: '' },
  'weapon-specific':{ label: 'Оружейные моды',     colorClass: 'text-accent-amber',   bgClass: 'bg-section-amber',   borderClass: 'border-sborder-amber',   borderLClass: '' },
  flasks:           { label: 'Флаконы',            colorClass: 'text-accent-amber',   bgClass: 'bg-section-amber',   borderClass: 'border-sborder-amber',   borderLClass: '' },
  conversion:       { label: 'Конверсия / Сустейн', colorClass: 'text-accent-blue',   bgClass: 'bg-section-blue',    borderClass: 'border-cborder-blue',    borderLClass: '' },
  'rage-charges':   { label: 'Свирепость / Заряды', colorClass: 'text-accent-red',    bgClass: 'bg-section-red',     borderClass: 'border-sborder-red',     borderLClass: '' },
  breach:           { label: 'Бездна',             colorClass: 'text-accent-violet',  bgClass: 'bg-section-violet',  borderClass: 'border-sborder-violet',  borderLClass: '' },
  other:            { label: 'Прочее',             colorClass: 'text-muted',          bgClass: 'bg-panel/15',        borderClass: 'border-edge/15',         borderLClass: '' },
};

/** Render order — reflects the typical crafting scenario (iter 83 §4.7):
 *  1. End-game goals: Spirit, skill levels, attributes.
 *  2. Survivability: resources (life/mana/ES), runes barrier, resistances, defence stats.
 *  3. Offence: speed, crit, damage type, penetration, ailments.
 *  4. Mechanics: area/duration, wisps, buff skills, minions, meta, weapon.
 *  5. Misc: flasks, MF, conversion, rage/charges, breach.
 *  6. Fallback: other.
 *
 *  iter 89: 20 implemented blocks + `other` will actually appear in production.
 *  iter 93: `penetration` block activated (3 family-keys moved from resistances).
 *  iter 95: `wisps` + `conversion` are RESERVED-FOR-FUTURE entries — 0 family-keys
 *  in current data. Kept in type + render order for forward-compat: if ETL ever
 *  classifies a token as `wisps`/`conversion` (e.g., new poe2db mod), it will
 *  render correctly without code changes. To deactivate, remove from this array
 *  AND from FUNCTIONAL_BLOCK_LABELS — but doing so silently drops future mods
 *  with that category. */
const FUNCTIONAL_BLOCK_ORDER: FunctionalBlock[] = [
  'spirit', 'skill-levels', 'attributes', 'resources',
  'runes-barrier', 'resistances', 'defence-stats',
  'offence-speed', 'crit', 'damage-type', 'penetration', 'ailments',
  'area-duration', 'wisps', 'buff-skills', 'minions', 'meta-skills', 'weapon-specific',
  'flasks', 'magic-find', 'conversion', 'rage-charges',
  'breach',
  'other',
];

// ─── Weapon class classification (iter 87: jewel weapon sub-blocks) ───

/**
 * Weapon class categories for jewel weapon-specific mods.
 *
 * 24 weapon-specific family-keys (10 unique weapons in jewel.json) are grouped
 * into 6 functional weapon-class sub-blocks that reflect PoE2 build archetypes:
 *  - `melee`: мечи / топоры / булавы / кистени / без оружия (basic 1H+2H melee + unarmed)
 *  - `bow`: луки (ranged Dex weapons)
 *  - `crossbow`: самострелы (ranged reload weapons)
 *  - `staff`: боевые посохи (2H caster/melee hybrids)
 *  - `spear`: копья (1H+shield melee with crit flavour)
 *  - `dagger`: кинжалы (1H crit/spell weapons)
 *
 * Source: docs/AFFIXES_GROUPING_ANALYSIS.md §3 + §4.2.
 */
export type WeaponClass = 'melee' | 'bow' | 'crossbow' | 'staff' | 'spear' | 'dagger';

/** Display config for each weapon class (iter 87). */
export const WEAPON_CLASS_LABELS: Record<WeaponClass, CategoryLabel> = {
  melee:     { label: 'Ближний бой',   colorClass: 'text-accent-red',    bgClass: 'bg-section-red',     borderClass: 'border-sborder-red',     borderLClass: '' },
  bow:       { label: 'Луки',          colorClass: 'text-accent-teal',   bgClass: 'bg-section-emerald', borderClass: 'border-sborder-emerald', borderLClass: '' },
  crossbow:  { label: 'Самострелы',    colorClass: 'text-accent-teal',   bgClass: 'bg-section-emerald', borderClass: 'border-sborder-emerald', borderLClass: '' },
  staff:     { label: 'Боевые посохи', colorClass: 'text-accent-blue',   bgClass: 'bg-section-blue',    borderClass: 'border-cborder-blue',    borderLClass: '' },
  spear:     { label: 'Копья',         colorClass: 'text-accent-amber',  bgClass: 'bg-section-amber',   borderClass: 'border-sborder-amber',   borderLClass: '' },
  dagger:    { label: 'Кинжалы',       colorClass: 'text-accent-violet', bgClass: 'bg-section-violet',  borderClass: 'border-sborder-violet',  borderLClass: '' },
};

/** Render order — matches the order in WEAPON_CLASS_LABELS declaration. */
const WEAPON_CLASS_ORDER: WeaponClass[] = [
  'melee', 'bow', 'crossbow', 'staff', 'spear', 'dagger',
];

/**
 * Weapon name → weapon class mapping.
 *
 * Built from the 10 weapon name variants in `jewel.json` (verified by simulation
 * in iter 87). Each weapon name is matched as a whole word using a non-capturing
 * group with word boundaries `\b` to prevent false positives on substrings
 * (e.g., «посохами» should NOT match «боевыми посохами» rules individually).
 *
 * Notes:
 *  - `без оружия` is included in `melee` (unarmed = implicit melee archetype).
 *  - `боевыми посохами` is matched BEFORE `посохами` (longest match first),
 *    but only «боевые посохи» appear in jewel.json — there are no plain «посохи»
 *    mods. So matching order is defensive, not functional.
 *  - `кистенями` (flails) are in `melee` — they're 1H melee weapons.
 */
const WEAPON_NAME_TO_CLASS: { pattern: RegExp; weaponClass: WeaponClass }[] = [
  // ─── melee (мечи / топоры / булавы / кистени / без оружия) ───
  // Place "без оружия" before "оружия" patterns and longer weapon names first.
  { pattern: /без оружия/i, weaponClass: 'melee' },
  { pattern: /мечами/i, weaponClass: 'melee' },
  { pattern: /топорами/i, weaponClass: 'melee' },
  { pattern: /булавами/i, weaponClass: 'melee' },
  { pattern: /кистенями/i, weaponClass: 'melee' },
  // ─── bow ───
  { pattern: /луками/i, weaponClass: 'bow' },
  // ─── crossbow ───
  { pattern: /самострелами/i, weaponClass: 'crossbow' },
  // ─── staff (боевые посохи — note: longer match first, before any plain «посохами») ───
  { pattern: /боевыми посохами/i, weaponClass: 'staff' },
  // ─── spear ───
  { pattern: /копьями/i, weaponClass: 'spear' },
  // ─── dagger ───
  { pattern: /кинжалами/i, weaponClass: 'dagger' },
];

/**
 * Classify a FamilyGroup into a weapon class.
 *
 * Returns `null` if the group's text does NOT contain any of the 10 weapon name
 * variants. Used by `classifyGroups(mode='jewel-functional')` to split the
 * `weapon-specific` functional block into 6 weapon-class sub-blocks for the
 * JewelPage rendering.
 *
 * Match strategy: first-match-wins on the WEAPON_NAME_TO_CLASS array. Order is
 * carefully arranged so that:
 *  - «без оружия» matches before any other "оружия" substring (defensive).
 *  - «боевыми посохами» matches before any plain «посохами» (defensive — no
 *    such mods exist in current jewel.json, but pattern is future-proof).
 *
 * @param group - The FamilyGroup to classify (typically already in `weapon-specific` block)
 * @returns WeaponClass key, or `null` if not a weapon mod
 */
export function classifyWeaponClass(group: FamilyGroup): WeaponClass | null {
  const text = group.displayText;
  for (const { pattern, weaponClass } of WEAPON_NAME_TO_CLASS) {
    if (pattern.test(text)) return weaponClass;
  }
  return null;
}

/**
 * Classify a FamilyGroup into a functional block.
 *
 * iter 96: this function is a thin Strategy 0 wrapper. The 22-step regex
 * classifier that lived here in iter 85-95 has been removed; classification
 * now comes entirely from `functionalCategory` populated by the ETL pipeline
 * (scripts/etl/classify-functional-category.ts). The 22-step regex logic is
 * preserved in the ETL classifier for documentation/audit purposes.
 *
 * Strategy:
 *  1. If any member has `functionalCategory`, majority-vote across all members
 *     and return the most common value (validated against FUNCTIONAL_BLOCK_ORDER).
 *  2. Otherwise, return `'other'` (waystone/tablet/relic never reach this
 *     function; jewel/jewellery tokens always have ETL-tagged functionalCategory
 *     in production — 477/477 family-groups covered as of iter 94).
 *
 * @param group - The FamilyGroup to classify
 * @returns FunctionalBlock key
 */
export function classifyFunctionalBlock(group: FamilyGroup): FunctionalBlock {
  // ─── Strategy 0: ETL lookup (production path, ~100% accurate) ──────────────
  // iter 91+: ETL pipeline populates `functionalCategory` on every token in
  // jewel/amulet/ring/belt (477/477 family-groups covered). Strategy 0 returns
  // the majority-voted functionalCategory directly — no regex needed.
  //
  // iter 96: the regex fallback that lived here in iter 85-95 has been REMOVED.
  //   - All 280 unit tests in tests/shared/mod-classifier.test.ts were refactored
  //     to set `functionalCategory` on synthetic groups via makeGroup() overrides,
  //     so they exercise Strategy 0 directly (mirroring production).
  //   - Tests that expect `'other'` leave `functionalCategory` unset, hitting the
  //     `return 'other';` fallback below.
  //   - The 22-step regex logic is preserved in scripts/etl/classify-functional-category.ts
  //     (used at ETL time to populate functionalCategory).
  if (group.members.length > 0 && group.members[0].functionalCategory) {
    // Use majority voting across all members
    const catCounts: Record<string, number> = {};
    for (const member of group.members) {
      if (member.functionalCategory) {
        catCounts[member.functionalCategory] = (catCounts[member.functionalCategory] || 0) + 1;
      }
    }
    // Find the most common category
    let bestCat = '';
    let bestCount = 0;
    for (const [cat, count] of Object.entries(catCounts)) {
      if (count > bestCount) {
        bestCount = count;
        bestCat = cat;
      }
    }
    // Validate against FunctionalBlock type
    const validBlocks = new Set<string>(FUNCTIONAL_BLOCK_ORDER);
    if (bestCat && validBlocks.has(bestCat)) {
      return bestCat as FunctionalBlock;
    }
  }

  // Fallback — mods without ETL-tagged functionalCategory (waystone/tablet/relic
  // never reach this function; jewel/jewellery with missing ETL data land here).
  return 'other';
}

// ─── Unified classification ───

/** Grouping mode determines how mods are sub-categorized within affix columns */
export type ModGroupMode =
  | 'affix-semantic'    // prefix/suffix → offensive/defensive/attribute/neutral (legacy, replaced by affix-functional for ring/amulet/belt)
  | 'affix-functional'  // prefix/suffix → 24 functional blocks (iter 89: 20 active + other) — ring/amulet/belt
  | 'jewel-functional'  // iter 87: same as affix-functional, BUT weapon-specific block is split into 6 weapon-class sub-blocks (melee/bow/crossbow/staff/spear/dagger) — jewel only
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
  bgClass: string;
  borderClass: string;
  /** Left accent border class for Level 2 origin badges (e.g. 'border-l-purple-400').
   *  Empty string for Level 3 semantic/sentiment/tablet/jewel-type badges. */
  borderLClass: string;
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
      bgClass: '',
      borderClass: '',
      borderLClass: '',
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
        bgClass: SEMANTIC_LABELS[cat].bgClass,
        borderClass: SEMANTIC_LABELS[cat].borderClass,
        borderLClass: SEMANTIC_LABELS[cat].borderLClass,
        groups: classified.get(cat)!,
      }));
  }

  if (mode === 'affix-functional') {
    // iter 86: classify each group into a functional block (14 active + other).
    // Groups are returned in FUNCTIONAL_BLOCK_ORDER so the UI shows them in
    // the typical crafting scenario order (Spirit → Skill levels → Attributes → …).
    const classified = new Map<FunctionalBlock, FamilyGroup[]>();

    for (const group of groups) {
      const block = classifyFunctionalBlock(group);
      const list = classified.get(block) || [];
      list.push(group);
      classified.set(block, list);
    }

    return FUNCTIONAL_BLOCK_ORDER
      .filter(block => classified.has(block) && classified.get(block)!.length > 0)
      .map(block => ({
        key: block,
        label: FUNCTIONAL_BLOCK_LABELS[block].label,
        colorClass: FUNCTIONAL_BLOCK_LABELS[block].colorClass,
        bgClass: FUNCTIONAL_BLOCK_LABELS[block].bgClass,
        borderClass: FUNCTIONAL_BLOCK_LABELS[block].borderClass,
        borderLClass: FUNCTIONAL_BLOCK_LABELS[block].borderLClass,
        groups: classified.get(block)!,
      }));
  }

  if (mode === 'jewel-functional') {
    // iter 87: variant of `affix-functional` for JewelPage. Identical to
    // `affix-functional` EXCEPT the `weapon-specific` block is split into
    // 6 weapon-class sub-blocks (melee/bow/crossbow/staff/spear/dagger).
    //
    // Architecture: this is a "render-time split" — we first classify all
    // groups by `classifyFunctionalBlock()` (which puts the 24 weapon family-keys
    // into `weapon-specific`), then within that bucket we re-classify each
    // group by `classifyWeaponClass()` to produce 6 sub-blocks. Each sub-block
    // gets its own `key` (`weapon-melee`, `weapon-bow`, …) and distinct
    // colour from WEAPON_CLASS_LABELS.
    //
    // The 6 weapon sub-blocks are rendered in place of the original
    // `weapon-specific` block in FUNCTIONAL_BLOCK_ORDER. All other functional
    // blocks (spirit/skill-levels/attributes/…/other) are returned unchanged.
    const classified = new Map<FunctionalBlock, FamilyGroup[]>();

    for (const group of groups) {
      const block = classifyFunctionalBlock(group);
      const list = classified.get(block) || [];
      list.push(group);
      classified.set(block, list);
    }

    const result: ModSubGroup[] = [];

    for (const block of FUNCTIONAL_BLOCK_ORDER) {
      const blockGroups = classified.get(block);
      if (!blockGroups || blockGroups.length === 0) continue;

      if (block !== 'weapon-specific') {
        // Default rendering — same as affix-functional mode.
        result.push({
          key: block,
          label: FUNCTIONAL_BLOCK_LABELS[block].label,
          colorClass: FUNCTIONAL_BLOCK_LABELS[block].colorClass,
          bgClass: FUNCTIONAL_BLOCK_LABELS[block].bgClass,
          borderClass: FUNCTIONAL_BLOCK_LABELS[block].borderClass,
          borderLClass: FUNCTIONAL_BLOCK_LABELS[block].borderLClass,
          groups: blockGroups,
        });
        continue;
      }

      // ─── weapon-specific: split into 6 weapon-class sub-blocks ───
      // Each weapon mod gets classified via classifyWeaponClass(). If a group
      // somehow returns null (defensive — shouldn't happen for current jewel
      // data), it falls into a `weapon-other` fallback bucket so it's never
      // silently dropped.
      const byWeaponClass = new Map<WeaponClass | 'other', FamilyGroup[]>();
      for (const group of blockGroups) {
        const wc = classifyWeaponClass(group);
        const key: WeaponClass | 'other' = wc ?? 'other';
        const list = byWeaponClass.get(key) || [];
        list.push(group);
        byWeaponClass.set(key, list);
      }

      // Emit 6 weapon sub-blocks in WEAPON_CLASS_ORDER, then the `weapon-other`
      // fallback (only if non-empty — defensive).
      for (const wc of WEAPON_CLASS_ORDER) {
        const wcGroups = byWeaponClass.get(wc);
        if (!wcGroups || wcGroups.length === 0) continue;
        const labelCfg = WEAPON_CLASS_LABELS[wc];
        result.push({
          key: `weapon-${wc}`,
          label: labelCfg.label,
          colorClass: labelCfg.colorClass,
          bgClass: labelCfg.bgClass,
          borderClass: labelCfg.borderClass,
          borderLClass: labelCfg.borderLClass,
          groups: wcGroups,
        });
      }
      const otherWeaponGroups = byWeaponClass.get('other');
      if (otherWeaponGroups && otherWeaponGroups.length > 0) {
        // Defensive fallback: weapon mods that don't match any known weapon
        // name. Should never trigger on current jewel.json. Kept here to
        // avoid silent data loss if new weapon mods are added in future
        // PoE2 patches.
        result.push({
          key: 'weapon-other',
          label: FUNCTIONAL_BLOCK_LABELS['weapon-specific'].label,
          colorClass: FUNCTIONAL_BLOCK_LABELS['weapon-specific'].colorClass,
          bgClass: FUNCTIONAL_BLOCK_LABELS['weapon-specific'].bgClass,
          borderClass: FUNCTIONAL_BLOCK_LABELS['weapon-specific'].borderClass,
          borderLClass: FUNCTIONAL_BLOCK_LABELS['weapon-specific'].borderLClass,
          groups: otherWeaponGroups,
        });
      }
    }

    return result;
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
        bgClass: SENTIMENT_LABELS[cat].bgClass,
        borderClass: SENTIMENT_LABELS[cat].borderClass,
        borderLClass: SENTIMENT_LABELS[cat].borderLClass,
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
        bgClass: TABLET_TYPE_LABELS[cat].bgClass,
        borderClass: TABLET_TYPE_LABELS[cat].borderClass,
        borderLClass: TABLET_TYPE_LABELS[cat].borderLClass,
        groups: classified.get(cat)!,
      }));
  }

  if (mode === 'origin') {
    // Split each family group by origin so that mixed-origin groups
    // (e.g., normal + desecrated members sharing the same familyKey)
    // produce separate sub-groups for each origin.
    // This prevents normal mods from being classified as desecrated
    // just because they share a familyKey with desecrated mods.
    const classified = new Map<ModOrigin, FamilyGroup[]>();
    const originOrder: ModOrigin[] = ['normal', 'desecrated', 'corrupted', 'essence', 'breachborn'];

    for (const group of groups) {
      const splits = splitGroupByOrigin(group);
      for (const { origin, group: splitGroup } of splits) {
        const list = classified.get(origin) || [];
        list.push(splitGroup);
        classified.set(origin, list);
      }
    }

    return originOrder
      .filter(origin => classified.has(origin) && classified.get(origin)!.length > 0)
      .map(origin => ({
        key: origin,
        label: ORIGIN_SECTION_LABELS[origin]?.label ?? t('origin.' + origin),
        colorClass: ORIGIN_SECTION_LABELS[origin]?.colorClass ?? 'text-muted',
        bgClass: ORIGIN_SECTION_LABELS[origin]?.bgClass ?? '',
        borderClass: ORIGIN_SECTION_LABELS[origin]?.borderClass ?? '',
        borderLClass: ORIGIN_SECTION_LABELS[origin]?.borderLClass ?? '',
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
        bgClass: JEWEL_TYPE_LABELS[cat].bgClass,
        borderClass: JEWEL_TYPE_LABELS[cat].borderClass,
        borderLClass: JEWEL_TYPE_LABELS[cat].borderLClass,
        groups: classified.get(cat)!,
      }));
  }

  // Fallback
  return [{ key: 'all', label: '', colorClass: '', bgClass: '', borderClass: '', borderLClass: '', groups }];
}
