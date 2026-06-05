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
import { fetchPage } from './etl/fetch-poe2db.js';
import { parseTypeAPage } from './etl/parse-tables.js';
import { parseTypeBPage } from './etl/parse-modifiers-calc.js';
import { normalizeTypeA, normalizeTypeB } from './etl/normalize.js';
import { computeAllRegexes } from './etl/compute-regex.js';
import { computeOptimizations } from './etl/compute-optimizations.js';
import { assembleCategoryData, writeCategoryJson } from './etl/generate-dictionary.js';
import type { ModOrigin } from '../src/shared/types.js';
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

function applyI18nOverrides() {
  const overridesPath = path.resolve(process.cwd(), 'scripts', 'etl', 'i18n-overrides.json');
  if (!fs.existsSync(overridesPath)) {
    console.log('\n  No i18n-overrides.json found, skipping override step.');
    return;
  }

  const overridesFile = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
  const overrides: Record<string, { rawText: string; rawTextTemplate?: string; source?: string }> =
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
            let isUnique = true;
            for (const otherToken of data.tokens) {
              if (sameFamily.includes(otherToken.id)) continue;
              // Skip compound families (same prefix pattern)
              const otherFk = normalizeTemplate(otherToken.rawTextTemplate.ru);
              if (familyKey.startsWith(otherFk) || otherFk.startsWith(familyKey)) continue;

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
          token.regex.ru = findShortestUniqueSubstring(override.rawText.toLowerCase(), exclusionSubs, 3);
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

async function runEtl() {
  console.log('=== PoE2 Regex RU — ETL Pipeline ===\n');
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

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

        normalized = rawMods.map(mod =>
          normalizeTypeA(mod, cat.name, mod.origin || cat.origin || 'normal')
        );
      } else if (cat.type === 'relic') {
        // Relics: parse the #RelicMods HTML table from each page
        const rawMods = rawHtmls.flatMap(html => {
          return parseTypeAPage(html, 'RelicMods', 'normal');
        });

        normalized = rawMods.map(mod =>
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
          group.tiers.map(tier => normalizeTypeB(tier, group, cat.name))
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

      // Step 3: Compute regex
      console.log('  Step 3: Computing regex substrings...');
      const regexResults = computeAllRegexes(normalized, 'ru');

      // Step 4: Compute optimizations
      console.log('  Step 4: Computing optimizations...');
      const optimizations = computeOptimizations(normalized, regexResults, 'ru');

      // Step 5: Generate JSON
      console.log('  Step 5: Generating JSON...');
      const categoryData = assembleCategoryData(
        cat.name,
        normalized,
        regexResults,
        optimizations,
        'ru'
      );
      writeCategoryJson(categoryData, OUTPUT_DIR);

      console.log(`  Done: ${categoryData.tokens.length} tokens, ${Object.keys(optimizations).length} optimizations`);
    } catch (err) {
      console.error(`  ERROR processing ${cat.name}:`, err);
    }
  }

  // Step 6: Apply i18n overrides for tokens without Russian text on poe2db.tw
  applyI18nOverrides();

  console.log('\n=== ETL Pipeline Complete ===');
}

runEtl().catch(err => {
  console.error('ETL Pipeline failed:', err);
  process.exit(1);
});
