import { describe, it, expect } from 'vitest';
import { optimize } from '@core/optimizer';
import { and, or, literal } from '@core/ast';
import type { OptimizationEntry } from '@shared/types';

describe('optimize', () => {
  const optimizationTable: Record<string, OptimizationEntry> = {
    'waystone.enfeeble:waystone.temporal_chains:waystone.elemental_weakness': {
      ids: ['waystone.enfeeble', 'waystone.temporal_chains', 'waystone.elemental_weakness'],
      regex: { ru: 'проклят' },
      weight: 7,
      count: 3,
    },
  };

  it('returns AST unchanged when no optimization matches', () => {
    const ast = or(literal('огн', 'waystone.fire_res'), literal('хол', 'waystone.cold_res'));
    const result = optimize(ast, optimizationTable);
    expect(result).toEqual(ast);
  });

  it('replaces matching OR group with optimized literal', () => {
    const ast = or(
      literal('обесц', 'waystone.enfeeble'),
      literal('цепя', 'waystone.temporal_chains'),
      literal('слаб.*стих', 'waystone.elemental_weakness')
    );
    const result = optimize(ast, optimizationTable);
    // Should be replaced with a single optimized literal
    expect(result.type).toBe('LITERAL');
    if (result.type === 'LITERAL') {
      expect(result.value).toBe('проклят');
    }
  });

  it('handles empty optimization table', () => {
    const ast = or(literal('огн', 'waystone.fire_res'));
    const result = optimize(ast, {});
    // Deduplication unwraps single-child OR into LITERAL
    expect(result.type).toBe('LITERAL');
    if (result.type === 'LITERAL') {
      expect(result.value).toBe('огн');
    }
  });

  it('deduplicates identical regex values in OR group', () => {
    // Three tokens with same regex (e.g., all fire res tiers)
    const ast = or(
      literal('к сопротивлению огню', 'belt.fireresist1'),
      literal('к сопротивлению огню', 'belt.fireresist2'),
      literal('к сопротивлению огню', 'belt.fireresist3')
    );
    const result = optimize(ast, {});
    // Should collapse to single LITERAL
    expect(result.type).toBe('LITERAL');
    if (result.type === 'LITERAL') {
      expect(result.value).toBe('к сопротивлению огню');
      expect(result.tokenId).toContain('dedup:');
    }
  });

  it('keeps different regex values separate in OR group', () => {
    const ast = or(
      literal('к сопротивлению огню', 'belt.fireresist'),
      literal('к сопротивлению холоду', 'belt.coldresist')
    );
    const result = optimize(ast, {});
    expect(result.type).toBe('OR');
    if (result.type === 'OR') {
      expect(result.children.length).toBe(2);
    }
  });

  it('preserves non-OR nodes', () => {
    const ast = and(literal('test'));
    const result = optimize(ast, optimizationTable);
    expect(result).toEqual(ast);
  });

  // === Phase 2: regexPrefixContext / regexExclude support ===
  //
  // These tests use DIFFERENT regexes per token that share a common substring,
  // because identical regexes are handled by the dedup phase (Phase 1), not
  // the optimization table (Phase 2). The optimization table is for when
  // tokens have different individual regexes but a shared shorter substring.

  describe('optimization with regexPrefixContext', () => {
    const tableWithContext: Record<string, OptimizationEntry> = {
      'amulet.miniondmg1:amulet.miniondmg2:amulet.miniondmg3': {
        ids: ['amulet.miniondmg1', 'amulet.miniondmg2', 'amulet.miniondmg3'],
        regex: { ru: 'увеличение урона' },
        regexPrefixContext: { ru: 'имеют' },
        weight: 15,
        count: 3,
      },
    };

    it('creates AND(LITERAL(context), LITERAL(regex)) when entry has regexPrefixContext', () => {
      // Different regexes per token — optimization table finds shared "увеличение урона"
      const ast = or(
        literal('увеличение урона от огня', 'amulet.miniondmg1'),
        literal('увеличение урона от холода', 'amulet.miniondmg2'),
        literal('увеличение урона от молнии', 'amulet.miniondmg3')
      );
      const result = optimize(ast, tableWithContext);

      // Should produce AND(LITERAL("имеют"), LITERAL("увеличение урона"))
      expect(result.type).toBe('AND');
      if (result.type === 'AND') {
        expect(result.children.length).toBe(2);
        // First child: context literal
        expect(result.children[0].type).toBe('LITERAL');
        if (result.children[0].type === 'LITERAL') {
          expect(result.children[0].value).toBe('имеют');
        }
        // Second child: regex literal
        expect(result.children[1].type).toBe('LITERAL');
        if (result.children[1].type === 'LITERAL') {
          expect(result.children[1].value).toBe('увеличение урона');
          expect(result.children[1].tokenId).toContain('opt:');
        }
      }
    });

    it('creates plain LITERAL when entry has no regexPrefixContext', () => {
      const tableNoContext: Record<string, OptimizationEntry> = {
        'amulet.miniondmg1:amulet.miniondmg2': {
          ids: ['amulet.miniondmg1', 'amulet.miniondmg2'],
          regex: { ru: 'увеличение урона' },
          weight: 10,
          count: 2,
        },
      };
      const ast = or(
        literal('увеличение урона от огня', 'amulet.miniondmg1'),
        literal('увеличение урона от холода', 'amulet.miniondmg2')
      );
      const result = optimize(ast, tableNoContext);

      // Should produce plain LITERAL (no AND wrapper)
      expect(result.type).toBe('LITERAL');
      if (result.type === 'LITERAL') {
        expect(result.value).toBe('увеличение урона');
      }
    });
  });

  describe('optimization with regexExclude', () => {
    const tableWithExcludes: Record<string, OptimizationEntry> = {
      'amulet.miniondmg1:amulet.miniondmg2': {
        ids: ['amulet.miniondmg1', 'amulet.miniondmg2'],
        regex: { ru: 'увеличение урона' },
        regexExclude: { ru: ['Приспеш', 'и'] },
        weight: 10,
        count: 2,
      },
    };

    it('creates AND(LITERAL(regex), EXCLUDE(OR(...))) when entry has multiple regexExclude', () => {
      const ast = or(
        literal('увеличение урона от огня', 'amulet.miniondmg1'),
        literal('увеличение урона от холода', 'amulet.miniondmg2')
      );
      const result = optimize(ast, tableWithExcludes);

      // Should produce AND(LITERAL(regex), EXCLUDE(OR(exclude1, exclude2)))
      expect(result.type).toBe('AND');
      if (result.type === 'AND') {
        expect(result.children.length).toBe(2);
        // First child: regex literal
        expect(result.children[0].type).toBe('LITERAL');
        if (result.children[0].type === 'LITERAL') {
          expect(result.children[0].value).toBe('увеличение урона');
        }
        // Second child: EXCLUDE
        expect(result.children[1].type).toBe('EXCLUDE');
        if (result.children[1].type === 'EXCLUDE') {
          expect(result.children[1].child.type).toBe('OR');
        }
      }
    });

    it('creates AND(LITERAL(regex), EXCLUDE(LITERAL(exclude))) for single exclude', () => {
      const tableSingleExclude: Record<string, OptimizationEntry> = {
        'amulet.miniondmg1:amulet.miniondmg2': {
          ids: ['amulet.miniondmg1', 'amulet.miniondmg2'],
          regex: { ru: 'увеличение урона' },
          regexExclude: { ru: ['Приспеш'] },
          weight: 10,
          count: 2,
        },
      };
      const ast = or(
        literal('увеличение урона от огня', 'amulet.miniondmg1'),
        literal('увеличение урона от холода', 'amulet.miniondmg2')
      );
      const result = optimize(ast, tableSingleExclude);

      // Should produce AND(LITERAL(regex), EXCLUDE(LITERAL(exclude)))
      expect(result.type).toBe('AND');
      if (result.type === 'AND') {
        expect(result.children[1].type).toBe('EXCLUDE');
        if (result.children[1].type === 'EXCLUDE') {
          // Single exclude → no OR wrapper, just LITERAL
          expect(result.children[1].child.type).toBe('LITERAL');
        }
      }
    });
  });

  describe('optimization with both regexPrefixContext and regexExclude', () => {
    const tableWithBoth: Record<string, OptimizationEntry> = {
      'amulet.miniondmg1:amulet.miniondmg2:amulet.miniondmg3': {
        ids: ['amulet.miniondmg1', 'amulet.miniondmg2', 'amulet.miniondmg3'],
        regex: { ru: 'увеличение урона' },
        regexPrefixContext: { ru: 'имеют' },
        regexExclude: { ru: ['Приспеш'] },
        weight: 15,
        count: 3,
      },
    };

    it('creates AND(LITERAL(context), LITERAL(regex), EXCLUDE(LITERAL(exclude)))', () => {
      const ast = or(
        literal('увеличение урона от огня', 'amulet.miniondmg1'),
        literal('увеличение урона от холода', 'amulet.miniondmg2'),
        literal('увеличение урона от молнии', 'amulet.miniondmg3')
      );
      const result = optimize(ast, tableWithBoth);

      // Should produce AND(LITERAL("имеют"), LITERAL("увеличение урона"), EXCLUDE(LITERAL("Приспеш")))
      expect(result.type).toBe('AND');
      if (result.type === 'AND') {
        expect(result.children.length).toBe(3);
        // First child: context
        expect(result.children[0].type).toBe('LITERAL');
        if (result.children[0].type === 'LITERAL') {
          expect(result.children[0].value).toBe('имеют');
        }
        // Second child: regex
        expect(result.children[1].type).toBe('LITERAL');
        if (result.children[1].type === 'LITERAL') {
          expect(result.children[1].value).toBe('увеличение урона');
          expect(result.children[1].tokenId).toContain('opt:');
        }
        // Third child: exclude
        expect(result.children[2].type).toBe('EXCLUDE');
      }
    });

    it('leaves unoptimized tokens untouched alongside optimized group', () => {
      const ast = or(
        literal('увеличение урона от огня', 'amulet.miniondmg1'),
        literal('увеличение урона от холода', 'amulet.miniondmg2'),
        literal('к сопротивлению огню', 'belt.fireresist') // unrelated token
      );
      const result = optimize(ast, tableWithBoth);

      // Should produce OR with: optimized AND node + remaining LITERAL
      expect(result.type).toBe('OR');
      if (result.type === 'OR') {
        expect(result.children.length).toBe(2);
        // One child is the optimized AND node
        const andChild = result.children.find(c => c.type === 'AND');
        expect(andChild).toBeDefined();
        // Other child is the unrelated LITERAL
        const litChild = result.children.find(c =>
          c.type === 'LITERAL' && c.value === 'к сопротивлению огню'
        );
        expect(litChild).toBeDefined();
      }
    });
  });

  describe('AND-wrapped LITERAL optimization', () => {
    const tableForWrapped: Record<string, OptimizationEntry> = {
      'ring.miniondmg1:ring.miniondmg2:ring.miniondmg3': {
        ids: ['ring.miniondmg1', 'ring.miniondmg2', 'ring.miniondmg3'],
        regex: { ru: 'увеличение урона' },
        regexPrefixContext: { ru: 'имеют' },
        weight: 12,
        count: 3,
      },
    };

    it('finds AND-wrapped LITERALs inside OR groups and optimizes them', () => {
      // This simulates what buildAstFromSelections creates for tokens with regexPrefixContext
      // Using different regexes per token so the optimization table applies
      const ast = or(
        and(literal('имеют'), literal('увеличение урона от огня', 'ring.miniondmg1')),
        and(literal('имеют'), literal('увеличение урона от холода', 'ring.miniondmg2')),
        and(literal('имеют'), literal('увеличение урона от молнии', 'ring.miniondmg3'))
      );
      const result = optimize(ast, tableForWrapped);

      // The AND-wrapped tokens should be replaced by the optimization entry's
      // AND(LITERAL("имеют"), LITERAL("увеличение урона"))
      expect(result.type).toBe('AND');
      if (result.type === 'AND') {
        // Should have context + regex
        const hasContext = result.children.some(
          c => c.type === 'LITERAL' && c.value === 'имеют'
        );
        const hasRegex = result.children.some(
          c => c.type === 'LITERAL' && c.value === 'увеличение урона'
        );
        expect(hasContext).toBe(true);
        expect(hasRegex).toBe(true);
      }
    });

    it('deduplicates AND-wrapped LITERALs with same structure', () => {
      const ast = or(
        and(literal('имеют'), literal('к сопротивлению огню', 'belt.fireres1')),
        and(literal('имеют'), literal('к сопротивлению огню', 'belt.fireres2'))
      );
      const result = optimize(ast, {});

      // Should deduplicate to single AND wrapper (since both have same valueKey)
      expect(result.type).toBe('AND');
      if (result.type === 'AND') {
        expect(result.children.length).toBe(2);
        // Inner LITERAL should have dedup tokenId
        const regexChild = result.children.find(
          c => c.type === 'LITERAL' && c.value === 'к сопротивлению огню'
        );
        expect(regexChild).toBeDefined();
        if (regexChild?.type === 'LITERAL') {
          expect(regexChild.tokenId).toContain('dedup:');
        }
      }
    });
  });
});
