/**
 * StatusPanel — Unified status panel for category pages.
 *
 * Consolidates the previously scattered status blocks across all 8 category
 * pages into a single reusable component. Handles:
 *
 * 1. **Mod selection summary** — selected/excluded family counts + truncated
 *    token lists. Visible only when there are active tokens (or category-
 *    specific badges trigger visibility).
 *
 * 2. **Category badges** — inline <span> elements appended to the summary
 *    row, for waystone (corrupted/uncorrupted/delirious) and tablet
 *    (type/rarity/uses) filters. Each badge is a simple ReactNode.
 *
 * 3. **Alert blocks** — warning/alert boxes rendered below the summary panel,
 *    for jewel hidden-mods warning and vendor verification note. Each alert
 *    is a ReactNode (the caller constructs the styled alert).
 *
 * Design: The component returns `null` when there is nothing to show (no
 * active tokens, no badges, no alerts). Callers pass `badges`/`alerts` arrays
 * that are empty by default, so pages with no extensions see the same
 * behaviour as before.
 *
 * Iter 58, UI Phase 6.
 */
import type { ReactNode } from 'react';
import { t } from '@shared/i18n';
import { countUniqueFamilyKeys } from '@shared/family-grouper';
import type { GameToken } from '@shared/types';

interface StatusPanelProps {
  /** Tokens with selectedIds (want/include) */
  wantTokens: GameToken[];
  /** Tokens with excludedIds */
  excludeTokens: GameToken[];
  /** All active tokens (selected + excluded) — used for visibility check */
  allActiveTokens: GameToken[];
  /** Category-specific inline badges appended to the summary row.
   *  E.g. waystone corrupted/uncorrupted/delirious, tablet type/rarity/uses. */
  badges?: ReactNode[];
  /** Alert blocks rendered below the summary panel.
   *  E.g. jewel hidden-mods warning, vendor verification note. */
  alerts?: ReactNode[];
}

/**
 * Truncate a token's rawText for the summary list.
 * Keeps up to `maxLen` characters per token.
 */
function truncToken(token: GameToken, maxLen = 30): string {
  return token.rawText.ru.slice(0, maxLen);
}

export function StatusPanel({
  wantTokens,
  excludeTokens,
  allActiveTokens,
  badges = [],
  alerts = [],
}: StatusPanelProps) {
  const hasActiveTokens = allActiveTokens.length > 0;
  const hasBadges = badges.length > 0;
  const hasAlerts = alerts.length > 0;

  // Nothing to show at all
  if (!hasActiveTokens && !hasBadges && !hasAlerts) {
    return null;
  }

  const hasExcludeTokens = excludeTokens.length > 0;
  const hasWantTokens = wantTokens.length > 0;

  return (
    <>
      {/* Main summary panel — shown when there are active tokens or category badges */}
      {(hasActiveTokens || hasBadges) && (
        <div className="bg-panel border border-edge-panel rounded p-3">
          <div className="text-xs text-muted mb-1">
            {hasActiveTokens && (
              <>
                {t('summary.selected')}: {countUniqueFamilyKeys(wantTokens)} {t('mods_word')}
                {hasExcludeTokens && (
                  <span className="text-accent-red"> | {t('summary.exclude')}: {countUniqueFamilyKeys(excludeTokens)} {t('mods_word')}</span>
                )}
              </>
            )}
            {badges.map((badge, i) => (
              <span key={i}> {badge}</span>
            ))}
          </div>
          {hasWantTokens && (
            <div className="text-[12px] text-dim">
              {t('summary.include')}: {wantTokens.map(tok => truncToken(tok)).join(', ')}
            </div>
          )}
          {hasExcludeTokens && (
            <div className="text-[12px] text-accent-red-dim">
              {t('summary.exclude')}: {excludeTokens.map(tok => truncToken(tok)).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Alert blocks below the summary */}
      {hasAlerts && alerts.map((alert, i) => (
        <div key={i}>{alert}</div>
      ))}
    </>
  );
}
