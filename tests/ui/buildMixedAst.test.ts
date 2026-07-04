/**
 * iter 158 — MIXED-mode AST builder tests.
 *
 * Tests verify that `buildMixedAstFromSelections` produces the correct AST
 * for the verified combined-mode pattern (iter 157, KI#44 closed):
 *   `"MUST1" "MUST2" "OPT1|OPT2|OPT3"`
 *
 * Also tests `truncateMixedOrLiterals` (KI#46 mitigation) — shortens LITERAL
 * values inside MIXED_OR to fit the 250-char budget.
 *
 * Uses mock GameToken data that mimics real PoE2 Russian client tokens.
 */
import { describe, it, expect } from 'vitest';
import {
  buildMixedAstFromSelections,
  truncateMixedOrLiterals,
} from '@ui/hooks/useCategoryPage';
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

// ─── buildMixedAstFromSelections tests ───

describe('buildMixedAstFromSelections', () => {
  it('returns null for empty inputs', () => {
    const result = buildMixedAstFromSelections(
      [],
      [],
      new Set<string>(),
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).toBeNull();
  });

  it('builds MUST-only AST (no OPT) → single LITERAL', () => {
    const mustTokens = [makeToken('m1', 'fam1', 'MUST1')];
    const result = buildMixedAstFromSelections(
      mustTokens,
      [],
      new Set<string>(),
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    expect(compile(result!)).toBe('"MUST1"');
  });

  it('builds OPT-only AST (no MUST) → single MIXED_OR', () => {
    const optTokens = [
      makeToken('o1', 'fam1', 'OPT1'),
      makeToken('o2', 'fam2', 'OPT2'),
    ];
    const result = buildMixedAstFromSelections(
      [],
      optTokens,
      new Set<string>(),
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    expect(compile(result!)).toBe('"OPT1|OPT2"');
  });

  it('builds canonical MIXED pattern: "MUST1" "MUST2" "OPT1|OPT2"', () => {
    const mustTokens = [
      makeToken('m1', 'fam1', 'MUST1'),
      makeToken('m2', 'fam2', 'MUST2'),
    ];
    const optTokens = [
      makeToken('o1', 'fam3', 'OPT1'),
      makeToken('o2', 'fam4', 'OPT2'),
    ];
    const result = buildMixedAstFromSelections(
      mustTokens,
      optTokens,
      new Set<string>(),
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    expect(compile(result!)).toBe('"MUST1" "MUST2" "OPT1|OPT2"');
  });

  it('builds T7 pattern: "!BAD" "MUST" "OPT1|OPT2"', () => {
    // T7 verified: ! item-wide negation as FIRST AND child
    const allTokens = [
      makeToken('m1', 'fam1', 'MUST'),
      makeToken('o1', 'fam2', 'OPT1'),
      makeToken('o2', 'fam3', 'OPT2'),
      makeToken('b1', 'fam4', 'BAD'),
    ];
    const mustTokens = [allTokens[0]];
    const optTokens = [allTokens[1], allTokens[2]];
    const excludedIds = new Set<string>(['b1']);
    // Note: BAD token must be in mustTokens or optTokens to be picked up as excluded
    // (excludedIds is a subset of mustTokens ∪ optTokens)
    const result = buildMixedAstFromSelections(
      [...mustTokens, allTokens[3]],  // include BAD in mustTokens so it gets excluded
      optTokens,
      excludedIds,
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    expect(compile(result!)).toBe('"!BAD" "MUST" "OPT1|OPT2"');
  });

  it('builds T6 pattern: multiple MIXED_OR groups (caller ANDs them)', () => {
    // For multiple OPT groups, the caller calls buildMixedAstFromSelections
    // twice and ANDs the results manually.
    const mustTokens = [makeToken('m1', 'fam1', 'MUST')];
    const optGroup1 = [makeToken('o1', 'fam2', 'OPT1'), makeToken('o2', 'fam3', 'OPT2')];
    const optGroup2 = [makeToken('o3', 'fam4', 'OPT3'), makeToken('o4', 'fam5', 'OPT4')];

    const ast1 = buildMixedAstFromSelections(
      mustTokens,
      optGroup1,
      new Set<string>(),
      null,
      null,
      false,
      LOCALE,
      {}
    );
    // For ast2, we want only OPT3|OPT4 (no MUST). But buildMixedAstFromSelections
    // returns AND([MUST, MIXED_OR]) for ast1, and AND([MIXED_OR2]) for ast2.
    // The caller's job is to extract MIXED_OR2 from ast2 and AND it into ast1.
    // For this test, we just verify the simpler case: two separate calls.
    const ast2 = buildMixedAstFromSelections(
      [],
      optGroup2,
      new Set<string>(),
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(compile(ast1!)).toBe('"MUST" "OPT1|OPT2"');
    expect(compile(ast2!)).toBe('"OPT3|OPT4"');
  });

  it('MIXED_OR has anchorFirstAltOnly: true (KI#45 mitigation)', () => {
    // Verify the AST structure: OPT children should be wrapped in MIXED_OR
    // with options.anchorFirstAltOnly === true
    const optTokens = [makeToken('o1', 'fam1', 'OPT1'), makeToken('o2', 'fam2', 'OPT2')];
    const result = buildMixedAstFromSelections(
      [],
      optTokens,
      new Set<string>(),
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe('MIXED_OR');
    if (result!.type === 'MIXED_OR') {
      expect(result!.options?.anchorFirstAltOnly).toBe(true);
    }
  });

  it('MIXED_OR with single OPT token still gets anchorFirstAltOnly', () => {
    const optTokens = [makeToken('o1', 'fam1', 'ONLY_OPT')];
    const result = buildMixedAstFromSelections(
      [],
      optTokens,
      new Set<string>(),
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe('MIXED_OR');
    if (result!.type === 'MIXED_OR') {
      expect(result!.options?.anchorFirstAltOnly).toBe(true);
      expect(result!.children.length).toBe(1);
    }
    expect(compile(result!)).toBe('"ONLY_OPT"');
  });

  it('builds reversed RANGE in OPT (T9 reversed — reuse MUST logic)', () => {
    // T9 reversed: implicit mod with number at end of template.
    // The token's affix='implicit' triggers reversed=true in buildAstFromSelections.
    // When this token is in OPT, the reversed RANGE should appear in MIXED_OR.
    //
    // Note: implicit mods do NOT get colonAnchor (colonAnchor requires !isImplicit).
    // They use the suffix.*numRegex form without `: ` prefix.
    const optTokens = [
      makeRangedToken('o1', 'fam1', 'редких монстров', [[1, 3]], {
        affix: 'implicit',
        rawTextTemplate: { ru: 'дополнительных редких монстров: ##' },
      }),
    ];
    const result = buildMixedAstFromSelections(
      [],
      optTokens,
      new Set<string>(),
      1,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    // Reversed RANGE: suffix.*numRegex (no ^, since ^ doesn't apply to reversed)
    // The exact regex depends on number-regex implementation, but should contain
    // the suffix followed by .* and a number pattern.
    const compiled = compile(result!);
    expect(compiled).toContain('редких монстров.*');
    // Should NOT contain `: ` because implicit mods skip colonAnchor.
    // (colonAnchor is only for non-implicit reversed mods ending in `: ##`)
    expect(compiled).not.toContain(': ');
  });

  it('builds direct RANGE in OPT (T9 direct form)', () => {
    // T9 direct: N%.*suffix form, verified in-game
    const optTokens = [
      makeRangedToken('o1', 'fam1', 'пробивает', [[6, 16]], {
        rawTextTemplate: { ru: '##% урона пробивает' },
      }),
    ];
    const result = buildMixedAstFromSelections(
      [],
      optTokens,
      new Set<string>(),
      6,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    const compiled = compile(result!);
    // Direct form: number pattern comes first, then .*suffix
    expect(compiled).toContain('пробивает');
  });

  it('excluded tokens are removed from MUST and OPT, appear as !BAD', () => {
    // Token in mustTokens that is also in excludedIds → becomes !BAD, not MUST
    // Token in optTokens that is also in excludedIds → becomes !BAD, not OPT
    const mustTokens = [
      makeToken('m1', 'fam1', 'MUST_KEEP'),
      makeToken('m2', 'fam1', 'MUST_EXCLUDE'),
    ];
    const optTokens = [
      makeToken('o1', 'fam2', 'OPT_KEEP'),
      makeToken('o2', 'fam2', 'OPT_EXCLUDE'),
    ];
    const excludedIds = new Set<string>(['m2', 'o2']);
    const result = buildMixedAstFromSelections(
      mustTokens,
      optTokens,
      excludedIds,
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    const compiled = compile(result!);
    // !MUST_EXCLUDE|OPT_EXCLUDE as first child (sorted? order may vary)
    expect(compiled).toContain('!MUST_EXCLUDE|OPT_EXCLUDE');
    expect(compiled).toContain('MUST_KEEP');
    expect(compiled).toContain('OPT_KEEP');
    // MUST_EXCLUDE should NOT appear as a standalone MUST
    expect(compiled).not.toContain('"MUST_EXCLUDE"');
    // OPT_EXCLUDE should NOT appear in the OPT group
    expect(compiled).not.toContain('OPT_KEEP|OPT_EXCLUDE');
  });

  it('single excluded token → single !BAD (not OR-wrapped)', () => {
    const mustTokens = [
      makeToken('m1', 'fam1', 'MUST'),
      makeToken('m2', 'fam1', 'BAD'),
    ];
    const excludedIds = new Set<string>(['m2']);
    const result = buildMixedAstFromSelections(
      mustTokens,
      [],
      excludedIds,
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(result).not.toBeNull();
    expect(compile(result!)).toBe('"!BAD" "MUST"');
  });

  // iter 162 (KI#49): regression test for the T3 scenario from the MIXED
  // test plan. The user selects 1 EXCLUDE + 1 MUST + 1 OPT, where the
  // EXCLUDE token is NOT in mustTokens or optTokens (it's a pure-exclude
  // selection — only in excludedIds). Before iter 162, this token was
  // silently dropped from the `!BAD` block.
  //
  // Reproduces: https://github.com/vudirvp-sketch/poe2-regex-ru/issues (T3)
  // Steps: open Amulet, MIXED mode, right-click «+XX% к сопротивлению хаосу»
  // (EXCLUDE), click «+XX к меткости» (MUST), shift+click «XX% повышение
  // скорости регенерации маны» (OPT). Expected: `"!хаосу" "меткости" "регенерации маны"`.
  // Actual (before fix): `"меткости" "регенерации маны"` (EXCLUDE missing).
  it('KI#49: pure-EXCLUDE token (not in must/opt) appears in !BAD block', () => {
    const mustTokens = [makeToken('m1', 'fam-metkost', 'меткости')];
    const optTokens = [makeToken('o1', 'fam-regen', 'регенерации маны')];
    const excludeTokens = [makeToken('e1', 'fam-chaos', 'хаосу')];
    const excludedIds = new Set<string>(['e1']);
    const result = buildMixedAstFromSelections(
      mustTokens,
      optTokens,
      excludedIds,
      null,
      null,
      false,
      LOCALE,
      {},
      false,  // thresholdEnabled
      excludeTokens  // iter 162: pure-exclude tokens passed explicitly
    );
    expect(result).not.toBeNull();
    expect(compile(result!)).toBe('"!хаосу" "меткости" "регенерации маны"');
  });

  // iter 162 (KI#49): same scenario but WITHOUT the new excludeTokens param —
  // verifies backward compatibility (the bug is still reproducible when the
  // caller doesn't pass excludeTokens, which is exactly what useRegexBuilder
  // did before iter 162).
  it('KI#49 regression: WITHOUT excludeTokens param, pure-EXCLUDE is dropped (documents the bug)', () => {
    const mustTokens = [makeToken('m1', 'fam-metkost', 'меткости')];
    const optTokens = [makeToken('o1', 'fam-regen', 'регенерации маны')];
    const excludedIds = new Set<string>(['e1']);  // 'e1' not in must/opt
    const result = buildMixedAstFromSelections(
      mustTokens,
      optTokens,
      excludedIds,
      null,
      null,
      false,
      LOCALE,
      {}
      // excludeTokens intentionally omitted — simulates pre-iter-162 caller
    );
    expect(result).not.toBeNull();
    // Bug: EXCLUDE missing — only MUST + OPT appear. This test documents
    // the pre-fix behaviour; the fix is in the new excludeTokens param.
    expect(compile(result!)).toBe('"меткости" "регенерации маны"');
  });

  // iter 162 (KI#49): dedup — if a token is in BOTH mustTokens and
  // excludeTokens (e.g. caller mistakenly includes it in both), it should
  // appear only ONCE in the !BAD block (deduped by ID).
  it('KI#49: excludes from must/opt and excludeTokens are deduped by ID', () => {
    const badToken = makeToken('b1', 'fam-bad', 'BAD');
    const mustTokens = [makeToken('m1', 'fam1', 'MUST'), badToken];
    const excludedIds = new Set<string>(['b1']);
    const result = buildMixedAstFromSelections(
      mustTokens,
      [],
      excludedIds,
      null,
      null,
      false,
      LOCALE,
      {},
      false,
      [badToken]  // same token passed twice (once in must, once in exclude)
    );
    expect(result).not.toBeNull();
    // Should compile to `"!BAD" "MUST"` — not `"!BAD|BAD" "MUST"`.
    expect(compile(result!)).toBe('"!BAD" "MUST"');
  });
});

// ─── truncateMixedOrLiterals tests ───

describe('truncateMixedOrLiterals', () => {
  it('returns AST unchanged when no MIXED_OR present', () => {
    const ast: ASTNode = {
      type: 'AND',
      children: [
        { type: 'LITERAL', value: 'verylongstringthatshouldnotbetruncated' },
        { type: 'OR', children: [{ type: 'LITERAL', value: 'short' }] },
      ],
    };
    const result = truncateMixedOrLiterals(ast, 5);
    expect(result).toEqual(ast);
  });

  it('truncates LITERAL values inside MIXED_OR to maxLen', () => {
    const ast: ASTNode = {
      type: 'MIXED_OR',
      children: [
        { type: 'LITERAL', value: 'short' },  // 5 chars — unchanged
        { type: 'LITERAL', value: 'verylongstring' },  // 15 chars — truncated to 5
      ],
    };
    const result = truncateMixedOrLiterals(ast, 5);
    expect(result.type).toBe('MIXED_OR');
    if (result.type === 'MIXED_OR') {
      expect(result.children[0]).toEqual({ type: 'LITERAL', value: 'short' });
      expect(result.children[1]).toEqual({ type: 'LITERAL', value: 'veryl' });
    }
  });

  it('preserves tokenId when truncating', () => {
    const ast: ASTNode = {
      type: 'MIXED_OR',
      children: [
        { type: 'LITERAL', value: 'verylongstring', tokenId: 'tok1' },
      ],
    };
    const result = truncateMixedOrLiterals(ast, 5);
    if (result.type === 'MIXED_OR') {
      const child = result.children[0];
      if (child.type === 'LITERAL') {
        expect(child.value).toBe('veryl');
        expect(child.tokenId).toBe('tok1');
      }
    }
  });

  it('preserves MIXED_OR options when truncating', () => {
    const ast: ASTNode = {
      type: 'MIXED_OR',
      children: [
        { type: 'LITERAL', value: 'verylongstring' },
      ],
      options: { anchorFirstAltOnly: true },
    };
    const result = truncateMixedOrLiterals(ast, 5);
    if (result.type === 'MIXED_OR') {
      expect(result.options?.anchorFirstAltOnly).toBe(true);
    }
  });

  it('does NOT truncate LITERAL values outside MIXED_OR', () => {
    const ast: ASTNode = {
      type: 'AND',
      children: [
        { type: 'LITERAL', value: 'verylongstring' },  // outside MIXED_OR — kept
        {
          type: 'MIXED_OR',
          children: [
            { type: 'LITERAL', value: 'verylongstring' },  // inside — truncated
          ],
        },
      ],
    };
    const result = truncateMixedOrLiterals(ast, 5);
    if (result.type === 'AND') {
      // First child (outside MIXED_OR) — unchanged
      expect(result.children[0]).toEqual({ type: 'LITERAL', value: 'verylongstring' });
      // Second child (MIXED_OR) — truncated
      const mixedOr = result.children[1];
      if (mixedOr.type === 'MIXED_OR') {
        const inner = mixedOr.children[0];
        if (inner.type === 'LITERAL') {
          expect(inner.value).toBe('veryl');
        }
      }
    }
  });

  it('does NOT truncate RANGE nodes inside MIXED_OR', () => {
    const ast: ASTNode = {
      type: 'MIXED_OR',
      children: [
        { type: 'RANGE', min: 27, max: 30, suffix: 'verylongsuffix' },
      ],
    };
    const result = truncateMixedOrLiterals(ast, 5);
    if (result.type === 'MIXED_OR') {
      // RANGE should be unchanged (we can't safely shorten suffix without
      // potentially breaking the regex semantics)
      expect(result.children[0]).toEqual(ast.children[0]);
    }
  });

  it('default maxLen is 12', () => {
    // 'сопротивлений' is 13 chars (с-о-п-р-о-т-и-в-л-е-н-и-й).
    // Truncated to default maxLen=12 → 'сопротивлени' (first 12 chars).
    const ast: ASTNode = {
      type: 'MIXED_OR',
      children: [
        { type: 'LITERAL', value: 'сопротивлений' },  // 13 chars
      ],
    };
    const result = truncateMixedOrLiterals(ast);  // no maxLen arg
    if (result.type === 'MIXED_OR') {
      const child = result.children[0];
      if (child.type === 'LITERAL') {
        expect(child.value).toBe('сопротивлени');  // first 12 chars
        expect(child.value.length).toBe(12);
      }
    }
  });

  it('handles nested MIXED_OR (inside AND)', () => {
    const ast: ASTNode = {
      type: 'AND',
      children: [
        {
          type: 'MIXED_OR',
          children: [
            { type: 'LITERAL', value: 'verylongstring1' },
            { type: 'LITERAL', value: 'verylongstring2' },
          ],
        },
      ],
    };
    const result = truncateMixedOrLiterals(ast, 5);
    if (result.type === 'AND') {
      const mixedOr = result.children[0];
      if (mixedOr.type === 'MIXED_OR') {
        expect((mixedOr.children[0] as { value: string }).value).toBe('veryl');
        expect((mixedOr.children[1] as { value: string }).value).toBe('veryl');
      }
    }
  });

  it('PURE: does not mutate the input AST', () => {
    const original: ASTNode = {
      type: 'MIXED_OR',
      children: [
        { type: 'LITERAL', value: 'verylongstring' },
      ],
    };
    const originalCopy: ASTNode = JSON.parse(JSON.stringify(original));
    truncateMixedOrLiterals(original, 5);
    expect(original).toEqual(originalCopy);
  });

  it('integration: compile after truncation produces shorter regex', () => {
    // Build a long OPT group, compile, truncate, recompile — should be shorter
    const optTokens = [
      makeToken('o1', 'fam1', 'оченьдлинноезначение1'),
      makeToken('o2', 'fam2', 'оченьдлинноезначение2'),
      makeToken('o3', 'fam3', 'оченьдлинноезначение3'),
    ];
    const ast = buildMixedAstFromSelections(
      [],
      optTokens,
      new Set<string>(),
      null,
      null,
      false,
      LOCALE,
      {}
    );
    expect(ast).not.toBeNull();

    const beforeTruncation = compile(ast!);
    const truncated = truncateMixedOrLiterals(ast!, 8);
    const afterTruncation = compile(truncated);

    expect(afterTruncation.length).toBeLessThan(beforeTruncation.length);
    // Each value should be truncated to 8 chars: 'оченьдлинноезначение1' → 'оченьдли'
    expect(afterTruncation).toContain('оченьдли');
    expect(afterTruncation).not.toContain('оченьдлинноезначение1');
  });
});
