// @vitest-environment jsdom
/**
 * React component tests for CategoryControlPanel (iter 181, KI#55).
 *
 * iter 181 (KI#55): the show-selected-only toggle's enable/counter logic
 * was previously broken — `selectedCount` (wantGroupCount) was the only
 * input, so the toggle stayed disabled even when the user had pinned
 * favorites (⭐) or excluded affixes. The actual filter in
 * `VirtualizedModList.visibleGroups` keeps family groups with at least one
 * selected OR excluded OR pinned member (and optional in MIXED mode), so
 * the toggle's enable/counter must include all 4 sets.
 *
 * Fix: introduced `pinnedCount` prop + compute totalVisibleCount =
 * selected + excluded + optional + pinned. Disable when 0. Counter shows
 * what the user will actually see.
 *
 * Tests:
 *   - Toggle disabled when ALL 4 counts are 0.
 *   - Toggle ENABLED when only pinnedCount > 0 (the bug that KI#55 fixed).
 *   - Toggle ENABLED when only excludedCount > 0.
 *   - Toggle ENABLED when only optionalCount > 0.
 *   - Counter in option label shows totalVisibleCount, not just selectedCount.
 *   - Backward compat: when onSetShowSelectedOnly is NOT provided, the select
 *     is NOT rendered (VendorPage uses a custom FilterChip instead).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryControlPanel } from '@ui/components/CategoryControlPanel';
import type { SearchLogic, SortMode } from '@shared/types';

// ─── Minimal props factory ───
// CategoryControlPanel has many props; this helper fills in the required ones
// with no-op stubs so each test only specifies the props it cares about.

function makeProps(overrides: Partial<React.ComponentProps<typeof CategoryControlPanel>> = {}) {
  return {
    searchLogic: 'and' as SearchLogic,
    setSearchLogic: vi.fn(),
    hasRangedTokens: false,
    minValue: null,
    setMinValue: vi.fn(),
    maxValue: null,
    setMaxValue: vi.fn(),
    rangedSuffixes: [],
    round10Enabled: false,
    setRound10Enabled: vi.fn(),
    thresholdEnabled: false,
    setThresholdEnabled: vi.fn(),
    // Provide a sort mode setter + showSortMode so the sort <select> renders
    // (mirrors real category pages).
    sortMode: 'alpha' as SortMode,
    setSortMode: vi.fn(),
    showSortMode: true,
    ...overrides,
  };
}

describe('CategoryControlPanel — iter 181 (KI#55): show-selected-only toggle', () => {
  it('toggle is DISABLED when all 4 counts are 0', () => {
    render(
      <CategoryControlPanel
        {...makeProps({
          showSelectedOnly: false,
          onSetShowSelectedOnly: vi.fn(),
          selectedCount: 0,
          excludedCount: 0,
          optionalCount: 0,
          pinnedCount: 0,
        })}
      />,
    );

    const select = screen.getByRole('combobox', { name: /показывать/i });
    expect(select).toBeDisabled();
  });

  it('toggle is ENABLED when only pinnedCount > 0 (the KI#55 bug)', () => {
    // Before iter 181: this case disabled the toggle even though clicking it
    // would have shown the user's pinned favorites. Now: enabled.
    render(
      <CategoryControlPanel
        {...makeProps({
          showSelectedOnly: false,
          onSetShowSelectedOnly: vi.fn(),
          selectedCount: 0,
          excludedCount: 0,
          optionalCount: 0,
          pinnedCount: 5,
        })}
      />,
    );

    const select = screen.getByRole('combobox', { name: /показывать/i });
    expect(select).not.toBeDisabled();
  });

  it('toggle is ENABLED when only excludedCount > 0', () => {
    render(
      <CategoryControlPanel
        {...makeProps({
          showSelectedOnly: false,
          onSetShowSelectedOnly: vi.fn(),
          selectedCount: 0,
          excludedCount: 3,
          optionalCount: 0,
          pinnedCount: 0,
        })}
      />,
    );

    const select = screen.getByRole('combobox', { name: /показывать/i });
    expect(select).not.toBeDisabled();
  });

  it('toggle is ENABLED when only optionalCount > 0', () => {
    render(
      <CategoryControlPanel
        {...makeProps({
          showSelectedOnly: false,
          onSetShowSelectedOnly: vi.fn(),
          selectedCount: 0,
          excludedCount: 0,
          optionalCount: 2,
          pinnedCount: 0,
        })}
      />,
    );

    const select = screen.getByRole('combobox', { name: /показывать/i });
    expect(select).not.toBeDisabled();
  });

  it('counter in option label shows totalVisibleCount (selected + excluded + optional + pinned)', () => {
    // selectedCount=2 + excludedCount=1 + optionalCount=3 + pinnedCount=4 = 10
    // Before iter 181: would have shown "Мои (2)" — misleading. Now: "Мои (10)".
    render(
      <CategoryControlPanel
        {...makeProps({
          showSelectedOnly: false,
          onSetShowSelectedOnly: vi.fn(),
          selectedCount: 2,
          excludedCount: 1,
          optionalCount: 3,
          pinnedCount: 4,
        })}
      />,
    );

    // The «Мои (N)» option should reflect the TOTAL, not just selectedCount.
    // The option is inside a <select> — querying by text on the option element
    // works in jsdom. We use a function matcher to avoid issues with
    // whitespace.
    const option = screen.getByRole('option', { name: /Мои/i });
    expect(option).toHaveTextContent('Мои (10)');
  });

  it('toggle is NOT rendered when onSetShowSelectedOnly is not provided (backward compat)', () => {
    // VendorPage uses a custom FilterChip instead of the standard toggle.
    // CategoryControlPanel should NOT render the <select> in that case.
    render(
      <CategoryControlPanel
        {...makeProps({
          // onSetShowSelectedOnly intentionally NOT provided
          selectedCount: 5,
          pinnedCount: 5,
        })}
      />,
    );

    expect(screen.queryByRole('combobox', { name: /показывать/i })).not.toBeInTheDocument();
  });

  it('clicking the toggle calls onSetShowSelectedOnly with true when switching to "selected"', () => {
    const onSetShowSelectedOnly = vi.fn();
    render(
      <CategoryControlPanel
        {...makeProps({
          showSelectedOnly: false,
          onSetShowSelectedOnly,
          selectedCount: 0,
          pinnedCount: 3,
        })}
      />,
    );

    const select = screen.getByRole('combobox', { name: /показывать/i });
    select.value = 'selected';
    // React tracks the change via the onChange handler — fire a native change.
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onSetShowSelectedOnly).toHaveBeenCalledWith(true);
  });
});
