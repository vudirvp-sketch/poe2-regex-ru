/**
 * Normalize raw mod data into the NormalizedMod format.
 * - Extract ranges and values from mod-value spans
 * - Generate internal_id from mod code or English name
 * - Extract gender inflection forms (supports both lowercase and UPPERCASE keys)
 * - Mark E positions for yofication
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

/**
 * Normalize a Type A raw mod into NormalizedMod
 */
export function normalizeTypeA(
  raw: RawModData,
  category: string,
  origin: ModOrigin
): NormalizedMod {
  const { rawText, rawTextTemplate, ranges, values } = extractTextAndRanges(raw.descriptionHtml);

  const genderForms = extractGenderForms(raw.nameHtml);
  const { hasYofication, yoficationPositions } = detectYofication(rawText);

  const id = generateId(raw.modCode, category, rawText, raw.origin || origin);

  return {
    id,
    category,
    origin: raw.origin || origin,
    rawText: { ru: rawText },
    rawTextTemplate: { ru: rawTextTemplate },
    genderForms: { ru: genderForms },
    affix: raw.affix,
    tags: raw.tags || [],
    ranges,
    values,
    hasYofication,
    yoficationPositions,
    level: raw.level,
    modCode: raw.modCode,
  };
}

/**
 * Normalize a Type B raw mod tier into NormalizedMod
 */
export function normalizeTypeB(
  tier: RawModTier,
  group: RawModGroupData,
  category: string
): NormalizedMod {
  const { rawText, rawTextTemplate, ranges, values } = extractTextAndRanges(tier.descriptionHtml);

  const genderForms = extractGenderForms(tier.nameHtml);
  const { hasYofication, yoficationPositions } = detectYofication(rawText);

  const id = generateId(tier.modCode || group.genGroup, category, rawText, group.origin);

  // Use the affix from the tier if available, otherwise infer
  const affix: AffixType = tier.affix || inferAffix(rawText);

  return {
    id,
    category,
    origin: group.origin,
    rawText: { ru: rawText },
    rawTextTemplate: { ru: rawTextTemplate },
    genderForms: { ru: genderForms },
    affix,
    tags: tier.tags?.length > 0 ? tier.tags : group.tags,
    ranges,
    values,
    hasYofication,
    yoficationPositions,
    level: tier.level,
    modCode: tier.modCode,
  };
}

/**
 * Extract clean text, template text, ranges, and values from description HTML.
 *
 * Handles:
 * - Numeric ranges: (5<span class="ndash">—</span>9) -> ranges[[5,9]], template uses ##
 * - Standalone numbers: values[], template uses #
 * - Gender templates: <if:MS>...</if:MS> -> extracted separately
 * - Multi-line mods separated by <br> — CURRENTLY only first line taken (see MEDIUM #3 in AGENT_NAVIGATION.md)
 *
 * IMPORTANT: poe2db.tw stores multiple related properties in one description cell,
 * separated by <br>. In-game, each sub-line is a SEPARATE searchable block (verified
 * Phase 7 Block 3 / Group I). The current code takes only the first line for most
 * multi-line mods, which means users can't search for text in subsequent sub-lines.
 * For "dual-stat" mods (multiple segments each with ranges), segments are joined with
 * ", " which also doesn't match in-game behavior.
 *
 * TODO: Split each <br> segment into a separate token so each sub-line is independently
 * searchable. Each sub-line is a separate block in PoE2 search, so this matches the
 * in-game model correctly.
 */
export function extractTextAndRanges(html: string): {
  rawText: string;
  rawTextTemplate: string;
  ranges: number[][];
  values: number[];
} {
  // Split by <br> tags and take only the FIRST segment.
  // On poe2db.tw waystone/tablet pages, the description cell often contains:
  //   "Actual affix text<br>Implicit bonus 1<br>Implicit bonus 2"
  // Only the first line is the affix that appears in the item's mod list.
  // Subsequent lines are implicit properties that appear on the item tooltip
  // but are NOT separate searchable affixes.
  //
  // EXCEPTION: For desecrated jewel dual-stat mods, <br> separates two parts
  // of the SAME affix (e.g., "(5—10)% повышение брони<br>(4—8)% увеличение урона от атак").
  // In-game, these appear as ONE mod line with a comma. Splitting them loses
  // the second stat and causes familyKey collisions with normal mods.
  // Detection: if multiple segments each contain numeric ranges, this is likely
  // a dual-stat mod, not an implicit bonus. We join them with ", " instead.
  const segments = html.split(/<br\s*\/?>/i);

  let firstSegment: string;
  if (segments.length > 1) {
    // Check if multiple segments each contain numeric ranges — indicates a dual-stat mod.
    // The range pattern needs to account for HTML tags like <span class="ndash">—</span>
    // that break the plain-text range pattern. We detect dual-stat mods by checking
    // that multiple segments each have their OWN <span class="mod-value"> with a ndash
    // (range indicator). Single-value mod-value spans (like ": 1") don't count.
    //
    // This distinguishes:
    // - Dual-stat: "(5—10)% повышение брони<br>(4—8)% увеличение урона от атак"
    //   → both segments have ranges → join them
    // - Waystone implicit: "Дополнительных свойств: 1<br>25% увеличение количества..."
    //   → only first has mod-value, or first has single value → take only first
    const modValueWithRangePattern = /class=['"]mod-value['"][^>]*>\([^<]*<span\s+class=["']ndash["']>/i;
    const segmentsWithRangeValues = segments.filter(s => modValueWithRangePattern.test(s));

    if (segmentsWithRangeValues.length >= 2) {
      // Dual-stat mod: join all segments with ", " (how they appear in-game)
      firstSegment = segments.join(', ');
    } else {
      // Standard case: only first segment is the actual affix
      firstSegment = segments[0];
    }
  } else {
    firstSegment = segments[0];
  }

  const $ = cheerio.load(firstSegment);
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
      // Store as integers scaled by 10 if fractional, otherwise as-is
      // For fractional ranges like (2.1—3), store [21, 30] with a note
      // Actually, keep as floats for now — downstream code handles integer ranges
      // Round to avoid floating-point issues: 2.1 → 2.1, 3 → 3
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
  // These appear as <span class="badge" data-tag="armour">Броня</span>
  // or similar elements with data-tag attributes.
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
    // Replace the first occurrence of "(min—max)" or "(min-max)" pattern
    // Use the original text representation to match (handles fractional values)
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
function generateId(
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
