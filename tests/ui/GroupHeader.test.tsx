// @vitest-environment jsdom
/**
 * React component tests for GroupHeader (Phase 2, iter 133).
 *
 * Tests:
 * - Renders label + count
 * - Chevron points right when collapsed, rotates when expanded
 * - Click triggers onToggle callback
 * - ARIA: aria-expanded matches isCollapsed (inverted)
 * - ARIA: aria-controls renders when controlsId provided
 * - ARIA: aria-label includes the action verb ("Развернуть"/"Свернуть")
 * - variants: 'top' | 'sub' | 'origin' render with correct classes
 * - icon prop renders before the label
 * - keyboard accessible (native <button>)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupHeader } from '@ui/components/GroupHeader';

describe('GroupHeader', () => {
  // ─── Rendering ───

  it('renders label and count', () => {
    render(
      <GroupHeader label="ПРЕФИКСЫ" count={42} isCollapsed={false} onToggle={vi.fn()} />
    );
    expect(screen.getByText(/ПРЕФИКСЫ/)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('renders as a button element (keyboard accessible)', () => {
    render(
      <GroupHeader label="ПРЕФИКСЫ" count={1} isCollapsed={false} onToggle={vi.fn()} />
    );
    const btn = screen.getByRole('button');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
  });

  // ─── Click behaviour ───

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(
      <GroupHeader label="СУФФИКСЫ" count={5} isCollapsed={false} onToggle={onToggle} />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // ─── ARIA: aria-expanded ───

  it('sets aria-expanded=true when not collapsed', () => {
    render(
      <GroupHeader label="X" count={0} isCollapsed={false} onToggle={vi.fn()} />
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('sets aria-expanded=false when collapsed', () => {
    render(
      <GroupHeader label="X" count={0} isCollapsed={true} onToggle={vi.fn()} />
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  // ─── ARIA: aria-controls ───

  it('renders aria-controls when controlsId provided', () => {
    render(
      <GroupHeader
        label="X"
        count={0}
        isCollapsed={false}
        onToggle={vi.fn()}
        controlsId="group-body-1"
      />
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-controls', 'group-body-1');
  });

  it('omits aria-controls when controlsId not provided', () => {
    render(
      <GroupHeader label="X" count={0} isCollapsed={false} onToggle={vi.fn()} />
    );
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-controls');
  });

  // ─── ARIA: aria-label includes the action verb ───

  it('aria-label includes "Развернуть" (expand) when collapsed', () => {
    render(
      <GroupHeader label="ПРЕФИКСЫ" count={3} isCollapsed={true} onToggle={vi.fn()} />
    );
    const label = screen.getByRole('button').getAttribute('aria-label') || '';
    expect(label.toLowerCase()).toContain('развернуть');
    expect(label).toContain('ПРЕФИКСЫ');
  });

  it('aria-label includes "Свернуть" (collapse) when expanded', () => {
    render(
      <GroupHeader label="ПРЕФИКСЫ" count={3} isCollapsed={false} onToggle={vi.fn()} />
    );
    const label = screen.getByRole('button').getAttribute('aria-label') || '';
    expect(label.toLowerCase()).toContain('свернуть');
    expect(label).toContain('ПРЕФИКСЫ');
  });

  // ─── Chevron ───

  it('chevron is aria-hidden (decorative)', () => {
    const { container } = render(
      <GroupHeader label="X" count={0} isCollapsed={false} onToggle={vi.fn()} />
    );
    const chevron = container.querySelector('.group-header-chevron');
    expect(chevron).not.toBeNull();
    expect(chevron?.getAttribute('aria-hidden')).toBe('true');
  });

  it('chevron glyph is ▶ (right-pointing triangle)', () => {
    const { container } = render(
      <GroupHeader label="X" count={0} isCollapsed={true} onToggle={vi.fn()} />
    );
    const chevron = container.querySelector('.group-header-chevron');
    expect(chevron?.textContent).toBe('▶');
  });

  // ─── Variants ───

  it('applies "top" variant classes by default', () => {
    render(
      <GroupHeader label="X" count={0} isCollapsed={false} onToggle={vi.fn()} />
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-base');
    expect(btn.className).toContain('font-bold');
  });

  it('applies "sub" variant classes when variant="sub"', () => {
    render(
      <GroupHeader label="X" count={0} isCollapsed={false} onToggle={vi.fn()} variant="sub" />
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-[12px]');
    expect(btn.className).toContain('font-semibold');
  });

  it('applies "origin" variant classes when variant="origin"', () => {
    render(
      <GroupHeader label="X" count={0} isCollapsed={false} onToggle={vi.fn()} variant="origin" />
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-[14px]');
    expect(btn.className).toContain('border-l-2');
  });

  // ─── Custom className ───

  it('merges custom className with variant classes', () => {
    render(
      <GroupHeader
        label="X"
        count={0}
        isCollapsed={false}
        onToggle={vi.fn()}
        className="text-accent-blue affix-header-prefix"
      />
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-accent-blue');
    expect(btn.className).toContain('affix-header-prefix');
    // Variant class still present
    expect(btn.className).toContain('text-base');
  });

  // ─── Icon ───

  it('renders icon before the label when provided', () => {
    render(
      <GroupHeader
        label="Осквернённые"
        count={7}
        isCollapsed={false}
        onToggle={vi.fn()}
        icon={<img data-testid="origin-icon" src="/icon.png" alt="" />}
      />
    );
    const icon = screen.getByTestId('origin-icon');
    const label = screen.getByText(/Осквернённые/);
    // Icon should come before label in DOM order (chevron, then icon, then label span)
    expect(icon.compareDocumentPosition(label)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  // ─── Count = 0 edge case ───

  it('renders count=0 without crashing', () => {
    render(
      <GroupHeader label="ПУСТО" count={0} isCollapsed={false} onToggle={vi.fn()} />
    );
    expect(screen.getByText(/ПУСТО/)).toBeInTheDocument();
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });
});
