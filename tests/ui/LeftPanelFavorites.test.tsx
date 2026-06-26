// @vitest-environment jsdom
/**
 * React component tests for LeftPanelFavorites (Phase 5, iter 136).
 *
 * Tests focus on the new left-panel favorites component:
 *   - Empty state: «Нажмите ★ на аффиксе...» placeholder when pinnedIds is empty.
 *   - Renders one chip per favorited family group (NOT per token).
 *   - Affix-type badge (ПРЕФ / СУФ / ИМПЛ) prefixed to each chip.
 *   - «Очистить» link calls onClearPinned.
 *   - Click on ✗ (unpin) button calls onTogglePinned with that family's member IDs.
 *   - Click on chip body (label area) triggers scroll-to-mod via
 *     document.querySelector('[data-family-key="..."]').scrollIntoView.
 *   - Header shows «⭐ Избранные: N» with correct count.
 *   - Max-height 30vh with internal scroll.
 *
 * Fixtures mirror tests/ui/SelectedBasket.test.tsx patterns (makeToken helper).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftPanelFavorites } from '@ui/components/LeftPanelFavorites';
import type { GameToken } from '@shared/types';

// ─── Test fixtures ───

function makeToken(id: string, opts: Partial<GameToken> = {}): GameToken {
  return {
    id,
    category: 'belt',
    origin: 'normal',
    rawText: { ru: `Текст мода ${id}` },
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

/** 8 tokens: 2 prefix + 2 suffix families, 2 members each.
 *  Family groups: 'Резист' (2 prefix), 'Характеристики' (2 prefix),
 *  'Урон' (2 suffix), 'Жизнь' (2 suffix). */
function makeBeltTokens(): GameToken[] {
  return [
    makeToken('p1', { affix: 'prefix', familyKey: { ru: 'Резист' }, rawText: { ru: '+ к сопротивлению' } }),
    makeToken('p2', { affix: 'prefix', familyKey: { ru: 'Резист' }, rawText: { ru: '+ к сопротивлению огню' } }),
    makeToken('p3', { affix: 'prefix', familyKey: { ru: 'Характеристики' }, rawText: { ru: '+ к силе' } }),
    makeToken('p4', { affix: 'prefix', familyKey: { ru: 'Характеристики' }, rawText: { ru: '+ к ловкости' } }),
    makeToken('s1', { affix: 'suffix', familyKey: { ru: 'Урон' }, rawText: { ru: '+ к урону' } }),
    makeToken('s2', { affix: 'suffix', familyKey: { ru: 'Урон' }, rawText: { ru: '+ к урону огнем' } }),
    makeToken('s3', { affix: 'suffix', familyKey: { ru: 'Жизнь' }, rawText: { ru: '+ к максимуму жизни' } }),
    makeToken('s4', { affix: 'suffix', familyKey: { ru: 'Жизнь' }, rawText: { ru: '+ к регенерации' } }),
  ];
}

/** Build tokens with N prefix families (1 member each). Used for cap tests —
 *  each family produces exactly one chip in the favorites panel. */
function makeManyFamilyTokens(count: number): GameToken[] {
  const tokens: GameToken[] = [];
  for (let i = 1; i <= count; i++) {
    tokens.push(makeToken(`p${i}`, {
      affix: 'prefix',
      familyKey: { ru: `Семейство ${i}` },
      rawText: { ru: `текст ${i}` },
    }));
  }
  return tokens;
}

// ─── Mocks for scroll-to-mod ───

// We use a REAL HTMLElement (created via document.createElement) and attach
// mocks to its scrollIntoView + classList methods. This is necessary because
// the LeftPanelFavorites component uses `chipEl instanceof HTMLElement` to
// guard the scrollIntoView call — a plain object would fail that check.
const mockScrollIntoView = vi.fn();
let mockChipEl: HTMLElement;

beforeEach(() => {
  mockScrollIntoView.mockClear();

  // Create a real HTMLElement + override scrollIntoView with our mock.
  mockChipEl = document.createElement('div');
  mockChipEl.scrollIntoView = mockScrollIntoView;

  // Mock document.querySelector to return our fake chip element.
  // Tests can override this per-test via vi.spyOn(...).mockImplementation(...).
  vi.spyOn(document, 'querySelector').mockImplementation(() => mockChipEl);

  // Mock window.setTimeout to execute synchronously so the classList.remove
  // call inside the setTimeout callback fires immediately during the test.
  vi.spyOn(window, 'setTimeout').mockImplementation((cb: TimerHandler) => {
    // Execute the callback synchronously. Type cast to satisfy TypeScript —
    // the real setTimeout returns a number, but our mock returns 0 for simplicity.
    if (typeof cb === 'function') {
      (cb as () => void)();
    }
    return 0 as unknown as ReturnType<typeof setTimeout>;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ───

describe('LeftPanelFavorites — Phase 5 (iter 136)', () => {
  describe('empty state', () => {
    it('renders empty placeholder when pinnedIds is empty', () => {
      const tokens = makeBeltTokens();
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={new Set()}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      // Header shows count 0.
      expect(screen.getByText(/⭐ Избранные: 0/)).toBeInTheDocument();
      // Empty-state placeholder.
      expect(screen.getByText('Нажмите ★ на аффиксе, чтобы добавить в избранное')).toBeInTheDocument();
      // No «Очистить» button (empty state has no clear button — see component).
      expect(screen.queryByRole('button', { name: /Очистить все избранные/ })).not.toBeInTheDocument();
    });

    it('renders the section even when pinnedIds is empty (so user can see the slot)', () => {
      render(
        <LeftPanelFavorites
          tokens={[]}
          pinnedIds={new Set()}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
        />,
      );
      // The panel renders with role="region".
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  describe('chip rendering', () => {
    it('renders one chip per favorited family group (NOT per token)', () => {
      const tokens = makeBeltTokens();
      // Pin 2 tokens from 'Резист' family + 2 from 'Урон' family.
      // Expected: 2 chips in favorites (one per family, NOT 4).
      const pinnedIds = new Set(['p1', 'p2', 's1', 's2']);
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      // Header shows count 2 (2 family groups, not 4 tokens).
      expect(screen.getByText(/⭐ Избранные: 2/)).toBeInTheDocument();

      // Each family displayText appears once.
      // The displayText comes from groupTokensByFamily — typically it's the
      // first member's rawText or a normalized family display text.
      // We check that the family key text appears somewhere in the document.
      // Note: family-grouper may produce displayText different from rawText,
      // so we check for the section structure instead.
      const chipLabels = screen.getAllByRole('button', { name: /Перейти к аффиксу/ });
      // 2 chip body labels (click-to-scroll).
      expect(chipLabels.length).toBe(2);

      // 2 ✗ unpin buttons (one per chip).
      const unpinButtons = screen.getAllByRole('button', { name: /Убрать из избранного/ });
      expect(unpinButtons.length).toBe(2);
    });

    it('renders affix-type badges (ПРЕФ / СУФ / ИМПЛ) prefixed to each chip', () => {
      const tokens = makeBeltTokens();
      // Pin one prefix family + one suffix family.
      const pinnedIds = new Set(['p1', 'p2', 's1', 's2']);
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      // ПРЕФ badge (from prefix family).
      expect(screen.getAllByText('ПРЕФ').length).toBeGreaterThan(0);
      // СУФ badge (from suffix family).
      expect(screen.getAllByText('СУФ').length).toBeGreaterThan(0);
      // No ИМПЛ badge (no implicit families in fixture).
      expect(screen.queryByText('ИМПЛ')).not.toBeInTheDocument();
    });

    it('renders ⭐ filled icon on each chip (visual indicator)', () => {
      const tokens = makeBeltTokens();
      const pinnedIds = new Set(['p1', 'p2']);
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );
      // ⭐ icon is rendered as text content (★), one per chip.
      const stars = screen.getAllByText('★');
      expect(stars.length).toBe(1); // 1 family = 1 star.
    });

    it('header shows correct count when multiple families are pinned', () => {
      const tokens = makeManyFamilyTokens(5);
      const pinnedIds = new Set(['p1', 'p2', 'p3', 'p4', 'p5']);
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );
      expect(screen.getByText(/⭐ Избранные: 5/)).toBeInTheDocument();
    });
  });

  describe('✗ unpin button', () => {
    it('calls onTogglePinned with family member IDs when ✗ clicked', () => {
      const tokens = makeBeltTokens();
      // Pin 'Резист' family (p1, p2).
      const pinnedIds = new Set(['p1', 'p2']);
      const onTogglePinned = vi.fn();
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={onTogglePinned}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      const unpinButton = screen.getByRole('button', { name: /Убрать из избранного/ });
      fireEvent.click(unpinButton);

      expect(onTogglePinned).toHaveBeenCalledTimes(1);
      // The callback should receive the member IDs of the family.
      // 'Резист' family has 2 members: p1, p2.
      const callArgs = onTogglePinned.mock.calls[0][0];
      expect(callArgs).toEqual(expect.arrayContaining(['p1', 'p2']));
      expect(callArgs.length).toBe(2);
    });
  });

  describe('«Очистить» button', () => {
    it('calls onClearPinned when «Очистить» link clicked', () => {
      const tokens = makeBeltTokens();
      const pinnedIds = new Set(['p1', 'p2']);
      const onClearPinned = vi.fn();
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={onClearPinned}
          category="belt"
        />,
      );

      const clearButton = screen.getByRole('button', { name: /Очистить все избранные/ });
      fireEvent.click(clearButton);

      expect(onClearPinned).toHaveBeenCalledTimes(1);
    });

    it('«Очистить» button is NOT rendered in empty state', () => {
      render(
        <LeftPanelFavorites
          tokens={makeBeltTokens()}
          pinnedIds={new Set()}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
        />,
      );
      expect(screen.queryByRole('button', { name: /Очистить все избранные/ })).not.toBeInTheDocument();
    });
  });

  describe('click-to-scroll', () => {
    it('calls document.querySelector with data-family-key selector when chip body clicked', () => {
      const tokens = makeBeltTokens();
      const pinnedIds = new Set(['p1', 'p2']);
      const querySelectorSpy = vi.spyOn(document, 'querySelector');
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      const chipLabel = screen.getByRole('button', { name: /Перейти к аффиксу/ });
      fireEvent.click(chipLabel);

      // document.querySelector was called with a selector containing
      // data-family-key attribute.
      expect(querySelectorSpy).toHaveBeenCalledTimes(1);
      const selector = querySelectorSpy.mock.calls[0][0];
      expect(selector).toContain('[data-family-key=');
    });

    it('calls scrollIntoView on the found chip element', () => {
      const tokens = makeBeltTokens();
      const pinnedIds = new Set(['p1', 'p2']);
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      const chipLabel = screen.getByRole('button', { name: /Перейти к аффиксу/ });
      fireEvent.click(chipLabel);

      expect(mockScrollIntoView).toHaveBeenCalledTimes(1);
      // scrollIntoView should be called with smooth behavior + center block.
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    });

    it('adds favorite-pulse CSS class for 2s highlight', () => {
      const tokens = makeBeltTokens();
      const pinnedIds = new Set(['p1', 'p2']);
      // Spy on the mockChipEl's classList methods (real DOMTokenList).
      const classListAddSpy = vi.spyOn(mockChipEl.classList, 'add');
      const classListRemoveSpy = vi.spyOn(mockChipEl.classList, 'remove');
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      const chipLabel = screen.getByRole('button', { name: /Перейти к аффиксу/ });
      fireEvent.click(chipLabel);

      // classList.add was called with 'favorite-pulse'.
      expect(classListAddSpy).toHaveBeenCalledWith('favorite-pulse');
      // setTimeout was called with 2000ms (2s) — and our mock executes
      // synchronously, so classList.remove should also have been called.
      expect(classListRemoveSpy).toHaveBeenCalledWith('favorite-pulse');
    });

    it('degrades gracefully when chip is not in DOM (virtualized out)', () => {
      // Override querySelector to return null (chip not found).
      vi.spyOn(document, 'querySelector').mockImplementation(() => null);

      const tokens = makeBeltTokens();
      const pinnedIds = new Set(['p1', 'p2']);
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      const chipLabel = screen.getByRole('button', { name: /Перейти к аффиксу/ });
      // Click should NOT throw — degrades gracefully.
      expect(() => fireEvent.click(chipLabel)).not.toThrow();
      // scrollIntoView was NOT called (chip element was null).
      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });

    it('Enter key triggers scroll-to-mod (keyboard accessibility)', () => {
      const tokens = makeBeltTokens();
      const pinnedIds = new Set(['p1', 'p2']);
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      const chipLabel = screen.getByRole('button', { name: /Перейти к аффиксу/ });
      // Tab to focus, then press Enter.
      chipLabel.focus();
      fireEvent.keyDown(chipLabel, { key: 'Enter' });

      expect(mockScrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('Space key triggers scroll-to-mod (keyboard accessibility)', () => {
      const tokens = makeBeltTokens();
      const pinnedIds = new Set(['p1', 'p2']);
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      const chipLabel = screen.getByRole('button', { name: /Перейти к аффиксу/ });
      fireEvent.keyDown(chipLabel, { key: ' ' });

      expect(mockScrollIntoView).toHaveBeenCalledTimes(1);
    });
  });

  describe('category prop optional', () => {
    it('renders without category prop (defaults to C tier)', () => {
      const tokens = makeBeltTokens();
      const pinnedIds = new Set(['p1', 'p2']);
      // No category prop — should not throw.
      expect(() => {
        render(
          <LeftPanelFavorites
            tokens={tokens}
            pinnedIds={pinnedIds}
            onTogglePinned={vi.fn()}
            onClearPinned={vi.fn()}
          />,
        );
      }).not.toThrow();
      // Header shows count 1.
      expect(screen.getByText(/⭐ Избранные: 1/)).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('applies max-height 30vh + overflow-y-auto for internal scroll', () => {
      const tokens = makeManyFamilyTokens(10);
      const pinnedIds = new Set(tokens.map(t => t.id));
      render(
        <LeftPanelFavorites
          tokens={tokens}
          pinnedIds={pinnedIds}
          onTogglePinned={vi.fn()}
          onClearPinned={vi.fn()}
          category="belt"
        />,
      );

      // The chip list container has style="max-height: 30vh" + overflow-y-auto class.
      const chipList = screen.getByRole('region').querySelector('.flex.flex-wrap.gap-1\\.5');
      expect(chipList).not.toBeNull();
      expect(chipList?.getAttribute('style')).toContain('max-height: 30vh');
      expect(chipList?.className).toContain('overflow-y-auto');
    });
  });
});
