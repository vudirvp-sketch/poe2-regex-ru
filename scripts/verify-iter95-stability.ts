/**
 * iter 95 stability verification: confirm that the documentation cleanup +
 * deprecation-comment additions did NOT introduce any functional regression.
 *
 * iter 95 is a no-op semantically — only comments and documentation changed.
 * This script verifies:
 *   1. Cross-validation: ETL classifier vs Runtime classifier — 0 discrepancies
 *      across all 477 family-groups (4 jewellery categories).
 *   2. Strategy 0 coverage: every family-group has `functionalCategory` on its
 *      first member (i.e., Strategy 0 path is exercised, regex fallback is NOT
 *      reached in production).
 *   3. Other-bucket metrics unchanged vs iter 94:
 *      - jewel: 16/193 (8.3%)
 *      - amulet: 7/105 (6.7%)
 *      - ring: 3/94 (3.2%)
 *      - belt: 4/85 (4.7%)
 *
 * Run: npx tsx scripts/verify-iter95-stability.ts
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

/** Expected other-bucket metrics from iter 94 (unchanged in iter 95). */
const EXPECTED_OTHER_BUCKET: Record<string, { groups: number; other: number; pct: string }> = {
  jewel:  { groups: 193, other: 16, pct: '8.3%' },
  amulet: { groups: 105, other: 7,  pct: '6.7%' },
  ring:   { groups: 94,  other: 3,  pct: '3.2%' },
  belt:   { groups: 85,  other: 4,  pct: '4.7%' },
};

function main() {
  console.log('=== iter 95 stability verification ===\n');
  console.log('  iter 95 = documentation cleanup + deprecation comments only.');
  console.log('  Expected: 0 functional regressions vs iter 94.\n');

  // ─── Check 1: Cross-validation ETL vs Runtime ──────────────────────────
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
  console.log(`\nTotal: ${totalGroups} family-groups, ${discrepancies} discrepancies\n`);

  // ─── Check 2: Strategy 0 coverage ───────────────────────────────────────
  console.log('--- Strategy 0 coverage (every group has functionalCategory) ---');
  let strategy0Covered = 0;
  let strategy0Missed = 0;
  for (const cat of categories) {
    const filePath = path.join(OUTPUT_DIR, `${cat}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tokens: GameToken[] = data.tokens;
    const groups = buildFamilyGroups(tokens);
    for (const group of groups) {
      if (group.members[0].functionalCategory) {
        strategy0Covered++;
      } else {
        strategy0Missed++;
        console.log(`  [${cat}] NO functionalCategory: ${group.displayText.substring(0, 80)}`);
      }
    }
  }
  console.log(`\nStrategy 0 covered: ${strategy0Covered}/${strategy0Covered + strategy0Missed}\n`);

  // ─── Check 3: Other-bucket metrics ──────────────────────────────────────
  console.log('--- Other-bucket metrics (must match iter 94) ---');
  let metricsOk = true;
  for (const cat of categories) {
    const filePath = path.join(OUTPUT_DIR, `${cat}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const tokens: GameToken[] = data.tokens;
    const groups = buildFamilyGroups(tokens);
    const otherCount = groups.filter(g => classifyFunctionalBlock(g) === 'other').length;
    const expected = EXPECTED_OTHER_BUCKET[cat];
    const ok = groups.length === expected.groups && otherCount === expected.other;
    if (!ok) metricsOk = false;
    const actualPct = (otherCount / groups.length * 100).toFixed(1) + '%';
    console.log(`  ${ok ? '✓' : '❌'} ${cat}: groups=${groups.length} (expected ${expected.groups}), other=${otherCount} (expected ${expected.other}), pct=${actualPct} (expected ${expected.pct})`);
  }
  console.log();

  // ─── Final summary ──────────────────────────────────────────────────────
  console.log('=== Summary ===');
  console.log(`Cross-validation:    ${discrepancies === 0 ? '✅ PASS (0 discrepancies, 477/477 match)' : `❌ FAIL (${discrepancies} discrepancies)`}`);
  console.log(`Strategy 0 coverage: ${strategy0Missed === 0 ? `✅ PASS (${strategy0Covered}/${strategy0Covered + strategy0Missed})` : `❌ FAIL (${strategy0Missed} groups missing functionalCategory)`}`);
  console.log(`Other-bucket metrics:${metricsOk ? ' ✅ PASS (all categories match iter 94)' : ' ❌ FAIL (metrics drift)'}`);

  if (discrepancies === 0 && strategy0Missed === 0 && metricsOk) {
    console.log('\n✅ iter 95 stable: no functional regressions vs iter 94.');
    console.log('   Documentation cleanup + deprecation comments verified safe.');
  } else {
    console.log('\n❌ Some stability checks failed — iter 95 may have introduced a regression.');
    process.exit(1);
  }
}

main();
