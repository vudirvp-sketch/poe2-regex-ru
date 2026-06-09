# In-Game Regex Verification Tests

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> Помечай результат: ✅ пройден / ❌ не пройден / ⚠️ частично

---

## Verified Results Summary

### PoE2 Regex Dialect — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR without `()` | ✅ | `"огня\|холоду"` → 3 items |
| `()` grouping | ✅ | `"(огня\|холоду)"` → same as without |
| `\|` inside `()` with number ranges | ✅ | `"([3-9][0-9]\|[0-9][0-9][0-9]).*к сопротивлению молнии"` |
| `\d` digit shorthand | ✅ | `"\d.*к максимуму здоровья"` |
| `!` + `\|` = `!(A\|B)` | ✅ | `"к сопротивлению" "!молнии\|хаосу"` |
| `()` + `\|` + `.*` scoped OR | ✅ | `"(огня\|молнии).*к атакам"` |
| `?` optional | ❌ | NOT supported |
| `[её]?` | ❌ | NOT supported |
| `.*` across block boundaries | ❌ | Cross-block FP does NOT exist |
| `.` matches literal dot | ✅ | `"15.9"` matches fractional |
| `[.]` for exact dot match | ✅ | `"15[.]9"` |
| `-` literal outside `[]` | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `"% к сопротивлению"` |
| `(` unmatched = literal | ✅ | `"(60"` matches literal |
| Case insensitive | ✅ | Verified with Cyrillic |
| `!X` is item-wide | ✅ | Excludes item if X in ANY block |
| Description text NOT indexed | ✅ | `"картоходца"` → no match |

### Block Model — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `.*` within single block only | ✅ | `"максимуму здоровья.*к силе"` → ❌ |
| AND works across blocks | ✅ | `"максимуму здоровья" "к силе"` → ✅ |
| Name, type, properties indexed | ✅ | Blocks 1.1-1.5 |
| Implicits indexed | ✅ | Blocks 6.1-6.4 |
| State text indexed ("Осквернено") | ✅ | Block K4 |
| Multi-line mods: `.*` crosses newline | ✅ | `"повышение шанса.*бонусу"` works |
| Multi-line mods: `.*` is directional | ✅ | Reverse order → ❌ |
| AND works across sub-lines of multi-line mod | ✅ | `"критического удара" "бонусу критического"` |

### Range Notation FP Prevention — VERIFIED

| Method | Status | Key test | Regex |
|--------|--------|----------|-------|
| `^` anchor (anchorStart) | ✅ | Phase 9b | `"^(2[7-9]\|30).*откладывания наград"` → only 27%, 30% |
| `%` suffix anchor (anchorEnd) | ❌ | Phase 9c REVISED | `"(2[7-9]\|30)%.*suffix"` → FN on items with range notation |
| Enumeration without anchors | ⚠️ | Phase 9a | FP when range notation contains matching number |

**Key discovery:** `%` suffix anchor causes FN (false negatives) on items where in-game text shows range notation — e.g., `+27(22-27)%` means `27` is followed by `(` not `%`. In-game testing confirms this FN is widespread. **`%` anchor is now DISABLED for `+##%` accessory mods.** Enumeration alone provides FP protection for narrow ranges.

---

## Active Test Battery

### Waystone Number Range Regex — PRIORITY: CRITICAL

**Problem:** `"(1[5-9]|2[0-4]).*области путевых камней"` doesn't work in-game. Neither does the alternative split into separate quoted groups. Need to isolate the root cause.

**Test items needed:** Waystones with "На #% больше находимых в области путевых камней" mod (values 15, 18, 20, 24).

| # | Hypothesis | Regex to test | Expected | Actual |
|---|-----------|---------------|----------|--------|
| W1 | Simple suffix match | `"области путевых камней"` | Matches any waystone with this mod | ⬜ |
| W2 | Number literal + suffix | `"15.*области путевых камней"` | Matches waystone with value 15 | ⬜ |
| W3 | Char class + suffix | `"1[5-9].*области путевых камней"` | Matches 15-19 | ⬜ |
| W4 | `()` + 2 literal OR | `"(15\|16).*области путевых камней"` | Matches 15 or 16 | ⬜ |
| W5 | `()` + char class OR | `"(1[5-9]\|2[0-4]).*области путевых камней"` | Matches 15-24 | ⬜ |
| W6 | OR without `()` | `"1[5-9]\|2[0-4].*области путевых камней"` | Ambiguous binding — test behavior | ⬜ |
| W7 | Separate AND groups (incorrect) | `"1[5-9].*области путевых камней" "2[0-4].*области путевых камней"` | Should NOT work (AND, not OR) | ⬜ |
| W8 | Shorter suffix | `"(1[5-9]\|2[0-4]).*путевых камней"` | Shorter regex — test length limits | ⬜ |
| W9 | Enumeration flat | `"(15\|16\|17\|18\|19\|20\|21\|22\|23\|24).*области путевых камней"` | Test length limit | ⬜ |
| W10 | Char class without `()` | `"1[5-9].*области путевых камней"` | Single decade — simpler pattern | ⬜ |
| W11 | `^` anchor + `#%` mod | `"^(1[5-9]\|2[0-4]).*области путевых камней"` | Number at start of block? | ⬜ |
| W12 | Suffix-only fallback | `"путевых камней"` | Minimal match — verify text indexed | ⬜ |

**Diagnosis flow:**
1. If W1 fails → waystone mod text not indexed / text format different than expected
2. If W1 ✅ but W2 fails → number + `.*` + suffix combination broken for waystones
3. If W2 ✅ but W3 fails → char class `[]` broken with `.*` + suffix
4. If W3 ✅ but W5 fails → `()` + `|` + char class + `.*` binding issue
5. If W5 ✅ but not in practice → length limit or item text format issue
6. If W8 ✅ but W5 fails → regex length limit in PoE2
7. If W9 fails but W5 ✅ → flat enumeration too long

### % Suffix Anchor — PRIORITY: HIGH

**Problem:** `anchorEnd='%'` causes FN on `+##%` accessory mods because in-game text shows range notation where `%` never immediately follows the number.

**Test items needed:** Ring/amulet/belt with `+##% к сопротивлению ...` mods.

| # | Hypothesis | Regex to test | Expected | Actual |
|---|-----------|---------------|----------|--------|
| P1 | `%` after number WITHOUT range notation | `"27%.*к сопротивлению огню"` | Matches item showing `+27%` without range | ⬜ |
| P2 | `%` after number WITH range notation | `"27%.*к сопротивлению огню"` | Does NOT match `+27(22-27)%...` | ⬜ |
| P3 | Enumeration without `%` anchor | `"(2[7-9]\|30).*к сопротивлению огню"` | Matches both plain and range notation items | ⬜ |
| P4 | `)%` as flexible anchor | `")%.*к сопротивлению огню"` | Matches `+(22—27)%...` format | ⬜ |
| P5 | Does game always show range notation? | `"27%.*к сопротивлению"` | If 0 matches → always range notation in search | ⬜ |
| P6 | Enumeration on ring with range notation | `"(2[7-9]\|30).*к сопротивлению огню"` | FP on `+26(27-50)%...`? | ⬜ |
| P7 | Belt `+##%` mod | `"30%.*к сопротивлению хаосу"` | Test belt specifically | ⬜ |
| P8 | Amulet `+##%` mod | `"25%.*к сопротивлению холоду"` | Test amulet specifically | ⬜ |

**Key question:** Does PoE2's search index text WITH or WITHOUT range notation? If always WITH → `%` anchor is 100% FN.

### Cross-Category % Anchor — PRIORITY: MEDIUM

**Problem:** User reports `%` anchor breaks matching "not only there" — need to identify all affected categories.

| # | Category | Template pattern | anchorEnd set? | Test result |
|---|----------|-----------------|----------------|-------------|
| C1 | Ring `+##%` | `+##% к сопротивлению ...` | Yes → '%' | ⬜ |
| C2 | Amulet `+##%` | `+##% к сопротивлению ...` | Yes → '%' | ⬜ |
| C3 | Belt `+##%` | `+##% к сопротивлению ...` | Yes → '%' | ⬜ |
| C4 | Waystone `#%` | `На #% больше ...` | No (correct) | ⬜ |
| C5 | Tablet `##%` | `##% уменьшение ...` | No (^ only) | ⬜ |
| C6 | Jewel `##%` | `##% повышение ...` | Depends on template | ⬜ |

---

## Test Items Reference

| # | Item | Key mods |
|---|------|----------|
| R1 | Отвратительное потрясение | +66 max HP, 28% fire res, +121 evasion, +23 str, +35% lightning res |
| R2 | Расколотый завиток | 17-30 fire damage to attacks, 2-36 lightning damage, +32 str, +13% all res |
| A1 | Унылый фермуар | 28% mana regen, 43% evasion, +380 accuracy, +12% cold res, +33 int |
| A2 | Крутящий горжет | 25% mana regen, +184 accuracy, +62 ES, +24% lightning res |
| A3 | Племенной медальон | 27% mana regen, +17 max HP, +55 mana, +34% lightning res, +14% chaos res |
