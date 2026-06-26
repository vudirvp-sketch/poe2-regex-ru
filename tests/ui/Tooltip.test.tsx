// @vitest-environment jsdom
/**
 * React component tests for Tooltip (Phase 4, iter 137).
 *
 * Tests:
 *   - Renders a trigger button (default ⓘ glyph).
 *   - Does NOT render tooltip content initially.
 *   - Opens on hover (after delay).
 *   - Opens immediately on focus.
 *   - Closes on blur (after delay).
 *   - Closes on Escape key.
 *   - Closes on click-outside.
 *   - Tooltip content has role="tooltip".
 *   - aria-describedby points to the tooltip id when open.
 *   - Click trigger toggles open/close.
 *   - Custom trigger node renders instead of default ⓘ.
 *   - Click on trigger does NOT propagate to parent (stopPropagation).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Tooltip } from '@ui/components/Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Initial render ───

  it('renders a trigger button with default ⓘ glyph', () => {
    render(<Tooltip content="Подсказка" />);
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain('ⓘ');
  });

  it('does NOT render tooltip content initially', () => {
    render(<Tooltip content="Подсказка" />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders a custom trigger node when provided', () => {
    render(<Tooltip content="X" trigger={<span data-testid="custom">?</span>} />);
    expect(screen.getByTestId('custom')).toBeInTheDocument();
    expect(screen.queryByText('ⓘ')).not.toBeInTheDocument();
  });

  // ─── Open on hover ───

  it('opens on hover after delay', () => {
    render(<Tooltip content="Подсказка" />);
    const btn = screen.getByRole('button');
    fireEvent.mouseEnter(btn);
    // Not open immediately.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    // Open after OPEN_DELAY_MS (350ms).
    act(() => { vi.advanceTimersByTime(350); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Подсказка');
  });

  // ─── Open on focus ───

  it('opens immediately on focus (no delay)', () => {
    render(<Tooltip content="Подсказка" />);
    const btn = screen.getByRole('button');
    fireEvent.focus(btn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  // ─── Close on blur ───

  it('closes on blur after delay', () => {
    render(<Tooltip content="Подсказка" />);
    const btn = screen.getByRole('button');
    fireEvent.focus(btn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(btn);
    // Not closed immediately.
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  // ─── Close on Escape ───

  it('closes on Escape key', () => {
    render(<Tooltip content="Подсказка" />);
    const btn = screen.getByRole('button');
    fireEvent.focus(btn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    // Escape is handled by the local onKeyDown handler on the trigger button
    // (not a global document listener) so React 19 flushes the state update
    // synchronously via the synthetic event system.
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  // ─── Close on click-outside ───

  it('closes on click outside', () => {
    render(
      <div>
        <Tooltip content="Подсказка" />
        <div data-testid="outside">outside</div>
      </div>
    );
    const btn = screen.getByRole('button');
    fireEvent.focus(btn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    // Click outside the trigger + tooltip.
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  // ─── Click trigger toggles ───

  it('click trigger opens tooltip when closed', () => {
    render(<Tooltip content="Подсказка" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('click trigger closes tooltip when open', () => {
    render(<Tooltip content="Подсказка" />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  // ─── ARIA ───

  it('tooltip content has role="tooltip"', () => {
    render(<Tooltip content="X" />);
    const btn = screen.getByRole('button');
    fireEvent.focus(btn);
    const tip = screen.getByRole('tooltip');
    expect(tip).toBeInTheDocument();
  });

  it('trigger has aria-describedby pointing to tooltip when open', () => {
    render(<Tooltip content="X" />);
    const btn = screen.getByRole('button');
    fireEvent.focus(btn);
    const tip = screen.getByRole('tooltip');
    const tipId = tip.id;
    expect(tipId).toBeTruthy();
    expect(btn).toHaveAttribute('aria-describedby', tipId);
  });

  it('trigger has aria-expanded reflecting open state', () => {
    render(<Tooltip content="X" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('trigger uses custom ariaLabel when provided', () => {
    render(<Tooltip content="X" ariaLabel="Пояснение к префиксу" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Пояснение к префиксу');
  });

  // ─── stopPropagation ───

  it('click on trigger does NOT propagate to parent', () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <Tooltip content="X" />
      </div>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(parentClick).not.toHaveBeenCalled();
  });

  // ─── Timers cleanup ───

  it('does not open after unmount (timer cleared)', () => {
    const { unmount } = render(<Tooltip content="X" />);
    const btn = screen.getByRole('button');
    fireEvent.mouseEnter(btn);
    unmount();
    // Advancing timers should NOT throw — timers were cleared on unmount.
    expect(() => act(() => { vi.advanceTimersByTime(500); })).not.toThrow();
  });
});
