/**
 * verify-iter89-deployment.ts — verify that the REAL classifyFunctionalBlock
 * (imported from src/shared/mod-classifier.ts, not a mirror) produces the
 * expected iter 89 other-bucket counts on jewel/amulet/ring/belt.
 *
 * This is the "deployment verification" — runs AFTER the patterns are live
 * in the source code. Catches any drift between simulation scripts and real
 * classifier.
 *
 * Run:  npx tsx scripts/verify-iter89-deployment.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyFunctionalBlock } from '../src/shared/mod-classifier.js';

interface JsonToken {
  id: string;
  category: string;
  origin: string;
  rawText: { ru: string };
  familyKey: { ru: string };
  affix: string;
  tags: string[];
}

interface FamilyGroup {
  text: string;
  tags: Set<string>;
  affix: string;
  familyKey: string;
  tokenCount: number;
  // Fields needed by classifyFunctionalBlock's FamilyGroup interface
  members: { tags: string[] }[];
  displayText: string;
}

function loadFamilyGroups(category: string): FamilyGroup[] {
  const path = join(process.cwd(), 'public/generated', `${category}.json`);
  const data = JSON.parse(readFileSync(path, 'utf-8')) as { tokens: JsonToken[] };

  const byKey = new Map<string, FamilyGroup>();
  for (const tok of data.tokens) {
    const key = `${tok.affix}::${tok.familyKey.ru}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        text: tok.rawText.ru,
        tags: new Set<string>(),
        affix: tok.affix,
        familyKey: tok.familyKey.ru,
        tokenCount: 0,
        members: [],
        displayText: tok.rawText.ru,
      });
    }
    const group = byKey.get(key)!;
    group.tokenCount++;
    group.members.push({ tags: tok.tags });
    for (const t of tok.tags) {
      // Note: real classifier skips Breach Lord tags internally — we just pass them through
      group.tags.add(t);
    }
  }
  return Array.from(byKey.values());
}

// ─── Main ───

const CATEGORIES = ['jewel', 'amulet', 'ring', 'belt'] as const;

console.log('=== iter 89 DEPLOYMENT VERIFICATION (real classifyFunctionalBlock) ===\n');
console.log('Category | Groups | other-bucket | %  | rage-charges | meta-skills | buff-skills');
console.log('---');

let allGood = true;
const expected: Record<string, { other: number; rageCharges: number; metaSkills: number; buffSkills: number; total: number }> = {
  jewel:  { other: 16, rageCharges: 4,  metaSkills: 1, buffSkills: 6,  total: 193 },
  amulet: { other: 7,  rageCharges: 0,  metaSkills: 1, buffSkills: 3,  total: 105 },
  ring:   { other: 3,  rageCharges: 0,  metaSkills: 1, buffSkills: 1,  total: 94 },
  belt:   { other: 4,  rageCharges: 0,  metaSkills: 3, buffSkills: 0,  total: 85 },
};

for (const cat of CATEGORIES) {
  let groups: FamilyGroup[];
  try {
    groups = loadFamilyGroups(cat);
  } catch {
    console.log(`${cat}: file not found, skipping`);
    continue;
  }

  const counts = new Map<string, number>();
  for (const g of groups) {
    const block = classifyFunctionalBlock(g as never);
    counts.set(block, (counts.get(block) ?? 0) + 1);
  }

  const other = counts.get('other') ?? 0;
  const rageCharges = counts.get('rage-charges') ?? 0;
  const metaSkills = counts.get('meta-skills') ?? 0;
  const buffSkills = counts.get('buff-skills') ?? 0;
  const pct = ((other / groups.length) * 100).toFixed(1);

  console.log(`${cat.padEnd(8)} | ${String(groups.length).padStart(6)} | ${String(other).padStart(12)} | ${pct.padStart(3)}% | ${String(rageCharges).padStart(12)} | ${String(metaSkills).padStart(11)} | ${String(buffSkills).padStart(11)}`);

  const exp = expected[cat];
  if (!exp) continue;
  const ok = other === exp.other && rageCharges === exp.rageCharges && metaSkills === exp.metaSkills && buffSkills === exp.buffSkills && groups.length === exp.total;
  if (!ok) {
    allGood = false;
    console.log(`  ⚠ MISMATCH: expected other=${exp.other}, rage-charges=${exp.rageCharges}, meta-skills=${exp.metaSkills}, buff-skills=${exp.buffSkills}, total=${exp.total}`);
  } else {
    console.log(`  ✓ matches expected counts`);
  }
}

console.log('\n' + (allGood ? '🎉 All categories match expected iter 89 counts.' : '⚠ Some counts do not match — investigate!'));
process.exit(allGood ? 0 : 1);
