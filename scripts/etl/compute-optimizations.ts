/**
 * Compute the optimization table for a category.
 *
 * ALGORITHM v3 — Family-based grouping + DP factorization + dialect optimizations:
 *
 * 1. Group tokens by familyKey, create optimization entries for families with 2+ tokens
 * 2. Use batchDPFactorize() for cross-family factorization (replaces naive LCS)
 * 3. Apply applyDialectOptimizations() to all optimization regexes
 *
 * Phase 4+6 integration: dialect optimizations ([её], [юя], ь?) and DP
 * factorization are now part of the ETL pipeline.
 */
import type { Locale, OptimizationEntry } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';
import type { RegexResult } from './compute-regex.js';
import {
  batchDPFactorize,
  applyDialectOptimizations,
} from '../../src/core/dp-factorizer.js';

/**
 * Normalize a rawTextTemplate into a "family key".
 * Replaces ## with # so that templates differing only in ## vs #
 * are treated as the same family.
 */
function normalizeTemplate(template: string): string {
  return template
    .replace(/##/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute optimizations for all tokens in a category.
 *
 * Three-phase approach:
 *   Phase A: Family-based grouping — tokens sharing a familyKey get one shared regex
 *   Phase B: DP factorization — cross-family groups factorized via batchDPFactorize()
 *   Phase C: Dialect optimization — [её], [юя], ь? applied to all regexes
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
  // Apply [её], [юя], ь? optimizations to all optimization entry regexes
  for (const key of Object.keys(result)) {
    const entry = result[key];
    const originalRegex = entry.regex[locale];
    const optimizedRegex = applyDialectOptimizations(originalRegex);

    if (optimizedRegex !== originalRegex) {
      entry.regex[locale] = optimizedRegex;
      entry.weight = optimizedRegex.length;
    }
  }

  return result;
}

/**
 * Find the longest common substring of two strings.
 * Kept as utility for potential future use.
 */
function longestCommonSubstring(s1: string, s2: string): string {
  if (s1.length > s2.length) {
    [s1, s2] = [s2, s1];
  }

  const n = s1.length;
  const m = s2.length;

  let maxLen = 0;
  let maxEnd = 0;

  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);

  for (let j = 1; j <= m; j++) {
    for (let i = 1; i <= n; i++) {
      if (s1[i - 1] === s2[j - 1]) {
        curr[i] = prev[i - 1] + 1;
        if (curr[i] > maxLen) {
          maxLen = curr[i];
          maxEnd = i;
        }
      } else {
        curr[i] = 0;
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return s1.slice(maxEnd - maxLen, maxEnd);
}
