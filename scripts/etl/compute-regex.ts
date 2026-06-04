/**
 * Compute minimal unique substrings for each token in a category.
 *
 * This is the most critical algorithm in the entire project.
 * For each token, find the shortest substring that uniquely identifies it
 * among all other tokens in the same category.
 */
import type { Locale } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';

export interface RegexResult {
  regex: string;
  hasYofication: boolean;
  yoficationPositions: number[];
}

/**
 * Compute minimal unique substring for a target token
 * among all tokens in its category.
 *
 * Algorithm:
 * 1. Get all candidate texts (rawText + all gender forms) for target and all other tokens
 * 2. Build a set of ALL substrings of exclusion texts for O(1) lookup
 * 3. Try all substrings of target, starting from shortest
 * 4. Among shortest unique substrings, prefer end-of-word, no-space substrings
 * 5. Check [её] variant if applicable
 */
export function computeMinimalUniqueSubstring(
  targetToken: NormalizedMod,
  allTokensInCategory: NormalizedMod[],
  locale: Locale = 'ru'
): RegexResult {
  // Get target texts (lowercase)
  const targetTexts = getAllTexts(targetToken, locale).map(t => t.toLowerCase());
  if (targetTexts.length === 0 || targetTexts.every(t => t === '')) {
    return { regex: '', hasYofication: false, yoficationPositions: [] };
  }

  // Get exclusion texts (all other tokens' texts, lowercase)
  const exclusionTexts: string[] = [];
  for (const token of allTokensInCategory) {
    if (token.id === targetToken.id) continue;
    const texts = getAllTexts(token, locale).map(t => t.toLowerCase());
    exclusionTexts.push(...texts);
  }

  // Build exclusion substring set for O(1) lookup
  const exclusionSubstrings = buildSubstringSet(exclusionTexts, 30);

  // Try to find minimal unique substring
  // Use the primary rawText as the search target
  const primaryText = targetToken.rawText[locale].toLowerCase();

  let bestCandidate = '';
  let bestScore = Infinity;

  // Minimum regex length: 3 characters for meaningful matching.
  // 1-2 char regexes are too generic and would match too broadly in PoE2 search.
  const MIN_REGEX_LEN = 3;

  // Try all substrings starting from minimum length
  for (let length = MIN_REGEX_LEN; length <= primaryText.length; length++) {
    let foundForThisLength = false;

    for (let start = 0; start <= primaryText.length - length; start++) {
      const candidate = primaryText.substring(start, start + length);

      // Skip candidates that are just spaces or very common
      if (candidate.trim().length < MIN_REGEX_LEN) continue;

      // Skip candidates that are purely numeric (not useful as regex)
      if (/^\d+$/.test(candidate.trim())) continue;

      // Check uniqueness against exclusion set
      if (!exclusionSubstrings.has(candidate)) {
        // Score: prefer end-of-word substrings, no spaces
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

  // If no unique substring found, try gender form texts
  if (!bestCandidate) {
    for (const formText of targetTexts.slice(1)) {
      if (formText === primaryText) continue;
      const lowerForm = formText.toLowerCase();
      for (let length = MIN_REGEX_LEN; length <= lowerForm.length; length++) {
        let found = false;
        for (let start = 0; start <= lowerForm.length - length; start++) {
          const candidate = lowerForm.substring(start, start + length);
          if (candidate.trim().length < MIN_REGEX_LEN) continue;
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

  // Fallback: use full text if no unique substring found
  if (!bestCandidate) {
    bestCandidate = primaryText;
  }

  // Check [её] variant
  let hasYofication = false;
  const yoficationPositions: number[] = [];

  if (targetToken.hasYofication && targetToken.yoficationPositions.length > 0) {
    // Check if replacing 'е' with '[её]' at yofication positions would still be unique
    let yoficatedCandidate = bestCandidate;
    for (const pos of targetToken.yoficationPositions) {
      // Find the corresponding position in the candidate
      const candidatePos = bestCandidate.indexOf(primaryText[pos]);
      if (candidatePos !== -1 && !exclusionSubstrings.has(
        yoficatedCandidate.slice(0, candidatePos) + '[её]' + yoficatedCandidate.slice(candidatePos + 1)
      )) {
        hasYofication = true;
        yoficationPositions.push(candidatePos);
      }
    }
  }

  return { regex: bestCandidate, hasYofication, yoficationPositions };
}

/**
 * Compute regex for all tokens in a category
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
 * Get all text representations of a token (rawText + all gender forms)
 */
function getAllTexts(token: NormalizedMod, locale: Locale): string[] {
  const texts: string[] = [];

  // Primary text
  texts.push(token.rawText[locale]);

  // Gender forms
  const forms = token.genderForms[locale];
  if (forms) {
    const genderKeys = ['ms', 'fs', 'ns', 'mp', 'fp', 'np'] as const;
    for (const key of genderKeys) {
      if (forms[key]) {
        texts.push(forms[key]!);
      }
    }
  }

  // Template text (with ## and #) is also useful for uniqueness checking
  texts.push(token.rawTextTemplate[locale]);

  return texts.filter(t => t.length > 0);
}

/**
 * Build a set of all substrings (up to maxLen) of all given texts.
 * Used for O(1) exclusion checking.
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
