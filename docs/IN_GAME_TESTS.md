# In-Game Regex Verification Results

> Результаты проверки поведения PoE2 regex в игре (RU клиент).
> **Верификация v5:** 2026-06-12 — принципы truncations уточнены.

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
| Threshold ≥N% | ✅ | `"Монстры с (3[4-9]\|[4-9][0-9]\|\d{3,})%.*отравление"` |
| Substring search | ✅ | Truncated words work (e.g. `"приспешник"` matches `"приспешников"`) |

**Critical syntax rules:**
1. `!` must be INSIDE quotes: `"!A|B"` works, `!"A|B"` does NOT
2. `.*` does NOT cross block boundaries
3. `.*` is directional — forward only
4. AND via space between quoted groups works ACROSS blocks
5. `!X` is item-wide — excludes ENTIRE item if X found in ANY block
6. Description/tooltip text is NOT indexed
7. Item rarity label IS indexed — «редк» matches all rare items

---

## Iteration 15 In-Game Test Results

### T2. Threshold «отравление» ≥34% — ✅ PASSED

**Regex:** `"Монстры с (3[4-9]|[4-9][0-9]|\d{3,})%.*отравление"`

**Тестовые предметы:**
- Призрачный камень: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅
- Разрушенный коридор: `Монстры с 36% шансом могут наложить отравление при нанесении удара` → **ПОДСВЕЧЕНО** ✅

**Не подсвечено (корректно):**
- Кровотечение 18% — другой суффикс + ниже порога
- Путевые камни без мода отравления

### T3. .* межмодовый bridge — ✅ CONFIRMED: .* does NOT cross block boundaries

| Regex | Результат | Вывод |
|-------|-----------|-------|
| `"уклонению.*огня"` | Не подсветило | .* не мостит через границы модов |
| `"огня.*уклонению"` | Не подсветило | .* не мостит (обратный порядок) |
| `"огня.*силе"` | Не подсветило | implicit→mod блоки не пересекаются |
| `"огня.*атакам"` | ПОДСВЕТИЛО | Один блок, `.*` работает ✅ |
| `"огня" "силе"` | ПОДСВЕТИЛО | AND crosses blocks ✅ |

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

**Принцип:** PoE2 = substring search. Truncation работает всегда, если укороченная форма не совпадает с другим значимым словом в контексте игровых предметов. Отдельная in-game верификация базовых truncations не нужна.

### Безопасные (применяются оптимизатором)

| Truncation | Морфема | Почему безопасно |
|------------|---------|------------------|
| `эффективн` | эффективность | Уникальная морфема, нет других слов |
| `бездн` | бездна/бездны/бездн | Уникальная морфема |
| `путев` | путевой/путевого/путевые | Уникальная морфема |
| `глубин` | глубина/глубины | Уникальная морфема |
| `приспешник` | приспешники/приспешника | Уникальная морфема, базовый substring |
| `оглушен` | оглушение/оглушения | Уникальная морфема |
| `флакон` | флакона/флаконы | Уникальная морфема |
| `хаос` | хаосу/хаосом | Уникальная морфема |
| `монстр` | монстры/монстров | Уникальная морфема |

### Blacklisted (никогда не применяются)

| Truncation | Почему опасно |
|------------|---------------|
| `редкост` | FP на rarity label «редкий» — подсветит ВСЕ редкие предметы |
| `редк` | FP на rarity label «редкий» |
| `провал` | Нетестировано + низкая ценность |
