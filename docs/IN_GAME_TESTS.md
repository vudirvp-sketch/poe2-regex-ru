# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Тест-план (one-tab):** `регис/плитки для теста в игре.md`

---

## PoE2 Regex Dialect — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `\|` OR without `()` | ✅ | `"огня\|холоду"` → 3 items |
| `()` grouping | ✅ | `"(огня\|холоду)"` → same as without |
| `\|` inside `()` with number ranges | ✅ | `"([3-9][0-9]\|[0-9][0-9][0-9]).*к сопротивлению молнии"` |
| `\d` digit shorthand | ✅ | `"\d.*к максимуму здоровья"` |
| `!` + `\|` = `!(A\|B)` | ✅ | `"к сопротивлению" "!молнии\|хаосу"` |
| `()` + `\|` + `.*` scoped OR | ✅ | `"(огня\|молнии).*к атакам"` |
| `?` optional | ❌ | NOT supported |
| `.*` is directional (forward only) | ✅ | Reverse order → ❌ |
| `.*` does NOT cross block boundaries | ✅ | Verified |
| `.` matches literal dot | ✅ | `"15.9"` matches fractional |
| `[.]` for exact dot match | ✅ | `"15[.]9"` |
| `-` literal outside `[]` | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `"% к сопротивлению"` |
| `(` unmatched = literal | ✅ | `"(60"` matches literal |
| Case insensitive | ✅ | Verified with Cyrillic |
| `!X` is item-wide | ✅ | Excludes item if X in ANY block |
| AND across blocks | ✅ | `"максимуму здоровья" "к силе"` → ✅ |

**Critical syntax rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries
3. `.*` is directional — forward only
4. AND via space between quoted groups is order-independent, works ACROSS blocks
5. Case insensitive
6. `!X` is item-wide
7. Description/tooltip text is NOT indexed

---

## Dual-Indexing — VERIFIED

| Context | Dual-indexed? | Verified |
|---------|--------------|----------|
| Tablet/Accessory mods | ✅ Yes | `"39[(]"` matches on tablets |
| Waystone implicits | ❌ No | `"Шанс выпадения путевого камня.*85[(]"` → ❌ |

---

## FP Prevention Anchors — VERIFIED

| Anchor | Method | Status |
|--------|--------|--------|
| `^` (anchorStart) | Template starts with `##` | ✅ |
| `%` suffix (anchorEnd) | Template has `##%`, anchorStart=false | ✅ |
| `: ` colon | Reversed non-% mods with `: ##` | ✅ |

---

## Positive + Negative Pattern — VERIFIED

`"к сопротивлению огню" "!к сопротивлению холоду"` → ✅ Works
`"к сопротивлению огню" !"к сопротивлению холоду"` → ❌ Nothing (wrong syntax)

**Rule:** `!` ДОЛЖНО быть внутри кавычек: `"!text"` works, `!"text"` — НЕТ.

---

## Block Model — VERIFIED

- `.*` within single block only ✅
- AND works across blocks ✅
- Implicits indexed ✅
- State text indexed ("Осквернено") ✅
- Multi-line mods: `.*` crosses newline ✅
