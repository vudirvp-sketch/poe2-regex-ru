# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Верификация v4:** 2026-06-12 — threshold T2, cross-block bridge T3, minion T1 pending.

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
| Threshold ≥N% | ✅ | `"Монстры с (3[4-9]\|[4-9][0-9]\|\d{3,})%.*отравление"` — T2 verified |

**Critical syntax rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries — verified T3
3. `.*` is directional — forward only
4. AND via space between quoted groups works ACROSS blocks
5. `!X` is item-wide — excludes ENTIRE item if X found in ANY block (not just matching block)
6. Description/tooltip text is NOT indexed
7. Item rarity label IS indexed — «редк» matches all rare items

---

## Iteration 15 In-Game Test Results

### T1. «приспешник» — PENDING

**Цель:** Найти предмет с модом содержащим «приспешников» или «приспешника», проверить regex `"приспешник"`.

**Результат:** В тестовом наборе нет предмета с модом «приспешник». Требуется найти в игре путевой камень или самоцвет с модом миньонов и повторить тест.

### T2. Threshold «отравление» ≥34% — ✅ PASSED

**Regex:** `"Монстры с (3[4-9]|[4-9][0-9]|\d{3,})%.*отравление"`

**Тестовые предметы:**
- Призрачный камень: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅
- Разрушенный коридор: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅

**Не подсвечено (корректно):**
- Кровотечение 18% — другой суффикс + ниже порога
- Путевые камни без мода отравления

**Вывод:** Threshold-regex для waystone суффиксов работает корректно. Enumeration и Threshold дают одинаковый результат на ≥34%.

### T3. .* межмодовый bridge — ✅ CONFIRMED: .* does NOT cross block boundaries

**Тест на Расколотый завиток (Кольцо Разлома):**

| Regex | Результат | Вывод |
|-------|-----------|-------|
| `"уклонению.*огня"` | Не подсветило | .* не мостит через границы модов |
| `"огня.*уклонению"` | Не подсветило | .* не мостит (обратный порядок) |
| `"огня.*силе"` | Не подсветило | implicit→mod блоки не пересекаются |

**Дополнительная проверка (внутриблочный `.*`):**
- `"огня.*атакам"` → **ПОДСВЕТИЛО** — «урона от огня к атакам» — один блок, `.*` работает ✅

**Итог:** `.*` работает строго в пределах одного блока. Для кросс-блочного поиска нужен AND: `"огня" "силе"`.

---

## FP Prevention Anchors — ALL VERIFIED ✅

| Anchor | Method | In-game test |
|--------|--------|-------------|
| `^` (anchorStart) | Template starts with `##` or `[+-]##` | ✅ A2, A5, A6 |
| `\+` (signPrefix '+') | Template has `+##` before number | ✅ A2, A4, A6, C1 |
| `-` (signPrefix '-') | Template has `-##` before number | ✅ A5, C2 |
| `%` suffix (anchorEnd) | Template has `##%` | ✅ A1, A4, A6 |
| `: ` colon | Reversed non-% mods with `: ##` | ✅ A7 |
| Prefix (middle-number) | Text before ## in types 3/9 | ✅ T2 (отравление) |
| Threshold ≥N% | `([X-Y]\d|\d{3,})%.*suffix` | ✅ T2 |
| Enumeration | `(2[7-9]|30)%.*suffix` | ✅ C5 |

---

## 9 Pattern Types — ALL VERIFIED ✅

| # | Pattern | Regex form | Test | Key feature |
|---|---------|-----------|------|-------------|
| 1 | `хх% бла бла` | `N%.*suffix` | ✅ A1 | anchorEnd=`%` |
| 2 | `+хх бла бла` | `^\+N.*suffix` | ✅ A2 | `^\+` anchoring |
| 3 | `бла бла хх бла бла` | `prefix N.*suffix` | ✅ A3, T2 | prefix+`.*` |
| 4 | `бла бла +хх%` | `suffix.*\+N%` | ✅ A4 | reversed + `\+` + `%` |
| 5 | `-хх% бла бла` | `^-N%.*suffix` | ✅ A5 | `^-` signPrefix |
| 6 | `+хх% бла бла` | `^\+N%.*suffix` | ✅ A6 | double anchor (`^\+` + `%`) |
| 7 | `бла бла х` | `suffix.*: N` | ✅ A7 | colonAnchor `: ` |
| 8 | `бла бла хх` | `suffix.*N` | ✅ A8 | reversed, no `%` |
| 9 | `бла бла хх% бла бла` | `prefix N%.*suffix` | ✅ A9, T2 | prefix + `%` + suffix |

---

## Truncated Word Tails

| Word | Safe? | Notes |
|------|-------|-------|
| `эффективн` | ✅ | No FP — verified in-game |
| `бездн` | ✅ | No FP — verified in-game |
| `путев` | ✅ | No FP — verified in-game |
| `глубин` | ✅ | No FP — verified in-game |
| `редкост` | ❌ | FP on rarity label — blacklisted |
| `приспешник` | ⏳ | Pending — need item with minion mod (T1) |
| `оглушен` | ⏳ | Pending in-game verification |
| `флакон` | ⏳ | Pending in-game verification |
| `хаос` | ⏳ | Pending in-game verification |
| `монстр` | ⏳ | Pending in-game verification |
