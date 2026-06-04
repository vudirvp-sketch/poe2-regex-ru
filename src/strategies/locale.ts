import type { GenderForms } from '@shared/types';

/**
 * Replace 'е' (Cyrillic) with '[её]' at marked positions,
 * but ONLY if character budget allows.
 * Each replacement costs 3 extra characters.
 */
export function applyYofication(
  text: string,
  positions: number[],
  canAfford: (extraChars: number) => boolean
): string {
  let result = text;
  let offset = 0;
  for (const pos of positions) {
    if (canAfford(3)) {
      const adjustedPos = pos + offset;
      result = result.slice(0, adjustedPos) + '[её]' + result.slice(adjustedPos + 1);
      offset += 3;  // 'е' (1 char) -> '[её]' (4 chars) = +3
    }
  }
  return result;
}

/**
 * Select the shortest unique form from gender variants.
 * Used to find the most compact regex representation.
 */
export function selectShortestForm(forms: GenderForms): string {
  const allForms = [forms.ms, forms.fs, forms.ns, forms.mp, forms.fp, forms.np]
    .filter((f): f is string => f !== undefined);
  if (allForms.length === 0) return '';
  return allForms.reduce((shortest, current) =>
    current.length < shortest.length ? current : shortest
  );
}

/**
 * Extract all gender form values from a GenderForms object.
 * Returns an array of all defined forms.
 */
export function getAllGenderForms(forms: GenderForms): string[] {
  return [forms.ms, forms.fs, forms.ns, forms.mp, forms.fp, forms.np]
    .filter((f): f is string => f !== undefined);
}
