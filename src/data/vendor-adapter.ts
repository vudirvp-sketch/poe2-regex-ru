/**
 * VendorCategoryData — Adapter for useCategoryPage compatibility.
 *
 * Converts VENDOR_PROPERTIES into CategoryData format so that useCategoryPage
 * can be used instead of the separate useVendorPage hook.
 *
 * NEXT ITERATION: Integrate this into VendorPage to replace useVendorPage,
 * eliminating duplicated state management, URL sync, and regex compilation logic.
 *
 * Why an adapter?
 * - useCategoryPage expects CategoryData with GameToken[] and FamilyGroup[]
 * - VendorProperty is a simpler structure (no ranges, no affix, no familyKey)
 * - This adapter converts VendorProperty → GameToken so useCategoryPage works
 *
 * What's NOT yet done:
 * - VendorPage still uses useVendorPage hook
 * - The adapter is defined but not integrated
 * - GROUP_COLORS would move into CategoryLabel system
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
    exclusions: [],
    ranges: prop.hasNumericInput ? [{ min: 0, max: 1000 }] : [],
    values: [],
    affix: 'implicit',  // Vendor props aren't prefix/suffix — use 'implicit'
    priorityTier: 'B',
    tags: [],
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
