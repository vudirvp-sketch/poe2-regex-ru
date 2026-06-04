/**
 * Compute the optimization table for a category.
 *
 * For each combination of 2-5 tokens that share a common substring,
 * compute the savings of using the shared substring vs individual regexes.
 */
import type { Locale, OptimizationEntry } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';

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
    if (text.length < 3) continue;
    const prefix = text.slice(0, 3);
    if (!prefixGroups.has(prefix)) {
      prefixGroups.set(prefix, []);
    }
    prefixGroups.get(prefix)!.push(token);
  }

  // For each prefix group with 2+ tokens, compute optimizations
  for (const [, group] of prefixGroups) {
    if (group.length < 2) continue;

    // Try combinations of size 2..5
    const maxSize = Math.min(5, group.length);
    for (let size = 2; size <= maxSize; size++) {
      for (const combo of combinations(group, size)) {
        // Find longest common substring among all combo members
        const sharedSubstring = findLongestCommonSubstring(
          combo.map(t => t.rawText[locale].toLowerCase())
        );

        if (!sharedSubstring || sharedSubstring.length < 2) continue;

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
 */
function findLongestCommonSubstring(strings: string[]): string {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];

  let common = findAllSubstrings(strings[0]);

  for (let i = 1; i < strings.length; i++) {
    const currentSubstrings = findAllSubstrings(strings[i]);
    const currentSet = new Set(currentSubstrings);
    common = common.filter(s => currentSet.has(s));

    if (common.length === 0) return '';

    // Keep only the longest ones
    const maxLen = Math.max(...common.map(s => s.length));
    common = common.filter(s => s.length === maxLen);
  }

  if (common.length === 0) return '';

  // Return the first (and longest) common substring
  return common[0];
}

/**
 * Find all substrings of a string (for small strings only).
 */
function findAllSubstrings(str: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < str.length; i++) {
    for (let len = 2; len <= str.length - i; len++) {
      result.push(str.substring(i, i + len));
    }
  }
  return result;
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
