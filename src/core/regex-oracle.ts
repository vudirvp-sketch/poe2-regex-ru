/**
 * Regex Oracle — Validates PoE2 regex patterns against sets of mod texts.
 *
 * Two validation modes:
 * 1. Flat-text: validateRegex() — uses matchQuotedGroup() against flat strings.
 *    Used by ETL for single-mod validation. .* crosses block boundaries in this mode.
 * 2. Block-based: validateRegexItem() — uses matchPoE2RegexItem() against GameItemText[].
 *    Accurately simulates in-game behavior where .* does NOT cross block boundaries.
 *
 * FP Categorization (Phase 8):
 * - Family-tier FP: regex for token A matches token B's text, and A and B share
 *   the same familyKey. This is "by design" — the user wants ANY tier of a mod.
 * - Cross-family FP: regex for token A matches token B's text, and A and B have
 *   different familyKeys. This is a real bug that needs fixing.
 * - valid is true when there are NO cross-family FP AND no false negatives.
 *
 * Usage:
 *   // Flat-text mode (ETL/Oracle for single mod validation)
 *   const result = validateRegex(
 *     'сопротивлению (огню|холоду)',
 *     ['к сопротивлению огню', 'к сопротивлению холоду'],
 *     ['к сопротивлению молниям', 'к сопротивлению хаосу'],
 *     allModTexts
 *   );
 *
 *   // Block-based mode (accurate in-game simulation)
 *   const result = validateRegexItem(
 *     'к сопротивлению огню',
 *     [{ mods: ['+(10—15)% к сопротивлению огню'] }],
 *     [{ mods: ['+(10—15)% к сопротивлению холоду'] }],
 *     allItems,
 *     'fire_res_tier1',
 *     familyKeyMap
 *   );
 */
import { matchQuotedGroup, matchPoE2RegexItem, hasUnsupportedOptional } from './poe2-regex-matcher';
import type { GameItemText } from './poe2-regex-matcher';

/** Maximum regex length in PoE2 (str.length, not bytes) */
const POE2_REGEX_LIMIT = 250;

export interface OracleResult {
  /** True if no cross-family false positives AND no false negatives AND within limit
   *  AND no unsupported syntax (e.g. `?` outside `(?!…)` — see KI-1) */
  valid: boolean;
  /** All tokens that should NOT match but do (both family-tier and cross-family) */
  falsePositives: string[];
  /** FP from tokens in the same family — "by design", not a real bug */
  familyTierFP: string[];
  /** FP from tokens in a different family — real bugs that need fixing */
  crossFamilyFP: string[];
  /** Tokens that SHOULD match but don't */
  falseNegatives: string[];
  /** Length of the candidate regex string */
  regexLength: number;
  /** True if regex length ≤ 250 */
  withinLimit: boolean;
  /**
   * Unsupported PoE2 syntax detected in the candidate regex (KI-1, closed iter 73).
   * Populated when `hasUnsupportedOptional(regex)` is true — entries describe
   * the offending construct (e.g. `'? optional'`). Empty array when clean.
   * When non-empty, `valid` is forced to `false` regardless of FP/FN status.
   */
  unsupportedSyntax: string[];
}

/**
 * Validate a candidate PoE2 regex against target and excluded mod texts
 * using FLAT-TEXT matching (matchQuotedGroup).
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
 * NOTE: This method uses flat-text matching where .* CAN cross block boundaries.
 * For accurate in-game behavior simulation, use validateRegexItem() instead.
 *
 * @param candidateRegex The regex pattern to validate (without outer quotes)
 * @param targetModTexts Texts that MUST be matched
 * @param excludeModTexts Texts that must NOT be matched
 * @param allModTextsInCategory All mod texts in the category for comprehensive FP check
 * @param familyKeyMap Optional: Map from mod text (lowercase) to familyKey for FP categorization
 * @param targetFamilyKey The familyKey of the target tokens (for FP categorization)
 */
export function validateRegex(
  candidateRegex: string,
  targetModTexts: string[],
  excludeModTexts: string[],
  allModTextsInCategory?: string[],
  familyKeyMap?: Map<string, string>,
  targetFamilyKey?: string,
): OracleResult {
  const regexLength = candidateRegex.length;
  const withinLimit = regexLength <= POE2_REGEX_LIMIT;

  // KI-1 (closed iter 73): `?` outside `(?!…)` is unsupported in-game.
  // Detect once up-front; force `valid = false` if present.
  const unsupportedSyntax: string[] = [];
  if (hasUnsupportedOptional(candidateRegex)) {
    unsupportedSyntax.push('? optional');
  }

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

  // Categorize FP into family-tier vs cross-family
  const { familyTierFP, crossFamilyFP } = categorizeFP(
    falsePositives, familyKeyMap, targetFamilyKey
  );

  // Valid = no cross-family FP + no FN + within limit + no unsupported syntax
  // Family-tier FP are "by design" and don't invalidate the regex
  const valid = falseNegatives.length === 0
    && crossFamilyFP.length === 0
    && withinLimit
    && unsupportedSyntax.length === 0;

  return {
    valid,
    falsePositives,
    familyTierFP,
    crossFamilyFP,
    falseNegatives,
    regexLength,
    withinLimit,
    unsupportedSyntax,
  };
}

/**
 * Validate a candidate PoE2 regex against GameItemText items using
 * BLOCK-BASED matching (matchPoE2RegexItem).
 *
 * This accurately simulates in-game behavior where:
 * - .* does NOT cross block boundaries
 * - AND (space-separated quoted groups) works ACROSS blocks
 * - Negation !X is item-wide
 * - Description text is NOT searchable
 *
 * FP are categorized into:
 * - Family-tier FP: same familyKey as target (by design, not a bug)
 * - Cross-family FP: different familyKey (real bugs)
 *
 * @param candidateRegex The regex pattern to validate.
 *   If the pattern contains quotes, it's used as-is (multi-group regex).
 *   If not, it's wrapped in quotes for single-group matching.
 *   Examples: "к сопротивлению огню" → '"к сопротивлению огню"'
 *             '"огню" "холоду"' → used as-is
 * @param targetItems Items that MUST be matched
 * @param excludeItems Items that must NOT be matched
 * @param allItemsInCategory All items in the category for comprehensive FP check
 * @param targetItemId The ID of the target token (for FP categorization)
 * @param familyKeyById Map from item ID to familyKey for FP categorization
 */
export function validateRegexItem(
  candidateRegex: string,
  targetItems: GameItemText[],
  excludeItems: GameItemText[],
  allItemsInCategory?: { id: string; text: GameItemText }[],
  targetItemId?: string,
  familyKeyById?: Map<string, string>,
): OracleResult {
  const regexLength = candidateRegex.length;
  const withinLimit = regexLength <= POE2_REGEX_LIMIT;

  // KI-1 (closed iter 73): `?` outside `(?!…)` is unsupported in-game.
  const unsupportedSyntax: string[] = [];
  if (hasUnsupportedOptional(candidateRegex)) {
    unsupportedSyntax.push('? optional');
  }

  // Wrap in quotes if not already a quoted-group regex
  const fullRegex = candidateRegex.includes('"')
    ? candidateRegex
    : `"${candidateRegex}"`;

  // Check false negatives: target items that should match but don't
  const falseNegatives: string[] = [];
  for (const item of targetItems) {
    if (!matchPoE2RegexItem(fullRegex, item)) {
      falseNegatives.push(describeItem(item));
    }
  }

  // Check false positives from explicit exclude list
  const falsePositives: string[] = [];
  for (const item of excludeItems) {
    if (matchPoE2RegexItem(fullRegex, item)) {
      falsePositives.push(describeItem(item));
    }
  }

  // Comprehensive FP check against all items in category
  if (allItemsInCategory) {
    const targetSet = new Set(targetItems.map(t => describeItem(t).toLowerCase()));
    for (const { id, text } of allItemsInCategory) {
      const desc = describeItem(text);
      if (targetSet.has(desc.toLowerCase())) continue;
      if (matchPoE2RegexItem(fullRegex, text)) {
        if (!falsePositives.some(fp => fp.toLowerCase() === desc.toLowerCase())) {
          falsePositives.push(desc + ` [${id}]`);
        }
      }
    }
  }

  // Categorize FP into family-tier vs cross-family
  const targetFamilyKey = targetItemId && familyKeyById
    ? familyKeyById.get(targetItemId)
    : undefined;

  const { familyTierFP, crossFamilyFP } = categorizeFPById(
    falsePositives, familyKeyById, targetFamilyKey
  );

  const valid = falseNegatives.length === 0
    && crossFamilyFP.length === 0
    && withinLimit
    && unsupportedSyntax.length === 0;

  return {
    valid,
    falsePositives,
    familyTierFP,
    crossFamilyFP,
    falseNegatives,
    regexLength,
    withinLimit,
    unsupportedSyntax,
  };
}

/**
 * Batch-validate multiple regexes and return a summary report.
 *
 * Uses flat-text matching (matchQuotedGroup) for compatibility with ETL pipeline.
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
  /** Number of entries with cross-family FP (real bugs) */
  crossFamilyFPCount: number;
  /** Number of entries with only family-tier FP (by design) */
  familyTierFPOnlyCount: number;
  entries: BatchValidationEntry[];
}

export function batchValidate(
  regexes: { tokenId: string; regex: string }[],
  allModTextsByTokenId: Map<string, string>,
  allModTexts: string[],
  familyKeyMap?: Map<string, string>,
  familyKeyByTokenId?: Map<string, string>,
): BatchValidationReport {
  const entries: BatchValidationEntry[] = [];

  for (const { tokenId, regex } of regexes) {
    if (!regex) continue;

    const targetText = allModTextsByTokenId.get(tokenId) ?? '';
    const targetModTexts = targetText ? [targetText] : [];
    const targetFamilyKey = familyKeyByTokenId?.get(tokenId);

    const result = validateRegex(
      regex, targetModTexts, [], allModTexts, familyKeyMap, targetFamilyKey
    );

    entries.push({ regex, tokenId, result });
  }

  const validCount = entries.filter(e => e.result.valid).length;
  const crossFamilyFPCount = entries.filter(e => e.result.crossFamilyFP.length > 0).length;
  const familyTierFPOnlyCount = entries.filter(
    e => e.result.crossFamilyFP.length === 0 && e.result.familyTierFP.length > 0
  ).length;
  const invalidCount = entries.length - validCount;

  return {
    totalChecked: entries.length,
    validCount,
    invalidCount,
    crossFamilyFPCount,
    familyTierFPOnlyCount,
    entries,
  };
}

/**
 * Batch-validate multiple regexes against GameItemText items using block-based matching.
 *
 * Uses matchPoE2RegexItem() for accurate in-game behavior simulation.
 * FP are categorized into family-tier (by design) vs cross-family (real bugs).
 */
export interface BatchValidationItemEntry {
  regex: string;
  tokenId: string;
  result: OracleResult;
}

export interface BatchValidationItemReport {
  totalChecked: number;
  validCount: number;
  invalidCount: number;
  crossFamilyFPCount: number;
  familyTierFPOnlyCount: number;
  entries: BatchValidationItemEntry[];
}

export function batchValidateItem(
  regexes: { tokenId: string; regex: string }[],
  allItemsByTokenId: Map<string, { id: string; text: GameItemText }>,
  allItems: { id: string; text: GameItemText }[],
  familyKeyById?: Map<string, string>,
): BatchValidationItemReport {
  const entries: BatchValidationItemEntry[] = [];

  for (const { tokenId, regex } of regexes) {
    if (!regex) continue;

    const targetEntry = allItemsByTokenId.get(tokenId);
    const targetItems = targetEntry ? [targetEntry.text] : [];

    const result = validateRegexItem(
      regex,
      targetItems,
      [],
      allItems,
      tokenId,
      familyKeyById,
    );

    entries.push({ regex, tokenId, result });
  }

  const validCount = entries.filter(e => e.result.valid).length;
  const crossFamilyFPCount = entries.filter(e => e.result.crossFamilyFP.length > 0).length;
  const familyTierFPOnlyCount = entries.filter(
    e => e.result.crossFamilyFP.length === 0 && e.result.familyTierFP.length > 0
  ).length;
  const invalidCount = entries.length - validCount;

  return {
    totalChecked: entries.length,
    validCount,
    invalidCount,
    crossFamilyFPCount,
    familyTierFPOnlyCount,
    entries,
  };
}

// ─── Internal helpers ───

/**
 * Categorize false positives into family-tier vs cross-family using
 * a text→familyKey map.
 */
function categorizeFP(
  falsePositives: string[],
  familyKeyMap?: Map<string, string>,
  targetFamilyKey?: string,
): { familyTierFP: string[]; crossFamilyFP: string[] } {
  const familyTierFP: string[] = [];
  const crossFamilyFP: string[] = [];

  // Without familyKey info, all FP are treated as cross-family (conservative)
  if (!familyKeyMap || targetFamilyKey === undefined) {
    return { familyTierFP: [], crossFamilyFP: [...falsePositives] };
  }

  for (const fp of falsePositives) {
    const fpKey = familyKeyMap.get(fp.toLowerCase());
    if (fpKey && fpKey === targetFamilyKey) {
      familyTierFP.push(fp);
    } else {
      crossFamilyFP.push(fp);
    }
  }

  return { familyTierFP, crossFamilyFP };
}

/**
 * Categorize false positives into family-tier vs cross-family using
 * an ID→familyKey map. FP strings may contain [id] suffix from
 * validateRegexItem().
 */
function categorizeFPById(
  falsePositives: string[],
  familyKeyById?: Map<string, string>,
  targetFamilyKey?: string,
): { familyTierFP: string[]; crossFamilyFP: string[] } {
  const familyTierFP: string[] = [];
  const crossFamilyFP: string[] = [];

  if (!familyKeyById || targetFamilyKey === undefined) {
    return { familyTierFP: [], crossFamilyFP: [...falsePositives] };
  }

  for (const fp of falsePositives) {
    // Try to extract [id] from FP string (format: "description [id]")
    const idMatch = fp.match(/\[([^\]]+)\]$/);
    const id = idMatch ? idMatch[1] : null;
    const fpKey = id ? familyKeyById.get(id) : undefined;

    if (fpKey && fpKey === targetFamilyKey) {
      familyTierFP.push(fp);
    } else {
      crossFamilyFP.push(fp);
    }
  }

  return { familyTierFP, crossFamilyFP };
}

/**
 * Create a human-readable description of a GameItemText for error messages.
 */
function describeItem(item: GameItemText): string {
  const parts: string[] = [];
  if (item.name) parts.push(item.name);
  if (item.type) parts.push(item.type);
  if (item.mods) parts.push(...item.mods);
  if (item.implicits) parts.push(...item.implicits);
  if (item.properties) parts.push(...item.properties);
  if (item.additional) parts.push(...item.additional);
  return parts.join(' | ');
}
