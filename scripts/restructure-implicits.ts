/**
 * Restructure waystone.json and tablet.json to separate implicit-set bonuses from mods.
 *
 * In PoE2, waystones have two types of searchable text:
 * 1. Mods (prefix/suffix): Format `##% description` — number BEFORE text
 * 2. Implicits: Format `Description: +##%` — number AFTER text (REVERSED regex)
 *
 * Implicit-set bonus tokens are NOT real mods — they correspond to implicit properties
 * but were listed as mod text in poe2db's tables. They are NOT searchable as mod text
 * in-game. This script removes them and replaces them with proper implicit tokens.
 *
 * Usage: npx tsx scripts/restructure-implicits.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Types ───────────────────────────────────────────────────────────────────

interface GameToken {
  id: string;
  category: string;
  origin: string;
  rawText: Record<string, string>;
  rawTextTemplate: Record<string, string>;
  regex: Record<string, string>;
  familyKey: Record<string, string>;
  regexPrefix: Record<string, string>;
  hasMultiPlaceholder: boolean;
  genderForms: Record<string, Record<string, string>>;
  affix: string;
  tags: string[];
  ranges: number[][];
  values: number[];
  hasYofication: boolean;
  yoficationPositions: number[];
  level: number;
  regexExclude?: Record<string, string[]>;
  regexPrefixContext?: Record<string, string>;
}

interface OptimizationEntry {
  ids: string[];
  regex: Record<string, string>;
  weight: number;
  count: number;
  regexPrefixContext?: Record<string, string>;
  regexExclude?: Record<string, string[]>;
}

interface CategoryData {
  version: string;
  category: string;
  source: string;
  tokens: GameToken[];
  optimizationTable: Record<string, OptimizationEntry>;
}

// ─── Implicit-set bonus familyKeys to REMOVE ────────────────────────────────

const WAYSTONE_IMPLICIT_SET_FAMILY_KEYS: string[] = [
  'На #% больше находимых в области путевых камней',
  '#% увеличение эффективности монстров',
  'На #% больше редкости находимых в этой области предметов',
  'На #% больше размера групп монстров',
];

const TABLET_IMPLICIT_SET_FAMILY_KEYS: string[] = [
  '% увеличение количества находимых на карте путевых камней',
];

// ─── New implicit tokens to ADD ─────────────────────────────────────────────

function makeWaystoneImplicitTokens(origin: string): GameToken[] {
  return [
    {
      id: `${origin === 'normal' ? 'waystone' : 'waystone-desecrated'}.implicit.waystone_drop_chance`,
      category: origin === 'normal' ? 'waystone' : 'waystone-desecrated',
      origin,
      rawText: { ru: 'Шанс выпадения путевого камня: +##%' },
      rawTextTemplate: { ru: 'Шанс выпадения путевого камня: +##%' },
      regex: { ru: 'Шанс выпадения путевого камня' },
      familyKey: { ru: 'Шанс выпадения путевого камня: +##%' },
      regexPrefix: { ru: '' },
      hasMultiPlaceholder: false,
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [[50, 120]],
      values: [],
      hasYofication: true,
      yoficationPositions: [5, 20],
      level: 1,
    },
    {
      id: `${origin === 'normal' ? 'waystone' : 'waystone-desecrated'}.implicit.item_rarity`,
      category: origin === 'normal' ? 'waystone' : 'waystone-desecrated',
      origin,
      rawText: { ru: 'Редкость предметов: +##%' },
      rawTextTemplate: { ru: 'Редкость предметов: +##%' },
      regex: { ru: 'Редкость предметов' },
      familyKey: { ru: 'Редкость предметов: +##%' },
      regexPrefix: { ru: '' },
      hasMultiPlaceholder: false,
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [[8, 40]],
      values: [],
      hasYofication: true,
      yoficationPositions: [8],
      level: 1,
    },
    {
      id: `${origin === 'normal' ? 'waystone' : 'waystone-desecrated'}.implicit.pack_size`,
      category: origin === 'normal' ? 'waystone' : 'waystone-desecrated',
      origin,
      rawText: { ru: 'Размер групп монстров: +##%' },
      rawTextTemplate: { ru: 'Размер групп монстров: +##%' },
      regex: { ru: 'Размер групп монстров' },
      familyKey: { ru: 'Размер групп монстров: +##%' },
      regexPrefix: { ru: '' },
      hasMultiPlaceholder: false,
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [[5, 50]],
      values: [],
      hasYofication: true,
      yoficationPositions: [16],
      level: 1,
    },
    {
      id: `${origin === 'normal' ? 'waystone' : 'waystone-desecrated'}.implicit.monster_effectiveness`,
      category: origin === 'normal' ? 'waystone' : 'waystone-desecrated',
      origin,
      rawText: { ru: 'Эффективность монстров: +##%' },
      rawTextTemplate: { ru: 'Эффективность монстров: +##%' },
      regex: { ru: 'Эффективность монстров' },
      familyKey: { ru: 'Эффективность монстров: +##%' },
      regexPrefix: { ru: '' },
      hasMultiPlaceholder: false,
      genderForms: { ru: {} },
      affix: 'implicit',
      tags: [],
      ranges: [[10, 70]],
      values: [],
      hasYofication: true,
      yoficationPositions: [18],
      level: 1,
    },
    {
      id: `${origin === 'normal' ? 'waystone' : 'waystone-desecrated'}.implicit.revives`,
      category: origin === 'normal' ? 'waystone' : 'waystone-desecrated',
      origin,
      rawText: { ru: 'Доступно возрождений: #' },
      rawTextTemplate: { ru: 'Доступно возрождений: #' },
      regex: { ru: 'Доступно возрождений' },
      familyKey: { ru: 'Доступно возрождений: #' },
      regexPrefix: { ru: '' },
      hasMultiPlaceholder: false,
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

const TABLET_IMPLICIT_TOKENS: GameToken[] = [
  {
    id: 'tablet.implicit.charges',
    category: 'tablet',
    origin: 'normal',
    rawText: { ru: 'Осталось зарядов - #' },
    rawTextTemplate: { ru: 'Осталось зарядов - #' },
    regex: { ru: 'Осталось зарядов' },
    familyKey: { ru: 'Осталось зарядов - #' },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
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
    regex: { ru: 'алтари Ритуала' },
    familyKey: { ru: 'Добавляет алтари Ритуала на карту' },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
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
    regex: { ru: 'Заражение на карту' },
    familyKey: { ru: 'Добавляет Заражение на карту' },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
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
    regex: { ru: 'Бездны на карту' },
    familyKey: { ru: 'Добавляет Бездны на карту' },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
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
    regex: { ru: 'маяки ваал' },
    familyKey: { ru: 'Добавляет маяки ваал на карту' },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
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

// ─── Helper functions ────────────────────────────────────────────────────────

function readJson(filePath: string): CategoryData {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeJson(filePath: string, data: CategoryData): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function backupFile(filePath: string): string {
  const backupPath = filePath + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`  Backup created: ${backupPath}`);
  } else {
    console.log(`  Backup already exists: ${backupPath}`);
  }
  return backupPath;
}

function isImplicitSetBonus(token: GameToken, familyKeysToRemove: string[]): boolean {
  const fkRu = token.familyKey?.ru ?? '';
  return familyKeysToRemove.includes(fkRu);
}

function cleanOptimizationTable(
  optTable: Record<string, OptimizationEntry>,
  removedIds: Set<string>
): { cleaned: Record<string, OptimizationEntry>; removedEntries: number; modifiedEntries: number } {
  const cleaned: Record<string, OptimizationEntry> = {};
  let removedEntries = 0;
  let modifiedEntries = 0;

  for (const [key, entry] of Object.entries(optTable)) {
    const filteredIds = entry.ids.filter(id => !removedIds.has(id));

    if (filteredIds.length === 0) {
      // All IDs in this entry were removed — drop the entry entirely
      removedEntries++;
      console.log(`    REMOVED entry: ${key.substring(0, 80)}...`);
      continue;
    }

    if (filteredIds.length < entry.ids.length) {
      // Some IDs were removed — update the entry
      modifiedEntries++;
      console.log(`    MODIFIED entry: ${key.substring(0, 80)}... (${entry.ids.length - filteredIds.length} IDs removed, ${filteredIds.length} remaining)`);
      cleaned[key] = {
        ...entry,
        ids: filteredIds,
        count: filteredIds.length,
      };
    } else {
      // No changes needed
      cleaned[key] = entry;
    }
  }

  return { cleaned, removedEntries, modifiedEntries };
}

// ─── Main processing ────────────────────────────────────────────────────────

function processFile(
  filePath: string,
  familyKeysToRemove: string[],
  newImplicitTokens: GameToken[],
  label: string
): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Processing: ${label} (${filePath})`);
  console.log('='.repeat(70));

  // Backup
  backupFile(filePath);

  // Read
  const data = readJson(filePath);

  // Identify tokens to remove
  const removedTokens: GameToken[] = [];
  const keptTokens: GameToken[] = [];

  for (const token of data.tokens) {
    if (isImplicitSetBonus(token, familyKeysToRemove)) {
      removedTokens.push(token);
    } else {
      keptTokens.push(token);
    }
  }

  console.log(`\n  Tokens before: ${data.tokens.length}`);
  console.log(`  Tokens to remove: ${removedTokens.length}`);
  console.log(`  Implicit tokens to add: ${newImplicitTokens.length}`);

  // Group removed tokens by familyKey for reporting
  const byFamily: Record<string, number> = {};
  for (const t of removedTokens) {
    const fk = t.familyKey?.ru ?? 'unknown';
    byFamily[fk] = (byFamily[fk] || 0) + 1;
  }
  console.log('\n  Removed by familyKey:');
  for (const [fk, count] of Object.entries(byFamily)) {
    console.log(`    "${fk}": ${count} tokens`);
  }

  // Add new implicit tokens
  const allTokens = [...keptTokens, ...newImplicitTokens];
  console.log(`\n  Tokens after: ${allTokens.length}`);

  // Collect removed IDs
  const removedIds = new Set(removedTokens.map(t => t.id));

  // Clean optimizationTable
  console.log('\n  Cleaning optimizationTable...');
  const { cleaned, removedEntries, modifiedEntries } = cleanOptimizationTable(
    data.optimizationTable,
    removedIds
  );
  console.log(`\n  OptimizationTable entries removed: ${removedEntries}`);
  console.log(`  OptimizationTable entries modified: ${modifiedEntries}`);
  console.log(`  OptimizationTable entries unchanged: ${Object.keys(data.optimizationTable).length - removedEntries - modifiedEntries}`);

  // Update data
  data.tokens = allTokens;
  data.optimizationTable = cleaned;

  // Write
  writeJson(filePath, data);
  console.log(`\n  Written: ${filePath}`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const GENERATED_DIR = path.resolve(__dirname, '../public/generated');

function main(): void {
  console.log('Restructure Implicits Script');
  console.log('='.repeat(70));

  // Process waystone.json
  processFile(
    path.join(GENERATED_DIR, 'waystone.json'),
    WAYSTONE_IMPLICIT_SET_FAMILY_KEYS,
    makeWaystoneImplicitTokens('normal'),
    'waystone'
  );

  // Process tablet.json
  processFile(
    path.join(GENERATED_DIR, 'tablet.json'),
    TABLET_IMPLICIT_SET_FAMILY_KEYS,
    TABLET_IMPLICIT_TOKENS,
    'tablet'
  );

  // Process waystone-desecrated.json
  // Check if it has implicit-set bonus tokens (it doesn't, but check anyway)
  const desecratedPath = path.join(GENERATED_DIR, 'waystone-desecrated.json');
  const desecratedData = readJson(desecratedPath);
  const desecratedImplicitTokens = desecratedData.tokens.filter(t =>
    isImplicitSetBonus(t, WAYSTONE_IMPLICIT_SET_FAMILY_KEYS)
  );

  if (desecratedImplicitTokens.length > 0) {
    processFile(
      desecratedPath,
      WAYSTONE_IMPLICIT_SET_FAMILY_KEYS,
      makeWaystoneImplicitTokens('desecrated'),
      'waystone-desecrated'
    );
  } else {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Processing: waystone-desecrated (${desecratedPath})`);
    console.log('='.repeat(70));
    console.log('\n  No implicit-set bonus tokens found — only adding implicit tokens.');

    // Backup
    backupFile(desecratedPath);

    // Add implicit tokens with origin: "desecrated"
    const newImplicits = makeWaystoneImplicitTokens('desecrated');
    console.log(`  Tokens before: ${desecratedData.tokens.length}`);
    console.log(`  Implicit tokens to add: ${newImplicits.length}`);

    desecratedData.tokens = [...desecratedData.tokens, ...newImplicits];
    console.log(`  Tokens after: ${desecratedData.tokens.length}`);

    writeJson(desecratedPath, desecratedData);
    console.log(`\n  Written: ${desecratedPath}`);
  }

  // Verify output
  console.log(`\n${'='.repeat(70)}`);
  console.log('Verification');
  console.log('='.repeat(70));

  for (const fileName of ['waystone.json', 'tablet.json', 'waystone-desecrated.json']) {
    const filePath = path.join(GENERATED_DIR, fileName);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const implicitCount = data.tokens.filter((t: GameToken) => t.affix === 'implicit').length;
      const totalTokens = data.tokens.length;
      console.log(`  ${fileName}: ${totalTokens} tokens (${implicitCount} implicit) — valid JSON ✓`);
    } catch (e) {
      console.error(`  ${fileName}: INVALID JSON ✗ — ${(e as Error).message}`);
    }
  }

  console.log('\nDone!');
}

main();
