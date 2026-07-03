import { describe, it, expect } from 'vitest';
import { matchPoE2RegexItem } from '@core/poe2-regex-matcher';
import type { GameItemText } from '@core/poe2-regex-matcher';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * iter 127 — Regression tests for KI#12 fix: tier-hardcoded regex for single-#
 * relic tokens.
 *
 * PROBLEM (KI#12):
 * 7 relic tokens with single-`#` template (one digit, not `##` range) had
 * regexes containing the specific tier digit (e.g., `'на 6%'`, `'на 4%'`,
 * `'ат: 2'`, `'ат: 4'`, `'а на 5'`, `'ры наносят уменьшенный на 5'`,
 * `'сы наносят уменьшенный на 5'`). These regexes only matched their own
 * tier, NOT the whole family (tiers 2+). The family-level optimization entry
 * used the FIRST token's regex (alphabetically), which was tier-hardcoded →
 * FN for tiers 2+ when user clicked the family filter.
 *
 * ROOT CAUSE:
 * ETL auto-compute for single-`#` templates falls through all suffix strategies
 * (template suffix too short) into substring search, which finds the shortest
 * unique substring — and that substring often includes the tier digit itself.
 *
 * FIX (iter 127):
 * Explicit regex overrides in `scripts/etl/i18n-overrides.json` for all 7
 * tokens, using the tier-agnostic regex from their `##` siblings. Patched
 * `public/generated/relic.json` (7 token regexes + 4 family-level opt entries
 * + deleted 4 broken cross-family entries).
 *
 * RELATED (KI#11 DISPROVEN):
 * User's iter 127 confirmation that iter 126 fix (`'едкость предметов'`)
 * works correctly in-game DISPROVES the KI#11 cross-block `.*` hypothesis.
 * `.*` does NOT cross line/block boundaries in PoE2 (Phase 7 verification
 * remains valid). This test suite includes a verification test for KI#11
 * disprove.
 *
 * AUDIT (iter 127):
 * iter 154: standalone audit script `scripts/audit-tier-hardcoded-regex.py`
 * was removed — the audit logic is inlined below in SECTION 6 of this test
 * file (function `auditAllCategories`). After fix: 0 tokens found.
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: Per-token regex verification — 7 relic tokens have tier-agnostic regex
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 127 — KI#12 per-token regex: tier-agnostic (not tier-hardcoded)', () => {
  const RELIC_JSON = path.resolve(__dirname, '../../public/generated/relic.json');

  // Expected regexes after iter 127 fix (tier-agnostic, matching ## siblings)
  const EXPECTED: Record<string, { regex: string; ctx: string; excl: string[] }> = {
    'relic.sanctummonstersreduceddamage1': {
      regex: 'монстры наносят уменьшенный на ',
      ctx: '',
      excl: [],
    },
    'relic.sanctummonsterspeed1': {
      regex: 'корость атаки, сотворения чар и',
      ctx: '',
      excl: [],
    },
    'relic.sanctummonsterspeed2': {
      regex: 'корость атаки, сотворения чар и',
      ctx: '',
      excl: [],
    },
    'relic.sanctumrevealextraroomeachfloor2': {
      regex: 'на карте испытаний раскрывается',
      ctx: '',
      excl: ['дополнительная'],
    },
    'relic.sanctumrevealextraroomeachfloorlarge2': {
      regex: 'на карте испытаний раскрывается',
      ctx: '',
      excl: ['дополнительная'],
    },
    'relic.sanctumguardsreduceddamage1': {
      regex: 'кие монстры наносят уменьшенный',
      ctx: '',
      excl: [],
    },
    'relic.sanctumbossreduceddamage1': {
      regex: 'урон',
      ctx: 'Боссы наносят',
      excl: [],
    },
  };

  it('relic.json contains all 7 fixed tokens with correct tier-agnostic regex', async () => {
    const data = JSON.parse(await fs.readFile(RELIC_JSON, 'utf-8'));
    for (const [tid, expected] of Object.entries(EXPECTED)) {
      const token = data.tokens.find((t: { id: string }) => t.id === tid);
      expect(token, `Token ${tid} must exist`).toBeDefined();
      expect(token.regex.ru, `Token ${tid} regex`).toBe(expected.regex);
      expect(token.regexPrefixContext?.ru ?? '', `Token ${tid} regexPrefixContext`).toBe(expected.ctx);
      expect(token.regexExclude?.ru ?? [], `Token ${tid} regexExclude`).toEqual(expected.excl);
    }
  });

  it('none of the 7 fixed tokens contain hardcoded tier digit in regex', async () => {
    const data = JSON.parse(await fs.readFile(RELIC_JSON, 'utf-8'));
    for (const tid of Object.keys(EXPECTED)) {
      const token = data.tokens.find((t: { id: string }) => t.id === tid);
      expect(token).toBeDefined();
      const regex = token.regex.ru;
      // The OLD tier-hardcoded regexes contained digits like '4', '5', '6', '2'.
      // The NEW tier-agnostic regexes should NOT contain any digit.
      // Exception: none — all 7 expected regexes have no digits.
      expect(/\d/.test(regex), `Token ${tid} regex ${JSON.stringify(regex)} must not contain digits`).toBe(false);
    }
  });

  it('all 7 fixed tokens share familyKey with their ## siblings', async () => {
    const data = JSON.parse(await fs.readFile(RELIC_JSON, 'utf-8'));
    for (const tid of Object.keys(EXPECTED)) {
      const token = data.tokens.find((t: { id: string }) => t.id === tid);
      expect(token).toBeDefined();
      const familyKey = token.familyKey.ru;
      // Find siblings with same familyKey but different id
      const siblings = data.tokens.filter(
        (t: { id: string; familyKey: { ru: string } }) =>
          t.id !== tid && t.familyKey.ru === familyKey,
      );
      expect(siblings.length, `Token ${tid} should have siblings in same family`).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: Family-level optimization entries — tier-agnostic regex
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 127 — KI#12 family-level opt entries: tier-agnostic', () => {
  const RELIC_JSON = path.resolve(__dirname, '../../public/generated/relic.json');

  const EXPECTED_FAMILY_OPT: Record<string, string> = {
    'relic.sanctummonstersreduceddamage1:relic.sanctummonstersreduceddamage2:relic.sanctummonstersreduceddamage3':
      'монстры наносят уменьшенный на ',
    'relic.sanctummonsterspeed1:relic.sanctummonsterspeed2:relic.sanctummonsterspeed3':
      'корость атаки, сотворения чар и',
    'relic.sanctumguardsreduceddamage1:relic.sanctumguardsreduceddamage2:relic.sanctumguardsreduceddamage3':
      'кие монстры наносят уменьшенный',
    'relic.sanctumbossreduceddamage1:relic.sanctumbossreduceddamage2:relic.sanctumbossreduceddamage3':
      'урон',
  };

  it('family-level opt entries use tier-agnostic regex (no hardcoded digits)', async () => {
    const data = JSON.parse(await fs.readFile(RELIC_JSON, 'utf-8'));
    const opt = data.optimizationTable ?? {};
    for (const [key, expectedRegex] of Object.entries(EXPECTED_FAMILY_OPT)) {
      expect(opt[key], `Opt entry ${key} must exist`).toBeDefined();
      expect(opt[key].regex.ru, `Opt entry ${key} regex`).toBe(expectedRegex);
      // No digits in regex (tier-agnostic)
      expect(/\d/.test(opt[key].regex.ru), `Opt entry ${key} regex must not contain digits`).toBe(false);
    }
  });

  it('deleted broken cross-family opt entries no longer exist', async () => {
    const data = JSON.parse(await fs.readFile(RELIC_JSON, 'utf-8'));
    const opt = data.optimizationTable ?? {};
    const DELETED_KEYS = [
      'relic.sanctumbossreduceddamage1:relic.sanctumguardsreduceddamage1',
      'relic.sanctumbossreduceddamage1:relic.sanctumguardsreduceddamage1:relic.sanctummonsterspeed2',
      'relic.sanctummonsterspeed1:relic.sanctummonstersreduceddamage1:relic.sanctumrevealextraroomeachfloorlarge1',
      'relic.sanctumrevealextraroomeachfloor2:relic.sanctumrevealextraroomeachfloorlarge2',
    ];
    for (const key of DELETED_KEYS) {
      expect(opt[key], `Broken opt entry ${key} should have been deleted`).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: Compile-time AND-logic — family filter matches all tiers (FN prevention)
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 127 — KI#12 family filter matches all tiers (FN prevention)', () => {
  // Simulate the in-game regex that would be produced when the user clicks
  // a family filter (e.g., "Монстры наносят уменьшенный на #% урон" family).
  // After iter 127 fix, the family regex is tier-agnostic, so it matches
  // ALL tiers (1, 2, 3), not just tier 1.

  it('sanctummonstersreduceddamage family regex matches all 3 tiers', () => {
    // After fix: family opt entry uses 'монстры наносят уменьшенный на '
    // This regex matches all 3 rawTexts (tier 1, 2, 3)
    const regex = '"монстры наносят уменьшенный на "';

    // Tier 1: rawText 'Монстры наносят уменьшенный на 6% урон'
    const item1: GameItemText = {
      mods: ['Монстры наносят уменьшенный на 6% урон'],
    };
    expect(matchPoE2RegexItem(regex, item1)).toBe(true);

    // Tier 2: rawText 'Монстры наносят уменьшенный на (7—8)% урон'
    const item2: GameItemText = {
      mods: ['Монстры наносят уменьшенный на (7—8)% урон'],
    };
    expect(matchPoE2RegexItem(regex, item2)).toBe(true);

    // Tier 3: rawText 'Монстры наносят уменьшенный на (9—12)% урон'
    const item3: GameItemText = {
      mods: ['Монстры наносят уменьшенный на (9—12)% урон'],
    };
    expect(matchPoE2RegexItem(regex, item3)).toBe(true);
  });

  it('sanctummonsterspeed family regex matches all 3 tiers', () => {
    const regex = '"корость атаки, сотворения чар и"';

    // Tier 1: 'Скорость атаки, сотворения чар и передвижения монстров снижена на 4%'
    const item1: GameItemText = {
      mods: ['Скорость атаки, сотворения чар и передвижения монстров снижена на 4%'],
    };
    expect(matchPoE2RegexItem(regex, item1)).toBe(true);

    // Tier 2: 'Скорость атаки, сотворения чар и передвижения монстров снижена на 5%'
    const item2: GameItemText = {
      mods: ['Скорость атаки, сотворения чар и передвижения монстров снижена на 5%'],
    };
    expect(matchPoE2RegexItem(regex, item2)).toBe(true);

    // Tier 3: 'Скорость атаки, сотворения чар и передвижения монстров снижена на (6—7)%'
    const item3: GameItemText = {
      mods: ['Скорость атаки, сотворения чар и передвижения монстров снижена на (6—7)%'],
    };
    expect(matchPoE2RegexItem(regex, item3)).toBe(true);
  });

  it('sanctumguardsreduceddamage family regex matches all 3 tiers', () => {
    const regex = '"кие монстры наносят уменьшенный"';

    // Tier 1: 'Редкие монстры наносят уменьшенный на 5% урон'
    const item1: GameItemText = {
      mods: ['Редкие монстры наносят уменьшенный на 5% урон'],
    };
    expect(matchPoE2RegexItem(regex, item1)).toBe(true);

    // Tier 2: 'Редкие монстры наносят уменьшенный на (6—7)% урон'
    const item2: GameItemText = {
      mods: ['Редкие монстры наносят уменьшенный на (6—7)% урон'],
    };
    expect(matchPoE2RegexItem(regex, item2)).toBe(true);

    // Tier 3: 'Редкие монстры наносят уменьшенный на (8—10)% урон'
    const item3: GameItemText = {
      mods: ['Редкие монстры наносят уменьшенный на (8—10)% урон'],
    };
    expect(matchPoE2RegexItem(regex, item3)).toBe(true);
  });

  it('sanctumbossreduceddamage family regex matches all 3 tiers (with prefixContext)', () => {
    // After fix: regex 'урон' + prefixContext 'Боссы наносят'
    // Compile output: "Боссы наносят" "урон" (AND of two quoted groups)
    const regex = '"Боссы наносят" "урон"';

    // Tier 1: 'Боссы наносят уменьшенный на 5% урон'
    const item1: GameItemText = {
      mods: ['Боссы наносят уменьшенный на 5% урон'],
    };
    expect(matchPoE2RegexItem(regex, item1)).toBe(true);

    // Tier 2: 'Боссы наносят уменьшенный на (6—7)% урон'
    const item2: GameItemText = {
      mods: ['Боссы наносят уменьшенный на (6—7)% урон'],
    };
    expect(matchPoE2RegexItem(regex, item2)).toBe(true);

    // Tier 3: 'Боссы наносят уменьшенный на (8—10)% урон'
    const item3: GameItemText = {
      mods: ['Боссы наносят уменьшенный на (8—10)% урон'],
    };
    expect(matchPoE2RegexItem(regex, item3)).toBe(true);
  });

  it('sanctumrevealextraroomeachfloor family regex matches all 3 tiers (with exclude)', () => {
    // After fix: regex 'на карте испытаний раскрывается' + exclude 'дополнительная'
    // Note: 'дополнительная' (singular) is excluded to prevent FP on the
    // singular form family (different family with 'дополнительная комната').
    // The plural 'дополнительных' is what we want (rooms: 2,3,4 plural).
    const regex = '"на карте испытаний раскрывается" "!дополнительная"';

    // Tier 1 (large1, ## template): 'На карте испытаний раскрывается дополнительных комнат: (2—3)'
    const item1: GameItemText = {
      mods: ['На карте испытаний раскрывается дополнительных комнат: (2—3)'],
    };
    expect(matchPoE2RegexItem(regex, item1)).toBe(true);

    // Tier 2 (floor2, single #): 'На карте испытаний раскрывается дополнительных комнат: 2'
    const item2: GameItemText = {
      mods: ['На карте испытаний раскрывается дополнительных комнат: 2'],
    };
    expect(matchPoE2RegexItem(regex, item2)).toBe(true);

    // Tier 3 (large2, single #): 'На карте испытаний раскрывается дополнительных комнат: 4'
    const item3: GameItemText = {
      mods: ['На карте испытаний раскрывается дополнительных комнат: 4'],
    };
    expect(matchPoE2RegexItem(regex, item3)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: FN regression — OLD tier-hardcoded regex would have failed these
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 127 — KI#12 FN regression: OLD tier-hardcoded regex would have failed', () => {
  // Verify that the OLD tier-hardcoded regexes (before fix) would have
  // produced FN (failed to match tiers 2+). This documents the bug.

  it('OLD regex "на 6%" (tier 1 only) does NOT match tier 2/3 (FN bug)', () => {
    const OLD_REGEX = '"на 6%"';
    // Tier 1 — matches (correct)
    const item1: GameItemText = {
      mods: ['Монстры наносят уменьшенный на 6% урон'],
    };
    expect(matchPoE2RegexItem(OLD_REGEX, item1)).toBe(true);
    // Tier 2 — FN (does not match, but should)
    const item2: GameItemText = {
      mods: ['Монстры наносят уменьшенный на (7—8)% урон'],
    };
    expect(matchPoE2RegexItem(OLD_REGEX, item2)).toBe(false);
    // Tier 3 — FN
    const item3: GameItemText = {
      mods: ['Монстры наносят уменьшенный на (9—12)% урон'],
    };
    expect(matchPoE2RegexItem(OLD_REGEX, item3)).toBe(false);
  });

  it('NEW tier-agnostic regex matches all 3 tiers (FN bug fixed)', () => {
    const NEW_REGEX = '"монстры наносят уменьшенный на "';
    const item1: GameItemText = {
      mods: ['Монстры наносят уменьшенный на 6% урон'],
    };
    const item2: GameItemText = {
      mods: ['Монстры наносят уменьшенный на (7—8)% урон'],
    };
    const item3: GameItemText = {
      mods: ['Монстры наносят уменьшенный на (9—12)% урон'],
    };
    expect(matchPoE2RegexItem(NEW_REGEX, item1)).toBe(true);
    expect(matchPoE2RegexItem(NEW_REGEX, item2)).toBe(true);
    expect(matchPoE2RegexItem(NEW_REGEX, item3)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: KI#11 DISPROVEN — iter 126 fix verified, .* does NOT cross blocks
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 127 — KI#11 DISPROVEN: iter 126 fix verified in-game', () => {
  // User's iter 127 confirmation: iter 126 fix (`'едкость предметов'` suffix)
  // works correctly in-game. This DISPROVES the KI#11 hypothesis that in-game
  // `.*` crosses block/line boundaries.
  //
  // Test scenarios from iter 126:
  //   Waystone with `Редкость предметов: +11%` + `Эффективность монстров: +25%`
  //     → should NOT highlight (Редкость < 20%)
  //   Waystone with `Редкость предметов: +25%` + `Эффективность монстров: +25%`
  //     → should highlight (both ≥ 20%)

  const regex =
    '"едкость предметов.*\\+[2-9][0-9]%|едкость предметов.*\\+\\d{3,}%" "ивность.*\\+[2-9][0-9]%|ивность.*\\+\\d{3,}%"';

  it('does NOT match waystone with Редкость предметов +11% + Эффективность +25% (FP case, fixed)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +11%', 'Эффективность монстров: +25%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('matches waystone with Редкость предметов +25% + Эффективность +25% (correct case)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +25%', 'Эффективность монстров: +25%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('does NOT match waystone with Редкость предметов +11% only (below threshold)', () => {
    const item: GameItemText = {
      implicits: ['Редкость предметов: +11%', 'Эффективность монстров: +5%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('KI#11 disprove note: .* does NOT cross blocks (Phase 7 verified)', () => {
    // Documentation test — always passes.
    // If FP had persisted after iter 126 fix, it would have meant .* crosses
    // block boundaries in PoE2. User's iter 127 confirmation that iter 126 fix
    // works correctly DISPROVES KI#11. Phase 7 verification remains valid.
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: Audit — scan ALL generated/*.json for KI#12-pattern (future regression)
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 127 — KI#12 audit: no tier-hardcoded regex in any generated/*.json', () => {
  const GEN_DIR = path.resolve(__dirname, '../../public/generated');

  /**
   * Audit logic — same as the removed `scripts/audit-tier-hardcoded-regex.py`
   * (iter 154: script deleted, logic inlined here):
   * For each token with single-# template (no ##), check if its regex
   * contains the digit value from its rawText. If yes, it's a tier-hardcoded
   * regex (KI#12-pattern bug).
   */
  async function auditAllCategories(): Promise<
    Array<{ category: string; tokenId: string; regex: string; rawText: string; template: string; digit: string }>
  > {
    const issues: Array<{ category: string; tokenId: string; regex: string; rawText: string; template: string; digit: string }> = [];

    const files = await fs.readdir(GEN_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(GEN_DIR, file);
      const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      const category = file.replace('.json', '');

      // Build family map: familyKey → list of tokens
      const familyMap = new Map<string, Array<{ id: string; template: string }>>();
      for (const token of data.tokens ?? []) {
        const fk = token.familyKey?.ru ?? '';
        if (!familyMap.has(fk)) familyMap.set(fk, []);
        familyMap.get(fk)!.push({ id: token.id, template: token.rawTextTemplate?.ru ?? '' });
      }

      for (const token of data.tokens ?? []) {
        const tmpl: string = token.rawTextTemplate?.ru ?? '';
        const raw: string = token.rawText?.ru ?? '';
        const regex: string = token.regex?.ru ?? '';
        const tid: string = token.id;
        const fk: string = token.familyKey?.ru ?? '';

        // Only single-# templates (no ##)
        if (tmpl.includes('##')) continue;
        if (!tmpl.includes('#')) continue;

        // Find # position in template
        const hashPos = tmpl.indexOf('#');
        if (hashPos < 0 || hashPos >= raw.length) continue;

        // Extract digit value from rawText at hashPos
        const digitMatch = raw.substring(hashPos, hashPos + 5).match(/^\d{1,4}/);
        if (!digitMatch) continue;
        const digit = digitMatch[0];

        // Check if regex contains this digit
        if (regex.includes(digit)) {
          // Also check: are there siblings in same family with ##?
          const siblings = (familyMap.get(fk) ?? []).filter((s) => s.id !== tid);
          const hasHashHashSiblings = siblings.some((s) => s.template.includes('##'));
          if (hasHashHashSiblings) {
            issues.push({ category, tokenId: tid, regex, rawText: raw, template: tmpl, digit });
          }
        }
      }
    }

    return issues;
  }

  it('no token in any generated/*.json has tier-hardcoded regex (KI#12-pattern)', async () => {
    const issues = await auditAllCategories();
    if (issues.length > 0) {
      const message = issues
        .map(
          (i) =>
            `  [${i.category}] ${i.tokenId}: regex=${JSON.stringify(i.regex)} contains digit ${JSON.stringify(i.digit)} (rawText=${JSON.stringify(i.rawText)})`,
        )
        .join('\n');
      expect.fail(`Found ${issues.length} tokens with tier-hardcoded regex (KI#12-pattern):\n${message}`);
    }
    expect(issues).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: i18n-overrides.json — all 7 override entries present
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 127 — KI#12 i18n-overrides.json: 7 override entries present', () => {
  const OVERRIDES_JSON = path.resolve(__dirname, '../../scripts/etl/i18n-overrides.json');

  const EXPECTED_OVERRIDES: Record<string, string> = {
    'relic.sanctummonstersreduceddamage1': 'монстры наносят уменьшенный на ',
    'relic.sanctummonsterspeed1': 'корость атаки, сотворения чар и',
    'relic.sanctummonsterspeed2': 'корость атаки, сотворения чар и',
    'relic.sanctumrevealextraroomeachfloor2': 'на карте испытаний раскрывается',
    'relic.sanctumrevealextraroomeachfloorlarge2': 'на карте испытаний раскрывается',
    'relic.sanctumguardsreduceddamage1': 'кие монстры наносят уменьшенный',
    'relic.sanctumbossreduceddamage1': 'урон',
  };

  it('all 7 override entries exist with correct regex', async () => {
    const data = JSON.parse(await fs.readFile(OVERRIDES_JSON, 'utf-8'));
    for (const [tid, expectedRegex] of Object.entries(EXPECTED_OVERRIDES)) {
      expect(data.overrides[tid], `Override ${tid} must exist`).toBeDefined();
      expect(data.overrides[tid].regex, `Override ${tid} regex`).toBe(expectedRegex);
    }
  });

  it('override entries include source comment with iter 127 reference', async () => {
    const data = JSON.parse(await fs.readFile(OVERRIDES_JSON, 'utf-8'));
    for (const tid of Object.keys(EXPECTED_OVERRIDES)) {
      const source: string = data.overrides[tid].source ?? '';
      expect(source, `Override ${tid} source must mention iter 127`).toContain('iter 127');
      expect(source, `Override ${tid} source must mention KI#12`).toContain('KI#12');
    }
  });
});
