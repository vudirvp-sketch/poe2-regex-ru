// @vitest-environment jsdom
/**
 * React component tests for FavoritesIndicator.
 *
 * iter 140 (KI#24): originally pure presentational `★ N` badge.
 * iter 144 (KI#31 variant d): now a clickable button that opens a
 * FavoritesQuickSelectPanel portal when `data` + callbacks are provided.
 * When those props are omitted (legacy callers / these tests), the badge
 * remains presentational-only — preserves backward compat.
 *
 * Tests:
 *   - Returns null when pinnedIds is empty (no badge shown).
 *   - Renders `★` icon + label + count when pinnedIds is non-empty.
 *   - aria-label includes the count for screen readers.
 *   - ★ glyph is aria-hidden (decorative).
 *   - Updates count when pinnedIds changes.
 *   - Returns null again when pinnedIds shrinks back to empty.
 *   - iter 144: when panel props provided, click opens the panel portal.
 *   - iter 144: when panel props omitted, click is a no-op (presentational).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FavoritesIndicator } from '@ui/components/FavoritesIndicator';
import type { CategoryData, GameToken } from '@shared/types';

// ─── Test fixtures ─────────────────────────────────────────────────────────

function makeToken(id: string, opts: Partial<GameToken> = {}): GameToken {
  return {
    id,
    category: 'belt',
    origin: 'normal',
    rawText: { ru: `Текст ${id}` },
    rawTextTemplate: { ru: '## текст' },
    regex: { ru: `текст.*${id}` },
    familyKey: { ru: 'семейство тест' },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
    genderForms: { ru: {} },
    affix: 'prefix',
    tags: [],
    ranges: [[10, 30]],
    values: [],
    hasYofication: false,
    yoficationPositions: [],
    level: 1,
    ...opts,
  };
}

function makeCategoryData(): CategoryData {
  return {
    tokens: [
      makeToken('p1', { affix: 'prefix', familyKey: { ru: 'Резист' }, rawText: { ru: '+ к сопротивлению' } }),
      makeToken('p2', { affix: 'prefix', familyKey: { ru: 'Резист' }, rawText: { ru: '+ к сопротивлению огню' } }),
      makeToken('p3', { affix: 'prefix', familyKey: { ru: 'Характеристики' }, rawText: { ru: '+ к силе' } }),
    ],
    optimizationTable: {},
    familyGroups: [],
  } as unknown as CategoryData;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('FavoritesIndicator — iter 140 (KI#24) presentational mode', () => {
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

  it('aria-label includes the count for screen readers (presentational mode)', () => {
    const pinnedIds = new Set(['a', 'b']);
    render(<FavoritesIndicator pinnedIds={pinnedIds} />);
    // iter 144: the indicator is now a <button> (not a <span role="status">).
    // When panel props are NOT provided, aria-label is the plain label
    // (without the "open panel" hint).
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Избранные аффиксы: 2');
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

describe('FavoritesIndicator — iter 144 (KI#31 variant d) clickable mode', () => {
  it('click is a no-op when panel props are omitted (presentational mode)', () => {
    const pinnedIds = new Set(['p1']);
    render(<FavoritesIndicator pinnedIds={pinnedIds} />);

    const button = screen.getByRole('button');
    // Click should NOT open any panel (no portal rendered).
    fireEvent.click(button);
    // No dialog role appears in the document.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aria-label includes "open panel" hint when panel props are provided', () => {
    const pinnedIds = new Set(['p1', 'p2']);
    const data = makeCategoryData();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="belt"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    const button = screen.getByRole('button');
    // iter 144: aria-label changes to the "open panel" variant when panel
    // props are provided.
    expect(button).toHaveAttribute('aria-label', 'Открыть панель избранных аффиксов (2)');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking the badge opens the FavoritesQuickSelectPanel portal', () => {
    const pinnedIds = new Set(['p1']);
    const data = makeCategoryData();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="belt"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);

    // Panel opens — aria-expanded becomes true.
    expect(button).toHaveAttribute('aria-expanded', 'true');
    // Panel renders as a dialog (via createPortal in document.body).
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Panel title is visible.
    expect(screen.getByText(/⭐ Избранные аффиксы/)).toBeInTheDocument();
  });

  it('clicking the badge again closes the panel (toggle behavior)', () => {
    const pinnedIds = new Set(['p1']);
    const data = makeCategoryData();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="belt"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    const button = screen.getByRole('button');
    // Open.
    fireEvent.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Close (click again).
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicking the ✗ close button in the panel closes the panel', () => {
    const pinnedIds = new Set(['p1']);
    const data = makeCategoryData();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="belt"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    // Open panel.
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click × close button (aria-label = "Закрыть панель избранных аффиксов").
    const closeBtn = screen.getByRole('button', { name: 'Закрыть панель избранных аффиксов' });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('panel lists favorited families with displayText + «Выбрать» + ✗ buttons', () => {
    // Pin first member of two families: 'p1' (Резист) + 'p3' (Характеристики).
    const pinnedIds = new Set(['p1', 'p3']);
    const data = makeCategoryData();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="belt"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    // Open panel.
    fireEvent.click(screen.getByRole('button'));

    // Both favorited families' displayText should appear.
    expect(screen.getByText('+ к сопротивлению')).toBeInTheDocument();
    expect(screen.getByText('+ к силе')).toBeInTheDocument();

    // Each family has a «Выбрать» button — there should be 2.
    const selectButtons = screen.getAllByRole('button', { name: 'Выбрать' });
    expect(selectButtons.length).toBe(2);

    // Each family has a ✗ remove button (aria-label includes displayText).
    expect(screen.getByRole('button', { name: /Убрать \+ к сопротивлению из избранного/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Убрать \+ к силе из избранного/ })).toBeInTheDocument();
  });

  it('clicking «Выбрать» calls onToggleTokens with all family member IDs', () => {
    const pinnedIds = new Set(['p1']);
    const data = makeCategoryData();
    const onToggleTokens = vi.fn();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="belt"
        perTokenRanges={{}}
        onToggleTokens={onToggleTokens}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    // Open panel.
    fireEvent.click(screen.getByRole('button'));

    // Click «Выбрать» — should call onToggleTokens with ['p1', 'p2'] (both
    // members of the 'Резист' family).
    const selectBtn = screen.getByRole('button', { name: 'Выбрать' });
    fireEvent.click(selectBtn);
    expect(onToggleTokens).toHaveBeenCalledWith(['p1', 'p2']);
  });

  it('clicking ✗ calls onTogglePinned with the family\'s first member ID', () => {
    const pinnedIds = new Set(['p1']);
    const data = makeCategoryData();
    const onTogglePinned = vi.fn();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="belt"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={onTogglePinned}
        onSetTokenRange={vi.fn()}
      />,
    );

    // Open panel.
    fireEvent.click(screen.getByRole('button'));

    // Click ✗ remove — should call onTogglePinned with 'p1' (first member
    // of the 'Резист' family — per iter 141 KI#28 family-level pin convention).
    const removeBtn = screen.getByRole('button', { name: /Убрать \+ к сопротивлению из избранного/ });
    fireEvent.click(removeBtn);
    expect(onTogglePinned).toHaveBeenCalledWith('p1');
  });
});
