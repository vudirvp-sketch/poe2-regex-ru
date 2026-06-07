/**
 * VendorPage — Vendor regex filter for the Russian game client.
 *
 * Layout v2 (iteration 8): Uses shared CategoryControlPanel for sticky
 * regex output + mode toggle + round10. Chip groups below, verification note at bottom.
 *
 * The hardcoded Russian regex strings in VENDOR_PROPERTIES are OK —
 * vendor properties are NOT mod-based and don't come from ETL data.
 * The plan's invariant I4 targets mod strings from ETL, not vendor labels.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { VendorChip } from '@ui/components/VendorChip';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import { t } from '@shared/i18n';
import { MAX_CHARS } from '@shared/constants';
import { and, or, literal, exclude, range } from '@core/ast';
import { compile } from '@core/compiler';
import type { ASTNode, SearchLogic } from '@shared/types';
import { createFilterStore } from '@store/filter-store';
import { syncFromUrl } from '@store/url-sync';
import type { FilterStoreApi } from '@ui/hooks/useCategoryPage';
import { VENDOR_PROPERTIES, type VendorProperty } from '@data/vendor-properties';

// VENDOR_PROPERTIES is now imported from @data/vendor-properties

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

const GROUP_COLORS: Record<string, { header: string; border: string }> = {
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

export function VendorPage() {
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
  const [excludeMode, setExcludeMode] = useState(() => {
    if (urlRestored) {
      const extraMode = useStore.getState().getExtraState('vendorExcludeMode');
      if (typeof extraMode === 'boolean') return extraMode;
    }
    return false;
  });
  const [numericInputs, setNumericInputs] = useState<Record<string, number>>(() => {
    if (urlRestored) {
      const extraNums = useStore.getState().getExtraState('vendorNumericInputs');
      if (extraNums && typeof extraNums === 'object') return extraNums as Record<string, number>;
    }
    return {};
  });
  const [round10, setRound10] = useState(() => {
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
    useStore.getState().setExtraState('vendorExcludeMode', excludeMode);
    useStore.getState().setExtraState('vendorNumericInputs', numericInputs);
    useStore.getState().setExtraState('vendorRound10', round10);
    useStore.getState().setExtraState('vendorSearchLogic', searchLogic);
  }, [selectedIds, excludeMode, numericInputs, round10, searchLogic, useStore]);

  const toggleProperty = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
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
    setNumericInputs({});
    setExcludeMode(false);
  }, []);

  // Build regex using core AST + compiler (fixes 3-digit number bug,
  // ensures consistent quoting, correct AND/OR/EXCLUDE handling)
  const { regex, isRegexOverflow } = useMemo(() => {
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
      if (excludeMode) {
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
    if (searchLogic === 'or' && !excludeMode) {
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
  }, [selectedIds, excludeMode, numericInputs, round10, searchLogic]);

  // Group properties for UI display (ordered by GROUP_ORDER)
  const groupedProperties = useMemo(() => {
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
  }, []);

  const hasNumericSelected = Object.values(numericInputs).some(v => v > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
          <img src={`${import.meta.env.BASE_URL}icons/vendor.png`} alt="" width={24} height={24} className="object-contain" />
          {t('vendor.title')}
        </h2>
        <span className="text-xs text-gray-500">
          {selectedIds.size} {t('selected')}
        </span>
      </div>

      {/* Shared control panel: regex output + mode toggle + round10 + clear */}
      <CategoryControlPanel
        regex={regex}
        isOverflow={isRegexOverflow}
        filterStore={filterStore}
        excludeMode={excludeMode}
        setExcludeMode={setExcludeMode}
        hasRangedTokens={false}
        minValue={null}
        setMinValue={() => {}}
        maxValue={null}
        setMaxValue={() => {}}
        rangedSuffixes={[]}
        round10Enabled={round10}
        setRound10Enabled={setRound10}
        searchLogic={searchLogic}
        setSearchLogic={setSearchLogic}
        showRound10={hasNumericSelected}
        clearButton={
          selectedIds.size > 0 ? (
            <button
              onClick={clearAll}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-600 transition-colors"
            >
              {t('filter.clear')} ({selectedIds.size})
            </button>
          ) : undefined
        }
      />

      {/* Chip-based property groups */}
      <div className="flex flex-col gap-3">
        {Array.from(groupedProperties.entries()).map(([groupName, props]) => {
          const colors = GROUP_COLORS[groupName] ?? { header: 'text-gray-400', border: 'border-l-gray-500' };
          return (
            <div key={groupName}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${colors.header}`}>
                ── {groupName} ({props.length}) ──
              </div>
              <div className="flex flex-wrap gap-1.5">
                {props.map(prop => (
                  <VendorChip
                    key={prop.id}
                    prop={prop}
                    isSelected={selectedIds.has(prop.id)}
                    numericValue={numericInputs[prop.id] ?? null}
                    onToggle={toggleProperty}
                    onNumericChange={setNumericValue}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification note */}
      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-3 text-xs text-yellow-400/80" role="alert">
        <strong>{t('vendor.verification')}</strong>
      </div>
    </div>
  );
}
