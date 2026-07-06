/**
 * atlas-regex-builder.ts — Simplified regex builder for Atlas Timeless Jewels.
 *
 * iter 176 — NEW. NOT part of the existing item-regex pipeline
 * (compiler.ts / optimizer.ts / ast.ts). The Atlas tree search bar uses a
 * different regex dialect (verified in-game iter 175 — see STATUS.md
 * "Atlas-семантика"):
 *
 *   - Substring / quoted phrase      ✅
 *   - OR multi-word  `"А Б\|В Г"`    ✅  ← KEY DIFFERENCE from item-regex
 *   - AND             `"А" "Б"`      ❌  (0 matches)
 *   - NOT             `"!А\|Б"`      ❌  (highlights ALL nodes)
 *   - `.*` bridge inside quoted group ✅
 *   - Case-insensitive                ✅
 *   - 250-char limit per regex        ✅  (same as item-regex)
 *
 * So the only useful operation is "highlight ANY of these node names" = OR.
 *
 * ## Output format
 *
 *   Single quoted group with top-level `|`:
 *     `"Name One|Name Two|Name Three"`
 *
 *   When the total exceeds MAX_CHARS (250), the builder splits into multiple
 *   parts, each a valid standalone OR-group the player pastes one at a time
 *   (same UX as `splitOverLimitRegex` for items).
 *
 * ## Why not reuse splitOverLimitRegex()
 *
 *   `splitOverLimitRegex` expects the compiled regex string (with outer
 *   quotes) and re-splits at top-level `|`. We could call it, but:
 *     - It would parse the string we just built, adding round-trip noise.
 *     - Atlas names are plain text (no metachars, no `.*` bridges needed),
 *       so the splitter is overkill — we can directly bucket names by
 *       accumulated length during the join.
 *   Keeping the split inline keeps the module self-contained and dependency-
 *   free (consistent with the `src/core/` "ZERO npm deps" rule).
 */
import { MAX_CHARS } from './limits.js';

export interface AtlasRegexResult {
  /** Full compiled regex string (with outer quotes). Empty when nothing selected. */
  regex: string;
  /** True when the full regex exceeds MAX_CHARS and was split. */
  isOverflow: boolean;
  /**
   * When `isOverflow` is true: array of regex PARTS (each with outer quotes,
   * each ≤ MAX_CHARS). The user pastes them one at a time. When false: empty
   * array (use `regex` directly).
   */
  regexParts: string[];
}

/**
 * Build an Atlas-tree search regex from a list of node names.
 *
 * @param names  Node display names (Russian). Empty strings are filtered out.
 *               Duplicates are removed (stable order — first occurrence wins).
 * @returns      { regex, isOverflow, regexParts }. When `names` is empty
 *               after filtering, returns { regex: '', isOverflow: false, regexParts: [] }.
 *
 * @example
 *   buildAtlasRegex(['Служитель Тьмы', 'Хранитель духа'])
 *   // → { regex: '"Служитель Тьмы|Хранитель духа"', isOverflow: false, regexParts: [] }
 *
 *   buildAtlasRegex([...30 long names...])
 *   // → { regex: '"...|..."', isOverflow: true,
 *       regexParts: ['"part1 names"', '"part2 names"', ...] }
 */
export function buildAtlasRegex(names: readonly string[]): AtlasRegexResult {
  // Filter empty + dedupe preserving order.
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const n of names) {
    const trimmed = (n ?? '').trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
  }

  if (cleaned.length === 0) {
    return { regex: '', isOverflow: false, regexParts: [] };
  }

  // Sort alphabetically for stable output (helps URL-sync equality checks).
  // Russian locale-aware sort via Intl.Collator (default for ru-RU).
  const sorted = [...cleaned].sort((a, b) => a.localeCompare(b, 'ru'));

  const full = `"${sorted.join('|')}"`;

  if (full.length <= MAX_CHARS) {
    return { regex: full, isOverflow: false, regexParts: [] };
  }

  // Overflow → greedy first-fit split. Each part = `"name1|name2|..."`
  // (2 quotes + N names + (N-1) pipes). We pack names until adding the next
  // would exceed MAX_CHARS, then start a new part.
  const parts: string[] = [];
  let current: string[] = [];
  let currentLen = 2; // outer quotes

  for (const name of sorted) {
    const pipe = current.length > 0 ? 1 : 0;
    const next = currentLen + pipe + name.length;
    if (next <= MAX_CHARS) {
      current.push(name);
      currentLen = next;
    } else {
      if (current.length > 0) parts.push(`"${current.join('|')}"`);
      current = [name];
      currentLen = 2 + name.length;
    }
  }
  if (current.length > 0) parts.push(`"${current.join('|')}"`);

  // Edge case: a single name longer than MAX_CHARS-2 — unavoidable overflow,
  // it stays as its own oversized part (matches splitOverLimitRegex behaviour).
  return { regex: full, isOverflow: true, regexParts: parts };
}
