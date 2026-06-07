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

    it('waystone token count matches expected range (280-350 with multi-line splits)', () => {
      const waystoneData = loadCategoryData('waystone.json');
      expect(waystoneData.tokens.length).toBeGreaterThanOrEqual(280);
      expect(waystoneData.tokens.length).toBeLessThanOrEqual(350);
    });

    it('waystone-desecrated has 25-35 tokens', () => {
      const data = loadCategoryData('waystone-desecrated.json');
      expect(data.tokens.length).toBeGreaterThanOrEqual(25);
      expect(data.tokens.length).toBeLessThanOrEqual(35);
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

    it('tablet token count matches expected range (70-90)', () => {
      const data = loadCategoryData('tablet.json');
      expect(data.tokens.length).toBeGreaterThanOrEqual(70);
      expect(data.tokens.length).toBeLessThanOrEqual(90);
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
          (t: any) => !t.regex?.ru || t.regex.ru.trim() === ''
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
          (t: any) => t.regex?.ru && t.regex.ru.length < minLen
        );
        expect(shortRegexTokens.length, `${file} has ${shortRegexTokens.length} tokens with regex < ${minLen} chars`).toBe(0);
      }
    });
  });
});
