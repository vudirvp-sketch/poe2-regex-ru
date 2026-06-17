/**
 * Iterative Regex Optimizer — Phase 5 (integrated into ETL pipeline)
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
 *   6. Short-regex context (add regexPrefixContext for regexes < MIN_REGEX_LEN)
 *   7. Budget-aware shortening (prefer shorter regexes when near 250-char limit)
 *
 * Oracle validation:
 *   After each iteration, ALL changed regexes are validated using the
 *   block-based Oracle (matchPoE2RegexItem). Changes that introduce
 *   cross-family FP or FN are automatically reverted.
 *
 * Usage:
 *   npx tsx scripts/etl/iterative-optimizer.ts [--max-iterations N] [--dry-run] [--verbose]
 *   OR called from run-etl.ts as Step 10
 */
import { matchQuotedGroup, matchPoE2RegexItem, getItemSearchBlocks } from '../../src/core/poe2-regex-matcher.js';
import { batchDPFactorize, applyDialectOptimizations } from '../../src/core/dp-factorizer.js';
import { containsPoE2Grouping, extractTemplateSuffix } from './compute-regex-core.js';
import { pathDTransform, hasPathDGroup, findOverLimitEntries, POE2_REGEX_CHAR_LIMIT } from './path-d-transform.js';
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
  regexExclude?: { ru: string[] };
  regexPrefixContext?: { ru: string };
  affix?: string;
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
  revertedChanges: OptimizationChange[];
  totalFN: number;
  totalFP: number;
  totalRegexLen: number;
}

export interface OptimizerConfig {
  maxIterations: number;
  dryRun: boolean;
  verbose: boolean;
  /** Validate changes with block-based Oracle after each iteration (default: true) */
  oracleValidation: boolean;
  /** Budget-aware mode: prefer shorter regexes to stay under 250 chars for 6+ mods */
  budgetAware: boolean;
}

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  maxIterations: 10,
  dryRun: false,
  verbose: false,
  oracleValidation: true,
  budgetAware: true,
};

// ─── Constants ───

/** Synced with compute-regex.ts MIN_REGEX_LEN_DEFAULT */
const MIN_REGEX_LEN_DEFAULT = 5;

/** Per-category minimum regex length — synced with compute-regex.ts STRICT_CATEGORIES_MIN_LEN */
const MIN_REGEX_LEN_BY_CATEGORY: Record<string, number> = {
  'waystone': 7,
  'waystone-desecrated': 7,
  'tablet': 10,
  'jewel-desecrated': 10,
  'jewel-corrupted': 7,
};

/** Maximum regex length in PoE2 */
const POE2_REGEX_LIMIT = 250;

/** Estimated overhead per mod in a multi-mod regex: quotes + separator + number regex */
const ESTIMATED_MOD_OVERHEAD = 8;

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
 * Count cross-family FP: how many OTHER-family tokens' rawText match this regex.
 */
function countCrossFamilyFP(regex: string, tokenId: string, allTokens: JsonToken[]): number {
  const token = allTokens.find(t => t.id === tokenId);
  if (!token) return 0;
  const tokenFamily = token.familyKey.ru;
  let fp = 0;
  for (const t of allTokens) {
    if (t.id === tokenId) continue;
    if (t.familyKey.ru === tokenFamily) continue;
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
 * Validate a regex change using block-based Oracle.
 * Returns true if the change is safe (no cross-family FP, no FN).
 */
function oracleValidateChange(
  newRegex: string,
  token: JsonToken,
  allTokens: JsonToken[],
  _maxFP: number = 0
): { valid: boolean; crossFamilyFP: number; fn: boolean } {
  const rawText = token.rawText.ru;

  // CRITICAL: Reject regexes containing PoE2 grouping chars ( ).
  // PoE2 interprets () as regex grouping, not literal parens.
  // A regex like "4—7)% к сопротивлению хаосу" gets truncated at )
  // by PoE2's parser, producing a broken regex that still matches
  // rawText (false-positive validation pass) but doesn't work in-game.
  if (containsPoE2Grouping(newRegex)) {
    return { valid: false, crossFamilyFP: 0, fn: false };
  }

  // Check FN: regex must match its own rawText
  const fn = hasFN(newRegex, rawText);
  if (fn) {
    return { valid: false, crossFamilyFP: 0, fn: true };
  }

  // Check cross-family FP using block-based matching
  const tokenFamily = token.familyKey.ru;
  let crossFamilyFP = 0;

  for (const other of allTokens) {
    if (other.id === token.id) continue;
    if (other.familyKey.ru === tokenFamily) continue;

    // Use block-based matching for accurate in-game simulation
    const itemBlocks = getItemSearchBlocks({
      mods: [other.rawText.ru],
    });
    const regexWithQuotes = newRegex.includes('"') ? newRegex : `"${newRegex}"`;

    if (matchPoE2RegexItem(regexWithQuotes, { mods: [other.rawText.ru] })) {
      crossFamilyFP++;
    }
  }

  const valid = crossFamilyFP <= _maxFP && !fn;
  return { valid, crossFamilyFP, fn };
}

/**
 * Try to shorten a regex by trimming words from the left while keeping it unique.
 * Returns the shortest regex that still matches rawText and has <= maxFP false positives.
 */
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
  if (suffix && suffix.length >= MIN_REGEX_LEN_DEFAULT && matchQuotedGroup(suffix, rawText.toLowerCase())) {
    return suffix;
  }

  // Strategy 2: Find any substring that matches via PoE2 engine
  const lowerRaw = rawText.toLowerCase();
  for (let len = MIN_REGEX_LEN_DEFAULT; len <= lowerRaw.length; len++) {
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
  const words = lowerRaw.split(/\s+/).filter(w => w.length >= 3 && !/^\d+$/.test(w) && !containsPoE2Grouping(w));
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
  const currentFP = countCrossFamilyFP(currentRegex, tokenId, allTokens);
  if (currentFP === 0) return null;

  const lowerRaw = rawText.toLowerCase();
  const lowerRegex = currentRegex.toLowerCase();

  // Find the regex position in rawText
  const idx = lowerRaw.indexOf(lowerRegex);
  if (idx === -1) return null;

  // Try extending left
  for (let extend = 1; extend <= 20 && idx - extend >= 0; extend++) {
    const candidate = lowerRaw.substring(idx - extend, idx + lowerRegex.length);
    if (candidate.length > 50) break;
    // CRITICAL: Skip candidates containing PoE2 grouping chars ( )
    // PoE2 interprets () as regex grouping, not literal parens.
    // Extending from rawText often captures ')' from number ranges
    // like (4—7), which breaks the regex in PoE2 search.
    if (containsPoE2Grouping(candidate)) continue;
    if (!matchQuotedGroup(candidate, rawText.toLowerCase())) continue;

    const newFP = countCrossFamilyFP(candidate, tokenId, allTokens);
    if (newFP < currentFP) {
      return candidate;
    }
  }

  // Try extending right
  for (let extend = 1; extend <= 20 && idx + lowerRegex.length + extend <= lowerRaw.length; extend++) {
    const candidate = lowerRaw.substring(idx, idx + lowerRegex.length + extend);
    if (candidate.length > 50) break;
    // CRITICAL: Skip candidates containing PoE2 grouping chars ( )
    if (containsPoE2Grouping(candidate)) continue;
    if (!matchQuotedGroup(candidate, rawText.toLowerCase())) continue;

    const newFP = countCrossFamilyFP(candidate, tokenId, allTokens);
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
 * Try to add regexPrefixContext for short regexes (< MIN_REGEX_LEN_DEFAULT).
 * Short regexes like "огня" (4 chars) can match too broadly.
 * Strategy: find a distinctive word from the rawText before the suffix
 * that makes the regex more specific when used as AND context.
 */
function tryAddContextForShortRegex(
  token: JsonToken,
  allTokens: JsonToken[]
): { regex: string; context: string } | null {
  const regex = token.regex.ru;
  const rawText = token.rawText.ru;

  // Only handle short regexes below the minimum
  const minLen = MIN_REGEX_LEN_BY_CATEGORY[token.category] ?? MIN_REGEX_LEN_DEFAULT;
  if (regex.length >= minLen) return null;

  // Already has context — skip
  if (token.regexPrefixContext?.ru && token.regexPrefixContext.ru.length > 0) return null;

  const lowerRaw = rawText.toLowerCase();
  const lowerRegex = regex.toLowerCase();

  // Find the regex position in rawText
  const idx = lowerRaw.indexOf(lowerRegex);
  if (idx === -1) return null;

  // Extract words before the regex position
  const prefix = lowerRaw.substring(0, idx).trim();
  const prefixWords = prefix.split(/\s+/).filter(w => w.length >= 3 && !/^\d+$/.test(w));

  // Try each prefix word as context (from closest to furthest)
  for (let i = prefixWords.length - 1; i >= 0; i--) {
    const candidate = prefixWords[i];
    // Verify this word appears ONLY in the target family
    const tokenFamily = token.familyKey.ru;
    let crossFamilyCount = 0;
    for (const other of allTokens) {
      if (other.id === token.id) continue;
      if (other.familyKey.ru === tokenFamily) continue;
      if (other.rawText.ru.toLowerCase().includes(candidate)) {
        crossFamilyCount++;
      }
    }

    if (crossFamilyCount === 0) {
      // This prefix word is unique to the target family — use as context
      return { regex, context: candidate };
    }
  }

  // Try 2-word combinations for more specificity
  if (prefixWords.length >= 2) {
    for (let i = prefixWords.length - 1; i >= 1; i--) {
      const candidate = `${prefixWords[i - 1]} ${prefixWords[i]}`;
      const tokenFamily = token.familyKey.ru;
      let crossFamilyCount = 0;
      for (const other of allTokens) {
        if (other.id === token.id) continue;
        if (other.familyKey.ru === tokenFamily) continue;
        if (other.rawText.ru.toLowerCase().includes(candidate)) {
          crossFamilyCount++;
        }
      }

      if (crossFamilyCount === 0) {
        return { regex, context: candidate };
      }
    }
  }

  return null;
}

/**
 * Run one optimization iteration over all categories.
 * Returns changes made and aggregate stats.
 */
function runIteration(
  jsonData: Map<string, JsonData>,
  iteration: number,
  config: OptimizerConfig
): IterationResult {
  const changes: OptimizationChange[] = [];
  const revertedChanges: OptimizationChange[] = [];
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

          const change: OptimizationChange = {
            tokenId: token.id,
            category,
            oldRegex: regex,
            newRegex: fixed,
            strategy: 'fn-repair',
            fnBefore: true,
            fnAfter: hasFN(fixed, rawText),
            fpBefore: fp,
            fpAfter,
          };

          // Oracle validation
          if (config.oracleValidation) {
            const validation = oracleValidateChange(fixed, token, tokens, 0);
            if (!validation.valid) {
              revertedChanges.push(change);
              if (config.verbose) {
                console.log(`    REVERTED [fn-repair] ${token.id}: FN=${validation.fn}, crossFP=${validation.crossFamilyFP}`);
              }
              continue;
            }
          }

          changes.push(change);

          if (!config.dryRun) {
            token.regex.ru = fixed;
          }
          continue;
        }
      }

      // ─── Strategy 2: Dialect optimization ───
      const dialectOpt = tryDialectOptimization(regex, rawText);
      if (dialectOpt) {
        const fpAfter = countFP(dialectOpt, token.id, tokens);

        const change: OptimizationChange = {
          tokenId: token.id,
          category,
          oldRegex: regex,
          newRegex: dialectOpt,
          strategy: 'dialect',
          fnBefore: isFN,
          fnAfter: hasFN(dialectOpt, rawText),
          fpBefore: fp,
          fpAfter,
        };

        // Oracle validation
        if (config.oracleValidation) {
          const validation = oracleValidateChange(dialectOpt, token, tokens, 0);
          if (!validation.valid) {
            revertedChanges.push(change);
            if (config.verbose) {
              console.log(`    REVERTED [dialect] ${token.id}: FN=${validation.fn}, crossFP=${validation.crossFamilyFP}`);
            }
            continue;
          }
        }

        changes.push(change);

        if (!config.dryRun) {
          token.regex.ru = dialectOpt;
        }
        continue;
      }

      // ─── Strategy 3: Reduce cross-family FP by lengthening ───
      // Only for tokens with significant CROSS-FAMILY FP (>2) to avoid
      // making regexes longer for minor FP improvements.
      // IMPORTANT: Same-family FP is NOT a problem — when a user selects
      // a mod, ALL tiers in the same family should match. Only cross-family
      // FP (regex matching tokens from other mod families) needs reduction.
      const crossFamilyFP = countCrossFamilyFP(regex, token.id, tokens);
      if (crossFamilyFP > 2 && !isFN) {
        const reduced = tryReduceFP(regex, rawText, tokens, token.id);
        if (reduced) {
          const fpAfter = countCrossFamilyFP(reduced, token.id, tokens);

          const change: OptimizationChange = {
            tokenId: token.id,
            category,
            oldRegex: regex,
            newRegex: reduced,
            strategy: 'fp-reduce',
            fnBefore: false,
            fnAfter: hasFN(reduced, rawText),
            fpBefore: crossFamilyFP,
            fpAfter,
          };

          // Oracle validation
          if (config.oracleValidation) {
            const validation = oracleValidateChange(reduced, token, tokens, 0);
            if (!validation.valid) {
              revertedChanges.push(change);
              continue;
            }
          }

          changes.push(change);

          if (!config.dryRun) {
            token.regex.ru = reduced;
          }
        }
      }

      // ─── Strategy 4: Suffix shortening ───
      // For regexes without FN or FP, try to shorten by trimming words from left
      if (!isFN && fp === 0) {
        const shortened = trySuffixShortening(regex, rawText, tokens, token.id, 0);
        if (shortened && shortened.length < regex.length) {

          const change: OptimizationChange = {
            tokenId: token.id,
            category,
            oldRegex: regex,
            newRegex: shortened,
            strategy: 'suffix-shorten',
            fnBefore: false,
            fnAfter: false,
            fpBefore: 0,
            fpAfter: 0,
          };

          // Oracle validation for shortened regex
          if (config.oracleValidation) {
            const validation = oracleValidateChange(shortened, token, tokens, 0);
            if (!validation.valid) {
              revertedChanges.push(change);
              continue;
            }
          }

          changes.push(change);

          if (!config.dryRun) {
            token.regex.ru = shortened;
          }
        }
      }

      // ─── Strategy 5: Add context for short regexes ───
      // Only on first iteration to avoid repeated attempts
      if (iteration === 1) {
        const contextResult = tryAddContextForShortRegex(token, tokens);
        if (contextResult && contextResult.context.length > 0) {
          const change: OptimizationChange = {
            tokenId: token.id,
            category,
            oldRegex: regex,
            newRegex: regex, // regex stays the same, only context is added
            strategy: 'short-regex-context',
            fnBefore: isFN,
            fnAfter: isFN,
            fpBefore: fp,
            fpAfter: fp,
          };

          if (!config.dryRun) {
            token.regexPrefixContext = { ru: contextResult.context };
          }

          changes.push(change);
        }
      }
    }

    totalFN += catFN;
    totalFP += catFP;
  }

  return { iteration, changes, revertedChanges, totalFN, totalFP, totalRegexLen };
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
    // Apply dialect optimizations, then Path D transformation (iter 40).
    // Path D flattens `prefix(A|B|C)` → `prefix.*A|prefix.*B|prefix.*C` because
    // PoE2 does not parse `()` with multi-word `|` inside `"..."`.
    const dialectOptimized = applyDialectOptimizations(entry.result.regex);
    const newRegex = hasPathDGroup(dialectOptimized)
      ? pathDTransform(dialectOptimized)
      : dialectOptimized;

    // Update the table entry if:
    // - No existing entry (new), OR
    // - New regex is shorter (improvement), OR
    // - Existing regex has broken `()` with `|` and new regex doesn't
    //   (Path D fix — must replace broken entries even if Path D is longer)
    const shouldUpdate =
      !existing ||
      newRegex.length < existing.regex.ru.length ||
      (hasPathDGroup(existing.regex.ru) && !hasPathDGroup(newRegex));

    if (shouldUpdate) {
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

// ─── Public API ───

/**
 * Run the iterative optimizer on all generated JSON files.
 *
 * Can be called from run-etl.ts (Step 10) or standalone CLI.
 *
 * @param generatedDir Path to public/generated/
 * @param config Optimizer configuration
 * @returns Summary of optimization results
 */
export function runIterativeOptimization(
  generatedDir: string,
  config: Partial<OptimizerConfig> = {}
): {
  totalIterations: number;
  totalChanges: number;
  totalReverted: number;
  grandFN: number;
  grandFP: number;
  grandTokens: number;
  grandRegexLen: number;
  categoryStats: Array<{
    category: string;
    tokens: number;
    fn: number;
    fp: number;
    avgLen: number;
  }>;
} {
  const effectiveConfig: OptimizerConfig = { ...DEFAULT_OPTIMIZER_CONFIG, ...config };

  console.log('\n=== PoE2 Regex RU — Iterative Optimizer (Phase 5) ===\n');
  console.log(`Max iterations: ${effectiveConfig.maxIterations}`);
  console.log(`Dry run: ${effectiveConfig.dryRun}`);
  console.log(`Verbose: ${effectiveConfig.verbose}`);
  console.log(`Oracle validation: ${effectiveConfig.oracleValidation}`);
  console.log(`Budget-aware: ${effectiveConfig.budgetAware}\n`);

  // Load all generated JSON files
  if (!fs.existsSync(generatedDir)) {
    console.error(`ERROR: ${generatedDir} not found. Run ETL first.`);
    return {
      totalIterations: 0, totalChanges: 0, totalReverted: 0,
      grandFN: 0, grandFP: 0, grandTokens: 0, grandRegexLen: 0,
      categoryStats: [],
    };
  }

  const jsonFiles = fs.readdirSync(generatedDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${jsonFiles.length} category files\n`);

  const jsonData = new Map<string, JsonData>();
  for (const file of jsonFiles) {
    const filePath = path.join(generatedDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: JsonData = JSON.parse(raw);
    jsonData.set(data.category, data);
    console.log(`  Loaded: ${data.category} (${data.tokens.length} tokens)`);
  }

  // ─── Iterative optimization loop ───
  let prevResult: IterationResult | null = null;
  let totalChanges = 0;
  let totalReverted = 0;
  let totalIterations = 0;

  for (let iter = 1; iter <= effectiveConfig.maxIterations; iter++) {
    console.log(`\n--- Iteration ${iter} ---`);

    const result = runIteration(jsonData, iter, effectiveConfig);
    totalIterations = iter;
    totalChanges += result.changes.length;
    totalReverted += result.revertedChanges.length;

    console.log(`  Changes: ${result.changes.length}`);
    console.log(`  Reverted by Oracle: ${result.revertedChanges.length}`);
    console.log(`  FN: ${result.totalFN}, FP: ${result.totalFP}, Total regex len: ${result.totalRegexLen}`);

    if (effectiveConfig.verbose && result.changes.length > 0) {
      for (const change of result.changes) {
        console.log(`    [${change.strategy}] ${change.tokenId}: "${change.oldRegex}" → "${change.newRegex}" (FP: ${change.fpBefore}→${change.fpAfter})`);
      }
    }

    if (effectiveConfig.verbose && result.revertedChanges.length > 0) {
      for (const change of result.revertedChanges) {
        console.log(`    [REVERTED ${change.strategy}] ${change.tokenId}: "${change.oldRegex}" ✗ "${change.newRegex}"`);
      }
    }

    // Re-optimize optimization tables
    if (!effectiveConfig.dryRun) {
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
  if (!effectiveConfig.dryRun) {
    console.log('\n--- Writing optimized files ---');
    for (const [category, data] of jsonData) {
      const fileName = `${category}.json`;
      const filePath = path.join(generatedDir, fileName);
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
  const categoryStats: Array<{ category: string; tokens: number; fn: number; fp: number; avgLen: number }> = [];

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

    const avgLen = tokens.length > 0 ? catLen / tokens.length : 0;
    categoryStats.push({ category: catName, tokens: tokens.length, fn: catFN, fp: catFP, avgLen });
    console.log(`  ${catName}: ${tokens.length} tokens, FN=${catFN}, FP=${catFP}, avgLen=${avgLen.toFixed(1)}`);
  }

  console.log(`\n  TOTAL: ${grandTokens} tokens, FN=${grandFN}, FP=${grandFP}, avgLen=${(grandRegexLen / grandTokens).toFixed(1)}`);
  console.log(`  Iterations: ${totalIterations}, Changes: ${totalChanges}, Reverted: ${totalReverted}`);

  // ─── PoE2 char-limit diagnostic (iter 42) ───
  // After all optimization iterations + reoptimizeTable, scan the final
  // optimization tables for entries that exceed the PoE2 ~250-char limit.
  // Such entries cannot be used as a single in-game regex but are still
  // valid as table entries (compiler picks the subset matching user selection).
  let totalOverLimit = 0;
  for (const [catName, data] of jsonData) {
    const table = data.optimizationTable as Record<string, { regex: { ru: string } }>;
    const over = findOverLimitEntries(table, 'ru', POE2_REGEX_CHAR_LIMIT);
    if (over.length > 0) {
      totalOverLimit += over.length;
      console.log(`  [${catName}] ${over.length} opt-table entr${over.length === 1 ? 'y' : 'ies'} > ${POE2_REGEX_CHAR_LIMIT} chars:`);
      for (const { key, length } of over) {
        const shortKey = key.length > 70 ? key.slice(0, 67) + '...' : key;
        console.log(`    [len=${length}] ${shortKey}`);
      }
    }
  }
  if (totalOverLimit > 0) {
    console.log(`\n  ⚠  ${totalOverLimit} opt-table entries exceed PoE2 char limit (${POE2_REGEX_CHAR_LIMIT}).`);
    console.log(`     These entries are kept in the table (useful for subset selection) but`);
    console.log(`     cannot be used as a single in-game regex when ALL their ids are selected.`);
  }

  if (effectiveConfig.dryRun) {
    console.log('\n  (Dry run — no files were modified)');
  }

  return {
    totalIterations,
    totalChanges,
    totalReverted,
    grandFN,
    grandFP,
    grandTokens,
    grandRegexLen,
    categoryStats,
  };
}

// ─── CLI Entry Point ───

function main() {
  const config: Partial<OptimizerConfig> = {
    maxIterations: parseInt(process.argv.find(a => a === '--max-iterations') ?
      process.argv[process.argv.indexOf('--max-iterations') + 1] : '10', 10),
    dryRun: process.argv.includes('--dry-run'),
    verbose: process.argv.includes('--verbose'),
    oracleValidation: !process.argv.includes('--no-oracle'),
    budgetAware: !process.argv.includes('--no-budget'),
  };

  const generatedDir = path.resolve(process.cwd(), 'public', 'generated');
  runIterativeOptimization(generatedDir, config);
}

// Run as CLI only when executed directly
if (process.argv[1]?.includes('iterative-optimizer')) {
  main();
}
