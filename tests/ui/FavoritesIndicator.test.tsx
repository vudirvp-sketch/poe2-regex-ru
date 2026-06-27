// @vitest-environment jsdom
/**
 * React component tests for FavoritesIndicator (iter 140, KI#24).
 *
 * Compact `★ N` badge for category page headers. Restores favorites
 * visibility without restoring the noisy chip list (which was removed
 * in iter 139 KI#20).
 *
 * Tests:
 *   - Returns null when pinnedIds is empty (no badge shown).
 *   - Renders `★` icon + label + count when pinnedIds is non-empty.
 *   - aria-label includes the count for screen readers.
 *   - role="status" so screen readers announce changes.
 *   - ★ glyph is aria-hidden (decorative).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FavoritesIndicator } from '@ui/components/FavoritesIndicator';

describe('FavoritesIndicator — iter 140 (KI#24)', () => {
  it('returns null when pinnedIds is empty (no badge shown)', () => {
    const { container } = render(<FavoritesIndicator pinnedIds={new Set()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders ★ icon + label + count when pinnedIds is non-empty', () => {
    const pinnedIds = new Set(['p1', 'p2', 'p3']);
    render(<FavoritesIndicator pinnedIds={pinnedIds} />);

    // Label text renders with count.
    expect(screen.getByText(/Избранные аффиксы: 3/)).toBeInTheDocument();
    // ★ icon renders (aria-hidden, decorative).
    const star = screen.getByText('★');
    expect(star).toBeInTheDocument();
    expect(star).toHaveAttribute('aria-hidden', 'true');
  });

  it('aria-label includes the count for screen readers', () => {
    const pinnedIds = new Set(['a', 'b']);
    render(<FavoritesIndicator pinnedIds={pinnedIds} />);
    // The outer span has role="status" with aria-label containing the count.
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Избранные аффиксы: 2');
  });

  it('updates count when pinnedIds changes', () => {
    const { rerender } = render(<FavoritesIndicator pinnedIds={new Set(['p1'])} />);
    expect(screen.getByText(/Избранные аффиксы: 1/)).toBeInTheDocument();

    rerender(<FavoritesIndicator pinnedIds={new Set(['p1', 'p2', 'p3', 'p4'])} />);
    expect(screen.getByText(/Избранные аффиксы: 4/)).toBeInTheDocument();
  });

  it('returns null again when pinnedIds shrinks back to empty', () => {
    const { container, rerender } = render(
      <FavoritesIndicator pinnedIds={new Set(['p1'])} />
    );
    expect(container.firstChild).not.toBeNull();

    rerender(<FavoritesIndicator pinnedIds={new Set()} />);
    expect(container.firstChild).toBeNull();
  });
});
