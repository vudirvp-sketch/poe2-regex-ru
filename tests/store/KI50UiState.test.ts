// @vitest-environment jsdom
/**
 * KI#50 (iter 169) — per-category UI state (expand/collapse) persistence.
 *
 * Tests for the localStorage-backed UI-state layer added in iter 169 to fix
 * the "expand state lost on tab switch" bug. Mirrors the test layout of
 * `tests/store/KI30Favorites.test.ts` (iter 144 KI#30) since the two layers
 * follow the same pattern: per-category localStorage key, JSON-serialized
 * payload, silent fallback when localStorage is unavailable.
 *
 * Coverage:
 *  - readUiState / writeUiState / clearUiState round-trip.
 *  - Missing key → null (no state saved yet for this category).
 *  - Corrupt JSON → null (silent fallback).
 *  - Non-plain-object stored value → null (sanitized).
 *  - Non-string entries filtered out from arrays.
 *  - Empty arrays dropped on read (undefined fields).
 *  - All-empty object → null (treated as "no state").
 *  - writeUiState with all-empty input → removes the key.
 *  - filterInCategoryKeys: empty Set returns same instance (no allocation).
 *  - filterInCategoryKeys: non-empty Set returns new Set with only in-category keys.
 *  - filterInCategoryKeys: keeps both `${cat}:affix` and `${cat}:affix:sub` formats.
 *  - uiStateStorageKey helper (for future `storage` event subscription).
 *
 * Does NOT test the `useCategoryPage` integration (useState initializer +
 * URL sync effect) — that requires React Testing Library and is covered by
 * manual verification per STATUS.md acceptance criteria.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readUiState,
  writeUiState,
  clearUiState,
  filterInCategoryKeys,
  uiStateStorageKey,
  type CategoryUiState,
} from '@store/local-settings';

describe('KI#50 (iter 169) — per-category UI state persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ─── readUiState ───

  it('readUiState returns null when key is not set', () => {
    expect(readUiState('belt')).toBeNull();
    expect(readUiState('ring')).toBeNull();
    expect(readUiState('amulet')).toBeNull();
  });

  it('readUiState returns stored JSON-parsed object', () => {
    const state: CategoryUiState = {
      expandedSubGroups: ['belt:prefix:resistances', 'belt:suffix:damage'],
      collapsedGroups: ['belt:implicit'],
    };
    localStorage.setItem('poe2:uistate:belt', JSON.stringify(state));
    expect(readUiState('belt')).toEqual(state);
  });

  it('readUiState is per-category — different categories have independent keys', () => {
    localStorage.setItem(
      'poe2:uistate:belt',
      JSON.stringify({ expandedSubGroups: ['belt:prefix:x'] }),
    );
    localStorage.setItem(
      'poe2:uistate:ring',
      JSON.stringify({
        expandedSubGroups: ['ring:prefix:y', 'ring:suffix:z'],
        collapsedGroups: ['ring:implicit'],
      }),
    );
    expect(readUiState('belt')).toEqual({ expandedSubGroups: ['belt:prefix:x'] });
    expect(readUiState('ring')).toEqual({
      expandedSubGroups: ['ring:prefix:y', 'ring:suffix:z'],
      collapsedGroups: ['ring:implicit'],
    });
    expect(readUiState('amulet')).toBeNull();
  });

  it('readUiState returns null when stored value is corrupt JSON', () => {
    localStorage.setItem('poe2:uistate:belt', '{not valid json');
    expect(readUiState('belt')).toBeNull();
  });

  it('readUiState returns null when stored value is not a plain object', () => {
    localStorage.setItem('poe2:uistate:belt', JSON.stringify(['not', 'an', 'object']));
    expect(readUiState('belt')).toBeNull();
    localStorage.setItem('poe2:uistate:belt', JSON.stringify(42));
    expect(readUiState('belt')).toBeNull();
    localStorage.setItem('poe2:uistate:belt', JSON.stringify(null));
    expect(readUiState('belt')).toBeNull();
    localStorage.setItem('poe2:uistate:belt', JSON.stringify('string-not-object'));
    expect(readUiState('belt')).toBeNull();
  });

  it('readUiState filters out non-string entries from stored arrays', () => {
    localStorage.setItem(
      'poe2:uistate:belt',
      JSON.stringify({
        expandedSubGroups: ['valid-id', 42, null, true, { obj: 'no' }, 'another-valid'],
        collapsedGroups: [99, 'keep-this'],
      }),
    );
    expect(readUiState('belt')).toEqual({
      expandedSubGroups: ['valid-id', 'another-valid'],
      collapsedGroups: ['keep-this'],
    });
  });

  it('readUiState returns null when all stored arrays are empty', () => {
    localStorage.setItem(
      'poe2:uistate:belt',
      JSON.stringify({ expandedSubGroups: [], collapsedGroups: [], chipExpandState: [] }),
    );
    expect(readUiState('belt')).toBeNull();
  });

  it('readUiState returns null when stored object has no known fields', () => {
    localStorage.setItem(
      'poe2:uistate:belt',
      JSON.stringify({ unknownField: ['ignored'], other: 42 }),
    );
    expect(readUiState('belt')).toBeNull();
  });

  it('readUiState drops empty arrays and only keeps non-empty ones', () => {
    localStorage.setItem(
      'poe2:uistate:belt',
      JSON.stringify({
        expandedSubGroups: ['belt:prefix:x'],
        collapsedGroups: [],
        chipExpandState: ['belt:suffix:y:chip'],
      }),
    );
    expect(readUiState('belt')).toEqual({
      expandedSubGroups: ['belt:prefix:x'],
      chipExpandState: ['belt:suffix:y:chip'],
    });
  });

  it('readUiState returns null when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    expect(readUiState('belt')).toBeNull();
    spy.mockRestore();
  });

  // ─── writeUiState ───

  it('writeUiState persists JSON-serialized object under poe2:uistate:<categoryId>', () => {
    const state: CategoryUiState = {
      expandedSubGroups: ['belt:prefix:x'],
      collapsedGroups: ['belt:implicit'],
    };
    writeUiState('belt', state);
    expect(localStorage.getItem('poe2:uistate:belt')).toBe(JSON.stringify(state));
  });

  it('writeUiState is per-category — different categories write to different keys', () => {
    writeUiState('belt', { expandedSubGroups: ['belt:prefix:x'] });
    writeUiState('ring', {
      expandedSubGroups: ['ring:prefix:y'],
      collapsedGroups: ['ring:implicit'],
    });
    expect(localStorage.getItem('poe2:uistate:belt')).toBe(
      JSON.stringify({ expandedSubGroups: ['belt:prefix:x'] }),
    );
    expect(localStorage.getItem('poe2:uistate:ring')).toBe(
      JSON.stringify({
        expandedSubGroups: ['ring:prefix:y'],
        collapsedGroups: ['ring:implicit'],
      }),
    );
  });

  it('writeUiState drops empty arrays from the stored object', () => {
    writeUiState('belt', {
      expandedSubGroups: ['belt:prefix:x'],
      collapsedGroups: [],
      chipExpandState: [],
    });
    expect(localStorage.getItem('poe2:uistate:belt')).toBe(
      JSON.stringify({ expandedSubGroups: ['belt:prefix:x'] }),
    );
  });

  it('writeUiState removes the key entirely when all arrays are empty', () => {
    // Pre-populate to verify removal.
    localStorage.setItem('poe2:uistate:belt', JSON.stringify({ expandedSubGroups: ['x'] }));
    expect(localStorage.getItem('poe2:uistate:belt')).not.toBeNull();

    writeUiState('belt', { expandedSubGroups: [], collapsedGroups: [], chipExpandState: [] });
    expect(localStorage.getItem('poe2:uistate:belt')).toBeNull();
  });

  it('writeUiState removes the key entirely when all fields are undefined', () => {
    localStorage.setItem('poe2:uistate:belt', JSON.stringify({ expandedSubGroups: ['x'] }));
    writeUiState('belt', {});
    expect(localStorage.getItem('poe2:uistate:belt')).toBeNull();
  });

  it('writeUiState is a silent no-op when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writeUiState('belt', { expandedSubGroups: ['x'] })).not.toThrow();
    spy.mockRestore();
  });

  // ─── clearUiState ───

  it('clearUiState removes the per-category key', () => {
    localStorage.setItem('poe2:uistate:belt', JSON.stringify({ expandedSubGroups: ['x'] }));
    expect(localStorage.getItem('poe2:uistate:belt')).not.toBeNull();
    clearUiState('belt');
    expect(localStorage.getItem('poe2:uistate:belt')).toBeNull();
  });

  it("clearUiState does NOT remove other categories' keys", () => {
    localStorage.setItem('poe2:uistate:belt', JSON.stringify({ expandedSubGroups: ['belt:x'] }));
    localStorage.setItem('poe2:uistate:ring', JSON.stringify({ expandedSubGroups: ['ring:x'] }));
    clearUiState('belt');
    expect(localStorage.getItem('poe2:uistate:belt')).toBeNull();
    expect(localStorage.getItem('poe2:uistate:ring')).toBe(
      JSON.stringify({ expandedSubGroups: ['ring:x'] }),
    );
  });

  it('clearUiState is a silent no-op when key does not exist', () => {
    expect(() => clearUiState('amulet')).not.toThrow();
  });

  // ─── Round-trip ───

  it('round-trip: writeUiState then readUiState returns the original state', () => {
    const state: CategoryUiState = {
      expandedSubGroups: ['belt:prefix:resistances', 'belt:suffix:damage'],
      collapsedGroups: ['belt:implicit'],
      chipExpandState: ['belt:prefix:resistances:chip'],
    };
    writeUiState('belt', state);
    expect(readUiState('belt')).toEqual(state);
  });

  it('round-trip: empty state on write → null on read (no key)', () => {
    writeUiState('ring', {});
    expect(readUiState('ring')).toBeNull();
  });

  // ─── Storage key helper ───

  it('uiStateStorageKey returns the per-category key without poe2: prefix', () => {
    expect(uiStateStorageKey('belt')).toBe('uistate:belt');
    expect(uiStateStorageKey('ring')).toBe('uistate:ring');
    expect(uiStateStorageKey('amulet')).toBe('uistate:amulet');
  });

  it('uiStateStorageKey + poe2: prefix matches the actual localStorage key', () => {
    writeUiState('belt', { expandedSubGroups: ['belt:prefix:x'] });
    const computedKey = 'poe2:' + uiStateStorageKey('belt');
    expect(localStorage.getItem(computedKey)).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// filterInCategoryKeys — pure helper tested in isolation.
// ─────────────────────────────────────────────────────────────────────────────

describe('KI#50 (iter 169) — filterInCategoryKeys (cross-category URL leak filter)', () => {
  it('returns the same Set instance when input is empty (no allocation)', () => {
    const empty = new Set<string>();
    const result = filterInCategoryKeys(empty, 'belt');
    expect(result).toBe(empty); // identity check — same reference
    expect(result.size).toBe(0);
  });

  it('returns a new Set containing only keys with `${categoryId}:` prefix', () => {
    const mixed = new Set<string>([
      'belt:prefix:resistances', // in-category, 3-part
      'belt:implicit', // in-category, 2-part
      'ring:prefix:damage', // wrong category
      'amulet:suffix:crit', // wrong category
      'belt:suffix:something', // in-category, 3-part
    ]);
    const result = filterInCategoryKeys(mixed, 'belt');
    expect(result).not.toBe(mixed); // new Set instance
    expect(Array.from(result).sort()).toEqual([
      'belt:implicit',
      'belt:prefix:resistances',
      'belt:suffix:something',
    ]);
  });

  it('preserves both 2-part (collapsedGroups) and 3-part (expandedSubGroups) key formats', () => {
    // collapsedGroups format: `${categoryId}:${affix}` (2 parts)
    // expandedSubGroups format: `${categoryId}:${affix}:${subBlockKey}` (3 parts)
    // Both share the `${categoryId}:` prefix, so the filter handles them uniformly.
    const mixed = new Set<string>([
      'ring:prefix', // 2-part, in-category
      'ring:suffix:positive-loot', // 3-part, in-category
      'belt:prefix', // 2-part, wrong category
    ]);
    const result = filterInCategoryKeys(mixed, 'ring');
    expect(Array.from(result).sort()).toEqual([
      'ring:prefix',
      'ring:suffix:positive-loot',
    ]);
  });

  it('returns an empty Set when no keys match the category', () => {
    // This is the core scenario for KI#50: user navigates from amulet to ring,
    // URL still has amulet's keys. filterInCategoryKeys returns empty → caller
    // falls through to localStorage restore path.
    const amuletKeys = new Set<string>([
      'amulet:prefix:positive-loot',
      'amulet:suffix:resistances',
      'amulet:implicit',
    ]);
    const result = filterInCategoryKeys(amuletKeys, 'ring');
    expect(result.size).toBe(0);
    expect(result).not.toBe(amuletKeys); // new (empty) Set instance
  });

  it('does NOT match categoryId as substring — only as `${categoryId}:` prefix', () => {
    // Defensive: a hypothetical categoryId 'belt' should not match 'belts:...'
    // or 'pocket-belt:...'. The `:` after the categoryId is the boundary.
    const tricky = new Set<string>([
      'belts:prefix:x', // starts with 'belts' not 'belt:'
      'pocket-belt:prefix:x', // contains 'belt' but doesn't start with 'belt:'
      'belt:prefix:valid', // in-category
    ]);
    const result = filterInCategoryKeys(tricky, 'belt');
    expect(Array.from(result)).toEqual(['belt:prefix:valid']);
  });

  it('handles single-character categoryIds correctly', () => {
    // Hypothetical edge case — categoryId 'x' should not match 'xyz:...' keys.
    const mixed = new Set<string>([
      'x:prefix:valid',
      'xyz:prefix:invalid',
      'x:suffix:also-valid',
    ]);
    const result = filterInCategoryKeys(mixed, 'x');
    expect(Array.from(result).sort()).toEqual(['x:prefix:valid', 'x:suffix:also-valid']);
  });

  it('does not mutate the input Set', () => {
    const input = new Set<string>(['belt:prefix:x', 'ring:prefix:y']);
    const snapshot = Array.from(input);
    filterInCategoryKeys(input, 'belt');
    expect(Array.from(input)).toEqual(snapshot); // unchanged
  });

  it('handles large Sets efficiently (no perf regression concern)', () => {
    // Realistic scenario: a category with many subgroups after "Expand All".
    // Build 200 in-category + 200 out-of-category keys.
    const keys: string[] = [];
    for (let i = 0; i < 200; i++) keys.push(`belt:prefix:block-${i}`);
    for (let i = 0; i < 200; i++) keys.push(`ring:prefix:block-${i}`);
    const input = new Set(keys);
    const result = filterInCategoryKeys(input, 'belt');
    expect(result.size).toBe(200);
    // Spot check
    expect(result.has('belt:prefix:block-0')).toBe(true);
    expect(result.has('belt:prefix:block-199')).toBe(true);
    expect(result.has('ring:prefix:block-0')).toBe(false);
  });
});
