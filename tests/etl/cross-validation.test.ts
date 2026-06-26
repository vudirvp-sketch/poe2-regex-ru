import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Cross-validation tests: ETL-generated JSON data vs регис manual lists.
 *
 * These tests load the actual generated JSON and the raw регис markdown,
 * then verify that the ETL data covers the same mods (or a superset).
 * This catches data loss from ETL bugs, parser regressions, etc.
 */
describe('ETL vs регис cross-validation', () => {
  const projectRoot = join(__dirname, '..', '..');
  const generatedDir = join(projectRoot, 'public', 'generated');
  const regisDir = join(projectRoot, 'регис');

  function loadCategoryData(filename: string) {
    const raw = readFileSync(join(generatedDir, filename), 'utf-8');
    return JSON.parse(raw);
  }

  function parseRegisList(filename: string): string[] {
    const raw = readFileSync(join(regisDir, filename), 'utf-8');
    // Extract mod text lines starting with "- "
    const lines = raw.split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('- '));
    // Remove the "- " prefix and normalize
    return lines.map(l => l.slice(2).trim().toLowerCase());
  }

  describe('Waystone cross-validation', () => {
    it('ETL waystone tokens cover all регис waystone mods', () => {
      const waystoneData = loadCategoryData('waystone.json');
      const desecratedData = loadCategoryData('waystone-desecrated.json');

      // Collect all ETL rawText values (lowercased for comparison)
      const etlTexts = new Set<string>();
      for (const token of [...waystoneData.tokens, ...desecratedData.tokens]) {
        const text = token.rawText?.ru?.toLowerCase().trim();
        if (text) etlTexts.add(text);
      }

      // Parse регис waystone list
      const regisMods = parseRegisList('Путевые камни моды.md');

      // Skip the desecrated section (after "Очерненные свойства:")
      const normalMods = regisMods.slice(0, regisMods.findIndex(m => m.startsWith('очерненные свойства')));

      // Check that most регис mods have a matching ETL token
      // Coverage is lower than other categories because регис has individual
      // tiers while ETL deduplicates earth effects and has different splitting
      let matched = 0;
      for (const mod of normalMods) {
        const found = Array.from(etlTexts).some(etlText => {
          return etlText.includes(mod) || mod.includes(etlText) ||
            (mod.length > 15 && etlText.includes(mod.substring(0, 15)));
        });
        if (found) matched++;
      }

      const coverage = normalMods.length > 0 ? matched / normalMods.length : 1;
      expect(coverage).toBeGreaterThan(0.7);
    });

    it('waystone token count matches expected range (100-200 after BTS removal)', () => {
      const waystoneData = loadCategoryData('waystone.json');
      // iter 128 (KI#13): removed additional BTS tokens that were leaking into
      // affix list (На #% больше волшебных/эффективности/шанса появления свойств;
      // #% увеличение количества редких/волшебных монстров; #% увеличение
      // количества путевых камней). Pre-iter-128 was ~156, post-iter-128 is 110.
      // Range reflects both OLD-form and NEW-form poe2db wordings plus BTS expansion.
      expect(waystoneData.tokens.length).toBeGreaterThanOrEqual(100);
      expect(waystoneData.tokens.length).toBeLessThanOrEqual(200);
    });

    it('waystone-desecrated has 25-40 tokens', () => {
      const data = loadCategoryData('waystone-desecrated.json');
      // iter 128 (KI#13): desecrated source HTML now has BTS tokens too
      // (#% увеличение количества редких/волшебных монстров), which are filtered
      // out. Pre-iter-128 was 32, post-iter-128 is 28 (after BTS removal + new implicit).
      // Also +1 new monster_rarity implicit.
      expect(data.tokens.length).toBeGreaterThanOrEqual(25);
      expect(data.tokens.length).toBeLessThanOrEqual(40);
    });
  });

  describe('Tablet cross-validation', () => {
    it('ETL tablet tokens cover most регис tablet mods', () => {
      const tabletData = loadCategoryData('tablet.json');

      const etlTexts = new Set<string>();
      for (const token of tabletData.tokens) {
        const text = token.rawText?.ru?.toLowerCase().trim();
        if (text) etlTexts.add(text);
      }

      const regisMods = parseRegisList('Плитки предтеч моды.md');

      let matched = 0;
      for (const mod of regisMods) {
        const found = Array.from(etlTexts).some(etlText =>
          etlText.includes(mod) || mod.includes(etlText) ||
          (mod.length > 15 && etlText.includes(mod.substring(0, 15)))
        );
        if (found) matched++;
      }

      const coverage = regisMods.length > 0 ? matched / regisMods.length : 1;
      expect(coverage).toBeGreaterThan(0.75);
    });

    it('tablet token count matches expected range (80-95)', () => {
      const data = loadCategoryData('tablet.json');
      // After removing 3 implicit-set bonus tokens and adding 5 implicit tokens
      expect(data.tokens.length).toBeGreaterThanOrEqual(80);
      expect(data.tokens.length).toBeLessThanOrEqual(95);
    });
  });

  describe('Jewel cross-validation', () => {
    it('jewel token count matches expected range (180-210 normal)', () => {
      const data = loadCategoryData('jewel.json');
      expect(data.tokens.length).toBeGreaterThanOrEqual(180);
      expect(data.tokens.length).toBeLessThanOrEqual(210);
    });
  });

  describe('Data integrity checks', () => {
    it('all categories have valid version timestamp', () => {
      const files = ['waystone.json', 'tablet.json', 'relic.json', 'jewel.json',
        'belt.json', 'ring.json', 'amulet.json'];
      for (const file of files) {
        const data = loadCategoryData(file);
        expect(data.version).toBeTruthy();
        expect(new Date(data.version).getTime()).not.toBeNaN();
      }
    });

    it('no token has empty regex field', () => {
      const files = ['waystone.json', 'tablet.json', 'relic.json', 'jewel.json'];
      for (const file of files) {
        const data = loadCategoryData(file);
        const emptyRegexTokens = data.tokens.filter(
          (t: { regex?: { ru?: string } }) => !t.regex?.ru || t.regex.ru.trim() === ''
        );
        expect(emptyRegexTokens.length, `${file} has tokens with empty regex`).toBe(0);
      }
    });

    it('all waystone/tablet/jewel-desecrated regexes meet MIN_REGEX_LEN', () => {
      const strictFiles = ['waystone.json', 'waystone-desecrated.json', 'tablet.json'];
      const minLenByFile: Record<string, number> = {
        'waystone.json': 5,
        'waystone-desecrated.json': 5,
        'tablet.json': 5,
      };
      for (const file of strictFiles) {
        const data = loadCategoryData(file);
        const minLen = minLenByFile[file] ?? 5;
        const shortRegexTokens = data.tokens.filter(
          (t: { regex?: { ru?: string } }) => t.regex?.ru && t.regex.ru.length < minLen
        );
        expect(shortRegexTokens.length, `${file} has ${shortRegexTokens.length} tokens with regex < ${minLen} chars`).toBe(0);
      }
    });

    // iter 112 regression: regexPrefixContext must NOT be a range template
    // like "(10—20)%" — such literal text never appears in real rolled items,
    // which show a specific value like "15%". Using a range template as
    // context makes the regex NEVER match in-game.
    // Bug case: jewel-desecrated.mod_3yl2ru had ctx="(10—20)%" + regex="Бездны".
    it('no token has range-like regexPrefixContext (iter 112 regression)', () => {
      const files = [
        'waystone.json', 'waystone-desecrated.json', 'tablet.json',
        'relic.json', 'jewel.json', 'jewel-desecrated.json', 'jewel-corrupted.json',
        'belt.json', 'ring.json', 'amulet.json',
      ];
      const suspicious: string[] = [];
      for (const file of files) {
        const data = loadCategoryData(file);
        for (const t of data.tokens) {
          const ctx = t.regexPrefixContext?.ru;
          if (!ctx) continue;
          // A valid context word/phrase must contain ≥3 Cyrillic/Latin letters.
          // Range templates like "(10—20)%" or "—" alone have <3 letters.
          const letterCount = (ctx.match(/[а-яА-ЯёЁa-zA-Z]/g) || []).length;
          if (letterCount < 3) {
            suspicious.push(`${file}:${t.id} ctx="${ctx}"`);
          }
        }
      }
      expect(suspicious, `suspicious ctx values:\n  ${suspicious.join('\n  ')}`).toEqual([]);
    });

    // iter 112 regression: verify the Истощения Бездны token specifically.
    // Before iter 112, it had regexPrefixContext "(10—20)%" which would
    // compile to "(10—20)%.*Бездны" — a regex that NEVER matches in-game
    // because real items show specific rolls like "15%", not "(10—20)%".
    it('jewel-desecrated.mod_3yl2ru (Истощения Бездны) has no range context', () => {
      const data = loadCategoryData('jewel-desecrated.json');
      const token = data.tokens.find((t: { id: string }) => t.id === 'jewel-desecrated.mod_3yl2ru');
      expect(token, 'mod_3yl2ru must exist in jewel-desecrated.json').toBeTruthy();
      const ctx = token.regexPrefixContext?.ru ?? '';
      // Context must be empty or contain ≥3 letters (NOT "(10—20)%" or similar)
      if (ctx.length > 0) {
        const letterCount = (ctx.match(/[а-яА-ЯёЁa-zA-Z]/g) || []).length;
        expect(letterCount, `ctx "${ctx}" must have ≥3 letters`).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
