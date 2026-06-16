import { describe, it, expect } from 'vitest';
import { optimize, truncateSuffix, isTruncationSafe } from '@core/optimizer';
import { removeConflictingExcludes, getValueKey } from '@core/core-optimizations';
import { and, or, literal, range, exclude } from '@core/ast';
import { compile } from '@core/compiler';
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

  // === Phase 3: Truncated tail suffix optimization ===

  describe('truncateSuffix', () => {
    it('truncates "эффективность" to "эффективн"', () => {
      expect(truncateSuffix('эффективность')).toBe('эффективн');
    });

    it('truncates "эффективность монстров" to "эффективн"', () => {
      expect(truncateSuffix('эффективность монстров')).toBe('эффективн');
    });

    it('truncates "бездна" to "бездн"', () => {
      expect(truncateSuffix('бездна')).toBe('бездн');
    });

    it('truncates "бездны" to "бездн"', () => {
      expect(truncateSuffix('бездны')).toBe('бездн');
    });

    it('truncates "путевого" to "путев"', () => {
      expect(truncateSuffix('путевого')).toBe('путев');
    });

    it('truncates "глубина" to "глубин"', () => {
      expect(truncateSuffix('глубина')).toBe('глубин');
    });

    it('does NOT truncate blacklisted "редкост"', () => {
      // "редкост" causes FP on item rarity label "редкий"
      expect(truncateSuffix('редкость')).toBe('редкость');
    });

    it('does NOT truncate unknown words', () => {
      expect(truncateSuffix('сопротивлению')).toBe('сопротивлению');
    });

    it('truncates compound suffix with safe word at end', () => {
      // Input like "к эффективность монстров" should have "эффективность монстров" truncated
      // because the key is at the END of the suffix — contiguous substring preserved
      expect(truncateSuffix('к эффективность монстров')).toBe('к эффективн');
    });

    it('truncates "количества редких монстров" → "количества редких монстр" (key at end)', () => {
      // "монстров" is at the END of the suffix — safe to truncate
      // "количества редких монстр" IS a contiguous substring of the rawText
      expect(truncateSuffix('количества редких монстров')).toBe('количества редких монстр');
    });

    // ─── Mid-phrase truncation MUST be rejected ───
    // PoE2 uses contiguous substring matching. Truncating a word that is
    // followed by more text breaks the match because the omitted suffix
    // characters create a gap. These are all regression tests for the bug
    // where "монстров на карте" was truncated to "монстр на карте".

    it('does NOT truncate "монстров на карте" — words follow the truncated word', () => {
      // "монстров" is NOT at the end — "на карте" follows
      // "монстр на карте" is NOT a substring of "монстров на карте"
      expect(truncateSuffix('монстров на карте')).toBe('монстров на карте');
    });

    it('does NOT truncate "количества редких монстров на карте" — mid-phrase', () => {
      // "монстров" is NOT at the end — "на карте" follows
      expect(truncateSuffix('количества редких монстров на карте')).toBe('количества редких монстров на карте');
    });

    it('does NOT truncate "волшебных монстров на карте" — mid-phrase', () => {
      expect(truncateSuffix('волшебных монстров на карте')).toBe('волшебных монстров на карте');
    });

    it('does NOT truncate "флакона здоровья" — words follow', () => {
      // "флакона" is NOT at the end — "здоровья" follows
      expect(truncateSuffix('флакона здоровья')).toBe('флакона здоровья');
    });

    it('does NOT truncate "оглушения булавами" — words follow', () => {
      // "оглушения" is NOT at the end — "булавами" follows
      expect(truncateSuffix('оглушения булавами')).toBe('оглушения булавами');
    });

    it('does NOT truncate "приспешников аур" — words follow', () => {
      // "приспешников" is NOT at the end — "аур" follows
      expect(truncateSuffix('приспешников аур')).toBe('приспешников аур');
    });

    it('does NOT truncate inside PoE2 OR group — "количеств(а редких монстров на карте|о дани)"', () => {
      // "монстров" appears inside a PoE2 (...) group, NOT at the end
      expect(truncateSuffix('количеств(а редких монстров на карте|о дани)')).toBe('количеств(а редких монстров на карте|о дани)');
    });

    it('truncates "монстров" standalone — key at exact end', () => {
      // "монстров" is the entire string — exact match or end-of-suffix
      expect(truncateSuffix('монстров')).toBe('монстр');
    });

    it('truncates "увеличение эффективность монстров" — multi-word key at end', () => {
      // "эффективность монстров" is in the safe list and ends the suffix (exact key match)
      expect(truncateSuffix('увеличение эффективность монстров')).toBe('увеличение эффективн');
    });

    it('truncates "увеличение эффективности монстров" — "монстров" at end', () => {
      // "эффективности монстров" is NOT a key, but "монстров" IS at the end
      expect(truncateSuffix('увеличение эффективности монстров')).toBe('увеличение эффективности монстр');
    });
  });

  describe('isTruncationSafe', () => {
    it('returns true for safe truncations', () => {
      expect(isTruncationSafe('эффективн')).toBe(true);
      expect(isTruncationSafe('бездн')).toBe(true);
      expect(isTruncationSafe('путев')).toBe(true);
      expect(isTruncationSafe('глубин')).toBe(true);
    });

    it('returns false for blacklisted truncations', () => {
      expect(isTruncationSafe('редкост')).toBe(false);
      expect(isTruncationSafe('редк')).toBe(false);
    });

    it('returns false for unknown truncations', () => {
      expect(isTruncationSafe('сопрот')).toBe(false);
    });
  });

  describe('Phase 3: truncateSuffixes in optimize()', () => {
    it('truncates LITERAL suffix in AST', () => {
      const ast = literal('эффективность монстров');
      const result = optimize(ast, {});
      if (result.type === 'LITERAL') {
        expect(result.value).toBe('эффективн');
      }
    });

    it('truncates RANGE suffix in AST', () => {
      const ast = range(30, undefined, 'эффективность монстров', undefined, undefined, false, '%', true);
      const result = optimize(ast, {});
      if (result.type === 'RANGE') {
        expect(result.suffix).toBe('эффективн');
      }
    });

    it('does NOT truncate blacklisted LITERAL', () => {
      const ast = literal('редкость');
      const result = optimize(ast, {});
      if (result.type === 'LITERAL') {
        expect(result.value).toBe('редкость');
      }
    });

    it('truncates suffixes inside AND nodes', () => {
      const ast = and(
        literal('эффективность монстров'),
        range(30, undefined, 'бездна')
      );
      const result = optimize(ast, {});
      if (result.type === 'AND') {
        const lit = result.children[0];
        const rng = result.children[1];
        if (lit.type === 'LITERAL') expect(lit.value).toBe('эффективн');
        if (rng.type === 'RANGE') expect(rng.suffix).toBe('бездн');
      }
    });

    it('truncates suffixes inside OR nodes', () => {
      const ast = or(
        literal('эффективность'),
        literal('бездна')
      );
      const result = optimize(ast, {});
      if (result.type === 'OR') {
        expect(result.children[0]).toMatchObject({ type: 'LITERAL', value: 'эффективн' });
        expect(result.children[1]).toMatchObject({ type: 'LITERAL', value: 'бездн' });
      }
    });
  });
});

// ─── removeConflictingExcludes tests ───

describe('removeConflictingExcludes (Phase 4)', () => {
  it('removes EXCLUDE that conflicts with sibling LITERAL in OR group', () => {
    // AST: OR(AND(LITERAL("к ловкости"), EXCLUDE(LITERAL(" интел"))), LITERAL("к интеллекту"))
    // " интел" is a substring of "к интеллекту" → conflict → remove EXCLUDE
    const ast = or(
      and(literal('к ловкости'), exclude(literal(' интел'))),
      literal('к интеллекту')
    );
    const result = removeConflictingExcludes(ast);

    // After fix: OR(LITERAL("к ловкости"), LITERAL("к интеллекту"))
    expect(result.type).toBe('OR');
    if (result.type === 'OR') {
      expect(result.children).toHaveLength(2);
      expect(result.children[0]).toMatchObject({ type: 'LITERAL', value: 'к ловкости' });
      expect(result.children[1]).toMatchObject({ type: 'LITERAL', value: 'к интеллекту' });
    }
  });

  it('keeps EXCLUDE when no conflict exists', () => {
    // AST: OR(AND(LITERAL("к ловкости"), EXCLUDE(LITERAL(" интел"))), LITERAL("к силе"))
    // " интел" is NOT a substring of "к силе" → no conflict → keep EXCLUDE
    const ast = or(
      and(literal('к ловкости'), exclude(literal(' интел'))),
      literal('к силе')
    );
    const result = removeConflictingExcludes(ast);

    expect(result.type).toBe('OR');
    if (result.type === 'OR') {
      expect(result.children).toHaveLength(2);
      // First child should still have the EXCLUDE
      expect(result.children[0].type).toBe('AND');
    }
  });

  it('unwraps AND when EXCLUDE is the only extra child', () => {
    // AST: OR(AND(LITERAL("к ловкости"), EXCLUDE(LITERAL(" интел"))), LITERAL("к интеллекту"))
    // After removing EXCLUDE, AND has only one child → unwrap to LITERAL
    const ast = or(
      and(literal('к ловкости'), exclude(literal(' интел'))),
      literal('к интеллекту')
    );
    const result = removeConflictingExcludes(ast);

    if (result.type === 'OR') {
      // AND was unwrapped to just LITERAL
      expect(result.children[0].type).toBe('LITERAL');
    }
  });

  it('keeps non-EXCLUDE children when EXCLUDE is removed from multi-child AND', () => {
    // AST: OR(AND(LITERAL("ctx"), LITERAL("к ловкости"), EXCLUDE(LITERAL(" интел"))), LITERAL("к интеллекту"))
    // After removing EXCLUDE, AND still has 2 children → keep AND
    const ast = or(
      and(literal('ctx'), literal('к ловкости'), exclude(literal(' интел'))),
      literal('к интеллекту')
    );
    const result = removeConflictingExcludes(ast);

    if (result.type === 'OR') {
      expect(result.children[0].type).toBe('AND');
      if (result.children[0].type === 'AND') {
        // ctx and к ловкости remain, интел removed
        expect(result.children[0].children).toHaveLength(2);
      }
    }
  });

  it('handles nested OR groups recursively', () => {
    // AST: AND(OR(AND(LITERAL("к ловкости"), EXCLUDE(LITERAL(" интел"))), LITERAL("к интеллекту")), LITERAL("редк"))
    const ast = and(
      or(
        and(literal('к ловкости'), exclude(literal(' интел'))),
        literal('к интеллекту')
      ),
      literal('редк')
    );
    const result = removeConflictingExcludes(ast);

    if (result.type === 'AND') {
      const orNode = result.children[0];
      if (orNode.type === 'OR') {
        expect(orNode.children[0].type).toBe('LITERAL');
      }
    }
  });
});

// ─── getValueKey: RANGE deduplication key ───

describe('getValueKey for RANGE nodes', () => {
  it('produces different keys for RANGE with min vs RANGE with min+max', () => {
    const rangeMinOnly = range(5, undefined, 'к силе', undefined, undefined, undefined, undefined, undefined, undefined, undefined, '+');
    const rangeMinMax = range(5, 10, 'к силе', undefined, undefined, undefined, undefined, undefined, undefined, undefined, '+');

    const keyMinOnly = getValueKey(rangeMinOnly);
    const keyMinMax = getValueKey(rangeMinMax);

    // These produce DIFFERENT compiled regex: [5-9]|\d{2,} vs (5|6|7|8|9|10)
    expect(keyMinOnly).not.toBe(keyMinMax);
  });

  it('produces different keys for RANGE with different max values', () => {
    const range1 = range(5, 10, 'к силе');
    const range2 = range(5, 15, 'к силе');

    expect(getValueKey(range1)).not.toBe(getValueKey(range2));
  });

  it('produces different keys for reversed vs non-reversed RANGE', () => {
    const normal = range(5, undefined, 'здоровья', undefined, undefined, undefined, undefined, false, undefined, undefined, undefined);
    const reversed = range(5, undefined, 'здоровья', undefined, undefined, undefined, undefined, true, undefined, undefined, undefined);

    expect(getValueKey(normal)).not.toBe(getValueKey(reversed));
  });

  it('produces different keys for anchorStart vs no anchor', () => {
    const noAnchor = range(5, undefined, 'к силе', undefined, undefined, false, undefined, undefined, undefined, undefined, '+');
    const withAnchor = range(5, undefined, 'к силе', undefined, undefined, true, undefined, undefined, undefined, undefined, '+');

    expect(getValueKey(noAnchor)).not.toBe(getValueKey(withAnchor));
  });

  it('produces different keys for anchorEnd vs no anchor', () => {
    const noAnchor = range(27, undefined, 'к сопротивлению огню');
    const withPercent = range(27, undefined, 'к сопротивлению огню', undefined, undefined, undefined, '%', undefined, undefined, undefined, undefined);

    expect(getValueKey(noAnchor)).not.toBe(getValueKey(withPercent));
  });

  it('produces different keys for threshold vs non-threshold', () => {
    const noThreshold = range(5, 10, 'к силе', undefined, undefined, undefined, undefined, undefined, undefined, false);
    const withThreshold = range(5, 10, 'к силе', undefined, undefined, undefined, undefined, undefined, undefined, true);

    expect(getValueKey(noThreshold)).not.toBe(getValueKey(withThreshold));
  });

  it('produces same key for truly identical RANGE nodes', () => {
    const r1 = range(5, 10, 'к силе', undefined, true, undefined, undefined, undefined, undefined, undefined, '+');
    const r2 = range(5, 10, 'к силе', undefined, true, undefined, undefined, undefined, undefined, undefined, '+');

    expect(getValueKey(r1)).toBe(getValueKey(r2));
  });

  it('does NOT incorrectly dedup RANGE nodes that differ only in max', () => {
    // Two RANGE nodes in OR group: one with min-only, one with min+max
    // They should NOT be deduplicated because they compile differently
    const ast = or(
      range(5, undefined, 'к силе', undefined, undefined, undefined, undefined, undefined, undefined, undefined, '+'),
      range(5, 10, 'к силе', undefined, undefined, undefined, undefined, undefined, undefined, undefined, '+')
    );

    const result = optimize(ast, {});

    // Should remain as OR with 2 children (not collapsed to 1)
    expect(result.type).toBe('OR');
    if (result.type === 'OR') {
      expect(result.children.length).toBe(2);
    }
  });

  // === Path D runtime consumption (iter 40, D4 verification) ===
  //
  // Path D opt-table entries have regexes like "prefix.*A|prefix.*B|prefix.*C"
  // (top-level `|` with `.*` bridges). These MUST be applied at runtime even
  // when the savings calculation is negative, because the alternative —
  // separate quoted groups joined by `|` (e.g., `"X"|"Y"|"Z"`) — is BROKEN
  // in PoE2 (iter 38: B0 confirmed zero matches).
  //
  // The opt-table entry replaces multiple LITERALs in an OR with a single
  // LITERAL containing the Path D regex. The compiler then wraps it in
  // quotes: `"prefix.*A|prefix.*B|prefix.*C"` — single quoted group with
  // top-level `|`, which WORKS in PoE2.

  describe('Path D runtime consumption (D4)', () => {
    it('applies Path D opt-table entry to OR of plain LITERALs', () => {
      // Path D entry: "увеличение урона.*огня|увеличение урона.*хаосом|увеличение урона.*луками"
      const pathDTable: Record<string, OptimizationEntry> = {
        'jewel.fire:jewel.chaos:jewel.bow': {
          ids: ['jewel.fire', 'jewel.chaos', 'jewel.bow'],
          regex: { ru: 'увеличение урона.*огня|увеличение урона.*хаосом|увеличение урона.*луками' },
          weight: 68,
          count: 3,
        },
      };

      const ast = or(
        literal('увеличение урона огня', 'jewel.fire'),
        literal('увеличение урона хаосом', 'jewel.chaos'),
        literal('увеличение урона луками', 'jewel.bow')
      );

      const result = optimize(ast, pathDTable);

      // Should be replaced with a single LITERAL containing the Path D regex
      expect(result.type).toBe('LITERAL');
      if (result.type === 'LITERAL') {
        expect(result.value).toBe('увеличение урона.*огня|увеличение урона.*хаосом|увеличение урона.*луками');
        expect(result.tokenId).toContain('opt:');
      }
    });

    it('applies Path D opt-table entry even when savings is negative', () => {
      // Path D regex is LONGER than sum of individual regexes (each alt repeats prefix).
      // But it MUST be applied because the alternative is broken.
      // Individual regexes: "к сопротивлению огню" (20) + "к сопротивлению холоду" (22) = 42 chars
      // Path D regex: "к сопротивлению.*огню|к сопротивлению.*холоду" = 47 chars (LONGER)
      // Without opt: compiler produces "к сопротивлению огню|к сопротивлению холоду" (single quoted group, WORKS for plain LITERALs)
      // But for AND-wrapped LITERALs (regexPrefixContext), compiler produces BROKEN "X"|"Y".
      // The opt-table is needed for the AND-wrapped case.
      const pathDTable: Record<string, OptimizationEntry> = {
        'belt.fire:belt.cold': {
          ids: ['belt.fire', 'belt.cold'],
          regex: { ru: 'к сопротивлению.*огню|к сопротивлению.*холоду' },
          weight: 47,
          count: 2,
        },
      };

      // AND-wrapped LITERALs (simulating regexPrefixContext)
      const ast = or(
        and(literal('к'), literal('сопротивлению огню', 'belt.fire')),
        and(literal('к'), literal('сопротивлению холоду', 'belt.cold'))
      );

      const result = optimize(ast, pathDTable);

      // Should be replaced with a single LITERAL (Path D regex)
      expect(result.type).toBe('LITERAL');
      if (result.type === 'LITERAL') {
        expect(result.value).toBe('к сопротивлению.*огню|к сопротивлению.*холоду');
      }
    });

    it('compiled Path D regex is a single quoted group with top-level |', () => {
      // Verify the full pipeline: optimize → compile produces WORKING regex.
      // The compiled output must be a single quoted group (not "X"|"Y"|"Z").
      const pathDTable: Record<string, OptimizationEntry> = {
        'jewel.fire:jewel.chaos:jewel.bow': {
          ids: ['jewel.fire', 'jewel.chaos', 'jewel.bow'],
          regex: { ru: 'увеличение урона.*огня|увеличение урона.*хаосом|увеличение урона.*луками' },
          weight: 68,
          count: 3,
        },
      };

      const ast = or(
        literal('увеличение урона огня', 'jewel.fire'),
        literal('увеличение урона хаосом', 'jewel.chaos'),
        literal('увеличение урона луками', 'jewel.bow')
      );

      const optimized = optimize(ast, pathDTable);
      const compiled = compile(optimized);

      // Should be a single quoted group: "увеличение урона.*огня|..."
      expect(compiled.startsWith('"')).toBe(true);
      expect(compiled.endsWith('"')).toBe(true);

      // Should have top-level | inside the quoted group
      const inner = compiled.slice(1, -1); // remove surrounding quotes
      expect(inner).toContain('|');

      // Should NOT have "|\"" or ""|" (separate quoted groups joined by |)
      expect(compiled).not.toMatch(/"\|"/);

      // Should NOT have () with | inside (Path D flattens all such groups)
      expect(inner).not.toMatch(/\([^)]*\|/);
    });
  });
});
