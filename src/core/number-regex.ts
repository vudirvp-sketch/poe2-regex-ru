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
