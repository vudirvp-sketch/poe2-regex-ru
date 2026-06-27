// @vitest-environment jsdom
/**
 * React component tests for StatusPanel (iter 140, KI#22 rewrite).
 *
 * iter 140 (KI#22): StatusPanel no longer renders the main summary panel
 * («Выбрано: N аффикс(ов)» + truncated token list). That was redundant with
 * SelectedBasket. StatusPanel now renders ONLY badges + alerts.
 *
 * Tests:
 *   - Returns null when no badges AND no alerts (even if wantTokens passed).
 *   - Renders badges row when badges provided.
 *   - Renders alerts when alerts provided.
 *   - Renders BOTH badges + alerts when both provided.
 *   - Backward compat: wantTokens/excludeTokens/allActiveTokens props accepted
 *     but ignored.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPanel } from '@ui/components/StatusPanel';
import type { GameToken } from '@shared/types';

// ─── Test fixtures ───

function makeToken(id: string): GameToken {
  return {
    id,
    category: 'belt',
    origin: 'normal',
    rawText: { ru: `Текст ${id}` },
    rawTextTemplate: { ru: '## текст' },
    regex: { ru: `текст.*${id}` },
    familyKey: { ru: 'семейство' },
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
  };
}

describe('StatusPanel — iter 140 (KI#22) badges + alerts only', () => {
  it('returns null when no badges AND no alerts (even with wantTokens)', () => {
    const tokens = [makeToken('p1'), makeToken('p2')];
    const { container } = render(
      <StatusPanel
        wantTokens={tokens}
        excludeTokens={[]}
        allActiveTokens={tokens}
      />
    );
    // Nothing renders — summary panel is gone, no badges/alerts provided.
    expect(container.firstChild).toBeNull();
  });

  it('renders badges row when badges provided', () => {
    const { container } = render(
      <StatusPanel
        badges={[
          <span key="b1" data-testid="badge-corrupted">Осквернён</span>,
          <span key="b2" data-testid="badge-delirious">Делириум</span>,
        ]}
      />
    );
    // Badges panel renders.
    expect(screen.getByTestId('badge-corrupted')).toBeInTheDocument();
    expect(screen.getByTestId('badge-delirious')).toBeInTheDocument();
    // The badges panel has the bg-panel class.
    const panel = container.querySelector('.bg-panel');
    expect(panel).not.toBeNull();
  });

  it('renders alerts when alerts provided', () => {
    render(
      <StatusPanel
        alerts={[
          <div key="a1" data-testid="alert-jewel" className="alert-warning">
            Скрытые моды активны
          </div>,
        ]}
      />
    );
    expect(screen.getByTestId('alert-jewel')).toBeInTheDocument();
    expect(screen.getByText('Скрытые моды активны')).toBeInTheDocument();
  });

  it('renders BOTH badges + alerts when both provided', () => {
    render(
      <StatusPanel
        badges={[<span key="b1" data-testid="badge-1">Badge1</span>]}
        alerts={[<div key="a1" data-testid="alert-1">Alert1</div>]}
      />
    );
    expect(screen.getByTestId('badge-1')).toBeInTheDocument();
    expect(screen.getByTestId('alert-1')).toBeInTheDocument();
  });

  it('backward compat: wantTokens/excludeTokens/allActiveTokens accepted but ignored', () => {
    // Even when ALL legacy props are passed with non-empty values,
    // StatusPanel returns null when no badges/alerts — the summary panel
    // that previously rendered for these props is GONE (KI#22).
    const { container } = render(
      <StatusPanel
        wantTokens={[makeToken('p1'), makeToken('p2'), makeToken('p3')]}
        excludeTokens={[makeToken('e1')]}
        allActiveTokens={[makeToken('p1'), makeToken('e1')]}
      />
    );
    expect(container.firstChild).toBeNull();
    // Specifically, no «Выбрано» text should render.
    expect(screen.queryByText(/Выбрано/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Включить/)).not.toBeInTheDocument();
  });

  it('returns null when badges=[] and alerts=[] explicitly', () => {
    const { container } = render(
      <StatusPanel badges={[]} alerts={[]} />
    );
    expect(container.firstChild).toBeNull();
  });
});
