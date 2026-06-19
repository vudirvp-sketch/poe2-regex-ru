/**
 * iter 94 verification: confirm that the AILMENTS tag-priority refactor
 * (move AILMENTS_PATTERN before DAMAGE_TYPE + add `ailment` tag check)
 * correctly reclassifies the 3 target jewel mods and produces 0 cross-validation
 * discrepancies between ETL classifier and runtime classifier.
 *
 * Target reclassifications:
 *  - jewel.mod_l1y0fl «увеличение силы накладываемых вами состояний» → ailments
 *  - jewel.mod_40sol4 «Наносящие урон состояния наносят урон быстрее» → ailments
 *  - jewel.mod_j05iep «сила наносящих урон состояний при крит» → STAYS crit (critical tag wins)
 *
 * Also: cross-validation across all 477 family-groups must be 0 discrepancies
 * (ETL classifier and runtime classifier must agree).
 *
 * Run: npx tsx scripts/verify-iter94-fixes.ts
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

// iter 94 target tokens — 2 reclassified, 1 stays (to confirm tag priority order).
const EXPECTED_TOKEN_CATEGORIES: { file: string; id: string; expected: string; description: string }[] = [
  // iter 94: AILMENTS now wins over DAMAGE_TYPE for ailment-tagged mods.
  { file: 'jewel.json', id: 'jewel.mod_l1y0fl', expected: 'ailments', description: 'сила накладываемых состояний (damage,ailment tags) — iter 94: damage-type → ailments' },
  { file: 'jewel.json', id: 'jewel.mod_40sol4', expected: 'ailments', description: 'Наносящие урон состояния быстрее (damage,ailment tags) — iter 94: damage-type → ailments' },
  // iter 94: CRIT (step 14) still wins over AILMENTS (step 15) for crit-ailment mods.
  { file: 'jewel.json', id: 'jewel.mod_j05iep', expected: 'crit', description: 'сила состояний при крит (damage,critical,ailment tags) — iter 94: stays crit (critical tag wins)' },
];

function main() {
  console.log('=== iter 94 verification: AILMENTS tag-priority refactor ===\n');
  console.log('  Refactor: AILMENTS_PATTERN moved BEFORE DAMAGE_TYPE + added `ailment` tag check.\n');
  console.log('  Goal: reclassify ailment-tagged mods from damage-type to ailments, while keeping');
  console.log('  crit-ailment mods in crit (CRIT step 14 wins over AILMENTS step 15).\n');

  // Check 1: specific tokens
  let tokenChecksPass = true;
  console.log('--- Token-level checks (iter 94 targets) ---');
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
    console.log(`   tags: [${tok.tags.join(', ')}]`);
    console.log(`   actual: ${actual} | expected: ${check.expected}`);
    console.log(`   (${check.description})`);
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
    console.log('\n✅ iter 94 refactor verified: 2 mods reclassified (damage-type → ailments),');
    console.log('   1 mod stays as crit (tag-priority order confirmed), 0 cross-validation discrepancies.');
  } else {
    console.log('\n❌ Some checks failed.');
    process.exit(1);
  }
}

main();
