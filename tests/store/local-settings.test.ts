// @vitest-environment jsdom
/**
 * Tests for local-settings — iter 141 (KI#26).
 *
 * Verifies the localStorage-backed persistence layer used for cross-tab
 * sync of global user settings (round10Enabled, searchLogic, etc.).
 *
 * Coverage:
 * - readLocalSetting returns fallback when key is not set.
 * - readLocalSetting returns stored JSON-parsed value.
 * - readLocalSetting returns fallback when stored value is corrupt JSON.
 * - readLocalSetting returns fallback when localStorage throws.
 * - writeLocalSetting persists JSON-serialized value under `poe2:<key>`.
 * - writeLocalSetting is a silent no-op when localStorage throws.
 * - clearLocalSetting removes the key.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readLocalSetting, writeLocalSetting, clearLocalSetting } from '@store/local-settings';

describe('local-settings — iter 141 (KI#26)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('readLocalSetting returns fallback when key is not set', () => {
    expect(readLocalSetting('missing_key', 'default')).toBe('default');
    expect(readLocalSetting('missing_bool', true)).toBe(true);
    expect(readLocalSetting('missing_num', 42)).toBe(42);
    expect(readLocalSetting('missing_null', null)).toBe(null);
  });

  it('readLocalSetting returns stored JSON-parsed value', () => {
    localStorage.setItem('poe2:round10Enabled', 'true');
    expect(readLocalSetting('round10Enabled', false)).toBe(true);

    localStorage.setItem('poe2:searchLogic', '"or"');
    expect(readLocalSetting('searchLogic', 'and')).toBe('or');

    localStorage.setItem('poe2:minValue', '15');
    expect(readLocalSetting('minValue', null)).toBe(15);

    localStorage.setItem('poe2:priorityFilter', '"S+A"');
    expect(readLocalSetting('priorityFilter', 'all')).toBe('S+A');
  });

  it('readLocalSetting returns fallback when stored value is corrupt JSON', () => {
    localStorage.setItem('poe2:bad_data', '{not valid json');
    expect(readLocalSetting('bad_data', 'fallback')).toBe('fallback');
  });

  it('readLocalSetting returns fallback when localStorage throws', () => {
    // Mock localStorage.getItem to throw.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    expect(readLocalSetting('any_key', 'fallback')).toBe('fallback');
    spy.mockRestore();
  });

  it('writeLocalSetting persists JSON-serialized value under poe2:<key>', () => {
    writeLocalSetting('round10Enabled', true);
    expect(localStorage.getItem('poe2:round10Enabled')).toBe('true');

    writeLocalSetting('searchLogic', 'or');
    expect(localStorage.getItem('poe2:searchLogic')).toBe('"or"');

    writeLocalSetting('minValue', 25);
    expect(localStorage.getItem('poe2:minValue')).toBe('25');

    writeLocalSetting('maxValue', null);
    expect(localStorage.getItem('poe2:maxValue')).toBe('null');
  });

  it('writeLocalSetting is a silent no-op when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    // Should NOT throw — writeLocalSetting swallows the error.
    expect(() => writeLocalSetting('any_key', 'any_value')).not.toThrow();
    spy.mockRestore();
  });

  it('clearLocalSetting removes the key', () => {
    localStorage.setItem('poe2:temp_key', '"value"');
    expect(localStorage.getItem('poe2:temp_key')).not.toBeNull();
    clearLocalSetting('temp_key');
    expect(localStorage.getItem('poe2:temp_key')).toBeNull();
  });

  it('round-trip: write then read returns the original value', () => {
    writeLocalSetting('round10Enabled', false);
    expect(readLocalSetting('round10Enabled', true)).toBe(false);

    writeLocalSetting('searchLogic', 'and');
    expect(readLocalSetting('searchLogic', 'or')).toBe('and');

    writeLocalSetting('minValue', null);
    expect(readLocalSetting('minValue', 10)).toBe(null);
  });
});
