/**
 * Local Settings — iter 141 (KI#26).
 *
 * Thin wrapper over `localStorage` for cross-tab persistence of user-level
 * settings (round10Enabled, searchLogic, minValue, maxValue, priorityFilter,
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
 * Not used for per-category state (selectedIds, pinnedIds, etc.) — those stay
 * in the Zustand store + URL hash. Cross-tab favorites persistence is a
 * separate concern (KI#30, deferred).
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
