/**
 * Integration tests for runtime classification pipeline (iter 102).
 *
 * Mirrors the PRODUCTION path that src/data/loader.ts + src/ui/components/ModList.tsx
 * execute at runtime:
 *
 *   fetch JSON → CategoryDataSchema.parse() → groupTokensByFamily() →
 *   split-by-affix → classifyGroups(_, mode) → ModSubGroup[]
 *
 * ── Why this file exists (gap closed by iter 102) ──────────────────
 * The iter 101 Critical Bug (Known Issue #4) — GameTokenSchema missing
 * `functionalCategory` → Zod stripped it → classifyFunctionalBlock() fell
 * into 'other' fallback → ALL affixes rendered as "Прочее" in production
 * between iter 90 and iter 100 — was not caught by existing tests because:
 *
 *  - tests/etl/etl-schemas.test.ts: verifies `functionalCategory` survives
 *    Zod parsing (field preservation), but does NOT exercise the runtime
 *    classifier pipeline (groupTokensByFamily → classifyGroups).
 *
 *  - tests/shared/mod-classifier.test.ts: exercises classifyGroups with
 *    synthetic makeGroup() fixtures (sets functionalCategory directly),
 *    bypassing the loader/schema path entirely.
 *
 * This file fills that gap: an end-to-end test that loads REAL production
 * JSON through the SAME path as src/data/loader.ts and verifies the runtime
 * classifier produces multiple non-`other` functional blocks for all 4
 * jewellery categories (jewel / amulet / ring / belt). If the iter 101
 * fix is ever reverted, the assertions below fail immediately.
 *
 * ── Coverage ───────────────────────────────────────────────────────
 * 4 jewellery categories × 4 invariants + 1 sensitivity test = 17 tests.
 * Waystone / tablet / relic are out of scope (they don't use
 * `functionalCategory` — their groupModes are sentiment / tablet-type /
 * relic-semantic respectively, all text-based classification).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CategoryDataSchema } from '@shared/schemas';
import { groupTokensByFamily } from '@shared/family-grouper';
import { classifyGroups, type ModGroupMode, type ModSubGroup } from '@shared/mod-classifier';
import type { GameToken } from '@shared/types';

const projectRoot = join(__dirname, '..', '..');
const generatedDir = join(projectRoot, 'public', 'generated');

interface CategorySpec {
  category: string;
  mode: ModGroupMode;
  /** Files to load + merge (jewel page loads 3 origins merged in production). */
  files: string[];
}

const JEWELLERY_SPECS: CategorySpec[] = [
  { category: 'amulet', mode: 'affix-functional', files: ['amulet.json'] },
  { category: 'ring',   mode: 'affix-functional', files: ['ring.json'] },
  { category: 'belt',   mode: 'affix-functional', files: ['belt.json'] },
  // jewel page loads 3 origins (normal/desecrated/corrupted) merged — see
  // src/data/loader.ts loadMergedCategoryData() + src/ui/pages/jewel/JewelPage.tsx.
  { category: 'jewel',  mode: 'jewel-functional',  files: ['jewel.json', 'jewel-desecrated.json', 'jewel-corrupted.json'] },
];

/** Load + merge one or more category JSON files through CategoryDataSchema.
 *  Mirrors src/data/loader.ts: loadCategoryData() + loadMergedCategoryData(). */
function loadMergedTokens(spec: CategorySpec): GameToken[] {
  const allTokens: GameToken[] = [];
  for (const file of spec.files) {
    const raw = JSON.parse(readFileSync(join(generatedDir, file), 'utf-8'));
    // Production path: Zod-validated at the ETL→runtime boundary.
    const parsed = CategoryDataSchema.parse(raw);
    allTokens.push(...parsed.tokens);
  }
  return allTokens;
}

/** Sum the family-groups across all ModSubGroup entries whose key matches `predicate`. */
function countGroups(subGroups: ModSubGroup[], predicate: (key: string) => boolean): number {
  let total = 0;
  for (const sg of subGroups) {
    if (predicate(sg.key)) {
      total += sg.groups.length;
    }
  }
  return total;
}

describe('runtime classification pipeline (iter 102 — regression guard for iter 101)', () => {
  for (const spec of JEWELLERY_SPECS) {
    describe(`${spec.category} (${spec.mode}, ${spec.files.length} file(s))`, () => {
      // ── Production path: load → group → split-by-affix → classify ──
      const tokens = loadMergedTokens(spec);
      const familyGroups = groupTokensByFamily(tokens, spec.category);
      const totalFamilyGroups = familyGroups.length;

      // ModList.tsx:340-345 splits familyGroups by affix before calling classifyGroups.
      const prefixGroups = familyGroups.filter(g => g.affix === 'prefix');
      const suffixGroups = familyGroups.filter(g => g.affix === 'suffix');
      const implicitGroups = familyGroups.filter(g => g.affix === 'implicit');

      const prefixSubGroups = classifyGroups(prefixGroups, spec.mode);
      const suffixSubGroups = classifyGroups(suffixGroups, spec.mode);
      const implicitSubGroups = classifyGroups(implicitGroups, spec.mode);

      const allSubGroups = [...prefixSubGroups, ...suffixSubGroups, ...implicitSubGroups];
      const nonOtherGroupsCount = countGroups(allSubGroups, k => k !== 'other');
      const otherGroupsCount = countGroups(allSubGroups, k => k === 'other');

      it(`produces multiple functional sub-groups (regression guard vs iter 90-100)`, () => {
        // If iter 101 fix is reverted: each affix column produces ONE sub-group
        // with key='other' → total sub-groups === 2 (prefix 'other' + suffix 'other').
        // After fix: each affix column produces 13-20 sub-groups → total 26-40.
        // The threshold >2 catches the regression while leaving room for ETL evolution.
        const totalSubGroups = allSubGroups.length;
        expect(totalSubGroups, `${spec.category}: expected multiple sub-groups, got ${totalSubGroups}`).toBeGreaterThan(2);
      });

      it(`classifies family-groups into non-'other' functional blocks`, () => {
        // PRIMARY regression guard: if functionalCategory was stripped by Zod,
        // classifyFunctionalBlock() returns 'other' for EVERY group →
        // nonOtherGroupsCount === 0 → this assertion fails.
        expect(nonOtherGroupsCount, `${spec.category}: expected non-zero groups in non-'other' blocks`).toBeGreaterThan(0);

        // Stronger guard: at least half of all family-groups should land in
        // non-'other' blocks. ETL metrics (iter 101 STATUS.md) show 91-97%
        // coverage; we assert >= 50% to leave room for ETL evolution while
        // still catching the iter 90-100 regression (which would yield 0%).
        const threshold = Math.floor(totalFamilyGroups / 2);
        expect(nonOtherGroupsCount, `${spec.category}: expected ≥${threshold} of ${totalFamilyGroups} family-groups in non-'other' blocks, got ${nonOtherGroupsCount}`).toBeGreaterThanOrEqual(threshold);
      });

      it(`'other' block does NOT collapse to 100% of family-groups`, () => {
        // Direct regression guard: if iter 101 fix is reverted,
        // otherGroupsCount === totalFamilyGroups (ALL groups in 'other').
        // After fix: otherGroupsCount < totalFamilyGroups.
        expect(otherGroupsCount, `${spec.category}: 'other' must not contain all ${totalFamilyGroups} family-groups`).toBeLessThan(totalFamilyGroups);
      });

      it(`every sub-group has at least one family-group (no empty ModSubGroup entries)`, () => {
        // Defensive: classifyGroups filters out empty sub-groups already.
        // If this ever fails, classifyGroups has a logic bug that creates
        // empty ModSubGroup entries (silent UI noise / wasted renders).
        for (const sg of allSubGroups) {
          expect(sg.groups.length, `${spec.category}: sub-group '${sg.key}' must have ≥1 family-group`).toBeGreaterThan(0);
        }
      });
    });
  }

  // ── Sensitivity test: proves the guards above WOULD have caught the bug ──
  describe('regression-guard sensitivity (stripped functionalCategory simulates iter 90-100 bug)', () => {
    it('when functionalCategory is stripped from raw JSON, all groups collapse into "other"', () => {
      // Simulate the pre-iter-101 Zod-schema behavior: strip functionalCategory
      // from every token in the raw JSON. The current schema accepts the input
      // (functionalCategory is .optional()), but classifyFunctionalBlock() now
      // falls back to 'other' for every group — which is the EXACT behavior
      // that was broken in production between iter 90 and iter 100.
      const raw = JSON.parse(readFileSync(join(generatedDir, 'belt.json'), 'utf-8'));
      for (const t of raw.tokens) {
        delete t.functionalCategory;
      }
      const parsed = CategoryDataSchema.parse(raw);
      const familyGroups = groupTokensByFamily(parsed.tokens, 'belt');
      const prefixSubGroups = classifyGroups(familyGroups.filter(g => g.affix === 'prefix'), 'affix-functional');
      const suffixSubGroups = classifyGroups(familyGroups.filter(g => g.affix === 'suffix'), 'affix-functional');

      const allSubGroups = [...prefixSubGroups, ...suffixSubGroups];
      const nonOtherCount = countGroups(allSubGroups, k => k !== 'other');

      // When functionalCategory is missing, EVERY group lands in 'other' →
      // the regression guard "nonOtherGroupsCount > 0" WOULD fail. This proves
      // the assertions above are sensitive to the bug and would have caught it.
      expect(nonOtherCount, 'stripped functionalCategory should yield zero non-other groups').toBe(0);
      // Each affix column collapses into a single 'other' sub-group.
      for (const sg of allSubGroups) {
        expect(sg.key).toBe('other');
      }
    });
  });
});
