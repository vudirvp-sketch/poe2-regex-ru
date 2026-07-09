// @vitest-environment jsdom
/**
 * React component tests for FilterChip.
 *
 * Tests:
 * - Selection states: none, full, partial, excluded, partial-excluded
 * - Click toggles tokens
 * - Exclude button toggles exclude
 * - ARIA attributes: role="switch", aria-checked
 * - Badge display: tier count, 2x badge, range text
 * - Collapsed optimizer indicator
 * - Per-chip range inputs (when selected + has ranges)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChip } from '@ui/components/FilterChip';
import type { FamilyGroup, GameToken } from '@shared/types';

// ─── Test fixtures ───

function makeToken(id: string, opts: Partial<GameToken> = {}): GameToken {
  return {
    id,
    category: 'ring',
    origin: 'normal',
    rawText: { ru: `Текст мода ${id}` },
    rawTextTemplate: { ru: '## текст' },
    regex: { ru: `текст.*${id}` },
    familyKey: { ru: 'семейство тест' },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
    genderForms: { ru: {} },
    affix: 'suffix',
    tags: [],
    ranges: [[10, 30]],
    values: [],
    hasYofication: false,
    yoficationPositions: [],
    level: 1,
    ...opts,
  };
}

function makeGroup(opts: Partial<FamilyGroup> = {}): FamilyGroup {
  const members = [
    makeToken('t1', { ranges: [[10, 30]] }),
    makeToken('t2', { ranges: [[15, 35]] }),
  ];
  return {
    familyKey: 'семейство тест',
    affix: 'suffix',
    members,
    globalMin: 10,
    globalMax: 35,
    displayText: 'тестовый мод',
    hasMultiPlaceholder: false,
    rangeSlots: [[10, 35]],
    filterSlotIndex: 0,
    priorityTier: 'B',
    ...opts,
  };
}

describe('FilterChip', () => {
  // ─── Selection states ───

  it('renders display text', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
      />
    );

    expect(screen.getByText('тестовый мод')).toBeInTheDocument();
  });

  it('shows "none" state when no tokens selected', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
      />
    );

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'false');
  });

  it('shows "full" state when all tokens selected', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set(['t1', 't2'])}
        onToggleTokens={vi.fn()}
      />
    );

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'true');
  });

  it('shows "partial" state when some tokens selected', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set(['t1'])}
        onToggleTokens={vi.fn()}
      />
    );

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'mixed');
  });

  it('shows "excluded" state when all tokens excluded', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        excludedIds={new Set(['t1', 't2'])}
        onToggleTokens={vi.fn()}
        onToggleExclude={vi.fn()}
      />
    );

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'true');
  });

  it('shows "partial-excluded" state when some tokens excluded', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        excludedIds={new Set(['t1'])}
        onToggleTokens={vi.fn()}
        onToggleExclude={vi.fn()}
      />
    );

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'mixed');
  });

  // ─── Click toggles ───

  it('calls onToggleTokens with member IDs on click', () => {
    const group = makeGroup();
    const onToggle = vi.fn();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={onToggle}
      />
    );

    const switchEl = screen.getByRole('switch');
    fireEvent.click(switchEl);

    expect(onToggle).toHaveBeenCalledWith(['t1', 't2']);
  });

  it('calls onToggleExclude when exclude button clicked', () => {
    const group = makeGroup();
    const onToggleExclude = vi.fn();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
        onToggleExclude={onToggleExclude}
      />
    );

    const excludeButton = screen.getByRole('button', { name: /исключить/i });
    fireEvent.click(excludeButton);

    expect(onToggleExclude).toHaveBeenCalledWith(['t1', 't2']);
  });

  it('exclude button shows ✓ when excluded', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        excludedIds={new Set(['t1', 't2'])}
        onToggleTokens={vi.fn()}
        onToggleExclude={vi.fn()}
      />
    );

    // When excluded, button shows ✓ and has "убрать из исключения" label
    const unexcludeBtn = screen.getByRole('button', { name: /убрать/i });
    expect(unexcludeBtn).toHaveTextContent('✓');
  });

  // ─── Tier count badge ───

  it('shows tier count badge when group has >1 member', () => {
    const group = makeGroup(); // 2 members
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
      />
    );

    // ×2 badge for 2 tier levels
    expect(screen.getByText('×2')).toBeInTheDocument();
  });

  it('does NOT show tier count badge when group has 1 member', () => {
    const singleGroup = makeGroup({
      members: [makeToken('t1')],
    });
    render(
      <FilterChip
        group={singleGroup}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
      />
    );

    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  // ─── 2x badge for multi-placeholder ───

  it('shows 2x badge for multi-placeholder groups', () => {
    const group = makeGroup({ hasMultiPlaceholder: true });
    render(
      <FilterChip
        group={group}
        selectedIds={new Set(['t1', 't2'])}
        onToggleTokens={vi.fn()}
      />
    );

    expect(screen.getByText('2x')).toBeInTheDocument();
  });

  // ─── Range text ───

  it('shows range text when unselected', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
      />
    );

    // Range text shown as (10—35) when unselected
    expect(screen.getByText(/10—35/)).toBeInTheDocument();
  });

  // ─── Keyboard interaction ───

  it('toggles on Enter key', () => {
    const group = makeGroup();
    const onToggle = vi.fn();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={onToggle}
      />
    );

    const switchEl = screen.getByRole('switch');
    fireEvent.keyDown(switchEl, { key: 'Enter' });

    expect(onToggle).toHaveBeenCalledWith(['t1', 't2']);
  });

  it('toggles on Space key', () => {
    const group = makeGroup();
    const onToggle = vi.fn();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={onToggle}
      />
    );

    const switchEl = screen.getByRole('switch');
    fireEvent.keyDown(switchEl, { key: ' ' });

    expect(onToggle).toHaveBeenCalledWith(['t1', 't2']);
  });

  // ─── Optimizer collapsed indicator ───

  it('shows ⚡ indicator when token is in collapsedTokenIds and selected', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set(['t1', 't2'])}
        onToggleTokens={vi.fn()}
        collapsedTokenIds={new Set(['t1'])}
      />
    );

    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  it('does NOT show ⚡ when token is collapsed but chip is not selected', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
        collapsedTokenIds={new Set(['t1'])}
      />
    );

    expect(screen.queryByText('⚡')).not.toBeInTheDocument();
  });

  // ─── No exclude button when onToggleExclude not provided ───

  it('hides exclude button when onToggleExclude is not provided', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /исключить/i })).not.toBeInTheDocument();
  });

  // ─── Prefix indicator ───

  it('shows ⚓ anchor indicator when prefix is set and chip is selected', () => {
    const group = makeGroup({
      members: [makeToken('t1', { regexPrefix: { ru: 'От' } }), makeToken('t2', { regexPrefix: { ru: 'От' } })],
    });
    render(
      <FilterChip
        group={group}
        selectedIds={new Set(['t1', 't2'])}
        onToggleTokens={vi.fn()}
      />
    );

    expect(screen.getByText('⚓')).toBeInTheDocument();
  });

  it('does NOT show ⚓ when chip is not selected', () => {
    const group = makeGroup({
      members: [makeToken('t1', { regexPrefix: { ru: 'От' } }), makeToken('t2', { regexPrefix: { ru: 'От' } })],
    });
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
      />
    );

    expect(screen.queryByText('⚓')).not.toBeInTheDocument();
  });

  // ─── ARIA label ───

  it('has ARIA label with state and tier info', () => {
    const group = makeGroup();
    render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
      />
    );

    const switchEl = screen.getByRole('switch');
    const ariaLabel = switchEl.getAttribute('aria-label');
    expect(ariaLabel).toContain('тестовый мод');
    expect(ariaLabel).toContain('не выбрано');
  });

  // ─── iter 107: tier-aware left border (sortMode prop) ───

  /**
   * Helper: render a chip and return the outer container div className.
   * The tier-aware border class lives on the outer container (along with
   * border-l-2, padding, selection bg, etc.).
   */
  function renderChipAndGetClass(opts: {
    priorityTier?: 'S' | 'A' | 'B' | 'C';
    affix?: 'prefix' | 'suffix' | 'implicit';
    sortMode?: 'alpha' | 'tier-first';
  }): string {
    const group = makeGroup({
      priorityTier: opts.priorityTier ?? 'B',
      affix: opts.affix ?? 'suffix',
    });
    const { container } = render(
      <FilterChip
        group={group}
        selectedIds={new Set()}
        onToggleTokens={vi.fn()}
        sortMode={opts.sortMode}
      />
    );
    // The outer container is the first child div of the rendered output.
    const outerDiv = container.firstChild as HTMLElement;
    return outerDiv.className;
  }

  describe('tier-aware left border (iter 107)', () => {
    // ── alpha mode (default — backward compat) ──

    it('alpha mode + S-tier → amber-soft border (always-on indicator)', () => {
      const className = renderChipAndGetClass({ priorityTier: 'S', sortMode: 'alpha' });
      expect(className).toContain('border-l-bl-amber-soft');
    });

    it('alpha mode + A-tier → affix color (suffix → orange)', () => {
      const className = renderChipAndGetClass({
        priorityTier: 'A', affix: 'suffix', sortMode: 'alpha',
      });
      expect(className).toContain('border-l-bl-orange');
      expect(className).not.toContain('border-l-bl-amber-soft');
    });

    it('alpha mode + B-tier → affix color (prefix → blue)', () => {
      const className = renderChipAndGetClass({
        priorityTier: 'B', affix: 'prefix', sortMode: 'alpha',
      });
      expect(className).toContain('border-l-bl-blue');
      expect(className).not.toContain('border-l-bl-amber-soft');
    });

    it('alpha mode + C-tier → affix color (implicit → amber)', () => {
      const className = renderChipAndGetClass({
        priorityTier: 'C', affix: 'implicit', sortMode: 'alpha',
      });
      expect(className).toContain('border-l-bl-amber');
      expect(className).not.toContain('border-l-bl-amber-soft');
    });

    it('omitted sortMode = alpha mode (backward compat: A-tier keeps affix color)', () => {
      const className = renderChipAndGetClass({
        priorityTier: 'A', affix: 'suffix',
      });
      expect(className).toContain('border-l-bl-orange');
      expect(className).not.toContain('border-l-bl-amber-soft');
    });

    // ── tier-first mode ──

    it('tier-first mode + S-tier → amber-soft border (brightest)', () => {
      const className = renderChipAndGetClass({
        priorityTier: 'S', affix: 'suffix', sortMode: 'tier-first',
      });
      expect(className).toContain('border-l-bl-amber-soft');
      // affix color is suppressed in tier-first mode
      expect(className).not.toContain('border-l-bl-orange');
    });

    it('tier-first mode + A-tier → amber border (medium)', () => {
      const className = renderChipAndGetClass({
        priorityTier: 'A', affix: 'suffix', sortMode: 'tier-first',
      });
      // A-tier = 'border-l-bl-amber' (amber-500, NOT amber-soft which is amber-400)
      expect(className).toMatch(/border-l-bl-amber(?!-)/);
      expect(className).not.toContain('border-l-bl-amber-soft');
      expect(className).not.toContain('border-l-bl-orange');
    });

    it('tier-first mode + B-tier → amber-dim border (bronze)', () => {
      const className = renderChipAndGetClass({
        priorityTier: 'B', affix: 'prefix', sortMode: 'tier-first',
      });
      expect(className).toContain('border-l-bl-amber-dim');
      expect(className).not.toContain('border-l-bl-blue');
    });

    it('tier-first mode + C-tier → gray border (neutral, low priority)', () => {
      const className = renderChipAndGetClass({
        priorityTier: 'C', affix: 'implicit', sortMode: 'tier-first',
      });
      expect(className).toContain('border-l-bl-gray');
      // implicit default (amber) is suppressed in tier-first mode
      expect(className).not.toMatch(/border-l-bl-amber(?!-)/);
    });

    // ── Visual hierarchy regression ──

    it('tier-first mode produces 4 distinct border classes across S/A/B/C', () => {
      const s = renderChipAndGetClass({ priorityTier: 'S', sortMode: 'tier-first' });
      const a = renderChipAndGetClass({ priorityTier: 'A', sortMode: 'tier-first' });
      const b = renderChipAndGetClass({ priorityTier: 'B', sortMode: 'tier-first' });
      const c = renderChipAndGetClass({ priorityTier: 'C', sortMode: 'tier-first' });

      // All 4 must be distinct — visual scan must differentiate tiers.
      const set = new Set([s, a, b, c]);
      expect(set.size).toBe(4);

      // Spot-check: each tier has its specific border class.
      expect(s).toContain('border-l-bl-amber-soft');
      expect(a).toMatch(/border-l-bl-amber(?!-)/);
      expect(b).toContain('border-l-bl-amber-dim');
      expect(c).toContain('border-l-bl-gray');
    });

    it('tier-first mode suppresses affix color regardless of affix type', () => {
      // Same tier across all three affix types should produce the same tier
      // border class (no affix color leaking through).
      const prefixClass = renderChipAndGetClass({
        priorityTier: 'A', affix: 'prefix', sortMode: 'tier-first',
      });
      const suffixClass = renderChipAndGetClass({
        priorityTier: 'A', affix: 'suffix', sortMode: 'tier-first',
      });
      const implicitClass = renderChipAndGetClass({
        priorityTier: 'A', affix: 'implicit', sortMode: 'tier-first',
      });

      // All three should have the same tier border (amber).
      for (const cls of [prefixClass, suffixClass, implicitClass]) {
        expect(cls).toMatch(/border-l-bl-amber(?!-)/);
        // No affix color should leak through.
        expect(cls).not.toContain('border-l-bl-blue');
        expect(cls).not.toContain('border-l-bl-orange');
      }
    });
  });

  // ─── Phase 5 (iter 136): ⭐ pin/unpin icon button ───

  describe('Phase 5 — ⭐ pin/unpin icon button', () => {
    it('does NOT render ⭐ button when pinnedIds prop is omitted (backward compat)', () => {
      const group = makeGroup();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          onTogglePinned={vi.fn()}  // provided but pinnedIds is NOT.
        />,
      );
      // No ⭐ button (★ or ☆).
      expect(screen.queryByText('★')).not.toBeInTheDocument();
      expect(screen.queryByText('☆')).not.toBeInTheDocument();
    });

    it('does NOT render ⭐ button when onTogglePinned prop is omitted (backward compat)', () => {
      const group = makeGroup();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          pinnedIds={new Set()}  // provided but onTogglePinned is NOT.
        />,
      );
      expect(screen.queryByText('★')).not.toBeInTheDocument();
      expect(screen.queryByText('☆')).not.toBeInTheDocument();
    });

    it('renders ☆ (outline) when family is NOT pinned', () => {
      const group = makeGroup();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          pinnedIds={new Set()}  // empty set → not pinned.
          onTogglePinned={vi.fn()}
        />,
      );
      // ☆ (outline star) is rendered.
      expect(screen.getByText('☆')).toBeInTheDocument();
      // ★ (filled star) is NOT rendered.
      expect(screen.queryByText('★')).not.toBeInTheDocument();
    });

    it('renders ★ (filled) when ANY member of the family is pinned', () => {
      const group = makeGroup();  // 2 members: t1, t2.
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          pinnedIds={new Set(['t1'])}  // only t1 is pinned.
          onTogglePinned={vi.fn()}
        />,
      );
      // ★ (filled star) is rendered.
      expect(screen.getByText('★')).toBeInTheDocument();
      // ☆ (outline star) is NOT rendered.
      expect(screen.queryByText('☆')).not.toBeInTheDocument();
    });

    it('calls onTogglePinned with member IDs when ⭐ clicked', () => {
      const group = makeGroup();  // 2 members: t1, t2.
      const onTogglePinned = vi.fn();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          pinnedIds={new Set()}
          onTogglePinned={onTogglePinned}
        />,
      );

      const pinButton = screen.getByRole('button', { name: /Добавить семейство в избранное/ });
      fireEvent.click(pinButton);

      expect(onTogglePinned).toHaveBeenCalledTimes(1);
      // Should be called with all member IDs of the family group.
      const callArgs = onTogglePinned.mock.calls[0][0];
      expect(callArgs).toEqual(expect.arrayContaining(['t1', 't2']));
      expect(callArgs.length).toBe(2);
    });

    it('does NOT call onToggleTokens when ⭐ clicked (stopPropagation)', () => {
      const group = makeGroup();
      const onToggleTokens = vi.fn();
      const onTogglePinned = vi.fn();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={onToggleTokens}
          pinnedIds={new Set()}
          onTogglePinned={onTogglePinned}
        />,
      );

      const pinButton = screen.getByRole('button', { name: /Добавить семейство в избранное/ });
      fireEvent.click(pinButton);

      // Pin toggle was called.
      expect(onTogglePinned).toHaveBeenCalledTimes(1);
      // Selection toggle was NOT called (stopPropagation prevented bubbling).
      expect(onToggleTokens).not.toHaveBeenCalled();
    });

    it('aria-pressed reflects pinned state', () => {
      const group = makeGroup();
      const { rerender } = render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          pinnedIds={new Set()}
          onTogglePinned={vi.fn()}
        />,
      );

      // Not pinned → aria-pressed=false.
      let pinButton = screen.getByRole('button', { name: /Добавить семейство в избранное/ });
      expect(pinButton.getAttribute('aria-pressed')).toBe('false');

      // Re-render with pinned state.
      rerender(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          pinnedIds={new Set(['t1', 't2'])}
          onTogglePinned={vi.fn()}
        />,
      );

      // Pinned → aria-pressed=true.
      pinButton = screen.getByRole('button', { name: /Убрать семейство из избранного/ });
      expect(pinButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('renders data-family-key attribute on the wrapping div', () => {
      const group = makeGroup({ familyKey: 'семейство тест' });
      const { container } = render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          pinnedIds={new Set()}
          onTogglePinned={vi.fn()}
        />,
      );

      // The wrapping div has data-family-key attribute.
      const chipWrapper = container.firstChild as HTMLElement;
      expect(chipWrapper.getAttribute('data-family-key')).toBe('семейство тест');
    });
  });

  // ─── iter 159: MIXED-mode 3-state chip (want / opt / exclude) ──────────────

  describe('iter 159 — MIXED-mode 3-state chip', () => {
    it('does NOT enter OPT state when mixedMode is false (backward compat)', () => {
      // Even if optionalIds has members, mixedMode=false means the chip
      // should ignore them and behave as a 2-state chip (pre-iter-159).
      const group = makeGroup();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          optionalIds={new Set(['t1', 't2'])}
          onToggleTokens={vi.fn()}
          onToggleOptional={vi.fn()}
          // mixedMode defaults to false
        />,
      );

      // aria-checked should be 'false' (not in OPT state).
      const switchEl = screen.getByRole('switch');
      expect(switchEl).toHaveAttribute('aria-checked', 'false');
    });

    it('enters full-optional state when mixedMode is true and all members are optional', () => {
      const group = makeGroup(); // 2 members: t1, t2
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          optionalIds={new Set(['t1', 't2'])}
          onToggleTokens={vi.fn()}
          onToggleOptional={vi.fn()}
          mixedMode
        />,
      );

      const switchEl = screen.getByRole('switch');
      // OPT (full) state → aria-checked='true' (treated as "active")
      expect(switchEl).toHaveAttribute('aria-checked', 'true');
      // ARIA label should mention "опционально"
      expect(switchEl.getAttribute('aria-label')).toContain('опционально');
    });

    it('enters partial-optional state when mixedMode is true and some members are optional', () => {
      const group = makeGroup(); // 2 members: t1, t2
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          optionalIds={new Set(['t1'])}
          onToggleTokens={vi.fn()}
          onToggleOptional={vi.fn()}
          mixedMode
        />,
      );

      const switchEl = screen.getByRole('switch');
      // OPT (partial) state → aria-checked='mixed'
      expect(switchEl).toHaveAttribute('aria-checked', 'mixed');
    });

    it('shift+click calls onToggleOptional (not onToggleTokens)', () => {
      const group = makeGroup();
      const onToggleTokens = vi.fn();
      const onToggleOptional = vi.fn();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={onToggleTokens}
          onToggleOptional={onToggleOptional}
          mixedMode
        />,
      );

      const switchEl = screen.getByRole('switch');
      fireEvent.click(switchEl, { shiftKey: true });

      expect(onToggleOptional).toHaveBeenCalledWith(['t1', 't2']);
      expect(onToggleTokens).not.toHaveBeenCalled();
    });

    it('plain click still calls onToggleTokens when mixedMode is true', () => {
      const group = makeGroup();
      const onToggleTokens = vi.fn();
      const onToggleOptional = vi.fn();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={onToggleTokens}
          onToggleOptional={onToggleOptional}
          mixedMode
        />,
      );

      const switchEl = screen.getByRole('switch');
      fireEvent.click(switchEl); // no shiftKey

      expect(onToggleTokens).toHaveBeenCalledWith(['t1', 't2']);
      expect(onToggleOptional).not.toHaveBeenCalled();
    });

    it('shift+click is a no-op when mixedMode is false (backward compat)', () => {
      const group = makeGroup();
      const onToggleTokens = vi.fn();
      const onToggleOptional = vi.fn();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={onToggleTokens}
          onToggleOptional={onToggleOptional}
          // mixedMode defaults to false
        />,
      );

      const switchEl = screen.getByRole('switch');
      fireEvent.click(switchEl, { shiftKey: true });

      // Without mixedMode, shift+click should fall through to plain click.
      expect(onToggleTokens).toHaveBeenCalledWith(['t1', 't2']);
      expect(onToggleOptional).not.toHaveBeenCalled();
    });

    it('right-click calls onToggleExclude when mixedMode is true', () => {
      const group = makeGroup();
      const onToggleExclude = vi.fn();
      const { container } = render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          onToggleExclude={onToggleExclude}
          mixedMode
        />,
      );

      const chipWrapper = container.firstChild as HTMLElement;
      fireEvent.contextMenu(chipWrapper);

      expect(onToggleExclude).toHaveBeenCalledWith(['t1', 't2']);
    });

    it('right-click does NOT call onToggleExclude when mixedMode is false (browser context menu)', () => {
      const group = makeGroup();
      const onToggleExclude = vi.fn();
      const { container } = render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          onToggleExclude={onToggleExclude}
          // mixedMode defaults to false
        />,
      );

      const chipWrapper = container.firstChild as HTMLElement;
      fireEvent.contextMenu(chipWrapper);

      // Without mixedMode, right-click should NOT trigger exclude.
      expect(onToggleExclude).not.toHaveBeenCalled();
    });

    it('shift+Enter calls onToggleOptional (keyboard parity with shift+click)', () => {
      const group = makeGroup();
      const onToggleTokens = vi.fn();
      const onToggleOptional = vi.fn();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={onToggleTokens}
          onToggleOptional={onToggleOptional}
          mixedMode
        />,
      );

      const switchEl = screen.getByRole('switch');
      fireEvent.keyDown(switchEl, { key: 'Enter', shiftKey: true });

      expect(onToggleOptional).toHaveBeenCalledWith(['t1', 't2']);
      expect(onToggleTokens).not.toHaveBeenCalled();
    });

    // ─── iter 181 (KI#56): Ctrl+click alternative + visible ⊕ OPT button ───

    it('iter 181 (KI#56): ctrl+click calls onToggleOptional when mixedMode is true', () => {
      // Ctrl+click is an alternative to shift+click that doesn't trigger
      // browser text selection. Same semantic — toggles OPT state.
      const group = makeGroup();
      const onToggleTokens = vi.fn();
      const onToggleOptional = vi.fn();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={onToggleTokens}
          onToggleOptional={onToggleOptional}
          mixedMode
        />,
      );

      const switchEl = screen.getByRole('switch');
      fireEvent.click(switchEl, { ctrlKey: true });

      expect(onToggleOptional).toHaveBeenCalledWith(['t1', 't2']);
      expect(onToggleTokens).not.toHaveBeenCalled();
    });

    it('iter 181 (KI#56): ctrl+Enter calls onToggleOptional (keyboard parity)', () => {
      const group = makeGroup();
      const onToggleTokens = vi.fn();
      const onToggleOptional = vi.fn();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={onToggleTokens}
          onToggleOptional={onToggleOptional}
          mixedMode
        />,
      );

      const switchEl = screen.getByRole('switch');
      fireEvent.keyDown(switchEl, { key: 'Enter', ctrlKey: true });

      expect(onToggleOptional).toHaveBeenCalledWith(['t1', 't2']);
      expect(onToggleTokens).not.toHaveBeenCalled();
    });

    it('iter 181 (KI#56): renders visible ⊕ OPT button when mixedMode + onToggleOptional', () => {
      // The ⊕ button is the mobile-friendly alternative to shift/ctrl+click.
      // Should render ONLY when mixedMode=true AND onToggleOptional is wired.
      const group = makeGroup();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          onToggleOptional={vi.fn()}
          mixedMode
        />,
      );

      const optButton = screen.getByRole('button', { name: /сделать семейство опциональным/i });
      expect(optButton).toHaveTextContent('⊕');
    });

    it('iter 181 (KI#56): does NOT render ⊕ OPT button when mixedMode is false', () => {
      // Backward compat: non-MIXED-mode callers should not see the new button.
      const group = makeGroup();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          onToggleOptional={vi.fn()}
          // mixedMode defaults to false
        />,
      );

      expect(screen.queryByRole('button', { name: /опциональн/i })).not.toBeInTheDocument();
    });

    it('iter 181 (KI#56): clicking ⊕ button calls onToggleOptional', () => {
      const group = makeGroup();
      const onToggleTokens = vi.fn();
      const onToggleOptional = vi.fn();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          onToggleTokens={onToggleTokens}
          onToggleOptional={onToggleOptional}
          mixedMode
        />,
      );

      const optButton = screen.getByRole('button', { name: /сделать семейство опциональным/i });
      fireEvent.click(optButton);

      expect(onToggleOptional).toHaveBeenCalledWith(['t1', 't2']);
      // Clicking ⊕ should NOT also trigger the chip's main onClick (would
      // toggle WANT) — stopPropagation in handleOptClick prevents that.
      expect(onToggleTokens).not.toHaveBeenCalled();
    });

    it('iter 181 (KI#56): ⊕ button shows ⊖ and "убрать" aria-label when chip is optional', () => {
      const group = makeGroup();
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          optionalIds={new Set(['t1', 't2'])}
          onToggleTokens={vi.fn()}
          onToggleOptional={vi.fn()}
          mixedMode
        />,
      );

      // When chip is in OPT state, the button shows ⊖ (remove from opt) and
      // has the "убрать" aria-label.
      const unoptButton = screen.getByRole('button', { name: /убрать семейство из опциональных/i });
      expect(unoptButton).toHaveTextContent('⊖');
    });

    it('OPT state shows range inputs when chip has ranges (isSelectedForRanges)', () => {
      const group = makeGroup(); // has rangeSlots: [[10, 35]]
      render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          optionalIds={new Set(['t1', 't2'])}
          onToggleTokens={vi.fn()}
          onToggleOptional={vi.fn()}
          onSetTokenRange={vi.fn()}
          mixedMode
        />,
      );

      // Range inputs should render because OPT chips also support per-token
      // range overrides (just like WANT chips).
      const minInput = screen.getByLabelText('Минимальное значение');
      const maxInput = screen.getByLabelText('Максимальное значение');
      expect(minInput).toBeInTheDocument();
      expect(maxInput).toBeInTheDocument();
    });

    // iter 163 (T9 regression): Toggle MIXED → AND → MIXED must preserve
    // optionalIds. The store-level guarantee is that `optionalIds` lives in
    // filter-store (Zustand) and is NOT cleared by `setSearchLogic` (which
    // is local React state in useCategoryPage). The FilterChip-level guarantee
    // is that `effectiveOptional = mixedMode ? optionalIds : empty` — so when
    // mixedMode flips back to true, the OPT state re-appears using the SAME
    // optionalIds. This test verifies the FilterChip side of that contract.
    it('iter 163 (T9): toggling mixedMode off then on preserves OPT state', () => {
      const group = makeGroup(); // 2 members: t1, t2
      const optionalIds = new Set(['t1', 't2']);
      const onToggleOptional = vi.fn();

      // Step 1: MIXED mode + optionalIds populated → chip shows OPT state.
      const { rerender } = render(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          optionalIds={optionalIds}
          onToggleTokens={vi.fn()}
          onToggleOptional={onToggleOptional}
          mixedMode
        />,
      );
      let switchEl = screen.getByRole('switch');
      expect(switchEl).toHaveAttribute('aria-checked', 'true');
      expect(switchEl.getAttribute('aria-label')).toContain('опционально');

      // Step 2: Switch to AND mode (mixedMode=false). The SAME optionalIds is
      // still passed — but FilterChip should ignore it and show unselected.
      // (This mirrors the user toggling logic mode AND in CategoryControlPanel.)
      rerender(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          optionalIds={optionalIds} // SAME optionalIds — NOT cleared
          onToggleTokens={vi.fn()}
          onToggleOptional={onToggleOptional}
          // mixedMode omitted → defaults to false
        />,
      );
      switchEl = screen.getByRole('switch');
      expect(switchEl).toHaveAttribute('aria-checked', 'false');
      expect(switchEl.getAttribute('aria-label')).not.toContain('опционально');

      // Step 3: Switch back to MIXED mode. OPT state should re-appear using
      // the SAME optionalIds (proving it was preserved, not lost).
      rerender(
        <FilterChip
          group={group}
          selectedIds={new Set()}
          optionalIds={optionalIds} // SAME optionalIds — preserved across toggle
          onToggleTokens={vi.fn()}
          onToggleOptional={onToggleOptional}
          mixedMode
        />,
      );
      switchEl = screen.getByRole('switch');
      expect(switchEl).toHaveAttribute('aria-checked', 'true');
      expect(switchEl.getAttribute('aria-label')).toContain('опционально');
    });
  });

  // ─── Phase 4 (iter 137): compact density ───

  describe('Phase 4 — compact chip density', () => {
    it('outer div has .filter-chip class token', () => {
      const { container } = render(
        <FilterChip
          group={makeGroup()}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
        />,
      );
      const chipWrapper = container.firstChild as HTMLElement;
      expect(chipWrapper.className).toContain('filter-chip');
    });

    it('outer div uses text-[12px] (compact text size)', () => {
      const { container } = render(
        <FilterChip
          group={makeGroup()}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
        />,
      );
      const chipWrapper = container.firstChild as HTMLElement;
      expect(chipWrapper.className).toContain('text-[12px]');
    });

    it('outer div uses px-1.5 py-0.5 (compact padding)', () => {
      const { container } = render(
        <FilterChip
          group={makeGroup()}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
        />,
      );
      const chipWrapper = container.firstChild as HTMLElement;
      expect(chipWrapper.className).toContain('px-1.5');
      expect(chipWrapper.className).toContain('py-0.5');
    });

    it('inline badges use text-[10px] (compact badge size)', () => {
      // Construct a group with multiple members so the ×N badge renders, with
      // a prefix so ⚓ renders, with multi-placeholder so 2x renders, and
      // selected so badges actually appear.
      const group: FamilyGroup = {
        familyKey: 'семейство тест',
        affix: 'prefix',
        displayText: 'Тестовый аффикс',
        members: [
          { id: 'a', rawText: { ru: 'A' }, regex: { ru: 'a' }, regexPrefix: { ru: 'p' }, ranges: [[1, 5]], values: [], hasMultiPlaceholder: false } as unknown as FamilyGroup['members'][number],
          { id: 'b', rawText: { ru: 'B' }, regex: { ru: 'b' }, regexPrefix: { ru: 'p' }, ranges: [[1, 5]], values: [], hasMultiPlaceholder: false } as unknown as FamilyGroup['members'][number],
        ],
        rangeSlots: [[1, 5]],
        globalMin: 1,
        globalMax: 5,
        hasMultiPlaceholder: false,
        priorityTier: 'S',
        origin: 'normal',
      };
      const { container } = render(
        <FilterChip
          group={group}
          selectedIds={new Set(['a', 'b'])}
          onToggleTokens={vi.fn()}
        />,
      );
      // At least one of the inline badges (⚓/×N/range) should use text-[10px].
      const badges = container.querySelectorAll('span.text-\\[10px\\]');
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
