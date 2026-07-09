// @vitest-environment jsdom
/**
 * React component tests for IconLegend (Phase 4.5, iter 137).
 *
 * iter 140 (KI#21): i18n strings no longer contain the icon prefix —
 * IconLegend renders the icon as a separate `<span class="icon-legend__icon">`.
 * Previously the strings contained `'★ — в избранное'` etc., producing double
 * icons (`★ ★ — в избранное`). Now strings contain ONLY the description text.
 *
 * Tests:
 *   - Renders the «Обозначения» title.
 *   - Renders exactly 3 rows by default.
 *   - Row 1: ★ icon + «в избранное» text.
 *   - Row 2: ✗ icon + «исключить аффикс (не хочу)» text.
 *   - Row 3: ⓘ icon + «наведите для подсказки» text.
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

  it('row 1: ★ icon + «в избранное» text (no icon duplication, iter 140 KI#21)', () => {
    render(<IconLegend />);
    // iter 140 (KI#21): i18n string no longer contains icon prefix.
    // Text span contains ONLY «в избранное» (no ★ prefix).
    expect(screen.getByText('в избранное')).toBeInTheDocument();
  });

  it('row 2: ✗ icon + «исключить аффикс (не хочу)» text (no icon duplication, iter 140 KI#21)', () => {
    render(<IconLegend />);
    expect(screen.getByText('исключить аффикс (не хочу)')).toBeInTheDocument();
  });

  it('row 3: ⓘ icon + «наведите для подсказки» text (no icon duplication, iter 140 KI#21)', () => {
    render(<IconLegend />);
    expect(screen.getByText('наведите для подсказки')).toBeInTheDocument();
  });

  it('renders each icon EXACTLY ONCE (no duplication, iter 140 KI#21)', () => {
    const { container } = render(<IconLegend />);
    // The icon span contains the icon character. The text span no longer
    // contains the icon (iter 140 fix). So each icon character should appear
    // EXACTLY ONCE in the rendered DOM — in the icon span only.
    const allText = container.textContent || '';
    const starCount = (allText.match(/★/g) || []).length;
    const crossCount = (allText.match(/✗/g) || []).length;
    const infoCount = (allText.match(/ⓘ/g) || []).length;
    expect(starCount).toBe(1);
    expect(crossCount).toBe(1);
    expect(infoCount).toBe(1);
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

  // ─── iter 161: showMixedHint appends a 4th row for MIXED mode ───

  it('iter 161: showMixedHint=false (default) → 3 rows, no OPT hint', () => {
    const { container } = render(<IconLegend />);
    const rows = container.querySelectorAll('.icon-legend__row');
    expect(rows).toHaveLength(3);
    // iter 181 (KI#56): updated regex to match either the old or new label
    // wording (Ctrl/Shift+клик ... опционально).
    expect(screen.queryByText(/Shift\+клик по чипу/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ctrl\/Shift\+клик по чипу.*опционально/)).not.toBeInTheDocument();
  });

  it('iter 161: showMixedHint=true → 4 rows, last row is the OPT shift+click hint', () => {
    const { container } = render(<IconLegend showMixedHint={true} />);
    const rows = container.querySelectorAll('.icon-legend__row');
    expect(rows).toHaveLength(4);
    // The 4th row text matches the i18n key 'legend.opt_shift_click'.
    // iter 181 (KI#56): updated regex to match the new label mentioning
    // Ctrl+клик + ⊕ button alternatives (was "Shift+клик по чипу — опционально").
    expect(screen.getByText(/Ctrl\/Shift\+клик по чипу.*опционально/)).toBeInTheDocument();
    // The 4th row icon is ⇄ (left-right arrow, metaphor for "either this OR that").
    expect(screen.getByText('⇄')).toBeInTheDocument();
  });

  it('iter 161: custom items prop overrides showMixedHint (backward compat with tests)', () => {
    // When `items` is explicitly provided, showMixedHint is ignored — the
    // caller is in full control of the row list. This preserves backward
    // compat with the existing `items` prop tests above.
    const { container } = render(
      <IconLegend
        items={[{ icon: 'X', textKey: 'legend.star' }]}
        showMixedHint={true}
      />
    );
    const rows = container.querySelectorAll('.icon-legend__row');
    expect(rows).toHaveLength(1);
    expect(screen.queryByText(/Shift\+клик по чипу/)).not.toBeInTheDocument();
  });
});
