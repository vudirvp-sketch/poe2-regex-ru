/**
 * Compute the optimization table for a category.
 *
 * ALGORITHM v4 — Family-based grouping + DP factorization + dialect optimizations + Path D:
 *
 * 1. Group tokens by familyKey, create optimization entries for families with 2+ tokens
 * 2. Use batchDPFactorize() for cross-family factorization (replaces naive LCS)
 * 3. Apply applyDialectOptimizations() to all optimization regexes
 * 4. Apply Path D transformation: `prefix(A|B|C)` → `prefix.*A|prefix.*B|prefix.*C`
 *    (iter 40) — PoE2 does not parse `()` with multi-word `|` inside `"..."`.
 *    Path D flattens such groups to top-level `|` with `.*` bridges, verified
 *    working in-game (iter 38-39).
 */
import type { Locale, OptimizationEntry } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';
import type { RegexResult } from './compute-regex.js';
import {
  batchDPFactorize,
  applyDialectOptimizations,
} from '../../src/core/dp-factorizer.js';
import { generateTruncatedSuffixes, containsPoE2Grouping } from './compute-regex.js';
import { normalizeTemplate } from './compute-regex-core.js';
import { matchQuotedGroup } from '../../src/core/poe2-regex-matcher.js';
import { pathDTransform, hasPathDGroup, findOverLimitEntries, POE2_REGEX_CHAR_LIMIT } from './path-d-transform.js';

/**
 * Compute optimizations for all tokens in a category.
 *
 * Three-phase approach:
 *   Phase A: Family-based grouping — tokens sharing a familyKey get one shared regex
 *   Phase B: DP factorization — cross-family groups factorized via batchDPFactorize()
 *   Phase C: Dialect optimization — [её], [юя], (ь|) applied to all regexes
 */
export function computeOptimizations(
  tokens: NormalizedMod[],
  regexResults: Map<string, RegexResult>,
  locale: Locale = 'ru'
): Record<string, OptimizationEntry> {
  const result: Record<string, OptimizationEntry> = {};

  // ─── Phase A: Family-based grouping ───
  const familyGroups = new Map<string, NormalizedMod[]>();

  for (const token of tokens) {
    const regexResult = regexResults.get(token.id);
    const familyKey = regexResult?.familyKey ?? normalizeTemplate(token.rawTextTemplate[locale]);

    if (!familyGroups.has(familyKey)) {
      familyGroups.set(familyKey, []);
    }
    familyGroups.get(familyKey)!.push(token);
  }

  // For each family with 2+ tokens, create an optimization entry
  for (const [, familyTokens] of familyGroups) {
    if (familyTokens.length < 2) continue;

    // Get the shared regex for this family (all tokens in the family share the same regex)
    const firstResult = regexResults.get(familyTokens[0].id);
    const sharedRegex = firstResult?.regex ?? familyTokens[0].rawText[locale];

    if (!sharedRegex || sharedRegex.length === 0) continue;

    // Savings: using one shared regex instead of N individual ones in an OR
    const orLength = familyTokens.reduce((sum, t, i) => {
      const r = regexResults.get(t.id);
      const len = r?.regex.length ?? t.rawText[locale].length;
      return sum + len + (i > 0 ? 1 : 0);
    }, 0);

    const savings = orLength - sharedRegex.length;
    if (savings <= 0) continue;

    const ids = familyTokens.map(t => t.id).sort();
    const key = ids.join(':');

    result[key] = {
      ids,
      regex: { [locale]: sharedRegex },
      weight: sharedRegex.length,
      count: familyTokens.length,
    };
  }

  // ─── Phase A1: Word truncation for family-based entries ───
  // For each family-based entry, try truncated versions of the shared regex
  // to find a shorter one that still matches all family tokens and is unique.
  // Only applies when the current shared regex is unique (no FP), so truncated
  // forms must also be unique — avoids complicating context/exclude patching.
  {
    // Pre-build: for each family group, collect all rawTexts (lowercase)
    const familyRawTexts = new Map<string, string[]>();
    for (const [familyKey, familyTokens] of familyGroups) {
      familyRawTexts.set(familyKey, familyTokens.map(t => t.rawText[locale].toLowerCase()));
    }

    // Pre-build: all other-family rawTexts for uniqueness checks
    const allFamilyKeys = [...familyGroups.keys()];

    let truncationSavings = 0;
    for (const key of Object.keys(result)) {
      const entry = result[key];
      const currentRegex = entry.regex[locale];
      if (!currentRegex || currentRegex.length < 5) continue;

      // Only truncate entries that don't have context/excludes (pure, no FP)
      // These are the safe ones to truncate
      if (entry.regexPrefixContext || entry.regexExclude) continue;

      // Find the family group for this entry
      const entryTokenIds = new Set(entry.ids);
      let matchedFamilyKey: string | null = null;
      let familyTokensList: NormalizedMod[] = [];
      for (const [fk, ft] of familyGroups) {
        if (ft.length === entry.count && ft.every(t => entryTokenIds.has(t.id))) {
          matchedFamilyKey = fk;
          familyTokensList = ft;
          break;
        }
      }
      if (!matchedFamilyKey) continue;

      // Collect other-family rawTexts (lowercase) for uniqueness check
      const otherRawTexts: string[] = [];
      for (const fk of allFamilyKeys) {
        if (fk === matchedFamilyKey) continue;
        const rawTexts = familyRawTexts.get(fk);
        if (rawTexts) otherRawTexts.push(...rawTexts);
      }

      // Generate truncated variants
      const candidates = generateTruncatedSuffixes(currentRegex, 3);

      // Sort by length ascending (try shortest first for max savings)
      candidates.sort((a, b) => a.length - b.length);

      for (const candidate of candidates) {
        // Skip if not shorter than current
        if (candidate.length >= currentRegex.length) continue;

        // Skip candidates with PoE2 grouping chars
        if (containsPoE2Grouping(candidate)) continue;

        // Check: candidate matches ALL family tokens' rawText via PoE2 engine
        const candidateLower = candidate.toLowerCase();
        const allMatch = familyTokensList.every(t =>
          matchQuotedGroup(candidateLower, t.rawText[locale].toLowerCase())
        );
        if (!allMatch) continue;

        // Check: candidate is unique (doesn't appear in any other-family rawText)
        const isUnique = !otherRawTexts.some(rt => rt.includes(candidateLower));
        if (!isUnique) continue;

        // Found a shorter unique truncated form — update the entry
        entry.regex[locale] = candidate;
        entry.weight = candidate.length;
        truncationSavings += currentRegex.length - candidate.length;
        break; // Take the shortest valid one
      }
    }

    if (truncationSavings > 0) {
      console.log(`  Phase A1: Word truncation saved ${truncationSavings} chars in optimization entries`);
    }
  }

  // ─── Phase B: DP factorization for cross-family optimizations ───
  // Collect all unique regexes from the category
  const allRegexes: string[] = [];
  const regexToTokenIds = new Map<string, string[]>();

  for (const token of tokens) {
    const r = regexResults.get(token.id);
    const regex = r?.regex ?? token.rawText[locale];
    if (!regex) continue;

    if (!regexToTokenIds.has(regex)) {
      regexToTokenIds.set(regex, []);
      allRegexes.push(regex);
    }
    regexToTokenIds.get(regex)!.push(token.id);
  }

  // Run DP factorization on all regexes in the category
  const dpEntries = batchDPFactorize(allRegexes);

  for (const entry of dpEntries) {
    // Map the factorized words back to token IDs
    const involvedIds: string[] = [];
    for (const word of entry.words) {
      const tokenIds = regexToTokenIds.get(word);
      if (tokenIds) {
        involvedIds.push(...tokenIds);
      }
    }

    if (involvedIds.length < 2) continue;

    const ids = [...new Set(involvedIds)].sort();
    const key = ids.join(':');

    // Skip if already covered by a family-based optimization (same or superset)
    if (result[key]) continue;

    // Compute the OR length for savings
    const orLength = ids.reduce((sum, id, i) => {
      const r = regexResults.get(id);
      const len = r?.regex.length ?? 0;
      return sum + len + (i > 0 ? 1 : 0);
    }, 0);

    const optimizedRegex = entry.result.regex;
    const savings = orLength - optimizedRegex.length;
    if (savings <= 0) continue;

    result[key] = {
      ids,
      regex: { [locale]: optimizedRegex },
      weight: optimizedRegex.length,
      count: ids.length,
    };
  }

  // ─── Phase C: Dialect optimizations ───
  // Apply [её], [юя], (ь|) optimizations to all optimization entry regexes
  for (const key of Object.keys(result)) {
    const entry = result[key];
    const originalRegex = entry.regex[locale];
    const optimizedRegex = applyDialectOptimizations(originalRegex);

    if (optimizedRegex !== originalRegex) {
      entry.regex[locale] = optimizedRegex;
      entry.weight = optimizedRegex.length;
    }
  }

  // ─── Phase D: Path D transformation (iter 40) ───
  // Flatten `prefix(A|B|C)` → `prefix.*A|prefix.*B|prefix.*C`
  //
  // PoE2 does NOT parse `()` with multi-word `|` inside `"..."` (Tests 15-17).
  // Path D moves alternation to top-level `|` with `.*` bridges, verified
  // working in-game (iter 38-39: 2/3/4 alt + AND-combination).
  //
  // Applied AFTER Phase C so that dialect-optimized `[её]` char classes
  // (which don't need Path D) are already in place. Only `(...)` groups
  // with `|` inside are transformed.
  let pathDTransformedCount = 0;
  for (const key of Object.keys(result)) {
    const entry = result[key];
    const originalRegex = entry.regex[locale];
    if (!originalRegex) continue;

    if (!hasPathDGroup(originalRegex)) continue;

    const transformedRegex = pathDTransform(originalRegex);
    if (transformedRegex !== originalRegex) {
      entry.regex[locale] = transformedRegex;
      entry.weight = transformedRegex.length;
      pathDTransformedCount++;
    }
  }

  if (pathDTransformedCount > 0) {
    console.log(`  Phase D: Path D transformed ${pathDTransformedCount} entries (flat alternation)`);
  }

  // ─── Phase D1: PoE2 char-limit diagnostic (iter 42) ───
  // After Path D transformation, some entries (especially with 10+ alternatives)
  // may exceed the PoE2 hard limit of ~250 chars. Such entries are still emitted
  // to the table — they are useful when only a SUBSET of their ids is selected
  // (compiler picks the matching subset via applyOptimizationTable). But the
  // full entry cannot be used as a single in-game regex.
  //
  // Policy: diagnostic-only. Log a warning so ETL maintainers know which
  // entries are at risk. No entries are dropped or modified.
  const overLimit = findOverLimitEntries(result, locale, POE2_REGEX_CHAR_LIMIT);
  if (overLimit.length > 0) {
    console.log(`  Phase D1: WARNING — ${overLimit.length} opt-table entr${overLimit.length === 1 ? 'y' : 'ies'} exceed ${POE2_REGEX_CHAR_LIMIT} chars (PoE2 hard limit):`);
    for (const { key, length, regex } of overLimit) {
      const preview = regex.length > 80 ? regex.slice(0, 77) + '...' : regex;
      console.log(`    [len=${length}] key=${key.slice(0, 60)}${key.length > 60 ? '...' : ''}`);
      console.log(`      regex: "${preview}"`);
    }
  }

  return result;
}
