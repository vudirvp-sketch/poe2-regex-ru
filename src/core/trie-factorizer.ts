/**
 * Trie Factorizer — Builds prefix/suffix trees from string sets
 * and finds optimal factorization points for regex compression.
 *
 * Phase 2 of the optimizer plan. Used to factorize common parts
 * between regex alternatives, e.g.:
 *   Flat: "сопротивлению огню|сопротивлению холоду|сопротивлению молнии" (64 chars)
 *   Factorized: "сопротивлению (огню|холоду|молнии)" (34 chars) — 47% savings
 *
 * This module works on plain strings (not AST nodes). It produces
 * factorization results that the optimizer (Phase 6) will integrate
 * into the ETL pipeline.
 *
 * PoE2 regex dialect constraints:
 * - Max regex length = 250 characters
 * - `()` for grouping, `|` for OR
 * - `[0-9]` for digit classes
 * - `.*` crosses mod boundaries (use with care)
 * - Maximum nesting depth = 3 levels
 */

// ─── Trie Data Structure ───

export interface TrieNode {
  /** Character at this node (empty string for root) */
  char: string;
  /** Child nodes indexed by their char */
  children: Map<string, TrieNode>;
  /** True if at least one word ends at this node */
  isEndOfWord: boolean;
  /** Set of original words that pass through this node */
  wordSet: Set<string>;
  /** Number of words in the subtree rooted at this node */
  wordCount: number;
}

/** Create an empty Trie node */
function createNode(char: string): TrieNode {
  return {
    char,
    children: new Map(),
    isEndOfWord: false,
    wordSet: new Set(),
    wordCount: 0,
  };
}

/** Build a Trie from a list of strings */
export function buildTrie(strings: string[]): TrieNode {
  const root = createNode('');

  for (const word of strings) {
    let node = root;
    node.wordSet.add(word);
    node.wordCount++;

    for (const ch of word) {
      if (!node.children.has(ch)) {
        node.children.set(ch, createNode(ch));
      }
      node = node.children.get(ch)!;
      node.wordSet.add(word);
      node.wordCount++;
    }

    node.isEndOfWord = true;
  }

  return root;
}

/** Build a reverse Trie (for suffix analysis) by inserting reversed strings */
export function buildReverseTrie(strings: string[]): TrieNode {
  return buildTrie(strings.map(s => [...s].reverse().join('')));
}

// ─── Common Prefix / Suffix Detection ───

export interface CommonGroup {
  /** The shared prefix or suffix */
  shared: string;
  /** The words that share this prefix/suffix */
  words: string[];
  /** The remaining parts after removing the shared part */
  remainders: string[];
  /** Character savings compared to flat OR */
  savings: number;
}

/**
 * Find common prefixes in a set of words using the Trie.
 * Returns groups sorted by savings (descending).
 */
export function findCommonPrefixes(words: string[], minGroupSize: number = 2): CommonGroup[] {
  if (words.length < minGroupSize) return [];

  const trie = buildTrie(words);
  const groups: CommonGroup[] = [];

  // Walk the trie to find nodes with wordCount >= minGroupSize
  // where the parent has a different wordCount (meaning the prefix
  // is the longest that still covers all these words)
  function walk(node: TrieNode, prefix: string): void {
    // If this node covers >= minGroupSize words and is a branching point
    if (node.wordCount >= minGroupSize) {
      // Check if this is a meaningful grouping point:
      // Either there's a branch (multiple children) or an end-of-word
      // that would produce a factorization
      const childChars = [...node.children.keys()];

      if (node.isEndOfWord && childChars.length > 0) {
        // Some words end here, others continue — potential grouping
        // But we need at least minGroupSize words total
        if (node.wordCount >= minGroupSize) {
          const wordsHere = [...node.wordSet];
          const remainders = wordsHere.map(w => w.slice(prefix.length) || '');
          // Only group if remainders are non-empty and diverse
          const uniqueRemainders = new Set(remainders.filter(r => r.length > 0));
          if (uniqueRemainders.size >= 1 && prefix.length > 0) {
            // Include words that end here (empty remainder) and words that continue
            const flatLen = wordsHere.reduce((sum, w) => sum + w.length, 0) + (wordsHere.length - 1);
            // Factorized: prefix + (r1|r2|r3)
            const orParts = remainders.filter(r => r.length > 0);
            const factorizedLen = prefix.length + (orParts.length > 1 ? 2 : 0) +
              orParts.reduce((sum, r) => sum + r.length, 0) + (orParts.length - 1);
            // Handle words that end here (empty remainder) — they become prefix + optional group
            const hasEmpty = remainders.some(r => r.length === 0);
            const actualFactorizedLen = hasEmpty
              ? prefix.length + 1 + factorizedLen - prefix.length  // prefix(r1|r2|) not ideal
              : factorizedLen;

            const savings = flatLen - Math.min(factorizedLen, actualFactorizedLen);
            if (savings > 0) {
              groups.push({
                shared: prefix,
                words: wordsHere,
                remainders,
                savings,
              });
            }
          }
        }
      }

      if (childChars.length >= 2) {
        // Branching point — each subtree is a candidate
        // But we should also consider the current prefix as a factorization point
        if (prefix.length > 0 && node.wordCount >= minGroupSize) {
          const wordsHere = [...node.wordSet];
          const remainders = wordsHere.map(w => w.slice(prefix.length));
          const flatLen = wordsHere.reduce((sum, w) => sum + w.length, 0) + (wordsHere.length - 1);
          const factorizedLen = prefix.length + 2 + // prefix + (
            remainders.reduce((sum, r) => sum + r.length, 0) + (remainders.length - 1) + 1; // | separators + )
          const savings = flatLen - factorizedLen;
          if (savings > 0) {
            groups.push({
              shared: prefix,
              words: wordsHere,
              remainders,
              savings,
            });
          }
        }
      }
    }

    // Recurse into children
    for (const child of node.children.values()) {
      walk(child, prefix + child.char);
    }
  }

  walk(trie, '');

  // Sort by savings descending
  groups.sort((a, b) => b.savings - a.savings);
  return groups;
}

/**
 * Find common suffixes in a set of words using the reverse Trie.
 * Returns groups sorted by savings (descending).
 */
export function findCommonSuffixes(words: string[], minGroupSize: number = 2): CommonGroup[] {
  if (words.length < minGroupSize) return [];

  const reversed = words.map(w => [...w].reverse().join(''));
  const prefixGroups = findCommonPrefixes(reversed, minGroupSize);

  return prefixGroups.map(g => ({
    shared: [...g.shared].reverse().join(''),
    words: g.words.map(w => [...w].reverse().join('')),
    remainders: g.remainders.map(r => [...r].reverse().join('')),
    savings: g.savings,
  }));
}

// ─── Factorization ───

export interface FactorizationResult {
  /** The factorized regex string */
  regex: string;
  /** The original flat OR regex */
  originalFlat: string;
  /** Character savings */
  savings: number;
  /** Savings as percentage */
  savingsPercent: number;
}

/**
 * Factorize a list of words into an optimized regex using prefix/suffix
 * commonality.
 *
 * Strategy:
 * 1. Try prefix factorization (most common for PoE2 mods)
 * 2. Try suffix factorization
 * 3. Try nested factorization (up to maxDepth levels)
 * 4. Pick the best result
 *
 * @param words List of alternative strings to factorize
 * @param maxDepth Maximum nesting depth (default 3)
 * @param maxLength Maximum allowed regex length (default 250)
 */
export function factorize(
  words: string[],
  maxDepth: number = 3,
  maxLength: number = 250
): FactorizationResult {
  if (words.length === 0) {
    return { regex: '', originalFlat: '', savings: 0, savingsPercent: 0 };
  }

  if (words.length === 1) {
    return {
      regex: words[0],
      originalFlat: words[0],
      savings: 0,
      savingsPercent: 0,
    };
  }

  const originalFlat = words.join('|');
  const originalLen = originalFlat.length;

  // Try all factorization strategies and pick the best
  const candidates: FactorizationResult[] = [];

  // Strategy 1: Simple prefix factorization
  const prefixFactorized = factorizeByPrefix(words, maxDepth, maxLength);
  if (prefixFactorized) candidates.push(prefixFactorized);

  // Strategy 2: Simple suffix factorization
  const suffixFactorized = factorizeBySuffix(words, maxDepth, maxLength);
  if (suffixFactorized) candidates.push(suffixFactorized);

  // Strategy 3: Combined prefix+suffix (for longer words)
  const combinedFactorized = factorizeCombined(words, maxDepth, maxLength);
  if (combinedFactorized) candidates.push(combinedFactorized);

  // Pick the shortest regex that doesn't exceed maxLength
  const valid = candidates.filter(c => c.regex.length <= maxLength);
  if (valid.length === 0) {
    // Fallback: original flat OR
    return {
      regex: originalFlat,
      originalFlat,
      savings: 0,
      savingsPercent: 0,
    };
  }

  // Sort by regex length (shortest first)
  valid.sort((a, b) => a.regex.length - b.regex.length);
  const best = valid[0];

  return {
    regex: best.regex,
    originalFlat,
    savings: originalLen - best.regex.length,
    savingsPercent: Math.round(((originalLen - best.regex.length) / originalLen) * 100),
  };
}

/**
 * Factorize by extracting a common prefix.
 * Input: ["сопротивлению огню", "сопротивлению холоду", "сопротивлению молнии"]
 * Output: "сопротивлению (огню|холоду|молнии)"
 */
function factorizeByPrefix(
  words: string[],
  maxDepth: number,
  maxLength: number
): FactorizationResult | null {
  if (words.length < 2) return null;

  const prefix = longestCommonPrefix(words);
  if (prefix.length === 0) return null;

  const remainders = words.map(w => w.slice(prefix.length));
  const originalFlat = words.join('|');
  const originalLen = originalFlat.length;

  // Recursively factorize remainders if beneficial and depth allows
  let factorizedRemainders = remainders;
  if (maxDepth > 1 && remainders.length >= 2) {
    factorizedRemainders = remainders.map(r => {
      // Don't factorize single words
      if (!r.includes('|') && r.length < 10) return r;
      return r; // Keep as-is for now (nested factorization handled separately)
    });
  }

  // Build the factorized regex
  const orPart = factorizedRemainders.join('|');
  let regex: string;

  if (factorizedRemainders.length === 1 && factorizedRemainders[0] === '') {
    // All words are identical to the prefix
    regex = prefix;
  } else if (factorizedRemainders.some(r => r.includes('|'))) {
    // Already has alternation — use grouping
    regex = `${prefix}(${orPart})`;
  } else if (factorizedRemainders.length > 1) {
    regex = `${prefix}(${orPart})`;
  } else {
    regex = prefix + factorizedRemainders[0];
  }

  if (regex.length > maxLength) return null;

  return {
    regex,
    originalFlat,
    savings: originalLen - regex.length,
    savingsPercent: Math.round(((originalLen - regex.length) / originalLen) * 100),
  };
}

/**
 * Factorize by extracting a common suffix.
 * Input: ["огню сопротивлению", "холоду сопротивлению"]
 * Output: "(огню|холоду) сопротивлению"
 */
function factorizeBySuffix(
  words: string[],
  _maxDepth: number,
  maxLength: number
): FactorizationResult | null {
  if (words.length < 2) return null;

  const suffix = longestCommonSuffix(words);
  if (suffix.length === 0) return null;

  const remainders = words.map(w => w.slice(0, w.length - suffix.length));
  const originalFlat = words.join('|');
  const originalLen = originalFlat.length;

  const orPart = remainders.join('|');
  let regex: string;

  if (remainders.every(r => r.length === 0)) {
    regex = suffix;
  } else {
    regex = `(${orPart})${suffix}`;
  }

  if (regex.length > maxLength) return null;

  // Only use suffix factorization if it actually saves characters
  const savings = originalLen - regex.length;
  if (savings <= 0) return null;

  return {
    regex,
    originalFlat,
    savings,
    savingsPercent: Math.round((savings / originalLen) * 100),
  };
}

/**
 * Combined factorization: try prefix + suffix extraction.
 * Input: ["к сопротивлению огню", "к сопротивлению холоду", "к сопротивлению молнии"]
 * Output: "к сопротивлению (огню|холоду|молнии)"
 *
 * This is the most important strategy for PoE2 mods where many mods share
 * a common prefix like "к сопротивлению" or "увеличение".
 */
function factorizeCombined(
  words: string[],
  _maxDepth: number,
  maxLength: number
): FactorizationResult | null {
  if (words.length < 2) return null;

  const prefix = longestCommonPrefix(words);
  if (prefix.length === 0) return null;

  const afterPrefix = words.map(w => w.slice(prefix.length));

  // Now try suffix factorization on the remainders
  const suffix = longestCommonSuffix(afterPrefix.filter(r => r.length > 0));
  if (suffix.length === 0) {
    // No common suffix — fall back to simple prefix
    return factorizeByPrefix(words, _maxDepth, maxLength);
  }

  const middleParts = afterPrefix.map(r => {
    if (r.length === 0) return '';
    return r.slice(0, r.length - suffix.length);
  });

  const originalFlat = words.join('|');
  const originalLen = originalFlat.length;

  // Build: prefix + (m1|m2|m3) + suffix
  const nonEmptyMiddles = middleParts.filter(m => m.length > 0);
  const hasEmptyMiddle = middleParts.some(m => m.length === 0);

  let middleOr: string;
  if (nonEmptyMiddles.length === 0) {
    // All remainders are just prefix + suffix (identical after prefix/suffix removal)
    middleOr = '';
  } else if (hasEmptyMiddle) {
    // Some words are just prefix+suffix, others have middle parts
    middleOr = nonEmptyMiddles.join('|');
    // Make the group optional: prefix(m1|m2)?suffix
    // But this changes semantics — only do it if it saves enough
  } else {
    middleOr = nonEmptyMiddles.join('|');
  }

  let regex: string;
  if (middleOr === '') {
    regex = prefix + suffix;
  } else if (hasEmptyMiddle) {
    // prefix + optional(middle) + suffix
    // This means "prefix suffix" OR "prefix middle suffix"
    regex = `${prefix}(${middleOr})?${suffix}`;
  } else {
    regex = `${prefix}(${middleOr})${suffix}`;
  }

  if (regex.length > maxLength) return null;

  const savings = originalLen - regex.length;
  if (savings <= 0) return null;

  return {
    regex,
    originalFlat,
    savings,
    savingsPercent: Math.round((savings / originalLen) * 100),
  };
}

// ─── Helpers ───

/** Find the longest common prefix of a set of strings */
export function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];

  let prefix = '';
  const first = strings[0];

  for (let i = 0; i < first.length; i++) {
    const ch = first[i];
    if (strings.every(s => s[i] === ch)) {
      prefix += ch;
    } else {
      break;
    }
  }

  return prefix;
}

/** Find the longest common suffix of a set of strings */
export function longestCommonSuffix(strings: string[]): string {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];

  const reversed = strings.map(s => [...s].reverse().join(''));
  const prefix = longestCommonPrefix(reversed);
  return [...prefix].reverse().join('');
}

/**
 * Batch factorize: find the best factorization for each group of words
 * that share a common prefix or suffix.
 *
 * This is the main entry point for the ETL pipeline: given a list of
 * regex strings from a category, it groups them by commonalities and
 * factorizes each group.
 */
export interface BatchFactorizationEntry {
  /** The group of original words */
  words: string[];
  /** The factorized regex */
  factorized: FactorizationResult;
}

export function batchFactorize(
  allRegexes: string[],
  maxDepth: number = 3,
  maxLength: number = 250
): BatchFactorizationEntry[] {
  if (allRegexes.length < 2) return [];

  // Group by common prefix (at least 3 chars shared)
  const groups = new Map<string, string[]>();

  for (const regex of allRegexes) {
    // Try prefixes of increasing length
    let placed = false;
    for (let prefixLen = 5; prefixLen >= 3; prefixLen--) {
      const prefix = regex.slice(0, prefixLen);
      if (prefix.length < 3) continue;

      if (groups.has(prefix)) {
        groups.get(prefix)!.push(regex);
        placed = true;
        break;
      }

      // Check if any existing group's words share this prefix
      for (const [existingPrefix, existingWords] of groups) {
        if (existingWords.some(w => w.startsWith(prefix))) {
          groups.get(existingPrefix)!.push(regex);
          placed = true;
          break;
        }
      }
      if (placed) break;

      // Check if this regex shares a prefix with any other regex
      const siblings = allRegexes.filter(r => r !== regex && r.startsWith(prefix));
      if (siblings.length > 0) {
        groups.set(prefix, [regex]);
        placed = true;
        break;
      }
    }
  }

  // Also try grouping by common suffix
  for (const regex of allRegexes) {
    for (let suffixLen = 5; suffixLen >= 3; suffixLen--) {
      const suffix = regex.slice(-suffixLen);
      if (suffix.length < 3) continue;

      const siblings = allRegexes.filter(r => r !== regex && r.endsWith(suffix));
      if (siblings.length >= 1) {
        const key = `suffix:${suffix}`;
        if (!groups.has(key)) {
          groups.set(key, [regex, ...siblings]);
        }
      }
      break; // Only check longest suffix
    }
  }

  // Factorize each group
  const results: BatchFactorizationEntry[] = [];

  for (const [, words] of groups) {
    if (words.length < 2) continue;

    // Deduplicate
    const unique = [...new Set(words)];
    if (unique.length < 2) continue;

    const factorized = factorize(unique, maxDepth, maxLength);
    if (factorized.savings > 0) {
      results.push({ words: unique, factorized });
    }
  }

  // Sort by savings descending
  results.sort((a, b) => b.factorized.savings - a.factorized.savings);
  return results;
}

/**
 * Compute the "savings potential" of a group of regex strings.
 * This estimates how much the factorized regex would save over the flat OR.
 *
 * Useful for the optimizer to decide whether factorization is worthwhile
 * before actually running it.
 */
export function estimateSavings(words: string[]): number {
  if (words.length < 2) return 0;

  const flatLen = words.reduce((sum, w) => sum + w.length, 0) + (words.length - 1);
  const prefix = longestCommonPrefix(words);
  const suffix = longestCommonSuffix(words);

  let bestEstimate = 0;

  if (prefix.length > 0) {
    const remainders = words.map(w => w.slice(prefix.length));
    const factorizedLen = prefix.length + 2 + // prefix(
      remainders.reduce((sum, r) => sum + r.length, 0) + (remainders.length - 1) + 1; // | + )
    bestEstimate = Math.max(bestEstimate, flatLen - factorizedLen);
  }

  if (suffix.length > 0) {
    const remainders = words.map(w => w.slice(0, w.length - suffix.length));
    const factorizedLen = 1 + // (
      remainders.reduce((sum, r) => sum + r.length, 0) + (remainders.length - 1) + // |
      1 + suffix.length; // )suffix
    bestEstimate = Math.max(bestEstimate, flatLen - factorizedLen);
  }

  return Math.max(0, bestEstimate);
}
