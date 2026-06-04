import { describe, it, expect } from 'vitest';
import { MAX_CHARS, getCharCount, isOverflow, getCharHealth } from '@core/limits';

describe('limits', () => {
  it('MAX_CHARS is 250', () => {
    expect(MAX_CHARS).toBe(250);
  });

  it('getCharCount returns string length', () => {
    expect(getCharCount('hello')).toBe(5);
    expect(getCharCount('привет')).toBe(6); // Cyrillic: 6 characters, NOT 12 bytes
  });

  it('isOverflow returns true when > 250 chars', () => {
    expect(isOverflow('a'.repeat(251))).toBe(true);
    expect(isOverflow('a'.repeat(250))).toBe(false);
    expect(isOverflow('a'.repeat(200))).toBe(false);
  });

  it('getCharHealth returns green for <= 200', () => {
    const health = getCharHealth('a'.repeat(100));
    expect(health.level).toBe('green');
    expect(health.count).toBe(100);
    expect(health.max).toBe(250);
  });

  it('getCharHealth returns yellow for 201-240', () => {
    const health = getCharHealth('a'.repeat(220));
    expect(health.level).toBe('yellow');
  });

  it('getCharHealth returns red for > 240', () => {
    const health = getCharHealth('a'.repeat(245));
    expect(health.level).toBe('red');
  });

  it('getCharHealth percentage calculation', () => {
    const health = getCharHealth('a'.repeat(125));
    expect(health.percentage).toBe(50);
  });
});
