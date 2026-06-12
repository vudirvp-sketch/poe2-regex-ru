/**
 * Integration tests for buildAstFromSelections and pushLiteralsWithFamilyLogic.
 *
 * These tests verify that the AST builder in useCategoryPage.ts correctly:
 * - Groups tokens by familyKey in AND mode (OR within family, AND across families)
 * - Produces a flat OR group in OR mode
 * - Handles per-mod exclude (excludedIds) correctly
 * - Handles ranged tokens with effective min/max
 * - Handles orphaned ranged tokens (have ranges but no effective min/max)
 *
 * Uses mock GameToken data that mimics real PoE2 Russian client tokens.
 */
import { describe, it, expect } from 'vitest';
import { buildAstFromSelections, pushLiteralsWithFamilyLogic } from '@ui/hooks/useCategoryPage';
import { compile } from '@core/compiler';
import type { GameToken, Locale, ASTNode } from '@shared/types';

// ─── Helpers ───

const LOCALE: Locale = 'ru';

/** Create a minimal non-ranged GameToken for testing */
function makeToken(
  id: string,
  familyKey: string,
  regex: string,
  opts: Partial<GameToken> = {}
): GameToken {
  return {
    id,
    category: 'ring',
    origin: 'normal',
    rawText: { ru: `${regex} тест` },
    rawTextTemplate: { ru: regex },
    regex: { ru: regex },
    familyKey: { ru: familyKey },
    regexPrefix: { ru: '' },
    hasMultiPlaceholder: false,
    genderForms: { ru: {} },
    affix: 'suffix' as const,
    tags: [],
    ranges: [],
    values: [],
    hasYofication: false,
    yoficationPositions: [],
    level: 1,
    ...opts,
  };
}

/** Create a ranged GameToken for testing */
function makeRangedToken(
  id: string,
  familyKey: string,
  regex: string,
  ranges: number[][],
  opts: Partial<GameToken> = {}
): GameToken {
  return makeToken(id, familyKey, regex, { ranges, ...opts });
}

// ─── pushLiteralsWithFamilyLogic tests ───

describe('pushLiteralsWithFamilyLogic', () => {
  it('OR mode: all nodes go into orChildren', () => {
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
    ];
    const nodes: ASTNode[] = tokens.map(t => ({ type: 'LITERAL', value: t.regex[LOCALE], tokenId: t.id }));

    const andChildren: ASTNode[] = [];
    const orChildren: ASTNode[] = [];

    pushLiteralsWithFamilyLogic(tokens, nodes, LOCALE, 'or', false, andChildren, orChildren);

    expect(orChildren.length).toBe(2);
    expect(andChildren.length).toBe(0);
  });

  it('AND mode: same-family tokens go into one OR group', () => {
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('fire_res_t2', 'к сопротивлению огню', 'к сопротивлению огню'),
    ];
    const nodes: ASTNode[] = tokens.map(t => ({ type: 'LITERAL', value: t.regex[LOCALE], tokenId: t.id }));

    const andChildren: ASTNode[] = [];
    const orChildren: ASTNode[] = [];

    pushLiteralsWithFamilyLogic(tokens, nodes, LOCALE, 'and', false, andChildren, orChildren);

    // Same family → one OR group pushed to andChildren
    expect(andChildren.length).toBe(1);
    expect(andChildren[0].type).toBe('OR');
    if (andChildren[0].type === 'OR') {
      expect(andChildren[0].children.length).toBe(2);
    }
    expect(orChildren.length).toBe(0);
  });

  it('AND mode: different-family tokens go into separate AND groups', () => {
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
    ];
    const nodes: ASTNode[] = tokens.map(t => ({ type: 'LITERAL', value: t.regex[LOCALE], tokenId: t.id }));

    const andChildren: ASTNode[] = [];
    const orChildren: ASTNode[] = [];

    pushLiteralsWithFamilyLogic(tokens, nodes, LOCALE, 'and', false, andChildren, orChildren);

    // Different families → two separate entries in andChildren
    expect(andChildren.length).toBe(2);
    expect(orChildren.length).toBe(0);
  });

  it('excludeMode: all nodes go into EXCLUDE(OR(...))', () => {
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
    ];
    const nodes: ASTNode[] = tokens.map(t => ({ type: 'LITERAL', value: t.regex[LOCALE], tokenId: t.id }));

    const andChildren: ASTNode[] = [];
    const orChildren: ASTNode[] = [];

    pushLiteralsWithFamilyLogic(tokens, nodes, LOCALE, 'and', true, andChildren, orChildren);

    // excludeMode → single EXCLUDE(OR(...)) in andChildren
    expect(andChildren.length).toBe(1);
    expect(andChildren[0].type).toBe('EXCLUDE');
    if (andChildren[0].type === 'EXCLUDE') {
      expect(andChildren[0].child.type).toBe('OR');
    }
  });
});

// ─── buildAstFromSelections integration tests ───

describe('buildAstFromSelections', () => {
  it('AND mode: same-family tokens produce OR within family', () => {
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('fire_res_t2', 'к сопротивлению огню', 'к сопротивлению огню'),
    ];

    const ast = buildAstFromSelections(tokens, new Set(), null, null, true, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: true });
    // Same family → OR within one quoted group
    // Without optimizer, same-value literals appear as "A|A"
    // With optimizer (deduplicateOrGroups), they would collapse to "A"
    expect(result).toContain('к сопротивлению огню');
    expect(result).not.toContain('" "'); // Single quoted group, not AND
  });

  it('AND mode: different-family tokens produce AND across families', () => {
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
    ];

    const ast = buildAstFromSelections(tokens, new Set(), null, null, true, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: true });
    // Different families → AND across two quoted groups
    expect(result).toBe('"к сопротивлению огню" "к сопротивлению холоду"');
  });

  it('OR mode: all tokens go into one OR group', () => {
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
    ];

    const ast = buildAstFromSelections(tokens, new Set(), null, null, true, LOCALE, {}, 'or');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: true });
    // OR mode → single OR group
    expect(result).toBe('"к сопротивлению огню|к сопротивлению холоду"');
  });

  it('per-mod exclude: produces EXCLUDE(OR(...))', () => {
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
    ];

    // Both tokens excluded
    const excludedIds = new Set(['fire_res_t1', 'cold_res_t1']);
    const ast = buildAstFromSelections(tokens, excludedIds, null, null, true, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: true });
    expect(result).toBe('"!к сопротивлению огню|к сопротивлению холоду"');
  });

  it('ranged token with min produces RANGE node', () => {
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 30]]),
    ];

    const ast = buildAstFromSelections(tokens, new Set(), 25, null, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // RANGE(25, undefined, 'к сопротивлению огню')
    expect(result).toContain('к сопротивлению огню');
    expect(result).toContain('.*');
  });

  it('ranged token with min and max produces compact enumeration (Phase 10)', () => {
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]]),
    ];

    const ast = buildAstFromSelections(tokens, new Set(), 27, 30, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Phase 10: compact decade grouping (2[7-9]|30) instead of flat (27|28|29|30)
    expect(result).toBe('"(2[7-9]|30).*к сопротивлению огню"');
  });

  it('mixed ranged and non-ranged tokens', () => {
    const tokens = [
      makeToken('life_t1', 'к максимуму здоровья', 'к максимуму здоровья'),
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]]),
    ];

    const ast = buildAstFromSelections(tokens, new Set(), 25, null, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Should contain both the literal and the range
    expect(result).toContain('к максимуму здоровья');
    expect(result).toContain('к сопротивлению огню');
    // Two separate AND-joined quoted groups
    expect(result).toContain('" "');
  });

  // ─── Orphaned ranged tokens tests ───

  it('orphaned ranged token (no effective min/max) treated as literal', () => {
    // Token has ranges but no min/max filter set → should be treated as literal suffix
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]]),
      makeRangedToken('life_t1', 'к максимуму здоровья', 'к максимуму здоровья', [[10, 50]]),
    ];

    // Only fire_res has effective min; life_t1 is orphaned (no min/max)
    const ast = buildAstFromSelections(tokens, new Set(), 25, null, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Both tokens should appear in the output
    expect(result).toContain('к сопротивлению огню');
    expect(result).toContain('к максимуму здоровья');
  });

  it('orphaned ranged tokens not silently dropped when other tokens have ranges', () => {
    // Regression test for v35 bug: ranged tokens without effective range were silently dropped
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]]),
      makeRangedToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду', [[15, 40]]),
      makeRangedToken('life_t1', 'к максимуму здоровья', 'к максимуму здоровья', [[10, 60]]),
    ];

    // Only fire_res has per-token range override; others are orphaned
    const perTokenRanges: Record<string, { min?: number; max?: number; filterSlotIndex?: number }> = {
      'fire_res_t1': { min: 25, filterSlotIndex: 0 },
    };

    const ast = buildAstFromSelections(tokens, new Set(), null, null, false, LOCALE, perTokenRanges, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // ALL tokens should appear — fire_res with range, cold_res and life_t1 as literals
    expect(result).toContain('к сопротивлению огню');
    expect(result).toContain('к сопротивлению холоду');
    expect(result).toContain('к максимуму здоровья');
  });

  it('all ranged tokens without effective min/max → all treated as literals', () => {
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]]),
      makeRangedToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду', [[15, 40]]),
    ];

    // No min/max set anywhere → all orphaned, treated as literals
    const ast = buildAstFromSelections(tokens, new Set(), null, null, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Both should appear as literal suffixes (AND mode, different families)
    expect(result).toContain('к сопротивлению огню');
    expect(result).toContain('к сопротивлению холоду');
  });

  // ─── Combined AND/OR + range with familyKey tests ───

  it('AND mode: same-family ranged tokens grouped into OR + range', () => {
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 30]]),
      makeRangedToken('fire_res_t2', 'к сопротивлению огню', 'к сопротивлению огню', [[31, 45]]),
    ];

    // Both tokens share familyKey and suffix → merged into one RANGE node with same suffix
    const ast = buildAstFromSelections(tokens, new Set(), 25, null, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Both have the same suffix and effective min → single RANGE node
    expect(result).toContain('к сопротивлению огню');
  });

  it('returns null for empty selection', () => {
    const ast = buildAstFromSelections([], new Set(), null, null, true, LOCALE, {}, 'and');
    expect(ast).toBeNull();
  });

  // ─── anchorEnd (%) suffix anchoring tests (Phase 9c) ───

  it('+##% token gets anchorStart + signPrefix="+" (Phase 12: sign prefix provides anchoring)', () => {
    // For +##% mods (accessories), signPrefix='+' and anchorStart=true.
    // Template starts with +## → numberAtStart=true (updated to detect [+-]?##).
    // \+ before number provides implicit anchoring (range notation numbers never have +).
    // Combined with ^, this is more precise than the old anchorEnd="%" approach.
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]], {
        rawTextTemplate: { ru: '+##% к сопротивлению огню' },
      }),
    ];

    const ast = buildAstFromSelections(tokens, new Set(), 27, 30, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // ^\+(2[7-9]|30).*suffix — ^ anchors to block start, \+ anchors to sign prefix
    expect(result).toBe('"^\\+(2[7-9]|30).*к сопротивлению огню"');
  });

  it('##% token gets anchorStart=true but NOT anchorEnd (tablet/waystone mod)', () => {
    // For ##% mods (tablets/waystones), anchorStart=true with ^ is sufficient.
    // anchorEnd is NOT set because ^ already prevents FP and % has FN risk
    // on items where the actual roll has range notation.
    const tokens = [
      makeRangedToken('ritual_t1', 'откладывания наград', 'откладывания наград', [[22, 50]], {
        rawTextTemplate: { ru: '##% уменьшение количества дани, требуемой для откладывания наград' },
      }),
    ];

    const ast = buildAstFromSelections(tokens, new Set(), 27, 30, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Should have ^ but NOT %: ^(2[7-9]|30).*откладывания наград
    expect(result).toBe('"^(2[7-9]|30).*откладывания наград"');
    expect(result).not.toContain('%');
  });

  it('+## token (non-%) gets signPrefix="+" but NOT anchorEnd', () => {
    // For +## mods without % (e.g. "+## к силе"), no % anchoring, but signPrefix='+' provides anchoring
    const tokens = [
      makeRangedToken('str_t1', 'к силе', 'к силе', [[10, 50]], {
        rawTextTemplate: { ru: '+## к силе' },
      }),
    ];

    const ast = buildAstFromSelections(tokens, new Set(), 25, null, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // No % after number pattern, but \+ before number
    expect(result).not.toContain('%');
    expect(result).toContain('\\+');
  });

  it('#% values-only token does NOT get anchorEnd (waystone "На #% больше...")', () => {
    // Bug fix: #% single-hash values-only mods (like "На #% больше находимых в области путевых камней")
    // always display range notation in-game (e.g. "На 15(15-24)%..."), so anchorEnd='%'
    // would cause 100% FN because % never immediately follows the number.
    // Only ##% (double hash) templates should get anchorEnd='%'.
    const tokens = [
      makeRangedToken('ws_t1', 'области путевых камней', 'области путевых камней', [], {
        rawTextTemplate: { ru: 'На #% больше находимых в области путевых камней' },
        values: [15],
        ranges: [],
      }),
    ];

    // Need per-token range since values-only tokens need overrides
    const perTokenRanges = { 'ws_t1': { min: 15, max: 24, filterSlotIndex: 0 } };
    const ast = buildAstFromSelections(tokens, new Set(), null, null, false, LOCALE, perTokenRanges, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Should NOT have % after the number pattern — enumeration only
    expect(result).not.toContain('%');
    expect(result).toContain('области путевых камней');
    // Middle-number prefix "На" is extracted from template "На #% больше..."
    // This provides better specificity: "На (1[5-9]|2[0-4]).*области путевых камней"
    expect(result).toBe('"На (1[5-9]|2[0-4]).*области путевых камней"');
  });

  // ─── per-mod exclude with ranged tokens ───

  it('per-mod exclude with ranged token wraps RANGE in EXCLUDE(OR)', () => {
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]]),
    ];

    const excludedIds = new Set(['fire_res_t1']);
    const astExclude = buildAstFromSelections(tokens, excludedIds, 27, 30, false, LOCALE, {}, 'and');
    expect(astExclude).not.toBeNull();

    const resultExclude = compile(astExclude!, { round10: false });
    // Exclude should wrap the range pattern in !(...|...)
    expect(resultExclude).toContain('!');
    expect(resultExclude).toContain('к сопротивлению огню');

    // Verify it's DIFFERENT from non-exclude mode
    const astNormal = buildAstFromSelections(tokens, new Set(), 27, 30, false, LOCALE, {}, 'and');
    const resultNormal = compile(astNormal!, { round10: false });
    expect(resultExclude).not.toBe(resultNormal);
  });

  it('per-mod exclude with mixed ranged and non-ranged tokens produces EXCLUDE(OR) + AND', () => {
    const tokens = [
      makeToken('life_t1', 'к максимуму здоровья', 'к максимуму здоровья'),
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]]),
    ];

    // Exclude only fire_res, want life
    const excludedIds = new Set(['fire_res_t1']);
    const ast = buildAstFromSelections(tokens, excludedIds, 25, null, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // life should be wanted, fire_res excluded
    expect(result).toContain('к максимуму здоровья');
    expect(result).toContain('!');
    expect(result).toContain('к сопротивлению огню');
  });

  it('mixed want and exclude: want tokens ANDed, exclude tokens in EXCLUDE(OR)', () => {
    const tokens = [
      makeToken('life_t1', 'к максимуму здоровья', 'к максимуму здоровья'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
    ];

    // Want life + cold_res, exclude fire_res
    const excludedIds = new Set(['fire_res_t1']);
    const ast = buildAstFromSelections(tokens, excludedIds, null, null, true, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: true });
    // Should have wanted mods ANDed with excluded mod in EXCLUDE
    expect(result).toContain('к максимуму здоровья');
    expect(result).toContain('к сопротивлению холоду');
    expect(result).toContain('!');
    expect(result).toContain('к сопротивлению огню');
    // Pattern: "want1" "want2" "!exclude1"
  });

  // ─── In-game verified: want + exclude pattern (VERIFIED 2026-06-10) ───

  it('want + exclude: "к сопротивлению огню" "!к сопротивлению холоду" — in-game verified', () => {
    // In-game test results (2026-06-10):
    // ✅ "к сопротивлению огню" "!к сопротивлению холоду" — highlights items with fire res but WITHOUT cold res
    // ❌ "к сопротивлению огню" !"к сопротивлению холоду" — nothing highlighted (! outside quotes doesn't work)
    // ✅ "к сопротивлению огню" "к сопротивлению холоду" — highlights items with BOTH resistances
    //
    // Our compiler MUST put ! inside quotes: "!text" not !"text"
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
    ];

    // Want fire_res, exclude cold_res
    const excludedIds = new Set(['cold_res_t1']);
    const ast = buildAstFromSelections(tokens, excludedIds, null, null, true, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: true });
    // Exact format verified in-game: "к сопротивлению огню" "!к сопротивлению холоду"
    expect(result).toBe('"к сопротивлению огню" "!к сопротивлению холоду"');
    // CRITICAL: ! must be INSIDE quotes, NOT before them
    expect(result).not.toMatch(/!"/);
  });

  it('want + exclude with OR: multiple excludes produce "!A|B" inside quotes', () => {
    // In-game verified: "!A|B" inside one quoted group = exclude items matching A OR B
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
      makeToken('light_res_t1', 'к сопротивлению молнии', 'к сопротивлению молнии'),
    ];

    // Want fire_res, exclude both cold_res and light_res
    const excludedIds = new Set(['cold_res_t1', 'light_res_t1']);
    const ast = buildAstFromSelections(tokens, excludedIds, null, null, true, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: true });
    // Both excludes should be in one "!A|B" quoted group
    expect(result).toContain('"!');
    expect(result).toContain('|');
    // ! must be INSIDE quotes
    expect(result).not.toMatch(/!"/);
  });

  it('per-mod exclude with ranged token: exact format "!numRegex.*suffix"', () => {
    // Verify that excluded ranged tokens produce correct format with ! inside quotes
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]]),
    ];

    const excludedIds = new Set(['fire_res_t1']);
    const ast = buildAstFromSelections(tokens, excludedIds, 27, 30, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // ! must be INSIDE quotes: "!(2[7-9]|30).*к сопротивлению огню"
    expect(result).toMatch(/^"!\(2\[7-9\]\|30\)\.\*к сопротивлению огню"$/);
    expect(result).not.toMatch(/!"/);
  });
});

// ─── MULTI_RANGE integration tests with real ring.json data ───

describe('buildAstFromSelections — MULTI_RANGE (dual-number ring mods)', () => {
  /**
   * Create a dual-number GameToken mimicking real ring.json data.
   * Example: "Добавляет от (6—10) до (12—17) физического урона к атакам"
   * Template: "Добавляет от ## до ## физического урона к атакам"
   */
  function makeDualNumberToken(
    id: string,
    rawText: string,
    template: string,
    regex: string,
    ranges: number[][],
    familyKey: string,
    opts: Partial<GameToken> = {}
  ): GameToken {
    return {
      id,
      category: 'ring',
      origin: 'normal',
      rawText: { ru: rawText },
      rawTextTemplate: { ru: template },
      regex: { ru: regex },
      familyKey: { ru: familyKey },
      regexPrefix: { ru: 'Добавляет от' },
      hasMultiPlaceholder: true,
      genderForms: { ru: {} },
      affix: 'suffix' as const,
      tags: [],
      ranges,
      values: [],
      hasYofication: false,
      yoficationPositions: [],
      level: 1,
      ...opts,
    };
  }

  it('dual-number token with both slots filtered produces MULTI_RANGE node', () => {
    // Real ring.json data: "Добавляет от (6—10) до (12—17) физического урона к атакам"
    const tokens = [
      makeDualNumberToken(
        'ring.normal_97',
        'Добавляет от (6—10) до (12—17) физического урона к атакам',
        'Добавляет от ## до ## физического урона к атакам',
        'урона к атакам',
        [[6, 10], [12, 17]],
        'Добавляет от # до # физического урона к атакам'
      ),
    ];

    // Both slots have filters via slotOverrides
    const perTokenRanges = {
      'ring.normal_97': {
        min: 6,
        max: 17,
        filterSlotIndex: 0,
        slotOverrides: {
          0: { min: 6 },
          1: { min: 12 },
        },
      },
    };

    const ast = buildAstFromSelections(tokens, new Set(), null, null, false, LOCALE, perTokenRanges, 'and');
    expect(ast).not.toBeNull();

    // Should produce a MULTI_RANGE node, NOT two separate RANGE nodes
    const result = compile(ast!, { round10: false });
    // MULTI_RANGE compiles to a single quoted group with both number patterns
    // Pattern: "Добавляет от <numRegex>.*до <numRegex>.*урона к атакам"
    expect(result).toContain('Добавляет от');
    expect(result).toContain('до');
    expect(result).toContain('урона к атакам');
    // Must be a SINGLE quoted group (no AND between two groups)
    expect(result).not.toContain('" "');
  });

  it('dual-number token with only one slot filtered produces RANGE, not MULTI_RANGE', () => {
    // Only the first slot has a filter — should fall through to regular RANGE
    const tokens = [
      makeDualNumberToken(
        'ring.normal_97',
        'Добавляет от (6—10) до (12—17) физического урона к атакам',
        'Добавляет от ## до ## физического урона к атакам',
        'урона к атакам',
        [[6, 10], [12, 17]],
        'Добавляет от # до # физического урона к атакам'
      ),
    ];

    // Only slot 0 has a filter
    const perTokenRanges = {
      'ring.normal_97': { min: 8, filterSlotIndex: 0 },
    };

    const ast = buildAstFromSelections(tokens, new Set(), null, null, false, LOCALE, perTokenRanges, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Should produce a RANGE node with prefix "Добавляет от"
    expect(result).toContain('урона к атакам');
  });

  it('dual-number fire damage token produces MULTI_RANGE with correct suffix', () => {
    // ring.addedfiredamage4: "Добавляет от (9—11) до (14—17) урона от огня к атакам"
    const tokens = [
      makeDualNumberToken(
        'ring.addedfiredamage4',
        'Добавляет от (9—11) до (14—17) урона от огня к атакам',
        'Добавляет от ## до ## урона от огня к атакам',
        'огня к атакам',
        [[9, 11], [14, 17]],
        'Добавляет от # до # урона от огня к атакам'
      ),
    ];

    const perTokenRanges = {
      'ring.addedfiredamage4': { min: 9, max: 17, filterSlotIndex: 0 },
    };

    const ast = buildAstFromSelections(tokens, new Set(), null, null, false, LOCALE, perTokenRanges, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // MULTI_RANGE: single quoted group
    expect(result).toContain('огня к атакам');
    expect(result).toContain('Добавляет от');
    expect(result).not.toContain('" "');
  });

  it('multiple dual-number tokens in same family produce single MULTI_RANGE', () => {
    // Two physical damage tokens in the same family
    const tokens = [
      makeDualNumberToken(
        'ring.normal_97',
        'Добавляет от (6—10) до (12—17) физического урона к атакам',
        'Добавляет от ## до ## физического урона к атакам',
        'урона к атакам',
        [[6, 10], [12, 17]],
        'Добавляет от # до # физического урона к атакам'
      ),
      makeDualNumberToken(
        'ring.normal_98',
        'Добавляет от (7—11) до (14—20) физического урона к атакам',
        'Добавляет от ## до ## физического урона к атакам',
        'урона к атакам',
        [[7, 11], [14, 20]],
        'Добавляет от # до # физического урона к атакам'
      ),
    ];

    const perTokenRanges = {
      'ring.normal_97': {
        min: 6, max: 20, filterSlotIndex: 0,
        slotOverrides: { 0: { min: 6 }, 1: { min: 12 } },
      },
      'ring.normal_98': {
        min: 6, max: 20, filterSlotIndex: 0,
        slotOverrides: { 0: { min: 6 }, 1: { min: 12 } },
      },
    };

    const ast = buildAstFromSelections(tokens, new Set(), null, null, false, LOCALE, perTokenRanges, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    expect(result).toContain('урона к атакам');
    // Same family with same slot ranges → merged into one group
    expect(result).not.toContain('" "');
  });

  it('broken ETL suffix with ) is repaired for MULTI_RANGE', () => {
    // Token with broken suffix from old ETL: "4—20) физического урона к атакам"
    // Should be repaired to "физического урона к атакам" by buildAstFromSelections
    // when entering the MULTI_RANGE path (both slots filtered)
    const tokens = [
      makeDualNumberToken(
        'ring.normal_98',
        'Добавляет от (7—11) до (14—20) физического урона к атакам',
        'Добавляет от ## до ## физического урона к атакам',
        '4—20) физического урона к атакам',  // BROKEN suffix with )
        [[7, 11], [14, 20]],
        'Добавляет от # до # физического урона к атакам'
      ),
    ];

    const perTokenRanges = {
      'ring.normal_98': {
        min: 7, max: 20, filterSlotIndex: 0,
        slotOverrides: { 0: { min: 7 }, 1: { min: 14 } },
      },
    };

    const ast = buildAstFromSelections(tokens, new Set(), null, null, false, LOCALE, perTokenRanges, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // The broken suffix "4—20) физического урона к атакам" should be repaired.
    // The suffix part should be "физического урона к атакам" (no rawText parens).
    // Note: the regex itself uses () for number patterns like (1[4-9]|[2-9][0-9]|\d{3,})
    // which is expected and correct — those are regex grouping, not rawText parens.
    // Check that the suffix does NOT contain rawText-derived "4—20)" pattern
    expect(result).not.toContain('4—20)');
    // Should contain the template-based suffix "физического урона к атакам"
    expect(result).toContain('физического урона к атакам');
    // Must be a MULTI_RANGE with both slots (single quoted group)
    expect(result).toContain('Добавляет от');
    expect(result).toContain('до');
  });

  it('lightning damage with single-hash first slot produces correct prefix', () => {
    // ring.addedlightningdamage3: "Добавляет от 1 до (16—22) урона от молнии к атакам"
    // Template: "Добавляет от # до ## урона от молнии к атакам"
    // Note: first slot is # (single digit), second is ## (double digit)
    const tokens = [
      makeDualNumberToken(
        'ring.addedlightningdamage3',
        'Добавляет от 1 до (16—22) урона от молнии к атакам',
        'Добавляет от # до ## урона от молнии к атакам',
        'молнии к атакам',
        [[16, 22]],
        'Добавляет от # до # урона от молнии к атакам',
        { regexPrefix: { ru: 'Добавляет от' } }
      ),
    ];

    const perTokenRanges = {
      'ring.addedlightningdamage3': { min: 16, filterSlotIndex: 1 },
    };

    const ast = buildAstFromSelections(tokens, new Set(), null, null, false, LOCALE, perTokenRanges, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    expect(result).toContain('молнии к атакам');
  });
});
