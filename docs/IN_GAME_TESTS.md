# In-Game Regex Verification Tests

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> Помечай результат: ✅ пройден / ❌ не пройден / ⚠️ частично

---

## Verified Results Summary

### PoE2 Regex Dialect — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `|` OR without `()` | ✅ | `"огня\|холоду"` → 3 items |
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
| `%` suffix anchor (anchorEnd) | ✅ | Phase 9c | `"(2[7-9]\|30)%.*откладывания наград"` → only 27%, 30% |
| Enumeration without anchors | ⚠️ | Phase 9a | Compact and flat both FP when range notation contains matching number |

**Key discovery:** AND of two quoted groups for same suffix does NOT work as numeric range — secondary numbers from range notation satisfy each group independently. Enumeration solves this for non-overlapping values. `^` and `%` anchors solve remaining FP.

---

## Unresolved Tests

### Waystone #% values-only mods (PRIORITY: HIGH)

Regex `"(1[5-9]|2[0-4]).*области путевых камней"` (without `%` anchor) needs in-game verification. `%` anchor was removed for `#%` values-only tokens because it causes 100% FN.

### Groups A-F (fundamental, partially verified)

These hypothesis tests are largely covered by the verified results above. Remaining unverified:

- **C1/C2:** Cross-category conflicts ("молнии", "к силе") — likely fine but no direct in-game confirmation
- **E1-E3:** Waystone-specific patterns — partial coverage from M-group tests
- **F1-F3:** Edge cases (empty search, very long regex, special chars) — low priority

---

## Test Items Reference

| # | Item | Key mods |
|---|------|----------|
| R1 | Отвратительное потрясение | +66 max HP, 28% fire res, +121 evasion, +23 str, +35% lightning res |
| R2 | Расколотый завиток | 17-30 fire damage to attacks, 2-36 lightning damage, +32 str, +13% all res |
| A1 | Унылый фермуар | 28% mana regen, 43% evasion, +380 accuracy, +12% cold res, +33 int |
| A2 | Крутящий горжет | 25% mana regen, +184 accuracy, +62 ES, +24% lightning res |
| A3 | Племенной медальон | 27% mana regen, +17 max HP, +55 mana, +34% lightning res, +14% chaos res |
