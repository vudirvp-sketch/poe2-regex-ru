/**
 * Normalize raw mod data into the NormalizedMod format.
 * - Extract ranges and values from mod-value spans
 * - Generate internal_id from mod code or English name
 * - Extract gender inflection forms
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

  const id = generateId(raw.modCode, category, rawText);

  return {
    id,
    category,
    origin,
    rawText: { ru: rawText },
    rawTextTemplate: { ru: rawTextTemplate },
    genderForms: { ru: genderForms },
    affix: raw.affix,
    tags: [],
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

  const id = generateId(tier.modCode || group.genGroup, category, rawText);

  return {
    id,
    category,
    origin: group.origin,
    rawText: { ru: rawText },
    rawTextTemplate: { ru: rawTextTemplate },
    genderForms: { ru: genderForms },
    affix: inferAffix(rawText),
    tags: group.tags,
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
 * - Gender templates: <if:ms>...</if:ms> -> extracted separately
 */
export function extractTextAndRanges(html: string): {
  rawText: string;
  rawTextTemplate: string;
  ranges: number[][];
  values: number[];
} {
  const $ = cheerio.load(html);
  const ranges: number[][] = [];
  const values: number[] = [];

  // Extract numeric ranges from mod-value spans with ndash
  $('span.mod-value').each((_, el) => {
    const text = $(el).text().trim();
    
    // Range pattern: (5—9) or (5-9)
    const rangeMatch = text.match(/\(([+-]?\d+)\s*[—–-]\s*([+-]?\d+)\)/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      ranges.push([min, max]);
    }
    
    // Single number in mod-value
    const singleMatch = text.match(/^([+-]?\d+)$/);
    if (singleMatch && !rangeMatch) {
      values.push(parseInt(singleMatch[1], 10));
    }
  });

  // Build raw text by getting all text content
  let rawText = $.root().text().trim();
  // Normalize whitespace
  rawText = rawText.replace(/\s+/g, ' ').trim();

  // Build template: replace ranges with ##, single values with #
  let rawTextTemplate = rawText;
  
  // Replace ranges in reverse order to maintain positions
  for (let i = ranges.length - 1; i >= 0; i--) {
    const [min, max] = ranges[i];
    // Replace the first occurrence of "min—max" or "(min—max)" pattern
    const rangeStr = `(${min}—${max})`;
    const rangeStrAlt = `(${min}-${max})`;
    rawTextTemplate = rawTextTemplate.replace(rangeStr, '##').replace(rangeStrAlt, '##');
  }

  // Replace standalone values
  for (const val of values) {
    // Be careful not to replace values that are part of ranges
    rawTextTemplate = rawTextTemplate.replace(new RegExp(`(?<!\\d)${val}(?!\\d)`, 'g'), '#');
  }

  return { rawText, rawTextTemplate, ranges, values };
}

/**
 * Extract gender inflection forms from HTML containing <if:ms> templates.
 *
 * Template format:
 * <if:ms>{Глубинный}<elif:fs>{Глубинная}<elif:ns>{Глубинное}
 * <elif:mp>{Глубинные}<elif:fp>{Глубинные}<elif:np>{Глубинные}
 * </if:np></elif:fp></elif:mp></elif:ns></elif:fs></if:ms>
 */
export function extractGenderForms(html: string): GenderForms {
  const forms: GenderForms = {};

  const keys = ['ms', 'fs', 'ns', 'mp', 'fp', 'np'] as const;

  for (const key of keys) {
    // Match <if:KEY>{content} or <elif:KEY>{content}
    const regex = new RegExp(`(?:<if:${key}>|<elif:${key}>)\\{([^}]+)\\}`, 'g');
    const match = regex.exec(html);
    if (match) {
      forms[key] = match[1];
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
 * Format: {category}.{snake_case_description}
 */
function generateId(modCode: string | undefined, category: string, rawText: string): string {
  if (modCode) {
    // Clean up the mod code: strip non-alphanumeric, convert to snake_case
    const cleaned = modCode
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
    if (cleaned) {
      return `${category}.${cleaned}`;
    }
  }

  // Fallback: generate a hash from the raw text
  const hash = simpleHash(rawText);
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
