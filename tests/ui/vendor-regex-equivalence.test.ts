/**
 * Vendor regex output verification tests.
 *
 * Verifies that buildAstFromSelections (via useCategoryPage pipeline)
 * produces correct regex output for vendor property selections.
 *
 * Known differences from legacy buildVendorRegex:
 *
 * 1. NUMERIC REVERSED PATTERN (BUG FIX):
 *    buildAstFromSelections produces the CORRECT reversed pattern "suffix.*number"
 *    for numeric vendor properties, while buildVendorRegex produced the incorrect
 *    "number.*suffix". In PoE2, property lines like "Уровень предмета: 50" have
 *    text BEFORE the number, so the regex must use reversed pattern for forward-only .*
 *
 * 2. AND MODE SEMANTICS (BEHAVIOR CHANGE):
 *    Legacy: AND mode put all wanted non-numeric properties in a single OR group,
 *    meaning ANY selected property must match (AND + OR hybrid).
 *    New: AND mode treats each property as a separate AND condition, meaning
 *    ALL selected properties must match (true AND). This is consistent with
 *    how category pages (amulet, ring, etc.) work.
 *    OR mode is unchanged: ANY selected property matches.
 *
 * For single-property selections and OR mode, output is identical to legacy.
 */
import { describe, it, expect } from 'vitest';
import { buildVendorCategoryData } from '@data/vendor-adapter';
import { buildAstFromSelections } from '@ui/hooks/useCategoryPage';
import { compile } from '@core/compiler';
import { optimize } from '@core/optimizer';
import type { SearchLogic } from '@shared/types';

const LOCALE = 'ru' as const;
const vendorData = buildVendorCategoryData();

function compileViaAstPipeline(
  selectedIds: Set<string>,
  excludedIds: Set<string>,
  perTokenRanges: Record<string, { min?: number; max?: number; filterSlotIndex?: number }>,
  searchLogic: SearchLogic,
  round10: boolean,
): string {
  const tokens = vendorData.tokens.filter(t => selectedIds.has(t.id));
  const ast = buildAstFromSelections(tokens, excludedIds, null, null, round10, LOCALE, perTokenRanges, searchLogic);
  if (!ast) return '';
  const optimized = optimize(ast, vendorData.optimizationTable);
  return compile(optimized, { round10 });
}

describe('Vendor regex: buildAstFromSelections output verification', () => {
  describe('single non-numeric properties', () => {
    it('quality → "качеств"', () => {
      const result = compileViaAstPipeline(new Set(['atr-quality']), new Set(), {}, 'and', true);
      expect(result).toBe('"качеств"');
    });

    it('fire resistance → "огню"', () => {
      const result = compileViaAstPipeline(new Set(['res-fire']), new Set(), {}, 'and', true);
      expect(result).toBe('"огню"');
    });

    it('movement speed 30% (special .* pattern)', () => {
      const result = compileViaAstPipeline(new Set(['30ms']), new Set(), {}, 'and', true);
      expect(result).toBe('"30)%.*передвижени"');
    });
  });

  describe('AND mode: multiple non-numeric properties', () => {
    it('two properties: separate AND-joined groups (true AND)', () => {
      // New behavior: each property is a separate AND condition
      // Legacy would have been: "качеств|гнёзд" (OR group)
      // New: "качеств" "гнёзд" (AND groups)
      const result = compileViaAstPipeline(
        new Set(['atr-quality', 'atr-sockets']), new Set(), {}, 'and', true
      );
      expect(result).toBe('"качеств" "гнёзд"');
    });

    it('mixed want + exclude', () => {
      const selectedIds = new Set(['atr-quality', 'res-fire']);
      const excludedIds = new Set(['res-fire']);
      const result = compileViaAstPipeline(selectedIds, excludedIds, {}, 'and', true);
      expect(result).toContain('качеств');
      expect(result).toContain('!');
      expect(result).toContain('огню');
    });
  });

  describe('OR mode: matches ANY property', () => {
    it('two properties: single OR group', () => {
      const result = compileViaAstPipeline(
        new Set(['res-fire', 'res-cold']), new Set(), {}, 'or', true
      );
      expect(result).toBe('"огню|холоду"');
    });

    it('three properties: OR group', () => {
      const result = compileViaAstPipeline(
        new Set(['res-fire', 'res-cold', 'res-lightning']), new Set(), {}, 'or', true
      );
      expect(result).toBe('"огню|холоду|молни"');
    });

    it('quality + fire res: OR', () => {
      const result = compileViaAstPipeline(
        new Set(['atr-quality', 'res-fire']), new Set(), {}, 'or', true
      );
      expect(result).toBe('"качеств|огню"');
    });
  });

  describe('exclude patterns', () => {
    it('single excluded property', () => {
      const selectedIds = new Set(['res-fire']);
      const excludedIds = new Set(['res-fire']);
      const result = compileViaAstPipeline(selectedIds, excludedIds, {}, 'and', true);
      expect(result).toBe('"!огню"');
    });

    it('multiple excluded properties: EXCLUDE(OR)', () => {
      const selectedIds = new Set(['res-fire', 'res-cold']);
      const excludedIds = new Set(['res-fire', 'res-cold']);
      const result = compileViaAstPipeline(selectedIds, excludedIds, {}, 'and', true);
      expect(result).toBe('"!огню|холоду"');
    });
  });

  describe('numeric properties — reversed pattern (corrected vs legacy)', () => {
    it('item level ≥50 — produces reversed "suffix.*number"', () => {
      // In PoE2: "Уровень предмета: 50" → text BEFORE number
      // iter 125 FIX: (A|B|...) after .* bridge is ignored in-game.
      // Distribute via Path D: `suffix.*A|suffix.*B|...` (top-level |).
      const selectedIds = new Set(['atr-itemlevel']);
      const perTokenRanges = { 'atr-itemlevel': { min: 50, filterSlotIndex: 0 } };
      const result = compileViaAstPipeline(selectedIds, new Set(), perTokenRanges, 'and', true);

      expect(result).toContain('уровень предмета');
      // Reversed + Path D distribution: top-level | (no parens after .*)
      expect(result).toContain('уровень предмета.*[5-9][0-9]');
      expect(result).toContain('|');
      expect(result).toContain('уровень предмета.*\\d{3,}');
      expect(result).not.toMatch(/уровень предмета\.\*\(/);
    });

    it('char level ≥30 — produces reversed pattern', () => {
      // iter 125 FIX: same as item level — Path D distribution.
      const selectedIds = new Set(['atr-charlevel']);
      const perTokenRanges = { 'atr-charlevel': { min: 30, filterSlotIndex: 0 } };
      const result = compileViaAstPipeline(selectedIds, new Set(), perTokenRanges, 'and', true);

      expect(result).toContain('требуемый уровень');
      expect(result).toContain('требуемый уровень.*[3-9][0-9]');
      expect(result).toContain('|');
      expect(result).toContain('требуемый уровень.*\\d{3,}');
      expect(result).not.toMatch(/требуемый уровень\.\*\(/);
    });

    it('numeric + non-numeric combined (AND mode)', () => {
      const selectedIds = new Set(['atr-itemlevel', 'atr-quality']);
      const perTokenRanges = { 'atr-itemlevel': { min: 50, filterSlotIndex: 0 } };
      const result = compileViaAstPipeline(selectedIds, new Set(), perTokenRanges, 'and', true);

      expect(result).toContain('уровень предмета');
      expect(result).toContain('качеств');
      expect(result).toContain('" "');  // Two AND-joined groups
    });

    it('numeric excluded without value → suffix as literal', () => {
      const selectedIds = new Set(['atr-itemlevel']);
      const excludedIds = new Set(['atr-itemlevel']);
      const result = compileViaAstPipeline(selectedIds, excludedIds, {}, 'and', true);
      // When excluded without numeric value, suffix used as literal for exclusion
      expect(result).toContain('уровень предмета');
      expect(result).toContain('!');
    });

    it('OR mode: non-numeric + numeric', () => {
      const selectedIds = new Set(['res-fire', 'atr-itemlevel']);
      const perTokenRanges = { 'atr-itemlevel': { min: 50, filterSlotIndex: 0 } };
      const result = compileViaAstPipeline(selectedIds, new Set(), perTokenRanges, 'or', true);

      expect(result).toContain('огню');
      expect(result).toContain('уровень предмета');
    });
  });

  describe('edge cases', () => {
    it('empty selection → empty regex', () => {
      const result = compileViaAstPipeline(new Set(), new Set(), {}, 'and', true);
      expect(result).toBe('');
    });

    it('all 4 resistances in OR mode', () => {
      const selectedIds = new Set(['res-fire', 'res-cold', 'res-lightning', 'res-chaos']);
      const result = compileViaAstPipeline(selectedIds, new Set(), {}, 'or', true);
      // Optimizer truncates "хаосу" → "хаос" (verified safe in TRUNCATED_TAILS_SAFE)
      expect(result).toBe('"огню|холоду|молни|хаос"');
    });
  });
});
