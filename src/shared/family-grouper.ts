/**
 * Family Grouper — Groups GameTokens by familyKey + affix (Family Pooling).
 *
 * Multiple tiers of the same mod (e.g., "+(5—8) к силе", "+(9—12) к силе", "+(13—16) к силе")
 * share the same familyKey ("+# к силе") and produce the same regex ("к силе").
 * Grouping them into FamilyGroups reduces visual clutter and makes the UI more usable.
 *
 * Key grouping: `familyKey.ru + affix` — some families have both prefix and suffix variants
 * which are different mods in-game occupying different affix slots.
 *
 * Display text: Takes the familyKey template and substitutes each `#` placeholder
 * with the global min—max range across all members.
 */
import type { GameToken, AffixType, FamilyGroup } from './types';

/**
 * Parse a rawTextTemplate to extract placeholder info.
 * Returns an array of { type: 'range' | 'value', index: number } in left-to-right order.
 *
 * `##` → range placeholder (consumes one entry from `ranges[]`)
 * `#` (standalone, not part of `##`) → value placeholder (consumes one entry from `values[]`)
 */
function parseTemplatePlaceholders(template: string): Array<{ type: 'range' | 'value'; index: number }> {
  const placeholders: Array<{ type: 'range' | 'value'; index: number }> = [];
  let rangeIdx = 0;
  let valueIdx = 0;
  let i = 0;

  while (i < template.length) {
    if (i + 1 < template.length && template[i] === '#' && template[i + 1] === '#') {
      placeholders.push({ type: 'range', index: rangeIdx++ });
      i += 2; // skip both #
    } else if (template[i] === '#') {
      placeholders.push({ type: 'value', index: valueIdx++ });
      i += 1;
    } else {
      i += 1;
    }
  }

  return placeholders;
}

/**
 * Extract numeric values that a token contributes to each slot position
 * in the familyKey template.
 *
 * Returns an array of [min, max] pairs, one per `#` in the familyKey,
 * representing the range of values this token contributes to that slot.
 */
function extractSlotValues(
  token: GameToken,
  numSlots: number,
  memberPlaceholders: Array<{ type: 'range' | 'value'; index: number }>
): number[][] {
  const slots: number[][] = Array.from({ length: numSlots }, () => []);

  for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
    // The familyKey has all # placeholders; the member template has ## and # mixed.
    // We match by the logical position: the N-th placeholder in the familyKey
    // corresponds to the N-th placeholder in the member template.
    const memberPh = memberPlaceholders[slotIdx];
    if (!memberPh) continue;

    if (memberPh.type === 'range') {
      const range = token.ranges[memberPh.index];
      if (range) {
        slots[slotIdx].push(range[0], range[1]);
      }
    } else {
      const val = token.values[memberPh.index];
      if (val !== undefined) {
        slots[slotIdx].push(val);
      }
    }
  }

  return slots;
}

/**
 * Generate display text by substituting global ranges into the familyKey template.
 *
 * Each `#` in the familyKey is replaced with `(globalMin—globalMax)`.
 * If a slot has no values (e.g., token with no ranges/values), the `#` is kept as-is.
 */
function generateDisplayText(
  familyKey: string,
  rangeSlots: number[][]
): string {
  let result = '';
  let slotIdx = 0;
  let i = 0;

  while (i < familyKey.length) {
    if (familyKey[i] === '#') {
      const slot = rangeSlots[slotIdx];
      if (slot && slot.length >= 2) {
        const min = Math.min(...slot);
        const max = Math.max(...slot);
        if (min === max) {
          result += String(min);
        } else {
          result += `(${min}—${max})`;
        }
      } else {
        // No numeric data — keep the placeholder
        result += '#';
      }
      slotIdx++;
      i++;
    } else {
      result += familyKey[i];
      i++;
    }
  }

  return result;
}

/**
 * Group tokens by familyKey + affix and compute display metadata.
 *
 * @param tokens - Pre-filtered list of GameTokens (after origin/affix/search filter)
 * @returns Array of FamilyGroup objects
 */
export function groupTokensByFamily(tokens: GameToken[]): FamilyGroup[] {
  // Step 1: Group by familyKey.ru + affix
  const groupMap = new Map<string, GameToken[]>();

  for (const token of tokens) {
    const key = `${token.familyKey.ru}::${token.affix}`;
    const group = groupMap.get(key) || [];
    group.push(token);
    groupMap.set(key, group);
  }

  // Step 2: Build FamilyGroup for each grouping
  const groups: FamilyGroup[] = [];

  for (const [key, members] of groupMap) {
    const [familyKey, affixStr] = key.split('::');
    const affix = affixStr as AffixType;

    // Parse the familyKey to determine number of slots
    const familyKeyPlaceholders = parseTemplatePlaceholders(familyKey);
    const numSlots = familyKeyPlaceholders.length;

    // Accumulate all numeric values per slot across all members
    const accumulatedSlots: number[][] = Array.from({ length: numSlots }, () => []);

    // Also track global min/max for single-slot convenience
    let globalMin = Infinity;
    let globalMax = -Infinity;
    let hasAnyNumericValue = false;

    for (const member of members) {
      // Parse the member's own template to understand placeholder mapping
      const memberPlaceholders = parseTemplatePlaceholders(member.rawTextTemplate.ru);

      // Extract values this member contributes to each slot
      const slotValues = extractSlotValues(member, numSlots, memberPlaceholders);

      for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
        const vals = slotValues[slotIdx];
        if (vals.length > 0) {
          accumulatedSlots[slotIdx].push(...vals);

          // Also update global min/max (across all slots combined)
          const slotMin = Math.min(...vals);
          const slotMax = Math.max(...vals);
          if (slotMin < globalMin) globalMin = slotMin;
          if (slotMax > globalMax) globalMax = slotMax;
          hasAnyNumericValue = true;
        }
      }
    }

    // Handle tokens with no numeric values at all
    if (!hasAnyNumericValue) {
      globalMin = 0;
      globalMax = 0;
    }

    // Determine if multi-placeholder
    const hasMultiPlaceholder = numSlots > 1;

    // Generate display text
    const displayText = generateDisplayText(familyKey, accumulatedSlots);

    // Build rangeSlots: for multi-placeholder, [[min1,max1],[min2,max2],...]
    const rangeSlots: number[][] = [];
    for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
      const vals = accumulatedSlots[slotIdx];
      if (vals.length >= 2) {
        rangeSlots.push([Math.min(...vals), Math.max(...vals)]);
      } else if (vals.length === 1) {
        rangeSlots.push([vals[0], vals[0]]);
      } else {
        rangeSlots.push([0, 0]);
      }
    }

    groups.push({
      familyKey,
      affix,
      members,
      globalMin,
      globalMax,
      displayText,
      hasMultiPlaceholder,
      rangeSlots,
    });
  }

  // Sort groups: prefixes first, then suffixes; within each group, sort by familyKey
  groups.sort((a, b) => {
    if (a.affix !== b.affix) {
      return a.affix === 'prefix' ? -1 : 1;
    }
    return a.familyKey.localeCompare(b.familyKey, 'ru');
  });

  return groups;
}
