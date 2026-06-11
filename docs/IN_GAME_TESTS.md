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
| Threshold ≥N% | `([X-Y]\d|\d{3,})%.*suffix` | ✅ B5 |
| Enumeration | `(2[7-9]|30)%.*suffix` | ✅ C5 |

---

## 9 Pattern Types — ALL VERIFIED ✅

| # | Pattern | Regex form | Test | Key feature |
|---|---------|-----------|------|-------------|
| 1 | `хх% бла бла` | `N%.*suffix` | ✅ A1 | anchorEnd=`%` |
| 2 | `+хх бла бла` | `^\+N.*suffix` | ✅ A2 | `^\+` anchoring |
| 3 | `бла бла хх бла бла` | `prefix.*suffix` | ✅ A3 | `.*` in middle |
| 4 | `бла бла +хх%` | `suffix.*\+N%` | ✅ A4 | reversed + `\+` + `%` |
| 5 | `-хх% бла бла` | `^-N%.*suffix` | ✅ A5 | `^-` signPrefix |
| 6 | `+хх% бла бла` | `^\+N%.*suffix` | ✅ A6 | double anchor (`^\+` + `%`) |
| 7 | `бла бла х` | `suffix.*: N` | ✅ A7 | colonAnchor `: ` |
| 8 | `бла бла хх` | `suffix.*N` | ✅ A8 | reversed, no `%` |
| 9 | `бла бла хх% бла бла` | `prefix N%.*suffix` | ✅ A9 | prefix + `%` + suffix |

---

## Combinations — ALL VERIFIED ✅

| Type | Test | Regex | Result |
|------|------|-------|--------|
| AND cross-block | B1 | `"к максимуму здоровья" "к силе"` | ✅ |
| OR within group | B2 | `"к максимуму здоровья\|к максимуму маны"` | ✅ |
| AND + EXCLUDE | B3 | `"к сопротивлению" "!молнии\|хаосу"` | ✅ |
| OR between types | B4 | `"\+66\|отравлен"` | ✅ |
| Threshold + suffix | B5 | `"([3-9][0-9]\|\d{3,})%.*редких монстров"` | ✅ |
| AND two thresholds | B6 | `"Редкость предметов.*\+([2-9][0-9]|\d{3,})%" "Эффективность монстров.*([3-9][0-9]|\d{3,})%"` | ✅ |

**B3 insight:** `!` is item-wide — `!молнии|хаосу` excludes items containing «молнии» in ANY block, even unrelated mods like «урона от молнии к атакам».

---

## Edge Cases — ALL VERIFIED ✅

| Case | Test | Regex | Result |
|------|------|-------|--------|
| `\+` isolation | C1 | `"^\+([1-9][0-9]\|\d{3,}).*к максимуму здоровья"` | ✅ — only `+N` matched |
| `-` isolation | C2 | `"-(1[0-9]\|[0-9])%.*максимум сопротивлен"` | ✅ — only `-N` matched |
| Fractional `[.]` | C3 | `"15[.]9"` | ✅ — matched 15.9, not 30.9 |
| `\d{3,}%` no FP | C4 | `"\d{3,}%.*к сопротивлению"` | ✅ — nothing matched (no ≥100% items) |
| Enumeration | C5 | `"(2[7-9]\|30)%.*увеличение урона"` | ✅ — exact range [27,30] |

---

## Block Model — VERIFIED

- `.*` within single block only ✅
- AND works across blocks ✅
- Implicits indexed ✅
- Item rarity label indexed («редкий» / «редк») ✅

---

## Truncated Word Tails

| Word | Safe? | Notes |
|------|-------|-------|
| `эффективн` | ✅ | No FP |
| `бездн` | ✅ | No FP |
| `путев` | ✅ | No FP |
| `глубин` | ✅ | No FP |
| `редкост` | ❌ | FP on rarity label — blacklisted |
