/**
 * FavoritesIndicator — compact `★ N` badge for category page headers.
 *
 * Renders as a small amber-tinted button with the gold star icon. Hidden
 * when `pinnedIds.size === 0` (no favorites → no badge → no noise).
 *
 * iter 144 (KI#31 variant d): the badge is CLICKABLE. Clicking opens a
 * portal-based FavoritesQuickSelectPanel that lists all favorited families
 * for the current category page. Per user feedback (iter 143):
 *   «я это видел изначально как список "быстрого доступа", когда ты часто
 *    пользуешься одним и тем же набором аффиксов и хочешь просто в несколько
 *    кликов выбрать нужные из них».
 *
 * Layout: small inline button — ★ icon + label + count.
 *
 * Behaviour:
 * - Empty state (`pinnedIds.size === 0`) → returns `null` (renders nothing).
 * - Non-empty → renders `★ Избранные аффиксы: N` button with aria-label.
 * - Click → opens FavoritesQuickSelectPanel via createPortal.
 * - Escape / click-outside → panel closes.
 *
 * Accessibility:
 * - `aria-label` includes the count + "open panel" hint for screen readers.
 * - `★` glyph is `aria-hidden` (decorative) — the label conveys the meaning.
 * - `aria-haspopup="dialog"` + `aria-expanded` for screen readers.
 * - Panel is a `role="dialog"` with its own aria-label.
 *
 * Placement: page header — next to the mod count, on the right side.
 *   [icon] Category Title    N аффиксов  ★ Избранные: M
 */
import React, { useState, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@shared/i18n';
import type { CategoryData } from '@shared/types';
import type { TokenRangeOverride } from '@store/filter-store';
import { FavoritesQuickSelectPanel } from './FavoritesQuickSelectPanel';

// ─── Layout constants ──────────────────────────────────────────────────────

/** Vertical offset from trigger to panel (px). */
const TOP_OFFSET_PX = 22;
/** Horizontal margin from viewport edge (px). */
const EDGE_MARGIN_PX = 8;
/** Max panel width (px) — must match FavoritesQuickSelectPanel's constant. */
const PANEL_MAX_WIDTH_PX = 360;

interface FavoritesIndicatorProps {
  /** Favorited ("pinned") token IDs from filter-store. When the set is empty,
   *  the component returns `null` (no badge shown). */
  pinnedIds: Set<string>;
  /** iter 144 (KI#31 variant d): category data — passed through to the
   *  quick-select panel for filtering favorited families. When omitted,
   *  the badge is presentational-only (legacy behaviour, used in tests
   *  that don't need the panel functionality). */
  data?: CategoryData;
  /** iter 144 (KI#31 variant d): category ID — used as the localStorage
   *  key namespace for favorites ranges. */
  categoryId?: string;
  /** iter 144 (KI#31 variant d): per-token range overrides — passed through
   *  to the panel for pre-filling range inputs. */
  perTokenRanges?: Record<string, TokenRangeOverride>;
  /** iter 144 (KI#31 variant d): toggle selection for a family. */
  onToggleTokens?: (ids: string[]) => void;
  /** iter 144 (KI#31 variant d): toggle pinned state (remove from favorites). */
  onTogglePinned?: (id: string) => void;
  /** iter 144 (KI#31 variant d): set per-token range override. */
  onSetTokenRange?: (tokenId: string, range: TokenRangeOverride) => void;
}

/**
 * Render the compact favorites indicator. Returns `null` when `pinnedIds`
 * is empty — no favorites → no badge → no noise.
 *
 * iter 144 (KI#31 variant d): when `data` + `categoryId` + callbacks are
 * provided, the badge becomes clickable and opens the quick-select panel.
 * When any of these are omitted (legacy callers / tests), the badge is
 * presentational-only (preserves iter 140 behaviour).
 *
 * Usage (in any category page header):
 *   <FavoritesIndicator
 *     pinnedIds={pinnedIds}
 *     data={data}
 *     categoryId={categoryId}
 *     perTokenRanges={perTokenRanges}
 *     onToggleTokens={toggleTokens}
 *     onTogglePinned={togglePinned}
 *     onSetTokenRange={setTokenRange}
 *   />
 */
export const FavoritesIndicator: React.FC<FavoritesIndicatorProps> = ({
  pinnedIds,
  data,
  categoryId,
  perTokenRanges,
  onToggleTokens,
  onTogglePinned,
  onSetTokenRange,
}) => {
  const count = pinnedIds.size;
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const buttonId = useId();

  // Determine if the panel can be opened (all required props provided).
  // When false, the badge is presentational-only (legacy behaviour).
  // Computed unconditionally (before any early return) to satisfy the
  // React Hooks rules-of-hooks lint check.
  const panelEnabled = !!(data && categoryId && perTokenRanges && onToggleTokens && onTogglePinned && onSetTokenRange);

  /** Compute panel position from the trigger's bounding rect. Anchors the
   *  panel below the trigger's right edge, with viewport-edge clamping.
   *  Mirrors the positioning logic from Tooltip.tsx (iter 137 Phase 4). */
  const computeCoords = useCallback((): { top: number; left: number } => {
    const trigger = triggerRef.current;
    if (!trigger) return { top: 0, left: 0 };
    const rect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Anchor to the trigger's right edge — panel extends leftward.
    let left = rect.right - PANEL_MAX_WIDTH_PX;
    if (left < EDGE_MARGIN_PX) left = EDGE_MARGIN_PX;
    if (left + PANEL_MAX_WIDTH_PX > viewportW - EDGE_MARGIN_PX) {
      left = viewportW - EDGE_MARGIN_PX - PANEL_MAX_WIDTH_PX;
    }

    // Place below trigger by default. If trigger is in the bottom 25% of
    // the viewport, place above the trigger instead so it stays visible.
    let top: number;
    if (rect.bottom > viewportH * 0.75) {
      // Above: tooltip bottom aligns with trigger top - offset.
      top = rect.top - TOP_OFFSET_PX - 8;
    } else {
      // Below: tooltip top aligns with trigger bottom + small gap.
      top = rect.bottom + 6;
    }
    return { top, left };
  }, []);

  const openPanel = useCallback(() => {
    setCoords(computeCoords());
    setIsOpen(true);
  }, [computeCoords]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setCoords(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!panelEnabled) return; // presentational-only badge — no action.
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }, [panelEnabled, isOpen, openPanel, closePanel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      closePanel();
    }
  }, [isOpen, closePanel]);

  // Empty state — render nothing. Don't take up header space when user has
  // no favorites yet. The ⭐ button on FilterChip is still visible, so the
  // user can add favorites; once they do, this badge appears.
  //
  // NOTE: this early return must come AFTER all hook calls (useState,
  // useRef, useId, useCallback) to satisfy react-hooks/rules-of-hooks.
  if (count === 0) return null;

  const label = t('favorites.indicator_label').replace('{n}', String(count));
  const openAria = t('favorites.indicator_open_aria').replace('{n}', String(count));

  return (
    <>
      <button
        ref={triggerRef}
        id={buttonId}
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={panelEnabled ? openAria : label}
        title={panelEnabled ? openAria : label}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium bg-amber-900/30 border border-amber-700/40 text-accent-amber-soft ${panelEnabled ? 'cursor-pointer hover:bg-amber-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber' : 'cursor-default'}`}
      >
        <span aria-hidden="true" className="text-accent-amber-soft">★</span>
        <span>{label}</span>
      </button>
      {isOpen && panelEnabled && coords && data && categoryId && perTokenRanges && onToggleTokens && onTogglePinned && onSetTokenRange && createPortal(
        <FavoritesQuickSelectPanel
          pinnedIds={pinnedIds}
          data={data}
          categoryId={categoryId}
          perTokenRanges={perTokenRanges}
          onToggleTokens={onToggleTokens}
          onTogglePinned={onTogglePinned}
          onSetTokenRange={onSetTokenRange}
          onClose={closePanel}
          coords={coords}
        />,
        document.body,
      )}
    </>
  );
};

FavoritesIndicator.displayName = 'FavoritesIndicator';
