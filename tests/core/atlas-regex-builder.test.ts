/**
 * Tests for atlas-regex-builder (iter 176).
 *
 * The Atlas tree search bar uses OR-only regex semantics (verified in-game
 * iter 175 — see STATUS.md "Atlas-семантика"). The builder:
 *   - Joins names with `|` inside one quoted group: `"А|Б|В"`.
 *   - Sorts alphabetically for stable output.
 *   - Dedupes names.
 *   - Splits into multiple parts when the full regex exceeds 250 chars.
 *
 * Verified in-game Atlas semantics:
 *   ✅ substring, quoted phrase, OR multi-word, `.*` bridge, case-insensitive
 *   ❌ AND, NOT (do not generate these — they break matching)
 */
import { describe, it, expect } from 'vitest';
import { buildAtlasRegex } from '@core/atlas-regex-builder';
import { MAX_CHARS } from '@core/limits';

describe('buildAtlasRegex — basic', () => {
  it('returns empty result for no names', () => {
    const r = buildAtlasRegex([]);
    expect(r.regex).toBe('');
    expect(r.isOverflow).toBe(false);
    expect(r.regexParts).toEqual([]);
  });

  it('returns empty result for empty/whitespace names', () => {
    const r = buildAtlasRegex(['', '   ', '\t']);
    expect(r.regex).toBe('');
    expect(r.isOverflow).toBe(false);
  });

  it('builds a single quoted OR group for one name', () => {
    const r = buildAtlasRegex(['Служитель Тьмы']);
    expect(r.regex).toBe('"Служитель Тьмы"');
    expect(r.isOverflow).toBe(false);
    expect(r.regexParts).toEqual([]);
  });

  it('builds a single quoted OR group for multiple names', () => {
    const r = buildAtlasRegex(['Служитель Тьмы', 'Хранитель духа', 'Крошитель костей']);
    // Sorted alphabetically (Russian locale).
    expect(r.regex).toBe('"Крошитель костей|Служитель Тьмы|Хранитель духа"');
    expect(r.isOverflow).toBe(false);
    expect(r.regexParts).toEqual([]);
  });

  it('sorts names alphabetically for stable output', () => {
    const r1 = buildAtlasRegex(['В', 'А', 'Г', 'Б']);
    const r2 = buildAtlasRegex(['Г', 'Б', 'А', 'В']);
    expect(r1.regex).toBe(r2.regex);
    expect(r1.regex).toBe('"А|Б|В|Г"');
  });

  it('dedupes names preserving first occurrence', () => {
    const r = buildAtlasRegex(['А', 'Б', 'А', 'В', 'Б']);
    expect(r.regex).toBe('"А|Б|В"');
  });

  it('trims whitespace before joining', () => {
    const r = buildAtlasRegex(['  А  ', 'Б']);
    expect(r.regex).toBe('"А|Б"');
  });
});

describe('buildAtlasRegex — overflow split', () => {
  it('does not split when total length is exactly MAX_CHARS', () => {
    // Build names that produce a regex exactly 250 chars.
    // `"name1|name2"` = 2 (quotes) + name1.len + 1 (pipe) + name2.len
    // We want 2 + a + 1 + b = 250 → a + b = 247.
    const a = 'А'.repeat(123);
    const b = 'Б'.repeat(124);
    const r = buildAtlasRegex([a, b]);
    expect(r.regex.length).toBe(MAX_CHARS);
    expect(r.isOverflow).toBe(false);
    expect(r.regexParts).toEqual([]);
  });

  it('splits when total length exceeds MAX_CHARS', () => {
    // 30 names of 20 chars each → 30*20 + 29 pipes + 2 quotes = 672 chars.
    const names = Array.from({ length: 30 }, (_, i) =>
      `Нода${String(i).padStart(15, 'X')}`.slice(0, 20),
    );
    const r = buildAtlasRegex(names);
    expect(r.isOverflow).toBe(true);
    expect(r.regexParts.length).toBeGreaterThan(1);
    // Each part must fit within MAX_CHARS.
    for (const part of r.regexParts) {
      expect(part.length).toBeLessThanOrEqual(MAX_CHARS);
      // Each part is wrapped in quotes.
      expect(part.startsWith('"') && part.endsWith('"')).toBe(true);
    }
  });

  it('preserves all names across split parts (no data loss)', () => {
    const names = Array.from({ length: 25 }, (_, i) => `ДлинноеИмяНоды${i}XXX`);
    const r = buildAtlasRegex(names);
    expect(r.isOverflow).toBe(true);

    // Concatenate all parts (strip outer quotes, split on `|`) and verify
    // every input name appears exactly once.
    const allInParts = r.regexParts
      .flatMap((p) => p.slice(1, -1).split('|'))
      .sort((a, b) => a.localeCompare(b, 'ru'));
    const expected = [...new Set(names)].sort((a, b) =>
      a.localeCompare(b, 'ru'),
    );
    expect(allInParts).toEqual(expected);
  });

  it('handles a single name longer than MAX_CHARS (unavoidable overflow)', () => {
    const huge = 'А'.repeat(300);
    const r = buildAtlasRegex([huge]);
    expect(r.isOverflow).toBe(true);
    expect(r.regexParts).toHaveLength(1);
    // The part is the full oversized quoted name (cannot split further).
    expect(r.regexParts[0]).toBe(`"${huge}"`);
  });

  it('produces stable part count for the same input (idempotent)', () => {
    const names = Array.from({ length: 30 }, (_, i) => `Имя${i}`);
    const r1 = buildAtlasRegex(names);
    const r2 = buildAtlasRegex(names);
    expect(r1.regexParts).toEqual(r2.regexParts);
  });
});

describe('buildAtlasRegex — output format invariants', () => {
  it('always wraps the regex in outer quotes', () => {
    const r = buildAtlasRegex(['А', 'Б', 'В']);
    expect(r.regex.startsWith('"')).toBe(true);
    expect(r.regex.endsWith('"')).toBe(true);
  });

  it('uses top-level `|` between names (no `||`)', () => {
    const r = buildAtlasRegex(['А', 'Б', 'В']);
    expect(r.regex).not.toContain('||');
  });

  it('never emits AND (space between quoted groups) or NOT (`!`)', () => {
    // Atlas tree search breaks on AND/NOT — the builder MUST NOT emit them.
    const r = buildAtlasRegex(['А', 'Б', 'В']);
    // Single quoted group → no `" "` sequence (AND separator).
    expect(r.regex).not.toMatch(/"\s+"/);
    // No `!` anywhere.
    expect(r.regex).not.toContain('!');
    // No `.*` bridge (names are plain text, no bridges needed).
    expect(r.regex).not.toContain('.*');
  });
});
