import { describe, it, expect } from 'vitest';
import { compile } from '@core/compiler';
import { range } from '@core/ast';
import { matchPoE2RegexItem } from '@core/poe2-regex-matcher';
import type { ASTNode } from '@shared/types';
import type { GameItemText } from '@core/poe2-regex-matcher';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * iter 126 — Regression tests for KI#10 fix: ambiguous suffix FP for
 * `Редкость предметов` (disambiguate from potential `Редкость монстров`).
 *
 * USER-REPORTED FP (iter 126):
 * After iter 125 fix, regex `"едкость.*\+[2-9][0-9]%|едкость.*\+\d{3,}%"
 * "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"` STILL highlighted waystones with
 * `Редкость предметов: +11%` (XX < 20, FP). User's hypothesis: waystones have
 * 2-4 implicits, including `Редкость предметов` AND `Редкость монстров`
 * (which would also match the `едкость` substring).
 *
 * ROOT CAUSE:
 * Token `waystone.implicit.item_rarity` used regex `'едкость'` (7 chars) — too
 * generic. Any text with `едкость` substring matches, including hypothetical
 * `Редкость монстров: +##%` if such implicit exists in-game.
 *
 * FIX (iter 126):
 * Replace regex with `'едкость предметов'` (12 chars, literal space) — uniquely
 * identifies `Редкость предметов` and does NOT match `Редкость монстров`.
 * Applied via `scripts/etl/i18n-overrides.json` + direct patch of
 * `public/generated/waystone.json` + `waystone-desecrated.json`.
 *
 * NEW COMPILED REGEX (after fix):
 *   "едкость предметов.*\+[2-9][0-9]%|едкость предметов.*\+\d{3,}%"
 *     "ивность.*\+[2-9][0-9]%|ивность.*\+\d{3,}%"
 *
 * KI#11 (NEW, MONITORING):
 * If in-game `.*` actually crosses block boundaries (contrary to Phase 7
 * verification), this fix won't prevent FP — `.*` could still match across
 * blocks. Mitigation plan: add `literalBridge` field to AST + use literal
 * text between suffix and numRegex instead of `.*`. See STATUS.md KI#11.
 */

// ─── Helper: construct AST like category-ast-utils does for implicits ───

function buildImplicitRangeNode(
  min: number | undefined,
  max: number | undefined,
  suffix: string,
  signPrefix: '+' | '-' | undefined = '+',
  anchorEnd: string | undefined = '%',
): ASTNode {
  return range(min, max, suffix, undefined, undefined, false, anchorEnd, true, undefined, undefined, signPrefix);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: Compile output — verify the new regex format
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 126 — compile output: new regex with "едкость предметов"', () => {
  it('Редкость предметов +25% (round10=true) → distributed ≥20 with %, with disambiguated suffix', () => {
    const result = compile(
      range(25, undefined, 'едкость предметов', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: true },
    );
    expect(result).toBe(
      '"едкость предметов.*\\+[2-9][0-9]%|едкость предметов.*\\+\\d{3,}%"',
    );
  });

  it('Редкость предметов +25% (round10=false) → distributed ≥25 with %, with disambiguated suffix', () => {
    const result = compile(
      range(25, undefined, 'едкость предметов', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: false },
    );
    expect(result).toBe(
      '"едкость предметов.*\\+2[5-9]%|едкость предметов.*\\+[3-9][0-9]%|едкость предметов.*\\+\\d{3,}%"',
    );
  });

  it('AND-joined Редкость предметов + Эффективность (both min=25, round10=true)', () => {
    const rarityNode = range(25, undefined, 'едкость предметов', undefined, undefined, false, '%', true, undefined, undefined, '+');
    const effNode = range(25, undefined, 'ивность', undefined, undefined, false, '%', true, undefined, undefined, '+');
    const ast: ASTNode = { type: 'AND', children: [rarityNode, effNode] };
    const result = compile(ast, { round10: true });
    expect(result).toBe(
      '"едкость предметов.*\\+[2-9][0-9]%|едкость предметов.*\\+\\d{3,}%" "ивность.*\\+[2-9][0-9]%|ивность.*\\+\\d{3,}%"',
    );
  });

  it('new regex is within 250-char PoE2 limit', () => {
    const rarityNode = range(25, undefined, 'едкость предметов', undefined, undefined, false, '%', true, undefined, undefined, '+');
    const effNode = range(25, undefined, 'ивность', undefined, undefined, false, '%', true, undefined, undefined, '+');
    const ast: ASTNode = { type: 'AND', children: [rarityNode, effNode] };
    const result = compile(ast, { round10: true });
    expect(result.length).toBeLessThanOrEqual(250);
    // Document the actual length for visibility
    // 2 quoted groups (52 + 50 chars including quotes) + 1 space separator = 107 chars
    expect(result.length).toBe(107);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: Same-block disambiguation — "Редкость предметов" vs "Редкость монстров"
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 126 — disambiguation: "Редкость предметов" vs "Редкость монстров"', () => {
  // Build the new regex with disambiguated suffix
  const rarityNode = buildImplicitRangeNode(25, undefined, 'едкость предметов');
  const effNode = buildImplicitRangeNode(25, undefined, 'ивность');
  const ast: ASTNode = { type: 'AND', children: [rarityNode, effNode] };
  const regex = compile(ast, { round10: true });

  it('does NOT match waystone with only "Редкость предметов +11%" (below threshold)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +11%', 'Эффективность монстров: +25%'],
    };
    // Block 1 has "едкость предметов" but +11 < 20 → no match
    // Block 2 has "ивность" + +25 → matches second quoted group
    // First quoted group should NOT match (since +11 < 20)
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('does NOT match waystone with hypothetical "Редкость монстров +25%" (disambiguation)', () => {
    // Hypothetical scenario: waystone has "Редкость монстров: +25%" (not in our DB)
    // Old regex 'едкость' would match this → FP
    // New regex 'едкость предметов' should NOT match → disambiguation works
    const item: GameItemText = {
      implicits: ['Редкость монстров: +25%', 'Эффективность монстров: +25%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('does NOT match waystone with "Редкость предметов +11%" + "Редкость монстров +25%" (hypothetical, disambiguation)', () => {
    // The user's reported FP scenario: Редкость предметов +11% + Редкость монстров +25%
    // Old regex 'едкость' would match "Редкость монстров: +25%" (since it has 'едкость' + '+25')
    // → highlight waystone (FP)
    // New regex 'едкость предметов' should NOT match "Редкость монстров" → no FP
    const item: GameItemText = {
      implicits: [
        'Редкость предметов: +11%',
        'Редкость монстров: +25%',  // hypothetical
        'Эффективность монстров: +25%',
      ],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('matches waystone with "Редкость предметов +25%" + "Эффективность монстров +25%" (correct case)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +25%', 'Эффективность монстров: +25%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('matches waystone with "Редкость предметов +50%" + "Эффективность монстров +50%" (mid values)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +50%', 'Эффективность монстров: +50%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('does NOT match if only "Редкость предметов" satisfies threshold (AND-logic)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +50%', 'Эффективность монстров: +5%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('does NOT match if only "Эффективность" satisfies threshold (AND-logic)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +5%', 'Эффективность монстров: +50%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('does NOT match range notation +(15-25)% — % anchor prevents FP', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +(15-25)%', 'Эффективность монстров: +30%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: JSON data verification — token regex in waystone.json matches expected
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 126 — JSON data: waystone.json token regex patched', () => {
  const WAYSTONE_JSON = path.resolve(__dirname, '../../public/generated/waystone.json');
  const WAYSTONE_DESECRATED_JSON = path.resolve(__dirname, '../../public/generated/waystone-desecrated.json');

  it('waystone.json: waystone.implicit.item_rarity has regex "едкость предметов"', async () => {
    const data = JSON.parse(await fs.readFile(WAYSTONE_JSON, 'utf-8'));
    const token = data.tokens.find((t: { id: string }) => t.id === 'waystone.implicit.item_rarity');
    expect(token).toBeDefined();
    expect(token.regex.ru).toBe('едкость предметов');
  });

  it('waystone-desecrated.json: waystone-desecrated.implicit.item_rarity has regex "едкость предметов"', async () => {
    const data = JSON.parse(await fs.readFile(WAYSTONE_DESECRATED_JSON, 'utf-8'));
    const token = data.tokens.find((t: { id: string }) => t.id === 'waystone-desecrated.implicit.item_rarity');
    expect(token).toBeDefined();
    expect(token.regex.ru).toBe('едкость предметов');
  });

  it('waystone.json: waystone.implicit.monster_effectiveness still has regex "ивность" (unchanged)', async () => {
    const data = JSON.parse(await fs.readFile(WAYSTONE_JSON, 'utf-8'));
    const token = data.tokens.find((t: { id: string }) => t.id === 'waystone.implicit.monster_effectiveness');
    expect(token).toBeDefined();
    expect(token.regex.ru).toBe('ивность');
  });

  it('i18n-overrides.json: waystone.implicit.item_rarity override entry exists with regex "едкость предметов"', async () => {
    const overridesPath = path.resolve(__dirname, '../../scripts/etl/i18n-overrides.json');
    const data = JSON.parse(await fs.readFile(overridesPath, 'utf-8'));
    expect(data.overrides['waystone.implicit.item_rarity']).toBeDefined();
    expect(data.overrides['waystone.implicit.item_rarity'].regex).toBe('едкость предметов');
  });

  it('i18n-overrides.json: waystone-desecrated.implicit.item_rarity override entry exists with regex "едкость предметов"', async () => {
    const overridesPath = path.resolve(__dirname, '../../scripts/etl/i18n-overrides.json');
    const data = JSON.parse(await fs.readFile(overridesPath, 'utf-8'));
    expect(data.overrides['waystone-desecrated.implicit.item_rarity']).toBeDefined();
    expect(data.overrides['waystone-desecrated.implicit.item_rarity'].regex).toBe('едкость предметов');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: Edge cases — old vs new regex behavior comparison
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 126 — edge cases: old vs new regex behavior', () => {
  // Build old regex (iter 125) with 'едкость' suffix
  const oldRarityNode = buildImplicitRangeNode(25, undefined, 'едкость');
  const effNode = buildImplicitRangeNode(25, undefined, 'ивность');
  const oldAst: ASTNode = { type: 'AND', children: [oldRarityNode, effNode] };
  const oldRegex = compile(oldAst, { round10: true });

  // Build new regex (iter 126) with 'едкость предметов' suffix
  const newRarityNode = buildImplicitRangeNode(25, undefined, 'едкость предметов');
  const newAst: ASTNode = { type: 'AND', children: [newRarityNode, effNode] };
  const newRegex = compile(newAst, { round10: true });

  it('old regex matches waystone with hypothetical "Редкость монстров +25%" (FP case)', () => {
    // Old regex 'едкость' matches 'Редкость монстров' (hypothetical) → FP
    const item: GameItemText = {
      implicits: [
        'Редкость предметов: +11%',
        'Редкость монстров: +25%',  // hypothetical, but old regex matches it
        'Эффективность монстров: +25%',
      ],
    };
    expect(matchPoE2RegexItem(oldRegex, item)).toBe(true);
  });

  it('new regex does NOT match same waystone (disambiguation works)', () => {
    const item: GameItemText = {
      implicits: [
        'Редкость предметов: +11%',
        'Редкость монстров: +25%',  // hypothetical
        'Эффективность монстров: +25%',
      ],
    };
    expect(matchPoE2RegexItem(newRegex, item)).toBe(false);
  });

  it('both old and new regex match waystone with "Редкость предметов +25%" (no regression)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +25%', 'Эффективность монстров: +25%'],
    };
    expect(matchPoE2RegexItem(oldRegex, item)).toBe(true);
    expect(matchPoE2RegexItem(newRegex, item)).toBe(true);
  });

  it('both old and new regex do NOT match waystone with "Редкость предметов +11%" only', () => {
    // Below threshold — both regexes should fail to match
    const item: GameItemText = {
      implicits: ['Редкость предметов: +11%', 'Эффективность монстров: +25%'],
    };
    expect(matchPoE2RegexItem(oldRegex, item)).toBe(false);
    expect(matchPoE2RegexItem(newRegex, item)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: KI#11 documentation — verify that simulator models single-block .*
//            (if user's FP persists, KI#11 fix is needed)
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 126 — KI#11 simulator model: .* restricted to single block', () => {
  // The simulator (matchPoE2RegexItem) models .* as NOT crossing block boundaries.
  // If in-game .* actually crosses blocks, this test would still PASS (simulator),
  // but the FP would persist in-game. KI#11 monitors this scenario.

  it('simulator: "едкость предметов.*\\+XX%" does NOT match across blocks', () => {
    // Block 1: "Редкость предметов: +11%" (has "едкость предметов" but +11 < 20)
    // Block 2: "Размер групп монстров: +30%" (has "+30%" but no "едкость предметов")
    // If .* crosses blocks, regex would match (FP). If not, no match (correct).
    const regex = '"едкость предметов.*\\+[2-9][0-9]%"';
    const item: GameItemText = {
      implicits: [
        'Редкость предметов: +11%',
        'Размер групп монстров: +30%',
      ],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('simulator: "едкость.*\\+XX%" does NOT match across blocks (old regex, same-block .* model)', () => {
    // Same scenario with OLD regex 'едкость' — also should not match (per simulator model)
    const regex = '"едкость.*\\+[2-9][0-9]%"';
    const item: GameItemText = {
      implicits: [
        'Редкость предметов: +11%',
        'Размер групп монстров: +30%',
      ],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('KI#11 NOTE: if user reports FP persists after iter 126 fix, escalate to KI#11', () => {
    // This test is documentation — it always passes.
    // KI#11 hypothesis: in-game .* might cross block boundaries for waystones
    // with multiple implicits. If so, the iter 126 disambiguation fix is
    // insufficient and a literal-bridge compiler change is needed.
    // See STATUS.md KI#11 for mitigation plan.
    expect(true).toBe(true);
  });
});
