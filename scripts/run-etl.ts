/**
 * ETL Pipeline Orchestrator
 * Run with: pnpm etl
 *
 * Fetches mod data from poe2db.tw, normalizes, computes regex substrings,
 * computes optimizations, and generates JSON files in public/generated/.
 */
import { fetchPage } from './etl/fetch-poe2db.js';
import { parseTypeAPage, parseAllTypeATabs } from './etl/parse-tables.js';
import { parseTypeBPage } from './etl/parse-modifiers-calc.js';
import { normalizeTypeA, normalizeTypeB } from './etl/normalize.js';
import { computeMinimalUniqueSubstring } from './etl/compute-regex.js';
import { computeOptimizations } from './etl/compute-optimizations.js';
import { assembleCategoryData, writeCategoryJson } from './etl/generate-dictionary.js';
import type { ModOrigin } from '../src/shared/types.js';
import * as path from 'path';
import * as fs from 'fs';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'generated');

interface CategoryConfig {
  name: string;
  urls: string[];
  type: 'A' | 'B';
  tabIds?: string[];
  origin?: ModOrigin;
}

const categories: CategoryConfig[] = [
  {
    name: 'waystone',
    urls: ['https://poe2db.tw/ru/Waystones'],
    type: 'A',
    tabIds: ['ПутевыекамниMods'],
  },
  {
    name: 'waystone-desecrated',
    urls: ['https://poe2db.tw/ru/Waystones'],
    type: 'A',
    tabIds: ['DesecratedWaystoneMods'],
    origin: 'desecrated',
  },
  {
    name: 'tablet',
    urls: ['https://poe2db.tw/ru/Tablet'],
    type: 'A',
    tabIds: ['БашниПредтечMods'],
  },
  {
    name: 'relic',
    urls: ['https://poe2db.tw/ru/Urn_Relic', 'https://poe2db.tw/ru/Seal_Relic'],
    type: 'B',
  },
  {
    name: 'jewel',
    urls: ['https://poe2db.tw/ru/Jewels'],
    type: 'A',
    tabIds: ['JewelMods', 'JewelsDesecratedMods', 'JewelCorruptMods'],
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
      let normalized;

      if (cat.type === 'A') {
        const rawMods = rawHtmls.flatMap(html => {
          if (cat.tabIds && cat.tabIds.length > 0) {
            return cat.tabIds.flatMap(tabId => parseTypeAPage(html, tabId));
          }
          // Parse all tabs
          const allTabs = parseAllTypeATabs(html);
          return Object.values(allTabs).flat();
        });

        const origin: ModOrigin = cat.origin ?? 'normal';
        normalized = rawMods.map(mod => normalizeTypeA(mod, cat.name, origin));
      } else {
        const rawGroups = rawHtmls.flatMap(html => parseTypeBPage(html));
        normalized = rawGroups.flatMap(group =>
          group.tiers.map(tier => normalizeTypeB(tier, group, cat.name))
        );
      }

      console.log(`  Parsed ${normalized.length} mods`);

      if (normalized.length === 0) {
        console.warn(`  WARNING: No mods found for ${cat.name}. Skipping.`);
        continue;
      }

      // Step 3: Compute regex
      console.log('  Step 3: Computing regex substrings...');
      const regexResults = new Map<string, { regex: string; hasYofication: boolean; yoficationPositions: number[] }>();
      for (const token of normalized) {
        const result = computeMinimalUniqueSubstring(token, normalized, 'ru');
        regexResults.set(token.id, result);
      }

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

  console.log('\n=== ETL Pipeline Complete ===');
}

runEtl().catch(err => {
  console.error('ETL Pipeline failed:', err);
  process.exit(1);
});
