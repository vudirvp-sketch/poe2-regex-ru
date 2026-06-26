// @vitest-environment jsdom
/**
 * React component tests for IconLegend (Phase 4.5, iter 137).
 *
 * Tests:
 *   - Renders the «Обозначения» title.
 *   - Renders exactly 3 rows by default.
 *   - Row 1: ★ icon + «★ — в избранное» text.
 *   - Row 2: ✗ icon + «✗ — исключить аффикс (не хочу)» text.
 *   - Row 3: ⓘ icon + «ⓘ — наведите для подсказки» text.
 *   - Icons are aria-hidden (decorative).
 *   - Section has aria-labelledby pointing to the title.
 *   - Uses semantic <ul>/<li> structure.
 *   - Accepts custom `items` prop for testing.
 *   - Renders 0 rows when items=[] (edge case).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IconLegend } from '@ui/components/IconLegend';

describe('IconLegend', () => {
  // ─── Title ───

  it('renders the «Обозначения» title', () => {
    render(<IconLegend />);
    expect(screen.getByText('Обозначения')).toBeInTheDocument();
  });

  // ─── Default rows ───

  it('renders exactly 3 rows by default', () => {
    const { container } = render(<IconLegend />);
    const rows = container.querySelectorAll('.icon-legend__row');
    expect(rows).toHaveLength(3);
  });

  it('row 1: ★ icon + «★ — в избранное» text', () => {
    render(<IconLegend />);
    expect(screen.getByText('★ — в избранное')).toBeInTheDocument();
  });

  it('row 2: ✗ icon + «✗ — исключить аффикс (не хочу)» text', () => {
    render(<IconLegend />);
    expect(screen.getByText('✗ — исключить аффикс (не хочу)')).toBeInTheDocument();
  });

  it('row 3: ⓘ icon + «ⓘ — наведите для подсказки» text', () => {
    render(<IconLegend />);
    expect(screen.getByText('ⓘ — наведите для подсказки')).toBeInTheDocument();
  });

  // ─── ARIA ───

  it('icons are aria-hidden (decorative)', () => {
    const { container } = render(<IconLegend />);
    const icons = container.querySelectorAll('.icon-legend__icon');
    expect(icons).toHaveLength(3);
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('section has aria-labelledby pointing to the title element', () => {
    const { container } = render(<IconLegend />);
    const section = container.querySelector('section.icon-legend');
    expect(section).not.toBeNull();
    const labelledBy = section!.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = container.querySelector(`#${labelledBy}`);
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toContain('Обозначения');
  });

  // ─── Semantic structure ───

  it('uses semantic <ul>/<li> structure', () => {
    const { container } = render(<IconLegend />);
    const ul = container.querySelector('ul');
    expect(ul).not.toBeNull();
    const lis = ul!.querySelectorAll('li');
    expect(lis).toHaveLength(3);
  });

  // ─── Custom items ───

  it('accepts custom `items` prop', () => {
    render(
      <IconLegend
        items={[
          { icon: '?', textKey: 'legend.star' },
          { icon: '!', textKey: 'legend.info' },
        ]}
      />
    );
    // Should render 2 rows with custom icons but default i18n text.
    expect(screen.getAllByText(/в избранное/)).toHaveLength(1);
    expect(screen.getAllByText(/наведите для подсказки/)).toHaveLength(1);
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('!')).toBeInTheDocument();
  });

  // ─── Edge case: empty items ───

  it('renders 0 rows when items=[]', () => {
    const { container } = render(<IconLegend items={[]} />);
    const rows = container.querySelectorAll('.icon-legend__row');
    expect(rows).toHaveLength(0);
    // Title still renders.
    expect(screen.getByText('Обозначения')).toBeInTheDocument();
  });
});
