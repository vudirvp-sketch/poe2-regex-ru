/**
 * StatusPanel — Badges + Alerts panel for category pages (iter 140, KI#22).
 *
 * iter 140 (KI#22) REWRITE: The main summary panel («Выбрано: N аффикс(ов)» +
 * «Включить: ...» truncated token list) has been REMOVED. That information
 * was redundant with SelectedBasket (Phase 3, iter 135) which renders
 * «Выбрано: N афф.» with chips at the TOP of the right aside — the basket
 * is a better visualization (chips with affix badges + click-to-deselect).
 *
 * StatusPanel now renders ONLY:
 * 1. **Category badges** — inline <span> elements appended to a single row,
 *    for waystone (corrupted/uncorrupted/delirious) and tablet
 *    (type/rarity/uses) filters. Each badge is a simple ReactNode.
 *
 * 2. **Alert blocks** — warning/alert boxes rendered below the badges row,
 *    for jewel hidden-mods warning and vendor verification note. Each alert
 *    is a ReactNode (the caller constructs the styled alert).
 *
 * Backward compat: the props `wantTokens`, `excludeTokens`, `allActiveTokens`
 * REMAIN in the interface for backward compat with the 7 category pages +
 * VendorPage that pass them. They are IGNORED at render time. Callers can
 * clean them up in a future iteration if desired — no breaking change here.
 *
 * Design: The component returns `null` when there are no badges AND no alerts.
 * Callers pass `badges`/`alerts` arrays that are empty by default, so pages
 * with no extensions (Belt, Ring, Amulet, Relic) now render NOTHING in the
 * status slot — SelectedBasket above covers the selection summary.
 *
 * Iter 58, UI Phase 6 — original component.
 * Iter 140, KI#22 — summary panel removed; badges + alerts only.
 */
import type { ReactNode } from 'react';
import type { GameToken } from '@shared/types';

interface StatusPanelProps {
  /** Tokens with selectedIds (want/include). DEPRECATED iter 140 (KI#22) —
   *  ignored at render time. Kept for backward compat with 7 category pages
   *  + VendorPage that pass it. SelectedBasket covers the want-summary now. */
  wantTokens?: GameToken[];
  /** Tokens with excludedIds. DEPRECATED iter 140 (KI#22) — ignored. */
  excludeTokens?: GameToken[];
  /** All active tokens (selected + excluded). DEPRECATED iter 140 (KI#22) —
   *  ignored. */
  allActiveTokens?: GameToken[];
  /** Category-specific inline badges appended to a single row.
   *  E.g. waystone corrupted/uncorrupted/delirious, tablet type/rarity/uses. */
  badges?: ReactNode[];
  /** Alert blocks rendered below the badges row.
   *  E.g. jewel hidden-mods warning, vendor verification note. */
  alerts?: ReactNode[];
}

export function StatusPanel({
  badges = [],
  alerts = [],
  // iter 140 (KI#22): wantTokens / excludeTokens / allActiveTokens are no
  // longer consumed. They remain in the interface for backward compat —
  // callers that pass them will not break, but the props are ignored.
  // SelectedBasket (Phase 3, iter 135) covers the selection summary now.
  wantTokens: _wantTokens,
  excludeTokens: _excludeTokens,
  allActiveTokens: _allActiveTokens,
}: StatusPanelProps) {
  const hasBadges = badges.length > 0;
  const hasAlerts = alerts.length > 0;

  // Nothing to show at all — no badges, no alerts. The summary panel that
  // used to render here is gone (KI#22); SelectedBasket covers selection info.
  if (!hasBadges && !hasAlerts) {
    return null;
  }

  return (
    <>
      {/* Badges row — shown when category-specific badges are provided
          (waystone corrupted/uncorrupted/delirious, tablet type/rarity/uses). */}
      {hasBadges && (
        <div className="bg-panel border border-edge-panel rounded p-3">
          <div className="text-xs text-muted flex flex-wrap items-center gap-2">
            {badges.map((badge, i) => (
              <span key={i}>{badge}</span>
            ))}
          </div>
        </div>
      )}

      {/* Alert blocks below the badges row (jewel hidden-mods warning,
          vendor verification note). */}
      {hasAlerts && alerts.map((alert, i) => (
        <div key={i}>{alert}</div>
      ))}
    </>
  );
}
