/**
 * Integration tests for buildAstFromSelections and pushLiteralsWithFamilyLogic.
 *
 * These tests verify that the AST builder in useCategoryPage.ts correctly:
 * - Groups tokens by familyKey in AND mode (OR within family, AND across families)
 * - Produces a flat OR group in OR mode
 * - Handles excludeMode correctly
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

    const ast = buildAstFromSelections(tokens, false, null, null, true, LOCALE, {}, 'and');
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

    const ast = buildAstFromSelections(tokens, false, null, null, true, LOCALE, {}, 'and');
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

    const ast = buildAstFromSelections(tokens, false, null, null, true, LOCALE, {}, 'or');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: true });
    // OR mode → single OR group
    expect(result).toBe('"к сопротивлению огню|к сопротивлению холоду"');
  });

  it('excludeMode: produces EXCLUDE(OR(...))', () => {
    const tokens = [
      makeToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню'),
      makeToken('cold_res_t1', 'к сопротивлению холоду', 'к сопротивлению холоду'),
    ];

    const ast = buildAstFromSelections(tokens, true, null, null, true, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: true });
    expect(result).toBe('"!к сопротивлению огню|к сопротивлению холоду"');
  });

  it('ranged token with min produces RANGE node', () => {
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 30]]),
    ];

    const ast = buildAstFromSelections(tokens, false, 25, null, false, LOCALE, {}, 'and');
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

    const ast = buildAstFromSelections(tokens, false, 27, 30, false, LOCALE, {}, 'and');
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

    const ast = buildAstFromSelections(tokens, false, 25, null, false, LOCALE, {}, 'and');
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
    const ast = buildAstFromSelections(tokens, false, 25, null, false, LOCALE, {}, 'and');
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

    const ast = buildAstFromSelections(tokens, false, null, null, false, LOCALE, perTokenRanges, 'and');
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
    const ast = buildAstFromSelections(tokens, false, null, null, false, LOCALE, {}, 'and');
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
    const ast = buildAstFromSelections(tokens, false, 25, null, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Both have the same suffix and effective min → single RANGE node
    expect(result).toContain('к сопротивлению огню');
  });

  it('returns null for empty selection', () => {
    const ast = buildAstFromSelections([], false, null, null, true, LOCALE, {}, 'and');
    expect(ast).toBeNull();
  });

  // ─── anchorEnd (%) suffix anchoring tests (Phase 9c) ───

  it('+##% token gets anchorEnd="%" (accessory mod, anchorStart=false)', () => {
    // For +##% mods (accessories), anchorStart=false (template starts with +)
    // but anchorEnd='%' should be set to prevent range notation FP
    const tokens = [
      makeRangedToken('fire_res_t1', 'к сопротивлению огню', 'к сопротивлению огню', [[20, 35]], {
        rawTextTemplate: { ru: '+##% к сопротивлению огню' },
      }),
    ];

    const ast = buildAstFromSelections(tokens, false, 27, 30, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Should have % after number pattern: (2[7-9]|30)%.*к сопротивлению огню
    expect(result).toBe('"(2[7-9]|30)%.*к сопротивлению огню"');
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

    const ast = buildAstFromSelections(tokens, false, 27, 30, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // Should have ^ but NOT %: ^(2[7-9]|30).*откладывания наград
    expect(result).toBe('"^(2[7-9]|30).*откладывания наград"');
    expect(result).not.toContain('%');
  });

  it('+## token (non-%) does NOT get anchorEnd', () => {
    // For +## mods without % (e.g. "+## к силе"), no suffix anchoring
    const tokens = [
      makeRangedToken('str_t1', 'к силе', 'к силе', [[10, 50]], {
        rawTextTemplate: { ru: '+## к силе' },
      }),
    ];

    const ast = buildAstFromSelections(tokens, false, 25, null, false, LOCALE, {}, 'and');
    expect(ast).not.toBeNull();

    const result = compile(ast!, { round10: false });
    // No % after number pattern
    expect(result).not.toContain('%');
  });
});
