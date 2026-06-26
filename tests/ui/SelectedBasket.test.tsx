// @vitest-environment jsdom
/**
 * React component tests for SelectedBasket (Phase 3, iter 135).
 *
 * Tests focus on the new right-aside basket component:
 *   - Empty state: «Выберите аффиксы» placeholder when selectedIds is empty.
 *   - Renders one chip per selected family group (NOT per token).
 *   - Affix-type badge (ПРЕФ / СУФ / ИМПЛ) prefixed to each chip.
 *   - «Очистить все» link calls onClearSelections.
 *   - Click on a basket chip calls onToggleTokens with that family's member IDs.
 *   - Cap = SELECTED_BASKET_CAP (20). When selection > cap, only first 20 render
 *     + «+N ещё» expander. Clicking expander reveals all + «свернуть» button.
 *   - Header shows «Выбрано: N афф.» with correct count.
 *
 * Fixtures mirror tests/ui/ModList.test.tsx patterns (makeToken helper).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectedBasket } from '@ui/components/SelectedBasket';
import { SELECTED_BASKET_CAP } from '@shared/constants';
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

/** 8 tokens: 2 prefix + 2 suffix families, 2 members each. Used for basic
 *  render tests. Family groups: 'Резист' (2 prefix), 'Характеристики' (2 prefix),
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
 *  each family produces exactly one chip in the basket. */
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

// ─── Tests ───

describe('SelectedBasket — Phase 3 (iter 135)', () => {
  describe('empty state', () => {
    it('renders empty placeholder when selectedIds is empty', () => {
      const tokens = makeBeltTokens();
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={new Set()}
          onToggleTokens={vi.fn()}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      // Header shows count 0.
      expect(screen.getByText(/Выбрано: 0/)).toBeInTheDocument();
      // Empty-state placeholder.
      expect(screen.getByText('Выберите аффиксы')).toBeInTheDocument();
      // No «Очистить все» button (empty state has no clear button — see component).
      expect(screen.queryByRole('button', { name: /Очистить все/ })).not.toBeInTheDocument();
    });
  });

  describe('rendering selected chips', () => {
    it('renders one chip per selected family (NOT per token)', () => {
      const tokens = makeBeltTokens();
      // Select 1 token from each of 4 families → 4 family chips, not 4 token chips.
      const selectedIds = new Set(['p1', 'p3', 's1', 's3']);
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={selectedIds}
          onToggleTokens={vi.fn()}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      // Header shows count 4 (4 family groups).
      expect(screen.getByText(/Выбрано: 4/)).toBeInTheDocument();
      // 4 family chips render (displayText is the familyKey template).
      // Note: FilterChip's displayText comes from family-grouper; for these
      // simple test tokens, the displayText matches the familyKey.
      expect(screen.getByText('Резист')).toBeInTheDocument();
      expect(screen.getByText('Характеристики')).toBeInTheDocument();
      expect(screen.getByText('Урон')).toBeInTheDocument();
      expect(screen.getByText('Жизнь')).toBeInTheDocument();
    });

    it('renders affix-type badge (ПРЕФ / СУФ) on each chip', () => {
      const tokens = makeBeltTokens();
      const selectedIds = new Set(['p1', 's1']);
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={selectedIds}
          onToggleTokens={vi.fn()}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      // 1 prefix chip + 1 suffix chip → 2 affix badges.
      const prefixBadges = screen.getAllByText('ПРЕФ');
      const suffixBadges = screen.getAllByText('СУФ');
      expect(prefixBadges).toHaveLength(1);
      expect(suffixBadges).toHaveLength(1);
    });

    it('renders ИМПЛ badge for implicit family', () => {
      const tokens = [
        makeToken('i1', { affix: 'implicit', familyKey: { ru: 'Имплисет 1' }, rawText: { ru: 'имплисет текст' } }),
      ];
      const selectedIds = new Set(['i1']);
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={selectedIds}
          onToggleTokens={vi.fn()}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      expect(screen.getByText('ИМПЛ')).toBeInTheDocument();
    });
  });

  describe('click handlers', () => {
    it('«Очистить все» button calls onClearSelections', () => {
      const tokens = makeBeltTokens();
      const onClearSelections = vi.fn();
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={new Set(['p1'])}
          onToggleTokens={vi.fn()}
          onClearSelections={onClearSelections}
          category="belt"
        />,
      );

      const clearBtn = screen.getByRole('button', { name: 'Очистить все выбранные аффиксы' });
      fireEvent.click(clearBtn);
      expect(onClearSelections).toHaveBeenCalledTimes(1);
    });

    it('click on a basket chip calls onToggleTokens with that family\'s member IDs', () => {
      const tokens = makeBeltTokens();
      const onToggleTokens = vi.fn();
      // Family 'Резист' has tokens p1 + p2.
      const selectedIds = new Set(['p1', 'p2', 'p3']);
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={selectedIds}
          onToggleTokens={onToggleTokens}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      // Click the «Резист» chip — should call onToggleTokens with ['p1', 'p2'].
      // The chip has role="button" with aria-label containing the displayText.
      const chip = screen.getByRole('button', { name: /Резист — Снять выделение/ });
      fireEvent.click(chip);
      expect(onToggleTokens).toHaveBeenCalledWith(['p1', 'p2']);
    });

    it('Enter key on a focused basket chip triggers onToggleTokens', () => {
      const tokens = makeBeltTokens();
      const onToggleTokens = vi.fn();
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={new Set(['p1', 'p2'])}
          onToggleTokens={onToggleTokens}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      const chip = screen.getByRole('button', { name: /Резист — Снять выделение/ });
      chip.focus();
      fireEvent.keyDown(chip, { key: 'Enter' });
      expect(onToggleTokens).toHaveBeenCalledWith(['p1', 'p2']);
    });
  });

  describe('cap = SELECTED_BASKET_CAP (20)', () => {
    it('renders all chips when count ≤ cap', () => {
      const count = SELECTED_BASKET_CAP; // exactly 20
      const tokens = makeManyFamilyTokens(count);
      const selectedIds = new Set(tokens.map(t => t.id));
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={selectedIds}
          onToggleTokens={vi.fn()}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      // Header shows count = cap.
      expect(screen.getByText(new RegExp(`Выбрано: ${count}`))).toBeInTheDocument();
      // All 20 chips render. Use a broad regex + getAllByRole to count —
      // avoids the alphabetical-sort gotcha (localeCompare sorts "Семейство 1"
      // before "Семейство 10" before "Семейство 2", so per-index getByRole
      // checks would be misleading).
      const allChips = screen.getAllByRole('button', { name: /^Семейство \d+ — Снять выделение$/ });
      expect(allChips).toHaveLength(count);
      // No «+N ещё» / «свернуть» buttons.
      expect(screen.queryByRole('button', { name: /Развернуть оставшиеся/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Свернуть оставшиеся/ })).not.toBeInTheDocument();
    });

    it('truncates to cap and shows «+N ещё» when count > cap', () => {
      const count = SELECTED_BASKET_CAP + 5; // 25 → 20 visible + 5 hidden
      const tokens = makeManyFamilyTokens(count);
      const selectedIds = new Set(tokens.map(t => t.id));
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={selectedIds}
          onToggleTokens={vi.fn()}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      // Header shows total count = 25.
      expect(screen.getByText(new RegExp(`Выбрано: ${count}`))).toBeInTheDocument();
      // Exactly 20 chips render (the cap), regardless of which 20 the
      // alphabetical sort picks.
      const visibleChips = screen.getAllByRole('button', { name: /^Семейство \d+ — Снять выделение$/ });
      expect(visibleChips).toHaveLength(SELECTED_BASKET_CAP);
      // «+5 ещё» expander renders.
      expect(screen.getByRole('button', { name: 'Развернуть оставшиеся 5 выбранных аффиксов' })).toBeInTheDocument();
    });

    it('clicking «+N ещё» reveals all chips + shows «свернуть» button', () => {
      const count = SELECTED_BASKET_CAP + 3; // 23 → 20 visible + 3 hidden
      const tokens = makeManyFamilyTokens(count);
      const selectedIds = new Set(tokens.map(t => t.id));
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={selectedIds}
          onToggleTokens={vi.fn()}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      // Click «+3 ещё».
      const expandBtn = screen.getByRole('button', { name: 'Развернуть оставшиеся 3 выбранных аффиксов' });
      fireEvent.click(expandBtn);

      // Now all 23 chips render.
      const allChips = screen.getAllByRole('button', { name: /^Семейство \d+ — Снять выделение$/ });
      expect(allChips).toHaveLength(count);
      // «+N ещё» button gone, «свернуть» button appears.
      expect(screen.queryByRole('button', { name: /Развернуть оставшиеся/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Свернуть оставшиеся выбранные аффиксы' })).toBeInTheDocument();
    });

    it('clicking «свернуть» (after expansion) re-truncates to cap', () => {
      const count = SELECTED_BASKET_CAP + 2; // 22 → 20 visible + 2 hidden
      const tokens = makeManyFamilyTokens(count);
      const selectedIds = new Set(tokens.map(t => t.id));
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={selectedIds}
          onToggleTokens={vi.fn()}
          onClearSelections={vi.fn()}
          category="belt"
        />,
      );

      // Expand → all 22 visible.
      fireEvent.click(screen.getByRole('button', { name: /Развернуть оставшиеся/ }));
      const allExpanded = screen.getAllByRole('button', { name: /^Семейство \d+ — Снять выделение$/ });
      expect(allExpanded).toHaveLength(count);

      // Collapse → back to 20 visible.
      fireEvent.click(screen.getByRole('button', { name: 'Свернуть оставшиеся выбранные аффиксы' }));
      const allCollapsed = screen.getAllByRole('button', { name: /^Семейство \d+ — Снять выделение$/ });
      expect(allCollapsed).toHaveLength(SELECTED_BASKET_CAP);
      expect(screen.getByRole('button', { name: /Развернуть оставшиеся/ })).toBeInTheDocument();
    });
  });

  describe('backward compat', () => {
    it('category prop is optional — defaults to undefined (priority tier falls back to C)', () => {
      const tokens = makeBeltTokens();
      render(
        <SelectedBasket
          tokens={tokens}
          selectedIds={new Set(['p1'])}
          onToggleTokens={vi.fn()}
          onClearSelections={vi.fn()}
          // category omitted
        />,
      );

      // Renders without crashing; one chip visible.
      expect(screen.getByText('Резист')).toBeInTheDocument();
    });
  });
});
