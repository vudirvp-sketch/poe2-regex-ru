/**
 * PoE2 Regex Matcher — Simulates the in-game search behavior.
 *
 * ARCHITECTURE (v2 — verified in-game, Phase 7):
 * PoE2 search is BLOCK-BASED: each mod, implicit, property, name, type,
 * and state text ("Осквернено") is a separate searchable block.
 * `.*` works ONLY within a single block — it does NOT cross block boundaries.
 * AND (space-separated quoted groups) works ACROSS blocks: each group
 * independently searches all blocks, and the item matches if every group
 * finds at least one block where it matches.
 *
 * Description/tooltip text ("Можно использовать в Машине картоходца...")
 * is NOT indexed by PoE2 search — it cannot be found by any regex.
 *
 * Two matching modes:
 * 1. `matchPoE2Regex(regex, text)` — matches against a single text string.
 *    Used by ETL/Oracle for single-mod validation. .* crosses newlines here.
 * 2. `matchPoE2RegexItem(regex, item)` — matches against item blocks.
 *    Used for in-game behavior simulation. .* restricted to single blocks.
 *
 * PoE2 regex dialect features (VERIFIED IN-GAME):
 * - Substring match (case-insensitive)
 * - `.` any single char, `.*` any sequence (WITHIN single block only)
 * - `|` OR, `!` NOT, `""` grouping, space between = AND (cross-block)
 * - `[]` character class, `()` grouping
 * - `^` / `$` anchors
 * - `%` and `+` are literals
 * - Unmatched `(` is literal; `(...)` pair is grouping
 *
 * NOT supported in PoE2 regex (verified in-game):
 * - `?` optional quantifier — does NOT work
 * - Description/tooltip text — not indexed
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

/** Represents a game item with its text for matching.
 *
 * IMPORTANT (verified in-game, Phase 7):
 * - `additional` = indexed state text ("Осквернено", "Делириум"). IS searchable.
 * - `description` = tooltip/hint text ("Можно использовать в Машине картоходца...").
 *   NOT indexed by PoE2 search — cannot be found by any regex.
 */
export interface GameItemText {
  name?: string;
  type?: string;
  properties?: string[];
  mods?: string[];
  implicits?: string[];
  rarity?: string;
  /** Indexed state text: "Осквернено", "Делириум" etc. IS searchable in-game. */
  additional?: string[];
  /** Tooltip/hint text. NOT indexed by PoE2 search — cannot be found. */
  description?: string[];
}

/**
 * Get the searchable text blocks for a game item.
 * Each block is an independent searchable unit — `.*` does NOT cross blocks.
 * AND (space-separated quoted groups) works across blocks.
 *
 * Block source (verified in-game, Phase 7):
 * - name, type, rarity — each is a separate block
 * - each property — separate block
 * - each implicit — separate block
 * - each mod — separate block (multi-line mods: each sub-line is a block)
 * - each additional entry — separate block
 * - description — NOT included (not indexed by PoE2)
 */
export function getItemSearchBlocks(item: GameItemText): string[] {
  const blocks: string[] = [];
  if (item.name) blocks.push(item.name);
  if (item.type) blocks.push(item.type);
  if (item.rarity) blocks.push(item.rarity);
  if (item.properties) blocks.push(...item.properties);
  if (item.implicits) blocks.push(...item.implicits);
  if (item.mods) blocks.push(...item.mods);
  if (item.additional) blocks.push(...item.additional);
  // description is NOT indexed by PoE2 — not included
  return blocks;
}

/** Get the full searchable text for a game item (concatenated).
 * @deprecated Use getItemSearchBlocks() + matchPoE2RegexItem() for accurate
 * in-game behavior simulation. This function concatenates all blocks into
 * one string, allowing .* to cross block boundaries (which does NOT happen in-game).
 */
export function getItemSearchText(item: GameItemText): string {
  return getItemSearchBlocks(item).join('\n');
}

/**
 * Parse a full PoE2 regex string into its quoted groups.
 * Handles nested quotes and spaces correctly.
 */
export function parseQuotedGroups(regexStr: string): string[] {
  if (!regexStr) return [];

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

  return groups;
}

/**
 * Match a full PoE2 regex against a GameItemText using BLOCK-BASED matching.
 *
 * This is the CORRECT model for in-game behavior (verified Phase 7):
 * - Each quoted group is matched against each block independently
 * - `.*` works ONLY within a single block (does NOT cross mod/implicit/property boundaries)
 * - AND (space-separated quoted groups) works ACROSS blocks
 * - Negation `!X` checks if X is absent from ALL blocks
 * - Description text is NOT searchable
 *
 * Example: On an item with mod1="+66 к максимуму здоровья" and mod2="+23 к силе",
 *   "максимуму здоровья.*к силе" → FALSE (.* can't cross blocks)
 *   "максимуму здоровья" "к силе" → TRUE (AND crosses blocks)
 */
export function matchPoE2RegexItem(regexStr: string, item: GameItemText): boolean {
  if (!regexStr) return false;

  const blocks = getItemSearchBlocks(item);
  if (blocks.length === 0) return false;

  const groups = parseQuotedGroups(regexStr);
  if (groups.length === 0) return false;

  // Each quoted group must be satisfied.
  // For POSITIVE groups: at least one block must match.
  // For NEGATION groups (!X): X must NOT match ANY block (item-wide).
  //   This is because PoE2 treats ! as "exclude items where X appears anywhere".
  for (const group of groups) {
    if (group.startsWith('!')) {
      // Negation: check that the inner pattern does NOT appear in ANY block
      const innerPattern = group.slice(1);
      const innerMatchesSomeBlock = blocks.some(block => matchQuotedGroup(innerPattern, block));
      if (innerMatchesSomeBlock) return false; // X found somewhere → item excluded
    } else {
      // Positive: at least one block must match
      const groupMatchesAnyBlock = blocks.some(block => matchQuotedGroup(group, block));
      if (!groupMatchesAnyBlock) return false;
    }
  }
  return true;
}

/**
 * Test a regex against multiple game items using block-based matching.
 * Uses matchPoE2RegexItem() for accurate in-game behavior simulation.
 */
export function testRegex(
  regexStr: string,
  items: { description: string; text: GameItemText; shouldMatch: boolean }[]
): { passed: boolean; results: { description: string; expected: boolean; actual: boolean; ok: boolean }[] } {
  const results = items.map(item => {
    const actual = matchPoE2RegexItem(regexStr, item.text);
    return { description: item.description, expected: item.shouldMatch, actual, ok: actual === item.shouldMatch };
  });
  return { passed: results.every(r => r.ok), results };
}
