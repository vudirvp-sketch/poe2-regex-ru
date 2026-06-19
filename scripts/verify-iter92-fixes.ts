/**
 * iter 92 verification: confirm that the two fixes (multi-segment per-segment
 * classification + i18n-override reclassification) resolved all 11
 * cross-validation discrepancies from iter 91.
 *
 * Run: npx tsx scripts/verify-iter92-fixes.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { classifyFunctionalBlock } from '../src/shared/mod-classifier.js';
import { classifyModFunctionalBlock } from './etl/classify-functional-category.js';
import type { GameToken, FamilyGroup, AffixType, PriorityTier } from '../src/shared/types.js';

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

// Specific tokens that were broken in iter 91 and should be fixed in iter 92.
// iter 93 update: 3 penetration tokens moved from `resistances` to `penetration` block
// (iter 93 supersedes iter 92's "consistency as resistances" goal for those tokens).
const EXPECTED_TOKEN_CATEGORIES: { file: string; id: string; expected: string; description: string }[] = [
  // Multi-segment tier fix (jewel):
  { file: 'jewel.json', id: 'jewel.mod_764thg', expected: 'buff-skills', description: 'aura strength (second segment of multi-segment tier)' },
  { file: 'jewel.json', id: 'jewel.mod_ppjbmq', expected: 'damage-type', description: 'spell damage (first segment of multi-segment tier)' },
  { file: 'jewel.json', id: 'jewel.mod_wditcf', expected: 'buff-skills', description: 'warcry buff effect (first segment of multi-segment tier)' },
  // iter 93: penetration tokens moved to dedicated `penetration` block
  { file: 'jewel.json', id: 'jewel.mod_5rcjkz', expected: 'penetration', description: 'cold penetration (iter 93: moved to penetration block)' },
  { file: 'jewel.json', id: 'jewel.mod_hpfzjc', expected: 'penetration', description: 'fire penetration (iter 93: moved to penetration block)' },
  { file: 'jewel.json', id: 'jewel.mod_ss8pp2', expected: 'penetration', description: 'lightning penetration (iter 93: moved to penetration block)' },
  { file: 'jewel.json', id: 'jewel.mod_v23dqm', expected: 'minions', description: 'companion damage (single-segment tier.tags wins)' },
  // i18n-override reclassification fix (amulet/belt):
  { file: 'amulet.json', id: 'amulet.genesistreeadditionalmaximumseals_breachborn', expected: 'meta-skills', description: 'Запечатанные умения (English→Russian text override)' },
  { file: 'amulet.json', id: 'amulet.spelldamageduringmanaflaskeffect1_breachborn', expected: 'flasks', description: 'flask-conditional spell damage (English→Russian text override)' },
  { file: 'belt.json', id: 'belt.genesistreebeltsealgainfrequency_breachborn', expected: 'meta-skills', description: 'Запечатанные умения (English→Russian text override)' },
];

function main() {
  console.log('=== iter 92 + iter 93 verification ===\n');
  console.log('  iter 92: 11 discrepancies resolved (multi-segment per-segment + i18n-override)');
  console.log('  iter 93: penetration block activated (3 mods moved resistances → penetration)\n');

  // Check 1: specific tokens
  let tokenChecksPass = true;
  console.log('--- Token-level checks (specific bugs from iter 91) ---');
  for (const check of EXPECTED_TOKEN_CATEGORIES) {
    const filePath = path.join(OUTPUT_DIR, check.file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tok = data.tokens.find((t: GameToken) => t.id === check.id);
    if (!tok) {
      console.log(`❌ NOT FOUND: ${check.id}`);
      tokenChecksPass = false;
      continue;
    }
    const actual = tok.functionalCategory;
    const ok = actual === check.expected;
    if (!ok) tokenChecksPass = false;
    console.log(`${ok ? '✓' : '❌'} ${check.id}`);
    console.log(`   text: ${tok.rawText.ru}`);
    console.log(`   actual: ${actual} | expected: ${check.expected} (${check.description})`);
  }
  console.log();

  // Check 2: cross-validation (all categories, should be 0 discrepancies)
  console.log('--- Cross-validation: ETL classifier vs Runtime classifier ---');
  const categories = ['jewel', 'amulet', 'ring', 'belt'];
  let totalGroups = 0;
  let discrepancies = 0;
  for (const cat of categories) {
    const filePath = path.join(OUTPUT_DIR, `${cat}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tokens: GameToken[] = data.tokens;
    const groups = buildFamilyGroups(tokens);

    for (const group of groups) {
      totalGroups++;
      const etlCat = classifyModFunctionalBlock(group.members[0].tags, group.members[0].rawText.ru);
      const runtimeCat = classifyFunctionalBlock(group);
      if (etlCat !== runtimeCat) {
        discrepancies++;
        console.log(`  [${cat}] ETL=${etlCat} vs Runtime=${runtimeCat}: ${group.displayText.substring(0, 80)}`);
      }
    }
  }
  console.log(`\nTotal: ${totalGroups} family-groups, ${discrepancies} discrepancies`);
  console.log();

  // Final summary
  console.log('=== Summary ===');
  console.log(`Token checks: ${tokenChecksPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Cross-validation: ${discrepancies === 0 ? '✅ PASS (0 discrepancies)' : `❌ FAIL (${discrepancies} discrepancies)`}`);

  if (tokenChecksPass && discrepancies === 0) {
    console.log('\n✅ iter 92 + iter 93 fixes verified: all checks pass, 0 cross-validation discrepancies.');
  } else {
    console.log('\n❌ Some checks failed.');
    process.exit(1);
  }
}

main();
