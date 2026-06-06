/**
 * DP Factorizer — Dynamic programming on Trie for optimal regex factorization.
 *
 * Phase 3 of the optimizer plan. Uses DP to choose the optimal factorization
 * points in a Trie, producing the shortest possible regex while respecting
 * PoE2 constraints (maxLength = 250, grouping costs).
 *
 * Cost model:
 * - Literal characters: 1 char each
 * - Grouping: `()` = 2 chars overhead
 * - Alternation: `|` = 1 char per separator
 * - Character class: `[]` = 2 chars overhead
 * - Optional: `?` = 1 char overhead
 *
 * The DP considers:
 * 1. Whether to factorize at each Trie branching point
 * 2. Whether to use prefix/suffix/combined factorization
 * 3. Whether to apply PoE2 dialect optimizations ([её], [юя], ь?)
 * 4. Whether the result fits within maxLength
 *
 * The algorithm works on the TrieNode from trie-factorizer.ts,
 * extending it with DP state computation.
 */
import {
  longestCommonPrefix,
  longestCommonSuffix,
} from './trie-factorizer';

// ─── DP State ───

export interface DPState {
  /** Total length of the factorized regex */
  cost: number;
  /** The factorized regex string */
  regex: string;
}

/** Maximum regex length in PoE2 */
const MAX_LENGTH = 250;

// ─── Core DP Algorithm ───

/**
 * DP-factorize a list of words into the shortest possible regex.
 *
 * This is the main entry point. It tries multiple factorization strategies
 * and returns the one with the lowest cost (shortest regex) that fits
 * within maxLength.
 *
 * Strategies tried:
 * 1. DP on prefix Trie (finds optimal prefix factorization)
 * 2. DP on suffix Trie (finds optimal suffix factorization)
 * 3. DP on combined prefix+suffix (finds optimal sandwich factorization)
 * 4. Flat OR (no factorization, baseline)
 *
 * @param words List of alternative strings to factorize
 * @param maxLength Maximum allowed regex length (default 250)
 */
export function dpFactorize(words: string[], maxLength: number = MAX_LENGTH): DPState {
  if (words.length === 0) return { cost: 0, regex: '' };
  if (words.length === 1) return { cost: words[0].length, regex: words[0] };

  // Deduplicate
  const unique = [...new Set(words)];
  if (unique.length === 1) return { cost: unique[0].length, regex: unique[0] };

  const candidates: DPState[] = [];

  // Strategy 1: DP prefix factorization
  const prefixResult = dpFactorizeByPrefix(unique, maxLength);
  if (prefixResult && prefixResult.cost <= maxLength) candidates.push(prefixResult);

  // Strategy 2: DP suffix factorization
  const suffixResult = dpFactorizeBySuffix(unique, maxLength);
  if (suffixResult && suffixResult.cost <= maxLength) candidates.push(suffixResult);

  // Strategy 3: DP combined (prefix + suffix extraction)
  const combinedResult = dpFactorizeCombined(unique, maxLength);
  if (combinedResult && combinedResult.cost <= maxLength) candidates.push(combinedResult);

  // Strategy 4: Flat OR (baseline)
  const flatOr = unique.join('|');
  candidates.push({ cost: flatOr.length, regex: flatOr });

  // Pick the shortest valid regex
  candidates.sort((a, b) => a.cost - b.cost);
  return candidates[0];
}

/**
 * DP factorization on prefix Trie.
 *
 * Walks the prefix Trie and at each branching point, decides whether
 * to factorize (extract common prefix) or not.
 *
 * For a node at depth d with children c1, c2, ...:
 * - Factorize: prefix + (factorize(c1_remainders) | factorize(c2_remainders))
 *   Cost = prefix_len + 2 + sum(child_costs) + (num_children - 1)
 * - Don't factorize: each word is emitted separately
 *   Cost = sum(word_lengths) + (num_words - 1)
 *
 * Also handles words that end at this node (isEndOfWord) alongside
 * words that continue further.
 */
function dpFactorizeByPrefix(words: string[], maxLength: number): DPState | null {
  if (words.length < 2) return null;

  const prefix = longestCommonPrefix(words);
  if (prefix.length === 0) return null;

  const remainders = words.map(w => w.slice(prefix.length));

  // Recursively factorize remainders
  const factorizedRemainders = dpFactorizeGroup(remainders, maxLength - prefix.length - 2);
  if (!factorizedRemainders) return null;

  // If there's only one remainder group and no alternation needed
  if (factorizedRemainders.parts.length === 1 && !factorizedRemainders.hasEmpty) {
    const regex = prefix + factorizedRemainders.parts[0];
    return { cost: regex.length, regex };
  }

  // Group the remainders: prefix(alt1|alt2|...)
  const orParts = factorizedRemainders.parts;
  let inner: string;

  if (factorizedRemainders.hasEmpty) {
    // Some words end at the prefix (empty remainder)
    // Use optional group: prefix(alt1|alt2|...)? or prefix(alt1|alt2)?
    if (orParts.length === 1) {
      inner = `${prefix}(${orParts[0]})?`;
    } else {
      inner = `${prefix}(${orParts.join('|')})?`;
    }
  } else {
    inner = `${prefix}(${orParts.join('|')})`;
  }

  if (inner.length > maxLength) return null;

  return { cost: inner.length, regex: inner };
}

/**
 * DP factorization on suffix Trie (by reversing and using prefix factorization).
 */
function dpFactorizeBySuffix(words: string[], maxLength: number): DPState | null {
  if (words.length < 2) return null;

  const suffix = longestCommonSuffix(words);
  if (suffix.length === 0) return null;

  const remainders = words.map(w => w.slice(0, w.length - suffix.length));

  // If all remainders are empty, just return the suffix
  if (remainders.every(r => r.length === 0)) {
    return { cost: suffix.length, regex: suffix };
  }

  // Factorize the prefixes
  const factorizedPrefixes = dpFactorizeGroup(remainders, maxLength - suffix.length - 2);
  if (!factorizedPrefixes) return null;

  let regex: string;

  if (factorizedPrefixes.parts.length === 1 && !factorizedPrefixes.hasEmpty) {
    // Single prefix group + suffix
    regex = `${factorizedPrefixes.parts[0]}${suffix}`;
  } else if (factorizedPrefixes.hasEmpty) {
    // Some words are just the suffix (no prefix part)
    // (p1|p2)?suffix
    const orParts = factorizedPrefixes.parts;
    if (orParts.length === 1) {
      regex = `(${orParts[0]})?${suffix}`;
    } else {
      regex = `(${orParts.join('|')})?${suffix}`;
    }
  } else {
    // (p1|p2|p3)suffix
    regex = `(${factorizedPrefixes.parts.join('|')})${suffix}`;
  }

  if (regex.length > maxLength) return null;

  // Only use suffix factorization if it actually saves characters
  const flatLen = words.join('|').length;
  if (regex.length >= flatLen) return null;

  return { cost: regex.length, regex };
}

/**
 * DP combined factorization: extract both prefix and suffix,
 * leaving the middle parts in an alternation group.
 *
 * Result: prefix(m1|m2|m3)suffix
 * If some words have empty middle: prefix(m1|m2)?suffix
 */
function dpFactorizeCombined(words: string[], maxLength: number): DPState | null {
  if (words.length < 2) return null;

  const prefix = longestCommonPrefix(words);
  if (prefix.length === 0) return null;

  const afterPrefix = words.map(w => w.slice(prefix.length));
  const nonEmptyAfter = afterPrefix.filter(r => r.length > 0);

  if (nonEmptyAfter.length === 0) {
    // All words are identical to the prefix
    return { cost: prefix.length, regex: prefix };
  }

  const suffix = longestCommonSuffix(nonEmptyAfter);
  if (suffix.length === 0) {
    // No common suffix — fall back to prefix-only
    return dpFactorizeByPrefix(words, maxLength);
  }

  const middleParts = afterPrefix.map(r => {
    if (r.length === 0) return '';
    return r.slice(0, r.length - suffix.length);
  });

  const hasEmptyMiddle = middleParts.some(m => m.length === 0);
  const nonEmptyMiddles = middleParts.filter(m => m.length > 0);

  if (nonEmptyMiddles.length === 0) {
    // All words are prefix + suffix
    const regex = prefix + suffix;
    if (regex.length > maxLength) return null;
    return { cost: regex.length, regex };
  }

  // Recursively factorize the middle parts if beneficial
  const factorizedMiddle = dpFactorizeGroup(nonEmptyMiddles, maxLength - prefix.length - suffix.length - 3);

  let regex: string;

  if (factorizedMiddle && factorizedMiddle.parts.length > 0) {
    const middleOr = factorizedMiddle.parts.join('|');
    if (hasEmptyMiddle) {
      regex = `${prefix}(${middleOr})?${suffix}`;
    } else {
      regex = `${prefix}(${middleOr})${suffix}`;
    }
  } else {
    // Fall back to simple OR of middle parts
    const middleOr = nonEmptyMiddles.join('|');
    if (hasEmptyMiddle) {
      regex = `${prefix}(${middleOr})?${suffix}`;
    } else {
      regex = `${prefix}(${middleOr})${suffix}`;
    }
  }

  if (regex.length > maxLength) return null;

  const flatLen = words.join('|').length;
  if (regex.length >= flatLen) return null;

  return { cost: regex.length, regex };
}

// ─── DP Group Factorization ───

interface FactorizedGroup {
  /** The parts to join with | */
  parts: string[];
  /** Whether there are empty parts (words that end before this group) */
  hasEmpty: boolean;
}

/**
 * Factorize a group of strings using DP, trying to find the optimal
 * sub-factorization within the group.
 *
 * For each subset of strings that share a common prefix, recursively
 * factorize them. This produces nested factorization like:
 *   a(b|c)d(ef|gh)
 *
 * @param strings The strings to factorize
 * @param budget Remaining character budget
 */
function dpFactorizeGroup(strings: string[], budget: number): FactorizedGroup | null {
  if (strings.length === 0) return { parts: [], hasEmpty: false };

  const hasEmpty = strings.some(s => s.length === 0);
  const nonEmpty = strings.filter(s => s.length > 0);

  if (nonEmpty.length === 0) return { parts: [], hasEmpty: true };

  if (nonEmpty.length === 1) {
    return { parts: [nonEmpty[0]], hasEmpty };
  }

  // Try to group by common prefix
  const lcp = longestCommonPrefix(nonEmpty);
  if (lcp.length >= 2) {
    const remainders = nonEmpty.map(s => s.slice(lcp.length));
    const subResult = dpFactorizeGroup(remainders, budget - lcp.length - 2);

    if (subResult && subResult.parts.length > 0) {
      if (subResult.parts.length === 1 && !subResult.hasEmpty) {
        // No need for grouping parens
        const combined = lcp + subResult.parts[0];
        if (combined.length <= budget) {
          return { parts: [combined], hasEmpty };
        }
      } else {
        // Need grouping: prefix(part1|part2|...)
        const inner = subResult.parts.join('|');
        const combined = `${lcp}(${inner})`;
        if (combined.length <= budget) {
          return { parts: [combined], hasEmpty };
        }
      }
    }
  }

  // Try to group by common suffix
  const suffix = longestCommonSuffix(nonEmpty);
  if (suffix.length >= 2) {
    const remainders = nonEmpty.map(s => s.slice(0, s.length - suffix.length));
    const subResult = dpFactorizeGroup(remainders, budget - suffix.length - 2);

    if (subResult && subResult.parts.length > 0) {
      if (subResult.parts.length === 1 && !subResult.hasEmpty) {
        const combined = subResult.parts[0] + suffix;
        if (combined.length <= budget) {
          return { parts: [combined], hasEmpty };
        }
      } else {
        const inner = subResult.parts.join('|');
        const combined = `(${inner})${suffix}`;
        if (combined.length <= budget) {
          return { parts: [combined], hasEmpty };
        }
      }
    }
  }

  // No sub-factorization found — emit as flat parts
  // But try to find clusters that can be sub-factorized
  const clusters = findClusters(nonEmpty, budget);

  if (clusters.length < nonEmpty.length) {
    // Found some clustering that reduces the number of parts
    return { parts: clusters, hasEmpty };
  }

  // Final fallback: flat OR
  return { parts: nonEmpty, hasEmpty };
}

/**
 * Find clusters of strings that can be factorized together.
 * Returns an array where each element is either a single string
 * or a factorized group string.
 */
function findClusters(strings: string[], budget: number): string[] {
  if (strings.length <= 2) return strings;

  const result: string[] = [];
  const used = new Set<number>();

  // Try to find pairs/groups with common prefixes
  for (let i = 0; i < strings.length; i++) {
    if (used.has(i)) continue;

    const clusterIndices = [i];

    for (let j = i + 1; j < strings.length; j++) {
      if (used.has(j)) continue;

      // Check if strings[j] shares a prefix of at least 2 chars with any cluster member
      const sharedWithCluster = clusterIndices.some(ci => {
        const p = longestCommonPrefix([strings[ci], strings[j]]);
        return p.length >= 2;
      });

      if (sharedWithCluster) {
        clusterIndices.push(j);
      }
    }

    if (clusterIndices.length >= 2) {
      // Factorize this cluster
      const clusterWords = clusterIndices.map(idx => strings[idx]);
      const factorized = dpFactorize(clusterWords, budget);
      if (factorized.cost < clusterWords.join('|').length) {
        result.push(factorized.regex);
        for (const idx of clusterIndices) used.add(idx);
        continue;
      }
    }

    // No cluster — emit as-is
    if (!used.has(i)) {
      result.push(strings[i]);
      used.add(i);
    }
  }

  return result;
}

// ─── PoE2 Dialect Optimizations ───

/**
 * Apply PoE2 dialect optimizations to a factorized regex.
 *
 * Two levels of optimization:
 *
 * Level 1 — Within-group: Replace adjacent char alternations inside `()`:
 *   (е|ё) → [её],  (ю|я) → [юя]
 *
 * Level 2 — Top-level: Merge alternatives that differ only in specific chars:
 *   тест|тёст → т[её]ст
 *   молнию|молния → молни[юя]
 *
 * Level 3 — Optional suffix: When one alt is another + ь:
 *   карть|карт → карт(ь)?
 *
 * These optimizations are SAFE because PoE2's regex engine supports
 * character classes [] and optional ?.
 *
 * @param regex The regex string to optimize
 * @returns The optimized regex string
 */
export function applyDialectOptimizations(regex: string): string {
  // Level 1: Within-group alternation replacement
  // (е|ё) → [её], (ё|е) → [её]
  let result = withinGroupOptimization(regex);

  // Level 2: Top-level alternative merging
  result = topLevelAlternativeMerging(result);

  return result;
}

/** Character pairs that can be merged into a character class */
const DIALECT_PAIRS: [string, string, string][] = [
  ['е', 'ё', 'её'],
  ['ю', 'я', 'юя'],
  ['а', 'я', 'ая'],
  ['ы', 'е', 'ые'],
  ['и', 'е', 'ие'],
  ['о', 'в', 'ов'],
];

/**
 * Level 1: Replace within-group alternations like (е|ё) with [её].
 * Works on content inside parentheses where two single-char alternatives
 * are separated by |.
 */
function withinGroupOptimization(regex: string): string {
  let result = regex;

  for (const [a, b, cls] of DIALECT_PAIRS) {
    // (a|b) → [cls]  or  (b|a) → [cls]
    const re1 = new RegExp(
      escapeRegex('(') + escapeRegex(a) + '\\|' + escapeRegex(b) + escapeRegex(')'),
      'g'
    );
    const re2 = new RegExp(
      escapeRegex('(') + escapeRegex(b) + '\\|' + escapeRegex(a) + escapeRegex(')'),
      'g'
    );
    result = result.replace(re1, `[${cls}]`);
    result = result.replace(re2, `[${cls}]`);
  }

  return result;
}

/**
 * Level 2: Merge top-level alternatives that differ only in one character
 * from a dialect pair.
 *
 * Example: тест|тёст → т[её]ст
 *   because they differ only at position 1 (е vs ё)
 * Example: молнию|молния → молни[юя]
 *   because they differ only at the last char (ю vs я)
 */
function topLevelAlternativeMerging(regex: string): string {
  // Split by top-level | (not inside parentheses)
  const alternatives = splitTopLevel(regex);
  if (alternatives.length < 2) return regex;

  const merged: string[] = [];
  const used = new Set<number>();

  for (let i = 0; i < alternatives.length; i++) {
    if (used.has(i)) continue;

    let bestMerged: string | null = null;
    let bestJ = -1;

    for (let j = i + 1; j < alternatives.length; j++) {
      if (used.has(j)) continue;

      const mergedResult = tryMergeAlternatives(alternatives[i], alternatives[j]);
      if (mergedResult && (!bestMerged || mergedResult.length < bestMerged.length)) {
        bestMerged = mergedResult;
        bestJ = j;
      }
    }

    if (bestMerged && bestJ >= 0) {
      merged.push(bestMerged);
      used.add(i);
      used.add(bestJ);
    } else {
      merged.push(alternatives[i]);
      used.add(i);
    }
  }

  const result = merged.join('|');
  return result.length < regex.length ? result : regex;
}

/**
 * Try to merge two alternatives that differ only in a dialect pair.
 * Returns the merged string if successful, null otherwise.
 *
 * Example: "тест" and "тёст" → "т[её]ст"
 * Example: "молнию" and "молния" → "молни[юя]"
 */
function tryMergeAlternatives(a: string, b: string): string | null {
  if (a === b) return null;
  if (a.length !== b.length) {
    // Try optional suffix merge: one is a prefix of the other + ь
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;

    if (longer === shorter + 'ь' || longer === shorter + 'ь') {
      return `${shorter}(ь)?`;
    }
    return null;
  }

  // Find positions where they differ
  const diffPositions: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffPositions.push(i);
  }

  // Only merge if exactly 1 position differs
  if (diffPositions.length !== 1) return null;

  const pos = diffPositions[0];
  const charA = a[pos];
  const charB = b[pos];

  // Check if the differing chars are a dialect pair
  for (const [da, db, cls] of DIALECT_PAIRS) {
    if ((charA === da && charB === db) || (charA === db && charB === da)) {
      return a.slice(0, pos) + `[${cls}]` + a.slice(pos + 1);
    }
  }

  return null;
}

/**
 * Split a regex string by top-level | (not inside parentheses).
 */
function splitTopLevel(regex: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < regex.length; i++) {
    const ch = regex[i];
    if (ch === '(' ) depth++;
    else if (ch === ')') depth--;

    if (ch === '|' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current) parts.push(current);
  return parts;
}

/** Escape special regex characters for use in a regex pattern. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Batch DP Factorization ───

export interface DPFactorizationEntry {
  /** Original words */
  words: string[];
  /** DP-factorized result */
  result: DPState;
  /** Savings compared to flat OR */
  savings: number;
  /** Savings as percentage */
  savingsPercent: number;
}

/**
 * Batch DP-factorize: find the optimal factorization for each group of words
 * that share common structure.
 *
 * This is the main entry point for the ETL pipeline: given a list of
 * regex strings from a category, it groups them by commonalities and
 * DP-factorizes each group.
 *
 * @param allRegexes All regex strings in a category
 * @param maxLength Maximum allowed regex length (default 250)
 */
export function batchDPFactorize(
  allRegexes: string[],
  maxLength: number = MAX_LENGTH
): DPFactorizationEntry[] {
  if (allRegexes.length < 2) return [];

  // Deduplicate
  const unique = [...new Set(allRegexes)];
  if (unique.length < 2) return [];

  // Group by common prefix (at least 3 chars shared)
  const groups = new Map<string, string[]>();

  for (const regex of unique) {
    let placed = false;

    // Try longer prefixes first for tighter grouping
    for (let prefixLen = 8; prefixLen >= 3; prefixLen--) {
      if (regex.length < prefixLen) continue;
      const prefix = regex.slice(0, prefixLen);

      // Check if this prefix already has a group
      for (const [, existingWords] of groups) {
        // Check if the regex shares this prefix with existing group members
        if (existingWords.some(w => w.startsWith(prefix))) {
          existingWords.push(regex);
          placed = true;
          break;
        }
      }
      if (placed) break;

      // Check if we can create a new group with other regexes sharing this prefix
      const siblings = unique.filter(r => r !== regex && r.startsWith(prefix));
      if (siblings.length > 0) {
        groups.set(prefix, [regex]);
        placed = true;
        break;
      }
    }
  }

  // Also try grouping by common suffix
  for (const regex of unique) {
    for (let suffixLen = 8; suffixLen >= 3; suffixLen--) {
      if (regex.length < suffixLen) continue;
      const suffix = regex.slice(-suffixLen);

      const key = `suffix:${suffix}`;
      if (groups.has(key)) {
        // Check if this regex isn't already in the group
        const existing = groups.get(key)!;
        if (!existing.includes(regex)) {
          existing.push(regex);
        }
        break;
      }

      const siblings = unique.filter(r => r !== regex && r.endsWith(suffix));
      if (siblings.length > 0) {
        groups.set(key, [regex, ...siblings]);
        break;
      }
    }
  }

  // DP-factorize each group
  const results: DPFactorizationEntry[] = [];

  for (const [, words] of groups) {
    if (words.length < 2) continue;

    const dedupedWords = [...new Set(words)];
    if (dedupedWords.length < 2) continue;

    const flatLen = dedupedWords.join('|').length;
    const result = dpFactorize(dedupedWords, maxLength);

    const savings = flatLen - result.cost;
    if (savings > 0) {
      results.push({
        words: dedupedWords,
        result,
        savings,
        savingsPercent: Math.round((savings / flatLen) * 100),
      });
    }
  }

  // Sort by savings descending
  results.sort((a, b) => b.savings - a.savings);
  return results;
}

// ─── Cost Estimation ───

/**
 * Estimate the cost (length) of a factorized regex without building it.
 * Useful for the optimizer to decide whether DP factorization is worthwhile.
 *
 * Uses a fast heuristic: common prefix + (remainders with | separators).
 */
export function estimateDPCost(words: string[]): number {
  if (words.length <= 1) return words[0]?.length ?? 0;

  const prefix = longestCommonPrefix(words);
  const suffix = longestCommonSuffix(words.filter(w => w.length > 0));

  let bestCost = words.join('|').length; // flat OR baseline

  // Prefix factorization estimate
  if (prefix.length > 0) {
    const remainders = words.map(w => w.slice(prefix.length));
    const innerCost = remainders.reduce((sum, r) => sum + Math.max(r.length, 0), 0) +
      (remainders.length - 1); // | separators
    const prefixCost = prefix.length + 2 + innerCost; // prefix( + inner + )
    bestCost = Math.min(bestCost, prefixCost);
  }

  // Suffix factorization estimate
  if (suffix.length > 0) {
    const remainders = words.map(w => w.slice(0, w.length - suffix.length));
    const innerCost = remainders.reduce((sum, r) => sum + Math.max(r.length, 0), 0) +
      (remainders.length - 1);
    const suffixCost = 1 + innerCost + 1 + suffix.length; // ( + inner + )suffix
    bestCost = Math.min(bestCost, suffixCost);
  }

  // Combined factorization estimate
  if (prefix.length > 0 && suffix.length > 0) {
    const afterPrefix = words.map(w => w.slice(prefix.length));
    const nonEmptyAfter = afterPrefix.filter(r => r.length > 0);
    const commonSuf = longestCommonSuffix(nonEmptyAfter);

    if (commonSuf.length > 0) {
      const middleParts = afterPrefix.map(r => {
        if (r.length === 0) return 0;
        return Math.max(r.length - commonSuf.length, 0);
      });
      const nonEmptyMiddle = middleParts.filter(m => m > 0);
      const innerCost = nonEmptyMiddle.reduce((sum, m) => sum + m, 0) +
        Math.max(nonEmptyMiddle.length - 1, 0);
      const hasEmpty = afterPrefix.some(r => r.length === 0);
      const combinedCost = prefix.length + 2 + innerCost + 1 + // prefix( + inner + )
        (hasEmpty ? 1 : 0) + // ? for optional middle
        commonSuf.length;
      bestCost = Math.min(bestCost, combinedCost);
    }
  }

  return bestCost;
}
