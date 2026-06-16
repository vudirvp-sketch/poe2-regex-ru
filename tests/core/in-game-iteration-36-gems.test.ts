/**
 * In-Game Test Results — Iteration 38 (Gems)
 *
 * Tests based on REAL in-game gem items (uploaded by user 2026-06-16).
 * Source file: предметы для теста с аффиксами имплиситами_новый.md
 * Items: 4 Изумрудных самоцвета (ilvl 28-82) with various damage/utility mods.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IN-GAME VERIFICATION STATUS (updated iter 38)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two CRITICAL findings from iter 37 in-game run (4 gems, 39 user-reported
 * results), confirmed in iter 38:
 *
 * 1. B0 RESOLVED — `"X"|"Y"` (OR between TWO quoted groups) is BROKEN.
 *    All 3 B0 tests gave ZERO matches in-game. The simulator's parsing
 *    (`"X" AND (|Y)` = `"X"` only) is CORRECT in principle, but the game
 *    is even stricter: the `|` between quoted groups breaks the parser
 *    completely and matches NOTHING.
 *
 * 2. D7-3 CONFIRMED WORKING — top-level `|` inside ONE quoted group with
 *    `.*` bridges now works in-game. The PoE2 regex engine was patched
 *    since iterations 15-17. The simulator already models this correctly.
 *    Example: `"увеличение урона.*луками|увеличение урона.*посохами"`
 *    matches BOTH gems in-game (was previously documented as BROKEN).
 *
 * => NEW STRATEGY "Path D": for same-family OR (multi-word alternatives),
 *    use ONE quoted group with top-level `|` and `.*` bridges:
 *      `"prefix.*A|prefix.*B|prefix.*C"`
 *    This REPLACES the broken opt-table pattern `"prefix (A|B|C)"`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DETERMINISTIC REGEX STRATEGY (8 principles, unified for all categories)
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
 * Principle 3: `|` SCOPE — only at TOP LEVEL of a quoted group
 *   - `"A|B"` (top-level `|`, single words) — ✅ works
 *   - `"(A|B)"` (top-level `|` inside `()`, single words) — ✅ works
 *   - `"prefix.*A|prefix.*B"` (top-level `|`, multi-word with `.*`) — ✅ works (Path D, iter 38)
 *   - `"prefix (A|B)"` (`|` after non-`.*` prefix inside `"..."`) — ❌ BROKEN (Test 16)
 *   - `"(A B|C D)"` (`|` between multi-word alternatives inside `()`) — ❌ BROKEN (Test 15)
 *   - `"X"|"Y"` (`|` BETWEEN two quoted groups) — ❌ BROKEN (B0 confirmed iter 38)
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
 * Principle 8: SAME-FAMILY OR (Path D — verified iter 38)
 *   When user wants ANY of N mods from the same family (e.g., damage with
 *   different weapons луками/посохами/копьями), use ONE quoted group with
 *   top-level `|` and `.*` bridge per alternative:
 *     `"prefix.*A|prefix.*B|prefix.*C"`
 *   This is the WORKING replacement for the broken opt-table approach
 *   `"prefix (A|B|C)"` (Tests 16-17).
 *
 *   Status:
 *   - ✅ 2 alternatives verified in-game (D7-3)
 *   - ⚠️ 3+ alternatives: PENDING in-game verification (next iteration)
 *
 *   Fallback options if Path D fails on 3+ alternatives:
 *   b. UI redesign: each same-family mod becomes a SEPARATE AND filter
 *      (mutually exclusive choice in UI, not OR in regex)
 *   c. Fall back to AND (user must accept that selecting multiple
 *      same-family mods requires ALL to be present, not ANY)
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
// D7. `|` PATTERNS — game engine PATCHED since iter 15-17 (iter 38 confirmation)
// ═══════════════════════════════════════════════════════════════════════════

describe('D7. `|` patterns — simulator matches patched game behavior (iter 38)', () => {
  // HISTORY: Tests 15-17 (iter 36) reported these patterns as BROKEN in-game.
  // Iter 37 in-game re-testing on 4 gems showed the PoE2 regex engine was
  // PATCHED — top-level `|` inside ONE quoted group with `.*` bridges now
  // works correctly. The simulator already modeled this correctly.
  //
  // REMAINING BROKEN patterns (Tests 15-17 still apply):
  //   - `"prefix (A|B)"` — `()` + `|` after non-`.*` prefix inside quotes
  //   - `"(A B|C D)"` — multi-word `|` inside `()`
  //
  // Path D (Principle 8) uses ONLY the now-working pattern:
  //   `"prefix.*A|prefix.*B"`

  it('SIMULATOR: "увеличение урона (луками|посохами)" — exact adjacency (still BROKEN in-game)', () => {
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
    // In the GAME (Test 16, iter 36): matches EVERYTHING with "увеличение" — `()` + `|` ignored.
    // Pattern is UNUSABLE — game behavior is broken. Use Path D instead.
    expect(matchPoE2RegexItem('"увеличение урона (луками|посохами)"', plemennayaLuchina)).toBe(false);
    expect(matchPoE2RegexItem('"увеличение урона (луками|посохами)"', gipnoticheskayaSushchnost)).toBe(true);
    // CRITICAL: Do NOT use this pattern in production — broken in-game (Test 16)!
  });

  it('SIMULATOR: "(увеличение урона луками|увеличение урона посохами)" — multi-word in () (still BROKEN in-game)', () => {
    // Pattern: group( "увеличение урона луками" | "увеличение урона посохами" )
    // Simulator parses as alternation of two literal sequences.
    //   - For gem 1: "увеличение урона" matches, but "боевыми" follows, not "луками"/"посохами"
    //   - For gem 2: "увеличение урона луками" matches exactly ✅
    //
    // In the GAME (Test 15, iter 36): `()` with multi-word `|` → NOTHING matches.
    // Pattern is UNUSABLE in production. Use Path D instead.
    expect(
      matchPoE2RegexItem('"(увеличение урона луками|увеличение урона посохами)"', plemennayaLuchina)
    ).toBe(false); // gem 1 has "боевыми" between — no exact match
    expect(
      matchPoE2RegexItem('"(увеличение урона луками|увеличение урона посохами)"', gipnoticheskayaSushchnost)
    ).toBe(true); // gem 2 has exact "увеличение урона луками" substring
    // CRITICAL: Do NOT use this pattern in production — broken in-game (Test 15)!
  });

  it('SIMULATOR: "увеличение урона.*луками|увеличение урона.*посохами" — top-level `|` with `.*` (Path D, CONFIRMED WORKING iter 38)', () => {
    // Pattern: ONE quoted group with top-level `|` and `.*` bridges in each alternative.
    //   - For gem 1: second alt matches "увеличение урона боевыми посохами" via `.*` ✅
    //   - For gem 2: first alt matches "увеличение урона луками" via `.*` ✅
    //
    // In the GAME (iter 37 in-game run, confirmed iter 38): BOTH gems MATCH.
    // The PoE2 regex engine was PATCHED since iter 15-17 — top-level `|`
    // inside ONE quoted group with `.*` bridges now works correctly.
    //
    // This is Path D — the WORKING replacement for the broken opt-table pattern.
    expect(
      matchPoE2RegexItem('"увеличение урона.*луками|увеличение урона.*посохами"', plemennayaLuchina)
    ).toBe(true);
    expect(
      matchPoE2RegexItem('"увеличение урона.*луками|увеличение урона.*посохами"', gipnoticheskayaSushchnost)
    ).toBe(true);
    // ✅ Path D — verified working in-game (2 alternatives). Use this strategy!
    // ⚠️ 3+ alternatives: still PENDING in-game verification (next iteration).
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D8. B0 RESOLVED — OR between quoted groups is BROKEN (iter 38)
// ═══════════════════════════════════════════════════════════════════════════

describe('D8. B0 RESOLVED — `"X"|"Y"` (OR between quoted groups) is BROKEN in-game', () => {
  // The CRITICAL test, now RESOLVED: `"X"|"Y"` does NOT work as OR in-game.
  //
  // Iter 37 in-game run with 4 gems: ALL 3 B0 tests gave ZERO matches.
  // The PoE2 parser breaks completely when it sees `|` between two quoted groups.
  //
  // SIMULATOR behavior (kept for reference): parseQuotedGroups splits on
  // SPACES outside quotes, NOT on `|`. So `"A"|"B"` becomes groups [`A`, `|B`].
  // Group 2 `|B` parses as alternation: empty | `b` → always matches.
  // Result: `"A"|"B"` = `A` AND `(|B)` = `A` only.
  //
  // GAME behavior: ZERO matches. The simulator is "less broken" than the game
  // (simulator matches `"A"`, game matches nothing). Neither gives the desired
  // OR semantics.
  //
  // CONCLUSION: Path A (decompose opt-table to `"X"|"Y"`) is IMPOSSIBLE.
  // Use Path D instead (single quoted group with top-level `|` and `.*` bridges).

  it('SIMULATOR: "увеличение урона.*луками"|"увеличение урона.*посохами" → matches ONLY gem 2 (game: ZERO matches)', () => {
    // Simulator parses as: group1="увеличение урона.*луками", group2="|увеличение урона.*посохами"
    // group2 always matches (empty alternative). Result: only group1 is checked.
    // - Gem 2 (луками): group1 matches ✅
    // - Gem 1 (посохами): group1 does NOT match ❌
    //
    // IN-GAME (iter 37): ZERO matches — `|` between quoted groups breaks the parser.
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
    // ❌ IN-GAME: ZERO matches. Path A is impossible — use Path D instead.
  });

  it('SIMULATOR: "оберег"|"компаньон" → matches ONLY gem 1 (game: ZERO matches)', () => {
    // Same parsing: group1="оберег", group2="|компаньон" (always matches).
    // Result: only checks "оберег".
    expect(matchPoE2RegexItem('"оберег"|"компаньон"', plemennayaLuchina)).toBe(true);
    expect(matchPoE2RegexItem('"оберег"|"компаньон"', gipnoticheskayaSushchnost)).toBe(false);
    // ❌ IN-GAME: ZERO matches.
  });

  it('SIMULATOR: "глобальной меткости"|"максимума здоровья компаньонов" → matches ONLY gem 3 (game: ZERO matches)', () => {
    expect(
      matchPoE2RegexItem('"глобальной меткости"|"максимума здоровья компаньонов"', plemennoiUzor)
    ).toBe(true);
    expect(
      matchPoE2RegexItem('"глобальной меткости"|"максимума здоровья компаньонов"', gipnoticheskayaSushchnost)
    ).toBe(false);
    // ❌ IN-GAME: ZERO matches.
  });

  it('B0 RESOLVED — Path D is the working alternative', () => {
    // Path D replacement for B0-1:
    //   "увеличение урона.*луками|увеличение урона.*посохами" (single quoted group)
    // → matches BOTH gems in-game (verified D7-3 above).
    expect(
      matchPoE2RegexItem(
        '"увеличение урона.*луками|увеличение урона.*посохами"',
        plemennayaLuchina
      )
    ).toBe(true);
    expect(
      matchPoE2RegexItem(
        '"увеличение урона.*луками|увеличение урона.*посохами"',
        gipnoticheskayaSushchnost
      )
    ).toBe(true);
    // ✅ Path D works where B0 fails.
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
