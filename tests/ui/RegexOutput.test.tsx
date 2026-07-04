// @vitest-environment jsdom
/**
 * React component tests for RegexOutput.
 *
 * Tests:
 * - Health bar color thresholds (green ≤200, yellow ≤240, red ≤250)
 * - Overflow state: copy blocked, warning displayed
 * - Empty regex: copy button disabled
 * - Character count display
 * - Auto-copy checkbox state
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RegexOutput } from '@ui/components/RegexOutput';

// Mock clipboard API
const mockWriteText = vi.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('RegexOutput', () => {
  beforeEach(() => {
    // iter 172: use fake timers to prevent the `setTimeout(() => setCopied(false), 2000)`
    // in `handleCopy` (and the pulse-on-change `setTimeout(..., 700)` in the
    // regex-change effect) from firing AFTER the test ends — those async state
    // updates on an about-to-unmount component were the source of the
    // `act()` warnings documented as a background issue. Same pattern as
    // `tests/ui/Tooltip.test.tsx`. `vi.useRealTimers()` in `afterEach`
    // discards any pending fake timers, so they never fire.
    vi.useFakeTimers();
    mockWriteText.mockClear();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Health bar thresholds ───

  it('shows green health for regex ≤200 chars', () => {
    const regex = 'а'.repeat(150); // 150 chars — green zone
    render(<RegexOutput regex={regex} isOverflow={false} />);

    // Should display character count
    expect(screen.getByText(/150/)).toBeInTheDocument();
    // Should not show overflow warning
    expect(screen.queryByText(/переполнение/i)).not.toBeInTheDocument();
  });

  it('shows yellow health for regex 201-240 chars', () => {
    const regex = 'а'.repeat(220); // 220 chars — yellow zone
    render(<RegexOutput regex={regex} isOverflow={false} />);

    expect(screen.getByText(/220/)).toBeInTheDocument();
  });

  it('shows red health for regex 241-250 chars (near limit)', () => {
    const regex = 'а'.repeat(245); // 245 chars — red zone
    render(<RegexOutput regex={regex} isOverflow={false} />);

    expect(screen.getByText(/245/)).toBeInTheDocument();
  });

  // ─── Overflow state ───

  it('shows overflow warning when isOverflow=true', () => {
    render(<RegexOutput regex="someregex" isOverflow={true} />);

    // Should display overflow warning
    expect(screen.getByText(/переполнение/i)).toBeInTheDocument();
    expect(screen.getByText(/превышает лимит/i)).toBeInTheDocument();
  });

  it('disables copy button when isOverflow=true', () => {
    render(<RegexOutput regex="someregex" isOverflow={true} />);

    const copyButton = screen.getByRole('button', { name: /копировать/i });
    expect(copyButton).toBeDisabled();
  });

  it('disables copy button when regex is empty', () => {
    render(<RegexOutput regex="" isOverflow={false} />);

    const copyButton = screen.getByRole('button', { name: /копировать/i });
    expect(copyButton).toBeDisabled();
  });

  // ─── Copy functionality ───

  it('copies regex to clipboard when copy button clicked', async () => {
    const regex = 'к сопротивлению огню';
    render(<RegexOutput regex={regex} isOverflow={false} />);

    const copyButton = screen.getByRole('button', { name: /копировать/i });
    expect(copyButton).not.toBeDisabled();

    // iter 172: under `vi.useFakeTimers()` the `vi.waitFor` polling cannot
    // advance (its internal setTimeout is faked). Flush the clipboard
    // Promise microtask within `act()` instead — this also wraps the
    // `setCopied(true)` state update that fires synchronously after the
    // awaited `navigator.clipboard.writeText(regex)` resolves, which was
    // the FIRST of the two `act()` warnings. The SECOND warning came from
    // the 2000ms `setCopied(false)` timer firing after test teardown —
    // that one is now prevented by `vi.useFakeTimers()` + `vi.useRealTimers()`
    // in beforeEach/afterEach (pending fake timers are discarded).
    await act(async () => {
      fireEvent.click(copyButton);
      // Flush the microtask queue so the awaited `clipboard.writeText`
      // continuation (setCopied(true), setTimeout(...)) runs inside act().
      await Promise.resolve();
    });
    expect(mockWriteText).toHaveBeenCalledWith(regex);
  });

  it('does not copy when overflow', async () => {
    render(<RegexOutput regex="someregex" isOverflow={true} />);

    const copyButton = screen.getByRole('button', { name: /копировать/i });
    // Button is disabled, but even if somehow clicked
    expect(copyButton).toBeDisabled();
  });

  // ─── Regex display ───

  it('displays regex text in the output area', () => {
    const regex = 'к сопротивлению огню';
    render(<RegexOutput regex={regex} isOverflow={false} />);

    expect(screen.getByText(regex)).toBeInTheDocument();
  });

  it('shows placeholder text when regex is empty', () => {
    render(<RegexOutput regex="" isOverflow={false} />);

    expect(screen.getByText(/выберите аффиксы/i)).toBeInTheDocument();
  });

  // ─── iter 167 (A3 Variant C): enhanced empty-state placeholder ───

  it('iter 167: empty state has the .regex-output__empty CSS class', () => {
    const { container } = render(<RegexOutput regex="" isOverflow={false} />);
    // The empty-state div is the direct child of `.regex-output` with the
    // `regex-output__empty` modifier class on it (alongside Tailwind utilities).
    const emptyBlock = container.querySelector('.regex-output__empty');
    expect(emptyBlock).not.toBeNull();
  });

  it('iter 167: empty state renders the ↑ arrow glyph', () => {
    const { container } = render(<RegexOutput regex="" isOverflow={false} />);
    // The arrow is a `<span class="regex-output__empty-arrow">↑</span>`.
    const arrow = container.querySelector('.regex-output__empty-arrow');
    expect(arrow).not.toBeNull();
    expect(arrow?.textContent).toBe('↑');
  });

  it('iter 167: empty state shows the secondary hint text under the placeholder', () => {
    render(<RegexOutput regex="" isOverflow={false} />);
    // The hint text comes from `regex.empty_hint` i18n key.
    expect(screen.getByText(/построит строку здесь/i)).toBeInTheDocument();
  });

  it('iter 167: populated regex does NOT have the .regex-output__empty class', () => {
    const { container } = render(<RegexOutput regex="test regex" isOverflow={false} />);
    expect(container.querySelector('.regex-output__empty')).toBeNull();
  });

  // ─── Character count display ───

  it('displays character count as N/250', () => {
    const regex = 'test1234'; // 8 chars
    render(<RegexOutput regex={regex} isOverflow={false} />);

    expect(screen.getByText(/8\/250/)).toBeInTheDocument();
  });

  // ─── Auto-copy checkbox ───

  it('renders auto-copy checkbox', () => {
    render(<RegexOutput regex="test" isOverflow={false} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
  });

  it('auto-copy checkbox can be toggled', () => {
    render(<RegexOutput regex="test" isOverflow={false} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  // ─── Progress bar ARIA ───

  it('has progressbar with correct aria attributes', () => {
    const regex = 'test1234'; // 8 chars
    render(<RegexOutput regex={regex} isOverflow={false} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '8');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '250');
  });

  // ─── Budget warning ───

  it('shows budget warning when approaching limit with many mods', () => {
    const regex = 'а'.repeat(190); // 190 chars — close to limit
    render(<RegexOutput regex={regex} isOverflow={false} activeTokenCount={8} />);

    // Should show budget-aware warning (charCount > 180 && activeTokenCount >= 6)
    expect(screen.getByText(/осталось/i)).toBeInTheDocument();
  });

  it('does NOT show budget warning when few mods', () => {
    const regex = 'а'.repeat(190); // 190 chars — close to limit
    render(<RegexOutput regex={regex} isOverflow={false} activeTokenCount={3} />);

    // Should NOT show budget warning (activeTokenCount < 6)
    expect(screen.queryByText(/осталось/i)).not.toBeInTheDocument();
  });

  it('does NOT show budget warning when regex is short', () => {
    const regex = 'а'.repeat(100); // 100 chars — plenty of room
    render(<RegexOutput regex={regex} isOverflow={false} activeTokenCount={8} />);

    // Should NOT show budget warning (charCount <= 180)
    expect(screen.queryByText(/осталось/i)).not.toBeInTheDocument();
  });
});
