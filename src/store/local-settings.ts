/**
 * Local Settings — iter 141 (KI#26) + iter 144 (KI#30/31).
 *
 * Thin wrapper over `localStorage` for cross-tab persistence of user-level
 * settings (round10Enabled, searchLogic, minValue, maxValue,
 * thresholdEnabled, sortMode). Each setting is stored as a JSON-serialized
 * value under key `poe2:<settingName>`.
 *
 * Why: each category page (Belt, Ring, Amulet, ...) has its own Zustand filter
 * store created on mount and destroyed on unmount. The URL hash is shared
 * across pages but gets overwritten when a new page mounts (its fresh defaults
 * sync to URL). This means a user who unchecks "round10" on Belt loses that
 * choice when navigating to Ring. localStorage provides a stable cross-tab
 * store that survives navigation.
 *
 * Precedence (in `useCategoryPage` useState initializers):
 *   1. URL hash (via filter-store.extraState) — for shareable links.
 *   2. localStorage (via readLocalSetting) — for personal cross-tab persistence.
 *   3. defaults (e.g., `defaultRound10 = false` per iter 141 KI#26).
 *
 * SSR / privacy mode safe: all access wrapped in try/catch with silent
 * fallback to the provided default. No exceptions bubble up.
 *
 * ─── iter 144 (KI#30): per-category favorites persistence ────────────────
 * Cross-tab persistence for `pinnedIds` (favorited affix families). Each
 * category gets its own localStorage key: `poe2:favorites:<categoryId>`.
 * Value: JSON-serialized `string[]` (token IDs — first member per family,
 * per iter 141 KI#28 family-level pin convention). Silent reset for old
 * `pinnedIds` stored in URL `pn` key — acceptable per user Q3 answer.
 *
 * ─── iter 144 (KI#31 variant d): per-category favorites range persistence ─
 * Quick-select panel allows entering min/max range values per favorited
 * family. These ranges are stored under a SEPARATE key:
 *   `poe2:favorites:<categoryId>:ranges`
 * Value: JSON-serialized `Record<tokenId, { min?: number, max?: number }>`.
 * Ranges are scoped to favorites (not all perTokenRanges) so they survive
 * cross-tab navigation as part of the "favorites bundle".
 */
const PREFIX = 'poe2:';

/**
 * Read a setting from localStorage. Returns `fallback` if:
 * - localStorage is unavailable (SSR, privacy mode, disabled).
 * - The key is not set.
 * - The stored value fails JSON.parse.
 */
export function readLocalSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Write a setting to localStorage. Silently no-ops if localStorage is
 * unavailable. Values are JSON-serialized so booleans, numbers, strings,
 * and plain objects all round-trip correctly.
 */
export function writeLocalSetting<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore — localStorage may be full, unavailable, or blocked.
  }
}

/**
 * Remove a setting from localStorage. Used by tests for cleanup; not
 * currently called from production code.
 */
export function clearLocalSetting(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// iter 144 (KI#30): per-category favorites (pinnedIds) persistence.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * localStorage key for a category's favorited token IDs.
 * Format: `poe2:favorites:<categoryId>`.
 */
function favoritesKey(categoryId: string): string {
  return `favorites:${categoryId}`;
}

/**
 * localStorage key for a category's favorited token range overrides.
 * Format: `poe2:favorites:<categoryId>:ranges`.
 *
 * iter 144 (KI#31 variant d): quick-select panel allows entering min/max
 * range values per favorited family. These ranges are scoped to favorites
 * so they survive cross-tab navigation as part of the "favorites bundle".
 */
function favoritesRangesKey(categoryId: string): string {
  return `favorites:${categoryId}:ranges`;
}

/**
 * Read the favorited token IDs for a category from localStorage.
 *
 * Returns `[]` when:
 * - localStorage is unavailable.
 * - The key is not set (no favorites for this category yet).
 * - The stored value fails JSON.parse or is not an array of strings.
 *
 * The IDs are typically the first member of each favorited family (per iter
 * 141 KI#28 family-level pin convention). Callers should treat them as opaque
 * tokens that match against `pinnedIds` in the filter store.
 */
export function readFavorites(categoryId: string): string[] {
  try {
    const raw = localStorage.getItem(PREFIX + favoritesKey(categoryId));
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

/**
 * Persist the favorited token IDs for a category to localStorage.
 * Silently no-ops if localStorage is unavailable.
 *
 * Pass an empty array (or use `clearFavorites`) to remove all favorites for
 * the category. The array is JSON-serialized under `poe2:favorites:<categoryId>`.
 */
export function writeFavorites(categoryId: string, ids: string[]): void {
  try {
    localStorage.setItem(PREFIX + favoritesKey(categoryId), JSON.stringify(ids));
  } catch {
    // ignore — localStorage may be full, unavailable, or blocked.
  }
}

/**
 * Remove the favorites entry for a category from localStorage.
 * Used when the user clears all pinned tokens via the FavoritesIndicator
 * quick-select panel (KI#31 variant d) — keeps the localStorage clean.
 */
export function clearFavorites(categoryId: string): void {
  try {
    localStorage.removeItem(PREFIX + favoritesKey(categoryId));
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// iter 144 (KI#31 variant d): per-category favorites range overrides.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Range override stored per favorited token ID.
 * Mirrors the {min, max} shape used by FilterChip range inputs.
 */
export interface FavoriteRangeOverride {
  min?: number;
  max?: number;
}

/**
 * Read the per-favorite range overrides for a category from localStorage.
 *
 * Returns `{}` when:
 * - localStorage is unavailable.
 * - The key is not set (no range overrides saved yet).
 * - The stored value fails JSON.parse or is not a plain object.
 *
 * The returned record maps token IDs (typically the first member per family)
 * to `{min?, max?}` overrides. Callers should treat this as a "starting
 * point" — when the user quick-selects a favorited family, these ranges
 * are applied to `perTokenRanges` in the filter store.
 */
export function readFavoritesRanges(categoryId: string): Record<string, FavoriteRangeOverride> {
  try {
    const raw = localStorage.getItem(PREFIX + favoritesRangesKey(categoryId));
    if (raw === null) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    // Sanitize: only keep entries with numeric min/max fields.
    const result: Record<string, FavoriteRangeOverride> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== 'object' || v === null) continue;
      const obj = v as Record<string, unknown>;
      const entry: FavoriteRangeOverride = {};
      if (typeof obj.min === 'number') entry.min = obj.min;
      if (typeof obj.max === 'number') entry.max = obj.max;
      if (entry.min !== undefined || entry.max !== undefined) {
        result[k] = entry;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Persist the per-favorite range overrides for a category to localStorage.
 * Silently no-ops if localStorage is unavailable.
 *
 * Only pass entries for FAVORITED token IDs — this is a "favorites bundle",
 * not a global perTokenRanges dump. Non-favorited tokens' ranges stay in the
 * filter store's perTokenRanges (URL-serialized via `r` key).
 */
export function writeFavoritesRanges(categoryId: string, ranges: Record<string, FavoriteRangeOverride>): void {
  try {
    localStorage.setItem(PREFIX + favoritesRangesKey(categoryId), JSON.stringify(ranges));
  } catch {
    // ignore — localStorage may be full, unavailable, or blocked.
  }
}

/**
 * Remove the favorites range overrides entry for a category from localStorage.
 * Used when the user clears all pinned tokens via the FavoritesIndicator
 * quick-select panel (KI#31 variant d) — keeps the localStorage clean.
 */
export function clearFavoritesRanges(categoryId: string): void {
  try {
    localStorage.removeItem(PREFIX + favoritesRangesKey(categoryId));
  } catch {
    // ignore
  }
}

/**
 * Build the localStorage key (without the `poe2:` prefix) for a category's
 * favorites. Exposed so callers can subscribe to the `storage` event for
 * realtime multi-tab sync (KI#30 Q4 — user approved if stable).
 *
 * Example:
 *   const key = favoritesStorageKey('ring'); // 'favorites:ring'
 *   window.addEventListener('storage', e => {
 *     if (e.key === 'poe2:' + key) { /* re-read favorites *\/ }
 *   });
 */
export function favoritesStorageKey(categoryId: string): string {
  return favoritesKey(categoryId);
}

/**
 * Build the localStorage key (without the `poe2:` prefix) for a category's
 * favorites range overrides. Same purpose as `favoritesStorageKey` but for
 * the `:ranges` namespace.
 */
export function favoritesRangesStorageKey(categoryId: string): string {
  return favoritesRangesKey(categoryId);
}
