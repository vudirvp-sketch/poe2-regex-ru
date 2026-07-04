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

// ─────────────────────────────────────────────────────────────────────────────
// iter 169 (KI#50): per-category UI state (expand/collapse) persistence.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * localStorage key (without `poe2:` prefix) for a category's UI state.
 * Final key: `poe2:uistate:<categoryId>`.
 *
 * Why: each category page has its own Zustand store created fresh on mount.
 * The URL hash serializes the expand/collapse state, but the hash is shared
 * across category pages — when the user navigates from amulet to ring, ring's
 * store gets polluted with amulet's category-prefixed keys (e.g.,
 * `amulet:prefix:positive-loot`) which don't match any ring subgroups. Ring's
 * subgroups therefore stay collapsed (default), forcing the user to re-click
 * "Expand All" on every category switch.
 *
 * localStorage provides a stable per-category store that survives navigation.
 * Pattern mirrors iter 144 (KI#30) favorites persistence.
 */
function uiStateKey(categoryId: string): string {
  return `uistate:${categoryId}`;
}

/**
 * Per-category UI state persisted to localStorage under `poe2:uistate:<categoryId>`.
 * Stored as a JSON-serialized object with optional arrays for each Set field.
 * Empty arrays are dropped on write to keep the stored object minimal — their
 * absence means "default empty Set" on read.
 *
 *  - `expandedSubGroups`: sub-group keys currently EXPANDED.
 *    Format: `${categoryId}:${affix}:${subBlockKey}`.
 *  - `collapsedGroups`: top-level group keys currently COLLAPSED.
 *    Format: `${categoryId}:${affix}`.
 *  - `chipExpandState`: sub-group keys whose chips are fully expanded
 *    (Phase 2.5 — currently a no-op in `ModList.tsx` per iter 139 KI#18
 *    revert, but kept here for forward compat with future chip-truncation
 *    revivals). Format: `${categoryId}:${affix}:${subBlockKey}`.
 *
 * `showSelectedOnly` is intentionally NOT persisted here — it's a UI
 * preference without category-prefixed keys, so the URL-only persistence
 * (existing behavior) is preserved for now. Can be added later if user
 * reports it as a similar pain point.
 */
export interface CategoryUiState {
  expandedSubGroups?: string[];
  collapsedGroups?: string[];
  chipExpandState?: string[];
}

/**
 * Read the per-category UI state from localStorage.
 *
 * Returns `null` when:
 * - localStorage is unavailable (SSR, privacy mode, disabled).
 * - The key is not set (no UI state saved for this category yet).
 * - The stored value fails JSON.parse or is not a plain object.
 * - The stored object has no valid string-array fields.
 *
 * Callers should treat the returned arrays as opaque strings that match
 * against `expandedSubGroups` / `collapsedGroups` / `chipExpandState` in
 * the filter store. Missing fields mean "default empty Set".
 */
export function readUiState(categoryId: string): CategoryUiState | null {
  try {
    const raw = localStorage.getItem(PREFIX + uiStateKey(categoryId));
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    // Sanitize: only keep string arrays for known fields. Non-string entries
    // filtered out (defensive against malformed localStorage from old code).
    const sanitizeStringArray = (v: unknown): string[] | undefined => {
      if (!Array.isArray(v)) return undefined;
      const filtered = v.filter((x): x is string => typeof x === 'string');
      return filtered.length > 0 ? filtered : undefined;
    };
    const result: CategoryUiState = {};
    const esg = sanitizeStringArray(obj.expandedSubGroups);
    if (esg) result.expandedSubGroups = esg;
    const cg = sanitizeStringArray(obj.collapsedGroups);
    if (cg) result.collapsedGroups = cg;
    const ce = sanitizeStringArray(obj.chipExpandState);
    if (ce) result.chipExpandState = ce;
    // If all fields are missing/empty, treat as "no state" (returns null so
    // callers can fall through to default behavior without checking fields).
    if (!result.expandedSubGroups && !result.collapsedGroups && !result.chipExpandState) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Persist the per-category UI state to localStorage.
 * Silently no-ops if localStorage is unavailable.
 *
 * Empty arrays are dropped from the stored object to keep it minimal. If
 * ALL three arrays are empty (or undefined), the key is removed entirely
 * (matches `writeFavorites` omit-when-default pattern — keeps localStorage
 * clean when the user reverts to all-defaults).
 */
export function writeUiState(categoryId: string, state: CategoryUiState): void {
  try {
    const sanitized: CategoryUiState = {};
    if (state.expandedSubGroups && state.expandedSubGroups.length > 0) {
      sanitized.expandedSubGroups = state.expandedSubGroups;
    }
    if (state.collapsedGroups && state.collapsedGroups.length > 0) {
      sanitized.collapsedGroups = state.collapsedGroups;
    }
    if (state.chipExpandState && state.chipExpandState.length > 0) {
      sanitized.chipExpandState = state.chipExpandState;
    }
    const hasAny =
      (sanitized.expandedSubGroups?.length ?? 0) > 0 ||
      (sanitized.collapsedGroups?.length ?? 0) > 0 ||
      (sanitized.chipExpandState?.length ?? 0) > 0;
    if (!hasAny) {
      // All-empty → remove key entirely (keeps localStorage clean).
      localStorage.removeItem(PREFIX + uiStateKey(categoryId));
    } else {
      localStorage.setItem(PREFIX + uiStateKey(categoryId), JSON.stringify(sanitized));
    }
  } catch {
    // ignore — localStorage may be full, unavailable, or blocked.
  }
}

/**
 * Remove the UI state entry for a category from localStorage.
 * Used to keep localStorage clean when a category's expand/collapse state
 * reverts to all-defaults (no expanded/collapsed groups). Equivalent to
 * calling `writeUiState(categoryId, {})` but more explicit.
 */
export function clearUiState(categoryId: string): void {
  try {
    localStorage.removeItem(PREFIX + uiStateKey(categoryId));
  } catch {
    // ignore
  }
}

/**
 * Build the localStorage key (without the `poe2:` prefix) for a category's
 * UI state. Exposed so callers can subscribe to the `storage` event for
 * realtime multi-tab sync (same pattern as `favoritesStorageKey` from KI#30).
 *
 * Example:
 *   const key = uiStateStorageKey('ring'); // 'uistate:ring'
 *   window.addEventListener('storage', e => {
 *     if (e.key === 'poe2:' + key) { /* re-read UI state *\/ }
 *   });
 */
export function uiStateStorageKey(categoryId: string): string {
  return uiStateKey(categoryId);
}

/**
 * Filter a Set of category-prefixed keys to only those matching the given
 * category. Used by `useCategoryPage` on mount to drop cross-category leak
 * from the URL hash — the URL is shared across category pages, so amulet's
 * `amulet:prefix:positive-loot` keys leak into ring's store on navigation
 * but don't match any ring subgroups.
 *
 * Key format conventions (must match `FilterState` field docs in
 * `src/store/filter-store.ts`):
 *   - `collapsedGroups`:      `${categoryId}:${affix}`
 *   - `expandedSubGroups`:    `${categoryId}:${affix}:${subBlockKey}`
 *   - `chipExpandState`:      `${categoryId}:${affix}:${subBlockKey}`
 *
 * All three use the same `${categoryId}:` prefix, so the same filter works.
 *
 * Returns the SAME Set instance if it's empty (no allocation needed). For
 * non-empty Sets, always returns a NEW Set (caller can safely mutate the
 * original without affecting the filtered result).
 */
export function filterInCategoryKeys(set: Set<string>, categoryId: string): Set<string> {
  if (set.size === 0) return set;
  const prefix = categoryId + ':';
  const filtered = new Set<string>();
  for (const k of set) {
    if (k.startsWith(prefix)) filtered.add(k);
  }
  return filtered;
}
