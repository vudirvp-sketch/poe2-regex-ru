/**
 * Compute minimal unique substrings for each token in a category.
 *
 * ALGORITHM v2 — Template-family approach:
 *
 * 1. For tokens with number placeholders (## or # in rawTextTemplate):
 *    - Group tokens by rawTextTemplate → "mod family" (e.g., all fire res tiers)
 *    - Extract the "text suffix" from template (text after last ##/#)
 *    - Find the shortest unique suffix that distinguishes this family from others
 *    - All tokens in the same family share the same regex (the family suffix)
 *    - This produces MUCH shorter regexes than matching specific number ranges
 *
 * 2. For tokens without number placeholders (literal mods):
 *    - Use substring search on rawText (original algorithm)
 *
 * 3. Apply yofication optimization where applicable
 *
 * Example:
 *   Token: +(11—15)% к сопротивлению огню
 *   Template: +##% к сопротивлению огню
 *   Family suffix: к сопротивлению огню  (20 chars)
 *   Old regex: +(11—15)% к сопротивлению огню  (31 chars!)
 *   New regex: к сопротивлению огню  (20 chars, matches ANY tier)
 *
 * Key insight: When a user clicks "fire resistance", they want ANY tier.
 * The family suffix is the shortest regex that matches all tiers.
 */
import type { Locale } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';

export interface RegexResult {
  regex: string;
  hasYofication: boolean;
  yoficationPositions: number[];
  /** Family key: normalized rawTextTemplate for grouping mods of the same family */
  familyKey: string;
  /** Regex prefix: text before the first ##/# placeholder, used to anchor
   *  numeric regex to the correct mod line. Prevents .* from crossing mod boundaries.
   *  Empty string if number is at start of template or prefix is too short. */
  regexPrefix: string;
  /** Whether the template has multiple ##/# placeholders (dual-number or dual-stat mods).
   *  Used downstream to determine correct range slot for numeric filtering. */
  hasMultiPlaceholder: boolean;
}

/** Minimum regex length for meaningful matching in PoE2 search.
 * Waystone and tablet mods tend to have short, generic suffixes that can
 * match unintended text in-game. Using MIN=5 for these categories
 * forces longer, more specific regexes.
 */
const MIN_REGEX_LEN_DEFAULT = 5;
const MIN_REGEX_LEN_STRICT = 5;

/** Categories that require stricter minimum regex length */
const STRICT_CATEGORIES = new Set(['waystone', 'waystone-desecrated', 'tablet']);

/**
 * Normalize a rawTextTemplate into a "family key".
 * Replaces ## with # so that templates differing only in ## vs #
 * are treated as the same family.
 * Also normalizes whitespace and strips leading +().
 */
function normalizeTemplate(template: string): string {
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
function extractTemplateSuffix(template: string): string {
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
function extractExtendedSuffix(template: string): string {
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
 * This is the text BEFORE the first ## or # placeholder,
 * trimmed to the last 2-3 words.
 *
 * The prefix anchors the number regex to the correct mod line,
 * preventing .* from crossing mod boundaries.
 *
 * For dual-number mods (templates with "до" between ## placeholders,
 * e.g., "От ## до ## урона"), even short prefixes like "От" are
 * preserved because they anchor the number to the correct position.
 *
 * Examples:
 *   "Боссы карт даруют на ##% больше опыта" → "даруют на" (last 2 words before ##)
 *   "##% повышение редкости..." → "" (number at start, no prefix needed)
 *   "От ## до ## физического урона" → "От" (short but critical for dual-number)
 *   "Добавляет от ## до ## физического урона к атакам" → "Добавляет от"
 */
function extractTemplatePrefix(template: string): string {
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

  // Detect dual-number template: contains "до" between ## placeholders
  // (Russian "from X to Y" pattern: "От/от ## до ## ...")
  const isDualNumber = /\d*#\s*до\s*#/.test(template) || /#\s*до\s*#/.test(template);

  // Minimum prefix length: 2 for dual-number mods (short prefixes like "От"
  // are critical for anchoring), 5 for single-number mods
  const minPrefixLen = isDualNumber ? 2 : 5;
  if (prefix.length < minPrefixLen) return '';

  // Take the last 2-3 words to keep the prefix short
  // This is a balance between uniqueness and regex length
  const words = prefix.split(/\s+/);
  if (words.length > 3) {
    // Take last 3 words (but ensure minimum 5 chars)
    let result = words.slice(-3).join(' ');
    // If still too long, try 2 words
    if (result.length > 25) {
      const twoWords = words.slice(-2).join(' ');
      if (twoWords.length >= 5) result = twoWords;
    }
    return result;
  }

  return prefix;
}

/**
 * Check if two templates represent a "compound" relationship.
 * A compound family is one where the other template extends our template
 * with additional text (e.g., "+# к силе" vs "+# к силе и интеллекту").
 *
 * In PoE2 search, "к силе" matches items with pure strength AND compound mods.
 * This is usually DESIRABLE — the user wants strength, compound mods have it.
 * So we don't treat compound-family conflicts as real conflicts.
 */
function isCompoundFamily(ourTemplate: string, otherTemplate: string): boolean {
  const ourNorm = normalizeTemplate(ourTemplate);
  const otherNorm = normalizeTemplate(otherTemplate);

  // If the other template starts with our template pattern, it's a compound
  // e.g., "+# к силе" is a prefix of "+# к силе и интеллекту"
  if (otherNorm.length > ourNorm.length && otherNorm.startsWith(ourNorm)) {
    return true;
  }

  // Also check the other direction: our template extends another
  // e.g., "+# к силе и интеллекту" extends "+# к силе"
  if (ourNorm.length > otherNorm.length && ourNorm.startsWith(otherNorm)) {
    return true;
  }

  return false;
}

/**
 * Check if a candidate regex string appears in any token's rawText
 * from a genuinely different family (not a compound extension).
 *
 * Compound families (like "к силе" vs "к силе и интеллекту") are NOT
 * treated as conflicts — the shorter suffix matching the longer is OK.
 */
function isSuffixUniqueInCategory(
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

    // Skip compound families — their overlap is intentional
    if (isCompoundFamily(targetTemplate, otherTemplate)) {
      continue;
    }

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
function findShortestUniqueSuffix(
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

  // Try trimming from the left (word by word) to find shortest unique suffix
  let bestSuffix = fullSuffix;

  // Split into words and try removing from the left
  const words = fullSuffix.split(/\s+/);
  for (let skipWords = 1; skipWords < words.length; skipWords++) {
    const candidate = words.slice(skipWords).join(' ');
    if (candidate.length < minLen) break;

    if (isSuffixUniqueInCategory(candidate, targetTemplate, allTokensInCategory, locale)) {
      bestSuffix = candidate;
    } else {
      // Further trimming makes it non-unique — stop
      break;
    }
  }

  return bestSuffix;
}

/**
 * NEW ALGORITHM v2: Compute minimal unique substring for a target token.
 *
 * Priority:
 * 1. Template-family suffix (for tokens with ##/# in template)
 * 2. Substring search fallback (for literal tokens without placeholders)
 */
export function computeMinimalUniqueSubstring(
  targetToken: NormalizedMod,
  allTokensInCategory: NormalizedMod[],
  locale: Locale = 'ru',
  minRegexLen: number = MIN_REGEX_LEN_DEFAULT
): RegexResult {
  const rawText = targetToken.rawText[locale];
  const template = targetToken.rawTextTemplate[locale];
  const familyKey = normalizeTemplate(template);

  // Determine min regex length based on category
  const effectiveMinLen = STRICT_CATEGORIES.has(targetToken.category)
    ? Math.max(minRegexLen, MIN_REGEX_LEN_STRICT)
    : minRegexLen;

  // Edge case: empty rawText
  if (!rawText || rawText.trim().length === 0) {
    return { regex: '', hasYofication: false, yoficationPositions: [], familyKey, regexPrefix: '', hasMultiPlaceholder: false };
  }

  // Detect multi-placeholder template (dual-number or dual-stat mods)
  const placeholderCount = (template.match(/#+/g) || []).length;
  const hasMultiPlaceholder = placeholderCount >= 2;

  // ═══════════════════════════════════════════════════
  // Strategy 1: Template-family suffix
  // ═══════════════════════════════════════════════════
  const suffix = extractTemplateSuffix(template);

  // Extract prefix for numeric RANGE nodes (text before first ##/#)
  const regexPrefix = extractTemplatePrefix(template);

  if (suffix.length >= effectiveMinLen) {
    const bestSuffix = findShortestUniqueSuffix(
      suffix, template, allTokensInCategory, locale, effectiveMinLen
    );

    if (bestSuffix) {
      // Check yofication on the suffix
      const { hasYofication, yoficationPositions } = checkYofication(
        bestSuffix, targetToken, allTokensInCategory, locale
      );

      return { regex: bestSuffix, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder };
    }

    // ═══════════════════════════════════════════════════
    // Strategy 1b: Suffix lengthening for non-unique suffixes
    // ═══════════════════════════════════════════════════
    // When the pure suffix (text after last #) is NOT unique within
    // the category (e.g., "к атакам" appears in "урона к атакам",
    // "молнии к атакам", "холода к атакам"), we need to include
    // text BETWEEN the number placeholder and the suffix to disambiguate.
    //
    // We take the full text after the first # placeholder (removing the
    // number and leading non-letter chars) and try to find a unique
    // substring from that extended suffix.
    const extendedSuffix = extractExtendedSuffix(template);
    if (extendedSuffix && extendedSuffix !== suffix && extendedSuffix.length >= effectiveMinLen) {
      // For templates with multiple ## placeholders (dual-stat mods like
      // "##% повышение брони, ##% увеличение урона от атак"), the extended
      // suffix may contain ## from subsequent placeholders. We need to
      // strip those out and use only the text between/after placeholders.
      let cleanExtendedSuffix = extendedSuffix;
      if (cleanExtendedSuffix.includes('#')) {
        // Dual-stat mod: build a TIER-AGNOSTIC extended suffix from the template.
        // Split template by #+ sequences, take all non-empty text segments,
        // strip leading non-letters from each, and join.
        //
        // Example: template "##% повышение брони, ##% увеличение урона от атак"
        //   → segments: ["", "% повышение брони, ", "% увеличение урона от атак"]
        //   → stripped: ["повышение брони,", "увеличение урона от атак"]
        //   → joined: "повышение брони, увеличение урона от атак"
        //
        // This is tier-agnostic (no specific numbers) and more specific than
        // just the pure suffix "увеличение урона от атак", improving uniqueness.
        const segments = template.split(/#+/);
        const textSegments = segments
          .slice(1)  // skip text before first #
          .map(seg => seg.replace(/^[^a-zA-Zа-яА-ЯёЁ]*/, '').trim())
          .filter(seg => seg.length > 0);
        const templateSuffix = textSegments.join(' ');
        if (templateSuffix.length >= effectiveMinLen) {
          cleanExtendedSuffix = templateSuffix;
        } else if (rawText.includes(',')) {
          // Fallback: try extracting after last comma from rawText
          // (less ideal but sometimes needed for short suffixes)
          const lastCommaIdx = rawText.lastIndexOf(',');
          if (lastCommaIdx !== -1) {
            const afterComma = rawText.substring(lastCommaIdx + 1).trim();
            const strippedAfterComma = afterComma.replace(/^[\d(—\-+%.)\s]+/, '').trim();
            cleanExtendedSuffix = strippedAfterComma.length >= effectiveMinLen
              ? strippedAfterComma
              : afterComma;
          }
        } else {
          cleanExtendedSuffix = '';
        }
      }

      if (cleanExtendedSuffix) {
        const bestExtended = findShortestUniqueSuffix(
          cleanExtendedSuffix, template, allTokensInCategory, locale, effectiveMinLen
        );
        if (bestExtended) {
          const { hasYofication, yoficationPositions } = checkYofication(
            bestExtended, targetToken, allTokensInCategory, locale
          );
          return { regex: bestExtended, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder };
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // Strategy 1c: Full second stat for dual-stat mods
    // ═══════════════════════════════════════════════════
    // For dual-stat desecrated mods where Strategy 1b couldn't find
    // a unique suffix, try the template-based concatenation of all
    // text segments (tier-agnostic, no specific numbers).
    // This produces longer but more specific regexes that work across all tiers.
    if (hasMultiPlaceholder && rawText.includes(',')) {
      // Build template-based suffix: same logic as Strategy 1b but
      // with a more aggressive approach — use the full template text
      // between/after all placeholders.
      const segments = template.split(/#+/);
      const textSegments = segments
        .slice(1)
        .map(seg => seg.replace(/^[^a-zA-Zа-яА-ЯёЁ]*/, '').trim())
        .filter(seg => seg.length > 0);
      const templateFullSuffix = textSegments.join(' ');

      if (templateFullSuffix.length >= effectiveMinLen) {
        const bestFull = findShortestUniqueSuffix(
          templateFullSuffix, template, allTokensInCategory, locale, effectiveMinLen
        );
        if (bestFull) {
          const { hasYofication, yoficationPositions } = checkYofication(
            bestFull, targetToken, allTokensInCategory, locale
          );
          return { regex: bestFull, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder };
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // Strategy 2: Substring search fallback
  // ═══════════════════════════════════════════════════
  // For tokens without placeholders, or where suffix conflicts,
  // fall back to the original substring search algorithm.
  const fallbackResult = substringSearchFallback(
    targetToken, allTokensInCategory, locale, effectiveMinLen
  );

  return { ...fallbackResult, familyKey, regexPrefix, hasMultiPlaceholder };
}

/**
 * Original substring search algorithm (fallback).
 * Finds the shortest unique substring of the rawText
 * among all other tokens in the category.
 */
function substringSearchFallback(
  targetToken: NormalizedMod,
  allTokensInCategory: NormalizedMod[],
  locale: Locale,
  minLen: number = MIN_REGEX_LEN_DEFAULT
): Omit<RegexResult, 'familyKey'> {
  const targetTexts = getAllTexts(targetToken, locale).map(t => t.toLowerCase());
  if (targetTexts.length === 0 || targetTexts.every(t => t === '')) {
    return { regex: '', hasYofication: false, yoficationPositions: [], regexPrefix: '' };
  }

  // Build exclusion texts: all other tokens' texts
  const exclusionTexts: string[] = [];
  for (const token of allTokensInCategory) {
    if (token.id === targetToken.id) continue;
    const texts = getAllTexts(token, locale).map(t => t.toLowerCase());
    exclusionTexts.push(...texts);
  }

  // Build exclusion substring set for O(1) lookup
  const exclusionSubstrings = buildSubstringSet(exclusionTexts, 30);

  const primaryText = targetToken.rawText[locale].toLowerCase();

  let bestCandidate = '';
  let bestScore = Infinity;

  // Try all substrings starting from minimum length
  for (let length = minLen; length <= primaryText.length; length++) {
    let foundForThisLength = false;

    for (let start = 0; start <= primaryText.length - length; start++) {
      const candidate = primaryText.substring(start, start + length);

      if (candidate.trim().length < minLen) continue;
      if (/^\d+$/.test(candidate.trim())) continue;

      if (!exclusionSubstrings.has(candidate)) {
        const isEndOfWord = (start + length === primaryText.length) ||
                           primaryText[start + length] === ' ';
        const hasSpaces = candidate.includes(' ');
        const score = length * 10 + (hasSpaces ? 5 : 0) + (isEndOfWord ? 0 : 3);

        if (score < bestScore) {
          bestCandidate = candidate;
          bestScore = score;
        }
        foundForThisLength = true;
      }
    }

    if (foundForThisLength && bestCandidate) break;
  }

  // Try gender form texts if no result
  if (!bestCandidate) {
    for (const formText of targetTexts.slice(1)) {
      if (formText === primaryText) continue;
      const lowerForm = formText.toLowerCase();
      for (let length = minLen; length <= lowerForm.length; length++) {
        let found = false;
        for (let start = 0; start <= lowerForm.length - length; start++) {
          const candidate = lowerForm.substring(start, start + length);
          if (candidate.trim().length < minLen) continue;
          if (/^\d+$/.test(candidate.trim())) continue;
          if (!exclusionSubstrings.has(candidate)) {
            bestCandidate = candidate;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (bestCandidate) break;
    }
  }

  // Fallback: full rawText
  if (!bestCandidate) {
    bestCandidate = primaryText;
  }

  // Check yofication
  const { hasYofication, yoficationPositions } = checkYoficationLegacy(
    bestCandidate, primaryText, targetToken, exclusionSubstrings
  );

  return { regex: bestCandidate, hasYofication, yoficationPositions, regexPrefix: '' };
}

/**
 * Check yofication for template-based regex.
 * Replaces 'е' with '[её]' at yofication positions if it keeps the regex unique.
 */
function checkYofication(
  regex: string,
  targetToken: NormalizedMod,
  allTokensInCategory: NormalizedMod[],
  locale: Locale
): { hasYofication: boolean; yoficationPositions: number[] } {
  if (!targetToken.hasYofication || targetToken.yoficationPositions.length === 0) {
    return { hasYofication: false, yoficationPositions: [] };
  }

  const lowerRegex = regex.toLowerCase();
  let hasYofication = false;
  const yoficationPositions: number[] = [];

  // Check each yofication position
  for (const pos of targetToken.yoficationPositions) {
    // Find 'е' or 'ё' in the regex that corresponds to this position
    const rawText = targetToken.rawText[locale].toLowerCase();
    if (pos >= rawText.length) continue;

    const char = rawText[pos];
    if (char !== 'е' && char !== 'ё') continue;

    // Find this character in the regex
    const idx = lowerRegex.indexOf(char);
    if (idx === -1) continue;

    // Check if [её] version is still unique
    const yoficatedRegex = lowerRegex.slice(0, idx) + '[её]' + lowerRegex.slice(idx + 1);

    if (isSuffixUniqueInCategory(
      yoficatedRegex, targetToken.rawTextTemplate[locale], allTokensInCategory, locale
    )) {
      hasYofication = true;
      yoficationPositions.push(idx);
    }
  }

  return { hasYofication, yoficationPositions };
}

/**
 * Legacy yofication check for substring-search fallback.
 */
function checkYoficationLegacy(
  bestCandidate: string,
  primaryText: string,
  targetToken: NormalizedMod,
  exclusionSubstrings: Set<string>
): { hasYofication: boolean; yoficationPositions: number[] } {
  let hasYofication = false;
  const yoficationPositions: number[] = [];

  if (targetToken.hasYofication && targetToken.yoficationPositions.length > 0) {
    let yoficatedCandidate = bestCandidate;
    for (const pos of targetToken.yoficationPositions) {
      const candidatePos = bestCandidate.indexOf(primaryText[pos]);
      if (candidatePos !== -1 && !exclusionSubstrings.has(
        yoficatedCandidate.slice(0, candidatePos) + '[её]' + yoficatedCandidate.slice(candidatePos + 1)
      )) {
        hasYofication = true;
        yoficationPositions.push(candidatePos);
      }
    }
  }

  return { hasYofication, yoficationPositions };
}

/**
 * Compute regex for all tokens in a category.
 */
export function computeAllRegexes(
  tokens: NormalizedMod[],
  locale: Locale = 'ru'
): Map<string, RegexResult> {
  const results = new Map<string, RegexResult>();

  for (const token of tokens) {
    const result = computeMinimalUniqueSubstring(token, tokens, locale);
    results.set(token.id, result);
  }

  return results;
}

/**
 * Get all text representations of a token (rawText + all gender forms + template)
 */
function getAllTexts(token: NormalizedMod, locale: Locale): string[] {
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
function buildSubstringSet(texts: string[], maxLen: number): Set<string> {
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
