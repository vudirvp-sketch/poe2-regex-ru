import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { compile } from '@core/compiler';
import { range } from '@core/ast';
import { matchPoE2RegexItem } from '@core/poe2-regex-matcher';
import type { ASTNode } from '@shared/types';
import type { GameItemText } from '@core/poe2-regex-matcher';
import {
  WAYSTONE_IMPLICIT_SET_FAMILY_KEYS,
  generateWaystoneImplicitTokens,
} from '@etl/normalize';

/**
 * iter 128 — Regression tests for KI#13 fix.
 *
 * USER-REPORTED ISSUE (iter 128):
 * Вкладка путевых камней: пропущен implicit `Редкость монстров: +х%`. В суффиксах
 * и префиксах "каша" — попали "за кулисами"-статы, которые не должны быть searchable.
 *
 * Пример: мод-аффикс с 4 сегментами (один row в poe2db):
 *   "Монстры получают (26—30)% уменьшение дополнительного урона от критических ударов"
 *   "На 18% больше волшебных и редких монстров"  ← BTS, added to implicit
 *   "На 18% больше шанса появления свойств у редких монстров"  ← BTS, no implicit
 *   "На 10% больше находимых в области путевых камней"  ← BTS, added to implicit
 *
 * Игрок видит на путевом камне только ПЕРВЫЙ сегмент как аффикс. Остальные
 * плюсуются за кулисами к имплиситам (`Редкость монстров`, `Шанс выпадения`, и т.д.)
 * и отображаются в приплюсованном виде в имплисетах.
 *
 * ROOT CAUSE:
 * (a) `generateWaystoneImplicitTokens()` не включал `Редкость монстров: +##%`.
 * (b) `WAYSTONE_IMPLICIT_SET_FAMILY_KEYS` содержал только 4 BTS-ключа, не покрывая
 *     6 других паттернов (см. STATUS.md KI#13 для полного списка).
 *
 * FIX (iter 128):
 * 1. Добавлен implicit `Редкость монстров: +##%` с regex `'едкость монстров'`
 *    (15 chars, literal space) — disambiguate от `'едкость предметов'` (iter 126).
 * 2. Расширён WAYSTONE_IMPLICIT_SET_FAMILY_KEYS +6 ключей.
 * 3. Patched `waystone.json` + `waystone-desecrated.json`: удалены BTS-токены,
 *    добавлен новый implicit.
 * 4. Override в `i18n-overrides.json` для обоих категорий.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────

const projectRoot = join(__dirname, '..', '..');
const generatedDir = join(projectRoot, 'public', 'generated');

/** Minimal token shape needed for tests (avoids `any`). */
interface TokenLike {
  id: string;
  affix: string;
  rawText: { ru: string };
  rawTextTemplate?: { ru: string };
  familyKey?: { ru: string };
  regex: { ru: string };
  ranges?: number[][];
}

interface CategoryData {
  tokens: TokenLike[];
}

function loadJson(filename: string): CategoryData {
  return JSON.parse(readFileSync(join(generatedDir, filename), 'utf-8'));
}

function normalizeKey(s: string): string {
  return s.replace(/##/g, '#').replace(/\s+/g, ' ').trim();
}

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
// SECTION 1: New implicit `Редкость монстров: +##%` exists in JSON data
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 128 — SECTION 1: new implicit `Редкость монстров` in JSON', () => {
  it('waystone.json contains monster_rarity implicit', () => {
    const data = loadJson('waystone.json');
    const mr = data.tokens.find(t => t.id === 'waystone.implicit.monster_rarity');
    expect(mr).toBeDefined();
    expect(mr!.affix).toBe('implicit');
    expect(mr!.rawText.ru).toBe('Редкость монстров: +##%');
    expect(mr!.rawTextTemplate!.ru).toBe('Редкость монстров: +##%');
  });

  it('waystone.json monster_rarity has regex "едкость монстров"', () => {
    const data = loadJson('waystone.json');
    const mr = data.tokens.find(t => t.id === 'waystone.implicit.monster_rarity');
    expect(mr!.regex.ru).toBe('едкость монстров');
  });

  it('waystone-desecrated.json contains monster_rarity implicit', () => {
    const data = loadJson('waystone-desecrated.json');
    const mr = data.tokens.find(t => t.id === 'waystone-desecrated.implicit.monster_rarity');
    expect(mr).toBeDefined();
    expect(mr!.affix).toBe('implicit');
    expect(mr!.rawText.ru).toBe('Редкость монстров: +##%');
    expect(mr!.regex.ru).toBe('едкость монстров');
  });

  it('waystone.json has exactly 6 implicits (incl. new monster_rarity)', () => {
    const data = loadJson('waystone.json');
    const implicits = data.tokens.filter(t => t.affix === 'implicit');
    expect(implicits.length).toBe(6);
    const ids = implicits.map(t => t.id).sort();
    expect(ids).toEqual([
      'waystone.implicit.item_rarity',
      'waystone.implicit.monster_effectiveness',
      'waystone.implicit.monster_rarity',
      'waystone.implicit.pack_size',
      'waystone.implicit.revives',
      'waystone.implicit.waystone_drop_chance',
    ]);
  });

  it('waystone-desecrated.json has exactly 6 implicits (incl. new monster_rarity)', () => {
    const data = loadJson('waystone-desecrated.json');
    const implicits = data.tokens.filter(t => t.affix === 'implicit');
    expect(implicits.length).toBe(6);
    const ids = implicits.map(t => t.id).sort();
    expect(ids).toEqual([
      'waystone-desecrated.implicit.item_rarity',
      'waystone-desecrated.implicit.monster_effectiveness',
      'waystone-desecrated.implicit.monster_rarity',
      'waystone-desecrated.implicit.pack_size',
      'waystone-desecrated.implicit.revives',
      'waystone-desecrated.implicit.waystone_drop_chance',
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: BTS tokens removed from JSON data
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 128 — SECTION 2: BTS tokens removed from JSON', () => {
  const BTS_KEYS_TO_VERIFY = [
    'На #% больше волшебных и редких монстров',
    'На #% больше шанса появления свойств у редких монстров',
    'На #% больше эффективности монстров',
    '#% увеличение количества редких монстров',
    '#% увеличение количества волшебных монстров',
    '#% увеличение количества путевых камней, находимых в области',
    // Original 4 (still filtered)
    'На #% больше находимых в области путевых камней',
    '#% увеличение эффективности монстров',
    'На #% больше редкости находимых в этой области предметов',
    'На #% больше размера групп монстров',
  ];

  it('waystone.json: no BTS family keys remain', () => {
    const data = loadJson('waystone.json');
    const familyKeys = new Set<string>();
    for (const t of data.tokens) {
      const fk = t.familyKey?.ru;
      if (typeof fk === 'string') familyKeys.add(normalizeKey(fk));
    }
    const present = BTS_KEYS_TO_VERIFY.filter(k => familyKeys.has(normalizeKey(k)));
    expect(present, `BTS family keys still present: ${present.join(', ')}`).toEqual([]);
  });

  it('waystone-desecrated.json: no BTS family keys remain', () => {
    const data = loadJson('waystone-desecrated.json');
    const familyKeys = new Set<string>();
    for (const t of data.tokens) {
      const fk = t.familyKey?.ru;
      if (typeof fk === 'string') familyKeys.add(normalizeKey(fk));
    }
    const present = BTS_KEYS_TO_VERIFY.filter(k => familyKeys.has(normalizeKey(k)));
    expect(present, `BTS family keys still present: ${present.join(', ')}`).toEqual([]);
  });

  it('waystone.json: no token rawText matches BTS patterns (no "На X% больше волшебных")', () => {
    const data = loadJson('waystone.json');
    const btsRawTexts = data.tokens.filter(t => {
      const txt = t.rawText?.ru || '';
      return /^На\s+\d+%\s+больше\s+(волшебных|шанса появления|эффективности|размера групп|редкости|находимых)/.test(txt)
        || /^\d+%\s+увеличение\s+количества\s+(редких|волшебных|путевых)/.test(txt);
    });
    const found = btsRawTexts.map(t => t.rawText.ru);
    expect(found, `BTS rawTexts still present: ${JSON.stringify(found)}`).toEqual([]);
  });

  it('waystone-desecrated.json: no token rawText matches BTS patterns', () => {
    const data = loadJson('waystone-desecrated.json');
    const btsRawTexts = data.tokens.filter(t => {
      const txt = t.rawText?.ru || '';
      return /^На\s+\d+%\s+больше\s+(волшебных|шанса появления|эффективности|размера групп|редкости|находимых)/.test(txt)
        || /^\d+%\s+увеличение\s+количества\s+(редких|волшебных|путевых)/.test(txt);
    });
    const found = btsRawTexts.map(t => t.rawText.ru);
    expect(found, `BTS rawTexts still present: ${JSON.stringify(found)}`).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: WAYSTONE_IMPLICIT_SET_FAMILY_KEYS updated correctly
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 128 — SECTION 3: WAYSTONE_IMPLICIT_SET_FAMILY_KEYS includes new BTS keys', () => {
  it('contains new "На #% больше волшебных и редких монстров" key', () => {
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('На #% больше волшебных и редких монстров');
  });

  it('contains new "На #% больше шанса появления свойств у редких монстров" key', () => {
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('На #% больше шанса появления свойств у редких монстров');
  });

  it('contains new "На #% больше эффективности монстров" key', () => {
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('На #% больше эффективности монстров');
  });

  it('contains new "#% увеличение количества редких монстров" key', () => {
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('#% увеличение количества редких монстров');
  });

  it('contains new "#% увеличение количества волшебных монстров" key', () => {
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('#% увеличение количества волшебных монстров');
  });

  it('contains new "#% увеличение количества путевых камней, находимых в области" key', () => {
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('#% увеличение количества путевых камней, находимых в области');
  });

  it('still contains the original 4 BTS keys (backward compat)', () => {
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('На #% больше находимых в области путевых камней');
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('#% увеличение эффективности монстров');
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('На #% больше редкости находимых в этой области предметов');
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS).toContain('На #% больше размера групп монстров');
  });

  it('has at least 10 BTS keys total (4 original + 6 new)', () => {
    expect(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS.length).toBeGreaterThanOrEqual(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: generateWaystoneImplicitTokens returns 6 tokens incl. monster_rarity
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 128 — SECTION 4: generateWaystoneImplicitTokens includes monster_rarity', () => {
  it('returns 6 tokens (was 5 before iter 128)', () => {
    const tokens = generateWaystoneImplicitTokens('waystone', 'normal');
    expect(tokens.length).toBe(6);
  });

  it('includes `monster_rarity` token with correct rawText', () => {
    const tokens = generateWaystoneImplicitTokens('waystone', 'normal');
    const mr = tokens.find(t => t.id === 'waystone.implicit.monster_rarity');
    expect(mr).toBeDefined();
    expect(mr!.rawText.ru).toBe('Редкость монстров: +##%');
    expect(mr!.rawTextTemplate.ru).toBe('Редкость монстров: +##%');
    expect(mr!.affix).toBe('implicit');
  });

  it('monster_rarity has unrestricted range [0, 999] (same as other implicits)', () => {
    const tokens = generateWaystoneImplicitTokens('waystone', 'normal');
    const mr = tokens.find(t => t.id === 'waystone.implicit.monster_rarity');
    expect(mr!.ranges).toEqual([[0, 999]]);
  });

  it('works for waystone-desecrated category too', () => {
    const tokens = generateWaystoneImplicitTokens('waystone-desecrated', 'desecrated');
    expect(tokens.length).toBe(6);
    const mr = tokens.find(t => t.id === 'waystone-desecrated.implicit.monster_rarity');
    expect(mr).toBeDefined();
    expect(mr!.rawText.ru).toBe('Редкость монстров: +##%');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: Compile + matcher — disambiguation FP prevention
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 128 — SECTION 5: compile + matcher — disambiguation FP prevention', () => {
  it('compile monster_rarity +25% (round10=true) → distributed ≥20 with %', () => {
    const result = compile(
      range(25, undefined, 'едкость монстров', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: true },
    );
    expect(result).toBe(
      '"едкость монстров.*\\+[2-9][0-9]%|едкость монстров.*\\+\\d{3,}%"',
    );
  });

  it('regex is within 250-char PoE2 limit', () => {
    const result = compile(
      range(25, undefined, 'едкость монстров', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: true },
    );
    expect(result.length).toBeLessThanOrEqual(250);
  });

  it('monster_rarity regex matches "Редкость монстров: +25%" (TP)', () => {
    const regex = compile(
      range(25, undefined, 'едкость монстров', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: true },
    );
    const item: GameItemText = {
      implicits: ['Редкость монстров: +25%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('monster_rarity regex does NOT match "Редкость предметов: +25%" (FP prevention)', () => {
    // Critical: 'едкость монстров' must NOT match 'Редкость предметов'
    // (otherwise user gets FP when filtering for monster_rarity)
    const regex = compile(
      range(25, undefined, 'едкость монстров', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: true },
    );
    const item: GameItemText = {
      implicits: ['Редкость предметов: +25%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('item_rarity regex (iter 126) does NOT match "Редкость монстров: +25%" (FP prevention)', () => {
    // Bidirectional disambiguation: 'едкость предметов' must NOT match 'Редкость монстров'
    const regex = compile(
      range(25, undefined, 'едкость предметов', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: true },
    );
    const item: GameItemText = {
      implicits: ['Редкость монстров: +25%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('AND-joined monster_rarity + item_rarity + effectiveness — all 3 satisfied', () => {
    const mrNode = buildImplicitRangeNode(25, undefined, 'едкость монстров');
    const irNode = buildImplicitRangeNode(25, undefined, 'едкость предметов');
    const effNode = buildImplicitRangeNode(25, undefined, 'ивность');
    const ast: ASTNode = { type: 'AND', children: [mrNode, irNode, effNode] };
    const regex = compile(ast, { round10: true });
    const item: GameItemText = {
      implicits: [
        'Редкость монстров: +25%',
        'Редкость предметов: +25%',
        'Эффективность монстров: +25%',
      ],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(true);
  });

  it('AND-joined monster_rarity + item_rarity — only monster_rarity satisfied → no match (AND-logic)', () => {
    const mrNode = buildImplicitRangeNode(25, undefined, 'едкость монстров');
    const irNode = buildImplicitRangeNode(25, undefined, 'едкость предметов');
    const ast: ASTNode = { type: 'AND', children: [mrNode, irNode] };
    const regex = compile(ast, { round10: true });
    const item: GameItemText = {
      implicits: [
        'Редкость монстров: +25%',
        'Редкость предметов: +5%',  // below threshold
      ],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });

  it('does NOT match range notation +(15-25)% — % anchor prevents FP', () => {
    const regex = compile(
      range(25, undefined, 'едкость монстров', undefined, undefined, false, '%', true, undefined, undefined, '+'),
      { round10: true },
    );
    const item: GameItemText = {
      implicits: ['Редкость монстров: +(15-25)%'],
    };
    expect(matchPoE2RegexItem(regex, item)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: i18n-overrides.json contains monster_rarity override entries
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 128 — SECTION 6: i18n-overrides.json has monster_rarity overrides', () => {
  const overridesPath = join(projectRoot, 'scripts', 'etl', 'i18n-overrides.json');
  const overrides = JSON.parse(readFileSync(overridesPath, 'utf-8')) as {
    overrides: Record<string, { rawText: string; rawTextTemplate?: string; regex: string; source: string }>;
  };

  it('contains waystone.implicit.monster_rarity override', () => {
    const o = overrides.overrides['waystone.implicit.monster_rarity'];
    expect(o).toBeDefined();
    expect(o.rawText).toBe('Редкость монстров: +##%');
    expect(o.rawTextTemplate).toBe('Редкость монстров: +##%');
    expect(o.regex).toBe('едкость монстров');
  });

  it('contains waystone-desecrated.implicit.monster_rarity override', () => {
    const o = overrides.overrides['waystone-desecrated.implicit.monster_rarity'];
    expect(o).toBeDefined();
    expect(o.rawText).toBe('Редкость монстров: +##%');
    expect(o.regex).toBe('едкость монстров');
  });

  it('override source mentions iter 128 and KI#13', () => {
    const o1 = overrides.overrides['waystone.implicit.monster_rarity'];
    const o2 = overrides.overrides['waystone-desecrated.implicit.monster_rarity'];
    expect(o1.source).toContain('iter 128');
    expect(o1.source).toContain('KI#13');
    expect(o2.source).toContain('iter 128');
    expect(o2.source).toContain('KI#13');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: Audit — verify no BTS family keys leak through filter (future regression)
// ═══════════════════════════════════════════════════════════════════════════

describe('iter 128 — SECTION 7: audit — no BTS family keys in any waystone JSON', () => {
  // This test acts as a regression guard: if a future ETL run re-introduces
  // BTS tokens (e.g., filterImplicitSetBonuses is bypassed), this test fails.
  it('waystone.json: every token familyKey is NOT in WAYSTONE_IMPLICIT_SET_FAMILY_KEYS', () => {
    const data = loadJson('waystone.json');
    const btsKeys = new Set(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS.map(normalizeKey));
    const leaking = data.tokens.filter(t => {
      const fk = t.familyKey?.ru;
      if (typeof fk !== 'string') return false;
      return btsKeys.has(normalizeKey(fk));
    });
    const found = leaking.map(t => ({ id: t.id, fk: t.familyKey!.ru }));
    expect(found, `Tokens with BTS family keys leaked: ${JSON.stringify(found)}`).toEqual([]);
  });

  it('waystone-desecrated.json: every token familyKey is NOT in WAYSTONE_IMPLICIT_SET_FAMILY_KEYS', () => {
    const data = loadJson('waystone-desecrated.json');
    const btsKeys = new Set(WAYSTONE_IMPLICIT_SET_FAMILY_KEYS.map(normalizeKey));
    const leaking = data.tokens.filter(t => {
      const fk = t.familyKey?.ru;
      if (typeof fk !== 'string') return false;
      return btsKeys.has(normalizeKey(fk));
    });
    const found = leaking.map(t => ({ id: t.id, fk: t.familyKey!.ru }));
    expect(found, `Tokens with BTS family keys leaked: ${JSON.stringify(found)}`).toEqual([]);
  });
});
