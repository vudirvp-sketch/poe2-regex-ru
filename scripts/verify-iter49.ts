/**
 * iter 49 verification — Pitfall 11 fix (multi-LITERAL AND-in-OR + EXCLUDE).
 *
 * Verifies that the compiler transform now handles the shape produced when a
 * token has BOTH regexPrefixContext AND regexExclude (e.g., amulet minion mods).
 * The resulting regex should be a single quoted group (no nested quotes) when
 * placed inside an OR — confirming Pitfall 11 / Known Issue #4 is closed.
 *
 * Run: npx tsx scripts/verify-iter49.ts
 */
import { compile } from '../src/core/compiler.js';
import { matchPoE2Regex, matchPoE2RegexItem } from '../src/core/poe2-regex-matcher.js';
import { literal, and, or, exclude } from '../src/core/ast.js';

// ─── Test 1: Multi-LITERAL + EXCLUDE inside OR — was nested quotes, now single quoted group ───

const ast1 = or(
  and(
    literal('имеют'),                                       // regexPrefixContext
    literal('повышение шанса критического удара'),          // regex suffix
    exclude(literal('для'))                                 // regexExclude
  ),
  literal('перезарядки умений')
);

const regex1 = compile(ast1);
console.log('Test 1 — multi-LITERAL + EXCLUDE inside OR:');
console.log(`  regex: ${regex1}`);
console.log(`  has nested quotes: ${regex1.slice(1, -1).includes('"')}`);

const expected1 = '"^(?!.*для).*имеют.*повышение шанса критического удара|перезарядки умений"';
if (regex1 !== expected1) {
  console.error(`  ❌ FAIL: expected ${expected1}`);
  process.exit(1);
}
if (regex1.slice(1, -1).includes('"')) {
  console.error('  ❌ FAIL: nested quotes still present');
  process.exit(1);
}
console.log('  ✅ PASS — single quoted group, no nested quotes');
console.log();

// ─── Test 2: Semantic check — minion block matches, conflict block excluded ───

const minionBlock = 'Приспешники имеют (2—4)% повышение шанса критического удара';
const conflictBlock = 'Приспешники имеют (2—4)% повышение шанса критического удара для сотворения чар';
const secondAltBlock = '+(5—8)% к перезарядки умений';

console.log('Test 2 — semantic checks (simulator):');
console.log(`  minion block matches:        ${matchPoE2Regex(regex1, minionBlock)}`);
console.log(`  conflict block (has "для"):  ${matchPoE2Regex(regex1, conflictBlock)}`);
console.log(`  second-alt block matches:    ${matchPoE2Regex(regex1, secondAltBlock)}`);

if (matchPoE2Regex(regex1, minionBlock) !== true) {
  console.error('  ❌ FAIL: minion block should match');
  process.exit(1);
}
if (matchPoE2Regex(regex1, conflictBlock) !== false) {
  console.error('  ❌ FAIL: conflict block should NOT match (lookahead should fail)');
  process.exit(1);
}
if (matchPoE2Regex(regex1, secondAltBlock) !== true) {
  console.error('  ❌ FAIL: second-alt block should match (no ^ leak)');
  process.exit(1);
}
console.log('  ✅ PASS — all semantic checks');
console.log();

// ─── Test 3: Multiple excludes + multi-LITERAL ───

const ast3 = or(
  and(
    literal('имеют'),
    literal('повышение шанса критического удара'),
    exclude(or(literal('для'), literal('топорами')))
  ),
  literal('перезарядки умений')
);
const regex3 = compile(ast3);
console.log('Test 3 — multi-LITERAL + multi-EXCLUDE inside OR:');
console.log(`  regex: ${regex3}`);

const expected3 = '"^(?!.*для)(?!.*топорами).*имеют.*повышение шанса критического удара|перезарядки умений"';
if (regex3 !== expected3) {
  console.error(`  ❌ FAIL: expected ${expected3}`);
  process.exit(1);
}
console.log('  ✅ PASS — multiple lookaheads + multi-LITERAL merge');
console.log();

// ─── Test 4: Top-level AND (NOT inside OR) — should NOT transform ───

const ast4 = and(
  literal('имеют'),
  literal('повышение шанса критического удара'),
  exclude(literal('для'))
);
const regex4 = compile(ast4);
console.log('Test 4 — top-level AND (NOT inside OR) — should NOT transform:');
console.log(`  regex: ${regex4}`);
// Top-level AND compiles to "ctx" "regex" "!excl" — item-wide NOT
if (!regex4.includes('"имеют"') || !regex4.includes('"повышение шанса критического удара"') || !regex4.includes('"!для"')) {
  console.error('  ❌ FAIL: top-level AND should keep nested quotes (item-wide NOT semantic)');
  process.exit(1);
}
console.log('  ✅ PASS — top-level AND unchanged (boundary respected)');
console.log();

// ─── Test 5: Real-world scenario — amulet minioncrit token ───
// Simulates the actual data shape from amulet.minioncriticalstrikechancering1_breachborn:
//   regex: "повышение шанса критического удара"
//   regexPrefixContext: "имеют"
//   regexExclude: ["для"]

console.log('Test 5 — real-world amulet minioncrit scenario:');
console.log(`  minion block: "${minionBlock}"`);
console.log(`  conflict block (for "для"): "${conflictBlock}"`);

// User selects minioncrit token (with context+exclude) + a different amulet mod in OR mode
const ast5 = or(
  and(
    literal('имеют'),
    literal('повышение шанса критического удара'),
    exclude(literal('для'))
  ),
  literal('сотворения чар')
);
const regex5 = compile(ast5);
console.log(`  compiled regex: ${regex5}`);
console.log(`  length: ${regex5.length} chars`);

if (regex5.length > 250) {
  console.error(`  ❌ FAIL: regex exceeds 250 chars (PoE2 hard limit)`);
  process.exit(1);
}
console.log('  ✅ PASS — within PoE2 char limit');
console.log();

// ─── Summary ───
console.log('═══════════════════════════════════════════════════════════');
console.log('iter 49 verification: ALL TESTS PASS');
console.log('Pitfall 11 / Known Issue #4: CLOSED');
console.log('  - Multi-LITERAL AND + EXCLUDE inside OR → single quoted group');
console.log('  - No nested quotes (was the bug)');
console.log('  - Semantic checks: minion match, exclude enforced, no ^ leak');
console.log('  - Top-level AND unchanged (boundary respected)');
console.log('  - Real-world amulet minioncrit scenario within 250 char limit');
console.log('═══════════════════════════════════════════════════════════');
