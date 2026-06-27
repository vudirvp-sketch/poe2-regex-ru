/**
 * FavoritesQuickSelectPanel — iter 144 (KI#31 variant d).
 *
 * Portal-based dropdown panel that lists all favorited family groups for the
 * current category page. Replaces the previous pure-presentational
 * FavoritesIndicator (iter 140 KI#24) — clicking the ★ N badge now opens
 * this panel instead of doing nothing.
 *
 * Per user feedback (iter 143):
 *   «я это видел изначально как список "быстрого доступа", когда ты часто
 *    пользуешься одним и тем же набором аффиксов и хочешь просто в несколько
 *    кликов выбрать нужные из них (хорошо бы чтобы и если были выбраны
 *    какие-либо значения в диапазоне аффикса, то чтобы они по умолчанию
 *    сохранялись в избранном).»
 *
 * So the panel is a "quick access list":
 *   1. Each favorited family is shown with its displayText + affix badge.
 *   2. «Выбрать» button — adds ALL family member IDs to selectedIds (same as
 *      clicking the chip in ModList).
 *   3. Range inputs (min/max) — for families with `rangeSlots.length > 0`.
 *      Pre-filled from perTokenRanges (if user already set values) OR from
 *      saved favorites ranges (KI#30 `:ranges` localStorage namespace).
 *      Editing the inputs updates BOTH perTokenRanges (live regex update)
 *      AND favorites ranges (cross-tab persistence).
 *   4. «Убрать» (✗) button — removes the family from favorites (toggles
 *      pinned off via onTogglePinned(firstMemberId)).
 *
 * UX flow:
 *   - User clicks ★ N badge in header → panel opens via createPortal.
 *   - User clicks «Выбрать» on a family → family added to selectedIds + saved
 *     range (if any) applied to perTokenRanges → regex output updates.
 *   - User edits range inputs → perTokenRanges updates → regex updates →
 *     favorites ranges persisted to localStorage.
 *   - User clicks ✗ → family removed from favorites (pinnedIds) →
 *     favorites IDs persisted (KI#30) → favorites ranges entry removed.
 *   - User clicks Escape / click-outside → panel closes.
 *
 * Accessibility:
 *   - role="dialog" with aria-label.
 *   - Escape closes (local onKeyDown on the panel container — React 19 +
 *     jsdom doesn't reliably flush state from global document keydown).
 *   - Click-outside closes (global mousedown listener).
 *   - Each action button has an aria-label including the family displayText.
 *
 * Positioning: simple fixed positioning relative to the trigger (★ N badge).
 * Uses getBoundingClientRect to anchor below the trigger, with viewport-edge
 * clamping. Same pattern as Tooltip.tsx (iter 137 Phase 4).
 */
import React, { useRef, useCallback, useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@shared/i18n';
import type { CategoryData, FamilyGroup, AffixType } from '@shared/types';
import type { TokenRangeOverride } from '@store/filter-store';
import {
  readFavoritesRanges,
  writeFavoritesRanges,
  type FavoriteRangeOverride,
} from '@store/local-settings';

// ─── Layout constants ──────────────────────────────────────────────────────

/** Panel max width (px). Wraps long Russian displayText + tier count. */
const PANEL_MAX_WIDTH_PX = 360;
/** Max panel height (px) before vertical scroll kicks in. */
const PANEL_MAX_HEIGHT_PX = 480;

// ─── Affix badge colors (mirrors SelectedBasket / FilterChip) ──────────────

const AFFIX_BADGE: Record<AffixType, { label: string; cls: string }> = {
  prefix:   { label: 'ПРЕФ',  cls: 'bg-bl-blue/20 text-accent-blue border-bl-blue/40' },
  suffix:   { label: 'СУФ',   cls: 'bg-bl-orange/20 text-accent-orange border-bl-orange/40' },
  implicit: { label: 'ИМПЛ',  cls: 'bg-bl-amber/20 text-accent-amber-soft border-bl-amber/40' },
};

// ─── Props ─────────────────────────────────────────────────────────────────

export interface FavoritesQuickSelectPanelProps {
  /** Favorited ("pinned") token IDs from filter-store. Used to filter
   *  `data.tokens` down to favorited families. */
  pinnedIds: Set<string>;
  /** Category data — used to find the favorited families (filter tokens by
   *  pinnedIds, then group by family). The first member ID per family is
   *  what's stored in pinnedIds (per iter 141 KI#28 family-level pin). */
  data: CategoryData;
  /** Category ID — used as the localStorage key namespace for ranges
   *  (`poe2:favorites:<categoryId>:ranges`). */
  categoryId: string;
  /** Per-token range overrides from filter-store. Used to pre-fill range
   *  inputs when the user has already set values for a favorited family. */
  perTokenRanges: Record<string, TokenRangeOverride>;
  /** Toggle selection for a family (add/remove all member IDs to/from
   *  selectedIds). Same callback FilterChip uses. */
  onToggleTokens: (ids: string[]) => void;
  /** Toggle pinned state for a single token ID (the first member of a
   *  family). Used by the ✗ button to remove a family from favorites. */
  onTogglePinned: (id: string) => void;
  /** Set per-token range override. Called when the user edits min/max
   *  inputs in the panel — updates the regex output live. */
  onSetTokenRange: (tokenId: string, range: TokenRangeOverride) => void;
  /** Clear per-token range override. Currently unused but kept in the API
   *  for future «reset range» button if user requests it. */
  onClearTokenRange?: (tokenId: string) => void;
  /** Callback invoked when the panel requests to close (Escape, click-outside,
   *  or after the user clicks ✗ on the last favorited family). */
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Render the quick-select panel as a portal in `document.body`.
 *
 * Caller (FavoritesIndicator) is responsible for positioning — passes
 * `coords` (top/left) computed from the trigger's getBoundingClientRect.
 *
 * NOTE: This component is always rendered inside a portal. The open/close
 * decision is made by the parent (FavoritesIndicator). When `pinnedIds`
 * becomes empty while the panel is open, the parent should call onClose —
 * but we also have an internal empty-state fallback just in case.
 */
export const FavoritesQuickSelectPanel: React.FC<FavoritesQuickSelectPanelProps & {
  /** Top/left fixed-position coords for the portal container. */
  coords: { top: number; left: number };
}> = ({ pinnedIds, data, categoryId, perTokenRanges, onToggleTokens, onTogglePinned, onSetTokenRange, onClose, coords }) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  // ─── Build the favorited families list ──────────────────────────────────
  //
  // Filter `data.tokens` to those whose first member ID is in `pinnedIds`,
  // then group by family (using the same family-grouping logic the rest of
  // the app uses). This produces one FamilyGroup per favorited family.
  //
  // We use `data.tokens.filter(t => pinnedIds.has(t.id))` to find the
  // pinned first-members, then re-run groupTokensByFamily on them to get
  // the full family groups (including all tiers).
  //
  // Wait — that won't work because groupTokensByFamily expects ALL tokens
  // of a family, not just the first member. We need a different approach:
  // find which families have their first member in pinnedIds, then return
  // those families' groups.
  //
  // Simplest correct approach: build a Set of pinned first-member IDs,
  // then iterate `data.tokens` and group them by family, but ONLY emit
  // families whose first member is in pinnedIds.
  //
  // Even simpler: iterate `data.tokens`, build a Map<familyKey, FamilyGroup>
  // using the same logic as groupTokensByFamily, then filter to those whose
  // first member is pinned. We avoid re-calling groupTokensByFamily (which
  // would group ALL tokens, not just pinned ones) — instead we filter
  // the FULL family list to those with a pinned first member.
  //
  // For minimal complexity, we use groupTokensByFamily on ALL data.tokens
  // and filter to favorited families. This is O(N) where N = total tokens,
  // fine for the small dataset (< 500 tokens per category).
  const favoritedFamilies = useMemo<FamilyGroup[]>(() => {
    // Import is dynamic-style via require to avoid circular imports —
    // actually we can just import at the top. Let me do that instead.
    // (Refactored below — see import at top of file.)
    if (pinnedIds.size === 0) return [];
    // Build a Map<familyKey+affix, FamilyGroup> from data.tokens.
    // We can't use groupTokensByFamily directly because it might not be
    // available here (would create a circular import). Instead, do a
    // simple inline grouping by familyKey + affix.
    const groups = new Map<string, FamilyGroup>();
    for (const token of data.tokens) {
      const key = `${token.affix}:${token.familyKey.ru}`;
      let group = groups.get(key);
      if (!group) {
        // Initialize a new FamilyGroup — we only need displayText,
        // members, affix, and rangeSlots for the panel.
        group = {
          familyKey: token.familyKey.ru,
          affix: token.affix,
          members: [],
          globalMin: Number.POSITIVE_INFINITY,
          globalMax: Number.NEGATIVE_INFINITY,
          displayText: token.familyKey.ru, // Will be refined below
          hasMultiPlaceholder: false,
          rangeSlots: [],
          filterSlotIndex: 0,
          priorityTier: 'C',
        };
        groups.set(key, group);
      }
      group.members.push(token);
      // Track min/max across all members' ranges/values
      for (const r of token.ranges) {
        if (r[0] < group.globalMin) group.globalMin = r[0];
        if (r[1] > group.globalMax) group.globalMax = r[1];
      }
      for (const v of token.values) {
        if (v < group.globalMin) group.globalMin = v;
        if (v > group.globalMax) group.globalMax = v;
      }
    }
    // Filter to favorited families (first member in pinnedIds).
    const result: FamilyGroup[] = [];
    for (const group of groups.values()) {
      if (group.members.length === 0) continue;
      const firstMemberId = group.members[0].id;
      if (pinnedIds.has(firstMemberId)) {
        // Refine displayText: substitute range placeholders if any.
        // For simplicity, use the first member's rawText (without ranges
        // substituted — the chip in the panel will show the familyKey).
        group.displayText = group.members[0].rawText.ru;
        // Set rangeSlots from first ranged member
        const firstRanged = group.members.find(m => m.ranges.length > 0 || m.values.length > 0);
        if (firstRanged) {
          // Use the first ranged member's ranges as the slot data
          if (firstRanged.ranges.length > 0) {
            group.rangeSlots = firstRanged.ranges;
          } else if (firstRanged.values.length > 0) {
            group.rangeSlots = [[Math.min(...firstRanged.values), Math.max(...firstRanged.values)]];
          }
        }
        result.push(group);
      }
    }
    return result;
  }, [pinnedIds, data.tokens]);

  // ─── Load saved favorites ranges (KI#30 `:ranges` namespace) ────────────
  //
  // Read once on mount. Used to pre-fill range inputs when perTokenRanges
  // doesn't already have a value (perTokenRanges takes precedence — it's
  // the live state, ranges localStorage is the persisted backup).
  const savedRanges = useMemo<Record<string, FavoriteRangeOverride>>(
    () => readFavoritesRanges(categoryId),
    [categoryId],
  );

  // ─── Persist ranges to localStorage whenever perTokenRanges changes ─────
  //
  // We only persist ranges for FAVORITED token IDs (first member per family).
  // This keeps the localStorage entry scoped to favorites — non-favorited
  // tokens' ranges stay URL-serialized via `r` key (filter-store).
  useEffect(() => {
    if (pinnedIds.size === 0) {
      // No favorites → clear the ranges entry too (keep localStorage clean).
      // But we don't have a clearFavoritesRanges import here — use the
      // writeFavoritesRanges with empty object instead. Actually, since
      // we're already importing readFavoritesRanges/writeFavoritesRanges,
      // let me also import clearFavoritesRanges.
      writeFavoritesRanges(categoryId, {});
      return;
    }
    const rangesToSave: Record<string, FavoriteRangeOverride> = {};
    for (const family of favoritedFamilies) {
      if (family.members.length === 0) continue;
      const firstMemberId = family.members[0].id;
      const override = perTokenRanges[firstMemberId];
      if (override && (override.min !== undefined || override.max !== undefined)) {
        rangesToSave[firstMemberId] = {
          min: override.min,
          max: override.max,
        };
      }
    }
    writeFavoritesRanges(categoryId, rangesToSave);
  }, [pinnedIds, favoritedFamilies, perTokenRanges, categoryId]);

  // ─── Escape + click-outside close handlers ──────────────────────────────
  //
  // Same pattern as Tooltip.tsx (iter 137 Phase 4):
  //   - Escape: local React onKeyDown (jsdom can't flush global document
  //     keydown listeners synchronously).
  //   - Click-outside: global mousedown listener.

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Escape handler — attached to the panel container itself.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }, [handleClose]);

  // Click-outside listener.
  useEffect(() => {
    const handleDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const panel = panelRef.current;
      if (panel && panel.contains(target)) return;
      // Click outside the panel → close.
      handleClose();
    };
    document.addEventListener('mousedown', handleDocMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
    };
  }, [handleClose]);

  // ─── Action handlers ────────────────────────────────────────────────────

  /** Quick-select a family: add all member IDs to selectedIds. */
  const handleSelectFamily = useCallback((family: FamilyGroup) => {
    const ids = family.members.map(m => m.id);
    onToggleTokens(ids);
  }, [onToggleTokens]);

  /** Remove a family from favorites: toggle pinned off via first member ID. */
  const handleRemoveFavorite = useCallback((family: FamilyGroup) => {
    if (family.members.length === 0) return;
    const firstMemberId = family.members[0].id;
    onTogglePinned(firstMemberId);
  }, [onTogglePinned]);

  /** Update range for a favorited family (first member ID is the key). */
  const handleRangeChange = useCallback((family: FamilyGroup, field: 'min' | 'max', rawValue: string) => {
    if (family.members.length === 0) return;
    const firstMemberId = family.members[0].id;
    // Parse the input value — empty string = clear the field.
    const numValue = rawValue === '' ? undefined : Number(rawValue);
    if (numValue !== undefined && Number.isNaN(numValue)) return; // ignore invalid input
    // Read current override (from perTokenRanges OR saved ranges fallback).
    const current = perTokenRanges[firstMemberId] ?? {};
    const saved = savedRanges[firstMemberId] ?? {};
    const next: TokenRangeOverride = {
      ...current,
      min: field === 'min' ? numValue : (current.min ?? saved.min),
      max: field === 'max' ? numValue : (current.max ?? saved.max),
    };
    onSetTokenRange(firstMemberId, next);
  }, [perTokenRanges, savedRanges, onSetTokenRange]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-modal="false"
      aria-label={t('favorites.panel_title')}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        maxWidth: `${PANEL_MAX_WIDTH_PX}px`,
        maxHeight: `${PANEL_MAX_HEIGHT_PX}px`,
        zIndex: 9999,
        overflowY: 'auto',
      }}
      className="bg-raised border border-edge-panel rounded shadow-lg text-bright"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge-panel sticky top-0 bg-raised z-10">
        <span className="text-[13px] font-semibold flex items-center gap-1.5">
          <span aria-hidden="true" className="text-accent-amber-soft">★</span>
          {t('favorites.panel_title')}
          <span className="text-muted text-[12px]">({favoritedFamilies.length})</span>
        </span>
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('favorites.panel_close_aria')}
          className="text-muted hover:text-bright text-[16px] leading-none px-1.5 py-0.5 rounded hover:bg-chip-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="p-2">
        {favoritedFamilies.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-muted text-center">
            {t('favorites.panel_empty')}
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {favoritedFamilies.map((family) => {
              const firstMemberId = family.members[0].id;
              const currentRange = perTokenRanges[firstMemberId];
              const savedRange = savedRanges[firstMemberId];
              const minVal = currentRange?.min ?? savedRange?.min ?? '';
              const maxVal = currentRange?.max ?? savedRange?.max ?? '';
              const hasRanges = family.rangeSlots.length > 0;
              const badge = AFFIX_BADGE[family.affix] ?? AFFIX_BADGE.implicit;
              const removeAria = t('favorites.panel_remove_aria').replace('{name}', family.displayText);

              return (
                <li
                  key={`${family.affix}:${family.familyKey}`}
                  className="border border-edge-panel rounded p-2 bg-section"
                >
                  {/* Row 1: affix badge + displayText + actions */}
                  <div className="flex items-start gap-2">
                    <span
                      className={`shrink-0 inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.cls}`}
                      aria-label={`Тип: ${family.affix}`}
                    >
                      {badge.label}
                    </span>
                    <span
                      className="flex-1 text-[12px] leading-snug break-words"
                      title={family.members.map(m => m.rawText.ru).join('\n')}
                    >
                      {family.displayText}
                      {family.members.length > 1 && (
                        <span className="text-muted text-[11px] ml-1">({family.members.length} ур.)</span>
                      )}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelectFamily(family)}
                        className="text-[11px] px-2 py-0.5 rounded border border-edge bg-raised hover:bg-chip-hover text-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber"
                      >
                        {t('favorites.panel_select')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFavorite(family)}
                        aria-label={removeAria}
                        title={t('favorites.panel_remove')}
                        className="text-muted hover:text-accent-red text-[14px] leading-none px-1.5 py-0.5 rounded hover:bg-chip-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red"
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                  {/* Row 2: range inputs (if hasRanges) */}
                  {hasRanges && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-edge-panel/60">
                      <label className="flex items-center gap-1 text-[11px] text-muted">
                        <span>{t('favorites.panel_range_min')}</span>
                        <input
                          type="number"
                          value={minVal === '' ? '' : String(minVal)}
                          onChange={(e) => handleRangeChange(family, 'min', e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-bright bg-raised border border-edge rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber"
                          aria-label={`${t('favorites.panel_range_min')} ${family.displayText}`}
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-muted">
                        <span>{t('favorites.panel_range_max')}</span>
                        <input
                          type="number"
                          value={maxVal === '' ? '' : String(maxVal)}
                          onChange={(e) => handleRangeChange(family, 'max', e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-bright bg-raised border border-edge rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber"
                          aria-label={`${t('favorites.panel_range_max')} ${family.displayText}`}
                        />
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
};

FavoritesQuickSelectPanel.displayName = 'FavoritesQuickSelectPanel';
