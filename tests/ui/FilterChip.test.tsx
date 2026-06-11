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
});
