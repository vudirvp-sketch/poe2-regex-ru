# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Верификация v10:** 2026-06-16 — итерация 40: D2+D4 DONE — Path D реализован в ETL + runtime, 303/481 opt-table entries преобразованы, 0 broken `()` остаются. Ожидает D5 in-game верификацию.

---

## PoE2 Regex Dialect — VERIFIED (iter 40)

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR (single-word, whole quoted group) | ✅ | `"огня\|холоду"`, `"луками\|посохами"` |
| `\|` OR (multi-word with `.*` inside ONE quoted group) | ✅ | `"увеличение урона.*луками\|увеличение урона.*посохами"` (D7-3, iter 38); 3+4 alt + AND (iter 39, D1) |
| `()` grouping (single-word OR, alone) | ✅ | `"(огня\|холоду)"` |
| `\d` digit shorthand | ✅ | `"\d.*к максимуму здоровья"` |
| `{N,}` quantifier | ✅ | `"\d{2,}%.*золота"` |
| `!` + `\|` = `!(A\|B)` | ✅ | `"к сопротивлению" "!молнии\|хаосу"` |
| `?` optional | ❌ | NOT supported |
| `.*` within single block | ✅ | Does NOT cross block boundaries |
| `.*` bridging (prefix→suffix) | ✅ | `"увеличение урона.*луками"` (verified iter 37) |
| `-` literal | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `\+` matches literal + |
| `^` start-of-block anchor | ✅ | `"^28%"` anchors to block start |
| Case insensitive | ✅ | Cyrillic verified |
| `!X` item-wide | ✅ | Excludes item if X in ANY block |
| AND across blocks | ✅ | `"максимуму здоровья" "к силе"` |
| Threshold ≥N% | ✅ | `"Монстры с (3[4-9]\|[4-9][0-9]\|\d{3,})%.*отравление"` |
| Substring search (truncated words) | ✅ | `"оберег"` matches `"оберега"`, `"посох"` matches `"посохами"` |
| `"prefix (A\|B)"` (`\|` after non-`.*` prefix inside quotes) | ❌ | Test 16 — matches only the prefix broadly |
| `"(A B\|C D)"` (multi-word `\|` inside `()`) | ❌ | Test 15 — nothing matches |
| `"X"\|"Y"` (`\|` BETWEEN two quoted groups) | ❌ | **B0 CONFIRMED BROKEN iter 38** — zero matches |

**Critical syntax rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries
3. `.*` is directional — forward only
4. AND via space between quoted groups works ACROSS blocks
5. `!X` is item-wide — excludes ENTIRE item if X found in ANY block
6. Description/tooltip text is NOT indexed
7. Item rarity label IS indexed — «редк» matches all rare items
8. **`|` works at the TOP LEVEL of a single quoted group** (with or without `.*` in alternatives). It does NOT work between two quoted groups (`"X"|"Y"`), and it does NOT work inside `()` with multi-word alternatives (`"(A B|C D)"`).

---

## Iteration 38 — B0 RESOLVED + Path D confirmed

### Two critical findings from iter 37 in-game run

**1. B0 — `"X"|"Y"` (OR between TWO quoted groups) is BROKEN.**

All 3 B0 tests gave ZERO matches in-game. The PoE2 parser breaks completely when it sees `|` between two quoted groups.

Simulator behavior (kept for reference): `parseQuotedGroups` splits on SPACES outside quotes, NOT on `|`. So `"A"|"B"` becomes groups [`A`, `|B`]. Group 2 `|B` parses as alternation: empty | `b` → always matches. Result: `"A"|"B"` = `A` AND `(|B)` = `A` only.

Game behavior: ZERO matches. The simulator is "less broken" than the game (simulator matches `"A"`, game matches nothing). Neither gives the desired OR semantics.

| # | Regex | Simulator | Game (iter 37) | Conclusion |
|---|-------|-----------|----------------|------------|
| B0-1 | `"увеличение урона.*луками"\|"увеличение урона.*посохами"` | Only gem 2 | ZERO | BROKEN |
| B0-2 | `"оберег"\|"компаньон"` | Only gem 1 | ZERO | BROKEN |
| B0-3 | `"глобальной меткости"\|"максимума здоровья компаньонов"` | Only gem 3 | ZERO | BROKEN |

**Conclusion:** Path A (decompose opt-table to `"X"|"Y"`) is IMPOSSIBLE. Use Path D instead.

**2. D7-3 — top-level `|` inside ONE quoted group with `.*` bridges WORKS in-game.**

The PoE2 regex engine was PATCHED since iterations 15-17. The simulator already modeled this correctly.

| Test | Regex | Result (game) | Simulator | Match? |
|------|-------|---------------|-----------|--------|
| D7-1 | `"увеличение урона (луками\|посохами)"` | Only gem 2 | gem 1 ❌, gem 2 ✅ | ✅ simulator matches broken game (Test 16) |
| D7-2 | `"(увеличение урона луками\|увеличение урона посохами)"` | Only gem 2 | gem 1 ❌, gem 2 ✅ | ✅ simulator matches broken game (Test 15) |
| **D7-3** | `"увеличение урона.*луками\|увеличение урона.*посохами"` | **Gems 1+2** | gem 1 ✅, gem 2 ✅ | ✅ **simulator matches patched game** |

### Path D — NEW strategy for same-family OR

When the user wants ANY of N mods from the same family (e.g., damage with different weapons: луками/посохами/копьями), use ONE quoted group with top-level `|` and `.*` bridge per alternative:

```
"prefix.*A|prefix.*B|prefix.*C"
```

This is the WORKING replacement for the broken opt-table pattern `"prefix (A|B|C)"` (Tests 16-17).

**Status:**
- ✅ 2 alternatives verified in-game (D7-3, iter 38)
- ✅ 3+4 alternatives verified in-game (iter 39, D1) — see below
- ✅ Path D + AND combination verified in-game (iter 39, D1)

**Fallback options if Path D fails on 3+ alternatives:**
- (b) UI redesign: each same-family mod becomes a SEPARATE AND filter (mutually exclusive choice in UI)
- (c) Fall back to AND (user must accept that selecting multiple same-family mods requires ALL to be present, not ANY)

---

## Iteration 40 — D2+D4 DONE (Path D implemented in ETL + runtime)

### What was done

1. **D2 — ETL Path D implementation:**
   - Created `scripts/etl/path-d-transform.ts` with `pathDTransform()` and `hasPathDGroup()` functions.
   - Added Phase D in `compute-optimizations.ts` (after Phase C dialect optimizations): transforms `prefix(A|B|C)` → `prefix.*A|prefix.*B|prefix.*C` for all opt-table entries with `()` groups containing `|`.
   - Updated `iterative-optimizer.ts` `reoptimizeTable()` to apply Path D after `applyDialectOptimizations`, with a condition to replace broken `()`-with-`|` entries even when Path D regex is longer.

2. **D4 — Runtime Path D compatibility:**
   - Updated `optimization-strategies.ts` `applyOptimizationTable()`:
     - `approxLength` for plain LITERAL now uses `approxCompiledLength` (with quotes) — consistent savings comparison.
     - Added `hasTopLevelAlternation()` helper to detect Path D entries (regex with top-level `|`).
     - Path D entries are ALWAYS applied when `matchedIds.size >= 2`, even with negative savings — the alternative (separate quoted groups `"X"|"Y"`) is BROKEN in PoE2 (B0 confirmed iter 38).
   - `buildOptimizedNode()` and `buildLiteralNode()` work unchanged — Path D regex passes through as a LITERAL value, compiler wraps it in `"..."` producing a single quoted group with top-level `|`.

3. **Testing:**
   - 35 unit tests for `path-d-transform.ts` (nested groups, optional `(ь|)`, char classes `[её]`, combined prefix+suffix, real-world patterns).
   - 3 D4 runtime tests in `optimizer.test.ts`: opt-table Path D → `optimize()` → `compile()` → single quoted group with top-level `|`.
   - 2 updated tests in `compute-optimizations.test.ts`: assertions changed from "shorter than flat OR" to "Path D format (top-level `|`, no `()` with `|`)".
   - All 1084 tests pass (1046 baseline + 35 path-d-transform + 3 D4 runtime).

4. **ETL regenerated all 10 JSON files** — Path D statistics:

| Category | Total opt-entries | Path D (top-level `\|`) | Flat (no `\|`) | Broken `()` with `\|` |
|----------|-------------------|-------------------------|----------------|------------------------|
| Jewel | 113 | 112 | 1 | 0 |
| Amulet | 114 | 54 | 60 | 0 |
| Ring | 93 | 45 | 48 | 0 |
| Belt | 83 | 47 | 36 | 0 |
| Tablet | 35 | 30 | 5 | 0 |
| Waystone | 43 | 15 | 28 | 0 |
| **TOTAL** | **481** | **303** | **178** | **0** |

### Sample Path D entries (before → after)

**Jewel (was broken `()` with nested groups):**
- Before: `увеличение (области действия|максимума (энергетического щита|здоровья)|уклонения|урона в ближнем бою|...)`
- After: `увеличение.*области действия|увеличение.*максимума.*энергетического щита|увеличение.*максимума.*здоровья|увеличение.*уклонения|увеличение.*урона в ближнем бою|...`

**Tablet (English, was broken `()`):**
- Before: `(Rare|from Vaal Beacons|Monsters|pack(s) of Monsters around Vaal Beacons|for Monsters around Vaal Beacons) in Map`
- After: `Rare.*in Map|from Vaal Beacons.*in Map|Monsters.*in Map|pack(s) of Monsters around Vaal Beacons.*in Map|for Monsters around Vaal Beacons.*in Map`

Note: `pack(s)` (single-alt group, no `|`) is PRESERVED — Path D only transforms groups with `|` inside.

### What's NOT done (next iteration)

- **D5 — In-game verification on 4 gems + extended set:** Path D is now in production ETL output. Need to verify in-game that the ETL-generated Path D regexes work correctly (especially the long ones with 6+ alternatives and nested structures).
- **D3 — regexExclude truncated stems:** `самострелами` ≠ `самострела`. Separate concern from Path D.
- **D6 — Spread to all categories:** ETL already applies Path D to ALL categories. D6 is effectively DONE from ETL perspective; only in-game verification (D5) remains.

### ⚠️ Risk: Path D `.*` bridges are more permissive

Path D uses `.*` between prefix and each alternative. This is MORE permissive than the original `prefix(A|B|C)` (literal concat). Potential FP risk: `prefix.*A` could match text where "prefix" and "A" appear with unrelated words between them.

**Mitigations:**
- Prefix and alt are typically unique word stems — `.*` bridge rarely matches unrelated text.
- iter 39 D1 verified FP-control works: `.*` bridge correctly rejects different prefixes/suffixes.
- D5 in-game verification will confirm no FP on production data.

If D5 reveals FP, options:
1. D3 — improve `regexExclude` with truncated stems + `(?!…)` per-block.
2. Targeted fixes for specific opt-table entries (manual override).
3. Fallback to UI redesign (each same-family mod = separate AND filter).

---

## Iteration 39 — D1 VERIFIED (Path D on 3+ alternatives)

3 functional in-game tests, all PASS exactly as predicted. Test items: 16 предметов from `регис/предметы для теста с аффиксами имплиситами_новый.md` (3 кольца + 3 путевых камня + 3 плиты + 3 амулета + 4 самоцвета).

### Test 1 — 4 alternatives (damage family)

**Regex:** `"увеличение урона.*огня|увеличение урона.*хаосом|увеличение урона.*луками|увеличение урона.*посохами"`

| Item | Matched mod | Alt |
|------|-------------|-----|
| Кольцо «Отвратительное потрясение» | `28% увеличение урона от огня` | `.*огня` |
| Кольцо «Ненавистное потрясение» | `15% увеличение урона хаосом` | `.*хаосом` |
| Самоцвет «Племенная лучина» | `15% увеличение урона боевыми посохами` | `.*посохами` |
| Самоцвет «Гипнотическая сущность» | `6% увеличение урона луками` | `.*луками` |

**Critical FP-control checks (NOT matched):**
- Самоцвет «Почётная мечта» — has `2% повышение скорости атаки боевыми посохами` (contains `посохами`) but NO `увеличение урона` in same block → `.*` bridge correctly fails
- Кольцо «Расколотый завиток» — has `Добавляет ... урона от огня к атакам` but prefix is `Добавляет` not `увеличение урона` → correctly NOT matched

**Result:** ✅ PASS — exactly 4 items matched, all FP-control items correctly rejected.

### Test 2 — 3 alternatives (resistance family, cross-category)

**Regex:** `"сопротивлению.*молнии|сопротивлению.*холоду|сопротивлению.*хаосу"`

| Item | Matched mod | Alt |
|------|-------------|-----|
| Кольцо «Отвратительное потрясение» | `+35% к сопротивлению молнии` | `.*молнии` |
| Амулет «Унылый фермуар» | `+12% к сопротивлению холоду` | `.*холоду` |
| Амулет «Крутящий горжет» | `+24% к сопротивлению молнии` | `.*молнии` |
| Амулет «Племенной медальон» | `+34% к сопротивлению молнии` + `+14% к сопротивлению хаосу` | both |

**Critical FP-control check (NOT matched):**
- Кольцо «Расколотый завиток» — has `+13% к сопротивлению всем стихиям` — `всем стихиям` is NOT in alternatives → correctly NOT matched (key FP-control test)

**Result:** ✅ PASS — exactly 4 items matched, FP-control on shared prefix works.

### Test 3 — Path D + AND combination (production scenario)

**Regex:** `"увеличение урона.*огня|увеличение урона.*хаосом|увеличение урона.*луками" "сопротивлению.*молнии"`

| Item | Why matched |
|------|-------------|
| Кольцо «Отвратительное потрясение» | Has BOTH `28% увеличение урона от огня` (1st group) AND `+35% к сопротивлению молнии` (2nd group) |

**All 15 other items correctly NOT matched** (each missing at least one of the two AND components):
- «Ненавистное потрясение» — has урона хаосом, no сопротивлению молнии
- «Гипнотическая сущность» — has урона луками, no сопротивления
- «Крутящий горжет», «Племенной медальон» — have сопротивлению молнии, no увеличение урона
- «Расколотый завиток» — has `сопротивлению всем стихиям` (≠ молнии) and no урона-увеличения

**Result:** ✅ PASS — exactly 1 item matched (AND semantics preserved with Path D).

### D1 conclusions

1. **Path D scales to 4+ alternatives** — no degradation observed
2. **Path D generalizes across prefix families** — verified on damage and resistance
3. **Path D composes safely with AND** — production use case verified
4. **FP-control via `.*` bridge works** — different prefix/suffix correctly rejected even when shared words appear
5. **Path D is ready for ETL implementation (D2)**

---

## Iteration 37 — Deterministic Strategy (8 principles, all categories)

### Test Items (4 Изумрудных самоцвета)

| Gem | Name | ilvl | Key mods |
|-----|------|------|----------|
| 1 | Племенная лучина | 82 | оберег duration, посохи damage, DoT duration, отравл |
| 2 | Гипнотическая сущность | 65 | crit атаками, луками damage, снаряд split, компаньон HP |
| 3 | Племенной узор | 28 | глобальная меткость, снарядов damage, наложения состояний, порог стихийных |
| 4 | Почётная мечта | 81 | посохи attack speed, порог стихийных, снарядами conditional |

### D1. Single-mod suffix matching — ✅ PASSED

Unique suffix per mod, no FP across 4 gems:
- `"длительности эффекта оберега"` → only gem 1
- `"максимума здоровья компаньонов"` → only gem 2
- `"глобальной меткости"` → only gem 3
- `"шанса наложения состояний"` → only gem 3

### D2. `.*` bridging within single block — ✅ PASSED

- `"увеличение урона.*посохами"` → gem 1 (боевыми посохами)
- `"увеличение урона.*луками"` → gem 2 (луками)
- `"скорости атаки.*посохами"` → gem 4 (боевыми посохами)
- Cross-weapon FP check: `"увеличение урона.*луками"` does NOT match gem 1 (посохами)

### D3. AND across blocks — ✅ PASSED

- Two mods on same gem: `"длительности эффекта оберега" "увеличение урона.*посохами"` → gem 1 MATCH
- AND is order-independent
- AND rejects items missing any mod

### D4. Cross-block FP risk — ✅ DEMONSTRATED

- FP RISK: `"увеличение" "меткости"` matches gem 3 via DIFFERENT blocks (mods: "увеличение урона снарядов" + "повышение глобальной меткости")
- FP PREVENTION via `.*` bridge: `"увеличение.*меткости"` does NOT match gem 3 (no single block has both)
- FP PREVENTION via `.*` bridge: `"повышение.*меткости"` matches gem 3 (same block: "повышение глобальной меткости")

### D5. Shared suffix differentiation — ✅ PASSED

- Shared suffix `"порога стихийных состояний"` matches BOTH gem 3 (10%) and gem 4 (12%)
- Differentiate by exact number: `"10%.*порога стихийных состояний"` → gem 3 only
- Differentiate by exact number: `"12%.*порога стихийных состояний"` → gem 4 only
- Family regex (any tier): `"(1[0-5])%.*порога стихийных состояний"` → BOTH gems

### D6. Single-word `|` as whole quoted group — ✅ PASSED

- `"луками|посохами"` → matches gems 1, 2, 4 (each has one of these words)
- Does NOT match gem 3 (no weapon damage mod)
- `"оберег|компаньон"` → matches gems 1, 2

### D9. Number patterns — ✅ PASSED

- Enumeration: `"(1[0-5])%.*suffix"` works
- Threshold: `"([2-9][0-9])%.*suffix"` works
- `^` anchor: `"^2%.*скорости атаки"` works
- Exact number: `"2%.*скорости атаки.*посохами"` → gem 4 only

### D10. Truncated stems — ✅ PASSED

- `"оберег"` matches `"оберега"` (genitive) — gem 1
- `"компаньон"` matches `"компаньонов"` (plural) — gem 2
- `"снаряд"` matches both `"снарядов"` (gem 3) and `"снарядами"` (gem 4)
- `"посох"` matches `"посохами"` (instrumental) — gems 1, 4

### D11. Combined mod regex — ✅ PASSED

Full deterministic pattern per mod: `"<number_pattern>.*<suffix>"`. All 5 tests pass.

---

## Iteration 15 — Legacy in-game tests

### T2. Threshold «отравление» ≥34% — ✅ PASSED

**Regex:** `"Монстры с (3[4-9]|[4-9][0-9]|\d{3,})%.*отравление"`

Тестовые предметы:
- Призрачный камень: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅
- Разрушенный коридор: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅

### T3. .* cross-block bridge — ✅ CONFIRMED: .* does NOT cross block boundaries

| Regex | Результат | Вывод |
|-------|-----------|-------|
| `"уклонению.*огня"` | Не подсветило | .* не мостит через границы модов |
| `"огня.*атакам"` | ПОДСВЕТИЛО | Один блок, `.*` работает ✅ |
| `"огня" "силе"` | ПОДСВЕТИЛО | AND crosses blocks ✅ |

---

## Iteration 36 — Legacy OR multi-word tests (Tests 15-17)

**Status:** These tests documented BROKEN behavior in iter 36. Iter 38 re-tested and confirmed:
- Tests 15, 16 are STILL BROKEN (multi-word `|` inside `()` and after non-`.*` prefix inside `"..."`)
- Test D7-3 (top-level `|` with `.*` inside ONE quoted group) is NOW WORKING (game patched)

| Test | Regex | Result |
|------|-------|--------|
| T15 | `(скорости атаки\|передвижения)` | Ничего не подсвечено (STILL BROKEN) |
| T16 | `"повышение (брони\|скорости)"` | Подсветило ВСЁ с «повышение» (STILL BROKEN) |
| T17 | `"повышение (брони\|скорости атаки\|шанса критического удара)"` | Много мусора (STILL BROKEN) |

**Resolution:** Use Path D (`"prefix.*A|prefix.*B|prefix.*C"`) instead of the broken `"prefix (A|B|C)"` opt-table patterns.

---

## FP Prevention Anchors — ALL VERIFIED ✅

| Anchor | Method | In-game test |
|--------|--------|-------------|
| `^` (anchorStart) | Template starts with `##` or `[+-]##` | ✅ A2, A5, A6 |
| `\+` (signPrefix '+') | Template has `+##` before number | ✅ A2, A4, A6, C1 |
| `-` (signPrefix '-') | Template has `-##` before number | ✅ A5, C2 |
| `%` suffix (anchorEnd) | Template has `##%` | ✅ A1, A4, A6 |
| `: ` colon | Reversed non-% mods with `: ##` | ✅ A7 |
| Prefix (middle-number) | Text before ## in types 3/9 | ✅ T2 |
| Threshold ≥N% | `([X-Y]\d|\d{3,})%.*suffix` | ✅ T2 |
| Enumeration | `(2[7-9]|30)%.*suffix` | ✅ C5 |

---

## 9 Pattern Types — ALL VERIFIED ✅

| # | Pattern | Regex form | Key feature |
|---|---------|-----------|-------------|
| 1 | `хх% бла бла` | `N%.*suffix` | anchorEnd=`%` |
| 2 | `+хх бла бла` | `^\+N.*suffix` | `^\+` anchoring |
| 3 | `бла бла хх бла бла` | `prefix N.*suffix` | prefix+`.*` |
| 4 | `бла бла +хх%` | `suffix.*\+N%` | reversed + `\+` + `%` |
| 5 | `-хх% бла бла` | `^-N%.*suffix` | `^-` signPrefix |
| 6 | `+хх% бла бла` | `^\+N%.*suffix` | double anchor |
| 7 | `бла бла х` | `suffix.*: N` | colonAnchor `: ` |
| 8 | `бла бла хх` | `suffix.*N` | reversed, no `%` |
| 9 | `бла бла хх% бла бла` | `prefix N%.*suffix` | prefix + `%` + suffix |

---

## Truncated Word Tails

**Принцип:** PoE2 = substring search. Truncation работает всегда, если укороченная форма не совпадает с другим значимым словом в контексте игровых предметов.

### Безопасные (применяются оптимизатором)

| Truncation | Морфема | Почему безопасно |
|------------|---------|------------------|
| `эффективн` | эффективность | Уникальная морфема |
| `бездн` | бездна/бездны | Уникальная морфема |
| `путев` | путевой/путевого | Уникальная морфема |
| `глубин` | глубина/глубины | Уникальная морфема |
| `приспешник` | приспешники/приспешника | Уникальная морфема |
| `оглушен` | оглушение/оглушения | Уникальная морфема |
| `флакон` | флакона/флаконы | Уникальная морфема |
| `хаос` | хаосу/хаосом | Уникальная морфема |
| `монстр` | монстры/монстров | Уникальная морфема |
| `оберег` | оберега/оберегом | iter 37: gem 1 verified |
| `компаньон` | компаньонов/компаньона | iter 37: gem 2 verified |
| `посох` | посохами/посоха | iter 37: gems 1, 4 verified |
| `снаряд` | снарядов/снарядами | iter 37: gems 3, 4 verified |

### Blacklisted (никогда не применяются)

| Truncation | Почему опасно |
|------------|---------------|
| `редкост` | FP на rarity label «редкий» |
| `редк` | FP на rarity label «редкий» |
| `провал` | Нетестировано + низкая ценность |
