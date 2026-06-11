/**
 * Core utilities for compute-regex: template extraction, uniqueness checking,
 * PoE2 validation, and text utilities.
 *
 * Split from compute-regex.ts for focused context when AI agents need to
 * modify specific parts of the regex computation pipeline.
 */
import type { Locale } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';
import { matchQuotedGroup } from '../../src/core/poe2-regex-matcher.js';

// ─── Configuration ───

/** Minimum regex length for meaningful matching in PoE2 search. */
export const MIN_REGEX_LEN_DEFAULT = 5;

/** Per-category strict minimum regex length.
 * Waystone mods often have number ranges in parentheses like "(10—20)%"
 * which PoE2 interprets as grouping, not literal parens. If MIN_REGEX_LEN_STRICT
 * is too high (10), the algorithm can't find a unique substring that avoids
 * parens AND is >= 10 chars. Lowering to 7 allows finding shorter but
 * paren-free regexes that work in PoE2 search.
 *
 * Tablet and jewel-desecrated still use 10 because their suffixes tend to
 * be more distinctive and don't suffer from the (num—num) pattern as much.
 */
export const STRICT_CATEGORIES_MIN_LEN: Record<string, number> = {
  'waystone': 7,
  'waystone-desecrated': 7,
  'tablet': 10,
  'jewel-desecrated': 10,
  'jewel-corrupted': 7,
};

// ─── Template Extraction ───

/**
 * Normalize a rawTextTemplate into a "family key".
 * Replaces ## with # so that templates differing only in ## vs #
 * are treated as the same family.
 * Also normalizes whitespace and strips leading +().
 */
export function normalizeTemplate(template: string): string {
  return template
    .replace(/##/g, '#')   // ## (range) and # (single) → same family
    .replace(/\s+/g, ' ')  // normalize whitespace
    .trim();
}

/**
 * Extract the "text suffix" from a rawTextTemplate.
 * This is the text after the last # or ## placeholder.
 *
 * Examples:
 *   "+##% к сопротивлению огню" → "к сопротивлению огню" (skip "% ")
 *   "+## к силе"                → "к силе"
 *   "Регенерация # здоровья"    → "здоровья"
 *   "# к меткости"              → "к меткости"
 *   "Знак повелителя Бездны"    → "" (no placeholder)
 */
export function extractTemplateSuffix(template: string): string {
  // Find the last # or ## in the template
  // We look for the last occurrence and take everything after it,
  // skipping any immediately following non-letter characters (%, ), spaces)
  //
  // IMPORTANT: When there are multiple ## placeholders (dual-stat mods),
  // we want the suffix AFTER the LAST ## pair, not after a single #.
  // So we search for the last "##" first, then fall back to the last "#"
  // only if there are no "##" pairs.
  let lastHashIdx = template.lastIndexOf('##');
  if (lastHashIdx !== -1) {
    // Found ## pair — take text after the second #
    lastHashIdx += 1; // point to the second # in the pair
  } else {
    // No ## pairs — look for a single #
    lastHashIdx = template.lastIndexOf('#');
  }

  if (lastHashIdx === -1) return '';

  // Take text after the last #, then trim leading non-letter characters
  let suffix = template.substring(lastHashIdx + 1);

  // Skip leading non-letter characters (like "% ", ") ", " ", etc.)
  // but keep Cyrillic and Latin letters
  suffix = suffix.replace(/^[^a-zA-Zа-яА-ЯёЁ]*/, '');

  return suffix.trim();
}

/**
 * Extract the "extended suffix" from a rawTextTemplate.
 * This is the full text AFTER the first # or ## placeholder,
 * with leading non-letter characters removed.
 *
 * Unlike extractTemplateSuffix (which takes text after the LAST #),
 * this takes text after the FIRST #, effectively including
 * any text between the number placeholder and the last suffix.
 *
 * This is used for suffix lengthening when the pure suffix
 * (text after last #) is not unique within the category.
 *
 * Examples:
 *   "##% увеличение урона к атакам" → "увеличение урона к атакам"
 *   "##% увеличение урона от молнии к атакам" → "увеличение урона от молнии к атакам"
 *   "+##% к сопротивлению огню" → "к сопротивлению огню"
 *   "##% повышение брони" → "повышение брони" (same as extractTemplateSuffix)
 */
export function extractExtendedSuffix(template: string): string {
  // Find the first # or ##
  let firstHashIdx = -1;
  for (let i = 0; i < template.length; i++) {
    if (template[i] === '#') {
      firstHashIdx = i;
      break;
    }
  }

  if (firstHashIdx === -1) return '';

  // Take text after the first # (skip consecutive # chars)
  let idx = firstHashIdx;
  while (idx < template.length && template[idx] === '#') idx++;

  let suffix = template.substring(idx);

  // Skip leading non-letter characters (like "% ", ") ", " ", etc.)
  suffix = suffix.replace(/^[^a-zA-Zа-яА-ЯёЁ]*/, '');

  return suffix.trim();
}

/**
 * Extract the "regex prefix" from a rawTextTemplate.
 * ONLY used for dual-number mods (templates with "до" between ## placeholders).
 *
 * Since .* does NOT cross block boundaries (verified in-game Phase 7),
 * cross-mod FP is impossible. Prefix anchoring is only needed to
 * disambiguate which number in a dual-number mod the regex targets.
 *
 * For single-number mods, prefix is always empty — .* within a single
 * block cannot accidentally match a number from a different mod.
 *
 * Examples:
 *   "От ## до ## физического урона" → "От" (dual-number: anchors to first number)
 *   "Добавляет от ## до ## физического урона к атакам" → "Добавляет от"
 *   "Боссы карт даруют на ##% больше опыта" → "" (single-number: no prefix needed)
 *   "##% повышение редкости..." → "" (number at start, no prefix needed)
 */
export function extractTemplatePrefix(template: string): string {
  // Detect dual-number template: contains "до" between # placeholders
  // (Russian "from X to Y" pattern: "От/от ## до ## ...")
  const isDualNumber = /\d*#\s*до\s*#/.test(template) || /#\s*до\s*#/.test(template);

  // Single-number mods don't need prefix — .* can't cross block boundaries
  if (!isDualNumber) return '';

  // Find the first ## or #
  let firstHashIdx = -1;
  for (let i = 0; i < template.length; i++) {
    if (template[i] === '#') {
      firstHashIdx = i;
      break;
    }
  }

  // No placeholder → no prefix
  if (firstHashIdx === -1) return '';

  // If placeholder is at the start → no prefix needed
  if (firstHashIdx === 0) return '';

  // Extract text before the first placeholder
  let prefix = template.substring(0, firstHashIdx).trim();

  // Remove trailing non-letter characters (like '+', '(', etc.)
  prefix = prefix.replace(/[^a-zA-Zа-яА-ЯёЁ]+$/, '');

  // Minimum prefix length for dual-number mods: 2 chars ("От" is valid)
  if (prefix.length < 2) return '';

  // Take the last 2-3 words to keep the prefix short
  const words = prefix.split(/\s+/);
  if (words.length > 3) {
    let result = words.slice(-3).join(' ');
    if (result.length > 25) {
      const twoWords = words.slice(-2).join(' ');
      if (twoWords.length >= 2) result = twoWords;
    }
    return result;
  }

  return prefix;
}

// ─── Uniqueness Checking ───

/**
 * Check if a candidate regex string appears in any token's rawText
 * from a different family.
 *
 * Compound-family overlaps (like "к силе" matching "+(9—15) к силе и интеллекту")
 * are now treated as REAL conflicts — the short suffix must be disambiguated.
 */
export function isSuffixUniqueInCategory(
  candidate: string,
  targetTemplate: string,
  allTokensInCategory: NormalizedMod[],
  locale: Locale
): boolean {
  const lowerCandidate = candidate.toLowerCase();
  const normalizedTargetTemplate = normalizeTemplate(targetTemplate);

  for (const token of allTokensInCategory) {
    // Skip tokens in the same family
    const otherTemplate = token.rawTextTemplate[locale];
    if (normalizeTemplate(otherTemplate) === normalizedTargetTemplate) {
      continue;
    }

    // Compound families: overlap is now treated as a real conflict
    // (previously exempted, but this caused 155 cross-family FP)
    // isCompoundFamily() always returns false now — no exemption

    // Check if the candidate appears in this token's rawText
    const rawLower = token.rawText[locale].toLowerCase();
    if (rawLower.includes(lowerCandidate)) {
      return false;
    }

    // Also check gender forms and template
    const forms = token.genderForms[locale];
    if (forms) {
      const genderKeys = ['ms', 'fs', 'ns', 'mp', 'fp', 'np'] as const;
      for (const key of genderKeys) {
        if (forms[key] && forms[key]!.toLowerCase().includes(lowerCandidate)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Find the shortest unique suffix from a template suffix.
 * Tries trimming from the left to find the shortest string
 * that is still unique within the category.
 *
 * Strategy: start from the full suffix and trim leading words
 * until the suffix is no longer unique.
 */
export function findShortestUniqueSuffix(
  fullSuffix: string,
  targetTemplate: string,
  allTokensInCategory: NormalizedMod[],
  locale: Locale,
  minLen: number = MIN_REGEX_LEN_DEFAULT
): string | null {
  if (fullSuffix.length < minLen) return null;

  // First check if the full suffix is unique
  if (!isSuffixUniqueInCategory(fullSuffix, targetTemplate, allTokensInCategory, locale)) {
    return null; // Even the full suffix conflicts — can't use template approach
  }

  // If the full suffix contains `()`, it's unusable in PoE2 — skip entirely.
  // Template suffixes rarely contain parens, but we guard against it.
  if (containsPoE2Grouping(fullSuffix)) return null;

  // Try trimming from the left (word by word) to find shortest unique suffix
  let bestSuffix = fullSuffix;

  // Split into words and try removing from the left
  const words = fullSuffix.split(/\s+/);
  for (let skipWords = 1; skipWords < words.length; skipWords++) {
    const candidate = words.slice(skipWords).join(' ');
    if (candidate.length < minLen) break;
    // Skip candidates with `()` — PoE2 interprets them as grouping
    if (containsPoE2Grouping(candidate)) continue;

    if (isSuffixUniqueInCategory(candidate, targetTemplate, allTokensInCategory, locale)) {
      bestSuffix = candidate;
    } else {
      // Further trimming makes it non-unique — stop
      break;
    }
  }

  return bestSuffix;
}

// ─── PoE2 Validation ───

/**
 * Check if a string contains `(` or `)` characters that PoE2 interprets
 * as grouping (not literal parentheses). Any regex containing these chars
 * will be misinterpreted by PoE2, causing truncation or unintended grouping.
 *
 * IMPORTANT: This check must be applied BEFORE using a candidate as regex.
 * The `regexMatchesRawText()` validation is NOT sufficient because PoE2's
 * parser truncates at `)` — e.g. "—6) к с" becomes "—6" which still matches
 * the rawText, giving a false-positive validation pass.
 */
export function containsPoE2Grouping(candidate: string): boolean {
  return candidate.includes('(') || candidate.includes(')');
}

/**
 * Verify that a candidate regex actually matches the rawText using PoE2's
 * regex engine. This catches cases where the regex contains metacharacters
 * that cause the match to fail even though the substring exists.
 *
 * NOTE: This function does NOT reliably catch `()` issues because PoE2's
 * parser truncates at `)`, so the truncated regex may still match rawText.
 * Use `containsPoE2Grouping()` as a pre-filter instead.
 */
export function regexMatchesRawText(regex: string, rawText: string): boolean {
  return matchQuotedGroup(regex, rawText.toLowerCase());
}

// ─── Text Utilities ───

/**
 * Get all text representations of a token (rawText + all gender forms + template)
 */
export function getAllTexts(token: NormalizedMod, locale: Locale): string[] {
  const texts: string[] = [];

  texts.push(token.rawText[locale]);

  const forms = token.genderForms[locale];
  if (forms) {
    const genderKeys = ['ms', 'fs', 'ns', 'mp', 'fp', 'np'] as const;
    for (const key of genderKeys) {
      if (forms[key]) {
        texts.push(forms[key]!);
      }
    }
  }

  texts.push(token.rawTextTemplate[locale]);

  return texts.filter(t => t.length > 0);
}

/**
 * Build a set of all substrings (up to maxLen) of all given texts.
 * Used for O(1) exclusion checking in the fallback algorithm.
 */
export function buildSubstringSet(texts: string[], maxLen: number): Set<string> {
  const set = new Set<string>();

  for (const text of texts) {
    const lower = text.toLowerCase();
    for (let i = 0; i < lower.length; i++) {
      for (let len = 1; len <= Math.min(maxLen, lower.length - i); len++) {
        set.add(lower.substring(i, i + len));
      }
    }
  }

  return set;
}
