/**
 * iter 158 — MIXED_OR compilation tests.
 *
 * MIXED_OR is an OR-group inside an AND-context — the verified combined-mode
 * pattern (iter 157, KI#44 closed):
 *   `"MUST1" "MUST2" "OPT1|OPT2|OPT3"`
 *
 * These tests verify that the compiler:
 *  - Compiles MIXED_OR identically to OR (single quoted group, `|` separator)
 *  - Applies KI#45 mitigation when `anchorFirstAltOnly: true` (strip leading
 *    `^` from non-first alternatives)
 *  - Preserves `^` on the FIRST alternative (so anchorStart=true still works)
 *  - Works inside an AND context (parent AND wraps each child in quotes)
 *  - Handles LITERAL, RANGE, and AND-in-MIXED_OR (iter 49 transform) children
 */
import { describe, it, expect } from 'vitest';
import { compile } from '@core/compiler';
import { and, mixedOr, literal, range, exclude } from '@core/ast';

describe('compile MIXED_OR', () => {
  // ─── Basic compilation (identical to OR) ────────────────────────────────

  it('compiles MIXED_OR without options identically to OR', () => {
    const result = compile(mixedOr([literal('огн'), literal('хол')]));
    expect(result).toBe('"огн|хол"');
  });

  it('compiles MIXED_OR with empty options identically to OR', () => {
    const result = compile(mixedOr([literal('огн'), literal('хол')], {}));
    expect(result).toBe('"огн|хол"');
  });

  it('compiles MIXED_OR with three LITERAL children', () => {
    const result = compile(mixedOr([literal('A'), literal('B'), literal('C')]));
    expect(result).toBe('"A|B|C"');
  });

  it('compiles single-child MIXED_OR (degenerate but valid)', () => {
    const result = compile(mixedOr([literal('solo')]));
    expect(result).toBe('"solo"');
  });

  it('returns empty string for empty MIXED_OR', () => {
    const result = compile(mixedOr([]));
    expect(result).toBe('');
  });

  // ─── AND context (the canonical MIXED pattern) ──────────────────────────

  it('compiles AND(LITERAL, LITERAL, MIXED_OR) → "MUST1" "MUST2" "OPT1|OPT2"', () => {
    const result = compile(
      and(
        literal('MUST1'),
        literal('MUST2'),
        mixedOr([literal('OPT1'), literal('OPT2')])
      )
    );
    // The canonical iter 157 verified pattern
    expect(result).toBe('"MUST1" "MUST2" "OPT1|OPT2"');
  });

  it('compiles AND(LITERAL, MIXED_OR) → "MUST" "OPT1|OPT2"', () => {
    const result = compile(
      and(
        literal('MUST'),
        mixedOr([literal('OPT1'), literal('OPT2')])
      )
    );
    expect(result).toBe('"MUST" "OPT1|OPT2"');
  });

  it('compiles MIXED_OR inside AND with EXCLUDE → "!BAD" "MUST" "OPT1|OPT2"', () => {
    // T7 verified pattern: ! item-wide negation as FIRST AND child
    const result = compile(
      and(
        exclude(literal('BAD')),
        literal('MUST'),
        mixedOr([literal('OPT1'), literal('OPT2')])
      )
    );
    expect(result).toBe('"!BAD" "MUST" "OPT1|OPT2"');
  });

  // ─── KI#45 mitigation: anchorFirstAltOnly ───────────────────────────────

  it('KI#45: anchorFirstAltOnly strips ^ from non-first LITERAL alternatives', () => {
    // Simulate a user-controlled ^ in LITERAL values (rare but possible)
    const result = compile(
      mixedOr(
        [literal('^X.*P1'), literal('^Y.*P2')],
        { anchorFirstAltOnly: true }
      )
    );
    // First alt keeps ^, second alt loses ^
    expect(result).toBe('"^X.*P1|Y.*P2"');
  });

  it('KI#45: anchorFirstAltOnly preserves ^ on FIRST alternative only', () => {
    const result = compile(
      mixedOr(
        [literal('^A'), literal('^B'), literal('^C')],
        { anchorFirstAltOnly: true }
      )
    );
    expect(result).toBe('"^A|B|C"');
  });

  it('KI#45: anchorFirstAltOnly with no ^ in values — no change', () => {
    const result = compile(
      mixedOr(
        [literal('A'), literal('B'), literal('C')],
        { anchorFirstAltOnly: true }
      )
    );
    expect(result).toBe('"A|B|C"');
  });

  it('KI#45: without anchorFirstAltOnly, ^ stays on all alternatives (KI#45 bug reproduced)', () => {
    // This is the BROKEN behavior — what would happen without the mitigation.
    // The mitigation is opt-in via anchorFirstAltOnly=true.
    const result = compile(
      mixedOr(
        [literal('^A'), literal('^B')],
        // No options — ^ stays on all alternatives
      )
    );
    expect(result).toBe('"^A|^B"');
  });

  it('KI#45: anchorFirstAltOnly strips ^ from RANGE anchorStart on non-first alt', () => {
    // RANGE with anchorStart=true normally emits ^numRegex...suffix
    // With anchorFirstAltOnly, the ^ is stripped from non-first alternatives.
    // The compact decade form of 27-30 is (2[7-9]|30) per number-regex.ts.
    const result = compile(
      mixedOr(
        [
          range(27, 30, 'suffix', undefined, undefined, true),  // anchorStart=true
          range(40, 50, 'suffix', undefined, undefined, true),  // anchorStart=true
        ],
        { anchorFirstAltOnly: true }
      )
    );
    // First alt: ^(2[7-9]|30).*suffix (compact decade form)
    // Second alt: stripped of ^ → (4[0-9]|50).*suffix
    expect(result).toBe('"^(2[7-9]|30).*suffix|(4[0-9]|50).*suffix"');
  });

  it('KI#45: anchorFirstAltOnly preserves ^ on first RANGE anchorStart', () => {
    // Only first alt has anchorStart — should be unchanged
    // The compact decade form of 27-30 is (2[7-9]|30) per number-regex.ts.
    const result = compile(
      mixedOr(
        [
          range(27, 30, 'suffix', undefined, undefined, true),  // anchorStart=true
          literal('simple'),
        ],
        { anchorFirstAltOnly: true }
      )
    );
    expect(result).toBe('"^(2[7-9]|30).*suffix|simple"');
  });

  // ─── Range inside MIXED_OR (T9 direct + reversed) ───────────────────────

  it('compiles MIXED_OR with RANGE (direct form, T9 verified)', () => {
    // T9 verified: N%.*suffix works in OPT position
    // Compact form of 6-16 is ([6-9]|1[0-6]) per number-regex.ts.
    const result = compile(
      and(
        literal('MUST'),
        mixedOr([
          range(6, 16, 'pробивает', undefined, undefined, undefined, '%'),
          literal('fallback'),
        ])
      )
    );
    // ([6-9]|1[0-6])%.*pробивает — direct form (compact decade)
    expect(result).toBe('"MUST" "([6-9]|1[0-6])%.*pробивает|fallback"');
  });

  it('compiles MIXED_OR with reversed RANGE (T9 reversed — reuse MUST logic)', () => {
    // T9 reversed: suffix.*N% — number is at end of mod block
    // reversed=true makes compiler emit "suffix.*numRegex".
    // For reversed RANGE, the distributeAlternation function (iter 125 fix)
    // distributes the prefix into each alternative via Path D top-level |.
    // Compact form of 6-16 is ([6-9]|1[0-6]) → distributed as [6-9]|1[0-6].
    const result = compile(
      and(
        literal('MUST'),
        mixedOr([
          range(6, 16, 'pробивает', undefined, undefined, undefined, '%', true),
        ])
      )
    );
    // Reversed + distributeAlternation: pробивает.*[6-9]%|pробивает.*1[0-6]%
    expect(result).toBe('"MUST" "pробивает.*[6-9]%|pробивает.*1[0-6]%"');
  });

  // ─── AND-in-MIXED_OR transform (iter 49 / iter 108 reuse) ──────────────

  it('applies iter 108 transform to AND(LITERAL, LITERAL) child of MIXED_OR', () => {
    // When a child of MIXED_OR is AND(LITERAL_ctx, LITERAL_regex), the iter 108
    // transform merges them into LITERAL("ctx.*regex") to avoid nested quotes.
    const result = compile(
      and(
        literal('MUST'),
        mixedOr([
          and(literal('ctx'), literal('regex')),
          literal('simple'),
        ])
      )
    );
    // First alt: ctx.*regex (merged via .* bridge)
    // Second alt: simple
    expect(result).toBe('"MUST" "ctx.*regex|simple"');
  });

  it('KI#45 + iter 108 transform: strips ^ from non-first merged LITERAL', () => {
    // iter 49 transform produces ^(?!...).*literal — when this is the non-first
    // alt of MIXED_OR with anchorFirstAltOnly, the ^ should be stripped.
    const result = compile(
      mixedOr(
        [
          // First alt: simple literal
          literal('first'),
          // Second alt: AND(LITERAL, EXCLUDE(LITERAL)) → iter 49 transform
          // Produces ^(?!.*bad).*good — ^ should be stripped by anchorFirstAltOnly
          and(literal('good'), exclude(literal('bad'))),
        ],
        { anchorFirstAltOnly: true }
      )
    );
    // First alt: first
    // Second alt (after iter 49): ^(?!.*bad).*good → stripped to (?!.*bad).*good
    expect(result).toBe('"first|(?!.*bad).*good"');
  });

  // ─── Multiple MIXED_OR groups (T6 verified) ─────────────────────────────

  it('compiles AND(LITERAL, MIXED_OR, MIXED_OR) → multiple OPT groups (T6)', () => {
    // T6 verified: "MUST" "OPT1|OPT2" "OPT3|OPT4" — two OR groups + AND between
    const result = compile(
      and(
        literal('MUST'),
        mixedOr([literal('OPT1'), literal('OPT2')]),
        mixedOr([literal('OPT3'), literal('OPT4')])
      )
    );
    expect(result).toBe('"MUST" "OPT1|OPT2" "OPT3|OPT4"');
  });

  it('KI#45 applied independently to each MIXED_OR group', () => {
    // When there are multiple MIXED_OR groups, each applies KI#45 independently
    const result = compile(
      and(
        literal('MUST'),
        mixedOr(
          [literal('^A1'), literal('^A2')],
          { anchorFirstAltOnly: true }
        ),
        mixedOr(
          [literal('^B1'), literal('^B2')],
          { anchorFirstAltOnly: true }
        )
      )
    );
    // Each group: first alt keeps ^, second loses ^
    expect(result).toBe('"MUST" "^A1|A2" "^B1|B2"');
  });

  // ─── EXCLUDE inside MIXED_OR (rare but supported) ──────────────────────

  it('compiles MIXED_OR with EXCLUDE child', () => {
    // EXCLUDE inside MIXED_OR compiles to !A|B|C — same as OR
    const result = compile(
      mixedOr([
        exclude(literal('bad')),
        literal('good1'),
        literal('good2'),
      ])
    );
    expect(result).toBe('"!bad|good1|good2"');
  });
});
