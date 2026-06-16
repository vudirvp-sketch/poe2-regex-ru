export const MAX_CHARS = 250;

export function getCharCount(regex: string): number {
  return regex.length;  // NOT TextEncoder! Game counts characters.
}

export function isOverflow(regex: string): boolean {
  return regex.length > MAX_CHARS;
}

export type HealthLevel = 'green' | 'yellow' | 'red';

export function getCharHealth(regex: string): {
  count: number;
  max: number;
  level: HealthLevel;
  percentage: number;
} {
  const count = regex.length;
  const percentage = (count / MAX_CHARS) * 100;
  let level: HealthLevel;
  if (count <= 200) level = 'green';
  else if (count <= 240) level = 'yellow';
  else level = 'red';
  return { count, max: MAX_CHARS, level, percentage };
}

/**
 * Estimate the compiled regex length for N selected mods.
 *
 * When a user selects 6+ mods, each mod contributes:
 * - Its regex length (from token.regex[locale])
 * - Overhead: quotes (2 chars) + separator spaces + OR pipes + AND spaces
 * - For ranged mods: additional number regex overhead (~20 chars per range)
 * - For mods with context: additional context string + quotes + separator
 * - For mods with excludes: exclude patterns + quotes + separator
 *
 * This estimate helps the optimizer prefer shorter regex alternatives
 * when the total is approaching the 250-char limit.
 *
 * @param regexes Array of individual regex strings
 * @param hasRange Whether numeric ranges are involved (adds ~20 chars per range)
 * @param contexts Array of prefix context strings (one per regex, empty if none)
 * @param excludes Array of exclude pattern arrays (one per regex, empty if none)
 * @returns Estimated total compiled regex length
 */
export function estimateMultiModLength(
  regexes: string[],
  hasRange: boolean = false,
  contexts: string[] = [],
  excludes: string[][] = [],
): number {
  let total = 0;

  for (let i = 0; i < regexes.length; i++) {
    const regex = regexes[i];
    const context = contexts[i] || '';
    const exc = excludes[i] || [];

    // Base: quoted regex "regex"
    let modLen = regex.length + 2;

    // Context: "context" "regex" (AND across blocks)
    if (context) {
      modLen += context.length + 3; // "context" + space separator
    }

    // Excludes: !"exc1|exc2" (inside same quoted group or separate)
    for (const ex of exc) {
      modLen += ex.length + 3; // "!" + quoted exclude + space
    }

    // Range overhead: number regex pattern
    if (hasRange) {
      modLen += 15; // approximate: [0-9]+ or (n1|n2|...) + .* + suffix
    }

    total += modLen;
  }

  // Add separators between mods
  // AND mode: mods are ANDed with spaces between quoted groups
  // OR mode within same family: | between alternatives
  // Conservative estimate: space between each mod
  total += Math.max(0, regexes.length - 1);

  return total;
}

/**
 * Check if adding another mod would likely exceed the 250-char budget.
 * Useful for UI feedback and optimizer decision-making.
 *
 * @param currentLength Current compiled regex length
 * @param additionalModRegex The regex of the mod being added
 * @param hasContext Whether the mod has prefix context
 * @param contextLength Length of the prefix context string
 * @param excludesCount Number of exclude patterns
 * @param totalExcludeLen Total length of all exclude patterns
 * @returns Whether adding this mod would likely cause overflow
 */
export function wouldExceedBudget(
  currentLength: number,
  additionalModRegex: string,
  hasContext: boolean = false,
  contextLength: number = 0,
  excludesCount: number = 0,
  totalExcludeLen: number = 0,
): boolean {
  // Estimate additional length
  let additional = additionalModRegex.length + 2; // quotes
  if (hasContext) {
    additional += contextLength + 3; // "context" + space
  }
  additional += totalExcludeLen + excludesCount * 3; // excludes
  additional += 1; // separator

  return (currentLength + additional) > MAX_CHARS;
}

// ─── Over-Limit Split (iter 50 — Known Issue #5) ──────────────────────

/**
 * Split a top-level `|` alternation at depth-0 boundaries.
 *
 * Scans the string character by character, tracking `()` and `[]` depth.
 * Returns an array of alternative strings (without the `|` separators).
 *
 * If there is no top-level `|`, returns `[regex]` (single-element array).
 * Handles escape sequences (`\|` is not a separator, `\\` is an escaped backslash).
 */
function splitTopLevelAlternations(regex: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;

  while (i < regex.length) {
    const ch = regex[i];

    // Character class [...]
    if (ch === '[') {
      current += ch;
      i++;
      while (i < regex.length && regex[i] !== ']') {
        if (regex[i] === '\\') { current += regex[i]; i++; }
        current += regex[i];
        i++;
      }
      if (i < regex.length) { current += regex[i]; i++; } // ]
      continue;
    }

    // Escape sequence
    if (ch === '\\') {
      current += ch;
      i++;
      if (i < regex.length) { current += regex[i]; i++; }
      continue;
    }

    // Track grouping depth
    if (ch === '(') { depth++; current += ch; i++; continue; }
    if (ch === ')') { depth--; current += ch; i++; continue; }

    // Top-level `|` — split here
    if (ch === '|' && depth === 0) {
      parts.push(current);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  if (current.length > 0 || parts.length > 0) {
    parts.push(current);
  }

  return parts.length > 0 ? parts : [regex];
}

/**
 * Group alternatives into chunks that each fit within `limit` chars
 * (including the 2 quote chars added by the compiler).
 *
 * Uses a greedy first-fit approach: adds alternatives one by one
 * to the current chunk until adding the next would exceed the limit,
 * then starts a new chunk.
 *
 * Each chunk's compiled form is `"alt1|alt2|..."` — that's
 * alt lengths + (N-1) pipe chars + 2 quote chars.
 *
 * If a single alternative exceeds `limit - 2` chars, it gets its own
 * chunk (unavoidable overflow — no way to split a single alternative).
 */
function groupAlternativesByBudget(
  alternatives: string[],
  limit: number = MAX_CHARS
): string[][] {
  if (alternatives.length === 0) return [];

  const groups: string[][] = [];
  let currentGroup: string[] = [];
  // Current group compiled length: sum of alt lengths + (N-1) pipes + 2 quotes
  let currentLength = 2; // start with 2 quotes

  for (const alt of alternatives) {
    const altLength = alt.length;
    const pipeIfNeeded = currentGroup.length > 0 ? 1 : 0;
    const newLength = currentLength + pipeIfNeeded + altLength;

    if (newLength <= limit) {
      // Fits in current group
      currentGroup.push(alt);
      currentLength = newLength;
    } else {
      // Start a new group
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [alt];
      currentLength = 2 + altLength; // quotes + this alternative
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Split an over-limit compiled regex into multiple parts that each
 * fit within the PoE2 250-char limit.
 *
 * Strategy:
 * 1. If the regex ≤ MAX_CHARS, return it as-is: `[regex]`
 * 2. If > MAX_CHARS and contains top-level `|`, split at `|` boundaries
 *    and group alternatives into chunks that each fit within MAX_CHARS
 * 3. If > MAX_CHARS but NO top-level `|`, return as-is (unavoidable overflow)
 *
 * The compiled regex format is `"alt1|alt2|alt3"` — quotes are part of the
 * string passed to this function. We account for the 2 quote chars in each
 * split part.
 *
 * Each returned string is the inner content (without quotes) — the caller
 * should wrap each part in quotes when displaying/copying.
 *
 * @param compiledRegex The full compiled regex string (with outer quotes)
 * @returns Array of regex content strings (without outer quotes), each ≤ MAX_CHARS - 2
 */
export function splitOverLimitRegex(compiledRegex: string): string[] {
  // If within limit, return as-is (strip outer quotes for consistency)
  if (compiledRegex.length <= MAX_CHARS) {
    const inner = compiledRegex.startsWith('"') && compiledRegex.endsWith('"')
      ? compiledRegex.slice(1, -1)
      : compiledRegex;
    return [inner];
  }

  // Strip outer quotes if present
  let inner = compiledRegex;
  if (inner.startsWith('"') && inner.endsWith('"')) {
    inner = inner.slice(1, -1);
  }

  // Split at top-level `|` boundaries
  const alternatives = splitTopLevelAlternations(inner);

  // If no top-level `|`, can't split further — return as-is (unavoidable overflow)
  if (alternatives.length <= 1) {
    return [inner];
  }

  // Group alternatives into budget-fitting chunks
  const groups = groupAlternativesByBudget(alternatives, MAX_CHARS);

  // Join each group with `|` to form the split regex parts
  return groups.map(group => group.join('|'));
}
