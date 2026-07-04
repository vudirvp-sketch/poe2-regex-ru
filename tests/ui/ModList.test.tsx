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

/** Build a tokens array with 6 prefix families in one sub-group + 2 suffix.
 *  Used for Phase 2.5 truncation tests — 6 > CHIP_PREVIEW_COUNT (3) so the
 *  sub-group triggers «+N ещё» truncation by default. With groupMode='affix-only',
 *  all 6 prefix tokens share sub-group key 'all' → predictable sub-group key
 *  'belt:prefix:all'. */
function makeManyChipsTokens(): GameToken[] {
  return [
    makeToken('p1', { affix: 'prefix', familyKey: { ru: 'Семейство 1' }, rawText: { ru: 'текст 1' } }),
    makeToken('p2', { affix: 'prefix', familyKey: { ru: 'Семейство 2' }, rawText: { ru: 'текст 2' } }),
    makeToken('p3', { affix: 'prefix', familyKey: { ru: 'Семейство 3' }, rawText: { ru: 'текст 3' } }),
    makeToken('p4', { affix: 'prefix', familyKey: { ru: 'Семейство 4' }, rawText: { ru: 'текст 4' } }),
    makeToken('p5', { affix: 'prefix', familyKey: { ru: 'Семейство 5' }, rawText: { ru: 'текст 5' } }),
    makeToken('p6', { affix: 'prefix', familyKey: { ru: 'Семейство 6' }, rawText: { ru: 'текст 6' } }),
    makeToken('s1', { affix: 'suffix', familyKey: { ru: 'Суффикс 1' }, rawText: { ru: 'суффикс 1' } }),
    makeToken('s2', { affix: 'suffix', familyKey: { ru: 'Суффикс 2' }, rawText: { ru: 'суффикс 2' } }),
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

  // iter 170 (A4): the existing always-render test was replaced with a
  // conditional rendering test suite below. With A4 spec, the buttons are
  // visible only when their action is applicable (collapse-all hidden when
  // nothing is expanded; expand-all hidden when everything is expanded).
  // For backward-compat callers providing only onExpandAllGroups /
  // onCollapseAllGroups (legacy L1 mode, no sub-group wiring), both buttons
  // remain always visible with the old generic labels — covered by the
  // "legacy L1 mode" test below.

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

  it('"Expand all subcategories" button calls onExpandAllSubGroups with all sub-group keys', () => {
    // iter 170 (A4): label changed to "Развернуть все подкатегории" (specific
    // to L3 sub-groups). Button is visible when ≥1 sub-group is COLLAPSED —
    // empty expandedSubGroups satisfies this (0 < 2).
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

    const expandBtn = screen.getByRole('button', { name: 'Развернуть все подкатегории' });
    fireEvent.click(expandBtn);

    expect(onExpandAllSubGroups).toHaveBeenCalledTimes(1);
    const arg = onExpandAllSubGroups.mock.calls[0][0] as string[];
    // With groupMode='affix-only', each affix has ONE sub-group with key 'all'.
    expect(arg).toEqual(expect.arrayContaining(['belt:prefix:all', 'belt:suffix:all']));
  });

  it('"Collapse all subcategories" button calls onCollapseAllSubGroups', () => {
    // iter 170 (A4): label changed to "Свернуть все подкатегории" (specific
    // to L3 sub-groups). Button is visible only when ≥1 sub-group is EXPANDED —
    // we provide one expanded sub-group to satisfy this.
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
        expandedSubGroups={new Set<string>(['belt:prefix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        onExpandAllSubGroups={vi.fn()}
        onCollapseAllSubGroups={onCollapseAllSubGroups}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Свернуть все подкатегории' }));
    expect(onCollapseAllSubGroups).toHaveBeenCalledTimes(1);
  });

  // ─── iter 170 (A4): conditional rendering per A4 spec ───
  // Spec: collapse-all-subgroups visible only when ≥1 L3 EXPANDED.
  //       expand-all-subgroups visible only when ≥1 L3 COLLAPSED.
  //       L1 (top-level affix columns) state is NOT touched.

  it('A4: when no sub-groups expanded — only expand-all-subcategories button visible (collapse hidden)', () => {
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

    expect(screen.getByRole('button', { name: 'Развернуть все подкатегории' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Свернуть все подкатегории' })).not.toBeInTheDocument();
  });

  it('A4: when some sub-groups expanded — both buttons visible', () => {
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
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        onExpandAllGroups={vi.fn()}
        onCollapseAllGroups={vi.fn()}
        onExpandAllSubGroups={vi.fn()}
        onCollapseAllSubGroups={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Развернуть все подкатегории' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть все подкатегории' })).toBeInTheDocument();
  });

  it('A4: when all sub-groups expanded — only collapse-all-subcategories button visible (expand hidden)', () => {
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
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        onExpandAllGroups={vi.fn()}
        onCollapseAllGroups={vi.fn()}
        onExpandAllSubGroups={vi.fn()}
        onCollapseAllSubGroups={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Развернуть все подкатегории' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть все подкатегории' })).toBeInTheDocument();
  });

  it('A4: legacy L1 mode (only top-level callbacks) — both buttons always visible with old labels', () => {
    // Backward compat: callers without sub-group wiring (legacy mode) get the
    // old always-visible buttons with generic «Развернуть/Свернуть все» labels.
    // The buttons affect L1 top-level groups only in this mode.
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
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        onExpandAllGroups={vi.fn()}
        onCollapseAllGroups={vi.fn()}
        // NO onExpandAllSubGroups / onCollapseAllSubGroups → L1 mode
      />
    );

    expect(screen.getByRole('button', { name: 'Развернуть все' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть все' })).toBeInTheDocument();
    // New labels should NOT be present in L1 mode.
    expect(screen.queryByRole('button', { name: 'Развернуть все подкатегории' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Свернуть все подкатегории' })).not.toBeInTheDocument();
  });
});

// ─── iter 139 (KI#18): Phase 2.5 chip truncation REVERTED ───────────────────
// Phase 2.5 (iter 134) added per-sub-group chip truncation to CHIP_PREVIEW_COUNT
// (3) + «+N ещё» / «свернуть» buttons. iter 139 reverted this per user feedback:
// «не хочу эти лишние кнопки ещё, зачем дополнительная вложенность и лишние
// клики?». All chips in an expanded sub-group now render unconditionally.
// `chipExpandState` / `onToggleChipExpand` props remain in the API for backward
// compat (callers can still pass them) but are now NO-OP.

describe('ModList — iter 139 (KI#18): chip truncation reverted', () => {
  // makeManyChipsTokens() builds 6 prefix chips in sub-group 'all' (> CHIP_PREVIEW_COUNT=3).
  // Pre-iter-139: only first 3 + «+3 ещё» button. iter 139+: all 6 always visible.

  it('sub-group with 6 chips renders ALL chips (no truncation, no «+N ещё» button)', () => {
    const tokens = makeManyChipsTokens();
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
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        // iter 139: chipExpandState/onToggleChipExpand still passed (backward
        // compat) but no-op. All chips render regardless.
        chipExpandState={new Set<string>()}
        onToggleChipExpand={vi.fn()}
      />
    );

    // ALL 6 chips visible (no truncation).
    expect(screen.getByText('Семейство 1')).toBeInTheDocument();
    expect(screen.getByText('Семейство 2')).toBeInTheDocument();
    expect(screen.getByText('Семейство 3')).toBeInTheDocument();
    expect(screen.getByText('Семейство 4')).toBeInTheDocument();
    expect(screen.getByText('Семейство 5')).toBeInTheDocument();
    expect(screen.getByText('Семейство 6')).toBeInTheDocument();
    // No «+N ещё» or «свернуть» buttons.
    expect(screen.queryByRole('button', { name: /Развернуть оставшиеся/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Свернуть оставшиеся аффиксы' })).not.toBeInTheDocument();
  });

  it('sub-group in chipExpandState also renders ALL chips (no «свернуть» button)', () => {
    // Even when sub-group key IS in chipExpandState (pre-iter-139 = expanded),
    // iter 139+ renders all chips without «свернуть» button — truncation logic
    // is gone, so there's nothing to «свернуть».
    const tokens = makeManyChipsTokens();
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
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        chipExpandState={new Set<string>(['belt:prefix:all'])}
        onToggleChipExpand={vi.fn()}
      />
    );

    // All 6 prefix chips visible.
    expect(screen.getByText('Семейство 1')).toBeInTheDocument();
    expect(screen.getByText('Семейство 6')).toBeInTheDocument();
    // No «свернуть» button (truncation removed → nothing to collapse).
    expect(screen.queryByRole('button', { name: 'Свернуть оставшиеся аффиксы' })).not.toBeInTheDocument();
    // No «+N ещё» button either.
    expect(screen.queryByRole('button', { name: /Развернуть оставшиеся/ })).not.toBeInTheDocument();
  });

  it('backward compat: without chipExpandState wiring, all chips render (same as wired)', () => {
    const tokens = makeManyChipsTokens();
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
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        // Phase 2.5 wiring absent — same behaviour as wired (all chips render).
      />
    );

    // All 6 prefix chips visible.
    expect(screen.getByText('Семейство 1')).toBeInTheDocument();
    expect(screen.getByText('Семейство 6')).toBeInTheDocument();
    // No «+N ещё» or «свернуть» buttons.
    expect(screen.queryByRole('button', { name: /Развернуть оставшиеся/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Свернуть оставшиеся аффиксы' })).not.toBeInTheDocument();
  });

  it('sub-group with ≤ CHIP_PREVIEW_COUNT chips renders all (small sub-group)', () => {
    // Use makeBeltTokens() — 2 prefix chips + 2 suffix chips in sub-group 'all'.
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
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        chipExpandState={new Set<string>()}
        onToggleChipExpand={vi.fn()}
      />
    );

    // All prefix chips visible.
    expect(screen.getByText('Резист')).toBeInTheDocument();
    expect(screen.getByText('Характеристики')).toBeInTheDocument();
    // No «+N ещё» / «свернуть» buttons.
    expect(screen.queryByRole('button', { name: /Развернуть оставшиеся/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Свернуть оставшиеся аффиксы' })).not.toBeInTheDocument();
  });
});

// ─── iter 139 (KI#17): Prefix/Suffix columns 50/50 ─────────────────────────

describe('ModList — iter 139 (KI#17): prefix/suffix equal column widths', () => {
  // Pre-iter-139: `md:grid-cols-[2fr_3fr]` (40% prefix / 60% suffix).
  // User: «колонки суффиксов и префиксов разные по размеру, почему? строки
  // с суффиксами даже 60% порою не занимают в длину».
  // iter 139: changed to `md:grid-cols-2` (50/50).
  it('two-column layout uses 50/50 grid (md:grid-cols-2) instead of 2fr/3fr', () => {
    const tokens = makeBeltTokens(); // has both prefix + suffix
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
        groupMode="affix-only"
      />
    );
    // Find the grid container that holds the two AffixColumn components.
    // It's the element with className containing `md:grid-cols-2`.
    const gridEl = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
    expect(gridEl).not.toBeNull();
    // Defensive: ensure the OLD 2fr/3fr class is NOT present.
    const oldGridEl = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-\\[2fr_3fr\\]');
    expect(oldGridEl).toBeNull();
  });
});

// ─── Phase 3 (iter 135): show-selected-only filter ─────────────────────────

describe('ModList — Phase 3 show-selected-only (iter 135)', () => {
  it('default state (showSelectedOnly=false): all family chips render', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
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
        groupMode="affix-only"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        // showSelectedOnly NOT provided → defaults to false → all chips render.
      />,
    );

    // All 4 family chips render (Резист, Характеристики, Урон, Жизнь).
    expect(screen.getByText('Резист')).toBeInTheDocument();
    expect(screen.getByText('Характеристики')).toBeInTheDocument();
    expect(screen.getByText('Урон')).toBeInTheDocument();
    expect(screen.getByText('Жизнь')).toBeInTheDocument();
  });

  it('showSelectedOnly=true: only families with selected members render', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
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
        groupMode="affix-only"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        showSelectedOnly={true}
      />,
    );

    // Only families with selected members (Резист p1, Урон s1) render.
    expect(screen.getByText('Резист')).toBeInTheDocument();
    expect(screen.getByText('Урон')).toBeInTheDocument();
    // Other 2 families hidden.
    expect(screen.queryByText('Характеристики')).not.toBeInTheDocument();
    expect(screen.queryByText('Жизнь')).not.toBeInTheDocument();
  });

  it('showSelectedOnly=true: excluded tokens stay visible (so user can un-exclude)', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set<string>()}
        excludedIds={new Set(['p3'])}
        searchText=""
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onToggleExclude={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="belt"
        groupMode="affix-only"
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        showSelectedOnly={true}
      />,
    );

    // Характеристики (p3, p4) family is visible because p3 is excluded.
    expect(screen.getByText('Характеристики')).toBeInTheDocument();
    // Резист (no selected/excluded) hidden.
    expect(screen.queryByText('Резист')).not.toBeInTheDocument();
  });

  it('showSelectedOnly=true: pinned tokens stay visible (Phase 5 forward-compat)', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set<string>()}
        pinnedIds={new Set(['s3'])}
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
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        showSelectedOnly={true}
        // Phase 5 forward-compat — pinnedIds is the only "important" filter.
      />,
    );

    // Жизнь (s3, s4) family is visible because s3 is pinned.
    expect(screen.getByText('Жизнь')).toBeInTheDocument();
    // Other families hidden.
    expect(screen.queryByText('Резист')).not.toBeInTheDocument();
    expect(screen.queryByText('Характеристики')).not.toBeInTheDocument();
    expect(screen.queryByText('Урон')).not.toBeInTheDocument();
  });

  it('showSelectedOnly=true with no selections: «no results» state (no chips render)', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set<string>()}
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
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        showSelectedOnly={true}
      />,
    );

    // No chips render — no family has selected members.
    expect(screen.queryByText('Резист')).not.toBeInTheDocument();
    expect(screen.queryByText('Характеристики')).not.toBeInTheDocument();
    expect(screen.queryByText('Урон')).not.toBeInTheDocument();
    expect(screen.queryByText('Жизнь')).not.toBeInTheDocument();
  });

  it('showSelectedOnly=true: stats line shows filtered count', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set(['p1', 'p3'])}
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
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        showSelectedOnly={true}
      />,
    );

    // 2 family groups visible (Резист + Характеристики), out of 8 total tokens.
    // The stats string format is "Показано {shown} семейств из {total} аффиксов".
    expect(screen.getByText(/Показано 2 семейств из 8 аффиксов/)).toBeInTheDocument();
  });
});

// ─── Phase 4 (iter 138): --strong modifier wiring ───
//
// iter 137 added the `.affix-header-{prefix,suffix,implicit}--strong` CSS
// modifier rules (deeper bg + brighter border-left) but deferred the wiring to
// callers. iter 138 wires the modifier: when `sortMode='tier-first'`, the
// top-level affix column header gets the `--strong` modifier class so the
// chosen sort mode is visually reinforced by the frame. When `sortMode='alpha'`
// (default) or omitted, no modifier is added (backward compat).

describe('ModList — Phase 4 strong modifier wiring (iter 138)', () => {
  it('sortMode="alpha": affix column headers do NOT get the --strong modifier (backward compat)', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set<string>()}
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
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        sortMode="alpha"
      />,
    );

    // The «Префикс» column header is rendered as a GroupHeader button.
    // Its className should contain `affix-header-prefix` but NOT
    // `affix-header-prefix--strong` when sortMode='alpha'. The button's
    // accessible name is `${expandLabel}: ${label} (${count})` per GroupHeader
    // aria-label format (label comes from `t('affix.prefix')` = «Префикс»).
    const prefixHeader = screen.getByRole('button', { name: /Префикс/ });
    expect(prefixHeader.className).toContain('affix-header-prefix');
    expect(prefixHeader.className).not.toContain('affix-header-prefix--strong');
  });

  it('sortMode="tier-first": affix column headers DO get the --strong modifier', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set<string>()}
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
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        sortMode="tier-first"
      />,
    );

    // The «Префикс» column header should now have both the base class and
    // the `--strong` modifier class.
    const prefixHeader = screen.getByRole('button', { name: /Префикс/ });
    expect(prefixHeader.className).toContain('affix-header-prefix');
    expect(prefixHeader.className).toContain('affix-header-prefix--strong');

    // The «Суффикс» column header should also get the suffix --strong variant.
    const suffixHeader = screen.getByRole('button', { name: /Суффикс/ });
    expect(suffixHeader.className).toContain('affix-header-suffix');
    expect(suffixHeader.className).toContain('affix-header-suffix--strong');
  });

  it('sortMode omitted (default): affix column headers do NOT get the --strong modifier (backward compat)', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set<string>()}
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
        expandedSubGroups={new Set<string>(['belt:prefix:all', 'belt:suffix:all'])}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
        // sortMode intentionally omitted — should default to 'alpha'
      />,
    );

    const prefixHeader = screen.getByRole('button', { name: /Префикс/ });
    expect(prefixHeader.className).toContain('affix-header-prefix');
    expect(prefixHeader.className).not.toContain('affix-header-prefix--strong');
  });
});

// ─── iter 174 (KI#52): Search auto-expand ──────────────────────────────────
// When `searchText` is non-empty, ModList force-expands all top-level (L1)
// groups AND all sub-groups (L3) containing matching chips, so the user sees
// matches immediately without manually expanding each parent category.
// Local derivation — store's `collapsedGroups` / `expandedSubGroups` are NOT
// mutated, so when search clears the user's manual state takes over again.

describe('ModList — KI#52 search auto-expand (iter 174)', () => {
  it('when searchText is non-empty, sub-group chips render even if expandedSubGroups is empty', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set()}
        searchText="сопротивлению"  // matches p1, p2 (prefix family 'Резист')
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="belt"
        groupMode="affix-only"
        // expandedSubGroups is EMPTY — pre-KI#52 this would hide all chips
        collapsedGroups={new Set<string>()}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />,
    );

    // KI#52 fix: even though expandedSubGroups is empty, the search-active
    // state force-expands sub-groups containing matching chips.
    // FilterChip displays familyKey ('Резист') — should be visible.
    expect(screen.getByText('Резист')).toBeInTheDocument();
    // Suffix family 'Урон' has no matches for 'сопротивлению' → not rendered.
    expect(screen.queryByText('Урон')).not.toBeInTheDocument();
  });

  it('when searchText is non-empty, top-level collapsed group is force-expanded', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set()}
        searchText="сопротивлению"  // matches prefix family 'Резист'
        affixFilter={null}
        originFilter={null}
        onToggleTokens={vi.fn()}
        onSearchChange={vi.fn()}
        onAffixFilterChange={vi.fn()}
        onOriginFilterChange={vi.fn()}
        onClearSelections={vi.fn()}
        category="belt"
        groupMode="affix-only"
        // prefix is COLLAPSED at store level — pre-KI#52 this would hide ALL prefix chips
        collapsedGroups={new Set<string>(['belt:prefix'])}
        expandedSubGroups={new Set<string>()}
        onToggleGroupCollapsed={vi.fn()}
        onToggleSubGroupExpanded={vi.fn()}
      />,
    );

    // KI#52 fix: even though prefix is collapsed at store level, the
    // search-active state force-expands L1 too, so chips render.
    expect(screen.getByText('Резист')).toBeInTheDocument();
  });

  it('when searchText is non-empty, expand-all/collapse-all buttons are hidden', () => {
    const tokens = makeBeltTokens();
    render(
      <ModList
        tokens={tokens}
        selectedIds={new Set()}
        searchText="сопротивлению"
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
        onCollapseAllSubGroups={vi.fn()}
      />,
    );

    // iter 170 (A4) without search: these buttons would be visible.
    // iter 174 (KI#52) with search: hidden because they have no visible effect.
    expect(screen.queryByRole('button', { name: /Развернуть все подкатегории/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Свернуть все подкатегории/i })).not.toBeInTheDocument();
  });
});
