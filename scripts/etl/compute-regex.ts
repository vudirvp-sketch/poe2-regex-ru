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
import { matchQuotedGroup } from '../../src/core/poe2-regex-matcher.js';

export interface RegexResult {
  regex: string;
  hasYofication: boolean;
  yoficationPositions: number[];
  /** Family key: normalized rawTextTemplate for grouping mods of the same family */
  familyKey: string;
  /** Regex prefix: text before the first ##/# placeholder, used for disambiguation
   *  in dual-number mods (e.g., "От ## до ## урона" → prefix="От").
   *  Since .* does NOT cross block boundaries (verified in-game Phase 7),
   *  prefix is only needed when a template has multiple # placeholders
   *  separated by "до". Empty string for all other mods. */
  regexPrefix: string;
  /** Whether the template has multiple ##/# placeholders (dual-number or dual-stat mods).
   *  Used downstream to determine correct range slot for numeric filtering. */
  hasMultiPlaceholder: boolean;
  /** Exclusion patterns for cross-family FP prevention.
   *  When the main regex suffix also appears in compound-family tokens,
   *  these are short substrings that appear in the compound mods but NOT
   *  in the target family. Used to generate negation groups like:
   *  "suffix" !"exclude1" !"exclude2"
   *  Empty array means no exclusions needed. */
  regexExclude: string[];
  /** AND-composed prefix context for cross-family FP prevention.
   *  When regex + regexExclude cannot eliminate all FP, this provides a
   *  short substring that appears ONLY in the target family's rawText.
   *  UI compiles: AND(LITERAL(context), LITERAL(regex)) → "context" "suffix"
   *  Empty string means no prefix context needed. */
  regexPrefixContext: string;
}

/** Minimum regex length for meaningful matching in PoE2 search.
 * Waystone and tablet mods tend to have short, generic suffixes that can
 * match unintended text in-game. Using MIN=5 for these categories
 * forces longer, more specific regexes.
 */
const MIN_REGEX_LEN_DEFAULT = 5;

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
const STRICT_CATEGORIES_MIN_LEN: Record<string, number> = {
  'waystone': 7,
  'waystone-desecrated': 7,
  'tablet': 10,
  'jewel-desecrated': 10,
  'jewel-corrupted': 7,
};

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
function extractTemplatePrefix(template: string): string {
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

/**
 * Check if a candidate regex string appears in any token's rawText
 * from a different family.
 *
 * Compound-family overlaps (like "к силе" matching "+(9—15) к силе и интеллекту")
 * are now treated as REAL conflicts — the short suffix must be disambiguated.
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
function containsPoE2Grouping(candidate: string): boolean {
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
function regexMatchesRawText(regex: string, rawText: string): boolean {
  return matchQuotedGroup(regex, rawText.toLowerCase());
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
  const effectiveMinLen = STRICT_CATEGORIES_MIN_LEN[targetToken.category]
    ? Math.max(minRegexLen, STRICT_CATEGORIES_MIN_LEN[targetToken.category])
    : minRegexLen;

  // Edge case: empty rawText
  if (!rawText || rawText.trim().length === 0) {
    return { regex: '', hasYofication: false, yoficationPositions: [], familyKey, regexPrefix: '', hasMultiPlaceholder: false, regexExclude: [], regexPrefixContext: '' };
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
      // Verify the suffix actually matches the rawText via PoE2 regex engine.
      // For multi-placeholder (dual-stat) mods, the template-joined suffix
      // may not appear in rawText because numbers interrupt the segments.
      if (regexMatchesRawText(bestSuffix, rawText)) {
        // Check yofication on the suffix
        const { hasYofication, yoficationPositions } = checkYofication(
          bestSuffix, targetToken, allTokensInCategory, locale
        );

        return { regex: bestSuffix, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder, regexExclude: [], regexPrefixContext: '' };
      }
      // Pure suffix not in rawText — fall through to Strategy 1b/1c
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
          // Verify the regex actually matches the rawText via PoE2 engine.
          // For dual-stat mods, the joined template suffix may not match
          // because numbers interrupt the segments, or `()` causes grouping.
          if (regexMatchesRawText(bestExtended, rawText)) {
            const { hasYofication, yoficationPositions } = checkYofication(
              bestExtended, targetToken, allTokensInCategory, locale
            );
            return { regex: bestExtended, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder, regexExclude: [], regexPrefixContext: '' };
          }
          // Joined suffix not in rawText — try individual last segment
        }
      }

      // ─── Strategy 1b-alt: Last segment only for multi-placeholder mods ───
      // For dual-stat mods, when the joined suffix doesn't appear in rawText,
      // try using only the LAST text segment (after the last ##).
      // This always appears in rawText because it's the pure suffix.
      if (hasMultiPlaceholder) {
        const segments = template.split(/#+/);
        const lastSegment = segments[segments.length - 1]
          .replace(/^[^a-zA-Zа-яА-ЯёЁ]*/, '').trim();
        if (lastSegment && lastSegment.length >= effectiveMinLen
            && !containsPoE2Grouping(lastSegment)
            && regexMatchesRawText(lastSegment, rawText)) {
          const { hasYofication, yoficationPositions } = checkYofication(
            lastSegment, targetToken, allTokensInCategory, locale
          );
          return { regex: lastSegment, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder, regexExclude: [], regexPrefixContext: '' };
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
          // Verify the regex actually matches rawText via PoE2 engine
          if (regexMatchesRawText(bestFull, rawText)) {
            const { hasYofication, yoficationPositions } = checkYofication(
              bestFull, targetToken, allTokensInCategory, locale
            );
            return { regex: bestFull, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder, regexExclude: [], regexPrefixContext: '' };
          }
          // Not in rawText — skip this strategy
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // Strategy 1d: Negation for cross-family FP
  // ═══════════════════════════════════════════════════
  // When the template suffix is not unique because it also appears in
  // compound-family tokens (e.g., "к силе" matches both pure strength
  // and composite "к силе и интеллекту"), we can use PoE2 negation
  // to exclude the compound matches.
  //
  // Generate regex: "suffix" !"exclude1" !"exclude2" ...
  // where exclude patterns are substrings that appear in the compound
  // mods but NOT in the target family's rawText.
  if (suffix.length >= effectiveMinLen && regexMatchesRawText(suffix, rawText)) {
    const excludePatterns = computeExcludePatterns(
      suffix, template, targetToken, allTokensInCategory, locale
    );
    if (excludePatterns.length > 0) {
      // Verify: the suffix with negation should NOT match any compound-family token
      const { hasYofication, yoficationPositions } = checkYofication(
        suffix, targetToken, allTokensInCategory, locale
      );
      return { regex: suffix, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder, regexExclude: excludePatterns, regexPrefixContext: '' };
    }
  }

  // ═══════════════════════════════════════════════════
  // Strategy 1e: Word Truncation + Negation
  // ═══════════════════════════════════════════════════
  // Truncate each word in the suffix from the END (trailing substring only),
  // then try the shorter suffix with negation to exclude cross-family FP.
  //
  // PoE2 is a substring search engine. Truncating the end of a word
  // still matches the original because the truncated form is a LEADING
  // substring of the word. Example: "к си" matches "к силе" because
  // "си" is the start of "силе".
  //
  // Key rules (verified in-game Phase 8):
  // - Only trailing substring of each word (силе→сил→си)
  // - Each truncated word must have ≥3 significant chars
  // - No mid-word extraction (can't skip word start)
  // - Validate truncated suffix still matches rawText via PoE2 engine
  //
  // Example: "к силе" with FP from "к силе и интеллекту"
  //   → truncate "силе"→"сил"→"си" → "к си" (4 chars)
  //   → "к си" matches target AND still has FP
  //   → add negate " и" → "к си" "! и" (9 chars total)
  //   vs. old: "к силе" !"к силе и" !"к силе," (40 chars)
  {
    const truncatedResult = tryWordTruncation(
      suffix, template, targetToken, allTokensInCategory, locale, effectiveMinLen, rawText
    );
    if (truncatedResult) {
      return truncatedResult;
    }
  }

  // ═══════════════════════════════════════════════════
  // Strategy 2: Substring search fallback
  // ═══════════════════════════════════════════════════
  // For tokens without placeholders, or where suffix conflicts,
  // fall back to the original substring search algorithm.
  let fallbackResult = substringSearchFallback(
    targetToken, allTokensInCategory, locale, effectiveMinLen
  );

  // Final validation: verify the regex matches rawText via PoE2 engine.
  // Since substringSearchFallback now filters `()` at generation time,
  // this mainly catches other metacharacter issues or multi-placeholder joins.
  if (fallbackResult.regex && !regexMatchesRawText(fallbackResult.regex, rawText)) {
    // Last resort: use the template suffix even if not unique.
    // A broad match that WORKS is better than a specific match that DOESN'T.
    const broadSuffix = extractTemplateSuffix(template);
    if (broadSuffix && broadSuffix.length >= 3
        && !containsPoE2Grouping(broadSuffix)
        && regexMatchesRawText(broadSuffix, rawText)) {
      const { hasYofication, yoficationPositions } = checkYofication(
        broadSuffix, targetToken, allTokensInCategory, locale
      );
      fallbackResult = { regex: broadSuffix, hasYofication, yoficationPositions, regexPrefix: '', hasMultiPlaceholder: false, regexExclude: [], regexPrefixContext: '' };
    }
    // If even the broad suffix doesn't match, keep the fallback result
    // (it will be an FN in Oracle but at least it's a best-effort regex)
  }

  return { ...fallbackResult, familyKey, regexPrefix, hasMultiPlaceholder, regexExclude: fallbackResult.regexExclude || [], regexPrefixContext: fallbackResult.regexPrefixContext || '' };
}

/**
 * Strategy 1e: Try word truncation to shorten the suffix, then add negation.
 *
 * Algorithm:
 * 1. Take the current suffix (may or may not be unique)
 * 2. For each word in the suffix, iteratively truncate 1 char from the end
 * 3. After each truncation, validate:
 *    - The truncated suffix must still match the target's rawText via PoE2 engine
 *    - Each truncated word must have ≥3 significant chars
 * 4. If the truncated suffix has FP, compute exclude patterns for it
 * 5. Return the (truncated suffix + exclude) combination that is shortest overall
 *
 * Only trailing substring truncation is allowed (силе→сил→си).
 * Mid-word extraction does NOT work in PoE2's substring search.
 *
 * @returns RegexResult if truncation produces a shorter valid regex, null otherwise
 */
function tryWordTruncation(
  suffix: string,
  template: string,
  targetToken: NormalizedMod,
  allTokensInCategory: NormalizedMod[],
  locale: Locale,
  minLen: number,
  rawText: string
): RegexResult | null {
  if (suffix.length < minLen) return null;

  // Verify the suffix matches rawText — truncation only makes sense if suffix works
  if (!regexMatchesRawText(suffix, rawText)) return null;

  const familyKey = normalizeTemplate(template);
  const regexPrefix = extractTemplatePrefix(template);
  const placeholderCount = (template.match(/#+/g) || []).length;
  const hasMultiPlaceholder = placeholderCount >= 2;

  // Get the best non-truncated result for comparison
  // If the suffix is already unique without excludes, no need to truncate
  if (isSuffixUniqueInCategory(suffix, template, allTokensInCategory, locale)) {
    return null; // Strategy 1/1b/1c already found a unique suffix — no improvement needed
  }

  // Try progressively truncated versions of the suffix
  let bestResult: RegexResult | null = null;
  let bestTotalLen = suffix.length; // baseline: current suffix without excludes

  // Calculate current total length including excludes
  const currentExcludes = computeExcludePatterns(suffix, template, targetToken, allTokensInCategory, locale);
  if (currentExcludes.length > 0) {
    // Current total: suffix + each exclude (with "!..."  format overhead)
    bestTotalLen = suffix.length + currentExcludes.reduce((sum, exc) => sum + exc.length + 3, 0); // +3 for " !"
  }

  // Generate truncated suffix candidates
  const candidates = generateTruncatedSuffixes(suffix, minLen);

  for (const truncatedSuffix of candidates) {
    // Validate: truncated suffix must match rawText via PoE2 engine
    if (!regexMatchesRawText(truncatedSuffix, rawText)) continue;

    // Check if truncated suffix is unique (no FP at all)
    if (isSuffixUniqueInCategory(truncatedSuffix, template, allTokensInCategory, locale)) {
      const totalLen = truncatedSuffix.length;
      if (totalLen < bestTotalLen) {
        const { hasYofication, yoficationPositions } = checkYofication(
          truncatedSuffix, targetToken, allTokensInCategory, locale
        );
        bestResult = { regex: truncatedSuffix, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder, regexExclude: [], regexPrefixContext: '' };
        bestTotalLen = totalLen;
      }
      continue;
    }

    // Has FP — try adding exclude patterns
    const excludes = computeExcludePatterns(truncatedSuffix, template, targetToken, allTokensInCategory, locale);
    if (excludes.length === 0) continue;

    // Calculate total length: suffix + each exclude with "!..." format
    // In the compiled regex: "suffix" "!exclude1" "!exclude2"
    // Total = len(suffix) + sum(len(exclude) + 3) for each exclude  (+3 for " !")
    const totalLen = truncatedSuffix.length + excludes.reduce((sum, exc) => sum + exc.length + 3, 0);

    if (totalLen < bestTotalLen) {
      const { hasYofication, yoficationPositions } = checkYofication(
        truncatedSuffix, targetToken, allTokensInCategory, locale
      );
      bestResult = { regex: truncatedSuffix, hasYofication, yoficationPositions, familyKey, regexPrefix, hasMultiPlaceholder, regexExclude: excludes, regexPrefixContext: '' };
      bestTotalLen = totalLen;
    }
  }

  return bestResult;
}

/**
 * Generate all valid truncated suffix variants by removing trailing chars
 * from each word, respecting minimum length constraints.
 *
 * Rules (verified in-game Phase 8):
 * - Only trailing substring of each word: "силе"→"сил"→"си"
 * - Each word must retain ≥3 significant chars
 * - The overall suffix must be ≥ minLen characters
 * - Leading words can be dropped entirely (phrase truncation from the left)
 *
 * @returns Array of truncated suffix strings, ordered from longest to shortest
 */
function generateTruncatedSuffixes(suffix: string, minLen: number): string[] {
  const results: string[] = [];
  const words = suffix.split(/\s+/);

  // Phase 1: Try truncating individual words (keeping all words, shortening each)
  // For each word position, generate truncated variants
  const wordVariants: string[][] = words.map(word => {
    const variants: string[] = [word]; // start with full word
    // Truncate from the end: "силе"→"сил"→"си"
    for (let len = word.length - 1; len >= 3; len--) {
      variants.push(word.substring(0, len));
    }
    return variants;
  });

  // Generate all combinations (cartesian product)
  // But limit: only first few shortest words per position
  const limitedVariants = wordVariants.map(vs => vs.slice(0, 4)); // max 4 variants per word
  const combinations = cartesianProduct(limitedVariants);

  for (const combo of combinations) {
    const candidate = combo.join(' ');
    if (candidate.length >= minLen && candidate !== suffix) {
      results.push(candidate);
    }
  }

  // Phase 2: Try dropping leading words (phrase truncation from left)
  // "к силе" → "силе" (drop "к"), "к сопротивлению огню" → "сопротивлению огню" → "огню"
  for (let skipWords = 1; skipWords < words.length; skipWords++) {
    const remaining = words.slice(skipWords).join(' ');
    if (remaining.length >= minLen && remaining !== suffix) {
      results.push(remaining);
      // Also try truncating words in the remaining phrase
      const subWords = remaining.split(/\s+/);
      const subVariants: string[][] = subWords.map(word => {
        const vs: string[] = [word];
        for (let len = word.length - 1; len >= 3; len--) {
          vs.push(word.substring(0, len));
        }
        return vs.slice(0, 4);
      });
      const subCombos = cartesianProduct(subVariants);
      for (const combo of subCombos) {
        const candidate = combo.join(' ');
        if (candidate.length >= minLen && candidate !== remaining) {
          results.push(candidate);
        }
      }
    }
  }

  // Sort by length descending (try longest first — they're more likely to match rawText)
  results.sort((a, b) => b.length - a.length);

  // Remove duplicates
  return [...new Set(results)];
}

/**
 * Cartesian product of arrays of strings.
 * Each element of the result is a combination picking one item from each input array.
 */
function cartesianProduct(arrays: string[][]): string[][] {
  if (arrays.length === 0) return [[]];
  if (arrays.length === 1) return arrays[0].map(item => [item]);

  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);
  const result: string[][] = [];

  for (const item of first) {
    for (const combo of restProduct) {
      result.push([item, ...combo]);
    }
  }

  return result;
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
    return { regex: '', hasYofication: false, yoficationPositions: [], regexPrefix: '', hasMultiPlaceholder: false, regexExclude: [], regexPrefixContext: '' };
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
  // SKIP candidates containing `(` or `)` — PoE2 interprets them as grouping,
  // causing truncation (e.g. "—6) к с" → PoE2 reads only "—6") → cross-family FP.
  for (let length = minLen; length <= primaryText.length; length++) {
    let foundForThisLength = false;

    for (let start = 0; start <= primaryText.length - length; start++) {
      const candidate = primaryText.substring(start, start + length);

      // Skip candidates containing `(` or `)` — PoE2 treats as grouping
      if (containsPoE2Grouping(candidate)) continue;

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

  // Try gender form texts if no result (but NOT the template — it contains ## placeholders)
  if (!bestCandidate) {
    for (const formText of targetTexts.slice(1)) {
      if (formText === primaryText) continue;
      // Skip template (last element) — it contains ## which don't appear in rawText
      if (formText.includes('#')) continue;
      const lowerForm = formText.toLowerCase();
      for (let length = minLen; length <= lowerForm.length; length++) {
        let found = false;
        for (let start = 0; start <= lowerForm.length - length; start++) {
          const candidate = lowerForm.substring(start, start + length);
          if (containsPoE2Grouping(candidate)) continue;
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

  // Fallback: full rawText (strip parens if present)
  if (!bestCandidate) {
    if (containsPoE2Grouping(primaryText)) {
      // Try stripping parenthesized number ranges from rawText
      const cleanedText = primaryText.replace(/\([^)]+\)/g, '').replace(/\s+/g, ' ').trim();
      // First: try cleaned text as-is
      if (cleanedText.length >= minLen && !containsPoE2Grouping(cleanedText) && regexMatchesRawText(cleanedText, primaryText)) {
        bestCandidate = cleanedText;
      } else {
        // Cleaned text either has grouping, doesn't match, or is too short.
        // Try removing trailing non-letter chars (like stray % signs after removed parens)
        const furtherCleaned = cleanedText.replace(/[^a-zA-Zа-яА-ЯёЁ]+$/, '').trim();
        if (furtherCleaned.length >= minLen && !containsPoE2Grouping(furtherCleaned) && regexMatchesRawText(furtherCleaned, primaryText)) {
          bestCandidate = furtherCleaned;
        } else {
          // Last resort: try just the text BEFORE the first parenthesized group
          // E.g., "Меткость монстров повышена на (10—20)%" → "Меткость монстров повышена на"
          const beforeFirstParen = primaryText.replace(/\([^)]+\).*$/, '').trim();
          if (beforeFirstParen.length >= minLen && !containsPoE2Grouping(beforeFirstParen) && regexMatchesRawText(beforeFirstParen, primaryText)) {
            bestCandidate = beforeFirstParen;
          }
          // If nothing works, bestCandidate remains empty (will be handled below)
        }
      }
    }

    // If still no valid candidate, use full rawText (may contain parens — will be FN)
    if (!bestCandidate) {
      bestCandidate = primaryText;
    }
  }

  // Check yofication
  const { hasYofication, yoficationPositions } = checkYoficationLegacy(
    bestCandidate, primaryText, targetToken, exclusionSubstrings
  );

  return { regex: bestCandidate, hasYofication, yoficationPositions, regexPrefix: '', hasMultiPlaceholder: false, regexExclude: [], regexPrefixContext: '' };
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
 * Compute exclusion patterns for cross-family FP prevention.
 *
 * Priority order (Phase 8 — verified in-game):
 * 1. Minion marker: "!Приспеш" — universal, covers ALL minion-variant FP
 * 2. Compound separator: "! и" — catches "к силе и ловкости", "к силе, ловкости"
 * 3. Specific short markers from conflicting tokens
 * 4. Full phrase patterns (fallback, least preferred)
 *
 * Each exclude candidate must be ≥3 significant chars and must NOT match
 * any target-family token's rawText or item names.
 *
 * Example (Phase 8 optimization):
 *   Old: "к силе" !"к силе и" !"к силе,"  (40 chars)
 *   New: "к си" "! и"  (9 chars)
 */
function computeExcludePatterns(
  suffix: string,
  targetTemplate: string,
  targetToken: NormalizedMod,
  allTokensInCategory: NormalizedMod[],
  locale: Locale
): string[] {
  const normalizedTargetTemplate = normalizeTemplate(targetTemplate);
  const lowerSuffix = suffix.toLowerCase();
  const targetRawLower = targetToken.rawText[locale].toLowerCase();

  // Find all tokens from OTHER families whose rawText contains the suffix
  const conflictingTokens: NormalizedMod[] = [];
  for (const token of allTokensInCategory) {
    const otherTemplate = token.rawTextTemplate[locale];
    if (normalizeTemplate(otherTemplate) === normalizedTargetTemplate) continue;

    const otherRawLower = token.rawText[locale].toLowerCase();
    if (otherRawLower.includes(lowerSuffix)) {
      conflictingTokens.push(token);
    }
  }

  if (conflictingTokens.length === 0) return [];

  // Collect all conflicting rawTexts for pattern testing
  const conflictingRawTexts = conflictingTokens.map(t => t.rawText[locale].toLowerCase());

  // ─── Strategy: Combine short markers for mixed conflict types ───
  // Instead of requiring ALL conflicts to be the same type (minion/compound),
  // we try multiple short markers that together cover all conflicts.
  // Each marker must be valid (doesn't match target family) and cover
  // at least one conflict. We accumulate markers until all conflicts are covered.

  const excludePatterns: string[] = [];
  const coveredConflictIndices = new Set<number>();

  // Helper: check if an exclude candidate is valid and find which conflicts it covers
  const tryAddMarker = (marker: string): boolean => {
    if (!isExcludeValid(marker, targetToken, allTokensInCategory, locale, normalizedTargetTemplate)) {
      return false;
    }
    const lowerMarker = marker.toLowerCase();
    let coversAny = false;
    for (let i = 0; i < conflictingRawTexts.length; i++) {
      if (coveredConflictIndices.has(i)) continue;
      if (conflictingRawTexts[i].includes(lowerMarker)) {
        coveredConflictIndices.add(i);
        coversAny = true;
      }
    }
    if (coversAny) {
      excludePatterns.push(marker);
      return true;
    }
    return false;
  };

  // ─── Priority 1: Minion marker (partial coverage OK) ───
  // "Приспеш" covers ALL minion-variant conflicts in one short pattern.
  // Even if not all conflicts are minion, this handles the minion subset.
  const MINION_MARKER = 'Приспеш';
  const MINION_MARKERS_LOWER = ['приспешник', 'приспешники', 'приспеш'];
  const hasMinionConflicts = conflictingRawTexts.some(raw =>
    MINION_MARKERS_LOWER.some(m => raw.includes(m))
  );
  if (hasMinionConflicts && !targetRawLower.includes(MINION_MARKER.toLowerCase())) {
    tryAddMarker(MINION_MARKER);
  }

  // If all conflicts covered by minion marker, return early
  if (coveredConflictIndices.size === conflictingTokens.length) {
    return excludePatterns;
  }

  // ─── Priority 2: Compound separator " и" (partial coverage OK) ───
  // " и" covers compound-family conflicts where suffix is followed by " и" or ",".
  const COMPOUND_SEPARATORS = [' и', ','];
  for (const sep of COMPOUND_SEPARATORS) {
    if (coveredConflictIndices.size === conflictingTokens.length) break;

    // Check if any uncovered conflict has this compound separator after suffix
    let sepCoversAny = false;
    for (let i = 0; i < conflictingRawTexts.length; i++) {
      if (coveredConflictIndices.has(i)) continue;
      const confRaw = conflictingRawTexts[i];
      const suffixIdx = confRaw.indexOf(lowerSuffix);
      if (suffixIdx === -1) continue;
      const afterSuffix = confRaw.substring(suffixIdx + lowerSuffix.length);
      if (afterSuffix.startsWith(sep) || afterSuffix.match(/^\s/)) {
        sepCoversAny = true;
        break;
      }
    }

    if (!sepCoversAny) continue;

    // Verify separator doesn't match target family's tokens after suffix
    const targetFamilyHasSepAfterSuffix = allTokensInCategory.some(token => {
      const tTemplate = token.rawTextTemplate[locale];
      if (normalizeTemplate(tTemplate) !== normalizedTargetTemplate) return false;
      const tRawLower = token.rawText[locale].toLowerCase();
      const idx = tRawLower.indexOf(lowerSuffix);
      if (idx === -1) return false;
      return tRawLower.substring(idx + lowerSuffix.length).startsWith(sep);
    });

    if (!targetFamilyHasSepAfterSuffix) {
      tryAddMarker(sep);
    }
  }

  // If all conflicts covered, return early
  if (coveredConflictIndices.size === conflictingTokens.length) {
    return excludePatterns;
  }

  // ─── Priority 3: Short universal markers for remaining conflicts ───
  // Try known markers and extracted words from uncovered conflicts.
  const uncoveredConflicts: NormalizedMod[] = [];
  for (let i = 0; i < conflictingTokens.length; i++) {
    if (!coveredConflictIndices.has(i)) {
      uncoveredConflicts.push(conflictingTokens[i]);
    }
  }

  if (uncoveredConflicts.length > 0) {
    const shortMarker = findShortUniversalMarker(
      uncoveredConflicts, targetToken, allTokensInCategory, locale, normalizedTargetTemplate
    );
    if (shortMarker) {
      tryAddMarker(shortMarker);
    }
  }

  // If all conflicts covered, return early
  if (coveredConflictIndices.size === conflictingTokens.length) {
    return excludePatterns;
  }

  // ─── Priority 4: Specific patterns for remaining uncovered conflicts ───
  // For each uncovered conflicting token, find distinguishing text after suffix.
  const seenPatterns = new Set<string>();
  for (let i = 0; i < conflictingTokens.length; i++) {
    if (coveredConflictIndices.has(i)) continue;
    if (excludePatterns.length >= 3) break; // Limit total excludes to 3

    const confRawLower = conflictingRawTexts[i];
    const suffixIdx = confRawLower.indexOf(lowerSuffix);
    if (suffixIdx === -1) continue;

    // Text after the suffix in the conflicting token
    const afterSuffix = confRawLower.substring(suffixIdx + lowerSuffix.length).trim();
    if (afterSuffix.length === 0) continue;

    // Build exclude pattern: suffix + separator + firstWord
    const fullAfter = confRawLower.substring(suffixIdx + lowerSuffix.length);
    const leadingNonLetter = fullAfter.match(/^[^a-zA-Zа-яА-ЯёЁ]*/);
    const nonLetterLen = leadingNonLetter ? leadingNonLetter[0].length : 0;
    const trimmedAfter = fullAfter.substring(nonLetterLen).trim();
    if (trimmedAfter.length === 0) continue;

    // Try short form first: just the first word after suffix
    const firstWord = trimmedAfter.split(/\s+/)[0];
    if (firstWord.length >= 3 && !targetRawLower.includes(firstWord)
        && !containsPoE2Grouping(firstWord)
        && !seenPatterns.has(firstWord)) {
      // Verify this word covers the conflict
      const lowerFirst = firstWord.toLowerCase();
      if (confRawLower.includes(lowerFirst)) {
        seenPatterns.add(firstWord);
        if (isExcludeValid(firstWord, targetToken, allTokensInCategory, locale, normalizedTargetTemplate)) {
          excludePatterns.push(firstWord);
          // Mark this and similar conflicts as covered
          for (let j = i; j < conflictingRawTexts.length; j++) {
            if (coveredConflictIndices.has(j)) continue;
            if (conflictingRawTexts[j].includes(lowerFirst)) {
              coveredConflictIndices.add(j);
            }
          }
          continue;
        }
      }
    }

    // Fallback: suffix + separator + firstWord (longer but more specific)
    const separator = nonLetterLen > 0 ? fullAfter.substring(0, nonLetterLen) : ' ';
    const specificPattern = lowerSuffix + separator + firstWord;

    if (!seenPatterns.has(specificPattern)) {
      if (!targetRawLower.includes(specificPattern) && !containsPoE2Grouping(specificPattern)) {
        seenPatterns.add(specificPattern);
        excludePatterns.push(specificPattern);
        coveredConflictIndices.add(i);
      }
    }
  }

  return excludePatterns.slice(0, 3);
}

/**
 * Validate an exclude pattern candidate.
 * Returns true if the pattern:
 * - Is ≥3 significant chars (letters/digits)
 * - Does NOT appear in any target-family token's rawText
 * - Does NOT appear in item type/name text (would cause FN)
 * - Does NOT contain PoE2 grouping chars
 */
function isExcludeValid(
  candidate: string,
  _targetToken: NormalizedMod,
  allTokensInCategory: NormalizedMod[],
  locale: Locale,
  normalizedTargetTemplate: string
): boolean {
  // Check minimum significant length
  const significantChars = candidate.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '');
  if (significantChars.length < 3) return false;

  // Check for PoE2 grouping chars
  if (containsPoE2Grouping(candidate)) return false;

  // Check that the candidate does NOT appear in any target-family token
  const lowerCandidate = candidate.toLowerCase();
  for (const token of allTokensInCategory) {
    const tTemplate = token.rawTextTemplate[locale];
    if (normalizeTemplate(tTemplate) === normalizedTargetTemplate) {
      // Same family — candidate MUST NOT appear here (would exclude our own tokens)
      if (token.rawText[locale].toLowerCase().includes(lowerCandidate)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Find a short universal marker that appears in ALL conflicting tokens
 * but NOT in any target-family token.
 *
 * Tries common Russian mod-structure markers:
 * - "Приспеш" (minion)
 * - " и" (compound separator)
 * - " ловк" (dexterity compound)
 * - " интел" (intelligence compound)
 * - First distinguishing word from conflicts
 */
function findShortUniversalMarker(
  conflictingTokens: NormalizedMod[],
  targetToken: NormalizedMod,
  allTokensInCategory: NormalizedMod[],
  locale: Locale,
  normalizedTargetTemplate: string
): string | null {
  const conflictingRawTexts = conflictingTokens.map(t => t.rawText[locale].toLowerCase());
  const targetRawLower = targetToken.rawText[locale].toLowerCase();

  // Try known short markers that commonly distinguish mod families
  const KNOWN_MARKERS = [
    'Приспеш',   // minion marker (covers all minion variants)
    'приспешники',
    ' ловк',     // dexterity compound
    ' интел',    // intelligence compound
    ' атак',     // attack compound
    ' закл',     // spell compound
    'состояния', // ailment/DOT marker ("Наносящие урон состояния")
    'заканчив',  // debuff duration marker ("Отрицательные эффекты ... заканчиваются")
    'воскреш',   // resurrect marker ("Приспешники воскрешаются")
    'во время',  // flask-effect marker ("во время действия любого флакона")
    'флакона',   // flask marker
    'умения',    // skill marker (vs "умений" etc.)
  ];

  for (const marker of KNOWN_MARKERS) {
    const lowerMarker = marker.toLowerCase();
    // Check: marker appears in ALL conflicting tokens
    const inAllConflicts = conflictingRawTexts.every(raw => raw.includes(lowerMarker));
    if (!inAllConflicts) continue;

    // Check: marker does NOT appear in target family
    if (targetRawLower.includes(lowerMarker)) continue;

    // Full validation
    if (isExcludeValid(marker, targetToken, allTokensInCategory, locale, normalizedTargetTemplate)) {
      return marker;
    }
  }

  // Try extracting distinguishing words from conflicts
  // Find words that appear in ALL conflicts but NOT in target
  const conflictWords = new Map<string, number>();
  for (const raw of conflictingRawTexts) {
    const uniqueWords = new Set(raw.split(/\s+/));
    for (const word of uniqueWords) {
      conflictWords.set(word, (conflictWords.get(word) || 0) + 1);
    }
  }

  // Words that appear in ALL conflicts
  const universalWords = [...conflictWords.entries()]
    .filter(([, count]) => count === conflictingTokens.length)
    .map(([word]) => word)
    .filter(word => word.length >= 3 && !targetRawLower.includes(word))
    .sort((a, b) => a.length - b.length); // Prefer shorter markers

  for (const word of universalWords) {
    if (isExcludeValid(word, targetToken, allTokensInCategory, locale, normalizedTargetTemplate)) {
      return word;
    }
  }

  return null;
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
