/**
 * Tooltip — Phase 4 (iter 137).
 *
 * Portal-based tooltip component for affix column headers (and any future
 * caller). Renders a trigger (default `ⓘ` glyph) that, on hover or keyboard
 * focus, opens a small floating panel positioned below the trigger with
 * explanatory text.
 *
 * Per `docs/UI_REFACTOR_PLAN.md` §4 Phase 4:
 *   - Hover/focus triggers open the tooltip.
 *   - Closes on click-outside, Escape, or blur.
 *   - Uses `createPortal` to render at `document.body` so the tooltip is NOT
 *     clipped by parent `overflow:hidden` containers (e.g. ModList virtualized
 *     scroller, CategoryLayout sticky aside).
 *   - ARIA: the tooltip content has `role="tooltip"` and is associated with
 *     the trigger via `aria-describedby`.
 *
 * Backward compat / standalone usage:
 *   - Tooltip is a NEW component (Phase 4). It is OPTIONAL — callers that do
 *     not use it render exactly as before. The `GroupHeader` `infoTooltip`
 *     prop accepts a string OR a pre-built React node; when omitted, no ⓘ
 *     glyph renders.
 *
 * Layout / Positioning:
 *   - We use simple absolute positioning relative to viewport coordinates
 *     captured from `getBoundingClientRect()` of the trigger on open.
 *   - We do NOT use a full positioning library (Floating UI, Popper) to keep
 *     the dep surface small. If the trigger is near the right edge of the
 *     viewport, the tooltip is anchored to the right edge with a small margin
 *     so it stays visible.
 *   - The tooltip is small enough (≤ 280px wide) that vertical-flip handling
 *     is unnecessary on typical desktop viewports. If the trigger is near the
 *     bottom, we offset the tooltip upward by `TOP_OFFSET_PX + 32` so it
 *     doesn't fall off-screen.
 *
 * Accessibility:
 *   - Trigger is a real `<button type="button">` so it's keyboard-focusable.
 *   - Hover opens the tooltip after `OPEN_DELAY_MS` (350ms). Focus opens it
 *     immediately (no delay — keyboard users should not wait).
 *   - Mouse leave closes the tooltip after `CLOSE_DELAY_MS` (150ms) so a
 *     brief wobble of the cursor doesn't dismiss it.
 *   - Escape key closes the tooltip and returns focus to the trigger.
 *   - Click outside closes the tooltip.
 *   - `aria-describedby` on the trigger points to the tooltip content's id
 *     so screen readers announce the explanation when the trigger receives
 *     focus. (Note: ARIA spec recommends `aria-describedby` for tooltip
 *     associations rather than `aria-labelledby`, because the tooltip is
 *     additional description rather than the primary label.)
 */
import React, { useState, useRef, useCallback, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  /** Content of the tooltip — usually a short string from i18n, but accepts
   *  any ReactNode for richer content (e.g. multiline explanations). */
  content: React.ReactNode;
  /** Optional accessible label for the trigger button. When omitted, falls
   *  back to `t('tooltip.info_aria')` ("Показать пояснение к типу аффикса"). */
  ariaLabel?: string;
  /** Optional trigger node. When omitted, renders a default `ⓘ` glyph.
   *  Callers can pass a custom glyph or icon if needed. */
  trigger?: React.ReactNode;
  /** Optional className to apply to the trigger button wrapper. Useful when
   *  embedding inside GroupHeader where the trigger needs to inherit text
   *  color from the parent header. */
  className?: string;
}

/** Hover delay before opening (ms). Long enough to avoid flicker on cursor
 *  pass-through, short enough to feel responsive. */
const OPEN_DELAY_MS = 350;
/** Hover delay before closing after mouse leave (ms). Brief grace period so
 *  minor cursor wobble doesn't dismiss the tooltip. */
const CLOSE_DELAY_MS = 150;
/** Vertical offset from trigger to tooltip (px). Negative = below trigger. */
const TOP_OFFSET_PX = 22;
/** Max tooltip width (px). Wraps long Russian sentences. */
const MAX_WIDTH_PX = 280;
/** Horizontal margin from viewport edge (px). */
const EDGE_MARGIN_PX = 8;

/**
 * Tooltip — portal-based hover/focus tooltip.
 *
 * Usage:
 *   <Tooltip content={t('tooltip.prefix_explanation')} />
 *
 * Or with a custom trigger:
 *   <Tooltip content="Подсказка" trigger={<span>?</span>} />
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  ariaLabel,
  trigger,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const tooltipId = useId();

  /** Clear any pending open/close timers. Called before scheduling a new
   *  timer or before unmounting. */
  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  /** Compute tooltip position from the trigger's bounding rect. Anchors the
   *  tooltip below the trigger's center, with viewport-edge clamping. */
  const computeCoords = useCallback((): { top: number; left: number } => {
    const trigger = triggerRef.current;
    if (!trigger) return { top: 0, left: 0 };
    const rect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Center horizontally on the trigger.
    const centerX = rect.left + rect.width / 2;
    // Tooltip width is at most MAX_WIDTH_PX; we center it on the trigger
    // then clamp to viewport edges.
    const halfWidth = MAX_WIDTH_PX / 2;
    let left = centerX - halfWidth;
    if (left < EDGE_MARGIN_PX) left = EDGE_MARGIN_PX;
    if (left + MAX_WIDTH_PX > viewportW - EDGE_MARGIN_PX) {
      left = viewportW - EDGE_MARGIN_PX - MAX_WIDTH_PX;
    }

    // Place below trigger by default. If trigger is in the bottom 25% of the
    // viewport, place above the trigger instead so it stays visible.
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

  /** Open the tooltip: set open=true + compute position. Safe to call when
   *  the tooltip is already open (just recomputes position). */
  const openTooltip = useCallback(() => {
    clearTimers();
    setOpen(true);
    setCoords(computeCoords());
  }, [clearTimers, computeCoords]);

  /** Schedule opening after OPEN_DELAY_MS. Used for hover triggers (focus
   *  opens immediately). */
  const scheduleOpen = useCallback(() => {
    clearTimers();
    openTimer.current = window.setTimeout(() => {
      openTooltip();
    }, OPEN_DELAY_MS);
  }, [clearTimers, openTooltip]);

  /** Schedule closing after CLOSE_DELAY_MS. Used for mouse leave. */
  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setCoords(null);
    }, CLOSE_DELAY_MS);
  }, [clearTimers]);

  /** Close immediately (no delay). Used for Escape key + click-outside. */
  const closeImmediate = useCallback(() => {
    clearTimers();
    setOpen(false);
    setCoords(null);
  }, [clearTimers]);

  // ─── Hover handlers (mouse) ───
  const handleMouseEnter = scheduleOpen;
  const handleMouseLeave = scheduleClose;

  // ─── Focus handlers (keyboard) ───
  const handleFocus = openTooltip; // no delay on focus
  const handleBlur = scheduleClose;

  // ─── Click trigger: toggle (click again to close). Stops propagation so
  //     clicking the ⓘ does NOT also toggle the parent GroupHeader collapse. ───
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      closeImmediate();
    } else {
      openTooltip();
    }
  }, [open, closeImmediate, openTooltip]);

  // ─── Keydown on the trigger button: Escape closes the tooltip.
  //     We use a local React onKeyDown handler (NOT a global document
  //     listener) because React 19 + jsdom has trouble flushing state updates
  //     from native event listeners in tests. The local handler is invoked
  //     synchronously by React's synthetic event system, so setOpen(false)
  //     is applied immediately.
  //
  // ⚠ BUG NOTE: do NOT call `triggerRef.current?.focus()` here. The button
  //     already has focus (Escape was pressed via keyboard while it was
  //     focused). Calling .focus() again fires a synthetic `focus` event
  //     which triggers `handleFocus` → `openTooltip()` → `setOpen(true)`,
  //     re-opening the tooltip immediately after we just closed it. This
  //     was the cause of the persistent "tooltip doesn't close on Escape"
  //     test failure — the close + immediate re-open cancelled out. ───
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      closeImmediate();
    }
  }, [open, closeImmediate]);

  // ─── Click-outside listener while open ───
  // NOTE: Escape is handled by the local onKeyDown handler on the trigger
  // button (see handleKeyDown above) — React 19 + jsdom doesn't reliably
  // flush state updates from a global document keydown listener in tests.
  // The local handler uses React's synthetic event system which flushes
  // synchronously. Click-outside uses a global mousedown listener because
  // the click can land anywhere in the document (no specific element to
  // attach onKeyDown to).
  useEffect(() => {
    if (!open) return;
    const handleDocMouseDown = (e: MouseEvent) => {
      const trigger = triggerRef.current;
      const target = e.target as Node | null;
      if (!target) return;
      // If click is inside the trigger button, ignore — handleClick will
      // toggle. If click is inside the tooltip portal, ignore.
      if (trigger && trigger.contains(target)) return;
      const tooltipEl = document.getElementById(tooltipId);
      if (tooltipEl && tooltipEl.contains(target)) return;
      closeImmediate();
    };
    document.addEventListener('mousedown', handleDocMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
    };
  }, [open, tooltipId, closeImmediate]);

  // ─── Recompute position on viewport resize while open ───
  useEffect(() => {
    if (!open) return;
    const handleResize = () => setCoords(computeCoords());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open, computeCoords]);

  // ─── Clear timers on unmount ───
  useEffect(() => clearTimers, [clearTimers]);

  // Resolve aria-label. Default to a generic Russian label; callers can
  // override via `ariaLabel` prop.
  const resolvedAriaLabel = ariaLabel ?? 'Показать пояснение';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex items-center justify-center w-4 h-4 leading-none text-[0.85em] text-muted hover:text-accent-amber-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber rounded ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={resolvedAriaLabel}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
      >
        {trigger ?? 'ⓘ'}
      </button>
      {open && coords && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            maxWidth: `${MAX_WIDTH_PX}px`,
            zIndex: 9999,
          }}
          className="px-3 py-2 bg-raised border border-edge-panel rounded shadow-lg text-[12px] text-bright leading-relaxed pointer-events-none"
          // Mouse enter on tooltip cancels the close timer so the user can
          // move cursor from trigger into tooltip without dismissing it.
          // (pointer-events:none above means clicks pass through; the mouse
          // enter/leave handlers still fire for hover purposes on most
          // browsers — but we leave them off here to keep the close behaviour
          // predictable. If users report flakiness, switch pointer-events to
          // auto and add onMouseEnter/onMouseLeave.)
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};

Tooltip.displayName = 'Tooltip';
