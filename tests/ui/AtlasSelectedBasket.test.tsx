// @vitest-environment jsdom
/**
 * AtlasSelectedBasket component tests (iter 183).
 *
 * Smoke + interaction tests for the new atlas-node selected basket:
 *   - Empty state: «Выберите ноды» placeholder when selectedIds is empty.
 *   - Renders one chip per selected node (NOT family-grouped).
 *   - Header shows «Выбрано: N нод» with correct count.
 *   - «Очистить все» button calls onClear.
 *   - Click on a chip calls onToggle with that node's id.
 *   - Cap = SELECTED_BASKET_CAP (20). When selection > cap, only first 20
 *     render + «+N ещё» expander. Clicking expander reveals all + «свернуть».
 *   - Ids without a matching node are silently dropped (defensive).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AtlasSelectedBasket } from '@ui/components/AtlasSelectedBasket';
import { SELECTED_BASKET_CAP } from '@shared/constants';
import type { AtlasNodeToken } from '@shared/types';

// ─── Fixtures ───

function makeNode(overrides: Partial<AtlasNodeToken> = {}): AtlasNodeToken {
  return {
    id: 'undying-hate.test_1',
    jewel: 'undying-hate',
    name: { ru: 'Тестовая нода' },
    description: { ru: 'Эффект ноды' },
    iconUrl: 'icons/atlas-nodes/test.webp',
    slug: 'Test_Node',
    sourceKey: 'test_1',
    ...overrides,
  };
}

function makeNodes(count: number): AtlasNodeToken[] {
  const out: AtlasNodeToken[] = [];
  for (let i = 1; i <= count; i++) {
    out.push(makeNode({
      id: `node-${i}`,
      name: { ru: `Нода ${i}` },
    }));
  }
  return out;
}

// ─── Tests ───

describe('AtlasSelectedBasket — iter 183', () => {
  describe('empty state', () => {
    it('renders empty placeholder when selectedIds is empty', () => {
      const nodes = makeNodes(3);
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={new Set()}
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      // Header shows count 0.
      expect(screen.getByText(/Выбрано: 0 нод/)).toBeInTheDocument();
      // Empty-state placeholder.
      expect(screen.getByText('Выберите ноды из списка')).toBeInTheDocument();
      // No «Очистить все» button in empty state.
      expect(screen.queryByRole('button', { name: /Очистить все/ })).not.toBeInTheDocument();
    });
  });

  describe('non-empty state', () => {
    it('renders one chip per selected node', () => {
      const nodes = makeNodes(3);
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={new Set(['node-1', 'node-2', 'node-3'])}
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      // Header shows count 3.
      expect(screen.getByText(/Выбрано: 3 нод/)).toBeInTheDocument();
      // Each node name appears in a chip.
      expect(screen.getByText('Нода 1')).toBeInTheDocument();
      expect(screen.getByText('Нода 2')).toBeInTheDocument();
      expect(screen.getByText('Нода 3')).toBeInTheDocument();
    });

    it('renders «Очистить все» button when selectedIds is non-empty', () => {
      const nodes = makeNodes(2);
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={new Set(['node-1'])}
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /Очистить все/ })).toBeInTheDocument();
    });

    it('«Очистить все» button calls onClear', () => {
      const onClear = vi.fn();
      const nodes = makeNodes(2);
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={new Set(['node-1'])}
          onToggle={vi.fn()}
          onClear={onClear}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Очистить все/ }));
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('click on a chip calls onToggle with that node id', () => {
      const onToggle = vi.fn();
      const nodes = makeNodes(2);
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={new Set(['node-1', 'node-2'])}
          onToggle={onToggle}
          onClear={vi.fn()}
        />,
      );

      // Click on the chip for "Нода 2" — find by aria-label which contains
      // the node name + the unselect-aria text.
      const chip2 = screen.getByRole('button', { name: /Нода 2/ });
      fireEvent.click(chip2);
      expect(onToggle).toHaveBeenCalledWith('node-2');
    });

    it('keyboard: Enter on a chip calls onToggle', () => {
      const onToggle = vi.fn();
      const nodes = makeNodes(1);
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={new Set(['node-1'])}
          onToggle={onToggle}
          onClear={vi.fn()}
        />,
      );

      const chip = screen.getByRole('button', { name: /Нода 1/ });
      fireEvent.keyDown(chip, { key: 'Enter' });
      expect(onToggle).toHaveBeenCalledWith('node-1');
    });

    it('keyboard: Space on a chip calls onToggle', () => {
      const onToggle = vi.fn();
      const nodes = makeNodes(1);
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={new Set(['node-1'])}
          onToggle={onToggle}
          onClear={vi.fn()}
        />,
      );

      const chip = screen.getByRole('button', { name: /Нода 1/ });
      fireEvent.keyDown(chip, { key: ' ' });
      expect(onToggle).toHaveBeenCalledWith('node-1');
    });
  });

  describe('cap & expander', () => {
    it('renders all chips without expander when count <= SELECTED_BASKET_CAP', () => {
      const nodes = makeNodes(SELECTED_BASKET_CAP);
      const selectedIds = new Set(nodes.map((n) => n.id));
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={selectedIds}
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      // No «+N ещё» button.
      expect(screen.queryByRole('button', { name: /ещё/ })).not.toBeInTheDocument();
      // No «свернуть» button.
      expect(screen.queryByRole('button', { name: /свернуть/ })).not.toBeInTheDocument();
    });

    it('renders «+N ещё» expander when count > SELECTED_BASKET_CAP', () => {
      const total = SELECTED_BASKET_CAP + 5;
      const nodes = makeNodes(total);
      const selectedIds = new Set(nodes.map((n) => n.id));
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={selectedIds}
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      // «+5 ещё» button rendered (hiddenCount = total - cap = 5).
      expect(screen.getByRole('button', { name: /Развернуть оставшиеся 5/ })).toBeInTheDocument();
      // Last 5 chips NOT rendered (only first 20 visible).
      expect(screen.queryByText('Нода 21')).not.toBeInTheDocument();
      expect(screen.queryByText('Нода 25')).not.toBeInTheDocument();
      // First 20 chips ARE rendered.
      expect(screen.getByText('Нода 1')).toBeInTheDocument();
      expect(screen.getByText('Нода 20')).toBeInTheDocument();
    });

    it('clicking «+N ещё» reveals all chips + «свернуть» button', () => {
      const total = SELECTED_BASKET_CAP + 3;
      const nodes = makeNodes(total);
      const selectedIds = new Set(nodes.map((n) => n.id));
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={selectedIds}
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      // Click the expander.
      fireEvent.click(screen.getByRole('button', { name: /Развернуть оставшиеся 3/ }));

      // All chips now visible.
      expect(screen.getByText('Нода 23')).toBeInTheDocument();
      // «свернуть» button visible.
      expect(screen.getByRole('button', { name: /Свернуть оставшиеся/ })).toBeInTheDocument();
      // «+N ещё» button gone.
      expect(screen.queryByRole('button', { name: /Развернуть оставшиеся/ })).not.toBeInTheDocument();
    });

    it('clicking «свернуть» collapses back to cap', () => {
      const total = SELECTED_BASKET_CAP + 3;
      const nodes = makeNodes(total);
      const selectedIds = new Set(nodes.map((n) => n.id));
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={selectedIds}
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      // Expand.
      fireEvent.click(screen.getByRole('button', { name: /Развернуть оставшиеся 3/ }));
      expect(screen.getByText('Нода 23')).toBeInTheDocument();

      // Collapse.
      fireEvent.click(screen.getByRole('button', { name: /Свернуть оставшиеся/ }));
      expect(screen.queryByText('Нода 23')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Развернуть оставшиеся 3/ })).toBeInTheDocument();
    });
  });

  describe('defensive: stale ids', () => {
    it('silently drops ids without a matching node (no chip rendered)', () => {
      const nodes = makeNodes(2);
      // node-1 exists, stale-id does not.
      render(
        <AtlasSelectedBasket
          nodes={nodes}
          selectedIds={new Set(['node-1', 'stale-id-from-old-jewel'])}
          onToggle={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      // Header shows the FILTERED count (1) — only ids with a matching
      // node produce a chip. Stale ids from a previous jewel selection
      // are silently dropped, so the user only sees chips they can
      // actually interact with.
      expect(screen.getByText(/Выбрано: 1 нод/)).toBeInTheDocument();
      // Only the matching chip renders.
      expect(screen.getByText('Нода 1')).toBeInTheDocument();
      // No chip with the stale id text (it has no name to render).
      expect(screen.queryByText('stale-id-from-old-jewel')).not.toBeInTheDocument();
    });
  });
});
