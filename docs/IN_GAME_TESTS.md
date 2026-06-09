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
| `.*` is directional (forward only) | ✅ | Reverse order → ❌ |
| `.*` across affix blocks | ⚠️ | See Block Model section |
| `.` matches literal dot | ✅ | `"15.9"` matches fractional |
| `[.]` for exact dot match | ✅ | `"15[.]9"` |
| `-` literal outside `[]` | ✅ | `"-11"` matches negative values |
| `%` and `+` are literals | ✅ | `"+66"`, `"% к сопротивлению"` |
| `(` unmatched = literal | ✅ | `"(60"` matches literal |
| Case insensitive | ✅ | Verified with Cyrillic |
| `!X` is item-wide | ✅ | Excludes item if X in ANY block |
| Description text NOT indexed | ✅ | `"картоходца"` → no match |
| AND across blocks | ✅ | `"максимуму здоровья" "к силе"` → ✅ |

### PoE2 Dual-Indexing — VERIFIED

PoE2 индексирует ДВА формата текста **для модов**:
1. **Simplified:** `39% увеличение количества...` (rolled value без range)
2. **Detailed:** `39(30-40)% увеличение количества...` (с range notation)

Оба searchable. `.*` матчит оба. Подтверждено на плитках и аксессуарах.

**Имплисеты: NO dual-indexing.** Только simplified формат: `Шанс выпадения путевого камня: +85%`

| Context | Dual-indexed? | Verified |
|---------|--------------|----------|
| Tablet mods (`##% suffix`) | ✅ Yes | `"39[(]"` matches on tablets |
| Accessory mods (`+##% suffix`) | ✅ Yes | Implied by `%` anchor working |
| Waystone mods (`##% suffix`) | ✅ Presumed | Same pattern as tablets |
| Waystone implicits (`Label: +##%`) | ❌ No | `"Шанс выпадения путевого камня.*85[(]"` → ❌ |

### % Anchor — VERIFIED AND RE-ENABLED

| Method | Status | Notes |
|--------|--------|-------|
| `%` suffix anchor (anchorEnd) | ✅ RE-ENABLED | Works on mods. Prevents range notation FP. |
| `%` on implicits (reversed) | ✅ | `"Шанс выпадения путевого камня.*85%"` works |
| `^` anchor (anchorStart) | ✅ | For ##% mods where number starts the block |
| Enumeration without `%` | ⚠️ FP risk | `(30\|39).*suffix` → FP from `(30-40)%` |

**% anchor mechanism:**
- Mods: `"(3[0-6]%\|39%).*suffix"` → correct, `%` filters range FP
- Implicits: `"Label.*(range)%"` → correct, no range FP possible (no dual-indexing)

### Block Model — VERIFIED

| Feature | Status | Key test |
|---------|--------|----------|
| `.*` within single block only | ✅ | Directional, forward only |
| `.*` crosses mod→implicit sections | ⬜ | Not tested yet |
| AND works across blocks | ✅ | `"максимуму здоровья" "к силе"` |
| Implicits indexed | ✅ | Waystone WV2 ✅ |
| State text indexed ("Осквернено") | ✅ | Block K4 |
| Multi-line mods: `.*` crosses newline | ✅ | `"повышение шанса.*бонусу"` works |

### Regex Syntax — VERIFIED

| Feature | Status | Regex tested |
|---------|--------|-------------|
| `[]` + `.*` + long suffix | ✅ | `"[2-3][0-9]%.*находимых на карте путевых камней"` |
| `()` + `\|` + char class + `.*` + suffix | ✅ | `"(3[0-6]%\|39%).*suffix"` |
| `()` + `\|` + literals + `.*` + suffix | ✅ | `"(30%\|39%).*suffix"` |
| Long enumeration + long suffix | ✅ | No length limit hit |

---

## Waystone — FULL MODEL

### Корень проблемы (FOUND)

`"На #% больше находимых в области путевых камней"` — НЕ мод. Это имплисет-бонус, который в поиске не индексируется как мод-текст.

In-game: `"находимых в области путевых камней"` → ❌ Ничего.

### Что реально searchable на путевых камнях

**Моды (префиксы/суффиксы):**

Формат: `##% описание` (число ПЕРЕД текстом)
Regex: `число%.*суффикс` или `^число.*суффикс`

- `"Монстры с ##% шансом могут наложить отравление при нанесении удара"`
- `"Монстры имеют ###% повышение шанса критического удара"` + `"+##% к бонусу критического урона монстров"`
- `"##% максимум сопротивлений игроков"`
- `"Область имеет участки замерзшей земли"`
- и т.д.

**Имплисеты (отдельная секция):**

Формат: `Описание: +##%` (число ПОСЛЕ текста)
Regex: `суффикс.*число%`

- `"Шанс выпадения путевого камня: +##%"`
- `"Редкость предметов: +##%"`
- `"Размер групп монстров: +##%"`
- `"Эффективность монстров: +##%"`
- `"Доступно возрождений: #"`

**НЕ моды (имплисет-бонусы, не searchable):**
- `"На ##% больше находимых в области путевых камней"` ← НЕ searchable
- `"##% увеличение эффективности монстров"` ← НЕ searchable
- `"На ##% больше редкости находимых в этой области предметов"` ← НЕ searchable
- `"На ##% больше размера групп монстров"` ← НЕ searchable

### Waystone in-game verification — ALL PASSED

| # | Regex | Result | Conclusion |
|---|-------|--------|------------|
| WV1 | `"повышение шанса критического удара"` | ✅ | Waystone mods indexed |
| WV2 | `"Шанс выпадения путевого камня"` | ✅ | Waystone implicits indexed |
| WV3 | `"85%.*Шанс выпадения путевого камня"` | ❌ | Wrong direction (number after text) |
| WV3a | `"Шанс выпадения путевого камня.*85%"` | ✅ | Correct direction for implicits |
| WV3b | `"Шанс выпадения путевого камня.*85%"` | ✅ | `%` anchor works on implicits |
| WV3c | `"Шанс выпадения путевого камня.*85[(]"` | ❌ | No dual-indexing on implicits |
| WV4 | `"276%.*повышение шанса критического удара"` | ✅ | `%` anchor works on waystone mods |
| WV5a | `"Шанс выпадения путевого камня" "85%"` | ✅ | AND across blocks works |

### Regex patterns for waystone generation

**Моды (number BEFORE text):**
```
"(1[5-9]|2[0-4])%.*порога состояний"     ← anchorEnd %
"^(1[5-9]|2[0-4]).*порога состояний"     ← anchorStart ^
```

**Имплисеты (text BEFORE number):**
```
"Шанс выпадения путевого камня.*([0-9]|[1-9][0-9]|[1-2][0-9][0-9]|250)%"    ← reversed: suffix.*number% (range 0-250 unrestricted)
"Редкость предметов.*([0-9]|[1-9][0-9]|[1-2][0-9][0-9]|250)%"
"Эффективность монстров.*([0-9]|[1-9][0-9]|[1-2][0-9][0-9]|250)%"
```

### Правило для ETL

1. Строки, влияющие на имплисет — НЕ моды. Убрать из списка модов.
2. Имплисет-бонусы (`"На ##% больше..."`, `"##% увеличение эффективности монстров"`) — не searchable.
3. Имплисеты (`"Шанс выпадения путевого камня: +##%"`) — searchable, но regex REVERSED (text.*number%).
4. Только ПЕРВАЯ строка каждой мод-группы — это мод.

---

## Active Test Battery

### B1: Block Model Re-investigation — PRIORITY: MEDIUM

`"35%.*к сопротивлению молнии"` матчит кольцо с +35% cold res И +41% lightning res (разные аффиксы).

| # | Regex | Purpose | Actual |
|---|-------|---------|--------|
| B1 | `"35%.*к сопротивлению холоду"` | `.*` within same block? | ⬜ |
| B2 | `"+66.*к силе"` | `.*` across prefix-suffix? | ⬜ |

---

## Test Items Reference

| # | Item | Key mods |
|---|------|----------|
| R1 | Отвратительное потрясение | +66 max HP, 28% fire res, +121 evasion, +23 str, +35% lightning res |
| R2 | Расколотый завиток | 17-30 fire damage, 2-36 lightning damage, +32 str, +13% all res |
| A1 | Унылый фермуар | 28% mana regen, 43% evasion, +380 accuracy, +12% cold res, +33 int |
| A2 | Крутящий горжет | 25% mana regen, +184 accuracy, +62 ES, +24% lightning res |
| A3 | Племенной медальон | 27% mana regen, +17 max HP, +55 mana, +34% lightning res, +14% chaos res |
