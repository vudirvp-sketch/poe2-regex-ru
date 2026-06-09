# In-Game Regex Verification Tests

> Результаты проверки поведения PoE2 regex в игре (RU клиент).

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

### PoE2 Dual-Indexing — VERIFIED (Tablet Battery 2026-06-10)

**Ключевое открытие:** PoE2 индексирует ДВА формата текста одновременно:
1. **Simplified:** `39% увеличение количества...` (rolled value без range)
2. **Detailed:** `39(30-40)% увеличение количества...` (с range notation)

Оба searchable. `.*` матчит оба.

| Test | Regex | Result |
|------|-------|--------|
| F1: Suffix without number | `"находимых на карте путевых камней"` | ✅ ≥6 плиток |
| F2: `%` after number | `"39%.*находимых на карте путевых камней"` | ✅ Matches simplified display |
| F3: Number without `%` + suffix | `"39.*находимых на карте путевых камней"` | ✅ Same as F2 |
| F3a: Range notation present | `"39[(]"` | ✅ `39(30-40)%` also indexed |
| F4: `%` anchor on second mod | `"12%.*увеличение редкости находимых на карте предметов"` | ✅ Stable across mods |

### Range Notation FP Prevention — REVISED

| Method | Status | Key test | Notes |
|--------|--------|----------|-------|
| `^` anchor (anchorStart) | ✅ | `"^(2[7-9]\|30).*откладывания наград"` | Works for block-start patterns |
| `%` suffix anchor (anchorEnd) | ✅ (tablet) | `"(3[0-6]%\|39%).*находимых на карте путевых камней"` | **WORKS on tablets. Prevents range notation FP.** |
| `%` anchor on accessories | ⚠️ NEEDS RETEST | Previous: FN on `+##%` mods | **CONTRADICTS tablet results. Need retest.** |
| Enumeration without `%` | ⚠️ FP risk | `"(30\|39).*suffix"` → 6 tiles (3 FP from range) | FP from `(30-40)%` matching `30` |

**% anchor mechanism on tablets:**
- `"39%.*suffix"` → matches simplified `39%` display. ✅
- `"39.*suffix"` → matches both simplified AND `39` in `(30-40)%`. Extra matches = FP.
- `(30|39).*suffix` → 6 tiles (3 correct + 3 FP from `30` in `(30-40)%`)
- `(30%|39%).*suffix` → 3 tiles (correct only, `%` filters out range notation hits)

### Regex Syntax on Tablets — VERIFIED

| Feature | Status | Regex tested |
|---------|--------|-------------|
| `[]` + `.*` + long suffix | ✅ | `"[2-3][0-9]%.*находимых на карте путевых камней"` |
| `()` + `\|` + char class + `.*` + suffix | ✅ | `"(3[0-6]%\|39%).*находимых на карте путевых камней"` |
| `()` + `\|` + literals + `.*` + suffix | ✅ | `"(30%\|39%).*находимых на карте путевых камней"` |
| `\|` without `()` | ✅ | Standard left-binding behavior |
| Long enumeration + long suffix | ✅ | `"(30%\|33%\|34%\|36%\|39%).*увеличение количества находимых на карте путевых камней"` |

**Conclusion:** Regex syntax works on tablets. Waystone problem is NOT syntax-related.

---

## Active Test Battery

### A1: % Anchor Retest on Accessories — PRIORITY: CRITICAL

**Противоречие:** На плитках `%` anchor работает (F2 ✅). На аксессуарах ранее был FN. Нужен ретест.

**Предметы:** Кольцо R1 (`+35(31-35)% к сопротивлению молнии`), Амулет A3 (`+34(31-35)% к сопротивлению молнии`).

| # | Hypothesis | Regex | Expected | Actual |
|---|-----------|-------|----------|--------|
| A1 | `%` after number on ring | `"35%.*к сопротивлению молнии"` | Matches R1 | ⬜ |
| A2 | `%` after number on amulet | `"34%.*к сопротивлению молнии"` | Matches A3 | ⬜ |
| A3 | Range notation on ring | `"35[(]"` | Confirms `35(31-35)%` indexed | ⬜ |
| A4 | Without `%` — FP check | `"31.*к сопротивлению молнии"` | FP: matches `31` in `(31-35)%` of other items | ⬜ |
| A5 | With `%` — FP blocked | `"31%.*к сопротивлению молнии"` | Should NOT match items where 31 is only in range | ⬜ |

**Если A1 ✅ A2 ✅** → `%` anchor РАБОТАЕТ на аксессуарях. Предыдущий FN был ошибкой. Откатить disable.
**Если A1 ❌ A2 ❌** → `%` anchor НЕ работает на `+##%` модах. Разница: `+` prefix или формат accessory mods.

### W1: Waystone-Specific Diagnosis — PRIORITY: CRITICAL

**Раз regex syntax работает на плитках, проблема waystone-специфичная.** Нужны Путевые камни в тайнике.

| # | Hypothesis | Regex | Expected | Actual |
|---|-----------|-------|----------|--------|
| W1 | Suffix only | `"находимых в области путевых камней"` | Matches waystones with this mod | ⬜ |
| W2 | With `%` | `"15%.*находимых в области путевых камней"` | Matches waystone value 15 | ⬜ |
| W3 | Without `%` | `"15.*находимых в области путевых камней"` | Same as W2 | ⬜ |
| W4 | Full syntax test | `"(1[5-9]%\|2[0-4]%).*находимых в области путевых камней"` | Matches 15-24% | ⬜ |

**Diagnosis:**
- W1 ❌ → Waystone mod text NOT indexed. Root cause found.
- W1 ✅ W2 ❌ → Number + `.*` broken on waystones.
- W1 ✅ W2 ✅ W4 ❌ → Syntax issue specific to waystone text format.
- W4 ✅ → Works! Problem was in previous regex (missing `%`).

---

## Test Items Reference

| # | Item | Key mods |
|---|------|----------|
| R1 | Отвратительное потрясение | +66 max HP, 28% fire res, +121 evasion, +23 str, +35% lightning res |
| R2 | Расколотый завиток | 17-30 fire damage, 2-36 lightning damage, +32 str, +13% all res |
| A1 | Унылый фермуар | 28% mana regen, 43% evasion, +380 accuracy, +12% cold res, +33 int |
| A2 | Крутящий горжет | 25% mana regen, +184 accuracy, +62 ES, +24% lightning res |
| A3 | Племенной медальон | 27% mana regen, +17 max HP, +55 mana, +34% lightning res, +14% chaos res |
