/**
 * Regex Oracle — Validates PoE2 regex patterns against sets of mod texts.
 *
 * Uses matchQuotedGroup() from poe2-regex-matcher.ts to verify that a
 * candidate regex matches all target mod texts and does NOT match any
 * excluded mod texts. Also checks the 250-character PoE2 limit.
 *
 * This module is the foundation for ALL optimization phases: any
 * optimized regex must pass Oracle validation before being accepted.
 *
 * Usage:
 *   const result = validateRegex(
 *     'сопротивлению (огню|холоду)',
 *     ['к сопротивлению огню', 'к сопротивлению холоду'],
 *     ['к сопротивлению молниям', 'к сопротивлению хаосу'],
 *     allModTexts
 *   );
 *   // result.valid === true if no FP and no FN
 */
import { matchQuotedGroup } from './poe2-regex-matcher';

/** Maximum regex length in PoE2 (str.length, not bytes) */
const POE2_REGEX_LIMIT = 250;

export interface OracleResult {
  /** True if no false positives AND no false negatives AND within limit */
  valid: boolean;
  /** Tokens that should NOT match but do */
  falsePositives: string[];
  /** Tokens that SHOULD match but don't */
  falseNegatives: string[];
  /** Length of the candidate regex string */
  regexLength: number;
  /** True if regex length ≤ 250 */
  withinLimit: boolean;
}

/**
 * Validate a candidate PoE2 regex against target and excluded mod texts.
 *
 * The Oracle checks three conditions:
 * 1. All targetModTexts must be matched by the regex (no false negatives)
 * 2. No excludeModTexts should be matched by the regex (no false positives)
 * 3. The regex must be ≤ 250 characters long
 *
 * Optionally, allModTextsInCategory can be provided for a comprehensive
 * false positive scan — the regex will be checked against every mod text
 * in the category, and any unexpected match will be reported as a FP.
 *
 * @param candidateRegex The regex pattern to validate (without outer quotes)
 * @param targetModTexts Texts that MUST be matched
 * @param excludeModTexts Texts that must NOT be matched
 * @param allModTextsInCategory All mod texts in the category for comprehensive FP check.
 *   If provided, any text NOT in targetModTexts that matches will be reported as FP.
 *   If omitted, only excludeModTexts are checked.
 */
export function validateRegex(
  candidateRegex: string,
  targetModTexts: string[],
  excludeModTexts: string[],
  allModTextsInCategory?: string[]
): OracleResult {
  const regexLength = candidateRegex.length;
  const withinLimit = regexLength <= POE2_REGEX_LIMIT;

  // Check false negatives: targets that should match but don't
  const falseNegatives: string[] = [];
  for (const text of targetModTexts) {
    if (!matchQuotedGroup(candidateRegex, text)) {
      falseNegatives.push(text);
    }
  }

  // Check false positives from explicit exclude list
  const falsePositives: string[] = [];
  for (const text of excludeModTexts) {
    if (matchQuotedGroup(candidateRegex, text)) {
      falsePositives.push(text);
    }
  }

  // Comprehensive FP check against all mods in category
  if (allModTextsInCategory) {
    const targetSet = new Set(targetModTexts.map(t => t.toLowerCase()));
    for (const text of allModTextsInCategory) {
      if (targetSet.has(text.toLowerCase())) continue;
      if (matchQuotedGroup(candidateRegex, text)) {
        // Only add if not already in FP list (avoid duplicates from excludeModTexts)
        if (!falsePositives.some(fp => fp.toLowerCase() === text.toLowerCase())) {
          falsePositives.push(text);
        }
      }
    }
  }

  const valid = falseNegatives.length === 0
    && falsePositives.length === 0
    && withinLimit;

  return {
    valid,
    falsePositives,
    falseNegatives,
    regexLength,
    withinLimit,
  };
}

/**
 * Batch-validate multiple regexes and return a summary report.
 *
 * Useful for the --validate ETL flag: validates every regex in a category
 * against all other mods in the same category.
 *
 * @returns Number of invalid regexes and details per regex
 */
export interface BatchValidationEntry {
  regex: string;
  tokenId: string;
  result: OracleResult;
}

export interface BatchValidationReport {
  totalChecked: number;
  validCount: number;
  invalidCount: number;
  entries: BatchValidationEntry[];
}

export function batchValidate(
  regexes: { tokenId: string; regex: string }[],
  allModTextsByTokenId: Map<string, string>,
  allModTexts: string[]
): BatchValidationReport {
  const entries: BatchValidationEntry[] = [];

  for (const { tokenId, regex } of regexes) {
    if (!regex) continue;

    const targetText = allModTextsByTokenId.get(tokenId) ?? '';
    const targetModTexts = targetText ? [targetText] : [];
    const result = validateRegex(regex, targetModTexts, [], allModTexts);

    entries.push({ regex, tokenId, result });
  }

  const validCount = entries.filter(e => e.result.valid).length;
  const invalidCount = entries.length - validCount;

  return {
    totalChecked: entries.length,
    validCount,
    invalidCount,
    entries,
  };
}
