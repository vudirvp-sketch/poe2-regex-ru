/**
 * AtlasSelectedBasket — iter 183 — NEW.
 *
 * Minimal selected-basket for the Timeless Jewel page. Renders the user's
 * selected atlas nodes as compact chips above RegexOutput (mirrors the
 * shape/role of `SelectedBasket.tsx` on item-category pages, but without
 * family grouping / affix badges — Atlas nodes have no `familyKey` or
 * `affix` type, so each chip = one selected node).
 *
 * ## Why a separate component (not reusing SelectedBasket)
 *
 *   `SelectedBasket` is tightly coupled to `GameToken` (ranges, familyKey,
 *   affix type, groupTokensByFamily). Wrapping it would require mock fields
 *   → semantic noise + high regression risk (mirrors the same reason
 *   `AtlasNodeList` is separate from `ModList` — see AGENT_NAVIGATION.md
 *   pitfall #28). A 60-line dedicated component keeps the Atlas pipeline
 *   self-contained.
 *
 * ## Layout
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ Выбрано: N нод              Очистить все     │
 *   │ ┌─────────────┐ ┌─────────────┐ ┌─────────┐  │
 *   │ │ Служитель ✗ │ │ Хранитель ✗ │ +N ещё  │  │
 *   │ └─────────────┘ └─────────────┘ └─────────┘  │
 *   └──────────────────────────────────────────────┘
 *
 *  - Empty state: «Выберите ноды» placeholder (no clear button).
 *  - Cap = `SELECTED_BASKET_CAP` (20) — matches item-page basket.
 *  - Click on a chip → calls `onToggle(id)` (deselects that node).
 *  - «Очистить все» link → calls `onClear()`.
 *  - Max-height 30vh with internal scroll (matches item-page basket).
 */
import React, { useState, useMemo } from 'react';
import type { AtlasNodeToken } from '@shared/types';
import { t } from '@shared/i18n';
import { SELECTED_BASKET_CAP } from '@shared/constants';

interface AtlasSelectedBasketProps {
  /** All nodes for the currently-selected jewel (parent pre-filters by jewel).
   *  Used to look up node names by id — ids without a matching node are
   *  rendered with a fallback «unknown» label (defensive). */
  nodes: AtlasNodeToken[];
  /** Set of selected node ids (controlled by parent). */
  selectedIds: Set<string>;
  /** Toggle one node's selection by id (called when user clicks a chip). */
  onToggle: (id: string) => void;
  /** Clear all selections (called when user clicks «Очистить все»). */
  onClear: () => void;
}

export const AtlasSelectedBasket: React.FC<AtlasSelectedBasketProps> = ({
  nodes,
  selectedIds,
  onToggle,
  onClear,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Build a stable id → name map for O(1) chip lookups.
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) m.set(n.id, n.name.ru);
    return m;
  }, [nodes]);

  // Filter to selected nodes only, preserving insertion order of `selectedIds`.
  // (Set iteration is insertion-order in JS — matches user's click sequence.)
  const selectedEntries = useMemo(() => {
    if (selectedIds.size === 0) return [] as Array<{ id: string; name: string }>;
    const out: Array<{ id: string; name: string }> = [];
    for (const id of selectedIds) {
      const name = nameById.get(id);
      if (name) {
        out.push({ id, name });
      }
      // Defensive: ids without a matching node (e.g., URL had a stale id
      // from a previous jewel selection) are silently dropped — no chip
      // rendered. The parent's `handleJewelChange` already clears the
      // selection on jewel switch, so this is just belt-and-suspenders.
    }
    return out;
  }, [selectedIds, nameById]);

  const total = selectedEntries.length;

  // ─── Empty state ───
  if (total === 0) {
    return (
      <div
        className="bg-panel border border-edge-panel rounded p-3"
        role="region"
        aria-label={t('timeless_jewel.basket_title').replace('{n}', '0')}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[13px] font-semibold text-bright">
            {t('timeless_jewel.basket_title').replace('{n}', '0')}
          </span>
        </div>
        <div className="text-[12px] text-dim italic">
          {t('timeless_jewel.basket_empty')}
        </div>
      </div>
    );
  }

  // ─── Slice to cap ───
  const showMore = !expanded && total > SELECTED_BASKET_CAP;
  const showCollapse = expanded && total > SELECTED_BASKET_CAP;
  const visible = expanded || total <= SELECTED_BASKET_CAP
    ? selectedEntries
    : selectedEntries.slice(0, SELECTED_BASKET_CAP);
  const hiddenCount = Math.max(0, total - SELECTED_BASKET_CAP);

  return (
    <div
      className="bg-panel border border-edge-panel rounded p-3 flex flex-col gap-2.5"
      role="region"
      aria-label={t('timeless_jewel.basket_title').replace('{n}', String(total))}
    >
      {/* Header: count + clear-all */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-bright">
          {t('timeless_jewel.basket_title').replace('{n}', String(total))}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] text-accent-red hover:text-bright hover:underline transition-colors"
          aria-label={t('timeless_jewel.basket_clear_aria')}
        >
          {t('timeless_jewel.basket_clear')}
        </button>
      </div>

      {/* Chip list */}
      <div
        className="flex flex-wrap gap-1.5 overflow-y-auto"
        style={{ maxHeight: '30vh' }}
      >
        {visible.map(({ id, name }) => (
          <div
            key={id}
            role="button"
            tabIndex={0}
            onClick={() => onToggle(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle(id);
              }
            }}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[12px] bg-chip border border-edge hover:opacity-80 transition-opacity cursor-pointer"
            aria-label={`${name} — ${t('timeless_jewel.basket_unselect_aria')}`}
            title={`${name} — ${t('timeless_jewel.basket_unselect_aria')}`}
          >
            <span className="text-bright">{name}</span>
            <span
              className="text-[12px] font-bold shrink-0 text-muted"
              aria-hidden="true"
            >
              ✗
            </span>
          </div>
        ))}

        {/* «+N ещё» expander */}
        {showMore && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center px-2.5 py-1 text-[12px] text-soft bg-raised border border-edge rounded hover:bg-chip-hover transition-colors"
            aria-label={t('basket.more_aria').replace('{n}', String(hiddenCount))}
          >
            {t('basket.more').replace('{n}', String(hiddenCount))}
          </button>
        )}

        {/* «свернуть» button */}
        {showCollapse && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center px-2.5 py-1 text-[12px] text-soft bg-raised border border-edge rounded hover:bg-chip-hover transition-colors"
            aria-label={t('basket.collapse_aria')}
          >
            {t('basket.collapse')}
          </button>
        )}
      </div>
    </div>
  );
};
