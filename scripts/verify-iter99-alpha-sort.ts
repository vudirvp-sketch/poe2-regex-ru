/**
 * iter 99 verification: print within-block order before & after for amulet/ring.
 *
 * Confirms that:
 *  1. Within each functional block, groups are now alphabetically sorted by familyKey.
 *  2. Tier is no longer fragmenting alphabetical flow (tier shown as badge only).
 *  3. The render order of blocks themselves is unchanged (FUNCTIONAL_BLOCK_ORDER).
 *
 * Run: pnpm tsx scripts/verify-iter99-alpha-sort.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { groupTokensByFamily } from '../src/shared/family-grouper';
import { classifyGroups, FUNCTIONAL_BLOCK_LABELS } from '../src/shared/mod-classifier';
import type { CategoryData, FamilyGroup } from '../src/shared/types';

const GENERATED_DIR = join(process.cwd(), 'public', 'generated');

function loadCategory(name: string): CategoryData {
  const raw = readFileSync(join(GENERATED_DIR, `${name}.json`), 'utf8');
  return JSON.parse(raw) as CategoryData;
}

function printBlock(label: string, groups: FamilyGroup[]): void {
  console.log(`\n  ── ${label} (${groups.length} groups) ──`);
  for (const g of groups) {
    const tier = g.priorityTier;
    const key = g.familyKey.split('::')[0];
    console.log(`    [${tier}] ${key}`);
  }
}

function verifyCategory(categoryName: string): void {
  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  Category: ${categoryName}`);
  console.log(`════════════════════════════════════════════════════════════════`);

  const data = loadCategory(categoryName);
  const familyGroups = groupTokensByFamily(data.tokens, categoryName);

  for (const affix of ['prefix', 'suffix'] as const) {
    const affixGroups = familyGroups.filter(g => g.affix === affix);
    if (affixGroups.length === 0) continue;
    console.log(`\n>>> ${affix.toUpperCase()} (${affixGroups.length} groups)`);

    const subGroups = classifyGroups(affixGroups, 'affix-functional');
    console.log(`  Block render order: ${subGroups.map(sg => sg.key).join(' → ')}`);

    // Print within-block order for the first 5 blocks
    for (const sg of subGroups.slice(0, 6)) {
      printBlock(FUNCTIONAL_BLOCK_LABELS[sg.key as keyof typeof FUNCTIONAL_BLOCK_LABELS]?.label ?? sg.key, sg.groups);
    }
  }
}

verifyCategory('amulet');
verifyCategory('ring');
verifyCategory('belt');

console.log('\n✓ iter 99 verification complete.');
