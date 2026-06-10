# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Расширенный тест-план:** `регис/плитки для теста в игре.md`

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
| `.*` does NOT cross block boundaries | ✅ | B1-B2 verified |
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
2. `.*` does NOT cross block boundaries — each mod/implicit/property/name/state is a separate searchable block
3. `.*` is directional — forward only
4. AND via space between quoted groups is order-independent and works ACROSS blocks
5. Case insensitive
6. `!X` is item-wide
7. Description/tooltip text is NOT indexed

---

## Dual-Indexing — VERIFIED

PoE2 индексирует ДВА формата текста для модов: simplified и detailed (с range notation). Оба searchable.

| Context | Dual-indexed? | Verified |
|---------|--------------|----------|
| Tablet/Accessory mods | ✅ Yes | `"39[(]"` matches on tablets |
| Waystone implicits | ❌ No | `"Шанс выпадения путевого камня.*85[(]"` → ❌ |

---

## FP Prevention Anchors — VERIFIED

| Anchor | Method | Status | Key test |
|--------|--------|--------|----------|
| `^` (anchorStart) | Template starts with `##` | ✅ | `^(2[7-9]\|30).*suffix` |
| `%` suffix (anchorEnd) | Template has `##%`, anchorStart=false | ✅ | `"(2[7-9]\|30)%.*suffix"` |
| `: ` colon | Reversed non-% mods with `: ##` | ✅ VERIFIED | `"suffix.*: (number)"` |

---

## Positive + Negative Pattern — VERIFIED

| # | Regex | Result |
|---|-------|--------|
| PN1 | `"к сопротивлению огню" "!к сопротивлению холоду"` | ✅ Works |
| PN2 | `"к сопротивлению огню" !"к сопротивлению холоду"` | ❌ Nothing |
| PN3 | `"к сопротивлению огню" "к сопротивлению холоду"` | ✅ Works |

**Rule:** `!` ДОЛЖНО быть внутри кавычек: `"!text"` works, `!"text"` — НЕТ.

---

## Colon Anchor Fix — VERIFIED

| # | Мод | Порог | Значение | Результат |
|---|-----|-------|----------|-----------|
| T1 | дополнительных редких монстров | ≥2 | 1 | ✅ Не подсвечивает |
| T3 | дополнительных редких сундуков | ≥3 | 2 | ✅ Не подсвечивает |

---

## Block Model — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `.*` within single block only | ✅ | B1-B2: +35% lightning only |
| AND works across blocks | ✅ | `"максимуму здоровья" "к силе"` |
| Implicits indexed | ✅ | Waystone `"Шанс выпадения путевого камня.*85%"` |
| State text indexed ("Осквернено") | ✅ | Block K4 |
| Multi-line mods: `.*` crosses newline | ✅ | `"повышение шанса.*бонусу"` works |
