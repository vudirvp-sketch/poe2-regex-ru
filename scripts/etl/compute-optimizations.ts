/**
 * Compute the optimization table for a category.
 *
 * For each combination of 2-5 tokens that share a common substring,
 * compute the savings of using the shared substring vs individual regexes.
 *
 * Performance optimizations:
 * - Use DP-based longest common substring instead of enumerating all substrings
 * - Limit combinations to prefix groups with ≤ 20 tokens
 * - Skip groups larger than size 3 to avoid combinatorial explosion
 * - Use efficient Set-based lookups
 */
import type { Locale, OptimizationEntry } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';

/** Maximum tokens per prefix group to process */
const MAX_GROUP_SIZE = 20;
/** Maximum combination size to try */
const MAX_COMBO_SIZE = 3;
/** Minimum shared substring length to consider */
const MIN_SHARED_LEN = 3;

/**
 * Compute optimizations for all tokens in a category.
 *
 * Optimization: Only consider combinations of tokens that share
 * at least 3 characters at the start of their rawText.
 */
export function computeOptimizations(
  tokens: NormalizedMod[],
  regexResults: Map<string, { regex: string }>,
  locale: Locale = 'ru'
): Record<string, OptimizationEntry> {
  const result: Record<string, OptimizationEntry> = {};

  // Group tokens by shared prefix (first 3 chars of lowercase rawText)
  const prefixGroups = new Map<string, NormalizedMod[]>();
  for (const token of tokens) {
    const text = token.rawText[locale].toLowerCase();
    if (text.length < MIN_SHARED_LEN) continue;
    const prefix = text.slice(0, 3);
    if (!prefixGroups.has(prefix)) {
      prefixGroups.set(prefix, []);
    }
    prefixGroups.get(prefix)!.push(token);
  }

  // For each prefix group with 2+ tokens, compute optimizations
  for (const [, group] of prefixGroups) {
    if (group.length < 2) continue;
    // Skip very large groups to avoid performance issues
    if (group.length > MAX_GROUP_SIZE) continue;

    // Try combinations of size 2..MAX_COMBO_SIZE
    const maxSize = Math.min(MAX_COMBO_SIZE, group.length);
    for (let size = 2; size <= maxSize; size++) {
      for (const combo of combinations(group, size)) {
        // Find longest common substring among all combo members using DP
        const sharedSubstring = findLongestCommonSubstring(
          combo.map(t => t.rawText[locale].toLowerCase())
        );

        if (!sharedSubstring || sharedSubstring.length < MIN_SHARED_LEN) continue;

        // Compute savings: sum of individual regex lengths - shared substring length
        const individualLength = combo.reduce((sum, t) => {
          const r = regexResults.get(t.id);
          return sum + (r?.regex.length ?? t.rawText[locale].length);
        }, 0);

        const savings = individualLength - sharedSubstring.length;
        if (savings <= 0) continue;

        const key = combo.map(t => t.id).sort().join(':');
        result[key] = {
          ids: combo.map(t => t.id).sort(),
          regex: { [locale]: sharedSubstring },
          weight: sharedSubstring.length,
          count: combo.length,
        };
      }
    }
  }

  return result;
}

/**
 * Find the longest common substring among multiple strings.
 * Uses dynamic programming for pairwise comparison, then intersects.
 *
 * For 2 strings: O(n*m) time and space
 * For K strings: pairwise reduction
 */
function findLongestCommonSubstring(strings: string[]): string {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];

  // Start with LCS of first two strings, then reduce
  let common = lcsTwo(strings[0], strings[1]);

  for (let i = 2; i < strings.length && common.length >= MIN_SHARED_LEN; i++) {
    // Check if common is still a substring of strings[i]
    if (!strings[i].includes(common)) {
      // Recompute LCS between common candidate and this string
      common = lcsTwo(common, strings[i]);
    }
  }

  return common.length >= MIN_SHARED_LEN ? common : '';
}

/**
 * Find the longest common substring of two strings using DP.
 * O(n*m) time, O(min(n,m)) space.
 */
function lcsTwo(s1: string, s2: string): string {
  // Use shorter string for DP array to save memory
  if (s1.length > s2.length) {
    [s1, s2] = [s2, s1];
  }

  const n = s1.length;
  const m = s2.length;

  let maxLen = 0;
  let maxEnd = 0;

  // Use rolling array for space efficiency
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

/**
 * Generate all combinations of size k from an array.
 */
function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  if (size === 1) return arr.map(x => [x]);

  const result: T[][] = [];
  for (let i = 0; i <= arr.length - size; i++) {
    const rest = combinations(arr.slice(i + 1), size - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}
