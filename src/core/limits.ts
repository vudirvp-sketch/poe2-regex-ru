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
