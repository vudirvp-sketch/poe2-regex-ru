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
});
