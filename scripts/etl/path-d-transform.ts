/**
 * Path D Transformation — convert DP-factorized regexes to PoE2-working form.
 *
 * BACKGROUND (iter 38-39):
 * PoE2's regex engine does NOT parse `(...)` groups with multi-word `|` inside
 * a quoted group `"..."`. Tests 15-17 confirmed: `"prefix (A|B|C)"` matches
 * only the prefix broadly, ignoring the alternation. This breaks 94% of
 * opt-table entries in jewels, 46% in amulets, etc.
 *
 * Path D replaces `prefix(A|B|C)` with `prefix.*A|prefix.*B|prefix.*C` —
 * a single quoted group with top-level `|` and `.*` bridges. Verified
 * working in-game (iter 38: 2 alt; iter 39: 3/4 alt + AND-combination).
 *
 * ALGORITHM:
 * Recursively flatten `(...)` groups (containing `|`) into top-level `|`
 * alternation. For each group `prefix(alt1|alt2|...)suffix`:
 *   - Cartesian-product with suffix's own alternatives (if suffix has groups)
 *   - Each combination: prefix + ".*" + alt + ".*" + suffix (omitting ".*"
 *     when prefix/alt/suffix is empty, trimming boundary whitespace)
 *   - Join all combinations with top-level "|"
 *
 * Character classes `[её]` are PRESERVED (not treated as groups).
 * Single-alt groups like `pack(s)` (no `|` inside) are SKIPPED — they are
 * not produced by dp-factorizer and represent literal text from game data.
 * Optional groups `(ь|)` flatten to top-level alts (empty alt → just prefix).
 *
 * POE2 CHAR LIMIT (iter 41):
 * The game silently rejects single regexes longer than ~250 chars. After Path D
 * transformation, some entries with many alternatives may exceed this limit.
 * Use `findOverLimitEntries()` to detect such entries — current policy is
 * diagnostic-only (warn), not destructive (drop/split).
 *
 * SAFETY:
 * - `.*` bridges are MORE permissive than literal concat. This is acceptable
 *   because prefix and alt are typically word stems (possibly truncated)
 *   and the game text may have numbers/words between them.
 * - Empty alt (e.g., from `(ь|)`) yields literal concat (no `.*`), preserving
 *   the "optional" semantic.
 */

/**
 * Check if a regex string contains a `(...)` group with `|` inside.
 * This is the trigger for Path D transformation.
 *
 * Returns false for:
 * - Plain literals (no parens)
 * - Character classes only `[её]` (no parens)
 * - Single-alt groups like `pack(s)` (parens but no `|` inside)
 */
export function hasPathDGroup(regex: string): boolean {
  let depth = 0;
  let i = 0;
  while (i < regex.length) {
    const ch = regex[i];

    // Skip character classes [...]
    if (ch === '[') {
      i++;
      while (i < regex.length && regex[i] !== ']') {
        if (regex[i] === '\\') i++;
        i++;
      }
      i++; // skip ]
      continue;
    }

    // Track paren depth
    if (ch === '(') depth++;
    else if (ch === ')') depth--;

    // Detect | inside parens
    if (ch === '|' && depth > 0) return true;

    // Skip escaped chars
    if (ch === '\\') i++;

    i++;
  }
  return false;
}

/**
 * Find the first group with `|` inside (alternation group).
 * Skips single-alt groups like `pack(s)` (no `|`).
 * Skips character classes `[...]`.
 *
 * Returns { prefix, groupContents, suffix } or null if no alternation group.
 */
function findFirstAlternationGroup(regex: string): {
  prefix: string;
  groupContents: string;
  suffix: string;
} | null {
  let i = 0;

  while (i < regex.length) {
    const ch = regex[i];

    // Skip character classes [...]
    if (ch === '[') {
      i++;
      while (i < regex.length && regex[i] !== ']') {
        if (regex[i] === '\\') i++;
        i++;
      }
      i++; // skip ]
      continue;
    }

    // Found a group start
    if (ch === '(') {
      // Find matching close paren
      let depth = 1;
      let j = i + 1;
      while (j < regex.length && depth > 0) {
        const c = regex[j];

        // Skip nested char classes
        if (c === '[') {
          j++;
          while (j < regex.length && regex[j] !== ']') {
            if (regex[j] === '\\') j++;
            j++;
          }
          j++; // skip ]
          continue;
        }

        if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (c === '\\') {
          j++; // skip escaped char
        }

        if (depth > 0) j++;
      }

      if (depth !== 0) {
        // Unbalanced parens — skip this group
        i++;
        continue;
      }

      const groupContents = regex.slice(i + 1, j);

      // Check if this group has top-level | (alternation)
      const alts = splitTopLevelAlternation(groupContents);
      if (alts.length < 2) {
        // Single-alt group: skip and continue searching past this group
        i = j + 1;
        continue;
      }

      const prefix = regex.slice(0, i);
      const suffix = regex.slice(j + 1);
      return { prefix, groupContents, suffix };
    }

    // Skip escaped chars
    if (ch === '\\') i++;
    i++;
  }

  return null;
}

/**
 * Split a regex string by top-level `|` (not inside parens or char classes).
 *
 * Trailing empty alts are PRESERVED:
 *   'A|' → ['A', '']      (two alts: 'A' and empty)
 *   'A'  → ['A']           (one alt: 'A')
 *   '|'  → ['', '']        (two empty alts)
 *   ''   → ['']             (one empty alt — single-alt, will be skipped)
 */
function splitTopLevelAlternation(regex: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;

  while (i < regex.length) {
    const ch = regex[i];

    // Skip character classes [...]
    if (ch === '[') {
      current += ch;
      i++;
      while (i < regex.length && regex[i] !== ']') {
        current += regex[i];
        if (regex[i] === '\\') {
          i++;
          if (i < regex.length) current += regex[i];
        }
        i++;
      }
      if (i < regex.length) {
        current += regex[i]; // ]
        i++;
      }
      continue;
    }

    if (ch === '(') depth++;
    else if (ch === ')') depth--;

    if (ch === '|' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }

    if (ch === '\\') {
      i++;
      if (i < regex.length) current += regex[i];
    }

    i++;
  }

  // Always push the final segment.
  // - If a top-level `|` was seen, the trailing segment (even if empty) is a valid alt.
  // - If no top-level `|`, the entire regex is one alt.
  // - If regex is empty, this pushes '' (single empty alt).
  parts.push(current);

  return parts;
}

/**
 * Path D transformation: recursively flatten `(...)` alternation groups
 * into top-level `|`.
 *
 * Returns the transformed regex string.
 *
 * Examples:
 *   prefix(A|B|C)                  → prefix.*A|prefix.*B|prefix.*C
 *   (A|B|C)suffix                  → A.*suffix|B.*suffix|C.*suffix
 *   prefix(A|B|C)suffix            → prefix.*A.*suffix|prefix.*B.*suffix|prefix.*C.*suffix
 *   prefix(A|B(m|n))               → prefix.*A|prefix.*B.*m|prefix.*B.*n
 *   карт(ь|)                       → карт.*ь|карт
 *   pack(s)                        → pack(s)  (unchanged, single-alt group)
 *   [её]                           → [её]  (unchanged, char class)
 *   flat                           → flat  (unchanged, no group)
 */
export function pathDTransform(regex: string): string {
  // No alternation group → return as-is
  const parsed = findFirstAlternationGroup(regex);
  if (!parsed) return regex;

  const { prefix, groupContents, suffix } = parsed;

  // Split group contents by top-level |
  const rawAlts = splitTopLevelAlternation(groupContents);

  // Recursively transform each alt (might have nested alternation groups)
  const transformedAlts: string[] = [];
  for (const alt of rawAlts) {
    const transformedAlt = pathDTransform(alt);
    // transformedAlt might itself contain top-level | (from nested Path D)
    const altParts = splitTopLevelAlternation(transformedAlt);
    transformedAlts.push(...altParts);
  }

  // Recursively transform suffix (might have more alternation groups)
  const transformedSuffix = pathDTransform(suffix);
  const suffixParts = splitTopLevelAlternation(transformedSuffix);

  // Cartesian product: each (alt, suffix) combination
  const result: string[] = [];

  for (const alt of transformedAlts) {
    for (const suf of suffixParts) {
      const combination = combineWithBridges(prefix, alt, suf);
      result.push(combination);
    }
  }

  return result.join('|');
}

/**
 * PoE2 hard limit on a single regex string length.
 * Discovered iter 41: D5-1 v1 (262 chars) and D5-2 v1 (327 chars) were both
 * silently rejected by the game. Entries ≤250 chars work reliably.
 */
export const POE2_REGEX_CHAR_LIMIT = 250;

/**
 * Identify optimization-table entries whose `regex[locale]` exceeds the PoE2
 * character limit.
 *
 * Used as a diagnostic helper — does NOT modify the table. The caller decides
 * what to do with the result (log a warning, drop the entry, split it, etc.).
 *
 * @param table Optimization table: `{ [key]: { regex: { [locale]: string }, ... } }`
 * @param locale Locale key to inspect (default `'ru'`)
 * @param limit  Char limit (default `POE2_REGEX_CHAR_LIMIT = 250`)
 * @returns Array of `{ key, regex, length }` for entries exceeding the limit,
 *          sorted by length descending. Empty array if all entries are within
 *          the limit.
 */
export function findOverLimitEntries<
  T extends { regex: Record<string, string> },
  K extends string = string
>(
  table: Record<K, T>,
  locale: string = 'ru',
  limit: number = POE2_REGEX_CHAR_LIMIT
): Array<{ key: K; regex: string; length: number }> {
  const over: Array<{ key: K; regex: string; length: number }> = [];
  for (const key in table) {
    const entry = table[key];
    if (!entry) continue;
    const regex = entry.regex?.[locale];
    if (typeof regex !== 'string' || regex.length === 0) continue;
    if (regex.length > limit) {
      over.push({ key, regex, length: regex.length });
    }
  }
  over.sort((a, b) => b.length - a.length);
  return over;
}

/**
 * Combine prefix, alt, suffix with `.*` bridges.
 *
 * Rules:
 * - If alt is empty: literal concat of prefix + suffix (no `.*`, no trimming).
 *   This preserves the "optional" semantic of `(alt|)` — empty alt means
 *   "nothing between prefix and suffix", so they concat directly.
 * - If alt is non-empty: use `.*` bridges between prefix→alt and alt→suffix.
 *   Boundary whitespace is trimmed because `.*` already matches whitespace.
 */
function combineWithBridges(prefix: string, alt: string, suffix: string): string {
  if (alt.length === 0) {
    // Empty alt: literal concat, preserve original (no `.*`, no trimming)
    return prefix + suffix;
  }

  // Alt is non-empty: use `.*` bridges, trim boundary whitespace
  let result = alt;
  if (prefix.length > 0) {
    const trimmedPrefix = prefix.replace(/\s+$/, '');
    result = `${trimmedPrefix}.*${alt}`;
  }

  if (suffix.length > 0) {
    const trimmedSuffix = suffix.replace(/^\s+/, '');
    result = `${result}.*${trimmedSuffix}`;
  }

  return result;
}
