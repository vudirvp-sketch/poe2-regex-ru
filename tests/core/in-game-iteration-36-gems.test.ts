/**
 * In-Game Test Results — Iteration 36 (Gems)
 *
 * Tests based on REAL in-game gem items (uploaded by user 2026-06-16).
 * Source file: предметы для теста с аффиксами имплиситами_новый.md
 * Items: 4 Изумрудных самоцвета (ilvl 28-82) with various damage/utility mods.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * GOALS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. Verify known-working PoE2 regex patterns on REAL gem items
 *    (single-mod suffix, .* bridge, AND across blocks, single-word |).
 *
 * 2. Establish a DETERMINISTIC REGEX STRATEGY for gems that:
 *    - Uses ONLY verified-working patterns
 *    - Produces unique regex per mod (no FP)
 *    - Does NOT rely on multi-word `|` (confirmed broken — Tests 15-17)
 *    - Is UNIFIED across all categories (gems, rings, amulets, belts, etc.)
 *
 * 3. Document cross-block FP risk and how to mitigate it.
 *
 * 4. Probe the B0 hypothesis (OR between quoted groups) — PENDING in-game.
 *    In our simulator, `"X"|"Y"` parses as `"X"` AND `(|Y)` = `"X"` only.
 *    In-game behavior is UNKNOWN — needs Test B0 to verify.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DETERMINISTIC REGEX STRATEGY (unified for all categories)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Principle 1: ONE MOD = ONE QUOTED GROUP
 *   Each selected mod produces exactly ONE quoted group containing:
 *   - Optional number pattern (enumeration / threshold / ^/+ / % anchors)
 *   - The mod's distinctive suffix (unique substring)
 *   - `.*` for bridging number → suffix within the same block
 *
 * Principle 2: MULTI-MOD = AND ACROSS BLOCKS
 *   N selected mods → N quoted groups separated by spaces:
 *   `"mod1" "mod2" "mod3"`
 *   Each group must match SOME block (same or different).
 *
 * Principle 3: NO MULTI-WORD `|` (CONFIRMED BROKEN)
 *   - `"A|B"` (whole quoted group is single-word OR) — ✅ works
 *   - `"(A|B)"` (single-word OR inside parens) — ✅ works alone
 *   - `"prefix (A|B)"` (alternation after prefix inside quotes) — ❌ BROKEN
 *   - `"(A B|C D)"` (multi-word alternation in parens) — ❌ BROKEN
 *   - `"A B|C D"` (multi-word alternation at top level) — ❌ BROKEN
 *
 * Principle 4: `.*` BRIDGING WITHIN SINGLE BLOCK
 *   When mod has structure `prefix N suffix`, use:
 *   `"prefix.*suffix"` — `.*` bridges the number within the SAME block.
 *   Example: `"увеличение урона.*луками"` matches "15% увеличение урона луками".
 *
 * Principle 5: SUFFIX UNIQUENESS
 *   For each mod, find the SHORTEST suffix that:
 *   - Matches the mod's rawText (substring search)
 *   - Does NOT match any OTHER mod's rawText in the same category
 *   - Has ≥3 significant chars per truncated word
 *   - Truncation only at END of suffix (contiguous substring property)
 *
 * Principle 6: SHARED SUFFIX → DIFFERENTIATE BY NUMBER OR CONTEXT
 *   If two mods share the same suffix (e.g., "порога стихийных состояний"),
 *   differentiate by:
 *   - Number range: `"(1[0-5])%.*порога стихийных состояний"`
 *   - Per-block exclusion: `"порога стихийных состояний"` (match any, accept FP)
 *   - OR: accept that the regex matches BOTH mods (when user wants EITHER)
 *
 * Principle 7: CROSS-BLOCK FP RISK
 *   `"X" "Y"` (AND across blocks) can match items where X and Y appear in
 *   DIFFERENT blocks (different mod lines). To prevent FP:
 *   - Use `.*` bridge in ONE quoted group: `"X.*Y"` (same-block guarantee)
 *   - OR: make each quoted group as specific as possible (full suffix, not
 *     truncated) to reduce chance of matching unintended blocks.
 *
 * Principle 8: SAME-FAMILY OR (multiple weapon damage mods)
 *   When user wants ANY of N mods from the same family (e.g., damage with
 *   different weapons), the ONLY working approaches are:
 *   a. Generate N separate quoted groups with `.*` bridge, connect via
 *      top-level `|` IF Test B0 confirms it works: `"X.*A"|"X.*B"`
 *      (CURRENTLY UNVERIFIED — simulator treats this as `"X.*A"` only)
 *   b. UI redesign: each same-family mod becomes a SEPARATE AND filter
 *      (mutually exclusive choice in UI, not OR in regex)
 *   c. Fall back to AND (user must accept that selecting multiple
 *      same-family mods requires ALL to be present, not ANY)
 *
 *   The opt-table's current approach (`"X (A|B|C)"`) is BROKEN and must be
 *   replaced by one of the above strategies.
 */
import { describe, it, expect } from 'vitest';
import {
  matchPoE2RegexItem,
  type GameItemText,
} from '@core/poe2-regex-matcher';

// ═══════════════════════════════════════════════════════════════════════════
// REAL IN-GAME GEM ITEMS (from предметы для теста с аффиксами имплиситами_новый.md)
// ═══════════════════════════════════════════════════════════════════════════

/** Gem 1: Племенная лучина — Изумруд, ilvl 82
 *  Mods: оберег duration, посохи damage, DoT duration, отравл strength */
const plemennayaLuchina: GameItemText = {
  name: 'Племенная лучина',
  type: 'Изумруд',
  properties: ['Самоцвет', 'Уровень предмета: 82'],
  mods: [
    '11% увеличение длительности эффекта оберега',
    '15% увеличение урона боевыми посохами',
    '9% увеличение длительности наносящих урон состояний на врагах',
    '7% увеличение силы накладываемого вами отравл',
  ],
};

/** Gem 2: Гипнотическая сущность — Изумруд, ilvl 65
 *  Mods: crit с атаками, луками damage, снаряд split, компаньон health */
const gipnoticheskayaSushchnost: GameItemText = {
  name: 'Гипнотическая сущность',
  type: 'Изумруд',
  properties: ['Самоцвет', 'Уровень предмета: 65'],
  mods: [
    '7% повышение шанса критического удара атаками',
    '6% увеличение урона луками',
    'Снаряды имеют 10% шанс выпустить дополнительный снаряд при разветвлении',
    '19% увеличение максимума здоровья компаньонов',
  ],
};

/** Gem 3: Племенной узор — Изумруд, ilvl 28
 *  Mods: глобальная меткость, снарядов damage, наложения состояний, порог стихийных состояний */
const plemennoiUzor: GameItemText = {
  name: 'Племенной узор',
  type: 'Изумруд',
  properties: ['Самоцвет', 'Уровень предмета: 28'],
  mods: [
    '6% повышение глобальной меткости',
    '10% увеличение урона снарядов',
    '10% увеличение шанса наложения состояний',
    '10% увеличение порога стихийных состояний',
  ],
};

/** Gem 4: Почётная мечта — Изумруд, ilvl 81
 *  Mods: посохи attack speed, порог стихийных состояний, снарядами conditional damage */
const plemennayaMechta: GameItemText = {
  name: 'Почётная мечта',
  type: 'Изумруд',
  properties: ['Самоцвет', 'Уровень предмета: 81'],
  mods: [
    '2% повышение скорости атаки боевыми посохами',
    '12% увеличение порога стихийных состояний',
    '20% увеличение урона снарядами, если за последние восемь секунд вы наносили удар в ближнем бою',
  ],
};

const allGems: GameItemText[] = [
  plemennayaLuchina,
  gipnoticheskayaSushchnost,
  plemennoiUzor,
  plemennayaMechta,
];

// ═══════════════════════════════════════════════════════════════════════════
// D1. SINGLE-MOD SUFFIX MATCHING (deterministic, no FP)
// ═══════════════════════════════════════════════════════════════════════════

describe('D1. Single-mod suffix matching — deterministic unique substrings', () => {
  // Each mod has a distinctive suffix that uniquely identifies it within the gem category.
  // These regexes are the building blocks of the deterministic strategy.

  it('Племенная лучина: "длительности эффекта оберега" matches gem 1', () => {
    expect(matchPoE2RegexItem('"длительности эффекта оберега"', plemennayaLuchina)).toBe(true);
  });

  it('Племенная лучина: "длительности эффекта оберега" does NOT match other gems', () => {
    expect(matchPoE2RegexItem('"длительности эффекта оберега"', gipnoticheskayaSushchnost)).toBe(false);
    expect(matchPoE2RegexItem('"длительности эффекта оберега"', plemennoiUzor)).toBe(false);
    expect(matchPoE2RegexItem('"длительности эффекта оберега"', plemennayaMechta)).toBe(false);
  });

  it('Гипнотическая сущность: "максимума здоровья компаньонов" matches gem 2', () => {
    expect(matchPoE2RegexItem('"максимума здоровья компаньонов"', gipnoticheskayaSushchnost)).toBe(true);
  });

  it('Гипнотическая сущность: "максимума здоровья компаньонов" does NOT match other gems', () => {
    expect(matchPoE2RegexItem('"максимума здоровья компаньонов"', plemennayaLuchina)).toBe(false);
    expect(matchPoE2RegexItem('"максимума здоровья компаньонов"', plemennoiUzor)).toBe(false);
    expect(matchPoE2RegexItem('"максимума здоровья компаньонов"', plemennayaMechta)).toBe(false);
  });

  it('Племенной узор: "глобальной меткости" matches gem 3 only', () => {
    expect(matchPoE2RegexItem('"глобальной меткости"', plemennoiUzor)).toBe(true);
    expect(matchPoE2RegexItem('"глобальной меткости"', plemennayaLuchina)).toBe(false);
    expect(matchPoE2RegexItem('"глобальной меткости"', gipnoticheskayaSushchnost)).toBe(false);
    expect(matchPoE2RegexItem('"глобальной меткости"', plemennayaMechta)).toBe(false);
  });

  it('Племенной узор: "шанса наложения состояний" matches gem 3 only', () => {
    expect(matchPoE2RegexItem('"шанса наложения состояний"', plemennoiUzor)).toBe(true);
    expect(matchPoE2RegexItem('"шанса наложения состояний"', plemennayaLuchina)).toBe(false);
    expect(matchPoE2RegexItem('"шанса наложения состояний"', gipnoticheskayaSushchnost)).toBe(false);
    expect(matchPoE2RegexItem('"шанса наложения состояний"', plemennayaMechta)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D2. `.*` BRIDGING WITHIN SINGLE BLOCK
// ═══════════════════════════════════════════════════════════════════════════

describe('D2. `.*` bridging within single block — weapon-specific mods', () => {
  // Weapon-specific damage mods have structure: "увеличение урона <weapon>"
  // The `.*` bridges the number and any middle words within ONE block.
  // This is the deterministic replacement for broken `"X (A|B|C)"` opt-table patterns.

  it('Племенная лучина: "увеличение урона.*посохами" matches (боевыми посохами)', () => {
    // Mod text: "15% увеличение урона боевыми посохами"
    // `.*` bridges "увеличение урона" → "боевыми" → "посохами"
    expect(matchPoE2RegexItem('"увеличение урона.*посохами"', plemennayaLuchina)).toBe(true);
  });

  it('Гипнотическая сущность: "увеличение урона.*луками" matches', () => {
    // Mod text: "6% увеличение урона луками"
    expect(matchPoE2RegexItem('"увеличение урона.*луками"', gipnoticheskayaSushchnost)).toBe(true);
  });

  it('Cross-weapon FP check: "увеличение урона.*луками" does NOT match посохами gem', () => {
    // Племенная лучина has "посохами", not "луками" — must NOT match
    expect(matchPoE2RegexItem('"увеличение урона.*луками"', plemennayaLuchina)).toBe(false);
  });

  it('Cross-weapon FP check: "увеличение урона.*посохами" does NOT match луками gem', () => {
    expect(matchPoE2RegexItem('"увеличение урона.*посохами"', gipnoticheskayaSushchnost)).toBe(false);
  });

  it('Почётная мечта: "скорости атаки.*посохами" matches (боевыми посохами)', () => {
    // Mod text: "2% повышение скорости атаки боевыми посохами"
    // `.*` bridges "скорости атаки" → "боевыми" → "посохами"
    expect(matchPoE2RegexItem('"скорости атаки.*посохами"', plemennayaMechta)).toBe(true);
  });

  it('Truncated suffix variant: "увеличение урона.*лук" matches луками (substring)', () => {
    // PoE2 = substring search, so "лук" matches "луками"
    expect(matchPoE2RegexItem('"увеличение урона.*лук"', gipnoticheskayaSushchnost)).toBe(true);
  });

  it('Long bridge: "Снаряды.*дополнительный снаряд" matches within one block', () => {
    // Mod text: "Снаряды имеют 10% шанс выпустить дополнительный снаряд при разветвлении"
    // `.*` bridges "Снаряды" → ... → "дополнительный снаряд" within ONE block
    expect(matchPoE2RegexItem('"Снаряды.*дополнительный снаряд"', gipnoticheskayaSushchnost)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D3. AND ACROSS BLOCKS (multi-mod selection)
// ═══════════════════════════════════════════════════════════════════════════

describe('D3. AND across blocks — multi-mod selection', () => {
  // When user selects multiple mods, the regex is N quoted groups joined by spaces.
  // Each group must match SOME block (possibly different blocks).

  it('Two mods on same gem: "длительности эффекта оберега" "увеличение урона.*посохами" → MATCH', () => {
    // Племенная лучина has both mods in SEPARATE blocks
    expect(
      matchPoE2RegexItem('"длительности эффекта оберега" "увеличение урона.*посохами"', plemennayaLuchina)
    ).toBe(true);
  });

  it('AND is order-independent: "посохами" "оберега" → MATCH', () => {
    // Truncated suffixes, both match the same gem
    expect(matchPoE2RegexItem('"посохами" "оберега"', plemennayaLuchina)).toBe(true);
  });

  it('AND across blocks: "глобальной меткости" "порога стихийных состояний" → MATCH (gem 3)', () => {
    // Племенной узор has both mods in separate blocks
    expect(
      matchPoE2RegexItem('"глобальной меткости" "порога стихийных состояний"', plemennoiUzor)
    ).toBe(true);
  });

  it('AND rejects items missing any mod: "глобальной меткости" "луками" → NO MATCH (gem 3)', () => {
    // Племенной узор has "глобальной меткости" but NOT "луками"
    expect(matchPoE2RegexItem('"глобальной меткости" "луками"', plemennoiUzor)).toBe(false);
  });

  it('Three mods on gem 2: "критического удара атаками" "луками" "компаньонов" → MATCH', () => {
    expect(
      matchPoE2RegexItem(
        '"критического удара атаками" "луками" "компаньонов"',
        gipnoticheskayaSushchnost
      )
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D4. CROSS-BLOCK FP RISK DEMONSTRATION
// ═══════════════════════════════════════════════════════════════════════════

describe('D4. Cross-block FP risk — AND with short substrings', () => {
  // When quoted groups are short substrings, they may match DIFFERENT mod blocks,
  // causing false positives. This is the key risk of AND across blocks.

  it('FP RISK: "увеличение урона" "луками" — both match DIFFERENT blocks → still MATCH', () => {
    // Гипнотическая сущность:
    //   - "6% увеличение урона луками" (same block) → both match this block ✅
    // This is NOT a FP — both substrings happen to be in the same block here.
    expect(matchPoE2RegexItem('"увеличение урона" "луками"', gipnoticheskayaSushchnost)).toBe(true);
  });

  it('FP DEMONSTRATION: "увеличение" "меткости" — matches gem 3 via DIFFERENT blocks', () => {
    // Племенной узор:
    //   - "10% увеличение урона снарядов" → matches "увеличение"
    //   - "6% повышение глобальной меткости" → matches "меткости"
    // The regex matches, but the user wanted ONE mod containing both words.
    // This is a FP if the user wanted "увеличение меткости" (which doesn't exist).
    expect(matchPoE2RegexItem('"увеличение" "меткости"', plemennoiUzor)).toBe(true);
  });

  it('FP PREVENTION via `.*` bridge: "увеличение.*меткости" — does NOT match gem 3', () => {
    // Same intent as above, but using `.*` bridge forces SAME-BLOCK match.
    // Племенной узор has NO block containing both "увеличение" and "меткости".
    expect(matchPoE2RegexItem('"увеличение.*меткости"', plemennoiUzor)).toBe(false);
  });

  it('FP PREVENTION via `.*` bridge: "повышение.*меткости" — matches gem 3 (same block)', () => {
    // Племенной узор has "6% повышение глобальной меткости" — both words in ONE block.
    expect(matchPoE2RegexItem('"повышение.*меткости"', plemennoiUzor)).toBe(true);
  });

  it('FP DEMONSTRATION: "снаряд" "состояний" — matches via DIFFERENT blocks', () => {
    // Племенной узор:
    //   - "10% увеличение урона снарядов" → matches "снаряд"
    //   - "10% увеличение шанса наложения состояний" → matches "состояний"
    // FP: user wanted one mod with both words, but they're in different mods.
    expect(matchPoE2RegexItem('"снаряд" "состояний"', plemennoiUzor)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D5. SHARED SUFFIX BETWEEN ITEMS — differentiation strategies
// ═══════════════════════════════════════════════════════════════════════════

describe('D5. Shared suffix between items — differentiate by number', () => {
  // "порога стихийных состояний" appears in BOTH Племенной узор (10%) and Почётная мечта (12%).
  // The suffix alone matches both — to differentiate, use number patterns.

  it('Shared suffix matches BOTH gems: "порога стихийных состояний"', () => {
    expect(matchPoE2RegexItem('"порога стихийных состояний"', plemennoiUzor)).toBe(true);
    expect(matchPoE2RegexItem('"порога стихийных состояний"', plemennayaMechta)).toBe(true);
  });

  it('Differentiate by number: "10%.*порога стихийных состояний" → gem 3 only', () => {
    // Exact number "10%" anchors to gem 3 (Племенной узор)
    expect(matchPoE2RegexItem('"10%.*порога стихийных состояний"', plemennoiUzor)).toBe(true);
    expect(matchPoE2RegexItem('"10%.*порога стихийных состояний"', plemennayaMechta)).toBe(false);
  });

  it('Differentiate by number: "12%.*порога стихийных состояний" → gem 4 only', () => {
    expect(matchPoE2RegexItem('"12%.*порога стихийных состояний"', plemennayaMechta)).toBe(true);
    expect(matchPoE2RegexItem('"12%.*порога стихийных состояний"', plemennoiUzor)).toBe(false);
  });

  it('Number enumeration: "(1[0-5])%.*порога стихийных состояний" → matches BOTH (10% and 12%)', () => {
    // Enumeration [0-5] after "1" matches 10, 11, 12, 13, 14, 15 — both gems pass.
    // This is the "shared regex" for the family — matches ANY tier of the mod.
    expect(matchPoE2RegexItem('"(1[0-5])%.*порога стихийных состояний"', plemennoiUzor)).toBe(true);
    expect(matchPoE2RegexItem('"(1[0-5])%.*порога стихийных состояний"', plemennayaMechta)).toBe(true);
  });

  it('Number enumeration excludes out-of-range: "12[5-9]%.*порога" → matches NEITHER', () => {
    // 125-129% range — neither gem has this value
    expect(matchPoE2RegexItem('"12[5-9]%.*порога"', plemennoiUzor)).toBe(false);
    expect(matchPoE2RegexItem('"12[5-9]%.*порога"', plemennayaMechta)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D6. SINGLE-WORD `|` (verified working — whole quoted group is alternation)
// ═══════════════════════════════════════════════════════════════════════════

describe('D6. Single-word `|` as whole quoted group — verified working', () => {
  // `"A|B"` where A and B are SINGLE words works in PoE2 (verified in-game).
  // This is the ONLY form of `|` that reliably works.

  it('"луками|посохами" matches gem 1 (посохами) AND gem 2 (луками)', () => {
    expect(matchPoE2RegexItem('"луками|посохами"', plemennayaLuchina)).toBe(true);
    expect(matchPoE2RegexItem('"луками|посохами"', gipnoticheskayaSushchnost)).toBe(true);
  });

  it('"луками|посохами" does NOT match gem 3 (no weapon damage mod)', () => {
    // Gem 3 (Племенной узор) has no "луками" or "посохами" anywhere
    expect(matchPoE2RegexItem('"луками|посохами"', plemennoiUzor)).toBe(false);
  });

  it('"луками|посохами" DOES match gem 4 (has "посохами" via "скорости атаки боевыми посохами")', () => {
    // Gem 4 has "2% повышение скорости атаки боевыми посохами" — contains "посохами"
    expect(matchPoE2RegexItem('"луками|посохами"', plemennayaMechta)).toBe(true);
  });

  it('"оберег|компаньон" matches gem 1 (оберег) AND gem 2 (компаньон)', () => {
    // Truncated stems — single-word OR
    expect(matchPoE2RegexItem('"оберег|компаньон"', plemennayaLuchina)).toBe(true);
    expect(matchPoE2RegexItem('"оберег|компаньон"', gipnoticheskayaSushchnost)).toBe(true);
  });

  it('Single-word OR inside parens: "(луками|посохами)" — works as whole quoted group', () => {
    // Documented as working in IN_GAME_TESTS.md
    expect(matchPoE2RegexItem('"(луками|посохами)"', plemennayaLuchina)).toBe(true);
    expect(matchPoE2RegexItem('"(луками|посохами)"', gipnoticheskayaSushchnost)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D7. BROKEN PATTERNS — multi-word `|` (confirm simulator matches broken game behavior)
// ═══════════════════════════════════════════════════════════════════════════

describe('D7. Broken patterns — multi-word `|` (Tests 15-17 confirmed broken in-game)', () => {
  // These patterns are CONFIRMED BROKEN in the actual game (Tests 15-17).
  // Our simulator may or may not reproduce the broken behavior — these tests
  // document what the simulator does, so we know what to expect.

  it('SIMULATOR: "увеличение урона (луками|посохами)" — requires exact adjacency', () => {
    // Pattern: literal "увеличение урона " + group(луками | посохами)
    // Simulator parses correctly but requires "луками" or "посохами" IMMEDIATELY
    // after "увеличение урона " (no `.*` to bridge over "боевыми").
    //
    // Gem 1 mod: "15% увеличение урона боевыми посохами"
    //   - "увеличение урона " matches, but next word is "боевыми", not "луками"/"посохами"
    //   - NO MATCH in simulator
    //
    // Gem 2 mod: "6% увеличение урона луками"
    //   - "увеличение урона " matches, next word IS "луками" → MATCH
    //
    // In the GAME (Test 16): matches EVERYTHING with "увеличение" — `()` + `|` ignored.
    //
    // SIMULATOR AND GAME DIVERGE:
    //   - Simulator: gem 1 NO MATCH (correct regex), gem 2 MATCH (exact adjacency)
    //   - Game: matches too broadly (both gems match, plus FP on any "увеличение")
    // Pattern is UNUSABLE — game behavior is broken.
    expect(matchPoE2RegexItem('"увеличение урона (луками|посохами)"', plemennayaLuchina)).toBe(false);
    expect(matchPoE2RegexItem('"увеличение урона (луками|посохами)"', gipnoticheskayaSushchnost)).toBe(true);
    // CRITICAL: Do NOT use this pattern in production — broken in-game!
  });

  it('SIMULATOR: "(увеличение урона луками|увеличение урона посохами)" — requires exact adjacency', () => {
    // Pattern: group( "увеличение урона луками" | "увеличение урона посохами" )
    // Simulator parses as alternation of two literal sequences.
    //   - For gem 1: "увеличение урона" matches, but "боевыми" follows, not "луками"/"посохами"
    //   - For gem 2: "увеличение урона луками" matches exactly ✅
    //
    // In the GAME (Test 15): `()` with multi-word `|` → NOTHING matches.
    //
    // SIMULATOR AND GAME DIFFER on gem 2:
    //   - Simulator: gem 2 matches (exact literal substring)
    //   - Game: gem 2 does NOT match (`()` + multi-word `|` broken)
    // Pattern is UNUSABLE in production.
    expect(
      matchPoE2RegexItem('"(увеличение урона луками|увеличение урона посохами)"', plemennayaLuchina)
    ).toBe(false); // gem 1 has "боевыми" between — no exact match
    expect(
      matchPoE2RegexItem('"(увеличение урона луками|увеличение урона посохами)"', gipnoticheskayaSushchnost)
    ).toBe(true); // gem 2 has exact "увеличение урона луками" substring
    // CRITICAL: Do NOT use this pattern in production — broken in-game!
  });

  it('SIMULATOR: "увеличение урона.*луками|увеличение урона.*посохами" — top-level multi-word `|`', () => {
    // Pattern: ONE quoted group with `|` at top level (multi-word alternatives).
    // Simulator parses as alternation: "увеличение урона.*луками" | "увеличение урона.*посохами"
    //   - For gem 1: second alt matches "увеличение урона боевыми посохами" via `.*` ✅
    //   - For gem 2: first alt matches "увеличение урона луками" via `.*` ✅
    //
    // In the GAME (Tests 9-11): top-level multi-word `|` → BROKEN.
    //
    // SIMULATOR AND GAME DIVERGE:
    //   - Simulator: both gems match (correct regex semantics)
    //   - Game: BROKEN — neither matches, or only prefix matches
    // Pattern is UNUSABLE in production.
    expect(
      matchPoE2RegexItem('"увеличение урона.*луками|увеличение урона.*посохами"', plemennayaLuchina)
    ).toBe(true);
    expect(
      matchPoE2RegexItem('"увеличение урона.*луками|увеличение урона.*посохами"', gipnoticheskayaSushchnost)
    ).toBe(true);
    // CRITICAL: Do NOT use this pattern in production — broken in-game!
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D8. B0 HYPOTHESIS — OR between quoted groups (PENDING in-game verification)
// ═══════════════════════════════════════════════════════════════════════════

describe('D8. B0 hypothesis — OR between quoted groups (PENDING in-game)', () => {
  // The CRITICAL unverified test: does `"X"|"Y"` work as OR between two quoted groups?
  //
  // In our SIMULATOR:
  //   parseQuotedGroups splits on SPACES outside quotes, NOT on `|`.
  //   So `"A B"|"C D"` (no spaces around `|`) becomes ONE group: `A B` + `|C D`
  //   Wait — let me re-trace: `"A"|"B"` → groups = [`A`, `|B`] (split happens at `"`)
  //   Then group 2 `|B` parses as alternation: empty | `b` → always matches.
  //   Result: `"A"|"B"` = `A` AND `(|B)` = `A` only.
  //
  // In the GAME:
  //   UNKNOWN — Test B0 has not been run yet.
  //   If the game parses `|` between quoted groups as top-level OR, this works.
  //   If the game tokenizes on spaces first (like the simulator), this fails.
  //
  // These tests document the SIMULATOR's behavior. In-game verification is PENDING.

  it('SIMULATOR: "увеличение урона.*луками"|"увеличение урона.*посохами" → matches ONLY gem 2 (луками)', () => {
    // Simulator parses as: group1="увеличение урона.*луками", group2="|увеличение урона.*посохами"
    // group2 always matches (empty alternative). Result: only group1 is checked.
    // - Gem 2 (луками): group1 matches ✅
    // - Gem 1 (посохами): group1 does NOT match ❌
    expect(
      matchPoE2RegexItem(
        '"увеличение урона.*луками"|"увеличение урона.*посохами"',
        gipnoticheskayaSushchnost
      )
    ).toBe(true);
    expect(
      matchPoE2RegexItem(
        '"увеличение урона.*луками"|"увеличение урона.*посохами"',
        plemennayaLuchina
      )
    ).toBe(false);
    // ⚠️ IN-GAME: if `|` between quoted groups works as OR, BOTH gems would match.
    //    If it works like the simulator (AND with always-true second group),
    //    only gem 2 matches. Test B0 will tell.
  });

  it('SIMULATOR: "оберег"|"компаньон" → matches ONLY gem 1 (оберег)', () => {
    // Same parsing: group1="оберег", group2="|компаньон" (always matches).
    // Result: only checks "оберег".
    expect(matchPoE2RegexItem('"оберег"|"компаньон"', plemennayaLuchina)).toBe(true);
    expect(matchPoE2RegexItem('"оберег"|"компаньон"', gipnoticheskayaSushchnost)).toBe(false);
    // ⚠️ IN-GAME: if `|` works as OR, BOTH gems would match.
  });

  it('SIMULATOR: "глобальной меткости"|"максимума здоровья компаньонов" → matches ONLY gem 3', () => {
    expect(
      matchPoE2RegexItem('"глобальной меткости"|"максимума здоровья компаньонов"', plemennoiUzor)
    ).toBe(true);
    expect(
      matchPoE2RegexItem('"глобальной меткости"|"максимума здоровья компаньонов"', gipnoticheskayaSushchnost)
    ).toBe(false);
    // ⚠️ IN-GAME: if `|` works as OR, BOTH gems would match.
  });

  it('B0 TEST PROTOCOL (run in-game, then update this test):', () => {
    // Test these regexes IN-GAME with the 4 gems:
    //
    // 1. "увеличение урона.*луками"|"увеличение урона.*посохами"
    //    Expected if OR works: gems 1 AND 2 highlight
    //    Expected if OR broken: only gem 2 highlights (simulator behavior)
    //
    // 2. "оберег"|"компаньон"
    //    Expected if OR works: gems 1 AND 2 highlight
    //    Expected if OR broken: only gem 1 highlights
    //
    // 3. "глобальной меткости"|"максимума здоровья компаньонов"
    //    Expected if OR works: gems 2 AND 3 highlight
    //    Expected if OR broken: only gem 3 highlights
    //
    // After running, update this test file with actual in-game results.
    // If OR works → Path B strategy: decompose opt-table to quoted groups in OR.
    // If OR broken → UI redesign: each OR-child = separate AND filter.
    expect(true).toBe(true); // placeholder — replace with actual in-game results
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D9. NUMBER PATTERNS — enumeration, threshold, anchors
// ═══════════════════════════════════════════════════════════════════════════

describe('D9. Number patterns — enumeration, threshold, anchors', () => {
  // Number patterns are verified working (Iteration 13 — all 9 pattern types verified).
  // These tests confirm they work on real gem items.

  it('Enumeration: "(1[0-5])%.*длительности эффекта оберега" → matches gem 1 (11%)', () => {
    // 11% is in range 10-15 → matches
    expect(matchPoE2RegexItem('"(1[0-5])%.*длительности эффекта оберега"', plemennayaLuchina)).toBe(true);
  });

  it('Enumeration excludes out-of-range: "([5-9])%.*длительности эффекта оберега" → NO MATCH (11%)', () => {
    // 11% is NOT in range 5-9 → no match
    expect(matchPoE2RegexItem('"([5-9])%.*длительности эффекта оберега"', plemennayaLuchina)).toBe(false);
  });

  it('Threshold ≥10: "(1[0-9]|[2-9][0-9])%.*увеличение урона.*посохами" → matches gem 1 (15%)', () => {
    // 15% ≥ 10 → matches
    expect(
      matchPoE2RegexItem('"(1[0-9]|[2-9][0-9])%.*увеличение урона.*посохами"', plemennayaLuchina)
    ).toBe(true);
  });

  it('Threshold ≥20: "([2-9][0-9])%.*увеличение урона.*посохами" → NO MATCH (15%)', () => {
    // 15% < 20 → no match
    expect(
      matchPoE2RegexItem('"([2-9][0-9])%.*увеличение урона.*посохами"', plemennayaLuchina)
    ).toBe(false);
  });

  it('Exact number: "2%.*скорости атаки.*посохами" → matches gem 4 only', () => {
    expect(matchPoE2RegexItem('"2%.*скорости атаки.*посохами"', plemennayaMechta)).toBe(true);
    expect(matchPoE2RegexItem('"2%.*скорости атаки.*посохами"', plemennayaLuchina)).toBe(false);
  });

  it('`^` anchor: "^2%.*скорости атаки" → matches gem 4 (block starts with "2%")', () => {
    // Mod block: "2% повышение скорости атаки боевыми посохами"
    // `^2%` anchors to start of block
    expect(matchPoE2RegexItem('"^2%.*скорости атаки"', plemennayaMechta)).toBe(true);
  });

  it('`^` anchor rejects mid-block number: "^15%.*скорости атаки" → NO MATCH (gem 4)', () => {
    // Gem 4's block starts with "2%", not "15%" — anchor fails
    expect(matchPoE2RegexItem('"^15%.*скорости атаки"', plemennayaMechta)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D10. TRUNCATED STEMS — verified-safe morpheme truncations
// ═══════════════════════════════════════════════════════════════════════════

describe('D10. Truncated stems — end-of-suffix truncation (verified safe)', () => {
  // PoE2 = substring search. Truncating the END of a word works if the truncated
  // form is unique (no FP on other mods/items).

  it('"оберег" matches "оберега" (genitive) — gem 1', () => {
    expect(matchPoE2RegexItem('"оберег"', plemennayaLuchina)).toBe(true);
  });

  it('"компаньон" matches "компаньонов" (plural) — gem 2', () => {
    expect(matchPoE2RegexItem('"компаньон"', gipnoticheskayaSushchnost)).toBe(true);
  });

  it('"снаряд" matches both "снарядов" (gem 3) and "снарядами" (gem 4)', () => {
    // Truncated stem matches all declined forms
    expect(matchPoE2RegexItem('"снаряд"', plemennoiUzor)).toBe(true); // "снарядов"
    expect(matchPoE2RegexItem('"снаряд"', plemennayaMechta)).toBe(true); // "снарядами"
  });

  it('"посох" matches "посохами" (instrumental) — gems 1 and 4', () => {
    expect(matchPoE2RegexItem('"посох"', plemennayaLuchina)).toBe(true); // "посохами"
    expect(matchPoE2RegexItem('"посох"', plemennayaMechta)).toBe(true); // "посохами"
  });

  it('"меткости" full form is more precise than truncated "меткост"', () => {
    // "меткости" matches only gems with this exact word form
    expect(matchPoE2RegexItem('"меткости"', plemennoiUzor)).toBe(true); // "глобальной меткости"
    // Other gems don't have "меткости" at all
    expect(matchPoE2RegexItem('"меткости"', plemennayaLuchina)).toBe(false);
    expect(matchPoE2RegexItem('"меткости"', gipnoticheskayaSushchnost)).toBe(false);
    expect(matchPoE2RegexItem('"меткости"', plemennayaMechta)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D11. COMBINED MOD REGEX — full deterministic pattern per mod
// ═══════════════════════════════════════════════════════════════════════════

describe('D11. Combined mod regex — full deterministic pattern per mod', () => {
  // For each mod, the deterministic regex is:
  //   "<number_pattern>.*<suffix>"
  // where number_pattern uses enumeration/threshold/anchors, and suffix is unique.

  it('Gem 1 mod 1: "11%.*длительности эффекта оберега" — full deterministic regex', () => {
    expect(matchPoE2RegexItem('"11%.*длительности эффекта оберега"', plemennayaLuchina)).toBe(true);
    // Does NOT match other gems (no such mod)
    expect(matchPoE2RegexItem('"11%.*длительности эффекта оберега"', gipnoticheskayaSushchnost)).toBe(false);
    expect(matchPoE2RegexItem('"11%.*длительности эффекта оберега"', plemennoiUzor)).toBe(false);
    expect(matchPoE2RegexItem('"11%.*длительности эффекта оберега"', plemennayaMechta)).toBe(false);
  });

  it('Gem 1 mod 2: "15%.*увеличение урона.*посохами" — full deterministic regex', () => {
    expect(matchPoE2RegexItem('"15%.*увеличение урона.*посохами"', plemennayaLuchina)).toBe(true);
    // Does NOT match gem 4 (has "2% скорость атаки посохами", different mod)
    expect(matchPoE2RegexItem('"15%.*увеличение урона.*посохами"', plemennayaMechta)).toBe(false);
  });

  it('Gem 4 mod 1: "2%.*скорости атаки.*посохами" — full deterministic regex', () => {
    expect(matchPoE2RegexItem('"2%.*скорости атаки.*посохами"', plemennayaMechta)).toBe(true);
    // Does NOT match gem 1 (has "15% увеличение урона посохами", different mod)
    expect(matchPoE2RegexItem('"2%.*скорости атаки.*посохами"', plemennayaLuchina)).toBe(false);
  });

  it('Gem 2 mod 4: "19%.*максимума здоровья компаньонов" — full deterministic regex', () => {
    expect(
      matchPoE2RegexItem('"19%.*максимума здоровья компаньонов"', gipnoticheskayaSushchnost)
    ).toBe(true);
    // No other gem has this mod
    expect(
      matchPoE2RegexItem('"19%.*максимума здоровья компаньонов"', plemennayaLuchina)
    ).toBe(false);
    expect(
      matchPoE2RegexItem('"19%.*максимума здоровья компаньонов"', plemennoiUzor)
    ).toBe(false);
    expect(
      matchPoE2RegexItem('"19%.*максимума здоровья компаньонов"', plemennayaMechta)
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D12. ALL GEMS SANITY CHECK — ensure test data is well-formed
// ═══════════════════════════════════════════════════════════════════════════

describe('D12. All gems sanity check', () => {
  it('all 4 gems are loaded', () => {
    expect(allGems).toHaveLength(4);
  });

  it('all 4 gems have at least 3 mods', () => {
    for (const gem of allGems) {
      expect(gem.mods?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('all 4 gems are Изумруд type', () => {
    for (const gem of allGems) {
      expect(gem.type).toBe('Изумруд');
    }
  });

  it('no gem shares the same name', () => {
    const names = allGems.map(g => g.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
