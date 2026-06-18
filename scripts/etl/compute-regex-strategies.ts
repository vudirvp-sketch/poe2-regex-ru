/**
 * Strategy implementations for compute-regex: substring search fallback,
 * word truncation, exclude patterns, yofication.
 *
 * Split from compute-regex.ts for focused context when AI agents need to
 * modify specific strategies without loading the entire pipeline.
 */
import type { Locale } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';
import type { RegexResult } from './compute-regex.js';
import {
  normalizeTemplate,
  extractTemplatePrefix,
  isSuffixUniqueInCategory,
  containsPoE2Grouping,
  regexMatchesRawText,
  getAllTexts,
  buildSubstringSet,
  MIN_REGEX_LEN_DEFAULT,
} from './compute-regex-core.js';

// ─── Strategy 1e: Word Truncation ───

/**
 * Try word truncation to shorten the suffix, then add negation.
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
export function tryWordTruncation(
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
 * Generate valid truncated suffix variants by removing trailing chars
 * from the LAST word only, respecting minimum length constraints.
 *
 * Rules (verified in-game Phase 8):
 * - Only the LAST word in the suffix can be truncated: "силе"→"сил"→"си"
 * - Truncating a non-last word breaks contiguous substring matching in PoE2
 *   (the removed characters create a gap between the truncated word and the next)
 * - Each word must retain ≥3 significant chars
 * - The overall suffix must be ≥ minLen characters
 * - Leading words can be dropped entirely (phrase truncation from the left)
 *
 * IMPORTANT: Only the LAST word is truncated because PoE2 uses contiguous
 * substring search. If "монстров" is in the middle of "монстров на карте",
 * truncating it to "монстр" produces "монстр на карте" which is NOT a
 * contiguous substring of "монстров на карте" (the "ов" creates a gap).
 * But "количества редких монстров" → "количества редких монстр" IS valid
 * because "монстр" is at the end and is a leading prefix of "монстров".
 *
 * @returns Array of truncated suffix strings, ordered from longest to shortest
 */
export function generateTruncatedSuffixes(suffix: string, minLen: number): string[] {
  const results: string[] = [];
  const words = suffix.split(/\s+/);

  // Phase 1: Truncate only the LAST word (keeping all other words at full length)
  // This preserves the contiguous substring property required by PoE2 search.
  // Previous implementation used cartesian product over all word positions,
  // generating mid-phrase truncation candidates that break contiguity.
  // Those were filtered by matchQuotedGroup() validation downstream, but
  // this was wasteful and violated the documented constraint.
  if (words.length > 0) {
    const lastWord = words[words.length - 1];
    const prefix = words.slice(0, -1).join(' ');
    const prefixPart = prefix ? prefix + ' ' : '';

    // Truncate last word from the end: "огню"→"огн", "силе"→"сил"→"си"
    for (let len = lastWord.length - 1; len >= 3; len--) {
      const candidate = prefixPart + lastWord.substring(0, len);
      if (candidate.length >= minLen && candidate !== suffix) {
        results.push(candidate);
      }
    }
  }

  // Phase 2: Try dropping leading words (phrase truncation from left)
  // "к силе" → "силе" (drop "к"), "к сопротивлению огню" → "сопротивлению огню" → "огню"
  // Then truncate only the LAST word of the remaining phrase.
  for (let skipWords = 1; skipWords < words.length; skipWords++) {
    const remaining = words.slice(skipWords).join(' ');
    if (remaining.length >= minLen && remaining !== suffix) {
      results.push(remaining);

      // Truncate only the last word of the remaining phrase
      const subWords = remaining.split(/\s+/);
      const subLastWord = subWords[subWords.length - 1];
      const subPrefix = subWords.slice(0, -1).join(' ');
      const subPrefixPart = subPrefix ? subPrefix + ' ' : '';

      for (let len = subLastWord.length - 1; len >= 3; len--) {
        const candidate = subPrefixPart + subLastWord.substring(0, len);
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

// ─── Strategy 2: Substring Search Fallback ───

/**
 * Original substring search algorithm (fallback).
 * Finds the shortest unique substring of the rawText
 * among all other tokens in the category.
 */
export function substringSearchFallback(
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

// ─── Yofication ───

/**
 * Check yofication for template-based regex.
 * Replaces 'е' with '[её]' at yofication positions if it keeps the regex unique.
 */
export function checkYofication(
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
    const yoficatedCandidate = bestCandidate;
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

// ─── Exclude Patterns (Strategy 1d) ───

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
export function computeExcludePatterns(
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
export function isExcludeValid(
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
