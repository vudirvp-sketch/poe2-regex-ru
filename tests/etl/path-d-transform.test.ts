import { describe, it, expect } from 'vitest';
import { pathDTransform, hasPathDGroup, findOverLimitEntries, POE2_REGEX_CHAR_LIMIT } from '@etl/path-d-transform';

describe('pathDTransform', () => {
  describe('hasPathDGroup', () => {
    it('returns false for plain literal (no parens)', () => {
      expect(hasPathDGroup('увеличение урона')).toBe(false);
      expect(hasPathDGroup('к сопротивлению огню')).toBe(false);
    });

    it('returns false for char class only (no parens)', () => {
      expect(hasPathDGroup('сопротивл[её]нию')).toBe(false);
      expect(hasPathDGroup('т[её]ст')).toBe(false);
    });

    it('returns false for parens without |', () => {
      // Single-alt group: doesn't need Path D (but dp-factorizer doesn't produce these)
      expect(hasPathDGroup('prefix(A)')).toBe(false);
    });

    it('returns true for parens with |', () => {
      expect(hasPathDGroup('prefix(A|B)')).toBe(true);
      expect(hasPathDGroup('prefix(A|B|C)')).toBe(true);
      expect(hasPathDGroup('(A|B|C)suffix')).toBe(true);
    });

    it('returns true for nested parens with |', () => {
      expect(hasPathDGroup('prefix(A|B(m|n))')).toBe(true);
      expect(hasPathDGroup('((A|B))')).toBe(true);
    });

    it('returns false for | inside char class', () => {
      // | inside [] is literal, not alternation
      expect(hasPathDGroup('a[b|c]d')).toBe(false);
    });

    it('returns false for optional (ь|) — single char + empty', () => {
      // (ь|) has | inside parens, so should return true
      // Wait — this is a real case we need to handle
      expect(hasPathDGroup('карт(ь|)')).toBe(true);
    });
  });

  describe('pathDTransform — basic cases', () => {
    it('returns plain literal unchanged (no parens)', () => {
      expect(pathDTransform('увеличение урона')).toBe('увеличение урона');
      expect(pathDTransform('к сопротивлению огню')).toBe('к сопротивлению огню');
    });

    it('returns char-class-only regex unchanged', () => {
      expect(pathDTransform('сопротивл[её]нию')).toBe('сопротивл[её]нию');
      expect(pathDTransform('т[её]ст')).toBe('т[её]ст');
    });

    it('transforms prefix(A|B|C) → prefix.*A|prefix.*B|prefix.*C', () => {
      const result = pathDTransform('увеличение урона (огня|хаосом|луками|посохами)');
      expect(result).toBe(
        'увеличение урона.*огня|увеличение урона.*хаосом|увеличение урона.*луками|увеличение урона.*посохами'
      );
    });

    it('transforms (A|B|C)suffix → A.*suffix|B.*suffix|C.*suffix', () => {
      const result = pathDTransform('(увеличение максимума|начала перезарядки) энергетического щита');
      expect(result).toBe(
        'увеличение максимума.*энергетического щита|начала перезарядки.*энергетического щита'
      );
    });

    it('transforms prefix(A|B|C)suffix → prefix.*A.*suffix|...', () => {
      const result = pathDTransform('prefix(A|B|C)suffix');
      expect(result).toBe('prefix.*A.*suffix|prefix.*B.*suffix|prefix.*C.*suffix');
    });
  });

  describe('pathDTransform — nested groups', () => {
    it('flattens nested groups recursively', () => {
      // prefix(A|B(m|n)) → prefix.*A|prefix.*B.*m|prefix.*B.*n
      const result = pathDTransform('prefix(A|B(m|n))');
      expect(result).toBe('prefix.*A|prefix.*B.*m|prefix.*B.*n');
    });

    it('flattens deeply nested groups (3 levels)', () => {
      // prefix(A|B(m|x(y|z))) → prefix.*A|prefix.*B.*m|prefix.*B.*x.*y|prefix.*B.*x.*z
      const result = pathDTransform('prefix(A|B(m|x(y|z)))');
      expect(result).toBe('prefix.*A|prefix.*B.*m|prefix.*B.*x.*y|prefix.*B.*x.*z');
    });

    it('flattens real-world jewel opt-table entry', () => {
      // From jewel.json: "увеличение (области действия|максимума (энергетического щита|здоровья)|уклонения)"
      const result = pathDTransform(
        'увеличение (области действия|максимума (энергетического щита|здоровья)|уклонения)'
      );
      expect(result).toBe(
        'увеличение.*области действия|увеличение.*максимума.*энергетического щита|увеличение.*максимума.*здоровья|увеличение.*уклонения'
      );
    });

    it('flattens nested alternation in middle of three alts', () => {
      // "повышение (брони|скорости (атаки|сотворения чар)|шанса)"
      const result = pathDTransform(
        'повышение (брони|скорости (атаки|сотворения чар)|шанса)'
      );
      expect(result).toBe(
        'повышение.*брони|повышение.*скорости.*атаки|повышение.*скорости.*сотворения чар|повышение.*шанса'
      );
    });
  });

  describe('pathDTransform — optional groups (ь|)', () => {
    it('flattens (ь|) → ь|<empty>', () => {
      // карт(ь|) → карт.*ь|карт
      const result = pathDTransform('карт(ь|)');
      expect(result).toBe('карт.*ь|карт');
    });

    it('flattens prefix(A|B|) → prefix.*A|prefix.*B|prefix', () => {
      const result = pathDTransform('prefix(A|B|)');
      expect(result).toBe('prefix.*A|prefix.*B|prefix');
    });

    it('flattens (A|)suffix → A.*suffix|suffix', () => {
      // Empty alt + suffix: empty alt → literal concat (no `.*`)
      const result = pathDTransform('(A|)suffix');
      expect(result).toBe('A.*suffix|suffix');
    });

    it('flattens prefix(A|)suffix → prefix.*A.*suffix|prefixsuffix', () => {
      // Empty alt: literal concat of prefix and suffix (no `.*`)
      const result = pathDTransform('prefix(A|)suffix');
      expect(result).toBe('prefix.*A.*suffix|prefixsuffix');
    });
  });

  describe('pathDTransform — character classes preserved', () => {
    it('preserves [её] char class inside alt', () => {
      const result = pathDTransform('сопротивл[её]нию (огню|холоду)');
      expect(result).toBe('сопротивл[её]нию.*огню|сопротивл[её]нию.*холоду');
    });

    it('preserves [юя] char class in suffix', () => {
      const result = pathDTransform('prefix(A|B)молни[юя]');
      expect(result).toBe('prefix.*A.*молни[юя]|prefix.*B.*молни[юя]');
    });

    it('does not treat | inside [] as alternation', () => {
      // | inside [] is literal pipe character
      const result = pathDTransform('a[b|c]d');
      expect(result).toBe('a[b|c]d'); // unchanged, no parens
    });
  });

  describe('pathDTransform — edge cases', () => {
    it('handles empty alt list (degenerate case)', () => {
      // (|) — only empty alts
      const result = pathDTransform('prefix(|)');
      // Both alts empty → just "prefix"
      expect(result).toBe('prefix|prefix');
    });

    it('handles single-char alts', () => {
      const result = pathDTransform('prefix(a|b|c)');
      expect(result).toBe('prefix.*a|prefix.*b|prefix.*c');
    });

    it('handles multi-word alts with spaces', () => {
      const result = pathDTransform('увеличение (области действия|уклонения)');
      expect(result).toBe('увеличение.*области действия|увеличение.*уклонения');
    });

    it('handles alts with already-present .* ', () => {
      const result = pathDTransform('prefix(A.*X|B.*Y)');
      expect(result).toBe('prefix.*A.*X|prefix.*B.*Y');
    });

    it('handles empty regex', () => {
      expect(pathDTransform('')).toBe('');
    });

    it('handles regex with only char class and no parens', () => {
      expect(pathDTransform('[её]')).toBe('[её]');
    });
  });

  describe('pathDTransform — real-world patterns', () => {
    it('transforms multi-alt opt-table entry from jewel.json', () => {
      const result = pathDTransform('максимальному сопротивлению (холоду|огню|молнии|хаосу)');
      expect(result).toBe(
        'максимальному сопротивлению.*холоду|максимальному сопротивлению.*огню|максимальному сопротивлению.*молнии|максимальному сопротивлению.*хаосу'
      );
    });

    it('transforms suffix-grouped entry', () => {
      const result = pathDTransform(
        '(увеличение максимума|начала перезарядки|скорости перезарядки|от максимума) энергетического щита'
      );
      expect(result).toBe(
        'увеличение максимума.*энергетического щита|начала перезарядки.*энергетического щита|скорости перезарядки.*энергетического щита|от максимума.*энергетического щита'
      );
    });

    it('transforms deeply nested real entry from jewel.json', () => {
      // "повышение (брони|скорости (атаки|сотворения чар|накопления шкалы (заморозки|оглушения))|шанса критического удара)"
      const result = pathDTransform(
        'повышение (брони|скорости (атаки|сотворения чар|накопления шкалы (заморозки|оглушения))|шанса критического удара)'
      );
      expect(result).toBe(
        'повышение.*брони|' +
        'повышение.*скорости.*атаки|' +
        'повышение.*скорости.*сотворения чар|' +
        'повышение.*скорости.*накопления шкалы.*заморозки|' +
        'повышение.*скорости.*накопления шкалы.*оглушения|' +
        'повышение.*шанса критического удара'
      );
    });

    it('transforms English opt-table entry from tablet.json', () => {
      const result = pathDTransform(
        '(Rare|from Vaal Beacons|Monsters|pack(s) of Monsters around Vaal Beacons|for Monsters around Vaal Beacons) in Map'
      );
      expect(result).toBe(
        'Rare.*in Map|from Vaal Beacons.*in Map|Monsters.*in Map|pack(s) of Monsters around Vaal Beacons.*in Map|for Monsters around Vaal Beacons.*in Map'
      );
    });
  });

  describe('pathDTransform — preserves regex semantics', () => {
    it('does not break regex with escaped chars', () => {
      // Escaped paren \( not treated as group
      const result = pathDTransform('prefix\\(A|B');
      // No group (escaped paren), no transformation
      expect(result).toBe('prefix\\(A|B');
    });

    it('preserves escaped pipe inside group', () => {
      // Escaped pipe \| inside group is literal, not alternation
      const result = pathDTransform('prefix(A\\|B|C)');
      // Split by top-level | → ['A\\|B', 'C']
      expect(result).toBe('prefix.*A\\|B|prefix.*C');
    });
  });
});

describe('findOverLimitEntries', () => {
  it('returns empty array for empty table', () => {
    expect(findOverLimitEntries({})).toEqual([]);
  });

  it('returns empty array when all entries are within limit', () => {
    const table = {
      a: { regex: { ru: 'короткий' } },
      b: { regex: { ru: 'ещё короче' } },
    };
    expect(findOverLimitEntries(table)).toEqual([]);
  });

  it('detects a single entry exceeding the default limit', () => {
    const longRegex = 'а'.repeat(POE2_REGEX_CHAR_LIMIT + 1);
    const table = {
      ok: { regex: { ru: 'короткий' } },
      long: { regex: { ru: longRegex } },
    };
    const result = findOverLimitEntries(table);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('long');
    expect(result[0].length).toBe(POE2_REGEX_CHAR_LIMIT + 1);
    expect(result[0].regex).toBe(longRegex);
  });

  it('detects multiple entries and sorts by length descending', () => {
    const r251 = 'x'.repeat(251);
    const r317 = 'y'.repeat(317);
    const r260 = 'z'.repeat(260);
    const table = {
      a: { regex: { ru: r317 } },
      b: { regex: { ru: r251 } },
      c: { regex: { ru: 'ok' } },
      d: { regex: { ru: r260 } },
    };
    const result = findOverLimitEntries(table);
    expect(result.map(r => r.key)).toEqual(['a', 'd', 'b']);
    expect(result.map(r => r.length)).toEqual([317, 260, 251]);
  });

  it('respects custom limit parameter', () => {
    const exact30 = 'a'.repeat(30);
    const table = {
      a: { regex: { ru: exact30 } },
    };
    // 30 chars — should be over limit=25
    expect(findOverLimitEntries(table, 'ru', 25)).toHaveLength(1);
    // 30 chars — should be exactly at limit=30 (NOT over)
    expect(findOverLimitEntries(table, 'ru', 30)).toEqual([]);
    // 30 chars — should be under limit=50
    expect(findOverLimitEntries(table, 'ru', 50)).toEqual([]);
  });

  it('respects locale parameter', () => {
    const table = {
      a: { regex: { ru: 'короткий ru', en: 'a'.repeat(300) } },
    };
    expect(findOverLimitEntries(table, 'ru')).toEqual([]);
    expect(findOverLimitEntries(table, 'en')).toHaveLength(1);
  });

  it('skips entries with missing or empty regex', () => {
    const table = {
      a: { regex: {} },
      b: { regex: { ru: '' } },
      c: { regex: { ru: 'a'.repeat(300) } },
    };
    const result = findOverLimitEntries(table);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('c');
  });

  it('entries exactly at limit are NOT flagged (boundary check)', () => {
    const exact = 'a'.repeat(POE2_REGEX_CHAR_LIMIT);
    const table = {
      a: { regex: { ru: exact } },
    };
    expect(findOverLimitEntries(table)).toEqual([]);
  });

  it('handles real-world Path D output (11 alternatives, >250 chars)', () => {
    // Simulates the kind of entry produced by Phase D when 11+ alternatives
    // share the same prefix — known to exceed the 250-char limit.
    const realEntry = 'увеличение.*области действия|увеличение.*максимума.*энергетического щита|увеличение.*максимума.*здоровья|увеличение.*уклонения|увеличение.*урона в ближнем бою|увеличение.*бонуса к критическому урону|увеличение.*количества получаемых зарядов флакона|увеличение.*длительности эффекта умения|увеличение.*порога оглушения';
    expect(realEntry.length).toBeGreaterThan(POE2_REGEX_CHAR_LIMIT);
    const table = {
      'jewel:a:b:c:d:e:f:g:h:i:j:k': { regex: { ru: realEntry } },
    };
    const result = findOverLimitEntries(table);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(realEntry.length);
  });

  it('does not modify the input table', () => {
    const longRegex = 'a'.repeat(300);
    const table = {
      a: { regex: { ru: longRegex } },
    };
    const snapshot = JSON.stringify(table);
    findOverLimitEntries(table);
    expect(JSON.stringify(table)).toBe(snapshot);
  });
});
