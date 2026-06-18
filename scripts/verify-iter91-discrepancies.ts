/**
 * Analyze the 11 cross-validation discrepancies between ETL and runtime.
 * Determine if ETL classification is better for each case.
 */
import { classifyFunctionalBlock } from '../src/shared/mod-classifier.js';
import { classifyModFunctionalBlock } from './etl/classify-functional-category.js';
import type { GameToken, FamilyGroup, AffixType, PriorityTier } from '../src/shared/types.js';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'generated');

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
    result.push({
      familyKey: t0.familyKey.ru,
      affix: t0.affix as AffixType,
      members,
      globalMin: 0, globalMax: 0,
      displayText: t0.rawTextTemplate.ru,
      hasMultiPlaceholder: t0.hasMultiPlaceholder,
      rangeSlots: [], filterSlotIndex: 0,
      priorityTier: 'C' as PriorityTier,
    });
  }
  return result;
}

function main() {
  const categories = ['jewel', 'amulet', 'ring', 'belt'];
  
  for (const cat of categories) {
    const filePath = path.join(OUTPUT_DIR, `${cat}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tokens: GameToken[] = data.tokens;
    const groups = buildFamilyGroups(tokens);

    for (const group of groups) {
      const etlCat = classifyModFunctionalBlock(group.members[0].tags, group.members[0].rawText.ru);
      const runtimeCat = classifyFunctionalBlock(group);
      
      if (etlCat !== runtimeCat) {
        console.log(`[${cat}] ETL=${etlCat} vs Runtime=${runtimeCat}`);
        console.log(`  text: ${group.displayText.substring(0, 100)}`);
        console.log(`  tags: ${group.members[0].tags.join(', ')}`);
        console.log(`  etl functionalCategory on token: ${group.members[0].functionalCategory}`);
        console.log('');
      }
    }
  }
}

main();
