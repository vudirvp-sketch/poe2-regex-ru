/**
 * ETL Pipeline Orchestrator
 * Run with: pnpm etl
 *
 * Fetches mod data from poe2db.tw, normalizes, computes regex substrings,
 * computes optimizations, and generates JSON files in public/generated/.
 *
 * Category types:
 * - Type A: Pages with static HTML tables (Waystones, Tablets, Jewels)
 *   Tables use class "filters" (not "tablesorter"), rows have no role="row"
 * - Type B: Pages with JSON in new ModsView({...}) script (Belts, Rings, Amulets, Relics)
 *   Mod data is client-rendered via Mustache templates, but available as JSON
 * - Type A (RelicMods): Relics also have a #RelicMods tab with a static HTML table
 */
import { fetchPage, clearCache, getCacheInfo, hashContent } from './etl/fetch-poe2db.js';
import { parseTypeAPage } from './etl/parse-tables.js';
import { parseTypeBPage, getModCategoryStats } from './etl/parse-modifiers-calc.js';
import { normalizeTypeA, normalizeTypeB, extractTextAndRanges, filterImplicitSetBonuses, getImplicitTokensForCategory } from './etl/normalize.js';
import { computeAllRegexes } from './etl/compute-regex.js';
import { computeOptimizations } from './etl/compute-optimizations.js';
import { applyDialectOptimizations } from '../src/core/dp-factorizer.js';
import { assembleCategoryData, writeCategoryJson } from './etl/generate-dictionary.js';
import { validateRegex, batchValidateItem } from '../src/core/regex-oracle.js';
import type { GameItemText } from '../src/core/poe2-regex-matcher.js';
import type { ModOrigin, JewelType } from '../src/shared/types.js';
import type { NormalizedMod } from './etl/normalize.js';
import * as path from 'path';
import * as fs from 'fs';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'generated');

interface CategoryConfig {
  name: string;
  urls: string[];
  type: 'A' | 'B' | 'relic';
  tabIds?: string[];
  tabOrigins?: Record<string, ModOrigin>;
  origin?: ModOrigin;
  deduplicate?: boolean;
}

const categories: CategoryConfig[] = [
  {
    name: 'waystone',
    urls: ['https://poe2db.tw/ru/Waystones'],
    type: 'A',
    tabIds: ['ПутевыекамниMods'],
    tabOrigins: { 'ПутевыекамниMods': 'normal' },
    origin: 'normal',
  },
  {
    name: 'waystone-desecrated',
    urls: ['https://poe2db.tw/ru/Waystones'],
    type: 'A',
    tabIds: ['DesecratedWaystoneMods'],
    tabOrigins: { 'DesecratedWaystoneMods': 'desecrated' },
    origin: 'desecrated',
  },
  {
    name: 'tablet',
    urls: ['https://poe2db.tw/ru/Tablet'],
    type: 'A',
    tabIds: ['БашниПредтечMods'],
    origin: 'normal',
  },
  {
    name: 'jewel',
    urls: ['https://poe2db.tw/ru/Jewels'],
    type: 'A',
    tabIds: ['JewelMods'],
    origin: 'normal',
  },
  {
    name: 'jewel-desecrated',
    urls: ['https://poe2db.tw/ru/Jewels'],
    type: 'A',
    tabIds: ['JewelsDesecratedMods'],
    origin: 'desecrated',
  },
  {
    name: 'jewel-corrupted',
    urls: ['https://poe2db.tw/ru/Jewels'],
    type: 'A',
    tabIds: ['JewelCorruptMods'],
    origin: 'corrupted',
  },
  {
    name: 'relic',
    urls: ['https://poe2db.tw/ru/Urn_Relic', 'https://poe2db.tw/ru/Seal_Relic'],
    type: 'relic',
    tabIds: ['RelicMods'],
    origin: 'normal',
    deduplicate: true,
  },
  {
    name: 'belt',
    urls: ['https://poe2db.tw/ru/Belts'],
    type: 'B',
  },
  {
    name: 'ring',
    urls: ['https://poe2db.tw/ru/Rings'],
    type: 'B',
  },
  {
    name: 'amulet',
    urls: ['https://poe2db.tw/ru/Amulets'],
    type: 'B',
  },
];

/**
 * Deduplicate mods by their raw text (both pages may have identical mods).
 * Also deduplicates by ID — some poe2db.tw pages output the same mod row
 * multiple times (e.g., waystone earth effects appear 4x per effect).
 */
function deduplicateMods(mods: NormalizedMod[]): NormalizedMod[] {
  const seen = new Set<string>();
  const result: NormalizedMod[] = [];
  for (const mod of mods) {
    // Key combines rawText and id — if both match, it's a true duplicate
    const key = `${mod.id}::${mod.rawText.ru}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(mod);
    }
  }
  return result;
}

/**
 * Apply i18n overrides from scripts/etl/i18n-overrides.json.
 * Patches tokens in the generated JSON files where poe2db.tw has no Russian text.
 * Only overrides rawText.ru and rawTextTemplate.ru; regex.ru is recomputed
 * using the same minimal-unique-substring algorithm against the category's tokens.
 */
/**
 * Extract the "text suffix" from a rawTextTemplate (same logic as compute-regex.ts).
 * This is the text after the last # or ## placeholder, with leading non-letters stripped.
 */
function extractTemplateSuffix(template: string): string {
  const lastHashIdx = template.lastIndexOf('#');
  if (lastHashIdx === -1) return '';
  let suffix = template.substring(lastHashIdx + 1);
  suffix = suffix.replace(/^[^a-zA-Zа-яА-ЯёЁ]*/, '');
  return suffix.trim();
}

/**
 * Normalize a rawTextTemplate into a "family key" (same logic as compute-regex.ts).
 */
function normalizeTemplate(template: string): string {
  return template
    .replace(/##/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the "regex prefix" from a rawTextTemplate (same logic as compute-regex.ts).
 * ONLY used for dual-number mods — single-number mods don't need prefix
 * since .* does NOT cross block boundaries (verified in-game Phase 7).
 */
function extractTemplatePrefixForOverride(template: string): string {
  // Only dual-number mods need prefix
  const isDualNumber = /\d*#\s*до\s*#/.test(template) || /#\s*до\s*#/.test(template);
  if (!isDualNumber) return '';

  let firstHashIdx = -1;
  for (let i = 0; i < template.length; i++) {
    if (template[i] === '#') {
      firstHashIdx = i;
      break;
    }
  }
  if (firstHashIdx === -1) return '';
  if (firstHashIdx === 0) return '';

  let prefix = template.substring(0, firstHashIdx).trim();
  prefix = prefix.replace(/[^a-zA-Zа-яА-ЯёЁ]+$/, '');

  if (prefix.length < 2) return '';

  const words = prefix.split(/\s+/);
  if (words.length > 3) {
    let result = words.slice(-3).join(' ');
    if (result.length > 25) {
      const twoWords = words.slice(-2).join(' ');
      if (twoWords.length >= 2) result = twoWords;
    }
    return result;
  }
  return prefix;
}

function applyI18nOverrides() {
  const overridesPath = path.resolve(process.cwd(), 'scripts', 'etl', 'i18n-overrides.json');
  if (!fs.existsSync(overridesPath)) {
    console.log('\n  No i18n-overrides.json found, skipping override step.');
    return;
  }

  const overridesFile = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
  const overrides: Record<string, { rawText: string; rawTextTemplate?: string; regex?: string; source?: string }> =
    overridesFile.overrides || {};

  const overrideIds = new Set(Object.keys(overrides));
  if (overrideIds.size === 0) {
    console.log('\n  No overrides defined in i18n-overrides.json.');
    return;
  }

  console.log(`\n=== Applying i18n overrides (${overrideIds.size} tokens) ===`);

  // Process each generated JSON file
  const jsonFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  let totalPatched = 0;

  for (const jsonFile of jsonFiles) {
    const filePath = path.join(OUTPUT_DIR, jsonFile);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // First pass: apply rawText/rawTextTemplate overrides to all tokens
    let patched = 0;
    for (const token of data.tokens) {
      const override = overrides[token.id];
      if (!override) continue;

      token.rawText.ru = override.rawText;
      if (override.rawTextTemplate) {
        token.rawTextTemplate.ru = override.rawTextTemplate;
      }
      patched++;
    }

    if (patched === 0) continue;

    // Second pass: recompute regex.ru for ALL overridden tokens
    // using the same template-family algorithm as compute-regex.ts.
    // Build exclusion set from all tokens' rawText (including the already-patched ones).
    const allTokenTexts = data.tokens.map((t: any) => t.rawText.ru.toLowerCase());
    const exclusionSubs = new Set<string>();
    for (const text of allTokenTexts) {
      for (let len = 1; len <= Math.min(text.length, 30); len++) {
        for (let i = 0; i <= text.length - len; i++) {
          exclusionSubs.add(text.substring(i, i + len));
        }
      }
    }

    // Also build family-key set for same-family detection
    const familyKeys = new Map<string, string[]>();
    for (const token of data.tokens) {
      const fk = normalizeTemplate(token.rawTextTemplate.ru);
      if (!familyKeys.has(fk)) familyKeys.set(fk, []);
      familyKeys.get(fk)!.push(token.id);
    }

    let totalPatchedInFile = 0;
    for (const token of data.tokens) {
      const override = overrides[token.id];
      if (!override) continue;

      const template = token.rawTextTemplate.ru;
      const hasPlaceholder = template.includes('#');

      // Fix familyKey.ru: recompute from the (now-Russian) template
      token.familyKey.ru = normalizeTemplate(template);

      // Fix hasMultiPlaceholder: recompute from the template
      const placeholderCount = (template.match(/#+/g) || []).length;
      token.hasMultiPlaceholder = placeholderCount >= 2;

      // Fix regexPrefix: recompute from the template
      token.regexPrefix.ru = extractTemplatePrefixForOverride(template);

      // If override specifies a regex explicitly, use it (skip recomputation)
      if (override.regex) {
        token.regex.ru = override.regex;
        token.hasYofication = false;
        token.yoficationPositions = [];
        totalPatched++;
        totalPatchedInFile++;
        console.log(`  Patched: ${token.id} -> "${override.rawText.slice(0, 50)}..." (regex: "${token.regex.ru}" [explicit])`);
        continue;
      }

      if (hasPlaceholder) {
        // Strategy 1: Template-family suffix (same as compute-regex.ts)
        const fullSuffix = extractTemplateSuffix(template);
        const familyKey = normalizeTemplate(template);
        const sameFamily = familyKeys.get(familyKey) || [];

        if (fullSuffix.length >= 3) {
          // Try to find shortest unique suffix by trimming from the left
          let bestSuffix: string | null = null;
          const words = fullSuffix.split(/\s+/);

          for (let skipWords = 0; skipWords < words.length; skipWords++) {
            const candidate = words.slice(skipWords).join(' ').toLowerCase();
            if (candidate.length < 3) break;

            // Check uniqueness: candidate must NOT appear in tokens from OTHER families
            // Compound families are NO LONGER exempt — their overlap causes cross-family FP
            let isUnique = true;
            for (const otherToken of data.tokens) {
              if (sameFamily.includes(otherToken.id)) continue;

              if (otherToken.rawText.ru.toLowerCase().includes(candidate)) {
                isUnique = false;
                break;
              }
            }

            if (isUnique) {
              bestSuffix = words.slice(skipWords).join(' ');
              // Keep looking for shorter versions
            } else {
              // Further trimming makes it non-unique — stop
              break;
            }
          }

          if (bestSuffix) {
            token.regex.ru = bestSuffix;
          } else {
            // Fallback: use full suffix
            token.regex.ru = fullSuffix;
          }
        } else {
          // Suffix too short — fallback to substring search on rawText
          token.regex.ru = findShortestUniqueSubstring(override.rawText.toLowerCase(), exclusionSubs, 5);
        if (!token.regex.ru || token.regex.ru.length === 0) {
          token.regex.ru = findShortestUniqueSubstring(override.rawText.toLowerCase(), exclusionSubs, 3);
        }
        }
      } else {
        // Strategy 2: Substring search for literal (non-ranged) tokens
        // Need to exclude substrings from the token's own rawText
        const ownSubs = new Set<string>();
        const targetLower = override.rawText.toLowerCase();
        for (let len = 1; len <= targetLower.length; len++) {
          for (let i = 0; i <= targetLower.length - len; i++) {
            ownSubs.add(targetLower.substring(i, i + len));
          }
        }
        const effectiveExclusion = new Set([...exclusionSubs].filter(s => !ownSubs.has(s)));
        token.regex.ru = findShortestUniqueSubstring(targetLower, effectiveExclusion, 5);
        if (!token.regex.ru || token.regex.ru.length === 0) {
          token.regex.ru = findShortestUniqueSubstring(targetLower, effectiveExclusion, 3);
        }
        if (!token.regex.ru || token.regex.ru.length === 0) {
          token.regex.ru = targetLower;
        }
      }

      // Reset yofication for overridden tokens
      token.hasYofication = false;
      token.yoficationPositions = [];

      totalPatched++;
      totalPatchedInFile++;
      console.log(`  Patched: ${token.id} -> "${override.rawText.slice(0, 50)}..." (regex: "${token.regex.ru}")`);
    }

    if (totalPatchedInFile > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    }
  }

  console.log(`  Total tokens patched: ${totalPatched}`);
}

/** Helper: find shortest unique substring of target that is NOT in exclusion set */
function findShortestUniqueSubstring(target: string, exclusionSubs: Set<string>, minLen: number): string {
  for (let len = minLen; len <= target.length; len++) {
    for (let i = 0; i <= target.length - len; i++) {
      const candidate = target.substring(i, i + len);
      if (!exclusionSubs.has(candidate)) {
        return candidate;
      }
    }
  }
  return target;
}

/**
 * Normalize rawText for matching: strip numbers/ranges, normalize whitespace,
 * lowercase. Used to match Type A jewel mods with Type B ModCalc data
 * when modCode is not available in the Type A HTML.
 */
function normalizeRawTextForMatching(text: string): string {
  return text
    // Replace numeric ranges like (5—10) or (5-10) with placeholder
    .replace(/\([+-]?\d+(?:\.\d+)?\s*[—–\-]\s*[+-]?\d+(?:\.\d+)?\)/g, '##')
    // Replace standalone numbers (with optional + or -)
    .replace(/([+-]?\d+(?:\.\d+)?)/g, '#')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Build a jewelTypeMap by fetching the poe2db ModCalc pages for Ruby/Emerald/Sapphire.
 *
 * Each ModCalc page is a Type B page containing JSON with all mods for that jewel type.
 * We extract modCode from each mod and map it to the corresponding jewel type.
 * Mods appearing on multiple pages get 'shared' type.
 *
 * STRATEGY: Type A jewel tables (JewelMods tab) do NOT contain modCode in their HTML.
 * So we use a two-pass approach:
 *   1. Parse ModCalc pages → build modCode→JewelType map
 *   2. Parse ModCalc tiers' rawText → build normalizedText→modCode map
 *   3. For each jewel mod, try matching by modCode first, then by normalizedText
 *
 * Returns: Record<modId, JewelType> — maps token IDs to their jewel type.
 */
async function buildJewelTypeMap(
  allJewelMods: NormalizedMod[]
): Promise<Record<string, JewelType>> {
  console.log('\n=== Building jewel type map from ModCalc pages ===');

  const modCalcPages: { url: string; type: JewelType }[] = [
    { url: 'https://poe2db.tw/ru/Ruby#ModifiersCalc', type: 'ruby' },
    { url: 'https://poe2db.tw/ru/Emerald#ModifiersCalc', type: 'emerald' },
    { url: 'https://poe2db.tw/ru/Sapphire#ModifiersCalc', type: 'sapphire' },
  ];

  // Collect modCode sets per jewel type from ModCalc pages
  const modCodeToTypes = new Map<string, Set<JewelType>>();
  // Also build normalizedText→modCode map for matching without modCode
  const normalizedTextToModCode = new Map<string, string>();

  for (const page of modCalcPages) {
    try {
      const html = await fetchPage(page.url);
      const groups = parseTypeBPage(html);

      for (const group of groups) {
        for (const tier of group.tiers) {
          if (tier.modCode) {
            const types = modCodeToTypes.get(tier.modCode) || new Set();
            types.add(page.type);
            modCodeToTypes.set(tier.modCode, types);

            // Also map normalized description text → modCode
            // This allows matching Type A jewel mods (which lack modCode) by their text
            // extractTextAndRanges now returns an array of segments; use the first segment
            // for text→modCode mapping (all segments share the same modCode)
            const segments = extractTextAndRanges(tier.descriptionHtml);
            for (const seg of segments) {
              const normalizedKey = normalizeRawTextForMatching(seg.rawTextTemplate);
              if (normalizedKey && !normalizedTextToModCode.has(normalizedKey)) {
                normalizedTextToModCode.set(normalizedKey, tier.modCode);
              }
            }
          }
        }
      }

      const stats = getModCategoryStats(html);
      const totalMods = Object.values(stats).reduce((a, b) => a + b, 0);
      console.log(`  ${page.type}: found ${totalMods} mods from ModCalc, ${normalizedTextToModCode.size} text mappings`);
    } catch (err) {
      console.warn(`  WARNING: Failed to fetch ${page.url}:`, (err as Error).message);
    }
  }

  // Build the modCode→JewelType map (shared if modCode appears on multiple types)
  const modCodeToJewelType = new Map<string, JewelType>();
  for (const [modCode, types] of modCodeToTypes) {
    if (types.size > 1) {
      modCodeToJewelType.set(modCode, 'shared');
    } else {
      modCodeToJewelType.set(modCode, types.values().next().value!);
    }
  }

  // Map token IDs to jewel types
  const jewelTypeMap: Record<string, JewelType> = {};
  let matchedByCode = 0;
  let matchedByText = 0;
  let shared = 0;

  for (const mod of allJewelMods) {
    // Try matching by modCode first (if available)
    const modCode = mod.modCode;
    if (modCode && modCodeToJewelType.has(modCode)) {
      const jType = modCodeToJewelType.get(modCode)!;
      jewelTypeMap[mod.id] = jType;
      matchedByCode++;
      if (jType === 'shared') shared++;
      continue;
    }

    // Fallback: match by normalized rawTextTemplate against ModCalc data
    const normalizedKey = normalizeRawTextForMatching(mod.rawTextTemplate.ru);
    const matchedModCode = normalizedTextToModCode.get(normalizedKey);
    if (matchedModCode && modCodeToJewelType.has(matchedModCode)) {
      const jType = modCodeToJewelType.get(matchedModCode)!;
      jewelTypeMap[mod.id] = jType;
      matchedByText++;
      if (jType === 'shared') shared++;
      continue;
    }

    // No match → shared (will be classified by heuristic at runtime)
    jewelTypeMap[mod.id] = 'shared';
    shared++;
  }

  console.log(`  Jewel type map: ${matchedByCode} by modCode, ${matchedByText} by text, ${shared} shared/unmatched out of ${allJewelMods.length} total`);
  return jewelTypeMap;
}

/**
 * Check staleness of all cached source pages vs generated JSON files.
 * Reports which pages are stale and which generated JSON files may need re-generation.
 * Returns true if any source page is stale or missing from cache.
 */
function checkStale(): boolean {
  console.log('=== Checking ETL data staleness ===\n');

  // Collect all unique URLs from category configs + jewel ModCalc pages
  const allUrls = new Set<string>();
  for (const cat of categories) {
    for (const url of cat.urls) {
      allUrls.add(url);
    }
  }
  // Jewel ModCalc pages
  allUrls.add('https://poe2db.tw/ru/Ruby#ModifiersCalc');
  allUrls.add('https://poe2db.tw/ru/Emerald#ModifiersCalc');
  allUrls.add('https://poe2db.tw/ru/Sapphire#ModifiersCalc');

  let staleCount = 0;
  let missingCount = 0;
  let freshCount = 0;

  for (const url of allUrls) {
    const info = getCacheInfo(url);
    const ageHours = info.ageMs ? (info.ageMs / (60 * 60 * 1000)).toFixed(1) : 'N/A';
    if (!info.cached) {
      console.log(`  [missing] ${url}`);
      missingCount++;
    } else if (info.stale) {
      console.log(`  [stale]   ${url} (age: ${ageHours}h, hash: ${info.contentHash})`);
      staleCount++;
    } else {
      console.log(`  [fresh]   ${url} (age: ${ageHours}h, hash: ${info.contentHash})`);
      freshCount++;
    }
  }

  // Check generated JSON files
  console.log('\n  Generated JSON files:');
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log('    No generated/ directory found');
  } else {
    const jsonFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
    for (const jsonFile of jsonFiles) {
      const filePath = path.join(OUTPUT_DIR, jsonFile);
      const stat = fs.statSync(filePath);
      const ageMs = Date.now() - stat.mtimeMs;
      const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const sourceHash = data.sourceHash || 'N/A';
      console.log(`    ${jsonFile}: age=${ageHours}h, sourceHash=${sourceHash}, tokens=${data.tokens?.length || 0}`);
    }
  }

  console.log(`\n  Summary: ${freshCount} fresh, ${staleCount} stale, ${missingCount} missing`);
  return staleCount > 0 || missingCount > 0;
}

async function runEtl() {
  console.log('=== PoE2 Regex RU — ETL Pipeline ===\n');

  // Handle --fresh flag: clear cache before fetching
  if (process.argv.includes('--fresh')) {
    const deleted = clearCache();
    console.log(`  --fresh: Cleared ${deleted} cached HTML files\n`);
  }

  // Handle --check-stale flag: report staleness and exit
  if (process.argv.includes('--check-stale')) {
    const hasStale = checkStale();
    process.exit(hasStale ? 1 : 0);
  }

  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Compute source hash from all cached HTML files for change detection
  const sourceHashes: string[] = [];
  const cacheDir = path.resolve(process.cwd(), '.etl-cache');
  if (fs.existsSync(cacheDir)) {
    const cacheFiles = fs.readdirSync(cacheDir).filter(f => f.endsWith('.html')).sort();
    for (const cf of cacheFiles) {
      const content = fs.readFileSync(path.join(cacheDir, cf), 'utf-8');
      sourceHashes.push(hashContent(content));
    }
  }
  const sourceHash = sourceHashes.length > 0
    ? hashContent(sourceHashes.join(','))
    : 'no-cache';

  // Collect all jewel mods across all jewel categories for building jewelTypeMap
  const allJewelMods: NormalizedMod[] = [];
  let jewelTypeMap: Record<string, JewelType> | undefined;

  for (const cat of categories) {
    console.log(`\n=== Processing ${cat.name} ===`);

    try {
      // Step 1: Fetch HTML
      console.log('  Step 1: Fetching HTML...');
      const rawHtmls = await Promise.all(cat.urls.map(url => fetchPage(url)));

      // Step 2: Parse
      console.log('  Step 2: Parsing...');
      let normalized: NormalizedMod[] = [];

      if (cat.type === 'A') {
        const rawMods = rawHtmls.flatMap(html => {
          if (cat.tabIds && cat.tabIds.length > 0) {
            return cat.tabIds.flatMap(tabId => {
              const origin = cat.tabOrigins?.[tabId] || cat.origin || 'normal';
              return parseTypeAPage(html, tabId, origin);
            });
          }
          // Parse all tabs
          return parseTypeAPage(html, '', cat.origin || 'normal');
        });

        normalized = rawMods.flatMap(mod =>
          normalizeTypeA(mod, cat.name, mod.origin || cat.origin || 'normal')
        );
      } else if (cat.type === 'relic') {
        // Relics: parse the #RelicMods HTML table from each page
        const rawMods = rawHtmls.flatMap(html => {
          return parseTypeAPage(html, 'RelicMods', 'normal');
        });

        normalized = rawMods.flatMap(mod =>
          normalizeTypeA(mod, cat.name, mod.origin || 'normal')
        );
      } else {
        // Type B: parse JSON from ModsView
        const allGroups = rawHtmls.flatMap(html => parseTypeBPage(html));

        // Deduplicate groups across multiple pages (e.g., Belt/Ring/Amulet may share)
        const seenGroups = new Set<string>();
        const uniqueGroups = allGroups.filter(group => {
          const key = `${group.genGroup}:${group.tiers.map(t => t.descriptionHtml).join('|')}`;
          if (seenGroups.has(key)) return false;
          seenGroups.add(key);
          return true;
        });

        normalized = uniqueGroups.flatMap(group =>
          group.tiers.flatMap(tier => normalizeTypeB(tier, group, cat.name))
        );
      }

      // Filter out empty/invalid mods (no rawText, or only whitespace)
      const beforeFilter = normalized.length;
      normalized = normalized.filter(mod => {
        const text = mod.rawText.ru.trim();
        return text.length > 0;
      });
      if (beforeFilter !== normalized.length) {
        console.log(`  Filtered: ${beforeFilter} -> ${normalized.length} mods (removed ${beforeFilter - normalized.length} empty)`);
      }

      // Deduplicate by rawText+id for all categories
      // (Some poe2db.tw pages output the same mod row multiple times,
      //  e.g., waystone earth effects appear 4x per effect)
      const beforeDedup = normalized.length;
      normalized = deduplicateMods(normalized);
      if (beforeDedup !== normalized.length) {
        console.log(`  Deduplicated: ${beforeDedup} -> ${normalized.length} mods (removed ${beforeDedup - normalized.length} duplicates)`);
      }

      console.log(`  Parsed ${normalized.length} valid mods`);

      if (normalized.length === 0) {
        console.warn(`  WARNING: No mods found for ${cat.name}. Skipping.`);
        continue;
      }

      // Step 2b: Filter implicit-set bonuses and add implicit tokens
      // Implicit-set bonus tokens (e.g., "На #% больше находимых в области путевых камней")
      // are NOT searchable as mod text in-game. They must be removed and replaced
      // with proper implicit tokens that use reversed regex format.
      // See WAYSTONE_IMPLICIT_SET_FAMILY_KEYS / TABLET_IMPLICIT_SET_FAMILY_KEYS in normalize.ts.
      const beforeImplicitFilter = normalized.length;
      const filteredMods = filterImplicitSetBonuses(normalized);
      const implicitTokens = getImplicitTokensForCategory(cat.name);

      if (beforeImplicitFilter !== filteredMods.length || implicitTokens.length > 0) {
        const removedCount = beforeImplicitFilter - filteredMods.length;
        if (removedCount > 0) {
          console.log(`  Filtered implicit-set bonuses: removed ${removedCount} non-searchable tokens`);
        }
        if (implicitTokens.length > 0) {
          console.log(`  Adding ${implicitTokens.length} implicit tokens (reversed regex)`);
        }
        normalized = [...filteredMods, ...implicitTokens];
        console.log(`  Tokens after implicit processing: ${normalized.length}`);
      }

      // Collect jewel mods for type mapping
      if (cat.name === 'jewel' || cat.name === 'jewel-desecrated' || cat.name === 'jewel-corrupted') {
        allJewelMods.push(...normalized);
      }

      // Step 3: Compute regex
      console.log('  Step 3: Computing regex substrings...');
      const regexResults = computeAllRegexes(normalized, 'ru');

      // Step 3b: Apply dialect optimizations to individual regexes
      // This saves 2-5 chars per regex for mods with е/ё and endings
      let dialectOptCount = 0;
      for (const [, rr] of regexResults) {
        const optimized = applyDialectOptimizations(rr.regex);
        if (optimized !== rr.regex) {
          rr.regex = optimized;
          dialectOptCount++;
        }
      }
      if (dialectOptCount > 0) {
        console.log(`  Step 3b: Dialect optimizations applied to ${dialectOptCount} regexes`);
      }

      // Step 4: Compute optimizations (includes DP factorization + dialect optimizations)
      console.log('  Step 4: Computing optimizations...');
      const optimizations = computeOptimizations(normalized, regexResults, 'ru');

      // Step 5: Generate JSON
      console.log('  Step 5: Generating JSON...');
      const categoryData = assembleCategoryData(
        cat.name,
        normalized,
        regexResults,
        optimizations,
        'ru',
        undefined,
        sourceHash
      );
      writeCategoryJson(categoryData, OUTPUT_DIR);

      console.log(`  Done: ${categoryData.tokens.length} tokens, ${Object.keys(optimizations).length} optimizations`);
    } catch (err) {
      console.error(`  ERROR processing ${cat.name}:`, err);
    }
  }

  // Step 6: Build jewel type map and patch jewel JSON files
  if (allJewelMods.length > 0) {
    jewelTypeMap = await buildJewelTypeMap(allJewelMods);

    // Patch jewel JSON files with jewelType
    const jewelFiles = ['jewel.json', 'jewel-desecrated.json', 'jewel-corrupted.json'];
    for (const jsonFile of jewelFiles) {
      const filePath = path.join(OUTPUT_DIR, jsonFile);
      if (!fs.existsSync(filePath)) continue;

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      let patched = 0;
      for (const token of data.tokens) {
        const jType = jewelTypeMap[token.id];
        if (jType) {
          token.jewelType = jType;
          patched++;
        }
      }
      if (patched > 0) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
        console.log(`  Patched ${jsonFile}: ${patched} tokens with jewelType`);
      }
    }
  }

  // Step 7: Apply i18n overrides for tokens without Russian text on poe2db.tw
  applyI18nOverrides();

  // Step 7b: Repair cross-family FP caused by i18n overrides changing rawText
  // After overrides, some regexes that were unique against the original rawText
  // now match overridden tokens. This step adds missing exclude patterns.
  repairCrossFamilyFP();

  // Step 7c: Patch optimization entries with regexPrefixContext and regexExclude
  // from the tokens they cover. These fields are populated by repairCrossFamilyFP()
  // AFTER the optimization table was computed, so they need to be patched in.
  patchOptimizationEntries();

  // Step 8: Validate generated regexes (if --validate flag is provided)
  if (process.argv.includes('--validate')) {
    validateGeneratedRegexes();
  }

  // Step 9: Block-based validation (if --validate-item flag is provided)
  if (process.argv.includes('--validate-item')) {
    validateGeneratedRegexesItem();
  }

  // Step 10: Iterative optimizer (integrated from Phase 5)
  // Runs the iterative optimizer on all generated JSON files to further
  // shorten regexes, fix FN/FP, and apply dialect optimizations.
  // Skipped if --no-optimize flag is provided.
  if (!process.argv.includes('--no-optimize')) {
    const { runIterativeOptimization } = await import('./etl/iterative-optimizer.js');
    console.log('\n=== Step 10: Iterative Optimization ===');
    runIterativeOptimization(OUTPUT_DIR, {
      maxIterations: 5,
      oracleValidation: true,
      budgetAware: true,
      verbose: process.argv.includes('--verbose'),
      dryRun: false,
    });
  }

  console.log('\n=== ETL Pipeline Complete ===');
}

/**
 * Patch optimization entries with regexPrefixContext and regexExclude
 * from the tokens they cover.
 *
 * The optimization table is computed at Step 4, BEFORE i18n overrides
 * and repairCrossFamilyFP() add regexPrefixContext/regexExclude to tokens.
 * This post-processing step enriches optimization entries with these fields
 * so the runtime optimizer can produce correct AND(context, regex) nodes.
 *
 * Rules:
 * - If ALL tokens in an optimization entry share the same regexPrefixContext,
 *   it is added to the entry.
 * - If ALL tokens in an optimization entry share the same regexExclude patterns,
 *   they are added to the entry.
 * - If tokens have mixed contexts/excludes, the entry is left without them
 *   (the runtime optimizer will not optimize these groups).
 */
function patchOptimizationEntries(): void {
  console.log('\n=== Patching optimization entries with context/excludes ===');

  const jsonFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  let totalPatched = 0;

  for (const jsonFile of jsonFiles) {
    const filePath = path.join(OUTPUT_DIR, jsonFile);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tokens = data.tokens;
    const optTable = data.optimizationTable;
    if (!optTable || !tokens) continue;

    // Build token lookup
    const tokenById = new Map<string, any>();
    for (const token of tokens) {
      tokenById.set(token.id, token);
    }

    let filePatched = 0;

    for (const [, entry] of Object.entries(optTable) as [string, any][]) {
      const entryIds: string[] = entry.ids || [];

      // Collect regexPrefixContext from all covered tokens
      const contexts = new Set<string>();
      const excludesList: string[][] = [];

      for (const id of entryIds) {
        const token = tokenById.get(id);
        if (!token) continue;

        const ctx = token.regexPrefixContext
          ? (typeof token.regexPrefixContext === 'object' ? (token.regexPrefixContext.ru || '') : '')
          : '';
        contexts.add(ctx);

        const exc: string[] = token.regexExclude
          ? (Array.isArray(token.regexExclude)
            ? token.regexExclude
            : (typeof token.regexExclude === 'object' && token.regexExclude.ru
              ? token.regexExclude.ru
              : []))
          : [];
        excludesList.push(exc);
      }

      // Remove empty context from set (tokens without context are compatible with each other)
      const nonEmptyContexts = [...contexts].filter(c => c.length > 0);

      // All tokens share the same non-empty context → add to entry
      // iter 50 FIX: require contexts.size === 1 (ALL tokens have the SAME context).
      // Previous code allowed contexts.size === 2 with one empty — this incorrectly added
      // context to entries mixing tokens with and without context. Example: 11 "увеличение"
      // tokens where only 2 have regexPrefixContext "имеют" — adding "имеют" to all 11
      // causes FN (non-minion tokens can't match because "имеют" is required but absent).
      if (nonEmptyContexts.length === 1 && contexts.size === 1) {
        if (nonEmptyContexts[0]) {
          entry.regexPrefixContext = { ru: nonEmptyContexts[0] };
          filePatched++;
        }
      }

      // All tokens share the same exclude patterns → add to entry
      if (excludesList.length > 0 && excludesList.every(e => e.length > 0)) {
        // Check if all exclude lists are identical
        const firstExc = JSON.stringify(excludesList[0]);
        const allSame = excludesList.every(e => JSON.stringify(e) === firstExc);

        if (allSame && excludesList[0].length > 0) {
          entry.regexExclude = { ru: excludesList[0] };
          filePatched++;
        }
      }
    }

    if (filePatched > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      console.log(`  ${jsonFile}: patched ${filePatched} optimization entries`);
    }
    totalPatched += filePatched;
  }

  console.log(`  Total optimization entries patched: ${totalPatched}`);
}

/**
 * Post-i18n-override repair: detect and fix cross-family FP.
 *
 * After i18n overrides change rawText, some regexes computed against the
 * original rawText may now match other-family tokens. This step:
 * 1. Scans ALL tokens for cross-family FP (regex matches other-family rawText)
 * 2. Tries to lengthen the regex to a more specific template suffix
 * 3. Adds missing exclude patterns to prevent FP
 * 4. Iterates until no more improvements can be made
 *
 * Uses a simplified substring-match check (not full PoE2 engine) for speed,
 * since the block-based Oracle validation runs separately with --validate-item.
 */
function repairCrossFamilyFP(): void {
  console.log('\n=== Repairing cross-family FP after i18n overrides ===');

  const jsonFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  let totalRepaired = 0;

  // Known short markers for common cross-family conflict types
  const CONFLICT_MARKERS = [
    'Приспеш',    // minion variants
    'во время',   // flask-effect variants
    'флакона',    // flask variants
    'снарядов',   // projectile gem level vs all skills
    'всем стихиям', // all-resist vs single-element
    'умений',     // gem skills (vs "умения" skill)
    'самострелами', // crossbow attack speed vs generic
    'кинжалами',  // dagger attack speed/crit vs generic
    'посохами',   // staff attack speed/crit vs generic
    'копьями',    // spear attack speed vs generic
    'мечами',     // sword attack speed/crit vs generic
    'луками',     // bow attack speed vs generic (added for completeness)
    'топорами',   // axe attack speed vs generic (added for completeness)
    'без',        // unarmed attack speed vs generic ("без оружия")
    'для',        // spell-specific variants (e.g., "для заклинаний")
    '—',          // em-dash: distinguishes "(30—40)% ..." from "% ..." (tablet h4ipty FP)
  ];

  for (const jsonFile of jsonFiles) {
    const filePath = path.join(OUTPUT_DIR, jsonFile);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tokens = data.tokens;
    let fileRepaired = 0;

    // Build family-key map
    const tokenFamilyMap = new Map<string, string>();
    for (const token of tokens) {
      const fk = typeof token.familyKey === 'object' ? token.familyKey.ru : token.familyKey;
      tokenFamilyMap.set(token.id, fk);
    }

    // Iterate until no more changes
    let changed = true;
    while (changed) {
      changed = false;

      for (const token of tokens) {
        const regex = typeof token.regex === 'object' ? token.regex.ru : token.regex;
        if (!regex || regex.length === 0) continue;

        const tokenFamily = tokenFamilyMap.get(token.id) || '';
        const regexLower = regex.toLowerCase();

        // Find conflicting tokens (other-family, regex matches their rawText)
        const conflicts: { id: string; rawText: string }[] = [];
        for (const other of tokens) {
          if (other.id === token.id) continue;
          const otherFamily = tokenFamilyMap.get(other.id) || '';
          if (otherFamily === tokenFamily) continue;

          const otherRaw = typeof other.rawText === 'object' ? other.rawText.ru : other.rawText;
          if (otherRaw.toLowerCase().includes(regexLower)) {
            conflicts.push({ id: other.id, rawText: otherRaw });
          }
        }

        if (conflicts.length === 0) continue;

        // Step 1: Try lengthening the regex to the full template suffix
        const template = typeof token.rawTextTemplate === 'object'
          ? token.rawTextTemplate.ru : token.rawTextTemplate;
        if (template) {
          const fullSuffix = extractTemplateSuffix(template);
          if (fullSuffix && fullSuffix.length > regex.length && fullSuffix.toLowerCase() !== regexLower) {
            const longerLower = fullSuffix.toLowerCase();
            let longerConflicts = 0;
            for (const other of tokens) {
              if (other.id === token.id) continue;
              const otherFamily = tokenFamilyMap.get(other.id) || '';
              if (otherFamily === tokenFamily) continue;
              const otherRaw = (typeof other.rawText === 'object' ? other.rawText.ru : other.rawText).toLowerCase();
              if (otherRaw.includes(longerLower)) longerConflicts++;
            }
            if (longerConflicts < conflicts.length) {
              // Longer suffix has fewer conflicts — upgrade regex
              token.regex = typeof token.regex === 'object' ? { ...token.regex, ru: fullSuffix } : fullSuffix;
              // Reset excludes since the longer regex may not need them
              if (token.regexExclude) {
                if (typeof token.regexExclude === 'object' && !Array.isArray(token.regexExclude)) {
                  token.regexExclude = { ...token.regexExclude, ru: [] };
                } else {
                  token.regexExclude = { ru: [] };
                }
              }
              changed = true;
              fileRepaired++;
              totalRepaired++;
              continue; // Re-evaluate with new regex on next iteration
            }
          }
        }

        // Step 2: Add exclude patterns for remaining conflicts
        const currentExcludes: string[] = token.regexExclude
          ? (Array.isArray(token.regexExclude)
            ? [...token.regexExclude]
            : (typeof token.regexExclude === 'object' && token.regexExclude.ru
              ? [...(token.regexExclude.ru || [])]
              : []))
          : [];

        // Check if current excludes already cover all conflicts
        const coveredByCurrent = new Set<number>();
        for (let i = 0; i < conflicts.length; i++) {
          const confRaw = conflicts[i].rawText.toLowerCase();
          if (currentExcludes.some(exc => confRaw.includes(exc.toLowerCase()))) {
            coveredByCurrent.add(i);
          }
        }
        if (coveredByCurrent.size === conflicts.length) continue;

        // Try adding new excludes
        const newExcludes: string[] = [...currentExcludes];

        // Try known conflict markers
        for (const marker of CONFLICT_MARKERS) {
          if (newExcludes.length >= 10) break;
          if (newExcludes.includes(marker)) continue;

          let coversAny = false;
          for (let i = 0; i < conflicts.length; i++) {
            if (coveredByCurrent.has(i)) continue;
            if (conflicts[i].rawText.toLowerCase().includes(marker.toLowerCase())) {
              coversAny = true;
              break;
            }
          }
          if (!coversAny) continue;

          // Check: marker does NOT appear in target family's tokens
          const markerLower = marker.toLowerCase();
          let validForTarget = true;
          for (const t of tokens) {
            const tFam = tokenFamilyMap.get(t.id) || '';
            if (tFam !== tokenFamily) continue;
            const tRaw = (typeof t.rawText === 'object' ? t.rawText.ru : t.rawText).toLowerCase();
            if (tRaw.includes(markerLower)) {
              validForTarget = false;
              break;
            }
          }
          if (!validForTarget) continue;

          newExcludes.push(marker);
        }

        // Try first word after suffix in uncovered conflicts
        for (let i = 0; i < conflicts.length; i++) {
          if (newExcludes.length >= 10) break;
          if (coveredByCurrent.has(i)) continue;

          const confRaw = conflicts[i].rawText.toLowerCase();
          const suffixIdx = confRaw.indexOf(regexLower);
          if (suffixIdx === -1) continue;

          const afterSuffix = confRaw.substring(suffixIdx + regexLower.length).trim();
          if (afterSuffix.length === 0) continue;

          const firstWord = afterSuffix.split(/\s+/)[0].replace(/^[^a-zA-Zа-яА-ЯёЁ]*/, '');
          if (firstWord.length < 3) continue;

          const wordLower = firstWord.toLowerCase();
          let validForTarget = true;
          for (const t of tokens) {
            const tFam = tokenFamilyMap.get(t.id) || '';
            if (tFam !== tokenFamily) continue;
            const tRaw = (typeof t.rawText === 'object' ? t.rawText.ru : t.rawText).toLowerCase();
            if (tRaw.includes(wordLower)) {
              validForTarget = false;
              break;
            }
          }
          if (!validForTarget) continue;

          if (!newExcludes.includes(firstWord)) {
            newExcludes.push(firstWord);
          }
        }

        // Apply updated excludes if they changed
        if (newExcludes.length > currentExcludes.length) {
          const existing = token.regexExclude;
          if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
            token.regexExclude = { ...existing, ru: newExcludes };
          } else {
            token.regexExclude = { ru: newExcludes };
          }
          changed = true;
          fileRepaired++;
          totalRepaired++;
        }

        // Step 3: If excludes still can't cover all conflicts, try regexPrefixContext.
        // Find a short substring that appears in ALL target-family tokens but NOT
        // in any uncovered conflict tokens. This creates AND(LITERAL(context), LITERAL(regex))
        // which compiles to "context" "suffix" in PoE2.
        {
          const currentExcludesAfterStep2: string[] = token.regexExclude
            ? (Array.isArray(token.regexExclude)
              ? [...token.regexExclude]
              : (typeof token.regexExclude === 'object' && token.regexExclude.ru
                ? [...(token.regexExclude.ru || [])]
                : []))
            : [];

          // Find uncovered conflicts (after excludes applied)
          const uncoveredConflicts: { id: string; rawText: string }[] = [];
          for (const conf of conflicts) {
            const confRaw = conf.rawText.toLowerCase();
            if (!currentExcludesAfterStep2.some(exc => confRaw.includes(exc.toLowerCase()))) {
              uncoveredConflicts.push(conf);
            }
          }

          if (uncoveredConflicts.length === 0) continue;

          // Already has prefix context? Skip
          const existingContext = token.regexPrefixContext
            ? (typeof token.regexPrefixContext === 'object' ? token.regexPrefixContext.ru : '')
            : '';
          if (existingContext) continue;

          // Collect all same-family rawTexts to find common substrings
          const familyTexts: string[] = [];
          for (const t of tokens) {
            const tFam = tokenFamilyMap.get(t.id) || '';
            if (tFam === tokenFamily) {
              familyTexts.push((typeof t.rawText === 'object' ? t.rawText.ru : t.rawText).toLowerCase());
            }
          }

          // Find the shortest common substring that:
          // 1. Appears in ALL family texts
          // 2. Does NOT appear in any uncovered conflict text
          // Try candidate words from the template prefix (text before first #)
          const tmpl = typeof token.rawTextTemplate === 'object'
            ? token.rawTextTemplate.ru : token.rawTextTemplate;
          let bestContext = '';

          if (tmpl) {
            // Extract text before first # placeholder
            const hashIdx = tmpl.indexOf('#');
            if (hashIdx > 0) {
              const prefixText = tmpl.substring(0, hashIdx).trim();
              // Try words from the prefix (right to left, shortest first)
              const prefixWords = prefixText.split(/\s+/);
              // Try individual words from end of prefix
              for (let i = prefixWords.length - 1; i >= 0; i--) {
                const word = prefixWords[i].replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
                if (word.length < 3) continue;
                const wordLower = word.toLowerCase();

                // Check: word appears in ALL family texts
                const inAllFamily = familyTexts.every(t => t.includes(wordLower));
                if (!inAllFamily) continue;

                // Check: word does NOT appear in any uncovered conflict
                const inAnyConflict = uncoveredConflicts.some(c =>
                  c.rawText.toLowerCase().includes(wordLower)
                );
                if (inAnyConflict) continue;

                bestContext = word;
                break; // Found shortest valid word from the end
              }

              // If single word not found, try 2-word combinations from end
              if (!bestContext && prefixWords.length >= 2) {
                for (let i = prefixWords.length - 1; i >= 1; i--) {
                  const twoWords = prefixWords.slice(i - 1, i + 1)
                    .map((w: string) => w.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, ''))
                    .filter((w: string) => w.length > 0)
                    .join(' ');
                  if (twoWords.length < 5) continue;
                  const twoLower = twoWords.toLowerCase();

                  const inAllFamily = familyTexts.every(t => t.includes(twoLower));
                  if (!inAllFamily) continue;

                  const inAnyConflict = uncoveredConflicts.some(c =>
                    c.rawText.toLowerCase().includes(twoLower)
                  );
                  if (inAnyConflict) continue;

                  bestContext = twoWords;
                  break;
                }
              }
            }
          }

          // If no prefix-based context found, try conflict markers as context
          // Markers that appear in ALL family texts but NOT in uncovered conflicts
          // make good AND-composed prefix contexts (e.g., "—" for number-range mods)
          if (!bestContext) {
            for (const marker of CONFLICT_MARKERS) {
              const markerLower = marker.toLowerCase();
              // Marker must appear in ALL family texts
              const inAllFamily = familyTexts.every(t => t.includes(markerLower));
              if (!inAllFamily) continue;
              // Marker must NOT appear in any uncovered conflict
              const inAnyConflict = uncoveredConflicts.some(c =>
                c.rawText.toLowerCase().includes(markerLower)
              );
              if (inAnyConflict) continue;
              bestContext = marker;
              break;
            }
          }

          // If still no context found, try brute-force common substring
          if (!bestContext && familyTexts.length > 0) {
            // Try all substrings of the first family text from shortest to longest
            const firstText = familyTexts[0];
            for (let len = 3; len <= Math.min(firstText.length, 20); len++) {
              let found = false;
              for (let start = 0; start <= firstText.length - len; start++) {
                const candidate = firstText.substring(start, start + len).trim();
                if (candidate.length < 3 || candidate.includes('(') || candidate.includes(')')) continue;
                // Must start and end with a letter
                if (!/[a-zA-Zа-яА-ЯёЁ]/.test(candidate[0]) || !/[a-zA-Zа-яА-ЯёЁ]/.test(candidate[candidate.length - 1])) continue;

                const candLower = candidate.toLowerCase();

                const inAllFamily = familyTexts.every(t => t.includes(candLower));
                if (!inAllFamily) continue;

                const inAnyConflict = uncoveredConflicts.some(c =>
                  c.rawText.toLowerCase().includes(candLower)
                );
                if (inAnyConflict) continue;

                bestContext = candidate;
                found = true;
                break;
              }
              if (found) break;
            }
          }

          if (bestContext) {
            token.regexPrefixContext = { ru: bestContext };
            // Clear excludes since context makes them unnecessary (context + regex AND is sufficient)
            // Actually, keep excludes that are still needed for partial coverage
            // But if regexPrefixContext covers ALL conflicts, we can clear excludes
            // Check: does context appear in any conflict (including covered ones)?
            const contextLower = bestContext.toLowerCase();
            const contextCoversAll = conflicts.every(c =>
              !c.rawText.toLowerCase().includes(contextLower)
            );
            if (contextCoversAll) {
              // Context alone eliminates all FP — clear excludes
              token.regexExclude = typeof token.regexExclude === 'object' && !Array.isArray(token.regexExclude)
                ? { ...token.regexExclude, ru: [] }
                : { ru: [] };
            }

            changed = true;
            fileRepaired++;
            totalRepaired++;
            console.log(`  regexPrefixContext: ${token.id} -> "${bestContext}" (eliminates ${uncoveredConflicts.length} uncovered FP)`);
          }
        }
      }
    }

    if (fileRepaired > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      console.log(`  ${jsonFile}: repaired ${fileRepaired} tokens`);
    }
  }

  console.log(`  Total tokens repaired: ${totalRepaired}`);
}

/**
 * Validate all generated regexes using the Regex Oracle.
 * Reads each JSON file from public/generated/, then for each token's regex
 * checks that it matches the token's own rawText and does not match any
 * OTHER token's rawText in the same category.
 *
 * Reports: false positives (FP) and false negatives (FN) per category.
 */
function validateGeneratedRegexes(): void {
  console.log('\n=== Validating regexes with Oracle ===');

  const jsonFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  let totalFP = 0;
  let totalFN = 0;

  for (const jsonFile of jsonFiles) {
    const filePath = path.join(OUTPUT_DIR, jsonFile);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tokens = data.tokens;
    if (!tokens || tokens.length === 0) continue;

    const category = data.category || jsonFile.replace('.json', '');
    const allModTexts = tokens.map((t: any) => t.rawText?.ru ?? '').filter((t: string) => t.length > 0);
    const allModTextsLower = allModTexts.map((t: string) => t.toLowerCase());

    let catFP = 0;
    let catFN = 0;
    const problemTokens: string[] = [];

    for (const token of tokens) {
      const regex = token.regex?.ru;
      const rawText = token.rawText?.ru;
      if (!regex || !rawText) continue;

      // Skip regexes that contain number patterns — these use prefix anchoring
      // and the Oracle can't validate them against rawText alone (needs game text)
      // We validate only LITERAL regexes (no .* or number patterns)
      if (regex.includes('.*') || regex.includes('[0-9]') || regex.includes('[1-9]')) continue;

      const targetTexts = [rawText.toLowerCase()];
      const result = validateRegex(regex, targetTexts, [], allModTextsLower);

      if (result.falseNegatives.length > 0) {
        catFN++;
        problemTokens.push(`FN: ${token.id} — regex "${regex}" doesn't match "${rawText}"`);
      }
      if (result.falsePositives.length > 0) {
        catFP++;
        // Report first 3 FP for this token
        const fpSamples = result.falsePositives.slice(0, 3).map(fp => fp.substring(0, 40));
        problemTokens.push(`FP: ${token.id} — regex "${regex}" also matches: ${fpSamples.join(', ')}`);
      }
    }

    if (catFP > 0 || catFN > 0) {
      console.log(`  ${category}: ${catFP} FP, ${catFN} FN`);
      for (const msg of problemTokens.slice(0, 10)) {
        console.log(`    ${msg}`);
      }
      if (problemTokens.length > 10) {
        console.log(`    ... and ${problemTokens.length - 10} more`);
      }
    } else {
      console.log(`  ${category}: all literal regexes valid`);
    }

    totalFP += catFP;
    totalFN += catFN;
  }

  console.log(`\n  Total: ${totalFP} FP, ${totalFN} FN across ${jsonFiles.length} categories`);
  if (totalFP === 0 && totalFN === 0) {
    console.log('  All literal regexes pass Oracle validation!');
  }
}

/**
 * Validate all generated regexes using BLOCK-BASED matching (matchPoE2RegexItem).
 *
 * Unlike validateGeneratedRegexes() which uses flat-text matching where .*
 * crosses block boundaries, this method accurately simulates in-game behavior:
 * - Each token is treated as a separate block (mods: [rawText])
 * - .* does NOT cross block boundaries
 * - FP are categorized into family-tier (by design) vs cross-family (real bugs)
 *
 * Reports per category: valid, invalid, crossFamilyFP, familyTierFP.
 */
function validateGeneratedRegexesItem(): void {
  console.log('\n=== Validating regexes with Block-based Oracle ===');

  const jsonFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  let grandTotal = 0;
  let grandValid = 0;
  let grandCrossFP = 0;
  let grandFamilyFP = 0;

  for (const jsonFile of jsonFiles) {
    const filePath = path.join(OUTPUT_DIR, jsonFile);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tokens = data.tokens;
    if (!tokens || tokens.length === 0) continue;

    const category = data.category || jsonFile.replace('.json', '');

    // Build GameItemText items: each token = one item with its rawText as a single mod block
    const allItems: { id: string; text: GameItemText }[] = tokens.map((t: any) => ({
      id: t.id,
      text: { mods: [t.rawText?.ru ?? ''] },
    }));

    // Build familyKey map from token data
    const familyKeyById = new Map<string, string>();
    for (const token of tokens) {
      const fk = token.familyKey?.ru;
      if (fk) {
        familyKeyById.set(token.id, fk);
      }
    }

    // Build regex list for batch validation
    // Compile the regex the same way the UI would, including regexPrefixContext
    // and regexExclude, so the Oracle reports accurate FP counts.
    const regexes = tokens
      .filter((t: any) => t.regex?.ru && t.rawText?.ru)
      .map((t: any) => {
        let regex = t.regex.ru;
        const excludes: string[] = t.regexExclude?.ru ?? [];
        const context: string = t.regexPrefixContext?.ru ?? '';

        // Build the effective regex as the UI compiles it:
        // - With context: AND(LITERAL(context), LITERAL(regex)) → "context" "regex"
        // - With excludes: suffix !"exclude1" !"exclude2"
        // - Both: "context" "regex" !"exclude1" !"exclude2"
        if (context) {
          // regexPrefixContext mode: AND(context, regex) + optional excludes
          const excludePart = excludes.length > 0
            ? ` ${excludes.map(e => `!"${e}"`).join(' ')}`
            : '';
          regex = `"${context}" "${regex}"${excludePart}`;
        } else if (excludes.length > 0) {
          // No context, just excludes: "suffix" !"exclude1" !"exclude2"
          regex = `"${regex}" ${excludes.map(e => `!"${e}"`).join(' ')}`;
        }
        // else: raw regex (validateRegexItem wraps in quotes automatically)

        return {
          tokenId: t.id,
          regex,
        };
      });

    const report = batchValidateItem(regexes, new Map(allItems.map(i => [i.id, i])), allItems, familyKeyById);

    // Log problems
    const problems = report.entries.filter(e => !e.result.valid);
    if (problems.length > 0) {
      console.log(`  ${category}: ${report.validCount}/${report.totalChecked} valid, ${report.crossFamilyFPCount} cross-family FP, ${report.familyTierFPOnlyCount} family-tier FP`);
      for (const entry of problems.slice(0, 10)) {
        const r = entry.result;
        if (r.falseNegatives.length > 0) {
          console.log(`    FN: ${entry.tokenId} — regex "${entry.regex}" doesn't match its own text`);
        }
        if (r.crossFamilyFP.length > 0) {
          const samples = r.crossFamilyFP.slice(0, 3).map(fp => fp.substring(0, 50));
          console.log(`    Cross-FP: ${entry.tokenId} — regex "${entry.regex}" also matches: ${samples.join(', ')}`);
        }
      }
      if (problems.length > 10) {
        console.log(`    ... and ${problems.length - 10} more`);
      }
    } else {
      console.log(`  ${category}: all ${report.totalChecked} regexes valid (block-based)`);
    }

    grandTotal += report.totalChecked;
    grandValid += report.validCount;
    grandCrossFP += report.crossFamilyFPCount;
    grandFamilyFP += report.familyTierFPOnlyCount;
  }

  console.log(`\n  Total: ${grandValid}/${grandTotal} valid, ${grandCrossFP} cross-family FP, ${grandFamilyFP} family-tier FP`);
  if (grandCrossFP === 0) {
    console.log('  No cross-family FP detected — all regexes are safe for in-game use!');
  }
}

runEtl().catch(err => {
  console.error('ETL Pipeline failed:', err);
  process.exit(1);
});
