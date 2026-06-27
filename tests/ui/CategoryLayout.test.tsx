// @vitest-environment jsdom
/**
 * React component tests for CategoryLayout.
 *
 * iter 139 (KI#16 + KI#20) coverage:
 * - KI#16: right `<aside>` has `category-aside` class (CSS hook for
 *   `min-width: 0` + `overflow-x: hidden` — prevents horizontal scrollbar
 *   + keeps «Копировать» button visible inside a 320px column).
 * - KI#20: `favorites` slot is OPTIONAL — when omitted (as all 7 category
 *   pages do post-iter-139), the left column renders only `controls` + `children`
 *   (no favorites panel above controls). Backward compat: when `favorites`
 *   is provided, it still renders above controls.
 *
 * iter 141 (KI#29) coverage:
 * - Aside collapse header is compact — no full panel wrapper, no empty
 *   title span. Just a chevron button + optional ⚙ badge when collapsed.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryLayout } from '@ui/layout/CategoryLayout';

describe('CategoryLayout — iter 139 (KI#16 + KI#20)', () => {
  it('KI#16: right <aside> has `category-aside` CSS class for overflow protection', () => {
    render(
      <CategoryLayout
        header={<div>Header</div>}
        controls={<div>Controls</div>}
        regexOutput={<div>RegexOutput</div>}
      >
        <div>ModList</div>
      </CategoryLayout>
    );
    // The <aside> element is the right column. Per iter 139 KI#16, it must
    // have the `category-aside` class so the CSS rule
    // `.category-aside { min-width: 0; overflow-x: hidden; }` applies,
    // preventing long regex strings from forcing a horizontal scrollbar that
    // would push the «Копировать» button off-screen.
    const aside = document.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.classList.contains('category-aside')).toBe(true);
  });

  it('KI#20: without `favorites` prop, left column has no favorites panel', () => {
    render(
      <CategoryLayout
        header={<div>Header</div>}
        controls={<div data-testid="controls">Controls</div>}
        regexOutput={<div>RegexOutput</div>}
      >
        <div data-testid="modlist">ModList</div>
      </CategoryLayout>
    );
    // Per iter 139 KI#20, all 7 category pages (Belt/Ring/Amulet/Jewel/
    // Waystone/Tablet/Relic) no longer pass `favorites={...}` — the
    // LeftPanelFavorites panel was removed from the left column because it
    // added noise the user explicitly rejected. SelectedBasket (right aside)
    // already shows selected affixes.
    // The left column should still render controls + children in order.
    const controls = screen.getByTestId('controls');
    const modlist = screen.getByTestId('modlist');
    expect(controls).toBeInTheDocument();
    expect(modlist).toBeInTheDocument();
    // No element with role="region" labelled «Избранные» should be present.
    expect(screen.queryByRole('region', { name: /Избранн/i })).not.toBeInTheDocument();
  });

  it('KI#20 backward compat: with `favorites` prop, favorites render above controls', () => {
    // The `favorites` slot stays in the API for backward compat (legacy callers,
    // tests). When provided, it renders ABOVE `controls` in the left column.
    render(
      <CategoryLayout
        header={<div>Header</div>}
        favorites={<div data-testid="favorites">Favorites</div>}
        controls={<div data-testid="controls">Controls</div>}
        regexOutput={<div>RegexOutput</div>}
      >
        <div data-testid="modlist">ModList</div>
      </CategoryLayout>
    );
    const favorites = screen.getByTestId('favorites');
    const controls = screen.getByTestId('controls');
    const modlist = screen.getByTestId('modlist');
    // All three should be present.
    expect(favorites).toBeInTheDocument();
    expect(controls).toBeInTheDocument();
    expect(modlist).toBeInTheDocument();
    // Visual order: favorites comes BEFORE controls in the DOM.
    // compareDocumentPosition returns Node.DOCUMENT_POSITION_PRECEDING (=2)
    // when the first arg is preceded by the second arg in document order.
    // So `favorites.compareDocumentPosition(controls)` should NOT include
    // PRECEDING (favorites is before controls, so controls does NOT precede
    // favorites). Equivalent: BITMASK & 2 === 0 means favorites is before.
    expect(favorites.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_PRECEDING).toBe(0);
    // And controls comes before modlist.
    expect(controls.compareDocumentPosition(modlist) & Node.DOCUMENT_POSITION_PRECEDING).toBe(0);
  });
});

describe('CategoryLayout — iter 141 (KI#29): compact aside collapse header', () => {
  // User feedback: «этот элемент слишком 'большой'» — the old aside header
  // was a full panel (`bg-panel border p-2`) with an empty `<span>` title
  // placeholder + chevron button. Visually heavy for just a toggle.
  // iter 141 KI#29: simplified to a compact flex row with just a chevron
  // button + optional ⚙ badge when collapsed. No panel wrapper, no empty span.

  it('KI#29: aside header has no `bg-panel` panel wrapper (compact)', () => {
    render(
      <CategoryLayout
        header={<div>Header</div>}
        controls={<div>Controls</div>}
        basket={<div>Basket</div>}
        regexOutput={<div>RegexOutput</div>}
      >
        <div>ModList</div>
      </CategoryLayout>
    );
    // The collapse button is rendered (basket is provided).
    const collapseBtn = screen.getByRole('button', { name: /Свернуть панель/ });
    expect(collapseBtn).toBeInTheDocument();
    // The PARENT of the button should NOT have the old `bg-panel` panel class.
    // (Old class was: `flex items-center justify-between bg-panel border border-edge-panel rounded p-2`.)
    const parent = collapseBtn.parentElement;
    expect(parent).not.toBeNull();
    expect(parent?.classList.contains('bg-panel')).toBe(false);
    expect(parent?.classList.contains('border')).toBe(false);
    expect(parent?.classList.contains('rounded')).toBe(false);
    expect(parent?.classList.contains('p-2')).toBe(false);
  });

  it('KI#29: aside header has no empty `<span>` title placeholder', () => {
    const { container } = render(
      <CategoryLayout
        header={<div>Header</div>}
        controls={<div>Controls</div>}
        basket={<div>Basket</div>}
        regexOutput={<div>RegexOutput</div>}
      >
        <div>ModList</div>
      </CategoryLayout>
    );
    // The old code rendered `<span class="text-[12px] text-muted font-semibold uppercase tracking-wider"></span>`
    // (empty span as title spacer). Verify no empty span exists in the aside header.
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    // Find all spans in the aside that are empty (no text content).
    const spans = aside?.querySelectorAll('span') ?? [];
    const emptySpans = Array.from(spans).filter(s => s.textContent?.trim() === '');
    // Empty spans should be either 0 or only the chevron's child (which has
    // textContent '▶'). The chevron span has '▶' so it's not empty.
    // Note: the ⚙ badge span is conditionally rendered — only when collapsed.
    // In the default (expanded) state, only the chevron span exists with '▶'.
    expect(emptySpans.length).toBe(0);
  });

  it('KI#29: clicking chevron toggles collapsed state (functional)', () => {
    render(
      <CategoryLayout
        header={<div>Header</div>}
        controls={<div>Controls</div>}
        basket={<div data-testid="basket">Basket</div>}
        regexOutput={<div data-testid="regex">RegexOutput</div>}
      >
        <div>ModList</div>
      </CategoryLayout>
    );
    // Initially expanded: basket + regex visible, button says "Свернуть панель".
    expect(screen.getByTestId('basket')).toBeInTheDocument();
    expect(screen.getByTestId('regex')).toBeInTheDocument();
    const collapseBtn = screen.getByRole('button', { name: /Свернуть панель/ });
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse.
    fireEvent.click(collapseBtn);

    // After collapse: basket + regex hidden, button says "Развернуть панель".
    expect(screen.queryByTestId('basket')).not.toBeInTheDocument();
    expect(screen.queryByTestId('regex')).not.toBeInTheDocument();
    const expandBtn = screen.getByRole('button', { name: /Развернуть панель/ });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

    // Click again to expand.
    fireEvent.click(expandBtn);
    expect(screen.getByTestId('basket')).toBeInTheDocument();
    expect(screen.getByTestId('regex')).toBeInTheDocument();
  });

  it('KI#29: no aside header rendered when `basket` prop is omitted (backward compat)', () => {
    render(
      <CategoryLayout
        header={<div>Header</div>}
        controls={<div>Controls</div>}
        regexOutput={<div>RegexOutput</div>}
      >
        <div>ModList</div>
      </CategoryLayout>
    );
    // No collapse/expand button should be present when basket is not provided.
    expect(screen.queryByRole('button', { name: /Свернуть панель/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Развернуть панель/ })).not.toBeInTheDocument();
  });
});
