/**
 * Cross-validate ETL-tagged functionalCategory vs runtime classifyFunctionalBlock.
 *
 * This script builds FamilyGroups from existing jewel.json tokens and classifies
 * them using both the ETL classifier and the real runtime classifyFunctionalBlock.
 * Any discrepancies are reported.
 *
 * Run: npx tsx scripts/verify-iter90-cross-validation.ts
 */

import { classifyFunctionalBlock } from '../src/shared/mod-classifier.js';
import { classifyModFunctionalBlock } from './etl/classify-functional-category.js';
import { groupTokensByFamily } from '../src/shared/family-grouper.js';
import type { GameToken, FamilyGroup, AffixType, PriorityTier } from '../src/shared/types.js';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'generated');

/**
 * Simplified family grouping for verification.
 * Builds FamilyGroups from tokens the same way the runtime does.
 */
function buildFamilyGroups(tokens: GameToken[]): FamilyGroup[] {
  const groups = new Map<string, GameToken[]>();
  
  for (const token of tokens) {
    const key = `${token.familyKey.ru}::${token.affix}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(token);
  }

  const result: FamilyGroup[] = [];
  for (const [, members] of groups) {
    const t0 = members[0];
    const displayText = t0.rawTextTemplate.ru;
    result.push({
      familyKey: t0.familyKey.ru,
      affix: t0.affix as AffixType,
      members,
      globalMin: 0,
      globalMax: 0,
      displayText,
      hasMultiPlaceholder: t0.hasMultiPlaceholder,
      rangeSlots: [],
      filterSlotIndex: 0,
      priorityTier: 'C' as PriorityTier,
    });
  }
  return result;
}

async function main() {
  console.log('=== iter 90 cross-validation: ETL vs runtime classifyFunctionalBlock ===\n');

  const categories = ['jewel', 'amulet', 'ring', 'belt'];
  
  for (const catName of categories) {
    const filePath = path.join(OUTPUT_DIR, `${catName}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`  Skipping ${catName}: file not found`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tokens: GameToken[] = data.tokens;
    const familyGroups = buildFamilyGroups(tokens);

    let match = 0;
    let mismatch = 0;
    const mismatches: { familyKey: string; etl: string; runtime: string; text: string }[] = [];

    for (const group of familyGroups) {
      // Runtime classification
      const runtimeBlock = classifyFunctionalBlock(group);
      
      // ETL classification (using first member's tags + rawText)
      const etlBlock = classifyModFunctionalBlock(
        group.members[0].tags,
        group.members[0].rawText.ru
      );

      if (runtimeBlock === etlBlock) {
        match++;
      } else {
        mismatch++;
        mismatches.push({
          familyKey: group.familyKey,
          etl: etlBlock,
          runtime: runtimeBlock,
          text: group.displayText.substring(0, 80),
        });
      }
    }

    console.log(`\n${catName}: ${familyGroups.length} family-groups`);
    console.log(`  Match: ${match}, Mismatch: ${mismatch}`);

    if (mismatches.length > 0) {
      console.log(`  Discrepancies:`);
      for (const m of mismatches.slice(0, 30)) {
        console.log(`    ${m.etl} vs ${m.runtime}: ${m.text}`);
      }
    }

    // Count by runtime block
    const blockCounts: Record<string, number> = {};
    for (const group of familyGroups) {
      const block = classifyFunctionalBlock(group);
      blockCounts[block] = (blockCounts[block] || 0) + 1;
    }
    const total = Object.values(blockCounts).reduce((a, b) => a + b, 0);
    const otherCount = blockCounts['other'] || 0;
    console.log(`  other-bucket: ${otherCount} / ${total} = ${(otherCount / total * 100).toFixed(1)}%`);
  }

  console.log('\n✅ Cross-validation complete.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
