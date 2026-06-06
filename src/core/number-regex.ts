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
 * Uses [0-9] instead of \d for maximum compatibility — \d was verified once
 * in PoE2 but [0-9] is guaranteed to work in the PoE2 regex dialect.
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
      // 90-99: "9[0-9]" matches 90-99, "[0-9][0-9][0-9]" matches 100-999
      if (d1 === '0') return `(9[0-9]|[0-9][0-9][0-9])`;
      if (D1 === 9) return `(99|[0-9][0-9][0-9])`;
      return `(9[${d1}-9]|[0-9][0-9][0-9])`;
    }
    // ≥N0: "[d0-9][0-9]" matches d0* to 99, "[0-9][0-9][0-9]" matches 100-999
    if (d1 === '0') return `([${d0}-9][0-9]|[0-9][0-9][0-9])`;
    // ≥Nd1: "d0[d1-9]" matches d0d1-d09, "[D0+1-9][0-9]" matches (d0+1)*-99
    //       "[0-9][0-9][0-9]" matches 100-999
    return `(${d0}[${d1}-9]|[${D0 + 1}-9][0-9]|[0-9][0-9][0-9])`;
  }

  if (quant <= 9) {
    // ≥N (single digit): "[N-9]" matches N-9 (1 digit),
    //   "[0-9][0-9]" matches 10-99 (2 digits),
    //   "[0-9][0-9][0-9]?" matches 100-999 (3 digits, optional last digit)
    //   Actually for ≥1: we need 1-9, 10-99, 100-999
    //   "[N-9]" = single digit N-9
    //   "[0-9][0-9]" = any two-digit number (10-99)
    //   "[0-9][0-9][0-9]" = any three-digit number (100-999)
    if (quant === 9) return `([9]|[0-9][0-9][0-9]?)`;
    return `([${quant}-9]|[0-9][0-9][0-9]?)`;
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

  if (isNaN(quant) || quant <= 0) return '';

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

  // D0 > 1: e.g., 250 → 0-9, 10-99, 100-199, 200-249, 250
  if (d1 === '0' && d2 === '0') {
    return `([0-9]|[1-9][0-9]|[1-${D0 - 1}][0-9][0-9]|${n})`;
  }
  // e.g., 250 → 0-9, 10-99, 100-199, 200-249, 250
  // More general:
  return `([0-9]|[1-9][0-9]|[1-${D0 - 1}][0-9][0-9]|${n})`;
}

function threeDigitMin(n: number): string {
  const str = n.toString();
  const d0 = str[0], d1 = str[1], d2 = str[2];
  const D0 = Number(d0), D1 = Number(d1);

  if (d1 === '0' && d2 === '0') {
    if (D0 === 9) return `${d0}[0-9][0-9]`;
    if (D0 === 1) return `([1-9][0-9][0-9])`;
    return `[${d0}-9][0-9][0-9]`;
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
  return D0 === 9 ? head : `(${head}|[${D0 + 1}-9][0-9][0-9])`;
}
