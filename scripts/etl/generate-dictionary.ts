/**
 * Generate the final JSON files for public/generated/.
 * Assembles CategoryData objects from normalized mods + regex results + optimizations.
 */
import type { Locale, GameToken, CategoryData, OptimizationEntry, JewelType } from '../../src/shared/types.js';
import type { NormalizedMod } from './normalize.js';
import type { RegexResult } from './compute-regex.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Assemble a GameToken from a NormalizedMod and its computed regex result.
 */
export function assembleGameToken(
  mod: NormalizedMod,
  regexResult: RegexResult,
  locale: Locale = 'ru',
  jewelType?: JewelType,
  functionalCategory?: string
): GameToken {
  const token: GameToken = {
    id: mod.id,
    category: mod.category,
    origin: mod.origin,
    rawText: mod.rawText,
    rawTextTemplate: mod.rawTextTemplate,
    regex: { [locale]: regexResult.regex },
    familyKey: { [locale]: regexResult.familyKey },
    regexPrefix: { [locale]: regexResult.regexPrefix },
    hasMultiPlaceholder: regexResult.hasMultiPlaceholder,
    jewelType,
    functionalCategory,
    genderForms: mod.genderForms,
    affix: mod.affix,
    tags: mod.tags,
    ranges: mod.ranges,
    values: mod.values,
    hasYofication: mod.hasYofication,
    yoficationPositions: mod.yoficationPositions,
    level: mod.level,
  };
  // Only include regexExclude if there are actual patterns (save space in JSON)
  if (regexResult.regexExclude && regexResult.regexExclude.length > 0) {
    token.regexExclude = { [locale]: regexResult.regexExclude };
  }
  // Only include regexPrefixContext if non-empty (save space in JSON)
  if (regexResult.regexPrefixContext && regexResult.regexPrefixContext.length > 0) {
    token.regexPrefixContext = { [locale]: regexResult.regexPrefixContext };
  }
  return token;
}

/**
 * Assemble a complete CategoryData object.
 */
export function assembleCategoryData(
  category: string,
  mods: NormalizedMod[],
  regexResults: Map<string, RegexResult>,
  optimizations: Record<string, OptimizationEntry>,
  locale: Locale = 'ru',
  jewelTypeMap?: Record<string, JewelType>,
  functionalCategoryMap?: Record<string, string>,
  sourceHash?: string
): CategoryData {
  const tokens: GameToken[] = mods.map(mod => {
    const regexResult = regexResults.get(mod.id);
    // Fallback: if no regex result, create a default one
    const result: RegexResult = regexResult ?? {
      regex: mod.rawText[locale],
      hasYofication: false,
      yoficationPositions: [],
      familyKey: mod.rawTextTemplate[locale].replace(/##/g, '#'),
      regexPrefix: '',
      hasMultiPlaceholder: false,
      regexExclude: [],
      regexPrefixContext: '',
    };
    const jType = jewelTypeMap?.[mod.id];
    const fCat = functionalCategoryMap?.[mod.id];
    return assembleGameToken(mod, result, locale, jType, fCat);
  });

  return {
    version: new Date().toISOString(),
    category,
    source: 'poe2db.tw',
    sourceHash,
    tokens,
    optimizationTable: optimizations,
  };
}

/**
 * Write a CategoryData object to a JSON file in public/generated/.
 */
export function writeCategoryJson(data: CategoryData, outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${data.category}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  Generated ${outputPath} with ${data.tokens.length} tokens`);
}
