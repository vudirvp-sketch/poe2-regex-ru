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
import type { CategoryData, FamilyGroup, AffixType, ModOrigin } from '@shared/types';
import type { TokenRangeOverride } from '@store/filter-store';
import {
  readFavoritesRanges,
  writeFavoritesRanges,
  type FavoriteRangeOverride,
} from '@store/local-settings';
// iter 146 (KI#36): use canonical family grouping (matches FilterChip rendering)
// instead of the previous custom grouping by clean familyKey. This ensures
// that origin-split families (e.g., desecrated/corrupted variants) are
// correctly identified as favorited when the user pinned them.
import { groupTokensByFamily, splitGroupByOrigin } from '@shared/family-grouper';

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

// ─── Origin badge (iter 146 KI#37) ─────────────────────────────────────────
// Compact origin label for non-normal origin variants. Hidden for 'normal'
// to keep the UI clean in the common case. Labels mirror ORIGIN_SECTION_LABELS
// but trimmed to short form for inline badge use.

const ORIGIN_BADGE: Partial<Record<ModOrigin, { label: string; cls: string }>> = {
  desecrated: { label: 'ОЧЕРН',  cls: 'bg-bl-emerald/20 text-accent-emerald border-bl-emerald/40' },
  corrupted:  { label: 'ОСКВ',   cls: 'bg-bl-red/20 text-accent-red border-bl-red/40' },
  essence:    { label: 'СУЩН',   cls: 'bg-bl-amber/20 text-accent-amber-soft border-bl-amber/40' },
  breachborn: { label: 'РАЗЛ',   cls: 'bg-bl-purple/20 text-accent-purple border-bl-purple/40' },
  // 'normal' intentionally omitted — badge is hidden for normal origin.
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
  // iter 146 (KI#36): rewritten to use canonical family grouping from
  // `@shared/family-grouper` — `groupTokensByFamily` + `splitGroupByOrigin`.
  // This matches EXACTLY what FilterChip renders in ModList/VirtualizedModList,
  // so a favorited (family, origin) tuple in the chip list always appears in
  // the panel.
  //
  // Previous bug: the panel grouped tokens by clean `familyKey.ru` without
  // origin splitting, so the "first member" of the combined group was always
  // the normal-variant token (first in data.tokens order). When the user
  // pinned a desecrated/corrupted variant, `pinnedIds` contained the
  // desecrated token ID, but `members[0].id` was the normal token ID —
  // mismatch caused the favorited family to silently disappear from the panel.
  //
  // New approach: for each canonical FamilyGroup, call `splitGroupByOrigin`
  // to get per-origin sub-groups. For each sub-group, check if ANY member is
  // in `pinnedIds` — if so, include this (family, origin) tuple in the list.
  //
  // Returns `Array<{ origin: ModOrigin; group: FamilyGroup }>` so the render
  // logic can show the origin badge (KI#37) and use the correct origin-scoped
  // displayText/ranges.
  //
  // Performance: O(N) where N = total tokens in the category. Fine for the
  // small dataset (< 500 tokens per category).
  const favoritedFamilies = useMemo<Array<{ origin: ModOrigin; group: FamilyGroup }>>(() => {
    if (pinnedIds.size === 0) return [];
    const allGroups = groupTokensByFamily(data.tokens);
    const result: Array<{ origin: ModOrigin; group: FamilyGroup }> = [];
    for (const group of allGroups) {
      const splits = splitGroupByOrigin(group);
      for (const { origin, group: splitGroup } of splits) {
        if (splitGroup.members.length === 0) continue;
        // iter 146 (KI#36): check if ANY member is pinned — not just the
        // first member. This handles the case where the user pinned a
        // specific origin variant whose first-member ID doesn't match the
        // combined group's first-member ID.
        const isPinned = splitGroup.members.some(m => pinnedIds.has(m.id));
        if (isPinned) {
          result.push({ origin, group: splitGroup });
        }
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
  // We only persist ranges for FAVORITED token IDs (first member per
  // origin-split family). This keeps the localStorage entry scoped to
  // favorites — non-favorited tokens' ranges stay URL-serialized via `r`
  // key (filter-store).
  //
  // iter 146 (KI#36): favoritedFamilies is now `Array<{ origin, group }>`,
  // so we read `entry.group.members[0].id` for the first-member ID.
  useEffect(() => {
    if (pinnedIds.size === 0) {
      // No favorites → clear the ranges entry too (keep localStorage clean).
      writeFavoritesRanges(categoryId, {});
      return;
    }
    const rangesToSave: Record<string, FavoriteRangeOverride> = {};
    for (const entry of favoritedFamilies) {
      const family = entry.group;
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
            {favoritedFamilies.map((entry) => {
              // iter 146 (KI#36): each entry is { origin, group } — the
              // origin-scoped FamilyGroup that the user actually pinned.
              const family = entry.group;
              const origin = entry.origin;
              const firstMemberId = family.members[0].id;
              const currentRange = perTokenRanges[firstMemberId];
              const savedRange = savedRanges[firstMemberId];
              const minVal = currentRange?.min ?? savedRange?.min ?? '';
              const maxVal = currentRange?.max ?? savedRange?.max ?? '';
              const hasRanges = family.rangeSlots.length > 0;
              const badge = AFFIX_BADGE[family.affix] ?? AFFIX_BADGE.implicit;
              // iter 146 (KI#37): origin badge — only for non-normal origins
              // (normal is implied when no badge shown, keeps UI clean).
              const originBadge = ORIGIN_BADGE[origin];
              const removeAria = t('favorites.panel_remove_aria').replace('{name}', family.displayText);

              return (
                <li
                  key={`${family.affix}:${family.familyKey}:${origin}`}
                  className="border border-edge-panel rounded p-2 bg-section"
                >
                  {/* Row 1: affix badge + (optional origin badge) + displayText + actions */}
                  <div className="flex items-start gap-2">
                    <span
                      className={`shrink-0 inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.cls}`}
                      aria-label={`Тип: ${family.affix}`}
                    >
                      {badge.label}
                    </span>
                    {originBadge && (
                      <span
                        className={`shrink-0 inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded border ${originBadge.cls}`}
                        aria-label={`Происхождение: ${t('origin.' + origin)}`}
                        title={t('origin.' + origin)}
                      >
                        {originBadge.label}
                      </span>
                    )}
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
