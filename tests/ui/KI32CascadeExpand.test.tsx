// @vitest-environment jsdom
/**
 * KI#32 (iter 144) — Cascade expand одинаковых sub-group ключей.
 *
 * Regression test for the cascade-expand bug:
 *   Before fix: sub-group key was `${categoryId}:${affix}:${sg.key}` —
 *   identical across origin sections (normal/corrupted/desecrated). Toggling
 *   expand in «Обычные» also expanded «Осквернённые» / «Очернённые» /
 *   «Разлома» sub-groups with the same `sg.key`.
 *
 *   After fix: sub-group key is `${categoryId}:${affix}:${origin}:${sg.key}`
 *   — each (origin, block) tuple gets unique expand/collapse state.
 *
 * Test strategy: render ModList with showOriginSubSections=true and tokens
 * spanning 2 origins (normal + corrupted) × 2 functional blocks
 * (resistances + attributes). Each origin section has 2 sub-groups, so
 * `hideLabel=false` and the collapse state actually controls chip visibility.
 *
 * Pass `expandedSubGroups` containing ONLY the normal-origin 'resistances'
 * sub-group key. Verify:
 *   - normal 'resistances' chip renders (1 chip).
 *   - normal 'attributes' chip does NOT render (collapsed).
 *   - corrupted 'resistances' chip does NOT render (collapsed — KEY CHECK).
 *   - corrupted 'attributes' chip does NOT render (collapsed).
 *
 * If the bug regressed (old key `ring:prefix:resistances` matched both
 * origins), the corrupted 'resistances' chip would ALSO render → 2 chips.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModList } from '@ui/components/ModList';
import type { GameToken } from '@shared/types';

function makeToken(id: string, opts: Partial<GameToken> = {}): GameToken {
  return {
    id,
    category: 'ring',
    origin: 'normal',
    rawText: { ru: `Текст ${id}` },
    rawTextTemplate: { ru: '## текст' },
    regex: { ru: `текст.*${id}` },
    familyKey: { ru: 'семейство тест' },
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
    // Tag the functional category so classifyFunctionalBlock returns the
    // specified block instead of falling back to 'other'.
    functionalCategory: 'resistances',
    ...opts,
  };
}

/** Build a tokens array with 2 origins × 2 functional blocks.
 *
 *  Layout (after groupTokensByFamily + splitGroupByOrigin + classifyGroups):
 *   - Обычные (normal origin)
 *     - resistances sub-group → 1 family ('Резист')
 *     - attributes  sub-group → 1 family ('Характеристики')
 *   - Осквернённые (corrupted origin)
 *     - resistances sub-group → 1 family ('Резист')
 *     - attributes  sub-group → 1 family ('Характеристики')
 *
 *  Each origin section has 2 sub-groups → `hideLabel=false` → chip
 *  visibility is controlled by `expandedSubGroups`.
 */
function makeMixedOriginTokens(): GameToken[] {
  return [
    // Normal origin — resistances + attributes
    makeToken('p1-normal-res', {
      origin: 'normal',
      familyKey: { ru: 'Резист' },
      rawText: { ru: '+ к сопротивлению (норма)' },
      functionalCategory: 'resistances',
    }),
    makeToken('p2-normal-attr', {
      origin: 'normal',
      familyKey: { ru: 'Характеристики' },
      rawText: { ru: '+ к силе (норма)' },
      functionalCategory: 'attributes',
    }),
    // Corrupted origin — resistances + attributes (SAME familyKeys + categories)
    makeToken('p1-corrupted-res', {
      origin: 'corrupted',
      familyKey: { ru: 'Резист' },
      rawText: { ru: '+ к сопротивлению (осквернено)' },
      functionalCategory: 'resistances',
    }),
    makeToken('p2-corrupted-attr', {
      origin: 'corrupted',
      familyKey: { ru: 'Характеристики' },
      rawText: { ru: '+ к силе (осквернено)' },
      functionalCategory: 'attributes',
    }),
  ];
}

describe('KI#32 (iter 144) — cascade expand fix', () => {
  it('expanding normal-origin "resistances" does NOT expand corrupted-origin "resistances"', () => {
    const tokens = makeMixedOriginTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set()}
        searchText=""
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="ring"
        groupMode="affix-functional"
        showOriginSubSections
        // Only the NORMAL origin 'resistances' sub-group is in expandedSubGroups.
        // Key format after KI#32 fix: `${categoryId}:${affix}:${origin}:${sg.key}`.
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['ring:prefix:normal:resistances'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );

    // After KI#32 fix:
    //   - normal 'resistances' chip renders (expanded) → 1 'Резист'.
    //   - normal 'attributes' chip hidden (collapsed).
    //   - corrupted 'resistances' chip hidden (collapsed — KEY CHECK).
    //   - corrupted 'attributes' chip hidden (collapsed).
    //
    // If the bug regressed (old key `ring:prefix:resistances` matched both
    // origins), the corrupted 'resistances' chip would ALSO render → 2 'Резист'.
    const resistChips = screen.getAllByText('Резист');
    expect(resistChips.length).toBe(1);

    // 'Характеристики' should NOT render at all (both origin sections'
    // attributes sub-groups are collapsed).
    const attrChips = screen.queryAllByText('Характеристики');
    expect(attrChips.length).toBe(0);
  });

  it('expanding corrupted-origin "resistances" does NOT expand normal-origin "resistances"', () => {
    const tokens = makeMixedOriginTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set()}
        searchText=""
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="ring"
        groupMode="affix-functional"
        showOriginSubSections
        // Only the CORRUPTED origin 'resistances' sub-group is in expandedSubGroups.
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['ring:prefix:corrupted:resistances'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );

    // After KI#32 fix: only corrupted 'resistances' chip renders → 1 'Резист'.
    const resistChips = screen.getAllByText('Резист');
    expect(resistChips.length).toBe(1);

    // 'Характеристики' should NOT render at all.
    const attrChips = screen.queryAllByText('Характеристики');
    expect(attrChips.length).toBe(0);
  });

  it('expanding normal "resistances" + corrupted "attributes" renders only those 2 chips', () => {
    const tokens = makeMixedOriginTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set()}
        searchText=""
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="ring"
        groupMode="affix-functional"
        showOriginSubSections
        // Mix: normal 'resistances' + corrupted 'attributes' expanded.
        // Pre-fix, this would have cascaded in confusing ways.
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>([
          'ring:prefix:normal:resistances',
          'ring:prefix:corrupted:attributes',
        ])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );

    // Exactly 1 'Резист' (normal) + 1 'Характеристики' (corrupted) visible.
    const resistChips = screen.getAllByText('Резист');
    expect(resistChips.length).toBe(1);

    const attrChips = screen.getAllByText('Характеристики');
    expect(attrChips.length).toBe(1);
  });

  it('expanding BOTH origins\' "resistances" renders 2 resist chips (sanity check)', () => {
    const tokens = makeMixedOriginTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set()}
        searchText=""
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="ring"
        groupMode="affix-functional"
        showOriginSubSections
        // BOTH origins' 'resistances' sub-groups expanded.
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>([
          'ring:prefix:normal:resistances',
          'ring:prefix:corrupted:resistances',
        ])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );

    // Sanity check: 2 'Резист' chips (1 normal + 1 corrupted).
    const resistChips = screen.getAllByText('Резист');
    expect(resistChips.length).toBe(2);
  });

  it('collapsing ALL sub-groups renders 0 chips (default state, sanity check)', () => {
    const tokens = makeMixedOriginTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set()}
        searchText=""
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="ring"
        groupMode="affix-functional"
        showOriginSubSections
        // All sub-groups collapsed (default state).
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );

    // Default state: no sub-group expanded → 0 chips visible.
    const resistChips = screen.queryAllByText('Резист');
    expect(resistChips.length).toBe(0);

    const attrChips = screen.queryAllByText('Характеристики');
    expect(attrChips.length).toBe(0);
  });
});
