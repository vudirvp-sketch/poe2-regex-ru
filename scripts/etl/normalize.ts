/**
 * Normalize raw mod data into the NormalizedMod format.
 * - Extract ranges and values from mod-value spans
 * - Generate internal_id from mod code or English name
 * - Extract gender inflection forms (supports both lowercase and UPPERCASE keys)
 * - Mark E positions for yofication
 * - Split multi-line mods (<br> segments) into separate tokens
 * - Identify and filter implicit-set bonuses (not searchable in-game)
 * - Generate implicit tokens for waystone/tablet categories
 */
import type { Locale, AffixType, ModOrigin, GenderForms } from '../../src/shared/types.js';
import type { RawModData } from './parse-tables.js';
import type { RawModTier, RawModGroupData } from './parse-modifiers-calc.js';
import * as cheerio from 'cheerio';

export interface NormalizedMod {
  id: string;
  category: string;
  origin: ModOrigin;
  rawText: Record<Locale, string>;
  rawTextTemplate: Record<Locale, string>;
  genderForms: Record<Locale, GenderForms>;
  affix: AffixType;
  tags: string[];
  ranges: number[][];
  values: number[];
  hasYofication: boolean;
  yoficationPositions: number[];
  level: number;
  modCode?: string;
}

/** Result of extracting text/ranges from a single <br>-separated segment */
export interface ExtractedSegment {
  rawText: string;
  rawTextTemplate: string;
  ranges: number[][];
  values: number[];
}

/**
 * Normalize a Type A raw mod into one or more NormalizedMods.
 * Multi-line mods (<br> segments) are split into separate tokens,
 * each with an ID suffix like .1, .2, etc.
 */
export function normalizeTypeA(
  raw: RawModData,
  category: string,
  origin: ModOrigin
): NormalizedMod[] {
  const segments = extractTextAndRanges(raw.descriptionHtml);
  const genderForms = extractGenderForms(raw.nameHtml);
  const baseId = generateId(raw.modCode, category, segments[0].rawText, raw.origin || origin);

  return segments.map((seg) => {
    // For multi-segment mods, use a hash of the segment's rawText as suffix
    // instead of a simple index. This avoids ID collisions when different tiers
    // of the same modCode have different second segments (e.g., desecrated jewels).
    const id = segments.length > 1
      ? `${baseId}.${simpleHash(seg.rawText)}`
      : baseId;
    const { hasYofication, yoficationPositions } = detectYofication(seg.rawText);

    return {
      id,
      category,
      origin: raw.origin || origin,
      rawText: { ru: seg.rawText },
      rawTextTemplate: { ru: seg.rawTextTemplate },
      genderForms: { ru: genderForms },
      affix: raw.affix,
      tags: raw.tags || [],
      ranges: seg.ranges,
      values: seg.values,
      hasYofication,
      yoficationPositions,
      level: raw.level,
      modCode: raw.modCode,
    };
  });
}

/**
 * Normalize a Type B raw mod tier into one or more NormalizedMods.
 * Multi-line mods (<br> segments) are split into separate tokens,
 * each with an ID suffix like .1, .2, etc.
 */
export function normalizeTypeB(
  tier: RawModTier,
  group: RawModGroupData,
  category: string
): NormalizedMod[] {
  const segments = extractTextAndRanges(tier.descriptionHtml);
  const genderForms = extractGenderForms(tier.nameHtml);
  const baseId = generateId(tier.modCode || group.genGroup, category, segments[0].rawText, group.origin);

  return segments.map((seg) => {
    // For multi-segment mods, use a hash of the segment's rawText as suffix
    const id = segments.length > 1
      ? `${baseId}.${simpleHash(seg.rawText)}`
      : baseId;
    const affix: AffixType = tier.affix || inferAffix(seg.rawText);
    const { hasYofication, yoficationPositions } = detectYofication(seg.rawText);

    return {
      id,
      category,
      origin: group.origin,
      rawText: { ru: seg.rawText },
      rawTextTemplate: { ru: seg.rawTextTemplate },
      genderForms: { ru: genderForms },
      affix,
      tags: tier.tags?.length > 0 ? tier.tags : group.tags,
      ranges: seg.ranges,
      values: seg.values,
      hasYofication,
      yoficationPositions,
      level: tier.level,
      modCode: tier.modCode,
    };
  });
}

/**
 * Extract clean text, template text, ranges, and values from description HTML.
 *
 * Handles:
 * - Numeric ranges: (5<span class="ndash">—</span>9) -> ranges[[5,9]], template uses ##
 * - Standalone numbers: values[], template uses #
 * - Gender templates: <if:MS>...</if:MS> -> extracted separately
 * - Multi-line mods separated by <br> — each segment is a SEPARATE searchable block
 *
 * Each <br>-separated segment becomes its own token in the output array.
 * In-game, each sub-line is a separate searchable block (verified Phase 7 Block 3 / Group I).
 * This matches in-game behavior where searching for text in any sub-line finds the item.
 *
 * Token IDs use suffixes: waystone.mod_dv8kwa.1, waystone.mod_dv8kwa.2, etc.
 */
export function extractTextAndRanges(html: string): ExtractedSegment[] {
  const htmlSegments = html.split(/<br\s*\/?>/i);

  const results: ExtractedSegment[] = [];

  for (const segmentHtml of htmlSegments) {
    const trimmed = segmentHtml.trim();
    if (!trimmed) continue; // skip empty segments

    const segment = parseSingleSegment(trimmed);
    if (segment.rawText.length === 0) continue; // skip segments that parse to empty

    results.push(segment);
  }

  // If no segments produced results, return at least one empty result
  // (shouldn't happen normally, but guards against edge cases)
  if (results.length === 0) {
    return [{ rawText: '', rawTextTemplate: '', ranges: [], values: [] }];
  }

  return results;
}

/**
 * Parse a single HTML segment (no <br> tags) into rawText, template, ranges, and values.
 */
function parseSingleSegment(html: string): ExtractedSegment {
  const $ = cheerio.load(html);
  const ranges: number[][] = [];
  const values: number[] = [];

  // Extract numeric ranges from mod-value spans with ndash
  $('span.mod-value').each((_, el) => {
    const text = $(el).text().trim();

    // Range pattern: (5—9) or (5-9) or (-10—20) or +(1—2) or (2.1—3) (fractional)
    const rangeMatch = text.match(/\(([+-]?\d+(?:\.\d+)?)\s*[—–-]\s*([+-]?\d+(?:\.\d+)?)\)/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      ranges.push([min, max]);
    }

    // Single number in mod-value (not part of a range)
    // Also supports fractional single values like 2.5
    const singleMatch = text.match(/^([+-]?\d+(?:\.\d+)?)$/);
    if (singleMatch && !rangeMatch) {
      values.push(parseFloat(singleMatch[1]));
    }
  });

  // Build raw text by getting all text content
  // First, remove secondary spans (internal stat identifiers)
  $('span.secondary').remove();
  // Remove crafting tag badges — they contain labels like "Броня", "Атака",
  // "Урон Стихийный" etc. that are NOT part of the mod text.
  $('[data-tag]').remove();
  // Also remove badge elements without data-tag (some pages use
  // <span class="badge bg-primary craftingfire">Огонь</span>)
  $('span.badge[class*="crafting"]').remove();

  let rawText = $.root().text().trim();
  // Normalize whitespace (multiple spaces, newlines)
  rawText = rawText.replace(/\s+/g, ' ').trim();

  // Build template: replace ranges with ##, single values with #
  let rawTextTemplate = rawText;

  // Replace ranges in reverse order to maintain positions
  for (let i = ranges.length - 1; i >= 0; i--) {
    const [min, max] = ranges[i];
    const minStr = Number.isInteger(min) ? String(min) : String(min);
    const maxStr = Number.isInteger(max) ? String(max) : String(max);
    const rangeStr = `(${minStr}—${maxStr})`;
    const rangeStrAlt = `(${minStr}-${maxStr})`;
    rawTextTemplate = rawTextTemplate.replace(rangeStr, '##').replace(rangeStrAlt, '##');
  }

  // Replace standalone values (be careful with negative numbers and context)
  for (const val of values) {
    const escaped = String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rawTextTemplate = rawTextTemplate.replace(
      new RegExp(`(?<!\\d)${escaped}(?!\\d)`, 'g'),
      '#'
    );
  }

  return { rawText, rawTextTemplate, ranges, values };
}

/**
 * Extract gender inflection forms from HTML containing <if:MS> templates.
 *
 * Template format (poe2db.tw uses UPPERCASE keys):
 * <if:MS>{Глубинный}<elif:FS>{Глубинная}<elif:NS>{Глубинное}
 * <elif:MP>{Глубинные}<elif:FP>{Глубинные}<elif:NP>{Глубинные}
 * </if:NP></elif:FP></elif:MP></elif:NS></elif:FS></if:MS>
 *
 * Also supports lowercase: <if:ms> / <elif:ms> etc.
 */
export function extractGenderForms(html: string): GenderForms {
  const forms: GenderForms = {};

  // Map both uppercase and lowercase keys to GenderForms keys
  const keyMappings: [string, keyof GenderForms][] = [
    ['MS', 'ms'], ['ms', 'ms'],
    ['FS', 'fs'], ['fs', 'fs'],
    ['NS', 'ns'], ['ns', 'ns'],
    ['MP', 'mp'], ['mp', 'mp'],
    ['FP', 'fp'], ['fp', 'fp'],
    ['NP', 'np'], ['np', 'np'],
  ];

  for (const [templateKey, formKey] of keyMappings) {
    if (forms[formKey]) continue; // Already found (uppercase takes priority)

    // Match <if:KEY>{content} or <elif:KEY>{content}
    const regex = new RegExp(`(?:<if:${templateKey}>|<elif:${templateKey}>)\\{([^}]+)\\}`, 'g');
    const match = regex.exec(html);
    if (match) {
      forms[formKey] = match[1];
    }
  }

  return forms;
}

/**
 * Detect if the text contains positions where yofication (е -> [её]) applies.
 * Yofication is relevant when the root morpheme could use Ё in standard Russian.
 */
export function detectYofication(text: string): {
  hasYofication: boolean;
  yoficationPositions: number[];
} {
  const positions: number[] = [];
  const lower = text.toLowerCase();

  // Common Russian roots where е/ё alternation occurs
  // This is a simplified heuristic — the ETL pipeline will refine this
  const yoficationRoots = [
    'ёж', 'жён', 'жёт', 'жёл', 'щё', 'чё', 'шё',
    'всё', 'сё', 'лё', 'мё', 'рё', 'нё', 'тё', 'пё', 'бё', 'дё',
  ];

  for (let i = 0; i < lower.length; i++) {
    const char = lower[i];
    if (char === 'е' || char === 'ё') {
      // Check if this position could be a ё position
      const context = lower.slice(Math.max(0, i - 1), i + 3);
      for (const root of yoficationRoots) {
        if (context.includes(root.replace('ё', 'е'))) {
          positions.push(i);
          break;
        }
      }
    }
  }

  return {
    hasYofication: positions.length > 0,
    yoficationPositions: positions,
  };
}

/**
 * Generate an internal ID from the mod code or a fallback.
 * Format: {category}.{snake_case_description}[_{origin}]
 *
 * When the same mod code appears in multiple origins (normal, desecrated, etc.),
 * we append the origin suffix to differentiate them.
 */
export function generateId(
  modCode: string | undefined,
  category: string,
  rawText: string,
  origin: ModOrigin
): string {
  if (modCode) {
    // Clean up the mod code: strip non-alphanumeric, convert to snake_case
    const cleaned = modCode
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
    if (cleaned) {
      // Only append origin suffix for non-normal origins to avoid ID bloat
      if (origin !== 'normal') {
        return `${category}.${cleaned}_${origin}`;
      }
      return `${category}.${cleaned}`;
    }
  }

  // Fallback: generate a hash from the raw text + origin
  const hash = simpleHash(rawText + '|' + origin);
  return `${category}.mod_${hash}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Infer affix type from mod text heuristics.
 * This is a fallback when affix info is not available from parsing.
 */
function inferAffix(text: string): AffixType {
  // In PoE, prefix mods typically modify base stats, suffix mods modify secondary stats
  // This is a rough heuristic — the actual affix should come from parsed data
  const prefixIndicators = ['увеличение', 'повышение', 'добавляет', '+'];
  const lower = text.toLowerCase();

  for (const indicator of prefixIndicators) {
    if (lower.includes(indicator)) return 'prefix';
  }

  return 'suffix';
}

// ─── Implicit-Set Bonus Detection ────────────────────────────────────────────

/**
 * Family keys of implicit-set bonus tokens that are NOT searchable in-game.
 *
 * In PoE2, waystones and tablets have two types of searchable text:
 * 1. Mods (prefix/suffix): Format `##% description` — number BEFORE text
 * 2. Implicits: Format `Description: +##%` — number AFTER text (REVERSED regex)
 *
 * Implicit-set bonus tokens correspond to implicit properties but were listed as
 * mod text in poe2db's tables. They are NOT searchable as mod text in-game.
 * These tokens must be removed from the mod list and replaced with proper implicit
 * tokens that have reversed regex format.
 *
 * Keys MUST match `familyKey.ru` (normalized: `##` → `#`, collapse whitespace, trim)
 * in the corresponding category's generated JSON. Verified by tests in
 * `tests/etl/normalize.test.ts` (Bug #15 / KI-2 block).
 *
 * iter 76 (KI-3 resolved): reverted to original (pre-iter-75) keys because
 * poe2db.tw reverted text forms to OLD wording between 16-17 June 2025 and has
 * stayed stable since (verified 17 June 2026). iter 75's NEW-form keys stopped
 * matching the live poe2db source. OLD forms confirmed stable via
 * `curl https://poe2db.tw/ru/Waystones | grep -c "находимых в области"` (= 107).
 *
 * NOTE on tablet typo: poe2db source HTML has `% увеличение количества находимых
 * на карте путевых камней` (no `#` before `%`). We match the source verbatim —
 * this is NOT a typo we should "fix" in the key, because the key must equal the
 * (normalized) `familyKey.ru` of generated tokens.
 */
export const WAYSTONE_IMPLICIT_SET_FAMILY_KEYS: string[] = [
  'На #% больше находимых в области путевых камней',
  '#% увеличение эффективности монстров',
  'На #% больше редкости находимых в этой области предметов',
  'На #% больше размера групп монстров',
];

export const TABLET_IMPLICIT_SET_FAMILY_KEYS: string[] = [
  '% увеличение количества находимых на карте путевых камней',
];

/** All implicit-set bonus family keys by category */
const IMPLICIT_SET_FAMILY_KEYS_BY_CATEGORY: Record<string, string[]> = {
  waystone: WAYSTONE_IMPLICIT_SET_FAMILY_KEYS,
  'waystone-desecrated': WAYSTONE_IMPLICIT_SET_FAMILY_KEYS,
  tablet: TABLET_IMPLICIT_SET_FAMILY_KEYS,
};

/**
 * Check if a normalized mod's familyKey matches an implicit-set bonus pattern.
 * Implicit-set bonuses are NOT searchable as mod text in-game.
 */
export function isImplicitSetBonus(mod: NormalizedMod): boolean {
  const familyKeys = IMPLICIT_SET_FAMILY_KEYS_BY_CATEGORY[mod.category];
  if (!familyKeys) return false;
  return familyKeys.includes(mod.rawTextTemplate.ru
    .replace(/##/g, '#')
    .replace(/\s+/g, ' ')
    .trim());
}

/**
 * Filter out implicit-set bonus tokens from a normalized mod list.
 * Returns the filtered list with implicit-set bonuses removed.
 */
export function filterImplicitSetBonuses(mods: NormalizedMod[]): NormalizedMod[] {
  return mods.filter(mod => !isImplicitSetBonus(mod));
}

// ─── Implicit Token Generation ───────────────────────────────────────────────

/**
 * Range config for implicit tokens.
 *
 * iter 81 (Bug #16 closed): upper bound raised from 350 to 999. The previous
 * `350` was an arbitrary magic number that could clip high-tier waystone implicits
 * (top-tier waystones can roll implicit values well above 350 via implicit-set
 * bonus stacking). `999` is a safe 3-digit ceiling — the in-game regex engine
 * matches the displayed number, so any 1-3 digit value is correct. If a future
 * expansion ever rolls implicits above 999, raise this constant again.
 *
 * The lower bound stays at 0 — PoE2 implicits cannot roll negative values
 * (verified across all waystone/tablet implicit families).
 */
const IMPLICIT_RANGE_UNRESTRICTED = [0, 999] as const;

/**
 * Generate implicit tokens for waystone categories.
 * These tokens have `affix: 'implicit'` and reversed regex format
 * (text BEFORE number: `"suffix.*(number)%"` instead of `"(number)%.*suffix"`).
 *
 * @param category - 'waystone' or 'waystone-desecrated'
 * @param origin - 'normal' or 'desecrated'
 */
export function generateWaystoneImplicitTokens(category: string, origin: ModOrigin): NormalizedMod[] {
  return [
    {
      id: `${category}.implicit.waystone_drop_chance`,
      category,
      origin,
      rawText: { ru: 'Шанс выпадения путевого камня: +##%' },
      rawTextTemplate: { ru: 'Шанс выпадения путевого камня: +##%' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [[...IMPLICIT_RANGE_UNRESTRICTED]],
      values: [],
      hasYofication: true,
      yoficationPositions: [5, 20],
      level: 1,
    },
    {
      id: `${category}.implicit.item_rarity`,
      category,
      origin,
      rawText: { ru: 'Редкость предметов: +##%' },
      rawTextTemplate: { ru: 'Редкость предметов: +##%' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [[...IMPLICIT_RANGE_UNRESTRICTED]],
      values: [],
      hasYofication: true,
      yoficationPositions: [8],
      level: 1,
    },
    {
      id: `${category}.implicit.pack_size`,
      category,
      origin,
      rawText: { ru: 'Размер групп монстров: +##%' },
      rawTextTemplate: { ru: 'Размер групп монстров: +##%' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [[...IMPLICIT_RANGE_UNRESTRICTED]],
      values: [],
      hasYofication: true,
      yoficationPositions: [16],
      level: 1,
    },
    {
      id: `${category}.implicit.monster_effectiveness`,
      category,
      origin,
      rawText: { ru: 'Эффективность монстров: +##%' },
      rawTextTemplate: { ru: 'Эффективность монстров: +##%' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [[...IMPLICIT_RANGE_UNRESTRICTED]],
      values: [],
      hasYofication: true,
      yoficationPositions: [18],
      level: 1,
    },
    {
      id: `${category}.implicit.revives`,
      category,
      origin,
      rawText: { ru: 'Доступно возрождений: #' },
      rawTextTemplate: { ru: 'Доступно возрождений: #' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [],
      values: [0, 6],
      hasYofication: true,
      yoficationPositions: [4, 11],
      level: 1,
    },
  ];
}

/**
 * Generate implicit tokens for tablet category.
 */
export function generateTabletImplicitTokens(): NormalizedMod[] {
  return [
    {
      id: 'tablet.implicit.charges',
      category: 'tablet',
      origin: 'normal',
      rawText: { ru: 'Осталось зарядов - #' },
      rawTextTemplate: { ru: 'Осталось зарядов - #' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [],
      values: [1, 2, 3, 4, 5, 7, 8, 10],
      hasYofication: true,
      yoficationPositions: [6],
      level: 1,
    },
    {
      id: 'tablet.implicit.ritual_altars',
      category: 'tablet',
      origin: 'normal',
      rawText: { ru: 'Добавляет алтари Ритуала на карту' },
      rawTextTemplate: { ru: 'Добавляет алтари Ритуала на карту' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [],
      values: [],
      hasYofication: true,
      yoficationPositions: [4, 12],
      level: 1,
    },
    {
      id: 'tablet.implicit.breach',
      category: 'tablet',
      origin: 'normal',
      rawText: { ru: 'Добавляет Заражение на карту' },
      rawTextTemplate: { ru: 'Добавляет Заражение на карту' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [],
      values: [],
      hasYofication: true,
      yoficationPositions: [4],
      level: 1,
    },
    {
      id: 'tablet.implicit.abyss',
      category: 'tablet',
      origin: 'normal',
      rawText: { ru: 'Добавляет Бездны на карту' },
      rawTextTemplate: { ru: 'Добавляет Бездны на карту' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [],
      values: [],
      hasYofication: true,
      yoficationPositions: [4, 12],
      level: 1,
    },
    {
      id: 'tablet.implicit.vaal',
      category: 'tablet',
      origin: 'normal',
      rawText: { ru: 'Добавляет маяки ваал на карту' },
      rawTextTemplate: { ru: 'Добавляет маяки ваал на карту' },
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [],
      values: [],
      hasYofication: true,
      yoficationPositions: [4, 13],
      level: 1,
    },
  ];
}

/**
 * Get implicit tokens for a given category.
 * Returns empty array for categories that don't have implicit tokens.
 */
export function getImplicitTokensForCategory(category: string): NormalizedMod[] {
  switch (category) {
    case 'waystone':
      return generateWaystoneImplicitTokens('waystone', 'normal');
    case 'waystone-desecrated':
      return generateWaystoneImplicitTokens('waystone-desecrated', 'desecrated');
    case 'tablet':
      return generateTabletImplicitTokens();
    default:
      return [];
  }
}
