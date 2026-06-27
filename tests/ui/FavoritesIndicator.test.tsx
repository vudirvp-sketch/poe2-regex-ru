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
 * iter 146 (KI#36/37): panel grouping rewritten to use canonical
 * `groupTokensByFamily` + `splitGroupByOrigin`. displayText is now the
 * familyKey with range substitution (e.g., `+(10—30) к сопротивлению огню`),
 * NOT the first member's rawText. Origin badge added for non-normal origins.
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
 *   - iter 146 (KI#36): multi-origin family — pinning desecrated variant
 *     correctly shows in panel (was previously invisible due to grouping bug).
 *   - iter 146 (KI#37): origin badge renders for non-normal origin.
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

/**
 * Build a CategoryData with tokens whose familyKey contains a `#` placeholder
 * (realistic shape — displayText after substitution is `+(10—30) к сопротивлению огню`).
 *
 * iter 146: familyKey now includes the `#` placeholder so that
 * `groupTokensByFamily` produces a substituted displayText that matches
 * what FilterChip renders. The OLD fixture used plain familyKey without `#`,
 * which only worked because the buggy old panel code used rawText directly.
 */
function makeCategoryData(): CategoryData {
  return {
    tokens: [
      makeToken('p1', {
        affix: 'prefix',
        familyKey: { ru: '+# к сопротивлению огню' },
        rawText: { ru: '+(10—30) к сопротивлению огню' },
        rawTextTemplate: { ru: '+## к сопротивлению огню' },
        ranges: [[10, 30]],
      }),
      makeToken('p2', {
        affix: 'prefix',
        familyKey: { ru: '+# к сопротивлению огню' },
        rawText: { ru: '+(31—50) к сопротивлению огню' },
        rawTextTemplate: { ru: '+## к сопротивлению огню' },
        ranges: [[31, 50]],
      }),
      makeToken('p3', {
        affix: 'prefix',
        familyKey: { ru: '+# к силе' },
        rawText: { ru: '+(5—10) к силе' },
        rawTextTemplate: { ru: '+## к силе' },
        ranges: [[5, 10]],
      }),
    ],
    optimizationTable: {},
    familyGroups: [],
  } as unknown as CategoryData;
}

/**
 * iter 146 (KI#36): fixture with a family that has TWO origins (normal +
 * desecrated). This is the case that exposed the original grouping bug.
 *
 * The family `+#% к сопротивлению` has:
 *   - p1 (normal, rawText `+(5—15)% к сопротивлению`)
 *   - p2 (desecrated, rawText `+(4—8)% к сопротивлению`)
 *
 * When the user pins the DESECRATED variant (p2), pinnedIds = {p2}.
 * The OLD panel code grouped by clean familyKey → members[0] = p1 (normal).
 * Check `pinnedIds.has(p1)` → false → family not shown.
 * The NEW panel code uses splitGroupByOrigin → checks each origin-split
 * sub-group separately → desecrated sub-group has p2 in pinnedIds → shown.
 */
function makeMultiOriginCategoryData(): CategoryData {
  return {
    tokens: [
      makeToken('p1', {
        affix: 'prefix',
        origin: 'normal',
        familyKey: { ru: '+#% к сопротивлению' },
        rawText: { ru: '+(5—15)% к сопротивлению' },
        rawTextTemplate: { ru: '+##% к сопротивлению' },
        ranges: [[5, 15]],
      }),
      makeToken('p2', {
        id: 'p2-desc',
        affix: 'prefix',
        origin: 'desecrated',
        familyKey: { ru: '+#% к сопротивлению' },
        rawText: { ru: '+(4—8)% к сопротивлению' },
        rawTextTemplate: { ru: '+##% к сопротивлению' },
        ranges: [[4, 8]],
      }),
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

    // iter 146 (KI#36): displayText is now the substituted familyKey
    // (e.g., `+(10—50) к сопротивлению огню`), NOT the rawText.
    // Family `+# к сопротивлению огню` has p1 (10—30) + p2 (31—50) →
    // substituted displayText = `+(10—50) к сопротивлению огню`.
    expect(screen.getByText(/\+\(10—50\) к сопротивлению огню/)).toBeInTheDocument();
    // Family `+# к силе` has p3 (5—10) → `+(5—10) к силе`.
    expect(screen.getByText(/\+\(5—10\) к силе/)).toBeInTheDocument();

    // Each family has a «Выбрать» button — there should be 2.
    const selectButtons = screen.getAllByRole('button', { name: 'Выбрать' });
    expect(selectButtons.length).toBe(2);

    // Each family has a ✗ remove button (aria-label includes displayText).
    expect(screen.getByRole('button', { name: /Убрать .+ к сопротивлению огню из избранного/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Убрать .+ к силе из избранного/ })).toBeInTheDocument();
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
    // members of the '+# к сопротивлению огню' family).
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
    // of the '+# к сопротивлению огню' family — per iter 141 KI#28 family-level pin convention).
    const removeBtn = screen.getByRole('button', { name: /Убрать .+ к сопротивлению огню из избранного/ });
    fireEvent.click(removeBtn);
    expect(onTogglePinned).toHaveBeenCalledWith('p1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// iter 146 (KI#36) — multi-origin family grouping bug regression tests.
// ─────────────────────────────────────────────────────────────────────────────

describe('FavoritesIndicator — iter 146 (KI#36) multi-origin grouping', () => {
  it('pinning a desecrated variant shows it in the panel (was invisible before KI#36)', () => {
    // User pinned the DESECRATED variant (p2-desc) — pinnedIds = {p2-desc}.
    // OLD buggy behavior: panel grouped by clean familyKey → members[0] = p1
    // (normal) → pinnedIds.has(p1) = false → family NOT shown in panel.
    // NEW behavior: splitGroupByOrigin → desecrated sub-group has p2-desc
    // in pinnedIds → family shown with desecrated badge.
    const pinnedIds = new Set(['p2-desc']);
    const data = makeMultiOriginCategoryData();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="jewel"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    // Open panel.
    fireEvent.click(screen.getByRole('button'));

    // The desecrated family MUST appear in the panel — this is the
    // regression we're guarding against. displayText for desecrated
    // sub-group: familyKey `+#% к сопротивлению` with ranges [4,8] →
    // substituted `+(4—8)% к сопротивлению`.
    expect(screen.getByText(/\+\(4—8\)% к сопротивлению/)).toBeInTheDocument();

    // The NORMAL variant (p1, ranges 5—15) should NOT appear — only the
    // desecrated variant was pinned, so only that sub-group is favorited.
    expect(screen.queryByText(/\+\(5—15\)% к сопротивлению/)).not.toBeInTheDocument();
  });

  it('origin badge renders for non-normal origin (KI#37)', () => {
    const pinnedIds = new Set(['p2-desc']);
    const data = makeMultiOriginCategoryData();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="jewel"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    // iter 146 (KI#37): origin badge "ОЧЕРН" (short for "Очернённые")
    // renders next to the affix badge for the desecrated variant.
    expect(screen.getByText('ОЧЕРН')).toBeInTheDocument();
  });

  it('origin badge is hidden for normal origin (KI#37)', () => {
    // Pin the NORMAL variant — no origin badge should render.
    const pinnedIds = new Set(['p1']);
    const data = makeMultiOriginCategoryData();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="jewel"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    // Normal variant appears with its substituted displayText.
    expect(screen.getByText(/\+\(5—15\)% к сопротивлению/)).toBeInTheDocument();
    // No origin badge text for normal origin.
    expect(screen.queryByText('ОЧЕРН')).not.toBeInTheDocument();
    expect(screen.queryByText('ОСКВ')).not.toBeInTheDocument();
  });

  it('pinning both normal AND desecrated variants shows both entries in panel', () => {
    // User pinned both variants — two separate entries should appear,
    // each with its own origin badge (only desecrated gets a badge).
    const pinnedIds = new Set(['p1', 'p2-desc']);
    const data = makeMultiOriginCategoryData();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="jewel"
        perTokenRanges={{}}
        onToggleTokens={vi.fn()}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    // Both variants appear with their origin-scoped displayText.
    expect(screen.getByText(/\+\(5—15\)% к сопротивлению/)).toBeInTheDocument();
    expect(screen.getByText(/\+\(4—8\)% к сопротивлению/)).toBeInTheDocument();

    // Two «Выбрать» buttons — one per origin-split family.
    const selectButtons = screen.getAllByRole('button', { name: 'Выбрать' });
    expect(selectButtons.length).toBe(2);
  });

  it('clicking «Выбрать» on the desecrated variant calls onToggleTokens with desecrated members only', () => {
    // Important: clicking «Выбрать» on the desecrated entry should only
    // add the desecrated variant's member ID (p2-desc), NOT the normal
    // variant (p1). This is the per-origin-split behavior.
    const pinnedIds = new Set(['p1', 'p2-desc']);
    const data = makeMultiOriginCategoryData();
    const onToggleTokens = vi.fn();
    render(
      <FavoritesIndicator
        pinnedIds={pinnedIds}
        data={data}
        categoryId="jewel"
        perTokenRanges={{}}
        onToggleTokens={onToggleTokens}
        onTogglePinned={vi.fn()}
        onSetTokenRange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    // Find the «Выбрать» button that's in the same row as the desecrated
    // entry. We locate the desecrated entry by its displayText, then
    // find the closest «Выбрать» button.
    const desecratedText = screen.getByText(/\+\(4—8\)% к сопротивлению/);
    const listItem = desecratedText.closest('li');
    expect(listItem).not.toBeNull();
    const selectBtn = listItem!.querySelector('button:not([aria-label*="Убрать"])');
    expect(selectBtn).not.toBeNull();
    fireEvent.click(selectBtn!);

    // Should be called with ['p2-desc'] — only the desecrated member.
    expect(onToggleTokens).toHaveBeenCalledWith(['p2-desc']);
  });
});
