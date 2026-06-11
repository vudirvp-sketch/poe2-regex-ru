/**
 * Generate a PoE2 regex pattern that matches numbers >= the given threshold.
 * Ported from poe2.re's GenerateNumberRegex.ts.
 *
 * IMPORTANT: In PoE2 regex dialect, `.` matches ANY character (not just digits).
 * This means `.` CANNOT be used to represent "any digit" — it would match
 * letters, spaces, hyphens, %, etc. leading to false positives.
 *
 * All numeric patterns use `[0-9]` instead of `.` to ensure only actual digits
 * are matched. This makes patterns longer but CORRECT:
 *   WRONG: `[4-9].`     — matches "4-", "4a", "4 " etc.
 *   RIGHT: `[4-9][0-9]` — matches only "40"-"99"
 *
 * VERIFIED IN-GAME (Phase 10):
 * - \d is supported in PoE2 regex dialect (matches any single digit)
 * - {N,} quantifier is supported (e.g., \d{3,} = 3 or more digits)
 * - \d{3,} is used instead of [0-9][0-9][0-9] for "any 3+ digit number"
 *   Saves 9 chars per occurrence (6 vs 15) with identical semantics.
 * - \d{2,} is used instead of [0-9][0-9][0-9]? for "any 2+ digit number"
 *   The `?` quantifier is NOT supported in PoE2 — \d{2,} is both correct
 *   and shorter.
 * - [0-9] is still used for single-digit character classes and within
 *   decade segments (e.g., `3[0-9]` for 30-39) where \d would be ambiguous.
 *
 * Language-independent: operates on digit strings only.
 */
export function generateNumberRegex(number: string, round10: boolean): string {
  const numbers = number.match(/\d/g);
  if (numbers === null) return '';

  const quant = round10
    ? Math.floor(Number(numbers.join('')) / 10) * 10
    : Number(numbers.join(''));

  if (isNaN(quant) || quant === 0) {
    // round10 with single digit → any number (e.g., "5" with round10 → ≥0)
    // Use [0-9] which matches any single digit (more precise than .)
    if (round10 && numbers.length === 1) return '[0-9]';
    return '';
  }

  if (quant >= 100) return threeDigitMin(quant);

  if (quant > 9) {
    const str = quant.toString();
    const d0 = str[0], d1 = str[1];
    const D0 = Number(d0), D1 = Number(d1);

    if (D0 === 9) {
      // 90-99: "9[0-9]" matches 90-99, "\d{3,}" matches 100+
      if (d1 === '0') return `(9[0-9]|\\d{3,})`;
      if (D1 === 9) return `(99|\\d{3,})`;
      return `(9[${d1}-9]|\\d{3,})`;
    }
    // ≥N0: "[d0-9][0-9]" matches d0* to 99, "\d{3,}" matches 100+
    if (d1 === '0') return `([${d0}-9][0-9]|\\d{3,})`;
    // ≥Nd1: "d0[d1-9]" matches d0d1-d09, "[D0+1-9][0-9]" matches (d0+1)*-99
    //       "\d{3,}" matches 100+
    return `(${d0}[${d1}-9]|[${D0 + 1}-9][0-9]|\\d{3,})`;
  }

  if (quant <= 9) {
    // ≥N (single digit): "[N-9]" matches N-9 (1 digit),
    //   "\d{2,}" matches any 2+ digit number (10-99, 100-999, etc.)
    //   Previously used [0-9][0-9][0-9]? but `?` is NOT supported in PoE2.
    //   \d{2,} is correct (verified in-game), compact, and handles all 2+ digit cases.
    if (quant === 9) return `(9|\\d{2,})`;
    return `([${quant}-9]|\\d{2,})`;
  }
  return number;
}

/**
 * Generate a PoE2 regex pattern that matches numbers <= the given maximum.
 *
 * This is the inverse of generateNumberRegex: instead of matching "at least N",
 * it matches "at most N". The approach generates patterns that accept numbers
 * from 0 up to and including the max value.
 *
 * IMPORTANT: Uses [0-9] instead of `.` for digit matching.
 * `.` in PoE2 regex matches any character, not just digits.
 *
 * Examples:
 *   max=5  → "([0-5])"                  matches 0,1,2,3,4,5
 *   max=9  → "([0-9])"                  matches 0-9 (single digit)
 *   max=15 → "([0-9]|1[0-5])"           matches 0-9 or 10-15
 *   max=50 → "([0-9]|[1-4][0-9]|50)"    matches 0-9, 10-49, 50
 */
export function generateMaxNumberRegex(number: string, round10: boolean): string {
  const numbers = number.match(/\d/g);
  if (numbers === null) return '';

  let quant = Number(numbers.join(''));
  if (round10) {
    quant = Math.ceil(quant / 10) * 10;
  }

  if (isNaN(quant) || quant < 0) return '';

  if (quant === 0) return '(0)';

  if (quant >= 100) return threeDigitMax(quant);

  if (quant > 9) {
    return twoDigitMax(quant);
  }

  // Single digit: [0-quant]
  if (quant >= 9) return '([0-9])';
  return `([0-${quant}])`;
}

function twoDigitMax(n: number): string {
  const str = n.toString();
  const d0 = str[0], d1 = str[1];
  const D0 = Number(d0);

  // Special case: max is a round number like 10, 20, 30...
  if (d1 === '0') {
    // e.g., max=50 → "([0-9]|[1-4][0-9]|50)"
    // matches: 0-9, 10-49, 50
    if (D0 === 1) {
      return `([0-9]|10)`;
    }
    return `([0-9]|[1-${D0 - 1}][0-9]|${n})`;
  }

  // e.g., max=15 → "([0-9]|1[0-5])"
  // matches: 0-9, 10-15
  if (D0 === 1) {
    return `([0-9]|1[0-${d1}])`;
  }

  // e.g., max=25 → "([0-9]|1[0-9]|2[0-5])"
  // matches: 0-9, 10-19, 20-25
  if (D0 > 1) {
    // matches: 0-9, 10-(D0-1)9, D0*0-D0*d1
    const prefixPart = D0 > 2 ? `[1-${D0 - 1}][0-9]` : '1[0-9]';
    return `([0-9]|${prefixPart}|${d0}[0-${d1}])`;
  }

  return `([0-9]|${d0}[0-${d1}])`;
}

function threeDigitMax(n: number): string {
  const str = n.toString();
  const d0 = str[0], d1 = str[1], d2 = str[2];
  const D0 = Number(d0);

  // Round hundreds: 100, 200, etc.
  if (d1 === '0' && d2 === '0') {
    if (D0 === 1) {
      return `([0-9]|[1-9][0-9]|100)`;
    }
    return `([0-9]|[1-9][0-9]|[1-${D0 - 1}][0-9][0-9]|${n})`;
  }

  // General 3-digit: 0-9, 10-99, 100-n
  if (D0 === 1) {
    // 100-1d1d2
    if (d1 === '0') {
      // e.g., 105 → 0-9, 10-99, 100-105
      return `([0-9]|[1-9][0-9]|10[0-${d2}])`;
    }
    // e.g., 150 → 0-9, 10-99, 100-149, 150
    if (d2 === '0') {
      return `([0-9]|[1-9][0-9]|1[0-${Number(d1) - 1}][0-9]|${n})`;
    }
    // e.g., 125 → 0-9, 10-99, 100-119, 120-125
    const prevD1 = Number(d1) > 0 ? Number(d1) - 1 : 0;
    if (prevD1 === 0) {
      return `([0-9]|[1-9][0-9]|10[0-9]|1${d1}[0-${d2}])`;
    }
    return `([0-9]|[1-9][0-9]|1[0-${prevD1}][0-9]|1${d1}[0-${d2}])`;
  }

  // D0 > 1: need to cover 0-9, 10-99, 100-(D0-1)99, D0*00-n
  const prevDigits = D0 > 2 ? `[1-${D0 - 1}][0-9][0-9]` : '1[0-9][0-9]';

  // Round hundreds: 200, 300, etc.
  if (d1 === '0' && d2 === '0') {
    return `([0-9]|[1-9][0-9]|${prevDigits}|${n})`;
  }

  // D0 > 1 with d1 === '0' but d2 !== '0': e.g., 205 → 0-9, 10-99, 100-199, 200-205
  if (d1 === '0') {
    return `([0-9]|[1-9][0-9]|${prevDigits}|${d0}0[0-${d2}])`;
  }

  // D0 > 1 with d2 === '0': e.g., 250 → 0-9, 10-99, 100-199, 200-249, 250
  if (d2 === '0') {
    const prevD1 = Number(d1) - 1;
    if (prevD1 === 0) {
      return `([0-9]|[1-9][0-9]|${prevDigits}|${d0}0[0-9]|${n})`;
    }
    return `([0-9]|[1-9][0-9]|${prevDigits}|${d0}[0-${prevD1}][0-9]|${n})`;
  }

  // D0 > 1 general: e.g., 275 → 0-9, 10-99, 100-199, 200-269, 270-275
  const prevD1 = Number(d1) - 1;
  if (prevD1 === 0) {
    return `([0-9]|[1-9][0-9]|${prevDigits}|${d0}0[0-9]|${d0}${d1}[0-${d2}])`;
  }
  return `([0-9]|[1-9][0-9]|${prevDigits}|${d0}[0-${prevD1}][0-9]|${d0}${d1}[0-${d2}])`;
}

/**
 * Maximum number of values to enumerate in a range.
 * Beyond this threshold, fall back to AND(min, max) approach.
 * The value 50 balances precision vs regex length:
 * - 50 two-digit values → ~200 chars (fits 250-char budget with short suffix)
 * - Narrow ranges [27,30] → 4 values → ~15 chars (very compact)
 */
export const MAX_ENUMERATE_RANGE = 50;

/**
 * Generate a PoE2 regex pattern that matches EXACTLY the values in [min, max].
 * Uses compact "decade grouping" for ranges spanning multiple tens,
 * falling back to flat enumeration for small or cross-digit-boundary ranges.
 *
 * WHY ENUMERATION: The character-class-based approach (e.g., (2[7-9]|[3-9][0-9]))
 * can produce false positives when PoE2 item text contains range notation like
 * "26(26-50)% шанс откладывания наград". The number "50" in the range notation
 * matches the ≥27 pattern, creating a false positive. Enumeration avoids this by
 * listing only the exact valid values.
 *
 * DECade GROUPING OPTIMIZATION (Phase 10):
 * Instead of listing every value (e.g., "(27|28|29|30|31|...|52)" = ~95 chars),
 * groups consecutive values by tens digit using character classes:
 *   (2[7-9]|3[0-9]|4[0-9]|5[0-2])  = ~28 chars
 * This is semantically equivalent (matches exactly the same set of numbers)
 * but dramatically shorter, allowing precise enumeration for wider ranges.
 *
 * Full decades (e.g., 30-39) become "3[0-9]"; partial decades (e.g., 27-29)
 * become "2[7-9]". Single-digit partial decades use just the digit, e.g., 50-52
 * becomes "5[0-2]". Cross-digit-boundary ranges (e.g., 95-105 spanning 2→3 digits)
 * fall back to flat enumeration for those boundary segments.
 *
 * VERIFIED IN-GAME (Phase 9):
 * - OR of literals "A|B|C" inside a single quoted group works correctly
 * - Single enumerated group "(27|28|29|30).*suffix" matches precisely [27,30]
 * - AND of two quoted groups for the SAME suffix does NOT work as numeric range
 *   (each group can match a different number in the same block)
 *
 * Returns null if the range exceeds MAX_ENUMERATE_RANGE — caller should fall
 * back to the AND(min, max) approach with documented limitations.
 */
export function generateEnumeratedRangeRegex(min: number, max: number): string | null {
  if (min > max) return null;
  const range = max - min + 1;
  if (range > MAX_ENUMERATE_RANGE) return null;

  // Single value — no grouping needed
  if (min === max) return min.toString();

  // Two values — simple alternation is shorter than character class grouping
  if (range === 2) return `(${min}|${max})`;

  // Try compact decade grouping for ranges spanning multiple tens
  const compact = generateCompactEnumeration(min, max);
  if (compact) return compact;

  // Fallback: flat enumeration for cross-digit-boundary or small ranges
  const values: string[] = [];
  for (let v = min; v <= max; v++) {
    values.push(v.toString());
  }
  return `(${values.join('|')})`;
}

/**
 * Generate compact enumeration using decade grouping.
 *
 * Groups values by their tens digit (decade) and generates character-class
 * patterns for each decade:
 *   27-52 → (2[7-9]|3[0-9]|4[0-9]|5[0-2])
 *   40-80 → (4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0])
 *
 * Rules:
 * - Full decade (X0-X9) → "X[0-9]"
 * - Partial decade at start (Xd1-X9) → "X[d1-9]"
 * - Partial decade at end (X0-Xd2) → "X[0-d2]"
 * - Single value in decade (Xd) → "Xd" (literal, no char class)
 * - Two consecutive values in decade (Xd1|Xd2) → "X[d1-d2]"
 *
 * Returns null if the range spans different digit lengths (e.g., 95-105)
 * and cannot be compactly represented — caller falls back to flat enumeration.
 */
function generateCompactEnumeration(min: number, max: number): string | null {
  // All values must have the same number of digits for decade grouping to work.
  // Cross-digit-boundary ranges (e.g., 95-105) need special handling.
  const minDigits = min.toString().length;
  const maxDigits = max.toString().length;

  if (minDigits !== maxDigits) {
    // Split at digit boundary: process each digit-length separately
    const boundary = Math.pow(10, minDigits); // e.g., 100 for 2-digit min
    const lowerPart = generateCompactEnumeration(min, boundary - 1);
    const upperPart = generateCompactEnumeration(boundary, max);

    if (lowerPart && upperPart) {
      // Unwrap outer parens from each part and combine
      const lowerInner = unwrapParens(lowerPart);
      const upperInner = unwrapParens(upperPart);
      return `(${lowerInner}|${upperInner})`;
    }
    // If either part can't be compact, return null (fall back to flat)
    return null;
  }

  // Same digit length — group by decade
  const segments: string[] = [];

  if (minDigits === 1) {
    // Single-digit range: [3, 7] → "[3-7]", [3, 9] → "[3-9]"
    if (min === max) return min.toString();
    if (min === 0 && max === 9) return '[0-9]';
    return `[${min}-${max}]`;
  }

  if (minDigits === 2) {
    // Two-digit range: group by tens digit
    let current = min;
    while (current <= max) {
      const tensDigit = Math.floor(current / 10);
      const decadeStart = tensDigit * 10;
      const decadeEnd = decadeStart + 9;
      const segEnd = Math.min(decadeEnd, max);

      const segment = generateDecadeSegment(tensDigit, current % 10, segEnd % 10, segEnd - current + 1);
      segments.push(segment);

      current = segEnd + 1;
    }
  } else if (minDigits === 3) {
    // Three-digit range: group by hundreds+tens digit
    let current = min;
    while (current <= max) {
      const hundredsDigit = Math.floor(current / 100);
      const tensDigit = Math.floor((current % 100) / 10);
      const decadeStart = hundredsDigit * 100 + tensDigit * 10;
      const decadeEnd = decadeStart + 9;
      const segEnd = Math.min(decadeEnd, max);

      const prefix = `${hundredsDigit}${tensDigit}`;
      const segment = generateDecadeSegment2(prefix, current % 10, segEnd % 10, segEnd - current + 1);
      segments.push(segment);

      current = segEnd + 1;
    }
  } else {
    // 4+ digit ranges — fall back to flat enumeration
    return null;
  }

  if (segments.length === 0) return null;

  if (segments.length === 1) {
    // Single segment — no need for grouping parens
    // A character class like "3[0-9]" or "2[7-9]" works without outer parens
    return segments[0];
  }

  return `(${segments.join('|')})`;
}

/**
 * Unwrap outer parentheses from a regex pattern string.
 * "(2[7-9]|30)" → "2[7-9]|30"
 * "[1-9]" → "[1-9]" (no outer parens, returned as-is)
 * "27" → "27" (no parens, returned as-is)
 */
function unwrapParens(s: string): string {
  if (s.startsWith('(') && s.endsWith(')')) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Generate a decade segment for a two-digit number range.
 * @param tensDigit - The tens digit (e.g., 3 for 30-39)
 * @param startOnes - The starting ones digit within this decade
 * @param endOnes - The ending ones digit within this decade
 * @param count - Number of values in this segment
 */
function generateDecadeSegment(tensDigit: number, startOnes: number, endOnes: number, count: number): string {
  if (count === 1) {
    // Single value: "27"
    return `${tensDigit}${startOnes}`;
  }
  if (startOnes === 0 && endOnes === 9) {
    // Full decade: "3[0-9]"
    return `${tensDigit}[0-9]`;
  }
  // Partial decade: "2[7-9]", "5[0-2]"
  if (startOnes === endOnes) {
    return `${tensDigit}${startOnes}`;
  }
  return `${tensDigit}[${startOnes}-${endOnes}]`;
}

/**
 * Generate a decade segment for a three-digit number range.
 * @param prefix - The first two digits as string (e.g., "12" for 120-129)
 * @param startOnes - The starting ones digit within this decade
 * @param endOnes - The ending ones digit within this decade
 * @param count - Number of values in this segment
 */
function generateDecadeSegment2(prefix: string, startOnes: number, endOnes: number, count: number): string {
  if (count === 1) {
    return `${prefix}${startOnes}`;
  }
  if (startOnes === 0 && endOnes === 9) {
    return `${prefix}[0-9]`;
  }
  if (startOnes === endOnes) {
    return `${prefix}${startOnes}`;
  }
  return `${prefix}[${startOnes}-${endOnes}]`;
}

function threeDigitMin(n: number): string {
  const str = n.toString();
  const d0 = str[0], d1 = str[1], d2 = str[2];
  const D0 = Number(d0), D1 = Number(d1);

  if (d1 === '0' && d2 === '0') {
    // Round hundreds: ≥N00
    if (D0 === 9) return `(9[0-9][0-9]|\\d{4,})`;  // 900-999 + 1000+
    if (D0 === 1) return `\\d{3,}`;                   // ≥100: any 3+ digit number
    return `([${d0}-9][0-9][0-9]|\\d{4,})`;            // e.g., ≥300: 300-999 + 1000+
  }

  let head: string;
  if (d2 === '0') {
    head = d1 === '9' ? `${d0}9[0-9]` : `${d0}[${d1}-9][0-9]`;
  } else if (d1 === '0') {
    head = `${d0}(0[${d2}-9]|[1-9][0-9])`;
  } else if (d1 === '9' && d2 === '9') {
    head = `${d0}99`;
  } else if (d1 === '9') {
    head = `${d0}9[${d2}-9]`;
  } else {
    head = `${d0}(${d1}[${d2}-9]|[${D1 + 1}-9][0-9])`;
  }
  return D0 === 9 ? head : `(${head}|[${D0 + 1}-9][0-9][0-9]|\\d{4,})`;
}
