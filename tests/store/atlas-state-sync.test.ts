// @vitest-environment jsdom
/**
 * Tests for atlas-state-sync (iter 183).
 *
 * Covers:
 *   - serialize/deserialize round-trip (jewel + ids).
 *   - Default jewel when `j` is missing (backward compat).
 *   - Invalid jewel → null.
 *   - Invalid `s` (non-array, non-string entries) → null or filtered.
 *   - Dedup on deserialize (preserves first-occurrence order).
 *   - URL hash round-trip via syncToUrl/syncFromUrl.
 *   - syncFromUrl returns null for: empty hash, `#q=` prefix (filter-store
 *     hash), invalid lz-string, invalid JSON, invalid shape.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';
import {
  serializeAtlasState,
  deserializeAtlasState,
  syncAtlasStateToUrl,
  syncAtlasStateFromUrl,
  getAtlasShareableUrl,
  DEFAULT_ATLAS_JEWEL,
} from '@store/atlas-state-sync';
import type { AtlasJewelId } from '@shared/types';

describe('atlas-state-sync — serialize/deserialize', () => {
  it('round-trips jewel + ids', () => {
    const jewel: AtlasJewelId = 'heroic-tragedy';
    const ids = new Set(['undying-hate.node1', 'undying-hate.node2']);
    const serialized = serializeAtlasState(jewel, ids);
    const deserialized = deserializeAtlasState(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.jewel).toBe('heroic-tragedy');
    expect(deserialized!.ids).toEqual(new Set(['undying-hate.node1', 'undying-hate.node2']));
  });

  it('round-trips empty ids set', () => {
    const serialized = serializeAtlasState('undying-hate', new Set());
    const deserialized = deserializeAtlasState(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.jewel).toBe('undying-hate');
    expect(deserialized!.ids.size).toBe(0);
  });

  it('defaults to DEFAULT_ATLAS_JEWEL when `j` is missing (backward compat)', () => {
    // Old URLs that only had `s` and no `j` should still restore.
    const deserialized = deserializeAtlasState({ s: ['node1', 'node2'] });

    expect(deserialized).not.toBeNull();
    expect(deserialized!.jewel).toBe(DEFAULT_ATLAS_JEWEL);
    expect(deserialized!.ids.size).toBe(2);
  });

  it('defaults to empty set when `s` is missing', () => {
    const deserialized = deserializeAtlasState({ j: 'undying-hate' });

    expect(deserialized).not.toBeNull();
    expect(deserialized!.jewel).toBe('undying-hate');
    expect(deserialized!.ids.size).toBe(0);
  });

  it('returns null for invalid jewel value', () => {
    expect(deserializeAtlasState({ j: 'invalid-jewel', s: [] })).toBeNull();
    expect(deserializeAtlasState({ j: 42, s: [] })).toBeNull();
    expect(deserializeAtlasState({ j: null, s: [] })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(deserializeAtlasState(null)).toBeNull();
    expect(deserializeAtlasState('string')).toBeNull();
    expect(deserializeAtlasState(42)).toBeNull();
    expect(deserializeAtlasState(undefined)).toBeNull();
    expect(deserializeAtlasState([1, 2, 3])).toBeNull();
  });

  it('returns null when `s` is not an array', () => {
    expect(deserializeAtlasState({ j: 'undying-hate', s: 'not-array' })).toBeNull();
    expect(deserializeAtlasState({ j: 'undying-hate', s: 42 })).toBeNull();
    expect(deserializeAtlasState({ j: 'undying-hate', s: {} })).toBeNull();
  });

  it('filters out non-string and empty-string entries in `s`', () => {
    const deserialized = deserializeAtlasState({
      j: 'undying-hate',
      s: ['valid1', 42, null, undefined, { obj: true }, '', 'valid2'],
    });

    expect(deserialized).not.toBeNull();
    expect(deserialized!.ids).toEqual(new Set(['valid1', 'valid2']));
  });

  it('dedupes ids preserving first-occurrence order', () => {
    const deserialized = deserializeAtlasState({
      j: 'undying-hate',
      s: ['a', 'b', 'a', 'c', 'b'],
    });

    expect(deserialized).not.toBeNull();
    expect(Array.from(deserialized!.ids)).toEqual(['a', 'b', 'c']);
  });
});

describe('atlas-state-sync — URL hash', () => {
  const originalHash = window.location.hash;

  beforeEach(() => {
    // Reset hash before each test.
    window.history.replaceState(null, '', '#');
  });

  afterEach(() => {
    // Restore original hash after each test.
    window.history.replaceState(null, '', originalHash);
  });

  it('syncToUrl writes #tj=... hash', () => {
    const serialized = serializeAtlasState('undying-hate', new Set(['a', 'b']));
    syncAtlasStateToUrl(serialized);

    expect(window.location.hash.startsWith('#tj=')).toBe(true);
  });

  it('syncFromUrl returns null when hash is empty', () => {
    expect(syncAtlasStateFromUrl()).toBeNull();
  });

  it('syncFromUrl returns null for #q= prefix (filter-store hash)', () => {
    // filter-store uses `#q=...` — atlas sync should ignore it.
    window.history.replaceState(null, '', '#q=somefilterstoredata');
    expect(syncAtlasStateFromUrl()).toBeNull();
  });

  it('round-trips through URL hash', () => {
    const jewel: AtlasJewelId = 'heroic-tragedy';
    const ids = new Set(['node1', 'node2', 'node3']);
    syncAtlasStateToUrl(serializeAtlasState(jewel, ids));

    const restored = syncAtlasStateFromUrl();
    expect(restored).not.toBeNull();
    expect(restored!.jewel).toBe('heroic-tragedy');
    expect(restored!.ids).toEqual(new Set(['node1', 'node2', 'node3']));
  });

  it('round-trips empty ids through URL hash', () => {
    syncAtlasStateToUrl(serializeAtlasState('undying-hate', new Set()));

    const restored = syncAtlasStateFromUrl();
    expect(restored).not.toBeNull();
    expect(restored!.jewel).toBe('undying-hate');
    expect(restored!.ids.size).toBe(0);
  });

  it('returns null for invalid lz-string payload', () => {
    window.history.replaceState(null, '', '#tj=!!!invalid-lz-string!!!');
    expect(syncAtlasStateFromUrl()).toBeNull();
  });

  it('returns null for valid lz-string but invalid JSON', () => {
    // Manually craft a hash that decompresses to non-JSON.
    // We use a known lz-string output that decompresses to plain text.
    // Easier: use compressToEncodedURIComponent on a non-JSON string.
    const badPayload = compressToEncodedURIComponent('not-json-at-all');
    window.history.replaceState(null, '', `#tj=${badPayload}`);
    expect(syncAtlasStateFromUrl()).toBeNull();
  });

  it('returns null for valid JSON but invalid atlas state shape', () => {
    // Valid JSON, but `j` is invalid.
    const badPayload = compressToEncodedURIComponent(JSON.stringify({ j: 'invalid', s: [] }));
    window.history.replaceState(null, '', `#tj=${badPayload}`);
    expect(syncAtlasStateFromUrl()).toBeNull();
  });

  it('getAtlasShareableUrl returns full URL with #tj= hash', () => {
    const url = getAtlasShareableUrl(serializeAtlasState('undying-hate', new Set(['x'])));
    expect(url).toContain('#tj=');
    expect(url).toContain(window.location.origin);
    expect(url).toContain(window.location.pathname);
  });
});
