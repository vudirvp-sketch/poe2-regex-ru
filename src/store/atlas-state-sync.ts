/**
 * atlas-state-sync — iter 183 — NEW.
 *
 * URL hash serialization for the Timeless Jewel page's selection state.
 * Separate from `url-sync.ts` (which targets `FilterStore` instances tied
 * to `GameToken`/category pages) because the Atlas page uses a different
 * data model (`AtlasNodeToken`, no familyKey/affix/ranges) and a separate
 * pipeline (per AGENT_NAVIGATION.md pitfall #28).
 *
 * ## URL hash scheme
 *
 *   `#tj=<lz-string-compressed JSON>`
 *
 * The `tj` prefix (Timeless Jewel) intentionally differs from `url-sync.ts`'s
 * `#q=` prefix. This way:
 *   - Navigating between `/belt` (which uses `#q=`) and `/timeless-jewel`
 *     does NOT cause one page to misparse the other's hash — each prefix
 *     is ignored by the other page's restore logic.
 *   - Shareable URLs are self-describing: `/timeless-jewel#tj=...` clearly
 *     carries atlas state, not a filter-store state.
 *
 * Note: there is still only ONE URL hash per URL, so navigating from
 * `/belt#q=...` to `/timeless-jewel` overwrites the hash with `#tj=...`
 * on the first state change. This matches the existing cross-category
 * behavior of filter-store pages (each page's mount clobbers the previous
 * page's hash). Cross-tab persistence via localStorage (similar to
 * `poe2:favorites:<cat>` / `poe2:uistate:<cat>`) is deferred — iter 183
 * scope is URL-share + ProfilePanel only.
 *
 * ## Serialized shape (compact keys, JSON)
 *
 *   {
 *     j: 'undying-hate' | 'heroic-tragedy',  // selected jewel
 *     s: string[],                            // selected node ids (ordered)
 *   }
 *
 * Empty `s` array is omitted on serialize (default = no selection).
 * Missing `j` on deserialize → default 'undying-hate' (first jewel).
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { AtlasJewelId } from '@shared/types';

/** Serialized shape (compact keys for URL brevity). */
export interface SerializedAtlasState {
  /** Selected jewel id. */
  j: AtlasJewelId;
  /** Selected node ids (ordered — order preserved on round-trip). */
  s: string[];
}

/** Hash prefix used by atlas-state-sync. Distinct from `url-sync.ts`'s `#q=`. */
const HASH_PREFIX = '#tj=';

/** Default jewel when none specified (matches TimelessJewelPage default). */
export const DEFAULT_ATLAS_JEWEL: AtlasJewelId = 'undying-hate';

/**
 * Validate that a value is a valid AtlasJewelId.
 * Used by deserialize to reject malformed URLs.
 */
function isAtlasJewelId(v: unknown): v is AtlasJewelId {
  return v === 'undying-hate' || v === 'heroic-tragedy';
}

/**
 * Serialize atlas selection state to a plain object (for URL/profile storage).
 *
 * Empty `s` array is kept (not omitted) so that profile save/load round-trips
 * a "cleared selection" state correctly. The URL-sync wrapper below decides
 * whether to write the URL hash based on whether BOTH jewel and s are default.
 */
export function serializeAtlasState(
  jewel: AtlasJewelId,
  ids: Set<string>,
): SerializedAtlasState {
  return {
    j: jewel,
    s: Array.from(ids),
  };
}

/**
 * Deserialize a plain object back to atlas selection state.
 *
 * Returns `null` when:
 *   - `data` is not a plain object.
 *   - `data.j` is missing or not a valid AtlasJewelId.
 *   - `data.s` is missing or not an array of strings.
 *
 * Defensive: filters out non-string entries in `s`, drops duplicates
 * (preserving first occurrence order).
 */
export function deserializeAtlasState(data: unknown): { jewel: AtlasJewelId; ids: Set<string> } | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;

  // jewel: default to DEFAULT_ATLAS_JEWEL when missing (backward compat
  // with old URLs that only had `s` and no `j`). Invalid values → null.
  let jewel: AtlasJewelId = DEFAULT_ATLAS_JEWEL;
  if (obj.j !== undefined) {
    if (!isAtlasJewelId(obj.j)) return null;
    jewel = obj.j;
  }

  // s: must be array of strings when present. Missing → empty set.
  const ids = new Set<string>();
  if (obj.s !== undefined) {
    if (!Array.isArray(obj.s)) return null;
    for (const v of obj.s) {
      if (typeof v === 'string' && v.length > 0) ids.add(v);
    }
  }

  return { jewel, ids };
}

/**
 * Write atlas state to the URL hash (replaceState — no history entry).
 *
 * Uses lz-string compression to keep URLs short. Silently no-ops when
 * `window.history` is unavailable (SSR / tests).
 */
export function syncAtlasStateToUrl(state: SerializedAtlasState): void {
  try {
    const json = JSON.stringify(state);
    const compressed = compressToEncodedURIComponent(json);
    const hash = `${HASH_PREFIX}${compressed}`;
    window.history.replaceState(null, '', hash);
  } catch (err) {
    console.warn('Failed to sync atlas state to URL:', err);
  }
}

/**
 * Read atlas state from the URL hash.
 *
 * Returns `null` when:
 *   - URL hash doesn't start with `#tj=`.
 *   - Decompression fails.
 *   - JSON.parse fails.
 *   - deserializeAtlasState returns null (invalid shape).
 */
export function syncAtlasStateFromUrl(): { jewel: AtlasJewelId; ids: Set<string> } | null {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith(HASH_PREFIX)) return null;
    const compressed = hash.slice(HASH_PREFIX.length);
    if (!compressed) return null;
    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    const data = JSON.parse(json);
    return deserializeAtlasState(data);
  } catch (err) {
    console.warn('Failed to restore atlas state from URL:', err);
    return null;
  }
}

/**
 * Build a shareable URL for the given atlas state.
 *
 * Returns the full URL (origin + pathname + `#tj=...` hash). When state
 * construction fails, falls back to the current `window.location.href`.
 */
export function getAtlasShareableUrl(state: SerializedAtlasState): string {
  try {
    const json = JSON.stringify(state);
    const compressed = compressToEncodedURIComponent(json);
    return `${window.location.origin}${window.location.pathname}${HASH_PREFIX}${compressed}`;
  } catch {
    return window.location.href;
  }
}
