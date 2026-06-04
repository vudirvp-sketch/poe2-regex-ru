/**
 * URL Sync — Synchronize filter state with URL hash using lz-string compression.
 *
 * Encodes filter state into URL hash parameters so users can share
 * search configurations via URL. Uses lz-string for compression
 * to keep URLs short.
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { FilterStore } from './filter-store';

const HASH_PREFIX = '#q=';

/**
 * Serialize filter store state to URL hash.
 */
export function syncToUrl(store: FilterStore): void {
  try {
    const data = store.serialize();
    const json = JSON.stringify(data);
    const compressed = compressToEncodedURIComponent(json);
    const hash = `${HASH_PREFIX}${compressed}`;
    // Use replace to avoid adding history entries
    window.history.replaceState(null, '', hash);
  } catch (err) {
    console.warn('Failed to sync state to URL:', err);
  }
}

/**
 * Deserialize URL hash to filter store state.
 * Returns true if state was successfully restored.
 */
export function syncFromUrl(store: FilterStore): boolean {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith(HASH_PREFIX)) return false;

    const compressed = hash.slice(HASH_PREFIX.length);
    if (!compressed) return false;

    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) return false;

    const data = JSON.parse(json) as Record<string, unknown>;
    store.deserialize(data);
    return true;
  } catch (err) {
    console.warn('Failed to restore state from URL:', err);
    return false;
  }
}

/**
 * Generate a shareable URL for the current filter state.
 */
export function getShareableUrl(store: FilterStore): string {
  try {
    const data = store.serialize();
    const json = JSON.stringify(data);
    const compressed = compressToEncodedURIComponent(json);
    return `${window.location.origin}${window.location.pathname}${HASH_PREFIX}${compressed}`;
  } catch {
    return window.location.href;
  }
}
