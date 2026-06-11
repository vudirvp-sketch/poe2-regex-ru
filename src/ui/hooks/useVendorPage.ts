/**
 * useVendorPage — Hook for the Vendor page.
 *
 * Encapsulates all vendor-specific filter state management, URL sync,
 * and regex compilation. VendorPage component uses this hook for
 * rendering only — same pattern as useCategoryPage for category pages.
 *
 * Key differences from useCategoryPage:
 * - No CategoryData loading (vendor data is hardcoded in VENDOR_PROPERTIES)
 * - No GameToken (uses VendorProperty instead)
 * - No optimization table (vendor regexes are simple literals/ranges)
 * - No yofication (vendor labels don't need е/ё expansion)
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createFilterStore } from '@store/filter-store';
import { syncFromUrl, syncToUrl } from '@store/url-sync';
import { MAX_CHARS } from '@core/limits';
import { and, or, literal, exclude, range } from '@core/ast';
import { compile } from '@core/compiler';
import type { ASTNode, SearchLogic } from '@shared/types';
import type { FilterStoreApi } from '@ui/hooks/useCategoryPage';
import { VENDOR_PROPERTIES, type VendorProperty } from '@data/vendor-properties';

// ─── Group order for consistent display ───

const GROUP_ORDER = [
  'Свойства предмета',
  'Скорость',
  'Скорость передвижения',
  'Сопротивления',
  'Модификаторы',
  'Умения',
  'Характеристики',
  'Уровень',
  'Редкость предмета',
  'Класс — Украшения',
  'Класс — Оружие 1H',
  'Класс — Оружие 2H',
  'Класс — Экипировка',
  'Класс — Оффхэнд',
];

// ─── Group color config for visual differentiation ───

export const GROUP_COLORS: Record<string, { header: string; border: string }> = {
  'Свойства предмета':    { header: 'text-gray-400',   border: 'border-l-gray-500' },
  'Скорость':             { header: 'text-yellow-400',  border: 'border-l-yellow-500' },
  'Скорость передвижения':{ header: 'text-yellow-400',  border: 'border-l-yellow-500' },
  'Сопротивления':        { header: 'text-blue-400',    border: 'border-l-blue-500' },
  'Модификаторы':         { header: 'text-red-400',     border: 'border-l-red-500' },
  'Умения':               { header: 'text-purple-400',  border: 'border-l-purple-500' },
  'Характеристики':       { header: 'text-green-400',   border: 'border-l-green-500' },
  'Уровень':              { header: 'text-cyan-400',    border: 'border-l-cyan-500' },
  'Редкость предмета':    { header: 'text-orange-400',  border: 'border-l-orange-500' },
  'Класс — Украшения':    { header: 'text-amber-400',   border: 'border-l-amber-500' },
  'Класс — Оружие 1H':   { header: 'text-red-400',     border: 'border-l-red-500' },
  'Класс — Оружие 2H':   { header: 'text-red-400',     border: 'border-l-red-500' },
  'Класс — Экипировка':  { header: 'text-sky-400',     border: 'border-l-sky-500' },
  'Класс — Оффхэнд':     { header: 'text-teal-400',    border: 'border-l-teal-500' },
};

/** Return type of useVendorPage */
export interface VendorPageState {
  /** Computed regex string */
  regex: string;
  /** Whether the regex overflows the 250 char limit */
  isRegexOverflow: boolean;
  /** Selected property IDs */
  selectedIds: Set<string>;
  /** Excluded property IDs */
  excludedIds: Set<string>;
  /** Toggle a property's selection */
  toggleProperty: (id: string) => void;
  /** Toggle a property's exclude state */
  toggleExclude: (id: string) => void;
  /** Set numeric input for a property */
  setNumericValue: (id: string, value: number | null) => void;
  /** Numeric input values keyed by property ID */
  numericInputs: Record<string, number>;
  /** Round10 toggle */
  round10Enabled: boolean;
  /** Set round10 toggle */
  setRound10Enabled: (v: boolean) => void;
  /** Search logic: 'and' = all conditions, 'or' = any condition */
  searchLogic: SearchLogic;
  /** Set search logic */
  setSearchLogic: (v: SearchLogic) => void;
  /** Clear all selections */
  clearAll: () => void;
  /** Whether any numeric property has a value set */
  hasNumericSelected: boolean;
  /** Number of excluded properties */
  excludeCount: number;
  /** Properties grouped by GROUP_ORDER */
  groupedProperties: Map<string, VendorProperty[]>;
  /** Filter store API (for CategoryControlPanel) */
  filterStore: FilterStoreApi;
}

/**
 * Build vendor regex from selected/excluded properties and numeric inputs.
 * Extracted as a pure function for testability.
 */
export function buildVendorRegex(
  selectedIds: Set<string>,
  excludedIds: Set<string>,
  numericInputs: Record<string, number>,
  round10: boolean,
  searchLogic: SearchLogic,
): { regex: string; isRegexOverflow: boolean } {
  const selectedProps = VENDOR_PROPERTIES.filter(p => selectedIds.has(p.id));
  if (selectedProps.length === 0 && Object.keys(numericInputs).length === 0) {
    return { regex: '', isRegexOverflow: false };
  }

  const astNodes: ASTNode[] = [];
  const includeLiterals: ASTNode[] = [];
  const excludeLiterals: ASTNode[] = [];
  const numericNodes: ASTNode[] = [];

  for (const prop of selectedProps) {
    if (prop.hasNumericInput) {
      // If excluded, use the numericSuffix or regex as literal for exclusion
      if (excludedIds.has(prop.id)) {
        const excludeText = prop.numericSuffix || prop.regex;
        if (excludeText) {
          excludeLiterals.push(literal(excludeText));
        }
        continue;
      }
      const numValue = numericInputs[prop.id];
      if (numValue && numValue > 0 && prop.numericSuffix) {
        // Use core range() — generates correct number regex including 3-digit handling
        numericNodes.push(range(numValue, undefined, prop.numericSuffix));
      }
      continue;
    }

    if (!prop.regex) continue;

    // Collect all non-numeric props and group them for efficiency
    // Using OR within one quoted group is more compact than separate quoted groups
    if (excludedIds.has(prop.id)) {
      excludeLiterals.push(literal(prop.regex));
    } else {
      includeLiterals.push(literal(prop.regex));
    }
  }

  // Also handle numeric-only properties that aren't in selectedIds
  for (const [id, value] of Object.entries(numericInputs)) {
    if (value <= 0) continue;
    const prop = VENDOR_PROPERTIES.find(p => p.id === id);
    if (prop?.hasNumericInput && !selectedIds.has(id) && prop.numericSuffix) {
      numericNodes.push(range(value, undefined, prop.numericSuffix));
    }
  }

  // In OR mode: all items go into a single OR group (item needs ANY selected property)
  if (searchLogic === 'or' && excludeLiterals.length === 0) {
    const orChildren: ASTNode[] = [];
    if (includeLiterals.length > 0) {
      orChildren.push(...includeLiterals);
    }
    if (numericNodes.length > 0) {
      orChildren.push(...numericNodes);
    }
    if (orChildren.length > 0) {
      astNodes.push(orChildren.length === 1 ? orChildren[0] : or(...orChildren));
    }
  } else {
    // AND mode (default): literals as OR group, numeric as separate AND nodes
    if (numericNodes.length > 0) {
      astNodes.push(...numericNodes);
    }

    // Add included properties as a single OR group (compact: "A|B|C")
    if (includeLiterals.length > 0) {
      if (includeLiterals.length === 1) {
        astNodes.push(includeLiterals[0]);
      } else {
        astNodes.push(or(...includeLiterals));
      }
    }
  }

  // Add excluded properties as EXCLUDE(OR(...)) — compact: "!A|B|C"
  // Much more efficient than separate "!A" "!B" "!C" (saves 3+ chars per property)
  if (excludeLiterals.length > 0) {
    astNodes.push(exclude(or(...excludeLiterals)));
  }

  if (astNodes.length === 0) {
    return { regex: '', isRegexOverflow: false };
  }

  const ast = and(...astNodes);
  const result = compile(ast, { round10 });
  return { regex: result, isRegexOverflow: result.length > MAX_CHARS };
}

/**
 * Group properties for UI display (ordered by GROUP_ORDER).
 * Extracted as a pure function for testability.
 */
export function groupVendorProperties(): Map<string, VendorProperty[]> {
  const groups = new Map<string, VendorProperty[]>();
  for (const prop of VENDOR_PROPERTIES) {
    const group = groups.get(prop.group) || [];
    group.push(prop);
    groups.set(prop.group, group);
  }
  // Sort groups by GROUP_ORDER
  const sorted = new Map<string, VendorProperty[]>();
  for (const groupName of GROUP_ORDER) {
    const props = groups.get(groupName);
    if (props) sorted.set(groupName, props);
  }
  // Add any groups not in GROUP_ORDER
  for (const [groupName, props] of groups) {
    if (!sorted.has(groupName)) sorted.set(groupName, props);
  }
  return sorted;
}

/**
 * useVendorPage — Hook for the Vendor page.
 *
 * Manages vendor-specific filter state (selected/excluded IDs, numeric inputs,
 * round10, search logic) with URL sync and regex compilation.
 */
export function useVendorPage(): VendorPageState {
  // Create a filter store for URL sharing
  const useStore = useMemo(() => createFilterStore(), []);

  // Wrap Zustand store in FilterStoreApi for compatibility with CategoryControlPanel
  const filterStore = useMemo<FilterStoreApi>(() => ({
    getState: useStore.getState,
    subscribe: useStore.subscribe,
    serialize: () => useStore.getState().serialize(),
    getExtraState: (key: string) => useStore.getState().getExtraState(key),
    setExtraState: (key: string, value: unknown) => useStore.getState().setExtraState(key, value),
  }), [useStore]);

  // Restore from URL on first render (synchronous, before any effects)
  const [urlRestored] = useState(() => syncFromUrl(useStore.getState()));

  // Initialize vendor state from filter store (which may have URL data)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (urlRestored) {
      const extra = useStore.getState().getExtraState('vendorSelectedIds');
      if (Array.isArray(extra)) return new Set(extra as string[]);
    }
    return new Set();
  });
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => {
    if (urlRestored) {
      const extra = useStore.getState().getExtraState('vendorExcludedIds');
      if (Array.isArray(extra)) return new Set(extra as string[]);
    }
    return new Set();
  });
  const [numericInputs, setNumericInputs] = useState<Record<string, number>>(() => {
    if (urlRestored) {
      const extraNums = useStore.getState().getExtraState('vendorNumericInputs');
      if (extraNums && typeof extraNums === 'object') return extraNums as Record<string, number>;
    }
    return {};
  });
  const [round10Enabled, setRound10Enabled] = useState(() => {
    if (urlRestored) {
      const extraR10 = useStore.getState().getExtraState('vendorRound10');
      if (typeof extraR10 === 'boolean') return extraR10;
    }
    return true;
  });
  const [searchLogic, setSearchLogic] = useState<SearchLogic>(() => {
    if (urlRestored) {
      const extraSL = useStore.getState().getExtraState('vendorSearchLogic');
      if (extraSL === 'and' || extraSL === 'or') return extraSL;
    }
    return 'and';
  });

  // Ref to skip the first sync-to-store cycle, preventing overwrite
  // of URL-restored extraState values before the restore effect has run.
  const syncReadyRef = useRef(false);

  // Sync vendor state to filter store for URL sharing.
  // Skips the first render to avoid overwriting URL-restored values.
  useEffect(() => {
    if (!syncReadyRef.current) {
      syncReadyRef.current = true;
      return;
    }
    useStore.getState().setExtraState('vendorSelectedIds', [...selectedIds]);
    useStore.getState().setExtraState('vendorExcludedIds', [...excludedIds]);
    useStore.getState().setExtraState('vendorNumericInputs', numericInputs);
    useStore.getState().setExtraState('vendorRound10', round10Enabled);
    useStore.getState().setExtraState('vendorSearchLogic', searchLogic);
    // Auto-sync to URL hash so refreshing the page preserves state
    syncToUrl(useStore.getState());
  }, [selectedIds, excludedIds, numericInputs, round10Enabled, searchLogic, useStore]);

  const toggleProperty = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Also remove from excluded if it was excluded
        setExcludedIds(prevExcl => {
          const nextExcl = new Set(prevExcl);
          nextExcl.delete(id);
          return nextExcl;
        });
        // Clear ghost numeric value when unchecking a numeric property
        setNumericInputs(prevNum => {
          const nextNum = { ...prevNum };
          delete nextNum[id];
          return nextNum;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleExclude = useCallback((id: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Ensure it's also in selectedIds so it's considered "active"
        setSelectedIds(prevSel => {
          if (prevSel.has(id)) return prevSel;
          const nextSel = new Set(prevSel);
          nextSel.add(id);
          return nextSel;
        });
      }
      return next;
    });
  }, []);

  const setNumericValue = useCallback((id: string, value: number | null) => {
    setNumericInputs(prev => {
      const next = { ...prev };
      if (value === null) {
        delete next[id];
      } else {
        next[id] = value;
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
    setExcludedIds(new Set());
    setNumericInputs({});
    setRound10Enabled(true);
    setSearchLogic('and');
  }, []);

  // Build regex using core AST + compiler
  const { regex, isRegexOverflow } = useMemo(() => {
    return buildVendorRegex(selectedIds, excludedIds, numericInputs, round10Enabled, searchLogic);
  }, [selectedIds, excludedIds, numericInputs, round10Enabled, searchLogic]);

  // Group properties for UI display (ordered by GROUP_ORDER)
  const groupedProperties = useMemo(() => groupVendorProperties(), []);

  const hasNumericSelected = Object.values(numericInputs).some(v => v > 0);
  const excludeCount = excludedIds.size;

  return {
    regex,
    isRegexOverflow,
    selectedIds,
    excludedIds,
    toggleProperty,
    toggleExclude,
    setNumericValue,
    numericInputs,
    round10Enabled,
    setRound10Enabled,
    searchLogic,
    setSearchLogic,
    clearAll,
    hasNumericSelected,
    excludeCount,
    groupedProperties,
    filterStore,
  };
}
