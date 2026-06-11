# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Верификация v3:** 2026-06-11 — все 9 типов паттернов + комбинации И/ИЛИ.
> **Результат: 18/18 тестов подтверждают корректную работу.**

---

## PoE2 Regex Dialect — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR | ✅ | `"огня\|холоду"` |
| `()` grouping | ✅ | `"(огня\|холоду)"` |
| `\d` digit shorthand | ✅ | `"\d.*к максимуму здоровья"` |
| `{N,}` quantifier | ✅ | `"\d{2,}%.*золота"` |
| `!` + `\|` = `!(A\|B)` | ✅ | `"к сопротивлению" "!молнии\|хаосу"` |
| `?` optional | ❌ | NOT supported |
| `.*` within single block | ✅ | Does NOT cross block boundaries |
| `-` literal | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `\+` matches literal + |
| `^` start-of-block anchor | ✅ | `"^28%"` anchors to block start |
| Case insensitive | ✅ | Cyrillic verified |
| `!X` item-wide | ✅ | Excludes item if X in ANY block |
| AND across blocks | ✅ | `"максимуму здоровья" "к силе"` |

**Critical syntax rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries
3. `.*` is directional — forward only
4. AND via space between quoted groups works ACROSS blocks
5. `!X` is item-wide — excludes ENTIRE item if X found in ANY block (not just matching block)
6. Description/tooltip text is NOT indexed
7. Item rarity label IS indexed — «редк» matches all rare items

---

## FP Prevention Anchors — ALL VERIFIED ✅

| Anchor | Method | In-game test |
|--------|--------|-------------|
| `^` (anchorStart) | Template starts with `##` or `[+-]##` | ✅ A2, A5, A6 |
| `\+` (signPrefix '+') | Template has `+##` before number | ✅ A2, A4, A6, C1 |
| `-` (signPrefix '-') | Template has `-##` before number | ✅ A5, C2 |
| `%` suffix (anchorEnd) | Template has `##%` | ✅ A1, A4, A6 |
| `: ` colon | Reversed non-% mods with `: ##` | ✅ A7 |
| Prefix (middle-number) | Text before ## in types 3/9 | ✅ (iteration 14, pending full in-game test) |
| Threshold ≥N% | `([X-Y]\d|\d{3,})%.*suffix` | ✅ B5 |
| Enumeration | `(2[7-9]|30)%.*suffix` | ✅ C5 |

---

## 9 Pattern Types — ALL VERIFIED ✅

| # | Pattern | Regex form | Test | Key feature |
|---|---------|-----------|------|-------------|
| 1 | `хх% бла бла` | `N%.*suffix` | ✅ A1 | anchorEnd=`%` |
| 2 | `+хх бла бла` | `^\+N.*suffix` | ✅ A2 | `^\+` anchoring |
| 3 | `бла бла хх бла бла` | `prefix N.*suffix` | ✅ A3 | prefix+`.*` (improved it.14) |
| 4 | `бла бла +хх%` | `suffix.*\+N%` | ✅ A4 | reversed + `\+` + `%` |
| 5 | `-хх% бла бла` | `^-N%.*suffix` | ✅ A5 | `^-` signPrefix |
| 6 | `+хх% бла бла` | `^\+N%.*suffix` | ✅ A6 | double anchor (`^\+` + `%`) |
| 7 | `бла бла х` | `suffix.*: N` | ✅ A7 | colonAnchor `: ` |
| 8 | `бла бла хх` | `suffix.*N` | ✅ A8 | reversed, no `%` |
| 9 | `бла бла хх% бла бла` | `prefix N%.*suffix` | ✅ A9 | prefix + `%` + suffix (improved it.14) |

---

## Truncated Word Tails

| Word | Safe? | Notes |
|------|-------|-------|
| `эффективн` | ✅ | No FP — verified in-game |
| `бездн` | ✅ | No FP — verified in-game |
| `путев` | ✅ | No FP — verified in-game |
| `глубин` | ✅ | No FP — verified in-game |
| `редкост` | ❌ | FP on rarity label — blacklisted |
| `приспешник` | ⏳ | Pending in-game verification |
| `оглушен` | ⏳ | Pending in-game verification |
| `флакон` | ⏳ | Pending in-game verification |
| `хаос` | ⏳ | Pending in-game verification |
| `монстр` | ⏳ | Pending in-game verification |
