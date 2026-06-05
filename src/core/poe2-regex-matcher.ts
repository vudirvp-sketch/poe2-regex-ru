/**
 * PoE2 Regex Matcher — Simulates the in-game search behavior.
 *
 * ARCHITECTURE: All pattern matching is positional — each element must
 * match at the exact position specified by `startIndex`. The outer
 * `matchQuotedGroup` function tries every starting position to implement
 * PoE2's substring search behavior. This makes sequences work correctly:
 * after a `.`, the next element must match at the position right after.
 *
 * PoE2 regex dialect features:
 * - Substring match (case-insensitive)
 * - `.` any single char, `.*` any sequence
 * - `|` OR, `!` NOT, `""` grouping, space between = AND
 * - `[]` character class, `()` grouping, `?` optional
 * - `^` / `$` anchors
 *
 * IMPORTANT: Number regex patterns are HEURISTICS, not precise filters.
 * `\d..` matches any 3-char sequence starting with a digit.
 * The suffix constraint makes them practical for game items.
 *
 * This file is in src/core/ — ZERO external dependencies.
 */

// ─── Tokenizer ───

type Token =
  | { type: 'literal'; value: string }
  | { type: 'dot' }
  | { type: 'dotStar' }
  | { type: 'pipe' }
  | { type: 'bang' }
  | { type: 'charClass'; ranges: CharRange[] }
  | { type: 'groupOpen' }
  | { type: 'groupClose' }
  | { type: 'optional' }
  | { type: 'anchorStart' }
  | { type: 'anchorEnd' };

interface CharRange {
  from: number;
  to: number;
}

function tokenize(pattern: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === '.' && i + 1 < pattern.length && pattern[i + 1] === '*') {
      tokens.push({ type: 'dotStar' });
      i += 2;
    } else if (ch === '.') {
      tokens.push({ type: 'dot' });
      i++;
    } else if (ch === '|') {
      tokens.push({ type: 'pipe' });
      i++;
    } else if (ch === '!') {
      tokens.push({ type: 'bang' });
      i++;
    } else if (ch === '(') {
      tokens.push({ type: 'groupOpen' });
      i++;
    } else if (ch === ')') {
      tokens.push({ type: 'groupClose' });
      i++;
    } else if (ch === '?') {
      tokens.push({ type: 'optional' });
      i++;
    } else if (ch === '^') {
      tokens.push({ type: 'anchorStart' });
      i++;
    } else if (ch === '$') {
      tokens.push({ type: 'anchorEnd' });
      i++;
    } else if (ch === '[') {
      i++; // skip [
      const ranges: CharRange[] = [];
      let negated = false;
      if (i < pattern.length && pattern[i] === '^') {
        negated = true;
        i++;
      }
      while (i < pattern.length && pattern[i] !== ']') {
        const from = pattern.charCodeAt(i);
        if (i + 2 < pattern.length && pattern[i + 1] === '-') {
          const to = pattern.charCodeAt(i + 2);
          ranges.push({ from, to });
          i += 3;
        } else {
          ranges.push({ from, to: from });
          i++;
        }
      }
      if (i < pattern.length) i++; // skip ]
      if (negated) {
        tokens.push({ type: 'charClass', ranges: [{ from: -1, to: -1 }, ...ranges] });
      } else {
        tokens.push({ type: 'charClass', ranges });
      }
    } else if (ch === '\\') {
      i++;
      if (i < pattern.length) {
        const escaped = pattern[i];
        if (escaped === 'd') {
          tokens.push({ type: 'charClass', ranges: [{ from: 48, to: 57 }] });
        } else {
          tokens.push({ type: 'literal', value: escaped });
        }
        i++;
      }
    } else {
      let literal = '';
      while (i < pattern.length) {
        const c = pattern[i];
        if (c === '.' || c === '|' || c === '!' || c === '(' || c === ')' ||
            c === '[' || c === '^' || c === '$' || c === '\\' || c === '?') break;
        literal += c;
        i++;
      }
      if (literal) {
        tokens.push({ type: 'literal', value: literal });
      }
    }
  }

  return tokens;
}

// ─── PoE2 Regex AST ───

type PoE2Regex =
  | { type: 'alternation'; alternatives: PoE2Regex[] }
  | { type: 'sequence'; items: PoE2Regex[] }
  | { type: 'negation'; inner: PoE2Regex }
  | { type: 'literal'; value: string }
  | { type: 'dot' }
  | { type: 'dotStar' }
  | { type: 'charClass'; ranges: CharRange[] }
  | { type: 'optional'; inner: PoE2Regex }
  | { type: 'anchorStart' }
  | { type: 'anchorEnd' };

// ─── Parser ───

export function parsePoE2Regex(pattern: string): PoE2Regex {
  const tokens = tokenize(pattern);
  let pos = 0;

  function parseAlternation(): PoE2Regex {
    const alternatives: PoE2Regex[] = [parseSequence()];
    while (pos < tokens.length && tokens[pos].type === 'pipe') {
      pos++;
      alternatives.push(parseSequence());
    }
    if (alternatives.length === 1) return alternatives[0];
    return { type: 'alternation', alternatives };
  }

  function parseSequence(): PoE2Regex {
    const items: PoE2Regex[] = [];

    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token.type === 'pipe' || token.type === 'groupClose') break;

      if (token.type === 'optional') {
        pos++;
        if (items.length > 0) {
          const last = items.pop()!;
          items.push({ type: 'optional', inner: last });
        }
        continue;
      }

      if (token.type === 'bang') {
        pos++;
        const inner = parseAlternation();
        items.push({ type: 'negation', inner });
      } else if (token.type === 'groupOpen') {
        pos++;
        const inner = parseAlternation();
        if (pos < tokens.length && tokens[pos].type === 'groupClose') pos++;
        items.push(inner);
      } else if (token.type === 'literal') {
        items.push({ type: 'literal', value: token.value.toLowerCase() });
        pos++;
      } else if (token.type === 'dot') {
        items.push({ type: 'dot' });
        pos++;
      } else if (token.type === 'dotStar') {
        items.push({ type: 'dotStar' });
        pos++;
      } else if (token.type === 'charClass') {
        items.push({ type: 'charClass', ranges: token.ranges });
        pos++;
      } else if (token.type === 'anchorStart') {
        items.push({ type: 'anchorStart' });
        pos++;
      } else if (token.type === 'anchorEnd') {
        items.push({ type: 'anchorEnd' });
        pos++;
      } else {
        break;
      }
    }

    if (items.length === 1) return items[0];
    return { type: 'sequence', items };
  }

  return parseAlternation();
}

// ─── Matcher ───

/**
 * Match a pattern at an EXACT position in the text.
 * Returns { matched, endIndex } where endIndex is after the match.
 *
 * IMPORTANT: This is POSITIONAL — the pattern must match starting
 * exactly at `startIndex`. Substring search is handled by the caller
 * (matchQuotedGroup) trying every starting position.
 */
function matchAt(regex: PoE2Regex, text: string, startIndex: number): { matched: boolean; endIndex: number } {
  const lower = text.toLowerCase();

  switch (regex.type) {
    case 'literal': {
      // Must match at EXACT position (like startsWith)
      if (lower.startsWith(regex.value, startIndex)) {
        return { matched: true, endIndex: startIndex + regex.value.length };
      }
      return { matched: false, endIndex: startIndex };
    }

    case 'dot': {
      if (startIndex < text.length) {
        return { matched: true, endIndex: startIndex + 1 };
      }
      return { matched: false, endIndex: startIndex };
    }

    case 'dotStar': {
      // .* at exact position = matches any length starting at startIndex
      return { matched: true, endIndex: text.length };
    }

    case 'charClass': {
      if (startIndex >= text.length) return { matched: false, endIndex: startIndex };
      const charCode = text.charCodeAt(startIndex);
      const isNegated = regex.ranges.length > 0 && regex.ranges[0].from === -1;
      if (isNegated) {
        const actualRanges = regex.ranges.slice(1);
        const inRange = actualRanges.some(r => charCode >= r.from && charCode <= r.to);
        return { matched: !inRange, endIndex: startIndex + 1 };
      } else {
        const inRange = regex.ranges.some(r => charCode >= r.from && charCode <= r.to);
        return { matched: inRange, endIndex: startIndex + 1 };
      }
    }

    case 'optional': {
      // Try matching with the inner pattern first (greedy)
      const withInner = matchAt(regex.inner, text, startIndex);
      if (withInner.matched) return withInner;
      // Or skip it (zero occurrences)
      return { matched: true, endIndex: startIndex };
    }

    case 'sequence': {
      return matchSequenceAt(regex.items, 0, text, startIndex);
    }

    case 'alternation': {
      for (const alt of regex.alternatives) {
        const result = matchAt(alt, text, startIndex);
        if (result.matched) return result;
      }
      return { matched: false, endIndex: startIndex };
    }

    case 'negation': {
      // !X matches if X does NOT match ANYWHERE in the text
      if (canMatchAnywhere(regex.inner, text, 0)) {
        return { matched: false, endIndex: startIndex };
      }
      return { matched: true, endIndex: startIndex };
    }

    case 'anchorStart': {
      return { matched: startIndex === 0, endIndex: startIndex };
    }

    case 'anchorEnd': {
      return { matched: startIndex === text.length, endIndex: startIndex };
    }

    default:
      return { matched: false, endIndex: startIndex };
  }
}

/**
 * Check if a pattern can match starting at any position >= tryStart.
 * Used for negation: "!X" means X must not be findable anywhere.
 */
function canMatchAnywhere(regex: PoE2Regex, text: string, tryStart: number): boolean {
  for (let i = tryStart; i <= text.length; i++) {
    if (matchAt(regex, text, i).matched) return true;
  }
  return false;
}

/**
 * Match a sequence of items starting from itemIndex at position pos.
 * Each item must match at the exact position after the previous item.
 * Special handling for .* which can span any length.
 */
function matchSequenceAt(
  items: PoE2Regex[],
  itemIndex: number,
  text: string,
  pos: number
): { matched: boolean; endIndex: number } {
  if (itemIndex >= items.length) {
    return { matched: true, endIndex: pos };
  }

  const item = items[itemIndex];

  // .* needs backtracking: try matching rest from every position after .*
  if (item.type === 'dotStar') {
    const restItems = items.slice(itemIndex + 1);
    if (restItems.length === 0) {
      return { matched: true, endIndex: text.length };
    }
    // Try from longest to shortest match (greedy)
    for (let tryPos = text.length; tryPos >= pos; tryPos--) {
      const result = matchSequenceAt(restItems, 0, text, tryPos);
      if (result.matched) return result;
    }
    return { matched: false, endIndex: pos };
  }

  // Anchors don't consume characters
  if (item.type === 'anchorStart') {
    if (pos !== 0) return { matched: false, endIndex: pos };
    return matchSequenceAt(items, itemIndex + 1, text, pos);
  }
  if (item.type === 'anchorEnd') {
    if (pos !== text.length) return { matched: false, endIndex: pos };
    return matchSequenceAt(items, itemIndex + 1, text, pos);
  }

  // Optional: try with inner (greedy), then without
  if (item.type === 'optional') {
    const withInner = matchAt(item.inner, text, pos);
    if (withInner.matched) {
      const rest = matchSequenceAt(items, itemIndex + 1, text, withInner.endIndex);
      if (rest.matched) return rest;
    }
    // Try without the optional item
    return matchSequenceAt(items, itemIndex + 1, text, pos);
  }

  // Standard positional match
  const result = matchAt(item, text, pos);
  if (!result.matched) return { matched: false, endIndex: pos };
  return matchSequenceAt(items, itemIndex + 1, text, result.endIndex);
}

/**
 * Check if a single quoted PoE2 regex group matches the item text.
 * Tries every starting position (substring search behavior).
 */
export function matchQuotedGroup(pattern: string, text: string): boolean {
  const ast = parsePoE2Regex(pattern);
  for (let i = 0; i <= text.length; i++) {
    if (matchAt(ast, text, i).matched) return true;
  }
  return false;
}

/**
 * Test if a full PoE2 regex string matches an item's text.
 *
 * A full regex consists of one or more quoted groups separated by spaces.
 * Each quoted group must match independently (AND logic).
 */
export function matchPoE2Regex(regexStr: string, itemText: string): boolean {
  if (!regexStr || !itemText) return false;

  // Parse into quoted groups
  const groups: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < regexStr.length; i++) {
    const ch = regexStr[i];
    if (ch === '"') {
      if (inQuotes) {
        groups.push(current);
        current = '';
        inQuotes = false;
      } else {
        inQuotes = true;
      }
    } else if (ch === ' ' && !inQuotes) {
      if (current) {
        groups.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) groups.push(current);

  // All groups must match (AND logic)
  for (const group of groups) {
    if (!matchQuotedGroup(group, itemText)) return false;
  }
  return true;
}

/** Represents a game item with its text for matching. */
export interface GameItemText {
  name?: string;
  type?: string;
  properties?: string[];
  mods?: string[];
  implicits?: string[];
  rarity?: string;
  additional?: string[];
}

/** Get the full searchable text for a game item. */
export function getItemSearchText(item: GameItemText): string {
  const parts: string[] = [];
  if (item.name) parts.push(item.name);
  if (item.type) parts.push(item.type);
  if (item.rarity) parts.push(item.rarity);
  if (item.properties) parts.push(...item.properties);
  if (item.implicits) parts.push(...item.implicits);
  if (item.mods) parts.push(...item.mods);
  if (item.additional) parts.push(...item.additional);
  return parts.join('\n');
}

/** Test a regex against multiple game items and return match results. */
export function testRegex(
  regexStr: string,
  items: { description: string; text: GameItemText; shouldMatch: boolean }[]
): { passed: boolean; results: { description: string; expected: boolean; actual: boolean; ok: boolean }[] } {
  const results = items.map(item => {
    const fullText = getItemSearchText(item.text);
    const actual = matchPoE2Regex(regexStr, fullText);
    return { description: item.description, expected: item.shouldMatch, actual, ok: actual === item.shouldMatch };
  });
  return { passed: results.every(r => r.ok), results };
}
