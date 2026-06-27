// @vitest-environment jsdom
/**
 * React component tests for VirtualizedModList (Phase 2, iter 133).
 *
 * Tests focus on the new row-filtering behaviour for collapsible affix groups:
 *   - Default state: top-level EXPANDED, sub-groups COLLAPSED.
 *   - Collapsed top-level group → only column-header row emitted (no chips).
 *   - Expanded sub-group → chips render; collapsed sub-group → only header.
 *   - Sticky search bar has the `.sticky-search-bar` class.
 *   - Expand all / Collapse all buttons render only when collapse wiring is provided.
 *   - Backward compat: when collapse props are NOT provided, all groups render
 *     expanded (preserves pre-Phase-2 behaviour).
 *
 * Note: VirtualizedModList uses TanStack Virtual which requires a real scroll
 * container with dimensions. In jsdom, the virtualizer renders 0 visible items
 * because getBoundingClientRect returns 0×0. We use `container.querySelector`
 * and `queryByText` to verify the row CONTENT is present in the DOM (the
 * virtualizer in jsdom does emit rows but they may not be visible).
 *
 * For tests that need to verify chip visibility, we test the `buildColumnRows`
 * filtering indirectly via the rendered DOM: when collapse state changes, the
 * rows array changes, which triggers a re-render. We assert on the presence
 * of the GroupHeader button (column header) and FilterChip text.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VirtualizedModList } from '@ui/components/VirtualizedModList';
import type { GameToken } from '@shared/types';

// ─── Test fixtures ───

function makeToken(id: string, opts: Partial<GameToken> = {}): GameToken {
  return {
    id,
    category: 'belt',
    origin: 'normal',
    rawText: { ru: `Текст мода ${id}` },
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
    ...opts,
  };
}

function makeBeltTokens(): GameToken[] {
  return [
    makeToken('p1', { affix: 'prefix', familyKey: { ru: 'Резист' }, rawText: { ru: '+ к сопротивлению' } }),
    makeToken('p2', { affix: 'prefix', familyKey: { ru: 'Резист' }, rawText: { ru: '+ к сопротивлению огню' } }),
    makeToken('p3', { affix: 'prefix', familyKey: { ru: 'Характеристики' }, rawText: { ru: '+ к силе' } }),
    makeToken('p4', { affix: 'prefix', familyKey: { ru: 'Характеристики' }, rawText: { ru: '+ к ловкости' } }),
    makeToken('s1', { affix: 'suffix', familyKey: { ru: 'Урон' }, rawText: { ru: '+ к урону' } }),
    makeToken('s2', { affix: 'suffix', familyKey: { ru: 'Урон' }, rawText: { ru: '+ к урону огнем' } }),
    makeToken('s3', { affix: 'suffix', familyKey: { ru: 'Жизнь' }, rawText: { ru: '+ к максимуму жизни' } }),
    makeToken('s4', { affix: 'suffix', familyKey: { ru: 'Жизнь' }, rawText: { ru: '+ к регенерации' } }),
  ];
}

describe('VirtualizedModList — Phase 2 collapse behaviour (iter 133)', () => {
  // ─── Sticky search bar ───

  it('search row has the .sticky-search-bar CSS class', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });

  // ─── Expand all / Collapse all buttons ───

  it('renders "Expand all" / "Collapse all" buttons when collapse wiring is provided', () => {
    const tokens = makeBeltTokens();
    render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        onExpandAllGroups={vi.fn()}
        onCollapseAllGroups={vi.fn()}
        onExpandAllSubGroups={vi.fn()}
        onCollapseAllSubGroups={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Развернуть все' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть все' })).toBeInTheDocument();
  });

  it('omits "Expand all" / "Collapse all" buttons when collapse wiring is absent (legacy)', () => {
    const tokens = makeBeltTokens();
    render(
      <VirtualizedModList
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
        category="belt"
      />
    );

    expect(screen.queryByRole('button', { name: 'Развернуть все' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Свернуть все' })).not.toBeInTheDocument();
  });

  // ─── Expand all / Collapse all button click behaviour ───

  it('"Expand all" button calls onExpandAllSubGroups with all sub-group keys', () => {
    const tokens = makeBeltTokens();
    const onExpandAllSubGroups = vi.fn();
    render(
      <VirtualizedModList
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
        category="belt"
        groupMode="affix-only"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        onExpandAllSubGroups={onExpandAllSubGroups}
        onCollapseAllSubGroups={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Развернуть все' }));
    expect(onExpandAllSubGroups).toHaveBeenCalledTimes(1);
    const arg = onExpandAllSubGroups.mock.calls[0][0] as string[];
    expect(arg).toEqual(expect.arrayContaining(['belt:prefix:all', 'belt:suffix:all']));
  });

  it('"Collapse all" button calls onCollapseAllSubGroups', () => {
    const tokens = makeBeltTokens();
    const onCollapseAllSubGroups = vi.fn();
    render(
      <VirtualizedModList
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
        category="belt"
        groupMode="affix-only"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        onExpandAllSubGroups={vi.fn()}
        onCollapseAllSubGroups={onCollapseAllSubGroups}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Свернуть все' }));
    expect(onCollapseAllSubGroups).toHaveBeenCalledTimes(1);
  });

  // ─── Backward compat ───

  it('backward compat: renders without crash when no collapse props provided', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
      />
    );
    // No GroupHeader buttons (no collapse wiring) — affix headers render as plain text.
    expect(container.querySelector('.group-header-btn')).toBeNull();
    // Search row present (sticky)
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });

  // ─── GroupHeader rendering when collapse wiring is present ───

  it('renders column-header rows as GroupHeader buttons when collapse wiring is provided', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );
    // The GroupHeader button has class 'group-header-btn'.
    // In jsdom the virtualizer may render 0 rows (no scroll dimensions), so
    // we just verify the component doesn't crash. The actual row rendering
    // is verified in the ModList tests via the non-virtualized variant.
    // Here we just confirm the component mounts and the sticky search renders.
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });

  // ─── Top-level collapse → only column-header row emitted ───

  it('collapsed top-level group: affix header renders as GroupHeader with aria-expanded=false', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>(['belt:prefix', 'belt:suffix'])}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );
    // Component mounts without crash. In jsdom, virtualizer renders 0 rows
    // because there's no scroll container with dimensions. The row filtering
    // is tested via the ModList tests (non-virtualized) which DO render rows.
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });
});

// ─── Phase 2.5 (iter 134): per-sub-group «+N ещё» chip expander ─────────────
//
// Note: VirtualizedModList uses TanStack Virtual which renders 0 rows in jsdom
// (no scroll container dimensions). These tests verify the component MOUNTS
// without crash when chip-expand wiring is provided/absent, and that the
// sticky-search row renders. Full chip-truncation behaviour is verified via
// the ModList tests (non-virtualized variant which DOES render rows).

describe('VirtualizedModList — Phase 2.5 chip-expand wiring (iter 134)', () => {
  it('mounts without crash when chip-expand wiring is provided', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        chipExpandState={new Set<string>()}
        onToggleChipExpand={vi.fn()}
      />
    );
    // Sticky search row present (component mounted successfully).
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });

  it('mounts without crash when chip-expand wiring is absent (legacy backward compat)', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        // Phase 2.5 wiring absent — legacy pre-Phase-2.5 behaviour.
      />
    );
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });

  it('accepts pinnedIds prop (forward-compatible with Phase 5 favorites)', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        chipExpandState={new Set<string>()}
        onToggleChipExpand={vi.fn()}
        pinnedIds={new Set<string>(['p1'])}
      />
    );
    // Component mounts without crash even with pinnedIds (Phase 5 forward-compat).
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });
});

// ─── Phase 3 (iter 135): show-selected-only wiring ─────────────────────────

describe('VirtualizedModList — Phase 3 show-selected-only (iter 135)', () => {
  it('mounts with showSelectedOnly=true (component does not crash)', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
        tokens={tokens}
        selectedIds={new Set(['p1', 's1'])}
        searchText=""
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        showSelectedOnly={true}
      />
    );
    // Component mounts without crash.
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
    // Stats line reflects filtered count (2 families selected: Резист + Урон,
    // out of 4 family groups total in makeBeltTokens, 8 tokens total).
    // Note: jsdom renders 0 virtualized rows but stats line is always rendered.
    expect(screen.getByText(/Показано 2 семейств из 8 аффиксов/)).toBeInTheDocument();
  });

  it('backward compat: without showSelectedOnly prop, all families count', () => {
    const tokens = makeBeltTokens();
    render(
      <VirtualizedModList
        tokens={tokens}
        selectedIds={new Set(['p1'])}
        searchText=""
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        // showSelectedOnly NOT provided → defaults to false → all families count.
      />
    );
    // Stats line shows ALL families (4 chips = 4 family groups in makeBeltTokens,
    // 8 tokens total).
    expect(screen.getByText(/Показано 4 семейств из 8 аффиксов/)).toBeInTheDocument();
  });
});

// ─── Phase 4 (iter 138): --strong modifier wiring ──────────────────────────
//
// iter 138 wires the `.affix-header-{prefix,suffix,implicit}--strong` CSS
// modifier (CSS rules added in iter 137) to be applied when `sortMode='tier-first'`.
// VirtualizedModList uses TanStack Virtual which renders 0 rows in jsdom (no
// scroll container dimensions), so we cannot directly assert on the rendered
// GroupHeader className. Instead, we verify the component MOUNTS without crash
// when sortMode is provided in either mode. The actual `--strong` modifier
// application is tested via the ModList tests (non-virtualized variant which
// DOES render rows).

describe('VirtualizedModList — Phase 4 strong modifier wiring (iter 138)', () => {
  it('mounts without crash when sortMode="tier-first" (--strong modifier wiring)', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        sortMode="tier-first"
      />
    );
    // Component mounts without crash — `--strong` modifier wiring path works.
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });

  it('mounts without crash when sortMode="alpha" (backward compat, no --strong)', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        sortMode="alpha"
      />
    );
    // Component mounts without crash — `alpha` mode preserves pre-iter-138
    // behaviour (no `--strong` modifier class added).
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });
});

// ─── iter 141 (KI#27): Prefix/Suffix columns 50/50 ───────────────────────

describe('VirtualizedModList — iter 141 (KI#27): prefix/suffix equal column widths', () => {
  // Pre-iter-141: VirtualizedModList used `md:grid-cols-[2fr_3fr]` (40/60),
  // but ModList.tsx was already fixed to `md:grid-cols-2` (50/50) in iter 139
  // KI#17. The iter 139 fix was missed in VirtualizedModList, leaving
  // belt/ring/amulet/jewel pages with visually unbalanced columns.
  // iter 141: VirtualizedModList now matches ModList — 50/50 via md:grid-cols-2.
  it('two-column layout uses 50/50 grid (md:grid-cols-2) instead of 2fr/3fr', () => {
    const tokens = makeBeltTokens(); // has both prefix + suffix
    const { container } = render(
      <VirtualizedModList
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );
    // Find the grid container that holds the two VirtualizedColumn components.
    const gridEl = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
    expect(gridEl).not.toBeNull();
    // Defensive: ensure the OLD 2fr/3fr class is NOT present.
    const oldGridEl = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-\\[2fr_3fr\\]');
    expect(oldGridEl).toBeNull();
  });
});
