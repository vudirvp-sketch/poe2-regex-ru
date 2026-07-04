/**
 * Filter Store tests — Phase 1 foundation (iter 132, UI Refactor).
 *
 * Covers the 5 new FilterState fields added in iter 132:
 *   - collapsedGroups: Set<string>   (top-level group keys currently COLLAPSED)
 *   - expandedSubGroups: Set<string> (sub-group keys currently EXPANDED)
 *   - showSelectedOnly: boolean      (hide non-selected chips)
 *   - pinnedIds: Set<string>         (favorited token IDs)
 *   - chipExpandState: Set<string>   (sub-group keys with chips fully expanded)
 *
 * Test groups:
 *   1. Initial state — 5 fields exist with correct defaults
 *   2. Asymmetric default state (iter 131 §13.7 correction #4):
 *      top-level EXPANDED + sub-groups COLLAPSED by default
 *   3. Actions — toggle / set / clear / expand-all / collapse-all for each field
 *   4. Serialize → Deserialize round-trip for each new field
 *   5. Backward-compat — URL without new keys deserializes to defaults (no crash)
 *   6. Compact serialization — empty sets / false boolean omitted
 *   7. resetFilters() resets new fields
 *   8. clearSelections() does NOT reset new fields (different scope)
 *   9. Existing fields still work (smoke test for non-regression)
 *
 * See `docs/UI_REFACTOR_PLAN.md` §4 Phase 1 for the spec.
 */
import { describe, it, expect } from 'vitest';
import { createFilterStore } from '@store/filter-store';

/** Helper: get the underlying state object (without actions) for assertions. */
function stateOf(store: ReturnType<typeof createFilterStore>) {
  return store.getState();
}

/** Helper: compare two Set<string> by sorted contents. */
function expectSetsEqual(actual: Set<string>, expected: Iterable<string>) {
  const a = Array.from(actual).sort();
  const e = Array.from(expected).sort();
  expect(a).toEqual(e);
}

describe('filter-store — Phase 1 initial state (iter 132)', () => {
  it('initializes all 5 new fields with correct defaults', () => {
    const store = createFilterStore();
    const s = stateOf(store);
    expect(s.collapsedGroups).toBeInstanceOf(Set);
    expect(s.collapsedGroups.size).toBe(0);
    expect(s.expandedSubGroups).toBeInstanceOf(Set);
    expect(s.expandedSubGroups.size).toBe(0);
    expect(s.showSelectedOnly).toBe(false);
    expect(s.pinnedIds).toBeInstanceOf(Set);
    expect(s.pinnedIds.size).toBe(0);
    expect(s.chipExpandState).toBeInstanceOf(Set);
    expect(s.chipExpandState.size).toBe(0);
  });

  it('preserves existing field defaults (smoke test for non-regression)', () => {
    const store = createFilterStore();
    const s = stateOf(store);
    expect(s.selectedIds.size).toBe(0);
    expect(s.excludedIds.size).toBe(0);
    expect(s.searchText).toBe('');
    expect(s.affixFilter).toBeNull();
    expect(s.originFilter).toBeNull();
    expect(s.extraState).toEqual({});
    expect(s.perTokenRanges).toEqual({});
  });

  it('implements the asymmetric default state per iter 131 §13.7 correction #4: top-level EXPANDED + sub-groups COLLAPSED', () => {
    // Per user feedback: «Это даст намного более чистый первый экран».
    // Top-level groups (ИМПЛИСИТЫ/ПРЕФИКСЫ/СУФФИКСЫ) EXPANDED by default
    //   → collapsedGroups empty = all top-level expanded.
    // Sub-groups (ДОБЫЧА/УСИЛЕНИЯ/...) COLLAPSED by default
    //   → expandedSubGroups empty = all sub-groups collapsed.
    const store = createFilterStore();
    const s = stateOf(store);

    // Top-level: empty collapsedGroups means all expanded
    expect(s.collapsedGroups.size).toBe(0);
    // Sub-groups: empty expandedSubGroups means all collapsed
    expect(s.expandedSubGroups.size).toBe(0);

    // The asymmetry: two DIFFERENT sets with INVERTED semantics.
    // - collapsedGroups: in-set = COLLAPSED, out-of-set = EXPANDED
    // - expandedSubGroups: in-set = EXPANDED, out-of-set = COLLAPSED
    // This is intentional — each set tracks the minority state of its level.
  });
});

describe('filter-store — Phase 1 actions: collapsedGroups (top-level)', () => {
  it('toggleGroupCollapsed adds then removes the key', () => {
    const store = createFilterStore();
    store.getState().toggleGroupCollapsed('waystone:prefix');
    expectSetsEqual(stateOf(store).collapsedGroups, ['waystone:prefix']);
    store.getState().toggleGroupCollapsed('waystone:prefix');
    expectSetsEqual(stateOf(store).collapsedGroups, []);
  });

  it('setGroupCollapsed(true) adds the key, setGroupCollapsed(false) removes it', () => {
    const store = createFilterStore();
    store.getState().setGroupCollapsed('belt:implicit', true);
    expectSetsEqual(stateOf(store).collapsedGroups, ['belt:implicit']);
    // Calling true again is idempotent
    store.getState().setGroupCollapsed('belt:implicit', true);
    expectSetsEqual(stateOf(store).collapsedGroups, ['belt:implicit']);
    store.getState().setGroupCollapsed('belt:implicit', false);
    expectSetsEqual(stateOf(store).collapsedGroups, []);
  });

  it('expandAllGroups empties the set (all top-level EXPANDED)', () => {
    const store = createFilterStore();
    store.getState().setGroupCollapsed('ring:prefix', true);
    store.getState().setGroupCollapsed('ring:suffix', true);
    store.getState().expandAllGroups();
    expectSetsEqual(stateOf(store).collapsedGroups, []);
  });

  it('collapseAllGroups(keys) populates the set with all keys (all top-level COLLAPSED)', () => {
    const store = createFilterStore();
    const allKeys = ['ring:prefix', 'ring:suffix', 'ring:implicit'];
    store.getState().collapseAllGroups(allKeys);
    expectSetsEqual(stateOf(store).collapsedGroups, allKeys);
  });

  it('does not mutate the previous Set instance (immutable update)', () => {
    const store = createFilterStore();
    const before = stateOf(store).collapsedGroups;
    store.getState().toggleGroupCollapsed('amulet:prefix');
    const after = stateOf(store).collapsedGroups;
    expect(before).not.toBe(after);
    expect(before.size).toBe(0);  // previous set untouched
    expect(after.size).toBe(1);
  });
});

describe('filter-store — Phase 1 actions: expandedSubGroups (sub-group level)', () => {
  it('toggleSubGroupExpanded adds then removes the key (sub-groups default COLLAPSED)', () => {
    const store = createFilterStore();
    // Default: empty set = all sub-groups collapsed
    expect(stateOf(store).expandedSubGroups.size).toBe(0);
    // Toggle adds key = expanded
    store.getState().toggleSubGroupExpanded('waystone:prefix:positive-loot');
    expectSetsEqual(stateOf(store).expandedSubGroups, ['waystone:prefix:positive-loot']);
    // Toggle again removes key = collapsed
    store.getState().toggleSubGroupExpanded('waystone:prefix:positive-loot');
    expectSetsEqual(stateOf(store).expandedSubGroups, []);
  });

  it('setSubGroupExpanded(true) expands, setSubGroupExpanded(false) collapses', () => {
    const store = createFilterStore();
    store.getState().setSubGroupExpanded('belt:prefix:resistances', true);
    expectSetsEqual(stateOf(store).expandedSubGroups, ['belt:prefix:resistances']);
    store.getState().setSubGroupExpanded('belt:prefix:resistances', false);
    expectSetsEqual(stateOf(store).expandedSubGroups, []);
  });

  it('expandAllSubGroups(keys) populates the set with all keys', () => {
    const store = createFilterStore();
    const keys = ['belt:prefix:resistances', 'belt:prefix:attributes'];
    store.getState().expandAllSubGroups(keys);
    expectSetsEqual(stateOf(store).expandedSubGroups, keys);
  });

  it('collapseAllSubGroups() empties the set (all sub-groups COLLAPSED — default state)', () => {
    const store = createFilterStore();
    store.getState().setSubGroupExpanded('ring:implicit:defensive', true);
    store.getState().setSubGroupExpanded('ring:implicit:offensive', true);
    store.getState().collapseAllSubGroups();
    expectSetsEqual(stateOf(store).expandedSubGroups, []);
  });

  it('does not mutate the previous Set instance (immutable update)', () => {
    const store = createFilterStore();
    const before = stateOf(store).expandedSubGroups;
    store.getState().toggleSubGroupExpanded('jewel:prefix:damage-type');
    const after = stateOf(store).expandedSubGroups;
    expect(before).not.toBe(after);
    expect(before.size).toBe(0);
    expect(after.size).toBe(1);
  });
});

describe('filter-store — Phase 1 actions: showSelectedOnly', () => {
  it('setShowSelectedOnly(true) flips the flag', () => {
    const store = createFilterStore();
    expect(stateOf(store).showSelectedOnly).toBe(false);
    store.getState().setShowSelectedOnly(true);
    expect(stateOf(store).showSelectedOnly).toBe(true);
  });

  it('setShowSelectedOnly(false) flips it back', () => {
    const store = createFilterStore();
    store.getState().setShowSelectedOnly(true);
    store.getState().setShowSelectedOnly(false);
    expect(stateOf(store).showSelectedOnly).toBe(false);
  });

  it('setShowSelectedOnly is idempotent', () => {
    const store = createFilterStore();
    store.getState().setShowSelectedOnly(true);
    store.getState().setShowSelectedOnly(true);
    expect(stateOf(store).showSelectedOnly).toBe(true);
  });
});

describe('filter-store — Phase 1 actions: pinnedIds (favorites)', () => {
  it('togglePinned adds then removes the id', () => {
    const store = createFilterStore();
    store.getState().togglePinned('ring_t1_fire_resistance');
    expectSetsEqual(stateOf(store).pinnedIds, ['ring_t1_fire_resistance']);
    store.getState().togglePinned('ring_t1_fire_resistance');
    expectSetsEqual(stateOf(store).pinnedIds, []);
  });

  it('togglePinned on multiple ids accumulates independently', () => {
    const store = createFilterStore();
    store.getState().togglePinned('id1');
    store.getState().togglePinned('id2');
    store.getState().togglePinned('id3');
    expectSetsEqual(stateOf(store).pinnedIds, ['id1', 'id2', 'id3']);
    // Unpin id2 leaves id1, id3
    store.getState().togglePinned('id2');
    expectSetsEqual(stateOf(store).pinnedIds, ['id1', 'id3']);
  });

  it('clearPinned empties the set', () => {
    const store = createFilterStore();
    store.getState().togglePinned('a');
    store.getState().togglePinned('b');
    store.getState().clearPinned();
    expectSetsEqual(stateOf(store).pinnedIds, []);
  });

  it('clearPinned on empty set is a no-op', () => {
    const store = createFilterStore();
    store.getState().clearPinned();
    expectSetsEqual(stateOf(store).pinnedIds, []);
  });
});

describe('filter-store — Phase 1 actions: chipExpandState (Phase 2.5 «+N ещё»)', () => {
  it('toggleChipExpand adds then removes the key', () => {
    const store = createFilterStore();
    // Default: empty set = all sub-groups show truncated preview («+N ещё»)
    expect(stateOf(store).chipExpandState.size).toBe(0);
    // Toggle expands all chips for this sub-group
    store.getState().toggleChipExpand('belt:prefix:resistances');
    expectSetsEqual(stateOf(store).chipExpandState, ['belt:prefix:resistances']);
    // Toggle again collapses back to truncated preview
    store.getState().toggleChipExpand('belt:prefix:resistances');
    expectSetsEqual(stateOf(store).chipExpandState, []);
  });

  it('setChipExpand(true) expands, setChipExpand(false) collapses', () => {
    const store = createFilterStore();
    store.getState().setChipExpand('waystone:implicit:rarity', true);
    expectSetsEqual(stateOf(store).chipExpandState, ['waystone:implicit:rarity']);
    store.getState().setChipExpand('waystone:implicit:rarity', false);
    expectSetsEqual(stateOf(store).chipExpandState, []);
  });

  it('expandAllChips(keys) populates the set with all keys', () => {
    const store = createFilterStore();
    const keys = ['belt:prefix:resistances', 'belt:prefix:attributes', 'belt:suffix:damage'];
    store.getState().expandAllChips(keys);
    expectSetsEqual(stateOf(store).chipExpandState, keys);
  });

  it('collapseAllChips() empties the set (all sub-groups truncated — default)', () => {
    const store = createFilterStore();
    store.getState().setChipExpand('ring:prefix:resistances', true);
    store.getState().setChipExpand('ring:suffix:crit', true);
    store.getState().collapseAllChips();
    expectSetsEqual(stateOf(store).chipExpandState, []);
  });
});

describe('filter-store — Phase 1 serialize/deserialize round-trip', () => {
  it('round-trips collapsedGroups (top-level COLLAPSED set)', () => {
    const store = createFilterStore();
    store.getState().setGroupCollapsed('waystone:prefix', true);
    store.getState().setGroupCollapsed('waystone:implicit', true);

    const serialized = store.getState().serialize();
    expect(Array.isArray(serialized.c)).toBe(true);
    expect((serialized.c as string[]).sort()).toEqual(['waystone:implicit', 'waystone:prefix']);

    const store2 = createFilterStore();
    store2.getState().deserialize(serialized);
    expectSetsEqual(stateOf(store2).collapsedGroups, ['waystone:prefix', 'waystone:implicit']);
  });

  it('round-trips expandedSubGroups (sub-group EXPANDED set)', () => {
    const store = createFilterStore();
    store.getState().setSubGroupExpanded('belt:prefix:resistances', true);
    store.getState().setSubGroupExpanded('belt:suffix:damage', true);

    const serialized = store.getState().serialize();
    expect(Array.isArray(serialized.es)).toBe(true);
    expect((serialized.es as string[]).sort()).toEqual(['belt:prefix:resistances', 'belt:suffix:damage']);

    const store2 = createFilterStore();
    store2.getState().deserialize(serialized);
    expectSetsEqual(stateOf(store2).expandedSubGroups, ['belt:prefix:resistances', 'belt:suffix:damage']);
  });

  it('round-trips showSelectedOnly=true', () => {
    const store = createFilterStore();
    store.getState().setShowSelectedOnly(true);

    const serialized = store.getState().serialize();
    expect(serialized.so).toBe(1);

    const store2 = createFilterStore();
    store2.getState().deserialize(serialized);
    expect(stateOf(store2).showSelectedOnly).toBe(true);
  });

  it('round-trips showSelectedOnly=false (omitted from serialization)', () => {
    const store = createFilterStore();
    // Default false — should NOT be in serialized output
    const serialized = store.getState().serialize();
    expect(serialized.so).toBeUndefined();
  });

  it('round-trips pinnedIds (favorites set)', () => {
    const store = createFilterStore();
    store.getState().togglePinned('fav1');
    store.getState().togglePinned('fav2');
    store.getState().togglePinned('fav3');

    const serialized = store.getState().serialize();
    expect(Array.isArray(serialized.pn)).toBe(true);
    expect((serialized.pn as string[]).sort()).toEqual(['fav1', 'fav2', 'fav3']);

    const store2 = createFilterStore();
    store2.getState().deserialize(serialized);
    expectSetsEqual(stateOf(store2).pinnedIds, ['fav1', 'fav2', 'fav3']);
  });

  it('round-trips chipExpandState (Phase 2.5 chip-expanded set)', () => {
    const store = createFilterStore();
    store.getState().setChipExpand('belt:prefix:resistances', true);
    store.getState().setChipExpand('ring:suffix:crit', true);

    const serialized = store.getState().serialize();
    expect(Array.isArray(serialized.ce)).toBe(true);
    expect((serialized.ce as string[]).sort()).toEqual(['belt:prefix:resistances', 'ring:suffix:crit']);

    const store2 = createFilterStore();
    store2.getState().deserialize(serialized);
    expectSetsEqual(stateOf(store2).chipExpandState, ['belt:prefix:resistances', 'ring:suffix:crit']);
  });

  it('round-trips ALL 5 new fields together with existing fields', () => {
    const store = createFilterStore();
    // Existing fields
    store.getState().toggleToken('tok1');
    store.getState().toggleToken('tok2');
    store.getState().setSearchText('test query');
    store.getState().setAffixFilter('prefix');
    store.getState().setExtraState('sortMode', 'tier-first');
    // Phase 1 fields
    store.getState().setGroupCollapsed('waystone:prefix', true);
    store.getState().setSubGroupExpanded('waystone:prefix:positive-loot', true);
    store.getState().setShowSelectedOnly(true);
    store.getState().togglePinned('fav1');
    store.getState().setChipExpand('waystone:implicit:rarity', true);

    const serialized = store.getState().serialize();

    // All new keys present
    expect(serialized.c).toBeDefined();
    expect(serialized.es).toBeDefined();
    expect(serialized.so).toBe(1);
    expect(serialized.pn).toBeDefined();
    expect(serialized.ce).toBeDefined();

    // Existing keys still present
    expect(serialized.s).toBeDefined();
    expect(serialized.t).toBe('test query');
    expect(serialized.a).toBe('prefix');
    expect(serialized.x).toEqual({ sortMode: 'tier-first' });

    const store2 = createFilterStore();
    store2.getState().deserialize(serialized);

    const restored = stateOf(store2);
    expectSetsEqual(restored.collapsedGroups, ['waystone:prefix']);
    expectSetsEqual(restored.expandedSubGroups, ['waystone:prefix:positive-loot']);
    expect(restored.showSelectedOnly).toBe(true);
    expectSetsEqual(restored.pinnedIds, ['fav1']);
    expectSetsEqual(restored.chipExpandState, ['waystone:implicit:rarity']);

    // Existing fields
    expectSetsEqual(restored.selectedIds, ['tok1', 'tok2']);
    expect(restored.searchText).toBe('test query');
    expect(restored.affixFilter).toBe('prefix');
    expect(restored.extraState).toEqual({ sortMode: 'tier-first' });
  });
});

describe('filter-store — Phase 1 backward-compat (old URLs)', () => {
  it('deserialize of URL with only old keys → new fields get defaults (no crash)', () => {
    // Simulates an old URL from before iter 132 — only s, e, t, a, o, x, r keys.
    // iter 149: legacy `p` key (priorityFilter) is silently ignored after
    // the feature was removed. Old bookmarks with `p=S` or `p=S+A` will just
    // show all groups (default behaviour) instead of the previously filtered set.
    const oldUrlData: Record<string, unknown> = {
      s: ['token1', 'token2'],
      e: ['excluded1'],
      t: 'old search',
      a: 'suffix',
      o: 'desecrated',
      p: 'S',  // legacy priorityFilter — silently dropped in iter 149
      x: { customFlag: true },
    };

    const store = createFilterStore();
    expect(() => store.getState().deserialize(oldUrlData)).not.toThrow();

    const s = stateOf(store);
    // Existing fields restored correctly
    expectSetsEqual(s.selectedIds, ['token1', 'token2']);
    expectSetsEqual(s.excludedIds, ['excluded1']);
    expect(s.searchText).toBe('old search');
    expect(s.affixFilter).toBe('suffix');
    expect(s.originFilter).toBe('desecrated');
    expect(s.extraState).toEqual({ customFlag: true });

    // Phase 1 fields get DEFAULTS (asymmetric per iter 131 §13.7 correction #4)
    expect(s.collapsedGroups.size).toBe(0);        // empty = all top-level EXPANDED
    expect(s.expandedSubGroups.size).toBe(0);      // empty = all sub-groups COLLAPSED
    expect(s.showSelectedOnly).toBe(false);
    expect(s.pinnedIds.size).toBe(0);
    expect(s.chipExpandState.size).toBe(0);
  });

  it('deserialize of EMPTY object → all defaults (no crash)', () => {
    const store = createFilterStore();
    expect(() => store.getState().deserialize({})).not.toThrow();
    const s = stateOf(store);
    expect(s.selectedIds.size).toBe(0);
    expect(s.collapsedGroups.size).toBe(0);
    expect(s.expandedSubGroups.size).toBe(0);
    expect(s.showSelectedOnly).toBe(false);
    expect(s.pinnedIds.size).toBe(0);
    expect(s.chipExpandState.size).toBe(0);
  });

  it('deserialize of malformed Phase 1 keys (non-array) → defaults (defensive)', () => {
    // Defensive: if URL data is corrupted, treat as missing key → defaults.
    const malformed: Record<string, unknown> = {
      c: 'not-an-array',            // should be array
      es: { invalid: true },        // should be array
      so: 'yes',                    // should be 1 / true
      pn: 42,                       // should be array
      ce: null,                     // should be array
    };
    const store = createFilterStore();
    expect(() => store.getState().deserialize(malformed)).not.toThrow();
    const s = stateOf(store);
    expect(s.collapsedGroups.size).toBe(0);
    expect(s.expandedSubGroups.size).toBe(0);
    expect(s.showSelectedOnly).toBe(false);
    expect(s.pinnedIds.size).toBe(0);
    expect(s.chipExpandState.size).toBe(0);
  });

  it('deserialize filters out non-string entries in Phase 1 arrays (defensive)', () => {
    const mixed: Record<string, unknown> = {
      c: ['valid1', 42, null, 'valid2', { bad: true }, true],
      pn: ['fav1', 99, 'fav2'],
    };
    const store = createFilterStore();
    store.getState().deserialize(mixed);
    expectSetsEqual(stateOf(store).collapsedGroups, ['valid1', 'valid2']);
    expectSetsEqual(stateOf(store).pinnedIds, ['fav1', 'fav2']);
  });

  it('showSelectedOnly accepts both `1` (compact) and `true` (verbose) formats', () => {
    // serialize() emits `1` (compact), but be tolerant of `true` for hand-crafted URLs.
    const store1 = createFilterStore();
    store1.getState().deserialize({ so: 1 });
    expect(stateOf(store1).showSelectedOnly).toBe(true);

    const store2 = createFilterStore();
    store2.getState().deserialize({ so: true });
    expect(stateOf(store2).showSelectedOnly).toBe(true);

    // Any other value → false
    const store3 = createFilterStore();
    store3.getState().deserialize({ so: 0 });
    expect(stateOf(store3).showSelectedOnly).toBe(false);

    const store4 = createFilterStore();
    store4.getState().deserialize({ so: 'yes' });
    expect(stateOf(store4).showSelectedOnly).toBe(false);
  });
});

describe('filter-store — Phase 1 compact serialization', () => {
  it('omits c key when collapsedGroups is empty (default = top-level EXPANDED)', () => {
    const store = createFilterStore();
    const serialized = store.getState().serialize();
    expect(serialized.c).toBeUndefined();
  });

  it('omits es key when expandedSubGroups is empty (default = sub-groups COLLAPSED)', () => {
    const store = createFilterStore();
    const serialized = store.getState().serialize();
    expect(serialized.es).toBeUndefined();
  });

  it('omits so key when showSelectedOnly is false (default)', () => {
    const store = createFilterStore();
    const serialized = store.getState().serialize();
    expect(serialized.so).toBeUndefined();
  });

  it('omits pn key when pinnedIds is empty (default)', () => {
    const store = createFilterStore();
    const serialized = store.getState().serialize();
    expect(serialized.pn).toBeUndefined();
  });

  it('omits ce key when chipExpandState is empty (default = truncated preview)', () => {
    const store = createFilterStore();
    const serialized = store.getState().serialize();
    expect(serialized.ce).toBeUndefined();
  });

  it('default state serializes to minimal object (no Phase 1 keys)', () => {
    const store = createFilterStore();
    const serialized = store.getState().serialize();
    // No Phase 1 keys at all
    expect(serialized.c).toBeUndefined();
    expect(serialized.es).toBeUndefined();
    expect(serialized.so).toBeUndefined();
    expect(serialized.pn).toBeUndefined();
    expect(serialized.ce).toBeUndefined();
    // Only existing-field keys (also omitted when default) — should be near-empty
    // s is always present (empty array), others omitted when default.
    expect(serialized.s).toEqual([]);
  });
});

describe('filter-store — Phase 1 resetFilters()', () => {
  it('resetFilters() resets all 5 new fields to defaults', () => {
    const store = createFilterStore();
    // Populate new fields with non-default values
    store.getState().setGroupCollapsed('ring:prefix', true);
    store.getState().setSubGroupExpanded('ring:prefix:resistances', true);
    store.getState().setShowSelectedOnly(true);
    store.getState().togglePinned('fav1');
    store.getState().setChipExpand('ring:suffix:crit', true);
    // Also touch existing fields
    store.getState().toggleToken('tok1');
    store.getState().setSearchText('text');

    store.getState().resetFilters();

    const s = stateOf(store);
    // Phase 1 fields reset to defaults
    expect(s.collapsedGroups.size).toBe(0);
    expect(s.expandedSubGroups.size).toBe(0);
    expect(s.showSelectedOnly).toBe(false);
    expect(s.pinnedIds.size).toBe(0);
    expect(s.chipExpandState.size).toBe(0);
    // Existing fields also reset
    expect(s.selectedIds.size).toBe(0);
    expect(s.searchText).toBe('');
  });
});

describe('filter-store — clearSelections() scope (Phase 1 fields NOT cleared)', () => {
  it('clearSelections() resets only selections — preserves Phase 1 fields', () => {
    // clearSelections is meant for the "Clear" button on the Selected Basket
    // (Phase 3). It should NOT wipe collapse state, favorites, or chip-expand
    // state — those are user preferences, not transient selections.
    const store = createFilterStore();
    store.getState().toggleToken('tok1');
    store.getState().toggleToken('tok2');
    store.getState().setGroupCollapsed('ring:prefix', true);
    store.getState().setSubGroupExpanded('ring:prefix:resistances', true);
    store.getState().setShowSelectedOnly(true);
    store.getState().togglePinned('fav1');
    store.getState().setChipExpand('ring:suffix:crit', true);

    store.getState().clearSelections();

    const s = stateOf(store);
    // Selections cleared
    expect(s.selectedIds.size).toBe(0);
    // Phase 1 fields PRESERVED (they're user preferences, not selections)
    expectSetsEqual(s.collapsedGroups, ['ring:prefix']);
    expectSetsEqual(s.expandedSubGroups, ['ring:prefix:resistances']);
    expect(s.showSelectedOnly).toBe(true);
    expectSetsEqual(s.pinnedIds, ['fav1']);
    expectSetsEqual(s.chipExpandState, ['ring:suffix:crit']);
  });
});

describe('filter-store — Phase 1 isolation between store instances', () => {
  it('two stores do not share Phase 1 state (per-category isolation)', () => {
    // Each category page gets its own store instance — Phase 1 state must not
    // leak across categories. Same invariant as existing fields.
    const ringStore = createFilterStore();
    const beltStore = createFilterStore();

    ringStore.getState().setGroupCollapsed('ring:prefix', true);
    ringStore.getState().togglePinned('ring_fav');

    // belt store untouched
    expect(beltStore.getState().collapsedGroups.size).toBe(0);
    expect(beltStore.getState().pinnedIds.size).toBe(0);
    expectSetsEqual(ringStore.getState().collapsedGroups, ['ring:prefix']);
    expectSetsEqual(ringStore.getState().pinnedIds, ['ring_fav']);
  });

  it('deserializing one store does not affect another', () => {
    const store1 = createFilterStore();
    const store2 = createFilterStore();

    store1.getState().setGroupCollapsed('waystone:prefix', true);
    const serialized = store1.getState().serialize();

    // Deserialize into store2 — store1 should be unchanged
    store2.getState().deserialize(serialized);
    expectSetsEqual(store1.getState().collapsedGroups, ['waystone:prefix']);
    expectSetsEqual(store2.getState().collapsedGroups, ['waystone:prefix']);
  });
});

// ─── iter 159: MIXED-mode 3-state chip tests (want / opt / exclude) ─────────
//
// Covers the new `optionalIds` Set<string> field + `toggleOptional` action,
// plus the 3-state mutual exclusion invariant: a token can be in EXACTLY
// ONE of {selectedIds, excludedIds, optionalIds} at any time.
//
// Also covers serialize/deserialize round-trip for the new `opt` URL key
// (parallel to existing `s` and `e` keys), and backward-compat for URLs
// that don't have `opt` (pre-iter-159 links).

describe('filter-store — iter 159 optionalIds (MIXED-mode 3-state chip)', () => {
  it('initializes optionalIds as empty Set', () => {
    const store = createFilterStore();
    const s = stateOf(store);
    expect(s.optionalIds).toBeInstanceOf(Set);
    expect(s.optionalIds.size).toBe(0);
  });

  it('toggleOptional adds IDs to optionalIds', () => {
    const store = createFilterStore();
    store.getState().toggleOptional(['t1', 't2']);
    expectSetsEqual(store.getState().optionalIds, ['t1', 't2']);
  });

  it('toggleOptional on already-optional IDs removes them (toggle off)', () => {
    const store = createFilterStore();
    store.getState().toggleOptional(['t1', 't2']);
    expect(store.getState().optionalIds.size).toBe(2);
    // Toggle again → removes all
    store.getState().toggleOptional(['t1', 't2']);
    expect(store.getState().optionalIds.size).toBe(0);
  });

  it('toggleOptional on subset of optional IDs only toggles those', () => {
    const store = createFilterStore();
    store.getState().toggleOptional(['t1', 't2', 't3']);
    // Toggle a subset (all are optional → removes them)
    store.getState().toggleOptional(['t1', 't3']);
    expectSetsEqual(store.getState().optionalIds, ['t2']);
  });

  // ─── 3-state mutual exclusion ───

  it('toggleToken removes from optionalIds (3-state mutual exclusion)', () => {
    const store = createFilterStore();
    store.getState().toggleOptional(['t1']);
    expect(store.getState().optionalIds.has('t1')).toBe(true);
    // Now toggle the same ID as want → should remove from optionalIds
    store.getState().toggleToken('t1');
    expectSetsEqual(store.getState().selectedIds, ['t1']);
    expect(store.getState().optionalIds.has('t1')).toBe(false);
  });

  it('toggleTokens (batch) removes from optionalIds (3-state mutual exclusion)', () => {
    const store = createFilterStore();
    store.getState().toggleOptional(['t1', 't2']);
    // Batch-select → both should move from optionalIds to selectedIds
    store.getState().toggleTokens(['t1', 't2']);
    expectSetsEqual(store.getState().selectedIds, ['t1', 't2']);
    expect(store.getState().optionalIds.size).toBe(0);
  });

  it('toggleExclude removes from optionalIds (3-state mutual exclusion)', () => {
    const store = createFilterStore();
    store.getState().toggleOptional(['t1', 't2']);
    // Exclude → both should move from optionalIds to excludedIds
    store.getState().toggleExclude(['t1', 't2']);
    expectSetsEqual(store.getState().excludedIds, ['t1', 't2']);
    expect(store.getState().optionalIds.size).toBe(0);
  });

  it('toggleOptional removes from selectedIds (3-state mutual exclusion)', () => {
    const store = createFilterStore();
    store.getState().toggleTokens(['t1', 't2']);
    expect(store.getState().selectedIds.size).toBe(2);
    // Move to optional → should remove from selectedIds
    store.getState().toggleOptional(['t1', 't2']);
    expectSetsEqual(store.getState().optionalIds, ['t1', 't2']);
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it('toggleOptional removes from excludedIds (3-state mutual exclusion)', () => {
    const store = createFilterStore();
    store.getState().toggleExclude(['t1', 't2']);
    expect(store.getState().excludedIds.size).toBe(2);
    // Move to optional → should remove from excludedIds
    store.getState().toggleOptional(['t1', 't2']);
    expectSetsEqual(store.getState().optionalIds, ['t1', 't2']);
    expect(store.getState().excludedIds.size).toBe(0);
  });

  // ─── clearSelections + resetFilters ───

  it('clearSelections() resets optionalIds along with selected/excluded', () => {
    const store = createFilterStore();
    store.getState().toggleTokens(['t1']);
    store.getState().toggleOptional(['t2', 't3']);
    store.getState().toggleExclude(['t4']);

    store.getState().clearSelections();

    const s = stateOf(store);
    expect(s.selectedIds.size).toBe(0);
    expect(s.excludedIds.size).toBe(0);
    expect(s.optionalIds.size).toBe(0);
  });

  it('resetFilters() resets optionalIds along with all other state', () => {
    const store = createFilterStore();
    store.getState().toggleOptional(['t1', 't2']);
    store.getState().setSearchText('text');

    store.getState().resetFilters();

    const s = stateOf(store);
    expect(s.optionalIds.size).toBe(0);
    expect(s.searchText).toBe('');
  });

  // ─── Serialize / Deserialize round-trip ───

  it('serialize() includes `opt` key when optionalIds is non-empty', () => {
    const store = createFilterStore();
    store.getState().toggleOptional(['t1', 't2']);
    const serialized = store.getState().serialize();
    expect(Array.isArray(serialized.opt)).toBe(true);
    expect(serialized.opt).toEqual(expect.arrayContaining(['t1', 't2']));
  });

  it('serialize() omits `opt` key when optionalIds is empty (URL compactness)', () => {
    const store = createFilterStore();
    const serialized = store.getState().serialize();
    expect(serialized.opt).toBeUndefined();
  });

  it('deserialize() restores optionalIds from `opt` key', () => {
    const store = createFilterStore();
    const data = { opt: ['a', 'b', 'c'] };
    store.getState().deserialize(data);
    expectSetsEqual(store.getState().optionalIds, ['a', 'b', 'c']);
  });

  it('deserialize() without `opt` key → empty optionalIds (backward compat)', () => {
    const store = createFilterStore();
    // Pre-iter-159 URLs don't have `opt` — should not crash, should default
    // to empty set.
    const data = { s: ['x'], e: ['y'] };
    store.getState().deserialize(data);
    expect(store.getState().optionalIds.size).toBe(0);
    // Other fields restored normally
    expectSetsEqual(store.getState().selectedIds, ['x']);
    expectSetsEqual(store.getState().excludedIds, ['y']);
  });

  it('serialize → deserialize round-trip preserves optionalIds', () => {
    const store1 = createFilterStore();
    store1.getState().toggleOptional(['opt1', 'opt2']);
    store1.getState().toggleTokens(['want1']);
    store1.getState().toggleExclude(['bad1']);

    const serialized = store1.getState().serialize();

    const store2 = createFilterStore();
    store2.getState().deserialize(serialized);

    expectSetsEqual(store2.getState().optionalIds, ['opt1', 'opt2']);
    expectSetsEqual(store2.getState().selectedIds, ['want1']);
    expectSetsEqual(store2.getState().excludedIds, ['bad1']);
  });

  // ─── Defensive: malformed URLs with overlapping sets ───

  it('deserialize() strips IDs from optionalIds that are also in selectedIds (defensive)', () => {
    // A buggy old URL might have the same ID in both `s` and `opt` (shouldn't
    // happen with the store's mutual exclusion, but could happen with manual
    // URL editing). Precedence: selectedIds > excludedIds > optionalIds.
    const store = createFilterStore();
    const data = { s: ['shared', 'only_want'], opt: ['shared', 'only_opt'] };
    store.getState().deserialize(data);
    expectSetsEqual(store.getState().selectedIds, ['shared', 'only_want']);
    // 'shared' should be stripped from optionalIds (precedence: selectedIds wins)
    expectSetsEqual(store.getState().optionalIds, ['only_opt']);
  });

  it('deserialize() strips IDs from optionalIds that are also in excludedIds (defensive)', () => {
    const store = createFilterStore();
    const data = { e: ['shared', 'only_exclude'], opt: ['shared', 'only_opt'] };
    store.getState().deserialize(data);
    expectSetsEqual(store.getState().excludedIds, ['shared', 'only_exclude']);
    // 'shared' should be stripped from optionalIds (precedence: excludedIds wins)
    expectSetsEqual(store.getState().optionalIds, ['only_opt']);
  });
});
