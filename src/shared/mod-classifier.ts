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
import { ORIGIN_LABELS } from './constants';

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
  'physical', 'chaos', 'ailment',
]);

/** Tags that indicate a defensive mod */
const DEFENSIVE_TAGS = new Set([
  'resistance', 'life', 'mana', 'armour', 'energy_shield', 'charm',
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

/** Keywords indicating a positive (beneficial) waystone mod */
const POSITIVE_KEYWORDS = /(?:редкость|количество|дополнительн|больше|повышен.*колич|повышен.*редк|дополнит.*сгустк|шанс.*сгустк|повышен.*опыт|качество)/i;

/** Keywords indicating a negative (detrimental) waystone mod */
const NEGATIVE_KEYWORDS = /(?:монстр|области|горят|ледене|отравлен|повышен.*порог|повышен.*урон монстр|повышен.*шанс крит.*монстр|холод.*нарастает|огонь.*нарастает|хаос.*нарастает)/i;

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

// ─── Unified classification ───

/** Grouping mode determines how mods are sub-categorized within affix columns */
export type ModGroupMode =
  | 'affix-semantic'    // prefix/suffix → offensive/defensive/attribute/neutral (amulet, ring, belt)
  | 'affix-sentiment'   // prefix/suffix → positive/negative/neutral (waystone)
  | 'affix-only'        // just prefix/suffix, no sub-groups (relic)
  | 'tablet-type'       // prefix/suffix → ritual/breach/delirium/vaal/expedition/generic (tablet)
  | 'origin';           // by origin: normal/desecrated/corrupted (jewel)

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
        label: ORIGIN_SECTION_LABELS[origin]?.label ?? ORIGIN_LABELS[origin] ?? origin,
        colorClass: ORIGIN_SECTION_LABELS[origin]?.colorClass ?? 'text-gray-400',
        groups: classified.get(origin)!,
      }));
  }

  // Fallback
  return [{ key: 'all', label: '', colorClass: '', groups }];
}
