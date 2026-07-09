/**
 * Reproduce user's MIXED-mode scenario:
 *   2 MUST (different families) + 1 OPT (different family)
 * Expected: `"MUST1" "MUST2" "OPT1"` (single OPT degrades to AND per T1 docs)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildMixedAstFromSelections,
} from '@ui/hooks/useCategoryPage';
import { compile } from '@core/compiler';
import { optimize } from '@core/optimizer';
import type { GameToken, Locale } from '@shared/types';

const LOCALE: Locale = 'ru';

const ringData = JSON.parse(readFileSync('public/generated/ring.json', 'utf8')) as {
  tokens: GameToken[];
  optimizationTable?: Record<string, unknown>;
};

const tokens = ringData.tokens;

describe('User-reported MIXED-mode scenario (Ring page)', () => {
  it('2 MUST + 1 OPT → expected regex', () => {
    const healthTokens = tokens.filter(t => t.regex.ru === 'максимуму здоровья');
    const manaTokens = tokens.filter(t => t.regex.ru === 'максимуму маны');
    const charTokens = tokens.filter(t => t.regex.ru === 'характеристикам');

    console.log(`Health: ${healthTokens.length}, Mana: ${manaTokens.length}, Char: ${charTokens.length}`);

    const mustTokens = [...healthTokens, ...manaTokens];
    const optTokens = [...charTokens];

    const ast = buildMixedAstFromSelections(
      mustTokens,
      optTokens,
      new Set<string>(),
      null, null, false, LOCALE, {}
    );
    expect(ast).not.toBeNull();

    const optTable = ringData.optimizationTable ?? {};
    const optimized = optimize(ast!, optTable, LOCALE);
    const regex = compile(optimized, { locale: LOCALE });

    console.log(`\n=== 2 MUST + 1 OPT ===`);
    console.log(`Regex: ${regex}`);
    console.log(`Length: ${regex.length}`);

    // Per T1 docs: single OPT degrades to AND. So regex should be:
    //   "максимуму здоровья" "максимуму маны" "характеристикам"
    expect(regex).toBe('"максимуму здоровья" "максимуму маны" "характеристикам"');
  });

  it('2 MUST + 2 OPT → expected regex (OPT1|OPT2)', () => {
    const healthTokens = tokens.filter(t => t.regex.ru === 'максимуму здоровья');
    const manaTokens = tokens.filter(t => t.regex.ru === 'максимуму маны');
    const charTokens = tokens.filter(t => t.regex.ru === 'характеристикам');
    const strengthTokens = tokens.filter(t => t.regex.ru === 'к силе').slice(0, 1);

    const mustTokens = [...healthTokens, ...manaTokens];
    const optTokens = [...charTokens, ...strengthTokens];

    const ast = buildMixedAstFromSelections(
      mustTokens,
      optTokens,
      new Set<string>(),
      null, null, false, LOCALE, {}
    );
    expect(ast).not.toBeNull();

    const optTable = ringData.optimizationTable ?? {};
    const optimized = optimize(ast!, optTable, LOCALE);
    const regex = compile(optimized, { locale: LOCALE });

    console.log(`\n=== 2 MUST + 2 OPT ===`);
    console.log(`Regex: ${regex}`);
    console.log(`Length: ${regex.length}`);

    // 2 OPTs should be in MIXED_OR → "OPT1|OPT2"
    expect(regex).toContain('|');
    expect(regex).toContain('"характеристикам|');
  });
});
