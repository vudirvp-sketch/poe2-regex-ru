/**
 * Iterative Regex Optimizer — Phase 5
 *
 * Reads generated JSON files, iteratively optimizes regexes using
 * multiple strategies, validates via Oracle, and writes back improved
 * regexes. Converges when no further improvements are possible.
 *
 * Optimization strategies:
 *   1. Dialect optimization ([её], [юя], ь?)
 *   2. Cross-family DP factorization (find better optimization entries)
 *   3. Suffix shortening (trim unique suffixes from left)
 *   4. FN repair (fix false negatives by broadening regex)
 *   5. FP reduction (fix false positives by narrowing regex)
 *
 * Usage:
 *   npx tsx scripts/etl/iterative-optimizer.ts [--max-iterations N] [--dry-run] [--verbose]
 *
 * Flags:
 *   --max-iterations N   Maximum optimization iterations (default 10)
 *   --dry-run            Don't write files, just report
 *   --verbose            Print detailed per-token changes
 */
import { matchQuotedGroup } from '../../src/core/poe2-regex-matcher.js';
import { batchDPFactorize, applyDialectOptimizations } from '../../src/core/dp-factorizer.js';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───

interface JsonToken {
  id: string;
  category: string;
  rawText: { ru: string };
  rawTextTemplate: { ru: string };
  regex: { ru: string };
  familyKey: { ru: string };
  regexPrefix: { ru: string };
  hasMultiPlaceholder: boolean;
}

interface JsonData {
  version: string;
  category: string;
  source: string;
  tokens: JsonToken[];
  optimizationTable: Record<string, { ids: string[]; regex: { ru: string }; weight: number; count: number }>;
}

interface OptimizationChange {
  tokenId: string;
  category: string;
  oldRegex: string;
  newRegex: string;
  strategy: string;
  fnBefore: boolean;
  fnAfter: boolean;
  fpBefore: number;
  fpAfter: number;
}

interface IterationResult {
  iteration: number;
  changes: OptimizationChange[];
  totalFN: number;
  totalFP: number;
  totalRegexLen: number;
}

// ─── Config ───

const GENERATED_DIR = path.resolve(process.cwd(), 'public', 'generated');
const MAX_ITERATIONS = parseInt(process.argv.find(a => a === '--max-iterations') ?
  process.argv[process.argv.indexOf('--max-iterations') + 1] : '10', 10);
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// ─── Core Logic ───

/**
 * Count FP for a regex: how many OTHER tokens' rawText match this regex.
 */
function countFP(regex: string, tokenId: string, allTokens: JsonToken[]): number {
  let fp = 0;
  for (const t of allTokens) {
    if (t.id === tokenId) continue;
    if (matchQuotedGroup(regex, t.rawText.ru.toLowerCase())) {
      fp++;
    }
  }
  return fp;
}

/**
 * Check if a regex produces FN (doesn't match its own rawText).
 */
function hasFN(regex: string, rawText: string): boolean {
  return !matchQuotedGroup(regex, rawText.toLowerCase());
}

/**
 * Try to shorten a regex by trimming words from the left while keeping it unique.
 * Returns the shortest regex that still matches rawText and has <= maxFP false positives.
 */
/**
 * Try to shorten a regex by trimming words from the left while keeping it unique.
 * Returns the shortest regex that still matches rawText and has <= maxFP false positives.
 */
/** Per-category minimum regex length for suffix-shortening.
 * Must not shorten below this limit to pass cross-validation tests.
 */
const MIN_REGEX_LEN_BY_CATEGORY: Record<string, number> = {
  'waystone': 5,
  'waystone-desecrated': 5,
  'tablet': 5,
  'jewel-desecrated': 5,
};
const MIN_REGEX_LEN_DEFAULT = 3;

function trySuffixShortening(
  currentRegex: string,
  rawText: string,
  allTokens: JsonToken[],
  tokenId: string,
  maxFP: number
): string | null {
  const lowerRaw = rawText.toLowerCase();
  const lowerRegex = currentRegex.toLowerCase();
  const idx = lowerRaw.indexOf(lowerRegex);
  if (idx === -1) return null;

  // Find the category for this token to determine min regex length
  const token = allTokens.find(t => t.id === tokenId);
  const category = token?.category ?? '';
  const minLen = MIN_REGEX_LEN_BY_CATEGORY[category] ?? MIN_REGEX_LEN_DEFAULT;

  const words = currentRegex.split(/\s+/);
  if (words.length <= 1) return null;

  for (let skipWords = 1; skipWords < words.length; skipWords++) {
    const candidate = words.slice(skipWords).join(' ');
    if (candidate.length < minLen) break;

    if (!matchQuotedGroup(candidate, rawText.toLowerCase())) continue;

    const fp = countFP(candidate, tokenId, allTokens);
    if (fp <= maxFP) {
      return candidate;
    }
  }

  return null;
}

/**
 * Try to fix FN by broadening the regex.
 * Strategy: find the shortest substring of rawText that matches via PoE2 engine
 * and is unique within the category (or at least matches rawText).
 */
function tryFixFN(
  currentRegex: string,
  rawText: string,
  rawTextTemplate: string,
  allTokens: JsonToken[],
  tokenId: string
): string | null {
  if (!hasFN(currentRegex, rawText)) return null;

  // Strategy 1: Try template suffix
  const suffix = extractTemplateSuffix(rawTextTemplate);
  if (suffix && suffix.length >= 3 && matchQuotedGroup(suffix, rawText.toLowerCase())) {
    return suffix;
  }

  // Strategy 2: Find any substring that matches via PoE2 engine
  const lowerRaw = rawText.toLowerCase();
  for (let len = 5; len <= lowerRaw.length; len++) {
    for (let start = 0; start <= lowerRaw.length - len; start++) {
      const candidate = lowerRaw.substring(start, start + len);

      // Skip candidates with `()` — PoE2 grouping
      if (candidate.includes('(') || candidate.includes(')')) continue;
      // Skip pure digit substrings
      if (/^\d+$/.test(candidate.trim())) continue;

      if (matchQuotedGroup(candidate, rawText.toLowerCase())) {
        // Check uniqueness — prefer candidates that are unique
        const fp = countFP(candidate, tokenId, allTokens);
        if (fp <= 5) {  // Allow some FP for FN fix
          return candidate;
        }
      }
    }
  }

  // Strategy 3: Broad match — just use a distinctive substring even if not unique
  // Find the longest word in the rawText
  const words = lowerRaw.split(/\s+/).filter(w => w.length >= 3 && !/^\d+$/.test(w));
  for (const word of words) {
    if (matchQuotedGroup(word, rawText.toLowerCase())) {
      return word;
    }
  }

  return null;
}

/**
 * Try to reduce FP by lengthening the regex.
 * Strategy: extend the regex with adjacent words from rawText.
 */
function tryReduceFP(
  currentRegex: string,
  rawText: string,
  allTokens: JsonToken[],
  tokenId: string
): string | null {
  const currentFP = countFP(currentRegex, tokenId, allTokens);
  if (currentFP === 0) return null;

  const lowerRaw = rawText.toLowerCase();
  const lowerRegex = currentRegex.toLowerCase();

  // Find the regex position in rawText
  const idx = lowerRaw.indexOf(lowerRegex);
  if (idx === -1) return null;

  // Try extending left
  for (let extend = 1; extend <= 20 && idx - extend >= 0; extend++) {
    const candidate = lowerRaw.substring(idx - extend, idx + lowerRegex.length);
    if (candidate.length > 50) break;  // Don't make regex too long
    if (!matchQuotedGroup(candidate, rawText.toLowerCase())) continue;

    const newFP = countFP(candidate, tokenId, allTokens);
    if (newFP < currentFP) {
      return candidate;
    }
  }

  // Try extending right
  for (let extend = 1; extend <= 20 && idx + lowerRegex.length + extend <= lowerRaw.length; extend++) {
    const candidate = lowerRaw.substring(idx, idx + lowerRegex.length + extend);
    if (candidate.length > 50) break;
    if (!matchQuotedGroup(candidate, rawText.toLowerCase())) continue;

    const newFP = countFP(candidate, tokenId, allTokens);
    if (newFP < currentFP) {
      return candidate;
    }
  }

  return null;
}

/**
 * Try dialect optimization on a single regex.
 * Applies [её], [юя], ь? and checks if it still matches rawText.
 */
function tryDialectOptimization(
  currentRegex: string,
  rawText: string
): string | null {
  const optimized = applyDialectOptimizations(currentRegex);
  if (optimized === currentRegex) return null;

  // Verify the optimized regex still matches rawText
  if (!matchQuotedGroup(optimized, rawText.toLowerCase())) return null;

  return optimized;
}

/**
 * Extract the "text suffix" from a rawTextTemplate.
 * Same logic as compute-regex.ts.
 */
function extractTemplateSuffix(template: string): string {
  let lastHashIdx = template.lastIndexOf('##');
  if (lastHashIdx !== -1) {
    lastHashIdx += 1;
  } else {
    lastHashIdx = template.lastIndexOf('#');
  }
  if (lastHashIdx === -1) return '';

  let suffix = template.substring(lastHashIdx + 1);
  suffix = suffix.replace(/^[^a-zA-Zа-яА-ЯёЁ]*/, '');
  return suffix.trim();
}

/**
 * Run one optimization iteration over all categories.
 * Returns changes made and aggregate stats.
 */
function runIteration(
  jsonData: Map<string, JsonData>,
  iteration: number
): IterationResult {
  const changes: OptimizationChange[] = [];
  let totalFN = 0;
  let totalFP = 0;
  let totalRegexLen = 0;

  for (const [category, data] of jsonData) {
    const tokens = data.tokens;

    // Compute current FN/FP for this category
    let catFN = 0;
    let catFP = 0;

    for (const token of tokens) {
      const regex = token.regex.ru;
      const rawText = token.rawText.ru;
      if (!regex || !rawText) continue;

      // Skip regexes with number patterns (Oracle can't validate them alone)
      if (regex.includes('.*') || regex.includes('[0-9]') || regex.includes('[1-9]')) {
        totalRegexLen += regex.length;
        continue;
      }

      const isFN = hasFN(regex, rawText);
      if (isFN) catFN++;

      const fp = countFP(regex, token.id, tokens);
      catFP += fp;

      totalRegexLen += regex.length;

      // ─── Strategy 1: Fix FN first (highest priority) ───
      if (isFN) {
        const fixed = tryFixFN(regex, rawText, token.rawTextTemplate.ru, tokens, token.id);
        if (fixed && fixed !== regex) {
          const fpAfter = countFP(fixed, token.id, tokens);
          changes.push({
            tokenId: token.id,
            category,
            oldRegex: regex,
            newRegex: fixed,
            strategy: 'fn-repair',
            fnBefore: true,
            fnAfter: hasFN(fixed, rawText),
            fpBefore: fp,
            fpAfter,
          });

          if (!DRY_RUN) {
            token.regex.ru = fixed;
          }
          continue;
        }
      }

      // ─── Strategy 2: Dialect optimization ───
      const dialectOpt = tryDialectOptimization(regex, rawText);
      if (dialectOpt) {
        const fpAfter = countFP(dialectOpt, token.id, tokens);
        changes.push({
          tokenId: token.id,
          category,
          oldRegex: regex,
          newRegex: dialectOpt,
          strategy: 'dialect',
          fnBefore: isFN,
          fnAfter: hasFN(dialectOpt, rawText),
          fpBefore: fp,
          fpAfter,
        });

        if (!DRY_RUN) {
          token.regex.ru = dialectOpt;
        }
        continue;
      }

      // ─── Strategy 3: Reduce FP by lengthening ───
      // Only for tokens with significant FP (>2) to avoid making regexes longer
      // for minor FP improvements
      if (fp > 2 && !isFN) {
        const reduced = tryReduceFP(regex, rawText, tokens, token.id);
        if (reduced) {
          const fpAfter = countFP(reduced, token.id, tokens);
          changes.push({
            tokenId: token.id,
            category,
            oldRegex: regex,
            newRegex: reduced,
            strategy: 'fp-reduce',
            fnBefore: false,
            fnAfter: hasFN(reduced, rawText),
            fpBefore: fp,
            fpAfter,
          });

          if (!DRY_RUN) {
            token.regex.ru = reduced;
          }
        }
      }

      // ─── Strategy 4: Suffix shortening ───
      // For regexes without FN or FP, try to shorten by trimming words from left
      if (!isFN && fp === 0) {
        const shortened = trySuffixShortening(regex, rawText, tokens, token.id, 0);
        if (shortened && shortened.length < regex.length) {
          changes.push({
            tokenId: token.id,
            category,
            oldRegex: regex,
            newRegex: shortened,
            strategy: 'suffix-shorten',
            fnBefore: false,
            fnAfter: false,
            fpBefore: 0,
            fpAfter: 0,
          });

          if (!DRY_RUN) {
            token.regex.ru = shortened;
          }
        }
      }
    }

    totalFN += catFN;
    totalFP += catFP;
  }

  return { iteration, changes, totalFN, totalFP, totalRegexLen };
}

/**
 * Re-optimize the optimization table after individual regex changes.
 * Uses DP factorization to find better cross-family optimizations.
 */
function reoptimizeTable(data: JsonData): number {
  const tokens = data.tokens;
  const table = data.optimizationTable;

  // Collect all unique regexes
  const regexToIds = new Map<string, string[]>();
  for (const token of tokens) {
    const regex = token.regex.ru;
    if (!regex) continue;
    if (!regexToIds.has(regex)) regexToIds.set(regex, []);
    regexToIds.get(regex)!.push(token.id);
  }

  const allRegexes = [...regexToIds.keys()];
  if (allRegexes.length < 2) return 0;

  // Run batch DP factorization
  const dpEntries = batchDPFactorize(allRegexes);
  let improvements = 0;

  for (const entry of dpEntries) {
    const involvedIds: string[] = [];
    for (const word of entry.words) {
      const ids = regexToIds.get(word);
      if (ids) involvedIds.push(...ids);
    }

    if (involvedIds.length < 2) continue;

    const ids = [...new Set(involvedIds)].sort();
    const key = ids.join(':');

    // Check if this is a new or improved optimization
    const existing = table[key];
    const newRegex = applyDialectOptimizations(entry.result.regex);

    if (!existing || newRegex.length < existing.regex.ru.length) {
      table[key] = {
        ids,
        regex: { ru: newRegex },
        weight: newRegex.length,
        count: ids.length,
      };
      improvements++;
    }
  }

  return improvements;
}

// ─── Main ───

function main() {
  console.log('=== PoE2 Regex RU — Iterative Optimizer (Phase 5) ===\n');
  console.log(`Max iterations: ${MAX_ITERATIONS}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Verbose: ${VERBOSE}\n`);

  // Load all generated JSON files
  if (!fs.existsSync(GENERATED_DIR)) {
    console.error(`ERROR: ${GENERATED_DIR} not found. Run ETL first.`);
    process.exit(1);
  }

  const jsonFiles = fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${jsonFiles.length} category files\n`);

  const jsonData = new Map<string, JsonData>();
  for (const file of jsonFiles) {
    const filePath = path.join(GENERATED_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: JsonData = JSON.parse(raw);
    jsonData.set(data.category, data);
    console.log(`  Loaded: ${data.category} (${data.tokens.length} tokens)`);
  }

  // ─── Iterative optimization loop ───
  let prevResult: IterationResult | null = null;

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    console.log(`\n--- Iteration ${iter} ---`);

    const result = runIteration(jsonData, iter);

    console.log(`  Changes: ${result.changes.length}`);
    console.log(`  FN: ${result.totalFN}, FP: ${result.totalFP}, Total regex len: ${result.totalRegexLen}`);

    if (VERBOSE && result.changes.length > 0) {
      for (const change of result.changes) {
        console.log(`    [${change.strategy}] ${change.tokenId}: "${change.oldRegex}" → "${change.newRegex}" (FP: ${change.fpBefore}→${change.fpAfter})`);
      }
    }

    // Re-optimize optimization tables
    if (!DRY_RUN) {
      let totalTableImprovements = 0;
      for (const [, data] of jsonData) {
        const improvements = reoptimizeTable(data);
        totalTableImprovements += improvements;
      }
      if (totalTableImprovements > 0) {
        console.log(`  Optimization table improvements: ${totalTableImprovements}`);
      }
    }

    // Check convergence: no changes or same FN/FP as before
    if (result.changes.length === 0) {
      console.log('\n  Converged: no changes in this iteration.');
      break;
    }

    if (prevResult &&
        prevResult.totalFN === result.totalFN &&
        prevResult.totalFP === result.totalFP) {
      console.log('\n  Converged: FN/FP unchanged from previous iteration.');
      break;
    }

    prevResult = result;
  }

  // ─── Write results ───
  if (!DRY_RUN) {
    console.log('\n--- Writing optimized files ---');
    for (const [category, data] of jsonData) {
      const fileName = `${category}.json`;
      const filePath = path.join(GENERATED_DIR, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      console.log(`  Written: ${fileName}`);
    }
  }

  // ─── Final summary ───
  console.log('\n=== Final Summary ===');

  let grandFN = 0;
  let grandFP = 0;
  let grandTokens = 0;
  let grandRegexLen = 0;

  for (const [catName, data] of jsonData) {
    const tokens = data.tokens;
    let catFN = 0;
    let catFP = 0;
    let catLen = 0;

    for (const token of tokens) {
      const regex = token.regex.ru;
      const rawText = token.rawText.ru;
      if (!regex || !rawText) continue;

      if (regex.includes('.*') || regex.includes('[0-9]') || regex.includes('[1-9]')) {
        catLen += regex.length;
        continue;
      }

      if (hasFN(regex, rawText)) catFN++;
      catFP += countFP(regex, token.id, tokens);
      catLen += regex.length;
    }

    grandFN += catFN;
    grandFP += catFP;
    grandTokens += tokens.length;
    grandRegexLen += catLen;

    console.log(`  ${catName}: ${tokens.length} tokens, FN=${catFN}, FP=${catFP}, avgLen=${(catLen / tokens.length).toFixed(1)}`);
  }

  console.log(`\n  TOTAL: ${grandTokens} tokens, FN=${grandFN}, FP=${grandFP}, avgLen=${(grandRegexLen / grandTokens).toFixed(1)}`);

  if (DRY_RUN) {
    console.log('\n  (Dry run — no files were modified)');
  }
}

main();
