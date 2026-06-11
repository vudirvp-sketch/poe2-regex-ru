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
 *
 * Module structure (since iteration 18):
 *   compute-regex.ts          — Entry point: types + main algorithm + re-exports
 *   compute-regex-core.ts     — Template extraction, uniqueness, PoE2 validation, text utils
 *   compute-regex-strategies.ts — Strategy implementations: fallback, truncation, excludes, yofication
 */
import type { Locale } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';
import {
  normalizeTemplate,
  extractTemplateSuffix,
  extractExtendedSuffix,
  extractTemplatePrefix,
  isSuffixUniqueInCategory,
  findShortestUniqueSuffix,
  containsPoE2Grouping,
  regexMatchesRawText,
  MIN_REGEX_LEN_DEFAULT,
  STRICT_CATEGORIES_MIN_LEN,
} from './compute-regex-core.js';
import {
  tryWordTruncation,
  computeExcludePatterns,
  substringSearchFallback,
  checkYofication,
} from './compute-regex-strategies.js';

// ─── Re-exports for backward compatibility ───
// compute-optimizations.ts and test files import these from compute-regex
export { containsPoE2Grouping, normalizeTemplate } from './compute-regex-core.js';
export { generateTruncatedSuffixes } from './compute-regex-strategies.js';

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
