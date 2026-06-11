/**
 * VendorCategoryData — Adapter for useCategoryPage compatibility.
 *
 * Converts VENDOR_PROPERTIES into CategoryData format so that useCategoryPage
 * can be used for the vendor page.
 *
 * Mapping details:
 * - Each VendorProperty becomes its own family (familyKey = prop.label)
 * - Numeric properties use ≥# in familyKey for range substitution in display text
 * - affix = 'implicit' for all (vendor props aren't prefix/suffix)
 * - Numeric properties get ranges: [{ min: 0, max: 1000 }]
 * - Group info preserved in tags[] as 'group:${groupName}'
 * - GROUP_COLORS derived from the group tag on each token
 */

import type { CategoryData, GameToken, OptimizationEntry } from '@shared/types';
import { VENDOR_PROPERTIES, type VendorProperty } from './vendor-properties';

/** Convert a VendorProperty to a synthetic GameToken for useCategoryPage */
function vendorPropertyToToken(prop: VendorProperty): GameToken {
  // For numeric properties: regex field = numericSuffix (text after the number)
  // This is because buildAstFromSelections uses token.regex as the suffix for RANGE nodes.
  // For non-numeric properties: regex field = the actual regex pattern (e.g., 'качеств', 'огню')
  const regexValue = prop.hasNumericInput ? (prop.numericSuffix || '') : prop.regex;

  // familyKey is used by groupTokensByFamily as the display text template.
  // For non-numeric properties: use the label directly (e.g., "Качество").
  // For numeric properties: replace ≥N with ≥# so generateDisplayText substitutes
  // the range into the chip text (e.g., "Ур. предмета ≥(0—1000)").
  const familyKeyValue = prop.hasNumericInput
    ? prop.label.replace('≥N', '≥#')
    : prop.label;

  // rawTextTemplate needs ## placeholder for numeric properties so that
  // extractSlotValues can properly map ranges[] to the template slots.
  // Without ##, rangeSlots would be empty and min/max inputs would not appear.
  const rawTextTemplateValue = prop.hasNumericInput
    ? prop.label.replace('≥N', '≥##')
    : prop.label;

  return {
    id: prop.id,
    category: 'vendor',
    origin: 'normal',
    rawText: { ru: prop.label },
    rawTextTemplate: { ru: rawTextTemplateValue },
    regex: { ru: regexValue },
    familyKey: { ru: familyKeyValue },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
    regexExclude: undefined,
    regexPrefixContext: undefined,
    genderForms: { ru: {} },
    affix: 'implicit',  // Vendor props aren't prefix/suffix — use 'implicit'
    tags: [`group:${prop.group}`],  // Preserve group info for GROUP_COLORS
    ranges: prop.hasNumericInput ? [[0, 1000]] : [],
    values: [],
    hasYofication: false,
    yoficationPositions: [],
    level: 1,
  };
}

/** Build CategoryData from VENDOR_PROPERTIES */
export function buildVendorCategoryData(): CategoryData {
  const tokens = VENDOR_PROPERTIES.map(vendorPropertyToToken);
  return {
    version: '1.0.0',
    category: 'vendor',
    source: 'hardcoded',
    tokens,
    optimizationTable: {} as Record<string, OptimizationEntry>,
  };
}
