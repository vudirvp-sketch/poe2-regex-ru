/**
 * Generate a PoE2 regex pattern that matches numbers >= the given threshold.
 * Ported 1:1 from poe2.re's GenerateNumberRegex.ts
 * Language-independent: operates on digit strings only.
 */
export function generateNumberRegex(number: string, round10: boolean): string {
  const numbers = number.match(/\d/g);
  if (numbers === null) return '';

  const quant = round10
    ? Math.floor(Number(numbers.join('')) / 10) * 10
    : Number(numbers.join(''));

  if (isNaN(quant) || quant === 0) {
    if (round10 && numbers.length === 1) return '.';
    return '';
  }

  if (quant >= 100) return threeDigitMin(quant);

  if (quant > 9) {
    const str = quant.toString();
    const d0 = str[0], d1 = str[1];
    const D0 = Number(d0), D1 = Number(d1);

    if (D0 === 9) {
      // 90-99: use 9[d1-9] pattern instead of [9-9].
      if (d1 === '0') return `(9[0-9]|\\d..)`;
      if (D1 === 9) return `(99|\\d..)`;
      return `(9[${d1}-9]|\\d..)`;
    }
    if (d1 === '0') return `([${d0}-9].|\\d..)`;
    return `(${d0}[${d1}-9]|[${D0 + 1}-9].|\\d..)`;
  }

  if (quant <= 9) {
    if (quant === 9) return `([9]|\\d..?)`;
    return `([${quant}-9]|\\d..?)`;
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
 * Examples:
 *   max=5  → "([0-5])"         matches 0,1,2,3,4,5
 *   max=9  → "([0-9])"         matches 0-9 (single digit)
 *   max=15 → "([0-9]|1[0-5])"  matches 0-9 or 10-15
 *   max=50 → "([0-9]|[1-4].|50)" matches 0-9, 10-49, 50
 *
 * Like generateNumberRegex, the `.` wildcard in PoE2 regex matches any character,
 * so "[1-4]." matches 10-49 (digit + any char = two-digit number starting with 1-4).
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
    // e.g., max=50 → "([0-9]|[1-4].|50)"
    // matches: 0-9, 10-49, 50
    if (D0 === 1) {
      return `([0-9]|10)`;
    }
    return `([0-9]|[1-${D0 - 1}].|${n})`;
  }

  // e.g., max=15 → "([0-9]|1[0-5])"
  // matches: 0-9, 10-15
  if (D0 === 1) {
    return `([0-9]|1[0-${d1}])`;
  }

  // e.g., max=25 → "([0-9]|[12].|2[0-5])"
  // Wait, we need: 0-9, 10-19, 20-25
  // But [1-2]. matches 10-29 (too much). Need more precise.
  // Actually: 0-9, 10-19 (=[1].), 20-25 (=[2][0-5])
  if (D0 > 1) {
    // matches: 0-9, 10-(D0-1)9, D0*0-D0*d1
    const prefixPart = D0 > 2 ? `[1-${D0 - 1}].` : '1.';
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
      return `([0-9]|[1-9].|100)`;
    }
    return `([0-9]|[1-9].|[1-${D0 - 1}]..|${n})`;
  }

  // General 3-digit: 0-9, 10-99, 100-n
  if (D0 === 1) {
    // 100-1d1d2
    if (d1 === '0') {
      // e.g., 105 → 0-9, 10-99, 100-105
      return `([0-9]|[1-9].|10[0-${d2}])`;
    }
    // e.g., 150 → 0-9, 10-99, 100-149, 150
    if (d2 === '0') {
      return `([0-9]|[1-9].|1[0-${Number(d1) - 1}].|${n})`;
    }
    // e.g., 125 → 0-9, 10-99, 100-119, 120-125
    const prevD1 = Number(d1) > 0 ? Number(d1) - 1 : 0;
    if (prevD1 === 0) {
      return `([0-9]|[1-9].|10[0-9]|1${d1}[0-${d2}])`;
    }
    return `([0-9]|[1-9].|1[0-${prevD1}].|1${d1}[0-${d2}])`;
  }

  // D0 > 1: e.g., 250 → 0-9, 10-99, 100-199, 200-249, 250
  if (d1 === '0' && d2 === '0') {
    return `([0-9]|[1-9].|[1-${D0 - 1}]..|${n})`;
  }
  // e.g., 250 → 0-9, 10-99, 100-199, 200-249, 250
  // But 250 = 2,5,0 → d1='5', d2='0'
  // More general:
  return `([0-9]|[1-9].|[1-${D0 - 1}]..|${n})`;
}

function threeDigitMin(n: number): string {
  const str = n.toString();
  const d0 = str[0], d1 = str[1], d2 = str[2];
  const D0 = Number(d0), D1 = Number(d1);

  if (d1 === '0' && d2 === '0') {
    if (D0 === 9) return `${d0}..`;
    if (D0 === 1) return `([1-9]..)`;
    return `[${d0}-9]..`;
  }

  let head: string;
  if (d2 === '0') {
    head = d1 === '9' ? `${d0}9.` : `${d0}[${d1}-9].`;
  } else if (d1 === '0') {
    head = `${d0}(0[${d2}-9]|[1-9].)`;
  } else if (d1 === '9' && d2 === '9') {
    head = `${d0}99`;
  } else if (d1 === '9') {
    head = `${d0}9[${d2}-9]`;
  } else {
    head = `${d0}(${d1}[${d2}-9]|[${D1 + 1}-9].)`;
  }
  return D0 === 9 ? head : `(${head}|[${D0 + 1}-9]..)`;
}
