/**
 * Corrected iter 108 audit — fixes false-positive B0/NESTED flags on
 * valid top-level AND syntax (`"X" "Y"` = cross-block AND, NOT B0).
 *
 * Documentation rules (re-confirmed):
 *   B0: top-level `|` between two quoted groups  →  `"X"|"Y"`  ❌ zero matches
 *   NESTED: `"X" "Y"` pattern INSIDE outer OR-quoted group (i.e. nested)
 *   LIMIT: total length > 250 chars
 *   EMPTY: empty regex
 *
 * The corrected NESTED check:
 *   - A regex is NESTED iff it starts AND ends with `"` AND contains an inner
 *     `"..." "..."` pair (meaning we're inside an outer OR-quote and have
 *     quoted groups nested within it).
 *   - A regex like `"X" "Y" "Z"` at top level is NOT nested — it's valid
 *     top-level AND. We distinguish by checking: does the regex start with `"`
 *     AND end with `"` AND contain an inner `"`? If so, the FIRST outer quote
 *     ends at the first inner `"`, and the LAST outer quote starts at the last
 *     inner `"` — so the content in between is "inside" the outer OR-quote.
 *     But this only applies if there's actually a `|` somewhere inside the outer
 *     OR-quote (otherwise it's just a single quoted group).
 *
 * Simpler & correct logic:
 *   - B0: regex contains `|"..."` or `..."|"` (top-level | directly adjacent to
 *     a quoted group, i.e. between two quoted groups). Specifically: a `|` that
 *     is OUTSIDE any quoted group, AND has a `"` immediately to its left or
 *     right (after stripping spaces).
 *   - NESTED: regex matches pattern `^".*"[^"]*".*"$` — i.e. starts with `"`
 *     and ends with `"` but has at least one more `"` in between. This means
 *     we have an outer quote pair with an inner quote pair — nested.
 *     EXCEPTION: top-level AND `"X" "Y" "Z"` also has this structure — but it
 *     doesn't have a `|` inside the outer quote pair. So we need to additionally
 *     check that the "outer" pair has a `|` inside it.
 *
 *   Final correct NESTED check:
 *     Regex starts with `"`, ends with `"`.
 *     The content between first `"` and last `"` contains BOTH a `|` AND an
 *     inner `"` (i.e. an inner quoted group).
 *     This means the structure is: `"outer...|..."inner"...|outer..."` — nested.
 *
 * Let me also be more careful about what's "top-level `|` between quoted groups":
 *   The pattern `"X"|"Y"` has: outer-level alternation where each alt is a
 *   quoted group. In our compiled regex format, the OUTER quote is always
 *   present (compile wraps result in `"..."`), so `"X"|"Y"` would actually
 *   be `"\"X\"|\"Y\""` if it ever occurred — i.e. the outer quote wraps the
 *   whole thing, and inside we have `"X"|"Y"` (inner quotes around X and Y).
 *
 *   So in compiled regex string:
 *   - Valid top-level OR: `"a|b|c"` (single pair of outer quotes, `|` between bare alts)
 *   - Valid top-level AND: `"a" "b" "c"` (multiple quoted groups, space-separated)
 *   - Valid top-level AND-of-OR: `"a|b" "c|d"` (multiple quoted groups with `|` inside each)
 *   - INVALID B0: `"\"X\"|\"Y\""` — outer quote wraps inner `"X"|"Y"`
 *
 *   In compiled regex string, B0 looks like: `""X"|"Y""` — i.e. starts with `""` (two quotes), has `|` between inner quoted groups, ends with `""`.
 *   Or: `"abc"def"ghi"` — three quoted groups where the outer wraps them.
 *
 *   Actually the original bug iter 108 fixed was: `"..."провал," "вплоть"|..."` — meaning inside the outer quoted group (delimited by the outer `"`), there were INNER quoted groups `"провал,"` and `"вплоть"` joined by space. This is NESTED.
 *
 *   And B0 is `"X"|"Y"` at top level — but as we just saw, top-level B0 is wrapped in outer quotes, so it becomes `""X"|"Y""` (looks like two empty quoted groups at the start/end).
 *
 * OK let me use a cleaner detector:
 *   - NESTED (iter 108 bug signature): regex starts with `"` and ends with `"`, and BETWEEN them contains at least one `"` AND at least one `|`.
 *   - B0: regex contains `"` `|` `"` (with optional spaces) — i.e. a `|` directly between two quoted groups. This can occur at top level or nested.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../src/core/compiler';
import type { ASTNode } from '../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const GEN_DIR = path.join(ROOT, 'public', 'generated');

interface Token {
  id: string;
  regex: { ru?: string } | Record<string, unknown>;
  regexPrefixContext?: { ru?: string } | Record<string, unknown>;
  regexExclude?: { ru?: string[] } | Record<string, unknown>;
  familyKey?: { ru?: string } | Record<string, unknown>;
  [k: string]: unknown;
}

function buildLiteralNodeRu(token: Token): ASTNode {
  const regex = (token.regex as { ru?: string }).ru ?? '';
  const baseLiteral: ASTNode = { type: 'LITERAL', value: regex, tokenId: token.id };
  const prefixContext = (token.regexPrefixContext as { ru?: string } | undefined)?.ru;
  const contextNode: ASTNode = prefixContext
    ? { type: 'AND', children: [{ type: 'LITERAL', value: prefixContext }, baseLiteral] }
    : baseLiteral;
  const excludes = (token.regexExclude as { ru?: string[] } | undefined)?.ru ?? [];
  if (excludes.length > 0) {
    if (excludes.length === 1) {
      return { type: 'AND', children: [contextNode, { type: 'EXCLUDE', child: { type: 'LITERAL', value: excludes[0] } }] };
    } else {
      const excludeOrNode: ASTNode = {
        type: 'EXCLUDE',
        child: { type: 'OR', children: excludes.map(p => ({ type: 'LITERAL', value: p })) },
      };
      return { type: 'AND', children: [contextNode, excludeOrNode] };
    }
  }
  return contextNode;
}

interface Violation {
  rule: 'B0' | 'NESTED' | 'LIMIT' | 'EMPTY_REGEX';
  detail: string;
}

function checkRegex(regex: string): Violation[] {
  const violations: Violation[] = [];
  if (!regex || regex === '""') {
    violations.push({ rule: 'EMPTY_REGEX', detail: 'Empty regex' });
    return violations;
  }

  // NESTED + B0 — both are the same root cause: a `|` adjacent to a `"` in the
  // compiled regex string. This is the iter 108 bug signature.
  //
  // Why this works:
  // - Valid top-level OR: `"a|b|c"` — `|` always followed by a non-`"` char.
  // - Valid top-level AND: `"a" "b" "c"` — no `|` outside quotes.
  // - Valid top-level AND-of-OR: `"a|b" "c|d"` — `|` always inside a quoted group, followed by non-`"`.
  // - INVALID iter 108 NESTED: `"a|"x" "y"|c"` — contains `|"` (between `a|` and `"x"`).
  // - INVALID B0: `""X"|"Y""` — contains `|"` (between `|"Y"`).
  //
  // Detect: `|"` (pipe immediately followed by quote) anywhere in the regex.
  // This single check catches both B0 and NESTED patterns.
  if (regex.includes('|"')) {
    // Find first occurrence for the detail message
    const idx = regex.indexOf('|"');
    const ctx = regex.slice(Math.max(0, idx - 30), Math.min(regex.length, idx + 50));
    violations.push({
      rule: 'NESTED',
      detail: `Pipe adjacent to quote (iter 108 bug signature): ...${ctx}...`,
    });
  }

  // LIMIT
  if (regex.length > 250) {
    violations.push({
      rule: 'LIMIT',
      detail: `Regex length ${regex.length} exceeds 250-char PoE2 limit`,
    });
  }

  return violations;
}

// ─── Main ───────────────────────────────────────────────────────────────────
const files = fs.readdirSync(GEN_DIR).filter(f => f.endsWith('.json')).sort();

console.log('=== iter 108 CORRECTED audit (B0/NESTED false-positives fixed) ===\n');

let grandTotalTokens = 0;
let grandTotalOptEntries = 0;
let t1Violations = 0;
let t2Violations = 0;
let t3Violations = 0;
let t4Violations = 0;
let b0Count = 0;
let nestedCount = 0;
let emptyCount = 0;
const criticalCases: string[] = [];
const limitCases: string[] = [];

for (const f of files) {
  const filePath = path.join(GEN_DIR, f);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { tokens: Token[]; optimizationTable: Record<string, { regex: { ru?: string } }> };
  const tokens = data.tokens || [];
  const optTable = data.optimizationTable || {};
  grandTotalTokens += tokens.length;
  grandTotalOptEntries += Object.keys(optTable).length;

  // T1: each token alone in 2-element OR
  let t1v = 0;
  for (const t of tokens) {
    const node = buildLiteralNodeRu(t);
    const orNode: ASTNode = { type: 'OR', children: [node, { type: 'LITERAL', value: 'zzz_dummy_alt' }] };
    const regex = compile(orNode, { locale: 'ru' });
    const v = checkRegex(regex);
    if (v.length > 0) {
      t1v++;
      t1Violations++;
      for (const vv of v) {
        if (vv.rule === 'B0') { b0Count++; criticalCases.push(`T1/${f}/${t.id}: ${vv.detail} | regex: ${regex.slice(0, 100)}`); }
        if (vv.rule === 'NESTED') { nestedCount++; criticalCases.push(`T1/${f}/${t.id}: ${vv.detail} | regex: ${regex.slice(0, 100)}`); }
        if (vv.rule === 'EMPTY_REGEX') emptyCount++;
        if (vv.rule === 'LIMIT') limitCases.push(`T1/${f}/${t.id}: ${vv.detail}`);
      }
    }
  }

  // T2: ALL tokens of category in OR
  let t2v = 0;
  if (tokens.length >= 2) {
    const orChildren = tokens.map(buildLiteralNodeRu);
    const regex = compile({ type: 'OR', children: orChildren }, { locale: 'ru' });
    const v = checkRegex(regex);
    if (v.length > 0) {
      t2v = v.length;
      t2Violations += v.length;
      for (const vv of v) {
        if (vv.rule === 'B0') { b0Count++; criticalCases.push(`T2/${f}: ${vv.detail} | regex: ${regex.slice(0, 200)}`); }
        if (vv.rule === 'NESTED') { nestedCount++; criticalCases.push(`T2/${f}: ${vv.detail} | regex: ${regex.slice(0, 200)}`); }
        if (vv.rule === 'LIMIT') limitCases.push(`T2/${f}: ${vv.detail}`);
      }
    }
  }

  // T3: opt-table regexes
  let t3v = 0;
  for (const [key, entry] of Object.entries(optTable)) {
    const r = entry.regex?.ru ?? '';
    if (!r) continue;
    const v = checkRegex(`"${r}"`);
    if (v.length > 0) {
      t3v++;
      t3Violations++;
      for (const vv of v) {
        if (vv.rule === 'B0') { b0Count++; criticalCases.push(`T3/${f}/${key.slice(0, 50)}: ${vv.detail} | regex: ${r.slice(0, 200)}`); }
        if (vv.rule === 'NESTED') { nestedCount++; criticalCases.push(`T3/${f}/${key.slice(0, 50)}: ${vv.detail} | regex: ${r.slice(0, 200)}`); }
        if (vv.rule === 'LIMIT') limitCases.push(`T3/${f}/${key.slice(0, 50)}: ${vv.detail}`);
      }
    }
  }

  // T4: family-AND all
  let t4v = 0;
  const familyGroups = new Map<string, Token[]>();
  for (const t of tokens) {
    const fam = (t.familyKey as { ru?: string } | undefined)?.ru ?? t.id;
    if (!familyGroups.has(fam)) familyGroups.set(fam, []);
    familyGroups.get(fam)!.push(t);
  }
  if (familyGroups.size >= 2) {
    const andChildren: ASTNode[] = [];
    for (const [, famTokens] of familyGroups) {
      if (famTokens.length === 1) {
        andChildren.push(buildLiteralNodeRu(famTokens[0]));
      } else {
        andChildren.push({ type: 'OR', children: famTokens.map(buildLiteralNodeRu) });
      }
    }
    const regex = compile({ type: 'AND', children: andChildren }, { locale: 'ru' });
    const v = checkRegex(regex);
    if (v.length > 0) {
      t4v = v.length;
      t4Violations += v.length;
      for (const vv of v) {
        if (vv.rule === 'B0') { b0Count++; criticalCases.push(`T4/${f}: ${vv.detail} | regex: ${regex.slice(0, 200)}`); }
        if (vv.rule === 'NESTED') { nestedCount++; criticalCases.push(`T4/${f}: ${vv.detail} | regex: ${regex.slice(0, 200)}`); }
        if (vv.rule === 'LIMIT') limitCases.push(`T4/${f}: ${vv.detail}`);
      }
    }
  }

  console.log(`── ${f} ───────────────────────────────`);
  console.log(`  tokens: ${tokens.length} | opt-entries: ${Object.keys(optTable).length} | families: ${familyGroups.size}`);
  console.log(`  T1 (single-token OR): ${t1v} critical violations`);
  console.log(`  T2 (all-tokens OR):   ${t2v} violations (LIMIT-only expected)`);
  console.log(`  T3 (opt-table regex): ${t3v} violations`);
  console.log(`  T4 (family-AND all):  ${t4v} violations (LIMIT-only expected)`);
  console.log();
}

console.log('═══ CORRECTED AUDIT SUMMARY ═══════════════════════════');
console.log(`Categories scanned: ${files.length}`);
console.log(`Total tokens: ${grandTotalTokens}`);
console.log(`Total opt-table entries: ${grandTotalOptEntries}`);
console.log('');
console.log('Per-test violation counts:');
console.log(`  T1 single-token OR:  ${t1Violations}`);
console.log(`  T2 all-tokens OR:    ${t2Violations}`);
console.log(`  T3 opt-table regex:  ${t3Violations}`);
console.log(`  T4 family-AND all:   ${t4Violations}`);
console.log('');
console.log('Per-rule violation counts:');
console.log(`  B0 (top-level | between quoted groups → zero matches): ${b0Count}`);
console.log(`  NESTED (nested quotes inside outer OR-quote → zero matches): ${nestedCount}`);
console.log(`  EMPTY_REGEX: ${emptyCount}`);
console.log(`  LIMIT (>250 chars, runtime-split handled): ${limitCases.length}`);
console.log('');

if (criticalCases.length > 0) {
  console.log('═══ CRITICAL CASES (B0/NESTED) ─══════════════════════════');
  for (const c of criticalCases) {
    console.log(`  • ${c}`);
  }
  console.log('');
}

const criticalCount = b0Count + nestedCount + emptyCount;
if (criticalCount === 0) {
  console.log('✓ NO CRITICAL VIOLATIONS (B0/NESTED/EMPTY) — iter 108 fix is GLOBALLY effective.');
  console.log('  LIMIT violations are inherent to large selections and are handled at runtime by splitOverLimitRegex.');
} else {
  console.log(`✗ ${criticalCount} CRITICAL VIOLATIONS found — see details above.`);
}
