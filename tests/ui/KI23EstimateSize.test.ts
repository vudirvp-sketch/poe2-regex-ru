// @vitest-environment jsdom
/**
 * KI#23 variant (b) (iter 144) — per-row-state height estimate for
 * `subgroup` rows in VirtualizedModList.
 *
 * Tests the `estimateSubgroupHeight()` helper that returns a height
 * estimate closer to the actual measured height, reducing scroll jitter.
 *
 * Heuristics tested:
 *   - Default state (no selection, 1–3 chips) → 60 (ROW_ESTIMATES.subgroup).
 *   - 4+ chips (no selection) → 80 (wraps to 2 lines).
 *   - Selected (no range) → 80.
 *   - Selected + range inputs → 110.
 *   - Empty families list → 60 (fallback).
 *
 * Note: this is just an ESTIMATE — the actual height is measured by
 * ResizeObserver. A wrong estimate doesn't break rendering, just causes
 * minor jitter until the measurement settles.
 */
import { describe, it, expect } from 'vitest';
import type { FamilyGroup, GameToken } from '@shared/types';
import type { ModSubGroup } from '@shared/mod-classifier';
import type { TokenRangeOverride } from '@store/filter-store';
// iter 144 (KI#23 variant b): the helper is exported from
// VirtualizedModList.tsx for unit testing. We import it directly — no need
// to render the full component (which needs a scroll container with
// dimensions, not available in jsdom).
import { estimateSubgroupHeight } from '@ui/components/VirtualizedModList';

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a minimal FamilyGroup for testing. The `members` field is the only
 * one used by estimateSubgroupHeight — other fields are stubbed with sensible
 * defaults so TypeScript doesn't complain.
 */
function makeFamily(members: GameToken[]): FamilyGroup {
  return {
    familyKey: 'test-family',
    affix: 'prefix',
    members,
    globalMin: 0,
    globalMax: 100,
    displayText: 'test',
    hasMultiPlaceholder: false,
    rangeSlots: [],
    filterSlotIndex: 0,
    priorityTier: 'C',
  };
}

function makeToken(id: string): GameToken {
  return {
    id,
    category: 'belt',
    origin: 'normal',
    rawText: { ru: `Текст ${id}` },
    rawTextTemplate: { ru: '## текст' },
    regex: { ru: `текст.*${id}` },
    familyKey: { ru: 'test' },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
    genderForms: { ru: {} },
    affix: 'prefix',
    tags: [],
    ranges: [[10, 30]],
    values: [],
    hasYofication: false,
    yoficationPositions: [],
    level: 1,
  };
}

function makeSubGroup(families: FamilyGroup[]): ModSubGroup {
  return {
    key: 'test-subgroup',
    label: 'Test Sub-Group',
    colorClass: '',
    bgClass: '',
    borderClass: '',
    borderLClass: '',
    groups: families,
  };
}

/**
 * Build a `subgroup` VirtualRow for testing. The `Extract<VirtualRow,
 * { type: 'subgroup' }>` type requires `subGroup`, `affix`, `subKey?`,
 * `isSubExpanded?` — we provide minimal stubs.
 */
function makeSubgroupRow(families: FamilyGroup[]) {
  return {
    type: 'subgroup' as const,
    subGroup: makeSubGroup(families),
    affix: 'prefix' as const,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('KI#23 variant (b) (iter 144) — estimateSubgroupHeight', () => {
  it('default state (no selection, 1-3 chips) returns 60', () => {
    const family = makeFamily([makeToken('t1'), makeToken('t2'), makeToken('t3')]);
    const row = makeSubgroupRow([family]);
    const selectedIds = new Set<string>();
    const perTokenRanges: Record<string, TokenRangeOverride> = {};
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(60);
  });

  it('4+ chips (no selection) returns 80 (wraps to 2 lines)', () => {
    const family = makeFamily([makeToken('t1'), makeToken('t2'), makeToken('t3'), makeToken('t4')]);
    const row = makeSubgroupRow([family]);
    const selectedIds = new Set<string>();
    const perTokenRanges: Record<string, TokenRangeOverride> = {};
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(80);
  });

  it('selected (no range) returns 80', () => {
    const family = makeFamily([makeToken('t1'), makeToken('t2')]);
    const row = makeSubgroupRow([family]);
    const selectedIds = new Set<string>(['t1']);
    const perTokenRanges: Record<string, TokenRangeOverride> = {};
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(80);
  });

  it('selected + range inputs returns 110', () => {
    const family = makeFamily([makeToken('t1'), makeToken('t2')]);
    const row = makeSubgroupRow([family]);
    const selectedIds = new Set<string>(['t1']);
    const perTokenRanges: Record<string, TokenRangeOverride> = {
      't1': { min: 30, max: 50 },
    };
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(110);
  });

  it('selected + range with only min returns 110', () => {
    const family = makeFamily([makeToken('t1')]);
    const row = makeSubgroupRow([family]);
    const selectedIds = new Set<string>(['t1']);
    const perTokenRanges: Record<string, TokenRangeOverride> = {
      't1': { min: 30 },
    };
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(110);
  });

  it('selected + range with only max returns 110', () => {
    const family = makeFamily([makeToken('t1')]);
    const row = makeSubgroupRow([family]);
    const selectedIds = new Set<string>(['t1']);
    const perTokenRanges: Record<string, TokenRangeOverride> = {
      't1': { max: 50 },
    };
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(110);
  });

  it('range without selection returns 60 (FilterChip hides range inputs when not selected)', () => {
    // FilterChip only renders range inputs when selectionState === 'full' || 'partial'.
    // estimateSubgroupHeight approximates by checking perTokenRanges entries —
    // but since the chip is NOT selected, no range inputs are visible, so the
    // estimate should fall back to default (60 for 1-3 chips, 80 for 4+).
    //
    // However, our heuristic returns 110 when ANY family has both selected
    // AND range — so if no family is selected, range alone doesn't trigger 110.
    // The estimate stays at 60 (1-3 chips, no selection) — which is correct
    // because FilterChip hides range inputs when not selected.
    const family = makeFamily([makeToken('t1')]);
    const row = makeSubgroupRow([family]);
    const selectedIds = new Set<string>(); // nothing selected
    const perTokenRanges: Record<string, TokenRangeOverride> = {
      't1': { min: 30 }, // range exists but chip not selected
    };
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(60);
  });

  it('empty families list returns 60 (fallback)', () => {
    const row = makeSubgroupRow([]);
    const selectedIds = new Set<string>();
    const perTokenRanges: Record<string, TokenRangeOverride> = {};
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(60);
  });

  it('perTokenRanges entry with empty override (no min/max) does NOT trigger 110', () => {
    // A perTokenRanges entry exists but with neither min nor max set —
    // FilterChip would render empty range inputs. We treat this as "no range"
    // for estimation purposes (height stays at 80 for selected-only).
    const family = makeFamily([makeToken('t1')]);
    const row = makeSubgroupRow([family]);
    const selectedIds = new Set<string>(['t1']);
    const perTokenRanges: Record<string, TokenRangeOverride> = {
      't1': {}, // empty override — no min, no max
    };
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(80);
  });

  it('multiple families: any selected + any range triggers 110', () => {
    const family1 = makeFamily([makeToken('t1')]);
    const family2 = makeFamily([makeToken('t2')]);
    const row = makeSubgroupRow([family1, family2]);
    const selectedIds = new Set<string>(['t1']); // family1 selected
    const perTokenRanges: Record<string, TokenRangeOverride> = {
      't2': { min: 30 }, // family2 has range
    };
    // Since different families contribute selected + range, the heuristic
    // still returns 110 (any + any).
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(110);
  });

  it('multiple families: total members > 3 with no selection returns 80', () => {
    const family1 = makeFamily([makeToken('t1'), makeToken('t2')]);
    const family2 = makeFamily([makeToken('t3'), makeToken('t4')]);
    const row = makeSubgroupRow([family1, family2]);
    const selectedIds = new Set<string>();
    const perTokenRanges: Record<string, TokenRangeOverride> = {};
    // 4 total members → wraps to 2 lines → 80.
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(80);
  });

  it('4+ chips + selected (no range) returns 80 (selected takes precedence over chip count)', () => {
    const family = makeFamily([makeToken('t1'), makeToken('t2'), makeToken('t3'), makeToken('t4')]);
    const row = makeSubgroupRow([family]);
    const selectedIds = new Set<string>(['t1']);
    const perTokenRanges: Record<string, TokenRangeOverride> = {};
    // Both "selected" and "4+ chips" return 80 — same value, no conflict.
    expect(estimateSubgroupHeight(row, selectedIds, perTokenRanges)).toBe(80);
  });
});
