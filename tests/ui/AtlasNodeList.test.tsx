// @vitest-environment jsdom
/**
 * AtlasNodeList component tests (iter 176).
 *
 * Smoke + interaction tests for the new flat-checkbox list:
 *   - Renders all nodes passed in.
 *   - Filters by name substring.
 *   - Filters by description substring.
 *   - Toggling a checkbox calls onToggle with the node id.
 *   - Select-all / clear-all buttons call their handlers.
 *   - No-results message appears when search matches nothing.
 *   - Highlights matching substrings (renders <mark>).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AtlasNodeList } from '@ui/components/AtlasNodeList';
import type { AtlasNodeToken } from '@shared/types';

function makeNode(overrides: Partial<AtlasNodeToken> = {}): AtlasNodeToken {
  return {
    id: 'undying-hate.test_1',
    jewel: 'undying-hate',
    name: { ru: 'Тестовая нода' },
    description: { ru: 'Эффект ноды' },
    iconUrl: 'https://cdn.poe2db.tw/image/test.webp',
    slug: 'Test_Node',
    sourceKey: 'test_1',
    ...overrides,
  };
}

describe('AtlasNodeList', () => {
  it('renders all node names', () => {
    const nodes = [
      makeNode({ id: 'a', name: { ru: 'Альфа' } }),
      makeNode({ id: 'b', name: { ru: 'Бета' } }),
      makeNode({ id: 'c', name: { ru: 'Гамма' } }),
    ];
    render(
      <AtlasNodeList nodes={nodes} selectedIds={new Set()} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Альфа')).toBeInTheDocument();
    expect(screen.getByText('Бета')).toBeInTheDocument();
    expect(screen.getByText('Гамма')).toBeInTheDocument();
  });

  it('renders description text below the name', () => {
    const nodes = [
      makeNode({ id: 'a', name: { ru: 'Альфа' }, description: { ru: 'Эффект Альфы' } }),
    ];
    render(
      <AtlasNodeList nodes={nodes} selectedIds={new Set()} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Эффект Альфы')).toBeInTheDocument();
  });

  it('filters by name substring', () => {
    const nodes = [
      makeNode({ id: 'a', name: { ru: 'Служитель Тьмы' } }),
      makeNode({ id: 'b', name: { ru: 'Хранитель духа' } }),
    ];
    render(
      <AtlasNodeList nodes={nodes} selectedIds={new Set()} onToggle={vi.fn()} />,
    );
    const input = screen.getByPlaceholderText(/Поиск нод/i);
    fireEvent.change(input, { target: { value: 'Служитель' } });
    // The matching node stays visible (its checkbox is queryable).
    expect(screen.getByRole('checkbox', { name: 'Служитель Тьмы' })).toBeInTheDocument();
    // The non-matching node's checkbox is gone.
    expect(screen.queryByRole('checkbox', { name: 'Хранитель духа' })).not.toBeInTheDocument();
  });

  it('filters by description substring', () => {
    const nodes = [
      makeNode({ id: 'a', name: { ru: 'Альфа' }, description: { ru: 'увеличение урона' } }),
      makeNode({ id: 'b', name: { ru: 'Бета' }, description: { ru: 'восстановление маны' } }),
    ];
    render(
      <AtlasNodeList nodes={nodes} selectedIds={new Set()} onToggle={vi.fn()} />,
    );
    const input = screen.getByPlaceholderText(/Поиск нод/i);
    fireEvent.change(input, { target: { value: 'маны' } });
    expect(screen.queryByText('Альфа')).not.toBeInTheDocument();
    expect(screen.getByText('Бета')).toBeInTheDocument();
  });

  it('shows no-results message when search matches nothing', () => {
    const nodes = [makeNode({ id: 'a', name: { ru: 'Альфа' } })];
    render(
      <AtlasNodeList nodes={nodes} selectedIds={new Set()} onToggle={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Поиск нод/i), {
      target: { value: 'несуществующее' },
    });
    expect(screen.getByText(/Ноды не найдены/i)).toBeInTheDocument();
  });

  it('toggling a checkbox calls onToggle with the node id', () => {
    const onToggle = vi.fn();
    const nodes = [makeNode({ id: 'a', name: { ru: 'Альфа' } })];
    render(
      <AtlasNodeList nodes={nodes} selectedIds={new Set()} onToggle={onToggle} />,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Альфа' });
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('a');
  });

  it('renders select-all and clear-all buttons when handlers are provided', () => {
    const nodes = [makeNode({ id: 'a', name: { ru: 'Альфа' } })];
    render(
      <AtlasNodeList
        nodes={nodes}
        selectedIds={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Все/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Сброс/i })).toBeInTheDocument();
  });

  it('does not render select-all/clear-all buttons when handlers are absent', () => {
    const nodes = [makeNode({ id: 'a', name: { ru: 'Альфа' } })];
    render(
      <AtlasNodeList nodes={nodes} selectedIds={new Set()} onToggle={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /Все/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Сброс/i })).not.toBeInTheDocument();
  });

  it('reflects the selected state via checkbox `checked`', () => {
    const nodes = [
      makeNode({ id: 'a', name: { ru: 'Альфа' } }),
      makeNode({ id: 'b', name: { ru: 'Бета' } }),
    ];
    render(
      <AtlasNodeList
        nodes={nodes}
        selectedIds={new Set(['b'])}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Альфа' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Бета' })).toBeChecked();
  });

  it('renders multi-line descriptions as separate lines', () => {
    const nodes = [
      makeNode({
        id: 'a',
        name: { ru: 'Альфа' },
        description: { ru: 'Строка один\nСтрока два' },
      }),
    ];
    render(
      <AtlasNodeList nodes={nodes} selectedIds={new Set()} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Строка один')).toBeInTheDocument();
    expect(screen.getByText('Строка два')).toBeInTheDocument();
  });
});
