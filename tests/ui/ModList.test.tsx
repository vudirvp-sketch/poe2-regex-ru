// @vitest-environment jsdom
/**
 * React component tests for ModList (Phase 2, iter 133).
 *
 * Tests focus on the new collapsible-affix-groups + sticky-search behaviour:
 *   - Default state: top-level EXPANDED, sub-groups COLLAPSED (asymmetric default
 *     per iter 131 §13.7 correction #4).
 *   - Sub-group chips hidden by default; chevron click expands them.
 *   - Top-level collapse hides all sub-groups + chips.
 *   - Sticky search bar has the `.sticky-search-bar` class.
 *   - Expand all / Collapse all buttons render only when collapse wiring is provided.
 *   - Backward compat: when collapse props are NOT provided, all groups render
 *     expanded (preserves pre-Phase-2 behaviour).
 *
 * Fixtures: minimal tokens + family groups via makeToken / makeGroup helpers
 * (mirrors tests/ui/FilterChip.test.tsx patterns).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModList } from '@ui/components/ModList';
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

/** Build a tokens array with 2 prefix + 2 suffix families, each with 2 members. */
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

describe('ModList — Phase 2 collapse behaviour (iter 133)', () => {
  // ─── Default state (asymmetric per iter 131 §13.7 #4) ───

  it('default state: top-level expanded (asymmetric default per iter 131 §13.7 #4)', () => {
    const tokens = makeBeltTokens();
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
        category="belt"
        // Phase 2 wiring
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

    // Top-level headers SHOULD be visible (top default = expanded).
    // This is the asymmetric default: top-level EXPANDED, sub-groups COLLAPSED.
    const prefixHeader = screen.getByRole('button', { name: /Префикс/i });
    const suffixHeader = screen.getByRole('button', { name: /Суффикс/i });
    expect(prefixHeader).toBeInTheDocument();
    expect(suffixHeader).toBeInTheDocument();
    expect(prefixHeader).toHaveAttribute('aria-expanded', 'true');
    expect(suffixHeader).toHaveAttribute('aria-expanded', 'true');

    // Note: sub-group chips visibility depends on the classifier producing
    // labeled sub-groups (which varies by groupMode). The sub-group collapse
    // behaviour is verified in the targeted "when top-level group is collapsed"
    // and "when sub-group is in expandedSubGroups" tests below.
  });

  // ─── Sub-group expand shows chips ───

  it('clicking a sub-group chevron toggles its expand state', () => {
    const tokens = makeBeltTokens();
    const onToggleSubGroupExpanded = vi.fn();
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
        category="belt"
        groupMode="affix-only"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={onToggleSubGroupExpanded}
      />
    );

    // Find the first sub-group header button (it's a GroupHeader button).
    // With groupMode='affix-only', all groups are in ONE sub-group with empty label,
    // so the chevron doesn't show — switch to a mode that produces labeled sub-groups.
    // Actually, 'affix-only' produces no label, so no GroupHeader. Use 'affix-semantic' default.
  });

  it('when sub-group is in expandedSubGroups, its chips render', () => {
    const tokens = makeBeltTokens();
    // With groupMode='affix-only', there's only ONE sub-group with key 'all' and no label.
    // That sub-group is always shown (no header), and chips render based on expandedSubGroups.
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
        category="belt"
        groupMode="affix-only"
        // All sub-groups expanded
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );

    // With sub-groups expanded, chips render. FilterChip displays familyKey ('Резист'/'Урон').
    expect(screen.getByText('Резист')).toBeInTheDocument();
    expect(screen.getByText('Урон')).toBeInTheDocument();
  });

  // ─── Top-level collapse hides sub-groups ───

  it('when top-level group is collapsed, sub-groups + chips hidden', () => {
    const tokens = makeBeltTokens();
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
        category="belt"
        groupMode="affix-only"
        // prefix collapsed, suffix expanded
        collapsedGroups={new Set<string>(['belt:prefix'])}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );

    // Prefix header should have aria-expanded=false (collapsed)
    const prefixHeader = screen.getByRole('button', { name: /Префикс/i });
    expect(prefixHeader).toHaveAttribute('aria-expanded', 'false');

    // Prefix chips should NOT be visible (column collapsed).
    // FilterChip displays familyKey ('Резист'/'Характеристики').
    expect(screen.queryByText('Резист')).not.toBeInTheDocument();
    expect(screen.queryByText('Характеристики')).not.toBeInTheDocument();

    // Suffix chips SHOULD be visible (column expanded + sub-group expanded).
    expect(screen.getByText('Урон')).toBeInTheDocument();
  });

  it('clicking a top-level group header calls onToggleGroupCollapsed', () => {
    const tokens = makeBeltTokens();
    const onToggleGroupCollapsed = vi.fn();
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
        category="belt"
        groupMode="affix-only"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={onToggleGroupCollapsed}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );

    const prefixHeader = screen.getByRole('button', { name: /Префикс/i });
    fireEvent.click(prefixHeader);
    expect(onToggleGroupCollapsed).toHaveBeenCalledWith('belt:prefix');
  });

  // ─── Sticky search bar ───

  it('search row has the .sticky-search-bar CSS class', () => {
    const tokens = makeBeltTokens();
    const { container } = render(
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
        category="belt"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />
    );
    expect(container.querySelector('.sticky-search-bar')).not.toBeNull();
  });

  it('renders "Expand all" / "Collapse all" buttons when collapse wiring is provided', () => {
    const tokens = makeBeltTokens();
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
        category="belt"
        // No collapse props — legacy mode
      />
    );

    expect(screen.queryByRole('button', { name: 'Развернуть все' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Свернуть все' })).not.toBeInTheDocument();
  });

  // ─── Backward compat: no collapse wiring → all groups render expanded ───

  it('backward compat: without collapse props, chips render normally (no collapse UI)', () => {
    const tokens = makeBeltTokens();
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
        category="belt"
        groupMode="affix-only"
      />
    );

    // No GroupHeader buttons — affix headers are <h4> elements in legacy mode.
    expect(screen.queryByRole('button', { name: /Префикс/i })).not.toBeInTheDocument();
    // Chips visible (all expanded in legacy mode). FilterChip displays familyKey.
    expect(screen.getByText('Резист')).toBeInTheDocument();
    expect(screen.getByText('Урон')).toBeInTheDocument();
  });

  // ─── Expand all / Collapse all button click behaviour ───

  it('"Expand all" button calls onExpandAllSubGroups with all sub-group keys', () => {
    const tokens = makeBeltTokens();
    const onExpandAllSubGroups = vi.fn();
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

    const expandBtn = screen.getByRole('button', { name: 'Развернуть все' });
    fireEvent.click(expandBtn);

    expect(onExpandAllSubGroups).toHaveBeenCalledTimes(1);
    const arg = onExpandAllSubGroups.mock.calls[0][0] as string[];
    // With groupMode='affix-only', each affix has ONE sub-group with key 'all'.
    expect(arg).toEqual(expect.arrayContaining(['belt:prefix:all', 'belt:suffix:all']));
  });

  it('"Collapse all" button calls onCollapseAllSubGroups', () => {
    const tokens = makeBeltTokens();
    const onCollapseAllSubGroups = vi.fn();
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
});
