/**
 * MobileRegexBar — Mobile-only sticky bottom bar containing RegexOutput
 * and StatusPanel alerts.
 *
 * iter 59, UI Phase 7: On mobile (< lg), RegexOutput moves out of the right
 * column aside and into this sticky bottom bar so it's always visible while
 * the user scrolls the mod list. StatusPanel alerts (Jewel hidden-mods
 * warning, Vendor verification note) follow it — they appear ABOVE the
 * regex output inside the same bar.
 *
 * Desktop (lg+): The bar is hidden (`lg:hidden`). RegexOutput and alerts
 * stay in the right column aside as before.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │ [alert block — Jewel/Vendor]        │  ← optional, above regex
 *   │ ┌─────────────────────────────────┐ │
 *   │ │ RegexOutput                     │ │  ← primary output
 *   │ └─────────────────────────────────┘ │
 *   └─────────────────────────────────────┘
 *
 * Positioning: `position: sticky; bottom: 0` inside <main> (the scroll
 * container). The bar sticks to the bottom of the viewport while scrolling,
 * and sits at its natural position (end of page) when scrolled to the
 * bottom — no overlap with the last content.
 *
 * Rendering note: RegexOutput is rendered BOTH in the desktop aside AND
 * here (mobile bar). Each instance has its own transient React state
 * (copied/shareCopied), but `autoCopy` is persisted to localStorage so
 * both instances read/write the same value. The auto-copy effect fires
 * twice (once per instance) — clipboard write is idempotent so this is
 * harmless. The tradeoff is acceptable to avoid CSS hacks to teleport a
 * single DOM node between containers.
 */
import type { ReactNode } from 'react';

interface MobileRegexBarProps {
  /** RegexOutput element (already constructed by the page). */
  regexOutput: ReactNode;
  /** Alert blocks (e.g., Jewel hidden-mods warning, Vendor verification
   *  note). Rendered above the regex output inside the bar. */
  alerts?: ReactNode[];
}

export function MobileRegexBar({ regexOutput, alerts = [] }: MobileRegexBarProps) {
  const hasAlerts = alerts.length > 0;

  return (
    <div className="mobile-regex-bar lg:hidden" role="region" aria-label="Regex output — mobile">
      {hasAlerts && (
        <div className="mobile-regex-bar-alerts flex flex-col gap-2">
          {alerts.map((alert, i) => (
            <div key={i}>{alert}</div>
          ))}
        </div>
      )}
      <div className="mobile-regex-bar-output">{regexOutput}</div>
    </div>
  );
}
