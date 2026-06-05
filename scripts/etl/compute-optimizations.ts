/**
 * Compute the optimization table for a category.
 *
 * ALGORITHM v2 — Family-based grouping:
 *
 * Instead of grouping by 3-char prefix (which misses cross-prefix families),
 * group tokens by their familyKey (normalized rawTextTemplate).
 *
 * For each family with 2+ tokens, compute the shared family regex
 * and the savings of using it vs individual regexes.
 *
 * The optimization table is used at runtime to replace groups of selected
 * OR-combined tokens with a single shorter regex.
 */
import type { Locale, OptimizationEntry } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';
import type { RegexResult } from './compute-regex.js';

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
 * Groups tokens by familyKey (from regex results), then for each family
 * with 2+ tokens, creates an optimization entry with the shared family regex.
 */
export function computeOptimizations(
  tokens: NormalizedMod[],
  regexResults: Map<string, RegexResult>,
  locale: Locale = 'ru'
): Record<string, OptimizationEntry> {
  const result: Record<string, OptimizationEntry> = {};

  // Group tokens by familyKey
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
  for (const [familyKey, familyTokens] of familyGroups) {
    if (familyTokens.length < 2) continue;

    // Get the shared regex for this family (all tokens in the family share the same regex)
    const firstResult = regexResults.get(familyTokens[0].id);
    const sharedRegex = firstResult?.regex ?? familyTokens[0].rawText[locale];

    if (!sharedRegex || sharedRegex.length === 0) continue;

    // Compute savings: sum of individual regex lengths - shared regex length
    // If all tokens already use the family regex, savings = 0 (no optimization needed)
    // But if some tokens have longer individual regexes, the optimization helps
    const individualLength = familyTokens.reduce((sum, t) => {
      const r = regexResults.get(t.id);
      return sum + (r?.regex.length ?? t.rawText[locale].length);
    }, 0);

    // Savings: using one shared regex instead of N individual ones in an OR
    // In the worst case, OR of N identical regexes is N * len + N-1 (for | separators)
    // The optimization replaces this with just one regex
    const orLength = familyTokens.reduce((sum, t, i) => {
      const r = regexResults.get(t.id);
      const len = r?.regex.length ?? t.rawText[locale].length;
      return sum + len + (i > 0 ? 1 : 0); // +1 for | separator
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

  // Also try cross-family optimizations: find families that share common substrings
  // This handles cases like "к сопротивлению" shared across fire/cold/lightning res
  const familyKeys = Array.from(familyGroups.keys());
  for (let i = 0; i < familyKeys.length; i++) {
    for (let j = i + 1; j < familyKeys.length; j++) {
      const groupA = familyGroups.get(familyKeys[i])!;
      const groupB = familyGroups.get(familyKeys[j])!;

      if (groupA.length + groupB.length > 20) continue; // Skip very large combos

      // Find common substring between the two families' regexes
      const regexA = regexResults.get(groupA[0].id)?.regex ?? '';
      const regexB = regexResults.get(groupB[0].id)?.regex ?? '';

      if (!regexA || !regexB) continue;

      const commonSubstring = longestCommonSubstring(regexA.toLowerCase(), regexB.toLowerCase());
      if (commonSubstring.length < 4) continue;

      // Check if using this common substring as a shared regex would save space
      const allIds = [...groupA, ...groupB].map(t => t.id).sort();
      const key = allIds.join(':');

      // Only add if this is a genuinely new optimization (not already covered)
      if (result[key]) continue;

      // Compute savings
      const orLength = [...groupA, ...groupB].reduce((sum, t, idx) => {
        const r = regexResults.get(t.id);
        const len = r?.regex.length ?? t.rawText[locale].length;
        return sum + len + (idx > 0 ? 1 : 0);
      }, 0);

      const savings = orLength - commonSubstring.length;
      if (savings <= 0) continue;

      result[key] = {
        ids: allIds,
        regex: { [locale]: commonSubstring },
        weight: commonSubstring.length,
        count: groupA.length + groupB.length,
      };
    }
  }

  return result;
}

/**
 * Find the longest common substring of two strings.
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
