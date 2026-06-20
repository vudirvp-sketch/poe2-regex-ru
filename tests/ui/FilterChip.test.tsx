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
});
