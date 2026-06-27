// @vitest-environment jsdom
/**
 * KI#30 (iter 144) — per-category favorites persistence.
 *
 * Tests for the localStorage-backed favorites layer added in iter 144:
 *   - readFavorites / writeFavorites / clearFavorites round-trip.
 *   - Missing key → empty array (no favorites).
 *   - Corrupt JSON → empty array (silent fallback).
 *   - Non-array stored value → empty array (sanitized).
 *   - Non-string entries filtered out.
 *   - Ranges namespace (readFavoritesRanges / writeFavoritesRanges).
 *   - favoritesStorageKey / favoritesRangesStorageKey helpers.
 *
 * Mirrors the pattern in tests/store/local-settings.test.ts (iter 141 KI#26)
 * for the global settings — same SSR/privacy-mode-safe try/catch contract.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readFavorites,
  writeFavorites,
  clearFavorites,
  readFavoritesRanges,
  writeFavoritesRanges,
  clearFavoritesRanges,
  favoritesStorageKey,
  favoritesRangesStorageKey,
  type FavoriteRangeOverride,
} from '@store/local-settings';

describe('KI#30 (iter 144) — per-category favorites persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ─── readFavorites ───

  it('readFavorites returns [] when key is not set', () => {
    expect(readFavorites('belt')).toEqual([]);
    expect(readFavorites('ring')).toEqual([]);
    expect(readFavorites('amulet')).toEqual([]);
  });

  it('readFavorites returns stored JSON-parsed array', () => {
    localStorage.setItem('poe2:favorites:belt', JSON.stringify(['id-1', 'id-2', 'id-3']));
    expect(readFavorites('belt')).toEqual(['id-1', 'id-2', 'id-3']);
  });

  it('readFavorites is per-category — different categories have independent keys', () => {
    localStorage.setItem('poe2:favorites:belt', JSON.stringify(['belt-id']));
    localStorage.setItem('poe2:favorites:ring', JSON.stringify(['ring-id-1', 'ring-id-2']));
    expect(readFavorites('belt')).toEqual(['belt-id']);
    expect(readFavorites('ring')).toEqual(['ring-id-1', 'ring-id-2']);
    expect(readFavorites('amulet')).toEqual([]);
  });

  it('readFavorites returns [] when stored value is corrupt JSON', () => {
    localStorage.setItem('poe2:favorites:belt', '{not valid json');
    expect(readFavorites('belt')).toEqual([]);
  });

  it('readFavorites returns [] when stored value is not an array', () => {
    localStorage.setItem('poe2:favorites:belt', JSON.stringify({ not: 'an array' }));
    expect(readFavorites('belt')).toEqual([]);
    localStorage.setItem('poe2:favorites:belt', JSON.stringify('string-not-array'));
    expect(readFavorites('belt')).toEqual([]);
    localStorage.setItem('poe2:favorites:belt', JSON.stringify(42));
    expect(readFavorites('belt')).toEqual([]);
  });

  it('readFavorites filters out non-string entries from a stored array', () => {
    localStorage.setItem(
      'poe2:favorites:belt',
      JSON.stringify(['valid-id', 42, null, true, { obj: 'no' }, 'another-valid']),
    );
    expect(readFavorites('belt')).toEqual(['valid-id', 'another-valid']);
  });

  it('readFavorites returns [] when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    expect(readFavorites('belt')).toEqual([]);
    spy.mockRestore();
  });

  // ─── writeFavorites ───

  it('writeFavorites persists JSON-serialized array under poe2:favorites:<categoryId>', () => {
    writeFavorites('belt', ['id-1', 'id-2']);
    expect(localStorage.getItem('poe2:favorites:belt')).toBe(JSON.stringify(['id-1', 'id-2']));
  });

  it('writeFavorites is per-category — different categories write to different keys', () => {
    writeFavorites('belt', ['belt-id']);
    writeFavorites('ring', ['ring-id-1', 'ring-id-2']);
    expect(localStorage.getItem('poe2:favorites:belt')).toBe(JSON.stringify(['belt-id']));
    expect(localStorage.getItem('poe2:favorites:ring')).toBe(JSON.stringify(['ring-id-1', 'ring-id-2']));
  });

  it('writeFavorites persists an empty array', () => {
    writeFavorites('belt', []);
    expect(localStorage.getItem('poe2:favorites:belt')).toBe(JSON.stringify([]));
  });

  it('writeFavorites is a silent no-op when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writeFavorites('belt', ['id-1'])).not.toThrow();
    spy.mockRestore();
  });

  // ─── clearFavorites ───

  it('clearFavorites removes the per-category key', () => {
    localStorage.setItem('poe2:favorites:belt', JSON.stringify(['id-1']));
    expect(localStorage.getItem('poe2:favorites:belt')).not.toBeNull();
    clearFavorites('belt');
    expect(localStorage.getItem('poe2:favorites:belt')).toBeNull();
  });

  it('clearFavorites does NOT remove other categories\' keys', () => {
    localStorage.setItem('poe2:favorites:belt', JSON.stringify(['belt-id']));
    localStorage.setItem('poe2:favorites:ring', JSON.stringify(['ring-id']));
    clearFavorites('belt');
    expect(localStorage.getItem('poe2:favorites:belt')).toBeNull();
    expect(localStorage.getItem('poe2:favorites:ring')).toBe(JSON.stringify(['ring-id']));
  });

  it('clearFavorites is a silent no-op when key does not exist', () => {
    expect(() => clearFavorites('amulet')).not.toThrow();
  });

  // ─── Round-trip ───

  it('round-trip: writeFavorites then readFavorites returns the original array', () => {
    writeFavorites('belt', ['id-1', 'id-2', 'id-3']);
    expect(readFavorites('belt')).toEqual(['id-1', 'id-2', 'id-3']);

    writeFavorites('ring', []);
    expect(readFavorites('ring')).toEqual([]);
  });

  // ─── Storage key helpers (for `storage` event subscription) ───

  it('favoritesStorageKey returns the per-category key without poe2: prefix', () => {
    expect(favoritesStorageKey('belt')).toBe('favorites:belt');
    expect(favoritesStorageKey('ring')).toBe('favorites:ring');
    expect(favoritesStorageKey('amulet')).toBe('favorites:amulet');
  });

  it('favoritesStorageKey + poe2: prefix matches the actual localStorage key', () => {
    writeFavorites('belt', ['id-1']);
    const computedKey = 'poe2:' + favoritesStorageKey('belt');
    expect(localStorage.getItem(computedKey)).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KI#31 variant (d) — per-favorite range overrides persistence.
// ─────────────────────────────────────────────────────────────────────────────

describe('KI#31 variant (d) (iter 144) — per-favorite range overrides persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ─── readFavoritesRanges ───

  it('readFavoritesRanges returns {} when key is not set', () => {
    expect(readFavoritesRanges('belt')).toEqual({});
    expect(readFavoritesRanges('ring')).toEqual({});
  });

  it('readFavoritesRanges returns stored JSON-parsed record', () => {
    const ranges: Record<string, FavoriteRangeOverride> = {
      'tok-1': { min: 30, max: 50 },
      'tok-2': { min: 10 },
      'tok-3': { max: 80 },
    };
    localStorage.setItem('poe2:favorites:belt:ranges', JSON.stringify(ranges));
    expect(readFavoritesRanges('belt')).toEqual(ranges);
  });

  it('readFavoritesRanges is per-category — separate from favorites IDs key', () => {
    localStorage.setItem('poe2:favorites:belt', JSON.stringify(['tok-1']));
    localStorage.setItem('poe2:favorites:belt:ranges', JSON.stringify({ 'tok-1': { min: 30 } }));
    expect(readFavorites('belt')).toEqual(['tok-1']);
    expect(readFavoritesRanges('belt')).toEqual({ 'tok-1': { min: 30 } });
  });

  it('readFavoritesRanges returns {} when stored value is corrupt JSON', () => {
    localStorage.setItem('poe2:favorites:belt:ranges', '{not valid json');
    expect(readFavoritesRanges('belt')).toEqual({});
  });

  it('readFavoritesRanges returns {} when stored value is not a plain object', () => {
    localStorage.setItem('poe2:favorites:belt:ranges', JSON.stringify(['not', 'an', 'object']));
    expect(readFavoritesRanges('belt')).toEqual({});
    localStorage.setItem('poe2:favorites:belt:ranges', JSON.stringify(42));
    expect(readFavoritesRanges('belt')).toEqual({});
    localStorage.setItem('poe2:favorites:belt:ranges', JSON.stringify(null));
    expect(readFavoritesRanges('belt')).toEqual({});
  });

  it('readFavoritesRanges sanitizes non-numeric min/max fields', () => {
    localStorage.setItem(
      'poe2:favorites:belt:ranges',
      JSON.stringify({
        'tok-valid': { min: 30, max: 50 },
        'tok-bad-min': { min: 'not-a-number', max: 50 },
        'tok-bad-max': { min: 30, max: 'also-not-a-number' },
        'tok-bad-both': { min: null, max: null },
        'tok-empty': {},
      }),
    );
    expect(readFavoritesRanges('belt')).toEqual({
      'tok-valid': { min: 30, max: 50 },
      'tok-bad-min': { max: 50 },
      'tok-bad-max': { min: 30 },
      // 'tok-bad-both' and 'tok-empty' have NO valid fields → filtered out.
    });
  });

  it('readFavoritesRanges returns {} when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    expect(readFavoritesRanges('belt')).toEqual({});
    spy.mockRestore();
  });

  // ─── writeFavoritesRanges ───

  it('writeFavoritesRanges persists JSON-serialized record under poe2:favorites:<categoryId>:ranges', () => {
    const ranges: Record<string, FavoriteRangeOverride> = {
      'tok-1': { min: 30, max: 50 },
      'tok-2': { min: 10 },
    };
    writeFavoritesRanges('belt', ranges);
    expect(localStorage.getItem('poe2:favorites:belt:ranges')).toBe(JSON.stringify(ranges));
  });

  it('writeFavoritesRanges persists an empty record', () => {
    writeFavoritesRanges('belt', {});
    expect(localStorage.getItem('poe2:favorites:belt:ranges')).toBe(JSON.stringify({}));
  });

  it('writeFavoritesRanges is a silent no-op when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writeFavoritesRanges('belt', { 'tok-1': { min: 30 } })).not.toThrow();
    spy.mockRestore();
  });

  // ─── clearFavoritesRanges ───

  it('clearFavoritesRanges removes the per-category ranges key', () => {
    localStorage.setItem('poe2:favorites:belt:ranges', JSON.stringify({ 'tok-1': { min: 30 } }));
    expect(localStorage.getItem('poe2:favorites:belt:ranges')).not.toBeNull();
    clearFavoritesRanges('belt');
    expect(localStorage.getItem('poe2:favorites:belt:ranges')).toBeNull();
  });

  it('clearFavoritesRanges does NOT remove the favorites IDs key', () => {
    localStorage.setItem('poe2:favorites:belt', JSON.stringify(['tok-1']));
    localStorage.setItem('poe2:favorites:belt:ranges', JSON.stringify({ 'tok-1': { min: 30 } }));
    clearFavoritesRanges('belt');
    expect(localStorage.getItem('poe2:favorites:belt:ranges')).toBeNull();
    expect(localStorage.getItem('poe2:favorites:belt')).toBe(JSON.stringify(['tok-1']));
  });

  // ─── Round-trip ───

  it('round-trip: writeFavoritesRanges then readFavoritesRanges returns the original record', () => {
    const ranges: Record<string, FavoriteRangeOverride> = {
      'tok-1': { min: 30, max: 50 },
      'tok-2': { min: 10 },
      'tok-3': { max: 80 },
    };
    writeFavoritesRanges('belt', ranges);
    expect(readFavoritesRanges('belt')).toEqual(ranges);
  });

  // ─── Storage key helper ───

  it('favoritesRangesStorageKey returns the per-category ranges key without poe2: prefix', () => {
    expect(favoritesRangesStorageKey('belt')).toBe('favorites:belt:ranges');
    expect(favoritesRangesStorageKey('ring')).toBe('favorites:ring:ranges');
  });

  it('favoritesRangesStorageKey + poe2: prefix matches the actual localStorage key', () => {
    writeFavoritesRanges('belt', { 'tok-1': { min: 30 } });
    const computedKey = 'poe2:' + favoritesRangesStorageKey('belt');
    expect(localStorage.getItem(computedKey)).not.toBeNull();
  });
});
