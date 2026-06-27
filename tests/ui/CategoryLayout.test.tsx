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
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
