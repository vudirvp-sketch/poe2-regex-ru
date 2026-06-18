/**
 * Type B page parser for poe2db.tw
 * Used for: Belts, Rings, Amulets, Relics (ModifiersCalc section)
 *
 * These pages store mod data as JSON inside a `new ModsView({...})` script tag.
 * The HTML is client-rendered by Mustache templates — not available in static HTML.
 *
 * JSON structure:
 *   {
 *     "baseitem": {...},
 *     "config": {...},
 *     "gen": {"1": "Префикс", "2": "Суффикс"},
 *     "opt": {...},
 *     "normal": [ModObject, ...],
 *     "corrupted": [ModObject, ...],
 *     "desecrated": [ModObject, ...],
 *     "breach_tree": [ModObject, ...],
 *     "breach_minion": [ModObject, ...],
 *     "breach_caster": [ModObject, ...],
 *     "essence": [ModObject, ...],
 *     "perfect_essence": [ModObject, ...],
 *     ... (many more empty arrays)
 *   }
 *
 * Per-ModObject:
 *   Name: string (gender template or plain text)
 *   Level: string
 *   ModGenerationTypeID: "1" = Prefix, "2" = Suffix, "5" = Corrupted
 *   ModFamilyList: string[] (grouping key)
 *   DropChance: number | string
 *   str: string (HTML description with mod-value spans)
 *   fossil_no: string[]
 *   adds_no: string[]
 *   spawn_no: string[]
 *   mod_no: string[] (HTML badges with data-tag attributes)
 *   mod_fossil_item: string[]
 *   hover: string (URL containing mod code)
 *   Code?: string (only for essence mods)
 *   type?: string ("Desecrated" or "essence")
 *   IsPerfect?: string ("0" or "1", only for essence mods)
 */
import * as cheerio from 'cheerio';
import type { ModOrigin } from '../../src/shared/types.js';

export interface RawModGroupData {
  genGroup: string;
  origin: ModOrigin;
  tags: string[];
  maxLevel: number;
  tiers: RawModTier[];
}

export interface RawModTier {
  tier: string;
  nameHtml: string;
  level: number;
  descriptionHtml: string;
  weight: string;
  modCode: string;
  affix: 'prefix' | 'suffix';
  tags: string[];
  modFamily: string[];
}

interface ModsViewData {
  gen: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normal?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  corrupted?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  desecrated?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  breach_tree?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  breach_minion?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  breach_caster?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  essence?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  perfect_essence?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Map of JSON category key to ModOrigin */
const CATEGORY_ORIGIN_MAP: Record<string, ModOrigin> = {
  normal: 'normal',
  corrupted: 'corrupted',
  desecrated: 'desecrated',
  breach_tree: 'breachborn',
  breach_minion: 'breachborn',
  breach_caster: 'breachborn',
  essence: 'essence',
  perfect_essence: 'essence',
};

/** Categories that contain mod data (skip empty arrays) */
const MOD_CATEGORIES = [
  'normal',
  'corrupted',
  'desecrated',
  'breach_tree',
  'breach_minion',
  'breach_caster',
  'essence',
  'perfect_essence',
];

/**
 * Sanitize a JS object literal string into valid JSON.
 *
 * Handles the two most common JS→JSON differences found in poe2db.tw data:
 *   1. Unquoted keys:  {name: ...}  →  {"name": ...}
 *   2. Trailing commas: {a: 1,}     →  {"a": 1}
 *
 * This is a **safe** replacement for `new Function()` / `eval()` which
 * could execute arbitrary JavaScript.  The sanitizer only performs string
 * transformations and then delegates to `JSON.parse()`.
 */
function sanitizeJsObjectLiteral(input: string): string {
  let s = input;

  // 1. Remove trailing commas before } or ]
  //    Handles: {"a": 1,}  or  [1, 2,]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // 2. Quote unquoted keys
  //    Handles: {name: ...} or {123: ...}
  //    Does NOT touch keys that are already quoted ("key" or 'key')
  s = s.replace(
    /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g,
    '$1"$2":',
  );

  // 3. Replace single-quoted strings with double-quoted strings
  //    Simple approach: only replace single-quoted string values
  //    (not inside double-quoted strings already)
  //    This handles cases like: {'key': 'value'}
  s = s.replace(/'([^']*)'/g, '"$1"');

  return s;
}

/**
 * Extract the ModsView JSON from the HTML.
 * Searches for `new ModsView({...})` pattern in <script> tags.
 */
function extractModsViewJson(html: string): ModsViewData | null {
  // Pattern: new ModsView({...});
  // The JSON can be very large and may contain nested objects/arrays
  const regex = /new\s+ModsView\s*\(\s*(\{[\s\S]*?\})\s*\)\s*;/;
  const match = regex.exec(html);
  if (!match) return null;

  try {
    // Try strict JSON parse first (most common case — poe2db.tw produces valid JSON)
    return JSON.parse(match[1]) as ModsViewData;
  } catch {
    // Fallback: sanitize JS object literal into valid JSON, then parse
    // This handles unquoted keys, trailing commas, single-quoted strings
    try {
      const sanitized = sanitizeJsObjectLiteral(match[1]);
      return JSON.parse(sanitized) as ModsViewData;
    } catch (e) {
      console.warn('  Failed to parse ModsView JSON:', (e as Error).message);
      return null;
    }
  }
}

/**
 * Extract mod code from hover URL.
 * Examples:
 *   "?s=Data%5CMods%2FStrength1" → "Strength1"
 *   "https://cdn.poe2db.tw/cache2/ru/Poe_Data_Mods_hover/<hash>" → null (no readable code)
 */
function extractCodeFromHover(hover: string): string | undefined {
  if (!hover) return undefined;

  // Try short form: ?s=Data%5CMods%2F<Code>
  const shortMatch = hover.match(/Mods%2F([^&"']+)/);
  if (shortMatch) return shortMatch[1];

  // Try decoded form: ?s=Data\Mods\<Code>
  try {
    const decoded = decodeURIComponent(hover);
    const decodedMatch = decoded.match(/Mods[/\\]([^&"'\s]+)/);
    if (decodedMatch) return decodedMatch[1];
  } catch {
    // ignore
  }

  return undefined;
}

/**
 * Extract tags from mod_no HTML array.
 * Each entry is like: <span class="badge bg-primary craftingfire" data-tag="fire">Огонь</span>
 */
function extractTagsFromModNo(modNo: string[]): string[] {
  const tags: string[] = [];
  for (const html of modNo) {
    const $ = cheerio.load(html);
    $('[data-tag]').each((_, el) => {
      const tag = $(el).attr('data-tag');
      if (tag) tags.push(tag);
    });
  }
  return tags;
}

/**
 * Parse affix type from ModGenerationTypeID.
 * "1" = Prefix, "2" = Suffix, "5" = Corrupted
 */
function parseGenTypeId(id: string): 'prefix' | 'suffix' {
  if (id === '1') return 'prefix';
  // id === '2' -> suffix, id === '5' -> corrupted (stored as suffix with origin='corrupted')
  return 'suffix';
}

/**
 * Parse a Type B page from poe2db.tw (ModifiersCalc structure)
 * by extracting the JSON from `new ModsView({...})`.
 */
export function parseTypeBPage(html: string): RawModGroupData[] {
  const results: RawModGroupData[] = [];

  // Step 1: Extract JSON from ModsView
  const data = extractModsViewJson(html);
  if (!data) {
    console.warn('  No ModsView JSON found in page');
    return results;
  }

  // Step 2: Process each mod category
  for (const categoryKey of MOD_CATEGORIES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mods: any[] = data[categoryKey];
    if (!mods || !Array.isArray(mods) || mods.length === 0) continue;

    const origin = CATEGORY_ORIGIN_MAP[categoryKey] || 'normal';

    // Group mods by ModFamilyList for tier grouping
    const familyGroups = new Map<string, RawModTier[]>();

    for (let i = 0; i < mods.length; i++) {
      const mod = mods[i];
      const family = mod.ModFamilyList?.[0] || `unknown_${categoryKey}_${i}`;
      const genType = parseGenTypeId(String(mod.ModGenerationTypeID || '2'));
      const level = parseInt(String(mod.Level || '0'), 10) || 0;
      const descriptionHtml = String(mod.str || '');
      const nameHtml = String(mod.Name || '');
      const weight = String(mod.DropChance || '0');
      const modCode = mod.Code || extractCodeFromHover(String(mod.hover || '')) || `${categoryKey}_${i}`;
      const tags = extractTagsFromModNo(mod.mod_no || []);

      // Skip empty descriptions
      if (!descriptionHtml || cheerio.load(descriptionHtml).root().text().trim().length === 0) {
        continue;
      }

      const tier: RawModTier = {
        tier: nameHtml || `T${i + 1}`,
        nameHtml,
        level,
        descriptionHtml,
        weight,
        modCode,
        affix: genType,
        tags,
        modFamily: mod.ModFamilyList || [],
      };

      if (!familyGroups.has(family)) {
        familyGroups.set(family, []);
      }
      familyGroups.get(family)!.push(tier);
    }

    // Convert family groups to RawModGroupData
    for (const [family, tiers] of familyGroups) {
      const maxLevel = Math.max(...tiers.map(t => t.level));
      const allTags = [...new Set(tiers.flatMap(t => t.tags))];

      results.push({
        genGroup: family,
        origin,
        tags: allTags,
        maxLevel,
        tiers,
      });
    }
  }

  return results;
}

/**
 * Get all mod categories found in the page with their mod counts.
 * Useful for debugging and verification.
 */
export function getModCategoryStats(html: string): Record<string, number> {
  const data = extractModsViewJson(html);
  if (!data) return {};

  const stats: Record<string, number> = {};
  for (const categoryKey of MOD_CATEGORIES) {
    const mods = data[categoryKey];
    if (Array.isArray(mods) && mods.length > 0) {
      stats[categoryKey] = mods.length;
    }
  }
  return stats;
}
