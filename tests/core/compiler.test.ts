import { describe, it, expect } from 'vitest';
import { compile } from '@core/compiler';
import { and, or, exclude, literal, range, multiRange } from '@core/ast';

describe('compile', () => {
  it('compiles a LITERAL', () => {
    expect(compile(literal('цепя'))).toBe('"цепя"');
  });

  it('compiles OR of literals', () => {
    expect(compile(or(literal('огн'), literal('хол')))).toBe('"огн|хол"');
  });

  it('compiles AND of literals', () => {
    expect(compile(and(literal('corr'), literal('m q')))).toBe('"corr" "m q"');
  });

  it('compiles EXCLUDE of literal', () => {
    expect(compile(exclude(literal('проклят')))).toBe('"!проклят"');
  });

  it('compiles EXCLUDE of OR', () => {
    expect(compile(exclude(or(literal('проклят'), literal('сопротивлен'))))).toBe('"!проклят|сопротивлен"');
  });

  it('compiles RANGE with suffix (round10=true)', () => {
    const result = compile(range(40, undefined, 'm q'), { round10: true });
    expect(result).toBe('"([4-9][0-9]|\\d{3,}).*m q"');
  });

  it('compiles AND of RANGE and LITERAL', () => {
    const result = compile(and(range(40, undefined, 'm q'), literal('corr')), { round10: true });
    expect(result).toBe('"([4-9][0-9]|\\d{3,}).*m q" "corr"');
  });

  it('compiles complex: AND(OR, EXCLUDE, RANGE)', () => {
    const result = compile(
      and(
        or(literal('огн'), literal('хол')),
        exclude(literal('проклят')),
        range(40, undefined, 'путев')
      ),
      { round10: true }
    );
    expect(result).toBe('"огн|хол" "!проклят" "([4-9][0-9]|\\d{3,}).*путев"');
  });

  it('returns empty string for empty AND', () => {
    expect(compile(and())).toBe('');
  });

  it('returns empty string for empty OR', () => {
    expect(compile(or())).toBe('');
  });

  it('returns empty string for RANGE with no min/max', () => {
    expect(compile(range())).toBe('');
  });

  // ─── Min+Max RANGE tests ───

  it('compiles RANGE with both min and max (2-digit) — compact enumeration', () => {
    // range(40, 80, 'm q') → single compact enumerated quoted group (Phase 10)
    // Decade grouping: 41 values ≤ MAX_ENUMERATE_RANGE (50), uses compact form
    // round10 is ignored for enumerated ranges — values are always precise
    const result = compile(range(40, 80, 'm q'), { round10: true });
    expect(result).toBe('"(4[0-9]|5[0-9]|6[0-9]|7[0-9]|80).*m q"');
  });

  it('compiles RANGE with both min and max (1-digit) — compact enumeration', () => {
    // range(3, 7) → single character class (Phase 10: compact form)
    const result = compile(range(3, 7), { round10: false });
    expect(result).toBe('"[3-7]"');
  });

  it('compiles RANGE with both min and max inside AND — enumeration', () => {
    // AND(literal('огн'), range(40, 80, 'm q')) → two AND-joined quoted groups
    // (literal + single enumerated RANGE, not three groups)
    const result = compile(
      and(literal('огн'), range(40, 80, 'm q')),
      { round10: true }
    );
    expect(result).toBe('"огн" "(4[0-9]|5[0-9]|6[0-9]|7[0-9]|80).*m q"');
  });

  it('compiles RANGE with max-only', () => {
    // range(undefined, 50, 'm q') → only ≤50.*m q
    const result = compile(range(undefined, 50, 'm q'), { round10: true });
    expect(result).toBe('"([0-9]|[1-4][0-9]|50).*m q"');
  });

  it('compiles RANGE with both min and max (3-digit) — AND fallback', () => {
    // range(100, 200, 'жизн') → 101 values > MAX_ENUMERATE_RANGE (50)
    // Falls back to AND(≥100, ≤200) with two quoted groups
    // ≥100 now uses \d{3,} (verified in-game, saves 9 chars)
    const result = compile(range(100, 200, 'жизн'), { round10: false });
    expect(result).toBe('"\\d{3,}.*жизн" "([0-9]|[1-9][0-9]|[1-1][0-9][0-9]|200).*жизн"');
  });

  // ─── Prefix tests (Iteration 20: anchor number to correct mod line) ───

  it('compiles RANGE with prefix and suffix', () => {
    // "Боссы карт даруют на ##% больше опыта" → prefix="даруют на", suffix="больше опыта"
    // range(60, undefined, 'больше опыта', 'даруют на') → "даруют на ([6-9].|\d..).*больше опыта"
    const result = compile(range(60, undefined, 'больше опыта', 'даруют на'), { round10: false });
    expect(result).toBe('"даруют на ([6-9][0-9]|\\d{3,}).*больше опыта"');
  });

  it('compiles RANGE with prefix, suffix, and round10', () => {
    // With round10, 60 → round10 → 60 (no change), but 25 → round10 → 20
    // prefix="увеличенное на", suffix="количество монстров"
    const result = compile(range(25, undefined, 'количество монстров', 'увеличенное на'), { round10: true });
    expect(result).toBe('"увеличенное на ([2-9][0-9]|\\d{3,}).*количество монстров"');
  });

  it('compiles RANGE with prefix and both min+max — compact enumeration', () => {
    // range(25, 30, 'количество дани', 'даруют увеличенное на')
    // → single compact enumerated quoted group with prefix (Phase 10)
    const result = compile(range(25, 30, 'количество дани', 'даруют увеличенное на'), { round10: false });
    expect(result).toBe('"даруют увеличенное на (2[5-9]|30).*количество дани"');
  });

  it('compiles RANGE without prefix (original behavior)', () => {
    // No prefix → same as before: "numRegex.*suffix"
    const result = compile(range(40, undefined, 'm q'), { round10: true });
    expect(result).toBe('"([4-9][0-9]|\\d{3,}).*m q"');
  });

  it('compiles RANGE with prefix but no suffix', () => {
    // Prefix with no suffix: "prefix numRegex"
    const result = compile(range(50, undefined, undefined, 'даруют на'), { round10: true });
    expect(result).toBe('"даруют на ([5-9][0-9]|\\d{3,})"');
  });

  // ─── Exact (per-token) tests (Iteration 20: no round10 for per-token ranges) ───

  it('compiles RANGE with exact=true (no round10)', () => {
    // exact=true → no round10 even when global round10=true
    // 25 without round10 → (2[5-9]|[3-9].|\d..) instead of ([2-9].|\d..)
    const result = compile(range(25, undefined, 'количество монстров', undefined, true), { round10: true });
    expect(result).toBe('"(2[5-9]|[3-9][0-9]|\\d{3,}).*количество монстров"');
  });

  it('compiles RANGE with exact=false (uses global round10)', () => {
    // exact=false → use global round10 (default behavior)
    const result = compile(range(25, undefined, 'количество монстров', undefined, false), { round10: true });
    expect(result).toBe('"([2-9][0-9]|\\d{3,}).*количество монстров"');
  });

  it('compiles RANGE with exact=true and prefix', () => {
    // Per-token range ≥25 with prefix → precise regex + anchor
    const result = compile(range(25, undefined, 'количество дани', 'даруют увеличенное на', true), { round10: true });
    expect(result).toBe('"даруют увеличенное на (2[5-9]|[3-9][0-9]|\\d{3,}).*количество дани"');
  });

  it('compiles RANGE with exact=undefined (default, uses global round10)', () => {
    // exact=undefined → same as not providing it (backward compatible)
    const result = compile(range(25, undefined, 'количество монстров'), { round10: true });
    expect(result).toBe('"([2-9][0-9]|\\d{3,}).*количество монстров"');
  });

  // ─── Negate syntax verification (Phase 8: ! must be INSIDE quotes) ───

  it('compiles AND(LITERAL, EXCLUDE) — regexExclude pattern: "suffix" "!exclude"', () => {
    // Simulates the regexExclude use case from useCategoryPage.ts:
    // Token with regex="к силе" and regexExclude=["к силе и", "к силе,"]
    // Expected: "к силе" "!к силе и" "!к силе,"
    const result = compile(
      and(
        literal('к силе'),
        exclude(literal('к силе и')),
        exclude(literal('к силе,'))
      )
    );
    // CRITICAL: ! must be INSIDE quotes, NOT before them
    // Correct:   "к силе" "!к силе и" "!к силе,"
    // Wrong:     "к силе" !"к силе и" !"к силе,"
    expect(result).toBe('"к силе" "!к силе и" "!к силе,"');
    // Double-check: no ! before quotes
    expect(result).not.toMatch(/!"/);
  });

  it('compiles AND(OR, EXCLUDE) with short minion marker', () => {
    // Simulates: "к сопротивлению" "!Приспеш" — universal minion exclude
    const result = compile(
      and(
        or(literal('к сопротивлению огню'), literal('к сопротивлению холоду')),
        exclude(literal('Приспеш'))
      )
    );
    expect(result).toBe('"к сопротивлению огню|к сопротивлению холоду" "!Приспеш"');
    expect(result).not.toMatch(/!"/);
  });

  // ─── OR-suffix RANGE tests (Session 60: ranged tokens with different suffixes) ───

  it('compiles RANGE with OR-suffix (multiple suffixes joined by |)', () => {
    // When multiple ranged tokens share the same (min, max) but have different suffixes,
    // they are merged into one RANGE with OR-joined suffix.
    // The compiler must wrap the OR-suffix in () to scope the | correctly.
    // Without wrapping: "([1-9][0-9]|\\d{3,}).*огню|холоду" would parse as
    //   "([1-9][0-9]|\\d{3,}).*огню" OR "холоду" — WRONG!
    // With wrapping: "([1-9][0-9]|\\d{3,}).*(огню|холоду)" — correct!
    const result = compile(range(10, undefined, 'огню|холоду'), { round10: false });
    expect(result).toBe('"([1-9][0-9]|\\d{3,}).*(огню|холоду)"');
  });

  it('compiles RANGE with single suffix (no wrapping needed)', () => {
    // Single suffix without | — no wrapping, same as before
    const result = compile(range(10, undefined, 'к сопротивлению огню'), { round10: false });
    expect(result).toBe('"([1-9][0-9]|\\d{3,}).*к сопротивлению огню"');
  });

  it('compiles RANGE with OR-suffix and prefix', () => {
    // Dual-number mod with OR-suffix and prefix anchoring
    const result = compile(range(10, undefined, 'урона от молнии|урона от огня', 'От'), { round10: false });
    expect(result).toBe('"От ([1-9][0-9]|\\d{3,}).*(урона от молнии|урона от огня)"');
  });

  it('compiles RANGE with OR-suffix and both min+max — compact enumeration', () => {
    // min+max with OR-suffix: single compact enumerated quoted group (Phase 10)
    const result = compile(range(10, 50, 'огню|холоду'), { round10: false });
    expect(result).toBe('"(1[0-9]|2[0-9]|3[0-9]|4[0-9]|50).*(огню|холоду)"');
  });

  it('compiles RANGE with OR-suffix and max-only', () => {
    const result = compile(range(undefined, 25, 'огню|холоду'), { round10: false });
    expect(result).toBe('"([0-9]|1[0-9]|2[0-5]).*(огню|холоду)"');
  });

  it('compiles AND(LITERAL, RANGE with OR-suffix)', () => {
    // Simulates: a non-ranged literal AND a ranged OR-suffix
    const result = compile(
      and(literal('оскверн'), range(10, undefined, 'огню|холоду')),
      { round10: false }
    );
    expect(result).toBe('"оскверн" "([1-9][0-9]|\\d{3,}).*(огню|холоду)"');
  });

  it('compiles AND(LITERAL, RANGE with OR-suffix, EXCLUDE)', () => {
    // Full combo: non-ranged literal + ranged OR-suffix + exclude
    const result = compile(
      and(
        or(literal('даровать двойное'), literal('фонтаны')),
        range(10, undefined, 'огню|холоду'),
        exclude(literal('Приспеш'))
      ),
      { round10: false }
    );
    expect(result).toBe('"даровать двойное|фонтаны" "([1-9][0-9]|\\d{3,}).*(огню|холоду)" "!Приспеш"');
  });

  it('compiles RANGE with OR-suffix and exact=true (no round10)', () => {
    const result = compile(range(25, undefined, 'огню|холоду', undefined, true), { round10: true });
    // exact=true → no round10, so ≥25 not rounded to 30
    expect(result).toBe('"(2[5-9]|[3-9][0-9]|\\d{3,}).*(огню|холоду)"');
  });

  it('compiles AND(LITERAL, EXCLUDE(OR)) — !(A|B) format', () => {
    // Single exclude group with OR inside: "!A|B" inside quotes
    const result = compile(
      and(
        literal('всем стихи'),
        exclude(or(literal('Приспеш'), literal(' и')))
      )
    );
    expect(result).toBe('"всем стихи" "!Приспеш| и"');
    expect(result).not.toMatch(/!"/);
  });

  // ─── Phase 9: Enumerated range tests (verified in-game) ───

  it('enumerates narrow range [27, 30] — compact decade grouping (Phase 10)', () => {
    // This was the key test case: AND of two quoted groups for numeric range
    // didn't work in PoE2 because of secondary numbers in range notation.
    // Phase 10: compact decade grouping produces (2[7-9]|30) instead of (27|28|29|30)
    const result = compile(range(27, 30, 'откладывания наград'), { round10: false });
    expect(result).toBe('"(2[7-9]|30).*откладывания наград"');
  });

  it('enumerated range ignores round10 — precise by design', () => {
    // range(27, 30) with round10=true: round10 would round ≥27→≥20,
    // making the range [20,30] instead of [27,30]. But enumeration
    // always uses precise values, ignoring round10.
    const result = compile(range(27, 30, 'откладывания наград'), { round10: true });
    expect(result).toBe('"(2[7-9]|30).*откладывания наград"');
    // Should NOT contain "20" or any rounded value
    expect(result).not.toContain('20');
  });

  it('single-value range [27, 27] produces no parentheses', () => {
    const result = compile(range(27, 27, 'суффикс'), { round10: false });
    expect(result).toBe('"27.*суффикс"');
  });

  it('wide range > MAX_ENUMERATE_RANGE falls back to AND approach', () => {
    // range(10, 200) = 191 values > 50 → AND fallback
    const result = compile(range(10, 200, 'суфф'), { round10: false });
    // Should have two quoted groups (AND)
    expect(result).toContain('" "');
    expect(result).toContain('суфф');
  });

  it('AND mode with different-family tokens → separate quoted groups', () => {
    // Simulates AND mode: tokens from different familyKeys produce AND output
    // This tests the compilation of the AST that useCategoryPage would build
    const result = compile(
      and(
        or(literal('к сопротивлению огню'), literal('к сопротивлению огню T2')),
        literal('к силе')
      )
    );
    // Different families → AND: each family gets its own quoted group
    expect(result).toBe('"к сопротивлению огню|к сопротивлению огню T2" "к силе"');
  });

  it('OR mode with different-family tokens → single OR group', () => {
    // Simulates OR mode: all tokens go into one OR group
    const result = compile(
      or(literal('к сопротивлению огню'), literal('к силе'))
    );
    expect(result).toBe('"к сопротивлению огню|к силе"');
  });

  // ─── Phase 9b: anchorStart (^) anchor tests ───

  it('RANGE with anchorStart=true adds ^ before number pattern (enumerated)', () => {
    // Phase 9b: ^ anchors to start of mod block, preventing range notation FP.
    // Verified in-game: "^(2[7-9]|30).*откладывания наград" highlights only 27% and 30%
    const result = compile(range(27, 30, 'откладывания наград', undefined, undefined, true), { round10: false });
    expect(result).toBe('"^(2[7-9]|30).*откладывания наград"');
  });

  it('RANGE with anchorStart=true adds ^ before number pattern (≥min)', () => {
    // ≥27 with anchorStart → "^(2[7-9]|[3-9][0-9]|\\d{3,}).*suffix"
    const result = compile(range(27, undefined, 'откладывания наград', undefined, undefined, true), { round10: false });
    expect(result).toBe('"^(2[7-9]|[3-9][0-9]|\\d{3,}).*откладывания наград"');
  });

  it('RANGE with anchorStart=true adds ^ before number pattern (≤max)', () => {
    // ≤30 with anchorStart → "^([0-9]|[1-2][0-9]|30).*suffix"
    const result = compile(range(undefined, 30, 'откладывания наград', undefined, undefined, true), { round10: false });
    expect(result).toBe('"^([0-9]|[1-2][0-9]|30).*откладывания наград"');
  });

  it('RANGE with anchorStart=false (default) does NOT add ^', () => {
    // Default behavior — no ^ anchor (backward compatible)
    const result = compile(range(27, 30, 'откладывания наград'), { round10: false });
    expect(result).toBe('"(2[7-9]|30).*откладывания наград"');
    expect(result).not.toContain('^');
  });

  it('RANGE with prefix does NOT add ^ even with anchorStart=true', () => {
    // When prefix is set (dual-number mods), ^ is not added because
    // the number is NOT at position 0 — the prefix is.
    // The prefix already provides anchoring within the block.
    const result = compile(range(25, 30, 'количество дани', 'даруют увеличенное на', undefined, true), { round10: false });
    expect(result).toBe('"даруют увеличенное на (2[5-9]|30).*количество дани"');
    expect(result).not.toContain('^');
  });

  it('RANGE with anchorStart=true AND wide range (>50) preserves ^ on both AND groups', () => {
    // Wide range: AND fallback. anchorStart should be preserved on both children.
    // range(10, 200, 'суфф', undefined, undefined, true) → "^≥10.*суфф" "^≤200.*суфф"
    const result = compile(range(10, 200, 'суфф', undefined, undefined, true), { round10: false });
    expect(result).toContain('^');
    // Both AND groups should have ^
    const groups = result.split('" "');
    expect(groups.length).toBe(2);
    expect(groups[0]).toContain('^');
    expect(groups[1]).toContain('^');
  });

  // ─── Phase 9c: anchorEnd (%) suffix anchoring tests ───

  it('RANGE with anchorEnd="%" adds % after number pattern (enumerated)', () => {
    // Phase 9c: % after number prevents FP from range notation numbers
    // For +##% accessory mods where anchorStart=false
    const result = compile(range(27, 30, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
    expect(result).toBe('"(2[7-9]|30)%.*к сопротивлению огню"');
  });

  it('RANGE with anchorEnd="%" adds % after number pattern (≥min)', () => {
    const result = compile(range(27, undefined, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
    expect(result).toBe('"(2[7-9]|[3-9][0-9]|\\d{3,})%.*к сопротивлению огню"');
  });

  it('RANGE with anchorEnd="%" adds % after number pattern (≤max)', () => {
    const result = compile(range(undefined, 30, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
    expect(result).toBe('"([0-9]|[1-2][0-9]|30)%.*к сопротивлению огню"');
  });

  it('RANGE without anchorEnd does NOT add % (backward compatible)', () => {
    const result = compile(range(27, 30, 'к сопротивлению огню'), { round10: false });
    expect(result).toBe('"(2[7-9]|30).*к сопротивлению огню"');
    expect(result).not.toContain('%');
  });

  it('RANGE with both anchorStart=true and anchorEnd="%" produces ^ and %', () => {
    // Maximum protection: ^ + % for ##% mods
    const result = compile(range(27, 30, 'откладывания наград', undefined, undefined, true, '%'), { round10: false });
    expect(result).toBe('"^(2[7-9]|30)%.*откладывания наград"');
  });

  it('RANGE with anchorEnd="%" and prefix produces % after number', () => {
    // Dual-number mod: prefix anchors, % goes after number
    const result = compile(range(25, 30, 'количество дани', 'даруют увеличенное на', undefined, false, '%'), { round10: false });
    expect(result).toBe('"даруют увеличенное на (2[5-9]|30)%.*количество дани"');
  });

  it('RANGE with anchorEnd="%" preserved in AND fallback for wide ranges', () => {
    // Wide range >50 values: AND(RANGE(min), RANGE(max)) with anchorEnd
    const result = compile(range(10, 200, 'суфф', undefined, undefined, false, '%'), { round10: false });
    const groups = result.split('" "');
    expect(groups.length).toBe(2);
    expect(groups[0]).toContain('%');
    expect(groups[1]).toContain('%');
  });

  // ─── Phase 11: Threshold mode tests ───

  it('RANGE with threshold=true compiles as ≥min only (single quoted group)', () => {
    // range(27, 50, 'откладывания наград', ..., threshold=true)
    // Instead of enumerating [27,50] or AND fallback, just use ≥27 threshold
    const result = compile(range(27, 50, 'откладывания наград', undefined, undefined, false, '%', undefined, undefined, true), { round10: false });
    expect(result).toBe('"(2[7-9]|[3-9][0-9]|\\d{3,})%.*откладывания наград"');
  });

  it('RANGE with threshold=true for wide range avoids AND fallback', () => {
    // range(10, 200, 'суфф') without threshold → AND fallback (2 groups)
    // With threshold=true → single ≥10 group
    const result = compile(range(10, 200, 'суфф', undefined, undefined, false, undefined, undefined, undefined, true), { round10: false });
    // Should be a single quoted group (no AND), just ≥10
    expect(result).not.toContain('" "');
    expect(result).toContain('суфф');
    expect(result).toMatch(/\\d\{3,\}/);
  });

  it('RANGE with threshold=true and prefix compiles correctly', () => {
    // range(25, 80, 'количество монстров', 'увеличенное на', ..., threshold=true)
    const result = compile(range(25, 80, 'количество монстров', 'увеличенное на', undefined, false, undefined, undefined, undefined, true), { round10: false });
    expect(result).toBe('"увеличенное на (2[5-9]|[3-9][0-9]|\\d{3,}).*количество монстров"');
  });

  it('RANGE with threshold=true and reversed compiles correctly', () => {
    // Reversed + threshold: suffix.*≥min
    // iter 125 FIX: (A|B|...) after .* bridge is ignored in-game.
    // Distribute via Path D: `suffix.*A|suffix.*B|...` (top-level |).
    // Each alternative is anchored to `%` via endAnchor.
    const result = compile(range(30, 100, 'золота', undefined, undefined, false, '%', true, undefined, true), { round10: false });
    expect(result).toBe('"золота.*[3-9][0-9]%|золота.*\\d{3,}%"');
  });

  it('RANGE without threshold uses enumeration for narrow ranges', () => {
    // Without threshold, narrow range [27,30] still uses enumeration
    const result = compile(range(27, 30, 'откладывания наград'), { round10: false });
    expect(result).toBe('"(2[7-9]|30).*откладывания наград"');
  });

  it('RANGE with threshold=false behaves like default (no threshold)', () => {
    // threshold=false should be same as no threshold
    const result = compile(range(27, 30, 'откладывания наград', undefined, undefined, false, undefined, undefined, undefined, false), { round10: false });
    expect(result).toBe('"(2[7-9]|30).*откладывания наград"');
  });

  // ─── Phase 12: signPrefix (+/-) tests ───

  it('RANGE with signPrefix="+" adds \\+ before number pattern (≥min)', () => {
    // "+##% к сопротивлению молнии" → \+(≥min)%.*suffix
    const result = compile(range(35, undefined, 'к сопротивлению молнии', undefined, undefined, false, '%', undefined, undefined, undefined, '+'), { round10: false });
    expect(result).toBe('"\\+(3[5-9]|[4-9][0-9]|\\d{3,})%.*к сопротивлению молнии"');
  });

  it('RANGE with signPrefix="+" adds \\+ before number pattern (enumerated)', () => {
    // "+##% к сопротивлению" → \+(enumerated)%.*suffix
    const result = compile(range(27, 30, 'к сопротивлению огню', undefined, undefined, false, '%', undefined, undefined, undefined, '+'), { round10: false });
    expect(result).toBe('"\\+(2[7-9]|30)%.*к сопротивлению огню"');
  });

  it('RANGE with signPrefix="-" adds - before number pattern (≥min)', () => {
    // "-##% максимум сопротивлений" → -(≥min)%.*suffix
    const result = compile(range(11, undefined, 'максимум сопротивлений', undefined, undefined, false, '%', undefined, undefined, undefined, '-'), { round10: false });
    expect(result).toBe('"-(1[1-9]|[2-9][0-9]|\\d{3,})%.*максимум сопротивлений"');
  });

  it('RANGE with signPrefix="+" and reversed adds \\+ before number at end', () => {
    // "Редкость предметов: +##%" → suffix.*\+(≥min)%
    // iter 125 FIX: (A|B|...) after .* bridge is ignored in-game.
    // Distribute via Path D: each alternative gets `\+` prefix and `%` suffix.
    const result = compile(range(18, undefined, 'Редкость предметов', undefined, undefined, false, '%', true, undefined, undefined, '+'), { round10: false });
    expect(result).toBe('"Редкость предметов.*\\+1[8-9]%|Редкость предметов.*\\+[2-9][0-9]%|Редкость предметов.*\\+\\d{3,}%"');
  });

  it('RANGE with signPrefix="+" and anchorStart adds ^ before \\+', () => {
    // "+##% suffix" at start of block → ^\+(numRegex)%.*suffix
    const result = compile(range(27, 30, 'к сопротивлению огню', undefined, undefined, true, '%', undefined, undefined, undefined, '+'), { round10: false });
    expect(result).toBe('"^\\+(2[7-9]|30)%.*к сопротивлению огню"');
  });

  it('RANGE with signPrefix="+" and prefix adds \\+ after prefix', () => {
    // "prefix +## suffix" → prefix \+(numRegex).*suffix
    const result = compile(range(25, 30, 'суффикс', 'префикс', undefined, false, undefined, undefined, undefined, undefined, '+'), { round10: false });
    expect(result).toBe('"префикс \\+(2[5-9]|30).*суффикс"');
  });

  it('RANGE without signPrefix produces no sign (backward compatible)', () => {
    // Default: no signPrefix → no \+ or - before number
    const result = compile(range(27, 30, 'к сопротивлению огню', undefined, undefined, false, '%'), { round10: false });
    expect(result).toBe('"(2[7-9]|30)%.*к сопротивлению огню"');
    // \+ should NOT appear (no sign prefix)
    expect(result).not.toContain('\\+');
    // - sign before number should NOT appear (the - in [7-9] is a char class range, not a sign)
    // Match only - immediately before a digit that is NOT inside []
    const withoutCharClasses = result.replace(/\[[^\]]*\]/g, '');
    expect(withoutCharClasses).not.toMatch(/-\d/);
  });

  it('RANGE with signPrefix and wide range (>50) preserves sign in AND fallback', () => {
    // Wide range: AND fallback. signPrefix should be on both children.
    const result = compile(range(10, 200, 'суфф', undefined, undefined, false, '%', undefined, undefined, undefined, '+'), { round10: false });
    const groups = result.split('" "');
    expect(groups.length).toBe(2);
    // Both AND groups should have \+
    expect(groups[0]).toContain('\\+');
    expect(groups[1]).toContain('\\+');
  });

  it('RANGE with signPrefix="+" and max-only adds \\+ before ≤max pattern', () => {
    // ≤50 with +sign: \+(≤50)%.*suffix
    const result = compile(range(undefined, 50, 'к здоровью', undefined, undefined, false, '%', undefined, undefined, undefined, '+'), { round10: false });
    expect(result).toBe('"\\+([0-9]|[1-4][0-9]|50)%.*к здоровью"');
  });

  it('RANGE with signPrefix and threshold compiles correctly', () => {
    // threshold + sign: \+(≥min)%.*suffix
    const result = compile(range(27, 50, 'откладывания наград', undefined, undefined, false, '%', undefined, undefined, true, '+'), { round10: false });
    expect(result).toBe('"\\+(2[7-9]|[3-9][0-9]|\\d{3,})%.*откладывания наград"');
  });

  it('RANGE with signPrefix="+" and OR-suffix wraps suffix correctly', () => {
    // \+ + OR suffix: \+(numRegex)%.*(suffix1|suffix2)
    const result = compile(range(35, undefined, 'к сопротивлению огню|к сопротивлению холоду', undefined, undefined, false, '%', undefined, undefined, undefined, '+'), { round10: false });
    expect(result).toBe('"\\+(3[5-9]|[4-9][0-9]|\\d{3,})%.*(к сопротивлению огню|к сопротивлению холоду)"');
  });
});

describe('compile MULTI_RANGE', () => {
  it('compiles dual-slot MULTI_RANGE with both ≥min', () => {
    // "Добавляет от X до Y физического урона к атакам"
    // Slot 0: ≥6, prefix "Добавляет от"
    // Slot 1: ≥12, prefix "до"
    // Suffix: "урона к атакам"
    const result = compile(
      multiRange(
        [
          { min: 6, prefix: 'Добавляет от' },
          { min: 12, prefix: 'до' },
        ],
        'урона к атакам'
      ),
      { round10: false }
    );
    expect(result).toBe('"Добавляет от ([6-9]|\\d{2,}).*до (1[2-9]|[2-9][0-9]|\\d{3,}).*урона к атакам"');
  });

  it('compiles dual-slot MULTI_RANGE with min and max', () => {
    // Slot 0: ≥6 ≤10, Slot 1: ≥12 ≤20
    const result = compile(
      multiRange(
        [
          { min: 6, max: 10, prefix: 'Добавляет от' },
          { min: 12, max: 20, prefix: 'до' },
        ],
        'урона к атакам'
      ),
      { round10: false }
    );
    // Narrow ranges: enumerated with compact decade grouping
    expect(result).toBe('"Добавляет от ([6-9]|10).*до (1[2-9]|20).*урона к атакам"');
  });

  it('compiles dual-slot MULTI_RANGE with only ≤max on one slot', () => {
    const result = compile(
      multiRange(
        [
          { max: 6, prefix: 'Добавляет от' },
          { max: 12, prefix: 'до' },
        ],
        'урона к атакам'
      ),
      { round10: false }
    );
    expect(result).toBe('"Добавляет от ([0-6]).*до ([0-9]|1[0-2]).*урона к атакам"');
  });

  it('compiles dual-slot MULTI_RANGE with ≥min on slot 0 only (single-slot)', () => {
    // When only slot 0 has a filter, MULTI_RANGE still works but uses just one slot
    const result = compile(
      multiRange(
        [
          { min: 6, prefix: 'Добавляет от' },
        ],
        'урона к атакам'
      ),
      { round10: false }
    );
    expect(result).toBe('"Добавляет от ([6-9]|\\d{2,}).*урона к атакам"');
  });

  it('compiles MULTI_RANGE with threshold mode (drops max)', () => {
    const result = compile(
      multiRange(
        [
          { min: 6, max: 10, prefix: 'Добавляет от' },
          { min: 12, max: 20, prefix: 'до' },
        ],
        'урона к атакам',
        undefined,
        true // threshold = true → drop max
      ),
      { round10: false }
    );
    // threshold mode: max is dropped, only ≥min
    expect(result).toBe('"Добавляет от ([6-9]|\\d{2,}).*до (1[2-9]|[2-9][0-9]|\\d{3,}).*урона к атакам"');
  });

  it('compiles MULTI_RANGE with exact=true (disables round10)', () => {
    const result = compile(
      multiRange(
        [
          { min: 6, prefix: 'От' },
          { min: 12, prefix: 'до' },
        ],
        'урона шипами',
        true // exact
      ),
      { round10: true } // global round10 should be overridden by exact
    );
    expect(result).toBe('"От ([6-9]|\\d{2,}).*до (1[2-9]|[2-9][0-9]|\\d{3,}).*урона шипами"');
  });

  it('compiles MULTI_RANGE with wide range (drops max, approximates as ≥min)', () => {
    // Range 6-100 is too wide for enumeration (>50), so max is dropped
    const result = compile(
      multiRange(
        [
          { min: 6, max: 100, prefix: 'Добавляет от' },
          { min: 12, prefix: 'до' },
        ],
        'урона к атакам'
      ),
      { round10: false }
    );
    // Wide range on slot 0: max dropped, only ≥min
    expect(result).toBe('"Добавляет от ([6-9]|\\d{2,}).*до (1[2-9]|[2-9][0-9]|\\d{3,}).*урона к атакам"');
  });

  it('returns empty string for MULTI_RANGE with no effective slots', () => {
    const result = compile(
      multiRange(
        [],
        'урона к атакам'
      ),
      { round10: false }
    );
    expect(result).toBe('');
  });

  it('compiles MULTI_RANGE with OR-suffix (wraps in parens)', () => {
    const result = compile(
      multiRange(
        [
          { min: 6, prefix: 'Добавляет от' },
          { min: 12, prefix: 'до' },
        ],
        'урона к атакам|физического урона к атакам'
      ),
      { round10: false }
    );
    expect(result).toBe('"Добавляет от ([6-9]|\\d{2,}).*до (1[2-9]|[2-9][0-9]|\\d{3,}).*(урона к атакам|физического урона к атакам)"');
  });
});
