/**
 * iter 153 — One-shot patch script: restore manual override regexes in
 * public/generated/*.json that were clobbered by the iterative optimizer
 * during the iter 151 ETL refresh.
 *
 * ROOT CAUSE (KI#10 + KI#12 regression):
 * `applyI18nOverrides()` in run-etl.ts sets `token.regex.ru` from the
 * explicit `override.regex` field. But the subsequent Step 10
 * `runIterativeOptimization()` ran `trySuffixShortening` and `tryFixFN`
 * on these tokens, replacing the override regex with a "shorter" or
 * "FN-fixed" alternative:
 *   - waystone.implicit.item_rarity: 'едкость предметов' → 'предметов'
 *   - relic.sanctummonstersreduceddamage1: 'монстры наносят уменьшенный на '
 *     → 'уменьшенный на 6' (tier-hardcoded — KI#12 regression)
 *
 * This script:
 *   1. Re-applies the explicit regex override from i18n-overrides.json
 *      to every generated JSON file (sets token.regex.ru + manualOverride=true).
 *   2. Restores regexPrefixContext / regexExclude on the 7 KI#12 relic
 *      tokens (per iter127 test expectations).
 *   3. Restores the 4 family-level opt entries in relic.json to their
 *      tier-agnostic regex.
 *   4. Deletes the 4 broken cross-family opt entries that iter 127
 *      originally removed but ETL regenerated.
 *
 * Future ETL runs are protected by the new `manualOverride` flag
 * (added iter 153 to GameToken type + Zod schema + iterative-optimizer
 * skip), so this script is only needed ONCE on the existing JSON files.
 *
 * Run: tsx scripts/patch-ki10-ki12-overrides.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const GEN_DIR = path.join(ROOT, 'public', 'generated');
const OVERRIDES_PATH = path.join(ROOT, 'scripts', 'etl', 'i18n-overrides.json');

// ─── KI#12 relic: per-token regexPrefixContext and regexExclude ────────────
// Mirrors EXPECTED map in tests/core/iter127-ki12-tier-hardcoded-regex.test.ts
interface RelicExpectation {
  ctx: string;
  excl: string[];
}
const RELIC_EXPECTED: Record<string, RelicExpectation> = {
  'relic.sanctummonstersreduceddamage1': { ctx: '', excl: [] },
  'relic.sanctummonsterspeed1': { ctx: '', excl: [] },
  'relic.sanctummonsterspeed2': { ctx: '', excl: [] },
  'relic.sanctumrevealextraroomeachfloor2': { ctx: '', excl: ['дополнительная'] },
  'relic.sanctumrevealextraroomeachfloorlarge2': { ctx: '', excl: ['дополнительная'] },
  'relic.sanctumguardsreduceddamage1': { ctx: '', excl: [] },
  'relic.sanctumbossreduceddamage1': { ctx: 'Боссы наносят', excl: [] },
};

// ─── KI#12 relic: family-level opt entry regex restoration ─────────────────
const RELIC_FAMILY_OPT: Record<string, { regex: string; ctx?: string }> = {
  'relic.sanctummonstersreduceddamage1:relic.sanctummonstersreduceddamage2:relic.sanctummonstersreduceddamage3':
    { regex: 'монстры наносят уменьшенный на ' },
  'relic.sanctummonsterspeed1:relic.sanctummonsterspeed2:relic.sanctummonsterspeed3':
    { regex: 'корость атаки, сотворения чар и' },
  'relic.sanctumguardsreduceddamage1:relic.sanctumguardsreduceddamage2:relic.sanctumguardsreduceddamage3':
    { regex: 'кие монстры наносят уменьшенный' },
  'relic.sanctumbossreduceddamage1:relic.sanctumbossreduceddamage2:relic.sanctumbossreduceddamage3':
    { regex: 'урон', ctx: 'Боссы наносят' },
};

// ─── KI#12 relic: broken cross-family opt entries to delete ────────────────
const RELIC_DELETED_OPT_KEYS = [
  'relic.sanctumbossreduceddamage1:relic.sanctumguardsreduceddamage1',
  'relic.sanctumbossreduceddamage1:relic.sanctumguardsreduceddamage1:relic.sanctummonsterspeed2',
  'relic.sanctummonsterspeed1:relic.sanctummonstersreduceddamage1:relic.sanctumrevealextraroomeachfloorlarge1',
  'relic.sanctumrevealextraroomeachfloor2:relic.sanctumrevealextraroomeachfloorlarge2',
];

interface OverrideEntry {
  rawText: string;
  rawTextTemplate?: string;
  regex?: string;
  source?: string;
}

interface OverridesFile {
  _comment?: string;
  _updated?: string;
  overrides: Record<string, OverrideEntry>;
}

interface TokenLike {
  id: string;
  regex: { ru: string };
  regexPrefixContext?: { ru: string };
  regexExclude?: { ru: string[] };
  manualOverride?: boolean;
  [k: string]: unknown;
}

interface OptEntryLike {
  ids?: string[];
  regex: { ru: string };
  regexPrefixContext?: { ru: string };
  [k: string]: unknown;
}

interface CategoryDataLike {
  tokens: TokenLike[];
  optimizationTable: Record<string, OptEntryLike>;
  [k: string]: unknown;
}

function readJson<T = unknown>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

function writeJson(p: string, data: unknown): void {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function main(): void {
  if (!fs.existsSync(OVERRIDES_PATH)) {
    console.error(`Missing overrides file: ${OVERRIDES_PATH}`);
    process.exit(1);
  }

  const overridesFile = readJson<OverridesFile>(OVERRIDES_PATH);
  const overrides = overridesFile.overrides || {};
  const explicitRegexOverrides = Object.entries(overrides).filter(
    ([, v]) => typeof v.regex === 'string' && v.regex!.length > 0,
  );
  console.log(
    `Found ${explicitRegexOverrides.length} explicit-regex overrides in i18n-overrides.json`,
  );

  const jsonFiles = fs
    .readdirSync(GEN_DIR)
    .filter((f) => f.endsWith('.json'));

  let totalPatchedTokens = 0;
  let totalPatchedOpt = 0;
  let totalDeletedOpt = 0;

  for (const jsonFile of jsonFiles) {
    const filePath = path.join(GEN_DIR, jsonFile);
    const data = readJson<CategoryDataLike>(filePath);
    let filePatchedTokens = 0;
    let filePatchedOpt = 0;
    let fileDeletedOpt = 0;

    // Step 1: patch per-token regex from explicit overrides
    for (const token of data.tokens) {
      const ov = overrides[token.id];
      if (!ov || typeof ov.regex !== 'string' || ov.regex.length === 0) continue;

      const oldRegex = token.regex.ru;
      token.regex.ru = ov.regex;
      token.manualOverride = true;

      // For relic KI#12 tokens, also restore regexPrefixContext / regexExclude
      const relicExp = RELIC_EXPECTED[token.id];
      if (relicExp) {
        if (relicExp.ctx.length > 0) {
          token.regexPrefixContext = { ru: relicExp.ctx };
        } else {
          delete token.regexPrefixContext;
        }
        if (relicExp.excl.length > 0) {
          token.regexExclude = { ru: relicExp.excl };
        } else {
          delete token.regexExclude;
        }
      }

      filePatchedTokens++;
      console.log(
        `  ${jsonFile} :: ${token.id}: regex ${JSON.stringify(oldRegex)} → ${JSON.stringify(ov.regex)}`,
      );
    }

    // Step 2: relic.json — patch family-level opt entries
    if (jsonFile === 'relic.json') {
      const opt = data.optimizationTable;
      for (const [key, expected] of Object.entries(RELIC_FAMILY_OPT)) {
        if (!opt[key]) {
          console.warn(`  WARN: relic.json opt entry ${key} not found, skipping`);
          continue;
        }
        const oldRegex = opt[key].regex.ru;
        opt[key].regex.ru = expected.regex;
        if (expected.ctx) {
          opt[key].regexPrefixContext = { ru: expected.ctx };
        } else {
          delete opt[key].regexPrefixContext;
        }
        filePatchedOpt++;
        console.log(
          `  relic.json opt :: ${key}: regex ${JSON.stringify(oldRegex)} → ${JSON.stringify(expected.regex)}`,
        );
      }

      // Step 3: relic.json — delete broken cross-family opt entries
      for (const key of RELIC_DELETED_OPT_KEYS) {
        if (opt[key]) {
          delete opt[key];
          fileDeletedOpt++;
          console.log(`  relic.json opt :: deleted broken entry ${key}`);
        }
      }
    }

    if (filePatchedTokens > 0 || filePatchedOpt > 0 || fileDeletedOpt > 0) {
      writeJson(filePath, data);
      console.log(
        `  → ${jsonFile}: ${filePatchedTokens} tokens, ${filePatchedOpt} opt entries patched, ${fileDeletedOpt} opt entries deleted`,
      );
    }

    totalPatchedTokens += filePatchedTokens;
    totalPatchedOpt += filePatchedOpt;
    totalDeletedOpt += fileDeletedOpt;
  }

  console.log(
    `\nDone. Totals: ${totalPatchedTokens} tokens patched, ${totalPatchedOpt} opt entries patched, ${totalDeletedOpt} opt entries deleted.`,
  );
}

main();
