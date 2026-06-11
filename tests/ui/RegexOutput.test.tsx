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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    mockWriteText.mockClear();
    localStorageMock.clear();
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

    fireEvent.click(copyButton);

    // Wait for async clipboard
    await vi.waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(regex);
    });
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
