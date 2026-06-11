/**
 * VendorCategoryData — Adapter for useCategoryPage compatibility.
 *
 * Converts VENDOR_PROPERTIES into CategoryData format so that useCategoryPage
 * can be used instead of the separate useVendorPage hook.
 *
 * Status: Adapter is type-correct and ready for integration.
 * VendorPage still uses useVendorPage — switching to useCategoryPage
 * requires visual verification of the VendorProperty→GameToken mapping.
 *
 * Why an adapter?
 * - useCategoryPage expects CategoryData with GameToken[] and FamilyGroup[]
 * - VendorProperty is a simpler structure (no ranges, no affix, no familyKey)
 * - This adapter converts VendorProperty → GameToken so useCategoryPage works
 *
 * Mapping details:
 * - Each VendorProperty becomes its own family (familyKey = vendor:${id})
 * - affix = 'implicit' for all (vendor props aren't prefix/suffix)
 * - Numeric properties get ranges: [{ min: 0, max: 1000 }]
 * - Group info preserved in tags[] as 'group:${groupName}'
 * - GROUP_COLORS can be derived from the group tag on each token
 *
 * Remaining for integration:
 * - Add customData option to useCategoryPage (skip async loading)
 * - Switch VendorPage from useVendorPage to useCategoryPage
 * - Replace VendorChip with FilterChip (FamilyGroup rendering)
 * - Move GROUP_COLORS into FamilyGroup metadata or derived from tags
 * - Visual verification of all chip states
 */

import type { CategoryData, GameToken, OptimizationEntry } from '@shared/types';
import { VENDOR_PROPERTIES, type VendorProperty } from './vendor-properties';

/** Convert a VendorProperty to a synthetic GameToken for useCategoryPage */
function vendorPropertyToToken(prop: VendorProperty): GameToken {
  return {
    id: prop.id,
    category: 'vendor',
    origin: 'normal',
    rawText: { ru: prop.label },
    rawTextTemplate: { ru: prop.label },
    regex: { ru: prop.regex || '' },
    familyKey: { ru: `vendor:${prop.id}` },  // Each property is its own family
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
    regexExclude: undefined,
    regexPrefixContext: undefined,
    genderForms: { ru: {} },
    affix: 'implicit',  // Vendor props aren't prefix/suffix — use 'implicit'
    priorityTier: 'B',
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
