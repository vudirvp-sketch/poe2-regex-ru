/**
 * AtlasNodeList — Flat checkbox list of atlas-tree passive nodes.
 *
 * iter 176 — NEW. Distinct from `ModList` / `VirtualizedModList`:
 *   - `VirtualizedModList` is tightly coupled to `GameToken` (ranges,
 *     familyKey, affix type, gender forms, L1/L2/L3 hierarchy). Wrapping it
 *     would require mock fields → semantic noise and high regression risk.
 *   - 75 nodes total (35 + 40) is small enough that virtualization is not
 *     needed for performance — a simple flat list with substring search
 *     suffices.
 *
 * ## Layout
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ [search box: filter by name or description]   N of M nodes   │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ ☐  [icon] Служитель Тьмы                                     │
 *   │           20% увеличение количества даров                    │
 *   │           Восстанавливает 5% здоровья при убийстве           │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ ☑  [icon] Хранитель духа                                     │
 *   │           +10 к интеллекту                                    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Each row is a labelled checkbox. Description text is muted and small —
 * readable but visually secondary to the name. Multi-line descriptions
 * (joined with `\n` in the data) are rendered as separate `<div>` lines.
 *
 * ## Selection state
 *
 * Owned by the parent page (controlled component). The parent passes a
 * `Set<string>` of selected node ids and an `onToggle(id)` callback. The list
 * never stores selection itself — keeps the page-level state in sync with
 * the regex builder.
 */
import React, { useMemo, useState, useCallback } from 'react';
import type { AtlasNodeToken } from '@shared/types';
import { t } from '@shared/i18n';

interface AtlasNodeListProps {
  /** All nodes for the currently-selected jewel (already pre-filtered by parent). */
  nodes: AtlasNodeToken[];
  /** Set of selected node ids (controlled). */
  selectedIds: Set<string>;
  /** Toggle one node's selection by id. */
  onToggle: (id: string) => void;
  /** Optional: select-all / clear-all handler (rendered as small buttons). */
  onSelectAll?: () => void;
  onClearAll?: () => void;
}

/** Highlight matching substring inside text. Returns React nodes. */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      out.push(<span key={`h${key}`}>{text.slice(i)}</span>);
      break;
    }
    if (idx > i) {
      out.push(<span key={`h${key}`}>{text.slice(i, idx)}</span>);
      key += 1;
    }
    out.push(
      <mark key={`m${key}`} className="atlas-node-hit">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    key += 1;
    i = idx + q.length;
  }
  return out;
}

export function AtlasNodeList({
  nodes,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: AtlasNodeListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => {
      if (n.name.ru.toLowerCase().includes(q)) return true;
      if (n.description.ru.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [nodes, search]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    [],
  );

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder={t('timeless_jewel.search_placeholder')}
          aria-label={t('timeless_jewel.search_placeholder')}
          className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-surface border border-edge rounded text-bright placeholder:text-muted focus:outline-none focus:border-accent-amber"
        />
        <span className="text-xs text-dim whitespace-nowrap">
          {filtered.length}/{nodes.length}
        </span>
        {onSelectAll && (
          <button
            type="button"
            onClick={onSelectAll}
            className="px-2 py-1 text-xs rounded bg-surface border border-edge text-soft hover:text-bright hover:border-edge-strong transition-colors"
          >
            {t('timeless_jewel.select_all')}
          </button>
        )}
        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            className="px-2 py-1 text-xs rounded bg-surface border border-edge text-soft hover:text-bright hover:border-edge-strong transition-colors"
          >
            {t('timeless_jewel.clear_all')}
          </button>
        )}
      </div>

      {/* List */}
      <ul
        className="flex flex-col gap-0.5 max-h-[60vh] overflow-y-auto pr-1 atlas-node-list"
        role="listbox"
        aria-label={t('timeless_jewel.list_aria')}
      >
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted text-center">
            {t('timeless_jewel.no_results')}
          </li>
        )}
        {filtered.map((node) => {
          const isSelected = selectedIds.has(node.id);
          const descLines = node.description.ru.split('\n').filter(Boolean);
          return (
            <li
              key={node.id}
              className={`flex gap-2 items-start px-2 py-1.5 rounded border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-raised border-accent-amber/60'
                  : 'bg-surface border-edge hover:border-edge-strong hover:bg-chip-hover'
              }`}
            >
              <label className="flex gap-2 items-start flex-1 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(node.id)}
                  className="mt-0.5 accent-amber-500 cursor-pointer"
                  aria-label={node.name.ru}
                />
                {node.iconUrl && (
                  <img
                    src={node.iconUrl}
                    alt=""
                    loading="lazy"
                    width={28}
                    height={28}
                    className="flex-shrink-0 object-contain atlas-node-icon"
                  />
                )}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-medium text-bright leading-tight">
                    {highlightMatch(node.name.ru, search.trim())}
                  </span>
                  {descLines.length > 0 && (
                    <div className="flex flex-col gap-0">
                      {descLines.map((line, i) => (
                        <span
                          key={i}
                          className="text-[12px] text-dim leading-tight"
                        >
                          {highlightMatch(line, search.trim())}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
